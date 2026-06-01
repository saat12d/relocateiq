import React from "react";
import "./Home.css";

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

export default function FeatureBar() {
  return (
    <section
      className="feature-bar"
      id="how-it-works"
      aria-label="RelocateIQ features"
    >
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
