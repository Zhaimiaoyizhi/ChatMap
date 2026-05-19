# TurnMap

[English](README.md) | [中文](README.zh-CN.md)

把 AI 长对话转换成可编辑、可跳转、可导出的思维导图。

TurnMap 是一个优先面向 Edge 的浏览器扩展，用来把当前网页端 AI 对话映射成可视化节点图。每一轮问答会成为一个节点，节点可以跳回原始网页消息，也可以被编辑、链接、染色、折叠、标记重要、AI 总结、导出，并在之后恢复继续整理。

> 状态：早期预览版。TurnMap 还没有发布到 Edge Add-ons 或 Chrome Web Store。当前可以从源码手动安装，或从 GitHub Release 下载预览包。

![TurnMap 预览](docs/assets/turnmap-preview.png)

## 适用场景

TurnMap 适合：

- 个人学习、复习和知识整理。
- 长 AI 对话导航。
- 在单个对话内做研究、写作和资料组织。

当前版本服务于当前打开的已支持 AI 对话网页。跨多个对话的全局知识图谱不属于首发版本范围。

## 功能亮点

- **对话地图**：把当前 AI 对话转换成节点图。
- **已支持网页**：ChatGPT、Gemini、Claude.ai、DeepSeek、Kimi、豆包、Qwen、Google AI Studio、Perplexity、Grok、GLM / Z.ai / 智谱清言、Mistral Le Chat 和 Arena / LMArena。
- **跳回原文**：通过节点回到来源网页中对应的问答位置。
- **可编辑图谱**：编辑标题、摘要、标签、状态、笔记、隐藏节点和关系链接。
- **节点外观自定义**：节点可染色、折叠、标记重要；节点染色支持渐变或底色渲染，并可调节渲染程度。
- **链接操作**：链接颜色与类型统一，重要链接使用更强加粗效果；不同关系可以用更清晰的颜色区分。
- **更多外观选择**：支持日间、夜间、护眼和跟随浏览器主题，支持多种布局与显示偏好。
- **选项卡优化**：Side Panel、Full Page、Float、页面悬浮启动器等入口被整合到更清爽的视图与设置结构中。
- **多种视图**：Side Panel、Full Page 和 Float。
- **设置页面**：在图谱工作区之外管理 AI、界面默认值、主题、语言、启动器、Float 和更新偏好。
- **页面悬浮启动器**：在已支持 AI 页面右侧显示小启动球，左键打开 TurnMap，右键打开设置。
- **多种布局**：Single-side、Radial、Matrix 和 Two-sided。
- **导入导出**：TurnMap JSON、Obsidian Canvas、OPML、Obsidian vault Markdown、Markdown、SVG 和 PNG。
- **本地优先存储**：每个对话的图谱状态保存在浏览器本地扩展存储中。

## 当前视图

| 视图 | 用途 |
| --- | --- |
| Side Panel | 在 Edge 侧边栏中与已支持 AI 对话网页并排使用。 |
| Full Page | 使用更大的图谱画布，同时保持与来源对话标签页联动。 |
| Float | 在已支持 AI 页面内使用紧凑的悬浮导航器。 |
| Page Launcher | 在已支持 AI 页面右侧快速打开 TurnMap 或设置。 |

## 从源码安装

要求：

- Node.js
- Microsoft Edge
- 已支持的网页端 AI 会话

构建：

```powershell
npm install
npm.cmd run build
```

在 Edge 中加载：

1. 打开 `edge://extensions`。
2. 启用 Developer mode。
3. 点击 Load unpacked。
4. 选择 `<project-root>\dist`。
5. 打开一个已支持的 AI 对话。
6. 从扩展按钮或 Edge 侧边栏打开 TurnMap。

## 从 GitHub Release 安装

对于预览版，可以从 GitHub Releases 下载 zip，解压后在 Edge 开发者模式中加载解压后的文件夹。

GitHub/unpacked 安装需要手动更新。真正适合普通用户自动更新的路径是浏览器插件商店分发。

## 基础使用

1. 打开一个已支持的 AI 对话网页。
2. 打开 TurnMap。
3. 点击 Refresh 读取当前完整对话。
4. 选择布局：Single-side、Radial、Matrix 或 Two-sided。
5. 单击节点选中节点，使用 Node Actions 编辑、染色、折叠、标记重要或批量操作。
6. 右键节点正文可跳回来源网页原文。
7. 选择链接后使用 Link Actions 调整链接颜色、重要程度和说明。
8. 使用 Files 导出或导入图谱。

## 外观与界面设置

TurnMap 的设置页面用于管理全局界面偏好：

- **主题**：日间、夜间、护眼或跟随浏览器。
- **语言**：跟随浏览器、英文、中文，以及由 AI 生成并保存在本地的自定义界面翻译。
- **默认布局**：Single-side、Radial、Matrix 或 Two-sided。
- **节点染色渲染**：可选择渐变或底色，并用滑动条调节渲染程度。
- **AI 输出预算**：调整 `max_tokens`，适配需要更多回答预算的 provider 或推理模型。
- **入口显示**：管理 Side Panel、Full Page、Float 和页面悬浮启动器相关偏好。

## AI 功能

TurnMap 支持提供 OpenAI-compatible `/chat/completions` API 的服务商。

内置预设：

- OpenAI
- DeepSeek
- Custom compatible endpoint

