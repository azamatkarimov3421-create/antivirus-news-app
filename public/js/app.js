// ANTIVIRUS NEWS — Sof Mobil Ilova Mantig'i (Pure Mobile Experience)

import { store } from './store.js';
import { Icons, getCategoryIcon } from './icons.js';

class AntivirusMobileApp {
  constructor() {
    this.currentTab = 'home'; // 'home' | 'trend' | 'video' | 'menu'
    this.selectedCategory = 'all';
    this.activeArticleId = null;
    this.searchQuery = '';
    this.speechSynthesis = window.speechSynthesis;
    this.isSpeaking = false;
    this.isQuickAddOpen = false;

    this.init();
  }

  init() {
    // Mavzuni yuklash
    const theme = store.getTheme();
    document.documentElement.setAttribute('data-theme', theme);

    // Reaktiv store o'zgarishini tinglash
    store.subscribe(() => this.render());

    // Tugmalar
    this.render();
  }

  setTab(tab) {
    this.currentTab = tab;
    this.activeArticleId = null;
    this.render();
  }

  setCategory(catId) {
    this.selectedCategory = catId;
    if (this.currentTab === 'menu') {
      this.currentTab = 'home';
    }
    this.render();
  }

  toggleTheme() {
    const next = store.toggleTheme();
    this.showToast(next === 'dark' ? '🌙 Dark Mode yoqildi' : '☀️ Light Mode yoqildi');
  }

  openArticle(id) {
    this.activeArticleId = id;
    store.incrementViews(id);
    this.render();
  }

  closeArticle() {
    this.activeArticleId = null;
    if (this.speechSynthesis) this.speechSynthesis.cancel();
    this.isSpeaking = false;
    this.render();
  }

  toggleSpeech(text) {
    if (!this.speechSynthesis) {
      this.showToast('Brauzeringiz ovozli o‘qishni qo‘llab-quvvatlamaydi');
      return;
    }

    if (this.isSpeaking) {
      this.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.showToast('Ovozli o‘qish to‘xtatildi');
      this.render();
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'uz-UZ';
      utterance.rate = 1.0;
      utterance.onend = () => {
        this.isSpeaking = false;
        this.render();
      };
      this.speechSynthesis.speak(utterance);
      this.isSpeaking = true;
      this.showToast('🔊 Maqola ovozli o‘qilmoqda...');
      this.render();
    }
  }

