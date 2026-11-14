import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, ArrowRight, Calendar } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import { transfersApi } from '../api/transfers';
import type { Transfer } from '../types';

export default function LogisticsPage() {
  const [shipments, setShipments] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([
      transfersApi.getAll({ status: 'ready_for_dispatch' }),
      transfersApi.getAll({ status: 'dispatched' }),
      transfersApi.getAll({ status: 'in_transit' }),
      transfersApi.getAll({ status: 'delivered' }),
    ]).then(res => setShipments(res.flat()))
      .catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const advance = async (t: Transfer) => {
    const nextMap: Record<string, string> = {
      ready_for_dispatch: 'dispatched',
      dispatched: 'in_transit',
      in_transit: 'delivered',
    };
    const next = nextMap[t.status];
    if (!next) return;
    try { await transfersApi.updateStatus(t.id, next); load(); }
    catch (err: any) { alert(err?.response?.data?.detail || 'Failed'); }
  };

  const advanceLabel: Record<string, string> = {
    ready_for_dispatch: 'Mark Dispatched',
    dispatched: 'Mark In Transit',
    in_transit: 'Mark Delivered',
  };

  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold text-slate-800">Logistics Management</h2>
        <p className="text-sm text-slate-500">Track and update shipment status</p></div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
        Note: Delivery timelines are estimates. Live GPS tracking is not available in this demo environment.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['ready_for_dispatch','dispatched','in_transit','delivered'].map(s => (
          <div key={s} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xl font-bold text-slate-800">{shipments.filter(t=>t.status===s).length}</p>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">{s.replace(/_/g,' ')}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
      ) : shipments.length === 0 ? (
        <Card><div className="text-center py-8 text-slate-400"><Truck className="h-10 w-10 mx-auto mb-2 text-slate-300" /><p>No active shipments</p></div></Card>
      ) : (
        <div className="space-y-4">
          {shipments.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-800">{t.medicine_name} · <span className="text-blue-600">{t.quantity} units</span></p>
                  <code className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{t.batch_number}</code>
                </div>
                <StatusBadge status={t.status} />
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="font-medium">{t.donor_hospital_name}</span>
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="font-medium">{t.receiver_hospital_name}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-500 mb-3">
                {t.dispatch_date && <div><p className="font-medium text-slate-600">Dispatched</p>{new Date(t.dispatch_date).toLocaleString('en-IN')}</div>}
                {t.estimated_delivery && <div><p className="font-medium text-slate-600">Est. Delivery</p>{new Date(t.estimated_delivery).toLocaleString('en-IN')}</div>}
                {t.actual_delivery && <div><p className="font-medium text-slate-600">Actual Delivery</p>{new Date(t.actual_delivery).toLocaleString('en-IN')}</div>}
              </div>

              <div className="flex gap-2">
                {advanceLabel[t.status] && (
                  <Button size="sm" icon={<Truck className="h-3 w-3" />} onClick={() => advance(t)}>{advanceLabel[t.status]}</Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => navigate(`/transfers/${t.id}`)}>View Details</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
