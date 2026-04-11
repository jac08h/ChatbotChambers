import { getSessionDisplayTitle, type ArchivedSession } from "../hooks/useWebSocket";

interface SidebarProps {
    history: ArchivedSession[];
    currentLabel: string | null;
    onNewChat: () => void;
    onSelectCurrentConversation: () => void;
    onSelectSession: (session: ArchivedSession) => void;
    onDeleteSession: (session: ArchivedSession) => void;
    selectedSessionId: string | null;
    hasCurrentConversation: boolean;
    isCurrentConversationSelected: boolean;
}

export function Sidebar({
    history,
    currentLabel,
    onNewChat,
    onSelectCurrentConversation,
    onSelectSession,
    onDeleteSession,
    selectedSessionId,
    hasCurrentConversation,
    isCurrentConversationSelected,
}: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <span className="sidebar-brand-title">ChatbotChambers</span>
            </div>

            <button className="sidebar-new-chat" onClick={onNewChat} type="button">
                + New chat
            </button>

            <div className="sidebar-history">
                {hasCurrentConversation && (
                    <button
                        className={`sidebar-item sidebar-item-live${isCurrentConversationSelected ? " sidebar-item-active" : ""}`}
                        onClick={onSelectCurrentConversation}
                        type="button"
                        title={currentLabel ?? "Current conversation"}
                    >
                        {currentLabel ?? "Current conversation"}
                    </button>
                )}
                {history.map((session) => (
                    <div className="sidebar-history-item" key={session.id}>
                        <button
                            className={`sidebar-item${selectedSessionId === session.id ? " sidebar-item-active" : ""}`}
                            onClick={() => onSelectSession(session)}
                            type="button"
                            title={getSessionDisplayTitle(session)}
                        >
                            {getSessionDisplayTitle(session)}
                        </button>
                        <button
                            className="sidebar-delete-btn"
                            onClick={() => onDeleteSession(session)}
                            type="button"
                            aria-label={`Delete conversation ${getSessionDisplayTitle(session)}`}
                            title="Delete conversation"
                        >
                            ×
                        </button>
                    </div>
                ))}
                {!hasCurrentConversation && history.length === 0 && (
                    <div className="sidebar-empty">No conversations yet</div>
                )}
            </div>
        </aside>
    );
}
