import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiUrl } from "../../api"
import { SetupForm } from "../SetupForm"

const mockModels = [
    { id: "model-1", name: "Model One" },
    { id: "model-2", name: "Model Two" },
]

const mockProviders = { openrouter: true, claude_code: false, codex: false }

interface MockPreset {
    id: string
    name: string
    shared_system_prompt: string
    system_prompt_a: string
    system_prompt_b: string
    config?: unknown
}

const mockPresets: MockPreset[] = [
    {
        id: "debate",
        name: "Debate",
        shared_system_prompt: "You are debating.",
        system_prompt_a: "You argue for.",
        system_prompt_b: "You argue against.",
    },
]

function createFetchMock({
    presets = mockPresets,
    settings = {},
    providers = mockProviders,
}: {
    presets?: MockPreset[]
    settings?: unknown
    providers?: typeof mockProviders
} = {}) {
    let currentPresets = [...presets]

    return vi.fn((url: string, options?: RequestInit) => {
        if (url.includes("/settings") && options?.method === "POST") {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        }
        if (url.includes("/settings")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(settings) })
        }
        if (url.includes("/providers")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(providers) })
        }
        if (url.includes("/presets") && options?.method === "POST") {
            const body = JSON.parse(String(options.body))
            const savedPreset = {
                id: "saved-preset",
                name: body.name,
                shared_system_prompt: body.config.shared_system_prompt,
                system_prompt_a: body.config.chatbot_a.system_prompt,
                system_prompt_b: body.config.chatbot_b.system_prompt,
                config: body.config,
            }
            currentPresets = [savedPreset, ...currentPresets]
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(savedPreset),
            })
        }
        if (url.includes("/presets/") && options?.method === "PATCH") {
            const presetId = url.split("/").at(-1)
            const body = JSON.parse(String(options.body))
            currentPresets = currentPresets.map((preset) => (
                preset.id === presetId ? { ...preset, name: body.name } : preset
            ))
            const renamedPreset = currentPresets.find((preset) => preset.id === presetId)
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(renamedPreset),
            })
        }
        if (url.includes("/presets/") && options?.method === "DELETE") {
            const presetId = url.split("/").at(-1)
            currentPresets = currentPresets.filter((preset) => preset.id !== presetId)
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        }
        if (url.includes("/presets")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(currentPresets) })
        }
        if (url.includes("/models")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockModels) })
        }
        return Promise.reject(new Error("Unknown URL"))
    })
}

