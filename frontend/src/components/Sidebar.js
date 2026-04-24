import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  Radio,
  Users,
  FileText,
  Newspaper,
  Share2,
  BarChart3,
  Shield,
  MessageSquare,
  UserCog,
  Clock,
  AlertOctagon,
  Mic,
  TrendingUp,
  LogOut,
  Zap,
} from 'lucide-react';

const navItems = [
  { section: 'Overview' },
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'Crisis Management' },
  { path: '/crisis-incidents', label: 'Crisis Incidents', icon: AlertTriangle },
  { path: '/media-monitoring', label: 'Media Monitoring', icon: Radio },
  { path: '/stakeholders', label: 'Stakeholders', icon: Users },
  { path: '/response-templates', label: 'Response Templates', icon: FileText },
  { path: '/crisis-simulations', label: 'Crisis Simulations', icon: Shield },
  { path: '/communication-logs', label: 'Communication Log', icon: MessageSquare },
  { path: '/team-members', label: 'Team Management', icon: UserCog },
  { path: '/incident-timelines', label: 'Incident Timeline', icon: Clock },
  { section: 'AI-Powered' },
  { path: '/press-releases', label: 'Press Releases', icon: Newspaper, ai: true },
  { path: '/social-media', label: 'Social Media', icon: Share2, ai: true },
  { path: '/sentiment-analysis', label: 'Sentiment Analysis', icon: BarChart3, ai: true },
  { path: '/risk-assessments', label: 'Risk Assessment', icon: AlertOctagon, ai: true },
  { path: '/talking-points', label: 'Talking Points', icon: Mic, ai: true },
  { path: '/post-crisis-analysis', label: 'Post-Crisis Analysis', icon: TrendingUp, ai: true },
];

export default function Sidebar({ onLogout }) {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Zap size={20} />
        </div>
        <div>
          <div className="sidebar-title">CrisisComm AI</div>
          <div className="sidebar-subtitle">Command Center</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, idx) => {
          if (item.section) {
            return (
              <div key={idx} className="sidebar-section-label">
                {item.section}
              </div>
            );
          }
          const Icon = item.icon;
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="sidebar-item-icon" size={18} />
              <span>{item.label}</span>
              {item.ai && <span className="sidebar-ai-badge">AI</span>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {(user.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.name || 'User'}</div>
            <div className="sidebar-user-role">{user.role || 'Admin'}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={onLogout}>
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
