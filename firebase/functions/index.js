const crypto = require("crypto");
const http2 = require("http2");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const JSZip = require("jszip");
const forge = require("node-forge");
const sharp = require("sharp");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const ffmpegPath = require("ffmpeg-static");

admin.initializeApp();

setGlobalOptions({
  region: "us-central1",
  maxInstances: 5,
});

function json(res, status, body) {
  res.status(status).set("Content-Type", "application/json").send(JSON.stringify(body));
}

async function fetchToFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destPath, bytes);
  return bytes.length;
}

function runFfmpeg(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, opts);
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 6000) stderr = stderr.slice(-6000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr}`));
    });
  });
}

async function composeInstagramStoryVideo({ videoUrl, overlayPngBase64 }) {
  if (!ffmpegPath) throw new Error("ffmpeg binary not available");
  if (!/^https?:\/\//i.test(String(videoUrl || ""))) {
    throw new Error("videoUrl must be an http(s) URL");
  }

  const overlay = decodeBase64Loose(overlayPngBase64);
  if (!overlay || overlay.length < 1000) throw new Error("overlayPngBase64 is missing or too small");
  if (overlay.length > 8 * 1024 * 1024) throw new Error("overlayPngBase64 is too large");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cuevas-ig-"));
  const inputVideoPath = path.join(tmpDir, "input.mp4");
  const overlayPath = path.join(tmpDir, "overlay.png");
  const outputPath = path.join(tmpDir, "output.mp4");

  try {
    const bytes = await fetchToFile(videoUrl, inputVideoPath);
    if (bytes > 120 * 1024 * 1024) throw new Error("Source video is too large for story composition");
    await fs.writeFile(overlayPath, overlay);

    const canvasW = 1080;
    const canvasH = 1920;
    const cardX = 160;
    const cardY = 500;
    const cardW = 760;
    const headerH = 160;
    const borderW = 8;
    const mediaX = cardX + borderW;
    const mediaY = cardY + headerH;
    const mediaW = cardW - borderW * 2;
    const mediaH = 860 - borderW;

    const filter =
      `color=c=0x0891B2:s=${canvasW}x${canvasH}:d=15[base];` +
      `[0:v]scale=${mediaW}:${mediaH}:force_original_aspect_ratio=increase,` +
      `crop=${mediaW}:${mediaH},setsar=1[vid];` +
      `[base][vid]overlay=${mediaX}:${mediaY}[framed];` +
      `[1:v]scale=${canvasW}:${canvasH}[overlay];` +
      `[framed][overlay]overlay=0:0:format=auto,fps=30,format=yuv420p[outv]`;

    await runFfmpeg([
      "-y",
      "-i",
      inputVideoPath,
      "-i",
      overlayPath,
      "-filter_complex",
      filter,
      "-map",
      "[outv]",
      "-map",
      "0:a?",
      "-t",
      "15",
      "-shortest",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const bucket = admin.storage().bucket();
    const objectPath = `instagram-shares/cuevas-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.mp4`;
    const downloadToken = crypto.randomUUID();
    await bucket.upload(outputPath, {
      destination: objectPath,
      metadata: {
        contentType: "video/mp4",
        cacheControl: "public, max-age=3600",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });
    const expires = Date.now() + 60 * 60 * 1000;
    const encodedPath = encodeURIComponent(objectPath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
    return { url, storagePath: objectPath, expires };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBuffer(s) {
  const raw = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = raw + "===".slice((raw.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function decodeBase64Loose(s) {
  const raw = String(s || "").trim();
  if (!raw) return Buffer.alloc(0);
  const cleaned = raw.replace(/^data:.*?;base64,/, "").replace(/\s+/g, "");
  return Buffer.from(cleaned, "base64");
}

function looksLikePem(s) {
  const t = String(s || "").trim();
  return t.startsWith("-----BEGIN ");
}

function parseX509CertFromSecret(secretValue, labelForLogs) {
  const s = String(secretValue || "").trim();
  if (!s) throw new Error(`${labelForLogs} secret is empty`);

  if (looksLikePem(s)) {
    return forge.pki.certificateFromPem(s);
  }

  const buf = decodeBase64Loose(s);
  if (!buf || buf.length < 32) {
    throw new Error(`${labelForLogs} looks too short after base64 decode (bytes=${buf ? buf.length : 0})`);
  }

  const maybeText = buf.toString("utf8");
  if (looksLikePem(maybeText)) {
    return forge.pki.certificateFromPem(maybeText);
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
    throw new Error(`${labelForLogs} looks too short after base64 decode (bytes=${buf ? buf.length : 0})`);
  }
  try {
    return forge.asn1.fromDer(buf.toString("binary"));
  } catch (e) {
    throw new Error(`${labelForLogs} DER parse failed: ${String(e && e.message ? e.message : e)}`);
  }
}

function sha1Hex(buf) {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

function sha256HmacBase64Url(secret, value) {
  return base64UrlEncode(crypto.createHmac("sha256", String(secret)).update(String(value)).digest());
}

function requireSecret(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing secret: ${name}`);
  return String(v);
}

