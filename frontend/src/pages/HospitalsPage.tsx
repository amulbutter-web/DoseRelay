import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Phone, Mail, Bed } from 'lucide-react';
import Card from '../components/common/Card';
import DataTable from '../components/common/DataTable';
import Button from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input, { Select } from '../components/common/Input';
import { hospitalsApi } from '../api/hospitals';
import { useAuth } from '../contexts/AuthContext';
import type { Hospital } from '../types';

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', city: '', state: '', country: 'India', phone: '', email: '', hospital_type: 'general', bed_count: '0', latitude: '', longitude: '' });
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    hospitalsApi.getAll().then(setHospitals).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await hospitalsApi.create({ ...form, bed_count: Number(form.bed_count), latitude: form.latitude ? Number(form.latitude) : undefined, longitude: form.longitude ? Number(form.longitude) : undefined });
      setShowAdd(false);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to create hospital');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'name', label: 'Hospital', sortable: true, render: (h: Hospital) => (
      <div>
        <p className="font-medium text-slate-800">{h.name}</p>
        <p className="text-xs text-slate-400">{h.code}</p>
      </div>
    )},
    { key: 'city', label: 'Location', render: (h: Hospital) => (
      <div className="flex items-center gap-1 text-sm text-slate-600">
        <MapPin className="h-3 w-3 text-slate-400" />
        {h.city}, {h.state}
      </div>
    )},
    { key: 'hospital_type', label: 'Type', render: (h: Hospital) => <span className="capitalize text-sm">{h.hospital_type}</span> },
    { key: 'bed_count', label: 'Beds', render: (h: Hospital) => (
      <div className="flex items-center gap-1 text-sm"><Bed className="h-3 w-3 text-slate-400" />{h.bed_count}</div>
    )},
    { key: 'total_batches', label: 'Batches', render: (h: Hospital) => <span className="font-medium text-sm">{h.total_batches ?? 0}</span> },
    { key: 'expiry_alert_count', label: 'Expiry Alerts', render: (h: Hospital) => (
      <span className={`font-medium text-sm ${(h.expiry_alert_count ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{h.expiry_alert_count ?? 0}</span>
    )},
    { key: 'status', label: 'Status', render: (h: Hospital) => <StatusBadge status={h.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Registered Hospitals</h2>
          <p className="text-sm text-slate-500">{hospitals.length} hospital{hospitals.length !== 1 ? 's' : ''} in network</p>
        </div>
        {hasRole('network_admin') && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>Add Hospital</Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: hospitals.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Active', value: hospitals.filter(h => h.status === 'active').length, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'With Expiry Alerts', value: hospitals.filter(h => (h.expiry_alert_count ?? 0) > 0).length, color: 'bg-amber-50 text-amber-700' },
          { label: 'Inactive', value: hospitals.filter(h => h.status === 'inactive').length, color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <Card noPadding>
        <DataTable
          columns={columns as any}
          data={hospitals as any}
          loading={loading}
          searchable
          searchKeys={['name', 'code', 'city', 'state']}
          onRowClick={(h: any) => navigate(`/hospitals/${h.id}`)}
        />
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Register New Hospital" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button><Button loading={saving} onClick={handleSave as any}>Register Hospital</Button></>}>
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          <Input label="Hospital Name *" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required className="col-span-2" />
          <Input label="Hospital Code *" value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} required placeholder="e.g. MGH001" />
          <Select label="Type" value={form.hospital_type} onChange={e => setForm(f => ({...f, hospital_type: e.target.value}))}
            options={[{value:'general',label:'General'},{value:'specialty',label:'Specialty'},{value:'clinic',label:'Clinic'}]} />
          <Input label="Address *" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} required className="col-span-2" />
          <Input label="City *" value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} required />
          <Input label="State *" value={form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))} required />
          <Input label="Bed Count" type="number" value={form.bed_count} onChange={e => setForm(f => ({...f, bed_count: e.target.value}))} />
          <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
          <Input label="Latitude" type="number" value={form.latitude} onChange={e => setForm(f => ({...f, latitude: e.target.value}))} placeholder="e.g. 19.076" />
          <Input label="Longitude" type="number" value={form.longitude} onChange={e => setForm(f => ({...f, longitude: e.target.value}))} placeholder="e.g. 72.877" />
        </form>
      </Modal>
    </div>
  );
}
