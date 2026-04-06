import { useEffect, useState } from "react";
import type { SessionConfig } from "../hooks/useWebSocket";

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

interface SetupFormProps {
    onStart: (config: SessionConfig) => void;
    error: string | null;
}

export function SetupForm({ onStart, error }: SetupFormProps) {
    const [models, setModels] = useState<Model[]>([]);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [modelA, setModelA] = useState("");
    const [modelB, setModelB] = useState("");
    const [sharedPrompt, setSharedPrompt] = useState("");
    const [promptA, setPromptA] = useState("");
    const [promptB, setPromptB] = useState("");
    const [maxTurns, setMaxTurns] = useState(20);

    useEffect(() => {
        fetch("http://localhost:8001/models")
            .then((r) => r.json())
            .then((data: Model[]) => {
                setModels(data);
                if (data.length > 0) {
                    const flashLite = data.find((m: Model) => m.id === "google/gemini-3.1-flash-lite-preview");
                    const defaultModel = flashLite ? flashLite.id : data[0].id;
                    setModelA(defaultModel);
                    setModelB(defaultModel);
                }
            })
            .catch(() => {});

        fetch("http://localhost:8001/presets")
            .then((r) => r.json())
            .then((data: Preset[]) => setPresets(data))
            .catch(() => {});
    }, []);

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
            chatbot_a: { model: modelA, system_prompt: promptA },
            chatbot_b: { model: modelB, system_prompt: promptB },
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
                        <label>Model</label>
                        <select value={modelA} onChange={(e) => setModelA(e.target.value)}>
                            {models.map((m) => (
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
                        <label>Model</label>
                        <select value={modelB} onChange={(e) => setModelB(e.target.value)}>
                            {models.map((m) => (
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
