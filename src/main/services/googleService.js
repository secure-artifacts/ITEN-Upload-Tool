const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const FileType = require('file-type');
const { google } = require('googleapis');
const { FileNamer } = require('./fileNamer');

const DEFAULT_FOLDER_PATTERN = '{{customDate}}-{{submitter}}-{{admin}}';
const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'webm', 'mpg', 'mpeg']);
const VIDEO_MIME_BY_EXT = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  webm: 'video/webm',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg'
};
const FINISHED_FOLDER_NAME = '成品';
const REFERENCE_FOLDER_NAME = '参考';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

// 上传优化配置常量
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5分钟超时
const UPLOAD_MAX_RETRIES = 3; // 最大重试次数
const UPLOAD_RETRY_DELAYS = [2000, 4000, 8000]; // 指数退避延时 (ms)

// 判断是否为可重试的错误
const isRetryableError = (error) => {
  if (!error) return false;
  const code = error.code || error.statusCode || error.status;
  const message = (error.message || '').toLowerCase();

  // 网络超时/连接错误
  if (['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
    return true;
  }
  // HTTP 5xx 服务器错误
  if (typeof code === 'number' && code >= 500 && code < 600) {
    return true;
  }
  // Google API 速率限制
  if (code === 429 || message.includes('rate limit') || message.includes('quota')) {
    return true;
  }
  // 网络相关错误消息
  if (message.includes('timeout') || message.includes('network') || message.includes('socket')) {
    return true;
  }
  return false;
};

// 延时函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const DEFAULT_METADATA_OPTIONS = {
  categories: ['市场宣传', '活动素材', '培训资料', '内部沟通', '公共素材', '其他'],
  mediaTypes: ['视频', '图片', '音频', '文档', '压缩包', '其他'],
  departments: ['市场部', '品牌部', '销售部', '客户成功', '产品与研发', '运营部', '设计部', '其他']
};

const REVIEW_HEADERS = [
  '图片名称',
  '提交人',
  '管理员',
  '完成日期',
  '审核链接',
  '主类别',
  '子类别',
  '审核人',
  '审核状态',
  '备注',
  '入库后最终链接',
  '上传日期',
  '文件夹ID',
  '目标目录ID',
  '临时父目录ID',
  '合格文件',
  '不合格文件',
  '文件命名规则',
  '文件夹命名规则',
  '命名元数据',
  '合格文件详情',  // 新增：存储 acceptedDetails 的 JSON
  '不合格文件详情'  // 新增：存储 rejectedDetails 的 JSON
];

// === 新审核流程：按文件记录的表头 ===
const FILE_REVIEW_HEADERS = [
  '批次ID',                // 0  (A)
  '临时目录链接',          // 1  (B)
  '文件名',                // 2  (C)
  '文件ID',                // 3  (D)
  '文件链接',              // 4  (E)
  '提交人',                // 5  (F)
  '提交时间',              // 6  (G)
  '状态',                  // 7  (H): 待审核 / 合格 / 不合格 / 作废 / 已入库 / 已替换
  '任务类型',              // 8  (I)
  '主类别',                // 9  (J)
  '子类别',                // 10 (K)
  '审核人',                // 11 (L)
  '审核时间',              // 12 (M)
  '审核备注',              // 13 (N)
  '批次审核状态',          // 14 (O): 批次整体状态（手动设置）
  '入库后最终文件夹链接',  // 15 (P)
  '入库后文件链接',        // 16 (Q)
  '关联文件ID',            // 17 (R): 用于替换时关联旧文件
  '参考文件夹ID',          // 18 (S): 参考文件夹的Google Drive ID
  '批次备注',              // 19 (T): 批次级备注
  '管理员',                // 20 (U): 提交时管理员
  '文件命名规则',          // 21 (V): 提交时文件命名规则
  '文件夹命名规则',        // 22 (W): 提交时文件夹命名规则
  '命名元数据',            // 23 (X): 提交时命名元数据
  '入库目标ID',            // 24 (Y): 提交时入库目标目录ID
  '实际命名结果',          // 25 (Z): 按提交时规则生成的实际命名结果
  '标注文件ID',            // 26 (AA): 标注后生成的新文件ID
  '标注时间',              // 27 (AB): 标注更新时间
  '参考文件夹链接',        // 28 (AC): 提交时参考文件夹链接
  '批次显示名',            // 29 (AD): reviewSlotName
  '批次描述',              // 30 (AE): reviewDescription
  '提交备注'               // 31 (AF): reviewNote
];

// 文件审核状态枚举
const FILE_REVIEW_STATUS = {
  PENDING: '待审核',
  APPROVED: '合格',
  REJECTED: '不合格',
  DISCARDED: '作废',   // 不合格但不需要修改，直接放弃
  STORED: '已入库',
  REPLACED: '已替换'
};

// 已删除文件夹名称  
const DELETED_FOLDER_NAME = '已删除';

/**
 * 自定义认证错误类
 * 用于区分不同类型的授权错误
 */
class AuthError extends Error {
  /**
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @param {string} [originalError] - 原始错误信息
   */
  constructor(message, code, originalError = null) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.originalError = originalError;
    // 使堆栈跟踪正确
    Error.captureStackTrace(this, AuthError);
  }

  /**
   * 检查是否需要重新登录
   */
  requiresReauth() {
    return [
      'NOT_AUTHORIZED',
      'NO_REFRESH_TOKEN',
      'TOKEN_REVOKED',
      'TOKEN_EXPIRED'
    ].includes(this.code);
  }

  /**
   * 检查是否可以重试
   */
  isRetryable() {
    return [
      'TOKEN_REFRESH_FAILED',
      'SERVER_ERROR',
      'AUTH_TIMEOUT'
    ].includes(this.code);
  }
}

