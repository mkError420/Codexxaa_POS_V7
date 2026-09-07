<?php
/**
 * Server-side OCR endpoint for camera ROI images.
 */

require_once __DIR__ . '/../middleware/auth.php';

class OcrController {
    private static function jsonResponse($payload, $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE);
        exit;
    }

    private static function decodeImage($imageData) {
        if (!is_string($imageData) || $imageData === '') {
            return false;
        }

        if (preg_match('/^data:image\/[a-zA-Z0-9.+-]+;base64,(.*)$/s', $imageData, $matches)) {
            $imageData = $matches[1];
        }

        $binary = base64_decode($imageData, true);
        if ($binary === false || strlen($binary) > 8 * 1024 * 1024) {
            return false;
        }

        $image = @imagecreatefromstring($binary);
        if (!$image) {
            return false;
        }

        return $image;
    }

    /**
     * Convert the ROI to grayscale, increase contrast, then apply a binary threshold.
     */
    private static function preprocessImage($source) {
        $width = imagesx($source);
        $height = imagesy($source);
        $image = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $white);
        imagecopy($image, $source, 0, 0, 0, 0, $width, $height);

        imagefilter($image, IMG_FILTER_GRAYSCALE);
        imagefilter($image, IMG_FILTER_CONTRAST, -35);

        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $rgb = imagecolorat($image, $x, $y);
                $gray = (($rgb >> 16) & 0xFF) * 0.299
                    + (($rgb >> 8) & 0xFF) * 0.587
                    + ($rgb & 0xFF) * 0.114;
                $value = $gray >= 155 ? 255 : 0;
                imagesetpixel($image, $x, $y, ($value << 16) | ($value << 8) | $value);
            }
        }

        return $image;
    }

    private static function extractText($imagePath, $workingDirectory) {
        $binaryPath = $workingDirectory . DIRECTORY_SEPARATOR . 'ocr-binary-' . bin2hex(random_bytes(8)) . '.png';
        imagepng($imagePath, $binaryPath, 1);

        $binary = getenv('TESSERACT_BIN') ?: 'tesseract';
        $errorTarget = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'NUL' : '/dev/null';
        $command = escapeshellarg($binary) . ' ' . escapeshellarg($binaryPath)
            . ' stdout -l eng+ben --psm 6 2>' . $errorTarget;
        $text = shell_exec($command);
        @unlink($binaryPath);

        return is_string($text) ? trim(preg_replace('/\s+/u', ' ', $text)) : '';
    }

    private static function isUsableText($text) {
        if (!is_string($text)) return false;
        $signal = preg_replace('/[^\p{L}\p{N}]/u', '', $text);
        return is_string($signal) && strlen($signal) >= 3;
    }

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
        $processed = self::preprocessImage($source);
        imagedestroy($source);

        $angles = [0, 90, 180, 270];
        $bestText = '';
        $bestAngle = 0;

        foreach ($angles as $angle) {
            $rotated = $angle === 0
                ? $processed
                : imagerotate($processed, $angle, 0);
            if (!$rotated) continue;

            $text = self::extractText($rotated, $workingDirectory);
            if (self::isUsableText($text)) {
                $bestText = $text;
                $bestAngle = $angle;
                if ($angle !== 0) imagedestroy($rotated);
                break;
            }

            if ($angle !== 0) imagedestroy($rotated);
        }

        imagedestroy($processed);
        self::jsonResponse([
            'text' => $bestText,
            'angle' => $bestAngle,
            'engine' => 'tesseract-gd',
            'rotations_tried' => $angles
        ]);
    }
}
