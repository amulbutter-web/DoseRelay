import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MapPin, Bed, Filter, Thermometer, ShieldAlert,
  Search, ChevronUp, ChevronDown, Eye, CheckCircle2, AlertTriangle, X, Edit, Trash2
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge, { StatusBadge } from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input, { Select } from '../components/common/Input';
import { hospitalsApi } from '../api/hospitals';
import { medicinesApi } from '../api/medicines';
import { useAuth } from '../contexts/AuthContext';
import type { Hospital, Medicine, MedicineBatch } from '../types';

type Tab = 'hospitals' | 'medicines' | 'batches';

const DOSAGE_FORMS = ['tablet', 'capsule', 'injection', 'syrup', 'cream', 'other'];
const CATEGORIES = [
  'Antibiotic', 'Antidiabetic', 'Cardiovascular', 'Gastrointestinal',
  'Analgesic', 'Respiratory', 'Antihistamine', 'Corticosteroid',
  'Diuretic', 'Antiemetic', 'Other'
];
const BATCH_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'normal', label: 'Normal' },
  { value: 'approaching_expiry', label: 'Approaching Expiry' },
  { value: 'critical', label: 'Critical' },
  { value: 'expired', label: 'Expired' },
  { value: 'quarantined', label: 'Quarantined' },
  { value: 'recalled', label: 'Recalled' }
];

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITALS TAB
// ─────────────────────────────────────────────────────────────────────────────

