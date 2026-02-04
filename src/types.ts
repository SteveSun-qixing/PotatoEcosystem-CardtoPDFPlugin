/**
 * CardtoPDFPlugin 类型定义
 *
 * 定义卡片转PDF插件使用的所有数据结构和接口类型
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
} from '@chips/cardto-html-plugin';

// 重新导出
export type { ConversionSource, ConversionError, ErrorCode };

// ============================================================================
// PDF 转换选项
// ============================================================================

/**
 * 页面格式
 */
export type PageFormat = 'a4' | 'a5' | 'a3' | 'letter' | 'legal' | 'tabloid';

/**
 * 页面方向
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * 页边距
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

/**
 * PDF 转换选项
 */
export interface PDFConversionOptions {
  /**
   * 页面格式
   * @defaultValue 'a4'
   */
  format?: PageFormat;

  /**
   * 页面方向
   * @defaultValue 'portrait'
   */
  orientation?: PageOrientation;

  /**
   * 页边距
   * @defaultValue { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
   */
  margin?: PageMargin;

  /**
   * 是否打印背景图形
   * @defaultValue true
   */
  printBackground?: boolean;

  /**
   * 是否包含页眉
   * @defaultValue false
   */
  displayHeaderFooter?: boolean;

  /**
   * 页眉 HTML 模板
   */
  headerTemplate?: string;

  /**
   * 页脚 HTML 模板
   */
  footerTemplate?: string;

  /**
   * 是否生成 PDF 书签（基于标题）
   * @defaultValue false
   */
  generateOutline?: boolean;

  /**
   * 输出文件路径
   * @remarks 指定后将 PDF 写入文件系统。不指定则返回二进制数据。
   */
  outputPath?: string;

  /**
   * 主题 ID
   * @remarks 覆盖卡片默认主题
   */
  themeId?: string;

  /**
   * 进度回调函数
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
  | 'converting-html' // 正在转换 HTML
  | 'rendering'       // 正在渲染页面
  | 'generating'      // 正在生成 PDF
  | 'completed'       // 转换完成
  | 'failed';         // 转换失败

/**
 * 进度信息
 */
export interface PDFProgressInfo {
  /** 任务ID */
  taskId: string;
  /** 当前状态 */
  status: PDFConversionStatus;
  /** 完成百分比 (0-100) */
  percent: number;
  /** 当前步骤描述 */
  currentStep?: string;
}

// ============================================================================
// 转换结果
// ============================================================================

/**
 * PDF 转换结果
 */
export interface PDFConversionResult {
  /** 是否成功 */
  success: boolean;
  /** 任务ID */
  taskId: string;
  /** 输出文件路径 */
  outputPath?: string;
  /** PDF 数据 */
  data?: Uint8Array;
  /** 页数 */
  pageCount?: number;
  /** 文件大小（字节） */
  fileSize?: number;
  /** 错误信息 */
  error?: ConversionError;
  /** 转换耗时（毫秒） */
  duration?: number;
}

// ============================================================================
// 插件接口
// ============================================================================

/**
 * PDF 转换器插件接口
 */
export interface PDFConverterPlugin {
  /** 插件ID */
  readonly id: string;
  /** 插件名称 */
  readonly name: string;
  /** 插件版本 */
  readonly version: string;
  /** 支持的源类型 */
  readonly sourceTypes: string[];
  /** 目标类型 */
  readonly targetType: string;
  /** 插件描述 */
  readonly description?: string;

  /**
   * 执行转换
   */
  convert(
    source: ConversionSource,
    options?: PDFConversionOptions
  ): Promise<PDFConversionResult>;

  /**
   * 获取默认选项
   */
  getDefaultOptions(): PDFConversionOptions;

  /**
   * 验证选项
   */
  validateOptions(options: PDFConversionOptions): PDFValidationResult;
}

/**
 * 选项验证结果
 */
export interface PDFValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors?: string[];
  /** 警告列表 */
  warnings?: string[];
}

// ============================================================================
// 错误码
// ============================================================================

/**
 * PDF 转换专用错误码
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
  /** 无效的页面格式 */
  INVALID_FORMAT: 'CONV-PDF-006',
  /** 无效的页边距 */
  INVALID_MARGIN: 'CONV-PDF-007',
} as const;

/**
 * PDF 转换错误码类型
 */
export type PDFErrorCodeType = (typeof PDFErrorCode)[keyof typeof PDFErrorCode];
