import { useCallback, useEffect, useState } from "react";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { RenameDialog } from "./components/RenameDialog";
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

const AVATAR_A = "/avatars/avatar_01.svg";
const AVATAR_B = "/avatars/avatar_01r.svg";
const THEME_STORAGE_KEY = "chatbotchambers-theme";
const COLLAPSE_BREAKPOINT = 768;

type Theme = "dark" | "light";

function isTheme(value: string | null): value is Theme {
    return value === "dark" || value === "light";
}

function systemTheme(): Theme {
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
        return "light";
    }
    return "dark";
}

function initialTheme(): Theme {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : systemTheme();
}

export default function App() {
    const ws = useWebSocket();
    const [routeSessionId, setRouteSessionId] = useState<string | null>(() => getSessionIdFromPath(window.location.pathname));
    const [showSetup, setShowSetup] = useState(() => routeSessionId === null);
    const [theme, setTheme] = useState<Theme>(() => initialTheme());
    const [pendingDeleteSession, setPendingDeleteSession] = useState<Pick<ArchivedSession, "id" | "title"> | null>(null);
    const [isDeletingSession, setIsDeletingSession] = useState(false);
    const [pendingRenameSession, setPendingRenameSession] = useState<Pick<ArchivedSession, "id" | "title"> | null>(null);
    const [isRenamingSession, setIsRenamingSession] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < COLLAPSE_BREAKPOINT);
    const [pendingDeleteAll, setPendingDeleteAll] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);

    const handleStart = (config: SessionConfig, initialTitle: string) => {
        setRouteSessionId(null);
        setShowSetup(false);
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

    const handleDeleteSession = (session: Pick<ArchivedSession, "id" | "title">) => {
        setPendingDeleteSession(session);
    };

    const handleRequestRenameSession = (session: Pick<ArchivedSession, "id" | "title">) => {
        setPendingRenameSession(session);
    };

    const handleConfirmDeleteSession = async () => {
        if (!pendingDeleteSession) {
            return;
        }
        setIsDeletingSession(true);
        const deleted = await ws.deleteSession(pendingDeleteSession.id);
        setIsDeletingSession(false);
        if (!deleted) {
            return;
        }
        if (routeSessionId === pendingDeleteSession.id || ws.currentSessionId === pendingDeleteSession.id) {
            setShowSetup(true);
            setRouteSessionId(null);
        }
        setPendingDeleteSession(null);
    };

    const handleRenameSession = (sessionId: string, title: string) => {
        if (ws.currentSessionId === sessionId) {
            ws.renameCurrentSession(title);
            return;
        }
        ws.renameSession(sessionId, title);
    };

    const handleConfirmRenameSession = async (title: string) => {
        if (!pendingRenameSession) {
            return;
        }
        setIsRenamingSession(true);
        handleRenameSession(pendingRenameSession.id, title);
        setIsRenamingSession(false);
        setPendingRenameSession(null);
    };

    const activeRouteSessionId = ws.startupError ? null : routeSessionId;
    const shouldShowSetup = showSetup || ws.startupError !== null;
    const viewingSession = activeRouteSessionId
        ? ws.history.find((session) => session.id === activeRouteSessionId) ?? null
        : null;
    const hasConversationState = ws.config !== null;
    const hasCurrentConversation = ws.status === "running" || ws.status === "paused";
    const showCurrentConversation = !shouldShowSetup && hasConversationState && (!activeRouteSessionId || activeRouteSessionId === ws.currentSessionId);
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
        const pathname = shouldShowSetup
            ? "/"
            : viewingSession
                ? getSessionPath(viewingSession.id)
                : ws.currentSessionId
                    ? getSessionPath(ws.currentSessionId)
                    : null;

        if (pathname && window.location.pathname !== pathname) {
            window.history.pushState({}, "", pathname);
        }
    }, [shouldShowSetup, viewingSession, ws.currentSessionId]);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < COLLAPSE_BREAKPOINT) {
                setIsSidebarCollapsed(true);
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleToggleCollapse = useCallback(() => {
        setIsSidebarCollapsed((prev) => !prev);
    }, []);

    const handleDeleteAllSessions = () => {
        setPendingDeleteAll(true);
    };

    const handleConfirmDeleteAll = async () => {
        setIsDeletingAll(true);
        const deleted = await ws.deleteAllSessions();
        setIsDeletingAll(false);
        if (deleted) {
            setShowSetup(true);
            setRouteSessionId(null);
        }
        setPendingDeleteAll(false);
    };

    return (
        <div className={`app-shell${isSidebarCollapsed ? " sidebar-collapsed-layout" : ""}`}>
            <Sidebar
                currentSession={currentSession}
                history={ws.history}
                currentLabel={currentDisplayTitle}
                onNewChat={handleNewChat}
                onHome={handleGoHome}
                onSelectCurrentConversation={handleSelectCurrentConversation}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                onDeleteAllSessions={handleDeleteAllSessions}
                onRenameSession={handleRequestRenameSession}
                selectedSessionId={activeRouteSessionId}
                hasCurrentConversation={hasCurrentConversation}
                isCurrentConversationSelected={showCurrentConversation}
                theme={theme}
                onToggleTheme={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={handleToggleCollapse}
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
                        avatarA={AVATAR_A}
                        avatarB={AVATAR_B}
                        onPause={viewingSession ? undefined : ws.pause}
                        onResume={viewingSession ? undefined : ws.resume}
                        onRetry={viewingSession ? undefined : ws.retry}
                        onNewConversation={viewingSession || ws.status !== "done" ? undefined : handleNewChat}
                        onRenameSession={
                            viewingSession
                                ? () => handleRequestRenameSession(viewingSession)
                                : currentSession
                                    ? () => handleRequestRenameSession(currentSession)
                                    : undefined
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
                <ConfirmationDialog
                    isOpen={ws.startupError !== null}
                    title="Conversation failed to start"
                    message={ws.startupError ?? ""}
                    confirmLabel="OK"
                    showCancel={false}
                    onConfirm={ws.clearStartupError}
                    onCancel={ws.clearStartupError}
                />
                <ConfirmationDialog
                    isOpen={pendingDeleteSession !== null}
                    title="Delete conversation"
                    message={pendingDeleteSession ? `Delete conversation "${getSessionDisplayTitle(pendingDeleteSession)}"?` : ""}
                    confirmLabel="Delete"
                    isConfirming={isDeletingSession}
                    onConfirm={() => { void handleConfirmDeleteSession(); }}
                    onCancel={() => {
                        if (!isDeletingSession) {
                            setPendingDeleteSession(null);
                        }
                    }}
                />
                <RenameDialog
                    key={pendingRenameSession?.id ?? "rename-session-closed"}
                    isOpen={pendingRenameSession !== null}
                    title="Rename chat"
                    initialValue={pendingRenameSession ? getSessionDisplayTitle(pendingRenameSession) : ""}
                    isSaving={isRenamingSession}
                    onConfirm={(value) => { void handleConfirmRenameSession(value); }}
                    onCancel={() => {
                        if (!isRenamingSession) {
                            setPendingRenameSession(null);
                        }
                    }}
                />
                <ConfirmationDialog
                    isOpen={pendingDeleteAll}
                    title="Delete all conversations"
                    message="Delete all conversations? This cannot be undone."
                    confirmLabel="Delete all"
                    isConfirming={isDeletingAll}
                    onConfirm={() => { void handleConfirmDeleteAll(); }}
                    onCancel={() => {
                        if (!isDeletingAll) {
                            setPendingDeleteAll(false);
                        }
                    }}
                />
            </div>
        </div>
    );
}
