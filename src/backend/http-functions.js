import { ok, badRequest, serverError, notFound, forbidden } from "wix-http-functions";
import wixData from "wix-data";
import { files, folders } from "wix-media.v2";
import { elevate } from "wix-auth";
import wixSecretsBackend from "wix-secrets-backend";
import { accounts as loyaltyAccounts } from "wix-loyalty.v2";
import { getCyberneticPosts, createCyberneticPost } from "backend/posts";
import { getUserByEmail, syncMemberPointsToFirebase } from "backend/firebase";
// Wallet generation deps (must be installed in Wix Velo Package Manager too):
// - jszip
// - node-forge
import crypto from "crypto";
import JSZip from "jszip";
import forge from "node-forge";

/**
 * Wix Velo HTTP functions.
 * This file is intended to be copied into your Wix Velo backend (`backend/http-functions.js`) and published.
 *
 * Endpoints:
 * - POST /_functions/login           -> email/password or Google login
 * - POST /_functions/googleLogin     -> alias to login
 * - GET  /_functions/posts
 * - POST /_functions/posts
 * - POST /_functions/uploadMedia             -> returns { uploadUrl, fileId, trackingKey }
 * - POST /_functions/uploadMediaFinalize     -> returns { url }
 * - POST /_functions/walletLinks             -> returns { apple: { downloadUrl }, google: { saveUrl } }
 * - GET  /_functions/walletPass              -> serves .pkpass (when configured)
 */

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

// -------------------- VERSION MARKER (confirm deploy) --------------------
// Change this string whenever you paste/publish so Wix logs prove the running version.
// Bump this whenever you paste into Wix and Publish, so logs prove which version is live.
const BUILD_TAG = "http-functions.login.loyaltypoints.v1.upload.mimeTypeString.v2.walletLinks.v2.pkpass.v1.googleWallet.v1.postsPrivacyAudio.v1.uploadFolders.v2";

// Coin icon provided by you (embedded so the pkpass is self-contained).
// You can also override with a Wix Secret: WALLET_COIN_ICON_PNG_BASE64.
const DEFAULT_COIN_ICON_PNG_BASE64 =
  "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";

