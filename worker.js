export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Hybrid AI Cutout Endpoint (Tier 1: Cloudflare AI -> Tier 2: Browser RMBG-1.4 fallback)
    if (url.pathname === '/api/cutout' && request.method === 'POST') {
      try {
        if (!env.AI) {
          return new Response(JSON.stringify({ error: 'AI binding not configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const body = await request.json();
        if (!body || !body.image) {
          return new Response(JSON.stringify({ error: 'Missing image' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const result = await env.AI.run('bria/remove-background', {
          image: body.image,
          preserve_alpha: true
        });

        // Handle either URL string or binary/stream response from Workers AI
        if (typeof result === 'string' && result.startsWith('http')) {
          const imgRes = await fetch(result);
          const buf = await imgRes.arrayBuffer();
          return new Response(buf, {
            headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }
          });
        }

        if (result && result.image) {
          const imgRes = await fetch(result.image);
          const buf = await imgRes.arrayBuffer();
          return new Response(buf, {
            headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }
          });
        }

        return new Response(result, {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Fallback to browser AI', detail: String(err) }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Serve static web app (index.html)
    return env.ASSETS.fetch(request);
  }
};
