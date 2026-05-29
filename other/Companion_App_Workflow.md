# Cuevas Rewards — Companion Scanner App Workflow

This is the architecture for the second app (companion scanner) that community-service venues will use to verify a user attended and award them CUEVAS points.

---

## High-level flow

1. User signs up in the **Cuevas Rewards** app → backend creates a user record keyed by email.
2. The user's QR code (in-app and Apple Wallet) encodes their email — same value everywhere, never changes.
3. At a community-service event, the venue staff opens the **companion scanner app** and points it at the user's QR.
4. Scanner decodes the email → calls backend → backend awards points and logs the scan.
5. The user's main app shows the updated balance on next refresh.

---

## What you need to build/host

### 1. A database (pick one)
- **Firebase Firestore** — easy, free tier generous, real-time updates for free
- **Wix Data Collections** — fine if you're already on Wix
- **Postgres / SQLite on the Hono backend** — full control, requires hosting

Recommended: **Firestore** unless you have a strong Wix preference.

### 2. Two collections

```
users
  ├─ email (key)
  ├─ points: number
  ├─ createdAt: timestamp
  └─ displayName?: string

scans
  ├─ id (auto)
  ├─ email
  ├─ eventId
  ├─ scannerId (which venue)
  ├─ points: number
  └─ scannedAt: timestamp
```

The `scans` collection lets you:
- Prevent double-scan (same user + same event = reject second scan)
- Show scan history in the user's app
- Audit which venues are awarding points

### 3. Backend endpoints

Add these to `backend/src/routes/rewards.ts`:

```
POST /api/rewards/award
  body: { email, eventId, scannerKey, points }
  - Auth: scannerKey must match a known venue
  - Logic: check no existing scan for (email, eventId); insert scan; increment user.points
  - Returns: { success: true, newBalance }

GET /api/rewards/balance/:email
  - Returns: { email, points }
  - Used by the main app to refresh balance

POST /api/auth/signup
  body: { email, displayName? }
  - Creates user record if not exists
```

---

## Companion scanner app

Build it as a **separate Expo app** (same monorepo or new repo):

```
mobile-scanner/
  src/
    screens/
      ScanScreen.tsx      — camera + QR detection
      EventPickerScreen.tsx — staff picks which event they're scanning for
    api/
      award.ts            — calls POST /api/rewards/award
    state/
      eventStore.ts       — active event id, scanner key
```

Key library: `expo-camera` with QR barcode detection enabled (already in your main app).

UX for staff:
1. Sign in as venue (uses a scannerKey provided by you)
2. Pick the active event (e.g. "Beach Cleanup — Saturday 10am")
3. Tap "Start scanning"
4. Camera opens, each successful scan shows a green checkmark + points awarded
5. Duplicate scan shows yellow warning "Already scanned today"

---

## Security considerations

- **scannerKey** per venue, rotated periodically — prevents random people from awarding points to themselves
- Rate-limit `/award` per scannerKey
- Don't return user balances from `/award` to non-owner; the staff doesn't need to see the user's lifetime total
- Log every scan with timestamp + scannerId for audits

---

## Do you need to store QR images anywhere?

**No.** The QR code *is* the email. Both apps regenerate the QR on the fly from the email string. Storing 10,000 PNG files of QR codes that all just contain "user@email.com" is wasteful — just store the email in the user record and regenerate the QR whenever it's displayed.

If you want users to be able to download/share their QR as an image, the export button in the main app already does that via `react-native-view-shot`.

---

## Production hosting (before App Store launch)

Currently the backend runs at `https://preview-zekhbyzuvqwk.dev.vibecode.run` — that's a Vibecode dev preview and is NOT stable for production users.

Options for production:
1. **Firebase Functions** — pair with Firestore, one platform
2. **Fly.io / Railway** — easy Bun/Hono deploys, ~$5/mo
3. **Wix Velo** — if you want everything in Wix; rewrite the backend in Velo

Once you have a stable URL, set `BACKEND_URL` in the backend `.env` and update `mobile/src/api/ecothot-wallet.ts` to point at it.

---

## Apple Wallet specifics

- The pass's QR is rendered by iOS (always black on white — Apple does not let you style it).
- The pass file (`.pkpass`) is regenerated each time the user taps "Add to Wallet" — no need to cache.
- For push updates to a pass already in someone's wallet (e.g. balance changes), you need the **PassKit Web Service** protocol — separate work, can add post-launch.
