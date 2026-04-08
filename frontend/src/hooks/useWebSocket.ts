import { useCallback, useRef, useState } from "react";

export interface ChatMessage {
    chatbot: "a" | "b" | "user";
    name: string;
    model: string;
    content: string;
    turn: number;
    thinking: string;
}

export type Provider = "openrouter" | "claude_code" | "codex";

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
    sendUserMessage: (content: string) => void;
    stop: () => void;
    reset: () => void;
}

export function useWebSocket(): WebSocketState {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<Status>("idle");
    const [generatingChatbot, setGeneratingChatbot] = useState<"a" | "b" | null>(null);
    const [doneReason, setDoneReason] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<SessionConfig | null>(null);
    const [sessionId, setSessionId] = useState(0);
    const wsRef = useRef<WebSocket | null>(null);
    const nextSessionIdRef = useRef(0);

    const start = useCallback((config: SessionConfig) => {
        wsRef.current?.close();
        nextSessionIdRef.current += 1;
        setMessages([]);
        setGeneratingChatbot(null);
        setDoneReason(null);
        setError(null);
        setConfig(config);
        setSessionId(nextSessionIdRef.current);
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
                setMessages((prev) => [...prev, data.data]);
            } else if (data.type === "done") {
                setGeneratingChatbot(null);
                const reason = data.reason === "leave" && data.chatbot
                    ? `leave:${data.chatbot}`
                    : data.reason;
                setDoneReason(reason);
                setStatus("done");
            } else if (data.type === "error") {
                setGeneratingChatbot(null);
                setError(data.message);
                setStatus("error");
            }
        };

        ws.onerror = () => {
            setError("WebSocket connection error");
            setStatus("error");
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

    const sendUserMessage = useCallback((content: string) => {
        wsRef.current?.send(JSON.stringify({ type: "user_message", content }));
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
        sendUserMessage,
        stop,
        reset,
    };
}
