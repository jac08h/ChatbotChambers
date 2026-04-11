import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useWebSocket, type SessionConfig } from "../useWebSocket"

const sampleConfig: SessionConfig = {
    chatbot_a: { name: "A", model: "model-a", system_prompt: "sys a", provider: "openrouter" },
    chatbot_b: { name: "B", model: "model-b", system_prompt: "sys b", provider: "openrouter" },
    shared_system_prompt: "shared",
}

class MockWebSocket {
    url: string
    send = vi.fn()
    close = vi.fn()
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onerror: (() => void) | null = null
    onclose: (() => void) | null = null

    constructor(url: string) {
        this.url = url
        MockWebSocket.instances.push(this)
    }

    static instances: MockWebSocket[] = []
    static reset() { MockWebSocket.instances = [] }

    open() { this.onopen?.() }
    receive(data: object) { this.onmessage?.({ data: JSON.stringify(data) }) }
    error() { this.onerror?.() }
}

beforeEach(() => {
    MockWebSocket.reset()
    vi.stubGlobal("WebSocket", MockWebSocket)
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })))
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("useWebSocket", () => {
    it("starts with idle status and empty messages", () => {
        const { result } = renderHook(() => useWebSocket())
        expect(result.current.status).toBe("idle")
        expect(result.current.messages).toEqual([])
        expect(result.current.generatingChatbot).toBeNull()
    })

    it("start() opens a WebSocket connection", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        expect(MockWebSocket.instances).toHaveLength(1)
        expect(MockWebSocket.instances[0].url).toContain("ws://")
    })

    it("sends start message on WebSocket open", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        expect(MockWebSocket.instances[0].send).toHaveBeenCalledOnce()
        const sent = JSON.parse(MockWebSocket.instances[0].send.mock.calls[0][0])
        expect(sent.type).toBe("start")
        expect(sent.config).toEqual(sampleConfig)
    })

    it("sets status to running after open", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        expect(result.current.status).toBe("running")
    })

    it("receiving 'generating' sets generatingChatbot", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "generating", chatbot: "a" }) })
        expect(result.current.generatingChatbot).toBe("a")
    })

    it("receiving 'message' appends to messages and clears generatingChatbot", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "generating", chatbot: "a" }) })
        act(() => {
            MockWebSocket.instances[0].receive({
                type: "message",
                data: { chatbot: "a", name: "A", model: "m", content: "Hello", turn: 0, thinking: "" },
            })
        })
        expect(result.current.messages).toHaveLength(1)
        expect(result.current.messages[0].content).toBe("Hello")
        expect(result.current.generatingChatbot).toBeNull()
    })

    it("receiving 'done' sets status to done and captures reason", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "done", reason: "stopped" }) })
        expect(result.current.status).toBe("done")
        expect(result.current.doneReason).toBe("stopped")
    })

    it("receiving 'done' with leave reason includes chatbot", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "done", reason: "leave", chatbot: "b" }) })
        expect(result.current.doneReason).toBe("leave:b")
    })

    it("receiving 'error' sets status to error and captures message", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "error", message: "Something broke" }) })
        expect(result.current.status).toBe("error")
        expect(result.current.error).toBe("Something broke")
    })

    it("WebSocket error event sets status to error", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].error() })
        expect(result.current.status).toBe("error")
        expect(result.current.error).toBe("WebSocket connection error")
    })

    it("pause() sends pause message and sets status to paused", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { result.current.pause() })
        const sent = JSON.parse(MockWebSocket.instances[0].send.mock.calls[1][0])
        expect(sent.type).toBe("pause")
        expect(result.current.status).toBe("paused")
    })

    it("resume() sends resume message and sets status to running", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { result.current.pause() })
        act(() => { result.current.resume() })
        const sent = JSON.parse(MockWebSocket.instances[0].send.mock.calls[2][0])
        expect(sent.type).toBe("resume")
        expect(result.current.status).toBe("running")
    })

    it("reset() closes WebSocket and clears all state", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => {
            MockWebSocket.instances[0].receive({
                type: "message",
                data: { chatbot: "a", name: "A", model: "m", content: "Hi", turn: 0, thinking: "" },
            })
        })
        act(() => { result.current.reset() })
        expect(MockWebSocket.instances[0].close).toHaveBeenCalled()
        expect(result.current.status).toBe("idle")
        expect(result.current.messages).toEqual([])
        expect(result.current.config).toBeNull()
    })

    it("calling start() again closes previous WebSocket", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { result.current.start(sampleConfig) })
        expect(MockWebSocket.instances[0].close).toHaveBeenCalled()
    })

    it("done event archives session to history", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "session_id", id: "session-1" }) })
        act(() => {
            MockWebSocket.instances[0].receive({
                type: "message",
                data: { chatbot: "a", name: "A", model: "m", content: "Hello world", turn: 0, thinking: "" },
            })
        })
        act(() => { MockWebSocket.instances[0].receive({ type: "done", reason: "stopped" }) })
        expect(result.current.history).toHaveLength(1)
        expect(result.current.history[0].doneReason).toBe("stopped")
        expect(result.current.history[0].messages).toHaveLength(1)
    })

    it("archived session has an id label", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "session_id", id: "test-id" }) })
        act(() => { MockWebSocket.instances[0].receive({ type: "done", reason: "stopped" }) })
        expect(result.current.history[0].title).toBeNull()
    })

    it("current session id is set on session_id and cleared on reset", () => {
        const { result } = renderHook(() => useWebSocket())
        expect(result.current.currentSessionId).toBeNull()
        act(() => { result.current.start(sampleConfig) })
        expect(result.current.currentSessionId).toBeNull()
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "session_id", id: "test-uuid" }) })
        expect(result.current.currentSessionId).toBe("test-uuid")
        act(() => { result.current.reset() })
        expect(result.current.currentSessionId).toBeNull()
    })

    it("error event archives session to history", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "session_id", id: "session-1" }) })
        act(() => { MockWebSocket.instances[0].receive({ type: "error", message: "oops" }) })
        expect(result.current.history).toHaveLength(1)
        expect(result.current.history[0].error).toBe("oops")
    })

    it("reset() archives a paused session", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "session_id", id: "session-1" }) })
        act(() => {
            MockWebSocket.instances[0].receive({
                type: "message",
                data: { chatbot: "a", name: "A", model: "m", content: "Hi", turn: 0, thinking: "" },
            })
        })
        act(() => { result.current.pause() })
        act(() => { result.current.reset() })
        expect(result.current.history).toHaveLength(1)
        expect(result.current.history[0].doneReason).toBe("stopped")
    })

    it("starting a second conversation archives the first", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "session_id", id: "session-1" }) })
        act(() => {
            MockWebSocket.instances[0].receive({
                type: "message",
                data: { chatbot: "a", name: "A", model: "m", content: "Hi", turn: 0, thinking: "" },
            })
        })
        act(() => { result.current.start(sampleConfig) })
        expect(result.current.history).toHaveLength(1)
        expect(result.current.history[0].doneReason).toBe("stopped")
    })

    it("renameCurrentSession updates currentLabel", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "session_id", id: "session-1" }) })
        act(() => { result.current.renameCurrentSession("my-custom-name") })
        expect(result.current.currentTitle).toBe("my-custom-name")
    })

    it("renameSession updates title in history", () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "session_id", id: "session-1" }) })
        act(() => { MockWebSocket.instances[0].receive({ type: "done", reason: "stopped" }) })
        const id = result.current.history[0].id
        act(() => { result.current.renameSession(id, "renamed") })
        expect(result.current.history[0].title).toBe("renamed")
    })

    it("deleteSession removes session from history", async () => {
        const { result } = renderHook(() => useWebSocket())
        act(() => { result.current.start(sampleConfig) })
        act(() => { MockWebSocket.instances[0].open() })
        act(() => { MockWebSocket.instances[0].receive({ type: "session_id", id: "session-1" }) })
        act(() => { MockWebSocket.instances[0].receive({ type: "done", reason: "stopped" }) })
        expect(result.current.history).toHaveLength(1)

        await act(async () => {
            await result.current.deleteSession("session-1")
        })

        expect(result.current.history).toEqual([])
    })
})
