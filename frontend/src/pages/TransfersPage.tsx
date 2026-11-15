import MedicineRequests from '../components/MedicineRequests';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, ArrowRight } from 'lucide-react';
import Card from '../components/common/Card';
import DataTable from '../components/common/DataTable';
import { StatusBadge } from '../components/common/Badge';
import { Select } from '../components/common/Input';
import { transfersApi } from '../api/transfers';
import type { Transfer } from '../types';

const STATUS_OPTS = [
  '', 'recommended','awaiting_mto_review','donor_review','mto_requested_documents',
  'final_approved','ready_for_dispatch','dispatched','in_transit','delivered','received_awaiting_verification','completed','mto_rejected','cancelled'
].map(s => ({ value: s, label: s ? s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : 'All Statuses' }));

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    transfersApi.getAll(filterStatus ? { status: filterStatus } : {})
      .then(setTransfers).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterStatus]);

  const columns = [
    { key: 'id', label: 'ID', render: (t: Transfer) => <span className="font-mono text-xs text-slate-400">#{t.id}</span> },
    { key: 'medicine_name', label: 'Medicine', sortable: true, render: (t: Transfer) => <span className="font-medium text-sm">{t.medicine_name}</span> },
    { key: 'route', label: 'Route', render: (t: Transfer) => (
      <div className="flex items-center gap-1 text-xs text-slate-600">
        <span className="font-medium">{t.donor_hospital_name}</span>
        <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
        <span className="font-medium">{t.receiver_hospital_name}</span>
      </div>
    )},
    { key: 'quantity', label: 'Qty', render: (t: Transfer) => <span className="font-semibold">{t.quantity}</span> },
    { key: 'batch_number', label: 'Batch', render: (t: Transfer) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{t.batch_number}</code> },
    { key: 'status', label: 'Status', render: (t: Transfer) => <StatusBadge status={t.status} /> },
    { key: 'created_at', label: 'Created', sortable: true, render: (t: Transfer) => <span className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('en-IN')}</span> },
  ];

  const statusGroups = [
    { label: 'Active', statuses: ['awaiting_mto_review','donor_review','mto_requested_documents','final_approved','ready_for_dispatch','dispatched','in_transit','delivered','received_awaiting_verification'], color: 'bg-blue-50 text-blue-700' },
    { label: 'Completed', statuses: ['completed'], color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Rejected/Cancelled', statuses: ['mto_rejected','cancelled'], color: 'bg-red-50 text-red-700' },
  ];

  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold text-slate-800">Transfer Management</h2>
        <p className="text-sm text-slate-500">{transfers.length} transfers found</p></div>

      <MedicineRequests />
      <div className="grid grid-cols-3 gap-4">
        {statusGroups.map(g => (
          <div key={g.label} className={`rounded-xl p-4 ${g.color}`}>
            <p className="text-2xl font-bold">{transfers.filter(t => g.statuses.includes(t.status)).length}</p>
            <p className="text-sm font-medium">{g.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 items-center">
        <Select label="" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} options={STATUS_OPTS} className="w-56" />
        <button onClick={load} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"><Filter className="h-4 w-4" /></button>
      </div>

      <Card noPadding>
        <DataTable
          columns={columns as any} data={transfers as any} loading={loading}
          searchable searchKeys={['medicine_name','donor_hospital_name','receiver_hospital_name','batch_number','status']}
          onRowClick={(t: any) => navigate(`/transfers/${t.id}`)}
        />
      </Card>
    </div>
  );
}
