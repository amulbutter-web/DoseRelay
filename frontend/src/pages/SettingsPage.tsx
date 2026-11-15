import React, { useEffect, useState } from 'react';
import { Save, Lock } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { authApi } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg('');
    try { await authApi.updateProfile({ full_name: fullName }); setMsg('Profile updated successfully'); }
    catch { setMsg('Failed to update profile'); }
    finally { setSaving(false); }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setChangingPwd(true); setMsg('');
    try { await authApi.changePassword(currentPwd, newPwd); setMsg('Password changed successfully'); setCurrentPwd(''); setNewPwd(''); }
    catch (err: any) { setMsg(err?.response?.data?.detail || 'Failed to change password'); }
    finally { setChangingPwd(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h2 className="text-lg font-semibold text-slate-800">Settings</h2><p className="text-sm text-slate-500">Manage your account preferences</p></div>

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.includes('success') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}

      <Card title="Profile Information">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-2xl font-bold">{user?.full_name?.charAt(0)}</div>
            <div>
              <p className="font-semibold text-slate-800">{user?.full_name}</p>
              <p className="text-sm text-slate-500 capitalize">{user?.role.replace(/_/g,' ')}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <Input label="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} />
          <Input label="Email" value={email} disabled className="bg-slate-50 cursor-not-allowed" helper="Contact admin to change email" />
          <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
            <p><strong>Role:</strong> <span className="capitalize">{user?.role.replace(/_/g,' ')}</span></p>
            {user?.hospital_id && <p className="mt-1"><strong>Hospital ID:</strong> {user.hospital_id}</p>}
          </div>
          <Button type="submit" icon={<Save className="h-4 w-4" />} loading={saving}>Save Changes</Button>
        </form>
      </Card>

      <Card title="Change Password">
        <form onSubmit={handlePassword} className="space-y-4">
          <Input label="Current Password" type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required />
          <Input label="New Password" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required helper="Minimum 8 characters" />
          <Button type="submit" icon={<Lock className="h-4 w-4" />} loading={changingPwd}>Change Password</Button>
        </form>
      </Card>

      <Card title="Demo Information">
        <div className="text-sm text-slate-600 space-y-2">
          <p className="font-semibold text-amber-600">⚠ This is a demonstration environment</p>
          <p>All hospital names, medicine data, and transfer records are entirely fictional and created for demo purposes only.</p>
          <p>DoseRelay is a decision-support platform. All transfers must comply with applicable laws, institutional policies, licensing requirements, and authorised approvals.</p>
        </div>
      </Card>
    </div>
  );
}
