"""
=============================================================================
POS Vision Engine: Optimized "OCR-to-Cart" Pipeline
=============================================================================
Author: Senior Computer Vision & Python Developer
Frameworks: OpenCV (cv2), Tesseract / EasyOCR, RapidFuzz (with pure Python fallback)

Architecture:
  1. Image Preprocessing (CLAHE, Gaussian Blur, Otsu Binarization)
  2. Text Detection & Extraction (PyTesseract / EasyOCR with spatial grouping)
  3. High-Performance Fuzzy Catalog Matching (RapidFuzz / built-in Levenshtein)
  4. Temporal Smoothing & Cooldown Debouncer (Prevents multi-adds)
  5. JSON Event Emitter for POS Cart API Integration
=============================================================================
"""

import time
import json
import re
from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass, asdict

# -----------------------------------------------------------------------------
# Safe Imports with Fallbacks (Resolves all IDE Missing Import & Unbound Errors)
# -----------------------------------------------------------------------------

# OpenCV & NumPy
try:
    import cv2  # type: ignore
except ImportError:
    cv2 = None

try:
    import numpy as np  # type: ignore
except ImportError:
    np = None

# Fuzzy Matching Engine (RapidFuzz -> FuzzyWuzzy -> Pure Python Levenshtein)
HAS_RAPIDFUZZ = False
HAS_FUZZYWUZZY = False

try:
    from rapidfuzz import fuzz  # type: ignore
    HAS_RAPIDFUZZ = True
except ImportError:
    try:
        from fuzzywuzzy import fuzz  # type: ignore
        HAS_FUZZYWUZZY = True
    except ImportError:
        fuzz = None

# OCR Engines (PyTesseract & EasyOCR)
try:
    import pytesseract  # type: ignore
    from pytesseract import Output  # type: ignore
    HAS_PYTESSERACT = True
except ImportError:
    pytesseract = None
    Output = None
    HAS_PYTESSERACT = False

try:
    import easyocr  # type: ignore
    HAS_EASYOCR = True
except ImportError:
    easyocr = None
    HAS_EASYOCR = False


# =============================================================================
# BUILT-IN PURE-PYTHON FUZZY MATCHING (Zero Dependency Fallback)
# =============================================================================

def _levenshtein_distance(s1: str, s2: str) -> int:
    """Computes Levenshtein edit distance in pure Python."""
    if len(s1) < len(s2):
        return _levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def _pure_token_set_ratio(s1: str, s2: str) -> float:
    """
    Pure Python implementation of Token Set Ratio.
    Handles out-of-order words, extra packaging words, and typos.
    """
    tokens1: Set[str] = set(s1.lower().split())
    tokens2: Set[str] = set(s2.lower().split())

    if not tokens1 or not tokens2:
        return 0.0

    intersection = tokens1.intersection(tokens2)
    diff1 = tokens1.difference(tokens2)
    diff2 = tokens2.difference(tokens1)

    sorted_inter = " ".join(sorted(intersection))
    sorted_inter_diff1 = " ".join(sorted(intersection.union(diff1)))
    sorted_inter_diff2 = " ".join(sorted(intersection.union(diff2)))

    def string_similarity(a: str, b: str) -> float:
        if not a and not b:
            return 100.0
        max_len = max(len(a), len(b))
        if max_len == 0:
            return 100.0
        dist = _levenshtein_distance(a, b)
        return max(0.0, (1.0 - (dist / max_len)) * 100.0)

    scores = [
        string_similarity(sorted_inter, sorted_inter_diff1),
        string_similarity(sorted_inter, sorted_inter_diff2),
        string_similarity(sorted_inter_diff1, sorted_inter_diff2)
    ]
    return max(scores)


def calculate_token_set_similarity(s1: str, s2: str) -> float:
    """Dispatches to RapidFuzz / FuzzyWuzzy if available, else uses built-in engine."""
    if fuzz is not None and hasattr(fuzz, 'token_set_ratio'):
        return float(fuzz.token_set_ratio(s1, s2))
    return _pure_token_set_ratio(s1, s2)


# =============================================================================
# 1. DATA MODELS & SAMPLE CATALOG
# =============================================================================

