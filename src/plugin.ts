/**
 * CardtoPDFPlugin 主类
 *
 * 将薯片卡片文件（.card）转换为高质量 PDF 文档。
 * 采用两阶段转换架构：先使用 CardtoHTMLPlugin 生成 HTML，
 * 再使用 Puppeteer 无头浏览器的打印功能输出 PDF。
 *
 * @packageDocumentation
 */

import { v4 as uuidv4 } from 'uuid';
import type { ConversionSource, CardMetadata } from '@chips/cardto-html-plugin';
import { CardtoHTMLPlugin } from '@chips/cardto-html-plugin';
import type {
  PageSize,
  PageDimensions,
  PDFConversionOptions,
  PDFConversionResult,
  PDFConverterPlugin,
  PDFProgressInfo,
  PDFConversionStatus,
  PDFValidationResult,
  CoverConfig,
  TOCConfig,
} from './types';
import { PDFErrorCode } from './types';

// ============================================================================
// 插件元数据常量
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
  description: '将薯片卡片文件转换为高质量 PDF 文档，支持封面、目录和多种页面设置',
} as const;

/**
 * 默认转换选项
 * @internal
 */
const DEFAULT_OPTIONS: Required<
  Omit<
    PDFConversionOptions,
    'outputPath' | 'themeId' | 'onProgress' | 'width' | 'height' | 'coverConfig' | 'tocConfig'
  >
> = {
  pageSize: 'A4',
  orientation: 'portrait',
  margin: {
    top: '20mm',
    right: '20mm',
    bottom: '20mm',
    left: '20mm',
  },
  includeCover: true,
  includeTableOfContents: false,
  printBackground: true,
  scale: 1,
  waitTime: 1000,
};

/**
 * 页面尺寸映射表
 * @internal
 */
const PAGE_SIZE_MAP: Record<Exclude<PageSize, 'custom'>, PageDimensions> = {
  A4: { width: '210mm', height: '297mm' },
  A3: { width: '297mm', height: '420mm' },
  Letter: { width: '8.5in', height: '11in' },
  Legal: { width: '8.5in', height: '14in' },
  Tabloid: { width: '11in', height: '17in' },
};

/**
 * 默认封面配置
 * @internal
 */
const DEFAULT_COVER_CONFIG: Required<Omit<CoverConfig, 'customTemplate' | 'title' | 'subtitle'>> = {
  enabled: true,
  showAuthor: true,
  showDate: true,
  showVersion: false,
};

/**
 * 默认目录配置
 * @internal
 */
const DEFAULT_TOC_CONFIG: Required<TOCConfig> = {
  enabled: false,
  title: '目录',
  maxDepth: 3,
  showPageNumbers: true,
};

// ============================================================================
// 主插件类
// ============================================================================

