import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../api";
import { type Provider, type SessionConfig } from "../hooks/useWebSocket";
import { loadSettings, saveSettings } from "../settings";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { RenameDialog } from "./RenameDialog";

interface Model {
    id: string;
    name: string;
}

interface Preset {
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
}

interface SetupFormProps {
    onStart: (config: SessionConfig, initialTitle: string) => void;
    error: string | null;
}

const PROVIDER_LABELS: Record<Provider, string> = {
    openrouter: "OpenRouter",
    claude_code: "Claude Code",
    codex: "Codex CLI",
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
    prompt: string;
    onProviderChange: (p: Provider) => void;
    onModelChange: (m: string) => void;
    onNameChange: (n: string) => void;
    onPromptChange: (p: string) => void;
}

function ChatbotConfig({
    side,
    label,
    providers,
    models,
    provider,
    model,
    name,
    prompt,
    onProviderChange,
    onModelChange,
    onNameChange,
    onPromptChange,
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
                            className={`preset-chip${provider === p ? " preset-chip-active" : ""}`}
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
                        tabIndex={expanded ? 0 : -1}
                    />
                </label>
            </div>
        </section>
    );
}

interface PresetListItemProps {
    preset: Preset;
    isActive: boolean;
    isBusy: boolean;
    onSelect: () => void;
    onRename: () => void;
    onDelete: () => Promise<void>;
}

