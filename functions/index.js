/**
 * 阿里云 ESA Pages - GitHub 反向代理 Edge Function
 *
 * 路由规则：
 * 直接访问（推荐）：
 *   /user/repo             → github.com/user/repo
 *   /user/repo/tree/main   → github.com/user/repo/tree/main
 *
 * 带前缀访问：
 *   /gh/user/repo          → github.com/user/repo
 *   /raw/user/repo/...     → raw.githubusercontent.com/user/repo/...
 *   /gist/user/id          → gist.github.com/user/id
 *   /releases/user/repo/...→ github.com/user/repo/releases/...
 *   /assets/...            → github.githubassets.com/...
 *   /api/...               → api.github.com/...
 *   /objects/...           → objects.githubusercontent.com/...
 */

const UPSTREAMS = {
  'gh':       'github.com',
  'raw':      'raw.githubusercontent.com',
  'gist':     'gist.github.com',
  'releases': 'github.com',
  'assets':   'github.githubassets.com',
  'api':      'api.github.com',
  'objects':  'objects.githubusercontent.com',
};

// ============ 路由解析 ============

function parseRoute(pathname) {
  // /gh/user/repo/... → github.com/user/repo/...
  const ghMatch = pathname.match(/^\/gh\/(.+)$/);
  if (ghMatch) return { prefix: 'gh', path: `/${ghMatch[1]}` };

  // /raw/user/repo/... → raw.githubusercontent.com/user/repo/...
  const rawMatch = pathname.match(/^\/raw\/(.+)$/);
  if (rawMatch) return { prefix: 'raw', path: `/${rawMatch[1]}` };

  // /gist/user/id → gist.github.com/user/id
  const gistMatch = pathname.match(/^\/gist\/(.+)$/);
  if (gistMatch) return { prefix: 'gist', path: `/${gistMatch[1]}` };

  // /releases/user/repo/releases/... → github.com/user/repo/releases/...
  // /releases/user/repo → github.com/user/repo/releases
  const releaseMatch = pathname.match(/^\/releases\/([^/]+)\/([^/]+)(\/releases\/.*)?$/);
  if (releaseMatch) {
    return { prefix: 'releases', path: `/${releaseMatch[1]}/${releaseMatch[2]}${releaseMatch[3] || '/releases'}` };
  }

  // /assets/... → github.githubassets.com/...
  const assetsMatch = pathname.match(/^\/assets\/(.+)$/);
  if (assetsMatch) return { prefix: 'assets', path: `/${assetsMatch[1]}` };

  // /api/... → api.github.com/...
  const apiMatch = pathname.match(/^\/api\/(.+)$/);
  if (apiMatch) return { prefix: 'api', path: `/${apiMatch[1]}` };

  // /objects/... → objects.githubusercontent.com/...
  const objectsMatch = pathname.match(/^\/objects\/(.+)$/);
  if (objectsMatch) return { prefix: 'objects', path: `/${objectsMatch[1]}` };

  // 默认：/user/repo/... → github.com/user/repo/...
  // 匹配 user/repo 格式的路径（至少两段）
  const bareMatch = pathname.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (bareMatch) {
    return { prefix: 'gh', path: pathname };
  }

  return null;
}

// ============ 请求头处理 ============

