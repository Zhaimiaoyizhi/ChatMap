# Changelog

All notable changes to TurnMap will be documented in this file.

## [0.4.0] - Multi-Site AI Conversation Adapters

### Added

- Added a ConversationAdapter boundary for site detection, extraction refresh, deep scan, jump-to-turn, observer updates, and turn-message creation.
- Added ChatGPT as the first adapter while preserving the existing ChatGPT extraction and jump behavior.
- Added fully supported web conversation adapters for DeepSeek, Kimi, Doubao, Qwen, Gemini, Google AI Studio, Claude.ai, Perplexity, Grok, GLM / Z.ai / Zhipu Qingyan, Mistral Le Chat, and Arena / LMArena.
- Marked all 0.4.0 supported web conversation adapters as fully supported, including both `chatglm.cn` and `chat.z.ai` for GLM / Z.ai.
- Added Google AI Studio URL detection, manifest injection, and DOM-first prompt/model extraction coverage, with collapsed Thoughts / Thinking UI excluded from captured answers.
- Added unit coverage for adapter ordering, URL detection, and generic user-assistant turn pairing.

### Changed

- Routed content-script refresh, deep scan, observer, Float navigation, and jump commands through the active adapter.
- Updated app status text and Debug Report output so the UI can describe supported AI conversation sites instead of assuming ChatGPT everywhere.
- Expanded extension host permissions, content-script matches, and launcher icon access for the supported 0.4.0 web AI sites.

## [0.3.0] - Knowledge Organization

### Added

- Added a Collapse Topic bulk action that turns selected turns into one editable topic note while hiding the original nodes.
- Added unit coverage for topic-collapse behavior.
- Added OPML export from the Files menu, preserving node summaries, statuses, tags, source turns, and relationship metadata.
- Added Obsidian vault Markdown export from the Files menu as a zip bundle with `index.md` and per-node notes.
- Added unit coverage for OPML and Obsidian vault Markdown export formatting.

### Changed

- Enhanced Obsidian Canvas export with turn numbers, statuses, tags, relationship labels, confidence, importance, and relationship reasons.
- Documented XMind export as feasible via a dependency-free `.xmind` zip package, with Anki CSV remaining a later candidate.
- Kept strong-link and batch-link workflows as the default organization path, with manual editing available as a fallback.
- Localized node and link editing panels so built-in and AI-generated UI translations cover graph-editing controls.
- Changed node interaction so left-click selects, Ctrl/Shift-click supports multi-select, text double-click edits, and text right-click jumps to the source turn.
- Added link right-click endpoint highlighting while preserving left-click link selection.
- Added API task progress logging for summaries, link suggestions, provider tests, and AI UI translation generation.
- Added persistent node color, fold, and importance states with an eight-color palette shared by relationship types.
- Simplified Node Actions by removing split, duplicate-note, open, and review controls from the panel.

## [0.1.0] - GitHub Preview

### Added

- Edge side panel for ChatGPT conversation mapping.
- Full Page view and Float view.
- Turn-based map with click-to-jump navigation.
- Full conversation extraction through ChatGPT API, structured data, web storage, DOM, and deep-scan fallbacks.
- Editable nodes, notes, tags, statuses, hidden nodes, root/header edits, and relationship links.
- Layouts: Single-side, Radial, Matrix, and Two-sided.
- AI summaries and AI semantic link suggestions.
- OpenAI, DeepSeek, and custom OpenAI-compatible provider settings.
- Dedicated Settings Page for AI, interface, Float, launcher, and update preferences.
- ChatGPT Floating Launcher with left-click open, right-click settings, drag, and saved position.
- TurnMap JSON import/export.
- Obsidian Canvas, Markdown, SVG, and PNG export.
- Lightweight in-app SVG icon system for the side panel and graph toolbar.
- Icon-enhanced header, view menu, layout picker, graph actions, and file menu.
- Theme switcher in Settings with Day, Night, and Eye-care themes.
- Follow browser theme option that resolves to Day or Night from `prefers-color-scheme`.
- Built-in UI language switching for English and Chinese, with Follow browser language detection.
- AI-assisted custom UI translation generation for additional languages, saved locally as reusable language options.
- GitHub README preview screenshot and Chinese social launch copy.

### Changed

- Refined the main header into a clearer app brand block while preserving the light technology style.
- Improved toolbar scanability with consistent icon + label controls and responsive wrapping for narrow side panels.
- Kept Day as the default `0.1.2` theme and persist user theme selection locally.
- Kept language and custom translation text local in extension storage.
- Updated core app chrome, toolbar, Settings, AI settings, layout labels, and relationship labels to use localized UI text.
- Raised the View menu stacking layer so it appears above the graph toolbar.
- Restyled React Flow controls and MiniMap with theme-aware colors so Night mode controls remain visible.
- Updated README roadmap with future multi-AI-site, multi-browser, and broader API provider compatibility plans.
- Restored the Chinese README as readable UTF-8 documentation.
- Hardened AI summary parsing so labeled English or Chinese title/summary text can be recovered when a provider returns readable text instead of strict JSON.
- Made AI link suggestion parsing tolerate plain-text provider replies by returning no suggestions instead of interrupting the existing graph.
- Added a minimal unit-test script for AI JSON parsing fallbacks.
- Added a Debug Report export from the Debug panel with redacted conversation diagnostics for issue reports.

### Known Issues

- Identical repeated prompts can reduce jump precision.
- ChatGPT DOM or backend changes can affect extraction.
- GitHub/unpacked installs require manual updates.
- Store publication requires additional icon and listing assets.

## [0.9.0] - Light Tech UI Preview

### Changed

- Restyled the side panel, full page map UI, graph nodes, toolbar, menus, panels, settings page, floating navigator, and launcher with a brighter minimal technology aesthetic.
- Shifted the visual system from warm beige surfaces to cool white, pale blue, cyan, and teal design tokens.
- Improved focus states, hover states, surface hierarchy, and reduced visual noise while keeping existing interactions unchanged.

## [0.8.0] - Early Preview

### Added

- Release packaging script.

### Version Mapping

- Former local `0.1.0` preview archive is retained as `0.8.0`.
- Former local `0.1.1` UI preview archive is retained as `0.9.0`.
- Former local `0.1.2` work is now the GitHub preview release `0.1.0`.
