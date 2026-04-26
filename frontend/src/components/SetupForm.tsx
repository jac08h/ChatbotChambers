import React, { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_HOSTED_SCENARIOS } from "../lib/defaultScenarios";
import { isHostedMode } from "../lib/deployment";
import { type ModelInfo, type Provider, type ProviderInfo, type Scenario, type SessionConfig } from "../lib/types";
import { listModels } from "../services/models";
import { listProviders } from "../services/providers";
import { listScenarios } from "../services/scenarios";
import { loadSettings, saveSettings } from "../services/settings";

interface Providers {
    [key: string]: ProviderInfo;
}

interface SetupFormProps {
    onStart: (config: SessionConfig, initialTitle: string) => void;
    error: string | null;
    hasOpenRouterKey?: boolean;
    onOpenApiKeyDialog?: () => void;
    theme?: "dark" | "light";
    onToggleTheme?: () => void;
}

const PROVIDER_LABELS: Record<Provider, string> = {
    openrouter: "OpenRouter",
    github_copilot: "GitHub Copilot",
    claude_code: "Claude Code",
    codex: "Codex CLI",
    mock: "Mock",
};

const PROVIDER_INFO: Partial<Record<Provider, React.ReactNode>> = {
    openrouter: isHostedMode
        ? <>Requires your own <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">OpenRouter API key</a>, stored only in this browser.</>
        : <>Requires an <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">OpenRouter API key</a> set as the <code>OPENROUTER_API_KEY</code> environment variable.</>,
    github_copilot: <>Requires a <a href="https://docs.github.com/en/copilot" target="_blank" rel="noopener noreferrer">GitHub Copilot subscription</a> and authentication via the <a href="https://cli.github.com" target="_blank" rel="noopener noreferrer">GitHub CLI</a> (<code>gh auth login</code>).</>,
    claude_code: <>Requires a <a href="https://docs.anthropic.com/en/docs/claude-code" target="_blank" rel="noopener noreferrer">Claude Code</a> subscription and the <code>claude</code> CLI installed and authenticated.</>,
    codex: <>Requires the <a href="https://github.com/openai/codex" target="_blank" rel="noopener noreferrer">Codex CLI</a> installed and an OpenAI API key.</>,
};

function ProviderInfoPopup({ provider, onClose }: { provider: Provider; onClose: () => void }) {
    const info = PROVIDER_INFO[provider];
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [onClose]);

    if (!info) return null;

    return (
        <div className="provider-info-popup" ref={ref} role="dialog" aria-label="Provider info">
            <p className="provider-info-desc">{info}</p>
        </div>
    );
}
const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash-preview";
const DEFAULT_PROVIDERS: Providers = {
    openrouter: { available: false },
    github_copilot: { available: true },
    claude_code: { available: false },
    codex: { available: false },
};

function defaultModelId(models: ModelInfo[], provider: Provider): string {
    if (models.length === 0) {
        return "";
    }
    if (provider === "openrouter") {
        const defaultModel = models.find((model) => model.id === DEFAULT_OPENROUTER_MODEL);
        return defaultModel ? defaultModel.id : models[0].id;
    }
    return models[0].id;
}

function preferredModelId(models: ModelInfo[], provider: Provider, currentModel: string): string {
    if (models.some((model) => model.id === currentModel)) {
        return currentModel;
    }
    return defaultModelId(models, provider);
}

function shortModelName(model: ModelInfo): string {
    const name = model.name || model.id;
    const slashIndex = name.indexOf("/");
    return slashIndex !== -1 ? name.slice(slashIndex + 1) : name;
}

interface ChatbotConfigProps {
    side: "a" | "b";
    label: string;
    providers: Provider[];
    models: ModelInfo[];
    provider: Provider;
    model: string;
    openRouterModel: string;
    prompt: string;
    onProviderChange: (p: Provider) => void;
    onModelChange: (m: string) => void;
    onOpenRouterModelChange: (m: string) => void;
    onPromptChange: (p: string) => void;
}

