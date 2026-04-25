import { apiUrl } from "../../api";
import { runConversationEngine, type ConversationTurnMessage, type TurnResult } from "../conversationEngine";
import { getStoredOpenRouterKey } from "../storage";
import type { SessionConfig } from "../types";
import type { ConversationTransport, TransportHandlers } from "./index";

function createPausedGate() {
    let resolvePromise: (() => void) | null = null;
    let promise = Promise.resolve();
    let paused = false;

    return {
        isPaused(): boolean {
            return paused;
        },
        async wait(): Promise<void> {
            await promise;
        },
        pause(): void {
            if (paused) {
                return;
            }
            paused = true;
            promise = new Promise<void>((resolve) => {
                resolvePromise = resolve;
            });
        },
        resume(): void {
            if (!paused) {
                return;
            }
            paused = false;
            resolvePromise?.();
            resolvePromise = null;
            promise = Promise.resolve();
        },
    };
}

export function createHttpTransport(handlers: TransportHandlers): ConversationTransport {
    const pausedGate = createPausedGate();
    let stopRequested = false;
    let abortController: AbortController | null = null;

    return {
        start(config: SessionConfig) {
            stopRequested = false;
            pausedGate.resume();
            handlers.onSessionId(crypto.randomUUID());
            void (async () => {
                try {
                    for await (const event of runConversationEngine(config, {
                        callTurn,
                        waitUntilRunning: () => pausedGate.wait(),
                        isStopped: () => stopRequested,
                        getSignal: () => abortController?.signal,
                    })) {
                        if (event.type === "empty_message") {
                            pausedGate.pause();
                        }
                        handlers.onEvent(event);
                    }
                } catch (error) {
                    handlers.onEvent({
                        type: "error",
                        message: error instanceof Error ? error.message : "Hosted conversation failed",
                    });
                }
            })();
        },
        pause() {
            pausedGate.pause();
            abortController?.abort();
        },
        resume() {
            pausedGate.resume();
        },
        retry() {
            pausedGate.resume();
        },
        stop() {
            stopRequested = true;
            pausedGate.resume();
            abortController?.abort();
        },
        dispose() {
            stopRequested = true;
            pausedGate.resume();
            abortController?.abort();
            abortController = null;
        },
    };

    async function callTurn(
        systemPrompt: string,
        messages: ConversationTurnMessage[],
        model: string,
        signal?: AbortSignal,
    ): Promise<TurnResult> {
        const openRouterKey = getStoredOpenRouterKey();
        if (!openRouterKey) {
            throw new Error("Set an OpenRouter API key to start hosted conversations.");
        }

        abortController = new AbortController();
        if (signal) {
            if (signal.aborted) {
                abortController.abort();
            } else {
                signal.addEventListener("abort", () => abortController?.abort(), { once: true });
            }
        }

        const response = await fetch(apiUrl("/api/turn"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                system_prompt: systemPrompt,
                messages,
                model,
                openrouter_key: openRouterKey,
            }),
            signal: abortController.signal,
        });

        if (!response.ok) {
            throw new Error(await readError(response));
        }
        if (!response.body) {
            throw new Error("Hosted turn response body was empty.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let content = "";

        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
            let boundaryIndex = buffer.indexOf("\n\n");
            while (boundaryIndex !== -1) {
                const rawEvent = buffer.slice(0, boundaryIndex);
                buffer = buffer.slice(boundaryIndex + 2);
                const payload = parseSsePayload(rawEvent);
                if (payload?.type === "delta") {
                    content += String(payload.content ?? "");
                }
                if (payload?.type === "result") {
                    return {
                        content: String(payload.content ?? content),
                        thinking: String(payload.thinking ?? ""),
                    };
                }
                if (payload?.type === "error") {
                    throw new Error(String(payload.message ?? "Hosted turn failed"));
                }
                boundaryIndex = buffer.indexOf("\n\n");
            }
            if (done) {
                break;
            }
        }

        return {
            content,
            thinking: "",
        };
    }
}

async function readError(response: Response): Promise<string> {
    try {
        const data = await response.json();
        return String(data.detail ?? data.message ?? `Hosted turn failed (${response.status})`);
    } catch {
        return `Hosted turn failed (${response.status})`;
    }
}

function parseSsePayload(rawEvent: string): Record<string, unknown> | null {
    const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart());
    if (dataLines.length === 0) {
        return null;
    }
    return JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
}