beforeEach(() => {
    vi.stubGlobal("fetch", createFetchMock())
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe("SetupForm", () => {
    it("renders the form with Start button", async () => {
        render(<SetupForm onStart={vi.fn()} error={null} />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Start conversation" })).toBeInTheDocument())
    })

    it("fetches and displays models on mount", async () => {
        render(<SetupForm onStart={vi.fn()} error={null} />)
        await waitFor(() => expect(screen.getAllByText("Model One")).toHaveLength(2))
    })

    it("shows preset selector when presets are available", async () => {
        render(<SetupForm onStart={vi.fn()} error={null} />)
        const presetSelect = await waitFor(() => screen.getAllByRole("combobox")[0])
        const options = Array.from((presetSelect as HTMLSelectElement).options).map((o) => o.text)
        expect(options).toContain("Debate")
        expect((presetSelect as HTMLSelectElement).value).toBe("")
    })

    it("loading a preset fills shared and individual prompts", async () => {
        render(<SetupForm onStart={vi.fn()} error={null} />)
        const presetSelect = await waitFor(() => screen.getAllByRole("combobox")[0])
        await userEvent.selectOptions(presetSelect, "debate")
        expect(screen.getByDisplayValue("You are debating.")).toBeInTheDocument()
        expect(screen.getByDisplayValue("You argue for.")).toBeInTheDocument()
        expect(screen.getByDisplayValue("You argue against.")).toBeInTheDocument()
    })

    it("loading a saved preset restores the full saved configuration", async () => {
        vi.stubGlobal("fetch", createFetchMock({
            providers: { openrouter: true, claude_code: true, codex: true },
            presets: [
                {
                    id: "full-preset",
                    name: "Full preset",
                    shared_system_prompt: "Saved shared prompt",
                    system_prompt_a: "Prompt A",
                    system_prompt_b: "Prompt B",
                    config: {
                        chatbot_a: {
                            name: "Preset A",
                            model: "model-2",
                            system_prompt: "Prompt A",
                            provider: "codex",
                        },
                        chatbot_b: {
                            name: "Preset B",
                            model: "model-1",
                            system_prompt: "Prompt B",
                            provider: "openrouter",
                        },
                        shared_system_prompt: "Saved shared prompt",
                    },
                },
            ],
        }))

        render(<SetupForm onStart={vi.fn()} error={null} />)
        const presetSelect = await waitFor(() => screen.getAllByRole("combobox")[0])
        await userEvent.selectOptions(presetSelect, "full-preset")

        await waitFor(() => expect(screen.getByDisplayValue("Saved shared prompt")).toBeInTheDocument())
        expect(screen.getByDisplayValue("Prompt A")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Prompt B")).toBeInTheDocument()
        expect(screen.getAllByRole("button", { name: "Codex CLI" })[0]).toHaveClass("preset-chip-active")
        expect(screen.getAllByRole("combobox")[1]).toHaveValue("model-2")
        expect(screen.getAllByRole("combobox")[2]).toHaveValue("model-1")

        const advancedButtons = screen.getAllByRole("button", { name: /Advanced/ })
        await userEvent.click(advancedButtons[0])
        await userEvent.click(advancedButtons[1])
        expect(screen.getByDisplayValue("Preset A")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Preset B")).toBeInTheDocument()
    })

    it("saves the current configuration as a preset", async () => {
        const fetchMock = createFetchMock()
        vi.stubGlobal("fetch", fetchMock)

        render(<SetupForm onStart={vi.fn()} error={null} />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Start conversation" })).not.toBeDisabled())

        await userEvent.type(screen.getByLabelText("Shared prompt"), "Shared preset prompt")
        await userEvent.click(screen.getByRole("button", { name: "Save as preset" }))
        expect(screen.getByRole("dialog", { name: "Save preset" })).toBeInTheDocument()
        await userEvent.type(screen.getByLabelText("Preset name"), "My saved preset")
        await userEvent.click(screen.getByRole("button", { name: "Save" }))

        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save preset" })).not.toBeInTheDocument())
        const presetSelect = screen.getAllByRole("combobox")[0]
        const options = Array.from((presetSelect as HTMLSelectElement).options).map((o) => o.text)
        expect(options).toContain("My saved preset")
        expect(fetchMock).toHaveBeenCalledWith(
            apiUrl("/presets"),
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
            })
        )
        const saveCall = fetchMock.mock.calls.find(
            ([url, options]) => url === apiUrl("/presets") && options?.method === "POST"
        )
        expect(saveCall).toBeDefined()
        expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({
            name: "My saved preset",
            config: {
                shared_system_prompt: "Shared preset prompt",
            },
        })
    })

    it("renames and deletes presets through the preset actions", async () => {
        const fetchMock = createFetchMock()
        vi.stubGlobal("fetch", fetchMock)

        render(<SetupForm onStart={vi.fn()} error={null} />)
        const presetSelect = await waitFor(() => screen.getAllByRole("combobox")[0])
        await userEvent.selectOptions(presetSelect, "debate")

        await userEvent.click(screen.getByRole("button", { name: "Rename" }))
        expect(screen.getByRole("dialog", { name: "Rename preset" })).toBeInTheDocument()
        const input = screen.getByRole("dialog", { name: "Rename preset" }).querySelector("input")!
        await userEvent.clear(input)
        await userEvent.type(input, "Renamed preset")
        await userEvent.click(screen.getByRole("button", { name: "Save" }))

        await waitFor(() => {
            const opts = Array.from((presetSelect as HTMLSelectElement).options).map((o) => o.text)
            expect(opts).toContain("Renamed preset")
        })
        expect(fetchMock).toHaveBeenCalledWith(
            apiUrl("/presets/debate"),
            expect.objectContaining({
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
            })
        )

        await userEvent.click(screen.getByRole("button", { name: "Delete" }))
        expect(screen.getByRole("dialog", { name: "Delete preset" })).toBeInTheDocument()
        await userEvent.click(screen.getAllByRole("button", { name: "Delete" }).find((btn) => btn.closest(".confirmation-dialog"))!)

        await waitFor(() => {
            const opts = Array.from((presetSelect as HTMLSelectElement).options).map((o) => o.text)
            expect(opts).not.toContain("Renamed preset")
        })
        expect(fetchMock).toHaveBeenCalledWith(
            apiUrl("/presets/debate"),
            expect.objectContaining({
                method: "DELETE",
            })
        )
    })

    it("submit calls onStart with correct SessionConfig shape", async () => {
        const onStart = vi.fn()
        render(<SetupForm onStart={onStart} error={null} />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Start conversation" })).not.toBeDisabled())
        await userEvent.click(screen.getByRole("button", { name: "Start conversation" }))
        expect(onStart).toHaveBeenCalledOnce()
        const config = onStart.mock.calls[0][0]
        const initialTitle = onStart.mock.calls[0][1]
        expect(config).toHaveProperty("chatbot_a")
        expect(config).toHaveProperty("chatbot_b")
        expect(config).toHaveProperty("shared_system_prompt")
        expect(config.chatbot_a.model).toBeTruthy()
        expect(config.chatbot_b.model).toBeTruthy()
        expect(initialTitle).toBe("")
    })

    it("passes the optional conversation name to onStart", async () => {
        const onStart = vi.fn()
        render(<SetupForm onStart={onStart} error={null} />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Start conversation" })).not.toBeDisabled())
        await userEvent.click(screen.getByRole("button", { name: /Advanced/ }))
        await userEvent.type(screen.getByLabelText("Conversation name"), "Test chat")
        await userEvent.click(screen.getByRole("button", { name: "Start conversation" }))
        expect(onStart).toHaveBeenCalledWith(expect.anything(), "Test chat")
    })

    it("loads saved settings on mount", async () => {
        vi.stubGlobal("fetch", createFetchMock({
            settings: {
                chatbot_a: {
                    name: "Saved A",
                    model: "model-2",
                    system_prompt: "Prompt A",
                    provider: "openrouter",
                },
                chatbot_b: {
                    name: "Saved B",
                    model: "model-1",
                    system_prompt: "Prompt B",
                    provider: "openrouter",
                },
                shared_system_prompt: "Saved shared prompt",
            },
        }))

        render(<SetupForm onStart={vi.fn()} error={null} />)

        await waitFor(() => expect(screen.getByDisplayValue("Saved A")).toBeInTheDocument())
        expect(screen.getByDisplayValue("Saved B")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Saved shared prompt")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Prompt A")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Prompt B")).toBeInTheDocument()
    })

    it("shows error banner when error prop is set", async () => {
        render(<SetupForm onStart={vi.fn()} error="API key missing" />)
        await waitFor(() => expect(screen.getByText("API key missing")).toBeInTheDocument())
    })

    it("Start button is disabled when no models loaded", async () => {
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })))
        render(<SetupForm onStart={vi.fn()} error={null} />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Start conversation" })).toBeDisabled())
    })
})
