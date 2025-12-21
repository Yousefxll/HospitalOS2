# PWA Setup Instructions

## Icon Files Required

For full PWA support, you need to add icon files to the `public` folder:

1. **icon-192.png** - 192x192 pixels
2. **icon-512.png** - 512x512 pixels

### Creating Icons

You can create these icons from your app logo:

1. Use an image editing tool (Photoshop, Figma, etc.)
2. Create square icons with transparent backgrounds (or solid color backgrounds)
3. Export as PNG format
4. Ensure icons are:
   - 192x192 pixels for icon-192.png
   - 512x512 pixels for icon-512.png
   - Optimized for web (compressed)

### Quick Option

If you don't have icons ready, you can use online tools:
- https://www.favicon-generator.org/
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

### Testing PWA

1. Build and deploy your app
2. On mobile device, open the app in browser
3. Look for "Add to Home Screen" prompt (iOS Safari) or install prompt (Android Chrome)
4. The app should install and launch in standalone mode

### Manifest Configuration

The manifest is already configured at `public/manifest.webmanifest` with:
- App name: "Hospital OS - Hospital Operations Platform"
- Theme color: #1e40af (blue)
- Display mode: standalone
- Orientation: portrait-primary

You can customize these settings in `public/manifest.webmanifest` if needed.

