# arxiv2zh 实施计划

日期：2026-08-24

## 1. 项目标识与基础配置

- 更新 `package.json` 中的名称、插件 ID、实例名、描述和脚本。
- 更新 `addon/manifest.json`，声明兼容 Zotero 7-9。
- 替换默认偏好、本地化和模板示例资源。
- 新增 Node 单元测试命令，保留 Zotero 启动集成测试。

验证：运行 `npm run test:unit`、`npm run build`。

## 2. 可测试领域模块

- `src/modules/arxiv.ts`：解析现代、旧版、带版本号和 URL 形式的 arXiv ID。
- `src/modules/hjfyClient.ts`：定义服务响应、规范化结果、错误类型及可注入传输层。
- `src/modules/pdf.ts`：校验 PDF 文件头、文件尾及空下载。
- `src/modules/taskTypes.ts`：定义任务状态、记录和状态转换辅助函数。
- `test/unit/*.test.mts`：覆盖解析、响应校验、任务转换和 PDF 校验。

验证：单元测试不依赖 Zotero 进程，可快速重复运行。

## 3. Zotero 数据与远端服务

- `src/modules/taskStore.ts`：原子读写任务 JSON、恢复活动任务、按保留期清理历史。
- `src/modules/metadata.ts`：用 XML DOM 解析 Atom 元数据，创建 Zotero 预印本条目。
- `src/modules/resultImporter.ts`：下载签名 URL、校验、写临时文件、导入/更新附件。
- `src/modules/taskManager.ts`：去重、批量调度、登录等待、轮询、重试、导入和恢复。
- `src/modules/sessionManager.ts`：打开第一方登录窗口、复用配置目录 Cookie、清理会话。

验证：模拟传输层测试协议错误；在 Zotero 中测试真实任务恢复和附件落库。

## 4. Zotero 交互与界面

- `src/modules/ui.ts`：注册右键菜单、工具菜单、工具栏角标和右侧任务面板。
- `src/modules/dialogs.ts`：实现快速输入和账户/登录窗口。
- `src/modules/progress.ts`：实现低干扰进度通知和批量汇总。
- `addon/content/taskPanel.css`：实现紧凑、可扫描、支持深浅色的任务面板。
- `addon/content/preferences.xhtml` 与 `src/modules/preferenceScript.ts`：实现服务地址、
  自动打开、轮询间隔、历史保留和会话命令。
- `addon/locale/{zh-CN,en-US}`：覆盖菜单、状态、错误、按钮和设置文本。
- `src/hooks.ts` 与 `src/addon.ts`：只负责生命周期组装和资源清理。

验证：在 Zotero 9.0.6 中检查菜单可见性、输入窗口、任务状态、面板尺寸、深色模式和
多窗口卸载。

## 5. 自动检查与真实调试

- 执行 Prettier、ESLint、TypeScript、Node 单元测试和生产 XPI 构建。
- 创建隔离的 Zotero 调试配置并通过 `npm start` 热加载。
- 用 `2501.14787` 验证真实状态、签名地址刷新、下载、PDF 校验、建条目和附件导入。
- 验证登录窗口与 Cookie 跨重启保留；验证码由用户在第一方页面完成。
- 验证多选批量、重复跳过、重新下载、失败重试和重启恢复。
- 截图检查任务面板和偏好设置，修复布局及运行时日志中的错误。

## 6. 交付

- 生成生产 XPI，并报告绝对路径。
- 汇总实际执行的测试、Zotero 调试结果和仍受 hjfy.top 未文档化接口约束的风险。
