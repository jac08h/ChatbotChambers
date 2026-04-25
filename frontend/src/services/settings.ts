import { apiUrl } from "../api";
import { isHostedMode } from "../lib/deployment";
import { loadStoredSettings, saveStoredSettings } from "../lib/storage";
import type { SessionConfig } from "../lib/types";

export async function loadSettings(): Promise<SessionConfig | null> {
    if (isHostedMode) {
        return loadStoredSettings();
    }
    const response = await fetch(apiUrl("/settings"));
    if (!response.ok) {
        throw new Error(`Failed to load settings (${response.status} ${response.statusText})`);
    }
    const data = await response.json();
    return Object.keys(data).length === 0 ? null : data;
}

export async function saveSettings(settings: SessionConfig): Promise<void> {
    if (isHostedMode) {
        saveStoredSettings(settings);
        return;
    }
    const response = await fetch(apiUrl("/settings"), {
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