// ==================== SHARED HELPERS ====================
function normalizeMediaKey(value) {
  try {
    if (!value) return null;
    const s = String(value);
    // Wix sometimes returns/echoes an id like: "<id>~mv2.jpg" or "<id>~mv2.mp4"
    // If we append "~mv2.<ext>" again, we get "<id>~mv2.jpg~mv2.jpg" (broken).
    return s
      .replace(/~mv2(\.[^/?#]+)?$/i, "")
      .replace(/~mv2$/i, "")
      .replace(/\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov|m4v|m4a|mp3|aac|wav)$/i, "");
  } catch (e) {
    return null;
  }
}

function normalizeMimeType(value) {
  try {
    if (!value) return null;
    if (typeof value === "string") {
      const s = value.trim();
      return s ? s : null;
    }
    if (Array.isArray(value)) return normalizeMimeType(value[0]);
    if (typeof value === "object") {
      // Common client shapes: { type: "video/mp4" } (Blob/File), { mimeType: "..." }, { mimetype: "..." }
      if (typeof value.type === "string") return normalizeMimeType(value.type);
      if (typeof value.mimeType === "string") return normalizeMimeType(value.mimeType);
      if (typeof value.mimetype === "string") return normalizeMimeType(value.mimetype);
    }
    return null;
  } catch (e) {
    return null;
  }
}

function normalizeFileName(value) {
  try {
    if (!value) return null;
    if (typeof value === "string") {
      const s = value.trim();
      return s ? s : null;
    }
    if (Array.isArray(value)) return normalizeFileName(value[0]);
    if (typeof value === "object") {
      // Common client shapes: { name: "file.jpg" }, { fileName: "file.jpg" }
      if (typeof value.name === "string") return normalizeFileName(value.name);
      if (typeof value.fileName === "string") return normalizeFileName(value.fileName);
    }
    return null;
  } catch (e) {
    return null;
  }
}

const UPLOAD_FOLDER_PATHS = {
  "post-image": "Cuevas App/User Uploads/Posts/Images",
  "post-video": "Cuevas App/User Uploads/Posts/Videos",
  "post-audio": "Cuevas App/User Uploads/Posts/Audio",
  "story-image": "Cuevas App/User Uploads/Stories/Images",
  "story-video": "Cuevas App/User Uploads/Stories/Videos",
  "story-audio": "Cuevas App/User Uploads/Stories/Audio",
  "mission-proof": "Cuevas App/User Uploads/Missions/Proof Photos",
  "profile-avatar": "Cuevas App/User Uploads/Profiles/Avatars",
  misc: "Cuevas App/User Uploads/Misc",
};

function normalizeUploadDestination(value, mimeType) {
  const raw = String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  const aliases = {
    image: "post-image",
    photo: "post-image",
    video: "post-video",
    audio: "post-audio",
    song: "post-audio",
    "post-photo": "post-image",
    "post-media": "post-image",
    "story-photo": "story-image",
    "mission-upload": "mission-proof",
    "mission-photo": "mission-proof",
    avatar: "profile-avatar",
    profile: "profile-avatar",
  };
  const candidate = aliases[raw] || raw;
  if (UPLOAD_FOLDER_PATHS[candidate]) return candidate;
  const mime = String(mimeType || "").toLowerCase();
  if (mime.startsWith("video/")) return "post-video";
  if (mime.startsWith("audio/")) return "post-audio";
  if (mime.startsWith("image/")) return "post-image";
  return "misc";
}

function uploadFilePathFor(destination) {
  return UPLOAD_FOLDER_PATHS[destination] || UPLOAD_FOLDER_PATHS.misc;
}

const MEDIA_ROOT_FOLDER_ID = "media-root";
const elevatedListFolders = elevate(folders.listFolders);
const elevatedCreateFolder = elevate(folders.createFolder);

function uploadPathSegments(filePath) {
  return String(filePath || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function folderIdFrom(folder) {
  return folder?._id || folder?.id || folder?.folderId || folder?.folder?._id || folder?.folder?.id || null;
}

async function listChildMediaFolders(parentFolderId) {
  const options =
    parentFolderId && parentFolderId !== MEDIA_ROOT_FOLDER_ID
      ? { parentFolderId }
      : {};
  const response = await elevatedListFolders(options);
  return Array.isArray(response?.folders) ? response.folders : [];
}

async function findChildMediaFolder(parentFolderId, displayName) {
  const target = String(displayName || "").trim().toLowerCase();
  const childFolders = await listChildMediaFolders(parentFolderId);
  return (
    childFolders.find(
      (folder) =>
        String(folder?.displayName || folder?.name || "").trim().toLowerCase() === target &&
        String(folder?.state || "OK").toUpperCase() !== "DELETED"
    ) || null
  );
}

async function createChildMediaFolder(parentFolderId, displayName) {
  const options =
    parentFolderId && parentFolderId !== MEDIA_ROOT_FOLDER_ID
      ? { parentFolderId }
      : {};
  const response = await elevatedCreateFolder(displayName, options);
  return response?.folder || response;
}

async function ensureUploadFolder(filePath) {
  const segments = uploadPathSegments(filePath);
  if (!segments.length) {
    return { folderId: MEDIA_ROOT_FOLDER_ID, filePath: "", created: [] };
  }

  let parentFolderId = MEDIA_ROOT_FOLDER_ID;
  const created = [];

  for (const displayName of segments) {
    let folder = await findChildMediaFolder(parentFolderId, displayName);
    if (!folder) {
      try {
        folder = await createChildMediaFolder(parentFolderId, displayName);
        created.push(displayName);
      } catch (error) {
        folder = await findChildMediaFolder(parentFolderId, displayName);
        if (!folder) throw error;
      }
    }

    const nextFolderId = folderIdFrom(folder);
    if (!nextFolderId) {
      throw new Error(`Could not resolve Media Manager folder id for ${displayName}`);
    }
    parentFolderId = nextFolderId;
  }

  return { folderId: parentFolderId, filePath, created };
}

async function ensureAllUploadFolders() {
  const uniquePaths = Array.from(new Set(Object.values(UPLOAD_FOLDER_PATHS)));
  const results = [];
  for (const filePath of uniquePaths) {
    results.push(await ensureUploadFolder(filePath));
  }
  return results;
}

function sanitizePostPrivacy(value) {
  const v = String(value || "").trim().toLowerCase();
  return ["public", "friends", "private", "group"].includes(v) ? v : "public";
}

function parseHandleList(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function filterPostsForViewer(posts, request) {
  const query = request?.query || {};
  const viewerHandles = new Set(parseHandleList(query.viewer || query.handles || query.aliases));
  const friendHandles = new Set(parseHandleList(query.friends));

  return (posts || []).filter((post) => {
    const privacy = sanitizePostPrivacy(post?.Privacy || post?.privacy || post?.PostPrivacy || post?.postPrivacy);
    const author = String(post?.User || post?.author || "").trim();
    if (privacy === "public") return true;
    if (author && viewerHandles.has(author)) return true;
    if (privacy === "friends" && author && friendHandles.has(author)) return true;
    return false;
  });
}

// ==================== LOGIN / LOYALTY (RESTORED WORKING FLOW) ====================
const elevatedSearchAccounts = elevate(loyaltyAccounts.searchAccounts);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

async function parseJsonBody(request, tag) {
  const raw = await request.body.text();
  console.log(`[${tag}] Raw body:`, raw);
  if (!raw) return { raw, body: null };
  try {
    return { raw, body: JSON.parse(raw) };
  } catch (e) {
    console.log(`[${tag}] JSON parse error:`, String(e));
    return { raw, body: null, parseError: e };
  }
}

async function validateRequest(body) {
  try {
    const secretKey = await wixSecretsBackend.getSecret("CUEVAS_CLIENT_KEY");
    if (body?.clientKey !== secretKey) return { valid: false, error: "Invalid client key" };
    return { valid: true, body };
  } catch (err) {
    return { valid: false, error: "Invalid JSON body" };
  }
}

// ==================== WALLET (APPLE / GOOGLE) ====================
async function getSecretMaybe(name) {
  try {
    const v = await wixSecretsBackend.getSecret(name);
    return v ? String(v) : null;
  } catch (e) {
    return null;
  }
}

function redactSecretPresence(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) out[k] = obj[k] ? true : false;
  return out;
}

// -------------------- WALLET TOKEN + CRYPTO HELPERS --------------------
function base64UrlEncode(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), "utf8");
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBuffer(s) {
  const raw = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = raw + "===".slice((raw.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function sha1Hex(buf) {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

function safeSecretShape(name, value) {
  const t = String(value || "");
  return {
    name,
    present: !!value,
    length: t.length || 0,
    startsWith: t.slice(0, 24),
  };
}

function looksLikePem(s) {
  const t = String(s || "").trim();
  return t.startsWith("-----BEGIN ");
}

function decodeBase64Loose(s) {
  const raw = String(s || "").trim();
  if (!raw) return Buffer.alloc(0);
  // allow data URLs and whitespace
  const cleaned = raw.replace(/^data:.*?;base64,/, "").replace(/\s+/g, "");
  return Buffer.from(cleaned, "base64");
}

function parseX509CertFromSecret(secretValue, labelForLogs) {
  const s = String(secretValue || "").trim();
  if (!s) throw new Error(`${labelForLogs} secret is empty`);

  // 1) PEM directly
  if (looksLikePem(s)) {
    try {
      return forge.pki.certificateFromPem(s);
    } catch (e) {
      throw new Error(`${labelForLogs} PEM parse failed: ${String(e && e.message ? e.message : e)}`);
    }
  }

  // 2) Base64 DER bytes (common)
  // 3) Base64 of PEM text (also common)
  const buf = decodeBase64Loose(s);
  if (!buf || buf.length < 32) {
    throw new Error(`${labelForLogs} looks too short after base64 decode (bytes=${buf?.length || 0})`);
  }

  const maybeText = buf.toString("utf8");
  if (looksLikePem(maybeText)) {
    try {
      return forge.pki.certificateFromPem(maybeText);
    } catch (e) {
      throw new Error(`${labelForLogs} base64->PEM parse failed: ${String(e && e.message ? e.message : e)}`);
    }
  }

  try {
    const asn1 = forge.asn1.fromDer(buf.toString("binary"));
    return forge.pki.certificateFromAsn1(asn1);
  } catch (e) {
    throw new Error(`${labelForLogs} DER parse failed: ${String(e && e.message ? e.message : e)}`);
  }
}

function parsePkcs12FromSecretBase64(secretValue, labelForLogs) {
  const s = String(secretValue || "").trim();
  if (!s) throw new Error(`${labelForLogs} secret is empty`);
  const buf = decodeBase64Loose(s);
  if (!buf || buf.length < 64) {
    throw new Error(`${labelForLogs} looks too short after base64 decode (bytes=${buf?.length || 0})`);
  }
  try {
    return forge.asn1.fromDer(buf.toString("binary"));
  } catch (e) {
    throw new Error(`${labelForLogs} DER parse failed: ${String(e && e.message ? e.message : e)}`);
  }
}

function hmacSha256Base64Url(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getWalletTokenSecret() {
  // Dedicated signing secret for wallet tokens (do NOT reuse clientKey in prod).
  const s = await getSecretMaybe("WALLET_TOKEN_HMAC_SECRET");
  return s ? String(s) : null;
}

async function createWalletToken(payloadObj) {
  const secret = await getWalletTokenSecret();
  if (!secret) return null;
  const payloadJson = JSON.stringify(payloadObj || {});
  const payloadB64 = base64UrlEncode(payloadJson);
  const sig = hmacSha256Base64Url(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

async function verifyWalletToken(token) {
  try {
    const secret = await getWalletTokenSecret();
    if (!secret) return { ok: false, error: "Missing WALLET_TOKEN_HMAC_SECRET" };
    const parts = String(token || "").split(".");
    if (parts.length !== 2) return { ok: false, error: "Bad token format" };
    const [payloadB64, sig] = parts;
    const expected = hmacSha256Base64Url(secret, payloadB64);
    if (expected !== sig) return { ok: false, error: "Bad token signature" };
    const payloadJson = base64UrlDecodeToBuffer(payloadB64).toString("utf8");
    const payload = JSON.parse(payloadJson);
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function displayNameFromEmail(email) {
  const s = String(email || "").trim();
  if (!s) return "Member";
  const local = s.split("@")[0] || s;
  // make it nicer than raw email
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 32) : "Member";
}

function toIntPoints(v) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

async function getCoinPngBase64() {
  return (await getSecretMaybe("WALLET_COIN_ICON_PNG_BASE64")) || DEFAULT_COIN_ICON_PNG_BASE64;
}

// -------------------- APPLE WALLET (.pkpass) --------------------
async function buildApplePkpass(params) {
  const email = String(params?.email || "").trim();
  const points = toIntPoints(params?.points);
  console.log("[WALLET] pkpass build start", { email, points });

  const passTypeIdentifier = await getSecretMaybe("APPLE_WALLET_PASS_TYPE_ID");
  const teamIdentifier = await getSecretMaybe("APPLE_WALLET_TEAM_ID");
  const organizationName = await getSecretMaybe("APPLE_WALLET_ORG_NAME");
  const p12Base64 = await getSecretMaybe("APPLE_WALLET_CERT_P12_BASE64");
  const p12Password = await getSecretMaybe("APPLE_WALLET_CERT_PASSWORD");
  const wwdrBase64 = await getSecretMaybe("APPLE_WALLET_WWDR_CERT_BASE64");

  if (!passTypeIdentifier || !teamIdentifier || !organizationName || !p12Base64 || !p12Password || !wwdrBase64) {
    console.log("[WALLET] pkpass missing apple config", {
      passTypeIdentifier: !!passTypeIdentifier,
      teamIdentifier: !!teamIdentifier,
      organizationName: !!organizationName,
      p12Base64: !!p12Base64,
      p12Password: !!p12Password,
      wwdrBase64: !!wwdrBase64,
    });
    throw new Error("Apple Wallet is not configured (missing APPLE_WALLET_* secrets)");
  }

  const coinB64 = await getCoinPngBase64();
  const coinBuf = Buffer.from(String(coinB64 || ""), "base64");

  // NOTE on fonts:
  // Apple Wallet controls fonts (system UI). You can't force Chicago via pass.json fields.
  // We keep the pass styling clean (black/white) and rely on Wallet's typography.
  const name = displayNameFromEmail(email);
  const serialNumber = sha1Hex(email).slice(0, 32);
  const qrMessage = JSON.stringify({ email, points });

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    organizationName,
    description: "Ecothot Rewards",
    serialNumber,
    backgroundColor: "rgb(0,0,0)",
    foregroundColor: "rgb(255,255,255)",
    labelColor: "rgb(255,255,255)",
    logoText: "Ecothot Rewards",
    // Store card layout
    storeCard: {
      primaryFields: [{ key: "name", label: "NAME", value: name }],
      secondaryFields: [{ key: "points", label: "POINTS", value: String(points) }],
    },
    // Barcode (QR)
    barcode: { format: "PKBarcodeFormatQR", message: qrMessage, messageEncoding: "utf-8" },
    barcodes: [{ format: "PKBarcodeFormatQR", message: qrMessage, messageEncoding: "utf-8" }],
  };

  const files = {
    "pass.json": Buffer.from(JSON.stringify(passJson, null, 2), "utf8"),
    // Use the provided coin for icon + logo. (Wallet will size/crop as needed.)
    "icon.png": coinBuf,
    "icon@2x.png": coinBuf,
    "logo.png": coinBuf,
    "logo@2x.png": coinBuf,
  };

  const manifest = {};
  for (const [name, buf] of Object.entries(files)) manifest[name] = sha1Hex(buf);
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");

  // --- Sign manifest.json (PKCS#7 detached signature) ---
  let p12 = null;
  try {
    const p12Asn1 = parsePkcs12FromSecretBase64(p12Base64, "APPLE_WALLET_CERT_P12_BASE64");
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, String(p12Password));
  } catch (e) {
    console.log("[WALLET] pkpass p12 parse error", safeSecretShape("APPLE_WALLET_CERT_P12_BASE64", p12Base64));
    throw e;
  }

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (!keyBags[0]?.key || !certBags[0]?.cert) throw new Error("Apple P12 did not contain a key/cert");

  const privateKey = keyBags[0].key;
  const signerCert = certBags[0].cert;

  let wwdrCert = null;
  try {
    wwdrCert = parseX509CertFromSecret(wwdrBase64, "APPLE_WALLET_WWDR_CERT_BASE64");
  } catch (e) {
    console.log("[WALLET] pkpass wwdr parse error", safeSecretShape("APPLE_WALLET_WWDR_CERT_BASE64", wwdrBase64));
    throw e;
  }

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestBuf.toString("binary"));
  p7.addCertificate(signerCert);
  p7.addCertificate(wwdrCert);
  p7.addSigner({
    key: privateKey,
    certificate: signerCert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: true });

  const signatureDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const signatureBuf = Buffer.from(signatureDer, "binary");

  // --- Zip pkpass ---
  const zip = new JSZip();
  for (const [name, buf] of Object.entries(files)) zip.file(name, buf);
  zip.file("manifest.json", manifestBuf);
  zip.file("signature", signatureBuf);

  const pkpassBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  console.log("[WALLET] pkpass build ok", { bytes: pkpassBuf?.length || null });
  return pkpassBuf;
}

// -------------------- GOOGLE WALLET (Save URL) --------------------
async function buildGoogleWalletSaveUrl(params) {
  const email = String(params?.email || "").trim();
  const points = toIntPoints(params?.points);
  const issuerId = String(params?.issuerId || "").trim();
  const saB64 = String(params?.serviceAccountJsonBase64 || "").trim();
  const coinImageUrl = params?.coinImageUrl ? String(params.coinImageUrl).trim() : "";

  if (!email || !issuerId || !saB64) throw new Error("Missing google wallet inputs");

  const saJson = JSON.parse(Buffer.from(saB64, "base64").toString("utf8"));
  const clientEmail = String(saJson?.client_email || "").trim();
  const privateKey = String(saJson?.private_key || "").trim();
  if (!clientEmail || !privateKey) throw new Error("Service account JSON missing client_email/private_key");

  const idHash = sha1Hex(email).slice(0, 24);
  const classId = `${issuerId}.ecothot_rewards`;
  const objectId = `${issuerId}.${idHash}`;
  const name = displayNameFromEmail(email);
  const qrValue = JSON.stringify({ email, points });

  // Minimal Generic Pass payload. (Google Wallet UI is flexible; this is a sane starting point.)
  const genericClass = {
    id: classId,
    issuerName: "Ecothot",
  };

  const genericObject = {
    id: objectId,
    classId: classId,
    state: "ACTIVE",
    heroImage: coinImageUrl
      ? { sourceUri: { uri: coinImageUrl }, contentDescription: { defaultValue: { language: "en-US", value: "Coin" } } }
      : undefined,
    cardTitle: { defaultValue: { language: "en-US", value: "Ecothot Rewards" } },
    subheader: { defaultValue: { language: "en-US", value: "Member" } },
    header: { defaultValue: { language: "en-US", value: name } },
    barcode: { type: "QR_CODE", value: qrValue, alternateText: "Scan" },
    textModulesData: [
      { id: "name", header: "NAME", body: name },
      { id: "points", header: "POINTS", body: String(points) },
    ],
  };

  // Remove undefined fields (Google rejects them sometimes)
  if (!genericObject.heroImage) delete genericObject.heroImage;

  const nowSec = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtPayload = {
    iss: clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: nowSec,
    payload: {
      genericClasses: [genericClass],
      genericObjects: [genericObject],
    },
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(jwtHeader))}.${base64UrlEncode(JSON.stringify(jwtPayload))}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(privateKey, "base64");
  const jwt = `${signingInput}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
  console.log("[WALLET] google save jwt built", { bytes: jwt.length, classId, objectId, hasImage: !!coinImageUrl });
  return `https://pay.google.com/gp/v/save/${encodeURIComponent(jwt)}`;
}

export async function options_walletLinks() {
  return ok({ headers: jsonHeaders, body: { success: true } });
}

// POST /_functions/walletLinks
// Returns URLs the app can open:
// - iOS: a downloadUrl for a .pkpass (Apple Wallet)
// - Android: a Google Wallet "save" URL
//
// IMPORTANT:
// - Apple Wallet requires generating + signing a .pkpass on the server (Pass Type ID cert + WWDR).
// - Google Wallet requires creating a signed JWT (Service Account key).
export async function post_walletLinks(request) {
  try {
    console.log("[WALLET] build:", BUILD_TAG);
    const { body } = await parseJsonBody(request, "WALLET");
    if (!body) return badRequest({ headers: jsonHeaders, body: { success: false, error: "Body must be JSON" } });

    const { valid, error } = await validateRequest(body);
    if (!valid) return forbidden({ headers: jsonHeaders, body: { success: false, error } });

    const email = (body?.email || "").trim();
    const rewardsBalance = typeof body?.rewardsBalance === "number" ? body.rewardsBalance : null;
    console.log("[WALLET] request", { email, rewardsBalance });
    if (!email) return badRequest({ headers: jsonHeaders, body: { success: false, error: "Email is required" } });

    // Presence-check the required secrets (do not log values).
    const secrets = {
      // Apple (minimal set; exact needs depend on your implementation)
      APPLE_WALLET_PASS_TYPE_ID: await getSecretMaybe("APPLE_WALLET_PASS_TYPE_ID"),
      APPLE_WALLET_TEAM_ID: await getSecretMaybe("APPLE_WALLET_TEAM_ID"),
      APPLE_WALLET_ORG_NAME: await getSecretMaybe("APPLE_WALLET_ORG_NAME"),
      APPLE_WALLET_CERT_P12_BASE64: await getSecretMaybe("APPLE_WALLET_CERT_P12_BASE64"),
      APPLE_WALLET_CERT_PASSWORD: await getSecretMaybe("APPLE_WALLET_CERT_PASSWORD"),
      APPLE_WALLET_WWDR_CERT_BASE64: await getSecretMaybe("APPLE_WALLET_WWDR_CERT_BASE64"),
      WALLET_TOKEN_HMAC_SECRET: await getSecretMaybe("WALLET_TOKEN_HMAC_SECRET"),

      // Google Wallet
      GOOGLE_WALLET_ISSUER_ID: await getSecretMaybe("GOOGLE_WALLET_ISSUER_ID"),
      // Wix secret names have a 40-char limit. The full "..._BASE64" is 41 chars.
      // Use the shorter canonical secret name below, but also accept older/truncated variants.
      GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64:
        (await getSecretMaybe("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64")) ||
        (await getSecretMaybe("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE6")) ||
        (await getSecretMaybe("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64")),
      GOOGLE_WALLET_COIN_IMAGE_URL: await getSecretMaybe("GOOGLE_WALLET_COIN_IMAGE_URL"),
    };

    const appleOk =
      !!secrets.APPLE_WALLET_PASS_TYPE_ID &&
      !!secrets.APPLE_WALLET_TEAM_ID &&
      !!secrets.APPLE_WALLET_ORG_NAME &&
      !!secrets.APPLE_WALLET_CERT_P12_BASE64 &&
      !!secrets.APPLE_WALLET_CERT_PASSWORD &&
      !!secrets.APPLE_WALLET_WWDR_CERT_BASE64 &&
      !!secrets.WALLET_TOKEN_HMAC_SECRET;

    const googleOk = !!secrets.GOOGLE_WALLET_ISSUER_ID && !!secrets.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64;

    if (!appleOk && !googleOk) {
      return ok({
        headers: jsonHeaders,
        body: {
          success: false,
          missingConfig: true,
          error:
            "Wallet signing is not configured on the server yet. Add Apple/Google wallet secrets in Wix Secrets Manager.",
          debug: {
            secretPresence: redactSecretPresence(secrets),
            hint:
              "Apple: create a Pass Type ID + cert, export P12, base64 it, include WWDR cert. Google: create Wallet issuer + service account key and sign JWT.",
          },
        },
      });
    }

    const now = Date.now();
    const points = toIntPoints(rewardsBalance);
    const tokenPayload = { v: 1, email, points, iat: now, nonce: crypto.randomBytes(8).toString("hex") };
    const token = await createWalletToken(tokenPayload);

    if (!token && appleOk) {
      // Apple pass uses our token to fetch the pkpass; without it, we can't proceed safely.
      return ok({
        headers: jsonHeaders,
        body: {
          success: false,
          missingConfig: true,
          error: "Missing WALLET_TOKEN_HMAC_SECRET. Add it in Wix Secrets Manager to enable Wallet passes.",
          debug: { secretPresence: redactSecretPresence(secrets) },
        },
      });
    }

    const apple = appleOk
      ? { downloadUrl: `https://www.ecothot.com/_functions/walletPass?token=${encodeURIComponent(token)}` }
      : undefined;

    let google = undefined;
    if (googleOk) {
      try {
        const saveUrl = await buildGoogleWalletSaveUrl({
          email,
          points,
          issuerId: secrets.GOOGLE_WALLET_ISSUER_ID,
          serviceAccountJsonBase64: secrets.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64,
          coinImageUrl: secrets.GOOGLE_WALLET_COIN_IMAGE_URL,
        });
        if (saveUrl) google = { saveUrl };
      } catch (e) {
        console.log("[WALLET] google build error:", String(e && e.message ? e.message : e));
      }
    }

    return ok({
      headers: jsonHeaders,
      body: {
        success: true,
        apple,
        google,
        debug: {
          appleConfigured: !!appleOk,
          googleConfigured: !!googleOk,
          tokenKind: token ? "hmac" : "missing",
          build: BUILD_TAG,
        },
      },
    });
  } catch (err) {
    console.error("[WALLET] Error:", err);
    return serverError({
      headers: jsonHeaders,
      body: { success: false, error: err?.message || String(err) },
    });
  }
}

// Wix runtime loader alias (keeps consistency with the login alias fix)
export async function use_walletLinks(request) {
  return post_walletLinks(request);
}

// Extra aliases for Wix runtime quirks (some environments look for different symbol names)
export async function walletLinks(request) {
  return post_walletLinks(request);
}
export async function use_walletlinks(request) {
  return post_walletLinks(request);
}
export async function post_walletlinks(request) {
  return post_walletLinks(request);
}

// GET /_functions/walletPass
// Should serve a signed .pkpass. Stubbed until server-side signing is implemented.
export async function get_walletPass(request) {
  try {
    console.log("[WALLET] walletPass build:", BUILD_TAG);
    const token = request?.query?.token;
    console.log("[WALLET] walletPass token:", token ? String(token).slice(0, 24) : null);

    if (!token) {
      return badRequest({ headers: jsonHeaders, body: { success: false, error: "Missing token" } });
    }

    const verified = await verifyWalletToken(token);
    if (!verified.ok) {
      console.log("[WALLET] walletPass token verify failed:", verified.error);
      return forbidden({ headers: jsonHeaders, body: { success: false, error: "Invalid token" } });
    }

    const email = String(verified.payload?.email || "").trim();
    const points = toIntPoints(verified.payload?.points);
    if (!email) {
      return badRequest({ headers: jsonHeaders, body: { success: false, error: "Token missing email" } });
    }

    const pkpass = await buildApplePkpass({ email, points });
    const filename = `ecothot-rewards-${sha1Hex(email).slice(0, 8)}.pkpass`;
    return ok({
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
      body: pkpass,
    });
  } catch (err) {
    return serverError({ headers: jsonHeaders, body: { success: false, error: err?.message || String(err) } });
  }
}

// --- LOGIN LOGIC (matches your working version) ---
async function handleLoginLogic(email) {
  if (!email) return badRequest({ headers, body: { success: false, error: "Email is required" } });
  console.log(`[LOGIN] Attempting login for: ${email}`);

  try {
    let user = null;
    try {
      user = await getUserByEmail(email);
    } catch (e) {
      console.log("[LOGIN] Firebase lookup error:", String(e));
    }

    // IMPORTANT: Firebase JSON should use `loyaltypoints` as the canonical field.
    // Other variants may exist from older code; we treat them as fallbacks only.
    const userLoyaltyPointsRaw =
      user?.loyaltypoints ?? user?.loyaltyPoints ?? user?.loyalty_points ?? null;
    let points =
      typeof userLoyaltyPointsRaw === "number"
        ? userLoyaltyPointsRaw
        : Number(userLoyaltyPointsRaw) || 0;
    console.log("[LOGIN] Firebase user points snapshot:", JSON.stringify({
      hasUser: !!user,
      loyaltypoints: user?.loyaltypoints,
      loyaltyPoints: user?.loyaltyPoints,
      loyalty_points: user?.loyalty_points,
      pointsField: user?.points,
      using: points,
    }));

    try {
      console.log(`[LOGIN] Loyalty refresh start for: ${email}`);
      console.log("[LOGIN] Loyalty method marker:", JSON.stringify({ build: BUILD_TAG, method: "elevatedSearchAccounts(query=email)" }));
      const searchResults = await elevatedSearchAccounts({ query: email });
      console.log("[LOGIN] RAW LOYALTY DATA:", JSON.stringify(searchResults));

      const list =
        (Array.isArray(searchResults?.accounts) && searchResults.accounts) ||
        (Array.isArray(searchResults?.items) && searchResults.items) ||
        [];

      const loyaltyAccount = list.find(
        (acc) => acc?.contact?.email?.toLowerCase() === String(email).toLowerCase()
      );

      if (loyaltyAccount) {
        console.log("[LOGIN] Found matching loyalty account:", JSON.stringify(loyaltyAccount));
        const newPoints =
          loyaltyAccount?.points?.balance ??
          loyaltyAccount?.account?.points?.balance ??
          loyaltyAccount?.balance ??
          0;
        console.log(`[LOGIN] Loyalty balance for ${email}: ${newPoints}`);

        // If user exists in Firebase, sync points
        if (user && syncMemberPointsToFirebase && user.wixMemberId) {
          const currentFirebasePoints =
            (typeof user?.loyaltypoints === "number" ? user.loyaltypoints : Number(user?.loyaltypoints)) ||
            (typeof user?.loyaltyPoints === "number" ? user.loyaltyPoints : Number(user?.loyaltyPoints)) ||
            (typeof user?.loyalty_points === "number" ? user.loyalty_points : Number(user?.loyalty_points)) ||
            0;
          if (newPoints !== currentFirebasePoints) {
            try {
              await syncMemberPointsToFirebase(user.wixMemberId, email, newPoints);
              console.log(`[LOGIN] Updated Firebase points to ${newPoints}`);
            } catch (syncErr) {
              console.error("[LOGIN] Firebase Sync Failed:", syncErr);
            }
          }
        }

        points = newPoints;
      } else {
        console.log("[LOGIN] No loyalty account matched email in results");
      }
    } catch (loyaltyErr) {
      console.error("[LOGIN] Loyalty lookup failed", loyaltyErr);
    }

    // Lazy sync: if not in Firebase, check Wix Members and create/sync
    if (!user) {
      console.log(`[LOGIN] Not in Firebase. Checking Wix Members...`);
      const wixUserQuery = await wixData
        .query("Members/PrivateMembersData")
        .eq("loginEmail", email)
        .find({ suppressAuth: true });

      if (wixUserQuery.items.length > 0) {
        const wixMember = wixUserQuery.items[0];
        const wixMemberId = wixMember._id;
        if (syncMemberPointsToFirebase) {
          try {
            await syncMemberPointsToFirebase(wixMemberId, email, points);
            console.log(`[LOGIN] Synced to Firebase success!`);
          } catch (syncErr) {
            console.error("[LOGIN] Firebase Sync Failed:", syncErr);
          }
        } else {
          console.error("[LOGIN] syncMemberPointsToFirebase function is missing!");
        }
        user = { email, wixMemberId, loyaltypoints: points };
      } else {
        console.log(`[LOGIN] Not found in Wix Members either.`);
      }
    }

    if (!user) {
      return notFound({
        headers,
        body: {
          success: false,
          code: "USER_NOT_FOUND",
          error: "User not found. Please register on the website.",
        },
      });
    }

    return ok({
      headers,
      body: {
        success: true,
        email: user.email,
        wixMemberId: user.wixMemberId,
        cuevas: points ?? 0,
        loyaltypoints: points ?? 0,
      },
    });
  } catch (e) {
    console.error("[LOGIN] Critical Error", e);
    return serverError({
      headers,
      body: {
        success: false,
        code: "SERVER_ERROR",
        error: "Unable to process login",
        details: String(e && e.message ? e.message : e),
      },
    });
  }
}

// POST /_functions/login
export async function post_login(request) {
  try {
    console.log("[LOGIN] build:", BUILD_TAG);
    const { body } = await parseJsonBody(request, "LOGIN");
    if (!body) return badRequest({ headers, body: { success: false, error: "Body must be JSON" } });

    const { valid, error } = await validateRequest(body);
    if (!valid) return forbidden({ headers, body: { success: false, error } });

    return await handleLoginLogic(body.email);
  } catch (err) {
    console.error("[LOGIN] Error:", err);
    return serverError({
      headers,
      body: { success: false, error: err?.message || String(err) },
    });
  }
}

// Alias: POST /_functions/googleLogin -> same as login
export async function post_googleLogin(request) {
  return post_login(request);
}

// Wix runtime loader aliases (fixes "function not found" errors)
export async function use_login(request) {
  return post_login(request);
}
export async function use_googleLogin(request) {
  return post_login(request);
}

// OPTIONS handlers for CORS preflight
export async function options_login() {
  return ok({ headers: jsonHeaders, body: { success: true } });
}
export async function options_googleLogin() {
  return ok({ headers: jsonHeaders, body: { success: true } });
}

// ==================== POSTS ====================

export async function get_posts(request) {
  try {
    console.log("[POSTS] build:", BUILD_TAG);
    const posts = await getCyberneticPosts(50);
    return ok({ headers: jsonHeaders, body: { success: true, posts: filterPostsForViewer(posts, request) } });
  } catch (err) {
    console.error("[POSTS] GET error:", err);
    return serverError({
      headers: jsonHeaders,
      body: { success: false, error: err?.message || String(err) },
    });
  }
}

export async function post_posts(request) {
  try {
    console.log("[POSTS] build:", BUILD_TAG);
    const raw = await request.body.text();
    console.log("[POSTS] Incoming raw:", raw);

    let body;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch (e) {
      return badRequest({ headers: jsonHeaders, body: { success: false, error: "Body must be JSON" } });
    }
    if (!body) {
      return badRequest({ headers: jsonHeaders, body: { success: false, error: "Missing body" } });
    }

    const mediaArray = (body.Media || body.media || body.MediaUrls || body.mediaUrls || []).filter(Boolean);
    const privacy = sanitizePostPrivacy(body.Privacy || body.privacy || body.PostPrivacy || body.postPrivacy);
    const audioUrl = body.AudioUrl || body.audioUrl || body.AudioURL || body.audioURL || "";
    const audioTitle = body.AudioTitle || body.audioTitle || "Cuevas Audio Transmission";
    const audioArtist = body.AudioArtist || body.audioArtist || body.User || body.user || body.author || "";
    const audioDurationMs = Number(body.AudioDurationMs || body.audioDurationMs || 0);

    const data = {
      User: body.User || body.user || body.author || "anonymous",
      "Plain Content": body["Plain Content"] || body.plainContent || body.content || "",
      Media: mediaArray,
      MediaUrls: mediaArray,
      Hashtags: body.Hashtags || body.hashtags || [],
      "Like Count": body["Like Count"] || body.likeCount || 0,
      "Date Published": body["Date Published"] || body.datePublished || new Date().toISOString(),
      authorRewardPoints: body.authorRewardPoints ?? body.cuevas ?? 0,
      Privacy: privacy,
      privacy,
      PostPrivacy: privacy,
      AudioUrl: audioUrl,
      Audio: body.Audio || body.audio || null,
      AudioTitle: audioTitle,
      AudioArtist: audioArtist,
      AudioDurationMs: Number.isFinite(audioDurationMs) ? audioDurationMs : 0,
    };

    const inserted = await createCyberneticPost(data);
    console.log("[POSTS] Inserted:", JSON.stringify(inserted));
    return ok({ headers: jsonHeaders, body: { success: true, post: inserted } });
  } catch (err) {
    console.error("[POSTS] POST error:", err);
    return serverError({
      headers: jsonHeaders,
      body: { success: false, error: err?.message || String(err) },
    });
  }
}

export async function options_posts() {
  return ok({ headers: jsonHeaders, body: { success: true } });
}

async function updatePostPrivacyFromRequest(request) {
  const raw = await request.body.text().catch(() => "");
  let body = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch (e) {
      throw new Error("Body must be JSON");
    }
  }

  const id =
    body?.id ||
    body?._id ||
    request?.query?.id ||
    request?.query?._id ||
    null;

  if (!id) {
    const err = new Error("Missing post id");
    err.statusCode = 400;
    throw err;
  }

  const privacy = sanitizePostPrivacy(body?.Privacy || body?.privacy || body?.PostPrivacy || body?.postPrivacy);
  const existing = await wixData.get("Cybernetic", String(id), { suppressAuth: true });
  if (!existing?._id) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }

  const updated = await wixData.update(
    "Cybernetic",
    {
      ...existing,
      Privacy: privacy,
      privacy,
      PostPrivacy: privacy,
    },
    { suppressAuth: true }
  );
  return updated;
}

export async function patch_posts(request) {
  try {
    console.log("[POSTS] PATCH build:", BUILD_TAG);
    const post = await updatePostPrivacyFromRequest(request);
    return ok({ headers: jsonHeaders, body: { success: true, post } });
  } catch (err) {
    console.error("[POSTS] PATCH error:", err);
    const statusCode = err?.statusCode || 500;
    const response = {
      headers: jsonHeaders,
      body: { success: false, error: err?.message || String(err) },
    };
    if (statusCode === 400) return badRequest(response);
    if (statusCode === 404) return notFound(response);
    return serverError(response);
  }
}

async function removePostFromRequest(request) {
  const raw = await request.body.text().catch(() => "");
  let body = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch (e) {
      throw new Error("Body must be JSON");
    }
  }

  const id =
    body?.id ||
    body?._id ||
    request?.query?.id ||
    request?.query?._id ||
    null;

  if (!id) {
    const err = new Error("Missing post id");
    err.statusCode = 400;
    throw err;
  }

  await wixData.remove("Cybernetic", String(id), { suppressAuth: true });
  return String(id);
}

export async function delete_posts(request) {
  try {
    console.log("[POSTS] DELETE build:", BUILD_TAG);
    const id = await removePostFromRequest(request);
    return ok({ headers: jsonHeaders, body: { success: true, id } });
  } catch (err) {
    console.error("[POSTS] DELETE error:", err);
    const statusCode = err?.statusCode || 500;
    const response = {
      headers: jsonHeaders,
      body: { success: false, error: err?.message || String(err) },
    };
    return statusCode === 400 ? badRequest(response) : serverError(response);
  }
}

export async function use_posts(request) {
  if (request?.method === "OPTIONS") {
    return options_posts();
  }
  if (request?.method === "GET") {
    return get_posts(request);
  }
  if (request?.method === "POST") {
    return post_posts(request);
  }
  if (request?.method === "DELETE") {
    return delete_posts(request);
  }
  if (request?.method === "PATCH") {
    return patch_posts(request);
  }
  return notFound({
    headers: jsonHeaders,
    body: { success: false, error: `Unsupported method: ${request?.method || "unknown"}` },
  });
}

// ==================== UPLOAD (DIRECT) ====================
// Avoids Velo request size limits by uploading binary directly to the URL Wix provides.

export async function options_ensureUploadFolders() {
  return ok({ headers: jsonHeaders, body: { success: true } });
}

export async function get_ensureUploadFolders() {
  try {
    console.log("[UPLOAD_FOLDERS] build:", BUILD_TAG);
    const ensured = await ensureAllUploadFolders();
    return ok({ headers: jsonHeaders, body: { success: true, ensured } });
  } catch (err) {
    console.error("[UPLOAD_FOLDERS] error:", err);
    return serverError({
      headers: jsonHeaders,
      body: { success: false, error: err?.message || String(err) },
    });
  }
}

export async function post_ensureUploadFolders() {
  return get_ensureUploadFolders();
}

export async function use_ensureUploadFolders() {
  return get_ensureUploadFolders();
}

export async function options_uploadMedia() {
  return ok({ headers: jsonHeaders, body: { success: true } });
}

export async function post_uploadMedia(request) {
  try {
    console.log("[UPLOAD] build:", BUILD_TAG);
    const raw = await request.body.text();
    console.log("[UPLOAD] init raw:", raw);

    let body;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch (e) {
      return badRequest({ headers: jsonHeaders, body: { success: false, error: "Body must be JSON" } });
    }

    const fileName = normalizeFileName(
      body?.fileName ?? body?.name ?? body?.file?.name ?? body?.file?.fileName
    );
    const mimeType = normalizeMimeType(
      body?.mimeType ?? body?.type ?? body?.file?.type ?? body?.file?.mimeType ?? body?.file?.mimetype
    );
    const destination = normalizeUploadDestination(
      body?.destination ?? body?.folder ?? body?.uploadType ?? body?.kind,
      mimeType
    );
    const filePath = uploadFilePathFor(destination);

    if (!fileName || !mimeType) {
      return badRequest({
        headers: jsonHeaders,
        body: {
          success: false,
          error: "Missing/invalid fileName or mimeType (mimeType must be a string like 'image/jpeg' or 'video/mp4')",
          debug: {
            fileNameType: typeof body?.fileName,
            mimeTypeType: typeof body?.mimeType,
          },
        },
      });
    }

    const folderInfo = await ensureUploadFolder(filePath);

    console.log(
      "[UPLOAD] init request:",
      JSON.stringify({
        fileName,
        mimeType,
        destination,
        filePath,
        folderId: folderInfo.folderId,
        createdFolders: folderInfo.created,
        fileNameType: typeof fileName,
        mimeTypeType: typeof mimeType,
      })
    );

    // Wix API: https://dev.wix.com/docs/velo/apis/wix-media-v2/files/generate-file-upload-url
    // Requires elevated permissions to avoid 403.
    const elevatedGenerate = elevate(files.generateFileUploadUrl);

    // Try multiple call signatures (Wix SDK variations)
    // Object-format first (works on newer Wix SDK)
    const attempts = [
      {
        name: "ELEVATED generateFileUploadUrl(mimeType, { fileName, parentFolderId })",
        run: () => elevatedGenerate(mimeType, { fileName, parentFolderId: folderInfo.folderId }),
      },
      {
        name: "PLAIN generateFileUploadUrl(mimeType, { fileName, parentFolderId })",
        run: () => files.generateFileUploadUrl(mimeType, { fileName, parentFolderId: folderInfo.folderId }),
      },
      {
        name: "ELEVATED generateFileUploadUrl(mimeType, { fileName, filePath })",
        run: () => elevatedGenerate(mimeType, { fileName, filePath }),
      },
      {
        name: "PLAIN generateFileUploadUrl(mimeType, { fileName, filePath })",
        run: () => files.generateFileUploadUrl(mimeType, { fileName, filePath }),
      },
      {
        name: "ELEVATED generateFileUploadUrl({ mimeType, fileName, parentFolderId })",
        run: () => elevatedGenerate({ mimeType, fileName, parentFolderId: folderInfo.folderId }),
      },
      {
        name: "PLAIN generateFileUploadUrl({ mimeType, fileName, parentFolderId })",
        run: () => files.generateFileUploadUrl({ mimeType, fileName, parentFolderId: folderInfo.folderId }),
      },
      {
        name: "ELEVATED generateFileUploadUrl({ mimeType, fileName, filePath })",
        run: () => elevatedGenerate({ mimeType, fileName, filePath }),
      },
      {
        name: "PLAIN generateFileUploadUrl({ mimeType, fileName, filePath })",
        run: () => files.generateFileUploadUrl({ mimeType, fileName, filePath }),
      },
      {
        name: "ELEVATED fallback generateFileUploadUrl({ mimeType, fileName })",
        run: () => elevatedGenerate({ mimeType, fileName }),
      },
      {
        name: "PLAIN fallback generateFileUploadUrl({ mimeType, fileName })",
        run: () => files.generateFileUploadUrl({ mimeType, fileName }),
      },
      {
        name: "ELEVATED fallback generateFileUploadUrl(mimeType, { fileName })",
        run: () => elevatedGenerate(mimeType, { fileName }),
      },
      {
        name: "PLAIN fallback generateFileUploadUrl(mimeType, { fileName })",
        run: () => files.generateFileUploadUrl(mimeType, { fileName }),
      },
    ];

    let resp = null;
    let lastErr = null;
    for (const a of attempts) {
      try {
        console.log("[UPLOAD] init attempt:", a.name);
        resp = await a.run();
        console.log("[UPLOAD] init attempt success:", a.name, JSON.stringify(resp));
        break;
      } catch (e) {
        lastErr = e;
        console.log("[UPLOAD] init attempt error:", a.name, String(e && e.message ? e.message : e));
        try {
          console.log("[UPLOAD] init attempt error obj:", JSON.stringify(e));
        } catch (_) {}
      }
    }

    if (!resp) {
      console.log("[UPLOAD] init error: all attempts failed");
      return serverError({
        headers: jsonHeaders,
        body: {
          success: false,
          error: lastErr && lastErr.message ? lastErr.message : String(lastErr || "Unknown error"),
        },
      });
    }

    const uploadUrl = resp?.uploadUrl || resp?.url || resp?.upload_url;
    let fileId = resp?.fileId || resp?._id || resp?.id || resp?.file_id;

    // Try to extract fileId from uploadUrl query params
    if (!fileId && typeof uploadUrl === "string") {
      try {
        const u = new URL(uploadUrl);
        fileId =
          u.searchParams.get("fileId") ||
          u.searchParams.get("file_id") ||
          u.searchParams.get("id");
      } catch (e) {
        // ignore
      }
    }

    // Derive trackingKey from the uploadUrl JWT payload path
    let trackingKey = null;
    if (typeof uploadUrl === "string") {
      try {
        const token = uploadUrl.split("/upload/")[1];
        const payloadB64Url = token ? token.split(".")[1] : null;
        if (payloadB64Url) {
          const b64 = payloadB64Url.replace(/-/g, "+").replace(/_/g, "/");
          const padded = b64 + "===".slice((b64.length + 3) % 4);
          let jsonStr = null;
          if (typeof Buffer !== "undefined") {
            jsonStr = Buffer.from(padded, "base64").toString("utf8");
          } else if (typeof atob !== "undefined") {
            jsonStr = atob(padded);
          }
          if (jsonStr) {
            const payload = JSON.parse(jsonStr);
            const path = payload?.path || "";
            let rawKey = path ? String(path).split("/").pop() : null;
            const normalizedKey = normalizeMediaKey(rawKey);
            if (rawKey && normalizedKey && rawKey !== normalizedKey) {
              console.log("[UPLOAD] init normalized trackingKey:", rawKey, "=>", normalizedKey);
            }
            trackingKey = normalizedKey || rawKey;
          }
        }
      } catch (e) {
        console.log("[UPLOAD] trackingKey decode failed:", String(e));
      }
    }

    console.log(
      "[UPLOAD] init parsed:",
      JSON.stringify({
        uploadUrl: !!uploadUrl,
        fileId: !!fileId,
        trackingKey: !!trackingKey,
        destination,
        filePath,
        folderId: folderInfo.folderId,
      })
    );

    if (!uploadUrl || (!fileId && !trackingKey)) {
      return serverError({
        headers: jsonHeaders,
        body: {
          success: false,
          error: "Upload init failed: missing uploadUrl/fileId",
          debug: { uploadUrl, fileId, resp },
        },
      });
    }

    return ok({
      headers: jsonHeaders,
      body: {
        success: true,
        uploadUrl,
        fileId: fileId || null,
        trackingKey: trackingKey || null,
        destination,
        filePath,
        folderId: folderInfo.folderId,
      },
    });
  } catch (err) {
    console.error("[UPLOAD] init error:", err);
    return serverError({
      headers: jsonHeaders,
      body: { success: false, error: err?.message || String(err) },
    });
  }
}

// Alias for Wix runtime loader
export async function use_uploadMedia(request) {
  return post_uploadMedia(request);
}

export async function options_uploadMediaFinalize() {
  return ok({ headers: jsonHeaders, body: { success: true } });
}

export async function post_uploadMediaFinalize(request) {
  try {
    console.log("[UPLOAD] build:", BUILD_TAG);
    const raw = await request.body.text();
    console.log("[UPLOAD] finalize raw:", raw);

    let body;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch (e) {
      return badRequest({ headers: jsonHeaders, body: { success: false, error: "Body must be JSON" } });
    }

    let fileId = body?.fileId || null;
    let trackingKey = body?.trackingKey || null;
    const fileName = normalizeFileName(
      body?.fileName ?? body?.name ?? body?.file?.name ?? body?.file?.fileName
    );
    const mimeType = normalizeMimeType(
      body?.mimeType ?? body?.type ?? body?.file?.type ?? body?.file?.mimeType ?? body?.file?.mimetype
    );

    // Normalize keys so we never produce "...~mv2.jpg~mv2.jpg"
    const origTrackingKey = trackingKey;
    const origFileId = fileId;
    trackingKey = normalizeMediaKey(trackingKey) || trackingKey;
    fileId = normalizeMediaKey(fileId) || fileId;
    if (origTrackingKey && trackingKey && origTrackingKey !== trackingKey) {
      console.log("[UPLOAD] finalize normalized trackingKey:", origTrackingKey, "=>", trackingKey);
    }
    if (origFileId && fileId && origFileId !== fileId) {
      console.log("[UPLOAD] finalize normalized fileId:", origFileId, "=>", fileId);
    }

    console.log("[UPLOAD] finalize params:", JSON.stringify({ fileId: !!fileId, trackingKey, fileName, mimeType }));

    if (!trackingKey && !fileId) {
      return badRequest({
        headers: jsonHeaders,
        body: { success: false, error: "Missing trackingKey/fileId" },
      });
    }

    // Derive extension and media type from mimeType or fileName
    let ext = "jpg";
    let isVideo = false;
    let isAudio = false;
    if (mimeType) {
      if (mimeType.includes("mp4") || mimeType.includes("video/mp4")) {
        ext = "mp4";
        isVideo = true;
      } else if (mimeType.includes("quicktime") || mimeType.includes("mov")) {
        ext = "mov";
        isVideo = true;
      } else if (mimeType.includes("m4v")) {
        ext = "m4v";
        isVideo = true;
      } else if (mimeType.startsWith("video/")) {
        isVideo = true;
        ext = "mp4"; // default video extension
      } else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
        isAudio = true;
        ext = "mp3";
      } else if (mimeType.includes("m4a") || mimeType.includes("aac")) {
        isAudio = true;
        ext = "m4a";
      } else if (mimeType.includes("wav")) {
        isAudio = true;
        ext = "wav";
      } else if (mimeType.includes("gif")) ext = "gif";
      else if (mimeType.includes("png")) ext = "png";
      else if (mimeType.includes("webp")) ext = "webp";
      else if (mimeType.includes("heic")) ext = "heic";
      else if (mimeType.includes("heif")) ext = "heif";
      else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
    } else if (fileName) {
      const parts = fileName.split(".");
      if (parts.length > 1) {
        const fileExt = parts.pop().toLowerCase();
        ext = fileExt;
        isVideo = fileExt === "mp4" || fileExt === "mov" || fileExt === "m4v";
        isAudio = fileExt === "m4a" || fileExt === "mp3" || fileExt === "aac" || fileExt === "wav";
      }
    }

    // Construct the public URL - videos use different format than images
    const baseId = trackingKey || fileId;
    let publicUrl;
    let publicUrlFile = null;
    if (isVideo) {
      // IMPORTANT: `.../file.mp4` can return 403. The `.../480p/mp4/file.mp4` variant is consistently public.
      publicUrl = `https://video.wixstatic.com/video/${baseId}/480p/mp4/file.mp4`;
      publicUrlFile = `https://video.wixstatic.com/video/${baseId}/file.mp4`;
    } else if (isAudio) {
      // Audio files use Wix's mp3/static audio path, not the image media/~mv2 path.
      publicUrl = `https://static.wixstatic.com/mp3/${baseId}.${ext}`;
    } else {
      // Image URL format: https://static.wixstatic.com/media/{trackingKey}~mv2.{ext}
      publicUrl = `https://static.wixstatic.com/media/${baseId}~mv2.${ext}`;
    }
    console.log("[UPLOAD] finalize publicUrl:", publicUrl, "isVideo:", isVideo, "publicUrlFile:", publicUrlFile);

    // Return URL immediately - Wix processes media in background
    // Videos may take 60+ seconds to process, but the URL will become available
    // The app can use this URL immediately (it will load once Wix finishes processing)
    return ok({ headers: jsonHeaders, body: { success: true, url: publicUrl, urlFile: publicUrlFile, pending: true } });
  } catch (err) {
    console.error("[UPLOAD] finalize error:", err);
    return serverError({
      headers: jsonHeaders,
      body: { success: false, error: err?.message || String(err) },
    });
  }
}

// Alias for Wix runtime loader
export async function use_uploadMediaFinalize(request) {
  return post_uploadMediaFinalize(request);
}