function getSecretMaybe(name) {
  const v = process.env[name];
  return v ? String(v) : null;
}

function createWalletToken(payloadObj, hmacSecret) {
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = crypto.createHmac("sha256", hmacSecret).update(payload).digest();
  return `${payload}.${base64UrlEncode(sig)}`;
}

function verifyWalletToken(token, hmacSecret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false, error: "Bad token format" };
  const [payloadB64Url, sigB64Url] = parts;
  const expected = base64UrlEncode(crypto.createHmac("sha256", hmacSecret).update(payloadB64Url).digest());
  if (expected !== sigB64Url) return { ok: false, error: "Bad token signature" };
  try {
    const payload = JSON.parse(base64UrlDecodeToBuffer(payloadB64Url).toString("utf8"));
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: "Bad token payload" };
  }
}

function toIntPoints(n) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function walletSerialForEmail(email) {
  return `cuevas-${sha1Hex(normalizeEmail(email)).slice(0, 12)}`;
}

function googleWalletObjectId(issuerId, email) {
  return `${issuerId}.${sha1Hex(normalizeEmail(email)).slice(0, 20)}`;
}

function nowTag() {
  return String(Date.now());
}

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildStripSvg(width, height, points, email) {
  const coinSize = Math.round(height * 0.4);
  const coinTop = Math.round(height * 0.04);
  const pointsY = coinTop + coinSize + Math.round(height * 0.19);
  const cuevasLabelY = pointsY + Math.round(height * 0.08);
  const memberLabelY = cuevasLabelY + Math.round(height * 0.13);
  const emailY = memberLabelY + Math.round(height * 0.08);
  const pointsFont = Math.round(height * 0.17);
  const cuevasLabelFont = Math.round(height * 0.06);
  const memberLabelFont = Math.round(height * 0.04);
  const emailFont = Math.round(height * 0.055);
  const horizontalLines = [];
  const verticalLines = [];
  const lineSpacing = Math.max(3, Math.round(height / 80));
  const gridSpacing = Math.round(width / 18);

  for (let y = 0; y < height; y += lineSpacing) {
    horizontalLines.push(`<rect x="0" y="${y}" width="${width}" height="1" fill="rgb(6,167,161)" fill-opacity="0.10"/>`);
  }
  for (let x = 0; x < width; x += gridSpacing) {
    verticalLines.push(`<rect x="${x}" y="0" width="1" height="${height}" fill="rgb(6,167,161)" fill-opacity="0.05"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgb(14,42,52)"/>
        <stop offset="50%" stop-color="rgb(10,32,40)"/>
        <stop offset="100%" stop-color="rgb(8,25,32)"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="22%" r="30%">
        <stop offset="0%" stop-color="rgb(6,167,161)" stop-opacity="0.35"/>
        <stop offset="60%" stop-color="rgb(6,167,161)" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="rgb(6,167,161)" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    ${verticalLines.join("")}
    ${horizontalLines.join("")}
    <ellipse cx="${width / 2}" cy="${coinTop + coinSize / 2}" rx="${coinSize * 0.9}" ry="${coinSize * 0.7}" fill="url(#glow)"/>
    <text x="${width / 2}" y="${pointsY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${pointsFont}" font-weight="700" fill="rgb(207,239,236)">${points}</text>
    <text x="${width / 2}" y="${cuevasLabelY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${cuevasLabelFont}" font-weight="600" fill="rgb(6,167,161)" letter-spacing="${Math.round(cuevasLabelFont * 0.25)}">CUEVAS</text>
    <text x="${width / 2}" y="${memberLabelY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${memberLabelFont}" font-weight="600" fill="rgb(6,167,161)" letter-spacing="${Math.max(1, Math.round(memberLabelFont * 0.25))}">MEMBER</text>
    <text x="${width / 2}" y="${emailY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${emailFont}" font-weight="400" fill="rgb(207,239,236)">${escapeXml(email)}</text>
  </svg>`;
}

async function fetchCoinPng() {
  const coinUrl = getSecretMaybe("GOOGLE_WALLET_COIN_IMAGE_URL");
  if (!coinUrl) return null;

  const response = await fetch(coinUrl);
  if (!response.ok) throw new Error(`Coin image fetch failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function resizePng(input, width, height) {
  return sharp(input)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function makeStrip(width, height, coinPng, points, email) {
  const stripBase = await sharp(Buffer.from(buildStripSvg(width, height, points, email))).png().toBuffer();
  if (!coinPng) return stripBase;

  const coinSize = Math.round(height * 0.4);
  const coinTop = Math.round(height * 0.04);
  const coinResized = await resizePng(coinPng, coinSize, coinSize);
  return sharp(stripBase)
    .composite([
      {
        input: coinResized,
        left: Math.round((width - coinSize) / 2),
        top: coinTop,
      },
    ])
    .png()
    .toBuffer();
}

async function buildApplePassImages(points, email) {
  const transparentPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XhyoAAAAASUVORK5CYII=",
    "base64"
  );
  const coinPng = await fetchCoinPng().catch(() => null);
  const iconSource = coinPng || transparentPng;

  return {
    "icon.png": await resizePng(iconSource, 29, 29),
    "icon@2x.png": await resizePng(iconSource, 58, 58),
    "icon@3x.png": await resizePng(iconSource, 87, 87),
    "strip.png": await makeStrip(375, 144, coinPng, points, email),
    "strip@2x.png": await makeStrip(750, 288, coinPng, points, email),
    "strip@3x.png": await makeStrip(1125, 432, coinPng, points, email),
  };
}

async function getCuevasUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const snapshot = await admin
    .database()
    .ref("users")
    .orderByChild("email")
    .equalTo(normalized)
    .limitToFirst(1)
    .once("value");
  const data = snapshot.val() || {};
  const id = Object.keys(data)[0];
  return id ? { id, ...data[id] } : null;
}

async function getCurrentPointsForEmail(email, fallbackPoints = 0) {
  const user = await getCuevasUserByEmail(email).catch(() => null);
  if (!user) return toIntPoints(fallbackPoints);
  return toIntPoints(user.loyaltyPoints !== undefined ? user.loyaltyPoints : user.loyaltypoints !== undefined ? user.loyaltypoints : fallbackPoints);
}

async function recordWalletPassInstallIntent(email, points) {
  const normalized = normalizeEmail(email);
  const serialNumber = walletSerialForEmail(normalized);
  const issuerId = getSecretMaybe("GOOGLE_WALLET_ISSUER_ID");
  const updateTag = nowTag();
  const updates = {};
  updates[`wallet/applePasses/${serialNumber}`] = {
    email: normalized,
    serialNumber,
    points: toIntPoints(points),
    lastUpdated: updateTag,
    updatedAt: new Date().toISOString(),
  };
  if (issuerId) {
    updates[`wallet/googleObjects/${serialNumber}`] = {
      email: normalized,
      objectId: googleWalletObjectId(issuerId, normalized),
      points: toIntPoints(points),
      lastUpdated: updateTag,
      updatedAt: new Date().toISOString(),
    };
  }
  await admin.database().ref().update(updates);
  return { serialNumber, updateTag };
}

async function buildApplePkpass({ email, points }) {
  const passTypeIdentifier = requireSecret("APPLE_WALLET_PASS_TYPE_ID");
  const teamIdentifier = requireSecret("APPLE_WALLET_TEAM_ID");
  const organizationName = requireSecret("APPLE_WALLET_ORG_NAME");
  const hmacSecret = requireSecret("WALLET_TOKEN_HMAC_SECRET");
  const walletPassBaseUrl =
    getSecretMaybe("WALLET_PASS_BASE_URL") ||
    "https://walletpass-jn3jkugqpa-uc.a.run.app";
  const p12Base64 = requireSecret("APPLE_WALLET_CERT_P12_BASE64");
  const p12Password = requireSecret("APPLE_WALLET_CERT_PASSWORD");
  const wwdrBase64 = requireSecret("APPLE_WALLET_WWDR_CERT_BASE64");
  const wwdrCert = parseX509CertFromSecret(wwdrBase64, "APPLE_WALLET_WWDR_CERT_BASE64");
  const p12Asn1 = parsePkcs12FromSecretBase64(p12Base64, "APPLE_WALLET_CERT_P12_BASE64");
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, String(p12Password));

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const privateKey = keyBags[0] ? keyBags[0].key : null;
  const passCert = certBags[0] ? certBags[0].cert : null;
  if (!privateKey || !passCert) throw new Error("P12 is missing private key or certificate");

  const normalizedEmail = normalizeEmail(email);
  const serialNumber = walletSerialForEmail(normalizedEmail);
  const authenticationToken = createWalletToken(
    { v: 1, kind: "apple-pass-auth", email: normalizedEmail, serialNumber },
    hmacSecret
  );
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    organizationName,
    serialNumber,
    description: "Cuevas Rewards",
    logoText: "Cuevas Rewards",
    webServiceURL: walletPassBaseUrl.replace(/\/+$/, ""),
    authenticationToken,
    foregroundColor: "rgb(207, 239, 236)",
    backgroundColor: "rgb(8, 25, 32)",
    labelColor: "rgb(6, 167, 161)",
    storeCard: {
      primaryFields: [],
      secondaryFields: [
        {
          key: "member",
          label: "MEMBER",
          value: String(normalizedEmail),
        },
      ],
      auxiliaryFields: [
        {
          key: "status",
          label: "STATUS",
          value: "ACTIVE",
        },
        {
          key: "updated",
          label: "UPDATED",
          value: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        },
      ],
      backFields: [
        {
          key: "cuevasNote",
          label: "Cuevas Rewards",
          value: "This pass updates after mission check-ins when Apple Wallet refreshes it from Cuevas.",
        },
      ],
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: String(normalizedEmail),
        messageEncoding: "iso-8859-1",
        altText: String(normalizedEmail),
      },
    ],
  };

  const images = await buildApplePassImages(points, normalizedEmail);

  const files = {
    ...images,
    "pass.json": Buffer.from(JSON.stringify(passJson), "utf8"),
  };

  const manifest = {};
  for (const [name, buf] of Object.entries(files)) manifest[name] = sha1Hex(buf);
  const manifestBuf = Buffer.from(JSON.stringify(manifest), "utf8");

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestBuf.toString("binary"));
  p7.addCertificate(passCert);
  p7.addCertificate(wwdrCert);
  p7.addSigner({
    key: privateKey,
    certificate: passCert,
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

  const zip = new JSZip();
  for (const [name, buf] of Object.entries(files)) zip.file(name, buf);
  zip.file("manifest.json", manifestBuf);
  zip.file("signature", signatureBuf);
  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function buildGoogleWalletSaveUrl({ issuerId, serviceAccountJsonBase64, email, points, coinImageUrl }) {
  const saJson = JSON.parse(Buffer.from(String(serviceAccountJsonBase64), "base64").toString("utf8"));
  const privateKey = saJson.private_key;
  const clientEmail = saJson.client_email;
  if (!privateKey || !clientEmail) throw new Error("Service account JSON missing private_key/client_email");

  const classId = `${issuerId}.cuevas_rewards`;
  const normalizedEmail = normalizeEmail(email);
  const objectId = googleWalletObjectId(issuerId, normalizedEmail);
  const localized = (value) => ({ defaultValue: { language: "en-US", value } });
  const image = (uri, description) => ({
    sourceUri: { uri },
    contentDescription: localized(description),
  });
  const genericClass = {
    id: classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['points'].body" }] } },
              endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['email'].body" }] } },
            },
          },
        ],
      },
    },
  };

  const genericObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    heroImage: coinImageUrl ? image(coinImageUrl, "Cuevas coin") : undefined,
    logo: coinImageUrl ? image(coinImageUrl, "Cuevas logo") : undefined,
    cardTitle: localized("Cuevas Rewards"),
    header: localized(`${points} Cuevas`),
    subheader: localized(String(normalizedEmail)),
    hexBackgroundColor: "#081920",
    barcode: { type: "QR_CODE", value: String(normalizedEmail), alternateText: String(normalizedEmail) },
    textModulesData: [
      { id: "points", header: "Points", body: String(points) },
      { id: "email", header: "Email", body: String(normalizedEmail) },
    ],
  };
  if (!genericObject.heroImage) delete genericObject.heroImage;
  if (!genericObject.logo) delete genericObject.logo;

  const nowSec = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtPayload = {
    iss: clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: nowSec,
    origins: [],
    payload: {
      genericClasses: [genericClass],
      genericObjects: [genericObject],
    },
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(jwtHeader))}.${base64UrlEncode(JSON.stringify(jwtPayload))}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(privateKey, "base64");
  const jwt = `${signingInput}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
  return `https://pay.google.com/gp/v/save/${encodeURIComponent(jwt)}`;
}

async function getGoogleWalletAccessToken(serviceAccountJsonBase64) {
  const saJson = JSON.parse(Buffer.from(String(serviceAccountJsonBase64), "base64").toString("utf8"));
  const privateKey = saJson.private_key;
  const clientEmail = saJson.client_email;
  if (!privateKey || !clientEmail) throw new Error("Service account JSON missing private_key/client_email");

  const nowSec = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtPayload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(jwtHeader))}.${base64UrlEncode(JSON.stringify(jwtPayload))}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(privateKey, "base64");
  const assertion = `${signingInput}.${signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(`Google Wallet token failed: HTTP ${response.status} ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.access_token;
}

async function patchGoogleWalletObject({ email, points }) {
  const issuerId = getSecretMaybe("GOOGLE_WALLET_ISSUER_ID");
  const serviceAccountJsonBase64 = getSecretMaybe("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64");
  if (!issuerId || !serviceAccountJsonBase64) return { skipped: true, reason: "missing-google-wallet-config" };

  const normalizedEmail = normalizeEmail(email);
  const objectId = googleWalletObjectId(issuerId, normalizedEmail);
  const localized = (value) => ({ defaultValue: { language: "en-US", value } });
  const accessToken = await getGoogleWalletAccessToken(serviceAccountJsonBase64);
  const body = {
    header: localized(`${toIntPoints(points)} Cuevas`),
    subheader: localized(normalizedEmail),
    barcode: { type: "QR_CODE", value: normalizedEmail, alternateText: normalizedEmail },
    textModulesData: [
      { id: "points", header: "Points", body: String(toIntPoints(points)) },
      { id: "email", header: "Email", body: normalizedEmail },
    ],
  };
  const response = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${encodeURIComponent(objectId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (response.status === 404) return { skipped: true, reason: "google-object-not-saved-yet", objectId };
  if (!response.ok) throw new Error(`Google Wallet patch failed: HTTP ${response.status} ${JSON.stringify(data).slice(0, 200)}`);
  return { updated: true, objectId };
}

function applePassClientCert() {
  const p12Base64 = requireSecret("APPLE_WALLET_CERT_P12_BASE64");
  const p12Password = requireSecret("APPLE_WALLET_CERT_PASSWORD");
  const p12Asn1 = parsePkcs12FromSecretBase64(
    p12Base64,
    "APPLE_WALLET_CERT_P12_BASE64"
  );
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, String(p12Password));
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] || [];
  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ] || [];
  const privateKey = keyBags[0] ? keyBags[0].key : null;
  const passCert = certBags[0] ? certBags[0].cert : null;
  if (!privateKey || !passCert) {
    throw new Error("P12 is missing private key or certificate");
  }
  return {
    key: forge.pki.privateKeyToPem(privateKey),
    cert: forge.pki.certificateToPem(passCert),
  };
}

