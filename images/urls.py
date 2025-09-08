from django.urls import path
from . import views

urlpatterns = [
    # Image endpoints
    path('api/images/', views.ImageListCreateView.as_view(), name='image-list-create'),
    path('api/images/<int:pk>/', views.ImageDetailView.as_view(), name='image-detail'),
    path('api/images/<int:image_id>/comments/', views.CommentListCreateView.as_view(), name='comment-list-create'),
    path('api/comments/<int:comment_id>/reply/', views.create_reply, name='comment-reply'),
    
    # Authentication endpoints
    path('api/auth/csrf/', views.get_csrf_token, name='csrf-token'),
    path('api/auth/login/', views.login_view, name='login'),
    path('api/auth/logout/', views.logout_view, name='logout'),
    path('api/auth/profile/', views.user_profile_view, name='user-profile'),
]