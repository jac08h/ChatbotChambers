import { useState } from "react";
import { getSessionDisplayTitle, type ArchivedSession } from "../hooks/useWebSocket";

interface SessionSummary {
    id: string;
    title: string | null;
}

interface SidebarProps {
    currentSession: SessionSummary | null;
    history: ArchivedSession[];
    currentLabel: string | null;
    onHome: () => void;
    onNewChat: () => void;
    onSelectCurrentConversation: () => void;
    onSelectSession: (session: ArchivedSession) => void;
    onRenameSession: (session: SessionSummary) => void;
    onDeleteSession: (session: SessionSummary) => void;
    selectedSessionId: string | null;
    hasCurrentConversation: boolean;
    isCurrentConversationSelected: boolean;
    theme: "dark" | "light";
    onToggleTheme: () => void;
}

interface SidebarHistoryItemProps {
    session: SessionSummary;
    isActive: boolean;
    onSelect: () => void;
    onRename: () => void;
    onDelete: () => void;
}

export function Sidebar({
    currentSession,
    history,
    currentLabel,
    onHome,
    onNewChat,
    onSelectCurrentConversation,
    onSelectSession,
    onRenameSession,
    onDeleteSession,
    selectedSessionId,
    hasCurrentConversation,
    isCurrentConversationSelected,
    theme,
    onToggleTheme,
}: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <button className="sidebar-brand-title" onClick={onHome} type="button">
                    ChatbotChambers
                </button>
                <button
                    className="theme-toggle"
                    onClick={onToggleTheme}
                    title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                    type="button"
                    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                >
                    {theme === "dark" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM4.22 4.22a1 1 0 0 1 1.42 0l.7.7a1 1 0 0 1-1.42 1.42l-.7-.7a1 1 0 0 1 0-1.42Zm13.44 13.44a1 1 0 0 1 1.42 0l.7.7a1 1 0 0 1-1.42 1.42l-.7-.7a1 1 0 0 1 0-1.42ZM2 12a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm17 0a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1ZM4.22 19.78a1 1 0 0 1 0-1.42l.7-.7a1 1 0 0 1 1.42 1.42l-.7.7a1 1 0 0 1-1.42 0ZM17.66 6.34a1 1 0 0 1 0-1.42l.7-.7a1 1 0 0 1 1.42 1.42l-.7.7a1 1 0 0 1-1.42 0Z"/>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1Z"/>
                        </svg>
                    )}
                </button>
            </div>

            <button className="sidebar-new-chat" onClick={onNewChat} type="button">
                + New chat
            </button>

            <div className="sidebar-history">
                {hasCurrentConversation && currentSession && (
                    <SidebarHistoryItem
                        session={currentSession}
                        isActive={isCurrentConversationSelected}
                        onSelect={onSelectCurrentConversation}
                        onRename={() => onRenameSession(currentSession)}
                        onDelete={() => onDeleteSession(currentSession)}
                    />
                )}
                {history.map((session) => (
                    <SidebarHistoryItem
                        key={session.id}
                        session={session}
                        isActive={selectedSessionId === session.id}
                        onSelect={() => onSelectSession(session)}
                        onRename={() => onRenameSession(session)}
                        onDelete={() => onDeleteSession(session)}
                    />
                ))}
                {!hasCurrentConversation && history.length === 0 && (
                    <div className="sidebar-empty">No conversations yet</div>
                )}
                {hasCurrentConversation && !currentSession && currentLabel && (
                    <div className="sidebar-empty">{currentLabel}</div>
                )}
            </div>
        </aside>
    );
}

function SidebarHistoryItem({
    session,
    isActive,
    onSelect,
    onRename,
    onDelete,
}: SidebarHistoryItemProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div className="sidebar-history-item">
            <button
                className={`sidebar-item${isActive ? " sidebar-item-active" : ""}`}
                onClick={onSelect}
                type="button"
                title={getSessionDisplayTitle(session)}
            >
                {getSessionDisplayTitle(session)}
            </button>
            <div className="sidebar-item-actions">
                <button
                    className="sidebar-menu-btn"
                    onClick={() => setIsMenuOpen((open) => !open)}
                    type="button"
                    aria-label={`Conversation options for ${getSessionDisplayTitle(session)}`}
                    title="Conversation options"
                >
                    ⋯
                </button>
                {isMenuOpen && (
                    <div className="sidebar-menu" role="menu">
                        <button
                            className="sidebar-menu-item"
                            onClick={() => {
                                setIsMenuOpen(false);
                                onRename();
                            }}
                            type="button"
                            role="menuitem"
                        >
                            Rename
                        </button>
                        <button
                            className="sidebar-menu-item sidebar-menu-item-danger"
                            onClick={onDelete}
                            type="button"
                            role="menuitem"
                        >
                            Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
