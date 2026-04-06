import { useEffect, useRef } from "react";
import type { ChatMessage, Status, WebSocketState } from "../hooks/useWebSocket";

interface ConversationViewProps {
    ws: WebSocketState;
}

function doneLabel(reason: string): string {
    if (reason === "leave:a") return "Guest A has left the parlor.";
    if (reason === "leave:b") return "Guest B has left the parlor.";
    if (reason === "stopped") return "The conversation was brought to a close.";
    if (reason === "max_turns") return "The evening's discourse has concluded.";
    return "The conversation has ended.";
}

export function ConversationView({ ws }: ConversationViewProps) {
    const { messages, status, generatingChatbot, doneReason, error } = ws;
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, generatingChatbot]);

    return (
        <div className="conversation-container">
            <div className="conversation-header">
                <span className="header-title">LM Parlor</span>
                <span className="status-badge" data-status={status}>
                    {statusLabel(status)}
                </span>
                <div className="controls">
                    {status === "running" && (
                        <button onClick={ws.pause}>Pause</button>
                    )}
                    {status === "paused" && (
                        <button onClick={ws.resume}>Resume</button>
                    )}
                    {(status === "running" || status === "paused") && (
                        <button onClick={ws.stop} className="stop-btn">End Session</button>
                    )}
                    {(status === "done" || status === "error") && (
                        <button onClick={ws.reset}>New Session</button>
                    )}
                </div>
            </div>

            <div className="messages">
                {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} />
                ))}

                {generatingChatbot && (
                    <div className={`message-row chatbot-${generatingChatbot}`}>
                        <div className="message-glyph">
                            {generatingChatbot === "a" ? "A" : "B"}
                        </div>
                        <div className="message-bubble generating">
                            <span className="model-label">composing</span>
                            <div className="typing-dots">
                                <span /><span /><span />
                            </div>
                        </div>
                    </div>
                )}

                {status === "done" && doneReason && (
                    <div className="done-banner">
                        {doneLabel(doneReason)}
                    </div>
                )}

                {status === "error" && error && (
                    <div className="error-banner">{error}</div>
                )}

                <div ref={bottomRef} />
            </div>
        </div>
    );
}

function MessageBubble({ message }: { message: ChatMessage }) {
    return (
        <div className={`message-row chatbot-${message.chatbot}`}>
            <div className="message-glyph">
                {message.chatbot === "a" ? "A" : "B"}
            </div>
            <div className="message-bubble">
                <span className="model-label">{message.model}</span>
                <div className="message-content">{message.content}</div>
            </div>
        </div>
    );
}

function statusLabel(status: Status): string {
    const labels: Record<Status, string> = {
        idle: "Idle",
        running: "In Session",
        paused: "Paused",
        done: "Concluded",
        error: "Error",
    };
    return labels[status];
}