@dataclass
class Product:
    id: int
    name: str
    sku: str
    price: float
    category: str = "General"
    barcode: Optional[str] = None


@dataclass
class MatchResult:
    product: Product
    score: float
    raw_ocr_snippet: str
    consecutive_frames: int


# Default sample inventory catalog for POS testing
INVENTORY_CATALOG: List[Dict[str, Any]] = [
    {"id": 101, "sku": "RAD-TURM-100", "name": "Radhuni Turmeric Powder 100g", "price": 60.00, "category": "Spices"},
    {"id": 102, "sku": "RAD-CHIL-100", "name": "Radhuni Chilli Powder 100g", "price": 75.00, "category": "Spices"},
    {"id": 103, "sku": "RAD-CORI-100", "name": "Radhuni Coriander Powder 100g", "price": 55.00, "category": "Spices"},
    {"id": 104, "sku": "NES-COFF-50G", "name": "Nescafe Classic Coffee Jar 50g", "price": 320.00, "category": "Beverages"},
    {"id": 105, "sku": "NES-COFF-100G","name": "Nescafe Classic Coffee Jar 100g", "price": 580.00, "category": "Beverages"},
    {"id": 106, "sku": "DETT-SOAP-75", "name": "Dettol Original Soap 75g", "price": 45.00, "category": "Personal Care"},
    {"id": 107, "sku": "COLG-PAST-150","name": "Colgate Total Toothpaste 150g", "price": 180.00, "category": "Personal Care"},
    {"id": 108, "sku": "PRIL-DISH-500","name": "Pril Liquid Dishwash 500ml", "price": 140.00, "category": "Household"},
    {"id": 109, "sku": "NAPA-EXTR-500","name": "Napa Extra Paracetamol 500mg", "price": 25.00, "category": "Pharmacy"},
    {"id": 110, "sku": "LAYS-CHIP-CLASS","name": "Lay's Classic Salted Potato Chips 50g", "price": 30.00, "category": "Snacks"}
]


# =============================================================================
# 2. IMAGE PREPROCESSING PIPELINE (OPENCV)
# =============================================================================

class ImagePreprocessor:
    """
    Optimized preprocessor for product packaging surfaces.
    Cleans specular reflections, glare, and low contrast.
    """

    @staticmethod
    def preprocess_image(
        frame: Any, 
        roi_bbox: Optional[Tuple[int, int, int, int]] = None,
        target_min_dim: int = 800
    ) -> Tuple[Any, Any]:
        """
        Processes webcam image for optimal OCR character definition.
        """
        if cv2 is None or np is None or frame is None:
            return frame, frame

        # 1. Crop to ROI if specified
        if roi_bbox is not None:
            x, y, w, h = roi_bbox
            cropped = frame[y:y+h, x:x+w]
        else:
            cropped = frame

        # 2. Upscale image if below target resolution (needed for fine fonts)
        h, w = cropped.shape[:2]
        if min(h, w) < target_min_dim and min(h, w) > 0:
            scale = target_min_dim / float(min(h, w))
            cropped = cv2.resize(cropped, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

        # 3. Grayscale conversion using BT.601 perceptual weights
        gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)

        # 4. Contrast Limited Adaptive Histogram Equalization (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced_gray = clahe.apply(gray)

        # 5. Gaussian Blur to suppress surface texture noise
        blurred = cv2.GaussianBlur(enhanced_gray, (3, 3), 0)

        # 6. Otsu thresholding
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Invert if text is white on dark background (OCR prefers black text on white)
        white_pixel_ratio = np.sum(thresh == 255) / float(thresh.size)
        if white_pixel_ratio < 0.5:
            thresh = cv2.bitwise_not(thresh)

        # 7. Morphological Opening to clean fine dots/noise
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        binarized = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

        return binarized, enhanced_gray


# =============================================================================
# 3. OCR TEXT EXTRACTION & SPATIAL LINE GROUPING
# =============================================================================

