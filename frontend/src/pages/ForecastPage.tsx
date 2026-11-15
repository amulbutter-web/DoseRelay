import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Zap, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { Select } from '../components/common/Input';
import { forecastsApi } from '../api/forecasts';
import { hospitalsApi } from '../api/hospitals';
import { medicinesApi } from '../api/medicines';
import type { Hospital, Medicine, DemandForecast, ForecastSummary } from '../types';

export default function ForecastPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selHospital, setSelHospital] = useState('');
  const [selMedicine, setSelMedicine] = useState('');
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [summary, setSummary] = useState<ForecastSummary[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    hospitalsApi.getAll().then(setHospitals);
    medicinesApi.getAll().then(setMedicines);
    forecastsApi.getSummaryAll().then(setSummary).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selHospital || !selMedicine) return;
    setGenerating(true);
    try {
      const data = await forecastsApi.generate(Number(selHospital), Number(selMedicine), 30);
      setForecasts(data); setLoaded(true);
    } catch (err: any) { alert(err?.response?.data?.detail || 'Forecast generation failed'); }
    finally { setGenerating(false); }
  };

  const handleView = async () => {
    if (!selHospital || !selMedicine) return;
    setLoading(true);
    try { const data = await forecastsApi.get(Number(selHospital), Number(selMedicine)); setForecasts(data); setLoaded(true); }
    catch { setForecasts([]); }
    finally { setLoading(false); }
  };

  const chartData = forecasts.map(f => ({
    date: f.forecast_date.slice(5),
    forecast: Math.round(f.forecasted_quantity),
    lower: Math.round(f.lower_bound ?? f.forecasted_quantity * 0.7),
    upper: Math.round(f.upper_bound ?? f.forecasted_quantity * 1.3),
  }));

  const mae = forecasts[0]?.mae;
  const rmse = forecasts[0]?.rmse;
  const model = forecasts[0]?.model_used;
  const totalForecast = forecasts.reduce((s, f) => s + f.forecasted_quantity, 0);

  const riskColor: Record<string, string> = { low: 'text-emerald-600', medium: 'text-amber-600', high: 'text-red-500', critical: 'text-red-700' };

  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold text-slate-800">Demand Forecasting</h2><p className="text-sm text-slate-500">AI-powered medicine demand prediction using exponential smoothing</p></div>

      {/* Controls */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Select label="Hospital" value={selHospital} onChange={e => setSelHospital(e.target.value)} options={hospitals.map(h => ({value:String(h.id),label:h.name}))} placeholder="Select hospital" className="w-56" />
          <Select label="Medicine" value={selMedicine} onChange={e => setSelMedicine(e.target.value)} options={medicines.map(m => ({value:String(m.id),label:m.name}))} placeholder="Select medicine" className="w-56" />
          <Button variant="secondary" onClick={handleView} loading={loading}>View Existing</Button>
          <Button icon={<Zap className="h-4 w-4" />} onClick={handleGenerate} loading={generating}>Generate Forecast</Button>
        </div>
        <p className="mt-3 text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Forecasts are estimates based on historical consumption. Performance metrics (MAE, RMSE) are evaluated on a 20% holdout.</p>
      </Card>

      {/* Forecast Chart */}
      {loaded && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="30-Day Demand Forecast" subtitle={`Model: ${model || '—'}`} className="lg:col-span-2">
            {forecasts.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No forecast data. Click "Generate Forecast" first.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="fGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Area type="monotone" dataKey="upper" stroke="none" fill="#bfdbfe" fillOpacity={0.5} name="Upper Bound" />
                  <Area type="monotone" dataKey="lower" stroke="none" fill="white" fillOpacity={1} name="Lower Bound" />
                  <Area type="monotone" dataKey="forecast" stroke="#3b82f6" fill="url(#fGrad)" strokeWidth={2} dot={false} name="Forecast" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Metrics */}
          <div className="space-y-4">
            <Card title="Forecast Metrics">
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Model</span><span className="font-medium capitalize">{model?.replace(/_/g,' ') || '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">MAE</span><span className="font-semibold text-blue-600">{mae?.toFixed(3) ?? '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">RMSE</span><span className="font-semibold text-blue-600">{rmse?.toFixed(3) ?? '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">30-Day Total</span><span className="font-semibold">{Math.round(totalForecast)} units</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Avg Daily</span><span className="font-semibold">{Math.round(totalForecast / 30)} units</span></div>
              </div>
            </Card>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
              <p className="font-semibold mb-1">⚠ Disclaimer</p>
              <p>Forecasts are decision-support estimates only. Clinical and procurement decisions should involve qualified personnel.</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary table */}
      <Card title="Network Forecast Summary" subtitle="All hospitals — stockout risk levels">
        {summary.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No forecast summaries available. Generate forecasts first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                {['Hospital','Medicine','Avg Daily','30d Forecast','Days Cover','Risk'].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {summary.slice(0,20).map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{s.hospital_name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.medicine_name}</td>
                    <td className="px-4 py-2.5">{s.avg_daily_consumption}</td>
                    <td className="px-4 py-2.5 font-medium">{s.forecasted_30d_demand}</td>
                    <td className="px-4 py-2.5">{s.days_of_cover === Infinity ? '∞' : s.days_of_cover}</td>
                    <td className="px-4 py-2.5"><span className={`font-semibold capitalize ${riskColor[s.stockout_risk] || 'text-slate-600'}`}>{s.stockout_risk}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
