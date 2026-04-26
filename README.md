# ChatbotChambers

ChatbotChambers is a web app where two chatbots talk to each other while you watch.

It runs in two modes:

- **Local**: FastAPI + WebSocket backend. Supports OpenRouter, GitHub Copilot, Claude Code CLI, and Codex CLI.
- **Hosted** (Vercel): browser-side conversation loop, OpenRouter only with a user-supplied API key.

[Screenshot](./media/screenshot.png) · [Demo on YouTube](https://youtu.be/WuS2g5VZ-NM)

## Run locally

Prerequisites: Python 3.13, Node.js, `corepack`-managed pnpm, `uv`.

Install:

```bash
cd frontend && corepack pnpm install
cd ../backend && uv sync
```

Start (from repo root):

```bash
npm run dev
```

Backend runs on `http://localhost:8001`, frontend on `http://localhost:5173`.

You need at least one provider configured:

| Provider | Local requirement |
| --- | --- |
| OpenRouter | Set `OPENROUTER_API_KEY` |
| GitHub Copilot | GitHub Copilot access plus `gh auth login` |
| Claude Code | `claude` CLI installed and authenticated |
| Codex CLI | `codex` CLI installed and authenticated |

### Validation

```bash
cd backend && python3 -m uv run pytest tests/ -m "not integration"
cd ../frontend && corepack pnpm lint && corepack pnpm build && corepack pnpm test
cd ../frontend && npx playwright test
```

## Hosted deploy (Vercel)

1. Import the repo into Vercel, keep the repo root as project root.
2. Set `VITE_DEPLOYMENT_MODE=hosted`.
3. Optional: `CHATBOTCHAMBERS_ALLOWED_ORIGINS=https://your-domain.example` for custom domains.
4. Deploy, then paste an OpenRouter key (`sk-or-v1-...`) via **Set API key** in the UI.

The key is sent only to the same-origin `/api/turn` function and is never stored server-side. Scenarios, settings, sessions, and the key live in browser storage.
