const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

function buildBaseUrl(): URL {
    if (configuredApiBaseUrl) {
        return new URL(configuredApiBaseUrl.endsWith("/") ? configuredApiBaseUrl : `${configuredApiBaseUrl}/`);
    }
    return new URL(window.location.origin);
}

export function apiUrl(path: string): string {
    return new URL(path, buildBaseUrl()).toString();
}

export function webSocketUrl(path: string): string {
    const url = new URL(path, buildBaseUrl());
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
}
