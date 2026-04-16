import { defineConfig } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_PORT = 8001;
const FRONTEND_PORT = 5173;
const E2E_CACHE_DIR = path.resolve(__dirname, ".e2e-cache");

function ensureCleanDir(dir: string): void {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
    }
    fs.mkdirSync(dir, { recursive: true });
}

ensureCleanDir(E2E_CACHE_DIR);

const envVars = [
    `MOCK_PROVIDER=1`,
    `CHATBOTCHAMBERS_CORS_ORIGINS=http://localhost:${FRONTEND_PORT}`,
    `LMPARLOR_PRESETS_DIR=${path.join(E2E_CACHE_DIR, "presets")}`,
    `LMPARLOR_SETTINGS_PATH=${path.join(E2E_CACHE_DIR, "settings.json")}`,
    `LMPARLOR_SESSIONS_DIR=${path.join(E2E_CACHE_DIR, "sessions")}`,
].join(" ");

export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    retries: 0,
    workers: 1,
    use: {
        baseURL: `http://localhost:${FRONTEND_PORT}`,
        headless: true,
    },
    projects: [
        {
            name: "chromium",
            use: { browserName: "chromium" },
        },
    ],
    webServer: [
        {
            command: `cd ../backend && ${envVars} uv run uvicorn app.main:app --port ${BACKEND_PORT}`,
            port: BACKEND_PORT,
            reuseExistingServer: false,
            timeout: 30_000,
        },
        {
            command: "npx vite",
            port: FRONTEND_PORT,
            reuseExistingServer: true,
            timeout: 30_000,
        },
    ],
});
