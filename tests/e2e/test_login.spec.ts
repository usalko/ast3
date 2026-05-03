import { test, expect } from "@playwright/test";

/**
 * Smoke test: login page loads and form elements are present.
 * Expand with full flows in Ф1.
 */
test.describe("Login", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[autocomplete='username']")).toBeVisible();
    await expect(page.locator("input[autocomplete='current-password']")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });
});
