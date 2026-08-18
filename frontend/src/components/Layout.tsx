import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useState } from 'react';
import {
  Phone,
  FileText,
  LayoutDashboard,
  Building2,
  AlertCircle,
  Map,
  TrendingUp,
  Headphones,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Shield
} from 'lucide-react';

const NAV_BY_ROLE: Record<string, { to: string; label: string; icon: React.ElementType; end?: boolean }[]> = {
  citizen: [
    { to: '/citizen/call', label: 'Make a Call', icon: Phone },
    { to: '/citizen/complaints', label: 'My Complaints', icon: FileText },
  ],
  operator: [
    { to: '/operator/queue', label: 'Call Queue', icon: Headphones },
  ],
  officer: [
    { to: '/officer/complaints', label: 'My Assignments', icon: ClipboardList },
  ],
  admin: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/departments', label: 'Departments', icon: Building2 },
    { to: '/admin/complaints', label: 'All Complaints', icon: AlertCircle },
    { to: '/admin/heatmap', label: 'Heat Map', icon: Map },
    { to: '/admin/trends', label: 'Trends', icon: TrendingUp },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  citizen: 'Citizen',
  operator: 'Operator',
  officer: 'Field Officer',
  admin: 'Administrator',
};

const ROLE_COLORS: Record<string, string> = {
  citizen: 'bg-teal-500',
  operator: 'bg-amber-500',
  officer: 'bg-blue-500',
  admin: 'bg-purple-600',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function useBreadcrumb() {
  const location = useLocation();
  const path = location.pathname;
  if (path.startsWith('/admin/complaints/')) return 'Complaint Details';
  if (path.startsWith('/admin/departments/')) return 'Department Details';
  if (path.startsWith('/officer/complaints/')) return 'Complaint Details';
  if (path === '/admin') return 'Overview';
  if (path === '/admin/departments') return 'Departments';
  if (path === '/admin/complaints') return 'All Complaints';
  if (path === '/admin/heatmap') return 'Heat Map';
  if (path === '/admin/trends') return 'Trends';
  if (path === '/citizen/call') return 'Make a Call';
  if (path === '/citizen/complaints') return 'My Complaints';
  if (path === '/operator/queue') return 'Live Call Queue';
  if (path === '/officer/complaints') return 'My Assignments';
  return 'Dashboard';
}

export function Layout() {
  const { user, logout } = useAuth();
  const links = user ? NAV_BY_ROLE[user.role] ?? [] : [];
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const breadcrumb = useBreadcrumb();

  const sidebarWidth = collapsed ? 68 : 240;

  return (
    <div className="page-wrapper" style={{ background: '#f1f5f9' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          style={{ animation: 'fadeIn 0.2s ease' }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        style={{ width: sidebarWidth }}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg">
            <Shield size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <div className="text-white font-bold text-sm leading-tight whitespace-nowrap">Complaint</div>
              <div className="text-indigo-300 text-xs font-medium whitespace-nowrap">Tracker Portal</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex ml-auto text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/10"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
          {!collapsed && (
            <div className="px-5 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                {user ? ROLE_LABELS[user.role] : 'Menu'}
              </span>
            </div>
          )}
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'active' : ''}`
              }
              title={collapsed ? link.label : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <link.icon size={20} className="sidebar-nav-icon flex-shrink-0" />
              {!collapsed && (
                <span className="animate-fade-in truncate">{link.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User profile at bottom */}
        {user && (
          <div className="border-t border-white/10 p-3">
            <div className={`flex items-center gap-3 px-2 py-2 rounded-xl ${!collapsed ? '' : 'justify-center'}`}>
              <div
                className={`avatar avatar-sm flex-shrink-0 text-white ${ROLE_COLORS[user.role] ?? 'bg-indigo-600'}`}
              >
                {getInitials(user.name)}
              </div>
              {!collapsed && (
                <div className="animate-fade-in overflow-hidden flex-1 min-w-0">
                  <div className="text-white text-xs font-semibold truncate">{user.name}</div>
                  <div className="text-white/40 text-[11px] truncate">{ROLE_LABELS[user.role]}</div>
                </div>
              )}
              {!collapsed && (
                <button
                  onClick={logout}
                  className="text-white/40 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"
                  title="Log out"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
            {collapsed && (
              <button
                onClick={logout}
                className="w-full flex items-center justify-center text-white/40 hover:text-red-400 transition-colors py-2 rounded-xl hover:bg-white/10 mt-1"
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main area */}
      <div
        className="main-content flex flex-col"
        style={{ marginLeft: sidebarWidth, transition: 'margin-left 0.28s cubic-bezier(0.4,0,0.2,1)' }}
      >
        {/* Top navbar */}
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden btn btn-icon btn-secondary p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Open menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-800">{breadcrumb}</h1>
              {user && (
                <p className="text-xs text-slate-400 hidden sm:block">
                  {ROLE_LABELS[user.role]} Portal
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <div
                  className={`avatar avatar-sm text-white ${ROLE_COLORS[user.role] ?? 'bg-indigo-600'}`}
                >
                  {getInitials(user.name)}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-700">{user.name}</div>
                  <div className="text-[11px] text-slate-400">{ROLE_LABELS[user.role]}</div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="page-container flex-1">
          <div className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
