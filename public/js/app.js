// ANTIVIRUS NEWS — Siyraklashtirilgan, Aniq va Tezkor Ilova Mantig'i
// Cloudflare (D1 SQL Baza + R2 Xotira) va IndexedDB bilan to'liq integratsiya qilingan
import { store } from './store.js';
import { Icons, getCategoryIcon } from './icons.js';
import { mediaDb, captureVideoMetadata, processImageFile, extractDomainName } from './mediaDb.js';

// Video URL (YouTube, Instagram, Telegram, Sayt yoki Mahalliy fayl) ni avtomatik tahlil qiluvchi
export function parseVideoEmbed(url) {
  if (!url) return null;
  const trimmed = url.trim();

  // 1. YouTube Watch / Short / Embed / youtu.be
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  const ytMatch = trimmed.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    const id = ytMatch[1];
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      originalUrl: trimmed,
      source: 'YouTube'
    };
  }

  // 2. Instagram Reels / Post / TV
  const igRegex = /(?:instagram\.com|instagr\.am)\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i;
  const igMatch = trimmed.match(igRegex);
  if (igMatch && igMatch[1]) {
    const code = igMatch[1];
    return {
      type: 'instagram',
      embedUrl: `https://www.instagram.com/reel/${code}/embed/`,
      thumbnailUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=80',
      originalUrl: trimmed,
      source: 'Instagram'
    };
  }

  // 3. Telegram Post / Channel
  const tgRegex = /(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{3,})\/([0-9]+)/i;
  const tgMatch = trimmed.match(tgRegex);
  if (tgMatch && tgMatch[1] && tgMatch[2]) {
    const channel = tgMatch[1];
    const post = tgMatch[2];
    return {
      type: 'telegram',
      embedUrl: `https://t.me/${channel}/${post}?embed=1`,
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      originalUrl: trimmed,
      source: `Telegram (@${channel})`
    };
  }

  // 4. Mahalliy IndexedDB, Blob yoki Data URL
  if (trimmed.startsWith('idb://') || trimmed.startsWith('blob:') || trimmed.startsWith('data:video')) {
    return {
      type: 'local',
      embedUrl: trimmed,
      thumbnailUrl: null,
      originalUrl: trimmed,
      source: 'Mahalliy Video Fayl'
    };
  }

  // 5. To'g'ridan-to'g'ri MP4 / WebM / MOV / OGG video fayl
  if (/\.(mp4|webm|mov|ogg|m3u8)(\?.*)?$/i.test(trimmed)) {
    return {
      type: 'video',
      embedUrl: trimmed,
      thumbnailUrl: null,
      originalUrl: trimmed,
      source: extractDomainName(trimmed)
    };
  }

  // 6. Generic embed yoki veb sahifa
  return {
    type: 'generic',
    embedUrl: trimmed,
    thumbnailUrl: null,
    originalUrl: trimmed,
    source: extractDomainName(trimmed)
  };
}

