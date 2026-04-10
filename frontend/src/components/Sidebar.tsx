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
            <div className="sidebar-header">
                <p className="sidebar-eyebrow">ChatbotChambers</p>
                <h2 className="sidebar-title">Archive</h2>
                <p className="sidebar-copy">Quiet rooms for curious exchanges.</p>
            </div>
            <button className="sidebar-new-chat" onClick={onNewChat} type="button">
                Open new chamber
            </button>

            <div className="sidebar-history">
                {isLive && (
                    <div className="sidebar-item sidebar-item-live">
                        Conversation in progress
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
                    <div className="sidebar-empty">No chambers recorded yet</div>
                )}
            </div>
        </aside>
    );
}