class OCRExtractor:
    """
    Modular OCR extractor with spatial line grouping for brand & package titles.
    """

    def __init__(self, engine: str = "pytesseract", min_conf: float = 35.0):
        self.engine = engine.lower()
        self.min_conf = min_conf
        self.easyocr_reader = None

        if self.engine == "easyocr" and HAS_EASYOCR and easyocr is not None:
            self.easyocr_reader = easyocr.Reader(["en"], gpu=False)

    def extract_text_and_lines(self, preprocessed_img: Any) -> List[str]:
        """
        Extracts words and groups them into coherent phrases/lines.
        """
        if preprocessed_img is None:
            return []

        if self.engine == "easyocr" and self.easyocr_reader is not None:
            return self._extract_easyocr(preprocessed_img)
        elif HAS_PYTESSERACT and pytesseract is not None and Output is not None:
            return self._extract_pytesseract(preprocessed_img)
        return []

    def _extract_pytesseract(self, img: Any) -> List[str]:
        if pytesseract is None or Output is None:
            return []

        custom_config = r'--oem 3 --psm 11'
        try:
            data = pytesseract.image_to_data(img, config=custom_config, output_type=Output.DICT)
        except Exception:
            return []

        lines_dict: Dict[Tuple[int, int], List[str]] = {}
        all_words: List[str] = []

        n_boxes = len(data.get('text', []))
        for i in range(n_boxes):
            text = str(data['text'][i]).strip()
            conf = float(data['conf'][i])

            if conf >= self.min_conf and len(text) > 1:
                clean_text = re.sub(r'[^a-zA-Z0-9\.\-\%]', '', text)
                if len(clean_text) < 2:
                    continue

                all_words.append(clean_text)
                key = (data['block_num'][i], data['line_num'][i])
                if key not in lines_dict:
                    lines_dict[key] = []
                lines_dict[key].append(clean_text)

        candidates: List[str] = []

        # 1. Full assembled lines
        for words in lines_dict.values():
            phrase = " ".join(words).strip()
            if len(phrase) >= 3:
                candidates.append(phrase)

        # 2. Adjacent 2-line pairs
        line_phrases = list(candidates)
        for i in range(len(line_phrases) - 1):
            candidates.append(f"{line_phrases[i]} {line_phrases[i+1]}")

        # 3. Full scene pool
        if all_words:
            candidates.append(" ".join(all_words))

        return list(set(candidates))

    def _extract_easyocr(self, img: Any) -> List[str]:
        if self.easyocr_reader is None:
            return []

        try:
            results = self.easyocr_reader.readtext(img)
        except Exception:
            return []

        lines: List[str] = []
        all_tokens: List[str] = []

        for _, text, conf in results:
            if conf >= (self.min_conf / 100.0):
                cleaned = str(text).strip()
                if len(cleaned) >= 2:
                    lines.append(cleaned)
                    all_tokens.extend(cleaned.split())

        candidates = list(lines)
        if all_tokens:
            candidates.append(" ".join(all_tokens))
        return candidates


# =============================================================================
# 4. CATALOG MATCHING ENGINE (FUZZY / LEVENSHTEIN)
# =============================================================================

class CatalogMatcher:
    """
    High-speed fuzzy catalog matcher with pack-size / weight validation.
    """

    def __init__(self, catalog: List[Dict[str, Any]], match_threshold: float = 85.0):
        self.catalog = [Product(**item) for item in catalog]
        self.match_threshold = match_threshold
        self.prepared_catalog = [
            (prod, self._normalize_text(prod.name)) for prod in self.catalog
        ]
        self.size_regex = re.compile(r'(\d+)\s*(g|gm|kg|ml|l|mg|pcs)', re.IGNORECASE)

    @staticmethod
    def _normalize_text(text: str) -> str:
        return re.sub(r'[^a-z0-9\s]', ' ', text.lower()).strip()

    def match_product_with_catalog(self, detected_text_list: List[str]) -> Optional[Tuple[Product, float, str]]:
        if not detected_text_list:
            return None

        best_product: Optional[Product] = None
        highest_score: float = 0.0
        best_ocr_candidate: str = ""

        for candidate in detected_text_list:
            norm_candidate = self._normalize_text(candidate)
            if len(norm_candidate) < 3:
                continue

            candidate_sizes = set(self.size_regex.findall(norm_candidate))

            for product, norm_prod_name in self.prepared_catalog:
                # Token-set fuzzy similarity
                score = calculate_token_set_similarity(norm_candidate, norm_prod_name)

                # Pack size / weight validation check (e.g. 100g vs 50g)
                prod_sizes = set(self.size_regex.findall(norm_prod_name))
                if candidate_sizes and prod_sizes:
                    if candidate_sizes == prod_sizes:
                        score = min(100.0, score + 4.0)
                    else:
                        score -= 20.0  # Size mismatch penalty

                if score > highest_score:
                    highest_score = score
                    best_product = product
                    best_ocr_candidate = candidate

        if highest_score >= self.match_threshold and best_product is not None:
            return best_product, round(highest_score, 2), best_ocr_candidate

        return None


