// ANTIVIRUS NEWS - Reactive LocalStorage Store

import { INITIAL_CATEGORIES, INITIAL_NEWS, INITIAL_CURRENCIES, INITIAL_ADS } from './data.js';

const STORAGE_KEYS = {
  NEWS: 'antivirus_news_list',
  CATEGORIES: 'antivirus_categories',
  SAVED: 'antivirus_saved_news',
  THEME: 'antivirus_theme',
  ADS: 'antivirus_ads',
  NOTIFICATIONS: 'antivirus_notifications',
  VIEW_MODE: 'antivirus_view_mode' // 'desktop' | 'mobile-preview'
};

class NewsStore {
  constructor() {
    this.subscribers = [];
    this.init();
  }

  init() {
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
      localStorage.setItem(STORAGE_KEYS.THEME, 'dark'); // default dark mode, stylish
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
  }

  createNews(newsData) {
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

    list.unshift(newArticle);
    localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(list));
    this.addNotification({
      title: 'Yangi xabar qo‘shildi',
      text: newArticle.title,
      time: 'Hozirgina'
    });
    this.notify();
    return newArticle;
  }

  updateNews(id, updateData) {
    const list = this.getNews();
    const index = list.findIndex(n => n.id === id);
    if (index !== -1) {
      if (updateData.isHero) {
        list.forEach(n => { n.isHero = false; });
      }
      list[index] = {
        ...list[index],
        ...updateData,
        categoryName: this.getCategoryName(updateData.category || list[index].category)
      };
      localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(list));
      this.notify();
      return list[index];
    }
    return null;
  }

  deleteNews(id) {
    let list = this.getNews();
    list = list.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(list));
    this.notify();
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
