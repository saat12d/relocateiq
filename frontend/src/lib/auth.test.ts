/**
 * Unit tests for frontend auth library (lib/auth.ts).
 * * These tests cover token persistence, authenticated fetch wrappers,
 * and the public login/signup flows. They do not require a live backend.
 * * What we're verifying:
 * - Tokens can be saved, retrieved, and cleared from localStorage.
 * - Authenticated wrappers (e.g., getWithAuth) throw if no user is signed in.
 * - Authenticated wrappers correctly inject the "Bearer <token>" header.
 * - The login function correctly parses a successful AuthResponse.
 * - The login function correctly throws parsed error details on a 401 or 500.
 * * Run with: npx vitest run src/lib/auth.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import {
  saveAuthToken,
  getAuthToken,
  clearAuthToken,
  getWithAuth,
  login,
} from "./auth";

//  Setup & Teardown

const AUTH_TOKEN_KEY = "relocateiq.authToken";

// Mock the global fetch API to intercept network requests
global.fetch = vi.fn();

beforeEach(() => {
  // Clear local storage before every test to ensure isolation
  window.localStorage.clear();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// Helper to cast the mocked fetch for TypeScript
const mockedFetch = global.fetch as Mock;

// Token Management Tests

describe("Token Management", () => {
  it("saves a token to localStorage", () => {
    const fakeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake";
    saveAuthToken(fakeToken);
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe(fakeToken);
  });

  it("retrieves a saved token from localStorage", () => {
    const fakeToken = "test-token-123";
    window.localStorage.setItem(AUTH_TOKEN_KEY, fakeToken);

    const retrieved = getAuthToken();
    expect(retrieved).toBe(fakeToken);
  });

  it("clears the token from localStorage", () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, "token-to-delete");
    clearAuthToken();
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });
});

//  Authenticated HTTP Wrapper Tests

describe("Authenticated Requests (getWithAuth)", () => {
  it("throws an error if no token is present", async () => {
    // Local storage is empty here
    await expect(getWithAuth("/api/v1/users/me")).rejects.toThrow(
      "No user is signed in. Missing authentication token.",
    );
    // Ensure fetch was never actually called
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("injects the Bearer token into headers when token exists", async () => {
    const fakeToken = "valid-session-token";
    saveAuthToken(fakeToken);

    // Mock a successful dummy response
    mockedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true })),
    );

    await getWithAuth("/api/v1/protected-route");

    // Verify fetch was called with the correct Authorization header
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const fetchArgs = mockedFetch.mock.calls[0];
    const requestOptions = fetchArgs[1];

    expect(requestOptions.headers.Authorization).toBe(`Bearer ${fakeToken}`);
    expect(requestOptions.headers["Content-Type"]).toBe("application/json");
  });
});

//  Authentication Flow Tests

describe("Login Flow", () => {
  const loginPayload = { email: "test@example.com", password: "password123" };

  it("returns the auth response on successful login", async () => {
    const mockAuthResponse = {
      access_token: "mocked-jwt-token",
      token_type: "bearer",
    };

    mockedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockAuthResponse), {
        status: 200,
        headers: { "Content-type": "application/json" },
      }),
    );

    const response = await login(loginPayload);

    expect(response).toEqual(mockAuthResponse);
    expect(mockedFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/login"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(loginPayload),
      }),
    );
  });

  it("throws a parsed backend error message on 401 Unauthorized", async () => {
    // Mock the exact error schema your FastAPI backend uses
    const backendError = { detail: "Incorrect email or password" };

    mockedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(backendError), {
        status: 401,
        headers: { "Content-type": "application/json" },
      }),
    );

    await expect(login(loginPayload)).rejects.toThrow(
      "Incorrect email or password",
    );
  });

  it("falls back to a default error message if the backend response is malformed", async () => {
    // Simulating a 500 error where the backend just dies and sends HTML instead of JSON
    mockedFetch.mockResolvedValueOnce(
      new Response("<html>Server Error</html>", {
        status: 500,
      }),
    );

    await expect(login(loginPayload)).rejects.toThrow("Unable to log in.");
  });
});
