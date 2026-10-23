import React from 'react';
import { QrCode, Printer, X, Tag } from 'lucide-react';

export default function BarcodeModal({ isOpen, order, onClose }) {
  if (!isOpen || !order) return null;

  const samples = order.samples && order.samples.length > 0 ? order.samples : [
    { id: 1, barcode: `HEM${order.id}001`, tube_type: 'EDTA_LAVENDER', specimen_type: 'WHOLE_BLOOD' }
  ];

  const handlePrint = () => {
    window.print();
  };

  // Generate simple SVG 1D barcode stripes based on string
  const renderBarcodeSVG = (code) => {
    const bars = [];
    let x = 10;
    for (let i = 0; i < code.length; i++) {
      const charCode = code.charCodeAt(i);
      const width1 = (charCode % 3) + 1.5;
      const width2 = ((charCode * 2) % 3) + 1;
      bars.push(<rect key={`b1-${i}`} x={x} y="0" width={width1} height="36" fill="black" />);
      x += width1 + 1.5;
      bars.push(<rect key={`b2-${i}`} x={x} y="0" width={width2} height="36" fill="black" />);
      x += width2 + 2;
    }
    return (
      <svg className="w-full h-10" viewBox={`0 0 ${x + 10} 38`}>
        {bars}
      </svg>
    );
  };

  const getTubeColorClass = (tubeType) => {
    if (tubeType.includes('EDTA') || tubeType.includes('LAVENDER')) return 'bg-purple-600 text-white';
    if (tubeType.includes('SERUM') || tubeType.includes('RED')) return 'bg-rose-600 text-white';
    if (tubeType.includes('FLUORIDE') || tubeType.includes('GREY')) return 'bg-slate-500 text-white';
    if (tubeType.includes('HEPARIN') || tubeType.includes('GREEN')) return 'bg-emerald-600 text-white';
    return 'bg-blue-600 text-white';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 no-print">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Thermal Barcode Label Generator</h2>
              <p className="text-xs text-slate-400">Zebra / Dymo Standard 2x1" (50x25mm) Specimen Tube Stickers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Labels Container */}
        <div id="printable-section" className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {samples.map((s) => (
              <div 
                key={s.id}
                className="bg-white text-slate-900 border-2 border-slate-300 rounded-xl p-3 shadow-md font-sans text-xs flex flex-col justify-between h-[165px] relative overflow-hidden"
              >
                {/* Tube Type Color Stripe */}
                <div className={`absolute top-0 right-0 left-0 h-1.5 ${getTubeColorClass(s.tube_type)}`}></div>

                {/* Top Header */}
                <div className="flex items-center justify-between pt-1">
                  <div className="font-extrabold text-[10px] tracking-wider uppercase text-slate-800">
                    APEX VET LAB
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${getTubeColorClass(s.tube_type)}`}>
                    {s.tube_type.replace('_', ' ')}
                  </span>
                </div>

                {/* Patient Information */}
                <div className="mt-1">
                  <div className="font-black text-sm text-slate-950 flex items-center justify-between">
                    <span>{order.patient?.name}</span>
                    <span className="text-[10px] font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-300">
                      {order.patient?.species}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-700 font-medium">
                    MRN: <span className="font-mono">{order.patient?.mrn}</span> • {order.patient?.breed}
                  </div>
                </div>

                {/* Barcode SVG */}
                <div className="my-1 flex flex-col items-center">
                  {renderBarcodeSVG(s.barcode)}
                  <span className="font-mono font-black text-xs tracking-widest text-slate-900 mt-0.5">
                    {s.barcode}
                  </span>
                </div>

                {/* Footer details */}
                <div className="flex items-center justify-between text-[9px] text-slate-600 border-t border-slate-200 pt-1 font-mono">
                  <span>Acc: {order.accession_no}</span>
                  <span>{order.draw_date ? new Date(order.draw_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'STAT'}</span>
                </div>

              </div>
            ))}
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            <span>Print Thermal Labels (Zebra / Dymo)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
