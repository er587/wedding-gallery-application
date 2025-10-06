from easy_thumbnails.processors import colorspace
from PIL import Image as PILImage


def face_aware_crop(im, **kwargs):
    """
    Custom easy-thumbnails processor that crops images based on stored face coordinates.
    
    This processor reads face detection coordinates stored in the Image model
    and uses them to create intelligent crops that keep faces centered.
    
    If no face data is available and crop is requested, returns the image unchanged
    so scale_and_crop processor can handle it.
    """
    # Get face coordinates from kwargs (passed from serializer)
    face_x = kwargs.get('face_x')
    face_y = kwargs.get('face_y')
    face_width = kwargs.get('face_width')
    face_height = kwargs.get('face_height')
    
    # Get size from kwargs
    size = kwargs.get('size')
    crop = kwargs.get('crop', False)
    
    # If no face detected or crop not requested, return unchanged so other processors can handle it
    # Require all four face coordinates to be present (None check for all)
    if not crop or not size or face_x is None or face_y is None or face_width is None or face_height is None:
        return im
    
    # Get target dimensions
    target_width, target_height = size
    img_width, img_height = im.size
    
    # Calculate aspect ratios
    img_ratio = img_width / img_height
    target_ratio = target_width / target_height
    
    # Determine crop dimensions to match target aspect ratio
    if img_ratio > target_ratio:
        # Image is wider than target - crop width
        crop_height = img_height
        crop_width = int(crop_height * target_ratio)
    else:
        # Image is taller than target - crop height
        crop_width = img_width
        crop_height = int(crop_width / target_ratio)
    
    # Convert normalized face coordinates to pixel coordinates
    face_center_x = int(face_x * img_width)
    face_center_y = int(face_y * img_height)
    
    # Calculate crop box centered on face
    half_width = crop_width // 2
    half_height = crop_height // 2
    
    # Initial crop box
    left = face_center_x - half_width
    top = face_center_y - half_height
    right = left + crop_width
    bottom = top + crop_height
    
    # Adjust if crop box exceeds image boundaries
    if left < 0:
        right -= left
        left = 0
    if right > img_width:
        left -= (right - img_width)
        right = img_width
    if top < 0:
        bottom -= top
        top = 0
    if bottom > img_height:
        top -= (bottom - img_height)
        bottom = img_height
    
    # Ensure we stay within bounds
    left = max(0, left)
    top = max(0, top)
    right = min(img_width, right)
    bottom = min(img_height, bottom)
    
    # Perform the crop
    im = im.crop((left, top, right, bottom))
    
    # Resize to target size
    im = im.resize(size, PILImage.Resampling.LANCZOS)
    
    return im


def center_crop(im, requested_size, opts):
    """
    Fallback center crop processor when no face is detected.
    """
    if not opts.get('crop'):
        return colorspace(im)
    
    target_width, target_height = requested_size
    img_width, img_height = im.size
    
    # Calculate aspect ratios
    img_ratio = img_width / img_height
    target_ratio = target_width / target_height
    
    # Determine crop dimensions
    if img_ratio > target_ratio:
        crop_height = img_height
        crop_width = int(crop_height * target_ratio)
    else:
        crop_width = img_width
        crop_height = int(crop_width / target_ratio)
    
    # Center crop
    left = (img_width - crop_width) // 2
    top = (img_height - crop_height) // 2
    right = left + crop_width
    bottom = top + crop_height
    
    im = im.crop((left, top, right, bottom))
    im = im.resize(requested_size, PILImage.Resampling.LANCZOS)
    
    return im
