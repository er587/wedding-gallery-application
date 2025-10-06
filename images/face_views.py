"""
API Views for Face Tagging System
Handles face detection, tagging, auto-suggestions, and admin approval
"""

from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
import logging

from .models import Image, Person, FaceTag
from .serializers import (
    PersonSerializer, FaceTagSerializer, FaceDetectionResultSerializer, 
    AutoTagSuggestionSerializer
)
from .face_recognition_utils import face_recognition_service, detect_faces_in_uploaded_image

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def detect_faces_in_image(request, image_id):
    """
    Detect faces in a specific image
    POST /api/images/{image_id}/detect-faces/
    """
    try:
        image = get_object_or_404(Image, id=image_id)
        
        # Detect faces using our face recognition service
        faces = detect_faces_in_uploaded_image(image)
        
        if not faces:
            return Response({
                'faces': [],
                'image_id': image_id,
                'face_count': 0,
                'message': 'No faces detected in this image'
            })
        
        # Return face detection results only (don't persist FaceTag records yet)
        # FaceTag records will be created when user actually tags a face
        
        response_data = {
            'faces': faces,
            'image_id': image_id,
            'face_count': len(faces)
        }
        
        serializer = FaceDetectionResultSerializer(response_data)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error detecting faces in image {image_id}: {str(e)}")
        return Response(
            {'error': 'Face detection failed', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class PersonListCreateView(generics.ListCreateAPIView):
    """
    List all people or create a new person
    GET/POST /api/people/
    """
    serializer_class = PersonSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Show all people created by any user (for tagging purposes)
        return Person.objects.all()
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class PersonDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a person
    GET/PUT/DELETE /api/people/{id}/
    """
    queryset = Person.objects.all()
    serializer_class = PersonSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_permissions(self):
        """Only allow modifications by person creator or admin"""
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            if not (self.request.user.is_staff or 
                   self.get_object().created_by == self.request.user):
                return [permissions.IsAdminUser()]
        return super().get_permissions()


class FaceTagListCreateView(generics.ListCreateAPIView):
    """
    List face tags or create new face tag
    GET/POST /api/images/{image_id}/face-tags/
    """
    serializer_class = FaceTagSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        image_id = self.kwargs['image_id']
        image = get_object_or_404(Image, id=image_id)
        
        # Show different tags based on user permissions
        if self.request.user.is_staff:
            # Admins see all tags
            return FaceTag.objects.filter(image=image)
        else:
            # Regular users only see approved tags
            return FaceTag.objects.filter(image=image, status='approved')
    
    def perform_create(self, serializer):
        image_id = self.kwargs['image_id'] 
        image = get_object_or_404(Image, id=image_id)
        serializer.save(image=image, tagged_by=self.request.user)
    
    def create(self, request, *args, **kwargs):
        """Enhanced create with face encoding generation"""
        try:
            # Get the image for face encoding
            image_id = self.kwargs['image_id']
            image = get_object_or_404(Image, id=image_id)
            
            # Create the face tag
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            face_tag = serializer.save(image=image, tagged_by=request.user)
            
            # Generate face encoding if not provided
            if not face_tag.face_encoding:
                try:
                    # Extract face encoding from image at specified location
                    faces = detect_faces_in_uploaded_image(image)
                    
                    # Find the closest detected face to this tag location
                    min_distance = float('inf')
                    best_encoding = None
                    
                    for face_data in faces:
                        distance = abs(face_data['x'] - face_tag.face_x) + abs(face_data['y'] - face_tag.face_y)
                        if distance < min_distance:
                            min_distance = distance
                            best_encoding = face_data['encoding']
                    
                    if best_encoding:
                        face_tag.face_encoding = best_encoding
                        face_tag.save()
                        
                        # Update person's face encoding if it's their first tag
                        person = face_tag.person
                        if not person.face_encoding:
                            person.face_encoding = best_encoding
                            person.save()
                    
                except Exception as e:
                    logger.error(f"Failed to generate face encoding for tag {face_tag.id}: {str(e)}")
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            
        except Exception as e:
            logger.error(f"Error creating face tag: {str(e)}")
            return Response(
                {'error': 'Failed to create face tag', 'details': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class FaceTagDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a face tag
    GET/PUT/DELETE /api/face-tags/{id}/
    """
    queryset = FaceTag.objects.all()
    serializer_class = FaceTagSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_permissions(self):
        """Only allow modifications by tag creator or admin"""
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            obj = self.get_object()
            if not (self.request.user.is_staff or obj.tagged_by == self.request.user):
                return [permissions.IsAdminUser()]
        return super().get_permissions()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def suggest_auto_tags(request, image_id):
    """
    Get auto-tagging suggestions for an image based on similar faces
    POST /api/images/{image_id}/suggest-tags/
    """
    try:
        image = get_object_or_404(Image, id=image_id)
        
        # Get all untagged faces in this image
        untagged_faces = FaceTag.objects.filter(
            image=image,
            person__isnull=True,
            face_encoding__isnull=False
        )
        
        if not untagged_faces.exists():
            return Response({
                'suggestions': [],
                'message': 'No untagged faces found in this image'
            })
        
        # Get all people with face encodings for comparison
        people_with_encodings = Person.objects.exclude(face_encoding__isnull=True)
        
        suggestions = []
        
        for face_tag in untagged_faces:
            face_suggestions = []
            
            for person in people_with_encodings:
                is_match, similarity = face_recognition_service.compare_faces(
                    face_tag.face_encoding,
                    person.face_encoding,
                    threshold=0.6  # Lower threshold for suggestions
                )
                
                if is_match:
                    face_suggestions.append({
                        'person_id': person.id,
                        'person_name': person.name,
                        'confidence_score': similarity,
                        'face_tag_id': face_tag.id,
                        'face_location': {
                            'x': face_tag.face_x,
                            'y': face_tag.face_y,
                            'width': face_tag.face_width,
                            'height': face_tag.face_height
                        }
                    })
            
            # Sort by confidence and take top 3 suggestions per face
            face_suggestions.sort(key=lambda x: x['confidence_score'], reverse=True)
            suggestions.extend(face_suggestions[:3])
        
        return Response({
            'suggestions': suggestions,
            'image_id': image_id,
            'untagged_face_count': untagged_faces.count()
        })
        
    except Exception as e:
        logger.error(f"Error generating auto-tag suggestions for image {image_id}: {str(e)}")
        return Response(
            {'error': 'Failed to generate suggestions', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def apply_auto_tag_suggestion(request):
    """
    Apply an auto-tagging suggestion
    POST /api/apply-auto-tag/
    Body: { "face_tag_id": int, "person_id": int, "confidence": float }
    """
    try:
        face_tag_id = request.data.get('face_tag_id')
        person_id = request.data.get('person_id')
        confidence = request.data.get('confidence', 0.0)
        
        if not face_tag_id or not person_id:
            return Response(
                {'error': 'face_tag_id and person_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        face_tag = get_object_or_404(FaceTag, id=face_tag_id)
        person = get_object_or_404(Person, id=person_id)
        
        # Update face tag with person assignment
        with transaction.atomic():
            face_tag.person = person
            face_tag.confidence_score = confidence
            face_tag.is_auto_generated = True
            face_tag.status = 'pending'  # Still needs admin approval
            face_tag.save()
        
        return Response({
            'message': 'Auto-tag applied successfully',
            'face_tag_id': face_tag_id,
            'person': person.name,
            'status': 'pending'
        })
        
    except Exception as e:
        logger.error(f"Error applying auto-tag: {str(e)}")
        return Response(
            {'error': 'Failed to apply auto-tag', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Admin Views for Tag Approval

@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def pending_tags_list(request):
    """
    List all pending face tags for admin review
    GET /api/admin/pending-tags/
    """
    try:
        pending_tags = FaceTag.objects.filter(status='pending').select_related(
            'image', 'person', 'tagged_by'
        ).order_by('-created_at')
        
        # Paginate results
        page_size = int(request.GET.get('page_size', 20))
        page = int(request.GET.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        serializer = FaceTagSerializer(
            pending_tags[start:end], 
            many=True,
            context={'request': request}
        )
        
        return Response({
            'results': serializer.data,
            'count': pending_tags.count(),
            'page': page,
            'page_size': page_size,
            'has_next': end < pending_tags.count()
        })
        
    except Exception as e:
        logger.error(f"Error listing pending tags: {str(e)}")
        return Response(
            {'error': 'Failed to load pending tags'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def approve_face_tag(request, tag_id):
    """
    Approve a face tag
    POST /api/admin/face-tags/{tag_id}/approve/
    """
    try:
        face_tag = get_object_or_404(FaceTag, id=tag_id)
        
        face_tag.approve(request.user)
        
        return Response({
            'message': 'Face tag approved successfully',
            'tag_id': tag_id,
            'status': 'approved'
        })
        
    except Exception as e:
        logger.error(f"Error approving face tag {tag_id}: {str(e)}")
        return Response(
            {'error': 'Failed to approve tag'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def reject_face_tag(request, tag_id):
    """
    Reject a face tag
    POST /api/admin/face-tags/{tag_id}/reject/
    """
    try:
        face_tag = get_object_or_404(FaceTag, id=tag_id)
        
        face_tag.reject(request.user)
        
        return Response({
            'message': 'Face tag rejected successfully',
            'tag_id': tag_id,
            'status': 'rejected'
        })
        
    except Exception as e:
        logger.error(f"Error rejecting face tag {tag_id}: {str(e)}")
        return Response(
            {'error': 'Failed to reject tag'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def bulk_approve_tags(request):
    """
    Bulk approve multiple face tags
    POST /api/admin/bulk-approve-tags/
    Body: { "tag_ids": [1, 2, 3, ...] }
    """
    try:
        tag_ids = request.data.get('tag_ids', [])
        
        if not tag_ids:
            return Response(
                {'error': 'tag_ids array is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Approve all tags in bulk
        with transaction.atomic():
            updated_count = 0
            for tag_id in tag_ids:
                try:
                    face_tag = FaceTag.objects.get(id=tag_id)
                    face_tag.approve(request.user)
                    updated_count += 1
                except FaceTag.DoesNotExist:
                    continue
        
        return Response({
            'message': f'Successfully approved {updated_count} face tags',
            'approved_count': updated_count,
            'requested_count': len(tag_ids)
        })
        
    except Exception as e:
        logger.error(f"Error bulk approving tags: {str(e)}")
        return Response(
            {'error': 'Failed to bulk approve tags'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )