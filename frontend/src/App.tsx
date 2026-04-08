import { useEffect, useRef, useState } from "react";
import { ConversationView } from "./components/ConversationView";
import { HistorySidebar } from "./components/HistorySidebar";
import { SetupForm } from "./components/SetupForm";
import type { ChatMessage, SessionConfig } from "./hooks/useWebSocket";
import { useWebSocket } from "./hooks/useWebSocket";

interface Session {
    id: number;
    label: string;
    messages: ChatMessage[];
    config: SessionConfig;
    doneReason: string | null;
    error: string | null;
}

export default function App() {
    const ws = useWebSocket();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<number | null>(null);
    const archivedSessionIdsRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        if (
            (ws.status === "done" || ws.status === "error")
            && ws.config
            && ws.sessionId > 0
            && !archivedSessionIdsRef.current.has(ws.sessionId)
        ) {
            archivedSessionIdsRef.current.add(ws.sessionId);
            setSessions((prev) => [
                {
                    id: ws.sessionId,
                    label: buildSessionLabel(ws.messages, ws.sessionId),
                    messages: ws.messages,
                    config: ws.config,
                    doneReason: ws.doneReason,
                    error: ws.error,
                },
                ...prev,
            ]);
        }
    }, [ws.config, ws.doneReason, ws.error, ws.messages, ws.sessionId, ws.status]);

    const selectedHistorySession = sessions.find((session) => session.id === selectedSession) || null;
    const showHistorySession = selectedHistorySession && (ws.status === "idle" || ws.status === "done" || ws.status === "error");

    const handleStart = (config: SessionConfig) => {
        setSelectedSession(null);
        ws.start(config);
    };

    const handleReset = () => {
        setSelectedSession(null);
        ws.reset();
    };

    return (
        <div className="app-shell">
            <HistorySidebar
                sessions={sessions}
                selectedSession={selectedSession}
                showCurrent={ws.status !== "idle"}
                currentActive={ws.status === "running" || ws.status === "paused"}
                onSelectCurrent={() => setSelectedSession(null)}
                onSelectSession={setSelectedSession}
            />
            <div className="main-panel">
                {showHistorySession ? (
                    <ConversationView
                        messages={selectedHistorySession.messages}
                        status={selectedHistorySession.error ? "error" : "done"}
                        generatingChatbot={null}
                        doneReason={selectedHistorySession.doneReason}
                        error={selectedHistorySession.error}
                        config={selectedHistorySession.config}
                        readOnly
                    />
                ) : ws.status === "idle" ? (
                    <SetupForm onStart={handleStart} error={ws.error} />
                ) : (
                    <ConversationView
                        messages={ws.messages}
                        status={ws.status}
                        generatingChatbot={ws.generatingChatbot}
                        doneReason={ws.doneReason}
                        error={ws.error}
                        config={ws.config}
                        onPause={ws.pause}
                        onResume={ws.resume}
                        onStop={ws.stop}
                        onReset={handleReset}
                        onSendUserMessage={ws.sendUserMessage}
                    />
                )}
            </div>
        </div>
    );
}

function buildSessionLabel(messages: ChatMessage[], sessionId: number): string {
    const firstMessage = messages[0]?.content.trim();
    if (!firstMessage) {
        return `Session ${sessionId}`;
    }
    return firstMessage.length > 40 ? `${firstMessage.slice(0, 40)}…` : firstMessage;
}
