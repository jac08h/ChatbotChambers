import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ConversationView } from "../ConversationView"
import { buildMemoryBars } from "../conversationMemory"
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

    it("shows generating indicator in active mode when generatingChatbot is set", async () => {
        render(
            <ConversationView
                {...defaultProps}
                status="running"
                generatingChatbot="a"
            />
        )
        await userEvent.click(screen.getByRole("button", { name: "Active mode" }))
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
        expect(screen.getByText("Reached the turn limit.")).toBeInTheDocument()
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

    it("shows Stop button when running and not readOnly", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="running"
                onStop={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument()
    })

    it("hides Pause and Stop buttons in readOnly mode", () => {
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
        expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument()
    })

    it("shows New chat button when done and not readOnly", () => {
        render(
            <ConversationView
                {...defaultProps}
                status="done"
                doneReason="max_turns"
                onReset={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "New chat" })).toBeInTheDocument()
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

    it("active mode keeps only the latest message readable", async () => {
        const messages = [
            makeMessage("a", "First from A", 0),
            makeMessage("b", "First from B", 0),
            makeMessage("a", "Second from A", 1),
        ]
        render(<ConversationView {...defaultProps} messages={messages} />)
        await userEvent.click(screen.getByRole("button", { name: "Active mode" }))
        expect(screen.queryByText("First from A")).not.toBeInTheDocument()
        expect(screen.queryByText("First from B")).not.toBeInTheDocument()
        expect(screen.getByText("Second from A")).toBeInTheDocument()
    })

    it("active mode renders older turns as echo cards with depth", async () => {
        const messages = [
            makeMessage("a", "First from A", 0),
            makeMessage("b", "A much longer line from B so the memory bars vary a bit", 0),
            makeMessage("a", "Second from A", 1),
        ]
        const { container } = render(<ConversationView {...defaultProps} messages={messages} />)
        await userEvent.click(screen.getByRole("button", { name: "Active mode" }))

        const firstEcho = screen.getByTestId("echo-card-1")
        const secondEcho = screen.getByTestId("echo-card-2")

        expect(firstEcho).toHaveAttribute("data-depth", "1")
        expect(secondEcho).toHaveAttribute("data-depth", "2")
        expect(within(firstEcho).getByText("Bob")).toBeInTheDocument()
        expect(within(secondEcho).getByText("Alice")).toBeInTheDocument()
        const expectedLineCount = buildMemoryBars(messages[0].content).length + buildMemoryBars(messages[1].content).length
        expect(container.querySelectorAll(".memory-line")).toHaveLength(expectedLineCount)
    })

    it("active mode shows generating indicator for the current chatbot", async () => {
        const messages = [makeMessage("a", "Hello", 0)]
        render(
            <ConversationView
                {...defaultProps}
                messages={messages}
                status="running"
                generatingChatbot="b"
            />
        )
        await userEvent.click(screen.getByRole("button", { name: "Active mode" }))
        expect(screen.getByText("composing")).toBeInTheDocument()
        expect(screen.queryByText("Hello")).not.toBeInTheDocument()
    })
})

describe("buildMemoryBars", () => {
    it("returns stable widths for empty content", () => {
        expect(buildMemoryBars("")).toEqual([66, 48])
    })

    it("returns at least two bars for short content", () => {
        expect(buildMemoryBars("short")).toEqual([55, 37])
    })

    it("adds more bars for longer content", () => {
        expect(buildMemoryBars("This sentence is intentionally long enough to produce more than two memory bars in the echo stack.")).toEqual([44, 46, 46])
    })
})
