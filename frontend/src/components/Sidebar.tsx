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
}: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <button className="sidebar-brand-title" onClick={onHome} type="button">
                    ChatbotChambers
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
