// ANTIVIRUS NEWS — Siyraklashtirilgan, Aniq va Tezkor Ilova Mantig'i
// Cloudflare (D1 SQL Baza + R2 Xotira) va IndexedDB bilan to'liq integratsiya qilingan
import { store } from './store.js';
import { Icons, getCategoryIcon } from './icons.js';
import { mediaDb, captureVideoMetadata, processImageFile, extractDomainName } from './mediaDb.js';

// Google Identity Services JWT tokenini brauzerda xavfsiz dekodlash
export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.warn('JWT dekodlashda ogohlantirish:', e);
    return null;
  }
}

// Video URL (YouTube, Instagram, Telegram, Sayt yoki Mahalliy fayl) ni avtomatik tahlil qiluvchi
// YouTube ID sini har qanday havola, embed yoki matndan xavfsiz ajratib olish
export function extractYouTubeId(url) {
  if (!url) return null;
  const str = String(url).trim();
  const patterns = [
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i
  ];
  for (const p of patterns) {
    const m = str.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

// YouTube oEmbed orqali video sarlavhasi, muallifi va muqovasini avtomatik olish
export async function fetchYouTubeMeta(urlOrId) {
  const id = extractYouTubeId(urlOrId) || urlOrId;
  if (!id || typeof id !== 'string' || id.length < 5) return null;

  const targetUrl = `https://www.youtube.com/watch?v=${id}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`);
    if (res.ok) {
      const data = await res.json();
      return {
        id,
        title: data.title || '',
        author: data.author_name || 'YouTube',
        thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
      };
    }
  } catch (e) {
    // Tarmoq xatosi yoki CORS cheklovi
  }

  return {
    id,
    title: 'YouTube Video Reportaj',
    author: 'YouTube',
    thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
  };
}

// Video URL (YouTube, Instagram, Telegram, Sayt yoki Mahalliy fayl) ni avtomatik tahlil qiluvchi
export function parseVideoEmbed(url) {
  if (!url) return null;
  const trimmed = String(url).trim();

  // 1. YouTube Watch / Short / Live / Embed / youtu.be
  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    const isShort = trimmed.includes('/shorts/');
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      originalUrl: trimmed,
      source: isShort ? 'YouTube Shorts' : 'YouTube',
      isShort,
      videoId: ytId
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
      source: extractDomainName(trimmed) || 'Video Fayl'
    };
  }

  // 6. Generic embed yoki veb sahifa
  return {
    type: 'generic',
    embedUrl: trimmed,
    thumbnailUrl: null,
    originalUrl: trimmed,
    source: extractDomainName(trimmed) || 'Havola'
  };
}

class AntivirusApp {
  constructor() {
    this.currentTab = 'home'; // 'home' | 'trend' | 'video' | 'menu' | 'saved'
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.isSearchOpen = false;
    this.isNotifOpen = false;
    this.heroSlideIndex = 0;
    this.heroAutoPlayTimer = null;
    this.activeArticleId = null;
    this.isCfModalOpen = false;
    this.cfActiveTab = 'stats'; // 'stats' | 'add-news' | 'video' | 'list'
    this.cfTestStatus = null;
    this.isUploadingMedia = false;
    this.speechSynth = window.speechSynthesis;
    this.isAudioPlaying = false;

    // Auth va Foydalanuvchi profili holatlari (Kirish vs Tezkor Ro'yxatdan o'tish)
    this.isAuthModalOpen = false;
    this.isProfileDropdownOpen = false;
    this.authModalTab = 'login'; // 'login' | 'register' | 'client_id'
    this.selectedAvatarIndex = 0;
    this.avatarPresets = [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
      'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
    ];

    // Video & Rasm yuklash holatlari
    this.videoUploadMode = 'url'; // 'url' | 'file'
    this.pendingVideoFile = null;
    this.pendingVideoThumbnail = null;
    this.pendingVideoDuration = '03:45';
    this.pendingVideoUrl = '';
    this.pendingVideoSource = 'YouTube';
    this.pendingNewsImageUrl = '';

    // Video va Rasm ko'rinish formati (16:9, 3:4, 9:16, 1:1, auto) va joylashuv tartibi
    this.selectedNewsRatio = '16:9';
    this.selectedNewsLayout = 'top';
    this.selectedVideoRatio = '16:9';
    this.selectedVideoLayout = 'top';

    // Video va Modal kattalashtirish/kichiklashtirish va barcha qulayliklar
    this.articleModalSize = 'normal'; // 'compact' | 'normal' | 'theater' | 'fullscreen'
    this.currentVideoRatio = '16-9'; // '16-9' | '4-3' | '9-16' | 'fit'
    this.isVideoFitCover = false; // false: to'liq sig'dirish (contain, kesilmaydi), true: to'ldirish (cover)
    this.videoPlaybackRate = 1.0;
    this.activePhotoRatio = null; // '16:9' | '3:4' | '1:1' | 'auto'

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

    // Markaziy Bank rasmiy API kurslarini yuklash va tinimsiz aylanib turuvchi soatni ishga tushirish
    store.fetchLiveCbuRates();
    this.startLiveClock();
    this.startCbuAutoRefresh();
  }

  toggleTheme() {
    const next = store.toggleTheme();
    this.showToast(next === 'dark' ? '🌙 Dark Mode yoqildi' : '☀️ Light Mode yoqildi');
  }

  setCategory(catId) {
    this.selectedCategory = catId;
    if (catId === 'trend') {
      this.currentTab = 'trend';
    } else {
      if (this.currentTab !== 'home') {
        this.currentTab = 'home';
      }
    }
    this.render();
  }

  setTab(tab) {
    this.currentTab = tab;
    if (tab === 'home' && this.selectedCategory === 'trend') {
      this.selectedCategory = 'all';
    }
    this.activeArticleId = null;
    this.activePhotoRatio = null;
    if (tab !== 'home') {
      this.stopHeroAutoPlay();
    }
    this.render();
  }

  startHeroAutoPlay() {
    this.stopHeroAutoPlay();
    if (this.currentTab !== 'home' || this.activeArticleId || this.isCfModalOpen) {
      return;
    }
    this.heroAutoPlayTimer = setInterval(() => {
      this.nextHeroSlide();
    }, 4500);
  }

  stopHeroAutoPlay() {
    if (this.heroAutoPlayTimer) {
      clearInterval(this.heroAutoPlayTimer);
      this.heroAutoPlayTimer = null;
    }
  }

