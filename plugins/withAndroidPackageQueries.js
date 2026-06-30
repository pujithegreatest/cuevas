const { withAndroidManifest } = require("@expo/config-plugins");

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasEntry(entries, candidate) {
  const signature = JSON.stringify(candidate);
  return entries.some((entry) => JSON.stringify(entry) === signature);
}

function pushUnique(entries, candidate) {
  if (!hasEntry(entries, candidate)) {
    entries.push(candidate);
  }
}

module.exports = function withAndroidPackageQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const queries = ensureArray(manifest.queries);
    const current = queries[0] || {};

    current.package = ensureArray(current.package);
    current.intent = ensureArray(current.intent);

    pushUnique(current.package, {
      $: { "android:name": "com.instagram.android" },
    });

    pushUnique(current.intent, {
      action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
      data: [{ $: { "android:scheme": "instagram" } }],
    });

    pushUnique(current.intent, {
      action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
      data: [{ $: { "android:scheme": "instagram-stories" } }],
    });

    manifest.queries = [current];
    return config;
  });
};
