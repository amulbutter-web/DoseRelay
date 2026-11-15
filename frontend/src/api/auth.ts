import apiClient from './client';
import type { User } from '../types';

export const authApi = {
  logout: async () => apiClient.post('/auth/logout', {}, {headers: {Authorization: `Bearer ${localStorage.getItem('token')}`}}),
  login: async (email: string, password: string, mto = false) => {
    const res = await apiClient.post(mto ? '/auth/mto/login' : '/auth/login', { email, password });
    return res.data as { access_token: string; token_type: string; user: User };
  },
  getProfile: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data as User;
  },
  updateProfile: async (data: Partial<User>) => {
    const res = await apiClient.put('/auth/me', data);
    return res.data as User;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiClient.put('/auth/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return res.data;
  },
};
