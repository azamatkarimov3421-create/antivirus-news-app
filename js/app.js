// ANTIVIRUS NEWS — Professional Responsive Platform & Mobile App
import { store } from './store.js';
import { Icons, getCategoryIcon } from './icons.js';
import { INITIAL_CURRENCIES } from './data.js';

class AntivirusPlatform {
  constructor() {
    this.currentMobileTab = 'home'; // 'home' | 'trend' | 'video' | 'menu'
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.activeArticleId = null;
    this.isSpeechPlaying = false;
    this.speechSynth = window.speechSynthesis;
    this.isQuickAddOpen = false;

    this.init();
  }

  init() {
    // Theme
    const savedTheme = store.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Subscribe to store updates
    store.subscribe(() => this.render());

    // Window events
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeArticle();
    });

    this.render();
  }

  toggleTheme() {
    const nextTheme = store.toggleTheme();
    this.showToast(nextTheme === 'dark' ? '🌙 Dark Mode yoqildi' : '☀️ Light Mode yoqildi');
  }

  setCategory(catId) {
    this.selectedCategory = catId;
    if (this.currentMobileTab === 'menu') {
      this.currentMobileTab = 'home';
    }
    this.render();
  }

  setMobileTab(tab) {
    this.currentMobileTab = tab;
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
    this.isSpeechPlaying = false;
    this.render();
  }

  toggleAudio(text) {
    if (!this.speechSynth) {
      this.showToast('Brauzeringiz ovozli o‘qishni qo‘llab-quvvatlamaydi');
      return;
    }

    if (this.isSpeechPlaying) {
      this.speechSynth.cancel();
      this.isSpeechPlaying = false;
      this.showToast('Ovozli o‘qish to‘xtatildi');
      this.render();
    } else {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'uz-UZ';
      utter.rate = 1.0;
      utter.onend = () => {
        this.isSpeechPlaying = false;
        this.render();
      };
      this.speechSynth.speak(utter);
      this.isSpeechPlaying = true;
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
      this.showToast('Havola buferga nusxalandi!');
    }
  }

  showToast(message) {
    const existing = document.querySelector('.toast-notice-box');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notice-box';
    toast.innerHTML = `<span style="color: var(--an-red);">${Icons.shield}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }

  // -------------------------------------------------------------
  // ASOSIY RENDER LOGIKASI
  // -------------------------------------------------------------
  render() {
    const root = document.getElementById('app');
    if (!root) return;

    const theme = store.getTheme();
    const newsList = store.getNews();
    const categories = store.getCategories();

    root.innerHTML = `
      <div class="antivirus-root-layout" data-theme="${theme}">
        <!-- 1. DESKTOP TOP META BAR (Valyutalar, soat, ob-havo) -->
        ${this.renderDesktopTopBar()}

        <!-- 2. DESKTOP MAIN HEADER -->
        ${this.renderDesktopHeader()}

        <!-- 3. MOBIL APP HEADER (Faqat telefonda ko'rinadi) -->
        ${this.renderMobileHeader(theme)}

        <!-- 4. MOBIL GORIZONTAL TOIFALAR (Faqat telefonda ko'rinadi) -->
        ${this.currentMobileTab !== 'menu' ? this.renderMobileTabsBar(categories) : ''}

        <!-- 5. ASOSIY KONTENT HUDUDI (Responsive) -->
        <div class="main-layout-container">
          ${this.renderMainContent(newsList, categories)}
        </div>

        <!-- 6. DESKTOP FOOTER (Faqat kompyuterda ko'rinadi) -->
        ${this.renderDesktopFooter(categories)}

        <!-- 7. MOBIL PASTKI BAR (Bottom Navigation — faqat telefonda) -->
        ${this.renderMobileBottomBar()}

        <!-- 8. ALOHIDA MAQOLA MODALI / SAHIFASI -->
        ${this.renderArticleModal()}

        <!-- 9. TEZKOR YANGILIK QO'SHISH MODALI (ADMIN) -->
        ${this.renderQuickAddModal(categories)}
      </div>
    `;

    this.bindEvents();
  }

  // 1. Desktop Top Meta Bar
  renderDesktopTopBar() {
    const now = new Date();
    const dateStr = `${now.getDate()}-oktyabr, ${now.getFullYear()}-yil`;

    return `
      <div class="top-meta-bar">
        <div class="top-meta-inner">
          <div class="meta-currencies">
            <span style="color: #64748B;">Markaziy Bank:</span>
            ${INITIAL_CURRENCIES.map(c => `
              <span class="meta-cur-item">
                <b>${c.code}</b> ${c.rate} 
                <small class="${c.isUp ? 'cur-up' : 'cur-down'}">${c.diff}</small>
              </span>
            `).join('')}
          </div>

          <div class="meta-right-tools">
            <span class="weather-badge">📍 Toshkent: ☀️ +24°C</span>
            <span>📅 ${dateStr}</span>
            <span style="color: var(--an-red); font-weight: 700;">LIVE • 24/7</span>
          </div>
        </div>
      </div>
    `;
  }

  // 2. Desktop Main Header & Nav
  renderDesktopHeader() {
    const theme = store.getTheme();
    const categories = store.getCategories();
    const newsList = store.getNews();

    return `
      <header class="desktop-main-header">
        <div class="header-container">
          <!-- AN Brend Logotipi -->
          <div class="brand-logo-wrap" data-nav-tab="home">
            <div class="brand-symbol-an">AN</div>
            <div class="brand-text-col">
              <span class="brand-title-an">ANTIVIRUS</span>
              <span class="brand-slogan-an">NEWS • GLOBAL MEDIA</span>
            </div>
          </div>

          <!-- Qidiruv Qatori -->
          <div class="header-search-bar">
            <span class="search-field-icon">${Icons.search}</span>
            <input type="text" class="search-input-field" id="desktopSearchInput" placeholder="Yangiliklarni qidirish..." value="${this.searchQuery}" />
          </div>

          <!-- O'ng Amallar -->
          <div class="header-actions-group">
            <button class="btn-header-round" id="desktopThemeBtn" title="Rejimni almashtirish">
              ${theme === 'dark' ? Icons.sun : Icons.moon}
            </button>
            <button class="btn-header-round" id="desktopBellBtn" title="Bildirishnomalar">
              ${Icons.bell}
              <span class="notif-badge-ping"></span>
            </button>
            <button class="btn-quick-create" id="desktopAddNewsBtn">
              ${Icons.plus} Yangilik Qo‘shish
            </button>
          </div>
        </div>

        <!-- Desktop Gorizontal Navigatsiya Menyusi -->
        <nav class="desktop-nav-wrap">
          <div class="desktop-nav-inner">
            ${categories.map(c => `
              <button class="nav-item-btn ${this.selectedCategory === c.id ? 'active' : ''}" data-cat-id="${c.id}">
                ${c.name}
              </button>
            `).join('')}
          </div>
        </nav>

        <!-- Breaking News Ticker -->
        <div class="breaking-ticker-row">
          <div class="ticker-title-badge">
            ${Icons.trendingUp} TEZKOR XABARLAR
          </div>
          <div class="ticker-marquee-box">
            ${newsList.slice(0, 5).map(n => `
              <div class="ticker-link-entry" data-article-click="${n.id}">
                <span style="color: var(--an-red); font-weight: 800;">${n.time}</span>
                <span>${n.title}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </header>
    `;
  }

  // 3. Mobil Header (Telefonda ko'rinadi)
  renderMobileHeader(theme) {
    return `
      <header class="mobile-app-header">
        <div class="brand-badge-group" data-nav-tab="home">
          <span class="mobile-brand-an">AN</span>
          <div class="mobile-brand-names">
            <span class="mobile-name-main">ANTIVIRUS</span>
            <span class="mobile-name-sub">NEWS</span>
          </div>
        </div>

        <div class="mobile-header-tools">
          <button class="btn-header-round" id="mobileThemeBtn" title="Rejim">
            ${theme === 'dark' ? Icons.sun : Icons.moon}
          </button>
          <button class="btn-header-round" id="mobileSearchBtn" title="Qidiruv">
            ${Icons.search}
          </button>
          <button class="btn-header-round" id="mobileBellBtn" title="Bildirishnomalar">
            ${Icons.bell}
            <span class="notif-badge-ping"></span>
          </button>
          <button class="btn-header-round" id="mobileAddBtn" title="Qo‘shish" style="color: var(--an-red);">
            ${Icons.plus}
          </button>
        </div>
      </header>
    `;
  }

  // 4. Mobil Gorizontal Toifalar (Scrollable Tabs)
  renderMobileTabsBar(categories) {
    return `
      <nav class="mobile-category-tabs-bar">
        ${categories.slice(0, 7).map(c => `
          <div class="mobile-tab-pill ${this.selectedCategory === c.id ? 'active' : ''}" data-cat-id="${c.id}">
            ${c.name}
          </div>
        `).join('')}
      </nav>
    `;
  }

  // 5. Asosiy Kontent (Bosh sahifa, Menu, Trend yoki Video)
  renderMainContent(newsList, categories) {
    // Agar "Barchasi" Menyusi tanlangan bo'lsa (Aynan skrinshotdagi 2-ekran!)
    if (this.currentMobileTab === 'menu') {
      return this.renderMenuScreen(categories);
    }

    // Filtrlangan yangiliklar
    let filteredList = newsList;
    if (this.selectedCategory !== 'all') {
      filteredList = filteredList.filter(n => n.category === this.selectedCategory);
    }
    if (this.searchQuery) {
      filteredList = filteredList.filter(n =>
        n.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        n.summary.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }

    const heroItem = filteredList.find(n => n.isHero) || filteredList[0];
    const sideItems = newsList.filter(n => n.id !== heroItem?.id).slice(0, 4);

    return `
      <!-- Mobil 6 ta Tezkor Toifa Kvadratlari (Skrinshotdagi kabi) -->
      <div class="mobile-quick-cat-grid">
        <div class="mobile-quick-cat-btn ${this.selectedCategory === 'siyosat' ? 'active-pill' : ''}" data-cat-id="siyosat">
          <div class="mobile-quick-cat-icon" style="color: #E50914;">${Icons.landmark}</div>
          <span class="mobile-quick-cat-label">Siyosat</span>
        </div>
        <div class="mobile-quick-cat-btn ${this.selectedCategory === 'dunyo' ? 'active-pill' : ''}" data-cat-id="dunyo">
          <div class="mobile-quick-cat-icon" style="color: #2563EB;">${Icons.globe}</div>
          <span class="mobile-quick-cat-label">Dunyo</span>
        </div>
        <div class="mobile-quick-cat-btn ${this.selectedCategory === 'jamiyat' ? 'active-pill' : ''}" data-cat-id="jamiyat">
          <div class="mobile-quick-cat-icon" style="color: #DC2626;">${Icons.users}</div>
          <span class="mobile-quick-cat-label">Jamiyat</span>
        </div>
        <div class="mobile-quick-cat-btn ${this.selectedCategory === 'biznes' ? 'active-pill' : ''}" data-cat-id="biznes">
          <div class="mobile-quick-cat-icon" style="color: #EA580C;">${Icons.barChart}</div>
          <span class="mobile-quick-cat-label">Biznes</span>
        </div>
        <div class="mobile-quick-cat-btn ${this.selectedCategory === 'sport' ? 'active-pill' : ''}" data-cat-id="sport">
          <div class="mobile-quick-cat-icon" style="color: #16A34A;">${Icons.trophy}</div>
          <span class="mobile-quick-cat-label">Sport</span>
        </div>
        <div class="mobile-quick-cat-btn" data-nav-tab="menu">
          <div class="mobile-quick-cat-icon" style="color: #94A3B8;">${Icons.grid}</div>
          <span class="mobile-quick-cat-label">Barchasi</span>
        </div>
      </div>

      <!-- KATTA HERO SLIDER BO'LIMI (Desktopda 2 ustun, Telefonda 1 ustun) -->
      ${heroItem ? `
        <section class="desktop-hero-grid">
          <!-- Katta Slayder Kartasi (Mirziyoyev & Berdimuhamedov) -->
          <div class="hero-feature-card" data-article-click="${heroItem.id}">
            <img class="hero-feature-img" src="${heroItem.imageUrl}" alt="${heroItem.title}" />
            <div class="hero-feature-gradient"></div>
            <div class="hero-feature-content">
              <span class="category-tag-pill">${heroItem.categoryName}</span>
              <h2 class="hero-feature-title">${heroItem.title}</h2>
              <p class="hero-feature-summary">${heroItem.summary}</p>
              <div class="hero-meta-row">
                <span class="hero-meta-item">${Icons.clock} ${heroItem.time}</span>
                <span class="hero-meta-item">${Icons.calendar} ${heroItem.date}</span>
                <span class="hero-meta-item">${Icons.eye} ${heroItem.views.toLocaleString()}</span>
                <div class="hero-dots-wrap">
                  <span class="dot-pill-wide"></span>
                  <span class="dot-circle-small"></span>
                  <span class="dot-circle-small"></span>
                  <span class="dot-circle-small"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Yon Ustun: So'nggi yangiliklar (Desktopda ko'rinadi) -->
          <div class="hero-side-column">
            <div class="side-col-head">
              <span class="side-col-title"><span class="side-red-dot"></span> So‘nggi yangiliklar</span>
              <a href="#" class="view-all-link" style="color: var(--an-red); font-size: 12px; font-weight: 700;" data-cat-id="all">Barchasi →</a>
            </div>
            <div class="side-news-stack">
              ${sideItems.map(n => `
                <div class="side-news-card" data-article-click="${n.id}">
                  <img class="side-news-thumb" src="${n.imageUrl}" alt="${n.title}" />
                  <div class="side-news-body">
                    <h4 class="side-news-title">${n.title}</h4>
                    <div class="side-news-meta">
                      <span>${Icons.clock} ${n.time}</span>
                      <span>${Icons.eye} ${n.views.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>
      ` : ''}

      <!-- ASOSIY YANGILIKLAR RO'YXATI (Desktopda 4 ustun, Telefonda 1 ustunli ro'yxat) -->
      <div class="section-header-row">
        <h3 class="section-title-big">
          ${this.searchQuery ? `Qidiruv natijalari: "${this.searchQuery}"` : (this.selectedCategory === 'all' ? 'So‘nggi yangiliklar' : store.getCategoryName(this.selectedCategory))}
        </h3>
        <span style="font-size: 13px; color: var(--an-red); font-weight: 700; cursor: pointer;" data-nav-tab="menu">Barchasi →</span>
      </div>

      <div class="news-grid-columns">
        ${filteredList.map(n => `
          <article class="card-item-standard" data-article-click="${n.id}">
            <div class="card-media-wrap">
              <img class="card-media-img" src="${n.imageUrl}" alt="${n.title}" loading="lazy" />
              <span class="card-category-floating">${n.categoryName}</span>
            </div>
            <div class="card-content-body">
              <h4 class="card-heading-title">${n.title}</h4>
              <p class="card-lead-text">${n.summary}</p>
              <div class="card-meta-bottom">
                <span>${Icons.clock} ${n.time} • ${n.date}</span>
                <span>${Icons.eye} ${n.views.toLocaleString()}</span>
              </div>
            </div>
          </article>
        `).join('')}
      </div>

      <!-- VIDEO YANGILIKLAR BLOKI (Media Lounge) -->
      <section class="video-media-lounge">
        <div class="video-heading-bar">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="video-badge-pill">${Icons.playCircle} VIDEO YANGILIKLAR</span>
            <span style="font-size: 13px; color: #94A3B8;">Eksklyuziv reportajlar va intervyular</span>
          </div>
          <button style="color: var(--an-red); font-size: 12px; font-weight: 700;" data-cat-id="video">
            Barcha videolar →
          </button>
        </div>

        <div class="video-cards-grid">
          ${newsList.filter(n => n.category === 'video' || n.videoUrl).concat(newsList.slice(0, 3)).slice(0, 3).map((v, i) => `
            <div class="video-box-item" data-article-click="${v.id}">
              <img src="${v.imageUrl}" alt="${v.title}" />
              <div class="video-play-center">${Icons.playCircle}</div>
              <div class="video-box-caption">
                <span style="background: var(--an-red); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800;">VIDEO</span>
                <h4 style="font-size: 13px; font-weight: 700; margin-top: 4px; color: #FFF;">${v.title}</h4>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  // «BARCHASI» MENYUSI EKRANI (Aynan skrinshotdagi 2-ekran!)
  renderMenuScreen(categories) {
    return `
      <div class="menu-screen-viewport">
        <div class="menu-head-title">
          <span>Barchasi</span>
          <button class="btn-header-round" id="menuInnerSearchBtn">${Icons.search}</button>
        </div>

        <!-- 11 ta Toifalar Ro'yxati -->
        <div class="menu-items-vertical">
          ${categories.map(c => `
            <div class="menu-item-tile" data-cat-id="${c.id}">
              <div class="menu-item-left">
                <div style="width: 26px; display: flex; align-items: center; justify-content: center; color: ${c.color};">
                  ${getCategoryIcon(c.icon)}
                </div>
                <span class="menu-item-label">${c.name}</span>
              </div>
              <span style="color: var(--text-muted);">${Icons.chevronRight}</span>
            </div>
          `).join('')}
        </div>

        <!-- Rasmdagi Brend Axborot Kartasi -->
        <div class="brand-menu-banner-card" data-nav-tab="home">
          <div class="brand-round-an-emblem">AN</div>
          <div class="brand-banner-texts">
            <h4 class="brand-banner-title">ANTIVIRUS NEWS</h4>
            <p class="brand-banner-slogan">Global siyosat — oddiy tilda.<br>Qisqa va aniq yangiliklar.</p>
          </div>
          <span style="color: var(--text-muted);">${Icons.chevronRight}</span>
        </div>

        <!-- 4 ta Doiraviy Ijtimoiy Tarmoq Tugmalari -->
        <div class="social-buttons-grid-4">
          <div class="social-circle-box" onclick="window.open('https://t.me', '_blank')">
            <div class="social-circle-icon sn-tg">${Icons.telegram}</div>
            <span class="social-circle-title">Telegram</span>
          </div>

          <div class="social-circle-box" onclick="window.open('https://youtube.com', '_blank')">
            <div class="social-circle-icon sn-yt">${Icons.youtube}</div>
            <span class="social-circle-title">YouTube</span>
          </div>

          <div class="social-circle-box" onclick="window.open('https://tiktok.com', '_blank')">
            <div class="social-circle-icon sn-tt">${Icons.tiktok}</div>
            <span class="social-circle-title">TikTok</span>
          </div>

          <div class="social-circle-box" onclick="window.open('https://instagram.com', '_blank')">
            <div class="social-circle-icon sn-ig">${Icons.instagram}</div>
            <span class="social-circle-title">Instagram</span>
          </div>
        </div>
      </div>
    `;
  }

  // 6. Desktop Footer
  renderDesktopFooter(categories) {
    return `
      <footer class="desktop-footer-area">
        <div class="footer-content-inner">
          <div>
            <div class="brand-logo-wrap">
              <div class="brand-symbol-an">AN</div>
              <div class="brand-text-col">
                <span class="brand-title-an">ANTIVIRUS</span>
                <span class="brand-slogan-an">NEWS MEDIA</span>
              </div>
            </div>
            <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 14px 0 16px 0;">
              Global siyosat — oddiy tilda. Qisqa va aniq yangiliklar. Xalqaro va mahalliy hodisalarning eng ishonchli mustaqil manbasi.
            </p>
            <div class="footer-social-row">
              <a href="https://t.me" target="_blank" class="footer-social-pill sn-tg">${Icons.telegram}</a>
              <a href="https://youtube.com" target="_blank" class="footer-social-pill sn-yt">${Icons.youtube}</a>
              <a href="https://tiktok.com" target="_blank" class="footer-social-pill sn-tt">${Icons.tiktok}</a>
              <a href="https://instagram.com" target="_blank" class="footer-social-pill sn-ig">${Icons.instagram}</a>
            </div>
          </div>

          <div>
            <h4 class="footer-col-head">Bo‘limlar</h4>
            <ul class="footer-links-list">
              <li><a href="#" data-cat-id="siyosat">Siyosat</a></li>
              <li><a href="#" data-cat-id="dunyo">Dunyo</a></li>
              <li><a href="#" data-cat-id="jamiyat">Jamiyat</a></li>
              <li><a href="#" data-cat-id="biznes">Biznes</a></li>
              <li><a href="#" data-cat-id="sport">Sport</a></li>
            </ul>
          </div>

          <div>
            <h4 class="footer-col-head">Media & Loyihalar</h4>
            <ul class="footer-links-list">
              <li><a href="#" data-cat-id="video">Video yangiliklar</a></li>
              <li><a href="#" data-cat-id="tahlil">Tahliliy maqolalar</a></li>
              <li><a href="#" data-cat-id="foto">Foto galereya</a></li>
              <li><a href="#" data-cat-id="trend">Trend xabarlar</a></li>
            </ul>
          </div>

          <div>
            <h4 class="footer-col-head">Tahririyat</h4>
            <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.6;">
              O‘zbekiston Respublikasi Matbuot va axborot agentligida ro‘yxatdan o‘tgan guvohnoma № 1428.<br>
              Sayt materiallaridan to‘liq yoki qisman foydalanilganda «ANTIVIRUS NEWS» veb-saytiga giperhavola ko‘rsatilishi shart.
            </p>
          </div>
        </div>

        <div class="footer-copyright-bar">
          <span>© 2026 «ANTIVIRUS NEWS». Barcha huquqlar himoyalangan.</span>
          <span>Versiya 3.0.0 • Maxfiylik kelishuvi</span>
        </div>
      </footer>
    `;
  }

  // 7. Mobil Pastki Bar (Bottom Navigation)
  renderMobileBottomBar() {
    return `
      <div class="mobile-bottom-navigation">
        <div class="mobile-nav-btn ${this.currentMobileTab === 'home' ? 'active' : ''}" data-nav-tab="home">
          <span>${Icons.home}</span>
          <span class="mobile-nav-label">Asosiy</span>
        </div>

        <div class="mobile-nav-btn ${this.currentMobileTab === 'trend' ? 'active' : ''}" data-nav-tab="trend">
          <span>${Icons.trendingUp}</span>
          <span class="mobile-nav-label">Trend</span>
        </div>

        <!-- MARKAZIY 3D QIZIL "AN" FLOATING TUGMASI -->
        <div class="mobile-center-an-wrap" id="centerAnQuickBtn" title="ANTIVIRUS Tezkor">
          <div class="mobile-center-an-circle">AN</div>
        </div>

        <div class="mobile-nav-btn ${this.currentMobileTab === 'video' ? 'active' : ''}" data-nav-tab="video">
          <span>${Icons.playCircle}</span>
          <span class="mobile-nav-label">Video</span>
        </div>

        <div class="mobile-nav-btn ${this.currentMobileTab === 'menu' ? 'active' : ''}" data-nav-tab="menu">
          <span>${Icons.menu}</span>
          <span class="mobile-nav-label">Barchasi</span>
        </div>
      </div>
    `;
  }

  // 8. Alohida Maqola Modali / Sahifasi
  renderArticleModal() {
    if (!this.activeArticleId) return '';

    const article = store.getNewsById(this.activeArticleId);
    if (!article) return '';

    const isSaved = store.getSavedIds().includes(article.id);

    return `
      <div class="article-modal-scrim open" id="articleModalOverlay">
        <div class="article-modal-card">
          <button class="btn-modal-close" id="closeArticleBtn">${Icons.close}</button>

          <div class="article-hero-wrap">
            <img class="article-hero-img" src="${article.imageUrl}" alt="${article.title}" />
          </div>

          <div class="article-sheet-inner">
            <div class="article-meta-badge-row">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="category-tag-pill">${article.categoryName}</span>
                <span style="font-size: 12px; color: var(--text-muted);">${Icons.clock} ${article.time} • ${article.date}</span>
              </div>
              <span style="font-size: 12px; color: var(--text-muted);">${Icons.eye} ${article.views.toLocaleString()} ko‘rildi</span>
            </div>

            <h1 class="article-main-heading">${article.title}</h1>

            <!-- Audio Player (Ovozli eshitish) -->
            <div class="article-audio-control-bar">
              <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700;">
                <span>🔊</span> <span>Ovozli eshitish</span>
              </div>
              <button class="btn-audio-listen" id="audioToggleBtn">
                ${this.isSpeechPlaying ? 'To‘xtatish' : 'Tinglash (Play)'}
              </button>
            </div>

            ${article.summary ? `
              <div class="article-lead-paragraph">${article.summary}</div>
            ` : ''}

            ${article.videoUrl ? `
              <div style="margin: 20px 0; border-radius: 12px; overflow: hidden; aspect-ratio: 16/9; background: #000;">
                <iframe width="100%" height="100%" src="${article.videoUrl}" frameborder="0" allowfullscreen></iframe>
              </div>
            ` : ''}

            <div class="article-content-body">${article.content || article.summary}</div>

            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 18px 0;">
              ${(article.tags || []).map(t => `<span style="background: var(--pill-bg); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">#${t}</span>`).join('')}
            </div>

            <div class="article-action-buttons">
              <div style="display: flex; gap: 10px;">
                <button class="btn-action-tool ${isSaved ? 'saved' : ''}" id="saveBtn">
                  ${Icons.bookmark} <span>${isSaved ? 'Saqlangan' : 'Saqlash'}</span>
                </button>
                <button class="btn-action-tool" id="shareBtn">
                  ${Icons.share} <span>Ulashish</span>
                </button>
              </div>

              <div style="display: flex; gap: 6px;">
                <button class="btn-action-tool" onclick="document.querySelector('.article-content-body').style.fontSize = '18px'">A+</button>
                <button class="btn-action-tool" onclick="document.querySelector('.article-content-body').style.fontSize = '14px'">A-</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 9. Yangilik Qo'shish Modali (Admin)
  renderQuickAddModal(categories) {
    if (!this.isQuickAddOpen) return '';

    return `
      <div class="article-modal-scrim open" id="quickAddOverlay">
        <div class="article-modal-card" style="max-width: 580px; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
            <h3 style="font-size: 18px; font-weight: 800;">Yangi Yangilik Joylash</h3>
            <button class="btn-modal-close" id="closeQuickAddBtn" style="position: static;">${Icons.close}</button>
          </div>

          <form id="quickAddForm">
            <div class="form-field-item">
              <label class="form-field-label">Sarlavha *</label>
              <input type="text" name="title" class="form-control-input" required placeholder="Yangilik sarlavhasi..." />
            </div>

            <div class="form-field-item">
              <label class="form-field-label">Kategoriya *</label>
              <select name="category" class="form-control-select">
                ${categories.filter(c => c.id !== 'all').map(c => `
                  <option value="${c.id}">${c.name}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-field-item">
              <label class="form-field-label">Rasm URL</label>
              <input type="url" name="imageUrl" class="form-control-input" value="https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1000&q=80" />
            </div>

            <div class="form-field-item">
              <label class="form-field-label">Qisqa Anons</label>
              <textarea name="summary" class="form-control-textarea" rows="2" placeholder="Qisqacha mazmuni..."></textarea>
            </div>

            <div class="form-field-item">
              <label class="form-field-label">To‘liq Matn *</label>
              <textarea name="content" class="form-control-textarea" rows="4" required placeholder="Batafsil matn..."></textarea>
            </div>

            <button type="submit" class="btn-quick-create" style="width: 100%; justify-content: center; padding: 12px; margin-top: 10px;">
              Nashr qilish
            </button>
          </form>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // HODISALARNI BIRIKTIRISH (EVENT LISTENERS)
  // -------------------------------------------------------------
  bindEvents() {
    // 1. Dark/Light Theme toggle
    document.querySelectorAll('#desktopThemeBtn, #mobileThemeBtn').forEach(btn => {
      btn.addEventListener('click', () => this.toggleTheme());
    });

    // 2. Kategoriya tanlash
    document.querySelectorAll('[data-cat-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = e.currentTarget.getAttribute('data-cat-id');
        if (cat) this.setCategory(cat);
      });
    });

    // 3. Tab tanlash (Home, Trend, Video, Menu)
    document.querySelectorAll('[data-nav-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-nav-tab');
        if (tab) this.setMobileTab(tab);
      });
    });

    // 4. Maqolani ochish
    document.querySelectorAll('[data-article-click]').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = card.getAttribute('data-article-click');
        if (id) this.openArticle(id);
      });
    });

    // 5. Maqola modalini yopish
    document.getElementById('closeArticleBtn')?.addEventListener('click', () => {
      this.closeArticle();
    });

    document.getElementById('articleModalOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'articleModalOverlay') this.closeArticle();
    });

    // 6. Audio eshitish
    document.getElementById('audioToggleBtn')?.addEventListener('click', () => {
      const art = store.getNewsById(this.activeArticleId);
      if (art) this.toggleAudio(`${art.title}. ${art.summary}. ${art.content}`);
    });

    // 7. Saqlash
    document.getElementById('saveBtn')?.addEventListener('click', () => {
      if (this.activeArticleId) {
        const saved = store.toggleSaveNews(this.activeArticleId);
        this.showToast(saved ? '⭐ Maqola saqlandi' : 'Maqola saqlanganlardan olindi');
        this.render();
      }
    });

    // 8. Ulashish
    document.getElementById('shareBtn')?.addEventListener('click', () => {
      const art = store.getNewsById(this.activeArticleId);
      if (art) this.shareArticle(art);
    });

    // 9. Desktop Qidiruv
    const searchInput = document.getElementById('desktopSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        clearTimeout(this.searchDebounce);
        this.searchDebounce = setTimeout(() => this.render(), 300);
      });
    }

    // 10. Mobil Qidiruv
    const onSearchTrigger = () => {
      const q = prompt('Qidirish uchun kalit so‘zni kiriting:');
      if (q !== null) {
        this.searchQuery = q.trim();
        this.setMobileTab('home');
      }
    };
    document.getElementById('mobileSearchBtn')?.addEventListener('click', onSearchTrigger);
    document.getElementById('menuInnerSearchBtn')?.addEventListener('click', onSearchTrigger);

    // 11. Markaziy AN tugmasi
    document.getElementById('centerAnQuickBtn')?.addEventListener('click', () => {
      this.showToast('🛡️ ANTIVIRUS NEWS — Yangiliklar tasmasi yangilandi!');
      this.setMobileTab('home');
    });

    // 12. Bildirishnomalar
    document.querySelectorAll('#desktopBellBtn, #mobileBellBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const notifs = store.getNotifications();
        const msg = notifs.map(n => `• ${n.title}: ${n.text}`).join('\n\n');
        alert(`🔔 ANTIVIRUS NEWS BILDIRISHNOMALARI:\n\n${msg || 'Yangi bildirishnoma yo‘q'}`);
      });
    });

    // 13. Tezkor yangilik qo'shish (Admin)
    document.querySelectorAll('#desktopAddNewsBtn, #mobileAddBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.isQuickAddOpen = true;
        this.render();
      });
    });

    document.getElementById('closeQuickAddBtn')?.addEventListener('click', () => {
      this.isQuickAddOpen = false;
      this.render();
    });

    document.getElementById('quickAddOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'quickAddOverlay') {
        this.isQuickAddOpen = false;
        this.render();
      }
    });

    document.getElementById('quickAddForm')?.addEventListener('submit', (e) => {
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
      this.showToast('✅ Yangi maqola muvaffaqiyatli nashr qilindi!');
      this.setMobileTab('home');
    });
  }
}

// Ishga tushirish (xavfsiz va darhol)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.antivirusPlatform = new AntivirusPlatform();
  });
} else {
  window.antivirusPlatform = new AntivirusPlatform();
}
