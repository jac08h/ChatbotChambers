import { test, expect } from "@playwright/test";

test.describe("Preset CRUD", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector(".setup-form");
    });

    test("Presets list loads on page open", async ({ page }) => {
        const presetGroup = page.locator(".preset-chips");
        await expect(presetGroup).toBeVisible();
        const presetItems = presetGroup.locator(".preset-item");
        const count = await presetItems.count();
        expect(count).toBeGreaterThan(0);
    });

    test("Loading a preset populates the form", async ({ page }) => {
        const firstPreset = page.locator(".preset-chips .preset-item .preset-chip-label").first();
        await firstPreset.click();

        const sharedPrompt = page.locator("textarea").first();
        await expect(sharedPrompt).not.toHaveValue("");
    });

    test("Saving current config as new preset", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();
        await expect(sectionA.locator("select")).toBeVisible();
        await expect(sectionB.locator("select")).toBeVisible();

        const saveLink = page.locator(".preset-save-link");
        await saveLink.click();

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        const presetNameInput = dialog.locator("input");
        const uniqueName = "E2E Test Preset " + Date.now();
        await presetNameInput.fill(uniqueName);
        await dialog.locator("button", { hasText: "Save" }).click();

        await expect(dialog).not.toBeVisible({ timeout: 5000 });

        const newPresetChip = page.locator(".preset-chip-label", { hasText: uniqueName });
        await expect(newPresetChip).toBeVisible();
    });

    test("Preset name required to save", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();
        await expect(sectionA.locator("select")).toBeVisible();
        await expect(sectionB.locator("select")).toBeVisible();

        const saveLink = page.locator(".preset-save-link");
        await saveLink.click();

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        await dialog.locator("button", { hasText: "Save" }).click();

        const error = dialog.locator(".preset-save-error");
        await expect(error).toBeVisible();
        await expect(error).toHaveText("Enter a preset name.");
    });

    test("Renaming a preset updates the chip label", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();
        await expect(sectionA.locator("select")).toBeVisible();

        const saveLink = page.locator(".preset-save-link");
        await saveLink.click();
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        const originalName = "Rename Test " + Date.now();
        await dialog.locator("input").fill(originalName);
        await dialog.locator("button", { hasText: "Save" }).click();
        await expect(dialog).not.toBeVisible({ timeout: 5000 });

        const presetItem = page.locator(".preset-item", { has: page.locator(".preset-chip-label", { hasText: originalName }) });
        await presetItem.locator(".preset-chip-menu-btn").click();
        await presetItem.locator('[role="menuitem"]', { hasText: "Rename" }).click();

        const renameDialog = page.locator('[role="dialog"]');
        await expect(renameDialog).toBeVisible();

        const renamedName = "Renamed " + Date.now();
        const renameInput = renameDialog.locator("input");
        await renameInput.fill(renamedName);
        await renameDialog.locator("button", { hasText: "Save" }).click();

        await expect(renameDialog).not.toBeVisible({ timeout: 5000 });
        await expect(page.locator(".preset-chip-label", { hasText: renamedName })).toBeVisible();
    });

    test("Rename dialog requires non-empty name", async ({ page }) => {
        const firstPresetItem = page.locator(".preset-chips .preset-item").first();
        await firstPresetItem.locator(".preset-chip-menu-btn").click();
        await firstPresetItem.locator('[role="menuitem"]', { hasText: "Rename" }).click();

        const renameDialog = page.locator('[role="dialog"]');
        await expect(renameDialog).toBeVisible();

        const renameInput = renameDialog.locator("input");
        await renameInput.fill("");

        const saveButton = renameDialog.locator("button", { hasText: "Save" });
        await expect(saveButton).toBeDisabled();
    });

    test("Deleting a preset removes it from list", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();
        await expect(sectionA.locator("select")).toBeVisible();

        const saveLink = page.locator(".preset-save-link");
        await saveLink.click();
        const dialog = page.locator('[role="dialog"]');
        const deleteName = "Delete Me " + Date.now();
        await dialog.locator("input").fill(deleteName);
        await dialog.locator("button", { hasText: "Save" }).click();
        await expect(dialog).not.toBeVisible({ timeout: 5000 });

        const presetItem = page.locator(".preset-item", { has: page.locator(".preset-chip-label", { hasText: deleteName }) });
        await expect(presetItem).toBeVisible();

        await presetItem.locator(".preset-chip-menu-btn").click();
        await presetItem.locator('[role="menuitem"]', { hasText: "Delete" }).click();

        const confirmDialog = page.locator(".confirmation-dialog");
        await expect(confirmDialog).toBeVisible();
        await confirmDialog.locator("button", { hasText: "Delete" }).click();

        await expect(page.locator(".preset-chip-label", { hasText: deleteName })).not.toBeVisible({ timeout: 5000 });
    });

    test("Cancelling delete does not remove preset", async ({ page }) => {
        const firstPresetItem = page.locator(".preset-chips .preset-item").first();
        const presetName = await firstPresetItem.locator(".preset-chip-label").textContent();

        await firstPresetItem.locator(".preset-chip-menu-btn").click();
        await firstPresetItem.locator('[role="menuitem"]', { hasText: "Delete" }).click();

        const confirmDialog = page.locator(".confirmation-dialog");
        await expect(confirmDialog).toBeVisible();
        await confirmDialog.locator("button", { hasText: "Cancel" }).click();

        await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
        await expect(page.locator(".preset-chip-label", { hasText: presetName! })).toBeVisible();
    });
});
