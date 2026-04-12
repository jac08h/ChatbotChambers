import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
    chatbot: "a" | "b";
    name: string;
    model: string;
    content: string;
    turn: number;
    thinking: string;
}

export type Provider = "openrouter" | "claude_code" | "codex";

export const DEFAULT_CHATBOT_NAMES = {
    a: "LM A",
    b: "LM B",
} as const;

const STREAM_REVEAL_INTERVAL_MS = 16;
const STREAM_REVEAL_STEP = 6;

export interface ChatbotConfig {
    name: string;
    model: string;
    system_prompt: string;
    provider: Provider;
}

export interface SessionConfig {
    chatbot_a: ChatbotConfig;
    chatbot_b: ChatbotConfig;
    shared_system_prompt: string;
}

export type Status =
    | "idle"
    | "running"
    | "paused"
    | "done"
    | "error";

export interface ArchivedSession {
    id: string;
    title: string | null;
    messages: ChatMessage[];
    config: SessionConfig;
    doneReason: string | null;
    error: string | null;
}

export interface WebSocketState {
    messages: ChatMessage[];
    draftMessage: ChatMessage | null;
    status: Status;
    generatingChatbot: "a" | "b" | null;
    doneReason: string | null;
    error: string | null;
    config: SessionConfig | null;
    currentSessionId: string | null;
    currentTitle: string | null;
    history: ArchivedSession[];
    start: (config: SessionConfig, initialTitle?: string | null) => void;
    pause: () => void;
    resume: () => void;
    reset: () => void;
    renameCurrentSession: (title: string) => void;
    renameSession: (id: string, title: string) => void;
    deleteSession: (id: string) => Promise<boolean>;
}

interface SessionResponse {
    id: string;
    title?: string | null;
    label?: string | null;
    messages: ChatMessage[];
    config: SessionConfig;
    doneReason: string | null;
    error: string | null;
}

export function getSessionSlug(id: string): string {
    return id.split("-")[0] || id;
}

export function getSessionDisplayTitle(session: Pick<ArchivedSession, "id" | "title">): string {
    return session.title ?? getSessionSlug(session.id);
}

export function getSessionPath(id: string): string {
    return `/chat/${encodeURIComponent(id)}`;
}

