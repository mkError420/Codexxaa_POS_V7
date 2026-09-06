/**
 * OpenCV Computer Vision & Optical Recognition Engine
 * Provides:
 * - Optical Character Recognition (OCR) with Tesseract.js web worker for brand/medicine/product text reading
 * - Native Barcode / QR code detector
 * - Visual Feature & Color Signature Extractor (HSV, Aspect Ratio, dHash)
 * - Intelligent Multi-Modal Product Matcher against POS Inventory
 * - Custom Store Product Visual Learning System
 * - Audio Chime synthesizer
 */

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO CONFIRMATION FEEDBACK (Web Audio API)
// ─────────────────────────────────────────────────────────────────────────────
let audioCtx = null;

export function playScanChime(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
      osc.frequency.setValueAtTime(1760, now + 0.1);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'capture') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

      osc.start(now);
      osc.stop(now + 0.06);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (err) {
    // Audio is optional
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TESSERACT.JS OCR LOADER & WORKER
// ─────────────────────────────────────────────────────────────────────────────
let tesseractWorker = null;
let isTesseractLoading = false;

export async function initTesseractOCR() {
  if (tesseractWorker) return tesseractWorker;
  if (isTesseractLoading) {
    // Wait for in-flight init
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (tesseractWorker) {
          clearInterval(check);
          resolve(tesseractWorker);
        }
      }, 100);
    });
  }

  isTesseractLoading = true;

  try {
    // Dynamically load Tesseract.js script if not available
    if (!window.Tesseract) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
        document.body.appendChild(script);
      });
    }

    if (window.Tesseract) {
      tesseractWorker = await window.Tesseract.createWorker('eng');
    }
  } catch (err) {
    console.warn('OCR Worker Init Warning:', err);
  } finally {
    isTesseractLoading = false;
  }

  return tesseractWorker;
}

/**
 * Recognizes text from an image or canvas using Tesseract OCR
 */
export async function recognizeTextFromImage(imageOrCanvas) {
  try {
    const worker = await initTesseractOCR();
    if (!worker) return '';

    // Create high-contrast preprocessed canvas for faster OCR
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 400;
    tempCanvas.height = 300;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imageOrCanvas, 0, 0, 400, 300);

    // Apply contrast enhancement
    const imgData = ctx.getImageData(0, 0, 400, 300);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      // High contrast stretch
      const val = gray > 110 ? 255 : 0;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);

    const ret = await worker.recognize(tempCanvas);
    return ret?.data?.text || '';
  } catch (err) {
    console.warn('OCR recognition error:', err);
    return '';
  }
}

/**
 * Scans for barcode / QR codes using native BarcodeDetector API
 */
