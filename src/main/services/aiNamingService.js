'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * AI 智能命名服务
 * 调用 Gemini Vision API，从用户自定义的关键词词库中
 * 挑选与图片内容最匹配的关键词，用于文件命名增强。
 */
class AiNamingService {
    constructor() {
        this._apiKey = '';
        this._keywordLibrary = [];   // 用户自定义的关键词词库（扁平字符串数组）
        this._keywordCount = 3;      // 每次选取的关键词数量
        this._separator = '_';       // 关键词之间的分隔符
        this._enabled = false;       // 总开关
        this._cache = new Map();     // 缓存: fileKey -> { keywords, timestamp }
        this._cacheTTL = 5 * 60 * 1000;  // 缓存 5 分钟
        this._concurrency = 3;      // 最大并发请求
        this._activeRequests = 0;
        this._queue = [];
        this._model = 'gemini-2.5-flash';  // 稳定版 Flash（速度快、成本低、视觉能力强）
    }

    /**
     * 更新配置
     * @param {object} config
     */
    setConfig(config = {}) {
        if (config.aiNamingApiKey !== undefined) this._apiKey = config.aiNamingApiKey || '';
        if (config.aiNamingEnabled !== undefined) this._enabled = Boolean(config.aiNamingEnabled);
        if (config.aiNamingKeywordCount !== undefined) {
            this._keywordCount = Math.max(1, Math.min(10, Number(config.aiNamingKeywordCount) || 3));
        }
        if (config.aiNamingSeparator !== undefined) this._separator = config.aiNamingSeparator || '_';
        if (config.aiNamingKeywords !== undefined) {
            this._keywordLibrary = this._parseKeywords(config.aiNamingKeywords);
        }
        if (config.aiNamingModel !== undefined) {
            this._model = config.aiNamingModel || 'gemini-2.0-flash';
        }
    }

