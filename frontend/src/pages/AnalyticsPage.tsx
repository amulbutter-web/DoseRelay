import React, { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, Info } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import StatsCard from '../components/common/StatsCard';
import { analyticsApi } from '../api/analytics';
import { Package, ArrowLeftRight, TrendingUp, DollarSign } from 'lucide-react';
import type { AnalyticsData } from '../types';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.getReports().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>;
  if (!data) return <div className="text-red-500 p-4">Failed to load analytics.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-semibold text-slate-800">Analytics & Reports</h2>
          <p className="text-sm text-slate-500">Network-wide performance metrics</p></div>
        <Button icon={<Download className="h-4 w-4" />} variant="secondary" onClick={() => analyticsApi.exportCsv()}>Export CSV</Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex gap-2">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        Values marked * are estimates for demonstration purposes and may not reflect actual financial figures.
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard label="Completed Transfers" value={data.total_completed_transfers} icon={<ArrowLeftRight className="h-5 w-5" />} color="text-blue-600" bgColor="bg-blue-50" />
        <StatsCard label="Units Redistributed" value={data.total_quantity_redistributed.toLocaleString()} icon={<Package className="h-5 w-5" />} color="text-emerald-600" bgColor="bg-emerald-50" />
        <StatsCard label="Shortages Addressed" value={data.shortages_addressed} icon={<TrendingUp className="h-5 w-5" />} color="text-violet-600" bgColor="bg-violet-50" />
        <StatsCard label="Value Preserved *" value={`₹${data.estimated_value_preserved.toLocaleString('en-IN', {maximumFractionDigits:0})}`} icon={<DollarSign className="h-5 w-5" />} color="text-teal-600" bgColor="bg-teal-50" subtitle="Estimate based on batch prices" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfer trends */}
        <Card title="Daily Transfer Activity" subtitle="Last 30 days">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.transfer_trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name="Transfers" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Category distribution */}
        <Card title="Transfers by Medicine Category">
          {data.category_distribution.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Complete transfers to see category distribution</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.category_distribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="label">
                  {data.category_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Hospital activity */}
        <Card title="Hospital Activity" subtitle="Transfers sent vs received" className="lg:col-span-2">
          {data.hospital_activity.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No completed transfers yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.hospital_activity} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hospital" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sent" fill="#3b82f6" radius={[4,4,0,0]} name="Sent" />
                <Bar dataKey="received" fill="#10b981" radius={[4,4,0,0]} name="Received" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
