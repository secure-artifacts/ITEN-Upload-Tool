const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { exec, execFile } = require('child_process');
const Store = require('electron-store');
const { scanFolder } = require('./services/fileScanner');
const { FileNamer } = require('./services/fileNamer');
const { GoogleService } = require('./services/googleService');
const { MediaService } = require('./services/mediaService');
const { StateStore } = require('./services/stateStore');
const { UploadController } = require('./services/uploadController');

const AiNamingService = require('./services/aiNamingService');
const firebaseService = require('./services/firebaseService');
const { autoUpdater } = require('electron-updater');
const { ProfileManager } = require('./services/profileManager');


const os = require('os');
const DEFAULT_DOWNLOAD_DIR = path.join(os.homedir() || process.cwd(), 'Downloads', 'ITEN媒体');

const isDev = process.env.NODE_ENV === 'development';
let isQuitting = false; // 🔴 标记应用是否正在退出

// 🔴 全局抑制 EPIPE 错误（应用关闭时 stdout/stderr 管道断开导致的 console.log 写入失败）
process.stdout?.on?.('error', (err) => { if (err.code !== 'EPIPE') throw err; });
process.stderr?.on?.('error', (err) => { if (err.code !== 'EPIPE') throw err; });

const DEFAULT_FOLDER_PATTERN = '{{customDate}}-{{submitter}}-{{admin}}';
const APP_DATA_DIR_NAME = 'wcmg-auto-tool';
const LEGACY_APP_DATA_DIRS = ['1113'];
const MIN_ZOOM_FACTOR = 0.7;
const MAX_ZOOM_FACTOR = 1.3;

const defaultConfig = {
  clientId: '',
  clientSecret: '',
  redirectPort: 42813,
  driveFolderId: '',
  sheetId: '',
  sheetRange: 'Uploads!A:J',
  reviewSheetName: '审核记录',
  reviewRange: '审核记录',
  categorySheetName: '数据验证',
  categoryRange: '数据验证!A2:C',
  softwareSheetId: '',
  softwareSheetRange: 'Software!A:K',
  softwareSubmissionRange: 'SoftwareSubmissions!A:S',
  softwareAdminRange: 'SoftwareAdmins!A:A',
  softwareSubmitUrl: '',
  softwareAdmins: [],
  renamePattern: '{{country}}-{{customDate}}-{{subject}}-{{submitter}}-{{admin}}-{{counter}}',
  folderPattern: DEFAULT_FOLDER_PATTERN,
  dateFormat: 'YYYYMMDD-hhmmss',
  counterStart: 1,
  counterStep: 1,
  counterPadding: 3,
  timezone: 'local',
  customTextDefs: [],
  customTextGlobals: {},
  namingPresets: [],
  folderNamingPresets: [],
  zoomFactor: 1
  ,
  mediaDownloadDir: DEFAULT_DOWNLOAD_DIR
};

function getConfigRoot() {
  const home = os.homedir() || process.cwd();
  const resolvePath = (folderName) => {
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', folderName);
    }
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), folderName);
    }
    return path.join(home, '.config', folderName);
  };

  const targetPath = resolvePath(APP_DATA_DIR_NAME);
  if (fs.existsSync(targetPath)) {
    return targetPath;
  }

  for (const legacyName of LEGACY_APP_DATA_DIRS) {
    if (legacyName === APP_DATA_DIR_NAME) {
      continue;
    }
    const legacyPath = resolvePath(legacyName);
    if (fs.existsSync(legacyPath)) {
      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.renameSync(legacyPath, targetPath);
        return targetPath;
      } catch (error) {
        console.warn('Failed to migrate legacy config directory', error);
        return legacyPath;
      }
    }
  }

  return targetPath;
}

const configRoot = getConfigRoot();
fs.mkdirSync(configRoot, { recursive: true });

// ========== 多用户 Profile 管理 ==========
const profileManager = new ProfileManager(configRoot);

// 🔴 服务实例使用 let，支持 Profile 切换时重新初始化
let store = null;
let googleService = null;
let mediaService = null;
let stateStore = null;
const aiNamingService = new AiNamingService();

/**
 * 🔴 切换到指定 Profile 并重新初始化所有服务
 * @param {string} profileId - Profile ID
 * @returns {{profileId: string, meta: Object}}
 */
function switchToProfile(profileId) {
  console.log(`[Main] 切换到 Profile: ${profileId}`);
  const result = profileManager.switchProfile(profileId);

  // 重新初始化所有用户级服务
  store = result.store;
  googleService = new GoogleService(store, defaultConfig);
  mediaService = new MediaService(googleService, store);
  stateStore = new StateStore('upload-state.json', result.configRoot);
  googleService.onFileUploaded = (fileId) => stateStore.add(fileId);
  googleService.setFirebaseService(firebaseService);
  googleService.setAiNamingService(aiNamingService);

  // 同步 Firebase 的用户邮箱
  if (googleService.hasTokens()) {
    const accessToken = googleService.getAccessToken();
    const userEmail = googleService.getCurrentUserEmail();
    if (accessToken) {
      firebaseService.signInWithGoogleToken(accessToken)
        .then(() => console.log('[Main] Firebase 自动登录成功 (Profile 切换)'))
        .catch(err => console.warn('[Main] Firebase 自动登录失败:', err.message));
    }
    if (userEmail) {
      firebaseService.userEmail = userEmail;
    }
  }

  return { profileId: result.profileId, meta: result.meta };
}

/**
 * 🔴 获取或创建默认 Profile，并完成初始化
 * 兼容旧版本升级：自动迁移旧配置到新 Profile 中
 */
function initializeDefaultProfile() {
  // 尝试迁移旧版数据
  if (!profileManager.hasAnyProfile()) {
    const migrated = profileManager.migrateFromLegacy();
    if (migrated) {
      console.log(`[Main] 旧版数据已迁移到 Profile: ${migrated.displayName}`);
      return switchToProfile(migrated.id);
    }
    // 没有旧数据也没有任何 Profile，返回 null 让前端弹出创建界面
    return null;
  }

  // 有 Profile，尝试加载上次使用的
  const lastId = profileManager.getLastProfileId();
  if (lastId) {
    try {
      return switchToProfile(lastId);
    } catch (e) {
      console.warn('[Main] 加载上次 Profile 失败:', e.message);
    }
  }

  // 回退到第一个可用的 Profile
  const profiles = profileManager.listProfiles();
  if (profiles.length > 0) {
    return switchToProfile(profiles[0].id);
  }

  return null;
}


function clampZoomFactor(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, parsed));
}

function getStoredSlots() {
  const slots = store.get('slots');
  return Array.isArray(slots) ? slots : [];
}

function saveSlots(slots) {
  if (Array.isArray(slots)) {
    store.set('slots', slots);
  }
  return getStoredSlots();
}

function getStoredPreferences() {
  const prefs = store.get('preferences');
  if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
    return prefs;
  }
  return {};
}

function savePreferences(next = {}) {
  if (!next || typeof next !== 'object') {
    return getStoredPreferences();
  }
  const merged = { ...getStoredPreferences(), ...next };
  store.set('preferences', merged);
  return merged;
}

let mainWindow;
let currentUpload = null;
let notificationWindow = null;
let groupMediaWindow = null;
let notificationQueue = [];
let activeNotification = null;
let notificationWindowReady = false;
let currentZoomFactor = 1;

app.on('before-quit', async () => {
  // 清理 Firebase 资源并同步剩余数据
  if (firebaseService.isReady()) {
    await firebaseService.cleanup();
  }
});

function applyZoomFactor(zoom) {
  currentZoomFactor = clampZoomFactor(zoom);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomFactor(currentZoomFactor);
  }
}

function broadcast(channel, payload) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  });
}

function broadcastUploadState(state) {
  broadcast('upload:state', { state });
}

function openInChrome(url) {
  if (!url) {
    return Promise.resolve(false);
  }
  const platform = process.platform;
  return new Promise((resolve, reject) => {
    if (platform === 'darwin') {
      execFile('open', ['-a', 'Google Chrome', url], (error) => {
        if (error) {
          shell.openExternal(url).then(() => resolve(true)).catch((err) => reject(err));
        } else {
          resolve(true);
        }
      });
    } else if (platform === 'win32') {
      execFile('cmd', ['/c', 'start', '', 'chrome', url], (error) => {
        if (error) {
          shell.openExternal(url).then(() => resolve(true)).catch((err) => reject(err));
        } else {
          resolve(true);
        }
      });
    } else {
      execFile('google-chrome', [url], (error) => {
        if (error) {
          shell.openExternal(url).then(() => resolve(true)).catch((err) => reject(err));
        } else {
          resolve(true);
        }
      });
    }
  });
}

