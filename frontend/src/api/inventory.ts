import apiClient from './client';
import type { SurplusShortageItem, ExpiryAlert } from '../types';

export const inventoryApi = {
  getSurplus: async () => {
    const res = await apiClient.get('/inventory/surplus');
    return res.data as SurplusShortageItem[];
  },
  getShortages: async () => {
    const res = await apiClient.get('/inventory/shortages');
    return res.data as SurplusShortageItem[];
  },
  getExpiryAlerts: async () => {
    const res = await apiClient.get('/inventory/expiry-alerts');
    return res.data as ExpiryAlert[];
  },
  refreshStatuses: async () => {
    await apiClient.post('/inventory/refresh-statuses');
  },
};
