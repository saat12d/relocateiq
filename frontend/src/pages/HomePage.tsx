import React from "react";
import MapHeroBackground from "../components/MapHeroBackground";
import Header from "../components/Header/Header";
import SearchPanel from "../components/Home/SearchPanel";
import RankingPanel from "../components/Home/RankingPanel";
import FeatureBar from "../components/Home/FeatureBar";
import "../components/Auth/Auth.css";

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
    </main>
  );
}
