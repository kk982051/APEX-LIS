import React, { useState } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  QrCode, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  Terminal, 
  Play, 
  Sparkles, 
  RefreshCw, 
  Edit3, 
  Eye, 
  Trash2, 
  Dog, 
  Cat, 
  Zap 
} from 'lucide-react';

export default function Dashboard({
  orders = [],
  rawLogs = [],
  networkStatus = null,
  onRefresh,
  onSelectOrder,
  onOpenBarcode,
  onOpenReport,
  onOpenEdit,
  onBatchApprove,
  onSimulateASTM,
  onSimulateHL7,
  onDeleteOrder
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedRawLog, setSelectedRawLog] = useState(null);

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    const matchesSearch = 
      o.accession_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.patient?.name && o.patient.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.patient?.mrn && o.patient.mrn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.samples && o.samples.some(s => s.barcode.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesSpecies = selectedSpecies === 'ALL' || (o.patient?.species?.toUpperCase() === selectedSpecies);
    const matchesStatus = selectedStatus === 'ALL' || (o.status?.toUpperCase() === selectedStatus);

    return matchesSearch && matchesSpecies && matchesStatus;
  });

  // Calculate Metrics
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'PENDING').length;
  const ingestedOrders = orders.filter(o => o.status === 'INGESTED' || o.status === 'PARTIAL').length;
  const verifiedOrders = orders.filter(o => o.status === 'VERIFIED').length;
  
  // Count critical results
  let criticalCount = 0;
  orders.forEach(o => {
    if (o.results) {
      criticalCount += o.results.filter(r => r.flag === 'CRITICAL_LOW' || r.flag === 'CRITICAL_HIGH').length;
    }
  });

  const speciesBadges = [
    { id: 'ALL', label: 'All Species', count: orders.length },
    { id: 'CANINE', label: 'Canine 🐕', count: orders.filter(o => o.patient?.species === 'CANINE').length },
    { id: 'FELINE', label: 'Feline 🐈', count: orders.filter(o => o.patient?.species === 'FELINE').length },
    { id: 'EQUINE', label: 'Equine 🐎', count: orders.filter(o => o.patient?.species === 'EQUINE').length },
    { id: 'BOVINE', label: 'Bovine 🐄', count: orders.filter(o => o.patient?.species === 'BOVINE').length },
  ];

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-12">
      
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden shadow-lg">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Total Workorders</p>
            <h3 className="text-2xl font-black text-slate-100">{totalOrders}</h3>
          </div>
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-blue-500/5 rounded-full blur-xl"></div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden shadow-lg">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Pending Run / Draw</p>
            <h3 className="text-2xl font-black text-amber-300">{pendingOrders}</h3>
          </div>
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-500/5 rounded-full blur-xl"></div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden shadow-lg">
          <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Ingested / To Review</p>
            <h3 className="text-2xl font-black text-cyan-300">{ingestedOrders}</h3>
          </div>
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-cyan-500/5 rounded-full blur-xl"></div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden shadow-lg">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Verified & Released</p>
            <h3 className="text-2xl font-black text-emerald-300">{verifiedOrders}</h3>
          </div>
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl"></div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden shadow-lg">
          <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Critical Alerts</p>
            <h3 className="text-2xl font-black text-rose-400">{criticalCount}</h3>
          </div>
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-rose-500/5 rounded-full blur-xl"></div>
        </div>

      </div>

      {/* Main Grid: Orders on Left (2/3) + Real-time Packet Stream & Simulators on Right (1/3) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Orders Table Container (2 Cols) */}
        <div className="xl:col-span-2 space-y-4">
          
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            
            {/* Header, Search & Filter Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Diagnostic Orders & Workstation Queue</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {filteredOrders.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Real-time specimen draw, analyzer matching, and verification status</p>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onBatchApprove}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-900/30 transition"
                  title="1-Click Batch Approval for all orders where 100% of parameters are within normal species ranges"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>1-Click Batch Approve Normal</span>
                </button>

                <button
                  onClick={onRefresh}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  title="Refresh Queue"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Search & Species Pills */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search MRN, Pet, Barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Species Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {speciesBadges.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => setSelectedSpecies(sp.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      selectedSpecies === sp.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {sp.label} <span className="opacity-60 text-[10px]">({sp.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono text-[10px] border-y border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Accession / MRN</th>
                    <th className="py-3 px-3">Patient & Species</th>
                    <th className="py-3 px-3">Specimen Barcode</th>
                    <th className="py-3 px-3">Test Panels</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-500">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-30 text-slate-400" />
                        <p className="font-medium text-sm">No orders matching criteria.</p>
                        <p className="text-xs text-slate-600 mt-1">Register a new patient or simulate analyzer ingestion.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => {
                      const isNormal = ord.results && ord.results.length > 0 && ord.results.every(r => r.flag === 'NORMAL');
                      const hasCritical = ord.results && ord.results.some(r => r.flag === 'CRITICAL_LOW' || r.flag === 'CRITICAL_HIGH');
                      const hasAbnormal = ord.results && ord.results.some(r => r.flag === 'LOW' || r.flag === 'HIGH');

                      return (
                        <tr 
                          key={ord.id}
                          className="hover:bg-slate-800/40 transition group cursor-pointer"
                          onClick={() => onSelectOrder(ord.id)}
                        >
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-slate-100">{ord.accession_no}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{ord.patient?.mrn}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                              <span>{ord.patient?.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-medium">
                                {ord.patient?.species}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                              {ord.patient?.breed} • {ord.patient?.gender}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1">
                              {ord.samples && ord.samples.map(s => (
                                <span key={s.id} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 flex items-center gap-1 w-fit">
                                  <QrCode className="h-3 w-3" />
                                  {s.barcode}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[11px] font-medium border border-slate-700/50">
                              {ord.panel_types || 'CBC'}
                            </span>
                            {ord.results && ord.results.length > 0 && (
                              <div className="text-[10px] text-slate-400 mt-1">
                                {ord.results.length} parameters logged
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {ord.status === 'VERIFIED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                                <CheckCircle2 className="h-3 w-3" /> VERIFIED
                              </span>
                            ) : ord.status === 'INGESTED' ? (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                hasCritical 
                                  ? 'bg-rose-950/80 text-rose-400 border border-rose-800 animate-pulse'
                                  : hasAbnormal
                                  ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
                                  : 'bg-cyan-950/80 text-cyan-400 border border-cyan-800'
                              }`}>
                                <Cpu className="h-3 w-3" /> 
                                {hasCritical ? 'CRITICAL' : hasAbnormal ? 'ABNORMAL' : 'INGESTED'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                <Clock className="h-3 w-3" /> PENDING RUN
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Thermal Barcode Print */}
                              <button
                                onClick={() => onOpenBarcode(ord)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                                title="Print Thermal Barcode Tube Label"
                              >
                                <QrCode className="h-3.5 w-3.5 text-emerald-400" />
                              </button>

                              {/* Edit Order Dates */}
                              <button
                                onClick={() => onOpenEdit(ord)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                                title="Edit Specimen Draw Date / Order Details"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-blue-400" />
                              </button>

                              {/* Printable Diagnostic Report */}
                              <button
                                onClick={() => onOpenReport(ord.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                                title="Generate Diagnostic PDF / Report"
                              >
                                <FileText className="h-3.5 w-3.5 text-amber-400" />
                              </button>

                              {/* Verification Console */}
                              <button
                                onClick={() => onSelectOrder(ord.id)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition"
                              >
                                Review
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        {/* Right Column (1 Col): Real-time Hardware Telemetry & Quick Hardware Simulators */}
        <div className="space-y-4">
          
          {/* Hardware Simulators Panel */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <span>Hardware Interfacing Simulator</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400">
                TCP :5100 / :5101
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Inject live ASTM/HL7 test runs directly through the TCP socket decoder pipeline:
            </p>

            <div className="grid grid-cols-1 gap-2.5 mt-4">
              
              <button
                onClick={() => onSimulateASTM(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 transition text-left group"
              >
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 flex items-center gap-1.5">
                    <Play className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400" />
                    <span>GFE QuickCell Vet (5-Part CBC)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Laser 5-Part: NEU, LYM, MON, EOS, BAS</div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  :5100 5-PART
                </span>
              </button>

              <button
                onClick={() => onSimulateASTM3Part ? onSimulateASTM3Part(false) : onSimulateASTM(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/50 transition text-left group"
              >
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-purple-300 flex items-center gap-1.5">
                    <Play className="h-3.5 w-3.5 text-purple-400 fill-purple-400" />
                    <span>Mindray BC-2800 / Boule (3-Part CBC)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">3-Part: LYM, MID, GRAN (19 Parameters)</div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-purple-950 text-purple-400 border border-purple-800">
                  :5100 3-PART
                </span>
              </button>

              <button
                onClick={() => onSimulateASTM(true)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-rose-500/50 transition text-left group"
              >
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                    <span>Abnormal Hematology Alert Run</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Leukocytosis & Thrombocytopenia Flags</div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-rose-950 text-rose-400 border border-rose-800">
                  ALERT
                </span>
              </button>

              <button
                onClick={() => onSimulateHL7(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 transition text-left group"
              >
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 flex items-center gap-1.5">
                    <Play className="h-3.5 w-3.5 text-cyan-400 fill-cyan-400" />
                    <span>Mindray BS-240 / Roche Cobas</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Protocol: HL7 v2.3.1 (Liver, Renal & Lytes)</div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  :5101 HL7
                </span>
              </button>

            </div>
          </div>

          {/* Live Packet Log Stream */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span>Live Analyzer Packet Feed</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {rawLogs.length} Packets
              </span>
            </div>

            <div className="mt-3 space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {rawLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-mono">
                  Listening on 0.0.0.0:5100 (ASTM) and 0.0.0.0:5101 (HL7)...
                </div>
              ) : (
                rawLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedRawLog(log)}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-xs font-mono transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                        log.protocol === 'ASTM' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                      }`}>
                        {log.protocol}
                      </span>
                      <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-200 truncate">{log.parsed_summary || log.raw_data}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Raw Packet Inspector Modal */}
      {selectedRawLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-base">Raw Hardware Packet Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedRawLog(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500">Protocol:</span>
                <p className="font-bold text-emerald-400 font-mono mt-1">{selectedRawLog.protocol}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500">Source IP:</span>
                <p className="font-bold text-slate-200 font-mono mt-1">{selectedRawLog.source_ip}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500">Timestamp:</span>
                <p className="font-bold text-slate-200 font-mono mt-1">{new Date(selectedRawLog.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-400 block mb-1 font-mono">Raw Stream Payload (ASCII & Delimiters):</span>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto max-h-60 whitespace-pre-wrap">
                {selectedRawLog.raw_data}
              </pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedRawLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
