import { webSocketUrl } from "../../api";
import type { SessionConfig } from "../types";
import type { ConversationTransport, TransportHandlers } from "./index";

export function createWsTransport(handlers: TransportHandlers): ConversationTransport {
    let socket: WebSocket | null = null;

    return {
        start(config: SessionConfig) {
            socket?.close();
            socket = new WebSocket(webSocketUrl("/ws"));
            socket.onopen = () => {
                socket?.send(JSON.stringify({ type: "start", config }));
            };
            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === "session_id") {
                    handlers.onSessionId(data.id);
                    return;
                }
                if (data.type === "generating" || data.type === "empty_message") {
                    handlers.onEvent(data);
                    return;
                }
                if (data.type === "message") {
                    handlers.onEvent({ type: "message", data: data.data });
                    return;
                }
                if (data.type === "done") {
                    handlers.onEvent({
                        type: "done",
                        reason: data.reason,
                        chatbot: data.chatbot,
                    });
                    return;
                }
                if (data.type === "error") {
                    handlers.onEvent({ type: "error", message: data.message });
                }
            };
            socket.onerror = () => {
                handlers.onEvent({ type: "error", message: "WebSocket connection error" });
            };
        },
        pause() {
            socket?.send(JSON.stringify({ type: "pause" }));
        },
        resume() {
            socket?.send(JSON.stringify({ type: "resume" }));
        },
        retry() {
            socket?.send(JSON.stringify({ type: "retry" }));
        },
        stop() {
            socket?.send(JSON.stringify({ type: "stop" }));
        },
        dispose() {
            socket?.close();
            socket = null;
        },
    };
}