export async function scanBarcodeNative(imageOrCanvas) {
  try {
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'data_matrix']
      });
      const barcodes = await barcodeDetector.detect(imageOrCanvas);
      if (barcodes && barcodes.length > 0) {
        return barcodes[0].rawValue || '';
      }
    }
  } catch (e) {
    // Native barcode detector not supported or failed
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESET VISUAL PROFILES FOR COMMON RETAIL & GROCERY PRODUCE/ITEMS
// ─────────────────────────────────────────────────────────────────────────────
export const PRESET_PRODUCT_PROFILES = [
  {
    id: 'preset_apple_red',
    keywords: ['apple', 'red apple', 'gala', 'fuji', 'aple', 'আপেল'],
    category: 'Fruits & Produce',
    colorName: 'Ruby Red',
    targetHueRange: [[0, 16], [340, 360]],
    targetSatMin: 0.35,
    targetValMin: 0.20,
    aspectRatioRange: [0.8, 1.25],
    icon: '🍎'
  },
  {
    id: 'preset_apple_green',
    keywords: ['green apple', 'granny smith', 'apple green', 'সবুজ আপেল'],
    category: 'Fruits & Produce',
    colorName: 'Vibrant Green',
    targetHueRange: [[70, 135]],
    targetSatMin: 0.35,
    targetValMin: 0.25,
    aspectRatioRange: [0.8, 1.25],
    icon: '🍏'
  },
  {
    id: 'preset_banana',
    keywords: ['banana', 'sagor kola', 'kola', 'champa kola', 'সবরি কলা', 'কলা'],
    category: 'Fruits & Produce',
    colorName: 'Bright Yellow / Gold',
    targetHueRange: [[38, 65]],
    targetSatMin: 0.38,
    targetValMin: 0.35,
    aspectRatioRange: [1.3, 4.5],
    icon: '🍌'
  },
  {
    id: 'preset_orange',
    keywords: ['orange', 'malta', 'komla', 'mandarin', 'tangerine', 'কমলা', 'মাল্টা'],
    category: 'Fruits & Produce',
    colorName: 'Citrus Orange',
    targetHueRange: [[18, 38]],
    targetSatMin: 0.45,
    targetValMin: 0.35,
    aspectRatioRange: [0.85, 1.2],
    icon: '🍊'
  },
  {
    id: 'preset_lemon',
    keywords: ['lemon', 'lime', 'lebu', 'kagoji lebu', 'লেবু'],
    category: 'Fruits & Produce',
    colorName: 'Lemon / Lime Green',
    targetHueRange: [[50, 85]],
    targetSatMin: 0.35,
    targetValMin: 0.35,
    aspectRatioRange: [0.75, 1.4],
    icon: '🍋'
  },
  {
    id: 'preset_tomato',
    keywords: ['tomato', 'tamatar', 'টমেটো'],
    category: 'Vegetables',
    colorName: 'Scarlet Red',
    targetHueRange: [[345, 360], [0, 16]],
    targetSatMin: 0.40,
    targetValMin: 0.30,
    aspectRatioRange: [0.85, 1.2],
    icon: '🍅'
  },
  {
    id: 'preset_potato',
    keywords: ['potato', 'alu', 'aloo', 'potatos', 'গোল আলু', 'আলু'],
    category: 'Vegetables',
    colorName: 'Earthy Brown / Tan',
    targetHueRange: [[20, 48]],
    targetSatMin: 0.15,
    targetSatMax: 0.65,
    targetValMin: 0.25,
    aspectRatioRange: [0.9, 1.7],
    icon: '🥔'
  },
  {
    id: 'preset_onion',
    keywords: ['onion', 'peyaj', 'pyaj', 'red onion', 'পেঁয়াজ'],
    category: 'Vegetables',
    colorName: 'Purplish Red / Copper',
    targetHueRange: [[320, 360], [0, 25]],
    targetSatMin: 0.20,
    targetValMin: 0.20,
    aspectRatioRange: [0.8, 1.3],
    icon: '🧅'
  },
  {
    id: 'preset_egg',
    keywords: ['egg', 'dim', 'deem', 'farm egg', 'chicken egg', 'ডিম'],
    category: 'Dairy & Eggs',
    colorName: 'White / Pale Tan',
    targetHueRange: [[20, 55]],
    targetSatMin: 0.04,
    targetSatMax: 0.35,
    targetValMin: 0.60,
    aspectRatioRange: [1.1, 1.5],
    icon: '🥚'
  },
  {
    id: 'preset_milk',
    keywords: ['milk', 'dudh', 'dairy milk', 'aarong milk', 'milk vita', 'pran milk', 'দুধ'],
    category: 'Dairy & Eggs',
    colorName: 'White / Blue Package',
    targetHueRange: [[180, 240]],
    targetSatMin: 0.12,
    targetValMin: 0.55,
    aspectRatioRange: [1.3, 2.8],
    icon: '🥛'
  },
  {
    id: 'preset_bread',
    keywords: ['bread', 'pauruti', 'bun', 'toast', 'পাউরুটি'],
    category: 'Bakery',
    colorName: 'Golden Wheat / Brown',
    targetHueRange: [[22, 48]],
    targetSatMin: 0.25,
    targetValMin: 0.40,
    aspectRatioRange: [1.1, 2.2],
    icon: '🍞'
  },
  {
    id: 'preset_coca_cola',
    keywords: ['coca cola', 'coke', 'diet coke', 'coke zero', 'কোক', 'কোকাকোলা'],
    category: 'Beverages',
    colorName: 'Classic Coke Red',
    targetHueRange: [[348, 360], [0, 14]],
    targetSatMin: 0.50,
    targetValMin: 0.25,
    aspectRatioRange: [1.3, 3.2],
    icon: '🥤'
  },
  {
    id: 'preset_pepsi',
    keywords: ['pepsi', 'pepsi max', 'পেপসি'],
    category: 'Beverages',
    colorName: 'Electric Pepsi Blue',
    targetHueRange: [[200, 238]],
    targetSatMin: 0.45,
    targetValMin: 0.25,
    aspectRatioRange: [1.3, 3.2],
    icon: '🥤'
  },
  {
    id: 'preset_sprite',
    keywords: ['sprite', '7up', 'seven up', 'স্প্রাইট'],
    category: 'Beverages',
    colorName: 'Emerald Green',
    targetHueRange: [[110, 165]],
    targetSatMin: 0.45,
    targetValMin: 0.30,
    aspectRatioRange: [1.3, 3.2],
    icon: '🍾'
  },
  {
    id: 'preset_water',
    keywords: ['water', 'mineral water', 'pani', 'mum', 'fresh water', 'kinley', 'পানি'],
    category: 'Beverages',
    colorName: 'Crystal Cyan / Blue',
    targetHueRange: [[180, 225]],
    targetSatMin: 0.15,
    targetValMin: 0.50,
    aspectRatioRange: [1.8, 3.8],
    icon: '💧'
  },
  {
    id: 'preset_chips',
    keywords: ['chips', 'lays', 'kurkure', 'doritos', 'potato chips', 'চিপস'],
    category: 'Snacks',
    colorName: 'Vibrant Packaging',
    targetHueRange: [[20, 60], [330, 360]],
    targetSatMin: 0.40,
    targetValMin: 0.35,
    aspectRatioRange: [1.1, 1.8],
    icon: '🍟'
  },
  {
    id: 'preset_chocolate',
    keywords: ['chocolate', 'kitkat', 'cadbury', 'snickers', 'চকলেট'],
    category: 'Confectionery',
    colorName: 'Chocolate Brown / Red wrapper',
    targetHueRange: [[10, 32], [340, 360]],
    targetSatMin: 0.35,
    targetValMin: 0.20,
    aspectRatioRange: [1.4, 3.5],
    icon: '🍫'
  },
  {
    id: 'preset_tea',
    keywords: ['tea', 'cha', 'taaza', 'ispahani', 'lipton', 'black tea', 'গ্রিন টি', 'চা'],
    category: 'Groceries',
    colorName: 'Green / Red Tea Box',
    targetHueRange: [[85, 155], [0, 22]],
    targetSatMin: 0.30,
    targetValMin: 0.25,
    aspectRatioRange: [1.1, 1.7],
    icon: '🍵'
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// USER-TRAINED PRODUCT VISUAL REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
const TRAINED_STORAGE_KEY = 'codexaa_cv_trained_products_v1';

export function getTrainedTemplates() {
  try {
    const raw = localStorage.getItem(TRAINED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

export function saveProductTemplate(template) {
  try {
    const current = getTrainedTemplates();
    const updated = [template, ...current.filter(t => t.id !== template.id)].slice(0, 50);
    localStorage.setItem(TRAINED_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    return [];
  }
}

export function deleteProductTemplate(templateId) {
  try {
    const current = getTrainedTemplates();
    const updated = current.filter(t => t.id !== templateId);
    localStorage.setItem(TRAINED_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FAST IMAGE PROCESSING & FEATURE EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

export function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = max === 0 ? 0 : delta / max;
  let v = max;

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return { h, s, v };
}

let sampleCanvas = null;
let sampleCtx = null;

function getSampleCanvas() {
  if (!sampleCanvas) {
    sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 160;
    sampleCanvas.height = 120;
    sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  }
  return { canvas: sampleCanvas, ctx: sampleCtx };
}

export function extractVisualFeatures(imageSource) {
  try {
    const { canvas, ctx } = getSampleCanvas();
    ctx.drawImage(imageSource, 0, 0, 160, 120);

    const rx = 28;
    const ry = 21;
    const rw = 104;
    const rh = 78;

    const imgData = ctx.getImageData(rx, ry, rw, rh).data;
    const HUE_BINS = 16;
    const hueHistogram = new Array(HUE_BINS).fill(0);
    let totalSat = 0;
    let totalVal = 0;
    let coloredPixels = 0;
    let rSum = 0, gSum = 0, bSum = 0;

    const totalSamples = (rw * rh);

    for (let i = 0; i < imgData.length; i += 8) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];

      rSum += r;
      gSum += g;
      bSum += b;

      const { h, s, v } = rgbToHsv(r, g, b);
      totalSat += s;
      totalVal += v;

      if (s > 0.18 && v > 0.15 && v < 0.95) {
        const bin = Math.min(HUE_BINS - 1, Math.floor((h / 360) * HUE_BINS));
        hueHistogram[bin] += 1;
        coloredPixels++;
      }
    }

    const processedSamples = totalSamples / 2;
    const normHue = coloredPixels > 0
      ? hueHistogram.map(c => c / coloredPixels)
      : hueHistogram.map(() => 1 / HUE_BINS);

    let maxHueBin = 0;
    let maxHueWeight = 0;
    normHue.forEach((w, idx) => {
      if (w > maxHueWeight) {
        maxHueWeight = w;
        maxHueBin = idx;
      }
    });

    const dominantHueDeg = (maxHueBin + 0.5) * (360 / HUE_BINS);
    const avgR = Math.round(rSum / processedSamples);
    const avgG = Math.round(gSum / processedSamples);
    const avgB = Math.round(bSum / processedSamples);
    const avgSat = totalSat / processedSamples;
    const avgVal = totalVal / processedSamples;

    let dHash = '';
    const hashData = ctx.getImageData(0, 0, 9, 8).data;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const iL = (r * 9 + c) * 4;
        const iR = (r * 9 + (c + 1)) * 4;
        const gL = hashData[iL] * 0.3 + hashData[iL + 1] * 0.59 + hashData[iL + 2] * 0.11;
        const gR = hashData[iR] * 0.3 + hashData[iR + 1] * 0.59 + hashData[iR + 2] * 0.11;
        dHash += gL > gR ? '1' : '0';
      }
    }

    return {
      hueHistogram: normHue,
      dominantHueDeg,
      dominantHueConfidence: maxHueWeight,
      dominantRgb: [avgR, avgG, avgB],
      avgSat,
      avgVal,
      aspectRatio: rw / rh,
      dHash,
      capturedAt: Date.now()
    };
  } catch (err) {
    return null;
  }
}

function hammingDist(h1, h2) {
  if (!h1 || !h2 || h1.length !== h2.length) return 64;
  let d = 0;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] !== h2[i]) d++;
  }
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAST CANVAS FILTER RENDERING
// ─────────────────────────────────────────────────────────────────────────────

export function renderVisionOverlay(canvas, videoElement, mode = 'standard') {
  if (!canvas || !videoElement || videoElement.videoWidth === 0) return;

  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.drawImage(videoElement, 0, 0, w, h);

  if (mode !== 'standard') {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    if (mode === 'canny') {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          const left = (y * w + (x - 1)) * 4;
          const right = (y * w + (x + 1)) * 4;
          const top = ((y - 1) * w + x) * 4;
          const bottom = ((y + 1) * w + x) * 4;

          const gx = Math.abs(d[right] - d[left]);
          const gy = Math.abs(d[bottom] - d[top]);
          const edge = Math.min(255, (gx + gy) * 3);

          if (edge > 65) {
            d[idx] = 0;
            d[idx + 1] = 255;
            d[idx + 2] = 200;
          } else {
            d[idx] = 15;
            d[idx + 1] = 23;
            d[idx + 2] = 42;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (mode === 'threshold') {
      for (let i = 0; i < d.length; i += 4) {
        const gray = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
        const val = gray > 120 ? 255 : 0;
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (mode === 'hsv') {
      for (let i = 0; i < d.length; i += 4) {
        const { h: hue } = rgbToHsv(d[i], d[i + 1], d[i + 2]);
        d[i] = Math.round((hue / 360) * 255);
        d[i + 1] = 255;
        d[i + 2] = 200;
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (mode === 'keypoints') {
      for (let y = 20; y < h - 20; y += 24) {
        for (let x = 20; x < w - 20; x += 24) {
          const idx = (y * w + x) * 4;
          const diff = Math.abs(d[idx] - d[idx + 8]) + Math.abs(d[idx + 1] - d[idx + 9]);
          if (diff > 45) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    } else if (mode === 'contours') {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
    }
  }

  const rx = Math.floor(w * 0.18);
  const ry = Math.floor(h * 0.18);
  const rw = Math.floor(w * 0.64);
  const rh = Math.floor(h * 0.64);
  const cornerLen = 20;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
  ctx.fillRect(0, 0, w, ry);
  ctx.fillRect(0, ry + rh, w, h - (ry + rh));
  ctx.fillRect(0, ry, rx, rh);
  ctx.fillRect(rx + rw, ry, w - (rx + rw), rh);

  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#818cf8';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(rx, ry + cornerLen);
  ctx.lineTo(rx, ry);
  ctx.lineTo(rx + cornerLen, ry);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rx + rw - cornerLen, ry);
  ctx.lineTo(rx + rw, ry);
  ctx.lineTo(rx + rw, ry + cornerLen);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rx, ry + rh - cornerLen);
  ctx.lineTo(rx, ry + rh);
  ctx.lineTo(rx + cornerLen, ry + rh);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rx + rw - cornerLen, ry + rh);
  ctx.lineTo(rx + rw, ry + rh);
  ctx.lineTo(rx + rw, ry + rh - cornerLen);
  ctx.stroke();

  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// INTELLIGENT MULTI-MODAL PRODUCT MATCHING ENGINE (OCR + BARCODE + VISUAL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Matches extracted OCR text, Barcode, and Visual Features against store inventory
 * AND Super Admin Supplier Products Catalog
 */
export function matchProductComprehensive({
  ocrText = '',
  barcode = '',
  features = null,
  inventoryProducts = [],
  masterCatalogProducts = [],
  customTrained = []
}) {
  if ((!inventoryProducts || inventoryProducts.length === 0) && (!masterCatalogProducts || masterCatalogProducts.length === 0)) return [];

  const candidates = [];
  const normalizedOcr = (ocrText || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const ocrWords = normalizedOcr.split(/\s+/).filter(w => w.length >= 2);

  // 1. BARCODE / SKU EXACT MATCH (100% Confidence)
  if (barcode) {
    const cleanBarcode = barcode.trim().toLowerCase();
    const barcodeProduct = inventoryProducts.find(p => (p.sku || '').toLowerCase() === cleanBarcode);
    if (barcodeProduct) {
      candidates.push({
        product: barcodeProduct,
        confidence: 99,
        matchType: 'barcode',
        reason: `Barcode Match (SKU: ${barcodeProduct.sku})`,
        colorName: 'Barcode',
        icon: '🏷️'
      });
    }
  }

  // 2. OPTICAL CHARACTER RECOGNITION (OCR) MATCHING AGAINST LOCAL INVENTORY
  if (ocrWords.length > 0 && inventoryProducts.length > 0) {
    for (const prod of inventoryProducts) {
      const prodName = (prod.name || '').toLowerCase();
      const prodSku = (prod.sku || '').toLowerCase();
      const prodCategory = (prod.category || '').toLowerCase();
      const prodSupplier = (prod.supplier_name || '').toLowerCase();

      let score = 0;
      let matchReason = '';

      // Check for exact product name inside OCR text (e.g. "napa" or "bexipred")
      if (normalizedOcr.includes(prodName) || (prodName.length >= 3 && ocrWords.includes(prodName))) {
        score = 98;
        matchReason = `Optical Brand Name Match: "${prod.name}"`;
      } else {
        const nameTokens = prodName.split(/[\s\-\_\(\)\/]+/).filter(t => t.length >= 2);
        let tokenMatches = 0;

        for (const token of nameTokens) {
          if (ocrWords.includes(token) || normalizedOcr.includes(token)) {
            tokenMatches++;
          }
        }

        if (tokenMatches > 0) {
          score = Math.round(75 + (tokenMatches / nameTokens.length) * 20);
          matchReason = `Optical Text Match: ${tokenMatches}/${nameTokens.length} keywords`;
        } else if (prodCategory && normalizedOcr.includes(prodCategory)) {
          score = 65;
          matchReason = `Category Match (${prod.category})`;
        } else if (prodSku && normalizedOcr.includes(prodSku)) {
          score = 95;
          matchReason = `SKU code match: ${prod.sku}`;
        }
      }

      if (score >= 60) {
        if (!candidates.some(c => c.product.id === prod.id)) {
          candidates.push({
            product: prod,
            confidence: score,
            matchType: 'ocr',
            reason: matchReason,
            colorName: 'OCR Text',
            icon: '🔍'
          });
        }
      }
    }
  }

  // 3. OPTICAL CHARACTER RECOGNITION MATCHING AGAINST SUPER ADMIN "SUPPLIER PRODUCTS CATALOG"
  if (ocrWords.length > 0 && masterCatalogProducts.length > 0) {
    const genericModifiers = new Set(['tablet', 'tablets', 'capsule', 'capsules', 'syrup', 'suspension', 'drops', 'mg', 'ml', 'gm', 'injection', 'inhaler', 'cream', 'gel', 'ointment']);

    for (const masterItem of masterCatalogProducts) {
      const mName = (masterItem.product_name || '').toLowerCase().trim();
      const mSupplier = (masterItem.supplier_name || '').toLowerCase().trim();
      const mCategory = (masterItem.category || '').toLowerCase().trim();

      if (!mName) continue;

      let score = 0;
      let matchReason = '';

      const tokens = mName.split(/[\s\-\_\(\)\/]+/).filter(t => t.length >= 2);
      const brandToken = tokens.find(t => !genericModifiers.has(t) && t.length >= 3) || tokens[0];

      // Exact full name match in OCR text
      if (normalizedOcr.includes(mName) || (mName.length >= 3 && ocrWords.includes(mName))) {
        score = 98;
        matchReason = `Super Admin Catalog Match: "${masterItem.product_name}" (${masterItem.supplier_name || 'Verified Supplier'})`;
      } 
      // Primary brand token match (e.g. "napa" from "Napa 500mg Tablet")
      else if (brandToken && (ocrWords.includes(brandToken) || normalizedOcr.includes(brandToken))) {
        let matchedModifierCount = 0;
        let totalModifiers = 0;
        for (const t of tokens) {
          if (t !== brandToken) {
            totalModifiers++;
            if (ocrWords.includes(t) || normalizedOcr.includes(t)) {
              matchedModifierCount++;
            }
          }
        }
        score = 82 + (totalModifiers > 0 ? Math.round((matchedModifierCount / totalModifiers) * 16) : 8);
        matchReason = `Catalog Brand Match: "${masterItem.product_name}" (${masterItem.supplier_name || 'Verified Supplier'})`;
      } else {
        let matchCount = 0;
        for (const t of tokens) {
          if (ocrWords.includes(t) || normalizedOcr.includes(t)) {
            matchCount++;
          }
        }
        if (matchCount > 0 && matchCount >= Math.ceil(tokens.length * 0.5)) {
          score = Math.round(70 + (matchCount / tokens.length) * 25);
          matchReason = `Catalog Keyword Match: "${masterItem.product_name}" (${masterItem.supplier_name || ''})`;
        }
      }

      // Bonus if supplier name (e.g. "Beximco" or "Square") is also detected in OCR
      if (score >= 70 && mSupplier) {
        const supTokens = mSupplier.split(/[\s\-\_\(\)\,\.]+/).filter(t => t.length >= 3 && !['ltd', 'plc', 'pharmaceuticals', 'laboratories', 'industry', 'limited'].includes(t));
        const hasSupMatch = supTokens.some(st => normalizedOcr.includes(st) || ocrWords.includes(st));
        if (hasSupMatch) {
          score = Math.min(100, score + 12);
          matchReason += ` • Company Confirmed: ${masterItem.supplier_name}`;
        }
      }

      if (score >= 70) {
        // Look up if shop already has this product in inventory
        const existingLocal = inventoryProducts.find(p => (p.name || '').toLowerCase() === mName);

        const defaultPrice = masterItem.price ? parseFloat(masterItem.price) : 35;
        const defaultCost = masterItem.cost_price ? parseFloat(masterItem.cost_price) : (defaultPrice * 0.85);

        const combinedProduct = {
          id: existingLocal ? existingLocal.id : null,
          name: masterItem.product_name,
          supplier_name: masterItem.supplier_name || (existingLocal ? existingLocal.supplier_name : ''),
          category: masterItem.category || (existingLocal ? existingLocal.category : 'Medicine'),
          price: existingLocal && parseFloat(existingLocal.price) > 0 ? parseFloat(existingLocal.price) : defaultPrice,
          cost_price: existingLocal && parseFloat(existingLocal.cost_price) > 0 ? parseFloat(existingLocal.cost_price) : defaultCost,
          sku: existingLocal ? existingLocal.sku : '',
          stock_quantity: existingLocal ? existingLocal.stock_quantity : 0,
          unit: existingLocal ? existingLocal.unit : 'piece',
          is_master_catalog: true
        };

        const exists = candidates.findIndex(c => (c.product.name || '').toLowerCase() === mName);
        if (exists >= 0) {
          if (score > candidates[exists].confidence || !candidates[exists].product.supplier_name) {
            candidates[exists].product.supplier_name = combinedProduct.supplier_name;
            candidates[exists].product.category = combinedProduct.category;
            candidates[exists].confidence = Math.max(candidates[exists].confidence, score);
            candidates[exists].reason = matchReason;
          }
        } else {
          candidates.push({
            product: combinedProduct,
            confidence: score,
            matchType: 'master_catalog',
            reason: matchReason,
            colorName: masterItem.supplier_name || 'Super Admin Catalog',
            icon: '🏢'
          });
        }
      }
    }
  }

  // 4. USER-TRAINED VISUAL TEMPLATES
  const trainedList = customTrained.length > 0 ? customTrained : getTrainedTemplates();
  if (features) {
    for (const template of trainedList) {
      if (!template.features) continue;

      const hashDist = hammingDist(features.dHash, template.features.dHash);
      const hashScore = Math.max(0, (64 - hashDist) / 64);

      let histSim = 0;
      if (features.hueHistogram && template.features.hueHistogram) {
        for (let i = 0; i < features.hueHistogram.length; i++) {
          histSim += Math.min(features.hueHistogram[i], template.features.hueHistogram[i]);
        }
      }

      const overallScore = (hashScore * 0.5) + (histSim * 0.5);
      const confidencePct = Math.round(overallScore * 100);

      if (confidencePct >= 45) {
        const matchedInvProduct = inventoryProducts.find(p => p.id === template.productId) || {
          id: template.productId,
          name: template.productName,
          price: template.price || 0,
          stock_quantity: template.stock || 999,
          sku: template.sku || 'TRAINED'
        };

        if (!candidates.some(c => c.product.id === matchedInvProduct.id)) {
          candidates.push({
            product: matchedInvProduct,
            confidence: confidencePct,
            matchType: 'trained',
            reason: `Trained Visual Signature (${confidencePct}%)`,
            colorName: template.colorName || 'Custom Signature',
            icon: '🎯'
          });
        }
      }
    }
  }

  // 5. PRESET PRODUCE / ITEM SIGNATURES
  if (features) {
    for (const preset of PRESET_PRODUCT_PROFILES) {
      let hueMatch = false;
      const currentHue = features.dominantHueDeg;

      for (const [minH, maxH] of preset.targetHueRange) {
        if (currentHue >= minH && currentHue <= maxH) {
          hueMatch = true;
          break;
        }
      }

      if (!hueMatch) continue;

      const satOk = features.avgSat >= (preset.targetSatMin || 0) && features.avgSat <= (preset.targetSatMax || 1.0);
      const valOk = features.avgVal >= (preset.targetValMin || 0);

      if (!satOk || !valOk) continue;

      const signatureConfidence = Math.min(94, Math.round((features.dominantHueConfidence * 60 + 35)));

      const matchedProducts = inventoryProducts.filter(p => {
        const pName = (p.name || '').toLowerCase();
        const pCategory = (p.category || '').toLowerCase();
        const pSku = (p.sku || '').toLowerCase();

        return preset.keywords.some(kw =>
          pName.includes(kw) ||
          pCategory.includes(kw) ||
          pSku.includes(kw)
        );
      });

      if (matchedProducts.length > 0) {
        for (const prod of matchedProducts) {
          if (!candidates.some(c => c.product.id === prod.id)) {
            candidates.push({
              product: prod,
              confidence: signatureConfidence,
              matchType: 'preset',
              reason: `Visual Produce Profile: ${preset.colorName}`,
              colorName: preset.colorName,
              icon: preset.icon
            });
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 5);
}
