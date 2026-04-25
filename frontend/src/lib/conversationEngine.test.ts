import { describe, expect, it, vi } from "vitest";
import { buildHistoryMessages, buildSystemPrompt, runConversationEngine } from "./conversationEngine";
import type { SessionConfig } from "./types";

const sampleConfig: SessionConfig = {
    chatbot_a: {
        name: "Alice",
        model: "openai/gpt-4.1-mini",
        system_prompt: "Prompt A",
        provider: "openrouter",
    },
    chatbot_b: {
        name: "Bob",
        model: "openai/gpt-4.1-mini",
        system_prompt: "Prompt B",
        provider: "openrouter",
    },
    shared_system_prompt: "Shared",
};

function runningDependencies(callTurn: Parameters<typeof runConversationEngine>[1]["callTurn"]) {
    return {
        callTurn,
        waitUntilRunning: vi.fn(async () => {}),
        isStopped: vi.fn(() => false),
    };
}

describe("conversationEngine", () => {
    it("alternates between chatbot A and B until /leave", async () => {
        const callTurn = vi.fn()
            .mockResolvedValueOnce({ content: "Hello", thinking: "" })
            .mockResolvedValueOnce({ content: "Hi", thinking: "" })
            .mockResolvedValueOnce({ content: "Again", thinking: "" })
            .mockResolvedValueOnce({ content: "/leave", thinking: "" });

        const events = [];
        for await (const event of runConversationEngine(sampleConfig, runningDependencies(callTurn))) {
            events.push(event);
        }

        const messageEvents = events.filter((event) => event.type === "message");
        expect(messageEvents).toHaveLength(4);
        expect(messageEvents.map((event) => event.data.chatbot)).toEqual(["a", "b", "a", "b"]);
        expect(events.at(-1)).toEqual({ type: "done", reason: "leave", chatbot: "b" });
    });

    it("pauses on empty responses and retries the same chatbot", async () => {
        const callTurn = vi.fn()
            .mockResolvedValueOnce({ content: "", thinking: "" })
            .mockResolvedValueOnce({ content: "/leave", thinking: "" });

        const events = [];
        for await (const event of runConversationEngine(sampleConfig, runningDependencies(callTurn))) {
            events.push(event);
        }

        expect(events[0]).toEqual({ type: "generating", chatbot: "a" });
        expect(events[1]).toEqual({ type: "empty_message", chatbot: "a" });
        expect(events[2]).toEqual({ type: "generating", chatbot: "a" });
        expect(events[3].type).toBe("message");
    });

    it("stops immediately when the external stop signal is set", async () => {
        const callTurn = vi.fn();
        const events = [];
        for await (const event of runConversationEngine(sampleConfig, {
            callTurn,
            waitUntilRunning: vi.fn(async () => {}),
            isStopped: vi.fn(() => true),
        })) {
            events.push(event);
        }

        expect(events).toEqual([{ type: "done", reason: "stopped" }]);
        expect(callTurn).not.toHaveBeenCalled();
    });

    it("builds prompts by joining all non-empty parts", () => {
        expect(buildSystemPrompt("A", "Shared", "Individual")).toContain("Shared");
        expect(buildSystemPrompt("A", "   ", "")).not.toContain("Shared");
    });

    it("copies history messages without mutation", () => {
        const history = [{ speaker: "a" as const, content: "Hello" }];
        const result = buildHistoryMessages(history);
        expect(result).toEqual(history);
        expect(result).not.toBe(history);
    });
});
