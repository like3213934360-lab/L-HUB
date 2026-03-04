---
description: L-Hub 发布新版本（0.x.x）的标准打理流程
---
当用户要求发布新版本的 L-Hub（如 0.1.x）时，不要仅仅只修改 `package.json`！你**必须**执行以下所有清单检查点：

1. **同步 package.json**
   - 更新 `package.json` 中的 `version` 字段。

2. **同步 README 徽章**
   - 搜索 `README.md` 中的 `badge/version-`，一定要把上面显示的旧版本号同步更新，例如 `version-0.1.9`。

3. **同步 CHANGELOG.md**
   - 在 `CHANGELOG.md` 顶部按倒序插入新的版本头，例如 `## [0.1.9] - YYYY-MM-DD`。
   - 分 `### Added`、`### Fixed`、`### Changed` 准确、简明扼要地记录本次所有改动点。

4. **同步 MCP Server 硬编码**
   - 在 `src/mcp-server.ts` 搜索 `version:` (例如 `version: '0.1.8'`)，并将其替换为最新版本号，以确保 Client 连接时呈现的版本是一致的。

5. **执行编译打包**
   - 运行确认 `npm run compile && npm run build:vsix`。
   - 如果遇到构建或 Webpack 的 `[y/N]` 提示框，必须发送键入 `y` 通过。

**务必在完成上述全部 5 步后，再告知用户可以进行重启和重载测试。**
