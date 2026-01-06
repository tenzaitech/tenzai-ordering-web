# Menu Image Standard

## Overview

This document describes the unified image storage and processing pipeline for menu images in the Tenzai ordering system.

## Storage Path Convention

All menu images use **menu_code as the stable identifier** in storage paths:

```
menu/{menu_code}/orig.webp           # Original (rotated, high-quality)
menu/{menu_code}/1x1_v{timestamp}.webp   # 1:1 derivative (versioned)
menu/{menu_code}/4x3_v{timestamp}.webp   # 4:3 derivative (versioned)
```

### Why menu_code instead of name slugs?

- **Unicode-safe**: menu_code is guaranteed ASCII, avoiding Thai/Unicode encoding issues
- **Stable**: menu_code never changes; names can be edited without breaking images
- **Safe deletion**: Each menu has its own folder → list folder and delete all
- **Human-readable**: menu_code is meaningful in storage browser

### Examples

```
menu/DRINK001/orig.webp
menu/DRINK001/1x1_v1704620000000.webp
menu/DRINK001/4x3_v1704620000000.webp

menu/FOOD_TOM_YUM/orig.webp
menu/FOOD_TOM_YUM/4x3_v1704620000001.webp
```

## Derivative Specifications

| Aspect | Width | Height | Use Case |
|--------|-------|--------|----------|
| 4:3 | 1440px | 1080px | Card view, product pages (canonical) |
| 1:1 | 1024px | 1024px | Square thumbnails, LINE messages |

The **4:3 derivative URL is stored in `menu_items.image_url`** (canonical).

## Processing Pipeline

Both auto and manual modes use the same pipeline in `lib/image-pipeline.ts`:

### Auto Mode (default)
1. **Rotate**: Auto-orient based on EXIF
2. **Smart Trim**: Detect and remove empty edges (white/flat backgrounds)
3. **Center Crop**: Crop to target aspect ratio from center
4. **Resize**: Scale to target dimensions
5. **WebP**: Encode at 80% quality

### Manual Mode
1. **Rotate**: Auto-orient based on EXIF
2. **Extract**: Use user-specified crop box (normalized 0-1 coordinates)
3. **Resize**: Scale to target dimensions
4. **WebP**: Encode at 80% quality

## API Endpoints

### Unified Menu Image API
`POST /api/admin/menu-image`
- Upload and process image for a menu item
- Supports both auto and manual crop modes
- FormData: `file`, `menu_code`, optional `manual_crop_4x3`, `manual_crop_1x1`

`DELETE /api/admin/menu-image`
- Remove all images for a menu item
- Body: `{ menu_code: string }`

### Image Import (Bulk)
`POST /api/admin/image-import/apply`
- Bulk import images with filename-to-menu_code mapping
- Supports crop settings per file

`POST /api/admin/image-import/preview-processed`
- Generate WYSIWYG preview without saving

`POST /api/admin/image-import/regenerate`
- Re-generate derivatives from existing original

## Safe Deletion Pattern

To prevent data loss, deletion follows this order:

1. **Upload all new files** (orig + derivatives)
2. **Update database** (set new image_url)
3. **Delete old derivatives** (only after success)

If any step fails, the old image_url remains valid.

## Data Invariants

### Database (menu_items)
- `image_url` always points to latest 4:3 versioned derivative
- `menu_code` is the only identity key

### Storage (menu-images bucket)
- Exactly one `orig.webp` per menu_code
- Derivatives are versioned (`{aspect}_v{timestamp}.webp`)
- Old derivatives are deleted on successful apply/upload

## Structured Logging

All image operations log structured JSON:

```json
{
  "operation": "apply|upload|regenerate|delete",
  "menu_code": "DRINK001",
  "old_url": "https://...",
  "new_url": "https://...",
  "deleted_count": 2,
  "mode": "auto|manual",
  "success": true
}
```

Search logs with: `[IMAGE_OP]`

## How admin/menu and image-import relate

| Feature | admin/menu | image-import |
|---------|------------|--------------|
| Use case | Single item edit | Bulk import |
| API | `/api/admin/menu-image` | `/api/admin/image-import/*` |
| Pipeline | `lib/image-pipeline.ts` | `lib/image-pipeline.ts` |
| Storage paths | `menu/{menu_code}/...` | `menu/{menu_code}/...` |
| Crop support | Auto + Manual | Auto + Manual |
| Preview | Uses preview-processed | Uses preview-processed |

Both use the **same pipeline** and **same storage convention**.

## Verification Checklist

### Quick Verification (5 minutes)

1. **Upload test**: Go to admin/menu, edit any item, upload a new image
   - Verify preview shows processed result
   - Verify save succeeds
   - Verify old derivatives are deleted

2. **Storage check**: In Supabase Storage browser, verify:
   - Files are at `menu/{menu_code}/orig.webp`
   - Derivatives have version suffix: `4x3_v{timestamp}.webp`

3. **DB check**: Query `SELECT menu_code, image_url FROM menu_items WHERE image_url IS NOT NULL LIMIT 5`
   - Verify URLs contain menu_code and version suffix

4. **Thai name test**: Edit a menu with Thai name, upload image
   - Should succeed (menu_code is used, not name)

### Log Verification

```bash
# Search for image operations
grep "[IMAGE_OP]" /path/to/logs

# Example output:
[IMAGE_OP] {"operation":"upload","menu_code":"DRINK001","old_url":"...","new_url":"...","deleted_count":2,"mode":"auto","success":true}
```

## Migration Notes

### Old Path Format (deprecated)
```
menu/{category_slug}/{menu_slug}__orig_v{timestamp}.webp
menu/{category_slug}/{menu_slug}__4x3_v{timestamp}.webp
```

### New Path Format (current)
```
menu/{menu_code}/orig.webp
menu/{menu_code}/4x3_v{timestamp}.webp
```

Old files in the deprecated format will remain until the menu is re-uploaded.
