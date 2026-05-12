# Changelog

All notable changes to ChatMap will be documented in this file.

## [0.1.1] - Light Tech UI Preview

### Added

- New light-first UI preview version for ChatMap.
- File-based planning records for the UI preview task: `task_plan.md`, `findings.md`, and `progress.md`.

### Changed

- Restyled the side panel, full page map UI, graph nodes, toolbar, menus, panels, settings page, floating navigator, and launcher with a brighter minimal technology aesthetic.
- Shifted the visual system from warm beige surfaces to cool white, pale blue, cyan, and teal design tokens.
- Improved focus states, hover states, surface hierarchy, and reduced visual noise while keeping existing interactions unchanged.
- Bumped extension and package version to `0.1.1` so this UI preview builds as a new package instead of overwriting `v0.1.0`.
- Updated packaging so creating a new version no longer clears older release archives.

## [0.1.0] - Early Preview

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
- ChatMap JSON import/export.
- Obsidian Canvas, Markdown, SVG, and PNG export.
- Release packaging script.

### Planned Before Public Release

- Update Notice for GitHub Release and future store update awareness.

### Known Issues

- Identical repeated prompts can reduce jump precision.
- ChatGPT DOM or backend changes can affect extraction.
- GitHub/unpacked installs require manual updates.
- Store publication requires additional icon and listing assets.
