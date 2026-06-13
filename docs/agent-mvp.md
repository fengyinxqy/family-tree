# Agent MVP

This repository now includes a first-pass backend for two genealogy agents:

## 1. Intake agent

`POST /api/agent/intake`

Request:

```json
{
  "text": "我叫王明，父亲王建国，母亲李秀兰，我有一个姐姐王丽。"
}
```

Response:

- `summary`: normalized summary of the narration
- `persons`: extracted people with `create` or `reuse` actions
- `relationships`: extracted relationships with `create` or `skip` actions
- `ambiguities`: items that still require human confirmation
- `questions`: follow-up questions for the user
- `readyToApply`: whether the draft is safe to persist

`POST /api/agent/intake/apply`

Request:

```json
{
  "draft": {}
}
```

This endpoint persists a confirmed draft into `Person` and `Relationship`.

## 2. Relationship agent

`POST /api/agent/relationship`

Request:

```json
{
  "question": "王丽和王建国是什么关系？"
}
```

Response:

- parsed names
- matched source and target persons
- inferred relationship path
- human-readable relationship explanation

## Environment

Add these variables to `.env`:

```env
AI_PROVIDER=deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
```

If you want to switch back to OpenAI later, set:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_AGENT_MODEL=gpt-5.5
```

## Current design

- The model is only used for language understanding and extraction.
- Final kinship inference is performed by deterministic TypeScript code.
- Drafts are reviewed before persistence.
- Unknown gender or ambiguous person matches block direct persistence.
