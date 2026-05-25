import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
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
      <div className="auth-panel-logo">
        <span className="site-logo__mark">+</span>
        <span>RelocateIQ</span>
      </div>
      <svg className="auth-route-art" viewBox="0 0 720 640" role="presentation">
        <circle className="auth-radius auth-radius--outer" cx="360" cy="310" r="230" />
        <circle className="auth-radius auth-radius--middle" cx="360" cy="310" r="166" />
        <circle className="auth-radius auth-radius--inner" cx="360" cy="310" r="96" />

        <path id="auth-route-green" className="auth-route auth-route--green" d="M360 310C392 246 454 174 540 112" />
        <path id="auth-route-amber" className="auth-route auth-route--amber" d="M360 310C300 274 228 220 146 146" />
        <path id="auth-route-blue" className="auth-route auth-route--blue" d="M360 310C426 338 492 402 566 492" />
        <path id="auth-route-red" className="auth-route auth-route--red" d="M360 310C316 382 276 464 234 548" />

        <g className="auth-zone auth-zone--green">
          <circle cx="540" cy="112" r="48" />
          <circle cx="540" cy="112" r="25" />
          <text x="540" y="118">1</text>
        </g>
        <g className="auth-zone auth-zone--amber">
          <circle cx="146" cy="146" r="42" />
          <circle cx="146" cy="146" r="23" />
          <text x="146" y="152">2</text>
        </g>
        <g className="auth-zone auth-zone--blue">
          <circle cx="566" cy="492" r="46" />
          <circle cx="566" cy="492" r="24" />
          <text x="566" y="498">3</text>
        </g>
        <g className="auth-zone auth-zone--red">
          <circle cx="234" cy="548" r="50" />
          <circle cx="234" cy="548" r="26" />
          <text x="234" y="554">4</text>
        </g>

        <circle className="auth-stop auth-stop--green" cx="430" cy="210" r="8" />
        <circle className="auth-stop auth-stop--amber" cx="261" cy="242" r="8" />
        <circle className="auth-stop auth-stop--blue" cx="460" cy="378" r="8" />
        <circle className="auth-stop auth-stop--red" cx="296" cy="424" r="8" />

        <circle className="auth-traveler auth-traveler--green" r="8">
          <animateMotion dur="3.2s" repeatCount="indefinite" begin="0s">
            <mpath href="#auth-route-green" />
          </animateMotion>
        </circle>
        <circle className="auth-traveler auth-traveler--amber" r="8">
          <animateMotion dur="2.7s" repeatCount="indefinite" begin=".55s">
            <mpath href="#auth-route-amber" />
          </animateMotion>
        </circle>
        <circle className="auth-traveler auth-traveler--blue" r="8">
          <animateMotion dur="3.6s" repeatCount="indefinite" begin=".2s">
            <mpath href="#auth-route-blue" />
          </animateMotion>
        </circle>
        <circle className="auth-traveler auth-traveler--red" r="8">
          <animateMotion dur="3s" repeatCount="indefinite" begin=".9s">
            <mpath href="#auth-route-red" />
          </animateMotion>
        </circle>

        <circle className="auth-office" cx="360" cy="310" r="24" />
        <path className="auth-office-icon" d="M350 319v-17l10-7l10 7v17h-7v-9h-6v9z" />
      </svg>
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
