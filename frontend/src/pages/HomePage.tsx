// import React from "react";
import { Link } from "react-router-dom";
import MapHeroBackground from "../components/MapHeroBackground";
// import Header from "../components/Header/Header";
import SearchPanel from "../components/Home/SearchPanel";
import RankingPanel from "../components/Home/RankingPanel";
import FeatureBar from "../components/Home/FeatureBar";
// import "../components/Auth/Auth.css";

// [GenAI Use] Prompt: "Role: product-minded frontend engineer. 
// Context: RelocateIQ needs homepage content that explains commute-first relocation without becoming a generic marketing page. 
// Task: draft concise homepage sections explaining the problem, RelocateIQ's value, and the three-step workflow.
//  Criteria: match the design doc, keep copy focused on workplace search, ranked neighborhoods,
//  AI refinement, and listings."
// [GenAI Use] LLM Response Start
const howItWorksSteps = [
  {
    n: 1,
    icon: "◉",
    title: "Enter your workplace",
    body: "Type your office address and set how far you're willing to commute. That's the only input we need to get started.",
  },
  {
    n: 2,
    icon: "≡",
    title: "Get ranked neighborhoods",
    body: "We score up to 20 nearby neighborhoods on commute time, transit, traffic, and lifestyle fit, then rank and plot them on the map.",
  },
  {
    n: 3,
    icon: "⌂",
    title: "Explore real listings",
    body: "Open any zone to see real housing listings, each with its own commute time to your workplace. Refine with filters or plain-English preferences anytime.",
  },
];

export default function HomePage() {
  return (
    <main className="home-page">
      <div className="home-shell">
        <section className="hero-section" id="preview">
          <MapHeroBackground />
          <div className="hero-map__overlay" />
          <SearchPanel />
          <RankingPanel />
        </section>
        <FeatureBar />
      </div>

      {/* Section 4: Why RelocateIQ */}
      <section className="why-section">
        <div className="section-center">
          <h2 className="section-heading">
            Stop juggling five tabs to pick where to live
          </h2>
          <p className="section-intro">
            Choosing a neighborhood for a new job usually means bouncing between
            Google Maps for commute times, Zillow for listings, and Reddit threads
            for the "vibe", with no good way to compare it all in one place.
            RelocateIQ brings commute scoring, lifestyle fit, and real listings
            into a single commute-first workflow, so you can see the full picture
            before you ever open a listing.
          </p>
          <div className="why-cols">
            <div className="why-col why-col--before">
              <p className="why-col__label">Without RelocateIQ</p>
              <ul className="why-list">
                <li>Check commute times one address at a time in Maps</li>
                <li>Hunt for listings separately, with no commute context</li>
                <li>Guess at neighborhood lifestyle from scattered sources</li>
                <li>No way to compare options side by side</li>
              </ul>
            </div>
            <div className="why-col why-col--after">
              <p className="why-col__label">With RelocateIQ</p>
              <ul className="why-list">
                <li>Enter your workplace once and get up to 20 ranked neighborhoods</li>
                <li>
                  Every zone scored on commute and lifestyle fit
                </li>
                <li>Real listings surfaced inside the best-matched zones</li>
                <li>Refine with simple filters or natural language</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: How It Works */}
      <section className="how-section" id="how-it-works">
        <div className="section-center">
          <p className="eyebrow">Simple and fast</p>
          <h2 className="section-heading">How RelocateIQ works</h2>
          <div className="how-steps">
            {howItWorksSteps.map((step) => (
              <div className="how-step" key={step.n}>
                <div className="how-step__top">
                  <span className="how-step__badge" aria-hidden="true">
                    {step.n}
                  </span>
                  <span className="how-step__icon" aria-hidden="true">
                    {step.icon}
                  </span>
                </div>
                <h3 className="how-step__title">{step.title}</h3>
                <p className="how-step__body">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* [GenAI Use] LLM Response End */}

      {/* Section 8: Footer */}
      <footer className="site-footer">
        <div className="section-center footer-inner">
          <div className="footer-brand">
            <Link
              className="site-logo footer-logo"
              to="/"
              aria-label="RelocateIQ home"
            >
              <span className="site-logo__mark">+</span>
              <span>RelocateIQ</span>
            </Link>
            <p className="footer-tagline">Smarter relocation by commute.</p>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <a href="#start">Start search</a>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
            <a
              href="https://github.com/saat12d/relocateiq"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </nav>
          <div className="footer-meta">
            <p className="footer-credits">Built for UCLA CS 130.</p>
            <p className="footer-copy">© 2026 RelocateIQ</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
// [GenAI Use] Reflection: We revised the generated layout to fit the current app, 
// kept the first viewport focused on the product search/map, 
// and avoided adding (or removed) inactive homepage controls.
