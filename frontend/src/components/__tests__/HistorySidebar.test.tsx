import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { HistorySidebar } from "../HistorySidebar"

const defaultProps = {
    sessions: [],
    selectedSession: null,
    showCurrent: false,
    currentActive: false,
    onSelectCurrent: vi.fn(),
    onSelectSession: vi.fn(),
}

describe("HistorySidebar", () => {
    it("shows empty state message when no sessions", () => {
        render(<HistorySidebar {...defaultProps} />)
        expect(screen.getByText("No saved conversations yet.")).toBeInTheDocument()
    })

    it("renders session labels", () => {
        render(
            <HistorySidebar
                {...defaultProps}
                sessions={[{ id: 1, label: "First session" }, { id: 2, label: "Second session" }]}
            />
        )
        expect(screen.getByText("First session")).toBeInTheDocument()
        expect(screen.getByText("Second session")).toBeInTheDocument()
    })

    it("highlights the active session", () => {
        render(
            <HistorySidebar
                {...defaultProps}
                sessions={[{ id: 1, label: "Session 1" }, { id: 2, label: "Session 2" }]}
                selectedSession={1}
            />
        )
        const btn = screen.getByRole("button", { name: "Session 1" })
        expect(btn).toHaveClass("active")
        const other = screen.getByRole("button", { name: "Session 2" })
        expect(other).not.toHaveClass("active")
    })

    it("calls onSelectSession with correct id when session clicked", async () => {
        const onSelect = vi.fn()
        render(
            <HistorySidebar
                {...defaultProps}
                sessions={[{ id: 42, label: "My session" }]}
                onSelectSession={onSelect}
            />
        )
        await userEvent.click(screen.getByRole("button", { name: "My session" }))
        expect(onSelect).toHaveBeenCalledWith(42)
    })

    it("shows Current chat button when showCurrent is true", () => {
        render(<HistorySidebar {...defaultProps} showCurrent />)
        expect(screen.getByRole("button", { name: "Current chat" })).toBeInTheDocument()
    })

    it("hides Current chat button when showCurrent is false", () => {
        render(<HistorySidebar {...defaultProps} showCurrent={false} />)
        expect(screen.queryByRole("button", { name: "Current chat" })).not.toBeInTheDocument()
    })

    it("calls onSelectCurrent when Current chat button clicked", async () => {
        const onSelectCurrent = vi.fn()
        render(<HistorySidebar {...defaultProps} showCurrent onSelectCurrent={onSelectCurrent} />)
        await userEvent.click(screen.getByRole("button", { name: "Current chat" }))
        expect(onSelectCurrent).toHaveBeenCalledOnce()
    })

    it("Current chat button is active when selectedSession is null and currentActive", () => {
        render(
            <HistorySidebar
                {...defaultProps}
                showCurrent
                currentActive
                selectedSession={null}
            />
        )
        const btn = screen.getByRole("button", { name: "Current chat" })
        expect(btn).toHaveClass("active")
    })
})
