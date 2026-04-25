import { useState } from "react";
import { getSessionDisplayTitle } from "../hooks/useConversation";
import type { ArchivedSession, Status } from "../lib/types";

interface SessionSummary {
    id: string;
    title: string | null;
}

interface SidebarProps {
    currentSession: SessionSummary | null;
    currentStatus: Status;
    history: ArchivedSession[];
    currentLabel: string | null;
    onHome: () => void;
    onNewChat: () => void;
    onSelectCurrentConversation: () => void;
    onSelectSession: (session: ArchivedSession) => void;
    onRenameSession: (session: SessionSummary) => void;
    onDeleteSession: (session: SessionSummary) => void;
    onDeleteAllSessions: () => void;
    selectedSessionId: string | null;
    hasCurrentConversation: boolean;
    isCurrentConversationSelected: boolean;
    hasOpenRouterKey?: boolean;
    onManageApiKey?: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

interface SidebarHistoryItemProps {
    session: SessionSummary;
    status: Status;
    isActive: boolean;
    onSelect: () => void;
    onRename: () => void;
    onDelete: () => void;
}

function SessionStatusIcon({ status }: { status: Status }) {
    if (status === "running") {
        return (
            <svg className="session-status-icon session-status-running" aria-label="Running" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
                <circle cx="5" cy="5" r="4" fill="currentColor" />
            </svg>
        );
    }
    if (status === "paused") {
        return (
            <svg className="session-status-icon session-status-paused" aria-label="Paused" xmlns="http://www.w3.org/2000/svg" width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                <rect x="0" y="0" width="3.5" height="12" rx="1" />
                <rect x="6.5" y="0" width="3.5" height="12" rx="1" />
            </svg>
        );
    }
    if (status === "done") {
        return (
            <svg className="session-status-icon session-status-done" aria-label="Done" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        );
    }
    if (status === "error") {
        return (
            <svg className="session-status-icon session-status-error" aria-label="Error" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        );
    }
    return null;
}

function archivedSessionStatus(session: ArchivedSession): Status {
    if (session.error) {
        return "error";
    }
    return "done";
}

export function Sidebar({
    currentSession,
    currentStatus,
    history,
    currentLabel,
    onHome,
    onNewChat,
    onSelectCurrentConversation,
    onSelectSession,
    onRenameSession,
    onDeleteSession,
    onDeleteAllSessions,
    selectedSessionId,
    hasCurrentConversation,
    isCurrentConversationSelected,
    hasOpenRouterKey = true,
    onManageApiKey,
    isCollapsed,
    onToggleCollapse,
}: SidebarProps) {
    return (
        <aside className={`sidebar${isCollapsed ? " sidebar-collapsed" : ""}`}>
            <div className="sidebar-brand">
                {!isCollapsed && (
                    <button className="sidebar-brand-title" onClick={onHome} type="button">
                        <span className="brand-a">Chatbot</span><span className="brand-b">Chambers</span>
                    </button>
                )}
                <div className="sidebar-brand-actions">
                    <button
                        className="theme-toggle"
                        onClick={onToggleCollapse}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        type="button"
                        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {isCollapsed ? (
                                <path d="M9 18l6-6-6-6"/>
                            ) : (
                                <path d="M15 18l-6-6 6-6"/>
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <>
                    <button className="sidebar-new-chat" onClick={onNewChat} type="button">
                        + New chat
                    </button>
                    {onManageApiKey && (
                        <button className="sidebar-api-key" onClick={onManageApiKey} type="button">
                            {hasOpenRouterKey ? "Update API key" : "Set API key"}
                        </button>
                    )}

                    <div className="sidebar-history">
                        {hasCurrentConversation && currentSession && (
                            <SidebarHistoryItem
                                session={currentSession}
                                status={currentStatus}
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
                                status={archivedSessionStatus(session)}
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

                    {history.length > 0 && (
                        <button
                            className="sidebar-delete-all"
                            onClick={onDeleteAllSessions}
                            type="button"
                        >
                            Delete all conversations
                        </button>
                    )}
                </>
            )}
        </aside>
    );
}

function SidebarHistoryItem({
    session,
    status,
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
                <SessionStatusIcon status={status} />
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
