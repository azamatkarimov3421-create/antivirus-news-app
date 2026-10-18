// ANTIVIRUS NEWS - Reactive Store with Cloudflare D1 & Dual-Storage Backup

import { INITIAL_CATEGORIES, INITIAL_NEWS, INITIAL_ADS } from './data.js';

const STORAGE_KEYS = {
  NEWS: 'antivirus_news_list',
  CATEGORIES: 'antivirus_categories',
  SAVED: 'antivirus_saved_news',
  THEME: 'antivirus_theme',
  ADS: 'antivirus_ads',
  NOTIFICATIONS: 'antivirus_notifications',
  CF_API_URL: 'antivirus_cloudflare_api_url',
  DELETED_IDS: 'antivirus_news_deleted_ids',
  USER: 'antivirus_auth_user',
  USERS_DB: 'antivirus_registered_users',
  GOOGLE_CLIENT_ID: 'antivirus_google_client_id'
};

// Cloudflare D1 Bazasining Doimiy Rekvizitlari
export const CLOUDFLARE_CONFIG = {
  databaseName: 'antivirus-news-db',
  databaseId: 'ad7f702f-702a-44ef-9e76-c6f5b1107273',
  accountId: '689f9566f97618e8bfd32533251b9e6f',
  freeLimitBytes: 5 * 1024 * 1024 * 1024, // 5 GB Mutlaqo Bepul
  freeLimitFormatted: '5.00 GB'
};

// Rasmiy Google OAuth 2.0 Web Client ID
export const DEFAULT_GOOGLE_CLIENT_ID = '688940162351-gl0aggpuls18cee908jnm401450npi7u.apps.googleusercontent.com';

export const DEMO_IDS = [
  'an-001', 'an-002', 'an-003', 'an-004', 'an-005',
  'an-006', 'an-007', 'an-008', 'an-009', 'an-010'
];

class NewsStore {
  constructor() {
    this.subscribers = [];
    this.isSyncing = false;
    this.init();
  }

  getDeletedIds() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const stored = localStorage.getItem(STORAGE_KEYS.DELETED_IDS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  purgeAllDemoNews() {
    const deletedIds = this.getDeletedIds();
    DEMO_IDS.forEach(id => {
      if (!deletedIds.includes(id)) deletedIds.push(id);
    });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(deletedIds));
    }

