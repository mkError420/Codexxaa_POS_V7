import React, { useState, useEffect, useMemo } from 'react';
import API_BASE_URL from '../config';
import { useLanguage } from '../contexts/LanguageContext';

// Built-in Icon Presets with clean SVG rendering
export const SERVICE_ICONS = {
  code: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  printer: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  ),
  cloud: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  smartphone: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  shield: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  headset: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293a1 1 0 011.414 1.414" />
    </svg>
  ),
  database: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
  network: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  ),
  cart: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  zap: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  rocket: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  ),
  briefcase: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
};

export default function MoreServices() {
  const { t } = useLanguage();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    badge: '',
    icon: 'code',
    button_text: 'Inquire Now',
    button_link: 'https://wa.me/8801572491828',
    display_order: 0,
    status: 'active'
  });
  const [featuresList, setFeaturesList] = useState([]);
  const [newFeatureInput, setNewFeatureInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' or 'preview'

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/more-services`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setServices(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to load services');
      }
    } catch (err) {
      console.error('Error loading services:', err);
      setError('Connection error loading services');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingService(null);
    setFormData({
      title: '',
      subtitle: '',
      description: '',
      badge: '',
      icon: 'code',
      button_text: 'Inquire Now',
      button_link: 'https://wa.me/8801572491828',
      display_order: services.length + 1,
      status: 'active'
    });
    setFeaturesList(['']);
    setNewFeatureInput('');
    setImageFile(null);
    setImagePreview('');
    setRemoveExistingImage(false);
    setActiveTab('editor');
    setError('');
    setShowModal(true);
  };

  const openEditModal = (service) => {
    setEditingService(service);
    setFormData({
      title: service.title || '',
      subtitle: service.subtitle || '',
      description: service.description || '',
      badge: service.badge || '',
      icon: service.icon || 'code',
      button_text: service.button_text || 'Inquire Now',
      button_link: service.button_link || 'https://wa.me/8801572491828',
      display_order: service.display_order ?? 0,
      status: service.status || 'active'
    });

    // Features
    const parsedFeatures = Array.isArray(service.features)
      ? service.features
      : (typeof service.features === 'string'
          ? (JSON.parse(service.features || '[]') || [])
          : []);
    setFeaturesList(parsedFeatures.length > 0 ? parsedFeatures : []);
    setNewFeatureInput('');

    // Image
    setImageFile(null);
    setImagePreview(service.image_url ? (service.image_url.startsWith('http') ? service.image_url : `${API_BASE_URL}/${service.image_url}`) : '');
    setRemoveExistingImage(false);
    setActiveTab('editor');
    setError('');
    setShowModal(true);
  };

  const handleAddFeature = () => {
    const trimmed = newFeatureInput.trim();
    if (!trimmed) return;
    setFeaturesList([...featuresList, trimmed]);
    setNewFeatureInput('');
  };

  const handleRemoveFeature = (index) => {
    setFeaturesList(featuresList.filter((_, i) => i !== index));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setRemoveExistingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setRemoveExistingImage(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Service title is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const dataToSend = new FormData();
      dataToSend.append('title', formData.title.trim());
      dataToSend.append('subtitle', formData.subtitle.trim());
      dataToSend.append('description', formData.description.trim());
      dataToSend.append('badge', formData.badge.trim());
      dataToSend.append('icon', formData.icon);
      dataToSend.append('button_text', formData.button_text.trim());
      dataToSend.append('button_link', formData.button_link.trim());
      dataToSend.append('display_order', formData.display_order);
      dataToSend.append('status', formData.status);
      dataToSend.append('features', JSON.stringify(featuresList.filter(f => f.trim())));

      if (imageFile) {
        dataToSend.append('image', imageFile);
      }
      if (removeExistingImage) {
        dataToSend.append('remove_image', '1');
      }

      let url = `${API_BASE_URL}/more-services`;
      let method = 'POST';

      if (editingService) {
        url = `${API_BASE_URL}/more-services/${editingService.id}`;
        dataToSend.append('_method', 'PUT');
      }

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: dataToSend
      });

      const result = await res.json();
      if (res.ok) {
        setSuccess(editingService ? 'Service updated successfully!' : 'Service created successfully!');
        setShowModal(false);
        fetchServices();
        setTimeout(() => setSuccess(''), 3500);
      } else {
        setError(result.error || 'Failed to save service');
      }
    } catch (err) {
      console.error('Save error:', err);
      setError('Error communicating with server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/more-services/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setSuccess('Service deleted successfully!');
        fetchServices();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete service');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete service');
    }
  };

  const handleToggleStatus = async (service) => {
    const nextStatus = service.status === 'active' ? 'inactive' : 'active';
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('status', nextStatus);
      formDataToSend.append('_method', 'PUT');

      const res = await fetch(`${API_BASE_URL}/more-services/${service.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formDataToSend
      });

      if (res.ok) {
        setServices(services.map(s => s.id === service.id ? { ...s, status: nextStatus } : s));
      }
    } catch (err) {
      console.error('Status toggle error:', err);
    }
  };

  const handleMoveOrder = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= services.length) return;

    const currentItem = services[index];
    const swapItem = services[targetIndex];

    const newCurrentOrder = swapItem.display_order;
    const newSwapOrder = currentItem.display_order === swapItem.display_order
      ? (direction === 'up' ? swapItem.display_order - 1 : swapItem.display_order + 1)
      : currentItem.display_order;

    try {
      // Optimistic update
      const updatedList = [...services];
      updatedList[index] = { ...currentItem, display_order: newCurrentOrder };
      updatedList[targetIndex] = { ...swapItem, display_order: newSwapOrder };
      updatedList.sort((a, b) => a.display_order - b.display_order);
      setServices(updatedList);

      const f1 = new FormData();
      f1.append('display_order', newCurrentOrder);
      f1.append('_method', 'PUT');

      const f2 = new FormData();
      f2.append('display_order', newSwapOrder);
      f2.append('_method', 'PUT');

      await Promise.all([
        fetch(`${API_BASE_URL}/more-services/${currentItem.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: f1
        }),
        fetch(`${API_BASE_URL}/more-services/${swapItem.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: f2
        })
      ]);

      fetchServices();
    } catch (err) {
      console.error('Reorder error:', err);
      fetchServices();
    }
  };

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchSearch =
        (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.subtitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.badge || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        statusFilter === 'all' || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [services, searchQuery, statusFilter]);

  const activeCount = services.filter(s => s.status === 'active').length;
  const inactiveCount = services.filter(s => s.status === 'inactive').length;

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
            <h1 className="text-2xl font-bold text-slate-800">
              {t('our_more_services', 'Our More Services')}
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage extended service offerings, hardware bundles, and solutions displayed on the Home page.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {activeCount} Active
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
            {inactiveCount} Inactive
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm transition-all shadow-indigo-600/20 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add New Service
          </button>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-sm">{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700 text-sm font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-sm">{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 text-sm font-bold">×</button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <svg className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services by title, badge, feature..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-medium">
            {['all', 'active', 'inactive'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-md capitalize transition-all ${
                  statusFilter === status
                    ? 'bg-white text-slate-800 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Services Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 animate-pulse space-y-4">
              <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
              <div className="h-6 w-3/4 bg-slate-200 rounded"></div>
              <div className="h-4 w-full bg-slate-200 rounded"></div>
              <div className="h-20 bg-slate-100 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 mx-auto flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No services found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'No services match your active search filters.'
              : 'Add your first extended service or hardware offering to display on the Home page.'}
          </p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Add First Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service, index) => {
            const rawFeatures = Array.isArray(service.features)
              ? service.features
              : (typeof service.features === 'string' ? (JSON.parse(service.features || '[]') || []) : []);

            return (
              <div
                key={service.id}
                className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                  service.status === 'active'
                    ? 'border-slate-200/90'
                    : 'border-slate-200/60 opacity-75 bg-slate-50/50'
                }`}
              >
                <div className="p-6">
                  {/* Top card row: Icon + Badge + Order */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      {service.image_url ? (
                        <img
                          src={service.image_url.startsWith('http') ? service.image_url : `${API_BASE_URL}/${service.image_url}`}
                          alt={service.title}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                          {SERVICE_ICONS[service.icon] || SERVICE_ICONS.code}
                        </div>
                      )}
                      <div>
                        <span className="text-[11px] font-mono text-slate-600 px-1.5 py-0.5 rounded bg-slate-100">
                          Order #{service.display_order}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {service.badge && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                          {service.badge}
                        </span>
                      )}
                      <button
                        onClick={() => handleToggleStatus(service)}
                        title={`Click to set ${service.status === 'active' ? 'Inactive' : 'Active'}`}
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-colors ${
                          service.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {service.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="text-lg font-bold text-slate-800 leading-snug mb-1">
                    {service.title}
                  </h3>
                  {service.subtitle && (
                    <p className="text-xs font-medium text-indigo-600 mb-2.5 line-clamp-1">
                      {service.subtitle}
                    </p>
                  )}

                  {/* Description */}
                  {service.description && (
                    <p className="text-sm text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                      {service.description}
                    </p>
                  )}

                  {/* Features Highlights */}
                  {rawFeatures.length > 0 && (
                    <div className="space-y-1.5 pt-3 border-t border-slate-100">
                      {rawFeatures.slice(0, 4).map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-600">
                          <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                      {rawFeatures.length > 4 && (
                        <span className="text-[11px] text-indigo-600 font-medium pl-5 block">
                          +{rawFeatures.length - 4} more features
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                  {/* Reordering arrows */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveOrder(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      title="Move Up"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveOrder(index, 'down')}
                      disabled={index === filteredServices.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      title="Move Down"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Edit / Delete */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(service)}
                      className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit Service"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                      title="Delete Service"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {editingService ? 'Edit Service' : 'Add New Service'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure presentation details for the Home page
                </p>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'editor'
                      ? 'bg-white text-slate-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'preview'
                      ? 'bg-white text-slate-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Card Preview
                </button>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-xl font-bold leading-none ml-2"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {activeTab === 'preview' ? (
                /* Live Preview Tab */
                <div className="py-6 flex justify-center bg-slate-100/60 rounded-xl p-6">
                  <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200/90 shadow-lg p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="preview"
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                            {SERVICE_ICONS[formData.icon] || SERVICE_ICONS.code}
                          </div>
                        )}
                        {formData.badge && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {formData.badge}
                          </span>
                        )}
                      </div>

                      <h4 className="text-lg font-bold text-slate-800 mb-1">
                        {formData.title || 'Service Title Here'}
                      </h4>
                      {formData.subtitle && (
                        <p className="text-xs font-medium text-indigo-600 mb-2">
                          {formData.subtitle}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 leading-relaxed mb-4">
                        {formData.description || 'Comprehensive solution description will appear here on the homepage.'}
                      </p>

                      {featuresList.filter(f => f.trim()).length > 0 && (
                        <div className="space-y-1.5 pt-3 border-t border-slate-100 mb-6">
                          {featuresList.filter(f => f.trim()).map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                              <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <a
                      href={formData.button_link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl text-center font-medium text-sm text-white bg-indigo-600 shadow-sm block mt-2"
                    >
                      {formData.button_text || 'Learn More'}
                    </a>
                  </div>
                </div>
              ) : (
                /* Editor Form */
                <form id="serviceForm" onSubmit={handleSubmit} className="space-y-4">
                  {/* Row 1: Title & Badge */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Service Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Custom Software Development"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Badge / Tag
                      </label>
                      <input
                        type="text"
                        value={formData.badge}
                        onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                        placeholder="e.g. Popular, Hardware, Custom"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Row 2: Subtitle */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Short Subtitle
                    </label>
                    <input
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      placeholder="e.g. Tailor-made workflows designed for your business"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* Row 3: Description */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Detailed explanation of what this service covers..."
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* Row 4: Icon Presets Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Select Built-in Icon
                    </label>
                    <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                      {Object.keys(SERVICE_ICONS).map((iconKey) => (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon: iconKey })}
                          className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                            formData.icon === iconKey
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title={iconKey}
                        >
                          {SERVICE_ICONS[iconKey]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 5: Custom Image Upload (Optional Override) */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Or Upload Custom Image / Logo (Optional)
                    </label>
                    <div className="flex items-center gap-4">
                      {imagePreview ? (
                        <div className="relative w-14 h-14 rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                          <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 bg-white">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      />
                    </div>
                  </div>

                  {/* Row 6: Key Features Checklist Builder */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Key Highlights / Included Features
                    </label>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={newFeatureInput}
                        onChange={(e) => setNewFeatureInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddFeature();
                          }
                        }}
                        placeholder="Type a feature and click Add..."
                        className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddFeature}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {featuresList.map((feat, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                        >
                          <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          {feat}
                          <button
                            type="button"
                            onClick={() => handleRemoveFeature(idx)}
                            className="text-indigo-400 hover:text-indigo-700 ml-1 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Row 7: Action Button Text & Link */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Button Label
                      </label>
                      <input
                        type="text"
                        value={formData.button_text}
                        onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                        placeholder="e.g. Inquire Now, Order Hardware"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Button Action Link
                      </label>
                      <input
                        type="text"
                        value={formData.button_link}
                        onChange={(e) => setFormData({ ...formData, button_link: e.target.value })}
                        placeholder="e.g. https://wa.me/8801572491828 or #contact"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Row 8: Order & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={formData.display_order}
                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="active">Active (Visible on Home Page)</option>
                        <option value="inactive">Inactive (Hidden)</option>
                      </select>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="serviceForm"
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
              >
                {submitting && (
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                )}
                {editingService ? 'Update Service' : 'Create Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
