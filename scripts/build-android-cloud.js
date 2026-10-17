import fs from 'fs';
import path from 'path';

const API_BASE = 'https://pwabuilder-cloudapk.azurewebsites.net';

async function buildPackage() {
  console.log("🚀 Starting Android package build via PWABuilder CloudAPK...");

  const payload = {
    additionalTrustedOrigins: [],
    appVersion: "1.0.0",
    appVersionCode: 1,
    backgroundColor: "#07090e",
    display: "standalone",
    enableSiteSettingsShortcut: true,
    enableNotifications: false,
    includeSourceCode: false,
    fallbackType: "customtabs",
    features: {
      locationDelegation: { enabled: false },
      playBilling: { enabled: false }
    },
    host: "https://antivirus-news-app-uwl4.vercel.app",
    iconUrl: "https://antivirus-news-app-uwl4.vercel.app/assets/icons/icon-512.png",
    launcherName: "ANTIVIRUS",
    name: "ANTIVIRUS NEWS",
    maskableIconUrl: "https://antivirus-news-app-uwl4.vercel.app/assets/icons/icon-maskable-192.png",
    navigationColor: "#07090e",
    navigationColorDark: "#07090e",
    navigationDividerColor: "#e50914",
    navigationDividerColorDark: "#e50914",
    orientation: "portrait",
    packageId: "com.antivirusnews.app",
    pwaUrl: "https://antivirus-news-app-uwl4.vercel.app/",
    shortcuts: [],
    signingMode: "new",
    signing: {
      file: null,
      alias: "antivirusnews",
      fullName: "Antivirus News",
      organization: "Antivirus News Media",
      organizationalUnit: "Development",
      countryCode: "UZ",
      keyPassword: "AntivirusNews2026!",
      storePassword: "AntivirusNews2026!"
    },
    splashScreenFadeOutDuration: 300,
    startUrl: "/",
    themeColor: "#e50914",
    themeColorDark: "#07090e",
    webManifestUrl: "https://antivirus-news-app-uwl4.vercel.app/manifest.json"
  };

  const enqueueRes = await fetch(`${API_BASE}/enqueuePackageJob`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'platform-identifier': 'ServerUI',
      'platform-identifier-version': '1.0.0'
    },
    body: JSON.stringify(payload)
  });

  if (!enqueueRes.ok) {
    const errText = await enqueueRes.text();
    throw new Error(`Failed to enqueue job: ${enqueueRes.status} ${enqueueRes.statusText} - ${errText}`);
  }

  const { id: jobId, accessToken } = await enqueueRes.json();
  console.log(`📦 Enqueued Job ID: ${jobId}`);

  // Poll job status
  let attempts = 0;
  while (attempts < 120) {
    await new Promise(r => setTimeout(r, 3000));
    attempts++;

    const jobRes = await fetch(`${API_BASE}/getPackageJob?id=${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!jobRes.ok) {
      console.error(`Poll error: ${jobRes.status}`);
      continue;
    }

    const job = await jobRes.json();
    console.log(`[${attempts * 3}s] Job Status: ${job.status}`);

    if (job.status === "Completed") {
      console.log("🎉 Build Completed! Downloading zip...");
      const zipRes = await fetch(`${API_BASE}/downloadPackageZip?id=${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!zipRes.ok) {
        throw new Error(`Failed to download zip: ${zipRes.status}`);
      }

      const buffer = Buffer.from(await zipRes.arrayBuffer());
      const outDir = path.resolve('android-release');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      const zipPath = path.join(outDir, 'antivirus-news-android.zip');
      fs.writeFileSync(zipPath, buffer);
      console.log(`✅ Saved release zip to: ${zipPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      return zipPath;
    } else if (job.status === "Failed") {
      console.error("❌ Job failed! Logs:", job.logs);
      throw new Error("CloudAPK job failed");
    }
  }

  throw new Error("Timeout waiting for CloudAPK build");
}

buildPackage().catch(err => {
  console.error(err);
  process.exit(1);
});
