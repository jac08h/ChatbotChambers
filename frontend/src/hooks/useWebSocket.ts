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
    max_turns: number;
}

export type Status =
    | "idle"
    | "running"
    | "paused"
    | "done"
    | "error";

export interface WebSocketState {
    messages: ChatMessage[];
    status: Status;
    generatingChatbot: "a" | "b" | null;
    doneReason: string | null;
    error: string | null;
    config: SessionConfig | null;
    sessionId: number;
    start: (config: SessionConfig) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    reset: () => void;
}

export interface ArchivedSession {
    id: number;
    messages: ChatMessage[];
    config: SessionConfig;
    doneReason: string | null;
    error: string | null;
}

interface UseWebSocketOptions {
    onSessionArchived?: (session: ArchivedSession) => void;
}

export function useWebSocket(options?: UseWebSocketOptions): WebSocketState {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<Status>("idle");
    const [generatingChatbot, setGeneratingChatbot] = useState<"a" | "b" | null>(null);
    const [doneReason, setDoneReason] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<SessionConfig | null>(null);
    const [sessionId, setSessionId] = useState(0);
    const wsRef = useRef<WebSocket | null>(null);
    const messagesRef = useRef<ChatMessage[]>([]);
    const configRef = useRef<SessionConfig | null>(null);
    const sessionIdRef = useRef(0);
    const onSessionArchivedRef = useRef(options?.onSessionArchived);

    useEffect(() => {
        onSessionArchivedRef.current = options?.onSessionArchived;
    }, [options]);

    const start = useCallback((config: SessionConfig) => {
        wsRef.current?.close();
        sessionIdRef.current += 1;
        messagesRef.current = [];
        configRef.current = config;
        setMessages([]);
        setGeneratingChatbot(null);
        setDoneReason(null);
        setError(null);
        setConfig(config);
        setSessionId(sessionIdRef.current);
        const ws = new WebSocket("ws://localhost:8001/ws");
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "start", config }));
            setStatus("running");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "generating") {
                setGeneratingChatbot(data.chatbot);
            } else if (data.type === "message") {
                setGeneratingChatbot(null);
                messagesRef.current = [...messagesRef.current, data.data];
                setMessages((prev) => [...prev, data.data]);
            } else if (data.type === "done") {
                setGeneratingChatbot(null);
                const reason = data.reason === "leave" && data.chatbot
                    ? `leave:${data.chatbot}`
                    : data.reason;
                setDoneReason(reason);
                setStatus("done");
                if (configRef.current) {
                    onSessionArchivedRef.current?.({
                        id: sessionIdRef.current,
                        messages: messagesRef.current,
                        config: configRef.current,
                        doneReason: reason,
                        error: null,
                    });
                }
            } else if (data.type === "error") {
                setGeneratingChatbot(null);
                setError(data.message);
                setStatus("error");
                if (configRef.current) {
                    onSessionArchivedRef.current?.({
                        id: sessionIdRef.current,
                        messages: messagesRef.current,
                        config: configRef.current,
                        doneReason: null,
                        error: data.message,
                    });
                }
            }
        };

        ws.onerror = () => {
            setError("WebSocket connection error");
            setStatus("error");
            if (configRef.current) {
                onSessionArchivedRef.current?.({
                    id: sessionIdRef.current,
                    messages: messagesRef.current,
                    config: configRef.current,
                    doneReason: null,
                    error: "WebSocket connection error",
                });
            }
        };

        ws.onclose = () => {};
    }, []);

    const pause = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "pause" }));
        setStatus("paused");
    }, []);

    const resume = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "resume" }));
        setStatus("running");
    }, []);

    const stop = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: "stop" }));
    }, []);

    const reset = useCallback(() => {
        wsRef.current?.close();
        wsRef.current = null;
        setMessages([]);
        setStatus("idle");
        setGeneratingChatbot(null);
        setDoneReason(null);
        setError(null);
        setConfig(null);
        messagesRef.current = [];
        configRef.current = null;
    }, []);

    return {
        messages,
        status,
        generatingChatbot,
        doneReason,
        error,
        config,
        sessionId,
        start,
        pause,
        resume,
        stop,
        reset,
    };
}
