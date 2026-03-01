/**
 * MediaService - 组内媒体查看服务
 * 独立模块，负责处理云端文件夹媒体的提交和浏览
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DEFAULT_THUMB_CACHE_SIZE = 260;

class MediaService {
    /**
     * @param {Object} googleService - GoogleService 实例，用于复用认证
     * @param {Object} store - electron-store 实例
     */
    constructor(googleService, store) {
        this.googleService = googleService;
        this.store = store;
        this.drive = null;
        this.sheets = null;
        this.thumbCacheMaxBytes = store?.get('thumbCacheMaxBytes') || 2 * 1024 * 1024 * 1024; // 默认 2GB
        const baseDir = path.dirname(store?.path || path.join(os.homedir() || process.cwd(), '.iten-cache'));
        const savedThumbDir = store?.get('thumbCacheDir');
        this.thumbCacheDir = savedThumbDir || path.join(baseDir, 'thumb-cache');
        this.fileIndexPath = path.join(baseDir, 'media-file-index.json');
        fs.mkdirSync(this.thumbCacheDir, { recursive: true });
        this.lastThumbCleanup = 0;

        // 内存缓存
        this.memoryCache = {
            mediaRecords: null,
            mediaRecordsTime: 0,
            folderDetails: new Map()
        };
        this.CACHE_TTL = 30 * 60 * 1000; // 30分钟缓存过期（延长以减少API调用）
    }

    /**
     * 确保 API 客户端已初始化
     */
    async ensureApis() {
        await this.googleService.ensureAuthClient();
        await this.googleService.ensureApis();

        const authClient = this.googleService.oauthClient;
        if (!this.drive) {
            this.drive = google.drive({ version: 'v3', auth: authClient });
        }
        if (!this.sheets) {
            this.sheets = google.sheets({ version: 'v4', auth: authClient });
        }
    }

    // 文件索引读写
    async loadFileIndex() {
        try {
            if (!fs.existsSync(this.fileIndexPath)) return null;
            const raw = fs.readFileSync(this.fileIndexPath, 'utf-8');
            return JSON.parse(raw);
        } catch (error) {
            console.warn('读取文件索引失败', error);
            return null;
        }
    }

    async saveFileIndex(data) {
        try {
            fs.writeFileSync(this.fileIndexPath, JSON.stringify(data));
            return true;
        } catch (error) {
            console.warn('写入文件索引失败', error);
            return false;
        }
    }

    getFileIndexInfo() {
        if (!fs.existsSync(this.fileIndexPath)) return { exists: false };
        const stat = fs.statSync(this.fileIndexPath);
        return {
            exists: true,
            mtime: stat.mtimeMs,
            size: stat.size,
            path: this.fileIndexPath
        };
    }

    clearFileIndex() {
        if (fs.existsSync(this.fileIndexPath)) {
            try {
                fs.unlinkSync(this.fileIndexPath);
            } catch (error) {
                console.warn('删除文件索引失败', error);
            }
        }
    }

    /**
     * 从 Google Drive 链接中提取文件夹 ID
     * @param {string} value - 文件夹链接或 ID
     * @returns {string} 文件夹 ID
     */
    normalizeFolderId(value) {
        if (!value) {
            return '';
        }
        const trimmed = String(value).trim();

        // 匹配 https://drive.google.com/drive/folders/{folderId}
        const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/i);
        if (folderMatch && folderMatch[1]) {
            return folderMatch[1];
        }

        // 匹配 https://drive.google.com/drive/u/0/folders/{folderId}
        const folderMatch2 = trimmed.match(/\/u\/\d+\/folders\/([a-zA-Z0-9-_]+)/i);
        if (folderMatch2 && folderMatch2[1]) {
            return folderMatch2[1];
        }

        // 如果已经是 ID 格式，直接返回
        return trimmed;
    }

    isValidFolderId(value) {
        const id = this.normalizeFolderId(value);
        if (!id) {
            return false;
        }
        if (id === '.' || id === '..') {
            return false;
        }
        if (id.includes('/') || id.includes('\\')) {
            return false;
        }
        if (id === 'root') {
            return true;
        }
        return /^[A-Za-z0-9_-]{5,}$/.test(id);
    }

    /**
     * 从 Google Sheets 链接中提取 Spreadsheet ID
     * @param {string} value - 表格链接或 ID
     * @returns {string} Spreadsheet ID
     */
    normalizeSpreadsheetId(value) {
        return this.googleService.normalizeSpreadsheetId(value);
    }

    /**
     * 获取媒体配置（使用审核记录表格的配置）
     */
    getConfig() {
        const config = this.store.get('config', {});

        // 使用审核记录表格的配置，不需要单独配置
        return {
            mediaSheetId: config.sheetId || '',  // 使用审核记录的表格ID
            mediaSheetRange: 'MediaRecords!A:H',  // 固定使用 MediaRecords 工作表
            sheetId: config.sheetId || '',
            sheetRange: config.sheetRange || ''
        };
    }

    /**
     * 保存媒体配置（实际不需要保存，因为使用审核记录表格）
     */
    saveConfig(updates) {
        // 不需要单独保存，直接返回当前配置
        return this.getConfig();
    }

    /**
     * 确保 MediaRecords 工作表存在，如果不存在则创建
     * @param {string} spreadsheetId - 表格 ID
     */
    async ensureMediaSheet(spreadsheetId) {
        await this.ensureApis();

        try {
            // 获取表格信息
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId,
                fields: 'sheets.properties'
            });

            const sheets = response.data.sheets || [];
            const mediaSheet = sheets.find(sheet =>
                sheet.properties.title === 'MediaRecords'
            );

            // 如果工作表已存在，补齐列数与表头后返回
            if (mediaSheet) {
                return;
            }

            // 工作表不存在，创建它
            console.log('MediaRecords 工作表不存在，正在创建...');

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: 'MediaRecords',
                                    gridProperties: {
                                        rowCount: 1000,
                                        columnCount: 8
                                    }
                                }
                            }
                        }
                    ]
                }
            });

            // 添加标题行
            const headerRow = [
                '提交人',
                '管理员',
                '文件夹链接',
                '文件夹ID',
                '内容类型',
                '提交时间',
                '文件数量',
                '备注'
            ];

            await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'MediaRecords!A1:H1',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [headerRow]
                }
            });

            console.log('MediaRecords 工作表创建成功');
        } catch (error) {
            console.error('检查/创建 MediaRecords 工作表失败:', error);
            throw new Error('无法创建 MediaRecords 工作表: ' + error.message);
        }
    }

    /**
     * 读取指定 Google Drive 文件夹中的所有媒体文件
     * @param {string} folderId - 文件夹 ID
     * @param {Object} options - 选项
     * @param {boolean} options.recursive - 是否递归读取子文件夹
     * @param {number} options.maxResults - 最大结果数
     * @param {boolean} options.fastMode - 快速模式，限制首批加载数量
     * @returns {Promise<Array>} 文件列表
     */
    async getMediaFilesFromFolder(folderId, options = {}) {
        await this.ensureApis();

        const files = [];
        const mimeTypes = {
            image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
            video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/x-ms-wmv', 'video/x-flv', 'video/mpeg', 'video/x-m4v']
        };

        const allMediaTypes = [...mimeTypes.image, ...mimeTypes.video];

        // 读取当前文件夹的媒体文件
        const q = `'${folderId}' in parents and trashed=false and (${allMediaTypes.map(mt => `mimeType='${mt}'`).join(' or ')})`;

        let pageToken = null;
        // 快速模式下限制首批加载数量
        const maxResults = options.fastMode ? Math.min(100, options.maxResults || 100) : (options.maxResults || 10000);
        // 使用更大的页面大小减少API调用
        const pageSize = Math.min(200, maxResults);

        do {
            const response = await this.drive.files.list({
                q,
                pageSize: Math.min(pageSize, maxResults - files.length),
                pageToken,
                // 精简字段，加速响应（避免 permissions, owners, contentHints 等慢字段）
                fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink)',
                orderBy: 'modifiedTime desc'
            });

            if (response.data.files && response.data.files.length > 0) {
                files.push(...response.data.files.map(file => ({
                    id: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    type: (() => {
                        const mt = (file.mimeType || '').toLowerCase();
                        if (mimeTypes.image.includes(mt)) return 'image';
                        if (mt.startsWith('video/')) return 'video';
                        if (mimeTypes.video.includes(mt)) return 'video';
                        const name = file.name || '';
                        if (/\.(mp4|m4v|mov|mkv|avi|wmv|flv|webm|mpg|mpeg|m2ts)$/i.test(name)) {
                            return 'video';
                        }
                        return 'other';
                    })(),
                    thumbnailLink: file.thumbnailLink,
                    webViewLink: file.webViewLink
                })));
            }

            pageToken = response.data.nextPageToken;

            if (files.length >= maxResults) {
                break;
            }
        } while (pageToken);

        // 如果需要递归读取子文件夹
        if (options.recursive && files.length < maxResults) {
            const subFolders = await this.getSubFolders(folderId);

            // 并行获取子文件夹内容（最多5个并发）
            const CONCURRENCY = 5;
            const remainingSlots = maxResults - files.length;

            for (let i = 0; i < subFolders.length && files.length < maxResults; i += CONCURRENCY) {
                const batch = subFolders.slice(i, i + CONCURRENCY);
                const promises = batch.map(folder =>
                    this.getMediaFilesFromFolder(folder.id, {
                        ...options,
                        maxResults: Math.ceil(remainingSlots / batch.length),
                        recursive: false // 避免深度递归
                    }).catch(error => {
                        console.warn(`无法读取子文件夹 ${folder.name}:`, error.message);
                        return [];
                    })
                );

                const results = await Promise.all(promises);
                results.forEach(subFiles => {
                    if (files.length < maxResults) {
                        files.push(...subFiles.slice(0, maxResults - files.length));
                    }
                });
            }
        }

        return files;
    }

    /**
     * 获取文件夹的所有子文件夹
     * @param {string} folderId - 父文件夹 ID
     * @returns {Promise<Array>} 子文件夹列表
     */
    async getSubFolders(folderId) {
        await this.ensureApis();

        const folders = [];
        const q = `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        let pageToken = null;

        do {
            const response = await this.drive.files.list({
                q,
                pageSize: 200,
                pageToken,
                fields: 'nextPageToken, files(id, name, modifiedTime, createdTime)',
                orderBy: 'folder, name'
            });

            if (response.data.files && response.data.files.length > 0) {
                folders.push(...response.data.files.map(folder => ({
                    id: folder.id,
                    name: folder.name,
                    modifiedTime: folder.modifiedTime,
                    createdTime: folder.createdTime,
                    hasChildren: true // 默认标记有子项，前端懒加载
                })));
            }

            pageToken = response.data.nextPageToken;
        } while (pageToken);

        return folders;
    }

    /**
     * 获取目录树（懒加载用）
     * @param {string} folderId
     * @returns {Promise<Array>} 子目录列表
     */
    async getFolderTree(folderId) {
        return this.getSubFolders(folderId);
    }

    /**
     * 获取文件缩略图 URL
     * @param {string} fileId - 文件 ID
     * @param {number} size - 缩略图大小
     * @returns {string} 缩略图 URL
     */
    getThumbnailUrl(fileId, size = 400) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
    }

    /**
     * 获取缓存的缩略图路径
     */
    async getCachedThumbnail(fileId, size = 200) {
        if (!fileId) return null;
        const target = path.join(this.thumbCacheDir, `${fileId}_${size}.jpg`);
        if (fs.existsSync(target)) {
            return target;
        }
        // 如果请求的尺寸不存在,回退到统一的默认缓存尺寸,避免重复生成
        if (size !== DEFAULT_THUMB_CACHE_SIZE) {
            const fallback = path.join(this.thumbCacheDir, `${fileId}_${DEFAULT_THUMB_CACHE_SIZE}.jpg`);
            if (fs.existsSync(fallback)) {
                return fallback;
            }
        }
        return null;
    }

    /**
     * 下载并缓存缩略图
     */
    async cacheThumbnail(fileId, size = 200) {
        const cached = await this.getCachedThumbnail(fileId, size);
        if (cached) return cached;
        await this.ensureApis();
        const url = this.getThumbnailUrl(fileId, size);
        const destPath = path.join(this.thumbCacheDir, `${fileId}_${size}.jpg`);
        await this.downloadToFile(url, destPath);
        await this.maybeCleanupThumbCache();
        return destPath;
    }

    /**
     * 直接保存标注图片到缩略图缓存
     */
    async saveAnnotatedThumbnail(fileId, imageBuffer, sizes = [DEFAULT_THUMB_CACHE_SIZE]) {
        if (!fileId || !imageBuffer) return null;
        await fs.promises.mkdir(this.thumbCacheDir, { recursive: true });
        const targets = [];
        for (const size of sizes) {
            const destPath = path.join(this.thumbCacheDir, `${fileId}_${size}.jpg`);
            await fs.promises.writeFile(destPath, imageBuffer);
            targets.push(destPath);
        }
        await this.maybeCleanupThumbCache();
        return targets;
    }

    /**
     * 下载文件到本地
     */
    async downloadToFile(url, destPath) {
        // 对于 Google Drive 缩略图,不能用普通 HTTPS(会 403)
        // 必须用 Drive API 的认证请求
        const fileIdMatch = url.match(/[?&]id=([^&]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
            // 使用 Drive API 下载缩略图
            await this.downloadThumbnailWithAuth(fileIdMatch[1], destPath, url);
            return;
        }

        // 其他 URL 使用普通 HTTPS
        const https = require('https');
        await new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(destPath);
            let streamOpened = false;

            https.get(url, (res) => {
                if (res.statusCode !== 200) {
                    fileStream.close();
                    // 删除空文件
                    fs.unlink(destPath, () => {
                        reject(new Error(`请求失败，状态码 ${res.statusCode}`));
                    });
                    res.resume();
                    return;
                }
                streamOpened = true;
                res.pipe(fileStream);
                fileStream.on('finish', () => fileStream.close(resolve));
            }).on('error', (err) => {
                if (!streamOpened) {
                    fileStream.close();
                }
                fs.unlink(destPath, () => reject(err));
            });

            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => reject(err));
            });
        });
    }

    /**
     * 使用认证的 Drive API 下载缩略图
     */
    async downloadThumbnailWithAuth(fileId, destPath, originalUrl) {
        await this.ensureApis();

        try {
            // 获取文件元数据,检查是否有 thumbnailLink
            const metadata = await this.drive.files.get({
                fileId,
                fields: 'thumbnailLink,mimeType'
            });

            let thumbnailUrl = metadata.data.thumbnailLink;

            // 如果没有 thumbnailLink，尝试其他方式
            if (!thumbnailUrl) {
                // 对于图片类型，可以使用原文件作为缩略图
                const mimeType = metadata.data.mimeType || '';
                if (mimeType.startsWith('image/')) {
                    console.log(`文件 ${fileId} 无缩略图，尝试下载原图`);
                    const response = await this.drive.files.get(
                        { fileId, alt: 'media' },
                        { responseType: 'stream' }
                    );

                    await new Promise((resolve, reject) => {
                        const dest = fs.createWriteStream(destPath);
                        response.data
                            .on('error', reject)
                            .pipe(dest)
                            .on('error', reject)
                            .on('finish', resolve);
                    });
                    return;
                }
                // 对于视频，没有缩略图就抛错
                throw new Error('该文件没有可用的缩略图');
            }

            // 调整缩略图尺寸 (thumbnailLink 默认是 s220，我们要更大的)
            thumbnailUrl = thumbnailUrl.replace(/=s\d+/, '=s400');

            // 使用 OAuth 认证下载缩略图
            const authClient = this.googleService.oauthClient;
            const accessToken = (await authClient.getAccessToken()).token;

            const https = require('https');
            const url = require('url');
            const parsedUrl = new URL(thumbnailUrl);

            await new Promise((resolve, reject) => {
                const options = {
                    hostname: parsedUrl.hostname,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                };

                const req = https.request(options, (res) => {
                    // 处理重定向
                    if (res.statusCode === 302 || res.statusCode === 301) {
                        const redirectUrl = res.headers.location;
                        // 对重定向 URL 再次请求
                        https.get(redirectUrl, (redirectRes) => {
                            if (redirectRes.statusCode !== 200) {
                                reject(new Error(`重定向请求失败: ${redirectRes.statusCode}`));
                                return;
                            }
                            const dest = fs.createWriteStream(destPath);
                            redirectRes.pipe(dest);
                            dest.on('finish', resolve);
                            dest.on('error', reject);
                        }).on('error', reject);
                        return;
                    }

                    if (res.statusCode !== 200) {
                        reject(new Error(`请求失败: ${res.statusCode}`));
                        return;
                    }

                    const dest = fs.createWriteStream(destPath);
                    res.pipe(dest);
                    dest.on('finish', resolve);
                    dest.on('error', reject);
                });

                req.on('error', reject);
                req.end();
            });

        } catch (error) {
            // 确保删除空文件
            if (fs.existsSync(destPath)) {
                try {
                    const stat = fs.statSync(destPath);
                    if (stat.size === 0) {
                        fs.unlinkSync(destPath);
                    }
                } catch (e) {
                    // ignore
                }
            }
            throw error;
        }
    }

    async maybeCleanupThumbCache() {
        const now = Date.now();
        // 防抖,避免每次写入都遍历磁盘
        if (this.lastThumbCleanup && now - this.lastThumbCleanup < 10000) {
            return;
        }
        this.lastThumbCleanup = now;
        try {
            const info = this.getThumbCacheInfo();
            if (info.total > this.thumbCacheMaxBytes) {
                await this.cleanupThumbCache(this.thumbCacheMaxBytes);
            }
        } catch (error) {
            console.warn('检查缩略图缓存容量失败', error);
        }
    }

    /**
     * 清理缩略图缓存（LRU）
     * @param {number} maxBytes - 最大保留容量，默认 2GB
     */
    async cleanupThumbCache(maxBytes = this.thumbCacheMaxBytes) {
        const files = fs.readdirSync(this.thumbCacheDir)
            .map(name => {
                const full = path.join(this.thumbCacheDir, name);
                const stat = fs.statSync(full);
                return { full, mtime: stat.mtimeMs, size: stat.size };
            })
            .sort((a, b) => b.mtime - a.mtime); // 新的在前

        let total = files.reduce((sum, f) => sum + f.size, 0);
        if (total <= maxBytes) return;

        for (let i = files.length - 1; i >= 0 && total > maxBytes; i--) {
            try {
                fs.unlinkSync(files[i].full);
                total -= files[i].size;
            } catch (err) {
                console.warn('删除缓存失败', err);
            }
        }
    }

    getThumbCacheInfo() {
        const files = fs.readdirSync(this.thumbCacheDir).map(name => {
            const full = path.join(this.thumbCacheDir, name);
            const stat = fs.statSync(full);
            return { full, size: stat.size, mtime: stat.mtimeMs };
        });
        const total = files.reduce((sum, f) => sum + f.size, 0);
        return { total, count: files.length, dir: this.thumbCacheDir, maxBytes: this.thumbCacheMaxBytes };
    }

    setThumbCacheMaxBytes(maxBytes) {
        const parsed = Number(maxBytes);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return this.getThumbCacheInfo();
        }
        this.thumbCacheMaxBytes = parsed;
        this.store?.set('thumbCacheMaxBytes', parsed);
        // 清理一次以符合新上限
        this.cleanupThumbCache(parsed);
        return this.getThumbCacheInfo();
    }

    setThumbCacheDir(dirPath) {
        if (!dirPath) return this.getThumbCacheInfo();
        try {
            fs.mkdirSync(dirPath, { recursive: true });
            this.thumbCacheDir = dirPath;
            this.store?.set('thumbCacheDir', dirPath);
            return this.getThumbCacheInfo();
        } catch (error) {
            console.warn('设置缩略图缓存目录失败', error);
            return this.getThumbCacheInfo();
        }
    }

    /**
     * 获取文件预览 URL
     * @param {string} fileId - 文件 ID
     * @returns {string} 预览 URL
     */
    getPreviewUrl(fileId) {
        return `https://drive.google.com/file/d/${fileId}/view`;
    }

    /**
     * 提交媒体记录到 Google Sheets
     * @param {Object} record - 媒体记录
     * @returns {Promise<Object>} 提交结果
     */
    async submitMediaRecord(record) {
        await this.ensureApis();

        const config = this.getConfig();
        const spreadsheetId = this.normalizeSpreadsheetId(config.mediaSheetId);

        if (!spreadsheetId) {
            throw new Error('未配置媒体记录表格 ID，请在设置中配置');
        }

        // 确保 MediaRecords 工作表存在
        await this.ensureMediaSheet(spreadsheetId);

        const folderId = this.normalizeFolderId(record.folderLink);
        if (!folderId) {
            throw new Error('无效的文件夹链接');
        }

        // 读取文件夹内容获取文件数量
        let fileCount = 0;
        try {
            const files = await this.getMediaFilesFromFolder(folderId, { maxResults: 1000 });
            fileCount = files.length;
        } catch (error) {
            console.warn('无法读取文件夹内容:', error.message);
        }

        const now = new Date();
        const timestamp = now.toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        // 准备行数据
        const row = [
            record.submitter || '',           // A: 提交人
            record.admin || '',                // B: 管理员
            record.folderLink || '',           // C: 文件夹链接
            folderId || '',                    // D: 文件夹ID
            record.contentType || '',          // E: 内容类型
            timestamp,                         // F: 提交时间
            fileCount.toString(),              // G: 文件数量
            record.notes || ''                 // H: 备注
        ];

        // 追加到表格
        const range = config.mediaSheetRange || 'MediaRecords!A:H';
        await this.sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',  // 防止筛选器导致数据覆盖
            requestBody: {
                values: [row]
            }
        });

        return {
            success: true,
            folderId,
            fileCount,
            timestamp
        };
    }

    /**
     * 从 Google Sheets 获取所有媒体记录
     * @param {Object} filters - 筛选条件（已移至前端处理）
     * @param {boolean} forceRefresh - 是否强制刷新缓存
     * @returns {Promise<Array>} 媒体记录列表
     */
    async getMediaRecords(filters = {}, forceRefresh = false) {
        // 检查内存缓存
        const now = Date.now();
        if (!forceRefresh &&
            this.memoryCache.mediaRecords &&
            now - this.memoryCache.mediaRecordsTime < this.CACHE_TTL) {
            console.log('使用媒体记录内存缓存');
            return this.memoryCache.mediaRecords;
        }

        await this.ensureApis();

        const config = this.getConfig();
        const spreadsheetId = this.normalizeSpreadsheetId(config.mediaSheetId);

        if (!spreadsheetId) {
            return [];
        }

        const range = config.mediaSheetRange || 'MediaRecords!A:H';

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range
            });

            const rows = response.data.values || [];

            // 跳过标题行
            const dataRows = rows.slice(1);

            const records = dataRows
                .map((row, index) => {
                    const folderId = this.normalizeFolderId(row[3] || row[2] || '');
                    return {
                        rowIndex: index + 2, // +2 因为 sheet 从1开始，且跳过标题行
                        submitter: row[0] || '',
                        admin: row[1] || '',
                        folderLink: row[2] || '',
                        folderId,
                        contentType: row[4] || '',
                        submitTime: row[5] || '',
                        fileCount: parseInt(row[6]) || 0,
                        notes: row[7] || ''
                    };
                })
                .filter(record => this.isValidFolderId(record.folderId)); // 过滤掉无效记录

            // 缓存结果
            this.memoryCache.mediaRecords = records;
            this.memoryCache.mediaRecordsTime = now;

            // 筛选已移至前端处理，后端返回全部记录
            return records;
        } catch (error) {
            console.error('获取媒体记录失败:', error);
            // 如果有缓存，返回缓存（即使过期）
            if (this.memoryCache.mediaRecords) {
                console.log('API失败，使用过期缓存');
                return this.memoryCache.mediaRecords;
            }
            return [];
        }
    }

    /**
     * 清除媒体记录缓存
     */
    clearMediaRecordsCache() {
        this.memoryCache.mediaRecords = null;
        this.memoryCache.mediaRecordsTime = 0;
    }

    /**
     * 获取文件夹详情（包括文件列表）
     * @param {string} folderId - 文件夹 ID
     * @param {Object} options - 选项
     * @returns {Promise<Object>} 文件夹详情
     */
    async getFolderDetails(folderId, options = {}) {
        const normalizedFolderId = this.normalizeFolderId(folderId);
        if (!this.isValidFolderId(normalizedFolderId)) {
            throw new Error('无效的文件夹 ID');
        }

        // 检查内存缓存
        const cacheKey = `${normalizedFolderId}_${JSON.stringify(options)}`;
        const cached = this.memoryCache.folderDetails.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            console.log('使用文件夹详情内存缓存');
            return cached.data;
        }

        await this.ensureApis();

        // 并行获取文件列表、文件夹信息和子文件夹
        const [files, folderInfo, subFolders] = await Promise.all([
            this.getMediaFilesFromFolder(normalizedFolderId, { ...options, fastMode: true }),
            this.drive.files.get({
                fileId: normalizedFolderId,
                fields: 'name'
            }).then(res => res.data.name || '').catch(err => {
                console.warn('无法获取文件夹名称:', err.message);
                return '';
            }),
            this.getSubFolders(normalizedFolderId).catch(err => {
                console.warn('无法获取子文件夹列表:', err.message);
                return [];
            })
        ]);

        const result = {
            folderId: normalizedFolderId,
            folderName: folderInfo,
            files,
            fileCount: files.length,
            images: files.filter(f => f.type === 'image'),
            videos: files.filter(f => f.type === 'video'),
            subFolders
        };

        // 缓存结果
        this.memoryCache.folderDetails.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });

        // 限制缓存大小
        if (this.memoryCache.folderDetails.size > 100) {
            const oldestKey = this.memoryCache.folderDetails.keys().next().value;
            this.memoryCache.folderDetails.delete(oldestKey);
        }

        // 后台预缓存缩略图（不阻塞返回）
        this.prefetchThumbnails(files).catch(err => {
            console.warn('后台预缓存缩略图失败:', err.message);
        });

        return result;
    }

    /**
     * 后台预缓存缩略图
     * @param {Array} files - 文件列表
     * @param {number} concurrency - 并发数
     */
    async prefetchThumbnails(files, concurrency = 15) {
        if (!files || files.length === 0) return;

        // 筛选出图片和视频文件
        const mediaFiles = files.filter(f => f.type === 'image' || f.type === 'video');
        if (mediaFiles.length === 0) return;

        console.log(`开始后台预缓存 ${mediaFiles.length} 个缩略图...`);

        let cached = 0;
        let skipped = 0;
        let failed = 0;

        // 使用限制并发的方式处理
        for (let i = 0; i < mediaFiles.length; i += concurrency) {
            const batch = mediaFiles.slice(i, i + concurrency);
            const promises = batch.map(async (file) => {
                try {
                    // 检查是否已有缓存
                    const existingCache = await this.getCachedThumbnail(file.id, 200);
                    if (existingCache) {
                        skipped++;
                        return;
                    }

                    // 下载并缓存
                    await this.cacheThumbnail(file.id, 200);
                    cached++;
                } catch (error) {
                    failed++;
                    // 静默失败，不影响其他文件
                }
            });

            await Promise.all(promises);
        }

        console.log(`预缓存完成: 缓存${cached}个, 跳过${skipped}个, 失败${failed}个`);
    }

    /**
     * 下载一组文件到本地目录（平铺）
     * @param {Array} files - [{id,name}]
     * @param {string} destDir - 目标目录
     */
    async downloadFiles(files = [], destDir = '') {
        await this.ensureApis();

        if (!Array.isArray(files) || files.length === 0) {
            return { success: false, message: '无可下载文件', results: [] };
        }

        const targetDir = destDir || path.join(require('os').homedir(), 'Downloads', 'ITEN媒体');
        fs.mkdirSync(targetDir, { recursive: true });

        const results = [];

        for (const file of files) {
            if (!file?.id) continue;
            const baseName = (file.name || file.id || 'file').replace(/[\\/:*?"<>|]/g, '_');
            let finalName = baseName;
            let idx = 1;
            while (fs.existsSync(path.join(targetDir, finalName))) {
                const extIndex = baseName.lastIndexOf('.');
                if (extIndex > 0) {
                    const namePart = baseName.slice(0, extIndex);
                    const ext = baseName.slice(extIndex);
                    finalName = `${namePart}(${idx})${ext}`;
                } else {
                    finalName = `${baseName}(${idx})`;
                }
                idx += 1;
            }

            const targetPath = path.join(targetDir, finalName);

            try {
                const response = await this.drive.files.get(
                    { fileId: file.id, alt: 'media' },
                    { responseType: 'stream' }
                );

                await new Promise((resolve, reject) => {
                    const dest = fs.createWriteStream(targetPath);
                    response.data
                        .on('error', reject)
                        .pipe(dest)
                        .on('error', reject)
                        .on('finish', resolve);
                });

                results.push({ id: file.id, name: file.name, path: targetPath, status: 'success' });
            } catch (error) {
                results.push({ id: file.id, name: file.name, status: 'error', message: error.message });
            }
        }

        const failed = results.filter(r => r.status === 'error').length;
        return {
            success: failed === 0,
            results,
            message: failed ? `部分失败：${failed}/${results.length}` : `成功下载 ${results.length} 个文件`
        };
    }
}

module.exports = { MediaService };
