import React, { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, saveAuthToken, signup } from "../../lib/auth";
import "./Auth.css";

type AuthMode = "login" | "signup";
type AuthState = "idle" | "submitting" | "success" | "error";

function Logo() {
  return (
    <Link className="auth-site-logo" to="/" aria-label="RelocateIQ home">
      <span className="auth-site-logo__mark">+</span>
      <span>RelocateIQ</span>
    </Link>
  );
}

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthState>("idle");
  const [message, setMessage] = useState("");
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "");

    try {
      const response = isSignup
        ? await signup({ email, password, name })
        : await login({ email, password });

      saveAuthToken(response.access_token);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to complete request.",
      );
    }
  }

  return (
    <section className="auth-form-panel" aria-labelledby={`${mode}-title`}>
      <Logo />
      <div className="auth-intro">
        <p className="auth-eyebrow">
          {isSignup ? "Create account" : "Account access"}
        </p>
        <h1 id={`${mode}-title`}>
          {isSignup ? "Create your RelocateIQ account" : "Log in to RelocateIQ"}
        </h1>
        <p>
          {isSignup
            ? "Save searches, compare neighborhoods, and keep track of listings that fit your commute."
            : "Pick up where you left off with saved searches, favorite listings, and neighborhood rankings."}
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {isSignup && (
          <>
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              required
            />
          </>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />

        <div className="auth-label-row">
          <label htmlFor="password">Password</label>
          {!isSignup && <a href="#forgot">Forgot password?</a>}
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder="Enter your password"
          required
        />

        {message && (
          <p className={`auth-message auth-message--${status}`}>{message}</p>
        )}

        <button
          className="button button--dark auth-submit"
          type="submit"
          disabled={status === "submitting"}
        >
          {status === "submitting"
            ? "Submitting..."
            : isSignup
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      <p className="auth-switch">
        {isSignup ? "Already have an account?" : "New to RelocateIQ?"}{" "}
        <Link to={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </section>
  );
}
