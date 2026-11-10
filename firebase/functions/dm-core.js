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
module.exports = { fail, key, handle, participants, directId, member, messageText, stamp };
