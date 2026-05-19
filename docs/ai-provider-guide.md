# TurnMap AI Provider Guide

TurnMap uses an OpenAI-compatible Chat Completions API.

## Required Endpoint

TurnMap sends requests to:

```text
<baseUrl>/chat/completions
```

The provider should accept:

```json
{
  "model": "model-name",
  "temperature": 0.1,
  "max_tokens": 1200,
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

For JSON-producing tasks, TurnMap may also send:

```json
{
  "response_format": { "type": "json_object" }
}
```

If a provider rejects `response_format`, TurnMap retries without it.

`max_tokens` is always included in AI requests. The default is 1200 and can be
increased in Settings. TurnMap also applies task-level minimums so reasoning
models have enough output budget left after their internal thinking:

- Test Connection: at least 256
- Summarize: at least 900
- Suggest Links: at least 1800
- AI UI translation: at least 5000

## Expected Response

Preferred response shape:

```json
{
  "choices": [
    {
      "message": {
        "content": "{\"title\":\"...\",\"summary\":\"...\"}"
      }
    }
  ]
}
```

TurnMap can also read a wide range of compatible response shapes, but
`choices[0].message.content` is recommended.

Accepted response sources include:

- OpenAI Chat Completions: `choices[].message.content`
- Stream-like chunks returned as text/event-stream `data:` lines
- OpenAI Responses-style text: `output_text` and `output[].content[].text`
- Plain text bodies
- Direct task JSON bodies, such as `{ "title": "...", "summary": "..." }`
- Content arrays, such as `content: [{ "type": "text", "text": "..." }]`
- Tool/function arguments: `message.function_call.arguments` and `message.tool_calls[].function.arguments`
- Common proxy/local fields: `text`, `response`, `message.content`, and `candidates[].content.parts[].text`

Empty strings are ignored. If `response_format` produces an empty or unreadable
body, TurnMap retries once without `response_format`.

## Summarize Output

The model should return strict JSON:

```json
{
  "title": "short specific title",
  "summary": "2-3 sentence concise summary"
}
```

## Suggest Links Output

The model should return:

```json
{
  "edges": [
    {
      "source": "node-id",
      "target": "node-id",
      "relationship": "extends",
      "label": "short label",
      "important": false,
      "confidence": 0.86,
      "reason": "short reason"
    }
  ]
}
```

Supported relationships:

- `related`
- `depends_on`
- `extends`
- `supports`
- `contradicts`
- `duplicates`
- `references`
- `todo`

## Provider Notes

- OpenAI: use a model that reliably follows JSON instructions.
- DeepSeek: prefer `deepseek-chat` for structured output.
- Custom providers: ensure CORS, host permissions, and response shape are compatible.

## Privacy

AI features send selected node and conversation text to the provider configured by the user. API keys are stored locally in the browser extension profile.