async function sendAppleWalletPush(pushToken) {
  const passTypeIdentifier = requireSecret("APPLE_WALLET_PASS_TYPE_ID");
  const clientCert = applePassClientCert();

  return new Promise((resolve) => {
    const client = http2.connect("https://api.push.apple.com", clientCert);
    const chunks = [];
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      client.close();
      resolve(result);
    };
    client.on("error", (error) => finish({ ok: false, error: String(error && error.message ? error.message : error) }));
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${pushToken}`,
      "apns-topic": passTypeIdentifier,
      "apns-push-type": "background",
      "content-type": "application/json",
    });
    req.setEncoding("utf8");
    req.on("response", (headers) => {
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const status = Number(headers[":status"] || 0);
        finish({ ok: status >= 200 && status < 300, status, body: chunks.join("") });
      });
    });
    req.on("error", (error) => finish({ ok: false, error: String(error && error.message ? error.message : error) }));
    req.end("{}");
  });
}

async function refreshWalletsForEmail(email, points) {
  const normalizedEmail = normalizeEmail(email);
  const safePoints = toIntPoints(points);
  if (!normalizedEmail) return { apple: { skipped: true }, google: { skipped: true } };

  const serialNumber = walletSerialForEmail(normalizedEmail);
  const updateTag = nowTag();
  await admin.database().ref(`wallet/applePasses/${serialNumber}`).update({
    email: normalizedEmail,
    serialNumber,
    points: safePoints,
    lastUpdated: updateTag,
    updatedAt: new Date().toISOString(),
  });

  const google = await patchGoogleWalletObject({ email: normalizedEmail, points: safePoints }).catch((error) => ({
    ok: false,
    error: String(error && error.message ? error.message : error),
  }));

  const regsSnap = await admin.database().ref(`wallet/appleRegistrations/${serialNumber}`).once("value");
  const registrations = regsSnap.val() || {};
  const appleResults = [];
  for (const [deviceLibraryIdentifier, registration] of Object.entries(registrations)) {
    if (!registration || !registration.pushToken) continue;
    const result = await sendAppleWalletPush(registration.pushToken).catch((error) => ({
      ok: false,
      error: String(error && error.message ? error.message : error),
    }));
    appleResults.push({ deviceLibraryIdentifier, ...result });
  }

  return { serialNumber, points: safePoints, apple: appleResults, google };
}

function bearerApplePassToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || "");
  return header.replace(/^ApplePass\s+/i, "").trim();
}

function verifyApplePassAuth(req, serialNumber) {
  const token = bearerApplePassToken(req);
  if (!token) return { ok: false, error: "Missing ApplePass auth token" };
  const verified = verifyWalletToken(token, requireSecret("WALLET_TOKEN_HMAC_SECRET"));
  if (!verified.ok) return verified;
  const payload = verified.payload || {};
  if (payload.kind !== "apple-pass-auth") return { ok: false, error: "Wrong token kind" };
  if (String(payload.serialNumber || "") !== String(serialNumber || "")) {
    return { ok: false, error: "Token serial mismatch" };
  }
  return { ok: true, payload };
}

async function handleAppleRegistration(req, res, parts) {
  const deviceLibraryIdentifier = parts[2];
  const passTypeIdentifier = parts[4];
  const serialNumber = parts[5];
  if (!deviceLibraryIdentifier || !passTypeIdentifier || !serialNumber) {
    return json(res, 400, { success: false, error: "Bad Apple registration path" });
  }

  const verified = verifyApplePassAuth(req, serialNumber);
  if (!verified.ok) return json(res, 401, { success: false, error: verified.error || "Unauthorized" });

  if (req.method === "DELETE") {
    await admin.database().ref(`wallet/appleRegistrations/${serialNumber}/${deviceLibraryIdentifier}`).remove();
    await admin.database().ref(`wallet/appleDevices/${deviceLibraryIdentifier}/${serialNumber}`).remove();
    return res.status(200).send("");
  }

  if (req.method !== "POST") return json(res, 405, { success: false, error: "Use POST or DELETE" });
  const pushToken = String((req.body && req.body.pushToken) || "").trim();
  if (!pushToken) return json(res, 400, { success: false, error: "Missing pushToken" });

  const email = normalizeEmail(verified.payload.email);
  const registrationRef = admin.database().ref(`wallet/appleRegistrations/${serialNumber}/${deviceLibraryIdentifier}`);
  const existing = await registrationRef.once("value");
  const record = {
    deviceLibraryIdentifier,
    passTypeIdentifier,
    serialNumber,
    email,
    pushToken,
    updatedAt: new Date().toISOString(),
  };
  await registrationRef.set(record);
  await admin.database().ref(`wallet/appleDevices/${deviceLibraryIdentifier}/${serialNumber}`).set({
    serialNumber,
    passTypeIdentifier,
    email,
    updatedAt: new Date().toISOString(),
  });
  await recordWalletPassInstallIntent(email, await getCurrentPointsForEmail(email));
  return res.status(existing.exists() ? 200 : 201).send("");
}

async function handleAppleUpdatedSerials(req, res, parts) {
  const deviceLibraryIdentifier = parts[2];
  const passTypeIdentifier = String(parts[4] || "");
  if (!deviceLibraryIdentifier || !passTypeIdentifier) {
    return json(res, 400, { success: false, error: "Bad Apple updated-serials path" });
  }
  const passesUpdatedSince = String((req.query && req.query.passesUpdatedSince) || "0");
  const deviceSnap = await admin.database().ref(`wallet/appleDevices/${deviceLibraryIdentifier}`).once("value");
  const devicePasses = deviceSnap.val() || {};
  const serialNumbers = [];
  let lastUpdated = passesUpdatedSince;
  for (const serialNumber of Object.keys(devicePasses)) {
    const item = devicePasses[serialNumber];
    if (!item || item.passTypeIdentifier !== passTypeIdentifier) continue;
    const passSnap = await admin.database().ref(`wallet/applePasses/${serialNumber}`).once("value");
    const pass = passSnap.val() || {};
    const updated = String(pass.lastUpdated || "0");
    if (!passesUpdatedSince || Number(updated) > Number(passesUpdatedSince)) serialNumbers.push(serialNumber);
    if (Number(updated) > Number(lastUpdated || 0)) lastUpdated = updated;
  }
  if (!serialNumbers.length) return res.status(204).send("");
  return json(res, 200, { serialNumbers, lastUpdated: String(lastUpdated || nowTag()) });
}

async function handleAppleLatestPass(req, res, parts) {
  const passTypeIdentifier = parts[2];
  const serialNumber = parts[3];
  if (!passTypeIdentifier || !serialNumber) return json(res, 400, { success: false, error: "Bad Apple pass path" });

  const verified = verifyApplePassAuth(req, serialNumber);
  if (!verified.ok) return json(res, 401, { success: false, error: verified.error || "Unauthorized" });

  const passSnap = await admin.database().ref(`wallet/applePasses/${serialNumber}`).once("value");
  const pass = passSnap.val() || {};
  const email = normalizeEmail(pass.email || verified.payload.email);
  if (!email) return json(res, 404, { success: false, error: "Pass not found" });
  const points = await getCurrentPointsForEmail(email, pass.points);
  await recordWalletPassInstallIntent(email, points);
  const pkpass = await buildApplePkpass({ email, points });
  res
    .status(200)
    .set("Content-Type", "application/vnd.apple.pkpass")
    .set("Content-Disposition", `inline; filename=\"${serialNumber}.pkpass\"`)
    .set("Cache-Control", "no-store")
    .send(pkpass);
}

async function handleApplePassWebService(req, res, parts) {
  if (req.method === "POST" && parts[1] === "log") {
    console.log("[APPLE_WALLET_LOG]", JSON.stringify(req.body || {}).slice(0, 1000));
    return res.status(200).send("");
  }

  if (parts[1] === "devices" && parts[3] === "registrations" && parts.length >= 6) {
    return handleAppleRegistration(req, res, parts);
  }
  if (req.method === "GET" && parts[1] === "devices" && parts[3] === "registrations") {
    return handleAppleUpdatedSerials(req, res, parts);
  }
  if (req.method === "GET" && parts[1] === "passes") {
    return handleAppleLatestPass(req, res, parts);
  }
  return json(res, 404, { success: false, error: "Unknown Apple Wallet web-service route" });
}

exports.walletLinks = onRequest(
  {
    cors: true,
    secrets: [
      "APPLE_WALLET_PASS_TYPE_ID",
      "APPLE_WALLET_TEAM_ID",
      "APPLE_WALLET_ORG_NAME",
      "APPLE_WALLET_CERT_P12_BASE64",
      "APPLE_WALLET_CERT_PASSWORD",
      "APPLE_WALLET_WWDR_CERT_BASE64",
      "WALLET_TOKEN_HMAC_SECRET",
      "GOOGLE_WALLET_ISSUER_ID",
      "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64",
      "GOOGLE_WALLET_COIN_IMAGE_URL",
      "WALLET_PASS_BASE_URL",
    ],
  },
  async (req, res) => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "POST") return json(res, 405, { success: false, error: "Use POST" });

      const body = req.body || {};
      const email = String(body.email || "").trim();
      const rewardsBalance = body.rewardsBalance;
      if (!email) return json(res, 400, { success: false, error: "Missing email" });

      const points = await getCurrentPointsForEmail(email, rewardsBalance);
      const hmacSecret = requireSecret("WALLET_TOKEN_HMAC_SECRET");
      const token = createWalletToken(
        { v: 1, kind: "apple-pass-download", email: normalizeEmail(email), points, iat: Date.now() },
        hmacSecret
      );

      // IMPORTANT: walletLinks and walletPass are deployed as two separate Cloud Run
      // services with different hosts. Use WALLET_PASS_BASE_URL so the returned URL
      // hits the walletPass service, not walletLinks.
      const walletPassBaseUrl =
        getSecretMaybe("WALLET_PASS_BASE_URL") || "https://walletpass-jn3jkugqpa-uc.a.run.app";
      const walletPassUrl = `${walletPassBaseUrl.replace(/\/+$/, "")}/pass.pkpass?token=${encodeURIComponent(
        token
      )}`;
      await recordWalletPassInstallIntent(email, points);

      let google = undefined;
      const issuerId = getSecretMaybe("GOOGLE_WALLET_ISSUER_ID");
      const saB64 = getSecretMaybe("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64");
      if (issuerId && saB64) {
        try {
          const coinImageUrl = getSecretMaybe("GOOGLE_WALLET_COIN_IMAGE_URL");
          const saveUrl = buildGoogleWalletSaveUrl({ issuerId, serviceAccountJsonBase64: saB64, email, points, coinImageUrl });
          google = { saveUrl };
        } catch (e) {
          google = { error: String(e && e.message ? e.message : e) };
        }
      }

      return json(res, 200, {
        success: true,
        points,
        apple: { downloadUrl: walletPassUrl },
        google,
      });
    } catch (e) {
      return json(res, 500, { success: false, error: String(e && e.message ? e.message : e) });
    }
  }
);

