import { useEffect, useState } from "react";
import { DEFAULT_CHATBOT_NAMES, type Provider, type SessionConfig } from "../hooks/useWebSocket";
import { loadSettings, saveSettings } from "../settings";

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

async function fetchModels(provider: Provider): Promise<Model[]> {
    return fetch(`http://localhost:8001/models?provider=${provider}`)
        .then((r) => r.json())
        .catch(() => []);
}

export function SetupForm({ onStart, error }: SetupFormProps) {
    const [providers, setProviders] = useState<Providers>(DEFAULT_PROVIDERS);
    const [presets, setPresets] = useState<Preset[]>([]);

    const [providerA, setProviderA] = useState<Provider>("openrouter");
    const [providerB, setProviderB] = useState<Provider>("openrouter");
    const [modelsA, setModelsA] = useState<Model[]>([]);
    const [modelsB, setModelsB] = useState<Model[]>([]);
    const [modelA, setModelA] = useState("");
    const [modelB, setModelB] = useState("");
    const [nameA, setNameA] = useState<string>(DEFAULT_CHATBOT_NAMES.a);
    const [nameB, setNameB] = useState<string>(DEFAULT_CHATBOT_NAMES.b);
    const [sharedPrompt, setSharedPrompt] = useState("");
    const [promptA, setPromptA] = useState("");
    const [promptB, setPromptB] = useState("");
    const [conversationTitle, setConversationTitle] = useState("");
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function initialize(): Promise<void> {
            const [providersData, presetsData, settings] = await Promise.all([
                fetch("http://localhost:8001/providers")
                    .then((response) => response.json())
                    .catch(() => DEFAULT_PROVIDERS),
                fetch("http://localhost:8001/presets")
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
            setModelA(preferredModelId(initialModelsA, initialProviderA, settings?.chatbot_a.model ?? ""));
            setModelB(preferredModelId(initialModelsB, initialProviderB, settings?.chatbot_b.model ?? ""));
            setNameA(settings?.chatbot_a.name ?? DEFAULT_CHATBOT_NAMES.a);
            setNameB(settings?.chatbot_b.name ?? DEFAULT_CHATBOT_NAMES.b);
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

    const availableProviders = (Object.keys(providers) as Provider[]).filter((provider) => providers[provider]);

    const loadPreset = (id: string) => {
        const preset = presets.find((item) => item.id === id);
        if (!preset) {
            return;
        }
        setSharedPrompt(preset.shared_system_prompt);
        setPromptA(preset.system_prompt_a);
        setPromptB(preset.system_prompt_b);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const config = {
            chatbot_a: { name: nameA, model: modelA, system_prompt: promptA, provider: providerA },
            chatbot_b: { name: nameB, model: modelB, system_prompt: promptB, provider: providerB },
            shared_system_prompt: sharedPrompt,
        };
        await saveSettings(config).catch(() => {});
        onStart(config, conversationTitle.trim());
    };

    return (
        <div className="setup-page">
            <div className="setup-landing">
                <div className="setup-header">
                    <h1 className="setup-title">ChatbotChambers</h1>
                    <p className="setup-subtitle">A place for conversations.</p>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <form onSubmit={handleSubmit} className="setup-form">
                    {presets.length > 0 && (
                        <label className="field">
                            <span>Preset</span>
                            <select defaultValue="" onChange={(event) => loadPreset(event.target.value)}>
                                <option value="" disabled>Choose a preset</option>
                                {presets.map((preset) => (
                                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                                ))}
                            </select>
                        </label>
                    )}

                    <label className="field">
                        <span>Conversation name</span>
                        <input
                            type="text"
                            value={conversationTitle}
                            onChange={(event) => setConversationTitle(event.target.value)}
                            placeholder="Optional"
                        />
                    </label>

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
                        <section className="chatbot-config side-a">
                            <div className="chatbot-config-header">
                                <h3>Chatbot A</h3>
                            </div>
                            <label className="field">
                                <span>Name</span>
                                <input
                                    type="text"
                                    value={nameA}
                                    onChange={(event) => setNameA(event.target.value)}
                                />
                            </label>
                            <label className="field">
                                <span>Provider</span>
                                <select
                                    value={providerA}
                                    onChange={(event) => setProviderA(event.target.value as Provider)}
                                >
                                    {availableProviders.map((provider) => (
                                        <option key={provider} value={provider}>{PROVIDER_LABELS[provider]}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="field">
                                <span>Model</span>
                                <select value={modelA} onChange={(event) => setModelA(event.target.value)}>
                                    {modelsA.map((model) => (
                                        <option key={model.id} value={model.id}>{model.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="field">
                                <span>Instructions</span>
                                <textarea
                                    value={promptA}
                                    onChange={(event) => setPromptA(event.target.value)}
                                    placeholder="System prompt for Chatbot A"
                                    rows={3}
                                />
                            </label>
                        </section>

                        <section className="chatbot-config side-b">
                            <div className="chatbot-config-header">
                                <h3>Chatbot B</h3>
                            </div>
                            <label className="field">
                                <span>Name</span>
                                <input
                                    type="text"
                                    value={nameB}
                                    onChange={(event) => setNameB(event.target.value)}
                                />
                            </label>
                            <label className="field">
                                <span>Provider</span>
                                <select
                                    value={providerB}
                                    onChange={(event) => setProviderB(event.target.value as Provider)}
                                >
                                    {availableProviders.map((provider) => (
                                        <option key={provider} value={provider}>{PROVIDER_LABELS[provider]}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="field">
                                <span>Model</span>
                                <select value={modelB} onChange={(event) => setModelB(event.target.value)}>
                                    {modelsB.map((model) => (
                                        <option key={model.id} value={model.id}>{model.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="field">
                                <span>Instructions</span>
                                <textarea
                                    value={promptB}
                                    onChange={(event) => setPromptB(event.target.value)}
                                    placeholder="System prompt for Chatbot B"
                                    rows={3}
                                />
                            </label>
                        </section>
                    </div>

                    <div className="setup-actions">
                        <button type="submit" className="start-btn" disabled={!modelA || !modelB}>
                            Start conversation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
