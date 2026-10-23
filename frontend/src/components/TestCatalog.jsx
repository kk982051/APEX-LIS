import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Filter, Edit3, Check, X, Shield, PlusCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function TestCatalog() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSpecies, setSelectedSpecies] = useState('CANINE');
  const [editingRange, setEditingRange] = useState(null); // { testCode, species, low, high, clow, chigh, unit }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/tests');
      setTests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['ALL', 'HEMATOLOGY', 'BIOCHEMISTRY', 'ELECTROLYTES'];
  const speciesList = ['CANINE', 'FELINE', 'EQUINE', 'BOVINE', 'AVIAN'];

  const filteredTests = tests.filter((t) => {
    const matchSearch = t.code.toLowerCase().includes(searchQuery.toLowerCase()) || t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === 'ALL' || t.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const handleEditClick = (testCode, ref) => {
    setEditingRange({
      testCode,
      species: selectedSpecies,
      low_val: ref ? ref.low_val : 0,
      high_val: ref ? ref.high_val : 0,
      critical_low: ref ? ref.critical_low : '',
      critical_high: ref ? ref.critical_high : '',
      unit: ref ? ref.unit : ''
    });
  };

  const handleSaveRange = async () => {
    if (!editingRange) return;
    setSaving(true);
    try {
      await axios.put(`/api/tests/${editingRange.testCode}/ranges/${editingRange.species}`, {
        species: editingRange.species,
        low_val: parseFloat(editingRange.low_val),
        high_val: parseFloat(editingRange.high_val),
        critical_low: editingRange.critical_low ? parseFloat(editingRange.critical_low) : null,
        critical_high: editingRange.critical_high ? parseFloat(editingRange.critical_high) : null,
        unit: editingRange.unit
      });
      setEditingRange(null);
      fetchTests();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-12">
      
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-100">Multi-Species Reference Range Catalog</h1>
            <p className="text-xs text-slate-400">Clinical reference intervals, critical panic limits, and delta check thresholds</p>
          </div>
        </div>

        {/* Species Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          {speciesList.map((sp) => (
            <button
              key={sp}
              onClick={() => setSelectedSpecies(sp)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedSpecies === sp
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sp === 'CANINE' ? '🐕 Canine' : sp === 'FELINE' ? '🐈 Feline' : sp === 'EQUINE' ? '🐎 Equine' : sp === 'BOVINE' ? '🐄 Bovine' : '🦜 Avian'}
            </button>
          ))}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Test Code or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-slate-100 border border-slate-700'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 font-mono text-[10px] text-slate-400 uppercase tracking-wider border-y border-slate-800">
              <tr>
                <th className="py-3 px-3">Test Code</th>
                <th className="py-3 px-3">Test Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Units</th>
                <th className="py-3 px-3">{selectedSpecies} Normal Interval</th>
                <th className="py-3 px-3">Critical Panic Low / High</th>
                <th className="py-3 px-3">Delta Limit %</th>
                <th className="py-3 px-3 text-right">Edit Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredTests.map((tm) => {
                const spRef = tm.reference_ranges?.find(r => r.species === selectedSpecies) || tm.reference_ranges?.find(r => r.species === 'ALL');
                return (
                  <tr key={tm.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">{tm.code}</td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{tm.name}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 font-mono text-[10px] border border-slate-800">
                        {tm.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">{tm.default_unit || '-'}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-100">
                      {spRef ? `${spRef.low_val} - ${spRef.high_val}` : <span className="text-slate-600">Not Configured</span>}
                    </td>
                    <td className="py-3 px-3 font-mono text-rose-400">
                      {spRef && (spRef.critical_low || spRef.critical_high) 
                        ? `< ${spRef.critical_low || '-'} / > ${spRef.critical_high || '-'}` 
                        : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="py-3 px-3 font-mono text-cyan-400">
                      ±{tm.delta_limit_percent || 25}%
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleEditClick(tm.code, spRef)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* Edit Reference Range Modal */}
      {editingRange && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-base">
                Edit {editingRange.species} Interval: <span className="text-emerald-400 font-mono">{editingRange.testCode}</span>
              </h3>
              <button onClick={() => setEditingRange(null)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Normal Low Value *</label>
                <input
                  type="number"
                  step="any"
                  value={editingRange.low_val}
                  onChange={(e) => setEditingRange({ ...editingRange, low_val: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Normal High Value *</label>
                <input
                  type="number"
                  step="any"
                  value={editingRange.high_val}
                  onChange={(e) => setEditingRange({ ...editingRange, high_val: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Critical Low (Panic)</label>
                <input
                  type="number"
                  step="any"
                  value={editingRange.critical_low}
                  onChange={(e) => setEditingRange({ ...editingRange, critical_low: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-rose-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Critical High (Panic)</label>
                <input
                  type="number"
                  step="any"
                  value={editingRange.critical_high}
                  onChange={(e) => setEditingRange({ ...editingRange, critical_high: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-rose-400 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingRange(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRange}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950"
              >
                {saving ? 'Saving...' : 'Save Interval'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
