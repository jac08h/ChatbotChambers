import type { SessionConfig } from "./hooks/useWebSocket";

export type Settings = SessionConfig;

const SETTINGS_URL = "http://localhost:8001/settings";

export async function loadSettings(): Promise<Partial<Settings>> {
    try {
        const response = await fetch(SETTINGS_URL);
        if (!response.ok) {
            return {};
        }
        return await response.json();
    } catch {
        return {};
    }
}

export async function saveSettings(settings: Settings): Promise<void> {
    const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
    });

    if (!response.ok) {
        throw new Error("Failed to save settings");
    }
}
