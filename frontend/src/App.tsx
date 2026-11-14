import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import HospitalsPage from './pages/HospitalsPage';
import HospitalDetailPage from './pages/HospitalDetailPage';
import MedicinesPage from './pages/MedicinesPage';
import BatchesPage from './pages/BatchesPage';
import ExpiryManagementPage from './pages/ExpiryManagementPage';
import ForecastPage from './pages/ForecastPage';
import SurplusShortagesPage from './pages/SurplusShortagesPage';
import RecommendationsPage from './pages/RecommendationsPage';
import TransfersPage from './pages/TransfersPage';
import TransferDetailPage from './pages/TransferDetailPage';
import MTODashboardPage from './pages/MTODashboardPage';
import PharmacistApprovalsPage from './pages/PharmacistApprovalsPage';
import LogisticsPage from './pages/LogisticsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <svg className="animate-spin h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  );
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/hospitals" element={<HospitalsPage />} />
        <Route path="/hospitals/:id" element={<HospitalDetailPage />} />
        <Route path="/medicines" element={<MedicinesPage />} />
        <Route path="/batches" element={<BatchesPage />} />
        <Route path="/expiry" element={<ExpiryManagementPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/surplus-shortages" element={<SurplusShortagesPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/transfers" element={<TransfersPage />} />
        <Route path="/transfers/:id" element={<TransferDetailPage />} />
        <Route path="/mto" element={<MTODashboardPage />} />
        <Route path="/approvals" element={<PharmacistApprovalsPage />} />
        <Route path="/logistics" element={<LogisticsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
