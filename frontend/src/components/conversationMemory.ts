export function buildMemoryBars(content: string): number[] {
    const lineCount = Math.max(2, Math.min(4, Math.ceil(content.trim().length / 42)));
    const words = content.trim().split(/\s+/).filter(Boolean);

    return Array.from({ length: lineCount }, (_, index) => {
        const wordLength = words[index % Math.max(words.length, 1)]?.length ?? 6;
        const width = 42 + ((wordLength * 11) % 42);
        return index === lineCount - 1 ? Math.max(28, width - 18) : width;
    });
}
