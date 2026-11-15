import apiClient from './client';
import type { Medicine, MedicineBatch } from '../types';

export const medicinesApi = {
  getAll: async () => {
    const res = await apiClient.get('/medicines');
    return res.data as Medicine[];
  },
  getOne: async (id: number) => {
    const res = await apiClient.get(`/medicines/${id}`);
    return res.data as Medicine;
  },
  create: async (data: Partial<Medicine>) => {
    const res = await apiClient.post('/medicines', data);
    return res.data as Medicine;
  },
  update: async (id: number, data: Partial<Medicine>) => {
    const res = await apiClient.put(`/medicines/${id}`, data);
    return res.data as Medicine;
  },
  getBatches: async (params?: { hospital_id?: number; medicine_id?: number; status?: string }) => {
    const res = await apiClient.get('/medicines/batches/all', { params });
    return res.data as MedicineBatch[];
  },
  createBatch: async (data: Partial<MedicineBatch>) => {
    const res = await apiClient.post('/medicines/batches', data);
    return res.data as MedicineBatch;
  },
  updateBatch: async (id: number, data: Partial<MedicineBatch>) => {
    const res = await apiClient.put(`/medicines/batches/${id}`, data);
    return res.data as MedicineBatch;
  },
  getExpirySummary: async () => {
    const res = await apiClient.get('/medicines/expiry-summary/stats');
    return res.data as Record<string, number>;
  },
};
