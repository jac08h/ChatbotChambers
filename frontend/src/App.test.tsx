import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import App from "./App"
import type { ArchivedSession, SessionConfig, WebSocketState } from "./hooks/useWebSocket"

const sampleConfig: SessionConfig = {
    chatbot_a: { name: "Alice", model: "model-a", system_prompt: "", provider: "openrouter" },
    chatbot_b: { name: "Bob", model: "model-b", system_prompt: "", provider: "openrouter" },
    shared_system_prompt: "",
}

const archivedSession: ArchivedSession = {
    id: "abcd1234-5678-9012-3456-abcdefabcdef",
    title: null,
    messages: [],
    config: sampleConfig,
    doneReason: "stopped",
    error: null,
}

let mockWebSocketState: WebSocketState

vi.mock("./hooks/useWebSocket", async () => {
    const actual = await vi.importActual<typeof import("./hooks/useWebSocket")>("./hooks/useWebSocket")
    return {
        ...actual,
        useWebSocket: () => mockWebSocketState,
    }
})

function createWebSocketState(overrides: Partial<WebSocketState> = {}): WebSocketState {
    return {
        messages: [],
        draftMessage: null,
        status: "idle",
        generatingChatbot: null,
        doneReason: null,
        error: null,
        config: null,
        currentSessionId: null,
        currentTitle: null,
        history: [],
        start: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        reset: vi.fn(),
        renameCurrentSession: vi.fn(),
        renameSession: vi.fn(),
        deleteSession: vi.fn(async () => true),
        ...overrides,
    }
}

describe("App", () => {
    beforeEach(() => {
        window.history.pushState({}, "", "/")
        mockWebSocketState = createWebSocketState()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it("updates the URL when selecting an archived conversation", async () => {
        mockWebSocketState = createWebSocketState({ history: [archivedSession] })
        render(<App />)
        await userEvent.click(screen.getByRole("button", { name: "abcd1234" }))
        expect(window.location.pathname).toBe(`/chat/${archivedSession.id}`)
    })

    it("loads a conversation from the current URL", () => {
        window.history.pushState({}, "", `/chat/${archivedSession.id}`)
        mockWebSocketState = createWebSocketState({ history: [archivedSession] })
        render(<App />)
        expect(screen.getByRole("heading", { name: "abcd1234" })).toBeInTheDocument()
    })
})
