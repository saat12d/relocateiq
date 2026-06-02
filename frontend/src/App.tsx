import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage.tsx";
import { LoginPage, SignupPage } from "./pages/AuthPages.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";

import Header from "./components/Header/Header.tsx";

function AppShell() {
  const location = useLocation();
  const showMarketingHeader = location.pathname !== "/dashboard";

  return (
    <>
      {showMarketingHeader && <Header />}
      <Routes>
        {/* Landing page for entering workplace address and radius */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </>
  );
}

/**
 * Main component responsible for routing.
 */
function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
