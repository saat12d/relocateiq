/**
 * @fileoverview Authentication and API request library for RelocateIQ.
 * Manages JWT session tokens and provides authenticated HTTP wrappers
 * to automatically inject authorization headers into requests.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const AUTH_TOKEN_KEY = "relocateiq.authToken";

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupPayload = LoginPayload & {
  name: string;
};

// Token Management

/**
 * Saves the authentication token to local storage.
 * @param {string} token - The JWT access token provided by the backend.
 */
export function saveAuthToken(token: string): void {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Retrieves the stored authentication token from local storage.
 * @returns {string | null} The access token, or null if no token is found.
 */
export function getAuthToken(): string | null {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Removes the authentication token, effectively logging the user out locally.
 */
export function clearAuthToken(): void {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Internal helper to retrieve the token or reject the promise if missing.
 * Keeps our authenticated fetch wrappers clean.
 */
function requireAuthToken(): string {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No user is signed in. Missing authentication token.");
  }
  return token;
}

/**
 * Helper utility to safely parse error messages from failed API responses.
 * @param {Response} response - The failed fetch Response object.
 * @param {string} fallback - A default error message.
 * @returns {Promise<string>} The parsed error message or the fallback string.
 */
async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    return typeof body.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

//  Authenticated HTTP Wrappers

/**
 * Makes an authenticated GET request.
 * @param {string} path - The relative API endpoint path (e.g., "/api/v1/users/me").
 * @returns {Promise<Response>} The raw fetch Response.
 */
export async function getWithAuth(path: string): Promise<Response> {
  const token = requireAuthToken();

  return fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Makes an authenticated POST request.
 * Automatically handles JSON serialization or FormData multipart boundaries.
 * @param {string} path - The relative API endpoint path.
 * @param {FormData | object} [data] - The payload to send.
 * @returns {Promise<Response>} The raw fetch Response.
 */
export async function postWithAuth(
  path: string,
  data?: FormData | object,
): Promise<Response> {
  const token = requireAuthToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const options: RequestInit = {
    method: "POST",
    headers,
  };

  if (data instanceof FormData) {
    options.body = data;
    // Note: Do NOT set Content-Type for FormData. The browser sets it automatically
    // to multipart/form-data with the correct boundary parameter.
  } else if (data && typeof data === "object") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }

  return fetch(`${API_BASE_URL}${path}`, options);
}

/**
 * Makes an authenticated PUT request.
 * @param {string} path - The relative API endpoint path.
 * @param {FormData | object} [data] - The payload to send.
 * @returns {Promise<Response>} The raw fetch Response.
 */
export async function putWithAuth(
  path: string,
  data?: FormData | object,
): Promise<Response> {
  const token = requireAuthToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const options: RequestInit = {
    method: "PUT",
    headers,
  };

  if (data instanceof FormData) {
    options.body = data;
  } else if (data && typeof data === "object") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }

  return fetch(`${API_BASE_URL}${path}`, options);
}

/**
 * Makes an authenticated PATCH request.
 * @param {string} path - The relative API endpoint path.
 * @param {object} [data] - The JSON payload to send.
 * @returns {Promise<Response>} The raw fetch Response.
 */
export async function patchWithAuth(
  path: string,
  data?: object,
): Promise<Response> {
  const token = requireAuthToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method: "PATCH",
    headers,
  };

  if (data !== undefined) {
    options.body = JSON.stringify(data);
  }

  return fetch(`${API_BASE_URL}${path}`, options);
}

/**
 * Makes an authenticated DELETE request.
 * @param {string} path - The relative API endpoint path.
 * @returns {Promise<Response>} The raw fetch Response.
 */
export async function deleteWithAuth(path: string): Promise<Response> {
  const token = requireAuthToken();

  return fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

//  Public Authentication Flows

/**
 * Authenticates an existing user and retrieves a JWT.
 * @param {LoginPayload} payload - The user's email and password.
 * @returns {Promise<AuthResponse>} The authentication tokens.
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const fallback =
      response.status === 401
        ? "Invalid email or password."
        : "Unable to log in.";
    throw new Error(await readError(response, fallback));
  }

  return response.json();
}

/**
 * Registers a new user account.
 * @param {SignupPayload} payload - The user's name, email, and password.
 * @returns {Promise<AuthResponse>} The authentication tokens for immediate login.
 */
export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Unable to create account."));
  }

  return response.json();
}
