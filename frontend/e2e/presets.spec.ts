import { test, expect } from "@playwright/test";

test.describe("Preset CRUD", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector(".setup-form");
    });

    test("Presets dropdown loads on page open", async ({ page }) => {
        const presetSelect = page.locator(".setup-form .field").first().locator("select");
        await expect(presetSelect).toBeVisible();
        const optionCount = await presetSelect.locator("option").count();
        expect(optionCount).toBeGreaterThan(1);
    });

    test("Loading a preset populates the form", async ({ page }) => {
        const presetSelect = page.locator(".setup-form .field").first().locator("select");
        await presetSelect.selectOption({ index: 1 });

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

        const presetSelect = page.locator(".setup-form .field").first().locator("select");
        await expect(presetSelect.locator("option", { hasText: uniqueName })).toBeAttached();
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

    test("Renaming a preset updates the dropdown option", async ({ page }) => {
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

        const presetSelect = page.locator(".setup-form .field").first().locator("select");
        await presetSelect.selectOption({ label: originalName });

        const manageBtn = page.locator(".preset-action-link", { hasText: "Manage" });
        await manageBtn.click();

        const presetRow = page.locator(".preset-manage-row", { hasText: originalName });
        await presetRow.locator(".preset-manage-row-btn").click();
        await presetRow.locator(".preset-menu-item", { hasText: "Rename" }).click();

        const renameDialog = page.locator('[role="dialog"]');
        await expect(renameDialog).toBeVisible();

        const renamedName = "Renamed " + Date.now();
        const renameInput = renameDialog.locator("input");
        await renameInput.fill(renamedName);
        await renameDialog.locator("button", { hasText: "Save" }).click();

        await expect(renameDialog).not.toBeVisible({ timeout: 5000 });
        await expect(presetSelect.locator("option", { hasText: renamedName })).toBeAttached();
    });

    test("Rename dialog requires non-empty name", async ({ page }) => {
        const presetSelect = page.locator(".setup-form .field").first().locator("select");
        const firstOption = presetSelect.locator("option").nth(1);
        const presetName = await firstOption.textContent();
        await presetSelect.selectOption({ index: 1 });

        const manageBtn = page.locator(".preset-action-link", { hasText: "Manage" });
        await manageBtn.click();

        const presetRow = page.locator(".preset-manage-row", { hasText: presetName! });
        await presetRow.locator(".preset-manage-row-btn").click();
        await presetRow.locator(".preset-menu-item", { hasText: "Rename" }).click();

        const renameDialog = page.locator('[role="dialog"]');
        await expect(renameDialog).toBeVisible();

        const renameInput = renameDialog.locator("input");
        await renameInput.fill("");

        const saveButton = renameDialog.locator("button", { hasText: "Save" });
        await expect(saveButton).toBeDisabled();
    });

    test("Deleting a preset removes it from dropdown", async ({ page }) => {
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

        const presetSelect = page.locator(".setup-form .field").first().locator("select");
        await presetSelect.selectOption({ label: deleteName });

        const manageBtn = page.locator(".preset-action-link", { hasText: "Manage" });
        await manageBtn.click();

        const presetRow = page.locator(".preset-manage-row", { hasText: deleteName });
        await presetRow.locator(".preset-manage-row-btn").click();
        await presetRow.locator(".preset-menu-item-danger", { hasText: "Delete" }).click();

        const confirmDialog = page.locator(".confirmation-dialog");
        await expect(confirmDialog).toBeVisible();
        await confirmDialog.locator("button", { hasText: "Delete" }).click();

        await expect(presetSelect.locator("option", { hasText: deleteName })).not.toBeAttached({ timeout: 5000 });
    });

    test("Cancelling delete does not remove preset", async ({ page }) => {
        const presetSelect = page.locator(".setup-form .field").first().locator("select");
        const firstOption = presetSelect.locator("option").nth(1);
        const presetName = await firstOption.textContent();
        await presetSelect.selectOption({ index: 1 });

        const manageBtn = page.locator(".preset-action-link", { hasText: "Manage" });
        await manageBtn.click();

        const presetRow = page.locator(".preset-manage-row", { hasText: presetName! });
        await presetRow.locator(".preset-manage-row-btn").click();
        await presetRow.locator(".preset-menu-item-danger", { hasText: "Delete" }).click();

        const confirmDialog = page.locator(".confirmation-dialog");
        await expect(confirmDialog).toBeVisible();
        await confirmDialog.locator("button", { hasText: "Cancel" }).click();

        await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
        await expect(presetSelect.locator("option", { hasText: presetName! })).toBeAttached();
    });
});
