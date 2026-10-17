// ============================================================================
// ANTIVIRUS NEWS — Cloudflare Worker (D1 Database + R2 Media Storage API)
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
      // 0. GET /api/health — Ulanishni tekshirish
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'ANTIVIRUS NEWS API',
          database: 'Cloudflare D1 SQL (5 GB Free)',
          storage: 'Cloudflare R2 Object Storage (10 GB Free)',
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
          tags: r.tags ? (typeof r.tags === 'string' ? r.tags.split(',') : r.tags) : ['Yangilik'],
          videoUrl: r.video_url || null,
          createdAt: r.created_at
        }));

        return new Response(JSON.stringify(formatted), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // 2. POST /api/news — Yangi yangilik qo'shish (D1 SQL)
      if (request.method === 'POST' && url.pathname === '/api/news') {
        const body = await request.json();
        const id = body.id || 'an-' + Date.now();
        const now = new Date();
        const time = body.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const date = body.date || `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;

        // Agar bu yangilik is_hero bo'lsa, qolganlarini 0 qilish
        if (body.isHero) {
          await env.DB.prepare('UPDATE news SET is_hero = 0').run();
        }

        await env.DB.prepare(
          `INSERT INTO news (id, title, category, category_name, time, date, views, is_hero, is_trending, image_url, summary, content, author, read_time, tags, video_url)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          body.videoUrl || null
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

      // 5. POST /api/upload — Rasmni Cloudflare R2 Storage ga yuklash
      if (request.method === 'POST' && url.pathname === '/api/upload') {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || typeof file === 'string') {
          return new Response(JSON.stringify({ error: 'Yuklash uchun fayl topilmadi' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'image.jpg';
        const fileName = `${Date.now()}-${safeName}`;

        await env.MEDIA_BUCKET.put(fileName, file.stream(), {
          httpMetadata: { contentType: file.type || 'image/jpeg' },
        });

        const publicUrl = `${url.origin}/media/${fileName}`;

        return new Response(JSON.stringify({ success: true, url: publicUrl, key: fileName }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // 6. GET /media/:key — R2 dan rasmni to'g'ridan-to'g'ri ochiq uzatish
      if (request.method === 'GET' && url.pathname.startsWith('/media/')) {
        const key = url.pathname.replace('/media/', '');
        const object = await env.MEDIA_BUCKET.get(key);

        if (!object) {
          return new Response('Rasm topilmadi', { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Cache-Control', 'public, max-age=31536000');
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(object.body, { headers });
      }

      // Default Endpoint
      return new Response(JSON.stringify({
        message: 'ANTIVIRUS NEWS API — Ishga tayyor',
        endpoints: [
          'GET /api/health',
          'GET /api/news',
          'POST /api/news',
          'POST /api/news/:id/view',
          'DELETE /api/news/:id',
          'POST /api/upload',
          'GET /media/:key'
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
