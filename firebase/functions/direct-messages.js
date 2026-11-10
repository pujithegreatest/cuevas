const admin = require("firebase-admin");
const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { onValueDeleted } = require("firebase-functions/v2/database");
const { fail, key, handle, participants, directId, member, messageText, stamp, missionShare } = require("./dm-core");
const passwordPepper = defineSecret("CUEVAS_CLIENT_KEY");
const db = () => admin.database();
const read = async (path) => (await db().ref(path).get()).val();
const GOOGLE_CLIENTS = new Set([
  "863626649134-qti4ohta0m03uhaetm4l8urra7s66d0m.apps.googleusercontent.com",
  "863626649134-t9glfa6lnl1s1t840s7n1u9olgmkok5l.apps.googleusercontent.com",
  "863626649134-vun8tehljbs51ih61ccomheqhhjmtfnf.apps.googleusercontent.com",
]);

async function jsonFetch(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  if (!response.ok) fail("Identity verification failed. Sign in again.", 401);
  return response.json();
}
async function rateLimit(scope, limit) {
  const bucket = Math.floor(Date.now() / 60000);
  const ref = db().ref(`dmRate/${crypto.createHash("sha256").update(scope).digest("hex")}`);
  const result = await ref.transaction((current) => {
    const count = current?.bucket === bucket ? current.count : 0;
    if (count >= limit) return;
    return { bucket, count: count + 1 };
  });
  if (!result.committed) fail("Too many requests. Try again in a minute.", 429);
}
async function accountByEmail(email) {
  const matches = (await db().ref("users").orderByChild("email").equalTo(email).limitToFirst(2).get()).val() || {};
  const entries = Object.entries(matches);
  if (entries.length !== 1) fail("Account could not be verified.", 401);
  return { uid: entries[0][0], user: entries[0][1] };
}
async function authenticate(body) {
  let email = String(body.email || "").trim().toLowerCase();
  let account;
  if (body.googleToken) {
    const token = String(body.googleToken);
    const info = await jsonFetch("https://oauth2.googleapis.com/tokeninfo?" + new URLSearchParams(
      token.split(".").length === 3 ? { id_token: token } : { access_token: token }
    ));
    if (!GOOGLE_CLIENTS.has(info.aud || info.audience || info.azp) || Number(info.expires_in || 0) <= 0) fail("Invalid Google authorization.", 401);
    if (info.email_verified !== true && info.email_verified !== "true" && info.verified_email !== true) fail("Google email is not verified.", 401);
    const verifiedEmail = String(info.email || "").toLowerCase();
    if (!verifiedEmail || (email && email !== verifiedEmail)) fail("Account mismatch.", 401);
    account = await accountByEmail(verifiedEmail);
  } else if (body.appleIdentityToken) {
    const parts = String(body.appleIdentityToken).split(".");
    if (parts.length !== 3) fail("Invalid Apple authorization.", 401);
    const header = JSON.parse(Buffer.from(parts[0], "base64url"));
    const claims = JSON.parse(Buffer.from(parts[1], "base64url"));
    const jwks = await jsonFetch("https://appleid.apple.com/auth/keys");
    const jwk = jwks.keys.find((item) => item.kid === header.kid && item.alg === "RS256");
    if (header.alg !== "RS256" || !jwk || !crypto.verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"))) fail("Invalid Apple signature.", 401);
    if (claims.iss !== "https://appleid.apple.com" || claims.aud !== "com.ecothot.cuevas" || claims.exp <= Date.now() / 1000 || claims.sub !== body.appleUserId) fail("Invalid Apple authorization.", 401);
    const users = await read("users") || {};
    const found = Object.entries(users).filter(([, user]) => user.appleUserId === claims.sub);
    if (found.length !== 1) fail("Apple account could not be verified.", 401);
    account = { uid: found[0][0], user: found[0][1] };
  } else {
    if (!email || typeof body.password !== "string" || !body.password) fail("Sign in again to enable private messaging.", 401);
    account = await accountByEmail(email);
    const response = await fetch("https://www.ecothot.com/_functions/verifyMessagingPassword", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: body.password, clientKey: passwordPepper.value() }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401 || response.status === 403) fail("Incorrect email or password.", 401);
    if (!response.ok) fail("Password verification is temporarily unavailable. Please try again.", 503);
    const proof = await response.json();
    if (proof.success !== true || proof.verified !== true || proof.email !== email || proof.uid !== account.uid) fail("Account could not be verified.", 401);
  }
  key(account.uid);
  const token = await admin.auth().createCustomToken(account.uid, { dmAccount: stamp(account.user) });
  return { token, uid: account.uid, email: account.user.email };
}
function publicUser(uid, user) {
  return { uid, handle: handle(user.handle || user.userHandle || user.username), name: String(user.displayName || user.handle || "Cuevas member").slice(0, 100) };
}
async function blocked(a, b) {
  return Boolean(await read(`dm/blocks/${a}/${b}`) || await read(`dm/blocks/${b}/${a}`));
}
async function notify(chatId, chat, sender) {
  const recipients = Object.keys(chat.members).filter((uid) => uid !== sender && chat.members[uid]);
  for (const uid of recipients) {
    if (await blocked(sender, uid)) continue;
    const tokens = await read(`dmDevices/${uid}`) || {};
    const entries = Object.entries(tokens).filter(([, device]) => device.token && Date.now() - device.updatedAt < 60 * 86400000).slice(0, 10);
    if (!entries.length) continue;
    const result = await admin.messaging().sendEachForMulticast({
      tokens: entries.map(([, device]) => device.token),
      notification: { title: "Cuevas", body: "You have a new message." },
      data: { type: "dm", conversationId: chatId },
      android: { notification: { channelId: "messages" } },
      apns: { payload: { aps: { sound: "default" } } },
    });
    const updates = {};
    result.responses.forEach((response, i) => {
      if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(response.error?.code)) updates[entries[i][0]] = null;
    });
    if (Object.keys(updates).length) await db().ref(`dmDevices/${uid}`).update(updates);
  }
}
async function dispatch(uid, user, body) {
  const action = body.action;
  if (action === "blocked") {
    const ids = Object.keys(await read(`dm/blocks/${uid}`) || {});
    const people = [];
    for (const id of ids) { const record = await read(`users/${id}`); if (record) people.push(publicUser(id, record)); }
    return { people };
  }
  if (action === "blockHandles") {
    if (!Array.isArray(body.handles) || body.handles.length > 500) fail("Invalid block list.");
    const handles = new Set(body.handles.map(handle));
    const users = await read("users") || {};
    const updates = {};
    for (const [id, record] of Object.entries(users)) if (id !== uid && handles.has(publicUser(id, record).handle)) updates[id] = true;
    if (Object.keys(updates).length) await db().ref(`dm/blocks/${uid}`).update(updates);
    return {};
  }
  if (action === "people") {
    const query = handle(body.query);
    if (query.length < 2 || query.length > 80) return { people: [] };
    const users = await read("users") || {};
    const people = [];
    for (const [id, record] of Object.entries(users)) {
      const person = publicUser(id, record);
      if (id !== uid && person.handle && (person.handle.includes(query) || person.name.toLowerCase().includes(query)) && !(await blocked(uid, id))) people.push(person);
      if (people.length === 20) break;
    }
    return { people };
  }
  if (action === "inbox") {
    const entries = await read(`dm/inbox/${uid}`) || {};
    const conversations = [];
    for (const [id, entry] of Object.entries(entries).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0)).slice(0, 100)) {
      const chat = await read(`dm/chats/${id}/meta`);
      if (!chat?.members?.[uid]) continue;
      conversations.push({ id, ...chat, unread: Boolean(chat.lastSender && (entry.lastReadAt || 0) < (chat.updatedAt || 0) && chat.lastSender !== uid) });
    }
    return { conversations, uid };
  }
  if (action === "create") {
    await rateLimit(`create:${uid}`, 10);
    const ids = participants(uid, body.participants);
    const people = {};
    for (const id of ids) {
      const record = await read(`users/${id}`);
      if (!record || (id !== uid && await blocked(uid, id))) fail("One of these people is unavailable.", 403);
      people[id] = publicUser(id, record);
    }
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      if (await blocked(ids[i], ids[j])) fail("These people cannot be added to the same conversation.", 403);
    }
    // Never expose an existing direct thread's history to newly added members.
    const id = ids.length === 2 ? directId(ids) : db().ref("dm/chats").push().key;
    const meta = { members: Object.fromEntries(ids.map((id) => [id, true])), people, type: ids.length === 2 ? "direct" : "group", title: String(body.title || "").trim().slice(0, 80), createdAt: Date.now(), updatedAt: Date.now() };
    await db().ref(`dm/chats/${id}/meta`).transaction((current) => current || meta);
    const saved = member(await read(`dm/chats/${id}/meta`), uid);
    const updates = {};
    for (const person of ids) {
      updates[`dm/inbox/${person}/${id}/updatedAt`] = saved.updatedAt;
      updates[`dm/userChats/${person}/${id}`] = true;
    }
    await db().ref().update(updates);
    return { conversation: { id, ...saved } };
  }
  if (action === "device") {
    const deviceId = key(body.deviceId);
    const token = typeof body.token === "string" ? body.token : "";
    if (token.length > 4096) fail("Invalid device token.");
    // A device belongs to only one signed-in account at a time.
    const previous = await read(`dmDeviceOwners/${deviceId}`);
    const updates = {};
    if (previous && previous !== uid) updates[`dmDevices/${previous}/${deviceId}`] = null;
    updates[`dmDevices/${uid}/${deviceId}`] = token ? { token, updatedAt: Date.now() } : null;
    updates[`dmDeviceOwners/${deviceId}`] = token ? uid : null;
    await db().ref().update(updates);
    return {};
  }
  if (action === "block") {
    const target = key(body.targetUid);
    if (target === uid) fail("You cannot block yourself.");
    await db().ref(`dm/blocks/${uid}/${target}`).set(body.blocked === false ? null : true);
    return {};
  }
  const id = key(body.conversationId);
  const chat = member(await read(`dm/chats/${id}/meta`), uid);
  if (action === "messages") {
    const before = Number(body.before);
    let query = db().ref(`dm/chats/${id}/messages`).orderByChild("createdAt");
    if (Number.isFinite(before) && before > 0) query = query.endAt(before - 1);
    const data = (await query.limitToLast(50).get()).val() || {};
    const messages = Object.entries(data).map(([id, value]) => ({ id, ...value })).sort((a, b) => a.createdAt - b.createdAt);
    await db().ref(`dm/inbox/${uid}/${id}/lastReadAt`).set(chat.updatedAt || Date.now());
    return { messages, conversation: { id, ...chat }, hasMore: messages.length === 50 };
  }
  if (action === "send") {
    await rateLimit(`send:${uid}`, 30);
    const attachment = missionShare(body.missionShare);
    const text = attachment && (body.text === undefined || body.text === "") ? "" : messageText(body.text);
    const messageId = key(body.messageId);
    for (const recipient of Object.keys(chat.members)) {
      if (recipient !== uid && chat.members[recipient] && await blocked(uid, recipient)) fail("Messaging is blocked for this conversation.", 403);
    }
    const message = { text, sender: uid, createdAt: Date.now(), ...(attachment ? { missionShare: attachment } : {}) };
    const saved = await db().ref(`dm/chats/${id}/messages/${messageId}`).transaction((current) => current ? undefined : message);
    if (!saved.committed) return { message: { id: messageId, ...saved.snapshot.val() } };
    const updates = { [`dm/chats/${id}/meta/updatedAt`]: message.createdAt, [`dm/chats/${id}/meta/lastSender`]: uid };
    for (const recipient of Object.keys(chat.members)) if (chat.members[recipient]) updates[`dm/inbox/${recipient}/${id}/updatedAt`] = message.createdAt;
    updates[`dm/inbox/${uid}/${id}/lastReadAt`] = message.createdAt;
    await db().ref().update(updates);
    try { await notify(id, chat, uid); } catch (error) { console.error("DM notification delivery failed", error.code || "unknown"); }
    return { message: { id: messageId, ...message } };
  }
  if (action === "report") {
    const messageId = key(body.messageId);
    const message = await read(`dm/chats/${id}/messages/${messageId}`);
    if (!message) fail("Message not found.", 404);
    const reasons = ["Harassment", "Hate or threats", "Sexual content", "Child safety or exploitation", "Spam or scam", "Other"];
    if (!reasons.includes(body.reason)) fail("Choose a report reason.");
    await db().ref("dmReports").push({ conversationId: id, messageId, reporter: uid, sender: message.sender, text: message.text, ...(message.missionShare ? { missionShare: message.missionShare } : {}), reason: body.reason, createdAt: Date.now(), status: "pending" });
    return {};
  }
  if (action === "leave") {
    if (chat.type !== "group") fail("Only group conversations can be left.");
    await db().ref().update({ [`dm/chats/${id}/meta/members/${uid}`]: null, [`dm/inbox/${uid}/${id}`]: null });
    return {};
  }
  fail("Unknown messaging action.");
}

