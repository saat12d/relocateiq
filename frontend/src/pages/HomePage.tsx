import MapHeroBackground from "../components/MapHeroBackground";

const neighborhoods = [
  { rank: 1, name: "Highland Park", drive: "18 min", transit: "24 min", tone: "green" },
  { rank: 2, name: "Culver City", drive: "26 min", transit: "31 min", tone: "amber" },
  { rank: 3, name: "Silver Lake", drive: "31 min", transit: "34 min", tone: "gold" },
  { rank: 4, name: "Inglewood", drive: "42 min", transit: "49 min", tone: "red" },
];

const features = [
  {
    label: "Rank",
    title: "Commute-first rankings",
    body: "Compare neighborhoods by peak drive time, transit access, and daily-life fit.",
  },
  {
    label: "Tune",
    title: "Preference controls",
    body: "Shape results around transit, highways, max commute time, and quieter areas.",
  },
  {
    label: "View",
    title: "Listing-ready zones",
    body: "Move from promising areas to apartments without losing commute context.",
  },
];

function Logo() {
  return (
    <a className="site-logo" href="/" aria-label="RelocateIQ home">
      <span className="site-logo__mark">+</span>
      <span>RelocateIQ</span>
    </a>
  );
}

function Header() {
  return (
    <header className="site-header">
      <Logo />
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#preview">Preview</a>
        <a href="#start">Start search</a>
      </nav>
      <div className="site-actions">
        <a className="button button--ghost" href="/login">
          Log in
        </a>
        <a className="button button--dark" href="/signup">
          Sign up
        </a>
      </div>
    </header>
  );
}

function SearchPanel() {
  return (
    <section className="hero-card" aria-labelledby="home-title" id="start">
      <p className="eyebrow">Smarter relocation by commute</p>
      <h1 id="home-title">Find the best place to live near your work.</h1>
      <p className="hero-copy">
        RelocateIQ ranks neighborhoods by commute, transit, walkability, and lifestyle fit
        before you open a single listing.
      </p>

      <form className="search-form" aria-label="Start a commute search">
        <label htmlFor="workplace">Workplace address</label>
        <div className="address-field">
          <span aria-hidden="true" className="address-field__icon">
            +
          </span>
          <input id="workplace" type="text" placeholder="800 Wilshire Blvd, Los Angeles" />
        </div>

        <div className="radius-row">
          <label htmlFor="radius">Search radius</label>
          <span>15 miles</span>
        </div>
        <input id="radius" className="radius-slider" type="range" min="1" max="50" defaultValue="15" />

        <div className="hero-actions">
          <button className="button button--dark" type="button">
            Start search
          </button>
          <a className="button button--light" href="#preview">
            View demo
          </a>
        </div>
      </form>
    </section>
  );
}

function RankingPanel() {
  return (
    <aside className="ranking-card" aria-label="Top ranked neighborhoods">
      <div className="ranking-card__header">
        <strong>Top neighborhoods</strong>
        <span>20 areas</span>
      </div>
      <div className="ranking-list">
        {neighborhoods.map((item) => (
          <article className="ranking-item" key={item.name}>
            <span className={`rank-badge rank-badge--${item.tone}`}>{item.rank}</span>
            <div>
              <strong>{item.name}</strong>
              <small>
                Drive {item.drive} / Transit {item.transit}
              </small>
            </div>
            <b className={`ranking-score ranking-score--${item.tone}`}>{item.drive}</b>
          </article>
        ))}
      </div>
    </aside>
  );
}

function FeatureBar() {
  return (
    <section className="feature-bar" id="how-it-works" aria-label="RelocateIQ features">
      {features.map((feature) => (
        <article className="feature-item" key={feature.title}>
          <span>{feature.label}</span>
          <div>
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function HomePage() {
  return (
    <main className="home-page">
      <div className="home-shell">
        <Header />
        <section className="hero-section" id="preview">
          <MapHeroBackground />
          <div className="hero-map__overlay" />
          <SearchPanel />
          <RankingPanel />
        </section>
        <FeatureBar />
      </div>
    </main>
  );
}

export default HomePage;
