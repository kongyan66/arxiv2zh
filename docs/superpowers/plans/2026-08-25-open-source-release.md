# arxiv2zh 开源发布实施计划

日期：2026-08-25

## 1. 项目标识与仓库卫生

- 将 GitHub 仓库、主页、问题地址和插件 ID 统一为
  `kongyan66/arxiv2zh` 与 `arxiv2zh@kongyan66`。
- 将公开作者名统一为 `kongyan66`，保留现有 Git 提交邮箱和历史。
- 检查 `.gitignore`、`.env.example`、编辑器配置和构建目录，确保本机配置、缓存、
  Cookie、日志、数据库及安装包不会被提交。
- 删除 Zotero 插件模板遗留文档、示例模块和无效自动化配置。

验证：运行敏感信息扫描、`git diff --check` 和 `git status --short`。

## 2. 代码与安装包整理

- 审查 `src/modules` 的职责、导出、错误日志和第三方协议边界。
- 删除无用代码和模板注释，不做改变插件行为的重构。
- 确认运行时日志不输出 Cookie、认证头、签名下载 URL 或本机文件路径。
- 确认生产 XPI 只包含插件运行所需文件。

验证：执行 TypeScript、ESLint、Prettier、单元测试和 XPI 内容审计。

## 3. 用户与开发文档

- 重写中文 `README.md` 并新增 `README.en-US.md`。
- 说明兼容版本、安装、工作流、设置、数据与 Cookie、已知限制、故障排查、开发和
  发布方法。
- 新增 `CHANGELOG.md`，记录 0.1.2 的功能、修复和已知限制。
- 新增 `THIRD_PARTY_NOTICES.md`，说明 Zotero、arXiv、hjfy.top、项目模板和直接依赖。

验证：检查两份 README 的链接、命令、版本和标识一致。

## 4. 社区与安全规范

- 新增 `CONTRIBUTING.md`、`CODE_OF_CONDUCT.md` 和 `SECURITY.md`。
- 新增缺陷报告与功能建议 Issue 表单、PR 模板及空白 Issue 配置。
- 安全报告使用 GitHub 私密漏洞报告，不承诺尚不存在的邮箱或响应时限。
- 明确项目独立性、第三方服务、隐私、版权和翻译准确性边界。

验证：检查 YAML 语法、模板链接和隐私字段。

## 5. CI 与发布自动化

- 将公共 CI 调整为格式、ESLint、TypeScript、Node 单元测试和生产构建。
- 从公共 CI 移除依赖 GUI 与真实 hjfy.top 的 Zotero 集成测试。
- 为 GitHub Actions 设置最小权限，并将第三方 Actions 固定到不可变提交。
- 保留 `v*` 标签触发的 XPI、更新清单和 GitHub Release 自动发布流程。

验证：本地执行与 CI 相同的命令，并检查工作流语法与构建路径。

## 6. 发布前验证

- 运行 `npm run lint:check`、`npx tsc --noEmit` 和 `npm run test:unit`。
- 运行隔离的 Zotero 集成测试，覆盖 UI、登录页、真实 PDF 下载与启动。
- 执行 `npm run build`、`unzip -t` 和 XPI 文件列表审计。
- 扫描 Git 跟踪文件和提交差异中的凭据、本机路径、Cookie 与签名 URL。

## 7. GitHub 发布

- 提交整理后的源码，并将原模板远程重命名为 `upstream`。
- 通过 GitHub 官方授权登录，创建公开仓库 `kongyan66/arxiv2zh`。
- 添加新的 `origin`，推送 `main` 和标签 `v0.1.2`。
- 等待 GitHub Actions 完成，检查 Release、XPI 和更新清单可下载。

上传过程中不收集或保存 GitHub 密码、个人访问令牌或浏览器 Cookie。
