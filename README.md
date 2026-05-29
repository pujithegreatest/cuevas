# Cuevas Crypto Rewards App

A modern crypto rewards and social media app built with React Native and Expo.

## Run / Test

### Local dev server

- Install deps: `bun install`
- Start Metro: `bunx expo start`

### Expo Go vs Development Build

This app includes native dependencies (for example `react-native-vision-camera`), so it will typically **not** run inside the standard **Expo Go** client.

- If you want to try anyway: `bun run start:go` and scan with Expo Go
- Recommended: use a **development build** (custom dev client) + `bun run start:dev-client`

### EAS (builds + dev client)

`eas.json` is included. To build a dev client you still need an Expo account and EAS login:

- Install EAS CLI: `npm i -g eas-cli`
- Login: `eas login`
- Create/link the EAS project: `eas init`
- Build dev client:
  - iOS: `eas build --profile development --platform ios`
  - Android: `eas build --profile development --platform android`
- After installing the build on your phone, run: `bun run start:dev-client`

## Features

### 🎨 Modern Design
- Clean, modern crypto app aesthetic
- Smooth gradient backgrounds
- Rounded cards with shadows
- Beautiful dark mode with excellent contrast
- Bottom tab navigation for seamless switching

### 📸 Stories (Scifi Editor)
- Stories row at the top of the feed with gradient ring for unviewed
- Tap your avatar to view your existing stories, tap the **+ badge** to add another
- Pick **photo or video** from camera or library (max 15s clip)
- **In-app scifi camera** with custom HUD: PHOTO / VIDEO mode toggle, animated red ring + countdown timer during recording, corner brackets, REC indicator, hard-capped at 15s
- **Video trimmer** after capture/selection: filmstrip preview with dual drag handles, live playback inside the trim range, max 15s output
- **Skia color-matrix filters** on images: Original, Neon, Heatwave, Hologram, Vaporwave, Infrared, Matrix, Glitch, Void, Noir, Sepia, Acid, Arctic, Dream, X-Ray, **Thermal** (FLIR-style heat map + REC label), **Predator** (alien-vision red tint + crosshair scanlines), **Scanner** (cyan grid + moving scan line), **Chrome** (silvery light gradient), **Toxic/Radioactive** (radiation green + interlace bands) — 20 total
- **Drawing pen** in story + photo editor: tap brush to draw freehand on top of the image, 6-color palette, undo last stroke, clear all
- **Stickers**: 10 fast-tap stickers (live timestamp, location pin, fire, heart, lightning, skull, star, alien, robot, moon) — pan / pinch / rotate just like text
- **Tinted filters on video**: matching color overlays since color-matrix only runs on stills
- **Filter-specific overlays**: scanlines (Hologram/Matrix/Acid), RGB shift (Glitch), warm shimmer bands (Heatwave), gradient tints (Vaporwave/Infrared/Void/Noir/Sepia/Arctic/Dream/X-Ray), pink neon underline (Neon)
- **Draggable text overlays**: tap Aa to add text, pan to move, pinch to scale, two-finger to rotate, double-tap to edit
- **Text styles**: Neon glow, Mono, Chrome, Blood, **Ticker** (auto-scrolling marquee pill), **Wave** (chars bob in a sine wave), **Glitch** (RGB-shifted glitch text) — tap STYL to cycle
- **Color palette**: 8 colors per text overlay
- **Save to device**: tap the download icon in the editor or viewer to save the composed story (or raw video) to your camera roll
- **Multiple stories**: post as many stories as you like — counter shows how many you have
- Tap a story to view fullscreen with auto-advance (5s for images, up to video duration for videos)
- Tap left to go back, tap right to skip forward
- Video stories play with audio in the viewer
- Stories auto-expire after 24 hours
- Delete your own stories from the viewer

### 📱 Social Feed
- Twitter-like social media feed
- Create posts with text, images, and link previews
- Embed YouTube videos with auto-detected thumbnails
- Embed Spotify links with previews
- Generic link preview detection
- Like and comment on posts
- Upload up to 4 images per post
- Real-time link detection and preview generation
- Pull-to-refresh functionality
- Local storage with Zustand persistence

### 💰 Rewards Balance Screen
- View your Cuevas coin balance
- Animated spinning coin logo
- Export balance as Instagram story PNG
- Toggle between light/dark mode

### 📊 Stock Balance Screen
- Real-time Cuevas coin price tracking
- iOS Stocks-style area chart with gradient fill
- Live market data (price, 24h change, market cap, volume, supply)
- Color-coded gains/losses
- Export stock data + chart as PNG

### 👤 Profile Tab
- New bottom-tab destination showing your own posts only
- **Editable profile**: tap the avatar or pencil next to @handle to open the editor — upload a profile photo, write a 160-char bio, and rename your handle (synced to Wix via `_functions/updateUsername`)
- **Avatar is stamped onto every new post** so other users see your photo in the feed
- **Tap any author's avatar or name in the feed** to open their profile (stats, latest avatar, post list)
- **Animated ticker headline** scrolling your handle, DNA, balance, posts, streak, and badge count across the top in a neon marquee
- **Pulsing aura ring** around your avatar — color shifts with your DNA tier (white → teal → green → purple)
- **Gradient identity card**: avatar, handle, email, balance chip, and live streak chip
- **DNA Meter**: XP-style bar (BOOTING → AWAKENED → PULSING → ASCENDED → TRANSCENDED) — score = posts·10 + likes·3 + comments·5 + stories·8
- **7-day activity strip**: a row of 7 day cells (S/M/T/W/T/F/S) lit up if you posted that day, with current streak counter
- **Stats grid**: posts, likes received, comments received, stories created
- **Top Transmission** card pinning your highest-engagement post with relative timestamp + like/comment counts
- **Achievement badges**: 8 unlockable badges (First Signal, Broadcaster, Resonant, Magnetic, Story Master, On Fire (3-day streak), Coin Whale, Ascended)
- **Your Transmissions** feed: only posts authored by your handle, with custom delete confirm modal (no native alerts), full like/comment actions

