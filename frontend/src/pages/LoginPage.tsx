import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pill, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DEMO_CREDS = [
  { role: 'Network Admin', email: 'admin@doserelay.com', password: 'Admin@123' },
  { role: 'Hospital Admin', email: 'metro.admin@doserelay.com', password: 'Hospital@123' },
  { role: 'Pharmacist', email: 'pharmacist@doserelay.com', password: 'Pharma@123' },
  { role: 'MTO', email: 'mto@doserelay.com', password: 'Transfer@123' },
  { role: 'Logistics', email: 'logistics@doserelay.com', password: 'Logistics@123' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@doserelay.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#1e3a8f] to-[#1e40af] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-0 shadow-2xl rounded-2xl overflow-hidden">
        {/* Left panel */}
        <div className="bg-[#1e3a5f] p-10 flex flex-col justify-between hidden md:flex">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="h-10 w-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <Pill className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-xl">DoseRelay</h1>
                <p className="text-blue-300 text-xs">Intelligent Medicine Platform</p>
              </div>
            </div>
            <h2 className="text-white text-3xl font-bold leading-tight mb-4">
              Smarter Medicine<br />Redistribution
            </h2>
            <p className="text-blue-200 text-sm leading-relaxed">
              AI-powered surplus and shortage detection, demand forecasting, and coordinated transfer workflows across healthcare networks.
            </p>
          </div>

          <div className="space-y-3">
            {['Reduce medicine expiry waste', 'AI demand forecasting', 'Secure pharmacist approvals', 'QR-tracked transfers'].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-blue-200">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                {f}
              </div>
            ))}
            <div className="mt-6 px-3 py-2 bg-amber-500/20 border border-amber-400/30 rounded-lg">
              <p className="text-amber-200 text-xs font-medium">⚠ Demo Environment — All data is fictional</p>
            </div>
          </div>
        </div>

        {/* Right panel - Login form */}
        <div className="bg-white p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-1 md:hidden">
              <Pill className="h-5 w-5 text-[#1e3a5f]" />
              <span className="font-bold text-[#1e3a5f]">DoseRelay</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Sign in</h2>
            <p className="text-slate-500 text-sm mt-1">Enter your credentials to access the platform</p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@hospital.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a5f] text-white py-2.5 rounded-lg font-semibold hover:bg-[#152b47] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-600 mb-2">Demo Credentials (click to fill):</p>
            <div className="space-y-1">
              {DEMO_CREDS.map((c) => (
                <button
                  key={c.email}
                  type="button"
                  onClick={() => { setEmail(c.email); setPassword(c.password); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-white text-xs text-slate-600 hover:text-slate-800 flex justify-between transition-colors"
                >
                  <span className="font-medium text-[#1e3a5f]">{c.role}</span>
                  <span className="text-slate-400">{c.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
