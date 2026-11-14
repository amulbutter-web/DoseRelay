import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import Card from '../components/common/Card';
import DataTable from '../components/common/DataTable';
import { inventoryApi } from '../api/inventory';
import type { SurplusShortageItem } from '../types';

export default function SurplusShortagesPage() {
  const [surplus, setSurplus] = useState<SurplusShortageItem[]>([]);
  const [shortages, setShortages] = useState<SurplusShortageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([inventoryApi.getSurplus(), inventoryApi.getShortages()])
      .then(([s, sh]) => { setSurplus(s); setShortages(sh); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const surplusColumns = [
    { key: 'hospital_name', label: 'Hospital', sortable: true },
    { key: 'medicine_name', label: 'Medicine', sortable: true },
    { key: 'available_stock', label: 'Available', render: (r: SurplusShortageItem) => <span className="font-semibold text-emerald-600">{r.available_stock}</span> },
    { key: 'days_of_cover', label: 'Days Cover', render: (r: SurplusShortageItem) => <span className="font-medium">{r.days_of_cover === Infinity ? '∞' : r.days_of_cover}</span> },
    { key: 'forecast_demand', label: '30d Forecast', render: (r: SurplusShortageItem) => Math.round(r.forecast_demand) },
    { key: 'surplus', label: 'Surplus Units', render: (r: SurplusShortageItem) => (
      <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{r.surplus}</span>
    )},
    { key: 'reason', label: 'Reason', render: (r: SurplusShortageItem) => <span className="text-xs text-slate-500 max-w-xs block truncate" title={r.reason}>{r.reason}</span> },
  ];

  const shortageColumns = [
    { key: 'hospital_name', label: 'Hospital', sortable: true },
    { key: 'medicine_name', label: 'Medicine', sortable: true },
    { key: 'available_stock', label: 'Available', render: (r: SurplusShortageItem) => <span className="font-semibold text-red-600">{r.available_stock}</span> },
    { key: 'days_of_cover', label: 'Days Cover', render: (r: SurplusShortageItem) => (
      <span className={`font-medium ${r.days_of_cover < 7 ? 'text-red-600' : r.days_of_cover < 14 ? 'text-amber-600' : 'text-slate-700'}`}>
        {r.days_of_cover === Infinity ? '∞' : r.days_of_cover}
      </span>
    )},
    { key: 'forecast_demand', label: '30d Forecast', render: (r: SurplusShortageItem) => Math.round(r.forecast_demand) },
    { key: 'shortage', label: 'Shortfall', render: (r: SurplusShortageItem) => (
      <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{r.shortage}</span>
    )},
    { key: 'reason', label: 'Reason', render: (r: SurplusShortageItem) => <span className="text-xs text-slate-500 max-w-xs block truncate" title={r.reason}>{r.reason}</span> },
  ];

  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold text-slate-800">Surplus & Shortage Analysis</h2>
        <p className="text-sm text-slate-500">Based on 30-day consumption forecast and safety stock (14 days)</p></div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Calculations: </strong>
          Days of Cover = Available ÷ Avg Daily Consumption &nbsp;|&nbsp;
          Surplus = Available − 30d Forecast − Safety Stock (14d) − Reserved &nbsp;|&nbsp;
          Shortage = Required − Available
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Surplus Situations', value: surplus.length, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Total Surplus Units', value: surplus.reduce((s, r) => s + r.surplus, 0).toLocaleString(), color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Shortage Situations', value: shortages.length, color: 'bg-red-50 text-red-700' },
          { label: 'Total Shortfall Units', value: shortages.reduce((s, r) => s + r.shortage, 0).toLocaleString(), color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p><p className="text-sm font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Surplus Inventory" subtitle={`${surplus.length} surplus situations identified`}
          action={<div className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><TrendingUp className="h-3 w-3" />Available for transfer</div>}
          noPadding>
          <DataTable columns={surplusColumns as any} data={surplus as any} loading={loading} searchable searchKeys={['hospital_name','medicine_name']} emptyMessage="No surplus situations detected" pageSize={8} />
        </Card>

        <Card title="Medicine Shortages" subtitle={`${shortages.length} shortage situations identified`}
          action={<div className="flex items-center gap-1 text-xs text-red-600 font-medium"><TrendingDown className="h-3 w-3" />Needs redistribution</div>}
          noPadding>
          <DataTable columns={shortageColumns as any} data={shortages as any} loading={loading} searchable searchKeys={['hospital_name','medicine_name']} emptyMessage="No shortage situations detected" pageSize={8} />
        </Card>
      </div>
    </div>
  );
}
