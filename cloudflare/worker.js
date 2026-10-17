// ============================================================================
// ANTIVIRUS NEWS — Cloudflare Worker (D1 SQL Database API)
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // 0. GET /api/health — Baza holati va xotira ma'lumotlarini olish
      if (request.method === 'GET' && url.pathname === '/api/health') {
        let newsCount = 0;
        if (env.DB) {
          try {
            const countRes = await env.DB.prepare('SELECT COUNT(*) as count FROM news').first();
            newsCount = countRes ? countRes.count : 0;
          } catch (e) {}
        }

        return new Response(JSON.stringify({
          status: 'ok',
          service: 'ANTIVIRUS NEWS API',
          database: env.DB ? 'Cloudflare D1 SQL (Faol)' : 'D1 ulanmagan',
          databaseName: 'antivirus-news-db',
          databaseId: 'ad7f702f-702a-44ef-9e76-c6f5b1107273',
          totalCapacity: '5.00 GB (5,368,709,120 bytes)',
          freeCapacityBytes: 5368709120,
          newsCount: newsCount,
          time: new Date().toISOString()
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // 1. GET /api/news — Barcha yangiliklarni olish (D1 SQL)
      if (request.method === 'GET' && url.pathname === '/api/news') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM news ORDER BY created_at DESC'
        ).all();

        const formatted = (results || []).map(r => ({
          id: r.id,
          title: r.title,
          category: r.category,
          categoryName: r.category_name || r.category,
          time: r.time,
          date: r.date,
          views: Number(r.views) || 0,
          isHero: Boolean(r.is_hero),
          isTrending: Boolean(r.is_trending),
          imageUrl: r.image_url || '',
          summary: r.summary || '',
          content: r.content || '',
          author: r.author || 'ANTIVIRUS Tahririyati',
          readTime: r.read_time || '3 daqiqa',
          source: r.source || 'ANTIVIRUS Tahririyati',
          sourceUrl: r.source_url || '',
          tags: r.tags ? (typeof r.tags === 'string' ? r.tags.split(',') : r.tags) : ['Yangilik'],
          videoUrl: r.video_url || null,
          createdAt: r.created_at
        }));

        return new Response(JSON.stringify(formatted), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // 2. POST /api/news — Yangi yangilik qo'shish (Manbasi bilan)
      if (request.method === 'POST' && url.pathname === '/api/news') {
        const body = await request.json();
        const id = body.id || 'an-' + Date.now();
        const now = new Date();
        const time = body.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const date = body.date || `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;

        // Jadvalga source va source_url ustunlari borligiga ishonch hosil qilish
        try {
          await env.DB.prepare('ALTER TABLE news ADD COLUMN source TEXT').run();
        } catch (e) {}
        try {
          await env.DB.prepare('ALTER TABLE news ADD COLUMN source_url TEXT').run();
        } catch (e) {}

        // Agar bu yangilik is_hero bo'lsa, qolganlarini 0 qilish
        if (body.isHero) {
          await env.DB.prepare('UPDATE news SET is_hero = 0').run();
        }

        await env.DB.prepare(
          `INSERT INTO news (id, title, category, category_name, time, date, views, is_hero, is_trending, image_url, summary, content, author, read_time, tags, video_url, source, source_url)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.title || 'Sarlavhasiz yangilik',
          body.category || 'jamiyat',
          body.categoryName || 'Jamiyat',
          time,
          date,
          body.isHero ? 1 : 0,
          body.isTrending ? 1 : 0,
          body.imageUrl || '',
          body.summary || '',
          body.content || '',
          body.author || 'ANTIVIRUS Tahririyati',
          body.readTime || '3 daqiqa',
          Array.isArray(body.tags) ? body.tags.join(',') : (body.tags || 'Yangilik'),
          body.videoUrl || null,
          body.source || 'ANTIVIRUS Tahririyati',
          body.sourceUrl || ''
        ).run();

        return new Response(JSON.stringify({ success: true, id }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // 3. POST /api/news/:id/view — Ko'rishlar sonini oshirish
      if (request.method === 'POST' && url.pathname.startsWith('/api/news/') && url.pathname.endsWith('/view')) {
        const parts = url.pathname.split('/');
        const id = parts[3];

        await env.DB.prepare('UPDATE news SET views = views + 1 WHERE id = ?').bind(id).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // 4. DELETE /api/news/:id — Yangilikni o'chirish
      if (request.method === 'DELETE' && url.pathname.startsWith('/api/news/')) {
        const parts = url.pathname.split('/');
        const id = parts[3];

        await env.DB.prepare('DELETE FROM news WHERE id = ?').bind(id).run();

        return new Response(JSON.stringify({ success: true, deleted: id }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Default Endpoint
      return new Response(JSON.stringify({
        message: 'ANTIVIRUS NEWS API — Ishga tayyor',
        database: 'Cloudflare D1 SQL (5 GB Bepul)',
        endpoints: [
          'GET /api/health',
          'GET /api/news',
          'POST /api/news',
          'POST /api/news/:id/view',
          'DELETE /api/news/:id'
        ]
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};