  shareArticle(article) {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.summary,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${article.title}\n\nANTIVIRUS NEWS: ${window.location.href}`);
      this.showToast('Havola nusxalandi!');
    }
  }

  showToast(message) {
    const old = document.querySelector('.mobile-toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = 'mobile-toast';
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  // -------------------------------------------------------------
  // RENDER QILISH
  // -------------------------------------------------------------
  render() {
    const root = document.getElementById('app');
    if (!root) return;

    const theme = store.getTheme();

    root.innerHTML = `
      <div class="phone-viewport-container" data-theme="${theme}">
        <!-- 1. Status Bar -->
        <div class="mobile-status-bar">
          <span class="status-time">19:10</span>
          <div class="status-island">
            <div class="status-island-lens"></div>
          </div>
          <div class="status-indicators">
            <span>5G</span>
            <span>📶</span>
            <span>100%</span>
          </div>
        </div>

        <!-- 2. Header (Maqola ochiq bo'lmasa) -->
        ${!this.activeArticleId ? this.renderHeader(theme) : ''}

        <!-- 3. Asosiy Kontent Bo'limi -->
        ${this.activeArticleId ? this.renderArticleDetail() : this.renderCurrentTabContent()}

        <!-- 4. Pastki Navigatsiya Bar (Bottom Bar) -->
        ${!this.activeArticleId ? this.renderBottomBar() : ''}

        <!-- 5. Tezkor yangilik qo'shish modali (Sheet) -->
        ${this.renderQuickAddSheet()}
      </div>
    `;

    this.bindEvents();
  }

  // Header render
  renderHeader(theme) {
    return `
      <header class="mobile-header">
        <div class="brand-badge-group" data-tab-action="home">
          <span class="brand-an-symbol">AN</span>
          <div class="brand-text-block">
            <span class="brand-name-main">ANTIVIRUS</span>
            <span class="brand-name-sub">NEWS</span>
          </div>
        </div>

        <div class="header-action-tools">
          <button class="header-tool-btn" id="themeToggleBtn" title="Rejimni almashtirish">
            ${theme === 'dark' ? Icons.sun : Icons.moon}
          </button>
          <button class="header-tool-btn" id="searchBtn" title="Qidiruv">
            ${Icons.search}
          </button>
          <button class="header-tool-btn" id="bellBtn" title="Bildirishnomalar">
            ${Icons.bell}
            <span class="badge-dot-alert"></span>
          </button>
          <button class="header-tool-btn" id="quickAddBtn" title="Maqola qo‘shish" style="color: var(--an-red);">
            ${Icons.plus}
          </button>
        </div>
      </header>
    `;
  }

  // Joriy tabga qarab kontent renderi
  renderCurrentTabContent() {
    if (this.currentTab === 'menu') {
      return this.renderMenuView();
    } else if (this.currentTab === 'trend') {
      return this.renderTrendView();
    } else if (this.currentTab === 'video') {
      return this.renderVideoView();
    } else {
      return this.renderHomeView();
    }
  }

  // -------------------------------------------------------------
  // TAB 1: ASOSIY EKRAN (BOSH SAHIFA)
  // -------------------------------------------------------------
  renderHomeView() {
    const newsList = store.getNews();
    let displayList = newsList;

    if (this.selectedCategory !== 'all') {
      displayList = displayList.filter(n => n.category === this.selectedCategory);
    }
    if (this.searchQuery) {
      displayList = displayList.filter(n => 
        n.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        n.summary.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }

    const heroNews = displayList.find(n => n.isHero) || displayList[0];
    const streamNews = displayList.filter(n => n.id !== heroNews?.id);

    return `
      <!-- Gorizontal Toifalar (Horizontal Scrollable Tabs) -->
      <nav class="mobile-tabs-scroll">
        <div class="tab-pill-item ${this.selectedCategory === 'all' ? 'active' : ''}" data-cat-pill="all">Asosiy</div>
        <div class="tab-pill-item ${this.selectedCategory === 'siyosat' ? 'active' : ''}" data-cat-pill="siyosat">Siyosat</div>
        <div class="tab-pill-item ${this.selectedCategory === 'dunyo' ? 'active' : ''}" data-cat-pill="dunyo">Dunyo</div>
        <div class="tab-pill-item ${this.selectedCategory === 'jamiyat' ? 'active' : ''}" data-cat-pill="jamiyat">Jamiyat</div>
        <div class="tab-pill-item ${this.selectedCategory === 'biznes' ? 'active' : ''}" data-cat-pill="biznes">Biznes</div>
        <div class="tab-pill-item ${this.selectedCategory === 'sport' ? 'active' : ''}" data-cat-pill="sport">Sport</div>
        <div class="tab-pill-item ${this.selectedCategory === 'texnologiya' ? 'active' : ''}" data-cat-pill="texnologiya">Texnologiya</div>
      </nav>

      <main class="mobile-content-scroll">
        <!-- 1. Katta Hero Slayder Kartasi (Rasmdagi Mirziyoyev & Berdimuhamedov) -->
        ${heroNews ? `
          <div class="mobile-hero-slider" data-open-article="${heroNews.id}">
            <img class="hero-slider-img" src="${heroNews.imageUrl}" alt="${heroNews.title}" />
            <div class="hero-slider-gradient"></div>
            <div class="hero-slider-body">
              <span class="hero-category-badge">${heroNews.categoryName}</span>
              <h3 class="hero-headline-title">${heroNews.title}</h3>
              <div class="hero-meta-bar">
                <div class="hero-meta-left">
                  <span>${Icons.clock} ${heroNews.time}</span>
                  <span>${Icons.calendar} ${heroNews.date}</span>
                  <span>${Icons.eye} ${heroNews.views.toLocaleString()}</span>
                </div>
                <div class="hero-pagination-dots">
                  <span class="pag-dot-active"></span>
                  <span class="pag-dot-normal"></span>
                  <span class="pag-dot-normal"></span>
                  <span class="pag-dot-normal"></span>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- 2. 6 ta Tezkor Toifa Tugmalari (Quick Category Grid) -->
        <div class="mobile-category-grid-6">
          <div class="cat-grid-card ${this.selectedCategory === 'siyosat' ? 'active-selected' : ''}" data-cat-pill="siyosat">
            <div class="cat-grid-icon-box" style="color: #E50914;">${Icons.landmark}</div>
            <span class="cat-grid-label">Siyosat</span>
          </div>

          <div class="cat-grid-card ${this.selectedCategory === 'dunyo' ? 'active-selected' : ''}" data-cat-pill="dunyo">
            <div class="cat-grid-icon-box" style="color: #2563EB;">${Icons.globe}</div>
            <span class="cat-grid-label">Dunyo</span>
          </div>

          <div class="cat-grid-card ${this.selectedCategory === 'jamiyat' ? 'active-selected' : ''}" data-cat-pill="jamiyat">
            <div class="cat-grid-icon-box" style="color: #E50914;">${Icons.users}</div>
            <span class="cat-grid-label">Jamiyat</span>
          </div>

          <div class="cat-grid-card ${this.selectedCategory === 'biznes' ? 'active-selected' : ''}" data-cat-pill="biznes">
            <div class="cat-grid-icon-box" style="color: #EA580C;">${Icons.barChart}</div>
            <span class="cat-grid-label">Biznes</span>
          </div>

          <div class="cat-grid-card ${this.selectedCategory === 'sport' ? 'active-selected' : ''}" data-cat-pill="sport">
            <div class="cat-grid-icon-box" style="color: #16A34A;">${Icons.trophy}</div>
            <span class="cat-grid-label">Sport</span>
          </div>

          <div class="cat-grid-card" data-tab-action="menu">
            <div class="cat-grid-icon-box" style="color: #94A3B8;">${Icons.grid}</div>
            <span class="cat-grid-label">Barchasi</span>
          </div>
        </div>

        <!-- 3. So'nggi Yangiliklar Bloki -->
        <div class="mobile-section-header">
          <h2 class="section-title-text">
            ${this.searchQuery ? `Qidiruv: "${this.searchQuery}"` : 'So‘nggi yangiliklar'}
          </h2>
          <span class="section-link-more" data-tab-action="menu">
            Barchasi ${Icons.chevronRight}
          </span>
        </div>

        <div class="news-stream-list">
          ${streamNews.map(n => `
            <div class="news-stream-card" data-open-article="${n.id}">
              <img class="news-stream-thumb" src="${n.imageUrl}" alt="${n.title}" loading="lazy" />
              <div class="news-stream-content">
                <h4 class="news-stream-title">${n.title}</h4>
                <div class="news-stream-meta">
                  <span>${Icons.clock} ${n.time}</span>
                  <span>${Icons.eye} ${n.views.toLocaleString()}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </main>
    `;
  }

  // -------------------------------------------------------------
  // TAB 2: "BARCHASI" (MENYU) EKRANI (Rasmdagi 2-ekran)
  // -------------------------------------------------------------
  renderMenuView() {
    const categories = store.getCategories();

    return `
      <div class="mobile-menu-viewport">
        <div class="menu-viewport-header">
          <h1 class="menu-title-large">Barchasi</h1>
          <button class="header-tool-btn" id="menuSearchBtn">
            ${Icons.search}
          </button>
        </div>

        <!-- Bo'limlar ro'yxati -->
        <div class="menu-items-vertical-list">
          ${categories.map(c => `
            <div class="menu-item-row" data-cat-pill="${c.id}">
              <div class="menu-item-left">
                <div class="menu-item-icon-box" style="color: ${c.color};">
                  ${getCategoryIcon(c.icon)}
                </div>
                <span class="menu-item-text">${c.name}</span>
              </div>
              <span class="menu-item-chevron">${Icons.chevronRight}</span>
            </div>
          `).join('')}
        </div>

        <!-- Brend Identifikatsiya Kartasi -->
        <div class="brand-identity-card" data-tab-action="home">
          <div class="brand-round-badge-an">AN</div>
          <div class="brand-identity-texts">
            <h3 class="brand-identity-title">ANTIVIRUS NEWS</h3>
            <p class="brand-identity-desc">Global siyosat — oddiy tilda.<br>Qisqa va aniq yangiliklar.</p>
          </div>
          <span class="menu-item-chevron">${Icons.chevronRight}</span>
        </div>

        <!-- 4 ta Doiraviy Ijtimoiy Tarmoq Tugmasi -->
        <div class="social-network-row">
          <div class="social-network-item" onclick="window.open('https://t.me', '_blank')">
            <div class="social-network-circle sn-tg">${Icons.telegram}</div>
            <span class="social-network-name">Telegram</span>
          </div>

          <div class="social-network-item" onclick="window.open('https://youtube.com', '_blank')">
            <div class="social-network-circle sn-yt">${Icons.youtube}</div>
            <span class="social-network-name">YouTube</span>
          </div>

          <div class="social-network-item" onclick="window.open('https://tiktok.com', '_blank')">
            <div class="social-network-circle sn-tt">${Icons.tiktok}</div>
            <span class="social-network-name">TikTok</span>
          </div>

          <div class="social-network-item" onclick="window.open('https://instagram.com', '_blank')">
            <div class="social-network-circle sn-ig">${Icons.instagram}</div>
            <span class="social-network-name">Instagram</span>
          </div>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // TAB 3: TRENDLAR EKRANI
  // -------------------------------------------------------------
  renderTrendView() {
    const list = store.getNews().sort((a, b) => b.views - a.views);

    return `
      <main class="mobile-content-scroll" style="padding-top: 10px;">
        <div class="mobile-section-header">
          <h2 class="section-title-text" style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--an-red);">${Icons.trendingUp}</span> Trenddagi xabarlar
          </h2>
          <span style="font-size: 11px; color: var(--text-muted);">Eng ko‘p o‘qilgan</span>
        </div>

        <div class="news-stream-list">
          ${list.map((n, i) => `
            <div class="news-stream-card" data-open-article="${n.id}">
              <div style="font-size: 18px; font-weight: 900; color: ${i < 3 ? 'var(--an-red)' : 'var(--text-muted)'}; width: 28px; display: flex; align-items: center; justify-content: center;">
                #${i + 1}
              </div>
              <img class="news-stream-thumb" src="${n.imageUrl}" alt="${n.title}" />
              <div class="news-stream-content">
                <h4 class="news-stream-title">${n.title}</h4>
                <div class="news-stream-meta">
                  <span>${Icons.clock} ${n.time}</span>
                  <span>${Icons.eye} ${n.views.toLocaleString()}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </main>
    `;
  }

  // -------------------------------------------------------------
  // TAB 4: VIDEO YANGILIKLAR EKRANI
  // -------------------------------------------------------------
  renderVideoView() {
    const list = store.getNews();

    return `
      <main class="mobile-content-scroll" style="padding-top: 10px;">
        <div class="mobile-section-header">
          <h2 class="section-title-text" style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--an-red);">${Icons.playCircle}</span> Video yangiliklar
          </h2>
          <span style="font-size: 11px; color: var(--text-muted);">Eksklyuziv reportajlar</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${list.slice(0, 4).map(v => `
            <div class="mobile-hero-slider" style="height: 190px;" data-open-article="${v.id}">
              <img class="hero-slider-img" src="${v.imageUrl}" alt="${v.title}" />
              <div class="hero-slider-gradient"></div>
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 48px; height: 48px; border-radius: 50%; background: var(--an-red); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px var(--an-red-glow);">
                ${Icons.playCircle}
              </div>
              <div class="hero-slider-body">
                <span class="hero-category-badge">VIDEO</span>
                <h3 class="hero-headline-title">${v.title}</h3>
                <div class="hero-meta-bar">
                  <span>${Icons.clock} ${v.time} • ${v.views.toLocaleString()} ko‘rildi</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </main>
    `;
  }

  // -------------------------------------------------------------
  // ALOHIDA MAQOLA O'QISH EKRANI (ARTICLE READER)
  // -------------------------------------------------------------
  renderArticleDetail() {
    const article = store.getNewsById(this.activeArticleId);
    if (!article) return '';

    const isSaved = store.getSavedIds().includes(article.id);

    return `
      <div class="mobile-article-view">
        <div class="article-view-top-nav">
          <button class="article-back-btn" id="articleBackBtn">
            <span>←</span> <span>Orqaga</span>
          </button>
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="header-tool-btn" id="articleSaveBtn" style="color: ${isSaved ? 'var(--an-red)' : 'inherit'};">
              ${Icons.bookmark}
            </button>
            <button class="header-tool-btn" id="articleShareBtn">
              ${Icons.share}
            </button>
          </div>
        </div>

        <div class="article-cover-box">
          <img src="${article.imageUrl}" alt="${article.title}" />
        </div>

        <div class="article-detail-body">
          <div class="article-detail-meta">
            <span class="hero-category-badge">${article.categoryName}</span>
            <span>${Icons.clock} ${article.time} • ${article.date}</span>
            <span>${Icons.eye} ${article.views.toLocaleString()}</span>
          </div>

          <h1 class="article-detail-title">${article.title}</h1>

          <!-- Ovozli o'qish (Audio Player) -->
          <div class="article-audio-listen-bar">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700;">
              <span>🔊</span> <span>Ovozli eshitish</span>
            </div>
            <button class="listen-btn" id="articleAudioBtn">
              ${this.isSpeaking ? 'To‘xtatish' : 'Tinglash (Play)'}
            </button>
          </div>

          ${article.summary ? `
            <div class="article-lead-quote">${article.summary}</div>
          ` : ''}

          <div class="article-main-text">${article.content || article.summary}</div>

          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 16px 0;">
            ${(article.tags || []).map(t => `
              <span style="font-size: 11px; background: var(--pill-bg); color: var(--text-muted); padding: 3px 10px; border-radius: 12px; font-weight: 600;">#${t}</span>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // PASTKI NAVIGATSIYA BARI (BOTTOM NAVIGATION)
  // Asosiy, Trend, Markaziy 3D AN Tugmasi, Video, Barchasi
  // -------------------------------------------------------------
  renderBottomBar() {
    return `
      <div class="mobile-bottom-bar">
        <div class="bottom-nav-action ${this.currentTab === 'home' ? 'active' : ''}" data-tab-action="home">
          <div class="bottom-action-icon">${Icons.home}</div>
          <span class="bottom-action-label">Asosiy</span>
        </div>

        <div class="bottom-nav-action ${this.currentTab === 'trend' ? 'active' : ''}" data-tab-action="trend">
          <div class="bottom-action-icon">${Icons.trendingUp}</div>
          <span class="bottom-action-label">Trend</span>
        </div>

        <!-- MARKAZIY QIZIL 3D "AN" FLOATING TUGMASI -->
        <div class="center-floating-an-btn" id="centerAnPulseBtn" title="ANTIVIRUS Tezkor Yangiliklar">
          <div class="center-floating-an-circle">AN</div>
        </div>

        <div class="bottom-nav-action ${this.currentTab === 'video' ? 'active' : ''}" data-tab-action="video">
          <div class="bottom-action-icon">${Icons.playCircle}</div>
          <span class="bottom-action-label">Video</span>
        </div>

        <div class="bottom-nav-action ${this.currentTab === 'menu' ? 'active' : ''}" data-tab-action="menu">
          <div class="bottom-action-icon">${Icons.menu}</div>
          <span class="bottom-action-label">Barchasi</span>
        </div>

        <div class="home-indicator-bar"></div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // MOBIL TEZKOR YANGILIK QO'SHISH SHEET (ADMIN)
  // -------------------------------------------------------------
  renderQuickAddSheet() {
    const categories = store.getCategories().filter(c => c.id !== 'all');

    return `
      <div id="quickAddSheet" class="mobile-sheet-backdrop ${this.isQuickAddOpen ? 'open' : ''}">
        <div class="mobile-sheet-container">
          <div class="sheet-handle-bar"></div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="font-size: 16px; font-weight: 800;">Yangi Yangilik Joylash</h3>
            <button id="closeSheetBtn" style="color: var(--text-muted); font-size: 18px;">✕</button>
          </div>

          <form id="mobileAddNewsForm">
            <div class="sheet-field">
              <label class="sheet-field-label">Sarlavha *</label>
              <input type="text" name="title" class="sheet-input" required placeholder="Yangilik sarlavhasi..." />
            </div>

            <div class="sheet-field">
              <label class="sheet-field-label">Kategoriya *</label>
              <select name="category" class="sheet-select">
                ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>

            <div class="sheet-field">
              <label class="sheet-field-label">Rasm URL</label>
              <input type="url" name="imageUrl" class="sheet-input" value="https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80" />
            </div>

            <div class="sheet-field">
              <label class="sheet-field-label">Qisqa Anons</label>
              <textarea name="summary" class="sheet-textarea" rows="2" placeholder="Qisqacha mazmuni..."></textarea>
            </div>

            <div class="sheet-field">
              <label class="sheet-field-label">To‘liq Matn *</label>
              <textarea name="content" class="sheet-textarea" rows="4" required placeholder="Batafsil matn..."></textarea>
            </div>

            <button type="submit" class="sheet-submit-btn">Nashr qilish</button>
          </form>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // HODISALARNI BIRIKTIRISH
  // -------------------------------------------------------------
  bindEvents() {
    // 1. Tab almashtirish
    document.querySelectorAll('[data-tab-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab-action');
        if (tab) this.setTab(tab);
      });
    });

    // 2. Kategoriya filtri
    document.querySelectorAll('[data-cat-pill]').forEach(el => {
      el.addEventListener('click', (e) => {
        const cat = e.currentTarget.getAttribute('data-cat-pill');
        if (cat) this.setCategory(cat);
      });
    });

    // 3. Rejim almashtirish (Theme toggle)
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // 4. Maqolani ochish
    document.querySelectorAll('[data-open-article]').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = el.getAttribute('data-open-article');
        if (id) this.openArticle(id);
      });
    });

    // 5. Orqaga qaytish
    document.getElementById('articleBackBtn')?.addEventListener('click', () => {
      this.closeArticle();
    });

    // 6. Audio tinglash
    document.getElementById('articleAudioBtn')?.addEventListener('click', () => {
      const art = store.getNewsById(this.activeArticleId);
      if (art) this.toggleSpeech(`${art.title}. ${art.summary}. ${art.content}`);
    });

    // 7. Saqlash (Bookmark)
    document.getElementById('articleSaveBtn')?.addEventListener('click', () => {
      if (this.activeArticleId) {
        const saved = store.toggleSaveNews(this.activeArticleId);
        this.showToast(saved ? '⭐ Maqola saqlandi' : 'Maqola saqlanganlardan olindi');
        this.render();
      }
    });

    // 8. Ulashish (Share)
    document.getElementById('articleShareBtn')?.addEventListener('click', () => {
      const art = store.getNewsById(this.activeArticleId);
      if (art) this.shareArticle(art);
    });

    // 9. Markaziy AN tugmasi bosilganda
    document.getElementById('centerAnPulseBtn')?.addEventListener('click', () => {
      this.showToast('🛡️ ANTIVIRUS NEWS — Lenta yangilandi!');
      this.setTab('home');
    });

    // 10. Qidiruv lupasi
    const onSearchClick = () => {
      const q = prompt('Qidirmoqchi bo‘lgan yangilik sarlavhasini kiriting:');
      if (q !== null) {
        this.searchQuery = q.trim();
        this.setTab('home');
      }
    };
    document.getElementById('searchBtn')?.addEventListener('click', onSearchClick);
    document.getElementById('menuSearchBtn')?.addEventListener('click', onSearchClick);

    // 11. Bildirishnoma qo'ng'irog'i
    document.getElementById('bellBtn')?.addEventListener('click', () => {
      const notifs = store.getNotifications();
      const text = notifs.map(n => `• ${n.title}: ${n.text}`).join('\n\n');
      alert(`🔔 ANTIVIRUS NEWS:\n\n${text || 'Yangi bildirishnomalar mavjud emas'}`);
    });

    // 12. Tezkor qo'shish modali (Sheet)
    document.getElementById('quickAddBtn')?.addEventListener('click', () => {
      this.isQuickAddOpen = true;
      this.render();
    });

    document.getElementById('closeSheetBtn')?.addEventListener('click', () => {
      this.isQuickAddOpen = false;
      this.render();
    });

    document.getElementById('mobileAddNewsForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      store.createNews({
        title: fd.get('title'),
        category: fd.get('category'),
        imageUrl: fd.get('imageUrl'),
        summary: fd.get('summary'),
        content: fd.get('content'),
        isHero: false,
        isTrending: true
      });
      this.isQuickAddOpen = false;
      this.showToast('✅ Yangilik nashr qilindi!');
      this.setTab('home');
    });
  }
}

// Ilovani ishga tushirish
document.addEventListener('DOMContentLoaded', () => {
  window.antivirusMobileApp = new AntivirusMobileApp();
});
