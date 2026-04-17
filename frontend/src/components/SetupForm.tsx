import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "../api";
import { type Provider, type SessionConfig } from "../hooks/useWebSocket";
import { loadSettings, saveSettings } from "../settings";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { RenameDialog } from "./RenameDialog";

interface Model {
    id: string;
    name: string;
}

interface Scenario {
    id: string;
    name: string;
    shared_system_prompt: string;
    system_prompt_a: string;
    system_prompt_b: string;
    config?: SessionConfig;
}

interface Providers {
    openrouter: boolean;
    claude_code: boolean;
    codex: boolean;
    mock?: boolean;
}

interface SetupFormProps {
    onStart: (config: SessionConfig, initialTitle: string) => void;
    error: string | null;
}

const PROVIDER_LABELS: Record<Provider, string> = {
    openrouter: "OpenRouter",
    claude_code: "Claude Code",
    codex: "Codex CLI",
    mock: "Mock",
};
const DEFAULT_OPENROUTER_MODEL = "google/gemini-3.1-flash-lite-preview";
const DEFAULT_PROVIDERS: Providers = {
    openrouter: true,
    claude_code: false,
    codex: false,
};

function defaultModelId(models: Model[], provider: Provider): string {
    if (models.length === 0) {
        return "";
    }
    if (provider === "openrouter") {
        const flashLite = models.find((model) => model.id === DEFAULT_OPENROUTER_MODEL);
        return flashLite ? flashLite.id : models[0].id;
    }
    return models[0].id;
}

function preferredModelId(models: Model[], provider: Provider, currentModel: string): string {
    if (models.some((model) => model.id === currentModel)) {
        return currentModel;
    }
    return defaultModelId(models, provider);
}

function shortModelName(model: Model): string {
    const name = model.name || model.id;
    const slashIndex = name.indexOf("/");
    return slashIndex !== -1 ? name.slice(slashIndex + 1) : name;
}

async function fetchModels(provider: Provider): Promise<Model[]> {
    const searchParams = new URLSearchParams({ provider });
    return fetch(apiUrl(`/models?${searchParams.toString()}`))
        .then((r) => r.json())
        .catch(() => []);
}

interface ChatbotConfigProps {
    side: "a" | "b";
    label: string;
    providers: Provider[];
    models: Model[];
    provider: Provider;
    model: string;
    name: string;
    defaultName: string;
    prompt: string;
    enableThinking: boolean;
    onProviderChange: (p: Provider) => void;
    onModelChange: (m: string) => void;
    onNameChange: (n: string) => void;
    onPromptChange: (p: string) => void;
    onEnableThinkingChange: (v: boolean) => void;
}

