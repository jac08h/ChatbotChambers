import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl, webSocketUrl } from "../api";

export interface ChatMessage {
    chatbot: "a" | "b";
    name: string;
    model: string;
    model_name?: string;
    content: string;
    turn: number;
    thinking: string;
}

export type Provider = "openrouter" | "github_copilot" | "claude_code" | "codex" | "mock";

export const DEFAULT_CHATBOT_NAMES = {
    a: "",
    b: "",
} as const;

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
    status: Status;
    generatingChatbot: "a" | "b" | null;
    doneReason: string | null;
    error: string | null;
    startupError: string | null;
    emptyMessageError: "a" | "b" | null;
    config: SessionConfig | null;
    currentSessionId: string | null;
    currentTitle: string | null;
    history: ArchivedSession[];
    start: (config: SessionConfig, initialTitle?: string | null) => void;
    pause: () => void;
    resume: () => void;
    retry: () => void;
    reset: () => void;
    clearStartupError: () => void;
    renameCurrentSession: (title: string) => void;
    renameSession: (id: string, title: string) => void;
    deleteSession: (id: string) => Promise<boolean>;
    deleteAllSessions: () => Promise<boolean>;
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

const SLUG_ADJECTIVES = [
    "aligned",
    "autoregessive",
    "babbling",
    "bootstrapped",
    "calibrated",
    "chatty",
    "concise",
    "curious",
    "cryptic",
    "dense",
    "deterministic",
    "dreaming",
    "emergent",
    "glitchy",
    "hallucinating",
    "introspective",
    "jailbroken",
    "latent",
    "lucid",
    "misaligned",
    "modulated",
    "musing",
    "nondeterministic",
    "noisy",
    "pondering",
    "probabilistic",
    "probing",
    "quantized",
    "rambling",
    "recursive",
    "reflective",
    "stochastic",
    "whispering",
];

const SLUG_NOUNS = [
    "agents",
    "apparitions",
    "avatars",
    "automations",
    "chatbots",
    "concierges",
    "daemons",
    "echoes",
    "epistles",
    "ghosts",
    "golems",
    "heuristics",
    "hiveminds",
    "intelligences",
    "interpreters",
    "interlocutors",
    "mimics",
    "mirrors",
    "models",
    "narrators",
    "oracles",
    "parrots",
    "phantoms",
    "philosophers",
    "predictors",
    "scribes",
    "simulacra",
    "singularities",
    "sophists",
    "synthesizers",
    "transformers",
    "validators",
];

function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

export function generateSlug(id: string): string {
    const h = hashCode(id);
    const adj = SLUG_ADJECTIVES[h % SLUG_ADJECTIVES.length];
    const noun = SLUG_NOUNS[(h >>> 8) % SLUG_NOUNS.length];
    const num = (h >>> 16) % 1000;
    return `${adj}-${noun}-${String(num).padStart(3, "0")}`;
}

