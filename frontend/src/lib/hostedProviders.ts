import type { ModelInfo, Provider, ProviderInfo } from "./types";

export const HOSTED_PROVIDER: Provider = "openrouter";

export const HOSTED_PROVIDERS: Record<Provider, ProviderInfo> = {
    openrouter: {
        available: true,
        available_in_hosted: true,
        docs_url: "https://openrouter.ai/docs",
    },
    github_copilot: {
        available: false,
        available_in_hosted: false,
    },
    claude_code: {
        available: false,
        available_in_hosted: false,
    },
    codex: {
        available: false,
        available_in_hosted: false,
    },
    mock: {
        available: false,
        available_in_hosted: false,
    },
};

export const HOSTED_MODELS: ModelInfo[] = [
    { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini" },
    { id: "openai/gpt-4.1", name: "GPT-4.1" },
    { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet" },
    { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash Preview" },
    { id: "google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro Preview" },
    { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick" },
    { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B Instruct" },
];

export function getHostedModelName(modelId: string): string {
    return HOSTED_MODELS.find((model) => model.id === modelId)?.name ?? modelId;
}
