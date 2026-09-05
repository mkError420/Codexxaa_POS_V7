import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import API_BASE_URL from '../config';
import ElectronicCashDrawerModal from './ElectronicCashDrawerModal';
import { triggerDrawerEjection, getDrawerConfig } from '../utils/cashDrawerService';

const createNewSaleTab = (index) => ({
  id: Date.now() + Math.random() * 1000, // Unique ID for the tab with random factor
  name: `Sale ${index}`,
  cart: [],
  selectedCustomerId: '',
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  syncToDirectory: true,
  discountPercent: 0,
  discountAmount: 0,
  paymentMethod: 'cash',
  paidAmount: '',
  isPaidTouched: false,
  reduceDueAmount: 0,
  redeemPoints: 0, // Loyalty points to redeem
  saleDate: new Date().toBDISODateString(),
  hidden: false, // Track if tab is hidden after completion
});

export default function Checkout({ onHeldBillsChange = () => { }, resumedHeldBill = null, onClearResumedHeldBill = () => { }, onNavigate = () => { } }) {
  // --- STATE MANAGEMENT ---
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [saleTabs, setSaleTabs] = useState([createNewSaleTab(1)]);
  const [activeTabId, setActiveTabId] = useState(() => {
    const initialTab = createNewSaleTab(1);
    return initialTab.id;
  });
  const [search, setSearch] = useState('');
  const [searchFocusedIndex, setSearchFocusedIndex] = useState(-1);
  const [customerFocusedIndex, setCustomerFocusedIndex] = useState(-1);
  const [currentUser, setCurrentUser] = useState(null);
  const [taxRate, setTaxRate] = useState(0.10); // Dynamic Tax Rate (default 10%)

  // Loyalty settings states
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyEarnRate, setLoyaltyEarnRate] = useState(100.00);
  const [loyaltyPointValue, setLoyaltyPointValue] = useState(1.00);

  // Barcode scanner states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [autoFocusBarcode, setAutoFocusBarcode] = useState(true);
  const barcodeInputRef = useRef(null);
  const customerInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const productTableBodyRef = useRef(null);

  // Virtual Keyboard / Numpad Pad States
  const [showKeyboardModal, setShowKeyboardModal] = useState(false);
  const [numpadTarget, setNumpadTarget] = useState('paidAmount'); // 'quantity' | 'price' | 'discountPercent' | 'discountAmount' | 'paidAmount' | 'redeemPoints'
  const [selectedCartItemId, setSelectedCartItemId] = useState(null);

  // UI States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message }
  const [receipt, setReceipt] = useState(null); // Receipts detail storage after checkout
  const [previewMode, setPreviewMode] = useState('thermal'); // 'thermal' | 'regular'
  const [showCheckoutPreview, setShowCheckoutPreview] = useState(false); // Show preview before checkout
  const [previewModeType, setPreviewModeType] = useState('checkout'); // 'checkout' or 'due'
  const [showCashDrawerModal, setShowCashDrawerModal] = useState(false); // Electronic Cash Drawer Modal

  // Held Bills States
  const [heldBills, setHeldBills] = useState([]);
  const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
  const [showHoldBillModal, setShowHoldBillModal] = useState(false);
  const [holdNotes, setHoldNotes] = useState('');
  const [holdingBill, setHoldingBill] = useState(false);

  // Subtotal inline-edit state — tracks which cart item's subtotal is being edited and its raw string
  const [editingSubtotalId, setEditingSubtotalId] = useState(null);
  const [editingSubtotalValue, setEditingSubtotalValue] = useState('');

  // Derived active tab state
  const activeTabIndex = saleTabs.findIndex(t => t.id === activeTabId);
  const activeTab = activeTabIndex > -1 ? saleTabs[activeTabIndex] : null;

  // Decode/parse current user details on start
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load user session info', e);
    }
  }, []);

  // When active tab changes, sync its details to the local form state
  useEffect(() => {
    // This effect is no longer needed as we bind directly to activeTab state.
    // Kept for historical context, can be removed.
  }, [activeTabId, saleTabs]);

  // Ensure activeTabId is valid after tab operations
  useEffect(() => {
    if (saleTabs.length > 0 && !saleTabs.find(t => t.id === activeTabId)) {
      // Prefer non-hidden tabs when setting active tab
      const firstNonHiddenTab = saleTabs.find(t => !t.hidden);
      setActiveTabId(firstNonHiddenTab?.id || saleTabs[0].id);
    }
  }, [saleTabs, activeTabId]);

  // Sync details input form fields when selection dropdown changes
  useEffect(() => {
    if (!activeTab) return;
    const selected = customers.find(c => c.id === parseInt(activeTab.selectedCustomerId));
    if (selected) {
      updateActiveTabState('customerName', selected.name || '');
      updateActiveTabState('customerPhone', selected.phone || '');
      updateActiveTabState('customerAddress', selected.address || '');
      updateActiveTabState('syncToDirectory', false);
    }
  }, [activeTab?.selectedCustomerId, customers]);

  // --- API FETCH LOGIC ---

  // 1. Fetch products matching search string
  const fetchProducts = async (searchTerm = '') => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = searchTerm
        ? `${API_BASE_URL}/products?purchased_only=true&exclude_expired=true&search=${encodeURIComponent(searchTerm)}`
        : `${API_BASE_URL}/products?purchased_only=true&exclude_expired=true&latest=10`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errMsg = 'Failed to fetch products.';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }
      const data = await response.json();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter out products that are expired (do not show expired products in POS checkout product list)
      const validProducts = data.filter(p => {
        if (p.expiry_date) {
          const exp = new Date(p.expiry_date);
          exp.setHours(0, 0, 0, 0);
          if (exp.getTime() < today.getTime()) return false;
        }
        return true;
      });

      // Sort: in-stock products first, out-of-stock (≤ 0) pushed to the bottom
      const sorted = [...validProducts].sort((a, b) => {
        const aOut = parseFloat(a.stock_quantity || 0) <= 0 ? 1 : 0;
        const bOut = parseFloat(b.stock_quantity || 0) <= 0 ? 1 : 0;
        return aOut - bOut; // stable: preserves original server order within each group
      });
      setProducts(sorted);
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch customers for select options
  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token');
      // Mocked fallback list if API customer endpoint is pending setup
      const response = await fetch(`${API_BASE_URL}/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      } else {
        // Fallback demo data
        setCustomers([
          { id: 1, name: 'Walk-in Customer', phone: '-' },
          { id: 2, name: 'John Doe', phone: '555-0199' },
          { id: 3, name: 'Alice Smith', phone: '555-0144' }
        ]);
      }
    } catch (e) {
      setCustomers([
        { id: 1, name: 'Walk-in Customer', phone: '-' },
        { id: 2, name: 'John Doe', phone: '555-0199' },
        { id: 3, name: 'Alice Smith', phone: '555-0144' }
      ]);
    }
  };

  // 3. Fetch shop settings (for tax rate and loyalty program)
  const fetchShopSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/shops/my-shop`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.tax_rate !== undefined) {
          setTaxRate(parseFloat(data.tax_rate) / 100);
        }
        if (data.loyalty_enabled !== undefined) {
          setLoyaltyEnabled(data.loyalty_enabled === 1 || data.loyalty_enabled === true);
        }
        if (data.loyalty_point_earn_rate !== undefined) {
          setLoyaltyEarnRate(parseFloat(data.loyalty_point_earn_rate));
        }
        if (data.loyalty_point_value !== undefined) {
          setLoyaltyPointValue(parseFloat(data.loyalty_point_value));
        }
      }
    } catch (e) {
      console.error('Failed to fetch shop settings for tax rate and loyalty program', e);
    }
  };

  // 4. Fetch held bills from the backend
  const fetchHeldBills = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/held-bills`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHeldBills(data);
        onHeldBillsChange(data.length);
      }
    } catch (e) {
      console.error('Failed to fetch held bills', e);
    }
  };

  // Fetch initial product list & customer directory
  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    fetchShopSettings();
    fetchHeldBills();
  }, []);

  // Debounced/delayed search triggers on input change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts(search);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // Handle resuming a held bill passed from the parent state (sidebar navigation)
  useEffect(() => {
    if (resumedHeldBill) {
      handleResumeHeldBill(resumedHeldBill);
      onClearResumedHeldBill();
    }
  }, [resumedHeldBill]);

  // Automatically sync paidAmount with final total unless cashier manually edited it
  useEffect(() => {
    if (!activeTab?.isPaidTouched) {
      updateActiveTabState('paidAmount', getFinalTotal().toFixed(3));
    }
  }, [
    activeTab?.cart,
    activeTab?.discountPercent,
    activeTab?.discountAmount,
    activeTab?.redeemPoints,
    loyaltyPointValue,
    taxRate,
    activeTab?.isPaidTouched,
    activeTab?.reduceDueAmount
  ]);

  // Helper to detect mobile screen width or touch capabilities
  const isMobileDevice = () => {
    return window.innerWidth < 1024 || ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  };

  // Auto-focus barcode reader input when active (Desktop / barcode scanner hardware only)
  useEffect(() => {
    if (!autoFocusBarcode) return;

    const keepFocus = () => {
      // Do not auto-focus on mobile devices to prevent soft keyboard from auto-opening
      if (isMobileDevice()) {
        return;
      }

      // If modal is open, do not steal focus
      if (receipt || showHeldBillsModal || showHoldBillModal) {
        return;
      }

      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') &&
        active !== barcodeInputRef.current
      ) {
        return; // Cashier is currently editing another field
      }

      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    };

    keepFocus();

    // Add event listener to capture click events to recover focus or hide keyboard on mobile
    const handleDocumentClick = (e) => {
      if (isMobileDevice()) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
          const isInteractiveTarget = e.target.closest('input, textarea, select, button, label, a');
          if (!isInteractiveTarget) {
            active.blur();
          }
        }
      } else {
        setTimeout(keepFocus, 100);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [autoFocusBarcode, receipt, showHeldBillsModal, showHoldBillModal]);

  // --- HELPER FUNCTIONS ---

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const playBeepSound = (success = true) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (success) {
        // High pitch quick beep
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime); // 1200Hz
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else {
        // Low pitch double beep for warning
        const playBeep = (timeOffset) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(180, audioCtx.currentTime + timeOffset); // 180Hz
          gain.gain.setValueAtTime(0.12, audioCtx.currentTime + timeOffset);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + timeOffset + 0.22);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(audioCtx.currentTime + timeOffset);
          osc.stop(audioCtx.currentTime + timeOffset + 0.22);
        };
        playBeep(0);
        playBeep(0.12);
      }
    } catch (e) {
      console.error('AudioContext beep failed', e);
    }
  };

  const handleBarcodeScan = async (barcode) => {
    if (!barcode || !barcode.trim()) return;
    const trimmedBarcode = barcode.trim();

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products?purchased_only=true&search=${encodeURIComponent(trimmedBarcode)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Barcode lookup failed.');
      const data = await response.json();

      // Find a product with the exact SKU
      const exactMatch = data.find(p => p.sku.toLowerCase() === trimmedBarcode.toLowerCase());

      if (exactMatch) {
        let isExpired = false;
        if (exactMatch.expiry_date) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const exp = new Date(exactMatch.expiry_date);
          exp.setHours(0, 0, 0, 0);
          isExpired = exp.getTime() < today.getTime();
        }

        if (isExpired) {
          playBeepSound(false);
          triggerAlert('error', `Product "${exactMatch.name}" has expired on ${exactMatch.expiry_date}. Cannot be sold.`);
        } else if (exactMatch.stock_quantity <= 0) {
          playBeepSound(false);
          triggerAlert('error', `Product "${exactMatch.name}" is out of stock.`);
        } else {
          addToCart(exactMatch);
          playBeepSound(true);
          triggerAlert('success', `Added to cart: ${exactMatch.name}`);
        }
      } else {
        playBeepSound(false);
        triggerAlert('error', `Product with SKU "${trimmedBarcode}" not found.`);
      }
    } catch (err) {
      playBeepSound(false);
      triggerAlert('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Global Handheld Barcode Scanner Keyboard Wedge Interceptor
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();
    let keyTimes = [];

    const handleGlobalKeydown = (e) => {
      // Don't intercept if receipt or helper modals are open
      if (receipt || showHeldBillsModal || showHoldBillModal) {
        return;
      }

      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
      const isBarcodeField = active === barcodeInputRef.current;

      const currentTime = Date.now();
      const diff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Handle Enter (which signals the end of the scanned barcode)
      if (e.key === 'Enter') {
        const activeBarcode = isBarcodeField ? barcodeInputRef.current.value : buffer;
        const isRapidScan = keyTimes.length > 1 && keyTimes.every(t => t < 45);
        if (activeBarcode.length > 2 && (isBarcodeField || isRapidScan || !isInput)) {
          e.preventDefault();
          e.stopPropagation();

          // If scanned inside another text field rapidly, slice off the first character that slipped in
          if (isInput && !isBarcodeField && isRapidScan && buffer.length > 0) {
            const firstChar = buffer[0];
            const val = active.value;
            if (val.endsWith(firstChar)) {
              active.value = val.substring(0, val.length - 1);
              const event = new Event('input', { bubbles: true });
              active.dispatchEvent(event);
            }
          }

          handleBarcodeScan(activeBarcode);
          buffer = '';
          keyTimes = [];
          setBarcodeInput('');
        } else {
          buffer = '';
          keyTimes = [];
        }
        return;
      }

      // Bypass non-character keys
      if (e.key.length > 1) {
        return;
      }

      // Track typing speed interval
      keyTimes.push(diff);
      if (keyTimes.length > 20) {
        keyTimes.shift();
      }

      const isRapid = diff < 35;
      if (isInput && !isBarcodeField && isRapid) {
        e.preventDefault();
        buffer += e.key;
      } else if (isBarcodeField) {
        // If focused in barcode field itself, let input display natively, but track buffer
        buffer = barcodeInputRef.current.value + e.key;
      } else if (!isInput) {
        e.preventDefault();
        buffer += e.key;
      } else {
        // Human typing slowly inside other inputs
        buffer = '';
        keyTimes = [];
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown, true);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown, true);
    };
  }, [receipt, showHeldBillsModal, showHoldBillModal, barcodeInput, activeTabId, customers]);

  // Global POS Keyboard Hotkeys (F2: Search, F4: Customer, F8: Clear, F9: Pay, F10: Hold, Alt+K: Numpad, Esc: Close)
  useEffect(() => {
    const handlePOSHotkeys = (e) => {
      // Esc key closes active overlay modals
      if (e.key === 'Escape') {
        if (showCashDrawerModal) { setShowCashDrawerModal(false); return; }
        if (showKeyboardModal) { setShowKeyboardModal(false); return; }
        if (showCheckoutPreview) { setShowCheckoutPreview(false); return; }
        if (showHoldBillModal) { setShowHoldBillModal(false); return; }
        if (showHeldBillsModal) { setShowHeldBillsModal(false); return; }
        return;
      }

      // F12 or Alt + D : Toggle Electronic Cash Drawer Controller & Ejection
      if (e.key === 'F12' || ((e.altKey || e.metaKey) && (e.key === 'd' || e.key === 'D'))) {
        e.preventDefault();
        setShowCashDrawerModal(prev => !prev);
        return;
      }

      // Ignore shortcuts if print preview or modals are open
      if (receipt || showHeldBillsModal || showHoldBillModal || showCheckoutPreview || showCashDrawerModal) {
        return;
      }

      // Alt + K : Toggle Onscreen Keyboard Numpad
      if ((e.altKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowKeyboardModal(prev => !prev);
        return;
      }

      // F2 : Focus Product Search Input
      if (e.key === 'F2') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        } else if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
        return;
      }

      // F4 : Focus Select Customer Input
      if (e.key === 'F4') {
        e.preventDefault();
        if (customerInputRef.current) {
          customerInputRef.current.focus();
        }
        return;
      }

      // F8 : Clear Cart
      if (e.key === 'F8') {
        e.preventDefault();
        if (activeTab && activeTab.cart.length > 0) {
          if (window.confirm('Are you sure you want to clear the active cart? (F8)')) {
            updateActiveTabState('cart', []);
            updateActiveTabState('discountPercent', 0);
            updateActiveTabState('discountAmount', 0);
            updateActiveTabState('paidAmount', '');
            updateActiveTabState('isPaidTouched', false);
            triggerAlert('success', 'Cart cleared successfully.');
          }
        }
        return;
      }

      // F9 : Open Checkout Preview / Complete Sale
      if (e.key === 'F9') {
        e.preventDefault();
        if (activeTab && activeTab.cart.length > 0 && !submitting) {
          setPreviewModeType('checkout');
          setShowCheckoutPreview(true);
        }
        return;
      }

      // F10 : Open Hold Bill Modal
      if (e.key === 'F10') {
        e.preventDefault();
        if (activeTab && activeTab.cart.length > 0) {
          setShowHoldBillModal(true);
        }
        return;
      }

      // ARROW KEYS & ENTER CART NAVIGATION (When not editing a text input field)
      const activeElement = document.activeElement;
      const isEditingInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');

      if (activeTab && activeTab.cart.length > 0 && !isEditingInput) {
        const cart = activeTab.cart;
        const currentIndex = cart.findIndex(i => i.id === selectedCartItemId);

        // ArrowDown : Move selection to next item in cart
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = currentIndex < cart.length - 1 ? currentIndex + 1 : 0;
          setSelectedCartItemId(cart[nextIndex].id);
          return;
        }

        // ArrowUp : Move selection to previous item in cart
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : cart.length - 1;
          setSelectedCartItemId(cart[prevIndex].id);
          return;
        }

        // ArrowRight : Increase quantity (+1) of selected cart item
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const targetId = selectedCartItemId || cart[cart.length - 1].id;
          updateQuantity(targetId, 1);
          return;
        }

        // ArrowLeft : Decrease quantity (-1) of selected cart item
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const targetId = selectedCartItemId || cart[cart.length - 1].id;
          updateQuantity(targetId, -1);
          return;
        }

        // Delete : Remove selected cart item
        if (e.key === 'Delete') {
          e.preventDefault();
          const targetId = selectedCartItemId || cart[cart.length - 1].id;
          removeFromCart(targetId);
          return;
        }

        // Enter : Open Checkout preview
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!submitting) {
            setPreviewModeType('checkout');
            setShowCheckoutPreview(true);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handlePOSHotkeys);
    return () => {
      window.removeEventListener('keydown', handlePOSHotkeys);
    };
  }, [activeTab, receipt, showHeldBillsModal, showHoldBillModal, showCheckoutPreview, showKeyboardModal, submitting, selectedCartItemId]);

  // Handler for Virtual Numpad Key Press
  const handleNumpadPress = (key) => {
    if (!activeTab) return;

    const getTargetCartItem = () => {
      if (!activeTab.cart || activeTab.cart.length === 0) return null;
      if (selectedCartItemId) {
        const found = activeTab.cart.find(i => i.id === selectedCartItemId);
        if (found) return found;
      }
      return activeTab.cart[activeTab.cart.length - 1];
    };

    const targetItem = getTargetCartItem();

    if (numpadTarget === 'quantity') {
      if (!targetItem) return;
      let currentVal = String(targetItem.quantity || 0);

      if (key === 'CLEAR') {
        updateQuantity(targetItem.id, -targetItem.quantity);
      } else if (key === 'BACKSPACE') {
        const newVal = currentVal.slice(0, -1);
        handleQuantityInput(targetItem.id, newVal === '' ? '0' : newVal);
      } else if (key === '+1') {
        updateQuantity(targetItem.id, 1);
      } else if (key === '-1') {
        updateQuantity(targetItem.id, -1);
      } else {
        const newVal = currentVal === '0' ? String(key) : currentVal + String(key);
        handleQuantityInput(targetItem.id, newVal);
      }
    } else if (numpadTarget === 'price') {
      if (!targetItem) return;
      let currentVal = String(targetItem.price || 0);

      if (key === 'CLEAR') {
        updatePrice(targetItem.id, '0');
      } else if (key === 'BACKSPACE') {
        const newVal = currentVal.slice(0, -1);
        updatePrice(targetItem.id, newVal === '' ? '0' : newVal);
      } else {
        const newVal = currentVal === '0' ? String(key) : currentVal + String(key);
        updatePrice(targetItem.id, newVal);
      }
    } else if (numpadTarget === 'discountPercent') {
      let currentVal = String(activeTab.discountPercent || 0);
      if (key === 'CLEAR') {
        updateActiveTabState('discountPercent', 0);
      } else if (key === 'BACKSPACE') {
        const newVal = currentVal.slice(0, -1);
        updateActiveTabState('discountPercent', Math.min(100, Math.max(0, parseFloat(newVal) || 0)));
      } else {
        const newVal = currentVal === '0' ? String(key) : currentVal + String(key);
        updateActiveTabState('discountPercent', Math.min(100, Math.max(0, parseFloat(newVal) || 0)));
      }
      updateActiveTabState('discountAmount', 0);
    } else if (numpadTarget === 'discountAmount') {
      let currentVal = String(activeTab.discountAmount || 0);
      if (key === 'CLEAR') {
        updateActiveTabState('discountAmount', 0);
      } else if (key === 'BACKSPACE') {
        const newVal = currentVal.slice(0, -1);
        updateActiveTabState('discountAmount', Math.max(0, parseFloat(newVal) || 0));
      } else {
        const newVal = currentVal === '0' ? String(key) : currentVal + String(key);
        updateActiveTabState('discountAmount', Math.max(0, parseFloat(newVal) || 0));
      }
      updateActiveTabState('discountPercent', 0);
    } else if (numpadTarget === 'paidAmount') {
      let currentVal = String(activeTab.paidAmount || '');
      if (key === 'CLEAR') {
        updateActiveTabState('paidAmount', '');
        updateActiveTabState('isPaidTouched', false);
      } else if (key === 'BACKSPACE') {
        const newVal = currentVal.slice(0, -1);
        updateActiveTabState('paidAmount', newVal);
        updateActiveTabState('isPaidTouched', true);
      } else if (key === 'EXACT') {
        updateActiveTabState('paidAmount', getFinalTotal().toFixed(3));
        updateActiveTabState('isPaidTouched', true);
      } else if (typeof key === 'number' && key >= 10) {
        updateActiveTabState('paidAmount', String(key));
        updateActiveTabState('isPaidTouched', true);
      } else {
        const newVal = currentVal === '' ? String(key) : currentVal + String(key);
        updateActiveTabState('paidAmount', newVal);
        updateActiveTabState('isPaidTouched', true);
      }
    } else if (numpadTarget === 'redeemPoints') {
      let currentVal = String(activeTab.redeemPoints || 0);
      if (key === 'CLEAR') {
        updateActiveTabState('redeemPoints', 0);
      } else if (key === 'BACKSPACE') {
        const newVal = currentVal.slice(0, -1);
        updateActiveTabState('redeemPoints', parseInt(newVal, 10) || 0);
      } else {
        const newVal = currentVal === '0' ? String(key) : currentVal + String(key);
        updateActiveTabState('redeemPoints', parseInt(newVal, 10) || 0);
      }
    }
  };

  const handleBarcodeKeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeScan(barcodeInput);
      setBarcodeInput('');
    }
  };

  const handlePrint = (mode) => {
    // Automatic Electronic Cash Drawer Ejection upon cash receipt printing
    const drawerCfg = getDrawerConfig();
    if (drawerCfg.autoEjectOnCashReceipt && (!receipt || receipt.payment_method === 'cash')) {
      triggerDrawerEjection({
        reason: `Cash Receipt Print (Sale #${receipt?.sale_id || 'POS'})`,
        saleId: receipt?.sale_id,
        amount: receipt?.total,
        method: 'AUTO_EJECT'
      });
    }

    document.body.classList.add(`print-mode-${mode}`);
    window.print();
    setTimeout(() => {
      document.body.classList.remove(`print-mode-${mode}`);
    }, 500);
  };

  const updateActiveTabState = (field, value) => {
    setSaleTabs(prevTabs => {
      const newTabs = [...prevTabs];
      const tabIndex = newTabs.findIndex(t => t.id === activeTabId);
      if (tabIndex > -1) {
        newTabs[tabIndex] = { ...newTabs[tabIndex], [field]: value };
      }
      return newTabs;
    });
  };

  const updateTabState = (tabId, field, value) => {
    setSaleTabs(prevTabs => {
      const newTabs = [...prevTabs];
      const tabIndex = newTabs.findIndex(t => t.id === tabId);
      if (tabIndex > -1) {
        newTabs[tabIndex] = { ...newTabs[tabIndex], [field]: value };
      }
      return newTabs;
    });
  };
  // 3. Cart State Modifications
  const addToCart = (product) => {
    if (!activeTab) {
      triggerAlert('error', 'No active tab selected.');
      return;
    }
    if (product.stock_quantity <= 0) {
      triggerAlert('error', `"${product.name}" is currently out of stock.`);
      return;
    }

    // Check if product is expired
    if (product.expiry_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiryDate = new Date(product.expiry_date);
      if (expiryDate < today) {
        triggerAlert('error', `"${product.name}" has expired on ${product.expiry_date}. Cannot add to cart.`);
        return;
      }
    }

    // Match by product ID — each unique product gets its own cart row
    const existingIndex = activeTab.cart.findIndex(item => item.id === product.id);

    // Individual product's own stock limit
    const stockLimit = parseFloat(product.stock_quantity || 0);

    if (existingIndex > -1) {
      const currentQty = activeTab.cart[existingIndex].quantity;
      if (currentQty >= stockLimit) {
        triggerAlert('error', `Cannot exceed available stock (${stockLimit}) for "${product.name}".`);
        return;
      }
      const updatedCart = [...activeTab.cart];
      updatedCart[existingIndex] = { ...updatedCart[existingIndex], quantity: updatedCart[existingIndex].quantity + 1 };
      updateActiveTabState('cart', updatedCart);
    } else {
      updateActiveTabState('cart', [
        ...activeTab.cart,
        { ...product, quantity: 1, price: product.price, stock_quantity: stockLimit },
      ]);
    }
  };

  const updateQuantity = (productId, change) => {
    if (!activeTab) return;
    const targetItem = activeTab.cart.find(item => item.id === productId);
    if (!targetItem) return;

    const newQty = parseFloat((targetItem.quantity + change).toFixed(3));

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQty > targetItem.stock_quantity) {
      triggerAlert('error', `Cannot exceed available stock limit (${targetItem.stock_quantity}) for "${targetItem.name}".`);
      return;
    }

    updateActiveTabState('cart', activeTab.cart.map(item =>
      item.id === productId ? { ...item, quantity: newQty } : item
    ));
  };

  const handleQuantityInput = (productId, valStr) => {
    if (!activeTab) return;
    const parts = valStr.split('.');
    if (parts[1] && parts[1].length > 3) {
      valStr = parts[0] + '.' + parts[1].substring(0, 3);
    }
    let parsedVal = parseFloat(valStr);
    const targetItem = activeTab.cart.find(item => item.id === productId);
    if (!targetItem) return;

    if (valStr === '') {
      parsedVal = 0;
    } else if (isNaN(parsedVal) || parsedVal < 0) {
      parsedVal = 0;
    }

    if (parsedVal > targetItem.stock_quantity) {
      triggerAlert('error', `Cannot exceed available stock limit (${targetItem.stock_quantity}) for "${targetItem.name}".`);
      parsedVal = targetItem.stock_quantity;
    }

    updateActiveTabState('cart', activeTab.cart.map(item =>
      item.id === productId ? { ...item, quantity: parsedVal } : item
    ));
  };

  const handleQuantityBlur = (productId, quantity) => {
    if (!activeTab) return;
    if (quantity <= 0) {
      removeFromCart(productId);
    }
  };

  const removeFromCart = (productId) => {
    if (!activeTab) return;
    updateActiveTabState('cart', activeTab.cart.filter(item => item.id !== productId));
  };

  const updatePrice = (productId, newPriceVal) => {
    if (!activeTab) return;
    const parts = newPriceVal.split('.');
    if (parts[1] && parts[1].length > 3) {
      newPriceVal = parts[0] + '.' + parts[1].substring(0, 3);
    }
    updateActiveTabState('cart', activeTab.cart.map(item =>
      item.id === productId ? { ...item, price: newPriceVal } : item
    ));
  };

  const updateSubtotal = (productId, newSubtotalVal) => {
    if (!activeTab) return;
    const item = activeTab.cart.find(item => item.id === productId);
    if (!item || item.quantity <= 0) return;

    const parts = newSubtotalVal.split('.');
    if (parts[1] && parts[1].length > 3) {
      newSubtotalVal = parts[0] + '.' + parts[1].substring(0, 3);
    }

    if (newSubtotalVal === '') {
      updateActiveTabState('cart', activeTab.cart.map(cartItem =>
        cartItem.id === productId ? { ...cartItem, price: '' } : cartItem
      ));
      return;
    }

    const parsedSubtotal = parseFloat(newSubtotalVal);
    if (isNaN(parsedSubtotal)) return;

    const newPrice = parseFloat((parsedSubtotal / item.quantity).toFixed(3));
    updateActiveTabState('cart', activeTab.cart.map(cartItem =>
      cartItem.id === productId ? { ...cartItem, price: newPrice } : cartItem
    ));
  };

  // Financial Calculators
  const getSubtotal = () => activeTab?.cart?.reduce((sum, item) => sum + (parseFloat(item.price || 0) * item.quantity), 0) || 0;
  const getTax = () => getSubtotal() * taxRate;
  const getPercentDiscountAmount = () => getSubtotal() * (parseFloat(activeTab?.discountPercent || 0) / 100);
  const getFlatDiscountAmount = () => parseFloat(activeTab?.discountAmount || 0);
  const getDiscountAmount = () => getPercentDiscountAmount() + getFlatDiscountAmount();
  const getPointsDiscount = () => (activeTab?.redeemPoints || 0) * loyaltyPointValue;
  const getFinalTotal = () => {
    const sub = getSubtotal();
    const disc = getDiscountAmount();
    const pointsDisc = getPointsDiscount();
    const taxVal = getTax();
    const total = (sub - disc - pointsDisc) + taxVal + parseFloat(activeTab?.reduceDueAmount || 0);
    return Math.max(0, Math.round(total));
  };

  // --- SUBMIT CHECKOUT ---
  const handleCheckout = async (overridePaidAmount = null) => {
    if (!activeTab) {
      triggerAlert('error', 'No active tab selected.');
      return;
    }
    if (activeTab.cart.length === 0 && parseFloat(activeTab.reduceDueAmount || 0) <= 0) {
      triggerAlert('error', 'Checkout cart is empty.');
      return;
    }

    const emptyPriceItems = activeTab.cart.filter(item => item.price === '' || item.price === undefined || item.price === null || isNaN(parseFloat(item.price)));
    if (emptyPriceItems.length > 0) {
      const names = emptyPriceItems.map(item => `"${item.name}"`).join(', ');
      triggerAlert('error', `Please enter a valid price for: ${names}`);
      return;
    }

    const finalTotal = getFinalTotal();
    // If cashier manually touched the field: empty string means they cleared it → treat as 0.
    // Guard NaN in case of non-numeric input.
    const parsedPaid = overridePaidAmount !== null
      ? overridePaidAmount
      : (() => {
        if (activeTab.paidAmount === '' || activeTab.paidAmount === null || activeTab.paidAmount === undefined) {
          return activeTab.isPaidTouched ? 0 : finalTotal;
        }
        const v = parseFloat(activeTab.paidAmount);
        return isNaN(v) ? 0 : v;
      })();
    const dueAmount = Math.max(0, finalTotal - parsedPaid);

    if (parsedPaid < 0) {
      triggerAlert('error', 'Amount Paid cannot be negative.');
      return;
    }

    if (dueAmount > 0) {
      const hasProfile = activeTab.selectedCustomerId !== '' || (activeTab.customerName.trim() !== '' && activeTab.syncToDirectory);
      if (!hasProfile) {
        triggerAlert('error', 'Customer profile selection is required to record Due ammount balance.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      let finalCustomerId = activeTab.selectedCustomerId ? parseInt(activeTab.selectedCustomerId) : null;

      // 1. Sync Customer Details to Customer Directory if requested
      if (activeTab.syncToDirectory && (activeTab.customerName.trim() !== '' || activeTab.selectedCustomerId !== '')) {
        if (activeTab.selectedCustomerId === '') {
          // Add new customer profile
          if (!activeTab.customerName.trim()) {
            throw new Error('Customer Name is required to save profile to directory.');
          }
          const customerRes = await fetch(`${API_BASE_URL}/customers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              name: activeTab.customerName.trim(),
              phone: activeTab.customerPhone.trim() || null,
              address: activeTab.customerAddress.trim() || null
            })
          });
          const customerData = await customerRes.json();
          if (!customerRes.ok) {
            throw new Error(customerData.error || 'Failed to save new customer profile.');
          }
          finalCustomerId = customerData.id;
        } else {
          // Update existing customer profile
          if (!activeTab.customerName.trim()) {
            throw new Error('Customer Name cannot be empty.');
          }
          const customerRes = await fetch(`${API_BASE_URL}/customers/${activeTab.selectedCustomerId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              name: activeTab.customerName.trim(),
              phone: activeTab.customerPhone.trim() || null,
              address: activeTab.customerAddress.trim() || null
            })
          });
          const customerData = await customerRes.json();
          if (!customerRes.ok) {
            throw new Error(customerData.error || 'Failed to update customer profile.');
          }
        }

        // Refresh customer list in background so select dropdown options stay current
        await fetchCustomers();
      }

      // Resolve FEFO allocations for the API payload
      const payloadItems = [];

      const sortedProductsForApi = [...products].sort((a, b) => {
        if (a.expiry_date && b.expiry_date) {
          return new Date(a.expiry_date) - new Date(b.expiry_date);
        }
        if (a.expiry_date) return -1;
        if (b.expiry_date) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      activeTab.cart.forEach(cartItem => {
        let remainingQty = cartItem.quantity;
        const matchingProducts = sortedProductsForApi.filter(p => (p.name || '').trim().toLowerCase() === (cartItem.name || '').trim().toLowerCase());

        matchingProducts.forEach(p => {
          if (remainingQty <= 0) return;
          const alloc = Math.min(p.stock_quantity, remainingQty);
          if (alloc > 0) {
            payloadItems.push({
              product_id: p.id,
              quantity: alloc,
              unit_price: parseFloat(cartItem.price) || 0
            });
            remainingQty -= alloc;
          }
        });

        // If any remaining qty (e.g. over total stock), dump on original ID to let backend fail correctly
        if (remainingQty > 0) {
          payloadItems.push({
            product_id: cartItem.id,
            quantity: remainingQty,
            unit_price: parseFloat(cartItem.price) || 0
          });
        }
      });

      // Structure POST payload matching backend schema requirements
      const payload = {
        customer_id: finalCustomerId,
        discount: getDiscountAmount(),
        tax: getTax(),
        payment_method: activeTab.paymentMethod,
        paid_amount: parsedPaid,
        reduce_due_amount: parseFloat(activeTab.reduceDueAmount || 0),
        redeem_points: activeTab.redeemPoints || 0,
        created_at: activeTab.saleDate || new Date().toBDISODateString(),
        items: payloadItems
      };

      const response = await fetch(`${API_BASE_URL}/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout transaction failed.');
      }

      // Calculate paid and outstanding due amounts
      const finalTotal = getFinalTotal();
      const paid = overridePaidAmount !== null
        ? overridePaidAmount
        : (() => {
          if (activeTab.paidAmount === '' || activeTab.paidAmount === null || activeTab.paidAmount === undefined) {
            return activeTab.isPaidTouched ? 0 : finalTotal;
          }
          const v = parseFloat(activeTab.paidAmount);
          return isNaN(v) ? 0 : v;
        })();
      const outstandingDue = Math.max(0, finalTotal - paid);

      // Successful Checkout routine
      setReceipt({
        sale_id: data.sale_id,
        items: [...activeTab.cart],
        subtotal: getSubtotal(),
        discount: payload.discount,
        tax: payload.tax,
        total: data.final_amount,
        payment_method: activeTab.paymentMethod,
        created_at: (() => {
          const now = new Date();
          const datePart = activeTab.saleDate || now.toBDISODateString();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          return new Date(`${datePart} ${timeStr}`).toLocaleString();
        })(),
        customer_name: activeTab.customerName.trim() || 'Walk-in Customer',
        customer_phone: activeTab.customerPhone.trim() || '',
        customer_address: activeTab.customerAddress.trim() || '',
        shop_name: currentUser?.shop_name || 'Boutique POS',
        shop_phone: currentUser?.shop_phone || '',
        shop_address: currentUser?.shop_address || '',
        shop_email: currentUser?.email || '',
        staff_name: currentUser?.name || 'Cashier',
        reduce_due_amount: parseFloat(activeTab.reduceDueAmount || 0),
        paid_amount: paid,
        change_amount: Math.max(0, paid - finalTotal),
        due_amount: outstandingDue > 0 ? outstandingDue : 0,
        loyalty_enabled: loyaltyEnabled,
        points_earned: data.points_earned || 0,
        points_redeemed: activeTab.redeemPoints || 0,
        points_redeemed_value: (activeTab.redeemPoints || 0) * loyaltyPointValue
      });

      // Automatic Electronic Cash Drawer Ejection for cash transactions
      if (activeTab.paymentMethod === 'cash') {
        const drawerCfg = getDrawerConfig();
        if (drawerCfg.autoEjectOnCashReceipt) {
          triggerDrawerEjection({
            reason: `Cash Sale Checkout #${data.sale_id} (${currentUser?.name || 'Cashier'})`,
            saleId: data.sale_id,
            amount: data.final_amount,
            method: 'AUTO_EJECT'
          });
        }
      }

      // Show warnings if inventory items hit low stock limit
      if (data.stock_alerts && data.stock_alerts.length > 0) {
        const warningNames = data.stock_alerts.map(a => a.name).join(', ');
        triggerAlert('success', `Transaction success! Note low stock threshold warnings on: ${warningNames}`);
      } else {
        triggerAlert('success', 'Checkout transaction completed successfully!');
      }

      // Mark the completed tab as hidden and reset its state
      setSaleTabs(prev => {
        const newTabs = [...prev];
        // Keep the same name but reset all other state and mark as hidden
        newTabs[activeTabIndex] = {
          ...createNewSaleTab(activeTabIndex + 1),
          name: prev[activeTabIndex].name,
          hidden: true
        };
        // Switch to the first non-hidden tab
        const nextActiveTab = newTabs.find((tab, index) => index !== activeTabIndex && !tab.hidden);
        if (nextActiveTab) {
          setActiveTabId(nextActiveTab.id);
        } else if (newTabs.length > 1) {
          // If all other tabs are hidden, create a new active tab
          const newTab = createNewSaleTab(newTabs.length + 1);
          newTabs.push(newTab);
          setActiveTabId(newTab.id);
        }
        return newTabs;
      });
      setMobileCartOpen(false);

      // Refresh local product stock list
      fetchProducts(search);

    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- DUE CHECKOUT (save sale with full amount as due, paid_amount = 0) ---
  const handleDueCheckout = () => {
    if (!activeTab) {
      triggerAlert('error', 'No active tab selected.');
      return;
    }
    if (activeTab.cart.length === 0) {
      triggerAlert('error', 'Cart is empty. Nothing to save as due.');
      return;
    }

    const hasCustomer = activeTab.selectedCustomerId !== '' ||
      (activeTab.customerName.trim() !== '' && activeTab.syncToDirectory);
    if (!hasCustomer) {
      triggerAlert('error', 'A customer profile is required to save a due sale. Please select or enter a customer.');
      return;
    }

    // Pass 0 as override — full final amount becomes due_amount on the sale record.
    // handleCheckout accepts overridePaidAmount so no state mutation is needed.
    handleCheckout(0);
  };

  // --- DELETE TRANSACTION (SHOP ADMIN ONLY) ---
  const handleDeleteSale = async (saleId) => {
    if (!saleId) return;
    if (!window.confirm(`Are you sure you want to delete Sale #${saleId}?\n\nThis will:\n• Restore all product stock quantities\n• Reverse any customer due balance\n• Remove this transaction from all reports\n\nThis action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/sales/${saleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete sale.');

      triggerAlert('success', data.message);
      setReceipt(null);

      // Refresh product stock list & customer list
      fetchProducts(search);
      fetchCustomers();
      fetchHeldBills();
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setDeleting(false);
    }
  };

  // --- HOLD BILL HANDLERS ---

  const handleHoldBillSubmit = async (e) => {
    e.preventDefault();
    if (!activeTab) {
      triggerAlert('error', 'No active tab selected.');
      return;
    }
    if (activeTab.cart.length === 0) {
      triggerAlert('error', 'Cart is empty. Nothing to hold.');
      return;
    }

    const emptyPriceItems = activeTab.cart.filter(item => item.price === '' || item.price === undefined || item.price === null || isNaN(parseFloat(item.price)));
    if (emptyPriceItems.length > 0) {
      const names = emptyPriceItems.map(item => `"${item.name}"`).join(', ');
      triggerAlert('error', `Please enter a valid price for: ${names}`);
      return;
    }

    setHoldingBill(true);
    try {
      const token = localStorage.getItem('token');
      let finalCustomerId = activeTab.selectedCustomerId ? parseInt(activeTab.selectedCustomerId) : null;

      const payloadItems = activeTab.cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        product_name: item.name,
        price: parseFloat(item.price) || 0
      }));

      const payload = {
        customer_id: finalCustomerId,
        customer_name: activeTab.customerName.trim() || null,
        customer_phone: activeTab.customerPhone.trim() || null,
        customer_address: activeTab.customerAddress.trim() || null,
        discount_percent: activeTab.discountPercent,
        discount_amount: activeTab.discountAmount,
        notes: holdNotes.trim(),
        items: payloadItems
      };

      const response = await fetch(`${API_BASE_URL}/held-bills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to hold bill.');

      triggerAlert('success', 'Bill held successfully!');

      // Mark the current tab as hidden and reset its state
      setSaleTabs(prev => {
        const newTabs = [...prev];
        // Keep the same name but reset all other state and mark as hidden
        newTabs[activeTabIndex] = {
          ...createNewSaleTab(activeTabIndex + 1),
          name: prev[activeTabIndex].name,
          hidden: true
        };
        // Switch to the first non-hidden tab
        const nextActiveTab = newTabs.find((tab, index) => index !== activeTabIndex && !tab.hidden);
        if (nextActiveTab) {
          setActiveTabId(nextActiveTab.id);
        } else if (newTabs.length > 1) {
          // If all other tabs are hidden, create a new active tab
          const newTab = createNewSaleTab(newTabs.length + 1);
          newTabs.push(newTab);
          setActiveTabId(newTab.id);
        }
        return newTabs;
      });
      setHoldNotes('');
      setShowHoldBillModal(false);

      // Refresh list
      fetchHeldBills();
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setHoldingBill(false);
    }
  };

  const handleResumeHeldBill = async (heldBill) => {
    if (!activeTab) {
      triggerAlert('error', 'No active tab selected.');
      return;
    }
    if (activeTab.cart.length > 0) {
      if (!window.confirm('Resuming will overwrite your current active cart. Proceed?')) {
        return;
      }
    }

    try {
      let heldItems = [];
      if (typeof heldBill.items === 'string') {
        heldItems = JSON.parse(heldBill.items);
      } else {
        heldItems = heldBill.items;
      }

      const reconstructedCart = [];
      const missingProducts = [];
      const stockCappedProducts = [];

      for (const item of heldItems) {
        let productObj = products.find(p => p.id === item.product_id);

        if (!productObj) {
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/products/${item.product_id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              productObj = await res.json();
            }
          } catch (e) {
            console.error(`Failed to fetch details for product ID ${item.product_id}`, e);
          }
        }

        if (!productObj) {
          missingProducts.push(item.product_id);
          continue;
        }

        let finalQty = item.quantity;
        if (productObj.stock_quantity <= 0) {
          stockCappedProducts.push(`${productObj.name} (out of stock)`);
          continue;
        } else if (finalQty > productObj.stock_quantity) {
          finalQty = productObj.stock_quantity;
          stockCappedProducts.push(`${productObj.name} (capped to ${finalQty})`);
        }

        reconstructedCart.push({
          ...productObj,
          price: item.price !== undefined ? item.price : productObj.price,
          quantity: finalQty
        });
      }

      if (missingProducts.length > 0) {
        triggerAlert('error', `Some products in this held bill were deleted or are unavailable.`);
      }

      if (stockCappedProducts.length > 0) {
        triggerAlert('success', `Cart loaded! Note: stock limits adjusted for: ${stockCappedProducts.join(', ')}`);
      } else {
        triggerAlert('success', 'Held cart successfully resumed!');
      }

      updateActiveTabState('cart', reconstructedCart);
      updateActiveTabState('discountPercent', parseFloat(heldBill.discount_percent || 0));
      updateActiveTabState('discountAmount', parseFloat(heldBill.discount_amount || 0));
      updateActiveTabState('reduceDueAmount', parseFloat(heldBill.due_amount || 0));
      updateActiveTabState('selectedCustomerId', heldBill.customer_id || '');
      updateActiveTabState('customerName', heldBill.customer_name || '');
      updateActiveTabState('customerPhone', heldBill.customer_phone || '');
      updateActiveTabState('customerAddress', heldBill.customer_address || '');
      updateActiveTabState('isPaidTouched', false);
      updateActiveTabState('paidAmount', '');

      setShowHeldBillsModal(false);
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/held-bills/${heldBill.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      fetchHeldBills();
    } catch (err) {
      triggerAlert('error', `Failed to resume held bill: ${err.message}`);
    }
  };

  const handleDeleteHeldBill = async (heldBillId) => {
    if (!window.confirm('Are you sure you want to discard this held bill?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/held-bills/${heldBillId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete held bill.');

      triggerAlert('success', 'Held bill discarded successfully.');
      fetchHeldBills();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const exportHeldBillsToCSV = () => {
    const heldOnly = heldBills.filter(b => b.status === 'held');
    if (heldOnly.length === 0) {
      triggerAlert('error', 'No held bills to export.');
      return;
    }

    const headers = ['Held Bill ID', 'Date Held', 'Reference Note', 'Customer', 'Cashier', 'Items', 'Due Amount'];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (/[",\n\r]/.test(str)) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = heldOnly.map(bill => {
      let itemsList = [];
      try {
        itemsList = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
      } catch (e) { /* ignore */ }
      const itemsString = itemsList.map(item => `${item.product_name || 'Item'} (x${item.quantity})`).join('; ');

      return [
        bill.id,
        `"${new Date(bill.created_at).toLocaleString()}"`,
        escapeCSV(bill.notes || ''),
        escapeCSV(bill.customer_name || 'Walk-in'),
        escapeCSV(bill.staff_name || 'N/A'),
        escapeCSV(itemsString),
        parseFloat(bill.due_amount || 0).toFixed(3)
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `held_bills_${new Date().toBDISODateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerAlert('success', 'Held bills exported successfully!');
  };

  const addSaleTab = () => {
    const newTab = createNewSaleTab(saleTabs.length + 1);
    setSaleTabs([...saleTabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeSaleTab = (tabIdToClose) => {
    if (saleTabs.length <= 1) {
      triggerAlert('error', 'Cannot close the last sale tab.');
      return;
    }
    const tabIndexToClose = saleTabs.findIndex(t => t.id === tabIdToClose);
    if (tabIndexToClose === -1) return;

    const newTabs = saleTabs.filter(t => t.id !== tabIdToClose);
    setSaleTabs(newTabs);

    if (activeTabId === tabIdToClose) {
      // Switch to the previous tab, or the first tab if closing the first one
      const newIndex = Math.max(0, tabIndexToClose - 1);
      setActiveTabId(newTabs[newIndex]?.id || newTabs[0].id);
    }
  };

  return (
    <div className="relative h-full flex flex-col">

      {/* 1. Alerts Banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center space-x-3 transition-all ${alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}>
          <span className="text-sm font-semibold">{alert.message}</span>
        </div>
      )}

      {/* 2. Page Title Header */}
      <div className="flex flex-row justify-between items-center gap-2 mb-2">
        <h2 className="text-lg font-bold text-slate-800">POS Checkout</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/manual-orders')}
            className="relative bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-1.5 px-3 border border-indigo-200 rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <span>Sales Orders</span>
          </button>
          <button
            type="button"
            onClick={() => setShowHeldBillsModal(true)}
            className="relative bg-white hover:bg-slate-50 text-slate-700 font-semibold py-1.5 px-3 border border-slate-200 rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <span>Due Bills</span>
            {heldBills.filter(b => b.status === 'held').length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border border-white animate-pulse">
                {heldBills.filter(b => b.status === 'held').length}
              </span>
            )}
          </button>

          {/* Electronic Cash Drawer Button */}
          <button
            type="button"
            onClick={() => setShowCashDrawerModal(true)}
            className="relative bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold py-1.5 px-3 border border-amber-300 rounded-xl text-xs shadow-xs transition-all flex items-center space-x-1.5"
            title="Electronic Cash Drawer (F12 / Alt+D)"
          >
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            <span>Cash Drawer (F12)</span>
          </button>

          {/* Mobile-only View Cart Button (Marked Header Area) */}
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="lg:hidden relative bg-slate-900 hover:bg-slate-800 text-white font-semibold py-1.5 px-3 rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <span>View Cart</span>
            {(activeTab?.cart?.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0) || 0) > 0 && (
              <span className="bg-indigo-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ml-0.5">
                {activeTab?.cart?.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. Tabs Bar */}
      <div className="mb-2 border-b border-slate-200 flex items-center space-x-1">
        {saleTabs.filter(tab => !tab.hidden).map(tab => (
          <div
            key={tab.id}
            className={`flex items-center space-x-2 py-1.5 px-3 border-b-2 cursor-pointer transition-all duration-200 text-xs ${activeTabId === tab.id
              ? 'border-indigo-600 text-indigo-600 font-semibold bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:bg-slate-100'
              }`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span>{tab.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeSaleTab(tab.id); }}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full p-0.5"
              disabled={saleTabs.length <= 1}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
        <button
          onClick={addSaleTab}
          className="ml-2 text-slate-500 hover:bg-slate-200 rounded-full p-1.5 transition-colors"
          title="Add New Sale Tab"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>
      {/* 3. Split Screen Flex Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden min-h-0">

        {/* Left Side: Product Grid (2 columns on Desktop) */}
        <div className="lg:col-span-5 flex flex-col overflow-hidden">
          {/* Search & Barcode Scan Console */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {/* Search Input */}
            <div className="sm:col-span-2 relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by product name, category, or SKU... (F2)"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchFocusedIndex(-1); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const newIndex = searchFocusedIndex < products.length - 1 ? searchFocusedIndex + 1 : searchFocusedIndex;
                    setSearchFocusedIndex(newIndex);
                    // Scroll to keep the focused item visible
                    setTimeout(() => {
                      const focusedRow = productTableBodyRef.current?.children[newIndex];
                      if (focusedRow) {
                        focusedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
                    }, 0);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const newIndex = searchFocusedIndex > 0 ? searchFocusedIndex - 1 : searchFocusedIndex;
                    setSearchFocusedIndex(newIndex);
                    // Scroll to keep the focused item visible
                    setTimeout(() => {
                      const focusedRow = productTableBodyRef.current?.children[newIndex];
                      if (focusedRow) {
                        focusedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
                    }, 0);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchFocusedIndex >= 0 && products[searchFocusedIndex]) {
                      const product = products[searchFocusedIndex];
                      const inCartItem = activeTab?.cart?.find(item => item.id === product.id);
                      const remainingQty = product.stock_quantity - (inCartItem ? inCartItem.quantity : 0);
                      if (remainingQty > 0) {
                        addToCart(product);
                      }
                    }
                  }
                }}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
              />
              <svg className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Barcode Scanner Console */}
            <div className="relative flex items-center bg-slate-900 border border-slate-800 text-white rounded-xl shadow-sm px-3.5 py-3 overflow-hidden group">
              {autoFocusBarcode && !receipt && !showHeldBillsModal && !showHoldBillModal && (
                <div className="laser-line animate-laser-scan"></div>
              )}

              <div className="flex items-center space-x-2.5 w-full z-10">
                {/* Barcode Icon */}
                <div className="relative flex-shrink-0 text-rose-500 group-hover:text-rose-400 animate-pulse">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5v14M7 5v14M11 5v14M14 5v14M17 5v14M21 5v14" />
                  </svg>
                </div>

                {/* Scanner Input */}
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan barcode / SKU..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeydown}
                  className="bg-transparent text-white placeholder-slate-500 border-none outline-none focus:ring-0 w-full text-xs font-semibold p-0"
                />

                {/* Auto-focus Status Indicator / Toggle */}
                <button
                  type="button"
                  onClick={() => setAutoFocusBarcode(!autoFocusBarcode)}
                  className={`flex-shrink-0 text-[9px] font-extrabold px-2 py-1 rounded transition-all tracking-wider ${autoFocusBarcode
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  title={autoFocusBarcode ? "Click to switch to manual mode" : "Click to switch to auto-focus scanner mode"}
                >
                  {autoFocusBarcode ? "AUTO" : "MANUAL"}
                </button>
              </div>
            </div>
          </div>

          {/* Product Items Scrolling Container */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-xl p-12 text-center text-slate-400">
                No items found. Create items in inventory to begin.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <div className="overflow-x-auto flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50/50">
                      <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-3 pl-4 w-1/2">Product Name</th>
                        <th className="p-3 text-right w-24">Price</th>
                        <th className="p-3 text-center w-28">Expiry</th>
                        <th className="p-3 text-center w-28">Stock</th>
                      </tr>
                    </thead>
                    <tbody ref={productTableBodyRef} className="divide-y divide-slate-100 text-sm">
                      {(() => {
                        const filteredProducts = products.filter(p => {
                          if (p.expiry_date) {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const exp = new Date(p.expiry_date);
                            exp.setHours(0, 0, 0, 0);
                            if (exp.getTime() < today.getTime()) return false;
                          }
                          return true;
                        });

                        const sortedProducts = [...filteredProducts].sort((a, b) => {
                          const aOut = parseFloat(a.stock_quantity || 0) <= 0 ? 1 : 0;
                          const bOut = parseFloat(b.stock_quantity || 0) <= 0 ? 1 : 0;
                          // First: in-stock items come before out-of-stock
                          if (aOut !== bOut) return aOut - bOut;
                          // Then: within same stock group, sort by expiry date (FEFO)
                          if (a.expiry_date && b.expiry_date) {
                            return new Date(a.expiry_date) - new Date(b.expiry_date);
                          }
                          if (a.expiry_date) return -1;
                          if (b.expiry_date) return 1;
                          return (a.name || '').localeCompare(b.name || '');
                        });

                        // Pre-calculate cart allocations for FEFO display
                        const cartAllocations = {};
                        activeTab?.cart?.forEach(item => {
                          cartAllocations[(item.name || '').trim().toLowerCase()] = item.quantity;
                        });

                        const rowAllocations = {};
                        sortedProducts.forEach(product => {
                          const nameKey = (product.name || '').trim().toLowerCase();
                          let qtyForRow = 0;
                          if (cartAllocations[nameKey] > 0) {
                            qtyForRow = Math.min(product.stock_quantity, cartAllocations[nameKey]);
                            cartAllocations[nameKey] -= qtyForRow;
                          }
                          rowAllocations[product.id] = parseFloat(qtyForRow.toFixed(3));
                        });

                        return sortedProducts.map((product, index) => {
                          const inCartItem = activeTab?.cart?.find(item => (item.name || '').trim().toLowerCase() === (product.name || '').trim().toLowerCase());
                          const qtyForRow = rowAllocations[product.id] || 0;
                          const remainingQty = product.stock_quantity;
                          const isOutOfStock = remainingQty <= 0;

                          // Expiry status calculation
                          let isExpired = false;
                          let expiryBadge = null;
                          if (product.expiry_date) {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const expiry = new Date(product.expiry_date);
                            expiry.setHours(0, 0, 0, 0);
                            isExpired = expiry.getTime() < today.getTime();
                            const diffTime = expiry.getTime() - today.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            if (isExpired) {
                              expiryBadge = (
                                <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-extrabold inline-flex items-center shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1 animate-pulse"></span>
                                  Expired ({expiry.toLocaleDateString()})
                                </span>
                              );
                            } else if (diffDays <= 30) {
                              expiryBadge = (
                                <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center">
                                  Expiring ({expiry.toLocaleDateString()})
                                </span>
                              );
                            } else {
                              expiryBadge = (
                                <span className="text-slate-600 text-xs font-medium">
                                  {expiry.toLocaleDateString()}
                                </span>
                              );
                            }
                          } else {
                            expiryBadge = <span className="text-slate-400 text-xs">N/A</span>;
                          }

                          const isDisabled = isOutOfStock || isExpired;

                          return (
                            <tr key={product.id} className={`hover:bg-slate-50/50 transition-colors ${searchFocusedIndex === index ? 'bg-indigo-100 ring-2 ring-indigo-500 ring-inset' : ''} ${isExpired ? 'bg-rose-50/60' : ''}`}>
                              <td
                                className={`p-3 pl-4 font-semibold transition-colors ${isDisabled ? 'text-slate-400 cursor-not-allowed' : 'text-slate-800 cursor-pointer hover:text-indigo-600'}`}
                                onClick={() => !isDisabled && addToCart(product)}
                                title={isExpired ? `Expired on ${product.expiry_date}` : (isOutOfStock ? 'Out of stock' : 'Click to add to cart')}
                              >
                                <div>
                                  {product.name}
                                  {isExpired && <span className="ml-2 text-xs text-rose-600 font-bold">(Expired)</span>}
                                </div>
                                <div className="text-xs text-slate-500 font-normal mt-0.5">
                                  {product.category && (
                                    <span className="text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded mr-2">
                                      {product.category}
                                    </span>
                                  )}
                                  {product.supplier_name && (
                                    <span>
                                      {product.supplier_name}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right font-extrabold text-slate-700">৳{parseFloat(product.price).toFixed(3)}</td>
                              <td className="p-3 text-center">{expiryBadge}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${isExpired
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : remainingQty <= product.low_stock_threshold
                                    ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                  }`}>
                                  {isExpired ? 'Expired' : `${remainingQty} ${product.unit || 'pcs'} left`}
                                </span>
                              </td>

                            </tr>
                          );
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side / Cart Side Panel (Always visible on Desktop) */}
        <div className={`hidden lg:flex lg:col-span-7 bg-white border border-slate-200 rounded-2xl flex-col overflow-hidden shadow-sm`}>
          {renderCartPanelContent()}
        </div>

      </div>

      {/* Mobile Cart Backdrop Drawer */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden">
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Active Checkout Cart</h3>
              <button
                onClick={() => setMobileCartOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 pb-16">
              {renderCartPanelContent()}
            </div>
          </div>
        </div>
      )}

      {/* --- CHECKOUT PREVIEW MODAL --- */}
      {showCheckoutPreview && activeTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gray-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/*  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg> */}
                <h2 className="text-lg font-bold text-white">Checkout Preview</h2>
              </div>
              <button
                onClick={() => setShowCheckoutPreview(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Customer Info */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <h3 className="text-sm font-bold text-slate-700 mb-2">Customer Information</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name:</span>
                    <span className="font-semibold text-slate-800">{activeTab.customerName || 'Walk-in Customer'}</span>
                  </div>
                  {activeTab.customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone:</span>
                      <span className="font-semibold text-slate-800">{activeTab.customerPhone}</span>
                    </div>
                  )}
                  {activeTab.customerAddress && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Address:</span>
                      <span className="font-semibold text-slate-800">{activeTab.customerAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cart Items */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <h3 className="text-sm font-bold text-slate-700 mb-2">Cart Items ({activeTab.cart.length})</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activeTab.cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-200 pb-2 last:border-0">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500">Qty: {item.quantity} × ৳{parseFloat(item.price).toFixed(3)}</div>
                      </div>
                      <div className="font-bold text-slate-800">
                        ৳{(parseFloat(item.price) * item.quantity).toFixed(3)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-indigo-50 rounded-xl p-4">
                <h3 className="text-sm font-bold text-indigo-700 mb-2">Payment Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-semibold text-slate-800">৳{getSubtotal().toFixed(3)}</span>
                  </div>
                  {getDiscountAmount() > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount:</span>
                      <span className="font-semibold">-৳{getDiscountAmount().toFixed(3)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax:</span>
                    <span className="font-semibold text-slate-800">৳{getTax().toFixed(3)}</span>
                  </div>
                  {getPointsDiscount() > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Points Discount:</span>
                      <span className="font-semibold">-৳{getPointsDiscount().toFixed(3)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg text-indigo-700 border-t border-indigo-200 pt-2 mt-2">
                    <span>Total:</span>
                    <span>৳{getFinalTotal().toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Payment Method:</span>
                    <span className="font-semibold text-slate-800 uppercase">{activeTab.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Amount Paid:</span>
                    <span className="font-semibold text-slate-800">৳{activeTab.paidAmount || getFinalTotal().toFixed(3)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex space-x-3">
              <button
                onClick={() => setShowCheckoutPreview(false)}
                className="flex-1 bg-white hover:bg-slate-100 text-slate-700 font-bold py-3 px-4 rounded-xl transition-colors border border-slate-300"
              >
                Back to Cart
              </button>
              <button
                onClick={() => {
                  setShowCheckoutPreview(false);
                  if (previewModeType === 'due') {
                    handleDueCheckout();
                  } else {
                    handleCheckout();
                  }
                }}
                disabled={submitting}
                className="flex-1 bg-slate-500 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className='bg-gray-600 text-white px-2 py-1 rounded'>{previewModeType === 'due' ? 'Save as Due' : 'Complete Checkout'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RECEIPT PREVIEW & PRINT MODAL --- */}
      {receipt && activeTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

            {/* Left Side: Receipt Live Preview Canvas */}
            <div className="flex-1 bg-slate-100 p-6 flex flex-col items-center justify-center overflow-y-auto min-h-0">
              <div className="w-full flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Receipt Preview</span>
                <span className="text-[10px] bg-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded-full uppercase">
                  {previewMode === 'thermal' ? 'Thermal 80mm Roll' : 'Regular A4 Sheet'}
                </span>
              </div>

              <div className="w-full py-4 flex justify-center items-start min-h-0 overflow-y-auto">
                {previewMode === 'thermal' ? (
                  /* Thermal Receipt Mockup */
                  <div className="w-[320px] bg-white text-black shadow-lg pt-0 mt-0 px-6 pb-6 font-mono text-[12px] font-black leading-relaxed border-t-0 border-indigo-600 rounded-b-md">
                    <div className="text-center mb-4 mt-0 text-black">
                      <h2 className="text-base font-black tracking-tight uppercase text-black">{receipt.shop_name}</h2>
                      {receipt.shop_address && <p className="text-[11px] font-black text-black mt-0.5">{receipt.shop_address}</p>}
                      {receipt.shop_phone && <p className="text-[11px] font-black text-black">Tel: {receipt.shop_phone}</p>}
                      {receipt.shop_email && <p className="text-[11px] font-black text-black">Email: {receipt.shop_email}</p>}
                      <p className="text-[10px] font-black text-black mt-2 font-sans tracking-widest">*** TRANSACTION RECEIPT ***</p>
                    </div>

                    <div className="border-b-2 border-dashed border-black py-2 my-2 text-[11px] space-y-0.5 text-black font-black">
                      <div><span className="font-black text-black">Sale ID:</span> #{receipt.sale_id}</div>
                      <div><span className="font-black text-black">Date:</span> {receipt.created_at}</div>
                      <div><span className="font-black text-black">Cashier:</span> {receipt.staff_name}</div>
                      <div><span className="font-black text-black">Customer:</span> {receipt.customer_name}</div>
                      {receipt.customer_phone && <div><span className="font-black text-black">Phone:</span> {receipt.customer_phone}</div>}
                    </div>

                    <table className="w-full text-left text-[11px] font-black border-collapse text-black">
                      <thead>
                        <tr className="border-b-2 border-dashed border-black font-black text-black">
                          <th className="pb-1 text-left text-black">Item</th>
                          <th className="pb-1 text-center w-8 text-black">Qty</th>
                          <th className="pb-1 text-center w-8 text-black">Unit</th>
                          <th className="pb-1 text-right w-16 text-black">Price</th>
                          <th className="pb-1 text-right w-20 text-black">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receipt.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-dashed border-slate-400">
                            <td className="py-2 pr-1 text-black font-black break-words max-w-[100px]">
                              <div>{item.name || item.product_name}</div>
                            </td>
                            <td className="py-2 text-center text-black font-black">{item.quantity}</td>
                            <td className="py-2 text-center text-black font-extrabold">{item.unit || 'pcs'}</td>
                            <td className="py-2 text-right text-black font-black">৳{parseFloat(item.price || item.unit_price).toFixed(3)}</td>
                            <td className="py-2 text-right font-black text-black">
                              ৳{((item.price || item.unit_price) * item.quantity).toFixed(3)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="border-t-2 border-dashed border-black pt-2.5 mt-2.5 text-[11px] font-black space-y-1.5 text-black">
                      <div className="flex justify-between text-black">
                        <span>Subtotal:</span>
                        <span className="font-black text-black">৳{parseFloat(receipt.subtotal).toFixed(3)}</span>
                      </div>
                      {parseFloat(receipt.discount || 0) > 0 && (
                        <div className="flex justify-between text-rose-700 font-black">
                          <span>Discount:</span>
                          <span>-৳{parseFloat(receipt.discount).toFixed(3)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-black">
                        <span>Tax:</span>
                        <span className="font-black text-black">৳{parseFloat(receipt.tax).toFixed(3)}</span>
                      </div>
                      {receipt.loyalty_enabled && (
                        <>
                          {receipt.points_earned > 0 && (
                            <div className="flex justify-between text-indigo-900 font-black">
                              <span>Points Earned:</span>
                              <span>+{receipt.points_earned} pts</span>
                            </div>
                          )}
                          {receipt.points_redeemed > 0 && (
                            <div className="flex justify-between text-rose-800 font-black">
                              <span>Points Redeemed:</span>
                              <span>-{receipt.points_redeemed} pts</span>
                            </div>
                          )}
                          {receipt.points_redeemed_value > 0 && (
                            <div className="flex justify-between text-rose-800 font-black text-[11px]">
                              <span>Points Discount:</span>
                              <span>-৳{receipt.points_redeemed_value.toFixed(3)}</span>
                            </div>
                          )}
                        </>
                      )}
                      {parseFloat(receipt.reduce_due_amount || 0) > 0 && (
                        <div className="flex justify-between text-indigo-900 font-black">
                          <span>Due Paid:</span>
                          <span>৳{parseFloat(receipt.reduce_due_amount).toFixed(3)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-black border-t-2 border-dashed border-black pt-1.5 text-[13px]">
                        <span>Total Bill:</span>
                        <span>৳{parseFloat(receipt.total).toFixed(3)}</span>
                      </div>
                      {receipt.change_amount > 0 && (
                        <>
                          <div className="flex justify-between font-black text-black pt-1 text-[11px]">
                            <span>Given Amount:</span>
                            <span>৳{parseFloat(receipt.paid_amount).toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between font-black text-emerald-800 border-t border-dashed border-black pt-1 text-[12px]">
                            <span>Change Return:</span>
                            <span>৳{parseFloat(receipt.change_amount).toFixed(3)}</span>
                          </div>
                        </>
                      )}
                      {parseFloat(receipt.due_amount || 0) > 0 && (
                        <div className="flex justify-between font-black text-rose-800 border-t border-dashed border-black pt-1 text-[12px]">
                          <span>Due ammount:</span>
                          <span>৳{parseFloat(receipt.due_amount).toFixed(3)}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-center mt-6 pt-3 border-t-2 border-dashed border-black relative text-black">
                      <p className="text-[11px] text-black uppercase font-black">Payment: {receipt.payment_method.replace('_', ' ')}</p>
                      <p className="text-[11px] font-black text-black tracking-wider mt-2">*** THANK YOU ***</p>
                      <p className="text-[10px] font-black text-black mt-4 text-right">Bring this receipt, if you return product</p>
                    </div>
                  </div>
                ) : (
                  /* Regular A4 Sheet Mockup */
                  <div className="w-full max-w-[620px] bg-white text-slate-800 shadow-lg p-8 font-sans text-[11px] leading-relaxed border-t-8 border-indigo-600 rounded-b-md">
                    <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
                      <div>
                        <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">{receipt.shop_name}</h1>
                        {receipt.shop_address && <p className="text-slate-500 mt-1 text-[10px]">{receipt.shop_address}</p>}
                        <div className="text-slate-400 mt-0.5 text-[9px] space-x-2">
                          {receipt.shop_phone && <span>Tel: {receipt.shop_phone}</span>}
                          {receipt.shop_email && <span>Email: {receipt.shop_email}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <h2 className="text-sm font-black text-indigo-600 tracking-widest uppercase">INVOICE</h2>
                        <p className="text-slate-500 mt-1 text-[10px]">Invoice ID: <span className="font-semibold text-slate-800">#{receipt.sale_id}</span></p>
                        <p className="text-slate-400 text-[9px]">{receipt.created_at}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg mb-4 text-[10px]">
                      <div>
                        <h3 className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1">Billed To</h3>
                        <div className="font-bold text-slate-800">{receipt.customer_name}</div>
                        {receipt.customer_phone && <p className="text-slate-600 mt-0.5">Phone: {receipt.customer_phone}</p>}
                        {receipt.customer_address && <p className="text-slate-600">Address: {receipt.customer_address}</p>}
                      </div>
                      <div>
                        <h3 className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1">Billed By</h3>
                        <div className="font-bold text-slate-800">{receipt.shop_name}</div>
                        <p className="text-slate-600 mt-0.5">Cashier: {receipt.staff_name}</p>
                        <p className="text-slate-600">Payment: <span className="uppercase text-[9px] font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">{receipt.payment_method.replace('_', ' ')}</span></p>
                      </div>
                    </div>

                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b-2 border-slate-200 text-[9px] uppercase font-bold text-slate-500">
                          <th className="pb-2 text-left">Item Description</th>
                          <th className="pb-2 text-center w-16">SKU</th>
                          <th className="pb-2 text-center w-12">Qty</th>
                          <th className="pb-2 text-right w-20">Unit Price</th>
                          <th className="pb-2 text-right w-20">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receipt.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 font-semibold text-slate-800">{item.name || item.product_name}</td>
                            <td className="py-2.5 text-center text-slate-400 text-[9px] font-mono">{item.sku || item.product_sku || 'N/A'}</td>
                            <td className="py-2.5 text-center text-slate-600 font-medium">{item.quantity}</td>
                            <td className="py-2.5 text-right text-slate-600">৳{parseFloat(item.price || item.unit_price).toFixed(3)}</td>
                            <td className="py-2.5 text-right font-bold text-slate-900">
                              ৳{((item.price || item.unit_price) * item.quantity).toFixed(3)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex justify-end mt-4 border-t border-slate-100 pt-3">
                      <div className="w-56 space-y-1.5 text-slate-600 text-[10px]">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-semibold text-slate-800">৳{parseFloat(receipt.subtotal).toFixed(3)}</span>
                        </div>
                        {parseFloat(receipt.discount || 0) > 0 && (
                          <div className="flex justify-between text-rose-500">
                            <span>Discount:</span>
                            <span>-৳{parseFloat(receipt.discount).toFixed(3)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Tax:</span>
                          <span className="font-semibold text-slate-800">৳{parseFloat(receipt.tax).toFixed(3)}</span>
                        </div>
                        {receipt.loyalty_enabled && (
                          <>
                            {receipt.points_earned > 0 && (
                              <div className="flex justify-between text-indigo-650 font-bold">
                                <span>Loyalty Points Earned:</span>
                                <span>+{receipt.points_earned} pts</span>
                              </div>
                            )}
                            {receipt.points_redeemed > 0 && (
                              <div className="flex justify-between text-rose-600 font-bold">
                                <span>Loyalty Points Redeemed:</span>
                                <span>-{receipt.points_redeemed} pts</span>
                              </div>
                            )}
                            {receipt.points_redeemed_value > 0 && (
                              <div className="flex justify-between text-rose-500 font-semibold">
                                <span>Points Discount:</span>
                                <span>-৳{receipt.points_redeemed_value.toFixed(3)}</span>
                              </div>
                            )}
                          </>
                        )}
                        {parseFloat(receipt.reduce_due_amount || 0) > 0 && (
                          <div className="flex justify-between text-indigo-600 font-semibold">
                            <span>Due Paid:</span>
                            <span>৳{parseFloat(receipt.reduce_due_amount).toFixed(3)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-black text-indigo-600 border-t border-slate-250 pt-1.5 text-xs">
                          <span>Total Paid:</span>
                          <span>৳{parseFloat(receipt.total).toFixed(3)}</span>
                        </div>
                        {parseFloat(receipt.due_amount || 0) > 0 && (
                          <div className="flex justify-between font-bold text-rose-600 border-t border-slate-200 pt-1">
                            <span>Due ammount:</span>
                            <span>৳{parseFloat(receipt.due_amount).toFixed(3)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-center mt-8 pt-3 border-t border-slate-100 text-slate-400 text-[9px]">
                      <p>Thank you for shopping with us! Please contact us for any inquiries.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Options & Actions Control Panel */}
            <div className="w-full md:w-80 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 p-6 bg-slate-50">
              <div>
                <div className="flex items-center space-x-2 text-emerald-600 mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-bold tracking-tight">Checkout Completed</span>
                </div>

                <h3 className="text-lg font-extrabold text-slate-800">Print Receipt for {activeTab?.name || 'Sale'}</h3>
                <p className="text-xs text-slate-500 mt-1">Transaction recorded successfully. Preview and choose formatting layout below:</p>

                {/* Print Layout Selector */}
                <div className="mt-5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Receipt Format</span>
                  <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { setPreviewMode('thermal'); }}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${previewMode === 'thermal'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                        }`}
                    >
                      Thermal (80mm)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('regular')}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${previewMode === 'regular'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                        }`}
                    >
                      Regular (A4)
                    </button>
                  </div>
                </div>

                {/* Summary Metadata Card */}
                <div className="mt-6 bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Transaction ID:</span>
                    <span className="font-semibold text-slate-700">#{receipt.sale_id}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Payment Method:</span>
                    <span className="font-semibold text-slate-700 uppercase">{receipt.payment_method}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-2 mt-2">
                    <span>Total Paid:</span>
                    <span className="font-bold text-indigo-600">৳{parseFloat(receipt.total).toFixed(3)}</span>
                  </div>
                  {receipt.due_amount > 0 && (
                    <div className="flex justify-between text-rose-500 font-semibold">
                      <span>Due ammount:</span>
                      <span>৳{parseFloat(receipt.due_amount).toFixed(3)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-8 space-y-2">
                <button
                  onClick={() => handlePrint(previewMode)}
                  className="w-full bg-slate-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Print {previewMode === 'thermal' ? 'Thermal' : 'Regular A4'}</span>
                </button>
                {currentUser?.role === 'shop_admin' && (
                  <button
                    onClick={() => handleDeleteSale(receipt.sale_id)}
                    disabled={deleting}
                    className="w-full bg-rose-50 hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 text-rose-700 border border-rose-200 disabled:border-slate-200 font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center space-x-2"
                  >
                    {deleting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-rose-700"></div>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Sale</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    triggerDrawerEjection({
                      reason: `Manual Re-Kick (Receipt #${receipt.sale_id})`,
                      saleId: receipt.sale_id,
                      amount: receipt.total,
                      method: 'BUTTON_EJECT'
                    });
                    triggerAlert('success', '⚡ Cash drawer kick signal sent!');
                  }}
                  className="w-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                  <span>⚡ Eject Cash Drawer</span>
                </button>
                <button
                  onClick={() => setReceipt(null)}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Done
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- ELECTRONIC CASH DRAWER MODAL --- */}
      <ElectronicCashDrawerModal
        isOpen={showCashDrawerModal}
        onClose={() => setShowCashDrawerModal(false)}
      />

      {/* --- DYNAMIC PRINT AREA (OFF-SCREEN ON APPLICATION SCREEN, SHOWN VIA PRINT MEDIA CLASS) --- */}
      {receipt && createPortal(
        <div id="receipt-print-area" style={{ marginTop: 0, paddingTop: 0 }}>
          {/* Thermal View Container */}
          <div className="thermal-only" style={{ marginTop: 0, paddingTop: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: '8px', marginTop: 0, paddingTop: 0 }}>
              <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0' }}>{receipt.shop_name}</h2>
              {receipt.shop_address && <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{receipt.shop_address}</p>}
              <div style={{ fontSize: '9px', margin: '0 0 4px 0' }}>
                {receipt.shop_phone && <span style={{ marginRight: '6px' }}>Tel: {receipt.shop_phone}</span>}
                {receipt.shop_email && <span>Email: {receipt.shop_email}</span>}
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em' }}>*** TRANSACTION RECEIPT ***</p>
            </div>

            <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '8px 0', fontSize: '9px', lineHeight: '1.3' }}>
              <div><strong>Sale ID:</strong> #{receipt.sale_id}</div>
              <div><strong>Date:</strong> {receipt.created_at}</div>
              <div><strong>Cashier:</strong> {receipt.staff_name}</div>
              <div><strong>Customer:</strong> {receipt.customer_name}</div>
              {receipt.customer_phone && <div><strong>Phone:</strong> {receipt.customer_phone}</div>}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', margin: '8px 0' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000' }}>
                  <th style={{ textAlign: 'left', paddingBottom: '3px' }}>Item</th>
                  <th style={{ textAlign: 'center', paddingBottom: '3px', width: '25px' }}>Qty</th>
                  <th style={{ textAlign: 'center', paddingBottom: '3px', width: '25px' }}>Unit</th>
                  <th style={{ textAlign: 'right', paddingBottom: '3px', width: '55px' }}>Price</th>
                  <th style={{ textAlign: 'right', paddingBottom: '3px', width: '60px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ paddingTop: '3px', maxWidth: '100px', wordBreak: 'break-all' }}>
                      {item.name || item.product_name}
                    </td>
                    <td style={{ textAlign: 'center', paddingTop: '3px' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'center', paddingTop: '3px', color: '#666' }}>{item.unit || 'pcs'}</td>
                    <td style={{ textAlign: 'right', paddingTop: '3px' }}>৳{parseFloat(item.price || item.unit_price).toFixed(3)}</td>
                    <td style={{ textAlign: 'right', paddingTop: '3px' }}>৳{((item.price || item.unit_price) * item.quantity).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', fontSize: '9px', lineHeight: '1.3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>৳{receipt.subtotal.toFixed(3)}</span>
              </div>
              {parseFloat(receipt.discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Discount:</span>
                  <span>-৳{parseFloat(receipt.discount).toFixed(3)}</span>
                </div>
              )}
              <div style={{ display: 'flex', style: { justifyContent: 'space-between' } }}>
                <span>Tax ({(taxRate * 100).toString()}%):</span>
                <span>৳{receipt.tax.toFixed(3)}</span>
              </div>
              {receipt.loyalty_enabled && (
                <>
                  {receipt.points_earned > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4f46e5', fontWeight: 'bold' }}>
                      <span>Points Earned:</span>
                      <span>+{receipt.points_earned} pts</span>
                    </div>
                  )}
                  {receipt.points_redeemed > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48', fontWeight: 'bold' }}>
                      <span>Points Redeemed:</span>
                      <span>-{receipt.points_redeemed} pts</span>
                    </div>
                  )}
                  {receipt.points_redeemed_value > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48' }}>
                      <span>Points Discount:</span>
                      <span>-৳{receipt.points_redeemed_value.toFixed(3)}</span>
                    </div>
                  )}
                </>
              )}
              {parseFloat(receipt.reduce_due_amount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Due Paid:</span>
                  <span>৳{parseFloat(receipt.reduce_due_amount).toFixed(3)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '3px', marginTop: '3px' }}>
                <span>Total Bill:</span>
                <span>৳{parseFloat(receipt.total).toFixed(3)}</span>
              </div>
              {receipt.change_amount > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', paddingTop: '2px' }}>
                    <span>Given Amount:</span>
                    <span>৳{parseFloat(receipt.paid_amount).toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '2px', marginTop: '2px' }}>
                    <span>Change Return:</span>
                    <span>৳{parseFloat(receipt.change_amount).toFixed(3)}</span>
                  </div>
                </>
              )}
              {parseFloat(receipt.due_amount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', color: '#ef4444', borderTop: '1px dashed #000', paddingTop: '2px', marginTop: '2px' }}>
                  <span>Due ammount:</span>
                  <span>৳{parseFloat(receipt.due_amount).toFixed(3)}</span>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '9px' }}>
              <p style={{ margin: '0 0 2px 0' }}>Payment: {receipt.payment_method.toUpperCase()}</p>
              <p style={{ margin: '0', fontWeight: 'bold' }}>*** THANK YOU ***</p>
              <p style={{ margin: '8px 0 0 0', textAlign: 'right', fontSize: '8px', color: '#64748b' }}>Bring this receipt, if you return product</p>
            </div>
          </div>

          {/* Regular A4 View Container */}
          <div className="regular-only">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px 0' }}>{receipt.shop_name}</h1>
                {receipt.shop_address && <p style={{ margin: '0 0 2px 0', color: '#64748b', fontSize: '12px' }}>{receipt.shop_address}</p>}
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                  {receipt.shop_phone && <span style={{ marginRight: '10px' }}>Tel: {receipt.shop_phone}</span>}
                  {receipt.shop_email && <span>Email: {receipt.shop_email}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#6366f1', margin: '0 0 4px 0' }}>INVOICE</h2>
                <p style={{ margin: '0 0 2px 0', color: '#64748b', fontSize: '12px' }}><strong>Invoice ID:</strong> #{receipt.sale_id}</p>
                <p style={{ margin: '0', color: '#64748b', fontSize: '12px' }}><strong>Date:</strong> {receipt.created_at}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', gap: '30px' }}>
              <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>Billed To</h3>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{receipt.customer_name}</div>
                {receipt.customer_phone && <div style={{ color: '#475569', fontSize: '12px', marginBottom: '2px' }}>Phone: {receipt.customer_phone}</div>}
                {receipt.customer_address && <div style={{ color: '#475569', fontSize: '12px' }}>Address: {receipt.customer_address}</div>}
              </div>
              <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>Billed By</h3>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{receipt.shop_name}</div>
                <div style={{ color: '#475569', fontSize: '12px', marginBottom: '2px' }}>Cashier: {receipt.staff_name}</div>
                <div style={{ color: '#475569', fontSize: '12px' }}>Payment Method: {receipt.payment_method.toUpperCase()}</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', textAlign: 'left' }}>
                  <th style={{ padding: '8px 0' }}>Item Description</th>
                  <th style={{ padding: '8px 0', textAlign: 'center', width: '100px' }}>SKU</th>
                  <th style={{ padding: '8px 0', textAlign: 'center', width: '60px' }}>Qty</th>
                  <th style={{ padding: '8px 0', textAlign: 'right', width: '100px' }}>Unit Price</th>
                  <th style={{ padding: '8px 0', textAlign: 'right', width: '100px' }}>Total</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '13px', color: '#334155' }}>
                {receipt.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 0', fontWeight: '500' }}>{item.name || item.product_name}</td>
                    <td style={{ padding: '10px 0', textAlign: 'center', color: '#64748b' }}>{item.sku || item.product_sku || 'N/A'}</td>
                    <td style={{ padding: '10px 0', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ padding: '10px 0', textAlign: 'right' }}>৳{parseFloat(item.price || item.unit_price).toFixed(3)}</td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'bold' }}>৳{((item.price || item.unit_price) * item.quantity).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <div style={{ width: '250px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                  <span>Subtotal</span>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>৳{receipt.subtotal.toFixed(3)}</span>
                </div>
                {parseFloat(receipt.discount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#ef4444' }}>
                    <span>Discount</span>
                    <span>-৳{parseFloat(receipt.discount).toFixed(3)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                  <span>Tax ({(taxRate * 100).toString()}%)</span>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>৳{receipt.tax.toFixed(3)}</span>
                </div>
                {receipt.loyalty_enabled && (
                  <>
                    {receipt.points_earned > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#4f46e5', fontWeight: 'bold' }}>
                        <span>Loyalty Points Earned</span>
                        <span>+{receipt.points_earned} pts</span>
                      </div>
                    )}
                    {receipt.points_redeemed > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#e11d48', fontWeight: 'bold' }}>
                        <span>Loyalty Points Redeemed</span>
                        <span>-{receipt.points_redeemed} pts</span>
                      </div>
                    )}
                    {receipt.points_redeemed_value > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#e11d48' }}>
                        <span>Points Cashback Discount</span>
                        <span>-৳{receipt.points_redeemed_value.toFixed(3)}</span>
                      </div>
                    )}
                  </>
                )}
                {parseFloat(receipt.reduce_due_amount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#4f46e5', fontWeight: 'bold' }}>
                    <span>Due Balance Paid</span>
                    <span>৳{parseFloat(receipt.reduce_due_amount).toFixed(3)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '15px', fontWeight: 'bold', borderTop: '2px solid #e2e8f0', marginTop: '6px' }}>
                  <span>Total Paid</span>
                  <span style={{ color: '#6366f1' }}>৳{parseFloat(receipt.total).toFixed(3)}</span>
                </div>
                {parseFloat(receipt.due_amount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#ef4444', fontWeight: 'bold', borderTop: '1px solid #e2e8f0', marginTop: '4px' }}>
                    <span>Due ammount</span>
                    <span>৳{parseFloat(receipt.due_amount).toFixed(3)}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '60px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
              <p style={{ margin: '0 0 3px 0' }}>Thank you for shopping with us!</p>
              <p style={{ margin: '0' }}>Please contact us for any inquiry regarding this invoice.</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- HOLD BILL MODAL --- */}
      {showHoldBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 ">
              <h3 className="text-lg font-bold text-slate-800">Hold Current Bill</h3>
              <button onClick={() => setShowHoldBillModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleHoldBillSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Hold Reference / Note (e.g. Table Number, Name) *
                </label>
                <input
                  type="text"
                  value={holdNotes}
                  onChange={(e) => setHoldNotes(e.target.value)}
                  required
                  placeholder="e.g. Table 5, Mr. Rabbani, In a hurry"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Cart Items Count:</span>
                  <span>{activeTab.cart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Subtotal Amount:</span>
                  <span>৳{getSubtotal().toFixed(3)}</span>
                </div>
                {activeTab.selectedCustomerId && (
                  <div className="flex justify-between">
                    <span>Customer: </span>
                    <span>{activeTab.customerName}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowHoldBillModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={holdingBill || !holdNotes.trim() || activeTab.cart.length === 0}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-xl text-sm font-semibold transition-colors shadow flex items-center space-x-1.5"
                >
                  {holdingBill ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Hold Bill</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- RESUME HELD BILLS MODAL --- */}
      {showHeldBillsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Resume Held Bills</h3>
                <p className="text-xs text-slate-400 mt-0.5">Select a suspended cart to load back into checkout</p>
              </div>
              <button
                onClick={exportHeldBillsToCSV}
                className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 border border-slate-200 rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-2 mr-4"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHeldBillsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* List Container */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
              {heldBills.filter(b => b.status === 'held').length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No active held bills found.
                </div>
              ) : (
                heldBills
                  .filter(b => b.status === 'held')
                  .map((bill) => {
                    let itemsList = [];
                    try {
                      itemsList = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
                    } catch (e) {
                      itemsList = [];
                    }
                    const totalQty = itemsList.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
                    const isDueTracker = itemsList.length === 0;

                    return (
                      <div
                        key={bill.id}
                        className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-left"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-extrabold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded">
                              #{bill.id}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(bill.created_at).toLocaleString()}
                            </span>
                            {isDueTracker ? (
                              <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-100">
                                Due Tracker (৳{parseFloat(bill.due_amount || 0).toFixed(3)})
                              </span>
                            ) : (
                              <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100">
                                Suspended Cart ({totalQty} items)
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-slate-700">
                            Ref: {bill.notes || 'No notes'}
                          </div>
                          <div className="text-xs text-slate-500">
                            Customer: {bill.customer_name || 'Walk-in'} | Cashier: {bill.staff_name || 'System'}
                          </div>
                          {!isDueTracker && itemsList.length > 0 && (
                            <div className="text-[11px] text-slate-450 mt-1 truncate max-w-md">
                              Items: {itemsList.map(item => `${item.product_name || 'Item'} (x${item.quantity})`).join(', ')}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleResumeHeldBill(bill)}
                            disabled={isDueTracker}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-sm transition-colors"
                            title={isDueTracker ? "Cannot resume a due payment tracker here" : "Resume Cart"}
                          >
                            Resume
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHeldBill(bill.id)}
                            className="text-rose-600 hover:text-rose-900 hover:bg-rose-50 border border-rose-100 p-2 rounded-xl transition-colors"
                            title="Discard Held Bill"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHeldBillsModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- VIRTUAL KEYBOARD / NUMPAD MODAL --- */}
      {showKeyboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <span className="text-xl">⌨️</span>
                <div>
                  <h3 className="text-sm font-bold leading-tight">POS Keyboard & Virtual Numpad</h3>
                  <p className="text-[10px] text-slate-400">Touch Numpad & Keyboard Hotkeys Console</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyboardModal(false)}
                className="text-slate-400 hover:text-white transition-colors p-1"
                title="Close (Esc)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[85vh] overflow-y-auto">

              {/* Target Selector Tabs */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Field to Edit:
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                  {[
                    { id: 'paidAmount', label: '💵 Amt Paid' },
                    { id: 'quantity', label: '📦 Item Qty' },
                    { id: 'price', label: '🏷️ Item Price' },
                    { id: 'discountPercent', label: '% Disc (%)' },
                    { id: 'discountAmount', label: '৳ Disc (Amt)' },
                    { id: 'redeemPoints', label: '⭐ Points' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNumpadTarget(t.id)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-extrabold transition-all text-center cursor-pointer ${numpadTarget === t.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-transparent text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Display Box */}
              <div className="bg-slate-900 rounded-xl p-3 text-white flex justify-between items-center shadow-inner">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Active Target: {numpadTarget}
                  </span>
                  {(numpadTarget === 'quantity' || numpadTarget === 'price') && (
                    <span className="text-xs text-indigo-300 font-semibold truncate block max-w-[200px]">
                      Item: {(() => {
                        const item = activeTab?.cart?.find(i => i.id === selectedCartItemId) || activeTab?.cart?.[activeTab.cart.length - 1];
                        return item ? item.name : 'No cart item selected';
                      })()}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                  {(() => {
                    if (!activeTab) return '0';
                    if (numpadTarget === 'quantity') {
                      const item = activeTab.cart.find(i => i.id === selectedCartItemId) || activeTab.cart[activeTab.cart.length - 1];
                      return item ? `${item.quantity} ${item.unit || 'pcs'}` : '0';
                    }
                    if (numpadTarget === 'price') {
                      const item = activeTab.cart.find(i => i.id === selectedCartItemId) || activeTab.cart[activeTab.cart.length - 1];
                      return item ? `৳${parseFloat(item.price || 0).toFixed(3)}` : '৳0.000';
                    }
                    if (numpadTarget === 'discountPercent') return `${activeTab.discountPercent || 0}%`;
                    if (numpadTarget === 'discountAmount') return `৳${(activeTab.discountAmount || 0).toFixed(3)}`;
                    if (numpadTarget === 'paidAmount') return `৳${(parseFloat(activeTab.paidAmount) || 0).toFixed(3)}`;
                    if (numpadTarget === 'redeemPoints') return `${activeTab.redeemPoints || 0} pts`;
                    return '0';
                  })()}
                </div>
              </div>

              {/* Numpad Button Grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  ['7', 7], ['8', 8], ['9', 9], ['⌫', 'BACKSPACE'],
                  ['4', 4], ['5', 5], ['6', 6], ['C', 'CLEAR'],
                  ['1', 1], ['2', 2], ['3', 3], ['.', '.'],
                  ['0', 0], ['00', '00'], ['+1 Qty', '+1'], ['-1 Qty', '-1'],
                ].map(([label, val], i) => {
                  const isAction = val === 'BACKSPACE' || val === 'CLEAR' || val === '+1' || val === '-1';
                  const isBackspace = val === 'BACKSPACE';
                  const isClear = val === 'CLEAR';

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleNumpadPress(val)}
                      className={`py-3 rounded-xl font-bold text-sm transition-all shadow-xs active:scale-95 cursor-pointer flex items-center justify-center ${isBackspace
                        ? 'bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 font-extrabold'
                        : isClear
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200 font-extrabold'
                          : isAction
                            ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border border-indigo-200 font-extrabold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-extrabold text-base'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Quick Cash Presets (When Target is Paid Amount) */}
              {numpadTarget === 'paidAmount' && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Quick Cash Presets:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleNumpadPress('EXACT')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-1.5 px-3 rounded-lg shadow-sm cursor-pointer"
                    >
                      Exact (৳{getFinalTotal().toFixed(3)})
                    </button>
                    {[50, 100, 200, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleNumpadPress(amt)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 cursor-pointer"
                      >
                        ৳{amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Keyboard Hotkeys Reference */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                <span className="font-bold text-slate-700 block mb-1">⌨️ Physical Keyboard Hotkeys:</span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600">
                  <div><strong className="text-indigo-600 font-mono">F2</strong> : Focus Product Search</div>
                  <div><strong className="text-indigo-600 font-mono">F4</strong> : Focus Customer Field</div>
                  <div><strong className="text-rose-600 font-mono">F8</strong> : Clear Cart</div>
                  <div><strong className="text-emerald-600 font-mono">F9</strong> : Preview / Complete Checkout</div>
                  <div><strong className="text-amber-600 font-mono">F10</strong> : Hold Bill</div>
                  <div><strong className="text-cyan-600 font-mono">Alt + K</strong> : Toggle Keypad Modal</div>
                  <div><strong className="text-slate-500 font-mono">Esc</strong> : Close Overlay Modals</div>
                </div>
              </div>

            </div>

            <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowKeyboardModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  // --- SUB-COMPONENT: CART PANEL DETAILS ---
  function renderCartPanelContent() {
    if (!activeTab) return null;

    return (
      <div className="flex flex-col h-full overflow-hidden">

        {/* Top Cart Action Header with Keyboard Numpad Trigger */}
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-100/90 flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">Cart Details</span>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {activeTab.cart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)} items
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Keyboard Hotkey Trigger Button */}
            <button
              type="button"
              onClick={() => setShowKeyboardModal(true)}
              className="bg-gray-600 hover:bg-gray-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Open Virtual Keyboard Numpad & POS Hotkeys (Alt+K)"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span> Keyboard Pad</span>
              <span className="text-[10px] bg-white/25 px-1 py-0.2 rounded font-mono">Alt+K</span>
            </button>
          </div>
        </div>

        {/* Quick Hotkeys Legend Bar */}
        <div className="px-3 py-1 bg-slate-800 text-slate-300 text-[10px] font-medium flex items-center justify-between flex-wrap gap-1">
          <span className="font-bold text-white uppercase text-[9px] tracking-wider">Active Keys:</span>
          <span className="bg-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px]"><strong className="text-indigo-300">F2</strong> Search</span>
          <span className="bg-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px]"><strong className="text-indigo-300">F4</strong> Customer</span>
          <span className="bg-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px]"><strong className="text-amber-300">↑↓</strong> Nav Cart</span>
          <span className="bg-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px]"><strong className="text-cyan-300">←→</strong> Qty (+/-)</span>
          <span className="bg-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px]"><strong className="text-emerald-300">Enter / F9</strong> Pay</span>
          <span className="bg-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px]"><strong className="text-rose-300">F8</strong> Clear</span>
        </div>

        {/* Customer & Cart items header */}
        <div className="p-2.5 border-b border-slate-100 bg-slate-50 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 relative">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Select Customer (F4)
              </label>
              {(() => {
                const query = (activeTab.customerName || '').toLowerCase();
                const suggestions = activeTab.selectedCustomerId === '' && activeTab.customerName && activeTab.customerName.trim() !== ''
                  ? customers.filter(c =>
                      c.name.toLowerCase().includes(query) || (c.phone && c.phone.includes(query))
                    )
                  : [];

                const selectSuggestion = (c) => {
                  updateActiveTabState('selectedCustomerId', c.id);
                  updateActiveTabState('customerName', c.name);
                  updateActiveTabState('customerPhone', c.phone || '');
                  updateActiveTabState('customerAddress', c.address || '');
                  setCustomerFocusedIndex(-1);
                };

                return (
                  <>
                    <input
                      ref={customerInputRef}
                      type="text"
                      placeholder="Walk-in Customer (F4)..."
                      value={activeTab.selectedCustomerId ? (customers.find(c => String(c.id) === String(activeTab.selectedCustomerId))?.name || activeTab.customerName || '') : (activeTab.customerName || '')}
                      onChange={(e) => {
                        updateActiveTabState('customerName', e.target.value);
                        if (activeTab.selectedCustomerId !== '') {
                          updateActiveTabState('selectedCustomerId', '');
                        }
                        setCustomerFocusedIndex(-1);
                      }}
                      onKeyDown={(e) => {
                        if (suggestions.length === 0) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setCustomerFocusedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setCustomerFocusedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customerFocusedIndex >= 0 && suggestions[customerFocusedIndex]) {
                            selectSuggestion(suggestions[customerFocusedIndex]);
                          } else if (suggestions.length === 1) {
                            selectSuggestion(suggestions[0]);
                          }
                        } else if (e.key === 'Escape') {
                          setCustomerFocusedIndex(-1);
                          updateActiveTabState('customerName', '');
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg p-1.5 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />

                    {/* Autocomplete Customer Suggestions */}
                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-[60] max-h-40 overflow-y-auto divide-y divide-slate-100">
                        {suggestions.map((c, idx) => (
                          <div
                            key={c.id}
                            onClick={() => selectSuggestion(c)}
                            className={`p-2 px-3 cursor-pointer text-left transition-colors ${
                              idx === customerFocusedIndex
                                ? 'bg-indigo-600 text-white'
                                : 'hover:bg-indigo-50'
                            }`}
                          >
                            <div className={`text-xs font-semibold ${idx === customerFocusedIndex ? 'text-white' : 'text-slate-800'}`}>{c.name}</div>
                            <div className={`text-[10px] flex justify-between mt-0.5 ${idx === customerFocusedIndex ? 'text-indigo-200' : 'text-slate-500'}`}>
                              <span>Phone: {c.phone || '-'}</span>
                              {parseFloat(c.due_balance) > 0 && <span className={idx === customerFocusedIndex ? 'text-rose-200' : 'text-rose-600'}>Due: ৳{parseFloat(c.due_balance).toFixed(3)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="col-span-1">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Sale Date
              </label>
              <input
                type="date"
                value={activeTab.saleDate || new Date().toBDISODateString()}
                onChange={(e) => updateActiveTabState('saleDate', e.target.value)}
                disabled={!(currentUser?.role === 'shop_admin' || currentUser?.role === 'super_admin')}
                className="w-full bg-white border border-slate-200 rounded-lg p-1.5 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="border-t border-slate-200/60 pt-2 space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Customer Details
            </h4>

            {activeTab.selectedCustomerId && (() => {
              const selected = customers.find(c => c.id === parseInt(activeTab.selectedCustomerId));
              const balance = parseFloat(selected?.due_balance || 0);
              const reduceDue = parseFloat(activeTab.reduceDueAmount || 0);
              if (balance > 0) {
                return (
                  <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 space-y-2 text-xs text-rose-700">
                    <div className="flex justify-between">
                      <span className="font-medium">Due ammount:</span>
                      <span className="font-bold">৳{balance.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-rose-200">
                      <span className="font-medium">Collect Due Payment:</span>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          max={balance}
                          value={reduceDue > 0 ? reduceDue : ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const cappedVal = Math.min(val, balance);
                            updateActiveTabState('reduceDueAmount', cappedVal);
                            updateActiveTabState('paidAmount', '');
                            updateActiveTabState('isPaidTouched', false);
                          }}
                          placeholder="0.00"
                          className="w-24 border border-rose-300 rounded px-2 py-1 text-right font-semibold text-rose-700 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                        <span className="text-[11px] font-bold">৳</span>
                      </div>
                    </div>
                    {reduceDue > 0 && (
                      <div className="text-[10px] text-rose-600 text-right">
                        Applied: ৳{reduceDue.toFixed(3)} from due balance
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* Loyalty Points Section */}
            {loyaltyEnabled && activeTab.selectedCustomerId && (() => {
              const selected = customers.find(c => c.id === parseInt(activeTab.selectedCustomerId));
              const availablePoints = selected?.loyalty_points || 0;
              const pointsDiscountVal = (activeTab.redeemPoints || 0) * loyaltyPointValue;

              return (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 space-y-2 text-xs text-indigo-850">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Loyalty Program Active</span>
                    <span className="bg-indigo-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {availablePoints} Points Available
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-indigo-700 font-medium">
                    <span>Redeem value: ৳{loyaltyPointValue.toFixed(3)} / pt</span>
                    <span>Total Value: ৳{(availablePoints * loyaltyPointValue).toFixed(3)}</span>
                  </div>

                  {availablePoints > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t border-indigo-200">
                      <span className="font-semibold">Redeem Points:</span>
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="number"
                          min="0"
                          max={availablePoints}
                          value={activeTab.redeemPoints > 0 ? activeTab.redeemPoints : ''}
                          onChange={(e) => {
                            let val = parseInt(e.target.value, 10) || 0;
                            if (val < 0) val = 0;
                            if (val > availablePoints) val = availablePoints;

                            const maxPointsToCover = Math.ceil(getSubtotal() / loyaltyPointValue);
                            if (val > maxPointsToCover) val = maxPointsToCover;

                            updateActiveTabState('redeemPoints', val);
                            updateActiveTabState('paidAmount', '');
                            updateActiveTabState('isPaidTouched', false);
                          }}
                          placeholder="0"
                          className="w-16 border border-indigo-300 rounded px-1.5 py-0.5 text-right font-bold text-indigo-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const maxPointsToCover = Math.ceil(getSubtotal() / loyaltyPointValue);
                            const val = Math.min(availablePoints, maxPointsToCover);
                            updateActiveTabState('redeemPoints', val);
                            updateActiveTabState('paidAmount', '');
                            updateActiveTabState('isPaidTouched', false);
                          }}
                          className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded border border-indigo-200 text-[10px] transition-colors"
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                  )}
                  {activeTab.redeemPoints > 0 && (
                    <div className="text-[10px] text-emerald-600 font-bold text-right">
                      Discount Applied: -৳{pointsDiscountVal.toFixed(3)}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 gap-1.5">
              {/* Customer Name input removed per user request */}

              <div className="col-span-1 relative">
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={activeTab.customerPhone}
                  onChange={(e) => {
                    updateActiveTabState('customerPhone', e.target.value);
                    if (activeTab.selectedCustomerId !== '') {
                      updateActiveTabState('selectedCustomerId', '');
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                {/* Autocomplete Customer Suggestions */}
                {activeTab.selectedCustomerId === '' && activeTab.customerPhone.trim() !== '' && (() => {
                  const query = activeTab.customerPhone.replace(/[^0-9]/g, '');
                  const suggestions = customers.filter(c =>
                    c.phone && c.phone.replace(/[^0-9]/g, '').includes(query)
                  );
                  if (suggestions.length === 0) return null;
                  return (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-slate-100">
                      {suggestions.map(c => (
                        <div
                          key={c.id} onClick={() => updateActiveTabState('selectedCustomerId', c.id)}
                          className="p-2 px-3 hover:bg-indigo-50 cursor-pointer text-left transition-colors"
                        >
                          <div className="text-xs font-semibold text-slate-800">{c.name}</div>
                          <div className="text-[10px] text-slate-500 flex justify-between mt-0.5">
                            <span>Phone: {c.phone}</span>
                            {c.address && <span className="truncate max-w-[120px]">Loc: {c.address}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Address input removed per user request */}
            </div>

            {/* Checkbox for saving / syncing to database */}
            {((activeTab.selectedCustomerId === '' && activeTab.customerName.trim() !== '') ||
              (activeTab.selectedCustomerId !== '' && (
                (() => {
                  const selected = customers.find(c => c.id === parseInt(activeTab.selectedCustomerId));
                  return selected && (
                    activeTab.customerName !== (selected.name || '') ||
                    activeTab.customerPhone !== (selected.phone || '') ||
                    activeTab.customerAddress !== (selected.address || '')
                  );
                })()
              ))) && (
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={activeTab.syncToDirectory}
                    onChange={(e) => updateActiveTabState('syncToDirectory', e.target.checked)}
                    className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs text-indigo-600 font-medium">
                    {activeTab.selectedCustomerId === ''
                      ? 'Save as new customer in directory'
                      : 'Sync profile updates to directory'}
                  </span>
                </label>
              )}
          </div>
        </div>

        {/* Selected products table */}
        <div className="flex-1 overflow-y-auto p-2 min-h-0 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 hover:scrollbar-thumb-slate-400">
          {activeTab?.cart?.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-slate-400 py-12">
              <svg className="w-10 h-10 mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="text-sm font-medium">Cart is empty</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase bg-slate-50/50">
                    <th className="p-2 pl-3 w-[30%]">Item</th>
                    <th className="p-2 text-center w-[28%]">Qty</th>
                    <th className="p-2 text-center w-[10%]">Unit</th>
                    <th className="p-2 text-right w-[16%]">Price</th>
                    <th className="p-2 text-right w-[14%]">Sub</th>
                    <th className="p-2 w-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {activeTab.cart.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedCartItemId(item.id)}
                      className={`hover:bg-indigo-50/40 transition-colors cursor-pointer ${selectedCartItemId === item.id ? 'bg-indigo-50/80 font-bold border-l-4 border-indigo-600' : ''}`}
                    >
                      <td className="p-2 pl-3 font-semibold text-slate-800 min-w-0" title={item.name}>
                        <div className="truncate text-xs">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal truncate">৳{parseFloat(item.cost_price || 0).toFixed(2)}</div>
                      </td>
                      <td className="p-2 text-center">
                        <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden w-full justify-center">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="px-1.5 py-1 hover:bg-slate-100 text-slate-600 transition-colors font-bold text-xs shrink-0"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            max={item.stock_quantity}
                            value={item.quantity}
                            onChange={(e) => handleQuantityInput(item.id, e.target.value)}
                            onBlur={() => handleQuantityBlur(item.id, item.quantity)}
                            className="w-10 text-center text-xs font-bold text-slate-700 bg-transparent border-0 focus:ring-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="px-1.5 py-1 hover:bg-slate-100 text-slate-600 transition-colors font-bold text-xs shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="p-2 text-center text-slate-500 font-medium font-sans">
                        {item.unit || 'piece'}
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.price}
                          onChange={(e) => updatePrice(item.id, e.target.value)}
                          className="w-full min-w-0 border border-slate-200 rounded px-1 py-0.5 text-right font-extrabold text-indigo-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs shadow-sm"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={editingSubtotalId === item.id
                            ? editingSubtotalValue
                            : (item.price && item.quantity ? parseFloat((parseFloat(item.price) * item.quantity).toFixed(3)) : '')}
                          onFocus={() => {
                            const computed = item.price && item.quantity
                              ? parseFloat((parseFloat(item.price) * item.quantity).toFixed(3))
                              : '';
                            setEditingSubtotalId(item.id);
                            setEditingSubtotalValue(computed === '' ? '' : String(computed));
                          }}
                          onChange={(e) => {
                            setEditingSubtotalValue(e.target.value);
                          }}
                          onBlur={() => {
                            updateSubtotal(item.id, editingSubtotalValue);
                            setEditingSubtotalId(null);
                            setEditingSubtotalValue('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateSubtotal(item.id, editingSubtotalValue);
                              setEditingSubtotalId(null);
                              setEditingSubtotalValue('');
                              e.target.blur();
                            }
                          }}
                          className="w-full min-w-0 border border-slate-200 rounded px-1 py-0.5 text-right font-extrabold text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs shadow-sm"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                          title="Remove Item"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="red" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Calculation summary + Pay trigger button */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50 space-y-2 shrink-0">
          <div className="space-y-1.5 text-xs text-slate-600">
            {/* Tax, Discounts, Total in a fluid single-column layout */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-slate-700">Tax ({(taxRate * 100).toString()}%):</span>
                <span className="font-semibold">৳{getTax().toFixed(3)}</span>
              </div>

              {/* Discount Manual Inputs — side by side */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between items-center gap-1">
                  <span className="font-bold text-xs text-slate-700 whitespace-nowrap">Disc (%):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={activeTab.discountPercent || ''}
                    placeholder="0"
                    onChange={(e) => updateActiveTabState('discountPercent', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    disabled={parseFloat(activeTab.discountAmount || 0) > 0}
                    className="w-full border border-slate-200 rounded px-1 py-1 text-right font-medium text-slate-700 bg-white text-xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed min-w-0"
                  />
                </div>

                <div className="flex justify-between items-center gap-1">
                  <span className="font-bold text-xs text-slate-700 whitespace-nowrap">Disc (৳):</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={activeTab.discountAmount || ''}
                    placeholder="0"
                    onChange={(e) => updateActiveTabState('discountAmount', Math.max(0, parseFloat(e.target.value) || 0))}
                    disabled={parseFloat(activeTab.discountPercent || 0) > 0}
                    className="w-full border border-slate-200 rounded px-1 py-1 text-right font-medium text-slate-700 bg-white text-xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed min-w-0"
                  />
                </div>
              </div>

              {/* Final Total */}
              <div className="flex justify-between items-center border-t border-slate-200/60 pt-1.5 mt-0.5">
                <span className="font-extrabold text-slate-800">Total:</span>
                <span className="font-extrabold text-indigo-650 text-sm">৳{getFinalTotal().toFixed(3)}</span>
              </div>
            </div>

            {getDiscountAmount() > 0 && (
              <div className="flex justify-between text-[11px] text-rose-500">
                <span>Discounted Amt:</span>
                <span>-৳{getDiscountAmount().toFixed(3)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm text-slate-500 font-bold border-t border-slate-200/40 pt-1 mt-0.5">
              <span>Sub-total:</span>
              <span>৳{getFinalTotal().toFixed(3)}</span>
            </div>

            {getPointsDiscount() > 0 && (
              <div className="flex justify-between text-[11px] text-emerald-600 font-medium">
                <span>Loyalty Cashback:</span>
                <span>-৳{getPointsDiscount().toFixed(3)}</span>
              </div>
            )}

            {parseFloat(activeTab?.reduceDueAmount || 0) > 0 && (
              <div className="flex justify-between items-center bg-rose-50 border border-rose-100 rounded-lg p-2 text-rose-800 font-medium text-[11px]">
                <span className="flex items-center">
                  <svg className="w-3 h-3 mr-1 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Due Balance Payment
                </span>
                <div className="flex items-center space-x-1">
                  <span className="font-bold">৳{parseFloat(activeTab?.reduceDueAmount).toFixed(3)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      updateActiveTabState('reduceDueAmount', 0);
                      updateActiveTabState('isPaidTouched', false);
                    }}
                    className="text-rose-455 hover:text-rose-600 font-extrabold text-sm px-0.5"
                    title="Remove Due Payment"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Amount Paid input & Payment Method split row */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-bold text-sm text-slate-700 whitespace-nowrap">Amt Paid:</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={activeTab.paidAmount || ''}
                  onChange={(e) => {
                    updateActiveTabState('paidAmount', e.target.value);
                    updateActiveTabState('isPaidTouched', true);
                  }}
                  placeholder={getFinalTotal().toFixed(3)}
                  className="flex-1 min-w-0 border border-slate-200 rounded px-1.5 py-1 text-right font-semibold text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {['cash', 'card', 'mobile_pay'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => updateActiveTabState('paymentMethod', method)}
                    className={`py-1 px-1.5 rounded text-[10px] font-semibold border text-center transition-all ${activeTab?.paymentMethod === method
                      ? 'bg-slate-600 border-indigo-650 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    {method === 'mobile_pay' ? 'Mobile' : method.charAt(0).toUpperCase() + method.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab && (() => {
              const finalTotal = getFinalTotal();
              const rawPaid = activeTab.paidAmount;
              const parsedPaid = (rawPaid === '' || rawPaid === null || rawPaid === undefined)
                ? (activeTab.isPaidTouched ? 0 : finalTotal)
                : (isNaN(parseFloat(rawPaid)) ? 0 : parseFloat(rawPaid));
              const dueAmount = Math.max(0, finalTotal - parsedPaid);
              const changeReturn = Math.max(0, parsedPaid - finalTotal);

              if (changeReturn > 0) {
                return (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-1 space-y-0.5 text-[11px] text-emerald-800">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-900">Change Return (Return to Customer):</span>
                      <span className="font-black text-emerald-700 text-xs">৳{changeReturn.toFixed(3)}</span>
                    </div>
                  </div>
                );
              }

              if (dueAmount > 0) {
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1 space-y-0.5 text-[11px] text-amber-800">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Due ammount:</span>
                      <span className="font-bold">৳{dueAmount.toFixed(3)}</span>
                    </div>
                    <div className="text-[9px] text-amber-600 font-semibold text-right">
                      * Customer Profile Required
                    </div>
                    <div className="flex justify-end mt-1 pt-1 border-t border-amber-200">
                      <button
                        type="button"
                        onClick={() => {
                          updateActiveTabState('paidAmount', finalTotal.toFixed(3));
                          updateActiveTabState('isPaidTouched', true);
                        }}
                        className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline"
                        title="Clear due amount and pay in full"
                      >
                        Clear Due (Pay Full)
                      </button>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Action Triggers */}
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => { setPreviewModeType('due'); setShowCheckoutPreview(true); }}
              disabled={activeTab?.cart?.length === 0 || submitting}
              className="col-span-1 bg-rose-50 hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 text-rose-700 border border-rose-200 disabled:border-slate-200 font-bold py-2 px-1.5 rounded-xl transition-colors flex justify-center items-center space-x-1"
              title="Save as Due (paid later)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">Due</span>
            </button>
            <button
              onClick={() => { setPreviewModeType('checkout'); setShowCheckoutPreview(true); }}
              disabled={activeTab?.cart?.length === 0 || submitting}
              className="col-span-2 bg-slate-600 hover:bg-gray-700 disabled:bg-slate-300 text-black font-bold py-2 px-3 rounded-xl shadow-md transition-colors flex justify-center items-center space-x-1.5"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  <span className="text-xs text-white">Preview Checkout</span>
                  <span className="font-extrabold bg-yellow-500/80 px-1.5 py-0.5 rounded text-[10px]">
                    ৳{getFinalTotal().toFixed(3)}
                  </span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    );
  }
}
