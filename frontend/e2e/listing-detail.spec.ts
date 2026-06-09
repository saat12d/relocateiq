import { expect, type Page, test } from "@playwright/test";

const AUTH_TOKEN_KEY = "relocateiq.authToken";

const MOCK_LISTING = {
  listingId: "listing-abc-123",
  address: "123 Elm Street, Westwood, CA 90024",
  rent: 2850,
  bedrooms: 2,
  bathrooms: 1.5,
  url: "https://example.com/listing/abc-123",
};

async function mockSignedInUser(page: Page) {
  await page.addInitScript(
    ({ key }) => window.localStorage.setItem(key, "e2e-test-token"),
    { key: AUTH_TOKEN_KEY },
  );
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        userId: "user-e2e",
        email: "test@relocateiq.dev",
        name: "Test User",
      }),
    });
  });
}

test.describe("listing detail page", () => {
  test("renders all listing fields for an authenticated user", async ({
    page,
  }) => {
    await mockSignedInUser(page);

    await page.route("**/api/v1/zones/westwood/listings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_LISTING]),
      });
    });

    await page.goto("/zones/westwood/listings/listing-abc-123");

    await expect(
      page.getByText("123 Elm Street, Westwood, CA 90024"),
    ).toBeVisible();
    await expect(page.getByText("$2,850").first()).toBeVisible();
    await expect(page.getByText("2", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("1.5", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View on listing site" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "← Back to dashboard" }),
    ).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/listing-detail.png" });
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/zones/westwood/listings/listing-abc-123");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows not-found state for unknown listing id", async ({ page }) => {
    await mockSignedInUser(page);

    await page.route("**/api/v1/zones/westwood/listings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_LISTING]),
      });
    });

    await page.goto("/zones/westwood/listings/nonexistent-id");

    await expect(page.getByText("Listing not found")).toBeVisible();
  });
});
