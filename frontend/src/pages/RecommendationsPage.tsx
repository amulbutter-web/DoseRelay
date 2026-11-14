import React, { useEffect, useState } from 'react';
import { Zap, AlertCircle, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { Textarea } from '../components/common/Input';
import { transfersApi } from '../api/transfers';
import type { TransferRecommendation } from '../types';

export default function RecommendationsPage() {
  const [recs, setRecs] = useState<TransferRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState<number | null>(null);
  const [showReject, setShowReject] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    transfersApi.getRecommendations().then(setRecs).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try { const data = await transfersApi.generateRecommendations(); setRecs(data); }
    catch (err: any) { alert(err?.response?.data?.detail || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const handleAccept = async (rec: TransferRecommendation) => {
    setCreating(rec.id);
    try {
      await transfersApi.create({
        recommendation_id: rec.id, donor_hospital_id: rec.donor_hospital_id,
        receiver_hospital_id: rec.receiver_hospital_id, medicine_id: rec.medicine_id,
        batch_id: rec.batch_id, quantity: rec.recommended_quantity,
      });
      alert('Transfer created and sent to MTO for review!');
      load();
    } catch (err: any) { alert(err?.response?.data?.detail || 'Failed to create transfer'); }
    finally { setCreating(null); }
  };

  const handleReject = async (id: number) => {
    try { await transfersApi.rejectRecommendation(id); load(); }
    catch { alert('Failed to reject'); }
    setShowReject(null);
  };

  const priorityColor: Record<string, string> = { high: 'danger', medium: 'warning', low: 'neutral' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-semibold text-slate-800">AI Transfer Recommendations</h2>
          <p className="text-sm text-slate-500">Intelligent matching of surplus hospitals to hospitals with shortages</p></div>
        <Button icon={<Zap className="h-4 w-4" />} onClick={handleGenerate} loading={generating}>Generate Recommendations</Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Recommendations are decision-support suggestions only. All transfers require MTO coordination and pharmacist verification before execution.</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', count: recs.filter(r=>r.status==='pending').length, color: 'bg-amber-50 text-amber-700' },
          { label: 'Accepted', count: recs.filter(r=>r.status==='accepted').length, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Rejected', count: recs.filter(r=>r.status==='rejected').length, color: 'bg-red-50 text-red-700' },
        ].map(s => <div key={s.label} className={`rounded-xl p-4 ${s.color}`}><p className="text-2xl font-bold">{s.count}</p><p className="text-sm font-medium">{s.label}</p></div>)}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
      ) : recs.length === 0 ? (
        <Card><div className="text-center py-10 text-slate-400"><Zap className="h-10 w-10 mx-auto mb-3 text-slate-300" /><p className="font-medium">No recommendations yet</p><p className="text-sm mt-1">Click "Generate Recommendations" to run the AI matching engine.</p></div></Card>
      ) : (
        <div className="space-y-4">
          {recs.map(rec => (
            <div key={rec.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant={priorityColor[rec.priority] as any} dot>{rec.priority.toUpperCase()} Priority</Badge>
                  <StatusBadge status={rec.status} />
                  {rec.warnings && <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200"><AlertCircle className="h-3 w-3" />Warning</span>}
                </div>
                {rec.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="success" icon={<CheckCircle className="h-3 w-3" />} loading={creating === rec.id} onClick={() => handleAccept(rec)}>Accept & Create Transfer</Button>
                    <Button size="sm" variant="danger" icon={<XCircle className="h-3 w-3" />} onClick={() => setShowReject(rec.id)}>Reject</Button>
                  </div>
                )}
              </div>

              {/* Transfer path */}
              <div className="flex items-center gap-3 mb-3 p-3 bg-slate-50 rounded-lg">
                <div className="text-center"><p className="text-xs text-slate-400 mb-0.5">Donor</p><p className="font-semibold text-sm text-slate-700">{rec.donor_hospital_name}</p></div>
                <ArrowRight className="h-5 w-5 text-blue-400 shrink-0" />
                <div className="text-center"><p className="text-xs text-slate-400 mb-0.5">Receiver</p><p className="font-semibold text-sm text-slate-700">{rec.receiver_hospital_name}</p></div>
                <div className="ml-auto text-right"><p className="text-xs text-slate-400">Medicine</p><p className="font-semibold text-sm text-blue-700">{rec.medicine_name}</p></div>
                <div className="text-right"><p className="text-xs text-slate-400">Quantity</p><p className="font-bold text-lg text-slate-800">{rec.recommended_quantity}</p></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">REASON</p>
                  <p className="text-slate-600 text-xs leading-relaxed">{rec.reason}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">ELIGIBILITY</p>
                  <p className="text-slate-600 text-xs leading-relaxed">{rec.eligibility_notes}</p>
                  {rec.expiry_date && <p className="text-xs text-slate-400 mt-1">Batch {rec.batch_number} · Expiry: {rec.expiry_date}</p>}
                </div>
                {rec.warnings && (
                  <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <p className="text-xs text-amber-700 flex items-center gap-1"><AlertCircle className="h-3 w-3" /><strong>Warning:</strong> {rec.warnings}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showReject !== null} onClose={() => setShowReject(null)} title="Reject Recommendation"
        footer={<><Button variant="secondary" onClick={() => setShowReject(null)}>Cancel</Button><Button variant="danger" onClick={() => showReject && handleReject(showReject)}>Reject</Button></>}>
        <p className="text-sm text-slate-600">Are you sure you want to reject this recommendation? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
