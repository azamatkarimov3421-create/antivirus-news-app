# 🚀 ANTIVIRUS NEWS — Cloudflare (D1 SQL + R2 Storage) O'rnatish Qo'llanmasi

ANTIVIRUS NEWS ilovasi uchun **15 GB mutlaqo bepul** serverless backend:
- **Cloudflare D1:** 5 GB serverless SQLite ma'lumotlar bazasi (Yangiliklar, ko'rishlar, toifalar).
- **Cloudflare R2:** 10 GB media xotirasi (Rasmlar va videolar uchun, $0 chiqish trafigi!).
- **Cloudflare Workers:** Yuqori tezlikdagi global serverless REST API.

---

## 🌟 1-USUL: Cloudflare Dashboard orqali (Eng oson, Brauzerda 3 daqiqa)

Hech qanday terminal yoki murakkab buyruqlarsiz, brauzer orqali:

### 1-qadam: D1 SQL Bazani yaratish
1. [Cloudflare Dashboard](https://dash.cloudflare.com) ga kiring.
2. Chap menyudan **Storage & Databases** ➔ **D1 SQL Database** bo'limiga o'ting.
3. **Create Database** tugmasini bosing:
   - Nomi: `antivirus-news-db`
   - **Create** ni bosing.
4. Yaratilgan baza ichiga kiring va **Console** tabini oching.
5. `schema.sql` faylidagi barcha kodni nusxalab, konsolga qo'ying va **Execute** tugmasini bosing.
   *(Jadvallar va dastlabki test yangiliklari bir zumda yaratiladi!)*

---

### 2-qadam: R2 Media Xotirasini yaratish
1. Chap menyudan **Storage & Databases** ➔ **R2 Object Storage** bo'limiga o'ting.
2. **Create Bucket** tugmasini bosing:
   - Nomi: `antivirus-media`
   - **Create Bucket** ni bosing.

---

### 3-qadam: Worker (REST API) ni yaratish va ulash
1. Chap menyudan **Workers & Pages** ➔ **Create application** ➔ **Create Worker** tugmasini bosing.
2. Nomi: `antivirus-news-api` ➔ **Deploy** ni bosing.
3. Chiqqan ekranda **Edit code** tugmasini bosing:
   - Chap tomondagi `worker.js` ichidagi mavjud kodni o'chirib, ushbu papkadagi `cloudflare/worker.js` kodini to'liq joylashtiring.
   - Yuqori o'ng burchakdagi **Deploy** tugmasini bosing.
4. Orqaga qaytib, Worker sahifasida **Settings** ➔ **Bindings** bo'limiga kiring:
   - **Add binding** ➔ **D1 database** ni tanlang:
     - Variable name: `DB` (Katta harflar bilan!)
     - D1 database: `antivirus-news-db` ni tanlang.
   - **Add binding** ➔ **R2 bucket** ni tanlang:
     - Variable name: `MEDIA_BUCKET` (Katta harflar bilan!)
     - R2 bucket: `antivirus-media` ni tanlang.
   - **Save and Deploy** tugmasini bosing.

---

### 4-qadam: Ilovaga ulash (1 marta bosish)
1. Worker sahifasidagi o'z havolangizni nusxalang (masalan: `https://antivirus-news-api.sizning-subdomain.workers.dev`).
2. ANTIVIRUS NEWS ilovasini oching (`https://antivirus-news-app-uwl4.vercel.app/`).
3. Yuqoridagi **☁️** belgisini yoki pastdagi **Barchasi** menyusidagi **Cloudflare D1 & R2 Baza** kartasini bosing.
4. Havolangizni qo'ying va **"Ulanishni tekshirish va Saqlash"** tugmasini bosing.
5. 🟢 **Cloudflare Baza Muvaffaqiyatli Ulangan!** xabari chiqadi.
6. Endi xohlagan yangiligingizni Cloudflare D1 ga yozishingiz va rasmlarni to'g'ridan-to'g'ri Cloudflare R2 ga yuklashingiz mumkin!

---

## ⚡ 2-USUL: Terminal (Wrangler CLI) orqali

Agar terminalda ishlashni ma'qul ko'rsangiz:

```bash
cd cloudflare

# 1. Cloudflare tizimiga kirish
npx wrangler login

# 2. D1 Baza va R2 Xotira yaratish
npx wrangler d1 create antivirus-news-db
npx wrangler r2 bucket create antivirus-media

# 3. wrangler.toml dagi database_id ni D1 bergan ID ga almashtiring

# 4. Workerni deploy qilish
npx wrangler deploy

# 5. SQL sxemani bazaga yuklash
npx wrangler d1 execute antivirus-news-db --file=./schema.sql --remote
```

---

## 📊 API Endpointlar Ro'yxati

- `GET /api/health` — Baza va storage holatini tekshirish
- `GET /api/news` — Barcha yangiliklar ro'yxatini olish
- `POST /api/news` — Yangi yangilik qo'shish (D1 SQL)
- `POST /api/news/:id/view` — Ko'rishlar sonini oshirish
- `DELETE /api/news/:id` — Yangilikni o'chirish
- `POST /api/upload` — Rasmni R2 ga yuklash (FormData)
- `GET /media/:key` — R2 dagi rasmni brauzerda ochish/ko'rsatish