function getConfig() {
  const stored = store.get('config') || {};
  const merged = { ...defaultConfig, ...stored };
  merged.zoomFactor = clampZoomFactor(merged.zoomFactor ?? defaultConfig.zoomFactor);
  googleService.setConfig(merged);
  aiNamingService.setConfig(merged);
  return merged;
}

function saveConfig(nextConfig) {
  const merged = { ...defaultConfig, ...nextConfig };
  merged.zoomFactor = clampZoomFactor(merged.zoomFactor ?? defaultConfig.zoomFactor);
  store.set('config', merged);
  googleService.setConfig(merged);
  aiNamingService.setConfig(merged);
  return merged;
}

const SECTION_DEFAULTS = {
  basic: () => ({
    clientId: '',
    clientSecret: '',
    redirectPort: defaultConfig.redirectPort,
    driveFolderId: '',
    mediaDownloadDir: defaultConfig.mediaDownloadDir,
    sheetId: '',
    sheetRange: defaultConfig.sheetRange,
    reviewRange: defaultConfig.reviewRange,
    reviewSheetName: defaultConfig.reviewSheetName,
    categoryRange: defaultConfig.categoryRange,
    categorySheetName: defaultConfig.categorySheetName,
    softwareSheetId: defaultConfig.softwareSheetId,
    softwareSheetRange: defaultConfig.softwareSheetRange,
    softwareSubmissionRange: defaultConfig.softwareSubmissionRange,
    softwareAdminRange: defaultConfig.softwareAdminRange,
    softwareSubmitUrl: defaultConfig.softwareSubmitUrl,
    softwareAdmins: [],
    reviewTempFolder: '',
    readyFlag: '是',
    zoomFactor: 1
  }),
  naming: () => ({
    renamePattern: defaultConfig.renamePattern,
    folderPattern: defaultConfig.folderPattern,
    customTextDefs: [],
    customTextGlobals: {},
    namingPresets: [],
    folderNamingPresets: [],
    dateFormat: defaultConfig.dateFormat,
    counterStart: defaultConfig.counterStart,
    counterPadding: defaultConfig.counterPadding,
    counterStep: defaultConfig.counterStep,
    timezone: defaultConfig.timezone,
    aiNamingEnabled: false,
    aiNamingApiKey: '',
    aiNamingKeywordCount: 3,
    aiNamingSeparator: '_',
    aiNamingKeywords: ''
  }),
  notification: () => ({
    notificationMode: 'speech',
    notificationSoundReview: '',
    notificationSoundSuggestion: '',
    notificationSoundApproved: '',
    enableFloatingNotifications: true
  }),
  'notice-board': () => ({
    noticeBoardDocId: '',
    noticeBoardAutoOpen: false
  }),
  software: () => ({
    softwareSheetId: defaultConfig.softwareSheetId,
    softwareSheetRange: defaultConfig.softwareSheetRange,
    softwareSubmissionRange: defaultConfig.softwareSubmissionRange,
    softwareAdminRange: defaultConfig.softwareAdminRange,
    softwareSubmitUrl: defaultConfig.softwareSubmitUrl,
    softwareAdmins: []
  })
};

function resetConfigSection(section) {
  const resolver = SECTION_DEFAULTS[section];
  if (!resolver) {
    return getConfig();
  }
  const current = getConfig();
  const merged = saveConfig({ ...current, ...resolver() });
  return merged;
}

function createWindow() {
  const initialConfig = getConfig();

  // 定义最小窗口尺寸
  const MIN_WIDTH = 1106;
  const MIN_HEIGHT = 760;

  // 获取保存的窗口状态，并确保不小于最小值
  const savedState = profileManager.getWindowState();
  const windowState = {
    width: Math.max(savedState.width || 1362, MIN_WIDTH),
    height: Math.max(savedState.height || 960, MIN_HEIGHT),
    x: savedState.x,
    y: savedState.y
  };

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: '美工自动入库填表',
    icon: path.join(app.getAppPath(), 'icon.jpeg'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  // 显式设置最小尺寸约束，确保生效
  mainWindow.setMinimumSize(MIN_WIDTH, MIN_HEIGHT);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });

      // 过滤控制台中的无关错误和警告
      mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        // 过滤 Google Docs iframe 相关的错误
        const ignoredPatterns = [
          'chrome-extension://',
          'source map',
          'ERR_FILE_NOT_FOUND',
          'ERR_HTTP_RESPONSE_CODE_FAILURE',
          'DevTools failed to load',
          'docs.google.com/static/document/client',
          'filesystem:https://docs.google.com',
          'contacts.google.com',
          'frame-ancestors'
        ];

        const shouldIgnore = ignoredPatterns.some(pattern =>
          message.toLowerCase().includes(pattern.toLowerCase())
        );

        if (shouldIgnore) {
          event.preventDefault();
        }
      });
    }
  });

  // 保存窗口状态的函数
  let saveWindowStateTimeout = null;
  const saveWindowState = () => {
    // 使用防抖，避免频繁保存
    clearTimeout(saveWindowStateTimeout);
    saveWindowStateTimeout = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }

      // 不保存最大化或最小化状态下的尺寸
      if (mainWindow.isMaximized() || mainWindow.isMinimized() || mainWindow.isFullScreen()) {
        return;
      }

      const bounds = mainWindow.getBounds();
      profileManager.setWindowState({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      });
    }, 500);
  };

  // 监听窗口大小和位置变化
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

  applyZoomFactor(initialConfig?.zoomFactor ?? defaultConfig.zoomFactor);
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function createNotificationWindow() {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    return notificationWindow;
  }
  notificationWindowReady = false;
  notificationWindow = new BrowserWindow({
    width: 500,
    height: 620,
    resizable: true,        // 🔴 启用拖拽调整大小
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    frame: false,
    show: false,
    minWidth: 360,          // 🔴 最小宽度
    minHeight: 400,         // 🔴 最小高度
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  notificationWindow.setMenuBarVisibility(false);
  notificationWindow.loadFile(path.join(__dirname, '../renderer/notification.html'));
  notificationWindow.on('close', (event) => {
    // 🔴 修复：如果应用正在退出，允许窗口关闭
    if (!isQuitting) {
      event.preventDefault();
      notificationWindow.hide();
    }
  });
  notificationWindow.on('closed', () => {
    notificationWindow = null;
    notificationWindowReady = false;
  });
  return notificationWindow;
}

function sendFloatingPayload(payload) {
  if (!notificationWindow || !payload) {
    return;
  }

  // 根据 position 参数设置窗口位置
  const position = payload.position || 'topRight';
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // 🔴 根据屏幕分辨率自动计算最佳尺寸（增大版本）
  let windowWidth, windowHeight;

  if (screenWidth <= 1366) {
    // 小屏幕 (13寸笔记本等)
    windowWidth = 380;
    windowHeight = 480;
  } else if (screenWidth <= 1920) {
    // 中等屏幕 (1080p)
    windowWidth = 440;
    windowHeight = 560;
  } else if (screenWidth <= 2560) {
    // 大屏幕 (1440p/2K / Retina)
    windowWidth = 500;
    windowHeight = 620;
  } else {
    // 超大屏幕 (4K+)
    windowWidth = 560;
    windowHeight = 700;
  }

  const margin = 20;

  let x, y;
  switch (position) {
    case 'bottomRight':
      x = screenWidth - windowWidth - margin;
      y = screenHeight - windowHeight - margin;
      break;
    case 'center':
      x = Math.round((screenWidth - windowWidth) / 2);
      y = Math.round((screenHeight - windowHeight) / 2);
      break;
    case 'topRight':
    default:
      x = screenWidth - windowWidth - margin;
      y = margin;
      break;
  }

  // 🔴 调整窗口尺寸和位置
  notificationWindow.setSize(windowWidth, windowHeight);
  notificationWindow.setPosition(x, y);
  notificationWindow.webContents.send('notification:update', payload);
  notificationWindow.show();
  notificationWindow.focus();
}

function processNotificationQueue() {
  if (activeNotification || !notificationQueue.length) {
    return;
  }
  activeNotification = notificationQueue.shift();
  createNotificationWindow();
  if (notificationWindowReady) {
    sendFloatingPayload(activeNotification);
  }
}

function completeNotificationPayload() {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.hide();
  }
  activeNotification = null;
  processNotificationQueue();
}

// ========== 开机自启动功能 ==========

/**
 * 获取当前开机自启动状态
 */
ipcMain.handle('app:get-login-item-settings', () => {
  try {
    const settings = app.getLoginItemSettings();
    return {
      openAtLogin: settings.openAtLogin,
      openAsHidden: settings.openAsHidden || false
    };
  } catch (error) {
    console.error('[App] 获取开机自启动状态失败:', error);
    return { openAtLogin: false, openAsHidden: false };
  }
});

/**
 * 设置开机自启动
 * @param {boolean} openAtLogin - 是否开机启动
 * @param {boolean} openAsHidden - 启动时是否隐藏窗口（macOS）
 */