/**
 * CardtoPDFPlugin 转换器插件
 *
 * @remarks
 * 此插件将卡片文件转换为 PDF 文档。内部依赖 CardtoHTMLPlugin
 * 先将卡片转换为 HTML，然后使用 Puppeteer 的打印功能生成 PDF。
 * 支持封面页、目录页和多种页面设置。
 *
 * @example
 * ```typescript
 * import { CardtoPDFPlugin } from '@chips/cardto-pdf-plugin';
 *
 * const plugin = new CardtoPDFPlugin();
 *
 * // 基本转换
 * const result = await plugin.convert(
 *   { type: 'path', path: '/path/to/card.card', fileType: 'card' },
 *   { pageSize: 'A4', orientation: 'portrait' }
 * );
 *
 * // 带封面和目录
 * const result = await plugin.convert(source, {
 *   pageSize: 'A4',
 *   includeCover: true,
 *   includeTableOfContents: true,
 *   outputPath: '/path/to/output.pdf'
 * });
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
  readonly sourceTypes = PLUGIN_METADATA.sourceTypes;

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
   * @param source - 转换源，支持文件路径或二进制数据
   * @param options - 转换选项
   * @returns 转换结果，包含 PDF 数据或输出路径
   *
   * @remarks
   * 转换过程分为以下阶段：
   * 1. HTML 生成：调用 CardtoHTMLPlugin 将卡片转换为 HTML
   * 2. 封面生成：可选，生成包含元数据的封面页
   * 3. 目录生成：可选，生成内容目录页
   * 4. PDF 输出：使用 Puppeteer 打印功能生成 PDF
   *
   * @example
   * ```typescript
   * // A4 纵向，带封面
   * const result = await plugin.convert(source, {
   *   pageSize: 'A4',
   *   orientation: 'portrait',
   *   includeCover: true
   * });
   *
   * // 横向 Letter，自定义边距
   * const result = await plugin.convert(source, {
   *   pageSize: 'Letter',
   *   orientation: 'landscape',
   *   margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
   * });
   * ```
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
          PDFErrorCode.INVALID_PAGE_SIZE,
          validation.errors?.join('; ') ?? '选项验证失败',
          startTime
        );
      }

      // 阶段 1: HTML 转换
      reportProgress('converting-html', 0, '正在解析卡片并生成 HTML');

      const htmlResult = await this._htmlPlugin.convert(source, {
        themeId: mergedOptions.themeId,
        includeAssets: true,
      });

      if (!htmlResult.success || !htmlResult.data) {
        reportProgress('failed', 0, 'HTML 转换失败');
        return {
          success: false,
          taskId,
          error: htmlResult.error ?? {
            code: 'CONV-HTML-002' as const,
            message: 'HTML 转换失败，未能获取有效数据',
          },
          duration: Date.now() - startTime,
        };
      }

      reportProgress('generating-pdf', 30, 'HTML 生成完成，准备生成 PDF');

      // 提取元数据（用于封面和目录）
      const metadata = this._extractMetadata(htmlResult.data.files);

      // 阶段 2: 生成 PDF
      const { pdfData, pageCount } = await this._generatePDF(
        htmlResult.data.files,
        mergedOptions,
        metadata,
        reportProgress
      );

      // 阶段 3: 输出处理
      if (mergedOptions.outputPath) {
        await this._writeToFile(pdfData, mergedOptions.outputPath);
        reportProgress('completed', 100, 'PDF 已保存到文件');
      } else {
        reportProgress('completed', 100, '转换完成');
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        taskId,
        outputPath: mergedOptions.outputPath,
        data: mergedOptions.outputPath ? undefined : pdfData,
        pageCount,
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
   *
   * @returns 默认的转换选项副本
   */
  getDefaultOptions(): PDFConversionOptions {
    return { ...DEFAULT_OPTIONS };
  }

  /**
   * 验证转换选项
   *
   * @param options - 待验证的选项
   * @returns 验证结果
   */
  validateOptions(options: PDFConversionOptions): PDFValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证页面大小
    if (options.pageSize && options.pageSize !== 'custom') {
      if (!PAGE_SIZE_MAP[options.pageSize]) {
        errors.push(
          `不支持的页面大小: ${options.pageSize}，支持: A4, A3, Letter, Legal, Tabloid, custom`
        );
      }
    }

    // 验证自定义尺寸
    if (options.pageSize === 'custom') {
      if (!options.width || !options.height) {
        errors.push('使用 custom 页面大小时必须指定 width 和 height');
      }
    }

    // 验证方向
    if (
      options.orientation &&
      !['portrait', 'landscape'].includes(options.orientation)
    ) {
      errors.push(
        `不支持的页面方向: ${options.orientation}，支持: portrait, landscape`
      );
    }

    // 验证缩放
    if (options.scale !== undefined) {
      if (options.scale <= 0 || options.scale > 2) {
        errors.push(`缩放比例必须在 0-2 之间，当前值: ${options.scale}`);
      }
    }

    // 验证边距格式
    if (options.margin) {
      const marginKeys = ['top', 'right', 'bottom', 'left'] as const;
      for (const key of marginKeys) {
        const value = options.margin[key];
        if (value && !this._isValidCSSLength(value)) {
          errors.push(`边距 ${key} 格式无效: ${value}，请使用 CSS 长度单位`);
        }
      }
    }

    // 验证等待时间
    if (options.waitTime !== undefined && options.waitTime < 0) {
      errors.push(`等待时间不能为负数，当前值: ${options.waitTime}`);
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
  private _mergeOptions(
    options?: PDFConversionOptions
  ): PDFConversionOptions {
    return {
      ...DEFAULT_OPTIONS,
      ...options,
      margin: {
        ...DEFAULT_OPTIONS.margin,
        ...options?.margin,
      },
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
   * 验证 CSS 长度值格式
   * @internal
   */
  private _isValidCSSLength(value: string): boolean {
    return /^\d+(\.\d+)?(mm|cm|in|px|pt|em|rem)$/.test(value);
  }

  /**
   * 从文件映射中提取元数据
   * @internal
   */
  private _extractMetadata(
    files: Map<string, string | Uint8Array>
  ): Partial<CardMetadata> {
    // 尝试从文件中提取元数据
    // 这里简化处理，实际可能需要解析 metadata.yaml
    const indexHtml = files.get('index.html');
    if (indexHtml && typeof indexHtml === 'string') {
      const titleMatch = indexHtml.match(/<title>([^<]*)<\/title>/i);
      return {
        name: titleMatch?.[1] ?? '未命名卡片',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        version: '1.0.0',
        chipsStandardsVersion: '1.0.0',
        id: uuidv4().substring(0, 10),
      };
    }
    return {
      name: '未命名卡片',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      version: '1.0.0',
      chipsStandardsVersion: '1.0.0',
      id: uuidv4().substring(0, 10),
    };
  }

  /**
   * 使用 Puppeteer 生成 PDF
   *
   * @param files - HTML 文件映射
   * @param options - 转换选项
   * @param metadata - 卡片元数据
   * @param reportProgress - 进度报告函数
   * @returns PDF 数据和页数
   * @internal
   */
  private async _generatePDF(
    files: Map<string, string | Uint8Array>,
    options: PDFConversionOptions,
    metadata: Partial<CardMetadata>,
    reportProgress: (
      status: PDFConversionStatus,
      percent: number,
      step?: string
    ) => void
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
      throw new Error('未找到 index.html 文件，HTML 转换可能失败');
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

      // 构建完整的 HTML 内容
      let fullHtml = this._inlineResources(indexHtml, files);

      // 生成封面
      if (options.includeCover) {
        reportProgress('generating-cover', 40, '正在生成封面');
        const coverHtml = this._generateCoverHTML(
          metadata,
          options.coverConfig ?? DEFAULT_COVER_CONFIG
        );
        fullHtml = this._insertCover(fullHtml, coverHtml);
      }

      // 生成目录
      if (options.includeTableOfContents) {
        reportProgress('generating-toc', 50, '正在生成目录');
        const tocHtml = this._generateTOCHTML(
          fullHtml,
          options.tocConfig ?? DEFAULT_TOC_CONFIG
        );
        fullHtml = this._insertTOC(fullHtml, tocHtml);
      }

      // 添加打印样式
      fullHtml = this._addPrintStyles(fullHtml, options);

      reportProgress('generating-pdf', 60, '正在渲染页面');

      // 加载 HTML
      await page.setContent(fullHtml, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // 额外等待时间
      const waitTime = options.waitTime ?? 1000;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      reportProgress('generating-pdf', 80, '正在生成 PDF');

      // 计算页面尺寸
      const pageDimensions = this._getPageDimensions(options);
      const isLandscape = options.orientation === 'landscape';

      // 配置 PDF 选项
      const pdfOptions: Parameters<typeof page.pdf>[0] = {
        printBackground: options.printBackground ?? true,
        scale: options.scale ?? 1,
        margin: options.margin,
        landscape: isLandscape,
        width: isLandscape ? pageDimensions.height : pageDimensions.width,
        height: isLandscape ? pageDimensions.width : pageDimensions.height,
      };

      // 生成 PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      // 估算页数（简化计算）
      const pageCount = await this._estimatePageCount(page);

      return {
        pdfData: new Uint8Array(pdfBuffer),
        pageCount,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * 获取页面尺寸
   * @internal
   */
  private _getPageDimensions(options: PDFConversionOptions): PageDimensions {
    const pageSize = options.pageSize ?? 'A4';

    if (pageSize === 'custom') {
      return {
        width: options.width ?? '210mm',
        height: options.height ?? '297mm',
      };
    }

    return PAGE_SIZE_MAP[pageSize];
  }

  /**
   * 生成封面 HTML
   * @internal
   */
  private _generateCoverHTML(
    metadata: Partial<CardMetadata>,
    config: CoverConfig
  ): string {
    // 如果提供了自定义模板，使用模板
    if (config.customTemplate) {
      return config.customTemplate
        .replace(/\{\{title\}\}/g, config.title ?? metadata.name ?? '未命名卡片')
        .replace(/\{\{subtitle\}\}/g, config.subtitle ?? '')
        .replace(/\{\{author\}\}/g, '薯片生态')
        .replace(
          /\{\{date\}\}/g,
          metadata.createdAt
            ? new Date(metadata.createdAt).toLocaleDateString('zh-CN')
            : new Date().toLocaleDateString('zh-CN')
        )
        .replace(/\{\{version\}\}/g, metadata.version ?? '1.0.0');
    }

    // 默认封面模板
    const title = config.title ?? metadata.name ?? '未命名卡片';
    const subtitle = config.subtitle ?? metadata.description ?? '';
    const date = metadata.createdAt
      ? new Date(metadata.createdAt).toLocaleDateString('zh-CN')
      : new Date().toLocaleDateString('zh-CN');
    const version = metadata.version ?? '1.0.0';

    let coverContent = `
      <div class="chips-pdf-cover" style="
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
        page-break-after: always;
        text-align: center;
        padding: 40mm;
        box-sizing: border-box;
      ">
        <h1 style="
          font-size: 32pt;
          font-weight: bold;
          margin-bottom: 20pt;
          color: #333;
        ">${this._escapeHtml(title)}</h1>
    `;

    if (subtitle) {
      coverContent += `
        <p style="
          font-size: 16pt;
          color: #666;
          margin-bottom: 40pt;
        ">${this._escapeHtml(subtitle)}</p>
      `;
    }

    const metaItems: string[] = [];

    if (config.showAuthor) {
      metaItems.push('薯片生态');
    }

    if (config.showDate) {
      metaItems.push(date);
    }

    if (config.showVersion) {
      metaItems.push(`v${version}`);
    }

    if (metaItems.length > 0) {
      coverContent += `
        <div style="
          font-size: 12pt;
          color: #999;
          margin-top: auto;
        ">
          ${metaItems.join(' · ')}
        </div>
      `;
    }

    coverContent += '</div>';

    return coverContent;
  }

  /**
   * 生成目录 HTML
   * @internal
   */
  private _generateTOCHTML(html: string, config: TOCConfig): string {
    // 提取标题
    const headingRegex = /<h([1-6])[^>]*>([^<]*)<\/h[1-6]>/gi;
    const headings: Array<{ level: number; text: string }> = [];
    let match;

    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1]!, 10);
      if (level <= (config.maxDepth ?? 3)) {
        headings.push({
          level,
          text: match[2]!.trim(),
        });
      }
    }

    // 生成目录 HTML
    let tocContent = `
      <div class="chips-pdf-toc" style="
        page-break-after: always;
        padding: 20mm;
      ">
        <h1 style="
          font-size: 24pt;
          font-weight: bold;
          margin-bottom: 20pt;
          text-align: center;
        ">${this._escapeHtml(config.title ?? '目录')}</h1>
        <div class="toc-entries" style="
          font-size: 12pt;
          line-height: 2;
        ">
    `;

    headings.forEach((heading, index) => {
      const indent = (heading.level - 1) * 20;
      tocContent += `
        <div style="
          padding-left: ${indent}pt;
          display: flex;
          justify-content: space-between;
        ">
          <span>${this._escapeHtml(heading.text)}</span>
          ${config.showPageNumbers ? `<span>${index + 2}</span>` : ''}
        </div>
      `;
    });

    tocContent += '</div></div>';

    return tocContent;
  }

  /**
   * 将封面插入 HTML
   * @internal
   */
  private _insertCover(html: string, coverHtml: string): string {
    // 在 body 开始后插入封面
    return html.replace(/<body[^>]*>/i, (match) => `${match}\n${coverHtml}`);
  }

  /**
   * 将目录插入 HTML
   * @internal
   */
  private _insertTOC(html: string, tocHtml: string): string {
    // 在封面后插入目录（如果有封面）
    const coverEndIndex = html.indexOf('</div>', html.indexOf('chips-pdf-cover'));
    if (coverEndIndex !== -1) {
      const insertPosition = coverEndIndex + 6;
      return (
        html.slice(0, insertPosition) + '\n' + tocHtml + html.slice(insertPosition)
      );
    }
    // 否则在 body 开始后插入
    return html.replace(/<body[^>]*>/i, (match) => `${match}\n${tocHtml}`);
  }

  /**
   * 添加打印样式
   * @internal
   */
  private _addPrintStyles(html: string, options: PDFConversionOptions): string {
    const printStyles = `
      <style type="text/css" media="print">
        @page {
          size: ${options.pageSize === 'custom' ? `${options.width} ${options.height}` : options.pageSize} ${options.orientation};
          margin: ${options.margin?.top ?? '20mm'} ${options.margin?.right ?? '20mm'} ${options.margin?.bottom ?? '20mm'} ${options.margin?.left ?? '20mm'};
        }
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .chips-pdf-cover {
          page-break-after: always;
        }
        .chips-pdf-toc {
          page-break-after: always;
        }
      </style>
    `;

    // 在 </head> 前插入打印样式
    return html.replace('</head>', `${printStyles}\n</head>`);
  }

  /**
   * 估算页数
   * @internal
   */
  private async _estimatePageCount(
    page: import('puppeteer').Page
  ): Promise<number> {
    // 获取页面高度和视口高度来估算页数
    const dimensions = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const pageHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );
      // 假设 A4 页面高度约为 1000px（在默认 DPI 下）
      return Math.ceil(pageHeight / 1000);
    });

    return Math.max(1, dimensions);
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
        result = result.replace(
          new RegExp(
            `(src|href)=["']([^"']*${this._escapeRegex(filename)})["']`,
            'gi'
          ),
          `$1="${dataUrl}"`
        );
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
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(uint8Array).toString('base64');
    }

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
   * 转义 HTML 特殊字符
   * @internal
   */
  private _escapeHtml(str: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return str.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char);
  }

  /**
   * 将数据写入文件
   * @internal
   */
  private async _writeToFile(
    data: Uint8Array,
    outputPath: string
  ): Promise<void> {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs');
      const path = await import('path');

      // 确保目录存在
      const dir = path.dirname(outputPath);
      await fs.promises.mkdir(dir, { recursive: true });

      // 写入文件
      await fs.promises.writeFile(outputPath, data);
    } else {
      throw new Error(
        '文件写入需要 Node.js 环境。在浏览器环境中，请使用返回的 data 字段。'
      );
    }
  }
}

// ============================================================================
// 工厂函数和默认实例
// ============================================================================

/**
 * 创建 CardtoPDFPlugin 实例
 *
 * @returns 新的插件实例
 *
 * @example
 * ```typescript
 * import { createPlugin } from '@chips/cardto-pdf-plugin';
 *
 * const plugin = createPlugin();
 * const result = await plugin.convert(source, { pageSize: 'A4' });
 * ```
 */
export function createPlugin(): CardtoPDFPlugin {
  return new CardtoPDFPlugin();
}

/**
 * 默认插件实例
 *
 * @remarks
 * 提供一个预创建的插件实例，适合简单使用场景
 *
 * @example
 * ```typescript
 * import { plugin } from '@chips/cardto-pdf-plugin';
 *
 * const result = await plugin.convert(source);
 * ```
 */
export const plugin = createPlugin();
