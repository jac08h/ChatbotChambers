import { useEffect, useState } from "react";
import { ConversationView } from "./components/ConversationView";
import { SetupForm } from "./components/SetupForm";
import { Sidebar } from "./components/Sidebar";
import {
    getSessionDisplayTitle,
    getSessionIdFromPath,
    getSessionPath,
    type ArchivedSession,
    type SessionConfig,
    useWebSocket,
} from "./hooks/useWebSocket";

const AVATAR_COUNT = 8;

function pickAvatars(): [string, string] {
    const a = Math.floor(Math.random() * AVATAR_COUNT) + 1;
    let b = Math.floor(Math.random() * (AVATAR_COUNT - 1)) + 1;
    if (b >= a) b += 1;
    const fmt = (n: number) => `/avatars/avatar_${String(n).padStart(2, "0")}.svg`;
    return [fmt(a), fmt(b)];
}

export default function App() {
    const ws = useWebSocket();
    const [routeSessionId, setRouteSessionId] = useState<string | null>(() => getSessionIdFromPath(window.location.pathname));
    const [showSetup, setShowSetup] = useState(() => routeSessionId === null);
    const [avatars, setAvatars] = useState<[string, string]>(() => pickAvatars());

    const handleStart = (config: SessionConfig, initialTitle: string) => {
        setRouteSessionId(null);
        setShowSetup(false);
        setAvatars(pickAvatars());
        ws.start(config, initialTitle);
    };

    const handleNewChat = () => {
        if (ws.status === "running") {
            ws.pause();
        } else {
            ws.reset();
        }
        setShowSetup(true);
        setRouteSessionId(null);
    };

    const handleGoHome = () => {
        setShowSetup(true);
        setRouteSessionId(null);
    };

    const handleSelectCurrentConversation = () => {
        setShowSetup(false);
        setRouteSessionId(ws.currentSessionId);
    };

    const handleSelectSession = (session: ArchivedSession) => {
        if (ws.status === "running") {
            return;
        }
        setShowSetup(false);
        setRouteSessionId(session.id);
    };

    const handleDeleteSession = async (session: Pick<ArchivedSession, "id" | "title">) => {
        const confirmed = window.confirm(`Delete conversation "${getSessionDisplayTitle(session)}"?`);
        if (!confirmed) {
            return;
        }
        const deleted = await ws.deleteSession(session.id);
        if (!deleted) {
            return;
        }
        if (routeSessionId === session.id || ws.currentSessionId === session.id) {
            setShowSetup(true);
            setRouteSessionId(null);
        }
    };

    const handleRenameSession = (sessionId: string, title: string) => {
        if (ws.currentSessionId === sessionId) {
            ws.renameCurrentSession(title);
            return;
        }
        ws.renameSession(sessionId, title);
    };

    const viewingSession = routeSessionId
        ? ws.history.find((session) => session.id === routeSessionId) ?? null
        : null;
    const hasConversationState = ws.config !== null;
    const hasCurrentConversation = ws.status === "running" || ws.status === "paused";
    const showCurrentConversation = !showSetup && hasConversationState && (!routeSessionId || routeSessionId === ws.currentSessionId);
    const showConversation = Boolean(viewingSession) || showCurrentConversation;
    const currentDisplayTitle = ws.currentSessionId
        ? getSessionDisplayTitle({ id: ws.currentSessionId, title: ws.currentTitle })
        : null;
    const currentSession = ws.currentSessionId
        ? { id: ws.currentSessionId, title: ws.currentTitle }
        : null;

    useEffect(() => {
        const handlePopState = () => {
            const nextSessionId = getSessionIdFromPath(window.location.pathname);
            setRouteSessionId(nextSessionId);
            if (nextSessionId === null) {
                setShowSetup(true);
                return;
            }
            setShowSetup(false);
        };

        window.addEventListener("popstate", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);

    useEffect(() => {
        const pathname = showSetup
            ? "/"
            : viewingSession
                ? getSessionPath(viewingSession.id)
                : ws.currentSessionId
                    ? getSessionPath(ws.currentSessionId)
                    : null;

        if (pathname && window.location.pathname !== pathname) {
            window.history.pushState({}, "", pathname);
        }
    }, [showSetup, viewingSession, ws.currentSessionId]);

    return (
        <div className="app-shell">
            <Sidebar
                currentSession={currentSession}
                history={ws.history}
                currentLabel={currentDisplayTitle}
                onNewChat={handleNewChat}
                onHome={handleGoHome}
                onSelectCurrentConversation={handleSelectCurrentConversation}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                selectedSessionId={routeSessionId}
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
                        emptyMessageError={viewingSession ? null : ws.emptyMessageError}
                        config={viewingSession ? viewingSession.config : ws.config}
                        label={viewingSession ? getSessionDisplayTitle(viewingSession) : currentDisplayTitle}
                        avatarA={avatars[0]}
                        avatarB={avatars[1]}
                        onBack={handleGoHome}
                        onPause={viewingSession ? undefined : ws.pause}
                        onResume={viewingSession ? undefined : ws.resume}
                        onRetry={viewingSession ? undefined : ws.retry}
                        onNewConversation={viewingSession || ws.status !== "done" ? undefined : handleNewChat}
                        onRenameSession={
                            viewingSession
                                ? (label) => ws.renameSession(viewingSession.id, label)
                                : ws.renameCurrentSession
                        }
                        onDeleteSession={
                            viewingSession
                                ? () => { void handleDeleteSession(viewingSession); }
                                : currentSession
                                    ? () => { void handleDeleteSession(currentSession); }
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