function ChatbotConfig({
    side,
    label,
    providers,
    models,
    provider,
    model,
    openRouterModel,
    prompt,
    onProviderChange,
    onModelChange,
    onOpenRouterModelChange,
    onPromptChange,
}: ChatbotConfigProps) {
    const [infoOpen, setInfoOpen] = useState(false);

    const selectedModel = models.find((m) => m.id === model);
    const displayName = selectedModel ? shortModelName(selectedModel) : model;

    return (
        <section className={`chatbot-config side-${side}`}>
            <div className="chatbot-config-header">
                <h3>{label}</h3>
            </div>

            <div className="field">
                <div className="provider-label-row">
                    <span className="field-label">Provider</span>
                    {PROVIDER_INFO[provider] && (
                        <div className="provider-info-anchor">
                            <button
                                type="button"
                                className="provider-info-btn"
                                onClick={() => setInfoOpen((v) => !v)}
                                aria-label="Provider setup info"
                            >
                                i
                            </button>
                            {infoOpen && (
                                <ProviderInfoPopup provider={provider} onClose={() => setInfoOpen(false)} />
                            )}
                        </div>
                    )}
                </div>
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
                {provider === "openrouter" ? (
                    <input
                        type="text"
                        value={openRouterModel}
                        onChange={(event) => onOpenRouterModelChange(event.target.value)}
                        placeholder="google/gemini-3.1-flash-lite-preview"
                        title="OpenRouter model ID"
                    />
                ) : (
                    <select value={model} onChange={(event) => onModelChange(event.target.value)} title={displayName}>
                        {models.map((m) => (
                            <option key={m.id} value={m.id}>{shortModelName(m)}</option>
                        ))}
                    </select>
                )}
            </label>

            <label className="field">
                <span>Instructions</span>
                <textarea
                    value={prompt}
                    onChange={(event) => onPromptChange(event.target.value)}
                    placeholder={`Instructions for ${label}, not visible to the other chatbot`}
                    rows={3}
                />
            </label>

        </section>
    );
}

