import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Home from './components/Home';
import AboutUs from './components/AboutUs';
import ContactUs from './components/ContactUs';
import TeamMembers from './components/TeamMembers';
import HeroSlides from './components/HeroSlides';
import Videos from './components/Videos';
import ContactInformation from './components/ContactInformation';
import ContactMessages from './components/ContactMessages';
import PricingPlans from './components/PricingPlans';
import SubscriptionManagement from './components/SubscriptionManagement';
import MoreServices from './components/MoreServices';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './components/Dashboard';
import Checkout from './components/Checkout';
import Inventory from './components/Inventory';
import Suppliers from './components/Suppliers';
import Customers from './components/Customers';
import SalesHistory from './components/SalesHistory';
import ManageStaff from './components/ManageStaff';
import Settings from './components/Settings';
import ManageShops from './components/ManageShops';
import SystemUsers from './components/SystemUsers';
import HeldBills from './components/HeldBills';
import OtherCost from './components/OtherCost';
import OtherSales from './components/OtherSales';
import TotalRevenue from './components/TotalRevenue';
import InvestmentPage from './components/InvestmentPage';
import Wastage from './components/Wastage';
import Returns from './components/Returns';
import ManualOrders from './components/ManualOrders';
import AllTransactions from './components/AllTransactions';
import Attendance from './components/Attendance';
import MasterSupplierProducts from './components/MasterSupplierProducts';
import { extractDominantColor } from './utils/colorExtractor';
import TopInfoBar from './components/TopInfoBar';

import API_BASE_URL from './config';

// Decode JWT payload without verifying signature (verification is done server-side)
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// Get the default landing path based on role and allowed_sections
function getDefaultPath(user) {
  if (!user) return '/checkout';
  if (user.role === 'super_admin') return '/dashboard';
  if (user.role === 'shop_staff') {
    const allowed = user.allowed_sections || [];
    return allowed.length > 0 ? allowed[0] : '/checkout';
  }
  return '/checkout';
}

