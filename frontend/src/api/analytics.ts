import apiClient from './client';
import type { DashboardStats, AnalyticsData } from '../types';

export const analyticsApi = {
  getDashboard: async () => {
    const res = await apiClient.get('/analytics/dashboard');
    return res.data as DashboardStats;
  },
  getReports: async () => {
    const res = await apiClient.get('/analytics/reports');
    return res.data as AnalyticsData;
  },
  exportCsv: async () => {
    const res = await apiClient.get('/analytics/export/csv', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'doserelay_transfers.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

export const notificationsApi = {
  getAll: async () => {
    const res = await apiClient.get('/notifications');
    return res.data;
  },
  markRead: async (id: number) => {
    await apiClient.put(`/notifications/${id}/read`);
  },
  markAllRead: async () => {
    await apiClient.put('/notifications/read-all');
  },
};