function cleanRequestHeaders(headers) {
  const cleaned = new Headers();
  const skip = new Set([
    'host', 'origin', 'referer', 'x-forwarded-for',
    'x-real-ip', 'cf-connecting-ip', 'cdn-loop',
  ]);

  for (const [key, value] of headers.entries()) {
    if (!skip.has(key.toLowerCase())) {
      cleaned.set(key, value);
    }
  }

  cleaned.set('User-Agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  cleaned.set('Accept',
    headers.get('accept') ||
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
  cleaned.set('Accept-Language', 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7');

  return cleaned;
}

function buildResponseHeaders(upstreamHeaders) {
  const headers = new Headers();
  const skip = new Set([
    'content-security-policy', 'content-security-policy-report-only',
    'x-frame-options', 'strict-transport-security',
    'report-to', 'nel', 'set-cookie',
  ]);

  for (const [key, value] of upstreamHeaders.entries()) {
    if (!skip.has(key.toLowerCase())) {
      if (key.toLowerCase() === 'location') {
        headers.set(key, rewriteLocationHeader(value));
      } else {
        headers.set(key, value);
      }
    }
  }

  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');

  return headers;
}

// ============ 内容重写 ============

function rewriteLocationHeader(value) {
  return value
    .replace(/https?:\/\/raw\.githubusercontent\.com\//g, '/raw/')
    .replace(/https?:\/\/gist\.githubusercontent\.com\//g, '/gist/')
    .replace(/https?:\/\/github\.githubassets\.com\//g, '/assets/')
    .replace(/https?:\/\/objects\.githubusercontent\.com\//g, '/objects/');
}

function rewriteHTML(html, host) {
  html = html.replace(/https?:\/\/raw\.githubusercontent\.com\//g, `//${host}/raw/`);
  html = html.replace(/https?:\/\/gist\.githubusercontent\.com\//g, `//${host}/gist/`);
  html = html.replace(/https?:\/\/github\.githubassets\.com\//g, `//${host}/assets/`);
  html = html.replace(/https?:\/\/objects\.githubusercontent\.com\//g, `//${host}/objects/`);
  html = html.replace(/https?:\/\/api\.github\.com\//g, `//${host}/api/`);
  html = html.replace(
    /(href|src|action|data-url|data-hydro-click-hmac)=(["'])https?:\/\/github\.com\//g,
    `$1=$2//${host}/gh/`
  );
  html = html.replace(
    /url\((["']?)https?:\/\/github\.githubassets\.com\//g,
    `url($1//${host}/assets/`
  );
  return html;
}

function rewriteCSS(css, host) {
  css = css.replace(/https?:\/\/github\.githubassets\.com\//g, `//${host}/assets/`);
  css = css.replace(/https?:\/\/raw\.githubusercontent\.com\//g, `//${host}/raw/`);
  return css;
}

function rewriteJS(js, host) {
  js = js.replace(/https?:\/\/raw\.githubusercontent\.com\//g, `//${host}/raw/`);
  js = js.replace(/https?:\/\/github\.githubassets\.com\//g, `//${host}/assets/`);
  js = js.replace(/https?:\/\/objects\.githubusercontent\.com\//g, `//${host}/objects/`);
  return js;
}

// ============ Edge Function 入口 ============

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.host;
    const pathname = url.pathname;

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 健康检查
    if (pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: Date.now() }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 解析路由
    const route = parseRoute(pathname);
    if (!route) {
      return new Response('Not Found', { status: 404 });
    }

    // 构建上游 URL
    const upstream = UPSTREAMS[route.prefix];
    if (!upstream) {
      return new Response('Bad Gateway', { status: 502 });
    }
    const upstreamURL = `https://${upstream}${route.path}${url.search || ''}`;

    // 构建上游请求
    const upstreamHeaders = cleanRequestHeaders(request.headers);
    const upstreamRequest = new Request(upstreamURL, {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body : undefined,
      redirect: 'manual',
    });

    try {
      const response = await fetch(upstreamRequest);

      // 处理重定向
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (location) {
          let newLoc = rewriteLocationHeader(location);
          if (newLoc.startsWith('/')) {
            newLoc = `/gh${newLoc}`;
          }
          return Response.redirect(newLoc, response.status);
        }
      }

      const contentType = response.headers.get('content-type') || '';
      const responseHeaders = buildResponseHeaders(response.headers);

      const shouldRewrite =
        contentType.includes('text/html') ||
        contentType.includes('text/css') ||
        contentType.includes('application/javascript') ||
        contentType.includes('text/javascript') ||
        contentType.includes('application/json');

      if (shouldRewrite) {
        let body = await response.text();

        if (contentType.includes('text/html')) {
          body = rewriteHTML(body, host);
        } else if (contentType.includes('text/css')) {
          body = rewriteCSS(body, host);
        } else if (contentType.includes('javascript')) {
          body = rewriteJS(body, host);
        }

        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      // 流式传输非文本内容（图片、文件等）
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(`Proxy Error: ${err.message}`, {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },
};
