import { useEffect, useRef, useState } from "react";
import {
    DEFAULT_CHATBOT_NAMES,
    type ChatMessage,
    type SessionConfig,
    type Status,
} from "../hooks/useWebSocket";

interface ConversationViewProps {
    messages: ChatMessage[];
    draftMessage: ChatMessage | null;
    status: Status;
    generatingChatbot: "a" | "b" | null;
    doneReason: string | null;
    error: string | null;
    config: SessionConfig | null;
    label?: string | null;
    onBack?: () => void;
    onPause?: () => void;
    onResume?: () => void;
    onNewConversation?: () => void;
    onRenameSession?: (label: string) => void;
    onDeleteSession?: () => void;
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
    return "Conversation ended.";
}

export function ConversationView({
    messages,
    draftMessage,
    status,
    generatingChatbot,
    doneReason,
    error,
    config,
    label,
    onBack,
    onPause,
    onResume,
    onNewConversation,
    onRenameSession,
    onDeleteSession,
}: ConversationViewProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [editing, setEditing] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [editValue, setEditValue] = useState("");

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, generatingChatbot, status]);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editing]);

    const showControls = (status === "running" || status === "paused") && (onPause || onResume);
    const hasSessionActions = Boolean(onRenameSession || onDeleteSession);

    const handleCommitEdit = () => {
        const trimmed = editValue.trim();
        if (trimmed && onRenameSession) {
            onRenameSession(trimmed);
        }
        setEditing(false);
    };

    return (
        <div className="conversation-container">
            <div className="conversation-header">
                {onBack && (
                    <button className="conversation-app-title" onClick={onBack} type="button">
                        ChatbotChambers
                    </button>
                )}
                {label && (
                    editing ? (
                        <input
                            ref={inputRef}
                            className="conversation-title-input"
                            value={editValue}
                            onChange={(event) => setEditValue(event.target.value)}
                            onBlur={handleCommitEdit}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    handleCommitEdit();
                                }
                                if (event.key === "Escape") {
                                    setEditing(false);
                                }
                            }}
                            autoFocus
                        />
                    ) : (
                        <h1 className="conversation-title">{label}</h1>
                    )
                )}
                {hasSessionActions && (
                    <div className="conversation-actions">
                        <button
                            className="conversation-menu-btn"
                            onClick={() => setMenuOpen((open) => !open)}
                            type="button"
                            aria-label="Conversation options"
                        >
                            ⋯
                        </button>
                        {menuOpen && (
                            <div className="conversation-menu" role="menu">
                                {onRenameSession && (
                                    <button
                                        className="conversation-menu-item"
                                        onClick={() => {
                                            setEditValue(label ?? "");
                                            setEditing(true);
                                            setMenuOpen(false);
                                        }}
                                        type="button"
                                        role="menuitem"
                                    >
                                        Rename
                                    </button>
                                )}
                                {onDeleteSession && (
                                    <button
                                        className="conversation-menu-item conversation-menu-item-danger"
                                        onClick={onDeleteSession}
                                        type="button"
                                        role="menuitem"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="messages">
                {messages.map((message, index) => (
                    <MessageBubble key={`${message.chatbot}-${index}`} message={message} />
                ))}

                {generatingChatbot && (
                    <GeneratingBubble
                        chatbot={generatingChatbot}
                        name={getGeneratingName(messages, generatingChatbot)}
                        draftMessage={draftMessage}
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

function GeneratingBubble({
    chatbot,
    name,
    draftMessage,
}: {
    chatbot: "a" | "b";
    name: string;
    draftMessage: ChatMessage | null;
}) {
    return (
        <div className={`message-row chatbot-${chatbot}`}>
            <div className="message-glyph">{name.trim().charAt(0).toUpperCase() || "?"}</div>
            <div className="message-bubble generating">
                <div className="message-meta">
                    <span className="sender-label">{name}</span>
                    <span className="model-label">composing</span>
                </div>
                {draftMessage?.thinking && (
                    <details className="thinking-block" open aria-expanded="true">
                        <summary>Thinking</summary>
                        <div className="message-content">{draftMessage.thinking}</div>
                    </details>
                )}
                {draftMessage?.content ? (
                    <div className="message-content">{draftMessage.content}</div>
                ) : (
                    <div className="typing-dots">
                        <span /><span /><span />
                    </div>
                )}
            </div>
        </div>
    );
}

function getGeneratingName(messages: ChatMessage[], chatbot: "a" | "b"): string {
    const latest = [...messages].reverse().find((message) => message.chatbot === chatbot);
    return latest?.name || DEFAULT_CHATBOT_NAMES[chatbot];
}