  getHeroSliderItems() {
    const newsList = store.getNews();
    let list = newsList;
    if (this.selectedCategory !== 'all') {
      if (this.selectedCategory === 'trend') {
        list = store.getTrendingNews();
      } else {
        list = list.filter(n => n.category === this.selectedCategory);
      }
    }
    if (this.searchQuery) {
      list = list.filter(n =>
        n.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (n.summary && n.summary.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        (n.content && n.content.toLowerCase().includes(this.searchQuery.toLowerCase()))
      );
    }
    return list.slice(0, 5);
  }

  nextHeroSlide() {
    const sliderItems = this.getHeroSliderItems();
    if (sliderItems.length <= 1) return;
    const nextIndex = (this.heroSlideIndex + 1) % sliderItems.length;
    this.setHeroSlide(nextIndex);
  }

  prevHeroSlide() {
    const sliderItems = this.getHeroSliderItems();
    if (sliderItems.length <= 1) return;
    const prevIndex = (this.heroSlideIndex - 1 + sliderItems.length) % sliderItems.length;
    this.setHeroSlide(prevIndex);
  }

  setHeroSlide(index) {
    this.heroSlideIndex = index;
    const sliderItems = this.getHeroSliderItems();
    if (sliderItems.length === 0) return;

    const banner = document.getElementById('heroBannerCarousel');
    const activeItem = sliderItems[this.heroSlideIndex % sliderItems.length];

    if (banner && activeItem) {
      banner.setAttribute('data-open-id', activeItem.id);
      banner.setAttribute('title', activeItem.title);
      const img = document.getElementById('heroCardImg');
      if (img) {
        img.style.opacity = '0.35';
        setTimeout(() => {
          img.src = activeItem.imageUrl;
          img.alt = activeItem.title;
          img.style.opacity = '1';
        }, 120);
      }
      const info = document.getElementById('heroCardInfo');
      if (info) {
        info.innerHTML = `
          <div class="hero-badge-row">
            <span class="hero-tag-badge">${activeItem.categoryName || 'ASOSIY'}</span>
            <span class="hero-recent-badge">Yangi</span>
          </div>
          <h3 class="hero-card-title">${activeItem.title}</h3>
          ${activeItem.summary ? `<p class="hero-card-desc">${activeItem.summary}</p>` : ''}
          <div class="hero-card-meta">
            <div class="hero-meta-left">
              <span>${Icons.clock} ${activeItem.time}</span>
              <span>${Icons.calendar} ${activeItem.date}</span>
              <span>${Icons.eye} ${(activeItem.views || 0).toLocaleString()}</span>
            </div>
            ${sliderItems.length > 1 ? `
              <div class="hero-dots-row" onclick="event.stopPropagation();">
                ${sliderItems.map((s, idx) => `
                  <button class="hero-dot-btn ${idx === (this.heroSlideIndex % sliderItems.length) ? 'active' : ''}" data-slide-index="${idx}" title="${s.title}"></button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;

        info.querySelectorAll('[data-slide-index]').forEach(dot => {
          dot.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.getAttribute('data-slide-index'), 10);
            if (!isNaN(idx)) {
              this.setHeroSlide(idx);
              this.startHeroAutoPlay();
            }
          });
        });
      }
    } else {
      this.render();
    }
  }

  openArticle(id) {
    this.stopHeroAutoPlay();
    this.activeArticleId = id;
    const article = store.getNewsById(id);
    this.activePhotoRatio = article?.aspectRatio || '16:9';
    store.incrementViews(id);
    this.render();

    // Agar ushbu maqolada mahalliy IndexedDB video bo'lsa, URL olib pleyerga o'rnatamiz
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
    this.activePhotoRatio = null;
    if (this.speechSynth) this.speechSynth.cancel();
    this.isAudioPlaying = false;
    this.render();
    if (this.currentTab === 'home') {
      this.startHeroAutoPlay();
    }
  }

  setArticleModalSize(size) {
    this.articleModalSize = size;
    const modal = document.getElementById('articleReaderModal');
    if (modal) {
      modal.classList.remove('modal-size-normal', 'modal-size-theater', 'modal-size-compact', 'modal-size-fullscreen');
      modal.classList.add(`modal-size-${size}`);
    }
    const btnNormal = document.getElementById('modalSizeNormal');
    const btnTheater = document.getElementById('modalSizeTheater');
    if (btnNormal) btnNormal.classList.toggle('active', size === 'normal');
    if (btnTheater) btnTheater.classList.toggle('active', size === 'theater');
  }

  setPhotoRatio(ratio) {
    this.activePhotoRatio = ratio;
    const norm = ratio.replace(':', '-');
    const frame = document.getElementById('activeArticlePhotoFrame');
    if (frame) {
      frame.className = frame.className.replace(/\bratio-[^\s]+\b/g, '').trim();
      frame.classList.add(`ratio-${norm}`);
    }
    const photo = document.getElementById('activeArticleCleanPhoto');
    if (photo) {
      photo.className = photo.className.replace(/\bratio-[^\s]+\b/g, '').trim();
      photo.classList.add(`ratio-${norm}`);
    }
    document.querySelectorAll('[data-set-photo-ratio]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-set-photo-ratio') === ratio);
    });
    const ratioBadge = document.getElementById('articleRatioBadge');
    if (ratioBadge) {
      ratioBadge.textContent = `📐 ${ratio}`;
    }
  }

  openCfModal(tab = 'stats') {
    this.stopHeroAutoPlay();
    this.isCfModalOpen = true;
    this.cfActiveTab = tab;
    this.render();
  }

  closeCfModal() {
    this.isCfModalOpen = false;
    this.render();
    if (this.currentTab === 'home') {
      this.startHeroAutoPlay();
    }
  }

  // -------------------------------------------------------------
  // GOOGLE AUTH VA FOYDALANUVCHI PROFILI METODLARI
  // -------------------------------------------------------------
  openAuthModal(tab = 'login') {
    this.authModalTab = tab;
    this.isAuthModalOpen = true;
    this.isProfileDropdownOpen = false;
    this.render();
    this.setupGoogleIdentityBtn();
  }

  closeAuthModal() {
    this.isAuthModalOpen = false;
    this.render();
  }

  toggleProfileDropdown() {
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
    this.render();
  }

  setupGoogleIdentityBtn() {
    let attempts = 0;
    const maxAttempts = 15;

    const tryInit = () => {
      attempts++;
      const clientId = store.getGoogleClientId();
      const container = document.getElementById('googleOfficialBtnContainer');

      if (window.google?.accounts?.id && clientId && container) {
        try {
          container.innerHTML = '';
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
              if (response && response.credential) {
                const decoded = decodeJwt(response.credential);
                if (decoded) {
                  store.setUser({
                    id: decoded.sub || ('g_' + Date.now()),
                    name: decoded.name || decoded.given_name || 'Google Foydalanuvchi',
                    email: decoded.email || '',
                    avatar: decoded.picture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
                    provider: 'google',
                    verified: Boolean(decoded.email_verified),
                    credential: response.credential
                  });
                  this.closeAuthModal();
                  this.showToast(`🎉 Xush kelibsiz, ${decoded.name || 'Foydalanuvchi'}!`);
                }
              }
            }
          });

          window.google.accounts.id.renderButton(container, {
            theme: store.getTheme() === 'dark' ? 'filled_black' : 'outline',
            size: 'large',
            type: 'standard',
            shape: 'pill',
            text: 'signin_with',
            logo_alignment: 'left',
            width: 300
          });
        } catch (e) {
          console.warn('Google Identity Services sozlashda ogohlantirish:', e);
        }
      } else if (attempts < maxAttempts && this.isAuthModalOpen) {
        setTimeout(tryInit, 180);
      }
    };

    setTimeout(tryInit, 80);
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
  // JONLI SANA, TINIMSIZ AYLANUVCHI SOAT VA CBU KURSLARI TIKERI
  // -------------------------------------------------------------
  renderTopLiveBar() {
    const cbu = store.getCbuRates();
    const rates = cbu.rates || [];
    const usd = rates.find(r => r.Ccy === 'USD');
    const eur = rates.find(r => r.Ccy === 'EUR');
    const rub = rates.find(r => r.Ccy === 'RUB');

    const formatDiff = (diff) => {
      const isUp = !String(diff).startsWith('-');
      return `<span class="${isUp ? 'rate-up' : 'rate-down'}">${isUp ? '▲+' : '▼'}${diff}</span>`;
    };

    return `
      <div class="site-top-bar">
        <div class="site-top-bar-inner">
          <div class="top-bar-left">
            <span class="live-pulse-dot"></span>
            <span class="live-date-time" id="liveHeaderClock">Yuklanmoqda...</span>
          </div>
          <div class="top-bar-right">
            <div class="top-bar-cbu-ticker">
              <span class="cbu-ticker-tag" title="O‘zbekiston Respublikasi Markaziy Banki rasmiy kursi">🏛️ CBU:</span>
              ${usd ? `<span class="cbu-ticker-item">🇺🇸 USD <b>${Number(usd.Rate).toLocaleString('uz-UZ')}</b> ${formatDiff(usd.Diff)}</span>` : ''}
              ${eur ? `<span class="cbu-ticker-sep">•</span><span class="cbu-ticker-item">🇪🇺 EUR <b>${Number(eur.Rate).toLocaleString('uz-UZ')}</b> ${formatDiff(eur.Diff)}</span>` : ''}
              ${rub ? `<span class="cbu-ticker-sep">•</span><span class="cbu-ticker-item">🇷🇺 RUB <b>${Number(rub.Rate).toLocaleString('uz-UZ')}</b> ${formatDiff(rub.Diff)}</span>` : ''}
              <span class="cbu-ticker-date" title="Markaziy Bank rasmiy e’lon qilgan sessiya sanasi">(${cbu.date || ''})</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  updateClockDisplay() {
    const el = document.getElementById('liveHeaderClock');
    if (!el) return;
    const now = new Date();
    const days = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktyabr', 'noyabr', 'dekabr'];
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    el.textContent = `${dayName}, ${day}-${monthName}, ${year} • ${h}:${m}:${s}`;
  }

  startLiveClock() {
    if (this.liveClockTimer) clearInterval(this.liveClockTimer);
    this.updateClockDisplay();
    this.liveClockTimer = setInterval(() => {
      this.updateClockDisplay();
    }, 1000);
  }

  startCbuAutoRefresh() {
    if (this.cbuRefreshTimer) clearInterval(this.cbuRefreshTimer);
    // Har 10 daqiqada Markaziy Bank rasmiy API sini fonda tekshirib yangilab turish
    this.cbuRefreshTimer = setInterval(() => {
      store.fetchLiveCbuRates();
    }, 10 * 60 * 1000);
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
    const notifications = store.getNotifications();
    const unreadNotifsCount = notifications.filter(n => !n.read).length;
    const savedCount = store.getSavedIds().length;
    const user = store.getUser();

    root.innerHTML = `
      <div class="app-container" data-theme="${theme}">
        <!-- Top Live Bar: Jonli sana, soat va Markaziy Bank kurslari -->
        ${this.renderTopLiveBar()}

        <!-- 1. Header (Logotip, Desktop Menyu, Qidiruv, Cloudflare, Rejim) -->
        <header class="site-header">
          <div class="site-header-inner">
            <div class="brand-identity" data-tab-link="home">
              <span class="brand-an-badge">AN</span>
              <div class="brand-texts">
                <span class="brand-title">ANTIVIRUS</span>
                <span class="brand-sub">NEWS</span>
              </div>
            </div>

            <!-- Faqat Katta Ekranda (Desktop) Ko'rinuvchi Asosiy Navigatsiya -->
            <nav class="desktop-main-nav">
              <button class="desktop-nav-link ${this.currentTab === 'home' ? 'active' : ''}" data-tab-link="home">
                <span>${Icons.home}</span>
                <span>Asosiy</span>
              </button>
              <button class="desktop-nav-link ${this.currentTab === 'video' ? 'active' : ''}" data-tab-link="video">
                <span>${Icons.playCircle}</span>
                <span>Video</span>
              </button>
              <button class="desktop-nav-link ${this.currentTab === 'saved' ? 'active' : ''}" data-tab-link="saved">
                <span>${Icons.bookmark}</span>
                <span>Saqlanganlar ${savedCount > 0 ? `(${savedCount})` : ''}</span>
              </button>
              <button class="desktop-nav-link ${this.currentTab === 'menu' ? 'active' : ''}" data-tab-link="menu">
                <span>${Icons.menu}</span>
                <span>Barchasi</span>
              </button>
            </nav>

            <div class="header-controls">
              <button class="icon-btn" id="themeSwitchBtn" title="Rejimni almashtirish">
                ${theme === 'dark' ? Icons.sun : Icons.moon}
              </button>
              <button class="icon-btn ${this.isSearchOpen ? 'active' : ''}" id="searchTriggerBtn" title="Qidiruv" ${this.isSearchOpen ? 'style="background: var(--an-red); color: #fff;"' : ''}>
                ${Icons.search}
              </button>
              <button class="icon-btn" id="notifBellBtn" title="Bildirishnomalar">
                ${Icons.bell}
                ${unreadNotifsCount > 0 ? `<span class="notif-badge-dot"></span>` : ''}
              </button>
              <button class="icon-btn desktop-admin-quick-btn" id="desktopAdminBtn" title="Admin Baza Paneli" style="color: var(--an-red);">
                ${Icons.database}
              </button>

              <!-- GOOGLE FOYDALANUVCHI PROFILI / KIRISH TUGMASI -->
              ${user ? `
                <div class="user-profile-header-wrap">
                  <button type="button" class="user-avatar-header-btn ${this.isProfileDropdownOpen ? 'active' : ''}" id="headerUserProfileBtn" title="${user.name} (${user.email || 'Google'})">
                    <img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}" alt="${user.name}" class="header-avatar-img" />
                    <span class="user-online-badge"></span>
                  </button>

                  <!-- User Profile Dropdown Menu -->
                  <div class="user-profile-dropdown ${this.isProfileDropdownOpen ? 'open' : ''}" id="userProfileDropdown">
                    <div class="user-profile-dropdown-card">
                      <img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'}" class="dropdown-avatar-lg" alt="${user.name}" />
                      <div class="user-dropdown-info">
                        <div class="user-dropdown-name">${user.name}</div>
                        <div class="user-dropdown-email">${user.email || (user.username ? '@' + user.username : 'ANTIVIRUS Foydalanuvchi')}</div>
                        <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 4px;">
                          ${user.provider === 'google' ? `
                            <div class="google-verified-badge">${Icons.google} <span>Google orqali faol</span></div>
                          ` : `
                            <div class="google-verified-badge" style="color: var(--an-red); background: rgba(229, 9, 20, 0.1);">
                              <span>🛡️ ANTIVIRUS ID</span>
                            </div>
                          `}
                          <span class="user-id-badge">${user.id || ('#' + (user.username || 'user'))}</span>
                        </div>
                      </div>
                    </div>
                    <div class="user-dropdown-actions">
                      <button type="button" class="user-dropdown-action-btn" id="userMenuAddNewsBtn">
                        ${Icons.edit} <span>Yangilik e’lon qilish</span>
                      </button>
                      <button type="button" class="user-dropdown-action-btn" id="userMenuAddVideoBtn">
                        ${Icons.playCircle} <span>Video qo‘shish</span>
                      </button>
                      <button type="button" class="user-dropdown-action-btn" id="userMenuSavedBtn">
                        ${Icons.bookmark} <span>Saqlanganlarim (${savedCount})</span>
                      </button>
                      <button type="button" class="user-dropdown-action-btn" id="userMenuAdminBtn">
                        ${Icons.database} <span>Admin Baza boshqaruvi</span>
                      </button>
                      <div class="dropdown-divider"></div>
                      <button type="button" class="user-dropdown-action-btn logout-btn" id="userLogoutBtn">
                        ${Icons.logOut} <span>Tizimdan chiqish</span>
                      </button>
                    </div>
                  </div>
                </div>
              ` : `
                <button type="button" class="header-google-login-btn" id="headerGoogleLoginBtn" title="Google orqali kirish">
                  ${Icons.google}
                  <span>Kirish</span>
                </button>
              `}

              <!-- Zamonaviy Bildirishnomalar Paneli (Dropdown) -->
              <div class="notifications-dropdown-menu ${this.isNotifOpen ? 'open' : ''}" id="notifDropdown">
                <div class="notif-dropdown-header">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span>🔔</span>
                    <h4>Bildirishnomalar</h4>
                  </div>
                  ${unreadNotifsCount > 0 ? `
                    <button class="notif-mark-read-btn" id="notifMarkAllReadBtn">O‘qilgan deb belgilash</button>
                  ` : ''}
                </div>
                <div class="notif-items-list">
                  ${notifications.length === 0 ? `
                    <div style="padding: 20px; text-align: center; font-size: 12px; color: var(--text-dim);">Bildirishnomalar yo‘q</div>
                  ` : notifications.map(n => `
                    <div class="notif-card-item ${n.read ? 'read' : 'unread'}">
                      <div class="notif-card-dot"></div>
                      <div class="notif-card-content">
                        <div class="notif-card-title">${n.title}</div>
                        <div class="notif-card-text">${n.text}</div>
                        <div class="notif-card-time">${n.time}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Interaktiv Qidiruv Satri (Dropdown Drawer) -->
        <div class="header-search-drawer ${this.isSearchOpen ? 'open' : ''}" id="headerSearchDrawer">
          <div class="search-input-wrap">
            <span class="search-inside-icon">${Icons.search}</span>
            <input
              type="search"
              id="headerSearchInput"
              class="search-input-field"
              placeholder="Yangiliklar bo‘yicha qidiruv (mavzu, so‘z yoki 'admin')..."
              value="${this.searchQuery}"
              autocomplete="off"
            />
            ${this.searchQuery ? `
              <button class="search-inside-clear" id="headerSearchClearBtn" title="Tozalash">✕</button>
            ` : ''}
          </div>
        </div>

        <!-- 2. Gorizontal Toifalar (Asosiy va Trend sahifalarida) -->
        ${this.currentTab === 'home' || this.currentTab === 'trend' ? this.renderCategoryTabs(categories) : ''}

        <!-- 3. Asosiy Tana (Body) -->
        <main class="main-view-body">
          ${this.renderActiveTabContent()}
        </main>

        <!-- 4. Pastki Navigatsiya Bar (Faqat Mobil Ekranda) -->
        <nav class="bottom-navigation-bar">
          <div class="nav-bottom-item ${this.currentTab === 'home' && this.selectedCategory !== 'trend' ? 'active' : ''}" data-tab-link="home">
            <span>${Icons.home}</span>
            <span class="nav-bottom-label">Asosiy</span>
          </div>

          <div class="nav-bottom-item ${this.currentTab === 'video' ? 'active' : ''}" data-tab-link="video">
            <span>${Icons.playCircle}</span>
            <span class="nav-bottom-label">Video</span>
          </div>

          <!-- MARKAZIY 3D QIZIL "AN" FLOATING TUGMASI -->
          <div class="center-floating-an" id="centerAnCircleBtn" title="Bosh sahifa">
            <div class="center-an-sphere">AN</div>
          </div>

          <div class="nav-bottom-item ${this.currentTab === 'saved' ? 'active' : ''}" data-tab-link="saved">
            <span>${Icons.bookmark}</span>
            <span class="nav-bottom-label">Saqlangan</span>
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

        <!-- 7. Google Auth va Profil Oynasi (Modal) -->
        ${this.renderGoogleAuthModal()}
      </div>
    `;

    this.bindEvents();
    this.updateClockDisplay();

    if (this.currentTab === 'home' && !this.activeArticleId && !this.isCfModalOpen) {
      this.startHeroAutoPlay();
    } else {
      this.stopHeroAutoPlay();
    }
  }

  // Gorizontal toifalar tasmasi
  renderCategoryTabs(categories) {
    const list = categories.filter(c => c.id !== 'all' && c.id !== 'trend');
    return `
      <div class="category-tabs-container">
        <nav class="category-tabs-bar">
          <div class="cat-tab-item ${this.selectedCategory === 'all' && this.currentTab === 'home' ? 'active' : ''}" data-cat-select="all">
            Barchasi
          </div>
          <div class="cat-tab-item ${this.currentTab === 'trend' ? 'active' : ''}" data-cat-select="trend">
            🔥 Trend
          </div>
          ${list.map(c => `
            <div class="cat-tab-item ${this.selectedCategory === c.id && this.currentTab === 'home' ? 'active' : ''}" data-cat-select="${c.id}">
              ${c.name}
            </div>
          `).join('')}
        </nav>
      </div>
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
    } else if (this.currentTab === 'saved') {
      return this.renderSavedView();
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
      if (this.selectedCategory === 'trend') {
        list = store.getTrendingNews();
      } else {
        list = list.filter(n => n.category === this.selectedCategory);
      }
    }
    if (this.searchQuery) {
      list = list.filter(n =>
        n.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (n.summary && n.summary.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        (n.content && n.content.toLowerCase().includes(this.searchQuery.toLowerCase()))
      );
    }

    // Tepada eng oxirgi qo'yilgan yangiliklar slayderi (eng so'nggi 5 ta xabar)
    const sliderItems = list.slice(0, 5);
    const currentHeroIndex = sliderItems.length > 0 ? (this.heroSlideIndex % sliderItems.length) : 0;
    const heroNews = sliderItems[currentHeroIndex] || list[0];
    // Pastida barcha yangiliklar ketma-ket joylashishi (xronologik tartibda)
    const streamNews = list;
    const topReadNews = store.getTrendingNews().slice(0, 5);
    const breakingNews = newsList.find(n => n.isTrending) || newsList[0];

    return `
      <div class="desktop-home-layout">
        <!-- Chap / Markaziy Asosiy Ustun -->
        <div class="desktop-main-column">
          <!-- 1. Tezkor Lenta (Breaking News Ticker) -->
          ${breakingNews && !this.searchQuery ? `
            <div class="breaking-news-ticker-bar" data-open-id="${breakingNews.id}" title="Xabarni o‘qish">
              <div class="ticker-badge">
                <span class="ticker-flame">${Icons.flame}</span>
                <span>TEZKOR</span>
              </div>
              <div class="ticker-content">
                <span class="ticker-text">${breakingNews.title}</span>
                <span class="ticker-time">${Icons.clock} ${breakingNews.time}</span>
              </div>
            </div>
          ` : ''}

          <!-- 2. Qidiruv Faol Bo'lsa Natijalar Paneli -->
          ${this.searchQuery ? `
            <div class="search-results-banner">
              <div class="search-results-info">
                <span>${Icons.search}</span>
                <span>Qidiruv: <b>"${this.searchQuery}"</b> (${list.length} ta xabar)</span>
              </div>
              <button class="search-results-reset" id="resetSearchQueryBtn">✕ Tozalash</button>
            </div>
          ` : ''}

          <!-- 3. Katta Hero Slayder Kartasi (Eng oxirgi qo'yilganlar aylanib turishi) -->
          ${heroNews ? `
            <div class="hero-card-banner hero-carousel-wrapper" id="heroBannerCarousel" data-open-id="${heroNews.id}" title="${heroNews.title}">
              <img class="hero-card-img" id="heroCardImg" src="${heroNews.imageUrl}" alt="${heroNews.title}" />
              <div class="hero-card-gradient"></div>

              ${sliderItems.length > 1 ? `
                <button class="hero-nav-arrow hero-nav-prev" id="heroPrevBtn" aria-label="Oldingi xabar" title="Oldingi xabar">
                  ${Icons.chevronLeft}
                </button>
                <button class="hero-nav-arrow hero-nav-next" id="heroNextBtn" aria-label="Keyingi xabar" title="Keyingi xabar">
                  ${Icons.chevronRight}
                </button>
              ` : ''}

              <div class="hero-card-info" id="heroCardInfo">
                <div class="hero-badge-row">
                  <span class="hero-tag-badge">${heroNews.categoryName || 'ASOSIY'}</span>
                  <span class="hero-recent-badge">Yangi</span>
                </div>
                <h3 class="hero-card-title">${heroNews.title}</h3>
                ${heroNews.summary ? `
                  <p class="hero-card-desc">${heroNews.summary}</p>
                ` : ''}
                <div class="hero-card-meta">
                  <div class="hero-meta-left">
                    <span>${Icons.clock} ${heroNews.time}</span>
                    <span>${Icons.calendar} ${heroNews.date}</span>
                    <span>${Icons.eye} ${(heroNews.views || 0).toLocaleString()}</span>
                  </div>
                  ${sliderItems.length > 1 ? `
                    <div class="hero-dots-row" onclick="event.stopPropagation();">
                      ${sliderItems.map((s, idx) => `
                        <button class="hero-dot-btn ${idx === currentHeroIndex ? 'active' : ''}" data-slide-index="${idx}" title="${s.title}"></button>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- 4. Bo'sh Holat (Baza toza bo'lsa yoki qidiruv topilmasa) -->
          ${list.length === 0 ? `
            <div class="empty-state-card" style="padding: 40px 20px; text-align: center; background: var(--bg-card); border-radius: 14px; border: 1px dashed var(--border-subtle); margin: 20px 0;">
              <div class="empty-state-icon" style="font-size: 40px; margin-bottom: 12px;">📰</div>
              <h3 class="empty-state-title" style="font-size: 17px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">
                ${this.searchQuery ? 'Hech qanday yangilik topilmadi' : 'Baza toza — Yangi xabar qo‘shing'}
              </h3>
              <p class="empty-state-desc" style="font-size: 13px; color: var(--text-dim); max-width: 440px; margin: 0 auto 18px;">
                ${this.searchQuery ? `"${this.searchQuery}" so‘rovi bo‘yicha hech qanday xabar chiqmadi.` : 'Eski demo xabarlar butunlay tozalandi. O‘zingiz xohlagan yangilik yoki video reportajni kiritishingiz mumkin.'}
              </p>
              ${this.searchQuery ? `
                <button class="btn-primary-red" id="resetSearchQueryBtn2" style="max-width: 240px; margin: 0 auto;">Barcha yangiliklarga qaytish</button>
              ` : `
                <button class="btn-primary-red" id="emptyStateAddBtn" style="max-width: 260px; margin: 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                  <span>✍️ Birinchi xabarni qo‘shish</span>
                </button>
              `}
            </div>
          ` : `
            <!-- 5. So'nggi Yangiliklar Ro'yxati -->
            <div class="section-headline-bar">
              <h2 class="headline-text">
                ${this.selectedCategory !== 'all' ? `${store.getCategoryName(this.selectedCategory)} yangiliklari` : (this.searchQuery ? 'Topilgan natijalar' : 'So‘nggi yangiliklar')}
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
                      <span>${Icons.eye} ${(n.views || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- O'ng Yon Panel (Faqat Kompyuter / Desktop ekranda ko'rinadi) -->
        <aside class="desktop-sidebar">
          <!-- Widget 1: Eng ko'p o'qilganlar -->
          <div class="sidebar-widget">
            <div class="widget-header">
              <span class="widget-icon" style="color: var(--an-red);">${Icons.trendingUp}</span>
              <h3 class="widget-title">Eng ko‘p o‘qilganlar</h3>
            </div>
            <div class="sidebar-top-news-list">
              ${topReadNews.map((n, i) => `
                <div class="sidebar-news-item" data-open-id="${n.id}">
                  <span class="sidebar-num-badge num-${i + 1}">${i + 1}</span>
                  <div class="sidebar-news-info">
                    <h5 class="sidebar-news-title">${n.title}</h5>
                    <span class="sidebar-news-meta">${Icons.eye} ${(n.views || 0).toLocaleString()} • ${n.time}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Widget 3: Markaziy Bank Rasmiy Valyuta Kurslari -->
          ${this.renderRatesWidget()}

          <!-- Widget 4: Ijtimoiy Tarmoqlar -->
          <div class="sidebar-widget social-widget">
            <div class="widget-header">
              <h3 class="widget-title">Biz ijtimoiy tarmoqlarda</h3>
            </div>
            <div class="sidebar-social-links">
              <a href="https://t.me" target="_blank" class="social-pill-btn tg">
                ${Icons.telegram} <span>Telegram</span>
              </a>
              <a href="https://youtube.com" target="_blank" class="social-pill-btn yt">
                ${Icons.youtube} <span>YouTube</span>
              </a>
              <a href="https://instagram.com" target="_blank" class="social-pill-btn ig">
                ${Icons.instagram} <span>Instagram</span>
              </a>
            </div>
          </div>
        </aside>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // MARKAZIY BANK (CBU.UZ) RASMIY VALYUTA KURSLARI WIDGETI
  // -------------------------------------------------------------
  renderRatesWidget() {
    const cbu = store.getCbuRates();
    const rates = cbu.rates || [];
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    return `
      <div class="sidebar-widget info-ticker-widget" style="margin-bottom: 20px;">
        <div class="widget-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="widget-icon">📈</span>
            <h3 class="widget-title">Markaziy Bank Kurslari</h3>
          </div>
          <span class="widget-sub-badge" title="Rasmiy CBU.UZ API">
            <span class="live-pulse-dot" style="display: inline-block; vertical-align: middle; margin-right: 4px;"></span>${cbu.date || todayStr}
          </span>
        </div>
        <div class="currency-rates-grid">
          ${rates.map(r => {
            const isUp = !String(r.Diff).startsWith('-');
            const diffFormatted = isUp ? `▲ +${r.Diff}` : `▼ ${r.Diff}`;
            const formattedRate = Number(r.Rate).toLocaleString('uz-UZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return `
              <div class="currency-rate-item" title="${r.name || r.Ccy}: ${formattedRate} so‘m">
                <span class="curr-flag">${r.flag || '🌐'} ${r.Ccy}</span>
                <span class="curr-val">${formattedRate}</span>
                <span class="curr-diff ${isUp ? 'up' : 'down'}">${diffFormatted}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div style="margin-top: 10px; font-size: 10.5px; color: var(--text-dim); display: flex; align-items: center; justify-content: space-between;">
          <span>Har ish kuni 16:00 da yangilanadi</span>
          <span style="color: #10B981; font-weight: 700;">● Jonli CBU API</span>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // TAB 2: «BARCHASI» MENYUSI EKRANI (Mockupdagi 2-ekran)
  // -------------------------------------------------------------
  renderMenuView() {
    const categories = store.getCategories();
    const savedCount = store.getSavedIds().length;
    const user = store.getUser();

    return `
      <div class="menu-view-screen">
        <div class="menu-screen-header">
          <h1 class="menu-screen-title">Barchasi</h1>
          <button class="icon-btn" id="menuSearchBtn" title="Qidiruv">${Icons.search}</button>
        </div>

        <!-- GOOGLE FOYDALANUVCHI PROFILI / KIRISH KARTASI -->
        ${user ? `
          <div class="menu-user-profile-banner">
            <div class="menu-user-avatar-wrap">
              <img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'}" alt="${user.name}" class="menu-user-avatar" />
              <span class="menu-user-online-dot"></span>
            </div>
            <div class="menu-user-info">
              <div class="menu-user-name">${user.name}</div>
              <div class="menu-user-email">${user.email || (user.username ? '@' + user.username : 'ANTIVIRUS Foydalanuvchi')}</div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
                ${user.provider === 'google' ? `
                  <div class="google-verified-badge">${Icons.google} <span>Google orqali faol</span></div>
                ` : `
                  <div class="google-verified-badge" style="color: var(--an-red); background: rgba(229, 9, 20, 0.1);">
                    <span>🛡️ ANTIVIRUS ID</span>
                  </div>
                `}
                <span class="user-id-badge">${user.id || ('#' + (user.username || 'user'))}</span>
              </div>
            </div>
            <button type="button" class="menu-logout-quick-btn" id="menuLogoutBtn" title="Tizimdan chiqish">
              ${Icons.logOut}
            </button>
          </div>
        ` : `
          <div class="menu-google-login-card" id="menuGoogleLoginCard" style="cursor: pointer;">
            <div class="auth-brand-badge" style="width: 40px; height: 40px; font-size: 14px; border-radius: 10px;">
              AN
            </div>
            <div class="menu-google-login-info">
              <span class="menu-google-login-title">Kirish yoki Ro‘yxatdan o‘tish</span>
              <span class="menu-google-login-desc">Tezkor nom yoki Google orqali shaxsiy hisobga ulanish</span>
            </div>
            <button type="button" class="menu-google-pill-btn" style="background: var(--an-red);">Kirish</button>
          </div>
        `}

        <!-- Tezkor amallar kartalari (Video qo'shish, Yangilik kiritish, Saqlanganlar) -->
        <div class="menu-quick-action-cards">
          <div class="menu-action-card" id="menuAddVideoCard" style="cursor: pointer;">
            <div class="menu-action-icon" style="color: var(--an-red); background: rgba(229, 9, 20, 0.12);">
              ${Icons.playCircle}
            </div>
            <div class="menu-action-info">
              <span class="menu-action-title">🎬 Video Qo‘shish (YouTube / Fayl)</span>
              <span class="menu-action-sub">YouTube havolasini qo‘yish yoki video yuklash</span>
            </div>
            <span class="cat-row-chevron">${Icons.chevronRight}</span>
          </div>

          <div class="menu-action-card" id="menuAddNewsCard" style="cursor: pointer;">
            <div class="menu-action-icon" style="color: #2563EB; background: rgba(37, 99, 235, 0.12);">
              ${Icons.edit}
            </div>
            <div class="menu-action-info">
              <span class="menu-action-title">✍️ Yangilik E’lon Qilish</span>
              <span class="menu-action-sub">Rasmli maqola va tezkor yangilik kiritish</span>
            </div>
            <span class="cat-row-chevron">${Icons.chevronRight}</span>
          </div>

          <div class="menu-action-card" data-tab-link="saved">
            <div class="menu-action-icon" style="color: #F59E0B; background: rgba(245, 158, 11, 0.12);">
              ${Icons.bookmark}
            </div>
            <div class="menu-action-info">
              <span class="menu-action-title">Saqlangan xabarlar</span>
              <span class="menu-action-sub">${savedCount} ta maqola saqlangan</span>
            </div>
            <span class="cat-row-chevron">${Icons.chevronRight}</span>
          </div>
        </div>

        <!-- Bo'limlar Ro'yxati -->
        <div class="categories-vertical-stack">
          ${categories.filter(c => c.id !== 'all' && c.id !== 'trend').map(c => `
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

        <!-- Markaziy Bank Rasmiy Valyuta Kurslari -->
        ${this.renderRatesWidget()}

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
          <a href="https://t.me" target="_blank" rel="noopener noreferrer" class="social-round-btn">
            <div class="social-circle-wrap sn-telegram">${Icons.telegram}</div>
            <span class="social-label">Telegram</span>
          </a>

          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" class="social-round-btn">
            <div class="social-circle-wrap sn-youtube">${Icons.youtube}</div>
            <span class="social-label">YouTube</span>
          </a>

          <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" class="social-round-btn">
            <div class="social-circle-wrap sn-tiktok">${Icons.tiktok}</div>
            <span class="social-label">TikTok</span>
          </a>

          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" class="social-round-btn">
            <div class="social-circle-wrap sn-instagram">${Icons.instagram}</div>
            <span class="social-label">Instagram</span>
          </a>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // TAB: SAQLANGAN XABARLAR (BOOKMARKS) EKRANI
  // -------------------------------------------------------------
  renderSavedView() {
    const savedIds = store.getSavedIds();
    const allNews = store.getNews();
    const savedList = allNews.filter(n => savedIds.includes(n.id));

    return `
      <div class="section-headline-bar">
        <h2 class="headline-text" style="display: flex; align-items: center; gap: 8px;">
          <span style="color: #F59E0B;">${Icons.bookmark}</span> Saqlangan xabarlar
        </h2>
        <span style="font-size: 11px; color: var(--text-dim);">${savedList.length} ta maqola</span>
      </div>

      ${savedList.length === 0 ? `
        <div class="empty-state-card">
          <div class="empty-state-icon">🔖</div>
          <h3 class="empty-state-title">Saqlangan xabarlar mavjud emas</h3>
          <p class="empty-state-desc">Maqolalarni o‘qish oynasida "Saqlash" tugmasini bosib, keyinroq o‘qish uchun shu yerga saqlab qo‘yishingiz mumkin.</p>
          <button class="btn-primary-red" data-tab-link="home" style="max-width: 240px; margin: 0 auto;">Bosh sahifaga o‘tish</button>
        </div>
      ` : `
        <div class="news-stream-container">
          ${savedList.map(n => `
            <div class="news-item-card" data-open-id="${n.id}">
              <img class="news-item-thumb" src="${n.imageUrl}" alt="${n.title}" />
              <div class="news-item-details">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                  <span class="hero-tag-badge" style="font-size: 9.5px; padding: 2px 7px;">${n.categoryName}</span>
                  <span style="font-size: 10px; color: var(--text-dim); margin-left: auto;">${n.time}</span>
                </div>
                <h4 class="news-item-title">${n.title}</h4>
                <div class="news-item-meta" style="margin-top: auto;">
                  <span>${Icons.eye} ${(n.views || 0).toLocaleString()}</span>
                  <button class="remove-saved-quick-btn" data-remove-saved="${n.id}" title="Saqlanganlardan o‘chirish" style="margin-left: auto; background: none; border: none; color: var(--text-dim); cursor: pointer; display: flex; align-items: center;">
                    ${Icons.trash}
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  // -------------------------------------------------------------
  // TAB 3: TRENDLAR EKRANI (Eng ko'p o'qilganlar reytingi)
  // -------------------------------------------------------------
  renderTrendView() {
    const list = store.getTrendingNews();
    if (list.length === 0) {
      return `
        <div class="empty-state-card" style="margin-top: 40px;">
          <div class="empty-state-icon">🔥</div>
          <h3 class="empty-state-title">Trenddagi xabarlar topilmadi</h3>
          <p class="empty-state-desc">Hozircha xabarlar yetarli emas.</p>
        </div>
      `;
    }

    const top1 = list[0];
    const remaining = list.slice(1);

    return `
      <div class="desktop-home-layout">
        <!-- Chap Asosiy Ustun -->
        <div class="desktop-main-column">
          <!-- 1. Trend Sarlavhasi -->
          <div class="trend-hero-header">
            <div class="trend-header-badge">
              <span class="flame-pulse-icon">🔥</span>
              <span>TOP TRENDLAR</span>
            </div>
            <h1 class="trend-main-heading">Eng ko‘p o‘qilgan yangiliklar</h1>
            <p class="trend-sub-heading">Real vaqt rejimida o‘quvchilar tomonidan eng ko‘p ko‘rilgan va ommabop xabarlar reytingi</p>
          </div>

          <!-- 2. #1 Grand Trend Kartasi (Mutlaq yetakchi xabar) -->
          ${top1 ? `
            <div class="trend-hero-card" data-open-id="${top1.id}">
              <div class="trend-hero-img-box">
                <img src="${top1.imageUrl}" alt="${top1.title}" class="trend-hero-img" loading="eager" />
                <div class="hero-card-gradient"></div>

                <div class="trend-hero-top-badges">
                  <span class="trend-crown-badge">🏆 #1 ENG OMMABOP</span>
                  <span class="trend-views-glow-pill">${Icons.eye} ${(top1.views || 0).toLocaleString()} ko‘rildi</span>
                </div>

                <div class="trend-hero-content">
                  <span class="hero-tag-badge">${top1.categoryName || 'ASOSIY'}</span>
                  <h2 class="trend-hero-title">${top1.title}</h2>
                  ${top1.summary ? `<p class="trend-hero-desc">${top1.summary}</p>` : ''}
                  <div class="trend-hero-meta">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span>${Icons.clock} ${top1.time}</span>
                      <span>${Icons.calendar} ${top1.date}</span>
                    </div>
                    <span class="trend-read-action">Batafsil o‘qish →</span>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- 3. Keyingi o'rinlar reytingi (2-o'rindan boshlab) -->
          <div class="section-headline-bar" style="margin-top: 28px; margin-bottom: 16px;">
            <h3 class="headline-text" style="display: flex; align-items: center; gap: 8px;">
              <span>📊</span> Ommaboplik reytingi (2–${list.length}-o‘rinlar)
            </h3>
            <span style="font-size: 11px; color: var(--text-dim);">Eng ko‘p o‘qilgan</span>
          </div>

          <div class="trend-stream-container">
            ${remaining.map((n, idx) => {
              const rank = idx + 2;
              const rankBadgeClass = rank === 2 ? 'rank-silver' : (rank === 3 ? 'rank-bronze' : 'rank-normal');
              const rankText = rank === 2 ? '🥈 #2' : (rank === 3 ? '🥉 #3' : `#${rank}`);
              return `
                <div class="trend-stream-card" data-open-id="${n.id}">
                  <div class="trend-rank-pillar ${rankBadgeClass}">
                    <span class="trend-pillar-num">${rankText}</span>
                  </div>
                  <img class="news-item-thumb" src="${n.imageUrl}" alt="${n.title}" loading="lazy" />
                  <div class="news-item-details">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                      <span class="hero-tag-badge" style="font-size: 9px; padding: 2px 6px;">${n.categoryName || 'Xabar'}</span>
                      <span style="font-size: 10.5px; color: var(--text-dim);">${n.date}</span>
                    </div>
                    <h4 class="news-item-title">${n.title}</h4>
                    <div class="trend-views-count-row">
                      <span class="trend-views-badge">${Icons.eye} ${(n.views || 0).toLocaleString()}</span>
                      <span style="font-size: 11px; color: var(--text-dim);">${Icons.clock} ${n.time}</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- O'ng Yon Panel (Desktop) -->
        <aside class="desktop-sidebar">
          <!-- Markaziy Bank Rasmiy Valyuta Kurslari -->
          ${this.renderRatesWidget()}

          <div class="sidebar-widget social-widget">
            <div class="widget-header">
              <h3 class="widget-title">Biz ijtimoiy tarmoqlarda</h3>
            </div>
            <div class="sidebar-social-links">
              <a href="https://t.me" target="_blank" class="social-pill-btn tg">
                ${Icons.telegram} <span>Telegram</span>
              </a>
              <a href="https://youtube.com" target="_blank" class="social-pill-btn yt">
                ${Icons.youtube} <span>YouTube</span>
              </a>
              <a href="https://instagram.com" target="_blank" class="social-pill-btn ig">
                ${Icons.instagram} <span>Instagram</span>
              </a>
            </div>
          </div>
        </aside>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // TAB 4: VIDEO YANGILIKLAR EKRANI
  // -------------------------------------------------------------
  renderVideoView() {
    const allNews = store.getNews();
    const videoList = allNews.filter(n => n.category === 'video' || n.videoUrl);

    if (videoList.length === 0) {
      return `
        <div class="empty-state-card" style="margin-top: 40px; text-align: center; padding: 40px 20px;">
          <div class="empty-state-icon" style="font-size: 40px; margin-bottom: 12px;">🎬</div>
          <h3 class="empty-state-title">Hozircha video yangiliklar yo‘q</h3>
          <p class="empty-state-desc">YouTube havolasini qo‘yib yoki o‘z video faylingizni yuklab yangi reportaj qo‘shishingiz mumkin.</p>
          <button class="btn-primary-red" id="videoEmptyAddBtn" style="max-width: 260px; margin: 16px auto 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            <span>🎬 YouTube / Video Qo‘shish</span>
          </button>
        </div>
      `;
    }

    return `
      <div class="section-headline-bar">
        <h2 class="headline-text" style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--an-red);">${Icons.playCircle}</span> Video yangiliklar & Reportajlar
        </h2>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; color: var(--text-dim);">${videoList.length} ta video</span>
          <button type="button" class="btn-outline-pill" id="videoHeaderAddBtn" style="padding: 4px 10px; font-size: 11px; border-color: var(--an-red); color: var(--an-red); font-weight: 700; cursor: pointer;">
            + Video Qo‘shish
          </button>
        </div>
      </div>

      <div class="videos-grid-container">
        ${videoList.map(v => `
          <div class="hero-card-banner video-card-item" data-open-id="${v.id}">
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

  // Maqola/Video media renderi (YouTube, Instagram, Telegram, Mahalliy fayl, Rasm)
  renderArticleMedia(article) {
    const isVideo = !!article.videoUrl || article.category === 'video';

    if (article.videoUrl) {
      const parsed = parseVideoEmbed(article.videoUrl) || {
        type: 'youtube',
        embedUrl: article.videoUrl,
        thumbnailUrl: article.imageUrl
      };

      // 1. YouTube video — Eng maqbul toza 16:9 Cinema yechimi! (Shorts uchun 9:16)
      if (parsed.type === 'youtube') {
        const isShort = parsed.isShort || article.videoUrl.includes('/shorts/') || article.aspectRatio === '9:16';
        return `
          <div class="youtube-cinema-frame ${isShort ? 'youtube-shorts-frame' : ''}" style="${isShort ? 'aspect-ratio: 9/16; max-width: 360px; margin: 0 auto 18px;' : ''}">
            <iframe
              id="activeArticleIframePlayer"
              src="${parsed.embedUrl}"
              class="youtube-cinema-iframe"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>
        `;
      }

      // 2. Instagram Reels / Post
      if (parsed.type === 'instagram') {
        return `
          <div class="embed-social-wrap instagram-embed-wrap">
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
          <div class="embed-social-wrap telegram-embed-wrap">
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

      // 4. Mahalliy video (IndexedDB) yoki to'g'ridan-to'g'ri MP4 / WebM
      const fileId = article.videoUrl.startsWith('idb://') ? article.videoUrl.replace('idb://', '') : null;
      const videoSrc = fileId ? (mediaDb.getCachedUrl(fileId) || '') : (parsed?.embedUrl || article.videoUrl);

      return `
        <div class="local-cinema-frame">
          <video
            id="activeArticleVideoPlayer"
            src="${videoSrc}"
            poster="${article.imageUrl}"
            controls
            autoplay
            playsinline
            class="local-clean-video"
          ></video>
        </div>
      `;
    }

    // 5. Rasmli xabar (Estetik, proporsional va o'lchamga moslashuvchan)
    const activeRatio = this.activePhotoRatio || article.aspectRatio || '16:9';
    const normRatio = activeRatio.replace(':', '-');

    return `
      <div class="article-photo-frame ratio-${normRatio}" id="activeArticlePhotoFrame">
        <div class="article-photo-backdrop" style="background-image: url('${article.imageUrl}');"></div>
        <img
          id="activeArticleCleanPhoto"
          src="${article.imageUrl}"
          alt="${article.title}"
          class="article-clean-photo ratio-${normRatio}"
          title="Bosing: Asl o‘lcham / 16:9 o‘rtasida almashtirish"
          loading="eager"
        />
        <div class="article-photo-toolbar">
          <div class="photo-toolbar-glass">
            <button
              type="button"
              class="photo-ratio-btn ${activeRatio === '16:9' ? 'active' : ''}"
              data-set-photo-ratio="16:9"
              title="16:9 (Standart keng format)"
            >
              🖥️ 16:9
            </button>
            <button
              type="button"
              class="photo-ratio-btn ${activeRatio === '3:4' ? 'active' : ''}"
              data-set-photo-ratio="3:4"
              title="3:4 (Portret / 3 ga 4)"
            >
              📷 3:4
            </button>
            <button
              type="button"
              class="photo-ratio-btn ${activeRatio === '1:1' ? 'active' : ''}"
              data-set-photo-ratio="1:1"
              title="1:1 (Kvadrat)"
            >
              ⏹️ 1:1
            </button>
            <button
              type="button"
              class="photo-ratio-btn ${activeRatio === 'auto' ? 'active' : ''}"
              data-set-photo-ratio="auto"
              title="Asl o‘lcham (To‘liq ko‘rish)"
            >
              🔍 Asl o‘lcham
            </button>
          </div>
        </div>
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
    const layout = article.mediaLayout || 'top';
    const isVideo = !!article.videoUrl || article.category === 'video';
    const activeRatio = this.activePhotoRatio || article.aspectRatio || '16:9';

    const badgesHtml = `
      <div class="article-badges-row">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span class="hero-tag-badge">${article.categoryName}</span>
          ${article.source ? `<span class="source-badge">Manba: ${article.source}</span>` : ''}
          <span class="source-badge" id="articleRatioBadge" style="background: rgba(229, 9, 20, 0.12); color: var(--an-red);">📐 ${activeRatio}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span>${Icons.clock} ${article.time} • ${article.date}</span>
          <span>${Icons.eye} ${article.views.toLocaleString()}</span>
        </div>
      </div>
    `;

    const titleHtml = `<h1 class="article-title-text">${article.title}</h1>`;
    const leadHtml = article.summary ? `<div class="article-lead-summary">${article.summary}</div>` : '';
    const mediaHtml = this.renderArticleMedia(article);

    const bodyContentHtml = `
      <!-- Audio Player (Ovozli eshitish) -->
      <div class="audio-listening-panel">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700;">
          <span>🔊</span> <span>Ovozli eshitish</span>
        </div>
        <button class="audio-play-pill" id="articleAudioBtn">
          ${this.isAudioPlaying ? 'To‘xtatish' : 'Tinglash (Play)'}
        </button>
      </div>

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
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="tool-action-btn ${isSaved ? 'saved' : ''}" id="articleBookmarkBtn">
            ${Icons.bookmark} <span>${isSaved ? 'Saqlangan' : 'Saqlash'}</span>
          </button>
          <button class="tool-action-btn" id="articleShareBtn">
            ${Icons.share} <span>Ulashish</span>
          </button>
          <button class="tool-action-btn delete-btn-tool" id="articleDeleteBtn" data-article-del-id="${article.id}" style="color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.35);" title="Ushbu maqolani bazadan butunlay o‘chirish">
            ${Icons.trash} <span>O‘chirish</span>
          </button>
        </div>

        <button class="tool-action-btn" id="articleBackBtn">
          <span>← Orqaga</span>
        </button>
      </div>
    `;

    return `
      <div class="article-reader-backdrop open" id="articleBackdrop">
        <div class="article-reader-modal modal-size-${this.articleModalSize} ${layout === 'cinematic' ? 'layout-cinematic' : ''}" id="articleReaderModal">
          <!-- Oyna Yuqori Paneli: Faqat Katta / Kichik / Standart va Yopish -->
          <div class="modal-window-header">
            <div class="modal-header-left">
              ${isVideo ? `
                <span class="video-mode-badge">
                  <span class="pulse-dot"></span> 🎬 VIDEO REPORTAJ
                </span>
              ` : `
                <span class="article-mode-badge">📰 YANGILIK</span>
              `}
            </div>

            <!-- Segmented Switch: Standart | Katta Kino -->
            <div class="modal-size-controls">
              <button class="modal-size-btn ${this.articleModalSize === 'normal' ? 'active' : ''}" id="modalSizeNormal" title="Standart o‘lcham (840px)">
                📺 Standart
              </button>
              <button class="modal-size-btn ${this.articleModalSize === 'theater' ? 'active' : ''}" id="modalSizeTheater" title="Katta kino rejimi (1060px)">
                🎬 Katta kino
              </button>
            </div>

            <button class="close-modal-round" id="closeReaderBtn" title="Yopish (Esc)">${Icons.close}</button>
          </div>

          ${layout === 'text_first' ? `
            <div class="article-text-body" style="padding-bottom: 12px;">
              ${badgesHtml}
              ${titleHtml}
              ${leadHtml}
            </div>
            ${mediaHtml}
            <div class="article-text-body" style="padding-top: 14px;">
              ${bodyContentHtml}
            </div>
          ` : `
            ${mediaHtml}
            <div class="article-text-body">
              ${badgesHtml}
              ${titleHtml}
              ${leadHtml}
              ${bodyContentHtml}
            </div>
          `}
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
    const user = store.getUser();

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
                  <input type="text" id="cfNewsAuthor" class="form-input" value="${user ? user.name : 'ANTIVIRUS Tahririyati'}" />
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
                <label class="form-label">Rasm Formati (3 ga 4, 16 ga 9, Kvadrat)</label>
                <div class="ratio-selector-bar">
                  <button type="button" class="ratio-pill-btn ${this.selectedNewsRatio === '16:9' ? 'active' : ''}" data-news-ratio="16:9">🖥️ 16:9 (Keng)</button>
                  <button type="button" class="ratio-pill-btn ${this.selectedNewsRatio === '3:4' ? 'active' : ''}" data-news-ratio="3:4">📷 3:4 (Portret / 3 ga 4)</button>
                  <button type="button" class="ratio-pill-btn ${this.selectedNewsRatio === '1:1' ? 'active' : ''}" data-news-ratio="1:1">⏹️ 1:1 (Kvadrat)</button>
                  <button type="button" class="ratio-pill-btn ${this.selectedNewsRatio === 'auto' ? 'active' : ''}" data-news-ratio="auto">⚡ Avto</button>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Joylashuv Tartibi</label>
                <div class="layout-selector-bar">
                  <button type="button" class="layout-pill-btn ${this.selectedNewsLayout === 'top' ? 'active' : ''}" data-news-layout="top">Tepada (Klassik)</button>
                  <button type="button" class="layout-pill-btn ${this.selectedNewsLayout === 'cinematic' ? 'active' : ''}" data-news-layout="cinematic">Kinematik Fon</button>
                  <button type="button" class="layout-pill-btn ${this.selectedNewsLayout === 'text_first' ? 'active' : ''}" data-news-layout="text_first">Avval Sarlavha</button>
                </div>
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

              <!-- FORMAT TANLOVI: 3:4, 16:9, 9:16 -->
              <div class="form-group">
                <label class="form-label">Video Formati (3 ga 4, 16 ga 9, 9 ga 16)</label>
                <div class="ratio-selector-bar">
                  <button type="button" class="ratio-pill-btn ${this.selectedVideoRatio === '16:9' ? 'active' : ''}" data-video-ratio="16:9">🖥️ 16:9 (Gorizontal / YouTube)</button>
                  <button type="button" class="ratio-pill-btn ${this.selectedVideoRatio === '3:4' ? 'active' : ''}" data-video-ratio="3:4">📷 3:4 (Portret / Mobil)</button>
                  <button type="button" class="ratio-pill-btn ${this.selectedVideoRatio === '9:16' ? 'active' : ''}" data-video-ratio="9:16">📱 9:16 (Shorts / Reels)</button>
                  <button type="button" class="ratio-pill-btn ${this.selectedVideoRatio === '1:1' ? 'active' : ''}" data-video-ratio="1:1">⏹️ 1:1 (Kvadrat)</button>
                </div>
                <div style="font-size: 10.5px; color: var(--text-dim); margin-top: 3px;">
                  💡 Xira fon (Ambient) orqali video har qanday ekranda qora chiziqlarsiz va buglarsiz moslashadi!
                </div>
              </div>

              <!-- JOYLAHUV TARTIBI -->
              <div class="form-group">
                <label class="form-label">Joylashuv Tartibi</label>
                <div class="layout-selector-bar">
                  <button type="button" class="layout-pill-btn ${this.selectedVideoLayout === 'top' ? 'active' : ''}" data-video-layout="top">Tepada (Klassik)</button>
                  <button type="button" class="layout-pill-btn ${this.selectedVideoLayout === 'cinematic' ? 'active' : ''}" data-video-layout="cinematic">Kinematik Fon</button>
                  <button type="button" class="layout-pill-btn ${this.selectedVideoLayout === 'text_first' ? 'active' : ''}" data-video-layout="text_first">Avval Sarlavha</button>
                </div>
              </div>

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
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                <span class="form-label" style="margin-bottom: 0;">Bazadagi barcha xabarlar (${newsList.length})</span>
                <button type="button" class="btn-del-sm" id="cfPurgeAllDemosBtn" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 5px 12px; font-weight: 700; cursor: pointer; border-radius: 6px;">
                  🧹 Demo xabarlarni tozalash
                </button>
              </div>

              <div class="admin-news-table-wrap">
                ${newsList.length === 0 ? `
                  <div style="text-align: center; padding: 36px 16px; color: var(--text-dim); font-size: 13px;">
                    📭 Bazada yangiliklar yo‘q. Yangi maqola yoki video kiritishingiz mumkin.
                  </div>
                ` : newsList.map(n => `
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
                    <button type="button" class="btn-del-sm" data-del-news-id="${n.id}" title="Ushbu yangilikni bazadan butunlay o‘chirish">O‘chirish</button>
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
  // 7. GOOGLE & ANTIVIRUS ID AUTH OYNASI (KIRISH VA TEZKOR RO'YXATDAN O'TISH)
  // -------------------------------------------------------------
  renderGoogleAuthModal() {
    if (!this.isAuthModalOpen) return '';

    const user = store.getUser();
    const clientId = store.getGoogleClientId();
    const savedCount = store.getSavedIds().length;

    return `
      <div class="article-reader-backdrop open" id="authModalBackdrop">
        <div class="article-reader-modal auth-modal-dialog" id="authModalDialog" style="max-width: 440px; padding: 0; overflow: hidden; border-radius: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.45);">
          <!-- Modal Header -->
          <div class="auth-modal-header">
            <div class="auth-header-brand">
              <div class="auth-brand-badge">AN</div>
              <div>
                <h3 class="auth-header-title">ANTIVIRUS ID</h3>
                <p class="auth-header-sub">Shaxsiy hisob va tezkor tizim</p>
              </div>
            </div>
            <button type="button" class="close-modal-round" id="closeAuthModalBtn">✕</button>
          </div>

          ${user ? `
            <!-- ALLAQACHON TIZIMGA KIRGAN HOLAT -->
            <div class="admin-modal-body" style="padding: 24px 20px 20px;">
              <div class="auth-logged-in-box">
                <img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'}" class="auth-avatar-preview" alt="${user.name}" />
                <h4 style="margin: 12px 0 2px; font-weight: 800; font-size: 18px; color: var(--text-main);">${user.name}</h4>
                <div style="font-size: 13px; color: var(--text-dim); margin-bottom: 6px;">
                  ${user.email || (user.username ? '@' + user.username : 'ANTIVIRUS Foydalanuvchi')}
                </div>
                
                <div style="display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;">
                  ${user.provider === 'google' ? `
                    <div class="google-verified-badge">${Icons.google} <span>Google orqali faol</span></div>
                  ` : `
                    <div class="google-verified-badge" style="color: var(--an-red); background: rgba(229, 9, 20, 0.1);">
                      <span>🛡️ ANTIVIRUS ID</span>
                    </div>
                  `}
                  <span class="user-id-badge">${user.id || ('#' + (user.username || 'user'))}</span>
                </div>

                <div style="background: var(--bg-pill); padding: 10px 14px; border-radius: 12px; margin-bottom: 16px; font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-around;">
                  <span>🔖 Saqlanganlar: <b>${savedCount} ta</b></span>
                  <span>🛡️ Holat: <b style="color: #22C55E;">Onlayn</b></span>
                </div>

                <div style="display: flex; gap: 8px;">
                  <button type="button" class="btn-primary-red" id="modalAuthContinueBtn" style="flex: 1;">
                    ✓ Davom etish
                  </button>
                  <button type="button" class="btn-outline-pill" id="modalAuthLogoutBtn" style="border-color: #EF4444; color: #EF4444;">
                    Chiqish
                  </button>
                </div>
              </div>
            </div>
          ` : `
            <!-- 2 TA ZAMONAVIY REJIM TABI (KIRISH VA TEZKOR RO'YXATDAN O'TISH) -->
            <div class="auth-segmented-nav">
              <button type="button" class="auth-segment-btn ${this.authModalTab === 'login' ? 'active' : ''}" id="authTabLoginBtn">
                🔑 Kirish
              </button>
              <button type="button" class="auth-segment-btn ${this.authModalTab === 'register' ? 'active' : ''}" id="authTabRegisterBtn">
                🚀 Tezkor Ro‘yxatdan O‘tish
              </button>
            </div>

            <div class="admin-modal-body" style="padding: 14px 20px 20px;">
              ${this.authModalTab === 'login' ? `
                <!-- 1. KIRISH REJIMI -->
                <div class="auth-form-wrap">
                  <div class="auth-field-group">
                    <label class="auth-field-label">Ismingiz yoki Taxallusingiz (@login)</label>
                    <div class="auth-input-wrapper">
                      <span class="auth-input-icon">👤</span>
                      <input
                        type="text"
                        id="authLoginInput"
                        class="auth-text-input"
                        placeholder="Masalan: azamat yoki sardor"
                        autocomplete="username"
                      />
                    </div>
                    <div class="auth-live-feedback">Oldin ro‘yxatdan o‘tgan ism yoki taxallusingizni kiriting</div>
                  </div>

                  <button type="button" class="btn-primary-red auth-submit-btn" id="submitLoginBtn">
                    <span>🔑 Tizimga Kirish</span>
                  </button>

                  <div class="auth-divider">
                    <span>YOKI GOOGLE BILAN</span>
                  </div>

                  <!-- Rasmiy Google Identity Tugmasi -->
                  <div id="googleOfficialBtnContainer" style="display: flex; justify-content: center; margin-bottom: 6px; min-height: 40px;"></div>

                  <!-- 1-Click Tezkor Google Kirish Tugmasi -->
                  <button type="button" class="btn-google-action" id="fastGoogleLoginBtn">
                    ${Icons.google}
                    <span>Google hisobim bilan kirish</span>
                  </button>

                  <div class="auth-switch-prompt">
                    Hali hisobingiz yo‘qmi?
                    <button type="button" class="auth-switch-link" id="switchToRegBtn">Tezkor ro‘yxatdan o‘tish</button>
                  </div>
                </div>
              ` : (this.authModalTab === 'register' ? `
                <!-- 2. TEZKOR RO'YXATDAN O'TISH REJIMI -->
                <div class="auth-form-wrap">
                  <div class="auth-info-banner">
                    ✨ Istalgan nom tanlang! Har bir foydalanuvchiga <b>takrorlanmas unikal ID</b> beriladi va barcha ma’lumotlaringiz (saqlanganlar, maqolalar) profilingizda to‘g‘ri saqlanadi.
                  </div>

                  <div class="auth-field-group">
                    <label class="auth-field-label">
                      <span>Unikal Taxallus / Ism (Login)</span>
                      <span class="auth-status-badge" id="authRegStatusBadge">Majburiy</span>
                    </label>
                    <div class="auth-input-wrapper">
                      <span class="auth-input-icon">@</span>
                      <input
                        type="text"
                        id="authRegUsernameInput"
                        class="auth-text-input"
                        placeholder="Masalan: azamat, sardor, media..."
                        autocomplete="off"
                      />
                    </div>
                    <div class="auth-live-feedback" id="authRegLiveFeedback">Ism yoki taxallus kiriting (takrorlanmaydigan bo‘lishi shart)</div>
                  </div>

                  <div class="auth-field-group">
                    <label class="auth-field-label">To‘liq Ismingiz (Maqolalarda ko‘rinadi)</label>
                    <div class="auth-input-wrapper">
                      <span class="auth-input-icon">✍️</span>
                      <input
                        type="text"
                        id="authRegDisplayNameInput"
                        class="auth-text-input"
                        placeholder="Masalan: Azamat Karimov"
                      />
                    </div>
                  </div>

                  <!-- Avatar tanlash qatori -->
                  <div class="auth-field-group">
                    <label class="auth-field-label">Profil Avatari (Bosing va tanlang)</label>
                    <div class="auth-avatars-row">
                      ${this.avatarPresets.map((url, idx) => `
                        <img
                          src="${url}"
                          class="auth-avatar-choice ${this.selectedAvatarIndex === idx ? 'selected' : ''}"
                          data-avatar-preset-idx="${idx}"
                          alt="Avatar ${idx + 1}"
                          title="Avatar ${idx + 1}"
                        />
                      `).join('')}
                    </div>
                  </div>

                  <button type="button" class="btn-primary-red auth-submit-btn" id="submitRegisterBtn">
                    <span>🚀 Ro‘yxatdan O‘tish va Kirish</span>
                  </button>

                  <div class="auth-divider">
                    <span>YOKI GOOGLE BILAN</span>
                  </div>

                  <button type="button" class="btn-google-action" id="fastGoogleRegBtn">
                    ${Icons.google}
                    <span>Google orqali 1-bosishda ochish</span>
                  </button>

                  <div class="auth-switch-prompt">
                    Allaqachon hisobingiz bormi?
                    <button type="button" class="auth-switch-link" id="switchToLoginBtn">Kirish</button>
                  </div>
                </div>
              ` : `
                <!-- DEVELOPER / GOOGLE CLIENT ID SOZLAMASI -->
                <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 12px; line-height: 1.4;">
                  Google OAuth 2.0 Web Client ID sozlamasi:
                </div>

                <div class="form-group">
                  <label class="form-label">Google OAuth 2.0 Web Client ID</label>
                  <input
                    type="text"
                    id="googleClientIdInput"
                    class="form-input"
                    value="${clientId}"
                  />
                </div>

                <div style="display: flex; gap: 8px;">
                  <button type="button" class="btn-primary-red" id="saveGoogleClientIdBtn" style="flex: 1;">
                    <span>💾 Saqlash</span>
                  </button>
                  <button type="button" class="btn-outline-pill" id="backToLoginTabBtn">
                    ← Orqaga
                  </button>
                </div>
              `)}

              <!-- Pastki mayda sozlama havolasi -->
              <div style="text-align: center; margin-top: 14px;">
                <button type="button" id="openDevSettingsBtn" style="background: none; border: none; font-size: 10.5px; color: var(--text-dim); cursor: pointer; text-decoration: underline; font-family: inherit;">
                  ⚙️ Google OAuth sozlamasi
                </button>
              </div>
            </div>
          `}
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

    // 2. Interaktiv Qidiruv Satri
    const triggerSearch = () => {
      this.isSearchOpen = !this.isSearchOpen;
      this.isNotifOpen = false;
      this.render();
      if (this.isSearchOpen) {
        setTimeout(() => {
          const input = document.getElementById('headerSearchInput');
          input?.focus();
        }, 50);
      }
    };
    document.getElementById('searchTriggerBtn')?.addEventListener('click', triggerSearch);
    document.getElementById('menuSearchBtn')?.addEventListener('click', () => {
      this.isSearchOpen = true;
      this.isNotifOpen = false;
      this.render();
      setTimeout(() => {
        const input = document.getElementById('headerSearchInput');
        input?.focus();
      }, 50);
    });

    const searchInput = document.getElementById('headerSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const trimmed = val.trim();
        if (trimmed.toLowerCase() === 'admin' || trimmed.toLowerCase() === '/admin' || trimmed.toLowerCase() === 'baza') {
          this.isSearchOpen = false;
          this.openCfModal('stats');
          return;
        }
        this.searchQuery = trimmed;
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          if (this.currentTab !== 'home') this.currentTab = 'home';
          this.render();
          const newInput = document.getElementById('headerSearchInput');
          if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(newInput.value.length, newInput.value.length);
          }
        }, 220);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.isSearchOpen = false;
          this.searchQuery = '';
          this.render();
        }
      });
    }

    document.getElementById('headerSearchClearBtn')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.render();
      setTimeout(() => {
        const input = document.getElementById('headerSearchInput');
        input?.focus();
      }, 50);
    });

    document.getElementById('resetSearchQueryBtn')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.render();
    });
    document.getElementById('resetSearchQueryBtn2')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.render();
    });

    // 3. Zamonaviy Bildirishnomalar Paneli
    document.getElementById('notifBellBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isNotifOpen = !this.isNotifOpen;
      this.isSearchOpen = false;
      this.render();
    });

    document.getElementById('notifMarkAllReadBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const notifs = store.getNotifications().map(n => ({ ...n, read: true }));
      localStorage.setItem('antivirus_notifications', JSON.stringify(notifs));
      this.showToast('✅ Barcha bildirishnomalar o‘qildi');
      this.render();
    });

    // Tashqariga bosilganda bildirishnomalar va profil menyusini yopish, klaviatura boshqaruvi
    if (!this.hasGlobalListeners) {
      this.hasGlobalListeners = true;
      document.addEventListener('click', (e) => {
        let shouldRender = false;
        if (this.isNotifOpen && !e.target.closest('#notifDropdown') && !e.target.closest('#notifBellBtn')) {
          this.isNotifOpen = false;
          shouldRender = true;
        }
        if (this.isProfileDropdownOpen && !e.target.closest('.user-profile-header-wrap')) {
          this.isProfileDropdownOpen = false;
          shouldRender = true;
        }
        if (shouldRender) {
          this.render();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (this.isProfileDropdownOpen) {
            this.isProfileDropdownOpen = false;
            this.render();
          } else if (this.isAuthModalOpen) {
            this.closeAuthModal();
          } else if (this.isCfModalOpen) {
            this.closeCfModal();
          } else if (this.activeArticleId) {
            this.closeArticle();
          }
        }
      });
    }

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
      const rawTitle = document.getElementById('cfNewsTitle')?.value.trim();
      const category = document.getElementById('cfNewsCategory')?.value || 'jamiyat';
      const author = document.getElementById('cfNewsAuthor')?.value.trim() || 'ANTIVIRUS Tahririyati';
      const source = document.getElementById('cfNewsSource')?.value.trim() || 'ANTIVIRUS Tahririyati';
      const sourceUrl = document.getElementById('cfNewsSourceUrl')?.value.trim() || '';
      let imageUrl = document.getElementById('cfNewsImageUrl')?.value.trim() || this.pendingNewsImageUrl;
      const summary = document.getElementById('cfNewsSummary')?.value.trim();
      const content = document.getElementById('cfNewsContent')?.value.trim();
      const isHero = Boolean(document.getElementById('cfNewsIsHero')?.checked);
      const isTrending = Boolean(document.getElementById('cfNewsIsTrending')?.checked);

      // Agar rasm maydoni yoki manba maydoniga YouTube havolasi qo'yilgan bo'lsa, avtomatik video deb qabul qilamiz!
      let videoUrl = null;
      const checkVideo = (imageUrl && parseVideoEmbed(imageUrl)) || (sourceUrl && parseVideoEmbed(sourceUrl));
      if (checkVideo && (checkVideo.type === 'youtube' || checkVideo.type === 'instagram' || checkVideo.type === 'telegram' || checkVideo.type === 'video')) {
        videoUrl = checkVideo.embedUrl;
        if (checkVideo.thumbnailUrl && (!imageUrl || imageUrl.includes('youtube.com') || imageUrl.includes('youtu.be') || imageUrl === sourceUrl)) {
          imageUrl = checkVideo.thumbnailUrl;
        }
      }

      const title = rawTitle || (checkVideo ? 'YouTube Video Reportaj' : (summary ? summary.slice(0, 60) : 'Yangi Xabar'));

      this.showToast('⏳ Yangilik bazaga saqlanmoqda...');

      if (!imageUrl) {
        imageUrl = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80';
      }

      try {
        const created = await store.createNews({
          title,
          category: videoUrl ? 'video' : category,
          author,
          source: source || (checkVideo ? checkVideo.source : 'ANTIVIRUS Tahririyati'),
          sourceUrl: sourceUrl || (checkVideo ? checkVideo.originalUrl : ''),
          imageUrl,
          videoUrl,
          summary: summary || title,
          content: content || summary || title,
          isHero,
          isTrending,
          aspectRatio: this.selectedNewsRatio || (checkVideo?.isShort ? '9:16' : '16:9'),
          mediaLayout: this.selectedNewsLayout || 'top'
        });

        this.pendingNewsImageUrl = '';
        this.showToast('🎉 Yangilik muvaffaqiyatli e\'lon qilindi!');
        this.closeCfModal();
        if (created && created.id) {
          if (videoUrl) this.setTab('video');
          this.openArticle(created.id);
        }
      } catch (err) {
        console.error('Yangilik saqlashda xatolik:', err);
        this.showToast('⚠️ Saqlashda xatolik: ' + err.message);
      }
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
          const res = await processImageFile(file, 1200, 0.85);
          const dataUrl = typeof res === 'string' ? res : res.dataUrl;
          this.pendingNewsImageUrl = dataUrl;
          if (res.suggestedRatio) {
            this.selectedNewsRatio = res.suggestedRatio;
          }
          const input = document.getElementById('cfNewsImageUrl');
          if (input) input.value = dataUrl;
          this.showToast('🖼️ Rasm tanlandi va formati moslashtirildi!');
          this.render();
        } catch (err) {
          alert('Rasm yuklashda xatolik: ' + err.message);
        }
      }
    });

    // 9a-3. Rasmli xabar formati (16:9, 3:4, 1:1, auto) va joylashuv tartibini tanlash
    document.querySelectorAll('[data-news-ratio]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ratio = e.currentTarget.getAttribute('data-news-ratio');
        if (ratio) {
          this.selectedNewsRatio = ratio;
          this.render();
        }
      });
    });
    document.querySelectorAll('[data-news-layout]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const layout = e.currentTarget.getAttribute('data-news-layout');
        if (layout) {
          this.selectedNewsLayout = layout;
          this.render();
        }
      });
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

    // 9b-1b. Video formati (16:9, 3:4, 9:16, 1:1) va joylashuv tartibini tanlash
    document.querySelectorAll('[data-video-ratio]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ratio = e.currentTarget.getAttribute('data-video-ratio');
        if (ratio) {
          this.selectedVideoRatio = ratio;
          this.render();
        }
      });
    });
    document.querySelectorAll('[data-video-layout]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const layout = e.currentTarget.getAttribute('data-video-layout');
        if (layout) {
          this.selectedVideoLayout = layout;
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
          this.selectedVideoRatio = '16:9';
        } else if (type === 'ig') {
          if (urlInput) urlInput.value = 'https://www.instagram.com/reel/C3_sampleReel/';
          if (sourceInput) sourceInput.value = 'Instagram Reels';
          if (coverInput) coverInput.value = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=80';
          if (titleInput && !titleInput.value) titleInput.value = 'Instagram Reels: Texnologiya yangiliklari';
          this.selectedVideoRatio = '9:16';
        } else if (type === 'tg') {
          if (urlInput) urlInput.value = 'https://t.me/kunuzofficial/145829';
          if (sourceInput) sourceInput.value = 'Telegram (@kunuzofficial)';
          if (coverInput) coverInput.value = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';
          if (titleInput && !titleInput.value) titleInput.value = 'Telegram xabari: Kun yangiliklari reportaji';
          this.selectedVideoRatio = '3:4';
        } else if (type === 'mp4') {
          if (urlInput) urlInput.value = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
          if (sourceInput) sourceInput.value = 'Google Video Server';
          if (coverInput) coverInput.value = 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=1200&q=80';
          if (titleInput && !titleInput.value) titleInput.value = 'Yuqori Sifatli MP4 Video Reportaj';
          this.selectedVideoRatio = '16:9';
        }

        if (urlInput) {
          urlInput.dispatchEvent(new Event('input'));
        }
        this.render();
      });
    });

    // 9b-3. Video URL jonli tahlil qilish (Avtomatik manba, muqova, sarlavha va proportsiya aniqlash)
    const videoUrlEl = document.getElementById('cfVideoUrl');
    videoUrlEl?.addEventListener('input', async (e) => {
      const val = e.target.value.trim();
      const statusEl = document.getElementById('cfVideoUrlStatus');
      const sourceInput = document.getElementById('cfVideoSource');
      const coverInput = document.getElementById('cfVideoImageUrl');
      const titleInput = document.getElementById('cfVideoTitle');

      if (!val) {
        if (statusEl) statusEl.innerHTML = 'YouTube, Instagram yoki Telegram havolasini qo‘ying — pleyer avtomatik sozlanadi!';
        return;
      }

      const parsed = parseVideoEmbed(val);
      if (parsed) {
        if (parsed.type === 'youtube') {
          const isShort = parsed.isShort || val.includes('/shorts/');
          if (statusEl) statusEl.innerHTML = `<span style="color: #EF4444; font-weight: 700;">🔴 YouTube ${isShort ? 'Shorts (Vertikal)' : 'Video (16:9)'} aniqlandi • Pleyer va muqova tayyorlandi!</span>`;
          if (sourceInput && (!sourceInput.value || sourceInput.value === 'YouTube')) sourceInput.value = 'YouTube';
          if (coverInput && (!coverInput.value || coverInput.value.includes('img.youtube.com'))) {
            coverInput.value = parsed.thumbnailUrl;
            this.pendingVideoThumbnail = parsed.thumbnailUrl;
          }
          this.selectedVideoRatio = isShort ? '9:16' : '16:9';

          // Agar sarlavha bo'sh bo'lsa, YouTube oEmbed orqali asl video sarlavhasini olib kelamiz
          if (titleInput && !titleInput.value) {
            titleInput.placeholder = '⏳ Video sarlavhasi YouTubedan olinmoqda...';
            try {
              const meta = await fetchYouTubeMeta(parsed.videoId);
              if (meta && meta.title && !titleInput.value) {
                titleInput.value = meta.title;
                if (sourceInput && meta.author) sourceInput.value = `YouTube (${meta.author})`;
                if (statusEl) statusEl.innerHTML = `<span style="color: #22C55E; font-weight: 700;">✓ YouTube video va asl sarlavhasi muvaffaqiyatli yuklandi!</span>`;
              }
            } catch (err) {
              titleInput.placeholder = 'Video reportaj sarlavhasi...';
            }
          }
        } else if (parsed.type === 'instagram') {
          if (statusEl) statusEl.innerHTML = '<span style="color: #E1306C; font-weight: 700;">🟣 Instagram Reels / Post aniqlandi • 9:16 Vertikal pleyer sozlandi!</span>';
          if (sourceInput) sourceInput.value = 'Instagram';
          if (coverInput && !coverInput.value) coverInput.value = parsed.thumbnailUrl;
          this.selectedVideoRatio = '9:16';
        } else if (parsed.type === 'telegram') {
          if (statusEl) statusEl.innerHTML = '<span style="color: #0088CC; font-weight: 700;">🔵 Telegram posti aniqlandi • 3:4 Mobil vidjet tayyorlandi!</span>';
          if (sourceInput) sourceInput.value = parsed.source;
          if (coverInput && !coverInput.value) coverInput.value = parsed.thumbnailUrl;
          this.selectedVideoRatio = '3:4';
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
      this.showToast('⏳ Video fayl tahlil qilinmoqda (muqova va proportsiya)...');
      try {
        const meta = await captureVideoMetadata(file);
        this.pendingVideoFile = file;
        this.pendingVideoThumbnail = meta.thumbnailUrl;
        this.pendingVideoDuration = meta.durationFormatted || '01:30';
        if (meta.suggestedRatio) {
          this.selectedVideoRatio = meta.suggestedRatio;
        }

        const titleInput = document.getElementById('cfVideoTitle');
        if (titleInput && !titleInput.value) {
          titleInput.value = file.name.replace(/\.[^/.]+$/, '');
        }

        const durationInput = document.getElementById('cfVideoDuration');
        if (durationInput) durationInput.value = this.pendingVideoDuration;

        this.showToast(`✨ Video qabul qilindi! O‘lchami: ${meta.suggestedRatio || '16:9'} aniqlandi.`);
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
          const res = await processImageFile(file, 1200, 0.85);
          const dataUrl = typeof res === 'string' ? res : res.dataUrl;
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
      const rawTitle = document.getElementById('cfVideoTitle')?.value.trim();
      const rawSource = document.getElementById('cfVideoSource')?.value.trim();
      const duration = document.getElementById('cfVideoDuration')?.value.trim() || this.pendingVideoDuration || '03:45';
      let imageUrl = document.getElementById('cfVideoImageUrl')?.value.trim() || this.pendingVideoThumbnail;
      const summary = document.getElementById('cfVideoSummary')?.value.trim();
      const isHero = Boolean(document.getElementById('cfVideoIsHero')?.checked);
      const isTrending = Boolean(document.getElementById('cfVideoIsTrending')?.checked);

      let finalVideoUrl = '';
      let parsed = null;

      if (this.videoUploadMode === 'file') {
        // Fayldan yuklash
        if (!this.pendingVideoFile) {
          this.showToast('⚠️ Iltimos, video faylni tanlang!');
          return;
        }

        this.showToast('⏳ Video fayl mahalliy xotiraga (IndexedDB) saqlanmoqda...');
        const fileId = 'vid_' + Date.now();
        await mediaDb.saveMedia(fileId, this.pendingVideoFile, { title: rawTitle || this.pendingVideoFile.name });
        finalVideoUrl = 'idb://' + fileId;
      } else {
        // Havola orqali
        const rawVideoUrl = document.getElementById('cfVideoUrl')?.value.trim();
        if (!rawVideoUrl) {
          this.showToast('⚠️ Iltimos, video havolasini (YouTube, Instagram va b.) kiriting!');
          document.getElementById('cfVideoUrl')?.focus();
          return;
        }

        parsed = parseVideoEmbed(rawVideoUrl);
        finalVideoUrl = (parsed && parsed.embedUrl) || rawVideoUrl;

        if (!imageUrl && parsed && parsed.thumbnailUrl) {
          imageUrl = parsed.thumbnailUrl;
        }
      }

      // Title avtomatik kafolati — Foydalanuvchi sarlavha kiritmagan bo'lsa ham hech qachon to'xtamaydi!
      const title = rawTitle || (parsed?.type === 'youtube' ? `YouTube Video Reportaj • ${parsed.videoId || ''}` : (summary ? summary.slice(0, 60) : 'Yangi Video Reportaj'));
      const source = rawSource || (parsed?.source || 'YouTube');

      if (!imageUrl) {
        imageUrl = parsed?.thumbnailUrl || 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80';
      }

      this.showToast('🎬 Video bazaga saqlanmoqda...');

      try {
        const created = await store.createNews({
          title,
          category: 'video',
          categoryName: 'Video',
          videoUrl: finalVideoUrl,
          imageUrl,
          author: (store.getUser()?.name) || 'ANTIVIRUS Media',
          source,
          sourceUrl: this.videoUploadMode === 'url' ? (document.getElementById('cfVideoUrl')?.value.trim() || finalVideoUrl) : 'Qurilmadan yuklangan',
          readTime: duration,
          summary: summary || title,
          content: summary || title,
          isHero,
          isTrending,
          aspectRatio: this.selectedVideoRatio || (parsed?.isShort ? '9:16' : '16:9'),
          mediaLayout: this.selectedVideoLayout || 'top',
          tags: ['Video', source]
        });

        // Tozalash
        this.pendingVideoFile = null;
        this.pendingVideoThumbnail = null;
        this.pendingVideoUrl = '';

        this.showToast('🎬 Video muvaffaqiyatli saqlandi!');
        this.closeCfModal();
        this.setTab('video');
        if (created && created.id) {
          this.openArticle(created.id);
        }
      } catch (err) {
        console.error('Video saqlashda xatolik:', err);
        this.showToast('⚠️ Saqlashda xatolik: ' + err.message);
      }
    });

    // 9c. Maqolani o'chirish (Admin modal "Barchasi" ro'yxatidan butunlay o'chirish)
    document.querySelectorAll('[data-del-news-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-del-news-id');
        if (!id) return;

        btn.disabled = true;
        btn.textContent = '...';

        const article = store.getNewsById(id);
        if (article && article.videoUrl && article.videoUrl.startsWith('idb://')) {
          const fileId = article.videoUrl.replace('idb://', '');
          try { await mediaDb.deleteMedia(fileId); } catch {}
        }
        await store.deleteNews(id);
        this.showToast('🗑️ Maqola bazadan butunlay o‘chirildi');
        this.render();
      });
    });

    // 9e. Barcha demo xabarlarni bitta tugmada tozalash
    document.getElementById('cfPurgeAllDemosBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      store.purgeAllDemoNews();
      this.showToast('🧹 Barcha eski demo xabarlar butunlay tozalandi!');
      this.render();
    });

    // 9f. Bo'sh holatda birinchi yangilikni qo'shish tugmasi
    document.getElementById('emptyStateAddBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openCfModal('news');
    });

    // 9g. Video sahifasidan va Menyudan tezkor video/maqola qo'shish tugmalari
    document.getElementById('videoEmptyAddBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openCfModal('video');
    });
    document.getElementById('videoHeaderAddBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openCfModal('video');
    });
    document.getElementById('menuAddVideoCard')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openCfModal('video');
    });
    document.getElementById('menuAddNewsCard')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openCfModal('news');
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

    // 14a. Oyna o'lchamini o'zgartirish (Standart / Katta Kino) - Videoni to'xtatmasdan silliq o'tadi
    document.getElementById('modalSizeNormal')?.addEventListener('click', () => {
      this.setArticleModalSize('normal');
    });
    document.getElementById('modalSizeTheater')?.addEventListener('click', () => {
      this.setArticleModalSize(this.articleModalSize === 'theater' ? 'normal' : 'theater');
    });

    // 14b. Rasm nisbati (Aspect Ratio) ni o'zgartirish (16:9, 3:4, 1:1, auto)
    document.querySelectorAll('[data-set-photo-ratio]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ratio = e.currentTarget.getAttribute('data-set-photo-ratio');
        if (ratio) {
          this.setPhotoRatio(ratio);
        }
      });
    });

    // 14c. Rasm ustiga bosilganda Asl o'lcham va 16:9 o'rtasida tezkor almashish
    document.getElementById('activeArticleCleanPhoto')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = this.activePhotoRatio || '16:9';
      const next = current === '16:9' ? 'auto' : '16:9';
      this.setPhotoRatio(next);
      this.showToast(next === 'auto' ? '🔍 Asl o‘lcham (To‘liq ko‘rinish)' : '🖥️ 16:9 Standart keng format');
    });

    // 14d. Video ijro tezligi (Playback Rate)
    document.getElementById('vSpeedDropdown')?.addEventListener('change', (e) => {
      const rate = parseFloat(e.target.value) || 1.0;
      this.videoPlaybackRate = rate;
      const player = document.getElementById('activeArticleVideoPlayer');
      if (player) player.playbackRate = rate;
    });

    // 14e. Picture-in-Picture (Suzuvchi mini oyna)
    document.getElementById('vPipActionBtn')?.addEventListener('click', async () => {
      const video = document.getElementById('activeArticleVideoPlayer');
      if (video) {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else if (document.pictureInPictureEnabled) {
            await video.requestPictureInPicture();
          } else {
            alert('Brauzeringiz Picture-in-Picture (Mini oyna) funksiyasini qo‘llab-quvvatlamaydi.');
          }
        } catch (err) {
          console.warn('PiP xatolik:', err);
        }
      } else {
        alert('Ushbu video turi uchun mini oyna to‘g‘ridan-to‘g‘ri pleyerning o‘zida mavjud.');
      }
    });

    // 14f. Video to'liq ekran (Fullscreen)
    document.getElementById('vFullscreenActionBtn')?.addEventListener('click', () => {
      const wrapper = document.querySelector('.media-ambient-wrapper');
      if (wrapper) {
        if (!document.fullscreenElement) {
          wrapper.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    });

    // 14g. Pleyerga joriy tezlikni qo'llash
    const activeVideo = document.getElementById('activeArticleVideoPlayer');
    if (activeVideo && this.videoPlaybackRate) {
      activeVideo.playbackRate = this.videoPlaybackRate;
    }

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

    // 17b. Maqolani o'qish oynasidan (Reader Modal) to'g'ridan-to'g'ri o'chirish
    const articleDelBtn = document.getElementById('articleDeleteBtn');
    if (articleDelBtn) {
      articleDelBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = articleDelBtn.getAttribute('data-article-del-id');
        if (!id) return;

        articleDelBtn.disabled = true;
        articleDelBtn.innerHTML = `<span>O‘chirilmoqda...</span>`;

        const article = store.getNewsById(id);
        if (article && article.videoUrl && article.videoUrl.startsWith('idb://')) {
          const fileId = article.videoUrl.replace('idb://', '');
          try { await mediaDb.deleteMedia(fileId); } catch {}
        }
        await store.deleteNews(id);
        this.closeArticle();
        this.showToast('🗑️ Maqola bazadan butunlay o‘chirildi');
        this.render();
      });
    }

    // 18. Hero Slayder nuqtalarini bosish
    document.querySelectorAll('[data-slide-index]').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.currentTarget.getAttribute('data-slide-index'), 10);
        if (!isNaN(idx)) {
          this.setHeroSlide(idx);
          this.startHeroAutoPlay();
        }
      });
    });

    // 18b. Hero Slayder oldingi / keyingi tugmalari
    document.getElementById('heroPrevBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.prevHeroSlide();
      this.startHeroAutoPlay();
    });
    document.getElementById('heroNextBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextHeroSlide();
      this.startHeroAutoPlay();
    });

    // 18c. Hero Slayder ustiga sichqoncha kelganda avto-aylanishni to'xtatish (hover pause)
    const heroEl = document.getElementById('heroBannerCarousel');
    if (heroEl) {
      heroEl.addEventListener('mouseenter', () => this.stopHeroAutoPlay());
      heroEl.addEventListener('mouseleave', () => {
        if (this.currentTab === 'home' && !this.activeArticleId && !this.isCfModalOpen) {
          this.startHeroAutoPlay();
        }
      });
    }

    // 19. Saqlangan xabarlardan tezkor o'chirish
    document.querySelectorAll('[data-remove-saved]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-remove-saved');
        if (id) {
          store.toggleSaveNews(id);
          this.showToast('🗑️ Maqola saqlanganlardan olindi');
          this.render();
        }
      });
    });

    // 20. Google Auth & ANTIVIRUS ID (Kirish va Tezkor Ro'yxatdan o'tish)
    document.getElementById('desktopAdminBtn')?.addEventListener('click', () => {
      this.openCfModal('stats');
    });

    document.getElementById('headerGoogleLoginBtn')?.addEventListener('click', () => {
      this.openAuthModal('login');
    });

    document.getElementById('headerUserProfileBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleProfileDropdown();
    });

    document.getElementById('userMenuAddNewsBtn')?.addEventListener('click', () => {
      this.isProfileDropdownOpen = false;
      this.render();
      this.openCfModal('news');
    });

    document.getElementById('userMenuAddVideoBtn')?.addEventListener('click', () => {
      this.isProfileDropdownOpen = false;
      this.render();
      this.openCfModal('video');
    });

    document.getElementById('userMenuSavedBtn')?.addEventListener('click', () => {
      this.isProfileDropdownOpen = false;
      this.setTab('saved');
    });

    document.getElementById('userMenuAdminBtn')?.addEventListener('click', () => {
      this.isProfileDropdownOpen = false;
      this.render();
      this.openCfModal('stats');
    });

    document.getElementById('userLogoutBtn')?.addEventListener('click', () => {
      store.logout();
      this.isProfileDropdownOpen = false;
      this.isAuthModalOpen = false;
      this.showToast('🚪 Tizimdan chiqdingiz');
      this.render();
    });

    document.getElementById('menuGoogleLoginCard')?.addEventListener('click', () => {
      this.openAuthModal('login');
    });

    document.getElementById('menuLogoutBtn')?.addEventListener('click', () => {
      store.logout();
      this.showToast('🚪 Tizimdan chiqdingiz');
      this.render();
    });

    document.getElementById('closeAuthModalBtn')?.addEventListener('click', () => {
      this.closeAuthModal();
    });

    document.getElementById('authModalBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'authModalBackdrop') {
        this.closeAuthModal();
      }
    });

    // Tab almashtirish: Kirish vs Tezkor Ro'yxatdan o'tish
    document.getElementById('authTabLoginBtn')?.addEventListener('click', () => {
      this.authModalTab = 'login';
      this.render();
      this.setupGoogleIdentityBtn();
    });

    document.getElementById('authTabRegisterBtn')?.addEventListener('click', () => {
      this.authModalTab = 'register';
      this.render();
    });

    document.getElementById('switchToRegBtn')?.addEventListener('click', () => {
      this.authModalTab = 'register';
      this.render();
    });

    document.getElementById('switchToLoginBtn')?.addEventListener('click', () => {
      this.authModalTab = 'login';
      this.render();
      this.setupGoogleIdentityBtn();
    });

    document.getElementById('openDevSettingsBtn')?.addEventListener('click', () => {
      this.authModalTab = 'client_id';
      this.render();
    });

    document.getElementById('backToLoginTabBtn')?.addEventListener('click', () => {
      this.authModalTab = 'login';
      this.render();
      this.setupGoogleIdentityBtn();
    });

    // Avatar preset tanlash
    document.querySelectorAll('[data-avatar-preset-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-avatar-preset-idx'), 10);
        if (!isNaN(idx)) {
          this.selectedAvatarIndex = idx;
          document.querySelectorAll('.auth-avatar-choice').forEach((el, i) => {
            el.classList.toggle('selected', i === idx);
          });
        }
      });
    });

    // Tezkor Ro'yxatdan o'tishda nomning band yoki bo'shligini jonli tekshirish (Unique check)
    const regInput = document.getElementById('authRegUsernameInput');
    regInput?.addEventListener('input', (e) => {
      const raw = e.target.value.trim();
      const feedback = document.getElementById('authRegLiveFeedback');
      const badge = document.getElementById('authRegStatusBadge');
      if (!raw) {
        if (feedback) {
          feedback.className = 'auth-live-feedback';
          feedback.textContent = 'Ism yoki taxallus kiriting (takrorlanmaydigan bo‘lishi shart)';
        }
        if (badge) {
          badge.textContent = 'Majburiy';
          badge.style.color = 'var(--text-dim)';
        }
        return;
      }

      const clean = raw.toLowerCase().replace(/[^a-z0-9_.]/g, '');
      if (clean.length < 2) {
        if (feedback) {
          feedback.className = 'auth-live-feedback error';
          feedback.textContent = '⚠️ Ism/taxallus kamida 2 ta belgidan iborat bo‘lsin';
        }
        if (badge) {
          badge.textContent = 'Kalta ⚠️';
          badge.style.color = '#EF4444';
        }
        return;
      }

      const isTaken = store.isUsernameTaken(clean);
      if (isTaken) {
        if (feedback) {
          feedback.className = 'auth-live-feedback error';
          feedback.textContent = `❌ «${clean}» allaqachon band! Boshqa nom tanlang (masalan: ${clean}_uz, ${clean}7)`;
        }
        if (badge) {
          badge.textContent = 'Band ❌';
          badge.style.color = '#EF4444';
        }
      } else {
        if (feedback) {
          feedback.className = 'auth-live-feedback success';
          feedback.textContent = `✓ «${clean}» bo‘sh! Ushbu nom bilan unikal ID yaratiladi`;
        }
        if (badge) {
          badge.textContent = 'Bo‘sh ✓';
          badge.style.color = '#22C55E';
        }
      }
    });

    // 1. Tizimga Kirish tugmasi
    document.getElementById('submitLoginBtn')?.addEventListener('click', () => {
      const identifier = document.getElementById('authLoginInput')?.value.trim();
      const result = store.loginUser(identifier);
      if (result.ok) {
        this.closeAuthModal();
        this.showToast(`🎉 Xush kelibsiz, ${result.user.name}!`);
      } else {
        this.showToast(`⚠️ ${result.error}`);
      }
    });

    // 2. Tezkor Ro'yxatdan o'tish tugmasi
    document.getElementById('submitRegisterBtn')?.addEventListener('click', () => {
      const username = document.getElementById('authRegUsernameInput')?.value.trim();
      const displayName = document.getElementById('authRegDisplayNameInput')?.value.trim();
      const avatar = this.avatarPresets[this.selectedAvatarIndex] || this.avatarPresets[0];

      const result = store.registerUser({ username, name: displayName, avatar });
      if (result.ok) {
        this.closeAuthModal();
        this.showToast(`🎉 Tabriklaymiz, @${result.user.username}! Sizga unikal ID (${result.user.id}) biriktirildi.`);
      } else {
        this.showToast(`⚠️ ${result.error}`);
      }
    });

    // Enter klavishasi bilan qulay yuborish
    document.getElementById('authLoginInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('submitLoginBtn')?.click();
    });
    document.getElementById('authRegUsernameInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('submitRegisterBtn')?.click();
    });

    document.getElementById('modalAuthContinueBtn')?.addEventListener('click', () => {
      this.closeAuthModal();
    });

    document.getElementById('modalAuthLogoutBtn')?.addEventListener('click', () => {
      store.logout();
      this.isAuthModalOpen = false;
      this.isProfileDropdownOpen = false;
      this.showToast('🚪 Tizimdan chiqdingiz');
      this.render();
    });

    // Google Client ID sozlamasini saqlash
    document.getElementById('saveGoogleClientIdBtn')?.addEventListener('click', () => {
      const input = document.getElementById('googleClientIdInput');
      const val = input ? input.value.trim() : '';
      if (!val) {
        this.showToast('⚠️ Iltimos, Google Client ID kiriting');
        return;
      }
      store.setGoogleClientId(val);
      this.authModalTab = 'login';
      this.showToast('✅ Google Client ID muvaffaqiyatli saqlandi!');
      this.render();
      this.setupGoogleIdentityBtn();
    });

    // Tezkor Google kirish / ro'yxatdan o'tish funksiyasi
    const handleFastGoogle = () => {
      const promptName = prompt('Google hisobingizdagi ismingizni kiriting:', 'Foydalanuvchi');
      if (promptName === null) return;
      const name = promptName.trim() || 'Google Foydalanuvchi';
      const cleanSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'user';
      const email = `${cleanSlug}@gmail.com`;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const userObj = {
        id: 'g_' + cleanSlug + '_' + randomSuffix,
        username: cleanSlug,
        name,
        email,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
        provider: 'google',
        verified: true
      };
      store.setUser(userObj);
      this.closeAuthModal();
      this.showToast(`🎉 Xush kelibsiz, ${name}!`);
    };

    document.getElementById('fastGoogleLoginBtn')?.addEventListener('click', handleFastGoogle);
    document.getElementById('fastGoogleRegBtn')?.addEventListener('click', handleFastGoogle);
  }
}

// Ishga tushirish (xavfsiz va darhol)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.antivirusApp = new AntivirusApp();
    });
  } else {
    window.antivirusApp = new AntivirusApp();
  }
}
