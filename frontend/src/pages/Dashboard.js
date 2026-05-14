import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Shield,
  Users,
  Activity,
  Newspaper,
  Share2,
  BarChart3,
  Mic,
  AlertOctagon,
  TrendingUp,
  Plus,
  ArrowRight,
} from 'lucide-react';
import {
  getCrisisIncidents,
  getTeamMembers,
  getStakeholders,
  getPressReleases,
} from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    incidents: 0,
    activeIncidents: 0,
    teamMembers: 0,
    stakeholders: 0,
  });
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incidentsRes, teamRes, stakeholdersRes] = await Promise.allSettled([
          getCrisisIncidents(),
          getTeamMembers(),
          getStakeholders(),
        ]);

        // API may return either an array or { data: [], total, page, limit }
        const unwrap = (resp) => {
          const d = resp.status === 'fulfilled' ? resp.value.data : null;
          if (!d) return [];
          if (Array.isArray(d)) return d;
          if (Array.isArray(d.data)) return d.data;
          return [];
        };
        const incidents = unwrap(incidentsRes);
        const team = unwrap(teamRes);
        const stakeholders = unwrap(stakeholdersRes);

        const dataArr = incidents;
        const activeCount = dataArr.filter(
          (i) => i.status === 'active' || i.status === 'monitoring'
        ).length;

        setStats({
          incidents: dataArr.length,
          activeIncidents: activeCount,
          teamMembers: team.length,
          stakeholders: stakeholders.length,
        });

        setRecentIncidents(dataArr.slice(0, 5));
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className="feature-page">
      <div className="dashboard-header">
        <h1>Welcome back, {user.name || 'Admin'}</h1>
        <p>Here is an overview of your crisis communication operations.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Incidents</span>
            <div className="stat-card-icon">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-card-value">{loading ? '-' : stats.incidents}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Active Crises</span>
            <div className="stat-card-icon danger">
              <Activity size={18} />
            </div>
          </div>
          <div className="stat-card-value">{loading ? '-' : stats.activeIncidents}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Team Members</span>
            <div className="stat-card-icon success">
              <Users size={18} />
            </div>
          </div>
          <div className="stat-card-value">{loading ? '-' : stats.teamMembers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Stakeholders</span>
            <div className="stat-card-icon warning">
              <Shield size={18} />
            </div>
          </div>
          <div className="stat-card-value">{loading ? '-' : stats.stakeholders}</div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Incidents */}
        <div className="dashboard-card">
          <div className="dashboard-card-title">
            <AlertTriangle size={18} />
            Recent Incidents
          </div>
          {loading ? (
            <div className="loading-container" style={{ padding: '24px' }}>
              <div className="spinner spinner-large" />
            </div>
          ) : recentIncidents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              No incidents recorded yet.
            </p>
          ) : (
            <div>
              {recentIncidents.map((incident) => (
                <Link
                  key={incident.id}
                  to="/crisis-incidents"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '4px',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      {incident.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {incident.category || 'Uncategorized'}
                    </div>
                  </div>
                  <span className={`badge badge-${incident.severity || 'default'}`}>
                    {incident.severity || 'N/A'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="dashboard-card">
          <div className="dashboard-card-title">
            <Activity size={18} />
            Quick Actions
          </div>
          <div className="quick-actions">
            <Link to="/crisis-incidents" className="quick-action-btn">
              <Plus size={16} />
              New Incident
            </Link>
            <Link to="/press-releases" className="quick-action-btn">
              <Newspaper size={16} />
              AI Press Release
            </Link>
            <Link to="/social-media" className="quick-action-btn">
              <Share2 size={16} />
              AI Social Media
            </Link>
            <Link to="/sentiment-analysis" className="quick-action-btn">
              <BarChart3 size={16} />
              AI Sentiment
            </Link>
            <Link to="/risk-assessments" className="quick-action-btn">
              <AlertOctagon size={16} />
              AI Risk Assessment
            </Link>
            <Link to="/talking-points" className="quick-action-btn">
              <Mic size={16} />
              AI Talking Points
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
