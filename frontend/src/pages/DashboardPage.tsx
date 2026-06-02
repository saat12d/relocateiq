import React, { useState } from "react";
import Topbar from "../components/Dashboard/Topbar";
import ResultsPanel from "../components/Dashboard/ResultsPanel";
import DashboardMap from "../components/Dashboard/DashboardMap";
import DetailPanel from "../components/Dashboard/DetailPanel";
import { neighborhoods } from "../components/Dashboard/data";
import "../components/Dashboard/Dashboard.css";

export default function DashboardPage() {
  const [selectedId, setSelectedId] = useState(neighborhoods[0].id);
  const selected =
    neighborhoods.find((item) => item.id === selectedId) ?? neighborhoods[0];

  return (
    <main className="dashboard-page">
      <Topbar />
      <div className="dashboard-workspace">
        <ResultsPanel selectedId={selected.id} onSelect={setSelectedId} />
        <DashboardMap selected={selected} onSelect={setSelectedId} />
        <DetailPanel selected={selected} />
      </div>
    </main>
  );
}
