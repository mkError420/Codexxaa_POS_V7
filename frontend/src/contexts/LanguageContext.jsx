import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Complete English to Bangla Translations Dictionary
const translations = {
  en: {
    // Navbar & Layout
    'dashboard': 'Dashboard',
    'global_analytics': 'Global Analytics',
    'shop_dashboard': 'Shop Dashboard',
    'manage_shops': 'Manage Shops',
    'system_users': 'System Users',
    'inventory_products': 'Inventory (Products)',
    'subscriptions': 'Subscriptions',
    'hero_slides': 'Hero Slides',
    'team_members': 'Team Members',
    'contact_info': 'Contact Info',
    'contact_messages': 'Contact Messages',
    'pricing_plans': 'Pricing Plans',
    'more_services': 'Our More Services',
    'our_more_services': 'Our More Services',
    'wastage': 'Wastage',
    'other_cost': 'Other Cost',
    'total_revenue': 'Total Revenue',
    'attendance_records': 'Attendance Records',
    'attendance': 'Attendance',
    'settings': 'Settings',
    'pos_checkout': 'POS Checkout',
    'held_bills': 'Due Bills',
    'manual_orders': 'Sales Orders',
    'sales_history': 'Sales History',
    'all_transactions': 'All Transactions',
    'product_returns': 'Product Returns',
    'suppliers': 'Product Purchases',
    'customers': 'Customers',
    'inflow_transactions': 'Inflow & Transactions',
    'investment': 'Investment',
    'manage_staff': 'Manage Staff',
    'inventory_catalog': 'Inventory Catalog',
    'wastage_logs': 'Wastage Logs',
    'supplier_products': 'Supplier Products',

    // Section Titles
    'section_system_admin': 'System Administration',
    'section_website_mgmt': 'Website Management',
    'section_financials_reports': 'Financials & Reports',
    'section_attendance': 'Attendance',
    'section_settings': 'Settings',
    'section_dashboard': 'Dashboard',
    'section_sales_billing': 'Sales & Billing',
    'section_inventory_wastage': 'Inventory & Wastage',
    'section_directory': 'Directory',
    'section_financials': 'Financials',
    'section_management': 'Management',

    // Roles
    'role_super_admin': 'Super Admin',
    'role_shop_admin': 'Shop Admin',
    'role_shop_staff': 'Shop Staff',

    // Top Header & Actions
    'inventory_alerts': 'Inventory Alerts',
    'warnings': 'Warnings',
    'alerts': 'Alerts',
    'all_alerts': 'All',
    'low_stock_tab': 'Low Stock',
    'expiry_tab': 'Expiry Alerts',
    'low_stock': 'Low Stock',
    'expiring_soon': 'Expiring Soon',
    'expired': 'Expired',
    'expires_today': 'Expires Today',
    'no_alerts': 'All stock levels and expiry dates are in good standing.',
    'view_inventory': 'View Low Stock & Expiring Inventory',
    'contact_messages_alert': 'Contact Messages',
    'new_messages': 'New',
    'no_new_messages': 'No new messages',
    'view_all_messages': 'View All Messages',
    'shop_settings': 'Shop Settings',
    'admin_profile': 'Admin Profile & Password',
    'store_settings': 'Store & POS Settings',
    'admin_credentials': 'Admin Login & Security',
    'login_email': 'Login Email',
    'store_email': 'Official Store Email',
    'sign_out': 'Sign Out',
    'switch_theme': 'Switch theme',
    'open_menu': 'Open Menu',
    'language': 'Language',
    'language_en': 'English',
    'language_bn': 'বাংলা',
    'switch_language': 'Switch Language',

    // Common Buttons & Actions
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'edit': 'Edit',
    'add': 'Add',
    'search': 'Search',
    'filter': 'Filter',
    'refresh': 'Refresh',
    'download': 'Download',
    'export': 'Export',
    'submit': 'Submit',
    'confirm': 'Confirm',
    'back': 'Back',
    'close': 'Close',
    'status': 'Status',
    'active': 'Active',
    'suspended': 'Suspended',
    'inactive': 'Inactive',
    'actions': 'Actions',
    'loading': 'Loading...',
    'success': 'Success',
    'error': 'Error',
    'warning': 'Warning',
    'total': 'Total',
    'amount': 'Amount',
    'date': 'Date',
    'notes': 'Notes',

    // POS & Checkout
    'search_products': 'Search products by name or barcode/SKU...',
    'cart': 'Shopping Cart',
    'empty_cart': 'Your cart is empty',
    'quantity': 'Qty',
    'price': 'Price',
    'subtotal': 'Subtotal',
    'discount': 'Discount',
    'tax': 'Tax',
    'paid_amount': 'Paid Amount',
    'due_amount': 'Due Amount',
    'change': 'Change',
    'payment_method': 'Payment Method',
    'cash': 'Cash',
    'card': 'Card',
    'mobile_pay': 'Mobile Pay',
    'place_order': 'Complete Sale',
    'hold_bill': 'Hold Bill',
    'print_receipt': 'Print Receipt',
    'customer': 'Customer',
    'walk_in_customer': 'Walk-in Customer',

    // Database Backup
    'database_backup': 'Shop-Wise Database Backup',
    'db_backup_subtitle': 'Download complete, standalone MySQL SQL dump files partitioned by tenant shop or export the entire multi-tenant database.',
    'select_shop': 'Select Target Tenant Shop',
    'download_shop_db': 'Download Shop Database (.sql)',
    'export_full_db': 'Export Full System DB (.sql)',
    'total_records': 'Total Records',
    'products': 'Products',
    'sales_done': 'Sales Done',
    'est_size': 'Est. Size',
    'itemized_records': 'Itemized Table Records:',
    'generating_sql': 'Generating SQL Dump...',
    'super_admin_tool': 'Super Admin Tool',
    'preview_scope': 'Database Backup Preview'
  },
  bn: {
    // Navbar & Layout
    'dashboard': 'ড্যাশবোর্ড',
    'global_analytics': 'সার্বিক অ্যানালিটিক্স',
    'shop_dashboard': 'দোকান ড্যাশবোর্ড',
    'manage_shops': 'দোকানসমূহ পরিচালনা',
    'system_users': 'সিস্টেম ব্যবহারকারী',
    'inventory_products': 'ইনভেন্টরি (পণ্য)',
    'subscriptions': 'সাবস্ক্রিপশন',
    'hero_slides': 'হিরো স্লাইড',
    'team_members': 'টিম মেম্বার',
    'contact_info': 'যোগাযোগ তথ্য',
    'contact_messages': 'গ্রাহক বার্তা',
    'pricing_plans': 'মূল্য তালিকা',
    'more_services': 'আমাদের আরও সেবাসমূহ',
    'our_more_services': 'আমাদের আরও সেবাসমূহ',
    'wastage': 'অপচয় ও নষ্ট',
    'other_cost': 'অন্যান্য খরচ',
    'total_revenue': 'মোট আয় ও লাভ',
    'attendance_records': 'হাজিরা রেকর্ড',
    'attendance': 'হাজিরা',
    'settings': 'সেটিংস',
    'pos_checkout': 'পিওএস ক্যাশ কাউন্টার',
    'held_bills': 'বকেয়া বিলসমূহ',
    'manual_orders': 'অর্ডারসমূহ',
    'sales_history': 'বিক্রয় ইতিহাস',
    'all_transactions': 'সকল লেনদেন',
    'product_returns': 'পণ্য ফেরত',
    'suppliers': 'পণ্য ক্রয় ও সরবরাহকারী',
    'customers': 'গ্রাহক তালিকা',
    'inflow_transactions': 'অন্যান্য আয় ও লেনদেন',
    'investment': 'বিনিয়োগ',
    'manage_staff': 'কর্মচারী পরিচালনা',
    'inventory_catalog': 'পণ্য ক্যাটালগ',
    'wastage_logs': 'অপচয় হিসাব',

    // Section Titles
    'section_system_admin': 'সিস্টেম অ্যাডমিনিস্ট্রেশন',
    'section_website_mgmt': 'ওয়েবসাইট ব্যবস্থাপনা',
    'section_financials_reports': 'আর্থিক হিসাব ও রিপোর্ট',
    'section_attendance': 'উপস্থিতি ও হাজিরা',
    'section_settings': 'সেটিংস ও কনফিগারেশন',
    'section_dashboard': 'ড্যাশবোর্ড',
    'section_sales_billing': 'বিক্রয় ও বিলিং',
    'section_inventory_wastage': 'ইনভেন্টরি ও অপচয়',
    'section_directory': 'ডিরেক্টরি ও যোগাযোগ',
    'section_financials': 'আর্থিক হিসাব',
    'section_management': 'ব্যবস্থাপনা',

    // Roles
    'role_super_admin': 'সুপার অ্যাডমিন',
    'role_shop_admin': 'শপ অ্যাডমিন',
    'role_shop_staff': 'শপ স্টাফ',

    // Top Header & Actions
    'inventory_alerts': 'ইনভেন্টরি সতর্কতা',
    'warnings': 'সতর্কতা',
    'alerts': 'সতর্কতা',
    'all_alerts': 'সকল',
    'low_stock_tab': 'কম স্টক',
    'expiry_tab': 'মেয়াদ সতর্কতা',
    'low_stock': 'কম স্টক',
    'expiring_soon': 'মেয়াদ দ্রুত শেষ হবে',
    'expired': 'মেয়াদোত্তীর্ণ',
    'expires_today': 'আজ মেয়াদ শেষ হবে',
    'no_alerts': 'সকল পণ্যের স্টক ও মেয়াদের তারিখ স্বাভাবিক রয়েছে।',
    'view_inventory': 'কম স্টক ও মেয়াদোত্তীর্ণ পণ্য দেখুন',
    'contact_messages_alert': 'গ্রাহক বার্তা',
    'new_messages': 'নতুন',
    'no_new_messages': 'কোনো নতুন বার্তা নেই',
    'view_all_messages': 'সকল বার্তা দেখুন',
    'shop_settings': 'দোকান সেটিংস',
    'admin_profile': 'অ্যাডমিন প্রোফাইল ও পাসওয়ার্ড',
    'store_settings': 'দোকান ও পিওএস সেটিংস',
    'admin_credentials': 'অ্যাডমিন লগইন ও নিরাপত্তা',
    'login_email': 'লগইন ইমেইল',
    'store_email': 'দোকানের যোগাযোগের ইমেইল',
    'sign_out': 'লগআউট',
    'switch_theme': 'থিম পরিবর্তন',
    'open_menu': 'মেনু খুলুন',
    'language': 'ভাষা',
    'language_en': 'English',
    'language_bn': 'বাংলা',
    'switch_language': 'ভাষা পরিবর্তন করুন',

    // Common Buttons & Actions
    'save': 'সংরক্ষণ করুন',
    'cancel': 'বাতিল',
    'delete': 'মুছুন',
    'edit': 'সম্পাদনা',
    'add': 'যোগ করুন',
    'search': 'অনুসন্ধান করুন',
    'filter': 'ফিল্টার',
    'refresh': 'রিফ্রেশ',
    'download': 'ডাউনলোড',
    'export': 'এক্সপোর্ট',
    'submit': 'জমা দিন',
    'confirm': 'নিশ্চিত করুন',
    'back': 'ফিরে যান',
    'close': 'বন্ধ করুন',
    'status': 'অবস্থা',
    'active': 'সক্রিয়',
    'suspended': 'স্থগিত',
    'inactive': 'নিষ্ক্রিয়',
    'actions': 'অ্যাকশন',
    'loading': 'লোড হচ্ছে...',
    'success': 'সফল',
    'error': 'ত্রুটি',
    'warning': 'সতর্কতা',
    'total': 'মোট',
    'amount': 'পরিমাণ',
    'date': 'তারিখ',
    'notes': 'মন্তব্য',

    // POS & Checkout
    'search_products': 'পণ্যের নাম বা বারকোড দিয়ে খুঁজুন...',
    'cart': 'শপিং কার্ট',
    'empty_cart': 'কার্ট খালি রয়েছে',
    'quantity': 'পরিমাণ',
    'price': 'মূল্য',
    'subtotal': 'উপমোট',
    'discount': 'ডিসকাউন্ট',
    'tax': 'ভ্যাট/ট্যাক্স',
    'paid_amount': 'পরিশোধিত টাকা',
    'due_amount': 'বকেয়া টাকা',
    'change': 'ফেরত টাকা',
    'payment_method': 'পেমেন্ট মাধ্যম',
    'cash': 'ক্যাশ',
    'card': 'কার্ড',
    'mobile_pay': 'মোবাইল ব্যাংকিং',
    'place_order': 'বিক্রয় সম্পন্ন করুন',
    'hold_bill': 'বিল হোল্ড করুন',
    'print_receipt': 'রিসিপ্ট প্রিন্ট',
    'customer': 'গ্রাহক',
    'walk_in_customer': 'সাধারণ খরিদ্দার',

    // Database Backup
    'database_backup': 'দোকান অনুযায়ী ডাটাবেস ব্যাকআপ',
    'db_backup_subtitle': 'যেকোনো দোকানের সম্পূর্ণ ডাটাবেস SQL ফাইল হিসেবে ডাউনলোড করুন অথবা সম্পূর্ণ সিস্টেমের ব্যাকআপ এক্সপোর্ট করুন।',
    'select_shop': 'টার্গেট দোকান নির্বাচন করুন',
    'download_shop_db': 'দোকান ডাটাবেস ডাউনলোড (.sql)',
    'export_full_db': 'সম্পূর্ণ সিস্টেম ডাটাবেস এক্সপোর্ট (.sql)',
    'total_records': 'মোট রেকর্ড',
    'products': 'পণ্যসমূহ',
    'sales_done': 'বিক্রয়সমূহ',
    'est_size': 'আনুমানিক সাইজ',
    'itemized_records': 'টেবিল ভিত্তিক রেকর্ডসমূহ:',
    'generating_sql': 'SQL ডাম্প প্রস্তুত হচ্ছে...',
    'super_admin_tool': 'সুপার অ্যাডমিন টুল',
    'preview_scope': 'ডাটাবেস ব্যাকআপ প্রিভিউ'
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('pos_language') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('pos_language', language);
    // Set document lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang) => {
    if (lang === 'bn' || lang === 'en') {
      setLanguageState(lang);
    }
  };

  const toggleLanguage = () => {
    setLanguageState(prev => (prev === 'en' ? 'bn' : 'en'));
  };

  // Translation helper function
  const t = (key, defaultText = '') => {
    if (!key) return defaultText;
    const currentDict = translations[language] || translations.en;
    if (currentDict && currentDict[key] !== undefined) {
      return currentDict[key];
    }
    // Fallback to English dictionary
    if (translations.en && translations.en[key] !== undefined) {
      return translations.en[key];
    }
    return defaultText || key;
  };

  // Convert numbers to Bengali digits if current language is 'bn'
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '';
    const str = num.toString();
    if (language !== 'bn') return str;
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return str.replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, formatNumber }}>
      {children}
    </LanguageContext.Provider>
  );
};
