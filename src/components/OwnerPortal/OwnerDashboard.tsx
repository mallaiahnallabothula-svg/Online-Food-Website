import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Download, 
  BarChart3, 
  History, 
  LogOut, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Truck, 
  ChefHat, 
  AlertCircle,
  Play,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { Order, FulfillmentStatus, AdminRole, AnalyticsData, AuditLog } from '../../types';
import { playOrderNotificationSound } from '../../utils/audio';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { AuditLogs } from './AuditLogs';
import { ExportReportsModal } from './ExportReportsModal';

interface OwnerDashboardProps {
  role: AdminRole;
  onLogout: () => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ role, onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'ANALYTICS' | 'AUDIT'>('ORDERS');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Audio chime settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const previousOrdersCountRef = useRef<number>(0);
  
  // Modals & States
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Fetch orders from server
  const fetchDashboardData = async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      // 1. Orders
      const qParams = new URLSearchParams();
      if (statusFilter !== 'ALL') qParams.append('status', statusFilter);
      if (dateFilter) qParams.append('date', dateFilter);

      const ordersRes = await fetch(`/api/orders?${qParams.toString()}`);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        const incomingOrders: Order[] = data.orders || [];

        // Check if new order arrived and trigger audio sound
        if (previousOrdersCountRef.current > 0 && incomingOrders.length > previousOrdersCountRef.current) {
          if (soundEnabled) {
            playOrderNotificationSound();
          }
        }
        previousOrdersCountRef.current = incomingOrders.length;
        setOrders(incomingOrders);
      }

      // 2. Analytics
      const analyticsRes = await fetch('/api/analytics');
      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        setAnalytics(aData);
      }

      // 3. Audit Logs
      const auditRes = await fetch('/api/audit-logs');
      if (auditRes.ok) {
        const aLogs = await auditRes.json();
        setAuditLogs(aLogs.logs || []);
      }
    } catch (err) {
      console.error('Error fetching owner data:', err);
    } finally {
      if (isManualRefresh) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
    // Polling interval for live incoming orders
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [statusFilter, dateFilter]);

  // Update fulfillment status
  const handleStatusChange = async (orderId: string, newStatus: FulfillmentStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, updatedBy: role }),
      });

      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, fulfillmentStatus: newStatus } : o));
        fetchDashboardData(false);
      }
    } catch (err) {
      console.error('Failed to update order status:', err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Test sound function
  const handleTestSound = () => {
    playOrderNotificationSound();
  };

  // Filtered orders list
  const filteredOrders = orders.filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.id.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.mobile.includes(q) ||
      o.customer.address.toLowerCase().includes(q) ||
      (o.customer.landmark && o.customer.landmark.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: FulfillmentStatus) => {
    switch (status) {
      case 'NEW':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-telugu">కొత్తది (New)</span>;
      case 'PREPARING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-telugu">తయారవుతోంది (Preparing)</span>;
      case 'OUT_FOR_DELIVERY':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-telugu">డెలివరీలో ఉంది (Out for delivery)</span>;
      case 'DELIVERED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-telugu">డెలివరీ పూర్తయింది (Delivered)</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-telugu">
      
      {/* Top Controls Bar */}
      <div className="bg-white dark:bg-[#211E1A] p-4 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#451A03] dark:text-amber-100">
              ఆర్డర్ల నిర్వహణ & యజమాని డ్యాష్‌బోర్డ్
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 dark:bg-amber-950 text-[#78350F] dark:text-amber-400 font-mono">
              {role === 'ADMIN' ? 'Owner / Admin' : 'Staff'}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            శ్రీ మల్లికార్జున పల్లె జొన్న రొట్టెలు | కొల్లూరు గ్రామం | +91 8499865803
          </p>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Sound Alert Toggle & Test */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-300 dark:border-stone-700">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                soundEnabled
                  ? 'bg-emerald-700 text-white'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              title={soundEnabled ? 'ఆర్డర్ సౌండ్ ఆన్‌లో ఉంది' : 'ఆర్డర్ సౌండ్ మ్యూట్ చేయబడింది'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-[11px] hidden sm:inline">సౌండ్ అలర్ట్</span>
            </button>

            <button
              type="button"
              onClick={handleTestSound}
              className="p-2 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg flex items-center gap-1"
              title="నోటిఫికేషన్ ధ్వని పరీక్షించండి"
            >
              <Play className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[11px] hidden sm:inline">పరీక్షించు</span>
            </button>
          </div>

          {/* Export Reports Button */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            id="open-export-modal-btn"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#78350F] dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>రిపోర్ట్ ఎక్స్‌పోర్ట్ (CSV/PDF)</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
            title="రీఫ్రెష్ చేయండి"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
            title="లాగ్ అవుట్"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('ORDERS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'ORDERS'
              ? 'bg-[#78350F] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>ఆర్డర్లు ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ANALYTICS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'ANALYTICS'
              ? 'bg-[#78350F] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>విశ్లేషణలు (Analytics & Charts)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'AUDIT'
              ? 'bg-[#78350F] text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>ఆడిట్ లాగ్స్ ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: ORDERS */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          
          {/* Filters Row */}
          <div className="bg-white dark:bg-[#211E1A] p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ఆర్డర్ ఐడీ, కస్టమర్ పేరు లేదా మొబైల్ శోధించండి..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs sm:text-sm"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs font-semibold"
              >
                <option value="ALL">అన్ని ఆర్డర్లు (All Statuses)</option>
                <option value="NEW">కొత్తవి (New)</option>
                <option value="PREPARING">తయారవుతున్నవి (Preparing)</option>
                <option value="OUT_FOR_DELIVERY">డెలివరీలో ఉన్నవి (Out for delivery)</option>
                <option value="DELIVERED">డెలివరీ అయినవి (Delivered)</option>
              </select>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs font-mono"
                title="తేదీ ఫిల్టర్"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="text-xs text-amber-700 hover:underline"
                >
                  తొలగించు
                </button>
              )}
            </div>
          </div>

          {/* Orders Cards Grid */}
          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
              <div className="bg-white dark:bg-[#211E1A] p-12 rounded-2xl border border-stone-200 dark:border-stone-800 text-center text-stone-500">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-stone-400" />
                <p className="font-bold text-base">ఎలాంటి ఆర్డర్లు కనుగొనబడలేదు.</p>
                <p className="text-xs mt-1">కొత్త ఆర్డర్లు వచ్చినప్పుడు ఇక్కడ కనిపిస్తాయి.</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white dark:bg-[#211E1A] p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs hover:border-amber-700/40 transition-all space-y-4"
                >
                  {/* Order Top Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-base text-[#78350F] dark:text-amber-400">
                        {order.id}
                      </span>
                      {getStatusBadge(order.fulfillmentStatus)}
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold font-mono">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>UPI ధృవీకరించబడింది</span>
                      </span>
                    </div>

                    <div className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                      ఆర్డర్ తేదీ: {order.createdAtIST}
                    </div>
                  </div>

                  {/* Order Middle Details */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    
                    {/* Customer & Address */}
                    <div className="md:col-span-5 space-y-1 text-sm">
                      <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                        <span>{order.customer.name}</span>
                        <a
                          href={`tel:+91${order.customer.mobile}`}
                          className="text-[#78350F] dark:text-amber-400 hover:underline inline-flex items-center gap-1 font-mono text-xs"
                        >
                          <Phone className="w-3 h-3" />
                          <span>+91 {order.customer.mobile}</span>
                        </a>
                      </div>

                      <div className="text-xs text-stone-600 dark:text-stone-400 flex items-start gap-1.5 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p>{order.customer.address}</p>
                          {order.customer.landmark && (
                            <p className="text-[11px] text-amber-900 dark:text-amber-300 font-semibold mt-0.5">
                              ల్యాండ్మార్క్: {order.customer.landmark}
                            </p>
                          )}
                          {order.customer.locationLink && (
                            <a
                              href={order.customer.locationLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                            >
                              <span>Google Maps లో చిరునామా చూడండి</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quantity & Karams */}
                    <div className="md:col-span-4 bg-stone-50 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          జొన్న రొట్టెలు:
                        </span>
                        <span className="font-mono font-bold text-base text-[#78350F] dark:text-amber-400">
                          {order.quantity} రొట్టెలు (₹{order.totalPaid})
                        </span>
                      </div>

                      <div className="pt-1 border-t border-stone-200 dark:border-stone-800 space-y-1 text-stone-700 dark:text-stone-300">
                        <span className="block font-semibold text-[11px] text-stone-500">ఉచిత కారాలు:</span>
                        {order.karamQuantities.karivepakuGrams > 0 && (
                          <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                            <span>• కరివేపాకు కారం:</span>
                            <span className="font-mono">{order.karamQuantities.karivepakuGrams} గ్రా.</span>
                          </div>
                        )}
                        {order.karamQuantities.aviseGinjaluGrams > 0 && (
                          <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                            <span>• అవిసె గింజల కారం:</span>
                            <span className="font-mono">{order.karamQuantities.aviseGinjaluGrams} గ్రా.</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-1 border-t border-stone-200 dark:border-stone-800 text-[11px] text-stone-500">
                        డెలివరీ: <strong>{order.deliveryWindow}</strong> ({order.deliveryDate})
                      </div>
                    </div>

                    {/* Status Update Dropdown (Authoritative Server Update) */}
                    <div className="md:col-span-3 flex flex-col justify-between h-full space-y-2">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                          ఆర్డర్ స్థితిని మార్చండి:
                        </label>
                        <select
                          value={order.fulfillmentStatus}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as FulfillmentStatus)}
                          disabled={updatingOrderId === order.id}
                          className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-[#78350F]"
                        >
                          <option value="NEW">కొత్తది (New)</option>
                          <option value="PREPARING">రొట్టెలు తయారవుతున్నాయి (Preparing)</option>
                          <option value="OUT_FOR_DELIVERY">డెలివరీ కోసం బయలుదేరింది (Out for delivery)</option>
                          <option value="DELIVERED">డెలివరీ పూర్తయింది (Delivered)</option>
                        </select>
                      </div>

                      <div className="text-[11px] text-stone-400 font-mono">
                        UTR: {order.paymentReference.slice(0, 18)}
                      </div>
                    </div>

                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ANALYTICS */}
      {activeTab === 'ANALYTICS' && (
        <AnalyticsDashboard analytics={analytics} />
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'AUDIT' && (
        <AuditLogs logs={auditLogs} />
      )}

      {/* Export Reports Modal */}
      {showExportModal && (
        <ExportReportsModal
          orders={orders}
          onClose={() => setShowExportModal(false)}
        />
      )}

    </div>
  );
};
