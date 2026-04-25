import { getHostedModelName } from "./hostedProviders";
import type { ChatMessage, SessionConfig } from "./types";

const PREAMBLE = `You are in a room with another participant. You are chatting directly with them, not with the user. You are one of the participants in the conversation, not a facilitator. Respond as yourself, speaking to the other participant in first person. Keep the conversation going naturally unless instructed otherwise.`;
const PREAMBLE_A = `You are participant A.`;
const PREAMBLE_B = `You are participant B.`;

export interface ConversationTurnMessage {
    speaker: "a" | "b";
    content: string;
}

export interface TurnResult {
    content: string;
    thinking: string;
}

export interface ConversationEngineDependencies {
    callTurn: (
        systemPrompt: string,
        messages: ConversationTurnMessage[],
        model: string,
        signal?: AbortSignal,
    ) => Promise<TurnResult>;
    waitUntilRunning: () => Promise<void>;
    isStopped: () => boolean;
    getSignal?: () => AbortSignal | undefined;
}

export type ConversationEngineEvent =
    | { type: "generating"; chatbot: "a" | "b" }
    | { type: "empty_message"; chatbot: "a" | "b" }
    | { type: "done"; reason: "stopped" | "leave"; chatbot?: "a" | "b" }
    | { type: "message"; data: ChatMessage };

export async function* runConversationEngine(
    config: SessionConfig,
    dependencies: ConversationEngineDependencies,
): AsyncGenerator<ConversationEngineEvent> {
    const history: ConversationTurnMessage[] = [];
    const chatbots = [
        { id: "a" as const, config: config.chatbot_a, preamble: PREAMBLE_A },
        { id: "b" as const, config: config.chatbot_b, preamble: PREAMBLE_B },
    ];
    let turn = 0;

    while (true) {
        for (const chatbot of chatbots) {
            while (true) {
                if (dependencies.isStopped()) {
                    yield { type: "done", reason: "stopped" };
                    return;
                }

                await dependencies.waitUntilRunning();
                if (dependencies.isStopped()) {
                    yield { type: "done", reason: "stopped" };
                    return;
                }

                yield { type: "generating", chatbot: chatbot.id };

                let result: TurnResult;
                try {
                    result = await dependencies.callTurn(
                        buildSystemPrompt(
                            chatbot.preamble,
                            config.shared_system_prompt,
                            chatbot.config.system_prompt,
                        ),
                        buildHistoryMessages(history),
                        chatbot.config.model,
                        dependencies.getSignal?.(),
                    );
                } catch (error) {
                    if (dependencies.isStopped()) {
                        yield { type: "done", reason: "stopped" };
                        return;
                    }
                    if (isAbortError(error)) {
                        continue;
                    }
                    throw error;
                }

                if (!result.content.trim()) {
                    yield { type: "empty_message", chatbot: chatbot.id };
                    continue;
                }

                history.push({ speaker: chatbot.id, content: result.content });
                yield {
                    type: "message",
                    data: {
                        chatbot: chatbot.id,
                        name: chatbot.config.name,
                        model: chatbot.config.model,
                        model_name: getHostedModelName(chatbot.config.model),
                        content: result.content,
                        turn,
                        thinking: result.thinking,
                    },
                };

                if (result.content.includes("/leave")) {
                    yield { type: "done", reason: "leave", chatbot: chatbot.id };
                    return;
                }

                break;
            }
        }

        turn += 1;
    }
}

export function buildSystemPrompt(
    individualPreamble: string,
    shared: string,
    individual: string,
): string {
    return [PREAMBLE, individualPreamble, shared.trim(), individual.trim()]
        .filter((part) => part)
        .join("\n\n");
}

export function buildHistoryMessages(history: ConversationTurnMessage[]): ConversationTurnMessage[] {
    return history.map((message) => ({ ...message }));
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}