export function getSessionDisplayTitle(session: Pick<ArchivedSession, "id" | "title">): string {
    return session.title ?? generateSlug(session.id);
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
    const [status, setStatus] = useState<Status>("idle");
    const [generatingChatbot, setGeneratingChatbot] = useState<"a" | "b" | null>(null);
    const [doneReason, setDoneReason] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [startupError, setStartupError] = useState<string | null>(null);
    const [emptyMessageError, setEmptyMessageError] = useState<"a" | "b" | null>(null);
    const [config, setConfig] = useState<SessionConfig | null>(null);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [currentTitle, setCurrentTitle] = useState<string | null>(null);
    const [history, setHistory] = useState<ArchivedSession[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const messagesRef = useRef<ChatMessage[]>([]);
    const configRef = useRef<SessionConfig | null>(null);
    const currentIdRef = useRef<string | null>(null);
    const currentTitleRef = useRef<string | null>(null);
    const pendingInitialTitleRef = useRef<string | null>(null);

    const persistSessionTitle = useCallback((id: string, title: string) => {
        fetch(apiUrl(`/sessions/${id}`), {
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
        setStatus("idle");
        setGeneratingChatbot(null);
        setDoneReason(null);
        setError(null);
        setStartupError(null);
        setEmptyMessageError(null);
        setConfig(null);
        setCurrentSessionId(null);
        setCurrentTitle(null);
        messagesRef.current = [];
        configRef.current = null;
        currentIdRef.current = null;
        currentTitleRef.current = null;
        pendingInitialTitleRef.current = null;
    }, []);

    const clearStartupError = useCallback(() => {
        setStartupError(null);
    }, []);

    const discardFailedSession = useCallback((sessionId: string): void => {
        fetch(apiUrl(`/sessions/${sessionId}`), {
            method: "DELETE",
        }).then((response) => {
            if (!response.ok && response.status !== 404) {
                console.error("Failed to discard session:", response.status, response.statusText);
            }
        }).catch((discardError) => {
            console.error("Discard session error:", discardError);
        });
    }, []);

    const handleStartupFailure = useCallback((message: string) => {
        const failedSessionId = currentIdRef.current;
        wsRef.current?.close();
        wsRef.current = null;
        setMessages([]);
        setStatus("idle");
        setGeneratingChatbot(null);
        setDoneReason(null);
        setError(null);
        setStartupError(message);
        setEmptyMessageError(null);
        setConfig(null);
        setCurrentSessionId(null);
        setCurrentTitle(null);
        messagesRef.current = [];
        configRef.current = null;
        currentIdRef.current = null;
        currentTitleRef.current = null;
        pendingInitialTitleRef.current = null;
        if (failedSessionId) {
            setHistory((prev) => prev.filter((session) => session.id !== failedSessionId));
            discardFailedSession(failedSessionId);
        }
    }, [discardFailedSession]);

    useEffect(() => {
        fetch(apiUrl("/sessions"))
            .then((r) => r.json())
            .then((sessions: SessionResponse[]) => {
                setHistory(sessions.map(normalizeSession));
            })
            .catch((loadError) => {
                console.error("Failed to load sessions:", loadError);
            });
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
        setGeneratingChatbot(null);
        setDoneReason(null);
        setError(null);
        setStartupError(null);
        setEmptyMessageError(null);
        setConfig(newConfig);
        setCurrentSessionId(null);
        setCurrentTitle(trimmedInitialTitle);
        const ws = new WebSocket(webSocketUrl("/ws"));
        wsRef.current = ws;

        ws.onopen = () => {
            console.info("[WS] Connection opened, sending start");
            ws.send(JSON.stringify({ type: "start", config: newConfig }));
            setStatus("running");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "session_id") {
                console.info("[WS] Session assigned:", data.id);
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
                setEmptyMessageError(null);
            } else if (data.type === "message") {
                setGeneratingChatbot(null);
                messagesRef.current = [...messagesRef.current, data.data];
                setMessages((prev) => [...prev, data.data]);
            } else if (data.type === "empty_message") {
                setGeneratingChatbot(null);
                setEmptyMessageError(data.chatbot);
                setStatus("paused");
            } else if (data.type === "done") {
                const reason = data.reason === "leave" && data.chatbot
                    ? `leave:${data.chatbot}`
                    : data.reason;
                console.info("[WS] Conversation done:", reason);
                setGeneratingChatbot(null);
                setEmptyMessageError(null);
                setDoneReason(reason);
                setStatus("done");
                archive(reason, null);
            } else if (data.type === "error") {
                console.warn("[WS] Error received:", data.message);
                if (messagesRef.current.length === 0) {
                    handleStartupFailure(data.message);
                    return;
                }
                setGeneratingChatbot(null);
                setError(data.message);
                setStatus("error");
                archive(null, data.message);
            }
        };

        ws.onerror = () => {
            console.warn("[WS] Connection error");
            if (messagesRef.current.length === 0) {
                handleStartupFailure("WebSocket connection error");
                return;
            }
            setError("WebSocket connection error");
            setStatus("error");
            archive(null, "WebSocket connection error");
        };

        ws.onclose = () => {
            console.debug("[WS] Connection closed");
        };
    }, [applySessionTitle, archive, handleStartupFailure, persistSessionTitle]);

    const pause = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "pause" }));
        setStatus("paused");
        setGeneratingChatbot(null);
    }, []);

    const resume = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "resume" }));
        setStatus("running");
    }, []);

    const retry = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "retry" }));
        setEmptyMessageError(null);
        setStatus("running");
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
            const response = await fetch(apiUrl(`/sessions/${id}`), {
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

    const deleteAllSessions = useCallback(async () => {
        try {
            const response = await fetch(apiUrl("/sessions"), {
                method: "DELETE",
            });
            if (!response.ok) {
                console.error("Delete all failed:", response.status, response.statusText);
                return false;
            }
            setHistory([]);
            clearConversationState();
            return true;
        } catch (deleteError) {
            console.error("Delete all error:", deleteError);
            return false;
        }
    }, [clearConversationState]);

    return {
        messages,
        status,
        generatingChatbot,
        doneReason,
        error,
        startupError,
        emptyMessageError,
        config,
        currentSessionId,
        currentTitle,
        history,
        start,
        pause,
        resume,
        retry,
        reset,
        clearStartupError,
        renameCurrentSession,
        renameSession,
        deleteSession,
        deleteAllSessions,
    };
}
