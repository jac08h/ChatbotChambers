import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Sidebar } from "../Sidebar"
import { generateSlug, type ArchivedSession } from "../../hooks/useWebSocket"

const sessionSlug = generateSlug("12345678-1234-1234-1234-123456789abc")

const history: ArchivedSession[] = [
    {
        id: "12345678-1234-1234-1234-123456789abc",
        title: null,
        messages: [],
        config: {
            chatbot_a: { name: "Alice", model: "model-a", system_prompt: "", provider: "openrouter" },
            chatbot_b: { name: "Bob", model: "model-b", system_prompt: "", provider: "openrouter" },
            shared_system_prompt: "",
        },
        doneReason: "stopped",
        error: null,
    },
]

describe("Sidebar", () => {
    it("shows slug titles when a conversation has no custom name", () => {
        render(
            <Sidebar
                currentSession={null}
                history={history}
                currentLabel={null}
                onHome={vi.fn()}
                onNewChat={vi.fn()}
                onSelectCurrentConversation={vi.fn()}
                onSelectSession={vi.fn()}
                onRenameSession={vi.fn()}
                onDeleteSession={vi.fn()}
                onDeleteAllSessions={vi.fn()}
                selectedSessionId={null}
                hasCurrentConversation={false}
                isCurrentConversationSelected={false}
                theme="dark"
                onToggleTheme={vi.fn()}
                isCollapsed={false}
                onToggleCollapse={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: sessionSlug })).toBeInTheDocument()
    })

    it("renames and deletes through the conversation menu", async () => {
        const onRenameSession = vi.fn()
        const onDeleteSession = vi.fn()
        render(
            <Sidebar
                currentSession={null}
                history={history}
                currentLabel={null}
                onHome={vi.fn()}
                onNewChat={vi.fn()}
                onSelectCurrentConversation={vi.fn()}
                onSelectSession={vi.fn()}
                onRenameSession={onRenameSession}
                onDeleteSession={onDeleteSession}
                onDeleteAllSessions={vi.fn()}
                selectedSessionId={null}
                hasCurrentConversation={false}
                isCurrentConversationSelected={false}
                theme="dark"
                onToggleTheme={vi.fn()}
                isCollapsed={false}
                onToggleCollapse={vi.fn()}
            />
        )

        await userEvent.click(screen.getByRole("button", { name: `Conversation options for ${sessionSlug}` }))
        await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }))
        expect(onRenameSession).toHaveBeenCalledWith(expect.objectContaining({ id: history[0].id }))

        await userEvent.click(screen.getByRole("button", { name: `Conversation options for ${sessionSlug}` }))
        await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }))
        expect(onDeleteSession).toHaveBeenCalledWith(expect.objectContaining({ id: history[0].id }))
    })

    it("toggles sidebar collapse when button is clicked", async () => {
        const onToggleCollapse = vi.fn()
        render(
            <Sidebar
                currentSession={null}
                history={history}
                currentLabel={null}
                onHome={vi.fn()}
                onNewChat={vi.fn()}
                onSelectCurrentConversation={vi.fn()}
                onSelectSession={vi.fn()}
                onRenameSession={vi.fn()}
                onDeleteSession={vi.fn()}
                onDeleteAllSessions={vi.fn()}
                selectedSessionId={null}
                hasCurrentConversation={false}
                isCurrentConversationSelected={false}
                theme="dark"
                onToggleTheme={vi.fn()}
                isCollapsed={false}
                onToggleCollapse={onToggleCollapse}
            />
        )
        await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
        expect(onToggleCollapse).toHaveBeenCalledOnce()
    })

    it("hides history items when collapsed", () => {
        render(
            <Sidebar
                currentSession={null}
                history={history}
                currentLabel={null}
                onHome={vi.fn()}
                onNewChat={vi.fn()}
                onSelectCurrentConversation={vi.fn()}
                onSelectSession={vi.fn()}
                onRenameSession={vi.fn()}
                onDeleteSession={vi.fn()}
                onDeleteAllSessions={vi.fn()}
                selectedSessionId={null}
                hasCurrentConversation={false}
                isCurrentConversationSelected={false}
                theme="dark"
                onToggleTheme={vi.fn()}
                isCollapsed={true}
                onToggleCollapse={vi.fn()}
            />
        )
        expect(screen.queryByRole("button", { name: sessionSlug })).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()
    })

    it("shows delete all button when history is not empty", () => {
        render(
            <Sidebar
                currentSession={null}
                history={history}
                currentLabel={null}
                onHome={vi.fn()}
                onNewChat={vi.fn()}
                onSelectCurrentConversation={vi.fn()}
                onSelectSession={vi.fn()}
                onRenameSession={vi.fn()}
                onDeleteSession={vi.fn()}
                onDeleteAllSessions={vi.fn()}
                selectedSessionId={null}
                hasCurrentConversation={false}
                isCurrentConversationSelected={false}
                theme="dark"
                onToggleTheme={vi.fn()}
                isCollapsed={false}
                onToggleCollapse={vi.fn()}
            />
        )
        expect(screen.getByRole("button", { name: "Delete all conversations" })).toBeInTheDocument()
    })

    it("calls onDeleteAllSessions when delete all is clicked", async () => {
        const onDeleteAllSessions = vi.fn()
        render(
            <Sidebar
                currentSession={null}
                history={history}
                currentLabel={null}
                onHome={vi.fn()}
                onNewChat={vi.fn()}
                onSelectCurrentConversation={vi.fn()}
                onSelectSession={vi.fn()}
                onRenameSession={vi.fn()}
                onDeleteSession={vi.fn()}
                onDeleteAllSessions={onDeleteAllSessions}
                selectedSessionId={null}
                hasCurrentConversation={false}
                isCurrentConversationSelected={false}
                theme="dark"
                onToggleTheme={vi.fn()}
                isCollapsed={false}
                onToggleCollapse={vi.fn()}
            />
        )
        await userEvent.click(screen.getByRole("button", { name: "Delete all conversations" }))
        expect(onDeleteAllSessions).toHaveBeenCalledOnce()
    })
})
