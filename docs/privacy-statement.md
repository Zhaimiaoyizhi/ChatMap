# TurnMap Privacy Statement

TurnMap is an Edge extension that helps turn the current ChatGPT conversation into an editable map.

## Local Data

TurnMap stores map data in the browser's extension storage:

- Conversation id and title
- Extracted question-answer turns
- Node positions, titles, summaries, tags, and statuses
- User-created and AI-suggested links
- Layout and UI preferences
- AI provider settings and API key
- Floating panel preferences
- Floating launcher position and visibility preferences
- Planned update notice preferences, such as ignored versions or reminder choices

This data stays in the local browser profile unless the user exports it or uses AI features.

## AI Provider Data

TurnMap does not call an AI provider automatically unless the user enables auto summarize.

When the user runs AI features, TurnMap sends the relevant node text, summaries, and map context to the configured provider:

- OpenAI
- DeepSeek
- A user-configured OpenAI-compatible endpoint

The provider receives the text needed for the requested feature, such as node summarization or link suggestion.

## ChatGPT Access

TurnMap reads the active ChatGPT conversation page and, when possible, the ChatGPT conversation backend API using the user's existing ChatGPT session. This is used only to build the current conversation map.

The ChatGPT Floating Launcher runs only on ChatGPT pages. It provides a quick way to open TurnMap or TurnMap settings and stores its visibility and position preferences locally.

## Update Notices

The planned Update Notice may check a GitHub Release page or a version manifest to determine whether a newer TurnMap version is available. This check should not include conversation text, API keys, or ChatGPT session data.

## Exports

Users can export maps as JSON, Markdown, Obsidian Canvas, SVG, or PNG. Exported files are controlled by the user.

## Permissions

TurnMap requests:

- `activeTab`, `tabs`, and `scripting` to communicate with the active ChatGPT tab.
- `sidePanel` to provide the Edge side panel UI.
- `storage` to persist maps and settings locally.
- `webRequest` to support reliable ChatGPT conversation API extraction.
- Host access to `chatgpt.com`, OpenAI, and DeepSeek.
- Optional host access for custom AI endpoints, requested only when needed.
