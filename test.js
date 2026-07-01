/**
 * 路由解析测试
 * 运行: node test.js
 */

function parseRoute(pathname) {
  const ghMatch = pathname.match(/^\/gh\/(.+)$/);
  if (ghMatch) return { prefix: 'gh', path: `/${ghMatch[1]}` };

  const rawMatch = pathname.match(/^\/raw\/(.+)$/);
  if (rawMatch) return { prefix: 'raw', path: `/${rawMatch[1]}` };

  const gistMatch = pathname.match(/^\/gist\/(.+)$/);
  if (gistMatch) return { prefix: 'gist', path: `/${gistMatch[1]}` };

  const releaseMatch = pathname.match(/^\/releases\/([^/]+)\/([^/]+)(\/releases\/.*)?$/);
  if (releaseMatch) {
    return { prefix: 'releases', path: `/${releaseMatch[1]}/${releaseMatch[2]}${releaseMatch[3] || '/releases'}` };
  }

  const assetsMatch = pathname.match(/^\/assets\/(.+)$/);
  if (assetsMatch) return { prefix: 'assets', path: `/${assetsMatch[1]}` };

  const apiMatch = pathname.match(/^\/api\/(.+)$/);
  if (apiMatch) return { prefix: 'api', path: `/${apiMatch[1]}` };

  const objectsMatch = pathname.match(/^\/objects\/(.+)$/);
  if (objectsMatch) return { prefix: 'objects', path: `/${objectsMatch[1]}` };

  return null;
}

const UPSTREAMS = {
  'gh':       'github.com',
  'raw':      'raw.githubusercontent.com',
  'gist':     'gist.github.com',
  'releases': 'github.com',
  'assets':   'github.githubassets.com',
  'api':      'api.github.com',
  'objects':  'objects.githubusercontent.com',
};

console.log('=== GitHub Proxy 路由解析测试 ===\n');

const tests = [
  ['/gh/torvalds/linux', 'https://github.com/torvalds/linux'],
  ['/gh/torvalds/linux/tree/master', 'https://github.com/torvalds/linux/tree/master'],
  ['/raw/torvalds/linux/master/README', 'https://raw.githubusercontent.com/torvalds/linux/master/README'],
  ['/gist/torvalds/12345', 'https://gist.github.com/torvalds/12345'],
  ['/releases/cli/cli/releases/download/v2.40.0/gh.tar.gz', 'https://github.com/cli/cli/releases/download/v2.40.0/gh.tar.gz'],
  ['/releases/owner/repo', 'https://github.com/owner/repo/releases'],
  ['/assets/webpack-runtime-abc123.js', 'https://github.githubassets.com/webpack-runtime-abc123.js'],
  ['/api/repos/torvalds/linux', 'https://api.github.com/repos/torvalds/linux'],
  ['/api/repos/torvalds/linux/releases/latest', 'https://api.github.com/repos/torvalds/linux/releases/latest'],
  ['/objects/githubusercontent.com/repo/file', 'https://objects.githubusercontent.com/githubusercontent.com/repo/file'],
  ['/unknown/path', null],
  ['/', null],
];

let passed = 0, failed = 0;

for (const [inputPath, expected] of tests) {
  const route = parseRoute(inputPath);

  if (expected === null) {
    if (route === null) {
      console.log(`✅ ${inputPath} → (正确拒绝)`);
      passed++;
    } else {
      console.log(`❌ ${inputPath} → 应返回 null，实际: ${JSON.stringify(route)}`);
      failed++;
    }
    continue;
  }

  if (route === null) {
    console.log(`❌ ${inputPath} → 解析失败`);
    failed++;
    continue;
  }

  const actual = `https://${UPSTREAMS[route.prefix]}${route.path}`;

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
  console.log('\n📋 部署步骤:');
  console.log('  1. 将代码推送到 GitHub');
  console.log('  2. 登录阿里云 ESA 控制台');
  console.log('  3. 边缘计算 → 函数和Pages → 创建 → 导入 Github 仓库');
  console.log('  4. 选择 github-proxy 仓库');
  console.log('  5. 构建配置: 静态资源目录 ./public, 函数路径 ./functions/index.js');
  console.log('  6. 开始部署');
}
