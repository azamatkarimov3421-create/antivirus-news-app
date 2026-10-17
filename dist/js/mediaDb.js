// ============================================================================
// ANTIVIRUS NEWS — IndexedDB Mahalliy Media Xotirasi & Video/Rasm Qayta Ishlash
// Katta video fayllar (MP4, WebM, MOV) va rasmlarni xavfsiz saqlash tizimi
// ============================================================================

const DB_NAME = 'antivirus_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_files';

class MediaDB {
  constructor() {
    this.blobUrlCache = new Map();
    this.db = null;
    this.initPromise = this.openDB();
  }

  openDB() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        console.warn('IndexedDB bu brauzerda qo‘llab-quvvatlanmaydi');
        resolve(null);
        return;
      }
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        request.onerror = (e) => {
          console.warn('IndexedDB ochishda ogohlantirish:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB xatosi:', err);
        resolve(null);
      }
    });
  }

  async saveMedia(id, blobOrFile, metadata = {}) {
    const db = await this.initPromise;
    if (!db) return null;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record = {
          id,
          blob: blobOrFile,
          name: blobOrFile.name || id,
          type: blobOrFile.type || 'video/mp4',
          size: blobOrFile.size || 0,
          createdAt: Date.now(),
          ...metadata
        };
        const req = store.put(record);
        req.onsuccess = () => resolve(id);
        req.onerror = (e) => reject(e.target.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async getMedia(id) {
    const db = await this.initPromise;
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  getCachedUrl(id) {
    return this.blobUrlCache.get(id) || null;
  }

  async getMediaUrl(id) {
    if (this.blobUrlCache.has(id)) {
      return this.blobUrlCache.get(id);
    }
    const item = await this.getMedia(id);
    if (item && item.blob) {
      const url = URL.createObjectURL(item.blob);
      this.blobUrlCache.set(id, url);
      return url;
    }
    return null;
  }

  async deleteMedia(id) {
    if (this.blobUrlCache.has(id)) {
      try {
        URL.revokeObjectURL(this.blobUrlCache.get(id));
      } catch {}
      this.blobUrlCache.delete(id);
    }
    const db = await this.initPromise;
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async getTotalMediaSize() {
    const db = await this.initPromise;
    if (!db) return 0;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          const total = list.reduce((acc, cur) => acc + (cur.size || 0), 0);
          resolve(total);
        };
        req.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  }
}

export const mediaDb = new MediaDB();

// ----------------------------------------------------------------------------
// Video fayldan avtomatik muqova (thumbnail) olish & davomiylikni o'lchash
// ----------------------------------------------------------------------------
export function captureVideoMetadata(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const blobUrl = URL.createObjectURL(fileOrBlob);
    video.src = blobUrl;

    const cleanup = () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
    };

    video.onloadedmetadata = () => {
      const durationSec = Math.floor(video.duration || 0);
      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      const durationFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      // Kadrlarni olish uchun 1-soniyaga yoki 30% vaqtiga o'tamiz
      const seekTime = video.duration > 1.5 ? 1.0 : (video.duration * 0.3);
      video.currentTime = seekTime;

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = video.videoWidth || 640;
          let height = video.videoHeight || 360;

          // Rasm hajmi juda katta bo'lmasligi uchun optimal o'lcham
          const maxWidth = 800;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

          cleanup();
          resolve({
            thumbnailUrl: dataUrl,
            durationSec,
            durationFormatted,
            width,
            height
          });
        } catch (err) {
          cleanup();
          resolve({
            thumbnailUrl: null,
            durationSec,
            durationFormatted,
            width: video.videoWidth || 0,
            height: video.videoHeight || 0
          });
        }
      };
    };

    video.onerror = (err) => {
      cleanup();
      reject(err);
    };

    // 8 soniyada javob bo'lmasa timeout
    setTimeout(() => {
      cleanup();
      resolve({
        thumbnailUrl: null,
        durationSec: 0,
        durationFormatted: '00:00',
        width: 0,
        height: 0
      });
    }, 8000);
  });
}

// ----------------------------------------------------------------------------
// Rasm faylni siqib, Data URL ga aylantiruvchi yordamchi
// ----------------------------------------------------------------------------
export function processImageFile(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Fayl tanlanmadi'));
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Faqat rasm fayllari qabul qilinadi'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ----------------------------------------------------------------------------
// URL dan domen nomini aniqlash (Kun.uz, Daryo.uz, va hokazo)
// ----------------------------------------------------------------------------
export function extractDomainName(rawUrl) {
  if (!rawUrl) return 'ANTIVIRUS';
  try {
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    let host = url.hostname.replace(/^www\./, '');
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('instagram.com') || host.includes('instagr.am')) return 'Instagram';
    if (host.includes('t.me') || host.includes('telegram.me')) return 'Telegram';
    if (host.includes('facebook.com') || host.includes('fb.com')) return 'Facebook';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'X (Twitter)';
    if (host.includes('tiktok.com')) return 'TikTok';
    // Boshqa saytlar: kun.uz -> Kun.uz
    return host.charAt(0).toUpperCase() + host.slice(1);
  } catch {
    return 'Sayt Manbasi';
  }
}
