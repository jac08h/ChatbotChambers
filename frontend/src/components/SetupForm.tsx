import { useEffect, useState } from "react";
import type { SessionConfig } from "../hooks/useWebSocket";

interface Model {
    id: string;
    name: string;
}

interface SetupFormProps {
    onStart: (config: SessionConfig) => void;
    error: string | null;
}

export function SetupForm({ onStart, error }: SetupFormProps) {
    const [models, setModels] = useState<Model[]>([]);
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
                    setModelA(data[0].id);
                    setModelB(data[0].id);
                }
            })
            .catch(() => {});
    }, []);

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
        <div className="setup-container">
            <h1>LMParlor</h1>
            <p className="subtitle">Watch two AI models talk to each other.</p>

            {error && <div className="error-banner">{error}</div>}

            <form onSubmit={handleSubmit} className="setup-form">
                <div className="form-section">
                    <label>Shared system prompt</label>
                    <textarea
                        value={sharedPrompt}
                        onChange={(e) => setSharedPrompt(e.target.value)}
                        placeholder="Context both chatbots see. This sets the stage for the conversation."
                        rows={4}
                    />
                </div>

                <div className="chatbot-configs">
                    <div className="chatbot-config">
                        <h3>Chatbot A</h3>
                        <label>Model</label>
                        <select value={modelA} onChange={(e) => setModelA(e.target.value)}>
                            {models.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                        <label>System prompt</label>
                        <textarea
                            value={promptA}
                            onChange={(e) => setPromptA(e.target.value)}
                            placeholder="Role or personality for Chatbot A"
                            rows={3}
                        />
                    </div>

                    <div className="chatbot-config">
                        <h3>Chatbot B</h3>
                        <label>Model</label>
                        <select value={modelB} onChange={(e) => setModelB(e.target.value)}>
                            {models.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                        <label>System prompt</label>
                        <textarea
                            value={promptB}
                            onChange={(e) => setPromptB(e.target.value)}
                            placeholder="Role or personality for Chatbot B"
                            rows={3}
                        />
                    </div>
                </div>

                <div className="form-section form-row">
                    <label>Max turns</label>
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
                    Start Conversation
                </button>
            </form>
        </div>
    );
}
