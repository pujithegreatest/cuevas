# Apple & Google Wallet Pass Design Guide

## For Adobe Creative Suite (Illustrator, Photoshop, InDesign)

---

## Quick Start

1. **Open the PDF template** in Adobe Illustrator (File → Open)
2. **Create new document** at the exact pixel dimensions
3. **Design at @3x resolution** (largest size)
4. **Export as PNG** with transparency where needed
5. **Scale down** to create @2x and @1x versions

---

## Apple Wallet Image Specifications

### Strip Image (Main Banner)

The large image displayed across the center of the pass.

| Pass Type | Size (@3x) | Size (@2x) | Size (@1x) |
|-----------|------------|------------|------------|
| **Standard** (Store Cards, Generic) | 1125 × 369 px | 750 × 246 px | 375 × 123 px |
| **Coupons / Gift Cards** | 1125 × 432 px | 750 × 288 px | 375 × 144 px |
| **Event Tickets** | 1125 × 294 px | 750 × 196 px | 375 × 98 px |

**Adobe Settings:**
- Document: 1125 × 369 px (or variant)
- Color Mode: RGB
- Resolution: 72 PPI (pixels are the unit, not inches)
- Export: PNG-24 with transparency if needed

---

### Logo (Top Left Corner)

| Version | Size |
|---------|------|
| @3x | 480 × 150 px |
| @2x | 320 × 100 px |
| @1x | 160 × 50 px |

**Tips:**
- Keep it narrower than max width for best display
- Use transparent background (PNG)
- Simple, recognizable design
- Test on both light and dark backgrounds

---

### Icon (Lock Screen & Notifications)

| Version | Size |
|---------|------|
| @3x | 87 × 87 px |
| @2x | 58 × 58 px |
| @1x | 29 × 29 px |

*Some sources recommend 114 × 114 px for best quality*

**Tips:**
- Square format only
- Simple, bold design
- Visible at small sizes
- Often same as app icon

---

### Thumbnail (Generic Passes Only)

| Version | Size |
|---------|------|
| @3x | 270 × 270 px |
| @2x | 180 × 180 px |
| @1x | 90 × 90 px |

**Tips:**
- Aspect ratio should be between 2:3 and 3:2
- Displayed next to fields on pass front
- Not used on all pass types

---

### Background (Full Pass Background)

| Version | Size |
|---------|------|
| @3x | 540 × 660 px |
| @2x | 360 × 440 px |
| @1x | 180 × 220 px |

**Tips:**
- Gets slightly cropped and blurred
- Use subtle patterns or gradients
- Don't put important content near edges

---

### Footer (Boarding Passes Only)

| Version | Size |
|---------|------|
| @3x | 858 × 45 px |
| @2x | 572 × 30 px |
| @1x | 286 × 15 px |

---

## Google Wallet Image Specifications

### Hero Image (Main Banner)

| Size | Notes |
|------|-------|
| 1125 × 432 px | Same as Apple coupon strip |

**Tip:** Design once, use for both platforms!

---

### Logo (Square, Circle-Masked)

| Size | Notes |
|------|-------|
| **Recommended:** 660 × 660 px | Minimum |
| **Maximum:** 840 × 840 px | Best quality |

**CRITICAL: Safe Area**
- Google masks the logo into a circle
- Keep all content within 85% of the image (15% margin)
- Don't pre-mask - upload as square
- Use full bleed background color

```
┌─────────────────────┐
│                     │
│   ┌───────────┐     │
│   │           │     │  ← 15% margin
│   │  LOGO     │     │
│   │  HERE     │     │
│   │           │     │
│   └───────────┘     │
│                     │
└─────────────────────┘
     Safe Area (85%)
```

---

### Wide Banner (Optional)

| Size | Notes |
|------|-------|
| 1860 px wide | Variable height |

- Appears below the pass
- Use for additional branding or information

---

## File Naming Convention

For Apple Wallet, you need multiple versions:

```
icon.png        (29 × 29)
icon@2x.png     (58 × 58)
icon@3x.png     (87 × 87)

logo.png        (160 × 50)
logo@2x.png     (320 × 100)
logo@3x.png     (480 × 150)

strip.png       (375 × 123)
strip@2x.png    (750 × 246)
strip@3x.png    (1125 × 369)

thumbnail.png   (90 × 90)
thumbnail@2x.png (180 × 180)
thumbnail@3x.png (270 × 270)

background.png  (180 × 220)
background@2x.png (360 × 440)
background@3x.png (540 × 660)
```

---

## Adobe Illustrator Workflow

### Creating New Documents

1. **File → New**
2. Set units to **Pixels**
3. Enter exact dimensions (e.g., 1125 × 369)
4. Color Mode: **RGB**
5. Raster Effects: **72 PPI**

### Exporting for Multiple Sizes

**Method 1: Export for Screens**
1. File → Export → Export for Screens
2. Add multiple scales: 1x, 2x, 3x
3. Format: PNG
4. Export

**Method 2: Asset Export Panel**
1. Window → Asset Export
2. Drag artwork to panel
3. Add scale variants
4. Click Export

### Export Settings
- Format: PNG
- Anti-aliasing: Art Optimized
- Background: Transparent (for logos)

---

## Adobe Photoshop Workflow

### Creating New Documents

1. **File → New**
2. Preset: Custom
3. Width/Height: Exact pixel dimensions
4. Resolution: 72 Pixels/Inch
5. Color Mode: RGB Color, 8 bit
6. Background: Transparent

### Exporting Multiple Sizes

1. **File → Export → Export As**
2. Format: PNG
3. Scale: 100% (for @3x)
4. Export

For @2x and @1x:
1. **Image → Image Size**
2. Resample: Bicubic Sharper (reduction)
3. Scale to target size
4. Export again

---

## Design Best Practices

### DO ✓
- Design at @3x first, scale down
- Use PNG format
- Keep logos simple and recognizable
- Test on actual devices
- Use transparent backgrounds for logos
- Keep Google logos in safe area
- Use high-contrast imagery for strip

### DON'T ✗
- Embed text in images (gets cropped/unreadable)
- Use complex gradients that don't scale well
- Add padding to images (watchOS crops whitespace)
- Pre-mask Google logos into circles
- Use device-specific language in designs
- Put critical info at image edges

---

## Pass Types & Their Images

| Pass Type | Images Used |
|-----------|-------------|
| **Boarding Pass** | Logo, Footer |
| **Coupon** | Logo, Strip (432px height) |
| **Event Ticket** | Logo, Strip (294px height), Background, Thumbnail |
| **Store Card** | Logo, Strip (369px height) |
| **Generic** | Logo, Thumbnail |

---

## Color Customization

Apple Wallet passes support custom colors (defined in pass.json):

- **backgroundColor**: Pass background (ignored if background image exists)
- **foregroundColor**: Field content text
- **labelColor**: Field label text

Format: `rgb(R, G, B)` e.g., `rgb(255, 255, 255)`

---

## Resources

- [Apple Human Interface Guidelines - Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet)
- [Apple PassKit Documentation](https://developer.apple.com/documentation/passkit)
- [Google Wallet Pass Builder](https://developers.google.com/wallet)
- [react-native-wallet](https://github.com/premieroctet/react-native-wallet)

---

## Checklist Before Export

- [ ] All images at correct dimensions
- [ ] PNG format
- [ ] @1x, @2x, @3x versions created
- [ ] Transparent backgrounds where needed
- [ ] No embedded text in images
- [ ] Google logo has 15% margin
- [ ] Tested on device simulator
- [ ] File names follow convention
