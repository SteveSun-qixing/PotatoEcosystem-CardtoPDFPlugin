/**
 * CardtoPDFPlugin 主类
 *
 * 将薯片卡片文件（.card）转换为 PDF 文档。
 * 采用两阶段转换架构：先使用 CardtoHTMLPlugin 生成 HTML，
 * 再使用 Puppeteer 无头浏览器生成 PDF。
 *
 * @packageDocumentation
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ConversionSource,
  ConversionAppearanceProfile,
} from '@chips/cardto-html-plugin';
import {
  CardtoHTMLPlugin,
  ErrorCode,
  resolveConversionAppearance,
} from '@chips/cardto-html-plugin';
import type {
  PageFormat,
  PageOrientation,
  PDFConversionOptions,
  PDFConversionResult,
  PDFConverterPlugin,
  PDFConversionStatus,
  PDFValidationResult,
} from './types';
import { PDFErrorCode } from './types';

// ============================================================================
// 插件元数据
// ============================================================================

/**
 * 插件元数据
 * @internal
 */
const PLUGIN_METADATA = {
  id: 'cardto-pdf-plugin',
  name: '卡片转 PDF 插件',
  version: '0.1.0',
  sourceTypes: ['.card', 'card'],
  targetType: 'pdf',
  description: '将薯片卡片文件转换为 PDF 文档，支持分页、页眉页脚和自定义边距',
} as const;

/**
 * 默认转换选项
 * @internal
 */
const DEFAULT_OPTIONS: Pick<
  PDFConversionOptions,
  'displayHeaderFooter' | 'generateOutline'
> = {
  displayHeaderFooter: false,
  generateOutline: false,
};

// ============================================================================
// 主插件类
// ============================================================================

/**
 * CardtoPDFPlugin 转换器插件
 *
 * @example
 * ```typescript
 * import { CardtoPDFPlugin } from '@chips/cardto-pdf-plugin';
 *
 * const plugin = new CardtoPDFPlugin();
 *
 * // 转换为 PDF
 * const result = await plugin.convert(
 *   { type: 'path', path: '/path/to/card.card', fileType: 'card' },
 *   {
 *     format: 'a4',
 *     orientation: 'portrait',
 *     printBackground: true
 *   }
 * );
 *
 * if (result.success) {
 *   console.log(`PDF 生成成功，页数: ${result.pageCount}`);
 * }
 * ```
 */
export class CardtoPDFPlugin implements PDFConverterPlugin {
  // ========== 公开只读属性 ==========

  /** 插件 ID */
  readonly id = PLUGIN_METADATA.id;

  /** 插件名称 */
  readonly name = PLUGIN_METADATA.name;

  /** 插件版本 */
  readonly version = PLUGIN_METADATA.version;

  /** 支持的源类型 */
  readonly sourceTypes = [...PLUGIN_METADATA.sourceTypes];

  /** 目标类型 */
  readonly targetType = PLUGIN_METADATA.targetType;

  /** 插件描述 */
  readonly description = PLUGIN_METADATA.description;

  // ========== 私有属性 ==========

  /** CardtoHTMLPlugin 实例 */
  private readonly _htmlPlugin: CardtoHTMLPlugin;

  // ========== 构造函数 ==========

  /**
   * 创建 CardtoPDFPlugin 实例
   */
  constructor() {
    this._htmlPlugin = new CardtoHTMLPlugin();
  }

  // ========== 公开方法 ==========

