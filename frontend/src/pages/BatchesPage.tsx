import React, { useEffect, useState } from 'react';
import { Plus, Filter } from 'lucide-react';
import Card from '../components/common/Card';
import DataTable from '../components/common/DataTable';
import Button from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input, { Select } from '../components/common/Input';
import { medicinesApi } from '../api/medicines';
import { hospitalsApi } from '../api/hospitals';
import { useAuth } from '../contexts/AuthContext';
import type { MedicineBatch, Hospital, Medicine } from '../types';

export default function BatchesPage() {
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const { hasRole } = useAuth();
  const [form, setForm] = useState({ medicine_id: '', hospital_id: '', batch_number: '', quantity: '', expiry_date: '', manufacturing_date: '', unit_price: '0' });

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (filterStatus) params.status = filterStatus;
    if (filterHospital) params.hospital_id = Number(filterHospital);
    medicinesApi.getBatches(params).then(setBatches).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    hospitalsApi.getAll().then(setHospitals);
    medicinesApi.getAll().then(setMedicines);
  }, []);
  useEffect(() => { load(); }, [filterStatus, filterHospital]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await medicinesApi.createBatch({ ...form, medicine_id: Number(form.medicine_id), hospital_id: Number(form.hospital_id), quantity: Number(form.quantity), unit_price: Number(form.unit_price) });
      setShowAdd(false); load();
    } catch (err: any) { alert(err?.response?.data?.detail || 'Failed to create batch'); }
    finally { setSaving(false); }
  };

  const STATUS_OPTS = ['','normal','approaching_expiry','critical','expired','quarantined','recalled'].map(s => ({value:s,label:s?s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'All Statuses'}));

  const columns = [
    { key: 'batch_number', label: 'Batch #', render: (b: MedicineBatch) => <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">{b.batch_number}</code> },
    { key: 'medicine_name', label: 'Medicine', sortable: true, render: (b: MedicineBatch) => <span className="font-medium text-sm">{b.medicine_name}</span> },
    { key: 'hospital_name', label: 'Hospital', render: (b: MedicineBatch) => <span className="text-sm text-slate-600">{b.hospital_name}</span> },
    { key: 'quantity', label: 'Available', render: (b: MedicineBatch) => (
      <div>
        <p className="font-semibold text-sm">{b.quantity - b.reserved_quantity}</p>
        {b.reserved_quantity > 0 && <p className="text-xs text-amber-600">({b.reserved_quantity} reserved)</p>}
      </div>
    )},
    { key: 'expiry_date', label: 'Expiry', sortable: true, render: (b: MedicineBatch) => {
      const days = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000);
      return <div><p className="text-sm">{b.expiry_date}</p><p className={`text-xs ${days < 0 ? 'text-red-600' : days < 30 ? 'text-amber-600' : 'text-slate-400'}`}>{days < 0 ? 'Expired' : `${days}d left`}</p></div>;
    }},
    { key: 'unit_price', label: 'Unit Price', render: (b: MedicineBatch) => <span className="text-sm">₹{b.unit_price?.toFixed(2) ?? '—'}</span> },
    { key: 'status', label: 'Status', render: (b: MedicineBatch) => <StatusBadge status={b.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Inventory Batches</h2>
          <p className="text-sm text-slate-500">{batches.length} batches shown</p>
        </div>
        {hasRole('network_admin','hospital_admin','pharmacist') && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>Add Batch</Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select label="" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} options={STATUS_OPTS} className="w-48" />
        <Select label="" value={filterHospital} onChange={e => setFilterHospital(e.target.value)} placeholder="All Hospitals"
          options={hospitals.map(h => ({value:String(h.id),label:h.name}))} className="w-56" />
        <Button variant="secondary" icon={<Filter className="h-4 w-4" />} onClick={load}>Refresh</Button>
      </div>

      <Card noPadding>
        <DataTable columns={columns as any} data={batches as any} loading={loading} searchable searchKeys={['batch_number','medicine_name','hospital_name','status']} />
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Medicine Batch" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button><Button loading={saving} onClick={handleSave as any}>Add Batch</Button></>}>
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          <Select label="Medicine *" value={form.medicine_id} onChange={e => setForm(f => ({...f,medicine_id:e.target.value}))} options={medicines.map(m=>({value:String(m.id),label:m.name}))} placeholder="Select medicine" className="col-span-2" />
          <Select label="Hospital *" value={form.hospital_id} onChange={e => setForm(f => ({...f,hospital_id:e.target.value}))} options={hospitals.map(h=>({value:String(h.id),label:h.name}))} placeholder="Select hospital" className="col-span-2" />
          <Input label="Batch Number *" value={form.batch_number} onChange={e => setForm(f => ({...f,batch_number:e.target.value}))} required placeholder="e.g. BATCH-2024-001" />
          <Input label="Quantity *" type="number" value={form.quantity} onChange={e => setForm(f => ({...f,quantity:e.target.value}))} required min="1" />
          <Input label="Manufacturing Date" type="date" value={form.manufacturing_date} onChange={e => setForm(f => ({...f,manufacturing_date:e.target.value}))} />
          <Input label="Expiry Date *" type="date" value={form.expiry_date} onChange={e => setForm(f => ({...f,expiry_date:e.target.value}))} required />
          <Input label="Unit Price (₹)" type="number" value={form.unit_price} onChange={e => setForm(f => ({...f,unit_price:e.target.value}))} step="0.01" min="0" className="col-span-2" />
        </form>
      </Modal>
    </div>
  );
}
