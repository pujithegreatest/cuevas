const crypto = require("crypto");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function key(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) fail("Invalid identifier.");
  return value;
}
function handle(value) {
  return String(value || "").trim().replace(/^@/, "").toLowerCase();
}
function participants(uid, requested) {
  if (!Array.isArray(requested)) fail("Choose recipients.");
  const ids = [...new Set([uid, ...requested.map(key)])].sort();
  if (ids.length < 2 || ids.length > 20) fail("Choose between 1 and 19 other people.");
  return ids;
}
function directId(ids) {
  return "direct_" + crypto.createHash("sha256").update(JSON.stringify([...ids].sort())).digest("hex");
}
function member(chat, uid) {
  if (!chat || !Object.hasOwn(chat.members || {}, uid) || !chat.members[uid]) fail("Conversation unavailable.", 403);
  return chat;
}
function messageText(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 4000) fail("Messages must be between 1 and 4,000 characters.");
  return value.trim();
}
function stamp(user) {
  return crypto.createHash("sha256").update(JSON.stringify([
    user.createdAt || user._createdDate || "", user.email || "", user.appleUserId || "", user.passwordHash || "",
  ])).digest("hex");
}
function missionShare(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) fail("Invalid mission attachment.");
  const result = {};
  const fields = { id: 128, title: 200, description: 2000, location: 300, eventDate: 120, eventDateISO: 60, type: 80, difficulty: 80, materialsNote: 1000, eventUrl: 2000, businessName: 150, businessHandle: 100, status: 80 };
  for (const [field, limit] of Object.entries(fields)) {
    if (value[field] === undefined) continue;
    if (typeof value[field] !== "string" || value[field].length > limit) fail("Invalid mission attachment.");
    result[field] = value[field].trim();
  }
  if (!result.id || !result.title) fail("Mission title and ID are required.");
  if (result.eventUrl && !/^https?:\/\//i.test(result.eventUrl)) fail("Invalid mission URL.");
  for (const field of ["points", "durationHours", "goingCount"]) {
    if (value[field] === undefined) continue;
    if (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < 0) fail("Invalid mission attachment.");
    result[field] = value[field];
  }
  if (value.peopleNeeded !== undefined) {
    if (!(typeof value.peopleNeeded === "number" && Number.isFinite(value.peopleNeeded) && value.peopleNeeded >= 0) && !(typeof value.peopleNeeded === "string" && value.peopleNeeded.length <= 80)) fail("Invalid mission capacity.");
    result.peopleNeeded = value.peopleNeeded;
  }
  for (const field of ["gearProvided", "businessVerified"]) {
    if (value[field] === undefined) continue;
    if (typeof value[field] !== "boolean") fail("Invalid mission attachment.");
    result[field] = value[field];
  }
  return result;
}
module.exports = { fail, key, handle, participants, directId, member, messageText, stamp, missionShare };
