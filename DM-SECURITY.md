# Private Messaging

## Architecture

- `firebase/functions/direct-messages.js` owns message reads/writes and notification delivery. The client never reads RTDB directly; root public reads and writes remain denied. The sole rules addition is a timestamp index.
- Firebase Authentication sessions are issued only after independently verifying a Google token, Apple's signature/issuer/audience/expiry/subject, or the existing account password hash. The legacy public client key and caller-supplied email are never sufficient to access conversations.
- `CUEVAS_CLIENT_KEY` in Secret Manager is used only to verify the legacy password-hash format. This compatibility format should eventually migrate to a slow password KDF; this feature does not redesign legacy authentication.
- Firebase custom sessions use the existing RTDB account ID. Every request verifies the token, checks revocation, checks that the account still exists, and compares its account stamp. Existing app sessions require one fresh sign-in to establish messaging access.
- Native refresh tokens are stored in Expo SecureStore. Browser sessions use sessionStorage. Message bodies are not persisted locally by this feature. Logout clears the messaging session and attempts device deregistration.
- Conversation reads require membership. Only the verified caller can send as themselves. A group created from a direct chat is a new conversation and does not copy private history. Up to 20 participants; 4,000 characters per message; 50-message history pages.
- Conversations refresh every five seconds while open and visible; inbox badges refresh every 30 seconds. This is polling of an authenticated Firebase API, not a direct RTDB subscription.

## Encryption And Moderation

HTTPS protects data in transit; Firebase provides managed encryption at rest. This is **not end-to-end encryption**. Authorized backend operators can access messages for service operation and moderation. Do not market this as E2EE or claim that administrators cannot read messages.

Blocking is enforced server-side. Profile blocks are copied to messaging; messaging blocks apply across devices. Conversation options include blocking, and the inbox includes unblock controls. Messages can be reported, including child safety concerns. Reports and the reported message are stored under the admin-only `dmReports` node with `status: pending`; operators must review this queue in Firebase Console. No automated moderation or email alerting for this queue is claimed.

Account deletion triggers `deleteMessagingAccount`: it removes memberships, the account's authored messages, inbox, blocks, and device registrations, and deletes its Firebase Auth identity. Other participants' messages and moderation reports are retained. The `dm/userChats` index preserves cleanup coverage for groups already left. Public privacy/deletion policies must disclose private messages, participants, device tokens, and retained moderation evidence before store release.

## Notifications

FCM targets individual registered devices, never the announcements topic. Push content is generic: `Cuevas / You have a new message.` It contains a conversation ID but no message text or participant names. Notification taps open the conversation after sign-in. Existing notification permission/settings govern opt-in. Browser preview supports conversations and unread badges, not browser background push. iOS/Android notification delivery requires an updated native build and physical-device verification.

## Deployment And Verification

The functions runtime is Node 22 because Firebase retired Node 20. Only the two new messaging functions were deployed; existing wallet/video functions were not redeployed. The runtime service account may sign its own custom tokens; it has access to the password compatibility secret. Firebase Authentication was initialized for custom sessions; existing Google/Apple OAuth clients were not changed.

Run `node --test firebase/functions/dm.test.js` and `npx tsc --noEmit`. Server tests cover membership, invalid credentials, forged provider audience, sender spoofing, duplicate sends, generic notifications, blocking, group history isolation, reporting, device ownership, and account cleanup. Browser screenshots are UI checks, not proof of native notification delivery.
