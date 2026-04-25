import { isHostedMode } from "../deployment";
import type { ChatMessage, SessionConfig } from "../types";
import { createHttpTransport } from "./httpTransport";
import { createWsTransport } from "./wsTransport";

export type TransportEvent =
    | { type: "generating"; chatbot: "a" | "b" }
    | { type: "empty_message"; chatbot: "a" | "b" }
    | { type: "message"; data: ChatMessage }
    | { type: "done"; reason: "stopped" | "leave"; chatbot?: "a" | "b" }
    | { type: "error"; message: string };

export interface TransportHandlers {
    onSessionId: (id: string) => void;
    onEvent: (event: TransportEvent) => void;
}

export interface ConversationTransport {
    start: (config: SessionConfig) => void;
    pause: () => void;
    resume: () => void;
    retry: () => void;
    stop: () => void;
    dispose: () => void;
}

export function createConversationTransport(
    handlers: TransportHandlers,
): ConversationTransport {
    return isHostedMode ? createHttpTransport(handlers) : createWsTransport(handlers);
}
