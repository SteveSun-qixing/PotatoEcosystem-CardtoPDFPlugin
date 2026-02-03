/**
 * CardtoPDFPlugin 类型定义
 *
 * 定义卡片转 PDF 插件使用的所有数据结构和接口类型
 *
 * @packageDocumentation
 */

// ============================================================================
// 从 CardtoHTMLPlugin 导入共享类型
// ============================================================================

import type {
  ConversionSource,
  ConversionError,
  ErrorCode,
  CardMetadata,
} from '@chips/cardto-html-plugin';

// 重新导出以便使用方导入
export type { ConversionSource, ConversionError, ErrorCode, CardMetadata };

// ============================================================================
// 页面设置类型
// ============================================================================

/**
 * 页面大小预设
 *
 * @remarks
 * - A4: 210mm × 297mm（国际标准，办公文档常用）
 * - A3: 297mm × 420mm（海报、图表）
 * - Letter: 8.5in × 11in（北美标准）
 * - Legal: 8.5in × 14in（北美法律文档）
 * - Tabloid: 11in × 17in（报纸、大幅面）
 * - custom: 自定义尺寸
 */
export type PageSize = 'A4' | 'A3' | 'Letter' | 'Legal' | 'Tabloid' | 'custom';

/**
 * 页面方向
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * 页边距配置
 *
 * @remarks
 * 支持 CSS 长度单位：mm, cm, in, px, pt
 *
 * @example
 * ```typescript
 * const margin: PageMargin = {
 *   top: '20mm',
 *   right: '15mm',
 *   bottom: '20mm',
 *   left: '15mm'
 * };
 * ```
 */
export interface PageMargin {
  /** 上边距 */
  top?: string;
  /** 右边距 */
  right?: string;
  /** 下边距 */
  bottom?: string;
  /** 左边距 */
  left?: string;
}

// ============================================================================
// 封面和目录配置
// ============================================================================

/**
 * 封面配置
 *
 * @remarks
 * 配置 PDF 封面页的显示内容和样式
 */
export interface CoverConfig {
  /**
   * 是否启用封面
   * @defaultValue true
   */
  enabled?: boolean;

  /**
   * 自定义标题
   *
   * @remarks
   * 不指定则使用卡片名称
   */
  title?: string;

  /**
   * 自定义副标题
   */
  subtitle?: string;

  /**
   * 是否显示作者信息
   * @defaultValue true
   */
  showAuthor?: boolean;

  /**
   * 是否显示创建日期
   * @defaultValue true
   */
  showDate?: boolean;

  /**
   * 是否显示版本号
   * @defaultValue false
   */
  showVersion?: boolean;

  /**
   * 自定义封面 HTML 模板
   *
   * @remarks
   * 使用占位符：{{title}}, {{subtitle}}, {{author}}, {{date}}, {{version}}
   */
  customTemplate?: string;
}

/**
 * 目录配置
 *
 * @remarks
 * 配置 PDF 目录页的生成方式
 */
export interface TOCConfig {
  /**
   * 是否启用目录
   * @defaultValue false
   */
  enabled?: boolean;

  /**
   * 目录标题
   * @defaultValue '目录'
   */
  title?: string;

  /**
   * 最大层级深度
   * @defaultValue 3
   */
  maxDepth?: number;

  /**
   * 是否显示页码
   * @defaultValue true
   */
  showPageNumbers?: boolean;
}

// ============================================================================
// 转换选项
// ============================================================================

/**
 * PDF 转换选项
 *
 * @remarks
 * 所有选项都是可选的，未指定的选项将使用默认值
 *
 * @example
 * ```typescript
 * const options: PDFConversionOptions = {
 *   pageSize: 'A4',
 *   orientation: 'portrait',
 *   margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
 *   includeCover: true,
 *   includeTableOfContents: false,
 * };
 * ```
 */
export interface PDFConversionOptions {
  /**
   * 页面大小
   * @defaultValue 'A4'
   */
  pageSize?: PageSize;

  /**
   * 自定义宽度
   *
   * @remarks
   * 仅当 pageSize 为 'custom' 时有效，支持 CSS 长度单位
   */
  width?: string;

  /**
   * 自定义高度
   *
   * @remarks
   * 仅当 pageSize 为 'custom' 时有效，支持 CSS 长度单位
   */
  height?: string;

  /**
   * 页面方向
   * @defaultValue 'portrait'
   */
  orientation?: PageOrientation;

  /**
   * 页边距
   * @defaultValue { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
   */
  margin?: PageMargin;

  /**
   * 是否包含封面
   * @defaultValue true
   */
  includeCover?: boolean;

  /**
   * 封面配置
   */
  coverConfig?: CoverConfig;

  /**
   * 是否包含目录
   * @defaultValue false
   */
  includeTableOfContents?: boolean;

  /**
   * 目录配置
   */
  tocConfig?: TOCConfig;

  /**
   * 是否打印背景
   *
   * @remarks
   * 控制是否打印背景颜色和背景图片
   *
   * @defaultValue true
   */
  printBackground?: boolean;

  /**
   * 页面缩放比例
   *
   * @remarks
   * 控制内容的整体缩放，1 表示原始大小
   *
   * @defaultValue 1
   */
  scale?: number;

  /**
   * 输出文件路径
   *
   * @remarks
   * 指定后将 PDF 写入文件系统。不指定则返回 Uint8Array 数据。
   * 仅在 Node.js 环境中有效。
   */
  outputPath?: string;

  /**
   * 主题 ID
   *
   * @remarks
   * 覆盖卡片默认主题，传递给 CardtoHTMLPlugin 使用
   */
  themeId?: string;

