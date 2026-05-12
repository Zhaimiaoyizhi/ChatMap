# Task Plan: ChatMap Light Tech UI Preview

## Goal
Create a new non-overwriting ChatMap UI version with a bright, concise, elegant, minimal technology aesthetic, then package it as a new version and record the work in the changelog.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Read requested `ui-ux-pro-max` skill.
- [x] Read requested `planning-with-files` skill.
- [x] Confirm non-overwrite strategy.
- [x] Review current UI CSS.
- **Status:** complete

### Phase 2: Design System & Planning
- [x] Create persistent planning files.
- [x] Document design direction in `findings.md`.
- [x] Identify files to change.
- **Status:** complete

### Phase 3: Implementation
- [x] Create light tech UI in source styles.
- [x] Bump version to a new package version.
- [x] Update changelog.
- **Status:** complete

### Phase 4: Testing & Packaging
- [x] Run `npm.cmd run typecheck`.
- [x] Run `npm.cmd run build`.
- [x] Run `npm.cmd run package`.
- [x] Confirm old `v0.1.0` package remains.
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize files changed.
- [x] Report new package path.
- [x] Note any residual risks.
- **Status:** complete

## Key Questions
1. How do we avoid overwriting the existing release? Use branch `ui-light-tech-preview`, version `0.1.1`, and a new `release/chatmap-v0.1.1.zip`.
2. What should the UI feel like? Light-first, clean, elegant, minimal technology, with low visual noise and strong readability.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use a new Git branch | Keeps the existing `main` and `v0.1.0` release intact. |
| Bump to `0.1.1` | Manifest versions cannot use preview suffixes; numeric version creates a separate package file. |
| Restyle existing components instead of adding a parallel app shell | Lower risk and keeps behavior unchanged. |
| Preserve old release archives in packaging | Avoids overwriting or deleting the existing `v0.1.0` package when building `0.1.1`. |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| `ui-ux-pro-max` script/data paths are placeholder files and target paths are unavailable | 1 | Use the skill's written UI rules directly and document this in `findings.md`. |
