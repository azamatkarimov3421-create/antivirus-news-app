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
  { id: 'trend', name: 'Trend', icon: 'trending-up', color: '#8B5CF6' },
  { id: 'tahlil', name: 'Tahlil', icon: 'file-text', color: '#475569' },
  { id: 'foto', name: 'Foto galereya', icon: 'image', color: '#059669' }
];

export const INITIAL_NEWS = [
  {
    id: 'an-001',
    title: 'Shavkat Mirziyoyev Gurbanguli Berdimuxamedov bilan telefonda gaplashdi',
    category: 'jamiyat',
    categoryName: 'Jamiyat',
    time: '18:54',
    date: '12.10.2026',
    views: 38245,
    isHero: true,
    isTrending: true,
    isSlider: true,
    imageUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
    summary: 'O‘zbekiston Respublikasi Prezidenti Shavkat Mirziyoyev va Turkman xalqining milliy yetakchisi, Xalq Maslahati Raisi Gurbanguli Berdimuhamedov o‘rtasida telefon orqali muloqot bo‘lib o‘tdi.',
    content: `O‘zbekiston Respublikasi Prezidenti Shavkat Mirziyoyev va Turkman xalqining milliy yetakchisi, Turkmaniston Xalq Maslahati Raisi Gurbanguli Berdimuhamedov o‘rtasida do‘stona telefon orqali muloqot bo‘lib o‘tdi.

Suhbat avvalida davlatimiz rahbari Gurbanguli Berdimuhamedovni qutlug‘ tavallud ayyomi bilan samimiy tabriklab, unga mustahkam sog‘liq, baxt-saodat hamda qardosh Turkmaniston xalqi farovonligi yo‘lidagi ulkan faoliyatida yangi zafarlar tiladi.

Muloqot davomida ikki tomonlama do‘stlik, yaxshi qo‘shnichilik va strategik sheriklik munosabatlarini yanada mustahkamlash, oliy darajada erishilgan kelishuvlarni to‘liq amalga oshirish masalalari atroflicha muhokama qilindi.

Ayniqsa, savdo-iqtisodiy, energetika, transport-logistika va qishloq xo‘jaligi sohalaridagi qo‘shma loyihalarni jadallashtirish, hududlararo aloqalarni kengaytirish muhimligi ta’kidlandi. Tomonlar xalqaro va mintaqaviy kun tartibidagi dolzarb masalalar yuzasidan ham fikr almashdilar.`,
    author: 'ANTIVIRUS Tahririyati',
    readTime: '3 daqiqa',
    tags: ['O‘zbekiston', 'Turkmaniston', 'Prezident', 'Siyosat', 'Muloqot'],
    videoUrl: null
  },
  {
    id: 'an-002',
    title: 'O‘zbekistonda Chery Tiggo 4 Pro sotuvi boshlandi',
    category: 'biznes',
    categoryName: 'Biznes',
    time: '15:41',
    date: '12.10.2026',
    views: 12541,
    isHero: false,
    isTrending: true,
    isSlider: false,
    imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
    summary: 'Yangi ixcham krossover mahalliy bozor uchun moslashtirilgan komplektatsiyalar va zamonaviy xavfsizlik funksiyalari bilan rasmiy dilerlik markazlariga yetkazib berila boshlandi.',
    content: `O‘zbekiston avtomobil bozorida rasmiy brendlardan biri hisoblangan Chery o‘zining mashhur Tiggo 4 Pro ixcham krossoverining yangilangan versiyasini taqdim etdi.

Avtomobil 1.5 litrli turbomotor, 9 pog‘onali CVT variator uzatmalar qutisi va zamonaviy multimedia tizimi bilan jihozlangan. Shuningdek, 360 darajali kameralar tizimi, adaptiv kruiz-kontrol hamda qishki to‘plam (o‘rindiqlar va rul qizdirgichi) mavjud.

Narxlar va mavjud komplektatsiyalar rasmiy dilerlik markazlarida e’lon qilindi. Mutaxassislar ushbu model shahar sharoitida qulayligi va tejamkorligi bilan xaridorlar orasida katta qiziqish uyg‘otishini kutmoqda.`,
    author: 'Avto Sharh',
    readTime: '2 daqiqa',
    tags: ['Chery', 'Avtomobil', 'Bozor', 'Biznes'],
    videoUrl: null
  },
  {
    id: 'an-003',
    title: 'Samarqandda stomatologik xab tashkil etiladi: tibbiy ta’lim, klinik amaliyot va innovatsiya',
    category: 'jamiyat',
    categoryName: 'Jamiyat',
    time: '14:20',
    date: '12.10.2026',
    views: 8912,
    isHero: false,
    isTrending: false,
    isSlider: false,
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
    summary: 'Xalqaro standartlarga javob beradigan zamonaviy stomatologiya klasteri Markaziy Osiyo mintaqasi uchun malakali kadrlar tayyorlash markaziga aylanadi.',
    content: `Samarqand shahrida Markaziy Osiyoda yagona bo‘lgan yuqori texnologiyali stomatologik xab barpo etilmoqda. Ushbu loyiha zamonaviy klinik amaliyot, fundamental ilmiy-tadqiqotlar va innovatsion ta’limni o‘zida mujassam etadi.

Klaster doirasida Germaniya, Janubiy Koreya va Turkiyaning yetakchi tibbiyot universitetlari bilan hamkorlikda sun'iy intellektga asoslangan 3D-diagnostika va raqamli stomatologiya laboratoriyalari ishga tushiriladi.

Loyiha natijasida yiliga 500 dan ortiq yosh mutaxassislar qayta tayyorlanadi va kam ta'minlangan aholi qatlamiga bepul yuqori texnologik xizmat ko‘rsatish yo‘lga qo‘yiladi.`,
    author: 'Tibbiyot bo‘limi',
    readTime: '3 daqiqa',
    tags: ['Samarqand', 'Tibbiyot', 'Innovatsiya', 'Ta’lim'],
    videoUrl: null
  },
  {
    id: 'an-004',
    title: 'HONOR X9e Pro nimasi bilan hayratga soladi: uning kuchi nimada?',
    category: 'texnologiya',
    categoryName: 'Texnologiya',
    time: '12:03',
    date: '12.10.2026',
    views: 10441,
    isHero: false,
    isTrending: true,
    isSlider: false,
    imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
    summary: 'Rekord darajadagi 1100mAh qo‘shimcha energiya optimizatsiyasi, o‘ta chidamli zarbaga qarshi ekrani va kiber-xavfsizlik chiplari bilan yangi smartfon taqdim etildi.',
    content: `Texnologiya giganti HONOR o‘zining flagman toifasidagi yangi modeli — X9e Pro smartfonini jahon bozoriga chiqardi.

Qurilmaning asosiy o‘ziga xosligi:
- Ultra-mustahkam Ultra-Bounce zarbaga qarshi korpus;
- 6600 mA/soat sig‘imli uzoq muddat xizmat qiluvchi kremniy-uglerodli batareya;
- 108 MP asosiy kamera hamda sun'iy intellekt algoritmlari bilan boyitilgan portret rejimi;
- ANTIVIRUS darajasidagi apparatli ma’lumotlarni shifrlash arxitekturasi.

Smartfon yoshlar va faol foydalanuvchilar uchun ideal tanlov sifatida baholanmoqda.`,
    author: 'Tech Review',
    readTime: '4 daqiqa',
    tags: ['HONOR', 'Smartfon', 'Gadjet', 'Texnologiya'],
    videoUrl: null
  },
  {
    id: 'an-005',
    title: 'Markaziy Osiyo yetakchilari: Samarqandda yangi xavfsizlik va savdo pakti imzolandi',
    category: 'siyosat',
    categoryName: 'Siyosat',
    time: '11:15',
    date: '12.10.2026',
    views: 24190,
    isHero: false,
    isTrending: true,
    isSlider: true,
    imageUrl: 'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?auto=format&fit=crop&w=1200&q=80',
    summary: 'Mintaqaviy integratsiyani chuqurlashtirish, bojxona to‘siqlarini bartaraf etish va umumiy energetika halqasini modernizatsiya qilish bo‘yicha tarixiy hujjat tasdiqlandi.',
    content: `Samarqandda o‘tkazilgan nufuzli sammit doirasida mintaqa davlatlari o‘rtasida xavfsizlik va erkin savdo zonasini mustahkamlovchi ko‘p tomonlama bitim imzolandi. 

Ekspertlar ta’kidlashicha, ushbu pakt Markaziy Osiyo orqali o‘tuvchi xalqaro transport yo‘laklari (Transkaspiy va Xitoy-Qirg‘iziston-O‘zbekiston temir yo‘li) xavfsizligini kafolatlaydi va yillik tovar ayirboshlashni 3 baravarga oshirish imkonini beradi.`,
    author: 'Siyosiy Tahlil',
    readTime: '5 daqiqa',
    tags: ['Samarqand', 'Sammit', 'Siyosat', 'Mintaqa'],
    videoUrl: null
  },
  {
    id: 'an-006',
    title: 'BMT Bosh Assambleyasida global sun’iy intellekt etikasi kodeksi qabul qilindi',
    category: 'dunyo',
    categoryName: 'Dunyo',
    time: '09:40',
    date: '12.10.2026',
    views: 17820,
    isHero: false,
    isTrending: false,
    isSlider: false,
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    summary: '150 dan ortiq mamlakat sun’iy intellekt vositalaridan tinchlik va inson huquqlarini himoya qilish yo‘lida foydalanishga oid xalqaro konvensiyani ma’qulladi.',
    content: `Birlashgan Millatlar Tashkilotining Nyu-Yorkdagi bosh qarorgohida generativ sun’iy intellekt va avtonom tizimlarni tartibga soluvchi global rezolyutsiya ovozga qo‘yildi. 

Hujjat kiberxurujlar, deepfake texnologiyalaridan noqonuniy foydalanish va ma’lumotlar maxfiyligini buzishga qarshi qat’iy qoidalarni o‘z ichiga oladi. O‘zbekiston delegatsiyasi ushbu tashabbusni faol qo‘llab-quvvatladi.`,
    author: 'Xalqaro Byuro',
    readTime: '3 daqiqa',
    tags: ['BMT', 'Dunyo', 'Sun’iy Intellekt', 'Xavfsizlik'],
    videoUrl: null
  },
  {
    id: 'an-007',
    title: 'O‘zbekiston futbol terma jamoasi JCh saralashida yirik hisobda zafar quchdi',
    category: 'sport',
    categoryName: 'Sport',
    time: '21:30',
    date: '11.10.2026',
    views: 52100,
    isHero: false,
    isTrending: true,
    isSlider: false,
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
    summary: 'Poytaxtdagi «Bunyodkor» stadionida bo‘lib o‘tgan hayajonli bahsda milliy jamoamiz ishonchli o‘yin ko‘rsatib, guruh yetakchisiga aylandi.',
    content: `O‘zbekiston milliy terma jamoasi Jahon chempionati 2026 saralashining hal qiluvchi bosqichida navbatdagi muhim bahsni o‘tkazdi va 3:0 hisobida g‘alabaga erishdi.

O‘yinda legionerlarimiz Abbosbek Fayzullayev, Eldor Shomurodov va Oston O‘runovlar ajoyib kombinatsiyalari bilan ajralib turdilar. Ushbu g‘alaba jamoamizni tarixda ilk bor mundial yo‘llanmasiga yanada yaqinlashtirdi.`,
    author: 'Sport News',
    readTime: '2 daqiqa',
    tags: ['Sport', 'Futbol', 'O‘zbekiston', 'JCh-2026'],
    videoUrl: null
  },
  {
    id: 'an-008',
    title: 'Toshkent xalqaro aeroportining yangi terminali: kelajak infratuzilmasi ko‘z o‘ngimizda',
    category: 'video',
    categoryName: 'Video',
    time: '16:05',
    date: '11.10.2026',
    views: 31200,
    isHero: false,
    isTrending: true,
    isSlider: true,
    imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80',
    summary: 'Yiliga 20 million yo‘lovchiga xizmat ko‘rsatish quvvatiga ega bo‘lgan ultra-zamonaviy terminal qurilishidan maxsus videoreportaj.',
    content: `Toshkent xalqaro aeroportida davom etayotgan keng ko‘lamli qurilish ishlari doirasida yangi yo‘lovchi terminali loyihasi yakuniy bosqichga chiqmoqda.

Video lavhamizda:
- Aqlli biometrik pasport nazorati tizimlari;
- Tezkor avtomatlashtirilgan bagaj liniyalari;
- Ekologik toza quyosh panellari bilan ta’minlangan yashil arxitektura;
- To‘g‘ridan-to‘g‘ri tezyurar metro va aeropoyezd bekati ko‘rsatilgan.`,
    author: 'ANTIVIRUS Media',
    readTime: 'Videoni ko‘rish (4:15)',
    tags: ['Video', 'Toshkent', 'Aeroport', 'Reportaj'],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  }
];

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
