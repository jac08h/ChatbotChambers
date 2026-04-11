import { useState } from "react";
import { ConversationView } from "./components/ConversationView";
import { SetupForm } from "./components/SetupForm";
import { Sidebar } from "./components/Sidebar";
import type { ArchivedSession, SessionConfig } from "./hooks/useWebSocket";
import { useWebSocket } from "./hooks/useWebSocket";

export default function App() {
    const ws = useWebSocket();
    const [viewingSession, setViewingSession] = useState<ArchivedSession | null>(null);
    const [showSetup, setShowSetup] = useState(true);

    const handleStart = (config: SessionConfig) => {
        setViewingSession(null);
        setShowSetup(false);
        ws.start(config);
    };

    const handleNewChat = () => {
        if (ws.status === "running") {
            ws.pause();
        } else {
            ws.reset();
        }
        setViewingSession(null);
        setShowSetup(true);
    };

    const handleSelectCurrentConversation = () => {
        setViewingSession(null);
        setShowSetup(false);
    };

    const handleSelectSession = (session: ArchivedSession) => {
        if (ws.status === "running") {
            return;
        }
        setViewingSession(session);
        setShowSetup(false);
    };

    const hasConversationState = ws.config !== null;
    const hasCurrentConversation = ws.status === "running" || ws.status === "paused";
    const showCurrentConversation = !showSetup && !viewingSession && hasConversationState;
    const showConversation = Boolean(viewingSession) || showCurrentConversation;

    return (
        <div className="app-shell">
            <Sidebar
                history={ws.history}
                currentLabel={ws.currentLabel}
                onNewChat={handleNewChat}
                onSelectCurrentConversation={handleSelectCurrentConversation}
                onSelectSession={handleSelectSession}
                selectedSessionId={viewingSession?.id ?? null}
                hasCurrentConversation={hasCurrentConversation}
                isCurrentConversationSelected={showCurrentConversation}
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
                        label={viewingSession ? viewingSession.label : ws.currentLabel}
                        onPause={viewingSession ? undefined : ws.pause}
                        onResume={viewingSession ? undefined : ws.resume}
                        onNewConversation={viewingSession || ws.status !== "done" ? undefined : handleNewChat}
                        onRenameSession={
                            viewingSession
                                ? (label) => ws.renameSession(viewingSession.id, label)
                                : ws.renameCurrentSession
                        }
                    />
                ) : (
                    <SetupForm onStart={handleStart} error={ws.error} />
                )}
            </div>
        </div>
    );
}
