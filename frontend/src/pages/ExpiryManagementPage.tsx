import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, XCircle, ShieldAlert, Package } from 'lucide-react';
import Card from '../components/common/Card';
import DataTable from '../components/common/DataTable';
import { StatusBadge } from '../components/common/Badge';
import { medicinesApi } from '../api/medicines';
import { inventoryApi } from '../api/inventory';
import type { MedicineBatch, ExpiryAlert } from '../types';

const TABS = ['approaching_expiry', 'critical', 'expired', 'quarantined', 'recalled', 'normal'] as const;
type Tab = typeof TABS[number];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  approaching_expiry: <Clock className="h-4 w-4" />,
  critical: <AlertTriangle className="h-4 w-4" />,
  expired: <XCircle className="h-4 w-4" />,
  quarantined: <ShieldAlert className="h-4 w-4" />,
  recalled: <ShieldAlert className="h-4 w-4" />,
  normal: <Package className="h-4 w-4" />,
};

const TAB_COLORS: Record<Tab, string> = {
  approaching_expiry: 'text-amber-600 border-amber-500',
  critical: 'text-red-600 border-red-500',
  expired: 'text-red-800 border-red-800',
  quarantined: 'text-purple-600 border-purple-500',
  recalled: 'text-orange-600 border-orange-500',
  normal: 'text-emerald-600 border-emerald-500',
};

export default function ExpiryManagementPage() {
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('approaching_expiry');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      medicinesApi.getExpirySummary(),
      inventoryApi.getExpiryAlerts(),
      medicinesApi.getBatches({}),
    ]).then(([s, a, b]) => { setSummary(s); setAlerts(a); setBatches(b); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const tabBatches = batches.filter(b => b.status === activeTab);

  const columns = [
    { key: 'batch_number', label: 'Batch #', render: (b: MedicineBatch) => <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{b.batch_number}</code> },
    { key: 'medicine_name', label: 'Medicine', render: (b: MedicineBatch) => <span className="font-medium text-sm">{b.medicine_name}</span> },
    { key: 'hospital_name', label: 'Hospital', render: (b: MedicineBatch) => <span className="text-sm">{b.hospital_name}</span> },
    { key: 'quantity', label: 'Units', render: (b: MedicineBatch) => <span className="font-semibold">{b.quantity}</span> },
    { key: 'expiry_date', label: 'Expiry Date', render: (b: MedicineBatch) => {
      const days = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000);
      return <div><p className="text-sm font-medium">{b.expiry_date}</p><p className={`text-xs ${days < 0 ? 'text-red-600 font-bold' : days < 30 ? 'text-amber-600' : 'text-emerald-600'}`}>{days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days} days remaining`}</p></div>;
    }},
    { key: 'status', label: 'Status', render: (b: MedicineBatch) => <StatusBadge status={b.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Expiry Management</h2>
        <p className="text-sm text-slate-500">Monitor and manage batch expiry status</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`bg-white rounded-xl border-2 p-4 text-left transition-all ${activeTab === tab ? TAB_COLORS[tab] + ' shadow-sm' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
            <div className="flex items-center gap-1.5 mb-1">{TAB_ICONS[tab]}<span className="text-xs font-semibold uppercase tracking-wide">{tab.replace(/_/g,' ')}</span></div>
            <p className="text-2xl font-bold">{summary[tab] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Urgent alerts */}
      {alerts.filter(a => a.days_remaining >= 0 && a.days_remaining <= 30).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4" />Critical Expiry Alerts</h3>
          <div className="space-y-1">
            {alerts.filter(a => a.days_remaining >= 0 && a.days_remaining <= 30).map(a => (
              <div key={a.batch_id} className="flex items-center justify-between text-sm bg-white/60 rounded-lg px-3 py-2">
                <span className="font-medium text-amber-900">{a.medicine_name} — {a.hospital_name}</span>
                <span className="text-amber-700 font-semibold">{a.days_remaining}d left · {a.quantity} units</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card title={`${activeTab.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())} Batches`} subtitle={`${tabBatches.length} batches`} noPadding>
        <DataTable columns={columns as any} data={tabBatches as any} loading={loading} searchable searchKeys={['batch_number','medicine_name','hospital_name']} emptyMessage={`No ${activeTab.replace(/_/g,' ')} batches found`} />
      </Card>
    </div>
  );
}
