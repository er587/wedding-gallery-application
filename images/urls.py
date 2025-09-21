from django.urls import path, re_path
from . import views
from django.views.generic import TemplateView
from django.conf import settings
import os

urlpatterns = [
    # Image endpoints
    path('api/images/', views.ImageListCreateView.as_view(), name='image-list-create'),
    path('api/images/<int:pk>/', views.ImageDetailView.as_view(), name='image-detail'),
    path('api/images/<int:image_id>/comments/', views.CommentListCreateView.as_view(), name='comment-list-create'),
    path('api/comments/<int:comment_id>/reply/', views.create_reply, name='comment-reply'),
    
    # Like endpoints
    path('api/images/<int:image_id>/like/', views.toggle_like, name='toggle-like'),
    path('api/auth/liked-images/', views.user_liked_images, name='user-liked-images'),
    
    # Authentication endpoints
    path('api/auth/csrf/', views.get_csrf_token, name='csrf-token'),
    path('api/auth/login/', views.login_view, name='login'),
    path('api/auth/register/', views.register_view, name='register'),
    path('api/auth/logout/', views.logout_view, name='logout'),
    path('api/auth/profile/', views.user_profile_view, name='user-profile'),
    path('api/auth/profile/update/', views.update_profile, name='update-profile'),
    path('api/auth/change-password/', views.change_password, name='change-password'),
    
    # Cloud Storage endpoints with authentication and access controls
    path('api/cloud/upload-url/', views.get_upload_url, name='get-upload-url'),
    path('api/cloud/set-acl/', views.set_file_acl, name='set-file-acl'),
    path('api/cloud/files/', views.list_user_files, name='list-user-files'),
    path('api/files/<path:file_path>', views.serve_protected_file, name='serve-protected-file'),
    
    # Serve React frontend for all non-API routes
    re_path(r'^(?!api/).*$', views.serve_frontend, name='frontend'),
]