from django.urls import path
from . import views, face_views

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
    
    # Face tagging endpoints
    path('api/images/<int:image_id>/detect-faces/', face_views.detect_faces_in_image, name='detect-faces'),
    path('api/images/<int:image_id>/face-tags/', face_views.FaceTagListCreateView.as_view(), name='face-tag-list-create'),
    path('api/images/<int:image_id>/suggest-tags/', face_views.suggest_auto_tags, name='suggest-auto-tags'),
    path('api/face-tags/<int:pk>/', face_views.FaceTagDetailView.as_view(), name='face-tag-detail'),
    path('api/people/', face_views.PersonListCreateView.as_view(), name='person-list-create'),
    path('api/people/<int:pk>/', face_views.PersonDetailView.as_view(), name='person-detail'),
    path('api/apply-auto-tag/', face_views.apply_auto_tag_suggestion, name='apply-auto-tag'),
    
    # Admin face tagging endpoints
    path('api/admin/pending-tags/', face_views.pending_tags_list, name='admin-pending-tags'),
    path('api/admin/face-tags/<int:tag_id>/approve/', face_views.approve_face_tag, name='admin-approve-tag'),
    path('api/admin/face-tags/<int:tag_id>/reject/', face_views.reject_face_tag, name='admin-reject-tag'),
    path('api/admin/bulk-approve-tags/', face_views.bulk_approve_tags, name='admin-bulk-approve'),
]