    let list = this.getNews();
    list = list.filter(n => !DEMO_IDS.includes(n.id));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(list));
    }

    let saved = this.getSavedIds();
    saved = saved.filter(id => !DEMO_IDS.includes(id));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(saved));
    }

    const apiUrl = this.getApiUrl();
    if (apiUrl) {
      DEMO_IDS.forEach(id => {
        fetch(`${apiUrl}/api/news/${id}`, { method: 'DELETE' }).catch(() => {});
      });
    }

    this.notify();
    return list;
  }

  init() {
    try {
      const deletedIds = this.getDeletedIds();

      // Demo xabarlarni avtomatik ravishda mutlaq o'chirilganlar (Blacklist) qatoriga kiritish
      let blacklistUpdated = false;
      DEMO_IDS.forEach(demoId => {
        if (!deletedIds.includes(demoId)) {
          deletedIds.push(demoId);
          blacklistUpdated = true;
        }
      });
      if (blacklistUpdated && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(deletedIds));
      }

      const storedNews = localStorage.getItem(STORAGE_KEYS.NEWS);
      let currentList = [];
      if (storedNews) {
        try {
          currentList = JSON.parse(storedNews);
        } catch {
          currentList = [];
        }
      }

      // Barcha demo xabarlarni xotiradan butunlay qirib tashlash
      const beforeClean = currentList.length;
      currentList = currentList.filter(item => !DEMO_IDS.includes(item.id) && !deletedIds.includes(item.id));
      if (currentList.length !== beforeClean || !storedNews) {
        localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(currentList));
      }

      // Saqlangan xabarlar (Bookmarks) orasidan ham demo xabarlarni tozalash
      let saved = this.getSavedIds();
      const beforeSavedClean = saved.length;
      saved = saved.filter(id => !DEMO_IDS.includes(id) && !deletedIds.includes(id));
      if (saved.length !== beforeSavedClean) {
        localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(saved));
      }

      if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
      }
      if (!localStorage.getItem(STORAGE_KEYS.SAVED)) {
        localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
        localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
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
  // BAZA HOLATI VA HAJMINI HISOBLASH (Qanchasi to'ldi, qanchasi qoldi)
  // =========================================================================

  getDatabaseStats() {
    const news = this.getNews();
    const newsJson = JSON.stringify(news);
    const catsJson = JSON.stringify(this.getCategories());

    // Xotirada ishlatilgan baytlar soni
    let usedBytes = 14500;
    try {
      usedBytes = new Blob([newsJson, catsJson]).size;
    } catch {
      usedBytes = (newsJson.length + catsJson.length) * 2;
    }

    const totalBytes = CLOUDFLARE_CONFIG.freeLimitBytes; // 5 GB
    const remainingBytes = Math.max(0, totalBytes - usedBytes);
    const percentage = ((usedBytes / totalBytes) * 100).toFixed(4);

    return {
      databaseName: CLOUDFLARE_CONFIG.databaseName,
      databaseId: CLOUDFLARE_CONFIG.databaseId,
      accountId: CLOUDFLARE_CONFIG.accountId,
      provider: 'Cloudflare D1 SQL (Serverless SQLite)',
      isConnected: this.isCloudflareConnected(),
      apiUrl: this.getApiUrl(),
      newsCount: news.length,
      totalCapacity: CLOUDFLARE_CONFIG.freeLimitFormatted,
      usedBytes: usedBytes,
      usedFormatted: this.formatBytes(usedBytes),
      remainingBytes: remainingBytes,
      remainingFormatted: this.formatBytes(remainingBytes),
      percentageUsed: percentage,
      percentageRemaining: (100 - parseFloat(percentage)).toFixed(2),
      backupStatus: '🟢 Faol (Har ehtimolga qarshi mahalliy zaxira saqlanmoqda)'
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // =========================================================================
  // CLOUDFLARE INTEGRATSIYASI
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

  // Cloudflare D1 bazasidan yangiliklarni yuklab olish (Dual-Storage sinxronlash)
  async syncFromCloudflare() {
    const apiUrl = this.getApiUrl();
    if (!apiUrl || this.isSyncing) return;

    this.isSyncing = true;
    try {
      const res = await fetch(`${apiUrl}/api/news`);
      if (res.ok) {
        const cloudNews = await res.json();
        if (Array.isArray(cloudNews) && cloudNews.length > 0) {
          // O'chirilgan va demo maqolalar qaytib kelmasligini kafolatlash
          const deletedIds = this.getDeletedIds();
          const filtered = cloudNews.filter(n => !deletedIds.includes(n.id) && !DEMO_IDS.includes(n.id));

          // Mahalliy qo'shilgan yangiliklar o'chib ketmasligi uchun birlashtirish (Merge)
          const localNews = this.getNews();
          const map = new Map();
          // Avval bulutdagi yangiliklar
          filtered.forEach(item => map.set(item.id, item));
          // Keyin mahalliy qo'shilgan yangiliklar (hech qachon yo'qolmasligi uchun)
          localNews.forEach(item => {
            if (!deletedIds.includes(item.id) && !DEMO_IDS.includes(item.id)) {
              map.set(item.id, { ...(map.get(item.id) || {}), ...item });
            }
          });
          const merged = Array.from(map.values()).sort((a, b) => this.compareNewest(a, b));
          localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(merged));
          this.notify();
          return merged;
        }
      }
    } catch (err) {
      console.warn('Cloudflare D1 dan yuklashda ogohlantirish (Mahalliy zaxira ishlamoqda):', err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  // =========================================================================
  // YANGILIKLAR BO'YICHA METODLAR (Manba va Saralash bilan birga)
  // =========================================================================

  parseTimestamp(item) {
    if (!item) return 0;
    if (item.createdAt) {
      const t = new Date(item.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (item.id && typeof item.id === 'string' && item.id.startsWith('an-')) {
      const numPart = item.id.replace('an-', '');
      if (numPart.length >= 10 && !isNaN(Number(numPart))) {
        return Number(numPart);
      }
    }
    if (item.date && typeof item.date === 'string') {
      const parts = item.date.split('.');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        let hour = 0;
        let minute = 0;
        if (item.time && typeof item.time === 'string') {
          const tParts = item.time.split(':');
          hour = parseInt(tParts[0], 10) || 0;
          minute = parseInt(tParts[1], 10) || 0;
        }
        const d = new Date(year, month, day, hour, minute);
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
    return 0;
  }

  compareNewest(a, b) {
    const tB = this.parseTimestamp(b);
    const tA = this.parseTimestamp(a);
    if (tB !== tA) return tB - tA;
    if (a.id && b.id && typeof a.id === 'string' && typeof b.id === 'string') {
      return a.id.localeCompare(b.id);
    }
    return 0;
  }

  // Barcha yangiliklar eng oxirgi qo'yilganlar tartibida (xronologik, eng yangisi oldinda)
  getNews() {
    const deletedIds = this.getDeletedIds();
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.NEWS);
      const list = stored ? JSON.parse(stored) : [];
      const filtered = list.filter(n => !deletedIds.includes(n.id) && !DEMO_IDS.includes(n.id));
      return [...filtered].sort((a, b) => this.compareNewest(a, b));
    } catch {
      return [];
    }
  }

  // Trenddagi yangiliklar eng ko'p ko'rilganlar soni bo'yicha (views kamayish tartibida)
  getTrendingNews() {
    const list = this.getNews();
    return [...list].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));
  }

  // Eng oxirgi qo'shilgan yangiliklar
  getLatestNews(limit = null) {
    const list = this.getNews();
    return limit ? list.slice(0, limit) : list;
  }

  getNewsById(id) {
    if (!id || DEMO_IDS.includes(id)) return null;
    const deletedIds = this.getDeletedIds();
    if (deletedIds.includes(id)) return null;
    const list = this.getNews();
    return list.find(item => item.id === id);
  }

  getCategories() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES)) || INITIAL_CATEGORIES;
      return stored.filter(c => c.id !== 'trend');
    } catch {
      return INITIAL_CATEGORIES.filter(c => c.id !== 'trend');
    }
  }

  getCategoryName(categoryId) {
    if (!categoryId) return 'Yangilik';
    if (categoryId === 'all') return 'Barchasi';
    if (categoryId === 'trend') return 'Trend';
    if (categoryId === 'video') return 'Video';
    const cats = this.getCategories();
    const found = cats.find(c => c.id === categoryId);
    return found ? found.name : (categoryId.charAt(0).toUpperCase() + categoryId.slice(1));
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

  getSavedIds() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const user = this.getUser();
      const userKey = user && user.id ? `${STORAGE_KEYS.SAVED}_${user.id}` : STORAGE_KEYS.SAVED;
      const stored = localStorage.getItem(userKey);
      if (stored) return JSON.parse(stored);
      // Agar yangi foydalanuvchi bo'lsa va hali saqlamagan bo'lsa, umumiy saqlanganlardan ko'chiramiz
      if (user && user.id) {
        const guestData = localStorage.getItem(STORAGE_KEYS.SAVED);
        const guestList = guestData ? JSON.parse(guestData) : [];
        if (guestList.length > 0) {
          localStorage.setItem(userKey, JSON.stringify(guestList));
          return guestList;
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  toggleSaveNews(id) {
    let saved = this.getSavedIds();
    const user = this.getUser();
    if (saved.includes(id)) {
      saved = saved.filter(savedId => savedId !== id);
    } else {
      saved.push(id);
    }
    const userKey = user && user.id ? `${STORAGE_KEYS.SAVED}_${user.id}` : STORAGE_KEYS.SAVED;
    localStorage.setItem(userKey, JSON.stringify(saved));
    localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(saved));
    this.notify();
    return saved.includes(id);
  }

  // =========================================================================
  // FOYDALANUVCHILAR BAZASI VA AUTH (KIRISH / RO'YXATDAN O'TISH)
  // =========================================================================

  getRegisteredUsers() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const data = localStorage.getItem(STORAGE_KEYS.USERS_DB);
      if (data) {
        return JSON.parse(data);
      }
      const initialUsers = [
        {
          id: 'an_usr_antivirus_1001',
          username: 'antivirus',
          name: 'ANTIVIRUS Tahririyati',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
          role: 'admin',
          provider: 'system',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(initialUsers));
      return initialUsers;
    } catch {
      return [];
    }
  }

  saveRegisteredUser(user) {
    try {
      const users = this.getRegisteredUsers();
      const existingIdx = users.findIndex(u => 
        (user.id && u.id === user.id) || 
        (user.username && u.username && u.username.toLowerCase() === user.username.toLowerCase())
      );
      if (existingIdx >= 0) {
        users[existingIdx] = { ...users[existingIdx], ...user };
      } else {
        users.push(user);
      }
      localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));
    } catch (e) {
      console.error('Foydalanuvchini saqlashda xatolik:', e);
    }
  }

  cleanUsernameString(str) {
    if (!str) return 'user';
    const cyrillicToLatinMap = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'j','з':'z',
      'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
      'с':'s','т':'t','у':'u','ф':'f','х':'x','ц':'ts','ч':'ch','ш':'sh','щ':'sh',
      'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya','ў':'o','ғ':'g','қ':'q','ҳ':'h'
    };
    let s = str.trim().toLowerCase();
    s = s.replace(/[а-яёўғқҳ]/g, ch => cyrillicToLatinMap[ch] || ch);
    s = s.replace(/[^a-z0-9_.]/g, '');
    return s || 'user';
  }

  findUser(query) {
    if (!query) return null;
    const clean = query.trim().toLowerCase().replace(/^@/, '');
    const cleanSlug = this.cleanUsernameString(clean);
    const users = this.getRegisteredUsers();
    return users.find(u => 
      (u.username && (u.username.toLowerCase() === clean || u.username.toLowerCase() === cleanSlug)) ||
      (u.id && u.id.toLowerCase() === clean) ||
      (u.name && u.name.toLowerCase() === clean)
    ) || null;
  }

  isUsernameTaken(username) {
    if (!username) return false;
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    const users = this.getRegisteredUsers();
    return users.some(u => u.username && u.username.toLowerCase() === clean);
  }

  registerUser({ username, name, avatar }) {
    const rawUsername = (username || name || '').trim();
    if (!rawUsername) {
      return { ok: false, error: 'Iltimos, ism yoki taxallus kiriting!' };
    }
    const cleanUsername = this.cleanUsernameString(rawUsername);

    let finalUsername = cleanUsername;
    let counter = 1;
    while (this.isUsernameTaken(finalUsername)) {
      counter++;
      finalUsername = `${cleanUsername}_${counter}`;
    }

    // Har bir odamga usha ism/nomga qarab unikal ID beriladi
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const uniqueId = `an_${finalUsername}_${randomSuffix}`;
    const displayName = (name && name.trim()) || rawUsername;

    const newUser = {
      id: uniqueId,
      username: finalUsername,
      name: displayName,
      avatar: avatar || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80`,
      role: 'member',
      provider: 'antivirus',
      createdAt: new Date().toISOString()
    };

    this.saveRegisteredUser(newUser);
    this.setUser(newUser);

    return { ok: true, user: newUser };
  }

  loginUser(identifier) {
    const raw = (identifier || '').trim();
    if (!raw) {
      return { ok: false, error: 'Iltimos, ismingiz yoki taxallusingizni kiriting!' };
    }

    let user = this.findUser(raw);
    if (!user) {
      // Foydalanuvchi topilmasa, to'xtatmasdan avtomatik unikal hisob ochib darhol tizimga kiritamiz!
      return this.registerUser({ username: raw, name: raw });
    }

    this.setUser(user);
    return { ok: true, user };
  }

  getUser() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const data = localStorage.getItem(STORAGE_KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  setUser(user) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      }
      if (user && user.id) {
        this.saveRegisteredUser(user);
      }
      const providerLabel = user.provider === 'google' ? 'Google' : 'ANTIVIRUS ID';
      this.addNotification({
        title: 'Xush kelibsiz!',
        text: `${user.name || 'Foydalanuvchi'} (${providerLabel}) orqali tizimga kirdingiz`,
        time: 'Hozirgina'
      });
      this.notify();
    } catch (e) {
      console.error('Foydalanuvchini saqlashda xatolik:', e);
    }
  }

  logout() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
      this.addNotification({
        title: 'Tizimdan chiqildi',
        text: 'Hisobingizdan muvaffaqiyatli chiqdingiz',
        time: 'Hozirgina'
      });
      this.notify();
    } catch (e) {
      console.error('Chiqishda xatolik:', e);
    }
  }

  getGoogleClientId() {
    try {
      if (typeof localStorage === 'undefined') return DEFAULT_GOOGLE_CLIENT_ID;
      const custom = localStorage.getItem(STORAGE_KEYS.GOOGLE_CLIENT_ID);
      return (custom && custom.trim()) ? custom.trim() : DEFAULT_GOOGLE_CLIENT_ID;
    } catch {
      return DEFAULT_GOOGLE_CLIENT_ID;
    }
  }

  setGoogleClientId(clientId) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.GOOGLE_CLIENT_ID, (clientId || '').trim());
      }
      this.notify();
    } catch (e) {
      console.error(e);
    }
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
      createdAt: now.toISOString(),
      views: 1,
      isHero: Boolean(newsData.isHero),
      isTrending: Boolean(newsData.isTrending),
      isSlider: Boolean(newsData.isSlider),
      title: newsData.title,
      category: newsData.category || 'video',
      categoryName: newsData.categoryName || this.getCategoryName(newsData.category || 'video'),
      imageUrl: newsData.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80',
      summary: newsData.summary || '',
      content: newsData.content || '',
      author: newsData.author || (this.getUser() ? this.getUser().name : 'ANTIVIRUS Tahririyati'),
      // Qaysi saytdan olingani (Manba va uning havolasi)
      source: newsData.source || 'ANTIVIRUS Tahririyati',
      sourceUrl: newsData.sourceUrl || '',
      readTime: newsData.readTime || '3 daqiqa',
      tags: newsData.tags ? (Array.isArray(newsData.tags) ? newsData.tags : newsData.tags.split(',').map(s => s.trim())) : ['Yangilik'],
      videoUrl: newsData.videoUrl || null,
      // Video va Rasm ko'rinish formati (16:9, 3:4, 9:16, 1:1, auto) va joylashuv tartibi
      aspectRatio: newsData.aspectRatio || '16:9',
      mediaLayout: newsData.mediaLayout || 'top'
    };

    if (newArticle.isHero) {
      list.forEach(n => { n.isHero = false; });
    }

    // 1. DUAL-STORAGE KAFOLATI: Har ehtimolga qarshi mahalliy zaxiraga darhol saqlaymiz!
    list.unshift(newArticle);
    localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(list));
    this.addNotification({
      title: 'Yangi xabar qo‘shildi',
      text: newArticle.title,
      time: 'Hozirgina'
    });
    this.notify();

    // 2. Cloudflare D1 ga yuborish
    const apiUrl = this.getApiUrl();
    if (apiUrl) {
      try {
        await fetch(`${apiUrl}/api/news`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newArticle)
        });
      } catch (err) {
        console.warn('Cloudflare D1 ga yozishda xatolik (Mahalliy nusxa saqlandi):', err);
      }
    }

    return newArticle;
  }

  async deleteNews(id) {
    if (!id) return;

    // 1. O'chirilganlar ro'yxatiga qo'shish (hech qachon qayta tiklanmasligi uchun Blacklist)
    const deleted = this.getDeletedIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(deleted));
    }

    // 2. Mahalliy xotiradagi asosiy ro'yxatdan tozalash
    let list = this.getNews();
    list = list.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(list));

    // 3. Saqlangan xabarlar (Bookmarks) ro'yxatidan ham tozalash
    let saved = this.getSavedIds();
    if (saved.includes(id)) {
      saved = saved.filter(savedId => savedId !== id);
      localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(saved));
    }

    // 4. Interfeysni darhol yangilash
    this.notify();

    // 5. Cloudflare D1 server bazasidan ham o'chirish
    const apiUrl = this.getApiUrl();
    if (apiUrl) {
      try {
        await fetch(`${apiUrl}/api/news/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Cloudflare D1 dan o‘chirishda xatolik:', err);
      }
    }
  }

  // -------------------------------------------------------------
  // MARKAZIY BANK (CBU.UZ) RASMIY VALYUTA KURSLARI
  // -------------------------------------------------------------
  getCbuRates() {
    try {
      const stored = localStorage.getItem('antivirus_news_cbu_rates');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return {
      date: '17.10.2026',
      rates: [
        { Ccy: 'USD', Rate: '12055.90', Diff: '44.25', flag: '🇺🇸', name: 'AQSH dollari' },
        { Ccy: 'EUR', Rate: '13572.53', Diff: '109.87', flag: '🇪🇺', name: 'Evro' },
        { Ccy: 'RUB', Rate: '144.16', Diff: '0.99', flag: '🇷🇺', name: 'Rossiya rubli' }
      ]
    };
  }

  async fetchLiveCbuRates() {
    try {
      const res = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/');
      if (!res.ok) throw new Error('CBU API error');
      const data = await res.json();
      const flags = { USD: '🇺🇸', EUR: '🇪🇺', RUB: '🇷🇺', GBP: '🇬🇧', KZT: '🇰🇿' };
      const main = ['USD', 'EUR', 'RUB'];
      const filtered = data
        .filter(item => main.includes(item.Ccy))
        .map(item => ({
          Ccy: item.Ccy,
          Rate: item.Rate,
          Diff: item.Diff,
          Date: item.Date,
          flag: flags[item.Ccy] || '🌐',
          name: item.CcyNm_UZ || item.Ccy
        }));

      if (filtered.length > 0) {
        const payload = {
          date: filtered[0].Date || new Date().toLocaleDateString('uz-UZ'),
          rates: filtered,
          updatedAt: Date.now()
        };
        localStorage.setItem('antivirus_news_cbu_rates', JSON.stringify(payload));
        this.notify();
        return payload;
      }
    } catch (e) {
      console.warn('CBU API yuklashda xatolik:', e.message);
    }
    return this.getCbuRates();
  }

  getAds() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ADS)) || INITIAL_ADS;
    } catch {
      return INITIAL_ADS;
    }
  }

  resetToDefaults() {
    localStorage.removeItem(STORAGE_KEYS.DELETED_IDS);
    localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(INITIAL_NEWS));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.ADS, JSON.stringify(INITIAL_ADS));
    this.notify();
  }
}

export const store = new NewsStore();
