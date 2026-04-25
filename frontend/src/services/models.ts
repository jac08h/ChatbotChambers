import { apiUrl } from "../api";
import { isHostedMode } from "../lib/deployment";
import { HOSTED_MODELS } from "../lib/hostedProviders";
import type { ModelInfo, Provider } from "../lib/types";

export async function listModels(provider: Provider): Promise<ModelInfo[]> {
    if (isHostedMode) {
        return provider === "openrouter" ? HOSTED_MODELS : [];
    }
    const searchParams = new URLSearchParams({ provider });
    const response = await fetch(apiUrl(`/models?${searchParams.toString()}`));
    if (!response.ok) {
        throw new Error("Failed to load models");
    }
    return response.json();
}
