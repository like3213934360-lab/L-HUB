# Contributing to L-Hub

感谢你对 L-Hub 的关注！我们欢迎所有形式的贡献。

## 🚀 快速开始

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交改动：`git commit -m "feat: add your feature"`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 Pull Request

## 📋 开发环境

```bash
git clone https://github.com/readysteadyscience/l-hub.git
cd l-hub
npm install
npm run compile
```

在 VS Code 中按 `F5` 启动调试实例。

## 🏗️ 项目结构

```
src/
├── extension.ts       # VS Code 插件入口
├── mcp-server.ts      # MCP Server 核心（路由 + API 调用 + CLI）
├── settings.ts        # 模型配置和默认值
├── storage.ts         # SQLite 历史记录
├── webview-provider.ts # Dashboard 面板
└── ws-server.ts       # WebSocket Server
webview/
├── components/        # React 组件（ConfigPanel, HistoryConsole）
└── index.tsx          # Webview 入口
```

## 🎯 贡献方向

- **Bug 修复** — 查看 [Issues](https://github.com/readysteadyscience/l-hub/issues) 中带 `bug` 标签的问题
- **新模型接入** — 在 `settings.ts` 中添加新的 AI 模型配置
- **路由优化** — 改进 `mcp-server.ts` 中的 `detectTaskType()` 和 `resolveRoute()`
- **文档翻译** — 帮助将文档翻译为英文或其他语言
- **UI 改进** — 优化 Dashboard 面板的用户体验

## 📝 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `refactor:` 代码重构
- `chore:` 构建/工具改动

## 💬 交流

- [Discord](https://discord.gg/gurEPMnn52)
- [GitHub Issues](https://github.com/readysteadyscience/l-hub/issues/new)

## 📄 许可证

MIT — 详见 [LICENSE](LICENSE.txt)
