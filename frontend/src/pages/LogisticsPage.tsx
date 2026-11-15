import {WorkflowActions} from '../components/TransferWorkflow';
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Truck,
  MapPin,
  ArrowRight,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Package,
  Search,
  Filter,
  RefreshCw,
  FileText,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Check,
  Building,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input, { Textarea } from '../components/common/Input';
import { transfersApi } from '../api/transfers';
import { useAuth } from '../contexts/AuthContext';
import type { Transfer } from '../types';

const PRESET_CARRIERS = [
  'MediCold Inter-Hospital Logistics',
  'HealthFleet Express Courier',
  'BlueDart LifeSciences ColdChain',
  'Govt District Health Transport #4',
  'National Red Cross Medical Transit',
  'QuickCare Secure Courier',
];

export default function LogisticsPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states for modals
  const [carrierName, setCarrierName] = useState(PRESET_CARRIERS[0]);
  const [customCarrier, setCustomCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchDateTime, setDispatchDateTime] = useState('');
  const [estDeliveryDateTime, setEstDeliveryDateTime] = useState('');
  const [actualDeliveryDateTime, setActualDeliveryDateTime] = useState('');
  const [notes, setNotes] = useState('');

  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const all = await transfersApi.getAll();
      // Keep transfers that are relevant to logistics operations
      const relevant = all.filter(t =>
        !!t.mto_id && !!t.qr_code_token && !!t.donor_approval_at && ['final_approved', 'ready_for_dispatch', 'dispatched', 'in_transit', 'delivered', 'received_awaiting_verification', 'completed'].includes(t.status)
      );
      setTransfers(relevant);
    } catch (err) {
      console.error('Failed to load logistics shipments:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => loadData(true), 10000);
    return () => clearInterval(timer);
  }, []);

  // Compute Metrics: Total assigned, pending dispatches, in-transit, delivered, delayed
  const metrics = useMemo(() => {
    const now = new Date();

    const pendingDispatches = transfers.filter(t =>
      ['final_approved', 'ready_for_dispatch'].includes(t.status)
    );

    const inTransit = transfers.filter(t =>
      ['dispatched', 'in_transit'].includes(t.status)
    );

    const delivered = transfers.filter(t =>
      ['delivered', 'received_awaiting_verification', 'completed'].includes(t.status)
    );

    const delayed = transfers.filter(t => {
      if (['delivered', 'received_awaiting_verification', 'completed', 'cancelled', 'rejected'].includes(t.status)) {
        return false;
      }
      if (!t.estimated_delivery) return false;
      return new Date(t.estimated_delivery) < now;
    });

    const totalAssigned = transfers.filter(t =>
      !['cancelled', 'rejected'].includes(t.status)
    );

    return {
      totalAssigned: totalAssigned.length,
      pendingDispatches: pendingDispatches.length,
      inTransit: inTransit.length,
      delivered: delivered.length,
      delayed: delayed.length,
    };
  }, [transfers]);

  // Helper to parse carrier name and tracking info from delivery_notes or logistics metadata
  const parseTransporter = (t: Transfer) => {
    if (t.delivery_notes) {
      try {
        const details = JSON.parse(t.delivery_notes);
        if (details.transporter) return {carrier: details.transporter, tracking: details.tracking_reference || null};
      } catch { /* Historical notes use a text format. */ }
      const carrierMatch = t.delivery_notes.match(/(?:Carrier|Transporter):\s*([^|;\n]+)/i);
      const trackingMatch = t.delivery_notes.match(/(?:Tracking|Vehicle):\s*([^|;\n]+)/i);
      if (carrierMatch) {
        return {
          carrier: carrierMatch[1].trim(),
          tracking: trackingMatch ? trackingMatch[1].trim() : null,
        };
      }
    }
    return {
      carrier: t.logistics_personnel_name || 'Not yet assigned',
      tracking: null,
    };
  };

  // Filter transfers based on search & tab filter
  const filteredTransfers = useMemo(() => {
    const now = new Date();
    return transfers.filter(t => {
      // Status filter
      if (statusFilter === 'pending' && !['final_approved', 'ready_for_dispatch'].includes(t.status)) return false;
      if (statusFilter === 'in_transit' && !['dispatched', 'in_transit'].includes(t.status)) return false;
      if (statusFilter === 'delivered' && !['delivered', 'received_awaiting_verification', 'completed'].includes(t.status)) return false;
      if (statusFilter === 'delayed') {
        if (['delivered', 'received_awaiting_verification', 'completed'].includes(t.status)) return false;
        if (!t.estimated_delivery || new Date(t.estimated_delivery) >= now) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const medName = t.medicine_name?.toLowerCase() || '';
        const batchNum = t.batch_number?.toLowerCase() || '';
        const donor = t.donor_hospital_name?.toLowerCase() || '';
        const receiver = t.receiver_hospital_name?.toLowerCase() || '';
        const idStr = `${t.id} ${t.request_id || ''} ${t.transfer_reference || ''}`.toLowerCase();
        const carrierInfo = parseTransporter(t).carrier.toLowerCase();

        return (
          medName.includes(query) ||
          batchNum.includes(query) ||
          donor.includes(query) ||
          receiver.includes(query) ||
          idStr.includes(query) ||
          carrierInfo.includes(query)
        );
      }
      return true;
    });
  }, [transfers, statusFilter, searchTerm]);

  // Date formatter
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <Truck className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">ORDERS READY FOR LOGISTICS</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch management, carrier assignments, manual shipment updates, and delivery handover control
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            loading={refreshing}
            icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={() => loadData(true)}
          >
            Refresh Data
          </Button>
          <Link to="/transfers">
            <Button variant="secondary" size="sm" icon={<ArrowRight className="h-4 w-4" />}>
              All Transfers
            </Button>
          </Link>
        </div>
      </div>

      {/* Clean Simulation Notice Banner */}
      <div className="bg-blue-50/70 border border-blue-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-700 shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                Dispatch Protocol
              </span>
              <span className="text-[10px] font-semibold bg-blue-200/80 text-blue-800 px-2 py-0.5 rounded-full">
                Manual Updates
              </span>
            </div>
            <p className="text-xs text-blue-800/90 mt-0.5">
              Only final MTO-approved orders are shown. Open Track Order to record dispatch, transit and delivery updates. No live GPS is connected.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row: Total assigned, pending dispatches, in-transit, delivered, delayed */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-blue-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Assigned</span>
            <Package className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{metrics.totalAssigned}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Under logistics purview</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-amber-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Pending Dispatches</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-900 mt-2">{metrics.pendingDispatches}</p>
          <p className="text-[11px] text-amber-700/80 mt-0.5">Approved or packing</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-purple-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">In-Transit</span>
            <Truck className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-900 mt-2">{metrics.inTransit}</p>
          <p className="text-[11px] text-purple-700/80 mt-0.5">En route to hospitals</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Delivered</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-2">{metrics.delivered}</p>
          <p className="text-[11px] text-emerald-700/80 mt-0.5">Arrived at dock / verified</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-red-200 transition-all col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Delayed</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-black text-red-900 mt-2">{metrics.delayed}</p>
          <p className="text-[11px] text-red-600/80 mt-0.5">Exceeded expected ETA</p>
        </div>
      </div>

      {/* Main Shipments Table Card */}
      <Card
        title="Active Medicine Shipments"
        subtitle="Manage assigned transporters, dispatch scheduling, and physical deliveries"
      >
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by medicine, batch #, hospital, ID, or carrier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 p-1 rounded-xl shrink-0">
            {[
              { id: 'all', label: `All (${transfers.length})` },
              { id: 'pending', label: `Pending Dispatch (${metrics.pendingDispatches})` },
              { id: 'in_transit', label: `In Transit (${metrics.inTransit})` },
              { id: 'delivered', label: `Delivered (${metrics.delivered})` },
              { id: 'delayed', label: `Delayed (${metrics.delayed})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content: Transfer ID, Medicine, Batch, Qty, Donor, Receiver, Assigned Transporter, Dispatch Date, Expected Delivery, Status */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs text-slate-500 font-medium">Loading logistics ledger...</p>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Truck className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <h4 className="text-sm font-bold text-slate-700">No Shipments Match Filter</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {searchTerm
                ? 'Try adjusting your search criteria or resetting filters.'
                : 'There are currently no shipments under the selected logistics status.'}
            </p>
            {(searchTerm || statusFilter !== 'all') && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">Transfer ID</th>
                  <th className="py-3 px-3">Request ID / MTO Approval</th><th className="py-3 px-3">Medicine</th>
                  <th className="py-3 px-3">Batch</th>
                  <th className="py-3 px-2 text-right">Qty</th>
                  <th className="py-3 px-3">Donor</th>
                  <th className="py-3 px-3">Receiver</th>
                  <th className="py-3 px-3">Assigned Transporter</th>
                  <th className="py-3 px-3">Dispatch Date</th>
                  <th className="py-3 px-3">Expected Delivery</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransfers.map((t) => {
                  const transporter = parseTransporter(t);
                  const isDelayed =
                    t.estimated_delivery &&
                    !['delivered', 'received_awaiting_verification', 'completed'].includes(t.status) &&
                    new Date(t.estimated_delivery) < new Date();

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Transfer ID */}
                      <td className="py-3 px-3 font-semibold whitespace-nowrap">
                        <Link
                          to={`/transfers/${t.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                        >
                          {t.transfer_reference || `#${t.id}`}
                        </Link>
                      </td>

                      <td className="py-3 px-3 text-xs">{t.request_id}<br />{formatDate(t.mto_approved_at)}</td>
                      {/* 2. Medicine */}
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {t.medicine_name}
                      </td>

                      {/* 3. Batch */}
                      <td className="py-3 px-3">
                        <code className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {t.batch_number || 'N/A'}
                        </code>
                      </td>

                      {/* 4. Quantity */}
                      <td className="py-3 px-2 text-right whitespace-nowrap font-bold text-slate-800">
                        {t.quantity} <span className="font-normal text-slate-400 text-[10px]">units</span>
                      </td>

                      {/* 5. Donor */}
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        <span className="truncate max-w-[120px] block" title={t.donor_hospital_name}>
                          {t.donor_hospital_name}
                        </span>
                      </td>

                      {/* 6. Receiver */}
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        <span className="truncate max-w-[120px] block" title={t.receiver_hospital_name}>
                          {t.receiver_hospital_name}
                        </span>
                      </td>

                      {/* 7. Assigned Transporter */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span
                            className={`font-medium ${
                              transporter.carrier === 'Unassigned'
                                ? 'text-amber-600 italic'
                                : 'text-slate-800'
                            }`}
                          >
                            {transporter.carrier}
                          </span>
                        </div>
                        {transporter.tracking && (
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            {transporter.tracking}
                          </span>
                        )}
                      </td>

                      {/* 8. Dispatch Date */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                        {formatDate(t.dispatch_date)}
                      </td>

                      {/* 9. Expected Delivery */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-slate-700">{formatDate(t.estimated_delivery)}</div>
                        {isDelayed && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded mt-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> Delayed
                          </span>
                        )}
                      </td>

                      {/* 10. Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <StatusBadge status={t.status} />
                      </td>

                      {/* 11. Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Primary Stage Transition Buttons */}
                          <Button
                            size="sm"
                            variant="secondary"
                            className="px-2"
                            title="Open Transfer Details"
                            onClick={() => navigate(`/transfers/${t.id}`)}
                          >
                            <ExternalLink className="h-3 w-3 text-slate-500" /> Track Order
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}
