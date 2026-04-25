import { apiUrl } from "../api";
import { HOSTED_PROVIDERS } from "../lib/hostedProviders";
import { isHostedMode } from "../lib/deployment";
import type { ProviderInfo } from "../lib/types";

export async function listProviders(): Promise<Record<string, ProviderInfo>> {
    if (isHostedMode) {
        return HOSTED_PROVIDERS;
    }
    const response = await fetch(apiUrl("/providers"));
    if (!response.ok) {
        throw new Error("Failed to load providers");
    }
    return response.json();
}
