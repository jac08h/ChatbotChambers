import { useEffect, useRef } from "react";
import type { ChatMessage, Status, WebSocketState } from "../hooks/useWebSocket";

interface ConversationViewProps {
    ws: WebSocketState;
}

const DONE_REASON_LABELS: Record<string, string> = {
    leave: "A chatbot left the conversation.",
    stopped: "Conversation stopped.",
    max_turns: "Max turns reached.",
};

export function ConversationView({ ws }: ConversationViewProps) {
    const { messages, status, generatingChatbot, doneReason, error } = ws;
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, generatingChatbot]);

    return (
        <div className="conversation-container">
            <div className="conversation-header">
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
                        <button onClick={ws.stop} className="stop-btn">Stop</button>
                    )}
                    {(status === "done" || status === "error") && (
                        <button onClick={ws.reset}>New Conversation</button>
                    )}
                </div>
            </div>

            <div className="messages">
                {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} />
                ))}

                {generatingChatbot && (
                    <div className={`message-row chatbot-${generatingChatbot}`}>
                        <div className="message-bubble generating">
                            <span className="model-label">
                                Chatbot {generatingChatbot.toUpperCase()} is thinking
                            </span>
                            <div className="typing-dots">
                                <span /><span /><span />
                            </div>
                        </div>
                    </div>
                )}

                {status === "done" && doneReason && (
                    <div className="done-banner">
                        {DONE_REASON_LABELS[doneReason] ?? "Conversation ended."}
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
        running: "Running",
        paused: "Paused",
        done: "Done",
        error: "Error",
    };
    return labels[status];
}
