import { test, expect } from "@playwright/test";

test.describe("Setup Form & Configuration", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector(".setup-form");
    });

    test("Provider chips load and are selectable", async ({ page }) => {
        const providerGroup = page.locator(".chatbot-config.side-a .provider-chips");
        await expect(providerGroup).toBeVisible();
        const chips = providerGroup.locator("button");
        await expect(chips.first()).toBeVisible();

        const mockChip = providerGroup.locator("button", { hasText: "Mock" });
        await expect(mockChip).toBeVisible();
        await mockChip.click();
        await expect(mockChip).toHaveClass(/scenario-chip-active/);
    });

    test("Model dropdown populates on provider select", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const providerChips = sectionA.locator(".provider-chips");
        const mockChip = providerChips.locator("button", { hasText: "Mock" });
        await mockChip.click();

        const select = sectionA.locator("select");
        await expect(select).toBeVisible();
        const options = select.locator("option");
        await expect(options).toHaveCount(2);
        await expect(options.nth(0)).toHaveText("Mock Fast");
        await expect(options.nth(1)).toHaveText("Mock Thinker");
    });

    test("Selecting model A enables the start button after model B selected too", async ({ page }) => {
        const startBtn = page.locator("button.start-btn");

        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");

        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();

        await expect(sectionA.locator("select")).toBeVisible();
        await expect(sectionB.locator("select")).toBeVisible();

        await expect(startBtn).toBeEnabled();
    });

    test("Shared system prompt field accepts input", async ({ page }) => {
        const textarea = page.locator("textarea").first();
        await textarea.fill("Test shared prompt");
        await expect(textarea).toHaveValue("Test shared prompt");
    });

    test("Per-chatbot system prompt accepts input", async ({ page }) => {
        const promptA = page.locator(".chatbot-config.side-a textarea");
        await promptA.fill("Prompt for A");
        await expect(promptA).toHaveValue("Prompt for A");

        const promptB = page.locator(".chatbot-config.side-b textarea");
        await promptB.fill("Prompt for B");
        await expect(promptB).toHaveValue("Prompt for B");
    });

    test("Advanced section expands on click", async ({ page }) => {
        const section = page.locator(".chatbot-config.side-a");
        const toggle = section.locator(".advanced-toggle");
        await expect(toggle).toBeVisible();

        const advancedFields = section.locator(".advanced-fields");
        await expect(advancedFields).toHaveClass(/advanced-fields-hidden/);

        await toggle.click();
        await expect(advancedFields).not.toHaveClass(/advanced-fields-hidden/);
    });

    test("Name field in advanced section editable", async ({ page }) => {
        const section = page.locator(".chatbot-config.side-a");
        await section.locator(".advanced-toggle").click();

        const nameField = section.locator(".advanced-fields input[type='text']");
        await nameField.fill("Custom Name");
        await expect(nameField).toHaveValue("Custom Name");
    });

    test("Conversation title field optional — start works with empty title", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();

        await expect(sectionA.locator("select")).toBeVisible();
        await expect(sectionB.locator("select")).toBeVisible();

        const titleField = page.locator(".setup-bottom input[type='text']");
        await expect(titleField).toHaveValue("");

        const startBtn = page.locator("button.start-btn");
        await expect(startBtn).toBeEnabled();
        await startBtn.click();

        await expect(page.locator(".conversation-container")).toBeVisible({ timeout: 15000 });
    });

    test("Settings persist after page reload", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();

        await expect(sectionA.locator("select")).toBeVisible();
        await expect(sectionB.locator("select")).toBeVisible();

        await sectionA.locator("select").selectOption("mock/thinking-model");

        const sharedPrompt = page.locator("textarea").first();
        await sharedPrompt.fill("Persist this prompt");

        const startBtn = page.locator("button.start-btn");
        await startBtn.click();
        await expect(page.locator(".conversation-container")).toBeVisible({ timeout: 15000 });

        await page.goto("/");
        await page.waitForSelector(".setup-form");

        await expect(page.locator("textarea").first()).toHaveValue("Persist this prompt", { timeout: 5000 });
    });

    test("Enable thinking checkbox is visible and toggleable for Mock provider", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();

        const checkbox = sectionA.locator(".thinking-toggle-field input[type='checkbox']");
        await expect(checkbox).toBeVisible();
        await expect(checkbox).toBeEnabled();
        await expect(checkbox).not.toBeChecked();

        await checkbox.check();
        await expect(checkbox).toBeChecked();
    });

    test("Enable thinking checkbox is disabled for non-OpenRouter providers", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const providerChips = sectionA.locator(".provider-chips");

        const copilotChip = providerChips.locator("button", { hasText: "GitHub Copilot" });
        if (await copilotChip.isVisible()) {
            await copilotChip.click();

            const checkbox = sectionA.locator(".thinking-toggle-field input[type='checkbox']");
            await expect(checkbox).toBeVisible();
            await expect(checkbox).toBeDisabled();

            const hint = sectionA.locator(".thinking-toggle-hint");
            await expect(hint).toBeVisible();
            await expect(hint).toContainText("Currently supported only for OpenRouter");
        }
    });

    test("Enable thinking checkbox resets when switching to unsupported provider", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");

        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        const checkbox = sectionA.locator(".thinking-toggle-field input[type='checkbox']");
        await expect(checkbox).toBeEnabled();
        await checkbox.check();
        await expect(checkbox).toBeChecked();

        const copilotChip = sectionA.locator(".provider-chips button", { hasText: "GitHub Copilot" });
        if (await copilotChip.isVisible()) {
            await copilotChip.click();
            await expect(checkbox).not.toBeChecked();
            await expect(checkbox).toBeDisabled();
        }
    });
});
