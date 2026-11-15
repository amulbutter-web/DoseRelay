import apiClient from './client';
import type { SurplusShortageItem, ExpiryAlert } from '../types';

export const inventoryApi = {
  getSurplus: async (params?: { hospital_id?: number; medicine_id?: number }) => {
    const res = await apiClient.get('/inventory/surplus', { params });
    return res.data as SurplusShortageItem[];
  },
  getShortages: async (params?: { hospital_id?: number; medicine_id?: number }) => {
    const res = await apiClient.get('/inventory/shortages', { params });
    return res.data as SurplusShortageItem[];
  },
  getExpiryAlerts: async () => {
    const res = await apiClient.get('/inventory/expiry-alerts');
    return res.data as ExpiryAlert[];
  },
  refreshStatuses: async () => {
    const res = await apiClient.post('/inventory/refresh-statuses');
    return res.data;
  },
};
