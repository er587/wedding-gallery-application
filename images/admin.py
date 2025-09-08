from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User, Group
from .models import Image, Comment, Tag, UserProfile


# Customize User admin to show groups and roles
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'
    extra = 0  # Don't show extra empty forms
    max_num = 1  # Only allow one profile per user


class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ['username', 'email', 'get_role', 'get_groups', 'is_staff', 'date_joined']
    list_filter = ['is_staff', 'is_superuser', 'profile__role', 'groups']
    
    def get_role(self, obj):
        return obj.profile.get_role_display() if hasattr(obj, 'profile') else 'No Profile'
    get_role.short_description = 'Role'
    
    def get_groups(self, obj):
        return ', '.join([g.name for g in obj.groups.all()]) or 'No Groups'
    get_groups.short_description = 'Groups'


# Unregister default User admin and register custom one
admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'can_upload_images', 'can_delete_images', 'created_at']
    list_filter = ['role', 'created_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['can_upload_images', 'can_delete_images', 'can_comment']


@admin.register(Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ['title', 'uploader', 'get_uploader_role', 'tag_list', 'uploaded_at']
    list_filter = ['uploaded_at', 'uploader__profile__role', 'tags']
    search_fields = ['title', 'description', 'uploader__username']
    filter_horizontal = ['tags']
    readonly_fields = ['uploaded_at', 'updated_at']
    
    def get_uploader_role(self, obj):
        return obj.uploader.profile.get_role_display() if hasattr(obj.uploader, 'profile') else 'No Profile'
    get_uploader_role.short_description = 'Uploader Role'
    
    def tag_list(self, obj):
        return ', '.join([tag.name for tag in obj.tags.all()]) or 'No Tags'
    tag_list.short_description = 'Tags'


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['content_preview', 'author', 'get_author_role', 'image', 'is_reply', 'created_at']
    list_filter = ['created_at', 'author__profile__role']
    search_fields = ['content', 'author__username', 'image__title']
    readonly_fields = ['created_at', 'updated_at', 'is_reply']
    
    def content_preview(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'
    
    def get_author_role(self, obj):
        return obj.author.profile.get_role_display() if hasattr(obj.author, 'profile') else 'No Profile'
    get_author_role.short_description = 'Author Role'


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at', 'image_count']
    search_fields = ['name']
    readonly_fields = ['created_at']
    
    def image_count(self, obj):
        return obj.images.count()
    image_count.short_description = 'Images Count'


# Customize Group admin to show users
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'user_count', 'user_list']
    
    def user_count(self, obj):
        return obj.user_set.count()
    user_count.short_description = 'Users Count'
    
    def user_list(self, obj):
        users = obj.user_set.all()[:5]  # Show first 5 users
        user_names = [u.username for u in users]
        if obj.user_set.count() > 5:
            user_names.append(f'... +{obj.user_set.count() - 5} more')
        return ', '.join(user_names) or 'No Users'
    user_list.short_description = 'Users'


# Unregister and register Group with custom admin
admin.site.unregister(Group)
admin.site.register(Group, GroupAdmin)