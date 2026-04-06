import { ConversationView } from "./components/ConversationView";
import { SetupForm } from "./components/SetupForm";
import { useWebSocket } from "./hooks/useWebSocket";

export default function App() {
    const ws = useWebSocket();

    if (ws.status === "idle") {
        return <SetupForm onStart={ws.start} error={ws.error} />;
    }

    return <ConversationView ws={ws} />;
}
