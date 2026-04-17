import { test, expect } from "@playwright/test";

test.describe("Scenario CRUD", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector(".setup-form");
    });

    test("Scenarios dropdown loads on page open", async ({ page }) => {
        const scenarioSelect = page.locator(".setup-form .field").first().locator("select");
        await expect(scenarioSelect).toBeVisible();
        const optionCount = await scenarioSelect.locator("option").count();
        expect(optionCount).toBeGreaterThan(1);
    });

    test("Loading a scenario populates the form", async ({ page }) => {
        const scenarioSelect = page.locator(".setup-form .field").first().locator("select");
        await scenarioSelect.selectOption({ index: 1 });

        const sharedPrompt = page.locator("textarea").first();
        await expect(sharedPrompt).not.toHaveValue("");
    });

    test("Saving current config as new scenario", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();
        await expect(sectionA.locator("select")).toBeVisible();
        await expect(sectionB.locator("select")).toBeVisible();

        const saveLink = page.locator(".scenario-save-link");
        await saveLink.click();

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        const scenarioNameInput = dialog.locator("input");
        const uniqueName = "E2E Test Scenario " + Date.now();
        await scenarioNameInput.fill(uniqueName);
        await dialog.locator("button", { hasText: "Save" }).click();

        await expect(dialog).not.toBeVisible({ timeout: 5000 });

        const scenarioSelect = page.locator(".setup-form .field").first().locator("select");
        await expect(scenarioSelect.locator("option", { hasText: uniqueName })).toBeAttached();
    });

    test("Scenario name required to save", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();
        await expect(sectionA.locator("select")).toBeVisible();
        await expect(sectionB.locator("select")).toBeVisible();

        const saveLink = page.locator(".scenario-save-link");
        await saveLink.click();

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        await dialog.locator("button", { hasText: "Save" }).click();

        const error = dialog.locator(".scenario-save-error");
        await expect(error).toBeVisible();
        await expect(error).toHaveText("Enter a scenario name.");
    });

    test("Renaming a scenario updates the dropdown option", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();
        await expect(sectionA.locator("select")).toBeVisible();

        const saveLink = page.locator(".scenario-save-link");
        await saveLink.click();
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        const originalName = "Rename Test " + Date.now();
        await dialog.locator("input").fill(originalName);
        await dialog.locator("button", { hasText: "Save" }).click();
        await expect(dialog).not.toBeVisible({ timeout: 5000 });

        const scenarioSelect = page.locator(".setup-form .field").first().locator("select");
        await scenarioSelect.selectOption({ label: originalName });

        const manageBtn = page.locator(".scenario-action-link", { hasText: "Manage" });
        await manageBtn.click();

        const scenarioRow = page.locator(".scenario-manage-row", { hasText: originalName });
        await scenarioRow.locator(".scenario-manage-row-btn").click();
        await scenarioRow.locator(".scenario-menu-item", { hasText: "Rename" }).click();

        const renameDialog = page.locator('[role="dialog"]');
        await expect(renameDialog).toBeVisible();

        const renamedName = "Renamed " + Date.now();
        const renameInput = renameDialog.locator("input");
        await renameInput.fill(renamedName);
        await renameDialog.locator("button", { hasText: "Save" }).click();

        await expect(renameDialog).not.toBeVisible({ timeout: 5000 });
        await expect(scenarioSelect.locator("option", { hasText: renamedName })).toBeAttached();
    });

    test("Rename dialog requires non-empty name", async ({ page }) => {
        const scenarioSelect = page.locator(".setup-form .field").first().locator("select");
        const firstOption = scenarioSelect.locator("option").nth(1);
        const scenarioName = await firstOption.textContent();
        await scenarioSelect.selectOption({ index: 1 });

        const manageBtn = page.locator(".scenario-action-link", { hasText: "Manage" });
        await manageBtn.click();

        const scenarioRow = page.locator(".scenario-manage-row", { hasText: scenarioName! });
        await scenarioRow.locator(".scenario-manage-row-btn").click();
        await scenarioRow.locator(".scenario-menu-item", { hasText: "Rename" }).click();

        const renameDialog = page.locator('[role="dialog"]');
        await expect(renameDialog).toBeVisible();

        const renameInput = renameDialog.locator("input");
        await renameInput.fill("");

        const saveButton = renameDialog.locator("button", { hasText: "Save" });
        await expect(saveButton).toBeDisabled();
    });

    test("Deleting a scenario removes it from dropdown", async ({ page }) => {
        const sectionA = page.locator(".chatbot-config.side-a");
        const sectionB = page.locator(".chatbot-config.side-b");
        await sectionA.locator(".provider-chips button", { hasText: "Mock" }).click();
        await sectionB.locator(".provider-chips button", { hasText: "Mock" }).click();
        await expect(sectionA.locator("select")).toBeVisible();

        const saveLink = page.locator(".scenario-save-link");
        await saveLink.click();
        const dialog = page.locator('[role="dialog"]');
        const deleteName = "Delete Me " + Date.now();
        await dialog.locator("input").fill(deleteName);
        await dialog.locator("button", { hasText: "Save" }).click();
        await expect(dialog).not.toBeVisible({ timeout: 5000 });

        const scenarioSelect = page.locator(".setup-form .field").first().locator("select");
        await scenarioSelect.selectOption({ label: deleteName });

        const manageBtn = page.locator(".scenario-action-link", { hasText: "Manage" });
        await manageBtn.click();

        const scenarioRow = page.locator(".scenario-manage-row", { hasText: deleteName });
        await scenarioRow.locator(".scenario-manage-row-btn").click();
        await scenarioRow.locator(".scenario-menu-item-danger", { hasText: "Delete" }).click();

        const confirmDialog = page.locator(".confirmation-dialog");
        await expect(confirmDialog).toBeVisible();
        await confirmDialog.locator("button", { hasText: "Delete" }).click();

        await expect(scenarioSelect.locator("option", { hasText: deleteName })).not.toBeAttached({ timeout: 5000 });
    });

    test("Cancelling delete does not remove scenario", async ({ page }) => {
        const scenarioSelect = page.locator(".setup-form .field").first().locator("select");
        const firstOption = scenarioSelect.locator("option").nth(1);
        const scenarioName = await firstOption.textContent();
        await scenarioSelect.selectOption({ index: 1 });

        const manageBtn = page.locator(".scenario-action-link", { hasText: "Manage" });
        await manageBtn.click();

        const scenarioRow = page.locator(".scenario-manage-row", { hasText: scenarioName! });
        await scenarioRow.locator(".scenario-manage-row-btn").click();
        await scenarioRow.locator(".scenario-menu-item-danger", { hasText: "Delete" }).click();

        const confirmDialog = page.locator(".confirmation-dialog");
        await expect(confirmDialog).toBeVisible();
        await confirmDialog.locator("button", { hasText: "Cancel" }).click();

        await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
        await expect(scenarioSelect.locator("option", { hasText: scenarioName! })).toBeAttached();
    });
});
