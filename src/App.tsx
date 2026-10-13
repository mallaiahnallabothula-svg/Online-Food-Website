import { useUiText } from './context/useUiText';
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { SolaraEditorialContent } from './components/SolaraEditorialContent';
import { UpcomingMenuSection } from './components/UpcomingMenuSection';
import { SecureCheckoutPage } from './components/SecureCheckoutPage';
import { rememberCheckoutSelection, restoreCheckoutSelection, type CheckoutSelection } from './utils/checkoutSelection';
import { AdminLogin } from './components/OwnerPortal/AdminLogin';
import { OwnerDashboard } from './components/OwnerPortal/OwnerDashboard';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import type { ReorderRequest } from './utils/reorder';
import { OrderingHoursStatus, AdminRole } from './types';
import { getInitialOrderingStatus, normalizeOrderingStatus } from './utils/time';
import { useLanguage } from './context/LanguageContext';
import { Phone, Clock, Lock } from 'lucide-react';

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

  // Customer Order Tracking & Post-Order Feedback Modal
  const [isOrderTrackingOpen, setIsOrderTrackingOpen] = useState<boolean>(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string>('');
  const [reorderRequest, setReorderRequest] = useState<ReorderRequest | null>(null);
  const [checkoutRoute, setCheckoutRoute] = useState(() => window.location.pathname === '/checkout');
  const [checkoutSelection, setCheckoutSelection] = useState<CheckoutSelection | null>(restoreCheckoutSelection);
  const [checkoutVersion, setCheckoutVersion] = useState(0);

  // Real, refreshable checkout URL; no new router or changes to payment state.
  useEffect(() => {
    const syncPath = () => setCheckoutRoute(window.location.pathname === '/checkout');
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  const openCheckout = (selection: CheckoutSelection) => {
    if (selection.subtotalPaisa < 10_000) return;
    rememberCheckoutSelection(selection);
    setCheckoutSelection(selection);
    setCheckoutVersion(v => v + 1); // Old quotes/consent must not survive a new visit.
    window.history.pushState({ checkout: true }, '', '/checkout');
    setCheckoutRoute(true);
    window.scrollTo?.({ top: 0, behavior: 'auto' });
  };
  const backToMenu = () => {
    if (window.location.pathname === '/checkout') window.history.pushState({}, '', '/');
    setCheckoutRoute(false);
    requestAnimationFrame(() => document.getElementById('upcoming-menu')?.scrollIntoView({ block: 'start' }));
  };

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
    const elem = document.getElementById('upcoming-menu');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
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
    <div className="solara-app min-h-screen flex flex-col bg-[#f7f2e9] dark:bg-[#1A1816] text-[#26231f] dark:text-[#E7E5E4] transition-colors duration-200">
      
      {/* Header */}
      {!(currentView === 'CUSTOMER' && checkoutRoute) && <Header
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
        onOpenOrderTracker={() => setIsOrderTrackingOpen(true)}
      />}

      {/* MAIN VIEWPORT */}
      <main className="flex-1">
        {/* CUSTOMER VIEW */}
        {currentView === 'CUSTOMER' && (
          <div className="solara-customer" hidden={checkoutRoute}>
            <>
              <HeroSection
                onScrollToOrder={handleScrollToOrder}
                isOpen={hoursStatus.isOpen}
              />
              <UpcomingMenuSection reorderRequest={reorderRequest} initialCheckoutSelection={checkoutSelection} onCheckout={openCheckout} />
              <SolaraEditorialContent />
            </>
          </div>
        )}

        {currentView === 'CUSTOMER' && checkoutRoute && (
          <SecureCheckoutPage key={checkoutVersion} selection={checkoutSelection} onBack={backToMenu} onReorder={request => { backToMenu(); setReorderRequest(request); }} />
        )}

        {/* OWNER LOGIN VIEW */}
        {currentView === 'OWNER_LOGIN' && (
          <div className="solara-owner"><AdminLogin
            onLoginSuccess={handleLoginSuccess}
            onCancel={() => setCurrentView('CUSTOMER')}
          /></div>
        )}

        {/* OWNER DASHBOARD VIEW */}
        {currentView === 'OWNER_DASHBOARD' && (
          <div className="solara-owner"><OwnerDashboard
            role={adminRole}
            onLogout={handleAdminLogout}
          /></div>
        )}
      </main>

      {/* Footer */}
      {!(currentView === 'CUSTOMER' && checkoutRoute) && <footer className="solara-footer mt-auto border-t border-[#2d3b2b] bg-[#384B35] py-12 text-[#f4eedf] dark:bg-[#151413]">
        <div className="mx-auto grid max-w-7xl gap-9 px-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr] lg:gap-14">
          <div className="min-w-0">
            <h4 className="solara-display text-xl font-semibold text-[#f5e7db]">{t.brandName}</h4>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#c8beb2]">{t.brandTagline}</p>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-[#c8beb2]">
              {language === 'te'
                ? 'కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధిలో ఉచిత డెలివరీ | ఆన్‌లైన్ UPI చెల్లింపు'
                : 'Free delivery within 5 km radius from Kolluru | Online UPI payment'}
            </p>
          </div>
          <div className="min-w-0 space-y-4">
            <h5 className="text-xs font-bold uppercase tracking-[0.16em] text-[#bba99b]">{language === 'te' ? 'సంప్రదించండి' : 'Contact & hours'}</h5>
            <a href="tel:+918499865803" className="inline-flex items-center gap-2 text-sm font-semibold text-[#f5e7db] hover:text-[#e8b29b]">
              <Phone className="h-4 w-4 text-[#e8b29b]" aria-hidden="true" />+91 8499865803
            </a>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-[#c8beb2]">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#e8b29b]" aria-hidden="true" />{t.footerTimings}
            </p>
            <button
              onClick={() => {
                if (isAuthenticatedAdmin) setCurrentView('OWNER_DASHBOARD');
                else setCurrentView('OWNER_LOGIN');
              }}
              id="footer-owner-access-btn"
              title={ui("అధీకృత యజమాని యాక్సెస్ మాత్రమే")}
              className="inline-flex min-h-10 items-center gap-2 text-xs text-[#c8beb2] transition-colors hover:text-white"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />{t.ownerPortalLink}
            </button>
          </div>
          {currentView === 'CUSTOMER' && (
            <nav aria-label="Footer" className="solara-footer-links min-w-0">
              <h5 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#bba99b]">{language === 'te' ? 'వెబ్‌సైట్' : 'Explore'}</h5>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
                <a href="#home">Home</a><a href="#upcoming-menu">Menu</a>
                <a href="#brand-story">Our Story</a><a href="#delivery-info">Delivery</a>
                <a href="#faq">FAQs</a><a href="#contact-info">Contact</a>
              </div>
            </nav>
          )}
        </div>
      </footer>}

            {/* Customer Order Tracking & Feedback Modal */}
      <OrderTrackingModal
        isOpen={isOrderTrackingOpen}
        onClose={() => setIsOrderTrackingOpen(false)}
        initialOrderId={trackingOrderId}
        onReorder={request => {
          setIsOrderTrackingOpen(false);
          if (checkoutRoute) backToMenu();
          setReorderRequest(request);
        }}
      />

      {/* Offline Status Toast Indicator */}
      <OfflineIndicator />

    </div>
  );
}
