import { DEFAULT_HOSTED_SCENARIOS } from "./defaultScenarios";
import type { ArchivedSession, Scenario, SessionConfig } from "./types";

const SCENARIOS_KEY = "chatbotchambers-hosted-scenarios";
const SESSIONS_KEY = "chatbotchambers-hosted-sessions";
const SETTINGS_KEY = "chatbotchambers-hosted-settings";
const OPENROUTER_KEY = "chatbotchambers-openrouter-key";

function readJson<T>(key: string, fallback: T): T {
    try {
        const rawValue = window.localStorage.getItem(key);
        if (!rawValue) {
            return fallback;
        }
        return JSON.parse(rawValue) as T;
    } catch {
        return fallback;
    }
}

function writeJson(key: string, value: unknown): void {
    window.localStorage.setItem(key, JSON.stringify(value));
}

function slugifyScenarioName(name: string): string {
    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "scenario";
    const scenarios = loadStoredScenarios();
    const existingIds = new Set(scenarios.map((scenario) => scenario.id));
    let candidate = baseSlug;
    let suffix = 2;
    while (existingIds.has(candidate)) {
        candidate = `${baseSlug}-${suffix}`;
        suffix += 1;
    }
    return candidate;
}

export function loadStoredScenarios(): Scenario[] {
    const scenarios = readJson<Scenario[]>(SCENARIOS_KEY, []);
    if (scenarios.length > 0) {
        return scenarios;
    }
    writeJson(SCENARIOS_KEY, DEFAULT_HOSTED_SCENARIOS);
    return DEFAULT_HOSTED_SCENARIOS;
}

export function createStoredScenario(name: string, config: SessionConfig): Scenario {
    const scenario: Scenario = {
        id: slugifyScenarioName(name),
        name,
        shared_system_prompt: config.shared_system_prompt,
        system_prompt_a: config.chatbot_a.system_prompt,
        system_prompt_b: config.chatbot_b.system_prompt,
        config,
    };
    const scenarios = [scenario, ...loadStoredScenarios()];
    writeJson(SCENARIOS_KEY, scenarios);
    return scenario;
}

export function renameStoredScenario(scenarioId: string, name: string): Scenario | null {
    const scenarios = loadStoredScenarios();
    let renamedScenario: Scenario | null = null;
    const nextScenarios = scenarios.map((scenario) => {
        if (scenario.id !== scenarioId) {
            return scenario;
        }
        renamedScenario = { ...scenario, name };
        return renamedScenario;
    });
    if (!renamedScenario) {
        return null;
    }
    writeJson(SCENARIOS_KEY, nextScenarios);
    return renamedScenario;
}

export function deleteStoredScenario(scenarioId: string): boolean {
    const scenarios = loadStoredScenarios();
    const nextScenarios = scenarios.filter((scenario) => scenario.id !== scenarioId);
    if (nextScenarios.length === scenarios.length) {
        return false;
    }
    writeJson(SCENARIOS_KEY, nextScenarios);
    return true;
}

export function loadStoredSettings(): SessionConfig | null {
    return readJson<SessionConfig | null>(SETTINGS_KEY, null);
}

export function saveStoredSettings(settings: SessionConfig): void {
    writeJson(SETTINGS_KEY, settings);
}

export function loadStoredSessions(): ArchivedSession[] {
    return readJson<ArchivedSession[]>(SESSIONS_KEY, []);
}

export function upsertStoredSession(session: ArchivedSession): void {
    const sessions = loadStoredSessions().filter((item) => item.id !== session.id);
    writeJson(SESSIONS_KEY, [session, ...sessions]);
}

export function renameStoredSession(sessionId: string, title: string): boolean {
    const sessions = loadStoredSessions();
    let updated = false;
    const nextSessions = sessions.map((session) => {
        if (session.id !== sessionId) {
            return session;
        }
        updated = true;
        return { ...session, title };
    });
    if (!updated) {
        return false;
    }
    writeJson(SESSIONS_KEY, nextSessions);
    return true;
}

export function deleteStoredSession(sessionId: string): boolean {
    const sessions = loadStoredSessions();
    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    if (nextSessions.length === sessions.length) {
        return false;
    }
    writeJson(SESSIONS_KEY, nextSessions);
    return true;
}

export function deleteAllStoredSessions(): void {
    writeJson(SESSIONS_KEY, []);
}

export function getStoredOpenRouterKey(): string {
    return window.localStorage.getItem(OPENROUTER_KEY)?.trim() ?? "";
}

export function setStoredOpenRouterKey(apiKey: string): void {
    window.localStorage.setItem(OPENROUTER_KEY, apiKey.trim());
}
