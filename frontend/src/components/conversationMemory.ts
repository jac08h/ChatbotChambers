const BASE_WIDTH = 42
const WORD_MULTIPLIER = 11
const MAX_BAR_COUNT = 4
const MIN_BAR_COUNT = 2
const MIN_LAST_BAR_WIDTH = 28
const LAST_BAR_OFFSET = 18
const DEFAULT_WORD_LENGTH = 6

export function buildMemoryBars(content: string): number[] {
    const lineCount = Math.max(MIN_BAR_COUNT, Math.min(MAX_BAR_COUNT, Math.ceil(content.trim().length / BASE_WIDTH)))
    const words = content.trim().split(/\s+/).filter(Boolean)

    return Array.from({ length: lineCount }, (_, index) => {
        const sourceIndex = words.length > 0 ? index % words.length : 0
        const wordLength = words[sourceIndex]?.length ?? DEFAULT_WORD_LENGTH
        const width = BASE_WIDTH + ((wordLength * WORD_MULTIPLIER) % BASE_WIDTH)
        return index === lineCount - 1 ? Math.max(MIN_LAST_BAR_WIDTH, width - LAST_BAR_OFFSET) : width
    })
}
