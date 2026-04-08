import { useEffect, useRef, useState } from "react";
import type { ChatMessage, SessionConfig, Status } from "../hooks/useWebSocket";

interface ConversationViewProps {
    messages: ChatMessage[];
    status: Status;
    generatingChatbot: "a" | "b" | null;
    doneReason: string | null;
    error: string | null;
    config: SessionConfig | null;
    onPause?: () => void;
    onResume?: () => void;
    onStop?: () => void;
    onReset?: () => void;
    onSendUserMessage?: (content: string) => void;
    readOnly?: boolean;
}

function doneLabel(reason: string, config: SessionConfig | null): string {
    if (reason === "leave:a") return `${config?.chatbot_a.name || "LM A"} has left the parlor.`;
    if (reason === "leave:b") return `${config?.chatbot_b.name || "LM B"} has left the parlor.`;
    if (reason === "stopped") return "The conversation was brought to a close.";
    if (reason === "max_turns") return "The evening's discourse has concluded.";
    return "The conversation has ended.";
}

export function ConversationView({
    messages,
    status,
    generatingChatbot,
    doneReason,
    error,
    config,
    onPause,
    onResume,
    onStop,
    onReset,
    onSendUserMessage,
    readOnly = false,
}: ConversationViewProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [userMessage, setUserMessage] = useState("");

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, generatingChatbot, status]);

    const generatingName = generatingChatbot
        ? config?.[`chatbot_${generatingChatbot}`].name || generatingChatbot.toUpperCase()
        : "";

    const handleUserMessageSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const content = userMessage.trim();
        if (!content || !onSendUserMessage) {
            return;
        }
        onSendUserMessage(content);
        setUserMessage("");
    };

    return (
        <div className="conversation-container">
            <div className="conversation-header">
                <span className="header-title">LM Parlor</span>
                <span className="status-badge" data-status={status}>
                    {statusLabel(status)}
                </span>
                <div className="controls">
                    {!readOnly && status === "running" && onPause && (
                        <button onClick={onPause}>Pause</button>
                    )}
                    {!readOnly && status === "paused" && onResume && (
                        <button onClick={onResume}>Resume</button>
                    )}
                    {!readOnly && (status === "running" || status === "paused") && onStop && (
                        <button onClick={onStop} className="stop-btn">End Session</button>
                    )}
                    {!readOnly && (status === "done" || status === "error") && onReset && (
                        <button onClick={onReset}>New Session</button>
                    )}
                </div>
            </div>

            <div className="messages">
                {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} />
                ))}

                {generatingChatbot && (
                    <div className={`message-row chatbot-${generatingChatbot}`}>
                        <div className="message-glyph">{glyphForName(generatingName)}</div>
                        <div className="message-bubble generating">
                            <div className="message-meta">
                                <span className="sender-label">{generatingName}</span>
                                <span className="model-label">composing</span>
                            </div>
                            <div className="typing-dots">
                                <span /><span /><span />
                            </div>
                        </div>
                    </div>
                )}

                {!readOnly && status === "paused" && onSendUserMessage && (
                    <form className="user-message-composer" onSubmit={handleUserMessageSubmit}>
                        <label htmlFor="user-message-input">Join the conversation</label>
                        <div className="user-message-controls">
                            <input
                                id="user-message-input"
                                type="text"
                                value={userMessage}
                                onChange={(event) => setUserMessage(event.target.value)}
                                placeholder="Add a message to the conversation"
                            />
                            <button type="submit" disabled={!userMessage.trim()}>
                                Send
                            </button>
                        </div>
                    </form>
                )}

                {status === "done" && doneReason && (
                    <div className="done-banner">
                        {doneLabel(doneReason, config)}
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
            <div className="message-glyph">{glyphForName(message.name)}</div>
            <div className="message-bubble">
                <div className="message-meta">
                    <span className="sender-label">{message.name}</span>
                    {message.model && <span className="model-label">{message.model}</span>}
                </div>
                {message.thinking && (
                    <details className="thinking-block">
                        <summary>Thinking</summary>
                        <div className="message-content">{message.thinking}</div>
                    </details>
                )}
                <div className="message-content">{message.content}</div>
            </div>
        </div>
    );
}

function glyphForName(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "?";
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
