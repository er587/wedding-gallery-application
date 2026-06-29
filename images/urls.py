from django.urls import path, re_path
from . import views
from django.views.generic import TemplateView
from django.conf import settings
import os

urlpatterns = [
    # Image endpoints
    path('api/images/', views.ImageListCreateView.as_view(), name='image-list-create'),
    path('api/images/<int:pk>/', views.ImageDetailView.as_view(), name='image-detail'),
    path('api/images/download/', views.bulk_download, name='bulk-download'),
    path('api/images/<int:image_id>/comments/', views.CommentListCreateView.as_view(), name='comment-list-create'),
    path('api/comments/<int:comment_id>/reply/', views.create_reply, name='comment-reply'),
    path('api/comments/<int:comment_id>/report/', views.report_comment, name='comment-report'),

    # Tag endpoints
    path('api/tags/', views.TagListView.as_view(), name='tag-list'),

    # Guest Book endpoints
    path('api/guestbook/', views.GuestBookListCreateView.as_view(), name='guestbook-list-create'),
    path('api/guestbook/<int:pk>/', views.delete_guestbook_entry, name='guestbook-delete'),
    
    # Like endpoints
    path('api/images/<int:image_id>/like/', views.toggle_like, name='toggle-like'),
    path('api/auth/liked-images/', views.user_liked_images, name='user-liked-images'),
    
    # Image stats endpoints
    path('api/images/count/', views.get_image_count, name='image-count'),
    path('api/auth/upload-count/', views.get_user_upload_count, name='user-upload-count'),

    # Site configuration (public wedding display content)
    path('api/site-config/', views.site_config, name='site-config'),

    # Image labeling agent API (agent key or staff session)
    path('api/labeling/queue/', views.labeling_queue, name='labeling-queue'),
    path('api/images/<int:image_id>/label-suggestions/', views.create_label_suggestion, name='label-suggestion-create'),
    path('api/label-suggestions/', views.list_label_suggestions, name='label-suggestion-list'),
    path('api/label-suggestions/<int:pk>/approve/', views.approve_label_suggestion, name='label-suggestion-approve'),
    path('api/label-suggestions/<int:pk>/reject/', views.reject_label_suggestion, name='label-suggestion-reject'),

    # Server-side (turnkey) Claude label generation into the same review queue
    path('api/images/<int:image_id>/suggest-labels/', views.suggest_labels, name='suggest-labels'),
    path('api/labeling/generate/', views.generate_labels_bulk, name='labeling-generate'),

    # Staff dashboard: stats + synchronous, client-driven batch runners
    path('api/labeling/stats/', views.labeling_stats, name='labeling-stats'),
    path('api/labeling/prompts/', views.labeling_prompts, name='labeling-prompts'),
    path('api/labeling/generate-batch/', views.generate_labels_batch, name='labeling-generate-batch'),
    path('api/labeling/match-people/', views.match_people_batch, name='labeling-match-people'),
    path('api/labeling/propagate/', views.propagate_labels_batch, name='labeling-propagate'),
    
    # Authentication endpoints
    path('api/auth/csrf/', views.get_csrf_token, name='csrf-token'),
    path('api/auth/login/', views.login_view, name='login'),
    path('api/auth/register/', views.register_view, name='register'),
    path('api/auth/logout/', views.logout_view, name='logout'),
    path('api/auth/profile/', views.user_profile_view, name='user-profile'),
    path('api/auth/profile/update/', views.update_profile, name='update-profile'),
    path('api/auth/change-password/', views.change_password, name='change-password'),
    
    # Email verification and password reset endpoints
    path('api/auth/send-verification/', views.send_verification_email, name='send-verification'),
    path('api/auth/verify-email/', views.verify_email, name='verify-email'),
    path('api/auth/request-password-reset/', views.request_password_reset, name='request-password-reset'),
    path('api/auth/reset-password/', views.reset_password, name='reset-password'),
    
    # Cloud Storage endpoints with authentication and access controls
    path('api/cloud/upload-url/', views.get_upload_url, name='get-upload-url'),
    path('api/cloud/set-acl/', views.set_file_acl, name='set-file-acl'),
    path('api/cloud/files/', views.list_user_files, name='list-user-files'),
    path('api/files/<path:file_path>', views.serve_protected_file, name='serve-protected-file'),
    
    # Auth-gated media: the gallery is invitation-only, so the image bytes
    # require a logged-in session (nginx serves them via X-Accel-Redirect).
    re_path(r'^media/(?P<path>.*)$', views.serve_protected_media, name='protected-media'),

    # Serve React frontend for all non-API and non-media routes
    re_path(r'^(?!(api/|media/|admin/)).*$', views.serve_frontend, name='frontend'),
]