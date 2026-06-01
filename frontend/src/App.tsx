import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage.tsx";
import { LoginPage, SignupPage } from "./pages/AuthPages.tsx";

import Header from "./components/Header/Header.tsx";

/**
 * Main component responsible for routing.
 */
function App() {
  return (
    <Router>
      <Header />
      <Routes>
        {/* Landing page for entering workplace address and radius */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    </Router>
  );
}

export default App;
