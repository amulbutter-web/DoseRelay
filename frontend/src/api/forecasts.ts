import apiClient from './client';
import type { DemandForecast, ForecastSummary } from '../types';

export const forecastsApi = {
  generate: async (hospitalId: number, medicineId: number, daysAhead = 30) => {
    const res = await apiClient.post('/forecasts/generate', {
      hospital_id: hospitalId,
      medicine_id: medicineId,
      days_ahead: daysAhead,
    });
    return res.data as DemandForecast[];
  },
  get: async (hospitalId: number, medicineId: number) => {
    const res = await apiClient.get(`/forecasts/${hospitalId}/${medicineId}`);
    return res.data as DemandForecast[];
  },
  getSummaryAll: async () => {
    const res = await apiClient.get('/forecasts/summary/all');
    return res.data as ForecastSummary[];
  },
};