class GoogleService {
  constructor(store, defaults = {}) {
    this.store = store;
    this.config = defaults;
    this.oauthClient = null;
    this.drive = null;
    this.sheets = null;
    this.metadataOptions = DEFAULT_METADATA_OPTIONS;
    this.folderCache = new Map();
    this.childFolderCache = new Map();
    this.reviewBatchFolderCache = new Map();
    this.reviewHeaderEnsured = false;
    this.fileReviewHeaderEnsured = false;  // 新审核流程：按文件记录的表头标志
    this.firebaseService = null;
    // 用于 PKCE 的临时存储
    this._codeVerifier = null;
    // Token 刷新状态
    this._isRefreshing = false;
    this._refreshPromise = null;
    // 授权作用域
    this.scopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
      'openid',
      'email',
      'profile'
    ];
  }

  setFirebaseService(service = null) {
    this.firebaseService = service;
  }

  setAiNamingService(service = null) {
    this.aiNamingService = service;
  }

  parseRowNumberFromRange(range = '') {
    const match = String(range).match(/![A-Z]+(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  setConfig(config = {}) {
    const normalized = { ...config };
    if (Object.prototype.hasOwnProperty.call(normalized, 'sheetId')) {
      normalized.sheetId = this.normalizeSpreadsheetId(normalized.sheetId);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'softwareSheetId')) {
      normalized.softwareSheetId = this.normalizeSpreadsheetId(normalized.softwareSheetId);
    }
    this.config = { ...this.config, ...normalized };
    this.reviewHeaderEnsured = false;
    this.fileReviewHeaderEnsured = false;
  }

  getConfig() {
    return this.config;
  }

  getMetadataOptions() {
    return this.metadataOptions;
  }

  hasTokens() {
    return Boolean(this.store.get('googleTokens'));
  }

  /**
   * 获取当前的 access token（供 Firebase 认证使用）
   */
  getAccessToken() {
    const tokens = this.store.get('googleTokens');
    return tokens?.access_token || null;
  }

  /**
   * 检查 Token 是否即将过期（5分钟内）
   */
  isTokenExpiringSoon() {
    const tokens = this.store.get('googleTokens');
    if (!tokens || !tokens.expiry_date) {
      return true;
    }
    // 如果距离过期不到 5 分钟，认为即将过期
    const expiryBuffer = 5 * 60 * 1000;
    return Date.now() > tokens.expiry_date - expiryBuffer;
  }

  /**
   * 检查 Token 是否已过期
   */
  isTokenExpired() {
    const tokens = this.store.get('googleTokens');
    if (!tokens || !tokens.expiry_date) {
      return true;
    }
    return Date.now() >= tokens.expiry_date;
  }

  /**
   * 生成 PKCE code_verifier (43-128 字符的随机字符串)
   */
  generateCodeVerifier() {
    // 生成 32 字节的随机数据，base64url 编码后约 43 字符
    const buffer = crypto.randomBytes(32);
    return buffer.toString('base64url');
  }

  /**
   * 从 code_verifier 生成 code_challenge (SHA256 哈希后 base64url 编码)
   */
  generateCodeChallenge(verifier) {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return hash.toString('base64url');
  }

  createOAuthClient() {
    const { clientId, clientSecret } = this.config;
    if (!clientId || !clientSecret) {
      throw new AuthError(
        '请先填写 Google OAuth Client ID 与 Client Secret',
        'CONFIG_MISSING'
      );
    }
    const redirectUri = this.getRedirectUri();
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  getRedirectUri() {
    const port = this.config.redirectPort || 42813;
    return `http://127.0.0.1:${port}/oauth2callback`;
  }

  /**
   * 刷新 Access Token
   * 使用 refresh_token 获取新的 access_token
   */
  async refreshAccessToken() {
    // 防止并发刷新
    if (this._isRefreshing) {
      return this._refreshPromise;
    }

    const tokens = this.store.get('googleTokens');
    if (!tokens || !tokens.refresh_token) {
      throw new AuthError(
        '没有可用的 refresh_token，请重新登录',
        'NO_REFRESH_TOKEN'
      );
    }

    this._isRefreshing = true;
    this._refreshPromise = (async () => {
      try {
        console.log('[GoogleService] 正在刷新 Access Token...');

        if (!this.oauthClient) {
          this.oauthClient = this.createOAuthClient();
        }
        this.oauthClient.setCredentials(tokens);

        const { credentials } = await this.oauthClient.refreshAccessToken();

        // 合并新的 token（保留 refresh_token）
        const newTokens = {
          ...tokens,
          ...credentials,
          refresh_token: credentials.refresh_token || tokens.refresh_token
        };

        this.store.set('googleTokens', newTokens);
        this.oauthClient.setCredentials(newTokens);

        console.log('[GoogleService] Token 刷新成功，有效期至:',
          new Date(newTokens.expiry_date).toLocaleString());

        return newTokens;
      } catch (error) {
        console.error('[GoogleService] Token 刷新失败:', error.message);

        // 如果刷新失败，可能是 refresh_token 已失效
        if (error.message.includes('invalid_grant') ||
          error.message.includes('Token has been revoked')) {
          // 清除无效的 tokens
          this.store.delete('googleTokens');
          throw new AuthError(
            '登录已过期或被撤销，请重新登录 Google',
            'TOKEN_REVOKED'
          );
        }
        throw new AuthError(
          `Token 刷新失败: ${error.message}`,
          'TOKEN_REFRESH_FAILED'
        );
      } finally {
        this._isRefreshing = false;
        this._refreshPromise = null;
      }
    })();

    return this._refreshPromise;
  }

  /**
   * 确保 OAuth 客户端已初始化且 Token 有效
   * 如果 Token 即将过期，会自动刷新
   */
  async ensureAuthClient(forceRenew = false) {
    if (forceRenew || !this.oauthClient) {
      this.oauthClient = this.createOAuthClient();
    }

    const tokens = this.store.get('googleTokens');
    if (!tokens && !forceRenew) {
      throw new AuthError(
        '尚未授权，请先登录 Google',
        'NOT_AUTHORIZED'
      );
    }

    if (tokens) {
      // 检查 Token 是否即将过期
      if (!forceRenew && this.isTokenExpiringSoon() && tokens.refresh_token) {
        try {
          await this.refreshAccessToken();
          const refreshedTokens = this.store.get('googleTokens');
          this.oauthClient.setCredentials(refreshedTokens);
          this.storeUserEmailFromToken(refreshedTokens?.id_token);
        } catch (refreshError) {
          console.warn('[GoogleService] Token 自动刷新失败:', refreshError.message);
          // 如果刷新失败但 token 还没完全过期，继续使用
          if (!this.isTokenExpired()) {
            this.oauthClient.setCredentials(tokens);
            this.storeUserEmailFromToken(tokens?.id_token);
          } else {
            throw refreshError;
          }
        }
      } else {
        this.oauthClient.setCredentials(tokens);
        this.storeUserEmailFromToken(tokens?.id_token);
      }
    }

    return this.oauthClient;
  }

  async ensureApis() {
    const auth = await this.ensureAuthClient(false);
    this.drive = google.drive({ version: 'v3', auth });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  normalizeSpreadsheetId(value) {
    if (!value) {
      return '';
    }
    const trimmed = String(value).trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  }

  /**
   * 启动 OAuth 授权流程（使用 PKCE）
   * @param {Function} openAuthWindow - 打开授权窗口的函数
   * @returns {Promise<{success: boolean}>}
   */
  async startAuthFlow(openAuthWindow) {
    await this.ensureAuthClient(true);

    // 生成 PKCE code_verifier 和 code_challenge
    this._codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(this._codeVerifier);

    console.log('[GoogleService] 使用 PKCE 授权流程');

    const authUrl = this.oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: this.scopes,
      // PKCE 参数
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const redirectUri = this.getRedirectUri();
    const port = this.config.redirectPort || 42813;

    return new Promise((resolve, reject) => {
      let disposeWindow;
      let completed = false;
      let serverInstance = null;
      let timeoutId = null;

      // 设置授权超时（5分钟）
      const AUTH_TIMEOUT = 5 * 60 * 1000;
      timeoutId = setTimeout(() => {
        cleanup(new AuthError('授权超时，请重试', 'AUTH_TIMEOUT'));
      }, AUTH_TIMEOUT);

      const server = http.createServer(async (req, res) => {
        // 设置 CORS 和安全头
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-store');

        if (!req.url.startsWith('/oauth2callback')) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }

        const incomingUrl = new URL(req.url, redirectUri);
        const code = incomingUrl.searchParams.get('code');
        const error = incomingUrl.searchParams.get('error');
        const errorDescription = incomingUrl.searchParams.get('error_description');

        if (error) {
          const errorMessage = errorDescription
            ? `${error}: ${errorDescription}`
            : this.getAuthErrorMessage(error);
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.generateErrorHtml(errorMessage));
          cleanup(new AuthError(errorMessage, 'AUTH_ERROR', error));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.generateErrorHtml('未获取到授权码'));
          cleanup(new AuthError('未获取到授权码', 'NO_AUTH_CODE'));
          return;
        }

        try {
          console.log('[GoogleService] 收到授权码，正在交换 Token...');

          // 使用 PKCE code_verifier 交换 Token
          const { tokens } = await this.oauthClient.getToken({
            code,
            codeVerifier: this._codeVerifier
          });

          this.oauthClient.setCredentials(tokens);
          this.store.set('googleTokens', tokens);
          this.storeUserEmailFromToken(tokens?.id_token);

          // 清除 code_verifier
          this._codeVerifier = null;

          const userEmail = this.getCurrentUserEmail();
          console.log('[GoogleService] 授权成功:', userEmail || '未知用户');
          console.log('[GoogleService] Token 有效期至:',
            tokens.expiry_date ? new Date(tokens.expiry_date).toLocaleString() : '未知');

          completed = true;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.generateSuccessHtml(userEmail));

          cleanup();
          resolve({ success: true });
        } catch (err) {
          console.error('[GoogleService] Token 交换失败:', err.message);
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.generateErrorHtml(`授权失败: ${err.message}`));
          cleanup(new AuthError(`Token 交换失败: ${err.message}`, 'TOKEN_EXCHANGE_FAILED'));
        }
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          cleanup(new AuthError(
            `端口 ${port} 已被占用，请在设置中更换其他端口`,
            'PORT_IN_USE'
          ));
        } else {
          cleanup(new AuthError(`服务器错误: ${err.message}`, 'SERVER_ERROR'));
        }
      });

      const cleanup = (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (disposeWindow) {
          disposeWindow();
          disposeWindow = null;
        }
        try {
          if (serverInstance) {
            serverInstance.close();
            serverInstance = null;
          }
        } catch (err) {
          // ignore close errors
        }
        // 清除 code_verifier
        this._codeVerifier = null;

        if (error && !completed) {
          reject(error);
        }
      };

      serverInstance = server;
      server.listen(port, '127.0.0.1', () => {
        console.log(`[GoogleService] 本地授权服务器启动于端口 ${port}`);
        disposeWindow = openAuthWindow(authUrl, () => {
          cleanup(new AuthError('用户取消了授权', 'USER_CANCELLED'));
        });
      });
    });
  }

  /**
   * 登出 - 清除所有授权信息
   */
  logout() {
    this.store.delete('googleTokens');
    this.store.delete('userEmail');
    this.oauthClient = null;
    this.drive = null;
    this.sheets = null;
    this.folderCache.clear();
    this.childFolderCache.clear();
    console.log('[GoogleService] 已登出');
  }

  /**
   * 获取授权错误的友好消息
   */
  getAuthErrorMessage(errorCode) {
    const errorMessages = {
      'access_denied': '您拒绝了授权请求',
      'invalid_request': '授权请求无效，请重试',
      'unauthorized_client': '应用未被授权使用此 API',
      'unsupported_response_type': '不支持的响应类型',
      'invalid_scope': '请求的权限范围无效',
      'server_error': 'Google 服务器错误，请稍后重试',
      'temporarily_unavailable': 'Google 服务暂时不可用，请稍后重试'
    };
    return errorMessages[errorCode] || `授权失败: ${errorCode}`;
  }

  /**
   * 生成成功页面 HTML
   */
  generateSuccessHtml(userEmail) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>授权成功</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .card {
      background: white;
      padding: 40px 50px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 400px;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #10B981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }
    h2 {
      color: #1F2937;
      margin: 0 0 10px;
      font-size: 24px;
    }
    p {
      color: #6B7280;
      margin: 0;
      font-size: 14px;
    }
    .email {
      color: #3B82F6;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
    </div>
    <h2>授权成功</h2>
    <p>已登录为 <span class="email">${(userEmail || '未知用户').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</span></p>
    <p style="margin-top: 10px;">您可以关闭此窗口</p>
  </div>
</body>
</html>`;
  }

  /**
   * 生成错误页面 HTML
   */
  generateErrorHtml(errorMessage) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>授权失败</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    .card {
      background: white;
      padding: 40px 50px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 400px;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #EF4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }
    h2 {
      color: #1F2937;
      margin: 0 0 10px;
      font-size: 24px;
    }
    p {
      color: #6B7280;
      margin: 0;
      font-size: 14px;
    }
    .error {
      color: #DC2626;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </div>
    <h2>授权失败</h2>
    <p class="error">${(errorMessage || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</p>
    <p style="margin-top: 10px;">请关闭此窗口并重试</p>
  </div>
</body>
</html>`;
  }


  async uploadFiles(files = [], options = {}, notify = () => { }, controller = null) {
    if (!files.length) {
      return [];
    }
    await this.ensureApis();
    const renameOptions = options.renameOptions || {};
    const metadata = options.metadata || {};
    let counter = renameOptions.counterStart || 1;
    const counterStep = renameOptions.counterStep || 1;

    controller?.start?.();

    const results = [];
    const reviewTasks = new Map();
    const usedNames = new Set();
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (controller?.isStopped?.()) {
        break;
      }
      if (controller?.waitIfPaused) {
        await controller.waitIfPaused();
      }
      try {
        const metaForFile = { ...metadata, ...(file.metadata || {}) };
        metaForFile.reviewNamingMetadata = this.serializeNamingMetadata(metaForFile);
        if (metaForFile.reviewEnabled && !metaForFile.batchId) {
          if (!this._currentBatchId) {
            this._currentBatchId = this.generateBatchId(metaForFile.submitter);
          }
          metaForFile.batchId = this._currentBatchId;
        }
        if (!metaForFile.subFolderId && (metaForFile.categoryFolderId || this.config.driveFolderId)) {
          const folderOptions = { ...renameOptions };
          if (file.folderPattern) {
            folderOptions.folderPattern = file.folderPattern;
          }
          const folderInfo = await this.ensureSubFolder(metaForFile, folderOptions);
          metaForFile.subFolderId = folderInfo.id;
          metaForFile.subFolderLink = folderInfo.link;
          if (folderInfo.finishedFolderId) {
            metaForFile.reviewFinishedFolderId = folderInfo.finishedFolderId;
            metaForFile.reviewFinishedFolderLink = folderInfo.finishedFolderLink;
          }
          if (folderInfo.referenceFolderId) {
            metaForFile.reviewReferenceFolderId = folderInfo.referenceFolderId;
            metaForFile.reviewReferenceFolderLink = folderInfo.referenceFolderLink;
          }
        }
        const isReferenceUpload = Boolean(metaForFile.isReference);
        const isReviewUpload = Boolean(metaForFile.reviewEnabled);
        const filePattern = file.renamePattern || renameOptions.pattern;

        // ── AI 命名：在 buildName 前分析图片并注入关键词 ──
        if (this.aiNamingService && this.aiNamingService.isAvailable() && filePattern && filePattern.includes('{{aiKeywords}}')) {
          try {
            const aiContext = {
              mainCategory: metaForFile.category || '',
              subCategory: metaForFile.subCategory || ''
            };
            const keywords = await this.aiNamingService.analyzeLocalFile(file.path, aiContext);
            metaForFile.aiKeywords = this.aiNamingService.formatKeywords(keywords);
            if (keywords.length) {
              console.log(`[AI命名] ${file.name} → [${keywords.join(', ')}]`);
            }
          } catch (aiErr) {
            console.warn('[AI命名] 分析失败，跳过:', aiErr.message);
            metaForFile.aiKeywords = '';
          }
        } else {
          metaForFile.aiKeywords = '';
        }

        const shouldRenameNow = !isReferenceUpload && !isReviewUpload;
        const namingOptions = { ...renameOptions, pattern: filePattern };
        const namer = shouldRenameNow ? new FileNamer(namingOptions) : null;
        const generatedName = shouldRenameNow ? namer.buildName(file, metaForFile, counter) : file.name;
        const plannedName = file.overrideName || new FileNamer(namingOptions).buildName(file, metaForFile, counter);
        const newName = file.overrideName || generatedName;
        if (usedNames.has(newName)) {
          const dupPayload = {
            status: 'skipped',
            phase: 'duplicate',
            slotId: file.slotId,
            fileId: file.id,
            source: file.path,
            name: newName,
            message: `${newName} 已存在，自动跳过`
          };
          results.push(dupPayload);
          notify(dupPayload);
          counter += counterStep;
          continue;
        }
        usedNames.add(newName);

        // 设置当前正在上传的文件（用于暂停/停止控制）
        controller?.setCurrentFile?.(file.id);

        notify({
          status: 'running',
          phase: 'start',
          slotId: file.slotId,
          fileId: file.id,
          source: file.path,
          name: newName,
          message: `开始上传 ${newName}`
        });
        const uploadMetadata = { ...metaForFile };
        if (isReferenceUpload && metaForFile.reviewReferenceFolderId) {
          uploadMetadata.subFolderId = metaForFile.reviewReferenceFolderId;
          uploadMetadata.subFolderLink =
            metaForFile.reviewReferenceFolderLink || metaForFile.subFolderLink;
        }
        // 进度回调函数
        const onProgress = (progressInfo) => {
          notify({
            status: 'running',
            phase: 'uploading',
            slotId: file.slotId,
            fileId: file.id,
            source: file.path,
            name: newName,
            progress: progressInfo.progress,
            uploaded: progressInfo.uploaded,
            total: progressInfo.total,
            attempt: progressInfo.attempt,
            message: progressInfo.attempt > 1
              ? `正在重试上传 ${newName}... ${progressInfo.progress}%`
              : `正在上传 ${newName}... ${progressInfo.progress}%`
          });
        };
        // 获取 abort signal（用于停止上传）
        const abortSignal = controller?.getAbortSignal?.();
        const uploadResult = await this.uploadSingleFile(file, newName, uploadMetadata, onProgress, abortSignal);
        metaForFile.fileLink = uploadResult.link || metaForFile.fileLink || '';
        metaForFile.taskType = metaForFile.taskType || file.taskType || '';
        metaForFile.driveFileId = uploadResult.id;
        let sheetLink = null;
        if (metaForFile.reviewEnabled) {
          const taskId = metaForFile.reviewTaskId || file.slotId || metaForFile.subFolderId || uploadResult.id;

          // === 按文件审核模式（始终启用） ===
          // 获取或生成批次ID
          if (!metaForFile.batchId) {
            // 第一次上传时生成批次ID，后续文件复用
            if (!this._currentBatchId) {
              this._currentBatchId = this.generateBatchId(metaForFile.submitter);
            }
            metaForFile.batchId = this._currentBatchId;
          }

          // 立即为每个文件写入一行记录
          try {
            await this.appendFileReviewRow({
              fileName: newName,
              fileId: uploadResult.id,
              fileLink: uploadResult.link,
              batchId: metaForFile.batchId,
              submitter: metaForFile.submitter || '',
              taskType: metaForFile.taskType || '',
              admin: metaForFile.admin || '',
              mainCategory: metaForFile.mainCategory || '',
              subCategory: metaForFile.subCategory || '',
              tempFolderLink: metaForFile.subFolderLink || '',
              referenceFolderId: metaForFile.reviewReferenceFolderId || '',
              referenceFolderLink: metaForFile.reviewReferenceFolderLink || '',
              renamePattern: file.renamePattern || renameOptions.pattern,
              folderPattern: file.folderPattern || renameOptions.folderPattern,
              namingMetadata: metaForFile.reviewNamingMetadata || '',
              targetFolderId: metaForFile.reviewTargetFolderId || metaForFile.categoryFolderId || '',
              namingResult: plannedName,
              reviewSlotName: metaForFile.reviewSlotName || '',
              reviewDescription: metaForFile.reviewDescription || '',
              reviewNote: metaForFile.reviewNote || '',
              isReference: isReferenceUpload
            });
          } catch (rowError) {
            console.warn('Failed to append file review row:', rowError.message);
          }

          // === 原有流程：按批次累积 ===
          let task = reviewTasks.get(taskId);
          if (!task) {
            task = {
              taskId,
              submitter: metaForFile.submitter || '',
              completedAt: metaForFile.completedAt || '',
              admin: metaForFile.admin || '',
              mainCategory: metaForFile.mainCategory || '',
              subCategory: metaForFile.subCategory || '',
              note: metaForFile.reviewNote || '',
              tempFolderId: metaForFile.subFolderId || '',
              tempFolderLink: metaForFile.subFolderLink || '',
              tempParentId: metaForFile.reviewTempFolderId || metaForFile.categoryFolderId || '',
              targetFolderId: metaForFile.reviewTargetFolderId || '',
              customDate: metaForFile.customDate || '',
              finishedFolderId: metaForFile.reviewFinishedFolderId || '',
              finishedFolderLink: metaForFile.reviewFinishedFolderLink || '',
              referenceFolderId: metaForFile.reviewReferenceFolderId || '',
              referenceFolderLink: metaForFile.reviewReferenceFolderLink || '',
              description: metaForFile.reviewDescription || metaForFile.subject || '',
              renamePattern: file.renamePattern || renameOptions.pattern,
              folderPattern: file.folderPattern || renameOptions.folderPattern,
              namingMetadata: metaForFile.reviewNamingMetadata || '',
              batchId: metaForFile.batchId || ''  // 记录批次ID用于关联
            };
            reviewTasks.set(taskId, task);
          }
          task.tempFolderId = metaForFile.subFolderId || task.tempFolderId;
          task.tempFolderLink = metaForFile.subFolderLink || task.tempFolderLink;
          task.finishedFolderId = metaForFile.reviewFinishedFolderId || task.finishedFolderId;
          task.finishedFolderLink = metaForFile.reviewFinishedFolderLink || task.finishedFolderLink;
          task.referenceFolderId = metaForFile.reviewReferenceFolderId || task.referenceFolderId;
          task.referenceFolderLink = metaForFile.reviewReferenceFolderLink || task.referenceFolderLink;
          task.description = metaForFile.reviewDescription || task.description;
          task.renamePattern = file.renamePattern || task.renamePattern;
          task.folderPattern = file.folderPattern || task.folderPattern;
          task.namingMetadata = metaForFile.reviewNamingMetadata || task.namingMetadata;
        } else {
          sheetLink = await this.appendSheetRow({
            file,
            metadata: metaForFile,
            link: uploadResult.link,
            renamed: newName,
            driveId: uploadResult.id
          });
        }
        const payload = {
          status: 'success',
          phase: 'complete',
          slotId: file.slotId,
          fileId: file.id,
          source: file.path,
          name: newName,
          driveId: uploadResult.id,
          link: uploadResult.link,
          folderLink: isReferenceUpload ? metaForFile.reviewReferenceFolderLink : metaForFile.subFolderLink,
          referenceLink: metaForFile.reviewReferenceFolderLink,
          isReference: isReferenceUpload,
          sheetLink,
          message: `${newName} 上传成功`
        };
        results.push(payload);
        notify({ ...payload });
        this.onFileUploaded?.(uploadResult.id || file.id);

        // 标记当前文件完成
        controller?.onFileComplete?.();
      } catch (error) {
        // 检查是否是被中断的错误
        const isAborted = error.name === 'AbortError' || error.message?.includes('aborted');
        const payload = {
          status: isAborted ? 'skipped' : 'error',
          phase: isAborted ? 'aborted' : 'error',
          slotId: file.slotId,
          fileId: file.id,
          source: file.path,
          message: isAborted ? '上传已中断' : error.message
        };
        results.push(payload);
        notify(payload);

        // 标记当前文件完成（即使失败）
        controller?.onFileComplete?.();
      }
      counter += counterStep;
    }
    if (controller?.isStopped?.()) {
      for (const file of files) {
        if (results.find((item) => item.fileId === file.id)) {
          continue;
        }
        const payload = {
          status: 'skipped',
          phase: 'skipped',
          slotId: file.slotId,
          fileId: file.id,
          source: file.path,
          message: '未上传（任务已停止）'
        };
        results.push(payload);
        notify(payload);
      }
    }
    for (const task of reviewTasks.values()) {
      // 从云端获取文件列表，用于保存到审核记录中
      let fileLists = {
        acceptedFiles: [],
        rejectedFiles: [],
        acceptedDetails: [],
        rejectedDetails: [],
        finishedFolderId: task.finishedFolderId || ''
      };

      if (task.tempFolderId) {
        try {
          fileLists = await this.deriveReviewFileLists(task.tempFolderId, {
            finishedFolderId: task.finishedFolderId,
            treatRootAsFinished: false
          });
          // 确保有 finishedFolderId
          if (!fileLists.finishedFolderId && task.finishedFolderId) {
            fileLists.finishedFolderId = task.finishedFolderId;
          }
        } catch (error) {
          console.warn('Failed to derive file lists for review task:', error.message);
        }
      }

      await this.appendSheetRow({
        file: {},
        metadata: {
          submitter: task.submitter,
          completedAt: task.completedAt,
          subFolderLink: task.tempFolderLink,
          mainCategory: task.mainCategory,
          subCategory: task.subCategory,
          readyFlag: '',
          admin: task.admin,
          reviewer: '',
          reviewEnabled: true,
          reviewTempFolderId: task.tempParentId,
          reviewTargetFolderId: task.targetFolderId,
          driveFileId: task.tempFolderId,
          note: task.note,
          customDate: task.customDate,
          reviewDescription: task.description || '',
          reviewReferenceFolderId: task.referenceFolderId || '',
          reviewReferenceFolderLink: task.referenceFolderLink || '',
          reviewNamingMetadata: task.namingMetadata || '',
          reviewRenamePattern: task.renamePattern || '',
          reviewFolderPattern: task.folderPattern || '',
          // 添加文件列表信息
          acceptedFiles: fileLists.acceptedFiles || [],
          rejectedFiles: fileLists.rejectedFiles || [],
          acceptedDetails: fileLists.acceptedDetails || [],
          rejectedDetails: fileLists.rejectedDetails || [],
          finishedFolderId: fileLists.finishedFolderId || ''
        },
        link: task.tempFolderLink,
        renamed: ''
      });
    }

    // 清理临时批次ID，为下次上传做准备
    this._currentBatchId = null;
    this.reviewBatchFolderCache.clear();

    return results;
  }

  async ensureSubFolder(metaForFile, renameOptions) {
    const parentId = metaForFile.categoryFolderId || this.config.driveFolderId;
    if (!parentId) {
      throw new Error('未配置任何 Drive 文件夹 ID');
    }
    const baseFolderName = this.buildFolderName(metaForFile, renameOptions);
    const isReviewMode = Boolean(metaForFile.reviewEnabled);

    const ensureReviewChildFolders = async (info) => {
      if (!metaForFile.reviewEnabled || !info?.id) {
        return info;
      }
      try {
        const finished = await this.ensureNamedChildFolder(info.id, FINISHED_FOLDER_NAME);
        if (finished) {
          info.finishedFolderId = finished.id;
          info.finishedFolderLink = finished.link;
        }
      } catch (error) {
        console.warn('Failed to ensure finished sub-folder', error);
      }
      try {
        const reference = await this.ensureNamedChildFolder(info.id, REFERENCE_FOLDER_NAME);
        if (reference) {
          info.referenceFolderId = reference.id;
          info.referenceFolderLink = reference.link;
        }
      } catch (error) {
        console.warn('Failed to ensure reference sub-folder', error);
      }
      return info;
    };

    // 审核模式：检测重名并自动添加后缀
    if (isReviewMode) {
      if (metaForFile.batchId && this.reviewBatchFolderCache.has(metaForFile.batchId)) {
        const cached = this.reviewBatchFolderCache.get(metaForFile.batchId);
        return ensureReviewChildFolders({ ...cached });
      }
      let folderName = baseFolderName;
      let suffix = 0;
      let finalInfo = null;

      // 检查是否有同名文件夹，如果有则添加后缀
      while (true) {
        const testName = suffix === 0 ? folderName : `${baseFolderName}_${suffix}`;
        const safeName = testName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const query = `'${parentId}' in parents and name='${safeName}' and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`;

        const existing = await this.drive.files.list({
          q: query,
          spaces: 'drive',
          fields: 'files(id, name, webViewLink)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        if (!existing.data.files || existing.data.files.length === 0) {
          // 没有同名文件夹，创建新的
          const created = await this.drive.files.create({
            requestBody: {
              name: testName,
              mimeType: DRIVE_FOLDER_MIME,
              parents: [parentId]
            },
            fields: 'id, webViewLink'
          });
          finalInfo = {
            id: created.data.id,
            link: created.data.webViewLink || `https://drive.google.com/drive/folders/${created.data.id}`
          };
          console.log(`[GoogleService] 审核模式：创建文件夹 "${testName}"`);
          break;
        }

        // 存在同名文件夹，增加后缀继续检查
        suffix++;
        if (suffix > 100) {
          // 防止无限循环
          throw new Error(`文件夹名称冲突过多: ${baseFolderName}`);
        }
      }

      const ensured = await ensureReviewChildFolders(finalInfo);
      if (metaForFile.batchId && ensured?.id) {
        this.reviewBatchFolderCache.set(metaForFile.batchId, { ...ensured });
      }
      return ensured;
    }

    // 非审核模式：保持原有的合并行为
    const folderName = baseFolderName;
    const cacheKey = `${parentId}|${folderName}`;

    if (this.folderCache.has(cacheKey)) {
      const cached = await this.validateFolder(this.folderCache.get(cacheKey));
      if (cached) {
        return ensureReviewChildFolders({ ...cached });
      }
      this.folderCache.delete(cacheKey);
    }
    const safeName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const query = `'${parentId}' in parents and name='${safeName}' and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`;
    const existing = await this.drive.files.list({
      q: query,
      spaces: 'drive',
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    if (existing.data.files && existing.data.files.length) {
      const folder = existing.data.files[0];
      const info = {
        id: folder.id,
        link: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`
      };
      this.folderCache.set(cacheKey, info);
      return ensureReviewChildFolders(info);
    }
    const created = await this.drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: DRIVE_FOLDER_MIME,
        parents: [parentId]
      },
      fields: 'id, webViewLink'
    });
    const info = {
      id: created.data.id,
      link: created.data.webViewLink || `https://drive.google.com/drive/folders/${created.data.id}`
    };
    this.folderCache.set(cacheKey, info);
    return ensureReviewChildFolders(info);
  }

  async ensureNamedChildFolder(parentId, folderName) {
    if (!parentId || !folderName) {
      return null;
    }
    const cacheKey = `${parentId}|${folderName}`;
    if (this.childFolderCache.has(cacheKey)) {
      return this.childFolderCache.get(cacheKey);
    }
    const safeName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const query = `'${parentId}' in parents and name='${safeName}' and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`;
    const existing = await this.drive.files.list({
      q: query,
      spaces: 'drive',
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    if (existing.data.files && existing.data.files.length) {
      const folder = existing.data.files[0];
      const info = {
        id: folder.id,
        link: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`
      };
      this.childFolderCache.set(cacheKey, info);
      return info;
    }
    const created = await this.drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: DRIVE_FOLDER_MIME,
        parents: [parentId]
      },
      fields: 'id, webViewLink'
    });
    const info = {
      id: created.data.id,
      link: created.data.webViewLink || `https://drive.google.com/drive/folders/${created.data.id}`
    };
    this.childFolderCache.set(cacheKey, info);
    return info;
  }

  async listDriveChildren(parentId) {
    if (!parentId) {
      return [];
    }
    if (!this.drive) {
      await this.ensureApis();
    }
    const files = [];
    let pageToken;
    do {
      const response = await this.drive.files.list({
        q: `'${parentId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, webViewLink)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        spaces: 'drive'
      });
      files.push(...(response.data.files || []));
      pageToken = response.data.nextPageToken;
    } while (pageToken);
    return files;
  }

  /**
   * 获取 Google 文档的修改时间
   * @param {string} documentId - 文档 ID
   * @returns {Promise<{modifiedTime: string, name: string}|null>}
   */
  async getDocumentModifiedTime(documentId) {
    if (!documentId) {
      return null;
    }
    try {
      if (!this.drive) {
        await this.ensureApis();
      }
      const response = await this.drive.files.get({
        fileId: documentId,
        fields: 'modifiedTime,name',
        supportsAllDrives: true
      });
      return {
        modifiedTime: response.data.modifiedTime,
        name: response.data.name || '未命名文档'
      };
    } catch (error) {
      console.warn('Failed to get document modified time:', error);
      return null;
    }
  }

  async collectFileInfos(parentId, prefix = '') {
    const children = await this.listDriveChildren(parentId);
    const results = [];
    for (const child of children) {
      if (child.mimeType === DRIVE_FOLDER_MIME) {
        const folderLabel = child.name || child.id || '';
        const nestedPrefix = folderLabel ? (prefix ? `${prefix}/${folderLabel}` : folderLabel) : prefix;
        const nested = await this.collectFileInfos(child.id, nestedPrefix);
        results.push(...nested);
      } else if (child.id) {
        const link = child.webViewLink || `https://drive.google.com/file/d/${child.id}/view?usp=drivesdk`;
        const fileLabel = child.name || child.id || '未命名文件';
        const label = prefix ? `${prefix}/${fileLabel}` : fileLabel;
        results.push({ id: child.id, name: label, link });
      }
    }
    return results;
  }

  async collectFileInfosDetailed(folderId, options = {}) {
    const results = [];
    const walk = async (currentId, segments = [], context = { inFinished: false, inReference: false }) => {
      const children = await this.listDriveChildren(currentId);
      for (const child of children) {
        const name = child.name || child.id || '';
        const childSegments = [...segments, name];
        const nextContext = {
          inFinished: context.inFinished || child.id === options.finishedFolderId,
          inReference: context.inReference || child.id === options.referenceFolderId
        };
        if (child.mimeType === DRIVE_FOLDER_MIME) {
          await walk(child.id, childSegments, nextContext);
          continue;
        }
        if (!child.id) continue;
        const link = child.webViewLink || `https://drive.google.com/file/d/${child.id}/view?usp=drivesdk`;
        results.push({
          id: child.id,
          name: name || child.id,
          link,
          path: childSegments.join('/') || name || child.id,
          inFinished: context.inFinished,
          inReference: context.inReference
        });
      }
    };
    await walk(
      folderId,
      [],
      {
        inFinished: folderId === options.finishedFolderId,
        inReference: folderId === options.referenceFolderId
      }
    );
    return results;
  }

  async deriveReviewFileLists(folderId, options = {}) {
    if (!folderId) {
      return { acceptedFiles: [], rejectedFiles: [] };
    }
    try {
      const children = await this.listDriveChildren(folderId);
      if (!children.length) {
        return { acceptedFiles: [], rejectedFiles: [] };
      }
      const finishedFolder = children.find(
        (item) => item.mimeType === DRIVE_FOLDER_MIME && item.name?.trim() === FINISHED_FOLDER_NAME
      );
      const referenceFolder = children.find(
        (item) => item.mimeType === DRIVE_FOLDER_MIME && item.name?.trim() === REFERENCE_FOLDER_NAME
      );
      let finishedFolderId = options.finishedFolderId || finishedFolder?.id || '';
      if (!finishedFolderId && options.treatRootAsFinished) {
        // 通过后的目录可能直接就是成品目录
        finishedFolderId = folderId;
      }
      const detailedFiles = await this.collectFileInfosDetailed(folderId, {
        finishedFolderId,
        referenceFolderId: referenceFolder?.id
      });
      const acceptedInfos = detailedFiles
        .filter((item) => item.inFinished)
        .map((item) => ({
          id: item.id,
          name: item.path || item.name,
          link: item.link
        }));
      const rejectedInfos = detailedFiles
        .filter((item) => !item.inFinished && !item.inReference)
        .map((item) => ({
          id: item.id,
          name: item.path || item.name,
          link: item.link
        }));
      const uniqById = (items) => {
        const map = new Map();
        items.forEach((item) => {
          if (!item?.id || map.has(item.id)) {
            return;
          }
          map.set(item.id, item);
        });
        return Array.from(map.values());
      };
      const sortById = (items) => items.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      const acceptedSorted = sortById(uniqById(acceptedInfos));
      const rejectedSorted = sortById(uniqById(rejectedInfos));
      const acceptedFiles = acceptedSorted.map((item) => item.name);
      const rejectedFiles = rejectedSorted.map((item) => item.name);
      return {
        acceptedFiles,
        rejectedFiles,
        acceptedDetails: acceptedSorted,
        rejectedDetails: rejectedSorted,
        finishedFolderId: finishedFolderId || ''
      };
    } catch (error) {
      console.warn('Failed to derive review file lists', error);
      return { acceptedFiles: [], rejectedFiles: [], acceptedDetails: [], rejectedDetails: [], finishedFolderId: '' };
    }
  }

  async resolveReviewFileLists(payload = {}, options = {}) {
    const manualAccepted = Array.isArray(payload.acceptedFiles)
      ? payload.acceptedFiles.filter((item) => Boolean(item))
      : [];
    const manualRejected = Array.isArray(payload.rejectedFiles)
      ? payload.rejectedFiles.filter((item) => Boolean(item))
      : [];
    const manualResult = {
      acceptedFiles: manualAccepted,
      rejectedFiles: manualRejected,
      acceptedDetails: manualAccepted.map((name) => ({ name, link: '' })),
      rejectedDetails: manualRejected.map((name) => ({ name, link: '' })),
      finishedFolderId: payload.finishedFolderId || '',
      acceptedFromSheet: Boolean(manualAccepted.length),
      rejectedFromSheet: Boolean(manualRejected.length)
    };
    if (!payload.folderId) {
      return manualResult;
    }
    const treatRootAsFinished = Boolean(payload.treatRootAsFinished || payload.isApproved || options.treatRootAsFinished);
    const derived = await this.deriveReviewFileLists(payload.folderId, {
      finishedFolderId: payload.finishedFolderId,
      treatRootAsFinished
    });
    if (!derived.finishedFolderId && payload.finishedFolderId) {
      derived.finishedFolderId = payload.finishedFolderId;
    }
    if (!derived.acceptedFiles.length && manualAccepted.length) {
      derived.acceptedFiles = manualResult.acceptedFiles;
      derived.acceptedDetails = manualResult.acceptedDetails;
      derived.acceptedFromSheet = true;
    }
    if (!derived.rejectedFiles.length && manualRejected.length) {
      derived.rejectedFiles = manualResult.rejectedFiles;
      derived.rejectedDetails = manualResult.rejectedDetails;
      derived.rejectedFromSheet = true;
    }
    return derived;
  }

  async refreshReviewFiles(payload = {}) {
    console.log('\n====== 刷新云端文件调试信息 ======');
    console.log('payload.rowNumber:', payload.rowNumber);
    console.log('payload.folderId:', payload.folderId);
    console.log('payload.finishedFolderId:', payload.finishedFolderId);
    console.log('payload.isApproved:', payload.isApproved);
    console.log('payload.acceptedFiles:', payload.acceptedFiles);
    console.log('payload.acceptedDetails:', payload.acceptedDetails);

    if (!payload.folderId) {
      console.error('❌ 缺少 folderId，无法刷新');
      console.log('============================\n');
      throw new Error('缺少审核目录 ID，无法刷新文件清单');
    }

    await this.ensureApis();

    try {
      const result = await this.resolveReviewFileLists(payload, {
        preferDerived: true,
        treatRootAsFinished: payload.isApproved
      });
      console.log('\n--- resolveReviewFileLists 结果 ---');
      console.log('result.acceptedDetails:', result.acceptedDetails);
      console.log('result.acceptedFiles:', result.acceptedFiles);
      console.log('result.finishedFolderId:', result.finishedFolderId);
      console.log('============================\n');
      return result;
    } catch (error) {
      console.error('❌ resolveReviewFileLists 失败:', error.message);
      console.log('============================\n');
      throw error;
    }
  }

  buildFolderName(metadata = {}, renameOptions = {}) {
    const pattern = (
      renameOptions.folderPattern ||
      this.config.folderPattern ||
      DEFAULT_FOLDER_PATTERN
    )
      .trim()
      || DEFAULT_FOLDER_PATTERN;
    const dateToken =
      metadata.customDate || this.formatDateToken(new Date(), renameOptions?.dateFormat || this.config.dateFormat);
    const tokens = {
      ...metadata,
      customDate: dateToken,
      submitter: metadata.submitter || 'unknown',
      admin: metadata.admin || 'admin',
      software: metadata.software || '',
      subject: metadata.subject || '',
      country: metadata.country || '',
      subjectOrOriginal: metadata.subject || metadata.originalName || '',
      originalName: metadata.originalName || ''
    };

    // 调试日志：buildFolderName
    console.log('[GoogleService] buildFolderName pattern:', pattern);
    const customTextKeys = Object.keys(tokens).filter(k => k.startsWith('customText:'));
    console.log('[GoogleService] CustomText keys in tokens:', customTextKeys);
    customTextKeys.forEach(k => {
      console.log(`[GoogleService]   ${k} =`, tokens[k]);
    });

    // 使用与 FileNamer.buildName 相同的正则替换逻辑
    let result = pattern.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const cleanKey = key.trim();
      const value = tokens[cleanKey];
      console.log(`[GoogleService] Folder token: "${match}", cleanKey: "${cleanKey}", value:`, value);
      if (value === undefined) {
        console.log(`[GoogleService]   Key "${cleanKey}" is undefined, keeping original`);
        return match; // 保留原样
      }
      return this.sanitizeName(value);
    });

    // 移除多余的连字符和空段
    result = result
      .split('-')
      .map(s => s.trim())
      .filter(Boolean)
      .join('-');

    const fallback = `${this.sanitizeName(tokens.customDate)}-${this.sanitizeName(tokens.submitter)}-${this.sanitizeName(
      tokens.admin
    )}`;
    const name = result || fallback || 'upload';
    return name.slice(0, 120);
  }

  formatDateToken(date, format = 'YYYYMMDD') {
    const d = new Date(date);
    const pad = (num) => String(num).padStart(2, '0');
    if (format === 'YYYYMMDD-hhmmss') {
      const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${time}`;
    }
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }

  sanitizeName(value) {
    return String(value || '')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'unknown';
  }

  serializeNamingMetadata(meta = {}) {
    const namingMetadata = {};
    Object.entries(meta || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (typeof value === 'object') {
        return;
      }
      namingMetadata[key] = value;
    });
    return JSON.stringify(namingMetadata);
  }

  parseNamingMetadata(raw = '') {
    if (!raw) {
      return {};
    }
    if (typeof raw === 'object') {
      if (raw.customTexts && typeof raw.customTexts === 'object') {
        Object.entries(raw.customTexts).forEach(([key, value]) => {
          if (raw[key] === undefined) {
            raw[key] = value;
          }
        });
      }
      return raw;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.customTexts && typeof parsed.customTexts === 'object') {
        Object.entries(parsed.customTexts).forEach(([key, value]) => {
          if (parsed[key] === undefined) {
            parsed[key] = value;
          }
        });
      }
      return parsed;
    } catch (error) {
      console.warn('Failed to parse naming metadata', error);
      return {};
    }
  }

  async validateFolder(info) {
    if (!info?.id) {
      return null;
    }
    try {
      const response = await this.drive.files.get({
        fileId: info.id,
        fields: 'id, trashed, webViewLink',
        supportsAllDrives: true
      });
      if (!response.data || response.data.trashed) {
        return null;
      }
      return {
        id: response.data.id,
        link: response.data.webViewLink || `https://drive.google.com/drive/folders/${response.data.id}`
      };
    } catch (error) {
      return null;
    }
  }

  async uploadSingleFile(file, newName, metadata = {}, onProgress = null, abortSignal = null) {
    if (!this.drive) {
      await this.ensureApis();
    }
    // 确保重命名后仍保留原扩展，避免 Drive 无法识别类型
    const originalExt = this.extractExtension(file.overrideName || file.name || file.path || '');
    if (newName && originalExt && !newName.toLowerCase().endsWith(`.${originalExt}`)) {
      newName = `${newName}.${originalExt}`;
    }
    const parents = (() => {
      if (metadata.subFolderId) {
        return [metadata.subFolderId];
      }
      if (metadata.categoryFolderId) {
        return [metadata.categoryFolderId];
      }
      if (this.config.driveFolderId) {
        return [this.config.driveFolderId];
      }
      return undefined;
    })();
    let mimeType = await this.resolveMimeType(file, newName);
    const requestBody = {
      name: newName,
      parents
    };

    // 获取文件大小用于进度计算
    let fileSize = -1;
    try {
      fileSize = fs.statSync(file.path || '').size;
    } catch (_) {
      // ignore
    }

    // 如果无法识别类型，放空 mime，让 Drive 自行探测
    const isMeaningfulMime = (mt) => mt && mt !== 'application/octet-stream';
    if (isMeaningfulMime(mimeType)) {
      requestBody.mimeType = mimeType;
    }

    // 记录一次上传调试信息，方便确认类型判断
    console.log('[UploadDebug]', {
      name: newName,
      path: file.path,
      ext: originalExt,
      resolvedMime: mimeType,
      sentMime: requestBody.mimeType || '(auto)',
      size: fileSize
    });

    // 带重试的上传逻辑
    let lastError = null;
    for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
      // 检查是否已被中断
      if (abortSignal?.aborted) {
        const abortError = new Error('上传已中断');
        abortError.name = 'AbortError';
        throw abortError;
      }

      try {
        // 在每次尝试前检查并刷新 Token
        if (this.isTokenExpiringSoon()) {
          try {
            await this.refreshAccessToken();
            await this.ensureApis();
          } catch (refreshErr) {
            console.warn('[Upload] Token 刷新失败，继续尝试上传:', refreshErr.message);
          }
        }

        // 创建新的读取流（重试时需要重新创建）
        const fileStream = fs.createReadStream(file.path);
        let uploaded = 0;

        // 监听中断信号，销毁读取流
        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            fileStream.destroy(new Error('上传已中断'));
          }, { once: true });
        }

        // 进度监听
        if (onProgress && fileSize > 0) {
          fileStream.on('data', (chunk) => {
            uploaded += chunk.length;
            const progress = Math.min(100, Math.round((uploaded / fileSize) * 100));
            onProgress({ uploaded, total: fileSize, progress, attempt });
          });
        }

        const media = {
          body: fileStream
        };
        if (isMeaningfulMime(mimeType)) {
          media.mimeType = mimeType;
        }

        // 使用 Promise.race 实现超时控制和中断控制
        const uploadPromise = this.drive.files.create({
          requestBody,
          media,
          fields: 'id, name, webViewLink, webContentLink'
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`上传超时（${UPLOAD_TIMEOUT_MS / 1000}秒）`));
          }, UPLOAD_TIMEOUT_MS);
        });

        // 中断 Promise
        const abortPromise = abortSignal ? new Promise((_, reject) => {
          if (abortSignal.aborted) {
            const err = new Error('上传已中断');
            err.name = 'AbortError';
            reject(err);
          }
          abortSignal.addEventListener('abort', () => {
            const err = new Error('上传已中断');
            err.name = 'AbortError';
            reject(err);
          }, { once: true });
        }) : null;

        const racers = [uploadPromise, timeoutPromise];
        if (abortPromise) racers.push(abortPromise);

        const response = await Promise.race(racers);

        let { id, webViewLink, webContentLink } = response.data;
        let link = webViewLink || webContentLink || `https://drive.google.com/file/d/${id}/view?usp=drivesdk`;

        // 上传成功，记录重试次数
        if (attempt > 1) {
          console.log(`[Upload] ${newName} 上传成功（第 ${attempt} 次尝试）`);
        }

        // 视频文件服务端复制 workaround：通过复制+删除原文件触发 Google Drive 即时视频处理
        // 解决 API 上传视频进入慢处理队列导致无法立即预览的问题
        const isVideoFile = mimeType && mimeType.startsWith('video/');
        if (isVideoFile) {
          try {
            console.log(`[Upload] 视频文件检测到，执行服务端复制以触发即时处理: ${newName}`);

            // 1. 服务端复制文件（保持原文件名）
            const copyResponse = await this.drive.files.copy({
              fileId: id,
              requestBody: {
                name: newName,
                parents: requestBody.parents
              },
              fields: 'id, name, webViewLink, webContentLink',
              supportsAllDrives: true
            });

            const copiedId = copyResponse.data.id;
            const copiedLink = copyResponse.data.webViewLink ||
              copyResponse.data.webContentLink ||
              `https://drive.google.com/file/d/${copiedId}/view?usp=drivesdk`;

            console.log(`[Upload] 服务端复制成功: ${copiedId}`);

            // 2. 删除原始上传的文件（Drive API v3 的 delete 是永久删除，不进回收站）
            try {
              await this.drive.files.delete({
                fileId: id,
                supportsAllDrives: true
              });
              console.log(`[Upload] 已永久删除原始文件: ${id}`);
            } catch (deleteError) {
              // 删除失败不影响主流程，只记录警告
              console.warn(`[Upload] 删除原始文件失败（不影响结果）: ${deleteError.message}`);
            }

            // 3. 使用复制后的文件信息
            id = copiedId;
            link = copiedLink;

            console.log(`[Upload] 视频即时处理 workaround 完成: ${link}`);

          } catch (copyError) {
            // 复制失败时回退使用原始文件，视频可能需要等待处理
            console.warn(`[Upload] 视频服务端复制失败，使用原始文件（视频可能需要等待处理）: ${copyError.message}`);
          }
        }

        return { id, link };

      } catch (error) {
        // 如果是中断错误，直接抛出不重试
        if (error.name === 'AbortError' || abortSignal?.aborted) {
          const abortError = new Error('上传已中断');
          abortError.name = 'AbortError';
          throw abortError;
        }

        lastError = error;
        console.warn(`[Upload] ${newName} 上传失败（尝试 ${attempt}/${UPLOAD_MAX_RETRIES}）:`, error.message);

        // 判断是否可以重试
        if (attempt < UPLOAD_MAX_RETRIES && isRetryableError(error)) {
          const delay = UPLOAD_RETRY_DELAYS[attempt - 1] || 8000;
          console.log(`[Upload] 将在 ${delay / 1000} 秒后重试...`);
          await sleep(delay);
          continue;
        }

        // 不可重试或已达最大次数
        break;
      }
    }

    // 所有重试都失败了
    throw lastError || new Error('上传失败');
  }

  async resolveMimeType(file = {}, preferredName = '') {
    const isMeaningful = (mt) => mt && mt !== 'application/octet-stream';
    const extCandidate = this.extractExtension(preferredName || file.overrideName || file.name || file.path || file.extension || '');
    const coerceVideoMime = (mt) => {
      if (!mt) return null;
      const lower = mt.toLowerCase();
      if (lower === 'application/mp4') return 'video/mp4';
      if (extCandidate && VIDEO_MIME_BY_EXT[extCandidate]) {
        if (lower === 'application/octet-stream' || lower === 'binary/octet-stream') {
          return VIDEO_MIME_BY_EXT[extCandidate];
        }
        if (lower === `application/${extCandidate}`) {
          return VIDEO_MIME_BY_EXT[extCandidate];
        }
      }
      if (lower.startsWith('video/')) return mt;
      return lower === 'application/octet-stream' ? null : mt;
    };

    // 1) 优先使用显式或已知 MIME
    const preferredMimes = [
      (file.forcedMimeType || '').trim(),
      (file.mimeType || '').trim(),
      (file.metadata?.mimeType || '').trim(),
      (file.mediaType || '').trim()
    ].filter(isMeaningful);
    if (preferredMimes.length) {
      const coerced = coerceVideoMime(preferredMimes[0]);
      if (coerced) return coerced;
    }

    // 2) 文件内容检测
    const detected = await this.detectMimeTypeFromFile(file?.path);
    if (isMeaningful(detected)) {
      return detected;
    }

    // 3) 根据文件名/路径推断
    const candidates = [
      preferredName,
      file.overrideName,
      file.name,
      file.path,
      file.extension
    ].filter(Boolean);

    for (const value of candidates) {
      const videoMime = this.getVideoMimeFromValue(value);
      if (isMeaningful(videoMime)) {
        return videoMime;
      }
    }

    for (const value of candidates) {
      const resolved = mime.lookup(value);
      if (isMeaningful(resolved)) {
        const coerced = coerceVideoMime(resolved);
        if (coerced) return coerced;
      }
    }

    // 4) 针对视频的兜底：尽量不要返回 application/octet-stream
    const ext = extCandidate;
    if (ext) {
      const mapped = VIDEO_MIME_BY_EXT[ext];
      if (mapped) {
        return mapped;
      }
      if (VIDEO_EXTENSIONS.has(ext)) {
        return `video/${ext === 'mov' ? 'quicktime' : ext}`;
      }
    }
    if (this.isDetectedVideo(file)) {
      return 'video/mp4';
    }
    if (ext && VIDEO_EXTENSIONS.has(ext)) {
      return 'video/mp4';
    }

    return 'application/octet-stream';
  }

  async detectMimeTypeFromFile(filePath) {
    if (!filePath) {
      return null;
    }
    try {
      const detected = await FileType.fromFile(filePath);
      if (detected?.mime && detected.mime !== 'application/octet-stream') {
        return detected.mime;
      }
    } catch (error) {
      // ignore detection errors to avoid blocking uploads
    }
    return null;
  }

  isDetectedVideo(file = {}) {
    if (!file) {
      return false;
    }
    if (file.detectedCategory === 'video') {
      return true;
    }
    if (file.metadata?.detectedCategory === 'video') {
      return true;
    }
    const fromMeta = String(file.mediaType || file.metadata?.mediaType || '').toLowerCase();
    if (fromMeta.startsWith('video')) {
      return true;
    }
    const mimeType = String(file.mimeType || '').toLowerCase();
    if (mimeType.startsWith('video/')) {
      return true;
    }
    return false;
  }

  getVideoMimeFromValue(value) {
    if (!value) {
      return null;
    }
    const str = String(value).trim();
    if (!str) {
      return null;
    }
    const ext = this.extractExtension(str);
    if (ext) {
      const mapped = VIDEO_MIME_BY_EXT[ext];
      if (mapped) {
        return mapped;
      }
      if (VIDEO_EXTENSIONS.has(ext)) {
        return `video/${ext === 'mov' ? 'quicktime' : ext}`;
      }
    }
    return null;
  }

  extractExtension(value) {
    if (!value) {
      return '';
    }
    const normalized = String(value).trim();
    if (!normalized) {
      return '';
    }
    if (normalized.startsWith('.')) {
      return normalized.slice(1).toLowerCase();
    }
    const derived = path.extname(normalized);
    if (derived) {
      return derived.slice(1).toLowerCase();
    }
    if (!normalized.includes('.') && normalized.length <= 5) {
      return normalized.toLowerCase();
    }
    return '';
  }

  async appendSheetRow({ file, metadata, link, renamed }) {
    if (!this.config.sheetId) {
      return null;
    }
    if (!this.sheets) {
      await this.ensureApis();
    }
    const isReview = Boolean(metadata.reviewEnabled);
    if (isReview) {
      await this.ensureReviewHeader();
    }
    let values;
    const renamePatternValue = metadata.reviewRenamePattern || '';
    const folderPatternValue = metadata.reviewFolderPattern || '';
    if (isReview) {
      // 序列化 acceptedDetails 和 rejectedDetails 为 JSON
      const acceptedDetailsJson = Array.isArray(metadata.acceptedDetails) && metadata.acceptedDetails.length > 0
        ? JSON.stringify(metadata.acceptedDetails)
        : '';
      const rejectedDetailsJson = Array.isArray(metadata.rejectedDetails) && metadata.rejectedDetails.length > 0
        ? JSON.stringify(metadata.rejectedDetails)
        : '';

      values = [
        metadata.reviewDescription || metadata.subject || '',
        metadata.submitter || metadata.owner || '',
        metadata.admin || '',
        metadata.completedAt || '',
        metadata.subFolderLink || link || '',
        metadata.mainCategory || '',
        metadata.subCategory || '',
        metadata.reviewer || '',
        '待审核',
        metadata.note || '',
        '',
        metadata.customDate || '',
        metadata.driveFileId || metadata.folderId || '',
        metadata.reviewTargetFolderId || '',
        metadata.reviewTempFolderId || '',
        Array.isArray(metadata.acceptedFiles) ? metadata.acceptedFiles.join('\n') : '',
        Array.isArray(metadata.rejectedFiles) ? metadata.rejectedFiles.join('\n') : '',
        renamePatternValue,
        folderPatternValue,
        metadata.reviewNamingMetadata || '',
        acceptedDetailsJson,  // 新增：合格文件详情 JSON
        rejectedDetailsJson   // 新增：不合格文件详情 JSON
      ];
    } else {
      const readyValue = this.normalizeReadyFlag(metadata.readyFlag);
      const fileName = renamed || file?.name || '';
      values = [
        metadata.submitter || metadata.owner || '',
        metadata.completedAt || '',
        metadata.subFolderLink || link,
        fileName,
        metadata.mainCategory || '',
        metadata.subCategory || '',
        readyValue,
        metadata.admin || '',
        metadata.taskType || '',
        metadata.fileLink || ''
      ];
    }

    const range = isReview
      ? this.getReviewSheetRange()
      : this.config.sheetRange || 'Sheet1!A:J';

    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.config.sheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',  // 防止筛选器导致数据覆盖
      requestBody: { values: [values] }
    });
    const updatedRange = response?.data?.updates?.updatedRange || response?.data?.updatedRange || '';
    const rowNumber = this.parseRowNumberFromRange(updatedRange);

    if (rowNumber && this.firebaseService?.isReady?.()) {
      try {
        await this.firebaseService.updateFileStatus(this.config.sheetId, rowNumber, {
          batchId: params.batchId || '',
          fileName: params.fileName || '',
          fileId: params.fileId || '',
          fileLink: params.fileLink || '',
          submitter: params.submitter || '',
          submitTime: timestamp,
          status: FILE_REVIEW_STATUS.PENDING,
          taskType: params.taskType || '',
          mainCategory: params.mainCategory || '',
          subCategory: params.subCategory || '',
          reviewer: '',
          reviewTime: '',
          reviewNote: '',
          batchStatus: '待审核'
        });
      } catch (error) {
        console.warn('[appendFileReviewRow] Firebase 同步失败:', error.message);
      }
    }

    return updatedRange || range;
  }

  // === 新审核流程：按文件记录的方法 ===

  /**
   * 生成批次ID
   * @param {string} submitter - 提交人
   * @returns {string} 批次ID，格式: BATCH-日期-提交人-时间-随机码
   */
  generateBatchId(submitter = 'USER') {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 5).replace(':', '');
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    const safeSub = this.sanitizeName(submitter || 'USER').slice(0, 10);
    return `BATCH-${dateStr}-${safeSub}-${timeStr}-${random}`;
  }

  /**
   * 获取按文件审核记录的 Sheet 范围
   */
  getFileReviewSheetRange() {
    // 使用专门的文件审核表，或与现有审核表分开
    const range = this.config.fileReviewRange;
    if (range && typeof range === 'string') {
      const [sheetName, area] = range.split('!');
      const areaMatch = area?.match(/^([A-Z]+)\d*:([A-Z]+)\d*$/i);
      if (sheetName && areaMatch && areaMatch[1]?.toUpperCase() === 'A') {
        const endCol = areaMatch[2]?.toUpperCase() || 'A';
        if (this.columnLetterToIndex(endCol) < this.columnLetterToIndex('AF')) {
          return `${sheetName}!A:AF`;
        }
      }
      return range;
    }
    return '文件审核!A:AF';
  }

  /**
   * 获取按文件审核表的名称
   */
  getFileReviewSheetName() {
    const range = this.getFileReviewSheetRange();
    if (range.includes('!')) {
      return range.split('!')[0];
    }
    return '文件审核';
  }

  /**
   * 确保按文件审核表的表头存在
   */
  async ensureFileReviewHeader() {
    if (this.fileReviewHeaderEnsured) {
      return;
    }
    if (!this.config.sheetId) {
      return;
    }
    if (!this.sheets) {
      await this.ensureApis();
    }
    const sheetName = this.getFileReviewSheetName();
    const lastColumn = GoogleService.columnIndexToLetter(FILE_REVIEW_HEADERS.length);
    const headerRange = `${sheetName}!A1:${lastColumn}1`;

    try {
      // 首先尝试获取现有数据
      const existing = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.sheetId,
        range: headerRange
      });
      const headerRow = existing.data.values?.[0] || [];
      const needsUpdate = FILE_REVIEW_HEADERS.some((title, index) => headerRow[index] !== title);
      if (needsUpdate) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.sheetId,
          range: headerRange,
          valueInputOption: 'RAW',
          requestBody: { values: [FILE_REVIEW_HEADERS] }
        });
      }
      this.fileReviewHeaderEnsured = true;
    } catch (error) {
      // 如果是分页不存在的错误，尝试创建分页
      if (error.message?.includes('Unable to parse range') ||
        error.message?.includes('not found') ||
        error.code === 400) {
        console.log(`Creating new sheet: ${sheetName}`);
        try {
          // 创建新的分页
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.config.sheetId,
            requestBody: {
              requests: [{
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }]
            }
          });

          // 写入表头
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.config.sheetId,
            range: headerRange,
            valueInputOption: 'RAW',
            requestBody: { values: [FILE_REVIEW_HEADERS] }
          });

          this.fileReviewHeaderEnsured = true;
          console.log(`Sheet "${sheetName}" created successfully`);
        } catch (createError) {
          console.error('Failed to create file review sheet:', createError.message);
          this.fileReviewHeaderEnsured = false;
        }
      } else {
        console.error('Failed to ensure file review header:', error.message);
        this.fileReviewHeaderEnsured = false;
      }
    }
  }

  /**
   * 按文件写入审核记录（新流程核心方法）
   * @param {Object} params - 参数
   * @param {string} params.fileName - 文件名
   * @param {string} params.fileId - Google Drive 文件 ID
   * @param {string} params.fileLink - 文件链接
   * @param {string} params.batchId - 批次 ID
   * @param {string} params.submitter - 提交人
   * @param {string} params.mainCategory - 主类别
   * @param {string} params.subCategory - 子类别
   * @param {string} params.tempFolderLink - 临时目录链接
   * @param {boolean} params.isReference - 是否为参考文件
   * @returns {Promise<Object>} 写入结果
   */
  async appendFileReviewRow(params = {}) {
    // 参考文件不需要登记到表格
    if (params.isReference) {
      console.log(`[GoogleService] 跳过参考文件登记: ${params.fileName}`);
      return null;
    }

    if (!this.config.sheetId) {
      return null;
    }
    if (!this.sheets) {
      await this.ensureApis();
    }
    await this.ensureFileReviewHeader();

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);

    const values = [
      params.batchId || '',                     // 0  (A): 批次ID
      params.tempFolderLink || '',              // 1  (B): 临时目录链接
      params.fileName || '',                    // 2  (C): 文件名
      params.fileId || '',                      // 3  (D): 文件ID
      params.fileLink || '',                    // 4  (E): 文件链接
      params.submitter || '',                   // 5  (F): 提交人
      timestamp,                                // 6  (G): 提交时间
      FILE_REVIEW_STATUS.PENDING,               // 7  (H): 状态 = 待审核
      params.taskType || '',                    // 8  (I): 任务类型
      params.mainCategory || '',                // 9  (J): 主类别
      params.subCategory || '',                 // 10 (K): 子类别
      '',                                       // 11 (L): 审核人（初始为空）
      '',                                       // 12 (M): 审核时间（初始为空）
      '',                                       // 13 (N): 审核备注（初始为空）
      '待审核',                                  // 14 (O): 批次审核状态
      '',                                       // 15 (P): 入库后最终文件夹链接
      '',                                       // 16 (Q): 入库后文件链接
      params.linkedFileId || '',                // 17 (R): 关联文件ID
      params.referenceFolderId || '',           // 18 (S): 参考文件夹ID
      '',                                       // 19 (T): 批次备注
      params.admin || '',                       // 20 (U): 管理员
      params.renamePattern || '',               // 21 (V): 文件命名规则
      params.folderPattern || '',               // 22 (W): 文件夹命名规则
      params.namingMetadata || '',              // 23 (X): 命名元数据
      params.targetFolderId || '',              // 24 (Y): 入库目标ID
      params.namingResult || '',                // 25 (Z): 实际命名结果
      '',                                       // 26 (AA): 标注文件ID
      '',                                       // 27 (AB): 标注时间
      params.referenceFolderLink || '',         // 28 (AC): 参考文件夹链接
      params.reviewSlotName || '',              // 29 (AD): 批次显示名
      params.reviewDescription || '',           // 30 (AE): 批次描述
      params.reviewNote || ''                   // 31 (AF): 提交备注
    ];

    const sheetName = this.getFileReviewSheetName();
    // 强制从 A 列开始追加，防止用户配置的范围偏移导致数据错列 (例如配置成了 O:Z)
    const range = `${sheetName}!A:AB`;

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.config.sheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',  // 防止筛选器导致数据覆盖
      requestBody: { values: [values] }
    });

    return {
      range,
      batchId: params.batchId,
      fileName: params.fileName,
      fileId: params.fileId
    };
  }

  /**
   * 获取按文件审核记录（新流程）
   * @param {Object} options - 选项
   * @param {boolean} options.groupByBatch - 是否按批次分组，默认 true
   * @returns {Promise<Object>} 审核记录结果
   */
  async fetchFileReviewEntries(options = {}) {
    const groupByBatch = options.groupByBatch !== false;

    if (!this.config.sheetId) {
      return groupByBatch ? { batches: [], files: [] } : [];
    }

    const range = this.getFileReviewSheetRange();
    await this.ensureApis();
    await this.ensureFileReviewHeader();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.sheetId,
      range
    });

    const rows = response.data.values || [];
    const startRow = this.parseRangeStartRow(range);
    const files = [];

    rows.forEach((row, index) => {
      const rowNumber = startRow + index;
      if (!row || !row.length) return;
      // 跳过表头
      if (index === 0 && row[0] === '批次ID') return;

      const fileName = row[2] || '';
      const fileId = row[3] || '';
      const fileLink = row[4] || '';
      if (!fileName && !fileId && !fileLink) return;

      const entry = {
        rowNumber,
        batchId: row[0] || '',                   // 0  (A): 批次ID
        tempFolderLink: row[1] || '',            // 1  (B): 临时目录链接
        fileName,                                // 2  (C): 文件名
        fileId,                                  // 3  (D): 文件ID
        fileLink,                                // 4  (E): 文件链接
        submitter: row[5] || '',                 // 5  (F): 提交人
        submitTime: row[6] || '',                // 6  (G): 提交时间
        status: row[7] || FILE_REVIEW_STATUS.PENDING, // 7  (H): 状态
        taskType: row[8] || '',                  // 8  (I): 任务类型
        mainCategory: row[9] || '',              // 9  (J): 主类别
        subCategory: row[10] || '',              // 10 (K): 子类别
        reviewer: row[11] || '',                 // 11 (L): 审核人
        reviewTime: row[12] || '',               // 12 (M): 审核时间
        reviewNote: row[13] || '',               // 13 (N): 审核备注
        batchStatus: row[14] || '',              // 14 (O): 批次审核状态
        finalFolderLink: row[15] || '',          // 15 (P): 入库后最终文件夹链接
        finalFileLink: row[16] || '',            // 16 (Q): 入库后文件链接
        linkedFileId: row[17] || '',             // 17 (R): 关联文件ID
        referenceFolderId: row[18] || '',        // 18 (S): 参考文件夹ID
        batchNote: row[19] || '',                // 19 (T): 批次备注
        admin: row[20] || '',                    // 20 (U): 管理员
        renamePattern: row[21] || '',            // 21 (V): 文件命名规则
        folderPattern: row[22] || '',            // 22 (W): 文件夹命名规则
        namingMetadata: row[23] || '',           // 23 (X): 命名元数据
        targetFolderId: row[24] || '',           // 24 (Y): 入库目标ID
        namingResult: row[25] || '',             // 25 (Z): 实际命名结果
        annotatedFileId: row[26] || '',          // 26 (AA): 标注文件ID
        annotatedTime: row[27] || '',            // 27 (AB): 标注时间
        referenceFolderLink: row[28] || '',      // 28 (AC): 参考文件夹链接
        reviewSlotName: row[29] || '',           // 29 (AD): 批次显示名
        reviewDescription: row[30] || '',        // 30 (AE): 批次描述
        submitNote: row[31] || ''                // 31 (AF): 提交备注
      };

      files.push(entry);
    });

    if (!groupByBatch) {
      return files;
    }

    // 按批次ID分组
    const batchMap = new Map();
    files.forEach(file => {
      const batchId = file.batchId || 'NO_BATCH';
      if (!batchMap.has(batchId)) {
        batchMap.set(batchId, {
          batchId,
          submitter: file.submitter,
          submitTime: file.submitTime,
          taskType: file.taskType || '',
          mainCategory: file.mainCategory,
          subCategory: file.subCategory,
          tempFolderLink: file.tempFolderLink,
          finalFolderLink: '', // 入库后的最终目录链接
          referenceFolderId: file.referenceFolderId || '', // 参考文件夹ID（缓存）
          batchNote: file.batchNote || '', // 批次备注（缓存）
          admin: file.admin || '', // 管理员（缓存）
          renamePattern: file.renamePattern || '', // 文件命名规则（缓存）
          folderPattern: file.folderPattern || '', // 文件夹命名规则（缓存）
          namingMetadata: file.namingMetadata || '', // 命名元数据（缓存）
          targetFolderId: file.targetFolderId || '', // 入库目标ID（缓存）
          namingResult: file.namingResult || '', // 实际命名结果（缓存）
          referenceFolderLink: file.referenceFolderLink || '', // 参考文件夹链接（缓存）
          reviewSlotName: file.reviewSlotName || '', // 批次显示名（缓存）
          reviewDescription: file.reviewDescription || '', // 批次描述（缓存）
          reviewNote: file.reviewNote || '', // 提交备注（缓存）
          files: [],
          referenceFiles: [], // 参考文件列表（从Drive动态加载）
          status: FILE_REVIEW_STATUS.PENDING,  // 批次状态（自动计算）
          batchStatus: file.batchStatus || '',  // 批次手动状态
          counts: {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            stored: 0
          }
        });
      }

      const batch = batchMap.get(batchId);

      // 所有文件都是待审核文件（参考文件不记录到表格）
      batch.files.push(file);
      batch.counts.total++;

      // 如果此文件有参考文件夹ID，更新批次的缓存
      if (file.referenceFolderId && !batch.referenceFolderId) {
        batch.referenceFolderId = file.referenceFolderId;
      }
      if (file.referenceFolderLink && !batch.referenceFolderLink) {
        batch.referenceFolderLink = file.referenceFolderLink;
      }
      if (file.batchNote && !batch.batchNote) {
        batch.batchNote = file.batchNote;
      }
      if (file.reviewSlotName && !batch.reviewSlotName) {
        batch.reviewSlotName = file.reviewSlotName;
      }
      if (file.reviewDescription && !batch.reviewDescription) {
        batch.reviewDescription = file.reviewDescription;
      }
      if (file.reviewNote && !batch.reviewNote) {
        batch.reviewNote = file.reviewNote;
      }
      if (file.taskType && !batch.taskType) {
        batch.taskType = file.taskType;
      }
      if (file.admin && !batch.admin) {
        batch.admin = file.admin;
      }
      if (file.renamePattern && !batch.renamePattern) {
        batch.renamePattern = file.renamePattern;
      }
      if (file.folderPattern && !batch.folderPattern) {
        batch.folderPattern = file.folderPattern;
      }
      if (file.namingMetadata && !batch.namingMetadata) {
        batch.namingMetadata = file.namingMetadata;
      }
      if (file.targetFolderId && !batch.targetFolderId) {
        batch.targetFolderId = file.targetFolderId;
      }
      if (file.namingResult && !batch.namingResult) {
        batch.namingResult = file.namingResult;
      }

      // 如果文件有 finalLink，提取目录链接
      if (file.finalLink && file.status === FILE_REVIEW_STATUS.STORED) {
        // 从文件链接提取目录ID（通常入库后文件在同一目录）
        const fileIdMatch = file.finalLink.match(/\/d\/([^\/]+)/);
        if (fileIdMatch && !batch.finalFolderLink) {
          // 使用第一个已入库文件的目录作为批次目录链接
          // 实际链接在入库时设置，这里先用空
        }
      }

      // 统计状态
      switch (file.status) {
        case FILE_REVIEW_STATUS.PENDING:
          batch.counts.pending++;
          break;
        case FILE_REVIEW_STATUS.APPROVED:
          batch.counts.approved++;
          break;
        case FILE_REVIEW_STATUS.REJECTED:
          batch.counts.rejected++;
          break;
        case FILE_REVIEW_STATUS.STORED:
          batch.counts.stored++;
          // 获取入库目录链接 - 优先使用文件记录中的 finalFolderLink（第15列P列）
          if (file.finalFolderLink && !batch.finalFolderLink) {
            batch.finalFolderLink = file.finalFolderLink;
          }
          break;
      }
    });

    // 计算批次状态
    batchMap.forEach(batch => {
      if (batch.counts.stored === batch.counts.total) {
        batch.status = FILE_REVIEW_STATUS.STORED;
      } else if (batch.counts.approved === batch.counts.total) {
        batch.status = FILE_REVIEW_STATUS.APPROVED;
      } else if (batch.counts.rejected > 0) {
        batch.status = FILE_REVIEW_STATUS.REJECTED;
      } else {
        batch.status = FILE_REVIEW_STATUS.PENDING;
      }
    });

    // 按提交时间倒序排列
    const batches = Array.from(batchMap.values()).sort((a, b) => {
      return (b.submitTime || '').localeCompare(a.submitTime || '');
    });

    // 🚀 性能优化：延迟加载参考文件
    // 不在初始加载时加载所有参考文件，改为前端按需加载（用户点击查看时）
    // 为每个批次标记参考文件状态
    batches.forEach(batch => {
      batch.referenceFilesLoaded = false; // 标记未加载
      batch.referenceFiles = batch.referenceFiles || []; // 确保有空数组
    });

    return { batches, files };
  }

  /**
   * 为批次加载参考文件
   * 如果没有缓存的参考文件夹ID，会尝试从临时目录查找并缓存
   */
  async loadReferenceFilesForBatches(batches) {
    const batchesToUpdate = [];

    for (const batch of batches) {
      // 如果已经有参考文件夹ID，直接读取文件
      if (batch.referenceFolderId) {
        try {
          const files = await this.listFilesInFolder(batch.referenceFolderId);
          batch.referenceFiles = files.map(f => ({
            fileId: f.id,
            fileName: f.name,
            fileLink: `https://drive.google.com/file/d/${f.id}/view`
          }));
          console.log(`[GoogleService] 批次 ${batch.batchId} 加载了 ${batch.referenceFiles.length} 个参考文件`);
        } catch (err) {
          console.warn(`[GoogleService] 读取参考文件夹失败: ${err.message}`);
        }
        continue;
      }

      // 没有参考文件夹ID，尝试从临时目录查找
      if (!batch.tempFolderLink) continue;

      const tempFolderMatch = batch.tempFolderLink.match(/folders\/([a-zA-Z0-9_-]+)/);
      if (!tempFolderMatch) continue;

      const tempFolderId = tempFolderMatch[1];

      try {
        // 查找"参考"子文件夹
        const refFolder = await this.findChildFolder(tempFolderId, REFERENCE_FOLDER_NAME);
        if (refFolder) {
          batch.referenceFolderId = refFolder.id;

          // 读取参考文件
          const files = await this.listFilesInFolder(refFolder.id);
          batch.referenceFiles = files.map(f => ({
            fileId: f.id,
            fileName: f.name,
            fileLink: `https://drive.google.com/file/d/${f.id}/view`
          }));

          // 记录需要更新表格的批次
          batchesToUpdate.push({
            batchId: batch.batchId,
            referenceFolderId: refFolder.id
          });
        }
      } catch (err) {
        console.warn(`[GoogleService] 查找参考文件夹失败: ${err.message}`);
      }
    }

    // 批量更新表格（将参考文件夹ID缓存到S列）
    if (batchesToUpdate.length > 0) {
      await this.cacheReferenceFolderIds(batchesToUpdate);
    }
  }

  /**
   * 🚀 为单个批次加载参考文件（按需加载 API）
   * @param {Object} params - 参数
   * @param {string} params.batchId - 批次ID
   * @param {string} params.referenceFolderId - 参考文件夹ID（如果有）
   * @param {string} params.tempFolderLink - 临时目录链接
   * @returns {Promise<Object>} - { referenceFiles, referenceFolderId }
   */
  async loadReferenceFilesForBatch(params = {}) {
    const { batchId, referenceFolderId, tempFolderLink } = params;

    let referenceFiles = [];
    let foundFolderId = referenceFolderId;

    // 如果已经有参考文件夹ID，直接读取文件
    if (referenceFolderId) {
      try {
        const files = await this.listFilesInFolder(referenceFolderId);
        referenceFiles = files.map(f => ({
          fileId: f.id,
          fileName: f.name,
          fileLink: `https://drive.google.com/file/d/${f.id}/view`
        }));
        console.log(`[GoogleService] 批次 ${batchId} 加载了 ${referenceFiles.length} 个参考文件`);
        return { referenceFiles, referenceFolderId: foundFolderId };
      } catch (err) {
        console.warn(`[GoogleService] 读取参考文件夹失败: ${err.message}`);
        return { referenceFiles: [], referenceFolderId: null };
      }
    }

    // 没有参考文件夹ID，尝试从临时目录查找
    if (!tempFolderLink) {
      return { referenceFiles: [], referenceFolderId: null };
    }

    const tempFolderMatch = tempFolderLink.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (!tempFolderMatch) {
      return { referenceFiles: [], referenceFolderId: null };
    }

    const tempFolderId = tempFolderMatch[1];

    try {
      // 查找"参考"子文件夹
      const refFolder = await this.findChildFolder(tempFolderId, REFERENCE_FOLDER_NAME);
      if (refFolder) {
        foundFolderId = refFolder.id;

        // 读取参考文件
        const files = await this.listFilesInFolder(refFolder.id);
        referenceFiles = files.map(f => ({
          fileId: f.id,
          fileName: f.name,
          fileLink: `https://drive.google.com/file/d/${f.id}/view`
        }));

        console.log(`[GoogleService] 批次 ${batchId} 加载了 ${referenceFiles.length} 个参考文件`);

        // 缓存参考文件夹ID到表格
        try {
          await this.cacheReferenceFolderIds([{ batchId, referenceFolderId: foundFolderId }]);
        } catch (e) {
          console.warn('[GoogleService] 缓存参考文件夹ID失败:', e.message);
        }

        return { referenceFiles, referenceFolderId: foundFolderId };
      }
    } catch (err) {
      console.warn(`[GoogleService] 查找参考文件夹失败: ${err.message}`);
    }

    return { referenceFiles: [], referenceFolderId: null };
  }

  /**
   * 查找指定文件夹下的子文件夹
   */
  async findChildFolder(parentId, folderName) {
    await this.ensureApis();

    const response = await this.drive.files.list({
      q: `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    return response.data.files?.[0] || null;
  }

  /**
   * 列出文件夹中的所有文件
   */
  async listFilesInFolder(folderId) {
    await this.ensureApis();

    const response = await this.drive.files.list({
      q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    return response.data.files || [];
  }

  /**
   * 将参考文件夹ID缓存到表格的S列
   */
  async cacheReferenceFolderIds(updates) {
    if (!updates.length) return;

    await this.ensureApis();

    const sheetName = this.getFileReviewSheetName();
    const range = this.getFileReviewSheetRange();

    // 获取所有数据找到对应的行
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.sheetId,
      range: `${sheetName}!A:S`
    });

    const rows = response.data.values || [];
    const updateData = [];

    updates.forEach(({ batchId, referenceFolderId }) => {
      // 找到该批次的第一行
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if ((row[0] || '').trim() === batchId.trim()) {
          // 更新S列（索引18）
          updateData.push({
            range: `${sheetName}!S${i + 1}`,
            values: [[referenceFolderId]]
          });
          break; // 只更新第一行
        }
      }
    });

    if (updateData.length > 0) {
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateData
        }
      });
      console.log(`[GoogleService] 已缓存 ${updateData.length} 个批次的参考文件夹ID`);
    }
  }

  /**
   * 更新单个文件的审核状态
   * @param {Object} params - 参数
   * @param {number} params.rowNumber - 行号
   * @param {string} params.status - 新状态
   * @param {string} params.reviewer - 审核人
   * @param {string} params.reviewNote - 审核备注
   * @returns {Promise<Object>}
   */
  async updateFileReviewStatus(params = {}) {
    if (!params.rowNumber || !this.config.sheetId) {
      throw new Error('缺少必要参数');
    }

    await this.ensureApis();

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);

    const sheetName = this.getFileReviewSheetName();
    const sheetUpdates = [];

    // 只有在明确提供参数时才更新对应列，避免互相覆盖
    // H列: 状态
    if (params.status !== undefined) {
      sheetUpdates.push({
        range: `${sheetName}!H${params.rowNumber}`,
        values: [[params.status]]
      });
    }

    // L列: 审核人
    if (params.reviewer !== undefined) {
      sheetUpdates.push({
        range: `${sheetName}!L${params.rowNumber}`,
        values: [[params.reviewer]]
      });
    }

    // M列: 审核时间 (只要有更新就刷新时间)
    sheetUpdates.push({
      range: `${sheetName}!M${params.rowNumber}`,
      values: [[timestamp]]
    });

    // N列: 审核备注
    if (params.reviewNote !== undefined) {
      sheetUpdates.push({
        range: `${sheetName}!N${params.rowNumber}`,
        values: [[params.reviewNote]]
      });
    }

    if (sheetUpdates.length > 0) {
      try {
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.config.sheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: sheetUpdates
          }
        });
      } catch (error) {
        // 检查是否是权限错误
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('permission') || msg.includes('forbidden') || error.code === 403) {
          throw new Error(`您的账号没有该 Google Sheet 的编辑权限。请让表格所有者将您添加为「编辑者」。(表格ID: ${this.config.sheetId})`);
        }
        throw error;
      }
    }

    return { success: true, rowNumber: params.rowNumber, status: params.status };
  }

  /**
   * 批量更新文件审核状态
   * @param {Array<Object>} updates - 更新列表
   * @returns {Promise<Object>}
   */
  async batchUpdateFileReviewStatus(updates = []) {
    if (!updates.length || !this.config.sheetId) {
      return { success: false, updated: 0 };
    }

    await this.ensureApis();

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);
    const sheetName = this.getFileReviewSheetName();

    const batchData = [];
    updates.forEach(update => {
      if (!update.rowNumber) return;

      // H列: 状态
      if (update.status !== undefined) {
        batchData.push({
          range: `${sheetName}!H${update.rowNumber}`,
          values: [[update.status]]
        });
      }

      // L列: 审核人
      if (update.reviewer !== undefined) {
        batchData.push({
          range: `${sheetName}!L${update.rowNumber}`,
          values: [[update.reviewer]]
        });
      }

      // M列: 审核时间
      batchData.push({
        range: `${sheetName}!M${update.rowNumber}`,
        values: [[timestamp]]
      });

      // N列: 审核备注
      if (update.reviewNote !== undefined) {
        batchData.push({
          range: `${sheetName}!N${update.rowNumber}`,
          values: [[update.reviewNote]]
        });
      }
    });

    if (!batchData.length) {
      return { success: false, updated: 0 };
    }

    try {
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: batchData
        }
      });
    } catch (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('forbidden') || error.code === 403) {
        throw new Error(`您的账号没有该 Google Sheet 的编辑权限。请让表格所有者将您添加为「编辑者」。(表格ID: ${this.config.sheetId})`);
      }
      throw error;
    }

    return { success: true, updated: batchData.length };
  }

  /**
   * 批量更新批次备注（按行号写入）
   * @param {Array<number>} rows - 行号列表
   * @param {string} note - 批次备注
   * @returns {Promise<Object>}
   */
  async batchUpdateFileReviewBatchNote(rows = [], note = '') {
    if (!Array.isArray(rows) || rows.length === 0 || !this.config.sheetId) {
      return { success: false, updated: 0 };
    }

    await this.ensureApis();
    await this.ensureFileReviewHeader();

    const sheetName = this.getFileReviewSheetName();
    const batchData = rows
      .filter((rowNumber) => Number.isFinite(rowNumber))
      .map((rowNumber) => ({
        range: `${sheetName}!T${rowNumber}`,
        values: [[note]]
      }));

    if (!batchData.length) {
      return { success: false, updated: 0 };
    }

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.config.sheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchData
      }
    });

    return { success: true, updated: batchData.length };
  }

  /**
   * 入库：将合格文件移动到最终目录
   * @param {Object} params - 参数
   * @param {string} params.batchId - 批次ID
   * @param {Array<Object>} params.files - 要入库的文件列表（必须包含 fileId, rowNumber）
   * @param {string} params.mainCategory - 主类别（用于确定目标目录）
   * @param {string} params.subCategory - 子类别（用于确定目标目录）
   * @param {string} params.submitter - 提交人（用于创建子文件夹）
   * @returns {Promise<Object>}
   */
  async storeFilesToLibrary(params = {}) {
    const {
      batchId,
      files = [],
      mainCategory,
      subCategory,
      submitter,
      folderName,
      targetFolderId: preferredTargetFolderId,
      folderPattern,
      namingMetadata,
      admin
    } = params;

    if (!files.length) {
      return { success: false, message: '没有需要入库的文件' };
    }

    console.log(`[GoogleService] storeFilesToLibrary: 收到 ${files.length} 个文件`);
    files.forEach((f, i) => {
      console.log(`[GoogleService]   文件[${i}]: fileId=${f.fileId}, rowNumber=${f.rowNumber}, namingResult=${f.namingResult || '无'}`);
    });

    await this.ensureApis();

    // 1. 获取目标目录ID（根据主类别+子类别）
    let targetFolderId = preferredTargetFolderId || null;
    try {
      if (!targetFolderId) {
        const categories = await this.fetchCategories();
        const category = categories.find(c =>
          c.mainCategory === mainCategory && c.subCategory === subCategory
        );
        if (category && category.folderId) {
          targetFolderId = category.folderId;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch category folder:', error.message);
    }

    if (!targetFolderId) {
      // 使用默认 Drive 文件夹
      targetFolderId = this.config.driveFolderId;
    }

    if (!targetFolderId) {
      return { success: false, message: '未找到目标入库目录' };
    }

    // 2. 创建提交时的命名子文件夹
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fallbackFolderName = `${dateStr}-${this.sanitizeName(submitter || 'Unknown')}`;
    let resolvedFolderName = '';
    if (!folderName && (folderPattern || namingMetadata)) {
      const parsedMeta = this.parseNamingMetadata(namingMetadata);
      resolvedFolderName = this.buildFolderName(
        {
          ...parsedMeta,
          submitter: submitter || parsedMeta.submitter || '',
          admin: admin || parsedMeta.admin || ''
        },
        { folderPattern: folderPattern || this.config.folderPattern, dateFormat: this.config.dateFormat }
      );
    }
    resolvedFolderName = this.sanitizeName(folderName || resolvedFolderName || fallbackFolderName);

    let finalFolder;
    try {
      finalFolder = await this.ensureNamedChildFolder(targetFolderId, resolvedFolderName);
    } catch (error) {
      return { success: false, message: `创建目标文件夹失败：${error.message}` };
    }

    const isMovePermissionError = (error) => {
      if (!error) return false;
      const message = String(error.message || '').toLowerCase();
      const reasons = (error.response?.data?.error?.errors || [])
        .map((item) => item?.reason || '')
        .join(' ')
        .toLowerCase();
      const hint = `${message} ${reasons}`;
      return (
        hint.includes('insufficient') ||
        hint.includes('permission') ||
        hint.includes('forbidden') ||
        hint.includes('cannot move') ||
        hint.includes('cannotmove') ||
        hint.includes('not allowed') ||
        hint.includes('shared drive') ||
        hint.includes('ownership')
      );
    };

    // 3. 移动每个文件到最终目录
    const results = [];
    const sheetUpdates = [];
    const sheetName = this.getFileReviewSheetName();

    for (const file of files) {
      try {
        // 获取文件当前父目录和名称
        const fileInfo = await this.drive.files.get({
          fileId: file.fileId,
          fields: 'id, name, parents',
          supportsAllDrives: true
        });

        const currentParents = fileInfo.data.parents || [];
        const currentName = fileInfo.data.name || '';

        // 确定最终文件名：优先使用 namingResult（规范命名结果）
        let finalFileName = currentName;
        if (file.namingResult && file.namingResult.trim()) {
          // 使用规范命名结果
          finalFileName = file.namingResult.trim();

          // 如果 namingResult 中还有未替换的 token，使用批次数据替换
          if (finalFileName.includes('{{')) {
            const parsedMeta = this.parseNamingMetadata(namingMetadata);
            const tokens = {
              submitter: submitter || parsedMeta.submitter || '',
              admin: admin || parsedMeta.admin || '',
              subject: parsedMeta.subject || '',
              customDate: parsedMeta.customDate || '',
              country: parsedMeta.country || '',
              software: parsedMeta.software || '',
              eventName: parsedMeta.eventName || ''
            };
            // 添加自定义文本字段
            Object.keys(parsedMeta).forEach(key => {
              if (key.startsWith('customText:')) {
                tokens[key] = parsedMeta[key] || '';
              }
            });
            finalFileName = finalFileName.replace(/\{\{(\w+(?::\w+)?)\}\}/g, (match, key) => {
              return tokens[key] !== undefined && tokens[key] !== '' ? tokens[key] : match;
            });
            console.log(`[GoogleService] 入库时替换 token: "${file.namingResult}" -> "${finalFileName}"`);
          }

          console.log(`[GoogleService] 入库重命名: "${currentName}" -> "${finalFileName}"`);
        }

        // 检查文件是否已经在目标目录中
        const alreadyInTarget = currentParents.includes(finalFolder.id);
        let finalLink = `https://drive.google.com/file/d/${file.fileId}/view`;

        if (alreadyInTarget) {
          // 文件已在目标目录，只处理重命名
          if (finalFileName !== currentName) {
            await this.drive.files.update({
              fileId: file.fileId,
              requestBody: { name: finalFileName },
              fields: 'id, name',
              supportsAllDrives: true
            });
            console.log(`[GoogleService] 文件已在目标目录，仅重命名: "${currentName}" -> "${finalFileName}"`);
          } else {
            console.log(`[GoogleService] 文件已在目标目录且无需重命名，跳过: ${file.fileId}`);
          }
        } else {
          // 需要移动文件到最终目录
          const updateRequest = {
            fileId: file.fileId,
            addParents: finalFolder.id,
            fields: 'id, webViewLink, name',
            supportsAllDrives: true
          };

          // 移除所有现有父目录（必须移除，否则会报"Increasing the number of parents"错误）
          if (currentParents.length > 0) {
            updateRequest.removeParents = currentParents.join(',');
          }

          // 如果需要重命名，添加 requestBody
          if (finalFileName !== currentName) {
            updateRequest.requestBody = { name: finalFileName };
          }
          try {
            const updated = await this.drive.files.update(updateRequest);
            if (updated?.data?.webViewLink) {
              finalLink = updated.data.webViewLink;
            }
          } catch (error) {
            if (!isMovePermissionError(error)) {
              throw error;
            }
            console.warn('[GoogleService] 无权限移动，尝试复制入库:', error.message);
            const copied = await this.drive.files.copy({
              fileId: file.fileId,
              requestBody: {
                name: finalFileName,
                parents: [finalFolder.id]
              },
              fields: 'id, webViewLink, name',
              supportsAllDrives: true
            });
            if (copied?.data?.webViewLink) {
              finalLink = copied.data.webViewLink;
            }
          }
        }

        // 准备 Sheet 更新数据
        // 如果文件被重命名，更新文件名（C列）
        if (finalFileName !== currentName) {
          sheetUpdates.push({
            range: `${sheetName}!C${file.rowNumber}`,
            values: [[finalFileName]]
          });
        }
        // 更新状态（H列）
        sheetUpdates.push({
          range: `${sheetName}!H${file.rowNumber}`,
          values: [[FILE_REVIEW_STATUS.STORED]]
        });
        // 更新审核人、审核时间、审核备注（L到N列）
        sheetUpdates.push({
          range: `${sheetName}!L${file.rowNumber}:N${file.rowNumber}`,
          values: [[
            params.reviewer || '',       // L: 审核人
            new Date().toISOString().replace('T', ' ').slice(0, 19),  // M: 审核时间
            '已入库'                      // N: 审核备注
          ]]
        });
        // 批次审核状态由人工选择，不在入库时自动覆盖
        // 更新入库后文件夹链接、文件链接（P到Q列）
        sheetUpdates.push({
          range: `${sheetName}!P${file.rowNumber}:Q${file.rowNumber}`,
          values: [[
            finalFolder.link,            // P: 入库后最终文件夹链接
            finalLink                    // Q: 入库后文件链接
          ]]
        });

        results.push({
          fileId: file.fileId,
          status: 'success',
          finalLink
        });
        console.log(`[GoogleService] 文件 ${file.fileId} (行${file.rowNumber}) 入库成功，准备更新 ${sheetUpdates.length} 条表格记录`);
      } catch (error) {
        console.error(`[GoogleService] 文件 ${file.fileId} (行${file.rowNumber}) 入库失败:`, error.message);
        results.push({
          fileId: file.fileId,
          status: 'error',
          message: error.message
        });
      }
    }

    console.log(`[GoogleService] 入库处理完成，共 ${results.length} 个文件，sheetUpdates 共 ${sheetUpdates.length} 条`);

    // 4. 批量更新 Sheet
    if (sheetUpdates.length) {
      try {
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.config.sheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: sheetUpdates
          }
        });
        console.log(`[GoogleService] 成功更新表格 ${sheetUpdates.length} 条记录`);
      } catch (error) {
        console.warn('Failed to update sheet after storing files:', error.message);
      }
    } else {
      console.log('[GoogleService] 没有表格更新记录');
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return {
      success: true,
      stored: successCount,
      errors: errorCount,
      folderLink: finalFolder.link,
      results
    };
  }

  /**
   * 替换不合格文件（方案C）
   * @param {Object} params - 参数
   * @param {string} params.oldFileId - 旧文件ID
   * @param {number} params.oldRowNumber - 旧文件行号
   * @param {string} params.tempFolderId - 临时目录ID
   * @param {string} params.tempFolderLink - 临时目录链接
   * @param {string} params.batchId - 批次ID
   * @param {string} params.submitter - 提交人
   * @param {string} params.mainCategory - 主类别
   * @param {string} params.subCategory - 子类别
   * @param {Object} params.newFile - 新文件信息 { path, name }
   * @returns {Promise<Object>}
   */
  async replaceRejectedFile(params = {}) {
    const {
      oldFileId,
      oldRowNumber,
      tempFolderId,
      tempFolderLink,
      batchId,
      submitter,
      mainCategory,
      subCategory,
      newFile
    } = params;

    if (!oldFileId || !newFile || !oldRowNumber) {
      return { success: false, message: '参数不完整' };
    }

    await this.ensureApis();

    // 1. 确保「已删除」文件夹存在
    let deletedFolder;
    const parentFolderId = tempFolderId || this.config.driveFolderId;

    try {
      deletedFolder = await this.ensureNamedChildFolder(parentFolderId, DELETED_FOLDER_NAME);
    } catch (error) {
      return { success: false, message: `创建已删除文件夹失败：${error.message}` };
    }

    // 2. 将旧文件移到「已删除」文件夹
    try {
      const fileInfo = await this.drive.files.get({
        fileId: oldFileId,
        fields: 'id, name, parents',
        supportsAllDrives: true
      });

      const currentParents = fileInfo.data.parents || [];

      await this.drive.files.update({
        fileId: oldFileId,
        addParents: deletedFolder.id,
        removeParents: currentParents.join(','),
        fields: 'id',
        supportsAllDrives: true
      });
    } catch (error) {
      // 如果旧文件不存在或已被删除，继续处理
      console.warn(`移动旧文件失败（可能已不存在）：${error.message}`);
    }

    // 3. 上传新文件到临时目录
    let uploadResult;
    try {
      uploadResult = await this.uploadSingleFile(
        newFile,
        newFile.name,
        { subFolderId: tempFolderId }
      );
    } catch (error) {
      return { success: false, message: `上传新文件失败：${error.message}` };
    }

    // 4. 直接更新原行的文件信息（与保存标注一样的逻辑）
    const sheetName = this.getFileReviewSheetName();
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);

    try {
      // 更新原行（根据 fetchFileReviewEntries 的列映射）：
      // C列(row[2])：文件名
      // D列(row[3])：文件ID
      // E列(row[4])：文件链接
      // H列(row[7])：状态
      // M列(row[12])：审核时间
      // N列(row[13])：审核备注
      const updates = [
        {
          range: `${sheetName}!C${oldRowNumber}`,
          values: [[newFile.name]]
        },
        {
          range: `${sheetName}!D${oldRowNumber}`,
          values: [[uploadResult.id]]
        },
        {
          range: `${sheetName}!E${oldRowNumber}`,
          values: [[uploadResult.link]]
        },
        {
          range: `${sheetName}!H${oldRowNumber}`,
          values: [[FILE_REVIEW_STATUS.PENDING]] // 重置为待审核
        },
        {
          range: `${sheetName}!M${oldRowNumber}`,
          values: [[timestamp]]
        },
        {
          range: `${sheetName}!N${oldRowNumber}`,
          values: [[`已替换原文件 (${timestamp})`]]
        },
        // 清除旧的标注文件ID和时间，确保缩略图和预览显示新替换的文件
        {
          range: `${sheetName}!AA${oldRowNumber}`,
          values: [['']]
        },
        {
          range: `${sheetName}!AB${oldRowNumber}`,
          values: [['']]
        }
      ];

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
    } catch (error) {
      console.warn('Failed to update file info in sheet:', error.message);
      return { success: false, message: `更新表格失败：${error.message}` };
    }

    if (this.firebaseService?.isReady?.()) {
      try {
        await this.firebaseService.updateFileStatus(this.config.sheetId, oldRowNumber, {
          fileId: uploadResult.id,
          fileLink: uploadResult.link,
          fileName: newFile.name,
          status: FILE_REVIEW_STATUS.PENDING,
          reviewNote: `已替换原文件 (${timestamp})`
        });
      } catch (error) {
        console.warn('[replaceRejectedFile] Firebase 同步失败:', error.message);
      }
    }

    return {
      success: true,
      newFileId: uploadResult.id,
      newFileLink: uploadResult.link,
      newFileName: newFile.name,
      oldFileId,
      rowNumber: oldRowNumber
    };
  }

  /**
   * 删除审核文件
   * @param {Object} params - 参数
   * @param {string} params.fileId - 要删除的文件ID
   * @param {number} params.rowNumber - 文件对应的行号
   * @param {string} params.batchId - 批次ID
   * @returns {Promise<Object>}
   */
  async deleteReviewFile(params = {}) {
    const { fileId, rowNumber, batchId } = params;

    if (!fileId || !rowNumber) {
      return { success: false, message: '参数不完整' };
    }

    await this.ensureApis();

    // 1. 获取文件的父目录，创建「已删除」文件夹
    let deletedFolder;
    try {
      const fileInfo = await this.drive.files.get({
        fileId,
        fields: 'id, name, parents',
        supportsAllDrives: true
      });

      const currentParents = fileInfo.data.parents || [];
      const parentFolderId = currentParents[0] || this.config.driveFolderId;

      // 确保「已删除」文件夹存在
      deletedFolder = await this.ensureNamedChildFolder(parentFolderId, DELETED_FOLDER_NAME);

      // 2. 将文件移到「已删除」文件夹
      await this.drive.files.update({
        fileId,
        addParents: deletedFolder.id,
        removeParents: currentParents.join(','),
        fields: 'id',
        supportsAllDrives: true
      });
      console.log(`[GoogleService] 文件 ${fileId} 已移动到已删除文件夹`);
    } catch (error) {
      // 如果文件不存在或已被删除，继续处理表格记录
      console.warn(`移动文件到已删除文件夹失败（文件可能已不存在）：${error.message}`);
    }

    // 3. 从表格中删除该行记录
    const sheetName = this.getFileReviewSheetName();

    try {
      // 获取 spreadsheet 信息以确定 sheetId
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.config.sheetId,
        ranges: [],
        includeGridData: false
      });

      const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
      if (!sheet) {
        return { success: false, message: `未找到工作表: ${sheetName}` };
      }

      const sheetId = sheet.properties.sheetId;

      // 使用 batchUpdate 删除行
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.config.sheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1, // API 使用 0-indexed
                endIndex: rowNumber
              }
            }
          }]
        }
      });

      console.log(`[GoogleService] 已从表格删除行 ${rowNumber}`);
    } catch (error) {
      console.error('从表格删除记录失败:', error.message);
      return { success: false, message: `删除表格记录失败：${error.message}` };
    }

    // 4. 如果 Firebase 可用，也删除 Firebase 中的记录
    if (this.firebaseService?.isReady?.()) {
      try {
        await this.firebaseService.deleteFileStatus(this.config.sheetId, rowNumber);
      } catch (error) {
        console.warn('[deleteReviewFile] Firebase 删除失败:', error.message);
      }
    }

    return {
      success: true,
      fileId,
      rowNumber,
      batchId
    };
  }

  /**
   * 向已提交的批次添加新文件或参考文件
   * @param {Object} params - 参数
   * @param {string} params.tempFolderId - 临时目录ID
   * @param {string} params.tempFolderLink - 临时目录链接
   * @param {string} params.batchId - 批次ID
   * @param {string} params.submitter - 提交人
   * @param {string} params.mainCategory - 主类别
   * @param {string} params.subCategory - 子类别
   * @param {boolean} params.isReference - 是否为参考文件
   * @param {number} params.renameCounter - 命名计数（可选）
   * @param {Object} params.newFile - 新文件信息 { path, name }
   * @returns {Promise<Object>}
   */
  async addFileToBatch(params = {}) {
    const {
      tempFolderId,
      tempFolderLink,
      batchId,
      submitter,
      mainCategory,
      subCategory,
      referenceFolderId,
      isReference = false,
      newFile
    } = params;

    if (!newFile || !tempFolderId) {
      return { success: false, message: '参数不完整' };
    }

    await this.ensureApis();

    // 确定上传目标文件夹
    let targetFolderId = tempFolderId;

    // 如果是参考文件，创建或获取"参考"子文件夹
    if (isReference) {
      try {
        const referenceFolder = await this.ensureNamedChildFolder(tempFolderId, '参考');
        targetFolderId = referenceFolder.id;
      } catch (error) {
        console.warn('Failed to create reference folder:', error.message);
        // 如果创建失败，仍然上传到临时目录
      }
    }

    // 1. 上传新文件到目标目录
    let uploadResult;
    try {
      uploadResult = await this.uploadSingleFile(
        newFile,
        newFile.name,
        { subFolderId: targetFolderId }
      );
    } catch (error) {
      return { success: false, message: `上传文件失败：${error.message}` };
    }

    // 2. 非参考文件才写入表格
    if (!isReference) {
      try {
        let namingCounter = Number(params.renameCounter) || 0;
        if (!namingCounter && batchId) {
          const reviewResult = await this.fetchFileReviewEntries({ groupByBatch: false });
          const allFiles = reviewResult.files || reviewResult || [];
          const existingCount = allFiles.filter(f => f.batchId === batchId).length;
          namingCounter = existingCount + 1;
        }

        const renamePattern = params.renamePattern || this.config.renamePattern || '{{originalName}}{{ext}}';
        const namingMetadata = this.parseNamingMetadata(params.namingMetadata || '');
        // 确保 submitter 和 admin 在 namingMetadata 中，用于正确替换命名 token
        if (!namingMetadata.submitter && submitter) {
          namingMetadata.submitter = submitter;
        }
        if (!namingMetadata.admin && params.admin) {
          namingMetadata.admin = params.admin;
        }
        const namingNamer = new FileNamer({
          pattern: renamePattern,
          dateFormat: this.config.dateFormat,
          counterPadding: this.config.counterPadding,
          timezone: this.config.timezone
        });
        const namingResult = namingNamer.buildName(newFile, namingMetadata, namingCounter || 1);

        await this.appendFileReviewRow({
          fileName: newFile.name,
          fileId: uploadResult.id,
          fileLink: uploadResult.link,
          batchId,
          submitter,
          taskType: params.taskType || '',
          admin: params.admin || '',
          mainCategory,
          subCategory,
          tempFolderLink,
          referenceFolderId: referenceFolderId || '',
          referenceFolderLink: params.referenceFolderLink || '',
          renamePattern: params.renamePattern || '',
          folderPattern: params.folderPattern || '',
          namingMetadata: params.namingMetadata || '',
          targetFolderId: params.targetFolderId || '',
          namingResult,
          reviewSlotName: params.reviewSlotName || '',
          reviewDescription: params.reviewDescription || '',
          reviewNote: params.reviewNote || '',
          isReference: false
        });
      } catch (error) {
        console.warn('Failed to append file record:', error.message);
        return { success: false, message: `写入表格失败：${error.message}` };
      }
    }

    return {
      success: true,
      fileId: uploadResult.id,
      fileLink: uploadResult.link,
      fileName: newFile.name,
      isReference
    };
  }

  /**
   * 同步检测批次的文件 - 检测临时目录中未记录的新文件
   * @param {Object} params - 参数
   * @param {string} params.batchId - 批次ID
   * @param {string} params.tempFolderLink - 临时目录链接
   * @param {string} params.submitter - 提交人
   * @param {string} params.mainCategory - 主类别
   * @param {string} params.subCategory - 子类别
   * @returns {Promise<Object>} - 返回同步结果
   */
  async syncBatchFiles(params = {}) {
    const {
      batchId,
      tempFolderLink,
      submitter,
      mainCategory,
      subCategory,
      admin,
      taskType,
      referenceFolderId,
      referenceFolderLink,
      reviewSlotName,
      reviewDescription,
      reviewNote,
      renamePattern,
      folderPattern,
      namingMetadata,
      targetFolderId
    } = params;

    if (!batchId || !tempFolderLink) {
      return { success: false, message: '缺少批次ID或临时目录链接' };
    }

    // 从链接提取文件夹ID
    const match = tempFolderLink.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      return { success: false, message: '无法解析临时目录链接' };
    }
    const tempFolderId = match[1];

    await this.ensureApis();

    try {
      // 1. 获取临时目录中的所有文件（排除"参考"和"已删除"子文件夹）
      const response = await this.drive.files.list({
        q: `'${tempFolderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, webViewLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      const driveFiles = response.data.files || [];

      if (driveFiles.length === 0) {
        return { success: true, added: 0, message: '临时目录中没有文件' };
      }

      // 2. 获取表格中已记录的该批次文件
      const reviewResult = await this.fetchFileReviewEntries({ groupByBatch: false });
      const allFiles = reviewResult.files || reviewResult || [];
      const batchFiles = allFiles.filter(f => f.batchId === batchId);
      // 收集所有已记录的文件ID和标注文件ID，防止标注图被误识为新文件
      const recordedFileIds = new Set();
      batchFiles.forEach(f => {
        if (f.fileId) recordedFileIds.add(f.fileId);
        if (f.annotatedFileId) recordedFileIds.add(f.annotatedFileId);
      });
      const baseCounter = batchFiles.length;

      // 3. 找出未记录的新文件（排除已记录的 fileId 和 annotatedFileId）
      const newFiles = driveFiles.filter(f => !recordedFileIds.has(f.id));

      if (newFiles.length === 0) {
        return { success: true, added: 0, message: '没有发现新文件' };
      }

      // 4. 将新文件添加到表格
      const namingPayload = this.parseNamingMetadata(namingMetadata || '');
      // 确保 submitter 和 admin 在 namingPayload 中，用于正确替换命名 token
      if (!namingPayload.submitter && submitter) {
        namingPayload.submitter = submitter;
      }
      if (!namingPayload.admin && admin) {
        namingPayload.admin = admin;
      }
      const namingNamer = new FileNamer({
        pattern: renamePattern || this.config.renamePattern || '{{originalName}}{{ext}}',
        dateFormat: this.config.dateFormat,
        counterPadding: this.config.counterPadding,
        timezone: this.config.timezone
      });
      let namingCounter = baseCounter;
      let addedCount = 0;
      for (const file of newFiles) {
        try {
          namingCounter += 1;
          const namingResult = namingNamer.buildName({ name: file.name }, namingPayload, namingCounter);
          await this.appendFileReviewRow({
            fileName: file.name,
            fileId: file.id,
            fileLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
            batchId,
            submitter,
            taskType: taskType || '',
            admin: admin || '',
            mainCategory,
            subCategory,
            tempFolderLink,
            referenceFolderId: referenceFolderId || '',
            referenceFolderLink: referenceFolderLink || '',
            renamePattern: renamePattern || '',
            folderPattern: folderPattern || '',
            namingMetadata: namingMetadata || '',
            targetFolderId: targetFolderId || '',
            namingResult,
            reviewSlotName: reviewSlotName || '',
            reviewDescription: reviewDescription || '',
            reviewNote: reviewNote || '',
            isReference: false
          });
          addedCount++;
        } catch (err) {
          console.warn(`同步文件 ${file.name} 失败:`, err.message);
        }
      }

      return {
        success: true,
        added: addedCount,
        total: driveFiles.length,
        message: `同步完成：发现 ${newFiles.length} 个新文件，成功添加 ${addedCount} 个`
      };

    } catch (error) {
      console.error('[GoogleService] 同步批次文件失败:', error);
      return { success: false, message: `同步失败：${error.message}` };
    }
  }

  /**
   * 检测批次的新文件（只检测不添加）
   * @param {Object} params - 参数
   * @param {string} params.batchId - 批次ID
   * @param {string} params.tempFolderLink - 临时目录链接
   * @returns {Promise<Object>} - 返回检测结果
   */
  async checkBatchNewFiles(params = {}) {
    const { batchId, tempFolderLink } = params;

    if (!batchId || !tempFolderLink) {
      return { success: false, count: 0 };
    }

    // 从链接提取文件夹ID
    const match = tempFolderLink.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      return { success: false, count: 0 };
    }
    const tempFolderId = match[1];

    await this.ensureApis();

    try {
      // 1. 获取临时目录中的所有文件
      const response = await this.drive.files.list({
        q: `'${tempFolderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      const driveFiles = response.data.files || [];

      if (driveFiles.length === 0) {
        return { success: true, count: 0 };
      }

      // 2. 获取表格中已记录的该批次文件
      const reviewResult = await this.fetchFileReviewEntries({ groupByBatch: false });
      const allFiles = reviewResult.files || reviewResult || [];
      const batchFiles = allFiles.filter(f => f.batchId === batchId);
      // 收集所有已记录的文件ID和标注文件ID，防止标注图被误计为新文件
      const recordedFileIds = new Set();
      batchFiles.forEach(f => {
        if (f.fileId) recordedFileIds.add(f.fileId);
        if (f.annotatedFileId) recordedFileIds.add(f.annotatedFileId);
      });

      // 3. 计算未记录的新文件数量（排除已记录的 fileId 和 annotatedFileId）
      const newFilesCount = driveFiles.filter(f => !recordedFileIds.has(f.id)).length;

      return {
        success: true,
        count: newFilesCount
      };

    } catch (error) {
      console.error('[GoogleService] 检测批次新文件失败:', error);
      return { success: false, count: 0 };
    }
  }

  /**
   * 更新批次的手动状态
   * @param {Object} params - 参数
   * @param {string} params.batchId - 批次ID
   * @param {string} params.batchStatus - 批次状态（手动设置）
   * @returns {Promise<Object>}
   */
  async updateBatchStatus(params = {}) {
    const { batchId, batchStatus } = params;

    if (!batchId) {
      return { success: false, message: '批次ID不能为空' };
    }

    await this.ensureApis();

    const sheetName = this.getFileReviewSheetName();

    // 1. 获取所有数据找到该批次的所有行
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.sheetId,
      range: `${sheetName}!A:S`
    });

    const rows = response.data.values || [];
    const batchRows = [];

    // 找到所有属于该批次的行（批次ID在A列，索引0）
    rows.forEach((row, index) => {
      if (index === 0) return; // 跳过表头
      if ((row[0] || '').trim() === batchId.trim()) {
        batchRows.push(index + 1); // 行号从1开始
      }
    });

    if (batchRows.length === 0) {
      return { success: false, message: '未找到该批次的记录' };
    }

    // 2. 批量更新该批次的所有行状态（O列）
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);
    const updateData = batchRows.map((rowNumber) => ({
      range: `${sheetName}!O${rowNumber}`,
      values: [[batchStatus || '']]
    }));

    try {
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateData
        }
      });

      console.log(`[GoogleService] 已更新批次 ${batchId} 的状态为：${batchStatus || '待审核'}`);

      return {
        success: true,
        batchId,
        batchStatus,
        updatedAt: timestamp
      };
    } catch (error) {
      console.error('更新批次状态失败:', error);
      return { success: false, message: error.message || '更新失败' };
    }
  }

  /**
   * 批量更新文件审核批次的设置信息（分类/任务类型/命名规则/命名元数据）
   * @param {Object} params - 参数
   * @param {string} params.batchId - 批次ID
   * @param {string} params.mainCategory - 主类别
   * @param {string} params.subCategory - 子类别
   * @param {string} params.taskType - 任务类型
   * @param {string} params.renamePattern - 文件命名规则
   * @param {string} params.folderPattern - 文件夹命名规则
   * @param {string} params.namingMetadata - 命名元数据（JSON字符串）
   * @param {string} params.admin - 管理员
   * @param {string} params.targetFolderId - 入库目标ID
   * @returns {Promise<Object>} 更新结果
   */
  async updateFileReviewBatchMetadata(params = {}) {
    const {
      batchId,
      mainCategory,
      subCategory,
      taskType,
      renamePattern,
      folderPattern,
      namingMetadata,
      admin,
      targetFolderId
    } = params;

    if (!batchId) {
      return { success: false, message: '缺少批次ID' };
    }

    await this.ensureApis();
    await this.ensureFileReviewHeader();

    try {
      const reviewResult = await this.fetchFileReviewEntries({ groupByBatch: false });
      const allFiles = reviewResult.files || reviewResult || [];
      const batchFiles = allFiles
        .filter(file => file.batchId === batchId)
        .sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0));

      if (!batchFiles.length) {
        return { success: false, message: '未找到批次文件记录' };
      }

      const namingPayload = this.parseNamingMetadata(namingMetadata || '');
      if (admin !== undefined) {
        namingPayload.admin = admin || '';
      }
      // 从批次文件中获取 submitter 并添加到 namingPayload
      const firstFile = batchFiles[0];
      if (!namingPayload.submitter && firstFile?.submitter) {
        namingPayload.submitter = firstFile.submitter;
      }
      const resolvedAdmin = namingPayload.admin || '';

      const renameNamer = new FileNamer({
        pattern: renamePattern || this.config.renamePattern || '{{originalName}}{{ext}}',
        dateFormat: this.config.dateFormat,
        counterPadding: this.config.counterPadding,
        timezone: this.config.timezone
      });

      const updates = [];
      batchFiles.forEach((file, index) => {
        const row = file.rowNumber;
        if (!row) return;
        const namingResult = renameNamer.buildName({ name: file.fileName }, namingPayload, index + 1);

        const valueMap = [
          { col: 'I', value: taskType !== undefined ? taskType : (file.taskType || '') },
          { col: 'J', value: mainCategory !== undefined ? mainCategory : (file.mainCategory || '') },
          { col: 'K', value: subCategory !== undefined ? subCategory : (file.subCategory || '') },
          { col: 'U', value: resolvedAdmin },
          { col: 'V', value: renamePattern !== undefined ? renamePattern : (file.renamePattern || '') },
          { col: 'W', value: folderPattern !== undefined ? folderPattern : (file.folderPattern || '') },
          { col: 'X', value: namingMetadata !== undefined ? namingMetadata : (file.namingMetadata || '') },
          { col: 'Y', value: targetFolderId !== undefined ? targetFolderId : (file.targetFolderId || '') },
          { col: 'Z', value: namingResult }
        ];

        valueMap.forEach(({ col, value }) => {
          updates.push({
            range: `${this.getFileReviewSheetName()}!${col}${row}`,
            values: [[value || '']]
          });
        });
      });

      if (!updates.length) {
        return { success: false, message: '没有可更新的行' };
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });

      return {
        success: true,
        batchId,
        updatedRows: batchFiles.length
      };
    } catch (error) {
      console.error('[GoogleService] 更新批次设置信息失败:', error);
      return { success: false, message: `更新失败：${error.message}` };
    }
  }

  /**
   * 上传标注后的图片（创建新标注文件）
   * @param {Object} params - 参数
   * @param {string} params.fileId - 原文件ID（可选，如果要更新现有文件）
   * @param {string} params.fileName - 文件名
   * @param {Buffer} params.imageBuffer - 图片数据
   * @param {number} params.rowNumber - 行号（可选，用于更新审核备注）
   * @returns {Promise<Object>}
   */
  async uploadAnnotatedImage(params = {}) {
    const { fileId, fileName, imageBuffer, rowNumber } = params;

    if (!imageBuffer) {
      return { success: false, error: '缺少图片数据' };
    }

    await this.ensureApis();

    try {
      let parentIds = [this.config.driveFolderId].filter(Boolean);
      if (fileId) {
        try {
          const meta = await this.drive.files.get({
            fileId,
            fields: 'parents',
            supportsAllDrives: true
          });
          if (Array.isArray(meta.data.parents) && meta.data.parents.length) {
            parentIds = meta.data.parents;
          }
        } catch (err) {
          console.warn('Failed to resolve original file parents:', err.message);
        }
      }

      const response = await this.drive.files.create({
        requestBody: {
          name: fileName || 'annotated_image.png',
          parents: parentIds.length ? parentIds : undefined
        },
        media: {
          mimeType: 'image/png',
          body: require('stream').Readable.from(imageBuffer)
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true
      });

      const resultFileId = response.data.id;
      const resultLink = response.data.webViewLink || `https://drive.google.com/file/d/${resultFileId}/view`;

      // 如果有行号，更新审核备注和审核时间
      let annotatedTime = '';
      if (rowNumber) {
        try {
          const sheetName = this.getFileReviewSheetName();
          const now = new Date();
          const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);
          annotatedTime = timestamp;
          await this.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: this.config.sheetId,
            requestBody: {
              valueInputOption: 'USER_ENTERED',
              data: [
                { range: `${sheetName}!M${rowNumber}`, values: [[timestamp]] },
                { range: `${sheetName}!AA${rowNumber}`, values: [[resultFileId]] },
                { range: `${sheetName}!AB${rowNumber}`, values: [[timestamp]] }
              ]
            }
          });
          console.log(`[GoogleService] 已更新行 ${rowNumber} 的标注信息`);
        } catch (error) {
          console.warn('Failed to update review note:', error.message);
        }
      }

      return {
        success: true,
        fileId: resultFileId,
        link: resultLink,
        annotatedTime
      };
    } catch (error) {
      console.error('Upload annotated image failed:', error);
      return { success: false, error: error.message || '上传失败' };
    }
  }

  parseRangeStartRow(range = '') {
    const match = range.match(/!.*?(\d+)/);
    if (match && match[1]) {
      return Number(match[1]);
    }
    return 1;
  }

  getReviewSheetRange() {
    if (this.config.reviewRange) {
      return this.config.reviewRange;
    }
    return this.getReviewSheetName();
  }

  getReviewRowRange(rowNumber) {
    const sheetName = this.getReviewSheetName();
    const lastColumn = this.getReviewLastColumnLetter();
    return `${sheetName}!A${rowNumber}:${lastColumn}${rowNumber}`;
  }

  getReviewSheetName() {
    if (this.config.reviewRange && this.config.reviewRange.includes('!')) {
      return this.config.reviewRange.split('!')[0];
    }
    return this.config.reviewSheetName || '审核记录';
  }

  getReviewLastColumnLetter() {
    if (this.config.reviewRange) {
      const match = this.config.reviewRange.match(/:([A-Z]+)/i);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
    }
    return GoogleService.columnIndexToLetter(REVIEW_HEADERS.length);
  }

  static columnIndexToLetter(index) {
    let result = '';
    let current = index;
    while (current > 0) {
      const remainder = (current - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      current = Math.floor((current - 1) / 26);
    }
    return result || 'A';
  }

  async ensureReviewHeader() {
    if (this.reviewHeaderEnsured) {
      return;
    }
    if (!this.config.sheetId) {
      return;
    }
    if (!this.sheets) {
      await this.ensureApis();
    }
    const sheetName = this.getReviewSheetName();
    const lastColumn = this.getReviewLastColumnLetter();
    const headerRange = `${sheetName}!A1:${lastColumn}1`;
    try {
      const existing = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.sheetId,
        range: headerRange
      });
      const headerRow = existing.data.values?.[0] || [];
      const needsUpdate = REVIEW_HEADERS.some((title, index) => headerRow[index] !== title);
      if (needsUpdate) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.sheetId,
          range: headerRange,
          valueInputOption: 'RAW',
          requestBody: { values: [REVIEW_HEADERS] }
        });
      }
      this.reviewHeaderEnsured = true;
    } catch (error) {
      console.error('Failed to ensure review header', error);
      this.reviewHeaderEnsured = false;
    }
  }

  async fetchReviewEntries(options = {}) {
    const preferDerived = Boolean(options?.preferDerived);
    if (!this.config.sheetId) {
      return [];
    }
    const range = this.getReviewSheetRange();
    await this.ensureApis();
    await this.ensureReviewHeader();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.sheetId,
      range
    });
    const rows = response.data.values || [];
    const startRow = this.parseRangeStartRow(range);
    const entries = [];
    rows.forEach((row, index) => {
      const rowNumber = startRow + index;
      if (!row || !row.length) {
        return;
      }
      if (rowNumber === startRow && row[0] && row[0].includes('图片')) {
        return;
      }
      const description = row[0] || '';
      const submitter = row[1] || '';
      const admin = row[2] || '';
      const completedAt = row[3] || '';
      const tempLink = row[4] || '';
      const folderLink = row[10] || '';
      const rawFolderId = row[12] || '';
      const targetFolderId = row[13] || '';
      const reviewFolderId = this.extractDriveFileId(tempLink) || this.extractDriveFileId(rawFolderId);
      const isApprovedRow = /通过|审核通过|已入库|approved/i.test((row[8] || '').trim());
      // 待审核/未通过：优先使用当前审核链接；已通过：优先最终目录
      const folderId = isApprovedRow
        ? (this.extractDriveFileId(folderLink) ||
          this.extractDriveFileId(targetFolderId) ||
          this.extractDriveFileId(rawFolderId) ||
          this.extractDriveFileId(tempLink))
        : (this.extractDriveFileId(tempLink) ||
          this.extractDriveFileId(rawFolderId) ||
          this.extractDriveFileId(folderLink) ||
          this.extractDriveFileId(targetFolderId));
      if (!folderId) {
        return;
      }
      const mainCategory = row[5] || '';
      const subCategory = row[6] || '';
      const reviewer = row[7] || '';
      const status = row[8] || '';
      const note = row[9] || '';
      const customDate = row[11] || '';
      const tempParentId = row[14] || '';
      const acceptedText = row[15] || '';
      const rejectedText = row[16] || '';
      const renamePattern = row[17] || '';
      const folderPattern = row[18] || '';
      const namingMetadataRaw = row[19] || '';
      const acceptedDetailsJson = row[20] || '';  // 新增：合格文件详情 JSON
      const rejectedDetailsJson = row[21] || '';  // 新增：不合格文件详情 JSON

      // 解析 JSON 列
      let acceptedDetailsFromSheet = [];
      let rejectedDetailsFromSheet = [];
      try {
        if (acceptedDetailsJson) {
          acceptedDetailsFromSheet = JSON.parse(acceptedDetailsJson);
        }
      } catch (error) {
        console.warn('Failed to parse acceptedDetails JSON:', error.message);
      }
      try {
        if (rejectedDetailsJson) {
          rejectedDetailsFromSheet = JSON.parse(rejectedDetailsJson);
        }
      } catch (error) {
        console.warn('Failed to parse rejectedDetails JSON:', error.message);
      }

      entries.push({
        rowNumber,
        description,
        reviewSlotName: description,
        submitter,
        completedAt,
        tempLink,
        mainCategory,
        subCategory,
        status,
        admin,
        reviewer,
        folderId: folderId,
        reviewFolderId,
        rawFolderId,
        targetFolderId,
        tempParentId,
        folderLink,
        customDate,
        acceptedFiles: this.parseFileListCell(acceptedText),
        rejectedFiles: this.parseFileListCell(rejectedText),
        acceptedText,
        rejectedText,
        note,
        description,
        finishedFolderId: '',
        acceptedDetails: acceptedDetailsFromSheet,  // 使用从表格读取的详情
        rejectedDetails: rejectedDetailsFromSheet,  // 使用从表格读取的详情
        autoList: false,
        renamePattern,
        folderPattern,
        namingMetadata: this.parseNamingMetadata(namingMetadataRaw)
      });
    });
    const isApprovedStatus = (value) => /通过|审核通过|已入库|approved/i.test((value || '').trim());
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        const approved = isApprovedStatus(entry.status);
        const primaryResolved = await this.resolveReviewFileLists(entry, {
          preferDerived,
          treatRootAsFinished: approved
        });
        const finalFolderId = entry.folderId || '';

        // 对已通过的记录，单独用审核目录获取不合格文件，防止被“成品”归类吞掉
        let rejectedFromReview = { rejectedFiles: [], rejectedDetails: [], rejectedFromSheet: false };
        const reviewFolderId = entry.reviewFolderId || entry.rawFolderId || this.extractDriveFileId(entry.tempLink || '');
        if (approved && reviewFolderId && reviewFolderId !== finalFolderId) {
          try {
            const reviewResolved = await this.deriveReviewFileLists(reviewFolderId, {
              finishedFolderId: entry.finishedFolderId || '',
              treatRootAsFinished: false
            });
            rejectedFromReview = {
              rejectedFiles: reviewResolved.rejectedFiles || [],
              rejectedDetails: reviewResolved.rejectedDetails || [],
              rejectedFromSheet: Boolean(reviewResolved.rejectedFromSheet)
            };
          } catch (error) {
            console.warn('deriveReviewFileLists for review folder failed', error);
          }
        }

        const acceptedFiles = primaryResolved.acceptedFiles || [];
        const rejectedFilesDerived =
          approved && rejectedFromReview.rejectedFiles.length
            ? rejectedFromReview.rejectedFiles
            : primaryResolved.rejectedFiles || [];
        const rejectedFilesSheet = Array.isArray(entry.rejectedFiles) ? entry.rejectedFiles : [];
        const rejectedFiles = rejectedFilesDerived.length ? rejectedFilesDerived : rejectedFilesSheet;

        const finishedFolderId = primaryResolved.finishedFolderId || entry.finishedFolderId || '';
        const acceptedDetails = Array.isArray(primaryResolved.acceptedDetails)
          ? primaryResolved.acceptedDetails
          : acceptedFiles.map((name) => ({ name, link: '' }));

        const rejectedDetailsDerived =
          approved && rejectedFromReview.rejectedDetails.length
            ? rejectedFromReview.rejectedDetails
            : Array.isArray(primaryResolved.rejectedDetails)
              ? primaryResolved.rejectedDetails
              : [];
        const rejectedDetailsSheet = Array.isArray(entry.rejectedDetails) ? entry.rejectedDetails : [];
        const rejectedDetailsSource = rejectedDetailsDerived.length ? rejectedDetailsDerived : rejectedDetailsSheet;
        const rejectedDetails = rejectedDetailsSource.length
          ? rejectedDetailsSource
          : rejectedFiles.map((name) => ({ name, link: '' }));

        return {
          ...entry,
          acceptedFiles,
          rejectedFiles,
          acceptedText: acceptedFiles.join('\n'),
          rejectedText: rejectedFiles.join('\n'),
          finishedFolderId,
          acceptedDetails,
          rejectedDetails,
          autoList: preferDerived || Boolean(primaryResolved.acceptedFiles?.length || primaryResolved.rejectedFiles?.length),
          description: entry.description || entry.reviewDescription || '',
          acceptedFromSheet: Boolean(primaryResolved.acceptedFromSheet),
          rejectedFromSheet: Boolean(primaryResolved.rejectedFromSheet || rejectedFromReview.rejectedFromSheet)
        };
      })
    );
    return enrichedEntries;
  }

  ensureDriveFolderLink(value) {
    if (!value) {
      return '';
    }
    const trimmed = String(value).trim();
    if (!trimmed) {
      return '';
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://drive.google.com/drive/folders/${trimmed}`;
  }

  extractDriveFileId(value = '') {
    if (!value) {
      return '';
    }
    const normalized = String(value).trim();
    if (!normalized) {
      return '';
    }
    const directMatch = normalized.match(/[-\w]{25,}/);
    if (directMatch) {
      return directMatch[0];
    }
    return '';
  }

  buildApprovedFolderName(metadata = {}, pattern = '') {
    return this.buildFolderName(
      {
        ...metadata,
        customDate: metadata.customDate || this.formatDateToken(new Date(), this.config.dateFormat || 'YYYYMMDD'),
        subject: metadata.reviewDescription || metadata.description || metadata.subject || metadata.reviewSlotName || ''
      },
      { folderPattern: pattern || this.config.folderPattern, dateFormat: this.config.dateFormat }
    );
  }

  async createChildFolder(parentId, name) {
    if (!parentId) {
      throw new Error('缺少目标目录 ID');
    }
    const folderName = name?.trim() || `审核通过-${Date.now()}`;
    const created = await this.drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: DRIVE_FOLDER_MIME,
        parents: [parentId]
      },
      fields: 'id, webViewLink'
    });
    return {
      id: created.data.id,
      link: created.data.webViewLink || `https://drive.google.com/drive/folders/${created.data.id}`,
      name: folderName
    };
  }

  /**
   * 将指定文件移动到「成品」文件夹（标记为合格）
   * @param {Object} payload - { reviewFolderId, fileIds: string[], finishedFolderId? }
   * @returns {Promise<Object>} - { success, movedFiles, finishedFolderId }
   */
  async moveFilesToFinished(payload = {}) {
    const { reviewFolderId, fileIds = [], finishedFolderId: existingFinishedId } = payload;

    if (!reviewFolderId) {
      throw new Error('缺少审核目录 ID');
    }
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new Error('未选择任何文件');
    }

    await this.ensureApis();

    // 确保成品文件夹存在，且确实位于审核目录下
    let finishedFolderId = existingFinishedId;
    if (finishedFolderId && finishedFolderId !== reviewFolderId) {
      try {
        const finishedInfo = await this.drive.files.get({
          fileId: finishedFolderId,
          fields: 'id, parents',
          supportsAllDrives: true
        });
        const parents = Array.isArray(finishedInfo.data.parents) ? finishedInfo.data.parents : [];
        if (!parents.includes(reviewFolderId)) {
          finishedFolderId = '';
        }
      } catch (error) {
        console.warn('检查成品目录父级失败，将重新创建:', error.message);
        finishedFolderId = '';
      }
    }

    if (!finishedFolderId) {
      const children = await this.listDriveChildren(reviewFolderId);
      const finishedFolder = children.find(
        (item) => item.mimeType === DRIVE_FOLDER_MIME && item.name?.trim() === FINISHED_FOLDER_NAME
      );
      if (finishedFolder) {
        finishedFolderId = finishedFolder.id;
      } else {
        // 创建成品文件夹
        const created = await this.drive.files.create({
          requestBody: {
            name: FINISHED_FOLDER_NAME,
            mimeType: DRIVE_FOLDER_MIME,
            parents: [reviewFolderId]
          },
          fields: 'id, webViewLink'
        });
        finishedFolderId = created.data.id;
      }
    }

    const movedFiles = [];
    const errors = [];

    for (const fileId of fileIds) {
      if (!fileId) continue;
      try {
        // 获取文件当前父目录
        const fileInfo = await this.drive.files.get({
          fileId,
          fields: 'id, name, parents, webViewLink',
          supportsAllDrives: true
        });

        const currentParents = Array.isArray(fileInfo.data.parents) ? fileInfo.data.parents : [];

        // 如果已经在成品文件夹中，跳过
        if (currentParents.includes(finishedFolderId)) {
          movedFiles.push({
            id: fileId,
            name: fileInfo.data.name,
            link: fileInfo.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
            alreadyInFinished: true
          });
          continue;
        }

        let parentsForMove = [...currentParents];

        // 先将父级数量收敛到 1 个，避免 “Increasing the number of parents is not allowed”
        if (parentsForMove.length > 1) {
          const [keptParent, ...extraParents] = parentsForMove;
          if (extraParents.length) {
            await this.drive.files.update({
              fileId,
              removeParents: extraParents.join(','),
              supportsAllDrives: true
            });
            parentsForMove = [keptParent];
          }
        }

        // 移动文件到成品文件夹（移除现有父级，添加成品父级）
        const removeParents = parentsForMove.join(',');
        const updatePayload = {
          fileId,
          addParents: finishedFolderId,
          fields: 'id, name, webViewLink',
          supportsAllDrives: true
        };

        if (removeParents) {
          updatePayload.removeParents = removeParents;
        }

        await this.drive.files.update(updatePayload);

        movedFiles.push({
          id: fileId,
          name: fileInfo.data.name,
          link: fileInfo.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`
        });
      } catch (error) {
        console.warn('移动文件到成品失败:', fileId, error.message);
        errors.push({ fileId, message: error.message });
      }
    }

    return {
      success: errors.length === 0,
      movedFiles,
      errors,
      finishedFolderId
    };
  }

  /**
   * 将文件从「成品」文件夹移回根目录（取消标记合格）
   * @param {Object} payload - { reviewFolderId, fileIds: string[], finishedFolderId? }
   * @returns {Promise<Object>} - { success, movedFiles }
   */
  async moveFilesFromFinished(payload = {}) {
    const { reviewFolderId, fileIds = [], finishedFolderId: existingFinishedId } = payload;

    if (!reviewFolderId) {
      throw new Error('缺少审核目录 ID');
    }
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new Error('未选择任何文件');
    }

    await this.ensureApis();

    // 查找成品文件夹
    let finishedFolderId = existingFinishedId;
    // 如果传入的 finishedFolderId 不是审核目录下的子目录，忽略并重新查找
    if (finishedFolderId && finishedFolderId !== reviewFolderId) {
      try {
        const finishedInfo = await this.drive.files.get({
          fileId: finishedFolderId,
          fields: 'id, parents',
          supportsAllDrives: true
        });
        const parents = Array.isArray(finishedInfo.data.parents) ? finishedInfo.data.parents : [];
        if (!parents.includes(reviewFolderId)) {
          finishedFolderId = '';
        }
      } catch (error) {
        console.warn('检查成品目录父级失败，将重新查找:', error.message);
        finishedFolderId = '';
      }
    }

    if (!finishedFolderId) {
      const children = await this.listDriveChildren(reviewFolderId);
      const finishedFolder = children.find(
        (item) => item.mimeType === DRIVE_FOLDER_MIME && item.name?.trim() === FINISHED_FOLDER_NAME
      );
      if (finishedFolder) {
        finishedFolderId = finishedFolder.id;
      } else {
        throw new Error('成品文件夹不存在');
      }
    }

    const movedFiles = [];
    const errors = [];

    // 缓存父级是否位于成品目录下，避免重复递归查询
    const parentInFinishedCache = new Map();
    const isParentUnderFinished = async (folderId, visited = new Set()) => {
      if (!folderId) {
        return false;
      }
      if (folderId === finishedFolderId) {
        parentInFinishedCache.set(folderId, true);
        return true;
      }
      if (parentInFinishedCache.has(folderId)) {
        return parentInFinishedCache.get(folderId);
      }
      if (visited.has(folderId)) {
        return false;
      }
      visited.add(folderId);

      try {
        const parentInfo = await this.drive.files.get({
          fileId: folderId,
          fields: 'id, parents',
          supportsAllDrives: true
        });
        const parentParents = Array.isArray(parentInfo.data.parents) ? parentInfo.data.parents : [];

        if (parentParents.includes(finishedFolderId)) {
          parentInFinishedCache.set(folderId, true);
          return true;
        }

        for (const ancestorId of parentParents) {
          if (await isParentUnderFinished(ancestorId, visited)) {
            parentInFinishedCache.set(folderId, true);
            return true;
          }
        }
      } catch (error) {
        console.warn('检查父级目录失败:', folderId, error.message);
      }

      parentInFinishedCache.set(folderId, false);
      return false;
    };

    for (const fileId of fileIds) {
      if (!fileId) continue;
      try {
        // 获取文件当前父目录
        const fileInfo = await this.drive.files.get({
          fileId,
          fields: 'id, name, parents, webViewLink',
          supportsAllDrives: true
        });

        const currentParents = Array.isArray(fileInfo.data.parents) ? fileInfo.data.parents : [];

        // 找出当前父级中属于成品目录（或其子目录）的节点
        const parentsUnderFinished = [];
        for (const parentId of currentParents) {
          if (parentId === finishedFolderId) {
            parentsUnderFinished.push(parentId);
            continue;
          }
          if (await isParentUnderFinished(parentId)) {
            parentsUnderFinished.push(parentId);
          }
        }

        // 如果不在成品文件夹中，跳过
        if (!parentsUnderFinished.length) {
          movedFiles.push({
            id: fileId,
            name: fileInfo.data.name,
            link: fileInfo.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
            alreadyOutOfFinished: true
          });
          continue;
        }

        // 移动文件回审核根目录
        await this.drive.files.update({
          fileId,
          addParents: reviewFolderId,
          removeParents: parentsUnderFinished.join(','),
          fields: 'id, name, webViewLink',
          supportsAllDrives: true
        });

        movedFiles.push({
          id: fileId,
          name: fileInfo.data.name,
          link: fileInfo.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`
        });
      } catch (error) {
        console.warn('移动文件出成品失败:', fileId, error.message);
        errors.push({ fileId, message: error.message });
      }
    }

    return {
      success: errors.length === 0,
      movedFiles,
      errors,
      finishedFolderId
    };
  }

  async approveReviewEntry(payload = {}) {
    if (!payload.rowNumber || !payload.folderId || !payload.targetFolderId) {
      throw new Error('审核数据不完整，无法通过');
    }
    await this.ensureApis();

    console.log('\n====== 审核通过调试信息 ======');
    console.log('payload.rowNumber:', payload.rowNumber);
    console.log('payload.folderId:', payload.folderId);
    console.log('payload.targetFolderId:', payload.targetFolderId);
    console.log('payload.acceptedFiles:', payload.acceptedFiles);
    console.log('payload.acceptedDetails:', payload.acceptedDetails);
    console.log('payload.finishedFolderId:', payload.finishedFolderId);

    let lists = await this.resolveReviewFileLists(payload);
    console.log('\n--- resolveReviewFileLists 结果 ---');
    console.log('lists.acceptedDetails:', lists.acceptedDetails);
    console.log('lists.acceptedFiles:', lists.acceptedFiles);
    console.log('lists.finishedFolderId:', lists.finishedFolderId);

    try {
      const latest = await this.deriveReviewFileLists(payload.folderId);
      console.log('\n--- deriveReviewFileLists 结果 ---');
      console.log('latest.acceptedDetails:', latest.acceptedDetails);
      console.log('latest.acceptedFiles:', latest.acceptedFiles);
      console.log('latest.finishedFolderId:', latest.finishedFolderId);

      if (latest.acceptedDetails.length) {
        lists = {
          ...lists,
          acceptedDetails: latest.acceptedDetails,
          acceptedFiles: latest.acceptedFiles,
          finishedFolderId: latest.finishedFolderId || lists.finishedFolderId || ''
        };
        console.log('使用最新的云端文件列表');
      } else {
        console.log('云端文件列表为空，使用缓存数据');
      }
    } catch (error) {
      console.warn('Failed to refresh accepted file list, fallback to cached data', error.message);
    }

    const folderPattern = payload.folderPattern || '';

    // 解析 namingMetadata 并merge到 payload 中，这样 token 才能被正确替换
    let namingData = {};
    if (payload.namingMetadata) {
      try {
        namingData = typeof payload.namingMetadata === 'string'
          ? JSON.parse(payload.namingMetadata)
          : payload.namingMetadata;
        console.log('解析得到的 namingMetadata:', namingData);
      } catch (error) {
        console.warn('Failed to parse namingMetadata:', error.message);
      }
    }

    const folderName = this.buildApprovedFolderName(
      {
        ...payload,
        ...namingData,  // merge namingMetadata 中的所有字段（包括 eventName 等自定义 token）
        customDate: payload.customDate
      },
      folderPattern
    );
    const finalFolderInfo = await this.createChildFolder(payload.targetFolderId, folderName);
    const targetFolderLink = finalFolderInfo.link;

    let acceptedInfos = Array.isArray(lists.acceptedDetails)
      ? lists.acceptedDetails.filter((item) => item && (item.name || item.link))
      : [];

    console.log('\n--- 合格文件检查 ---');
    console.log('从 acceptedDetails 获取的文件数:', acceptedInfos.length);

    if (!acceptedInfos.length && lists.finishedFolderId) {
      console.log('尝试从 finishedFolderId 读取文件:', lists.finishedFolderId);
      acceptedInfos = await this.collectFileInfos(lists.finishedFolderId);
      console.log('从 finishedFolderId 读取到文件数:', acceptedInfos.length);
    }

    console.log('最终 acceptedInfos:', acceptedInfos);
    console.log('============================\n');

    if (!acceptedInfos.length) {
      throw new Error('未检测到合格文件，无法入库');
    }
    const movedEntries = [];
    const forbiddenIds = new Set(
      [payload.folderId, payload.targetFolderId, payload.reviewTargetFolderId, payload.reviewTempFolderId]
        .filter(Boolean)
        .map((id) => id.trim())
    );
    const renamePattern = payload.renamePattern || '';
    const renameOptionsFinal = {
      pattern: renamePattern || this.config.renamePattern,
      dateFormat: this.config.dateFormat,
      counterPadding: this.config.counterPadding,
      timezone: this.config.timezone
    };
    const renameNamer = renamePattern ? new FileNamer(renameOptionsFinal) : new FileNamer(renameOptionsFinal);
    let approvalCounter = this.config.counterStart || 1;
    const storedNamingMetadata = this.parseNamingMetadata(payload.namingMetadata);
    const renameMetadata = {
      submitter: payload.submitter || '',
      admin: payload.admin || '',
      subject: payload.reviewDescription || payload.description || storedNamingMetadata.subject || '',
      reviewDescription: payload.reviewDescription || payload.description || '',
      reviewSlotName: payload.reviewSlotName || '',
      mainCategory: payload.mainCategory || '',
      subCategory: payload.subCategory || '',
      customDate:
        payload.customDate ||
        storedNamingMetadata.customDate ||
        this.formatDateToken(new Date(), this.config.dateFormat || 'YYYYMMDD'),
      eventName: storedNamingMetadata.eventName || payload.eventName || '',
      country: storedNamingMetadata.country || payload.country || '',
      software: storedNamingMetadata.software || ''
    };
    if (storedNamingMetadata.customTexts) {
      Object.entries(storedNamingMetadata.customTexts).forEach(([key, value]) => {
        renameMetadata[key] = value;
      });
    }
    for (const file of acceptedInfos) {
      const fileId = file.id || this.extractDriveFileId(file.link);
      if (!fileId) {
        console.warn('缺少文件 ID，跳过入库：', file);
        continue;
      }
      if (forbiddenIds.has(fileId)) {
        console.warn('检测到目录 ID（而非文件 ID），已跳过：', fileId);
        continue;
      }
      try {
        const fileInfo = await this.drive.files.get({
          fileId,
          fields: 'id, parents, name, webViewLink',
          supportsAllDrives: true
        });
        const removeParents = Array.isArray(fileInfo.data.parents)
          ? fileInfo.data.parents.join(',')
          : undefined;
        const renameFilePayload = {
          name: fileInfo.data.name || file.name || ''
        };
        let desiredName = renameFilePayload.name;
        if (renameNamer) {
          desiredName = renameNamer.buildName(renameFilePayload, renameMetadata, approvalCounter);
          approvalCounter += 1;
        }
        const updated = await this.drive.files.update({
          fileId,
          addParents: finalFolderInfo.id,
          removeParents,
          requestBody: { name: desiredName },
          fields: 'id, webViewLink, name'
        });
        movedEntries.push({
          id: fileId,
          name: desiredName,
          link: updated.data.webViewLink || fileInfo.data.webViewLink || file.link || ''
        });
      } catch (error) {
        console.warn('移动文件失败，将跳过该文件:', fileId, error.message);
      }
    }
    if (!movedEntries.length) {
      throw new Error(
        '未能移动任何合格文件到目标目录，请确认“合格文件”列中填写的是具体文件链接而非目录 ID，或确保成品文件夹内存在文件'
      );
    }
    for (const file of movedEntries) {
      await this.appendSheetRow({
        file: {},
        metadata: {
          submitter: payload.submitter || '',
          completedAt: payload.completedAt || '',
          subFolderLink: targetFolderLink,
          mainCategory: payload.mainCategory || '',
          subCategory: payload.subCategory || '',
          readyFlag: '是',
          admin: payload.admin || '',
          reviewEnabled: false
        },
        link: file.link || '',
        renamed: file.name || '',
        driveId: file.id || ''
      });
    }
    const acceptedNamesForSheet = lists.acceptedFiles?.length
      ? lists.acceptedFiles
      : movedEntries.map((item) => item.name);
    const rejectedNamesForSheet = Array.isArray(lists.rejectedFiles) ? lists.rejectedFiles : [];

    // 序列化 acceptedDetails 和 rejectedDetails 为 JSON，保存文件ID和链接
    const acceptedDetailsJson = movedEntries.length > 0
      ? JSON.stringify(movedEntries)  // movedEntries 包含 {id, name, link}
      : '';
    const rejectedDetailsJson = ''; // 审核通过后不合格文件为空

    // 确保 namingMetadata 是字符串
    const namingMetadataStr = typeof payload.namingMetadata === 'string'
      ? payload.namingMetadata
      : (payload.namingMetadata ? JSON.stringify(payload.namingMetadata) : '');

    const rowValues = [
      payload.reviewDescription || payload.description || '',
      payload.submitter || '',
      payload.admin || '',
      payload.completedAt || '',
      payload.tempLink || '',
      payload.mainCategory || '',
      payload.subCategory || '',
      payload.reviewer || payload.admin || '',
      '已通过',
      payload.note || '',
      targetFolderLink,
      payload.customDate || '',
      payload.folderId || '',
      payload.targetFolderId || '',
      payload.tempParentId || '',
      this.formatFileListCell(acceptedNamesForSheet),
      this.formatFileListCell(rejectedNamesForSheet),
      payload.renamePattern || '',    // 第18列
      payload.folderPattern || '',    // 第19列
      namingMetadataStr,              // 第20列：命名元数据（字符串）
      acceptedDetailsJson,            // 第21列：合格文件详情 JSON
      rejectedDetailsJson             // 第22列：不合格文件详情 JSON
    ];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.config.sheetId,
      range: this.getReviewRowRange(payload.rowNumber),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowValues] }
    });
    return { success: true, link: targetFolderLink };
  }

  async rejectReviewEntry(payload = {}) {
    if (!payload.rowNumber) {
      throw new Error('缺少行号，无法更新审核记录');
    }
    if (!this.config.sheetId) {
      throw new Error('尚未配置 Sheet ID');
    }
    await this.ensureApis();
    const lists = await this.resolveReviewFileLists(payload);
    const status = payload.status || '需要修改';

    // 序列化 acceptedDetails 和 rejectedDetails 为 JSON
    const acceptedDetailsJson = Array.isArray(lists.acceptedDetails) && lists.acceptedDetails.length > 0
      ? JSON.stringify(lists.acceptedDetails)
      : '';
    const rejectedDetailsJson = Array.isArray(lists.rejectedDetails) && lists.rejectedDetails.length > 0
      ? JSON.stringify(lists.rejectedDetails)
      : '';

    // 确保 namingMetadata 是字符串
    const namingMetadataStr = typeof payload.namingMetadata === 'string'
      ? payload.namingMetadata
      : (payload.namingMetadata ? JSON.stringify(payload.namingMetadata) : '');

    const rowValues = [
      payload.reviewDescription || payload.description || '',
      payload.submitter || '',
      payload.admin || '',
      payload.completedAt || '',
      payload.tempLink || '',
      payload.mainCategory || '',
      payload.subCategory || '',
      payload.reviewer || payload.admin || '',
      status,
      payload.note || '',
      payload.folderLink || '',
      payload.customDate || '',
      payload.folderId || '',
      payload.targetFolderId || '',
      payload.tempParentId || '',
      this.formatFileListCell(lists.acceptedFiles),
      this.formatFileListCell(lists.rejectedFiles),
      payload.renamePattern || '',     // 第18列
      payload.folderPattern || '',     // 第19列
      namingMetadataStr,               // 第20列：命名元数据
      acceptedDetailsJson,             // 第21列：合格文件详情 JSON
      rejectedDetailsJson              // 第22列：不合格文件详情 JSON
    ];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.config.sheetId,
      range: this.getReviewRowRange(payload.rowNumber),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowValues] }
    });
    return { success: true };
  }

  async reopenReviewEntry(payload = {}) {
    if (!payload.rowNumber) {
      throw new Error('缺少行号，无法重新审核');
    }
    if (!this.config.sheetId) {
      throw new Error('尚未配置 Sheet ID');
    }
    await this.ensureApis();
    const lists = await this.resolveReviewFileLists(payload);
    const status = payload.status || '已更新修改';

    // 序列化 acceptedDetails 和 rejectedDetails 为 JSON
    const acceptedDetailsJson = Array.isArray(lists.acceptedDetails) && lists.acceptedDetails.length > 0
      ? JSON.stringify(lists.acceptedDetails)
      : '';
    const rejectedDetailsJson = Array.isArray(lists.rejectedDetails) && lists.rejectedDetails.length > 0
      ? JSON.stringify(lists.rejectedDetails)
      : '';

    // 确保 namingMetadata 是字符串
    const namingMetadataStr = typeof payload.namingMetadata === 'string'
      ? payload.namingMetadata
      : (payload.namingMetadata ? JSON.stringify(payload.namingMetadata) : '');

    const rowValues = [
      payload.reviewDescription || payload.description || '',
      payload.submitter || '',
      payload.admin || '',
      payload.completedAt || '',
      payload.tempLink || '',
      payload.mainCategory || '',
      payload.subCategory || '',
      payload.reviewer || payload.admin || '',
      status,
      payload.note || '',
      payload.folderLink || '',
      payload.customDate || '',
      payload.folderId || '',
      payload.targetFolderId || '',
      payload.tempParentId || '',
      this.formatFileListCell(lists.acceptedFiles),
      this.formatFileListCell(lists.rejectedFiles),
      payload.renamePattern || '',     // 第18列
      payload.folderPattern || '',     // 第19列
      namingMetadataStr,               // 第20列：命名元数据
      acceptedDetailsJson,             // 第21列：合格文件详情 JSON
      rejectedDetailsJson              // 第22列：不合格文件详情 JSON
    ];
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.config.sheetId,
      range: this.getReviewRowRange(payload.rowNumber),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowValues] }
    });
    return { success: true };
  }

  async syncReviewEntries() {
    const entries = await this.fetchReviewEntries();
    const targets = entries.filter((entry) => {
      const status = (entry.status || '').trim();
      return status === '通过' || status === '已通过' || status === '已审核通过';
    });
    const results = [];
    for (const entry of targets) {
      try {
        await this.approveReviewEntry({ ...entry, note: entry.note || 'Sheet 审批' });
        results.push({ rowNumber: entry.rowNumber, status: 'success' });
      } catch (error) {
        results.push({ rowNumber: entry.rowNumber, status: 'error', message: error.message });
      }
    }
    return { processed: results.filter((item) => item.status === 'success').length, rows: results };
  }

  normalizeReadyFlag(value) {
    if (!value) {
      return '';
    }
    const normalized = String(value).trim();
    if (normalized === '是' || normalized.toLowerCase() === 'yes') {
      return '是';
    }
    if (normalized === '否' || normalized.toLowerCase() === 'no') {
      return '否';
    }
    return normalized;
  }

  parseFileListCell(value) {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => (item == null ? '' : String(item).trim()))
        .filter((item) => Boolean(item));
    }
    return String(value)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => Boolean(item));
  }

  formatFileListCell(value) {
    if (!value) {
      return '';
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => (item == null ? '' : String(item).trim()))
        .filter((item) => Boolean(item))
        .join('\n');
    }
    return this.parseFileListCell(value).join('\n');
  }

  async fetchCategories() {
    const spreadsheetId = this.normalizeSpreadsheetId(this.config.sheetId);
    if (!spreadsheetId) {
      throw new Error('请先在配置中填写 Sheet ID');
    }
    if (!this.sheets) {
      await this.ensureApis();
    }
    const sheetName = this.config.categorySheetName || '数据验证';
    // 扩展读取范围到 D 列以读取任务类型
    const defaultRange = `${sheetName}!A2:D`;
    let range = this.config.categoryRange || defaultRange;

    // 如果用户配置的 range 只到 C 列，自动扩展到 D 列
    if (range && /![A-Za-z]+\d*:[Cc](\d*)$/i.test(range)) {
      range = range.replace(/:[Cc](\d*)$/i, ':D$1');
      console.log('[fetchCategories] 自动扩展分类范围到 D 列:', range);
    }

    console.log('[fetchCategories] 读取分类数据，范围:', range);
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'FORMULA'
    });
    const values = response.data.values || [];
    console.log('[fetchCategories] 读取到', values.length, '行数据');
    const tree = [];
    const map = {};
    const taskTypesSet = new Set();
    values.forEach((row) => {
      const [main, sub, folderId, taskType] = row;
      // 收集任务类型（D 列）
      if (taskType && typeof taskType === 'string' && taskType.trim()) {
        taskTypesSet.add(taskType.trim());
      }
      if (!main || !sub) {
        return;
      }
      if (!map[main]) {
        map[main] = {};
        tree.push({ name: main, subs: [] });
      }
      if (!map[main][sub]) {
        map[main][sub] = folderId || '';
        const parent = tree.find((item) => item.name === main);
        parent.subs.push({ name: sub, folderId: folderId || '' });
      }
    });
    // 将任务类型转为数组并排序
    const taskTypes = Array.from(taskTypesSet).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    console.log('[fetchCategories] 读取到任务类型:', taskTypes.length, '个 -', taskTypes.join(', ') || '(空)');
    return { categories: tree, map, taskTypes };
  }

  async fetchSoftwareDirectory(options = {}) {
    const spreadsheetId = this.normalizeSpreadsheetId(
      options.sheetId || this.config.softwareSheetId
    );
    if (!spreadsheetId) {
      throw new Error('请先填写软件目录表格 ID');
    }
    if (!this.sheets) {
      await this.ensureApis();
    }
    const range = options.sheetRange || this.config.softwareSheetRange || 'Software!A:K';
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'FORMULA'
    });
    const rows = response.data.values || [];
    if (!rows.length) {
      console.warn('[SoftwareDirectory] No rows returned for', spreadsheetId, range);
    }
    const entries = rows
      .map((row, index) => {
        if (!row || !row.length) {
          return null;
        }
        if (index === 0) {
          return null;
        }
        const [category, name, iconCell, usageLevel, rating, safety, summary, website, copyrightLink, tutorial, comments] =
          row;
        if (!name) {
          return null;
        }
        const icon = this.extractImageUrl(iconCell) || '';
        return {
          rowIndex: index + 1,
          category: category || '',
          name,
          icon,
          usageLevel: usageLevel || '',
          rating: rating || '',
          safety: safety || '',
          summary: summary || '',
          website: website || '',
          copyrightLink: copyrightLink || '',
          tutorial: tutorial || '',
          comments: comments || ''
        };
      })
      .filter(Boolean);
    let admins = [];
    let pendingAdmins = [];
    const adminRange = options.adminRange || this.config.softwareAdminRange || '';
    if (adminRange) {
      try {
        const adminResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId,
          range: adminRange,
          valueRenderOption: 'UNFORMATTED_VALUE'
        });
        const parsed = this.parseAdminEntries(adminResponse.data.values || []);
        admins = parsed.admins;
        pendingAdmins = parsed.pending;
      } catch (error) {
        console.warn('[SoftwareDirectory] Failed to fetch admin range', adminRange, error.message);
      }
    }
    return { entries, admins, pendingAdmins };
  }

  async fetchSoftwareSubmissions(options = {}) {
    const spreadsheetId = this.normalizeSpreadsheetId(
      options.sheetId || this.config.softwareSheetId
    );
    if (!spreadsheetId) {
      throw new Error('请先填写软件目录表格 ID');
    }
    if (!this.sheets) {
      await this.ensureApis();
    }
    const submissionRange =
      options.submissionRange || this.config.softwareSubmissionRange || 'SoftwareSubmissions!A:S';
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: submissionRange,
      valueRenderOption: 'FORMATTED_VALUE'
    });
    const rows = response.data.values || [];
    if (!rows.length) {
      return { entries: [] };
    }
    const header = rows[0] || [];
    const columnIndexes = this.buildSubmissionColumnIndexes(header);
    const entries = rows
      .slice(1)
      .map((row, index) => {
        if (!row || !row.length) {
          return null;
        }
        const getValue = (key) => {
          const columnIndex = columnIndexes[key];
          if (columnIndex == null || columnIndex < 0) {
            return '';
          }
          return row[columnIndex] != null ? String(row[columnIndex]) : '';
        };
        const status = getValue('status');
        const normalizedStatus = this.normalizeSubmissionStatus(status);
        const entry = {
          rowNumber: index + 2,
          submittedAt: getValue('submittedAt'),
          applicantName: getValue('applicantName'),
          applicantEmail: getValue('applicantEmail'),
          category: getValue('category'),
          name: getValue('name'),
          icon: getValue('icon'),
          website: getValue('website'),
          usageLevel: getValue('usageLevel'),
          rating: getValue('rating'),
          safety: getValue('safety'),
          summary: getValue('summary'),
          copyrightResult: getValue('copyright'),
          tutorial: getValue('tutorial'),
          comments: getValue('comments'),
          notes: getValue('notes'),
          status,
          statusNormalized: normalizedStatus,
          reviewer: getValue('reviewer'),
          reviewNotes: getValue('reviewNotes')
        };
        entry.isPending = normalizedStatus === 'pending';
        return entry;
      })
      .filter(Boolean);
    return { entries };
  }

  async reviewSoftwareSubmission(payload = {}) {
    const spreadsheetId = this.normalizeSpreadsheetId(
      payload.sheetId || this.config.softwareSheetId
    );
    if (!spreadsheetId) {
      throw new Error('请先填写软件目录表格 ID');
    }
    if (!this.sheets) {
      await this.ensureApis();
    }
    const submissionRange =
      payload.submissionRange || this.config.softwareSubmissionRange || 'SoftwareSubmissions!A:S';
    const directoryRange = payload.directoryRange || this.config.softwareSheetRange || 'Software!A:K';
    const rowNumber = Number(payload.rowNumber);
    if (!rowNumber || rowNumber < 2) {
      throw new Error('缺少有效的提交行号');
    }
    const action = payload.action === 'reject' ? 'reject' : 'approve';
    const statusText = action === 'approve' ? '已通过' : '已驳回';
    const reviewer = payload.reviewer || '';
    const notes = payload.notes || '';
    const headerMeta = await this.getSubmissionHeaderMeta(spreadsheetId, submissionRange);
    const { indexes, bounds } = headerMeta;
    const updates = [];
    if (indexes.status >= 0) {
      updates.push({
        range: `${bounds.sheetName}!${this.columnIndexToLetter(bounds.startColumnIndex + indexes.status + 1)}${rowNumber}`,
        values: [[statusText]]
      });
    }
    if (indexes.reviewer >= 0) {
      updates.push({
        range: `${bounds.sheetName}!${this.columnIndexToLetter(bounds.startColumnIndex + indexes.reviewer + 1)}${rowNumber}`,
        values: [[reviewer]]
      });
    }
    if (indexes.reviewNotes >= 0) {
      updates.push({
        range: `${bounds.sheetName}!${this.columnIndexToLetter(bounds.startColumnIndex + indexes.reviewNotes + 1)}${rowNumber}`,
        values: [[notes]]
      });
    }
    if (updates.length) {
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
    }
    if (action === 'approve') {
      await this.appendSoftwareDirectoryEntry(spreadsheetId, directoryRange, payload.entryData || {});
    }
    return { status: statusText };
  }

  extractImageUrl(cellValue) {
    if (!cellValue) {
      return '';
    }
    const value = String(cellValue).trim();
    if (!value) {
      return '';
    }
    if (/^=IMAGE/i.test(value)) {
      const match = value.match(/=IMAGE\(\s*"([^"]+)"/i) || value.match(/=IMAGE\(\s*'([^']+)'/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    return '';
  }

  parseAdminEntries(rows = []) {
    const result = { admins: [], pending: [] };
    if (!Array.isArray(rows)) {
      return result;
    }
    let headerIndexes = { name: 0, email: 1, status: 2 };
    let headerCaptured = false;
    rows.forEach((row) => {
      const values = Array.isArray(row) ? row : [row];
      const trimmed = values.map((cell) => (cell == null ? '' : String(cell).trim()));
      if (!trimmed.some(Boolean)) {
        return;
      }
      if (!headerCaptured && trimmed.some((cell) => /申请人|邮箱|email|授权|状态/i.test(cell))) {
        headerIndexes = {
          name: this.findColumnIndex(trimmed, ['申请人', '名字', '姓名', 'name']),
          email: this.findColumnIndex(trimmed, ['申请人邮箱', '邮箱', 'email', '邮箱地址']),
          status: this.findColumnIndex(trimmed, ['是否授权', '是否授权为管理员', '授权状态', '状态', '审核结果'])
        };
        if (headerIndexes.name < 0) headerIndexes.name = 0;
        if (headerIndexes.email < 0) headerIndexes.email = 1;
        if (headerIndexes.status < 0) headerIndexes.status = 2;
        headerCaptured = true;
        return;
      }
      const getValue = (index) => {
        if (index >= 0 && index < trimmed.length) {
          return trimmed[index];
        }
        return '';
      };
      let email = getValue(headerIndexes.email);
      if (!email || !email.includes('@')) {
        email = trimmed.find((value) => value.includes('@')) || '';
      }
      if (!email || !email.includes('@')) {
        return;
      }
      const name = getValue(headerIndexes.name) || '';
      const statusValue = getValue(headerIndexes.status) || '';
      const isAuthorized = statusValue === '已授权';
      if (isAuthorized) {
        if (!result.admins.includes(email)) {
          result.admins.push(email);
        }
      } else {
        result.pending.push({
          name,
          email,
          status: statusValue || '待授权'
        });
      }
    });
    return result;
  }

  buildSubmissionColumnIndexes(header = []) {
    return {
      submittedAt: this.findColumnIndex(header, ['提交时间', '时间', 'timestamp', '创建时间']),
      applicantName: this.findColumnIndex(header, ['申请人', '申请人名字', '姓名', 'name']),
      applicantEmail: this.findColumnIndex(header, ['申请人邮箱', '邮箱', 'email', '邮箱地址']),
      category: this.findColumnIndex(header, ['软件类别', '类别', '分类']),
      name: this.findColumnIndex(header, ['软件名称', '名称', '软件名']),
      icon: this.findColumnIndex(header, ['软件图标', '图标', 'icon']),
      website: this.findColumnIndex(header, ['官网链接', '官网', '网站']),
      usageLevel: this.findColumnIndex(header, ['是否常用', '使用频率', '常用程度']),
      rating: this.findColumnIndex(header, ['推荐指数', '推荐', '评分']),
      safety: this.findColumnIndex(header, ['是否安全', '安全状态', '安全性']),
      summary: this.findColumnIndex(header, ['核心功能', '功能介绍', '简介']),
      copyright: this.findColumnIndex(header, ['版权审核结果', '版权结果', '版权']),
      tutorial: this.findColumnIndex(header, ['教程', '使用教程']),
      comments: this.findColumnIndex(header, ['评论', '评价']),
      notes: this.findColumnIndex(header, ['备注', '附加说明', 'notes']),
      status: this.findColumnIndex(header, ['审核状态', '状态', '处理状态']),
      reviewer: this.findColumnIndex(header, ['审核人', '处理人', '管理员']),
      reviewNotes: this.findColumnIndex(header, ['审核备注', '处理意见', '反馈'])
    };
  }

  normalizeSubmissionStatus(status) {
    const value = (status || '').trim();
    if (!value) {
      return 'pending';
    }
    if (/待|pending|未处理|未审核/i.test(value)) {
      return 'pending';
    }
    if (/拒绝|驳回|不通过|reject/i.test(value)) {
      return 'rejected';
    }
    if (/通过|已入库|approved/i.test(value)) {
      return 'approved';
    }
    return 'other';
  }

  async getSubmissionHeaderMeta(spreadsheetId, range) {
    const bounds = this.parseRangeBounds(range);
    const headerRange = `${bounds.sheetName}!${bounds.startColumnLetter || 'A'}1:${bounds.endColumnLetter || bounds.startColumnLetter}1`;
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: headerRange,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    const header = response.data.values?.[0] || [];
    return {
      header,
      bounds,
      indexes: this.buildSubmissionColumnIndexes(header)
    };
  }

  parseRangeBounds(range) {
    const result = {
      sheetName: range,
      startColumnIndex: 0,
      endColumnIndex: 25,
      startColumnLetter: 'A',
      endColumnLetter: 'Z'
    };
    if (!range) {
      return result;
    }
    const [sheetName, area] = range.includes('!') ? range.split('!') : [range, ''];
    result.sheetName = sheetName || range;
    if (!area) {
      return result;
    }
    const [startRef, endRef] = area.split(':');
    const startMatch = startRef?.match(/([A-Z]+)(\d+)?/i);
    const endMatch = endRef?.match(/([A-Z]+)(\d+)?/i);
    if (startMatch && startMatch[1]) {
      result.startColumnLetter = startMatch[1].toUpperCase();
      result.startColumnIndex = this.columnLetterToIndex(result.startColumnLetter);
    }
    if (endMatch && endMatch[1]) {
      result.endColumnLetter = endMatch[1].toUpperCase();
      result.endColumnIndex = this.columnLetterToIndex(result.endColumnLetter);
    } else {
      result.endColumnLetter = result.startColumnLetter;
      result.endColumnIndex = result.startColumnIndex;
    }
    return result;
  }

  columnLetterToIndex(letter = 'A') {
    const normalized = letter.toUpperCase();
    let index = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      index *= 26;
      index += normalized.charCodeAt(i) - 64;
    }
    return Math.max(0, index - 1);
  }

  columnIndexToLetter(index = 1) {
    let idx = Math.max(1, index);
    let letters = '';
    while (idx > 0) {
      const remainder = (idx - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      idx = Math.floor((idx - remainder) / 26);
    }
    return letters || 'A';
  }

  async appendSoftwareDirectoryEntry(spreadsheetId, range, entryData = {}) {
    const values = [
      entryData.category || '',
      entryData.name || '',
      entryData.icon || '',
      entryData.usageLevel || '',
      entryData.rating || '',
      entryData.safety || '',
      entryData.summary || '',
      entryData.website || '',
      entryData.copyrightResult || '',
      entryData.tutorial || '',
      entryData.comments || ''
    ];
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: range || 'Software!A:K',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [values]
      }
    });
  }

  findColumnIndex(row = [], keywords = []) {
    if (!Array.isArray(row)) {
      return -1;
    }
    const lowered = row.map((value) => String(value || '').toLowerCase());
    const target = keywords.map((kw) => kw.toLowerCase());
    for (let i = 0; i < lowered.length; i += 1) {
      if (target.some((keyword) => lowered[i].includes(keyword))) {
        return i;
      }
    }
    return -1;
  }


  storeUserEmailFromToken(idToken) {
    const email = this.extractEmailFromIdToken(idToken);
    if (email) {
      this.store.set('userEmail', email);
    }
  }

  extractEmailFromIdToken(idToken) {
    if (!idToken || typeof idToken !== 'string') {
      return '';
    }
    const parts = idToken.split('.');
    if (parts.length < 2) {
      return '';
    }
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      return payload?.email || '';
    } catch (error) {
      return '';
    }
  }

  getCurrentUserEmail() {
    return this.store.get('userEmail') || '';
  }

  // ========== 每日打卡 Google Sheets 同步方法 ==========

  buildCheckinDisplayName(teamName, userName) {
    const safeTeam = (teamName || '').toString().trim();
    const safeUser = (userName || '').toString().trim();
    if (!safeTeam || safeTeam === 'default') return safeUser;
    if (!safeUser) return safeTeam;
    return `${safeTeam}-${safeUser}`;
  }

  parseCheckinDisplayName(value) {
    const text = (value ?? '').toString().trim();
    if (!text) return { userName: '', teamName: 'default' };
    const idx = text.lastIndexOf('-');
    if (idx <= 0 || idx === text.length - 1) {
      return { userName: text, teamName: 'default' };
    }
    const teamName = text.slice(0, idx).trim();
    const userName = text.slice(idx + 1).trim();
    if (!userName) return { userName: text, teamName: 'default' };
    return { userName, teamName: teamName || 'default' };
  }

  /**
   * 确保打卡表格有正确的表头
   * 🔴 新增"团队"列，主键为 日期+姓名+团队
   */
  async ensureCheckinSheetHeader(sheetId, sheetName) {
    await this.ensureApis();

    const headerRow = [
      '日期', '姓名', '组别', '上午时间', '上午状态', '下午时间', '下午状态',
      '晚上时间', '晚上状态', '休息时间', '休息状态', '在线时长(h)', '备注'
    ];

    try {
      // 读取第一行检查表头
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1:M1`
      });

      const existingHeader = response.data.values?.[0] || [];
      // 🔴 检查是否包含团队列
      if (existingHeader.length === 0 || existingHeader[0] !== '日期' || (!existingHeader.includes('组别') && !existingHeader.includes('团队'))) {
        // 写入表头
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${sheetName}!A1:M1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [headerRow] }
        });
        console.log('[Checkin] 表头已创建/更新（含团队列）');
      }
    } catch (error) {
      // 工作表可能不存在，尝试创建
      if (error.code === 400 || error.message?.includes('Unable to parse range')) {
        try {
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
              requests: [{
                addSheet: { properties: { title: sheetName } }
              }]
            }
          });
          // 创建后写入表头
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${sheetName}!A1:M1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [headerRow] }
          });
          console.log('[Checkin] 工作表和表头已创建');
        } catch (createError) {
          console.warn('[Checkin] 创建工作表失败:', createError.message);
        }
      }
    }
  }

  /**
   * 格式化打卡记录为表格行数据
   * 🔴 新增团队列
   */
  formatCheckinRecord(record) {
    const formatTime = (slot) => {
      if (!slot) return '';
      const time = typeof slot === 'string' ? slot : slot?.time;
      if (!time) return '';
      try {
        const d = new Date(time);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch { return ''; }
    };

    const formatStatus = (slot) => {
      if (!slot) return '';
      const status = typeof slot === 'string' ? 'normal' : slot?.status || 'normal';
      const customName = slot?.customStatusName || '';
      const statusMap = {
        normal: '正常',
        late: '迟到',
        absent: '缺勤',
        leave: '休假',
        sick: '病假',
        custom: customName || '自定义'
      };
      if (status === 'custom') return statusMap.custom;
      if (!statusMap[status] && customName) return customName;
      return statusMap[status] || status;
    };

    // 计算在线时长
    let focusHours = 0;
    const slots = record.slots || {};
    const periods = record.targetPeriods || [];
    periods.forEach(period => {
      if (period.start && period.end) {
        const [sh, sm] = period.start.split(':').map(Number);
        const [eh, em] = period.end.split(':').map(Number);
        focusHours += (eh * 60 + em - sh * 60 - sm) / 60;
      }
    });
    // 减去琐事时间
    const activities = slots.customActivities || [];
    const breakMinutes = activities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    focusHours = Math.max(0, focusHours - breakMinutes / 60);

    return [
      record.date || '',
      record.userName || '',
      record.teamName || 'default',  // 🔴 新增团队列
      formatTime(slots.morning),
      formatStatus(slots.morning),
      formatTime(slots.afternoon),
      formatStatus(slots.afternoon),
      formatTime(slots.evening),
      formatStatus(slots.evening),
      formatTime(slots.sleep),
      formatStatus(slots.sleep),
      focusHours.toFixed(1),
      ''  // 备注
    ];
  }

  /**
   * 插入或更新打卡记录
   * 🔴 主键改为：日期+姓名+团队
   */
  async upsertCheckinRecord(sheetId, sheetName, date, userName, rowData, teamName = 'default') {
    await this.ensureApis();

    // 读取所有数据找到匹配的行（日期、姓名、团队）
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:C`
    });

    const rows = response.data.values || [];
    let targetRow = -1;

    for (let i = 1; i < rows.length; i++) {
      // 🔴 匹配日期+姓名+团队
      if (rows[i][0] === date && rows[i][1] === userName && (rows[i][2] || 'default') === teamName) {
        targetRow = i + 1; // 1-indexed
        break;
      }
    }

    if (targetRow > 0) {
      // 更新现有行
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A${targetRow}:M${targetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] }
      });
      return { action: 'updated', row: targetRow };
    } else {
      // 追加新行
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:M`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] }
      });
      return { action: 'inserted' };
    }
  }

  /**
   * 从表格读取所有打卡记录
   */
  async fetchCheckinRecords(sheetId, sheetName) {
    await this.ensureApis();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1:ZZ`
    });

    const rows = response.data.values || [];
    if (!rows.length) return [];

    const isHorizontal = () => {
      const headerRow1 = rows[0] || [];
      const headerRow2 = rows[1] || [];
      const firstCell = (headerRow1[0] || '').trim();
      const nameHeaders = ['姓名', '成员', '组名-姓名', '组别-姓名'];
      if (!nameHeaders.includes(firstCell)) return false;
      const slotLabels = ['上午', '下午', '晚上', '休息'];
      for (let i = 0; i < slotLabels.length; i++) {
        if ((headerRow2[i + 1] || '').trim() !== slotLabels[i]) return false;
      }
      return true;
    };

    if (isHorizontal()) {
      const headerRow1 = rows[0] || [];
      const headerRow2 = rows[1] || [];
      const dateColumns = [];
      const now = new Date();
      let currentYear = now.getFullYear();
      let prevMonth = null;
      const seenDates = new Set();

      const getDateLabel = (col) => {
        let label = headerRow1[col];
        if (label) return label;
        for (let back = 1; back <= 3; back++) {
          label = headerRow1[col - back];
          if (label) return label;
        }
        return '';
      };

      for (let col = 1; col < headerRow2.length; col++) {
        if ((headerRow2[col] || '').trim() !== '上午') continue;
        const label = getDateLabel(col);
        if (!label) continue;
        const match = String(label).match(/(\d+)\s*月\s*(\d+)\s*日/);
        if (!match) continue;
        const month = Number(match[1]);
        const day = Number(match[2]);
        if (prevMonth !== null && month > prevMonth) {
          currentYear -= 1;
        }
        prevMonth = month;
        const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (seenDates.has(dateStr)) continue;
        seenDates.add(dateStr);
        dateColumns.push({ dateStr, startCol: col });
      }

      const normalizeText = (value) => (value ?? '').toString().trim();

      const parseWorkSlot = (value) => {
        let text = normalizeText(value);
        if (!text || text === '-' || text === '○' || text === '未打卡' || text === '未打') return null;

        // 🔴 检查是否是手动打卡（带★前缀）
        let isManual = false;
        if (text.startsWith('★')) {
          isManual = true;
          text = text.substring(1); // 去掉★前缀
        }

        if (['正常上线', '正常', '✓', '√'].includes(text)) {
          return { status: 'normal', displayLabel: '正常上线', isManual };
        }
        if (['迟到', '迟'].includes(text)) {
          return { status: 'late', displayLabel: '迟到', isManual };
        }
        if (['缺勤', '旷工', '缺'].includes(text)) {
          return { status: 'absent', displayLabel: '缺勤', isManual };
        }
        if (['休假', '休', '请假'].includes(text)) {
          return { status: 'leave', displayLabel: '休假', isManual };
        }
        if (['身体抱恙', '病假', '病', '生病'].includes(text)) {
          return { status: 'sick', displayLabel: '身体抱恙', isManual };
        }
        return { status: 'custom', customStatusName: text, displayLabel: text, isManual };
      };

      const parseSleepSlot = (value) => {
        const text = normalizeText(value);
        if (!text || text === '-' || text === '○' || text === '未休息' || text === '未打卡') return null;
        if (text === '早睡') {
          return { status: 'normal', displayLabel: '早睡', displayClass: 'sleep-early' };
        }
        if (text === '正常睡' || text === '正常') {
          return { status: 'normal', displayLabel: '正常睡', displayClass: 'sleep-normal' };
        }
        if (text === '熬夜' || text === '迟到' || text === '迟') {
          return { status: 'late', displayLabel: '熬夜', displayClass: 'sleep-late' };
        }
        return { status: 'custom', customStatusName: text, displayLabel: text, displayClass: 'custom' };
      };

      const records = [];
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] || [];
        const { userName, teamName } = this.parseCheckinDisplayName(row[0]);
        if (!userName) continue;

        dateColumns.forEach(({ dateStr, startCol }) => {
          const slots = {
            morning: parseWorkSlot(row[startCol]),
            afternoon: parseWorkSlot(row[startCol + 1]),
            evening: parseWorkSlot(row[startCol + 2]),
            sleep: parseSleepSlot(row[startCol + 3]),
            customActivities: []
          };
          const hasSlotData = Boolean(slots.morning || slots.afternoon || slots.evening || slots.sleep);
          if (!hasSlotData) return;

          records.push({
            id: `day-${dateStr}`,
            date: dateStr,
            userName,
            teamName: teamName || 'default',
            mode: 'full_time',
            targetPeriods: [],
            slots
          });
        });
      }

      return records;
    }

    const dataRows = rows[0]?.[0] === '日期' ? rows.slice(1) : rows;
    const records = [];

    dataRows.forEach(row => {
      if (!row[0] || !row[1]) return; // 跳过空行

      const parseTime = (timeStr, dateStr) => {
        if (!timeStr) return null;
        try {
          const [h, m] = timeStr.split(':').map(Number);
          const d = new Date(dateStr);
          d.setHours(h, m, 0, 0);
          return d.toISOString();
        } catch { return null; }
      };

      const parseStatus = (statusStr) => {
        const cleaned = (statusStr || '').trim();
        const statusMap = {
          '正常': 'normal',
          '正常上线': 'normal',
          '迟到': 'late',
          '缺勤': 'absent',
          '休假': 'leave',
          '病假': 'sick',
          '身体抱恙': 'sick'
        };
        if (!cleaned) return { status: 'normal', customStatusName: '' };
        const mapped = statusMap[cleaned];
        if (mapped) return { status: mapped, customStatusName: '' };
        return { status: 'custom', customStatusName: cleaned };
      };

      const date = row[0];
      const userName = row[1];
      const teamName = row[2] || 'default';
      const morningStatus = parseStatus(row[4]);
      const afternoonStatus = parseStatus(row[6]);
      const eveningStatus = parseStatus(row[8]);
      const sleepStatus = parseStatus(row[10]);

      records.push({
        id: `day-${date}`,
        date,
        userName,
        teamName,
        mode: 'full_time',
        targetPeriods: [],
        slots: {
          morning: row[3] ? { time: parseTime(row[3], date), status: morningStatus.status, customStatusName: morningStatus.customStatusName } : null,
          afternoon: row[5] ? { time: parseTime(row[5], date), status: afternoonStatus.status, customStatusName: afternoonStatus.customStatusName } : null,
          evening: row[7] ? { time: parseTime(row[7], date), status: eveningStatus.status, customStatusName: eveningStatus.customStatusName } : null,
          sleep: row[9] ? { time: parseTime(row[9], date), status: sleepStatus.status, customStatusName: sleepStatus.customStatusName } : null,
          customActivities: []
        }
      });
    });

    return records;
  }

  // ========== 新版横向日期格式同步 ==========

  /**
   * 生成日期范围（上月23日到本月22日）
   */
  generateCheckinDateRange(year, month) {
    const startDate = new Date(year, month - 1, 23);
    const endDate = new Date(year, month, 22);
    const dates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }

  /**
   * 格式化日期为列标题
   */
  formatDateHeader(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  /**
   * 格式化单个时段的状态
   */
  formatSlotStatus(slot, slotKey = 'default') {
    const status = typeof slot === 'string' ? 'normal' : slot?.status || 'normal';
    const timeValue = typeof slot === 'string' ? slot : slot?.time;
    const hasTime = Boolean(timeValue);

    const statusLabelMap = {
      normal: '正常上线',
      late: '迟到',
      absent: '缺勤',
      leave: '休假',
      sick: '身体抱恙'
    };

    const getStatusLabel = () => {
      if (status === 'custom') {
        return slot?.customStatusName || '自定义';
      }
      return statusLabelMap[status] || status || '正常上线';
    };

    const isEarlySleepTime = () => {
      if (!timeValue) return false;
      const dt = new Date(timeValue);
      const hh = dt.getHours();
      const mm = dt.getMinutes();
      return (hh >= 5 && hh < 22) || (hh === 22 && mm < 30);
    };

    if (!hasTime && status === 'normal') {
      return slotKey === 'sleep' ? '未休息' : '未打卡';
    }
    if (slotKey === 'sleep') {
      if (status === 'late') return '熬夜';
      if (status !== 'normal') return getStatusLabel();
      return isEarlySleepTime() ? '早睡' : '正常睡';
    }
    if (status === 'normal') return '正常上线';
    return getStatusLabel();
  }

  /**
   * 格式化时间为 HH:MM 字符串
   */
  formatTimeString(timeValue) {
    if (!timeValue) return '';
    try {
      const d = new Date(timeValue);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return ''; }
  }

  /**
   * 同步打卡数据到横向日期格式的表格（和团队总览一致）
   * 第1行: 姓名 + 日期（每个日期跨4列）
   * 第2行: 空 + 上午/下午/晚上/休息（重复）
   * 第3行+: 成员名 + 各时段状态
   */
  async syncCheckinHorizontal(sheetId, sheetName, records, year, month) {
    await this.ensureApis();

    const dates = this.generateCheckinDateRange(year, month);
    dates.reverse();
    const dateStrings = dates.map(d => d.toISOString().split('T')[0]);
    const slotLabels = ['上午', '下午', '晚上', '休息'];
    const slotKeys = ['morning', 'afternoon', 'evening', 'sleep'];
    const todayStr = new Date().toISOString().split('T')[0];

    let targetSheetId = null;
    let existingConditionalFormats = [];
    let existingMerges = [];

    try {
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        ranges: [],
        includeGridData: false
      });
      const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
      if (sheet) {
        targetSheetId = sheet.properties.sheetId;
        existingConditionalFormats = sheet.conditionalFormats || [];
        existingMerges = sheet.merges || [];
      }
    } catch (error) {
      console.warn('[Checkin] 读取表格信息失败:', error.message);
    }

    if (targetSheetId === null) {
      try {
        const createResult = await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: sheetName } } }]
          }
        });
        targetSheetId = createResult.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
      } catch (error) {
        console.warn('[Checkin] 创建工作表失败:', error.message);
      }
    }

    // 🔴 关键修复：先读取表格中的现有数据，避免覆盖其他用户的记录
    let existingRecords = [];
    let existingUserCount = 0;
    const normalizeTeamName = (value) => {
      const text = (value ?? '').toString().trim();
      return text || 'default';
    };
    const normalizeUserName = (value) => (value ?? '').toString().trim();
    const getUserKey = (userName, teamName) => `${normalizeTeamName(teamName)}||${normalizeUserName(userName)}`;
    try {
      existingRecords = await this.fetchCheckinRecords(sheetId, sheetName);
      // 统计现有用户数量
      const existingUsers = new Set();
      existingRecords.forEach(r => {
        if (!r.userName) return;
        existingUsers.add(getUserKey(r.userName, r.teamName));
      });
      existingUserCount = existingUsers.size;
      console.log(`[Checkin] 读取到表格中 ${existingRecords.length} 条现有记录，共 ${existingUserCount} 个用户`);
    } catch (error) {
      console.warn('[Checkin] 读取现有记录失败，将创建新表格:', error.message);
    }

    // 合并现有记录和新记录（新记录优先）
    const userRecords = new Map();
    const ensureUserEntry = (userName, teamName) => {
      const safeUserName = normalizeUserName(userName);
      if (!safeUserName) return null;
      const safeTeamName = normalizeTeamName(teamName);
      const key = getUserKey(safeUserName, safeTeamName);
      if (!userRecords.has(key)) {
        userRecords.set(key, {
          userName: safeUserName,
          teamName: safeTeamName,
          dates: new Map()
        });
      }
      return userRecords.get(key);
    };

    // 先添加表格中的现有记录
    existingRecords.forEach(r => {
      const entry = ensureUserEntry(r.userName, r.teamName);
      if (!entry) return;
      entry.dates.set(r.date, r);
    });

    // 再添加/覆盖新记录（新记录优先级更高）
    records.forEach(r => {
      const entry = ensureUserEntry(r.userName, r.teamName);
      if (!entry) return;
      entry.dates.set(r.date, r);
    });

    console.log(`[Checkin] 合并后共 ${userRecords.size} 个用户的记录`);

    // 🔴 安全检查：如果现有用户数远大于合并后用户数，可能是解析失败
    if (existingUserCount > 0 && userRecords.size < existingUserCount) {
      console.warn(`[Checkin] ⚠️ 警告：现有表格有 ${existingUserCount} 个用户，但合并后只有 ${userRecords.size} 个用户！可能存在解析问题。`);
    }

    // 第1行: 姓名 + 日期（每个日期跨4列，用空单元格表示合并效果）
    const headerRow1 = ['组名-姓名'];
    dates.forEach(d => {
      const label = `${d.getMonth() + 1}月${d.getDate()}日`;
      headerRow1.push(label, '', '', ''); // 日期占4列
    });

    // 第2行: 空 + 上午/下午/晚上/休息（重复）
    const headerRow2 = [''];
    dates.forEach(() => {
      headerRow2.push(...slotLabels);
    });

    // 第3行+: 成员数据（按姓名排序确保顺序稳定）
    const dataRows = [];
    const cellNotes = []; // 用于存储单元格备注 { row, col, note }
    const sortedUsers = Array.from(userRecords.values()).sort((a, b) => {
      const teamCompare = (a.teamName || '').localeCompare(b.teamName || '', 'zh-CN');
      if (teamCompare !== 0) return teamCompare;
      return (a.userName || '').localeCompare(b.userName || '', 'zh-CN');
    });

    sortedUsers.forEach((userEntry, userIndex) => {
      const userDates = userEntry.dates;
      const displayName = this.buildCheckinDisplayName(userEntry.teamName, userEntry.userName);
      const row = [displayName];
      const rowIndex = userIndex + 2; // 跳过2行表头

      dateStrings.forEach((dateStr, dateIndex) => {
        const record = userDates.get(dateStr);
        const isFuture = dateStr > todayStr;
        slotKeys.forEach((key, slotIndex) => {
          const colIndex = 1 + dateIndex * 4 + slotIndex; // 第0列是姓名

          if (isFuture) {
            row.push('-');
            return;
          }
          const slotValue = record?.slots?.[key];
          let statusText = this.formatSlotStatus(slotValue, key);
          // 🔴 手动打卡添加★标记（用于Sheets条件格式）
          if (slotValue?.isManual && slotValue?.time) {
            statusText = '★' + statusText;
          }
          row.push(statusText);

          // 收集备注信息
          if (slotValue && key !== 'sleep') {
            const noteLines = [];
            const slotIcon = { morning: '🌅', afternoon: '☀️', evening: '🌆' }[key] || '⏰';
            const slotLabel = { morning: '上午', afternoon: '下午', evening: '晚上' }[key] || '';

            // 打卡信息
            if (slotValue.time) {
              const timeStr = this.formatTimeString(slotValue.time);
              noteLines.push(`${slotLabel} ${slotIcon} ${timeStr} ${statusText}`);
              if (slotValue.isManual) {
                noteLines.push('（手动）');
              }
            }

            // 任务完成量
            if (slotValue.taskCount && String(slotValue.taskCount).trim()) {
              noteLines.push(`📋 完成量: ${slotValue.taskCount}`);
            }

            // 备注
            if (slotValue.notes && String(slotValue.notes).trim()) {
              noteLines.push(`💬 备注: ${slotValue.notes}`);
            }

            // 如果有备注内容，添加到列表
            if (noteLines.length > 0) {
              cellNotes.push({
                row: rowIndex,
                col: colIndex,
                note: noteLines.join('\n')
              });
            }
          }
        });
      });

      dataRows.push(row);
    });

    // 合并所有行
    const allRows = [headerRow1, headerRow2, ...dataRows];
    const colCount = 1 + dates.length * 4;
    const range = `${sheetName}!A1:${this.columnToLetter(colCount)}${allRows.length}`;

    // 先清空再写入
    try {
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:ZZ`
      });
    } catch (e) {
      // 可能是新表格，忽略清空错误
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: allRows }
    });

    if (targetSheetId !== null) {
      const toColor = (hex, alpha = 1) => {
        const cleaned = hex.replace('#', '');
        const num = parseInt(cleaned, 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return {
          red: r / 255,
          green: g / 255,
          blue: b / 255,
          alpha
        };
      };

      const headerBg = toColor('#e2e8f0');
      const subHeaderBg = toColor('#f8fafc');
      const nameColBg = toColor('#f1f5f9');
      const dataRange = {
        sheetId: targetSheetId,
        startRowIndex: 2,
        endRowIndex: Math.max(2, allRows.length),
        startColumnIndex: 1,
        endColumnIndex: colCount
      };

      const statusFormats = [
        // 🔴 手动打卡 - 黄色（以★开头的状态）
        { value: '★正常上线', bg: toColor('#f59e0b', 0.25), fg: toColor('#b45309') },
        { value: '★迟到', bg: toColor('#f59e0b', 0.25), fg: toColor('#b45309') },
        { value: '★休假', bg: toColor('#f59e0b', 0.25), fg: toColor('#b45309') },
        { value: '★身体抱恙', bg: toColor('#f59e0b', 0.25), fg: toColor('#b45309') },
        // 正常状态
        { value: '正常上线', bg: toColor('#10b981', 0.18), fg: toColor('#047857') },
        { value: '迟到', bg: toColor('#ef4444', 0.18), fg: toColor('#b91c1c') },
        { value: '缺勤', bg: toColor('#b91c1c', 0.25), fg: toColor('#7f1d1d') },
        { value: '休假', bg: toColor('#a855f7', 0.18), fg: toColor('#7c3aed') },
        { value: '身体抱恙', bg: toColor('#a855f7', 0.18), fg: toColor('#7c3aed') },
        { value: '早睡', bg: toColor('#0ea5e9', 0.18), fg: toColor('#0284c7') },
        { value: '正常睡', bg: toColor('#14b8a6', 0.18), fg: toColor('#0f766e') },
        { value: '熬夜', bg: toColor('#f43f5e', 0.18), fg: toColor('#be123c') },
        { value: '未打卡', bg: toColor('#e2e8f0', 0.6), fg: toColor('#64748b') },
        { value: '未休息', bg: toColor('#e2e8f0', 0.6), fg: toColor('#64748b') }
      ];

      const requests = [];

      for (let i = existingConditionalFormats.length - 1; i >= 0; i -= 1) {
        requests.push({
          deleteConditionalFormatRule: {
            sheetId: targetSheetId,
            index: i
          }
        });
      }

      // 先取消已有合并，避免与新的合并范围冲突
      existingMerges.forEach((mergeRange) => {
        if (!mergeRange) return;
        const safeRange = mergeRange.sheetId ? mergeRange : { sheetId: targetSheetId, ...mergeRange };
        requests.push({
          unmergeCells: { range: safeRange }
        });
      });

      dates.forEach((_, idx) => {
        const startCol = 1 + idx * 4;
        requests.push({
          mergeCells: {
            range: {
              sheetId: targetSheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: startCol,
              endColumnIndex: startCol + 4
            },
            mergeType: 'MERGE_ALL'
          }
        });
      });

      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: targetSheetId,
            gridProperties: {
              frozenRowCount: 2,
              frozenColumnCount: 1
            }
          },
          fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
        }
      });

      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: targetSheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 1
          },
          properties: { pixelSize: 90 },
          fields: 'pixelSize'
        }
      });

      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: targetSheetId,
            dimension: 'COLUMNS',
            startIndex: 1,
            endIndex: colCount
          },
          properties: { pixelSize: 72 },
          fields: 'pixelSize'
        }
      });

      requests.push({
        repeatCell: {
          range: {
            sheetId: targetSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: colCount
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: headerBg,
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              textFormat: { bold: true, fontSize: 11 }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'
        }
      });

      requests.push({
        repeatCell: {
          range: {
            sheetId: targetSheetId,
            startRowIndex: 1,
            endRowIndex: 2,
            startColumnIndex: 0,
            endColumnIndex: colCount
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: subHeaderBg,
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              textFormat: { bold: true, fontSize: 10 }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'
        }
      });

      if (allRows.length > 2) {
        requests.push({
          repeatCell: {
            range: {
              sheetId: targetSheetId,
              startRowIndex: 2,
              endRowIndex: allRows.length,
              startColumnIndex: 0,
              endColumnIndex: 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: nameColBg,
                horizontalAlignment: 'LEFT',
                verticalAlignment: 'MIDDLE',
                textFormat: { bold: true }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'
          }
        });

        requests.push({
          repeatCell: {
            range: dataRange,
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE'
              }
            },
            fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)'
          }
        });

        statusFormats.forEach((rule, idx) => {
          requests.push({
            addConditionalFormatRule: {
              index: idx,
              rule: {
                ranges: [dataRange],
                booleanRule: {
                  condition: {
                    type: 'TEXT_EQ',
                    values: [{ userEnteredValue: rule.value }]
                  },
                  format: {
                    backgroundColor: rule.bg,
                    textFormat: {
                      foregroundColor: rule.fg
                    }
                  }
                }
              }
            }
          });
        });
      }

      if (requests.length) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: { requests }
        });
      }

      // 添加单元格备注（打卡详情）
      if (cellNotes.length > 0) {
        const noteRequests = cellNotes.map(({ row, col, note }) => ({
          updateCells: {
            range: {
              sheetId: targetSheetId,
              startRowIndex: row,
              endRowIndex: row + 1,
              startColumnIndex: col,
              endColumnIndex: col + 1
            },
            rows: [{
              values: [{
                note: note
              }]
            }],
            fields: 'note'
          }
        }));

        // 分批处理，避免请求过大
        const batchSize = 100;
        for (let i = 0; i < noteRequests.length; i += batchSize) {
          const batch = noteRequests.slice(i, i + batchSize);
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: { requests: batch }
          });
        }
        console.log(`[Checkin] 已添加 ${cellNotes.length} 个单元格备注`);
      }
    }

    return { success: true, rows: allRows.length, cols: colCount, notes: cellNotes.length };
  }

  /**
   * 列号转字母（1->A, 27->AA）
   */
  columnToLetter(col) {
    let letter = '';
    while (col > 0) {
      const mod = (col - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      col = Math.floor((col - 1) / 26);
    }
    return letter;
  }
}

module.exports = { GoogleService, AuthError };
