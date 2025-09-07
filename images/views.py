from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth.models import User
from .models import Image, Comment
from .serializers import ImageSerializer, ImageCreateSerializer, CommentSerializer, UserSerializer


class ImageListCreateView(generics.ListCreateAPIView):
    queryset = Image.objects.all()
    permission_classes = [permissions.AllowAny]  # Temporarily allow uploads for testing
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ImageCreateSerializer
        return ImageSerializer
    
    def perform_create(self, serializer):
        # Use the test user if no user is authenticated
        from django.contrib.auth.models import User
        user = self.request.user if self.request.user.is_authenticated else User.objects.get(username='testuser')
        serializer.save(uploader=user)


class ImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Image.objects.all()
    serializer_class = ImageSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()


class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.AllowAny]  # Temporarily allow comments for testing
    
    def get_queryset(self):
        image_id = self.kwargs.get('image_id')
        return Comment.objects.filter(image_id=image_id, parent=None)
    
    def perform_create(self, serializer):
        image_id = self.kwargs.get('image_id')
        image = Image.objects.get(id=image_id)
        # Use the test user if no user is authenticated
        from django.contrib.auth.models import User
        user = self.request.user if self.request.user.is_authenticated else User.objects.get(username='testuser')
        serializer.save(author=user, image=image)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # Temporarily allow replies for testing
def create_reply(request, comment_id):
    try:
        parent_comment = Comment.objects.get(id=comment_id)
        serializer = CommentSerializer(data=request.data)
        if serializer.is_valid():
            # Use the test user if no user is authenticated
            from django.contrib.auth.models import User
            user = request.user if request.user.is_authenticated else User.objects.get(username='testuser')
            serializer.save(
                author=user,
                image=parent_comment.image,
                parent=parent_comment
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Comment.DoesNotExist:
        return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)