# =============================================================================
# 5. DEBOUNCE & TEMPORAL FRAME BUFFER
# =============================================================================

class DebounceManager:
    """
    Suppresses single-frame noise and prevents duplicate cart items.
    """

    def __init__(self, required_consecutive_frames: int = 3, cooldown_seconds: float = 2.5):
        self.required_consecutive_frames = required_consecutive_frames
        self.cooldown_seconds = cooldown_seconds

        self.candidate_product_id: Optional[int] = None
        self.consecutive_count: int = 0
        self.last_added_timestamps: Dict[int, float] = {}

    def process_match(self, match: Optional[Tuple[Product, float, str]]) -> Optional[MatchResult]:
        current_time = time.time()

        if match is None:
            self.consecutive_count = max(0, self.consecutive_count - 1)
            if self.consecutive_count == 0:
                self.candidate_product_id = None
            return None

        product, score, raw_snippet = match

        # 1. Cooldown suppression check
        last_added = self.last_added_timestamps.get(product.id, 0.0)
        if (current_time - last_added) < self.cooldown_seconds:
            return None

        # 2. Consecutive frame counting
        if product.id == self.candidate_product_id:
            self.consecutive_count += 1
        else:
            self.candidate_product_id = product.id
            self.consecutive_count = 1

        # 3. Threshold achieved
        if self.consecutive_count >= self.required_consecutive_frames:
            self.last_added_timestamps[product.id] = current_time
            self.consecutive_count = 0
            self.candidate_product_id = None

            return MatchResult(
                product=product,
                score=score,
                raw_ocr_snippet=raw_snippet,
                consecutive_frames=self.required_consecutive_frames
            )

        return None


# =============================================================================
# 6. POS CART EVENT EMITTER
# =============================================================================

class CartEventEmitter:
    @staticmethod
    def emit_cart_addition(result: MatchResult) -> str:
        payload = {
            "event": "POS_CART_ITEM_SCANNED",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "OPENCV_OCR_VISION_ENGINE",
            "matched_product": asdict(result.product),
            "verification": {
                "similarity_score": result.score,
                "consecutive_frames_verified": result.consecutive_frames,
                "detected_ocr_text": result.raw_ocr_snippet
            }
        }
        json_output = json.dumps(payload, indent=2)
        print("\n" + "="*70)
        print(">>> [CART EVENT EMITTED] SENDING TO POS CART API <<<")
        print(json_output)
        print("="*70 + "\n")
        return json_output


# =============================================================================
# 7. MAIN PIPELINE ORCHESTRATION
# =============================================================================

