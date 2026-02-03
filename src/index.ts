/**
 * CardtoPDFPlugin - 薯片卡片转 PDF 插件
 *
 * 将薯片卡片文件（.card）转换为高质量 PDF 文档。
 * 采用两阶段转换架构：
 * 1. 依赖 CardtoHTMLPlugin 将卡片转换为 HTML
 * 2. 使用 Puppeteer 无头浏览器的打印功能输出 PDF
 *
 * @packageDocumentation
 *
 * @remarks
 * ## 功能特性
 * - 支持多种页面大小（A4、A3、Letter、Legal、Tabloid、自定义）
 * - 支持横向和纵向页面方向
 * - 支持自定义页边距
 * - 支持封面页生成
 * - 支持目录页生成
 * - 支持打印背景和缩放
 * - 支持进度回调
 *
 * ## 依赖要求
 * - @chips/cardto-html-plugin: 用于 HTML 转换
 * - puppeteer: 用于 PDF 生成（可选依赖）
 *
 * ## 基本使用
 *
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
 * if (result.success) {
 *   console.log(`转换成功，共 ${result.pageCount} 页`);
 * }
 * ```
 *
 * ## 带封面和目录
 *
 * ```typescript
 * const result = await plugin.convert(source, {
 *   pageSize: 'A4',
 *   includeCover: true,
 *   includeTableOfContents: true,
 *   coverConfig: {
 *     title: '我的卡片',
 *     showDate: true
 *   },
 *   outputPath: '/path/to/output.pdf'
 * });
 * ```
 */

// ============================================================================
// 导出插件主类和工厂函数
// ============================================================================

export { CardtoPDFPlugin, createPlugin, plugin } from './plugin';

// ============================================================================
// 导出类型定义
// ============================================================================

export type {
  // 页面设置
  PageSize,
  PageOrientation,
  PageMargin,
  PageDimensions,

  // 封面和目录配置
  CoverConfig,
  TOCConfig,

  // 选项和结果
  PDFConversionOptions,
  PDFConversionResult,
  PDFValidationResult,

  // 进度相关
  PDFConversionStatus,
  PDFProgressInfo,

  // 插件接口
  PDFConverterPlugin,

  // 共享类型（来自 CardtoHTMLPlugin）
  ConversionSource,
  ConversionError,
  ErrorCode,
  CardMetadata,

  // 错误码类型
  PDFErrorCodeType,
} from './types';

// ============================================================================
// 导出错误码常量
// ============================================================================

export { PDFErrorCode } from './types';
