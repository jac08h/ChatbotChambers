import { useState } from "react";
import { ConversationView } from "./components/ConversationView";
import { SetupForm } from "./components/SetupForm";
import { Sidebar } from "./components/Sidebar";
import { getSessionDisplayTitle, type ArchivedSession, type SessionConfig, useWebSocket } from "./hooks/useWebSocket";

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

    const handleDeleteSession = async (session: ArchivedSession) => {
        const confirmed = window.confirm(`Delete conversation "${getSessionDisplayTitle(session)}"?`);
        if (!confirmed) {
            return;
        }
        const deleted = await ws.deleteSession(session.id);
        if (!deleted) {
            return;
        }
        if (viewingSession?.id === session.id || ws.currentSessionId === session.id) {
            setViewingSession(null);
            setShowSetup(true);
        }
    };

    const hasConversationState = ws.config !== null;
    const hasCurrentConversation = ws.status === "running" || ws.status === "paused";
    const showCurrentConversation = !showSetup && !viewingSession && hasConversationState;
    const showConversation = Boolean(viewingSession) || showCurrentConversation;
    const currentDisplayTitle = ws.currentSessionId
        ? getSessionDisplayTitle({ id: ws.currentSessionId, title: ws.currentTitle })
        : null;
    const currentArchivedSession = ws.currentSessionId
        ? ws.history.find((session) => session.id === ws.currentSessionId) ?? null
        : null;

    return (
        <div className="app-shell">
            <Sidebar
                history={ws.history}
                currentLabel={currentDisplayTitle}
                onNewChat={handleNewChat}
                onSelectCurrentConversation={handleSelectCurrentConversation}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
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
                        label={viewingSession ? getSessionDisplayTitle(viewingSession) : currentDisplayTitle}
                        onPause={viewingSession ? undefined : ws.pause}
                        onResume={viewingSession ? undefined : ws.resume}
                        onNewConversation={viewingSession || ws.status !== "done" ? undefined : handleNewChat}
                        onRenameSession={
                            viewingSession
                                ? (label) => ws.renameSession(viewingSession.id, label)
                                : ws.renameCurrentSession
                        }
                        onDeleteSession={
                            viewingSession
                                ? () => { void handleDeleteSession(viewingSession); }
                                : currentArchivedSession
                                    ? () => { void handleDeleteSession(currentArchivedSession); }
                                    : undefined
                        }
                    />
                ) : (
                    <SetupForm onStart={handleStart} error={ws.error} />
                )}
            </div>
        </div>
    );
}
