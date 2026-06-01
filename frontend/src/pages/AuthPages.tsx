import React from "react";
import AuthMapPanel from "../components/Auth/AuthMapPanel";
import AuthForm from "../components/Auth/AuthForm";
import "../components/Auth/Auth.css";

type AuthMode = "login" | "signup";

function AuthPageTemplate({ mode }: { mode: AuthMode }) {
  return (
    <main className="auth-page">
      <section className="auth-shell">
        <AuthMapPanel mode={mode} />
        <AuthForm mode={mode} />
      </section>
    </main>
  );
}

export function LoginPage() {
  return <AuthPageTemplate mode="login" />;
}

export function SignupPage() {
  return <AuthPageTemplate mode="signup" />;
}
