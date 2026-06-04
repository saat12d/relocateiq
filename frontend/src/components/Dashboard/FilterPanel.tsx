import React, { useEffect, useState } from "react";
import type { PreferenceProfile } from "../../models/types";

type FilterPanelProps = {
  prefersTransit: boolean;
  avoidHighways: boolean;
  maxCommuteMinutes: number;
  matchingCount: number;
  totalCount: number;
  isApplying: boolean;
  onChange: (patch: Partial<PreferenceProfile>) => void;
};

export default function FilterPanel({
  prefersTransit,
  avoidHighways,
  maxCommuteMinutes,
  matchingCount,
  totalCount,
  isApplying,
  onChange,
}: FilterPanelProps) {
  // Track the slider locally so the label moves while dragging; only send the
  // update (which re-ranks) when the user releases, like the departure slider.
  const [draftMinutes, setDraftMinutes] = useState(maxCommuteMinutes);

  // Re-sync when the value changes from elsewhere (restore, AI refine).
  useEffect(() => {
    setDraftMinutes(maxCommuteMinutes);
  }, [maxCommuteMinutes]);

  function commitMinutes() {
    if (draftMinutes !== maxCommuteMinutes) {
      onChange({ maxCommuteMinutes: draftMinutes });
    }
  }

  return (
    <section className="filter-panel" aria-label="Commute filters">
      <div className="filter-panel__head">
        <h2>Filters</h2>
        <span>
          {matchingCount}/{totalCount} match
        </span>
      </div>

      <label className="filter-toggle">
        <span className="filter-toggle__text">
          <strong>Transit only</strong>
          <small>Rank by public transit time</small>
        </span>
        <input
          type="checkbox"
          checked={prefersTransit}
          disabled={isApplying}
          onChange={(event) => onChange({ prefersTransit: event.target.checked })}
        />
        <i className="filter-switch" aria-hidden="true" />
      </label>

      <label className="filter-toggle">
        <span className="filter-toggle__text">
          <strong>Avoid highways</strong>
          <small>Use no-highway drive times</small>
        </span>
        <input
          type="checkbox"
          checked={avoidHighways}
          disabled={isApplying}
          onChange={(event) => onChange({ avoidHighways: event.target.checked })}
        />
        <i className="filter-switch" aria-hidden="true" />
      </label>

      <div className="filter-slider">
        <div className="filter-slider__label">
          <strong>Max commute</strong>
          <span>{draftMinutes} min</span>
        </div>
        <input
          type="range"
          min={5}
          max={120}
          step={5}
          value={draftMinutes}
          disabled={isApplying}
          onChange={(event) => setDraftMinutes(Number(event.target.value))}
          onMouseUp={commitMinutes}
          onTouchEnd={commitMinutes}
          onKeyUp={commitMinutes}
          aria-label="Maximum commute time in minutes"
        />
        <div className="filter-slider__scale">
          <span>5</span>
          <span>120</span>
        </div>
      </div>
    </section>
  );
}