当前 AI 功能仍处于预览阶段，尚不完全稳定：

- **AI 总结**：用于生成紧凑的节点标题和摘要，但不同 provider 的 JSON / 文本输出格式兼容性仍在完善。
- **AI 建议链接**：用于在强相关节点之间建议语义链接，但需要继续优化阈值、置信度和画面整洁度。
- **AI 翻译**：可为界面标签生成自定义语言包并保存在本地，但仍需要继续提升格式兼容性与长文本排版稳定性。

后续版本会继续增强 AI 翻译、AI 总结、AI 建议链接、更多 provider 兼容和任务日志辅助排错。

API key 保存在用户本地浏览器扩展存储中，不会提交到本仓库。

响应格式要求详见 [AI Provider Guide](docs/ai-provider-guide.md)。

## 隐私

默认情况下，TurnMap 将对话图谱保存在浏览器扩展本地存储中。AI 功能会把选定的对话文本发送到用户配置的 provider。导出文件由用户自行控制。

详见 [Privacy Statement](docs/privacy-statement.md)。

## 权限

TurnMap 当前预览版请求以下必要权限：

- `activeTab`、`tabs` 和 `scripting`：用于识别当前已支持 AI 对话标签页、必要时注入 content script、打开 Full Page，并跳回原始对话节点。
- `sidePanel`：提供 Edge 侧边栏界面。
- `storage`：在本地保存图谱、设置、AI provider 配置、launcher 位置和 Float 状态。
- `webRequest`：在可用时辅助读取 ChatGPT backend 请求，从而更可靠地提取完整当前对话。
- 已支持 AI 对话网站、OpenAI 和 DeepSeek 的 host access。
- 自定义 OpenAI-compatible provider 使用 optional host access，仅在用户配置自定义 endpoint 时请求。

详见 [Permission Review](docs/permissions-review.md)。

## 开发

```powershell
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run build
npm.cmd run package
```

`npm.cmd run package` 会在 `release/` 中生成 zip 包。

## 项目结构

```text
src/content       站点 adapter、提取、跳转、Float、launcher 相关代码
src/side-panel    TurnMap 主界面
src/full-page     Full Page 入口
src/background    MV3 service worker
src/shared        共享消息和类型定义
docs              用户、开发者、隐私和发布文档
scripts           构建和打包辅助脚本
```

## 文档

- [User Guide](docs/user-guide.md)
- [Developer Guide](docs/developer-guide.md)
- [AI Provider Guide](docs/ai-provider-guide.md)
- [Privacy Statement](docs/privacy-statement.md)
- [Permission Review](docs/permissions-review.md)
- [Release Readiness](docs/release-readiness.md)
- [GitHub Release Plan](docs/github-release-plan.html)
- [社交平台宣传文案](docs/social-promo.zh-CN.md)

## 已知限制

- AI 网站页面结构可能随时变化。
- 对话中出现重复问题时，跳转精度可能下降。
- GitHub/unpacked 安装无法由扩展自身静默自动更新。
- 商店发布可能需要额外 PNG 图标和隐私材料。
- AI 翻译、AI 总结和 AI 建议链接依赖 provider 的请求与响应格式，当前仍处于预览增强阶段。

## 路线图

- `0.1.x`：稳定预览版，重点是 AI fallback、Float / Full Page 小屏体验；读取和跳转目前较稳定，暂不重构。
- `0.2.0`：更新提示与 ChatGPT 适配增强，包括 GitHub Release 检查、忽略版本、稍后提醒、脱敏 debug report。
- `0.3.0`：协作与高级导出。OPML 与 Obsidian vault Markdown 已实现；XMind 作为 Anki CSV 之前的下一优先项。
- `0.4.0`：多 AI 对话网页适配，支持 ChatGPT、Gemini、Claude.ai、DeepSeek、Kimi、豆包、Qwen、Google AI Studio、Perplexity、Grok、GLM / Z.ai / 智谱清言、Mistral Le Chat 和 Arena / LMArena。当前计划完成后，继续处理 MiniMax Agent。
- `0.5.0`：更多 API Key / Provider 兼容，Custom OpenAI-compatible endpoint 保留为兜底接入方式。
- `0.6.0`：Embedding 主题分析增强，默认不开启，只在长对话或用户手动触发时使用。
- `0.7.0`：知识整理能力增强，包括更智能的链接、批量接受/拒绝链接、主题折叠、批量标签。
- `0.8.0`：Chrome 兼容迁移；Firefox 后续需单独适配 sidebar_action。
- `0.9.0`：公开 Beta，目标是 100+ 节点不卡顿，大图导出不溢出，AI 批量任务可取消。
- `0.10.0`：商店发布准备，Edge Add-ons 首发，Chrome Web Store 后续配合 Chrome 兼容阶段。
- `1.0.0`：稳定版，发布前必须完成隐私、权限、文档、QA、安装恢复路径。
- `1.1.0`：实验性细化图谱，正式版发布后慢慢完成。

## 贡献

欢迎通过 GitHub Issues 提交 bug、功能建议和 AI provider 兼容性报告。

提交 pull request 前请运行：

```powershell
npm.cmd run typecheck
npm.cmd run build
```

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 安全

不要提交 API key、私人对话导出、浏览器配置数据，或包含私人对话内容的截图。

详见 [SECURITY.md](SECURITY.md)。

## 许可

MIT。详见 [LICENSE](LICENSE)。
