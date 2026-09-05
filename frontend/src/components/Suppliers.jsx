import React, { useState, useEffect, useRef, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import API_BASE_URL from '../config';

export default function Suppliers() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'shop_admin';
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);

  // Sub-navigation tabs: 'directory', 'pos', 'logs'
  const [activeTab, setActiveTab] = useState('pos');

  // Supplier Profile view state (null = show tabs, non-null = supplier ID)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTab, setProfileTab] = useState('pos_history'); // 'pos_history', 'cost_history', 'supplied_products'

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);

  // Toggle between single and bulk supplier creation
  const [isBulkSupplierMode, setIsBulkSupplierMode] = useState(false);

  const [showAddPoModal, setShowAddPoModal] = useState(false);
  const [isEditPoMode, setIsEditPoMode] = useState(false);
  const [showPoDetailsModal, setShowPoDetailsModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  // Shared entity states
  const [productsList, setProductsList] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [costLogs, setCostLogs] = useState([]);
  const [selectedPo, setSelectedPo] = useState(null);

  // Return & Replace states (Modernized System)
  const [expiredSubTab, setExpiredSubTab] = useState('watchlist'); // 'watchlist', 'new_return', 'history'
  const [expiryFilterDays, setExpiryFilterDays] = useState('all'); // 'all', 'expired', '7', '15', '30', '60'
  const [expirySearchTerm, setExpirySearchTerm] = useState('');
  const [selectedExpiryItemIds, setSelectedExpiryItemIds] = useState([]);

  // Single Return & Replace Modals
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedExpiredProduct, setSelectedExpiredProduct] = useState(null);
  const [returnFormData, setReturnFormData] = useState({
    quantity: '',
    unit_cost: '',
    reason: 'Expired',
    settlement_type: 'deduct_due',
    refund_amount: '',
    reference_no: '',
    notes: ''
  });
  const [replaceFormData, setReplaceFormData] = useState({
    quantity: '',
    new_expiry_date: '',
    reason: 'Product Replacement',
    notes: ''
  });

  // Universal Return Desk state
  const [deskFormData, setDeskFormData] = useState({
    product_id: '',
    action_type: 'return',
    quantity: '1',
    unit_cost: '',
    reason: 'Expired',
    settlement_type: 'deduct_due',
    refund_amount: '',
    reference_no: '',
    new_expiry_date: '',
    notes: ''
  });
  const [deskProductSearch, setDeskProductSearch] = useState('');
  const [showDeskProductDropdown, setShowDeskProductDropdown] = useState(false);
  const deskProductDropdownRef = useRef(null);

  // Bulk Return / Replace Modal states
  const [showBulkReturnModal, setShowBulkReturnModal] = useState(false);
  const [bulkReturnAction, setBulkReturnAction] = useState('return'); // 'return', 'replace'
  const [bulkReturnSettlement, setBulkReturnSettlement] = useState('deduct_due');
  const [bulkReturnReason, setBulkReturnReason] = useState('Expired Batch Return');
  const [bulkReturnNotes, setBulkReturnNotes] = useState('');
  const [bulkReturnNewExpiry, setBulkReturnNewExpiry] = useState('');
  const [bulkReturnProcessing, setBulkReturnProcessing] = useState(false);

  // Return History Filter & Debit Note states
  const [historyActionFilter, setHistoryActionFilter] = useState('all'); // 'all', 'return', 'replace', 'deduct_due'
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);
  const [selectedDebitNoteLog, setSelectedDebitNoteLog] = useState(null);

  // Product Edit states (inside supplied products profile tab)
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productEditForm, setProductEditForm] = useState({ name: '', sku: '', cost_price: '', price: '', stock_quantity: '', category: '', unit: 'piece' });
  const [updatingProduct, setUpdatingProduct] = useState(false);

  // Log Edit CRUD states
  const [showEditLogModal, setShowEditLogModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [editLogFormData, setEditLogFormData] = useState({
    quantity: '',
    unit_cost: '',
    reason: 'Expired',
    settlement_type: 'none',
    refund_amount: '',
    notes: '',
    new_expiry_date: ''
  });

  // Cost Price Log View/Delete states
  const [showCostLogViewModal, setShowCostLogViewModal] = useState(false);
  const [selectedCostLog, setSelectedCostLog] = useState(null);
  const [costLogViewLoading, setCostLogViewLoading] = useState(false);

  // Supplier CSV upload states
  const [showSupplierCsvModal, setShowSupplierCsvModal] = useState(false);
  const [supplierCsvFile, setSupplierCsvFile] = useState(null);
  const [supplierCsvUploading, setSupplierCsvUploading] = useState(false);
  const [supplierCsvUploadProgress, setSupplierCsvUploadProgress] = useState(0);
  const [supplierCsvUploadCurrentRow, setSupplierCsvUploadCurrentRow] = useState(0);
  const [supplierCsvUploadTotalRows, setSupplierCsvUploadTotalRows] = useState(0);
  const [supplierCsvUploadStatus, setSupplierCsvUploadStatus] = useState('');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);
  const [selectedPoIds, setSelectedPoIds] = useState([]);
  const [poSearchFocusedIndex, setPoSearchFocusedIndex] = useState(-1);
  const [supplierSearchFocusedIndex, setSupplierSearchFocusedIndex] = useState(-1);
  const [productSearchFocusedIndex, setProductSearchFocusedIndex] = useState(-1);

  // Purchase Order CSV upload states
  const [poCsvFile, setPoCsvFile] = useState(null);
  const [poCsvUploading, setPoCsvUploading] = useState(false);
  const [showPoCsvUpload, setShowPoCsvUpload] = useState(false);
  const [csvUploadProgress, setCsvUploadProgress] = useState(0);
  const [csvUploadCurrentRow, setCsvUploadCurrentRow] = useState(0);
  const [csvUploadTotalRows, setCsvUploadTotalRows] = useState(0);
  const [csvUploadStatus, setCsvUploadStatus] = useState('');

  // Filtered PO state
  const [poStartDate, setPoStartDate] = useState('');
  const [poEndDate, setPoEndDate] = useState('');
  const [showFilteredPOModal, setShowFilteredPOModal] = useState(false);
  const [filteredPOItemsData, setFilteredPOItemsData] = useState(null);
  const [filteredPOLoading, setFilteredPOLoading] = useState(false);

  // PO Delete & Progress state
  const [showPoDeleteModal, setShowPoDeleteModal] = useState(false);
  const [poToDelete, setPoToDelete] = useState(null);
  const [poDeleting, setPoDeleting] = useState(false);
  const [poDeleteProgress, setPoDeleteProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    percent: 0,
    currentName: ''
  });

  // Supplier basic form state
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: ''
  });

  // PO form state
  const [poFormData, setPoFormData] = useState({
    supplier_id: '',
    order_date: '',
    notes: '',
    product_id: '',
    is_new: false,
    name: '',
    sku: '',
    category: '',
    cost_price: '',
    selling_price: '',
    discount_percent: '',
    quantity_ordered: 1,
    unit: 'piece',
    low_stock_threshold: '10',
    payment_basis: 'cash',
    paid_amount: '',
    received_date: ''
  });

  // Handle change of discount % field - calculates Cost Price from Sale Price
  const handleDiscountPercentChange = (val) => {
    const sp = parseFloat(poFormData.selling_price);
    const pct = parseFloat(val);

    if (val !== '' && !isNaN(pct) && !isNaN(sp) && sp > 0) {
      const calculatedCost = Math.max(0, sp - (sp * pct / 100));
      setPoFormData(prev => ({
        ...prev,
        discount_percent: val,
        cost_price: String(parseFloat(calculatedCost.toFixed(2)))
      }));
    } else {
      setPoFormData(prev => ({
        ...prev,
        discount_percent: val
      }));
    }
  };

  // Handle change of Sale Price field - updates Cost Price if % is set
  const handleSellingPriceChange = (val) => {
    const sp = parseFloat(val);
    const pct = parseFloat(poFormData.discount_percent);

    if (val !== '' && !isNaN(sp) && !isNaN(pct) && poFormData.discount_percent !== '') {
      const calculatedCost = Math.max(0, sp - (sp * pct / 100));
      setPoFormData(prev => ({
        ...prev,
        selling_price: val,
        cost_price: String(parseFloat(calculatedCost.toFixed(2)))
      }));
    } else {
      setPoFormData(prev => ({
        ...prev,
        selling_price: val
      }));
    }
  };

  // Handle change of Cost Price field - reverse calculates % if Sale Price is set
  const handleCostPriceChange = (val) => {
    const cp = parseFloat(val);
    const sp = parseFloat(poFormData.selling_price);

    if (val !== '' && !isNaN(cp) && !isNaN(sp) && sp > 0) {
      const calculatedPct = (((sp - cp) / sp) * 100).toFixed(2);
      setPoFormData(prev => ({
        ...prev,
        cost_price: val,
        discount_percent: parseFloat(calculatedPct) !== 0 ? String(parseFloat(calculatedPct)) : '0'
      }));
    } else {
      setPoFormData(prev => ({
        ...prev,
        cost_price: val
      }));
    }
  };

  // PO cart for multiple products
  const [poCart, setPoCart] = useState([]);

  // Grouped product names for PO form (like All Product Names page - groups by name, ignores SKU)
  const groupedProductNames = useMemo(() => {
    const nameGroups = new Map();
    productsList.forEach(product => {
      const normalizedName = product.name ? product.name.trim().toLowerCase() : '';
      if (!normalizedName) return;

      if (!nameGroups.has(normalizedName)) {
        nameGroups.set(normalizedName, {
          name: product.name,
          allSkus: [product.sku],
          allIds: [product.id],
          // Store first product's details as default
          defaultProduct: product
        });
      } else {
        const group = nameGroups.get(normalizedName);
        if (product.sku && !group.allSkus.includes(product.sku)) {
          group.allSkus.push(product.sku);
        }
        if (!group.allIds.includes(product.id)) {
          group.allIds.push(product.id);
        }
      }
    });
    return Array.from(nameGroups.values());
  }, [productsList]);

  // ── BARCODE SCANNER states ─────────────────────────────────────────────
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeMode, setBarcodeMode] = useState(false); // scanner strip visible
  const [barcodeStatus, setBarcodeStatus] = useState(null); // { type: 'success'|'error'|'warn', msg }
  const [barcodeLastScanned, setBarcodeLastScanned] = useState(null);
  const barcodeInputRef = useRef(null);

  // Auto create or get supplier by name on-the-fly
  const createOrGetSupplier = async (supplierName) => {
    const trimmed = supplierName ? supplierName.trim() : '';
    if (!trimmed) return null;

    // First check if already exists in suppliers state (case-insensitive)
    const existing = suppliers.find(s => s.name && s.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return existing;
    }

    // Otherwise create via API on-the-fly
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: trimmed })
      });

      const data = await response.json();
      if (response.ok && (data.id || data.supplierId)) {
        const newSup = {
          id: data.id || data.supplierId,
          name: data.name || trimmed,
          contact_name: data.contact_name || '',
          phone: data.phone || '',
          email: data.email || '',
          due_balance: data.due_balance || 0
        };

        // Update suppliers state
        setSuppliers(prev => {
          if (prev.some(s => String(s.id) === String(newSup.id))) return prev;
          return [...prev, newSup];
        });

        triggerAlert('success', `Supplier "${newSup.name}" created automatically!`);
        return newSup;
      }
    } catch (err) {
      console.error('Error auto-creating supplier:', err);
    }
    return null;
  };

  // Handle barcode scan / Enter press
  const handleBarcodeScan = async (rawCode) => {
    const code = (rawCode || '').trim();
    if (!code) return;
    setBarcodeInput('');

    // Lookup by SKU (exact) first, then by barcode field if exists
    const matched = productsList.find(
      p => p.sku && p.sku.toLowerCase() === code.toLowerCase()
    );

    if (!matched) {
      setBarcodeStatus({ type: 'error', msg: `❌ No product found for barcode: "${code}"` });
      setBarcodeLastScanned(code);
      setTimeout(() => setBarcodeStatus(null), 3000);
      return;
    }

    // Auto link or create supplier if none selected
    if (!poFormData.supplier_id && !selectedSupplierId) {
      const supName = matched.supplier_name ? matched.supplier_name.trim() : '';
      if (matched.supplier_id || supName) {
        let matchedSupplier = suppliers.find(s =>
          (matched.supplier_id && String(s.id) === String(matched.supplier_id)) ||
          (supName && s.name && s.name.trim().toLowerCase() === supName.toLowerCase())
        );
        if (matchedSupplier) {
          setSupplierSearch(matchedSupplier.name);
          setPoFormData(prev => ({ ...prev, supplier_id: String(matchedSupplier.id) }));
        } else if (supName) {
          const created = await createOrGetSupplier(supName);
          if (created) {
            setSupplierSearch(created.name);
            setPoFormData(prev => ({ ...prev, supplier_id: String(created.id) }));
          }
        }
      }
    }

    // Check if already in cart — increment qty instead
    const existingIdx = poCart.findIndex(
      c => String(c.product_id) === String(matched.id)
    );
    if (existingIdx >= 0) {
      setPoCart(prev => {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity_ordered: updated[existingIdx].quantity_ordered + 1
        };
        return updated;
      });
      setBarcodeStatus({ type: 'warn', msg: `+1 → ${matched.name} (qty updated in cart)` });
    } else {
      // Add as new cart item with qty 1
      const newItem = {
        product_id: matched.id,
        is_new: false,
        name: matched.name,
        sku: matched.sku,
        category: matched.category || '',
        cost_price: parseFloat(matched.current_cost || matched.cost_price || 0),
        selling_price: parseFloat(matched.price || matched.selling_price || 0),
        quantity_ordered: 1,
        expiry_date: null,
        unit: matched.unit || 'piece',
        low_stock_threshold: parseInt(matched.low_stock_threshold || 10)
      };
      setPoCart(prev => [...prev, newItem]);
      setBarcodeStatus({ type: 'success', msg: `✔ Added: ${matched.name} (SKU: ${matched.sku})` });
    }
    setBarcodeLastScanned(code);
    setTimeout(() => setBarcodeStatus(null), 2500);
    // Keep focus on barcode input for rapid scanning
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  // Track which cart item is being edited
  const [editingCartItemIndex, setEditingCartItemIndex] = useState(null);

  // Add product to PO cart
  const addToPoCart = () => {
    if (!poFormData.name || !poFormData.name.trim()) {
      triggerAlert('error', 'Product Name is required.');
      return;
    }
    if (!poFormData.cost_price || parseFloat(poFormData.cost_price) < 0) {
      triggerAlert('error', 'Please enter a valid Cost Price.');
      return;
    }
    const qty = parseFloat(poFormData.quantity_ordered);
    if (isNaN(qty) || qty <= 0) {
      triggerAlert('error', 'Please enter a valid Quantity.');
      return;
    }

    const trimmedName = poFormData.name.trim();
    const trimmedSku = poFormData.sku ? poFormData.sku.trim() : '';

    // Check if matching product already exists in productsList (by SKU or ID/Name)
    // When SKU is provided, match strictly by SKU so same-name products with different SKUs/expiry dates are distinct rows
    let matchedProduct = null;
    if (trimmedSku) {
      matchedProduct = productsList.find(p => p.sku && p.sku.trim().toLowerCase() === trimmedSku.toLowerCase());
    } else if (poFormData.product_id && !poFormData.is_new) {
      matchedProduct = productsList.find(p => String(p.id) === String(poFormData.product_id));
    } else if (trimmedName && !poFormData.is_new) {
      matchedProduct = productsList.find(p => p.name && p.name.trim().toLowerCase() === trimmedName.toLowerCase());
    }

    // Auto-generate SKU only for new products, not when matching existing items or editing
    let finalSku = trimmedSku || (matchedProduct ? matchedProduct.sku : '');
    if (!finalSku && editingCartItemIndex === null) {
      finalSku = 'SKU-' + trimmedName.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X') + '-' + Math.floor(100 + Math.random() * 900);
    }

    const newItem = {
      product_id: matchedProduct ? matchedProduct.id : null,
      is_new: !matchedProduct,
      name: trimmedName,
      sku: finalSku,
      category: poFormData.category || (matchedProduct ? (matchedProduct.category || '') : ''),
      cost_price: parseFloat(poFormData.cost_price),
      selling_price: parseFloat(poFormData.selling_price || (matchedProduct ? matchedProduct.price : 0) || 0),
      quantity_ordered: qty,
      expiry_date: poFormData.expiry_date || null,
      unit: poFormData.unit || (matchedProduct ? matchedProduct.unit : 'piece') || 'piece',
      low_stock_threshold: parseInt(poFormData.low_stock_threshold || (matchedProduct ? matchedProduct.low_stock_threshold : 10) || 10)
    };

    if (editingCartItemIndex !== null) {
      const updatedCart = [...poCart];
      updatedCart[editingCartItemIndex] = newItem;
      setPoCart(updatedCart);
      setEditingCartItemIndex(null);
      triggerAlert('success', 'Product updated in cart!');
    } else {
      setPoCart(prev => [...prev, newItem]);
      triggerAlert('success', 'Product added to cart!');
    }

    // Reset item form fields
    setProductSearch('');
    setPoFormData(prev => ({
      ...prev,
      product_id: '',
      is_new: false,
      name: '',
      sku: '',
      category: '',
      cost_price: '',
      selling_price: '',
      discount_percent: '',
      quantity_ordered: 1,
      expiry_date: '',
      unit: 'piece'
    }));
  };

  // Remove product from PO cart
  const removeFromPoCart = (index) => {
    setPoCart(prev => prev.filter((_, i) => i !== index));
    if (editingCartItemIndex === index) {
      cancelEditCartItem();
    }
  };

  // Edit product in PO cart
  const editCartItem = (index) => {
    const item = poCart[index];
    setEditingCartItemIndex(index);
    setProductSearch(item.name || '');

    const sp = parseFloat(item.selling_price || 0);
    const cp = parseFloat(item.cost_price || 0);
    let calculatedPct = '';
    if (sp > 0 && cp >= 0) {
      const p = (((sp - cp) / sp) * 100).toFixed(2);
      calculatedPct = parseFloat(p) !== 0 ? String(parseFloat(p)) : '0';
    }

    setPoFormData(prev => ({
      ...prev,
      product_id: item.product_id ? String(item.product_id) : '',
      is_new: item.is_new || false,
      name: item.name || '',
      sku: item.sku || '',
      category: item.category || '',
      cost_price: String(item.cost_price || ''),
      selling_price: String(item.selling_price || ''),
      discount_percent: calculatedPct,
      quantity_ordered: item.quantity_ordered || 1,
      expiry_date: item.expiry_date || '',
      unit: item.unit || 'piece'
    }));
  };

  // Cancel editing cart item
  const cancelEditCartItem = () => {
    setEditingCartItemIndex(null);
    setProductSearch('');
    setPoFormData(prev => ({
      ...prev,
      product_id: '',
      is_new: false,
      name: '',
      sku: '',
      category: '',
      cost_price: '',
      selling_price: '',
      discount_percent: '',
      quantity_ordered: 1,
      expiry_date: '',
      unit: 'piece'
    }));
  };

  // Calculate PO total from cart
  const calculatePOTotal = () => {
    return poCart.reduce((total, item) => {
      return total + (item.cost_price * item.quantity_ordered);
    }, 0);
  };

  // Receive verification form state
  const [receiveItems, setReceiveItems] = useState([]); // Array of { product_id, quantity_received, cost_price, product_name, sku }
  const [receiveNotes, setReceiveNotes] = useState('');

  // PO Filter (global PO list tab)
  const [poFilterStatus, setPoFilterStatus] = useState('all');
  const [poSearchTerm, setPoSearchTerm] = useState('');
  const [poPaymentAmount, setPoPaymentAmount] = useState('');

  // Supplier Profile - PO history filters
  const [profilePoFilter, setProfilePoFilter] = useState('all');   // 'all' | 'paid' | 'due'
  const [profilePoDateFrom, setProfilePoDateFrom] = useState('');
  const [profilePoDateTo, setProfilePoDateTo] = useState('');
  const [profilePoMonth, setProfilePoMonth] = useState('');         // 'YYYY-MM' format

  // Supplier Profile - Supplied Products search
  const [suppliedProductSearch, setSuppliedProductSearch] = useState('');

  // Directory Search Term
  const [directorySearchTerm, setDirectorySearchTerm] = useState('');

  // Pagination states
  const [supplierPage, setSupplierPage] = useState(1);
  const [poPage, setPoPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const itemsPerPage = 10;
  const poItemsPerPage = 20;
  const supplierItemsPerPage = 10;

  // Load baseline directory data
  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve suppliers.');
      const data = await response.json();
      setSuppliers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  // Load products list for PO creations
  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setProductsList(await response.json());
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  // Load purchase orders global list
  const fetchPurchaseOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/suppliers/purchase-orders`;
      if (poStartDate && poEndDate) {
        url += `?start_date=${poStartDate}&end_date=${poEndDate}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setPurchaseOrders(await response.json());
      }
    } catch (err) {
      console.error('Error fetching POs:', err);
    }
  };

  // Debounced PO fetch to prevent excessive API calls on date changes
  useEffect(() => {
    if (activeTab !== 'pos') return;

    const timeoutId = setTimeout(() => {
      fetchPurchaseOrders();
    }, 500); // 500ms debounce delay

    return () => clearTimeout(timeoutId);
  }, [poStartDate, poEndDate, activeTab]);

  const fetchFilteredPOItems = async () => {
    if (!poStartDate || !poEndDate) return;
    setFilteredPOLoading(true);
    setShowFilteredPOModal(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/suppliers/purchase-orders/filtered-items?start_date=${poStartDate}&end_date=${poEndDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to load filtered PO items.');
      const data = await response.json();
      setFilteredPOItemsData(data);
    } catch (err) {
      triggerAlert('error', err.message);
      setShowFilteredPOModal(false);
    } finally {
      setFilteredPOLoading(false);
    }
  };

  const handleSelectSupplier = (id) => {
    setSelectedSupplierIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllSuppliers = (e, currentSuppliers) => {
    if (e.target.checked) {
      const ids = currentSuppliers.map(s => s.id);
      setSelectedSupplierIds(prev => Array.from(new Set([...prev, ...ids])));
    } else {
      const ids = currentSuppliers.map(s => s.id);
      setSelectedSupplierIds(prev => prev.filter(id => !ids.includes(id)));
    }
  };

  const handleBulkDeleteSuppliers = async () => {
    if (selectedSupplierIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedSupplierIds.length} suppliers?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedSupplierIds })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to bulk delete suppliers');

      triggerAlert('success', data.message || 'Suppliers deleted successfully');
      setSelectedSupplierIds([]);
      fetchSuppliers();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleSelectPo = (id) => {
    setSelectedPoIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllPos = (e, currentPOs) => {
    if (e.target.checked) {
      const ids = currentPOs.map(po => po.id);
      setSelectedPoIds(prev => Array.from(new Set([...prev, ...ids])));
    } else {
      const ids = currentPOs.map(po => po.id);
      setSelectedPoIds(prev => prev.filter(id => !ids.includes(id)));
    }
  };

  // Load cost price logs global list
  const fetchCostLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/cost-price-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setCostLogs(await response.json());
      }
    } catch (err) {
      console.error('Error fetching cost logs:', err);
    }
  };

  // View cost price log details
  const viewCostLog = async (logId) => {
    setCostLogViewLoading(true);
    setShowCostLogViewModal(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/cost-price-logs/${logId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load cost price log details.');
      const data = await response.json();
      setSelectedCostLog(data);
    } catch (err) {
      triggerAlert('error', err.message);
      setShowCostLogViewModal(false);
    } finally {
      setCostLogViewLoading(false);
    }
  };

  // Delete cost price log
  const deleteCostLog = async (logId) => {
    if (!window.confirm('Are you sure you want to delete this cost price log? This action cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/cost-price-logs/${logId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete cost price log.');
      triggerAlert('success', 'Cost price log deleted successfully.');
      fetchCostLogs();
      if (showCostLogViewModal) {
        setShowCostLogViewModal(false);
        setSelectedCostLog(null);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // Initialize data on mount with lazy loading based on active tab
  useEffect(() => {
    const initData = async () => {
      setLoading(true);

      // Always fetch suppliers first (needed for all tabs)
      await fetchSuppliers();

      // Then fetch additional data based on active tab
      if (activeTab === 'pos') {
        await Promise.all([
          fetchProducts(),
          fetchPurchaseOrders()
        ]);
      } else if (activeTab === 'logs') {
        await fetchCostLogs();
      }

      setLoading(false);
    };
    initData();
  }, [activeTab]);

  // Sync profile when selected supplier ID changes
  useEffect(() => {
    if (selectedSupplierId) {
      loadProfileData(selectedSupplierId);
      // Reset profile-level filters on supplier switch
      setProfilePoFilter('all');
      setProfilePoDateFrom('');
      setProfilePoDateTo('');
      setProfilePoMonth('');
    } else {
      setProfileData(null);
    }
  }, [selectedSupplierId]);

  // Reset product search when supplier changes in PO form
  useEffect(() => {
    if (poFormData.supplier_id) {
      setProductSearch('');
      setShowProductSuggestions(false);
    }
  }, [poFormData.supplier_id]);

  // Close desk-product dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (deskProductDropdownRef.current && !deskProductDropdownRef.current.contains(e.target)) {
        setShowDeskProductDropdown(false);
      }
    };
    if (showDeskProductDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showDeskProductDropdown]);

  // F2 hotkey → focus barcode scanner input (when PO modal is open)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F2' && showAddPoModal) {
        e.preventDefault();
        setBarcodeMode(true);
        setTimeout(() => barcodeInputRef.current?.focus(), 80);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAddPoModal]);

  // Load profile data and stats
  const loadProfileData = async (supplierId) => {
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${supplierId}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve supplier profile details.');
      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      triggerAlert('error', err.message);
      setSelectedSupplierId(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // CREATE SUPPLIER
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      triggerAlert('error', 'Supplier name is required.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to create supplier.');

      triggerAlert('success', 'Supplier created successfully!');
      setShowAddModal(false);
      resetForm();
      fetchSuppliers();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // EDIT SUPPLIER OPEN
  const openEdit = (supplier) => {
    setCurrentSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || ''
    });
    setShowEditModal(true);
  };

  // UPDATE SUPPLIER
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${currentSupplier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update supplier.');

      triggerAlert('success', 'Supplier updated successfully!');
      setShowEditModal(false);
      resetForm();
      fetchSuppliers();
      if (selectedSupplierId === currentSupplier.id) {
        loadProfileData(currentSupplier.id);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // DELETE SUPPLIER
  const handleDelete = async (supplierId) => {
    if (!window.confirm('Are you sure you want to delete this supplier? This will also remove associated POs and logs.')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${supplierId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete supplier.');

      triggerAlert('success', 'Supplier deleted successfully!');
      setSelectedSupplierId(null);
      fetchSuppliers();
      fetchPurchaseOrders();
      fetchCostLogs();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_name: '',
      email: '',
      phone: ''
    });
    setCurrentSupplier(null);
  };

  // OPEN PO CREATION MODAL
  const [supplierSearch, setSupplierSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

  // ── MASTER CATALOG (super admin supplier products) ──────────────────────
  const [masterCatalogProducts, setMasterCatalogProducts] = useState([]);
  const [masterProductNameInput, setMasterProductNameInput] = useState('');
  const [showMasterProductSuggestions, setShowMasterProductSuggestions] = useState(false);

  // Distinct supplier names from super admin Supplier Products Catalog
  const [masterSupplierNames, setMasterSupplierNames] = useState([]);
  // Distinct categories from super admin Supplier Products Catalog
  const [masterCategories, setMasterCategories] = useState([]);

  // Fetch all distinct supplier names from the master catalog (super admin)
  const fetchMasterSupplierNames = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/master-supplier-products/suppliers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setMasterSupplierNames(data);
    } catch (e) {
      // silently fail — supplier names are optional hint
    }
  };

  // Fetch all distinct categories from the master catalog (super admin)
  const fetchMasterCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/master-supplier-products/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setMasterCategories(data);
    } catch (e) {
      // silently fail
    }
  };

  // Fetch master catalog products filtered by supplier name or general catalog
  const fetchMasterCatalogForSupplier = async (supplierName) => {
    try {
      const token = localStorage.getItem('token');
      const url = supplierName && supplierName.trim()
        ? `${API_BASE_URL}/master-supplier-products?supplier_name=${encodeURIComponent(supplierName.trim())}`
        : `${API_BASE_URL}/master-supplier-products?limit=200`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      setMasterCatalogProducts(list);
    } catch (e) {
      setMasterCatalogProducts([]);
    }
  };

  const openAddPo = (supplierId = '') => {
    const existingSupplier = suppliers.find(s => String(s.id) === String(supplierId));
    const supName = existingSupplier ? existingSupplier.name : '';
    setSupplierSearch(supName);
    setProductSearch('');
    setShowSupplierSuggestions(false);
    setShowProductSuggestions(false);
    // Load master catalog supplier names & categories so they appear in dropdowns
    fetchMasterSupplierNames();
    fetchMasterCategories();
    fetchMasterCatalogForSupplier(supName);
    setIsEditPoMode(false);
    setPoCart([]);
    setEditingCartItemIndex(null);
    const today = new Date().toISOString().split('T')[0];
    setPoFormData({
      supplier_id: supplierId,
      order_date: today,
      notes: '',
      product_id: '',
      is_new: false,
      name: '',
      sku: '',
      category: '',
      cost_price: '',
      selling_price: '',
      discount_percent: '',
      quantity_ordered: 1,
      expiry_date: '',
      unit: 'piece',
      low_stock_threshold: '10',
      payment_basis: 'cash',
      paid_amount: '',
      received_date: ''
    });
    setShowAddPoModal(true);
    // Reset barcode scanner for fresh session
    setBarcodeMode(false);
    setBarcodeInput('');
    setBarcodeStatus(null);
    setBarcodeLastScanned(null);
  };


  const handlePoProductChange = async (productId) => {
    if (productId === 'new_product') {
      setPoFormData(prev => ({
        ...prev,
        product_id: '',
        is_new: true,
        name: '',
        sku: '',
        category: '',
        cost_price: '',
        selling_price: '',
        discount_percent: '',
        expiry_date: '',
        unit: 'piece',
        low_stock_threshold: '10'
      }));
      // Pre-fetch master catalog
      const supName = supplierSearch.trim();
      fetchMasterCatalogForSupplier(supName);
      setShowMasterProductSuggestions(true);
    } else {
      const prod = productsList.find(p => String(p.id) === String(productId));
      if (prod) {
        let autoCategory = prod.category || '';
        if (!autoCategory && prod.name) {
          const matchedMaster = masterCatalogProducts.find(
            mp => mp.product_name && mp.product_name.trim().toLowerCase() === prod.name.trim().toLowerCase()
          );
          if (matchedMaster && matchedMaster.category) {
            autoCategory = matchedMaster.category;
          }
        }

        const sp = parseFloat(prod.price || 0);
        const cp = prod.cost_price !== undefined && prod.cost_price !== null ? parseFloat(prod.cost_price) : parseFloat(prev.cost_price || 0);
        let calculatedPct = '';
        if (sp > 0 && cp >= 0) {
          const p = (((sp - cp) / sp) * 100).toFixed(2);
          calculatedPct = parseFloat(p) !== 0 ? String(parseFloat(p)) : '0';
        }

        setPoFormData(prev => ({
          ...prev, // Keep existing form data
          product_id: productId,
          is_new: false,
          name: prod.name,
          sku: prod.sku,
          category: autoCategory,
          cost_price: prod.cost_price !== undefined && prod.cost_price !== null ? prod.cost_price : prev.cost_price,
          selling_price: prod.price,
          discount_percent: calculatedPct,
          expiry_date: prod.expiry_date || '',
          unit: prod.unit || 'piece',
          low_stock_threshold: prod.low_stock_threshold || '10'
        }));

        // If product has a supplier (by ID or by name) and supplier is not already locked in URL
        const supName = prod.supplier_name ? prod.supplier_name.trim() : '';
        if ((prod.supplier_id || supName) && !selectedSupplierId) {
          // Check if supplier already exists in suppliers list
          let matchedSupplier = suppliers.find(s =>
            (prod.supplier_id && String(s.id) === String(prod.supplier_id)) ||
            (supName && s.name && s.name.trim().toLowerCase() === supName.toLowerCase())
          );

          if (matchedSupplier) {
            setSupplierSearch(matchedSupplier.name);
            setPoFormData(prev => ({ ...prev, supplier_id: String(matchedSupplier.id) }));
          } else if (supName) {
            // Auto create new supplier on-the-fly!
            const created = await createOrGetSupplier(supName);
            if (created) {
              setSupplierSearch(created.name);
              setPoFormData(prev => ({ ...prev, supplier_id: String(created.id) }));
            }
          }
        }
      } else {
        setPoFormData(prev => ({
          ...prev,
          product_id: '',
          is_new: false,
          name: '',
          sku: '',
          category: '',
          cost_price: '',
          selling_price: '',
          discount_percent: '',
          expiry_date: '',
          unit: 'piece',
          low_stock_threshold: '10'
        }));
      }
    }
  };

  const openEditPo = async (po) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${po.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Could not retrieve PO details for editing.');
      const poDetails = await response.json();

      setSelectedPo(poDetails);
      const existingSupplier = suppliers.find(s => String(s.id) === String(poDetails.supplier_id));
      setSupplierSearch(existingSupplier ? existingSupplier.name : '');
      setProductSearch('');
      setShowSupplierSuggestions(false);
      setShowProductSuggestions(false);
      setEditingCartItemIndex(null);

      // Store previous total amount for comparison
      const previousTotal = parseFloat(poDetails.total_amount || 0);

      setPoFormData({
        supplier_id: String(poDetails.supplier_id),
        order_date: poDetails.order_date ? poDetails.order_date.split(/T|\s/)[0] : new Date().toISOString().split('T')[0],
        notes: poDetails.notes || '',
        product_id: '',
        is_new: false,
        name: '',
        sku: '',
        category: '',
        cost_price: '',
        selling_price: '',
        discount_percent: '',
        quantity_ordered: 1,
        unit: 'piece',
        low_stock_threshold: '10',
        payment_basis: poDetails.payment_basis || 'cash',
        paid_amount: poDetails.paid_amount || '',
        received_date: poDetails.received_date ? poDetails.received_date.split(/T|\s/)[0] : new Date().toISOString().split('T')[0],
        previous_total: previousTotal
      });

      // Reset editing state
      setEditingCartItemIndex(null);
      setProductSearch('');

      setPoCart(poDetails.items.map(item => ({
        product_id: item.product_id,
        is_new: false,
        name: item.product_name,
        sku: item.product_sku,
        category: item.product_category || '',
        quantity_ordered: item.quantity_ordered,
        cost_price: item.cost_price,
        selling_price: item.selling_price || 0,
        unit: item.unit || 'piece'
      })));

      setIsEditPoMode(true);
      setShowAddPoModal(true);
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // SUBMIT PURCHASE ORDER
  const handlePoSubmit = async (e, poStatus = 'draft') => {
    e.preventDefault();

    // Check if there's a pending edit that hasn't been saved to cart
    if (editingCartItemIndex !== null) {
      triggerAlert('error', 'Please click "Update Product in Cart" to save your changes before submitting the order.');
      return;
    }

    let finalSupplierId = poFormData.supplier_id;
    if (!finalSupplierId && supplierSearch.trim()) {
      const autoCreated = await createOrGetSupplier(supplierSearch.trim());
      if (autoCreated) {
        finalSupplierId = String(autoCreated.id);
        setPoFormData(prev => ({ ...prev, supplier_id: finalSupplierId }));
      }
    }

    if (!finalSupplierId) {
      triggerAlert('error', 'Supplier selection is required.');
      return;
    }

    if (poCart.length === 0) {
      triggerAlert('error', 'Please add at least one product to the cart.');
      return;
    }

    if (poFormData.payment_basis === 'credit') {
      const paidAmt = parseFloat(poFormData.paid_amount || 0);
      const totalAmt = calculatePOTotal();
      if (isNaN(paidAmt) || paidAmt < 0) {
        triggerAlert('error', 'Initial Paid Amount must be a valid non-negative number.');
        return;
      }
      if (paidAmt > totalAmt) {
        triggerAlert('error', `Initial Paid Amount cannot exceed the total PO amount of ${formatCurrency(totalAmt)}.`);
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const url = isEditPoMode && selectedPo
        ? `${API_BASE_URL}/suppliers/purchase-orders/${selectedPo.id}`
        : `${API_BASE_URL}/suppliers/purchase-orders`;

      const response = await fetch(url, {
        method: isEditPoMode && selectedPo ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          supplier_id: parseInt(finalSupplierId),
          order_date: poFormData.order_date || null,
          received_date: poFormData.received_date || null,
          notes: poFormData.notes,
          status: poStatus,
          payment_basis: poFormData.payment_basis,
          paid_amount: poFormData.payment_basis === 'credit' ? parseFloat(poFormData.paid_amount || 0) : undefined,
          items: poCart
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || `Failed to ${isEditPoMode ? 'update' : 'create'} Purchase Order.`);

      triggerAlert('success', `Purchase Order ${isEditPoMode ? 'updated' : 'created'} successfully as ${poStatus}!`);
      setShowAddPoModal(false);
      setIsEditPoMode(false);
      setSupplierSearch('');
      setProductSearch('');
      setPoCart([]);
      setPoFormData({
        supplier_id: '',
        order_date: '',
        notes: '',
        product_id: '',
        is_new: false,
        name: '',
        sku: '',
        category: '',
        cost_price: '',
        selling_price: '',
        quantity_ordered: 1,
        unit: 'piece',
        low_stock_threshold: '10',
        payment_basis: 'cash',
        paid_amount: '',
        received_date: ''
      });
      fetchPurchaseOrders();
      fetchProducts(); // Refresh products cache
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // OPEN PO DETAILS MODAL
  const openPoDetails = async (poId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${poId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Could not retrieve PO details.');
      const po = await response.json();
      setSelectedPo(po);
      setShowPoDetailsModal(true);
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // UPDATE PO STATUS (ORDERED OR CANCELLED)
  const updatePoStatus = async (poId, status) => {
    if (status === 'cancelled' && !window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${poId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update PO status.');

      triggerAlert('success', `PO Status updated to ${status}!`);
      fetchPurchaseOrders();
      if (selectedPo && selectedPo.id === poId) {
        openPoDetails(poId);
      }
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // BULK PLACE ORDER FOR MULTIPLE DRAFT POs
  const handleBulkPlaceOrder = async () => {
    const draftPOs = filteredPOs.filter(po => selectedPoIds.includes(po.id) && po.status === 'draft');
    if (draftPOs.length === 0) {
      triggerAlert('error', 'Please select at least one draft purchase order to place.');
      return;
    }

    if (!window.confirm(`Are you sure you want to receive ${draftPOs.length} order(s)?`)) return;

    try {
      const token = localStorage.getItem('token');
      const promises = draftPOs.map(po =>
        fetch(`${API_BASE_URL}/suppliers/purchase-orders/${po.id}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'received' })
        })
      );

      const responses = await Promise.all(promises);
      const failedUpdates = [];

      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          failedUpdates.push(draftPOs[i].id);
        }
      }

      if (failedUpdates.length === 0) {
        triggerAlert('success', `${draftPOs.length} order(s) received successfully!`);
      } else if (failedUpdates.length === draftPOs.length) {
        triggerAlert('error', 'Failed to receive all orders.');
      } else {
        triggerAlert('warning', `${draftPOs.length - failedUpdates.length} order(s) received successfully. ${failedUpdates.length} failed.`);
      }

      setSelectedPoIds([]);
      fetchPurchaseOrders();
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleDeletePo = (po) => {
    setPoToDelete(po);
    setShowPoDeleteModal(true);
  };

  const handleBulkDeletePos = () => {
    if (selectedPoIds.length === 0) return;
    setPoToDelete(null);
    setShowPoDeleteModal(true);
  };

  const handleConfirmDeletePo = async () => {
    const ids = poToDelete ? [poToDelete.id] : [...selectedPoIds];
    if (ids.length === 0) return;

    setPoDeleting(true);
    const totalItems = ids.length;
    setPoDeleteProgress({
      active: true,
      current: 0,
      total: totalItems,
      percent: 0,
      currentName: poToDelete ? `PO #${poToDelete.id}` : `Starting deletion of ${totalItems} purchase order(s)...`
    });

    const chunkSize = 20;
    let successCount = 0;
    let failureCount = 0;
    const token = localStorage.getItem('token');

    try {
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        setPoDeleteProgress({
          active: true,
          current: i,
          total: totalItems,
          percent: Math.round((i / totalItems) * 100),
          currentName: `Deleting PO #${chunk[0]}...`
        });

        const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/bulk-delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ ids: chunk })
        });

        if (response.ok) {
          const resData = await response.json();
          successCount += resData.success_count || chunk.length;
          failureCount += resData.failure_count || 0;
        } else {
          failureCount += chunk.length;
        }

        const processed = Math.min(i + chunkSize, totalItems);
        setPoDeleteProgress({
          active: true,
          current: processed,
          total: totalItems,
          percent: Math.round((processed / totalItems) * 100),
          currentName: `Processed ${processed} of ${totalItems} purchase orders`
        });
      }

      setPoDeleteProgress({
        active: true,
        current: totalItems,
        total: totalItems,
        percent: 100,
        currentName: 'Completed!'
      });

      if (failureCount > 0) {
        triggerAlert(
          'warning',
          `Deleted ${successCount} purchase order(s). ${failureCount} order(s) could not be deleted.`
        );
      } else {
        triggerAlert('success', `Successfully deleted ${successCount || totalItems} purchase order(s)!`);
      }

      setSelectedPoIds(prev => prev.filter(id => !ids.includes(id)));

      setTimeout(() => {
        setShowPoDeleteModal(false);
        setPoToDelete(null);
        setPoDeleteProgress({ active: false, current: 0, total: 0, percent: 0, currentName: '' });
        fetchPurchaseOrders();
        fetchProducts();
        if (selectedSupplierId) {
          loadProfileData(selectedSupplierId);
        }
      }, 600);

    } catch (err) {
      triggerAlert('error', err.message || 'Failed to delete purchase orders.');
    } finally {
      setPoDeleting(false);
    }
  };

  // OPEN RECEIVE MODAL
  const openReceiveModal = (po) => {
    setSelectedPo(po);
    setReceiveItems(po.items.map(item => {
      const qtyOrdered = item.quantity_ordered !== undefined ? item.quantity_ordered : (item.quantity !== undefined ? item.quantity : 0);
      const costPrice = item.cost_price !== undefined ? item.cost_price : (item.unit_price !== undefined ? item.unit_price : 0);
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.product_sku,
        quantity_ordered: qtyOrdered,
        quantity_received: qtyOrdered, // Default match ordered qty
        cost_price: parseFloat(costPrice),
        selling_price: parseFloat(item.selling_price || 0),
        expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : ''
      };
    }));
    setReceiveNotes('');
    setShowReceiveModal(true);
  };

  // SUBMIT CONFIRMED RECEIVE
  const handleConfirmReceive = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${selectedPo.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'received',
          notes: receiveNotes,
          items: receiveItems.map(item => ({
            product_id: item.product_id,
            quantity_received: parseInt(item.quantity_received || 0),
            cost_price: parseFloat(item.cost_price || 0),
            selling_price: parseFloat(item.selling_price || 0),
            expiry_date: item.expiry_date || null
          }))
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to process PO receipt.');

      triggerAlert('success', 'Purchase Order successfully received. Inventory stock and cost price logs updated!');
      setShowReceiveModal(false);
      setShowPoDetailsModal(false);
      fetchPurchaseOrders();
      fetchCostLogs();
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handlePayPoDue = async (e) => {
    e.preventDefault();
    if (!poPaymentAmount || parseFloat(poPaymentAmount) <= 0) {
      triggerAlert('error', 'Please enter a valid payment amount.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${selectedPo.id}/pay`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: parseFloat(poPaymentAmount) })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to record payment.');
      triggerAlert('success', 'Payment recorded successfully!');
      setPoPaymentAmount('');
      openPoDetails(selectedPo.id);
      fetchPurchaseOrders();
      fetchSuppliers();
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleReceivedSaleChange = (idx, val) => {
    const updated = [...receiveItems];
    updated[idx].selling_price = parseFloat(val) || 0.00;
    setReceiveItems(updated);
  };

  const handleReceivedExpiryChange = (idx, val) => {
    const updated = [...receiveItems];
    updated[idx].expiry_date = val || '';
    setReceiveItems(updated);
  };

  // DELETE PRODUCT FROM PO
  const handleDeletePoItem = async (poId, productId) => {
    if (!window.confirm('Are you sure you want to delete this product from the purchase order?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${poId}/items/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to remove product from Purchase Order.');

      triggerAlert('success', 'Product removed from Purchase Order successfully.');
      openPoDetails(poId); // Refresh details modal
      fetchPurchaseOrders(); // Refresh global PO list
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId); // Refresh profile if open
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedExpiredProduct || !returnFormData.quantity || parseInt(returnFormData.quantity) <= 0) {
      triggerAlert('error', 'Please enter a valid quantity.');
      return;
    }
    const unitCost = returnFormData.unit_cost !== '' ? parseFloat(returnFormData.unit_cost) : (parseFloat(selectedExpiredProduct.cost_price) || 0);
    const qty = parseInt(returnFormData.quantity);
    const totalVal = qty * unitCost;
    const refundAmt = returnFormData.refund_amount !== '' ? parseFloat(returnFormData.refund_amount) : (returnFormData.settlement_type === 'deduct_due' ? totalVal : 0);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${selectedSupplierId}/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: selectedExpiredProduct.id,
          quantity: qty,
          action_type: 'return',
          unit_cost: unitCost,
          reason: returnFormData.reason || 'Expired',
          settlement_type: returnFormData.settlement_type || 'none',
          refund_amount: refundAmt,
          reference_no: returnFormData.reference_no || undefined,
          notes: returnFormData.notes
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to complete return.');

      triggerAlert('success', `Product return registered successfully! Ref: ${resData.reference_no || 'Recorded'}`);
      setShowReturnModal(false);
      setReturnFormData({
        quantity: '',
        unit_cost: '',
        reason: 'Expired',
        settlement_type: 'deduct_due',
        refund_amount: '',
        reference_no: '',
        notes: ''
      });
      setSelectedExpiredProduct(null);
      loadProfileData(selectedSupplierId);
      fetchProducts(); // Refresh products
      fetchSuppliers(); // Refresh suppliers due balance
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleReplaceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedExpiredProduct || !replaceFormData.quantity || parseInt(replaceFormData.quantity) <= 0 || !replaceFormData.new_expiry_date) {
      triggerAlert('error', 'Please fill out all required fields.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${selectedSupplierId}/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: selectedExpiredProduct.id,
          quantity: parseInt(replaceFormData.quantity),
          action_type: 'replace',
          reason: replaceFormData.reason || 'Product Replacement',
          settlement_type: 'replacement',
          new_expiry_date: replaceFormData.new_expiry_date,
          notes: replaceFormData.notes
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to complete replacement.');

      triggerAlert('success', 'Product replacement recorded and new expiry date applied!');
      setShowReplaceModal(false);
      setReplaceFormData({ quantity: '', new_expiry_date: '', reason: 'Product Replacement', notes: '' });
      setSelectedExpiredProduct(null);
      loadProfileData(selectedSupplierId);
      fetchProducts(); // Refresh products
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // Universal Return Desk Submission
  const handleUniversalDeskSubmit = async (e) => {
    e.preventDefault();
    if (!deskFormData.product_id) {
      triggerAlert('error', 'Please select a product to return or replace.');
      return;
    }
    const qty = parseInt(deskFormData.quantity);
    if (isNaN(qty) || qty <= 0) {
      triggerAlert('error', 'Please enter a valid positive quantity.');
      return;
    }
    const unitCost = parseFloat(deskFormData.unit_cost) || 0;
    const totalVal = qty * unitCost;
    const refundAmt = deskFormData.refund_amount !== '' ? parseFloat(deskFormData.refund_amount) : (deskFormData.settlement_type === 'deduct_due' ? totalVal : 0);

    if (deskFormData.action_type === 'replace' && !deskFormData.new_expiry_date) {
      triggerAlert('error', 'Please provide a new expiry date for the replacement batch.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${selectedSupplierId}/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: parseInt(deskFormData.product_id),
          quantity: qty,
          action_type: deskFormData.action_type,
          unit_cost: unitCost,
          reason: deskFormData.reason || 'Other',
          settlement_type: deskFormData.settlement_type,
          refund_amount: refundAmt,
          reference_no: deskFormData.reference_no || undefined,
          new_expiry_date: deskFormData.action_type === 'replace' ? deskFormData.new_expiry_date : null,
          notes: deskFormData.notes
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to submit return.');

      triggerAlert('success', `Supplier return voucher ${resData.reference_no || 'Created'} processed successfully!`);
      // Reset desk form
      setDeskFormData({
        product_id: '',
        action_type: 'return',
        quantity: '1',
        unit_cost: '',
        reason: 'Expired',
        settlement_type: 'deduct_due',
        refund_amount: '',
        reference_no: '',
        new_expiry_date: '',
        notes: ''
      });
      setDeskProductSearch('');
      loadProfileData(selectedSupplierId);
      fetchProducts();
      fetchSuppliers();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // Bulk Return / Replace Submission
  const handleBulkReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedExpiryItemIds || selectedExpiryItemIds.length === 0) {
      triggerAlert('error', 'No products selected for bulk action.');
      return;
    }

    setBulkReturnProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const itemsToProcess = (profileData.expiredProducts || [])
        .filter(p => selectedExpiryItemIds.includes(p.id))
        .map(p => ({
          product_id: p.id,
          quantity: p.stock_quantity > 0 ? p.stock_quantity : 1,
          action_type: bulkReturnAction,
          unit_cost: parseFloat(p.cost_price || 0),
          reason: bulkReturnReason,
          new_expiry_date: bulkReturnAction === 'replace' ? bulkReturnNewExpiry : null,
          notes: bulkReturnNotes
        }));

      const response = await fetch(`${API_BASE_URL}/suppliers/${selectedSupplierId}/returns/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action_type: bulkReturnAction,
          settlement_type: bulkReturnSettlement,
          reason: bulkReturnReason,
          notes: bulkReturnNotes,
          new_expiry_date: bulkReturnAction === 'replace' ? bulkReturnNewExpiry : null,
          items: itemsToProcess
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to process bulk returns.');

      triggerAlert('success', resData.message || 'Bulk return action completed successfully!');
      setShowBulkReturnModal(false);
      setSelectedExpiryItemIds([]);
      setBulkReturnNotes('');
      setBulkReturnNewExpiry('');
      loadProfileData(selectedSupplierId);
      fetchProducts();
      fetchSuppliers();
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setBulkReturnProcessing(false);
    }
  };

  const handleDeleteLog = async (log) => {
    const isReturn = log.action_type === 'return';
    const isDueDeduct = (log.settlement_type === 'deduct_due') && parseFloat(log.refund_amount || 0) > 0;

    let confirmMsg = `Are you sure you want to delete this ${log.action_type} record (#${log.reference_no || log.id})?`;
    if (isReturn) {
      confirmMsg += `\n• Stock will be restored (+${log.quantity} units).`;
    }
    if (isDueDeduct) {
      confirmMsg += `\n• Supplier due balance will be restored (+${formatCurrency(log.refund_amount)}).`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/returns/${log.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete log.');

      triggerAlert('success', 'Return record deleted and stock/ledger balances reverted successfully!');
      loadProfileData(selectedSupplierId);
      fetchProducts();
      fetchSuppliers();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleEditLogSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLog || !editLogFormData.quantity || parseInt(editLogFormData.quantity) <= 0) {
      triggerAlert('error', 'Please enter a valid quantity.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const qty = parseInt(editLogFormData.quantity);
      const unitCost = editLogFormData.unit_cost !== '' ? parseFloat(editLogFormData.unit_cost) : parseFloat(selectedLog.unit_cost || 0);
      const refundAmt = editLogFormData.refund_amount !== '' ? parseFloat(editLogFormData.refund_amount) : (editLogFormData.settlement_type === 'deduct_due' ? (qty * unitCost) : 0);

      const response = await fetch(`${API_BASE_URL}/suppliers/returns/${selectedLog.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          quantity: qty,
          unit_cost: unitCost,
          reason: editLogFormData.reason,
          settlement_type: editLogFormData.settlement_type,
          refund_amount: refundAmt,
          notes: editLogFormData.notes,
          new_expiry_date: selectedLog.action_type === 'replace' ? editLogFormData.new_expiry_date : undefined
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update log.');

      triggerAlert('success', 'Return entry updated and inventory/ledger adjusted successfully!');
      setShowEditLogModal(false);
      setSelectedLog(null);
      setEditLogFormData({
        quantity: '',
        unit_cost: '',
        reason: 'Expired',
        settlement_type: 'none',
        refund_amount: '',
        notes: '',
        new_expiry_date: ''
      });
      loadProfileData(selectedSupplierId);
      fetchProducts();
      fetchSuppliers();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const openDebitNoteSlip = (log) => {
    setSelectedDebitNoteLog(log);
    setShowDebitNoteModal(true);
  };

  const handleSaveProductEdit = async (e) => {
    e.preventDefault();
    if (!editingProductId) return;

    setUpdatingProduct(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products/${editingProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: productEditForm.name,
          sku: productEditForm.sku,
          cost_price: parseFloat(productEditForm.cost_price),
          price: parseFloat(productEditForm.price),
          stock_quantity: parseFloat(productEditForm.stock_quantity),
          category: productEditForm.category,
          unit: productEditForm.unit || 'piece'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update product.');

      triggerAlert('success', data.message || 'Product updated successfully.');
      setShowEditProductModal(false);
      setEditingProductId(null);

      // Refresh products list and reload profile data
      await fetchProducts();
      if (selectedSupplierId) {
        await loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setUpdatingProduct(false);
    }
  };

  const handleSupplierCsvUpload = async (e) => {
    e.preventDefault();
    if (!supplierCsvFile) {
      triggerAlert('error', 'Please select a CSV file.');
      return;
    }

    setSupplierCsvUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('csv_file', supplierCsvFile);

      const response = await fetch(`${API_BASE_URL}/products/bulk-upload?supplier_id=${selectedSupplierId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to upload CSV.');

      // Show detailed summary/alerts
      if (resData.error_count > 0 && resData.errors && resData.errors.length > 0) {
        const errorMsg = `${resData.message}\n\nErrors:\n${resData.errors.slice(0, 5).join('\n')}`;
        triggerAlert('error', errorMsg);
      } else {
        triggerAlert('success', resData.message || 'Supplied products imported successfully!');
      }

      setShowSupplierCsvModal(false);
      setSupplierCsvFile(null);

      // Reload profile data & baseline products
      await Promise.all([
        loadProfileData(selectedSupplierId),
        fetchProducts()
      ]);
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSupplierCsvUploading(false);
    }
  };

  // Handle bulk supplier CSV upload for Add Supplier modal
  const handleBulkSupplierCsvUpload = async (e) => {
    e.preventDefault();
    if (!supplierCsvFile) {
      triggerAlert('error', 'Please select a CSV file.');
      return;
    }

    setSupplierCsvUploading(true);
    setSupplierCsvUploadProgress(0);
    setSupplierCsvUploadCurrentRow(0);
    setSupplierCsvUploadTotalRows(0);
    setSupplierCsvUploadStatus('Reading CSV file...');

    try {
      const text = await supplierCsvFile.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row.');
      }

      // Set total rows for progress tracking
      const totalRows = lines.length - 1; // Exclude header
      setSupplierCsvUploadTotalRows(totalRows);
      setSupplierCsvUploadStatus('Parsing CSV header...');

      // Parse header row
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));

      // Expected CSV columns: name, contact_name, email, phone
      const expectedColumns = ['name', 'contact_name', 'email', 'phone'];

      // Find column indices
      const colIndices = {};
      expectedColumns.forEach(col => {
        const idx = headers.findIndex(h => h.includes(col));
        colIndices[col] = idx >= 0 ? idx : -1;
      });

      // Validate required columns
      if (colIndices.name === -1) {
        throw new Error('CSV must contain column: name');
      }

      const suppliersToCreate = [];
      const errors = [];

      setSupplierCsvUploadStatus('Processing supplier rows...');

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        // Update progress
        setSupplierCsvUploadCurrentRow(i);
        const progress = ((i - 1) / totalRows) * 50; // First 50% for parsing
        setSupplierCsvUploadProgress(progress);
        setSupplierCsvUploadStatus(`Processing row ${i} of ${totalRows}...`);

        const values = lines[i].split(',').map(v => v.trim());

        // Skip rows that don't have enough columns
        if (values.length < Math.max(...Object.values(colIndices).filter(idx => idx >= 0)) + 1) {
          errors.push(`Row ${i + 1}: Not enough columns in row`);
          continue;
        }

        try {
          const name = colIndices.name >= 0 && colIndices.name < values.length ? values[colIndices.name] : '';
          const contactName = colIndices.contact_name >= 0 && colIndices.contact_name < values.length ? values[colIndices.contact_name] : '';
          const email = colIndices.email >= 0 && colIndices.email < values.length ? values[colIndices.email] : '';
          const phone = colIndices.phone >= 0 && colIndices.phone < values.length ? values[colIndices.phone] : '';

          if (!name) {
            errors.push(`Row ${i + 1}: Supplier name is required`);
            continue;
          }

          // Check if supplier already exists
          const nameNormalized = name.toLowerCase().trim();
          const existingSupplier = suppliers.find(s => {
            const supplierNameInSystem = s.name.toLowerCase().trim();
            return supplierNameInSystem === nameNormalized ||
              supplierNameInSystem.includes(nameNormalized) ||
              nameNormalized.includes(supplierNameInSystem);
          });

          if (existingSupplier) {
            errors.push(`Row ${i + 1}: Supplier "${name}" already exists`);
            continue;
          }

          suppliersToCreate.push({
            name,
            contact_name: contactName || '',
            email: email || '',
            phone: phone || ''
          });
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err.message}`);
        }
      }

      if (suppliersToCreate.length === 0) {
        throw new Error('No valid suppliers found in CSV');
      }

      // Create suppliers
      setSupplierCsvUploadStatus('Creating suppliers...');
      let createdCount = 0;
      let failedCount = 0;
      const token = localStorage.getItem('token');

      for (let i = 0; i < suppliersToCreate.length; i++) {
        const supplierData = suppliersToCreate[i];

        // Update progress for creation phase (50% to 90%)
        const progress = 50 + ((i / suppliersToCreate.length) * 40);
        setSupplierCsvUploadProgress(progress);
        setSupplierCsvUploadStatus(`Creating supplier ${i + 1} of ${suppliersToCreate.length}...`);

        try {
          const response = await fetch(`${API_BASE_URL}/suppliers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(supplierData)
          });

          if (!response.ok) {
            let errorMessage = 'Failed to create supplier';
            try {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
              } else {
                const errorText = await response.text();
                errorMessage = `Server error (${response.status}): ${errorText.substring(0, 100)}`;
              }
            } catch (parseErr) {
              errorMessage = `Server error (${response.status})`;
            }
            throw new Error(errorMessage);
          }

          createdCount++;
        } catch (err) {
          failedCount++;
          errors.push(`Failed to create supplier "${supplierData.name}": ${err.message}`);
        }
      }

      // Show results
      setSupplierCsvUploadStatus('Completing upload...');
      setSupplierCsvUploadProgress(100);

      let message = `Successfully created ${createdCount} supplier(s)!`;
      if (failedCount > 0) {
        message += ` Failed to create ${failedCount} supplier(s).`;
      }
      if (errors.length > 0) {
        triggerAlert('warning', `${message}\n\nErrors:\n${errors.slice(0, 5).join('\n')}`);
      } else {
        triggerAlert('success', message);
      }

      // Refresh suppliers list
      fetchSuppliers();

      // Reset and close
      setSupplierCsvFile(null);
      setIsBulkSupplierMode(false);
      setShowAddModal(false);

    } catch (err) {
      console.error('Supplier CSV Upload Error:', err);
      triggerAlert('error', err.message);
    } finally {
      setSupplierCsvUploading(false);
      setSupplierCsvUploadProgress(0);
      setSupplierCsvUploadCurrentRow(0);
      setSupplierCsvUploadTotalRows(0);
      setSupplierCsvUploadStatus('');
    }
  };

  // Parse CSV and add products to PO cart
  const handlePoCsvUpload = async (e) => {
    e.preventDefault();
    if (!poCsvFile) {
      triggerAlert('error', 'Please select a CSV file.');
      return;
    }

    setPoCsvUploading(true);
    setCsvUploadProgress(0);
    setCsvUploadCurrentRow(0);
    setCsvUploadTotalRows(0);
    setCsvUploadStatus('Reading CSV file...');

    try {
      const text = await poCsvFile.text();
      const lines = text.split('\n').filter(line => line.trim());

      console.log('CSV Lines:', lines);
      console.log('Total lines:', lines.length);
      console.log('Available suppliers in system:', suppliers.map(s => ({ id: s.id, name: s.name })));

      if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row.');
      }

      // Set total rows for progress tracking
      const totalRows = lines.length - 1; // Exclude header
      setCsvUploadTotalRows(totalRows);
      setCsvUploadStatus('Parsing CSV header...');

      // Parse header row
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));
      console.log('Parsed headers:', headers);

      // Expected CSV columns: supplier_name, product_name, sku, category, cost_price, selling_price, quantity_ordered, expiry_date, unit
      const expectedColumns = ['supplier_name', 'product_name', 'sku', 'category', 'cost_price', 'selling_price', 'quantity_ordered', 'expiry_date', 'unit'];

      // Find column indices
      const colIndices = {};
      expectedColumns.forEach(col => {
        const idx = headers.findIndex(h => h.includes(col));
        colIndices[col] = idx >= 0 ? idx : -1;
      });
      console.log('Column indices:', colIndices);

      // Validate required columns
      if (colIndices.supplier_name === -1 || colIndices.product_name === -1 || colIndices.cost_price === -1 || colIndices.quantity_ordered === -1) {
        throw new Error('CSV must contain columns: supplier_name, product_name, cost_price, quantity_ordered');
      }

      const newItems = [];
      const errors = [];
      const newSuppliersCreated = [];

      setCsvUploadStatus('Processing product rows...');

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        // Update progress
        setCsvUploadCurrentRow(i);
        const progress = ((i - 1) / totalRows) * 100;
        setCsvUploadProgress(progress);
        setCsvUploadStatus(`Processing row ${i} of ${totalRows}...`);
        const values = lines[i].split(',').map(v => v.trim());
        console.log(`Row ${i + 1} values:`, values);
        console.log(`Row ${i + 1} values length: ${values.length}, colIndices:`, colIndices);

        // Skip rows that don't have enough columns
        if (values.length < Math.max(...Object.values(colIndices).filter(idx => idx >= 0)) + 1) {
          errors.push(`Row ${i + 1}: Not enough columns in row`);
          continue;
        }

        try {
          const supplierName = colIndices.supplier_name >= 0 && colIndices.supplier_name < values.length ? values[colIndices.supplier_name] : '';
          const productName = colIndices.product_name >= 0 && colIndices.product_name < values.length ? values[colIndices.product_name] : '';
          const costPrice = colIndices.cost_price >= 0 && colIndices.cost_price < values.length ? parseFloat(values[colIndices.cost_price]) : NaN;
          const quantity = colIndices.quantity_ordered >= 0 && colIndices.quantity_ordered < values.length ? parseFloat(values[colIndices.quantity_ordered]) : NaN;
          const sku = colIndices.sku >= 0 && colIndices.sku < values.length ? values[colIndices.sku] : '';
          const category = colIndices.category >= 0 && colIndices.category < values.length ? values[colIndices.category] : '';
          const sellingPrice = colIndices.selling_price >= 0 && colIndices.selling_price < values.length ? parseFloat(values[colIndices.selling_price]) : 0;
          const expiryDate = colIndices.expiry_date >= 0 && colIndices.expiry_date < values.length ? values[colIndices.expiry_date] : '';
          const unit = colIndices.unit >= 0 && colIndices.unit < values.length ? values[colIndices.unit] : 'piece';

          console.log(`Row ${i + 1} parsed:`, { supplierName, productName, costPrice, quantity });

          if (!productName) {
            errors.push(`Row ${i + 1}: Product name is required`);
            continue;
          }

          if (isNaN(costPrice) || costPrice < 0) {
            errors.push(`Row ${i + 1}: Invalid cost price`);
            continue;
          }

          if (isNaN(quantity) || quantity <= 0) {
            errors.push(`Row ${i + 1}: Invalid quantity`);
            continue;
          }

          // Check if product already exists in system (by SKU if provided, otherwise by Name)
          const trimmedProdName = productName.trim();
          const trimmedSkuVal = sku ? sku.trim() : '';

          let matchedProduct = null;
          if (trimmedSkuVal) {
            matchedProduct = productsList.find(p => p.sku && p.sku.trim().toLowerCase() === trimmedSkuVal.toLowerCase());
          } else if (trimmedProdName) {
            matchedProduct = productsList.find(p => p.name && p.name.trim().toLowerCase() === trimmedProdName.toLowerCase());
          }

          // Auto-generate SKU if not provided and not matched
          const finalSku = trimmedSkuVal || (matchedProduct ? matchedProduct.sku : `SKU-${trimmedProdName.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}-${Math.floor(100 + Math.random() * 900)}`);

          // Find supplier by name (more flexible matching)
          if (!supplierName || supplierName === '') {
            errors.push(`Row ${i + 1}: Supplier name is required or empty`);
            continue;
          }

          const supplierNameNormalized = supplierName.toLowerCase().trim();
          let supplier = suppliers.find(s => {
            const supplierNameInSystem = s.name.toLowerCase().trim();
            return supplierNameInSystem === supplierNameNormalized ||
              supplierNameInSystem.includes(supplierNameNormalized) ||
              supplierNameNormalized.includes(supplierNameInSystem);
          });
          console.log(`Row ${i + 1} looking for supplier: "${supplierName}" (normalized: "${supplierNameNormalized}"), found:`, supplier);

          // If supplier not found, create new supplier
          if (!supplier) {
            console.log(`Row ${i + 1}: Creating new supplier "${supplierName}"`);
            try {
              const token = localStorage.getItem('token');
              const response = await fetch(`${API_BASE_URL}/suppliers`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  name: supplierName,
                  contact_name: '',
                  email: '',
                  phone: ''
                })
              });

              if (!response.ok) {
                // Try to get error message from response
                let errorMessage = 'Failed to create supplier';
                try {
                  const contentType = response.headers.get('content-type');
                  if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                  } else {
                    const errorText = await response.text();
                    errorMessage = `Server error (${response.status}): ${errorText.substring(0, 100)}`;
                  }
                } catch (parseErr) {
                  errorMessage = `Server error (${response.status})`;
                }
                throw new Error(errorMessage);
              }

              const resData = await response.json();
              supplier = resData;
              suppliers.push(supplier); // Add to local suppliers list
              newSuppliersCreated.push(supplierName);
              console.log(`Row ${i + 1}: Successfully created supplier "${supplierName}" with ID ${supplier.id}`);
            } catch (err) {
              console.error(`Row ${i + 1}: Failed to create supplier`, err);
              errors.push(`Row ${i + 1}: Failed to create supplier "${supplierName}": ${err.message}`);
              continue;
            }
          }

          newItems.push({
            product_id: matchedProduct ? matchedProduct.id : null,
            is_new: !matchedProduct,
            name: matchedProduct ? matchedProduct.name : trimmedProdName,
            sku: finalSku,
            category: category || (matchedProduct ? (matchedProduct.category || '') : ''),
            cost_price: costPrice,
            selling_price: sellingPrice || (matchedProduct ? matchedProduct.price : 0) || 0,
            quantity_ordered: quantity,
            expiry_date: expiryDate || null,
            unit: unit || (matchedProduct ? matchedProduct.unit : 'piece') || 'piece',
            low_stock_threshold: matchedProduct ? matchedProduct.low_stock_threshold : 10,
            supplier_id: supplier.id,
            supplier_name: supplierName
          });
        } catch (err) {
          console.error(`Row ${i + 1} error:`, err);
          errors.push(`Row ${i + 1}: ${err.message}`);
        }
      }

      console.log('New items:', newItems);
      console.log('Errors:', errors);
      console.log('New suppliers created:', newSuppliersCreated);

      if (newItems.length === 0) {
        throw new Error('No valid products found in CSV');
      }

      // Group items by supplier
      const itemsBySupplier = {};
      newItems.forEach(item => {
        if (!itemsBySupplier[item.supplier_id]) {
          itemsBySupplier[item.supplier_id] = [];
        }
        itemsBySupplier[item.supplier_id].push(item);
      });

      // Create separate purchase orders for each supplier
      const uniqueSuppliers = Object.keys(itemsBySupplier);
      let posCreated = 0;
      let posFailed = 0;

      setCsvUploadStatus('Creating purchase orders...');
      setCsvUploadProgress(90);

      for (let i = 0; i < uniqueSuppliers.length; i++) {
        const supplierId = uniqueSuppliers[i];
        const supplierItems = itemsBySupplier[supplierId];
        const supplier = suppliers.find(s => s.id === parseInt(supplierId));

        setCsvUploadStatus(`Creating purchase order ${i + 1} of ${uniqueSuppliers.length}...`);

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              supplier_id: parseInt(supplierId),
              order_date: new Date().toISOString().split('T')[0],
              notes: `Created from CSV upload with ${supplierItems.length} product(s)`,
              status: 'draft',
              payment_basis: 'cash',
              items: supplierItems
            })
          });

          const resData = await response.json();
          if (!response.ok) {
            throw new Error(resData.error || 'Failed to create purchase order');
          }
          posCreated++;
        } catch (err) {
          console.error(`Failed to create PO for supplier ${supplier?.name || supplierId}:`, err);
          posFailed++;
          errors.push(`Failed to create PO for supplier ${supplier?.name || supplierId}: ${err.message}`);
        }
      }

      // Show results
      setCsvUploadStatus('Completing upload...');
      setCsvUploadProgress(100);

      let message = `Successfully created ${posCreated} purchase order(s) with ${newItems.length} product(s)!`;
      if (newSuppliersCreated.length > 0) {
        message += ` Created ${newSuppliersCreated.length} new supplier(s): ${newSuppliersCreated.join(', ')}`;
      }
      if (posFailed > 0) {
        message += ` Failed to create ${posFailed} purchase order(s).`;
      }
      if (errors.length > 0) {
        triggerAlert('warning', `${message}\n\nErrors:\n${errors.slice(0, 5).join('\n')}`);
      } else {
        triggerAlert('success', message);
      }

      // Refresh suppliers list if new suppliers were created
      if (newSuppliersCreated.length > 0) {
        setCsvUploadStatus('Refreshing suppliers list...');
        await fetchSuppliers();
      }

      // Refresh purchase orders list
      setCsvUploadStatus('Refreshing purchase orders...');
      await fetchPurchaseOrders();

      // Reset CSV upload
      setPoCsvFile(null);
      setShowPoCsvUpload(false);
    } catch (err) {
      console.error('CSV Upload Error:', err);
      triggerAlert('error', err.message);
    } finally {
      setPoCsvUploading(false);
      setCsvUploadProgress(0);
      setCsvUploadCurrentRow(0);
      setCsvUploadTotalRows(0);
      setCsvUploadStatus('');
    }
  };

  // HELPER FORMATTERS
  const formatCurrency = (val) => `৳${parseFloat(val).toFixed(2)}`;
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // FILTERED PURCHASE ORDERS FOR LISTINGS - memoized for performance
  const filteredPOs = useMemo(() => {
    let filtered = purchaseOrders;
    if (poFilterStatus !== 'all') {
      filtered = filtered.filter(o => o.status === poFilterStatus);
    }
    if (poSearchTerm.trim() !== '') {
      const term = poSearchTerm.toLowerCase();
      filtered = filtered.filter(o =>
        o.supplier_name?.toLowerCase().includes(term) ||
        String(o.id).includes(term)
      );
    }
    return filtered;
  }, [purchaseOrders, poFilterStatus, poSearchTerm]);

  const handleDownloadPOCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/export/csv`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download CSV.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `purchase_orders_export_${new Date().toBDISODateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      triggerAlert('success', 'CSV downloaded successfully!');
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleDownloadPOPDF = () => {
    try {
      if (filteredPOs.length === 0) {
        triggerAlert('error', 'No purchase orders to export.');
        return;
      }

      const doc = new jsPDF();
      const tableData = filteredPOs.map(po => [
        `#PO-${po.id}`,
        po.supplier_name,
        po.order_date ? po.order_date.split('T')[0] : '-',
        po.payment_basis || 'cash',
        `Tk ${parseFloat(po.total_amount || 0).toFixed(2)}`,
        `Tk ${parseFloat(po.paid_amount || 0).toFixed(2)}`,
        `Tk ${parseFloat(po.due_amount || 0).toFixed(2)}`,
        po.status
      ]);

      autoTable(doc, {
        head: [['PO ID', 'Supplier', 'Order Date', 'Payment Basis', 'Total', 'Paid', 'Due', 'Status']],
        body: tableData,
        startY: 25,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { top: 25, right: 10, bottom: 20, left: 10 }
      });

      doc.setFontSize(16);
      doc.text('Purchase Orders', 14, 15);
      doc.setFontSize(10);
      doc.text(`Total Orders: ${filteredPOs.length}`, 14, doc.lastAutoTable.finalY + 10);

      doc.save(`purchase_orders_export_${new Date().toBDISODateString()}.pdf`);
      triggerAlert('success', 'PDF downloaded successfully!');
    } catch (err) {
      triggerAlert('error', 'Failed to generate PDF.');
    }
  };

  const handleDownloadCostLogsCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/cost-price-logs/export/csv`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download CSV.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cost_price_logs_export_${new Date().toBDISODateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      triggerAlert('success', 'CSV downloaded successfully!');
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleDownloadCostLogsPDF = () => {
    try {
      if (costLogs.length === 0) {
        triggerAlert('error', 'No cost price logs to export.');
        return;
      }

      const doc = new jsPDF();
      const tableData = costLogs.map(log => [
        log.id,
        log.created_at ? log.created_at.split('T')[0] : '-',
        log.product_name || '-',
        log.product_sku || '-',
        log.supplier_name || '-',
        `Tk ${parseFloat(log.old_cost_price || 0).toFixed(2)}`,
        `Tk ${parseFloat(log.new_cost_price || 0).toFixed(2)}`,
        log.reason || '-'
      ]);

      autoTable(doc, {
        head: [['Log ID', 'Date', 'Product Name', 'Product SKU', 'Supplier', 'Old Cost', 'New Cost', 'Reason']],
        body: tableData,
        startY: 25,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { top: 25, right: 10, bottom: 20, left: 10 }
      });

      doc.setFontSize(16);
      doc.text('Cost Price Logs', 14, 15);
      doc.setFontSize(10);
      doc.text(`Total Logs: ${costLogs.length}`, 14, doc.lastAutoTable.finalY + 10);

      doc.save(`cost_price_logs_export_${new Date().toBDISODateString()}.pdf`);
      triggerAlert('success', 'PDF downloaded successfully!');
    } catch (err) {
      triggerAlert('error', 'Failed to generate PDF.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'ordered':
        return 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse';
      case 'received':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // PROFILE RENDER
  if (selectedSupplierId && profileData) {
    const { supplier, stats, purchaseOrders: sPOs, costLogs: sLogs } = profileData;

    // Apply profile-level PO filters
    const filteredProfilePOs = sPOs.filter(po => {
      // Payment status filter
      if (profilePoFilter === 'paid' && parseFloat(po.due_amount || 0) > 0) return false;
      if (profilePoFilter === 'due' && parseFloat(po.due_amount || 0) <= 0) return false;

      // Date range filter
      const poDate = new Date(po.order_date);
      if (profilePoDateFrom) {
        const from = new Date(profilePoDateFrom);
        from.setHours(0, 0, 0, 0);
        if (poDate < from) return false;
      }
      if (profilePoDateTo) {
        const to = new Date(profilePoDateTo);
        to.setHours(23, 59, 59, 999);
        if (poDate > to) return false;
      }

      // Month filter (overrides date range if set)
      if (profilePoMonth) {
        const [yr, mo] = profilePoMonth.split('-').map(Number);
        if (poDate.getFullYear() !== yr || poDate.getMonth() + 1 !== mo) return false;
      }

      return true;
    });

    // Unique list of products this supplier has supplied or historically adjusted
    const logProductIds = sLogs.map(l => String(l.product_id));
    const directProductIds = productsList
      .filter(p => String(p.supplier_id) === String(supplier.id))
      .map(p => String(p.id));

    const uniqueProducts = Array.from(new Set([...logProductIds, ...directProductIds]))
      .map(id => {
        const pDetails = productsList.find(p => String(p.id) === String(id));
        const log = sLogs.find(l => String(l.product_id) === String(id));
        return {
          id,
          name: pDetails ? pDetails.name : (log ? log.product_name : 'Unknown Product'),
          sku: pDetails ? pDetails.sku : (log ? log.product_sku : 'N/A'),
          category: pDetails ? (pDetails.category || '') : '',
          stock: pDetails ? pDetails.stock_quantity : 'N/A',
          stock_quantity: pDetails ? pDetails.stock_quantity : 0,
          current_cost: pDetails ? pDetails.cost_price : (log ? log.new_cost_price : 0)
        };
      });

    // Filter uniqueProducts by search term
    const filteredUniqueProducts = uniqueProducts.filter(p => {
      if (!suppliedProductSearch) return true;
      const search = suppliedProductSearch.toLowerCase();
      return (p.name && p.name.toLowerCase().includes(search)) ||
        (p.sku && p.sku.toLowerCase().includes(search));
    });

    // Group supplied products by category
    const groupedProducts = filteredUniqueProducts.reduce((acc, p) => {
      const cat = p.category && p.category.trim() !== '' ? p.category.trim() : 'Uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});

    // Total Spent = sum of paid_amount across all purchase orders for this supplier
    const calculatedTotalSpent = sPOs.reduce((sum, po) => sum + (parseFloat(po.paid_amount) || 0), 0);

    return (
      <div className="space-y-6">
        {/* Alerts Banner */}
        {alert && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}>
            <span className="text-sm font-semibold">{alert.message}</span>
          </div>
        )}

        {/* Back and Header Card */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSelectedSupplierId(null)}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors"
            title="Back to Directory"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Supplier Profile</span>
            <h2 className="text-2xl font-bold text-slate-800">{supplier.name}</h2>
          </div>
        </div>

        {/* Info & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier details card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Contact Card</h3>
              <button
                onClick={() => openEdit(supplier)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Edit Vendor Details
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-400">CONTACT REPRESENTATIVE</span>
                <span className="font-semibold text-slate-700">{supplier.contact_name || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">EMAIL ADDRESS</span>
                <span className="font-semibold text-slate-700">{supplier.email || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">PHONE NUMBER</span>
                <span className="font-semibold text-slate-700">{supplier.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">VENDOR REGISTERED</span>
                <span className="font-semibold text-slate-700">{new Date(supplier.created_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">OUTSTANDING DUE BALANCE</span>
                <span className="font-extrabold text-rose-650 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 inline-block mt-1">
                  {formatCurrency(supplier.due_balance || 0)}
                </span>
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={() => handleDelete(supplier.id)}
                className="w-full text-center py-2 border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-600 font-semibold text-xs rounded-xl transition-all"
              >
                Delete Supplier
              </button>
            </div>
          </div>

          {/* Quick Stats Block */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* KPI 1 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Spent</span>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">{formatCurrency(calculatedTotalSpent)}</span>
                <span className="text-xs text-slate-400">Total paid across all purchase orders</span>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed POs</span>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">{stats.poStats.received}</span>
                <span className="text-xs text-slate-400">Shipments fully received</span>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Orders</span>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">
                  {stats.poStats.draft + stats.poStats.ordered}
                </span>
                <span className="text-xs text-slate-400">{stats.poStats.ordered} ordered · {stats.poStats.draft} draft</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Section tabs */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            <button
              onClick={() => setProfileTab('pos_history')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${profileTab === 'pos_history'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-450 hover:text-slate-700'
                }`}
            >
              Purchase Orders ({sPOs.length})
            </button>
            <button
              onClick={() => setProfileTab('cost_history')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${profileTab === 'cost_history'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-450 hover:text-slate-700'
                }`}
            >
              Cost Logs ({sLogs.length})
            </button>
            <button
              onClick={() => setProfileTab('supplied_products')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${profileTab === 'supplied_products'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-450 hover:text-slate-700'
                }`}
            >
              Supplied Products ({uniqueProducts.length})
            </button>
            <button
              onClick={() => setProfileTab('expired_products')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${profileTab === 'expired_products'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-450 hover:text-slate-700'
                }`}
            >
              Expired & Returns ({profileData.expiredProducts?.length || 0})
            </button>
          </div>

          <div className="p-6">
            {profileTab === 'pos_history' && (
              <div className="space-y-4">
                {/* Filter bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Status:</span>
                      {['all', 'paid', 'due'].map(f => (
                        <button
                          key={f}
                          onClick={() => setProfilePoFilter(f)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${profilePoFilter === f
                            ? f === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm'
                              : f === 'due'
                                ? 'bg-rose-100 text-rose-800 border-rose-300 shadow-sm'
                                : 'bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                            }`}
                        >
                          {f === 'all' ? 'All POs' : f === 'paid' ? '✓ Fully Paid' : '⚠ Has Due'}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => openAddPo(supplier.id)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-1.5 px-4 rounded-lg text-xs shadow-sm transition-colors"
                    >
                      + Add Purchase Order
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Range:</span>
                      <input
                        type="date"
                        value={profilePoDateFrom}
                        onChange={e => { setProfilePoDateFrom(e.target.value); setProfilePoMonth(''); }}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700"
                        placeholder="From"
                      />
                      <span className="text-slate-400 text-xs font-semibold">→</span>
                      <input
                        type="date"
                        value={profilePoDateTo}
                        onChange={e => { setProfilePoDateTo(e.target.value); setProfilePoMonth(''); }}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700"
                        placeholder="To"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month:</span>
                      <input
                        type="month"
                        value={profilePoMonth}
                        onChange={e => { setProfilePoMonth(e.target.value); setProfilePoDateFrom(''); setProfilePoDateTo(''); }}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700"
                      />
                    </div>
                    {(profilePoFilter !== 'all' || profilePoDateFrom || profilePoDateTo || profilePoMonth) && (
                      <button
                        onClick={() => { setProfilePoFilter('all'); setProfilePoDateFrom(''); setProfilePoDateTo(''); setProfilePoMonth(''); }}
                        className="text-xs font-semibold text-rose-500 hover:text-rose-700 underline transition-colors"
                      >
                        Clear Filters
                      </button>
                    )}
                    <span className="ml-auto text-[10px] font-bold text-slate-400">
                      Showing <span className="text-slate-700">{filteredProfilePOs.length}</span> of <span className="text-slate-700">{sPOs.length}</span> POs
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-3">PO ID</th>
                        <th className="p-3">Order Date</th>
                        <th className="p-3">Basis</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Paid</th>
                        <th className="p-3">Due</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredProfilePOs.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="p-8 text-center text-slate-400">
                            {sPOs.length === 0 ? 'No POs recorded.' : 'No POs match the selected filters.'}
                          </td>
                        </tr>
                      ) : (
                        filteredProfilePOs.map(po => (
                          <tr key={po.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-slate-700">#PO-{po.id}</td>
                            <td className="p-3 text-slate-600">{formatDate(po.order_date).split(',')[0]}</td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${po.payment_basis === 'credit'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                {po.payment_basis || 'cash'}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-800">{formatCurrency(po.total_amount)}</td>
                            <td className="p-3 text-emerald-600 font-semibold">{formatCurrency(po.paid_amount || 0)}</td>
                            <td className="p-3 text-rose-600 font-bold">{formatCurrency(po.due_amount || 0)}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(po.status)}`}>
                                {po.status}
                              </span>
                            </td>
                            <td className="p-3 text-center space-x-2">
                              <button
                                onClick={() => openPoDetails(po.id)}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold"
                              >
                                Details
                              </button>
                              {po.status === 'ordered' && (
                                <button
                                  onClick={() => openPoDetails(po.id)}
                                  className="text-emerald-600 hover:text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"
                                >
                                  Receive
                                </button>
                              )}
                              <button
                                onClick={() => openEditPo(po)}
                                disabled={!isAdmin}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Edit
                              </button>
                              {po.status === 'draft' && (
                                <button
                                  onClick={() => updatePoStatus(po.id, 'ordered')}
                                  className="text-amber-600 hover:text-gray-850 font-semibold mr-3"
                                >
                                  Place Order
                                </button>
                              )}
                              <button
                                onClick={() => handleDeletePo(po)}
                                className="text-rose-600 hover:text-rose-850 font-semibold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'cost_history' && (
              <div className="space-y-4">
                <h4 className="font-bold text-slate-700 text-sm">Product cost changes from this vendor</h4>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-3">Date</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">Old Cost</th>
                        <th className="p-3">New Cost</th>
                        <th className="p-3">Difference</th>
                        <th className="p-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {sLogs.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="p-8 text-center text-slate-400">No cost price logs matching this supplier.</td>
                        </tr>
                      ) : (
                        sLogs.map(log => {
                          const diff = parseFloat(log.new_cost_price) - parseFloat(log.old_cost_price);
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50">
                              <td className="p-3 text-slate-600">{formatDate(log.created_at)}</td>
                              <td className="p-3 font-mono text-slate-500 font-bold">{log.product_sku}</td>
                              <td className="p-3 font-semibold text-slate-800">{log.product_name}</td>
                              <td className="p-3 text-slate-550">{formatCurrency(log.old_cost_price)}</td>
                              <td className="p-3 font-extrabold text-slate-850">{formatCurrency(log.new_cost_price)}</td>
                              <td className="p-3">
                                {diff === 0 ? (
                                  <span className="text-slate-400 font-semibold">-</span>
                                ) : diff > 0 ? (
                                  <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                    +{formatCurrency(diff)} ▲
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                    {formatCurrency(diff)} ▼
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-medium text-indigo-600">{log.change_reason}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'supplied_products' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-1 rounded-xl gap-3">
                  <h4 className="font-bold text-slate-700 text-sm">Products currently cataloged from this vendor</h4>
                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search by name or SKU..."
                        value={suppliedProductSearch}
                        onChange={(e) => setSuppliedProductSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      onClick={() => setShowSupplierCsvModal(true)}
                      className="bg-indigo-650 hover:bg-indigo-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs shadow-xs transition-colors flex items-center space-x-1.5 shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="hidden sm:inline">Import CSV</span>
                      <span className="sm:hidden">CSV</span>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-3">SKU</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">Last Cost Price</th>
                        <th className="p-3">Current Active Stock</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {uniqueProducts.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs bg-white border border-slate-100 rounded-xl">No products recorded.</div>
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(groupedProducts).map(([category, prods]) => (
                            <div key={category} className="space-y-2.5">
                              <div className="flex items-center space-x-2">
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-indigo-150 uppercase tracking-wider">
                                  {category}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400">
                                  ({prods.length} {prods.length === 1 ? 'item' : 'items'})
                                </span>
                              </div>
                              <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                      <th className="p-3">SKU</th>
                                      <th className="p-3">Product Name</th>
                                      <th className="p-3">Last Cost Price</th>
                                      <th className="p-3">Current Active Stock</th>
                                      <th className="p-3 text-center">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-xs">
                                    {prods.map(p => (
                                      <tr key={p.id} className="hover:bg-slate-50/50">
                                        <td className="p-3 font-mono font-bold text-slate-500">{p.sku}</td>
                                        <td className="p-3 font-semibold text-slate-800">{p.name}</td>
                                        <td className="p-3 text-slate-750 font-bold">{formatCurrency(p.current_cost)}</td>
                                        <td className="p-3">
                                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
                                            {p.stock} units
                                          </span>
                                        </td>
                                        <td className="p-3 text-center flex items-center justify-center space-x-1.5">
                                          {isAdmin && (
                                            <button
                                              onClick={() => {
                                                const fullProd = productsList.find(item => String(item.id) === String(p.id));
                                                if (fullProd) {
                                                  setEditingProductId(p.id);
                                                  setProductEditForm({
                                                    name: fullProd.name,
                                                    sku: fullProd.sku,
                                                    cost_price: fullProd.cost_price,
                                                    price: fullProd.price,
                                                    stock_quantity: fullProd.stock_quantity,
                                                    category: fullProd.category || '',
                                                    unit: fullProd.unit || 'piece'
                                                  });
                                                  setShowEditProductModal(true);
                                                }
                                              }}
                                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-1 px-2.5 rounded text-xs transition-colors"
                                            >
                                              Edit
                                            </button>
                                          )}
                                          <button
                                            onClick={() => {
                                              setSelectedExpiredProduct(p);
                                              setReturnFormData({ quantity: String(p.stock_quantity || 0), notes: '' });
                                              setShowReturnModal(true);
                                            }}
                                            disabled={!(p.stock_quantity > 0)}
                                            className={`font-bold py-1 px-2.5 rounded border transition-colors ${p.stock_quantity > 0
                                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                              : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                                              }`}
                                            title={p.stock_quantity > 0 ? "Return to Supplier" : "No stock available to return"}
                                          >
                                            Return
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'expired_products' && (() => {
              const allExpiryItems = profileData.expiredProducts || [];
              const rawHistory = profileData.returnsHistory || [];

              // Filter Watchlist items
              const filteredWatchlist = allExpiryItems.filter(p => {
                if (expiryFilterDays === 'expired' && p.days_left > 0) return false;
                if (expiryFilterDays === '7' && (p.days_left <= 0 || p.days_left > 7)) return false;
                if (expiryFilterDays === '15' && (p.days_left <= 0 || p.days_left > 15)) return false;
                if (expiryFilterDays === '30' && (p.days_left <= 0 || p.days_left > 30)) return false;
                if (expiryFilterDays === '60' && (p.days_left <= 0 || p.days_left > 60)) return false;

                if (expirySearchTerm.trim()) {
                  const s = expirySearchTerm.toLowerCase();
                  return (p.name && p.name.toLowerCase().includes(s)) ||
                    (p.sku && p.sku.toLowerCase().includes(s)) ||
                    (p.category && p.category.toLowerCase().includes(s));
                }
                return true;
              });

              // Filter History Logs
              const filteredHistory = rawHistory.filter(log => {
                if (historyActionFilter === 'return' && log.action_type !== 'return') return false;
                if (historyActionFilter === 'replace' && log.action_type !== 'replace') return false;
                if (historyActionFilter === 'deduct_due' && log.settlement_type !== 'deduct_due') return false;

                if (historySearchTerm.trim()) {
                  const s = historySearchTerm.toLowerCase();
                  const matchProduct = (log.product_name && log.product_name.toLowerCase().includes(s)) ||
                    (log.product_sku && log.product_sku.toLowerCase().includes(s)) ||
                    (log.reference_no && log.reference_no.toLowerCase().includes(s)) ||
                    (log.reason && log.reason.toLowerCase().includes(s)) ||
                    (log.notes && log.notes.toLowerCase().includes(s));
                  if (!matchProduct) return false;
                }

                if (historyDateFrom) {
                  const from = new Date(historyDateFrom);
                  from.setHours(0, 0, 0, 0);
                  if (new Date(log.created_at) < from) return false;
                }
                if (historyDateTo) {
                  const to = new Date(historyDateTo);
                  to.setHours(23, 59, 59, 999);
                  if (new Date(log.created_at) > to) return false;
                }

                return true;
              });

              const totalExpiredCount = allExpiryItems.filter(p => p.days_left <= 0 && p.stock_quantity > 0).reduce((s, p) => s + p.stock_quantity, 0);
              const totalExpiredVal = allExpiryItems.filter(p => p.days_left <= 0 && p.stock_quantity > 0).reduce((s, p) => s + (p.stock_quantity * p.cost_price), 0);
              const totalNearCount = allExpiryItems.filter(p => p.days_left > 0 && p.days_left <= 30 && p.stock_quantity > 0).reduce((s, p) => s + p.stock_quantity, 0);
              const totalNearVal = allExpiryItems.filter(p => p.days_left > 0 && p.days_left <= 30 && p.stock_quantity > 0).reduce((s, p) => s + (p.stock_quantity * p.cost_price), 0);
              const totalReturnsVal = rawHistory.filter(l => l.action_type === 'return').reduce((s, l) => s + (parseFloat(l.total_amount) || 0), 0);
              const totalDueDeducted = rawHistory.filter(l => l.settlement_type === 'deduct_due').reduce((s, l) => s + (parseFloat(l.refund_amount) || 0), 0);

              const selectedCount = selectedExpiryItemIds.length;
              const selectedValue = allExpiryItems
                .filter(p => selectedExpiryItemIds.includes(p.id))
                .reduce((s, p) => s + (p.stock_quantity * p.cost_price), 0);

              const isAllWatchlistSelected = filteredWatchlist.length > 0 && filteredWatchlist.every(p => selectedExpiryItemIds.includes(p.id));

              const toggleSelectAllWatchlist = () => {
                if (isAllWatchlistSelected) {
                  const currentIds = filteredWatchlist.map(p => p.id);
                  setSelectedExpiryItemIds(prev => prev.filter(id => !currentIds.includes(id)));
                } else {
                  const newIds = filteredWatchlist.map(p => p.id);
                  setSelectedExpiryItemIds(prev => Array.from(new Set([...prev, ...newIds])));
                }
              };

              const toggleSelectItem = (id) => {
                setSelectedExpiryItemIds(prev =>
                  prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
                );
              };

              // Filter supplied products for universal desk
              const deskProductOptions = uniqueProducts.filter(p => {
                if (!deskProductSearch.trim()) return true;
                const s = deskProductSearch.toLowerCase();
                return (p.name && p.name.toLowerCase().includes(s)) || (p.sku && p.sku.toLowerCase().includes(s));
              });

              return (
                <div className="space-y-6">
                  {/* KPI Executive Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Expired Stock Value */}
                    <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200/80 p-4.5 shadow-xs relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[11px] font-bold tracking-wider uppercase text-rose-600 block">Expired Stock Loss</span>
                          <span className="text-xl font-black text-rose-950 mt-1 block">
                            {formatCurrency(totalExpiredVal)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-xs">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center text-xs font-semibold text-rose-700">
                        <span className="bg-rose-200/60 px-2 py-0.5 rounded-md font-bold text-[11px] mr-2">
                          {totalExpiredCount} units
                        </span>
                        <span>Requires urgent return/write-off</span>
                      </div>
                    </div>

                    {/* Card 2: Near Expiry Warning */}
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 border border-amber-200/80 p-4.5 shadow-xs relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[11px] font-bold tracking-wider uppercase text-amber-700 block">Expiring in 30 Days</span>
                          <span className="text-xl font-black text-amber-950 mt-1 block">
                            {formatCurrency(totalNearVal)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center text-xs font-semibold text-amber-800">
                        <span className="bg-amber-200/60 px-2 py-0.5 rounded-md font-bold text-[11px] mr-2">
                          {totalNearCount} units
                        </span>
                        <span>Approaching expiration window</span>
                      </div>
                    </div>

                    {/* Card 3: Total Returns Processed */}
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 border border-indigo-200/80 p-4.5 shadow-xs relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[11px] font-bold tracking-wider uppercase text-indigo-700 block">Total Returned Value</span>
                          <span className="text-xl font-black text-indigo-950 mt-1 block">
                            {formatCurrency(totalReturnsVal)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center text-xs font-semibold text-indigo-800">
                        <span className="bg-indigo-200/60 px-2 py-0.5 rounded-md font-bold text-[11px] mr-2">
                          {rawHistory.filter(l => l.action_type === 'return').length} logs
                        </span>
                        <span>Total returned to vendor</span>
                      </div>
                    </div>

                    {/* Card 4: Due Offset Recovered */}
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 border border-emerald-200/80 p-4.5 shadow-xs relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-700 block">Debt Due Deducted</span>
                          <span className="text-xl font-black text-emerald-950 mt-1 block">
                            {formatCurrency(totalDueDeducted)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center text-xs font-semibold text-emerald-800">
                        <span className="bg-emerald-200/60 px-2 py-0.5 rounded-md font-bold text-[11px] mr-2">
                          Ledger Offset
                        </span>
                        <span>Deducted from supplier dues</span>
                      </div>
                    </div>
                  </div>

                  {/* Sub-Navigation Tabs */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div className="flex items-center space-x-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60">
                      <button
                        onClick={() => setExpiredSubTab('watchlist')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${expiredSubTab === 'watchlist'
                            ? 'bg-white text-rose-700 shadow-xs border border-rose-200/50'
                            : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <span>🚨 Expiry Watchlist & Alerts</span>
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-black ${allExpiryItems.length > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                          {allExpiryItems.length}
                        </span>
                      </button>

                      <button
                        onClick={() => setExpiredSubTab('new_return')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${expiredSubTab === 'new_return'
                            ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/50'
                            : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Initiate Return / Desk</span>
                      </button>

                      <button
                        onClick={() => setExpiredSubTab('history')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${expiredSubTab === 'history'
                            ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Returns & Debit Notes History</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
                          {rawHistory.length}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setDeskFormData(prev => ({ ...prev, action_type: 'return' }));
                          setExpiredSubTab('new_return');
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Create Return Slip</span>
                      </button>
                    </div>
                  </div>

                  {/* VIEW 1: WATCHLIST & EXPIRY ALERTS */}
                  {expiredSubTab === 'watchlist' && (
                    <div className="space-y-4">
                      {/* Filter Bar & Search */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter Window:</span>
                            {[
                              { key: 'all', label: 'All Watchlist' },
                              { key: 'expired', label: '🔴 Expired Now' },
                              { key: '7', label: '⚡ Next 7 Days' },
                              { key: '15', label: '⏳ Next 15 Days' },
                              { key: '30', label: '📅 Next 30 Days' },
                              { key: '60', label: '🗓️ Next 60 Days' }
                            ].map(f => (
                              <button
                                key={f.key}
                                onClick={() => setExpiryFilterDays(f.key)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${expiryFilterDays === f.key
                                    ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                                    : 'bg-white text-slate-650 border-slate-200 hover:border-slate-300'
                                  }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>

                          <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                            <input
                              type="text"
                              placeholder="Search item or SKU..."
                              value={expirySearchTerm}
                              onChange={(e) => setExpirySearchTerm(e.target.value)}
                              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                            />
                          </div>
                        </div>

                        {/* Bulk Action Toolbar */}
                        {selectedCount > 0 && (
                          <div className="flex flex-wrap items-center justify-between bg-rose-50 border border-rose-200 rounded-xl p-3 gap-3 animate-fadeIn">
                            <div className="flex items-center space-x-2 text-xs font-bold text-rose-900">
                              <span className="bg-rose-200 text-rose-900 px-2 py-0.5 rounded-md text-[11px]">
                                {selectedCount} items selected
                              </span>
                              <span>Total Value: <strong className="text-rose-950 font-black">{formatCurrency(selectedValue)}</strong></span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setBulkReturnAction('return');
                                  setBulkReturnSettlement('deduct_due');
                                  setBulkReturnReason('Expired Batch Return');
                                  setShowBulkReturnModal(true);
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3.5 rounded-lg text-xs shadow-xs transition-colors flex items-center space-x-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                <span>Bulk Return to Supplier ({selectedCount})</span>
                              </button>
                              <button
                                onClick={() => {
                                  setBulkReturnAction('replace');
                                  setBulkReturnReason('Bulk Batch Replacement');
                                  setShowBulkReturnModal(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3.5 rounded-lg text-xs shadow-xs transition-colors flex items-center space-x-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Bulk Replace ({selectedCount})</span>
                              </button>
                              <button
                                onClick={() => setSelectedExpiryItemIds([])}
                                className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline px-2"
                              >
                                Clear Selection
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Watchlist Table */}
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/70">
                              <th className="p-3.5 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={isAllWatchlistSelected}
                                  onChange={toggleSelectAllWatchlist}
                                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                />
                              </th>
                              <th className="p-3.5">SKU & Item Details</th>
                              <th className="p-3.5">Category</th>
                              <th className="p-3.5">Expiry Status</th>
                              <th className="p-3.5">Current Stock</th>
                              <th className="p-3.5">Unit Cost</th>
                              <th className="p-3.5">Total Value</th>
                              <th className="p-3.5 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredWatchlist.length === 0 ? (
                              <tr>
                                <td colSpan="8" className="p-12 text-center text-slate-400">
                                  <div className="flex flex-col items-center justify-center space-y-2">
                                    <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </div>
                                    <span className="font-semibold text-slate-500">No products matching the active filter in watchlist.</span>
                                    <span className="text-xs text-slate-400">All products from this supplier are unexpired and in good standing.</span>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              filteredWatchlist.map(p => {
                                const isExpired = p.days_left <= 0;
                                const isNear = p.days_left > 0 && p.days_left <= 30;
                                const isSelected = selectedExpiryItemIds.includes(p.id);

                                return (
                                  <tr key={p.id} className={`hover:bg-slate-50/60 transition-colors ${isSelected ? 'bg-rose-50/30' : ''}`}>
                                    <td className="p-3.5 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectItem(p.id)}
                                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                      />
                                    </td>
                                    <td className="p-3.5">
                                      <div className="font-mono font-bold text-slate-500 text-[11px]">{p.sku}</div>
                                      <div className="font-bold text-slate-850 text-sm mt-0.5">{p.name}</div>
                                    </td>
                                    <td className="p-3.5">
                                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200 uppercase">
                                        {p.category || 'Uncategorized'}
                                      </span>
                                    </td>
                                    <td className="p-3.5">
                                      <div className="flex flex-col items-start gap-1">
                                        <span className="text-slate-700 font-bold text-xs">
                                          {new Date(p.expiry_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </span>
                                        {isExpired ? (
                                          <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md border border-rose-200 inline-flex items-center">
                                            🔴 Expired {Math.abs(p.days_left)}d ago
                                          </span>
                                        ) : isNear ? (
                                          <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200 inline-flex items-center">
                                            ⏳ Expires in {p.days_left}d
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 inline-flex items-center">
                                            In {p.days_left} days
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3.5">
                                      <span className={`font-bold px-2.5 py-1 rounded-lg border text-xs ${p.stock_quantity > 0
                                          ? 'bg-slate-100 text-slate-800 border-slate-200'
                                          : 'bg-rose-50 text-rose-600 border-rose-200'
                                        }`}>
                                        {p.stock_quantity} {p.unit || 'units'}
                                      </span>
                                    </td>
                                    <td className="p-3.5 font-bold text-slate-700">
                                      {formatCurrency(p.cost_price)}
                                    </td>
                                    <td className="p-3.5 font-black text-slate-900">
                                      {formatCurrency(p.stock_quantity * p.cost_price)}
                                    </td>
                                    <td className="p-3.5 text-center">
                                      <div className="flex items-center justify-center space-x-1.5">
                                        <button
                                          onClick={() => {
                                            setSelectedExpiredProduct(p);
                                            setReturnFormData({
                                              quantity: String(p.stock_quantity > 0 ? p.stock_quantity : 1),
                                              unit_cost: String(p.cost_price || 0),
                                              reason: isExpired ? 'Expired' : 'Near Expiry Stock',
                                              settlement_type: 'deduct_due',
                                              refund_amount: String((p.stock_quantity > 0 ? p.stock_quantity : 1) * (p.cost_price || 0)),
                                              reference_no: '',
                                              notes: isExpired ? 'Batch expired; requesting return & ledger credit' : 'Returning near-expiry stock'
                                            });
                                            setShowReturnModal(true);
                                          }}
                                          disabled={!(p.stock_quantity > 0)}
                                          className={`font-bold py-1.5 px-3 rounded-lg text-xs border transition-all ${p.stock_quantity > 0
                                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-2xs'
                                              : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                            }`}
                                          title={p.stock_quantity > 0 ? "Return to Supplier" : "No stock to return"}
                                        >
                                          Return
                                        </button>

                                        <button
                                          onClick={() => {
                                            setSelectedExpiredProduct(p);
                                            setReplaceFormData({
                                              quantity: String(p.stock_quantity > 0 ? p.stock_quantity : 1),
                                              new_expiry_date: '',
                                              reason: 'Batch Replacement',
                                              notes: 'Supplier agreed to replace with new unexpired lot'
                                            });
                                            setShowReplaceModal(true);
                                          }}
                                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-1.5 px-3 rounded-lg text-xs border border-emerald-200 shadow-2xs transition-colors"
                                        >
                                          Replace
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* VIEW 2: UNIVERSAL RETURN DESK */}
                  {expiredSubTab === 'new_return' && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                      <div className="border-b border-slate-100 pb-4">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Universal Return Generator</span>
                        <h3 className="text-lg font-black text-slate-800">Initiate Supplier Return or Replacement</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Create an official return slip for any item supplied by {supplier.name} with automatic inventory deduction and financial ledger settlement.
                        </p>
                      </div>

                      <form onSubmit={handleUniversalDeskSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Column 1: Item & Quantity Selection */}
                          <div className="space-y-4 bg-slate-50/60 p-4.5 rounded-2xl border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200/60 pb-2">
                              1. Item & Quantity Breakdown
                            </h4>

                            {/* Product Selector */}
                            <div className="relative" ref={deskProductDropdownRef}>
                              <label className="block text-xs font-bold text-slate-600 mb-1">
                                Select Supplied Product *
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Search by name or SKU to pick product..."
                                  value={deskProductSearch}
                                  onClick={() => setShowDeskProductDropdown(prev => !prev)}
                                  onChange={(e) => {
                                    setDeskProductSearch(e.target.value);
                                    setShowDeskProductDropdown(true);
                                  }}
                                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                />
                                {deskFormData.product_id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeskFormData(prev => ({ ...prev, product_id: '', unit_cost: '' }));
                                      setDeskProductSearch('');
                                    }}
                                    className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {/* Dropdown Suggestions */}
                              {showDeskProductDropdown && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                                  {deskProductOptions.length === 0 ? (
                                    <div className="p-3 text-xs text-slate-400 text-center">No products found for this vendor.</div>
                                  ) : (
                                    deskProductOptions.map(prod => (
                                      <button
                                        type="button"
                                        key={prod.id}
                                        onClick={() => {
                                          setDeskFormData(prev => ({
                                            ...prev,
                                            product_id: prod.id,
                                            unit_cost: String(prod.current_cost || 0),
                                            refund_amount: String(parseFloat(deskFormData.quantity || 1) * (prod.current_cost || 0))
                                          }));
                                          setDeskProductSearch(`${prod.name} (${prod.sku})`);
                                          setShowDeskProductDropdown(false);
                                        }}
                                        className="w-full text-left p-3 hover:bg-indigo-50/50 flex justify-between items-center text-xs transition-colors"
                                      >
                                        <div>
                                          <span className="font-bold text-slate-800 block">{prod.name}</span>
                                          <span className="text-[10px] font-mono text-slate-400">{prod.sku} · {prod.category || 'Standard'}</span>
                                        </div>
                                        <div className="text-right">
                                          <span className="font-bold text-slate-700 block">{formatCurrency(prod.current_cost)}</span>
                                          <span className="text-[10px] text-slate-400">Stock: {prod.stock}</span>
                                        </div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Action Type Toggle */}
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1.5">Action Type</label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDeskFormData(prev => ({ ...prev, action_type: 'return' }))}
                                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center space-x-1.5 ${deskFormData.action_type === 'return'
                                      ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                  <span>Return (Stock Out)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeskFormData(prev => ({ ...prev, action_type: 'replace' }))}
                                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center space-x-1.5 ${deskFormData.action_type === 'replace'
                                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span>Replace (Exchange)</span>
                                </button>
                              </div>
                            </div>

                            {/* Quantity & Unit Cost Grid */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Return Quantity *</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={deskFormData.quantity}
                                  onChange={(e) => {
                                    const q = e.target.value;
                                    const u = parseFloat(deskFormData.unit_cost) || 0;
                                    setDeskFormData(prev => ({
                                      ...prev,
                                      quantity: q,
                                      refund_amount: String((parseFloat(q) || 0) * u)
                                    }));
                                  }}
                                  required
                                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Return Unit Cost (৳)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={deskFormData.unit_cost}
                                  onChange={(e) => {
                                    const u = e.target.value;
                                    const q = parseFloat(deskFormData.quantity) || 0;
                                    setDeskFormData(prev => ({
                                      ...prev,
                                      unit_cost: u,
                                      refund_amount: String(q * (parseFloat(u) || 0))
                                    }));
                                  }}
                                  required
                                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                />
                              </div>
                            </div>

                            {/* Total Return Amount Preview Box */}
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex justify-between items-center">
                              <div>
                                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Total Return Value</span>
                                <span className="text-xs text-indigo-600">Calculated item worth</span>
                              </div>
                              <span className="text-base font-black text-indigo-900">
                                {formatCurrency((parseFloat(deskFormData.quantity) || 0) * (parseFloat(deskFormData.unit_cost) || 0))}
                              </span>
                            </div>

                            {/* Replacement Expiry date if action_type === 'replace' */}
                            {deskFormData.action_type === 'replace' && (
                              <div>
                                <label className="block text-xs font-bold text-emerald-700 mb-1">New Replacement Expiry Date *</label>
                                <input
                                  type="date"
                                  value={deskFormData.new_expiry_date}
                                  onChange={(e) => setDeskFormData(prev => ({ ...prev, new_expiry_date: e.target.value }))}
                                  required
                                  className="w-full border border-emerald-300 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50/40"
                                />
                              </div>
                            )}
                          </div>

                          {/* Column 2: Reason, Settlement & Remarks */}
                          <div className="space-y-4 bg-slate-50/60 p-4.5 rounded-2xl border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200/60 pb-2">
                              2. Reason & Financial Settlement
                            </h4>

                            {/* Return Reason */}
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Return Reason *</label>
                              <select
                                value={deskFormData.reason}
                                onChange={(e) => setDeskFormData(prev => ({ ...prev, reason: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              >
                                <option value="Expired">Expired Product Batch</option>
                                <option value="Near Expiry">Near-Expiry Warning</option>
                                <option value="Damaged Goods">Damaged Goods / Packaging</option>
                                <option value="Defective Quality">Quality Defect / Spoiled</option>
                                <option value="Wrong Item Delivered">Wrong Item Shipped by Vendor</option>
                                <option value="Overstock Return">Overstock / Consignment Return</option>
                                <option value="Customer Return to Supplier">Customer Returned to Vendor</option>
                                <option value="Other">Other Reason</option>
                              </select>
                            </div>

                            {/* Settlement Type */}
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">
                                Financial Settlement Method
                              </label>
                              <select
                                value={deskFormData.settlement_type}
                                onChange={(e) => setDeskFormData(prev => ({ ...prev, settlement_type: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              >
                                <option value="deduct_due">💳 Deduct from Supplier Due Balance (Offset Debt)</option>
                                <option value="cash_refund">💵 Cash / Bank Refund Received</option>
                                <option value="credit_note">📜 Supplier Credit Note (Recorded for future POs)</option>
                                <option value="replacement">🔄 Product Replacement / Exchange</option>
                                <option value="none">🚫 No Settlement (Inventory Loss Write-off)</option>
                              </select>

                              {deskFormData.settlement_type === 'deduct_due' && (
                                <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100 mt-2 font-medium">
                                  Current outstanding vendor due: <strong>{formatCurrency(supplier.due_balance || 0)}</strong>. Processing this return will automatically reduce your debt balance.
                                </p>
                              )}
                            </div>

                            {/* Reference Number */}
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">
                                Reference Number / Debit Note Ref (Optional)
                              </label>
                              <input
                                type="text"
                                placeholder="Auto-generated if left blank (e.g. SR-240820-A1B2)"
                                value={deskFormData.reference_no}
                                onChange={(e) => setDeskFormData(prev => ({ ...prev, reference_no: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-mono"
                              />
                            </div>

                            {/* Notes / Details */}
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Notes / Internal Remarks</label>
                              <textarea
                                rows="3"
                                placeholder="Add specific notes, batch lot #, delivery vehicle details or reason notes..."
                                value={deskFormData.notes}
                                onChange={(e) => setDeskFormData(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Submit Button Bar */}
                        <div className="flex justify-end space-x-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setExpiredSubTab('watchlist')}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center space-x-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Generate Return Slip & Adjust Stock</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* VIEW 3: RETURNS & REPLACEMENTS HISTORY LOG */}
                  {expiredSubTab === 'history' && (
                    <div className="space-y-4">
                      {/* Filter Bar */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Action Filter:</span>
                            {[
                              { key: 'all', label: 'All History' },
                              { key: 'return', label: 'Returns' },
                              { key: 'replace', label: 'Replacements' },
                              { key: 'deduct_due', label: 'Due Deductions' }
                            ].map(f => (
                              <button
                                key={f.key}
                                onClick={() => setHistoryActionFilter(f.key)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${historyActionFilter === f.key
                                    ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                                    : 'bg-white text-slate-650 border-slate-200 hover:border-slate-300'
                                  }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>

                          <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                            <input
                              type="text"
                              placeholder="Search ref #, item, reason..."
                              value={historySearchTerm}
                              onChange={(e) => setHistorySearchTerm(e.target.value)}
                              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/60">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date From:</span>
                            <input
                              type="date"
                              value={historyDateFrom}
                              onChange={(e) => setHistoryDateFrom(e.target.value)}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700 bg-white"
                            />
                            <span className="text-slate-400 text-xs">→</span>
                            <input
                              type="date"
                              value={historyDateTo}
                              onChange={(e) => setHistoryDateTo(e.target.value)}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700 bg-white"
                            />
                          </div>

                          {(historyActionFilter !== 'all' || historySearchTerm || historyDateFrom || historyDateTo) && (
                            <button
                              onClick={() => {
                                setHistoryActionFilter('all');
                                setHistorySearchTerm('');
                                setHistoryDateFrom('');
                                setHistoryDateTo('');
                              }}
                              className="text-xs font-semibold text-rose-500 hover:text-rose-700 underline"
                            >
                              Clear Filters
                            </button>
                          )}

                          <span className="ml-auto text-[10px] font-bold text-slate-400">
                            Showing <span className="text-slate-700">{filteredHistory.length}</span> of <span className="text-slate-700">{rawHistory.length}</span> entries
                          </span>
                        </div>
                      </div>

                      {/* History Log Table */}
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/70">
                              <th className="p-3.5">Ref Voucher</th>
                              <th className="p-3.5">Date</th>
                              <th className="p-3.5">Product & SKU</th>
                              <th className="p-3.5">Qty</th>
                              <th className="p-3.5">Unit Cost</th>
                              <th className="p-3.5">Total Value</th>
                              <th className="p-3.5">Action & Settlement</th>
                              <th className="p-3.5">Reason & Remarks</th>
                              <th className="p-3.5 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredHistory.length === 0 ? (
                              <tr>
                                <td colSpan="9" className="p-10 text-center text-slate-400">
                                  No return or replacement vouchers match your filter.
                                </td>
                              </tr>
                            ) : (
                              filteredHistory.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="p-3.5">
                                    <button
                                      onClick={() => openDebitNoteSlip(log)}
                                      className="font-mono font-bold text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-150 inline-flex items-center space-x-1"
                                      title="Click to view & print Debit Note slip"
                                    >
                                      <span>#{log.reference_no || `SR-${log.id}`}</span>
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </button>
                                  </td>
                                  <td className="p-3.5 text-slate-600 whitespace-nowrap">
                                    {formatDate(log.created_at)}
                                  </td>
                                  <td className="p-3.5">
                                    <div className="font-bold text-slate-800">{log.product_name}</div>
                                    <div className="font-mono text-[10px] text-slate-400">{log.product_sku}</div>
                                  </td>
                                  <td className="p-3.5 font-bold text-slate-800">
                                    {log.quantity} {log.product_unit || 'units'}
                                  </td>
                                  <td className="p-3.5 text-slate-600">
                                    {formatCurrency(log.unit_cost)}
                                  </td>
                                  <td className="p-3.5 font-black text-slate-900">
                                    {formatCurrency(log.total_amount || (log.quantity * log.unit_cost))}
                                  </td>
                                  <td className="p-3.5">
                                    <div className="flex flex-col items-start gap-1">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${log.action_type === 'return'
                                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        }`}>
                                        {log.action_type === 'return' ? 'Returned' : 'Replaced'}
                                      </span>

                                      {log.settlement_type === 'deduct_due' && (
                                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-150">
                                          Due Deducted: {formatCurrency(log.refund_amount || log.total_amount)}
                                        </span>
                                      )}
                                      {log.settlement_type === 'cash_refund' && (
                                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-150">
                                          Cash Refunded
                                        </span>
                                      )}
                                      {log.settlement_type === 'credit_note' && (
                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-150">
                                          Credit Note
                                        </span>
                                      )}
                                      {log.new_expiry_date && (
                                        <span className="text-[9px] font-bold text-emerald-700">
                                          New Expiry: {new Date(log.new_expiry_date).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-xs">
                                    <div className="font-semibold text-slate-700">{log.reason || 'Expired'}</div>
                                    {log.notes && <div className="text-[11px] text-slate-400 italic max-w-xs truncate">{log.notes}</div>}
                                  </td>
                                  <td className="p-3.5 text-center">
                                    <div className="flex items-center justify-center space-x-2">
                                      <button
                                        onClick={() => openDebitNoteSlip(log)}
                                        className="text-indigo-600 hover:text-indigo-900 font-bold text-xs bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg border border-indigo-150"
                                        title="Print Debit Note Voucher"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSelectedLog(log);
                                          setEditLogFormData({
                                            quantity: String(log.quantity),
                                            unit_cost: String(log.unit_cost || 0),
                                            reason: log.reason || 'Expired',
                                            settlement_type: log.settlement_type || 'none',
                                            refund_amount: String(log.refund_amount || 0),
                                            notes: log.notes || '',
                                            new_expiry_date: log.new_expiry_date ? log.new_expiry_date.split('T')[0] : ''
                                          });
                                          setShowEditLogModal(true);
                                        }}
                                        className="text-slate-600 hover:text-slate-900 font-bold text-xs p-1.5 rounded-lg hover:bg-slate-100"
                                        title="Edit Log Entry"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteLog(log)}
                                        className="text-rose-600 hover:text-rose-900 font-bold text-xs p-1.5 rounded-lg hover:bg-rose-50"
                                        title="Delete Log (Revert Stock & Balance)"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* RENDER EDIT SUPPLIER MODAL */}
        {showEditModal && renderSupplierFormModal(true)}

        {/* RENDER PO DETAILS MODAL */}
        {showPoDetailsModal && renderPoDetailsModal()}

        {/* RENDER RECEIVE MODAL */}
        {showReceiveModal && renderReceiveModal()}

        {/* RENDER ADD PO MODAL */}
        {showAddPoModal && renderAddPoModal()}

        {/* RENDER RETURN MODAL */}
        {showReturnModal && renderReturnModal()}

        {/* RENDER REPLACE MODAL */}
        {showReplaceModal && renderReplaceModal()}

        {/* RENDER BULK RETURN MODAL */}
        {showBulkReturnModal && renderBulkReturnModal()}

        {/* RENDER DEBIT NOTE SLIP MODAL */}
        {showDebitNoteModal && renderDebitNoteModal()}

        {/* RENDER EDIT LOG MODAL */}
        {showEditLogModal && renderEditLogModal()}

        {/* RENDER SUPPLIER CSV UPLOAD MODAL */}
        {showSupplierCsvModal && renderSupplierCsvUploadModal()}

        {/* RENDER EDIT PRODUCT MODAL */}
        {showEditProductModal && renderEditProductModal()}
      </div>
    );
  }

  // --- GENERAL LAYOUTS RENDER (selectedSupplierId is null) ---
  return (
    <div className="space-y-6">

      {/* Alerts Banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}>
          <span className="text-sm font-semibold">{alert.message}</span>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Supplier Directory</h2>
          <p className="text-sm text-slate-500">Manage vendor profiles, purchase orders, and cost price changes</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {(isAdmin || user.role === 'shop_staff') && (
            <button
              onClick={() => openAddPo()}
              className="bg-[#C4A484] hover:bg-[#A67B5B] text-white font-semibold py-2.5 px-5 border border-slate-200 rounded-xl text-sm shadow-xs transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Create Purchase Order</span>
            </button>
          )}
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add New Supplier</span>
          </button>
          {isAdmin && activeTab === 'directory' && selectedSupplierIds.length > 0 && (
            <button
              onClick={handleBulkDeleteSuppliers}
              className="bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Selected ({selectedSupplierIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 space-x-2 bg-slate-100/50 p-1.5 rounded-xl">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'pos'
            ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/40'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'directory'
            ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/40'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          Vendors Directory
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'logs'
            ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/40'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          Cost Price Logs
        </button>
      </div>

      {/* --- TAB: DIRECTORY --- */}
      {activeTab === 'directory' && (() => {
        const filteredSuppliers = suppliers.filter(s => {
          if (!directorySearchTerm) return true;
          const search = directorySearchTerm.toLowerCase();
          return (s.name && s.name.toLowerCase().includes(search)) ||
            (s.contact_name && s.contact_name.toLowerCase().includes(search)) ||
            (s.email && s.email.toLowerCase().includes(search)) ||
            (s.phone && s.phone.toLowerCase().includes(search));
        });
        const totalSupplierPages = Math.ceil(filteredSuppliers.length / supplierItemsPerPage);
        const indexOfFirstSupplier = (supplierPage - 1) * supplierItemsPerPage;
        const indexOfLastSupplier = supplierPage * supplierItemsPerPage;
        const paginatedSuppliers = filteredSuppliers.slice(indexOfFirstSupplier, indexOfLastSupplier);

        return (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="relative w-full sm:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search vendors by name, email, or phone..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  value={directorySearchTerm}
                  onChange={(e) => {
                    setDirectorySearchTerm(e.target.value);
                    setSupplierPage(1);
                  }}
                />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="p-4 w-12 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          checked={filteredSuppliers.length > 0 && filteredSuppliers.every(s => selectedSupplierIds.includes(s.id))}
                          onChange={(e) => handleSelectAllSuppliers(e, filteredSuppliers)}
                        />
                      </th>
                      <th className="p-4">Supplier Name</th>
                      <th className="p-4">Contact Person</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Outstanding Due</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="p-12 text-center">
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                          </div>
                        </td>
                      </tr>
                    ) : suppliers.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-12 text-center text-slate-400">
                          No suppliers listed yet. Add a supplier to begin.
                        </td>
                      </tr>
                    ) : (
                      paginatedSuppliers.map((supplier) => (
                        <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                              checked={selectedSupplierIds.includes(supplier.id)}
                              onChange={() => handleSelectSupplier(supplier.id)}
                            />
                          </td>
                          <td className="p-4 font-semibold text-slate-800">{supplier.name}</td>
                          <td className="p-4 text-slate-700">{supplier.contact_name || '-'}</td>
                          <td className="p-4 text-slate-600">{supplier.email || '-'}</td>
                          <td className="p-4 text-slate-600">{supplier.phone || '-'}</td>
                          <td className="p-4 font-bold text-slate-700">
                            {parseFloat(supplier.due_balance) > 0 ? (
                              <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 font-extrabold">
                                {formatCurrency(supplier.due_balance)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-semibold">-</span>
                            )}
                          </td>
                          <td className="p-4 text-center space-x-2">
                            <button
                              onClick={() => setSelectedSupplierId(supplier.id)}
                              className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              View Profile
                            </button>
                            <button
                              onClick={() => openEdit(supplier)}
                              className="text-slate-500 hover:text-slate-800 font-semibold text-xs border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(supplier.id)}
                                className="text-rose-600 hover:text-rose-800 font-semibold text-xs border border-rose-200 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalSupplierPages > 1 && (() => {
              const currentBlock = Math.floor((supplierPage - 1) / 20);
              let startPage = currentBlock * 20 + 1;
              let endPage = Math.min(startPage + 19, totalSupplierPages);
              const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

              return (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">
                    Showing <span className="text-slate-800">{indexOfFirstSupplier + 1}</span> to <span className="text-slate-800">{Math.min(indexOfLastSupplier, filteredSuppliers.length)}</span> of <span className="text-slate-800">{filteredSuppliers.length}</span> entries
                  </div>
                  <div className="flex items-center flex-wrap gap-1.5 justify-center sm:justify-end">
                    <button
                      onClick={() => setSupplierPage(prev => Math.max(prev - 1, 1))}
                      disabled={supplierPage === 1}
                      className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    {currentBlock > 0 && (
                      <button
                        onClick={() => setSupplierPage(startPage - 1)}
                        className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                      >
                        ...
                      </button>
                    )}

                    {visiblePages.map((page) => (
                      <button
                        key={page}
                        onClick={() => setSupplierPage(page)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${supplierPage === page
                          ? 'bg-slate-100 text-slate-800 shadow-xs'
                          : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                          }`}
                      >
                        {page}
                      </button>
                    ))}

                    {endPage < totalSupplierPages && (
                      <button
                        onClick={() => setSupplierPage(endPage + 1)}
                        className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                      >
                        ...
                      </button>
                    )}

                    <button
                      onClick={() => setSupplierPage(prev => Math.min(prev + 1, totalSupplierPages))}
                      disabled={supplierPage === totalSupplierPages}
                      className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* --- TAB: PURCHASE ORDERS --- */}
      {activeTab === 'pos' && (() => {
        const totalPoPages = Math.ceil(filteredPOs.length / poItemsPerPage);
        const indexOfFirstPo = (poPage - 1) * poItemsPerPage;
        const indexOfLastPo = poPage * poItemsPerPage;
        const paginatedPOs = filteredPOs.slice(indexOfFirstPo, indexOfLastPo);

        return (
          <div className="space-y-4">
            {/* PO Totals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <p className="text-xs font-semibold text-slate-500 uppercase">Total Purchase Amount</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {formatCurrency(filteredPOs.reduce((sum, po) => sum + parseFloat(po.total_amount || 0), 0))}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <p className="text-xs font-semibold text-slate-500 uppercase">Total Paid</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {formatCurrency(filteredPOs.reduce((sum, po) => sum + parseFloat(po.paid_amount || 0), 0))}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <p className="text-xs font-semibold text-slate-500 uppercase">Total Due</p>
                <p className="text-2xl font-bold text-rose-600 mt-1">
                  {formatCurrency(filteredPOs.reduce((sum, po) => sum + parseFloat(po.due_amount || 0), 0))}
                </p>
              </div>
            </div>
            {/* Date Filter and View Details - shown under Purchase Orders tab */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Date Range:</span>
                <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                  <input type="date" value={poStartDate} onChange={(e) => { setPoStartDate(e.target.value); setPoPage(1); }} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 flex-1 sm:flex-initial min-w-[125px]" />
                  <span className="text-slate-400 text-xs sm:text-sm font-medium">to</span>
                  <input type="date" value={poEndDate} onChange={(e) => { setPoEndDate(e.target.value); setPoPage(1); }} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 flex-1 sm:flex-initial min-w-[125px]" />
                </div>
              </div>
              <button
                onClick={fetchFilteredPOItems}
                disabled={!poStartDate || !poEndDate || filteredPOLoading}
                className={`${!poStartDate || !poEndDate ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'} font-bold py-2 px-4 rounded-xl text-xs sm:text-sm transition-colors border flex items-center justify-center space-x-1.5 whitespace-nowrap shadow-xs w-full sm:w-auto`}
              >
                {filteredPOLoading ? (<div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-emerald-600 mr-1"></div>) : (<svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5,12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7z" /></svg>)}
                <span>View details</span>
              </button>
            </div>
            {/* PO Totals */}
            {/* PO Filters bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search by supplier or PO#..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    value={poSearchTerm}
                    onChange={(e) => {
                      setPoSearchTerm(e.target.value);
                      setPoPage(1);
                      setPoSearchFocusedIndex(-1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setPoSearchFocusedIndex(prev => (prev < paginatedPOs.length - 1 ? prev + 1 : prev));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setPoSearchFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (poSearchFocusedIndex >= 0 && paginatedPOs[poSearchFocusedIndex]) {
                          openPoDetails(paginatedPOs[poSearchFocusedIndex].id);
                        }
                      }
                    }}
                  />
                </div>

                <div className="flex items-center space-x-2.5">
                  <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Filter Status:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['all', 'draft', 'ordered', 'received', 'cancelled'].map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setPoFilterStatus(st);
                          setPoPage(1);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase tracking-wider transition-all border ${poFilterStatus === st
                          ? 'bg-slate-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3 w-full lg:w-auto justify-end">
                {(() => {
                  const selectedDraftPOs = filteredPOs.filter(po => selectedPoIds.includes(po.id) && po.status === 'draft');
                  return selectedPoIds.length > 0 && selectedDraftPOs.length > 0 && (
                    <button
                      onClick={handleBulkPlaceOrder}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Receive ({selectedDraftPOs.length})</span>
                    </button>
                  );
                })()}
                {selectedPoIds.length > 0 && isAdmin && (
                  <button
                    onClick={handleBulkDeletePos}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete ({selectedPoIds.length})</span>
                  </button>
                )}
                <button
                  onClick={handleDownloadPOCSV}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.4145.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>CSV</span>
                </button>
                <button
                  onClick={handleDownloadPOPDF}
                  className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>PDF</span>
                </button>
              </div>
            </div>


            {/* PO Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={paginatedPOs.length > 0 && paginatedPOs.every(po => selectedPoIds.includes(po.id))}
                          onChange={(e) => handleSelectAllPos(e, paginatedPOs)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="p-4">PO ID</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">Order Date</th>
                      <th className="p-4">Basis</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Paid</th>
                      <th className="p-4">Due</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="10" className="p-12 text-center">
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                          </div>
                        </td>
                      </tr>
                    ) : filteredPOs.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="p-12 text-center text-slate-400">
                          No purchase orders matching filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedPOs.map((po, index) => (
                        <tr key={po.id} className={`hover:bg-slate-50/50 transition-colors ${poSearchFocusedIndex === index ? 'bg-indigo-100 ring-2 ring-indigo-500 ring-inset' : ''}`}>
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={selectedPoIds.includes(po.id)}
                              onChange={() => handleSelectPo(po.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-650">#PO-{po.id}</td>
                          <td className="p-4 font-semibold text-slate-800">{po.supplier_name}</td>
                          <td className="p-4 text-slate-600">{formatDate(po.order_date).split(',')[0]}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${po.payment_basis === 'credit'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                              {po.payment_basis || 'cash'}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-800">{formatCurrency(po.total_amount)}</td>
                          <td className="p-4 text-emerald-600 font-semibold">{formatCurrency(po.paid_amount || 0)}</td>
                          <td className="p-4 text-rose-650 font-bold">{formatCurrency(po.due_amount || 0)}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getStatusBadge(po.status)}`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="p-4 text-center space-x-2">
                            <button
                              onClick={() => openPoDetails(po.id)}
                              className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              View
                            </button>
                            {(isAdmin || user.role === 'shop_staff') && (
                              po.status === 'ordered' && (
                                <button
                                  onClick={() => openPoDetails(po.id)}
                                  className="text-emerald-600 hover:text-emerald-900 font-bold text-xs border border-emerald-100 bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors animate-pulse"
                                >
                                  Receive Stocks
                                </button>
                              )
                            )}
                            <button
                              onClick={() => openEditPo(po)}
                              disabled={!isAdmin}
                              className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors mr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Edit
                            </button>
                            {po.status === 'draft' && (
                              <button
                                onClick={() => updatePoStatus(po.id, 'ordered')}
                                className="text-amber-600 hover:text-amber-900 font-semibold text-xs border border-amber-100 hover:bg-amber-50 px-2.5 py-1 rounded-lg transition-colors mr-2"
                              >
                                Place Order
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePo(po)}
                              className="text-rose-600 hover:text-rose-900 font-semibold text-xs border border-rose-100 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/50 border-t-2 border-slate-200 font-bold">
                      <td colSpan="5" className="p-4 text-slate-500 uppercase text-xs">Total</td>
                      <td className="p-4 font-bold text-slate-800">{formatCurrency(filteredPOs.reduce((sum, po) => sum + parseFloat(po.total_amount || 0), 0))}</td>
                      <td className="p-4 font-bold text-emerald-700">{formatCurrency(filteredPOs.reduce((sum, po) => sum + parseFloat(po.paid_amount || 0), 0))}</td>
                      <td className="p-4 font-bold text-rose-700">{formatCurrency(filteredPOs.reduce((sum, po) => sum + parseFloat(po.due_amount || 0), 0))}</td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPoPages > 1 && (() => {
              const currentBlock = Math.floor((poPage - 1) / 20);
              let startPage = currentBlock * 20 + 1;
              let endPage = Math.min(startPage + 19, totalPoPages);
              const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

              return (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">
                    Showing <span className="text-slate-800">{indexOfFirstPo + 1}</span> to <span className="text-slate-800">{Math.min(indexOfLastPo, filteredPOs.length)}</span> of <span className="text-slate-800">{filteredPOs.length}</span> entries
                  </div>
                  <div className="flex items-center flex-wrap gap-1.5 justify-center sm:justify-end">
                    <button
                      onClick={() => setPoPage(prev => Math.max(prev - 1, 1))}
                      disabled={poPage === 1}
                      className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    {currentBlock > 0 && (
                      <button
                        onClick={() => setPoPage(startPage - 1)}
                        className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                      >
                        ...
                      </button>
                    )}

                    {visiblePages.map((page) => (
                      <button
                        key={page}
                        onClick={() => setPoPage(page)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${poPage === page
                          ? 'bg-slate-100 text-slate-800 shadow-xs'
                          : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                          }`}
                      >
                        {page}
                      </button>
                    ))}

                    {endPage < totalPoPages && (
                      <button
                        onClick={() => setPoPage(endPage + 1)}
                        className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                      >
                        ...
                      </button>
                    )}

                    <button
                      onClick={() => setPoPage(prev => Math.min(prev + 1, totalPoPages))}
                      disabled={poPage === totalPoPages}
                      className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* --- TAB: COST PRICE LOGS --- */}
      {activeTab === 'logs' && (() => {
        const logsItemsPerPage = 15;
        const totalLogPages = Math.max(1, Math.ceil(costLogs.length / logsItemsPerPage));
        const indexOfFirstLog = (logsPage - 1) * logsItemsPerPage;
        const indexOfLastLog = logsPage * logsItemsPerPage;
        const paginatedLogs = costLogs.slice(indexOfFirstLog, indexOfLastLog);

        const currentBlock = Math.floor((logsPage - 1) / 20);
        let startPage = currentBlock * 20 + 1;
        let endPage = Math.min(startPage + 19, totalLogPages);

        const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

        return (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-end gap-3 shadow-xs">
              <button
                onClick={handleDownloadCostLogsCSV}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>CSV</span>
              </button>
              <button
                onClick={handleDownloadCostLogsPDF}
                className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>PDF</span>
              </button>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="p-4">Date Logged</th>
                      <th className="p-4">SKU</th>
                      <th className="p-4">Product Name</th>
                      <th className="p-4">Vendor Supplier</th>
                      <th className="p-4">Old Cost</th>
                      <th className="p-4">New Cost</th>
                      <th className="p-4">Difference</th>
                      <th className="p-4">Reason / Reference</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="9" className="p-12 text-center">
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                          </div>
                        </td>
                      </tr>
                    ) : costLogs.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="p-12 text-center text-slate-400">
                          No cost price logs recorded yet. Logs generate automatically when POs are received.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => {
                        const diff = parseFloat(log.new_cost_price) - parseFloat(log.old_cost_price);
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 text-slate-650">{formatDate(log.created_at)}</td>
                            <td className="p-4 font-mono text-xs font-bold text-slate-500">{log.product_sku}</td>
                            <td className="p-4 font-semibold text-slate-800">{log.product_name}</td>
                            <td className="p-4 font-semibold text-slate-700">{log.supplier_name || 'N/A'}</td>
                            <td className="p-4 text-slate-600">{formatCurrency(log.old_cost_price)}</td>
                            <td className="p-4 font-extrabold text-slate-800">{formatCurrency(log.new_cost_price)}</td>
                            <td className="p-4">
                              {diff === 0 ? (
                                <span className="text-slate-400 font-semibold">-</span>
                              ) : diff > 0 ? (
                                <span className="text-rose-600 font-bold bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded text-xs inline-flex items-center">
                                  +{formatCurrency(diff)} ▲
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded text-xs inline-flex items-center">
                                  {formatCurrency(diff)} ▼
                                </span>
                              )}
                            </td>
                            <td className="p-4 font-medium text-indigo-600">{log.change_reason}</td>
                            <td className="p-4">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => viewCostLog(log.id)}
                                  className="text-emerald-600 hover:text-emerald-900 font-semibold text-xs border border-emerald-100 hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors"
                                  title="View details"
                                >
                                  View
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => deleteCostLog(log.id)}
                                    className="text-rose-600 hover:text-rose-900 font-semibold text-xs border border-rose-100 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors"
                                    title="Delete log"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalLogPages > 1 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="text-xs font-semibold text-slate-500">
                  Showing <span className="text-slate-800">{indexOfFirstLog + 1}</span> to <span className="text-slate-800">{Math.min(indexOfLastLog, costLogs.length)}</span> of <span className="text-slate-800">{costLogs.length}</span> entries
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                    disabled={logsPage === 1}
                    className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  {startPage > 1 && (
                    <button
                      onClick={() => setLogsPage(startPage - 1)}
                      className="px-2 py-1 text-slate-400 hover:text-slate-700 text-xs font-bold transition-colors"
                    >
                      ...
                    </button>
                  )}
                  {visiblePages.map((page) => (
                    <button
                      key={page}
                      onClick={() => setLogsPage(page)}
                      className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${logsPage === page
                        ? 'bg-slate-100 text-slate-800 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                  {endPage < totalLogPages && (
                    <button
                      onClick={() => setLogsPage(endPage + 1)}
                      className="px-2 py-1 text-slate-400 hover:text-slate-700 text-xs font-bold transition-colors"
                    >
                      ...
                    </button>
                  )}

                  <button
                    onClick={() => setLogsPage(prev => Math.min(prev + 1, totalLogPages))}
                    disabled={logsPage === totalLogPages}
                    className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* --- ADD SUPPLIER MODAL --- */}
      {showAddModal && renderSupplierFormModal(false)}

      {/* --- EDIT SUPPLIER MODAL --- */}
      {showEditModal && renderSupplierFormModal(true)}

      {/* --- ADD PO MODAL --- */}
      {showAddPoModal && renderAddPoModal()}

      {/* --- PO DETAILS MODAL --- */}
      {showPoDetailsModal && renderPoDetailsModal()}

      {/* --- RECEIVE MODAL --- */}
      {showReceiveModal && renderReceiveModal()}

      {/* ===== FILTERED PO ITEMS MODAL ===== */}
      {showFilteredPOModal && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-10 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden mb-10">
            {/* Header */}
            <div className="bg-white px-6 py-5 flex items-center justify-between border-b border-slate-100">
              <div>
                <h2 className="text-slate-800 font-extrabold text-lg tracking-tight">Filtered Product Details</h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  Purchased products from <span className="font-bold">{poStartDate}</span> to <span className="font-bold">{poEndDate}</span>
                </p>
              </div>
              <button
                onClick={() => { setShowFilteredPOModal(false); setFilteredPOItemsData(null); }}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {filteredPOLoading ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
                  <p className="text-slate-400 text-sm font-medium">Loading products...</p>
                </div>
              ) : filteredPOItemsData ? (() => {
                const items = filteredPOItemsData;
                return (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    {items.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-sm">
                        No products were ordered in this date range.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-white border-b border-slate-100">
                              <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">SKU</th>
                              <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product Name</th>
                              <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cost Price</th>
                              <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sale Price</th>
                              <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Qty Ordered</th>
                              <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Qty Received</th>
                              <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Expiry Date</th>
                              <th className="px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {items.map((p) => (
                              <tr key={p.product_id} className="hover:bg-slate-50/50 transition-colors bg-white">
                                <td className="px-5 py-5 align-middle">
                                  <div className="text-[13px] font-bold text-slate-500 font-mono tracking-tight">{p.sku || 'N/A'}</div>
                                </td>
                                <td className="px-5 py-5 align-middle">
                                  <div className="font-bold text-slate-700 text-[14px]">{p.product_name}</div>
                                </td>
                                <td className="px-5 py-5 align-middle">
                                  <span className="font-medium text-slate-600 text-[14px]">৳{parseFloat(p.cost_price).toFixed(2)}</span>
                                </td>
                                <td className="px-5 py-5 align-middle">
                                  <span className="font-medium text-slate-600 text-[14px]">৳{parseFloat(p.sale_price).toFixed(2)}</span>
                                </td>
                                <td className="px-5 py-5 align-middle">
                                  <span className="font-bold text-slate-700 text-[14px]">
                                    {parseFloat(p.qty_ordered)} <span className="font-medium text-slate-400 text-[13px] font-normal ml-1">Carton</span>
                                  </span>
                                </td>
                                <td className="px-5 py-5 align-middle">
                                  <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-3 py-1.5 rounded text-[14px]">
                                    {parseFloat(p.qty_received)} <span className="font-medium text-emerald-500 text-[13px] font-normal ml-0.5">Carton</span>
                                  </span>
                                </td>
                                <td className="px-5 py-5 align-middle">
                                  <span className="text-slate-400 text-[13px]">{p.expiry_date || '-'}</span>
                                </td>
                                <td className="px-5 py-5 align-middle">
                                  <span className="font-extrabold text-slate-800 text-[15px]">৳{parseFloat(p.total_subtotal).toFixed(2)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="py-16 text-center text-slate-400 text-sm">No data available.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== COST PRICE LOG VIEW MODAL ===== */}
      {showCostLogViewModal && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-10 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden mb-10">
            <div className="bg-gray-400 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-black font-extrabold text-lg tracking-tight">Cost Price Log Details</h2>
                  <p className="text-black text-xs mt-0.5">Log ID: #{selectedCostLog?.id}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowCostLogViewModal(false); setSelectedCostLog(null); }}
                className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {costLogViewLoading ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
                  <p className="text-slate-400 text-sm font-medium">Loading log details...</p>
                </div>
              ) : selectedCostLog ? (
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Product Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Product Name</p>
                        <p className="font-semibold text-slate-800">{selectedCostLog.product_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">SKU</p>
                        <p className="font-mono text-sm font-bold text-slate-600">{selectedCostLog.product_sku}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Category</p>
                        <p className="font-medium text-slate-700">{selectedCostLog.product_category || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Supplier</p>
                        <p className="font-medium text-slate-700">{selectedCostLog.supplier_name || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Price Change Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Old Cost Price</p>
                        <p className="font-semibold text-slate-600">{formatCurrency(selectedCostLog.old_cost_price)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">New Cost Price</p>
                        <p className="font-extrabold text-slate-800">{formatCurrency(selectedCostLog.new_cost_price)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500 mb-1">Difference</p>
                        {(() => {
                          const diff = parseFloat(selectedCostLog.new_cost_price) - parseFloat(selectedCostLog.old_cost_price);
                          return diff === 0 ? (
                            <span className="text-slate-400 font-semibold">No change</span>
                          ) : diff > 0 ? (
                            <span className="text-rose-600 font-bold bg-rose-50 border border-rose-100 px-3 py-1 rounded-lg text-sm inline-flex items-center">
                              +{formatCurrency(diff)} ▲ (Increase)
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg text-sm inline-flex items-center">
                              {formatCurrency(diff)} ▼ (Decrease)
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Additional Information</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Reason / Reference</p>
                        <p className="font-medium text-indigo-600">{selectedCostLog.reason || selectedCostLog.change_reason || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Date Logged</p>
                        <p className="font-medium text-slate-700">{formatDate(selectedCostLog.created_at)}</p>
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => deleteCostLog(selectedCostLog.id)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Log</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">No data available.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {renderPoDeleteModal()}

    </div>
  );

  // PO DELETE CONFIRMATION MODAL WITH PROGRESS BAR
  function renderPoDeleteModal() {
    if (!showPoDeleteModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
          <div className="p-6 text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${poDeleting ? 'bg-rose-50 text-rose-600' : 'bg-rose-100 text-rose-600'
              }`}>
              {poDeleting ? (
                <div className="w-8 h-8 border-3 border-rose-200 border-t-rose-600 rounded-full animate-spin"></div>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {poToDelete ? 'Delete Purchase Order' : 'Delete Selected Purchase Orders'}
            </h3>

            {!poDeleting ? (
              <p className="text-sm text-slate-500 mb-6">
                {poToDelete ? (
                  <>
                    Are you sure you want to delete <span className="font-semibold text-slate-800">PO #{poToDelete.id} ({poToDelete.supplier_name})</span>?
                    This will revert received inventory and supplier ledger balances.
                  </>
                ) : (
                  <>
                    Are you sure you want to permanently delete <span className="font-semibold text-rose-600">{selectedPoIds.length}</span> selected purchase order(s)?
                    This will revert received inventory and supplier ledger balances.
                  </>
                )}
              </p>
            ) : (
              /* Dynamic Progress Bar Section during deletion */
              <div className="my-5 p-4 bg-slate-50 border border-slate-200/90 rounded-2xl text-left space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center space-x-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    <span>Deleting purchase orders...</span>
                  </span>
                  <span className="font-mono text-rose-600 font-bold text-sm">{poDeleteProgress.percent}%</span>
                </div>

                {/* Animated Progress Bar Track */}
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-rose-500 to-rose-600 h-full rounded-full transition-all duration-300 ease-out shadow-xs relative overflow-hidden"
                    style={{ width: `${poDeleteProgress.percent}%` }}
                  >
                    <div className="absolute inset-0 bg-white/25 animate-pulse"></div>
                  </div>
                </div>

                {/* Progress info and item counter */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                  <span className="truncate max-w-[200px] font-medium text-slate-600" title={poDeleteProgress.currentName}>
                    {poDeleteProgress.currentName}
                  </span>
                  <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200/80">
                    {poDeleteProgress.current} / {poDeleteProgress.total}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-center space-x-3 mt-4">
              <button
                type="button"
                onClick={() => { setShowPoDeleteModal(false); setPoToDelete(null); }}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={poDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePo}
                disabled={poDeleting}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center space-x-2 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {poDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    <span>Deleting... ({poDeleteProgress.percent}%)</span>
                  </>
                ) : (
                  <span>{poToDelete ? 'Delete' : 'Confirm Delete'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER COMPONENT PIECES AS UTILITIES TO KEEP CODE READABLE ---

  // SUPPLIER CSV UPLOAD MODAL
  function renderSupplierCsvUploadModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Import Supplied Products via CSV</h3>
            <button
              onClick={() => {
                setShowSupplierCsvModal(false);
                setSupplierCsvFile(null);
              }}
              className="text-slate-400 hover:text-slate-600 animate-pulse"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50 text-xs text-indigo-800 space-y-2">
              <span className="font-bold uppercase tracking-wider block text-[10px] text-indigo-600">CSV Requirements:</span>
              <ul className="list-disc pl-4 space-y-1">
                <li>Required: <strong>Product Name</strong>, <strong>SKU</strong>, <strong>Cost Price</strong>, and <strong>Sale Price</strong></li>
                <li>Optional: <strong>Stock Quantity</strong>, <strong>Low Stock Threshold</strong>, <strong>Expiry Date</strong> (YYYY-MM-DD), and <strong>Unit</strong></li>
                <li>All products will be linked to the current supplier automatically.</li>
              </ul>
            </div>

            <form onSubmit={handleSupplierCsvUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <svg className="w-10 h-10 text-slate-400 mb-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                {supplierCsvFile ? (
                  <div className="text-center">
                    <span className="text-sm font-semibold text-slate-800 block truncate max-w-[280px]">
                      {supplierCsvFile.name}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {(supplierCsvFile.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => setSupplierCsvFile(null)}
                      className="text-xs text-rose-500 hover:text-rose-700 underline font-semibold mt-2.5 block mx-auto animate-pulse"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <label className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer inline-block">
                      <span>Choose CSV File</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setSupplierCsvFile(e.target.files[0] || null)}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[11px] text-slate-400 block mt-2">Maximum file size: 5MB</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowSupplierCsvModal(false);
                    setSupplierCsvFile(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={supplierCsvUploading || !supplierCsvFile}
                  className="px-5 py-2 bg-slate-650 hover:bg-indigo-700 disabled:bg-slate-350 text-white rounded-xl text-sm font-semibold transition-colors shadow flex items-center space-x-1.5"
                >
                  {supplierCsvUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-1"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Upload CSV</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER COMPONENT PIECES AS UTILITIES TO KEEP CODE READABLE ---

  // EDIT SUPPLIED PRODUCT MODAL
  function renderEditProductModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">
              Edit Product Info
            </h3>
            <button
              onClick={() => {
                setShowEditProductModal(false);
                setEditingProductId(null);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSaveProductEdit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Product Name *</label>
              <input
                type="text"
                value={productEditForm.name}
                onChange={(e) => setProductEditForm(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">SKU *</label>
              <input
                type="text"
                value={productEditForm.sku}
                onChange={(e) => setProductEditForm(prev => ({ ...prev, sku: e.target.value }))}
                required
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productEditForm.cost_price}
                  onChange={(e) => setProductEditForm(prev => ({ ...prev, cost_price: e.target.value }))}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productEditForm.price}
                  onChange={(e) => setProductEditForm(prev => ({ ...prev, price: e.target.value }))}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Current Active Stock</label>
              <input
                type="number"
                step="any"
                min="0"
                value={productEditForm.stock_quantity}
                readOnly
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none bg-slate-50 cursor-not-allowed text-slate-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Unit *</label>
                <input
                  list="suppliers-edit-unit-list"
                  type="text"
                  value={productEditForm.unit || 'piece'}
                  onChange={(e) => setProductEditForm(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="e.g. piece, kg, box"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                />
                <datalist id="suppliers-edit-unit-list">
                  <option value="piece" />
                  <option value="kg" />
                  <option value="gm" />
                  <option value="liter" />
                  <option value="packet" />
                  <option value="box" />
                  <option value="dozen" />
                  <option value="meter" />
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                <input
                  list="suppliers-edit-categories-list"
                  type="text"
                  value={productEditForm.category || ''}
                  onChange={(e) => setProductEditForm(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Product category"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold"
                />
                <datalist id="suppliers-edit-categories-list">
                  {Array.from(new Set(productsList.map(p => p.category).filter(Boolean))).map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowEditProductModal(false);
                  setEditingProductId(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingProduct}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition-colors shadow"
              >
                {updatingProduct ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // SUPPLIER FORM MODAL (ADD & EDIT)
  function renderSupplierFormModal(isEdit = false) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">
              {isEdit ? `Edit Supplier: ${currentSupplier?.name}` : 'Add New Supplier'}
            </h3>
            <button
              onClick={() => {
                isEdit ? setShowEditModal(false) : setShowAddModal(false);
                setIsBulkSupplierMode(false);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!isEdit && (
            <div className="flex space-x-2 mt-4 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setIsBulkSupplierMode(false)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${!isBulkSupplierMode
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Single Supplier
              </button>
              <button
                type="button"
                onClick={() => setIsBulkSupplierMode(true)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${isBulkSupplierMode
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Bulk Upload (CSV)
              </button>
            </div>
          )}

          {isBulkSupplierMode && !isEdit ? (
            // CSV Upload Mode
            <form onSubmit={handleBulkSupplierCsvUpload} className="mt-4 space-y-4">
              <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50 text-xs text-indigo-800 space-y-2">
                <span className="font-bold uppercase tracking-wider block text-[10px] text-indigo-600">CSV Requirements:</span>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Required: <strong>name</strong> (Company/Vendor name)</li>
                  <li>Optional: <strong>contact_name</strong>, <strong>email</strong>, <strong>phone</strong></li>
                  <li>Duplicate suppliers will be skipped</li>
                </ul>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <svg className="w-10 h-10 text-slate-400 mb-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                {supplierCsvFile ? (
                  <div className="text-center">
                    <span className="text-sm font-semibold text-slate-800 block truncate max-w-[280px]">
                      {supplierCsvFile.name}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {(supplierCsvFile.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => setSupplierCsvFile(null)}
                      className="text-xs text-rose-500 hover:text-rose-700 underline font-semibold mt-2.5 block mx-auto"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <label className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer inline-block">
                      <span>Choose CSV File</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setSupplierCsvFile(e.target.files[0] || null)}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[11px] text-slate-400 block mt-2">Maximum file size: 5MB</span>
                  </div>
                )}
              </div>

              {supplierCsvUploading && (
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <div className="text-xs font-semibold text-indigo-700 mb-2">{supplierCsvUploadStatus}</div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${supplierCsvUploadProgress}%` }}
                    ></div>
                  </div>
                  <div className="text-center text-xs font-bold text-indigo-600 mt-1">
                    {supplierCsvUploadProgress.toFixed(0)}%
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setIsBulkSupplierMode(false);
                    setSupplierCsvFile(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={supplierCsvUploading || !supplierCsvFile}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-800 rounded-xl text-sm font-semibold transition-colors shadow flex items-center space-x-1.5"
                >
                  {supplierCsvUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-600 mr-1"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Upload CSV</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            // Single Supplier Form Mode
            <form onSubmit={isEdit ? handleEditSubmit : handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Company / Vendor Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. Acme Wholesale Corp"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Rep Name</label>
                <input
                  type="text"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleInputChange}
                  placeholder="e.g. John Doe"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="johndoe@acme.com"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="555-0120"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    isEdit ? setShowEditModal(false) : setShowAddModal(false);
                    setIsBulkSupplierMode(false);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-semibold transition-colors shadow"
                >
                  {isEdit ? 'Save Changes' : 'Create Supplier'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ADD PURCHASE ORDER FORM MODAL
  function renderAddPoModal() {
    const calculatePOTotal = () => {
      const qty = parseInt(poFormData.quantity_ordered) || 0;
      const cost = parseFloat(poFormData.cost_price) || 0;
      return qty * cost;
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] p-5 shadow-2xl overflow-hidden flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">{isEditPoMode ? 'Edit Purchase Order' : 'Create Purchase Order'}</h3>
            <button onClick={() => { setShowAddPoModal(false); setIsEditPoMode(false); setEditingCartItemIndex(null); }} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">

            {/* ── BARCODE SCANNER STRIP ─────────────────────────── */}
            <div className={`rounded-xl border-2 transition-all duration-200 ${barcodeMode
                ? 'border-indigo-400 bg-indigo-50/60 shadow-sm'
                : 'border-dashed border-slate-300 bg-slate-50/50'
              } p-3`}>
              <div className="flex items-center gap-3">
                {/* Barcode icon */}
                <div className={`flex-shrink-0 p-2 rounded-lg ${barcodeMode ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m0 14v1M4.93 4.93l.7.7m12.74 12.74l.7.7M1 12h1m20 0h1M4.93 19.07l.7-.7M18.36 5.64l.7-.7" />
                    <rect x="7" y="8" width="2" height="8" rx="0.5" fill="currentColor" stroke="none" />
                    <rect x="11" y="8" width="1" height="8" rx="0.5" fill="currentColor" stroke="none" />
                    <rect x="14" y="8" width="3" height="8" rx="0.5" fill="currentColor" stroke="none" />
                  </svg>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {barcodeMode ? '🟢 Scanner Active — Scan or Type SKU + Enter' : 'Barcode Scanner'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">Shortcut: F2</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !barcodeMode;
                          setBarcodeMode(next);
                          setBarcodeStatus(null);
                          if (next) setTimeout(() => barcodeInputRef.current?.focus(), 80);
                        }}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${barcodeMode
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                      >
                        {barcodeMode ? 'Disable' : 'Enable Scanner'}
                      </button>
                    </div>
                  </div>

                  {barcodeMode && (
                    <div className="flex gap-2">
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleBarcodeScan(barcodeInput);
                          }
                        }}
                        placeholder="Scan barcode or type SKU and press Enter..."
                        autoComplete="off"
                        autoFocus
                        className="flex-1 border-2 border-indigo-300 focus:border-indigo-500 rounded-lg p-2 text-sm font-mono outline-none bg-white placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-300"
                      />
                      <button
                        type="button"
                        onClick={() => handleBarcodeScan(barcodeInput)}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                        </svg>
                        <span>Lookup</span>
                      </button>
                    </div>
                  )}

                  {/* Scan feedback status */}
                  {barcodeStatus && (
                    <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${barcodeStatus.type === 'success'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : barcodeStatus.type === 'warn'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                      {barcodeStatus.msg}
                    </div>
                  )}

                  {!barcodeMode && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Enable scanner to quickly add products by scanning their barcode/SKU. Press <kbd className="bg-slate-200 px-1 rounded text-[10px]">F2</kbd> to activate.
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* ── END BARCODE SCANNER STRIP ────────────────────── */}

            <div className={`grid grid-cols-1 ${isEditPoMode ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Order Date</label>
                <input
                  type="date"
                  value={poFormData.order_date}
                  onChange={(e) => setPoFormData({ ...poFormData, order_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                />
              </div>

              {isEditPoMode && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Received Date</label>
                  <input
                    type="date"
                    value={poFormData.received_date || ''}
                    onChange={(e) => setPoFormData({ ...poFormData, received_date: e.target.value })}
                    disabled={!isAdmin}
                    title={!isAdmin ? "Only shop admins can modify the received date" : ""}
                    className={`w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-medium ${!isAdmin ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                  />
                </div>
              )}

              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Supplier *</label>
                {selectedSupplierId ? (
                  <input
                    type="text"
                    value={supplierSearch}
                    disabled
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 text-slate-500 font-medium"
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      value={supplierSearch}
                      onChange={(e) => {
                        setSupplierSearch(e.target.value);
                        setShowSupplierSuggestions(true);
                        setSupplierSearchFocusedIndex(-1);
                        if (poFormData.supplier_id) {
                          setPoFormData(prev => ({ ...prev, supplier_id: '' }));
                        }
                      }}
                      onFocus={() => {
                        setShowSupplierSuggestions(true);
                        setSupplierSearchFocusedIndex(-1);
                        // Refresh catalog names in case they weren't loaded yet
                        if (masterSupplierNames.length === 0) fetchMasterSupplierNames();
                      }}
                      onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 250)}
                      onKeyDown={async (e) => {
                        if (showSupplierSuggestions) {
                          const query = supplierSearch.toLowerCase().trim();
                          const suggestions = suppliers.filter(s => s.name && s.name.toLowerCase().includes(query));
                          const exactMatch = query !== '' && suppliers.some(s => s.name && s.name.trim().toLowerCase() === query);
                          const hasCreateOption = query !== '' && !exactMatch;
                          const totalOptions = suggestions.length + (hasCreateOption ? 1 : 0);

                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setSupplierSearchFocusedIndex(prev => (prev < totalOptions - 1 ? prev + 1 : prev));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setSupplierSearchFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (hasCreateOption && supplierSearchFocusedIndex === 0) {
                              const created = await createOrGetSupplier(supplierSearch.trim());
                              if (created) {
                                setSupplierSearch(created.name);
                                setPoFormData(prev => ({ ...prev, supplier_id: String(created.id) }));
                                setShowSupplierSuggestions(false);
                                setSupplierSearchFocusedIndex(-1);
                              }
                            } else {
                              const actualIdx = hasCreateOption ? supplierSearchFocusedIndex - 1 : supplierSearchFocusedIndex;
                              if (actualIdx >= 0 && suggestions[actualIdx]) {
                                setSupplierSearch(suggestions[actualIdx].name);
                                setPoFormData(prev => ({ ...prev, supplier_id: String(suggestions[actualIdx].id) }));
                                setShowSupplierSuggestions(false);
                                setSupplierSearchFocusedIndex(-1);
                              } else if (supplierSearch.trim()) {
                                // Auto-create on enter even if not navigating list
                                const created = await createOrGetSupplier(supplierSearch.trim());
                                if (created) {
                                  setSupplierSearch(created.name);
                                  setPoFormData(prev => ({ ...prev, supplier_id: String(created.id) }));
                                  setShowSupplierSuggestions(false);
                                }
                              }
                            }
                          }
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (supplierSearch.trim()) {
                            const created = await createOrGetSupplier(supplierSearch.trim());
                            if (created) {
                              setSupplierSearch(created.name);
                              setPoFormData(prev => ({ ...prev, supplier_id: String(created.id) }));
                            }
                          }
                        }
                      }}
                      placeholder="Search or enter supplier name..."
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                    />

                    {showSupplierSuggestions && (() => {
                      const query = supplierSearch.toLowerCase().trim();
                      const suggestions = suppliers.filter(s =>
                        s.name && s.name.toLowerCase().includes(query)
                      );
                      // Master catalog supplier names that are NOT already in local suppliers list
                      const localNames = new Set(suppliers.map(s => s.name && s.name.trim().toLowerCase()).filter(Boolean));
                      const catalogOnlySuggestions = masterSupplierNames.filter(name =>
                        name && name.toLowerCase().includes(query) && !localNames.has(name.trim().toLowerCase())
                      );
                      const exactMatch = query !== '' && (
                        suppliers.some(s => s.name && s.name.trim().toLowerCase() === query) ||
                        masterSupplierNames.some(n => n && n.trim().toLowerCase() === query)
                      );
                      const showCreateOption = query !== '' && !exactMatch;

                      // Always show dropdown when focused — even if no results yet (loading state)
                      if (suggestions.length === 0 && catalogOnlySuggestions.length === 0 && !showCreateOption) {
                        // Show a loading/empty hint
                        return (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 divide-y divide-slate-100">
                            <div className="p-3 text-xs text-slate-400 text-center">
                              {masterSupplierNames.length === 0 && suppliers.length === 0
                                ? 'Loading suppliers...'
                                : query
                                  ? 'No matching suppliers found'
                                  : 'Type to search or scroll below'}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {showCreateOption && (
                            <div
                              onClick={async () => {
                                const created = await createOrGetSupplier(supplierSearch.trim());
                                if (created) {
                                  setSupplierSearch(created.name);
                                  setPoFormData(prev => ({ ...prev, supplier_id: String(created.id) }));
                                  setShowSupplierSuggestions(false);
                                  // Refresh master catalog for newly selected supplier
                                  if (poFormData.is_new) {
                                    fetchMasterCatalogForSupplier(created.name);
                                  }
                                }
                              }}
                              className={`p-2.5 px-3 hover:bg-emerald-50 cursor-pointer text-left transition-colors text-emerald-700 font-bold text-xs flex items-center justify-between ${supplierSearchFocusedIndex === 0 ? 'bg-emerald-100 ring-1 ring-emerald-500' : ''}`}
                            >
                              <span>+ Create New Supplier "{supplierSearch.trim()}"</span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-normal">Auto-create</span>
                            </div>
                          )}
                          {/* Local directory suppliers */}
                          {suggestions.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">Your Suppliers</div>
                              {suggestions.map((s, idx) => {
                                const optionIndex = showCreateOption ? idx + 1 : idx;
                                return (
                                  <div
                                    key={s.id}
                                    onClick={() => {
                                      setSupplierSearch(s.name);
                                      setPoFormData(prev => ({ ...prev, supplier_id: String(s.id) }));
                                      setShowSupplierSuggestions(false);
                                      // Refresh master catalog for newly selected supplier
                                      if (poFormData.is_new) {
                                        fetchMasterCatalogForSupplier(s.name);
                                      } else {
                                        setMasterCatalogProducts([]);
                                      }
                                    }}
                                    className={`p-2 px-3 hover:bg-indigo-50 cursor-pointer text-left transition-colors ${supplierSearchFocusedIndex === optionIndex ? 'bg-indigo-100 ring-1 ring-indigo-500' : ''}`}
                                  >
                                    <div className="text-xs font-semibold text-slate-800">{s.name}</div>
                                    {s.contact_name && <div className="text-[10px] text-slate-400">Contact: {s.contact_name}</div>}
                                  </div>
                                );
                              })}
                            </>
                          )}
                          {/* Master Catalog supplier names (from super admin) not yet in local directory */}
                          {catalogOnlySuggestions.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 text-[10px] font-bold text-violet-500 uppercase tracking-wider bg-violet-50 flex items-center gap-1.5">
                                <span>🏢</span> Super Admin Catalog
                              </div>
                              {catalogOnlySuggestions.map((name, idx) => {
                                const optionIndex = showCreateOption
                                  ? suggestions.length + idx + 1
                                  : suggestions.length + idx;
                                return (
                                  <div
                                    key={`catalog-${name}`}
                                    onClick={async () => {
                                      // Auto-create this supplier locally so we can store supplier_id
                                      const created = await createOrGetSupplier(name);
                                      if (created) {
                                        setSupplierSearch(created.name);
                                        setPoFormData(prev => ({ ...prev, supplier_id: String(created.id) }));
                                        setShowSupplierSuggestions(false);
                                        if (poFormData.is_new) {
                                          fetchMasterCatalogForSupplier(created.name);
                                        } else {
                                          setMasterCatalogProducts([]);
                                        }
                                      }
                                    }}
                                    className={`p-2 px-3 hover:bg-violet-50 cursor-pointer text-left transition-colors ${supplierSearchFocusedIndex === optionIndex ? 'bg-violet-100 ring-1 ring-violet-500' : ''}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-slate-800">{name}</span>
                                      <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold ml-2 shrink-0">Catalog</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Choose Product *</label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductSuggestions(true);
                    setProductSearchFocusedIndex(-1);
                  }}
                  onFocus={() => { setShowProductSuggestions(true); setProductSearchFocusedIndex(-1); }}
                  onBlur={() => setTimeout(() => setShowProductSuggestions(false), 250)}
                  onKeyDown={(e) => {
                    if (showProductSuggestions) {
                      const query = productSearch.toLowerCase();
                      const suggestions = groupedProductNames.filter(g => {
                        const matchesSearch = g.name.toLowerCase().includes(query);
                        // Show all products from All Product Names page regardless of supplier
                        return matchesSearch;
                      });
                      const totalOptions = suggestions.length + 1; // +1 for the "Create New" option
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setProductSearchFocusedIndex(prev => (prev < totalOptions - 1 ? prev + 1 : prev));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setProductSearchFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (productSearchFocusedIndex === 0) {
                          setProductSearch('+ New Product (Create on-the-fly)');
                          handlePoProductChange('new_product');
                          setShowProductSuggestions(false);
                          setProductSearchFocusedIndex(-1);
                        } else if (productSearchFocusedIndex > 0 && suggestions[productSearchFocusedIndex - 1]) {
                          const g = suggestions[productSearchFocusedIndex - 1];
                          setProductSearch(g.name);
                          // Use the default product (first one) for the group
                          handlePoProductChange(String(g.defaultProduct.id));
                          setShowProductSuggestions(false);
                          setProductSearchFocusedIndex(-1);
                        }
                      }
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Search existing product (Name or SKU)..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                />

                {showProductSuggestions && (() => {
                  const query = productSearch.toLowerCase();
                  const suggestions = groupedProductNames.filter(g => {
                    const matchesSearch = g.name.toLowerCase().includes(query);
                    // Show all products from All Product Names page regardless of supplier
                    // Supplier selection is for the PO itself, not for filtering products
                    return matchesSearch;
                  });

                  return (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      <div
                        onClick={() => {
                          setProductSearch('+ New Product (Create on-the-fly)');
                          handlePoProductChange('new_product');
                          setShowProductSuggestions(false);
                        }}
                        className={`p-2.5 px-3 hover:bg-indigo-50 cursor-pointer text-left transition-colors text-indigo-650 font-bold text-xs ${productSearchFocusedIndex === 0 ? 'bg-indigo-100 ring-1 ring-indigo-500' : ''}`}
                      >
                        + Create New Product On-The-Fly
                      </div>
                      {suggestions.map((g, idx) => (
                        <div
                          key={g.name}
                          onClick={() => {
                            setProductSearch(g.name);
                            // Use the default product (first one) for the group
                            handlePoProductChange(String(g.defaultProduct.id));
                            setShowProductSuggestions(false);
                          }}
                          className={`p-2 px-3 hover:bg-indigo-50 cursor-pointer text-left transition-colors ${productSearchFocusedIndex === idx + 1 ? 'bg-indigo-100 ring-1 ring-indigo-500' : ''}`}
                        >
                          <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                            <span>{g.name}</span>
                            {g.allSkus.length > 1 && (
                              <span className="text-[10px] bg-amber-50 text-amber-700 font-medium px-1.5 py-0.5 rounded border border-amber-100">
                                {g.allSkus.length} variants
                              </span>
                            )}
                            {g.defaultProduct.supplier_name && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-1.5 py-0.5 rounded border border-indigo-100">
                                🏢 {g.defaultProduct.supplier_name}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex justify-between mt-0.5">
                            <span>SKU: {g.defaultProduct.sku || 'Auto-generated'}</span>
                            <span>Stock: {g.defaultProduct.stock_quantity} left</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Product Name *
                  {poFormData.is_new && masterCatalogProducts.length > 0 && (
                    <span className="ml-2 text-[10px] font-normal bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">
                      {masterCatalogProducts.length} from catalog
                    </span>
                  )}
                </label>
                {poFormData.is_new || editingCartItemIndex !== null ? (
                  <>
                    <input
                      type="text"
                      value={poFormData.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMasterProductNameInput(val);
                        setShowMasterProductSuggestions(val.trim().length >= 0);

                        // Check if typed name matches a product in master catalog and auto-fill category
                        const match = masterCatalogProducts.find(
                          mp => mp.product_name && mp.product_name.trim().toLowerCase() === val.trim().toLowerCase()
                        );
                        setPoFormData(prev => ({
                          ...prev,
                          name: val,
                          category: (match && match.category) ? match.category : prev.category
                        }));
                      }}
                      onFocus={() => {
                        setShowMasterProductSuggestions(true);
                        // Fetch master catalog if supplier is selected
                        const supName = supplierSearch.trim();
                        fetchMasterCatalogForSupplier(supName);
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowMasterProductSuggestions(false), 220);
                        const currentName = (poFormData.name || '').trim().toLowerCase();
                        if (currentName) {
                          const match = masterCatalogProducts.find(
                            mp => mp.product_name && mp.product_name.trim().toLowerCase() === currentName
                          );
                          if (match && match.category && !poFormData.category) {
                            setPoFormData(prev => ({ ...prev, category: match.category }));
                          }
                        }
                      }}
                      required
                      placeholder="Type product name or pick from catalog..."
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold"
                      autoComplete="off"
                    />
                    {showMasterProductSuggestions && (() => {
                      const query = (poFormData.name || '').toLowerCase().trim();
                      const filteredMaster = masterCatalogProducts.filter(p =>
                        !query || p.product_name.toLowerCase().includes(query)
                      );
                      if (filteredMaster.length === 0) return null;
                      return (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-indigo-200 rounded-lg shadow-xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-100">
                          <div className="px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">📦 Superadmin Catalog Suggestions</span>
                            <span className="text-[10px] text-indigo-500 font-medium">Click to auto-fill</span>
                          </div>
                          {filteredMaster.map((p) => (
                            <div
                              key={p.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setPoFormData(prev => ({
                                  ...prev,
                                  name: p.product_name,
                                  category: p.category || prev.category || ''
                                }));
                                // If supplier is not set yet, auto set it from catalog
                                if (!supplierSearch.trim() && p.supplier_name) {
                                  setSupplierSearch(p.supplier_name);
                                  createOrGetSupplier(p.supplier_name).then(created => {
                                    if (created) {
                                      setPoFormData(prev => ({ ...prev, supplier_id: String(created.id) }));
                                    }
                                  });
                                }
                                setShowMasterProductSuggestions(false);
                              }}
                              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-800">{p.product_name}</span>
                                {p.category && (
                                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.5 rounded border border-indigo-100">
                                    🏷️ {p.category}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-indigo-500 font-medium mt-0.5">🏢 {p.supplier_name}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <input
                    type="text"
                    value={poFormData.name}
                    disabled
                    placeholder="Product Name"
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none bg-slate-50 font-semibold cursor-not-allowed text-slate-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">SKU / Code (Optional)</label>
                <input
                  type="text"
                  value={poFormData.sku || ''}
                  onChange={(e) => setPoFormData({ ...poFormData, sku: e.target.value })}
                  placeholder="Auto-generated if empty"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Category
                  {poFormData.category && (
                    <span className="ml-2 text-[10px] font-normal text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                      ✓ Auto-filled
                    </span>
                  )}
                </label>
                <input
                  list="po-categories-list"
                  type="text"
                  value={poFormData.category || ''}
                  onChange={(e) => setPoFormData({ ...poFormData, category: e.target.value })}
                  placeholder="Search or enter category"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold"
                />
                <datalist id="po-categories-list">
                  {Array.from(new Set([
                    ...productsList.map(p => p.category),
                    ...masterCatalogProducts.map(p => p.category),
                    ...masterCategories
                  ].filter(Boolean))).map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Price (৳) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={poFormData.cost_price}
                  onChange={(e) => handleCostPriceChange(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sale Price (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  value={poFormData.selling_price}
                  onChange={(e) => handleSellingPriceChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">%</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={poFormData.discount_percent !== undefined ? poFormData.discount_percent : ''}
                    onChange={(e) => handleDiscountPercentChange(e.target.value)}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg p-2.5 pr-7 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity to Order</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={poFormData.quantity_ordered}
                  onChange={(e) => setPoFormData({ ...poFormData, quantity_ordered: e.target.value })}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={poFormData.expiry_date || ''}
                  onChange={(e) => setPoFormData({ ...poFormData, expiry_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Unit *</label>
                <input
                  list="unit-options"
                  value={poFormData.unit}
                  onChange={(e) => setPoFormData({ ...poFormData, unit: e.target.value })}
                  placeholder="e.g. piece, kg, box"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                />
                <datalist id="unit-options">
                  <option value="piece" />
                  <option value="kg" />
                  <option value="gm" />
                  <option value="liter" />
                  <option value="packet" />
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Basis *</label>
                <select
                  value={poFormData.payment_basis}
                  onChange={(e) => setPoFormData({ ...poFormData, payment_basis: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div>
                {poFormData.payment_basis === 'credit' && (
                  <>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Initial Paid Amount (৳)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={calculatePOTotal()}
                      value={poFormData.paid_amount}
                      onChange={(e) => setPoFormData({ ...poFormData, paid_amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Instructions</label>
                <input
                  type="text"
                  value={poFormData.notes}
                  onChange={(e) => setPoFormData({ ...poFormData, notes: e.target.value })}
                  placeholder="e.g. Rush order for holiday stock"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 mb-4"
                />
              </div>
            </div>

            {/* Add to Cart Button */}
            <div className="flex gap-2">
              {editingCartItemIndex !== null && (
                <button
                  type="button"
                  onClick={cancelEditCartItem}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel Edit</span>
                </button>
              )}
              <button
                type="button"
                onClick={addToPoCart}
                className="flex-1 bg-gray-600 hover:bg-yellow-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={editingCartItemIndex !== null ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
                </svg>
                <span>{editingCartItemIndex !== null ? 'Update Product in Cart' : 'Add Product to Cart'}</span>
              </button>
            </div>

            {/* CSV Upload Section */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-700">Or Upload Products via CSV</h4>
                <button
                  type="button"
                  onClick={() => setShowPoCsvUpload(!showPoCsvUpload)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  {showPoCsvUpload ? 'Hide' : 'Show CSV Upload'}
                </button>
              </div>

              {showPoCsvUpload && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold mb-1">CSV Format (columns):</p>
                    <code className="bg-slate-200 px-2 py-1 rounded text-xs">supplier_name, product_name, sku, category, cost_price, selling_price, quantity_ordered, expiry_date, unit</code>
                    <p className="mt-2 text-slate-500">Required: supplier_name, product_name, cost_price, quantity_ordered</p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setPoCsvFile(e.target.files[0])}
                      disabled={poCsvUploading}
                      className="flex-1 text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handlePoCsvUpload}
                      disabled={!poCsvFile || poCsvUploading}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {poCsvUploading ? 'Uploading...' : 'Upload CSV'}
                    </button>
                  </div>

                  {/* Progress Bar */}
                  {poCsvUploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{csvUploadStatus || 'Processing...'}</span>
                        <span className="text-slate-500">
                          {csvUploadCurrentRow} / {csvUploadTotalRows} rows
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${csvUploadProgress}%` }}
                        ></div>
                      </div>
                      <div className="text-center text-xs font-bold text-indigo-600">
                        {csvUploadProgress.toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart Display */}
            {poCart.length > 0 && (
              <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50">
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
                  <span>Order Cart ({poCart.length} items)</span>
                  <span className="text-xs font-normal text-slate-500">Total: {formatCurrency(calculatePOTotal())}</span>
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {poCart.map((item, index) => (
                    <div key={index} className={`flex items-center justify-between bg-white border border-slate-100 rounded-lg p-3 text-sm ${editingCartItemIndex === index ? 'ring-2 ring-indigo-500' : ''}`}>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">
                          {item.name} {item.category && <span className="ml-1.5 px-1.5 py-0.25 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-100">{item.category}</span>}
                          {item.expiry_date && <span className="ml-1.5 px-1.5 py-0.25 bg-amber-50 text-amber-700 rounded text-[10px] font-bold border border-amber-100">Exp: {item.expiry_date}</span>}
                          {editingCartItemIndex === index && <span className="ml-1.5 px-1.5 py-0.25 bg-amber-50 text-amber-700 rounded text-[10px] font-bold border border-amber-100">Editing</span>}
                        </div>
                        <div className="text-slate-600 mt-1.5 flex items-center gap-2">
                          <span className="font-bold text-slate-700">{item.sku || 'Auto SKU'}</span>
                          <span>•</span>
                          <div className="flex items-center border border-slate-200 rounded">
                            <button
                              type="button"
                              onClick={() => {
                                const newCart = [...poCart];
                                newCart[index].quantity_ordered = Math.max(1, (newCart[index].quantity_ordered || 1) - 1);
                                setPoCart(newCart);
                              }}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm"
                            >-</button>
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={item.quantity_ordered}
                              onChange={(e) => {
                                const newCart = [...poCart];
                                newCart[index].quantity_ordered = e.target.value === '' ? '' : Math.max(1, parseFloat(e.target.value) || 1);
                                setPoCart(newCart);
                              }}
                              className="w-14 text-center text-sm font-bold outline-none py-0.5 hide-arrow"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newCart = [...poCart];
                                newCart[index].quantity_ordered = (parseFloat(newCart[index].quantity_ordered) || 0) + 1;
                                setPoCart(newCart);
                              }}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm"
                            >+</button>
                          </div>
                          <span>• <span className="font-bold text-slate-700">Tk {item.cost_price.toFixed(2)}</span> × {item.quantity_ordered} = <span className="font-bold text-slate-800">Tk {(item.cost_price * (parseFloat(item.quantity_ordered) || 0)).toFixed(2)}</span></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          onClick={() => editCartItem(index)}
                          className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded"
                          title="Edit product"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromPoCart(index)}
                          className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded"
                          title="Remove product"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm font-bold text-slate-700 flex flex-col space-y-1">
                <div>
                  Running PO Total: <span className="text-lg font-black text-slate-800">{formatCurrency(calculatePOTotal())}</span>
                </div>
                {isEditPoMode && poFormData.previous_total !== undefined && (
                  <div className="text-xs text-slate-500">
                    Previous Total: <span className="text-sm font-bold text-slate-600">{formatCurrency(poFormData.previous_total)}</span>
                    {calculatePOTotal() !== poFormData.previous_total && (
                      <span className={`ml-2 font-bold ${calculatePOTotal() > poFormData.previous_total ? 'text-rose-600' : 'text-emerald-600'}`}>
                        ({calculatePOTotal() > poFormData.previous_total ? '+' : ''}{formatCurrency(calculatePOTotal() - poFormData.previous_total)})
                      </span>
                    )}
                  </div>
                )}
                {poFormData.payment_basis === 'credit' && (
                  <div className="text-xs text-slate-500">
                    Remaining Due: <span className="text-sm font-bold text-rose-650">
                      {isEditPoMode && selectedPo
                        ? formatCurrency(selectedPo.due_amount || 0)
                        : formatCurrency(calculatePOTotal() - (parseFloat(poFormData.paid_amount || 0)))
                      }
                    </span>
                  </div>
                )}
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => { setShowAddPoModal(false); setIsEditPoMode(false); setEditingCartItemIndex(null); }}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => handlePoSubmit(e, 'received')}
                  disabled={isEditPoMode && !isAdmin}
                  className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{isEditPoMode ? 'Confirm & Update Order' : 'Confirm Order'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function handlePrintPo() {
    if (!selectedPo) return;
    const printWindow = window.open('', 'PRINT', 'height=800,width=1000');
    const totalAmount = selectedPo.items.reduce((sum, item) => sum + ((item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity) * (item.cost_price !== undefined ? item.cost_price : item.unit_price)), 0);
    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Order #${selectedPo.id}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
            .header h1 { margin: 0 0 10px 0; font-size: 28px; color: #0f172a; }
            .header p { margin: 0; color: #64748b; font-size: 14px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .info-box { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .info-box h4 { margin: 0 0 5px 0; font-size: 12px; color: #64748b; text-transform: uppercase; }
            .info-box p { margin: 0; font-size: 14px; font-weight: 600; color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 11px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totals { display: flex; justify-content: flex-end; margin-top: 20px; }
            .totals table { width: 300px; border: none; }
            .totals th, .totals td { border: none; padding: 8px; }
            .totals th { text-align: left; background: none; color: #64748b; font-size: 13px; }
            .totals td { text-align: right; font-weight: 600; font-size: 14px; }
            .grand-total { border-top: 2px solid #cbd5e1 !important; font-size: 16px !important; color: #0f172a !important; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Purchase Order</h1>
            <p>Order ID: #PO-${selectedPo.id} | Date: ${formatDate(selectedPo.order_date)}</p>
          </div>
          
          <div class="info-grid">
            <div class="info-box">
              <h4>Supplier Details</h4>
              <p>${selectedPo.supplier_name}</p>
              <p style="font-weight: 400; font-size: 13px;">${selectedPo.supplier_phone || ''}</p>
              <p style="font-weight: 400; font-size: 13px;">${selectedPo.supplier_email || ''}</p>
            </div>
            <div class="info-box">
              <h4>Order Information</h4>
              <p>Status: <span style="text-transform: uppercase;">${selectedPo.status}</span></p>
              <p>Payment Basis: <span style="text-transform: uppercase;">${selectedPo.payment_basis || 'CASH'}</span></p>
              <p>Received Date: ${selectedPo.received_date ? formatDate(selectedPo.received_date) : '-'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th class="text-center">Qty Ordered</th>
                <th class="text-center">Qty Received</th>
                <th class="text-right">Cost Price</th>
                <th class="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${selectedPo.items.map(item => `
                <tr>
                  <td>${item.product_sku}</td>
                  <td>${item.product_name}</td>
                  <td class="text-center">${item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity} ${item.product_unit || ''}</td>
                  <td class="text-center">${selectedPo.status === 'received' ? item.quantity_received : '-'} ${selectedPo.status === 'received' && item.product_unit ? item.product_unit : ''}</td>
                  <td class="text-right">Tk ${(item.cost_price !== undefined ? item.cost_price : item.unit_price).toFixed(2)}</td>
                  <td class="text-right">Tk ${((item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity) * (item.cost_price !== undefined ? item.cost_price : item.unit_price)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr>
                <th>Total Amount:</th>
                <td>Tk ${totalAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <th>Paid Amount:</th>
                <td>Tk ${parseFloat(selectedPo.paid_amount || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <th class="grand-total">Due Amount:</th>
                <td class="grand-total">Tk ${parseFloat(selectedPo.due_amount || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>
          
          ${selectedPo.notes ? `<div style="margin-top: 30px; font-size: 13px;"><strong style="color: #64748b; text-transform: uppercase; font-size: 11px;">Notes:</strong><br/>${selectedPo.notes}</div>` : ''}
          
          <div style="margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
            Generated by POS System
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  // PO DETAILS VIEW MODAL
  function renderPoDetailsModal() {
    if (!selectedPo) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-100 gap-3">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Purchase Order Detail</span>
              <h3 className="text-lg font-black text-slate-800">#PO-{selectedPo.id}</h3>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePrintPo}
                className="text-emerald-600 hover:text-emerald-800 font-semibold text-sm border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1"
                title="Print Invoice"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print</span>
              </button>
              <button
                onClick={() => {
                  setShowPoDetailsModal(false);
                  openEditPo(selectedPo);
                }}
                disabled={!isAdmin}
                className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit
              </button>
              <button onClick={() => setShowPoDetailsModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="block text-xs font-bold text-slate-400">SUPPLIER</span>
                <span className="font-semibold text-slate-700 block">{selectedPo.supplier_name}</span>
                <span className="block text-xs text-slate-500">{selectedPo.supplier_phone} · {selectedPo.supplier_email}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">PO STATUS</span>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mt-1 ${getStatusBadge(selectedPo.status)}`}>
                  {selectedPo.status}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">PAYMENT BASIS</span>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mt-1 uppercase ${selectedPo.payment_basis === 'credit'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                  {selectedPo.payment_basis || 'cash'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">ORDER DATE</span>
                <span className="font-semibold text-slate-700">{formatDate(selectedPo.order_date)}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">RECEIVED DATE</span>
                <span className="font-semibold text-slate-700">
                  {selectedPo.received_date ? formatDate(selectedPo.received_date) : '-'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">PAID VS DUE</span>
                <span className="font-semibold text-slate-700 block mt-1">
                  {formatCurrency(selectedPo.paid_amount || 0)} / <span className={parseFloat(selectedPo.due_amount) > 0 ? "text-rose-600 font-extrabold" : "text-slate-500"}>{formatCurrency(selectedPo.due_amount || 0)}</span>
                </span>
              </div>
              {selectedPo.notes && (
                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                  <span className="block text-xs font-bold text-slate-400">NOTES</span>
                  <span className="font-medium text-slate-650 italic">"{selectedPo.notes}"</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Order Line Items</h4>
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="p-3 whitespace-nowrap">SKU</th>
                      <th className="p-3 whitespace-nowrap">Product Name</th>
                      <th className="p-3 whitespace-nowrap">Cost Price</th>
                      <th className="p-3 whitespace-nowrap hidden sm:table-cell">Sale Price</th>
                      <th className="p-3 whitespace-nowrap">Qty Ordered</th>
                      <th className="p-3 whitespace-nowrap">Qty Received</th>
                      <th className="p-3 whitespace-nowrap hidden md:table-cell">Expiry Date</th>
                      <th className="p-3 whitespace-nowrap text-right">Subtotal</th>
                      {['draft', 'ordered'].includes(selectedPo.status) && (
                        <th className="p-3 whitespace-nowrap text-center">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPo.items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-3 font-mono font-bold text-slate-500 whitespace-nowrap">{item.product_sku}</td>
                        <td className="p-3 font-semibold text-slate-800">
                          <div className="max-w-xs">{item.product_name}</div>
                        </td>
                        <td className="p-3 text-slate-650 whitespace-nowrap">{formatCurrency(item.cost_price !== undefined ? item.cost_price : item.unit_price)}</td>
                        <td className="p-3 text-slate-650 whitespace-nowrap hidden sm:table-cell">{formatCurrency(item.selling_price || 0)}</td>
                        <td className="p-3 text-slate-700 font-semibold whitespace-nowrap">
                          {item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity} {item.product_unit && <span className="text-xs font-normal text-slate-500">{item.product_unit}</span>}
                        </td>
                        <td className="p-3 text-slate-750 whitespace-nowrap">
                          {selectedPo.status === 'received' ? (
                            <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              {item.quantity_received} {item.product_unit && <span className="font-normal">{item.product_unit}</span>}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 whitespace-nowrap hidden md:table-cell">
                          {item.expiry_date ? (
                            <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-amber-100">
                              {new Date(item.expiry_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-extrabold text-slate-800 whitespace-nowrap">
                          {formatCurrency((item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity) * (item.cost_price !== undefined ? item.cost_price : item.unit_price))}
                        </td>
                        {['draft', 'ordered'].includes(selectedPo.status) && (
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDeletePoItem(selectedPo.id, item.product_id)}
                              className="text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 border border-rose-100 px-2 py-0.5 rounded transition-all text-[10px]"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              {selectedPo.payment_basis === 'credit' && parseFloat(selectedPo.due_amount) > 0 && ['ordered', 'received'].includes(selectedPo.status) && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex-1">
                  <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Record Payment to Supplier</h4>
                  <form onSubmit={handlePayPoDue} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">৳</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={parseFloat(selectedPo.due_amount)}
                        value={poPaymentAmount}
                        onChange={(e) => setPoPaymentAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-4 rounded-lg text-xs shadow-sm transition-colors"
                    >
                      Pay Supplier
                    </button>
                  </form>
                </div>
              )}
              <div className="text-right text-sm font-bold text-slate-700 md:ml-auto self-end">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Order Value</div>
                <span className="text-lg font-black text-slate-800">{formatCurrency(selectedPo.items.reduce((sum, item) => sum + ((item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity) * (item.cost_price !== undefined ? item.cost_price : item.unit_price)), 0))}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={() => setShowPoDetailsModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            {selectedPo.status === 'ordered' && (
              <button
                onClick={() => openReceiveModal(selectedPo)}
                className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Confirm Receive Stocks
              </button>
            )}
            {selectedPo.status === 'draft' && (
              <button
                onClick={() => updatePoStatus(selectedPo.id, 'ordered')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Place Order
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // CONFIRM STOCK RECEIVING DIALOG
  function renderReceiveModal() {
    if (!selectedPo) return null;

    const handleReceivedQtyChange = (idx, val) => {
      const updated = [...receiveItems];
      updated[idx].quantity_received = val === '' || val === '-' ? val : parseInt(val, 10);
      setReceiveItems(updated);
    };

    const handleReceivedCostChange = (idx, val) => {
      const updated = [...receiveItems];
      updated[idx].cost_price = parseFloat(val) || 0.00;
      setReceiveItems(updated);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col my-8 max-h-[85vh]">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Confirm Stock Receipt</span>
              <h3 className="text-lg font-black text-slate-800">Review PO #PO-{selectedPo.id}</h3>
            </div>
            <button onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleConfirmReceive} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
            <p className="text-xs text-slate-500">
              Please count the physically received items below. Updating the cost price will automatically update the product's default purchase price in inventory and log a cost tracking entry.
            </p>

            <div className="space-y-3">
              {receiveItems.map((item, idx) => (
                <div key={item.product_id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{item.product_name}</h4>
                      <span className="text-xs font-mono font-bold text-slate-400">{item.sku}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      Ordered: <strong className="text-slate-700">{item.quantity_ordered} pcs</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Quantity Received
                      </label>
                      <input
                        type="number"
                        value={item.quantity_received}
                        onChange={(e) => handleReceivedQtyChange(idx, e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Actual Unit Cost (৳)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.cost_price}
                        onChange={(e) => handleReceivedCostChange(idx, e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Actual Unit Sale (৳)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.selling_price || 0.00}
                        onChange={(e) => handleReceivedSaleChange(idx, e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Expire Date
                      </label>
                      <input
                        type="date"
                        value={item.expiry_date || ''}
                        onChange={(e) => handleReceivedExpiryChange(idx, e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Receiving Notes</label>
              <input
                type="text"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder="e.g. 2 items damaged, signed receipt attached"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Confirm Receipt & Adjust Inventory
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // RETURN EXPIRED PRODUCT MODAL (UPGRADED)
  function renderReturnModal() {
    if (!selectedExpiredProduct) return null;
    const unitCost = returnFormData.unit_cost !== '' ? parseFloat(returnFormData.unit_cost) : (parseFloat(selectedExpiredProduct.cost_price) || 0);
    const qty = parseInt(returnFormData.quantity) || 0;
    const totalVal = qty * unitCost;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-hidden flex flex-col my-8">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Initiate Product Return</span>
              <h3 className="text-lg font-bold text-slate-800">{selectedExpiredProduct.name}</h3>
              <span className="text-xs font-mono text-slate-400">{selectedExpiredProduct.sku}</span>
            </div>
            <button onClick={() => { setShowReturnModal(false); setSelectedExpiredProduct(null); }} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleReturnSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Qty to Return (Max {selectedExpiredProduct.stock_quantity}) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedExpiredProduct.stock_quantity}
                  value={returnFormData.quantity}
                  onChange={(e) => {
                    const q = e.target.value;
                    const u = returnFormData.unit_cost !== '' ? parseFloat(returnFormData.unit_cost) : (parseFloat(selectedExpiredProduct.cost_price) || 0);
                    setReturnFormData(prev => ({
                      ...prev,
                      quantity: q,
                      refund_amount: String((parseInt(q) || 0) * u)
                    }));
                  }}
                  required
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Return Unit Cost (৳)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={returnFormData.unit_cost !== '' ? returnFormData.unit_cost : (selectedExpiredProduct.cost_price || '')}
                  onChange={(e) => {
                    const u = e.target.value;
                    const q = parseInt(returnFormData.quantity) || 0;
                    setReturnFormData(prev => ({
                      ...prev,
                      unit_cost: u,
                      refund_amount: String(q * (parseFloat(u) || 0))
                    }));
                  }}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                />
              </div>
            </div>

            {/* Total Return Worth Calculation */}
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Return Claim Value</span>
                <span className="text-xs text-rose-600">{qty} units @ {formatCurrency(unitCost)}</span>
              </div>
              <span className="text-lg font-black text-rose-900">{formatCurrency(totalVal)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Return Reason</label>
                <select
                  value={returnFormData.reason}
                  onChange={(e) => setReturnFormData({ ...returnFormData, reason: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                >
                  <option value="Expired">Expired Product Batch</option>
                  <option value="Near Expiry">Near-Expiry Warning</option>
                  <option value="Damaged Goods">Damaged Goods / Packaging</option>
                  <option value="Defective Quality">Defective Quality / Spoiled</option>
                  <option value="Wrong Item Delivered">Wrong Item Delivered</option>
                  <option value="Overstock Return">Overstock / Consignment Return</option>
                  <option value="Other">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Settlement Method</label>
                <select
                  value={returnFormData.settlement_type}
                  onChange={(e) => setReturnFormData({ ...returnFormData, settlement_type: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                >
                  <option value="deduct_due">💳 Deduct from Supplier Due</option>
                  <option value="cash_refund">💵 Cash / Bank Refund</option>
                  <option value="credit_note">📜 Supplier Credit Note</option>
                  <option value="none">🚫 No Financial Claim (Loss)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Reason Details</label>
              <textarea
                value={returnFormData.notes}
                onChange={(e) => setReturnFormData({ ...returnFormData, notes: e.target.value })}
                placeholder="e.g. Expired batch returned to representative; ledger credited"
                rows="2"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-rose-500 bg-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => { setShowReturnModal(false); setSelectedExpiredProduct(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                Submit Return & Adjust Stock
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // REPLACE EXPIRED PRODUCT MODAL (UPGRADED)
  function renderReplaceModal() {
    if (!selectedExpiredProduct) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Product Replacement</span>
              <h3 className="text-lg font-bold text-slate-800">{selectedExpiredProduct.name}</h3>
              <span className="text-xs font-mono text-slate-400">{selectedExpiredProduct.sku}</span>
            </div>
            <button onClick={() => { setShowReplaceModal(false); setSelectedExpiredProduct(null); }} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleReplaceSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity Replaced *</label>
                <input
                  type="number"
                  min="1"
                  value={replaceFormData.quantity}
                  onChange={(e) => setReplaceFormData({ ...replaceFormData, quantity: e.target.value })}
                  required
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">New Expiry Date *</label>
                <input
                  type="date"
                  min={new Date().toBDISODateString()}
                  value={replaceFormData.new_expiry_date}
                  onChange={(e) => setReplaceFormData({ ...replaceFormData, new_expiry_date: e.target.value })}
                  required
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Replacement Reason</label>
              <input
                type="text"
                value={replaceFormData.reason}
                onChange={(e) => setReplaceFormData({ ...replaceFormData, reason: e.target.value })}
                placeholder="e.g. Expired batch replaced with fresh batch"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Batch Details</label>
              <textarea
                value={replaceFormData.notes}
                onChange={(e) => setReplaceFormData({ ...replaceFormData, notes: e.target.value })}
                placeholder="e.g. Replaced by supplier representative; verified unexpired"
                rows="2"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => { setShowReplaceModal(false); setSelectedExpiredProduct(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                Confirm Replacement
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // BULK RETURN & REPLACE MODAL
  function renderBulkReturnModal() {
    if (!showBulkReturnModal) return null;
    const selectedItems = (profileData.expiredProducts || []).filter(p => selectedExpiryItemIds.includes(p.id));
    const totalBulkQty = selectedItems.reduce((s, p) => s + (p.stock_quantity > 0 ? p.stock_quantity : 1), 0);
    const totalBulkVal = selectedItems.reduce((s, p) => s + ((p.stock_quantity > 0 ? p.stock_quantity : 1) * (p.cost_price || 0)), 0);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className={`text-xs font-bold uppercase tracking-wider ${bulkReturnAction === 'return' ? 'text-rose-600' : 'text-emerald-600'}`}>
                Bulk {bulkReturnAction === 'return' ? 'Return to Supplier' : 'Batch Replacement'}
              </span>
              <h3 className="text-lg font-black text-slate-800">Process {selectedItems.length} Selected Items</h3>
            </div>
            <button onClick={() => setShowBulkReturnModal(false)} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleBulkReturnSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
            {/* Selected Items Review List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 p-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between border-b border-slate-200">
                <span>Selected Products ({selectedItems.length})</span>
                <span>Qty & Cost Value</span>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs p-1">
                {selectedItems.map(item => (
                  <div key={item.id} className="p-2 flex justify-between items-center hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-800 block">{item.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">{item.sku}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-700 block">{item.stock_quantity > 0 ? item.stock_quantity : 1} units</span>
                      <span className="text-[10px] text-slate-500 font-semibold">{formatCurrency((item.stock_quantity > 0 ? item.stock_quantity : 1) * (item.cost_price || 0))}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                <span>Total Summary: {totalBulkQty} total units</span>
                <span className="text-sm font-black text-rose-700">{formatCurrency(totalBulkVal)}</span>
              </div>
            </div>

            {/* Action Type Toggle */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Bulk Action</label>
                <select
                  value={bulkReturnAction}
                  onChange={(e) => setBulkReturnAction(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="return">Return to Supplier (Deduct Stock)</option>
                  <option value="replace">Replace Products (Update Expiry)</option>
                </select>
              </div>

              {bulkReturnAction === 'return' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Settlement Method</label>
                  <select
                    value={bulkReturnSettlement}
                    onChange={(e) => setBulkReturnSettlement(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="deduct_due">💳 Deduct from Supplier Due ({formatCurrency(totalBulkVal)})</option>
                    <option value="cash_refund">💵 Cash / Bank Refund Received</option>
                    <option value="credit_note">📜 Supplier Credit Note</option>
                    <option value="none">🚫 No Financial Settlement (Loss)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">Shared Replacement Expiry Date *</label>
                  <input
                    type="date"
                    min={new Date().toBDISODateString()}
                    value={bulkReturnNewExpiry}
                    onChange={(e) => setBulkReturnNewExpiry(e.target.value)}
                    required={bulkReturnAction === 'replace'}
                    className="w-full border border-emerald-300 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50/40"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Shared Return Reason</label>
              <input
                type="text"
                value={bulkReturnReason}
                onChange={(e) => setBulkReturnReason(e.target.value)}
                placeholder="e.g. Expired batch bulk return"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Batch Notes</label>
              <textarea
                value={bulkReturnNotes}
                onChange={(e) => setBulkReturnNotes(e.target.value)}
                placeholder="Add batch notes, vendor pickup details or ledger notes..."
                rows="2"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowBulkReturnModal(false)}
                disabled={bulkReturnProcessing}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bulkReturnProcessing}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {bulkReturnProcessing ? (
                  <span>Processing...</span>
                ) : (
                  <span>Confirm Bulk {bulkReturnAction === 'return' ? 'Return' : 'Replacement'} ({selectedItems.length})</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // DEBIT NOTE / SUPPLIER RETURN SLIP MODAL (PRINTABLE)
  function renderDebitNoteModal() {
    if (!selectedDebitNoteLog || !showDebitNoteModal) return null;
    const log = selectedDebitNoteLog;
    const isReturn = log.action_type === 'return';
    // Derive supplier from state — renderDebitNoteModal is outside the JSX render scope
    const sup = suppliers.find(s => s.id === selectedSupplierId) || {};

    const handlePrintDebitNote = () => {
      const printWin = window.open('', 'PRINT', 'height=850,width=900');
      if (!printWin) {
        alert('Pop-up was blocked. Please allow pop-ups for this site and try again.');
        return;
      }
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Debit Note Voucher #${log.reference_no || log.id}</title>
            <style>
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; line-height: 1.5; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 25px; }
              .header h1 { margin: 0; font-size: 24px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; }
              .header p { margin: 4px 0 0 0; color: #64748b; font-size: 13px; }
              .badge { display: inline-block; background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; text-transform: uppercase; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
              .card { background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; }
              .card h4 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
              .card p { margin: 2px 0; font-size: 13px; font-weight: 600; color: #334155; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; }
              th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; }
              td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
              .text-right { text-align: right; }
              .totals-box { margin-left: auto; width: 320px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 35px; }
              .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 13px; }
              .totals-row.grand { background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 800; font-size: 15px; color: #0f172a; }
              .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
              .sig-line { border-top: 1px dashed #94a3b8; padding-top: 8px; text-align: center; font-size: 12px; font-weight: 600; color: #475569; }
              @media print {
                body { padding: 0; }
                button { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1>DEBIT NOTE / RETURN VOUCHER</h1>
                <p>Voucher Ref: <strong>#${log.reference_no || ('SR-' + log.id)}</strong></p>
                <p>Date Generated: ${formatDate(log.created_at)}</p>
              </div>
              <div>
                <span class="badge">${log.action_type === 'return' ? 'Goods Return' : 'Replacement'}</span>
              </div>
            </div>

            <div class="grid">
              <div class="card">
                <h4>Vendor / Supplier Details</h4>
                <p style="font-size: 15px; color: #0f172a;">${sup.name || 'Supplier'}</p>
                <p style="font-weight: 400;">Phone: ${sup.phone || 'N/A'}</p>
                <p style="font-weight: 400;">Email: ${sup.email || 'N/A'}</p>
                <p style="font-weight: 400;">Contact: ${sup.contact_name || 'N/A'}</p>
              </div>
              <div class="card">
                <h4>Return Settlement & Reference</h4>
                <p>Settlement: <span style="text-transform: uppercase;">${(log.settlement_type || 'NONE').replace('_', ' ')}</span></p>
                <p>Reason: ${log.reason || 'Expired'}</p>
                ${log.new_expiry_date ? `<p>New Expiry Date: ${new Date(log.new_expiry_date).toLocaleDateString()}</p>` : ''}
                ${log.notes ? `<p style="font-weight: 400; font-style: italic;">"${log.notes}"</p>` : ''}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Product SKU</th>
                  <th>Product Description</th>
                  <th class="text-right">Unit Cost</th>
                  <th class="text-right">Quantity</th>
                  <th class="text-right">Claim Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-family: monospace; font-weight: 700;">${log.product_sku || 'N/A'}</td>
                  <td>
                    <strong>${log.product_name}</strong>
                    ${log.product_category ? `<br/><span style="font-size: 11px; color: #64748b;">${log.product_category}</span>` : ''}
                  </td>
                  <td class="text-right">Tk ${parseFloat(log.unit_cost || 0).toFixed(2)}</td>
                  <td class="text-right"><strong>${log.quantity} ${log.product_unit || 'pcs'}</strong></td>
                  <td class="text-right"><strong>Tk ${(parseFloat(log.total_amount) || (log.quantity * (parseFloat(log.unit_cost) || 0))).toFixed(2)}</strong></td>
                </tr>
              </tbody>
            </table>

            <div class="totals-box">
              <div class="totals-row">
                <span>Claim Subtotal:</span>
                <span>Tk ${(parseFloat(log.total_amount) || (log.quantity * (parseFloat(log.unit_cost) || 0))).toFixed(2)}</span>
              </div>
              ${log.settlement_type === 'deduct_due' ? `
                <div class="totals-row" style="color: #059669; font-weight: 600;">
                  <span>Due Balance Deducted:</span>
                  <span>- Tk ${parseFloat(log.refund_amount || log.total_amount).toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="totals-row grand">
                <span>Total Net Claim:</span>
                <span>Tk ${(parseFloat(log.total_amount) || (log.quantity * (parseFloat(log.unit_cost) || 0))).toFixed(2)}</span>
              </div>
            </div>

            <div class="signatures">
              <div class="sig-line">
                Prepared / Authorized By (Shop Management)
              </div>
              <div class="sig-line">
                Received & Acknowledged By (${sup.name || 'Supplier'})
              </div>
            </div>
          </body>
        </html>
      `);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 300);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
          {/* Header */}
          <div className="flex justify-between items-start pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Debit Note Voucher</span>
                <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  {isReturn ? 'Goods Return' : 'Replacement'}
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-800 mt-1">#{log.reference_no || ('SR-' + log.id)}</h3>
              <p className="text-xs text-slate-500">Issued to {sup.name || 'Supplier'} on {formatDate(log.created_at)}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrintDebitNote}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print Voucher</span>
              </button>
              <button onClick={() => setShowDebitNoteModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Slip Body Preview */}
          <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vendor Information</span>
                <span className="font-bold text-slate-800 text-sm block mt-0.5">{sup.name || 'Supplier'}</span>
                <span className="text-slate-600 block">{sup.phone || 'No phone'} · {sup.email || 'No email'}</span>
                <span className="text-slate-500 block">Contact: {sup.contact_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Return & Settlement Metadata</span>
                <span className="font-bold text-slate-800 block mt-0.5 capitalize">
                  Method: {log.settlement_type?.replace('_', ' ') || 'None'}
                </span>
                <span className="text-slate-600 block">Reason: <strong>{log.reason || 'Expired'}</strong></span>
                {log.new_expiry_date && (
                  <span className="text-emerald-700 font-bold block">
                    New Expiry Date: {new Date(log.new_expiry_date).toLocaleDateString()}
                  </span>
                )}
                {log.notes && <span className="text-slate-500 italic block mt-1">"{log.notes}"</span>}
              </div>
            </div>

            {/* Line items table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-3">SKU</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-right">Unit Cost</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-right">Total Claim</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 font-mono font-bold text-slate-500">{log.product_sku || 'N/A'}</td>
                    <td className="p-3 font-bold text-slate-800">{log.product_name}</td>
                    <td className="p-3 text-right text-slate-650">{formatCurrency(log.unit_cost)}</td>
                    <td className="p-3 text-right font-black text-slate-800">{log.quantity} {log.product_unit || 'units'}</td>
                    <td className="p-3 text-right font-black text-slate-900">{formatCurrency(log.total_amount || (log.quantity * log.unit_cost))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary Box */}
            <div className="flex justify-end">
              <div className="w-72 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Claim Total:</span>
                  <span className="font-bold">{formatCurrency(log.total_amount || (log.quantity * log.unit_cost))}</span>
                </div>
                {log.settlement_type === 'deduct_due' && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Due Balance Offset:</span>
                    <span>- {formatCurrency(log.refund_amount || log.total_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>Net Claim Value:</span>
                  <span>{formatCurrency(log.total_amount || (log.quantity * log.unit_cost))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-400">POS Inventory & Supplier Management</span>
            <button
              onClick={() => setShowDebitNoteModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // EDIT LOG MODAL (UPGRADED)
  function renderEditLogModal() {
    if (!selectedLog) return null;
    const isReturn = selectedLog.action_type === 'return';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col my-8">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-indigo-650 uppercase tracking-wider">
                Edit {isReturn ? 'Return' : 'Replacement'} Entry
              </span>
              <h3 className="text-lg font-bold text-slate-800">{selectedLog.product_name}</h3>
              <span className="text-xs font-mono text-slate-400">Ref #{selectedLog.reference_no || selectedLog.id}</span>
            </div>
            <button onClick={() => { setShowEditLogModal(false); setSelectedLog(null); }} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleEditLogSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={editLogFormData.quantity}
                  onChange={(e) => setEditLogFormData({ ...editLogFormData, quantity: e.target.value })}
                  required
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Unit Cost (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editLogFormData.unit_cost}
                  onChange={(e) => setEditLogFormData({ ...editLogFormData, unit_cost: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Reason</label>
                <select
                  value={editLogFormData.reason}
                  onChange={(e) => setEditLogFormData({ ...editLogFormData, reason: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="Expired">Expired</option>
                  <option value="Near Expiry">Near Expiry</option>
                  <option value="Damaged Goods">Damaged Goods</option>
                  <option value="Defective Quality">Defective Quality</option>
                  <option value="Wrong Item Delivered">Wrong Item Delivered</option>
                  <option value="Overstock Return">Overstock Return</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Settlement</label>
                <select
                  value={editLogFormData.settlement_type}
                  onChange={(e) => setEditLogFormData({ ...editLogFormData, settlement_type: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="deduct_due">Deduct Due</option>
                  <option value="cash_refund">Cash Refund</option>
                  <option value="credit_note">Credit Note</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>

            {!isReturn && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">New Expiry Date *</label>
                <input
                  type="date"
                  min={new Date().toBDISODateString()}
                  value={editLogFormData.new_expiry_date}
                  onChange={(e) => setEditLogFormData({ ...editLogFormData, new_expiry_date: e.target.value })}
                  required
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Remarks</label>
              <textarea
                value={editLogFormData.notes}
                onChange={(e) => setEditLogFormData({ ...editLogFormData, notes: e.target.value })}
                placeholder="Edit notes..."
                rows="2"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => { setShowEditLogModal(false); setSelectedLog(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                Save Updates
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

}