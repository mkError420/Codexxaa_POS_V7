import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

// Inline SVG Icon Helper Components
const DashboardIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" /></svg>;
const POSIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
const InventoryIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
const UsersIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const ReportsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>;
const SuppliersIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
const ShopsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
const SettingsIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const ManualOrdersIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const TransactionIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const AttendanceIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const InvestmentIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const TeamIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const HeroIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const PricingIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ServicesIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
export default function Sidebar({
  role = 'shop_admin',
  logo = null,
  allowedSections = null,
  sidebarOpen,
  setSidebarOpen,
  isCollapsed,
  setIsCollapsed,
  currentPath = '/dashboard',
  onNavigate,
  heldBillsCount = 0,
  newContactMessagesCount = 0,
  pendingSubscriptionsCount = 0
}) {
  const { t, language, formatNumber } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getNavItems = () => {
    switch (role) {
      case 'super_admin':
        return [
          {
            section: t('section_system_admin', 'System Administration'),
            items: [
              { label: t('global_analytics', 'Global Analytics'), path: '/dashboard', icon: <DashboardIcon /> },
              { label: t('manage_shops', 'Manage Shops'), path: '/shops', icon: <ShopsIcon /> },
              { label: t('system_users', 'System Users'), path: '/users', icon: <UsersIcon /> },
              { label: t('inventory_products', 'Inventory (Products)'), path: '/products', icon: <InventoryIcon /> },
              { label: t('supplier_products', 'Supplier Products'), path: '/supplier-products', icon: <SuppliersIcon /> },
            ]
          },
          {
            section: t('section_website_mgmt', 'Website Management'),
            items: [
              { label: t('subscriptions', 'Subscriptions'), path: '/subscriptions', icon: <PricingIcon />, badge: pendingSubscriptionsCount },
              { label: t('hero_slides', 'Hero Slides'), path: '/hero-slides', icon: <HeroIcon /> },
              { label: t('videos', 'Videos'), path: '/videos', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> },
              { label: t('team_members', 'Team Members'), path: '/team-members', icon: <TeamIcon /> },
              { label: t('contact_info', 'Contact Info'), path: '/contact-information', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
              { label: t('contact_messages', 'Contact Messages'), path: '/contact-messages', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>, badge: newContactMessagesCount },
              { label: t('pricing_plans', 'Pricing Plans'), path: '/pricing-plans', icon: <PricingIcon /> },
              { label: t('more_services', 'Our More Services'), path: '/more-services', icon: <ServicesIcon /> },
            ]
          },
          {
            section: t('section_financials_reports', 'Financials & Reports'),
            items: [
              { label: t('wastage', 'Wastage'), path: '/wastage', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> },
              { label: t('other_cost', 'Other Cost'), path: '/other-cost', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              { label: t('total_revenue', 'Total Revenue'), path: '/total-revenue', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
            ]
          },
          {
            section: t('section_attendance', 'Attendance'),
            items: [
              { label: t('attendance_records', 'Attendance Records'), path: '/attendance', icon: <AttendanceIcon /> },
            ]
          },
          {
            section: t('section_settings', 'Settings'),
            items: [
              { label: t('settings', 'Settings'), path: '/settings', icon: <SettingsIcon /> },
            ]
          }
        ];
      case 'shop_admin':
        return [
          {
            section: t('section_dashboard', 'Dashboard'),
            items: [
              { label: t('shop_dashboard', 'Shop Dashboard'), path: '/dashboard', icon: <DashboardIcon /> }
            ]
          },
          {
            section: t('section_sales_billing', 'Sales & Billing'),
            items: [
              { label: t('pos_checkout', 'POS Checkout'), path: '/checkout', icon: <POSIcon /> },
              { label: t('held_bills', 'Due Bills'), path: '/held-bills', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, badge: heldBillsCount },
              { label: t('manual_orders', 'Sales Orders'), path: '/manual-orders', icon: <ManualOrdersIcon /> },
              { label: t('sales_history', 'Sales History'), path: '/sales', icon: <ReportsIcon /> },
              { label: t('all_transactions', 'All Transactions'), path: '/all-transactions', icon: <TransactionIcon /> },
              { label: t('product_returns', 'Product Returns'), path: '/returns', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-3a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m-9 5h1a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" /></svg> }
            ]
          },
          {
            section: t('section_inventory_wastage', 'Inventory & Wastage'),
            items: [
              { label: t('inventory_products', 'Inventory (Products)'), path: '/products', icon: <InventoryIcon /> },
              { label: t('wastage', 'Wastage'), path: '/wastage', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> }
            ]
          },
          {
            section: t('section_directory', 'Directory'),
            items: [
              { label: t('suppliers', 'Product Purchases'), path: '/suppliers', icon: <SuppliersIcon /> },
              { label: t('customers', 'Customers'), path: '/customers', icon: <UsersIcon /> }
            ]
          },
          {
            section: t('section_financials', 'Financials'),
            items: [
              { label: t('other_cost', 'Other Cost'), path: '/other-cost', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              { label: t('inflow_transactions', 'Inflow & Transactions'), path: '/other-sales', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              { label: t('investment', 'Investment'), path: '/investment', icon: <InvestmentIcon /> },
              { label: t('total_revenue', 'Total Revenue'), path: '/total-revenue', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
              
            ]
          },
          {
            section: t('section_management', 'Management'),
            items: [
              { label: t('manage_staff', 'Manage Staff'), path: '/staff', icon: <UsersIcon /> },
              { label: t('attendance', 'Attendance'), path: '/attendance', icon: <AttendanceIcon /> },
              { label: t('settings', 'Settings'), path: '/settings', icon: <SettingsIcon /> }
            ]
          }
        ];
      case 'shop_staff':
        return [
          {
            section: t('section_sales_billing', 'Sales & Billing'),
            items: [
              { label: t('pos_checkout', 'POS Checkout'), path: '/checkout', icon: <POSIcon /> },
              { label: t('held_bills', 'Due Bills'), path: '/held-bills', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, badge: heldBillsCount },
              { label: t('manual_orders', 'Sales Orders'), path: '/manual-orders', icon: <ManualOrdersIcon /> },
              { label: t('sales_history', 'Sales History'), path: '/sales', icon: <ReportsIcon /> },
              { label: t('all_transactions', 'All Transactions'), path: '/all-transactions', icon: <TransactionIcon /> },
              { label: t('product_returns', 'Product Returns'), path: '/returns', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-3a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m-9 5h1a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" /></svg> }
            ]
          },
          {
            section: t('section_inventory_wastage', 'Inventory & Wastage'),
            items: [
              { label: t('inventory_catalog', 'Inventory Catalog'), path: '/products', icon: <InventoryIcon /> },
              { label: t('wastage_logs', 'Wastage Logs'), path: '/wastage', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> }
            ]
          },
          {
            section: t('section_directory', 'Directory'),
            items: [
              { label: t('suppliers', 'Product Purchases'), path: '/suppliers', icon: <SuppliersIcon /> },
              { label: t('customers', 'Customers'), path: '/customers', icon: <UsersIcon /> }
            ]
          },
          {
            section: t('section_financials', 'Financials'),
            items: [
              { label: t('other_cost', 'Other Cost'), path: '/other-cost', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              { label: t('total_revenue', 'Total Revenue'), path: '/total-revenue', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> }
            ]
          },
          {
            section: t('section_attendance', 'Attendance'),
            items: [
              { label: t('attendance', 'Attendance'), path: '/attendance', icon: <AttendanceIcon /> }
            ]
          },
          {
            section: t('section_settings', 'Settings'),
            items: [
              { label: t('settings', 'Settings'), path: '/settings', icon: <SettingsIcon /> }
            ]
          }
        ];
      default:
        return [];
    }
  };

  const rawNavItems = getNavItems();
  const navItems = React.useMemo(() => {
    if (role !== 'shop_staff' || !allowedSections) {
      return rawNavItems;
    }
    return rawNavItems
      .map(sec => ({
        ...sec,
        items: sec.items.filter(item => allowedSections.includes(item.path))
      }))
      .filter(sec => sec.items.length > 0);
  }, [rawNavItems, role, allowedSections]);

  return (
    <>
      {/* 1. Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 2. Sidebar Navigation Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-100 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${isCollapsed ? 'w-16' : (role === 'super_admin' ? 'w-60' : 'w-56')}`}
      >
        {/* Brand Header */}
        <div className="flex flex-col border-b border-slate-800">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-16 px-3.5`}>
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2.5'} overflow-hidden`}>
              {logo ? (
                <img
                  src={logo}
                  alt="Brand Logo"
                  className="w-8 h-8 rounded-lg object-contain bg-slate-900 border border-slate-700 shrink-0"
                />
              ) : (
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 font-bold text-xs text-slate-800 shrink-0">
                  POS
                </div>
              )}
              {!isCollapsed && (
                <span className="text-base font-bold tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent truncate">
                  {role === 'super_admin' ? 'SuperAdmin' : 'ShopPortal'}
                </span>
              )}
            </div>
            {/* Mobile close button */}
            <button
              className="p-1 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Mobile Date/Time Display */}
          <div className="lg:hidden px-4 pb-3 flex items-center justify-between">
            <div className="flex flex-col">
              <div className="text-lg font-bold text-white font-mono">
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
              <div className="text-xs text-slate-400">
                {currentTime.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-2.5 py-3 space-y-3 overflow-y-auto">
          {navItems.map((sectionObj, idx) => (
            <div key={sectionObj.section || idx} className="space-y-1">
              {/* Section Header */}
              {sectionObj.section && !isCollapsed && (
                <div className="px-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 mt-2">
                  {sectionObj.section}
                </div>
              )}
              {/* Section divider when collapsed */}
              {sectionObj.section && isCollapsed && idx > 0 && (
                <div className="border-t border-slate-800 my-2 mx-2" />
              )}

              {sectionObj.items.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (onNavigate) onNavigate(item.path);
                      setSidebarOpen(false); // Auto close mobile drawer on tap
                      // Scroll to element if scrollTo is specified
                      if (item.scrollTo) {
                        setTimeout(() => {
                          const element = document.getElementById(item.scrollTo);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }
                    }}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-2.5'} py-2 rounded-lg font-medium transition-all group text-left ${isActive
                      ? (role === 'super_admin'
                        ? 'bg-slate-100 text-slate-800 shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-100 text-slate-800 shadow-lg shadow-slate-600/30')
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    title={isCollapsed ? item.label : ''}
                  >
                    <div className={`shrink-0 ${isActive ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-800'}`}>
                      {item.icon}
                    </div>
                    {!isCollapsed && <span className="ml-2.5 truncate text-[13px]">{item.label}</span>}
                    {item.badge !== undefined && item.badge > 0 && !isCollapsed && (
                      <span className={`ml-auto text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${
                        item.path === '/contact-messages' ? 'bg-blue-500' : 'bg-amber-500'
                      }`}>
                        {formatNumber(item.badge)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Desktop Collapse Toggle Footer */}
        <div className="hidden border-t border-slate-800 p-3 lg:block">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center w-full py-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <svg
              className={`w-5 h-5 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
