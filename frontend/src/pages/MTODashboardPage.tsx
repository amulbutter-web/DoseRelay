import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { Textarea } from '../components/common/Input';
import { transfersApi } from '../api/transfers';
import type { Transfer } from '../types';

export default function MTODashboardPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Transfer | null>(null);
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([
      transfersApi.getAll({ status: 'awaiting_mto_review' }),
      transfersApi.getAll({ status: 'ready_for_dispatch' }),
      transfersApi.getAll({ status: 'dispatched' }),
      transfersApi.getAll({ status: 'in_transit' }),
    ]).then(results => setTransfers(results.flat()))
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const act = async (approve: boolean) => {
    if (!selected) return;
    setActing(true);
    try {
      await transfersApi.mtoReview(selected.id, approve, notes);
      load(); setModal(null); setNotes(''); setSelected(null);
    } catch (err: any) { alert(err?.response?.data?.detail || 'Action failed'); }
    finally { setActing(false); }
  };

  const pending = transfers.filter(t => t.status === 'awaiting_mto_review');
  const active = transfers.filter(t => t.status !== 'awaiting_mto_review');

  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold text-slate-800">MTO Dashboard</h2>
        <p className="text-sm text-slate-500">Medicine Transfer Officer — coordinate and monitor transfer workflows</p></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', value: pending.length, color: 'bg-amber-50 text-amber-700' },
          { label: 'Active Transfers', value: active.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'In Transit', value: transfers.filter(t=>t.status==='in_transit').length, color: 'bg-violet-50 text-violet-700' },
          { label: 'Total Monitored', value: transfers.length, color: 'bg-slate-50 text-slate-700' },
        ].map(s => <div key={s.label} className={`rounded-xl p-4 ${s.color}`}><p className="text-2xl font-bold">{s.value}</p><p className="text-sm font-medium">{s.label}</p></div>)}
      </div>

      {/* Pending reviews */}
      <Card title="Pending MTO Review" subtitle={`${pending.length} transfers awaiting your review`}>
        {pending.length === 0 ? (
          <div className="text-center py-8 text-slate-400"><ClipboardList className="h-8 w-8 mx-auto mb-2 text-slate-300" /><p>No transfers pending review</p></div>
        ) : (
          <div className="space-y-3">
            {pending.map(t => (
              <div key={t.id} className="border border-amber-200 bg-amber-50/50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-slate-800">{t.medicine_name}</p>
                    <div className="flex items-center gap-1 text-sm text-slate-500 mt-0.5">
                      <span>{t.donor_hospital_name}</span><ArrowRight className="h-3 w-3" /><span>{t.receiver_hospital_name}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Batch: {t.batch_number} · Qty: <strong>{t.quantity}</strong></p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => navigate(`/transfers/${t.id}`)}>Review Evidence / Documents / Corrections</Button>
                    <Button size="sm" variant="success" icon={<CheckCircle className="h-3 w-3" />} onClick={() => { setSelected(t); setModal('approve'); }}>Approve</Button>
                    <Button size="sm" variant="danger" icon={<XCircle className="h-3 w-3" />} onClick={() => { setSelected(t); setModal('reject'); }}>Reject</Button>
                  </div>
                </div>
                <button className="text-xs text-blue-600 hover:underline" onClick={() => navigate(`/transfers/${t.id}`)}>View full details →</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Active transfers */}
      <Card title="Active Transfers" subtitle="Transfers currently in progress">
        <div className="space-y-2">
          {active.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No active transfers</p> :
            active.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-slate-100 cursor-pointer" onClick={() => navigate(`/transfers/${t.id}`)}>
                <div>
                  <p className="font-medium text-sm text-slate-700">{t.medicine_name} — {t.quantity} units</p>
                  <p className="text-xs text-slate-400">{t.donor_hospital_name} → {t.receiver_hospital_name}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))
          }
        </div>
      </Card>

      <Modal isOpen={modal === 'approve'} onClose={() => setModal(null)} title="Approve Transfer"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="success" loading={acting} onClick={() => act(true)}>Confirm Approval</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Approve transfer of <strong>{selected?.quantity}</strong> units of <strong>{selected?.medicine_name}</strong>?</p>
          <p className="text-xs">Review full details and evidence before approving. This is internal platform approval, not statutory permission.</p>
          <Textarea label="Review notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add coordination notes…" />
        </div>
      </Modal>
      <Modal isOpen={modal === 'reject'} onClose={() => setModal(null)} title="Reject Transfer"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" loading={acting} onClick={() => act(false)}>Reject Transfer</Button></>}>
        <Textarea label="Reason for rejection *" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Explain why this transfer is being rejected…" />
      </Modal>
    </div>
  );
}
