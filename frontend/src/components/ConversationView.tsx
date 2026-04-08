import { useEffect, useMemo, useRef, useState } from "react";
import {
    DEFAULT_CHATBOT_NAMES,
    type ChatMessage,
    type SessionConfig,
    type Status,
} from "../hooks/useWebSocket";
import { buildMemoryBars } from "./conversationMemory";

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
    onPause,
    onResume,
    onStop,
    onReset,
    readOnly = false,
}: ConversationViewProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [liveMode, setLiveMode] = useState(false);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: liveMode ? "auto" : "smooth" });
    }, [liveMode, messages, generatingChatbot, status]);

    const transcriptItems = useMemo(
        () => buildTimelineItems(messages, generatingChatbot, DEFAULT_CHATBOT_NAMES).filter((item) => item.type === "message"),
        [generatingChatbot, messages],
    );

    const activeStage = useMemo(
        () => buildActiveStage(messages, generatingChatbot, DEFAULT_CHATBOT_NAMES),
        [generatingChatbot, messages],
    );

    const chamberTitle = config
        ? `${config.chatbot_a.name} × ${config.chatbot_b.name}`
        : "Two chatbots, one room";

    return (
        <div className="conversation-container">
            <div className="conversation-header">
                <div className="conversation-brand">
                    <span className="header-title">ChatbotChambers</span>
                    <span className="conversation-title">{chamberTitle}</span>
                </div>
                <div className="conversation-toolbar">
                    <span className="status-badge" data-status={status}>
                        {statusLabel(status)}
                    </span>
                    <div className="view-toggle" role="tablist" aria-label="Conversation view mode">
                        <button
                            className={!liveMode ? "active-toggle" : undefined}
                            onClick={() => setLiveMode(false)}
                            type="button"
                        >
                            Transcript
                        </button>
                        <button
                            className={liveMode ? "active-toggle" : undefined}
                            onClick={() => setLiveMode(true)}
                            type="button"
                        >
                            Active mode
                        </button>
                    </div>
                    <div className="controls">
                        {!readOnly && status === "running" && onPause && (
                            <button onClick={onPause} type="button">Pause</button>
                        )}
                        {!readOnly && status === "paused" && onResume && (
                            <button onClick={onResume} type="button">Resume</button>
                        )}
                        {!readOnly && (status === "running" || status === "paused") && onStop && (
                            <button onClick={onStop} className="stop-btn" type="button">Stop</button>
                        )}
                        {!readOnly && (status === "done" || status === "error") && onReset && (
                            <button onClick={onReset} type="button">New chat</button>
                        )}
                    </div>
                </div>
            </div>

            {liveMode ? (
                <div className="active-stage">
                    <div className="active-stage-copy">
                        <div>
                            <p className="eyebrow">Active mode</p>
                            <h2>The newest turn stays readable. Everything older becomes an echo.</h2>
                        </div>
                        <p className="active-stage-summary">
                            This keeps the room focused without losing the feeling of conversation building up behind it.
                        </p>
                    </div>

                    <div className="active-stack" data-echo-count={activeStage.echoes.length}>
                        {activeStage.echoes.map((item, index) => (
                            <EchoCard key={item.key} item={item} depth={index + 1} />
                        ))}
                        {activeStage.focus ? (
                            activeStage.focus.type === "message" ? (
                                <MessageBubble message={activeStage.focus.message} variant="focus" />
                            ) : (
                                <GeneratingBubble
                                    chatbot={activeStage.focus.chatbot}
                                    name={activeStage.focus.name}
                                    variant="focus"
                                />
                            )
                        ) : (
                            <div className="empty-stage">
                                <span className="empty-stage-mark">◦</span>
                                <p>No messages yet.</p>
                                <span>Start a chat and the latest turn will lock into view here.</span>
                            </div>
                        )}
                    </div>

                    {status === "done" && doneReason && (
                        <div className="done-banner">{doneLabel(doneReason, config)}</div>
                    )}

                    {status === "error" && error && (
                        <div className="error-banner">{error}</div>
                    )}

                    <div ref={bottomRef} />
                </div>
            ) : (
                <div className="messages">
                    {transcriptItems.map((item) => (
                        <MessageBubble key={item.key} message={item.message} />
                    ))}

                    {status === "done" && doneReason && (
                        <div className="done-banner">{doneLabel(doneReason, config)}</div>
                    )}

                    {status === "error" && error && (
                        <div className="error-banner">{error}</div>
                    )}

                    <div ref={bottomRef} />
                </div>
            )}
        </div>
    );
}

function MessageBubble({
    message,
    variant = "transcript",
}: {
    message: ChatMessage;
    variant?: "transcript" | "focus";
}) {
    const rowClassName = variant === "focus"
        ? `focus-message chatbot-${message.chatbot}`
        : `message-row chatbot-${message.chatbot}`;

    return (
        <div className={rowClassName}>
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
    variant = "transcript",
}: {
    chatbot: "a" | "b";
    name: string;
    variant?: "transcript" | "focus";
}) {
    const rowClassName = variant === "focus"
        ? `focus-message chatbot-${chatbot}`
        : `message-row chatbot-${chatbot}`;

    return (
        <div className={rowClassName}>
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

function EchoCard({ item, depth }: { item: VisibleItem; depth: number }) {
    const name = item.type === "message" ? item.message.name : item.name;
    const chatbot = item.type === "message" ? item.message.chatbot : item.chatbot;
    const bars = item.type === "message"
        ? buildMemoryBars(item.message.content)
        : [82, 56, 64];

    return (
        <div
            className={`echo-card chatbot-${chatbot}`}
            data-depth={depth}
            data-testid={`echo-card-${depth}`}
            style={{ "--echo-depth": depth } as React.CSSProperties}
        >
            <div className="echo-card-header">
                <span className="echo-card-label">{name}</span>
                <span className="echo-card-state">echo</span>
            </div>
            <div className="memory-lines" aria-hidden="true">
                {bars.map((width, index) => (
                    <span key={`${item.key}-${index}`} className="memory-line" style={{ width: `${width}%` }} />
                ))}
            </div>
        </div>
    );
}

function buildTimelineItems(
    messages: ChatMessage[],
    generatingChatbot: "a" | "b" | null,
    fallbackNames: Record<"a" | "b", string>,
): VisibleItem[] {
    const items: VisibleItem[] = messages.map((message, index) => ({
        type: "message",
        key: `${message.chatbot}-${index}`,
        index,
        message,
    }));

    if (generatingChatbot) {
        const latestMessage = [...messages].reverse().find((message) => message.chatbot === generatingChatbot);
        items.push({
            type: "generating",
            key: `generating-${generatingChatbot}`,
            index: messages.length,
            chatbot: generatingChatbot,
            name: latestMessage?.name || fallbackNames[generatingChatbot],
        });
    }

    return items;
}

function buildActiveStage(
    messages: ChatMessage[],
    generatingChatbot: "a" | "b" | null,
    fallbackNames: Record<"a" | "b", string>,
): { focus: VisibleItem | null; echoes: VisibleItem[] } {
    const timeline = buildTimelineItems(messages, generatingChatbot, fallbackNames);
    const focus = timeline.at(-1) ?? null;
    const echoes = timeline.slice(Math.max(0, timeline.length - 5), -1).reverse();
    return { focus, echoes };
}

function glyphForName(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "?";
}

function statusLabel(status: Status): string {
    const labels: Record<Status, string> = {
        idle: "Ready",
        running: "Running",
        paused: "Paused",
        done: "Done",
        error: "Error",
    };
    return labels[status];
}
