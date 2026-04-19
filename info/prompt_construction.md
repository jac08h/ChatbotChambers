# Prompt Construction

## System Prompt Layers (in order)

Built in `engine._build_system_prompt()`:

1. **PREAMBLE** (`preamble.md`) — shared base rules
2. **Individual preamble** (`preamble_a.md` or `preamble_b.md`) — bot identity
3. **Shared system prompt** — user-provided, applies to both bots
4. **Individual system prompt** — user-provided, specific to this bot

Sections joined with `"\n\n"`. Empty strings filtered out.

## Provider-Aware Prompt Delivery

System prompts are built identically for all providers, but delivered differently:

### LiteLLM providers (OpenRouter, GitHub Copilot)

The system prompt is prepended as the first message in the `messages` array. For **OpenRouter**, the system message uses the content-block structure with `cache_control` to enable prompt prefix caching:

```json
{
  "role": "system",
  "content": [
    {
      "type": "text",
      "text": "<system prompt>",
      "cache_control": {"type": "ephemeral"}
    }
  ]
}
```

For **GitHub Copilot** and other non-cacheable LiteLLM providers, the system message uses a plain string:

```json
{"role": "system", "content": "<system prompt>"}
```

### CLI providers (Claude Code, Codex)

On the **initial turn**, the full system prompt is passed via CLI flags (`--system-prompt` for Claude Code, via stdin for Codex) along with the conversation starter.

On **follow-up turns**, the CLI session is resumed using the stored session ID (`--resume <id>` for Claude Code, `codex exec resume <id>` for Codex). The system prompt is not re-sent — only the latest utterance from the other bot is passed. This avoids rebuilding and resending the full transcript on every turn.

## Provider Session State

Each bot maintains a `ProviderState` during the conversation that tracks:

- `session_id` — the provider-native session identifier (CLI providers only)
- `initialized` — whether the first turn has been sent
- `storage_path` — path to the provider-local session storage directory
- `metadata` — provider-specific data such as cache metrics

Provider states are created at conversation start and persisted into saved session JSON files. CLI provider session files are stored under `.cache/provider_sessions/<provider>/`, separate from the app's archived chat sessions under `.cache/sessions/`.
