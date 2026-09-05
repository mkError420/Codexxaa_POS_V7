<?php
require_once __DIR__ . '/../config/db.php';

class WebsiteContentController {
    private $db;

    public function __construct() {
        $this->db = DB::getConnection();
    }

    // ============================================
    // CONTACT INFORMATION CRUD OPERATIONS
    // ============================================

    public function getContactInformation() {
        try {
            $stmt = $this->db->query("SELECT * FROM contact_information LIMIT 1");
            $contactInfo = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$contactInfo) {
                // Initialize default row if not exists
                $this->db->exec("
                    INSERT INTO contact_information (email_addresses, phone_numbers, payment_numbers, address, business_hours)
                    VALUES ('[]', '[]', '[]', '', '{\"saturday_thursday\":\"9:00 AM - 6:00 PM\",\"friday\":\"Closed\"}')
                ");
                $stmt = $this->db->query("SELECT * FROM contact_information LIMIT 1");
                $contactInfo = $stmt->fetch(PDO::FETCH_ASSOC);
            }
            
            // Parse JSON fields
            $contactInfo['email_addresses'] = is_array($contactInfo['email_addresses'] ?? null) 
                ? $contactInfo['email_addresses'] 
                : (json_decode($contactInfo['email_addresses'] ?? '[]', true) ?? []);

            $contactInfo['phone_numbers'] = is_array($contactInfo['phone_numbers'] ?? null) 
                ? $contactInfo['phone_numbers'] 
                : (json_decode($contactInfo['phone_numbers'] ?? '[]', true) ?? []);

            $contactInfo['payment_numbers'] = is_array($contactInfo['payment_numbers'] ?? null) 
                ? $contactInfo['payment_numbers'] 
                : (json_decode($contactInfo['payment_numbers'] ?? '[]', true) ?? []);

            $businessHours = is_array($contactInfo['business_hours'] ?? null) 
                ? $contactInfo['business_hours'] 
                : (json_decode($contactInfo['business_hours'] ?? '{}', true) ?? []);
            
            // Ensure business hours has the new structure
            if (!isset($businessHours['saturday_thursday'])) {
                $businessHours['saturday_thursday'] = $businessHours['monday_friday'] ?? '';
            }
            if (!isset($businessHours['friday'])) {
                $businessHours['friday'] = $businessHours['sunday'] ?? '';
            }
            
            // Remove old fields if they exist
            unset($businessHours['monday_friday'], $businessHours['saturday'], $businessHours['sunday']);
            
            $contactInfo['business_hours'] = $businessHours;
            
            header('Content-Type: application/json');
            echo json_encode($contactInfo);
        } catch (\Exception $e) {
            error_log('Get contact information error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch contact information: ' . $e->getMessage()]);
        }
    }

    public function getPublicPaymentNumbers() {
        try {
            $stmt = $this->db->query("SELECT payment_numbers FROM contact_information LIMIT 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $raw = $row['payment_numbers'] ?? '[]';
            $paymentNumbers = is_array($raw) ? $raw : (json_decode($raw, true) ?? []);
            header('Content-Type: application/json');
            echo json_encode(['payment_numbers' => $paymentNumbers]);
        } catch (\Exception $e) {
            header('Content-Type: application/json');
            echo json_encode(['payment_numbers' => []]);
        }
    }

    public function updateContactInformation() {
        try {
            // Get the first contact information record
            $stmt = $this->db->query("SELECT * FROM contact_information LIMIT 1");
            $contactInfo = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$contactInfo) {
                $this->db->exec("
                    INSERT INTO contact_information (email_addresses, phone_numbers, payment_numbers, address, business_hours)
                    VALUES ('[]', '[]', '[]', '', '{\"saturday_thursday\":\"9:00 AM - 6:00 PM\",\"friday\":\"Closed\"}')
                ");
                $stmt = $this->db->query("SELECT * FROM contact_information LIMIT 1");
                $contactInfo = $stmt->fetch(PDO::FETCH_ASSOC);
            }
            
            $id = $contactInfo['id'];
            
            // Get JSON input
            $rawInput = file_get_contents('php://input');
            $input = json_decode($rawInput, true) ?? [];
            
            $emailAddresses = isset($input['email_addresses']) 
                ? (is_array($input['email_addresses']) ? json_encode($input['email_addresses']) : $input['email_addresses'])
                : ($contactInfo['email_addresses'] ?? '[]');

            $phoneNumbers = isset($input['phone_numbers']) 
                ? (is_array($input['phone_numbers']) ? json_encode($input['phone_numbers']) : $input['phone_numbers'])
                : ($contactInfo['phone_numbers'] ?? '[]');

            $paymentNumbers = isset($input['payment_numbers']) 
                ? (is_array($input['payment_numbers']) ? json_encode($input['payment_numbers']) : $input['payment_numbers'])
                : ($contactInfo['payment_numbers'] ?? '[]');

            $address = isset($input['address']) 
                ? (string)$input['address'] 
                : ($contactInfo['address'] ?? '');
            
            // Handle business hours
            if (isset($input['business_hours'])) {
                $businessHours = is_array($input['business_hours']) 
                    ? $input['business_hours'] 
                    : (json_decode($input['business_hours'] ?? '{}', true) ?? []);

                if (!isset($businessHours['saturday_thursday'])) {
                    $businessHours['saturday_thursday'] = $businessHours['monday_friday'] ?? '';
                }
                if (!isset($businessHours['friday'])) {
                    $businessHours['friday'] = $businessHours['sunday'] ?? '';
                }
                unset($businessHours['monday_friday'], $businessHours['saturday'], $businessHours['sunday']);
                $businessHoursJson = json_encode($businessHours);
            } else {
                $businessHoursJson = is_array($contactInfo['business_hours'] ?? null) 
                    ? json_encode($contactInfo['business_hours']) 
                    : ($contactInfo['business_hours'] ?? '{}');
            }
            
            $stmt = $this->db->prepare("
                UPDATE contact_information 
                SET email_addresses = ?, phone_numbers = ?, payment_numbers = ?, address = ?, business_hours = ?
                WHERE id = ?
            ");
            $stmt->execute([$emailAddresses, $phoneNumbers, $paymentNumbers, $address, $businessHoursJson, $id]);
            
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Contact and payment information updated successfully'
            ]);
        } catch (\Exception $e) {
            error_log('Update contact information error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to update contact information: ' . $e->getMessage()]);
        }
    }
    // ============================================
    // HERO SLIDES CRUD OPERATIONS
    // ============================================

    public function getAllHeroSlides() {
        try {
            $stmt = $this->db->query("
                SELECT id, title, subtitle, description, button_text, button_link, image_url, display_order, status, created_at, updated_at 
                FROM hero_slides 
                WHERE status = 'active' 
                ORDER BY display_order ASC
            ");
            $slides = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode($slides);
        } catch (PDOException $e) {
            error_log('Get all hero slides error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch hero slides']);
        }
    }

    public function getHeroSlideById($id) {
        try {
            $stmt = $this->db->prepare("
                SELECT id, title, subtitle, description, button_text, button_link, image_url, display_order, status, created_at, updated_at 
                FROM hero_slides 
                WHERE id = ?
            ");
            $stmt->execute([$id]);
            $slide = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$slide) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Hero slide not found']);
                return;
            }
            
            header('Content-Type: application/json');
            echo json_encode($slide);
        } catch (PDOException $e) {
            error_log('Get hero slide error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch hero slide']);
        }
    }

    public function createHeroSlide() {
        try {
            // Handle file upload
            $imageUrl = '';
            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = '../uploads/hero/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                
                $fileExtension = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
                $fileName = time() . '_' . uniqid() . '.' . $fileExtension;
                $uploadPath = $uploadDir . $fileName;
                
                if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadPath)) {
                    $imageUrl = 'uploads/hero/' . $fileName;
                } else {
                    http_response_code(400);
                    header('Content-Type: application/json');
                    echo json_encode(['error' => 'Failed to upload image']);
                    return;
                }
            } else {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Image is required']);
                return;
            }

            $title = $_POST['title'] ?? '';
            $subtitle = $_POST['subtitle'] ?? '';
            $description = $_POST['description'] ?? '';
            $buttonText = $_POST['button_text'] ?? '';
            $buttonLink = $_POST['button_link'] ?? '';
            $displayOrder = $_POST['order'] ?? 0;

            if (empty($title)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Title is required']);
                return;
            }

            $stmt = $this->db->prepare("
                INSERT INTO hero_slides (title, subtitle, description, button_text, button_link, image_url, display_order, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$title, $subtitle, $description, $buttonText, $buttonLink, $imageUrl, $displayOrder]);
            
            http_response_code(201);
            header('Content-Type: application/json');
            echo json_encode([
                'id' => $this->db->lastInsertId(),
                'title' => $title,
                'subtitle' => $subtitle,
                'description' => $description,
                'button_text' => $buttonText,
                'button_link' => $buttonLink,
                'image_url' => $imageUrl,
                'order' => (int)$displayOrder
            ]);
        } catch (PDOException $e) {
            error_log('Create hero slide error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to create hero slide']);
        }
    }

    public function updateHeroSlide($id) {
        try {
            // Check if slide exists
            $stmt = $this->db->prepare("SELECT image_url FROM hero_slides WHERE id = ?");
            $stmt->execute([$id]);
            $existingSlide = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$existingSlide) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Hero slide not found']);
                return;
            }

            $imageUrl = $existingSlide['image_url'];
            
            // Handle file upload if new image provided
            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = '../uploads/hero/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                
                $fileExtension = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
                $fileName = time() . '_' . uniqid() . '.' . $fileExtension;
                $uploadPath = $uploadDir . $fileName;
                
                if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadPath)) {
                    // Delete old image if exists
                    if (!empty($existingSlide['image_url']) && file_exists('../' . $existingSlide['image_url'])) {
                        unlink('../' . $existingSlide['image_url']);
                    }
                    $imageUrl = 'uploads/hero/' . $fileName;
                }
            }

            $title = $_POST['title'] ?? '';
            $subtitle = $_POST['subtitle'] ?? '';
            $description = $_POST['description'] ?? '';
            $buttonText = $_POST['button_text'] ?? '';
            $buttonLink = $_POST['button_link'] ?? '';
            $displayOrder = $_POST['order'] ?? 0;

            if (empty($title)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Title is required']);
                return;
            }

            $stmt = $this->db->prepare("
                UPDATE hero_slides 
                SET title = ?, subtitle = ?, description = ?, button_text = ?, button_link = ?, image_url = ?, display_order = ?
                WHERE id = ?
            ");
            $stmt->execute([$title, $subtitle, $description, $buttonText, $buttonLink, $imageUrl, $displayOrder, $id]);
            
            header('Content-Type: application/json');
            echo json_encode([
                'id' => (int)$id,
                'title' => $title,
                'subtitle' => $subtitle,
                'description' => $description,
                'button_text' => $buttonText,
                'button_link' => $buttonLink,
                'image_url' => $imageUrl,
                'order' => (int)$displayOrder
            ]);
        } catch (PDOException $e) {
            error_log('Update hero slide error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to update hero slide']);
        }
    }

    public function deleteHeroSlide($id) {
        try {
            // Get slide info for image deletion
            $stmt = $this->db->prepare("SELECT image_url FROM hero_slides WHERE id = ?");
            $stmt->execute([$id]);
            $slide = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$slide) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Hero slide not found']);
                return;
            }

            // Delete image file
            if (!empty($slide['image_url']) && file_exists('../' . $slide['image_url'])) {
                unlink('../' . $slide['image_url']);
            }

            // Delete from database
            $stmt = $this->db->prepare("DELETE FROM hero_slides WHERE id = ?");
            $stmt->execute([$id]);
            
            header('Content-Type: application/json');
            echo json_encode(['message' => 'Hero slide deleted successfully']);
        } catch (PDOException $e) {
            error_log('Delete hero slide error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to delete hero slide']);
        }
    }

    // ============================================
    // VIDEOS CRUD OPERATIONS
    // ============================================

    public function getAllVideos() {
        try {
            $stmt = $this->db->query("
                SELECT id, title, description, video_url, thumbnail_url, video_type, display_order, status, created_at, updated_at 
                FROM videos 
                WHERE status = 'active' 
                ORDER BY display_order ASC
            ");
            $videos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode($videos);
        } catch (PDOException $e) {
            error_log('Get all videos error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch videos']);
        }
    }

    public function getVideoById($id) {
        try {
            $stmt = $this->db->prepare("
                SELECT id, title, description, video_url, thumbnail_url, video_type, display_order, status, created_at, updated_at 
                FROM videos 
                WHERE id = ?
            ");
            $stmt->execute([$id]);
            $video = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$video) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Video not found']);
                return;
            }
            
            header('Content-Type: application/json');
            echo json_encode($video);
        } catch (PDOException $e) {
            error_log('Get video error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch video']);
        }
    }

    public function createVideo() {
        try {
            // Handle thumbnail upload
            $thumbnailUrl = '';
            if (isset($_FILES['thumbnail']) && $_FILES['thumbnail']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = '../uploads/videos/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                
                $fileName = time() . '_' . basename($_FILES['thumbnail']['name']);
                $uploadPath = $uploadDir . $fileName;
                
                if (move_uploaded_file($_FILES['thumbnail']['tmp_name'], $uploadPath)) {
                    $thumbnailUrl = 'uploads/videos/' . $fileName;
                } else {
                    http_response_code(400);
                    header('Content-Type: application/json');
                    echo json_encode(['error' => 'Failed to upload thumbnail']);
                    return;
                }
            }

            // Get form data
            $title = $_POST['title'] ?? '';
            $description = $_POST['description'] ?? '';
            $videoUrl = $_POST['video_url'] ?? '';
            $videoType = $_POST['video_type'] ?? 'youtube';
            $displayOrder = $_POST['display_order'] ?? 0;

            if (empty($title) || empty($videoUrl)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Title and video URL are required']);
                return;
            }

            $stmt = $this->db->prepare("
                INSERT INTO videos (title, description, video_url, thumbnail_url, video_type, display_order, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$title, $description, $videoUrl, $thumbnailUrl, $videoType, $displayOrder]);
            
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Video created successfully',
                'id' => (int)$this->db->lastInsertId(),
                'title' => $title,
                'order' => (int)$displayOrder
            ]);
        } catch (PDOException $e) {
            error_log('Create video error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to create video']);
        }
    }

    public function updateVideo($id) {
        try {
            // Check if video exists
            $stmt = $this->db->prepare("SELECT thumbnail_url FROM videos WHERE id = ?");
            $stmt->execute([$id]);
            $existingVideo = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$existingVideo) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Video not found']);
                return;
            }

            $thumbnailUrl = $existingVideo['thumbnail_url'];
            
            // Handle file upload if new thumbnail provided
            if (isset($_FILES['thumbnail']) && $_FILES['thumbnail']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = '../uploads/videos/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                
                $fileName = time() . '_' . basename($_FILES['thumbnail']['name']);
                $uploadPath = $uploadDir . $fileName;
                
                if (move_uploaded_file($_FILES['thumbnail']['tmp_name'], $uploadPath)) {
                    // Delete old thumbnail
                    if (!empty($existingVideo['thumbnail_url']) && file_exists('../' . $existingVideo['thumbnail_url'])) {
                        unlink('../' . $existingVideo['thumbnail_url']);
                    }
                    $thumbnailUrl = 'uploads/videos/' . $fileName;
                }
            }

            // Get form data
            $title = $_POST['title'] ?? $existingVideo['title'];
            $description = $_POST['description'] ?? $existingVideo['description'];
            $videoUrl = $_POST['video_url'] ?? $existingVideo['video_url'];
            $videoType = $_POST['video_type'] ?? $existingVideo['video_type'];
            $displayOrder = $_POST['display_order'] ?? $existingVideo['display_order'];
            $status = $_POST['status'] ?? $existingVideo['status'];

            $stmt = $this->db->prepare("
                UPDATE videos 
                SET title = ?, description = ?, video_url = ?, thumbnail_url = ?, video_type = ?, display_order = ?, status = ?
                WHERE id = ?
            ");
            $stmt->execute([$title, $description, $videoUrl, $thumbnailUrl, $videoType, $displayOrder, $status, $id]);
            
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Video updated successfully',
                'title' => $title,
                'order' => (int)$displayOrder
            ]);
        } catch (PDOException $e) {
            error_log('Update video error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to update video']);
        }
    }

    public function deleteVideo($id) {
        try {
            // Get video info for thumbnail deletion
            $stmt = $this->db->prepare("SELECT thumbnail_url FROM videos WHERE id = ?");
            $stmt->execute([$id]);
            $video = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$video) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Video not found']);
                return;
            }

            // Delete thumbnail file
            if (!empty($video['thumbnail_url']) && file_exists('../' . $video['thumbnail_url'])) {
                unlink('../' . $video['thumbnail_url']);
            }

            // Delete from database
            $stmt = $this->db->prepare("DELETE FROM videos WHERE id = ?");
            $stmt->execute([$id]);
            
            header('Content-Type: application/json');
            echo json_encode(['message' => 'Video deleted successfully']);
        } catch (PDOException $e) {
            error_log('Delete video error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to delete video']);
        }
    }

    // ============================================
    // CONTACT MESSAGES CRUD OPERATIONS
    // ============================================

    public function getAllContactMessages() {
        try {
            $stmt = $this->db->query("
                SELECT id, name, phone, message, status, created_at 
                FROM contact_messages 
                ORDER BY created_at DESC
            ");
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode($messages);
        } catch (PDOException $e) {
            error_log('Get all contact messages error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch contact messages']);
        }
    }

    public function getContactMessageById($id) {
        try {
            $stmt = $this->db->prepare("
                SELECT id, name, phone, message, status, created_at 
                FROM contact_messages 
                WHERE id = ?
            ");
            $stmt->execute([$id]);
            $message = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$message) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Contact message not found']);
                return;
            }
            
            header('Content-Type: application/json');
            echo json_encode($message);
        } catch (PDOException $e) {
            error_log('Get contact message error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch contact message']);
        }
    }

    public function createContactMessage() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $name = $input['name'] ?? '';
            $phone = $input['phone'] ?? '';
            $message = $input['message'] ?? '';
            
            if (empty($name) || empty($phone) || empty($message)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'All fields are required']);
                return;
            }
            
            $stmt = $this->db->prepare("
                INSERT INTO contact_messages (name, phone, message, status)
                VALUES (?, ?, ?, 'new')
            ");
            $stmt->execute([$name, $phone, $message]);
            
            http_response_code(201);
            header('Content-Type: application/json');
            echo json_encode([
                'id' => $this->db->lastInsertId(),
                'name' => $name,
                'phone' => $phone,
                'message' => $message,
                'status' => 'new'
            ]);
        } catch (PDOException $e) {
            error_log('Create contact message error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to create contact message']);
        }
    }

    public function updateContactMessageStatus($id) {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $status = $input['status'] ?? 'read';
            
            if (!in_array($status, ['new', 'read', 'replied'])) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Invalid status']);
                return;
            }
            
            $stmt = $this->db->prepare("
                UPDATE contact_messages 
                SET status = ?
                WHERE id = ?
            ");
            $stmt->execute([$status, $id]);
            
            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Contact message not found']);
                return;
            }
            
            header('Content-Type: application/json');
            echo json_encode([
                'id' => (int)$id,
                'status' => $status
            ]);
        } catch (PDOException $e) {
            error_log('Update contact message status error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to update contact message status']);
        }
    }

    public function deleteContactMessage($id) {
        try {
            $stmt = $this->db->prepare("DELETE FROM contact_messages WHERE id = ?");
            $stmt->execute([$id]);
            
            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Contact message not found']);
                return;
            }
            
            header('Content-Type: application/json');
            echo json_encode(['message' => 'Contact message deleted successfully']);
        } catch (PDOException $e) {
            error_log('Delete contact message error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to delete contact message']);
        }
    }

    // ============================================
    // TEAM MEMBERS CRUD OPERATIONS
    // ============================================

    public function getAllTeamMembers() {
        try {
            $stmt = $this->db->query("
                SELECT id, name, role, bio, image_url, display_order, status, created_at, updated_at 
                FROM team_members 
                WHERE status = 'active' 
                ORDER BY display_order ASC
            ");
            $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode($members);
        } catch (PDOException $e) {
            error_log('Get all team members error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch team members']);
        }
    }

    public function getTeamMemberById($id) {
        try {
            $stmt = $this->db->prepare("
                SELECT id, name, role, bio, image_url, display_order, status, created_at, updated_at 
                FROM team_members 
                WHERE id = ?
            ");
            $stmt->execute([$id]);
            $member = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$member) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Team member not found']);
                return;
            }
            
            header('Content-Type: application/json');
            echo json_encode($member);
        } catch (PDOException $e) {
            error_log('Get team member error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch team member']);
        }
    }

    public function createTeamMember() {
        try {
            // Parse request data
            $postData = [];
            $fileData = [];
            
            // Check content type to determine how to parse
            $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
            
            if (strpos($contentType, 'application/json') !== false) {
                // JSON request
                $rawInput = file_get_contents('php://input');
                $postData = json_decode($rawInput, true) ?? [];
                $fileData = [];
                
                // Handle image_url from JSON request
                $imageUrl = $postData['image_url'] ?? '';
            } else {
                // FormData request
                $postData = $_POST;
                $fileData = $_FILES;
                
                // Handle file upload
                $imageUrl = '';
                if (isset($fileData['image']) && $fileData['image']['error'] === UPLOAD_ERR_OK) {
                    $uploadDir = '../uploads/team/';
                    if (!is_dir($uploadDir)) {
                        mkdir($uploadDir, 0755, true);
                    }
                    
                    $fileExtension = pathinfo($fileData['image']['name'], PATHINFO_EXTENSION);
                    $fileName = time() . '_' . uniqid() . '.' . $fileExtension;
                    $uploadPath = $uploadDir . $fileName;
                    
                    if (move_uploaded_file($fileData['image']['tmp_name'], $uploadPath)) {
                        $imageUrl = 'uploads/team/' . $fileName;
                    }
                }
            }

            $name = $postData['name'] ?? '';
            $role = $postData['role'] ?? '';
            $bio = $postData['bio'] ?? '';
            $displayOrder = $postData['order'] ?? 0;

            if (empty($name) || empty($role)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode([
                    'error' => 'Name and role are required',
                    'debug' => [
                        'received_post' => $postData,
                        'received_files' => isset($fileData['image']) ? 'image present' : 'no image',
                        'name_value' => $name,
                        'role_value' => $role,
                        'name_empty' => empty($name),
                        'role_empty' => empty($role)
                    ]
                ]);
                return;
            }

            $stmt = $this->db->prepare("
                INSERT INTO team_members (name, role, bio, image_url, display_order, status)
                VALUES (?, ?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$name, $role, $bio, $imageUrl, $displayOrder]);
            
            http_response_code(201);
            header('Content-Type: application/json');
            echo json_encode([
                'id' => $this->db->lastInsertId(),
                'name' => $name,
                'role' => $role,
                'bio' => $bio,
                'image_url' => $imageUrl,
                'order' => (int)$displayOrder
            ]);
        } catch (PDOException $e) {
            error_log('Create team member error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to create team member']);
        }
    }

    public function updateTeamMember($id) {
        try {
            // Check if member exists
            $stmt = $this->db->prepare("SELECT image_url FROM team_members WHERE id = ?");
            $stmt->execute([$id]);
            $existingMember = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$existingMember) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Team member not found']);
                return;
            }

            $imageUrl = $existingMember['image_url'];
            
            // Parse request data
            $postData = [];
            $fileData = [];
            
            // Check content type to determine how to parse
            $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
            
            if (strpos($contentType, 'application/json') !== false) {
                // JSON request
                $rawInput = file_get_contents('php://input');
                $postData = json_decode($rawInput, true) ?? [];
                $fileData = [];
                
                // Handle image_url from JSON request
                if (isset($postData['image_url'])) {
                    $imageUrl = $postData['image_url'];
                }
            } else {
                // FormData request (POST only, since we use JSON for PUT now)
                $postData = $_POST;
                $fileData = $_FILES;
                
                // Handle file upload if new image provided
                if (isset($fileData['image']) && $fileData['image']['error'] === UPLOAD_ERR_OK) {
                    $uploadDir = '../uploads/team/';
                    if (!is_dir($uploadDir)) {
                        mkdir($uploadDir, 0755, true);
                    }
                    
                    $fileExtension = pathinfo($fileData['image']['name'], PATHINFO_EXTENSION);
                    $fileName = time() . '_' . uniqid() . '.' . $fileExtension;
                    $uploadPath = $uploadDir . $fileName;
                    
                    if (move_uploaded_file($fileData['image']['tmp_name'], $uploadPath)) {
                        // Delete old image if exists
                        if (!empty($existingMember['image_url']) && file_exists('../' . $existingMember['image_url'])) {
                            unlink('../' . $existingMember['image_url']);
                        }
                        $imageUrl = 'uploads/team/' . $fileName;
                    }
                }
            }

            // Debug logging
            error_log('POST data in update: ' . print_r($postData, true));
            error_log('FILES data in update: ' . print_r($fileData, true));

            $name = $postData['name'] ?? '';
            $role = $postData['role'] ?? '';
            $bio = $postData['bio'] ?? '';
            $displayOrder = $postData['order'] ?? 0;

            if (empty($name) || empty($role)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Name and role are required']);
                return;
            }

            $stmt = $this->db->prepare("
                UPDATE team_members 
                SET name = ?, role = ?, bio = ?, image_url = ?, display_order = ?
                WHERE id = ?
            ");
            $stmt->execute([$name, $role, $bio, $imageUrl, $displayOrder, $id]);
            
            header('Content-Type: application/json');
            echo json_encode([
                'id' => (int)$id,
                'name' => $name,
                'role' => $role,
                'bio' => $bio,
                'image_url' => $imageUrl,
                'order' => (int)$displayOrder
            ]);
        } catch (PDOException $e) {
            error_log('Update team member error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to update team member']);
        }
    }

    public function deleteTeamMember($id) {
        try {
            $stmt = $this->db->prepare("DELETE FROM team_members WHERE id = ?");
            $stmt->execute([$id]);
            
            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Team member not found']);
                return;
            }
            
            header('Content-Type: application/json');
            echo json_encode(['message' => 'Team member deleted successfully']);
        } catch (PDOException $e) {
            error_log('Delete team member error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to delete team member']);
        }
    }

    // ============================================
    // PRICING PLANS CRUD OPERATIONS
    // ============================================

    public function getAllPricingPlans() {
        try {
            $stmt = $this->db->query("
                SELECT id, name, description, price, currency, billing_period, features, is_popular, is_active, sort_order, button_text, created_at, updated_at 
                FROM pricing_plans 
                WHERE is_active = 1 
                ORDER BY sort_order ASC
            ");
            $plans = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Parse JSON features field
            foreach ($plans as &$plan) {
                $plan['features'] = json_decode($plan['features'], true) ?? [];
                $plan['is_popular'] = (bool)$plan['is_popular'];
                $plan['is_active'] = (bool)$plan['is_active'];
            }
            
            header('Content-Type: application/json');
            echo json_encode($plans);
        } catch (PDOException $e) {
            error_log('Get all pricing plans error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch pricing plans']);
        }
    }

    public function getPricingPlanById($id) {
        try {
            $stmt = $this->db->prepare("
                SELECT id, name, description, price, currency, billing_period, features, is_popular, is_active, sort_order, button_text, created_at, updated_at 
                FROM pricing_plans 
                WHERE id = ?
            ");
            $stmt->execute([$id]);
            $plan = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$plan) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Pricing plan not found']);
                return;
            }
            
            // Parse JSON features field
            $plan['features'] = json_decode($plan['features'], true) ?? [];
            $plan['is_popular'] = (bool)$plan['is_popular'];
            $plan['is_active'] = (bool)$plan['is_active'];
            
            header('Content-Type: application/json');
            echo json_encode($plan);
        } catch (PDOException $e) {
            error_log('Get pricing plan error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch pricing plan']);
        }
    }

    public function createPricingPlan() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $name = $input['name'] ?? '';
            $description = $input['description'] ?? '';
            $price = $input['price'] ?? 0;
            $currency = $input['currency'] ?? 'BDT';
            $billingPeriod = $input['billing_period'] ?? 'month';
            $features = json_encode($input['features'] ?? []);
            $isPopular = isset($input['is_popular']) ? (int)$input['is_popular'] : 0;
            $isActive = isset($input['is_active']) ? (int)$input['is_active'] : 1;
            $sortOrder = $input['sort_order'] ?? 0;
            $buttonText = $input['button_text'] ?? 'Get Started';
            
            if (empty($name)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Plan name is required']);
                return;
            }
            
            $stmt = $this->db->prepare("
                INSERT INTO pricing_plans (name, description, price, currency, billing_period, features, is_popular, is_active, sort_order, button_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$name, $description, $price, $currency, $billingPeriod, $features, $isPopular, $isActive, $sortOrder, $buttonText]);
            
            $planId = $this->db->lastInsertId();
            
            header('Content-Type: application/json');
            echo json_encode([
                'id' => (int)$planId,
                'name' => $name,
                'description' => $description,
                'price' => (float)$price,
                'currency' => $currency,
                'billing_period' => $billingPeriod,
                'features' => json_decode($features, true),
                'is_popular' => (bool)$isPopular,
                'is_active' => (bool)$isActive,
                'sort_order' => (int)$sortOrder,
                'button_text' => $buttonText
            ]);
        } catch (PDOException $e) {
            error_log('Create pricing plan error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to create pricing plan']);
        }
    }

    public function updatePricingPlan($id) {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $name = $input['name'] ?? '';
            $description = $input['description'] ?? '';
            $price = $input['price'] ?? 0;
            $currency = $input['currency'] ?? 'BDT';
            $billingPeriod = $input['billing_period'] ?? 'month';
            $features = json_encode($input['features'] ?? []);
            $isPopular = isset($input['is_popular']) ? (int)$input['is_popular'] : 0;
            $isActive = isset($input['is_active']) ? (int)$input['is_active'] : 1;
            $sortOrder = $input['sort_order'] ?? 0;
            $buttonText = $input['button_text'] ?? 'Get Started';
            
            if (empty($name)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Plan name is required']);
                return;
            }
            
            $stmt = $this->db->prepare("
                UPDATE pricing_plans 
                SET name = ?, description = ?, price = ?, currency = ?, billing_period = ?, features = ?, is_popular = ?, is_active = ?, sort_order = ?, button_text = ?
                WHERE id = ?
            ");
            $stmt->execute([$name, $description, $price, $currency, $billingPeriod, $features, $isPopular, $isActive, $sortOrder, $buttonText, $id]);
            
            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Pricing plan not found']);
                return;
            }
            
            header('Content-Type: application/json');
            echo json_encode([
                'id' => (int)$id,
                'name' => $name,
                'description' => $description,
                'price' => (float)$price,
                'currency' => $currency,
                'billing_period' => $billingPeriod,
                'features' => json_decode($features, true),
                'is_popular' => (bool)$isPopular,
                'is_active' => (bool)$isActive,
                'sort_order' => (int)$sortOrder,
                'button_text' => $buttonText
            ]);
        } catch (PDOException $e) {
            error_log('Update pricing plan error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to update pricing plan']);
        }
    }

    public function deletePricingPlan($id) {
        try {
            $stmt = $this->db->prepare("DELETE FROM pricing_plans WHERE id = ?");
            $stmt->execute([$id]);
            
            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Pricing plan not found']);
                return;
            }
            
            header('Content-Type: application/json');
            echo json_encode(['message' => 'Pricing plan deleted successfully']);
        } catch (PDOException $e) {
            error_log('Delete pricing plan error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to delete pricing plan']);
        }
    }

    // ============================================
    // SUBSCRIPTIONS MANAGEMENT OPERATIONS
    // ============================================

    public function createPublicSubscription() {
        try {
            $postData = $_POST;
            $fileData = $_FILES;

            // If $_POST is empty, check JSON input
            if (empty($postData)) {
                $rawInput = file_get_contents('php://input');
                $input = json_decode($rawInput, true) ?: [];
            } else {
                $input = $postData;
            }

            $planId = !empty($input['plan_id']) ? (int)$input['plan_id'] : null;
            $planName = trim($input['plan_name'] ?? '');
            $price = floatval($input['price'] ?? 0);
            $currency = trim($input['currency'] ?? 'BDT');
            $billingPeriod = trim($input['billing_period'] ?? 'month');
            $subscriberName = trim($input['subscriber_name'] ?? '');
            $shopName = trim($input['shop_name'] ?? '');
            $email = trim($input['email'] ?? '');
            $phone = trim($input['phone'] ?? '');
            $paymentMethod = trim($input['payment_method'] ?? 'bKash');
            $transactionId = trim($input['transaction_id'] ?? '');
            $notes = trim($input['notes'] ?? '');

            // Handle receipt file upload or receipt_image url
            $receiptUrl = trim($input['receipt_image'] ?? ($input['receipt_url'] ?? ''));
            $receiptFile = $fileData['receipt'] ?? ($fileData['receipt_image'] ?? null);

            if ($receiptFile && isset($receiptFile['error']) && $receiptFile['error'] === UPLOAD_ERR_OK) {
                $dir1 = __DIR__ . '/../uploads/receipts/'; // backend/uploads/receipts/
                $dir2 = dirname(__DIR__, 2) . '/uploads/receipts/'; // root uploads/receipts/

                foreach ([$dir1, $dir2] as $dir) {
                    if (!is_dir($dir)) {
                        @mkdir($dir, 0777, true);
                    }
                }

                $fileExtension = strtolower(pathinfo($receiptFile['name'], PATHINFO_EXTENSION));
                $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'gif'];
                if (!in_array($fileExtension, $allowedExtensions)) {
                    $fileExtension = 'jpg';
                }
                $fileName = 'receipt_' . time() . '_' . uniqid() . '.' . $fileExtension;
                $target1 = $dir1 . $fileName;
                $target2 = $dir2 . $fileName;

                if (move_uploaded_file($receiptFile['tmp_name'], $target1)) {
                    @copy($target1, $target2);
                    $receiptUrl = 'uploads/receipts/' . $fileName;
                } else if (@copy($receiptFile['tmp_name'], $target2)) {
                    @copy($target2, $target1);
                    $receiptUrl = 'uploads/receipts/' . $fileName;
                }
            }

            if (empty($planName) || empty($subscriberName) || empty($shopName) || empty($email) || empty($phone)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Please fill in all required fields (Name, Shop Name, Email, Phone, Plan)']);
                return;
            }

            $stmt = $this->db->prepare("
                INSERT INTO subscriptions (
                    plan_id, plan_name, price, currency, billing_period,
                    subscriber_name, shop_name, email, phone,
                    payment_method, transaction_id, receipt_image, status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            ");

            $stmt->execute([
                $planId, $planName, $price, $currency, $billingPeriod,
                $subscriberName, $shopName, $email, $phone,
                $paymentMethod, $transactionId, $receiptUrl, $notes
            ]);

            $id = $this->db->lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Subscription request submitted successfully',
                'subscription_id' => (int)$id,
                'receipt_image' => $receiptUrl
            ]);
        } catch (\Exception $e) {
            error_log('Create public subscription error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to submit subscription request: ' . $e->getMessage()]);
        }
    }

    public function getAllSubscriptions() {
        try {
            $status = $_GET['status'] ?? null;
            $sql = "SELECT * FROM subscriptions";
            $params = [];

            if (!empty($status) && $status !== 'all') {
                $sql .= " WHERE status = ?";
                $params[] = $status;
            }

            $sql .= " ORDER BY created_at DESC";

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $subscriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);

            header('Content-Type: application/json');
            echo json_encode($subscriptions);
        } catch (PDOException $e) {
            error_log('Get all subscriptions error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch subscriptions']);
        }
    }

    public function getSubscriptionById($id) {
        try {
            $stmt = $this->db->prepare("SELECT * FROM subscriptions WHERE id = ?");
            $stmt->execute([$id]);
            $subscription = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$subscription) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Subscription not found']);
                return;
            }

            header('Content-Type: application/json');
            echo json_encode($subscription);
        } catch (PDOException $e) {
            error_log('Get subscription by ID error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch subscription']);
        }
    }

    public function createSubscription() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);

            $planId = !empty($input['plan_id']) ? (int)$input['plan_id'] : null;
            $planName = trim($input['plan_name'] ?? '');
            $price = floatval($input['price'] ?? 0);
            $currency = trim($input['currency'] ?? 'BDT');
            $billingPeriod = trim($input['billing_period'] ?? 'month');
            $subscriberName = trim($input['subscriber_name'] ?? '');
            $shopName = trim($input['shop_name'] ?? '');
            $email = trim($input['email'] ?? '');
            $phone = trim($input['phone'] ?? '');
            $paymentMethod = trim($input['payment_method'] ?? 'bKash');
            $transactionId = trim($input['transaction_id'] ?? '');
            $receiptImage = trim($input['receipt_image'] ?? '');
            $status = trim($input['status'] ?? 'active');
            $startDate = !empty($input['start_date']) ? $input['start_date'] : date('Y-m-d');
            $endDate = !empty($input['end_date']) ? $input['end_date'] : date('Y-m-d', strtotime('+1 month'));
            $notes = trim($input['notes'] ?? '');
            $adminNotes = trim($input['admin_notes'] ?? '');

            if (empty($planName) || empty($subscriberName) || empty($shopName) || empty($email) || empty($phone)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'All core fields are required']);
                return;
            }

            $stmt = $this->db->prepare("
                INSERT INTO subscriptions (
                    plan_id, shop_id, plan_name, price, currency, billing_period,
                    subscriber_name, shop_name, email, phone,
                    payment_method, transaction_id, receipt_image, status, start_date, end_date, notes, admin_notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            // Sync shop and admin user if status is active/approved
            $shopSync = $this->syncShopAndAdminUserForSubscription($shopName, $email, $phone, $subscriberName, $notes, $status);
            $shopId = $shopSync['shop_id'];

            $stmt->execute([
                $planId, $shopId, $planName, $price, $currency, $billingPeriod,
                $subscriberName, $shopName, $email, $phone,
                $paymentMethod, $transactionId, $receiptImage, $status, $startDate, $endDate, $notes, $adminNotes
            ]);

            $id = $this->db->lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Subscription created successfully',
                'id' => (int)$id,
                'shop_id' => $shopId,
                'created_new_shop' => $shopSync['created_new_shop'],
                'created_new_admin_user' => $shopSync['created_new_admin_user'],
                'default_password' => $shopSync['default_password'],
                'admin_email' => $email
            ]);
        } catch (PDOException $e) {
            error_log('Create subscription error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to create subscription: ' . $e->getMessage()]);
        }
    }

    public function updateSubscription($id) {
        try {
            $input = json_decode(file_get_contents('php://input'), true);

            $stmt = $this->db->prepare("SELECT * FROM subscriptions WHERE id = ?");
            $stmt->execute([$id]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Subscription not found']);
                return;
            }

            $planName = isset($input['plan_name']) ? trim($input['plan_name']) : $existing['plan_name'];
            $price = isset($input['price']) ? floatval($input['price']) : $existing['price'];
            $currency = isset($input['currency']) ? trim($input['currency']) : $existing['currency'];
            $billingPeriod = isset($input['billing_period']) ? trim($input['billing_period']) : $existing['billing_period'];
            $subscriberName = isset($input['subscriber_name']) ? trim($input['subscriber_name']) : $existing['subscriber_name'];
            $shopName = isset($input['shop_name']) ? trim($input['shop_name']) : $existing['shop_name'];
            $email = isset($input['email']) ? trim($input['email']) : $existing['email'];
            $phone = isset($input['phone']) ? trim($input['phone']) : $existing['phone'];
            $paymentMethod = isset($input['payment_method']) ? trim($input['payment_method']) : $existing['payment_method'];
            $transactionId = isset($input['transaction_id']) ? trim($input['transaction_id']) : $existing['transaction_id'];
            $receiptImage = isset($input['receipt_image']) ? trim($input['receipt_image']) : ($existing['receipt_image'] ?? null);
            $status = isset($input['status']) ? trim($input['status']) : $existing['status'];
            $startDate = isset($input['start_date']) ? $input['start_date'] : $existing['start_date'];
            $endDate = isset($input['end_date']) ? $input['end_date'] : $existing['end_date'];
            $notes = isset($input['notes']) ? trim($input['notes']) : $existing['notes'];
            $adminNotes = isset($input['admin_notes']) ? trim($input['admin_notes']) : $existing['admin_notes'];

            // Auto set start date and end date if activating subscription without specified dates
            if (($status === 'active' || $status === 'approved') && empty($startDate)) {
                $startDate = date('Y-m-d');
            }
            if (($status === 'active' || $status === 'approved') && empty($endDate)) {
                $months = $billingPeriod === 'year' ? 12 : 1;
                $endDate = date('Y-m-d', strtotime("+$months month"));
            }

            // Sync shop and admin user in Manage Tenant Shops
            $shopSync = $this->syncShopAndAdminUserForSubscription($shopName, $email, $phone, $subscriberName, $notes, $status);
            $shopId = $shopSync['shop_id'] ?: ($existing['shop_id'] ?? null);

            $updateStmt = $this->db->prepare("
                UPDATE subscriptions SET
                    shop_id = ?, plan_name = ?, price = ?, currency = ?, billing_period = ?,
                    subscriber_name = ?, shop_name = ?, email = ?, phone = ?,
                    payment_method = ?, transaction_id = ?, receipt_image = ?, status = ?,
                    start_date = ?, end_date = ?, notes = ?, admin_notes = ?
                WHERE id = ?
            ");

            $updateStmt->execute([
                $shopId, $planName, $price, $currency, $billingPeriod,
                $subscriberName, $shopName, $email, $phone,
                $paymentMethod, $transactionId, $receiptImage, $status,
                $startDate, $endDate, $notes, $adminNotes,
                $id
            ]);

            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Subscription updated successfully and shop synced in Manage Tenant Shops',
                'id' => (int)$id,
                'shop_id' => $shopId,
                'created_new_shop' => $shopSync['created_new_shop'],
                'created_new_admin_user' => $shopSync['created_new_admin_user'],
                'default_password' => $shopSync['default_password'],
                'admin_email' => $email
            ]);
        } catch (PDOException $e) {
            error_log('Update subscription error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to update subscription']);
        }
    }

    private function syncShopAndAdminUserForSubscription($shopName, $email, $phone, $subscriberName, $notes = '', $status = 'active') {
        $createdNewShop = false;
        $createdNewAdminUser = false;
        $defaultPassword = null;
        $shopId = null;

        try {
            if ($status === 'active' || $status === 'approved') {
                // 1. Check if shop exists by email or name
                $stmtShop = $this->db->prepare("SELECT id, name, email, status FROM shops WHERE email = ? OR name = ? LIMIT 1");
                $stmtShop->execute([$email, $shopName]);
                $existingShop = $stmtShop->fetch(PDO::FETCH_ASSOC);

                if ($existingShop) {
                    $shopId = (int)$existingShop['id'];
                    if ($existingShop['status'] !== 'active') {
                        $this->db->prepare("UPDATE shops SET status = 'active' WHERE id = ?")->execute([$shopId]);
                    }
                } else {
                    // Create shop in `shops` table
                    $stmtInsertShop = $this->db->prepare("INSERT INTO shops (name, email, phone, address, status) VALUES (?, ?, ?, ?, 'active')");
                    $stmtInsertShop->execute([$shopName, $email, $phone, $notes ?: 'Subscription Plan Approved']);
                    $shopId = (int)$this->db->lastInsertId();
                    $createdNewShop = true;
                }

                // 2. Check if admin user with subscriber email exists in `users`
                $stmtUser = $this->db->prepare("SELECT id, role, status FROM users WHERE email = ? LIMIT 1");
                $stmtUser->execute([$email]);
                $existingUser = $stmtUser->fetch(PDO::FETCH_ASSOC);

                if ($existingUser) {
                    $this->db->prepare("UPDATE users SET shop_id = ?, role = 'shop_admin', status = 'active' WHERE email = ?")->execute([$shopId, $email]);
                } else {
                    // Create shop admin user
                    $defaultPassword = '123456';
                    $passwordHash = password_hash($defaultPassword, PASSWORD_BCRYPT);
                    $stmtInsertUser = $this->db->prepare("INSERT INTO users (shop_id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'shop_admin', 'active')");
                    $stmtInsertUser->execute([$shopId, $subscriberName, $email, $passwordHash]);
                    $createdNewAdminUser = true;
                }
            } else if ($status === 'rejected' || $status === 'expired') {
                // If rejected or expired, set shop status to suspended
                $stmtShop = $this->db->prepare("SELECT id FROM shops WHERE email = ? OR name = ? LIMIT 1");
                $stmtShop->execute([$email, $shopName]);
                $existingShop = $stmtShop->fetch(PDO::FETCH_ASSOC);
                if ($existingShop) {
                    $shopId = (int)$existingShop['id'];
                    $this->db->prepare("UPDATE shops SET status = 'suspended' WHERE id = ?")->execute([$shopId]);
                    $this->db->prepare("UPDATE users SET status = 'suspended' WHERE shop_id = ? AND role = 'shop_admin'")->execute([$shopId]);
                }
            }
        } catch (PDOException $e) {
            error_log('syncShopAndAdminUserForSubscription error: ' . $e->getMessage());
        }

        return [
            'shop_id' => $shopId,
            'created_new_shop' => $createdNewShop,
            'created_new_admin_user' => $createdNewAdminUser,
            'default_password' => $defaultPassword
        ];
    }

    public function deleteSubscription($id) {
        try {
            $stmt = $this->db->prepare("DELETE FROM subscriptions WHERE id = ?");
            $stmt->execute([$id]);

            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Subscription not found']);
                return;
            }

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Subscription deleted successfully']);
        } catch (PDOException $e) {
            error_log('Delete subscription error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to delete subscription']);
        }
    }

    // ============================================
    // MORE SERVICES CRUD OPERATIONS
    // ============================================

    public function getAllServicesPublic() {
        try {
            $stmt = $this->db->query("
                SELECT id, title, subtitle, description, badge, features, icon, image_url, button_text, button_link, display_order, status, created_at, updated_at 
                FROM more_services 
                WHERE status = 'active' 
                ORDER BY display_order ASC, id ASC
            ");
            $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Parse features JSON for clean frontend consumption
            foreach ($services as &$service) {
                if (!empty($service['features'])) {
                    $decoded = json_decode($service['features'], true);
                    $service['features'] = is_array($decoded) ? $decoded : [];
                } else {
                    $service['features'] = [];
                }
            }

            header('Content-Type: application/json');
            echo json_encode($services);
        } catch (\Exception $e) {
            error_log('Get public more services error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch services: ' . $e->getMessage()]);
        }
    }

    public function getAllServices() {
        try {
            $stmt = $this->db->query("
                SELECT id, title, subtitle, description, badge, features, icon, image_url, button_text, button_link, display_order, status, created_at, updated_at 
                FROM more_services 
                ORDER BY display_order ASC, id ASC
            ");
            $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($services as &$service) {
                if (!empty($service['features'])) {
                    $decoded = json_decode($service['features'], true);
                    $service['features'] = is_array($decoded) ? $decoded : [];
                } else {
                    $service['features'] = [];
                }
            }

            header('Content-Type: application/json');
            echo json_encode($services);
        } catch (\Exception $e) {
            error_log('Get all more services error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch services: ' . $e->getMessage()]);
        }
    }

    public function getServiceById($id) {
        try {
            $stmt = $this->db->prepare("
                SELECT id, title, subtitle, description, badge, features, icon, image_url, button_text, button_link, display_order, status, created_at, updated_at 
                FROM more_services 
                WHERE id = ?
            ");
            $stmt->execute([$id]);
            $service = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$service) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Service not found']);
                return;
            }

            if (!empty($service['features'])) {
                $decoded = json_decode($service['features'], true);
                $service['features'] = is_array($decoded) ? $decoded : [];
            } else {
                $service['features'] = [];
            }

            header('Content-Type: application/json');
            echo json_encode($service);
        } catch (\Exception $e) {
            error_log('Get service by id error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to fetch service: ' . $e->getMessage()]);
        }
    }

    public function createService() {
        try {
            // Determine input source (multipart/form-data vs raw JSON)
            $isJson = empty($_POST) && !empty(file_get_contents('php://input'));
            $input = $isJson ? json_decode(file_get_contents('php://input'), true) : $_POST;

            $title = trim($input['title'] ?? '');
            $subtitle = trim($input['subtitle'] ?? '');
            $description = trim($input['description'] ?? '');
            $badge = trim($input['badge'] ?? '');
            $icon = trim($input['icon'] ?? 'code');
            $buttonText = trim($input['button_text'] ?? 'Learn More');
            $buttonLink = trim($input['button_link'] ?? '#contact');
            $displayOrder = isset($input['display_order']) ? (int)$input['display_order'] : 0;
            $status = in_array($input['status'] ?? '', ['active', 'inactive']) ? $input['status'] : 'active';

            // Parse features
            $features = $input['features'] ?? [];
            if (is_string($features)) {
                $featuresDecoded = json_decode($features, true);
                $features = is_array($featuresDecoded) ? $featuresDecoded : array_filter(array_map('trim', explode("\n", $features)));
            }
            $featuresJson = json_encode(array_values(array_filter($features)));

            if (empty($title)) {
                http_response_code(400);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Service title is required']);
                return;
            }

            // Handle optional image upload
            $imageUrl = null;
            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = '../uploads/services/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                $ext = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
                $fileName = 'service_' . time() . '_' . uniqid() . '.' . $ext;
                $uploadPath = $uploadDir . $fileName;

                if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadPath)) {
                    $imageUrl = 'uploads/services/' . $fileName;
                }
            } else if (!empty($input['image_url'])) {
                $imageUrl = $input['image_url'];
            }

            $stmt = $this->db->prepare("
                INSERT INTO more_services (title, subtitle, description, badge, features, icon, image_url, button_text, button_link, display_order, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $title, $subtitle, $description, $badge, $featuresJson, $icon, $imageUrl, $buttonText, $buttonLink, $displayOrder, $status
            ]);

            $id = $this->db->lastInsertId();

            http_response_code(201);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Service created successfully',
                'service' => [
                    'id' => (int)$id,
                    'title' => $title,
                    'subtitle' => $subtitle,
                    'description' => $description,
                    'badge' => $badge,
                    'features' => json_decode($featuresJson, true),
                    'icon' => $icon,
                    'image_url' => $imageUrl,
                    'button_text' => $buttonText,
                    'button_link' => $buttonLink,
                    'display_order' => $displayOrder,
                    'status' => $status
                ]
            ]);
        } catch (\Exception $e) {
            error_log('Create service error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to create service: ' . $e->getMessage()]);
        }
    }

    public function updateService($id) {
        try {
            $stmt = $this->db->prepare("SELECT * FROM more_services WHERE id = ?");
            $stmt->execute([$id]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Service not found']);
                return;
            }

            $isJson = empty($_POST) && !empty(file_get_contents('php://input'));
            $input = $isJson ? json_decode(file_get_contents('php://input'), true) : $_POST;

            $title = isset($input['title']) ? trim($input['title']) : $existing['title'];
            $subtitle = isset($input['subtitle']) ? trim($input['subtitle']) : $existing['subtitle'];
            $description = isset($input['description']) ? trim($input['description']) : $existing['description'];
            $badge = isset($input['badge']) ? trim($input['badge']) : $existing['badge'];
            $icon = isset($input['icon']) ? trim($input['icon']) : $existing['icon'];
            $buttonText = isset($input['button_text']) ? trim($input['button_text']) : $existing['button_text'];
            $buttonLink = isset($input['button_link']) ? trim($input['button_link']) : $existing['button_link'];
            $displayOrder = isset($input['display_order']) ? (int)$input['display_order'] : (int)$existing['display_order'];
            $status = isset($input['status']) && in_array($input['status'], ['active', 'inactive']) ? $input['status'] : $existing['status'];

            // Features handling
            if (isset($input['features'])) {
                $features = $input['features'];
                if (is_string($features)) {
                    $featuresDecoded = json_decode($features, true);
                    $features = is_array($featuresDecoded) ? $featuresDecoded : array_filter(array_map('trim', explode("\n", $features)));
                }
                $featuresJson = json_encode(array_values(array_filter($features)));
            } else {
                $featuresJson = $existing['features'];
            }

            // Image handling
            $imageUrl = $existing['image_url'];
            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = '../uploads/services/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                $ext = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
                $fileName = 'service_' . time() . '_' . uniqid() . '.' . $ext;
                $uploadPath = $uploadDir . $fileName;

                if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadPath)) {
                    if (!empty($existing['image_url']) && file_exists('../' . $existing['image_url'])) {
                        @unlink('../' . $existing['image_url']);
                    }
                    $imageUrl = 'uploads/services/' . $fileName;
                }
            } else if (isset($input['remove_image']) && $input['remove_image'] == '1') {
                if (!empty($existing['image_url']) && file_exists('../' . $existing['image_url'])) {
                    @unlink('../' . $existing['image_url']);
                }
                $imageUrl = null;
            }

            $updateStmt = $this->db->prepare("
                UPDATE more_services 
                SET title = ?, subtitle = ?, description = ?, badge = ?, features = ?, icon = ?, image_url = ?, button_text = ?, button_link = ?, display_order = ?, status = ?
                WHERE id = ?
            ");
            $updateStmt->execute([
                $title, $subtitle, $description, $badge, $featuresJson, $icon, $imageUrl, $buttonText, $buttonLink, $displayOrder, $status, $id
            ]);

            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Service updated successfully',
                'service' => [
                    'id' => (int)$id,
                    'title' => $title,
                    'subtitle' => $subtitle,
                    'description' => $description,
                    'badge' => $badge,
                    'features' => json_decode($featuresJson, true),
                    'icon' => $icon,
                    'image_url' => $imageUrl,
                    'button_text' => $buttonText,
                    'button_link' => $buttonLink,
                    'display_order' => $displayOrder,
                    'status' => $status
                ]
            ]);
        } catch (\Exception $e) {
            error_log('Update service error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to update service: ' . $e->getMessage()]);
        }
    }

    public function deleteService($id) {
        try {
            $stmt = $this->db->prepare("SELECT image_url FROM more_services WHERE id = ?");
            $stmt->execute([$id]);
            $service = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$service) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Service not found']);
                return;
            }

            if (!empty($service['image_url']) && file_exists('../' . $service['image_url'])) {
                @unlink('../' . $service['image_url']);
            }

            $deleteStmt = $this->db->prepare("DELETE FROM more_services WHERE id = ?");
            $deleteStmt->execute([$id]);

            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'message' => 'Service deleted successfully']);
        } catch (\Exception $e) {
            error_log('Delete service error: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Failed to delete service: ' . $e->getMessage()]);
        }
    }
}

