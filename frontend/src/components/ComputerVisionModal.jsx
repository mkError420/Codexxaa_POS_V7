import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  renderVisionOverlay,
  extractVisualFeatures,
  recognizeTextFromImage,
  scanBarcodeNative,
  matchProductComprehensive,
  getTrainedTemplates,
  saveProductTemplate,
  deleteProductTemplate,
  playScanChime
} from '../utils/opencvVision';

export default function ComputerVisionModal({
  isOpen,
  onClose,
  products = [],
  masterCatalogProducts = [],
  onAddToCart,
  onSelectProduct,
  mode = 'pos', // 'pos' | 'purchase_order' | 'general'
  title = null,
  currency = '৳'
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const ocrIntervalRef = useRef(null);
  const streamRef = useRef(null);

  // CV & Engine State
  const [visionMode, setVisionMode] = useState('standard'); // 'standard' | 'canny' | 'contours' | 'hsv' | 'threshold' | 'keypoints'
  const [isFrozen, setIsFrozen] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [cameraError, setCameraError] = useState(null);

  // Recognition Results & Match State
  const [currentFeatures, setCurrentFeatures] = useState(null);
  const [detectedText, setDetectedText] = useState('');
  const [detectedBarcode, setDetectedBarcode] = useState('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [matchCandidates, setMatchCandidates] = useState([]);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [autoAddEnabled, setAutoAddEnabled] = useState(false);
  const [confidenceThreshold] = useState(75);
  const [recentNotification, setRecentNotification] = useState(null);

  const lastAutoAddedIdRef = useRef(null);
  const lastAutoAddedTimeRef = useRef(0);

  // Training / Model Studio Tab State
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'train' | 'models'
  const [trainedTemplates, setTrainedTemplates] = useState([]);
  const [trainSelectedProductId, setTrainSelectedProductId] = useState('');
  const [trainCustomLabel, setTrainCustomLabel] = useState('');
  const [trainSnapshotData, setTrainSnapshotData] = useState(null);
  const [trainSearch, setTrainSearch] = useState('');

  // 1. Initialize Cameras & Templates on Open
  useEffect(() => {
    if (!isOpen) return;

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setCameraDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      }).catch(err => console.warn('Could not enumerate cameras', err));
    }

    setTrainedTemplates(getTrainedTemplates());
  }, [isOpen]);

  // 2. Start Camera Stream
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Camera access required. Please allow camera permissions or upload an image.');
    }
  }, [selectedDeviceId]);

  // 3. Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
    if (ocrIntervalRef.current) {
      clearInterval(ocrIntervalRef.current);
      ocrIntervalRef.current = null;
    }
  }, []);

  // Handle open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setIsFrozen(false);
      setMatchCandidates([]);
      setDetectedText('');
      setDetectedBarcode('');
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  // 4. Smooth Canvas Render Loop
  useEffect(() => {
    if (!isOpen || isFrozen) return;

    let isSubscribed = true;
    const renderLoop = () => {
      if (isSubscribed && !isFrozen && videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
        renderVisionOverlay(canvasRef.current, videoRef.current, visionMode);
      }
      if (isSubscribed && !isFrozen) {
        animFrameIdRef.current = requestAnimationFrame(renderLoop);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isSubscribed = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isOpen, isFrozen, visionMode]);

  // 5. Deep Multi-Modal Analysis Function (Runs OCR + Barcode + Visual Features)
  const performDeepAnalysis = useCallback(async (sourceCanvasOrImage) => {
    if (!sourceCanvasOrImage) return;

    setIsOcrProcessing(true);
    try {
      const features = extractVisualFeatures(sourceCanvasOrImage);
      if (features) setCurrentFeatures(features);

      const [text, barcode] = await Promise.all([
        recognizeTextFromImage(sourceCanvasOrImage),
        scanBarcodeNative(sourceCanvasOrImage)
      ]);

      const cleanText = (text || '').trim();
      setDetectedText(cleanText);
      setDetectedBarcode(barcode || '');

      const matches = matchProductComprehensive({
        ocrText: cleanText,
        barcode: barcode || '',
        features: features,
        inventoryProducts: products,
        masterCatalogProducts: masterCatalogProducts,
        customTrained: trainedTemplates
      });

      setMatchCandidates(matches);

      // Auto-Add or Auto-Select logic
      if (autoAddEnabled && matches.length > 0) {
        const top = matches[0];
        const now = Date.now();
        const cooldown = 2000;
        const timeSince = now - lastAutoAddedTimeRef.current;

        if (top.confidence >= confidenceThreshold && (top.product.id !== lastAutoAddedIdRef.current || timeSince > cooldown)) {
          if (mode === 'purchase_order' && onSelectProduct) {
            handleSelectProductForAction(top.product, top.confidence);
          } else if (onAddToCart) {
            handleAddProductToCart(top.product, 1, top.confidence);
          }
          lastAutoAddedIdRef.current = top.product.id;
          lastAutoAddedTimeRef.current = now;
        }
      }
    } catch (e) {
      console.warn('Deep analysis error', e);
    } finally {
      setIsOcrProcessing(false);
    }
  }, [products, masterCatalogProducts, trainedTemplates, autoAddEnabled, confidenceThreshold, mode, onSelectProduct, onAddToCart]);

  // 6. Live Periodic Stream Analysis
  useEffect(() => {
    if (!isOpen || isFrozen) return;

    // Fast Visual Features matching every 300ms
    liveIntervalRef.current = setInterval(() => {
      if (isFrozen || !videoRef.current || videoRef.current.readyState < 2) return;

      const features = extractVisualFeatures(videoRef.current);
      if (features) {
        setCurrentFeatures(features);
        const matches = matchProductComprehensive({
          ocrText: detectedText,
          barcode: detectedBarcode,
          features: features,
          inventoryProducts: products,
          masterCatalogProducts: masterCatalogProducts,
          customTrained: trainedTemplates
        });
        if (matches.length > 0) {
          setMatchCandidates(matches);
        }
      }
    }, 300);

    // Background OCR & Barcode Scan every 1.5 seconds during live video
    ocrIntervalRef.current = setInterval(() => {
      if (isFrozen || !canvasRef.current || videoRef.current?.readyState < 2) return;
      performDeepAnalysis(canvasRef.current);
    }, 1500);

    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      if (ocrIntervalRef.current) clearInterval(ocrIntervalRef.current);
    };
  }, [isOpen, isFrozen, detectedText, detectedBarcode, products, masterCatalogProducts, trainedTemplates, performDeepAnalysis]);

  // 7. Handle Adding Product to Cart (for POS Checkout)
  const handleAddProductToCart = (product, qty = 1, confidence = 0) => {
    if (!product || !onAddToCart) return;

    onAddToCart(product, qty);
    playScanChime('success');

    setRecentNotification({
      message: `Added ${qty}x ${product.name} (${confidence || 95}%)`,
      type: 'success'
    });

    setTimeout(() => {
      setRecentNotification(null);
    }, 2500);
  };

  // 8. Handle Selecting Product for Purchase Order Form
  const handleSelectProductForAction = (product, confidence = 0) => {
    if (!product) return;

    playScanChime('success');

    if (onSelectProduct) {
      onSelectProduct(product, {
        detectedText,
        detectedBarcode,
        confidence: confidence || 95
      });
    } else if (onAddToCart) {
      onAddToCart(product, selectedQuantity);
    }

    if (mode === 'purchase_order') {
      onClose();
    }
  };

  // 9. Toggle Freeze Frame
  const handleToggleFreeze = () => {
    setIsFrozen(prev => {
      const next = !prev;
      playScanChime('capture');
      if (!prev && canvasRef.current) {
        performDeepAnalysis(canvasRef.current);
      }
      return next;
    });
  };

  // 10. Handle File Upload
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setIsFrozen(true);
        const canvas = canvasRef.current;
        if (canvas) {
          // Adjust canvas internal dimensions to match uploaded image aspect ratio while keeping clean display
          const aspect = img.width / img.height;
          if (aspect > 1) {
            canvas.width = 640;
            canvas.height = Math.round(640 / aspect);
          } else {
            canvas.height = 480;
            canvas.width = Math.round(480 * aspect);
          }
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }

        playScanChime('capture');
        performDeepAnalysis(img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 11. Snapshot Capture for Training
  const handleCaptureForTraining = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const features = extractVisualFeatures(canvas);

    setTrainSnapshotData({ dataUrl, features });
    playScanChime('capture');
  };

  // 12. Save Custom Training
  const handleSaveTraining = () => {
    if (!trainSnapshotData || !trainSelectedProductId) {
      alert('Please select a product and snap a frame first.');
      return;
    }

    const selectedProd = products.find(p => p.id === parseInt(trainSelectedProductId));
    if (!selectedProd) return;

    const newTemplate = {
      id: 'trained_' + Date.now(),
      productId: selectedProd.id,
      productName: selectedProd.name,
      price: selectedProd.price,
      sku: selectedProd.sku,
      colorName: trainCustomLabel || 'Custom Signature',
      thumbnail: trainSnapshotData.dataUrl,
      features: trainSnapshotData.features,
      createdAt: new Date().toISOString()
    };

    const updated = saveProductTemplate(newTemplate);
    setTrainedTemplates(updated);
    setTrainSnapshotData(null);
    setTrainSelectedProductId('');
    setTrainCustomLabel('');
    setActiveTab('scan');
    playScanChime('success');

    setRecentNotification({
      message: `Learned profile for "${selectedProd.name}" saved!`,
      type: 'success'
    });
    setTimeout(() => setRecentNotification(null), 3000);
  };

  // 13. Delete Model
  const handleDeleteTraining = (id) => {
    const updated = deleteProductTemplate(id);
    setTrainedTemplates(updated);
  };

  // 14. Hotkeys
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleFreeze();
      } else if (e.key === 'Enter') {
        if (matchCandidates.length > 0) {
          e.preventDefault();
          handleSelectProductForAction(matchCandidates[0].product, matchCandidates[0].confidence);
        }
      } else if (e.key === 'm' || e.key === 'M') {
        const modes = ['standard', 'canny', 'contours', 'hsv', 'threshold', 'keypoints'];
        const nextIdx = (modes.indexOf(visionMode) + 1) % modes.length;
        setVisionMode(modes[nextIdx]);
      } else if (e.key === 'c' || e.key === 'C') {
        if (cameraDevices.length > 1) {
          const currentIdx = cameraDevices.findIndex(d => d.deviceId === selectedDeviceId);
          const nextDevice = cameraDevices[(currentIdx + 1) % cameraDevices.length];
          setSelectedDeviceId(nextDevice.deviceId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFrozen, visionMode, cameraDevices, selectedDeviceId, matchCandidates, selectedQuantity, mode]);

  if (!isOpen) return null;

  const topMatch = matchCandidates.length > 0 ? matchCandidates[0] : null;

  const modalTitle = title || (
    mode === 'purchase_order'
      ? 'Vision Auto-Scan for Purchase Order'
      : 'OpenCV & OCR Visual Scanner'
  );

  const modalSubtitle = mode === 'purchase_order'
    ? 'Scan product or medicine box to auto-populate Company, Product Name, Category & Price'
    : 'Recognizes medicines, packaged items, barcodes & produce';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── Top Header Bar ── */}
        <div className="px-5 py-3.5 bg-slate-800/80 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white font-black text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">{modalTitle}</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                  {mode === 'purchase_order' ? 'PO Auto-Fill Active' : 'AI Multi-Modal Active'}
                </span>
              </div>
              <p className="text-xs text-slate-400">{modalSubtitle}</p>
            </div>
          </div>

          {/* Tab Navigation & Close */}
          <div className="flex items-center space-x-2">
            <div className="bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 flex items-center space-x-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('scan')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'scan'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Vision Scanner
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('train')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'train'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                + Train Look
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('models')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all relative ${
                  activeTab === 'models'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Learned ({trainedTemplates.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Close (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Notification Toast ── */}
        {recentNotification && (
          <div className="absolute top-16 right-6 z-40 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center space-x-2 animate-bounce">
            <svg className="w-5 h-5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs">{recentNotification.message}</span>
          </div>
        )}

        {/* ── MAIN CONTENT AREA ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">

          {/* TAB 1: LIVE VISION SCANNER */}
          {activeTab === 'scan' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* Left Column: Video Canvas & Controls */}
              <div className="lg:col-span-7 flex flex-col space-y-3">
                
                <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center group">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="hidden"
                  />

                  <canvas
                    ref={canvasRef}
                    width={480}
                    height={360}
                    className="w-full h-full object-cover"
                  />

                  {/* Camera Error Message */}
                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
                      <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">Camera Feed Inactive</h4>
                      <p className="text-xs text-slate-400 max-w-sm mb-4">You can take a photo or upload an image file of the product box directly.</p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                      >
                        Retry Camera
                      </button>
                    </div>
                  )}

                  {/* Overlay Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                    <div className="flex items-center space-x-2">
                      <span className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/80 text-indigo-300 text-[10px] font-mono font-bold px-2 py-1 rounded-lg uppercase">
                        Filter: {visionMode}
                      </span>
                      {isOcrProcessing && (
                        <span className="bg-indigo-500/30 text-indigo-300 border border-indigo-500/50 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center space-x-1 animate-pulse">
                          <span>OCR Reading...</span>
                        </span>
                      )}
                    </div>

                    {isFrozen && (
                      <span className="bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg animate-pulse">
                        FROZEN / PAUSED
                      </span>
                    )}
                  </div>

                  {/* Dominant Color Swatch */}
                  {currentFeatures && (
                    <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-sm border border-slate-700/80 rounded-xl px-2.5 py-1.5 flex items-center space-x-2 z-10">
                      <span className="text-[10px] text-slate-400 font-mono">Dominant:</span>
                      <div
                        className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
                        style={{
                          backgroundColor: `rgb(${currentFeatures.dominantRgb[0]}, ${currentFeatures.dominantRgb[1]}, ${currentFeatures.dominantRgb[2]})`
                        }}
                      />
                      <span className="text-[10px] font-mono text-slate-300">
                        {Math.round(currentFeatures.dominantHueDeg)}°
                      </span>
                    </div>
                  )}
                </div>

                {/* Filter Mode Selector */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/60 p-1.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider">Filter (M):</span>
                  {[
                    { id: 'standard', label: 'Standard RGB', icon: '🎯' },
                    { id: 'canny', label: 'Canny Edges', icon: '⚡' },
                    { id: 'contours', label: 'Contours & ROI', icon: '📐' },
                    { id: 'hsv', label: 'HSV Color', icon: '🌈' },
                    { id: 'threshold', label: 'Binary Mask', icon: '🌓' },
                    { id: 'keypoints', label: 'Keypoints', icon: '✨' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setVisionMode(m.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 ${
                        visionMode === m.id
                          ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>

                {/* Camera Hardware Controls & Upload */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex items-center space-x-2">
                    {cameraDevices.length > 1 && (
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                        className="bg-slate-800 text-slate-300 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
                      >
                        {cameraDevices.map((dev, idx) => (
                          <option key={dev.deviceId} value={dev.deviceId}>
                            {dev.label || `Camera ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={handleToggleFreeze}
                      className={`px-3 py-1.5 rounded-xl font-semibold border transition-all flex items-center space-x-1.5 ${
                        isFrozen
                          ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                      title="Freeze Frame (Space)"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isFrozen ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        )}
                      </svg>
                      <span>{isFrozen ? 'Resume Stream' : 'Freeze (Space)'}</span>
                    </button>

                    {/* Scan Now Button */}
                    <button
                      type="button"
                      onClick={() => canvasRef.current && performDeepAnalysis(canvasRef.current)}
                      disabled={isOcrProcessing}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white font-semibold transition-all flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>{isOcrProcessing ? 'Reading...' : 'Scan / Read Text'}</span>
                    </button>
                  </div>

                  <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center space-x-1.5">
                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Upload Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Right Column: Live Recognition & Match Panel */}
              <div className="lg:col-span-5 flex flex-col space-y-4">
                
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      {mode === 'purchase_order' ? 'PO Product Auto-Detection' : 'Visual Recognition'}
                    </h4>
                    <p className="text-[11px] text-slate-400">Position product or medicine box in frame</p>
                  </div>

                  <label className="text-[11px] font-semibold text-slate-300 cursor-pointer flex items-center space-x-1.5">
                    <span>{mode === 'purchase_order' ? 'Auto-Select' : 'Auto-Add'}</span>
                    <input
                      type="checkbox"
                      checked={autoAddEnabled}
                      onChange={(e) => setAutoAddEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer bg-slate-900 border-slate-700"
                    />
                  </label>
                </div>

                {/* OCR Detected Text Snippet Bar */}
                {detectedText && (
                  <div className="bg-slate-800/90 border border-indigo-500/40 rounded-2xl p-2.5 flex items-start space-x-2 text-xs animate-fadeIn">
                    <span className="text-indigo-400 font-bold flex-shrink-0 text-[11px] uppercase tracking-wider">
                      OCR Text:
                    </span>
                    <span className="text-slate-200 font-mono text-[11px] line-clamp-2">
                      "{detectedText.replace(/\n+/g, ' ')}"
                    </span>
                  </div>
                )}

                {/* Best Recognized Match Card */}
                {topMatch ? (
                  <div className="bg-gradient-to-b from-indigo-950/60 to-slate-900 border-2 border-indigo-500/80 rounded-2xl p-4 shadow-xl shadow-indigo-950/40 relative overflow-hidden animate-fadeIn">
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="bg-indigo-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider flex items-center space-x-1">
                        <span>{topMatch.icon || '🎯'}</span>
                        <span>{mode === 'purchase_order' ? 'MATCHED PRODUCT & COMPANY' : 'BEST PRODUCT MATCH'}</span>
                      </span>

                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs text-slate-400 font-medium">Confidence:</span>
                        <span className={`text-sm font-black font-mono px-2 py-0.5 rounded-lg border ${
                          topMatch.confidence >= 80
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : topMatch.confidence >= 60
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-700 text-slate-300 border-slate-600'
                        }`}>
                          {topMatch.confidence}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-extrabold text-white leading-snug">
                            {topMatch.product.name}
                          </h3>
                          <p className="text-xs text-indigo-300 mt-0.5">
                            {topMatch.reason}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block font-medium">Price</span>
                          <span className="text-xl font-black text-emerald-400">
                            {currency}{parseFloat(topMatch.product.price || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Product Details Grid (Company, Category, SKU) */}
                      <div className="bg-slate-900/80 rounded-xl p-2.5 border border-slate-700/60 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Company / Supplier:</span>
                          <span className="font-semibold text-amber-300 truncate block">
                            {topMatch.product.supplier_name || 'Generic / Unassigned'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Category:</span>
                          <span className="font-semibold text-slate-200 truncate block">
                            {topMatch.product.category || 'General / Medicine'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">SKU Code:</span>
                          <span className="font-mono text-slate-300">{topMatch.product.sku || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                            {(topMatch.product.unit || topMatch.product.unit_size) ? 'Unit & Pack Size:' : 'Stock Status:'}
                          </span>
                          {(topMatch.product.unit || topMatch.product.unit_size) ? (
                            <span className="font-semibold text-emerald-300">
                              {topMatch.product.unit || ''}{topMatch.product.unit && topMatch.product.unit_size ? ' • ' : ''}{topMatch.product.unit_size || ''}
                            </span>
                          ) : (
                            <span className={`font-semibold ${(topMatch.product.stock_quantity || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {(topMatch.product.stock_quantity || 0) > 0 ? `${topMatch.product.stock_quantity} available` : 'Out of stock'}
                            </span>
                          )}
                        </div>
                        {topMatch.product.expiry_date && (
                          <div className="col-span-2 flex items-center justify-between border-t border-slate-800/80 pt-1 text-[10px]">
                            <span className="text-slate-400 uppercase font-bold tracking-wider">Detected Expiry:</span>
                            <span className="font-mono text-emerald-400 font-bold">{topMatch.product.expiry_date}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2 border-t border-indigo-900/60">
                      {mode !== 'purchase_order' && (
                        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 text-white">
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                            className="w-7 h-7 rounded-lg hover:bg-slate-800 flex items-center justify-center font-bold text-slate-400 hover:text-white"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-xs">{selectedQuantity}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity(selectedQuantity + 1)}
                            className="w-7 h-7 rounded-lg hover:bg-slate-800 flex items-center justify-center font-bold text-slate-400 hover:text-white"
                          >
                            +
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSelectProductForAction(topMatch.product, topMatch.confidence)}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 active:scale-98 transition-all flex items-center justify-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>
                          {mode === 'purchase_order' ? 'Auto-Fill Purchase Order (Enter)' : 'Add to Cart (Enter)'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-2 text-indigo-400">
                      <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h5 className="text-xs font-bold text-white mb-1">
                      {isOcrProcessing ? 'Scanning Product Text & Company...' : 'Point Camera or Click "Scan / Read Text"'}
                    </h5>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Hold the medicine box (e.g. Napa, Ace), packaging, or barcode in front of the camera.
                    </p>
                  </div>
                )}

                {/* Other Candidates */}
                {matchCandidates.length > 1 && (
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3">
                    <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Other Candidate Matches
                    </h5>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {matchCandidates.slice(1).map((cand, idx) => (
                        <div
                          key={cand.product.id + '_' + idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-base">{cand.icon || '📦'}</span>
                            <div className="truncate">
                              <p className="text-xs font-bold text-white truncate">{cand.product.name}</p>
                              <span className="text-[10px] text-slate-400">
                                {cand.product.supplier_name ? `${cand.product.supplier_name} • ` : ''}
                                {(cand.product.unit || cand.product.unit_size) ? `${cand.product.unit || ''} ${cand.product.unit_size ? `(${cand.product.unit_size})` : ''} • ` : ''}
                                {currency}{parseFloat(cand.product.price || 0).toFixed(2)} • {cand.confidence}%
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectProductForAction(cand.product, cand.confidence)}
                            className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold flex-shrink-0 transition-colors"
                          >
                            Select
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hotkeys Bar */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 text-[11px] text-slate-400">
                  <div className="font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Keyboard Hotkeys</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">Enter</kbd> {mode === 'purchase_order' ? 'Auto-fill form' : 'Add top match'}</div>
                    <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">Space</kbd> Freeze frame</div>
                    <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">M</kbd> Vision filter</div>
                    <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">C</kbd> Switch camera</div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: TRAIN PRODUCT */}
          {activeTab === 'train' && (
            <div className="max-w-3xl mx-auto bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 space-y-5">
              <div>
                <h4 className="text-sm font-bold text-white">Train Custom Product Look</h4>
                <p className="text-xs text-slate-400">
                  Snap a photo of unbarcoded items, medicine packages, or custom produce to teach OpenCV its visual profile.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 block">1. Capture Reference Look</span>
                  <div className="aspect-[4/3] bg-black rounded-xl border border-slate-700 overflow-hidden relative flex items-center justify-center">
                    {trainSnapshotData ? (
                      <img src={trainSnapshotData.dataUrl} alt="Captured" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4">
                        <p className="text-xs text-slate-500 mb-2">No snapshot captured yet</p>
                        <button
                          type="button"
                          onClick={handleCaptureForTraining}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30"
                        >
                          Snap Camera Frame
                        </button>
                      </div>
                    )}
                  </div>
                  {trainSnapshotData && (
                    <button
                      type="button"
                      onClick={handleCaptureForTraining}
                      className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold"
                    >
                      Re-Capture Frame
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      2. Select Product from Inventory
                    </label>
                    <input
                      type="text"
                      placeholder="Search inventory..."
                      value={trainSearch}
                      onChange={(e) => setTrainSearch(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white mb-2 outline-none focus:border-indigo-500"
                    />
                    <select
                      value={trainSelectedProductId}
                      onChange={(e) => setTrainSelectedProductId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500 max-h-40"
                    >
                      <option value="">-- Choose matching product --</option>
                      {products
                        .filter(p => !trainSearch || (p.name || '').toLowerCase().includes(trainSearch.toLowerCase()))
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({currency}{parseFloat(p.price || 0).toFixed(2)}) - SKU: {p.sku}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      3. Visual Note / Label (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Napa Tablet Box, Green Bottle"
                      value={trainCustomLabel}
                      onChange={(e) => setTrainCustomLabel(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!trainSnapshotData || !trainSelectedProductId}
                    onClick={handleSaveTraining}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 disabled:opacity-50 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all mt-4"
                  >
                    Save & Train Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MANAGE MODELS */}
          {activeTab === 'models' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Learned Store Visual Profiles ({trainedTemplates.length})</h4>
                  <p className="text-xs text-slate-400">Custom merchandise and produce registered for recognition</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('train')}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                >
                  + Train New Item
                </button>
              </div>

              {trainedTemplates.length === 0 ? (
                <div className="p-8 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-center text-slate-400">
                  <p className="text-xs">No custom models trained yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    System automatically uses OCR text reading, barcode detection, and visual signatures.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {trainedTemplates.map(tmpl => (
                    <div
                      key={tmpl.id}
                      className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-center space-x-3">
                        {tmpl.thumbnail ? (
                          <img src={tmpl.thumbnail} alt={tmpl.productName} className="w-12 h-12 rounded-xl object-cover border border-slate-600" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-xl">
                            📦
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-white truncate">{tmpl.productName}</h5>
                          <span className="text-[10px] text-indigo-300 block">{tmpl.colorName}</span>
                          <span className="text-[10px] text-slate-400">{currency}{parseFloat(tmpl.price || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-[10px]">
                        <span className="text-slate-500 font-mono">
                          {new Date(tmpl.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTraining(tmpl.id)}
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 px-2 py-1 rounded-lg transition-colors"
                        >
                          Delete Model
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
