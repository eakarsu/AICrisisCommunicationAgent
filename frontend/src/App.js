import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import FeaturePage from './pages/FeaturePage';
import {
  crisisIncidentsConfig,
  mediaMonitoringConfig,
  stakeholdersConfig,
  responseTemplatesConfig,
  pressReleasesConfig,
  socialMediaConfig,
  sentimentAnalysisConfig,
  crisisSimulationsConfig,
  communicationLogsConfig,
  teamMembersConfig,
  incidentTimelinesConfig,
  riskAssessmentsConfig,
  talkingPointsConfig,
  postCrisisAnalysisConfig,
} from './configs/featureConfigs';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (stored && token) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const handleLogin = (u) => setUser(u);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div className="app-container">
        <Sidebar onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/crisis-incidents" element={<FeaturePage config={crisisIncidentsConfig} />} />
            <Route path="/media-monitoring" element={<FeaturePage config={mediaMonitoringConfig} />} />
            <Route path="/stakeholders" element={<FeaturePage config={stakeholdersConfig} />} />
            <Route path="/response-templates" element={<FeaturePage config={responseTemplatesConfig} />} />
            <Route path="/press-releases" element={<FeaturePage config={pressReleasesConfig} />} />
            <Route path="/social-media" element={<FeaturePage config={socialMediaConfig} />} />
            <Route path="/sentiment-analysis" element={<FeaturePage config={sentimentAnalysisConfig} />} />
            <Route path="/crisis-simulations" element={<FeaturePage config={crisisSimulationsConfig} />} />
            <Route path="/communication-logs" element={<FeaturePage config={communicationLogsConfig} />} />
            <Route path="/team-members" element={<FeaturePage config={teamMembersConfig} />} />
            <Route path="/incident-timelines" element={<FeaturePage config={incidentTimelinesConfig} />} />
            <Route path="/risk-assessments" element={<FeaturePage config={riskAssessmentsConfig} />} />
            <Route path="/talking-points" element={<FeaturePage config={talkingPointsConfig} />} />
            <Route path="/post-crisis-analysis" element={<FeaturePage config={postCrisisAnalysisConfig} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
