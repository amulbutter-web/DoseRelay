import {describeUpdate, TrackingTimeline, WorkflowActions, VerificationEvidence, AuthenticatedQR} from '../components/TransferWorkflow';
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  QrCode,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  ShieldCheck,
  AlertTriangle,
  Package,
  Calendar,
  Building,
  Check,
  X,
  FileText,
  UserCheck,
  ExternalLink,
  Copy,
  Info,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input, { Textarea } from '../components/common/Input';
import { transfersApi } from '../api/transfers';
import { useAuth } from '../contexts/AuthContext';
import type { Transfer, TransferAuditLog } from '../types';

export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [auditLogs, setAuditLogs] = useState<TransferAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);
  const [recvQty, setRecvQty] = useState('');
  const [copied, setCopied] = useState(false);

  // Logistics form state
  const [transporterName, setTransporterName] = useState('ColdChain Express Logistics');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [actualDelivery, setActualDelivery] = useState('');

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const t = await transfersApi.getOne(Number(id));
      setTransfer(t);

      // Initialize logistics form defaults
      if (t.delivery_notes && !notes) {
        setNotes(t.delivery_notes);
      }
      setRecvQty(t.received_quantity ? String(t.received_quantity) : String(t.quantity));

      // Fetch audit logs
      try {
        const logs = await transfersApi.getAuditLogs(Number(id));
        setAuditLogs(logs || []);
      } catch {
        // Fallback logs from transfer metadata if audit-logs table is empty
        setAuditLogs([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(async () => { if (id) { try { const [t,logs] = await Promise.all([transfersApi.getOne(Number(id)),transfersApi.getAuditLogs(Number(id))]); setTransfer(t); setAuditLogs(logs); } catch {} } }, 10000);
    return () => clearInterval(timer);
  }, [id]);

  const handleCopyToken = () => {
    if (!transfer?.qr_code_token) return;
    navigator.clipboard.writeText(transfer.qr_code_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-3">
        <svg className="animate-spin h-9 w-9 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm font-medium text-slate-500">Loading transfer details...</p>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-red-100 max-w-lg mx-auto my-12">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Transfer Record Not Found</h3>
        <p className="text-sm text-slate-500 mt-1 mb-4">Transfer #{id} does not exist or has been removed.</p>
        <Link to="/transfers">
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>Back to Transfers</Button>
        </Link>
      </div>
    );
  }

  // Build combined activity timeline
  const combinedLogs = [...auditLogs];
  if (combinedLogs.length === 0) {
    if (transfer.created_at) {
      combinedLogs.push({
        id: 1,
        action: 'TRANSFER_CREATED',
        details: `Initial transfer requested for ${transfer.quantity} units`,
        user_id: null,
        user_name: 'MTO / System',
        created_at: transfer.created_at,
      });
    }
    if (transfer.donor_approval_at) {
      combinedLogs.push({
        id: 2,
        action: 'DONOR_APPROVED',
        details: transfer.donor_notes || 'Donor pharmacist authorized stock release',
        user_id: transfer.donor_pharmacist_id,
        user_name: transfer.donor_pharmacist_name || 'Donor Pharmacist',
        created_at: transfer.donor_approval_at,
      });
    }
    if (transfer.receiver_approval_at) {
      combinedLogs.push({
        id: 3,
        action: 'RECEIVER_APPROVED',
        details: transfer.receiver_notes || 'Receiver pharmacist approved inbound receipt',
        user_id: transfer.receiver_pharmacist_id,
        user_name: transfer.receiver_pharmacist_name || 'Receiver Pharmacist',
        created_at: transfer.receiver_approval_at,
      });
    }
    if (transfer.dispatch_date) {
      combinedLogs.push({
        id: 4,
        action: 'DISPATCH_RECORDED',
        details: `Dispatched via ${transfer.logistics_personnel_name || 'Assigned Logistics Carrier'}. ${transfer.delivery_notes || ''}`,
        user_id: transfer.logistics_personnel_id,
        user_name: transfer.logistics_personnel_name || 'Logistics Officer',
        created_at: transfer.dispatch_date,
      });
    }
    if (transfer.actual_delivery) {
      combinedLogs.push({
        id: 5,
        action: 'DELIVERY_CONFIRMED',
        details: transfer.delivery_notes || 'Shipment delivered at receiving hospital receiving bay',
        user_id: transfer.logistics_personnel_id,
        user_name: 'Logistics Officer',
        created_at: transfer.actual_delivery,
      });
    }
  }

  // Format date helper
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <p className="text-sm text-slate-500">Request ID: {transfer.request_id || 'Legacy record'} · MTO approval: {transfer.mto_approved_at ? formatDate(transfer.mto_approved_at) : 'Pending'}</p>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/transfers"
            className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors border border-slate-200"
            title="Back to Transfers list"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {transfer.transfer_reference || `Request allocation #${transfer.id}`}
              </h1>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {transfer.medicine_name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Created on {formatDate(transfer.created_at)}
            </p>
            <p className="text-xs text-slate-600 mt-2">{transfer.donor_hospital_name} → {transfer.receiver_hospital_name} · Quantity: {transfer.quantity} · Batch: {transfer.batch_number}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={transfer.status} />
          {transfer.qr_code_token && (
            <Button
              variant="secondary"
              size="sm"
              icon={<QrCode className="h-4 w-4 text-blue-600" />}
              onClick={() => setModal('qr_view')}
            >
              Digital QR Pass
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Rejection or Cancellation Alerts */}
      {['rejected', 'mto_rejected', 'donor_rejected'].includes(transfer.status) && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4 shadow-sm flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-red-900">Transfer Rejected</h4>
            <p className="text-xs text-red-700 mt-1">
              <strong>Reason:</strong> {transfer.rejection_reason || 'Rejection reason was not documented.'}
            </p>
          </div>
        </div>
      )}
      {transfer.status === 'cancelled' && (
        <div className="bg-slate-100 border-l-4 border-slate-500 rounded-xl p-4 shadow-sm flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-slate-800">Transfer Cancelled</h4>
            <p className="text-xs text-slate-600 mt-1">
              <strong>Reason:</strong> {transfer.cancellation_reason || 'Cancellation reason was not documented.'}
            </p>
          </div>
        </div>
      )}

      {/* ── 11-STAGE PROFESSIONAL VISUAL TIMELINE ──────────────────────────────── */}
      <TrackingTimeline transfer={transfer} logs={auditLogs} />
      <VerificationEvidence transfer={transfer} />

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Clinical Specs, Hospitals & Logistics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transfer & Medicine Specifications */}
          <Card title="Transfer Specifications">
            <div className="space-y-4">
              {/* Medicine & Batch Hero */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{transfer.medicine_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">Batch:</span>
                      <code className="text-xs bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-700">
                        {transfer.batch_number || 'N/A'}
                      </code>
                      {transfer.expiry_date && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 font-medium">
                          Expires: {transfer.expiry_date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:pl-4 border-slate-200">
                  <p className="text-xs text-slate-400 font-medium uppercase">Authorized Quantity</p>
                  <p className="text-2xl font-black text-slate-900">
                    {transfer.quantity} <span className="text-sm font-semibold text-slate-500">units</span>
                  </p>
                </div>
              </div>

              {/* Route: Donor to Receiver */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
                    <Building className="h-4 w-4" /> Donor Hospital (Source)
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">{transfer.donor_hospital_name}</h4>
                  <p className="text-xs text-slate-500 mt-1">Hospital ID: #{transfer.donor_hospital_id}</p>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Donor Pharmacist:</span>
                    <span className="font-medium text-slate-700">
                      {transfer.donor_pharmacist_name || 'Pending assignment'}
                    </span>
                  </div>
                  {transfer.donor_notes && (
                    <div className="mt-2 text-xs bg-slate-50 p-2 rounded text-slate-600 italic">
                      "{transfer.donor_notes}"
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-2">
                    <Building className="h-4 w-4" /> Receiver Hospital (Destination)
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">{transfer.receiver_hospital_name}</h4>
                  <p className="text-xs text-slate-500 mt-1">Hospital ID: #{transfer.receiver_hospital_id}</p>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Receiver Pharmacist:</span>
                    <span className="font-medium text-slate-700">
                      {transfer.receiver_pharmacist_name || 'Pending assignment'}
                    </span>
                  </div>
                  {transfer.receiver_notes && (
                    <div className="mt-2 text-xs bg-slate-50 p-2 rounded text-slate-600 italic">
                      "{transfer.receiver_notes}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Logistics & Tracking Metadata */}
          <Card
            title="Logistics & Chain of Custody"
            subtitle="Manual shipment updates and timestamp records"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 font-medium block mb-1">MTO Reviewer</span>
                <span className="font-semibold text-slate-800">
                  {transfer.mto_name || (transfer.mto_id ? `MTO #${transfer.mto_id}` : 'Pending')}
                </span>
                {transfer.mto_notes && (
                  <p className="text-xs text-slate-500 mt-1 italic">Note: {transfer.mto_notes}</p>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 font-medium block mb-1">Assigned Transporter / Carrier</span>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">
                    {transfer.logistics_personnel_name || 'ColdChain Logistics Service'}
                  </span>
                </div>
                {transfer.delivery_notes && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{describeUpdate(transfer.delivery_notes)}</p>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 font-medium block mb-1">Dispatch Date & Time</span>
                <span className="font-semibold text-slate-800">{formatDate(transfer.dispatch_date)}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 font-medium block mb-1">Estimated Delivery</span>
                <span className="font-semibold text-slate-800">{formatDate(transfer.estimated_delivery)}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 font-medium block mb-1">Actual Delivery</span>
                <span className="font-semibold text-slate-800">{formatDate(transfer.actual_delivery)}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 font-medium block mb-1">Receipt Verification</span>
                <div className="flex items-center gap-2">
                  {transfer.receipt_verified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                      <CheckCircle className="h-4 w-4 text-emerald-500" /> Verified ({transfer.received_quantity} units)
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs font-medium">Pending intake verification</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Activity / Audit Logs */}
          <Card title="Activity & Audit Trail" subtitle="Timestamped workflow activity">
            {combinedLogs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No activity records logged yet.</p>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {combinedLogs.map((log, i) => (
                  <div key={log.id || i} className="relative flex items-start gap-4 pl-1">
                    <div className="h-6 w-6 rounded-full bg-blue-100 border-2 border-white text-blue-600 flex items-center justify-center shrink-0 z-10 shadow-xs">
                      <Clock className="h-3 w-3" />
                    </div>
                    <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">{log.action.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-slate-400">{formatDate(log.created_at)}</span>
                      </div>
                      <p className="text-slate-600 mt-1">{describeUpdate(log.details)}</p>
                      <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                        <UserCheck className="h-3 w-3" /> {log.user_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right 1 Column: Role-Based Action Center & Digital QR Pass */}
        <div className="space-y-6">
          {/* Action Center */}
          <WorkflowActions transfer={transfer} reload={loadData} />

          {/* Digital QR Pass Widget */}
          <Card title="Digital QR Transfer Pass" subtitle="Scan on-site for instant chain-of-custody verification">
            {transfer.qr_code_token ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center">
                  <AuthenticatedQR id={transfer.id} />
                  <p className="text-xs font-semibold text-slate-700 mt-2">DoseRelay Secure Pass</p>
                  <p className="text-[10px] text-slate-400">Scan at receiving dock with any camera</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Pass Token:</span>
                    <button
                      onClick={handleCopyToken}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <code className="text-xs bg-slate-100 p-2 rounded-lg block font-mono text-slate-700 break-all select-all">
                    {transfer.qr_code_token}
                  </code>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  onClick={() => setModal('qr_view')}
                >
                  Open High-Res Print View
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <QrCode className="h-8 w-8 mx-auto mb-1 text-slate-300" />
                <p className="text-xs font-medium text-slate-600">QR Pass Not Yet Generated</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Generated automatically once all clinical approvals are granted.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 12. Full-Size QR Modal */}
      <Modal
        isOpen={modal === 'qr_view'}
        onClose={() => setModal(null)}
        title="DoseRelay Digital Transfer Pass"
        footer={<Button variant="secondary" onClick={() => setModal(null)}>Close Pass</Button>}
      >
        <div className="flex flex-col items-center justify-center p-4 text-center space-y-4">
          <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-md">
            <AuthenticatedQR id={transfer.id} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{transfer.transfer_reference || `Request allocation #${transfer.id}`}</h3>
            <p className="text-xs text-slate-500 font-medium">
              {transfer.medicine_name} · {transfer.quantity} Units · Batch {transfer.batch_number}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {transfer.donor_hospital_name} → {transfer.receiver_hospital_name}
            </p>
          </div>

          <div className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 text-left">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Verification URL</span>
            <div className="flex items-center justify-between text-xs text-slate-700 font-mono mt-0.5 break-all">
              <span>{window.location.origin}/transfer/verify/{transfer.qr_code_token?.slice(0, 16)}...</span>
              <button onClick={handleCopyToken} className="text-blue-600 font-sans ml-2 text-xs font-semibold shrink-0">
                {copied ? 'Copied!' : 'Copy Token'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
