# 自动更新部署说明

## Netlify 账号信息

- **邮箱**: vitalitate14@gmail.com
- **站点名称**: gorgeous-kashata-c9da30
- **站点URL**: https://gorgeous-kashata-c9da30.netlify.app/
- **控制台**: https://app.netlify.com/

## 发布新版本步骤

### 1. 修改版本号
在 `package.json` 中修改 `version` 字段：
```json
"version": "x.x.x"
```

### 2. 打包应用
```bash
npm run dist
```

### 3. 上传到 Netlify
打包完成后，将 `dist` 目录下的以下文件上传到 Netlify：

**Mac 版本文件：**
- `ITEN上传工具-x.x.x-arm64.dmg`
- `ITEN上传工具-x.x.x-arm64.dmg.blockmap`
- `latest-mac.yml`

**Windows 版本文件（如有）：**
- `ITEN上传工具 Setup x.x.x.exe`
- `ITEN上传工具 Setup x.x.x.exe.blockmap`
- `latest.yml`

### 4. 上传方式
1. 登录 https://app.netlify.com/
2. 进入站点 `gorgeous-kashata-c9da30`
3. 点击 **Deploys** 标签
4. 将文件拖拽到上传区域即可

## 更新检测原理

应用启动时会检查：
- Mac: `https://gorgeous-kashata-c9da30.netlify.app/latest-mac.yml`
- Windows: `https://gorgeous-kashata-c9da30.netlify.app/latest.yml`

如果检测到新版本号，会提示用户下载更新。

---
*最后更新: 2024-12-22*