exports.directMessages = onRequest({ region: "us-central1", cors: true, secrets: [passwordPepper], maxInstances: 5, timeoutSeconds: 60 }, async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST required." });
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Buffer.byteLength(JSON.stringify(body)) > 20000) fail("Invalid request.");
    if (body.action === "authenticate") {
      await rateLimit(`auth:${req.ip}`, 15);
      return res.json(await authenticate(body));
    }
    const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
    let claims;
    try { claims = await admin.auth().verifyIdToken(token, true); } catch { fail("Sign in again to enable private messaging.", 401); }
    const uid = key(claims.uid);
    const user = await read(`users/${uid}`);
    if (!user || !claims.dmAccount || claims.dmAccount !== stamp(user)) fail("Account authorization expired. Sign in again.", 401);
    await rateLimit(`requests:${uid}`, 180);
    res.json(await dispatch(uid, user, body));
  } catch (error) {
    if (!error.status) console.error("DM request failed", error.code || error.name, String(error.stack || "").split("\n").slice(1, 5).join("\n"));
    res.status(error.status || 500).json({ error: error.status ? error.message : "Messaging is temporarily unavailable. Please try again." });
  }
});

exports.deleteMessagingAccount = onValueDeleted({ ref: "/users/{uid}", region: "us-central1" }, async (event) => {
  const uid = event.params.uid;
  const inbox = { ...await read(`dm/inbox/${uid}`), ...await read(`dm/userChats/${uid}`) };
  const updates = { [`dm/inbox/${uid}`]: null, [`dm/userChats/${uid}`]: null, [`dm/blocks/${uid}`]: null, [`dmDevices/${uid}`]: null };
  for (const id of Object.keys(inbox)) {
    updates[`dm/chats/${id}/meta/members/${uid}`] = null;
    updates[`dm/chats/${id}/meta/people/${uid}`] = null;
    const messages = await read(`dm/chats/${id}/messages`) || {};
    for (const [messageId, message] of Object.entries(messages)) if (message.sender === uid) updates[`dm/chats/${id}/messages/${messageId}`] = null;
  }
  await db().ref().update(updates);
  try { await admin.auth().deleteUser(uid); } catch (error) { if (error.code !== "auth/user-not-found") throw error; }
});
