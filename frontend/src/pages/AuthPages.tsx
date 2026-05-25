import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import mapPreview from "../assets/home-map.png";
import { login, saveAuthToken, signup } from "../lib/auth";

type AuthMode = "login" | "signup";
type AuthState = "idle" | "submitting" | "success" | "error";

function Logo() {
  return (
    <Link className="site-logo" to="/" aria-label="RelocateIQ home">
      <span className="site-logo__mark">+</span>
      <span>RelocateIQ</span>
    </Link>
  );
}

function AuthMapPanel({ mode }: { mode: AuthMode }) {
  return (
    <section className="auth-map-panel" aria-hidden="true">
      <img src={mapPreview} alt="" />
      <div className="auth-map-panel__overlay" />
      <div className="auth-note">
        {mode === "login" ? (
          <>
            <h2>Welcome back.</h2>
            <p>Continue comparing saved searches, ranked areas, and commute-friendly listings.</p>
          </>
        ) : (
          <>
            <h2>Your search starts with one address.</h2>
            <p>Create an account to save neighborhoods and return to your commute plan later.</p>
          </>
        )}
      </div>
    </section>
  );
}

function AuthPage({ mode }: { mode: AuthMode }) {
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
      setStatus("success");
      setMessage("Signed in successfully. Dashboard routing will connect in the next frontend slice.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to complete request.");
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <AuthMapPanel mode={mode} />
        <section className="auth-form-panel" aria-labelledby={`${mode}-title`}>
          <Logo />
          <div className="auth-intro">
            <p className="eyebrow">{isSignup ? "Create account" : "Account access"}</p>
            <h1 id={`${mode}-title`}>{isSignup ? "Create your RelocateIQ account" : "Log in to RelocateIQ"}</h1>
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
                <input id="name" name="name" type="text" autoComplete="name" placeholder="Jane Doe" required />
              </>
            )}

            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />

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

            {message && <p className={`auth-message auth-message--${status}`}>{message}</p>}

            <button className="button button--dark auth-submit" type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "Submitting..." : isSignup ? "Create account" : "Log in"}
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "New to RelocateIQ?"}{" "}
            <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create an account"}</Link>
          </p>
        </section>
      </section>
    </main>
  );
}

export function LoginPage() {
  return <AuthPage mode="login" />;
}

export function SignupPage() {
  return <AuthPage mode="signup" />;
}
