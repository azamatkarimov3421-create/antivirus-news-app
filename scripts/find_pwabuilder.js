async function run() {
  try {
    const r = await fetch('https://raw.githubusercontent.com/pwa-builder/PWABuilder/main/apps/pwabuilder/src/script/services/publish/android-publish.ts');
    const text = await r.text();
    console.log("android-publish.ts found, length:", text.length);
    const matches = text.match(/https:\/\/[^'"`\s]+/g);
    console.log("matches:", matches);
    console.log("snippet:", text.slice(0, 1000));
  } catch (e) {
    console.error(e);
  }
}
run();
