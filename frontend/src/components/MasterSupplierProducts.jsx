import React, { useState, useEffect, useCallback } from 'react';
import API_BASE_URL from '../config';

const ITEMS_PER_PAGE = 20;

export default function MasterSupplierProducts() {
  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Data states
  const [items, setItems] = useState([]);
  const [distinctSuppliers, setDistinctSuppliers] = useState([]);
  const [distinctCategories, setDistinctCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Selection
  const [selected, setSelected] = useState([]);

  // Alert
  const [alert, setAlert] = useState(null);
  const triggerAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ supplier_name: '', product_name: '', category: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSupSugg, setShowSupSugg] = useState(false);

  // CSV Upload modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvParsed, setCsvParsed] = useState([]);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvErrors, setCsvErrors] = useState([]);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ------ Fetch Data ------
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/master-supplier-products?page=${page}&limit=${ITEMS_PER_PAGE}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (supplierFilter) url += `&supplier_name=${encodeURIComponent(supplierFilter)}`;
      if (categoryFilter) url += `&category=${encodeURIComponent(categoryFilter)}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.data) {
        setItems(data.data);
        setTotal(data.total || 0);
      } else if (Array.isArray(data)) {
        setItems(data);
        setTotal(data.length);
      }
    } catch (e) {
      triggerAlert('error', 'Failed to load catalog.');
    }
    setLoading(false);
  }, [page, search, supplierFilter, categoryFilter]);

  const fetchDistinctSuppliers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/master-supplier-products/suppliers`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) setDistinctSuppliers(data);
    } catch (e) {}
  };

  const fetchDistinctCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/master-supplier-products/categories`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) setDistinctCategories(data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchDistinctSuppliers();
    fetchDistinctCategories();
  }, []);

  // ------ Stats ------
  const uniqueSupplierCount = distinctSuppliers.length;

  // ------ Supplier autocomplete in form ------
  const handleFormSupplierInput = (val) => {
    setForm(f => ({ ...f, supplier_name: val }));
    if (val.trim()) {
      const matches = distinctSuppliers.filter(s => s.toLowerCase().includes(val.toLowerCase()));
      setSupplierSuggestions(matches.slice(0, 10));
      setShowSupSugg(matches.length > 0);
    } else {
      setShowSupSugg(false);
    }
  };

  // ------ Open modal ------
  const openAdd = () => {
    setEditingItem(null);
    setForm({ supplier_name: '', product_name: '', category: '' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      supplier_name: item.supplier_name,
      product_name: item.product_name,
      category: item.category || ''
    });
    setShowModal(true);
  };

  // ------ Submit form ------
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_name.trim() || !form.product_name.trim()) {
      triggerAlert('error', 'Both Supplier Name and Product Name are required.');
      return;
    }
    setFormLoading(true);
    try {
      const url = editingItem
        ? `${API_BASE_URL}/master-supplier-products/${editingItem.id}`
        : `${API_BASE_URL}/master-supplier-products`;
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) {
        triggerAlert('error', data.error || 'Failed to save product.');
      } else {
        triggerAlert('success', editingItem ? 'Product updated successfully.' : 'Product added successfully.');
        setShowModal(false);
        fetchItems();
        fetchDistinctSuppliers();
        fetchDistinctCategories();
      }
    } catch (e) {
      triggerAlert('error', 'Network error.');
    }
    setFormLoading(false);
  };

  // ------ Delete single ------
  const confirmDelete = (item) => setDeleteTarget(item);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/master-supplier-products/${deleteTarget.id}`, { method: 'DELETE', headers });
      if (res.ok) {
        triggerAlert('success', 'Product deleted.');
        setDeleteTarget(null);
        fetchItems();
        fetchDistinctSuppliers();
        fetchDistinctCategories();
      } else {
        const d = await res.json();
        triggerAlert('error', d.error || 'Delete failed.');
      }
    } catch (e) {
      triggerAlert('error', 'Network error.');
    }
    setDeleting(false);
  };

  // ------ Bulk delete ------
  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`Delete ${selected.length} selected products?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/master-supplier-products/bulk-delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids: selected })
      });
      const d = await res.json();
      if (res.ok) {
        triggerAlert('success', d.message || 'Deleted successfully.');
        setSelected([]);
        fetchItems();
        fetchDistinctSuppliers();
        fetchDistinctCategories();
      } else {
        triggerAlert('error', d.error || 'Bulk delete failed.');
      }
    } catch (e) {
      triggerAlert('error', 'Network error.');
    }
  };

  // ------ CSV parse & upload ------
  const parseCsv = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { setCsvParsed([]); setCsvErrors(['CSV must have a header row and at least one data row.']); return; }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));
    const supIdx = headers.findIndex(h => h.includes('supplier'));
    const prodIdx = headers.findIndex(h => h.includes('product'));
    const catIdx = headers.findIndex(h => h.includes('categor') || h === 'group');
    if (supIdx < 0 || prodIdx < 0) { setCsvErrors(['CSV headers must include "supplier_name" and "product_name"']); setCsvParsed([]); return; }
    const errors = [];
    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const sup = cols[supIdx] || '';
      const prod = cols[prodIdx] || '';
      const cat = catIdx >= 0 ? (cols[catIdx] || '') : '';
      if (!sup || !prod) { errors.push(`Row ${i + 1}: supplier_name and product_name are required.`); continue; }
      parsed.push({ supplier_name: sup, product_name: prod, category: cat });
    }
    setCsvParsed(parsed);
    setCsvErrors(errors);
  };

  const handleCsvTextChange = (val) => {
    setCsvText(val);
    parseCsv(val);
  };

  const handleCsvFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setCsvText(text);
      parseCsv(text);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleCsvUpload = async () => {
    if (csvParsed.length === 0) { triggerAlert('error', 'No valid rows to upload.'); return; }
    setCsvUploading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/master-supplier-products/bulk-upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ items: csvParsed })
      });
      const data = await res.json();
      if (res.ok) {
        triggerAlert('success', data.message);
        setShowCsvModal(false);
        setCsvText('');
        setCsvParsed([]);
        setCsvErrors([]);
        fetchItems();
        fetchDistinctSuppliers();
        fetchDistinctCategories();
      } else {
        triggerAlert('error', data.error || 'Upload failed.');
      }
    } catch (e) {
      triggerAlert('error', 'Network error.');
    }
    setCsvUploading(false);
  };

  // ------ Export CSV ------
  const handleExport = () => {
    window.open(`${API_BASE_URL}/master-supplier-products/export?token=${token}`, '_blank');
  };

  // ------ Download CSV template ------
  const downloadTemplate = () => {
    const csv = 'supplier_name,product_name,category\nABC Supplier,Product A,Beverages\nXYZ Supplier,Product B,Electronics\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplier_products_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ------ Selection ------
  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelected(selected.length === items.length ? [] : items.map(i => i.id));

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 p-4 md:p-6">
      {/* Alert */}
      {alert && (
        <div className={`fixed top-4 right-4 z-[9999] px-5 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 transition-all ${alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {alert.type === 'success' ? '✓' : '✕'} {alert.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <span className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </span>
              Supplier Products Catalog
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage master product list organized by supplier name and category. Shop admins can use this during purchase orders.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selected.length > 0 && (
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete {selected.length} Selected
              </button>
            )}
            <button onClick={handleExport} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export CSV
            </button>
            <button onClick={() => setShowCsvModal(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" /></svg>
              Bulk CSV Upload
            </button>
            <button onClick={openAdd} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Add Product
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Total Products', value: total, color: 'indigo', icon: '📦' },
            { label: 'Unique Suppliers', value: uniqueSupplierCount, color: 'emerald', icon: '🏢' },
            { label: 'Categories', value: distinctCategories.length, color: 'purple', icon: '🏷️' },
            { label: 'Filtered Results', value: items.length, color: 'amber', icon: '🔍' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-slate-800">{s.value}</div>
              <div className="text-xs text-slate-500 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" /></svg>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by product name, supplier, or category..."
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
          />
        </div>
        <select
          value={supplierFilter}
          onChange={e => { setSupplierFilter(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 min-w-[170px]"
        >
          <option value="">All Suppliers</option>
          {distinctSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 min-w-[170px]"
        >
          <option value="">All Categories</option>
          {distinctCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || supplierFilter || categoryFilter) && (
          <button onClick={() => { setSearch(''); setSupplierFilter(''); setCategoryFilter(''); setPage(1); }} className="px-3 py-2 text-slate-500 hover:text-rose-500 text-sm font-medium transition-colors">
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading catalog...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-slate-500 font-medium">No products found in the catalog.</p>
            <p className="text-slate-400 text-sm mt-1">Add products using the "Add Product" button or upload a CSV file.</p>
            <button onClick={openAdd} className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              Add First Product
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-4 text-left w-10">
                  <input type="checkbox" checked={selected.length === items.length && items.length > 0} onChange={toggleSelectAll} className="rounded w-4 h-4 accent-indigo-600" />
                </th>
                <th className="p-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier Name</th>
                <th className="p-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Product Name</th>
                <th className="p-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="p-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Added On</th>
                <th className="p-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(item => (
                <tr key={item.id} className={`hover:bg-slate-50/60 transition-colors ${selected.includes(item.id) ? 'bg-indigo-50/40' : ''}`}>
                  <td className="p-4">
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} className="rounded w-4 h-4 accent-indigo-600" />
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-100">
                      🏢 {item.supplier_name}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-slate-800">{item.product_name}</td>
                  <td className="p-4">
                    {item.category ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200">
                        🏷️ {item.category}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs italic">—</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-400 text-xs">{item.created_at ? item.created_at.split('T')[0] : '-'}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg font-semibold transition-colors">Edit</button>
                      <button onClick={() => confirmDelete(item)} className="px-3 py-1.5 text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-semibold transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-400">Showing {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} of {total}</span>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-semibold">← Prev</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = page <= 3 ? i + 1 : page + i - 2;
                if (pg < 1 || pg > totalPages) return null;
                return (
                  <button key={pg} onClick={() => setPage(pg)} className={`w-8 h-8 text-xs rounded-lg font-semibold ${pg === page ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>{pg}</button>
                );
              })}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 font-semibold">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Add / Edit Modal ──────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? 'Edit Product' : 'Add Supplier Product'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Supplier Name *</label>
                <input
                  type="text"
                  value={form.supplier_name}
                  onChange={e => handleFormSupplierInput(e.target.value)}
                  onFocus={() => form.supplier_name && setShowSupSugg(true)}
                  onBlur={() => setTimeout(() => setShowSupSugg(false), 200)}
                  placeholder="Enter or select supplier name..."
                  required
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white font-medium"
                />
                {showSupSugg && supplierSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-44 overflow-y-auto">
                    {supplierSuggestions.map(s => (
                      <div key={s} onClick={() => { setForm(f => ({ ...f, supplier_name: s })); setShowSupSugg(false); }}
                        className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer font-medium text-slate-700">{s}</div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Product Name *</label>
                <input
                  type="text"
                  value={form.product_name}
                  onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
                  placeholder="Enter product name..."
                  required
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category (Optional)</label>
                <input
                  type="text"
                  list="master-categories-datalist"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Beverages, Electronics, Snacks..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white font-medium"
                />
                <datalist id="master-categories-datalist">
                  {distinctCategories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={formLoading} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                  {formLoading ? 'Saving...' : editingItem ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CSV Upload Modal ──────────────────────────── */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-800">Bulk CSV Upload</h3>
              <button onClick={() => { setShowCsvModal(false); setCsvText(''); setCsvParsed([]); setCsvErrors([]); }} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Template download */}
            <div className="mb-4 p-3.5 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Accepted CSV Columns</p>
                <p className="text-xs text-indigo-600 mt-0.5 font-mono">supplier_name, product_name, category (optional)</p>
              </div>
              <button onClick={downloadTemplate} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors">Download Template</button>
            </div>

            {/* File Upload */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Upload CSV File</label>
              <input type="file" accept=".csv,.txt" onChange={handleCsvFile} className="text-sm text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            </div>

            {/* Errors */}
            {csvErrors.length > 0 && (
              <div className="mb-4 p-3 bg-rose-50 rounded-xl border border-rose-100">
                <p className="text-xs font-bold text-rose-700 mb-1">Validation Issues ({csvErrors.length}):</p>
                {csvErrors.slice(0, 5).map((err, i) => <p key={i} className="text-xs text-rose-600">• {err}</p>)}
                {csvErrors.length > 5 && <p className="text-xs text-rose-500 mt-1">...and {csvErrors.length - 5} more</p>}
              </div>
            )}

            {/* Preview table */}
            {csvParsed.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Preview ({csvParsed.length} rows)</p>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">✓ Ready to upload</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-52 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left font-bold text-slate-500">Supplier Name</th>
                        <th className="p-2 text-left font-bold text-slate-500">Product Name</th>
                        <th className="p-2 text-left font-bold text-slate-500">Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {csvParsed.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2 text-indigo-700 font-semibold">{row.supplier_name}</td>
                          <td className="p-2 text-slate-700 font-medium">{row.product_name}</td>
                          <td className="p-2 text-slate-500">{row.category || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvParsed.length > 50 && <p className="text-center text-xs text-slate-400 py-2">...and {csvParsed.length - 50} more rows</p>}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setShowCsvModal(false); setCsvText(''); setCsvParsed([]); setCsvErrors([]); }} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleCsvUpload} disabled={csvUploading || csvParsed.length === 0} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                {csvUploading ? 'Uploading...' : `Upload ${csvParsed.length} Products`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm Modal ─────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Delete Product?</h3>
            <p className="text-sm text-slate-500 mb-1"><strong>{deleteTarget.product_name}</strong></p>
            {deleteTarget.category && (
              <p className="text-xs text-indigo-600 font-medium mb-1">Category: {deleteTarget.category}</p>
            )}
            <p className="text-xs text-slate-400 mb-5">Supplier: {deleteTarget.supplier_name}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
