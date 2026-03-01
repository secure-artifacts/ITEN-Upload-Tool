const { BrowserWindow, shell, app } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// ============================================================
// 🌐 外挂模式配置 - 设置外部网站 URL
// ============================================================
const EXTERNAL_URL = 'https://ai-toolkit-b2b78.web.app'; // ← 您的网站
const USE_EXTERNAL = true;  // 设置为 false 则使用本地 dist
// ============================================================

class AiToolkitService {
    constructor(appPath) {
        this.appPath = appPath;
        this.useExternal = USE_EXTERNAL && EXTERNAL_URL;
        this.externalUrl = EXTERNAL_URL;

        if (this.useExternal) {
            console.log('[AiToolkit] 🌐 外挂模式已启用');
            console.log('[AiToolkit] 目标 URL:', this.externalUrl);
            this.distPath = null;
        } else {
            // Try multiple possible paths for the AI toolkit dist folder
            const possiblePaths = [
                path.join(appPath, 'ai-创作工具包', 'dist'),
                path.join(appPath, '..', 'ai-创作工具包', 'dist'),
                path.join(process.resourcesPath || appPath, 'app', 'ai-创作工具包', 'dist'),
                path.join(appPath, 'resources', 'app', 'ai-创作工具包', 'dist')
            ];

            this.distPath = possiblePaths.find(p => {
                try {
                    return fsSync.existsSync(path.join(p, 'index.html'));
                } catch {
                    return false;
                }
            }) || possiblePaths[0];

            console.log('[AiToolkit] 📁 本地模式');
            console.log('[AiToolkit] Dist path:', this.distPath);
        }

        this.port = 4173;
        this.server = null;
        this.window = null;
    }

    getMime(filePath) {
        const mimeMap = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.ico': 'image/x-icon',
            '.wasm': 'application/wasm',
            '.map': 'application/json',
            '.txt': 'text/plain',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf'
        };
        return mimeMap[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    }

    async startServer() {
        // 外挂模式不需要本地服务器
        if (this.useExternal) {
            console.log('[AiToolkit] 🌐 外挂模式，跳过本地服务器');
            return;
        }
        if (this.server) return;

        const requestHandler = async (req, res) => {
            const url = new URL(req.url || '/', `http://localhost:${this.port}`);
            const cleanPath = decodeURIComponent(url.pathname);
            let targetPath = path.join(this.distPath, cleanPath);

            // Prevent path traversal
            if (!targetPath.startsWith(this.distPath)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            try {
                const stats = await fs.stat(targetPath);
                if (stats.isDirectory()) {
                    targetPath = path.join(targetPath, 'index.html');
                }
            } catch {
                // Fallback to SPA entry
                targetPath = path.join(this.distPath, 'index.html');
            }

            try {
                const data = await fs.readFile(targetPath);
                res.writeHead(200, { 'Content-Type': this.getMime(targetPath) });
                res.end(data);
            } catch (err) {
                console.error('[AiToolkit] Failed to serve', targetPath, err);
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        };

        this.server = http.createServer(requestHandler);
        return new Promise((resolve, reject) => {
            this.server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`[AiToolkit] Port ${this.port} in use, trying ${this.port + 1}`);
                    this.port++;
                    this.server.listen(this.port, '127.0.0.1');
                } else {
                    console.error('[AiToolkit] Server error:', err);
                    reject(err);
                }
            });
            this.server.listen(this.port, '127.0.0.1', () => {
                console.log(`[AiToolkit] Serving at http://localhost:${this.port}`);
                console.log(`[AiToolkit] Serving files from: ${this.distPath}`);
                resolve();
            });
        });
    }

    async openWindow() {
        // 只在本地模式下启动服务器
        if (!this.useExternal) {
            await this.startServer();
        }

        if (this.window && !this.window.isDestroyed()) {
            this.window.show();
            this.window.focus();
            return;
        }

        this.window = new BrowserWindow({
            width: 1280,
            height: 800,
            title: 'AI 创作工具包',
            autoHideMenuBar: true,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        const chromeUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.window.webContents.setUserAgent(chromeUserAgent);

        // Header spoofing
        this.window.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
            const url = details.url;
            const headers = { ...details.requestHeaders }; // Clone headers

            delete headers['X-Electron-Version'];
            delete headers['X-Devtools-Emulate-Network-Conditions-Client-Id'];
            headers['User-Agent'] = chromeUserAgent;

            try {
                const urlHost = new URL(url).hostname;
                if (urlHost.endsWith('.googleapis.com') ||
                    urlHost.endsWith('.google.com') ||
                    urlHost === 'googleapis.com' ||
                    urlHost === 'google.com') {
                    headers['Origin'] = 'https://aistudio.google.com';
                    headers['Referer'] = 'https://aistudio.google.com/';
                }
            } catch (e) { /* ignore invalid URLs */ }
            callback({ requestHeaders: headers });
        });

        // 根据模式加载对应的 URL
        const targetUrl = this.useExternal ? this.externalUrl : `http://localhost:${this.port}`;
        console.log('[AiToolkit] 正在加载:', targetUrl);
        this.window.loadURL(targetUrl);

        this.window.on('closed', () => {
            this.window = null;
        });

        this.window.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });
    }

    async getUrl() {
        // 外挂模式直接返回外部 URL
        if (this.useExternal) {
            console.log('[AiToolkit] 🌐 返回外挂 URL:', this.externalUrl);
            return this.externalUrl;
        }

        try {
            console.log('[AiToolkit] getUrl called, attempting to start server...');
            await this.startServer();
            console.log('[AiToolkit] Server started successfully');
            return `http://localhost:${this.port}`;
        } catch (err) {
            console.error('[AiToolkit] Failed to start server:', err);
            throw err;
        }
    }

    close() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}

module.exports = { AiToolkitService };
