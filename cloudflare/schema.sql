-- ============================================================================
-- ANTIVIRUS NEWS — Cloudflare D1 Database Schema & Initial Data
-- ============================================================================

-- 1. Yangiliklar Jadvali
CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  time TEXT NOT NULL,
  date TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  is_hero INTEGER DEFAULT 0,
  is_trending INTEGER DEFAULT 0,
  image_url TEXT,
  summary TEXT,
  content TEXT,
  author TEXT,
  read_time TEXT,
  tags TEXT,
  video_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Dastlabki Asosiy Yangiliklar
INSERT OR IGNORE INTO news (id, title, category, category_name, time, date, views, is_hero, is_trending, image_url, summary, content, author, read_time, tags)
VALUES
(
  'an-001',
  'Shavkat Mirziyoyev Gurbanguli Berdimuxamedov bilan telefonda gaplashdi',
  'jamiyat',
  'Jamiyat',
  '18:54',
  '12.10.2026',
  38245,
  1,
  1,
  'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
  'O‘zbekiston Respublikasi Prezidenti Shavkat Mirziyoyev va Turkman xalqining milliy yetakchisi, Xalq Maslahati Raisi Gurbanguli Berdimuhamedov o‘rtasida telefon orqali muloqot bo‘lib o‘tdi.',
  'O‘zbekiston Respublikasi Prezidenti Shavkat Mirziyoyev va Turkman xalqining milliy yetakchisi, Turkmaniston Xalq Maslahati Raisi Gurbanguli Berdimuhamedov o‘rtasida do‘stona telefon orqali muloqot bo‘lib o‘tdi. Muloqot davomida ikki tomonlama do‘stlik, yaxshi qo‘shnichilik va strategik sheriklik munosabatlarini yanada mustahkamlash masalalari atroflicha muhokama qilindi.',
  'ANTIVIRUS Tahririyati',
  '3 daqiqa',
  'O‘zbekiston,Turkmaniston,Prezident,Muloqot'
),
(
  'an-002',
  'O‘zbekistonda Chery Tiggo 4 Pro sotuvi boshlandi',
  'biznes',
  'Biznes',
  '15:41',
  '12.10.2026',
  12541,
  0,
  1,
  'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
  'Yangi ixcham krossover mahalliy bozor uchun moslashtirilgan komplektatsiyalar va zamonaviy xavfsizlik funksiyalari bilan rasmiy dilerlik markazlariga yetkazib berila boshlandi.',
  'O‘zbekiston avtomobil bozorida rasmiy brendlardan biri hisoblangan Chery o‘zining mashhur Tiggo 4 Pro ixcham krossoverining yangilangan versiyasini taqdim etdi.',
  'Avto Sharh',
  '2 daqiqa',
  'Chery,Avtomobil,Bozor,Biznes'
),
(
  'an-003',
  'Samarqandda stomatologik xab tashkil etiladi: tibbiy ta’lim, klinik amaliyot va innovatsiya',
  'jamiyat',
  'Jamiyat',
  '14:20',
  '12.10.2026',
  8912,
  0,
  0,
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
  'Xalqaro standartlarga javob beradigan zamonaviy stomatologiya klasteri Markaziy Osiyo mintaqasi uchun malakali kadrlar tayyorlash markaziga aylanadi.',
  'Samarqand shahrida Markaziy Osiyoda yagona bo‘lgan yuqori texnologiyali stomatologik xab barpo etilmoqda.',
  'Tibbiyot bo‘limi',
  '3 daqiqa',
  'Samarqand,Tibbiyot,Innovatsiya'
),
(
  'an-004',
  'HONOR X9e Pro nimasi bilan hayratga soladi: uning kuchi nimada?',
  'texnologiya',
  'Texnologiya',
  '12:03',
  '12.10.2026',
  10441,
  0,
  1,
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
  'Rekord darajadagi energiya optimizatsiyasi, o‘ta chidamli zarbaga qarshi ekrani va kiber-xavfsizlik chiplari bilan yangi smartfon taqdim etildi.',
  'Texnologiya giganti HONOR o‘zining flagman toifasidagi yangi modeli — X9e Pro smartfonini jahon bozoriga chiqardi.',
  'Tech Review',
  '4 daqiqa',
  'HONOR,Smartfon,Gadjet,Texnologiya'
);
