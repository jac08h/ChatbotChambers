import type { SessionConfig } from "./hooks/useWebSocket";
import { apiUrl } from "./api";

const SETTINGS_URL = apiUrl("/settings");

export async function loadSettings(): Promise<SessionConfig | null> {
    const response = await fetch(SETTINGS_URL);
    if (!response.ok) {
        throw new Error(`Failed to load settings (${response.status} ${response.statusText})`);
    }
    const data = await response.json();
    return Object.keys(data).length === 0 ? null : data;
}

export async function saveSettings(settings: SessionConfig): Promise<void> {
    const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
    });
    if (!response.ok) {
        throw new Error(`Failed to save settings (${response.status} ${response.statusText})`);
    }
}
