import { apiUrl } from "../api";
import { isHostedMode } from "../lib/deployment";
import {
    createStoredScenario,
    deleteStoredScenario,
    loadStoredScenarios,
    renameStoredScenario,
} from "../lib/storage";
import type { Scenario, SessionConfig } from "../lib/types";

export async function listScenarios(): Promise<Scenario[]> {
    if (isHostedMode) {
        return loadStoredScenarios();
    }
    const response = await fetch(apiUrl("/scenarios"));
    if (!response.ok) {
        throw new Error("Failed to load scenarios");
    }
    return response.json();
}

export async function createScenario(name: string, config: SessionConfig): Promise<Scenario> {
    if (isHostedMode) {
        return createStoredScenario(name, config);
    }
    const response = await fetch(apiUrl("/scenarios"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, config }),
    });
    if (!response.ok) {
        throw new Error("Failed to save scenario");
    }
    return response.json();
}

export async function renameScenario(scenarioId: string, name: string): Promise<Scenario> {
    if (isHostedMode) {
        const scenario = renameStoredScenario(scenarioId, name);
        if (!scenario) {
            throw new Error("Scenario not found");
        }
        return scenario;
    }
    const response = await fetch(apiUrl(`/scenarios/${scenarioId}`), {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        throw new Error("Failed to rename scenario");
    }
    return response.json();
}

export async function removeScenario(scenarioId: string): Promise<void> {
    if (isHostedMode) {
        if (!deleteStoredScenario(scenarioId)) {
            throw new Error("Scenario not found");
        }
        return;
    }
    const response = await fetch(apiUrl(`/scenarios/${scenarioId}`), {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new Error("Failed to delete scenario");
    }
}
