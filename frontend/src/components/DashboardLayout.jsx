import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';

export default function DashboardLayout({
  children,
  user = { name: 'Sarah Connor', role: 'shop_admin', shop_name: 'Downtown Tech Emporium' },
  lowStockItems = [],
  expiryItems = [],
  currentPath = '/dashboard',
  onNavigate,
  onLogout = () => console.log('Logged out'),
  heldBillsCount = 0,
  newContactMessagesCount = 0,
  pendingSubscriptionsCount = 0,
  logoColor = '#C4A484'
}) {
  const { language, t, formatNumber } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [alertFilter, setAlertFilter] = useState('all'); // 'all', 'low_stock', 'expiry'
  const [currentTime, setCurrentTime] = useState(new Date());
  const notificationsRef = useRef(null);
  const profileDropdownRef = useRef(null);
  
  // Theme colors
  const themeColors = [
    { name: 'green', bg: '#c4e0c4d3', logo: '#0f5c0f' },
    { name: 'beige', bg: '#f8f1ea', logo: '#dd7922' },
    { name: 'blue', bg: '#d4e0e8', logo: '#00405e' }
  ];

  const [currentTheme, setCurrentTheme] = useState(themeColors[0]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close notifications & profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    if (showNotifications || showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showNotifications, showProfileDropdown]);

  // Dynamic Badge Color mapping based on user role
  const getRoleBadge = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
      case 'shop_admin':
        return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      case 'shop_staff':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'super_admin':
        return t('role_super_admin', 'Super Admin');
      case 'shop_admin':
        return t('role_shop_admin', 'Shop Admin');
      case 'shop_staff':
        return t('role_shop_staff', 'Shop Staff');
      default:
        return role ? role.replace('_', ' ') : '';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans text-slate-900 dark:text-slate-100" style={{ backgroundColor: currentTheme.bg }}>
      
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        role={user.role}
        logo={user.logo}
        allowedSections={user.allowed_sections}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        currentPath={currentPath}
        onNavigate={onNavigate}
        heldBillsCount={heldBillsCount}
        newContactMessagesCount={newContactMessagesCount}
        pendingSubscriptionsCount={pendingSubscriptionsCount}
      />

      {/* 2. Main Page Framework */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        
        {/* Top Header Bar */}
        <header className="flex items-center justify-between h-16 px-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
          
          {/* Left Header: Mobile Toggle & Context Info */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none lg:hidden"
              title={t('open_menu', 'Open Menu')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => onNavigate('/dashboard')}
              className="hidden sm:block hover:opacity-80 transition-opacity"
              title={t('dashboard', 'Go to Dashboard')}
            >
              <h1 
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: currentTheme.logo }}
              >
                {user.shop_name}
              </h1>
            </button>
          </div>

          {/* Right Header: Actions, Alerts, and Profile */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            
            {/* Language Change Switcher */}
            <LanguageToggle />

            {/* Date and Time Display */}
            <div className="hidden md:flex flex-col items-end">
              <div className="text-lg font-bold text-slate-800 dark:text-slate-200 font-mono">
                {language === 'bn' 
                  ? formatNumber(currentTime.toLocaleTimeString('en-US', { 
                      hour12: true, 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit' 
                    }))
                  : currentTime.toLocaleTimeString('en-US', { 
                      hour12: true, 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit' 
                    })
                }
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {currentTime.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            
            {/* Theme Color Buttons */}
            <div className="hidden sm:flex items-center space-x-2">
              {themeColors.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => setCurrentTheme(theme)}
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 focus:outline-none ${
                    currentTheme.name === theme.name 
                      ? 'border-slate-800 dark:border-slate-200 ring-2 ring-offset-2 ring-slate-400' 
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                  style={{ backgroundColor: theme.bg }}
                  title={`${t('switch_theme', 'Switch to')} ${theme.name}`}
                />
              ))}
            </div>

            
            {user.role !== 'super_admin' && (() => {
              const allLowStock = Array.isArray(lowStockItems) ? lowStockItems : [];
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              // Process and sort all expiry items (earliest/expired first)
              const allExpiry = (Array.isArray(expiryItems) ? expiryItems : [])
                .filter(item => item && item.expiry_date)
                .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

              const totalAlerts = allLowStock.length + allExpiry.length;

              return (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      setShowProfileDropdown(false);
                    }}
                    className={`relative p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none transition-colors ${
                      totalAlerts > 0 ? 'text-amber-500 hover:text-amber-600' : ''
                    }`}
                    title={t('inventory_alerts', 'Stock & Expiry Notifications')}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {totalAlerts > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 min-w-[16px] px-1 bg-rose-500 text-[10px] font-bold text-white items-center justify-center shadow-sm">
                          {formatNumber(totalAlerts)}
                        </span>
                      </span>
                    )}
                  </button>

                  {/* Notifications Dropdown Drawer */}
                  {showNotifications && (
                    <div ref={notificationsRef} className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* Header */}
                      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                            {t('inventory_alerts', 'Inventory Alerts')}
                          </span>
                          {totalAlerts > 0 && (
                            <span className="text-xs font-semibold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full">
                              {formatNumber(totalAlerts)} {t('alerts', 'Alerts')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Filter Tabs */}
                      {totalAlerts > 0 && (
                        <div className="flex items-center border-b border-slate-200 dark:border-slate-700 px-3 py-1.5 bg-slate-50/50 dark:bg-slate-800 text-xs font-medium space-x-1.5">
                          <button
                            onClick={() => setAlertFilter('all')}
                            className={`px-2.5 py-1 rounded-lg transition-colors ${
                              alertFilter === 'all'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                            }`}
                          >
                            {t('all_alerts', 'All')} ({formatNumber(totalAlerts)})
                          </button>
                          <button
                            onClick={() => setAlertFilter('low_stock')}
                            className={`px-2.5 py-1 rounded-lg transition-colors ${
                              alertFilter === 'low_stock'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                            }`}
                          >
                            {t('low_stock_tab', 'Low Stock')} ({formatNumber(allLowStock.length)})
                          </button>
                          <button
                            onClick={() => setAlertFilter('expiry')}
                            className={`px-2.5 py-1 rounded-lg transition-colors ${
                              alertFilter === 'expiry'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                            }`}
                          >
                            {t('expiry_tab', 'Expiry Alerts')} ({formatNumber(allExpiry.length)})
                          </button>
                        </div>
                      )}

                      {/* Alerts List */}
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                        {totalAlerts === 0 ? (
                          <div className="p-8 text-center">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {t('no_alerts', 'All stock levels and expiry dates are in good standing.')}
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Low Stock Items */}
                            {(alertFilter === 'all' || alertFilter === 'low_stock') &&
                              allLowStock.map((item) => (
                                <div
                                  key={`low-${item.id}`}
                                  onClick={() => {
                                    if (onNavigate) onNavigate('/products');
                                    setShowNotifications(false);
                                  }}
                                  className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors"
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                        {item.name}
                                      </h4>
                                      {item.sku && (
                                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                          SKU: {item.sku}
                                        </span>
                                      )}
                                    </div>
                                    <span className="inline-flex items-center text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full shrink-0">
                                      {t('low_stock', 'Low Stock')}
                                    </span>
                                  </div>
                                  <div className="mt-1.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                    <span>
                                      {t('stock', 'Stock')}: <strong className="text-amber-600 dark:text-amber-400 font-bold">{formatNumber(item.stock_quantity)}</strong> {item.unit || 'pcs'}
                                    </span>
                                    <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                                      {t('threshold', 'Alert Threshold')}: {formatNumber(item.low_stock_threshold || 10)} {item.unit || 'pcs'}
                                    </span>
                                  </div>
                                </div>
                              ))}

                            {/* Expiring / Expired Items */}
                            {(alertFilter === 'all' || alertFilter === 'expiry') &&
                              allExpiry.map((item) => {
                                const expiry = new Date(item.expiry_date);
                                expiry.setHours(0, 0, 0, 0);
                                const diffTime = expiry.getTime() - today.getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                const isExpired = diffDays < 0;
                                const isToday = diffDays === 0;

                                return (
                                  <div
                                    key={`exp-${item.id}`}
                                    onClick={() => {
                                      if (onNavigate) onNavigate('/products');
                                      setShowNotifications(false);
                                    }}
                                    className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors"
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="min-w-0 flex-1">
                                        <h4 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                          {item.name}
                                        </h4>
                                        {item.sku && (
                                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                            SKU: {item.sku}
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                                          isExpired
                                            ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/60'
                                            : isToday
                                            ? 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800/60'
                                            : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60'
                                        }`}
                                      >
                                        {isExpired
                                          ? t('expired', 'Expired')
                                          : isToday
                                          ? t('expires_today', 'Expires Today')
                                          : t('expiring_soon', 'Expiring Soon')}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                      <span className={isExpired ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}>
                                        {isExpired
                                          ? `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`
                                          : isToday
                                          ? 'Expires today'
                                          : `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`} ({expiry.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')})
                                      </span>
                                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                                        {t('stock', 'Stock')}: {formatNumber(item.stock_quantity)} {item.unit || 'pcs'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                          </>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 text-center">
                        <button
                          onClick={() => {
                            if (onNavigate) onNavigate('/products');
                            setShowNotifications(false);
                          }}
                          className="w-full text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                        >
                          {t('view_inventory', 'View Low Stock & Expiring Inventory')} →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Contact Messages Notification for Super Admin */}
            {user.role === 'super_admin' && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setShowProfileDropdown(false);
                  }}
                  className={`relative p-2 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none ${
                    newContactMessagesCount > 0 ? 'text-blue-500 hover:text-blue-600' : ''
                  }`}
                  title={t('contact_messages_alert', 'Contact Messages')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {newContactMessagesCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500 text-[10px] font-bold text-white items-center justify-center">
                        {formatNumber(newContactMessagesCount)}
                      </span>
                    </span>
                  )}
                </button>

                {/* Contact Messages Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <span>{t('contact_messages_alert', 'Contact Messages')}</span>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        {formatNumber(newContactMessagesCount)} {t('new_messages', 'New')}
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {newContactMessagesCount === 0 ? (
                        <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-sm">
                          {t('no_new_messages', 'No new messages')}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-slate-600 dark:text-slate-300 text-sm">
                          {formatNumber(newContactMessagesCount)} {t('contact_messages_alert', 'new message(s) waiting')}
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 text-center">
                      <button
                        onClick={() => {
                          if (onNavigate) onNavigate('/contact-messages');
                          setShowNotifications(false);
                        }}
                        className="w-full text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 py-1"
                      >
                        {t('view_all_messages', 'View All Messages')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Profile Dropdown Component */}
            <div ref={profileDropdownRef} className="relative">
              <button
                onClick={() => {
                  setShowProfileDropdown(!showProfileDropdown);
                  setShowNotifications(false);
                }}
                className="flex items-center space-x-3 focus:outline-none hover:opacity-90 transition-opacity dark:hover:opacity-80"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-700">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.name}</p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getRoleBadge(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                </div>
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 md:hidden">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                  </div>
                  {user.role === 'super_admin' ? (
                    <button
                      onClick={() => {
                        if (onNavigate) onNavigate('/settings');
                        setShowProfileDropdown(false);
                      }}
                      className="flex w-full items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                    >
                      {t('settings', 'Account Settings')}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          window.location.hash = '';
                          if (onNavigate) onNavigate('/settings');
                          setShowProfileDropdown(false);
                        }}
                        className="flex w-full items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                      >
                        {t('store_settings', 'Store Settings')}
                      </button>
                      <button
                        onClick={() => {
                          window.location.hash = '#account';
                          if (onNavigate) onNavigate('/settings');
                          setShowProfileDropdown(false);
                        }}
                        className="flex w-full items-center px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left font-medium"
                      >
                        {t('admin_profile', 'Admin Profile & Password')}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      setTimeout(() => {
                        onLogout();
                      }, 100);
                    }}
                    className="flex w-full items-center px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 border-t border-slate-100 dark:border-slate-700 text-left font-medium"
                  >
                    {t('sign_out', 'Sign Out')}
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* 3. Main Dashboard Workspace Content Area */}
        <main
          className={`flex-1 focus:outline-none ${currentPath === '/checkout' ? 'overflow-hidden p-4' : 'overflow-y-auto p-6'}`}
          style={{ backgroundColor: currentTheme.bg }}
        >
          <div className={currentPath === '/checkout' ? 'w-full h-full' : 'max-w-7xl mx-auto'}>
            {React.cloneElement(children, { onNavigate })}
          </div>
        </main>

      </div>
    </div>
  );
}