### 🎵 Music under posts
- Tap the music note in the composer to pick a track and choose which 15-second section to play
- Instagram-style waveform scrubber with live preview playback
- Library currently seeded with one bundled song; add more in `src/utils/musicLibrary.ts`
- Music chip renders under the post media with a tap-to-play / pause button

### 🔐 Authentication
- Login with ecothot.com credentials via API
- Real-time authentication with https://www.ecothot.com/_functions/login
- Fetches user's Cuevas balance from server
- Persistent session storage
- Error handling for invalid credentials and network issues

## Tech Stack

- **Framework**: Expo SDK 53, React Native 0.76.7
- **Styling**: NativeWind (TailwindCSS for React Native)
- **State Management**: Zustand with AsyncStorage persistence
- **Navigation**: React Navigation (Bottom Tabs + Native Stack)
- **Charts**: Custom SVG area charts with gradient fill
- **Animation**: React Native Reanimated v3
- **Icons**: Expo Vector Icons (Ionicons)
- **Media**: Expo Image Picker for image uploads

## Color Scheme

### Light Mode
- Background: #CFEFEC (mint)
- Primary Text: #80171F (burgundy)
- Accent: #06A7A1 (teal)
- Secondary: #70A780 (green)

### Dark Mode
- Background: #1a1a1a
- Surface: #2a2a2a
- Text: #CFEFEC
- Accent: #06A7A1

## Project Structure

```
/home/user/workspace/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx          # Authentication with Ecothot API
│   │   ├── FeedScreen.tsx           # Social media feed
│   │   ├── RewardsBalanceScreen.tsx # Coin balance display
│   │   └── StockBalanceScreen.tsx   # Stock chart & data
│   ├── components/
│   │   ├── CreatePostModal.tsx      # Post creation interface
│   │   └── PostCard.tsx             # Individual post display
│   ├── api/
│   │   └── ecothot-auth.ts          # Ecothot login API integration
│   ├── navigation/
│   │   ├── RootNavigator.tsx        # Root navigation setup
│   │   └── MainTabNavigator.tsx     # Bottom tab navigation
│   ├── state/
│   │   ├── appStore.ts              # App-wide state management
│   │   └── feedStore.ts             # Social feed state management
│   ├── types/
│   │   ├── navigation.ts            # TypeScript navigation types
│   │   └── feed.ts                  # Feed data types
│   └── utils/
│       └── linkPreview.ts           # Link detection and preview utilities
├── assets/
│   └── image-1764330193.png         # Coin logo
└── App.tsx                          # Main entry point
```

## Key Features Implementation

### Social Feed
The feed implements a Twitter-like experience with:
- **Link Preview Detection**: Automatically detects and previews YouTube, Spotify, and generic URLs
- **Image Upload**: Upload up to 4 images per post using Expo Image Picker
- **Post Storage**: Local storage using Zustand with AsyncStorage persistence
- **Real-time Updates**: Optimistic UI updates for likes and new posts
- **Mock Data**: Pre-populated with sample posts for demonstration

### Chart Generation
The stock chart uses a custom SVG implementation with:
- Area fill with gradient (iOS Stocks style)
- Automatic Y-axis scaling
- Smooth line interpolation
- 30-day price history

### API Integration
The app integrates with the Ecothot API for authentication:
- **Endpoint**: `POST https://www.ecothot.com/_functions/login`
- **Authentication**: Uses `CUEVAS_CLIENT_KEY` from environment variables
- **Response**: Returns user's Cuevas balance on successful login
- **Error Handling**: Displays specific error messages for failed authentication or network issues

### Data Sources
- **Mock Data**: Currently using generated mock data for Cuevas coin
- **Alpha Vantage API**: Configured for real crypto data (BTC as proxy)
- **Future**: Ready to integrate with actual Cuevas coin API

### Image Export
Both screens support PNG export:
- 1080x1920 Instagram story format
- Includes coin logo, data, and branding
- Stock export includes the chart visualization
- "apps by ecothot" footer

## Known Limitations

### GIF Animation Issue
The coin image is currently a PNG file. Vibecode's image upload system converts uploaded images to PNG format, which removes animation frames from GIF files.

**Workaround Applied**: Added smooth rotation animation using react-native-reanimated to create spinning effect.

**Alternative Solutions**:
1. Host the GIF on an external service (Imgur, etc.) and load via URL
2. Request Vibecode team to add GIF support
3. Keep the rotation animation (current implementation)

## Future Enhancements

- [ ] Add price alerts and notifications
- [ ] Implement transaction history
- [ ] Add more chart timeframes (1D, 1W, 1M, 3M, 6M, 1Y)
- [ ] Support for multiple cryptocurrencies

## Development

The app runs on Expo's development server (port 8081) and is automatically managed by Vibecode's infrastructure.

### State Management
- Authentication state persisted in AsyncStorage
- Dark mode preference saved
- Rewards balance stored locally

### Navigation Flow
1. Login → Main Tabs (Feed as default)
2. Bottom Tabs: Feed ↔ Rewards ↔ Stocks
3. Logout → Login

## Credits

Built for ecothot.com rewards program.
Developed with Claude Code by Anthropic.
