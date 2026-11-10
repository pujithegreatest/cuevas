const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const core = require("./dm-core");

function fixture(options = {}) {
  const data = { users: { alice: { email: "alice@example.invalid", handle: "alice", createdAt: 1 }, bob: { email: "bob@example.invalid", handle: "bob", createdAt: 2 }, eve: { email: "eve@example.invalid", handle: "eve", createdAt: 3 } } };
  let serial = 0;
  const get = (path) => path.split("/").filter(Boolean).reduce((object, key) => object?.[key], data) ?? null;
  const put = (path, value) => {
    const parts = path.split("/").filter(Boolean);
    const last = parts.pop();
    let object = data;
    for (const part of parts) object = object[part] ||= {};
    if (value === null) delete object[last]; else object[last] = structuredClone(value);
  };
  const snapshot = (value) => ({ val: () => value });
  function ref(path = "", filter = {}) {
    return {
      get: async () => {
        let value = get(path);
        if (filter.equal !== undefined) value = Object.fromEntries(Object.entries(value || {}).filter(([, row]) => row[filter.child] === filter.equal));
        return snapshot(structuredClone(value));
      },
      set: async (value) => put(path, value),
      update: async (updates) => Object.entries(updates).forEach(([key, value]) => put([path, key].filter(Boolean).join("/"), value)),
      transaction: async (fn) => { const value = fn(get(path)); if (value === undefined) return { committed: false, snapshot: snapshot(get(path)) }; put(path, value); return { committed: true, snapshot: snapshot(value) }; },
      orderByChild: (child) => ref(path, { ...filter, child }), equalTo: (equal) => ref(path, { ...filter, equal }), limitToFirst: () => ref(path, filter), limitToLast: () => ref(path, filter), endAt: () => ref(path, filter),
      push: (value) => { const key = "generated_" + ++serial; if (value) put(path + "/" + key, value); return { key }; },
    };
  }
  const exports = {};
  const notifications = [];
  const admin = { database: () => ({ ref }), auth: () => ({
    verifyIdToken: async (token) => { if (!data.users[token]) throw Error("Invalid token"); return { uid: token, dmAccount: core.stamp(data.users[token]) }; },
    createCustomToken: async (uid) => "verified-" + uid,
    deleteUser: async () => {},
  }), messaging: () => ({ sendEachForMulticast: async (payload) => { notifications.push(payload); return { responses: payload.tokens.map(() => ({ success: true })) }; } }) };
  vm.runInNewContext(fs.readFileSync(require.resolve("./direct-messages"), "utf8"), {
    exports, console, Buffer, URLSearchParams, AbortSignal,
    fetch: async (url, request) => {
      if (url.endsWith("/verifyMessagingPassword")) {
        const body = JSON.parse(request.body);
        const expected = require("crypto").createHash("sha256").update(`${body.email}:${body.password}:test-pepper`).digest("hex");
        const valid = data.users.alice.passwordHash ? data.users.alice.passwordHash === expected : options.wixPasswordValid === true;
        return { ok: valid, status: valid ? 200 : 403, json: async () => ({ success: valid, verified: valid, email: body.email, uid: options.proofUid || "alice" }) };
      }
      return { ok: true, json: async () => ({ aud: "attacker-client", expires_in: 3000, email_verified: true, email: "alice@example.invalid" }) };
    },
    require: (name) => name === "firebase-admin" ? admin : name === "firebase-functions/v2/https" ? { onRequest: (_, handler) => handler } : name === "firebase-functions/v2/database" ? { onValueDeleted: (_, handler) => handler } : name === "firebase-functions/params" ? { defineSecret: () => ({ value: () => "test-pepper" }) } : name === "./dm-core" ? core : require(name),
  });
  async function call(uid, body) {
    let status = 200, output;
    const res = { set: () => res, status: (value) => { status = value; return res; }, json: (value) => { output = value; return res; } };
    await exports.directMessages({ method: "POST", ip: "test", headers: { authorization: uid ? `Bearer ${uid}` : "" }, body }, res);
    return { status, output };
  }
  const chat = (id = "thread") => put(`dm/chats/${id}/meta`, { members: { alice: true, bob: true }, people: { alice: { uid: "alice", handle: "alice" }, bob: { uid: "bob", handle: "bob" } }, type: "direct", updatedAt: 1 });
  return { data, get, put, call, chat, notifications, exports };
}

