import { useEffect, useState } from "react";
import { DEFAULT_CHATBOT_NAMES, type Provider, type SessionConfig } from "../hooks/useWebSocket";

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

function shortModelName(model: Model): string {
    const name = model.name || model.id;
    const slashIndex = name.indexOf("/");
    return slashIndex !== -1 ? name.slice(slashIndex + 1) : name;
}

async function fetchModels(provider: Provider): Promise<Model[]> {
    return fetch(`http://localhost:8001/models?provider=${provider}`)
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

            <label className="field">
                <span>Provider</span>
                <select
                    value={provider}
                    onChange={(event) => onProviderChange(event.target.value as Provider)}
                >
                    {providers.map((p) => (
                        <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                    ))}
                </select>
            </label>

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

export function SetupForm({ onStart, error }: SetupFormProps) {
    const [providers, setProviders] = useState<Providers>({ openrouter: true, claude_code: false, codex: false });
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

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

    useEffect(() => {
        fetch("http://localhost:8001/providers")
            .then((r) => r.json())
            .then((data: Providers) => setProviders(data))
            .catch(() => {});

        fetch("http://localhost:8001/presets")
            .then((r) => r.json())
            .then((data: Preset[]) => setPresets(data))
            .catch(() => {});

        fetchModels("openrouter").then((data) => {
            setModelsA(data);
            setModelsB(data);
            if (data.length > 0) {
                const flashLite = data.find((m) => m.id === "google/gemini-3.1-flash-lite-preview");
                const defaultModel = flashLite ? flashLite.id : data[0].id;
                setModelA(defaultModel);
                setModelB(defaultModel);
            }
        });
    }, []);

    useEffect(() => {
        fetchModels(providerA).then((data) => {
            setModelsA(data);
            if (data.length > 0) {
                setModelA(data[0].id);
            }
        });
    }, [providerA]);

    useEffect(() => {
        fetchModels(providerB).then((data) => {
            setModelsB(data);
            if (data.length > 0) {
                setModelB(data[0].id);
            }
        });
    }, [providerB]);

    const availableProviders = (Object.keys(providers) as Provider[]).filter((p) => providers[p]);

    const loadPreset = (id: string) => {
        const preset = presets.find((item) => item.id === id);
        if (!preset) {
            return;
        }
        setSelectedPresetId(id);
        setSharedPrompt(preset.shared_system_prompt);
        setPromptA(preset.system_prompt_a);
        setPromptB(preset.system_prompt_b);
    };

    const clearPreset = () => {
        setSelectedPresetId(null);
        setSharedPrompt("");
        setPromptA("");
        setPromptB("");
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onStart({
            chatbot_a: { name: nameA, model: modelA, system_prompt: promptA, provider: providerA },
            chatbot_b: { name: nameB, model: modelB, system_prompt: promptB, provider: providerB },
            shared_system_prompt: sharedPrompt,
        });
    };

    const canStart = Boolean(modelA && modelB);

    return (
        <div className="setup-page">
            <div className="setup-landing">
                <h1 className="setup-title">ChatbotChambers</h1>

                {error && <div className="error-banner">{error}</div>}

                <form onSubmit={handleSubmit} className="setup-form">
                    {presets.length > 0 && (
                        <div className="field">
                            <span className="field-label">Preset</span>
                            <div className="preset-chips">
                                {presets.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        className={`preset-chip ${selectedPresetId === preset.id ? "preset-chip-active" : ""}`}
                                        onClick={() =>
                                            selectedPresetId === preset.id ? clearPreset() : loadPreset(preset.id)
                                        }
                                    >
                                        {preset.name}
                                    </button>
                                ))}
                            </div>
                        </div>
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
                            onNameChange={setNameA}
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
                            onNameChange={setNameB}
                            onPromptChange={setPromptB}
                        />
                    </div>

                    <div className="setup-actions">
                        <button type="submit" className="start-btn" disabled={!canStart}>
                            Start conversation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
