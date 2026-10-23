import React, { useState, useEffect } from 'react';
import { Edit3, Calendar, Clock, AlertCircle, X, Check } from 'lucide-react';

export default function EditOrderModal({ isOpen, order, onClose, onSave }) {
  const [formData, setFormData] = useState({
    draw_date: '',
    order_date: '',
    priority: 'ROUTINE',
    clinical_notes: '',
    status: 'PENDING'
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({
        draw_date: order.draw_date ? new Date(order.draw_date).toISOString().slice(0, 16) : '',
        order_date: order.order_date ? new Date(order.order_date).toISOString().slice(0, 16) : '',
        priority: order.priority || 'ROUTINE',
        clinical_notes: order.clinical_notes || '',
        status: order.status || 'PENDING'
      });
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(order.id, {
        draw_date: formData.draw_date ? new Date(formData.draw_date).toISOString() : null,
        order_date: formData.order_date ? new Date(formData.order_date).toISOString() : null,
        priority: formData.priority,
        clinical_notes: formData.clinical_notes,
        status: formData.status
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Edit Workorder Details</h2>
              <p className="text-xs text-slate-400 font-mono">{order.accession_no} • {order.patient?.name} ({order.patient?.species})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Specimen Collection / Draw Date & Time</label>
            <input
              type="datetime-local"
              value={formData.draw_date}
              onChange={(e) => setFormData({ ...formData, draw_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Order Registration Timestamp</label>
            <input
              type="datetime-local"
              value={formData.order_date}
              onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">STAT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Order Lifecycle Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="PENDING">PENDING</option>
                <option value="INGESTED">INGESTED</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Clinical Notes</label>
            <textarea
              rows={3}
              value={formData.clinical_notes}
              onChange={(e) => setFormData({ ...formData, clinical_notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              placeholder="Clinical symptoms, doctor instructions..."
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition flex items-center gap-2"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
