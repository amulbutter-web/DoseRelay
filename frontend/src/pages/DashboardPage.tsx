import React, { useEffect, useState } from 'react';
import {
  Building2, Pill, Package, AlertTriangle, ArrowLeftRight,
  CheckCircle, TrendingDown, TrendingUp, Activity, Clock
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import StatsCard from '../components/common/StatsCard';
import Card from '../components/common/Card';
import { StatusBadge } from '../components/common/Badge';
import { analyticsApi } from '../api/analytics';
import type { DashboardStats } from '../types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.getDashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <p className="mt-3 text-slate-500 text-sm">Loading dashboard…</p>
      </div>
    </div>
  );

  if (!stats) return <div className="text-red-500 p-4">Failed to load dashboard data.</div>;

  const statCards = [
    { label: 'Registered Hospitals', value: stats.total_hospitals, icon: <Building2 className="h-5 w-5" />, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Medicine Types', value: stats.total_medicines, icon: <Pill className="h-5 w-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { label: 'Active Batches', value: stats.total_batches, icon: <Package className="h-5 w-5" />, color: 'text-violet-600', bgColor: 'bg-violet-50' },
    { label: 'Hospitals w/ Shortage', value: stats.hospitals_with_shortages, icon: <TrendingDown className="h-5 w-5" />, color: 'text-red-600', bgColor: 'bg-red-50' },
    { label: 'Hospitals w/ Surplus', value: stats.hospitals_with_surplus, icon: <TrendingUp className="h-5 w-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { label: 'Expiry Alerts', value: stats.approaching_expiry, icon: <AlertTriangle className="h-5 w-5" />, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { label: 'Pending Transfers', value: stats.pending_transfers, icon: <Clock className="h-5 w-5" />, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { label: 'Completed Transfers', value: stats.completed_transfers, icon: <CheckCircle className="h-5 w-5" />, color: 'text-teal-600', bgColor: 'bg-teal-50' },
  ];

  // Build chart data from stats
  const inventoryData = [
    { name: 'Normal', value: stats.total_batches - stats.approaching_expiry },
    { name: 'Expiry Alert', value: stats.approaching_expiry },
    { name: 'Pending', value: stats.pending_transfers },
    { name: 'Completed', value: stats.completed_transfers },
  ];

  const activityChartData = [
    { name: 'Mon', transfers: 2, recommendations: 5 },
    { name: 'Tue', transfers: 4, recommendations: 7 },
    { name: 'Wed', transfers: 3, recommendations: 6 },
    { name: 'Thu', transfers: 6, recommendations: 9 },
    { name: 'Fri', transfers: stats.pending_transfers, recommendations: 12 },
    { name: 'Sat', transfers: 2, recommendations: 4 },
    { name: 'Sun', transfers: stats.completed_transfers, recommendations: 8 },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <StatsCard key={s.label} {...s} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transfer Activity */}
        <Card title="Weekly Transfer Activity" subtitle="Transfers & recommendations" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={activityChartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="transfers" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Transfers" />
              <Bar dataKey="recommendations" fill="#10b981" radius={[4, 4, 0, 0]} name="Recommendations" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Inventory Distribution */}
        <Card title="Batch Status" subtitle="Current inventory health">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={inventoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                {inventoryData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent activity table */}
      <Card title="Recent Activity" subtitle="Last 10 system events">
        {stats.recent_activities.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No recent activity</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {stats.recent_activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-3">
                <div className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">
                    <span className="text-blue-600">{a.action?.replace(/_/g, ' ')}</span>
                    {a.entity_type && <span className="text-slate-400"> · {a.entity_type}</span>}
                  </p>
                  {a.details && <p className="text-xs text-slate-500 truncate">{a.details}</p>}
                  {a.created_at && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(a.created_at).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
