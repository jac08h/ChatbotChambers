import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    DEFAULT_CHATBOT_NAMES,
    type ChatMessage,
    type Provider,
    type SessionConfig,
    type Status,
} from "../hooks/useWebSocket";

const PROVIDER_LABELS: Record<Provider, string> = {
    openrouter: "OpenRouter",
    github_copilot: "GitHub Copilot",
    claude_code: "Claude Code",
    codex: "Codex CLI",
    mock: "Mock",
};

const SCROLL_FOLLOW_THRESHOLD_PX = 24;

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
    const autoScrollEnabledRef = useRef(true);
    const [isDetachedFromBottom, setIsDetachedFromBottom] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [promptsOpen, setPromptsOpen] = useState(false);

    useLayoutEffect(() => {
        if (!autoScrollEnabledRef.current) {
            return;
        }
        bottomRef.current?.scrollIntoView();
    }, [messages, generatingChatbot, status, doneReason, error, emptyMessageError]);

    useEffect(() => {
        const target = getScrollTarget(bottomRef.current);
        const handleScroll = () => {
            const isAtBottom = isScrolledToBottom(target);
            autoScrollEnabledRef.current = isAtBottom;
            setIsDetachedFromBottom(!isAtBottom);
        };

        handleScroll();

        if (target === window) {
            window.addEventListener("scroll", handleScroll, { passive: true });
            return () => window.removeEventListener("scroll", handleScroll);
        }

        target.addEventListener("scroll", handleScroll, { passive: true });
        return () => target.removeEventListener("scroll", handleScroll);
    }, [messages.length, generatingChatbot, status, doneReason, error, emptyMessageError]);

    const showJumpToNewest = messages.length > 0 && isDetachedFromBottom;
    const showPauseButton = status === "running" && Boolean(onPause);
    const showResumeButton = status === "paused" && !emptyMessageError && Boolean(onResume);
    const showRetryButton = status === "paused" && Boolean(emptyMessageError) && Boolean(onRetry);
    const showTransportControls = showPauseButton || showResumeButton || showRetryButton;
    const showNewConversation = !showJumpToNewest && status === "done" && Boolean(onNewConversation);
    const showPrimaryControls = showTransportControls || showNewConversation;
    const showFloatingControls = showJumpToNewest || showPrimaryControls;
    const hasSessionActions = Boolean(onRenameSession || onDeleteSession);

    const handleJumpToNewest = () => {
        autoScrollEnabledRef.current = true;
        setIsDetachedFromBottom(false);
        bottomRef.current?.scrollIntoView();
    };

    const handleExport = () => {
        setMenuOpen(false);
        const payload = { config, messages };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${label ?? "conversation"}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

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
                                {config && (
                                    <button
                                        className="conversation-menu-item"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            setPromptsOpen(true);
                                        }}
                                        type="button"
                                        role="menuitem"
                                    >
                                        View prompts
                                    </button>
                                )}
                                {config && messages.length > 0 && (
                                    <button
                                        className="conversation-menu-item"
                                        onClick={handleExport}
                                        type="button"
                                        role="menuitem"
                                    >
                                        Export JSON
                                    </button>
                                )}
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

            {showFloatingControls && (
                <div className="floating-controls">
                    {showJumpToNewest && (
                        <div className="floating-controls-row">
                            <button className="control-btn control-btn-jump" onClick={handleJumpToNewest} type="button">
                                Jump to latest
                            </button>
                        </div>
                    )}
                    {showPrimaryControls && (
                        <div className="floating-controls-row">
                            {showPauseButton && onPause && (
                                <button className="control-btn" onClick={onPause} type="button">Pause</button>
                            )}
                            {showResumeButton && onResume && (
                                <button className="control-btn" onClick={onResume} type="button">Resume</button>
                            )}
                            {showRetryButton && onRetry && (
                                <button className="control-btn control-btn-retry" onClick={onRetry} type="button">Retry</button>
                            )}
                            {showNewConversation && onNewConversation && (
                                <button className="control-btn" onClick={onNewConversation} type="button">New conversation</button>
                            )}
                        </div>
                    )}
                </div>
            )}
            {promptsOpen && config && (
                <PromptsDialog config={config} onClose={() => setPromptsOpen(false)} />
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

function getScrollTarget(node: HTMLElement | null): HTMLElement | Window {
    let current = node?.parentElement ?? null;

    while (current) {
        const overflowY = window.getComputedStyle(current).overflowY;
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
            return current;
        }
        current = current.parentElement;
    }

    return window;
}

function isWindowTarget(target: HTMLElement | Window): target is Window {
    return target === window;
}

function isScrolledToBottom(target: HTMLElement | Window): boolean {
    if (isWindowTarget(target)) {
        const viewportHeight = window.innerHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const scrollHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
        );

        return scrollTop + viewportHeight >= scrollHeight - SCROLL_FOLLOW_THRESHOLD_PX;
    }

    return target.scrollTop + target.clientHeight >= target.scrollHeight - SCROLL_FOLLOW_THRESHOLD_PX;
}

function getGeneratingName(messages: ChatMessage[], chatbot: "a" | "b"): string {
    const latest = [...messages].reverse().find((message) => message.chatbot === chatbot);
    return latest?.name || DEFAULT_CHATBOT_NAMES[chatbot];
}

function PromptsDialog({ config, onClose }: { config: SessionConfig; onClose: () => void }) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const sections: Array<{ label: string; content: string }> = [
        { label: "Shared system prompt", content: config.shared_system_prompt },
        { label: `${config.chatbot_a.name || "Chatbot A"} system prompt`, content: config.chatbot_a.system_prompt },
        { label: `${config.chatbot_b.name || "Chatbot B"} system prompt`, content: config.chatbot_b.system_prompt },
    ];

    return (
        <div
            className="prompts-dialog-backdrop"
            role="presentation"
            onClick={onClose}
        >
            <div
                className="prompts-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="prompts-dialog-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="prompts-dialog-header">
                    <h2 id="prompts-dialog-title" className="prompts-dialog-title">Prompts</h2>
                    <button className="prompts-dialog-close" type="button" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <div className="prompts-dialog-body">
                    {sections.map(({ label, content }) => (
                        <div key={label} className="prompts-dialog-section">
                            <div className="prompts-dialog-section-label">{label}</div>
                            <pre className="prompts-dialog-section-content">{content || <span className="prompts-dialog-empty">(empty)</span>}</pre>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
