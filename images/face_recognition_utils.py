"""
Face Detection and Recognition Utilities using OpenCV
Advanced face tagging system for wedding gallery
"""

import cv2
import numpy as np
import json
import os
from PIL import Image as PILImage
from django.conf import settings
from typing import List, Tuple, Optional, Dict
import logging

logger = logging.getLogger(__name__)

class FaceRecognitionService:
    """Service for face detection, recognition and encoding using OpenCV"""
    
    def __init__(self):
        # Load OpenCV face detection models
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        
        # Initialize face recognizer for face encoding/comparison (simplified approach)
        # Using HOG + SVM approach instead of LBPH due to cv2.face module unavailability
        self.feature_extractor = None  # Will implement HOG-based features
        
        # Detection parameters
        self.min_face_size = (30, 30)  # Minimum face size to detect
        self.scale_factor = 1.1        # How much image size is reduced at each scale
        self.min_neighbors = 5         # How many neighbors each face should retain
        
    def detect_faces_in_image(self, image_path: str) -> List[Dict]:
        """
        Detect faces in an image and return face locations and encodings
        
        Args:
            image_path: Path to the image file
            
        Returns:
            List of dictionaries with face data:
            {
                'x': float,      # Relative X coordinate (0-1)
                'y': float,      # Relative Y coordinate (0-1) 
                'width': float,  # Relative width (0-1)
                'height': float, # Relative height (0-1)
                'encoding': list, # Face encoding for recognition
                'confidence': float # Detection confidence (0-1)
            }
        """
        try:
            # Read image
            img = cv2.imread(image_path)
            if img is None:
                logger.error(f"Could not read image: {image_path}")
                return []
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            img_height, img_width = gray.shape
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=self.scale_factor,
                minNeighbors=self.min_neighbors,
                minSize=self.min_face_size,
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            detected_faces = []
            
            for i, (x, y, w, h) in enumerate(faces):
                # Extract face ROI for encoding
                face_roi = gray[y:y+h, x:x+w]
                
                # Resize face for consistent encoding
                face_resized = cv2.resize(face_roi, (100, 100))
                
                # Generate face encoding using LBP features
                face_encoding = self._generate_face_encoding(face_resized)
                
                # Calculate confidence based on face quality metrics
                confidence = self._calculate_face_quality(face_roi)
                
                # Convert to relative coordinates (0-1)
                face_data = {
                    'x': x / img_width,             # Top-left X (relative)
                    'y': y / img_height,            # Top-left Y (relative)
                    'width': w / img_width,         # Relative width
                    'height': h / img_height,       # Relative height
                    'encoding': face_encoding.tolist(),  # Convert numpy to list
                    'confidence': confidence,
                    'detection_method': 'opencv_haar'
                }
                
                detected_faces.append(face_data)
                logger.info(f"Detected face {i+1} at ({face_data['x']:.2f}, {face_data['y']:.2f}) "
                           f"with confidence {confidence:.2f}")
            
            return detected_faces
            
        except Exception as e:
            logger.error(f"Error detecting faces in {image_path}: {str(e)}")
            return []
    
    def _generate_face_encoding(self, face_roi: np.ndarray) -> np.ndarray:
        """Generate face encoding using simplified image features"""
        try:
            # Resize face to standard size
            face_resized = cv2.resize(face_roi, (64, 64))
            
            # Method 1: Use pixel intensity histogram
            hist = cv2.calcHist([face_resized], [0], None, [256], [0, 256])
            hist_features = hist.flatten() / np.sum(hist)  # Normalize
            
            # Method 2: Calculate image moments
            moments = cv2.moments(face_resized)
            moment_features = np.array([
                moments['m00'], moments['m10'], moments['m01'],
                moments['m20'], moments['m11'], moments['m02'],
                moments['m30'], moments['m21'], moments['m12'], moments['m03']
            ])
            moment_features = moment_features / (np.linalg.norm(moment_features) + 1e-7)
            
            # Method 3: Local Binary Pattern simplified
            def simple_lbp(image):
                rows, cols = image.shape
                lbp_image = np.zeros((rows-2, cols-2), dtype=np.uint8)
                
                for i in range(1, rows-1):
                    for j in range(1, cols-1):
                        center = image[i, j]
                        pattern = 0
                        if image[i-1, j-1] >= center: pattern |= 1
                        if image[i-1, j] >= center: pattern |= 2
                        if image[i-1, j+1] >= center: pattern |= 4
                        if image[i, j+1] >= center: pattern |= 8
                        if image[i+1, j+1] >= center: pattern |= 16
                        if image[i+1, j] >= center: pattern |= 32
                        if image[i+1, j-1] >= center: pattern |= 64
                        if image[i, j-1] >= center: pattern |= 128
                        lbp_image[i-1, j-1] = pattern
                        
                return lbp_image
            
            lbp_img = simple_lbp(face_resized)
            lbp_hist = cv2.calcHist([lbp_img], [0], None, [256], [0, 256])
            lbp_features = lbp_hist.flatten() / np.sum(lbp_hist)
            
            # Combine all features
            features = np.concatenate([
                hist_features[:64],     # First 64 histogram bins
                moment_features,        # 10 moment features  
                lbp_features[:64]       # First 64 LBP histogram bins
            ])
            
            # Normalize final feature vector
            features = features / (np.linalg.norm(features) + 1e-7)
            
            return features
            
        except Exception as e:
            logger.error(f"Error generating face encoding: {str(e)}")
            # Return a default encoding if calculation fails
            return np.zeros(138)  # 64 + 10 + 64 = 138 features
    
    def _calculate_face_quality(self, face_roi: np.ndarray) -> float:
        """Calculate face quality score based on various metrics"""
        try:
            # Calculate sharpness using Laplacian variance
            laplacian_var = cv2.Laplacian(face_roi, cv2.CV_64F).var()
            sharpness_score = min(laplacian_var / 500.0, 1.0)  # Normalize to 0-1
            
            # Calculate brightness (avoid too dark/bright faces)
            brightness = np.mean(face_roi) / 255.0
            brightness_score = 1.0 - abs(brightness - 0.5) * 2  # Prefer mid-range brightness
            
            # Calculate size score (larger faces generally better)
            size_score = min(max(face_roi.shape[0] - 30, 0) / 100.0, 1.0)
            
            # Detect eyes in face for better quality assessment
            eyes = self.eye_cascade.detectMultiScale(face_roi, 1.1, 5)
            eye_score = min(len(eyes) / 2.0, 1.0)  # Prefer faces with 2 eyes detected
            
            # Weighted average of quality metrics
            quality_score = (
                sharpness_score * 0.3 +
                brightness_score * 0.2 +
                size_score * 0.3 +
                eye_score * 0.2
            )
            
            return max(0.1, min(quality_score, 1.0))  # Clamp between 0.1 and 1.0
            
        except Exception as e:
            logger.error(f"Error calculating face quality: {str(e)}")
            return 0.5  # Default medium quality
    
    def compare_faces(self, encoding1: List[float], encoding2: List[float], 
                     threshold: float = 0.6) -> Tuple[bool, float]:
        """
        Compare two face encodings to determine if they're the same person
        
        Args:
            encoding1: First face encoding
            encoding2: Second face encoding  
            threshold: Similarity threshold (0-1, higher = more strict)
            
        Returns:
            Tuple of (is_match: bool, similarity_score: float)
        """
        try:
            if not encoding1 or not encoding2:
                return False, 0.0
            
            # Convert to numpy arrays
            enc1 = np.array(encoding1)
            enc2 = np.array(encoding2)
            
            if enc1.shape != enc2.shape:
                logger.warning(f"Face encoding shape mismatch: {enc1.shape} vs {enc2.shape}")
                return False, 0.0
            
            # Calculate cosine similarity
            dot_product = np.dot(enc1, enc2)
            norm1 = np.linalg.norm(enc1)
            norm2 = np.linalg.norm(enc2)
            
            if norm1 == 0 or norm2 == 0:
                return False, 0.0
            
            cosine_similarity = dot_product / (norm1 * norm2)
            
            # Convert to 0-1 range (cosine similarity is -1 to 1)
            similarity_score = (cosine_similarity + 1) / 2
            
            is_match = similarity_score >= threshold
            
            logger.debug(f"Face comparison: similarity={similarity_score:.3f}, "
                        f"match={is_match} (threshold={threshold})")
            
            return is_match, similarity_score
            
        except Exception as e:
            logger.error(f"Error comparing faces: {str(e)}")
            return False, 0.0
    
    def find_similar_faces(self, target_encoding: List[float], 
                          candidate_encodings: List[Tuple[int, List[float]]],
                          threshold: float = 0.6) -> List[Tuple[int, float]]:
        """
        Find faces similar to target face from a list of candidates
        
        Args:
            target_encoding: Face encoding to match against
            candidate_encodings: List of (face_tag_id, encoding) tuples
            threshold: Similarity threshold
            
        Returns:
            List of (face_tag_id, similarity_score) for matching faces
        """
        matches = []
        
        for face_tag_id, candidate_encoding in candidate_encodings:
            is_match, similarity = self.compare_faces(
                target_encoding, candidate_encoding, threshold
            )
            
            if is_match:
                matches.append((face_tag_id, similarity))
        
        # Sort by similarity score (highest first)
        matches.sort(key=lambda x: x[1], reverse=True)
        
        return matches
    
    def draw_face_boxes(self, image_path: str, faces: List[Dict], 
                       output_path: str = None) -> str:
        """
        Draw bounding boxes around detected faces for visualization
        
        Args:
            image_path: Path to original image
            faces: List of face detection results
            output_path: Where to save annotated image (optional)
            
        Returns:
            Path to annotated image
        """
        try:
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError(f"Could not read image: {image_path}")
            
            img_height, img_width = img.shape[:2]
            
            for i, face in enumerate(faces):
                # Convert relative coordinates to absolute
                center_x = int(face['x'] * img_width)
                center_y = int(face['y'] * img_height)
                width = int(face['width'] * img_width)
                height = int(face['height'] * img_height)
                
                # Calculate bounding box coordinates
                x1 = int(center_x - width/2)
                y1 = int(center_y - height/2)
                x2 = int(center_x + width/2)
                y2 = int(center_y + height/2)
                
                # Draw rectangle
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                
                # Add confidence text
                confidence_text = f"Face {i+1}: {face['confidence']:.2f}"
                cv2.putText(img, confidence_text, (x1, y1-10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
            
            # Save annotated image
            if output_path is None:
                base, ext = os.path.splitext(image_path)
                output_path = f"{base}_faces{ext}"
            
            cv2.imwrite(output_path, img)
            logger.info(f"Saved annotated image with {len(faces)} faces to {output_path}")
            
            return output_path
            
        except Exception as e:
            logger.error(f"Error drawing face boxes: {str(e)}")
            return image_path


# Global instance for use in Django views
face_recognition_service = FaceRecognitionService()


def detect_faces_in_uploaded_image(image_instance):
    """
    Detect faces in a newly uploaded image
    
    Args:
        image_instance: Image model instance
        
    Returns:
        List of detected face data
    """
    try:
        image_path = image_instance.image_file.path
        faces = face_recognition_service.detect_faces_in_image(image_path)
        
        logger.info(f"Detected {len(faces)} faces in image {image_instance.title}")
        return faces
        
    except Exception as e:
        logger.error(f"Error detecting faces in uploaded image {image_instance.id}: {str(e)}")
        return []


def find_matching_faces_for_person(person, confidence_threshold=0.7):
    """
    Find all untagged faces that match a given person
    
    Args:
        person: Person model instance
        confidence_threshold: Minimum similarity threshold
        
    Returns:
        List of potential matches (FaceTag instances)
    """
    from .models import FaceTag, Image
    
    if not person.face_encoding:
        logger.warning(f"Person {person.name} has no face encoding")
        return []
    
    # Get all untagged face detections
    untagged_faces = FaceTag.objects.filter(
        person__isnull=True,  # No person assigned yet
        face_encoding__isnull=False  # Has face encoding
    )
    
    candidate_encodings = [
        (face.id, face.face_encoding) 
        for face in untagged_faces 
        if face.face_encoding
    ]
    
    # Find similar faces
    matches = face_recognition_service.find_similar_faces(
        person.face_encoding,
        candidate_encodings,
        confidence_threshold
    )
    
    # Return FaceTag instances for matches
    matching_face_tags = []
    for face_tag_id, similarity in matches:
        try:
            face_tag = FaceTag.objects.get(id=face_tag_id)
            face_tag.confidence_score = similarity  # Temporary attribute
            matching_face_tags.append(face_tag)
        except FaceTag.DoesNotExist:
            continue
    
    return matching_face_tags