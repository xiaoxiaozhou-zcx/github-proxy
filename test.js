/**
 * 路由解析测试
 * 运行: node test.js
 */

function resolveTarget(pathname, search) {
  const fullUrlMatch = pathname.match(/^\/https?:\/\/?(.+)$/);
  if (fullUrlMatch) {
    const scheme = pathname.startsWith('/https') ? 'https' : 'http';
    let rest = fullUrlMatch[1];
    if (rest.startsWith('/')) rest = rest.slice(1);
    return `${scheme}://${rest}${search || ''}`;
  }

  const prefixMatch = pathname.match(/^\/(gh|raw|gist|releases|assets|api|objects)\/(.+)$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const rest = prefixMatch[2];
    const upstreams = {
      'gh': 'https://github.com',
      'raw': 'https://raw.githubusercontent.com',
      'gist': 'https://gist.github.com',
      'releases': 'https://github.com',
      'assets': 'https://github.githubassets.com',
      'api': 'https://api.github.com',
      'objects': 'https://objects.githubusercontent.com',
    };
    const base = upstreams[prefix];
    if (!base) return null;
    if (prefix === 'releases') {
      const rm = rest.match(/^([^/]+)\/([^/]+)(\/releases\/.*)?$/);
      if (rm) return `${base}/${rm[1]}/${rm[2]}${rm[3] || '/releases'}${search || ''}`;
    }
    return `${base}/${rest}${search || ''}`;
  }

  const bareMatch = pathname.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (bareMatch) return `https://github.com${pathname}${search || ''}`;

  return null;
}

console.log('=== GitHub Proxy 路由解析测试 ===\n');

const tests = [
  // 直接拼接完整 URL（主要方式）
  ['/https://github.com/user/repo', 'https://github.com/user/repo'],
  ['/https://github.com/XIU2/CloudflareSpeedTest/releases/download/v2.3.5/cfst_windows_amd64.zip',
   'https://github.com/XIU2/CloudflareSpeedTest/releases/download/v2.3.5/cfst_windows_amd64.zip'],
  ['/https://raw.githubusercontent.com/user/repo/main/file.txt', 'https://raw.githubusercontent.com/user/repo/main/file.txt'],
  ['/https://github.com/torvalds/linux/tree/master', 'https://github.com/torvalds/linux/tree/master'],

  // 浏览器双斜杠合并格式
  ['/https:/github.com/user/repo', 'https://github.com/user/repo'],

  // 短前缀方式
  ['/gh/torvalds/linux', 'https://github.com/torvalds/linux'],
  ['/raw/torvalds/linux/master/README', 'https://raw.githubusercontent.com/torvalds/linux/master/README'],
  ['/gist/torvalds/12345', 'https://gist.github.com/torvalds/12345'],
  ['/releases/cli/cli/releases/download/v2.40.0/gh.tar.gz', 'https://github.com/cli/cli/releases/download/v2.40.0/gh.tar.gz'],
  ['/releases/owner/repo', 'https://github.com/owner/repo/releases'],
  ['/assets/webpack-runtime-abc123.js', 'https://github.githubassets.com/webpack-runtime-abc123.js'],
  ['/api/repos/torvalds/linux', 'https://api.github.com/repos/torvalds/linux'],

  // 裸路径
  ['/torvalds/linux', 'https://github.com/torvalds/linux'],
  ['/torvalds/linux/tree/master', 'https://github.com/torvalds/linux/tree/master'],

  // 非 GitHub 域名（不应代理）
  ['/unknown/path', 'https://github.com/unknown/path'],
  ['/', null],
];

let passed = 0, failed = 0;

for (const [inputPath, expected] of tests) {
  const actual = resolveTarget(inputPath, '');

  if (expected === null) {
    if (actual === null) {
      console.log(`✅ ${inputPath} → (正确拒绝)`);
      passed++;
    } else {
      console.log(`❌ ${inputPath} → 应返回 null，实际: ${actual}`);
      failed++;
    }
    continue;
  }

  if (actual === null) {
    console.log(`❌ ${inputPath} → 解析失败`);
    failed++;
    continue;
  }

  if (actual === expected) {
    console.log(`✅ ${inputPath} → ${actual}`);
    passed++;
  } else {
    console.log(`❌ ${inputPath}`);
    console.log(`   期望: ${expected}`);
    console.log(`   实际: ${actual}`);
    failed++;
  }
}

console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);

if (failed === 0) {
  console.log('\n✅ 所有测试通过！');
}
