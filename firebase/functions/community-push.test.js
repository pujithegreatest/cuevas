const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const push = require("./push-preferences");

function fixture() {
  const values = new Map([
    ["users/alice", { email: "alice@example.invalid", handle: "alice" }],
    ["users/bob", { email: "bob@example.invalid", handle: "bob" }],
    ["users/sender", { email: "sender@example.invalid", handle: "sender" }],
  ]);
  const sent = [];
  function ref(path, child, equal) {
    return {
      get: async () => ({ val: () => {
        if (child) return Object.fromEntries([...values.entries()]
          .filter(([key, value]) => key.startsWith(path + "/") && value[child] === equal)
          .map(([key, value]) => [key.split("/").at(-1), value]));
        return values.get(path);
      } }),
      orderByChild: key => ref(path, key),
      equalTo: value => ref(path, child, value),
      limitToFirst: () => ref(path, child, equal),
      transaction: async fn => {
        const result = fn(values.get(path));
        if (result === undefined) return { committed: false };
        values.set(path, result);
        return { committed: true };
      },
    };
  }
  const exported = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("./community-push"), "utf8"), {
    exports: exported, console,
    require(name) {
      if (name === "firebase-admin") return { database: () => ({ ref }) };
      if (name === "firebase-functions/v2/database") {
        return { onValueCreated: (_, handler) => handler, onValueWritten: (_, handler) => handler };
      }
      if (name === "firebase-functions/v2/scheduler") return { onSchedule: (_, handler) => handler };
      if (name === "./push-preferences") {
        return { ...push, sendPush: async (_, uid, category, body) => sent.push({ uid, category, body }) };
      }
      return require(name);
    },
  });
  const emit = (id, event) => exported.deliverCommunityPush({
    params: { id }, data: { val: () => ({
      actorEmail: "sender@example.invalid", recipients: ["alice@example.invalid", "bob@example.invalid"],
      createdAt: Date.now(), ...event,
    }), ref: { remove: async () => {} } },
  });
  return { values, sent, emit, exported };
}

test("mission chat mentions honor each preference and a repeated event sends once", async () => {
  const f = fixture();
  f.values.set("notificationPreferences/alice", { missionChat: "limited" });
  f.values.set("notificationPreferences/bob", { missionChat: "off" });
  await f.emit("chat1", { category: "missionChat", text: "Hello @alice2 and @bob" });
  await f.emit("chat2", { category: "missionChat", text: "Hello @alice and @bob" });
  await f.emit("chat2", { category: "missionChat", text: "Hello @alice and @bob" });
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].uid, "alice");
  assert.equal(f.sent[0].body.includes("@alice"), false);
});

test("zaps separate immediate sends from digest, and private-comment text is not in the push", async () => {
  const f = fixture();
  f.values.set("notificationPreferences/alice", { zaps: "limited", comments: "limited" });
  await f.emit("zap", { category: "zaps" });
  assert.equal(f.sent[0].uid, "bob");
  assert.equal([...f.values.entries()].filter(([path]) => path.startsWith("zapDigest/alice/"))[0][1], 1);
  await f.emit("comment", { category: "comments", replyTo: "alice@example.invalid", text: "private preview" });
  assert.equal(f.sent.length, 2);
  assert.equal(f.sent[1].uid, "alice");
  assert.equal(f.sent[1].body.includes("private preview"), false);
});

test("recurring mission time changes use only the recurring preference", async () => {
  const f = fixture();
  f.values.set("notificationPreferences/alice", { recurringMissions: "limited", missionEvents: "off" });
  const startMs = Date.now() + 86400000;
  const prior = { active: true, recurring: true, startMs, recipients: ["alice@example.invalid"] };
  await f.exported.notifyMissionChanges({ id: "change", data: {
    before: { val: () => prior }, after: { val: () => ({ ...prior, startMs: startMs + 3600000 }) },
  } });
  assert.equal(f.sent[0].category, "recurringMissions");
});
