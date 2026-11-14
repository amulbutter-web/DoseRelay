import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Pill, Package, AlertTriangle,
  TrendingUp, ArrowLeftRight, CheckCircle, Truck, BarChart3,
  Settings, ChevronLeft, ChevronRight, Activity, Zap,
  ClipboardList, LogOut, User
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { clsx } from 'clsx';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Hospitals', to: '/hospitals', icon: <Building2 className="h-4 w-4" />, roles: ['network_admin', 'hospital_admin', 'mto'] },
  { label: 'Medicines', to: '/medicines', icon: <Pill className="h-4 w-4" />, roles: ['network_admin', 'hospital_admin', 'pharmacist'] },
  { label: 'Batches', to: '/batches', icon: <Package className="h-4 w-4" /> },
  { label: 'Expiry Management', to: '/expiry', icon: <AlertTriangle className="h-4 w-4" />, roles: ['network_admin', 'hospital_admin', 'pharmacist'] },
  { label: 'Demand Forecast', to: '/forecast', icon: <TrendingUp className="h-4 w-4" />, roles: ['network_admin', 'hospital_admin', 'mto'] },
  { label: 'Surplus & Shortages', to: '/surplus-shortages', icon: <Activity className="h-4 w-4" /> },
  { label: 'Recommendations', to: '/recommendations', icon: <Zap className="h-4 w-4" />, roles: ['network_admin', 'mto'] },
  { label: 'Transfers', to: '/transfers', icon: <ArrowLeftRight className="h-4 w-4" /> },
  { label: 'MTO Dashboard', to: '/mto', icon: <ClipboardList className="h-4 w-4" />, roles: ['mto', 'network_admin'] },
  { label: 'Pharmacist Approvals', to: '/approvals', icon: <CheckCircle className="h-4 w-4" />, roles: ['pharmacist', 'network_admin'] },
  { label: 'Logistics', to: '/logistics', icon: <Truck className="h-4 w-4" />, roles: ['logistics', 'mto', 'network_admin'] },
  { label: 'Analytics', to: '/analytics', icon: <BarChart3 className="h-4 w-4" />, roles: ['network_admin', 'hospital_admin'] },
  { label: 'Settings', to: '/settings', icon: <Settings className="h-4 w-4" /> },
];

export default function Sidebar() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.some(r => r === user?.role)
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={clsx(
      'flex flex-col bg-[#1e3a5f] transition-all duration-200 shrink-0 h-full',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Pill className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-sm">DoseRelay</span>
              <p className="text-blue-200 text-[10px]">Medicine Platform</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center mx-auto">
            <Pill className="h-4 w-4 text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg hover:bg-white/10 text-blue-200 ml-auto"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-500/30 text-white border border-blue-400/30'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white',
                collapsed && 'justify-center'
              )
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-2 py-3 border-t border-white/10">
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-blue-400 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{user.full_name}</p>
              <p className="text-blue-200 text-[10px] truncate capitalize">{user.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Logout"
          className={clsx(
            'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-blue-200 hover:bg-white/10 hover:text-white transition-colors',
            collapsed && 'justify-center'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
}
