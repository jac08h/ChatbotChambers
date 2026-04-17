import { useEffect, useRef, useState } from "react";
import {
    DEFAULT_CHATBOT_NAMES,
    type ChatMessage,
    type Provider,
    type SessionConfig,
    type Status,
} from "../hooks/useWebSocket";

const PROVIDER_LABELS: Record<Provider, string> = {
    openrouter: "OpenRouter",
    claude_code: "Claude Code",
    codex: "Codex CLI",
    mock: "Mock",
};

interface ConversationViewProps {
    messages: ChatMessage[];
    status: Status;
    generatingChatbot: "a" | "b" | null;
    doneReason: string | null;
    error: string | null;
    emptyMessageError?: "a" | "b" | null;
    config: SessionConfig | null;
    label?: string | null;
    avatarA?: string;
    avatarB?: string;
    onPause?: () => void;
    onResume?: () => void;
    onRetry?: () => void;
    onNewConversation?: () => void;
    onRenameSession?: () => void;
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
    status,
    generatingChatbot,
    doneReason,
    error,
    emptyMessageError,
    config,
    label,
    avatarA,
    avatarB,
    onPause,
    onResume,
    onRetry,
    onNewConversation,
    onRenameSession,
    onDeleteSession,
}: ConversationViewProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, generatingChatbot, status]);

    const showControls = (status === "running" || status === "paused") && (onPause || onResume);
    const hasSessionActions = Boolean(onRenameSession || onDeleteSession);

    return (
        <div className="conversation-container">
            <div className="conversation-header">
                {label && (
                    <h1 className="conversation-title">{label}</h1>
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
                                            setMenuOpen(false);
                                            onRenameSession();
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
                    <MessageBubble
                        key={`${message.chatbot}-${index}`}
                        message={message}
                        avatar={message.chatbot === "a" ? avatarA : avatarB}
                        provider={message.chatbot === "a" ? config?.chatbot_a.provider : config?.chatbot_b.provider}
                    />
                ))}

                {generatingChatbot && (
                    <GeneratingBubble
                        chatbot={generatingChatbot}
                        name={getGeneratingName(messages, generatingChatbot)}
                        avatar={generatingChatbot === "a" ? avatarA : avatarB}
                    />
                )}

                {emptyMessageError && (
                    <div className="empty-message-banner">
                        <span className="empty-message-icon">⚠</span>
                        <span>The model returned an empty response. You can retry or stop the conversation.</span>
                    </div>
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
                    {status === "paused" && !emptyMessageError && onResume && (
                        <button className="control-btn" onClick={onResume} type="button">Resume</button>
                    )}
                    {status === "paused" && emptyMessageError && onRetry && (
                        <button className="control-btn control-btn-retry" onClick={onRetry} type="button">Retry</button>
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

function formatModelLabel(message: ChatMessage, provider?: Provider): string {
    const providerLabel = provider ? PROVIDER_LABELS[provider] : "";
    const modelDisplay = message.model_name || message.model;
    return providerLabel ? `${providerLabel} · ${modelDisplay}` : modelDisplay;
}

function MessageBubble({ message, avatar, provider }: { message: ChatMessage; avatar?: string; provider?: Provider }) {
    return (
        <div className={`message-row chatbot-${message.chatbot}`}>
            <div className={`message-glyph${avatar ? " has-avatar" : ""}`}>
                {avatar
                    ? <AvatarGlyph avatar={avatar} />
                    : message.name.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div className="message-bubble">
                <div className="message-meta">
                    <span className="sender-label">{message.name}</span>
                    {message.model && <span className="model-label">{formatModelLabel(message, provider)}</span>}
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

function GeneratingBubble({ chatbot, name, avatar }: { chatbot: "a" | "b"; name: string; avatar?: string }) {
    return (
        <div className={`message-row chatbot-${chatbot}`}>
            <div className={`message-glyph${avatar ? " has-avatar" : ""}`}>
                {avatar
                    ? <AvatarGlyph avatar={avatar} />
                    : name.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div className="message-bubble generating">
                <div className="message-meta">
                    <span className="sender-label">{name}</span>
                </div>
                <div className="typing-dots">
                    <span /><span /><span />
                </div>
            </div>
        </div>
    );
}

function AvatarGlyph({ avatar }: { avatar: string }) {
    return (
        <span
            aria-hidden="true"
            className="message-avatar"
            style={{
                WebkitMaskImage: `url(${avatar})`,
                maskImage: `url(${avatar})`,
            }}
        />
    );
}

function getGeneratingName(messages: ChatMessage[], chatbot: "a" | "b"): string {
    const latest = [...messages].reverse().find((message) => message.chatbot === chatbot);
    return latest?.name || DEFAULT_CHATBOT_NAMES[chatbot];
}