exports.instagramStoryVideo = onRequest(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: "2GiB",
    maxInstances: 2,
  },
  async (req, res) => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "POST") return json(res, 405, { success: false, error: "Use POST" });

      const body = req.body || {};
      const videoUrl = String(body.videoUrl || "").trim();
      const overlayPngBase64 = String(body.overlayPngBase64 || "");
      if (!videoUrl) return json(res, 400, { success: false, error: "Missing videoUrl" });
      if (!overlayPngBase64) return json(res, 400, { success: false, error: "Missing overlayPngBase64" });

      const result = await composeInstagramStoryVideo({ videoUrl, overlayPngBase64 });
      return json(res, 200, { success: true, ...result });
    } catch (e) {
      console.error("[instagramStoryVideo]", e);
      return json(res, 500, { success: false, error: String(e && e.message ? e.message : e) });
    }
  }
);

exports.walletPass = onRequest(
  {
    cors: true,
    secrets: [
      "APPLE_WALLET_PASS_TYPE_ID",
      "APPLE_WALLET_TEAM_ID",
      "APPLE_WALLET_ORG_NAME",
      "APPLE_WALLET_CERT_P12_BASE64",
      "APPLE_WALLET_CERT_PASSWORD",
      "APPLE_WALLET_WWDR_CERT_BASE64",
      "WALLET_TOKEN_HMAC_SECRET",
      "GOOGLE_WALLET_COIN_IMAGE_URL",
      "GOOGLE_WALLET_ISSUER_ID",
      "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64",
      "WALLET_PASS_BASE_URL",
    ],
  },
  async (req, res) => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");

      const path = String(req.path || req.url || "").split("?")[0];
      const parts = path.split("/").filter(Boolean);
      if (parts[0] === "v1") {
        return handleApplePassWebService(req, res, parts);
      }

      const token = String((req.query && req.query.token) || "");
      if (!token) return json(res, 400, { success: false, error: "Missing token" });

      const verified = verifyWalletToken(token, requireSecret("WALLET_TOKEN_HMAC_SECRET"));
      if (!verified.ok) return json(res, 403, { success: false, error: "Invalid token" });

      const payload = verified.payload || {};
      const email = String(payload.email || "").trim();
      const points = await getCurrentPointsForEmail(email, payload.points);
      if (!email) return json(res, 400, { success: false, error: "Token missing email" });

      await recordWalletPassInstallIntent(email, points);
      const pkpass = await buildApplePkpass({ email, points });
      const filename = `cuevas-${sha1Hex(email).slice(0, 8)}.pkpass`;
      res
        .status(200)
        .set("Content-Type", "application/vnd.apple.pkpass")
        .set("Content-Disposition", `inline; filename=\"${filename}\"`)
        .set("Cache-Control", "no-store")
        .send(pkpass);
    } catch (e) {
      return json(res, 500, { success: false, error: String(e && e.message ? e.message : e) });
    }
  }
);