    /**
     * 解析关键词字符串（支持逗号、换行、中文逗号分割）
     * @param {string|string[]} input
     * @returns {string[]}
     */
    _parseKeywords(input) {
        if (Array.isArray(input)) return input.filter(Boolean).map(s => s.trim());
        if (typeof input !== 'string') return [];
        return input
            .split(/[,，\n\r]+/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    /**
     * 是否可用（已启用 + 有 API Key + 有词库）
     */
    isAvailable() {
        return this._enabled && !!this._apiKey && this._keywordLibrary.length > 0;
    }

    /**
     * 获取当前配置状态摘要
     */
    getStatus() {
        return {
            enabled: this._enabled,
            hasApiKey: !!this._apiKey,
            keywordCount: this._keywordCount,
            librarySize: this._keywordLibrary.length,
            separator: this._separator,
            model: this._model,
            available: this.isAvailable()
        };
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this._cache.clear();
    }

    /**
     * 从缓存获取关键词（如果存在且未过期）
     * @param {string} cacheKey
     * @returns {string[]|null}
     */
    _getCached(cacheKey) {
        if (!cacheKey) return null;
        const entry = this._cache.get(cacheKey);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this._cacheTTL) {
            this._cache.delete(cacheKey);
            return null;
        }
        return entry.keywords;
    }

    /**
     * 写入缓存
     */
    _setCache(cacheKey, keywords) {
        if (!cacheKey) return;
        this._cache.set(cacheKey, { keywords, timestamp: Date.now() });
        // 限制缓存大小
        if (this._cache.size > 500) {
            const oldest = this._cache.keys().next().value;
            this._cache.delete(oldest);
        }
    }

    /**
     * 根据本地文件路径分析图片，从词库中挑选关键词
     * @param {string} filePath - 本地文件绝对路径
     * @param {object} context - 附加上下文（可选）
     * @returns {Promise<string[]>} 选中的关键词数组
     */
    async analyzeLocalFile(filePath, context = {}) {
        if (!this.isAvailable()) return [];
        if (!filePath || !fs.existsSync(filePath)) {
            console.warn('[AiNaming] 文件不存在:', filePath);
            return [];
        }

        const cacheKey = `local:${filePath}`;
        const cached = this._getCached(cacheKey);
        if (cached) {
            console.log(`[AiNaming] 缓存命中: ${path.basename(filePath)} → [${cached.join(', ')}]`);
            return cached;
        }

        try {
            const imageBuffer = await fs.promises.readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();

            // 压缩图片以节省 API 消耗（关键词匹配不需要原图质量）
            const { base64, mimeType } = this._compressForAnalysis(imageBuffer, ext);

            const originalKB = Math.round(imageBuffer.length / 1024);
            const compressedKB = Math.round(Buffer.from(base64, 'base64').length / 1024);
            console.log(`[AiNaming] 图片预处理: ${path.basename(filePath)} ${originalKB}KB → ${compressedKB}KB`);

            const keywords = await this._callGemini(base64, mimeType, context);
            this._setCache(cacheKey, keywords);
            console.log(`[AiNaming] 分析完成: ${path.basename(filePath)} → [${keywords.join(', ')}]`);
            return keywords;
        } catch (err) {
            console.error('[AiNaming] 分析本地文件失败:', err.message);
            return [];
        }
    }

    /**
     * 压缩图片用于 AI 分析（节省 API token）
     * 策略：如果文件 > 512KB，用 Electron nativeImage 缩小到最长边 1024px，
     *       转为 JPEG 80% 质量。关键词匹配不需要高清原图。
     * @param {Buffer} imageBuffer - 原始图片 buffer
     * @param {string} ext - 文件扩展名
     * @returns {{ base64: string, mimeType: string }}
     */
    _compressForAnalysis(imageBuffer, ext) {
        const MAX_SIZE_BYTES = 512 * 1024;  // 512KB 以上才压缩
        const MAX_DIMENSION = 1024;          // 最长边 1024px
        const JPEG_QUALITY = 80;             // JPEG 质量 80%

        // 小文件直接使用原图
        if (imageBuffer.length <= MAX_SIZE_BYTES) {
            return {
                base64: imageBuffer.toString('base64'),
                mimeType: this._getMimeType(ext)
            };
        }

        try {
            // 使用 Electron 内置的 nativeImage 压缩
            const { nativeImage } = require('electron');
            const img = nativeImage.createFromBuffer(imageBuffer);

            if (img.isEmpty()) {
                // nativeImage 无法解析（如 HEIC、TIFF），回退原图
                return {
                    base64: imageBuffer.toString('base64'),
                    mimeType: this._getMimeType(ext)
                };
            }

            const size = img.getSize();
            let resized = img;

            // 如果尺寸超过限制，等比缩放
            if (size.width > MAX_DIMENSION || size.height > MAX_DIMENSION) {
                const scale = MAX_DIMENSION / Math.max(size.width, size.height);
                const newWidth = Math.round(size.width * scale);
                const newHeight = Math.round(size.height * scale);
                resized = img.resize({ width: newWidth, height: newHeight, quality: 'good' });
                console.log(`[AiNaming] 缩放: ${size.width}x${size.height} → ${newWidth}x${newHeight}`);
            }

            // 转为 JPEG 以减小体积
            const jpegBuffer = resized.toJPEG(JPEG_QUALITY);
            return {
                base64: jpegBuffer.toString('base64'),
                mimeType: 'image/jpeg'
            };
        } catch (compressErr) {
            // 压缩失败时回退使用原图
            console.warn('[AiNaming] 压缩失败，使用原图:', compressErr.message);
            return {
                base64: imageBuffer.toString('base64'),
                mimeType: this._getMimeType(ext)
            };
        }
    }

    /**
     * 根据 Google Drive 文件数据分析图片
     * @param {Buffer|string} imageData - base64 字符串或 Buffer
     * @param {string} mimeType - MIME 类型
     * @param {object} context - 附加上下文
     * @returns {Promise<string[]>}
     */
    async analyzeImageData(imageData, mimeType = 'image/jpeg', context = {}) {
        if (!this.isAvailable()) return [];

        const base64 = Buffer.isBuffer(imageData) ? imageData.toString('base64') : imageData;
        const cacheKey = `data:${base64.slice(0, 64)}`;
        const cached = this._getCached(cacheKey);
        if (cached) return cached;

        try {
            const keywords = await this._callGemini(base64, mimeType, context);
            this._setCache(cacheKey, keywords);
            return keywords;
        } catch (err) {
            console.error('[AiNaming] 分析图片数据失败:', err.message);
            return [];
        }
    }

    /**
     * 将关键词格式化为文件名片段
     * @param {string[]} keywords
     * @returns {string}
     */
    formatKeywords(keywords = []) {
        if (!keywords.length) return '';
        return keywords.join(this._separator);
    }

    /**
     * 增强已有的文件名，在指定位置插入关键词
     * 如果文件名中有 {{aiKeywords}} token，用关键词替换
     * 否则追加到文件名（扩展名之前）
     * @param {string} currentName
     * @param {string[]} keywords
     * @returns {string}
     */
    enhanceName(currentName, keywords = []) {
        if (!keywords.length || !currentName) return currentName;
        const formatted = this.formatKeywords(keywords);
        if (!formatted) return currentName;

        // 如果包含 token，直接替换
        if (currentName.includes('{{aiKeywords}}')) {
            return currentName.replace(/\{\{aiKeywords\}\}/g, formatted);
        }

        // 否则追加到扩展名前面
        const parsed = path.parse(currentName);
        return `${parsed.name}-${formatted}${parsed.ext}`;
    }

    /**
     * 带并发控制的 Gemini API 调用
     */
    async _callGemini(base64Image, mimeType, context = {}) {
        // 等待可用的并发槽位
        if (this._activeRequests >= this._concurrency) {
            await new Promise(resolve => this._queue.push(resolve));
        }
        this._activeRequests++;

        try {
            return await this._doCallGemini(base64Image, mimeType, context);
        } finally {
            this._activeRequests--;
            if (this._queue.length > 0) {
                const next = this._queue.shift();
                next();
            }
        }
    }

    /**
     * 实际的 Gemini API 调用
     */
    async _doCallGemini(base64Image, mimeType, context = {}) {
        const libraryStr = this._keywordLibrary.join(', ');
        const contextInfo = context.mainCategory
            ? `\n资产分类：${context.mainCategory}${context.subCategory ? ' / ' + context.subCategory : ''}`
            : '';

        const prompt = `你是一个文件命名助手。请根据图片内容，从以下【关键词词库】中选取最匹配的关键词。

【关键词词库】：
${libraryStr}

【规则】：
1. 从词库中选取恰好 ${this._keywordCount} 个最相关的关键词
2. 只能从词库中选取，不要创造新词
3. 按相关度从高到低排列
4. 仅返回 JSON 数组格式，不要附加任何其他内容
${contextInfo}

输出示例：["关键词1", "关键词2", "关键词3"]`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Image
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 256,
                responseMimeType: 'application/json'
            }
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this._model}:generateContent?key=${this._apiKey}`;

        const responseBody = await this._httpPost(url, requestBody, 15000);

        // 解析响应
        try {
            const candidates = responseBody?.candidates;
            if (!candidates || !candidates.length) {
                console.warn('[AiNaming] Gemini 无有效响应');
                return [];
            }
            const text = candidates[0]?.content?.parts?.[0]?.text || '';
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) {
                console.warn('[AiNaming] Gemini 返回非数组:', text);
                return [];
            }
            // 过滤：只保留词库中存在的关键词，限制数量
            const validKeywords = parsed
                .filter(kw => typeof kw === 'string' && this._keywordLibrary.includes(kw.trim()))
                .map(kw => kw.trim())
                .slice(0, this._keywordCount);
            return validKeywords;
        } catch (parseErr) {
            console.error('[AiNaming] 解析 Gemini 响应失败:', parseErr.message);
            return [];
        }
    }

    /**
     * HTTP POST 请求（使用 Node.js 原生 https 模块）
     */
    _httpPost(url, body, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const postData = JSON.stringify(body);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout
            };

            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 400) {
                            reject(new Error(`HTTP ${res.statusCode}: ${parsed?.error?.message || data.slice(0, 200)}`));
                        } else {
                            resolve(parsed);
                        }
                    } catch (e) {
                        reject(new Error(`JSON parse error: ${data.slice(0, 200)}`));
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('请求超时'));
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    /**
     * 根据文件扩展名获取 MIME 类型
     */
    _getMimeType(ext) {
        const map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.heic': 'image/heic',
            '.heif': 'image/heif',
            '.tif': 'image/tiff',
            '.tiff': 'image/tiff',
            '.svg': 'image/svg+xml'
        };
        return map[ext] || 'image/jpeg';
    }
}

module.exports = AiNamingService;
