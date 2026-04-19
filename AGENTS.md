# ChatbotChambers

## Project summary

ChatbotChambers is a browser UI plus Python backend where two chatbots talk to each other while the user watches. The backend owns conversation orchestration; the frontend mainly configures, controls, and renders sessions.

## Installation and running

See `README.md` for run and testing commands.

## Repository layout

```text
.cache/                        Local state storage
.cache/provider_sessions/      CLI provider session files (Claude Code, Codex)
backend/
    app/
        main.py                FastAPI app, REST endpoints, WebSocket endpoint
        engine.py              Conversation loop
        models.py              Pydantic models and provider/model lists
        provider_state.py      Per-bot runtime state and provider cache capabilities
        prompts/               Conversation preambles
        providers/             LiteLLM, Claude Code, Codex, and mock integrations
        scenarios/             Bundled default scenarios
    tests/                     Backend test suite

frontend/
    src/
        components/            Setup form, conversation view, sidebar, dialogs
        hooks/useWebSocket.ts  Frontend conversation and session state
    e2e/                       Playwright tests
```

## Coding Conventions

- Double quotes for strings
- Four spaces for indentation
- Type hints on all functions/methods
- No inline comments
- No f-strings in logging calls
- Breadth-first function ordering (public/main functions first)
- Absolute imports from repo root
- Update AGENTS.md when a relevant part of the code changes

## Architecture Docs

See `info/prompt_construction.md` for how system prompts are built and passed to providers.

## Provider Caching

Each provider uses its native caching/session mechanism:

- **Claude Code / Codex CLI**: One provider session per bot, resumed on follow-up turns via `--resume <session_id>` / `codex exec resume <session_id>`. Session files stored under `.cache/provider_sessions/`.
- **OpenRouter (LiteLLM)**: System prompt uses content-block structure with `cache_control: {"type": "ephemeral"}` for prompt prefix caching.
- **GitHub Copilot (LiteLLM)**: Plain message format without cache control (best-effort by provider).
- **Mock**: No caching.

Provider capability metadata lives in `backend/app/provider_state.py` (`PROVIDER_CACHE_CAPABILITIES`). Per-bot runtime state (`ProviderState`) tracks session IDs, initialization status, and cache metrics.

## Branding

The ChatbotChambers wordmark uses an editorial contrast approach:
- **Chatbot**: Inter, 0.42em (relative to sidebar brand size), weight 800, uppercase, letter-spacing 0.28em
- **Chambers**: Fraunces serif, weight 700, letter-spacing -0.04em
- Both stack vertically (flex-direction: column) in the sidebar brand section
