const admin = require("firebase-admin");
const { createHash } = require("node:crypto");
const { onValueCreated, onValueWritten } = require("firebase-functions/v2/database");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { preferences, mentions, sendPush } = require("./push-preferences");

const region = "us-central1";
const dayMs = 86400000;
const read = async path => (await admin.database().ref(path).get()).val();
const unique = values => [...new Set(values.filter(Boolean))];
const hash = input => createHash("sha256").update(input).digest("hex");
const utcDay = time => new Date(time).toISOString().slice(0, 10);
const email = value => String(value || "").trim().toLowerCase();

async function account(emailAddress) {
  if (!emailAddress) return null;
  const records = (await admin.database().ref("users").orderByChild("email")
    .equalTo(email(emailAddress)).limitToFirst(2).get()).val();
  const entries = Object.entries(records || {});
  return entries.length === 1 ? { uid: entries[0][0], user: entries[0][1] } : null;
}

async function once(uid, eventId, deliver, day = utcDay(Date.now())) {
  const ref = admin.database().ref(`communityPushClaims/${day}/${hash(uid + ":" + eventId)}`);
  const claim = await ref.transaction(current => current ? undefined : true);
  if (!claim.committed) return;
  await deliver();
}

async function deliverCommunity(id, event) {
  const body = {
    missionChat: "There is a new message in a mission chat.",
    zaps: "Your post received a zap.",
    comments: "There is a new comment on a post.",
  }[event.category];
  if (!body || !Array.isArray(event.recipients)) return;
  const sender = await account(event.actorEmail);
  if (!sender || !Number.isFinite(event.createdAt) || Date.now() - event.createdAt > dayMs) return;
  for (const address of unique(event.recipients.slice(0, 1000).map(email))) {
    if (address === email(event.actorEmail)) continue;
    const recipient = await account(address);
    if (!recipient) continue;
    const { uid, user } = recipient;
    if (uid === sender.uid || await read(`dm/blocks/${uid}/${sender.uid}`) || await read(`dm/blocks/${sender.uid}/${uid}`)) continue;
    const choice = preferences(await read(`notificationPreferences/${uid}`))[event.category];
    if (!choice || choice === "off") continue;
    const isMention = mentions(event.text, user.handle || user.userHandle || user.username);
    if (event.category === "missionChat" && choice === "limited" && !isMention) continue;
    if (event.category === "comments") {
      const ownsPost = address === email(event.postOwner);
      const isReply = address === email(event.replyTo);
      if (!(isMention || isReply || (ownsPost && choice === "all"))) continue;
    }
    await once(uid, id, async () => {
      if (event.category === "zaps" && choice === "limited") {
        const bucket = utcDay(Date.now());
        await admin.database().ref(`zapDigest/${uid}/${bucket}`).transaction(count => (Number(count) || 0) + 1);
      } else {
        await sendPush(admin, uid, event.category, body);
      }
    }, utcDay(event.createdAt)).catch(error => console.error("Community push delivery failed", error.code || error.name));
  }
}

exports.deliverCommunityPush = onValueCreated({
  ref: "/communityPushQueue/{id}", region, maxInstances: 5, timeoutSeconds: 120,
}, async event => {
  await deliverCommunity(event.params.id, event.data.val() || {});
  await event.data.ref.remove();
});

async function missionAudience(mission) {
  const addresses = [...(mission.recipients || [])];
  if (mission.seriesKey) {
    const series = (await admin.database().ref("communityMissions").orderByChild("seriesKey")
      .equalTo(mission.seriesKey).limitToFirst(250).get()).val() || {};
    for (const occurrence of Object.values(series)) addresses.push(...(occurrence.recipients || []));
  }
  return unique(addresses.map(email)).slice(0, 1000);
}

async function missionPush(mission, id, variant, message) {
  const category = (mission.seriesKey || mission.recurring) ? "recurringMissions" : "missionEvents";
  for (const address of await missionAudience(mission)) {
    const recipient = await account(address);
    if (!recipient) continue;
    const { uid } = recipient;
    const choice = preferences(await read(`notificationPreferences/${uid}`))[category];
    if (choice === "off" || (variant === "reminder" && choice !== "all")
        || (variant === "details" && choice !== "all")) continue;
    await once(uid, id, () => sendPush(admin, uid, category, message),
      variant === "reminder" ? utcDay(mission.startMs) : undefined)
      .catch(error => console.error("Mission push delivery failed", error.code || error.name));
  }
}

exports.notifyMissionChanges = onValueWritten({
  ref: "/communityMissions/{id}", region, maxInstances: 5, timeoutSeconds: 120,
}, async event => {
  const before = event.data.before.val();
  const after = event.data.after.val();
  if (!before || !after) return;
  const cancelled = before.active && !after.active && after.status !== "completed";
  const rescheduled = before.startMs !== after.startMs && after.active;
  const details = before.fingerprint !== after.fingerprint && after.active;
  if (!(cancelled || rescheduled || details) || Math.max(before.startMs, after.startMs) < Date.now()) return;
  const variant = cancelled || rescheduled ? "change" : "details";
  const message = cancelled ? "A mission you joined was cancelled."
    : rescheduled ? "The time changed for a mission you joined." : "A mission you joined was updated.";
  await missionPush(after, event.id, variant, message);
});

exports.sendMissionReminders = onSchedule({ schedule: "every 15 minutes", region, maxInstances: 1, timeoutSeconds: 240 }, async () => {
  const now = Date.now();
  const upcoming = (await admin.database().ref("communityMissions").orderByChild("startMs")
    .startAt(now).endAt(now + 60 * 60000).get()).val() || {};
  for (const [id, mission] of Object.entries(upcoming)) {
    if (mission.active) await missionPush(mission, `reminder:${id}:${mission.startMs}`, "reminder",
      "A mission you joined is coming up.");
  }
});

exports.sendDailyZapSummary = onSchedule({ schedule: "0 9 * * *", timeZone: "America/New_York", region, maxInstances: 1 }, async () => {
  const now = Date.now();
  const cutoff = utcDay(now - dayMs);
  const digests = await read("zapDigest") || {};
  for (const [uid, buckets] of Object.entries(digests)) {
    const days = Object.keys(buckets).filter(day => day <= cutoff);
    if (!days.length) continue;
    const count = days.reduce((sum, day) => sum + (Number(buckets[day]) || 0), 0);
    if (count > 0 && preferences(await read(`notificationPreferences/${uid}`)).zaps === "limited") {
      await once(uid, "zap-digest:" + cutoff, () => sendPush(admin, uid, "zaps",
        `Your posts received ${count} ${count === 1 ? "zap" : "zaps"}.`))
        .catch(error => console.error("Zap summary delivery failed", error.code || error.name));
    }
    await admin.database().ref(`zapDigest/${uid}`).update(Object.fromEntries(days.map(day => [day, null])));
  }
  const claims = await read("communityPushClaims") || {};
  for (const day of Object.keys(claims)) {
    if (day < utcDay(now - 7 * dayMs)) await admin.database().ref(`communityPushClaims/${day}`).remove();
  }
});
