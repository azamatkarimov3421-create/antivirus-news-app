// ANTIVIRUS NEWS - Boshlang'ich ma'lumotlar bazasi

export const INITIAL_CATEGORIES = [
  { id: 'all', name: 'Asosiy', icon: 'home', color: '#E50914' },
  { id: 'siyosat', name: 'Siyosat', icon: 'landmark', color: '#E50914' },
  { id: 'dunyo', name: 'Dunyo', icon: 'globe', color: '#2563EB' },
  { id: 'jamiyat', name: 'Jamiyat', icon: 'users', color: '#DC2626' },
  { id: 'biznes', name: 'Biznes', icon: 'bar-chart', color: '#EA580C' },
  { id: 'texnologiya', name: 'Texnologiya', icon: 'cpu', color: '#0284C7' },
  { id: 'sport', name: 'Sport', icon: 'trophy', color: '#16A34A' },
  { id: 'video', name: 'Video', icon: 'play-circle', color: '#E50914' },
  { id: 'tahlil', name: 'Tahlil', icon: 'file-text', color: '#475569' },
  { id: 'foto', name: 'Foto galereya', icon: 'image', color: '#059669' }
];

export const INITIAL_NEWS = [];


export const INITIAL_CURRENCIES = [
  { code: 'USD', rate: '12 850.00', diff: '+15.20', isUp: true },
  { code: 'EUR', rate: '13 920.50', diff: '-8.40', isUp: false },
  { code: 'RUB', rate: '138.20', diff: '+0.50', isUp: true }
];

export const INITIAL_ADS = [
  {
    id: 'ad-01',
    title: 'CyberShield Pro — Bank va biznesingiz uchun 24/7 kiberxavfsizlik',
    sponsor: 'Hamkor reklama',
    imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    link: '#reklama',
    placement: 'desktop-header'
  },
  {
    id: 'ad-02',
    title: 'ANTIVIRUS Mobil ilovasi — App Store va Google Play’da!',
    sponsor: 'Rasmiy tavsiya',
    imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80',
    link: '#app-download',
    placement: 'mobile-feed'
  }
];
