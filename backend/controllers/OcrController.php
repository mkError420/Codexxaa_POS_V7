<?php
/**
 * Server-side OCR endpoint for camera ROI images.
 *
 * Pre-processing pipeline (applied before calling Tesseract):
 *   Step 1 – Grayscale conversion using ITU-R BT.601 luminance weights
 *   Step 2 – Histogram equalization (CLAHE-style adaptive contrast boost)
 *   Step 3 – Adaptive binarization using Otsu's method (globally optimal threshold)
 *   Step 4 – Upscale: images narrower than 960 px are scaled up so Tesseract
 *             receives enough pixels to resolve fine medicine-label text
 *
 * Auto-rotation loop:
 *   Tesseract is called at 0°. If it returns empty/garbage text the pre-processed
 *   image is rotated by 90°, 180°, and 270° consecutively until valid text is found.
 */

require_once __DIR__ . '/../middleware/auth.php';

class OcrController {

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static function jsonResponse($payload, $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /**
     * Decode a Base64 / data-URI image string into a GD resource.
     * Returns false on failure.
     */
    private static function decodeImage($imageData) {
        if (!is_string($imageData) || $imageData === '') {
            return false;
        }

        // Strip optional data-URI header (e.g. "data:image/jpeg;base64,")
        if (preg_match('/^data:image\/[a-zA-Z0-9.+\-]+;base64,(.*)$/s', $imageData, $matches)) {
            $imageData = $matches[1];
        }

        $binary = base64_decode($imageData, true);
        if ($binary === false || strlen($binary) > 10 * 1024 * 1024) {
            return false;
        }

        $image = @imagecreatefromstring($binary);
        return $image ?: false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1 – Grayscale (BT.601 perceptual luminance)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Convert a true-colour GD image to grayscale using ITU-R BT.601 weights.
     * Returns a new GD image (caller must imagedestroy the original if needed).
     */
    private static function toGrayscale($src) {
        $w = imagesx($src);
        $h = imagesy($src);
        $gray = imagecreatetruecolor($w, $h);

        // White background handles transparent PNGs cleanly
        $white = imagecolorallocate($gray, 255, 255, 255);
        imagefill($gray, 0, 0, $white);
        imagecopy($gray, $src, 0, 0, 0, 0, $w, $h);

        // GD's built-in grayscale filter (fast C-level op)
        imagefilter($gray, IMG_FILTER_GRAYSCALE);

        // Re-write with precise BT.601 luminance for accurate Otsu thresholding
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $rgb = imagecolorat($gray, $x, $y);
                $r   = ($rgb >> 16) & 0xFF;
                $g   = ($rgb >>  8) & 0xFF;
                $b   =  $rgb        & 0xFF;
                $lum = (int)round(0.299 * $r + 0.587 * $g + 0.114 * $b);
                $packed = ($lum << 16) | ($lum << 8) | $lum;
                imagesetpixel($gray, $x, $y, $packed);
            }
        }

        return $gray;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2 – Histogram equalization (contrast enhancement)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Equalize the histogram of a grayscale GD image in-place.
     * Maximises contrast on low-contrast camera frames so dark text on
     * slightly-grey backgrounds becomes crisp black-on-white.
     */
    private static function equalizeHistogram($img) {
        $w = imagesx($img);
        $h = imagesy($img);

        // Build frequency histogram
        $hist = array_fill(0, 256, 0);
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $lum = (imagecolorat($img, $x, $y) >> 16) & 0xFF;
                $hist[$lum]++;
            }
        }

        // Compute CDF
        $cdf    = array_fill(0, 256, 0);
        $cdf[0] = $hist[0];
        for ($i = 1; $i < 256; $i++) {
            $cdf[$i] = $cdf[$i - 1] + $hist[$i];
        }

        // Minimum non-zero CDF value
        $cdfMin = 0;
        for ($i = 0; $i < 256; $i++) {
            if ($cdf[$i] > 0) { $cdfMin = $cdf[$i]; break; }
        }

        $totalPixels = $w * $h;
        $scale       = $totalPixels - $cdfMin;

        // Build look-up table
        $lut = array_fill(0, 256, 0);
        for ($i = 0; $i < 256; $i++) {
            $lut[$i] = $scale > 0
                ? max(0, min(255, (int)round((($cdf[$i] - $cdfMin) / $scale) * 255)))
                : $i;
        }

