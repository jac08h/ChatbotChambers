# ChatbotChambers

## Project summary

ChatbotChambers is a browser UI plus Python backend where two chatbots talk to each other while the user watches. The backend owns conversation orchestration; the frontend mainly configures, controls, and renders sessions.
The backend may also track provider-side CLI session IDs per chatbot; those are internal to the provider integration and separate from the app session ID exposed to the frontend.

## Installation and running

See `README.md` for run and testing commands.

## Repository layout

```text
.cache/                        Local state storage
backend/
    app/
        main.py                FastAPI app, REST endpoints, WebSocket endpoint
        engine.py              Conversation loop
        models.py              Pydantic models and provider/model lists
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

## Branding

The ChatbotChambers wordmark uses an editorial contrast approach:
- **Chatbot**: Inter, 0.42em (relative to sidebar brand size), weight 800, uppercase, letter-spacing 0.28em
- **Chambers**: Fraunces serif, weight 700, letter-spacing -0.04em
- Both stack vertically (flex-direction: column) in the sidebar brand section
