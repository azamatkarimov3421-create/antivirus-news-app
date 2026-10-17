// ANTIVIRUS NEWS - Reactive Store with Cloudflare (D1 Database + R2 Storage) Integration

import { INITIAL_CATEGORIES, INITIAL_NEWS, INITIAL_ADS } from './data.js';

const STORAGE_KEYS = {
  NEWS: 'antivirus_news_list',
  CATEGORIES: 'antivirus_categories',
  SAVED: 'antivirus_saved_news',
  THEME: 'antivirus_theme',
  ADS: 'antivirus_ads',
  NOTIFICATIONS: 'antivirus_notifications',
  CF_API_URL: 'antivirus_cloudflare_api_url', // Cloudflare Worker URL
};

class NewsStore {
  constructor() {
    this.subscribers = [];
    this.isSyncing = false;
    this.init();
  }

  init() {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.NEWS)) {
        localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(INITIAL_NEWS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
      }
      if (!localStorage.getItem(STORAGE_KEYS.SAVED)) {
        localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(['an-001']));
      }
      if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
        localStorage.setItem(STORAGE_KEYS.THEME, 'dark'); // Default to dark mode
      }
      if (!localStorage.getItem(STORAGE_KEYS.ADS)) {
        localStorage.setItem(STORAGE_KEYS.ADS, JSON.stringify(INITIAL_ADS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([
          { id: 1, title: 'Tezkor xabar', text: 'Shavkat Mirziyoyev telefon muloqoti tafsilotlari', time: '5 daqiqa oldin', read: false },
          { id: 2, title: 'Iqtisodiyot', text: 'Yangi Chery Tiggo 4 Pro O‘zbekiston bozoriga kirdi', time: '1 soat oldin', read: false }
        ]));
      }

      // Agar Cloudflare URL o'rnatilgan bo'lsa, avtomatik sinxronlash
      if (this.getApiUrl()) {
        this.syncFromCloudflare().catch(err => {
          console.warn('Cloudflare avtomatik sinxronlashda ogohlantirish:', err.message);
        });
      }
    } catch (e) {
      console.warn('LocalStorage mavjud emas, xotiradagi nusxa ishlatilmoqda', e);
    }
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.subscribers.forEach(cb => cb());
  }

  // =========================================================================
  // CLOUDFLARE D1 + R2 SOZLAMALARI VA INTEGRATSIYASI
  // =========================================================================

  getApiUrl() {
    try {
      return (localStorage.getItem(STORAGE_KEYS.CF_API_URL) || '').trim().replace(/\/+$/, '');
    } catch {
      return '';
    }
  }

  setApiUrl(url) {
    const cleanUrl = (url || '').trim().replace(/\/+$/, '');
    try {
      localStorage.setItem(STORAGE_KEYS.CF_API_URL, cleanUrl);
    } catch (e) {
      console.error(e);
    }
    this.notify();
    if (cleanUrl) {
      this.syncFromCloudflare();
    }
  }

  isCloudflareConnected() {
    return Boolean(this.getApiUrl());
  }

  // Cloudflare Worker va D1 bilan ulanishni tekshirish
  async testConnection(customUrl = null) {
    const targetUrl = (customUrl || this.getApiUrl()).trim().replace(/\/+$/, '');
    if (!targetUrl) {
      return { ok: false, error: 'Cloudflare Worker URL manzili kiritilmagan' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(`${targetUrl}/api/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server xatosi: ${res.status}`);
      }

      const data = await res.json();
      return { ok: true, data };
    } catch (err) {
      return {
        ok: false,
        error: err.name === 'AbortError' ? 'So‘rov vaqti tugadi (Timeout)' : err.message
      };
    }
  }

  // Cloudflare D1 bazasidan yangiliklarni yuklab olish
  async syncFromCloudflare() {
    const apiUrl = this.getApiUrl();
    if (!apiUrl || this.isSyncing) return;

    this.isSyncing = true;
    try {
      const res = await fetch(`${apiUrl}/api/news`);
      if (res.ok) {
        const cloudNews = await res.json();
        if (Array.isArray(cloudNews) && cloudNews.length > 0) {
          // Baza ma'lumotlarini mahalliy saqlashga yangilash
          localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(cloudNews));
          this.notify();
          return cloudNews;
        }
      }
    } catch (err) {
      console.warn('Cloudflare D1 dan yangiliklarni yuklashda xatolik:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  // Rasmni Cloudflare R2 Media Storage ga yuklash
  async uploadMedia(file) {
    const apiUrl = this.getApiUrl();

    // 1. Agar Cloudflare Worker ulangan bo'lsa, R2 ga yuklash
    if (apiUrl) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch(`${apiUrl}/api/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error('R2 ga yuklashda xatolik: ' + res.status);
        }

        const data = await res.json();
        if (data.url) {
          return { ok: true, url: data.url };
        }
      } catch (err) {
        console.warn('R2 yuklash xatosi, fallback ishlatiladi:', err);
      }
    }

    // 2. Fallback: Agar Worker ulanmagan bo'lsa, Data URL (Base64) qilib saqlash
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ ok: true, url: e.target.result });
      reader.onerror = () => resolve({ ok: false, url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80' });
      reader.readAsDataURL(file);
    });
  }

  // =========================================================================
  // YANGILIKLAR BO'YICHA METODLAR
  // =========================================================================

  getNews() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.NEWS)) || INITIAL_NEWS;
    } catch {
      return INITIAL_NEWS;
    }
  }

  getNewsById(id) {
    const list = this.getNews();
    return list.find(item => item.id === id);
  }

  getCategories() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES)) || INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  }

  getSavedIds() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED)) || [];
    } catch {
      return [];
    }
  }

  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  }

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.notify();
  }

  toggleTheme() {
    const current = this.getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }

  getNotifications() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) || [];
    } catch {
      return [];
    }
  }

  addNotification(notif) {
    const list = this.getNotifications();
    list.unshift({ ...notif, id: Date.now(), read: false });
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
    this.notify();
  }

  toggleSaveNews(id) {
    let saved = this.getSavedIds();
    if (saved.includes(id)) {
      saved = saved.filter(savedId => savedId !== id);
    } else {
      saved.push(id);
    }
    localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(saved));
    this.notify();
    return saved.includes(id);
  }

  incrementViews(id) {
    const list = this.getNews();
    const item = list.find(n => n.id === id);
    if (item) {
      item.views = (item.views || 0) + 1;
      localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(list));
      this.notify();
    }

    // Cloudflare D1 ga ham sinxronlash
    const apiUrl = this.getApiUrl();
    if (apiUrl) {
      fetch(`${apiUrl}/api/news/${id}/view`, { method: 'POST' }).catch(() => {});
    }
  }

  async createNews(newsData) {
    const list = this.getNews();
    const id = 'an-' + Date.now();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;

    const newArticle = {
      id,
      time: timeStr,
      date: dateStr,
      views: 1,
      isHero: Boolean(newsData.isHero),
      isTrending: Boolean(newsData.isTrending),
      isSlider: Boolean(newsData.isSlider),
      title: newsData.title,
      category: newsData.category,
      categoryName: this.getCategoryName(newsData.category),
      imageUrl: newsData.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80',
      summary: newsData.summary || '',
      content: newsData.content || '',
      author: newsData.author || 'ANTIVIRUS Tahririyati',
      readTime: newsData.readTime || '3 daqiqa',
      tags: newsData.tags ? (Array.isArray(newsData.tags) ? newsData.tags : newsData.tags.split(',').map(s => s.trim())) : ['Yangilik'],
      videoUrl: newsData.videoUrl || null
    };

    if (newArticle.isHero) {
      list.forEach(n => { n.isHero = false; });
    }

    // Mahalliy saqlashga qo'shish
    list.unshift(newArticle);
    localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(list));
    this.addNotification({
      title: 'Yangi xabar qo‘shildi',
      text: newArticle.title,
      time: 'Hozirgina'
    });
    this.notify();

    // Cloudflare D1 ga yuborish
    const apiUrl = this.getApiUrl();
    if (apiUrl) {
      try {
        await fetch(`${apiUrl}/api/news`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newArticle)
        });
      } catch (err) {
        console.warn('Cloudflare D1 ga yangilik yozishda xatolik:', err);
      }
    }

    return newArticle;
  }

  async deleteNews(id) {
    let list = this.getNews();
    list = list.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(list));
    this.notify();

    const apiUrl = this.getApiUrl();
    if (apiUrl) {
      try {
        await fetch(`${apiUrl}/api/news/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Cloudflare D1 dan o‘chirishda xatolik:', err);
      }
    }
  }

  getCategoryName(catId) {
    const cats = this.getCategories();
    const found = cats.find(c => c.id === catId);
    return found ? found.name : 'Yangiliklar';
  }

  getAds() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ADS)) || INITIAL_ADS;
    } catch {
      return INITIAL_ADS;
    }
  }

  resetToDefaults() {
    localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(INITIAL_NEWS));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.ADS, JSON.stringify(INITIAL_ADS));
    this.notify();
  }
}

export const store = new NewsStore();
