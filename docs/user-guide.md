# TurnMap User Guide

TurnMap turns the current ChatGPT conversation into an editable map.

## Opening TurnMap

Current views:

- Side Panel: compact map beside ChatGPT.
- Full Page: larger map view connected to the source ChatGPT tab.
- Float: compact in-page navigator on ChatGPT.
- ChatGPT Floating Launcher: right-side launcher on ChatGPT pages.

Launcher behavior:

- Left-click opens TurnMap.
- Right-click opens TurnMap settings.
- Drag moves the launcher; the position is saved locally.

## Settings

TurnMap has a dedicated settings page for global settings:

- AI provider, model, API key, and auto summarize.
- Default layout.
- Float default state.
- ChatGPT launcher visibility.
- Update notice preferences.

## Refreshing A Conversation

Use Refresh to read the current ChatGPT conversation. TurnMap tries several extraction methods and falls back to deep scanning when needed.

## Editing The Map

You can:

- Edit node title and summary.
- Drag nodes.
- Add, edit, and delete links.
- Change link type and importance.
- Add notes.
- Merge, split, hide, or tag nodes.
- Switch layouts.

## AI Features

AI features require a configured provider and API key.

- Summarize: creates compact titles and summaries.
- Suggest Links: proposes strong semantic links between non-adjacent related nodes.

AI features send selected conversation text to the configured provider.

## Import And Export

Supported formats:

- TurnMap JSON
- Obsidian Canvas
- Markdown
- SVG
- PNG

Use TurnMap JSON when you want to restore and continue editing a map.

## Updates

GitHub/unpacked installs require manual updates. Planned Update Notice will tell users when a new release is available and provide links to the release page or zip package.

Store installs, once available, should update through the browser's extension update system.
