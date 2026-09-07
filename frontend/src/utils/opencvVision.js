import API_BASE_URL from '../config';

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
// TESSERACT.JS OCR LOADER & WORKER QUEUE
// ─────────────────────────────────────────────────────────────────────────────
let tesseractWorker = null;
let isTesseractLoading = false;
let ocrWorkerQueue = Promise.resolve();
let barcodeDetector = null;
const TESSERACT_LANGUAGES = 'eng';
const TESSDATA_PATH = 'https://tessdata.projectnaptha.com/4.0.0';

/**
 * Crop the Red ROI Bounding Box from the webcam/canvas source before sending
 * to the PHP backend for Tesseract OCR processing.
 *
 * Strategy:
 * 1. Prefer raw video dimensions (higher resolution than the display canvas).
 * 2. Crop only the center 64% ROI — matching the red scanner box drawn by renderVisionOverlay.
 * 3. Upscale the crop to at least MIN_OCR_WIDTH pixels wide so Tesseract receives
 *    enough pixels to resolve fine medicine-label text.
 * 4. Apply a single-pass unsharp-mask sharpening kernel to the cropped pixels
 *    before JPEG encoding — reduces blur from camera lens or scaling.
 */
const MIN_OCR_WIDTH = 960; // minimum pixel width sent to Tesseract on the server

export function cropRedRoiToBase64(source, quality = 0.92) {
  if (!source) return '';

  // Prefer native video/image dimensions over the (scaled-down) display canvas
  const sourceWidth  = source.videoWidth  || source.naturalWidth  || source.width  || 0;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height || 0;
  if (!sourceWidth || !sourceHeight) return '';

  // ── 1. Compute ROI coordinates (18% inset on each side → 64% center region) ──
  const cropX      = Math.floor(sourceWidth  * 0.18);
  const cropY      = Math.floor(sourceHeight * 0.18);
  const cropWidth  = Math.max(1, Math.floor(sourceWidth  * 0.64));
  const cropHeight = Math.max(1, Math.floor(sourceHeight * 0.64));

  // ── 2. Upscale so the shorter axis is at least MIN_OCR_WIDTH ─────────────────
  const scaleUp   = cropWidth < MIN_OCR_WIDTH ? MIN_OCR_WIDTH / cropWidth : 1;
  const destWidth  = Math.round(cropWidth  * scaleUp);
  const destHeight = Math.round(cropHeight * scaleUp);

  const canvas  = document.createElement('canvas');
  canvas.width  = destWidth;
  canvas.height = destHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the ROI region, upscaled into the destination canvas
  ctx.drawImage(
    source,
    cropX, cropY, cropWidth, cropHeight,   // source rect
    0,     0,     destWidth, destHeight     // destination rect
  );

  // ── 3. Unsharp-mask sharpening kernel (3×3 convolution) ──────────────────────
  // Kernel:  [ 0 -1  0 ]
  //          [-1  5 -1 ]
  //          [ 0 -1  0 ]
  // This enhances edges without amplifying color noise excessively.
  try {
    const imgData = ctx.getImageData(0, 0, destWidth, destHeight);
    const src = imgData.data;
    const dst = new Uint8ClampedArray(src.length);
    const w = destWidth;
    const h = destHeight;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          // Fetch 4-neighbour pixels (clamp to edges)
          const top    = ((Math.max(0,   y - 1)) * w + x) * 4 + c;
          const bottom = ((Math.min(h-1, y + 1)) * w + x) * 4 + c;
          const left   = (y * w + Math.max(0,   x - 1)) * 4 + c;
          const right  = (y * w + Math.min(w-1, x + 1)) * 4 + c;
          const sharp  = 5 * src[i + c] - src[top] - src[bottom] - src[left] - src[right];
          dst[i + c]   = Math.max(0, Math.min(255, sharp));
        }
        dst[i + 3] = src[i + 3]; // preserve alpha
      }
    }
    ctx.putImageData(new ImageData(dst, w, h), 0, 0);
  } catch (_) {
    // Sharpening is best-effort — proceed with unsharpened crop if it fails
  }

  return canvas.toDataURL('image/jpeg', quality);
}

async function recognizeTextWithBackend(imageOrCanvas) {
  try {
    const image = cropRedRoiToBase64(imageOrCanvas);
    if (!image) return '';
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/ocr/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ image })
    });
    if (!response.ok) return '';
    const result = await response.json();
    if (result.angle && result.angle !== 0) {
      console.debug(`[OCR] Auto-rotated ${result.angle}° to extract valid text`);
    }
    return cleanOcrText(result.text || '');
  } catch (error) {
    return '';
  }
}

export async function initTesseractOCR() {
  if (tesseractWorker) return tesseractWorker;
  if (isTesseractLoading) {
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
      tesseractWorker = await window.Tesseract.createWorker(TESSERACT_LANGUAGES, 1, {
        langPath: TESSDATA_PATH,
        cachePath: 'tesseract-cache',
        gzip: true
      });
    }
  } catch (err) {
    console.warn('OCR Worker Init Warning:', err);
  } finally {
    isTesseractLoading = false;
  }

  return tesseractWorker;
}

/**
 * Clean and normalize OCR recognized text:
 * - Removes isolated symbols & gibberish
 * - Deduplicates identical consecutive or repeated lines
 * - Normalizes spacing
 */
