import type { ArchivedSession } from "../hooks/useWebSocket";

interface SidebarProps {
    history: ArchivedSession[];
    onNewChat: () => void;
    onSelectCurrentConversation: () => void;
    onSelectSession: (session: ArchivedSession) => void;
    selectedSessionId: number | null;
    hasCurrentConversation: boolean;
    isCurrentConversationSelected: boolean;
}

export function Sidebar({
    history,
    onNewChat,
    onSelectCurrentConversation,
    onSelectSession,
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
                    >
                        Current conversation
                    </button>
                )}
                {history.map((session) => (
                    <button
                        key={session.id}
                        className={`sidebar-item${selectedSessionId === session.id ? " sidebar-item-active" : ""}`}
                        onClick={() => onSelectSession(session)}
                        type="button"
                        title={session.label}
                    >
                        {session.label}
                    </button>
                ))}
                {!hasCurrentConversation && history.length === 0 && (
                    <div className="sidebar-empty">No conversations yet</div>
                )}
            </div>
        </aside>
    );
}
