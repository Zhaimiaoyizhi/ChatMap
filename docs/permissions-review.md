# TurnMap Permission Review

This document explains the permissions used by TurnMap `v0.1.0`.

## Required Extension Permissions

| Permission | Why TurnMap Uses It | Data Scope |
| --- | --- | --- |
| `activeTab` | Identify and communicate with the currently active ChatGPT tab when the user opens or refreshes TurnMap. | Current active tab. |
| `tabs` | Open Full Page mode, activate the source ChatGPT tab for jump-to-source, and route map actions back to the correct tab. | Tab id, URL, and activation state needed for navigation. |
| `scripting` | Inject the content script if TurnMap opens before the content script is already available on the ChatGPT page. | ChatGPT tab only. |
| `sidePanel` | Provide the Edge side panel interface. | Extension UI only. |
| `storage` | Save graph state, UI preferences, AI settings, launcher position, and Float state locally. | Browser extension profile. |
| `webRequest` | Capture replayable ChatGPT backend request headers so TurnMap can fetch the full current conversation without visible page scrolling when possible. | ChatGPT backend requests only. |

## Required Host Permissions

| Host | Why TurnMap Uses It |
| --- | --- |
| `https://chatgpt.com/*` | Read the current ChatGPT conversation page, show the launcher/Float UI, and jump back to source turns. |
| `https://chatgpt.com/backend-api/*` | Fetch the full current conversation through the user's existing ChatGPT session when available. |
| `https://api.openai.com/*` | Send AI summary/link requests when the user configures OpenAI. |
| `https://api.deepseek.com/*` | Send AI summary/link requests when the user configures DeepSeek. |

## Optional Host Permissions

| Host Pattern | Why It Is Optional |
| --- | --- |
| `https://*/*` | Custom OpenAI-compatible HTTPS providers. Requested only when the user enters a custom endpoint. |
| `http://localhost/*` | Local custom-compatible providers during development or private testing. |
| `http://127.0.0.1/*` | Local custom-compatible providers during development or private testing. |

## Review Notes

- TurnMap is current-conversation scoped. It does not build a cross-conversation graph in `v0.1.0`.
- Conversation maps, API keys, layout preferences, and UI preferences are stored locally in the browser extension profile.
- AI features send selected conversation content only to the provider configured by the user.
- Custom provider permissions are requested at runtime through `chrome.permissions.request`.
- GitHub/unpacked preview installs do not auto-update themselves. Store builds should use browser-managed updates later.

## Release Decision

The current permission set is acceptable for the GitHub `v0.1.0` pre-release.
Before store submission, revisit whether `webRequest` and broad optional custom
provider host access need additional store-review wording or narrower defaults.