  /**
   * 执行卡片到 PDF 的转换
   *
   * @param source - 转换源
   * @param options - 转换选项
   * @returns 转换结果
   */
  async convert(
    source: ConversionSource,
    options?: PDFConversionOptions
  ): Promise<PDFConversionResult> {
    const taskId = uuidv4();
    const mergedOptions = this._mergeOptions(options);
    const startTime = Date.now();

    // 进度报告辅助函数
    const reportProgress = (
      status: PDFConversionStatus,
      percent: number,
      step?: string
    ): void => {
      if (mergedOptions.onProgress) {
        mergedOptions.onProgress({
          taskId,
          status,
          percent,
          currentStep: step,
        });
      }
    };

    try {
      // 验证选项
      const validation = this.validateOptions(mergedOptions);
      if (!validation.valid) {
        return this._createErrorResult(
          taskId,
          PDFErrorCode.INVALID_FORMAT,
          validation.errors?.join('; ') ?? '选项验证失败',
          startTime
        );
      }

      // 阶段 1: HTML 转换
      reportProgress('converting-html', 0, '正在解析卡片并生成 HTML');
      const appearance = resolveConversionAppearance({
        profileId: mergedOptions.appearanceProfileId,
        overrides: mergedOptions.appearanceOverrides,
      });

      const htmlResult = await this._htmlPlugin.convert(source, {
        themeId: mergedOptions.themeId,
        includeAssets: true,
        appearanceProfileId: appearance.id,
        appearanceOverrides: mergedOptions.appearanceOverrides,
      });

      if (!htmlResult.success || !htmlResult.data) {
        reportProgress('failed', 0, 'HTML 转换失败');
        return {
          success: false,
          taskId,
          error: htmlResult.error ?? {
            code: ErrorCode.RENDER_FAILED,
            message: 'HTML 转换失败',
          },
          duration: Date.now() - startTime,
        };
      }

      reportProgress('rendering', 30, 'HTML 生成完成，正在启动浏览器');

      // 阶段 2: 渲染为 PDF
      reportProgress('rendering', 40, '正在渲染页面');

      const { pdfData, pageCount } = await this._renderHTMLToPDF(
        htmlResult.data.files,
        mergedOptions,
        options,
        appearance
      );

      reportProgress('generating', 80, '正在生成 PDF');

      // 阶段 3: 输出处理
      if (mergedOptions.outputPath) {
        await this._writeToFile(pdfData, mergedOptions.outputPath);
        reportProgress('completed', 100, 'PDF 已保存到文件');
      } else {
        reportProgress('completed', 100, '转换完成');
      }

      const duration = Date.now() - startTime;
      const fileSize = pdfData.byteLength;

      return {
        success: true,
        taskId,
        outputPath: mergedOptions.outputPath,
        data: mergedOptions.outputPath ? undefined : pdfData,
        pageCount,
        fileSize,
        duration,
      };
    } catch (error) {
      reportProgress('failed', 0, '转换过程发生错误');

      return this._createErrorResult(
        taskId,
        PDFErrorCode.PDF_GENERATION_FAILED,
        error instanceof Error ? error.message : 'PDF 生成过程发生未知错误',
        startTime,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取默认选项
   */
  getDefaultOptions(): PDFConversionOptions {
    const appearance = resolveConversionAppearance();
    return {
      format: appearance.pdf.pageFormat,
      orientation: appearance.pdf.orientation,
      margin: { ...appearance.pdf.margin },
      printBackground: appearance.pdf.printBackground,
      ...DEFAULT_OPTIONS,
    };
  }

  /**
   * 验证转换选项
   */
  validateOptions(options: PDFConversionOptions): PDFValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证页面格式
    const validFormats: PageFormat[] = ['a4', 'a5', 'a3', 'letter', 'legal', 'tabloid'];
    if (options.format && !validFormats.includes(options.format)) {
      errors.push(`不支持的页面格式: ${options.format}，支持: ${validFormats.join(', ')}`);
    }

    // 验证页面方向
    const validOrientations: PageOrientation[] = ['portrait', 'landscape'];
    if (options.orientation && !validOrientations.includes(options.orientation)) {
      errors.push(`不支持的页面方向: ${options.orientation}，支持: ${validOrientations.join(', ')}`);
    }

    // 验证页边距
    if (options.margin) {
      const marginRegex = /^\d+(\.\d+)?(mm|cm|in|px)?$/;
      for (const [side, value] of Object.entries(options.margin)) {
        if (value && !marginRegex.test(value)) {
          errors.push(`无效的页边距格式 (${side}): ${value}，示例: '15mm', '1in', '20px'`);
        }
      }
    }

    // 页眉页脚警告
    if (options.displayHeaderFooter) {
      if (!options.headerTemplate && !options.footerTemplate) {
        warnings.push('启用了页眉页脚但未提供模板，将使用默认模板');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ========== 私有方法 ==========

  /**
   * 合并用户选项与默认选项
   * @internal
   */
  private _mergeOptions(options?: PDFConversionOptions): PDFConversionOptions {
    return {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * 创建错误结果
   * @internal
   */
  private _createErrorResult(
    taskId: string,
    code: string,
    message: string,
    startTime: number,
    cause?: Error
  ): PDFConversionResult {
    return {
      success: false,
      taskId,
      error: {
        code: code as never,
        message,
        cause,
      },
      duration: Date.now() - startTime,
    };
  }

  /**
   * 使用 Puppeteer 渲染 HTML 为 PDF
   *
   * @param files - HTML 文件映射
   * @param options - 转换选项
   * @returns PDF 数据和页数
   * @internal
   */
  private async _renderHTMLToPDF(
    files: Map<string, string | Uint8Array>,
    mergedOptions: PDFConversionOptions,
    rawOptions: PDFConversionOptions | undefined,
    appearance: ConversionAppearanceProfile
  ): Promise<{ pdfData: Uint8Array; pageCount: number }> {
    // 动态导入 Puppeteer
    let puppeteer: typeof import('puppeteer') | undefined;
    try {
      puppeteer = await import('puppeteer');
    } catch {
      throw new Error(
        '需要安装 puppeteer 才能生成 PDF。请运行: npm install puppeteer'
      );
    }

    // 获取 index.html
    const indexHtml = files.get('index.html');
    if (!indexHtml || typeof indexHtml !== 'string') {
      throw new Error('未找到 index.html 文件');
    }

    // 启动浏览器
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();
      const viewportWidth = appearance.pdf.viewportWidthPx;
      const viewportHeight = appearance.pdf.viewportHeightPx;
      const pageFormat = (rawOptions?.format ?? appearance.pdf.pageFormat).toUpperCase() as Uppercase<PageFormat>;
      const orientation = rawOptions?.orientation ?? appearance.pdf.orientation;
      const margin = rawOptions?.margin ?? appearance.pdf.margin;
      const printBackground = rawOptions?.printBackground ?? appearance.pdf.printBackground;

      await page.setViewport({
        width: viewportWidth,
        height: viewportHeight,
      });

      // 内联资源
      const htmlContent = this._inlineResources(indexHtml, files);
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // 配置 PDF 选项
      const pdfOptions: Parameters<typeof page.pdf>[0] = {
        format: pageFormat,
        landscape: orientation === 'landscape',
        printBackground,
        margin,
        displayHeaderFooter: mergedOptions.displayHeaderFooter ?? false,
        headerTemplate: mergedOptions.headerTemplate ?? '',
        footerTemplate: mergedOptions.footerTemplate ?? '',
        preferCSSPageSize: false,
      };

      // 生成 PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      // 获取页数（简单估算）
      const pageCount = await this._estimatePageCount(pdfBuffer);

      return {
        pdfData: new Uint8Array(pdfBuffer),
        pageCount,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * 估算 PDF 页数
   * @internal
   */
  private async _estimatePageCount(pdfBuffer: Uint8Array): Promise<number> {
    try {
      // 简单的 PDF 页数估算：查找 /Type /Page 出现次数
      const pdfString = Buffer.from(pdfBuffer).toString('binary');
      const matches = pdfString.match(/\/Type\s*\/Page[^s]/g);
      return matches ? matches.length : 1;
    } catch {
      return 1; // 默认返回 1 页
    }
  }

  /**
   * 将外部资源内联到 HTML
   * @internal
   */
  private _inlineResources(
    html: string,
    files: Map<string, string | Uint8Array>
  ): string {
    let result = html;

    // 内联 theme.css
    const themeCss = files.get('theme.css');
    if (themeCss && typeof themeCss === 'string') {
      const styleTag = `<style type="text/css">\n${themeCss}\n</style>`;
      result = result.replace(
        /<link[^>]*href=["'][^"']*theme\.css["'][^>]*>/gi,
        styleTag
      );
    }

    // 内联其他 CSS 文件
    for (const [filePath, content] of files) {
      if (
        typeof content === 'string' &&
        filePath.endsWith('.css') &&
        filePath !== 'theme.css'
      ) {
        const filename = filePath.split('/').pop() ?? '';
        const styleTag = `<style type="text/css">\n${content}\n</style>`;
        result = result.replace(
          new RegExp(
            `<link[^>]*href=["'][^"']*${this._escapeRegex(filename)}["'][^>]*>`,
            'gi'
          ),
          styleTag
        );
      }
    }

    // 内联图片资源为 Base64
    for (const [filePath, content] of files) {
      if (content instanceof Uint8Array && this._isImagePath(filePath)) {
        const base64 = this._uint8ArrayToBase64(content);
        const mimeType = this._getMimeType(filePath);
        const dataUrl = `data:${mimeType};base64,${base64}`;
        const filename = filePath.split('/').pop() ?? '';

        // 替换 HTML 属性中的资源引用
        result = result.replace(
          new RegExp(
            `(src|href)=["']([^"']*${this._escapeRegex(filename)})["']`,
            'gi'
          ),
          `$1="${dataUrl}"`
        );

        // 替换脚本/JSON 中的路径引用（适配直出 DOM + CHIPS_CARD_CONFIG）
        const normalizedPaths = [filePath, `./${filePath}`, filename];
        for (const p of normalizedPaths) {
          result = result.replace(
            new RegExp(
              `"(?:${this._escapeRegex(p)})"`,
              'g'
            ),
            `"${dataUrl}"`
          );
        }
      }
    }

    return result;
  }

  /**
   * 判断路径是否为图片文件
   * @internal
   */
  private _isImagePath(path: string): boolean {
    return /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i.test(path);
  }

  /**
   * 根据文件扩展名获取 MIME 类型
   * @internal
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
      ico: 'image/x-icon',
      bmp: 'image/bmp',
    };
    return mimeTypes[ext] ?? 'application/octet-stream';
  }

  /**
   * Uint8Array 转 Base64 字符串
   * @internal
   */
  private _uint8ArrayToBase64(uint8Array: Uint8Array): string {
    // Node.js 环境使用 Buffer
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(uint8Array).toString('base64');
    }

    // 浏览器环境使用 btoa
    let binary = '';
    const len = uint8Array.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]!);
    }
    return btoa(binary);
  }

  /**
   * 转义正则表达式特殊字符
   * @internal
   */
  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 将数据写入文件
   * @internal
   */
  private async _writeToFile(data: Uint8Array, outputPath: string): Promise<void> {
    // 检查 Node.js 环境
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs');
      const path = await import('path');

      // 确保目录存在
      const dir = path.dirname(outputPath);
      await fs.promises.mkdir(dir, { recursive: true });

      // 写入文件
      await fs.promises.writeFile(outputPath, data);
    } else {
      throw new Error('文件写入需要 Node.js 环境');
    }
  }
}

// ============================================================================
// 工厂函数和默认实例
// ============================================================================

/**
 * 创建 CardtoPDFPlugin 实例
 */
export function createPlugin(): CardtoPDFPlugin {
  return new CardtoPDFPlugin();
}

/**
 * 默认插件实例
 */
export const plugin = createPlugin();
