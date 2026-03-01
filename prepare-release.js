const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const version = packageJson.version;

const distDir = path.join(__dirname, 'dist');
const releaseDir = path.join(__dirname, 'release_site');

// 1. 创建或清空发布目录
if (fs.existsSync(releaseDir)) {
    fs.rmSync(releaseDir, { recursive: true, force: true });
}
fs.mkdirSync(releaseDir);

console.log(`📦 正在准备版本 v${version} 的发布文件...`);

// 2. 查找并复制关键文件
if (!fs.existsSync(distDir)) {
    console.error('❌ 错误：找不到 dist 目录。请先运行 npm run dist 打包项目。');
    process.exit(1);
}

const files = fs.readdirSync(distDir);
let count = 0;

files.forEach(file => {
    const isYml = file.endsWith('.yml');
    const isBinary = file.endsWith('.dmg') ||
        file.endsWith('.exe') ||
        file.endsWith('.zip') ||
        file.endsWith('.deb') ||
        file.endsWith('.blockmap');

    if (!isYml && !isBinary) return;

    // 逻辑：
    // 1. 所有的 .yml 文件都保留（update 检测必需，如 latest.yml）
    // 2. 二进制文件（dmg/exe/zip/blockmap）必须包含当前版本号
    const shouldCopy = isYml || (isBinary && file.includes(version));

    if (shouldCopy) {
        const srcPath = path.join(distDir, file);
        const destPath = path.join(releaseDir, file);

        // 确保是文件而不是目录
        if (fs.statSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`  -> 已复制: ${file}`);
            count++;
        }
    }
});

if (count === 0) {
    console.warn(`⚠️ 警告：在 dist 目录中没有找到版本 ${version} 相关的发布文件。`);
    console.warn('   请确认打包是否成功？');
} else {
    // 生成 index.html（Netlify 需要至少一个 HTML 文件）
    const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ITEN上传工具 - 自动更新服务</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
      backdrop-filter: blur(10px);
      max-width: 500px;
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p { opacity: 0.9; line-height: 1.6; margin-bottom: 1.5rem; }
    .version { 
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
    }
    .note {
      margin-top: 2rem;
      font-size: 0.85rem;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 ITEN上传工具</h1>
    <p>这是自动更新服务器。<br>应用程序会自动从此处检测并下载更新。</p>
    <div class="version">当前版本: v${version}</div>
    <p class="note">如果你是普通用户，请直接打开已安装的应用程序。<br>更新会自动推送。</p>
  </div>
</body>
</html>`;
    fs.writeFileSync(path.join(releaseDir, 'index.html'), indexHtml);
    console.log(`  -> 已生成: index.html`);
    count++;

    console.log(`\n✅ 准备完成！仅提取了与 v${version} 相关的 ${count} 个关键文件。\n`);
    console.log('-------------------------------------------------------');
    console.log('🚀 下一步操作：');
    console.log('1. 打开 https://app.netlify.com/drop');
    console.log(`2. 将项目根目录下的 "release_site" 文件夹拖进去。`);
    console.log('3. 复制生成的网址，填入 package.json 的 "url" 字段（如果网址变了）。');
    console.log('-------------------------------------------------------');
}