function HospitalsTab() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [sortKey, setSortKey] = useState<keyof Hospital>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    phone: '',
    email: '',
    hospital_type: 'general',
    bed_count: '0',
    latitude: '',
    longitude: '',
  });

  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    hospitalsApi.getAll(filterStatus || undefined)
      .then(setHospitals)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filterStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code || !form.address || !form.city || !form.state) {
      alert('Please fill in all required fields (Name, Code, Address, City, State)');
      return;
    }
    setSaving(true);
    try {
      await hospitalsApi.create({
        ...form,
        bed_count: Number(form.bed_count) || 0,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });
      setShowAdd(false);
      setForm({
        name: '', code: '', address: '', city: '', state: '', country: 'India',
        phone: '', email: '', hospital_type: 'general', bed_count: '0', latitude: '', longitude: ''
      });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to create hospital');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return hospitals.filter(h => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        h.name.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.state.toLowerCase().includes(q) ||
        h.code.toLowerCase().includes(q);
      const matchStatus = !filterStatus || h.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [hospitals, search, filterStatus]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: keyof Hospital) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const stats = [
    { label: 'Total Hospitals', value: hospitals.length, color: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: 'Active', value: hospitals.filter(h => h.status === 'active').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { label: 'Surplus Hospitals', value: hospitals.filter(h => (h.surplus_count ?? 0) > 0).length, color: 'bg-amber-50 text-amber-700 border-amber-100' },
    { label: 'Shortage Hospitals', value: hospitals.filter(h => (h.shortage_count ?? 0) > 0).length, color: 'bg-red-50 text-red-700 border-red-100' },
  ];

  return (
    <div className="space-y-5">
      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3 flex-wrap flex-1 items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, city, code..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select
            label=""
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' }
            ]}
            className="w-40"
          />
        </div>
        {hasRole('network_admin') && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>
            Add Hospital
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl p-4 border ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card noPadding>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => toggleSort('name')}>
                    <span className="flex items-center gap-1">
                      Hospital Name
                      {sortKey === 'name' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronUp className="h-3 w-3 text-slate-300" />}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => toggleSort('code')}>
                    Code
                  </th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">City / State</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Beds</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">No hospitals found matching your criteria.</td>
                  </tr>
                ) : (
                  paged.map(h => (
                    <tr
                      key={h.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => navigate(`/hospitals/${h.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div>
                          <p className="font-semibold text-slate-900">{h.name}</p>
                          <p className="text-xs text-slate-400">{h.address}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-700">{h.code}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-slate-700">{h.hospital_type}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{h.city}, {h.state}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        <p>{h.phone || '—'}</p>
                        {h.email && <p className="text-slate-400">{h.email}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={h.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex items-center gap-1">
                          <Bed className="h-3.5 w-3.5 text-slate-400" />
                          <span>{h.bed_count}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Eye className="h-3.5 w-3.5" />}
                            onClick={() => navigate(`/hospitals/${h.id}`)}
                          >
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Edit className="h-3.5 w-3.5" />}
                            onClick={() => {
                              setEditingHospital(h);
                              setEditForm({
                                name: h.name,
                                code: h.code,
                                address: h.address,
                                city: h.city,
                                state: h.state,
                                phone: h.phone || '',
                                email: h.email || '',
                                hospital_type: h.hospital_type,
                                bed_count: h.bed_count,
                                status: h.status,
                              });
                            }}
                          >
                            Edit
                          </Button>
                          {h.status === 'active' && (
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              onClick={async () => {
                                if (window.confirm(`Deactivate hospital ${h.name}?`)) {
                                  try {
                                    await hospitalsApi.deactivate(h.id);
                                    load();
                                  } catch (err: any) {
                                    alert(err?.response?.data?.detail || 'Failed to deactivate');
                                  }
                                }
                              }}
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length} hospitals
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded text-sm ${p === currentPage ? 'bg-[#1e3a5f] text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Add Hospital Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Register New Hospital"
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave as any}>Register Hospital</Button>
          </>
        )}
      >
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          <Input
            label="Hospital Name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            className="col-span-2"
            placeholder="e.g. City General Hospital"
          />
          <Input
            label="Hospital Code *"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            required
            placeholder="e.g. CGH001"
          />
          <Select
            label="Hospital Type"
            value={form.hospital_type}
            onChange={e => setForm(f => ({ ...f, hospital_type: e.target.value }))}
            options={[
              { value: 'general', label: 'General' },
              { value: 'specialty', label: 'Specialty' },
              { value: 'clinic', label: 'Clinic' }
            ]}
          />
          <Input
            label="Address *"
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            required
            className="col-span-2"
            placeholder="Street address"
          />
          <Input
            label="City *"
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            required
            placeholder="e.g. Mumbai"
          />
          <Input
            label="State *"
            value={form.state}
            onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
            required
            placeholder="e.g. Maharashtra"
          />
          <Input
            label="Bed Count"
            type="number"
            value={form.bed_count}
            onChange={e => setForm(f => ({ ...f, bed_count: e.target.value }))}
            min="0"
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+91 98765 43210"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="contact@hospital.org"
          />
          <Input
            label="Latitude"
            type="number"
            value={form.latitude}
            onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
            placeholder="e.g. 19.0760"
            step="any"
          />
          <Input
            label="Longitude"
            type="number"
            value={form.longitude}
            onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
            placeholder="e.g. 72.8777"
            step="any"
          />
        </form>
      </Modal>

      {/* Edit Hospital Modal */}
      <Modal
        isOpen={!!editingHospital}
        onClose={() => setEditingHospital(null)}
        title={`Edit ${editingHospital?.name || 'Hospital'}`}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditingHospital(null)}>Cancel</Button>
            <Button
              loading={saving}
              onClick={async () => {
                if (!editingHospital) return;
                setSaving(true);
                try {
                  await hospitalsApi.update(editingHospital.id, {
                    ...editForm,
                    bed_count: parseInt(editForm.bed_count, 10) || 0,
                  });
                  setEditingHospital(null);
                  load();
                } catch (err: any) {
                  alert(err?.response?.data?.detail || 'Failed to update hospital');
                } finally {
                  setSaving(false);
                }
              }}
            >
              Update Hospital
            </Button>
          </>
        )}
      >
        <form className="space-y-4">
          <Input
            label="Hospital Name *"
            value={editForm.name || ''}
            onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Address *"
            value={editForm.address || ''}
            onChange={e => setEditForm((f: any) => ({ ...f, address: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City *"
              value={editForm.city || ''}
              onChange={e => setEditForm((f: any) => ({ ...f, city: e.target.value }))}
              required
            />
            <Input
              label="State *"
              value={editForm.state || ''}
              onChange={e => setEditForm((f: any) => ({ ...f, state: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={editForm.phone || ''}
              onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              value={editForm.email || ''}
              onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Type"
              value={editForm.hospital_type || 'general'}
              onChange={e => setEditForm((f: any) => ({ ...f, hospital_type: e.target.value }))}
              options={[
                { value: 'general', label: 'General Hospital' },
                { value: 'specialty', label: 'Specialty Hospital' },
                { value: 'clinic', label: 'Clinic' },
                { value: 'pharmacy', label: 'Pharmacy' },
              ]}
            />
            <Input
              label="Bed Count"
              type="number"
              value={editForm.bed_count || 0}
              onChange={e => setEditForm((f: any) => ({ ...f, bed_count: e.target.value }))}
              min="0"
            />
            <Select
              label="Status"
              value={editForm.status || 'active'}
              onChange={e => setEditForm((f: any) => ({ ...f, status: e.target.value }))}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDICINES TAB
// ─────────────────────────────────────────────────────────────────────────────

function MedicinesTab() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [editMedForm, setEditMedForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterForm, setFilterForm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [sortKey, setSortKey] = useState<keyof Medicine>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Details Modal
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [medBatches, setMedBatches] = useState<MedicineBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [form, setForm] = useState({
    name: '',
    generic_name: '',
    active_ingredient: '',
    strength: '',
    dosage_form: 'tablet',
    category: 'Other',
    manufacturer: '',
    requires_cold_storage: false,
    controlled_substance: false,
  });

  const { hasRole } = useAuth();

  const load = () => {
    setLoading(true);
    medicinesApi.getAll()
      .then(setMedicines)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenDetails = async (med: Medicine) => {
    setSelectedMedicine(med);
    setLoadingBatches(true);
    try {
      const batches = await medicinesApi.getBatches({ medicine_id: med.id });
      setMedBatches(batches);
    } catch (err) {
      console.error(err);
      setMedBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Brand Name is required');
      return;
    }
    setSaving(true);
    try {
      await medicinesApi.create(form);
      setShowAdd(false);
      setForm({
        name: '', generic_name: '', active_ingredient: '', strength: '',
        dosage_form: 'tablet', category: 'Other', manufacturer: '',
        requires_cold_storage: false, controlled_substance: false,
      });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to create medicine');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return medicines.filter(m => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        m.name.toLowerCase().includes(q) ||
        (m.generic_name || '').toLowerCase().includes(q) ||
        (m.active_ingredient || '').toLowerCase().includes(q) ||
        (m.manufacturer || '').toLowerCase().includes(q);
      const matchCat = !filterCategory || m.category === filterCategory;
      const matchForm = !filterForm || m.dosage_form === filterForm;
      return matchSearch && matchCat && matchForm;
    });
  }, [medicines, search, filterCategory, filterForm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: keyof Medicine) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Stats: Total Medicines + top 3 categories by count
  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of medicines) {
      const cat = m.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [medicines]);

  return (
    <div className="space-y-5">
      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3 flex-wrap flex-1 items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by brand or generic name..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select
            label=""
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
            options={[{ value: '', label: 'All Categories' }, ...CATEGORIES.map(c => ({ value: c, label: c }))]}
            className="w-48"
          />
          <Select
            label=""
            value={filterForm}
            onChange={e => { setFilterForm(e.target.value); setPage(1); }}
            options={[{ value: '', label: 'All Dosage Forms' }, ...DOSAGE_FORMS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))]}
            className="w-44"
          />
        </div>
        {hasRole('network_admin', 'hospital_admin') && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>
            Add Medicine
          </Button>
        )}
      </div>

      {/* Stats Cards: Total Medicines + Top 3 Categories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 border bg-blue-50 text-blue-700 border-blue-100">
          <p className="text-2xl font-bold">{medicines.length}</p>
          <p className="text-sm font-medium mt-0.5">Total Medicines</p>
        </div>
        {topCategories.map(([cat, count]) => (
          <div key={cat} className="rounded-xl p-4 border bg-slate-50 text-slate-800 border-slate-200">
            <p className="text-2xl font-bold text-slate-900">{count}</p>
            <p className="text-sm font-medium text-slate-500 mt-0.5">{cat}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card noPadding>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => toggleSort('name')}>
                    <span className="flex items-center gap-1">
                      Medicine Name
                      {sortKey === 'name' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronUp className="h-3 w-3 text-slate-300" />}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => toggleSort('generic_name')}>
                    Generic Name
                  </th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Dosage Form</th>
                  <th className="px-4 py-3 text-left">Manufacturer</th>
                  <th className="px-4 py-3 text-left">Cold Storage</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">No medicines found matching your criteria.</td>
                  </tr>
                ) : (
                  paged.map(m => (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetails(m)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900">{m.name}</p>
                          {m.strength && <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{m.strength}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {m.generic_name || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="info">{m.category || 'Other'}</Badge>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700">
                        {m.dosage_form}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {m.manufacturer || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {m.requires_cold_storage ? (
                          <span className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            <Thermometer className="h-3 w-3" /> Cold Storage
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Standard</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Eye className="h-3.5 w-3.5" />}
                            onClick={() => handleOpenDetails(m)}
                          >
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Edit className="h-3.5 w-3.5" />}
                            onClick={() => {
                              setEditingMedicine(m);
                              setEditMedForm({
                                name: m.name,
                                generic_name: m.generic_name || '',
                                active_ingredient: m.active_ingredient || '',
                                strength: m.strength || '',
                                dosage_form: m.dosage_form,
                                category: m.category,
                                manufacturer: m.manufacturer || '',
                                requires_cold_storage: m.requires_cold_storage || false,
                                controlled_substance: m.controlled_substance || false,
                              });
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length} medicines
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded text-sm ${p === currentPage ? 'bg-[#1e3a5f] text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Add Medicine Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Register Medicine"
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave as any}>Save Medicine</Button>
          </>
        )}
      >
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          <Input
            label="Brand Name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            className="col-span-2"
            placeholder="e.g. Paracetamol 500mg"
          />
          <Input
            label="Generic Name"
            value={form.generic_name}
            onChange={e => setForm(f => ({ ...f, generic_name: e.target.value }))}
            placeholder="e.g. Acetaminophen"
          />
          <Input
            label="Active Ingredient"
            value={form.active_ingredient}
            onChange={e => setForm(f => ({ ...f, active_ingredient: e.target.value }))}
            placeholder="e.g. Paracetamol"
          />
          <Input
            label="Strength"
            value={form.strength}
            onChange={e => setForm(f => ({ ...f, strength: e.target.value }))}
            placeholder="e.g. 500mg, 10ml"
          />
          <Select
            label="Dosage Form"
            value={form.dosage_form}
            onChange={e => setForm(f => ({ ...f, dosage_form: e.target.value }))}
            options={DOSAGE_FORMS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))}
          />
          <Select
            label="Category"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            options={CATEGORIES.map(c => ({ value: c, label: c }))}
          />
          <Input
            label="Manufacturer"
            value={form.manufacturer}
            onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
            className="col-span-2"
            placeholder="e.g. Cipla, Sun Pharma"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.requires_cold_storage}
              onChange={e => setForm(f => ({ ...f, requires_cold_storage: e.target.checked }))}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Requires Cold Storage (2-8°C)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.controlled_substance}
              onChange={e => setForm(f => ({ ...f, controlled_substance: e.target.checked }))}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Controlled Substance (Schedule X/H)
          </label>
        </form>
      </Modal>

      {/* Edit Medicine Modal */}
      <Modal
        isOpen={!!editingMedicine}
        onClose={() => setEditingMedicine(null)}
        title={`Edit ${editingMedicine?.name || 'Medicine'}`}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditingMedicine(null)}>Cancel</Button>
            <Button
              loading={saving}
              onClick={async () => {
                if (!editingMedicine) return;
                setSaving(true);
                try {
                  await medicinesApi.update(editingMedicine.id, editMedForm);
                  setEditingMedicine(null);
                  load();
                } catch (err: any) {
                  alert(err?.response?.data?.detail || 'Failed to update medicine');
                } finally {
                  setSaving(false);
                }
              }}
            >
              Update Medicine
            </Button>
          </>
        )}
      >
        <form className="grid grid-cols-2 gap-4">
          <Input
            label="Medicine Name *"
            value={editMedForm.name || ''}
            onChange={e => setEditMedForm((f: any) => ({ ...f, name: e.target.value }))}
            className="col-span-2"
            required
          />
          <Input
            label="Generic Name"
            value={editMedForm.generic_name || ''}
            onChange={e => setEditMedForm((f: any) => ({ ...f, generic_name: e.target.value }))}
          />
          <Input
            label="Active Ingredient"
            value={editMedForm.active_ingredient || ''}
            onChange={e => setEditMedForm((f: any) => ({ ...f, active_ingredient: e.target.value }))}
          />
          <Input
            label="Strength"
            value={editMedForm.strength || ''}
            onChange={e => setEditMedForm((f: any) => ({ ...f, strength: e.target.value }))}
          />
          <Select
            label="Dosage Form"
            value={editMedForm.dosage_form || 'tablet'}
            onChange={e => setEditMedForm((f: any) => ({ ...f, dosage_form: e.target.value }))}
            options={DOSAGE_FORMS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))}
          />
          <Select
            label="Category"
            value={editMedForm.category || 'Antibiotic'}
            onChange={e => setEditMedForm((f: any) => ({ ...f, category: e.target.value }))}
            options={CATEGORIES.map(c => ({ value: c, label: c }))}
          />
          <Input
            label="Manufacturer"
            value={editMedForm.manufacturer || ''}
            onChange={e => setEditMedForm((f: any) => ({ ...f, manufacturer: e.target.value }))}
            className="col-span-2"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={editMedForm.requires_cold_storage || false}
              onChange={e => setEditMedForm((f: any) => ({ ...f, requires_cold_storage: e.target.checked }))}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Requires Cold Storage (2-8°C)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={editMedForm.controlled_substance || false}
              onChange={e => setEditMedForm((f: any) => ({ ...f, controlled_substance: e.target.checked }))}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Controlled Substance (Schedule X/H)
          </label>
        </form>
      </Modal>

      {/* View Details Modal / Panel with Batches */}
      <Modal
        isOpen={Boolean(selectedMedicine)}
        onClose={() => setSelectedMedicine(null)}
        title={selectedMedicine ? `${selectedMedicine.name} — Details & Batches` : 'Medicine Details'}
        size="xl"
        footer={<Button variant="secondary" onClick={() => setSelectedMedicine(null)}>Close</Button>}
      >
        {selectedMedicine && (
          <div className="space-y-6">
            {/* Overview Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <p className="text-xs text-slate-400">Generic Name</p>
                <p className="text-sm font-semibold text-slate-800">{selectedMedicine.generic_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Category</p>
                <p className="text-sm font-semibold text-slate-800">{selectedMedicine.category || 'Other'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Dosage Form & Strength</p>
                <p className="text-sm font-semibold text-slate-800 capitalize">{selectedMedicine.dosage_form} · {selectedMedicine.strength || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Manufacturer</p>
                <p className="text-sm font-semibold text-slate-800">{selectedMedicine.manufacturer || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Active Ingredient</p>
                <p className="text-sm font-medium text-slate-700">{selectedMedicine.active_ingredient || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Cold Storage</p>
                <p className="text-sm font-medium text-slate-700">{selectedMedicine.requires_cold_storage ? 'Required (2-8°C)' : 'No'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Controlled Substance</p>
                <p className="text-sm font-medium text-slate-700">{selectedMedicine.controlled_substance ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Batches in Network</p>
                <p className="text-sm font-bold text-blue-600">{medBatches.length}</p>
              </div>
            </div>

            {/* Batches Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-800">Current Batches Across Hospitals</h4>
                <span className="text-xs text-slate-500">{medBatches.length} batch{medBatches.length !== 1 ? 'es' : ''} found</span>
              </div>
              {loadingBatches ? (
                <div className="py-8 text-center text-slate-400">Loading batches...</div>
              ) : medBatches.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No active batches recorded for this medicine in any hospital.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="px-3 py-2 text-left">Batch #</th>
                        <th className="px-3 py-2 text-left">Hospital</th>
                        <th className="px-3 py-2 text-left">Quantity</th>
                        <th className="px-3 py-2 text-left">Expiry Date</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {medBatches.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono font-medium text-slate-800">{b.batch_number}</td>
                          <td className="px-3 py-2 text-slate-600">{b.hospital_name || `Hospital #${b.hospital_id}`}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">
                            {b.quantity} {b.reserved_quantity > 0 && <span className="text-amber-600 font-normal">({b.reserved_quantity} reserved)</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{b.expiry_date}</td>
                          <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCHES TAB
// ─────────────────────────────────────────────────────────────────────────────

function BatchesTab() {
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingBatch, setEditingBatch] = useState<MedicineBatch | null>(null);
  const [editBatchForm, setEditBatchForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<MedicineBatch | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [sortKey, setSortKey] = useState<keyof MedicineBatch>('expiry_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { hasRole } = useAuth();

  const [form, setForm] = useState({
    medicine_id: '',
    hospital_id: '',
    batch_number: '',
    quantity: '',
    manufacturing_date: '',
    expiry_date: '',
    unit_price: '0',
    storage_conditions: '',
  });

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (filterStatus) params.status = filterStatus;
    if (filterHospital) params.hospital_id = Number(filterHospital);

    medicinesApi.getBatches(params)
      .then(setBatches)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    hospitalsApi.getAll().then(setHospitals).catch(console.error);
    medicinesApi.getAll().then(setMedicines).catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [filterStatus, filterHospital]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.medicine_id || !form.hospital_id || !form.batch_number || !form.quantity || !form.expiry_date) {
      alert('Please fill in all required fields (Medicine, Hospital, Batch #, Quantity, Expiry Date)');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        medicine_id: Number(form.medicine_id),
        hospital_id: Number(form.hospital_id),
        batch_number: form.batch_number.trim(),
        quantity: Number(form.quantity),
        manufacturing_date: form.manufacturing_date || undefined,
        expiry_date: form.expiry_date,
        unit_price: Number(form.unit_price) || 0,
      };

      // If user typed temperature bounds like "2-8" or "2-8°C"
      if (form.storage_conditions) {
        const match = form.storage_conditions.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
        if (match) {
          payload.storage_temp_min = parseFloat(match[1]);
          payload.storage_temp_max = parseFloat(match[2]);
        }
      }

      await medicinesApi.createBatch(payload);
      setShowAdd(false);
      setForm({
        medicine_id: '', hospital_id: '', batch_number: '', quantity: '',
        manufacturing_date: '', expiry_date: '', unit_price: '0', storage_conditions: '',
      });
      load();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to create batch');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return batches.filter(b => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        b.batch_number.toLowerCase().includes(q) ||
        (b.medicine_name || '').toLowerCase().includes(q) ||
        (b.hospital_name || '').toLowerCase().includes(q);
      const matchStatus = !filterStatus || b.status === filterStatus;
      const matchHospital = !filterHospital || b.hospital_id === Number(filterHospital);
      return matchSearch && matchStatus && matchHospital;
    });
  }, [batches, search, filterStatus, filterHospital]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: keyof MedicineBatch) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Stats calculation
  const stats = [
    { label: 'Total Batches', value: batches.length, color: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: 'Normal', value: batches.filter(b => b.status === 'normal').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { label: 'Approaching Expiry', value: batches.filter(b => b.status === 'approaching_expiry').length, color: 'bg-amber-50 text-amber-700 border-amber-100' },
    { label: 'Critical / Expired', value: batches.filter(b => b.status === 'critical' || b.status === 'expired').length, color: 'bg-red-50 text-red-700 border-red-100' },
  ];

  return (
    <div className="space-y-5">
      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3 flex-wrap flex-1 items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search batch # or medicine..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select
            label=""
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            options={BATCH_STATUSES}
            className="w-48"
          />
          <Select
            label=""
            value={filterHospital}
            onChange={e => { setFilterHospital(e.target.value); setPage(1); }}
            placeholder="All Hospitals"
            options={[{ value: '', label: 'All Hospitals' }, ...hospitals.map(h => ({ value: String(h.id), label: h.name }))]}
            className="w-56"
          />
          <Button variant="secondary" icon={<Filter className="h-4 w-4" />} onClick={load}>
            Refresh
          </Button>
        </div>
        {hasRole('network_admin', 'hospital_admin', 'pharmacist') && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>
            Add Batch
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl p-4 border ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table with Row Color Coding */}
      <Card noPadding>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => toggleSort('batch_number')}>
                    <span className="flex items-center gap-1">
                      Batch #
                      {sortKey === 'batch_number' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronUp className="h-3 w-3 text-slate-300" />}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => toggleSort('medicine_name')}>
                    Medicine
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => toggleSort('hospital_name')}>
                    Hospital
                  </th>
                  <th className="px-4 py-3 text-left">Mfg Date</th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => toggleSort('expiry_date')}>
                    <span className="flex items-center gap-1">
                      Expiry Date
                      {sortKey === 'expiry_date' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronUp className="h-3 w-3 text-slate-300" />}
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">Qty</th>
                  <th className="px-4 py-3 text-left">Reserved</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Days Left</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">No batches found matching your criteria.</td>
                  </tr>
                ) : (
                  paged.map(b => {
                    const days = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000);
                    // Color code rows: red for expired/critical, amber for approaching_expiry, normal for normal
                    const isCriticalOrExpired = b.status === 'expired' || b.status === 'critical';
                    const isApproaching = b.status === 'approaching_expiry';

                    const rowBgClass = isCriticalOrExpired
                      ? 'bg-red-50/80 hover:bg-red-100/80 text-red-950'
                      : isApproaching
                        ? 'bg-amber-50/80 hover:bg-amber-100/80 text-amber-950'
                        : 'hover:bg-slate-50 text-slate-800';

                    return (
                      <tr
                        key={b.id}
                        className={`transition-colors cursor-pointer ${rowBgClass}`}
                        onClick={() => setSelectedBatch(b)}
                      >
                        <td className="px-4 py-3">
                          <code className="text-xs bg-white/90 border border-slate-200 px-2 py-0.5 rounded font-mono font-medium">
                            {b.batch_number}
                          </code>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {b.medicine_name || `Medicine #${b.medicine_id}`}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {b.hospital_name || `Hospital #${b.hospital_id}`}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {b.manufacturing_date || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium">
                          {b.expiry_date}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {b.quantity}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {b.reserved_quantity > 0 ? (
                            <span className="text-amber-700 font-semibold">{b.reserved_quantity} reserved</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {days < 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-red-700">
                              <AlertTriangle className="h-3 w-3" /> Expired ({Math.abs(days)}d ago)
                            </span>
                          ) : days <= 30 ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <AlertTriangle className="h-3 w-3" /> {days}d left
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium">
                              {days}d left
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Eye className="h-3.5 w-3.5" />}
                              onClick={() => setSelectedBatch(b)}
                            >
                              View
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Edit className="h-3.5 w-3.5" />}
                              onClick={() => {
                                setEditingBatch(b);
                                setEditBatchForm({
                                  quantity: b.quantity,
                                  reserved_quantity: b.reserved_quantity,
                                  status: b.status,
                                  unit_price: b.unit_price || 0,
                                  storage_conditions: b.storage_conditions || '',
                                });
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length} batches
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded text-sm ${p === currentPage ? 'bg-[#1e3a5f] text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Add Batch Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Medicine Batch"
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave as any}>Add Batch</Button>
          </>
        )}
      >
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          <Select
            label="Medicine *"
            value={form.medicine_id}
            onChange={e => setForm(f => ({ ...f, medicine_id: e.target.value }))}
            options={medicines.map(m => ({ value: String(m.id), label: `${m.name} (${m.dosage_form})` }))}
            placeholder="Select medicine"
            className="col-span-2"
          />
          <Select
            label="Hospital *"
            value={form.hospital_id}
            onChange={e => setForm(f => ({ ...f, hospital_id: e.target.value }))}
            options={hospitals.map(h => ({ value: String(h.id), label: `${h.name} (${h.city})` }))}
            placeholder="Select hospital"
            className="col-span-2"
          />
          <Input
            label="Batch Number *"
            value={form.batch_number}
            onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))}
            required
            placeholder="e.g. BATCH-2024-001"
          />
          <Input
            label="Quantity *"
            type="number"
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            required
            min="1"
            placeholder="e.g. 500"
          />
          <Input
            label="Manufacturing Date"
            type="date"
            value={form.manufacturing_date}
            onChange={e => setForm(f => ({ ...f, manufacturing_date: e.target.value }))}
          />
          <Input
            label="Expiry Date *"
            type="date"
            value={form.expiry_date}
            onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
            required
          />
          <Input
            label="Unit Price (₹)"
            type="number"
            value={form.unit_price}
            onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
            step="0.01"
            min="0"
            placeholder="0.00"
          />
          <Input
            label="Storage Conditions"
            value={form.storage_conditions}
            onChange={e => setForm(f => ({ ...f, storage_conditions: e.target.value }))}
            placeholder="e.g. 2-8°C or Cool & Dry"
          />
        </form>
      </Modal>

      {/* Edit Batch Modal */}
      <Modal
        isOpen={!!editingBatch}
        onClose={() => setEditingBatch(null)}
        title={`Edit Batch — ${editingBatch?.batch_number || ''}`}
        size="md"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditingBatch(null)}>Cancel</Button>
            <Button
              loading={saving}
              onClick={async () => {
                if (!editingBatch) return;
                setSaving(true);
                try {
                  await medicinesApi.updateBatch(editingBatch.id, {
                    quantity: parseInt(editBatchForm.quantity, 10) || 0,
                    reserved_quantity: parseInt(editBatchForm.reserved_quantity, 10) || 0,
                    status: editBatchForm.status,
                    unit_price: parseFloat(editBatchForm.unit_price) || 0,
                    storage_conditions: editBatchForm.storage_conditions || '',
                  });
                  setEditingBatch(null);
                  load();
                } catch (err: any) {
                  alert(err?.response?.data?.detail || 'Failed to update batch');
                } finally {
                  setSaving(false);
                }
              }}
            >
              Update Batch
            </Button>
          </>
        )}
      >
        <form className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
            <p className="font-semibold text-slate-800">{editingBatch?.medicine_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{editingBatch?.hospital_name}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Total Quantity *"
              type="number"
              value={editBatchForm.quantity || 0}
              onChange={e => setEditBatchForm((f: any) => ({ ...f, quantity: e.target.value }))}
              min="0"
              required
            />
            <Input
              label="Reserved Quantity"
              type="number"
              value={editBatchForm.reserved_quantity || 0}
              onChange={e => setEditBatchForm((f: any) => ({ ...f, reserved_quantity: e.target.value }))}
              min="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Quality & Inventory Status *"
              value={editBatchForm.status || 'normal'}
              onChange={e => setEditBatchForm((f: any) => ({ ...f, status: e.target.value }))}
              options={BATCH_STATUSES.filter(s => s.value !== '')}
            />
            <Input
              label="Unit Price (₹)"
              type="number"
              value={editBatchForm.unit_price || 0}
              onChange={e => setEditBatchForm((f: any) => ({ ...f, unit_price: e.target.value }))}
              step="0.01"
              min="0"
            />
          </div>
          <Input
            label="Storage Conditions"
            value={editBatchForm.storage_conditions || ''}
            onChange={e => setEditBatchForm((f: any) => ({ ...f, storage_conditions: e.target.value }))}
            placeholder="e.g. 2-8°C or Cool & Dry"
          />
        </form>
      </Modal>

      {/* Batch Details Modal */}
      <Modal
        isOpen={Boolean(selectedBatch)}
        onClose={() => setSelectedBatch(null)}
        title={selectedBatch ? `Batch Details — ${selectedBatch.batch_number}` : 'Batch Details'}
        size="md"
        footer={<Button variant="secondary" onClick={() => setSelectedBatch(null)}>Close</Button>}
      >
        {selectedBatch && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-400">Batch Number</p>
                <code className="text-base font-bold text-slate-900 font-mono">{selectedBatch.batch_number}</code>
              </div>
              <StatusBadge status={selectedBatch.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400">Medicine</p>
                <p className="font-semibold text-slate-800">{selectedBatch.medicine_name || `ID #${selectedBatch.medicine_id}`}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Hospital</p>
                <p className="font-semibold text-slate-800">{selectedBatch.hospital_name || `Hospital #${selectedBatch.hospital_id}`}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Quantity</p>
                <p className="font-bold text-slate-900 text-base">{selectedBatch.quantity} units</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Available / Reserved</p>
                <p className="font-medium text-slate-800">
                  {selectedBatch.quantity - selectedBatch.reserved_quantity} avail · {selectedBatch.reserved_quantity} reserved
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Manufacturing Date</p>
                <p className="text-slate-700">{selectedBatch.manufacturing_date || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Expiry Date</p>
                <p className="font-medium text-slate-900">{selectedBatch.expiry_date}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Unit Price</p>
                <p className="text-slate-800 font-medium">₹{selectedBatch.unit_price?.toFixed(2) ?? '0.00'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Storage Temperature</p>
                <p className="text-slate-700">
                  {selectedBatch.storage_temp_min != null && selectedBatch.storage_temp_max != null
                    ? `${selectedBatch.storage_temp_min}°C – ${selectedBatch.storage_temp_max}°C`
                    : 'Standard ambient'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function InventoryManagementPage() {
  // Use state with sync to URL hash if present
  const initialTab = (): Tab => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'medicines' || hash === 'batches') return hash as Tab;
    return 'hospitals';
  };

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'hospitals', label: 'Hospitals' },
    { key: 'medicines', label: 'Medicines' },
    { key: 'batches', label: 'Batches' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory Management</h1>
          <p className="text-slate-500 text-sm mt-1">
            Centralized hub for hospitals, medicine catalogue, and batch supplies
          </p>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'hospitals' && <HospitalsTab />}
      {activeTab === 'medicines' && <MedicinesTab />}
      {activeTab === 'batches' && <BatchesTab />}
    </div>
  );
}
