import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  FlaskConical, 
  PlusCircle, 
  Wifi, 
  WifiOff, 
  Layers, 
  CheckCircle2, 
  Sliders, 
  Network, 
  LineChart, 
  BookOpen, 
  Play, 
  Clock,
  Sparkles
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  wsConnected, 
  onOpenOrderModal, 
  onQuickSimulate,
  pendingCount = 0,
  currentUser,
  onLogout
}) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard & Monitor', icon: Activity, badge: null },
    { id: 'verification', label: 'Verification Console', icon: CheckCircle2, badge: pendingCount > 0 ? pendingCount : null },
    { id: 'qc', label: 'QC Levey-Jennings', icon: LineChart, badge: null },
    { id: 'catalog', label: 'Multi-Species Catalog', icon: BookOpen, badge: null },
    { id: 'network', label: 'LAN & Hardware Hub', icon: Network, badge: null },
    { id: 'settings', label: 'Settings & Users', icon: Sliders, badge: null },
  ];

  const getRoleBadge = (role) => {
    if (role === 'ADMIN') return { label: 'ADMIN', color: 'bg-rose-950 text-rose-400 border-rose-800' };
    if (role === 'LAB') return { label: 'LAB TECH', color: 'bg-cyan-950 text-cyan-400 border-cyan-800' };
    return { label: 'VET', color: 'bg-emerald-950 text-emerald-400 border-emerald-800' };
  };

  const badge = getRoleBadge(currentUser?.role || 'VET');

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 px-4 lg:px-6 py-3">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 max-w-[1700px] mx-auto">
        
        {/* Brand & System Title */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Apex VetLIS
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                v2.0 PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Veterinary Laboratory Information System & Hardware Interfacing Engine
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 relative ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Live Status & User Info & Quick Actions */}
        <div className="flex items-center gap-3">
          {/* Live WS Pulse */}
          <div className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium ${
            wsConnected 
              ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300' 
              : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
          }`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                wsConnected ? 'bg-emerald-400' : 'bg-rose-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                wsConnected ? 'bg-emerald-500' : 'bg-rose-500'
              }`}></span>
            </span>
            <span>{wsConnected ? 'SOCKET: 5100/5101' : 'CONNECTING...'}</span>
          </div>

          {/* Quick Simulation Trigger */}
          <button
            onClick={onQuickSimulate}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Simulate incoming hardware analyzer packet"
          >
            <Play className="h-3.5 w-3.5 text-cyan-400 fill-cyan-400" />
            <span>Simulate Run</span>
          </button>

          {/* Register Pet / New Order Button */}
          <button
            onClick={onOpenOrderModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition transform active:scale-95"
          >
            <PlusCircle className="h-4 w-4 text-slate-950" />
            <span>New Order</span>
          </button>

          {/* Active User Pill */}
          {currentUser && (
            <div 
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs cursor-pointer hover:border-slate-700 transition"
              title="Click to view Settings & Users"
            >
              <div className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px]">
                {currentUser.full_name ? currentUser.full_name[0] : 'U'}
              </div>
              <div className="hidden lg:block text-left">
                <div className="font-bold text-slate-200 text-[11px] leading-tight truncate max-w-[120px]">
                  {currentUser.full_name}
                </div>
                <div className={`text-[9px] font-mono px-1 rounded border inline-block ${badge.color}`}>
                  {badge.label}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
