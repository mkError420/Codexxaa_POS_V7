import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

const PAYMENT_METHODS = ['bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Card', 'Cash'];

export default function ContactInformation() {
  const [contactInfo, setContactInfo] = useState({
    email_addresses: [],
    phone_numbers: [],
    payment_numbers: [],
    address: '',
    map_url: '',
    business_hours: {
      saturday_thursday: '',
      friday: ''
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchContactInformation();
  }, []);

  const fetchContactInformation = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/contact-information`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setContactInfo({
          ...data,
          payment_numbers: data.payment_numbers || [],
          map_url: data.map_url || ''
        });
      }
    } catch (err) {
      console.error('Failed to fetch contact information:', err);
      setError('Failed to load contact information');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmail = () => {
    setContactInfo({ ...contactInfo, email_addresses: [...contactInfo.email_addresses, ''] });
  };
  const handleRemoveEmail = (index) => {
    setContactInfo({ ...contactInfo, email_addresses: contactInfo.email_addresses.filter((_, i) => i !== index) });
  };
  const handleEmailChange = (index, value) => {
    const newEmails = [...contactInfo.email_addresses];
    newEmails[index] = value;
    setContactInfo({ ...contactInfo, email_addresses: newEmails });
  };

  const handleAddPhone = () => {
    setContactInfo({ ...contactInfo, phone_numbers: [...contactInfo.phone_numbers, ''] });
  };
  const handleRemovePhone = (index) => {
    setContactInfo({ ...contactInfo, phone_numbers: contactInfo.phone_numbers.filter((_, i) => i !== index) });
  };
  const handlePhoneChange = (index, value) => {
    const newPhones = [...contactInfo.phone_numbers];
    newPhones[index] = value;
    setContactInfo({ ...contactInfo, phone_numbers: newPhones });
  };

  // Payment Numbers
  const handleAddPayment = () => {
    setContactInfo({
      ...contactInfo,
      payment_numbers: [...contactInfo.payment_numbers, { method: 'bKash', number: '', account_name: '' }]
    });
  };
  const handleRemovePayment = (index) => {
    setContactInfo({ ...contactInfo, payment_numbers: contactInfo.payment_numbers.filter((_, i) => i !== index) });
  };
  const handlePaymentChange = (index, field, value) => {
    const updated = [...contactInfo.payment_numbers];
    updated[index] = { ...updated[index], [field]: value };
    setContactInfo({ ...contactInfo, payment_numbers: updated });
  };

  const handleBusinessHoursChange = (field, value) => {
    setContactInfo({
      ...contactInfo,
      business_hours: { ...contactInfo.business_hours, [field]: value }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contact-information`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(contactInfo)
      });
      if (response.ok) {
        setSuccess('Contact information updated successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to update contact information');
      }
    } catch (err) {
      setError('Failed to update contact information');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700"></div>
      </div>
    );
  }

  const getMapEmbedUrl = (mapUrl, address) => {
    if (mapUrl && mapUrl.trim()) {
      const trimmed = mapUrl.trim();
      const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
      if (iframeMatch && iframeMatch[1]) {
        return iframeMatch[1];
      }
      return trimmed;
    }
    if (address && address.trim()) {
      const cleanAddr = address.replace(/\r?\n/g, ', ').trim();
      return `https://maps.google.com/maps?q=${encodeURIComponent(cleanAddr)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }
    return '';
  };

  const sectionCard = "bg-white p-6 rounded-xl border border-gray-200 shadow-sm";
  const inputCls = "flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900";
  const removeBtnCls = "px-3 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 transition-colors font-medium";
  const addBtnCls = "px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors font-medium";

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contact Information Management</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage contact details, address, Google Map location, and payment numbers displayed on the website.</p>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-red-700 text-sm">{error}</p></div>}
      {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg"><p className="text-green-700 text-sm">{success}</p></div>}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Email Addresses */}
        <div className={sectionCard}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Email Addresses</h2>
            <button type="button" onClick={handleAddEmail} className={addBtnCls}>+ Add Email</button>
          </div>
          <div className="space-y-2">
            {contactInfo.email_addresses.map((email, index) => (
              <div key={index} className="flex gap-2">
                <input type="email" value={email} onChange={(e) => handleEmailChange(index, e.target.value)}
                  className={inputCls} placeholder="email@example.com" />
                {contactInfo.email_addresses.length > 1 && (
                  <button type="button" onClick={() => handleRemoveEmail(index)} className={removeBtnCls}>Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Phone Numbers */}
        <div className={sectionCard}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Phone Numbers</h2>
            <button type="button" onClick={handleAddPhone} className={addBtnCls}>+ Add Phone</button>
          </div>
          <div className="space-y-2">
            {contactInfo.phone_numbers.map((phone, index) => (
              <div key={index} className="flex gap-2">
                <input type="tel" value={phone} onChange={(e) => handlePhoneChange(index, e.target.value)}
                  className={inputCls} placeholder="+880 1700-000000" />
                {contactInfo.phone_numbers.length > 1 && (
                  <button type="button" onClick={() => handleRemovePhone(index)} className={removeBtnCls}>Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Payment Numbers — shown in subscription modal */}
        <div className={sectionCard}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-base font-semibold text-gray-900">💳 Payment Numbers</h2>
              <p className="text-xs text-gray-500 mt-0.5">These will appear in the subscription form so users know where to send payment.</p>
            </div>
            <button type="button" onClick={handleAddPayment} className={addBtnCls}>+ Add</button>
          </div>
          <div className="space-y-3 mt-4">
            {contactInfo.payment_numbers.length === 0 && (
              <p className="text-sm text-gray-400 italic">No payment numbers added yet. Click "+ Add" to add one.</p>
            )}
            {contactInfo.payment_numbers.map((pn, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <select
                  value={pn.method}
                  onChange={(e) => handlePaymentChange(index, 'method', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900 bg-white w-full sm:w-36"
                >
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type="text"
                  value={pn.number || ''}
                  onChange={(e) => handlePaymentChange(index, 'number', e.target.value)}
                  placeholder="Account / Phone Number"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={pn.account_name || ''}
                  onChange={(e) => handlePaymentChange(index, 'account_name', e.target.value)}
                  placeholder="Account Name (optional)"
                  className={inputCls}
                />
                <button type="button" onClick={() => handleRemovePayment(index)} className={removeBtnCls}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Address */}
        <div className={sectionCard}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-gray-900">Address (Website Location)</h2>
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">Controls Map Pin</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Enter your business address or location name. The Google Map on the Contact Us page will automatically show this exact location.
          </p>
          <textarea value={contactInfo.address} onChange={(e) => setContactInfo({ ...contactInfo, address: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900 resize-none"
            rows={3} placeholder="123 Business Ave, Suite 100&#10;City, Country" />
        </div>

        {/* Google Map Location & Live Preview */}
        <div className={sectionCard}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                </svg>
                Google Map Location Settings
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                By default, the Google Map automatically tracks and pinpoints your <strong>Address</strong> above.
              </p>
            </div>
          </div>

          <div className="space-y-4 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Custom Google Maps Embed URL or &lt;iframe&gt; (Optional)
              </label>
              <input
                type="text"
                value={contactInfo.map_url || ''}
                onChange={(e) => setContactInfo({ ...contactInfo, map_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                placeholder="Leave blank to automatically use Address, or paste Google Maps embed URL / iframe"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Leave empty unless you want to override the address pin with a specific embed URL or custom coordinates.
              </p>
            </div>

            {/* Live Map Preview */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Google Map Preview
                </span>
                <span className="text-xs text-gray-500 truncate max-w-xs">
                  {contactInfo.map_url
                    ? 'Using: Custom Map Embed'
                    : (contactInfo.address ? `Using Address: ${contactInfo.address.replace(/\r?\n/g, ', ')}` : 'No address set')}
                </span>
              </div>
              {getMapEmbedUrl(contactInfo.map_url, contactInfo.address) ? (
                <div className="w-full h-64 rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-gray-50 relative">
                  <iframe
                    title="Google Map Live Preview"
                    src={getMapEmbedUrl(contactInfo.map_url, contactInfo.address)}
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : (
                <div className="w-full h-36 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 text-xs gap-1 bg-gray-50/50">
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Type your address above to see the live Google Map.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div className={sectionCard}>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Business Hours</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saturday – Thursday</label>
              <input type="text" value={contactInfo.business_hours.saturday_thursday}
                onChange={(e) => handleBusinessHoursChange('saturday_thursday', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                placeholder="9:00 AM – 6:00 PM" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Friday</label>
              <input type="text" value={contactInfo.business_hours.friday}
                onChange={(e) => handleBusinessHoursChange('friday', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                placeholder="Closed" />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

