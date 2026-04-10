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
}

export type Status =
    | "idle"
    | "running"
    | "paused"
    | "done"
    | "error";

export interface ArchivedSession {
    id: number;
    label: string;
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
    config: SessionConfig | null;
    history: ArchivedSession[];
    start: (config: SessionConfig) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    reset: () => void;
}

const LABEL_MAX_LENGTH = 40;

function buildLabel(messages: ChatMessage[], id: number): string {
    const first = messages[0]?.content?.trim();
    if (!first) {
        return `Conversation ${id}`;
    }
    return first.length > LABEL_MAX_LENGTH
        ? `${first.slice(0, LABEL_MAX_LENGTH)}...`
        : first;
}

export function useWebSocket(): WebSocketState {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<Status>("idle");
    const [generatingChatbot, setGeneratingChatbot] = useState<"a" | "b" | null>(null);
    const [doneReason, setDoneReason] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<SessionConfig | null>(null);
    const [history, setHistory] = useState<ArchivedSession[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const messagesRef = useRef<ChatMessage[]>([]);
    const configRef = useRef<SessionConfig | null>(null);
    const nextIdRef = useRef(1);

    const archive = useCallback((doneReason: string | null, error: string | null) => {
        if (!configRef.current) {
            return;
        }
        const id = nextIdRef.current++;
        const session: ArchivedSession = {
            id,
            label: buildLabel(messagesRef.current, id),
            messages: messagesRef.current,
            config: configRef.current,
            doneReason,
            error,
        };
        setHistory((prev) => [session, ...prev]);
    }, []);

    const start = useCallback((newConfig: SessionConfig) => {
        wsRef.current?.close();
        messagesRef.current = [];
        configRef.current = newConfig;
        setMessages([]);
        setGeneratingChatbot(null);
        setDoneReason(null);
        setError(null);
        setConfig(newConfig);
        const ws = new WebSocket("ws://localhost:8001/ws");
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: "start", config: newConfig }));
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
                archive(reason, null);
            } else if (data.type === "error") {
                setGeneratingChatbot(null);
                setError(data.message);
                setStatus("error");
                archive(null, data.message);
            }
        };

        ws.onerror = () => {
            setError("WebSocket connection error");
            setStatus("error");
            archive(null, "WebSocket connection error");
        };

        ws.onclose = () => {};
    }, [archive]);

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
        history,
        start,
        pause,
        resume,
        stop,
        reset,
    };
}
