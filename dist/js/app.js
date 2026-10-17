// ANTIVIRUS NEWS — Siyraklashtirilgan, Aniq va Tezkor Ilova Mantig'i
// Cloudflare (D1 SQL Baza + R2 Xotira) bilan to'liq integratsiya qilingan
import { store } from './store.js';
import { Icons, getCategoryIcon } from './icons.js';

class AntivirusApp {
  constructor() {
    this.currentTab = 'home'; // 'home' | 'trend' | 'video' | 'menu'
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.activeArticleId = null;
    this.isCfModalOpen = false;
    this.cfActiveTab = 'stats'; // 'stats' | 'add-news' | 'list'
    this.cfTestStatus = null;
    this.isUploadingMedia = false;
    this.speechSynth = window.speechSynthesis;
    this.isAudioPlaying = false;

    this.init();
  }

  init() {
    // Mavzuni o'rnatish
    const theme = store.getTheme();
    document.documentElement.setAttribute('data-theme', theme);

    // Reaktiv store yangilanishlarini tinglash
    store.subscribe(() => this.render());

    // Escape tugmasi oynalarni yopadi, Ctrl+Shift+A esa maxfiy admin panelni ochadi
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isCfModalOpen) this.closeCfModal();
        if (this.activeArticleId) this.closeArticle();
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        this.openCfModal('connect');
      }
    });

    // Maxfiy admin havolasi: ?admin=true
    if (window.location.search.includes('admin=true')) {
      setTimeout(() => this.openCfModal('connect'), 300);
    }

    this.render();
  }

  toggleTheme() {
    const next = store.toggleTheme();
    this.showToast(next === 'dark' ? '🌙 Dark Mode yoqildi' : '☀️ Light Mode yoqildi');
  }

  setCategory(catId) {
    this.selectedCategory = catId;
    if (this.currentTab === 'menu') {
      this.currentTab = 'home';
    }
    this.render();
  }

  setTab(tab) {
    this.currentTab = tab;
    this.activeArticleId = null;
    this.render();
  }

  openArticle(id) {
    this.activeArticleId = id;
    store.incrementViews(id);
    this.render();
  }

  closeArticle() {
    this.activeArticleId = null;
    if (this.speechSynth) this.speechSynth.cancel();
    this.isAudioPlaying = false;
    this.render();
  }

  openCfModal(tab = 'stats') {
    this.isCfModalOpen = true;
    this.cfActiveTab = tab;
    this.render();
  }

  closeCfModal() {
    this.isCfModalOpen = false;
    this.render();
  }

  toggleAudio(text) {
    if (!this.speechSynth) {
      this.showToast('Brauzeringiz ovozli o‘qishni qo‘llab-quvvatlamaydi');
      return;
    }

    if (this.isAudioPlaying) {
      this.speechSynth.cancel();
      this.isAudioPlaying = false;
      this.showToast('Ovozli o‘qish to‘xtatildi');
      this.render();
    } else {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'uz-UZ';
      utter.rate = 1.0;
      utter.onend = () => {
        this.isAudioPlaying = false;
        this.render();
      };
      this.speechSynth.speak(utter);
      this.isAudioPlaying = true;
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
    const existing = document.querySelector('.clean-toast-badge');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'clean-toast-badge';
    toast.innerHTML = `<span style="color: var(--an-red);">${Icons.shield}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  // -------------------------------------------------------------
  // ASOSIY RENDER QILISH
  // -------------------------------------------------------------
  render() {
    const root = document.getElementById('app');
    if (!root) return;

    const theme = store.getTheme();
    const categories = store.getCategories();
    const isCfConnected = store.isCloudflareConnected();

    root.innerHTML = `
      <div class="app-container" data-theme="${theme}">
        <!-- 1. Header (Logotip, Qidiruv, Cloudflare, Rejim) -->
        <header class="site-header">
          <div class="brand-identity" data-tab-link="home">
            <span class="brand-an-badge">AN</span>
            <div class="brand-texts">
              <span class="brand-title">ANTIVIRUS</span>
              <span class="brand-sub">NEWS</span>
            </div>
          </div>

          <div class="header-controls">
            <button class="icon-btn" id="themeSwitchBtn" title="Rejimni almashtirish">
              ${theme === 'dark' ? Icons.sun : Icons.moon}
            </button>
            <button class="icon-btn" id="searchTriggerBtn" title="Qidiruv">
              ${Icons.search}
            </button>
            <button class="icon-btn" id="notifBellBtn" title="Bildirishnomalar">
              ${Icons.bell}
            </button>
          </div>
        </header>

        <!-- 2. Gorizontal Toifalar (Swipeable Tabs) -->
        ${this.currentTab !== 'menu' ? this.renderCategoryTabs(categories) : ''}

        <!-- 3. Asosiy Tana (Body) -->
        <main class="main-view-body">
          ${this.renderActiveTabContent()}
        </main>

        <!-- 4. Pastki Navigatsiya Bar (Bottom Bar) -->
        <nav class="bottom-navigation-bar">
          <div class="nav-bottom-item ${this.currentTab === 'home' ? 'active' : ''}" data-tab-link="home">
            <span>${Icons.home}</span>
            <span class="nav-bottom-label">Asosiy</span>
          </div>

          <div class="nav-bottom-item ${this.currentTab === 'trend' ? 'active' : ''}" data-tab-link="trend">
            <span>${Icons.trendingUp}</span>
            <span class="nav-bottom-label">Trend</span>
          </div>

          <!-- MARKAZIY 3D QIZIL "AN" FLOATING TUGMASI -->
          <div class="center-floating-an" id="centerAnCircleBtn" title="Bosh sahifa">
            <div class="center-an-sphere">AN</div>
          </div>

          <div class="nav-bottom-item ${this.currentTab === 'video' ? 'active' : ''}" data-tab-link="video">
            <span>${Icons.playCircle}</span>
            <span class="nav-bottom-label">Video</span>
          </div>

          <div class="nav-bottom-item ${this.currentTab === 'menu' ? 'active' : ''}" data-tab-link="menu">
            <span>${Icons.menu}</span>
            <span class="nav-bottom-label">Barchasi</span>
          </div>
        </nav>

        <!-- 5. Maqola O'qish Oynasi (Modal) -->
        ${this.renderArticleModal()}

        <!-- 6. Cloudflare D1 + R2 Baza va Admin Oynasi (Modal) -->
        ${this.renderCloudflareModal()}
      </div>
    `;

    this.bindEvents();
  }

  // Gorizontal toifalar tasmasi
  renderCategoryTabs(categories) {
    return `
      <nav class="category-tabs-bar">
        ${categories.slice(0, 7).map(c => `
          <div class="cat-tab-item ${this.selectedCategory === c.id ? 'active' : ''}" data-cat-select="${c.id}">
            ${c.name}
          </div>
        `).join('')}
      </nav>
    `;
  }

  // Joriy tab mazmuni
  renderActiveTabContent() {
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
  // TAB 1: BOSH SAHIFA
  // -------------------------------------------------------------
  renderHomeView() {
    const newsList = store.getNews();

    let list = newsList;
    if (this.selectedCategory !== 'all') {
      list = list.filter(n => n.category === this.selectedCategory);
    }
    if (this.searchQuery) {
      list = list.filter(n =>
        n.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        n.summary.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }

    const heroNews = list.find(n => n.isHero) || list[0];
    const streamNews = list.filter(n => n.id !== heroNews?.id);

    return `
      <!-- 1. Katta Hero Slayder Kartasi -->
      ${heroNews ? `
        <div class="hero-card-banner" data-open-id="${heroNews.id}">
          <img class="hero-card-img" src="${heroNews.imageUrl}" alt="${heroNews.title}" />
          <div class="hero-card-gradient"></div>
          <div class="hero-card-info">
            <span class="hero-tag-badge">${heroNews.categoryName}</span>
            <h3 class="hero-card-title">${heroNews.title}</h3>
            <div class="hero-card-meta">
              <div class="hero-meta-left">
                <span>${Icons.clock} ${heroNews.time}</span>
                <span>${Icons.calendar} ${heroNews.date}</span>
                <span>${Icons.eye} ${heroNews.views.toLocaleString()}</span>
              </div>
              <div class="hero-dots-row">
                <span class="hero-dot-active"></span>
                <span class="hero-dot-normal"></span>
                <span class="hero-dot-normal"></span>
                <span class="hero-dot-normal"></span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 2. 6 ta Tezkor Toifa Tugmalari (Mockupdagi kabi) -->
      <div class="quick-categories-grid">
        <div class="quick-cat-box ${this.selectedCategory === 'siyosat' ? 'active' : ''}" data-cat-select="siyosat">
          <div class="quick-cat-icon" style="color: #E50914;">${Icons.landmark}</div>
          <span class="quick-cat-label">Siyosat</span>
        </div>
        <div class="quick-cat-box ${this.selectedCategory === 'dunyo' ? 'active' : ''}" data-cat-select="dunyo">
          <div class="quick-cat-icon" style="color: #2563EB;">${Icons.globe}</div>
          <span class="quick-cat-label">Dunyo</span>
        </div>
        <div class="quick-cat-box ${this.selectedCategory === 'jamiyat' ? 'active' : ''}" data-cat-select="jamiyat">
          <div class="quick-cat-icon" style="color: #DC2626;">${Icons.users}</div>
          <span class="quick-cat-label">Jamiyat</span>
        </div>
        <div class="quick-cat-box ${this.selectedCategory === 'biznes' ? 'active' : ''}" data-cat-select="biznes">
          <div class="quick-cat-icon" style="color: #EA580C;">${Icons.barChart}</div>
          <span class="quick-cat-label">Biznes</span>
        </div>
        <div class="quick-cat-box ${this.selectedCategory === 'sport' ? 'active' : ''}" data-cat-select="sport">
          <div class="quick-cat-icon" style="color: #16A34A;">${Icons.trophy}</div>
          <span class="quick-cat-label">Sport</span>
        </div>
        <div class="quick-cat-box" data-tab-link="menu">
          <div class="quick-cat-icon" style="color: #94A3B8;">${Icons.grid}</div>
          <span class="quick-cat-label">Barchasi</span>
        </div>
      </div>

      <!-- 3. So'nggi Yangiliklar Ro'yxati -->
      <div class="section-headline-bar">
        <h2 class="headline-text">
          ${this.searchQuery ? `Qidiruv: "${this.searchQuery}"` : 'So‘nggi yangiliklar'}
        </h2>
        <span class="headline-link-more" data-tab-link="menu">Barchasi ${Icons.chevronRight}</span>
      </div>

      <div class="news-stream-container">
        ${streamNews.map(n => `
          <div class="news-item-card" data-open-id="${n.id}">
            <img class="news-item-thumb" src="${n.imageUrl}" alt="${n.title}" loading="lazy" />
            <div class="news-item-details">
              <h4 class="news-item-title">${n.title}</h4>
              <div class="news-item-meta">
                <span>${Icons.clock} ${n.time}</span>
                <span>${Icons.eye} ${n.views.toLocaleString()}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // -------------------------------------------------------------
  // TAB 2: «BARCHASI» MENYUSI EKRANI (Mockupdagi 2-ekran)
  // -------------------------------------------------------------
  renderMenuView() {
    const categories = store.getCategories();
    const isCfConnected = store.isCloudflareConnected();

    return `
      <div class="menu-view-screen">
        <div class="menu-screen-header">
          <h1 class="menu-screen-title">Barchasi</h1>
          <button class="icon-btn" id="menuSearchBtn">${Icons.search}</button>
        </div>

        <!-- 11 ta Bo'limlar Ro'yxati -->
        <div class="categories-vertical-stack">
          ${categories.map(c => `
            <div class="cat-vertical-row" data-cat-select="${c.id}">
              <div class="cat-row-left">
                <div class="cat-row-icon" style="color: ${c.color};">
                  ${getCategoryIcon(c.icon)}
                </div>
                <span class="cat-row-name">${c.name}</span>
              </div>
              <span class="cat-row-chevron">${Icons.chevronRight}</span>
            </div>
          `).join('')}
        </div>

        <!-- Rasmdagi Brend Axborot Kartasi -->
        <div class="brand-identity-banner" data-tab-link="home">
          <div class="brand-round-icon">AN</div>
          <div class="brand-banner-body">
            <h4 class="brand-banner-name">ANTIVIRUS NEWS</h4>
            <p class="brand-banner-desc">Global siyosat — oddiy tilda.<br>Qisqa va aniq yangiliklar.</p>
          </div>
          <span class="cat-row-chevron">${Icons.chevronRight}</span>
        </div>

        <!-- 4 ta Doiraviy Ijtimoiy Tarmoq -->
        <div class="social-icons-row">
          <div class="social-round-btn" onclick="window.open('https://t.me', '_blank')">
            <div class="social-circle-wrap sn-telegram">${Icons.telegram}</div>
            <span class="social-label">Telegram</span>
          </div>

          <div class="social-round-btn" onclick="window.open('https://youtube.com', '_blank')">
            <div class="social-circle-wrap sn-youtube">${Icons.youtube}</div>
            <span class="social-label">YouTube</span>
          </div>

          <div class="social-round-btn" onclick="window.open('https://tiktok.com', '_blank')">
            <div class="social-circle-wrap sn-tiktok">${Icons.tiktok}</div>
            <span class="social-label">TikTok</span>
          </div>

          <div class="social-round-btn" onclick="window.open('https://instagram.com', '_blank')">
            <div class="social-circle-wrap sn-instagram">${Icons.instagram}</div>
            <span class="social-label">Instagram</span>
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
      <div class="section-headline-bar">
        <h2 class="headline-text" style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--an-red);">${Icons.trendingUp}</span> Trenddagi xabarlar
        </h2>
        <span style="font-size: 11px; color: var(--text-dim);">Eng ko‘p o‘qilgan</span>
      </div>

      <div class="news-stream-container">
        ${list.map((n, i) => `
          <div class="news-item-card" data-open-id="${n.id}">
            <div style="font-size: 18px; font-weight: 900; color: ${i < 3 ? 'var(--an-red)' : 'var(--text-dim)'}; width: 26px; display: flex; align-items: center; justify-content: center;">
              #${i + 1}
            </div>
            <img class="news-item-thumb" src="${n.imageUrl}" alt="${n.title}" />
            <div class="news-item-details">
              <h4 class="news-item-title">${n.title}</h4>
              <div class="news-item-meta">
                <span>${Icons.clock} ${n.time}</span>
                <span>${Icons.eye} ${n.views.toLocaleString()}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // -------------------------------------------------------------
  // TAB 4: VIDEO YANGILIKLAR EKRANI
  // -------------------------------------------------------------
  renderVideoView() {
    const list = store.getNews();

    return `
      <div class="section-headline-bar">
        <h2 class="headline-text" style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--an-red);">${Icons.playCircle}</span> Video yangiliklar
        </h2>
        <span style="font-size: 11px; color: var(--text-dim);">Eksklyuziv</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${list.slice(0, 4).map(v => `
          <div class="hero-card-banner" style="height: 200px;" data-open-id="${v.id}">
            <img class="hero-card-img" src="${v.imageUrl}" alt="${v.title}" />
            <div class="hero-card-gradient"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 48px; height: 48px; border-radius: 50%; background: var(--an-red); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px var(--an-red-glow);">
              ${Icons.playCircle}
            </div>
            <div class="hero-card-info">
              <span class="hero-tag-badge">VIDEO</span>
              <h3 class="hero-card-title">${v.title}</h3>
              <div class="hero-card-meta">
                <span>${Icons.clock} ${v.time} • ${v.views.toLocaleString()} ko‘rildi</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // -------------------------------------------------------------
  // ALOHIDA MAQOLA O'QISH OYNASI (MODAL)
  // -------------------------------------------------------------
  renderArticleModal() {
    if (!this.activeArticleId) return '';

    const article = store.getNewsById(this.activeArticleId);
    if (!article) return '';

    const isSaved = store.getSavedIds().includes(article.id);

    return `
      <div class="article-reader-backdrop open" id="articleBackdrop">
        <div class="article-reader-modal">
          <button class="close-modal-round" id="closeReaderBtn">${Icons.close}</button>

          <div class="article-media-cover">
            <img src="${article.imageUrl}" alt="${article.title}" />
          </div>

          <div class="article-text-body">
            <div class="article-badges-row">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="hero-tag-badge">${article.categoryName}</span>
                ${article.source ? `<span class="source-badge">Manba: ${article.source}</span>` : ''}
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span>${Icons.clock} ${article.time} • ${article.date}</span>
                <span>${Icons.eye} ${article.views.toLocaleString()}</span>
              </div>
            </div>

            <h1 class="article-title-text">${article.title}</h1>

            <!-- Audio Player (Ovozli eshitish) -->
            <div class="audio-listening-panel">
              <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700;">
                <span>🔊</span> <span>Ovozli eshitish</span>
              </div>
              <button class="audio-play-pill" id="articleAudioBtn">
                ${this.isAudioPlaying ? 'To‘xtatish' : 'Tinglash (Play)'}
              </button>
            </div>

            ${article.summary ? `
              <div class="article-lead-summary">${article.summary}</div>
            ` : ''}

            <div class="article-paragraphs">${article.content || article.summary}</div>

            ${article.sourceUrl ? `
              <div style="margin-bottom: 22px; font-size: 12px; color: var(--text-dim); background: var(--bg-pill); padding: 10px 14px; border-radius: 10px;">
                <span>Asl maqola havolasi:</span>
                <a href="${article.sourceUrl}" target="_blank" rel="noopener" style="color: var(--an-red); font-weight: 700; margin-left: 6px;">
                  ${article.source || 'Saytga o‘tish'} ↗
                </a>
              </div>
            ` : ''}

            <div class="article-action-tools-row">
              <div style="display: flex; gap: 8px;">
                <button class="tool-action-btn ${isSaved ? 'saved' : ''}" id="articleBookmarkBtn">
                  ${Icons.bookmark} <span>${isSaved ? 'Saqlangan' : 'Saqlash'}</span>
                </button>
                <button class="tool-action-btn" id="articleShareBtn">
                  ${Icons.share} <span>Ulashish</span>
                </button>
              </div>

              <button class="tool-action-btn" id="articleBackBtn">
                <span>← Orqaga</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // CLOUDFLARE D1 BOSHQARUV VA YANGILIK QO'SHISH OYNASI
  // -------------------------------------------------------------
  renderCloudflareModal() {
    if (!this.isCfModalOpen) return '';

    const currentUrl = store.getApiUrl();
    const stats = store.getDatabaseStats();
    const categories = store.getCategories();
    const newsList = store.getNews();

    return `
      <div class="article-reader-backdrop open" id="cfBackdrop">
        <div class="admin-modal-card">
          <!-- Modal Header -->
          <div class="admin-modal-header">
            <div class="admin-modal-title">
              <span style="color: var(--an-red);">☁️</span>
              <span>Cloudflare D1 Boshqaruv & Xotira</span>
            </div>
            <button class="icon-btn" id="closeCfModalBtn">${Icons.close}</button>
          </div>

          <!-- Modal Nav Tabs -->
          <div class="admin-nav-tabs">
            <button class="admin-tab-btn ${this.cfActiveTab === 'stats' ? 'active' : ''}" data-cf-tab="stats">
              📊 Baza & Xotira (5 GB)
            </button>
            <button class="admin-tab-btn ${this.cfActiveTab === 'add-news' ? 'active' : ''}" data-cf-tab="add-news">
              ✍️ Yangilik Qo‘shish
            </button>
            <button class="admin-tab-btn ${this.cfActiveTab === 'list' ? 'active' : ''}" data-cf-tab="list">
              📋 Maqolalar (${newsList.length})
            </button>
          </div>

          <!-- TAB 1: BAZA REKVIZITLARI VA XOTIRA HISOBI (QANCHASI TO'LDI, QANCHASI QOLDI) -->
          ${this.cfActiveTab === 'stats' ? `
            <div class="admin-modal-body">
              <!-- Jonli Xotira Hisoblagichi -->
              <div class="storage-meter-box">
                <div class="storage-meter-header">
                  <span>📊 Xotira Bandligi (Cloudflare D1)</span>
                  <span style="color: #10B981; font-weight: 800;">${stats.percentageUsed}% / 100%</span>
                </div>

                <div class="storage-track">
                  <div class="storage-fill" style="width: ${Math.max(1, stats.percentageUsed * 100)}%;"></div>
                </div>

                <div class="storage-stats-row">
                  <span>To‘ldi: <b style="color: var(--text-main);">${stats.usedFormatted}</b></span>
                  <span>Qoldi: <b style="color: #10B981;">${stats.remainingFormatted}</b></span>
                  <span>Jami: <b style="color: var(--text-main);">${stats.totalCapacity}</b></span>
                </div>
              </div>

              <!-- Baza Rekvizitlari -->
              <div class="db-details-grid">
                <div class="db-detail-item">
                  <span class="label">Baza Nomi</span>
                  <span class="val">${stats.databaseName}</span>
                </div>
                <div class="db-detail-item">
                  <span class="label">Baza ID</span>
                  <span class="val">${stats.databaseId}</span>
                </div>
                <div class="db-detail-item">
                  <span class="label">Provayder</span>
                  <span class="val">Cloudflare D1 SQL</span>
                </div>
                <div class="db-detail-item">
                  <span class="label">Baza Holati</span>
                  <span class="val" style="color: #10B981;">🟢 Ulangan & Faol</span>
                </div>
              </div>

              <!-- Dual-Storage Zaxira Kafolati (Fonda ishlamay qolsa har ehtimolga qarshi) -->
              <div class="status-info-box">
                <b style="color: #10B981;">🛡️ Dual-Storage Kafolati (Offline-First):</b><br>
                Barcha maqolalar fonda doimiy ravishda mahalliy zaxiraga (Local Storage) saqlanadi. Agar Cloudflare yoki internet vaqtincha uzilsa ham, saytingiz 100% to‘xtovsiz ishlab turaveradi va biror ma’lumot yo‘qolmaydi!
              </div>

              <!-- Worker API URL va Sinxronlash -->
              <div class="form-group" style="margin-top: 4px;">
                <label class="form-label">Cloudflare Worker API URL</label>
                <input
                  type="url"
                  id="cfWorkerUrlInput"
                  class="form-input"
                  placeholder="https://antivirus-news-api.sizning-subdomain.workers.dev"
                  value="${currentUrl}"
                />
              </div>

              <div style="display: flex; gap: 8px;">
                <button class="btn-primary-red" style="flex: 1;" id="cfSaveAndTestBtn">
                  <span>⚡ Ulanishni tekshirish va Saqlash</span>
                </button>
                <button class="btn-outline-pill" id="cfSyncNowBtn" title="D1 dan yangilash">
                  <span>🔄 Qayta sinxronlash</span>
                </button>
              </div>

              ${this.cfTestStatus ? `
                <div class="status-info-box ${this.cfTestStatus.ok ? '' : 'error'}">
                  ${this.cfTestStatus.ok ? `
                    <b>🟢 Ulanish muvaffaqiyatli!</b><br>
                    • Xizmat: ${this.cfTestStatus.data?.service || 'ANTIVIRUS API'}<br>
                    • SQL Baza: ${this.cfTestStatus.data?.database || 'Cloudflare D1 SQL'}<br>
                    • Jami xotira: 5.00 GB (Mutlaqo Bepul)
                  ` : `
                    <b>🔴 Ulanishda xatolik:</b><br>
                    ${this.cfTestStatus.error}<br>
                    <small>Mahalliy zaxira xotira faol holatda ishlab turibdi.</small>
                  `}
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- TAB 2: YANGILIK QO'SHISH (MANBASI BILAN) -->
          ${this.cfActiveTab === 'add-news' ? `
            <div class="admin-modal-body">
              <div class="form-group">
                <label class="form-label">Yangilik Sarlavhasi</label>
                <input type="text" id="cfNewsTitle" class="form-input" placeholder="Tezkor xabar sarlavhasi..." />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Bo‘lim (Kategoriya)</label>
                  <select id="cfNewsCategory" class="form-select">
                    ${categories.map(c => `
                      <option value="${c.id}">${c.name}</option>
                    `).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Muallif</label>
                  <input type="text" id="cfNewsAuthor" class="form-input" value="ANTIVIRUS Tahririyati" />
                </div>
              </div>

              <!-- QAYSI SAYTDAN OLINGANI (MANBA VA HAVOLA) -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Qaysi saytdan olingan (Manba)</label>
                  <input type="text" id="cfNewsSource" class="form-input" placeholder="Masalan: Kun.uz, Daryo.uz, Reuters..." />
                </div>

                <div class="form-group">
                  <label class="form-label">Asl maqola havolasi (Manba URL)</label>
                  <input type="url" id="cfNewsSourceUrl" class="form-input" placeholder="https://..." />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Rasm URL Manzili</label>
                <input type="url" id="cfNewsImageUrl" class="form-input" placeholder="https://images.unsplash.com/..." />
              </div>

              <div class="form-group">
                <label class="form-label">Qisqacha Tavsif (Lead)</label>
                <textarea id="cfNewsSummary" class="form-textarea" placeholder="Yangilikning qisqa mazmuni..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">To‘liq Maqola Matni</label>
                <textarea id="cfNewsContent" class="form-textarea" style="min-height: 110px;" placeholder="Batafsil xabar matni..."></textarea>
              </div>

              <div class="form-row">
                <label class="form-checkbox-label">
                  <input type="checkbox" id="cfNewsIsHero" />
                  <span>Katta Hero Kartasi (Slayder)</span>
                </label>

                <label class="form-checkbox-label">
                  <input type="checkbox" id="cfNewsIsTrending" checked />
                  <span>Trenddagi xabar</span>
                </label>
              </div>

              <button class="btn-primary-red" id="cfSubmitNewsBtn">
                <span>🚀 Bazaga Saqlash (Dual-Storage)</span>
              </button>
            </div>
          ` : ''}

          <!-- TAB 3: BAZADAGI MAQOLALAR VA MANBALAR RO'YXATI -->
          ${this.cfActiveTab === 'list' ? `
            <div class="admin-modal-body">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span class="form-label">Bazadagi barcha maqolalar (${newsList.length})</span>
                <span style="font-size: 11px; color: var(--text-dim);">Manbasi va ko‘rishlar</span>
              </div>

              <div class="admin-news-table-wrap">
                ${newsList.map(n => `
                  <div class="admin-news-row">
                    <div class="admin-news-row-info">
                      <div class="admin-news-row-title">${n.title}</div>
                      <div class="admin-news-row-meta">
                        <span class="source-badge">${n.source || 'ANTIVIRUS'}</span>
                        <span>${Icons.clock} ${n.time} • ${n.views || 0} ko‘rildi</span>
                      </div>
                    </div>
                    <button class="btn-del-sm" data-del-news-id="${n.id}">O‘chirish</button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // HODISALARNI BIRIKTIRISH
  // -------------------------------------------------------------
  bindEvents() {
    // 1. Rejim almashtirish (Theme toggle)
    document.getElementById('themeSwitchBtn')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // 2. Qidiruv lupasi (Maxfiy: "admin" deb yozilsa, admin boshqaruv oynasi ochiladi)
    const handleSearch = () => {
      const q = prompt('Qidirmoqchi bo‘lgan yangilikni kiriting:');
      if (q !== null) {
        const trimmed = q.trim();
        if (trimmed.toLowerCase() === 'admin' || trimmed.toLowerCase() === '/admin' || trimmed.toLowerCase() === 'baza') {
          this.openCfModal('stats');
          return;
        }
        this.searchQuery = trimmed;
        this.setTab('home');
      }
    };
    document.getElementById('searchTriggerBtn')?.addEventListener('click', handleSearch);
    document.getElementById('menuSearchBtn')?.addEventListener('click', handleSearch);

    // 3. Bildirishnomalar
    document.getElementById('notifBellBtn')?.addEventListener('click', () => {
      const notifs = store.getNotifications();
      const msg = notifs.map(n => `• ${n.title}: ${n.text}`).join('\n\n');
      alert(`🔔 ANTIVIRUS NEWS:\n\n${msg || 'Yangi bildirishnomalar yo‘q'}`);
    });

    // 5. Cloudflare Modalini Yopish
    document.getElementById('closeCfModalBtn')?.addEventListener('click', () => {
      this.closeCfModal();
    });
    document.getElementById('cfBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'cfBackdrop') this.closeCfModal();
    });

    // 6. Cloudflare Modal Tablari
    document.querySelectorAll('[data-cf-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-cf-tab');
        if (tab) {
          this.cfActiveTab = tab;
          this.render();
        }
      });
    });

    // 7. Cloudflare Ulanishni Tekshirish va Saqlash
    document.getElementById('cfSaveAndTestBtn')?.addEventListener('click', async () => {
      const input = document.getElementById('cfWorkerUrlInput');
      const url = input ? input.value.trim() : '';

      this.showToast('🔍 Cloudflare bilan ulanish tekshirilmoqda...');
      const result = await store.testConnection(url);
      this.cfTestStatus = result;

      if (result.ok) {
        store.setApiUrl(url);
        this.showToast('🟢 Cloudflare D1 muvaffaqiyatli ulandi!');
      } else {
        this.showToast('🔴 Ulanishda xatolik yuz berdi');
      }
      this.render();
    });

    // 8. D1 dan Sinxronlash
    document.getElementById('cfSyncNowBtn')?.addEventListener('click', async () => {
      this.showToast('🔄 Cloudflare D1 bazasidan yuklanmoqda...');
      await store.syncFromCloudflare();
      this.showToast('✅ Yangiliklar bazasi yangilandi');
      this.render();
    });

    // 9. Yangilik Qo'shish (D1 ga yozish va Manbasi bilan saqlash)
    document.getElementById('cfSubmitNewsBtn')?.addEventListener('click', async () => {
      const title = document.getElementById('cfNewsTitle')?.value.trim();
      const category = document.getElementById('cfNewsCategory')?.value || 'jamiyat';
      const author = document.getElementById('cfNewsAuthor')?.value.trim() || 'ANTIVIRUS Tahririyati';
      const source = document.getElementById('cfNewsSource')?.value.trim() || 'ANTIVIRUS Tahririyati';
      const sourceUrl = document.getElementById('cfNewsSourceUrl')?.value.trim() || '';
      let imageUrl = document.getElementById('cfNewsImageUrl')?.value.trim();
      const summary = document.getElementById('cfNewsSummary')?.value.trim();
      const content = document.getElementById('cfNewsContent')?.value.trim();
      const isHero = Boolean(document.getElementById('cfNewsIsHero')?.checked);
      const isTrending = Boolean(document.getElementById('cfNewsIsTrending')?.checked);

      if (!title) {
        alert('Iltimos, yangilik sarlavhasini kiriting!');
        return;
      }

      this.showToast('⏳ Yangilik bazaga saqlanmoqda...');

      if (!imageUrl) {
        imageUrl = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80';
      }

      const created = await store.createNews({
        title,
        category,
        author,
        source,
        sourceUrl,
        imageUrl,
        summary: summary || title,
        content: content || summary || title,
        isHero,
        isTrending
      });

      this.showToast('🎉 Yangilik muvaffaqiyatli e\'lon qilindi!');
      this.closeCfModal();
      this.openArticle(created.id);
    });

    // 9b. Maqolani o'chirish
    document.querySelectorAll('[data-del-news-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-del-news-id');
        if (id && confirm('Ushbu yangilikni bazadan o‘chirmoqchimisiz?')) {
          await store.deleteNews(id);
          this.showToast('🗑️ Maqola bazadan o‘chirildi');
          this.render();
        }
      });
    });

    // 10. Kategoriya tanlash
    document.querySelectorAll('[data-cat-select]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = e.currentTarget.getAttribute('data-cat-select');
        if (cat) this.setCategory(cat);
      });
    });

    // 11. Tab almashtirish
    document.querySelectorAll('[data-tab-link]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab-link');
        if (tab) this.setTab(tab);
      });
    });

    // 12. Markaziy AN tugmasi (3 marta tez-tez bosilsa - maxfiy admin panel ochiladi)
    this.anClickCount = this.anClickCount || 0;
    document.getElementById('centerAnCircleBtn')?.addEventListener('click', () => {
      this.anClickCount++;
      clearTimeout(this.anClickTimer);
      this.anClickTimer = setTimeout(() => { this.anClickCount = 0; }, 700);

      if (this.anClickCount >= 3) {
        this.anClickCount = 0;
        this.openCfModal('connect');
        return;
      }

      this.showToast('🛡️ ANTIVIRUS NEWS — Bosh sahifa yangilandi');
      this.selectedCategory = 'all';
      this.searchQuery = '';
      this.setTab('home');
    });

    // 13. Maqolani ochish
    document.querySelectorAll('[data-open-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = el.getAttribute('data-open-id');
        if (id) this.openArticle(id);
      });
    });

    // 14. Maqolani yopish
    document.getElementById('closeReaderBtn')?.addEventListener('click', () => {
      this.closeArticle();
    });
    document.getElementById('articleBackBtn')?.addEventListener('click', () => {
      this.closeArticle();
    });
    document.getElementById('articleBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'articleBackdrop') this.closeArticle();
    });

    // 15. Audio eshitish
    document.getElementById('articleAudioBtn')?.addEventListener('click', () => {
      const art = store.getNewsById(this.activeArticleId);
      if (art) this.toggleAudio(`${art.title}. ${art.summary}. ${art.content}`);
    });

    // 16. Saqlash
    document.getElementById('articleBookmarkBtn')?.addEventListener('click', () => {
      if (this.activeArticleId) {
        const saved = store.toggleSaveNews(this.activeArticleId);
        this.showToast(saved ? '⭐ Maqola saqlandi' : 'Maqola saqlanganlardan olindi');
        this.render();
      }
    });

    // 17. Ulashish
    document.getElementById('articleShareBtn')?.addEventListener('click', () => {
      const art = store.getNewsById(this.activeArticleId);
      if (art) this.shareArticle(art);
    });
  }
}

// Ishga tushirish (xavfsiz va darhol)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.antivirusApp = new AntivirusApp();
  });
} else {
  window.antivirusApp = new AntivirusApp();
}
