# TurnMap QA Test Plan

## Long Conversations

- Open a conversation with 50+ turns.
- Open TurnMap from the top, middle, and bottom of the conversation.
- Confirm the turn count is stable after Refresh.
- Confirm full-page mode opens the same graph.
- Confirm search can focus an early, middle, and late node.

## Regenerated Answers

- Use a ChatGPT conversation with regenerated assistant responses.
- Confirm each visible turn maps once.
- Click nodes around regenerated content.
- Confirm jump targets the expected turn or reports a clear failure.

## Branched Conversations

- Open a conversation with branch navigation.
- Switch branches in ChatGPT.
- Refresh TurnMap.
- Confirm current branch content is represented.
- Confirm old branch nodes do not silently merge with the current branch.

## Slow Network and Partial Loading

- Open TurnMap while the conversation is still loading.
- Confirm status messages remain understandable.
- Refresh after the page finishes loading.
- Confirm deep scan recovers full visible history when API extraction is unavailable.

## Provider Failure Paths

- Save an invalid API key.
- Run Test Connection.
- Confirm a clear error appears.
- Run AI summary and AI link suggestions with invalid settings.
- Confirm existing graph data remains unchanged.

## Permissions

- Load the extension fresh.
- Confirm required permission list matches `release-readiness.md`.
- Configure a custom AI base URL.
- Confirm the browser requests optional host access before contacting that endpoint.

## Export and Restore

- Export JSON.
- Move nodes, edit labels, add tags, merge nodes.
- Import the JSON.
- Confirm positions, notes, hidden nodes, tags, statuses, and links restore.

## Residual Known Risk

- Identical repeated user prompts can still make source matching ambiguous in some cases.
- Very large maps may need performance tuning for SVG/PNG export.
