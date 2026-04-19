import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import App from "./App"
import { generateSlug, type ArchivedSession, type SessionConfig, type WebSocketState } from "./hooks/useWebSocket"

const sampleConfig: SessionConfig = {
    chatbot_a: { name: "Alice", model: "model-a", system_prompt: "", provider: "openrouter", enable_thinking: false },
    chatbot_b: { name: "Bob", model: "model-b", system_prompt: "", provider: "openrouter", enable_thinking: false },
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

const archivedSlug = generateSlug(archivedSession.id)

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
        status: "idle",
        generatingChatbot: null,
        doneReason: null,
        error: null,
        startupError: null,
        emptyMessageError: null,
        config: null,
        currentSessionId: null,
        currentTitle: null,
        history: [],
        start: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        retry: vi.fn(),
        reset: vi.fn(),
        clearStartupError: vi.fn(),
        renameCurrentSession: vi.fn(),
        renameSession: vi.fn(),
        deleteSession: vi.fn(async () => true),
        deleteAllSessions: vi.fn(async () => true),
        ...overrides,
    }
}

describe("App", () => {
    beforeEach(() => {
        window.history.pushState({}, "", "/")
        window.localStorage.clear()
        delete document.documentElement.dataset.theme
        mockWebSocketState = createWebSocketState()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it("updates the URL when selecting an archived conversation", async () => {
        mockWebSocketState = createWebSocketState({ history: [archivedSession] })
        render(<App />)
        await userEvent.click(screen.getByRole("button", { name: archivedSlug }))
        expect(window.location.pathname).toBe(`/chat/${archivedSession.id}`)
    })

    it("loads a conversation from the current URL", () => {
        window.history.pushState({}, "", `/chat/${archivedSession.id}`)
        mockWebSocketState = createWebSocketState({ history: [archivedSession] })
        render(<App />)
        expect(screen.getByRole("heading", { name: archivedSlug })).toBeInTheDocument()
    })

    it("confirms before deleting an archived conversation", async () => {
        const deleteSession = vi.fn(async () => true)
        mockWebSocketState = createWebSocketState({ history: [archivedSession], deleteSession })
        render(<App />)

        await userEvent.click(screen.getByRole("button", { name: `Conversation options for ${archivedSlug}` }))
        await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }))

        expect(screen.getByRole("dialog", { name: "Delete conversation" })).toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: "Delete" }))

        await waitFor(() => expect(deleteSession).toHaveBeenCalledWith(archivedSession.id))
    })

    it("renames an archived conversation through the rename dialog", async () => {
        const renameSession = vi.fn()
        mockWebSocketState = createWebSocketState({ history: [archivedSession], renameSession })
        render(<App />)

        await userEvent.click(screen.getByRole("button", { name: `Conversation options for ${archivedSlug}` }))
        await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }))

        expect(screen.getByRole("dialog", { name: "Rename chat" })).toBeInTheDocument()
        const input = screen.getByDisplayValue(archivedSlug)
        await userEvent.clear(input)
        await userEvent.type(input, "Renamed chat")
        await userEvent.click(screen.getByRole("button", { name: "Save" }))

        await waitFor(() => expect(renameSession).toHaveBeenCalledWith(archivedSession.id, "Renamed chat"))
    })

    it("toggles the theme and persists the selection", async () => {
        render(<App />)

        expect(document.documentElement.dataset.theme).toBe("dark")

        await userEvent.click(screen.getByRole("button", { name: "Switch to light mode" }))

        expect(document.documentElement.dataset.theme).toBe("light")
        expect(window.localStorage.getItem("chatbotchambers-theme")).toBe("light")
        expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument()
    })

    it("shows startup errors as a popup on the intro screen", async () => {
        const clearStartupError = vi.fn()
        window.history.pushState({}, "", "/chat/failed-session")
        mockWebSocketState = createWebSocketState({
            startupError: "API key missing",
            clearStartupError,
        })

        render(<App />)

        await waitFor(() => expect(window.location.pathname).toBe("/"))
        expect(screen.getByRole("heading", { name: "Who’s talking today?" })).toBeInTheDocument()
        expect(screen.getByRole("dialog", { name: "Conversation failed to start" })).toBeInTheDocument()

        await userEvent.click(screen.getByRole("button", { name: "OK" }))

        expect(clearStartupError).toHaveBeenCalledOnce()
    })
})
