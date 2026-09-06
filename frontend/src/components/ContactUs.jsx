import React, { useState, useEffect, useRef } from 'react';
import Footer from './Footer';
import API_BASE_URL from '../config';
import AnimatedButton from './AnimatedButton';

export default function ContactUs({ onNavigate, publicPage }) {
  const [logo, setLogo] = useState(null);
  const [contactInfo, setContactInfo] = useState({
    email_addresses: [],
    phone_numbers: [],
    address: '',
    map_url: '',
    business_hours: {
      saturday_thursday: '',
      friday: ''
    }
  });
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef(null);

  // Helper to resolve Google Maps embed URL
  const getMapEmbedUrl = (mapUrl, address) => {
    if (mapUrl && mapUrl.trim()) {
      const trimmed = mapUrl.trim();
      const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
      if (iframeMatch && iframeMatch[1]) {
        return iframeMatch[1];
      }
      return trimmed;
    }
    const cleanAddr = address && address.trim() ? address.replace(/\r?\n/g, ', ').trim() : 'Dhaka, Bangladesh';
    return `https://maps.google.com/maps?q=${encodeURIComponent(cleanAddr)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  };

  // Helper to resolve external Google Maps directions link
  const getDirectionsUrl = (mapUrl, address) => {
    const cleanAddr = address && address.trim() ? address.replace(/\r?\n/g, ', ').trim() : '';
    if (cleanAddr) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddr)}`;
    }
    if (mapUrl && mapUrl.trim()) {
      const iframeMatch = mapUrl.match(/src=["']([^"']+)["']/i);
      return iframeMatch ? iframeMatch[1] : mapUrl.trim();
    }
    return 'https://maps.google.com';
  };

  // Hide mobile menu on outside click or touch anywhere on the display
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (mobileMenuOpen && navRef.current && !navRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: 'Home', page: 'home', path: '/' },
    { label: 'About Us', page: 'about', path: '/about' },
    { label: 'Contact Us', page: 'contact', path: '/contact' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch logo
        const logoResponse = await fetch(`${API_BASE_URL}/public/logo`);
        if (logoResponse.ok) {
          const data = await logoResponse.json();
          if (data.logo) {
            setLogo(data.logo);
          }
        }

        // Fetch contact information
        const contactResponse = await fetch(`${API_BASE_URL}/public/contact-information`);
        if (contactResponse.ok) {
          const contactData = await contactResponse.json();
          setContactInfo(contactData);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/public/contact-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setSubmitted(true);
        setFormData({ name: '', phone: '', message: '' });
        setTimeout(() => setSubmitted(false), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to send message');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        .site-logo-shimmer {
          font-size: 1.5rem;
          font-weight: 800;
          background: linear-gradient(
            110deg,
            #0f172a 30%,
            #38bdf8 50%,
            #0f172a 70%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s infinite linear;
        }

        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
      {/* Mobile Menu Backdrop Overlay to dismiss on display click */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-30 sm:hidden transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Navbar */}
      <nav ref={navRef} className="bg-white border-b border-gray-200 sticky top-9 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              {logo ? (
                <img src={logo} alt="Logo" className="h-12 w-12 rounded-lg object-contain bg-slate-900" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm">POS</span>
                </div>
              )}
              <p className="site-logo-shimmer">Codexxaa-Solutions</p>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden sm:flex items-center gap-8">
              {navLinks.map((link) => (
                <button
                  key={link.page}
                  onClick={() => { onNavigate(link.page); window.history.pushState({}, '', link.path); }}
                  className={`text-gray-600 hover:text-gray-900 transition-colors font-medium text-base relative ${
                    publicPage === link.page ? 'text-gray-900' : ''
                  }`}
                >
                  {link.label}
                  {publicPage === link.page && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></span>
                  )}
                </button>
              ))}
              <button
                onClick={() => window.history.pushState({}, '', '/login')}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                style={{ backgroundColor: '#D4E0E8', color: '#1a1a2e' }}
              >
                Login
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              className="sm:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                /* X icon */
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <div
          className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileMenuOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <button
                key={link.page}
                onClick={() => { onNavigate(link.page); setMobileMenuOpen(false); window.history.pushState({}, '', link.path); }}
                className={`w-full text-left text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors font-medium text-sm px-3 py-2.5 rounded-lg relative ${
                  publicPage === link.page ? 'text-gray-900 bg-gray-50' : ''
                }`}
              >
                {link.label}
                {publicPage === link.page && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"></span>
                )}
              </button>
            ))}
            <button
              onClick={() => { setMobileMenuOpen(false); window.history.pushState({}, '', '/login'); }}
              className="w-full text-left px-3 py-2.5 rounded-lg font-medium text-sm transition-colors"
              style={{ backgroundColor: '#D4E0E8', color: '#1a1a2e' }}
            >
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Contact Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700"></div>
          </div>
        ) : (
          <>
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Contact <span className="text-gray-700">Us</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send us a Message</h2>
            
            {submitted && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-green-700 text-sm font-medium">Thank you! Your message has been sent successfully.</p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Your Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-colors"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-colors"
                  placeholder="+880 1XXX-XXXXXX"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Message</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={5}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-colors resize-none"
                  placeholder="Tell us more about your inquiry..."
                />
              </div>

              <AnimatedButton
                type="submit"
                style={{ width: '100%' }}
              >
                Send Message
              </AnimatedButton>
            </form>
          </div>

          {/* Contact Information */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Information</h2>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-semibold mb-1">Email</h3>
                    {contactInfo.email_addresses && contactInfo.email_addresses.length > 0 ? (
                      contactInfo.email_addresses.map((email, index) => (
                        <p key={index} className="text-gray-600 text-sm">{email}</p>
                      ))
                    ) : (
                      <p className="text-gray-600 text-sm">No email addresses available</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-semibold mb-1">Phone</h3>
                    {contactInfo.phone_numbers && contactInfo.phone_numbers.length > 0 ? (
                      contactInfo.phone_numbers.map((phone, index) => (
                        <p key={index} className="text-gray-600 text-sm">{phone}</p>
                      ))
                    ) : (
                      <p className="text-gray-600 text-sm">No phone numbers available</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-semibold mb-1">Address</h3>
                    {contactInfo.address ? (
                      contactInfo.address.split('\n').map((line, index) => (
                        <p key={index} className="text-gray-600 text-sm">{line}</p>
                      ))
                    ) : (
                      <p className="text-gray-600 text-sm">No address available</p>
                    )}
                    {getMapEmbedUrl(contactInfo.map_url, contactInfo.address) && (
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('google-map-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm group"
                      >
                        <svg className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                        </svg>
                        View on Map &darr;
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Business Hours</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Saturday - Thursday</span>
                  <span className="text-gray-900 font-medium">{contactInfo.business_hours?.saturday_thursday || 'Not available'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Friday</span>
                  <span className="text-gray-900 font-medium">{contactInfo.business_hours?.friday || 'Not available'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Google Map Section following website location */}
        {getMapEmbedUrl(contactInfo.map_url, contactInfo.address) && (
          <div id="google-map-section" className="mt-14 scroll-mt-28">
            <div className="bg-white rounded-3xl border border-gray-200/90 shadow-xl shadow-slate-100 overflow-hidden">
              {/* Header Bar above the map */}
              <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center flex-shrink-0 border border-white/10 shadow-inner">
                    <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-sky-500/20 text-sky-300 border border-sky-400/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
                        Our Location
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-white tracking-tight mt-1">
                      Find Us on Google Maps
                    </h3>
                    <p className="text-slate-300 text-sm mt-0.5 max-w-xl">
                      {contactInfo.address
                        ? contactInfo.address.replace(/\r?\n/g, ', ')
                        : 'Visit us during our regular business hours'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={getDirectionsUrl(contactInfo.map_url, contactInfo.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-md hover:shadow-lg transform active:scale-95"
                  >
                    <span>Get Directions</span>
                    <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Map Iframe */}
              <div className="relative w-full h-[400px] sm:h-[480px] bg-slate-100">
                <iframe
                  title="Website Google Map Location"
                  src={getMapEmbedUrl(contactInfo.map_url, contactInfo.address)}
                  className="w-full h-full border-0"
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              {/* Footer info bar under the map */}
              <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>
                    <strong>Store Hours:</strong>{' '}
                    {contactInfo.business_hours?.saturday_thursday
                      ? `Sat–Thu: ${contactInfo.business_hours.saturday_thursday}`
                      : '9:00 AM – 6:00 PM'}
                  </span>
                </div>
                <div>
                  <a
                    href={getDirectionsUrl(contactInfo.map_url, contactInfo.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-900 hover:text-sky-600 font-medium underline transition-colors"
                  >
                    Open in full Google Maps app &rarr;
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {/* WhatsApp Floating Button */}
      <a
        href="https://wa.me/8801572491828"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-110 flex items-center justify-center"
        title="Contact us on WhatsApp"
      >
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}