export default function App() {
  const [user, setUser] = useState(null);       // null = not logged in
  const [loading, setLoading] = useState(true); // checking stored token on startup
  const [suspendedMessage, setSuspendedMessage] = useState(''); // shop suspended message
  const [currentPath, setCurrentPath] = useState('/checkout');
  const [publicPage, setPublicPage] = useState('home'); // home, about, contact
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [heldBillsCount, setHeldBillsCount] = useState(0);
  const [resumedHeldBill, setResumedHeldBill] = useState(null);
  const [logoColor, setLogoColor] = useState('#C4A484'); // Default light brown color
  const [newContactMessagesCount, setNewContactMessagesCount] = useState(0);
  const [pendingSubscriptionsCount, setPendingSubscriptionsCount] = useState(0);
  const [isLoginOnly, setIsLoginOnly] = useState(false); // Track if on /login URL

  // Handle URL-based routing for /login and public pages
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      if (path === '/login') {
        setIsLoginOnly(true);
      } else {
        setIsLoginOnly(false);
      }

      // Handle public page routing based on URL
      if (!user) {
        if (path === '/about') {
          setPublicPage('about');
        } else if (path === '/contact') {
          setPublicPage('contact');
        } else {
          setPublicPage('home');
        }
      }
    };

    // Check initial URL
    handleUrlChange();

    // Listen to URL changes
    window.addEventListener('popstate', handleUrlChange);
    
    // Also listen to pushState/replaceState for SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      handleUrlChange();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      handleUrlChange();
    };

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [user]);

  // On mount: verify existing token against the backend
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      setLoading(false);
      return;
    }

    // Quick local expiry check first
    const decoded = decodeToken(token);
    if (!decoded || decoded.exp * 1000 <= Date.now()) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setLoading(false);
      return;
    }

    // Verify the token is accepted by the real backend
    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.ok) {
          return res.json();
        }
        // If 403, check if shop is suspended
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          const msg = data.error || 'Access denied.';
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setSuspendedMessage(msg);
          setLoading(false);
          return;
        }
        throw new Error('Token rejected by server');
      })
      .then((data) => {
        if (!data) return; // handled above (suspended)
        // Build user object from server response
        const userObj = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          shop_id: data.shop_id,
          shop_name: data.shop_name || 'Global System',
          allowed_sections: data.allowed_sections,
          logo: data.logo
        };
        localStorage.setItem('user', JSON.stringify(userObj));
        setUser(userObj);
        setCurrentPath(getDefaultPath(userObj));
      })
      .catch(() => {
        // Invalid/mock token — force logout
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch low-stock alerts, held bills, and session details concurrently
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    let isMounted = true;

    const loadSessionDetails = async () => {
      try {
        if (user.role !== 'super_admin') {
          // Fetch all required data concurrently in parallel
          const [shopRes, stockRes, expiringRes, heldRes] = await Promise.allSettled([
            fetch(`${API_BASE_URL}/shops/my-shop`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}/products?low_stock=true`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}/products?expiring=true`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}/held-bills`, { headers: { Authorization: `Bearer ${token}` } })
          ]);

          if (!isMounted) return;

          // Process shop details
          if (shopRes.status === 'fulfilled') {
            const res = shopRes.value;
            if (res.status === 403) {
              const data = await res.json().catch(() => ({}));
              const msg = data.error || 'This shop has been suspended.';
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              setUser(null);
              setLowStockAlerts([]);
              setExpiryAlerts([]);
              setSuspendedMessage(msg);
              return;
            }
            if (res.ok) {
              const shopData = await res.json();
              setUser((prev) => {
                const updated = {
                  ...prev,
                  shop_name: shopData.name,
                  shop_email: shopData.email,
                  shop_phone: shopData.phone,
                  shop_address: shopData.address,
                  logo: shopData.logo
                };
                localStorage.setItem('user', JSON.stringify(updated));
                return updated;
              });

              if (shopData.logo && logoColor === '#C4A484') {
                extractDominantColor(shopData.logo).then(c => {
                  if (isMounted) setLogoColor(c);
                });
              }
            }
          }

          // Process stock alerts
          if (stockRes.status === 'fulfilled' && stockRes.value.ok) {
            const data = await stockRes.value.json().catch(() => []);
            if (isMounted) setLowStockAlerts(Array.isArray(data) ? data : []);
          }

          // Process expiry alerts
          if (expiringRes.status === 'fulfilled' && expiringRes.value.ok) {
            const data = await expiringRes.value.json().catch(() => []);
            if (isMounted) setExpiryAlerts(Array.isArray(data) ? data : []);
          }

          // Process held bills
          if (heldRes.status === 'fulfilled' && heldRes.value.ok) {
            const heldData = await heldRes.value.json().catch(() => []);
            if (isMounted && Array.isArray(heldData)) {
              setHeldBillsCount(heldData.filter(bill => bill.status === 'held').length);
            }
          }
        } else {
          // Super admin concurrent fetch
          const [msgRes, subRes] = await Promise.allSettled([
            fetch(`${API_BASE_URL}/contact-messages`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}/subscriptions`, { headers: { Authorization: `Bearer ${token}` } })
          ]);

          if (!isMounted) return;

          if (msgRes.status === 'fulfilled' && msgRes.value.ok) {
            const messages = await msgRes.value.json().catch(() => []);
            if (isMounted && Array.isArray(messages)) {
              setNewContactMessagesCount(messages.filter(msg => msg.status === 'new').length);
            }
          }

          if (subRes.status === 'fulfilled' && subRes.value.ok) {
            const subs = await subRes.value.json().catch(() => []);
            if (isMounted && Array.isArray(subs)) {
              setPendingSubscriptionsCount(subs.filter(s => s.status === 'pending').length);
            }
          }
        }
      } catch (e) {
        console.error('Session detail load failed:', e);
      }
    };

    loadSessionDetails();

    return () => {
      isMounted = false;
    };
  }, [user?.role]);

  // Called by Login component on successful authentication
  const handleLoginSuccess = (userObj) => {
    setUser(userObj);
    setCurrentPath(getDefaultPath(userObj));
  };

  // Logout
  const handleLogout = () => {
    localStorage.clear();
    window.location.reload(true);
  };

  // Routing Handler
  const renderPageContent = () => {
    // Super admin guard: redirect to their panel if they navigate to shop-only pages
    if (user.role === 'super_admin') {
      switch (currentPath) {
        case '/dashboard': return <Dashboard />;
        case '/shops': return <ManageShops />;
        case '/users': return <SystemUsers />;
        case '/products': return <Inventory />;
        case '/wastage': return <Wastage />;
        case '/other-cost': return <OtherCost />;
        case '/other-sales': return <OtherSales />;
        case '/all-transactions': return <AllTransactions />;
        case '/total-revenue': return <TotalRevenue />;
        case '/investment': return <InvestmentPage />;
        case '/attendance': return <Attendance />;
        case '/team-members': return <TeamMembers />;
        case '/hero-slides': return <HeroSlides />;
        case '/videos': return <Videos />;
        case '/contact-information': return <ContactInformation />;
        case '/contact-messages': return <ContactMessages />;
        case '/pricing-plans': return <PricingPlans />;
        case '/more-services': return <MoreServices />;
        case '/subscriptions': return <SubscriptionManagement />;
        case '/settings': return <Settings />;
        case '/supplier-products': return <MasterSupplierProducts />;
        default: return <Dashboard />;
      }
    }

    // Staff access guard: redirect if path is not in allowed_sections
    if (user.role === 'shop_staff') {
      const allowed = user.allowed_sections || [];
      if (!allowed.includes(currentPath)) {
        const firstAllowed = allowed.length > 0 ? allowed[0] : null;
        if (firstAllowed && firstAllowed !== currentPath) {
          setTimeout(() => setCurrentPath(firstAllowed), 0);
        } else if (!firstAllowed) {
          return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100 text-rose-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0-6h.01M5.071 19.243a9 9 0 1113.858 0L12 12 5.071 19.243z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Access Restricted</h3>
                <p className="text-sm text-slate-500 max-w-sm">Your administrator has not granted you access to any sections yet. Please contact support.</p>
              </div>
            </div>
          );
        }
      }
    }

    switch (currentPath) {
      case '/dashboard': return <Dashboard />;
      case '/checkout': return <Checkout resumedHeldBill={resumedHeldBill} onClearResumedHeldBill={() => setResumedHeldBill(null)} onHeldBillsChange={(count) => setHeldBillsCount(count)} onNavigate={setCurrentPath} />;
      case '/held-bills': return <HeldBills onResume={(bill) => { setResumedHeldBill(bill); setCurrentPath('/checkout'); }} onHeldBillsChange={(count) => setHeldBillsCount(count)} />;
      case '/products': return <Inventory />;
      case '/suppliers': return <Suppliers />;
      case '/customers': return <Customers />;
      case '/sales': return <SalesHistory />;
      case '/manual-orders': return <ManualOrders />;
      case '/all-transactions': return <AllTransactions />;
      case '/other-cost': return <OtherCost />;
      case '/other-sales': return <OtherSales />;
      case '/total-revenue': return <TotalRevenue />;
      case '/investment': return <InvestmentPage />;
      case '/wastage': return <Wastage />;
      case '/returns': return <Returns />;
      case '/staff': return <ManageStaff />;
      case '/attendance': return user?.role === 'super_admin' ? <ManageStaff /> : <Attendance user={user} />;
      case '/settings': return <Settings />;
      default: return <Checkout resumedHeldBill={resumedHeldBill} onClearResumedHeldBill={() => setResumedHeldBill(null)} onHeldBillsChange={(count) => setHeldBillsCount(count)} onNavigate={setCurrentPath} />;
    }
  };

  // Startup loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-600 flex items-center justify-center shadow-xl shadow-indigo-600/40 animate-pulse">
            <span className="text-white font-bold text-sm">POS</span>
          </div>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in — show public pages (with optional suspension message)
  if (!user) {
    // If on /login URL, show only the login page
    if (isLoginOnly) {
      return (
        <>
          {suspendedMessage && (
            <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center p-4 bg-slate-950">
              <div className="w-full max-w-md bg-rose-900/40 border border-rose-500/40 rounded-2xl p-6 text-center shadow-2xl backdrop-blur-sm">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-rose-300 mb-1">Shop Suspended</h3>
                <p className="text-sm text-rose-200/80 mb-4">{suspendedMessage}</p>
                <button
                  onClick={() => setSuspendedMessage('')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}
          <Login onLoginSuccess={handleLoginSuccess} />
        </>
      );
    }

    // Otherwise show public pages
    return (
      <>
        {suspendedMessage && (
          <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center p-4 bg-slate-950">
            <div className="w-full max-w-md bg-rose-900/40 border border-rose-500/40 rounded-2xl p-6 text-center shadow-2xl backdrop-blur-sm">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-rose-300 mb-1">Shop Suspended</h3>
              <p className="text-sm text-rose-200/80 mb-4">{suspendedMessage}</p>
              <button
                onClick={() => setSuspendedMessage('')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Go to Login
              </button>
            </div>
          </div>
        )}
        {/* Shared sticky top bar for all public pages */}
        <div className="sticky top-0 z-50">
          <TopInfoBar />
        </div>
        {publicPage === 'home' && <Home onNavigate={setPublicPage} onLoginSuccess={handleLoginSuccess} publicPage={publicPage} />}
        {publicPage === 'about' && <AboutUs onNavigate={setPublicPage} publicPage={publicPage} />}
        {publicPage === 'contact' && <ContactUs onNavigate={setPublicPage} publicPage={publicPage} />}
      </>
    );
  }

  // Logged in — show dashboard
  return (
    <DashboardLayout
      user={user}
      lowStockItems={lowStockAlerts}
      expiryItems={expiryAlerts}
      heldBillsCount={heldBillsCount}
      newContactMessagesCount={newContactMessagesCount}
      pendingSubscriptionsCount={pendingSubscriptionsCount}
      currentPath={currentPath}
      onNavigate={(path) => setCurrentPath(path)}
      onLogout={handleLogout}
      logoColor={logoColor}
    >
      {renderPageContent()}
    </DashboardLayout>
  );
}
