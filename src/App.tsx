import { useUiText } from './context/useUiText';
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { OrderingHoursBanner } from './components/OrderingHoursBanner';
import { OrderForm } from './components/OrderForm';
import { PaymentModal } from './components/PaymentModal';
import { OrderConfirmation } from './components/OrderConfirmation';
import { AdminLogin } from './components/OwnerPortal/AdminLogin';
import { OwnerDashboard } from './components/OwnerPortal/OwnerDashboard';
import { AndroidInstallBanner } from './components/AndroidInstallBanner';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { BrandEmblem } from './components/BrandEmblem';
import { usePWAInstall } from './hooks/usePWAInstall';
import { OrderingHoursStatus, Order, AdminRole } from './types';
import { getInitialOrderingStatus, normalizeOrderingStatus } from './utils/time';
import { persistCustomerOrder } from './utils/checkout';
import { useLanguage } from './context/LanguageContext';
import { Phone, Clock, Lock, Smartphone } from 'lucide-react';

export default function App() {
  const ui = useUiText();
  const { t, language } = useLanguage();

  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('smjr_theme') === 'dark';
  });

  // Ordering Hours Status - Initialized synchronously so OrderForm NEVER disappears in deployment
  const [hoursStatus, setHoursStatus] = useState<OrderingHoursStatus>(getInitialOrderingStatus);

  // Active view: 'CUSTOMER' | 'OWNER_LOGIN' | 'OWNER_DASHBOARD'
  const [currentView, setCurrentView] = useState<'CUSTOMER' | 'OWNER_LOGIN' | 'OWNER_DASHBOARD'>('CUSTOMER');
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<AdminRole>('ADMIN');

  // Checkout flow state
  const [pendingOrderData, setPendingOrderData] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  // Customer Order Tracking & Post-Order Feedback Modal
  const [isOrderTrackingOpen, setIsOrderTrackingOpen] = useState<boolean>(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string>('');

  // PWA Install state
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  // Check initial admin session status from server cookie
  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) {
          setIsAuthenticatedAdmin(true);
          setAdminRole(data.user.role);
          if (window.location.hash === '#owner' || window.location.hash === '#admin') {
            setCurrentView('OWNER_DASHBOARD');
          }
        }
      })
      .catch(() => {});
  }, []);

  // Listen to #owner or #admin in URL for owner direct access
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#owner' || window.location.hash === '#admin') {
        if (isAuthenticatedAdmin) {
          setCurrentView('OWNER_DASHBOARD');
        } else {
          setCurrentView('OWNER_LOGIN');
        }
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [isAuthenticatedAdmin]);

  // Sync dark mode class with html root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('smjr_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('smjr_theme', 'light');
    }
  }, [darkMode]);

  // Fetch status from server
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.isOpen === 'boolean' && /^\d{4}-\d{2}-\d{2}$/.test(data.deliveryDate)) {
          setHoursStatus(normalizeOrderingStatus(data));
          return;
        }
      }
    } catch {}

    setHoursStatus({
      ...getInitialOrderingStatus(),
      nextOpenMessage: 'ఆర్డరింగ్ సేవ అందుబాటులో లేదు. కనెక్షన్ తిరిగి వచ్చినప్పుడు ప్రయత్నించండి.',
      nextOpenMessageEn: 'The ordering service is unavailable. Please retry when the connection returns.',
    });
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 30000); // 30s poll
    const handleOffline = () => setHoursStatus({ ...getInitialOrderingStatus(), nextOpenMessage: 'ఇంటర్నెట్ కనెక్షన్ అవసరం.', nextOpenMessageEn: 'An internet connection is required to order.' });
    window.addEventListener('online', fetchStatus);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', fetchStatus);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Smooth scroll to order section
  const handleScrollToOrder = () => {
    setConfirmedOrder(null);
    const elem = document.getElementById('order-section');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Payment initiate
  const handleProceedToPayment = (orderPayload: any) => {
    if (!hoursStatus.isOpen || hoursStatus.apiAvailable !== true || !navigator.onLine) return;
    setPendingOrderData(orderPayload);
    setIsPaymentModalOpen(true);
  };

  // Payment success handler
  const handlePaymentSuccess = (newConfirmedOrder: Order) => {
    setIsPaymentModalOpen(false);
    setConfirmedOrder(newConfirmedOrder);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Store in customer local orders list for tracking & feedback
    try {
      if (newConfirmedOrder.customerAccessToken) {
        persistCustomerOrder(newConfirmedOrder.id, newConfirmedOrder.customerAccessToken);
      }
      const stored = localStorage.getItem('smjr_customer_orders');
      const list = stored ? JSON.parse(stored) : [];
      const updatedList = [
        {
          id: newConfirmedOrder.id,
          customerAccessToken: newConfirmedOrder.customerAccessToken,
          date: newConfirmedOrder.deliveryDate || newConfirmedOrder.createdAtIST,
          qty: newConfirmedOrder.totalItems || newConfirmedOrder.quantity,
          status: newConfirmedOrder.fulfillmentStatus
        },
        ...list.filter((item: any) => item.id !== newConfirmedOrder.id)
      ].slice(0, 10);
      localStorage.setItem('smjr_customer_orders', JSON.stringify(updatedList));
    } catch {}
  };

  // Reset to order new rotis
  const handleNewOrder = () => {
    setConfirmedOrder(null);
    setPendingOrderData(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Admin login handler
  const handleLoginSuccess = (role: AdminRole) => {
    setIsAuthenticatedAdmin(true);
    setAdminRole(role);
    setCurrentView('OWNER_DASHBOARD');
  };

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } catch {}
    setIsAuthenticatedAdmin(false);
    setCurrentView('CUSTOMER');
    if (window.location.hash === '#owner' || window.location.hash === '#admin') {
      window.location.hash = '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBF7] dark:bg-[#1A1816] text-[#292524] dark:text-[#E7E5E4] transition-colors duration-200">
      
      {/* Android Install Announcement Banner */}
      <AndroidInstallBanner
        isInstalled={isInstalled}
        onOpenModal={() => setIsInstallModalOpen(true)}
      />

      {/* Header */}
      <Header
        hoursStatus={hoursStatus}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(prev => !prev)}
        onOpenOwnerPortal={() => {
          if (isAuthenticatedAdmin) {
            setCurrentView('OWNER_DASHBOARD');
          } else {
            setCurrentView('OWNER_LOGIN');
          }
        }}
        isOwnerView={currentView !== 'CUSTOMER'}
        onBackToCustomerView={() => setCurrentView('CUSTOMER')}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenOrderTracker={() => setIsOrderTrackingOpen(true)}
        isInstalled={isInstalled}
      />

      {/* MAIN VIEWPORT */}
      <main className="flex-1">
        {/* CUSTOMER VIEW */}
        {currentView === 'CUSTOMER' && (
          <div>
            {confirmedOrder ? (
              <OrderConfirmation
                order={confirmedOrder}
                onNewOrder={handleNewOrder}
                onOrderUpdated={(updated) => setConfirmedOrder(updated)}
              />
            ) : (
              <>
                <HeroSection
                  onScrollToOrder={handleScrollToOrder}
                  isOpen={hoursStatus.isOpen}
                  onOpenInstallModal={() => setIsInstallModalOpen(true)}
                  isInstalled={isInstalled}
                />

                <OrderingHoursBanner
                  status={hoursStatus}
                />

                <OrderForm
                  hoursStatus={hoursStatus}
                  onProceedToPayment={handleProceedToPayment}
                />
              </>
            )}
          </div>
        )}

        {/* OWNER LOGIN VIEW */}
        {currentView === 'OWNER_LOGIN' && (
          <AdminLogin
            onLoginSuccess={handleLoginSuccess}
            onCancel={() => setCurrentView('CUSTOMER')}
          />
        )}

        {/* OWNER DASHBOARD VIEW */}
        {currentView === 'OWNER_DASHBOARD' && (
          <OwnerDashboard
            role={adminRole}
            onLogout={handleAdminLogout}
          />
        )}
      </main>

      {/* Payment Modal */}
      {isPaymentModalOpen && pendingOrderData && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          orderData={pendingOrderData}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-amber-900/10 dark:border-stone-800 bg-[#FAF4EA] dark:bg-[#151413] py-8 text-xs font-telugu text-stone-600 dark:text-stone-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 text-center md:text-left">
            <BrandEmblem size="sm" />
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm text-[#451A03] dark:text-amber-100">
                {t.brandName}
              </h4>
              <p className="text-xs text-stone-600 dark:text-stone-300">
                {t.brandTagline}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {language === 'te' 
                  ? 'కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధిలో ఉచిత డెలివరీ | ఆన్‌లైన్ UPI చెల్లింపు'
                  : 'Free delivery within 5 km radius from Kolluru | Online UPI payment'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 text-center md:text-right">
            {/* Discreet Owner Access Link (Non-public) */}
            <button
              onClick={() => {
                if (isAuthenticatedAdmin) {
                  setCurrentView('OWNER_DASHBOARD');
                } else {
                  setCurrentView('OWNER_LOGIN');
                }
              }}
              id="footer-owner-access-btn"
              title={ui("అధీకృత యజమాని యాక్సెస్ మాత్రమే")}
              className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3 text-stone-400" />
              <span>{t.ownerPortalLink}</span>
            </button>

            {/* Android App Install CTA in Footer */}
            {!isInstalled && (
              <button
                onClick={() => setIsInstallModalOpen(true)}
                id="footer-install-app-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-200" />
                <span>{t.androidAppBtn}</span>
              </button>
            )}

            <a
              href="tel:+918499865803"
              className="font-mono font-bold text-stone-800 dark:text-stone-200 hover:text-[#78350F] flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-[#78350F]" />
              <span>+91 8499865803</span>
            </a>

            <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
              <Clock className="w-3.5 h-3.5" />
              <span>{language === 'te' ? 'ఆర్డర్లు: 11:00 AM – 4:00 PM | డెలివరీ: 6:00 – 8:00 PM' : 'Orders: 11:00 AM – 4:00 PM | Delivery: 6:00 – 8:00 PM'}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Android PWA Install Modal */}
      <AndroidInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        isInstallable={isInstallable}
        onInstall={install}
        isIOS={isIOS}
      />

      {/* Customer Order Tracking & Feedback Modal */}
      <OrderTrackingModal
        isOpen={isOrderTrackingOpen}
        onClose={() => setIsOrderTrackingOpen(false)}
        initialOrderId={trackingOrderId}
      />

      {/* Offline Status Toast Indicator */}
      <OfflineIndicator />

    </div>
  );
}
