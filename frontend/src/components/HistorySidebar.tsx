interface HistorySidebarProps {
    sessions: Array<{ id: number; label: string }>;
    selectedSession: number | null;
    showCurrent: boolean;
    currentActive: boolean;
    onSelectCurrent: () => void;
    onSelectSession: (id: number) => void;
}

export function HistorySidebar({
    sessions,
    selectedSession,
    showCurrent,
    currentActive,
    onSelectCurrent,
    onSelectSession,
}: HistorySidebarProps) {
    return (
        <aside className="history-sidebar">
            <div className="history-sidebar-header">
                <span className="history-sidebar-kicker">Archive</span>
                <div className="history-sidebar-title-row">
                    <span className="history-sidebar-title">Sessions</span>
                    <span className="history-sidebar-count">{sessions.length}</span>
                </div>
            </div>

            <div className="history-sidebar-body">
                {showCurrent && (
                    <button
                        className={`history-item current-session${currentActive && selectedSession === null ? " active" : ""}`}
                        onClick={onSelectCurrent}
                        type="button"
                    >
                        Current chat
                    </button>
                )}

                {sessions.length === 0 ? (
                    <div className="history-empty">No saved conversations yet.</div>
                ) : (
                    <div className="history-list">
                        {sessions.map((session) => (
                            <button
                                key={session.id}
                                className={`history-item${selectedSession === session.id ? " active" : ""}`}
                                onClick={() => onSelectSession(session.id)}
                                type="button"
                                title={session.label}
                            >
                                {session.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
}
