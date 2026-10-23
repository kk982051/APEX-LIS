import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Wifi, 
  Server, 
  Cpu, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  RefreshCw, 
  Layers, 
  Zap, 
  HelpCircle,
  Laptop
} from 'lucide-react';
import axios from 'axios';

export default function NetworkConfigTab({
  networkStatus,
  onRefreshNetwork,
  onSimulateASTM,
  onSimulateHL7
}) {
  const [simSpecies, setSimSpecies] = useState('CANINE');
  const [simAbnormal, setSimAbnormal] = useState(false);
  const [simBarcode, setSimBarcode] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const fetchDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const res = await axios.get('/api/system/diagnostics');
      setDiagnostics(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setDiagLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleRunSim = async (protocol) => {
    setSimulating(true);
    setSimResult(null);
    try {
      const endpoint = protocol === 'ASTM' ? '/api/analyzers/simulate/astm' : '/api/analyzers/simulate/hl7';
      const res = await axios.post(endpoint, null, {
        params: {
          barcode: simBarcode || undefined,
          species: simSpecies,
          abnormal: simAbnormal,
          use_tcp: true
        }
      });
      setSimResult(res.data);
    } catch (err) {
      console.error(err);
      setSimResult({ status: 'ERROR', error: err.message });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-12">
      
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-100">LAN & Hardware Interfacing Hub</h1>
            <p className="text-xs text-slate-400">Host IP Detector, Socket Port Health, Analyzer RS-232 / TCP Wiring Guides & Simulator</p>
          </div>
        </div>

        <button
          onClick={onRefreshNetwork}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Port Health</span>
        </button>
      </div>

      {/* Grid: Network Port Status & Live Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Network & Port Health */}
        <div className="space-y-6">
          
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Server className="h-4 w-4 text-cyan-400" />
              <span>Clinic LAN Host Configuration</span>
            </h3>

            {networkStatus ? (
              <div className="space-y-3">
                
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Server Hostname:</span>
                    <span className="font-bold text-slate-200">{networkStatus.hostname}</span>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Primary LAN IP:</span>
                    <span className="font-black text-emerald-400 text-sm">{networkStatus.primary_lan_ip}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Active Listening Sockets & Ports
                  </span>

                  {Object.entries(networkStatus.ports || {}).map(([key, p]) => (
                    <div key={key} className="flex items-center justify-between text-xs py-1 border-b border-slate-900 last:border-0 font-mono">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${p.active ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-600'}`}></span>
                        <span className="text-slate-200 font-bold">Port {p.port}</span>
                        <span className="text-slate-500 text-[11px]">({p.protocol})</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        p.active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {p.active ? 'LISTENING' : 'OFFLINE'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* LAN Endpoints */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs font-mono">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Clinic Workstation Access URLs:</span>
                  <div className="text-slate-300">Tablet / Reception UI: <span className="text-cyan-400 select-all font-bold">{networkStatus.connection_urls?.workstation_lan}</span></div>
                  <div className="text-slate-300">ASTM Hematology Target: <span className="text-emerald-400 select-all font-bold">{networkStatus.connection_urls?.astm_target}</span></div>
                  <div className="text-slate-300">HL7 Biochemistry Target: <span className="text-purple-400 select-all font-bold">{networkStatus.connection_urls?.hl7_target}</span></div>
                </div>

              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">
                Detecting local network interfaces...
              </div>
            )}
          </div>

          {/* Moxa / Serial RS-232 to TCP Bridge Guide */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Laptop className="h-4 w-4 text-amber-400" />
              <span>RS-232 to Ethernet Serial Bridge Guide</span>
            </h3>

            <p className="text-xs text-slate-400">
              For legacy RS-232 serial analyzers (DB9 port), use a Moxa NPort 5110 or USR-TCP232-302 serial-to-ethernet converter configured in <strong className="text-slate-200">TCP Client Mode</strong>:
            </p>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-mono space-y-2 text-slate-300">
              <div className="text-amber-400 font-bold">Standard Pinout (DB9 Null Modem Cable):</div>
              <div>• Pin 2 (RxD) ➔ Pin 3 (TxD)</div>
              <div>• Pin 3 (TxD) ➔ Pin 2 (RxD)</div>
              <div>• Pin 5 (GND) ➔ Pin 5 (GND)</div>
              <div className="pt-2 text-slate-400">Baud Rate: 9600 • Data Bits: 8 • Parity: None • Stop Bits: 1 • Flow: None</div>
              <div className="text-slate-400">Destination IP: {networkStatus?.primary_lan_ip || '192.168.1.8'} • Port: 5100</div>
            </div>
          </div>

        </div>

        {/* Right Column: Interactive Hardware Ingestion Simulator */}
        <div className="space-y-6">
          
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span>Interactive Hardware Simulator</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                Direct Socket Injection
              </span>
            </div>

            <div className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-400 font-medium mb-1">Target Specimen Barcode (Optional - auto-creates if empty)</label>
                <input
                  type="text"
                  placeholder="e.g. HEM575409 or leave empty"
                  value={simBarcode}
                  onChange={(e) => setSimBarcode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Simulated Species</label>
                  <select
                    value={simSpecies}
                    onChange={(e) => setSimSpecies(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CANINE">🐕 Canine (Dog)</option>
                    <option value="FELINE">🐈 Feline (Cat)</option>
                    <option value="EQUINE">🐎 Equine (Horse)</option>
                    <option value="BOVINE">🐄 Bovine (Cattle)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Result Profile</label>
                  <select
                    value={simAbnormal ? 'ABNORMAL' : 'NORMAL'}
                    onChange={(e) => setSimAbnormal(e.target.value === 'ABNORMAL')}
                    className={`w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-bold focus:outline-none ${
                      simAbnormal ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    <option value="NORMAL">Normal Reference Values</option>
                    <option value="ABNORMAL">Abnormal & Critical Flags</option>
                  </select>
                </div>
              </div>

              {/* Simulation Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => handleRunSim('ASTM')}
                  disabled={simulating}
                  className="p-4 rounded-2xl bg-gradient-to-tr from-slate-950 to-slate-900 border border-emerald-500/40 hover:border-emerald-500 text-left transition group shadow-md"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-100 group-hover:text-emerald-300">
                      GFE QuickCell Vet (CBC)
                    </span>
                    <Play className="h-4 w-4 text-emerald-400 fill-emerald-400" />
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">ASTM E1394 ➔ TCP Port 5100</div>
                </button>

                <button
                  onClick={() => handleRunSim('HL7')}
                  disabled={simulating}
                  className="p-4 rounded-2xl bg-gradient-to-tr from-slate-950 to-slate-900 border border-cyan-500/40 hover:border-cyan-500 text-left transition group shadow-md"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-100 group-hover:text-cyan-300">
                      Mindray BS-240 (Chemistry)
                    </span>
                    <Play className="h-4 w-4 text-cyan-400 fill-cyan-400" />
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">HL7 ORU^R01 ➔ TCP Port 5101</div>
                </button>
              </div>

              {/* Simulation Output Log */}
              {simResult && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Hardware Simulation Ingested Successfully!</span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto">
                    {JSON.stringify(simResult, null, 2)}
                  </pre>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* System Diagnostics & Self-Healing Health Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span>Full System Self-Diagnostics & Error Inspector</span>
            </h3>
            <p className="text-xs text-slate-400">Automated end-to-end health test across Database, Protocol Decoders, Multi-Species Normalization, and Socket Listeners</p>
          </div>
          <button
            onClick={fetchDiagnostics}
            disabled={diagLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`h-4 w-4 ${diagLoading ? 'animate-spin' : ''}`} />
            <span>{diagLoading ? 'Testing...' : 'Run Diagnostics'}</span>
          </button>
        </div>

        {diagnostics && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {diagnostics.checks.map((c, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-200">{c.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      c.status === 'HEALTHY' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                      c.status === 'STANDBY' ? 'bg-amber-950 text-amber-400 border-amber-800' :
                      'bg-rose-950 text-rose-400 border-rose-800'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">{c.details}</p>
                </div>
              ))}
            </div>

            {/* Error Log Viewer if any errors exist */}
            {diagnostics.recent_errors && diagnostics.recent_errors.length > 0 && (
              <div className="mt-4 p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-rose-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>Recent Hardware Ingestion Errors ({diagnostics.recent_errors.length})</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
                  {diagnostics.recent_errors.map((err) => (
                    <div key={err.id} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-rose-300 font-mono">[{err.protocol}] {err.status}</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">{err.error_message || 'Malformed frame'}</p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{err.timestamp ? err.timestamp.slice(11, 19) : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
