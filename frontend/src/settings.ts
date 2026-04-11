import type { SessionConfig } from "./hooks/useWebSocket";

const SETTINGS_URL = "http://localhost:8001/settings";

export async function loadSettings(): Promise<SessionConfig | null> {
    const response = await fetch(SETTINGS_URL);
    const data = await response.json();
    return Object.keys(data).length === 0 ? null : data;
}

export async function saveSettings(settings: SessionConfig): Promise<void> {
    await fetch(SETTINGS_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
    });
}