test("direct IDs are stable and participant / message validation rejects invalid inputs", () => {
  assert.equal(core.directId(["alice", "bob"]), core.directId(["bob", "alice"]));
  assert.deepEqual(core.participants("alice", ["alice", "bob", "bob"]), ["alice", "bob"]);
  assert.throws(() => core.participants("alice", ["../users"]));
  assert.throws(() => core.participants("alice", ["alice"]));
  assert.throws(() => core.messageText(" "));
  assert.throws(() => core.messageText("x".repeat(4001)));
});
test("unauthenticated and non-member readers cannot access private messages", async () => {
  const f = fixture(); f.chat();
  assert.equal((await f.call(null, { action: "messages", conversationId: "thread" })).status, 401);
  assert.equal((await f.call("eve", { action: "messages", conversationId: "thread" })).status, 403);
  assert.equal((await f.call("alice", { action: "messages", conversationId: "thread" })).status, 200);
});
test("mission attachments persist, support optional captions, and retain moderation evidence", async () => {
  const f = fixture(); f.chat();
  const missionShare = { id: "mission-1", title: "Community cleanup", points: 300, location: "Syracuse", businessHandle: "missionpossible", injected: "discard" };
  const body = { action: "send", conversationId: "thread", messageId: "mission_message", text: "", missionShare };
  assert.equal((await f.call("alice", body)).status, 200);
  assert.equal((await f.call("alice", body)).status, 200);
  const messages = (await f.call("bob", { action: "messages", conversationId: "thread" })).output.messages;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].missionShare.title, missionShare.title);
  assert.equal(messages[0].missionShare.injected, undefined);
  assert.equal((await f.call("alice", { ...body, messageId: "caption", text: "Join me?" })).status, 200);
  assert.equal((await f.call("eve", body)).status, 403);
  await f.call("bob", { action: "report", conversationId: "thread", messageId: "mission_message", reason: "Spam or scam" });
  assert.equal(Object.values(f.get("dmReports"))[0].missionShare.id, "mission-1");
  assert.equal((await f.call("alice", { ...body, messageId: "bad", missionShare: { title: "Missing ID" } })).status, 400);
  assert.equal((await f.call("alice", { ...body, messageId: "badurl", missionShare: { ...missionShare, eventUrl: "javascript:alert(1)" } })).status, 400);
  assert.equal((await f.call("alice", { ...body, messageId: "empty", missionShare: null })).status, 400);
});
test("wrong password and forged provider tokens never mint messaging sessions", async () => {
  const f = fixture();
  assert.equal((await f.call(null, { action: "authenticate", email: "alice@example.invalid", password: "anything" })).status, 401);
  assert.equal((await f.call(null, { action: "authenticate", email: "alice@example.invalid", googleToken: "fake" })).status, 401);
  const hash = require("crypto").createHash("sha256").update("alice@example.invalid:correct:test-pepper").digest("hex");
  f.put("users/alice/passwordHash", hash);
  assert.equal((await f.call(null, { action: "authenticate", email: "alice@example.invalid", password: "wrong" })).status, 401);
  assert.equal((await f.call(null, { action: "authenticate", email: "alice@example.invalid", password: "correct" })).output.token, "verified-alice");
});
test("sender identity comes from verified session; retries do not duplicate sends or notifications", async () => {
  const f = fixture(); f.chat(); f.put("dmDevices/bob/device", { token: "bob-token", updatedAt: Date.now() });
  const body = { action: "send", conversationId: "thread", messageId: "message_1", text: "Private hello", sender: "eve" };
  assert.equal((await f.call("alice", body)).status, 200);
  assert.equal((await f.call("alice", body)).status, 200);
  assert.equal(f.get("dm/chats/thread/messages/message_1").sender, "alice");
  assert.equal(f.notifications.length, 1);
  assert.deepEqual(Array.from(f.notifications[0].tokens), ["bob-token"]);
  assert.equal(f.notifications[0].notification.body, "You have a new message.");
  assert.ok(!JSON.stringify(f.notifications).includes("Private hello"));
});
test("Wix-managed password accounts can establish messaging without changing providers", async () => {
  const f = fixture({ wixPasswordValid: true });
  const result = await f.call(null, { action: "authenticate", email: "alice@example.invalid", password: "existing-wix-password" });
  assert.equal(result.status, 200);
  assert.equal(result.output.token, "verified-alice");
  assert.equal(f.get("users/alice/passwordHash"), null);
});
test("password verification cannot authorize a different Firebase account", async () => {
  const f = fixture({ wixPasswordValid: true, proofUid: "eve" });
  assert.equal((await f.call(null, { action: "authenticate", email: "alice@example.invalid", password: "existing-wix-password" })).status, 401);
});
test("blocked recipients cannot receive new messages or new conversations", async () => {
  const f = fixture(); f.chat();
  await f.call("bob", { action: "block", targetUid: "alice" });
  assert.equal((await f.call("alice", { action: "send", conversationId: "thread", messageId: "message_1", text: "hello" })).status, 403);
  assert.equal((await f.call("alice", { action: "create", participants: ["bob"] })).status, 403);
  assert.equal(f.get("dm/chats/thread/messages"), null);
});
test("adding participants creates a separate group without leaking direct history", async () => {
  const f = fixture();
  const direct = await f.call("alice", { action: "create", participants: ["bob"] });
  const id = direct.output.conversation.id;
  await f.call("alice", { action: "send", conversationId: id, messageId: "private_1", text: "Only Bob may see this" });
  const group = await f.call("alice", { action: "create", participants: ["bob", "eve"], title: "Team" });
  assert.equal(group.status, 200);
  assert.notEqual(group.output.conversation.id, id);
  assert.equal((await f.call("eve", { action: "messages", conversationId: id })).status, 403);
  assert.equal((await f.call("eve", { action: "messages", conversationId: group.output.conversation.id })).output.messages.length, 0);
  assert.equal((await f.call("alice", { action: "send", conversationId: group.output.conversation.id, messageId: "mission_group", text: "Join us", missionShare: { id: "mission-1", title: "Community cleanup" } })).status, 200);
  assert.equal((await f.call("eve", { action: "messages", conversationId: group.output.conversation.id })).output.messages[0].missionShare.id, "mission-1");
  await f.call("eve", { action: "leave", conversationId: group.output.conversation.id });
  assert.equal((await f.call("eve", { action: "messages", conversationId: group.output.conversation.id })).status, 403);
});
test("private reports require membership and a valid reason", async () => {
  const f = fixture(); f.chat(); f.put("dm/chats/thread/messages/m1", { sender: "bob", text: "test", createdAt: 1 });
  assert.equal((await f.call("eve", { action: "report", conversationId: "thread", messageId: "m1", reason: "Harassment" })).status, 403);
  assert.equal((await f.call("alice", { action: "report", conversationId: "thread", messageId: "m1", reason: "Child safety or exploitation" })).status, 200);
  assert.equal(Object.values(f.get("dmReports"))[0].reporter, "alice");
});
test("changing device account removes the previous account notification registration", async () => {
  const f = fixture();
  await f.call("alice", { action: "device", deviceId: "phone", token: "device-token" });
  await f.call("bob", { action: "device", deviceId: "phone", token: "device-token" });
  assert.equal(f.get("dmDevices/alice/phone"), null);
  assert.equal(f.get("dmDevices/bob/phone").token, "device-token");
});
test("deleted accounts lose membership and authored messages even in groups they left", async () => {
  const f = fixture(); f.chat(); f.put("dm/userChats/alice/thread", true); f.put("dm/chats/thread/messages/m1", { sender: "alice", text: "personal" }); f.put("dm/chats/thread/messages/m2", { sender: "bob", text: "retained" });
  await f.exports.deleteMessagingAccount({ params: { uid: "alice" } });
  assert.equal(f.get("dm/chats/thread/messages/m1"), null);
  assert.ok(f.get("dm/chats/thread/messages/m2"));
  assert.equal(f.get("dm/chats/thread/meta/members/alice"), null);
});
