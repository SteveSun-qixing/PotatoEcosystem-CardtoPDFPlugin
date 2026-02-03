# CardtoPDFPlugin

薯片生态卡片转 PDF 插件

## 简介

CardtoPDFPlugin 是薯片生态文件转换系统的核心插件之一，负责将卡片文件（.card）转换为 PDF 文档。首先渲染卡片内容，然后转换为 PDF 格式，支持分页和页面设置。

## 功能特性

- 将卡片文件转换为 PDF 文档
- 支持配置页面大小（A4、Letter 等）
- 支持配置页面方向（纵向、横向）
- 支持配置边距
- 支持添加封面页和目录

## 安装

```bash
npm install @chips/cardto-pdf-plugin
```

## 使用方式

插件通过薯片 SDK 的转换 API 调用，无需直接实例化。

## 配置选项

- **pageSize**: 页面大小，`A4`（默认）、`Letter`、`Legal` 等
- **orientation**: 页面方向，`portrait`（默认）或 `landscape`
- **margin**: 边距设置（上下左右）
- **includeCover**: 是否包含封面页，默认 true
- **includeTOC**: 是否包含目录，默认 false

## 依赖

- @chips/sdk
- @chips/foundation

## 许可证

MIT License

## 仓库

https://github.com/SteveSun-qixing/PotatoEcosystem-CardtoPDFPlugin
