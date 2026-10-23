import React, { useState, useEffect } from 'react';
import { 
  LineChart as LineChartIcon, 
  PlusCircle, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  RefreshCw, 
  Sliders, 
  Info,
  Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine, 
  CartesianGrid 
} from 'recharts';
import axios from 'axios';

export default function QCLeveyJennings() {
  const [lots, setLots] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [ljData, setLjData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newRunValue, setNewRunValue] = useState('');
  const [newRunNotes, setNewRunNotes] = useState('');
  const [loggingRun, setLoggingRun] = useState(false);

  useEffect(() => {
    fetchLots();
  }, []);

  useEffect(() => {
    if (selectedLotId) {
      fetchLJData(selectedLotId);
    }
  }, [selectedLotId]);

  const fetchLots = async () => {
    try {
      const res = await axios.get('/api/qc/lots');
      setLots(res.data);
      if (res.data.length > 0 && !selectedLotId) {
        setSelectedLotId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLJData = async (lotId) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/qc/lots/${lotId}/levey-jennings`);
      setLjData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogRun = async (e) => {
    e.preventDefault();
    if (!newRunValue || !selectedLotId) return;
    setLoggingRun(true);
    try {
      await axios.post('/api/qc/runs', {
        qc_lot_id: selectedLotId,
        value: parseFloat(newRunValue),
        notes: newRunNotes || 'Daily control run'
      });
      setNewRunValue('');
      setNewRunNotes('');
      fetchLJData(selectedLotId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoggingRun(false);
    }
  };

  const selectedLot = lots.find(l => l.id === selectedLotId);

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-12">
      
      {/* Top Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <LineChartIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-100">Quality Control & Levey-Jennings Hub</h1>
            <p className="text-xs text-slate-400">Multi-Rule Westgard Engine (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x) & Calibration Analytics</p>
          </div>
        </div>

        {/* Lot Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-400">Active QC Lot:</label>
          <select
            value={selectedLotId || ''}
            onChange={(e) => setSelectedLotId(parseInt(e.target.value))}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
          >
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.analyzer_name} • {l.test_code} ({l.lot_number})
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedLotId && fetchLJData(selectedLotId)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Levey Jennings Chart & Stats */}
      {ljData && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* Main Chart Column (3 Cols) */}
          <div className="xl:col-span-3 space-y-6">
            
            {/* Levey-Jennings Chart Container */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>Levey-Jennings Control Chart: {ljData.test_code}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
                      Target Mean: {ljData.target_mean} (SD: ±{ljData.target_sd})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">Lot: {ljData.lot_number} • Instrument: {ljData.analyzer_name}</p>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold"><span className="h-2 w-2 rounded-full bg-emerald-400"></span> PASS</span>
                  <span className="flex items-center gap-1 text-amber-400 font-bold"><span className="h-2 w-2 rounded-full bg-amber-400"></span> 1_2s WARNING</span>
                  <span className="flex items-center gap-1 text-rose-400 font-bold"><span className="h-2 w-2 rounded-full bg-rose-400"></span> REJECT</span>
                </div>
              </div>

              {/* Chart */}
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ljData.points} margin={{ top: 15, right: 30, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="run_time" stroke="#94a3b8" fontSize={10} tickFormatter={(val) => val.slice(5, 10)} />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={10} 
                      domain={[
                        (dataMin) => Math.min(dataMin, ljData.limits.minus_3sd * 0.98),
                        (dataMax) => Math.max(dataMax, ljData.limits.plus_3sd * 1.02)
                      ]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                      formatter={(val, name, item) => [
                        `${val} (Z: ${item.payload.z_score})`, 
                        item.payload.status === 'PASS' ? 'Normal' : `Violation: ${item.payload.rule_violated || 'Warning'}`
                      ]}
                    />

                    {/* Reference Lines */}
                    <ReferenceLine y={ljData.limits.mean} stroke="#10b981" strokeDasharray="4 4" label={{ value: `Mean: ${ljData.limits.mean}`, fill: '#10b981', fontSize: 10 }} />
                    <ReferenceLine y={ljData.limits.plus_1sd} stroke="#64748b" strokeDasharray="2 2" label={{ value: `+1s`, fill: '#64748b', fontSize: 9 }} />
                    <ReferenceLine y={ljData.limits.minus_1sd} stroke="#64748b" strokeDasharray="2 2" label={{ value: `-1s`, fill: '#64748b', fontSize: 9 }} />
                    <ReferenceLine y={ljData.limits.plus_2sd} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `+2s (Warn)`, fill: '#f59e0b', fontSize: 9 }} />
                    <ReferenceLine y={ljData.limits.minus_2sd} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `-2s (Warn)`, fill: '#f59e0b', fontSize: 9 }} />
                    <ReferenceLine y={ljData.limits.plus_3sd} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `+3s (Reject)`, fill: '#ef4444', fontSize: 9 }} />
                    <ReferenceLine y={ljData.limits.minus_3sd} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `-3s (Reject)`, fill: '#ef4444', fontSize: 9 }} />

                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#38bdf8" 
                      strokeWidth={2}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        const fill = payload.status === 'REJECT' ? '#ef4444' : payload.status === 'WARNING' ? '#f59e0b' : '#10b981';
                        return <circle key={`dot-${payload.id}`} cx={cx} cy={cy} r={payload.status === 'PASS' ? 4 : 6} fill={fill} stroke="#0f172a" strokeWidth={2} />;
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

            </div>

            {/* Run History Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">QC Control Run Log</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 font-mono text-[10px] text-slate-400 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Run Timestamp</th>
                      <th className="py-2.5 px-3">Measured Value</th>
                      <th className="py-2.5 px-3">Z-Score (SD)</th>
                      <th className="py-2.5 px-3">Westgard Status</th>
                      <th className="py-2.5 px-3">Violation</th>
                      <th className="py-2.5 px-3">Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {ljData.points.slice().reverse().map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-slate-400">{p.run_time}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-100">{p.value}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-300">{p.z_score > 0 ? `+${p.z_score}` : p.z_score}</td>
                        <td className="py-2.5 px-3">
                          {p.status === 'PASS' ? (
                            <span className="text-emerald-400 font-bold">PASS</span>
                          ) : p.status === 'WARNING' ? (
                            <span className="text-amber-400 font-bold">WARNING</span>
                          ) : (
                            <span className="text-rose-400 font-bold">REJECT</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{p.rule_violated || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-500">{p.operator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: Record Run Form + Statistical Summary + Westgard Rules Reference */}
          <div className="xl:col-span-1 space-y-6">
            
            {/* Quick Log Run Form */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                <span>Log Daily Control Run</span>
              </h3>

              <form onSubmit={handleLogRun} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Measured Value ({ljData.test_code})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder={`e.g. ${ljData.target_mean}`}
                    value={newRunValue}
                    onChange={(e) => setNewRunValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Notes / Reagent Lot</label>
                  <input
                    type="text"
                    placeholder="e.g. Morning baseline run"
                    value={newRunNotes}
                    onChange={(e) => setNewRunNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loggingRun}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition"
                >
                  {loggingRun ? 'Evaluating Westgard...' : 'Submit & Evaluate Rules'}
                </button>
              </form>
            </div>

            {/* Statistical Performance Metrics */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Statistical Performance</h3>
              
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Total Runs:</span>
                  <span className="font-bold text-slate-100">{ljData.statistics.total_runs}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Observed Mean:</span>
                  <span className="font-bold text-emerald-400">{ljData.statistics.calculated_mean}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Observed SD:</span>
                  <span className="font-bold text-slate-200">{ljData.statistics.calculated_sd}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">CV% (Variance):</span>
                  <span className="font-bold text-cyan-400">{ljData.statistics.cv_percent}%</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Rejections:</span>
                  <span className="font-bold text-rose-400">{ljData.statistics.rejections}</span>
                </div>
              </div>
            </div>

            {/* Westgard Rules Guide */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Info className="h-4 w-4" />
                <span>Westgard Rules Reference</span>
              </h3>

              <div className="space-y-2 text-[11px] text-slate-400">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="font-bold text-amber-300 font-mono">1_2s (Warning):</span> 1 value exceeds ±2SD.
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="font-bold text-rose-400 font-mono">1_3s (Reject):</span> 1 value exceeds ±3SD. Random error.
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="font-bold text-rose-400 font-mono">2_2s (Reject):</span> 2 consecutive runs exceed +2SD or -2SD. Systematic error.
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="font-bold text-rose-400 font-mono">R_4s (Reject):</span> Range between consecutive runs &gt; 4SD.
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="font-bold text-rose-400 font-mono">4_1s (Reject):</span> 4 consecutive runs on one side exceed 1SD.
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="font-bold text-rose-400 font-mono">10_x (Reject):</span> 10 consecutive runs fall on same side of mean.
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
