export interface ChatMessage {
    chatbot: "a" | "b";
    name: string;
    model: string;
    model_name?: string;
    content: string;
    turn: number;
    thinking: string;
}

export type Provider = "openrouter" | "github_copilot" | "claude_code" | "codex" | "mock";

export const DEFAULT_CHATBOT_NAMES = {
    a: "",
    b: "",
} as const;

export interface ChatbotConfig {
    name: string;
    model: string;
    system_prompt: string;
    provider: Provider;
}

export interface SessionConfig {
    chatbot_a: ChatbotConfig;
    chatbot_b: ChatbotConfig;
    shared_system_prompt: string;
}

export type Status = "idle" | "running" | "paused" | "done" | "error";

export interface ArchivedSession {
    id: string;
    title: string | null;
    messages: ChatMessage[];
    config: SessionConfig;
    doneReason: string | null;
    error: string | null;
}

export interface ConversationState {
    messages: ChatMessage[];
    status: Status;
    generatingChatbot: "a" | "b" | null;
    doneReason: string | null;
    error: string | null;
    startupError: string | null;
    emptyMessageError: "a" | "b" | null;
    config: SessionConfig | null;
    currentSessionId: string | null;
    currentTitle: string | null;
    history: ArchivedSession[];
    start: (config: SessionConfig, initialTitle?: string | null) => void;
    pause: () => void;
    resume: () => void;
    retry: () => void;
    reset: () => void;
    clearStartupError: () => void;
    renameCurrentSession: (title: string) => void;
    renameSession: (id: string, title: string) => void;
    deleteSession: (id: string) => Promise<boolean>;
    deleteAllSessions: () => Promise<boolean>;
}

export interface ProviderInfo {
    available: boolean;
    available_in_hosted?: boolean;
    docs_url?: string;
}

export interface ModelInfo {
    id: string;
    name: string;
}

export interface Scenario {
    id: string;
    name: string;
    shared_system_prompt: string;
    system_prompt_a: string;
    system_prompt_b: string;
    config?: SessionConfig;
}
