const categories = ["dm", "recurringMissions", "missionEvents", "missionChat", "zaps", "comments"];
const values = ["all", "limited", "off"];

function preferences(record) {
  return Object.fromEntries(categories.map(category => [
    category, values.includes(record?.[category]) ? record[category] : "all",
  ]));
}

function mentions(text, handle) {
  const name = String(handle || "").replace(/^@+/, "").toLowerCase();
  return Boolean(name && (String(text || "").toLowerCase().match(/(?:^|[^\w@.])@[a-z0-9._-]+/g) || [])
    .some(match => match.slice(match.indexOf("@") + 1).replace(/[.]+$/, "") === name));
}

async function sendPush(admin, uid, category, body, data = {}) {
  const ref = admin.database().ref(`dmDevices/${uid}`);
  const devices = (await ref.get()).val() || {};
  const entries = Object.entries(devices)
    .filter(([, device]) => device.token && Date.now() - device.updatedAt < 60 * 86400000)
    .slice(0, 10);
  if (!entries.length) return;
  const channelId = category === "dm" ? "messages" : category;
  const result = await admin.messaging().sendEachForMulticast({
    tokens: entries.map(([, device]) => device.token),
    notification: { title: "Cuevas", body },
    data: { type: category, channelId, ...data },
    android: { notification: { channelId } },
    apns: { payload: { aps: { sound: "default" } } },
  });
  const updates = {};
  result.responses.forEach((response, index) => {
    if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(response.error?.code)) {
      updates[entries[index][0]] = null;
    }
  });
  if (Object.keys(updates).length) await ref.update(updates);
}

module.exports = { categories, values, preferences, mentions, sendPush };
