import { useEffect, useRef, useState } from "react";
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
    onStart: (config: SessionConfig) => void;
    error: string | null;
}

const PROVIDER_LABELS: Record<Provider, string> = {
    openrouter: "OpenRouter",
    claude_code: "Claude Code",
    codex: "Codex CLI",
};

async function fetchModels(provider: Provider): Promise<Model[]> {
    return fetch(`http://localhost:8001/models?provider=${provider}`)
        .then((r) => r.json())
        .catch(() => []);
}

export function SetupForm({ onStart, error }: SetupFormProps) {
    const [providers, setProviders] = useState<Providers>({ openrouter: true, claude_code: false, codex: false });
    const [presets, setPresets] = useState<Preset[]>([]);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

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
    const preferredModelARef = useRef<string | null>(null);
    const preferredModelBRef = useRef<string | null>(null);

    useEffect(() => {
        fetch("http://localhost:8001/providers")
            .then((r) => r.json())
            .then((data: Providers) => setProviders(data))
            .catch(() => {});

        fetch("http://localhost:8001/presets")
            .then((r) => r.json())
            .then((data: Preset[]) => setPresets(data))
            .catch(() => {});

        loadSettings()
            .then((settings) => {
                if (settings.chatbot_a) {
                    setNameA(settings.chatbot_a.name);
                    setProviderA(settings.chatbot_a.provider);
                    setPromptA(settings.chatbot_a.system_prompt);
                    preferredModelARef.current = settings.chatbot_a.model;
                }
                if (settings.chatbot_b) {
                    setNameB(settings.chatbot_b.name);
                    setProviderB(settings.chatbot_b.provider);
                    setPromptB(settings.chatbot_b.system_prompt);
                    preferredModelBRef.current = settings.chatbot_b.model;
                }
                if (settings.shared_system_prompt) {
                    setSharedPrompt(settings.shared_system_prompt);
                }
            })
            .finally(() => setSettingsLoaded(true));
    }, []);

    useEffect(() => {
        if (!settingsLoaded) {
            return;
        }
        let ignore = false;
        fetchModels(providerA).then((data) => {
            if (ignore) {
                return;
            }
            setModelsA(data);
            setModelA(resolveModelSelection(data, preferredModelARef.current));
            preferredModelARef.current = null;
        });
        return () => {
            ignore = true;
        };
    }, [providerA, settingsLoaded]);

    useEffect(() => {
        if (!settingsLoaded) {
            return;
        }
        let ignore = false;
        fetchModels(providerB).then((data) => {
            if (ignore) {
                return;
            }
            setModelsB(data);
            setModelB(resolveModelSelection(data, preferredModelBRef.current));
            preferredModelBRef.current = null;
        });
        return () => {
            ignore = true;
        };
    }, [providerB, settingsLoaded]);

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
        try {
            await saveSettings(config);
        } catch {}
        onStart(config);
    };

    return (
        <div className="setup-page">
            <div className="setup-landing">
                <h1 className="setup-title">LMParlor</h1>

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

function resolveModelSelection(models: Model[], preferredModel: string | null): string {
    if (models.length === 0) {
        return "";
    }
    if (preferredModel && models.some((model) => model.id === preferredModel)) {
        return preferredModel;
    }
    const flashLite = models.find((model) => model.id === "google/gemini-3.1-flash-lite-preview");
    return flashLite ? flashLite.id : models[0].id;
}
