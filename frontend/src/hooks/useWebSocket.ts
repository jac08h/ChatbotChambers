import { useCallback, useRef, useState } from "react";

export interface ChatMessage {
    chatbot: "a" | "b";
    model: string;
    content: string;
    turn: number;
}

export interface SessionConfig {
    chatbot_a: { model: string; system_prompt: string };
    chatbot_b: { model: string; system_prompt: string };
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
    start: (config: SessionConfig) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    reset: () => void;
}

export function useWebSocket(): WebSocketState {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<Status>("idle");
    const [generatingChatbot, setGeneratingChatbot] = useState<"a" | "b" | null>(null);
    const [doneReason, setDoneReason] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    const start = useCallback((config: SessionConfig) => {
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
                setDoneReason(data.reason);
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

        ws.onclose = () => {
            if (status !== "done" && status !== "error") {
                setStatus("idle");
            }
        };
    }, [status]);

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
    }, []);

    return { messages, status, generatingChatbot, doneReason, error, start, pause, resume, stop, reset };
}