class OCRToCartPipeline:
    def __init__(
        self,
        catalog: List[Dict[str, Any]] = INVENTORY_CATALOG,
        ocr_engine: str = "pytesseract",
        min_match_score: float = 85.0,
        consecutive_frames: int = 3,
        cooldown_sec: float = 2.5
    ):
        self.preprocessor = ImagePreprocessor()
        self.ocr = OCRExtractor(engine=ocr_engine)
        self.matcher = CatalogMatcher(catalog=catalog, match_threshold=min_match_score)
        self.debouncer = DebounceManager(
            required_consecutive_frames=consecutive_frames, 
            cooldown_seconds=cooldown_sec
        )
        self.emitter = CartEventEmitter()

    def run_webcam_stream(self, camera_index: int = 0):
        if cv2 is None:
            print("[ERROR] OpenCV (cv2) is not installed. Run: pip install opencv-python")
            return

        cap = cv2.VideoCapture(camera_index)
        if not cap.isOpened():
            print(f"[ERROR] Could not open camera at index {camera_index}")
            return

        print("\n[VISION ENGINE] Camera feed opened. Align packaging inside box. Press 'q' to quit.\n")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            h, w = frame.shape[:2]
            roi_w, roi_h = int(w * 0.65), int(h * 0.65)
            roi_x, roi_y = int((w - roi_w) / 2), int((h - roi_h) / 2)
            roi_bbox = (roi_x, roi_y, roi_w, roi_h)

            # 1. Preprocess
            binarized, _ = self.preprocessor.preprocess_image(frame, roi_bbox=roi_bbox)

            # 2. OCR text extraction
            detected_candidates = self.ocr.extract_text_and_lines(binarized)

            # 3. Fuzzy catalog match
            match = self.matcher.match_product_with_catalog(detected_candidates)

            # 4. Debounce check
            cart_event = self.debouncer.process_match(match)

            # 5. Emit JSON to Cart
            if cart_event:
                self.emitter.emit_cart_addition(cart_event)

            # HUD Display
            box_color = (0, 255, 0) if match else (200, 200, 200)
            cv2.rectangle(frame, (roi_x, roi_y), (roi_x + roi_w, roi_y + roi_h), box_color, 2)
            cv2.putText(frame, "Scan Product Area", (roi_x + 10, roi_y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, box_color, 1)

            if match:
                prod, score, _ = match
                cv2.putText(frame, f"{prod.name} ({score:.0f}%)", (roi_x, roi_y + roi_h + 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)
                cv2.putText(frame, f"Tracking: {self.debouncer.consecutive_count}/{self.debouncer.required_consecutive_frames}",
                            (roi_x, roi_y + roi_h + 55), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 1)

            cv2.imshow("POS Vision Scanner (OCR-to-Cart)", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cap.release()
        cv2.destroyAllWindows()


# =============================================================================
# 8. VERIFICATION SIMULATION (OFFLINE TEST)
# =============================================================================

def simulate_offline_ocr_test():
    print("="*70)
    print("RUNNING OFFLINE OCR-TO-CART TEST SIMULATION")
    print("="*70)

    pipeline = OCRToCartPipeline(
        catalog=INVENTORY_CATALOG,
        min_match_score=85.0,
        consecutive_frames=3,
        cooldown_sec=2.0
    )

    simulated_frames = [
        ["RADHUN1", "TURMERIC POWD", "NET WT 100g"],
        ["RADHUNI TURMERIC POWDER 100g", "HALAL"],
        ["RADHUNI TURMERIC POWDER 100g"],              # 3rd frame -> triggers add!
        ["RADHUNI TURMERIC POWDER 100g"],              # Suppressed by cooldown
        ["NESCAFE", "CLASSIC COFFEE 50G JAR"],
        ["NESCAFE CLASSIC 50g"],
        ["NESCAFE CLASSIC COFFEE JAR 50g"]             # 3rd frame -> triggers add!
    ]

    for frame_idx, ocr_tokens in enumerate(simulated_frames, 1):
        print(f"\n--- [Frame {frame_idx}] Tokens: {ocr_tokens} ---")
        match = pipeline.matcher.match_product_with_catalog(ocr_tokens)
        if match:
            prod, score, snippet = match
            print(f"  -> Match Candidate: '{prod.name}' (Score: {score}%) via '{snippet}'")
        else:
            print("  -> No match.")

        event = pipeline.debouncer.process_match(match)
        if event:
            pipeline.emitter.emit_cart_addition(event)
        else:
            print(f"  -> Debouncer Count: [{pipeline.debouncer.consecutive_count}/{pipeline.debouncer.required_consecutive_frames}]")


if __name__ == "__main__":
    import sys
    if "--test" in sys.argv or "--simulate" in sys.argv:
        simulate_offline_ocr_test()
    else:
        simulate_offline_ocr_test()