ipcMain.handle('app:set-login-item-settings', async (_event, { openAtLogin, openAsHidden = false }) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(openAtLogin),
      openAsHidden: Boolean(openAsHidden),
      // macOS 专用：打开时以隐藏方式启动
      ...(process.platform === 'darwin' ? { openAsHidden: Boolean(openAsHidden) } : {})
    });

    const newSettings = app.getLoginItemSettings();
    console.log(`[App] 开机自启动已${newSettings.openAtLogin ? '启用' : '禁用'}`);

    return {
      success: true,
      openAtLogin: newSettings.openAtLogin,
      openAsHidden: newSettings.openAsHidden || false
    };
  } catch (error) {
    console.error('[App] 设置开机自启动失败:', error);
    return { success: false, error: error.message };
  }
});

function setupAutoUpdater() {
  autoUpdater.autoDownload = false; // Manually trigger download
  autoUpdater.logger = require('console');

  // 对于未签名的 macOS 应用，需要禁用差异下载（差异下载需要签名验证）
  // 这会导致下载完整的更新包而不是差异包
  if (process.platform === 'darwin') {
    autoUpdater.disableDifferentialDownload = true;
  }

  // 禁用自动安装，在 macOS 上未签名应用无法自动安装
  autoUpdater.autoInstallOnAppQuit = false;

  // Event: Checking for update
  autoUpdater.on('checking-for-update', () => {
    if (mainWindow) mainWindow.webContents.send('updater:status', 'checking');
  });

  // Event: Update available
  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('updater:status', 'available', info);
  });

  // Event: Update not available
  autoUpdater.on('update-not-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('updater:status', 'not-available', info);
  });

  // Event: Error
  autoUpdater.on('error', (err) => {
    const errorMessage = err.message || String(err);

    // 检测 macOS 代码签名验证错误
    if (process.platform === 'darwin' &&
      (errorMessage.includes('Code signature') ||
        errorMessage.includes('指定的代码要求') ||
        errorMessage.includes('code requirements'))) {
      // 对于未签名的 macOS 应用，提供手动下载选项
      if (mainWindow) {
        mainWindow.webContents.send('updater:status', 'signature-error', {
          message: '由于应用未签名，无法自动安装更新。请手动下载安装。',
          downloadUrl: 'https://gorgeous-kashata-c9da30.netlify.app/'
        });
      }
    } else {
      if (mainWindow) mainWindow.webContents.send('updater:status', 'error', errorMessage);
    }
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('updater:status', 'downloading', progressObj);
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('updater:status', 'downloaded', info);
  });

  // IPC: Check for updates manually
  ipcMain.handle('updater:check', () => {
    try {
      if (isDev) {
        // In dev, we can force a check if we configure it, but usually it errors or does nothing.
        // autoUpdater.forceDevUpdateConfig = true; 
        // For now, just log
        console.log('Check for updates triggered (Dev mode)');
        return autoUpdater.checkForUpdates();
      }
      return autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Update check failed', error);
      return null;
    }
  });

  // IPC: Start download
  ipcMain.handle('updater:download', () => {
    return autoUpdater.downloadUpdate();
  });

  // IPC: Quit and Install
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall();
  });

  // 应用启动后 5 秒自动检查更新（非开发模式）
  if (!isDev) {
    setTimeout(() => {
      console.log('[AutoUpdater] 自动检查更新...');
      autoUpdater.checkForUpdates().catch(err => {
        console.warn('[AutoUpdater] 自动检查更新失败:', err.message);
      });
    }, 5000);
  }
}


