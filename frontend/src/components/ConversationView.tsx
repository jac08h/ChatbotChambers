import { useEffect, useMemo, useRef, useState } from "react";
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
    readOnly?: boolean;
}

interface MessageItem {
    type: "message";
    key: string;
    index: number;
    message: ChatMessage;
}

interface GeneratingItem {
    type: "generating";
    key: string;
    index: number;
    chatbot: "a" | "b";
    name: string;
}

type VisibleItem = MessageItem | GeneratingItem;

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
    readOnly = false,
}: ConversationViewProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [liveMode, setLiveMode] = useState(false);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, generatingChatbot, status]);

    const visibleMessages = useMemo(
        () => (
            liveMode
                ? buildLiveMessages(messages, generatingChatbot)
                : buildTranscriptMessages(messages)
        ),
        [generatingChatbot, liveMode, messages],
    );

    return (
        <div className="conversation-container">
            <div className="conversation-header">
                <span className="header-title">LM Parlor</span>
                <span className="status-badge" data-status={status}>
                    {statusLabel(status)}
                </span>
                <div className="controls">
                    <button
                        className={liveMode ? "active-toggle" : undefined}
                        onClick={() => setLiveMode((current) => !current)}
                        type="button"
                    >
                        {liveMode ? "Full Transcript" : "Live Conversation"}
                    </button>
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
                {visibleMessages.map((item) => (
                    item.type === "message" ? (
                        <MessageBubble
                            key={item.key}
                            message={item.message}
                            liveMode={liveMode}
                        />
                    ) : (
                        <GeneratingBubble
                            key={item.key}
                            chatbot={item.chatbot}
                            name={item.name}
                            liveMode={liveMode}
                        />
                    )
                ))}

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

function MessageBubble({
    message,
    liveMode,
}: {
    message: ChatMessage;
    liveMode: boolean;
}) {
    return (
        <div className={`message-row chatbot-${message.chatbot}${liveMode ? " live-message" : ""}`}>
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

function GeneratingBubble({
    chatbot,
    name,
    liveMode,
}: {
    chatbot: "a" | "b";
    name: string;
    liveMode: boolean;
}) {
    return (
        <div className={`message-row chatbot-${chatbot}${liveMode ? " live-message" : ""}`}>
            <div className="message-glyph">{glyphForName(name)}</div>
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

function buildTranscriptMessages(messages: ChatMessage[]): VisibleItem[] {
    return messages.map((message, index) => ({
        type: "message",
        key: `${message.chatbot}-${index}`,
        index,
        message,
    }));
}

function buildLiveMessages(
    messages: ChatMessage[],
    generatingChatbot: "a" | "b" | null,
): VisibleItem[] {
    const latestByChatbot = new Map<"a" | "b", { index: number; message: ChatMessage }>();

    messages.forEach((message, index) => {
        latestByChatbot.set(message.chatbot, { index, message });
    });

    const visible: VisibleItem[] = Array.from(latestByChatbot.entries())
        .filter(([chatbot]) => chatbot !== generatingChatbot)
        .map(([, value]) => ({
            type: "message" as const,
            key: `${value.message.chatbot}-${value.index}`,
            index: value.index,
            message: value.message,
        }));

    if (generatingChatbot) {
        visible.push({
            type: "generating" as const,
            key: `generating-${generatingChatbot}`,
            index: messages.length,
            chatbot: generatingChatbot,
            name: latestByChatbot.get(generatingChatbot)?.message.name || `LM ${generatingChatbot.toUpperCase()}`,
        });
    }

    return visible.sort((a, b) => a.index - b.index);
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