function PresetListItem({
    preset,
    isActive,
    isBusy,
    onSelect,
    onRename,
    onDelete,
}: PresetListItemProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div className="preset-item">
            <div className={`preset-chip preset-chip-with-menu${isActive ? " preset-chip-active" : ""}`}>
                <button
                    type="button"
                    className="preset-chip-label"
                    onClick={onSelect}
                    disabled={isBusy}
                >
                    {preset.name}
                </button>
                <button
                    type="button"
                    className="preset-chip-menu-btn"
                    onClick={() => setIsMenuOpen((open) => !open)}
                    aria-label={`Preset options for ${preset.name}`}
                    title="Preset options"
                    disabled={isBusy}
                >
                    ⋯
                </button>
            </div>
            <div className="preset-item-actions">
                {isMenuOpen && (
                    <div className="preset-menu" role="menu">
                        <button
                            type="button"
                            className="preset-menu-item"
                            role="menuitem"
                            onClick={() => {
                                setIsMenuOpen(false);
                                onRename();
                            }}
                            disabled={isBusy}
                        >
                            Rename
                        </button>
                        <button
                            type="button"
                            className="preset-menu-item preset-menu-item-danger"
                            role="menuitem"
                            onClick={() => {
                                setIsMenuOpen(false);
                                void onDelete();
                            }}
                            disabled={isBusy}
                        >
                            Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export function SetupForm({ onStart, error }: SetupFormProps) {
    const [providers, setProviders] = useState<Providers>(DEFAULT_PROVIDERS);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

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
    const [conversationTitle, setConversationTitle] = useState("");
    const [isInitialized, setIsInitialized] = useState(false);
    const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
    const [presetName, setPresetName] = useState("");
    const [savePresetError, setSavePresetError] = useState<string | null>(null);
    const [presetActionError, setPresetActionError] = useState<string | null>(null);
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [activePresetMutationId, setActivePresetMutationId] = useState<string | null>(null);
    const [presetPendingDelete, setPresetPendingDelete] = useState<Preset | null>(null);
    const [presetPendingRename, setPresetPendingRename] = useState<Preset | null>(null);

    const closeSavePresetDialog = useCallback((forceClose = false) => {
        if (!forceClose && isSavingPreset) {
            return;
        }
        setIsSavePresetOpen(false);
        setPresetName("");
        setSavePresetError(null);
    }, [isSavingPreset]);

    const openSavePresetDialog = () => {
        setSavePresetError(null);
        setIsSavePresetOpen(true);
    };

    useEffect(() => {
        let cancelled = false;

        async function initialize(): Promise<void> {
            const [providersData, presetsData, settings] = await Promise.all([
                fetch(apiUrl("/providers"))
                    .then((response) => response.json())
                    .catch(() => DEFAULT_PROVIDERS),
                fetch(apiUrl("/presets"))
                    .then((response) => response.json())
                    .catch(() => []),
                loadSettings().catch(() => null),
            ]);

            if (cancelled) {
                return;
            }

            setProviders(providersData);
            setPresets(presetsData);

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
            setNameA(isManualA ? savedNameA : derivedNameA);
            setNameB(isManualB ? savedNameB : derivedNameB);
            setNameAManual(isManualA);
            setNameBManual(isManualB);
            setSharedPrompt(settings?.shared_system_prompt ?? "");
            setPromptA(settings?.chatbot_a.system_prompt ?? "");
            setPromptB(settings?.chatbot_b.system_prompt ?? "");
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
        if (!nameAManual && modelsA.length > 0 && modelA) {
            const model = modelsA.find((m) => m.id === modelA);
            if (model) {
                setNameA(shortModelName(model));
            }
        }
    }, [modelA, modelsA, nameAManual]);

    useEffect(() => {
        if (!nameBManual && modelsB.length > 0 && modelB) {
            const model = modelsB.find((m) => m.id === modelB);
            if (model) {
                setNameB(shortModelName(model));
            }
        }
    }, [modelB, modelsB, nameBManual]);

    useEffect(() => {
        if (!isSavePresetOpen) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeSavePresetDialog();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [closeSavePresetDialog, isSavePresetOpen]);

    const availableProviders = (Object.keys(providers) as Provider[]).filter((p) => providers[p]);

    const buildConfig = (): SessionConfig => ({
        chatbot_a: { name: nameA, model: modelA, system_prompt: promptA, provider: providerA },
        chatbot_b: { name: nameB, model: modelB, system_prompt: promptB, provider: providerB },
        shared_system_prompt: sharedPrompt,
    });

    const loadPreset = async (id: string) => {
        setPresetActionError(null);
        const preset = presets.find((item) => item.id === id);
        if (!preset) {
            return;
        }
        setSelectedPresetId(id);
        if (preset.config) {
            const [presetModelsA, presetModelsB] = await Promise.all([
                fetchModels(preset.config.chatbot_a.provider),
                fetchModels(preset.config.chatbot_b.provider),
            ]);
            setProviderA(preset.config.chatbot_a.provider);
            setProviderB(preset.config.chatbot_b.provider);
            setModelsA(presetModelsA);
            setModelsB(presetModelsB);
            setModelA(preferredModelId(presetModelsA, preset.config.chatbot_a.provider, preset.config.chatbot_a.model));
            setModelB(preferredModelId(presetModelsB, preset.config.chatbot_b.provider, preset.config.chatbot_b.model));
            setNameA(preset.config.chatbot_a.name);
            setNameB(preset.config.chatbot_b.name);
            setNameAManual(true);
            setNameBManual(true);
            setSharedPrompt(preset.config.shared_system_prompt);
            setPromptA(preset.config.chatbot_a.system_prompt);
            setPromptB(preset.config.chatbot_b.system_prompt);
            return;
        }
        setSharedPrompt(preset.shared_system_prompt);
        setPromptA(preset.system_prompt_a);
        setPromptB(preset.system_prompt_b);
    };

    const handleSavePreset = async () => {
        const trimmedPresetName = presetName.trim();
        if (!trimmedPresetName) {
            setSavePresetError("Enter a preset name.");
            return;
        }
        setIsSavingPreset(true);
        setSavePresetError(null);
        setPresetActionError(null);
        try {
            const response = await fetch(apiUrl("/presets"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: trimmedPresetName,
                    config: buildConfig(),
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to save preset");
            }
            const savedPreset: Preset = await response.json();
            setPresets((currentPresets) => [savedPreset, ...currentPresets]);
            setSelectedPresetId(null);
            closeSavePresetDialog(true);
        } catch {
            setSavePresetError("Failed to save preset.");
        } finally {
            setIsSavingPreset(false);
        }
    };

    const handleRenamePreset = async (presetId: string, nextName: string): Promise<boolean> => {
        setActivePresetMutationId(presetId);
        setPresetActionError(null);
        try {
            const response = await fetch(apiUrl(`/presets/${presetId}`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: nextName }),
            });
            if (!response.ok) {
                throw new Error("Failed to rename preset");
            }
            const renamedPreset: Preset = await response.json();
            setPresets((currentPresets) => currentPresets.map((preset) => (
                preset.id === presetId ? renamedPreset : preset
            )));
            setPresetPendingRename(null);
            return true;
        } catch {
            setPresetActionError("Failed to rename preset.");
            return false;
        } finally {
            setActivePresetMutationId(null);
        }
    };

    const handleDeletePreset = async (): Promise<void> => {
        if (!presetPendingDelete) {
            return;
        }
        setActivePresetMutationId(presetPendingDelete.id);
        setPresetActionError(null);
        try {
            const response = await fetch(apiUrl(`/presets/${presetPendingDelete.id}`), {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error("Failed to delete preset");
            }
            setPresets((currentPresets) => currentPresets.filter((item) => item.id !== presetPendingDelete.id));
            if (selectedPresetId === presetPendingDelete.id) {
                setSelectedPresetId(null);
            }
            setPresetPendingDelete(null);
        } catch {
            setPresetActionError("Failed to delete preset.");
        } finally {
            setActivePresetMutationId(null);
        }
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
                <h1 className="setup-title">ChatbotChambers</h1>

                {error && <div className="error-banner">{error}</div>}

                <form onSubmit={handleSubmit} className="setup-form">
                    <div className="field">
                        <div className="preset-header">
                            <span className="field-label">Preset</span>
                            <button
                                type="button"
                                className="preset-save-link"
                                onClick={openSavePresetDialog}
                                disabled={!canStart || isSavingPreset}
                            >
                                Save current config as preset
                            </button>
                        </div>
                        <div className="preset-chips" role="group">
                            {presets.map((preset) => (
                                <PresetListItem
                                    key={preset.id}
                                    preset={preset}
                                    isActive={selectedPresetId === preset.id}
                                    isBusy={activePresetMutationId === preset.id}
                                    onSelect={() => loadPreset(preset.id).catch(() => setPresetActionError("Failed to load preset."))}
                                    onRename={() => setPresetPendingRename(preset)}
                                    onDelete={async () => setPresetPendingDelete(preset)}
                                />
                            ))}
                        </div>
                        {presetActionError && <div className="preset-save-error">{presetActionError}</div>}
                        {isSavePresetOpen && (
                            <div
                                className="preset-dialog-backdrop"
                                role="presentation"
                                onClick={() => {
                                    if (!isSavingPreset) {
                                        closeSavePresetDialog();
                                    }
                                }}
                            >
                                <div
                                    className="preset-dialog"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="save-preset-title"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <div className="preset-dialog-header">
                                        <h2 id="save-preset-title" className="preset-dialog-title">Save preset</h2>
                                        <button
                                            type="button"
                                            className="preset-dialog-close"
                                            onClick={() => closeSavePresetDialog()}
                                            disabled={isSavingPreset}
                                            aria-label="Close save preset dialog"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <label className="field">
                                        <span>Preset name</span>
                                        <input
                                            type="text"
                                            value={presetName}
                                            onChange={(event) => setPresetName(event.target.value)}
                                            placeholder="Enter a preset name"
                                        />
                                    </label>
                                    {savePresetError && <div className="preset-save-error">{savePresetError}</div>}
                                    <div className="preset-save-actions">
                                        <button
                                            type="button"
                                            className="preset-save-confirm"
                                            onClick={handleSavePreset}
                                            disabled={isSavingPreset}
                                        >
                                            {isSavingPreset ? "Saving…" : "Save preset"}
                                        </button>
                                        <button
                                            type="button"
                                            className="preset-save-cancel"
                                            onClick={() => closeSavePresetDialog()}
                                            disabled={isSavingPreset}
                                        >
                                            Cancel
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
                            prompt={promptA}
                            onProviderChange={setProviderA}
                            onModelChange={setModelA}
                            onNameChange={(n) => { setNameA(n); setNameAManual(true); }}
                            onPromptChange={setPromptA}
                        />
                        <ChatbotConfig
                            side="b"
                            label="Chatbot B"
                            providers={availableProviders}
                            models={modelsB}
                            provider={providerB}
                            model={modelB}
                            name={nameB}
                            prompt={promptB}
                            onProviderChange={setProviderB}
                            onModelChange={setModelB}
                            onNameChange={(n) => { setNameB(n); setNameBManual(true); }}
                            onPromptChange={setPromptB}
                        />
                    </div>

                    <div className="setup-bottom">
                        <label className="field">
                            <span>Conversation name</span>
                            <input
                                type="text"
                                value={conversationTitle}
                                onChange={(event) => setConversationTitle(event.target.value)}
                                placeholder="Optional"
                            />
                        </label>

                        <div className="setup-actions">
                            <button type="submit" className="start-btn" disabled={!canStart}>
                                Start conversation
                            </button>
                        </div>
                    </div>
                </form>
                <ConfirmationDialog
                    isOpen={presetPendingDelete !== null}
                    title="Delete preset"
                    message={presetPendingDelete ? `Delete preset "${presetPendingDelete.name}"?` : ""}
                    confirmLabel="Delete"
                    isConfirming={activePresetMutationId !== null}
                    onConfirm={() => { void handleDeletePreset(); }}
                    onCancel={() => {
                        if (activePresetMutationId === null) {
                            setPresetPendingDelete(null);
                        }
                    }}
                />
                <RenameDialog
                    key={presetPendingRename?.id ?? "preset-rename-closed"}
                    isOpen={presetPendingRename !== null}
                    title="Rename preset"
                    initialValue={presetPendingRename?.name ?? ""}
                    isSaving={activePresetMutationId !== null}
                    onConfirm={(value) => {
                        if (presetPendingRename) {
                            void handleRenamePreset(presetPendingRename.id, value);
                        }
                    }}
                    onCancel={() => {
                        if (activePresetMutationId === null) {
                            setPresetPendingRename(null);
                        }
                    }}
                />
            </div>
        </div>
    );
}