exports.walletRefresh = onRequest(
  {
    cors: true,
    secrets: [
      "WALLET_TOKEN_HMAC_SECRET",
      "APPLE_WALLET_PASS_TYPE_ID",
      "APPLE_WALLET_CERT_P12_BASE64",
      "APPLE_WALLET_CERT_PASSWORD",
      "GOOGLE_WALLET_ISSUER_ID",
      "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64",
    ],
  },
  async (req, res) => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "POST") return json(res, 405, { success: false, error: "Use POST" });
      const body = req.body || {};
      const email = normalizeEmail(body.email);
      const points = toIntPoints(body.points);
      const ts = String(body.ts || "");
      const sig = String(body.sig || "");
      if (!email || !ts || !sig) return json(res, 400, { success: false, error: "Missing email, ts, or sig" });
      if (Math.abs(Date.now() - Number(ts)) > 10 * 60 * 1000) {
        return json(res, 401, { success: false, error: "Expired wallet refresh request" });
      }
      const expected = sha256HmacBase64Url(requireSecret("WALLET_TOKEN_HMAC_SECRET"), `${email}:${points}:${ts}`);
      if (expected !== sig) return json(res, 401, { success: false, error: "Bad wallet refresh signature" });

      const result = await refreshWalletsForEmail(email, points);
      return json(res, 200, { success: true, ...result });
    } catch (e) {
      return json(res, 500, { success: false, error: String(e && e.message ? e.message : e) });
    }
  }
);