function ChatbotConfig({
    side,
    label,
    providers,
    models,
    provider,
    model,
    name,
    defaultName,
    prompt,
    enableThinking,
    onProviderChange,
    onModelChange,
    onNameChange,
    onPromptChange,
    onEnableThinkingChange,
}: ChatbotConfigProps) {
    const [expanded, setExpanded] = useState(false);

    const selectedModel = models.find((m) => m.id === model);
    const displayName = selectedModel ? shortModelName(selectedModel) : model;

    return (
        <section className={`chatbot-config side-${side}`}>
            <div className="chatbot-config-header">
                <h3>{label}</h3>
            </div>

            <div className="field">
                <span className="field-label">Provider</span>
                <div className="provider-chips" role="group">
                    {providers.map((p) => (
                        <button
                            key={p}
                            type="button"
                            className={`scenario-chip${provider === p ? " scenario-chip-active" : ""}`}
                            onClick={() => onProviderChange(p)}
                        >
                            {PROVIDER_LABELS[p]}
                        </button>
                    ))}
                </div>
            </div>

            <label className="field">
                <span>Model</span>
                <select value={model} onChange={(event) => onModelChange(event.target.value)} title={displayName}>
                    {models.map((m) => (
                        <option key={m.id} value={m.id}>{shortModelName(m)}</option>
                    ))}
                </select>
            </label>

            <label className="field">
                <span>Instructions</span>
                <textarea
                    value={prompt}
                    onChange={(event) => onPromptChange(event.target.value)}
                    placeholder={`System prompt for ${label}`}
                    rows={3}
                />
            </label>

            <button
                type="button"
                className="advanced-toggle"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
            >
                {expanded ? "Hide advanced" : "Advanced"}
                <span className={`advanced-toggle-icon ${expanded ? "open" : ""}`}>›</span>
            </button>

            <div className={`advanced-fields ${expanded ? "" : "advanced-fields-hidden"}`} aria-hidden={!expanded}>
                <label className="field">
                    <span>Name</span>
                    <input
                        type="text"
                        value={name}
                        onChange={(event) => onNameChange(event.target.value)}
                        placeholder={defaultName}
                        tabIndex={expanded ? 0 : -1}
                    />
                </label>
                <label className="field thinking-toggle-field">
                    <input
                        type="checkbox"
                        checked={enableThinking}
                        onChange={(event) => onEnableThinkingChange(event.target.checked)}
                        disabled={provider !== "openrouter"}
                        tabIndex={expanded ? 0 : -1}
                    />
                    <span>Enable thinking</span>
                </label>
            </div>
        </section>
    );
}

