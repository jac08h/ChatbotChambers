import { apiUrl } from "../api";
import { isHostedMode } from "../lib/deployment";
import {
    deleteAllStoredSessions,
    deleteStoredSession,
    loadStoredSessions,
    renameStoredSession,
    upsertStoredSession,
} from "../lib/storage";
import type { ArchivedSession } from "../lib/types";

interface SessionResponse extends ArchivedSession {
    label?: string | null;
}

function normalizeSession(session: SessionResponse): ArchivedSession {
    const title = session.title ?? (session.label && session.label !== session.id ? session.label : null);
    return {
        id: session.id,
        title,
        messages: session.messages,
        config: session.config,
        doneReason: session.doneReason,
        error: session.error,
    };
}

export async function listSessions(): Promise<ArchivedSession[]> {
    if (isHostedMode) {
        return loadStoredSessions();
    }
    const response = await fetch(apiUrl("/sessions"));
    if (!response.ok) {
        throw new Error("Failed to load sessions");
    }
    const sessions: SessionResponse[] = await response.json();
    return sessions.map(normalizeSession);
}

export async function saveSession(session: ArchivedSession): Promise<void> {
    if (isHostedMode) {
        upsertStoredSession(session);
    }
}

export async function renameSessionById(sessionId: string, title: string): Promise<void> {
    if (isHostedMode) {
        if (!renameStoredSession(sessionId, title)) {
            throw new Error("Session not found");
        }
        return;
    }
    const response = await fetch(apiUrl(`/sessions/${sessionId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
    });
    if (!response.ok) {
        throw new Error("Failed to rename session");
    }
}

export async function deleteSessionById(sessionId: string): Promise<boolean> {
    if (isHostedMode) {
        return deleteStoredSession(sessionId);
    }
    const response = await fetch(apiUrl(`/sessions/${sessionId}`), {
        method: "DELETE",
    });
    return response.ok;
}

export async function deleteAllSessions(): Promise<boolean> {
    if (isHostedMode) {
        deleteAllStoredSessions();
        return true;
    }
    const response = await fetch(apiUrl("/sessions"), {
        method: "DELETE",
    });
    return response.ok;
}
