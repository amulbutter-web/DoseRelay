import React, { useEffect, useState } from 'react';
import { Plus, FlaskConical, Thermometer } from 'lucide-react';
import Card from '../components/common/Card';
import DataTable from '../components/common/DataTable';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input, { Select } from '../components/common/Input';
import { medicinesApi } from '../api/medicines';
import { useAuth } from '../contexts/AuthContext';
import type { Medicine } from '../types';

const DOSAGE_FORMS = ['tablet','capsule','injection','syrup','cream','other'];
const CATEGORIES = ['Antibiotic','Antidiabetic','Cardiovascular','Gastrointestinal','Analgesic','Respiratory','Antihistamine','Corticosteroid','Diuretic','Antiemetic','Other'];

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const { hasRole } = useAuth();
  const [form, setForm] = useState({ name: '', generic_name: '', active_ingredient: '', strength: '', dosage_form: 'tablet', category: 'Other', manufacturer: '', requires_cold_storage: false, controlled_substance: false });

  const load = () => { setLoading(true); medicinesApi.getAll().then(setMedicines).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await medicinesApi.create(form); setShowAdd(false); load(); }
    catch (err: any) { alert(err?.response?.data?.detail || 'Failed to create medicine'); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'name', label: 'Medicine Name', sortable: true, render: (m: Medicine) => (
      <div>
        <p className="font-medium text-slate-800">{m.name}</p>
        {m.generic_name && <p className="text-xs text-slate-400">{m.generic_name}</p>}
      </div>
    )},
    { key: 'active_ingredient', label: 'Active Ingredient', render: (m: Medicine) => <span className="text-sm text-slate-600">{m.active_ingredient || '—'}</span> },
    { key: 'strength', label: 'Strength', render: (m: Medicine) => <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded">{m.strength || '—'}</span> },
    { key: 'dosage_form', label: 'Form', render: (m: Medicine) => <span className="capitalize text-sm">{m.dosage_form}</span> },
    { key: 'category', label: 'Category', render: (m: Medicine) => <Badge variant="info">{m.category || 'Other'}</Badge> },
    { key: 'manufacturer', label: 'Manufacturer', render: (m: Medicine) => <span className="text-sm text-slate-500">{m.manufacturer || '—'}</span> },
    { key: 'requires_cold_storage', label: 'Cold Storage', render: (m: Medicine) => m.requires_cold_storage ? (
      <span className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium"><Thermometer className="h-3 w-3" />Required</span>
    ) : <span className="text-slate-400 text-xs">No</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Medicine Catalogue</h2>
          <p className="text-sm text-slate-500">{medicines.length} medicines registered</p>
        </div>
        {hasRole('network_admin', 'hospital_admin') && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>Add Medicine</Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.slice(0, 4).map(cat => (
          <div key={cat} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xl font-bold text-slate-800">{medicines.filter(m => m.category === cat).length}</p>
            <p className="text-xs text-slate-500 mt-0.5">{cat}</p>
          </div>
        ))}
      </div>

      <Card noPadding>
        <DataTable columns={columns as any} data={medicines as any} loading={loading} searchable searchKeys={['name','generic_name','active_ingredient','category','manufacturer']} />
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Register Medicine" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button><Button loading={saving} onClick={handleSave as any}>Save Medicine</Button></>}>
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          <Input label="Brand Name *" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required className="col-span-2" />
          <Input label="Generic Name" value={form.generic_name} onChange={e => setForm(f => ({...f, generic_name: e.target.value}))} />
          <Input label="Active Ingredient" value={form.active_ingredient} onChange={e => setForm(f => ({...f, active_ingredient: e.target.value}))} />
          <Input label="Strength" value={form.strength} onChange={e => setForm(f => ({...f, strength: e.target.value}))} placeholder="e.g. 500mg" />
          <Select label="Dosage Form" value={form.dosage_form} onChange={e => setForm(f => ({...f, dosage_form: e.target.value}))} options={DOSAGE_FORMS.map(d => ({value:d,label:d.charAt(0).toUpperCase()+d.slice(1)}))} />
          <Select label="Category" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} options={CATEGORIES.map(c => ({value:c,label:c}))} />
          <Input label="Manufacturer" value={form.manufacturer} onChange={e => setForm(f => ({...f, manufacturer: e.target.value}))} className="col-span-2" />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.requires_cold_storage} onChange={e => setForm(f => ({...f, requires_cold_storage: e.target.checked}))} className="rounded" />
            Requires Cold Storage
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.controlled_substance} onChange={e => setForm(f => ({...f, controlled_substance: e.target.checked}))} className="rounded" />
            Controlled Substance
          </label>
        </form>
      </Modal>
    </div>
  );
}