export function SetupForm({ onStart, error }: SetupFormProps) {
    const [providers, setProviders] = useState<Providers>(DEFAULT_PROVIDERS);
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

    const [providerA, setProviderA] = useState<Provider>("openrouter");
    const [providerB, setProviderB] = useState<Provider>("openrouter");
    const [modelsA, setModelsA] = useState<Model[]>([]);
    const [modelsB, setModelsB] = useState<Model[]>([]);
    const [modelA, setModelA] = useState("");
    const [modelB, setModelB] = useState("");
    const [nameA, setNameA] = useState<string>("");
    const [nameB, setNameB] = useState<string>("");
    const [nameAManual, setNameAManual] = useState(false);
    const [nameBManual, setNameBManual] = useState(false);
    const [sharedPrompt, setSharedPrompt] = useState("");
    const [promptA, setPromptA] = useState("");
    const [promptB, setPromptB] = useState("");
    const [enableThinkingA, setEnableThinkingA] = useState(false);
    const [enableThinkingB, setEnableThinkingB] = useState(false);
    const [conversationTitle, setConversationTitle] = useState("");
    const [isConversationNameExpanded, setIsConversationNameExpanded] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isSaveScenarioOpen, setIsSaveScenarioOpen] = useState(false);
    const [scenarioName, setScenarioName] = useState("");
    const [saveScenarioError, setSaveScenarioError] = useState<string | null>(null);
    const [scenarioActionError, setScenarioActionError] = useState<string | null>(null);
    const [isSavingScenario, setIsSavingScenario] = useState(false);
    const [activeScenarioMutationId, setActiveScenarioMutationId] = useState<string | null>(null);
    const [scenarioPendingDelete, setScenarioPendingDelete] = useState<Scenario | null>(null);
    const [scenarioPendingRename, setScenarioPendingRename] = useState<Scenario | null>(null);
    const [isManageScenariosOpen, setIsManageScenariosOpen] = useState(false);
    const [openScenarioRowMenuId, setOpenScenarioRowMenuId] = useState<string | null>(null);
    const scenarioManageRef = useRef<HTMLDivElement | null>(null);

    const closeSaveScenarioDialog = useCallback((forceClose = false) => {
        if (!forceClose && isSavingScenario) {
            return;
        }
        setIsSaveScenarioOpen(false);
        setScenarioName("");
        setSaveScenarioError(null);
    }, [isSavingScenario]);

    const openSaveScenarioDialog = () => {
        setSaveScenarioError(null);
        setIsSaveScenarioOpen(true);
    };

    useEffect(() => {
        let cancelled = false;

        async function initialize(): Promise<void> {
            const [providersData, scenariosData, settings] = await Promise.all([
                fetch(apiUrl("/providers"))
                    .then((response) => response.json())
                    .catch(() => DEFAULT_PROVIDERS),
                fetch(apiUrl("/scenarios"))
                    .then((response) => response.json())
                    .catch(() => []),
                loadSettings().catch(() => null),
            ]);

            if (cancelled) {
                return;
            }

            setProviders(providersData);
            setScenarios(scenariosData);

            const availableProviders = (Object.keys(providersData) as Provider[]).filter((provider) => providersData[provider]);
            const fallbackProvider = availableProviders[0] ?? "openrouter";
            const initialProviderA = settings?.chatbot_a.provider && providersData[settings.chatbot_a.provider]
                ? settings.chatbot_a.provider
                : fallbackProvider;
            const initialProviderB = settings?.chatbot_b.provider && providersData[settings.chatbot_b.provider]
                ? settings.chatbot_b.provider
                : fallbackProvider;

            const [initialModelsA, initialModelsB] = await Promise.all([
                fetchModels(initialProviderA),
                fetchModels(initialProviderB),
            ]);

            if (cancelled) {
                return;
            }

            setProviderA(initialProviderA);
            setProviderB(initialProviderB);
            setModelsA(initialModelsA);
            setModelsB(initialModelsB);
            const initialModelA = preferredModelId(initialModelsA, initialProviderA, settings?.chatbot_a.model ?? "");
            const initialModelB = preferredModelId(initialModelsB, initialProviderB, settings?.chatbot_b.model ?? "");
            setModelA(initialModelA);
            setModelB(initialModelB);
            const savedNameA = settings?.chatbot_a.name ?? "";
            const savedNameB = settings?.chatbot_b.name ?? "";
            const derivedNameA = shortModelName(initialModelsA.find((m) => m.id === initialModelA) ?? { id: initialModelA, name: initialModelA });
            const derivedNameB = shortModelName(initialModelsB.find((m) => m.id === initialModelB) ?? { id: initialModelB, name: initialModelB });
            const legacyNames = new Set(["LM A", "LM B"]);
            const isManualA = savedNameA !== "" && savedNameA !== derivedNameA && !legacyNames.has(savedNameA);
            const isManualB = savedNameB !== "" && savedNameB !== derivedNameB && !legacyNames.has(savedNameB);
            setNameA(isManualA ? savedNameA : "");
            setNameB(isManualB ? savedNameB : "");
            setNameAManual(isManualA);
            setNameBManual(isManualB);
            setSharedPrompt(settings?.shared_system_prompt ?? "");
            setPromptA(settings?.chatbot_a.system_prompt ?? "");
            setPromptB(settings?.chatbot_b.system_prompt ?? "");
            setEnableThinkingA(settings?.chatbot_a.enable_thinking ?? false);
            setEnableThinkingB(settings?.chatbot_b.enable_thinking ?? false);
            setIsInitialized(true);
        }

        initialize();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!isInitialized) {
            return;
        }
        fetchModels(providerA).then((data) => {
            setModelsA(data);
            setModelA((current) => preferredModelId(data, providerA, current));
        });
    }, [isInitialized, providerA]);

    useEffect(() => {
        if (!isInitialized) {
            return;
        }
        fetchModels(providerB).then((data) => {
            setModelsB(data);
            setModelB((current) => preferredModelId(data, providerB, current));
        });
    }, [isInitialized, providerB]);

    useEffect(() => {
        if (!nameAManual) {
            setNameA("");
        }
    }, [modelA, modelsA, nameAManual]);

    useEffect(() => {
        if (!nameBManual) {
            setNameB("");
        }
    }, [modelB, modelsB, nameBManual]);

    useEffect(() => {
        if (!isSaveScenarioOpen) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeSaveScenarioDialog();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [closeSaveScenarioDialog, isSaveScenarioOpen]);

    useEffect(() => {
        if (!isManageScenariosOpen) {
            return;
        }
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (target && scenarioManageRef.current && !scenarioManageRef.current.contains(target)) {
                setIsManageScenariosOpen(false);
                setOpenScenarioRowMenuId(null);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsManageScenariosOpen(false);
                setOpenScenarioRowMenuId(null);
            }
        };
        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isManageScenariosOpen]);

    const availableProviders = (Object.keys(providers) as Provider[]).filter((p) => providers[p]);

    const defaultNameA = (() => {
        const model = modelsA.find((m) => m.id === modelA);
        return model ? shortModelName(model) : modelA;
    })();
    const defaultNameB = (() => {
        const model = modelsB.find((m) => m.id === modelB);
        return model ? shortModelName(model) : modelB;
    })();

    const buildConfig = (): SessionConfig => ({
        chatbot_a: { name: nameA || defaultNameA, model: modelA, system_prompt: promptA, provider: providerA, enable_thinking: enableThinkingA },
        chatbot_b: { name: nameB || defaultNameB, model: modelB, system_prompt: promptB, provider: providerB, enable_thinking: enableThinkingB },
        shared_system_prompt: sharedPrompt,
    });

    const loadScenario = async (id: string) => {
        setScenarioActionError(null);
        const scenario = scenarios.find((item) => item.id === id);
        if (!scenario) {
            return;
        }
        setSelectedScenarioId(id);
        if (scenario.config) {
            const [scenarioModelsA, scenarioModelsB] = await Promise.all([
                fetchModels(scenario.config.chatbot_a.provider),
                fetchModels(scenario.config.chatbot_b.provider),
            ]);
            setProviderA(scenario.config.chatbot_a.provider);
            setProviderB(scenario.config.chatbot_b.provider);
            setModelsA(scenarioModelsA);
            setModelsB(scenarioModelsB);
            const scenarioModelA = preferredModelId(scenarioModelsA, scenario.config.chatbot_a.provider, scenario.config.chatbot_a.model);
            const scenarioModelB = preferredModelId(scenarioModelsB, scenario.config.chatbot_b.provider, scenario.config.chatbot_b.model);
            setModelA(scenarioModelA);
            setModelB(scenarioModelB);
            const scenarioDerivedNameA = shortModelName(scenarioModelsA.find((m) => m.id === scenarioModelA) ?? { id: scenarioModelA, name: scenarioModelA });
            const scenarioDerivedNameB = shortModelName(scenarioModelsB.find((m) => m.id === scenarioModelB) ?? { id: scenarioModelB, name: scenarioModelB });
            const scenarioNameA = scenario.config.chatbot_a.name;
            const scenarioNameB = scenario.config.chatbot_b.name;
            const isScenarioManualA = scenarioNameA !== "" && scenarioNameA !== scenarioDerivedNameA;
            const isScenarioManualB = scenarioNameB !== "" && scenarioNameB !== scenarioDerivedNameB;
            setNameA(isScenarioManualA ? scenarioNameA : "");
            setNameB(isScenarioManualB ? scenarioNameB : "");
            setNameAManual(isScenarioManualA);
            setNameBManual(isScenarioManualB);
            setSharedPrompt(scenario.config.shared_system_prompt);
            setPromptA(scenario.config.chatbot_a.system_prompt);
            setPromptB(scenario.config.chatbot_b.system_prompt);
            setEnableThinkingA(scenario.config.chatbot_a.enable_thinking ?? false);
            setEnableThinkingB(scenario.config.chatbot_b.enable_thinking ?? false);
            return;
        }
        setSharedPrompt(scenario.shared_system_prompt);
        setPromptA(scenario.system_prompt_a);
        setPromptB(scenario.system_prompt_b);
    };

    const handleSaveScenario = async () => {
        const trimmedScenarioName = scenarioName.trim();
        if (!trimmedScenarioName) {
            setSaveScenarioError("Enter a scenario name.");
            return;
        }
        setIsSavingScenario(true);
        setSaveScenarioError(null);
        setScenarioActionError(null);
        try {
            const response = await fetch(apiUrl("/scenarios"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: trimmedScenarioName,
                    config: buildConfig(),
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to save scenario");
            }
            const savedScenario: Scenario = await response.json();
            setScenarios((currentScenarios) => [savedScenario, ...currentScenarios]);
            setSelectedScenarioId(null);
            closeSaveScenarioDialog(true);
        } catch {
            setSaveScenarioError("Failed to save scenario.");
        } finally {
            setIsSavingScenario(false);
        }
    };

    const handleRenameScenario = async (scenarioId: string, nextName: string): Promise<boolean> => {
        setActiveScenarioMutationId(scenarioId);
        setScenarioActionError(null);
        try {
            const response = await fetch(apiUrl(`/scenarios/${scenarioId}`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: nextName }),
            });
            if (!response.ok) {
                throw new Error("Failed to rename scenario");
            }
            const renamedScenario: Scenario = await response.json();
            setScenarios((currentScenarios) => currentScenarios.map((scenario) => (
                scenario.id === scenarioId ? renamedScenario : scenario
            )));
            setScenarioPendingRename(null);
            return true;
        } catch {
            setScenarioActionError("Failed to rename scenario.");
            return false;
        } finally {
            setActiveScenarioMutationId(null);
        }
    };

    const handleDeleteScenario = async (): Promise<void> => {
        if (!scenarioPendingDelete) {
            return;
        }
        setActiveScenarioMutationId(scenarioPendingDelete.id);
        setScenarioActionError(null);
        try {
            const response = await fetch(apiUrl(`/scenarios/${scenarioPendingDelete.id}`), {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error("Failed to delete scenario");
            }
            setScenarios((currentScenarios) => currentScenarios.filter((item) => item.id !== scenarioPendingDelete.id));
            if (selectedScenarioId === scenarioPendingDelete.id) {
                setSelectedScenarioId(null);
            }
            setScenarioPendingDelete(null);
        } catch {
            setScenarioActionError("Failed to delete scenario.");
        } finally {
            setActiveScenarioMutationId(null);
        }
    };

    const handleClearAll = () => {
        setSelectedScenarioId(null);
        setSharedPrompt("");
        setPromptA("");
        setPromptB("");
        setNameA("");
        setNameB("");
        setNameAManual(false);
        setNameBManual(false);
        setConversationTitle("");
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const config = buildConfig();
        await saveSettings(config).catch(() => {});
        onStart(config, conversationTitle.trim());
    };

    const canStart = Boolean(modelA && modelB);

    return (
        <div className="setup-page">
            <div className="setup-landing">
                <h1 className="setup-title">Who&rsquo;s talking today?</h1>

                {error && <div className="error-banner">{error}</div>}

                <form onSubmit={handleSubmit} className="setup-form">
                    <div className="field">
                        <div className="scenario-header">
                            <span className="field-label">Preset</span>
                            <div className="scenario-header-actions">
                                <div className="scenario-manage" ref={scenarioManageRef}>
                                    <button
                                        type="button"
                                        className="scenario-action-link"
                                        onClick={() => {
                                            setIsManageScenariosOpen((open) => !open);
                                            setOpenScenarioRowMenuId(null);
                                        }}
                                        disabled={scenarios.length === 0}
                                        aria-haspopup="menu"
                                        aria-expanded={isManageScenariosOpen}
                                        title="Manage scenarios"
                                    >
                                        Manage
                                    </button>
                                    {isManageScenariosOpen && scenarios.length > 0 && (
                                        <div className="scenario-menu scenario-manage-list" role="menu">
                                            {scenarios.map((scenario) => (
                                                <div key={scenario.id} className="scenario-manage-row">
                                                    <span className="scenario-manage-name" title={scenario.name}>{scenario.name}</span>
                                                    <div className="scenario-manage-row-actions">
                                                        <button
                                                            type="button"
                                                            className="scenario-manage-row-btn"
                                                            onClick={() => setOpenScenarioRowMenuId((id) => (id === scenario.id ? null : scenario.id))}
                                                            aria-haspopup="menu"
                                                            aria-expanded={openScenarioRowMenuId === scenario.id}
                                                            aria-label={`Scenario options for ${scenario.name}`}
                                                            title="Preset options"
                                                            disabled={activeScenarioMutationId !== null}
                                                        >
                                                            ⋯
                                                        </button>
                                                        {openScenarioRowMenuId === scenario.id && (
                                                            <div className="scenario-menu scenario-row-menu" role="menu">
                                                                <button
                                                                    type="button"
                                                                    className="scenario-menu-item"
                                                                    role="menuitem"
                                                                    onClick={() => {
                                                                        setOpenScenarioRowMenuId(null);
                                                                        setIsManageScenariosOpen(false);
                                                                        setScenarioPendingRename(scenario);
                                                                    }}
                                                                >
                                                                    Rename
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="scenario-menu-item scenario-menu-item-danger"
                                                                    role="menuitem"
                                                                    onClick={() => {
                                                                        setOpenScenarioRowMenuId(null);
                                                                        setIsManageScenariosOpen(false);
                                                                        setScenarioPendingDelete(scenario);
                                                                    }}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="scenario-save-link"
                                    onClick={openSaveScenarioDialog}
                                    disabled={!canStart || isSavingScenario}
                                >
                                    Save as scenario
                                </button>
                                <button
                                    type="button"
                                    className="scenario-action-link preset-action-link-clear"
                                    onClick={handleClearAll}
                                    title="Clear all prompts and names"
                                >
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                        <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4M12.67 4v9.33a1.33 1.33 0 01-1.34 1.34H4.67a1.33 1.33 0 01-1.34-1.34V4" />
                                    </svg>
                                    Clear all
                                </button>
                            </div>
                        </div>
                        <select
                            value={selectedScenarioId ?? ""}
                            onChange={(event) => {
                                const id = event.target.value;
                                if (id) {
                                    loadScenario(id).catch(() => setScenarioActionError("Failed to load preset."));
                                } else {
                                    setSelectedScenarioId(null);
                                }
                            }}
                        >
                            <option value="">None</option>
                            {scenarios.map((scenario) => (
                                <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
                            ))}
                        </select>
                        {scenarioActionError && <div className="scenario-save-error">{scenarioActionError}</div>}
                        {isSaveScenarioOpen && (
                            <div
                                className="rename-dialog-backdrop"
                                role="presentation"
                                onClick={() => {
                                    if (!isSavingScenario) {
                                        closeSaveScenarioDialog();
                                    }
                                }}
                            >
                                <div
                                    className="rename-dialog"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="save-preset-title"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <div className="rename-dialog-header">
                                        <h2 id="save-preset-title" className="rename-dialog-title">Save scenario</h2>
                                    </div>
                                    <input
                                        type="text"
                                        className="rename-dialog-input"
                                        aria-label="Preset name"
                                        value={scenarioName}
                                        onChange={(event) => setScenarioName(event.target.value)}
                                        placeholder="Enter a preset name"
                                    />
                                    {saveScenarioError && <div className="scenario-save-error">{saveScenarioError}</div>}
                                    <div className="rename-dialog-actions">
                                        <button
                                            type="button"
                                            className="rename-dialog-cancel"
                                            onClick={() => closeSaveScenarioDialog()}
                                            disabled={isSavingScenario}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="rename-dialog-confirm"
                                            onClick={handleSaveScenario}
                                            disabled={isSavingScenario}
                                        >
                                            {isSavingScenario ? "Saving…" : "Save"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <label className="field">
                        <span>Shared prompt</span>
                        <textarea
                            value={sharedPrompt}
                            onChange={(event) => setSharedPrompt(event.target.value)}
                            placeholder="Instructions for both chatbots"
                            rows={3}
                        />
                    </label>

                    <div className="chatbot-configs">
                        <ChatbotConfig
                            side="a"
                            label="Chatbot A"
                            providers={availableProviders}
                            models={modelsA}
                            provider={providerA}
                            model={modelA}
                            name={nameA}
                            defaultName={defaultNameA}
                            prompt={promptA}
                            enableThinking={enableThinkingA}
                            onProviderChange={setProviderA}
                            onModelChange={setModelA}
                            onNameChange={(n) => { setNameA(n); setNameAManual(n !== ""); }}
                            onPromptChange={setPromptA}
                            onEnableThinkingChange={setEnableThinkingA}
                        />
                        <ChatbotConfig
                            side="b"
                            label="Chatbot B"
                            providers={availableProviders}
                            models={modelsB}
                            provider={providerB}
                            model={modelB}
                            name={nameB}
                            defaultName={defaultNameB}
                            prompt={promptB}
                            enableThinking={enableThinkingB}
                            onProviderChange={setProviderB}
                            onModelChange={setModelB}
                            onNameChange={(n) => { setNameB(n); setNameBManual(n !== ""); }}
                            onPromptChange={setPromptB}
                            onEnableThinkingChange={setEnableThinkingB}
                        />
                    </div>

                    <div className="setup-bottom">
                        <button
                            type="button"
                            className="advanced-toggle"
                            onClick={() => setIsConversationNameExpanded((prev) => !prev)}
                            aria-expanded={isConversationNameExpanded}
                        >
                            {isConversationNameExpanded ? "Hide advanced" : "Advanced"}
                            <span className={`advanced-toggle-icon ${isConversationNameExpanded ? "open" : ""}`}>›</span>
                        </button>
                        <div
                            className={`advanced-fields ${isConversationNameExpanded ? "" : "advanced-fields-hidden"}`}
                            aria-hidden={!isConversationNameExpanded}
                        >
                            <label className="field">
                                <span>Conversation name</span>
                                <input
                                    type="text"
                                    value={conversationTitle}
                                    onChange={(event) => setConversationTitle(event.target.value)}
                                    placeholder="Auto-generated if empty"
                                    tabIndex={isConversationNameExpanded ? 0 : -1}
                                />
                            </label>
                        </div>

                        <div className="setup-actions">
                            <button type="submit" className="start-btn" disabled={!canStart}>
                                Start conversation
                            </button>
                        </div>
                    </div>
                </form>
                <ConfirmationDialog
                    isOpen={scenarioPendingDelete !== null}
                    title="Delete scenario"
                    message={scenarioPendingDelete ? `Delete scenario "${scenarioPendingDelete.name}"?` : ""}
                    confirmLabel="Delete"
                    isConfirming={activeScenarioMutationId !== null}
                    onConfirm={() => { void handleDeleteScenario(); }}
                    onCancel={() => {
                        if (activeScenarioMutationId === null) {
                            setScenarioPendingDelete(null);
                        }
                    }}
                />
                <RenameDialog
                    key={scenarioPendingRename?.id ?? "scenario-rename-closed"}
                    isOpen={scenarioPendingRename !== null}
                    title="Rename scenario"
                    initialValue={scenarioPendingRename?.name ?? ""}
                    isSaving={activeScenarioMutationId !== null}
                    onConfirm={(value) => {
                        if (scenarioPendingRename) {
                            void handleRenameScenario(scenarioPendingRename.id, value);
                        }
                    }}
                    onCancel={() => {
                        if (activeScenarioMutationId === null) {
                            setScenarioPendingRename(null);
                        }
                    }}
                />
            </div>
        </div>
    );
}
