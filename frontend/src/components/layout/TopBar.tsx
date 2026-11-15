import React, { useState, useEffect } from 'react';
import { Bell, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { notificationsApi } from '../../api/analytics';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/hospitals': 'Hospital Management',
  '/medicines': 'Medicine Catalogue',
  '/batches': 'Inventory Batches',
  '/expiry': 'Expiry Management',
  '/forecast': 'Demand Forecasting',
  '/surplus-shortages': 'Surplus & Shortages',
  '/recommendations': 'Transfer Recommendations',
  '/transfers': 'Transfer Management',
  '/mto': 'MTO Dashboard',
  '/approvals': 'Pharmacist Approvals',
  '/logistics': 'Logistics',
  '/analytics': 'Analytics & Reports',
  '/settings': 'Settings',
};

export default function TopBar() {
  const { user } = useAuth();
  const location = useLocation();
  const [notifications, setNotifications] = useState<{ id: number; title: string; is_read: boolean }[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const pageTitle = PAGE_TITLES[location.pathname] || 'DoseRelay';
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    notificationsApi.getAll().then(setNotifications).catch(() => {});
  }, []);

  return (
    <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">{pageTitle}</h1>
        <p className="text-xs text-slate-400">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Demo label */}
        <span className="hidden sm:inline-flex px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-lg">
          Demo Environment
        </span>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-100 z-50">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => { notificationsApi.markAllRead(); setNotifications(n => n.map(x => ({ ...x, is_read: true }))); }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No notifications</p>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <div key={n.id} className={`px-4 py-3 border-b border-slate-50 ${!n.is_read ? 'bg-blue-50/50' : ''}`}>
                      <p className="text-sm font-medium text-slate-700">{n.title}</p>
                      {!n.is_read && <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 ml-1" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-100">
          <div className="h-8 w-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-sm font-semibold">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-700 leading-tight">{user?.full_name}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
