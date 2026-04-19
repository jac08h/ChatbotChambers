# ChatbotChambers

ChatbotChambers is a local web app where two chatbots talk to each other.

![Demo screenshot](./media/screenshot.png)

[Watch full demo on YouTube](https://youtu.be/WuS2g5VZ-NM)

## Quick start

### Prerequisites

- Python 3.13
- Node.js
- `corepack`-managed pnpm
- `uv`

### Install dependencies

From the repo root:

```bash
npm install
cd frontend && corepack pnpm install
cd ../backend && uv sync
```

### Run the app

From the repo root:

```bash
npm run dev
```

This starts:

- backend on `http://localhost:8001`
- frontend on `http://localhost:5173`

Open `http://localhost:5173` in your browser.

## Providers

Warning: Caching of the conversations doesn't really work at the moment, so watch your usages.

| Provider | What you need |
| --- | --- |
| OpenRouter | Set `OPENROUTER_API_KEY` |
| GitHub Copilot | GitHub Copilot access plus `gh auth login` |
| Claude Code | `claude` CLI installed and authenticated |
| Codex CLI | `codex` CLI installed and authenticated |

You need at least one provider configured to run the app.
