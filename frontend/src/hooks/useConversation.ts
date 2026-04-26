import { useCallback, useEffect, useRef, useState } from "react";
import { createConversationTransport, type ConversationTransport, type TransportEvent } from "../lib/transport";
import { PREAMBLE, PREAMBLE_A, PREAMBLE_B } from "../lib/conversationEngine";
import type { ArchivedSession, ChatMessage, ConversationState, SessionConfig, Status } from "../lib/types";
import {
    deleteAllSessions,
    deleteSessionById,
    listSessions,
    renameSessionById,
    saveSession,
} from "../services/sessions";

const SLUG_ADJECTIVES = [
    "aligned",
    "autoregressive",
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
    for (let index = 0; index < str.length; index += 1) {
        hash = ((hash << 5) - hash + str.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
}

export function generateSlug(id: string): string {
    const hash = hashCode(id);
    const adjective = SLUG_ADJECTIVES[hash % SLUG_ADJECTIVES.length];
    const noun = SLUG_NOUNS[(hash >>> 8) % SLUG_NOUNS.length];
    const number = (hash >>> 16) % 1000;
    return `${adjective}-${noun}-${String(number).padStart(3, "0")}`;
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

export function useConversation(): ConversationState {
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
    const messagesRef = useRef<ChatMessage[]>([]);
    const configRef = useRef<SessionConfig | null>(null);
    const currentIdRef = useRef<string | null>(null);
    const currentTitleRef = useRef<string | null>(null);
    const pendingInitialTitleRef = useRef<string | null>(null);
    const doneReasonRef = useRef<string | null>(null);
    const errorRef = useRef<string | null>(null);
    const transportRef = useRef<ConversationTransport | null>(null);

    const persistCurrentSession = useCallback(async (
        reason: string | null,
        err: string | null,
        sessionId?: string,
    ): Promise<void> => {
        const activeSessionId = sessionId ?? currentIdRef.current;
        if (!configRef.current || !activeSessionId) {
            return;
        }
        await saveSession({
            id: activeSessionId,
            title: currentTitleRef.current,
            messages: messagesRef.current,
            config: configRef.current,
            doneReason: reason,
            error: err,
        });
    }, []);

    const applySessionTitle = useCallback((id: string, title: string) => {
        if (currentIdRef.current === id) {
            currentTitleRef.current = title;
            setCurrentTitle(title);
        }
        setHistory((previousHistory) =>
            previousHistory.map((session) => (session.id === id ? { ...session, title } : session)),
        );
    }, []);

    const applyRemoteSessionTitle = useCallback(async (id: string, title: string) => {
        applySessionTitle(id, title);
        await renameSessionById(id, title);
        await persistCurrentSession(doneReasonRef.current, errorRef.current, id);
    }, [applySessionTitle, persistCurrentSession]);

    const clearConversationState = useCallback(() => {
        transportRef.current?.dispose();
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
        doneReasonRef.current = null;
        errorRef.current = null;
    }, []);

    const clearStartupError = useCallback(() => {
        setStartupError(null);
    }, []);

    const handleStartupFailure = useCallback(async (message: string) => {
        const failedSessionId = currentIdRef.current;
        transportRef.current?.dispose();
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
        doneReasonRef.current = null;
        errorRef.current = null;
        if (failedSessionId) {
            setHistory((previousHistory) => previousHistory.filter((session) => session.id !== failedSessionId));
            await deleteSessionById(failedSessionId);
        }
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
        setHistory((previousHistory) => {
            const remainingSessions = previousHistory.filter((existingSession) => existingSession.id !== session.id);
            return [session, ...remainingSessions];
        });
    }, []);

    const handleTransportSessionId = useCallback((id: string) => {
        currentIdRef.current = id;
        setCurrentSessionId(id);
        void persistCurrentSession(null, null, id);
        if (pendingInitialTitleRef.current) {
            const initialSessionTitle = pendingInitialTitleRef.current;
            void applyRemoteSessionTitle(id, initialSessionTitle);
            pendingInitialTitleRef.current = null;
        }
    }, [applyRemoteSessionTitle, persistCurrentSession]);

    const handleTransportEvent = useCallback((event: TransportEvent) => {
        if (event.type === "generating") {
            setGeneratingChatbot(event.chatbot);
            setEmptyMessageError(null);
            setStatus("running");
            return;
        }
        if (event.type === "message") {
            setGeneratingChatbot(null);
            messagesRef.current = [...messagesRef.current, event.data];
            setMessages((previousMessages) => [...previousMessages, event.data]);
            setStatus("running");
            void persistCurrentSession(null, null);
            return;
        }
        if (event.type === "empty_message") {
            setGeneratingChatbot(null);
            setEmptyMessageError(event.chatbot);
            setStatus("paused");
            return;
        }
        if (event.type === "done") {
            const reason = event.reason === "leave" && event.chatbot
                ? `leave:${event.chatbot}`
                : event.reason;
            setGeneratingChatbot(null);
            setEmptyMessageError(null);
            setDoneReason(reason);
            setStatus("done");
            archive(reason, null);
            void persistCurrentSession(reason, null);
            return;
        }
        if (messagesRef.current.length === 0) {
            void handleStartupFailure(event.message);
            return;
        }
        setGeneratingChatbot(null);
        setError(event.message);
        setStatus("error");
        archive(null, event.message);
        void persistCurrentSession(null, event.message);
    }, [archive, handleStartupFailure, persistCurrentSession]);

    useEffect(() => {
        transportRef.current = createConversationTransport({
            onSessionId: handleTransportSessionId,
            onEvent: handleTransportEvent,
        });
        return () => {
            transportRef.current?.dispose();
            transportRef.current = null;
        };
    }, [handleTransportEvent, handleTransportSessionId]);

    useEffect(() => {
        void listSessions()
            .then((sessions) => {
                setHistory(sessions);
            })
            .catch((loadError) => {
                console.error("Failed to load sessions:", loadError);
            });
    }, []);

    const start = useCallback((newConfig: SessionConfig, initialTitle?: string | null) => {
        const trimmedInitialTitle = initialTitle?.trim() || null;
        const configWithPreambles: SessionConfig = {
            ...newConfig,
            preamble: PREAMBLE,
            chatbot_a: { ...newConfig.chatbot_a, preamble: PREAMBLE_A },
            chatbot_b: { ...newConfig.chatbot_b, preamble: PREAMBLE_B },
        };
        archive("stopped", null);
        transportRef.current?.dispose();
        messagesRef.current = [];
        configRef.current = configWithPreambles;
        currentIdRef.current = null;
        currentTitleRef.current = trimmedInitialTitle;
        pendingInitialTitleRef.current = trimmedInitialTitle;
        doneReasonRef.current = null;
        errorRef.current = null;
        setMessages([]);
        setGeneratingChatbot(null);
        setDoneReason(null);
        setError(null);
        setStartupError(null);
        setEmptyMessageError(null);
        setConfig(configWithPreambles);
        setCurrentSessionId(null);
        setCurrentTitle(trimmedInitialTitle);
        setStatus("running");
        transportRef.current?.start(configWithPreambles);
    }, [archive]);

    const pause = useCallback(() => {
        transportRef.current?.pause();
        setStatus("paused");
        setGeneratingChatbot(null);
    }, []);

    const resume = useCallback(() => {
        transportRef.current?.resume();
        setStatus("running");
    }, []);

    const retry = useCallback(() => {
        transportRef.current?.retry();
        setEmptyMessageError(null);
        setStatus("running");
    }, []);

    const reset = useCallback(() => {
        transportRef.current?.stop();
        archive("stopped", null);
        clearConversationState();
    }, [archive, clearConversationState]);

    const renameCurrentSession = useCallback((title: string) => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            return;
        }
        if (currentIdRef.current) {
            void applyRemoteSessionTitle(currentIdRef.current, trimmedTitle);
            return;
        }
        currentTitleRef.current = trimmedTitle;
        pendingInitialTitleRef.current = trimmedTitle;
        setCurrentTitle(trimmedTitle);
    }, [applyRemoteSessionTitle]);

    const renameSession = useCallback((id: string, title: string) => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            return;
        }
        void applyRemoteSessionTitle(id, trimmedTitle);
    }, [applyRemoteSessionTitle]);

    const deleteSession = useCallback(async (id: string) => {
        try {
            const deleted = await deleteSessionById(id);
            if (!deleted) {
                return false;
            }
            setHistory((previousHistory) => previousHistory.filter((session) => session.id !== id));
            if (currentIdRef.current === id) {
                clearConversationState();
            }
            return true;
        } catch (deleteError) {
            console.error("Delete error:", deleteError);
            return false;
        }
    }, [clearConversationState]);

    const deleteAll = useCallback(async () => {
        try {
            const deleted = await deleteAllSessions();
            if (!deleted) {
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

    useEffect(() => {
        doneReasonRef.current = doneReason;
    }, [doneReason]);

    useEffect(() => {
        errorRef.current = error;
    }, [error]);

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
        deleteAllSessions: deleteAll,
    };
}
