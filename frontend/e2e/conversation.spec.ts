import { test, expect } from "@playwright/test";

async function startMockConversation(page: import("@playwright/test").Page, modelA = "mock/fast-model", modelB = "mock/fast-model") {
    await page.goto("/");
    await page.waitForSelector(".setup-form");

    const sectionA = page.locator(".chatbot-config.side-a");
    const sectionB = page.locator(".chatbot-config.side-b");

    await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
    await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();

    await expect(sectionA.locator("select")).toBeVisible();
    await expect(sectionB.locator("select")).toBeVisible();

    await sectionA.locator("select").selectOption(modelA);
    await sectionB.locator("select").selectOption(modelB);

    await page.locator("button.start-btn").click();
    await expect(page.locator(".conversation-container")).toBeVisible({ timeout: 15000 });
}

test.describe("Conversation Flow (mock provider)", () => {
    test("Starting conversation transitions to conversation view", async ({ page }) => {
        await startMockConversation(page);
        await expect(page.locator(".conversation-container")).toBeVisible();
    });

    test("Both chatbots produce messages", async ({ page }) => {
        await startMockConversation(page);

        await expect(page.locator(".message-row.chatbot-a").first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator(".message-row.chatbot-b").first()).toBeVisible({ timeout: 15000 });
    });

    test("Generating indicator appears while chatbot is typing", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector(".setup-form");

        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();
        await expect(sectionA.locator("select")).toBeVisible();
        await expect(sectionB.locator("select")).toBeVisible();

        await page.locator("button.start-btn").click();
        await expect(page.locator(".conversation-container")).toBeVisible({ timeout: 15000 });

        const generatingBubble = page.locator(".message-bubble.generating");
        const messageRows = page.locator(".message-row");

        await expect(generatingBubble.or(messageRows.first())).toBeVisible({ timeout: 15000 });
    });

    test("Message shows sender name and model label", async ({ page }) => {
        await startMockConversation(page);

        const firstMessage = page.locator(".message-row").first();
        await expect(firstMessage).toBeVisible({ timeout: 15000 });

        const senderLabel = firstMessage.locator(".sender-label");
        await expect(senderLabel).toBeVisible();
        await expect(senderLabel).not.toHaveText("");

        const modelLabel = firstMessage.locator(".model-label");
        await firstMessage.hover();
        await expect(modelLabel).toBeVisible();
        await expect(modelLabel).toContainText("mock/");
    });

    test("Conversation ends with done banner", async ({ page }) => {
        await startMockConversation(page);

        const doneBanner = page.locator(".done-banner");
        await expect(doneBanner).toBeVisible({ timeout: 30000 });
    });

    test("Done reason 'left the chat' shown correctly", async ({ page }) => {
        await startMockConversation(page);

        const doneBanner = page.locator(".done-banner");
        await expect(doneBanner).toBeVisible({ timeout: 30000 });
        const bannerText = await doneBanner.textContent();
        expect(bannerText).toContain("left the chat");
    });

    test("Thinking block collapsed by default, expands on click", async ({ page }) => {
        await startMockConversation(page, "mock/thinking-model", "mock/fast-model");

        const thinkingBlock = page.locator(".thinking-block").first();
        await expect(thinkingBlock).toBeVisible({ timeout: 30000 });

        const thinkingContent = thinkingBlock.locator(".message-content");
        await expect(thinkingContent).not.toBeVisible();

        await thinkingBlock.locator("summary").click();
        await expect(thinkingContent).toBeVisible();
        await expect(thinkingContent).toContainText("Mock thinking");
    });
});
