import React, { useState } from 'react';
import { Shield, Stethoscope, FlaskConical, Lock, Key, CheckCircle2, ArrowRight } from 'lucide-react';
import axios from 'axios';

export default function LoginModal({ isOpen, onLoginSuccess }) {
  const [selectedRole, setSelectedRole] = useState('VET');
  const [pinCode, setPinCode] = useState('1234');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const roles = [
    {
      id: 'ADMIN',
      title: 'Administrator',
      icon: Shield,
      color: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
      activeColor: 'border-rose-500 bg-rose-500/20 text-white shadow-rose-900/30',
      description: 'System config, analyzer ports & full laboratory administration'
    },
    {
      id: 'VET',
      title: 'Veterinarian / Pathologist',
      icon: Stethoscope,
      color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
      activeColor: 'border-emerald-500 bg-emerald-500/20 text-white shadow-emerald-900/30',
      description: 'Review findings, 5-part WBC diffs, digital signatures & batch approvals'
    },
    {
      id: 'LAB',
      title: 'Laboratory Technician',
      icon: FlaskConical,
      color: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300',
      activeColor: 'border-cyan-500 bg-cyan-500/20 text-white shadow-cyan-900/30',
      description: 'Pet registration, thermal tube labeling, QC calibration & analyzer runs'
    }
  ];

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await axios.post('/api/auth/login', {
        role: selectedRole,
        pin_code: pinCode
      });
      onLoginSuccess(res.data.user);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Invalid login credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setPinCode('1234');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 mx-auto flex items-center justify-center">
            <div className="h-full w-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <FlaskConical className="h-7 w-7 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Apex VetLIS Access Portal
          </h2>
          <p className="text-xs text-slate-400">Select your active role to access the workstation</p>
        </div>

        {/* Role Cards */}
        <div className="space-y-2.5">
          {roles.map((r) => {
            const Icon = r.icon;
            const isSelected = selectedRole === r.id;
            return (
              <div
                key={r.id}
                onClick={() => handleQuickRoleSelect(r.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected ? r.activeColor : `${r.color} hover:border-slate-700 bg-slate-950/40`
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl border ${isSelected ? 'bg-white/10' : 'bg-slate-900 border-slate-800'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-100">{r.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{r.description}</div>
                  </div>
                </div>
                {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* PIN Input & Submit */}
        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
              <span>Security PIN Code</span>
              <span className="text-[10px] text-slate-500 font-mono">Default PIN: 1234</span>
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                maxLength={8}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono tracking-widest focus:outline-none focus:border-emerald-500 text-center text-sm font-bold"
                placeholder="••••"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs text-center font-medium">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Authenticating...' : `Log In as ${selectedRole}`}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
