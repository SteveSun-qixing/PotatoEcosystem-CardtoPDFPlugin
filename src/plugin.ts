/**
 * CardtoPDFPlugin 主类
 *
 * 将卡片转换为 PDF，依赖 CardtoHTMLPlugin 生成 HTML
 */

import { v4 as uuidv4 } from 'uuid';
import type { ConversionSource } from '@chips/cardto-html-plugin';
import { CardtoHTMLPlugin } from '@chips/cardto-html-plugin';
import type {
  PDFConversionOptions,
  PDFConversionResult,
  PDFConverterPlugin,
  PDFProgressInfo,
  PageSize,
} from './types';

/**
 * 插件元数据
 */
const PLUGIN_METADATA = {
  id: 'cardto-pdf-plugin',
  name: '卡片转 PDF 插件',
  version: '0.1.0',
  sourceTypes: ['.card', 'card'],
  targetType: 'pdf',
  description: '将薯片卡片文件转换为 PDF 文档',
};

/**
 * 默认选项
 */
const DEFAULT_OPTIONS: PDFConversionOptions = {
  pageSize: 'A4',
  orientation: 'portrait',
  margin: {
    top: '20mm',
    right: '20mm',
    bottom: '20mm',
    left: '20mm',
  },
  includeCover: true,
  includeTOC: false,
  printBackground: true,
  scale: 1,
};

/**
 * 页面尺寸映射
 */
const PAGE_SIZES: Record<PageSize, { width: string; height: string } | null> = {
  A4: { width: '210mm', height: '297mm' },
  A3: { width: '297mm', height: '420mm' },
  Letter: { width: '8.5in', height: '11in' },
  Legal: { width: '8.5in', height: '14in' },
  Tabloid: { width: '11in', height: '17in' },
  custom: null,
};

/**
 * CardtoPDFPlugin 转换器插件
 */
export class CardtoPDFPlugin implements PDFConverterPlugin {
  readonly id = PLUGIN_METADATA.id;
  readonly name = PLUGIN_METADATA.name;
  readonly version = PLUGIN_METADATA.version;
  readonly sourceTypes = PLUGIN_METADATA.sourceTypes;
  readonly targetType = PLUGIN_METADATA.targetType;
  readonly description = PLUGIN_METADATA.description;

  private _htmlPlugin: CardtoHTMLPlugin;

  constructor() {
    this._htmlPlugin = new CardtoHTMLPlugin();
  }

