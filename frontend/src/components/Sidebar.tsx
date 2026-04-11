import type { ArchivedSession } from "../hooks/useWebSocket";

interface SidebarProps {
    history: ArchivedSession[];
    onNewChat: () => void;
    onSelectSession: (session: ArchivedSession) => void;
    selectedSessionId: number | null;
    isLive: boolean;
}

export function Sidebar({
    history,
    onNewChat,
    onSelectSession,
    selectedSessionId,
    isLive,
}: SidebarProps) {
    return (
        <aside className="sidebar">
            <button className="sidebar-new-chat" onClick={onNewChat} type="button">
                + New chat
            </button>

            <div className="sidebar-history">
                {isLive && (
                    <div className="sidebar-item sidebar-item-live">
                        Current conversation
                    </div>
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
                {!isLive && history.length === 0 && (
                    <div className="sidebar-empty">No conversations yet</div>
                )}
            </div>
        </aside>
    );
}
