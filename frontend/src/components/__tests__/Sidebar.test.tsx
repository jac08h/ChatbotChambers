import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Sidebar } from "../Sidebar"
import type { ArchivedSession } from "../../hooks/useWebSocket"

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
                selectedSessionId={null}
                hasCurrentConversation={false}
                isCurrentConversationSelected={false}
            />
        )
        expect(screen.getByRole("button", { name: "12345678" })).toBeInTheDocument()
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
                selectedSessionId={null}
                hasCurrentConversation={false}
                isCurrentConversationSelected={false}
            />
        )

        await userEvent.click(screen.getByRole("button", { name: "Conversation options for 12345678" }))
        await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }))
        expect(onRenameSession).toHaveBeenCalledWith(expect.objectContaining({ id: history[0].id }))

        await userEvent.click(screen.getByRole("button", { name: "Conversation options for 12345678" }))
        await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }))
        expect(onDeleteSession).toHaveBeenCalledWith(expect.objectContaining({ id: history[0].id }))
    })
})
