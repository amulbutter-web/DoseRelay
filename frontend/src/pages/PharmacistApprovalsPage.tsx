import MedicineRequests from '../components/MedicineRequests';
import {useAuth} from '../contexts/AuthContext';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowRight, Shield } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { Textarea } from '../components/common/Input';
import { transfersApi } from '../api/transfers';
import type { Transfer } from '../types';

export default function PharmacistApprovalsPage() {
  const [pending, setPending] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Transfer | null>(null);
  const [action, setAction] = useState<'donor_approve' | 'donor_reject' | 'recv_approve' | 'recv_reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);
  const navigate = useNavigate();
  const {user} = useAuth();

  const load = () => {
    setLoading(true);
    Promise.all([
      transfersApi.getAll({ status: 'donor_review' }),
      transfersApi.getAll({ status: 'received_awaiting_verification' }),
    ]).then(results => setPending(results.flat()))
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const act = async () => {
    if (!selected || !action) return;
    setActing(true);
    try {
      if (action === 'donor_approve') await transfersApi.donorApproval(selected.id, true, notes);
      else if (action === 'donor_reject') await transfersApi.donorApproval(selected.id, false, notes);
      else if (action === 'recv_approve') await transfersApi.receiverApproval(selected.id, true, notes);
      else if (action === 'recv_reject') await transfersApi.receiverApproval(selected.id, false, notes);
      load(); setAction(null); setNotes(''); setSelected(null);
    } catch (err: any) { alert(err?.response?.data?.detail || 'Action failed'); }
    finally { setActing(false); }
  };

  const donorPending = pending.filter(t => t.status === 'donor_review' && t.donor_hospital_id === user?.hospital_id);
  const recvPending = pending.filter(t => t.status === 'received_awaiting_verification' && t.receiver_hospital_id === user?.hospital_id);

  const renderTransfer = (t: Transfer, type: 'donor' | 'receiver') => (
    <div key={t.id} className={`border rounded-xl p-4 ${type === 'donor' ? 'border-blue-200 bg-blue-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-800">{t.medicine_name}</p>
          <div className="flex items-center gap-1 text-sm text-slate-500 mt-0.5">
            <span>{t.donor_hospital_name}</span><ArrowRight className="h-3 w-3" /><span>{t.receiver_hospital_name}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Batch: <strong>{t.batch_number}</strong> · Qty: <strong>{t.quantity}</strong></p>
          <StatusBadge status={t.status} />
        </div>
        <div className="flex gap-2 ml-2">
          <Button size="sm" onClick={() => navigate(`/transfers/${t.id}`)}>Review / Verify Receipt</Button>
        </div>
      </div>
      <button className="text-xs text-blue-600 hover:underline" onClick={() => navigate(`/transfers/${t.id}`)}>View full details →</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold text-slate-800">Pharmacist Approvals</h2>
        <p className="text-sm text-slate-500">Verify batches and approve or reject transfer requests</p></div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex gap-2">
        <Shield className="h-4 w-4 mt-0.5 shrink-0" />
        <span>All approval decisions are logged with timestamp and pharmacist identity. Approvals here do not replace regulatory or institutional requirements.</span>
      </div>

      <MedicineRequests />
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-blue-50 p-4 text-blue-700"><p className="text-2xl font-bold">{donorPending.length}</p><p className="text-sm font-medium">Awaiting Donor Approval</p></div>
        <div className="rounded-xl bg-emerald-50 p-4 text-emerald-700"><p className="text-2xl font-bold">{recvPending.length}</p><p className="text-sm font-medium">Awaiting Receiver Approval</p></div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title="Donor Pharmacist Approvals" subtitle="Verify batch and approve release">
            {donorPending.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No items pending donor approval</p> :
              <div className="space-y-3">{donorPending.map(t => renderTransfer(t, 'donor'))}</div>}
          </Card>
          <Card title="Receiver Pharmacist Approvals" subtitle="Verify specifications and approve receipt">
            {recvPending.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No items pending receiver approval</p> :
              <div className="space-y-3">{recvPending.map(t => renderTransfer(t, 'receiver'))}</div>}
          </Card>
        </div>
      )}

      <Modal isOpen={action !== null} onClose={() => { setAction(null); setNotes(''); }} title={action?.includes('approve') ? 'Confirm Approval' : 'Confirm Rejection'}
        footer={<><Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button>
          <Button variant={action?.includes('approve') ? 'success' : 'danger'} loading={acting} onClick={act}>
            {action?.includes('approve') ? 'Approve' : 'Reject'}
          </Button></>}>
        <div className="space-y-3">
          {selected && <p className="text-sm text-slate-600">Transfer: <strong>{selected.quantity}</strong> units of <strong>{selected.medicine_name}</strong>, Batch <strong>{selected.batch_number}</strong></p>}
          <Textarea label={action?.includes('approve') ? 'Verification notes (optional)' : 'Reason for rejection *'} value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        </div>
      </Modal>
    </div>
  );
}
