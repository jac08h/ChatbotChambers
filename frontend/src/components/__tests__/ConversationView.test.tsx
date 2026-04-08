import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ConversationView } from "../ConversationView"
import type { ChatMessage, SessionConfig } from "../../hooks/useWebSocket"

const sampleConfig: SessionConfig = {
    chatbot_a: { name: "Alice", model: "model-a", system_prompt: "", provider: "openrouter" },
    chatbot_b: { name: "Bob", model: "model-b", system_prompt: "", provider: "openrouter" },
    shared_system_prompt: "",
    max_turns: 10,
}

function makeMessage(chatbot: "a" | "b", content: string, turn = 0): ChatMessage {
    return {
        chatbot,
        name: chatbot === "a" ? "Alice" : "Bob",
        model: "test-model",
        content,
        turn,
        thinking: "",
    }
}

const defaultProps = {
    messages: [],
    status: "idle" as const,
    generatingChatbot: null,
    doneReason: null,
    error: null,
    config: sampleConfig,
}

describe("ConversationView", () => {
    it("renders message bubbles for each message", () => {
        render(
            <ConversationView
                {...defaultProps}
                messages={[makeMessage("a", "Hello"), makeMessage("b", "Hi there")]}
            />
        )
        expect(screen.getByText("Hello")).toBeInTheDocument()
        expect(screen.getByText("Hi there")).toBeInTheDocument()
    })

    it("shows generating indicator in live mode when generatingChatbot is set", async () => {
        render(
            <ConversationView
                {...defaultProps}
                status="running"
                generatingChatbot="a"
            />
        )
        await userEvent.click(screen.getByRole("button", { name: "Live Conversation" }))
        expect(screen.getByText("composing")).toBeInTheDocument()
    })

    it("does not show generating indicator in transcript mode", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="running"
                generatingChatbot="a"
            />
        )
        expect(screen.queryByText("composing")).not.toBeInTheDocument()
    })

    it("shows done banner when status is done", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="done"
                doneReason="max_turns"
            />
        )
        expect(screen.getByText("The evening's discourse has concluded.")).toBeInTheDocument()
    })

    it("done banner includes chatbot name for leave:a reason", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="done"
                doneReason="leave:a"
            />
        )
        expect(screen.getByText("Alice has left the parlor.")).toBeInTheDocument()
    })

    it("done banner includes chatbot name for leave:b reason", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="done"
                doneReason="leave:b"
            />
        )
        expect(screen.getByText("Bob has left the parlor.")).toBeInTheDocument()
    })

    it("shows error banner when status is error", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="error"
                error="Connection failed"
            />
        )
        expect(screen.getByText("Connection failed")).toBeInTheDocument()
    })

    it("shows Pause button when running and not readOnly", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="running"
                onPause={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    })

    it("shows Resume button when paused and not readOnly", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="paused"
                onResume={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument()
    })

    it("shows End Session button when running and not readOnly", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="running"
                onStop={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "End Session" })).toBeInTheDocument()
    })

    it("hides Pause/Stop buttons in readOnly mode", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="running"
                onPause={vi.fn()}
                onStop={vi.fn()}
                readOnly
            />
        )
        expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "End Session" })).not.toBeInTheDocument()
    })

    it("shows New Session button when done and not readOnly", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="done"
                doneReason="max_turns"
                onReset={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "New Session" })).toBeInTheDocument()
    })

    it("calls onPause when Pause button clicked", async () => {
        const onPause = vi.fn()
        render(
            <ConversationView
                {...defaultProps}
                status="running"
                onPause={onPause}
            />
        )
        await userEvent.click(screen.getByRole("button", { name: "Pause" }))
        expect(onPause).toHaveBeenCalledOnce()
    })

    it("displays sender name in message bubble", () => {
        render(
            <ConversationView
                {...defaultProps}
                messages={[makeMessage("a", "content")]}
            />
        )
        expect(screen.getByText("Alice")).toBeInTheDocument()
    })

    it("shows thinking block when message has thinking", () => {
        const message: ChatMessage = { ...makeMessage("a", "Answer"), thinking: "My reasoning" }
        render(<ConversationView {...defaultProps} messages={[message]} />)
        expect(screen.getByText("Thinking")).toBeInTheDocument()
        expect(screen.getByText("My reasoning")).toBeInTheDocument()
    })

    it("transcript mode shows all messages", () => {
        const messages = [
            makeMessage("a", "First from A", 0),
            makeMessage("b", "First from B", 0),
            makeMessage("a", "Second from A", 1),
        ]
        render(<ConversationView {...defaultProps} messages={messages} />)
        expect(screen.getByText("First from A")).toBeInTheDocument()
        expect(screen.getByText("First from B")).toBeInTheDocument()
        expect(screen.getByText("Second from A")).toBeInTheDocument()
    })

    it("live mode shows only latest message per chatbot", async () => {
        const messages = [
            makeMessage("a", "First from A", 0),
            makeMessage("b", "First from B", 0),
            makeMessage("a", "Second from A", 1),
        ]
        render(<ConversationView {...defaultProps} messages={messages} />)
        await userEvent.click(screen.getByRole("button", { name: "Live Conversation" }))
        expect(screen.queryByText("First from A")).not.toBeInTheDocument()
        expect(screen.getByText("Second from A")).toBeInTheDocument()
        expect(screen.getByText("First from B")).toBeInTheDocument()
    })

    it("live mode shows generating indicator for currently generating chatbot", async () => {
        const messages = [makeMessage("a", "Hello", 0)]
        render(
            <ConversationView
                {...defaultProps}
                messages={messages}
                status="running"
                generatingChatbot="b"
            />
        )
        await userEvent.click(screen.getByRole("button", { name: "Live Conversation" }))
        expect(screen.getByText("composing")).toBeInTheDocument()
        expect(screen.getByText("Hello")).toBeInTheDocument()
    })
})
