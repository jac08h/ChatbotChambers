import { useEffect, useState } from "react";
import type { Provider, SessionConfig } from "../hooks/useWebSocket";

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
    const [nameA, setNameA] = useState("LM A");
    const [nameB, setNameB] = useState("LM B");
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
            if (data.length > 0) setModelA(data[0].id);
        });
    }, [providerA]);

    useEffect(() => {
        fetchModels(providerB).then((data) => {
            setModelsB(data);
            if (data.length > 0) setModelB(data[0].id);
        });
    }, [providerB]);

    const availableProviders = (Object.keys(providers) as Provider[]).filter((p) => providers[p]);

    const loadPreset = (id: string) => {
        const preset = presets.find((p) => p.id === id);
        if (!preset) return;
        setSharedPrompt(preset.shared_system_prompt);
        setPromptA(preset.system_prompt_a);
        setPromptB(preset.system_prompt_b);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onStart({
            chatbot_a: { name: nameA, model: modelA, system_prompt: promptA, provider: providerA },
            chatbot_b: { name: nameB, model: modelB, system_prompt: promptB, provider: providerB },
            shared_system_prompt: sharedPrompt,
            max_turns: maxTurns,
        });
    };

    return (
        <div className="setup-page">
            <div className="setup-topbar">
                <span className="header-title">LM Parlor</span>
            </div>
            <div className="setup-container">
                {error && <div className="error-banner">{error}</div>}

                <form onSubmit={handleSubmit} className="setup-form">
                    {presets.length > 0 && (
                        <div className="form-section form-row">
                            <label>Scenario</label>
                            <select
                                defaultValue=""
                                onChange={(e) => loadPreset(e.target.value)}
                            >
                                <option value="" disabled>— select —</option>
                                {presets.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="form-section">
                        <label>Scene</label>
                        <textarea
                            value={sharedPrompt}
                            onChange={(e) => setSharedPrompt(e.target.value)}
                            placeholder="Context both voices share. Sets the stage."
                            rows={4}
                        />
                    </div>

                    <div className="chatbot-configs">
                        <div className="chatbot-config side-a">
                            <h3>Guest A</h3>
                            <label>Name</label>
                            <input
                                type="text"
                                value={nameA}
                                onChange={(e) => setNameA(e.target.value)}
                                placeholder="LM A"
                            />
                            <label>Provider</label>
                            <select
                                value={providerA}
                                onChange={(e) => setProviderA(e.target.value as Provider)}
                            >
                                {availableProviders.map((p) => (
                                    <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                                ))}
                            </select>
                            <label>Model</label>
                            <select value={modelA} onChange={(e) => setModelA(e.target.value)}>
                                {modelsA.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <label>Role</label>
                            <textarea
                                value={promptA}
                                onChange={(e) => setPromptA(e.target.value)}
                                placeholder="Character or persona for Guest A"
                                rows={3}
                            />
                        </div>

                        <div className="chatbot-config side-b">
                            <h3>Guest B</h3>
                            <label>Name</label>
                            <input
                                type="text"
                                value={nameB}
                                onChange={(e) => setNameB(e.target.value)}
                                placeholder="LM B"
                            />
                            <label>Provider</label>
                            <select
                                value={providerB}
                                onChange={(e) => setProviderB(e.target.value as Provider)}
                            >
                                {availableProviders.map((p) => (
                                    <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                                ))}
                            </select>
                            <label>Model</label>
                            <select value={modelB} onChange={(e) => setModelB(e.target.value)}>
                                {modelsB.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <label>Role</label>
                            <textarea
                                value={promptB}
                                onChange={(e) => setPromptB(e.target.value)}
                                placeholder="Character or persona for Guest B"
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="form-section form-row">
                        <label>Turns</label>
                        <input
                            type="number"
                            value={maxTurns}
                            onChange={(e) => setMaxTurns(Number(e.target.value))}
                            min={1}
                            max={200}
                            style={{ width: "80px" }}
                        />
                    </div>

                    <button type="submit" className="start-btn" disabled={!modelA || !modelB}>
                        Convene
                    </button>
                </form>
            </div>
        </div>
    );
}
