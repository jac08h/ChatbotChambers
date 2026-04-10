import { useState } from "react";
import { ConversationView } from "./components/ConversationView";
import { SetupForm } from "./components/SetupForm";
import { Sidebar } from "./components/Sidebar";
import type { ArchivedSession, SessionConfig } from "./hooks/useWebSocket";
import { useWebSocket } from "./hooks/useWebSocket";

export default function App() {
    const ws = useWebSocket();
    const [viewingSession, setViewingSession] = useState<ArchivedSession | null>(null);

    const handleStart = (config: SessionConfig) => {
        setViewingSession(null);
        ws.start(config);
    };

    const handleNewChat = () => {
        setViewingSession(null);
        ws.reset();
    };

    const handleSelectSession = (session: ArchivedSession) => {
        if (ws.status === "running" || ws.status === "paused") {
            return;
        }
        setViewingSession(session);
    };

    const isLive = ws.status === "running" || ws.status === "paused";
    const showConversation = isLive || ws.status === "done" || ws.status === "error" || Boolean(viewingSession);

    return (
        <div className="app-shell">
            <Sidebar
                history={ws.history}
                onNewChat={handleNewChat}
                onSelectSession={handleSelectSession}
                selectedSessionId={viewingSession?.id ?? null}
                isLive={isLive}
            />
            <div className="main-panel">
                {showConversation ? (
                    <ConversationView
                        messages={viewingSession ? viewingSession.messages : ws.messages}
                        status={viewingSession ? (viewingSession.error ? "error" : "done") : ws.status}
                        generatingChatbot={viewingSession ? null : ws.generatingChatbot}
                        doneReason={viewingSession ? viewingSession.doneReason : ws.doneReason}
                        error={viewingSession ? viewingSession.error : ws.error}
                        config={viewingSession ? viewingSession.config : ws.config}
                        onPause={viewingSession ? undefined : ws.pause}
                        onResume={viewingSession ? undefined : ws.resume}
                        onNewConversation={handleNewChat}
                    />
                ) : (
                    <SetupForm onStart={handleStart} error={ws.error} />
                )}
            </div>
        </div>
    );
}
