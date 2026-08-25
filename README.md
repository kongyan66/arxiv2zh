<p align="center">
  <img src="addon/content/icons/arxiv2zh.svg" width="72" alt="arxiv2zh 图标">
</p>

<h1 align="center">arxiv2zh</h1>

<p align="center">
  在 Zotero 中提交 arXiv 论文翻译，并自动归档中文 PDF。
</p>

<p align="center">
  <a href="https://github.com/kongyan66/arxiv2zh/actions/workflows/ci.yml"><img src="https://github.com/kongyan66/arxiv2zh/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/kongyan66/arxiv2zh/releases"><img src="https://img.shields.io/github/v/release/kongyan66/arxiv2zh" alt="GitHub Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kongyan66/arxiv2zh" alt="AGPL-3.0-or-later"></a>
</p>

<p align="center"><a href="README.en-US.md">English</a></p>

arxiv2zh 是一个面向 Zotero 7-9 的社区插件。它调用
[hjfy.top](https://hjfy.top/) 处理 arXiv 论文，在翻译完成后校验中文 PDF 并将其
作为附件添加到 Zotero 条目。

> [!IMPORTANT]
> arxiv2zh 是独立社区项目，与 Zotero、arXiv 和 hjfy.top 均无隶属或官方认可
> 关系。hjfy.top 未提供稳定的公开插件 API，服务端变化可能导致插件暂时不可用。

## 功能

- 从条目的 URL、DOI、Extra 或 PDF 附件信息中识别 arXiv ID。
- 支持新版、旧版、版本化 arXiv ID，以及 arXiv、DOI 和 alphaXiv 地址。
- 支持多选条目批量提交、任务恢复、失败重试和强制重新下载。
- 没有目标条目时，根据 arXiv 元数据创建预印本条目。
- 检查 PDF 文件头和文件尾，再导入 Zotero 存储。
- 通过工具栏角标和右侧任务面板显示状态。
- 在 hjfy.top 第一方页面登录，并复用 Zotero 配置中持久保存的 Cookie。

## 环境要求

- Zotero 7、8 或 9。
- 可访问 hjfy.top 及其返回的 PDF 下载地址。
- 论文在 arXiv 上提供可处理的 LaTeX 源码。
- hjfy.top 账号；是否需要登录由服务端状态决定。

## 安装

1. 从 [GitHub Releases](https://github.com/kongyan66/arxiv2zh/releases)
   下载最新的 `arxiv2zh.xpi`。
2. 在 Zotero 中打开“工具 → 插件”。
3. 点击齿轮菜单，选择“从文件安装插件”，然后选择下载的 XPI。
4. 重启 Zotero。

如果此前安装过插件 ID 为 `arxiv2zh@kongcaihua.local` 的开发构建，请先卸载该
开发构建，再安装公开版本，避免 Zotero 同时加载两个插件实例。

升级时直接安装新版 XPI，即可覆盖旧版本并保留设置与任务历史。

## 使用

### 翻译现有条目

选中包含 arXiv 信息的普通条目或其 PDF 附件，右键选择
“arxiv2zh → 翻译为中文”。可以多选条目批量提交。

插件优先从条目的 URL、DOI、Extra 和附件来源中查找 arXiv ID。若没有识别到，
会打开输入框供手动粘贴。

### 直接输入地址

选择“工具 → arxiv2zh → 输入 arXiv 地址”，粘贴 arXiv URL 或 ID。如果当前没有
目标条目，插件会读取论文元数据并创建一个预印本条目。

### 登录与任务状态

首次提交任务时，插件可能打开 hjfy.top 第一方页面。登录完成后，任务会继续轮询。
登录窗口可关闭，Cookie 仍由当前 Zotero 配置保存。

点击条目工具栏左侧的“译”图标可打开任务面板。再次点击、点击面板关闭按钮或按
`Esc` 可收起面板。任务完成后，附件标题为 `中文翻译 - arxiv2zh`，文件名为
`{arxiv-id}_zh_CN.pdf`。

## 设置

在 Zotero 设置的“arxiv2zh”页面中可以配置：

- hjfy.top 服务地址。
- 单篇完成后是否自动打开 PDF。
- 状态轮询间隔，最短 5 秒。
- 本地任务历史保留天数。
- 打开账户页面或清除目标服务域名的登录 Cookie。

服务地址必须使用 HTTPS；仅本机开发地址允许 HTTP。

## 数据与隐私

arxiv2zh 不包含遥测或广告，也不保存账号密码。插件处理以下数据：

| 数据                                               | 位置与用途                                                     |
| -------------------------------------------------- | -------------------------------------------------------------- |
| arXiv ID、论文标题、Zotero 条目 ID、任务状态和时间 | 保存在 Zotero 数据目录下的 `arxiv2zh/tasks.json`，用于恢复任务 |
| 登录 Cookie                                        | 由 Zotero 内置 Firefox 配置存储管理，用于保持目标服务登录状态  |
| 中文 PDF                                           | 导入 Zotero 的附件存储                                         |
| 服务地址及行为设置                                 | 保存在 Zotero 插件偏好设置                                     |

插件会向配置的服务地址发送用户主动提交的 arXiv ID，并访问该服务返回的 PDF 下载
地址。下载地址可能属于不同的第三方存储域。完整说明见
[隐私说明](PRIVACY.md)。

## 已知限制

- hjfy.top 的接口没有正式版本承诺，协议变化需要更新插件。
- 插件只处理 arXiv 论文和中文 PDF，不支持任意本地 PDF。
- 停止任务只停止本地轮询；服务端当前没有公开的取消接口。
- 任务历史不会通过 Zotero Sync 同步。
- 翻译质量和输出内容由第三方服务决定。

## 故障排查

- **登录页为空白**：确认已安装最新版本，并检查 hjfy.top 是否可在浏览器中访问。
- **提示没有 LaTeX 源码**：该论文无法通过当前服务处理。
- **一直等待登录**：在设置中打开账户页面完成登录，或清除会话后重新登录。
- **下载失败或响应无效**：稍后重试，并在提交 Issue 前确认服务网站本身可用。

报告问题时请提供 Zotero 版本、插件版本、arXiv ID、复现步骤和脱敏后的错误信息。
不要提交 Cookie、账号信息、签名下载地址或包含私人目录的完整日志。参见
[缺陷报告](https://github.com/kongyan66/arxiv2zh/issues/new?template=bug_report.yml)。

## 开发

需要 Node.js 20 或更新版本。建议使用单独的 Zotero 配置与数据目录进行调试。

```bash
git clone https://github.com/kongyan66/arxiv2zh.git
cd arxiv2zh
npm ci
cp .env.example .env
```

在 `.env` 中填写 Zotero 可执行文件、开发配置目录和可选的数据目录，然后运行：

```bash
npm start                 # 启动开发模式
npm test                  # Node 单元测试
npm run test:integration  # 隔离的 Zotero/网络集成测试
npm run check             # 格式、ESLint、类型和单元测试
npm run build             # 生成生产 XPI
```

构建产物位于 `.scaffold/build/arxiv2zh.xpi`。真实集成测试会访问 hjfy.top，并可能在
开发数据目录中创建 Zotero 条目和附件，不应使用日常 Zotero 数据目录。

架构说明见[设计规格](docs/superpowers/specs/2026-08-24-arxiv2zh-design.md)。参与
开发前请阅读 [贡献指南](CONTRIBUTING.md)和[安全政策](SECURITY.md)。

## 发布

项目使用语义化版本和 `v*` Git 标签。维护者更新版本与
[CHANGELOG](CHANGELOG.md)，完成本地集成测试后推送标签，GitHub Actions 会构建
XPI、更新清单并创建 Release。

## 致谢

- [Zotero](https://www.zotero.org/) 提供文献管理平台和插件接口。
- [hjfy.top](https://hjfy.top/) 提供论文翻译服务。
- 项目基于
  [zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
  和 Zotero 原生插件 API 构建。
- 交互设计参考
  [zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh)。

更多信息见[第三方声明](THIRD_PARTY_NOTICES.md)。

## 许可证

Copyright (C) 2026 kongyan66.

本项目采用 [GNU Affero General Public License v3.0 or later](LICENSE)。提交贡献即
表示同意按相同许可证发布贡献内容。