        // Apply LUT
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $old = (imagecolorat($img, $x, $y) >> 16) & 0xFF;
                $new = $lut[$old];
                imagesetpixel($img, $x, $y, ($new << 16) | ($new << 8) | $new);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3 – Otsu's binarization (optimal adaptive threshold)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Compute the optimal binarization threshold using Otsu's method.
     * Minimizes intra-class variance between foreground and background.
     */
    private static function otsuThreshold($img) {
        $w = imagesx($img);
        $h = imagesy($img);

        $hist = array_fill(0, 256, 0);
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $hist[(imagecolorat($img, $x, $y) >> 16) & 0xFF]++;
            }
        }

        $total  = $w * $h;
        $sumAll = 0;
        for ($i = 0; $i < 256; $i++) { $sumAll += $i * $hist[$i]; }

        $sumB = 0; $wB = 0; $maxVar = 0.0; $threshold = 128;

        for ($t = 0; $t < 256; $t++) {
            $wB += $hist[$t];
            if ($wB === 0) continue;
            $wF = $total - $wB;
            if ($wF === 0) break;

            $sumB   += $t * $hist[$t];
            $meanB   = $sumB / $wB;
            $meanF   = ($sumAll - $sumB) / $wF;
            $between = (float)$wB * (float)$wF * ($meanB - $meanF) ** 2;

            if ($between > $maxVar) {
                $maxVar    = $between;
                $threshold = $t;
            }
        }

        return max(80, min(200, $threshold)); // clamp to avoid degenerate images
    }

    /**
     * Apply Otsu binarization to a grayscale GD image in-place.
     */
    private static function binarize($img) {
        $threshold = self::otsuThreshold($img);
        $w = imagesx($img);
        $h = imagesy($img);

        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $lum = (imagecolorat($img, $x, $y) >> 16) & 0xFF;
                // Light gamma correction to darken mid-tones before thresholding
                $adjusted = (int)round(pow($lum / 255.0, 1.0 / 1.08) * 255.0);
                $out      = $adjusted < $threshold ? 0 : 255;
                imagesetpixel($img, $x, $y, ($out << 16) | ($out << 8) | $out);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4 – Upscale if needed
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Scale the image up using nearest-neighbour resampling if it is narrower
     * than $minWidth pixels. Nearest-neighbour preserves hard binary edges.
     */
    private static function upscaleIfNeeded($img, $minWidth = 960) {
        $w = imagesx($img);
        $h = imagesy($img);
        if ($w >= $minWidth) return $img;

        $scale   = $minWidth / $w;
        $newW    = (int)round($w * $scale);
        $newH    = (int)round($h * $scale);
        $resized = imagecreatetruecolor($newW, $newH);
        $white   = imagecolorallocate($resized, 255, 255, 255);
        imagefill($resized, 0, 0, $white);
        imagecopyresized($resized, $img, 0, 0, 0, 0, $newW, $newH, $w, $h);
        imagedestroy($img);
        return $resized;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Full preprocessing pipeline
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Apply the full preprocessing pipeline:
     *  1. Grayscale (BT.601)
     *  2. Histogram equalization (contrast boost)
     *  3. Otsu binarization (black & white)
     *  4. Upscale to >= 960 px wide
     */
    private static function preprocessImage($source) {
        $gray = self::toGrayscale($source);
        self::equalizeHistogram($gray);
        self::binarize($gray);
        $gray = self::upscaleIfNeeded($gray, 960);
        return $gray;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tesseract invocation (dual-PSM fallback)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Save $gdImage as a temporary PNG, call Tesseract, return raw text.
     * Uses PSM 6 (uniform block) first; falls back to PSM 11 (sparse text).
     */
    private static function extractText($gdImage, $workingDirectory) {
        $tmpFile = $workingDirectory . DIRECTORY_SEPARATOR
            . 'ocr-' . bin2hex(random_bytes(8)) . '.png';
        imagepng($gdImage, $tmpFile, 1);

        $binary      = getenv('TESSERACT_BIN') ?: 'tesseract';
        $isWindows   = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $errorTarget = $isWindows ? 'NUL' : '/dev/null';

        // PSM 7 – single text line (best for product labels like "Viodin 10%")
        $cmd  = escapeshellarg($binary)
            . ' ' . escapeshellarg($tmpFile)
            . ' stdout -l eng --psm 7 --oem 1 2>' . $errorTarget;
        $text = shell_exec($cmd);
        $text = is_string($text) ? trim(preg_replace('/\s+/u', ' ', $text)) : '';

        // Fallback 1: PSM 6 – uniform block of text (for multi-line labels)
        if (!self::isUsableText($text)) {
            $cmd2  = escapeshellarg($binary)
                . ' ' . escapeshellarg($tmpFile)
                . ' stdout -l eng --psm 6 --oem 1 2>' . $errorTarget;
            $text2 = shell_exec($cmd2);
            $text2 = is_string($text2) ? trim(preg_replace('/\s+/u', ' ', $text2)) : '';
            if (self::isUsableText($text2)) {
                $text = $text2;
            }
        }

        // Fallback 2: PSM 13 – raw line (for very sparse or rotated text)
        if (!self::isUsableText($text)) {
            $cmd3  = escapeshellarg($binary)
                . ' ' . escapeshellarg($tmpFile)
                . ' stdout -l eng --psm 13 --oem 1 2>' . $errorTarget;
            $text3 = shell_exec($cmd3);
            $text3 = is_string($text3) ? trim(preg_replace('/\s+/u', ' ', $text3)) : '';
            if (self::isUsableText($text3)) {
                $text = $text3;
            }
        }

        @unlink($tmpFile);
        return $text;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Text quality gate
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns true when $text contains enough real alphanumeric characters
     * to be considered valid OCR output (not empty or pure symbol garbage).
     */
    private static function isUsableText($text) {
        if (!is_string($text) || trim($text) === '') return false;
        $signal = preg_replace('/[^\p{L}\p{N}]/u', '', $text);
        if (!is_string($signal) || mb_strlen($signal) < 3) return false;
        // Garbage ratio guard: > 85% symbols -> likely OCR noise
        $total = mb_strlen($text);
        if ($total > 0 && (mb_strlen($signal) / $total) < 0.15) return false;
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public endpoint
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * POST /ocr/scan
     *
     * Body: { "image": "<base64 or data-URI>" }
     *
     * Response: { "text": "...", "angle": 0|90|180|270,
     *             "engine": "tesseract-gd", "rotations_tried": [...] }
     */
    public static function scan($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();

        if (!function_exists('imagecreatefromstring')) {
            self::jsonResponse(['error' => 'PHP GD extension is required for server OCR.'], 503);
        }

        $source = self::decodeImage($requestData['image'] ?? '');
        if (!$source) {
            self::jsonResponse(['error' => 'A valid Base64 image is required.'], 400);
        }

        $workingDirectory = sys_get_temp_dir();

        // Run the full preprocessing pipeline
        $processed = self::preprocessImage($source);
        imagedestroy($source);

        // ── Auto-rotation loop ────────────────────────────────────────────────
        // Try 0° first. If Tesseract returns empty/garbage text, rotate the
        // pre-processed binary image by 90°, 180°, 270° until valid text is found.
        // imagerotate() is counter-clockwise; negate angles for clockwise rotation.
        $anglesClockwise = [0, 90, 180, 270];
        $bestText  = '';
        $bestAngle = 0;

        foreach ($anglesClockwise as $angle) {
            if ($angle === 0) {
                $rotated = $processed;
            } else {
                $bgColor = imagecolorallocate($processed, 255, 255, 255);
                $rotated = imagerotate($processed, -$angle, $bgColor);
                if (!$rotated) continue;
            }

            $text = self::extractText($rotated, $workingDirectory);

            if ($angle !== 0 && $rotated) {
                imagedestroy($rotated);
            }

            if (self::isUsableText($text)) {
                $bestText  = $text;
                $bestAngle = $angle;
                break;
            }
        }

        imagedestroy($processed);

        self::jsonResponse([
            'text'            => $bestText,
            'angle'           => $bestAngle,
            'engine'          => 'tesseract-gd',
            'rotations_tried' => $anglesClockwise,
        ]);
    }
}
