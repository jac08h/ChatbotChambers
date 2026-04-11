import { useEffect, useRef, useState } from "react";
import {
    DEFAULT_CHATBOT_NAMES,
    type ChatMessage,
    type SessionConfig,
    type Status,
} from "../hooks/useWebSocket";

interface ConversationViewProps {
    messages: ChatMessage[];
    status: Status;
    generatingChatbot: "a" | "b" | null;
    doneReason: string | null;
    error: string | null;
    config: SessionConfig | null;
    label?: string | null;
    onPause?: () => void;
    onResume?: () => void;
    onNewConversation?: () => void;
    onRenameSession?: (label: string) => void;
}


function doneLabel(reason: string, config: SessionConfig | null): string {
    if (reason === "leave:a") {
        return `${config?.chatbot_a.name || DEFAULT_CHATBOT_NAMES.a} left the chat.`;
    }
    if (reason === "leave:b") {
        return `${config?.chatbot_b.name || DEFAULT_CHATBOT_NAMES.b} left the chat.`;
    }
    if (reason === "stopped") {
        return "Conversation stopped.";
    }
    if (reason === "max_turns") {
        return "Reached the turn limit.";
    }
    return "Conversation ended.";
}

export function ConversationView({
    messages,
    status,
    generatingChatbot,
    doneReason,
    error,
    config,
    label,
    onPause,
    onResume,
    onNewConversation,
    onRenameSession,
}: ConversationViewProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, generatingChatbot, status]);

    const canRename = status === "paused" || status === "done";

    const handleStartEdit = () => {
        if (!canRename || !onRenameSession) return;
        setEditValue(label ?? "");
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const handleCommitEdit = () => {
        const trimmed = editValue.trim();
        if (trimmed && onRenameSession) {
            onRenameSession(trimmed);
        }
        setEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleCommitEdit();
        if (e.key === "Escape") setEditing(false);
    };

    const showControls = (status === "running" || status === "paused") && (onPause || onResume);

    return (
        <div className="conversation-container">
            {label && (
                <div className="conversation-header">
                    {editing ? (
                        <input
                            ref={inputRef}
                            className="conversation-title-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCommitEdit}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    ) : (
                        <button
                            className={`conversation-title${canRename && onRenameSession ? " conversation-title-editable" : ""}`}
                            onClick={handleStartEdit}
                            type="button"
                            disabled={!canRename || !onRenameSession}
                        >
                            {label}
                            {canRename && onRenameSession && <span className="conversation-title-caret">▾</span>}
                        </button>
                    )}
                </div>
            )}
            <div className="messages">
                {messages.map((message, index) => (
                    <MessageBubble key={`${message.chatbot}-${index}`} message={message} />
                ))}

                {generatingChatbot && (
                    <GeneratingBubble
                        chatbot={generatingChatbot}
                        name={getGeneratingName(messages, generatingChatbot)}
                    />
                )}

                {status === "done" && doneReason && (
                    <div className="done-banner">{doneLabel(doneReason, config)}</div>
                )}

                {status === "error" && error && (
                    <div className="error-banner">{error}</div>
                )}

                <div ref={bottomRef} />
            </div>

            {showControls && (
                <div className="floating-controls">
                    {status === "running" && onPause && (
                        <button className="control-btn" onClick={onPause} type="button">Pause</button>
                    )}
                    {status === "paused" && onResume && (
                        <button className="control-btn" onClick={onResume} type="button">Resume</button>
                    )}
                </div>
            )}

            {status === "done" && onNewConversation && (
                <div className="floating-controls">
                    <button className="control-btn" onClick={onNewConversation} type="button">New conversation</button>
                </div>
            )}
        </div>
    );
}

function MessageBubble({ message }: { message: ChatMessage }) {
    return (
        <div className={`message-row chatbot-${message.chatbot}`}>
            <div className="message-glyph">{message.name.trim().charAt(0).toUpperCase() || "?"}</div>
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

function GeneratingBubble({ chatbot, name }: { chatbot: "a" | "b"; name: string }) {
    return (
        <div className={`message-row chatbot-${chatbot}`}>
            <div className="message-glyph">{name.trim().charAt(0).toUpperCase() || "?"}</div>
            <div className="message-bubble generating">
                <div className="message-meta">
                    <span className="sender-label">{name}</span>
                    <span className="model-label">composing</span>
                </div>
                <div className="typing-dots">
                    <span /><span /><span />
                </div>
            </div>
        </div>
    );
}

function getGeneratingName(messages: ChatMessage[], chatbot: "a" | "b"): string {
    const latest = [...messages].reverse().find((m) => m.chatbot === chatbot);
    return latest?.name || DEFAULT_CHATBOT_NAMES[chatbot];
}
