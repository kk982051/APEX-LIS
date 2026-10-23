import React, { useState, useEffect } from 'react';
import { FileText, Printer, Download, X, ShieldCheck, CheckCircle2, AlertTriangle, QrCode } from 'lucide-react';
import axios from 'axios';

export default function ReportModal({ isOpen, orderId, onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchReport();
    }
  }, [isOpen, orderId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/reports/${orderId}/summary`);
      setReport(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl p-6 sm:p-8 shadow-2xl space-y-6 my-8">
        
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 no-print">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Diagnostic Laboratory Report</h2>
              <p className="text-xs text-slate-400 font-mono">Accession: {report?.order?.accession_no} • {report?.patient?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Diagnostic Report Body (Clean White Printable Canvas) */}
        {loading || !report ? (
          <div className="py-20 text-center font-mono text-xs text-slate-400">
            Rendering diagnostic report and cryptographic verification QR code...
          </div>
        ) : (
          <div id="printable-section" className="bg-white text-slate-900 rounded-2xl p-8 shadow-xl font-sans text-xs border border-slate-200 space-y-6">
            
            {/* Header / Lab Branding */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
                  {report.lab_info.name}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">{report.lab_info.address}</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Phone: {report.lab_info.phone} • Email: {report.lab_info.email}
                </p>
                <p className="text-[10px] text-emerald-800 font-semibold mt-1">
                  Accreditation: {report.lab_info.accreditation} ({report.lab_info.license})
                </p>
              </div>

              {/* QR Code & Authenticity Stamp */}
              <div className="flex flex-col items-center">
                {report.qr_code_base64 && (
                  <img 
                    src={report.qr_code_base64} 
                    alt="Authenticity QR" 
                    className="h-20 w-20 border border-slate-300 p-1 rounded-lg"
                  />
                )}
                <span className="text-[8px] font-mono text-slate-600 mt-1 font-bold">
                  HASH: {report.verification_hash}
                </span>
              </div>
            </div>

            {/* Patient & Order Demographics Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Patient Name</span>
                <span className="font-extrabold text-sm text-slate-900">{report.patient.name}</span>
                <span className="text-[11px] text-slate-600 block">{report.patient.species} ({report.patient.breed})</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">MRN & Microchip</span>
                <span className="font-mono font-bold text-slate-800">{report.patient.mrn}</span>
                <span className="text-[11px] text-slate-600 font-mono block">RFID: {report.patient.microchip_id}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Owner / Client</span>
                <span className="font-bold text-slate-800">{report.patient.owner_name}</span>
                <span className="text-[11px] text-slate-600 block">{report.patient.owner_phone}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Accession & Dates</span>
                <span className="font-mono font-bold text-slate-900">{report.order.accession_no}</span>
                <span className="text-[11px] text-slate-600 block">Drawn: {report.order.draw_date || 'STAT'}</span>
              </div>
            </div>

            {/* Grouped Results Categories */}
            {Object.entries(report.categories).map(([category, items]) => (
              <div key={category} className="space-y-2">
                <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>{category} PROFILE</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-normal">
                    Species Reference: {report.patient.species}
                  </span>
                </div>

                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600 text-[10px] uppercase font-mono">
                      <th className="py-2 px-2">Parameter</th>
                      <th className="py-2 px-2">Result Value</th>
                      <th className="py-2 px-2">Units</th>
                      <th className="py-2 px-2">Reference Interval</th>
                      <th className="py-2 px-2">Flag</th>
                      <th className="py-2 px-2">Delta (Prev)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item) => (
                      <tr key={item.id} className={item.flag !== 'NORMAL' ? 'bg-amber-50/50' : ''}>
                        <td className="py-2 px-2 font-bold text-slate-900">
                          {item.test_name} <span className="font-mono text-slate-500 font-normal">({item.test_code})</span>
                        </td>
                        <td className="py-2 px-2 font-mono font-black text-sm text-slate-950">
                          {item.result_value !== null ? item.result_value : item.result_str}
                        </td>
                        <td className="py-2 px-2 font-mono text-slate-600">{item.unit || '-'}</td>
                        <td className="py-2 px-2 font-mono text-slate-700">
                          {item.ref_low !== null && item.ref_high !== null ? `${item.ref_low} - ${item.ref_high}` : 'N/A'}
                        </td>
                        <td className="py-2 px-2">
                          {item.flag === 'NORMAL' ? (
                            <span className="font-bold text-emerald-700">NORMAL</span>
                          ) : item.flag.includes('CRITICAL') ? (
                            <span className="font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded text-[10px]">
                              {item.flag}
                            </span>
                          ) : (
                            <span className="font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                              {item.flag}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 font-mono text-slate-600 text-[11px]">
                          {item.prev_value !== null ? `${item.prev_value} (${item.delta_percent > 0 ? '+' : ''}${item.delta_percent}%)` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Pathologist Comments & Sign-Off Stamp */}
            <div className="border-t-2 border-slate-300 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="max-w-md">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Clinical Diagnostic Notes</span>
                <p className="text-xs text-slate-800 italic mt-0.5">
                  {report.order.verification_notes || 'All laboratory values verified by attending veterinary clinical pathologist.'}
                </p>
              </div>

              {/* Signature Block */}
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-50 flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-emerald-700" />
                <div>
                  <div className="font-extrabold text-xs text-slate-900">{report.order.verified_by}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Electronically Signed: {report.order.verified_at || 'Pending Release'}
                  </div>
                  <div className="text-[9px] text-emerald-700 font-bold uppercase">
                    Status: {report.order.status}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
