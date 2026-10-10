import { uiError, paymentStatusLabel } from '../../utils/uiCopy';
import { useUiText } from '../../context/useUiText';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Download, 
  BarChart3, 
  LogOut, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Truck, 
  ChefHat, 
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Star,
  MessageSquareHeart,
  Calendar,
  XCircle
} from 'lucide-react';
import { Order, FulfillmentStatus, AdminRole, AnalyticsData, AuditLog, OrderFeedback } from '../../types';
import { playOrderNotificationSound } from '../../utils/audio';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { AuditLogs } from './AuditLogs';
import { CustomerFeedbackView } from './CustomerFeedbackView';
import { useLanguage } from '../../context/LanguageContext';

interface OwnerDashboardProps {
  role: AdminRole;
  onLogout: () => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ role, onLogout }) => {
  const ui = useUiText();
  const { language } = useLanguage();
  const isTe = language !== 'en';

  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [feedbacks, setFeedbacks] = useState<OrderFeedback[]>([]);
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'ANALYTICS' | 'FEEDBACK' | 'AUDIT'>('ORDERS');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [errorMessage, setErrorMessage] = useState('');
  const latestRequest = useRef(0);
  
  // Audio chime settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const previousOrdersCountRef = useRef<number>(0);
  
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  // Fetch orders, analytics, audit logs, and feedback with credentials: 'include'
  const fetchDashboardData = async (isManualRefresh: boolean = false) => {
    const request = ++latestRequest.current;
    if (isManualRefresh) setIsRefreshing(true);
    try {
      // 1. Orders
      const qParams = new URLSearchParams();
      qParams.set('page', String(page));
      qParams.set('limit', '20');
      if (statusFilter !== 'ALL') qParams.append('status', statusFilter);
      if (dateFilter) qParams.append('date', dateFilter);
      if (searchQuery.trim()) qParams.append('search', searchQuery.trim());

      const ordersRes = await fetch(`/api/admin/orders?${qParams.toString()}`, {
        credentials: 'include',
      });
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        if (request !== latestRequest.current) return;
        const incomingOrders: Order[] = data.orders || [];
        setPagination({ total: data.pagination?.total || 0, totalPages: data.pagination?.totalPages || 1 });
        if (page > (data.pagination?.totalPages || 1)) setPage(data.pagination?.totalPages || 1);
        setErrorMessage('');

        // Check if new order arrived and trigger audio chime
        if (previousOrdersCountRef.current > 0 && incomingOrders.length > previousOrdersCountRef.current) {
          if (soundEnabled) {
            playOrderNotificationSound();
          }
        }
        previousOrdersCountRef.current = incomingOrders.length;
        setOrders(incomingOrders);
      } else if (ordersRes.status === 401) {
        onLogout();
        return;
      } else {
        const error = await ordersRes.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Unable to load orders. Please refresh.');
      }

      // 2. Analytics
      const analyticsRes = await fetch('/api/admin/analytics', { credentials: 'include' });
      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        setAnalytics(aData);
      }

      // 3. Feedback
      const feedbackRes = await fetch('/api/admin/feedback', { credentials: 'include' });
      if (feedbackRes.ok) {
        const fData = await feedbackRes.json();
        setFeedbacks(fData.feedback || []);
      }

      // 4. Audit logs (Admin role only)
      if (role === 'ADMIN') {
        const auditRes = await fetch('/api/admin/audit-logs', { credentials: 'include' });
        if (auditRes.ok) {
          const aLogs = await auditRes.json();
          setAuditLogs(aLogs.auditLogs || []);
        }
      }
    } catch (err) {
      if (request === latestRequest.current) setErrorMessage(err instanceof Error ? err.message : 'Unable to load orders. Please refresh.');
    } finally {
      if (request === latestRequest.current) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 12000); // 12-second live refresh
    return () => clearInterval(interval);
  }, [statusFilter, dateFilter, searchQuery, page]);

  // Update order fulfillment status (authoritative actor derived from session on server)
  const handleStatusChange = async (orderId: string, newStatus: FulfillmentStatus) => {
    setUpdatingOrderId(orderId);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, fulfillmentStatus: newStatus } : o));
        fetchDashboardData(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error?.message || 'Unable to update this order. Please refresh and retry.');
      }
    } catch (err) {
      setErrorMessage('Unable to update this order. Check your connection and retry.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // CSV Export with formula injection protection
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const res = await fetch('/api/admin/exports/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ date: dateFilter || undefined }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mana_enti_vanta_orders_${dateFilter || 'all'}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error?.message || 'Unable to export orders. Please retry.');
      }
    } catch (err) {
      setErrorMessage('Unable to export orders. Check your connection and retry.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleLogoutClick = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      });
    } catch {}
    onLogout();
  };

  const getStatusBadge = (status: FulfillmentStatus) => {
    switch (status) {
      case 'RECEIVED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-telugu">{ui("ఆర్డర్ అందింది (Received)")}</span>;
      case 'PREPARING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-telugu">{ui("తయారవుతోంది (Preparing)")}</span>;
      case 'OUT_FOR_DELIVERY':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-telugu">{ui("డెలివరీలో ఉంది (Out for delivery)")}</span>;
      case 'DELIVERED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-telugu">{ui("డెలివరీ పూర్తయింది (Delivered)")}</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 font-telugu">{ui("రద్దు చేయబడింది (Cancelled)")}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-telugu">
      {errorMessage && <div role="alert" className="p-4 rounded-xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-sm">{uiError(errorMessage, language)}</div>}
      
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-[#211E1A] p-4 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#451A03] dark:text-amber-100">
              {isTe ? 'మన ఇంటి వంట — యజమాని పోర్టల్' : 'Mana Enti Vanta — Owner Portal'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 dark:bg-amber-950 text-[#78350F] dark:text-amber-400 font-mono">
              {role}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">{" "}{ui("కొల్లూరు కిచెన్ & డెలివరీ నిర్వహణ | Asia/Kolkata Business Time")}{" "}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-900 dark:text-amber-200'
                : 'bg-stone-100 dark:bg-stone-800 border-stone-300 text-stone-500'
            }`}
            title={soundEnabled ? 'Audio alerts active' : 'Audio alerts muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? ui("సౌండ్ ఆన్") : ui("సౌండ్ ఆఫ్")}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="p-2 px-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 border border-stone-300 dark:border-stone-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{ui("రిఫ్రెష్")}</span>
          </button>

          {/* CSV Export Button */}
          <button
            onClick={handleExportCsv}
            disabled={isExportingCsv}
            className="p-2 px-3 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{ui("CSV రిపోర్ట్")}</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogoutClick}
            className="p-2 px-3 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 border border-red-200 dark:border-red-900 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{ui("లాగౌట్")}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'ORDERS'
              ? 'border-[#78350F] text-[#78350F] dark:border-amber-400 dark:text-amber-400'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          {isTe ? 'ఆర్డర్లు' : 'Orders'} ({pagination.total})
        </button>

        <button
          onClick={() => setActiveTab('ANALYTICS')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'ANALYTICS'
              ? 'border-[#78350F] text-[#78350F] dark:border-amber-400 dark:text-amber-400'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{isTe ? 'విశ్లేషణ & లెక్కలు' : 'Analytics'}</span>
        </button>

        <button
          onClick={() => setActiveTab('FEEDBACK')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'FEEDBACK'
              ? 'border-[#78350F] text-[#78350F] dark:border-amber-400 dark:text-amber-400'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span>{isTe ? 'కస్టమర్ రివ్యూలు' : 'Feedback'}</span>
        </button>

        {role === 'ADMIN' && (
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'AUDIT'
                ? 'border-[#78350F] text-[#78350F] dark:border-amber-400 dark:text-amber-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isTe ? 'సెక్యూరిటీ ఆడిట్ లాగ్స్' : 'Audit Logs'}</span>
          </button>
        )}
      </div>

      {/* 1. ORDERS TAB */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white dark:bg-[#211E1A] p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder={isTe ? 'ఆర్డర్ ID, కస్టమర్ పేరు లేదా మొబైల్ శోధించండి...' : 'Search by ID, name, or phone...'}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-[#1A1816] border border-stone-300 dark:border-stone-700 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-500">{ui("స్టేటస్:")}</span>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="py-1.5 px-3 bg-stone-50 dark:bg-[#1A1816] border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200"
              >
                <option value="ALL">{ui("అన్నీ (All)")}</option>
                <option value="RECEIVED">{ui("ఆర్డర్ అందింది (Received)")}</option>
                <option value="PREPARING">{ui("తయారవుతోంది (Preparing)")}</option>
                <option value="OUT_FOR_DELIVERY">{ui("డెలివరీలో ఉంది (Out for delivery)")}</option>
                <option value="DELIVERED">{ui("డెలివరీ పూర్తయింది (Delivered)")}</option>
                <option value="CANCELLED">{ui("రద్దు చేయబడింది (Cancelled)")}</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-stone-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                className="py-1.5 px-2 bg-stone-50 dark:bg-[#1A1816] border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-800 dark:text-stone-200"
              />
              {dateFilter && (
                <button
                  onClick={() => { setDateFilter(''); setPage(1); }}
                  className="text-xs text-stone-400 hover:text-stone-600"
                >{" "}{ui("క్లియర్")}{" "}</button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <button type="button" disabled={page <= 1 || isRefreshing} onClick={() => setPage(prev => prev - 1)} className="px-3 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 disabled:opacity-40">{isTe ? 'మునుపటి' : 'Previous'}</button>
            <span>{isTe ? 'పేజీ' : 'Page'} {page} / {pagination.totalPages}</span>
            <button type="button" disabled={page >= pagination.totalPages || isRefreshing} onClick={() => setPage(prev => prev + 1)} className="px-3 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 disabled:opacity-40">{isTe ? 'తరువాతి' : 'Next'}</button>
          </div>
          {/* Orders Cards Grid */}
          {orders.length === 0 ? (
            <div className="bg-white dark:bg-[#211E1A] p-12 text-center rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2">
              <ChefHat className="w-10 h-10 text-stone-300 mx-auto" />
              <p className="font-bold text-stone-700 dark:text-stone-300">
                {isTe ? 'ఎటువంటి ఆర్డర్లు కనుగొనబడలేదు.' : 'No orders found matching criteria.'}
              </p>
              <p className="text-xs text-stone-400">{" "}{ui("ఫిల్టర్లు క్లియర్ చేసి మళ్ళీ ప్రయత్నించండి.")}{" "}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const isUpdating = updatingOrderId === order.id;
                const customerName = order.customerName || order.customer?.name || 'Customer';
                const customerMobile = order.customerMobile || order.customer?.mobile || '';
                const customerAddress = order.address || order.customer?.address || '';
                const customerLandmark = order.landmark || order.customer?.landmark || '';
                const distanceKm = order.distanceKm ?? 0.8;
                const totalPaid = order.totalAmount || order.totalPaid || 0;
                const canFulfill = order.paymentStatus === 'PAID' && !['DELIVERED', 'CANCELLED'].includes(order.fulfillmentStatus);

                return (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-[#211E1A] p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all space-y-4"
                  >
                    {/* Top Order Row */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-sm sm:text-base text-[#451A03] dark:text-amber-100">
                            {order.id}
                          </span>
                          {getStatusBadge(order.fulfillmentStatus)}
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${order.paymentStatus === 'PAID' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'}`}>
                            {paymentStatusLabel(order.paymentStatus, language)}
                          </span>
                        </div>
                        <div className="text-xs text-stone-400 mt-1 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{order.createdAtIst || order.createdAtIST || order.createdAtUtc}</span>
                          <span>•</span>
                          <span>{ui("డెలివరీ తేదీ:")}{" "}{order.deliveryDate}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-mono font-extrabold text-[#78350F] dark:text-amber-400">
                          ₹{totalPaid}
                        </div>
                        <div className="text-[11px] text-stone-400">{" "}{ui("రొట్టెలు: ₹")}{order.subtotal}{" "}{ui("+ డెలివరీ: ₹")}{order.deliveryCharge}
                        </div>
                      </div>
                    </div>

                    {/* Middle Info: Products & Customer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      
                      {/* Products & Karams */}
                      <div className="bg-stone-50 dark:bg-[#1A1816] p-3 rounded-xl border border-stone-200 dark:border-stone-800/60 space-y-1.5">
                        <div className="font-bold text-stone-800 dark:text-stone-200">{" "}{ui("ఆర్డర్ చేసిన పదార్థాలు:")}{" "}</div>
                        <div className="flex flex-wrap gap-2 text-stone-700 dark:text-stone-300">
                          {order.jowarQuantity > 0 && (
                            <span className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 px-2 py-1 rounded-md font-bold">{" "}{ui("జొన్న రొట్టెలు:")}{" "}{order.jowarQuantity}
                            </span>
                          )}
                          {order.chapathiQuantity > 0 && (
                            <span className="bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-200 px-2 py-1 rounded-md font-bold">{" "}{ui("చపాతీలు:")}{" "}{order.chapathiQuantity}
                            </span>
                          )}
                        </div>

                        {/* Complimentary Karams */}
                        <div className="pt-1 text-stone-500 dark:text-stone-400">{" "}{ui("కారం (ఉచితం):")}{' '}
                          {order.karivepakuGrams ? `${ui('కరివేపాకు కారం')} (${order.karivepakuGrams} ${ui('గ్రా.')})` : ''}
                          {order.karivepakuGrams && order.aviseGrams ? ' + ' : ''}
                          {order.aviseGrams ? `${ui('అవిసె గింజల కారం')} (${order.aviseGrams} ${ui('గ్రా.')})` : ''}
                        </div>
                      </div>

                      {/* Customer & Address */}
                      <div className="bg-stone-50 dark:bg-[#1A1816] p-3 rounded-xl border border-stone-200 dark:border-stone-800/60 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-800 dark:text-stone-200">
                            {customerName}
                          </span>
                          <span className="text-[11px] font-semibold text-stone-500">{" "}{ui("దూరం:")}{" "}{distanceKm}{" "}{ui("కి.మీ.")}{" "}</span>
                        </div>

                        <div className="text-stone-600 dark:text-stone-400 leading-relaxed">
                          {customerAddress}
                          {customerLandmark && (
                            <span className="block text-stone-500">{ui("గుర్తు:")}{" "}{customerLandmark}</span>
                          )}
                        </div>

                        {/* Direct Customer Action Links */}
                        <div className="pt-1 flex flex-wrap items-center gap-2">
                          <a
                            href={`tel:${customerMobile}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-100"
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{customerMobile}</span>
                          </a>

                          <a
                            href={`https://wa.me/91${customerMobile}?text=${encodeURIComponent(
                              isTe ? `నమస్కారం ${customerName} గారు, మీ మన ఇంటి వంట ఆర్డర్ (${order.id}) సిద్ధమవుతోంది. సాయంత్రం 6-8 గంటల మధ్య డెలివరీ చేయబడుతుంది.` : `Hello ${customerName}, your Mana Enti Vanta order (${order.id}) is being prepared. Delivery is between 6 and 8 PM.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 text-emerald-700 dark:text-emerald-300 rounded-lg font-bold hover:bg-emerald-100"
                          >
                            <span>WhatsApp</span>
                          </a>

                          {order.locationLink && (
                            <a
                              href={order.locationLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 border border-blue-300 text-blue-700 dark:text-blue-300 rounded-lg font-bold hover:bg-blue-100"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>{ui("మ్యాప్స్ డైరెక్షన్స్")}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Status Changer Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 dark:border-stone-800 pt-3">
                      <div className="text-xs font-bold text-stone-600 dark:text-stone-400">{" "}{ui("స్టేటస్ మార్చు:")}{" "}</div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          disabled={isUpdating || !canFulfill || order.fulfillmentStatus !== 'RECEIVED'}
                          onClick={() => handleStatusChange(order.id, 'PREPARING')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            order.fulfillmentStatus === 'PREPARING'
                              ? 'bg-amber-600 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100'
                          }`}
                        >{" "}{ui("తయారవుతోంది")}{" "}</button>

                        <button
                          disabled={isUpdating || !canFulfill || order.fulfillmentStatus !== 'PREPARING'}
                          onClick={() => handleStatusChange(order.id, 'OUT_FOR_DELIVERY')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            order.fulfillmentStatus === 'OUT_FOR_DELIVERY'
                              ? 'bg-purple-600 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-purple-100'
                          }`}
                        >{" "}{ui("డెలివరీలో ఉంది")}{" "}</button>

                        <button
                          disabled={isUpdating || !canFulfill || order.fulfillmentStatus !== 'OUT_FOR_DELIVERY'}
                          onClick={() => handleStatusChange(order.id, 'DELIVERED')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            order.fulfillmentStatus === 'DELIVERED'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-emerald-100'
                          }`}
                        >{" "}{ui("డెలివరీ పూర్తయింది")}{" "}</button>

                        <button
                          disabled={isUpdating || ['DELIVERED', 'CANCELLED'].includes(order.fulfillmentStatus)}
                          onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            order.fulfillmentStatus === 'CANCELLED'
                              ? 'bg-red-600 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-400 hover:bg-red-100 hover:text-red-700'
                          }`}
                        >{" "}{ui("రద్దు")}{" "}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. ANALYTICS TAB */}
      {activeTab === 'ANALYTICS' && (
        <AnalyticsDashboard analytics={analytics} />
      )}

      {/* 3. FEEDBACK TAB */}
      {activeTab === 'FEEDBACK' && (
        <CustomerFeedbackView
          feedbacks={feedbacks}
          averageRating={analytics?.feedbackSummary?.averageRating || 5.0}
          totalFeedbacks={analytics?.feedbackSummary?.totalReviews || 0}
          ratingDistribution={analytics?.feedbackSummary?.ratingCounts || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }}
        />
      )}

      {/* 4. AUDIT LOGS TAB (Admin Only) */}
      {activeTab === 'AUDIT' && role === 'ADMIN' && (
        <AuditLogs logs={auditLogs} />
      )}
    </div>
  );
};
