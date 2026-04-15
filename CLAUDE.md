# ChatbotChambers

Two chatbots talk to each other while the user watches. Browser UI, Python backend.

## Project Layout

```
backend/   Python 3.13 + FastAPI, managed with uv
frontend/  React + TypeScript + Vite, managed with pnpm
```

## How to Run

**Backend** (from repo root):
```bash
cd backend
export OPENROUTER_API_KEY="sk-or-..."
uv run uvicorn app.main:app --reload --port 8001
```

**Frontend** (from repo root):
```bash
cd frontend
pnpm dev   # starts on http://localhost:5173
```

## Architecture

- Backend owns all conversation logic. Frontend just displays.
- WebSockets between backend and frontend.
- Three LLM providers: `openrouter` (via OpenAI SDK), `claude_code` (CLI subprocess), `codex` (CLI subprocess). Provider modules live in `backend/app/providers/`.
- No persistence — in-memory only.
- No streaming — complete messages appear after generation.
- Thinking blocks (`<think>` tags) are stripped from OpenRouter responses before being shown or passed to the other chatbot.

## Backend Structure

```
backend/app/
    main.py        FastAPI app, WebSocket endpoint, GET /models, GET /providers, GET /presets
    engine.py      Async generator conversation loop
    models.py      Pydantic models + hardcoded model lists
    providers/
        base.py        Abstract base class for providers
        openrouter.py  OpenRouter API client, strips <think> tags
        claude_code.py Claude CLI subprocess client
        codex_cli.py   Codex CLI subprocess client
```

## WebSocket Protocol

Client → Server:
- `{"type": "start", "config": {...}}`
- `{"type": "pause"}`
- `{"type": "resume"}`
- `{"type": "stop"}`

Server → Client:
- `{"type": "generating", "chatbot": "a"|"b"}`
- `{"type": "message", "data": {...}}`
- `{"type": "done", "reason": "leave", "chatbot": "a"|"b"}`
- `{"type": "done", "reason": "stopped"|"max_turns"}`
- `{"type": "error", "message": "..."}`

## How to Test

**Backend** (from `backend/`):
```bash
uv run pytest tests/                          # all tests
uv run pytest tests/ -m "not integration"    # unit tests only
```

**Frontend unit tests** (from `frontend/`):
```bash
pnpm test
```

**Frontend e2e tests** (from `frontend/`):
```bash
pnpm install  # if not already done
pnpm test:e2e
```

E2E tests automatically start both backend (with `MOCK_PROVIDER=1`) and frontend. Use `--headed` flag to see the browser.

## Coding Conventions

- Double quotes for strings
- Four spaces for indentation
- Type hints on all functions/methods
- No inline comments
- No f-strings in logging calls
- Breadth-first function ordering (public/main functions first)
- Absolute imports from repo root
