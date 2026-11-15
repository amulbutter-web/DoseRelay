import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, Mail, Bed, Package, AlertTriangle, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import Card from '../components/common/Card';
import { StatusBadge } from '../components/common/Badge';
import DataTable from '../components/common/DataTable';
import { hospitalsApi } from '../api/hospitals';
import { medicinesApi } from '../api/medicines';
import { inventoryApi } from '../api/inventory';
import type { Hospital, MedicineBatch, SurplusShortageItem } from '../types';

export default function HospitalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [surplus, setSurplus] = useState<SurplusShortageItem[]>([]);
  const [shortages, setShortages] = useState<SurplusShortageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const hospId = Number(id);
    Promise.all([
      hospitalsApi.getOne(hospId),
      medicinesApi.getBatches({ hospital_id: hospId }),
      inventoryApi.getSurplus({ hospital_id: hospId }),
      inventoryApi.getShortages({ hospital_id: hospId }),
    ])
      .then(([h, b, s, sh]) => {
        setHospital(h);
        setBatches(b);
        setSurplus(s);
        setShortages(sh);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!hospital) return <div className="text-red-500 p-4">Hospital not found.</div>;

  const expiryAlerts = batches.filter((b) => ['approaching_expiry', 'critical', 'expired'].includes(b.status));
  const normalBatches = batches.filter((b) => b.status === 'normal');
  const totalQty = batches.reduce((s, b) => s + b.quantity, 0);

  const batchColumns = [
    { key: 'medicine_name', label: 'Medicine', sortable: true, render: (b: MedicineBatch) => <span className="font-medium text-sm">{b.medicine_name}</span> },
    { key: 'batch_number', label: 'Batch #', render: (b: MedicineBatch) => <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{b.batch_number}</code> },
    { key: 'quantity', label: 'Qty', render: (b: MedicineBatch) => <span className="font-medium">{b.quantity}</span> },
    {
      key: 'expiry_date',
      label: 'Expiry',
      render: (b: MedicineBatch) => {
        const days = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000);
        return (
          <span className={`text-sm ${days < 0 ? 'text-red-600 font-semibold' : days < 30 ? 'text-amber-600 font-medium' : 'text-slate-600'}`}>
            {b.expiry_date} ({days}d)
          </span>
        );
      },
    },
    { key: 'status', label: 'Status', render: (b: MedicineBatch) => <StatusBadge status={b.status} /> },
  ];

  const surplusColumns = [
    { key: 'medicine_name', label: 'Medicine', sortable: true },
    { key: 'available_stock', label: 'Available Stock', render: (r: SurplusShortageItem) => <span className="font-semibold text-emerald-600">{r.available_stock}</span> },
    { key: 'forecast_demand', label: '30d Forecast', render: (r: SurplusShortageItem) => Math.round(r.forecast_demand) },
    { key: 'days_of_cover', label: 'Days Cover', render: (r: SurplusShortageItem) => <span>{r.days_of_cover === Infinity ? '∞' : r.days_of_cover}</span> },
    { key: 'surplus', label: 'Surplus Units', render: (r: SurplusShortageItem) => <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{r.surplus}</span> },
  ];

  const shortageColumns = [
    { key: 'medicine_name', label: 'Medicine', sortable: true },
    { key: 'available_stock', label: 'Available Stock', render: (r: SurplusShortageItem) => <span className="font-semibold text-red-600">{r.available_stock}</span> },
    { key: 'forecast_demand', label: '30d Forecast', render: (r: SurplusShortageItem) => Math.round(r.forecast_demand) },
    { key: 'days_of_cover', label: 'Days Cover', render: (r: SurplusShortageItem) => <span className="text-red-600 font-semibold">{r.days_of_cover === Infinity ? '∞' : r.days_of_cover}</span> },
    { key: 'shortage', label: 'Shortfall Units', render: (r: SurplusShortageItem) => <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{r.shortage}</span> },
  ];

  return (
    <div className="space-y-6">
      <Link to="/inventory" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to Inventory Management
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info card */}
        <Card className="lg:col-span-1">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{hospital.name}</h2>
              <code className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{hospital.code}</code>
            </div>
            <StatusBadge status={hospital.status} />
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 text-slate-600">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              {hospital.address}, {hospital.city}, {hospital.state}
            </div>
            {hospital.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-4 w-4 text-slate-400" />
                {hospital.phone}
              </div>
            )}
            {hospital.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" />
                {hospital.email}
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-600">
              <Bed className="h-4 w-4 text-slate-400" />
              {hospital.bed_count} beds · <span className="capitalize">{hospital.hospital_type}</span>
            </div>
          </div>
        </Card>

        {/* Summary stats */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Batches', value: batches.length, icon: <Package className="h-5 w-5" />, color: 'text-blue-600 bg-blue-50' },
            { label: 'Total Units', value: totalQty.toLocaleString(), icon: <Layers className="h-5 w-5" />, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Surplus Medicines', value: surplus.length, icon: <TrendingUp className="h-5 w-5" />, color: 'text-teal-600 bg-teal-50' },
            { label: 'Shortage Items', value: shortages.length, icon: <TrendingDown className="h-5 w-5" />, color: 'text-red-600 bg-red-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hospital Batches */}
      <Card title="Hospital Inventory Batches" subtitle={`${batches.length} total batches tracked`} noPadding>
        <DataTable columns={batchColumns as any} data={batches as any} searchable searchKeys={['medicine_name', 'batch_number', 'status']} />
      </Card>

      {/* Hospital Specific Surplus & Shortages */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card
          title="Hospital Surplus Stock"
          subtitle={`${surplus.length} surplus medicines eligible for redistribution`}
          action={<span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Surplus</span>}
          noPadding
        >
          <DataTable columns={surplusColumns as any} data={surplus as any} searchable searchKeys={['medicine_name']} emptyMessage="No surplus detected for this hospital" pageSize={5} />
        </Card>

        <Card
          title="Hospital Medicine Shortages"
          subtitle={`${shortages.length} shortage items needing replenishment`}
          action={<span className="text-xs text-red-600 font-semibold flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Shortage</span>}
          noPadding
        >
          <DataTable columns={shortageColumns as any} data={shortages as any} searchable searchKeys={['medicine_name']} emptyMessage="No shortages detected for this hospital" pageSize={5} />
        </Card>
      </div>
    </div>
  );
}
