import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ConversationView } from "../ConversationView"
import type { ChatMessage, SessionConfig } from "../../hooks/useWebSocket"

const sampleConfig: SessionConfig = {
    chatbot_a: { name: "Alice", model: "model-a", system_prompt: "", provider: "openrouter" },
    chatbot_b: { name: "Bob", model: "model-b", system_prompt: "", provider: "openrouter" },
    shared_system_prompt: "",
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

    it("shows generating indicator when generatingChatbot is set", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="running"
                generatingChatbot="a"
            />
        )
        expect(screen.getByText("composing")).toBeInTheDocument()
    })

    it("shows done banner when status is done", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="done"
                doneReason="stopped"
            />
        )
        expect(screen.getByText("Conversation stopped.")).toBeInTheDocument()
    })

    it("done banner includes chatbot name for leave:a reason", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="done"
                doneReason="leave:a"
            />
        )
        expect(screen.getByText("Alice left the chat.")).toBeInTheDocument()
    })

    it("done banner includes chatbot name for leave:b reason", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="done"
                doneReason="leave:b"
            />
        )
        expect(screen.getByText("Bob left the chat.")).toBeInTheDocument()
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

    it("shows Pause button when running", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="running"
                onPause={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    })

    it("shows Resume button when paused", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="paused"
                onResume={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument()
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

    it("shows all messages", () => {
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

    it("does not show controls when no callbacks provided", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="running"
            />
        )
        expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument()
    })

    it("shows New conversation button when done", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="done"
                doneReason="stopped"
                onNewConversation={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "New conversation" })).toBeInTheDocument()
    })

    it("shows Delete button when delete callback is provided", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="done"
                label="123e4567-e89b-12d3-a456-426614174000"
                onDeleteSession={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
    })
})