export function SetupForm({
    onStart,
    error,
    hasOpenRouterKey = true,
    onOpenApiKeyDialog,
    theme,
    onToggleTheme,
}: SetupFormProps) {
    const [providers, setProviders] = useState<Providers>(DEFAULT_PROVIDERS);
    const [presets, setPresets] = useState<Scenario[]>([]);
    const lastPickedPresetId = useRef<string | null>(null);

    const [providerA, setProviderA] = useState<Provider>("openrouter");
    const [providerB, setProviderB] = useState<Provider>("openrouter");
    const [modelsA, setModelsA] = useState<ModelInfo[]>([]);
    const [modelsB, setModelsB] = useState<ModelInfo[]>([]);
    const [modelA, setModelA] = useState("");
    const [modelB, setModelB] = useState("");
    const [openRouterModelA, setOpenRouterModelA] = useState("");
    const [openRouterModelB, setOpenRouterModelB] = useState("");
    const [nameA, setNameA] = useState<string>("");
    const [nameB, setNameB] = useState<string>("");
    const [nameAManual, setNameAManual] = useState(false);
    const [nameBManual, setNameBManual] = useState(false);
    const [sharedPrompt, setSharedPrompt] = useState("");
    const [promptA, setPromptA] = useState("");
    const [promptB, setPromptB] = useState("");
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function initialize(): Promise<void> {
            const [providersData, presetsData, settings] = await Promise.all([
                listProviders()
                    .catch(() => DEFAULT_PROVIDERS),
                isHostedMode ? Promise.resolve(DEFAULT_HOSTED_SCENARIOS) : listScenarios().catch(() => []),
                loadSettings().catch(() => null),
            ]);

            if (cancelled) {
                return;
            }

            setProviders(providersData);
            setPresets(presetsData);

            const availableProviders = (Object.keys(providersData) as Provider[]).filter((provider) => providersData[provider]?.available);
            const fallbackProvider = availableProviders[0] ?? "openrouter";
            const initialProviderA = settings?.chatbot_a.provider && providersData[settings.chatbot_a.provider]?.available
                ? settings.chatbot_a.provider
                : fallbackProvider;
            const initialProviderB = settings?.chatbot_b.provider && providersData[settings.chatbot_b.provider]?.available
                ? settings.chatbot_b.provider
                : fallbackProvider;

            const [initialModelsA, initialModelsB] = await Promise.all([
                listModels(initialProviderA).catch(() => []),
                listModels(initialProviderB).catch(() => []),
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
            setOpenRouterModelA(initialProviderA === "openrouter" ? (settings?.chatbot_a.model ?? "") : "");
            setOpenRouterModelB(initialProviderB === "openrouter" ? (settings?.chatbot_b.model ?? "") : "");
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
        void listModels(providerA).catch(() => []).then((data) => {
            setModelsA(data);
            setModelA((current) => preferredModelId(data, providerA, current));
        });
    }, [isInitialized, providerA]);

    useEffect(() => {
        if (!isInitialized) {
            return;
        }
        void listModels(providerB).catch(() => []).then((data) => {
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
        if (!isInitialized) {
            return;
        }
        const openRouterModelIdA = openRouterModelA || DEFAULT_OPENROUTER_MODEL;
        const openRouterModelIdB = openRouterModelB || DEFAULT_OPENROUTER_MODEL;
        const finalModelA = providerA === "openrouter" ? openRouterModelIdA : modelA;
        const finalModelB = providerB === "openrouter" ? openRouterModelIdB : modelB;
        const computedDefaultNameA = providerA === "openrouter"
            ? shortModelName({ id: openRouterModelIdA, name: openRouterModelIdA })
            : shortModelName(modelsA.find((model) => model.id === modelA) ?? { id: modelA, name: modelA });
        const computedDefaultNameB = providerB === "openrouter"
            ? shortModelName({ id: openRouterModelIdB, name: openRouterModelIdB })
            : shortModelName(modelsB.find((model) => model.id === modelB) ?? { id: modelB, name: modelB });
        const config: SessionConfig = {
            chatbot_a: { name: nameA || computedDefaultNameA, model: finalModelA, system_prompt: promptA, provider: providerA },
            chatbot_b: { name: nameB || computedDefaultNameB, model: finalModelB, system_prompt: promptB, provider: providerB },
            shared_system_prompt: sharedPrompt,
        };
        const timer = setTimeout(() => { saveSettings(config).catch(() => {}); }, 500);
        return () => clearTimeout(timer);
    }, [
        isInitialized,
        modelA,
        modelB,
        modelsA,
        modelsB,
        nameA,
        nameB,
        openRouterModelA,
        openRouterModelB,
        promptA,
        promptB,
        providerA,
        providerB,
        sharedPrompt,
    ]);


    const availableProviders = (Object.keys(providers) as Provider[]).filter((p) => providers[p]?.available);

    const defaultNameA = (() => {
        if (providerA === "openrouter") {
            const id = openRouterModelA || DEFAULT_OPENROUTER_MODEL;
            return shortModelName({ id, name: id });
        }
        const model = modelsA.find((m) => m.id === modelA);
        return model ? shortModelName(model) : modelA;
    })();
    const defaultNameB = (() => {
        if (providerB === "openrouter") {
            const id = openRouterModelB || DEFAULT_OPENROUTER_MODEL;
            return shortModelName({ id, name: id });
        }
        const model = modelsB.find((m) => m.id === modelB);
        return model ? shortModelName(model) : modelB;
    })();

    const buildConfig = useCallback((): SessionConfig => {
        const finalModelA = providerA === "openrouter" ? (openRouterModelA || DEFAULT_OPENROUTER_MODEL) : modelA;
        const finalModelB = providerB === "openrouter" ? (openRouterModelB || DEFAULT_OPENROUTER_MODEL) : modelB;
        return {
            chatbot_a: { name: nameA || defaultNameA, model: finalModelA, system_prompt: promptA, provider: providerA },
            chatbot_b: { name: nameB || defaultNameB, model: finalModelB, system_prompt: promptB, provider: providerB },
            shared_system_prompt: sharedPrompt,
        };
    }, [
        defaultNameA,
        defaultNameB,
        modelA,
        modelB,
        nameA,
        nameB,
        openRouterModelA,
        openRouterModelB,
        promptA,
        promptB,
        providerA,
        providerB,
        sharedPrompt,
    ]);

    const loadRandomPreset = async () => {
        if (presets.length === 0) {
            return;
        }
        const candidates = presets.length > 1
            ? presets.filter((p) => p.id !== lastPickedPresetId.current)
            : presets;
        const preset = candidates[Math.floor(Math.random() * candidates.length)];
        lastPickedPresetId.current = preset.id;

        if (preset.config) {
            const [scenarioModelsA, scenarioModelsB] = await Promise.all([
                listModels(preset.config.chatbot_a.provider).catch(() => []),
                listModels(preset.config.chatbot_b.provider).catch(() => []),
            ]);
            setProviderA(preset.config.chatbot_a.provider);
            setProviderB(preset.config.chatbot_b.provider);
            setModelsA(scenarioModelsA);
            setModelsB(scenarioModelsB);
            const presetModelA = preferredModelId(scenarioModelsA, preset.config.chatbot_a.provider, preset.config.chatbot_a.model);
            const presetModelB = preferredModelId(scenarioModelsB, preset.config.chatbot_b.provider, preset.config.chatbot_b.model);
            setModelA(presetModelA);
            setModelB(presetModelB);
            setOpenRouterModelA(preset.config.chatbot_a.provider === "openrouter" ? preset.config.chatbot_a.model : "");
            setOpenRouterModelB(preset.config.chatbot_b.provider === "openrouter" ? preset.config.chatbot_b.model : "");
            const derivedNameA = shortModelName(scenarioModelsA.find((m) => m.id === presetModelA) ?? { id: presetModelA, name: presetModelA });
            const derivedNameB = shortModelName(scenarioModelsB.find((m) => m.id === presetModelB) ?? { id: presetModelB, name: presetModelB });
            const isManualA = preset.config.chatbot_a.name !== "" && preset.config.chatbot_a.name !== derivedNameA;
            const isManualB = preset.config.chatbot_b.name !== "" && preset.config.chatbot_b.name !== derivedNameB;
            setNameA(isManualA ? preset.config.chatbot_a.name : "");
            setNameB(isManualB ? preset.config.chatbot_b.name : "");
            setNameAManual(isManualA);
            setNameBManual(isManualB);
            setSharedPrompt(preset.config.shared_system_prompt);
            setPromptA(preset.config.chatbot_a.system_prompt);
            setPromptB(preset.config.chatbot_b.system_prompt);
            return;
        }
        setSharedPrompt(preset.shared_system_prompt);
        setPromptA(preset.system_prompt_a);
        setPromptB(preset.system_prompt_b);
    };

    const handleClearAll = () => {
        setSharedPrompt("");
        setPromptA("");
        setPromptB("");
        setNameA("");
        setNameB("");
        setNameAManual(false);
        setNameBManual(false);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const config = buildConfig();
        await saveSettings(config).catch(() => {});
        onStart(config, "");
    };

    const canStart = Boolean(
        (modelA || providerA === "openrouter")
        && (modelB || providerB === "openrouter")
        && (!isHostedMode || hasOpenRouterKey),
    );

    return (
        <div className="setup-page">
            {theme && onToggleTheme && (
                <button
                    className="setup-page-theme-toggle"
                    onClick={onToggleTheme}
                    title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                    type="button"
                    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                >
                    {theme === "dark" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM4.22 4.22a1 1 0 0 1 1.42 0l.7.7a1 1 0 0 1-1.42 1.42l-.7-.7a1 1 0 0 1 0-1.42Zm13.44 13.44a1 1 0 0 1 1.42 0l.7.7a1 1 0 0 1-1.42 1.42l-.7-.7a1 1 0 0 1 0-1.42ZM2 12a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm17 0a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1ZM4.22 19.78a1 1 0 0 1 0-1.42l.7-.7a1 1 0 0 1 1.42 1.42l-.7.7a1 1 0 0 1-1.42 0ZM17.66 6.34a1 1 0 0 1 0-1.42l.7-.7a1 1 0 0 1 1.42 1.42l-.7.7a1 1 0 0 1-1.42 0Z"/>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1Z"/>
                        </svg>
                    )}
                </button>
            )}
            <div className="setup-landing">
                <h1 className="setup-title">Who&rsquo;s talking today?</h1>

                {error && <div className="error-banner">{error}</div>}
                {isHostedMode && !hasOpenRouterKey && (
                    <div className="error-banner api-key-inline-banner">
                        <span>Set an OpenRouter API key to start hosted conversations.</span>
                        {onOpenApiKeyDialog && (
                            <button
                                type="button"
                                className="scenario-save-link api-key-inline-button"
                                onClick={onOpenApiKeyDialog}
                            >
                                Set API key
                            </button>
                        )}
                    </div>
                )}

                <div className="setup-random-scenario">
                    <button
                        type="button"
                        className="random-scenario-btn"
                        onClick={() => { void loadRandomPreset(); }}
                        disabled={presets.length === 0}
                    >
                        🎲 Random scenario
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

                <form onSubmit={handleSubmit} className="setup-form">
                    <label className="field">
                        <span>Shared instructions</span>
                        <textarea
                            value={sharedPrompt}
                            onChange={(event) => setSharedPrompt(event.target.value)}
                            placeholder="Instructions visible to both chatbots"
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
                            openRouterModel={openRouterModelA}
                            prompt={promptA}
                            onProviderChange={setProviderA}
                            onModelChange={setModelA}
                            onOpenRouterModelChange={setOpenRouterModelA}
                            onPromptChange={setPromptA}
                        />
                        <ChatbotConfig
                            side="b"
                            label="Chatbot B"
                            providers={availableProviders}
                            models={modelsB}
                            provider={providerB}
                            model={modelB}
                            openRouterModel={openRouterModelB}
                            prompt={promptB}
                            onProviderChange={setProviderB}
                            onModelChange={setModelB}
                            onOpenRouterModelChange={setOpenRouterModelB}
                            onPromptChange={setPromptB}
                        />
                    </div>

                    <div className="setup-bottom">
                        <div className="setup-actions">
                            <button type="submit" className="start-btn" disabled={!canStart}>
                                Start conversation
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
