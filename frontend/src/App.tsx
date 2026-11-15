import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ChatBot from './components/ChatBot';

// Pages
import Sidebar from './components/layout/Sidebar';
import FacilitySignup from './components/FacilitySignup';
import RegistrationReview from './components/RegistrationReview';
import QrResolver from './components/QrResolver';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryManagementPage from './pages/InventoryManagementPage';
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

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <svg className="animate-spin h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  return (
    <>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to={user?.role === 'mto' ? '/mto' : '/dashboard'} replace /> : <LoginPage />} />
        <Route path="/signup" element={<FacilitySignup />} />
        <Route path="/mto/login" element={user?.role === 'mto' ? <Navigate to="/mto" replace /> : <div className="flex min-h-screen"><Sidebar /><div className="flex-1"><LoginPage mto /></div></div>} />
        <Route path="/mto" element={user?.role === 'mto' ? <AppLayout /> : <Navigate to="/mto/login" replace />}><Route index element={<MTODashboardPage />} /></Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/inventory" element={<ProtectedRoute roles={['network_admin','hospital_admin','pharmacist','mto','logistics']}><InventoryManagementPage /></ProtectedRoute>} />
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
          <Route path="/registration-review" element={<ProtectedRoute roles={['network_admin']}><RegistrationReview /></ProtectedRoute>} />
          <Route path="/transfer/verify/:token" element={<QrResolver />} />
          <Route path="/approvals" element={<PharmacistApprovalsPage />} />
          <Route path="/logistics" element={<LogisticsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {isAuthenticated && <ChatBot />}
    </>
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