  /**
   * 执行转换
   */
  async convert(
    source: ConversionSource,
    options?: PDFConversionOptions
  ): Promise<PDFConversionResult> {
    const taskId = uuidv4();
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    const reportProgress = (
      status: PDFProgressInfo['status'],
      percent: number,
      step?: string
    ): void => {
      if (mergedOptions.onProgress) {
        mergedOptions.onProgress({ taskId, status, percent, currentStep: step });
      }
    };

    try {
      // 1. 使用 CardtoHTMLPlugin 转换为 HTML
      reportProgress('converting-html', 0, '正在生成 HTML');

      const htmlResult = await this._htmlPlugin.convert(source, {
        themeId: mergedOptions.themeId,
        includeAssets: true,
      });

      if (!htmlResult.success || !htmlResult.data) {
        return {
          success: false,
          taskId,
          error: htmlResult.error ?? {
            code: 'CONV-HTML-002' as const,
            message: 'HTML 转换失败',
          },
        };
      }

      reportProgress('generating-pdf', 40, 'HTML 生成完成，准备生成 PDF');

      // 2. 使用 Puppeteer 生成 PDF
      const pdfData = await this._generatePDF(
        htmlResult.data.files,
        mergedOptions
      );

      // 3. 处理输出
      if (mergedOptions.outputPath) {
        await this._writeToFile(pdfData, mergedOptions.outputPath);
      }

      reportProgress('completed', 100, '转换完成');

      const duration = Date.now() - startTime;

      return {
        success: true,
        taskId,
        outputPath: mergedOptions.outputPath,
        data: mergedOptions.outputPath ? undefined : pdfData,
        duration,
      };
    } catch (error) {
      reportProgress('failed', 0, '转换失败');

      return {
        success: false,
        taskId,
        error: {
          code: 'CONV-HTML-007' as const,
          message: error instanceof Error ? error.message : 'PDF 生成失败',
          cause: error instanceof Error ? error : undefined,
        },
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 获取默认选项
   */
  getDefaultOptions(): PDFConversionOptions {
    return { ...DEFAULT_OPTIONS };
  }

  /**
   * 生成 PDF
   */
  private async _generatePDF(
    files: Map<string, string | Uint8Array>,
    options: PDFConversionOptions
  ): Promise<Uint8Array> {
    // 检查是否有 Puppeteer
    let puppeteer: typeof import('puppeteer') | undefined;
    try {
      puppeteer = await import('puppeteer');
    } catch {
      throw new Error(
        '需要安装 puppeteer 才能生成 PDF。请运行: npm install puppeteer'
      );
    }

    // 获取 index.html 内容
    const indexHtml = files.get('index.html');
    if (!indexHtml || typeof indexHtml !== 'string') {
      throw new Error('未找到 index.html 文件');
    }

    // 启动浏览器
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      // 内联资源
      const htmlContent = this._inlineResources(indexHtml, files);
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
      });

      // 等待渲染
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 计算页面尺寸
      const pageSize = options.pageSize ?? 'A4';
      const dimensions = PAGE_SIZES[pageSize];
      const isLandscape = options.orientation === 'landscape';

      // 生成 PDF
      const pdfOptions: Parameters<typeof page.pdf>[0] = {
        printBackground: options.printBackground ?? true,
        scale: options.scale ?? 1,
        margin: options.margin,
        landscape: isLandscape,
      };

      if (dimensions) {
        pdfOptions.width = isLandscape ? dimensions.height : dimensions.width;
        pdfOptions.height = isLandscape ? dimensions.width : dimensions.height;
      } else if (options.width && options.height) {
        pdfOptions.width = options.width;
        pdfOptions.height = options.height;
      } else {
        pdfOptions.format = 'A4';
      }

      const pdf = await page.pdf(pdfOptions);

      return new Uint8Array(pdf);
    } finally {
      await browser.close();
    }
  }

  /**
   * 内联资源
   */
  private _inlineResources(
    html: string,
    files: Map<string, string | Uint8Array>
  ): string {
    let result = html;

    // 内联 theme.css
    const themeCss = files.get('theme.css');
    if (themeCss && typeof themeCss === 'string') {
      const styleTag = `<style>${themeCss}</style>`;
      result = result.replace(
        /<link[^>]*href=["'][^"']*theme\.css["'][^>]*>/gi,
        styleTag
      );
    }

    // 内联图片
    for (const [path, content] of files) {
      if (content instanceof Uint8Array && this._isImagePath(path)) {
        const base64 = this._uint8ArrayToBase64(content);
        const mimeType = this._getMimeType(path);
        const dataUrl = `data:${mimeType};base64,${base64}`;

        const filename = path.split('/').pop() ?? '';
        result = result.replace(
          new RegExp(`(src|href)=["'][^"']*${this._escapeRegex(filename)}["']`, 'gi'),
          `$1="${dataUrl}"`
        );
      }
    }

    return result;
  }

  /**
   * 判断是否为图片
   */
  private _isImagePath(path: string): boolean {
    return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(path);
  }

  /**
   * 获取 MIME 类型
   */
  private _getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    return mimeTypes[ext] ?? 'application/octet-stream';
  }

  /**
   * Uint8Array 转 Base64
   */
  private _uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]!);
    }
    return btoa(binary);
  }

  /**
   * 转义正则
   */
  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 写入文件
   */
  private async _writeToFile(data: Uint8Array, outputPath: string): Promise<void> {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs');
      await fs.promises.writeFile(outputPath, data);
    } else {
      throw new Error('文件写入需要 Node.js 环境');
    }
  }
}

/**
 * 创建插件实例
 */
export function createPlugin(): CardtoPDFPlugin {
  return new CardtoPDFPlugin();
}

/**
 * 默认插件实例
 */
export const plugin = createPlugin();
