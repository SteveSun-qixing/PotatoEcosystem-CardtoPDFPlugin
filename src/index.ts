/**
 * CardtoPDFPlugin - 薯片卡片转 PDF 插件
 *
 * 将薯片卡片文件（.card）转换为 PDF 文档
 * 依赖 CardtoHTMLPlugin 先生成 HTML，再使用浏览器打印
 *
 * @packageDocumentation
 */

export { CardtoPDFPlugin, createPlugin, plugin } from './plugin';

export type {
  PageSize,
  PageOrientation,
  PageMargin,
  PDFConversionOptions,
  PDFConversionResult,
  PDFProgressInfo,
} from './types';
