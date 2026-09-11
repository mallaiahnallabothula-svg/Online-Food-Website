import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { OrderingHoursBanner } from './components/OrderingHoursBanner';
import { OrderForm } from './components/OrderForm';
import { PhotoGallerySection } from './components/PhotoGallerySection';
import { PhotoGalleryModal } from './components/PhotoGalleryModal';
import { PaymentModal } from './components/PaymentModal';
import { OrderConfirmation } from './components/OrderConfirmation';
import { AdminLogin } from './components/OwnerPortal/AdminLogin';
import { OwnerDashboard } from './components/OwnerPortal/OwnerDashboard';
import { OrderingHoursStatus, Order, AdminRole } from './types';
import { getISTTime, getInitialOrderingStatus } from './utils/time';
import { Phone, MapPin, Clock, ShieldCheck, Heart, Camera, Download } from 'lucide-react';

export default function App() {
  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('smjr_theme') === 'dark';
  });

  // Ordering Hours Status - Initialized synchronously so OrderForm NEVER disappears in deployment
  const [hoursStatus, setHoursStatus] = useState<OrderingHoursStatus>(getInitialOrderingStatus);
  const [allowOutsideHours, setAllowOutsideHours] = useState<boolean>(false);

  // Active view: 'CUSTOMER' | 'OWNER_LOGIN' | 'OWNER_DASHBOARD'
  const [currentView, setCurrentView] = useState<'CUSTOMER' | 'OWNER_LOGIN' | 'OWNER_DASHBOARD'>('CUSTOMER');
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('smjr_admin_token'));
  const [adminRole, setAdminRole] = useState<AdminRole>('ADMIN');

  // Checkout flow state
  const [pendingOrderData, setPendingOrderData] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  // Photo gallery modal state
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | undefined>(undefined);

  const handleOpenGallery = (photoId?: string) => {
    setSelectedPhotoId(photoId);
    setIsGalleryOpen(true);
  };

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
        if (data && typeof data.isOpen === 'boolean') {
          setHoursStatus(data);
          return;
        }
      }
    } catch {}

    // Synchronous fallback ensures ordering is never interrupted
    setHoursStatus(getInitialOrderingStatus());
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 30000); // 30s poll
    return () => clearInterval(timer);
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
    setPendingOrderData(orderPayload);
    setIsPaymentModalOpen(true);
  };

  // Payment success handler
  const handlePaymentSuccess = (newConfirmedOrder: Order) => {
    setIsPaymentModalOpen(false);
    setConfirmedOrder(newConfirmedOrder);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to order new rotis
  const handleNewOrder = () => {
    setConfirmedOrder(null);
    setPendingOrderData(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Admin login handler
  const handleLoginSuccess = (token: string, role: AdminRole) => {
    setAdminToken(token);
    setAdminRole(role);
    localStorage.setItem('smjr_admin_token', token);
    setCurrentView('OWNER_DASHBOARD');
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('smjr_admin_token');
    setCurrentView('CUSTOMER');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBF7] dark:bg-[#1A1816] text-[#292524] dark:text-[#E7E5E4] transition-colors duration-200">
      
      {/* Header */}
      <Header
        hoursStatus={hoursStatus}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(prev => !prev)}
        onOpenOwnerPortal={() => {
          if (adminToken) {
            setCurrentView('OWNER_DASHBOARD');
          } else {
            setCurrentView('OWNER_LOGIN');
          }
        }}
        isOwnerView={currentView !== 'CUSTOMER'}
        onBackToCustomerView={() => setCurrentView('CUSTOMER')}
        onOpenGallery={() => handleOpenGallery()}
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
              />
            ) : (
              <>
                <HeroSection
                  onScrollToOrder={handleScrollToOrder}
                  isOpen={hoursStatus.isOpen || allowOutsideHours}
                  onOpenGallery={handleOpenGallery}
                />

                <OrderingHoursBanner
                  status={hoursStatus}
                  allowOutsideHoursForTesting={allowOutsideHours}
                  onToggleAllowOutsideHours={(val) => setAllowOutsideHours(val)}
                />

                <OrderForm
                  hoursStatus={hoursStatus}
                  allowOutsideHours={allowOutsideHours}
                  onProceedToPayment={handleProceedToPayment}
                  onOpenPhotoGallery={handleOpenGallery}
                />

                {/* Original Authentic Food & Woodfire Kitchen Photo Gallery Section */}
                <PhotoGallerySection onOpenModal={handleOpenGallery} />
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

      {/* Photo Gallery & Download Modal */}
      <PhotoGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        initialPhotoId={selectedPhotoId}
      />

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left space-y-1">
            <h4 className="font-bold text-sm text-[#451A03] dark:text-amber-100">
              శ్రీ మల్లికార్జున పల్లె జొన్న రొట్టెలు
            </h4>
            <p>
              పక్కా పల్లెటూరి స్వచ్ఛమైన ఇంటి రుచితో, వేడివేడి జొన్న రొట్టెలు
            </p>
            <p className="text-[11px] text-stone-500">
              కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధిలో ఉచిత డెలివరీ | ఆన్‌లైన్ UPI చెల్లింపు మాత్రమే
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 text-center md:text-right">
            {/* Direct button to open Photos & Download */}
            <button
              onClick={() => handleOpenGallery()}
              id="footer-open-photos-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100/90 hover:bg-amber-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-[#78350F] dark:text-amber-300 font-bold border border-amber-300 dark:border-stone-700 transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span>అసలైన ఫోటోలు & డౌన్‌లోడ్</span>
            </button>

            <a
              href="tel:+918499865803"
              className="font-mono font-bold text-stone-800 dark:text-stone-200 hover:text-[#78350F] flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-[#78350F]" />
              <span>+91 8499865803</span>
            </a>

            <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
              <Clock className="w-3.5 h-3.5" />
              <span>ఆర్డర్లు: 11:00 AM – 4:00 PM | డెలివరీ: 6:00 – 8:00 PM</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
