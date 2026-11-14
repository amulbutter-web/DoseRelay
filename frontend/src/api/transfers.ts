import apiClient from './client';
import type { Transfer, TransferRecommendation } from '../types';

export const transfersApi = {
  // Recommendations
  generateRecommendations: async () => {
    const res = await apiClient.post('/transfers/recommendations/generate');
    return res.data as TransferRecommendation[];
  },
  getRecommendations: async (status?: string) => {
    const res = await apiClient.get('/transfers/recommendations', { params: status ? { status } : {} });
    return res.data as TransferRecommendation[];
  },
  rejectRecommendation: async (id: number) => {
    const res = await apiClient.put(`/transfers/recommendations/${id}/reject`);
    return res.data;
  },
  // Transfers
  getAll: async (params?: { status?: string; hospital_id?: number }) => {
    const res = await apiClient.get('/transfers', { params });
    return res.data as Transfer[];
  },
  getOne: async (id: number) => {
    const res = await apiClient.get(`/transfers/${id}`);
    return res.data as Transfer;
  },
  create: async (data: {
    recommendation_id?: number;
    donor_hospital_id: number;
    receiver_hospital_id: number;
    medicine_id: number;
    batch_id: number;
    quantity: number;
  }) => {
    const res = await apiClient.post('/transfers', data);
    return res.data as Transfer;
  },
  mtoReview: async (id: number, approved: boolean, notes?: string) => {
    const res = await apiClient.put(`/transfers/${id}/mto-review`, { approved, notes });
    return res.data as Transfer;
  },
  donorApproval: async (id: number, approved: boolean, notes?: string) => {
    const res = await apiClient.put(`/transfers/${id}/donor-approval`, { approved, notes });
    return res.data as Transfer;
  },
  receiverApproval: async (id: number, approved: boolean, notes?: string) => {
    const res = await apiClient.put(`/transfers/${id}/receiver-approval`, { approved, notes });
    return res.data as Transfer;
  },
  updateStatus: async (id: number, status: string, notes?: string) => {
    const res = await apiClient.put(`/transfers/${id}/status`, { status, notes });
    return res.data as Transfer;
  },
  updateLogistics: async (id: number, data: Record<string, unknown>) => {
    const res = await apiClient.put(`/transfers/${id}/logistics`, data);
    return res.data as Transfer;
  },
  verifyReceipt: async (id: number, receivedQuantity: number, notes?: string) => {
    const res = await apiClient.put(`/transfers/${id}/receipt`, {
      received_quantity: receivedQuantity,
      notes,
    });
    return res.data as Transfer;
  },
  getQrCodeUrl: (id: number) => `/api/v1/transfers/${id}/qr-code`,
  verifyByQr: async (token: string) => {
    const res = await apiClient.get(`/transfers/verify/${token}`);
    return res.data as Transfer;
  },
};