class AntivirusApp {
  constructor() {
    this.currentTab = 'home'; // 'home' | 'trend' | 'video' | 'menu'
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.activeArticleId = null;
    this.isCfModalOpen = false;
    this.cfActiveTab = 'stats'; // 'stats' | 'add-news' | 'video' | 'list'
    this.cfTestStatus = null;
    this.isUploadingMedia = false;
    this.speechSynth = window.speechSynthesis;
    this.isAudioPlaying = false;

    // Video & Rasm yuklash holatlari
    this.videoUploadMode = 'url'; // 'url' | 'file'
    this.pendingVideoFile = null;
    this.pendingVideoThumbnail = null;
    this.pendingVideoDuration = '03:45';
    this.pendingVideoUrl = '';
    this.pendingVideoSource = 'YouTube';
    this.pendingNewsImageUrl = '';

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

    // Agar ushbu maqolada mahalliy IndexedDB video bo'lsa, URL olib pleyerga o'rnatamiz
    const article = store.getNewsById(id);
    if (article && article.videoUrl && article.videoUrl.startsWith('idb://')) {
      const fileId = article.videoUrl.replace('idb://', '');
      mediaDb.getMediaUrl(fileId).then(blobUrl => {
        const player = document.getElementById('activeArticleVideoPlayer');
        if (player && blobUrl) {
          player.src = blobUrl;
          player.play().catch(() => {});
        }
      });
    }
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
    const allNews = store.getNews();
    let videoList = allNews.filter(n => n.category === 'video' || n.videoUrl);

    if (videoList.length === 0) {
      videoList = allNews.slice(0, 5);
    }

    return `
      <div class="section-headline-bar">
        <h2 class="headline-text" style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--an-red);">${Icons.playCircle}</span> Video yangiliklar & Reportajlar
        </h2>
        <span style="font-size: 11px; color: var(--text-dim);">${videoList.length} ta video</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${videoList.map(v => `
          <div class="hero-card-banner" style="height: 220px; cursor: pointer;" data-open-id="${v.id}">
            <img class="hero-card-img" src="${v.imageUrl}" alt="${v.title}" />
            <div class="hero-card-gradient"></div>
            
            <div style="position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%); width: 54px; height: 54px; border-radius: 50%; background: var(--an-red); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px var(--an-red-glow), 0 4px 14px rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.4); font-size: 20px;">
              ▶
            </div>

            <div class="hero-card-info">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                <span class="hero-tag-badge" style="background: var(--an-red); color: #fff;">🎬 VIDEO</span>
                ${v.source ? `<span class="source-badge" style="background: rgba(0,0,0,0.6); color: #fff; border-color: rgba(255,255,255,0.2); font-size: 10px;">${v.source}</span>` : ''}
                <span style="font-size: 11px; color: #fff; margin-left: auto; background: rgba(0,0,0,0.6); padding: 2px 7px; border-radius: 4px;">${v.readTime || 'Video'}</span>
              </div>
              <h3 class="hero-card-title">${v.title}</h3>
              <div class="hero-card-meta">
                <span>${Icons.clock} ${v.time} • ${v.date}</span>
                <span>${Icons.eye} ${(v.views || 0).toLocaleString()} ko‘rildi</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Maqola/Video media renderi (YouTube, Instagram, Telegram, Mahalliy fayl)
  renderArticleMedia(article) {
    if (article.videoUrl) {
      const parsed = parseVideoEmbed(article.videoUrl);

      // 1. YouTube video
      if (parsed.type === 'youtube') {
        return `
          <div class="video-embed-box youtube-box">
            <iframe
              src="${parsed.embedUrl}"
              style="width: 100%; height: 100%; border: none;"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        `;
      }

      // 2. Instagram Reels / Post
      if (parsed.type === 'instagram') {
        return `
          <div class="video-embed-box instagram-box">
            <iframe
              src="${parsed.embedUrl}"
              class="instagram-iframe"
              scrolling="no"
              allowtransparency="true"
              allowfullscreen
            ></iframe>
            <div class="video-direct-link">
              <a href="${article.sourceUrl || article.videoUrl}" target="_blank" rel="noopener noreferrer">
                📸 Instagramda to‘liq ko‘rish ↗
              </a>
            </div>
          </div>
        `;
      }

      // 3. Telegram kanali / posti
      if (parsed.type === 'telegram') {
        return `
          <div class="video-embed-box telegram-box">
            <iframe
              src="${parsed.embedUrl}"
              class="telegram-iframe"
              scrolling="no"
              allowfullscreen
            ></iframe>
            <div class="video-direct-link">
              <a href="${article.sourceUrl || article.videoUrl}" target="_blank" rel="noopener noreferrer">
                ✈️ Telegram kanalida ko‘rish ↗
              </a>
            </div>
          </div>
        `;
      }

      // 4. Mahalliy video (IndexedDB xotirasidan o'ynaydi)
      if (parsed.type === 'local') {
        const fileId = article.videoUrl.replace('idb://', '');
        const cachedUrl = mediaDb.getCachedUrl(fileId) || '';
        return `
          <div class="video-embed-box" style="aspect-ratio: 16/9; background: #000;">
            <video
              id="activeArticleVideoPlayer"
              src="${cachedUrl}"
              poster="${article.imageUrl}"
              controls
              autoplay
              playsinline
              style="width: 100%; height: 100%; object-fit: contain;"
            ></video>
          </div>
        `;
      }

      // 5. To'g'ridan-to'g'ri MP4 / WebM yoki umumiy video
      if (parsed.type === 'video' || parsed.type === 'generic') {
        return `
          <div class="video-embed-box" style="aspect-ratio: 16/9; background: #000;">
            <video
              src="${parsed.embedUrl}"
              poster="${article.imageUrl}"
              controls
              autoplay
              playsinline
              style="width: 100%; height: 100%; object-fit: contain;"
            ></video>
          </div>
        `;
      }
    }

    return `
      <div class="article-media-cover">
        <img src="${article.imageUrl}" alt="${article.title}" />
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

          ${this.renderArticleMedia(article)}

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

          <!-- Modal Nav Tabs (Rasmli va Video alohida!) -->
          <div class="admin-nav-tabs">
            <button class="admin-tab-btn ${this.cfActiveTab === 'stats' ? 'active' : ''}" data-cf-tab="stats">
              📊 Baza & Xotira
            </button>
            <button class="admin-tab-btn ${this.cfActiveTab === 'news' ? 'active' : ''}" data-cf-tab="news">
              📸 Rasmli Xabar
            </button>
            <button class="admin-tab-btn ${this.cfActiveTab === 'video' ? 'active' : ''}" data-cf-tab="video">
              🎬 Video Xabar
            </button>
            <button class="admin-tab-btn ${this.cfActiveTab === 'list' ? 'active' : ''}" data-cf-tab="list">
              📋 Barchasi (${newsList.length})
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

          <!-- TAB 2: ALOHIDA RASMLI XABAR QO'SHISH -->
          ${this.cfActiveTab === 'news' ? `
            <div class="admin-modal-body">
              <div style="background: rgba(229, 9, 20, 0.08); border-left: 3px solid var(--an-red); padding: 8px 12px; border-radius: 8px; font-size: 11.5px; color: var(--text-main); margin-bottom: 4px;">
                📸 <b>Rasmli yangilik joylash:</b> Matnli va rasmli xabarlarni manbasi bilan tezkor joylang.
              </div>

              <div class="form-group">
                <label class="form-label">Yangilik Sarlavhasi</label>
                <input type="text" id="cfNewsTitle" class="form-input" placeholder="Tezkor xabar sarlavhasi..." />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Bo‘lim (Kategoriya)</label>
                  <select id="cfNewsCategory" class="form-select">
                    ${categories.filter(c => c.id !== 'all' && c.id !== 'video').map(c => `
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
                <label class="form-label">Rasm URL Manzili yoki Qurilmadan Rasm</label>
                <div style="display: flex; gap: 8px;">
                  <input type="url" id="cfNewsImageUrl" class="form-input" placeholder="https://... yoki fayl tanlang" value="${this.pendingNewsImageUrl || ''}" />
                  <button type="button" class="btn-select-file" id="cfPickNewsPhotoBtn" style="white-space: nowrap;">🖼️ Fayldan</button>
                  <input type="file" id="cfNewsPhotoInput" accept="image/*" style="display: none;" />
                </div>
                ${this.pendingNewsImageUrl ? `
                  <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px; background: rgba(34, 197, 94, 0.08); padding: 6px 10px; border-radius: 8px;">
                    <img src="${this.pendingNewsImageUrl}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover;" />
                    <span style="font-size: 11px; color: #22C55E; font-weight: 700;">✓ Rasm muvaffaqiyatli yuklandi</span>
                  </div>
                ` : ''}
              </div>

              <div class="form-group">
                <label class="form-label">Qisqacha Tavsif (Lead)</label>
                <textarea id="cfNewsSummary" class="form-textarea" placeholder="Yangilikning qisqa mazmuni..."></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">To‘liq Maqola Matni</label>
                <textarea id="cfNewsContent" class="form-textarea" style="min-height: 100px;" placeholder="Batafsil maqola matni..."></textarea>
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
                <span>📸 Rasmli Xabarni Saqlash</span>
              </button>
            </div>
          ` : ''}

          <!-- TAB 3: ALOHIDA VIDEO XABAR QO'SHISH (YOUTUBE, INSTAGRAM, TELEGRAM, FAYLLAR) -->
          ${this.cfActiveTab === 'video' ? `
            <div class="admin-modal-body">
              <!-- Rejim tanlash: Havola yoki Fayldan yuklash -->
              <div class="video-source-mode-selector">
                <button type="button" class="mode-btn ${this.videoUploadMode === 'url' ? 'active' : ''}" data-video-mode="url">
                  🌐 Havola orqali (YouTube / Insta / TG / Sayt)
                </button>
                <button type="button" class="mode-btn ${this.videoUploadMode === 'file' ? 'active' : ''}" data-video-mode="file">
                  📁 Qurilmadan Video Fayl (MP4, MOV)
                </button>
              </div>

              ${this.videoUploadMode === 'url' ? `
                <div style="background: rgba(37, 99, 235, 0.08); border-left: 3px solid #2563EB; padding: 8px 12px; border-radius: 8px; font-size: 11.5px; color: var(--text-main); margin-bottom: 8px;">
                  🎬 <b>Video manbasi:</b> YouTube, Instagram Reels, Telegram posti yoki istalgan saytdagi video havolasini kiriting.
                </div>

                <!-- Tezkor namunalar -->
                <div style="margin-bottom: 10px;">
                  <span style="font-size: 10.5px; color: var(--text-dim); margin-right: 6px;">Tezkor tanlash:</span>
                  <div class="quick-source-pills" style="display: inline-flex;">
                    <button type="button" class="quick-pill" data-fill-video="yt">🔴 YouTube</button>
                    <button type="button" class="quick-pill" data-fill-video="ig">🟣 Instagram</button>
                    <button type="button" class="quick-pill" data-fill-video="tg">🔵 Telegram</button>
                    <button type="button" class="quick-pill" data-fill-video="mp4">🟢 Sayt MP4</button>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Video Havolasi (URL)</label>
                  <input type="url" id="cfVideoUrl" class="form-input" placeholder="YouTube, Instagram, Telegram yoki video manzili..." value="${this.pendingVideoUrl || ''}" />
                  <div id="cfVideoUrlStatus" style="font-size: 11px; margin-top: 4px; color: var(--text-dim);">
                    YouTube, Instagram yoki Telegram havolasini qo‘ying — pleyer avtomatik sozlanadi!
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Video Sarlavhasi</label>
                  <input type="text" id="cfVideoTitle" class="form-input" placeholder="Video reportaj sarlavhasi..." />
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Qaysi kanaldan/saytdan (Manba)</label>
                    <input type="text" id="cfVideoSource" class="form-input" placeholder="YouTube, Telegram, Instagram..." value="${this.pendingVideoSource || 'YouTube'}" />
                  </div>

                  <div class="form-group">
                    <label class="form-label">Video Davomiyligi</label>
                    <input type="text" id="cfVideoDuration" class="form-input" placeholder="Masalan: 04:15, 12:30" value="${this.pendingVideoDuration || '03:45'}" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Muqova Rasmi (Cover) — Ixtiyoriy</label>
                  <div style="display: flex; gap: 8px;">
                    <input type="url" id="cfVideoImageUrl" class="form-input" placeholder="Bo‘sh qoldirilsa, avtomatik olinadi" value="${this.pendingVideoThumbnail || ''}" />
                    <button type="button" class="btn-select-file" id="cfPickCoverBtn" style="white-space: nowrap;">🖼️ Fayldan</button>
                    <input type="file" id="cfCoverFileInput" accept="image/*" style="display: none;" />
                  </div>
                </div>
              ` : `
                <!-- FAYLDAN YUKLASH REJIMI -->
                <div style="background: rgba(34, 197, 94, 0.08); border-left: 3px solid #22C55E; padding: 8px 12px; border-radius: 8px; font-size: 11.5px; color: var(--text-main); margin-bottom: 8px;">
                  📁 <b>Qurilmangizdan video:</b> MP4, WebM yoki MOV fayl tanlang. Video muqovasi va davomiyligi <b>avtomatik</b> aniqlanadi!
                </div>

                <div class="video-file-dropzone" id="cfVideoDropzone">
                  <div class="dropzone-icon">🎬</div>
                  <div class="dropzone-text">Video faylni tanlash uchun bosing</div>
                  <div class="dropzone-sub">MP4, WebM, MOV formatlar (IndexedDB mahalliy xotirasida saqlanadi)</div>
                  <button type="button" class="btn-select-file" id="cfChooseVideoFileBtn">📁 Video Faylni Tanlash</button>
                  <input type="file" id="cfVideoFileInput" accept="video/mp4,video/webm,video/quicktime,video/*" style="display: none;" />
                </div>

                ${this.pendingVideoFile ? `
                  <div class="media-preview-card">
                    <img src="${this.pendingVideoThumbnail || 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=400&q=80'}" class="media-preview-thumb" alt="Kadr" />
                    <div class="media-preview-details">
                      <div class="media-preview-name">${this.pendingVideoFile.name}</div>
                      <div class="media-preview-size">${(this.pendingVideoFile.size / (1024 * 1024)).toFixed(1)} MB • Davomiyligi: ${this.pendingVideoDuration || '00:00'}</div>
                      <span class="media-preview-badge">✨ Video kadridan muqova avtomatik olindi!</span>
                    </div>
                    <button type="button" class="btn-del-sm" id="cfRemoveVideoFileBtn">✕ O‘chirish</button>
                  </div>
                ` : ''}

                <div class="form-group" style="margin-top: 10px;">
                  <label class="form-label">Video Sarlavhasi</label>
                  <input type="text" id="cfVideoTitle" class="form-input" placeholder="Video reportaj sarlavhasi..." />
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Manba / Muallif</label>
                    <input type="text" id="cfVideoSource" class="form-input" placeholder="Mobil Reportaj, Shaxsiy Video..." value="Shaxsiy Video" />
                  </div>

                  <div class="form-group">
                    <label class="form-label">Davomiyligi</label>
                    <input type="text" id="cfVideoDuration" class="form-input" placeholder="Masalan: 02:30" value="${this.pendingVideoDuration || '00:00'}" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Muqova Rasmi</label>
                  <div style="display: flex; gap: 8px;">
                    <input type="url" id="cfVideoImageUrl" class="form-input" placeholder="Avtomatik kadr yoki boshqa havola" value="${this.pendingVideoThumbnail || ''}" />
                    <button type="button" class="btn-select-file" id="cfPickCoverBtn" style="white-space: nowrap;">🖼️ Boshqa Rasm</button>
                    <input type="file" id="cfCoverFileInput" accept="image/*" style="display: none;" />
                  </div>
                </div>
              `}

              <div class="form-group">
                <label class="form-label">Qisqacha Tavsif / Mazmuni</label>
                <textarea id="cfVideoSummary" class="form-textarea" placeholder="Videoning qisqacha mazmuni..."></textarea>
              </div>

              <div class="form-row">
                <label class="form-checkbox-label">
                  <input type="checkbox" id="cfVideoIsHero" />
                  <span>Katta Hero Videoga chiqarish</span>
                </label>

                <label class="form-checkbox-label">
                  <input type="checkbox" id="cfVideoIsTrending" checked />
                  <span>Trenddagi video</span>
                </label>
              </div>

              <button class="btn-primary-red" id="cfSubmitVideoBtn" style="background: linear-gradient(135deg, #E50914 0%, #A3020B 100%);">
                <span>🎬 Videoni Bazaga Saqlash</span>
              </button>
            </div>
          ` : ''}

          <!-- TAB 4: BAZADAGI MAQOLALAR VA VIDEOLAR RO'YXATI -->
          ${this.cfActiveTab === 'list' ? `
            <div class="admin-modal-body">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span class="form-label">Bazadagi barcha xabarlar (${newsList.length})</span>
                <span style="font-size: 11px; color: var(--text-dim);">Manbasi va turi</span>
              </div>

              <div class="admin-news-table-wrap">
                ${newsList.map(n => `
                  <div class="admin-news-row">
                    <div class="admin-news-row-info">
                      <div class="admin-news-row-title">${n.title}</div>
                      <div class="admin-news-row-meta">
                        ${n.category === 'video' || n.videoUrl ? `
                          <span class="source-badge" style="background: rgba(229, 9, 20, 0.15); color: var(--an-red);">🎬 Video</span>
                        ` : `
                          <span class="source-badge" style="background: rgba(37, 99, 235, 0.15); color: #2563EB;">📸 Rasmli</span>
                        `}
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

      this.pendingNewsImageUrl = '';
      this.showToast('🎉 Yangilik muvaffaqiyatli e\'lon qilindi!');
      this.closeCfModal();
      this.openArticle(created.id);
    });

    // 9a-2. Rasmli xabar uchun fayldan rasm tanlash
    document.getElementById('cfPickNewsPhotoBtn')?.addEventListener('click', () => {
      document.getElementById('cfNewsPhotoInput')?.click();
    });
    document.getElementById('cfNewsPhotoInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          this.showToast('⏳ Rasm qayta ishlanmoqda...');
          const dataUrl = await processImageFile(file, 1200, 0.85);
          this.pendingNewsImageUrl = dataUrl;
          const input = document.getElementById('cfNewsImageUrl');
          if (input) input.value = dataUrl;
          this.showToast('🖼️ Rasm muvaffaqiyatli tanlandi!');
          this.render();
        } catch (err) {
          alert('Rasm yuklashda xatolik: ' + err.message);
        }
      }
    });

    // 9b-1. Video rejimini o'zgartirish (Havola orqali vs Qurilmadan fayl)
    document.querySelectorAll('[data-video-mode]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-video-mode');
        if (mode && mode !== this.videoUploadMode) {
          this.videoUploadMode = mode;
          this.render();
        }
      });
    });

    // 9b-2. Tezkor video namunalarini qo'yish (YouTube, Instagram, Telegram, MP4)
    document.querySelectorAll('[data-fill-video]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.getAttribute('data-fill-video');
        const urlInput = document.getElementById('cfVideoUrl');
        const sourceInput = document.getElementById('cfVideoSource');
        const coverInput = document.getElementById('cfVideoImageUrl');
        const titleInput = document.getElementById('cfVideoTitle');

        if (type === 'yt') {
          if (urlInput) urlInput.value = 'https://www.youtube.com/watch?v=5qap5aO4i9A';
          if (sourceInput) sourceInput.value = 'YouTube';
          if (coverInput) coverInput.value = 'https://img.youtube.com/vi/5qap5aO4i9A/hqdefault.jpg';
          if (titleInput && !titleInput.value) titleInput.value = 'Lofi Hip Hop Radio — Jonli Efir';
        } else if (type === 'ig') {
          if (urlInput) urlInput.value = 'https://www.instagram.com/reel/C3_sampleReel/';
          if (sourceInput) sourceInput.value = 'Instagram Reels';
          if (coverInput) coverInput.value = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=80';
          if (titleInput && !titleInput.value) titleInput.value = 'Instagram Reels: Texnologiya yangiliklari';
        } else if (type === 'tg') {
          if (urlInput) urlInput.value = 'https://t.me/kunuzofficial/145829';
          if (sourceInput) sourceInput.value = 'Telegram (@kunuzofficial)';
          if (coverInput) coverInput.value = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';
          if (titleInput && !titleInput.value) titleInput.value = 'Telegram xabari: Kun yangiliklari reportaji';
        } else if (type === 'mp4') {
          if (urlInput) urlInput.value = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
          if (sourceInput) sourceInput.value = 'Google Video Server';
          if (coverInput) coverInput.value = 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=1200&q=80';
          if (titleInput && !titleInput.value) titleInput.value = 'Yuqori Sifatli MP4 Video Reportaj';
        }

        if (urlInput) {
          urlInput.dispatchEvent(new Event('input'));
        }
      });
    });

    // 9b-3. Video URL jonli tahlil qilish (Avtomatik manba va muqova aniqlash)
    const videoUrlEl = document.getElementById('cfVideoUrl');
    videoUrlEl?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const statusEl = document.getElementById('cfVideoUrlStatus');
      const sourceInput = document.getElementById('cfVideoSource');
      const coverInput = document.getElementById('cfVideoImageUrl');

      if (!val) {
        if (statusEl) statusEl.innerHTML = 'YouTube, Instagram yoki Telegram havolasini qo‘ying — pleyer avtomatik sozlanadi!';
        return;
      }

      const parsed = parseVideoEmbed(val);
      if (parsed) {
        if (parsed.type === 'youtube') {
          if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444; font-weight: 700;">🔴 YouTube video aniqlandi • HD Muqova va pleyer tayyorlandi!</span>';
          if (sourceInput && (!sourceInput.value || sourceInput.value === 'YouTube')) sourceInput.value = 'YouTube';
          if (coverInput && (!coverInput.value || coverInput.value.includes('img.youtube.com'))) {
            coverInput.value = parsed.thumbnailUrl;
            this.pendingVideoThumbnail = parsed.thumbnailUrl;
          }
        } else if (parsed.type === 'instagram') {
          if (statusEl) statusEl.innerHTML = '<span style="color: #E1306C; font-weight: 700;">🟣 Instagram Reels / Post aniqlandi • Pleyer sozlandi!</span>';
          if (sourceInput) sourceInput.value = 'Instagram';
          if (coverInput && !coverInput.value) coverInput.value = parsed.thumbnailUrl;
        } else if (parsed.type === 'telegram') {
          if (statusEl) statusEl.innerHTML = '<span style="color: #0088CC; font-weight: 700;">🔵 Telegram posti aniqlandi • Rasmiy vidjet tayyorlandi!</span>';
          if (sourceInput) sourceInput.value = parsed.source;
          if (coverInput && !coverInput.value) coverInput.value = parsed.thumbnailUrl;
        } else if (parsed.type === 'video') {
          if (statusEl) statusEl.innerHTML = '<span style="color: #22C55E; font-weight: 700;">🟢 Sayt video fayli (MP4/WebM) aniqlandi • HTML5 pleyer tayyor!</span>';
          if (sourceInput) sourceInput.value = parsed.source;
        } else {
          if (statusEl) statusEl.innerHTML = `<span style="color: var(--text-main);">🌐 Sayt havolasi aniqlandi: <b>${parsed.source}</b></span>`;
          if (sourceInput) sourceInput.value = parsed.source;
        }
      }
    });

    // 9b-4. Video Fayl Tanlash (Qurilmadan video yuklash)
    const chooseBtn = document.getElementById('cfChooseVideoFileBtn');
    const dropzone = document.getElementById('cfVideoDropzone');
    const fileInput = document.getElementById('cfVideoFileInput');

    chooseBtn?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('click', (e) => {
      if (e.target !== chooseBtn) fileInput?.click();
    });

    // Drag and drop qo'llab-quvvatlash
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('video/')) {
        handleVideoFileSelect(file);
      } else {
        alert('Iltimos, video fayl (MP4, WebM, MOV) tashlang!');
      }
    });

    const handleVideoFileSelect = async (file) => {
      this.showToast('⏳ Video fayl tahlil qilinmoqda (muqova va davomiylik)...');
      try {
        const meta = await captureVideoMetadata(file);
        this.pendingVideoFile = file;
        this.pendingVideoThumbnail = meta.thumbnailUrl;
        this.pendingVideoDuration = meta.durationFormatted || '01:30';

        const titleInput = document.getElementById('cfVideoTitle');
        if (titleInput && !titleInput.value) {
          titleInput.value = file.name.replace(/\.[^/.]+$/, '');
        }

        const durationInput = document.getElementById('cfVideoDuration');
        if (durationInput) durationInput.value = this.pendingVideoDuration;

        this.showToast('✨ Video qabul qilindi! Kadr muqovasi va davomiylik avtomatik olindi.');
        this.render();
      } catch (err) {
        alert('Video tahlilida xatolik: ' + err.message);
      }
    };

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleVideoFileSelect(file);
    });

    // 9b-5. Tanlangan video faylni tozalash
    document.getElementById('cfRemoveVideoFileBtn')?.addEventListener('click', () => {
      this.pendingVideoFile = null;
      this.pendingVideoThumbnail = null;
      this.pendingVideoDuration = '00:00';
      this.render();
    });

    // 9b-6. Boshqa muqova rasm tanlash (Fayldan)
    document.getElementById('cfPickCoverBtn')?.addEventListener('click', () => {
      document.getElementById('cfCoverFileInput')?.click();
    });
    document.getElementById('cfCoverFileInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          this.showToast('⏳ Muqova rasmi siqilmoqda...');
          const dataUrl = await processImageFile(file, 1200, 0.85);
          this.pendingVideoThumbnail = dataUrl;
          const coverInput = document.getElementById('cfVideoImageUrl');
          if (coverInput) coverInput.value = dataUrl;
          this.showToast('🖼️ Yangi muqova rasmi o‘rnatildi!');
          this.render();
        } catch (err) {
          alert('Rasm tanlashda xatolik: ' + err.message);
        }
      }
    });

    // 9b-7. Alohida Video Xabar Qo'shish (Fayl yoki Havola)
    document.getElementById('cfSubmitVideoBtn')?.addEventListener('click', async () => {
      const title = document.getElementById('cfVideoTitle')?.value.trim();
      const source = document.getElementById('cfVideoSource')?.value.trim() || 'Video';
      const duration = document.getElementById('cfVideoDuration')?.value.trim() || this.pendingVideoDuration || '03:45';
      let imageUrl = document.getElementById('cfVideoImageUrl')?.value.trim() || this.pendingVideoThumbnail;
      const summary = document.getElementById('cfVideoSummary')?.value.trim();
      const isHero = Boolean(document.getElementById('cfVideoIsHero')?.checked);
      const isTrending = Boolean(document.getElementById('cfVideoIsTrending')?.checked);

      if (!title) {
        alert('Iltimos, video sarlavhasini kiriting!');
        return;
      }

      let finalVideoUrl = '';

      if (this.videoUploadMode === 'file') {
        // Fayldan yuklash
        if (!this.pendingVideoFile) {
          alert('Iltimos, video faylni tanlang!');
          return;
        }

        this.showToast('⏳ Video fayl mahalliy xotiraga (IndexedDB) saqlanmoqda...');
        const fileId = 'vid_' + Date.now();
        await mediaDb.saveMedia(fileId, this.pendingVideoFile, { title });
        finalVideoUrl = 'idb://' + fileId;
      } else {
        // Havola orqali
        const rawVideoUrl = document.getElementById('cfVideoUrl')?.value.trim();
        if (!rawVideoUrl) {
          alert('Iltimos, video havolasini kiriting!');
          return;
        }

        const parsed = parseVideoEmbed(rawVideoUrl);
        finalVideoUrl = (parsed && parsed.embedUrl) || rawVideoUrl;

        if (!imageUrl && parsed && parsed.thumbnailUrl) {
          imageUrl = parsed.thumbnailUrl;
        }
      }

      if (!imageUrl) {
        imageUrl = 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80';
      }

      this.showToast('🎬 Video bazaga saqlanmoqda...');

      const created = await store.createNews({
        title,
        category: 'video',
        categoryName: 'Video',
        videoUrl: finalVideoUrl,
        imageUrl,
        author: 'ANTIVIRUS Media',
        source,
        sourceUrl: this.videoUploadMode === 'url' ? document.getElementById('cfVideoUrl')?.value.trim() : 'Qurilmadan yuklangan',
        readTime: duration,
        summary: summary || title,
        content: summary || title,
        isHero,
        isTrending,
        tags: ['Video', source]
      });

      // Tozalash
      this.pendingVideoFile = null;
      this.pendingVideoThumbnail = null;
      this.pendingVideoUrl = '';

      this.showToast('🎬 Video muvaffaqiyatli saqlandi!');
      this.closeCfModal();
      this.setTab('video');
      this.openArticle(created.id);
    });

    // 9c. Maqolani o'chirish (Agar IndexedDB fayli bo'lsa, xotiradan ham tozalash)
    document.querySelectorAll('[data-del-news-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-del-news-id');
        if (id && confirm('Ushbu yangilikni bazadan o‘chirmoqchimisiz?')) {
          const article = store.getNewsById(id);
          if (article && article.videoUrl && article.videoUrl.startsWith('idb://')) {
            const fileId = article.videoUrl.replace('idb://', '');
            await mediaDb.deleteMedia(fileId);
          }
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
        this.openCfModal('stats');
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
