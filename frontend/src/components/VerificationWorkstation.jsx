import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  FileText, 
  ArrowUpRight, 
  ArrowDownRight, 
  Edit3, 
  Save, 
  UserCheck, 
  ShieldCheck, 
  Clock, 
  Check, 
  X, 
  PieChart as PieIcon,
  ChevronRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell 
} from 'recharts';
import confetti from 'canvas-confetti';

export default function VerificationWorkstation({
  orders = [],
  selectedOrderId,
  onSelectOrder,
  onVerifyOrder,
  onUpdateResultItem,
  onOpenReport,
  onRefresh,
  currentUser
}) {
  const currentOrder = orders.find(o => o.id === selectedOrderId) || orders[0];
  const [editingItemId, setEditingItemId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  // The signature always belongs to the logged-in user; lab technicians cannot release reports
  const pathologistName = currentUser?.full_name || '';
  const canSign = Boolean(currentUser) && currentUser.role !== 'LAB';
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verifying, setVerifying] = useState(false);

  if (!currentOrder) {
    return (
      <div className="text-center py-20 bg-slate-900/80 border border-slate-800 rounded-3xl max-w-xl mx-auto">
        <CheckCircle2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-200">No Orders in Queue</h3>
        <p className="text-xs text-slate-400 mt-1">Register a patient or simulate an analyzer run to begin review.</p>
      </div>
    );
  }

  const results = currentOrder.results || [];
  
  // Group results by category
  const hemResults = results.filter(r => r.category === 'HEMATOLOGY');
  const chemResults = results.filter(r => r.category === 'BIOCHEMISTRY' || r.category === 'ELECTROLYTES');
  const otherResults = results.filter(r => r.category !== 'HEMATOLOGY' && r.category !== 'BIOCHEMISTRY' && r.category !== 'ELECTROLYTES');

  // Check if this run is from a 3-Part or 5-Part Hematology Analyzer
  const has3Part = results.some(r => r.test_code === 'MID%' || r.test_code === 'GRAN%' || r.test_code === 'MID#');
  
  const diffTests = has3Part 
    ? ['LYM%', 'MID%', 'GRAN%']
    : ['NEU%', 'LYM%', 'MON%', 'EOS%', 'BAS%'];

  const diffData = diffTests.map(code => {
    const item = results.find(r => r.test_code === code);
    let displayName = code.replace('%', '');
    if (displayName === 'MID') displayName = 'MID (Mon/Eos/Bas)';
    if (displayName === 'GRAN') displayName = 'GRAN (Neutrophils)';
    if (displayName === 'LYM' && has3Part) displayName = 'LYM (Lymphocytes)';

    return {
      name: displayName,
      rawCode: code.replace('%', ''),
      value: item && item.result_value !== null ? item.result_value : 0,
      code: code
    };
  }).filter(d => d.value > 0);

  const diffColors = {
    'NEU': '#8b5cf6', // purple
    'LYM': '#3b82f6', // blue
    'MON': '#10b981', // emerald
    'EOS': '#f59e0b', // amber
    'BAS': '#ef4444', // rose
    'MID': '#f59e0b', // amber for Mid cells
    'GRAN': '#8b5cf6', // purple for Granulocytes
  };

  const handleStartEdit = (item) => {
    setEditingItemId(item.id);
    setEditValue(item.result_value !== null ? item.result_value.toString() : (item.result_str || ''));
    setOverrideReason(item.override_reason || '');
  };

  const handleSaveEdit = async (itemId) => {
    try {
      await onUpdateResultItem(itemId, {
        result_value: parseFloat(editValue) || null,
        result_str: editValue,
        override_reason: overrideReason || 'Manual pathologist adjustment'
      });
      setEditingItemId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await onVerifyOrder(currentOrder.id, {
        verified_by: pathologistName,
        verification_notes: verificationNotes || 'All diagnostic findings correlated with species reference intervals and clinical history.'
      });
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  const getFlagBadge = (flag) => {
    switch (flag) {
      case 'NORMAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">NORMAL</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-0.5"><ArrowDownRight className="h-3 w-3" /> LOW</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" /> HIGH</span>;
      case 'CRITICAL_LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700 animate-pulse flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> CRIT LOW</span>;
      case 'CRITICAL_HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700 animate-pulse flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> CRIT HIGH</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">UNCHECKED</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-12">
      
      {/* Top Patient Summary Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Patient Details */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-lg shadow-emerald-900/40">
              <div className="h-full w-full bg-slate-950 rounded-[14px] flex items-center justify-center text-xl font-black text-emerald-400">
                {currentOrder.patient?.species === 'CANINE' ? '🐕' : currentOrder.patient?.species === 'FELINE' ? '🐈' : '🐾'}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-extrabold text-slate-100">{currentOrder.patient?.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {currentOrder.patient?.species}
                </span>
                <span className="font-mono text-xs text-slate-400">MRN: {currentOrder.patient?.mrn}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {currentOrder.patient?.breed} • {currentOrder.patient?.gender} • {currentOrder.patient?.age_years} yrs {currentOrder.patient?.age_months} mos • Owner: <span className="text-slate-200 font-medium">{currentOrder.patient?.owner_name}</span>
              </p>
            </div>
          </div>

          {/* Accession & Specimen Info */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-500 font-mono uppercase">Accession No</div>
              <div className="text-xs font-bold font-mono text-cyan-400">{currentOrder.accession_no}</div>
            </div>

            <div className="bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-500 font-mono uppercase">Collection Draw</div>
              <div className="text-xs font-bold text-slate-200">
                {currentOrder.draw_date ? new Date(currentOrder.draw_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
              </div>
            </div>

            <div className="bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-500 font-mono uppercase">Status</div>
              <div className="text-xs font-bold text-emerald-400">{currentOrder.status}</div>
            </div>

            <button
              onClick={() => onOpenReport(currentOrder.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
            >
              <FileText className="h-4 w-4" />
              <span>Preview Report</span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Grid: Workorder selector drawer + Results Table + Differential Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Column: Quick Order Switcher (1 Col) */}
        <div className="xl:col-span-1 space-y-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Queue Review</h3>
              <button onClick={onRefresh} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {orders.map((ord) => {
                const isSelected = ord.id === currentOrder.id;
                return (
                  <div
                    key={ord.id}
                    onClick={() => onSelectOrder(ord.id)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected 
                        ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-950/30' 
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-100">{ord.patient?.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {ord.patient?.species}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">{ord.accession_no}</div>
                    </div>
                    <div>
                      {ord.status === 'VERIFIED' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                          {ord.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 3 Columns: Results Table & Verification Controls */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Results Table Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Diagnostic Findings & Dynamic Flags</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                    Species: {currentOrder.patient?.species}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">All reference ranges dynamically normalized against patient species intervals</p>
              </div>
            </div>

            {/* Results Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[10px] border-y border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Test Code / Name</th>
                    <th className="py-3 px-3">Result Value</th>
                    <th className="py-3 px-3">Units</th>
                    <th className="py-3 px-3">Species Range</th>
                    <th className="py-3 px-3">Flag</th>
                    <th className="py-3 px-3">Delta Check (Prev)</th>
                    <th className="py-3 px-3">Analyzer</th>
                    <th className="py-3 px-3 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-500 font-mono">
                        No results interfaced yet for this workorder. Run simulator or wait for analyzer packet.
                      </td>
                    </tr>
                  ) : (
                    results.map((item) => {
                      const isEditing = editingItemId === item.id;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          
                          {/* Test Name */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-100 font-mono">{item.test_code}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{item.test_name}</div>
                          </td>

                          {/* Value */}
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 px-2 py-1 bg-slate-950 border border-emerald-500 rounded text-xs text-white font-mono"
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className={`font-mono text-sm font-bold ${
                                  item.flag === 'NORMAL' ? 'text-slate-100' :
                                  item.flag.includes('CRITICAL') ? 'text-rose-400 font-black' : 'text-amber-300 font-black'
                                }`}>
                                  {item.result_value !== null ? item.result_value : item.result_str}
                                </span>
                                {item.is_manual_override && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-400 border border-purple-800" title={`Override reason: ${item.override_reason}`}>
                                    OVERRIDE
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Units */}
                          <td className="py-3 px-3 text-slate-400 font-mono">{item.unit || '-'}</td>

                          {/* Species Range */}
                          <td className="py-3 px-3 text-slate-300 font-mono text-[11px]">
                            {item.ref_low !== null && item.ref_high !== null ? `${item.ref_low} - ${item.ref_high}` : 'N/A'}
                          </td>

                          {/* Flag */}
                          <td className="py-3 px-3">
                            {getFlagBadge(item.flag)}
                          </td>

                          {/* Delta Check */}
                          <td className="py-3 px-3">
                            {item.prev_value !== null ? (
                              <div className="text-[11px] font-mono">
                                <div className="text-slate-400">{item.prev_value} ({item.prev_date ? item.prev_date.slice(0, 10) : 'Past'})</div>
                                <div className={`font-bold flex items-center gap-0.5 ${
                                  item.delta_flag === 'SIGNIFICANT' ? 'text-rose-400' :
                                  item.delta_flag === 'ALERT' ? 'text-amber-400' : 'text-emerald-400'
                                }`}>
                                  {item.delta_percent > 0 ? `+${item.delta_percent}%` : `${item.delta_percent}%`}
                                  {item.delta_flag !== 'NORMAL' && <TrendingUp className="h-3 w-3" />}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono text-[11px]">No History</span>
                            )}
                          </td>

                          {/* Analyzer */}
                          <td className="py-3 px-3 text-slate-400 text-[11px] truncate max-w-[120px]">
                            {item.analyzer_name}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleSaveEdit(item.id)}
                                  className="p-1 rounded bg-emerald-500 text-slate-950 font-bold"
                                  title="Save Edit"
                                >
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                </button>
                                <button
                                  onClick={() => setEditingItemId(null)}
                                  className="p-1 rounded bg-slate-800 text-slate-300"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                                title="Edit / Override Value"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* 5-Part WBC Differential Visualizer & Pathologist Sign-Off Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* WBC Diff Chart Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <PieIcon className="h-4 w-4" />
                  <span>{has3Part ? '3-Part WBC Differential Profile' : '5-Part WBC Differential Profile'}</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {has3Part ? 'Impedance Volumetric 3-Part' : 'Laser Flow Cytometry 5-Part'}
                </span>
              </div>

              {diffData.length > 0 ? (
                <div className="h-48 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={diffData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                        formatter={(value) => [`${value}%`, 'Differential']}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {diffData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={diffColors[entry.rawCode] || '#10b981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs font-mono">
                  No differential % parameters available for this panel.
                </div>
              )}
            </div>

            {/* Pathologist Verification & Sign-Off Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Pathologist Sign-Off & Verification</span>
                </h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  ISO-17025 Ready
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Authorizing Veterinarian / Pathologist</label>
                  <input
                    type="text"
                    value={pathologistName}
                    readOnly
                    title="Signed as the logged-in user"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none font-semibold cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Clinical Interpretation / Notes</label>
                  <textarea
                    rows={2}
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Enter clinical comments to appear on the official diagnostic report..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    {currentOrder.status === 'VERIFIED' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Verified by {currentOrder.verified_by}
                      </span>
                    ) : canSign ? (
                      <span>Pending electronic sign-off</span>
                    ) : (
                      <span className="text-amber-400">Only a veterinarian or administrator can sign off</span>
                    )}
                  </div>

                  <button
                    onClick={handleVerify}
                    disabled={verifying || !canSign}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>{verifying ? 'Signing...' : 'Sign & Verify Order'}</span>
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
