/**
 * 阿里云 ESA Pages - GitHub 反向代理 Edge Function
 *
 * 使用方式（直接拼接原始 URL）：
 *   https://proxy.domain/https://github.com/user/repo
 *   https://proxy.domain/https://raw.githubusercontent.com/user/repo/main/file
 *   https://proxy.domain/https://github.com/user/repo/releases/download/v1.0/file.zip
 *
 * 也支持短前缀：
 *   /gh/user/repo          → github.com/user/repo
 *   /raw/user/repo/...     → raw.githubusercontent.com/user/repo/...
 *   /api/...               → api.github.com/...
 */

// ============ 路由解析 ============

function resolveTarget(pathname, search) {
  // 方式1：直接拼接完整 URL（主要方式）
  // 浏览器会把 https://github.com 优化成 https:/github.com（双斜杠合并）
  // 所以两种格式都要支持
  const fullUrlMatch = pathname.match(/^\/https?:\/\/?(.+)$/);
  if (fullUrlMatch) {
    const scheme = pathname.startsWith('/https') ? 'https' : 'http';
    let rest = fullUrlMatch[1];
    if (rest.startsWith('/')) rest = rest.slice(1);
    return `${scheme}://${rest}${search || ''}`;
  }

  // 方式2：带前缀的短路径
  const prefixMatch = pathname.match(/^\/(gh|raw|gist|releases|assets|api|objects)\/(.+)$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const rest = prefixMatch[2];
    const upstreams = {
      'gh':       'https://github.com',
      'raw':      'https://raw.githubusercontent.com',
      'gist':     'https://gist.github.com',
      'releases': 'https://github.com',       // 后面需要加 /releases
      'assets':   'https://github.githubassets.com',
      'api':      'https://api.github.com',
      'objects':  'https://objects.githubusercontent.com',
    };
    const base = upstreams[prefix];
    if (!base) return null;

    if (prefix === 'releases') {
      // /releases/user/repo/releases/... → github.com/user/repo/releases/...
      // /releases/user/repo → github.com/user/repo/releases
      const rm = rest.match(/^([^/]+)\/([^/]+)(\/releases\/.*)?$/);
      if (rm) {
        return `${base}/${rm[1]}/${rm[2]}${rm[3] || '/releases'}${search || ''}`;
      }
    }
    return `${base}/${rest}${search || ''}`;
  }

  // 方式3：裸路径 /user/repo/... → github.com/user/repo/...
  const bareMatch = pathname.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (bareMatch) {
    return `https://github.com${pathname}${search || ''}`;
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

function rewriteLocationHeader(value, host) {
  // 绝对 URL → 拼接到代理域名后面
  if (value.startsWith('https://') || value.startsWith('http://')) {
    return `//${host}/${value}`;
  }
  return value;
}

function rewriteHTML(html, host) {
  // 替换所有 GitHub 绝对 URL → 代理格式
  html = html.replace(/https?:\/\/raw\.githubusercontent\.com\//g, `//${host}/https://raw.githubusercontent.com/`);
  html = html.replace(/https?:\/\/gist\.githubusercontent\.com\//g, `//${host}/https://gist.github.com/`);
  html = html.replace(/https?:\/\/github\.githubassets\.com\//g, `//${host}/https://github.githubassets.com/`);
  html = html.replace(/https?:\/\/objects\.githubusercontent\.com\//g, `//${host}/https://objects.githubusercontent.com/`);
  html = html.replace(/https?:\/\/api\.github\.com\//g, `//${host}/https://api.github.com/`);
  html = html.replace(/https?:\/\/github\.com\//g, `//${host}/https://github.com/`);
  return html;
}

function rewriteCSS(css, host) {
  css = css.replace(/https?:\/\/github\.githubassets\.com\//g, `//${host}/https://github.githubassets.com/`);
  css = css.replace(/https?:\/\/raw\.githubusercontent\.com\//g, `//${host}/https://raw.githubusercontent.com/`);
  return css;
}

function rewriteJS(js, host) {
  js = js.replace(/https?:\/\/raw\.githubusercontent\.com\//g, `//${host}/https://raw.githubusercontent.com/`);
  js = js.replace(/https?:\/\/github\.githubassets\.com\//g, `//${host}/https://github.githubassets.com/`);
  js = js.replace(/https?:\/\/objects\.githubusercontent\.com\//g, `//${host}/https://objects.githubusercontent.com/`);
  js = js.replace(/https?:\/\/github\.com\//g, `//${host}/https://github.com/`);
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

    // 解析目标 URL
    const targetURL = resolveTarget(pathname, url.search);
    if (!targetURL) {
      return new Response('Not Found', { status: 404 });
    }

    // 构建上游请求
    const upstreamHeaders = cleanRequestHeaders(request.headers);
    const upstreamRequest = new Request(targetURL, {
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
          // GitHub 域名的重定向 → 走代理
          if (/^https?:\/\/(github\.com|raw\.githubusercontent\.com|gist\.github(?:usercontent)?\.com)\//.test(location)) {
            return Response.redirect(`https://${host}/${location}`, response.status);
          }
          // 其他域名（release-assets 等 CDN）→ 直接让客户端去下载，不走代理
          if (location.startsWith('http://') || location.startsWith('https://')) {
            return Response.redirect(location, response.status);
          }
          // 相对路径 → 拼接原目标域名
          try {
            const targetBase = new URL(targetURL);
            return Response.redirect(`https://${host}/${targetBase.origin}${new URL(location, targetBase).pathname}`, response.status);
          } catch {
            return Response.redirect(location, response.status);
          }
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
