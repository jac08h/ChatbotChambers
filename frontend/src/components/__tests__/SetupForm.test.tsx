import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiUrl } from "../../api"
import { SetupForm } from "../SetupForm"

const mockModels = [
    { id: "model-1", name: "Model One" },
    { id: "model-2", name: "Model Two" },
]

const mockProviders = { openrouter: { available: false }, github_copilot: { available: true }, claude_code: { available: false }, codex: { available: false } }

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
    scenarios = mockPresets,
    settings = {},
    providers = mockProviders,
}: {
    scenarios?: MockPreset[]
    settings?: unknown
    providers?: typeof mockProviders
} = {}) {
    let currentPresets = [...scenarios]

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
        if (url.includes("/scenarios") && options?.method === "POST") {
            const body = JSON.parse(String(options.body))
            const savedPreset = {
                id: "saved-scenario",
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
        if (url.includes("/scenarios/") && options?.method === "PATCH") {
            const scenarioId = url.split("/").at(-1)
            const body = JSON.parse(String(options.body))
            currentPresets = currentPresets.map((scenario) => (
                scenario.id === scenarioId ? { ...scenario, name: body.name } : scenario
            ))
            const renamedPreset = currentPresets.find((scenario) => scenario.id === scenarioId)
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(renamedPreset),
            })
        }
        if (url.includes("/scenarios/") && options?.method === "DELETE") {
            const scenarioId = url.split("/").at(-1)
            currentPresets = currentPresets.filter((scenario) => scenario.id !== scenarioId)
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        }
        if (url.includes("/scenarios")) {
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

    it("shows scenario selector when scenarios are available", async () => {
        render(<SetupForm onStart={vi.fn()} error={null} />)
        const scenarioSelect = await waitFor(() => screen.getAllByRole("combobox")[0])
        const options = Array.from((scenarioSelect as HTMLSelectElement).options).map((o) => o.text)
        expect(options).toContain("Debate")
        expect((scenarioSelect as HTMLSelectElement).value).toBe("")
    })

    it("loading a scenario fills shared and individual prompts", async () => {
        render(<SetupForm onStart={vi.fn()} error={null} />)
        const scenarioSelect = await waitFor(() => screen.getAllByRole("combobox")[0])
        await waitFor(() => expect(screen.getByRole("option", { name: "Debate" })).toBeInTheDocument())
        await userEvent.selectOptions(scenarioSelect, "debate")
        expect(screen.getByDisplayValue("You are debating.")).toBeInTheDocument()
        expect(screen.getByDisplayValue("You argue for.")).toBeInTheDocument()
        expect(screen.getByDisplayValue("You argue against.")).toBeInTheDocument()
    })

    it("loading a saved scenario restores the full saved configuration", async () => {
        vi.stubGlobal("fetch", createFetchMock({
            providers: { openrouter: { available: false }, github_copilot: { available: true }, claude_code: { available: true }, codex: { available: true } },
            scenarios: [
                {
                    id: "full-scenario",
                    name: "Full scenario",
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
                            provider: "github_copilot",
                        },
                        shared_system_prompt: "Saved shared prompt",
                    },
                },
            ],
        }))

        render(<SetupForm onStart={vi.fn()} error={null} />)
        const scenarioSelect = await waitFor(() => screen.getAllByRole("combobox")[0])
        await userEvent.selectOptions(scenarioSelect, "full-scenario")

        await waitFor(() => expect(screen.getByDisplayValue("Saved shared prompt")).toBeInTheDocument())
        expect(screen.getByDisplayValue("Prompt A")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Prompt B")).toBeInTheDocument()
        expect(screen.getAllByRole("button", { name: "Codex CLI" })[0]).toHaveClass("scenario-chip-active")
        expect(screen.getAllByRole("combobox")[1]).toHaveValue("model-2")
        expect(screen.getAllByRole("combobox")[2]).toHaveValue("model-1")

        const advancedButtons = screen.getAllByRole("button", { name: /Advanced/ })
        await userEvent.click(advancedButtons[0])
        await userEvent.click(advancedButtons[1])
        expect(screen.getByDisplayValue("Preset A")).toBeInTheDocument()
        expect(screen.getByDisplayValue("Preset B")).toBeInTheDocument()
    })

    it("saves the current configuration as a scenario", async () => {
        const fetchMock = createFetchMock()
        vi.stubGlobal("fetch", fetchMock)

        render(<SetupForm onStart={vi.fn()} error={null} />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Start conversation" })).not.toBeDisabled())

        await userEvent.type(screen.getByLabelText("Shared instructions"), "Shared scenario prompt")
        await userEvent.click(screen.getByRole("button", { name: "Save as scenario" }))
        expect(screen.getByRole("dialog", { name: "Save scenario" })).toBeInTheDocument()
        await userEvent.type(screen.getByLabelText("Preset name"), "My saved scenario")
        await userEvent.click(screen.getByRole("button", { name: "Save" }))

        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save scenario" })).not.toBeInTheDocument())
        const scenarioSelect = screen.getAllByRole("combobox")[0]
        const options = Array.from((scenarioSelect as HTMLSelectElement).options).map((o) => o.text)
        expect(options).toContain("My saved scenario")
        expect(fetchMock).toHaveBeenCalledWith(
            apiUrl("/scenarios"),
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
            })
        )
        const saveCall = fetchMock.mock.calls.find(
            ([url, options]) => url === apiUrl("/scenarios") && options?.method === "POST"
        )
        expect(saveCall).toBeDefined()
        expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({
            name: "My saved scenario",
            config: {
                shared_system_prompt: "Shared scenario prompt",
            },
        })
    })

    it("renames and deletes scenarios through the scenario actions", async () => {
        const fetchMock = createFetchMock()
        vi.stubGlobal("fetch", fetchMock)

        render(<SetupForm onStart={vi.fn()} error={null} />)
        const scenarioSelect = await waitFor(() => screen.getAllByRole("combobox")[0])
        await userEvent.selectOptions(scenarioSelect, "debate")

        await userEvent.click(screen.getByRole("button", { name: "Manage" }))
        await userEvent.click(screen.getByRole("button", { name: /Scenario options for/ }))
        await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }))
        expect(screen.getByRole("dialog", { name: "Rename scenario" })).toBeInTheDocument()
        const input = screen.getByRole("dialog", { name: "Rename scenario" }).querySelector("input")!
        await userEvent.clear(input)
        await userEvent.type(input, "Renamed scenario")
        await userEvent.click(screen.getByRole("button", { name: "Save" }))

        await waitFor(() => {
            const opts = Array.from((scenarioSelect as HTMLSelectElement).options).map((o) => o.text)
            expect(opts).toContain("Renamed scenario")
        })
        expect(fetchMock).toHaveBeenCalledWith(
            apiUrl("/scenarios/debate"),
            expect.objectContaining({
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
            })
        )

        await userEvent.click(screen.getByRole("button", { name: "Manage" }))
        await userEvent.click(screen.getByRole("button", { name: /Scenario options for/ }))
        await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }))
        expect(screen.getByRole("dialog", { name: "Delete scenario" })).toBeInTheDocument()
        await userEvent.click(screen.getAllByRole("button", { name: "Delete" }).find((btn) => btn.closest(".confirmation-dialog"))!)

        await waitFor(() => {
            const opts = Array.from((scenarioSelect as HTMLSelectElement).options).map((o) => o.text)
            expect(opts).not.toContain("Renamed scenario")
        })
        expect(fetchMock).toHaveBeenCalledWith(
            apiUrl("/scenarios/debate"),
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
        const advancedButtons = screen.getAllByRole("button", { name: /Advanced/ })
        await userEvent.click(advancedButtons[advancedButtons.length - 1])
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
                    provider: "github_copilot",
                },
                chatbot_b: {
                    name: "Saved B",
                    model: "model-1",
                    system_prompt: "Prompt B",
                    provider: "github_copilot",
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
        const fetchMock = vi.fn((url: string, options?: RequestInit) => {
            if (url.includes("/models")) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
            }
            return createFetchMock({ providers: mockProviders })(url, options)
        })
        vi.stubGlobal("fetch", fetchMock)
        render(<SetupForm onStart={vi.fn()} error={null} />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Start conversation" })).toBeDisabled())
    })
})
