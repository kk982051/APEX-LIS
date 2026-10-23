import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios, { getWebSocketUrl } from './api';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import VerificationWorkstation from './components/VerificationWorkstation';
import QCLeveyJennings from './components/QCLeveyJennings';
import TestCatalog from './components/TestCatalog';
import NetworkConfigTab from './components/NetworkConfigTab';
import SettingsTab from './components/SettingsTab';
import LoginModal from './components/LoginModal';
import OrderEntryModal from './components/OrderEntryModal';
import EditOrderModal from './components/EditOrderModal';
import BarcodeModal from './components/BarcodeModal';
import ReportModal from './components/ReportModal';
import { Bell, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [rawLogs, setRawLogs] = useState([]);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  
  // User Authentication & Session State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('apex_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(!currentUser);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('apex_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
    setIsLoginModalOpen(false);
    addToast('Welcome Back', `Logged in as ${user.full_name} (${user.role})`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('apex_user');
    } catch (e) {
      console.error(e);
    }
    setIsLoginModalOpen(true);
    addToast('Session Ended', 'You have been logged out.', 'info');
  };

  const handleUpdateCurrentUser = (updatedUser) => {
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('apex_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.error(e);
    }
  };

  // Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editOrderData, setEditOrderData] = useState(null);
  const [barcodeOrderData, setBarcodeOrderData] = useState(null);
  const [reportOrderId, setReportOrderId] = useState(null);

  // Live Toast Notifications
  const [toasts, setToasts] = useState([]);

  const toastIdRef = useRef(0);
  const addToast = (title, message, type = 'info') => {
    toastIdRef.current += 1;
    const id = `${Date.now()}-${toastIdRef.current}`;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get('/api/orders');
      setOrders(res.data);
      if (res.data.length > 0) {
        setSelectedOrderId(prev => prev ?? res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  }, []);

  const fetchRawLogs = useCallback(async () => {
    try {
      const res = await axios.get('/api/analyzers/raw-logs?limit=30');
      setRawLogs(res.data);
    } catch (err) {
      console.error('Error fetching raw logs:', err);
    }
  }, []);

  const fetchNetworkStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/analyzers/network-status');
      setNetworkStatus(res.data);
    } catch (err) {
      console.error('Error fetching network status:', err);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchOrders();
    fetchRawLogs();
    fetchNetworkStatus();
  }, [fetchOrders, fetchRawLogs, fetchNetworkStatus]);

  // WebSocket Live Real-Time Stream
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let disposed = false;

    const connectWebSocket = () => {
      if (disposed) return;
      try {
        const wsUrl = getWebSocketUrl();
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ANALYZER_PACKET_RECEIVED') {
              addToast(
                'Analyzer Packet Ingested',
                `${data.analyzer}: ${data.result_count} results for ${data.patient_name} (${data.barcode})`,
                'success'
              );
              fetchOrders();
              fetchRawLogs();
            } else if (data.type === 'ORDER_VERIFIED') {
              addToast(
                'Order Verified & Signed',
                `Accession ${data.accession_no} released by ${data.verified_by}`,
                'info'
              );
              fetchOrders();
            } else if (data.type === 'BATCH_APPROVAL_COMPLETED') {
              addToast(
                '1-Click Batch Approval',
                `Approved and verified ${data.count} normal workorders.`,
                'success'
              );
              fetchOrders();
            }
          } catch (e) {
            // ignore plain text ping/pong
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (!disposed) reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch (err) {
        console.error('WebSocket connection error:', err);
        setWsConnected(false);
        if (!disposed) reconnectTimeout = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      disposed = true;
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [fetchOrders, fetchRawLogs]);

  // Action Handlers
  const handleCreateOrder = async (orderPayload) => {
    try {
      const res = await axios.post('/api/orders', orderPayload);
      addToast('Workorder Created', `Accession ${res.data.accession_no} registered successfully.`, 'success');
      fetchOrders();
      // Prompt thermal barcode printing
      setBarcodeOrderData(res.data);
    } catch (err) {
      console.error(err);
      addToast('Error', 'Failed to create order', 'error');
    }
  };

  const handleUpdateOrder = async (orderId, updatePayload) => {
    try {
      await axios.put(`/api/orders/${orderId}`, updatePayload);
      addToast('Order Updated', 'Changes saved successfully.', 'success');
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyOrder = async (orderId, verifyPayload) => {
    try {
      await axios.post(`/api/results/verify/${orderId}`, verifyPayload);
      addToast('Verification Complete', 'Diagnostic report electronically signed.', 'success');
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateResultItem = async (itemId, updatePayload) => {
    try {
      await axios.put(`/api/results/item/${itemId}`, updatePayload);
      addToast('Result Updated', 'Pathologist manual override recorded.', 'info');
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchApprove = async () => {
    try {
      const res = await axios.post('/api/results/batch-approve-normal');
      addToast('Batch Approval Complete', `Verified ${res.data.approved_count} normal workorders.`, 'success');
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateASTM = async (abnormal = false) => {
    try {
      await axios.post('/api/analyzers/simulate/astm', null, {
        params: { abnormal, use_tcp: true }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateASTM3Part = async (abnormal = false) => {
    try {
      await axios.post('/api/analyzers/simulate/astm-3part', null, {
        params: { abnormal, use_tcp: true }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateHL7 = async (abnormal = false) => {
    try {
      await axios.post('/api/analyzers/simulate/hl7', null, {
        params: { abnormal, use_tcp: true }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        await axios.delete(`/api/orders/${orderId}`);
        addToast('Order Deleted', 'Order removed from database.', 'info');
        fetchOrders();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const pendingVerificationCount = orders.filter(o => o.status === 'INGESTED' || o.status === 'PARTIAL').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        wsConnected={wsConnected}
        onOpenOrderModal={() => setIsOrderModalOpen(true)}
        onQuickSimulate={() => handleSimulateASTM(false)}
        pendingCount={pendingVerificationCount}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Body */}
      <main className="flex-1 p-4 lg:p-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            orders={orders}
            rawLogs={rawLogs}
            networkStatus={networkStatus}
            onRefresh={() => { fetchOrders(); fetchRawLogs(); }}
            onSelectOrder={(ordId) => {
              setSelectedOrderId(ordId);
              setActiveTab('verification');
            }}
            onOpenBarcode={(ord) => setBarcodeOrderData(ord)}
            onOpenReport={(ordId) => setReportOrderId(ordId)}
            onOpenEdit={(ord) => setEditOrderData(ord)}
            onBatchApprove={handleBatchApprove}
            onSimulateASTM={handleSimulateASTM}
            onSimulateASTM3Part={handleSimulateASTM3Part}
            onSimulateHL7={handleSimulateHL7}
            onDeleteOrder={handleDeleteOrder}
          />
        )}

        {activeTab === 'verification' && (
          <VerificationWorkstation
            orders={orders}
            selectedOrderId={selectedOrderId}
            onSelectOrder={(id) => setSelectedOrderId(id)}
            onVerifyOrder={handleVerifyOrder}
            onUpdateResultItem={handleUpdateResultItem}
            onOpenReport={(id) => setReportOrderId(id)}
            onRefresh={fetchOrders}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'qc' && (
          <QCLeveyJennings />
        )}

        {activeTab === 'catalog' && (
          <TestCatalog />
        )}

        {activeTab === 'network' && (
          <NetworkConfigTab
            networkStatus={networkStatus}
            onRefreshNetwork={fetchNetworkStatus}
            onSimulateASTM={handleSimulateASTM}
            onSimulateHL7={handleSimulateHL7}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            currentUser={currentUser}
            onUpdateCurrentUser={handleUpdateCurrentUser}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Authentication Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen || !currentUser}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Global Modals */}
      <OrderEntryModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSubmit={handleCreateOrder}
      />

      <EditOrderModal
        isOpen={!!editOrderData}
        order={editOrderData}
        onClose={() => setEditOrderData(null)}
        onSave={handleUpdateOrder}
      />

      <BarcodeModal
        isOpen={!!barcodeOrderData}
        order={barcodeOrderData}
        onClose={() => setBarcodeOrderData(null)}
      />

      <ReportModal
        isOpen={!!reportOrderId}
        orderId={reportOrderId}
        onClose={() => setReportOrderId(null)}
      />

      {/* Live Toast Stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl text-xs max-w-sm transition-all transform translate-y-0"
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : t.type === 'error' ? (
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            ) : (
              <Bell className="h-5 w-5 text-cyan-400 shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-bold text-slate-100">{t.title}</div>
              <div className="text-slate-400 text-[11px]">{t.message}</div>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