export function cleanOcrText(rawText = '') {
  if (!rawText) return '';
  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.replace(/[~`_=<>|\\\/]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(line => {
      if (!line) return false;
      const cleanLetters = line.replace(/[^\p{L}\p{N}]/gu, '');
      if (cleanLetters.length < 2) return false;
      return true;
    });

  const uniqueLines = [];
  for (const l of lines) {
    if (!uniqueLines.some(ul => ul.toLowerCase() === l.toLowerCase())) {
      uniqueLines.push(l);
    }
  }
  return uniqueLines.join('\n').trim();
}

/**
 * Recognizes text from an image or canvas using Tesseract OCR.
 * Uses sequential queue to prevent worker race conditions, and applies
 * contrast stretching to preserve crisp fine-print on medicine packaging.
 */
export async function recognizeTextFromImage(imageOrCanvas) {
  const serverText = await recognizeTextWithBackend(imageOrCanvas);
  if (serverText) return serverText;

  // Chain through sequential worker queue to guarantee single-threaded safety
  const executeOcr = async () => {
    try {
      const worker = await initTesseractOCR();
      if (!worker) return '';

      // Determine native source dimensions
      const srcW = imageOrCanvas.naturalWidth || imageOrCanvas.videoWidth || imageOrCanvas.width || 800;
      const srcH = imageOrCanvas.naturalHeight || imageOrCanvas.videoHeight || imageOrCanvas.height || 600;

      // Scale proportionally: Keep resolution high enough for small medicine fine-print (up to 1600px)
      const maxDim = 1600;
      const minDim = 720;
      let scale = 1;
      if (Math.max(srcW, srcH) > maxDim) {
        scale = maxDim / Math.max(srcW, srcH);
      } else if (Math.min(srcW, srcH) < minDim && Math.max(srcW, srcH) * (minDim / Math.min(srcW, srcH)) <= 1600) {
        scale = minDim / Math.min(srcW, srcH);
      }

      const targetW = Math.max(480, Math.round(srcW * scale));
      const targetH = Math.max(360, Math.round(srcH * scale));

      // Create a high-resolution grayscale canvas for package text.
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = targetW;
      srcCanvas.height = targetH;
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      srcCtx.imageSmoothingEnabled = true;
      srcCtx.imageSmoothingQuality = 'high';
      srcCtx.drawImage(imageOrCanvas, 0, 0, targetW, targetH);

      const srcImgData = srcCtx.getImageData(0, 0, targetW, targetH);
      const src = srcImgData.data;

      // Compute luminance histogram for dynamic range contrast stretch
      const hist = new Int32Array(256);
      let totalSamples = 0;
      for (let i = 0; i < src.length; i += 8) {
        const lum = Math.round(src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114);
        hist[lum]++;
        totalSamples++;
      }

      const p1Cutoff = Math.floor(totalSamples * 0.01);
      const p99Cutoff = Math.floor(totalSamples * 0.99);
      let p1 = 0, acc = 0;
      while (p1 < 255 && acc < p1Cutoff) { acc += hist[p1]; p1++; }
      let p99 = 255; acc = 0;
      while (p99 > 0 && acc < (totalSamples - p99Cutoff)) { acc += hist[p99]; p99--; }
      if (p99 <= p1) { p1 = 0; p99 = 255; }
      const range = Math.max(30, p99 - p1);

      for (let i = 0; i < src.length; i += 4) {
        const lum = Math.round(src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114);
        const norm = Math.max(0, Math.min(1, (lum - p1) / range));
        const val = Math.round(Math.pow(norm, 0.90) * 255);
        src[i] = val;
        src[i + 1] = val;
        src[i + 2] = val;
      }
      srcCtx.putImageData(srcImgData, 0, 0);

      await worker.setParameters({
        tessedit_pageseg_mode: '11',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        language_model_penalty_non_freq_dict_word: '0.1'
      });

      const firstResult = await worker.recognize(srcCanvas);
      const firstText = cleanOcrText(firstResult?.data?.text || '');
      const firstSignal = firstText.replace(/[^\p{L}\p{N}]/gu, '').length;
      const firstConfidence = Number(firstResult?.data?.confidence || 0);

      // Small labels often need a binary image and a tighter scan region.
      if (firstSignal >= 12 && (!firstConfidence || firstConfidence >= 45)) return firstText;

      const cropX = Math.round(targetW * 0.18);
      const cropY = Math.round(targetH * 0.18);
      const cropW = Math.max(320, Math.round(targetW * 0.64));
      const cropH = Math.max(240, Math.round(targetH * 0.64));
      const focusedCanvas = document.createElement('canvas');
      focusedCanvas.width = cropW;
      focusedCanvas.height = cropH;
      const focusedCtx = focusedCanvas.getContext('2d', { willReadFrequently: true });
      focusedCtx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      const focusedData = focusedCtx.getImageData(0, 0, cropW, cropH);
      const pixels = focusedData.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const value = pixels[i] > 145 ? 255 : 0;
        pixels[i] = value;
        pixels[i + 1] = value;
        pixels[i + 2] = value;
      }
      focusedCtx.putImageData(focusedData, 0, 0);

      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300'
      });
      const retryResult = await worker.recognize(focusedCanvas);
      const retryText = cleanOcrText(retryResult?.data?.text || '');
      const retrySignal = retryText.replace(/[^\p{L}\p{N}]/gu, '').length;
      const retryConfidence = Number(retryResult?.data?.confidence || 0);
      if (retrySignal > firstSignal) return retryText;
      if (retrySignal === firstSignal && retryConfidence > firstConfidence) return retryText;
      return firstText;
    } catch (err) {
      console.warn('OCR recognition error:', err);
      return '';
    }
  };

  const currentTask = ocrWorkerQueue.then(executeOcr).catch(() => '');
  ocrWorkerQueue = currentTask;
  return currentTask;
}

/**
 * Scans for barcode / QR codes using native BarcodeDetector API
 */
export async function scanBarcodeNative(imageOrCanvas) {
  try {
    if ('BarcodeDetector' in window) {
      if (!barcodeDetector) {
        barcodeDetector = new window.BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'data_matrix']
        });
      }
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

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN PHARMACEUTICAL & CONSUMER MANUFACTURERS FOR VISION IDENTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// KNOWN PHARMACEUTICAL & CONSUMER MANUFACTURERS FOR VISION IDENTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export const KNOWN_MANUFACTURERS = [
  { key: 'lundbeck', name: 'H. Lundbeck A/S', aliases: ['lundbeck', 'h lundbeck', 'h. lundbeck'] },
  { key: 'rottendorf', name: 'Rottendorf Pharma GmbH', aliases: ['rottendorf', 'rottendorf pharma'] },
  { key: 'acme', name: 'The ACME Laboratories Ltd.', aliases: ['acme', 'a c m e', 'acme laboratories', 'the acme laboratories'] },
  { key: 'square', name: 'Square Pharmaceuticals PLC', aliases: ['square', 'square pharma', 'square pharmaceuticals'] },
  { key: 'beximco', name: 'Beximco Pharmaceuticals Ltd.', aliases: ['beximco', 'beximco pharma'] },
  { key: 'incepta', name: 'Incepta Pharmaceuticals Ltd.', aliases: ['incepta', 'incepta pharma'] },
  { key: 'renata', name: 'Renata Limited', aliases: ['renata'] },
  { key: 'aci', name: 'ACI Limited', aliases: ['aci', 'aci healthcare'] },
  { key: 'aristopharma', name: 'Aristopharma Ltd.', aliases: ['aristopharma'] },
  { key: 'eskayef', name: 'Eskayef Pharmaceuticals Ltd.', aliases: ['eskayef', 'sk+f', 'sk & f', 'skf'] },
  { key: 'opsonin', name: 'Opsonin Pharma Ltd.', aliases: ['opsonin'] },
  { key: 'healthcare', name: 'Healthcare Pharmaceuticals Ltd.', aliases: ['healthcare', 'hpl'] },
  { key: 'drug international', name: 'Drug International Ltd.', aliases: ['drug international', 'drug int'] },
  { key: 'ibn sina', name: 'The IBN SINA Pharmaceutical Industry PLC', aliases: ['ibn sina', 'ibnsina'] },
  { key: 'popular', name: 'Popular Pharmaceuticals Ltd.', aliases: ['popular'] },
  { key: 'radiant', name: 'Radiant Pharmaceuticals Ltd.', aliases: ['radiant'] },
  { key: 'beacon', name: 'Beacon Pharmaceuticals PLC', aliases: ['beacon'] },
  { key: 'ziska', name: 'Ziska Pharmaceuticals Ltd.', aliases: ['ziska'] },
  { key: 'delta', name: 'Delta Pharma Limited', aliases: ['delta pharma'] },
  { key: 'general', name: 'General Pharmaceuticals Ltd.', aliases: ['general pharma'] },
  { key: 'novartis', name: 'Novartis AG', aliases: ['novartis'] },
  { key: 'pfizer', name: 'Pfizer Inc.', aliases: ['pfizer'] },
  { key: 'gsk', name: 'GlaxoSmithKline PLC', aliases: ['gsk', 'glaxosmithkline'] },
  { key: 'sanofi', name: 'Sanofi S.A.', aliases: ['sanofi'] },
  { key: 'roche', name: 'F. Hoffmann-La Roche AG', aliases: ['roche', 'hoffmann-la roche'] },
  { key: 'astrazeneca', name: 'AstraZeneca PLC', aliases: ['astrazeneca'] },
  { key: 'unilever', name: 'Unilever Bangladesh', aliases: ['unilever'] },
  { key: 'nestle', name: 'Nestle Bangladesh', aliases: ['nestle'] },
  { key: 'pran', name: 'PRAN-RFL Group', aliases: ['pran'] }
];

export function findKnownCompanyInText(rawText = '') {
  if (!rawText) return null;
  const lower = rawText.toLowerCase();
  for (const m of KNOWN_MANUFACTURERS) {
    for (const alias of m.aliases) {
      const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${esc}\\b`, 'i').test(lower)) {
        return m;
      }
    }
  }
  return null;
}

