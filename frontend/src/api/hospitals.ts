import apiClient from './client';
import type { Hospital } from '../types';

export const hospitalsApi = {
  getAll: async (status?: string) => {
    const res = await apiClient.get('/hospitals', { params: status ? { status } : {} });
    return res.data as Hospital[];
  },
  getOne: async (id: number) => {
    const res = await apiClient.get(`/hospitals/${id}`);
    return res.data as Hospital;
  },
  create: async (data: Partial<Hospital>) => {
    const res = await apiClient.post('/hospitals', data);
    return res.data as Hospital;
  },
  update: async (id: number, data: Partial<Hospital>) => {
    const res = await apiClient.put(`/hospitals/${id}`, data);
    return res.data as Hospital;
  },
  deactivate: async (id: number) => {
    await apiClient.delete(`/hospitals/${id}`);
  },
};
