import { useState } from "react";
import { getSessionDisplayTitle } from "../hooks/useConversation";
import type { ArchivedSession } from "../lib/types";

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
