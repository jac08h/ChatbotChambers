import { defineConfig } from "@playwright/test";

const BACKEND_PORT = 8001;
const FRONTEND_PORT = 5173;

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
            command: `cd ../backend && MOCK_PROVIDER=1 CHATBOTCHAMBERS_CORS_ORIGINS=http://localhost:${FRONTEND_PORT} uv run uvicorn app.main:app --port ${BACKEND_PORT}`,
            port: BACKEND_PORT,
            reuseExistingServer: true,
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
