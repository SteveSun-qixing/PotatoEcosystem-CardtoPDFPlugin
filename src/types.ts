/**
 * CardtoPDFPlugin 类型定义
 */

import type { ConversionSource, ConversionError } from '@chips/cardto-html-plugin';

/**
 * 页面大小
 */
export type PageSize = 'A4' | 'A3' | 'Letter' | 'Legal' | 'Tabloid' | 'custom';

/**
 * 页面方向
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * 页边距
 */
export interface PageMargin {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

/**
 * PDF 转换选项
 */
export interface PDFConversionOptions {
  /** 页面大小 */
  pageSize?: PageSize;
  /** 自定义宽度（pageSize 为 custom 时） */
  width?: string;
  /** 自定义高度（pageSize 为 custom 时） */
  height?: string;
  /** 页面方向 */
  orientation?: PageOrientation;
  /** 页边距 */
  margin?: PageMargin;
  /** 是否包含封面 */
  includeCover?: boolean;
  /** 是否包含目录 */
  includeTOC?: boolean;
  /** 是否打印背景 */
  printBackground?: boolean;
  /** 缩放比例 */
  scale?: number;
  /** 输出文件路径 */
  outputPath?: string;
  /** 主题 ID */
  themeId?: string;
  /** 进度回调 */
  onProgress?: (progress: PDFProgressInfo) => void;
}

/**
 * 进度信息
 */
export interface PDFProgressInfo {
  taskId: string;
  status: 'converting-html' | 'generating-pdf' | 'completed' | 'failed';
  percent: number;
  currentStep?: string;
}

/**
 * PDF 转换结果
 */
export interface PDFConversionResult {
  success: boolean;
  taskId: string;
  outputPath?: string;
  data?: Uint8Array;
  pageCount?: number;
  error?: ConversionError;
  duration?: number;
}

/**
 * 转换器插件接口
 */
export interface PDFConverterPlugin {
  id: string;
  name: string;
  version: string;
  sourceTypes: string[];
  targetType: string;
  description?: string;

  convert(source: ConversionSource, options?: PDFConversionOptions): Promise<PDFConversionResult>;
  getDefaultOptions(): PDFConversionOptions;
}