app.whenReady().then(() => {
  // 🔴 第一步：初始化 Profile 系统
  const initialProfile = initializeDefaultProfile();
  if (initialProfile) {
    console.log(`[Main] 已加载 Profile: ${initialProfile.meta?.displayName || initialProfile.profileId}`);
  } else {
    console.log('[Main] 无可用 Profile，等待用户创建');
  }

  // 如果有 Profile，加载配置
  if (store) {
    getConfig();
  }

  createWindow();
  setupAutoUpdater();

  // 初始化 Firebase 服务（支持团队自定义 Firebase 配置）
  const userConfig = store ? getConfig() : defaultConfig;
  const customFirebaseConfig = userConfig.firebase || null;
  firebaseService.initialize(customFirebaseConfig);
  if (googleService) {
    firebaseService.setGoogleService(googleService);
  }

  // 如果已有 Google token，自动登录 Firebase
  if (googleService && googleService.hasTokens()) {
    const accessToken = googleService.getAccessToken();
    const userEmail = googleService.getCurrentUserEmail();

    if (accessToken) {
      firebaseService.signInWithGoogleToken(accessToken)
        .then(() => console.log('[Main] Firebase 自动登录成功'))
        .catch(err => console.warn('[Main] Firebase 自动登录失败:', err.message));
    }

    // 关键：无论 Firebase 认证是否成功，都设置用户邮箱
    if (userEmail) {
      firebaseService.userEmail = userEmail;
      console.log('[Main] Firebase userEmail 已设置:', userEmail);
    }
  }

  // 设置 Firebase 事件回调，用于向渲染进程推送实时更新
  firebaseService.setEventCallback((update) => {
    broadcast('firebase:review-update', update);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 🔴 修复：在应用退出前销毁通知窗口，避免阻止退出
app.on('before-quit', () => {
  isQuitting = true;
  // 强制销毁通知窗口
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.destroy();
    notificationWindow = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('dialog:pick-folder', async () => {
  const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow;
  const result = await dialog.showOpenDialog(targetWindow, {
    title: '选择待上传目录',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('files:scan', async (_event, folderPath) => {
  try {
    const files = await scanFolder(folderPath);
    return files;
  } catch (error) {
    throw new Error(`扫描目录失败: ${error.message}`);
  }
});

ipcMain.handle('files:preview-renames', async (_event, payload) => {
  const config = getConfig();
  const renameOptions = {
    pattern: payload?.pattern || config.renamePattern,
    dateFormat: config.dateFormat,
    counterPadding: config.counterPadding,
    timezone: config.timezone
  };
  const namer = new FileNamer(renameOptions);
  const counterStart = payload.counterStart || config.counterStart;
  return (payload.files || []).map((file, index) => {
    if (file.isReference) {
      return {
        ...file,
        newName: file.name
      };
    }
    return {
      ...file,
      newName: namer.buildName(file, payload.metadata || {}, counterStart + index)
    };
  });
});

const LETTER_PREFIXES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function insertPrefixBeforeCounter(name, prefix) {
  if (!name || !prefix) {
    return name;
  }
  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex !== -1 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex !== -1 ? name.slice(dotIndex) : '';
  const match = base.match(/^(.*?)(\d+)$/);
  if (match) {
    return `${match[1]}${prefix}${match[2]}${ext}`;
  }
  return `${prefix}${name}`;
}

ipcMain.handle('files:rename-local', async (_event, payload = []) => {
  if (!Array.isArray(payload) || !payload.length) {
    return { renamed: [], errors: [] };
  }
  const renamed = [];
  const errors = [];

  const ensureUniqueName = async (directory, desiredName) => {
    let attempt = -1;
    while (attempt < LETTER_PREFIXES.length) {
      const candidate =
        attempt < 0 ? desiredName : insertPrefixBeforeCounter(desiredName, LETTER_PREFIXES[attempt]);
      const targetPath = path.join(directory, candidate);
      try {
        await fs.promises.access(targetPath, fs.constants.F_OK);
        attempt += 1;
        continue;
      } catch (accessError) {
        if (accessError.code === 'ENOENT') {
          return { targetPath, finalName: candidate };
        }
        throw accessError;
      }
    }
    const error = new Error('无法生成唯一文件名');
    error.code = 'EEXIST';
    throw error;
  };

  for (const entry of payload) {
    try {
      if (!entry?.source || !entry?.newName) {
        throw new Error('参数不完整');
      }
      const source = entry.source;
      const directory = entry.directory || path.dirname(source);
      const currentName = path.basename(source);
      const desiredName = entry.newName;
      if (currentName === desiredName) {
        renamed.push({
          id: entry.id,
          slotId: entry.slotId,
          path: source,
          name: desiredName
        });
        continue;
      }
      await fs.promises.access(source, fs.constants.F_OK);
      const { targetPath, finalName } = await ensureUniqueName(directory, desiredName);
      await fs.promises.rename(source, targetPath);
      renamed.push({
        id: entry.id,
        slotId: entry.slotId,
        path: targetPath,
        name: finalName
      });
    } catch (error) {
      const payloadError = {
        id: entry?.id,
        slotId: entry?.slotId,
        source: entry?.source,
        message: error.message || '重命名失败'
      };
      if (error.code) {
        payloadError.code = error.code;
      }
      errors.push(payloadError);
    }
  }

  return { renamed, errors };
});

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('browser:open', async (_event, url) => {
  return openInChrome(url);
});

ipcMain.handle('window:set-zoom', async (_event, zoom) => {
  applyZoomFactor(zoom);
  return { zoomFactor: currentZoomFactor };
});



ipcMain.handle('software:fetch', async (_event, options = {}) => {
  return googleService.fetchSoftwareDirectory(options);
});

ipcMain.handle('software:pending', async (_event, options = {}) => {
  return googleService.fetchSoftwareSubmissions(options);
});

ipcMain.handle('software:review', async (_event, payload = {}) => {
  return googleService.reviewSoftwareSubmission(payload);
});

ipcMain.handle('config:load', async () => {
  const config = store ? getConfig() : defaultConfig;
  const currentProfileId = profileManager.getCurrentProfileId();
  const profileMeta = currentProfileId ? profileManager.getProfileMeta(currentProfileId) : null;
  return {
    config,
    slots: getStoredSlots(),
    preferences: getStoredPreferences(),
    metadataOptions: googleService ? googleService.getMetadataOptions() : {},
    authorized: googleService ? googleService.hasTokens() : false,
    userEmail: googleService ? googleService.getCurrentUserEmail() : '',
    // 🔴 Profile 信息
    profile: {
      id: currentProfileId,
      displayName: profileMeta?.displayName || '',
      email: profileMeta?.email || '',
      hasProfile: !!currentProfileId
    }
  };
});

ipcMain.handle('config:save', async (_event, incoming) => {
  return saveConfig(incoming);
});

ipcMain.handle('config:export', async (_event, payload = null, fileName = null) => {
  const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow;
  const defaultFileName = fileName || 'config-export.json';
  const result = await dialog.showSaveDialog(targetWindow, {
    title: '导出基础配置',
    defaultPath: path.join(app.getPath('documents'), defaultFileName),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) {
    return { saved: false };
  }
  const configPayload = payload && typeof payload === 'object' ? payload : null;
  const content = JSON.stringify(
    configPayload && configPayload.config
      ? configPayload
      : {
        version: 1,
        exportedAt: new Date().toISOString(),
        config: getConfig(),
        slots: getStoredSlots(),
        preferences: getStoredPreferences()
      },
    null,
    2
  );
  await fs.promises.writeFile(result.filePath, content, 'utf8');
  return { saved: true, path: result.filePath };
});

ipcMain.handle('config:import', async () => {
  const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow;
  const result = await dialog.showOpenDialog(targetWindow, {
    title: '导入基础配置',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths.length) {
    return { imported: false };
  }
  try {
    const fileContent = await fs.promises.readFile(result.filePaths[0], 'utf8');
    const parsed = JSON.parse(fileContent);
    const incomingConfig = parsed?.config || parsed;
    const saved = saveConfig(incomingConfig);
    const incomingSlots = Array.isArray(parsed?.slots) ? parsed.slots : undefined;
    if (incomingSlots) {
      saveSlots(incomingSlots);
    }
    const incomingPreferences =
      parsed?.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : undefined;
    if (incomingPreferences) {
      savePreferences(incomingPreferences);
    }
    return {
      imported: true,
      config: saved,
      slots: incomingSlots || getStoredSlots(),
      preferences: incomingPreferences || getStoredPreferences()
    };
  } catch (error) {
    throw new Error(`导入失败：${error.message}`);
  }
});

ipcMain.handle('config:reset-section', async (_event, section) => {
  return resetConfigSection(section);
});

ipcMain.handle('slots:save', async (_event, slots) => {
  return saveSlots(slots);
});

ipcMain.handle('preferences:save', async (_event, next) => {
  return savePreferences(next);
});

// 🔴 导出团队配置文件（不含个人 Token）
ipcMain.handle('config:export-team', async () => {
  if (!store) throw new Error('配置未初始化');

  const config = getConfig();
  const slots = store.get('slots', []);
  const prefs = store.get('preferences', {});

  // 构建团队配置（排除个人敏感信息）
  const teamConfig = {
    _type: 'iten-team-config',
    _version: '1.0',
    _exportedAt: new Date().toISOString(),
    config: {
      clientId: config.clientId || '',
      clientSecret: config.clientSecret || '',
      redirectPort: config.redirectPort || 8899,
      driveFolderId: config.driveFolderId || '',
      sheetId: config.sheetId || '',
      sheetRange: config.sheetRange || '',
      reviewRange: config.reviewRange || '',
      categoryRange: config.categoryRange || '',
      fileReviewRange: config.fileReviewRange || '',
      reviewTempDriveFolderId: config.reviewTempDriveFolderId || '',
      renamePattern: config.renamePattern || '',
      folderPattern: config.folderPattern || '',
      noticeBoardDocId: config.noticeBoardDocId || '',
      aiNaming: config.aiNaming || {},
      firebase: config.firebase || null
      // 注意：不包含 googleTokens, googleTokensExpiry 等个人信息
    },
    slots,
    preferences: prefs
  };

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出团队配置文件',
    defaultPath: `iten-team-config-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (!filePath) return { exported: false };

  fs.writeFileSync(filePath, JSON.stringify(teamConfig, null, 2), 'utf-8');
  return { exported: true, filePath };
});

// ========== 🔴 多用户 Profile 管理 IPC ==========

ipcMain.handle('profile:list', async () => {
  return profileManager.listProfiles();
});

ipcMain.handle('profile:create', async (_event, displayName) => {
  try {
    const profile = profileManager.createProfile(displayName);
    return { success: true, profile };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('profile:switch', async (_event, profileId) => {
  try {
    const result = switchToProfile(profileId);
    getConfig(); // 加载新 Profile 的配置

    // 更新 Firebase 的 GoogleService 引用
    firebaseService.setGoogleService(googleService);

    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('profile:delete', async (_event, profileId) => {
  return profileManager.deleteProfile(profileId);
});

ipcMain.handle('profile:rename', async (_event, profileId, newName) => {
  return profileManager.renameProfile(profileId, newName);
});

ipcMain.handle('profile:get-current', async () => {
  const currentId = profileManager.getCurrentProfileId();
  if (!currentId) return { hasProfile: false };
  const meta = profileManager.getProfileMeta(currentId);
  return {
    hasProfile: true,
    id: currentId,
    displayName: meta?.displayName || currentId,
    email: meta?.email || ''
  };
});


// ── AI 智能命名 ──
ipcMain.handle('ai-naming:analyze-file', async (_event, filePath, context) => {
  try {
    const keywords = await aiNamingService.analyzeLocalFile(filePath, context || {});
    return { success: true, keywords };
  } catch (err) {
    return { success: false, error: err.message, keywords: [] };
  }
});

ipcMain.handle('ai-naming:status', async () => {
  return aiNamingService.getStatus();
});

ipcMain.handle('ai-naming:test-key', async (_event, apiKey) => {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const result = await new Promise((resolve, reject) => {
      const https = require('https');
      https.get(url, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`API 错误 (${res.statusCode})`));
          } else {
            resolve(JSON.parse(data));
          }
        });
      }).on('error', reject);
    });
    const models = (result.models || []).map(m => m.name).filter(n => n.includes('gemini'));
    return { success: true, models };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('google:open-drive', async (_event, folderId) => {
  if (!folderId) {
    return false;
  }
  const url = `https://drive.google.com/drive/folders/${folderId}`;
  await openInChrome(url);
  return true;
});

ipcMain.handle('notice-board:check-update', async (_event, documentId) => {
  try {
    return await googleService.getDocumentModifiedTime(documentId);
  } catch (error) {
    console.warn('Failed to check notice board update:', error);
    return null;
  }
});

ipcMain.handle('google:auth', async (event, runtimeConfig) => {
  const merged = saveConfig({ ...getConfig(), ...runtimeConfig });
  const parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const { shell } = require('electron');

  // 在系统浏览器中打开授权页面
  const openAuthInBrowser = (targetUrl, onUserClosed) => {
    // 创建一个提示窗口，告诉用户在浏览器中完成授权
    const promptWindow = new BrowserWindow({
      parent,
      modal: process.platform !== 'darwin',
      show: true,
      width: 420,
      height: 280,
      resizable: false,
      maximizable: false,
      minimizable: false,
      closable: true,
      autoHideMenuBar: true,
      alwaysOnTop: true,
      title: '正在登录 Google...',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    // 显示等待提示页面
    const waitingHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 24px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { margin: 0 0 12px; font-size: 20px; font-weight: 500; }
    p { margin: 0; font-size: 14px; opacity: 0.9; text-align: center; padding: 0 20px; }
    .hint { margin-top: 16px; font-size: 12px; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>请在浏览器中完成授权</h2>
  <p>已在默认浏览器中打开 Google 登录页面</p>
  <p class="hint">授权完成后此窗口将自动关闭</p>
</body>
</html>`;

    promptWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(waitingHtml)}`);

    // 在默认浏览器中打开授权页面
    shell.openExternal(targetUrl).catch(err => {
      console.error('无法打开浏览器:', err);
    });

    const handleClosed = () => {
      onUserClosed?.();
    };

    promptWindow.on('closed', handleClosed);

    // 返回关闭函数
    return () => {
      promptWindow.removeListener('closed', handleClosed);
      if (!promptWindow.isDestroyed()) {
        promptWindow.close();
      }
    };
  };

  return googleService.startAuthFlow(openAuthInBrowser).then(async (result) => {
    // Google 登录成功后，自动登录 Firebase
    const accessToken = googleService.getAccessToken();
    const userEmail = googleService.getCurrentUserEmail();

    if (accessToken && firebaseService.isReady()) {
      try {
        await firebaseService.signInWithGoogleToken(accessToken);
        console.log('[Main] Firebase 认证成功');
      } catch (err) {
        console.warn('[Main] Firebase 认证失败（将使用测试模式）:', err.message);
      }
    }

    // 关键：无论 Firebase 认证是否成功，都设置用户邮箱
    // 这样 _modifiedBy 可以正确标识操作者，实现 Loopback Suppression
    if (userEmail && firebaseService.isReady()) {
      firebaseService.userEmail = userEmail;
      console.log('[Main] Firebase userEmail 已设置:', userEmail);
    }

    // 🔴 更新当前 Profile 的邮箱信息
    if (userEmail) {
      profileManager.updateCurrentProfileEmail(userEmail);
    }

    return {
      ...result,
      authorized: true,
      config: merged,
      userEmail: userEmail
    };
  });
});

// 登出 Google
ipcMain.handle('google:logout', async () => {
  try {
    googleService.logout();
    return { success: true };
  } catch (error) {
    console.error('登出失败:', error);
    return { success: false, message: error.message };
  }
});

// 获取 Token 状态
ipcMain.handle('google:token-status', async () => {
  try {
    const hasTokens = googleService.hasTokens();
    if (!hasTokens) {
      return {
        authorized: false,
        status: 'not_authorized'
      };
    }

    const isExpired = googleService.isTokenExpired();
    const isExpiringSoon = googleService.isTokenExpiringSoon();

    return {
      authorized: true,
      status: isExpired ? 'expired' : (isExpiringSoon ? 'expiring_soon' : 'valid'),
      userEmail: googleService.getCurrentUserEmail(),
      isExpired,
      isExpiringSoon
    };
  } catch (error) {
    console.error('获取 Token 状态失败:', error);
    return {
      authorized: false,
      status: 'error',
      message: error.message
    };
  }
});

// 手动刷新 Token
ipcMain.handle('google:refresh-token', async () => {
  try {
    await googleService.refreshAccessToken();
    return {
      success: true,
      userEmail: googleService.getCurrentUserEmail()
    };
  } catch (error) {
    console.error('刷新 Token 失败:', error);
    return {
      success: false,
      message: error.message,
      code: error.code
    };
  }
});

ipcMain.handle('google:upload', async (event, payload) => {
  if (currentUpload?.controller) {
    throw new Error('已有上传任务在进行中，请先完成或停止当前任务');
  }
  const config = getConfig();
  const renameOptions = {
    pattern: payload?.pattern || config.renamePattern,
    dateFormat: config.dateFormat,
    counterStart: config.counterStart,
    counterStep: config.counterStep,
    counterPadding: config.counterPadding,
    timezone: config.timezone
  };
  const senderWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;

  const forceUploadIds = new Set(payload?.forceUploadIds || []);
  const controller = new UploadController();
  currentUpload = { controller, window: senderWindow };
  controller.on('state', (state) => {
    broadcastUploadState(state);
  });
  broadcastUploadState('preparing');

  const notify = (message) => {
    if (senderWindow && !senderWindow.isDestroyed()) {
      senderWindow.webContents.send('upload:progress', message);
    }
  };

  const files = (payload?.files || []).filter((file) => {
    if (forceUploadIds.has(file.id)) {
      return true;
    }
    if (stateStore.has(file.id)) {
      notify({
        status: 'skipped',
        phase: 'duplicate-cache',
        slotId: file.slotId,
        fileId: file.id,
        source: file.path,
        message: '已入库，自动跳过'
      });
      return false;
    }
    return true;
  });
  return googleService.uploadFiles(
    files,
    { renameOptions },
    notify,
    controller
  ).finally(() => {
    currentUpload = null;
    broadcastUploadState('idle');
  });
});

ipcMain.handle('categories:fetch', async () => {
  try {
    return await googleService.fetchCategories();
  } catch (error) {
    throw new Error(error.message || '获取分类数据失败');
  }
});

ipcMain.handle('upload:pause', () => {
  if (!currentUpload?.controller) {
    return { state: 'idle' };
  }
  currentUpload.controller.pause();
  return { state: currentUpload.controller.state };
});

ipcMain.handle('upload:resume', () => {
  if (!currentUpload?.controller) {
    return { state: 'idle' };
  }
  currentUpload.controller.resume();
  return { state: currentUpload.controller.state };
});

ipcMain.handle('upload:stop', () => {
  if (!currentUpload?.controller) {
    return { state: 'idle' };
  }
  currentUpload.controller.stop();
  return { state: currentUpload.controller.state };
});

ipcMain.handle('upload:check-duplicates', async (_event, ids = []) => {
  if (!Array.isArray(ids) || !ids.length) {
    return { duplicates: [] };
  }
  const deduped = Array.from(new Set(ids)).filter(Boolean);
  const duplicates = deduped.filter((id) => stateStore.has(id));
  return { duplicates };
});

ipcMain.handle('upload:clear-state', () => {
  try {
    stateStore.clear();
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});
ipcMain.handle('review:fetch', async (_event, options = {}) => {
  return googleService.fetchReviewEntries(options);
});

ipcMain.handle('review:approve', async (_event, payload) => {
  return googleService.approveReviewEntry(payload);
});

ipcMain.handle('review:reject', async (_event, payload) => {
  return googleService.rejectReviewEntry(payload);
});

ipcMain.handle('review:reopen', async (_event, payload) => {
  return googleService.reopenReviewEntry(payload);
});
ipcMain.handle('review:refresh-files', async (_event, payload = {}) => {
  return googleService.refreshReviewFiles(payload);
});
ipcMain.handle('review:sync', async () => {
  return googleService.syncReviewEntries();
});

// 将文件移动到成品文件夹（标记为合格）
ipcMain.handle('review:move-to-finished', async (_event, payload) => {
  return googleService.moveFilesToFinished(payload);
});

// 将文件从成品文件夹移出（取消标记合格）
ipcMain.handle('review:move-from-finished', async (_event, payload) => {
  return googleService.moveFilesFromFinished(payload);
});

// === 新审核流程：按文件记录的 IPC 处理器 ===

// 生成批次 ID
ipcMain.handle('review:generate-batch-id', async (_event, submitter) => {
  return googleService.generateBatchId(submitter);
});

// 按文件写入审核记录
ipcMain.handle('review:append-file-row', async (_event, params) => {
  return googleService.appendFileReviewRow(params);
});

// 获取按文件审核记录
ipcMain.handle('review:fetch-file-entries', async (_event, options) => {
  return googleService.fetchFileReviewEntries(options);
});

// 🚀 按需加载单个批次的参考文件
ipcMain.handle('review:load-reference-files', async (_event, params) => {
  return googleService.loadReferenceFilesForBatch(params);
});

// 更新单个文件审核状态
ipcMain.handle('review:update-file-status', async (_event, params) => {
  return googleService.updateFileReviewStatus(params);
});

// 批量更新文件审核状态
ipcMain.handle('review:batch-update-file-status', async (_event, updates) => {
  return googleService.batchUpdateFileReviewStatus(updates);
});

// 批量更新批次备注（按行号写入）
ipcMain.handle('review:update-batch-note', async (_event, payload = {}) => {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const note = payload.note || '';
  return googleService.batchUpdateFileReviewBatchNote(rows, note);
});

// === Firebase 实时同步 IPC 处理器 ===

// 初始化 Firebase（支持自定义配置）
ipcMain.handle('firebase:initialize', async () => {
  const cfg = store ? getConfig() : defaultConfig;
  return firebaseService.initialize(cfg.firebase || null);
});

// 使用 Google OAuth token 登录 Firebase
ipcMain.handle('firebase:sign-in', async (_event, accessToken) => {
  return firebaseService.signInWithGoogleToken(accessToken);
});

// 开始监听审核数据
ipcMain.handle('firebase:watch-reviews', async (_event, sheetId) => {
  return firebaseService.watchFileReviews(sheetId, null); // 回调通过 broadcast 处理
});

// 停止监听
ipcMain.handle('firebase:stop-watch', async (_event, listenerId) => {
  if (listenerId) {
    return firebaseService.stopWatching(listenerId);
  }
  return firebaseService.stopAllWatching();
});

// 更新单个文件状态（通过 Firebase）
ipcMain.handle('firebase:update-file-status', async (_event, sheetId, rowNumber, data) => {
  return firebaseService.updateFileStatus(sheetId, rowNumber, data);
});

// 批量更新文件状态（通过 Firebase）
ipcMain.handle('firebase:batch-update-file-status', async (_event, sheetId, updates) => {
  return firebaseService.batchUpdateFileStatus(sheetId, updates);
});

// 从 Sheets 导入数据到 Firebase
ipcMain.handle('firebase:import-from-sheets', async (_event, sheetId) => {
  const result = await googleService.fetchFileReviewEntries({ groupByBatch: false });
  if (result && result.length) {
    return firebaseService.importFromSheets(sheetId, result);
  }
  return { success: true, imported: 0 };
});

// 获取 Firebase 中的审核数据
ipcMain.handle('firebase:get-reviews', async (_event, sheetId) => {
  return firebaseService.getFileReviews(sheetId);
});

ipcMain.handle('firebase:set-slot-presets', async (_event, sheetId, slots, submitter) => {
  return firebaseService.setSlotPresets(sheetId, slots, submitter);
});

ipcMain.handle('firebase:get-slot-presets', async (_event, sheetId, submitter) => {
  return firebaseService.getSlotPresets(sheetId, submitter);
});

// 强制同步到 Sheets
ipcMain.handle('firebase:flush-sync', async () => {
  return firebaseService.flushSync();
});

// 检查 Firebase 是否可用
ipcMain.handle('firebase:is-ready', async () => {
  return firebaseService.isReady();
});


// 入库：将合格文件移动到最终目录
ipcMain.handle('review:store-files-to-library', async (_event, params) => {
  return googleService.storeFilesToLibrary(params);
});

// 替换不合格文件
ipcMain.handle('review:replace-rejected-file', async (_event, params) => {
  return googleService.replaceRejectedFile(params);
});

// 添加文件到已提交的批次
ipcMain.handle('review:add-file-to-batch', async (_event, params) => {
  return googleService.addFileToBatch(params);
});

// 更新批次整体状态（手动设置）
ipcMain.handle('review:update-batch-status', async (_event, params) => {
  return googleService.updateBatchStatus(params);
});
// 更新批次设置信息（分类/命名规则/命名元数据）
ipcMain.handle('review:update-batch-metadata', async (_event, params) => {
  return googleService.updateFileReviewBatchMetadata(params);
});

// 同步批次文件（检测云端新增的文件）
ipcMain.handle('review:sync-batch-files', async (_event, params) => {
  return googleService.syncBatchFiles(params);
});

// 检测批次新文件（只检测不添加）
ipcMain.handle('review:check-batch-new-files', async (_event, params) => {
  return googleService.checkBatchNewFiles(params);
});

// 删除审核文件
ipcMain.handle('review:delete-file', async (_event, params) => {
  return googleService.deleteReviewFile(params);
});

// 上传标注后的图片替换云端文件
ipcMain.handle('review:upload-annotated-image', async (_event, params) => {
  try {
    const { fileId, fileName, imageData, rowNumber } = params;

    if (!fileId || !imageData) {
      return { success: false, error: '缺少必要参数' };
    }

    // 将 base64 图片数据转换为 Buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // 调用 googleService 上传替换文件
    const result = await googleService.uploadAnnotatedImage({
      fileId,
      fileName: fileName || 'annotated_image.png',
      imageBuffer,
      rowNumber
    });

    if (result?.success) {
      try {
        const cacheId = result.fileId || fileId;
        await mediaService.saveAnnotatedThumbnail(cacheId, imageBuffer, [260, 1200]);
      } catch (cacheErr) {
        console.warn('保存标注缩略图缓存失败:', cacheErr);
      }
    }

    return result;
  } catch (error) {
    console.error('上传标注图片失败:', error);
    return { success: false, error: error.message || '上传失败' };
  }
});

ipcMain.handle('notification:show', async (_event, payload = null) => {
  if (!payload) {
    return { queued: false };
  }
  notificationQueue.push(payload);
  processNotificationQueue();
  return { queued: true };
});

ipcMain.on('notification:ready', () => {
  notificationWindowReady = true;
  if (activeNotification) {
    sendFloatingPayload(activeNotification);
  }
});

ipcMain.on('notification:action', (_event, payload = {}) => {
  if (payload && payload.action && payload.action !== 'close') {
    mainWindow?.webContents.send('notification:command', payload);
  }
  completeNotificationPayload();
});

// ========== 组内媒体查看功能 ==========

/**
 * 创建组内媒体查看窗口
 */
function createGroupMediaWindow() {
  // 如果窗口已存在，直接显示
  if (groupMediaWindow && !groupMediaWindow.isDestroyed()) {
    groupMediaWindow.show();
    groupMediaWindow.focus();
    return groupMediaWindow;
  }

  // 创建新窗口
  groupMediaWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: '组内媒体查看',
    icon: path.join(app.getAppPath(), 'icon.jpeg'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  groupMediaWindow.once('ready-to-show', () => {
    groupMediaWindow.show();
    if (isDev) {
      groupMediaWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  groupMediaWindow.on('closed', () => {
    groupMediaWindow = null;
  });

  // 清除缓存确保加载最新代码
  groupMediaWindow.webContents.session.clearCache().then(() => {
    groupMediaWindow.loadFile(path.join(__dirname, '../renderer/group-media.html'));
  });

  return groupMediaWindow;
}

// 打开组内媒体窗口
ipcMain.on('open-group-media-window', () => {
  createGroupMediaWindow();
});

// 获取媒体配置
ipcMain.handle('media:get-config', async () => {
  return mediaService.getConfig();
});

// 获取子目录树（懒加载）
ipcMain.handle('media:get-folder-tree', async (_event, folderId) => {
  try {
    return await mediaService.getFolderTree(folderId);
  } catch (error) {
    console.error('获取目录树失败:', error);
    throw new Error(error.message || '获取目录树失败');
  }
});

// 保存媒体配置
ipcMain.handle('media:save-config', async (_event, updates) => {
  return mediaService.saveConfig(updates);
});

// 下载媒体文件
ipcMain.handle('media:download-files', async (_event, payload) => {
  try {
    return await mediaService.downloadFiles(payload?.files || [], payload?.destDir);
  } catch (error) {
    console.error('下载文件失败:', error);
    throw new Error(error.message || '下载失败');
  }
});

// 提取文件夹 ID
ipcMain.handle('media:extract-folder-id', async (_event, link) => {
  return mediaService.normalizeFolderId(link);
});

// 提交媒体记录
ipcMain.handle('media:submit-record', async (_event, record) => {
  try {
    return await mediaService.submitMediaRecord(record);
  } catch (error) {
    throw new Error(error.message || '提交失败');
  }
});

// 获取媒体记录列表
ipcMain.handle('media:get-records', async (_event, filters = {}) => {
  try {
    return await mediaService.getMediaRecords(filters);
  } catch (error) {
    console.error('获取媒体记录失败:', error);
    throw new Error(error.message || '获取记录失败');
  }
});

// 获取文件夹详情
ipcMain.handle('media:get-folder-details', async (_event, folderId, options) => {
  try {
    return await mediaService.getFolderDetails(folderId, options);
  } catch (error) {
    console.error('获取文件夹详情失败:', error);
    throw new Error(error.message || '获取文件夹详情失败');
  }
});

// 缩略图缓存相关
ipcMain.handle('media:get-thumbnail-cached', async (_event, payload = {}) => {
  const { fileId, size } = payload;
  try {
    const pathResult = await mediaService.getCachedThumbnail(fileId, size || 200);
    return pathResult ? { path: pathResult, cached: true } : null;
  } catch (error) {
    console.warn('获取缩略图缓存失败', error);
    return null;
  }
});

ipcMain.handle('media:cache-thumbnail', async (_event, payload = {}) => {
  const { fileId, size } = payload;
  try {
    const pathResult = await mediaService.cacheThumbnail(fileId, size || 200);
    return pathResult ? { path: pathResult, cached: false } : null;
  } catch (error) {
    console.warn('缓存缩略图失败', String(error).replace(/[\r\n]/g, ' '));
    return null;
  }
});

ipcMain.handle('media:thumb-cache-info', async () => {
  try {
    return mediaService.getThumbCacheInfo();
  } catch (error) {
    console.warn('获取缩略图缓存信息失败', error);
    return null;
  }
});

ipcMain.handle('media:thumb-cache-clean', async (_event, maxBytes) => {
  try {
    await mediaService.cleanupThumbCache(maxBytes || undefined);
    return mediaService.getThumbCacheInfo();
  } catch (error) {
    console.warn('清理缩略图缓存失败', error);
    return null;
  }
});

ipcMain.handle('media:thumb-cache-set-max', async (_event, maxBytes) => {
  try {
    return mediaService.setThumbCacheMaxBytes(maxBytes);
  } catch (error) {
    console.warn('设置缩略图缓存上限失败', error);
    return null;
  }
});

ipcMain.handle('media:thumb-cache-set-dir', async (_event, dirPath) => {
  try {
    return mediaService.setThumbCacheDir(dirPath);
  } catch (error) {
    console.warn('设置缩略图缓存目录失败', error);
    return null;
  }
});

// 文件索引持久化
ipcMain.handle('media:index-load', async () => {
  try {
    return await mediaService.loadFileIndex();
  } catch (error) {
    console.warn('读取文件索引失败', error);
    return null;
  }
});

ipcMain.handle('media:index-save', async (_event, payload = null) => {
  try {
    if (!payload) return false;
    return await mediaService.saveFileIndex(payload);
  } catch (error) {
    console.warn('写入文件索引失败', error);
    return false;
  }
});

ipcMain.handle('media:index-info', async () => {
  try {
    return mediaService.getFileIndexInfo();
  } catch (error) {
    console.warn('获取文件索引信息失败', error);
    return null;
  }
});

ipcMain.handle('media:index-clear', async () => {
  try {
    mediaService.clearFileIndex();
    return mediaService.getFileIndexInfo();
  } catch (error) {
    console.warn('清理文件索引失败', error);
    return null;
  }
});

// ========== 每日打卡 Google Sheets 同步 ==========

/**
 * 同步单条打卡记录到 Google Sheets
 * 表格结构: 日期 | 姓名 | 上午时间 | 上午状态 | 下午时间 | 下午状态 | 晚上时间 | 晚上状态 | 休息时间 | 休息状态 | 在线时长 | 备注
 */
ipcMain.handle('checkin:sync-record', async (_event, params) => {
  try {
    const { sheetsUrl, sheetName, record } = params;
    if (!sheetsUrl || !record) {
      return { success: false, error: '缺少必要参数' };
    }

    // 从 URL 提取 Sheet ID
    const sheetIdMatch = sheetsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetIdMatch) {
      return { success: false, error: '无效的表格链接' };
    }
    const sheetId = sheetIdMatch[1];
    const targetSheetName = sheetName || '每日打卡';

    // 确保表头存在
    await googleService.ensureCheckinSheetHeader(sheetId, targetSheetName);

    // 格式化记录为行数据
    const rowData = googleService.formatCheckinRecord(record);

    // 查找或更新记录（🔴 添加 teamName 作为主键一部分）
    const result = await googleService.upsertCheckinRecord(sheetId, targetSheetName, record.date, record.userName, rowData, record.teamName || 'default');

    return { success: true, ...result };
  } catch (error) {
    console.error('[Checkin] 同步失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 从 Google Sheets 读取所有打卡记录
 */
ipcMain.handle('checkin:fetch-records', async (_event, params) => {
  try {
    const { sheetsUrl, sheetName } = params;
    if (!sheetsUrl) {
      return { success: false, error: '缺少表格链接', records: [] };
    }

    const sheetIdMatch = sheetsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetIdMatch) {
      return { success: false, error: '无效的表格链接', records: [] };
    }
    const sheetId = sheetIdMatch[1];
    const targetSheetName = sheetName || '每日打卡';

    const records = await googleService.fetchCheckinRecords(sheetId, targetSheetName);
    return { success: true, records };
  } catch (error) {
    console.error('[Checkin] 读取失败:', error);
    return { success: false, error: error.message, records: [] };
  }
});

/**
 * 批量同步多条打卡记录
 */
ipcMain.handle('checkin:batch-sync', async (_event, params) => {
  try {
    const { sheetsUrl, sheetName, records } = params;
    if (!sheetsUrl || !records?.length) {
      return { success: false, error: '缺少必要参数' };
    }

    const sheetIdMatch = sheetsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetIdMatch) {
      return { success: false, error: '无效的表格链接' };
    }
    const sheetId = sheetIdMatch[1];
    const targetSheetName = sheetName || '每日打卡';

    await googleService.ensureCheckinSheetHeader(sheetId, targetSheetName);

    let synced = 0;
    for (const record of records) {
      try {
        const rowData = googleService.formatCheckinRecord(record);
        await googleService.upsertCheckinRecord(sheetId, targetSheetName, record.date, record.userName, rowData, record.teamName || 'default');
        synced++;
      } catch (e) {
        console.warn(`[Checkin] 记录同步失败 ${record.date}:`, e.message);
      }
    }

    return { success: true, synced, total: records.length };
  } catch (error) {
    console.error('[Checkin] 批量同步失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 同步打卡数据到横向日期格式（和团队总览相同格式）
 */
ipcMain.handle('checkin:sync-horizontal', async (_event, params) => {
  try {
    const { sheetsUrl, sheetName, records, year, month } = params;
    if (!sheetsUrl || !records?.length) {
      return { success: false, error: '缺少必要参数' };
    }

    const sheetIdMatch = sheetsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetIdMatch) {
      return { success: false, error: '无效的表格链接' };
    }
    const sheetId = sheetIdMatch[1];
    const targetSheetName = sheetName || '每日打卡';

    const result = await googleService.syncCheckinHorizontal(sheetId, targetSheetName, records, year, month);
    return result;
  } catch (error) {
    console.error('[Checkin] 横向同步失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 保存打卡设置到 Firebase
 */
ipcMain.handle('checkin:save-settings', async (_event, params) => {
  try {
    const { userName, settings } = params;
    if (!userName) {
      return { success: false, error: '缺少用户姓名' };
    }
    return await firebaseService.saveCheckinSettings(userName, settings);
  } catch (error) {
    console.error('[Checkin] 保存设置失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 从 Firebase 获取打卡设置
 */
ipcMain.handle('checkin:load-settings', async (_event, params) => {
  try {
    const { userName } = params;
    if (!userName) {
      return { success: false, error: '缺少用户姓名' };
    }
    return await firebaseService.getCheckinSettings(userName);
  } catch (error) {
    console.error('[Checkin] 加载设置失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 保存打卡记录到 Firebase（单条）
 * 🔴 修复：增加 teamName 参数实现团队数据隔离
 */
ipcMain.handle('checkin:save-record-firebase', async (_event, params) => {
  try {
    const { userName, record, teamName } = params;
    const team = teamName || record?.teamName || 'default';
    return await firebaseService.saveCheckinRecord(userName, record, team);
  } catch (error) {
    console.error('[Checkin] 保存记录失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 从 Firebase 获取打卡记录
 * 🔴 修复：增加 teamName 参数
 */
ipcMain.handle('checkin:load-records-firebase', async (_event, params) => {
  try {
    const { userName, teamName } = params;
    const team = teamName || 'default';
    return await firebaseService.getCheckinRecords(userName, team);
  } catch (error) {
    console.error('[Checkin] 加载记录失败:', error);
    return { success: false, error: error.message, records: [] };
  }
});

/**
 * 批量保存打卡记录到 Firebase
 * 🔴 修复：增加 teamName 参数
 */
ipcMain.handle('checkin:batch-save-records-firebase', async (_event, params) => {
  try {
    const { userName, records, teamName } = params;
    const team = teamName || 'default';
    return await firebaseService.batchSaveCheckinRecords(userName, records, team);
  } catch (error) {
    console.error('[Checkin] 批量保存失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 从 Firebase 获取团队的打卡记录
 * 🔴 修复：增加 teamName 参数
 */
ipcMain.handle('checkin:get-all-records-firebase', async (_event, params) => {
  try {
    // 🔴 修复：支持 allTeams 参数获取所有团队数据
    if (params?.allTeams) {
      console.log('[Checkin] 获取所有团队的打卡记录...');
      return await firebaseService.getAllCheckinRecordsAllTeams();
    }
    const teamName = params?.teamName || 'default';
    return await firebaseService.getAllCheckinRecords(teamName);
  } catch (error) {
    console.error('[Checkin] 获取所有记录失败:', error);
    return { success: false, error: error.message, records: [] };
  }
});

/**
 * 开始实时监听团队的打卡记录（团队总览实时更新）
 * 🔴 修复：增加 teamName 参数
 */
ipcMain.handle('checkin:watch-all-records', async (_event, params) => {
  try {
    const teamName = params?.allTeams ? '*' : (params?.teamName || 'default');
    // 设置回调，当数据变化时推送到渲染进程
    const result = firebaseService.watchAllCheckinRecords(teamName, (data) => {
      if (data.type === 'checkin-update' || data.type === 'update') {
        // 向所有窗口广播更新
        BrowserWindow.getAllWindows().forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('checkin:records-updated', data);
          }
        });
      }
    });
    return result || { success: true };
  } catch (error) {
    console.error('[Checkin] 开始监听失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 停止监听打卡记录
 */
ipcMain.handle('checkin:stop-watch-records', async () => {
  try {
    return firebaseService.stopWatchingCheckinRecords();
  } catch (error) {
    console.error('[Checkin] 停止监听失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 保存报数记录到 Firebase（按团队隔离）
 */
ipcMain.handle('checkin:save-report-record', async (_event, record, teamName) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const team = teamName || 'default';
    return await firebaseService.saveReportRecord(today, record, team);
  } catch (error) {
    console.error('[Checkin] 保存报数记录失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 开始监听报数记录（按团队隔离）
 */
ipcMain.handle('checkin:watch-report-records', async (_event, teamName) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const team = teamName || 'default';
    const result = firebaseService.watchReportRecords(today, team, (data) => {
      // 向所有窗口广播更新
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('checkin:report-records-updated', data);
        }
      });
    });
    return result || { success: true };
  } catch (error) {
    console.error('[Checkin] 开始监听报数记录失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 获取报数记录（日期范围）
 */
ipcMain.handle('checkin:get-report-records-range', async (_event, params) => {
  try {
    return await firebaseService.getReportRecordsRange(params || {});
  } catch (error) {
    console.error('[Checkin] 获取报数记录失败:', error);
    return { success: false, records: [], error: error.message };
  }
});

/**
 * 停止监听报数记录
 */
ipcMain.handle('checkin:stop-watch-report-records', async () => {
  try {
    return firebaseService.stopWatchingReportRecords();
  } catch (error) {
    console.error('[Checkin] 停止监听报数记录失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 🔴 保存任务统计修正记录（从任务统计直接编辑时使用）
 */
ipcMain.handle('checkin:save-correction-record', async (_event, params) => {
  try {
    return await firebaseService.saveCorrectionRecord(params);
  } catch (error) {
    console.error('[Checkin] 保存修正记录失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 🔴 发送催报消息
 */
ipcMain.handle('checkin:send-remind-message', async (_event, message) => {
  try {
    return await firebaseService.sendRemindMessage(message);
  } catch (error) {
    console.error('[Checkin] 发送催报消息失败:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 🔴 开始监听催报消息
 */
ipcMain.handle('checkin:watch-remind-messages', async (_event, teamName) => {
  try {
    const result = firebaseService.watchRemindMessages(teamName || 'default', (data) => {
      // 向所有窗口广播催报消息
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('checkin:remind-message', data);
        }
      });
    });
    return result || { success: true };
  } catch (error) {
    console.error('[Checkin] 开始监听催报消息失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 重置打卡数据库（支持选择版本）
ipcMain.handle('checkin:reset-database', async (_event, targetVersion = 'V2') => {
  try {
    const result = await firebaseService.resetCheckinDatabase(targetVersion);
    return result;
  } catch (error) {
    console.error('[Checkin] 重置数据库失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 一键清理错误数据（删除把用户名当作团队名的错误节点）
// dryRun=true 时只预览，不删除
ipcMain.handle('checkin:cleanup-invalid-data', async (_event, { dryRun = false } = {}) => {
  try {
    const result = await firebaseService.cleanupInvalidTeamNames(dryRun);
    return result;
  } catch (error) {
    console.error('[Checkin] 清理错误数据失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 从 V1 迁移有效数据到目标版本（V2/V3）
// dryRun=true 时只预览，不迁移
// targetVersion: 'V2'（生产）或 'V3'（测试）
ipcMain.handle('checkin:migrate-v1-to-v2', async (_event, { dryRun = false, targetVersion = 'V2' } = {}) => {
  try {
    const result = await firebaseService.migrateV1ToV2(dryRun, targetVersion);
    return result;
  } catch (error) {
    console.error('[Checkin] 迁移失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 切换数据库版本（V1 或 V2）- 仅用于开发模式预览
ipcMain.handle('checkin:switch-db-version', async (_event, { version }) => {
  try {
    const result = firebaseService.switchDBVersion(version);
    return result;
  } catch (error) {
    console.error('[Checkin] 切换版本失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 获取当前数据库版本
ipcMain.handle('checkin:get-db-version', async () => {
  try {
    const result = firebaseService.getDBVersion();
    return { success: true, ...result };
  } catch (error) {
    console.error('[Checkin] 获取版本失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 重命名组别（迁移数据）
ipcMain.handle('checkin:rename-team', async (event, { oldTeamName, newTeamName }) => {
  try {
    const result = await firebaseService.renameTeam(oldTeamName, newTeamName);
    return result;
  } catch (error) {
    console.error('[Checkin] 重命名组别失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 迁移 default 组中指定用户的数据到目标组
ipcMain.handle('checkin:migrate-default-user', async (_event, { userName, newTeamName }) => {
  try {
    const result = await firebaseService.migrateDefaultRecordsForUser(userName, newTeamName);
    return result;
  } catch (error) {
    console.error('[Checkin] 迁移默认组用户数据失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 合并指定用户在多组的记录到目标组
ipcMain.handle('checkin:migrate-user-team', async (_event, { userName, newTeamName }) => {
  try {
    const result = await firebaseService.migrateUserRecordsToTeam(userName, newTeamName);
    return result;
  } catch (error) {
    console.error('[Checkin] 合并用户组别失败:', error);
    return { success: false, error: error.message };
  }
});
// 🔴 获取所有组别列表
ipcMain.handle('checkin:get-all-teams', async () => {
  try {
    const result = await firebaseService.getAllTeams();
    return result;
  } catch (error) {
    console.error('[Checkin] 获取组别列表失败:', error);
    return { success: false, teams: [], error: error.message };
  }
});

// 🔴 获取组内用户列表
ipcMain.handle('checkin:get-team-users', async (_event, { teamName }) => {
  try {
    const result = await firebaseService.getTeamUsers(teamName);
    return result;
  } catch (error) {
    console.error('[Checkin] 获取用户列表失败:', error);
    return { success: false, users: [], error: error.message };
  }
});

// 🔴 获取所有用户（跨所有组）
ipcMain.handle('checkin:get-all-users', async () => {
  try {
    const result = await firebaseService.getAllUsers();
    return result;
  } catch (error) {
    console.error('[Checkin] 获取所有用户失败:', error);
    return { success: false, users: [], error: error.message };
  }
});

// 🔴 重命名用户
ipcMain.handle('checkin:rename-user', async (_event, { oldUserName, newUserName, teamName }) => {
  try {
    const result = await firebaseService.renameUserInTeam(oldUserName, newUserName, teamName);
    return result;
  } catch (error) {
    console.error('[Checkin] 重命名用户失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 删除用户
ipcMain.handle('checkin:delete-user', async (_event, { userName, teamName }) => {
  try {
    const result = await firebaseService.deleteUserInTeam(userName, teamName);
    return result;
  } catch (error) {
    console.error('[Checkin] 删除用户失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 数据备份 - 保存到本地 JSON 文件
ipcMain.handle('checkin:backup-data', async (_event, data) => {
  try {
    const { app } = require('electron');
    const fs = require('fs');
    const path = require('path');

    // 备份目录：用户文档/checkin-backups
    const backupDir = path.join(app.getPath('documents'), 'checkin-backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 文件名：backup-YYYY-MM-DD-HHmmss.json
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${dateStr}.json`;
    const filepath = path.join(backupDir, filename);

    // 写入备份
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[Checkin] 数据已备份到: ${filepath}`);

    // 清理旧备份（保留最近 7 个）
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > 7) {
      files.slice(7).forEach(f => {
        fs.unlinkSync(path.join(backupDir, f));
        console.log(`[Checkin] 已删除旧备份: ${f}`);
      });
    }

    return { success: true, filepath, filename };
  } catch (error) {
    console.error('[Checkin] 备份失败:', error);
    return { success: false, error: error.message };
  }
});

// 🔴 获取备份列表
ipcMain.handle('checkin:list-backups', async () => {
  try {
    const { app } = require('electron');
    const fs = require('fs');
    const path = require('path');

    const backupDir = path.join(app.getPath('documents'), 'checkin-backups');
    if (!fs.existsSync(backupDir)) {
      return { success: true, backups: [] };
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f));
        return {
          filename: f,
          size: stat.size,
          createdAt: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { success: true, backups: files, backupDir };
  } catch (error) {
    console.error('[Checkin] 获取备份列表失败:', error);
    return { success: false, error: error.message, backups: [] };
  }
});

// 🔴 恢复备份
ipcMain.handle('checkin:restore-backup', async (_event, filename) => {
  try {
    const { app } = require('electron');
    const fs = require('fs');
    const path = require('path');

    const backupDir = path.join(app.getPath('documents'), 'checkin-backups');
    const filepath = path.join(backupDir, filename);

    if (!fs.existsSync(filepath)) {
      return { success: false, error: '备份文件不存在' };
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const data = JSON.parse(content);

    console.log(`[Checkin] 从备份恢复: ${filename}`);
    return { success: true, data };
  } catch (error) {
    console.error('[Checkin] 恢复备份失败:', error);
    return { success: false, error: error.message };
  }
});
