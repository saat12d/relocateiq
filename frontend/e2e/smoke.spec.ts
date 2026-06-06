import { expect, type Page, test } from "@playwright/test";

const AUTH_TOKEN_KEY = "relocateiq.authToken";

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

test.describe("public routes", () => {
  test("homepage renders the landing search experience", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "RelocateIQ home" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /find the best place to live near your work/i,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Workplace address")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /start search/i }),
    ).toBeVisible();
    await expect(page.getByText("Top neighborhoods")).toBeVisible();
  });

  test("login page renders the account form", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /log in to relocateiq/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("signup page renders the registration form", async ({ page }) => {
    await page.goto("/signup");

    await expect(
      page.getByRole("heading", { name: /create your relocateiq account/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i }),
    ).toBeVisible();
  });
});

test.describe("protected routes", () => {
  test("dashboard redirects anonymous users to login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: /log in to relocateiq/i }),
    ).toBeVisible();
  });

  test("dashboard renders for an authenticated user", async ({ page }) => {
    await mockSignedInUser(page);

    await page.goto("/dashboard");

    await expect(page.getByRole("link", { name: "RelocateIQ home" })).toBeVisible();
    await expect(page.getByPlaceholder("800 Wilshire Blvd, Los Angeles")).toBeVisible();
    await expect(page.getByLabel("Search radius")).toBeVisible();
    await expect(page.getByText("Enter your workplace to start.")).toBeVisible();
  });

  test("saved scenarios renders for an authenticated user with no saved scenarios", async ({
    page,
  }) => {
    await mockSignedInUser(page);
    await page.route("**/api/v1/scenarios", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/scenarios");

    await expect(
      page.getByRole("heading", { name: "Saved scenarios", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("No saved scenarios found")).toBeVisible();
  });
});
