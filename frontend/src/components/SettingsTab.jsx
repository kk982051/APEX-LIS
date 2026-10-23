import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Building, 
  Users, 
  Shield, 
  Save, 
  LogOut, 
  Check, 
  Key, 
  Mail, 
  Phone, 
  MapPin, 
  Award, 
  RefreshCw,
  Edit3,
  UserCheck
} from 'lucide-react';
import axios from 'axios';

export default function SettingsTab({ 
  currentUser, 
  onUpdateCurrentUser, 
  onLogout 
}) {
  const [clinicData, setClinicData] = useState({
    clinic_name: '',
    address: '',
    phone: '',
    email: '',
    license_no: '',
    accreditation: '',
    auto_batch_approve: true
  });

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    full_name: '',
    title: '',
    email: '',
    pin_code: '',
    role: 'VET'
  });

  const [savingClinic, setSavingClinic] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [clinicSuccess, setClinicSuccess] = useState(false);
  const [userSuccess, setUserSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchUsers();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      setClinicData(res.data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/auth/users');
      setUsers(res.data);
      if (res.data.length > 0) {
        const active = res.data.find(u => u.username === currentUser?.username) || res.data[0];
        setSelectedUser(active);
        setUserFormData({
          full_name: active.full_name,
          title: active.title || '',
          email: active.email || '',
          pin_code: '',
          role: active.role
        });
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setUserFormData({
      full_name: user.full_name,
      title: user.title || '',
      email: user.email || '',
      pin_code: '',
      role: user.role
    });
    setUserSuccess(false);
  };

  const handleSaveClinicSettings = async (e) => {
    e.preventDefault();
    setSavingClinic(true);
    setClinicSuccess(false);
    try {
      await axios.put('/api/settings', clinicData);
      setClinicSuccess(true);
      setTimeout(() => setClinicSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingClinic(false);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSavingUser(true);
    setUserSuccess(false);
    try {
      const res = await axios.put(`/api/auth/users/${selectedUser.id}`, userFormData);
      setUserSuccess(true);
      fetchUsers();
      if (currentUser?.id === selectedUser.id) {
        onUpdateCurrentUser(res.data.user);
      }
      setTimeout(() => setUserSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-12">
      
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Sliders className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-100">System & Account Settings</h1>
            <p className="text-xs text-slate-400">Rename Laboratory, manage profiles for Admin, Vet & Lab Techs, and configure credentials</p>
          </div>
        </div>

        {/* Active Session Badge & Log Out */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-400">Active User:</span>
            <span className="font-bold text-slate-200">{currentUser?.full_name || 'Dr. Alex Taylor'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400">
              {currentUser?.role || 'VET'}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Grid: 2 Columns (Clinic Settings on Left, User Profile & Rename on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Card: Rename & Configure Clinic */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Building className="h-4 w-4 text-emerald-400" />
              <span>Veterinary Clinic / Reference Laboratory Information</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Report Header Data</span>
          </div>

          <form onSubmit={handleSaveClinicSettings} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Clinic / Laboratory Name *</label>
              <input
                type="text"
                required
                value={clinicData.clinic_name}
                onChange={(e) => setClinicData({ ...clinicData, clinic_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Apex Veterinary Reference Laboratory"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                <span>Physical Address</span>
              </label>
              <input
                type="text"
                value={clinicData.address}
                onChange={(e) => setClinicData({ ...clinicData, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                placeholder="e.g. 100 Innovation Parkway, Suite 400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  <span>Phone Number</span>
                </label>
                <input
                  type="text"
                  value={clinicData.phone}
                  onChange={(e) => setClinicData({ ...clinicData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                  placeholder="+1 (800) 555-0000"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  <span>Contact Email</span>
                </label>
                <input
                  type="email"
                  value={clinicData.email}
                  onChange={(e) => setClinicData({ ...clinicData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                  placeholder="diagnostics@clinic.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-slate-500" />
                  <span>Lab License / Registration No</span>
                </label>
                <input
                  type="text"
                  value={clinicData.license_no}
                  onChange={(e) => setClinicData({ ...clinicData, license_no: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-slate-500" />
                  <span>Accreditation Agency</span>
                </label>
                <input
                  type="text"
                  value={clinicData.accreditation}
                  onChange={(e) => setClinicData({ ...clinicData, accreditation: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-800">
              {clinicSuccess ? (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <Check className="h-4 w-4" /> Clinic Settings Saved!
                </span>
              ) : <span></span>}

              <button
                type="submit"
                disabled={savingClinic}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                <span>{savingClinic ? 'Saving...' : 'Save Clinic Details'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Card: User Accounts & Renaming */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" />
              <span>User Profiles & Professional Credentials</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">{users.length} Accounts</span>
          </div>

          {/* User Selector Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {users.map((u) => {
              const isSelected = selectedUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 border ${
                    isSelected 
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500' 
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{u.role === 'ADMIN' ? '🛡️' : u.role === 'VET' ? '🩺' : '🧪'}</span>
                  <span>{u.full_name}</span>
                </button>
              );
            })}
          </div>

          {/* Edit User Form */}
          {selectedUser && (
            <form onSubmit={handleSaveUser} className="space-y-4 text-xs pt-2">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Full Display Name (Used in Signatures & Reports) *</label>
                <input
                  type="text"
                  required
                  value={userFormData.full_name}
                  onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-bold focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Dr. Alex Taylor, DVM, DACVP"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Professional Title / Designation</label>
                <input
                  type="text"
                  value={userFormData.title}
                  onChange={(e) => setUserFormData({ ...userFormData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Board-Certified Veterinary Pathologist"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Role Permission Level</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-bold focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ADMIN">🛡️ Administrator</option>
                    <option value="VET">🩺 Veterinarian / Pathologist</option>
                    <option value="LAB">🧪 Lab Technician</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1 flex items-center justify-between">
                  <span>Change Security PIN Code</span>
                  <span className="text-[10px] text-slate-500">Leave blank to keep existing PIN</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    maxLength={8}
                    value={userFormData.pin_code}
                    onChange={(e) => setUserFormData({ ...userFormData, pin_code: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono tracking-widest focus:outline-none focus:border-cyan-500"
                    placeholder="Enter new 4-digit PIN"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                {userSuccess ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Check className="h-4 w-4" /> Profile Updated & Renamed!
                  </span>
                ) : <span></span>}

                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md transition flex items-center gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>{savingUser ? 'Updating...' : 'Save & Rename Profile'}</span>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>

    </div>
  );
}