/**
 * Robust extraction of pharmaceutical company/manufacturer/marketer from OCR text.
 * Detects patterns like:
 * - "Marketed by H. Lundbeck A/S, Copenhagen, Denmark"
 * - "Manufactured by Rottendorf Pharma Gmbh, Ennigerloh, Germany"
 * - "Mfg. by: The ACME Laboratories Ltd."
 * - Company names ending in Pharma, Pharmaceuticals, Laboratories, Ltd, PLC, GmbH, A/S
 */
export function extractCompanyFromText(rawText = '') {
  if (!rawText) return { primaryCompany: '', candidateCompanies: [] };
  const text = rawText.replace(/\r/g, ' ');
  const candidateCompanies = [];

  const addCandidate = (name) => {
    if (!name) return;
    let clean = name.trim()
      .replace(/[\n\r]+/g, ' ')
      .replace(/^[\s\:\-\,\.]+|[\s\:\-\,\.]+$/g, '');
    // Strip trailing city/country noise like ", Copenhagen, Denmark" or ", Ennigerloh, Germany"
    clean = clean.replace(/[\,\s]+(?:copenhagen|denmark|germany|ennigerloh|bangladesh|dhaka|india|usa|uk|london|france|switzerland|karachi|pakistan|japan|italy)[\s\S]*$/i, '').trim();
    if (clean.length >= 3 && clean.length <= 60 && !/^(the|a|an|medicine|pack|box|tablets?|capsules?)$/i.test(clean)) {
      if (!candidateCompanies.some(c => c.toLowerCase() === clean.toLowerCase())) {
        candidateCompanies.push(clean);
      }
    }
  };

  // 1. Prefix-based extraction (Marketed by, Manufactured by, Mfg by, Mfd by, Distributed by)
  const prefixPatterns = [
    /(?:marketed\s*(?:in\s+[a-zA-Z\s]+)?by|marketed\s*by|marketer)[\s\:\-]+([a-zA-Z0-9\s\.\,\'\&\-]+?)(?:\,|\.|\n|copenhagen|germany|bangladesh|dhaka|india|usa|\d{4,}|$)/i,
    /(?:manufactured\s*(?:in\s+[a-zA-Z\s]+)?by|mfg\.?\s*by|mfd\.?\s*by|produced\s*by|packed\s*by|imported\s*by)[\s\:\-]+([a-zA-Z0-9\s\.\,\'\&\-]+?)(?:\,|\.|\n|ennigerloh|germany|bangladesh|dhaka|india|usa|\d{4,}|$)/i
  ];

  for (const pat of prefixPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      addCandidate(match[1]);
    }
  }

  // 2. Search against known manufacturer registry
  const known = findKnownCompanyInText(rawText);
  if (known) {
    addCandidate(known.name);
  }

  // 3. Suffix matching for pharma corporate forms
  const suffixMatches = text.match(/\b([A-Z][a-zA-Z0-9\.\'\&\-\s]{2,35}?\s*(?:Pharma(?:ceuticals)?|Laboratories|Labs?|Healthcare|Therapeutics|PLC|Ltd|GmbH|A\/S|S\.A\.|Inc|Corp))\b/g);
  if (suffixMatches) {
    for (const sm of suffixMatches) {
      if (!/^(?:prescription\s*only|keep\s*out|store\s*below|for\s*external)/i.test(sm.trim())) {
        addCandidate(sm);
      }
    }
  }

  return {
    primaryCompany: candidateCompanies.length > 0 ? candidateCompanies[0] : '',
    candidateCompanies
  };
}

function hasWordBoundary(text, word) {
  if (!text || !word) return false;
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${esc}\\b`, 'i').test(text);
}

function formatExpiryDate(rawExp) {
  if (!rawExp) return '';
  const monthNames = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // Format: "FEB.2023" or "FEB 2023" or "FEB-2023"
  const alphaMatch = rawExp.match(/([a-zA-Z]{3,4})[\.\s\-\/]*(\d{2,4})/);
  if (alphaMatch) {
    const mStr = alphaMatch[1].toLowerCase().slice(0, 3);
    const m = monthNames[mStr];
    let y = alphaMatch[2];
    if (y.length === 2) y = `20${y}`;
    if (m && y.length === 4) {
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // Format: "02/2023" or "02-2023"
  const numMatch = rawExp.match(/(\d{1,2})[\/\-\.](\d{2,4})/);
  if (numMatch) {
    let m = numMatch[1].padStart(2, '0');
    let y = numMatch[2];
    if (y.length === 2) y = `20${y}`;
    if (parseInt(m) >= 1 && parseInt(m) <= 12 && y.length === 4) {
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  return rawExp;
}

/**
 * Intelligent parser that extracts medicine packaging details:
 * Brand name, Strength, Generic / Active Ingredient, Company/Manufacturer,
 * Dosage Form / Category, Pack Size, Unit, MRP Price, Batch, Expiry
 */
export function parseMedicinePackaging(rawText = '') {
  if (!rawText) return null;
  const clean = rawText.replace(/\r/g, '');
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Manufacturer / Marketer Company Extraction
  const companyInfo = extractCompanyFromText(clean);
  const foundCompany = companyInfo.primaryCompany || (findKnownCompanyInText(clean)?.name || '');

  // 2. Dosage Form & Category
  let category = 'Medicine';
  if (/\b(?:capsule|capsules|cap|caps)\b/i.test(clean)) {
    category = 'Capsule';
  } else if (/\b(?:tablet|tablets|tab|tabs)\b/i.test(clean)) {
    category = 'Tablet';
  } else if (/\b(?:syrup|suspension|susp)\b/i.test(clean)) {
    category = 'Syrup';
  } else if (/\b(?:injection|inj|ampoule|vial)\b/i.test(clean)) {
    category = 'Injection';
  } else if (/\b(?:inhaler|rotacap|respicap)\b/i.test(clean)) {
    category = 'Inhaler';
  } else if (/\b(?:drops?|pediatric drops?|eye drops?)\b/i.test(clean)) {
    category = 'Pediatric Drops';
  } else if (/\b(?:cream|ointment|gel)\b/i.test(clean)) {
    category = 'Ointment';
  } else if (/\b(?:vitamin)\b/i.test(clean)) {
    category = 'Vitamin';
  }

  // 3. Batch Number
  let batch = '';
  const batchMatch = clean.match(/(?:batch|b\.?\s*no|lot)[\.\:\s]*([A-Z0-9\-]+)/i);
  if (batchMatch) {
    batch = batchMatch[1].trim();
  }

  // 4. Expiry Date
  let expiry = '';
  const expMatch = clean.match(/(?:exp|expiry)[\.\s]*(?:date)?[\.\:\s]*([A-Z]{3,4}[\.\s\-\/]*\d{2,4}|\d{1,2}[\/\-\.]\d{2,4})/i);
  if (expMatch) {
    expiry = formatExpiryDate(expMatch[1].trim());
  }

  // 5. Price / MRP / With VAT
  let price = null;
  const priceMatch = clean.match(/(?:mrp|with\s*vat|vat|tk|price)[\.\:\s\=]*t?k?[\.\:\s]*([0-9]+\.?[0-9]{0,2})/i);
  if (priceMatch) {
    const p = parseFloat(priceMatch[1]);
    if (!isNaN(p) && p > 0 && p < 100000) {
      price = p;
    }
  }

  // 6. Strength / Dosage (e.g. 50000 IU, 500mg, 20mg, 10mg, 65mg)
  let strength = '';
  const strengthMatch = clean.match(/(\d+(?:\.\d+)?\s*(?:iu|mg|gm|g|mcg|ml|iu\/ml|bp|usp))\b/i);
  if (strengthMatch) {
    strength = strengthMatch[1].trim();
  }

  // 7. Pack Size & Unit (e.g. "56 tablets", "10 capsules")
  let packSize = '';
  let unitSize = '';
  const detectedUnit = category === 'Capsule' ? 'capsule' : (category === 'Tablet' ? 'tablet' : 'piece');
  const packMatch = clean.match(/(\d+)\s*(?:tablets?|capsules?|tabs?|caps?|vials?|bottles?|strips?|pieces?|sachets?)/i);
  if (packMatch) {
    packSize = packMatch[1];
    unitSize = `${packSize} ${category.toLowerCase()}s`;
  }

  // 8. Generic / Active Ingredient (e.g. "(Memantine hydrochloride Mz.)" or "(Paracetamol)")
  let genericName = '';
  const genericMatch = clean.match(/(?:[\(\'\"\[])([A-Za-z0-9\s\.\,\+\-]{4,60}?(?:\s*(?:hydrochloride|maleate|potassium|sodium|hcl|bp|usp|ip|mz\.?|hydrate))?)(?:[\)\'\"\]])/i);
  if (genericMatch && genericMatch[1]) {
    const gen = genericMatch[1].replace(/mz\.?$/i, '').trim();
    if (gen.length >= 4 && !/^(tablets?|capsules?|prescription)/i.test(gen)) {
      genericName = gen;
    }
  }

  // 9. Detect Medicine Brand Name
  const noisePatterns = [
    /^pak\.?\s*reg/i,
    /^mfg\.?\s*lic/i,
    /^prescription\s*only/i,
    /^for\s*external\s*use/i,
    /^keep\s*out\s*of/i,
    /^store\s*(?:below|at)/i,
    /^protect\s*from/i,
    /^batch/i,
    /^mfg/i,
    /^exp/i,
    /^mrp/i,
    /^vat/i,
    /^with\s*vat/i,
    /^\d+\s*x\s*\d+/i,
    /^dar\s*no/i,
    /^lic\s*no/i,
    /^(?:manufactured|marketed|mfd|packed|distributed)\s*by/i,
    /^(?:tablets?|capsules?|syrup|suspension|drops?|injection)$/i
  ];

  let candidateName = '';

  // Direct priority brand recognition
  if (/\blifil\b/i.test(clean) || (/\bvitamin\s*a\b/i.test(clean) && (/\b50000\b/i.test(clean) || /\b50k\b/i.test(clean)))) {
    candidateName = 'Lifil-A 50000';
    category = 'Capsule';
  } else if (/\bnapa\b/i.test(clean)) {
    candidateName = /\bextra\b/i.test(clean) ? 'Napa Extra' : (/\brapid\b/i.test(clean) ? 'Napa Rapid' : 'Napa 500mg');
  } else if (/\bace\b/i.test(clean)) {
    candidateName = /\bplus\b/i.test(clean) ? 'Ace Plus' : 'Ace 500mg';
  } else if (/\bseclo\b/i.test(clean)) {
    candidateName = 'Seclo 20mg';
  } else if (/\bfilmet\b/i.test(clean)) {
    candidateName = 'Filmet 400mg';
  } else if (/\bpantonix\b/i.test(clean)) {
    candidateName = 'Pantonix 20mg';
  }

  // Check for Brand + Strength pattern (e.g. "Ebixa 10 mg")
  if (!candidateName) {
    const brandWithStrength = clean.match(/\b([A-Z][a-zA-Z0-9\-\'\s]{2,20}?\s+\d+(?:\.\d+)?\s*(?:mg|gm|g|mcg|ml|iu))\b/i);
    if (brandWithStrength && !noisePatterns.some(p => p.test(brandWithStrength[1].trim()))) {
      candidateName = brandWithStrength[1].trim();
    }
  }

  // If not matched, scan lines with noise filtering
  if (!candidateName) {
    for (const line of lines) {
      const trimmed = line.replace(/[^a-zA-Z0-9\-\s\.]/g, ' ').replace(/\s+/g, ' ').trim();
      if (trimmed.length < 3 || trimmed.length > 35) continue;
      if (noisePatterns.some(p => p.test(trimmed))) continue;
      if (genericName && trimmed.toLowerCase().includes(genericName.toLowerCase())) continue;
      if (foundCompany && trimmed.toLowerCase().includes(foundCompany.toLowerCase())) continue;

      if (/^[a-zA-Z]{3,}/.test(trimmed)) {
        candidateName = trimmed;
        break;
      }
    }
  }

  let finalProductName = candidateName;
  if (finalProductName && strength && !finalProductName.toLowerCase().includes(strength.toLowerCase())) {
    finalProductName = `${finalProductName} ${strength}`;
  }

  return {
    productName: finalProductName || candidateName || (genericName ? `${genericName} ${strength || ''}`.trim() : 'Scanned Medicine Box'),
    rawBrand: candidateName,
    genericName,
    company: foundCompany,
    candidateCompanies: companyInfo.candidateCompanies,
    category,
    packSize,
    unit: detectedUnit,
    unitSize,
    price: price || 35.00,
    costPrice: price ? parseFloat((price * 0.85).toFixed(2)) : 29.75,
    batch,
    expiry,
    strength
  };
}

/**
 * Matches extracted OCR text, Barcode, and Visual Features against store inventory
 * AND Super Admin Supplier Products Catalog.
 * 
 * Strict Brand Matching: Generic words (mg, ml, tablet, capsule, etc.) alone
 * NEVER produce a match. The distinctive brand token MUST be present in OCR text!
 */
export function matchProductComprehensive({
  ocrText = '',
  barcode = '',
  features = null,
  inventoryProducts = [],
  masterCatalogProducts = [],
  customTrained = [],
  mode = 'pos'
}) {
  const candidates = [];
  const normalizedOcr = (ocrText || '').toLowerCase().replace(/[^a-z0-9\s\-]/g, ' ');
  const companyInfo = extractCompanyFromText(ocrText);
  const detectedCompany = companyInfo.primaryCompany;

  // Generic modifiers that NEVER count as distinctive brand names
  const GENERIC_MODIFIERS = new Set([
    'tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps',
    'syrup', 'suspension', 'drops', 'drop', 'mg', 'ml', 'gm', 'g', 'mcg', 'iu',
    'plus', 'extra', 'forte', 'xr', 'sr', 'ds', 'susp', 'oral', 'solution',
    'piece', 'box', 'strip', 'pack', 'for', 'and', 'with', 'the'
  ]);

  // Helper to extract core brand tokens (excluding generic modifiers and pure numbers)
  const extractBrandTokens = (name = '') => {
    return name
      .toLowerCase()
      .split(/[\s\-\_\(\)\/]+/)
      .filter(t => t.length >= 2 && !GENERIC_MODIFIERS.has(t) && !/^\d+$/.test(t) && /[a-z]{2,}/i.test(t));
  };

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
  if (normalizedOcr.trim().length > 0 && inventoryProducts.length > 0) {
    const ocrNoSpace = normalizedOcr.replace(/\s+/g, '');
    // Pre-split OCR into individual word tokens for prefix matching
    const ocrWords = normalizedOcr.split(/\s+/).filter(w => w.length >= 3);

    for (const prod of inventoryProducts) {
      const prodName = (prod.name || '').toLowerCase();
      const prodSku = (prod.sku || '').toLowerCase();
      const prodSupplier = (prod.supplier_name || '').toLowerCase();
      const prodGeneric = (prod.generic_name || '').toLowerCase();

      let score = 0;
      let matchReason = '';

      // Check exact full phrase match
      if (hasWordBoundary(normalizedOcr, prodName)) {
        score = 98;
        matchReason = `Optical Brand Name Match: "${prod.name}"`;
      } else {
        const brandTokens = extractBrandTokens(prod.name);

        if (brandTokens.length > 0) {
          let matchedTokens = 0;       // full word-boundary matches
          let prefixMatchedTokens = 0; // 3-4 letter prefix matches
          let bestPrefixLen = 0;

          for (const token of brandTokens) {
            if (hasWordBoundary(normalizedOcr, token)) {
              // Full exact word match
              matchedTokens++;
            } else if (token.length >= 3) {
              // PREFIX MATCH: check OCR words that start with first 3 or 4 chars of brand token
              const prefix4 = token.length >= 4 ? token.slice(0, 4) : null;
              const prefix3 = token.slice(0, 3);
              const matched4 = prefix4 && ocrWords.some(w => w.startsWith(prefix4));
              const matched3 = !matched4 && ocrWords.some(w => w.startsWith(prefix3));
              if (matched4) {
                prefixMatchedTokens++;
                bestPrefixLen = Math.max(bestPrefixLen, 4);
              } else if (matched3) {
                prefixMatchedTokens++;
                bestPrefixLen = Math.max(bestPrefixLen, 3);
              }
            }
          }

          if (matchedTokens > 0) {
            // Full word match path — high confidence
            score = 78 + Math.round((matchedTokens / brandTokens.length) * 12);
            matchReason = `Optical Brand Match: ${matchedTokens}/${brandTokens.length} brand words`;

            // Boost: dosage strength match (e.g. 10mg, 500mg)
            const strengthMatch = prodName.match(/(\d+(?:\.\d+)?\s*(?:iu|mg|gm|g|mcg|ml))\b/i);
            if (strengthMatch) {
              const cleanStrength = strengthMatch[1].replace(/\s+/g, '').toLowerCase();
              if (ocrNoSpace.includes(cleanStrength)) {
                score = Math.min(98, score + 8);
                matchReason += ` • Strength Confirmed: ${strengthMatch[1]}`;
              }
            }
            // Boost: dosage form / category
            if (prod.category && hasWordBoundary(normalizedOcr, prod.category.toLowerCase())) {
              score = Math.min(99, score + 4);
            }

          } else if (prefixMatchedTokens > 0) {
            // PREFIX FALLBACK: first 3-4 letters match — lower confidence than full word
            const prefixRatio = prefixMatchedTokens / brandTokens.length;
            const prefixBase = bestPrefixLen >= 4 ? 70 : 65;
            score = prefixBase + Math.round(prefixRatio * 8);
            matchReason = `Prefix Match (first ${bestPrefixLen} letters, ${prefixMatchedTokens}/${brandTokens.length} tokens): "${prod.name}"`;

            // Boost: dosage strength
            const strengthMatch = prodName.match(/(\d+(?:\.\d+)?\s*(?:iu|mg|gm|g|mcg|ml))\b/i);
            if (strengthMatch) {
              const cleanStrength = strengthMatch[1].replace(/\s+/g, '').toLowerCase();
              if (ocrNoSpace.includes(cleanStrength)) {
                score = Math.min(90, score + 8);
                matchReason += ` • Strength Confirmed: ${strengthMatch[1]}`;
              }
            }
            // Boost: category
            if (prod.category && hasWordBoundary(normalizedOcr, prod.category.toLowerCase())) {
              score = Math.min(90, score + 5);
              matchReason += ` • Category Confirmed: ${prod.category}`;
            }
          } else {
            // SUBSTRING FRAGMENT FALLBACK: any OCR word (≥3 chars) appears anywhere inside a brand token
            // Handles garbled/partial OCR like "iod" matching "viodin", "vid" matching "Viodin"
            let substringMatchedTokens = 0;
            for (const token of brandTokens) {
              if (ocrWords.some(w => w.length >= 3 && token.includes(w))) {
                substringMatchedTokens++;
              }
            }
            if (substringMatchedTokens > 0) {
              const subRatio = substringMatchedTokens / brandTokens.length;
              score = 62 + Math.round(subRatio * 6);
              matchReason = `Fragment Match (${substringMatchedTokens}/${brandTokens.length} tokens): "${prod.name}"`;

              // Boosts to reach ≥65 threshold
              const strengthMatch = prodName.match(/(\d+(?:\.\d+)?\s*(?:iu|mg|gm|g|mcg|ml))\b/i);
              if (strengthMatch) {
                const cleanStrength = strengthMatch[1].replace(/\s+/g, '').toLowerCase();
                if (ocrNoSpace.includes(cleanStrength)) {
                  score = Math.min(85, score + 8);
                  matchReason += ` • Strength Confirmed: ${strengthMatch[1]}`;
                }
              }
              if (prod.category && hasWordBoundary(normalizedOcr, prod.category.toLowerCase())) {
                score = Math.min(85, score + 5);
                matchReason += ` • Category Confirmed: ${prod.category}`;
              }
            }
          }

        } else if (prodSku && hasWordBoundary(normalizedOcr, prodSku)) {
          score = 95;
          matchReason = `SKU code match: ${prod.sku}`;
        }
      }

      // Check generic name if present
      if (prodGeneric && hasWordBoundary(normalizedOcr, prodGeneric)) {
        if (score > 0) {
          score = Math.min(99, score + 6);
          matchReason += ` • Generic Formula Confirmed: ${prod.generic_name}`;
        } else {
          score = 82;
          matchReason = `Generic Chemical Match: "${prod.generic_name}"`;
        }
      }

      // Manufacturer consistency validation
      if (score >= 60 && prodSupplier) {
        if (detectedCompany) {
          const isSame = prodSupplier.includes(detectedCompany.toLowerCase()) ||
            detectedCompany.toLowerCase().includes(prodSupplier);
          if (isSame) {
            score = Math.min(100, score + 10);
            matchReason += ` • Company Confirmed: ${prod.supplier_name}`;
          } else {
            score = Math.max(0, score - 35);
          }
        }
      }

      // Accept: full matches ≥70, prefix matches ≥65, fragment/substring matches ≥62
      if (score >= 62) {
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

  // 3. OPTICAL CHARACTER RECOGNITION MATCHING AGAINST SUPER ADMIN CATALOG (PO Mode only)
  // In POS Checkout mode, we NEVER match external catalog items that do not exist in store inventory!
  if (mode !== 'pos' && (normalizedOcr.trim().length > 0 || barcode) && masterCatalogProducts.length > 0) {
    for (const masterItem of masterCatalogProducts) {
      const mName = (masterItem.product_name || '').toLowerCase().trim();
      const mSupplier = (masterItem.supplier_name || '').toLowerCase().trim();
      const mSku = String(masterItem.sku || masterItem.barcode || '').trim().toLowerCase();
      if (!mName) continue;

      let score = 0;
      let matchReason = '';

      if (barcode && mSku && mSku === barcode.trim().toLowerCase()) {
        score = 100;
        matchReason = `Catalog Barcode Match: ${masterItem.sku || masterItem.barcode}`;
      } else if (hasWordBoundary(normalizedOcr, mName)) {
        score = 98;
        matchReason = `Catalog Match: "${masterItem.product_name}" (${masterItem.supplier_name || 'Verified Supplier'})`;
      } else {
        const brandTokens = extractBrandTokens(mName);
        if (brandTokens.length > 0) {
          let matchedTokens = 0;
          for (const token of brandTokens) {
            if (hasWordBoundary(normalizedOcr, token)) {
              matchedTokens++;
            }
          }

          if (matchedTokens > 0) {
            score = 78 + Math.round((matchedTokens / brandTokens.length) * 12);
            matchReason = `Catalog Brand Match: "${masterItem.product_name}"`;

            const strengthMatch = mName.match(/(\d+(?:\.\d+)?\s*(?:iu|mg|gm|g|mcg|ml))\b/i);
            if (strengthMatch) {
              const cleanStrength = strengthMatch[1].replace(/\s+/g, '').toLowerCase();
              const ocrNoSpace = normalizedOcr.replace(/\s+/g, '');
              if (ocrNoSpace.includes(cleanStrength)) {
                score = Math.min(98, score + 8);
                matchReason += ` • Strength Confirmed: ${strengthMatch[1]}`;
              }
            }
          }
        }
      }

      if (score >= 60 && mSupplier) {
        if (detectedCompany) {
          const isSame = mSupplier.includes(detectedCompany.toLowerCase()) ||
            detectedCompany.toLowerCase().includes(mSupplier);
          if (isSame) {
            score = Math.min(100, score + 10);
            matchReason += ` • Company Confirmed: ${masterItem.supplier_name}`;
          } else {
            score = Math.max(0, score - 35);
          }
        }
      }

      if (score >= 70) {
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
          barcode: masterItem.barcode || masterItem.sku || '',
          stock_quantity: existingLocal ? existingLocal.stock_quantity : 0,
          unit: (existingLocal && existingLocal.unit) || masterItem.unit || 'piece',
          unit_size: (existingLocal && existingLocal.unit_size) || masterItem.unit_size || '',
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

  // 4. SMART MEDICINE PACKAGING PARSER (Dynamic Box Detection - PO Mode only)
  // In POS Checkout mode, we NEVER generate or suggest un-added medicine boxes (is_new / id: null)!
  if (mode !== 'pos') {
    const hasConfidentMatch = candidates.some(c => c.confidence >= 80);
    if (!hasConfidentMatch && ocrText.trim().length > 0) {
      const boxInfo = parseMedicinePackaging(ocrText);
      if (boxInfo && boxInfo.productName) {
        const detectedSupplier = boxInfo.company || detectedCompany || 'Verified Supplier';

        const boxProduct = {
          id: null,
          name: boxInfo.productName,
          generic_name: boxInfo.genericName || '',
          supplier_name: detectedSupplier,
          candidate_suppliers: boxInfo.candidateCompanies || [],
          category: boxInfo.category || 'Medicine',
          price: boxInfo.price || 35.00,
          cost_price: boxInfo.costPrice || 29.75,
          sku: boxInfo.batch || '',
          expiry_date: boxInfo.expiry || '',
          stock_quantity: 0,
          unit: boxInfo.unit || 'piece',
          unit_size: boxInfo.unitSize || '',
          is_new: true,
          is_master_catalog: false
        };

        candidates.unshift({
          product: boxProduct,
          confidence: boxInfo.company ? 93 : 86,
          matchType: 'box_scan',
          reason: `Medicine Packaging Detected: "${boxInfo.productName}" • Company: ${detectedSupplier}${boxInfo.genericName ? ` (${boxInfo.genericName})` : ''}`,
          colorName: detectedSupplier,
          icon: boxInfo.category === 'Capsule' ? '💊' : '📦'
        });

        // If multiple companies were detected on the packaging (e.g. Rottendorf Pharma as manufacturer & Lundbeck as marketer)
        if (boxInfo.candidateCompanies && boxInfo.candidateCompanies.length > 1) {
          for (let i = 1; i < boxInfo.candidateCompanies.length; i++) {
            const altCompany = boxInfo.candidateCompanies[i];
            candidates.push({
              product: { ...boxProduct, supplier_name: altCompany },
              confidence: 88,
              matchType: 'box_scan_alt',
              reason: `Alternate Manufacturer/Marketer: "${altCompany}"`,
              colorName: altCompany,
              icon: '🏢'
            });
          }
        }
      }
    }
  }

  // 4b. USER-TRAINED VISUAL TEMPLATES
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
        const matchedInvProduct = inventoryProducts.find(p => p.id === template.productId);

        // In POS mode, strictly require the trained model to match a real inventory item
        if (matchedInvProduct || mode !== 'pos') {
          const finalProduct = matchedInvProduct || {
            id: template.productId,
            name: template.productName,
            price: template.price || 0,
            stock_quantity: template.stock || 999,
            sku: template.sku || 'TRAINED'
          };

          if (!candidates.some(c => c.product.id === finalProduct.id)) {
            candidates.push({
              product: finalProduct,
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

  // STRICT GUARANTEE FOR POS CHECKOUT:
  // Only products that genuinely exist in the store's inventory catalog can be returned!
  if (mode === 'pos') {
    const validInventoryIds = new Set(inventoryProducts.map(p => p.id));
    candidates = candidates.filter(c => c.product && c.product.id && validInventoryIds.has(c.product.id));
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 5);
}
