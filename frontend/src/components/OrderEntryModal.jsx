import React, { useState } from 'react';
import { PlusCircle, User, Activity, Calendar, FileText, Check, X, ShieldAlert, Sparkles } from 'lucide-react';

export default function OrderEntryModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    species: 'CANINE',
    breed: 'Golden Retriever',
    age_years: 3,
    age_months: 0,
    gender: 'MALE_NEUTERED',
    microchip_id: '',
    owner_name: '',
    owner_phone: '',
    owner_email: '',
    priority: 'ROUTINE',
    panels: ['CBC', 'CHEMISTRY'],
    clinical_notes: '',
    draw_date: new Date().toISOString().slice(0, 16)
  });

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const availablePanels = [
    { id: 'CBC', name: '5-Part CBC Hematology', tube: 'Lavender EDTA (Whole Blood)', color: 'border-purple-500/40 bg-purple-500/10 text-purple-300' },
    { id: 'CHEMISTRY', name: 'Comprehensive Chemistry (LFT/KFT)', tube: 'Red/Gold Serum Separator', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
    { id: 'ELECTROLYTES', name: 'Electrolytes (Na+, K+, Cl-, Ca2+)', tube: 'Green Heparin / Serum', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    { id: 'URINALYSIS', name: 'Urinalysis & Sedimentation', tube: 'Sterile Urine Conical', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  ];

  const handleTogglePanel = (panelId) => {
    setFormData((prev) => {
      const exists = prev.panels.includes(panelId);
      const newPanels = exists ? prev.panels.filter(p => p !== panelId) : [...prev.panels, panelId];
      return { ...prev, panels: newPanels.length > 0 ? newPanels : ['CBC'] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        patient: {
          name: formData.name,
          species: formData.species,
          breed: formData.breed,
          age_years: parseFloat(formData.age_years) || 1,
          age_months: parseFloat(formData.age_months) || 0,
          gender: formData.gender,
          microchip_id: formData.microchip_id || null,
          owner_name: formData.owner_name || 'Standard Client',
          owner_phone: formData.owner_phone || '',
          owner_email: formData.owner_email || null
        },
        priority: formData.priority,
        panel_types: formData.panels,
        clinical_notes: formData.clinical_notes,
        draw_date: formData.draw_date ? new Date(formData.draw_date).toISOString() : new Date().toISOString()
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Pet Registration & Diagnostic Workorder</h2>
              <p className="text-xs text-slate-400">Creates patient record, assigns test profiles, and generates thermal barcodes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Pet Demographics */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>1. Pet Demographics & Species Classification</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Pet Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Max, Luna, Bella"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Species *</label>
                <select
                  value={formData.species}
                  onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="CANINE">🐕 Canine (Dog)</option>
                  <option value="FELINE">🐈 Feline (Cat)</option>
                  <option value="EQUINE">🐎 Equine (Horse)</option>
                  <option value="BOVINE">🐄 Bovine (Cattle)</option>
                  <option value="AVIAN">🦜 Avian (Bird)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Breed</label>
                <input
                  type="text"
                  placeholder="e.g. Golden Retriever, Persian"
                  value={formData.breed}
                  onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Age (Years & Months)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Yrs"
                    value={formData.age_years}
                    onChange={(e) => setFormData({ ...formData, age_years: e.target.value })}
                    className="w-1/2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    min="0"
                    max="11"
                    placeholder="Mos"
                    value={formData.age_months}
                    onChange={(e) => setFormData({ ...formData, age_months: e.target.value })}
                    className="w-1/2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Sex / Reproductive Status</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="MALE_NEUTERED">Male Neutered</option>
                  <option value="MALE">Male Intact</option>
                  <option value="FEMALE_SPAYED">Female Spayed</option>
                  <option value="FEMALE">Female Intact</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Microchip / RFID No</label>
                <input
                  type="text"
                  placeholder="e.g. 9851410029..."
                  value={formData.microchip_id}
                  onChange={(e) => setFormData({ ...formData, microchip_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

            </div>
          </div>

          {/* Section 2: Owner Contact */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>2. Client & Pet Owner Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Owner Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+1 (555) 000-0000"
                  value={formData.owner_phone}
                  onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email (For Automated Reports)</label>
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={formData.owner_email}
                  onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Diagnostic Panels & Specimen Tube Routing */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span>3. Test Panels & Automated Specimen Tube Routing</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availablePanels.map((p) => {
                const selected = formData.panels.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleTogglePanel(p.id)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      selected ? p.color : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-200">{p.name}</div>
                      <div className="text-[11px] opacity-80 mt-0.5">Specimen: {p.tube}</div>
                    </div>
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center border ${
                      selected ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold' : 'border-slate-700'
                    }`}>
                      {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Collection Date, Priority & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Specimen Draw Time</label>
              <input
                type="datetime-local"
                value={formData.draw_date}
                onChange={(e) => setFormData({ ...formData, draw_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-bold text-amber-300"
              >
                <option value="ROUTINE">Routine Run</option>
                <option value="URGENT">Urgent Review</option>
                <option value="STAT">STAT (Critical Immediate)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Clinical Notes / History</label>
              <input
                type="text"
                placeholder="e.g. Pre-surgical screen, lethargy..."
                value={formData.clinical_notes}
                onChange={(e) => setFormData({ ...formData, clinical_notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
            >
              {loading ? (
                <span>Generating Barcodes...</span>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Create Order & Generate Barcodes</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
