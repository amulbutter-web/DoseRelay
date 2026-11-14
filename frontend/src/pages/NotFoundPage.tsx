import React from 'react';
import { Link } from 'react-router-dom';
import { Pill } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="h-16 w-16 bg-[#1e3a5f] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Pill className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-6xl font-bold text-[#1e3a5f] mb-2">404</h1>
        <p className="text-xl font-semibold text-slate-700 mb-2">Page not found</p>
        <p className="text-slate-500 mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-[#152b47] transition-colors">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
