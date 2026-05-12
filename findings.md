# Findings: ChatMap Light Tech UI Preview

## Skill Notes

- `ui-ux-pro-max` applies because the task changes visual design, UI structure, and perceived quality.
- The installed skill's `scripts` and `data` entries are placeholder files pointing to unavailable relative targets, so the scripted design-system search cannot be run in this environment.
- We will apply the skill's documented high-priority rules directly:
  - strong contrast and readable text;
  - visible focus states;
  - comfortable 44px-class controls where practical;
  - consistent icon/control styling;
  - stable dimensions for toolbars and nodes;
  - subtle motion only, with `prefers-reduced-motion` support;
  - no decorative blobs or noisy gradients.

## Design Direction

Target aesthetic: light-first, concise, elegant, minimal technology.

Design tokens:

- Background: cool off-white / pale blue surface rather than beige.
- Primary accent: clean cyan-blue.
- Secondary accent: soft teal.
- Text: neutral slate with strong contrast.
- Borders: blue-gray, subtle but crisp.
- Shadows: lower, cooler, less brown than the current release.
- Radius: 8px or less for cards and panels, matching existing product-tool guidance.

## Current UI Observations

- Existing UI is functional but warmer and more beige than the requested direction.
- Header, toolbar, panels, nodes, and settings page share CSS tokens, so a token-led restyle can cover most of the product without behavioral changes.
- Content script floating panel has inline CSS and must be updated separately.

## Files Expected To Change

- `src/side-panel/styles.css`
- `src/settings-page/settings-page.css`
- `src/content/index.ts`
- `package.json`
- `package-lock.json`
- `src/manifest.ts` or generated manifest source if version is duplicated there
- `CHANGELOG.md`
- planning files

