import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, QrCode, CheckCircle, XCircle } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { Textarea } from '../components/common/Input';
import { transfersApi } from '../api/transfers';
import { useAuth } from '../contexts/AuthContext';
import type { Transfer } from '../types';

const WORKFLOW_STEPS = [
  { status: 'pending_mto_review', label: 'MTO Review' },
  { status: 'awaiting_donor_approval', label: 'Donor Approval' },
  { status: 'awaiting_receiver_approval', label: 'Receiver Approval' },
  { status: 'approved', label: 'Approved' },
  { status: 'ready_for_dispatch', label: 'Ready' },
  { status: 'dispatched', label: 'Dispatched' },
  { status: 'in_transit', label: 'In Transit' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'receipt_verified', label: 'Verified' },
  { status: 'completed', label: 'Completed' },
];

const STATUS_ORDER = WORKFLOW_STEPS.map(s => s.status);

export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, hasRole } = useAuth();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);
  const [recvQty, setRecvQty] = useState('');

  const load = () => {
    if (!id) return;
    setLoading(true);
    transfersApi.getOne(Number(id)).then(setTransfer).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const act = async (action: () => Promise<Transfer>) => {
    setActing(true);
    try { const t = await action(); setTransfer(t); setModal(null); setNotes(''); setRecvQty(''); }
    catch (err: any) { alert(err?.response?.data?.detail || 'Action failed'); }
    finally { setActing(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>;
  if (!transfer) return <div className="p-4 text-red-500">Transfer not found.</div>;

  const currentIdx = STATUS_ORDER.indexOf(transfer.status);
  const isTerminal = ['completed','rejected','cancelled'].includes(transfer.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/transfers" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Transfer #{transfer.id}</h2>
          <p className="text-xs text-slate-400">Created {new Date(transfer.created_at).toLocaleString('en-IN')}</p>
        </div>
        <div className="ml-auto"><StatusBadge status={transfer.status} /></div>
      </div>

      {/* Workflow stepper */}
      {!isTerminal && (
        <Card title="Transfer Progress">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {WORKFLOW_STEPS.map((step, i) => {
              const done = currentIdx > i;
              const active = currentIdx === i;
              return (
                <React.Fragment key={step.status}>
                  <div className={`flex flex-col items-center min-w-[64px] ${active ? 'opacity-100' : done ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-blue-600 text-white ring-4 ring-blue-100' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <p className="text-[9px] text-center mt-1 text-slate-500 leading-tight">{step.label}</p>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && <div className={`h-0.5 flex-1 min-w-[8px] ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </Card>
      )}

      {transfer.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700"><strong>Rejected:</strong> {transfer.rejection_reason || 'No reason provided'}</div>
      )}
      {transfer.status === 'cancelled' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600"><strong>Cancelled:</strong> {transfer.cancellation_reason || 'No reason provided'}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfer Info */}
        <Card title="Transfer Details">
          <div className="space-y-3 text-sm">
            <Row label="Medicine" value={transfer.medicine_name} />
            <Row label="Batch #" value={<code className="bg-slate-100 px-2 py-0.5 rounded text-xs">{transfer.batch_number}</code>} />
            <Row label="Quantity" value={<span className="font-bold text-lg">{transfer.quantity}</span>} />
            <div className="flex items-center gap-2 py-2 border-t border-b border-slate-100">
              <div className="text-center flex-1"><p className="text-xs text-slate-400">Donor</p><p className="font-semibold text-slate-700">{transfer.donor_hospital_name}</p></div>
              <ArrowRight className="h-5 w-5 text-blue-400" />
              <div className="text-center flex-1"><p className="text-xs text-slate-400">Receiver</p><p className="font-semibold text-slate-700">{transfer.receiver_hospital_name}</p></div>
            </div>
            {transfer.mto_notes && <Row label="MTO Notes" value={transfer.mto_notes} />}
            {transfer.donor_notes && <Row label="Donor Pharmacist" value={transfer.donor_notes} />}
            {transfer.receiver_notes && <Row label="Receiver Pharmacist" value={transfer.receiver_notes} />}
            {transfer.dispatch_date && <Row label="Dispatched" value={new Date(transfer.dispatch_date).toLocaleString('en-IN')} />}
            {transfer.actual_delivery && <Row label="Delivered" value={new Date(transfer.actual_delivery).toLocaleString('en-IN')} />}
            {transfer.received_quantity != null && <Row label="Received Qty" value={<span className="font-bold text-emerald-600">{transfer.received_quantity}</span>} />}
          </div>
        </Card>

        {/* Actions + QR */}
        <div className="space-y-4">
          {/* QR Code */}
          {transfer.qr_code_token && (
            <Card title="QR Transfer Code">
              <div className="flex items-center gap-4">
                <img src={`/api/v1/transfers/${transfer.id}/qr-code`} alt="QR Code" className="h-28 w-28 border border-slate-200 rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                <div>
                  <p className="text-xs text-slate-500 mb-1">Scan to verify transfer</p>
                  <code className="text-xs text-slate-400 break-all">{transfer.qr_code_token.slice(0, 16)}…</code>
                </div>
              </div>
            </Card>
          )}

          {/* Action buttons */}
          {!isTerminal && (
            <Card title="Actions">
              <div className="flex flex-col gap-2">
                {transfer.status === 'pending_mto_review' && hasRole('mto','network_admin') && (
                  <>
                    <Button icon={<CheckCircle className="h-4 w-4" />} variant="success" onClick={() => setModal('mto_approve')}>MTO Approve</Button>
                    <Button icon={<XCircle className="h-4 w-4" />} variant="danger" onClick={() => setModal('mto_reject')}>MTO Reject</Button>
                  </>
                )}
                {transfer.status === 'awaiting_donor_approval' && hasRole('pharmacist','network_admin') && (
                  <>
                    <Button variant="success" onClick={() => setModal('donor_approve')}>Donor: Approve Release</Button>
                    <Button variant="danger" onClick={() => setModal('donor_reject')}>Donor: Reject</Button>
                  </>
                )}
                {transfer.status === 'awaiting_receiver_approval' && hasRole('pharmacist','network_admin') && (
                  <>
                    <Button variant="success" onClick={() => setModal('recv_approve')}>Receiver: Approve Receipt</Button>
                    <Button variant="danger" onClick={() => setModal('recv_reject')}>Receiver: Reject</Button>
                  </>
                )}
                {transfer.status === 'approved' && hasRole('logistics','mto','network_admin') && (
                  <Button onClick={() => act(() => transfersApi.updateStatus(transfer.id, 'ready_for_dispatch'))}>Mark Ready for Dispatch</Button>
                )}
                {transfer.status === 'ready_for_dispatch' && hasRole('logistics','mto','network_admin') && (
                  <Button onClick={() => act(() => transfersApi.updateStatus(transfer.id, 'dispatched'))}>Mark Dispatched</Button>
                )}
                {transfer.status === 'dispatched' && hasRole('logistics','mto','network_admin') && (
                  <Button onClick={() => act(() => transfersApi.updateStatus(transfer.id, 'in_transit'))}>Mark In Transit</Button>
                )}
                {transfer.status === 'in_transit' && hasRole('logistics','mto','network_admin') && (
                  <Button onClick={() => act(() => transfersApi.updateStatus(transfer.id, 'delivered'))}>Mark Delivered</Button>
                )}
                {transfer.status === 'delivered' && hasRole('pharmacist','network_admin') && (
                  <Button variant="success" onClick={() => setModal('receipt')}>Verify Receipt</Button>
                )}
                {transfer.status === 'receipt_verified' && hasRole('mto','network_admin') && (
                  <Button variant="success" onClick={() => act(() => transfersApi.updateStatus(transfer.id, 'completed'))}>Complete Transfer</Button>
                )}
                {!['completed','rejected','cancelled'].includes(transfer.status) && (
                  <Button variant="danger" onClick={() => setModal('cancel')}>Cancel Transfer</Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={modal === 'mto_approve'} onClose={() => setModal(null)} title="MTO Approval"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="success" loading={acting} onClick={() => act(() => transfersApi.mtoReview(transfer.id, true, notes))}>Approve</Button></>}>
        <Textarea label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </Modal>
      <Modal isOpen={modal === 'mto_reject'} onClose={() => setModal(null)} title="MTO Rejection"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" loading={acting} onClick={() => act(() => transfersApi.mtoReview(transfer.id, false, notes))}>Reject</Button></>}>
        <Textarea label="Reason for rejection *" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </Modal>
      <Modal isOpen={modal === 'donor_approve'} onClose={() => setModal(null)} title="Donor Pharmacist Approval"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="success" loading={acting} onClick={() => act(() => transfersApi.donorApproval(transfer.id, true, notes))}>Approve Release</Button></>}>
        <Textarea label="Verification notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </Modal>
      <Modal isOpen={modal === 'donor_reject'} onClose={() => setModal(null)} title="Reject Release"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" loading={acting} onClick={() => act(() => transfersApi.donorApproval(transfer.id, false, notes))}>Reject</Button></>}>
        <Textarea label="Reason" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </Modal>
      <Modal isOpen={modal === 'recv_approve'} onClose={() => setModal(null)} title="Receiver Pharmacist Approval"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="success" loading={acting} onClick={() => act(() => transfersApi.receiverApproval(transfer.id, true, notes))}>Approve</Button></>}>
        <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </Modal>
      <Modal isOpen={modal === 'recv_reject'} onClose={() => setModal(null)} title="Reject Receipt"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" loading={acting} onClick={() => act(() => transfersApi.receiverApproval(transfer.id, false, notes))}>Reject</Button></>}>
        <Textarea label="Reason" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </Modal>
      <Modal isOpen={modal === 'receipt'} onClose={() => setModal(null)} title="Verify Receipt"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="success" loading={acting} onClick={() => act(() => transfersApi.verifyReceipt(transfer.id, Number(recvQty), notes))}>Confirm Receipt</Button></>}>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Received Quantity *</label>
          <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={recvQty} onChange={e => setRecvQty(e.target.value)} min="0" max={transfer.quantity} />
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>
      </Modal>
      <Modal isOpen={modal === 'cancel'} onClose={() => setModal(null)} title="Cancel Transfer"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Back</Button><Button variant="danger" loading={acting} onClick={() => act(() => transfersApi.updateStatus(transfer.id, 'cancelled', notes))}>Cancel Transfer</Button></>}>
        <Textarea label="Reason for cancellation" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-slate-400 font-medium w-32 shrink-0 mt-0.5">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}
