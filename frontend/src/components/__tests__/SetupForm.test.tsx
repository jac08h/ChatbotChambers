import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SetupForm } from "../SetupForm"

const mockModels = [
    { id: "model-1", name: "Model One" },
    { id: "model-2", name: "Model Two" },
]

const mockProviders = { openrouter: true, claude_code: false, codex: false }

const mockPresets = [
    {
        id: "debate",
        name: "Debate",
        shared_system_prompt: "You are debating.",
        system_prompt_a: "You argue for.",
        system_prompt_b: "You argue against.",
    },
]

beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
        if (url.includes("/providers")) {
            return Promise.resolve({ json: () => Promise.resolve(mockProviders) })
        }
        if (url.includes("/presets")) {
            return Promise.resolve({ json: () => Promise.resolve(mockPresets) })
        }
        if (url.includes("/models")) {
            return Promise.resolve({ json: () => Promise.resolve(mockModels) })
        }
        return Promise.reject(new Error("Unknown URL"))
    }))
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("SetupForm", () => {
    it("renders the form with Convene button", async () => {
        render(<SetupForm onStart={vi.fn()} error={null} />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Convene" })).toBeInTheDocument())
    })

    it("fetches and displays models on mount", async () => {
        render(<SetupForm onStart={vi.fn()} error={null} />)
        await waitFor(() => expect(screen.getAllByText("Model One")).toHaveLength(2))
    })

    it("shows preset selector when presets are available", async () => {
        render(<SetupForm onStart={vi.fn()} error={null} />)
        await waitFor(() => expect(screen.getByText("Debate")).toBeInTheDocument())
    })

    it("loading a preset fills shared and individual prompts", async () => {
        render(<SetupForm onStart={vi.fn()} error={null} />)
        await waitFor(() => screen.getByText("Debate"))
        const presetSelect = screen.getAllByRole("combobox")[0]
        await userEvent.selectOptions(presetSelect, "debate")
        expect(screen.getByDisplayValue("You are debating.")).toBeInTheDocument()
        expect(screen.getByDisplayValue("You argue for.")).toBeInTheDocument()
        expect(screen.getByDisplayValue("You argue against.")).toBeInTheDocument()
    })

    it("submit calls onStart with correct SessionConfig shape", async () => {
        const onStart = vi.fn()
        render(<SetupForm onStart={onStart} error={null} />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Convene" })).not.toBeDisabled())
        await userEvent.click(screen.getByRole("button", { name: "Convene" }))
        expect(onStart).toHaveBeenCalledOnce()
        const config = onStart.mock.calls[0][0]
        expect(config).toHaveProperty("chatbot_a")
        expect(config).toHaveProperty("chatbot_b")
        expect(config).toHaveProperty("shared_system_prompt")
        expect(config).toHaveProperty("max_turns")
        expect(config.chatbot_a.model).toBeTruthy()
        expect(config.chatbot_b.model).toBeTruthy()
    })

    it("shows error banner when error prop is set", async () => {
        render(<SetupForm onStart={vi.fn()} error="API key missing" />)
        expect(screen.getByText("API key missing")).toBeInTheDocument()
    })

    it("Convene button is disabled when no models loaded", () => {
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ json: () => Promise.resolve([]) })))
        render(<SetupForm onStart={vi.fn()} error={null} />)
        expect(screen.getByRole("button", { name: "Convene" })).toBeDisabled()
    })
})