  /**
   * 页面加载等待时间（毫秒）
   *
   * @remarks
   * 等待动态内容加载完成
   *
   * @defaultValue 1000
   */
  waitTime?: number;

  /**
   * 进度回调函数
   *
   * @param progress - 进度信息对象
   */
  onProgress?: (progress: PDFProgressInfo) => void;
}

// ============================================================================
// 进度信息
// ============================================================================

/**
 * 转换进度状态
 */
export type PDFConversionStatus =
  | 'converting-html'  // 正在转换 HTML
  | 'generating-cover' // 正在生成封面
  | 'generating-toc'   // 正在生成目录
  | 'generating-pdf'   // 正在生成 PDF
  | 'completed'        // 转换完成
  | 'failed';          // 转换失败

/**
 * 进度信息
 *
 * @remarks
 * 通过 onProgress 回调实时获取转换进度
 */
export interface PDFProgressInfo {
  /**
   * 任务唯一标识符
   */
  taskId: string;

  /**
   * 当前状态
   */
  status: PDFConversionStatus;

  /**
   * 完成百分比 (0-100)
   */
  percent: number;

  /**
   * 当前步骤描述
   */
  currentStep?: string;
}

// ============================================================================
// 转换结果
// ============================================================================

/**
 * PDF 转换结果
 *
 * @remarks
 * 无论转换成功或失败，都会返回此结构。
 * 通过 success 字段判断是否成功。
 *
 * @example
 * ```typescript
 * const result = await plugin.convert(source, options);
 * if (result.success) {
 *   console.log(`转换成功，共 ${result.pageCount} 页`);
 *   if (result.data) {
 *     // 处理 PDF 数据
 *   }
 * } else {
 *   console.error(`错误 ${result.error?.code}: ${result.error?.message}`);
 * }
 * ```
 */
export interface PDFConversionResult {
  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 任务唯一标识符
   */
  taskId: string;

  /**
   * 输出文件路径
   *
   * @remarks
   * 仅当指定了 outputPath 选项时返回
   */
  outputPath?: string;

  /**
   * PDF 数据
   *
   * @remarks
   * 未指定 outputPath 时返回 PDF 的二进制数据
   */
  data?: Uint8Array;

  /**
   * 页面数量
   */
  pageCount?: number;

  /**
   * 错误信息
   *
   * @remarks
   * 仅当 success 为 false 时存在
   */
  error?: ConversionError;

  /**
   * 转换耗时（毫秒）
   */
  duration?: number;
}

// ============================================================================
// 插件接口
// ============================================================================

/**
 * PDF 转换器插件接口
 *
 * @remarks
 * 定义 PDF 转换插件必须实现的方法和属性
 */
export interface PDFConverterPlugin {
  /**
   * 插件唯一标识符
   */
  readonly id: string;

  /**
   * 插件显示名称
   */
  readonly name: string;

  /**
   * 插件版本号
   */
  readonly version: string;

  /**
   * 支持的源文件类型列表
   */
  readonly sourceTypes: string[];

  /**
   * 目标文件类型
   */
  readonly targetType: string;

  /**
   * 插件描述
   */
  readonly description?: string;

  /**
   * 执行转换
   *
   * @param source - 转换源（文件路径或二进制数据）
   * @param options - 转换选项
   * @returns 转换结果
   */
  convert(
    source: ConversionSource,
    options?: PDFConversionOptions
  ): Promise<PDFConversionResult>;

  /**
   * 获取默认选项
   *
   * @returns 默认的转换选项
   */
  getDefaultOptions(): PDFConversionOptions;

  /**
   * 验证转换选项
   *
   * @param options - 待验证的选项
   * @returns 验证结果
   */
  validateOptions(options: PDFConversionOptions): PDFValidationResult;
}

/**
 * 选项验证结果
 */
export interface PDFValidationResult {
  /**
   * 是否有效
   */
  valid: boolean;

  /**
   * 错误列表
   */
  errors?: string[];

  /**
   * 警告列表
   */
  warnings?: string[];
}

// ============================================================================
// 错误码扩展
// ============================================================================

/**
 * PDF 转换专用错误码
 *
 * @remarks
 * 扩展 CardtoHTMLPlugin 的错误码
 */
export const PDFErrorCode = {
  /** Puppeteer 未安装 */
  PUPPETEER_NOT_INSTALLED: 'CONV-PDF-001',
  /** 浏览器启动失败 */
  BROWSER_LAUNCH_FAILED: 'CONV-PDF-002',
  /** 页面加载超时 */
  PAGE_LOAD_TIMEOUT: 'CONV-PDF-003',
  /** PDF 生成失败 */
  PDF_GENERATION_FAILED: 'CONV-PDF-004',
  /** 文件写入失败 */
  FILE_WRITE_FAILED: 'CONV-PDF-005',
  /** 无效的页面大小 */
  INVALID_PAGE_SIZE: 'CONV-PDF-006',
  /** 无效的边距参数 */
  INVALID_MARGIN: 'CONV-PDF-007',
  /** 封面生成失败 */
  COVER_GENERATION_FAILED: 'CONV-PDF-008',
  /** 目录生成失败 */
  TOC_GENERATION_FAILED: 'CONV-PDF-009',
} as const;

/**
 * PDF 转换错误码类型
 */
export type PDFErrorCodeType = (typeof PDFErrorCode)[keyof typeof PDFErrorCode];

// ============================================================================
// 内部类型
// ============================================================================

/**
 * 页面尺寸定义
 * @internal
 */
export interface PageDimensions {
  width: string;
  height: string;
}
