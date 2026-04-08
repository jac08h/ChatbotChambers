import { useEffect, useMemo, useState } from "react";
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

async function fetchModels(provider: Provider): Promise<Model[]> {
    return fetch(`http://localhost:8001/models?provider=${provider}`)
        .then((r) => r.json())
        .catch(() => []);
}

export function SetupForm({ onStart, error }: SetupFormProps) {
    const [providers, setProviders] = useState<Providers>({ openrouter: true, claude_code: false, codex: false });
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
    const [maxTurns, setMaxTurns] = useState(20);

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

    const availableProviders = useMemo(
        () => (Object.keys(providers) as Provider[]).filter((provider) => providers[provider]),
        [providers],
    );

    const chamberPreview = `${nameA || DEFAULT_CHATBOT_NAMES.a} × ${nameB || DEFAULT_CHATBOT_NAMES.b}`;

    const loadPreset = (id: string) => {
        const preset = presets.find((item) => item.id === id);
        if (!preset) {
            return;
        }
        setSharedPrompt(preset.shared_system_prompt);
        setPromptA(preset.system_prompt_a);
        setPromptB(preset.system_prompt_b);
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onStart({
            chatbot_a: { name: nameA, model: modelA, system_prompt: promptA, provider: providerA },
            chatbot_b: { name: nameB, model: modelB, system_prompt: promptB, provider: providerB },
            shared_system_prompt: sharedPrompt,
            max_turns: maxTurns,
        });
    };

    return (
        <div className="setup-page">
            <div className="setup-shell">
                <section className="setup-hero">
                    <div className="brand-lockup">
                        <span className="brand-chip">ChatbotChambers</span>
                        <span className="brand-caption">Dark, focused conversations between two models.</span>
                    </div>
                    <div className="hero-copy">
                        <p className="eyebrow">Quiet by default</p>
                        <h1>Start a conversation that feels like it belongs in its own room.</h1>
                        <p className="hero-summary">
                            Set the shared context, shape each chatbot, and let the chamber take over.
                            Active mode keeps the newest turn sharp while older ones drift into memory.
                        </p>
                    </div>
                    <div className="hero-notes">
                        <div className="hero-note">
                            <span className="hero-note-label">Pairing</span>
                            <strong>{chamberPreview}</strong>
                        </div>
                        <div className="hero-note">
                            <span className="hero-note-label">Focus</span>
                            <strong>Transcript + active mode</strong>
                        </div>
                        <div className="hero-note">
                            <span className="hero-note-label">Tone</span>
                            <strong>Minimal, dark, immersive</strong>
                        </div>
                    </div>
                </section>

                <section className="setup-card">
                    <div className="setup-card-header">
                        <div>
                            <p className="eyebrow">Setup</p>
                            <h2>Configure the chamber</h2>
                        </div>
                        <span className="setup-card-badge">Ready when you are</span>
                    </div>

                    {error && <div className="error-banner">{error}</div>}

                    <form onSubmit={handleSubmit} className="setup-form">
                        {presets.length > 0 && (
                            <label className="field field-inline">
                                <span>Preset</span>
                                <select defaultValue="" onChange={(event) => loadPreset(event.target.value)}>
                                    <option value="" disabled>Choose one</option>
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
                                placeholder="What should both chatbots know before they begin?"
                                rows={5}
                            />
                        </label>

                        <div className="chatbot-configs">
                            <section className="chatbot-config side-a">
                                <div className="chatbot-config-header">
                                    <p className="eyebrow">Left side</p>
                                    <h3>Chatbot A</h3>
                                </div>
                                <label className="field">
                                    <span>Name</span>
                                    <input
                                        type="text"
                                        value={nameA}
                                        onChange={(event) => setNameA(event.target.value)}
                                        placeholder="Name this chatbot"
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
                                        placeholder="How should Chatbot A behave?"
                                        rows={4}
                                    />
                                </label>
                            </section>

                            <section className="chatbot-config side-b">
                                <div className="chatbot-config-header">
                                    <p className="eyebrow">Right side</p>
                                    <h3>Chatbot B</h3>
                                </div>
                                <label className="field">
                                    <span>Name</span>
                                    <input
                                        type="text"
                                        value={nameB}
                                        onChange={(event) => setNameB(event.target.value)}
                                        placeholder="Name this chatbot"
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
                                        placeholder="How should Chatbot B behave?"
                                        rows={4}
                                    />
                                </label>
                            </section>
                        </div>

                        <label className="field field-inline turns-field">
                            <span>Max turns</span>
                            <input
                                type="number"
                                value={maxTurns}
                                onChange={(event) => setMaxTurns(Number(event.target.value))}
                                min={1}
                                max={200}
                            />
                        </label>

                        <div className="setup-actions">
                            <button type="submit" className="start-btn" disabled={!modelA || !modelB}>
                                Start
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
}
