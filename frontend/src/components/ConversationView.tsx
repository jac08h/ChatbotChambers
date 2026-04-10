import { useEffect, useRef } from "react";
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
    onPause?: () => void;
    onResume?: () => void;
    onStop?: () => void;
}

function doneLabel(reason: string, config: SessionConfig | null): string {
    if (reason === "leave:a") {
        return `${config?.chatbot_a.name || DEFAULT_CHATBOT_NAMES.a} stepped out of the chamber.`;
    }
    if (reason === "leave:b") {
        return `${config?.chatbot_b.name || DEFAULT_CHATBOT_NAMES.b} stepped out of the chamber.`;
    }
    if (reason === "stopped") {
        return "The chamber fell quiet.";
    }
    if (reason === "max_turns") {
        return "The chamber reached its turn limit.";
    }
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
}: ConversationViewProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, generatingChatbot, status]);

    const showControls = (status === "running" || status === "paused") && (onPause || onResume || onStop);

    return (
        <div className="conversation-container">
            <div className="messages">
                {config && (
                    <div className="conversation-intro">
                        <p className="conversation-kicker">Tonight&apos;s chamber</p>
                        <h2 className="conversation-title">
                            {config.chatbot_a.name} &amp; {config.chatbot_b.name}
                        </h2>
                    </div>
                )}

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
                    {onStop && (
                        <button className="control-btn control-btn-stop" onClick={onStop} type="button">Stop</button>
                    )}
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
                        <summary>Private notes</summary>
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
                    <span className="model-label">gathering thoughts</span>
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
