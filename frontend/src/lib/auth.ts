const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const AUTH_TOKEN_KEY = "relocateiq.authToken";

type AuthResponse = {
  access_token: string;
  token_type: "bearer";
};

export type CurrentUser = {
  userId: string;
  email: string;
  name: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupPayload = LoginPayload & {
  name: string;
};

async function postAuth(path: string, payload: LoginPayload | SignupPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const fallback = response.status === 401 ? "Invalid email or password." : "Unable to complete request.";
    throw new Error(await readError(response, fallback));
  }

  return response.json();
}

async function readError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

export function saveAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export async function login(payload: LoginPayload) {
  return postAuth("/api/v1/auth/login", payload);
}

export async function signup(payload: SignupPayload) {
  return postAuth("/api/v1/auth/signup", payload);
}