export function getSessionIdFromPath(pathname: string): string | null {
    const match = pathname.match(/^\/chat\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
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

export function useWebSocket(): WebSocketState {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draftMessage, setDraftMessage] = useState<ChatMessage | null>(null);
    const [status, setStatus] = useState<Status>("idle");
    const [generatingChatbot, setGeneratingChatbot] = useState<"a" | "b" | null>(null);
    const [doneReason, setDoneReason] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<SessionConfig | null>(null);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [currentTitle, setCurrentTitle] = useState<string | null>(null);
    const [history, setHistory] = useState<ArchivedSession[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const messagesRef = useRef<ChatMessage[]>([]);
    const draftMessageRef = useRef<ChatMessage | null>(null);
    const targetDraftMessageRef = useRef<ChatMessage | null>(null);
    const pendingFinalMessageRef = useRef<ChatMessage | null>(null);
    const draftRevealTimerRef = useRef<number | null>(null);
    const configRef = useRef<SessionConfig | null>(null);
    const currentIdRef = useRef<string | null>(null);
    const currentTitleRef = useRef<string | null>(null);
    const pendingInitialTitleRef = useRef<string | null>(null);
    const statusRef = useRef<Status>("idle");

    const persistSessionTitle = useCallback((id: string, title: string) => {
        fetch(`http://localhost:8001/sessions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
        }).then((r) => {
            if (!r.ok) {
                console.error("Rename failed:", r.status, r.statusText);
            }
        }).catch((renameError) => {
            console.error("Rename error:", renameError);
        });
    }, []);

    const applySessionTitle = useCallback((id: string, title: string) => {
        if (currentIdRef.current === id) {
            currentTitleRef.current = title;
            setCurrentTitle(title);
        }
        setHistory((prev) =>
            prev.map((session) => (session.id === id ? { ...session, title } : session))
        );
    }, []);

    const clearConversationState = useCallback(() => {
        wsRef.current?.close();
        wsRef.current = null;
        setMessages([]);
        setDraftMessage(null);
        setStatus("idle");
        setGeneratingChatbot(null);
        setDoneReason(null);
        setError(null);
        setConfig(null);
        setCurrentSessionId(null);
        setCurrentTitle(null);
        messagesRef.current = [];
        draftMessageRef.current = null;
        targetDraftMessageRef.current = null;
        pendingFinalMessageRef.current = null;
        if (draftRevealTimerRef.current !== null) {
            window.clearInterval(draftRevealTimerRef.current);
            draftRevealTimerRef.current = null;
        }
        configRef.current = null;
        currentIdRef.current = null;
        currentTitleRef.current = null;
        pendingInitialTitleRef.current = null;
        statusRef.current = "idle";
    }, []);

    const commitFinalMessage = useCallback((message: ChatMessage) => {
        if (draftRevealTimerRef.current !== null) {
            window.clearInterval(draftRevealTimerRef.current);
            draftRevealTimerRef.current = null;
        }
        draftMessageRef.current = null;
        targetDraftMessageRef.current = null;
        pendingFinalMessageRef.current = null;
        setDraftMessage(null);
        setGeneratingChatbot(null);
        messagesRef.current = [...messagesRef.current, message];
        setMessages((prev) => [...prev, message]);
    }, []);

    const clearDraftState = useCallback(() => {
        if (draftRevealTimerRef.current !== null) {
            window.clearInterval(draftRevealTimerRef.current);
            draftRevealTimerRef.current = null;
        }
        draftMessageRef.current = null;
        targetDraftMessageRef.current = null;
        pendingFinalMessageRef.current = null;
        setDraftMessage(null);
    }, []);

    const revealText = useCallback((current: string, target: string): string => {
        if (current === target) {
            return current;
        }
        const nextLength = Math.min(target.length, current.length + STREAM_REVEAL_STEP);
        return target.slice(0, nextLength);
    }, []);

    const sameMessage = useCallback((left: ChatMessage | null, right: ChatMessage | null): boolean => {
        if (left === null || right === null) {
            return false;
        }
        return left.chatbot === right.chatbot && left.turn === right.turn;
    }, []);

    const revealDraftStep = useCallback((targetMessage: ChatMessage): ChatMessage => {
        const existingDraft = draftMessageRef.current;
        const currentDraft: ChatMessage = sameMessage(existingDraft, targetMessage) && existingDraft !== null
            ? existingDraft
            : { ...targetMessage, content: "", thinking: "" };
        const nextDraft = {
            ...targetMessage,
            content: revealText(currentDraft.content, targetMessage.content),
            thinking: revealText(currentDraft.thinking, targetMessage.thinking),
        };
        draftMessageRef.current = nextDraft;
        setDraftMessage(nextDraft);
        return nextDraft;
    }, [revealText, sameMessage]);

    const ensureDraftReveal = useCallback(() => {
        if (draftRevealTimerRef.current !== null) {
            return;
        }
        draftRevealTimerRef.current = window.setInterval(() => {
            const targetMessage = targetDraftMessageRef.current;
            if (targetMessage === null || statusRef.current !== "running") {
                return;
            }
            const nextDraft = revealDraftStep(targetMessage);
            const isComplete = nextDraft.content === targetMessage.content
                && nextDraft.thinking === targetMessage.thinking;
            if (!isComplete) {
                return;
            }
            if (pendingFinalMessageRef.current !== null) {
                commitFinalMessage(pendingFinalMessageRef.current);
                return;
            }
            if (draftRevealTimerRef.current !== null) {
                window.clearInterval(draftRevealTimerRef.current);
                draftRevealTimerRef.current = null;
            }
        }, STREAM_REVEAL_INTERVAL_MS);
    }, [commitFinalMessage, revealDraftStep]);

    useEffect(() => {
        fetch("http://localhost:8001/sessions")
            .then((r) => r.json())
            .then((sessions: SessionResponse[]) => {
                setHistory(sessions.map(normalizeSession));
            })
            .catch((loadError) => {
                console.error("Failed to load sessions:", loadError);
            });
    }, []);

    useEffect(() => {
        return () => {
            if (draftRevealTimerRef.current !== null) {
                window.clearInterval(draftRevealTimerRef.current);
                draftRevealTimerRef.current = null;
            }
        };
    }, []);

    const archive = useCallback((reason: string | null, err: string | null) => {
        if (!configRef.current || currentIdRef.current === null) {
            return;
        }
        const session: ArchivedSession = {
            id: currentIdRef.current,
            title: currentTitleRef.current,
            messages: messagesRef.current,
            config: configRef.current,
            doneReason: reason,
            error: err,
        };
        setHistory((prev) => {
            const exists = prev.some((existingSession) => existingSession.id === session.id);
            return exists ? prev : [session, ...prev];
        });
    }, []);

    const start = useCallback((newConfig: SessionConfig, initialTitle?: string | null) => {
        const trimmedInitialTitle = initialTitle?.trim() || null;
        archive("stopped", null);
        wsRef.current?.close();
        messagesRef.current = [];
        configRef.current = newConfig;
        currentIdRef.current = null;
        currentTitleRef.current = trimmedInitialTitle;
        pendingInitialTitleRef.current = trimmedInitialTitle;
        setMessages([]);
        setDraftMessage(null);
        setGeneratingChatbot(null);
        setDoneReason(null);
        setError(null);
        setConfig(newConfig);
        setCurrentSessionId(null);
        setCurrentTitle(trimmedInitialTitle);
        clearDraftState();
        statusRef.current = "idle";
        const ws = new WebSocket("ws://localhost:8001/ws");
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "start", config: newConfig }));
            setStatus("running");
            statusRef.current = "running";
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "session_id") {
                currentIdRef.current = data.id;
                setCurrentSessionId(data.id);
                if (pendingInitialTitleRef.current) {
                    const initialSessionTitle = pendingInitialTitleRef.current;
                    applySessionTitle(data.id, initialSessionTitle);
                    persistSessionTitle(data.id, initialSessionTitle);
                    pendingInitialTitleRef.current = null;
                }
            } else if (data.type === "generating") {
                setGeneratingChatbot(data.chatbot);
                clearDraftState();
            } else if (data.type === "stream") {
                if (statusRef.current === "paused") {
                    return;
                }
                pendingFinalMessageRef.current = null;
                targetDraftMessageRef.current = data.data;
                const nextDraft = revealDraftStep(data.data);
                if (nextDraft.content !== data.data.content || nextDraft.thinking !== data.data.thinking) {
                    ensureDraftReveal();
                }
            } else if (data.type === "message") {
                pendingFinalMessageRef.current = data.data;
                targetDraftMessageRef.current = data.data;
                const nextDraft = revealDraftStep(data.data);
                const isComplete = nextDraft.content === data.data.content
                    && nextDraft.thinking === data.data.thinking;
                if (isComplete) {
                    commitFinalMessage(data.data);
                } else {
                    ensureDraftReveal();
                }
            } else if (data.type === "done") {
                if (pendingFinalMessageRef.current !== null) {
                    commitFinalMessage(pendingFinalMessageRef.current);
                }
                setGeneratingChatbot(null);
                clearDraftState();
                const reason = data.reason === "leave" && data.chatbot
                    ? `leave:${data.chatbot}`
                    : data.reason;
                setDoneReason(reason);
                setStatus("done");
                statusRef.current = "done";
                archive(reason, null);
            } else if (data.type === "error") {
                setGeneratingChatbot(null);
                clearDraftState();
                setError(data.message);
                setStatus("error");
                statusRef.current = "error";
                archive(null, data.message);
            }
        };

        ws.onerror = () => {
            clearDraftState();
            setError("WebSocket connection error");
            setStatus("error");
            statusRef.current = "error";
            archive(null, "WebSocket connection error");
        };

        ws.onclose = () => {};
    }, [applySessionTitle, archive, clearDraftState, commitFinalMessage, ensureDraftReveal, persistSessionTitle, revealDraftStep]);

    const pause = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "pause" }));
        clearDraftState();
        setGeneratingChatbot(null);
        setStatus("paused");
        statusRef.current = "paused";
    }, [clearDraftState]);

    const resume = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "resume" }));
        setStatus("running");
        statusRef.current = "running";
    }, []);

    const reset = useCallback(() => {
        archive("stopped", null);
        clearConversationState();
    }, [archive, clearConversationState]);

    const renameCurrentSession = useCallback((title: string) => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            return;
        }
        if (currentIdRef.current) {
            applySessionTitle(currentIdRef.current, trimmedTitle);
            persistSessionTitle(currentIdRef.current, trimmedTitle);
            return;
        }
        currentTitleRef.current = trimmedTitle;
        pendingInitialTitleRef.current = trimmedTitle;
        setCurrentTitle(trimmedTitle);
    }, [applySessionTitle, persistSessionTitle]);

    const renameSession = useCallback((id: string, title: string) => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            return;
        }
        applySessionTitle(id, trimmedTitle);
        persistSessionTitle(id, trimmedTitle);
    }, [applySessionTitle, persistSessionTitle]);

    const deleteSession = useCallback(async (id: string) => {
        try {
            const response = await fetch(`http://localhost:8001/sessions/${id}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                console.error("Delete failed:", response.status, response.statusText);
                return false;
            }
            setHistory((prev) => prev.filter((session) => session.id !== id));
            if (currentIdRef.current === id) {
                clearConversationState();
            }
            return true;
        } catch (deleteError) {
            console.error("Delete error:", deleteError);
            return false;
        }
    }, [clearConversationState]);

    return {
        messages,
        draftMessage,
        status,
        generatingChatbot,
        doneReason,
        error,
        config,
        currentSessionId,
        currentTitle,
        history,
        start,
        pause,
        resume,
        reset,
        renameCurrentSession,
        renameSession,
        deleteSession,
    };
}
