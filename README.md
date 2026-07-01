# GitHub Proxy - GitHub 加速代理

基于 **阿里云 ESA Pages** 的 GitHub 反向代理服务，通过导入 GitHub 仓库一键部署。

## 🚀 快速部署

### 1. Fork 或使用本仓库

仓库地址：`https://github.com/xiaoxiaozhou-zcx/github-proxy`

### 2. 在 ESA 控制台导入

1. 登录 [阿里云 ESA 控制台](https://esa.console.aliyun.com/)
2. 左侧导航：**边缘计算和 AI → 函数和Pages**
3. 点击 **创建** → 选择 **导入 Github 仓库**
4. 授权并选择 `github-proxy` 仓库
5. 填写构建信息：

| 配置项 | 值 |
|--------|-----|
| 生产分支 | `main` |
| 安装命令 | *(留空)* |
| 构建命令 | *(留空)* |
| 根目录 | `/` |
| 静态资源目录 | `./public` |
| 函数文件路径 | `./functions/index.js` |

6. 点击 **开始部署**

### 3. 配置自定义域名（可选）

部署完成后会自动生成一个 `.esa.pages.dev` 域名。如需自定义域名：
在 ESA 控制台 → **域名配置** 中绑定你的域名。

---

## 📡 代理路径

| 路径前缀 | 代理目标 | 用途 |
|----------|----------|------|
| `/gh/` | github.com | 浏览仓库、Git Clone |
| `/raw/` | raw.githubusercontent.com | 下载原始文件 |
| `/gist/` | gist.github.com | Gist 访问 |
| `/releases/` | github.com/.../releases | Release 下载 |
| `/assets/` | github.githubassets.com | 静态资源 |
| `/api/` | api.github.com | GitHub API |
| `/objects/` | objects.githubusercontent.com | Git Objects |

---

## 📖 使用示例

### Git Clone 加速

```bash
# 直接克隆
git clone https://<your-domain>/gh/user/repo

# 全局配置（推荐，所有 github.com 操作自动走代理）
git config --global url."https://<your-domain>/gh/".insteadOf "https://github.com/"
```

### 下载 Raw 文件

```bash
curl https://<your-domain>/raw/user/repo/main/file.txt
```

### 下载 Release 文件

```bash
wget https://<your-domain>/releases/user/repo/releases/download/v1.0/file.zip
```

### GitHub API

```bash
curl https://<your-domain>/api/repos/user/repo/releases/latest
```

---

## 📁 项目结构

```
github-proxy/
├── esa.jsonc             # ESA Pages 构建配置
├── public/
│   └── index.html        # 静态首页（使用说明）
├── functions/
│   └── index.js          # Edge Function（代理核心逻辑）
├── test.js               # 路由测试脚本
└── README.md
```

### 工作原理

1. 用户请求到达 ESA 边缘节点
2. ESA 先查找 `public/` 目录下的静态文件
3. 未命中静态文件 → 执行 `functions/index.js` 边缘函数
4. Edge Function 解析路径，转发请求到对应 GitHub 上游
5. 重写响应内容中的 GitHub 域名引用，返回给用户

---

## 🔧 本地测试

```bash
node test.js
```

---

## ⚙️ 高级配置

### 使用 GitHub Token 提高 API 限制

在 ESA 控制台的 **环境变量** 中添加：

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

然后在 `functions/index.js` 的 `cleanRequestHeaders` 函数中添加：

```js
const token = typeof process !== 'undefined' && process.env?.GITHUB_TOKEN;
if (token) {
  cleaned.set('Authorization', `token ${token}`);
}
```

---

## 📄 License

MIT
