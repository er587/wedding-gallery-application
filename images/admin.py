from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User, Group
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.urls import path
from django.contrib import messages
import csv
from .models import Image, Comment, Tag, UserProfile, InvitationCode, Like, EmailVerificationToken, PasswordResetToken


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
    actions = ['export_tags']
    
    def image_count(self, obj):
        return obj.images.count()
    image_count.short_description = 'Images Count'
    
    def export_tags(self, request, queryset):
        """Export selected tags to CSV"""
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="tags_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Tag Name'])
        
        for tag in queryset:
            writer.writerow([tag.name])
        
        return response
    export_tags.short_description = "Export selected tags to CSV"
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import/', self.import_tags_view, name='tags_import'),
        ]
        return custom_urls + urls
    
    def import_tags_view(self, request):
        """Custom view for importing tags from CSV"""
        if request.method == 'POST':
            csv_file = request.FILES.get('csv_file')
            
            if not csv_file:
                messages.error(request, 'Please select a CSV file to upload.')
                return redirect('..')
            
            if not csv_file.name.endswith('.csv'):
                messages.error(request, 'Please upload a valid CSV file.')
                return redirect('..')
            
            try:
                # Read CSV file
                decoded_file = csv_file.read().decode('utf-8').splitlines()
                reader = csv.DictReader(decoded_file)
                
                created_count = 0
                skipped_count = 0
                
                for row in reader:
                    tag_name = row.get('Tag Name', '').strip().lower()
                    
                    if tag_name:
                        tag, created = Tag.objects.get_or_create(name=tag_name)
                        if created:
                            created_count += 1
                        else:
                            skipped_count += 1
                
                messages.success(
                    request, 
                    f'Import complete! Created {created_count} new tags. Skipped {skipped_count} existing tags.'
                )
                
            except Exception as e:
                messages.error(request, f'Error importing tags: {str(e)}')
            
            return redirect('..')
        
        # GET request - show upload form
        context = {
            'site_title': 'Import Tags',
            'title': 'Import Tags from CSV',
            'opts': self.model._meta,
            'has_view_permission': self.has_view_permission(request),
        }
        return render(request, 'admin/tags_import.html', context)
    
    def changelist_view(self, request, extra_context=None):
        """Add import button to the changelist view"""
        extra_context = extra_context or {}
        extra_context['show_import_button'] = True
        return super().changelist_view(request, extra_context=extra_context)


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


@admin.register(InvitationCode)
class InvitationCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'role', 'is_active', 'usage_count', 'created_by', 'created_at', 'last_used_at']
    list_filter = ['role', 'is_active', 'created_at', 'last_used_at', 'created_by']
    search_fields = ['code', 'created_by__username', 'notes']
    readonly_fields = ['usage_count', 'last_used_at', 'created_at']
    fields = ['code', 'role', 'created_by', 'is_active', 'notes', 'created_at', 'usage_count', 'last_used_at']
    
    actions = ['generate_full_user_codes', 'generate_memory_user_codes']
    
    def generate_full_user_codes(self, request, queryset):
        """Admin action to generate Full User invitation codes"""
        count = 3
        created_codes = []
        
        for _ in range(count):
            code = InvitationCode.objects.create(
                code=InvitationCode.generate_code(),
                role='full',
                created_by=request.user,
                notes='Full User - Can upload, delete, and comment'
            )
            created_codes.append(code.code)
        
        self.message_user(request, f"Generated {count} Full User codes: {', '.join(created_codes)}")
    
    def generate_memory_user_codes(self, request, queryset):
        """Admin action to generate Memory User invitation codes"""
        count = 3
        created_codes = []
        
        for _ in range(count):
            code = InvitationCode.objects.create(
                code=InvitationCode.generate_code(),
                role='memory',
                created_by=request.user,
                notes='Memory User - Can only comment on images'
            )
            created_codes.append(code.code)
        
        self.message_user(request, f"Generated {count} Memory User codes: {', '.join(created_codes)}")
    
    generate_full_user_codes.short_description = "Generate 3 Full User invitation codes"
    generate_memory_user_codes.short_description = "Generate 3 Memory User invitation codes"


# Unregister and register Group with custom admin
admin.site.unregister(Group)
admin.site.register(Group, GroupAdmin)


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ['user', 'image', 'created_at']
    list_filter = ['created_at', 'image__uploader']
    search_fields = ['user__username', 'image__title']
    ordering = ['-created_at']
    raw_id_fields = ['user', 'image']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'image')


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'token_hash_preview', 'is_used', 'created_at', 'expires_at']
    list_filter = ['is_used', 'created_at', 'expires_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['token_hash', 'created_at']
    ordering = ['-created_at']
    
    def token_hash_preview(self, obj):
        return f"{obj.token_hash[:30]}..." if len(obj.token_hash) > 30 else obj.token_hash
    token_hash_preview.short_description = 'Token Hash'


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'token_hash_preview', 'is_used', 'created_at', 'expires_at']
    list_filter = ['is_used', 'created_at', 'expires_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['token_hash', 'created_at']
    ordering = ['-created_at']
    
    def token_hash_preview(self, obj):
        return f"{obj.token_hash[:30]}..." if len(obj.token_hash) > 30 else obj.token_hash
    token_hash_preview.short_description = 'Token Hash'