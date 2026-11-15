import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Info,
  RefreshCw,
  Zap,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Search,
  Filter,
  Building2,
  MapPin,
  Clock,
  AlertTriangle,
  Send,
  X,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { inventoryApi } from '../api/inventory';
import { transfersApi } from '../api/transfers';
import type { SurplusShortageItem, SuggestedDonor } from '../types';

export default function SurplusShortagesPage() {
  const navigate = useNavigate();

  // Data states
  const [surplus, setSurplus] = useState<SurplusShortageItem[]>([]);
  const [shortages, setShortages] = useState<SurplusShortageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Tabs & filters
  const [activeTab, setActiveTab] = useState<'all' | 'shortages' | 'surplus'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedUrgency, setSelectedUrgency] = useState('all');
  const [selectedDonorStatus, setSelectedDonorStatus] = useState('all');

  // Expanded card rows
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Alert/notification banner
  const [notification, setNotification] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
    link?: string;
    linkText?: string;
  } | null>(null);

  // Modal for direct transfer initiation
  const [transferModal, setTransferModal] = useState<{
    isOpen: boolean;
    shortage: SurplusShortageItem | null;
    donor: SuggestedDonor | null;
    quantity: number;
    submitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    shortage: null,
    donor: null,
    quantity: 0,
    submitting: false,
    error: null,
  });

  const fetchData = async () => {
    try {
      const [s, sh] = await Promise.all([
        inventoryApi.getSurplus(),
        inventoryApi.getShortages(),
      ]);
      setSurplus(s);
      setShortages(sh);
    } catch (err) {
      console.error('Failed to load surplus & shortages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refresh Inventory & Recalculate
  const handleRefreshInventory = async () => {
    setRefreshing(true);
    setNotification(null);
    try {
      await inventoryApi.refreshStatuses();
      await fetchData();
      setNotification({
        type: 'success',
        text: 'Inventory statuses refreshed and surplus/shortages recalculated with live batch and consumption data.',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        text: err?.response?.data?.detail || 'Failed to refresh inventory statuses.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Generate Recommendations
  const handleGenerateRecommendations = async () => {
    setGenerating(true);
    setNotification(null);
    try {
      const recs = await transfersApi.generateRecommendations();
      setNotification({
        type: 'success',
        text: `AI matching engine generated ${recs.length} transfer recommendations for review.`,
        link: '/recommendations',
        linkText: 'View in Recommendations →',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        text: err?.response?.data?.detail || 'Failed to generate recommendations.',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Open Transfer Modal
  const openTransferModal = (shortage: SurplusShortageItem, donor: SuggestedDonor) => {
    const defaultQty = Math.min(shortage.shortage, donor.surplus, donor.available_stock || shortage.shortage);
    setTransferModal({
      isOpen: true,
      shortage,
      donor,
      quantity: Math.max(1, defaultQty),
      submitting: false,
      error: null,
    });
  };

  // Submit direct transfer
  const handleConfirmTransfer = async () => {
    if (!transferModal.shortage || !transferModal.donor) return;
    if (transferModal.quantity <= 0) {
      setTransferModal((m) => ({ ...m, error: 'Transfer quantity must be greater than zero.' }));
      return;
    }
    if (!transferModal.donor.batch_id) {
      setTransferModal((m) => ({ ...m, error: 'Donor hospital has no eligible batch selected.' }));
      return;
    }

    setTransferModal((m) => ({ ...m, submitting: true, error: null }));
    try {
      await transfersApi.create({
        donor_hospital_id: transferModal.donor.hospital_id,
        receiver_hospital_id: transferModal.shortage.hospital_id,
        medicine_id: transferModal.shortage.medicine_id,
        batch_id: transferModal.donor.batch_id,
        quantity: transferModal.quantity,
      });

      setTransferModal((m) => ({ ...m, isOpen: false, submitting: false }));
      setNotification({
        type: 'success',
        text: `Transfer of ${transferModal.quantity} units of ${transferModal.shortage.medicine_name} from ${transferModal.donor.hospital_name} to ${transferModal.shortage.hospital_name} created successfully! Pending MTO review.`,
        link: '/transfers',
        linkText: 'View in Transfers →',
      });
      fetchData();
    } catch (err: any) {
      setTransferModal((m) => ({
        ...m,
        submitting: false,
        error: err?.response?.data?.detail || 'Failed to initiate transfer.',
      }));
    }
  };

  // Toggle item expansion
  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Extract unique filter options
  const allHospitals = useMemo(() => {
    const set = new Set<string>();
    [...surplus, ...shortages].forEach((item) => set.add(item.hospital_name));
    return Array.from(set).sort();
  }, [surplus, shortages]);

  const allLocations = useMemo(() => {
    const set = new Set<string>();
    [...surplus, ...shortages].forEach((item) => {
      if (item.city) set.add(item.city);
    });
    return Array.from(set).sort();
  }, [surplus, shortages]);

  // Filtering function
  const filterList = (items: SurplusShortageItem[], isShortage = false) => {
    return items.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesMed = item.medicine_name.toLowerCase().includes(query);
        const matchesHosp = item.hospital_name.toLowerCase().includes(query);
        const matchesCity = item.city?.toLowerCase().includes(query) ?? false;
        if (!matchesMed && !matchesHosp && !matchesCity) return false;
      }
      // Hospital filter
      if (selectedHospital !== 'all' && item.hospital_name !== selectedHospital) {
        return false;
      }
      // Location filter
      if (selectedLocation !== 'all' && item.city !== selectedLocation) {
        return false;
      }
      // Urgency filter
      if (selectedUrgency !== 'all' && item.urgency !== selectedUrgency) {
        return false;
      }
      // Donor / Status filter
      if (isShortage && selectedDonorStatus !== 'all') {
        const hasDonors = (item.suggested_donors?.length ?? 0) > 0;
        if (selectedDonorStatus === 'has_donors' && !hasDonors) return false;
        if (selectedDonorStatus === 'no_donors' && hasDonors) return false;
      }
      if (!isShortage && selectedDonorStatus === 'near_expiry') {
        if ((item.near_expiry_quantity ?? 0) <= 0) return false;
      }

      return true;
    });
  };

  const filteredShortages = useMemo(() => filterList(shortages, true), [shortages, searchQuery, selectedHospital, selectedLocation, selectedUrgency, selectedDonorStatus]);
  const filteredSurplus = useMemo(() => filterList(surplus, false), [surplus, searchQuery, selectedHospital, selectedLocation, selectedUrgency, selectedDonorStatus]);

  // Key KPI metrics
  const totalShortfallUnits = shortages.reduce((acc, s) => acc + s.shortage, 0);
  const totalSurplusUnits = surplus.reduce((acc, s) => acc + s.surplus, 0);
  const shortagesWithDonors = shortages.filter((s) => (s.suggested_donors?.length ?? 0) > 0).length;
  const criticalShortagesCount = shortages.filter((s) => s.urgency === 'critical').length;
  const nearExpirySurplusCount = surplus.filter((s) => (s.near_expiry_quantity ?? 0) > 0).length;

  const renderUrgencyBadge = (urgency?: string) => {
    switch (urgency) {
      case 'critical':
        return <Badge variant="danger" dot>Critical</Badge>;
      case 'high':
        return <Badge variant="warning" dot>High</Badge>;
      case 'medium':
        return <Badge variant="info">Medium</Badge>;
      default:
        return <Badge variant="neutral">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Surplus & Shortage Analysis</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time multi-hospital inventory balancing, predictive shortfall alerts, and automated donor matching
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />}
            onClick={handleRefreshInventory}
            loading={refreshing}
            title="Recalculate batch statuses and recompute surplus & shortages"
          >
            Refresh & Recalculate
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<Zap className="h-4 w-4 text-amber-300" />}
            onClick={handleGenerateRecommendations}
            loading={generating}
            title="Trigger AI recommendation engine across all surplus and shortage pairs"
          >
            Generate Recommendations
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={<ArrowRight className="h-4 w-4" />}
            onClick={() => navigate('/recommendations')}
          >
            View Recommendations
          </Button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`flex items-start justify-between gap-3 p-4 rounded-xl border text-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-blue-600" />
            )}
            <span>{notification.text}</span>
            {notification.link && (
              <button
                onClick={() => navigate(notification.link!)}
                className="font-semibold underline ml-1.5 hover:opacity-80"
              >
                {notification.linkText || 'Learn more'}
              </button>
            )}
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 rounded-md hover:bg-black/5 text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Mathematical Formulas Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1.5">
          <Info className="h-4 w-4 text-blue-600" />
          <span>Mathematical Verification & Allocation Logic</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-slate-600">
          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <span className="font-semibold text-emerald-700 block mb-0.5">Surplus Formula</span>
            <code>max(0, Available - Forecast(30d) - Safety(14d) - Committed)</code>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <span className="font-semibold text-red-700 block mb-0.5">Shortage Formula</span>
            <code>max(0, Required(30d + 14d) - Available)</code>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
            <span className="font-semibold text-blue-700 block mb-0.5">Days of Cover</span>
            <code>Available Stock ÷ Average Daily Consumption</code>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Shortage Situations</p>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-900 mt-2">{shortages.length}</p>
          <div className="flex items-center justify-between text-xs text-red-700 mt-1">
            <span>{totalShortfallUnits.toLocaleString()} units short</span>
            {criticalShortagesCount > 0 && (
              <span className="font-medium bg-red-200/60 px-1.5 py-0.5 rounded text-red-800">
                {criticalShortagesCount} critical
              </span>
            )}
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Surplus Situations</p>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-2">{surplus.length}</p>
          <div className="flex items-center justify-between text-xs text-emerald-700 mt-1">
            <span>{totalSurplusUnits.toLocaleString()} units available</span>
            {nearExpirySurplusCount > 0 && (
              <span className="font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                {nearExpirySurplusCount} near expiry
              </span>
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Resolvable Shortages</p>
            <Zap className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-2">{shortagesWithDonors}</p>
          <p className="text-xs text-blue-700 mt-1">
            of {shortages.length} shortages have eligible network donors
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">Unmatched Shortages</p>
            <AlertTriangle className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-900 mt-2">
            {shortages.length - shortagesWithDonors}
          </p>
          <p className="text-xs text-purple-700 mt-1">Require external procurement order</p>
        </div>
      </div>

      {/* Tabs and Filters */}
      <Card noPadding>
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 px-4 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'border-[#1e3a5f] text-[#1e3a5f]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            All Analyses
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {surplus.length + shortages.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('shortages')}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'shortages'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <TrendingDown className="h-4 w-4 text-red-500" />
            Shortages & Donor Matching
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {shortages.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('surplus')}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'surplus'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Surplus Inventory
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {surplus.length}
            </span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by medicine, hospital, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
            />
          </div>

          {/* Hospital Filter */}
          <div className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="py-1.5 px-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 text-slate-700"
            >
              <option value="all">All Hospitals</option>
              {allHospitals.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Location / City Filter */}
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="py-1.5 px-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 text-slate-700"
            >
              <option value="all">All Locations</option>
              {allLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Urgency Filter */}
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className="py-1.5 px-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 text-slate-700"
            >
              <option value="all">All Urgency Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Status / Donor Filter */}
          {activeTab !== 'surplus' && (
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={selectedDonorStatus}
                onChange={(e) => setSelectedDonorStatus(e.target.value)}
                className="py-1.5 px-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 text-slate-700"
              >
                <option value="all">All Shortage Types</option>
                <option value="has_donors">With Suggested Donors</option>
                <option value="no_donors">No Donors Available (Critical Gap)</option>
              </select>
            </div>
          )}

          {/* Reset Filters */}
          {(searchQuery || selectedHospital !== 'all' || selectedLocation !== 'all' || selectedUrgency !== 'all' || selectedDonorStatus !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedHospital('all');
                setSelectedLocation('all');
                setSelectedUrgency('all');
                setSelectedDonorStatus('all');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium underline px-1"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">Computing surplus, shortages & matching donors...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SECTION: SHORTAGES */}
              {(activeTab === 'all' || activeTab === 'shortages') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      <h2 className="text-base font-bold text-slate-800">
                        Medicine Shortages & Donor Matching
                      </h2>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                        {filteredShortages.length} items
                      </span>
                    </div>
                  </div>

                  {filteredShortages.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-sm">
                      No shortage situations match the selected filters.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredShortages.map((item) => {
                        const itemKey = `shortage-${item.hospital_id}-${item.medicine_id}`;
                        const isExpanded = expandedItems.has(itemKey);
                        const hasDonors = (item.suggested_donors?.length ?? 0) > 0;

                        return (
                          <div
                            key={itemKey}
                            className={`rounded-xl border transition-all ${
                              item.urgency === 'critical'
                                ? 'border-red-300 bg-red-50/20 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            {/* Shortage Row Header */}
                            <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-base">
                                    {item.medicine_name}
                                  </span>
                                  {renderUrgencyBadge(item.urgency)}
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {item.hospital_name}
                                    {item.city && ` • ${item.city}`}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">{item.reason}</p>
                              </div>

                              {/* Quantitative indicators */}
                              <div className="flex items-center gap-4 text-center shrink-0">
                                <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                  <p className="text-[11px] text-slate-400 font-medium">Available</p>
                                  <p className="text-sm font-semibold text-slate-700">{item.available_stock}</p>
                                </div>

                                <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                  <p className="text-[11px] text-slate-400 font-medium">30d Demand</p>
                                  <p className="text-sm font-semibold text-slate-700">{Math.round(item.forecast_demand)}</p>
                                </div>

                                <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                  <p className="text-[11px] text-slate-400 font-medium">Days Cover</p>
                                  <p className={`text-sm font-bold ${
                                    item.days_of_cover < 7
                                      ? 'text-red-600'
                                      : item.days_of_cover < 14
                                      ? 'text-amber-600'
                                      : 'text-slate-700'
                                  }`}>
                                    {item.days_of_cover === Infinity ? '∞' : `${item.days_of_cover}d`}
                                  </p>
                                </div>

                                <div className="px-3.5 py-1.5 bg-red-50 rounded-lg border border-red-200">
                                  <p className="text-[11px] text-red-600 font-semibold uppercase">Shortfall</p>
                                  <p className="text-base font-extrabold text-red-600">-{item.shortage}</p>
                                </div>

                                <button
                                  onClick={() => toggleExpanded(itemKey)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                                >
                                  {hasDonors ? (
                                    <>
                                      <span>{item.suggested_donors?.length} Donors</span>
                                      <span className="text-blue-600 font-bold">({isExpanded ? 'Hide' : 'View'})</span>
                                    </>
                                  ) : (
                                    <span className="text-red-600 font-medium">No Donors</span>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Suggested Donors Expansion Panel */}
                            {isExpanded && (
                              <div className="border-t border-slate-100 p-4 bg-slate-50/60 rounded-b-xl">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <Zap className="h-3.5 w-3.5 text-blue-600" />
                                    Suggested Donor Hospitals for {item.medicine_name}
                                  </h4>
                                  <span className="text-xs text-slate-500">
                                    Sorted by FEFO (First-Expired, First-Out)
                                  </span>
                                </div>

                                {!hasDonors ? (
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-amber-900 text-xs flex items-start gap-2.5">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                      <strong>No eligible donor hospital is available: </strong>
                                      No other hospital currently reports uncommitted surplus or eligible batches ({'>'}30 days expiry) for this medicine.
                                      <p className="mt-1 text-amber-800">
                                        Recommendation: Place emergency purchase order or initiate procurement directly with regional warehouse.
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {item.suggested_donors!.map((donor) => (
                                      <div
                                        key={donor.hospital_id}
                                        className="bg-white border border-slate-200 rounded-lg p-3 hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between"
                                      >
                                        <div>
                                          <div className="flex items-start justify-between gap-1">
                                            <p className="font-semibold text-slate-900 text-xs truncate" title={donor.hospital_name}>
                                              {donor.hospital_name}
                                            </p>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 shrink-0">
                                              +{donor.surplus} surplus
                                            </span>
                                          </div>

                                          <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                                            {donor.city && (
                                              <div className="flex items-center gap-1 text-slate-500">
                                                <MapPin className="h-3 w-3" />
                                                <span>{donor.city}, {donor.state}</span>
                                              </div>
                                            )}
                                            {donor.batch_number && (
                                              <div>
                                                <span className="text-slate-400">Batch: </span>
                                                <span className="font-mono text-slate-800">{donor.batch_number}</span>
                                              </div>
                                            )}
                                            {donor.expiry_date && (
                                              <div>
                                                <span className="text-slate-400">Expiry: </span>
                                                <span className="font-medium text-slate-800">{donor.expiry_date}</span>
                                                {donor.days_until_expiry !== undefined && (
                                                  <span className="text-slate-400 text-[10px] ml-1">
                                                    ({donor.days_until_expiry}d left)
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
                                          <Button
                                            size="sm"
                                            variant="primary"
                                            icon={<Send className="h-3 w-3" />}
                                            onClick={() => openTransferModal(item, donor)}
                                            className="w-full text-xs"
                                          >
                                            Initiate Transfer
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: SURPLUS */}
              {(activeTab === 'all' || activeTab === 'surplus') && (
                <div className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                      <h2 className="text-base font-bold text-slate-800">
                        Surplus Inventory
                      </h2>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {filteredSurplus.length} items
                      </span>
                    </div>
                  </div>

                  {filteredSurplus.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-sm">
                      No surplus situations match the selected filters.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredSurplus.map((item) => {
                        const itemKey = `surplus-${item.hospital_id}-${item.medicine_id}`;
                        const isNearExpiry = (item.near_expiry_quantity ?? 0) > 0;

                        return (
                          <div
                            key={itemKey}
                            className={`rounded-xl border p-4 transition-all ${
                              isNearExpiry
                                ? 'border-amber-300 bg-amber-50/20'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">
                                    {item.medicine_name}
                                  </span>
                                  {isNearExpiry && (
                                    <Badge variant="warning">
                                      {item.near_expiry_quantity} Expiring Soon
                                    </Badge>
                                  )}
                                  {renderUrgencyBadge(item.urgency)}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                                  <Building2 className="h-3 w-3" />
                                  <span>{item.hospital_name}</span>
                                  {item.city && <span>• {item.city}</span>}
                                </div>
                              </div>

                              <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-sm shrink-0">
                                +{item.surplus} Surplus
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              {item.reason}
                            </p>

                            <div className="grid grid-cols-4 gap-2 text-center mt-3 pt-2 border-t border-slate-100">
                              <div>
                                <p className="text-[10px] text-slate-400">Total Stock</p>
                                <p className="text-xs font-semibold text-slate-800">{item.available_stock}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400">Committed</p>
                                <p className="text-xs font-semibold text-slate-800">{item.committed_stock || 0}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400">30d Demand</p>
                                <p className="text-xs font-semibold text-slate-800">{Math.round(item.forecast_demand)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400">Days Cover</p>
                                <p className="text-xs font-bold text-emerald-600">
                                  {item.days_of_cover === Infinity ? '∞' : `${item.days_of_cover}d`}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Modal: Initiate Transfer Direct Action */}
      <Modal
        isOpen={transferModal.isOpen}
        onClose={() => setTransferModal((m) => ({ ...m, isOpen: false }))}
        title="Initiate Network Transfer"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setTransferModal((m) => ({ ...m, isOpen: false }))}
              disabled={transferModal.submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<Send className="h-4 w-4" />}
              onClick={handleConfirmTransfer}
              loading={transferModal.submitting}
            >
              Confirm & Initiate Transfer
            </Button>
          </>
        }
      >
        {transferModal.shortage && transferModal.donor && (
          <div className="space-y-4 text-sm text-slate-700">
            {transferModal.error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{transferModal.error}</span>
              </div>
            )}

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Medicine:</span>
                <span className="font-bold text-slate-900">{transferModal.shortage.medicine_name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Donor Hospital:</span>
                <span className="font-semibold text-emerald-700">{transferModal.donor.hospital_name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Receiver Hospital:</span>
                <span className="font-semibold text-red-700">{transferModal.shortage.hospital_name}</span>
              </div>
              {transferModal.donor.batch_number && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Batch Number:</span>
                  <span className="font-mono text-slate-800">{transferModal.donor.batch_number}</span>
                </div>
              )}
              {transferModal.donor.expiry_date && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Batch Expiry Date:</span>
                  <span className="text-slate-800">{transferModal.donor.expiry_date}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Transfer Quantity (Units)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={Math.min(transferModal.donor.surplus, transferModal.donor.available_stock || 9999)}
                  value={transferModal.quantity}
                  onChange={(e) => setTransferModal((m) => ({ ...m, quantity: parseInt(e.target.value) || 0 }))}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                />
                <button
                  type="button"
                  onClick={() => setTransferModal((m) => ({ ...m, quantity: transferModal.shortage!.shortage }))}
                  className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                  title="Fill full shortage quantity"
                >
                  Shortage ({transferModal.shortage.shortage})
                </button>
                <button
                  type="button"
                  onClick={() => setTransferModal((m) => ({ ...m, quantity: transferModal.donor!.surplus }))}
                  className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                  title="Fill full donor surplus"
                >
                  Donor Surplus ({transferModal.donor.surplus})
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Shortage shortfall: {transferModal.shortage.shortage} units | Donor surplus: {transferModal.donor.surplus} units.
              </p>
            </div>

            <div className="text-xs text-slate-500 bg-blue-50/60 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Initiating this transfer will create a new transfer request in <strong>Pending MTO Review</strong> stage. Stock at the donor hospital will be reserved upon approval.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
