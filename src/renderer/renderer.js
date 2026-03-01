// ==================== 控制台消息过滤器 ====================
// 过滤 Google Docs iframe 相关的无关错误和警告
(function () {
  const originalError = console.error;
  const originalWarn = console.warn;

  const ignoredPatterns = [
    'Document-Policy HTTP header',
    'Permissions-Policy header',
    'include-js-call-stacks-in-crash-reports',
    'filesystem:https://docs.google.com/persistent/docs/fonts',
    'chrome-extension://',
    'Could not load content for https://docs.google.com/static/document/client',
    'Could not load source map',
    'ERR_FILE_NOT_FOUND',
    'ERR_HTTP_RESPONSE_CODE_FAILURE',
    'ERR_FAILED',
    'DevTools failed to load source map',
    'Refused to frame',
    'frame-ancestors',
    'contacts.google.com',
    'accounts.google.com',
    'sourcemap: HTTP error'
  ];

  function shouldIgnore(args) {
    const message = args.join(' ');
    return ignoredPatterns.some(pattern =>
      message.includes(pattern)
    );
  }

  console.error = function (...args) {
    if (!shouldIgnore(args)) {
      originalError.apply(console, args);
    }
  };

  console.warn = function (...args) {
    if (!shouldIgnore(args)) {
      originalWarn.apply(console, args);
    }
  };
})();

const DEFAULT_PATTERN = '{{country}}-{{customDate}}-{{subject}}-{{submitter}}-{{admin}}-{{counter}}';
const PATTERN_DISPLAY = '国家-日期-图片名称-提交人-管理员-序号';
const DEFAULT_COUNTRY = 'IT';
const REVIEW_ACK_STORAGE_KEY = 'art-autoform-ack-records';
const REVIEW_SORT_STORAGE_KEY = 'art-autoform-review-sort';
const MY_REVIEW_SORT_STORAGE_KEY = 'art-autoform-myreview-sort';
const REVIEW_SORT_MODES = ['priority', 'date-desc', 'date-asc', 'category-asc', 'category-desc'];
const REVIEW_RANGE_MODES = ['10d', 'all'];
const REVIEW_ALL_PAGE_SIZE = 12;
const REVIEW_RANGE_STORAGE_KEY = 'art-autoform-review-range';
const SUBMITTER_STORAGE_KEY = 'art-autoform-last-submitter';
const RENAME_LOCAL_STORAGE_KEY = 'art-autoform-rename-local';
const USER_ROLE_STORAGE_KEY = 'art-autoform-user-role';
const SLOTS_STORAGE_KEY = 'art-autoform-slots-config';
const SLOT_VIEW_MODE_STORAGE_KEY = 'art-autoform-slot-view-mode';
const REVIEW_POLL_INTERVAL = 15000;
const DEFAULT_FOLDER_PATTERN = '{{customDate}}-{{submitter}}-{{admin}}';
const CUSTOM_TEXT_SCOPE = {
  GLOBAL: 'global',
  SLOT: 'slot'
};

const BUILT_IN_FOLDER_PRESETS = [
  {
    label: '默认文件夹命名规范',
    pattern: DEFAULT_FOLDER_PATTERN,
    builtIn: true
  },
  {
    label: '时事新闻文件夹命名规范',
    pattern: '{{eventName}}',
    builtIn: true
  },
  {
    label: '图片组文件夹命名规范',
    pattern: '{{customDate}}-{{pageName}}-{{admin}}',
    builtIn: true
  },
  {
    label: '普通文件夹命名规范',
    pattern: '{{customDate}}-{{subject}}',
    builtIn: true
  }
];
const BUILT_IN_NAMING_PRESETS = [
  {
    label: '默认命名（国家 · 日期 · 图片名称 · 提交人 · 管理员 · 序号）',
    pattern: DEFAULT_PATTERN
  },
  {
    label: '主耶稣图（国家 · 日期 · 原文件名 · 提交人 · 管理员 · 序号）',
    pattern: '{{country}}-{{customDate}}-{{originalName}}-{{submitter}}-{{admin}}-{{counter}}'
  },
  {
    label: '普通命名规范（日期 · 图片名称 · 序号）',
    pattern: '{{customDate}}-{{subject}}-{{counter}}'
  },
  {
    label: '图片组图片命名（专页名称 · ZB · 管理员 · 提交人 · 描述或原名 · 日期 · 不/可分发）',
    pattern: '{{pageName}}-{{zb}}-{{admin}}-{{submitter}}-{{subjectOrOriginal}}-{{customDate}}-{{distribution}}'
  },
  {
    label: '时事新闻命名（事件名称 · 提交人 · 序号）',
    pattern: '{{eventName}}-{{submitter}}-{{counter}}'
  },
  {
    label: '直接使用原文件名',
    pattern: '{{originalName}}'
  }
];
const SLOT_MODES = {
  LIBRARY: 'library',
  CUSTOM_LINK: 'custom-link'
};
const NOTIFICATION_SOUNDS = {
  review: { frequency: 880, duration: 0.28 },
  suggestion: { frequency: 520, duration: 0.32 },
  approved: { frequency: 660, duration: 0.3 }
};
const NOTIFICATION_MESSAGES = {
  review: '有图需要审核',
  suggestion: '图片有建议反馈',
  approved: '图片已审核通过入库'
};
const MIN_ZOOM_FACTOR = 0.7;
const MAX_ZOOM_FACTOR = 1.3;
const HIDE_SOFTWARE_REVIEW = true;
const HIDE_GROUP_MEDIA = true;
const APP_VIEWS = ['notice-board', 'upload', 'my-review', 'review', 'group-media', 'daily-checkin', 'settings'];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REVIEW_RANGE_LABELS = {
  today: '当天',
  '24h': '24 小时内',
  '2d': '最近两天',
  '3d': '最近三天',
  '7d': '最近一周',
  all: '全部',
  custom: '自定义范围'
};
const MY_REVIEW_RANGES = new Set(Object.keys(REVIEW_RANGE_LABELS));
const MY_REVIEW_DEFAULT_LIMIT = 20;
const MY_REVIEW_MIN_LIMIT = 5;
const MY_REVIEW_MAX_LIMIT = 200;
const MY_REVIEW_PAGE_SIZE = 12;
const MY_REVIEW_STATUS_KEYS = ['all', 'pending', 'feedback', 'waiting', 'approved', 'partial', 'completed', 'allStored', 'cancelled'];
const MY_REVIEW_STATUS_LABELS = {
  all: '全部状态',
  pending: '待审核',
  feedback: '需修改',
  waiting: '等待入库',
  approved: '已入库',
  partial: '已部分入库',
  completed: '不需入库已审核完',
  allStored: '所有入库',
  cancelled: '已取消'
};
const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov', '.mkv', '.avi', '.wmv', '.flv', '.webm', '.mpg', '.mpeg']);
const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
  '.psd',
  '.svg',
  '.cr2',
  '.nef',
  '.raw'
]);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.wma', '.aiff', '.aif', '.aifc', '.mid', '.midi']);
const ARCHIVE_EXTENSIONS = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz']);
const DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.md',
  '.rtf',
  '.csv',
  '.pages',
  '.numbers',
  '.key'
]);
const MEDIA_TYPE_LABELS = {
  video: '视频',
  image: '图片',
  audio: '音频',
  document: '文档',
  archive: '压缩包',
  other: '其他'
};
const ARCHIVE_MIME_HINTS = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar'
];
const DOCUMENT_MIME_HINTS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'application/rtf'
];
const TOKEN_DEFS = [
  { label: '国家', token: '{{country}}' },
  { label: '日期', token: '{{customDate}}' },
  { label: 'ZB', token: '{{zb}}' },
  { label: '软件', token: '{{software}}' },
  { label: '图片名称', token: '{{subject}}', unique: true, mutex: 'eventName' },
  { label: '专页名称', token: '{{pageName}}' },
  { label: '事件名称', token: '{{eventName}}', unique: true, mutex: 'subject' },
  { label: '提交人', token: '{{submitter}}' },
  { label: '管理员', token: '{{admin}}' },
  { label: '不/可分发', token: '{{distribution}}' },
  { label: '序号', token: '{{counter}}' },
  { label: '原文件名', token: '{{originalName}}' },
  { label: '描述或原名', token: '{{subjectOrOriginal}}' },
  { label: 'AI关键词', token: '{{aiKeywords}}' },
  { label: '自定义', token: '{{customPlaceholder}}', allowMultiple: true }
];

const statusLabels = {
  pending: '待上传',
  queued: '排队中',
  running: '上传中',
  success: '已完成',
  error: '失败',
  skipped: '未上传'
};

const elements = {
  clientId: document.getElementById('client-id'),
  clientSecret: document.getElementById('client-secret'),
  redirectPort: document.getElementById('redirect-port'),
  zoomFactor: document.getElementById('zoom-factor'),
  zoomFactorDisplay: document.getElementById('zoom-factor-display'),
  resetZoom: document.getElementById('reset-zoom'),
  driveFolderId: document.getElementById('drive-folder-id'),
  mediaDownloadDir: document.getElementById('media-download-dir'),
  mediaDownloadDirPick: document.getElementById('media-download-dir-pick'),
  thumbCacheInfo: document.getElementById('thumb-cache-info'),
  thumbCacheAll: document.getElementById('thumb-cache-all'),
  thumbCacheClean: document.getElementById('thumb-cache-clean'),
  thumbCacheMax: document.getElementById('thumb-cache-max'),
  thumbCacheMaxSave: document.getElementById('thumb-cache-max-save'),
  thumbCacheDir: document.getElementById('thumb-cache-dir'),
  thumbCacheDirPick: document.getElementById('thumb-cache-dir-pick'),
  enablePrefetch: document.getElementById('enable-prefetch'),
  fileIndexInfo: document.getElementById('file-index-info'),
  fileIndexRefresh: document.getElementById('file-index-refresh'),
  fileIndexClear: document.getElementById('file-index-clear'),
  fileIndexInterval: document.getElementById('file-index-interval'),
  fileIndexIntervalSave: document.getElementById('file-index-interval-save'),
  indexRefreshTimer: document.getElementById('index-refresh-timer'),
  folderForceRefresh: document.getElementById('folder-force-refresh'),
  indexProgressBar: document.getElementById('index-progress-bar'),
  indexProgressText: document.getElementById('index-progress-text'),
  sheetId: document.getElementById('sheet-id'),
  sheetRange: document.getElementById('sheet-range'),
  reviewRange: document.getElementById('review-range'),
  categoryRange: document.getElementById('category-range'),
  softwareSheetId: document.getElementById('software-sheet-id'),
  softwareSheetRange: document.getElementById('software-sheet-range'),
  softwareSubmissionRange: document.getElementById('software-submission-range'),
  softwareAdminRange: document.getElementById('software-admin-range'),
  softwareSubmitUrl: document.getElementById('software-submit-url'),
  softwareAdminsField: document.getElementById('software-admins-field'),
  softwareAdmins: document.getElementById('software-admins'),
  softwareAdminsHint: document.getElementById('software-admins-hint'),
  softwareConfigFields: document.getElementById('software-config-fields'),
  softwareConfigPanel: document.getElementById('software-config-panel'),
  softwareAdminsPending: document.getElementById('software-admins-pending'),
  softwareAdminsPendingList: document.getElementById('software-admins-pending-list'),
  softwareReviewTab: document.getElementById('view-tab-software-review'),
  softwareReviewPanel: document.querySelector('[data-view="software-review"]'),
  softwareReviewList: document.getElementById('software-review-list'),
  softwareReviewRefresh: document.getElementById('software-review-refresh'),
  reviewTempFolder: document.getElementById('review-temp-id'),
  fileReviewRange: document.getElementById('file-review-range'),
  renamePattern: document.getElementById('rename-pattern'),
  folderPattern: document.getElementById('folder-pattern'),
  tokenButtons: document.getElementById('token-buttons'),
  tokenBuilder: document.getElementById('token-builder'),
  folderTokenButtons: document.getElementById('folder-token-buttons'),
  folderTokenBuilder: document.getElementById('folder-token-builder'),
  customTextList: document.getElementById('custom-text-list'),
  namingPresetName: document.getElementById('naming-preset-name'),
  addNamingPreset: document.getElementById('add-naming-preset'),
  namingPresetList: document.getElementById('naming-preset-list'),
  folderPresetName: document.getElementById('folder-preset-name'),
  addFolderPreset: document.getElementById('add-folder-preset'),
  folderPresetList: document.getElementById('folder-preset-list'),
  addCustomTextBtn: document.getElementById('add-custom-text'),
  dateFormat: document.getElementById('date-format'),
  counterStart: document.getElementById('counter-start'),
  counterPadding: document.getElementById('counter-padding'),
  counterStep: document.getElementById('counter-step'),
  timezone: document.getElementById('timezone'),
  authorizeBtn: document.getElementById('authorize-btn'),
  authStatus: document.getElementById('auth-status'),
  saveConfig: document.getElementById('save-config'),
  resetBasicConfig: document.getElementById('reset-basic-config'),
  resetAllConfig: document.getElementById('reset-all-config'),
  uploadLog: document.getElementById('upload-log'),
  uploadStateLabel: document.getElementById('upload-state'),
  startUpload: document.getElementById('start-upload'),
  pauseUpload: document.getElementById('pause-upload'),
  resumeUpload: document.getElementById('resume-upload'),
  stopUpload: document.getElementById('stop-upload'),
  clearUploadState: document.getElementById('upload-clear-state'),
  toggleUploadProgress: document.getElementById('toggle-upload-progress'),
  uploadProgressBody: document.getElementById('upload-progress-body'),
  openDrive: document.getElementById('open-drive'),
  slotSearch: document.getElementById('slot-search'),
  renameLocal: document.getElementById('rename-local-files'),
  syncCategories: document.getElementById('sync-categories'),
  exportConfig: document.getElementById('export-config'),
  importConfig: document.getElementById('import-config'),
  resetNamingConfig: document.getElementById('reset-naming-config'),
  addSlotBtn: document.getElementById('add-slot'),
  slotContainer: document.getElementById('slot-container'),
  toggleSlotGroupBtn: document.getElementById('toggle-slot-group'),
  slotPresetExport: document.getElementById('slot-preset-export'),
  slotPresetImport: document.getElementById('slot-preset-import'),
  slotPresetReset: document.getElementById('slot-preset-reset'),
  softwareDirectory: document.getElementById('software-directory'),
  refreshSoftware: document.getElementById('refresh-software'),
  addSoftwareEntry: document.getElementById('add-software-entry'),
  softwareSearch: document.getElementById('software-search'),
  softwareCategoryFilter: document.getElementById('software-category-filter'),
  softwareCount: document.getElementById('software-count'),
  softwareEditToggle: document.getElementById('software-edit-toggle'),
  softwareFormOverlay: document.getElementById('software-form-overlay'),
  softwareFormTitle: document.getElementById('software-form-title'),
  softwareFormClose: document.getElementById('software-form-close'),
  softwareFormCancel: document.getElementById('software-form-cancel'),
  softwareFormSubmit: document.getElementById('software-form-submit'),
  softwareFormFields: {
    category: document.getElementById('software-form-category'),
    name: document.getElementById('software-form-name'),
    website: document.getElementById('software-form-website'),
    usage: document.getElementById('software-form-usage'),
    rating: document.getElementById('software-form-rating'),
    safety: document.getElementById('software-form-safety'),
    copyright: document.getElementById('software-form-copyright'),
    summary: document.getElementById('software-form-summary'),
    tutorial: document.getElementById('software-form-tutorial'),
    comments: document.getElementById('software-form-comments'),
    notes: document.getElementById('software-form-notes')
  },
  reviewList: document.getElementById('review-list'),
  reviewSortMode: document.getElementById('review-sort-mode'),
  reviewRangeMode: document.getElementById('review-range-mode'),
  reviewPagination: document.getElementById('review-pagination'),
  reviewStatusSummary: document.getElementById('review-status-summary'),
  refreshReview: document.getElementById('refresh-review'),
  checkDataConflicts: document.getElementById('check-data-conflicts'),
  syncReview: document.getElementById('sync-review'),
  userRole: document.getElementById('user-role'),
  viewNormal: document.getElementById('view-normal'),
  viewReview: document.getElementById('view-review'),
  reviewTab: document.querySelector('.view-tab[data-view="review"]'),
  myReviewList: document.getElementById('my-review-list'),
  myReviewSummary: document.getElementById('my-review-summary'),
  myReviewInfo: document.getElementById('my-review-info'),
  myReviewRange: document.getElementById('my-review-range'),
  myReviewLimit: document.getElementById('my-review-limit'),
  myReviewCustomStart: document.getElementById('my-review-start'),
  myReviewCustomEnd: document.getElementById('my-review-end'),
  myReviewCustomRange: document.getElementById('my-review-custom-range'),
  myReviewReset: document.getElementById('my-review-reset'),
  myReviewSortMode: document.getElementById('my-review-sort-mode'),
  myReviewPagination: document.getElementById('my-review-pagination'),
  notificationMode: document.getElementById('notification-mode'),
  notificationSoundReview: document.getElementById('notification-sound-review'),
  notificationSoundSuggestion: document.getElementById('notification-sound-suggestion'),
  notificationSoundApproved: document.getElementById('notification-sound-approved'),
  floatingNotificationToggle: document.getElementById('enable-floating-notification'),
  resetNotificationConfig: document.getElementById('reset-notification-config'),
  naming: {
    country: document.getElementById('name-country'),
    date: document.getElementById('name-date'),
    software: document.getElementById('name-software'),
    preview: document.getElementById('naming-preview')
  },
  metadata: {
    submitter: document.getElementById('meta-submit'),
    completedAt: document.getElementById('meta-complete')
  },
  globalAlert: document.getElementById('global-alert'),
  noticeBoard: {
    docId: document.getElementById('notice-board-doc-id'),
    autoOpen: document.getElementById('notice-board-auto-open'),
    content: document.getElementById('notice-board-content'),
    refreshBtn: document.getElementById('refresh-notice-board'),
    openDocBtn: document.getElementById('open-notice-doc'),
    updateBanner: document.getElementById('notice-board-update-banner'),
    updateBannerInfo: document.getElementById('update-banner-info'),
    dismissBtn: document.getElementById('dismiss-update-banner')
  }
};

let restoringSlots = false;
let globalAlertTimer = null;

const state = {
  config: {},
  slots: [],
  namingTokens: [],
  folderTokens: [],
  categories: [],
  categoryMap: {},
  taskTypes: [],  // 从表格 D 列读取的任务类型列表
  authorized: false,
  uploadState: 'idle',
  uploadQueue: [],  // 上传队列，存储待上传的分类ID
  slotFilter: '',
  renameLocalEnabled: false,
  customTextDefs: [],
  customTextGlobals: {},
  folderNamingPresets: [],
  namingPresets: [],
  slotViewMode: 'normal',
  groupSlotsByMain: false,
  inFlightActions: new Set(),
  reviewEntries: [],
  reviewSort: {
    mode: 'priority'
  },
  reviewRangeMode: '10d',
  reviewPage: 1,
  reviewLoading: false,
  reviewEntryCache: new Map(),
  lastKnownStatuses: new Map(),
  reviewNotificationsPrimed: false,
  fileReviewNotificationsPrimed: false,
  fileReviewKnownBatchIds: new Set(),
  fileReviewBatchStatusCache: new Map(),
  fileReviewBatchNoteCache: new Map(),
  reviewPollTimer: null,
  userRole: 'submitter',
  activeView: 'daily-checkin',
  audioContext: null,
  audioUnlocked: false,
  customAudioPlayers: {
    review: null,
    suggestion: null,
    approved: null
  },
  myReviewFilters: {
    range: '10d',
    limit: MY_REVIEW_DEFAULT_LIMIT,
    customStart: '',
    customEnd: '',
    status: 'all'
  },
  myReviewSort: {
    mode: 'priority'
  },
  myReviewPage: 1,
  reviewAcknowledged: {
    reviewer: new Map(),
    submitter: new Map()
  },
  reviewNoteDrafts: new Map(),
  fileSummaryStates: new Map(),
  softwareEntries: [],
  softwareSubmissions: [],
  softwareLoading: false,
  softwareReviewLoading: false,
  softwareReviewFetched: false,
  softwareFilters: {
    search: '',
    category: ''
  },
  currentUserEmail: '',
  softwareEditEnabled: false,
  softwareFormMode: 'create',
  softwareFormPayload: null,
  pendingAdminRequests: [],
  lastPendingAdminCount: 0,
  minimalistMode: false,
  headerCollapsed: false
};

let draggingSlotId = null;
let pointerDragActive = false;
let pointerDragCleanup = null;

/**
 * 从 Google Drive 加载图片，完全绕过缓存
 * 使用 fetch + cache:'no-store' 强制从网络获取最新图片
 * @param {string} fileId - Google Drive 文件ID
 * @param {string} size - 缩略图尺寸，如 'w100' 或 'w800' 或 'w1200'
 * @returns {Promise<string>} 图片的 blob URL
 */
async function fetchDriveImageNoCache(fileId, size = 'w1200') {
  if (!fileId) return '';
  const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=${size}&t=${Date.now()}`;
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      mode: 'cors',
      credentials: 'omit'
    });
    if (!response.ok) throw new Error('Failed to fetch image');
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn('fetchDriveImageNoCache failed:', error);
    // 回退到直接 URL
    return url;
  }
}

async function resolveCachedThumbUrl(fileId, size = 200) {
  if (!fileId || !window.bridge?.getThumbnailCached) return '';
  try {
    const cached = await window.bridge.getThumbnailCached({ fileId, size });
    if (cached?.path) {
      return cached.path.startsWith('file://') ? cached.path : `file://${cached.path}`;
    }
  } catch (error) {
    console.warn('resolveCachedThumbUrl failed:', error);
  }
  return '';
}

function getReviewPreviewFileId(file) {
  if (!file) return '';
  return file.annotatedFileId || file.fileId || '';
}

function updateReviewThumbImg(img, previewFileId) {
  if (!img || !previewFileId) return;
  const currentSrc = img.src || '';
  const match = currentSrc.match(/[?&]sz=w(\d+)/);
  const size = match ? match[1] : '200';
  img.src = `https://drive.google.com/thumbnail?id=${previewFileId}&sz=w${size}&t=${Date.now()}`;
}

function updateFileReviewAnnotatedLocal(rowNumber, annotatedFileId, annotatedTime) {
  if (!rowNumber || !annotatedFileId) return;
  const files = Array.isArray(state.fileReviewFiles) ? state.fileReviewFiles : [];
  const target = files.find(file => String(file.rowNumber) === String(rowNumber));
  if (target) {
    target.annotatedFileId = annotatedFileId;
    target.annotatedTime = annotatedTime || target.annotatedTime || '';
  }
  if (Array.isArray(state.fileReviewBatches)) {
    state.fileReviewBatches.forEach(batch => {
      batch.files?.forEach(file => {
        if (String(file.rowNumber) === String(rowNumber)) {
          file.annotatedFileId = annotatedFileId;
          file.annotatedTime = annotatedTime || file.annotatedTime || '';
        }
      });
    });
  }

  document.querySelectorAll(`[data-row="${rowNumber}"]`).forEach(el => {
    if (el.dataset) {
      el.dataset.previewId = annotatedFileId;
    }
    const img = el.querySelector('img');
    if (img) {
      updateReviewThumbImg(img, annotatedFileId);
    }
  });
}

function hydrateReviewThumbsFromCache(container) {
  if (!container || !window.bridge?.getThumbnailCached) return;
  const imgs = container.querySelectorAll('.file-card-thumb img, .reference-file-item img, .file-review-thumb img');
  imgs.forEach((img) => {
    // 只在图片还没加载完成时才替换，避免闪烁
    if (img.complete && img.naturalWidth > 0) return;

    const trigger = img.closest('.file-preview-trigger') || img.closest('[data-preview-id]') || img.closest('[data-file-id]');
    const fileId = trigger?.dataset?.previewId || trigger?.dataset?.fileId;
    if (!fileId) return;
    const match = (img.src || '').match(/[?&]sz=w(\d+)/);
    const size = match ? parseInt(match[1], 10) : 200;
    resolveCachedThumbUrl(fileId, size).then((cachedUrl) => {
      // 再次检查，确保图片仍未加载完成
      if (cachedUrl && (!img.complete || img.naturalWidth === 0)) {
        img.src = cachedUrl;
      }
    });
  });
}

/**
 * 强制刷新页面中指定文件ID的所有缩略图
 * @param {string} fileId - Google Drive 文件ID
 */
function refreshThumbnailsForFileId(fileId) {
  if (!fileId) return;
  const newTimestamp = Date.now();
  const cachedAnnotated = getAnnotatedPreviewUrl(fileId);
  // 查找所有包含该文件ID的图片元素
  document.querySelectorAll(`[data-preview-id="${fileId}"] img, [data-file-id="${fileId}"] img`).forEach(img => {
    if (cachedAnnotated) {
      img.src = cachedAnnotated;
      return;
    }
    const currentSrc = img.src || '';
    const match = currentSrc.match(/[?&]sz=([^&]+)/);
    const size = match?.[1] || 'w200';
    resolveCachedThumbUrl(fileId, parseInt(size.replace('w', ''), 10) || 200)
      .then((cachedUrl) => {
        if (cachedUrl) {
          img.src = cachedUrl;
          return;
        }
        return fetchDriveImageNoCache(fileId, size);
      })
      .then((blobUrl) => {
        if (!blobUrl || blobUrl.startsWith('file://')) return;
        const prevBlob = img.dataset.blobUrl;
        if (prevBlob && prevBlob.startsWith('blob:')) {
          URL.revokeObjectURL(prevBlob);
        }
        img.dataset.blobUrl = blobUrl;
        img.src = blobUrl;
      })
      .catch(() => {
        // 回退到时间戳强制刷新
        let newSrc = currentSrc.replace(/([&?])t=[^&]*/g, `$1t=${newTimestamp}`);
        if (newSrc === currentSrc && !currentSrc.includes('&t=')) {
          newSrc = currentSrc + `&t=${newTimestamp}`;
        }
        if (newSrc !== currentSrc) {
          img.src = newSrc;
        }
      });
  });
}

function isFileDrag(event) {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

function isSortingDrag(event) {
  return Boolean(draggingSlotId) && !isFileDrag(event);
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeTextValue(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return String(value).trim();
}

function formatSoftwareAdminsForInput(list = []) {
  return list.filter((item) => item && item.trim()).join('\n');
}

function getNormalizedSoftwareAdmins() {
  if (!Array.isArray(state.config.softwareAdmins)) {
    return [];
  }
  return state.config.softwareAdmins.map((email) => normalizeEmail(email)).filter(Boolean);
}

function isSoftwareAdminEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }
  return getNormalizedSoftwareAdmins().includes(normalized);
}

function isCurrentUserSoftwareAdmin() {
  return isSoftwareAdminEmail(state.currentUserEmail);
}

function hasAuthorizedSoftwareAdmins() {
  return Array.isArray(state.config.softwareAdmins) && state.config.softwareAdmins.length > 0;
}

function updateSoftwareAdminVisibility() {
  const field = elements.softwareAdminsField;
  const textarea = elements.softwareAdmins;
  const hint = elements.softwareAdminsHint;
  if (field) {
    field.hidden = false;
  }
  if (textarea) {
    textarea.disabled = true;
    textarea.readOnly = true;
    textarea.value = formatSoftwareAdminsForInput(state.config.softwareAdmins || []);
  }
  if (hint) {
    const hasAdmins = hasAuthorizedSoftwareAdmins();
    if (!hasAdmins) {
      hint.textContent = '尚未从审核权限分页读取到管理员邮箱，请确认 Sheet 中配置正确。';
    } else if (isCurrentUserSoftwareAdmin()) {
      hint.textContent = `共 ${state.config.softwareAdmins.length} 位管理员（从审核权限分页读取）。`;
    } else {
      hint.textContent = '列表从审核权限分页自动读取，如需申请权限请在表格中提交申请。';
    }
  }
  const pendingWrapper = elements.softwareAdminsPending;
  const pendingList = elements.softwareAdminsPendingList;
  const pending = Array.isArray(state.pendingAdminRequests) ? state.pendingAdminRequests : [];
  if (pendingWrapper && pendingList) {
    const shouldShow = pending.length > 0 && isCurrentUserSoftwareAdmin();
    pendingWrapper.hidden = !shouldShow;
    if (shouldShow) {
      pendingList.innerHTML = pending
        .map((request) => {
          const name = request?.name ? escapeHtml(request.name) : '未填写姓名';
          const email = request?.email ? escapeHtml(request.email) : '未提供邮箱';
          const status = request?.status ? escapeHtml(request.status) : '待授权';
          return `<li>${name}（${email}）- ${status}</li>`;
        })
        .join('');
    }
  }
}

function showDuplicateUploadDialog(files = [], summaryItems = []) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';
    overlay.style.zIndex = '120000';
    const modal = document.createElement('div');
    modal.className = 'app-modal';
    modal.style.maxWidth = '860px';
    modal.style.width = '90vw';
    modal.style.zIndex = '120001';

    const header = document.createElement('header');
    header.className = 'app-modal-header';
    const titleEl = document.createElement('h3');
    titleEl.textContent = '检测到已入库文件';
    header.appendChild(titleEl);
    modal.appendChild(header);

    const body = document.createElement('div');
    body.className = 'app-modal-body';
    const msg = document.createElement('p');
    msg.textContent = '以下文件已入库。选择“继续上传”将重复上传，选择“跳过重复”仅上传其他分类。';
    body.appendChild(msg);

    if (Array.isArray(summaryItems) && summaryItems.length) {
      const list = document.createElement('ul');
      list.className = 'app-modal-detail-list';
      summaryItems.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
      body.appendChild(list);
    }

    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'duplicate-grid-wrapper';
    gridWrapper.style.display = 'grid';
    gridWrapper.style.gridTemplateColumns = '2fr 3fr';
    gridWrapper.style.gap = '12px';
    gridWrapper.style.alignItems = 'stretch';

    const thumbArea = document.createElement('div');
    thumbArea.className = 'duplicate-thumb-area';
    thumbArea.style.display = 'grid';
    thumbArea.style.gridTemplateColumns = 'repeat(auto-fill, minmax(90px, 1fr))';
    thumbArea.style.gap = '10px';
    thumbArea.style.maxHeight = '380px';
    thumbArea.style.overflowY = 'auto';

    const previewArea = document.createElement('div');
    previewArea.className = 'duplicate-preview-area';
    previewArea.style.minHeight = '280px';
    previewArea.style.background = '#0f172a';
    previewArea.style.borderRadius = '12px';
    previewArea.style.display = 'flex';
    previewArea.style.alignItems = 'center';
    previewArea.style.justifyContent = 'center';
    previewArea.style.overflow = 'hidden';
    previewArea.style.position = 'relative';
    previewArea.style.padding = '12px';

    const previewInfo = document.createElement('div');
    previewInfo.className = 'duplicate-preview-info';
    previewInfo.style.position = 'absolute';
    previewInfo.style.left = '12px';
    previewInfo.style.right = '12px';
    previewInfo.style.bottom = '12px';
    previewInfo.style.color = '#e2e8f0';
    previewInfo.style.fontSize = '12px';
    previewInfo.style.background = 'rgba(15,23,42,0.55)';
    previewInfo.style.padding = '6px 8px';
    previewInfo.style.borderRadius = '8px';

    const buildFileUrl = (rawPath = '') => {
      if (!rawPath) return '';
      if (rawPath.startsWith('file://')) return rawPath;
      let normalized = rawPath.replace(/\\/g, '/');
      if (!normalized.startsWith('/')) {
        normalized = `/${normalized}`;
      }
      return `file://${encodeURI(normalized)}`;
    };
    const isImage = (name = '') => ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif'].some((ext) =>
      name.toLowerCase().endsWith(ext)
    );
    const isVideo = (name = '') => ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv'].some((ext) =>
      name.toLowerCase().endsWith(ext)
    );

    const renderPreview = (file) => {
      previewArea.innerHTML = '';
      const name = file.name || file.originalName || file.path || '';
      const localUrl = buildFileUrl(file.path || '');
      const thumb = file.thumbnail || localUrl;
      let content;
      if (isImage(name) && thumb) {
        content = document.createElement('img');
        content.src = thumb;
        content.style.maxWidth = '100%';
        content.style.maxHeight = '100%';
        content.style.objectFit = 'contain';
      } else if (isVideo(name) && localUrl) {
        content = document.createElement('video');
        content.src = localUrl;
        content.controls = true;
        content.autoplay = false;
        content.muted = true;
        content.loop = true;
        content.style.maxWidth = '100%';
        content.style.maxHeight = '100%';
        content.style.objectFit = 'contain';
      } else {
        content = document.createElement('div');
        content.className = 'slot-grid-preview-placeholder';
        content.textContent = (name.split('.').pop() || '?').toUpperCase().slice(0, 4);
        content.style.width = '100%';
        content.style.height = '100%';
      }
      previewArea.appendChild(content);
      const info = previewInfo.cloneNode(false);
      info.textContent = name;
      previewArea.appendChild(info);
    };

    let currentIndex = 0;
    const selectItem = (index) => {
      currentIndex = index;
      thumbArea.querySelectorAll('.duplicate-thumb').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === index);
      });
      renderPreview(files[index]);
    };

    files.forEach((file, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'duplicate-thumb';
      btn.style.border = '1px solid #e2e8f0';
      btn.style.borderRadius = '10px';
      btn.style.padding = '6px';
      btn.style.background = '#fff';
      btn.style.display = 'flex';
      btn.style.flexDirection = 'column';
      btn.style.alignItems = 'center';
      btn.style.gap = '6px';
      btn.style.cursor = 'pointer';

      const thumbBox = document.createElement('div');
      thumbBox.style.width = '100%';
      thumbBox.style.aspectRatio = '1';
      thumbBox.style.display = 'flex';
      thumbBox.style.alignItems = 'center';
      thumbBox.style.justifyContent = 'center';
      thumbBox.style.background = '#f8fafc';
      thumbBox.style.borderRadius = '8px';
      const name = file.name || file.originalName || file.path || '';
      const localUrl = buildFileUrl(file.path || '');
      const thumbUrl = file.thumbnail || (isImage(name) ? localUrl : '');
      if (thumbUrl) {
        const img = document.createElement('img');
        img.src = thumbUrl;
        img.alt = name;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        thumbBox.appendChild(img);
      } else {
        const badge = document.createElement('div');
        badge.className = 'review-file-badge';
        badge.textContent = (name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4);
        thumbBox.appendChild(badge);
      }
      const label = document.createElement('div');
      label.textContent = name;
      label.style.fontSize = '11px';
      label.style.color = '#475569';
      label.style.textOverflow = 'ellipsis';
      label.style.overflow = 'hidden';
      label.style.whiteSpace = 'nowrap';
      label.style.width = '100%';

      btn.appendChild(thumbBox);
      btn.appendChild(label);
      btn.addEventListener('click', () => selectItem(index));
      thumbArea.appendChild(btn);
    });

    gridWrapper.appendChild(thumbArea);
    const previewWrapper = document.createElement('div');
    previewWrapper.style.display = 'flex';
    previewWrapper.style.flexDirection = 'column';
    previewWrapper.style.gap = '8px';
    const hint = document.createElement('div');
    hint.textContent = '点击左侧缩略图可预览大图';
    hint.style.fontSize = '12px';
    hint.style.color = '#64748b';
    previewWrapper.appendChild(hint);
    previewWrapper.appendChild(previewArea);
    gridWrapper.appendChild(previewWrapper);

    body.appendChild(gridWrapper);
    modal.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'app-modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '跳过重复';
    cancelBtn.className = 'ghost';
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = '继续上传';
    okBtn.className = 'primary';
    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    modal.appendChild(actions);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    selectItem(0);

    const cleanup = () => {
      overlay.remove();
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
    okBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });
  });
}

function isSoftwareReviewAccessible() {
  return isCurrentUserSoftwareAdmin();
}

function updateSoftwareReviewAccess() {
  if (HIDE_SOFTWARE_REVIEW) {
    if (elements.softwareReviewTab) {
      elements.softwareReviewTab.hidden = true;
      elements.softwareReviewTab.classList.add('hidden');
      elements.softwareReviewTab.style.display = 'none';
    }
    if (elements.softwareReviewPanel) {
      elements.softwareReviewPanel.hidden = true;
      elements.softwareReviewPanel.dataset.restricted = 'true';
    }
    if (state.activeView === 'software-review') {
      switchAppView('software');
    }
    return;
  }
  const accessible = isSoftwareReviewAccessible();
  if (elements.softwareReviewTab) {
    elements.softwareReviewTab.hidden = !accessible;
    elements.softwareReviewTab.classList.toggle('hidden', !accessible);
    elements.softwareReviewTab.style.display = accessible ? '' : 'none';
  }
  if (elements.softwareReviewPanel) {
    elements.softwareReviewPanel.dataset.restricted = accessible ? 'false' : 'true';
    elements.softwareReviewPanel.hidden = !accessible;
  }
  if (!accessible && state.activeView === 'software-review') {
    switchAppView('software');
  }
  renderSoftwareReviewList();
}

function applySoftwareAdminData(admins = [], pending = []) {
  state.config.softwareAdmins = Array.isArray(admins)
    ? admins.map((email) => email && email.trim()).filter((email) => email && email.includes('@'))
    : [];
  state.pendingAdminRequests = Array.isArray(pending)
    ? pending
      .map((item) => ({
        name: (item?.name || '').trim(),
        email: (item?.email || '').trim(),
        status: (item?.status || '').trim()
      }))
      .filter((item) => item.email)
    : [];
  updateSoftwareAdminVisibility();
  updateSoftwareReviewAccess();
  updateSoftwareConfigVisibility();
  maybeNotifyPendingAdminRequests();
}

function maybeNotifyPendingAdminRequests() {
  const pending = Array.isArray(state.pendingAdminRequests) ? state.pendingAdminRequests : [];
  if (!isCurrentUserSoftwareAdmin()) {
    state.lastPendingAdminCount = pending.length;
    return;
  }
  if (!pending.length) {
    if (state.lastPendingAdminCount !== 0) {
      state.lastPendingAdminCount = 0;
    }
    return;
  }
  if (pending.length !== state.lastPendingAdminCount) {
    appendLog({
      status: 'info',
      message: `有 ${pending.length} 个管理员授权申请，请到审核权限分页处理。`,
      broadcastGlobal: true
    });
    state.lastPendingAdminCount = pending.length;
  }
}

function updateSoftwareConfigVisibility() {
  const visible = isCurrentUserSoftwareAdmin();
  if (elements.softwareConfigFields) {
    elements.softwareConfigFields.hidden = !visible;
  }
  if (elements.softwareConfigPanel) {
    elements.softwareConfigPanel.hidden = !visible;
  }
}

if (elements.softwareEditToggle) {
  elements.softwareEditToggle.checked = state.softwareEditEnabled;
}

let cachedSlotPresets = [];
let cachedPreferences = {};

function openExternalLink(url) {
  if (!url) {
    return;
  }
  if (window.bridge?.openExternal) {
    window.bridge.openExternal(url);
    return;
  }
  window.open(url, '_blank');
}

function showConfirmationDialog(options = {}) {
  const {
    title = '提示',
    message = '',
    details = [],
    confirmText = '确定',
    cancelText = '取消',
    destructive = false
  } = options;
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'app-modal';
    const header = document.createElement('header');
    header.className = 'app-modal-header';
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    header.appendChild(titleEl);
    modal.appendChild(header);
    const body = document.createElement('div');
    body.className = 'app-modal-body';
    if (message) {
      message.split('\n').forEach((line) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        body.appendChild(paragraph);
      });
    }
    const detailItems = Array.isArray(details) ? details.filter(Boolean) : [];
    if (detailItems.length) {
      const list = document.createElement('ul');
      list.className = 'app-modal-detail-list';
      detailItems.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
      body.appendChild(list);
    }
    modal.appendChild(body);
    const actions = document.createElement('div');
    actions.className = 'app-modal-actions';
    let cancelBtn = null;
    if (cancelText) {
      cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'ghost';
      cancelBtn.textContent = cancelText;
      actions.appendChild(cancelBtn);
    }
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = destructive ? 'ghost danger' : 'primary';
    confirmBtn.textContent = confirmText;
    actions.appendChild(confirmBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const cleanup = (result) => {
      document.removeEventListener('keydown', handleKeyDown);
      overlay.remove();
      resolve(result);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        cleanup(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup(false);
      }
    });
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => cleanup(false));
    }
    confirmBtn.addEventListener('click', () => cleanup(true));
    setTimeout(() => {
      confirmBtn.focus();
    }, 0);
  });
}

function showTextInputDialog(options = {}) {
  const {
    title = '请输入内容',
    message = '',
    placeholder = '',
    defaultValue = '',
    confirmText = '确定',
    cancelText = '取消'
  } = options;
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const heading = document.createElement('h3');
    heading.textContent = title;
    modal.appendChild(heading);
    if (message) {
      const paragraph = document.createElement('p');
      paragraph.textContent = message;
      modal.appendChild(paragraph);
    }
    const textarea = document.createElement('textarea');
    textarea.placeholder = placeholder;
    textarea.rows = 4;
    textarea.value = defaultValue;
    modal.appendChild(textarea);
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ghost';
    cancelBtn.textContent = cancelText;
    actions.appendChild(cancelBtn);
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'primary';
    confirmBtn.textContent = confirmText;
    actions.appendChild(confirmBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = (result) => {
      document.removeEventListener('keydown', handleKeyDown);
      overlay.remove();
      resolve(result);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        cleanup(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup(null);
      }
    });
    cancelBtn.addEventListener('click', () => cleanup(null));
    confirmBtn.addEventListener('click', () => cleanup(textarea.value.trim()));
    setTimeout(() => textarea.focus(), 0);
  });
}

function showInfoDialog(options = {}) {
  return showConfirmationDialog({
    cancelText: null,
    confirmText: options.confirmText || '知道了',
    ...options
  });
}

function getSoftwareReviewBlockReason() {
  if (!state.currentUserEmail) {
    return '尚未获取当前登录邮箱，请点击顶部的“登录 Google”重新授权。';
  }
  if (!hasSoftwareSubmissionConfig()) {
    return '请在设置 → AI 软件配置中填写“软件申请分页”并保存。';
  }
  if (!isSoftwareReviewAccessible()) {
    const admins = (state.config.softwareAdmins || []).join('、') || '暂无管理员';
    return `当前账号（${state.currentUserEmail}）未在审核权限分页中标记为“已授权”。当前管理员：${admins}`;
  }
  return '';
}

function switchAppView(view) {
  let requestedView = APP_VIEWS.includes(view) ? view : 'upload';
  if (HIDE_SOFTWARE_REVIEW && requestedView === 'software-review') {
    requestedView = 'software';
  }
  if (HIDE_GROUP_MEDIA && requestedView === 'group-media') {
    requestedView = 'upload';
  }
  const targetView = requestedView;
  let resolvedView = targetView === 'review' && !isReviewPanelAccessible() ? 'upload' : targetView;
  if (resolvedView === 'software-review') {
    const blockReason = getSoftwareReviewBlockReason();
    if (blockReason) {
      appendLog({
        status: 'error',
        message: `无法打开软件审核：${blockReason}`
      });
      resolvedView = 'software';
    }
  }
  state.activeView = resolvedView;
  document.querySelectorAll('.view-tab').forEach((tab) => {
    const isActive = tab.dataset.view === resolvedView;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
  document.querySelectorAll('.view-panel').forEach((panel) => {
    const isActive = panel.dataset.view === resolvedView;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
    panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');

  });

  // 当切换到组内媒体视图时，更新提交人
  if (resolvedView === 'group-media') {
    // 使用 setTimeout 确保在 DOM 更新后执行
    setTimeout(() => {
      if (typeof window.gmUpdateSubmitter === 'function') {
        window.gmUpdateSubmitter();
      }
    }, 0);
  }

  if (resolvedView === 'software' && hasSoftwareDirectoryConfig() && !state.softwareEntries.length) {
    refreshSoftwareDirectory({ silent: true });
  }
  if (resolvedView === 'software-review' && hasSoftwareSubmissionConfig() && !state.softwareReviewFetched) {
    refreshSoftwareSubmissions({ silent: true });
  }
  if (resolvedView === 'review') {
    loadReviewEntries({ silent: true });
  }

  // 切换到信息板时，检查是否需要显示更新横幅
  if (resolvedView === 'notice-board') {
    checkNoticeBoardUpdate(); // 重新检查，会自动显示横幅
  }

  // 切换到每日打卡面板时，初始化打卡模块
  if (resolvedView === 'daily-checkin') {
    const tryInitCheckin = (attempts = 0) => {
      if (window.DailyCheckin && typeof window.DailyCheckin.init === 'function') {
        window.DailyCheckin.init();
      } else if (attempts < 10) {
        // 脚本可能还没加载完，重试
        setTimeout(() => tryInitCheckin(attempts + 1), 100);
      }
    };
    setTimeout(() => tryInitCheckin(), 0);
  }
}

function initViewTabs() {
  const tabContainer = document.querySelector('.view-tabs');
  if (!tabContainer) {
    return;
  }
  tabContainer.addEventListener('click', (event) => {
    const tab = event.target.closest('.view-tab');
    if (!tab) return;

    if (tab.classList.contains('disabled')) {
      if (tab.dataset.view === 'review') {
        appendLog({
          status: 'error',
          message: '请先将身份切换为审核人员或双重身份，才能查看审核面板'
        });
      }
      return;
    }
    switchAppView(tab.dataset.view || 'daily-checkin');
  });
  switchAppView(state.activeView || 'daily-checkin');
}

function initUserRolePreference() {
  const stored = localStorage.getItem(USER_ROLE_STORAGE_KEY);
  setUserRole(stored || 'submitter', { skipPersist: true });
  if (elements.userRole) {
    elements.userRole.value = state.userRole;
  }
}

function isReviewPanelAccessible() {
  return state.userRole !== 'submitter';
}

function updateReviewTabState() {
  const tab = elements.reviewTab;
  if (!tab) return;
  const hasAccess = isReviewPanelAccessible();

  // 直接隐藏/显示标签，而不是禁用
  tab.hidden = !hasAccess;

  // 如果当前在审核面板但失去了访问权限，切换到上传面板
  if (!hasAccess && state.activeView === 'review') {
    switchAppView('upload');
  }
}

function setUserRole(role, options = {}) {
  const allowed = ['submitter', 'reviewer', 'both'];
  const nextRole = allowed.includes(role) ? role : 'submitter';
  state.userRole = nextRole;
  if (!options.skipPersist) {
    try {
      localStorage.setItem(USER_ROLE_STORAGE_KEY, nextRole);
    } catch (error) {
      console.warn('Failed to persist user role', error);
    }
  }
  state.reviewNotificationsPrimed = false;
  state.reviewEntryCache = new Map();
  state.lastKnownStatuses = new Map();
  clearAcknowledgements();
  updateReviewTabState();
}

function isReviewerRole() {
  return state.userRole === 'reviewer' || state.userRole === 'both';
}

function isSubmitterRole() {
  return state.userRole === 'submitter' || state.userRole === 'both';
}

function ensureAudioContext() {
  if (state.audioContext) {
    return state.audioContext;
  }
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }
  state.audioContext = new AudioContextCtor();
  return state.audioContext;
}

function primeAudioContext() {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  state.audioUnlocked = true;
}

function playNotificationSound(type = 'review') {
  if (!state.audioUnlocked) {
    primeAudioContext();
  }
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }
  const settings = NOTIFICATION_SOUNDS[type] || NOTIFICATION_SOUNDS.review;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.frequency.value = settings.frequency;
  oscillator.type = 'sine';
  gain.gain.value = 0.001;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  const duration = settings.duration || 0.25;
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function resolveAudioSource(raw = '') {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('file://')) {
    return trimmed;
  }
  if (/^[a-zA-Z]:\\/.test(trimmed)) {
    const normalized = trimmed.replace(/\\/g, '/');
    return `file:///${encodeURI(normalized)}`;
  }
  if (trimmed.startsWith('/')) {
    return `file://${encodeURI(trimmed)}`;
  }
  return trimmed;
}

function resolveFileUrl(filePath) {
  if (!filePath) return '';
  const trimmed = String(filePath).trim();
  if (!trimmed) return '';

  // 已经是完整URL,直接返回
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('file://')) {
    return trimmed;
  }

  // Windows 路径 (C:\path\to\file)
  if (/^[a-zA-Z]:\\/.test(trimmed)) {
    const normalized = trimmed.replace(/\\/g, '/');
    return `file:///${encodeURI(normalized)}`;
  }

  // Unix 绝对路径 (/path/to/file)
  if (trimmed.startsWith('/')) {
    return `file://${encodeURI(trimmed)}`;
  }

  // 其他情况
  return encodeURI(trimmed);
}

function resetCustomAudioPlayer(type) {
  if (!state.customAudioPlayers) {
    state.customAudioPlayers = { review: null, suggestion: null, approved: null };
  }
  if (state.customAudioPlayers[type]) {
    try {
      state.customAudioPlayers[type].pause();
    } catch (error) {
      // ignore
    }
    state.customAudioPlayers[type] = null;
  }
}

function playCustomAudio(type) {
  if (!state.customAudioPlayers) {
    state.customAudioPlayers = { review: null, suggestion: null, approved: null };
  }
  const soundKeyMap = {
    review: 'notificationSoundReview',
    suggestion: 'notificationSoundSuggestion',
    approved: 'notificationSoundApproved'
  };
  const key = soundKeyMap[type] || 'notificationSoundReview';
  const src = resolveAudioSource(state.config[key]);
  if (!src) {
    resetCustomAudioPlayer(type);
    return false;
  }
  if (!state.customAudioPlayers[type] || state.customAudioPlayers[type]._configuredSrc !== src) {
    state.customAudioPlayers[type] = new Audio(src);
    state.customAudioPlayers[type]._configuredSrc = src;
  }
  const player = state.customAudioPlayers[type];
  try {
    player.currentTime = 0;
    const playPromise = player.play();
    if (playPromise?.catch) {
      playPromise.catch((error) => console.warn('自定义提示音播放失败', error));
    }
    return true;
  } catch (error) {
    console.warn('自定义提示音播放失败', error);
    return false;
  }
}

function speakNotification(type) {
  if (typeof window.speechSynthesis === 'undefined' || typeof window.SpeechSynthesisUtterance === 'undefined') {
    return false;
  }
  const text = NOTIFICATION_MESSAGES[type] || '收到通知';
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    console.warn('语音播报失败', error);
    return false;
  }
}

function triggerNotification(type) {
  const mode = state.config.notificationMode || 'speech';
  if (mode === 'silent') {
    return;
  }
  if (mode === 'speech') {
    if (speakNotification(type)) {
      return;
    }
    playNotificationSound(type);
    return;
  }
  if (mode === 'custom') {
    if (playCustomAudio(type)) {
      return;
    }
    playNotificationSound(type);
    return;
  }
  playNotificationSound(type);
}

function normalizeCustomTextDef(def = {}, fallbackIndex = 0) {
  const id = def.id || `ct-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const scope = def.scope === CUSTOM_TEXT_SCOPE.SLOT ? CUSTOM_TEXT_SCOPE.SLOT : CUSTOM_TEXT_SCOPE.GLOBAL;
  const label = def.label || `文本块${fallbackIndex + 1}`;
  const tokenKey = def.tokenKey || `customText:${id}`;
  const inputType = def.inputType || 'text'; // 'text' or 'select'
  const options = Array.isArray(def.options) ? def.options : [];
  return {
    id,
    scope,
    label,
    tokenKey,
    token: `{{${tokenKey}}}`,
    inputType,
    options
  };
}

function loadCustomTextConfig(config = {}) {
  console.log('[loadCustomTextConfig] Loading customText config:', config.customTextDefs);
  const defs = Array.isArray(config.customTextDefs) ? config.customTextDefs : [];
  console.log('[loadCustomTextConfig] Raw defs count:', defs.length);
  state.customTextDefs = defs
    .map((def, index) => {
      const normalized = normalizeCustomTextDef(def, index);
      console.log(`[loadCustomTextConfig] Normalized def ${index}:`, normalized);
      return normalized;
    })
    .filter((def) => def.tokenKey !== 'eventName');
  console.log('[loadCustomTextConfig] Final customTextDefs count:', state.customTextDefs.length);
  const globals = config.customTextGlobals || {};
  state.customTextGlobals = {};
  state.customTextDefs.forEach((def) => {
    if (Object.prototype.hasOwnProperty.call(globals, def.id)) {
      state.customTextGlobals[def.id] = globals[def.id];
      console.log(`[loadCustomTextConfig] Restored global value for ${def.id}:`, globals[def.id]);
    }
  });
  syncCustomTextConfig();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeNamingPreset(preset = {}, index = 0) {
  const id = preset.id || `naming-preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    label: preset.label ? preset.label.trim() : `命名规则 ${index + 1}`,
    pattern: preset.pattern || state.config.renamePattern || DEFAULT_PATTERN
  };
}

function syncNamingPresetConfig() {
  state.config.namingPresets = state.namingPresets.map((item) => ({ ...item }));
}

function normalizeFolderPreset(preset = {}, index = 0) {
  const id = preset.id || `folder-preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    label: preset.label ? preset.label.trim() : `文件夹规则 ${index + 1}`,
    pattern: preset.pattern || state.config.folderPattern || DEFAULT_FOLDER_PATTERN,
    builtIn: Boolean(preset.builtIn)
  };
}

function syncFolderPresetConfig() {
  state.config.folderNamingPresets = state.folderNamingPresets.map((item) => ({ ...item }));
}

function loadFolderPresets(presets = []) {
  if (!Array.isArray(presets)) {
    presets = [];
  }
  const normalized = presets.map((preset, index) => normalizeFolderPreset(preset, index));
  BUILT_IN_FOLDER_PRESETS.forEach((preset) => {
    if (!normalized.some((item) => item.pattern === preset.pattern)) {
      normalized.unshift(normalizeFolderPreset(preset, normalized.length));
    }
  });
  state.folderNamingPresets = normalized;
  syncFolderPresetConfig();
  renderFolderPresetList();
  renderSlots();
}

function loadNamingPresets(presets = []) {
  if (!Array.isArray(presets)) {
    presets = [];
  }
  const normalized = presets.map((preset, index) => normalizeNamingPreset(preset, index));
  BUILT_IN_NAMING_PRESETS.forEach((preset) => {
    if (!normalized.some((item) => item.pattern === preset.pattern)) {
      normalized.unshift(normalizeNamingPreset(preset, normalized.length));
    }
  });
  state.namingPresets = normalized;
  syncNamingPresetConfig();
  renderNamingPresetList();
  renderSlots();
}

function getNamingPresetById(id) {
  return state.namingPresets.find((preset) => preset.id === id) || null;
}

function describePatternTokenSequence(pattern = '') {
  const tokens = parsePattern(pattern);
  if (!tokens.length) {
    return '';
  }
  return tokens
    .map((token) => {
      if (token.type === 'token') {
        return tokenLabel({ type: 'token', value: token.value });
      }
      return token.value;
    })
    .join(' · ');
}

function buildNamingSampleMap(slot = state.slots[0]) {
  const firstSlot = slot;
  const sampleFile = firstSlot?.files?.[0];
  const originalName = sampleFile?.name ? sampleFile.name.replace(/\.[^.]+$/, '') : '原文件名';
  const subject = firstSlot?.subject || '图片名称';
  const eventName = firstSlot?.eventName || '事件名称';
  const sampleMap = {
    '{{country}}': elements.naming.country.value.trim() || '国家',
    '{{customDate}}': formatDateValue(elements.naming.date.value) || '日期',
    '{{software}}': elements.naming.software.value.trim() || '软件',
    '{{subject}}': subject,
    '{{eventName}}': eventName,
    '{{submitter}}': elements.metadata.submitter.value.trim() || '提交人',
    '{{admin}}': firstSlot?.admin || '管理员',
    '{{counter}}': String(Number(elements.counterStart.value) || state.config.counterStart || 1).padStart(
      Number(elements.counterPadding.value) || state.config.counterPadding || 3,
      '0'
    ),
    '{{originalName}}': originalName,
    '{{subjectOrOriginal}}': subject || originalName,
    '{{aiKeywords}}': 'AI关键词',
    '{{customPlaceholder}}': '自定义'
  };
  state.customTextDefs.forEach((def) => {
    const value =
      def.scope === CUSTOM_TEXT_SCOPE.GLOBAL
        ? state.customTextGlobals[def.id] || ''
        : firstSlot?.customTexts?.[def.id] || '';
    const key = `{{${def.tokenKey}}}`;
    sampleMap[key] = value || def.label;
  });

  return sampleMap;
}

function renderPatternPreview(pattern = '', slot = state.slots[0]) {
  const tokens = parsePattern(pattern);
  if (!tokens.length) {
    return '';
  }
  const sampleMap = buildNamingSampleMap(slot);

  const parts = tokens
    .map((token) => {
      if (token.type !== 'token') {
        return token.value;
      }
      const value = sampleMap[token.value];
      if (value && value.trim()) {
        return value;
      }
      const label = tokenLabel({ type: 'token', value: token.value });
      return label;
    })
    .filter((part) => part != null && part !== '');
  const result = parts.join('-');
  if (result) {
    return result;
  }
  const firstToken = tokens.find((token) => token.type === 'token');
  return firstToken ? tokenLabel({ type: 'token', value: firstToken.value }) : '暂无示例';
}

function renderNamingPresetList() {
  const container = elements.namingPresetList;
  if (!container) return;
  if (!state.namingPresets.length) {
    container.innerHTML = '<div class="muted">尚未保存任何命名规则预设</div>';
    return;
  }
  container.innerHTML = state.namingPresets
    .map((preset) => {
      const tokenSequence = describePatternTokenSequence(preset.pattern || '');
      const previewText = renderPatternPreview(preset.pattern || '');
      return `
        <div class="naming-preset-item" data-preset-id="${preset.id}">
          <div class="naming-preset-row">
            <input type="text" class="naming-preset-label" value="${escapeHtml(preset.label)}" placeholder="命名规则名称" />
            <div class="naming-preset-actions">
              <button type="button" data-action="apply" class="ghost">加载</button>
              <button type="button" data-action="delete" class="ghost danger">删除</button>
            </div>
          </div>
          <div class="naming-preset-meta">
            <span class="naming-preset-order">字符块顺序：${escapeHtml(tokenSequence)}</span>
            <span class="naming-preset-preview">命名预览：${escapeHtml(previewText)}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderFolderPresetList() {
  const container = elements.folderPresetList;
  if (!container) {
    return;
  }
  if (!state.folderNamingPresets.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = state.folderNamingPresets
    .map((preset) => {
      const tokenSequence = describePatternTokenSequence(preset.pattern || '');
      const previewText = renderPatternPreview(preset.pattern || '');
      return `
        <div class="naming-preset-item" data-preset-id="${preset.id}">
          <div class="naming-preset-row">
            <input type="text" class="naming-preset-label" value="${escapeHtml(preset.label)}" placeholder="文件夹规则名称" />
            <div class="naming-preset-actions">
              <button type="button" data-action="apply-folder" class="ghost">加载</button>
              <button type="button" data-action="delete-folder" class="ghost danger">删除</button>
            </div>
          </div>
          <div class="naming-preset-meta">
            <span class="naming-preset-order">字符块顺序：${escapeHtml(tokenSequence)}</span>
            <span class="naming-preset-preview">命名预览：${escapeHtml(previewText)}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function addFolderPreset(label, pattern) {
  const preset = normalizeFolderPreset(
    {
      label: label?.trim(),
      pattern: pattern || state.config.folderPattern,
      builtIn: false
    },
    state.folderNamingPresets.length
  );
  state.folderNamingPresets.push(preset);
  syncFolderPresetConfig();
  renderFolderPresetList();
  renderSlots();
}

function removeFolderPreset(id) {
  if (!id) return;
  state.folderNamingPresets = state.folderNamingPresets.filter((preset) => preset.id !== id);
  state.slots.forEach((slot) => {
    if (slot.folderNamingPresetId === id) {
      slot.folderNamingPresetId = '';
    }
  });
  syncFolderPresetConfig();
  renderFolderPresetList();
  renderSlots();
  persistSlotPresets();
}

function getFolderPresetById(id) {
  return state.folderNamingPresets.find((preset) => preset.id === id) || null;
}

function renderFolderPresetOptions(selected = '') {
  if (!state.folderNamingPresets.length) {
    return '';
  }
  return state.folderNamingPresets
    .map(
      (preset) =>
        `<option value="${preset.id}" ${preset.id === selected ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`
    )
    .join('');
}

async function handleFolderPresetListClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const item = button.closest('.naming-preset-item');
  if (!item) return;
  const id = item.dataset.presetId;
  if (button.dataset.action === 'apply-folder') {
    const preset = getFolderPresetById(id);
    if (!preset) return;
    initFolderTokenBuilder(preset.pattern);
  } else if (button.dataset.action === 'delete-folder') {
    const confirmed = await showConfirmationDialog({
      title: '删除文件夹命名预设',
      message: '确认删除该文件夹命名预设吗？'
    });
    if (confirmed) {
      removeFolderPreset(id);
    }
  }
}

function handleFolderPresetLabelInput(event) {
  const input = event.target.closest('.naming-preset-label');
  if (!input) return;
  const item = input.closest('.naming-preset-item');
  if (!item) return;
  const preset = getFolderPresetById(item.dataset.presetId);
  if (!preset) return;
  preset.label = input.value?.trim() || preset.label;
  syncFolderPresetConfig();
}

function addNamingPreset(label, pattern) {
  const presetLabel = label?.trim() || `命名规则 ${state.namingPresets.length + 1}`;
  const presetPattern = pattern || state.config.renamePattern || DEFAULT_PATTERN;
  const preset = {
    id: `naming-preset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label: presetLabel,
    pattern: presetPattern
  };
  state.namingPresets.push(preset);
  syncNamingPresetConfig();
  renderNamingPresetList();
  renderSlots();
}

function removeNamingPreset(id) {
  if (!id) return;
  state.namingPresets = state.namingPresets.filter((preset) => preset.id !== id);
  state.slots.forEach((slot) => {
    if (slot.namingPresetId === id) {
      slot.namingPresetId = '';
    }
  });
  syncNamingPresetConfig();
  renderNamingPresetList();
  renderSlots();
  persistSlotPresets();
}

function updateNamingPresetLabel(id, label) {
  const preset = getNamingPresetById(id);
  if (!preset) return;
  preset.label = label?.trim() || preset.label;
  syncNamingPresetConfig();
}

function getSlotPattern(slot) {
  const preset = slot && slot.namingPresetId ? getNamingPresetById(slot.namingPresetId) : null;
  if (preset && preset.pattern) {
    return preset.pattern;
  }
  return state.config.renamePattern || DEFAULT_PATTERN;
}

function getSlotFolderPattern(slot) {
  const preset = slot && slot.folderNamingPresetId ? getFolderPresetById(slot.folderNamingPresetId) : null;
  if (preset && preset.pattern) {
    return preset.pattern;
  }
  return state.config.folderPattern || DEFAULT_FOLDER_PATTERN;
}

function collectTokenValues(pattern) {
  return parsePattern(pattern || '')
    .filter((token) => token.type === 'token')
    .map((token) => token.value);
}

function getSlotTokenUsage(slot) {
  const tokens = new Set();
  collectTokenValues(getSlotPattern(slot)).forEach((token) => tokens.add(token));
  collectTokenValues(getSlotFolderPattern(slot)).forEach((token) => tokens.add(token));
  return tokens;
}

function slotShouldShowSubject(tokens) {
  return tokens.has('{{subject}}') || tokens.has('{{subjectOrOriginal}}');
}

function slotShouldShowEventName(tokens) {
  return tokens.has('{{eventName}}');
}

function slotShouldShowAdmin(tokens) {
  return tokens.has('{{admin}}');
}

function getSlotNamingPreviewText(slot) {
  if (!slot) {
    return '暂无示例';
  }
  const preview = renderPatternPreview(getSlotPattern(slot), slot);
  return preview || '暂无示例';
}

function getSlotFolderPreviewText(slot) {
  if (!slot) {
    return '暂无示例';
  }
  const preview = renderPatternPreview(getSlotFolderPattern(slot), slot);
  return preview || '暂无示例';
}

function updateSlotPreview(slotId) {
  if (!elements.slotContainer) return;
  const slot = getSlot(slotId);
  if (!slot) return;

  const namingPreviewText = getSlotNamingPreviewText(slot);
  const folderPreviewText = getSlotFolderPreviewText(slot);

  // 更新设置页面的预览
  const target = elements.slotContainer.querySelector(`.slot-naming-preview[data-slot-id="${slotId}"]`);
  if (target) {
    target.textContent = namingPreviewText;
  }
  const folderTarget = elements.slotContainer.querySelector(`.slot-folder-preview[data-slot-id="${slotId}"]`);
  if (folderTarget) {
    folderTarget.textContent = folderPreviewText;
  }

  // 更新header中的紧凑预览
  const headerNamingPreview = elements.slotContainer.querySelector(`.slot-preview-value[data-slot-id="${slotId}"][data-preview-type="naming"]`);
  if (headerNamingPreview) {
    headerNamingPreview.textContent = namingPreviewText;
  }
  const headerFolderPreview = elements.slotContainer.querySelector(`.slot-preview-value[data-slot-id="${slotId}"][data-preview-type="folder"]`);
  if (headerFolderPreview) {
    headerFolderPreview.textContent = folderPreviewText;
  }
}

function refreshSlotNamingPreviews() {
  state.slots.forEach((slot) => updateSlotPreview(slot.id));
}

function renderNamingPresetOptions(selected = '') {
  if (!state.namingPresets.length) {
    return '';
  }
  return state.namingPresets
    .map(
      (preset) =>
        `<option value="${preset.id}" ${preset.id === selected ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`
    )
    .join('');
}

/**
 * 获取当前可用的任务类型列表
 * 优先使用从表格读取的 taskTypes，如果为空则使用默认列表
 * @returns {string[]} 任务类型列表
 */
function getKnownTaskTypes() {
  if (state.taskTypes && state.taskTypes.length > 0) {
    return state.taskTypes;
  }
  // 兜底：表格未配置时使用默认列表
  return ['sora视频', '简单图', '口播动画', '口播完整', '美工图', '普通视频', '视频-难', '灾难图', '主耶稣图'];
}

/**
 * 渲染任务类型下拉选项
 * @param {string} selected - 当前选中的任务类型
 * @returns {string} HTML option 字符串
 */
function renderTaskTypeOptions(selected = '') {
  const knownTypes = getKnownTaskTypes();
  const isCustom = selected && !knownTypes.includes(selected);

  let html = '<option value="">请选择</option>';
  html += knownTypes.map(type =>
    `<option value="${escapeHtml(type)}" ${selected === type ? 'selected' : ''}>${escapeHtml(type)}</option>`
  ).join('');
  html += `<option value="__custom__" ${isCustom ? 'selected' : ''}>自定义...</option>`;

  return html;
}

async function handleNamingPresetListClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const item = button.closest('.naming-preset-item');
  if (!item) return;
  const id = item.dataset.presetId;
  if (button.dataset.action === 'apply') {
    const preset = getNamingPresetById(id);
    if (!preset) return;
    initRenameTokenBuilder(preset.pattern);
    updateNamingPreview();
  } else if (button.dataset.action === 'delete') {
    const confirmed = await showConfirmationDialog({
      title: '删除命名规则',
      message: '确认删除该命名规则预设吗？'
    });
    if (confirmed) {
      removeNamingPreset(id);
    }
  }
}

function handleNamingPresetLabelInput(event) {
  const input = event.target.closest('.naming-preset-label');
  if (!input) return;
  const item = input.closest('.naming-preset-item');
  if (!item) return;
  updateNamingPresetLabel(item.dataset.presetId, input.value);
}

async function syncCustomTextConfig() {
  state.config.customTextDefs = state.customTextDefs;
  state.config.customTextGlobals = state.customTextGlobals;

  // 自动保存配置以持久化customText数据
  try {
    await window.bridge.saveConfig(state.config);
    console.log('[syncCustomTextConfig] Config auto-saved');
  } catch (error) {
    console.warn('[syncCustomTextConfig] Failed to auto-save config:', error);
  }

  renderCustomTextDefs();
  renderTokenButtonGroups();
  renderTokenBuilder();
  renderFolderTokenBuilder();
  renderSlots();
  updateNamingPreview();
}

function getStoredSlotPresets() {
  // 优先使用缓存的数据
  if (Array.isArray(cachedSlotPresets) && cachedSlotPresets.length > 0) {
    return cachedSlotPresets;
  }

  // 如果缓存为空,尝试从 localStorage 加载
  try {
    const stored = localStorage.getItem(SLOTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('Loaded slots from localStorage:', parsed.length);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load slots from localStorage:', err);
  }

  return [];
}

function persistSlotPresets() {
  if (restoringSlots) {
    return;
  }
  try {
    const presets = getSlotPresets();
    cachedSlotPresets = presets;
    console.log('[persistSlotPresets] Saving', presets.length, 'slots');

    // 保存到 localStorage 作为备份
    try {
      localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(presets));
      console.log('[persistSlotPresets] Saved to localStorage');
    } catch (err) {
      console.warn('Failed to save slots to localStorage:', err);
    }

    // 也保存到文件系统(如果有bridge)
    const promise = window.bridge?.saveSlots?.(presets);
    if (promise?.then) {
      promise.then(() => {
        console.log('[persistSlotPresets] Saved to file system');
      }).catch((error) => {
        console.error('Failed to save slot presets', error);
      });
    }

    // 保存到 Firebase（按提交人区分）
    const submitter = elements.metadata?.submitter?.value?.trim() || '';
    if (state.config.sheetId && submitter && window.bridge?.firebase?.setSlotPresets) {
      if (slotPresetFirebaseSaveTimer) {
        clearTimeout(slotPresetFirebaseSaveTimer);
      }
      pendingSlotPresets = presets;
      slotPresetFirebaseSaveTimer = setTimeout(() => {
        const sheetId = state.config.sheetId;
        const toSave = pendingSlotPresets || presets;
        const currentSubmitter = elements.metadata?.submitter?.value?.trim() || submitter;
        window.bridge.firebase.setSlotPresets(sheetId, toSave, currentSubmitter)
          .then(() => console.log(`[persistSlotPresets] Saved to Firebase for submitter: ${currentSubmitter}`))
          .catch((error) => console.warn('[persistSlotPresets] Firebase 保存失败:', error.message));
      }, 800);
    }
  } catch (error) {
    console.error('Failed to save slot presets', error);
  }
}

async function hydrateSlotPresetsFromFirebase() {
  if (!state.config.sheetId || !window.bridge?.firebase?.getSlotPresets) {
    return;
  }

  // 获取当前提交人
  const submitter = elements.metadata?.submitter?.value?.trim() || '';
  if (!submitter) {
    console.log('[hydrateSlotPresetsFromFirebase] 提交人未填写，跳过 Firebase 同步');
    return;
  }

  try {
    const result = await window.bridge.firebase.getSlotPresets(state.config.sheetId, submitter);
    const remoteSlots = Array.isArray(result?.slots) ? result.slots : [];
    if (remoteSlots.length > 0) {
      cachedSlotPresets = remoteSlots;
      try {
        localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(remoteSlots));
      } catch (err) {
        console.warn('[hydrateSlotPresetsFromFirebase] localStorage 写入失败:', err);
      }
      window.bridge?.saveSlots?.(remoteSlots);
      console.log(`[hydrateSlotPresetsFromFirebase] 已从 Firebase 恢复分类设置（提交人: ${submitter}）`);
      return;
    }

    if (Array.isArray(cachedSlotPresets) && cachedSlotPresets.length > 0) {
      await window.bridge.firebase.setSlotPresets(state.config.sheetId, cachedSlotPresets, submitter);
      console.log(`[hydrateSlotPresetsFromFirebase] Firebase 无数据，已上传本地分类设置（提交人: ${submitter}）`);
    }
  } catch (error) {
    console.warn('[hydrateSlotPresetsFromFirebase] 同步失败:', error.message);
  }
}

function normalizeZoomFactor(value) {
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, parsed));
}

function applyZoomSetting(value, options = {}) {
  const { skipApply = false, skipInput = false } = options;
  const zoom = normalizeZoomFactor(value ?? state.config.zoomFactor ?? 1);
  if (!skipInput && elements.zoomFactor) {
    elements.zoomFactor.value = zoom.toFixed(2);
  }
  if (elements.zoomFactorDisplay) {
    elements.zoomFactorDisplay.textContent = `${Math.round(zoom * 100)}%`;
  }
  state.config.zoomFactor = zoom;
  if (!skipApply) {
    try {
      const result = window.bridge?.setZoomFactor?.(zoom);
      if (result?.catch) {
        result.catch((error) => console.error('Failed to update zoom factor', error));
      }
    } catch (error) {
      console.error('Failed to update zoom factor', error);
    }
  }
  return zoom;
}

function handleZoomFactorChange(event) {
  const target = event?.target || elements.zoomFactor;
  if (!target) {
    return;
  }
  applyZoomSetting(target.value);
}

function handleResetZoom() {
  applyZoomSetting(1);
}

function getSlotPresets() {
  return state.slots.map((slot) => ({
    mainCategory: slot.mainCategory,
    subCategory: slot.subCategory,
    subject: slot.subject || '',
    pageName: slot.pageName || '',
    eventName: slot.eventName || '',
    admin: slot.admin || '',
    distribution: slot.distribution || '',
    mode: slot.mode || SLOT_MODES.LIBRARY,
    customLink: slot.customLink || '',
    customFolderId: slot.customFolderId || '',
    displayName: slot.displayName || '',
    customTexts: slot.customTexts || {},
    namingPresetId: slot.namingPresetId || '',
    folderNamingPresetId: slot.folderNamingPresetId || '',
    folderSources: Array.isArray(slot.folderSources) ? slot.folderSources : [],
    taskType: slot.taskType || '',
    skipCreateSubfolder: Boolean(slot.skipCreateSubfolder),
    reviewEnabled: slot.reviewEnabled,
    reviewFolderLink: slot.reviewFolderLink || '',
    reviewReferenceLink: slot.reviewReferenceLink || '',
    referenceFolderPath: slot.referenceFolderPath || '',
    referenceFolderSources: Array.isArray(slot.referenceFolderSources) ? slot.referenceFolderSources : [],
    groupLabel: slot.groupLabel || '',
    settingsOpen: Boolean(slot.settingsOpen),
    collapsed: Boolean(slot.collapsed),
    viewMode: slot.viewMode || 'upload'
  }));
}

function restoreSubmitter() {
  try {
    const lastSubmitter = localStorage.getItem(SUBMITTER_STORAGE_KEY);
    if (lastSubmitter) {
      elements.metadata.submitter.value = lastSubmitter;
    }
  } catch (error) {
    console.error('Failed to restore submitter', error);
  }
}

function persistSubmitter() {
  try {
    const newSubmitter = elements.metadata.submitter.value.trim();
    // 🔴 只有输入至少2个字符时才保存
    if (newSubmitter.length < 2) {
      return;
    }
    localStorage.setItem(SUBMITTER_STORAGE_KEY, newSubmitter);

    // 当提交人更改时，从 Firebase 同步该提交人的分类配置
    if (newSubmitter && state.config.sheetId && window.bridge?.firebase?.getSlotPresets) {
      syncSlotsForSubmitter(newSubmitter);
    }
  } catch (error) {
    console.error('Failed to save submitter', error);
  }
}

/**
 * 为指定的提交人同步分类配置
 * @param {string} submitter - 提交人名称
 */
async function syncSlotsForSubmitter(submitter) {
  if (!submitter || !state.config.sheetId || !window.bridge?.firebase?.getSlotPresets) {
    return;
  }

  try {
    console.log(`[syncSlotsForSubmitter] 正在同步提交人 "${submitter}" 的分类配置...`);
    const result = await window.bridge.firebase.getSlotPresets(state.config.sheetId, submitter);
    const remoteSlots = Array.isArray(result?.slots) ? result.slots : [];

    if (remoteSlots.length > 0) {
      // 找到了该提交人的配置，使用远程配置
      cachedSlotPresets = remoteSlots;
      try {
        localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(remoteSlots));
      } catch (err) {
        console.warn('[syncSlotsForSubmitter] localStorage 写入失败:', err);
      }
      window.bridge?.saveSlots?.(remoteSlots);

      // 重新加载分类到界面
      restoringSlots = true;
      state.slots = [];
      remoteSlots.forEach((preset) => addSlot(preset));
      restoringSlots = false;
      renderSlots();

      appendLog({
        status: 'success',
        message: `已同步 "${submitter}" 的分类配置（共 ${remoteSlots.length} 个分类）`,
        broadcastGlobal: true
      });
      console.log(`[syncSlotsForSubmitter] 已从 Firebase 恢复 "${submitter}" 的分类设置`);
    } else {
      // 该提交人没有保存的配置，保留当前配置（可选择是否上传）
      console.log(`[syncSlotsForSubmitter] Firebase 中没有 "${submitter}" 的分类配置，保留当前配置`);
    }
  } catch (error) {
    console.warn('[syncSlotsForSubmitter] 同步失败:', error.message);
  }
}

function restoreRenameLocalPreference() {
  try {
    const stored = localStorage.getItem(RENAME_LOCAL_STORAGE_KEY);
    state.renameLocalEnabled = stored === '1';
  } catch (error) {
    console.error('Failed to restore rename preference', error);
    state.renameLocalEnabled = false;
  }
  if (elements.renameLocal) {
    elements.renameLocal.checked = state.renameLocalEnabled;
  }
}

function persistRenameLocalPreference(enabled) {
  state.renameLocalEnabled = Boolean(enabled);
  if (elements.renameLocal) {
    elements.renameLocal.checked = state.renameLocalEnabled;
  }
  try {
    localStorage.setItem(RENAME_LOCAL_STORAGE_KEY, state.renameLocalEnabled ? '1' : '0');
  } catch (error) {
    console.error('Failed to save rename preference', error);
  }
}

function persistAcknowledgementRecords() {
  try {
    const payload = {
      reviewer: Array.from(state.reviewAcknowledged.reviewer?.entries?.() || []),
      submitter: Array.from(state.reviewAcknowledged.submitter?.entries?.() || [])
    };
    localStorage.setItem(REVIEW_ACK_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to persist acknowledgement records', error);
  }
}

function restoreAcknowledgementRecords() {
  if (!state.reviewAcknowledged) {
    state.reviewAcknowledged = { reviewer: new Map(), submitter: new Map() };
  }
  try {
    const raw = localStorage.getItem(REVIEW_ACK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.reviewAcknowledged.reviewer = new Map(parsed?.reviewer || []);
      state.reviewAcknowledged.submitter = new Map(parsed?.submitter || []);
      return;
    }
  } catch (error) {
    console.error('Failed to restore acknowledgement records', error);
  }
  if (!state.reviewAcknowledged.reviewer) {
    state.reviewAcknowledged.reviewer = new Map();
  }
  if (!state.reviewAcknowledged.submitter) {
    state.reviewAcknowledged.submitter = new Map();
  }
}

function extractDriveFolderId(input = '') {
  const value = String(input || '').trim();
  if (!value) {
    return '';
  }
  const idPattern = /^[a-zA-Z0-9_-]{20,}$/;
  if (idPattern.test(value)) {
    return value;
  }
  try {
    const url = new URL(value);
    const queryId = url.searchParams.get('id');
    if (queryId) {
      return queryId;
    }
    const segments = url.pathname.split('/').filter(Boolean);
    const folderIndex = segments.findIndex((segment) => segment === 'folders');
    if (folderIndex !== -1 && segments[folderIndex + 1]) {
      return segments[folderIndex + 1];
    }
    const dIndex = segments.findIndex((segment) => segment === 'd');
    if (dIndex !== -1 && segments[dIndex + 1]) {
      return segments[dIndex + 1];
    }
  } catch (error) {
    // ignore invalid URLs
  }
  const fallback = value.match(/[a-zA-Z0-9_-]{20,}/);
  if (fallback && fallback[0]) {
    return fallback[0];
  }
  return '';
}

bootstrap();

async function bootstrap() {
  try {
    const payload = await window.bridge.loadConfig();
    cachedSlotPresets = Array.isArray(payload?.slots) ? payload.slots : [];
    cachedPreferences = payload?.preferences && typeof payload.preferences === 'object' ? payload.preferences : {};
    state.config = payload.config || {};
    state.authorized = payload.authorized;
    if (!state.config.renamePattern) {
      state.config.renamePattern = DEFAULT_PATTERN;
    }
    fillConfig(state.config);

    state.currentUserEmail = payload?.userEmail || '';
    updateSoftwareAdminVisibility();
    updateSoftwareReviewAccess();
    updateSoftwareConfigVisibility();
    ensureNamingDateDefault();
    updateAuthStatus();
    updateNamingPreview();
    window.bridge.onUploadProgress(handleUploadProgress);
    window.bridge.onUploadState(handleUploadStateChange);
    updateUploadControls();
    await hydrateSlotPresetsFromFirebase();
    restoreSlotPresets(cachedSlotPresets);
    restoreSlotGroupMode(cachedPreferences);
    restoreSubmitter();
    restoreRenameLocalPreference();
    restoreAcknowledgementRecords();
    restoreReviewSortPreference();
    restoreReviewRangeMode();
    restoreMyReviewSortPreference();
    restoreSlotViewMode();
    setupReviewInputRefreshGuard();

    await maybeFetchCategories();
    await loadReviewEntries();
    if (hasSoftwareDirectoryConfig()) {
      refreshSoftwareDirectory({ silent: true });
    }

    // 加载信息板配置并渲染
    loadNoticeBoardConfig(state.config);
    renderNoticeBoard();

    // 检查信息板是否有更新
    checkNoticeBoardUpdate();

    // 如果配置了自动打开信息板，切换到信息板视图
    if (state.config.noticeBoardAutoOpen && state.config.noticeBoardDocId) {
      switchAppView('notice-board');
    }

    // 初始化文件替换弹窗
    initFileReplaceModal();
    // 初始化批次设置弹窗
    initBatchSettingsModal();
  } catch (error) {
    appendLog({ status: 'error', message: error.message });
  }
}

function restoreSlotPresets(presets = null) {
  restoringSlots = true;
  state.slots = [];
  const source = Array.isArray(presets) ? presets : getStoredSlotPresets();
  if (source.length) {
    source.forEach((preset) => addSlot(preset));
  } else {
    for (let i = 0; i < 3; i += 1) {
      addSlot();
    }
  }
  restoringSlots = false;
  renderSlots();
}

async function exportSlotPresets() {
  try {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      slots: getSlotPresets()
    };
    const result = await window.bridge?.exportConfig?.(payload);
    if (result?.saved) {
      appendLog({ status: 'success', message: `分类预设已导出：${result.path}` });
    } else {
      appendLog({ status: 'error', message: '已取消导出分类预设' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `导出分类预设失败：${error.message}` });
  }
}

async function exportReviewSlots() {
  try {
    const reviewSlots = state.slots.filter((s) => s.reviewEnabled);
    if (!reviewSlots.length) {
      appendLog({ status: 'warning', message: '没有开启审核的分类，无法导出' });
      return;
    }
    const slotPresets = reviewSlots.map((slot) => ({
      mainCategory: slot.mainCategory,
      subCategory: slot.subCategory,
      subject: slot.subject || '',
      pageName: slot.pageName || '',
      eventName: slot.eventName || '',
      admin: slot.admin || '',
      distribution: slot.distribution || '',
      mode: slot.mode || SLOT_MODES.LIBRARY,
      customLink: slot.customLink || '',
      customFolderId: slot.customFolderId || '',
      displayName: slot.displayName || '',
      customTexts: slot.customTexts || {},
      namingPresetId: slot.namingPresetId || '',
      folderNamingPresetId: slot.folderNamingPresetId || '',
      taskType: slot.taskType || '',
      skipCreateSubfolder: Boolean(slot.skipCreateSubfolder),
      reviewEnabled: true,
      reviewFolderLink: slot.reviewFolderLink || '',
      reviewReferenceLink: slot.reviewReferenceLink || '',
      referenceFolderPath: slot.referenceFolderPath || '',
      groupLabel: slot.groupLabel || ''
    }));
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      type: 'review-slots',
      slots: slotPresets
    };
    const result = await window.bridge?.exportConfig?.(payload, `审核分类预设-${reviewSlots.length}个.json`);
    if (result?.saved) {
      appendLog({ status: 'success', message: `已导出 ${reviewSlots.length} 个审核分类预设：${result.path}` });
    } else {
      appendLog({ status: 'error', message: '已取消导出' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `导出审核分类失败：${error.message}` });
  }
}

async function importReviewSlots() {
  try {
    const result = await window.bridge?.importConfig?.();
    if (result?.imported && Array.isArray(result.slots)) {
      const reviewSlots = result.slots.filter((s) => s.reviewEnabled);
      if (!reviewSlots.length) {
        appendLog({ status: 'warning', message: '导入的文件中没有审核分类预设' });
        return;
      }
      // 将审核分类添加到现有分类列表中
      reviewSlots.forEach((slot) => {
        addSlot(slot);
      });
      persistSlotPresets();
      appendLog({ status: 'success', message: `已导入 ${reviewSlots.length} 个审核分类预设` });
    } else {
      appendLog({ status: 'error', message: '未找到可用的审核分类预设' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `导入审核分类失败：${error.message}` });
  }
}

async function importSlotPresets() {
  try {
    const result = await window.bridge?.importConfig?.();
    if (result?.imported && Array.isArray(result.slots)) {
      restoreSlotPresets(result.slots);
      persistSlotPresets();
      appendLog({ status: 'success', message: `已导入 ${result.slots.length} 条分类预设` });
    } else {
      appendLog({ status: 'error', message: '未找到可用的分类预设' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `导入分类预设失败：${error.message}` });
  }
}

function resetSlotPresetsToDefault() {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法重置分类' });
    return;
  }
  restoreSlotPresets([]);
  persistSlotPresets();
  appendLog({ status: 'success', message: '分类已恢复默认' });
}

function initRenameTokenBuilder(pattern) {
  state.namingTokens = parsePattern(pattern || DEFAULT_PATTERN);
  renderTokenBuilder();
  updatePatternFromTokens();
}

function getAvailableTokenDefs() {
  const base = TOKEN_DEFS.map((def) => ({ ...def }));
  const custom = state.customTextDefs.map((def) => ({
    label: `${def.label}${def.scope === CUSTOM_TEXT_SCOPE.SLOT ? '（分类）' : ''}`,
    token: def.token
  }));
  return [...base, ...custom];
}

function renderTokenButtonGroups() {
  renderTokenButtons(elements.tokenButtons, (token) => addToken({ type: 'token', value: token }));
  renderTokenButtons(elements.folderTokenButtons, (token) => addFolderToken({ type: 'token', value: token }));
}

function renderTokenButtons(container, onSelect) {
  if (!container) {
    return;
  }

  const defs = getAvailableTokenDefs();

  // 确定使用哪个tokens数组 (根据container判断是文件命名还是文件夹命名)
  const isFolder = container === elements.folderTokenButtons;
  const currentTokens = isFolder ? state.folderTokens : state.namingTokens;

  container.innerHTML = defs.map((def) => {
    let disabled = false;
    let title = '';

    // 检查是否已经添加且不允许多次
    if (def.unique && !def.allowMultiple) {
      const exists = currentTokens.some(t => t.value === def.token);
      if (exists) {
        disabled = true;
        title = '已添加（不可重复）';
      }
    }

    // 检查互斥规则
    if (def.mutex && !disabled) {
      const mutexToken = `{{${def.mutex}}}`;
      const hasMutex = currentTokens.some(t => t.value === mutexToken);
      if (hasMutex) {
        const mutexDef = defs.find(d => d.token === mutexToken);
        disabled = true;
        title = `与"${mutexDef?.label}"互斥`;
      }
    }

    return `<button type="button" data-token="${def.token}" ${disabled ? 'disabled' : ''} ${title ? `title="${title}"` : ''}>${def.label}</button>`;
  }).join('');

  container.querySelectorAll('button').forEach((btn) => {
    if (!btn.disabled) {
      btn.addEventListener('click', () => onSelect(btn.dataset.token));
    }
  });
}

function addCustomTextDefinition(scope = CUSTOM_TEXT_SCOPE.SLOT) {
  const def = normalizeCustomTextDef(
    {
      label: `文本块${state.customTextDefs.length + 1}`,
      scope
    },
    state.customTextDefs.length
  );
  if (scope === CUSTOM_TEXT_SCOPE.GLOBAL && !state.customTextGlobals[def.id]) {
    state.customTextGlobals[def.id] = '';
  }
  state.customTextDefs.push(def);
  syncCustomTextConfig();
}

function updateCustomTextDefinition(id, changes = {}) {
  const def = state.customTextDefs.find((item) => item.id === id);
  if (!def) {
    return;
  }
  if (typeof changes.label === 'string') {
    def.label = changes.label || def.label;
  }
  if (changes.scope && (changes.scope === CUSTOM_TEXT_SCOPE.GLOBAL || changes.scope === CUSTOM_TEXT_SCOPE.SLOT)) {
    def.scope = changes.scope;
    if (def.scope === CUSTOM_TEXT_SCOPE.GLOBAL) {
      if (!state.customTextGlobals[def.id]) {
        state.customTextGlobals[def.id] = '';
      }
    } else {
      delete state.customTextGlobals[def.id];
    }
  }
  syncCustomTextConfig();
}

function removeCustomTextDefinition(id) {
  state.customTextDefs = state.customTextDefs.filter((def) => def.id !== id);
  delete state.customTextGlobals[id];
  state.slots.forEach((slot) => {
    if (slot.customTexts) {
      delete slot.customTexts[id];
    }
  });
  syncCustomTextConfig();
}

function setGlobalCustomTextValue(id, value) {
  state.customTextGlobals[id] = value;
  state.config.customTextGlobals = state.customTextGlobals;
  updateNamingPreview();
  debouncedPreview();
}

function switchSlotView(mode) {
  state.slotViewMode = mode;
  // 持久化视图模式到 localStorage
  try {
    localStorage.setItem(SLOT_VIEW_MODE_STORAGE_KEY, mode);
  } catch (error) {
    console.warn('Failed to save slot view mode:', error);
  }
  if (elements.viewNormal) {
    elements.viewNormal.classList.toggle('active', mode !== 'review');
  }
  if (elements.viewReview) {
    elements.viewReview.classList.toggle('active', mode === 'review');
  }
  if (mode === 'review' && !state.reviewEntries.length && !state.reviewLoading) {
    loadReviewEntries();
  }
  renderSlots();
}

/**
 * 从 localStorage 恢复视图模式
 */
function restoreSlotViewMode() {
  try {
    const savedMode = localStorage.getItem(SLOT_VIEW_MODE_STORAGE_KEY);
    if (savedMode && (savedMode === 'normal' || savedMode === 'review')) {
      state.slotViewMode = savedMode;
      if (elements.viewNormal) {
        elements.viewNormal.classList.toggle('active', savedMode !== 'review');
      }
      if (elements.viewReview) {
        elements.viewReview.classList.toggle('active', savedMode === 'review');
      }
    }
  } catch (error) {
    console.warn('Failed to restore slot view mode:', error);
  }
}

function setSlotGroupMode(enabled, options = {}) {
  const { skipPersist = false, skipRender = false } = options;
  state.groupSlotsByMain = enabled;
  if (elements.toggleSlotGroupBtn) {
    elements.toggleSlotGroupBtn.classList.toggle('active', enabled);
    elements.toggleSlotGroupBtn.textContent = enabled ? '取消分组' : '按自定义分组';
  }
  if (!skipPersist) {
    persistAppPreferences({ slotGroupEnabled: enabled });
  }
  if (!skipRender) {
    renderSlots();
  }
}

function restoreSlotGroupMode(preferences = null) {
  const source = preferences && typeof preferences === 'object' ? preferences : cachedPreferences;
  const enabled = typeof source.slotGroupEnabled === 'boolean' ? source.slotGroupEnabled : false;
  setSlotGroupMode(enabled, { skipPersist: true });
}

function persistAppPreferences(changes = {}) {
  if (!changes || typeof changes !== 'object') {
    return;
  }
  cachedPreferences = { ...cachedPreferences, ...changes };
  try {
    const result = window.bridge?.savePreferences?.(changes);
    if (result?.catch) {
      result.catch((error) => console.error('Failed to save preferences', error));
    }
  } catch (error) {
    console.error('Failed to save preferences', error);
  }
}


function addToken(token) {
  // 获取token定义
  const allDefs = getAvailableTokenDefs();
  const tokenDef = allDefs.find(def => def.token === token.value);

  if (tokenDef) {
    // 检查是否unique（不允许重复）
    if (tokenDef.unique && !tokenDef.allowMultiple) {
      const alreadyExists = state.namingTokens.some(t => t.value === token.value);
      if (alreadyExists) {
        appendLog({ status: 'warning', message: `"${tokenDef.label}"只能添加一次` });
        return;
      }
    }

    // 检查互斥规则
    if (tokenDef.mutex) {
      const mutexToken = `{{${tokenDef.mutex}}}`;
      const hasMutex = state.namingTokens.some(t => t.value === mutexToken);
      if (hasMutex) {
        const mutexDef = allDefs.find(def => def.token === mutexToken);
        appendLog({
          status: 'warning',
          message: `"${tokenDef.label}"和"${mutexDef?.label}"不能同时使用`
        });
        return;
      }
    }
  }

  state.namingTokens.push(token);
  renderTokenBuilder();
  renderTokenButtonGroups(); // 重新渲染按钮以更新禁用状态
  updatePatternFromTokens();
}

function initFolderTokenBuilder(pattern) {
  state.folderTokens = parsePattern(pattern || DEFAULT_FOLDER_PATTERN);
  renderFolderTokenBuilder();
  updateFolderPatternFromTokens();
}

function renderTokenBuilder() {
  const container = elements.tokenBuilder;
  container.innerHTML = '';
  state.namingTokens.forEach((token, index) => {
    const chip = document.createElement('div');
    chip.className = 'token-chip';
    chip.draggable = true;
    chip.dataset.index = index;
    chip.textContent = tokenLabel(token);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      state.namingTokens.splice(index, 1);
      renderTokenBuilder();
      renderTokenButtonGroups(); // 重新渲染按钮以更新禁用状态
      updatePatternFromTokens();
    });
    chip.appendChild(remove);
    chip.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', index);
    });
    chip.addEventListener('dragover', (event) => {
      event.preventDefault();
      chip.classList.add('drag-over');
    });
    chip.addEventListener('dragleave', () => chip.classList.remove('drag-over'));
    chip.addEventListener('drop', (event) => {
      event.preventDefault();
      chip.classList.remove('drag-over');
      const from = Number(event.dataTransfer.getData('text/plain'));
      const to = index;
      if (Number.isNaN(from) || from === to) {
        return;
      }
      const [moved] = state.namingTokens.splice(from, 1);
      state.namingTokens.splice(to, 0, moved);
      renderTokenBuilder();
      updatePatternFromTokens();
    });
    container.appendChild(chip);
  });
}

function addFolderToken(token) {
  // 获取token定义
  const allDefs = getAvailableTokenDefs();
  const tokenDef = allDefs.find(def => def.token === token.value);

  if (tokenDef) {
    // 检查是否unique（不允许重复）
    if (tokenDef.unique && !tokenDef.allowMultiple) {
      const alreadyExists = state.folderTokens.some(t => t.value === token.value);
      if (alreadyExists) {
        appendLog({ status: 'warning', message: `"${tokenDef.label}"只能添加一次` });
        return;
      }
    }

    // 检查互斥规则
    if (tokenDef.mutex) {
      const mutexToken = `{{${tokenDef.mutex}}}`;
      const hasMutex = state.folderTokens.some(t => t.value === mutexToken);
      if (hasMutex) {
        const mutexDef = allDefs.find(def => def.token === mutexToken);
        appendLog({
          status: 'warning',
          message: `"${tokenDef.label}"和"${mutexDef?.label}"不能同时使用`
        });
        return;
      }
    }
  }

  state.folderTokens.push(token);
  renderFolderTokenBuilder();
  renderTokenButtonGroups(); // 重新渲染按钮以更新禁用状态
  updateFolderPatternFromTokens();
}

function renderFolderTokenBuilder() {
  const container = elements.folderTokenBuilder;
  if (!container) {
    return;
  }
  container.innerHTML = '';
  state.folderTokens.forEach((token, index) => {
    const chip = document.createElement('div');
    chip.className = 'token-chip';
    chip.draggable = true;
    chip.dataset.index = index;
    chip.textContent = tokenLabel(token);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      state.folderTokens.splice(index, 1);
      renderFolderTokenBuilder();
      renderTokenButtonGroups(); // 重新渲染按钮以更新禁用状态
      updateFolderPatternFromTokens();
    });
    chip.appendChild(remove);
    chip.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', index);
    });
    chip.addEventListener('dragover', (event) => {
      event.preventDefault();
      chip.classList.add('drag-over');
    });
    chip.addEventListener('dragleave', () => chip.classList.remove('drag-over'));
    chip.addEventListener('drop', (event) => {
      event.preventDefault();
      chip.classList.remove('drag-over');
      const from = Number(event.dataTransfer.getData('text/plain'));
      const to = index;
      if (Number.isNaN(from) || from === to) {
        return;
      }
      const [moved] = state.folderTokens.splice(from, 1);
      state.folderTokens.splice(to, 0, moved);
      renderFolderTokenBuilder();
      updateFolderPatternFromTokens();
    });
    container.appendChild(chip);
  });
}

function renderCustomTextDefs() {
  const container = elements.customTextList;
  if (!container) return;
  if (!state.customTextDefs.length) {
    container.innerHTML = '<div class="muted">尚未添加自定义文本块</div>';
    bindCustomTextEvents();
    return;
  }
  container.innerHTML = state.customTextDefs
    .map(
      (def) => `
      <div class="custom-text-item" data-id="${def.id}">
        <div class="custom-text-row">
          <input type="text" class="custom-text-label" placeholder="文本块名称" value="${def.label}" />
          <select class="custom-text-scope">
            <option value="${CUSTOM_TEXT_SCOPE.GLOBAL}" ${def.scope === CUSTOM_TEXT_SCOPE.GLOBAL ? 'selected' : ''}>通用</option>
            <option value="${CUSTOM_TEXT_SCOPE.SLOT}" ${def.scope === CUSTOM_TEXT_SCOPE.SLOT ? 'selected' : ''}>可在上传界面自定义填写内容</option>
          </select>
          <button class="ghost danger" data-action="remove-custom-text">删除</button>
        </div>
        ${def.scope === CUSTOM_TEXT_SCOPE.GLOBAL
          ? `<input type="text" class="custom-text-global-value" placeholder="输入文本内容" value="${state.customTextGlobals[def.id] || ''
          }" />`
          : '<small class="muted">在每个分类卡片中填写此文本</small>'
        }
      </div>
    `
    )
    .join('');
  bindCustomTextEvents();
}

function bindCustomTextEvents() {
  const container = elements.customTextList;
  if (!container) return;
  container.querySelectorAll('.custom-text-label').forEach((input) => {
    input.addEventListener('change', (event) => {
      const id = event.target.closest('.custom-text-item')?.dataset?.id;
      if (!id) return;
      updateCustomTextDefinition(id, { label: event.target.value.trim() });
    });
  });
  container.querySelectorAll('.custom-text-scope').forEach((select) => {
    select.addEventListener('change', (event) => {
      const id = event.target.closest('.custom-text-item')?.dataset?.id;
      if (!id) return;
      updateCustomTextDefinition(id, { scope: event.target.value });
    });
  });
  container.querySelectorAll('.custom-text-global-value').forEach((input) => {
    input.addEventListener('input', (event) => {
      const id = event.target.closest('.custom-text-item')?.dataset?.id;
      if (!id) return;
      setGlobalCustomTextValue(id, event.target.value);
    });
  });
  container.querySelectorAll('[data-action="remove-custom-text"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.custom-text-item')?.dataset?.id;
      if (!id) return;
      const confirmed = await showConfirmationDialog({
        title: '删除文本块',
        message: '确定删除该文本块吗？'
      });
      if (confirmed) {
        removeCustomTextDefinition(id);
      }
    });
  });
}

function tokenLabel(token) {
  if (token.type === 'token') {
    const def = TOKEN_DEFS.find((item) => item.token === token.value);
    if (def) {
      return def.label;
    }
    const custom = state.customTextDefs.find((item) => item.token === token.value);
    if (custom) {
      return `${custom.label}${custom.scope === CUSTOM_TEXT_SCOPE.SLOT ? '（分类）' : ''}`;
    }
    return token.value;
  }
  return token.value;
}

function updatePatternFromTokens() {
  if (!state.namingTokens.length) {
    state.namingTokens = parsePattern(DEFAULT_PATTERN);
  }
  const pattern = state.namingTokens.map((token) => token.value).join('-');
  state.config.renamePattern = pattern || DEFAULT_PATTERN;
  elements.renamePattern.value = state.config.renamePattern;
  debouncedPreview();
  renderSlots();
}

function updateFolderPatternFromTokens() {
  if (!state.folderTokens.length) {
    state.folderTokens = parsePattern(DEFAULT_FOLDER_PATTERN);
  }
  const pattern = state.folderTokens.map((token) => token.value).join('-');
  state.config.folderPattern = pattern || DEFAULT_FOLDER_PATTERN;
  if (elements.folderPattern) {
    elements.folderPattern.value = state.config.folderPattern;
  }
  renderSlots();
}

async function syncConfigForUpload() {
  try {
    const latest = await window.bridge.saveConfig(gatherConfigFromForm());
    state.config = latest;
    return true;
  } catch (error) {
    appendLog({ status: 'error', message: `同步配置失败：${error.message}` });
    return false;
  }
}

function isKnownTokenValue(tokenValue) {
  if (!tokenValue) {
    return false;
  }
  if (TOKEN_DEFS.some((def) => def.token === tokenValue)) {
    return true;
  }
  return state.customTextDefs.some((def) => def.token === tokenValue);
}

function parsePattern(pattern) {
  if (!pattern) {
    return [];
  }

  const result = [];
  const tokenRegex = /\{\{[^}]+\}\}/g;
  let lastIndex = 0;
  let match;

  // 提取所有 {{...}} token
  while ((match = tokenRegex.exec(pattern)) !== null) {
    // 处理token之前的文本
    if (match.index > lastIndex) {
      const textBefore = pattern.substring(lastIndex, match.index);
      // 按 - 分割文本部分
      textBefore.split('-').forEach((segment) => {
        const trimmed = segment.trim();
        if (trimmed) {
          result.push({ type: 'text', value: trimmed });
        }
      });
    }

    // 添加token
    const tokenValue = match[0];
    if (isKnownTokenValue(tokenValue)) {
      result.push({ type: 'token', value: tokenValue });
    } else {
      result.push({ type: 'text', value: tokenValue });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  // 处理最后一个token之后的文本
  if (lastIndex < pattern.length) {
    const textAfter = pattern.substring(lastIndex);
    textAfter.split('-').forEach((segment) => {
      const trimmed = segment.trim();
      if (trimmed) {
        result.push({ type: 'text', value: trimmed });
      }
    });
  }

  return result;
}

function applyBasicConfigValues(config = {}) {
  const next = {
    clientId: config.clientId || '',
    clientSecret: config.clientSecret || '',
    redirectPort: config.redirectPort || 42813,
    driveFolderId: config.driveFolderId || '',
    mediaDownloadDir: config.mediaDownloadDir || state.config.mediaDownloadDir || '',
    sheetId: config.sheetId || '',
    sheetRange: config.sheetRange || 'Uploads!A:J',
    reviewRange: config.reviewRange || '审核记录',
    reviewSheetName: config.reviewSheetName || deriveSheetName(config.reviewRange || '审核记录', '审核记录'),
    categoryRange: config.categoryRange || '数据验证!A2:C',
    categorySheetName: config.categorySheetName || deriveSheetName(config.categoryRange || '数据验证!A2:C', '数据验证'),
    softwareSheetId: config.softwareSheetId || '',
    softwareSheetRange: config.softwareSheetRange || 'Software!A:K',
    softwareSubmissionRange: config.softwareSubmissionRange || 'SoftwareSubmissions!A:S',
    softwareAdminRange: config.softwareAdminRange || 'SoftwareAdmins!A:A',
    softwareSubmitUrl: config.softwareSubmitUrl || '',
    softwareAdmins: Array.isArray(config.softwareAdmins) ? config.softwareAdmins : [],
    reviewTempFolder: config.reviewTempFolder || '',
    readyFlag: config.readyFlag || '是',
    zoomFactor: normalizeZoomFactor(config.zoomFactor ?? 1)
  };
  Object.assign(state.config, next);
  elements.clientId.value = next.clientId;
  elements.clientSecret.value = next.clientSecret;
  elements.redirectPort.value = next.redirectPort;
  elements.driveFolderId.value = next.driveFolderId;
  if (elements.mediaDownloadDir) {
    elements.mediaDownloadDir.value = next.mediaDownloadDir;
  }
  elements.sheetId.value = next.sheetId;
  elements.sheetRange.value = next.sheetRange;
  elements.reviewRange.value = next.reviewRange;
  elements.categoryRange.value = next.categoryRange;
  if (elements.softwareSheetId) {
    elements.softwareSheetId.value = next.softwareSheetId;
  }
  if (elements.softwareSheetRange) {
    elements.softwareSheetRange.value = next.softwareSheetRange;
  }
  if (elements.softwareSubmissionRange) {
    elements.softwareSubmissionRange.value = next.softwareSubmissionRange;
  }
  if (elements.softwareAdminRange) {
    elements.softwareAdminRange.value = next.softwareAdminRange;
  }
  if (elements.softwareSubmitUrl) {
    elements.softwareSubmitUrl.value = next.softwareSubmitUrl;
  }
  if (elements.softwareAdmins) {
    elements.softwareAdmins.value = formatSoftwareAdminsForInput(next.softwareAdmins);
  }
  if (elements.reviewTempFolder) {
    elements.reviewTempFolder.value = next.reviewTempFolder;
  }
  // 按文件审核模式（始终启用）
  state.config.useFileReviewMode = true;
  if (elements.fileReviewRange) {
    elements.fileReviewRange.value = next.fileReviewRange || '文件审核!A:AF';
  }
  applyZoomSetting(next.zoomFactor);
  updateSoftwareAdminVisibility();

  // 加载 Firebase 配置
  const fb = config.firebase || {};
  const fbApiKey = document.getElementById('firebase-api-key');
  const fbAuthDomain = document.getElementById('firebase-auth-domain');
  const fbDbUrl = document.getElementById('firebase-database-url');
  const fbProjectId = document.getElementById('firebase-project-id');
  if (fbApiKey) fbApiKey.value = fb.apiKey || '';
  if (fbAuthDomain) fbAuthDomain.value = fb.authDomain || '';
  if (fbDbUrl) fbDbUrl.value = fb.databaseURL || '';
  if (fbProjectId) fbProjectId.value = fb.projectId || '';

  // 加载信息板配置
  loadNoticeBoardConfig(config);
}

function applyNotificationConfigValues(config = {}) {
  const next = {
    notificationMode: config.notificationMode || 'speech',
    notificationSoundReview: config.notificationSoundReview || '',
    notificationSoundSuggestion: config.notificationSoundSuggestion || '',
    notificationSoundApproved: config.notificationSoundApproved || '',
    enableFloatingNotifications: config.enableFloatingNotifications !== false,
    notificationPosition: config.notificationPosition || 'topRight'
  };
  Object.assign(state.config, next);
  if (elements.notificationMode) {
    elements.notificationMode.value = next.notificationMode;
  }
  if (elements.notificationSoundReview) {
    elements.notificationSoundReview.value = next.notificationSoundReview;
  }
  if (elements.notificationSoundSuggestion) {
    elements.notificationSoundSuggestion.value = next.notificationSoundSuggestion;
  }
  if (elements.notificationSoundApproved) {
    elements.notificationSoundApproved.value = next.notificationSoundApproved;
  }
  if (elements.floatingNotificationToggle) {
    elements.floatingNotificationToggle.checked = next.enableFloatingNotifications;
  }
  // 🔴 新增：通知位置
  const notificationPositionEl = document.getElementById('notification-position');
  if (notificationPositionEl) {
    notificationPositionEl.value = next.notificationPosition;
  }
  resetCustomAudioPlayer('review');
  resetCustomAudioPlayer('suggestion');
  resetCustomAudioPlayer('approved');
}

function applyNamingConfigValues(config = {}) {
  state.config.renamePattern = config.renamePattern || DEFAULT_PATTERN;
  if (elements.renamePattern) {
    elements.renamePattern.value = state.config.renamePattern;
  }
  state.config.folderPattern = config.folderPattern || DEFAULT_FOLDER_PATTERN;
  if (elements.folderPattern) {
    elements.folderPattern.value = state.config.folderPattern;
  }
  initRenameTokenBuilder(state.config.renamePattern);
  initFolderTokenBuilder(state.config.folderPattern);
  loadCustomTextConfig(config);
  loadNamingPresets(config.namingPresets);
  loadFolderPresets(config.folderNamingPresets);
  state.config.dateFormat = config.dateFormat || 'YYYYMMDD-hhmmss';
  elements.dateFormat.value = state.config.dateFormat;
  state.config.counterStart = config.counterStart || 1;
  elements.counterStart.value = state.config.counterStart;
  state.config.counterPadding = config.counterPadding || 3;
  elements.counterPadding.value = state.config.counterPadding;
  state.config.counterStep = config.counterStep || 1;
  elements.counterStep.value = state.config.counterStep;
  state.config.timezone = config.timezone || 'local';
  elements.timezone.value = state.config.timezone;
  updateNamingPreview();

  // AI 命名配置
  const aiEnabled = document.getElementById('ai-naming-enabled');
  const aiApiKey = document.getElementById('ai-naming-api-key');
  const aiKeywordCount = document.getElementById('ai-naming-keyword-count');
  const aiSeparator = document.getElementById('ai-naming-separator');
  const aiKeywords = document.getElementById('ai-naming-keywords');
  const aiKeywordCountDisplay = document.getElementById('ai-naming-keyword-count-display');

  if (aiEnabled) aiEnabled.checked = Boolean(config.aiNamingEnabled);
  if (aiApiKey) aiApiKey.value = config.aiNamingApiKey || '';
  if (aiKeywordCount) aiKeywordCount.value = config.aiNamingKeywordCount || 3;
  if (aiSeparator) aiSeparator.value = config.aiNamingSeparator || '_';
  if (aiKeywords) {
    aiKeywords.value = config.aiNamingKeywords || '';
    // 更新词数显示
    const count = (config.aiNamingKeywords || '').split(/[,\n\r]+/).map(s => s.trim()).filter(Boolean).length;
    if (aiKeywordCountDisplay) aiKeywordCountDisplay.textContent = `${count} 个词`;
  }
  setupAiNamingUI();
}

function fillConfig(config) {
  applyBasicConfigValues(config);
  applyNamingConfigValues(config);
  applyNotificationConfigValues(config);
  // 🔴 暴露配置供打卡模块读取
  window.appConfig = state.config;
  state.reviewNotificationsPrimed = false;
  state.reviewEntryCache = new Map();
  state.lastKnownStatuses = new Map();
  clearAcknowledgements();
  renderSoftwareDirectory();
}

function ensureNamingDateDefault() {
  const today = new Date();
  const iso = today.toISOString().split('T')[0];
  if (!elements.naming.date.value) {
    elements.naming.date.value = iso;
  }
  if (!elements.metadata.completedAt.value) {
    elements.metadata.completedAt.value = iso;
  }
  if (!elements.naming.country.value) {
    elements.naming.country.value = DEFAULT_COUNTRY;
  }
}

async function maybeFetchCategories(manual = false) {
  if (!state.authorized || !state.config.sheetId) {
    // 不清空现有数据，保留上次成功加载的类别
    if (manual) {
      if (!state.authorized) {
        appendLog({
          status: 'error',
          message: '授权已过期，请点击"登录 Google"重新授权'
        });
      } else {
        appendLog({ status: 'error', message: '请先填写 Sheet ID' });
      }
    }
    return;
  }
  try {
    const payload = await window.bridge.fetchCategories();
    state.categories = payload?.categories || [];
    state.categoryMap = payload?.map || {};
    state.taskTypes = payload?.taskTypes || [];

    // 🔴 同步任务类型到打卡模块
    if (state.taskTypes.length > 0 && window.CheckinCore?.setReportTaskTypes) {
      window.CheckinCore.setReportTaskTypes(state.taskTypes);
    }

    if (manual) {
      const taskTypeCount = state.taskTypes.length;
      const msg = taskTypeCount > 0
        ? `分类信息已同步（含 ${taskTypeCount} 个任务类型）`
        : '分类信息已同步';
      appendLog({ status: 'success', message: msg, broadcastGlobal: true });
    }
    renderSlots();
  } catch (error) {
    appendLog({ status: 'error', message: `同步分类失败：${error.message}` });
  }
}

async function handleResetBasicConfig() {
  try {
    const updated = await window.bridge.resetConfigSection?.('basic');
    if (updated) {
      state.config = updated;
      applyBasicConfigValues(state.config);
      appendLog({ status: 'success', message: '基础配置已恢复默认值' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `恢复基础配置失败：${error.message}` });
  }
}

async function handleResetNamingConfig() {
  try {
    const updated = await window.bridge.resetConfigSection?.('naming');
    if (updated) {
      state.config = updated;
      applyNamingConfigValues(state.config);
      elements.naming.country.value = DEFAULT_COUNTRY;
      elements.naming.software.value = '';
      elements.naming.date.value = '';
      elements.metadata.completedAt.value = '';
      ensureNamingDateDefault();
      appendLog({ status: 'success', message: '命名规则已恢复默认值' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `恢复命名规则失败：${error.message}` });
  }
}

async function handleResetNotificationConfig() {
  try {
    const updated = await window.bridge.resetConfigSection?.('notification');
    if (updated) {
      state.config = updated;
      applyNotificationConfigValues(state.config);
      setUserRole('submitter');
      if (elements.userRole) {
        elements.userRole.value = state.userRole;
      }
      appendLog({ status: 'success', message: '通知设置已恢复默认值' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `恢复通知设置失败：${error.message}` });
  }
}

async function handleResetNoticeBoardConfig() {
  try {
    const updated = await window.bridge.resetConfigSection?.('notice-board');
    if (updated) {
      state.config = updated;
      // 更新UI
      if (elements.noticeBoard?.docId) {
        elements.noticeBoard.docId.value = updated.noticeBoardDocId || '';
      }
      if (elements.noticeBoard?.autoOpen) {
        elements.noticeBoard.autoOpen.value = String(updated.noticeBoardAutoOpen || false);
      }
      appendLog({ status: 'success', message: '信息板配置已恢复默认值' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `恢复信息板配置失败：${error.message}` });
  }
}

async function handleResetSoftwareConfig() {
  try {
    const updated = await window.bridge.resetConfigSection?.('software');
    if (updated) {
      state.config = updated;
      // 更新UI
      if (elements.software?.sheetId) {
        elements.software.sheetId.value = updated.softwareSheetId || '';
      }
      if (elements.software?.sheetRange) {
        elements.software.sheetRange.value = updated.softwareSheetRange || '';
      }
      if (elements.software?.submissionRange) {
        elements.software.submissionRange.value = updated.softwareSubmissionRange || '';
      }
      if (elements.software?.adminRange) {
        elements.software.adminRange.value = updated.softwareAdminRange || '';
      }
      if (elements.software?.submitUrl) {
        elements.software.submitUrl.value = updated.softwareSubmitUrl || '';
      }
      if (elements.software?.admins) {
        elements.software.admins.value = '';
        state.config.softwareAdmins = [];
      }
      appendLog({ status: 'success', message: 'AI软件配置已恢复默认值' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `恢复软件配置失败：${error.message}` });
  }
}

async function handleResetAllConfig() {
  // 显示确认对话框
  const confirmed = confirm(
    '确定要恢复所有设置到默认值吗？\n\n这将重置：\n• 基础配置\n• 信息板配置\n• AI软件配置\n• 命名规则\n• 通知设置\n\n此操作无法撤销！'
  );

  if (!confirmed) {
    return;
  }

  try {
    appendLog({ status: 'info', message: '正在恢复所有默认设置...' });

    // 依次调用所有恢复默认函数
    await handleResetBasicConfig();
    await handleResetNoticeBoardConfig();
    await handleResetSoftwareConfig();
    await handleResetNamingConfig();
    await handleResetNotificationConfig();

    appendLog({ status: 'success', message: '✅ 所有设置已恢复默认值' });
  } catch (error) {
    appendLog({ status: 'error', message: `恢复所有默认设置失败：${error.message}` });
  }
}

function updateAuthStatus() {
  if (state.authorized) {
    // 显示已授权 + 用户邮箱
    const email = state.currentUserEmail || '';
    if (email) {
      elements.authStatus.textContent = `已授权 (${email})`;
      elements.authStatus.title = `已授权：${email}`;
    } else {
      elements.authStatus.textContent = '已授权';
      elements.authStatus.title = '已授权';
    }
    elements.authStatus.classList.add('online');
    elements.authStatus.classList.remove('offline');
  } else {
    elements.authStatus.textContent = '未授权';
    elements.authStatus.title = '点击登录 Google';
    elements.authStatus.classList.remove('online');
    elements.authStatus.classList.add('offline');
  }
}

function addSlot(preset = {}) {
  console.log('[addSlot] Creating slot from preset, customTexts:', preset.customTexts);
  const slot = {
    id: `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    subject: preset.subject || '',
    pageName: preset.pageName || '',
    admin: preset.admin || '',
    distribution: preset.distribution || '',
    taskType: preset.taskType || '',
    mainCategory: preset.mainCategory || '',
    subCategory: preset.subCategory || '',
    folderPath: preset.folderPath || '',
    folderSources: Array.isArray(preset.folderSources) ? preset.folderSources : [],
    files: [],
    referenceFiles: [],
    previewMap: new Map(),
    fileStatuses: new Map(),
    referenceFileStatuses: new Map(),
    lastFolderLink: preset.lastFolderLink || '',
    mode: preset.mode || SLOT_MODES.LIBRARY,
    customLink: preset.customLink || '',
    customFolderId: preset.customFolderId || '',
    displayName: preset.displayName || '',
    customTexts: preset.customTexts || {},
    eventName: preset.eventName || '',
    namingPresetId: preset.namingPresetId || '',
    folderNamingPresetId: preset.folderNamingPresetId || '',
    skipCreateSubfolder: Boolean(preset.skipCreateSubfolder),
    groupLabel: preset.groupLabel || '',
    settingsOpen: Boolean(preset.settingsOpen),
    viewMode: preset.viewMode || 'upload',
    reviewEnabled:
      typeof preset.reviewEnabled === 'boolean'
        ? preset.reviewEnabled
        : state.slotViewMode === 'review',
    reviewFolderLink: preset.reviewFolderLink || '',
    reviewReferenceLink: preset.reviewReferenceLink || '',
    referenceFolderPath: preset.referenceFolderPath || '',
    referenceFolderSources: Array.isArray(preset.referenceFolderSources) ? preset.referenceFolderSources : [],
    collapsed: Boolean(preset.collapsed),
    selectedFiles: new Set(),  // 追踪选中的上传文件
    selectedReferenceFiles: new Set()  // 追踪选中的参考文件
  };
  console.log('[addSlot] Created slot with customTexts:', slot.customTexts);
  if (slot.reviewEnabled && slot.mode === SLOT_MODES.CUSTOM_LINK) {
    slot.mode = SLOT_MODES.LIBRARY;
  }
  if (!slot.customFolderId && slot.customLink) {
    slot.customFolderId = extractDriveFolderId(slot.customLink);
  }
  state.slots.push(slot);
  if (!restoringSlots) {
    renderSlots();
    persistSlotPresets();
  }
  return slot;
}

function removeSlot(slotId) {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法移除分类' });
    return;
  }
  if (state.slots.length <= 1) {
    appendLog({ status: 'error', message: '至少保留一个分类' });
    return;
  }
  state.slots = state.slots.filter((slot) => slot.id !== slotId);
  renderSlots();
  persistSlotPresets();
}

function moveSlot(slotId, direction = 'up') {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法调整顺序' });
    return;
  }
  const index = state.slots.findIndex((slot) => slot.id === slotId);
  if (index === -1) return;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= state.slots.length) {
    return;
  }
  const [slot] = state.slots.splice(index, 1);
  state.slots.splice(targetIndex, 0, slot);
  renderSlots();
  persistSlotPresets();
}

function reorderSlot(sourceId, targetId) {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法调整顺序' });
    return;
  }
  if (!sourceId || !targetId || sourceId === targetId) return;
  const from = state.slots.findIndex((slot) => slot.id === sourceId);
  const to = state.slots.findIndex((slot) => slot.id === targetId);
  if (from === -1 || to === -1) return;
  const [slot] = state.slots.splice(from, 1);
  state.slots.splice(to, 0, slot);
  renderSlots();
  persistSlotPresets();
}

function clearSlotDragVisuals() {
  if (pointerDragCleanup) {
    pointerDragCleanup();
    pointerDragCleanup = null;
  }
  draggingSlotId = null;
  pointerDragActive = false;
  elements.slotContainer?.classList.remove('drag-sorting');
  document.querySelectorAll('.slot-card').forEach((card) => {
    card.classList.remove('dragging', 'drag-over-sort');
  });
}

function getSlotCardFromEvent(event) {
  const direct = event.target?.closest?.('.slot-card');
  if (direct) return direct;
  const hovered = document.elementFromPoint(event.clientX, event.clientY);
  return hovered?.closest?.('.slot-card') || null;
}

function setSlotSortHighlight(targetCard) {
  elements.slotContainer?.querySelectorAll('.slot-card').forEach((card) => {
    card.classList.remove('drag-over-sort');
  });
  if (targetCard) {
    targetCard.classList.add('drag-over-sort');
  }
}

function startSlotPointerDrag(slotId, startEvent) {
  if (!slotId || state.uploadState !== 'idle') return;
  if (pointerDragActive) return;
  draggingSlotId = slotId;
  pointerDragActive = true;
  elements.slotContainer?.classList.add('drag-sorting');
  const startCard = getSlotCardFromEvent(startEvent);
  startCard?.classList.add('dragging');

  const handleMove = (event) => {
    if (!pointerDragActive || !draggingSlotId) return;
    const targetCard = getSlotCardFromEvent(event);
    const targetId = targetCard?.dataset?.slotId;
    if (!targetId || targetId === draggingSlotId) {
      setSlotSortHighlight(null);
    } else {
      setSlotSortHighlight(targetCard);
    }
    event.preventDefault();
  };

  const handleUp = (event) => {
    if (pointerDragActive && draggingSlotId) {
      const targetCard = getSlotCardFromEvent(event);
      const targetId = targetCard?.dataset?.slotId;
      if (targetId && targetId !== draggingSlotId) {
        reorderSlot(draggingSlotId, targetId);
      }
    }
    clearSlotDragVisuals();
    event.preventDefault();
  };

  pointerDragCleanup = () => {
    document.removeEventListener('pointermove', handleMove, true);
    document.removeEventListener('pointerup', handleUp, true);
    pointerDragActive = false;
    draggingSlotId = null;
    setSlotSortHighlight(null);
    elements.slotContainer?.classList.remove('drag-sorting');
    document.querySelectorAll('.slot-card').forEach((card) => card.classList.remove('dragging'));
  };

  document.addEventListener('pointermove', handleMove, true);
  document.addEventListener('pointerup', handleUp, true);
  startEvent.preventDefault();
}

function isSlotDragBlockedTarget(target) {
  if (!target) return false;
  // 避免在输入/文件区域触发排序拖拽
  return Boolean(
    target.closest(
      'input, textarea, select, option, button:not([data-slot-drag-handle]), a, .slot-dropzone, .slot-file-card, .slot-reference-files, .slot-file-checkbox, .slot-custom-text-input, [contenteditable="true"]'
    )
  );
}

function handleSlotCardDragStart(event) {
  // 禁用原生拖拽，统一使用 pointer 拖拽
  event.preventDefault();
}

function handleSlotSortDragOver(event) {
  if (pointerDragActive) return;
  if (isFileDrag(event) || !draggingSlotId || state.uploadState !== 'idle') return;
  const targetCard = getSlotCardFromEvent(event);
  const targetId = targetCard?.dataset.slotId;
  if (!targetId || targetId === draggingSlotId) return;
  event.preventDefault();
  event.stopPropagation();
  elements.slotContainer?.querySelectorAll('.slot-card').forEach((card) => {
    card.classList.remove('drag-over-sort');
  });
  targetCard.classList.add('drag-over-sort');
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function handleSlotSortDrop(event) {
  if (pointerDragActive) return;
  if (isFileDrag(event) || !draggingSlotId || state.uploadState !== 'idle') return;
  const targetCard = getSlotCardFromEvent(event);
  const targetId = targetCard?.dataset.slotId;
  if (targetId && targetId !== draggingSlotId) {
    reorderSlot(draggingSlotId, targetId);
  }
  event.preventDefault();
  event.stopPropagation();
  clearSlotDragVisuals();
}


function clearSlotFiles(slotId) {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法清空文件' });
    return;
  }
  const slot = getSlot(slotId);
  if (!slot) {
    return;
  }
  slot.files = [];
  slot.folderPath = '';
  slot.folderSources = [];
  slot.previewMap = new Map();
  slot.fileStatuses = new Map();
  slot.selectedFiles = new Set();
  renderSlots();
  persistSlotPresets();
  appendLog({ status: 'success', message: `已清空 ${getSlotReadableName(slot)} 的文件列表` });
}

function clearSlot(slotId) {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法清空分类' });
    return;
  }
  const slot = getSlot(slotId);
  if (!slot) {
    return;
  }
  slot.mainCategory = '';
  slot.subCategory = '';
  slot.subject = '';
  slot.eventName = '';
  slot.mode = SLOT_MODES.LIBRARY;
  slot.customLink = '';
  slot.customFolderId = '';
  slot.displayName = '';
  slot.folderPath = '';
  slot.folderSources = [];
  slot.files = [];
  slot.referenceFolderPath = '';
  slot.referenceFolderSources = [];
  slot.referenceFiles = [];
  slot.previewMap = new Map();
  slot.fileStatuses = new Map();
  slot.referenceFileStatuses = new Map();
  slot.lastFolderLink = '';
  slot.reviewReferenceLink = '';
  slot.admin = '';
  slot.customTexts = {};
  slot.namingPresetId = '';
  slot.folderNamingPresetId = '';
  slot.groupLabel = '';
  // slot.reviewEnabled = false;  // 保留审核开关状态，清空分类时不关闭
  slot.reviewFolderLink = '';
  slot.collapsed = false;
  slot.settingsOpen = false;
  slot.viewMode = 'upload';
  renderSlots();
  debouncedPreview();
  appendLog({ status: 'success', message: '已清空分类' });
  persistSlotPresets();
}

function duplicateSlot(slotId) {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法复制分类' });
    return;
  }
  const sourceSlot = getSlot(slotId);
  if (!sourceSlot) {
    return;
  }

  // 深拷贝原slot的配置，但不复制文件和路径
  const duplicatedPreset = {
    subject: sourceSlot.subject,
    admin: sourceSlot.admin,
    mainCategory: sourceSlot.mainCategory,
    subCategory: sourceSlot.subCategory,
    mode: sourceSlot.mode,
    customLink: sourceSlot.customLink,
    customFolderId: sourceSlot.customFolderId,
    displayName: sourceSlot.displayName ? `${sourceSlot.displayName} (副本)` : '',
    eventName: sourceSlot.eventName,
    namingPresetId: sourceSlot.namingPresetId,
    folderNamingPresetId: sourceSlot.folderNamingPresetId,
    groupLabel: sourceSlot.groupLabel,
    reviewEnabled: sourceSlot.reviewEnabled,
    // 深拷贝customTexts对象
    customTexts: sourceSlot.customTexts ? JSON.parse(JSON.stringify(sourceSlot.customTexts)) : {},
    // 不复制以下动态数据：
    // - files, referenceFiles (文件列表)
    // - folderPath, folderSources (文件夹路径)
    // - referenceFolderPath, referenceFolderSources (参考文件夹)
    // - lastFolderLink, reviewFolderLink, reviewReferenceLink (链接)
    // - previewMap, fileStatuses, referenceFileStatuses (状态)
  };

  addSlot(duplicatedPreset);
  appendLog({
    status: 'success',
    message: `已复制分类"${getSlotReadableName(sourceSlot)}"，可以独立修改新分类的配置`
  });
}


function getSlot(slotId) {
  return state.slots.find((slot) => slot.id === slotId);
}

function setSlotView(slotId, view = 'upload') {
  const slot = getSlot(slotId);
  if (!slot) return;
  slot.viewMode = view;
  persistSlotPresets();
  updateSlotViewUI(slotId, view);
}

function updateSlotViewUI(slotId, view) {
  const card = document.querySelector(`.slot-card[data-slot-id="${slotId}"]`);
  if (!card) return;
  const uploadView = card.querySelector('.slot-upload-view');
  const settingsView = card.querySelector('.slot-settings-view');
  uploadView?.classList.toggle('active', view === 'upload');
  settingsView?.classList.toggle('active', view === 'settings');

  const flipBtn = card.querySelector('[data-action="flip-slot-view"]');
  if (flipBtn) {
    const settingsIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"></path>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
    </svg>`;
    const backIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"></path>
    </svg>`;
    flipBtn.innerHTML = view === 'upload' ? settingsIcon : backIcon;
    flipBtn.setAttribute('title', view === 'upload' ? '设置上传分类命名' : '返回上传');
  }
}

function getSlotReadableName(slot) {
  if (slot.displayName && slot.displayName.trim()) {
    return slot.displayName.trim();
  }
  if (slot.mainCategory || slot.subCategory) {
    return `${slot.mainCategory || ''}${slot.subCategory ? `/${slot.subCategory}` : ''}` || '未命名分类';
  }
  const index = state.slots.indexOf(slot);
  return `分类 ${index >= 0 ? index + 1 : ''}`.trim();
}

function getSlotPlaceholderTitle(slot, order) {
  if (slot.mainCategory || slot.subCategory) {
    const combined = `${slot.mainCategory || ''}${slot.subCategory ? `/${slot.subCategory}` : ''}`;
    if (combined.trim()) {
      return combined.trim();
    }
  }
  const index = Number.isFinite(order) ? order : state.slots.indexOf(slot) + 1;
  return `分类 ${index || 1}`.trim();
}

function slotHasTarget(slot) {
  if (slot.mode === SLOT_MODES.CUSTOM_LINK) {
    return Boolean(slot.customFolderId);
  }
  return Boolean(slot.mainCategory && slot.subCategory);
}

function getSlotSubjectPlaceholder(slot) {
  if (slot.mainCategory || slot.subCategory) {
    const label = [slot.mainCategory, slot.subCategory].filter(Boolean).join(' / ');
    return label ? `输入 ${label} 的图片描述` : '输入图片名称/描述';
  }
  return '输入图片名称/描述';
}

function isSlotReviewEnabled(slot) {
  return Boolean(slot.reviewEnabled);
}

function getSlotReviewFolderId(slot) {
  const custom = slot.reviewFolderLink?.trim();
  if (custom) {
    return extractDriveFolderId(custom) || custom;
  }
  const global = state.config.reviewTempFolder?.trim();
  if (global) {
    return extractDriveFolderId(global) || global;
  }
  return '';
}

function matchesSlotFilter(slot) {
  if (!state.slotFilter) {
    return true;
  }
  const searchable = [
    slot.displayName,
    slot.subject,
    slot.admin,
    slot.mainCategory,
    slot.subCategory,
    slot.customLink,
    slot.mode === SLOT_MODES.CUSTOM_LINK ? '自定义链接' : '入库模式',
    slot.reviewFolderLink,
    slot.reviewReferenceLink,
    slot.referenceFolderPath,
    ...(slot.customTexts ? Object.values(slot.customTexts) : [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return searchable.includes(state.slotFilter);
}

function applyCustomLink(slot, value) {
  const input = (value || '').trim();
  slot.customLink = input;
  slot.customFolderId = extractDriveFolderId(input);
}

function slotMatchesView(slot) {
  if (state.slotViewMode === 'review') {
    return Boolean(slot.reviewEnabled);
  }
  return !slot.reviewEnabled;
}

function renderSlots() {
  const container = elements.slotContainer;
  container.hidden = false;
  container.classList.toggle('grouped', state.groupSlotsByMain);
  container.innerHTML = '';
  if (!state.slots.length) {
    // If no slots, we still want to show the add card, but maybe we should keep the default behavior of adding a slot if it's completely empty?
    // The original code called addSlot() which adds a data entry and re-renders.
    // If I just show the placeholder, the user can click it to add.
    // But if I replace addSlot() with just showing the placeholder, the state.slots will be empty.
    // Let's stick to the original behavior for empty state for now, OR better:
    // If empty, show the placeholder card ONLY?
    // The original code: if (!state.slots.length) { addSlot(); return; }
    // This means it auto-creates a slot if none exist.
    // I will keep this behavior to avoid breaking changes for now, but I will ALSO append the placeholder card in the main render loop.
    // Wait, if I keep addSlot(), then state.slots.length will be 1, so it goes to the main loop.
    // So I don't need to change the empty check.
    addSlot();
    return;
  }
  const slotsToRender = state.slots.filter((slot) => matchesSlotFilter(slot) && slotMatchesView(slot));
  if (!slotsToRender.length) {
    container.innerHTML =
      '<div class="slot-empty slot-search-empty">没有与搜索条件匹配的分类</div>';
    return;
  }
  if (state.groupSlotsByMain) {
    renderGroupedSlots(container, slotsToRender);
  } else {
    slotsToRender.forEach((slot) => {
      container.appendChild(createSlotCardElement(slot));
    });
    // Add the placeholder card at the end
    container.appendChild(createAddSlotCardElement());
  }
  bindSlotEvents();
  updateUploadControls();
}

function createAddSlotCardElement() {
  const card = document.createElement('div');
  card.className = 'add-slot-card';
  card.innerHTML = `
    <div class="add-slot-icon-container">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </div>
    <span class="add-slot-text">新建分类</span>
  `;
  card.addEventListener('click', () => {
    addSlot();
    // Scroll to bottom to see new slot?
    // addSlot calls renderSlots, which re-renders.
  });
  return card;
}

function getSoftwareDirectoryConfig() {
  const sheetIdInput = elements.softwareSheetId?.value?.trim();
  const rangeInput = elements.softwareSheetRange?.value?.trim();
  const submitUrlInput = elements.softwareSubmitUrl?.value?.trim();
  const submissionRangeInput = elements.softwareSubmissionRange?.value?.trim();
  const adminRangeInput = elements.softwareAdminRange?.value?.trim();
  return {
    sheetId: sheetIdInput || state.config.softwareSheetId || '',
    sheetRange: rangeInput || state.config.softwareSheetRange || 'Software!A:K',
    submissionRange: submissionRangeInput || state.config.softwareSubmissionRange || 'SoftwareSubmissions!A:S',
    adminRange: adminRangeInput || state.config.softwareAdminRange || 'SoftwareAdmins!A:A',
    submitUrl: submitUrlInput || state.config.softwareSubmitUrl || ''
  };
}

function hasSoftwareDirectoryConfig() {
  const cfg = getSoftwareDirectoryConfig();
  return Boolean(cfg.sheetId && cfg.sheetRange);
}

function hasSoftwareSubmissionConfig() {
  const cfg = getSoftwareDirectoryConfig();
  return Boolean(cfg.sheetId && cfg.submissionRange);
}

async function copySoftwareLink(url, button = null) {
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    if (button) {
      const originalTip = button.dataset.tip || '';
      if (originalTip) {
        button.dataset.tip = '已复制';
        setTimeout(() => {
          button.dataset.tip = originalTip;
        }, 1500);
      }
    }
  } catch (error) {
    console.error('Failed to copy software link', error);
  }
}

function renderSoftwareDirectory() {
  const container = elements.softwareDirectory;
  if (!container) {
    return;
  }
  if (state.softwareLoading) {
    container.innerHTML = '<div class="software-empty">正在同步软件目录...</div>';
    return;
  }
  if (!hasSoftwareDirectoryConfig()) {
    container.innerHTML = '<div class="software-empty">请在设置 &gt; AI 软件配置中填写表格 ID 和提交链接。</div>';
    if (elements.softwareCount) {
      elements.softwareCount.textContent = '0';
    }
    populateSoftwareCategoryFilter([]);
    return;
  }
  if (!state.softwareEntries.length) {
    container.innerHTML = '<div class="software-empty">尚未加载任何软件条目，点击“刷新目录”或提交新软件。</div>';
    if (elements.softwareCount) {
      elements.softwareCount.textContent = '0';
    }
    populateSoftwareCategoryFilter([]);
    return;
  }
  const filtered = getFilteredSoftwareEntries();
  if (elements.softwareCount) {
    elements.softwareCount.textContent = String(filtered.length);
  }
  if (!filtered.length) {
    container.innerHTML = '<div class="software-empty">没有符合筛选条件的软件，试试调整搜索或类别。</div>';
    return;
  }
  container.innerHTML = filtered.map((entry) => buildSoftwareCardMarkup(entry)).join('');
  container.querySelectorAll('[data-role="copy-website"]').forEach((button) => {
    button.addEventListener('click', () => {
      copySoftwareLink(button.dataset.url, button);
    });
  });
  container.querySelectorAll('[data-role="open-website"]').forEach((button) => {
    const url = button.dataset.url;
    if (!url) return;
    button.addEventListener('click', () => {
      if (window.bridge?.openExternal) {
        window.bridge.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    });
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      copySoftwareLink(url, button);
    });
  });
  if (state.softwareEditEnabled) {
    container.querySelectorAll('[data-role="edit-software"]').forEach((button) => {
      button.addEventListener('click', () => {
        const rowIndex = Number(button.dataset.row || 0);
        const entry = state.softwareEntries.find((item) => Number(item.rowIndex) === rowIndex);
        openSoftwareForm('edit', entry);
      });
    });
  }
}

function getFilteredSoftwareEntries() {
  const searchValue = (state.softwareFilters.search || '').toLowerCase();
  const categoryFilter = normalizeTextValue(state.softwareFilters.category).toLowerCase();
  return state.softwareEntries.filter((entry) => {
    const entryCategory = normalizeTextValue(entry.category).toLowerCase();
    if (categoryFilter && entryCategory !== categoryFilter) {
      return false;
    }
    if (!searchValue) {
      return true;
    }
    const haystack = [
      normalizeTextValue(entry.name),
      normalizeTextValue(entry.summary),
      normalizeTextValue(entry.category),
      normalizeTextValue(entry.usageLevel),
      normalizeTextValue(entry.safety)
    ]
      .map((item) => item.toLowerCase())
      .join(' ');
    return haystack.includes(searchValue);
  });
}

function populateSoftwareCategoryFilter(entries = []) {
  const select = elements.softwareCategoryFilter;
  if (!select) {
    return;
  }
  const unique = Array.from(
    new Set(
      entries
        .map((entry) => normalizeTextValue(entry.category))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  const current = state.softwareFilters.category;
  const options = ['<option value="">全部</option>', ...unique.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)].join('');
  select.innerHTML = options;
  if (current && !unique.some((item) => item === current)) {
    state.softwareFilters.category = '';
  }
  select.value = state.softwareFilters.category;
}

function buildSoftwareCardMarkup(entry = {}) {
  const {
    name = '未命名软件',
    icon,
    category = '未分类',
    usageLevel = '',
    safety = '',
    summary = '',
    website,
    tutorial,
    comments,
    copyrightLink,
    rating = ''
  } = entry;
  const trimmedSafety = (safety || '').trim();
  const safetyClass = trimmedSafety.includes('不安全') ? 'software-tag software-unsafe' : trimmedSafety ? 'software-tag software-safe' : 'software-tag';
  const iconMarkup = icon
    ? `<img src="${escapeHtml(icon)}" alt="${escapeHtml(name)}" onerror="this.replaceWith('<div class\\'software-placeholder\\' aria-hidden=\\'true\\'></div>');" />`
    : '<div class="software-placeholder" aria-hidden="true"></div>';
  const isSafeWebsite = trimmedSafety === '安全';
  const websiteButton = website
    ? isSafeWebsite
      ? `<button type="button" class="ghost software-tip" data-role="open-website" data-url="${escapeHtml(website)}" data-tip="左键打开，右键复制">官网</button>`
      : `<button type="button" class="ghost software-tip" data-role="copy-website" data-url="${escapeHtml(website)}" data-tip="链接为不安全或未知软件，需复制后翻墙访问">官网</button>`
    : '';
  const editButton =
    state.softwareEditEnabled && entry.rowIndex
      ? `<button type="button" class="ghost" data-role="edit-software" data-row="${entry.rowIndex}">编辑</button>`
      : '';
  const linkButtons = [
    websiteButton,
    tutorial ? `<a href="${tutorial}" target="_blank" rel="noreferrer" class="ghost">教程</a>` : '',
    comments ? `<a href="${comments}" target="_blank" rel="noreferrer" class="ghost">评论</a>` : ''
  ]
    .filter(Boolean)
    .join('');
  const usageText = usageLevel ? escapeHtml(usageLevel) : '未填写';
  const ratingText = rating ? escapeHtml(String(rating)) : '暂无';
  const safetyText = trimmedSafety ? escapeHtml(trimmedSafety) : '未检测';
  const safetyMetaMarkup = trimmedSafety
    ? `<span class="${trimmedSafety === '安全' ? 'software-safe-text' : 'software-unsafe-text'}">${safetyText}</span>`
    : safetyText;
  const summaryTip = escapeHtml(summary || '暂无核心功能描述');
  const copyrightTip = escapeHtml(copyrightLink || '未上传');
  return `
    <article class="software-card${trimmedSafety && trimmedSafety !== '安全' ? ' software-card-unsafe' : ''}">
      <header>
        ${iconMarkup}
        <div>
          <strong>${escapeHtml(name)}</strong>
          <div class="software-tags">
            <span class="software-tag">${escapeHtml(category)}</span>
          </div>
        </div>
      </header>
      <ul class="software-meta-list">
        <li>✔ 是否常用：${usageText}</li>
        <li>⭐ 推荐指数：${ratingText}</li>
        <li>🛡 安全性：${safetyMetaMarkup}</li>
        <li>© 版权结果：<span class="software-tip" data-tip="${copyrightTip}">悬停查看</span></li>
        <li>🔍 核心功能：<span class="software-tip" data-tip="${summaryTip}">悬停查看</span></li>
      </ul>
      ${linkButtons.length || editButton ? `<div class="software-tags">${linkButtons}${editButton}</div>` : ''}
    </article>
  `;
}


async function refreshSoftwareDirectory(options = {}) {
  const config = getSoftwareDirectoryConfig();
  if (!config.sheetId || !config.sheetRange) {
    state.softwareEntries = [];
    renderSoftwareDirectory();
    return;
  }
  if (state.softwareLoading) {
    return;
  }
  const { silent = false } = options;
  try {
    state.softwareLoading = true;
    renderSoftwareDirectory();
    if (!silent) {
      appendLog({ status: 'info', message: '正在同步 AI 软件目录…' });
    }
    const result = await window.bridge.fetchSoftwareDirectory({
      sheetId: config.sheetId,
      sheetRange: config.sheetRange,
      adminRange: config.adminRange
    });
    state.softwareEntries = Array.isArray(result?.entries) ? result.entries : Array.isArray(result) ? result : [];
    if (Array.isArray(result?.admins) || Array.isArray(result?.pendingAdmins)) {
      applySoftwareAdminData(result?.admins || [], result?.pendingAdmins || []);
    }
    populateSoftwareCategoryFilter(state.softwareEntries);
    state.softwareLoading = false;
    renderSoftwareDirectory();
    if (!silent) {
      appendLog({ status: 'success', message: `已加载 ${state.softwareEntries.length} 个软件条目` });
    }
  } catch (error) {
    state.softwareLoading = false;
    renderSoftwareDirectory();
    const rawMessage = error?.message || '';
    let friendlyMessage = rawMessage;
    if (/Requested entity was not found/i.test(rawMessage)) {
      friendlyMessage = '找不到该表格，请确认软件目录 Sheet ID 是否正确，或确保当前账号有访问权限。';
    }
    appendLog({ status: 'error', message: `软件目录同步失败：${friendlyMessage}` });
  }
}

function renderSoftwareReviewList() {
  const container = elements.softwareReviewList;
  if (!container) {
    return;
  }
  if (!isSoftwareReviewAccessible()) {
    container.innerHTML = '<div class="software-empty">仅管理员账号可访问软件审核。</div>';
    return;
  }
  if (!hasSoftwareSubmissionConfig()) {
    container.innerHTML = '<div class="software-empty">请在设置 &gt; AI 软件配置中填写“软件申请分页”。</div>';
    return;
  }
  if (state.softwareReviewLoading) {
    container.innerHTML = '<div class="software-empty">正在加载待审核的软件...</div>';
    return;
  }
  if (!state.softwareSubmissions.length) {
    container.innerHTML = '<div class="software-empty">暂无软件申请记录。</div>';
    return;
  }
  const pending = state.softwareSubmissions.filter((entry) => entry.isPending);
  if (!pending.length) {
    container.innerHTML = '<div class="software-empty">所有软件申请均已处理。</div>';
    return;
  }
  container.innerHTML = pending.map((entry) => createSoftwareReviewCard(entry)).join('');
  container.querySelectorAll('[data-role="software-review-action"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const action = event.currentTarget.dataset.action;
      const row = Number(event.currentTarget.dataset.row);
      handleSoftwareReviewAction(row, action);
    });
  });
}

function createSoftwareReviewCard(entry) {
  const safetyText = entry.safety ? escapeHtml(entry.safety) : '未填写';
  const summaryTip = escapeHtml(entry.summary || '暂无核心功能描述');
  const copyrightTip = escapeHtml(entry.copyrightResult || '未填写');
  const trimmedSafety = (entry.safety || '').trim();
  const safetyMetaMarkup = trimmedSafety
    ? `<span class="${trimmedSafety === '安全' ? 'software-safe-text' : 'software-unsafe-text'}">${safetyText}</span>`
    : safetyText;
  const iconMarkup = entry.icon
    ? `<img src="${escapeHtml(entry.icon)}" alt="${escapeHtml(entry.name || '')}" onerror="this.replaceWith('<div class\\'software-placeholder\\' aria-hidden=\\'true\\'></div>');" />`
    : '<div class="software-placeholder" aria-hidden="true"></div>';
  return `
    <article class="software-card software-review-card">
      <header>
        ${iconMarkup}
        <div>
          <strong>${escapeHtml(entry.name || '未命名软件')}</strong>
          <div class="software-tags">
            <span class="software-tag">${escapeHtml(entry.category || '未分类')}</span>
            <span class="software-tag ghost-tag">申请人：${escapeHtml(entry.applicantName || '未知')}</span>
          </div>
        </div>
      </header>
      <ul class="software-meta-list">
        <li>✔ 是否常用：${escapeHtml(entry.usageLevel || '未填写')}</li>
        <li>⭐ 推荐指数：${escapeHtml(entry.rating || '未填写')}</li>
        <li>🛡 安全性：${safetyMetaMarkup}</li>
        <li>© 版权结果：<span class="software-tip" data-tip="${copyrightTip}">悬停查看</span></li>
        <li>🔍 核心功能：<span class="software-tip" data-tip="${summaryTip}">悬停查看</span></li>
        <li>🔗 官网：${entry.website ? `<span class="software-tip" data-tip="${escapeHtml(entry.website)}">已填写</span>` : '未填写'}</li>
        <li>📧 申请邮箱：${escapeHtml(entry.applicantEmail || '')}</li>
        <li>🕒 提交时间：${escapeHtml(entry.submittedAt || '')}</li>
      </ul>
      <div class="software-tags">
        <button type="button" class="ghost success" data-role="software-review-action" data-action="approve" data-row="${entry.rowNumber}">通过</button>
        <button type="button" class="ghost danger" data-role="software-review-action" data-action="reject" data-row="${entry.rowNumber}">驳回</button>
      </div>
    </article>
  `;
}

function deriveDomainFromUrl(url) {
  if (!url) {
    return '';
  }
  const trimmed = String(url).trim();
  if (!trimmed) {
    return '';
  }
  try {
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    return new URL(normalized).hostname;
  } catch (error) {
    return '';
  }
}

function normalizeSubmissionEntryData(entry = {}) {
  const clone = { ...entry };
  const ensureString = (value) => {
    if (value == null) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    try {
      return String(value);
    } catch (error) {
      return '';
    }
  };
  if (!ensureString(clone.icon).trim() && clone.website) {
    const domain = deriveDomainFromUrl(clone.website);
    if (domain) {
      clone.icon = `=IMAGE("https://www.google.com/s2/favicons?sz=128&domain=${domain}", 4, 48, 48)`;
    }
  }
  const textKeys = [
    'category',
    'name',
    'website',
    'usageLevel',
    'rating',
    'safety',
    'summary',
    'copyrightResult',
    'tutorial',
    'comments',
    'notes'
  ];
  textKeys.forEach((key) => {
    clone[key] = ensureString(clone[key]).trim();
  });
  return clone;
}

async function refreshSoftwareSubmissions(options = {}) {
  if (!isSoftwareReviewAccessible()) {
    return;
  }
  const config = getSoftwareDirectoryConfig();
  if (!config.sheetId || !config.submissionRange) {
    state.softwareSubmissions = [];
    renderSoftwareReviewList();
    return;
  }
  if (state.softwareReviewLoading) {
    return;
  }
  const { silent = false } = options;
  try {
    state.softwareReviewLoading = true;
    state.softwareReviewFetched = true;
    renderSoftwareReviewList();
    const result = await window.bridge.fetchSoftwareSubmissions({
      sheetId: config.sheetId,
      submissionRange: config.submissionRange
    });
    state.softwareSubmissions = Array.isArray(result?.entries)
      ? result.entries.map((entry) => normalizeSubmissionEntryData(entry))
      : [];
    state.softwareReviewLoading = false;
    renderSoftwareReviewList();
    if (!silent) {
      appendLog({
        status: 'success',
        message: `已同步 ${state.softwareSubmissions.length} 条软件申请`
      });
    }
  } catch (error) {
    state.softwareReviewLoading = false;
    renderSoftwareReviewList();
    appendLog({
      status: 'error',
      message: `软件申请同步失败：${error.message}`
    });
  }
}

async function handleSoftwareReviewAction(rowNumber, action) {
  if (!isSoftwareReviewAccessible()) {
    appendLog({ status: 'error', message: '仅管理员可执行审核操作' });
    return;
  }
  const entry = state.softwareSubmissions.find((item) => Number(item.rowNumber) === Number(rowNumber));
  if (!entry) {
    appendLog({ status: 'error', message: '未找到对应的软件申请' });
    return;
  }
  const actionLabel = action === 'reject' ? '驳回' : '通过';
  const confirmed = await showConfirmationDialog({
    title: `确认${actionLabel}`,
    message: `确定要${actionLabel}“${entry.name || '未命名软件'}”？`,
    confirmText: `确认${actionLabel}`,
    destructive: action === 'reject'
  });
  if (!confirmed) {
    return;
  }
  let reviewNotes = '';
  if (action === 'reject') {
    const note = await showTextInputDialog({
      title: '驳回原因（可选）',
      placeholder: '请输入驳回原因',
      confirmText: '保存',
      cancelText: '跳过'
    });
    reviewNotes = note || '';
  }
  try {
    await window.bridge.reviewSoftwareSubmission({
      action,
      rowNumber: entry.rowNumber,
      sheetId: state.config.softwareSheetId,
      submissionRange: state.config.softwareSubmissionRange,
      directoryRange: state.config.softwareSheetRange,
      reviewer: state.currentUserEmail || '',
      notes: reviewNotes || '',
      entryData: normalizeSubmissionEntryData(entry)
    });
    appendLog({
      status: 'success',
      message: `已${actionLabel}软件：“${entry.name || '未命名'}”`,
      broadcastGlobal: true
    });
    await refreshSoftwareSubmissions({ silent: true });
    await refreshSoftwareDirectory({ silent: true });
  } catch (error) {
    appendLog({
      status: 'error',
      message: `审核操作失败：${error.message}`
    });
  }
}

function openSoftwareForm(mode = 'create', entry = null) {
  const overlay = elements.softwareFormOverlay;
  if (!overlay) return;
  state.softwareFormMode = mode;
  state.softwareFormPayload = entry;
  overlay.hidden = false;
  elements.softwareFormTitle.textContent =
    mode === 'edit' && entry ? `编辑软件：${entry.name || ''}` : '提交新软件';
  const fields = elements.softwareFormFields;
  fields.category.value = entry?.category || '';
  fields.name.value = entry?.name || '';
  fields.website.value = entry?.website || '';
  fields.usage.value = entry?.usageLevel || '';
  fields.rating.value = entry?.rating || '';
  fields.safety.value = entry?.safety || '';
  fields.copyright.value = entry?.copyrightLink || '';
  fields.summary.value = entry?.summary || '';
  fields.tutorial.value = entry?.tutorial || '';
  fields.comments.value = entry?.comments || '';
  fields.notes.value = '';
}

function closeSoftwareForm() {
  if (elements.softwareFormOverlay) {
    elements.softwareFormOverlay.hidden = true;
  }
  state.softwareFormPayload = null;
}

function gatherSoftwareFormData() {
  const fields = elements.softwareFormFields;
  return {
    category: fields.category.value.trim(),
    name: fields.name.value.trim(),
    website: fields.website.value.trim(),
    usageLevel: fields.usage.value.trim(),
    rating: fields.rating.value.trim(),
    safety: fields.safety.value.trim(),
    summary: fields.summary.value.trim(),
    copyrightResult: fields.copyright.value.trim(),
    tutorial: fields.tutorial.value.trim(),
    comments: fields.comments.value.trim(),
    notes: fields.notes.value.trim()
  };
}

async function handleSoftwareFormSubmit() {
  const submitUrl = (state.config.softwareSubmitUrl || '').trim();
  if (!submitUrl) {
    appendLog({ status: 'error', message: '请先在设置中填写软件提交表单链接' });
    return;
  }
  const payload = {
    mode: state.softwareFormMode,
    rowIndex: state.softwareFormPayload?.rowIndex || null,
    submittedAt: new Date().toISOString(),
    data: gatherSoftwareFormData()
  };
  try {
    elements.softwareFormSubmit.disabled = true;
    const response = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`提交失败 (${response.status})`);
    }
    appendLog({ status: 'success', message: '软件信息已提交，等待管理员审核' });
    closeSoftwareForm();
  } catch (error) {
    appendLog({ status: 'error', message: `软件提交失败：${error.message}` });
  } finally {
    elements.softwareFormSubmit.disabled = false;
  }
}

function handleRefreshSoftwareDirectory() {
  if (!hasSoftwareDirectoryConfig()) {
    appendLog({ status: 'error', message: '请先在设置中填写软件目录表格 ID 和分页' });
    renderSoftwareDirectory();
    return;
  }
  refreshSoftwareDirectory();
}

function getSlotUploadStatus(slot) {
  const uploadState = state.uploadState;

  const totalFiles =
    (slot.files?.length || 0) +
    (slot.reviewEnabled ? (slot.referenceFiles?.length || 0) : 0);
  const statuses = [];
  slot.fileStatuses?.forEach((info) => info?.status && statuses.push(info.status));
  if (slot.reviewEnabled && slot.referenceFileStatuses) {
    slot.referenceFileStatuses.forEach((info) => info?.status && statuses.push(info.status));
  }

  // 检查该分类是否在队列中
  const isInQueue = state.uploadQueue.includes(slot.id);
  if (isInQueue) {
    const queueIndex = state.uploadQueue.indexOf(slot.id);
    return { label: `队列中 (${queueIndex + 1})`, className: 'slot-upload-status-queued' };
  }

  // 全局暂停/停止状态（只在该分类有文件正在上传时才显示）
  if (uploadState === 'paused' && (statuses.includes('running') || statuses.includes('queued') || statuses.includes('pending'))) {
    return { label: '上传暂停', className: 'slot-upload-status-paused' };
  }
  if (uploadState === 'stopped' && (statuses.includes('running') || statuses.includes('queued') || statuses.includes('pending'))) {
    return { label: '上传停止', className: 'slot-upload-status-stopped' };
  }

  // 基于文件状态判断
  if (statuses.includes('error')) {
    return { label: '上传失败', className: 'slot-upload-status-error' };
  }
  if (statuses.includes('running') || statuses.includes('queued') || statuses.includes('pending')) {
    return { label: '上传中', className: 'slot-upload-status-running' };
  }
  if (
    statuses.length > 0 &&
    statuses.every((status) => status === 'success' || status === 'skipped')
  ) {
    return { label: '上传完成', className: 'slot-upload-status-success' };
  }
  return { label: '等待上传', className: 'slot-upload-status-waiting' };
}

function createSlotMarkup(slot, order) {
  const viewMode = slot.viewMode || 'upload';
  const mainOptions = renderMainOptions(slot.mainCategory);
  const subOptions = renderSubOptions(slot.mainCategory, slot.subCategory);
  const hasFiles = slot.files.length > 0;
  const fileSummaryText = hasFiles ? formatFileTypeSummary(slot.files) : '';
  const fileSummary = fileSummaryText
    ? `<div class="slot-file-summary" title="根据扩展名和文件头自动识别">识别类型：${fileSummaryText}</div>`
    : '';
  const selectedFileCount = slot.selectedFiles.size;
  const fileSelectionInfo = hasFiles && selectedFileCount > 0
    ? `<span class="file-selection-count">已选 ${selectedFileCount} 个</span>`
    : '';
  const fileHeader = hasFiles
    ? `<div class="slot-file-header" aria-hidden="true">
        <label class="slot-file-checkbox">
          <input
            type="checkbox"
            class="file-select-all"
            data-slot-id="${slot.id}"
            data-is-reference="false"
            title="全选/取消全选"
          />
        </label>
        <span class="slot-file-name">原文件</span>
        <span class="slot-file-name">命名预览</span>
        <span class="slot-file-type">识别类型</span>
        <span class="slot-file-status">状态</span>
      </div>
      <div class="file-bulk-actions" style="display: ${selectedFileCount > 0 ? 'flex' : 'none'}">
        ${fileSelectionInfo}
        <button class="btn-text" data-action="clear-selection" data-slot-id="${slot.id}" data-is-reference="false">取消选择</button>
        <button class="btn-text" data-action="inverse-select-files" data-slot-id="${slot.id}" data-is-reference="false">反选</button>
        <button class="btn-text btn-danger" data-action="delete-selected-files" data-slot-id="${slot.id}" data-is-reference="false">删除选中</button>
      </div>`
    : '';
  const fileRows = hasFiles
    ? renderFileGridView(slot, slot.files)
    : `<div class="slot-dropzone-empty">
         <div class="slot-dropzone-icon-wrapper">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
             <polyline points="17 8 12 3 7 8"></polyline>
             <line x1="12" y1="3" x2="12" y2="15"></line>
           </svg>
         </div>
         <div class="slot-dropzone-text">
           <div class="slot-dropzone-title">点击选择或拖拽文件</div>
           <div class="slot-dropzone-subtitle">支持 JPG, PNG, MP4 等格式</div>
         </div>
       </div>`;
  const fileCount =
    slot.files.length > 0 ? `<div class="slot-file-count-badge">共 ${slot.files.length} 个文件</div>` : '';
  const folderPath = slot.folderPath || '未选择（也可以将目录拖拽到此卡片）';
  const isCustomMode = slot.mode === SLOT_MODES.CUSTOM_LINK;
  const showReviewControls = state.slotViewMode === 'review';
  const customLinkHint =
    slot.customLink && !slot.customFolderId
      ? '<small class="error-text">无法识别链接中的文件夹 ID，请确认链接是否正确</small>'
      : '<small>支持粘贴 Google Drive 文件夹链接或直接输入文件夹 ID</small>';
  const customModeDisabled = slot.reviewEnabled || state.slotViewMode === 'review';
  const tokenUsage = getSlotTokenUsage(slot);
  const showSubjectField = slotShouldShowSubject(tokenUsage);
  const showEventField = slotShouldShowEventName(tokenUsage);
  const showAdminField = slotShouldShowAdmin(tokenUsage);
  const customTextInputs = renderSlotCustomTextInputs(slot, tokenUsage);
  const namingPreviewText = getSlotNamingPreviewText(slot);
  const folderPreviewText = getSlotFolderPreviewText(slot);
  const slotTitleValue = slot.displayName?.trim() || '';
  const slotPlaceholderTitle = getSlotPlaceholderTitle(slot, order);
  const referenceLink = slot.reviewReferenceLink || '';
  const referenceLinkDisplay = referenceLink || '上传审核素材后会自动创建“参考”文件夹';
  const referenceLinkActions = referenceLink
    ? `<div class="slot-link-actions">
          <button data-action="open-link" data-slot-id="${slot.id}" data-link="${referenceLink}" class="ghost">打开参考</button>
        </div>`
    : '';
  const referenceFolderPath =
    slot.referenceFolderPath || '未选择参考目录（也可以将参考文件拖到下方区域）';
  const selectedReferenceCount = slot.selectedReferenceFiles.size;
  const referenceSelectionInfo = slot.referenceFiles.length > 0 && selectedReferenceCount > 0
    ? `<span class="file-selection-count">已选 ${selectedReferenceCount} 个</span>`
    : '';

  // 使用网格视图渲染参考素材
  const referenceGridView = slot.referenceFiles.length > 0
    ? renderFileGridView(slot, slot.referenceFiles, { isReference: true })
    : `<div class="slot-dropzone-empty">
        <div class="slot-dropzone-icon-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"></path>
          </svg>
        </div>
        <span class="slot-dropzone-title">点击选择目录或拖拽文件到此处</span>
        <span class="slot-dropzone-desc">支持 JPG, PNG, MP4 等格式</span>
      </div>`;

  // 批量操作按钮（只在有选中文件时显示）
  const referenceBulkActions = slot.referenceFiles.length > 0 && selectedReferenceCount > 0
    ? `<div class="file-bulk-actions" style="margin-top: 8px;">
        ${referenceSelectionInfo}
        <button class="btn-text" data-action="clear-selection" data-slot-id="${slot.id}" data-is-reference="true">取消选择</button>
        <button class="btn-text" data-action="inverse-select-files" data-slot-id="${slot.id}" data-is-reference="true">反选</button>
        <button class="btn-text btn-danger" data-action="delete-selected-files" data-slot-id="${slot.id}" data-is-reference="true">删除选中</button>
      </div>`
    : '';

  const referenceCount =
    slot.referenceFiles.length > 0 ? `<div class="muted" style="margin-top: 8px;">共 ${slot.referenceFiles.length} 个参考文件。</div>` : '';

  const referenceInfo =
    showReviewControls && slot.reviewEnabled
      ? `<div class="slot-reference-block" data-slot-id="${slot.id}">
        <div class="slot-reference-header">
          <span class="slot-reference-title">参考素材</span>
          ${referenceLinkActions ? `<div class="slot-reference-actions">${referenceLinkActions}</div>` : ''}
        </div>
        <div class="slot-reference-files" data-slot-id="${slot.id}" data-action="pick-reference-folder" title="点击选择目录或拖拽文件到此处">
          ${referenceGridView}
        </div>
        ${referenceBulkActions}
        ${referenceCount}
      </div>`
      : '';
  const linkLabel = slot.reviewEnabled
    ? '审核链接'
    : (isCustomMode ? '上传链接' : '入库链接');
  const linkPlaceholder = slot.reviewEnabled
    ? '尚未生成审核链接'
    : (isCustomMode ? '尚未上传' : '尚未入库');
  const slotUploadStatus = getSlotUploadStatus(slot);
  const summaryCategory =
    slot.mode === SLOT_MODES.CUSTOM_LINK
      ? slot.customLink
        ? '自定义链接'
        : '未设置链接'
      : `${slot.mainCategory || '未选主类'} / ${slot.subCategory || '未选子类'}`;
  const summaryAdmin = showAdminField ? slot.admin?.trim() || '未设置' : '未设置';
  const summaryLink =
    slot.mode === SLOT_MODES.CUSTOM_LINK && slot.customLink
      ? `<button type="button" class="link-button" data-open-url="${slot.customLink}">${escapeHtml(slot.customLink)}</button>`
      : '未设置';
  const targetControls = !isCustomMode
    ? `<div class="slot-category-grid">
            <label>
              <span>主类别</span>
              <select class="slot-main" data-slot-id="${slot.id}">
                <option value="">请选择</option>
                ${mainOptions}
              </select>
            </label>
            <label>
              <span>子类别</span>
              <select class="slot-sub" data-slot-id="${slot.id}" title="${slot.mainCategory ? '' : '请先选择主类别'
    }" ${slot.mainCategory ? '' : 'disabled'}>
                <option value="">请选择</option>
                ${subOptions}
              </select>
            </label>
          </div>`
    : `<label>
            <span>自定义入库链接</span>
            <input type="text" class="slot-custom-link" data-slot-id="${slot.id}" placeholder="粘贴 Drive 链接或 ID" value="${slot.customLink || ''}" />
            ${customLinkHint}
            ${slot.customLink
      ? `<div class="slot-custom-link-actions">
                    <button data-action="open-link" data-slot-id="${slot.id}" data-link="${slot.customLink}" class="ghost">打开</button>
                    <button data-action="copy-link" data-slot-id="${slot.id}" data-link="${slot.customLink}" class="ghost">复制</button>
                  </div>`
      : ''
    }
          </label>`;
  const adminFieldBlock =
    showAdminField
      ? `<label>
          <span>管理员</span>
          <input type="text" class="slot-admin" data-slot-id="${slot.id}" placeholder="管理员姓名" value="${slot.admin || ''}" />
        </label>`
      : '';
  const toggleTitle = viewMode === 'upload' ? '设置上传分类命名' : '返回上传';
  const toggleIcon = viewMode === 'upload' ? '⚙️' : '←';
  return `
    <header>
      <div class="slot-header-top">
        <div class="slot-header-main">
          <button data-slot-drag-handle="true" data-slot-id="${slot.id}" class="icon-btn slot-drag-handle" data-tip="拖拽排序" draggable="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="5" cy="5" r="2"></circle>
              <circle cx="19" cy="5" r="2"></circle>
              <circle cx="5" cy="12" r="2"></circle>
              <circle cx="19" cy="12" r="2"></circle>
              <circle cx="5" cy="19" r="2"></circle>
              <circle cx="19" cy="19" r="2"></circle>
            </svg>
          </button>
          <span class="slot-title${slotTitleValue ? ' has-custom-name' : ''}" contenteditable="true" data-slot-id="${slot.id}" title="点击修改分类名称" data-edit-hint="点击修改" data-placeholder="${escapeHtml(
    slotPlaceholderTitle
  )}">${escapeHtml(slotTitleValue)}</span>
        </div>
        <div class="slot-header-actions">
          <button data-action="flip-slot-view" data-slot-id="${slot.id}" class="icon-btn icon-btn-settings" data-tip="${toggleTitle}">
            ${viewMode === 'upload'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"></path>
                   <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
                 </svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M19 12H5M12 19l-7-7 7-7"></path>
                 </svg>`
    }
          </button>
          <button data-action="clear-slot" data-slot-id="${slot.id}" class="icon-btn" data-tip="清空分类设置">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"></path>
            </svg>
          </button>
          <button data-action="duplicate-slot" data-slot-id="${slot.id}" class="icon-btn" data-tip="复制分类">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
            </svg>
          </button>
          <button data-action="remove-slot" data-slot-id="${slot.id}" class="icon-btn icon-btn-danger" data-tip="删除分类">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="slot-header-info">
        <div class="slot-chip-row">
          <span class="slot-chip outline">${escapeHtml(slot.mainCategory || '未选主类')}</span>
          <span class="slot-chip outline">${escapeHtml(slot.subCategory || '未选子类')}</span>
          <span class="slot-admin-label">管理员：${escapeHtml(summaryAdmin)}</span>
        </div>
        <div class="slot-preview-compact">
          <div class="slot-preview-item">
            <span class="slot-preview-label-compact">文件命名：</span>
            <span class="slot-preview-value" data-slot-id="${slot.id}" data-preview-type="naming">${escapeHtml(namingPreviewText)}</span>
          </div>
          <div class="slot-preview-item">
            <span class="slot-preview-label-compact">文件夹：</span>
            <span class="slot-preview-value" data-slot-id="${slot.id}" data-preview-type="folder">${escapeHtml(folderPreviewText)}</span>
          </div>
        </div>
      </div>
    </header>
    <div class="slot-body">
      <div class="slot-views">
        <div class="slot-upload-view${viewMode === 'upload' ? ' active' : ''}" data-slot-id="${slot.id}">
          ${showSubjectField
      ? `<div class="slot-field-card subject-only">
                  <input type="text" class="slot-subject slot-field-input" data-slot-id="${slot.id}" placeholder="${escapeHtml(
        getSlotSubjectPlaceholder(slot)
      )}" value="${slot.subject || ''}" />
                </div>`
      : ''
    }
          ${customTextInputs}
          ${showEventField
      ? `<label class="compact-field">
                <span>事件名称</span>
                <input type="text" class="slot-event-name" data-slot-id="${slot.id}" placeholder="如：事件名称（日期+名称）" value="${slot.eventName || ''}" />
              </label>`
      : ''
    }
          <div class="slot-dropzone" data-slot-id="${slot.id}" data-has-files="${hasFiles}" data-action="pick-folder" title="点击选择目录或拖拽文件到此处">
            ${hasFiles
      ? `<div class="slot-file-list-wrapper">
                  ${fileHeader}
                  ${fileRows}
                </div>
                <div class="slot-dropzone-actions">
                  <button class="slot-clear-files-btn" data-action="clear-slot-files" data-slot-id="${slot.id}">清空文件</button>
                  <div class="slot-upload-status ${slotUploadStatus.className}" data-slot-id="${slot.id}">${slotUploadStatus.label}</div>
                  <button class="slot-upload-confirm-btn" data-slot-upload-action="start" data-slot-id="${slot.id}">确认上传</button>
                </div>`
      : fileRows
    }
          </div>
          ${fileCount ? `<div class="slot-folder-path-hint">${folderPath}</div>` : ''}
          ${fileCount}
          <div class="slot-card-toggle inline" role="tablist" hidden>
            <!-- Old actions hidden -->
          </div>
          <div class="slot-link-row link-below-files">
            <div class="slot-link-label">
              <span class="slot-link-dot" aria-hidden="true"></span>
              <span>${linkLabel}</span>
            </div>
            <div class="slot-link" title="${slot.lastFolderLink || ''}">
              ${slot.lastFolderLink
      ? `<button type="button" class="link-button" data-open-url="${slot.lastFolderLink}">${escapeHtml(slot.lastFolderLink)}</button>`
      : linkPlaceholder
    }
            </div>
            ${slot.lastFolderLink
      ? `<div class="slot-link-actions">
                  <button data-action="copy-link" data-slot-id="${slot.id}" data-link="${slot.lastFolderLink}" class="ghost">复制</button>
                </div>`
      : ''
    }
          </div>
          ${referenceInfo}
        </div>
        <div class="slot-settings-view${viewMode === 'settings' ? ' active' : ''}" data-slot-id="${slot.id}">
          <div class="slot-settings-grid">
            <label title="分组标签">
              <span>分组标签</span>
              <input type="text" class="slot-group-label" data-slot-id="${slot.id}" value="${escapeHtml(slot.groupLabel || '')}" placeholder="如：活动 / 新闻" />
            </label>
            <label title="上传模式">
              <span>上传模式</span>
              <select class="slot-mode" data-slot-id="${slot.id}" aria-label="上传模式">
                <option value="${SLOT_MODES.LIBRARY}" ${!isCustomMode ? 'selected' : ''}>入库模式（主/子类别）</option>
                <option value="${SLOT_MODES.CUSTOM_LINK}" ${isCustomMode ? 'selected' : ''} ${customModeDisabled ? 'disabled' : ''}>自定义链接模式</option>
              </select>
            </label>
            ${targetControls}
            ${isCustomMode
      ? `<label class="checkbox-field">
                <input type="checkbox" class="slot-no-subfolder" data-slot-id="${slot.id}" ${slot.skipCreateSubfolder ? 'checked' : ''} />
                <span>直接上传到该目录（不创建子文件夹）</span>
              </label>`
      : ''
    }
            ${adminFieldBlock}
            <label>
              <span>任务类型 <span class="required">*</span></span>
              <select class="slot-task-type" data-slot-id="${slot.id}" required>
                ${renderTaskTypeOptions(slot.taskType)}
              </select>
              <input type="text" class="slot-task-type-custom" data-slot-id="${slot.id}" placeholder="输入自定义任务类型" value="${slot.taskType && !getKnownTaskTypes().includes(slot.taskType) ? slot.taskType : ''}" style="margin-top: 8px; display: ${slot.taskType && !getKnownTaskTypes().includes(slot.taskType) ? 'block' : 'none'};" />
            </label>
            <label title="命名规则">
              <span>文件命名</span>
              <select class="slot-naming-rule" data-slot-id="${slot.id}" aria-label="命名规则">
                <option value="">通用文件命名规范</option>
                ${renderNamingPresetOptions(slot.namingPresetId)}
              </select>
            </label>
            <label title="文件夹命名规则">
              <span>文件夹命名</span>
              <select class="slot-folder-naming" data-slot-id="${slot.id}" aria-label="文件夹命名规则">
                <option value="">通用文件夹命名规范</option>
                ${renderFolderPresetOptions(slot.folderNamingPresetId)}
              </select>
            </label>
            <div class="slot-naming-preview-block">
              <span class="slot-preview-label">命名预览</span>
              <div class="slot-naming-preview" data-slot-id="${slot.id}">${escapeHtml(namingPreviewText)}</div>
            </div>
            <div class="slot-naming-preview-block">
              <span class="slot-preview-label">文件夹预览</span>
              <div class="slot-folder-preview" data-slot-id="${slot.id}">${escapeHtml(folderPreviewText)}</div>
            </div>
            ${showReviewControls
      ? `<div class="slot-review-block">
              <label class="checkbox-field">
                <input type="checkbox" class="slot-review-toggle" data-slot-id="${slot.id}" ${slot.reviewEnabled ? 'checked' : ''} />
                <span>此分类需审核（先上传到临时目录）</span>
              </label>
              <label>
                <span>审核临时目录（可选）</span>
                <input type="text" class="slot-review-folder-input" data-slot-id="${slot.id}" placeholder="覆盖全局审核目录" value="${slot.reviewFolderLink || ''}" />
              </label>
            </div>`
      : ''
    }
          </div>
          <div class="slot-settings-actions">
            <button type="button" class="primary pill" data-slot-id="${slot.id}" data-slot-view="upload">完成设置，返回上传</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createSlotCardElement(slot) {
  const card = document.createElement('div');
  card.className = 'slot-card';
  if (slot.collapsed) {
    card.classList.add('collapsed');
  }
  if (slot.reviewEnabled && state.slotViewMode === 'review') {
    card.classList.add('has-review');
  }
  card.dataset.slotId = slot.id;
  const order = state.slots.indexOf(slot) + 1;
  card.innerHTML = createSlotMarkup(slot, order);
  return card;
}

function renderGroupedSlots(container, slots) {
  const groupMap = new Map();
  slots.forEach((slot) => {
    const groupName = slot.groupLabel?.trim() || '未分组';
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }
    groupMap.get(groupName).push(slot);
  });
  groupMap.forEach((groupSlots, groupName) => {
    const group = document.createElement('details');
    group.className = 'slot-group';
    group.open = true;
    const summary = document.createElement('summary');
    summary.innerHTML = `<span>${escapeHtml(groupName)}</span><span class="slot-group-count">${groupSlots.length}</span>`;
    group.appendChild(summary);
    const body = document.createElement('div');
    body.className = 'slot-grid';
    groupSlots.forEach((slot) => body.appendChild(createSlotCardElement(slot)));
    group.appendChild(body);
    container.appendChild(group);
  });
}


function renderSlotCustomTextInputs(slot, tokenUsage = getSlotTokenUsage(slot)) {
  const defs = state.customTextDefs.filter(
    (def) => def.scope === CUSTOM_TEXT_SCOPE.SLOT && tokenUsage.has(def.token)
  );

  if (!defs.length) {
    return '';
  }
  const inputs = defs
    .map((def) => {
      const currentValue = (slot.customTexts && slot.customTexts[def.id]) || '';

      if (def.inputType === 'select' && def.options && def.options.length > 0) {
        // 下拉菜单
        const optionsHtml = def.options
          .map(opt => `<option value="${escapeHtml(opt)}" ${currentValue === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`)
          .join('');
        return `
          <label>
            <span class="slot-custom-text-label">${escapeHtml(def.label)}</span>
            <select class="slot-custom-text-input" data-slot-id="${slot.id}" data-custom-id="${def.id}">
              <option value="">请选择...</option>
              ${optionsHtml}
            </select>
          </label>
        `;
      } else {
        // 文本输入
        return `
          <label>
            <input type="text" class="slot-custom-text-input" data-slot-id="${slot.id}" data-custom-id="${def.id}" placeholder="${def.label}" value="${escapeHtml(currentValue)}" />
          </label>
        `;
      }
    })
    .join('');
  const result = `<div class="slot-custom-texts"><div class="slot-section-title">分类专用文字块</div>${inputs}</div>`;
  return result;
}

function renderMainOptions(selected) {
  return state.categories
    .map((cat) => `<option value="${cat.name}" ${cat.name === selected ? 'selected' : ''}>${cat.name}</option>`)
    .join('');
}

function resolveCategoryFolderId(mainCategory, subCategory) {
  if (!mainCategory || !subCategory) return '';
  const subMap = state.categoryMap?.[mainCategory];
  if (!subMap) return '';
  return subMap[subCategory] || '';
}

function renderSubOptions(main, selected) {
  if (!main) return '';
  const target = state.categories.find((cat) => cat.name === main);
  if (!target) return '';
  return target.subs
    .map(
      (sub) =>
        `<option value="${sub.name}" ${sub.name === selected ? 'selected' : ''}>${sub.name}</option>`
    )
    .join('');
}

function renderFileRow(slot, file, options = {}) {
  const preview = slot.previewMap.get(file.id);
  const statusMap = options.statusMap || slot.fileStatuses;
  const isReference = options.isReference || false;  // 是否是参考文件
  const selectedSet = isReference ? slot.selectedReferenceFiles : slot.selectedFiles;
  const isChecked = selectedSet.has(file.id);
  const statusInfo = statusMap.get(file.id) || { status: 'pending', message: '待上传' };
  const statusClass = statusInfo.status || 'pending';
  const newName = preview?.newName || '-';
  const ext = file.name.split('.').pop().toUpperCase().slice(0, 4);

  // 判断是否是图片或视频文件
  const lowerName = file.name.toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif'].some(imgExt => lowerName.endsWith(imgExt));
  const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv'].some(vidExt => lowerName.endsWith(vidExt));

  // 生成缩略图或扩展名徽章
  let thumbnailOrBadge;
  if (isImage && file.path) {
    thumbnailOrBadge = `<div class="slot-file-thumbnail">
         <img src="${resolveFileUrl(file.path)}" alt="${escapeHtml(file.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'slot-file-badge\\'>${ext}</div>'" />
       </div>`;
  } else if (isVideo && file.path) {
    thumbnailOrBadge = `<div class="slot-file-thumbnail slot-file-video-thumbnail">
         <video src="${resolveFileUrl(file.path)}" muted preload="metadata" onerror="this.parentElement.innerHTML='<div class=\\'slot-file-badge\\'>${ext}</div>'"></video>
       </div>`;
  } else {
    thumbnailOrBadge = `<div class="slot-file-badge">${ext}</div>`;
  }

  return `
    <div class="slot-file-card">
      <label class="slot-file-checkbox">
        <input 
          type="checkbox" 
          ${isChecked ? 'checked' : ''}
          data-slot-id="${slot.id}" 
          data-file-id="${file.id}"
          data-is-reference="${isReference}"
        />
      </label>
      ${thumbnailOrBadge}
      <div class="slot-file-info">
        <div class="slot-file-name" title="${file.name}">${file.name}</div>
        <div class="slot-file-meta" title="重命名预览">${newName}</div>
      </div>
      <div class="slot-file-status">
        <span class="status-dot ${statusClass}" title="${statusInfo.message}"></span>
      </div>
    </div>
  `;
}

// 新的网格视图渲染函数
function renderFileGridView(slot, files, options = {}) {
  const isReference = options.isReference || false;
  const statusMap = options.statusMap || slot.fileStatuses;
  const selectedSet = isReference ? slot.selectedReferenceFiles : slot.selectedFiles;

  const gridItems = files.map((file) => {
    const preview = slot.previewMap.get(file.id);
    const isChecked = selectedSet.has(file.id);
    const statusInfo = statusMap.get(file.id) || { status: 'pending', message: '待上传' };
    const statusClass = statusInfo.status || 'pending';
    const progress = statusInfo.progress || 0;
    const isUploading = statusInfo.status === 'running' && progress > 0 && progress < 100;
    const newName = preview?.newName || file.name;
    const ext = file.name.split('.').pop().toUpperCase().slice(0, 4);

    // 判断是否是图片或视频文件
    const lowerName = file.name.toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif'].some(imgExt => lowerName.endsWith(imgExt));
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv'].some(vidExt => lowerName.endsWith(vidExt));

    // 图片/视频缩略图或文件类型徽章
    let thumbnailContent;
    if (isImage && file.path) {
      thumbnailContent = `<img src="${resolveFileUrl(file.path)}" alt="${escapeHtml(file.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'slot-grid-file-badge\\'>${ext}</div>'" />`;
    } else if (isVideo && file.path) {
      thumbnailContent = `<video src="${resolveFileUrl(file.path)}" muted preload="metadata" onerror="this.parentElement.innerHTML='<div class=\\'slot-grid-file-badge\\'>${ext}</div>'"></video>`;
    } else {
      thumbnailContent = `<div class="slot-grid-file-badge">${ext}</div>`;
    }

    // 圆形进度条（SVG）
    const progressRingSize = 44;
    const strokeWidth = 4;
    const radius = (progressRingSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    const progressRing = isUploading ? `
      <div class="upload-progress-overlay" data-file-id="${file.id}">
        <svg class="upload-progress-ring" width="${progressRingSize}" height="${progressRingSize}">
          <circle
            class="upload-progress-ring-bg"
            stroke="rgba(255,255,255,0.3)"
            stroke-width="${strokeWidth}"
            fill="transparent"
            r="${radius}"
            cx="${progressRingSize / 2}"
            cy="${progressRingSize / 2}"
          />
          <circle
            class="upload-progress-ring-fg"
            stroke="#3b82f6"
            stroke-width="${strokeWidth}"
            stroke-linecap="round"
            fill="transparent"
            r="${radius}"
            cx="${progressRingSize / 2}"
            cy="${progressRingSize / 2}"
            style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; transform: rotate(-90deg); transform-origin: center;"
          />
        </svg>
        <span class="upload-progress-text">${progress}%</span>
      </div>
    ` : '';

    return `
      <div class="slot-grid-file-item ${isChecked ? 'selected' : ''} ${isUploading ? 'uploading' : ''}" data-file-id="${file.id}">
        <label class="slot-grid-file-checkbox">
          <input 
            type="checkbox" 
            ${isChecked ? 'checked' : ''}
            data-slot-id="${slot.id}" 
            data-file-id="${file.id}"
            data-is-reference="${isReference}"
          />
        </label>
        <div class="slot-grid-file-thumbnail-wrapper">
          <div class="slot-grid-file-thumbnail">
            ${thumbnailContent}
            ${progressRing}
            <span class="slot-grid-status-dot ${statusClass}" title="${statusInfo.message}"></span>
          </div>
        </div>
        <div class="slot-grid-file-name-display" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
        <div class="slot-grid-file-preview">
          <div class="slot-grid-preview-image">
            ${isImage && file.path
        ? `<img src="${resolveFileUrl(file.path)}" alt="${escapeHtml(file.name)}" />`
        : isVideo && file.path
          ? `<video src="${resolveFileUrl(file.path)}" controls muted preload="metadata"></video>`
          : `<div class="slot-grid-preview-placeholder">${ext}</div>`
      }
          </div>
          <div class="slot-grid-preview-info">
            <div class="slot-grid-preview-name">原文件: ${escapeHtml(file.name)}</div>
            <div class="slot-grid-preview-rename">重命名: ${escapeHtml(newName)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `<div class="slot-file-grid">${gridItems}</div>`;
}


function bindSlotEvents() {
  const container = elements.slotContainer;
  if (!container) return;
  if (!container._sortDnDAttached) {
    container.addEventListener('dragover', handleSlotSortDragOver, true);
    container.addEventListener('drop', handleSlotSortDrop, true);
    container._sortDnDAttached = true;
  }
  container.querySelectorAll('[data-action="pick-folder"]').forEach((btn) => {
    btn.addEventListener('click', () => selectFolderForSlot(btn.dataset.slotId));
  });
  container.querySelectorAll('[data-action="pick-reference-folder"]').forEach((btn) => {
    btn.addEventListener('click', () => selectReferenceFolderForSlot(btn.dataset.slotId));
  });
  container.querySelectorAll('[data-action="refresh-folder"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      refreshSlotFilesForSlot(btn.dataset.slotId);
    });
  });
  container.querySelectorAll('[data-action="refresh-reference"]').forEach((btn) => {
    btn.addEventListener('click', () => refreshReferenceFilesForSlot(btn.dataset.slotId));
  });
  container.querySelectorAll('[data-action="clear-slot"]').forEach((btn) => {
    btn.addEventListener('click', () => clearSlot(btn.dataset.slotId));
  });
  container.querySelectorAll('[data-action="duplicate-slot"]').forEach((btn) => {
    btn.addEventListener('click', () => duplicateSlot(btn.dataset.slotId));
  });
  container.querySelectorAll('[data-slot-drag-handle]').forEach((btn) => {
    btn.addEventListener('dragstart', (event) => {
      // 禁用原生拖拽，使用 pointer 拖拽
      event.preventDefault();
    });
    btn.addEventListener('dragend', () => {
      clearSlotDragVisuals();
    });
    btn.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (isSlotDragBlockedTarget(event.target)) return;
      startSlotPointerDrag(btn.dataset.slotId, event);
    });
  });
  container.querySelectorAll('.slot-card').forEach((card) => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', handleSlotCardDragStart);
    card.addEventListener('dragend', clearSlotDragVisuals);
    card.addEventListener('dragover', (event) => {
      if (isFileDrag(event)) return; // 文件拖拽交给文件导入逻辑
      if (!draggingSlotId || state.uploadState !== 'idle') return;
      const targetId = card.dataset.slotId;
      if (!targetId || targetId === draggingSlotId) return;
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll('.slot-card').forEach((c) => c.classList.remove('drag-over-sort'));
      card.classList.add('drag-over-sort');
      event.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('dragleave', () => {
      if (!draggingSlotId) return;
      card.classList.remove('drag-over-sort');
    });
    card.addEventListener('drop', (event) => {
      if (isFileDrag(event)) return; // 文件拖拽交给文件导入逻辑
      if (!draggingSlotId || state.uploadState !== 'idle') return;
      event.preventDefault();
      event.stopPropagation();
      const targetId = card.dataset.slotId;
      if (targetId && targetId !== draggingSlotId) {
        reorderSlot(draggingSlotId, targetId);
      }
      clearSlotDragVisuals();
    });
  });
  container.querySelectorAll('[data-action="remove-slot"]').forEach((btn) => {
    btn.addEventListener('click', () => removeSlot(btn.dataset.slotId));
  });
  container.querySelectorAll('[data-action="clear-slot-files"]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const slotId = btn.dataset.slotId;
      const slot = getSlot(slotId);
      if (!slot) return;
      if (!slot.files?.length) {
        appendLog({ status: 'success', message: '没有可清空的文件' });
        return;
      }
      // 清空文件选择状态并重新渲染,避免弹框上方显示勾选框
      slot.selectedFiles.clear();
      renderSlots();

      const confirmed = await showConfirmationDialog({
        title: '清空文件列表',
        message: `确定清空“${getSlotReadableName(slot)}”中的全部文件吗？（不会删除本地文件）`,
        confirmText: '清空',
        cancelText: '取消'
      });
      if (!confirmed) return;
      clearSlotFiles(slotId);
    });
  });
  container.querySelectorAll('[data-action="copy-link"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const link = btn.dataset.link;
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link);
        appendLog({ status: 'success', message: '链接已复制' });
      } catch (error) {
        appendLog({ status: 'error', message: '复制失败' });
      }
    });
  });
  container.querySelectorAll('[data-action="open-link"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const link = btn.dataset.link;
      if (!link) return;
      openExternalLink(link);
    });
  });
  container.querySelectorAll('[data-action="flip-slot-view"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slot = getSlot(btn.dataset.slotId);
      if (!slot) return;
      const nextView = slot.viewMode === 'settings' ? 'upload' : 'settings';
      setSlotView(slot.id, nextView);
    });
  });
  container.querySelectorAll('[data-slot-view]').forEach((btn) => {
    btn.addEventListener('click', () => setSlotView(btn.dataset.slotId, btn.dataset.slotView));
  });
  container.querySelectorAll('.slot-group-label').forEach((input) => {
    input.addEventListener('input', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      slot.groupLabel = event.target.value;
    });
    input.addEventListener('change', () => {
      persistSlotPresets();
      if (state.groupSlotsByMain) {
        renderSlots();
      }
    });
  });
  container.querySelectorAll('.slot-subject').forEach((input) => {
    input.addEventListener('input', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      slot.subject = event.target.value;
      updateSlotPreview(slot.id);
    });
    input.addEventListener('change', () => {
      persistSlotPresets();
      debouncedPreview();
    });
  });
  container.querySelectorAll('.slot-event-name').forEach((input) => {
    input.addEventListener('input', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      slot.eventName = event.target.value;
      updateSlotPreview(slot.id);
    });
    input.addEventListener('change', () => {
      persistSlotPresets();
      debouncedPreview();
    });
  });
  container.querySelectorAll('.slot-admin').forEach((input) => {
    input.addEventListener('input', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      slot.admin = event.target.value;
      updateSlotPreview(slot.id);
    });
    input.addEventListener('change', () => {
      persistSlotPresets();
      debouncedPreview();
    });
  });
  container.querySelectorAll('.slot-naming-rule').forEach((select) => {
    select.addEventListener('change', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      slot.namingPresetId = event.target.value;
      persistSlotPresets();
      debouncedPreview();
    });
  });
  container.querySelectorAll('.slot-task-type').forEach((select) => {
    select.addEventListener('change', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      const value = event.target.value;
      const customInput = event.target.parentElement.querySelector('.slot-task-type-custom');

      if (value === '__custom__') {
        // 选择了自定义，显示输入框，清空任务类型等待用户输入
        if (customInput) {
          customInput.style.display = 'block';
          customInput.focus();
        }
        slot.taskType = customInput?.value || '';
      } else {
        // 选择了预设选项，隐藏自定义输入框
        if (customInput) {
          customInput.style.display = 'none';
          customInput.value = '';
        }
        slot.taskType = value;
      }
      persistSlotPresets();
    });
  });
  container.querySelectorAll('.slot-task-type-custom').forEach((input) => {
    input.addEventListener('input', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      slot.taskType = event.target.value;
      persistSlotPresets();
    });
  });
  container.querySelectorAll('.slot-no-subfolder').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      slot.skipCreateSubfolder = checkbox.checked;
      persistSlotPresets();
    });
  });
  container.querySelectorAll('.slot-folder-naming').forEach((select) => {
    select.addEventListener('change', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      slot.folderNamingPresetId = event.target.value;
      persistSlotPresets();
      // 立即更新该slot的UI预览
      updateSlotPreview(slot.id);
      debouncedPreview();
    });
  });
  container.querySelectorAll('.slot-main').forEach((select) => {
    select.addEventListener('change', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      slot.mainCategory = event.target.value;
      slot.subCategory = '';
      persistSlotPresets();
      renderSlots();
    });
  });
  container.querySelectorAll('.slot-sub').forEach((select) => {
    select.addEventListener('change', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      if (!slot.mainCategory) {
        event.target.value = '';
        appendLog({ status: 'error', message: '请先选择主类别' });
        return;
      }
      slot.subCategory = event.target.value;
      persistSlotPresets();
      renderSlots();
    });
  });
  container.querySelectorAll('.slot-title[contenteditable="true"]').forEach((title) => {
    const slotId = title.dataset.slotId;
    title.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        title.blur();
      }
    });
    title.addEventListener('input', () => {
      const slot = getSlot(slotId);
      if (!slot) return;
      const text = (title.textContent || '').trim();
      if (!text) {
        slot.displayName = '';
        if (!text) {
          title.textContent = '';
        }
      } else {
        slot.displayName = text;
      }
      title.classList.toggle('has-custom-name', Boolean(slot.displayName));
    });
    title.addEventListener('blur', () => {
      const slot = getSlot(slotId);
      if (!slot) return;
      const text = (title.textContent || '').trim();
      if (!text) {
        slot.displayName = '';
        title.textContent = '';
      } else {
        slot.displayName = text;
        title.textContent = slot.displayName;
      }
      title.classList.toggle('has-custom-name', Boolean(slot.displayName));
      persistSlotPresets();
      renderSlots();
    });
  });
  container.querySelectorAll('.slot-mode').forEach((select) => {
    select.addEventListener('change', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      const nextMode = event.target.value;
      if (slot.reviewEnabled && nextMode === SLOT_MODES.CUSTOM_LINK) {
        appendLog({ status: 'error', message: '提交审核的分类不可使用自定义链接模式' });
        event.target.value = SLOT_MODES.LIBRARY;
        slot.mode = SLOT_MODES.LIBRARY;
        // 先保存数据再渲染UI，确保数据和UI的一致性
        persistSlotPresets();
        renderSlots();
        return;
      }
      slot.mode = event.target.value;
      if (slot.mode === SLOT_MODES.CUSTOM_LINK) {
        slot.mainCategory = '';
        slot.subCategory = '';
      }
      persistSlotPresets();
      renderSlots();
    });
  });
  container.querySelectorAll('.slot-custom-link').forEach((input) => {
    input.addEventListener('input', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      applyCustomLink(slot, event.target.value);
    });
    input.addEventListener('change', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      applyCustomLink(slot, event.target.value);
      persistSlotPresets();
      renderSlots();
      if (slot.customLink && !slot.customFolderId) {
        appendLog({ status: 'error', message: `${getSlotReadableName(slot)} 的链接无法解析，请检查后重试` });
      }
    });
  });
  container.querySelectorAll('.slot-review-toggle').forEach((checkbox) => {
    checkbox.addEventListener('change', async (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      const prevState = Boolean(slot.reviewEnabled);
      const wantsReview = event.target.checked;
      if (wantsReview && slot.mode === SLOT_MODES.CUSTOM_LINK) {
        appendLog({ status: 'error', message: '提交审核的分类不可使用自定义链接模式' });
        event.target.checked = false;
        slot.reviewEnabled = false;
        return;
      }
      if (!wantsReview && prevState) {
        const confirmDisable = await showConfirmationDialog({
          title: '关闭审核模式',
          message: '关闭后该分类将直接入库而不再走审核流程，确定要关闭吗？'
        });
        if (!confirmDisable) {
          event.target.checked = true;
          return;
        }
      }
      slot.reviewEnabled = wantsReview;
      if (slot.reviewEnabled && slot.mode === SLOT_MODES.CUSTOM_LINK) {
        slot.mode = SLOT_MODES.LIBRARY;
      }
      persistSlotPresets();
      renderSlots();
    });
  });
  container.querySelectorAll('.slot-review-folder-input').forEach((input) => {
    input.addEventListener('input', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      slot.reviewFolderLink = event.target.value;
    });
    input.addEventListener('change', () => {
      persistSlotPresets();
    });
  });
  container.querySelectorAll('.slot-card').forEach((card) => {
    const slotId = card.dataset.slotId;
    setupDropZone(card, slotId);
  });
  container.querySelectorAll('.slot-reference-files').forEach((wrapper) => {
    const slotId = wrapper.dataset.slotId;
    setupReferenceDropZone(wrapper, slotId);
  });
  container.querySelectorAll('.slot-custom-text-input').forEach((input) => {
    input.addEventListener('input', (event) => {
      const slot = getSlot(event.target.dataset.slotId);
      if (!slot) return;
      if (!slot.customTexts) {
        slot.customTexts = {};
      }
      slot.customTexts[event.target.dataset.customId] = event.target.value;
      updateSlotPreview(slot.id);
    });
    input.addEventListener('change', () => {
      persistSlotPresets();
      debouncedPreview();
      const slot = getSlot(event.target.dataset.slotId);
      if (slot) {
        updateSlotPreview(slot.id);
      }
    });
  });

  // 文件复选框事件 - 阻止事件冒泡
  container.querySelectorAll('.slot-file-checkbox').forEach((label) => {
    label.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  });

  container.querySelectorAll('.slot-file-checkbox input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  });

  // 文件复选框change事件
  container.querySelectorAll('.slot-file-checkbox input[type="checkbox"]:not(.file-select-all)').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const slotId = event.target.dataset.slotId;
      const fileId = event.target.dataset.fileId;
      const isReference = event.target.dataset.isReference === 'true';
      const slot = getSlot(slotId);
      if (!slot) return;

      const selectedSet = isReference ? slot.selectedReferenceFiles : slot.selectedFiles;
      if (event.target.checked) {
        selectedSet.add(fileId);
      } else {
        selectedSet.delete(fileId);
      }
      renderSlots();
    });
  });

  // 全选复选框事件
  container.querySelectorAll('.file-select-all').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const slotId = event.target.dataset.slotId;
      const isReference = event.target.dataset.isReference === 'true';
      const slot = getSlot(slotId);
      if (!slot) return;

      const files = isReference ? slot.referenceFiles : slot.files;
      const selectedSet = isReference ? slot.selectedReferenceFiles : slot.selectedFiles;

      if (event.target.checked) {
        // 全选
        files.forEach(file => selectedSet.add(file.id));
      } else {
        // 取消全选
        selectedSet.clear();
      }
      renderSlots();
    });
  });

  // 取消选择按钮事件
  container.querySelectorAll('[data-action="clear-selection"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const slotId = btn.dataset.slotId;
      const isReference = btn.dataset.isReference === 'true';
      const slot = getSlot(slotId);
      if (!slot) return;

      const selectedSet = isReference ? slot.selectedReferenceFiles : slot.selectedFiles;
      selectedSet.clear();
      renderSlots();
    });
  });

  // 反选按钮事件
  container.querySelectorAll('[data-action="inverse-select-files"]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const slotId = btn.dataset.slotId;
      const isReference = btn.dataset.isReference === 'true';
      const slot = getSlot(slotId);
      if (!slot) return;

      const files = isReference ? slot.referenceFiles : slot.files;
      const selectedSet = isReference ? slot.selectedReferenceFiles : slot.selectedFiles;

      files.forEach(file => {
        if (selectedSet.has(file.id)) {
          selectedSet.delete(file.id);
        } else {
          selectedSet.add(file.id);
        }
      });
      renderSlots();
    });
  });

  // 删除选中文件按钮事件
  container.querySelectorAll('[data-action="delete-selected-files"]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const slotId = btn.dataset.slotId;
      const isReference = btn.dataset.isReference === 'true';
      const slot = getSlot(slotId);
      if (!slot) return;

      const selectedSet = isReference ? slot.selectedReferenceFiles : slot.selectedFiles;
      if (selectedSet.size === 0) return;

      const confirmed = await showConfirmationDialog({
        title: '删除文件',
        message: `确定要从列表中删除选中的 ${selectedSet.size} 个文件吗？（不会删除本地文件）`
      });

      if (!confirmed) return;

      const deletedCount = selectedSet.size;

      if (isReference) {
        slot.referenceFiles = slot.referenceFiles.filter(file => !selectedSet.has(file.id));
        selectedSet.clear();
        appendLog({ status: 'success', message: `已从参考列表中删除 ${deletedCount} 个文件` });
      } else {
        slot.files = slot.files.filter(file => !selectedSet.has(file.id));
        selectedSet.clear();
        appendLog({ status: 'success', message: `已从上传列表中删除 ${deletedCount} 个文件` });
      }

      renderSlots();
      persistSlotPresets();
      debouncedPreview();
    });
  });
  container.querySelectorAll('[data-slot-upload-action]').forEach((btn) => {
    const action = btn.dataset.slotUploadAction;
    // Stop bubbling so clicking这些按钮不会触发选择文件夹的区域点击
    const wrap = (handler) => (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler();
    };
    if (action === 'start') {
      btn.addEventListener('click', wrap(() => {
        const slotId = btn.dataset.slotId || null;
        handleUpload(slotId);
      }));
    }
    if (action === 'pause') {
      btn.addEventListener('click', wrap(handlePause));
    }
    if (action === 'resume') {
      btn.addEventListener('click', wrap(handleResume));
    }
    if (action === 'stop') {
      btn.addEventListener('click', wrap(handleStop));
    }
  });

  // 创建全局预览窗口(如果还不存在)
  let globalPreview = document.getElementById('global-file-preview');
  if (!globalPreview) {
    globalPreview = document.createElement('div');
    globalPreview.id = 'global-file-preview';
    globalPreview.className = 'slot-grid-file-preview';
    globalPreview.innerHTML = `
      <div class="slot-grid-preview-image"></div>
      <div class="slot-grid-preview-info">
        <div class="slot-grid-preview-name"></div>
        <div class="slot-grid-preview-rename"></div>
      </div>
    `;
    document.body.appendChild(globalPreview);
  }

  // 处理预览窗口的定位和内容
  container.querySelectorAll('.slot-grid-file-item').forEach((item) => {
    const preview = item.querySelector('.slot-grid-file-preview');
    if (!preview) return;

    // 阻止点击网格项时打开文件夹
    item.addEventListener('click', (event) => {
      // 检查是否点击的是复选框区域
      const checkbox = event.target.closest('.slot-grid-file-checkbox');
      if (checkbox) {
        // 点击复选框区域，阻止冒泡但允许默认行为（勾选）
        event.stopPropagation();
        // 不调用preventDefault，让复选框正常工作
        return;
      }

      // 点击其他区域，阻止默认行为和冒泡
      event.preventDefault();
      event.stopPropagation();
    });

    item.addEventListener('mouseenter', () => {
      // 复制预览内容到全局预览窗口
      const previewImage = preview.querySelector('.slot-grid-preview-image');
      const previewName = preview.querySelector('.slot-grid-preview-name');
      const previewRename = preview.querySelector('.slot-grid-preview-rename');

      const globalImage = globalPreview.querySelector('.slot-grid-preview-image');
      const globalName = globalPreview.querySelector('.slot-grid-preview-name');
      const globalRename = globalPreview.querySelector('.slot-grid-preview-rename');

      if (previewImage && globalImage) {
        globalImage.innerHTML = previewImage.innerHTML;
      }
      if (previewName && globalName) {
        globalName.textContent = previewName.textContent;
      }
      if (previewRename && globalRename) {
        globalRename.textContent = previewRename.textContent;
      }
      // 上传面板的预览不需要点击跳转，避免保留旧值
      globalPreview.dataset.openUrl = '';

      // 获取缩略图的位置
      const rect = item.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;

      // 计算上方和下方的可用空间
      const spaceAbove = rect.top;
      const spaceBelow = windowHeight - rect.bottom;

      // 边距设置
      const horizontalMargin = 20;
      const verticalMargin = 5; // 减小间距,便于鼠标移动

      // 信息区域实际高度较小 (padding + 两行文字)
      const infoAreaHeight = 60;

      // 计算预览窗口的最大尺寸
      // 宽度: 更大的最大值，确保图片有足够空间
      const maxWidth = Math.min(800, windowWidth - horizontalMargin * 2);

      // 高度: 根据显示位置(上方或下方)计算
      let maxHeight;
      let previewTop, transformValue, showAbove;

      // 判断应该显示在上方还是下方
      if (spaceAbove > spaceBelow && spaceAbove > 200) {
        // 显示在上方
        showAbove = true;
        // 上方可用高度，使用90%的可用空间，确保不紧贴边缘
        const availableHeight = (spaceAbove - verticalMargin) * 0.9;
        // 预览窗口最大800px，至少保证250px的图片空间
        maxHeight = Math.min(800, Math.max(250 + infoAreaHeight, availableHeight));
        previewTop = rect.top - verticalMargin;
        transformValue = 'translate(-50%, -100%)';
      } else {
        // 显示在下方
        showAbove = false;
        // 下方可用高度，使用90%的可用空间
        const availableHeight = (spaceBelow - verticalMargin) * 0.9;
        // 预览窗口最大800px，至少保证250px的图片空间
        maxHeight = Math.min(800, Math.max(250 + infoAreaHeight, availableHeight));
        previewTop = rect.bottom + verticalMargin;
        transformValue = 'translate(-50%, 0)';
      }

      // 水平居中对齐缩略图
      let previewLeft = rect.left + rect.width / 2;

      // 确保不超出左右边界
      const halfPreviewWidth = maxWidth / 2;
      if (previewLeft - halfPreviewWidth < horizontalMargin) {
        previewLeft = halfPreviewWidth + horizontalMargin;
      } else if (previewLeft + halfPreviewWidth > windowWidth - horizontalMargin) {
        previewLeft = windowWidth - halfPreviewWidth - horizontalMargin;
      }

      // 设置全局预览窗口的位置和尺寸
      globalPreview.style.top = `${previewTop}px`;
      globalPreview.style.left = `${previewLeft}px`;
      globalPreview.style.transform = transformValue;
      globalPreview.style.maxWidth = `${maxWidth}px`;
      globalPreview.style.maxHeight = `${maxHeight}px`;

      // 设置图片区域的高度，为信息区域留出空间
      // 关键：设置height而不只是maxHeight，确保图片区域有固定高度
      const imageHeight = maxHeight - infoAreaHeight - 10;
      const globalImageArea = globalPreview.querySelector('.slot-grid-preview-image');
      if (globalImageArea) {
        // 设置固定高度，让图片在这个空间内等比缩放
        globalImageArea.style.height = `${imageHeight}px`;
        globalImageArea.style.maxHeight = `${imageHeight}px`;
      }

      // 设置箭头位置
      if (showAbove) {
        globalPreview.setAttribute('data-position', 'above');
      } else {
        globalPreview.setAttribute('data-position', 'below');
      }

      // 显示预览窗口(添加延迟)
      setTimeout(() => {
        if (item.matches(':hover')) {
          globalPreview.classList.add('visible');
        }
      }, 500);
    });

    item.addEventListener('mouseleave', (event) => {
      // 检查鼠标是否移到了预览窗口上
      setTimeout(() => {
        // 如果鼠标既不在item上也不在preview上,才隐藏
        if (!item.matches(':hover') && !globalPreview.matches(':hover')) {
          globalPreview.classList.remove('visible');
        }
      }, 100);
    });
  });

  // 为全局预览窗口添加鼠标事件
  if (globalPreview) {
    // 鼠标进入预览窗口时保持显示
    globalPreview.addEventListener('mouseenter', () => {
      globalPreview.classList.add('visible');
    });

    // 鼠标离开预览窗口时,检查是否还在缩略图上
    globalPreview.addEventListener('mouseleave', () => {
      setTimeout(() => {
        // 检查是否有任何grid item被hover
        const anyItemHovered = container.querySelector('.slot-grid-file-item:hover');
        if (!anyItemHovered && !globalPreview.matches(':hover')) {
          globalPreview.classList.remove('visible');
        }
      }, 100);
    });
  }
}

async function selectFolderForSlot(slotId) {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法更换目录' });
    return;
  }
  const slot = getSlot(slotId);
  if (!slot || state.uploadState !== 'idle') {
    return;
  }
  const folder = await window.bridge.pickFolder();
  if (!folder) {
    return;
  }
  await loadPathsForSlot(slotId, [folder]);
}

async function selectReferenceFolderForSlot(slotId) {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法更换参考目录' });
    return;
  }
  const slot = getSlot(slotId);
  if (!slot || !slot.reviewEnabled) {
    appendLog({ status: 'error', message: '仅开启审核的分类可以配置参考素材' });
    return;
  }
  const folder = await window.bridge.pickFolder();
  if (!folder) {
    return;
  }
  await loadReferencePathsForSlot(slotId, [folder]);
}

function getFileIdentity(file = {}) {
  if (!file) {
    return '';
  }
  return file.path || `${file.relativePath || ''} -${file.name || ''} -${file.size || ''} `;
}

function buildScannedEntries(files = [], slot, options = {}) {
  const { isReference = false, existingKeys = new Set() } = options;
  const entries = [];
  files.forEach((file) => {
    const key = getFileIdentity(file);
    if (!key || existingKeys.has(key)) {
      return;
    }
    existingKeys.add(key);
    const detectedCategory = detectFileMediaCategory(file);
    const entry = { ...file, slotId: slot.id, detectedCategory };
    if (isReference) {
      entry.isReference = true;
    }
    entries.push(entry);
  });
  return entries;
}

function pruneStatusMap(statusMap, validIds = []) {
  if (!statusMap?.size) {
    return;
  }
  const validSet = new Set(validIds);
  Array.from(statusMap.keys()).forEach((id) => {
    if (!validSet.has(id)) {
      statusMap.delete(id);
    }
  });
}

function hasValidSources(list) {
  return Array.isArray(list) && list.some((entry) => Boolean(entry));
}

async function loadPathsForSlot(slotId, paths = []) {
  const slot = getSlot(slotId);
  if (!slot) {
    return;
  }
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (!uniquePaths.length) {
    return;
  }
  try {
    const aggregated = [];
    for (const entryPath of uniquePaths) {
      const scanned = await window.bridge.scanFolder(entryPath);
      aggregated.push(...scanned);
    }
    if (!aggregated.length) {
      appendLog({ status: 'error', message: '未检测到有效文件' });
      return;
    }
    const existingFiles = Array.isArray(slot.files) ? slot.files : [];
    const existingPathKeys = new Set(existingFiles.map((file) => getFileIdentity(file)).filter(Boolean));
    const newEntries = buildScannedEntries(aggregated, slot, { existingKeys: existingPathKeys });
    if (!newEntries.length) {
      appendLog({ status: 'success', message: '这些目录中的文件已在列表中，未新增文件' });
      return;
    }
    slot.files = [...existingFiles, ...newEntries];
    if (!Array.isArray(slot.folderSources)) {
      slot.folderSources = [];
    }
    const folderSourceSet = new Set(slot.folderSources);
    uniquePaths.forEach((path) => folderSourceSet.add(path));
    slot.folderSources = Array.from(folderSourceSet);
    if (slot.folderSources.length === 1) {
      [slot.folderPath] = slot.folderSources;
    } else {
      slot.folderPath = `已选择 ${slot.folderSources.length} 个来源`;
    }
    renderSlots();
    persistSlotPresets();
    await refreshAllPreviews();
    appendLog({ status: 'success', message: `本次新增 ${newEntries.length} 个文件，当前共 ${slot.files.length} 个文件` });
    const summaryText = formatFileTypeSummary(slot.files);
    if (summaryText) {
      appendLog({
        status: 'success',
        message: `${getSlotReadableName(slot)} 识别类型：${summaryText} `
      });
    }
  } catch (error) {
    appendLog({ status: 'error', message: error.message });
  }
}

async function loadReferencePathsForSlot(slotId, paths = []) {
  const slot = getSlot(slotId);
  if (!slot) {
    return;
  }
  if (!slot.reviewEnabled) {
    appendLog({ status: 'error', message: `${getSlotReadableName(slot)} 未开启审核，无法添加参考素材` });
    return;
  }
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (!uniquePaths.length) {
    return;
  }
  try {
    const aggregated = [];
    for (const entryPath of uniquePaths) {
      const scanned = await window.bridge.scanFolder(entryPath);
      aggregated.push(...scanned);
    }
    if (!aggregated.length) {
      appendLog({ status: 'error', message: '未检测到有效参考文件' });
      return;
    }
    const existingFiles = Array.isArray(slot.referenceFiles) ? slot.referenceFiles : [];
    const existingPathKeys = new Set(existingFiles.map((file) => getFileIdentity(file)).filter(Boolean));
    const newEntries = buildScannedEntries(aggregated, slot, {
      isReference: true,
      existingKeys: existingPathKeys
    });
    if (!newEntries.length) {
      appendLog({ status: 'success', message: '这些参考目录中的文件已在列表中，未新增文件' });
      return;
    }
    slot.referenceFiles = [...existingFiles, ...newEntries];
    if (!Array.isArray(slot.referenceFolderSources)) {
      slot.referenceFolderSources = [];
    }
    const folderSourceSet = new Set(slot.referenceFolderSources);
    uniquePaths.forEach((path) => folderSourceSet.add(path));
    slot.referenceFolderSources = Array.from(folderSourceSet);
    if (slot.referenceFolderSources.length === 1) {
      [slot.referenceFolderPath] = slot.referenceFolderSources;
    } else {
      slot.referenceFolderPath = `已选择 ${slot.referenceFolderSources.length} 个参考来源`;
    }
    renderSlots();
    persistSlotPresets();
    await refreshAllPreviews();
    appendLog({
      status: 'success',
      message: `本次新增 ${newEntries.length} 个参考文件，当前共 ${slot.referenceFiles.length} 个参考文件`
    });
  } catch (error) {
    appendLog({ status: 'error', message: error.message });
  }
}

async function refreshSlotFilesForSlot(slotId) {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法刷新文件清单' });
    return;
  }
  const slot = getSlot(slotId);
  if (!slot) {
    return;
  }
  if (!hasValidSources(slot.folderSources)) {
    appendLog({ status: 'error', message: `${getSlotReadableName(slot)} 尚未选择目录` });
    return;
  }
  const result = await rescanSlotFilesFromSources(slot);
  if (result?.error) {
    return;
  }
  await refreshAllPreviews();
}

async function refreshReferenceFilesForSlot(slotId) {
  if (state.uploadState !== 'idle') {
    appendLog({ status: 'error', message: '上传过程中无法刷新参考清单' });
    return;
  }
  const slot = getSlot(slotId);
  if (!slot) {
    return;
  }
  if (!slot.reviewEnabled) {
    appendLog({ status: 'error', message: `${getSlotReadableName(slot)} 未开启审核，无法刷新参考清单` });
    return;
  }
  if (!hasValidSources(slot.referenceFolderSources)) {
    appendLog({ status: 'error', message: `${getSlotReadableName(slot)} 尚未选择参考目录` });
    return;
  }
  const result = await rescanSlotFilesFromSources(slot, { isReference: true });
  if (result?.error) {
    return;
  }
  await refreshAllPreviews();
}

async function rescanSlotFilesFromSources(slot, options = {}) {
  const { isReference = false, silent = false } = options;
  if (!slot) {
    return { updated: false };
  }
  const sourceKey = isReference ? 'referenceFolderSources' : 'folderSources';
  const targetKey = isReference ? 'referenceFiles' : 'files';
  const statusStore = isReference ? slot.referenceFileStatuses : slot.fileStatuses;
  const label = isReference ? '参考' : '文件';
  const slotName = getSlotReadableName(slot);
  const sources = Array.isArray(slot[sourceKey]) ? slot[sourceKey].filter(Boolean) : [];
  if (!sources.length) {
    if (!silent) {
      appendLog({ status: 'error', message: `${slotName} 尚未选择${isReference ? '参考' : ''} 目录` });
    }
    return { updated: false };
  }
  try {
    const aggregated = [];
    for (const entryPath of sources) {
      const scanned = await window.bridge.scanFolder(entryPath);
      if (Array.isArray(scanned)) {
        aggregated.push(...scanned);
      }
    }
    const refreshedEntries = buildScannedEntries(aggregated, slot, {
      isReference,
      existingKeys: new Set()
    });
    slot[targetKey] = refreshedEntries;
    pruneStatusMap(statusStore, refreshedEntries.map((file) => file.id));
    if (!silent) {
      appendLog({
        status: 'success',
        message: `${slotName} 的${label} 清单已刷新，当前 ${refreshedEntries.length} 个文件`
      });
    }
    return { updated: true, count: refreshedEntries.length };
  } catch (error) {
    if (!silent) {
      appendLog({ status: 'error', message: `${slotName} 刷新失败：${error.message} ` });
    }
    return { updated: false, error };
  }
}

async function ensureSlotFilesSyncedWithSources() {
  const slotsNeedingSync = state.slots.filter(
    (slot) => hasValidSources(slot.folderSources) || (slot.reviewEnabled && hasValidSources(slot.referenceFolderSources))
  );
  if (!slotsNeedingSync.length) {
    return false;
  }
  appendLog({ status: 'info', message: '正在刷新文件清单，以匹配当前目录内容...' });
  let hadError = false;
  for (const slot of slotsNeedingSync) {
    if (hasValidSources(slot.folderSources)) {
      const result = await rescanSlotFilesFromSources(slot, { silent: true });
      if (result?.error) {
        hadError = true;
        appendLog({
          status: 'error',
          message: `${getSlotReadableName(slot)} 刷新失败：${result.error.message || result.error} `
        });
      }
    }
    if (slot.reviewEnabled && hasValidSources(slot.referenceFolderSources)) {
      const result = await rescanSlotFilesFromSources(slot, { isReference: true, silent: true });
      if (result?.error) {
        hadError = true;
        appendLog({
          status: 'error',
          message: `${getSlotReadableName(slot)} 参考刷新失败：${result.error.message || result.error} `
        });
      }
    }
  }
  await refreshAllPreviews();
  appendLog({
    status: hadError ? 'warning' : 'success',
    message: hadError ? '部分分类文件清单刷新失败，其他已同步' : '文件清单已刷新为最新目录状态'
  });
  return true;
}

function setupDropZone(card, slotId) {
  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  ['dragenter', 'dragover'].forEach((eventName) => {
    card.addEventListener(eventName, (event) => {
      if (draggingSlotId) return; // 排序时不处理文件拖拽
      if (isSortingDrag(event)) {
        return; // 拖拽排序时，不要处理文件拖拽逻辑
      }
      preventDefaults(event);
      if (state.uploadState !== 'idle') {
        return;
      }
      card.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    card.addEventListener(eventName, (event) => {
      if (draggingSlotId) return; // 排序时不处理文件拖拽
      if (isSortingDrag(event)) {
        return;
      }
      preventDefaults(event);
      card.classList.remove('drag-over');
    });
  });
  card.addEventListener('drop', async (event) => {
    if (draggingSlotId) return; // 排序时不处理文件拖拽
    if (isSortingDrag(event)) {
      return;
    }
    preventDefaults(event);
    if (state.uploadState !== 'idle') {
      appendLog({ status: 'error', message: '上传过程中无法更换目录' });
      return;
    }
    const files = Array.from(event.dataTransfer?.files || []);
    const paths = files.map((file) => file.path).filter(Boolean);
    if (!paths.length) {
      return;
    }
    await loadPathsForSlot(slotId, paths);
  });
}

function setupReferenceDropZone(container, slotId) {
  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  ['dragenter', 'dragover'].forEach((eventName) => {
    container.addEventListener(eventName, (event) => {
      if (draggingSlotId) return;
      if (isSortingDrag(event)) {
        return;
      }
      preventDefaults(event);
      if (state.uploadState !== 'idle') {
        return;
      }
      container.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    container.addEventListener(eventName, (event) => {
      if (draggingSlotId) return;
      if (isSortingDrag(event)) {
        return;
      }
      preventDefaults(event);
      container.classList.remove('drag-over');
    });
  });
  container.addEventListener('drop', async (event) => {
    if (draggingSlotId) return;
    if (isSortingDrag(event)) {
      return;
    }
    preventDefaults(event);
    if (state.uploadState !== 'idle') {
      appendLog({ status: 'error', message: '上传过程中无法更换参考目录' });
      return;
    }
    const slot = getSlot(slotId);
    if (!slot?.reviewEnabled) {
      appendLog({ status: 'error', message: '仅开启审核的分类可以添加参考文件' });
      return;
    }
    const files = Array.from(event.dataTransfer?.files || []);
    const paths = files.map((file) => file.path).filter(Boolean);
    if (!paths.length) {
      return;
    }
    await loadReferencePathsForSlot(slotId, paths);
  });
}

async function refreshAllPreviews() {
  let counter = Number(elements.counterStart.value) || state.config.counterStart || 1;
  for (const slot of state.slots) {
    const referenceFiles = slot.referenceFiles || [];
    const filesForPreview = [...slot.files, ...referenceFiles];
    if (!filesForPreview.length) {
      slot.previewMap = new Map();
      continue;
    }
    const metadata = buildSlotMetadata(slot);
    try {
      const pattern = getSlotPattern(slot);
      const preview = await window.bridge.previewRenames({
        files: filesForPreview,
        metadata,
        pattern,
        counterStart: counter
      });
      slot.previewMap = new Map(preview.map((item) => [item.id, item]));
      counter += preview.length;
    } catch (error) {
      appendLog({ status: 'error', message: `命名预览失败：${error.message} ` });
    }
  }
  renderSlots();
  updateNamingPreview();
}

function buildSlotMetadata(slot) {
  const base = getBaseMetadata();
  const finalFolderId =
    slot.mode === SLOT_MODES.CUSTOM_LINK
      ? slot.customFolderId || ''
      : (state.categoryMap[slot.mainCategory] &&
        state.categoryMap[slot.mainCategory][slot.subCategory]) ||
      '';
  const reviewEnabled = Boolean(slot.reviewEnabled);
  const reviewFolderId = reviewEnabled ? getSlotReviewFolderId(slot) : '';
  const folderId = reviewEnabled ? reviewFolderId : finalFolderId;
  const customTexts = buildCustomTextEntries(slot);
  const namingSample = getSlotNamingPreviewText(slot);
  const metadata = {
    ...base,
    ...customTexts,
    mainCategory: slot.mainCategory,
    subCategory: slot.subCategory,
    taskType: slot.taskType || '',
    subject: slot.subject || '',
    pageName: slot.pageName || '',
    eventName: slot.eventName || '',
    admin: slot.admin || '',
    distribution: slot.distribution || '',
    categoryFolderId: folderId,
    skipCreateSubfolder: Boolean(slot.skipCreateSubfolder),
    reviewEnabled,
    reviewTempFolderId: reviewEnabled ? reviewFolderId : '',
    reviewTargetFolderId: reviewEnabled ? finalFolderId : '',
    reviewTargetMainCategory: reviewEnabled ? slot.mainCategory : '',
    reviewTargetSubCategory: reviewEnabled ? slot.subCategory : '',
    reviewTaskId: slot.id,
    reviewSlotName: namingSample || slot.displayName || '',
    reviewNote: slot.subject || '',
    reviewDescription: namingSample || slot.subject || slot.displayName || ''
  };

  // 自定义链接且选择“不创建子文件夹”时，直接上传到已有目录
  if (slot.mode === SLOT_MODES.CUSTOM_LINK && slot.skipCreateSubfolder && finalFolderId) {
    metadata.subFolderId = finalFolderId;
    const derived = ensureDriveFolderLink(slot.customLink || finalFolderId);
    if (derived) {
      metadata.subFolderLink = derived;
    }
  }

  return metadata;
}

function buildCustomTextEntries(slot) {
  const entries = {};
  console.log('[buildCustomTextEntries] Processing slot:', slot.id);
  console.log('[buildCustomTextEntries] Slot customTexts:', slot.customTexts);
  console.log('[buildCustomTextEntries] state.customTextDefs count:', state.customTextDefs.length);
  console.log('[buildCustomTextEntries] state.customTextGlobals:', state.customTextGlobals);

  state.customTextDefs.forEach((def) => {
    const value =
      def.scope === CUSTOM_TEXT_SCOPE.GLOBAL
        ? state.customTextGlobals[def.id] || ''
        : slot?.customTexts?.[def.id] || '';
    console.log(`[buildCustomTextEntries] ${def.tokenKey} (${def.scope}): "${value}" from ${def.scope === CUSTOM_TEXT_SCOPE.GLOBAL ? 'global' : 'slot'}, def.id: ${def.id}`);
    entries[def.tokenKey] = value || '';
  });
  console.log('[buildCustomTextEntries] Final entries:', entries);
  return entries;
}

function getBaseMetadata() {
  return {
    submitter: elements.metadata.submitter.value.trim(),
    productionStatus: '',
    completedAt: elements.metadata.completedAt.value,
    readyFlag: state.config.readyFlag || '是',
    country: elements.naming.country.value.trim() || DEFAULT_COUNTRY,
    customDate: formatDateValue(elements.naming.date.value),
    software: elements.naming.software.value.trim(),
    zb: 'ZB'  // 固定全局前缀
  };
}

function getSubmitterName() {
  return elements.metadata.submitter.value.trim();
}

function formatDateValue(value) {
  if (!value) return '';
  return value.replace(/-/g, '');
}

async function handleSaveConfig() {
  const config = gatherConfigFromForm();
  const saved = await window.bridge.saveConfig(config);
  state.config = saved;
  // 🔴 暴露配置供打卡模块读取
  window.appConfig = state.config;
  updateSoftwareAdminVisibility();
  updateSoftwareReviewAccess();
  updateSoftwareConfigVisibility();
  state.softwareReviewFetched = false;
  state.softwareSubmissions = [];
  renderSoftwareReviewList();
  appendLog({ status: 'success', message: '配置已保存' });
  await maybeFetchCategories();
  await refreshAllPreviews();
  await refreshSoftwareDirectory({ silent: true });
  renderNoticeBoard(); // 重新渲染信息板
}

async function handleAuthorize() {
  const config = gatherConfigFromForm();
  if (!config.clientId || !config.clientSecret) {
    appendLog({
      status: 'error',
      message: '请先导入基础配置文件，填写 Google Client ID 和 Client Secret 后再登录。'
    });
    return;
  }
  try {
    elements.authorizeBtn.disabled = true;
    const result = await window.bridge.authorize(config);
    state.authorized = result?.authorized;
    if (result?.config) {
      state.config = result.config;
    }
    if (typeof result?.userEmail === 'string') {
      state.currentUserEmail = result.userEmail;
    }
    updateSoftwareAdminVisibility();
    updateSoftwareReviewAccess();
    updateSoftwareConfigVisibility();
    state.softwareReviewFetched = false;
    state.softwareSubmissions = [];
    renderSoftwareReviewList();
    updateAuthStatus();
    await maybeFetchCategories();
    await refreshAllPreviews();
    appendLog({ status: 'success', message: 'Google 授权完成' });
  } catch (error) {
    appendLog({ status: 'error', message: `授权失败：${error.message} ` });
  } finally {
    elements.authorizeBtn.disabled = false;
  }
}

function deriveSheetName(rangeValue, fallback) {
  if (!rangeValue) {
    return fallback;
  }
  const normalized = rangeValue.includes('!') ? rangeValue.split('!')[0] : rangeValue;
  return normalized || fallback;
}

function gatherConfigFromForm() {
  const sheetRangeValue = elements.sheetRange.value.trim() || 'Uploads!A:J';
  const reviewRangeValue = elements.reviewRange.value.trim() || '审核记录';
  const categoryRangeValue = elements.categoryRange.value.trim() || '数据验证!A2:C';
  const softwareAdmins = Array.isArray(state.config.softwareAdmins) ? state.config.softwareAdmins : [];
  return {
    clientId: elements.clientId.value.trim(),
    clientSecret: elements.clientSecret.value.trim(),
    redirectPort: Number(elements.redirectPort.value) || 42813,
    driveFolderId: elements.driveFolderId.value.trim(),
    sheetId: elements.sheetId.value.trim(),
    sheetRange: sheetRangeValue,
    reviewSheetName: deriveSheetName(reviewRangeValue, '审核记录'),
    reviewRange: reviewRangeValue,
    categorySheetName: deriveSheetName(categoryRangeValue, '数据验证'),
    categoryRange: categoryRangeValue,
    softwareSheetId: elements.softwareSheetId?.value.trim() || '',
    softwareSheetRange: elements.softwareSheetRange?.value.trim() || 'Software!A:K',
    softwareSubmissionRange: elements.softwareSubmissionRange?.value.trim() || 'SoftwareSubmissions!A:S',
    softwareAdminRange: elements.softwareAdminRange?.value.trim() || 'SoftwareAdmins!A:A',
    softwareSubmitUrl: elements.softwareSubmitUrl?.value.trim() || '',
    softwareAdmins,
    readyFlag: state.config.readyFlag || '是',
    renamePattern: elements.renamePattern.value.trim() || DEFAULT_PATTERN,
    folderPattern: elements.folderPattern?.value.trim() || DEFAULT_FOLDER_PATTERN,
    reviewTempFolder: elements.reviewTempFolder?.value.trim() || '',
    useFileReviewMode: true,
    fileReviewRange: elements.fileReviewRange?.value?.trim() || state.config.fileReviewRange || '文件审核!A:AF',
    zoomFactor: elements.zoomFactor ? normalizeZoomFactor(elements.zoomFactor.value) : state.config.zoomFactor || 1,
    notificationMode: elements.notificationMode?.value || 'speech',
    notificationSoundReview: elements.notificationSoundReview?.value.trim() || '',
    notificationSoundSuggestion: elements.notificationSoundSuggestion?.value.trim() || '',
    notificationSoundApproved: elements.notificationSoundApproved?.value.trim() || '',
    enableFloatingNotifications: Boolean(elements.floatingNotificationToggle?.checked),
    dateFormat: elements.dateFormat.value.trim() || 'YYYYMMDD-hhmmss',
    counterStart: Number(elements.counterStart.value) || 1,
    counterPadding: Number(elements.counterPadding.value) || 3,
    counterStep: Number(elements.counterStep.value) || 1,
    timezone: elements.timezone.value || 'local',
    customTextDefs: state.customTextDefs,
    customTextGlobals: state.customTextGlobals,
    namingPresets: state.namingPresets.map((preset) => ({ ...preset })),
    folderNamingPresets: state.folderNamingPresets.map((preset) => ({ ...preset })),
    noticeBoardDocId: elements.noticeBoard.docId?.value.trim() || '',
    noticeBoardAutoOpen: elements.noticeBoard.autoOpen?.value === 'true',
    mediaDownloadDir: elements.mediaDownloadDir?.value.trim() || state.config.mediaDownloadDir || '',
    // AI 命名
    aiNamingEnabled: Boolean(document.getElementById('ai-naming-enabled')?.checked),
    aiNamingApiKey: document.getElementById('ai-naming-api-key')?.value.trim() || '',
    aiNamingKeywordCount: Number(document.getElementById('ai-naming-keyword-count')?.value) || 3,
    aiNamingSeparator: document.getElementById('ai-naming-separator')?.value || '_',
    aiNamingKeywords: document.getElementById('ai-naming-keywords')?.value || '',
    // Firebase 配置（必填，无内置默认）
    firebase: (() => {
      const apiKey = document.getElementById('firebase-api-key')?.value.trim();
      if (!apiKey) return null;
      return {
        apiKey,
        authDomain: document.getElementById('firebase-auth-domain')?.value.trim() || '',
        databaseURL: document.getElementById('firebase-database-url')?.value.trim() || '',
        projectId: document.getElementById('firebase-project-id')?.value.trim() || ''
      };
    })()
  };
}

function updateNamingPreview() {
  if (elements.metadata.completedAt) {
    elements.metadata.completedAt.value = elements.naming.date.value || '';
  }
  const tokens = state.namingTokens.length
    ? state.namingTokens
    : parsePattern(state.config.renamePattern || DEFAULT_PATTERN);
  const sampleMap = buildNamingSampleMap();
  const parts = tokens
    .map((token) => (token.type === 'token' ? sampleMap[token.value] : token.value))
    .filter((part) => part != null && part !== '');
  elements.naming.preview.textContent = parts.join('-');
  refreshSlotNamingPreviews();
}

async function handleUpload(targetSlotId = null) {
  console.log('🔍 handleUpload 被调用，targetSlotId:', targetSlotId, 'type:', typeof targetSlotId);

  // 确保 targetSlotId 是字符串类型，如果是 event 对象则设为 null
  if (targetSlotId && typeof targetSlotId !== 'string') {
    targetSlotId = null;
  }

  // 如果当前有上传任务，加入队列
  if (state.uploadState !== 'idle') {
    if (targetSlotId) {
      // 检查是否已经在队列中
      if (state.uploadQueue.includes(targetSlotId)) {
        appendUploadLog({ status: 'info', message: '该分类已在上传队列中' });
        return;
      }
      state.uploadQueue.push(targetSlotId);
      const slot = getSlot(targetSlotId);
      const slotName = getSlotReadableName(slot);
      appendUploadLog({
        status: 'success',
        message: `${slotName} 已加入上传队列，当前队列中有 ${state.uploadQueue.length} 个分类等待上传`
      });
      updateUploadControls();
      return;
    } else {
      appendUploadLog({ status: 'error', message: '当前已有上传任务进行中，请等待完成或停止后再上传' });
      return;
    }
  }
  const configSynced = await syncConfigForUpload();
  if (!configSynced) {
    return;
  }
  const baseMetadata = getBaseMetadata();
  if (!baseMetadata.submitter) {
    appendUploadLog({ status: 'error', message: '请先填写提交人' });
    return;
  }
  const filesSynced = await ensureSlotFilesSyncedWithSources();

  // 如果指定了targetSlotId,只检查该slot;否则检查所有slot
  const slotsToCheck = targetSlotId
    ? state.slots.filter(slot => slot.id === targetSlotId)
    : state.slots;

  const slotWithoutTarget = slotsToCheck.find(
    (slot) =>
      (slot.files.length ||
        (slot.reviewEnabled && slot.referenceFiles && slot.referenceFiles.length)) &&
      !slotHasTarget(slot)
  );
  if (slotWithoutTarget) {
    const readable = getSlotReadableName(slotWithoutTarget);
    const message =
      slotWithoutTarget.mode === SLOT_MODES.CUSTOM_LINK ? '请填写有效的自定义链接' : '请先选择主类别和子类别';
    appendUploadLog({ status: 'error', message: `${readable} ${message} ` });
    return;
  }

  // 检查任务类型是否已选择（必填项）
  const slotWithoutTaskType = slotsToCheck.find(
    (slot) =>
      (slot.files.length ||
        (slot.reviewEnabled && slot.referenceFiles && slot.referenceFiles.length)) &&
      slotHasTarget(slot) &&
      !slot.taskType
  );
  if (slotWithoutTaskType) {
    const readable = getSlotReadableName(slotWithoutTaskType);
    appendUploadLog({ status: 'error', message: `${readable} 请先选择任务类型` });
    return;
  }

  // 如果指定了targetSlotId,只上传该slot;否则上传所有有文件的slot
  const slotsWithFiles = slotsToCheck.filter(
    (slot) =>
      slotHasTarget(slot) &&
      (slot.files.length || (slot.reviewEnabled && slot.referenceFiles && slot.referenceFiles.length))
  );
  if (!slotsWithFiles.length) {
    let message;
    if (targetSlotId) {
      message = '该分类没有文件可上传';
    } else {
      // 检查是否有分类但都没有文件
      const slotsWithTarget = slotsToCheck.filter(slot => slotHasTarget(slot));
      if (slotsWithTarget.length > 0) {
        message = '请先为分类添加文件';
      } else {
        message = '请至少配置一个分类并选择目录';
      }
    }
    appendUploadLog({ status: 'error', message });
    return;
  }

  // 检查是否有已完成上传的分类（仅在全局上传时检查）
  if (!targetSlotId) {
    const completedSlots = slotsWithFiles.filter(slot => {
      const statuses = [];
      slot.fileStatuses?.forEach((info) => info?.status && statuses.push(info.status));
      if (slot.reviewEnabled && slot.referenceFileStatuses) {
        slot.referenceFileStatuses.forEach((info) => info?.status && statuses.push(info.status));
      }
      // 所有文件都是 success 或 skipped 状态
      return statuses.length > 0 && statuses.every((status) => status === 'success' || status === 'skipped');
    });

    if (completedSlots.length > 0) {
      const result = await new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';

        // 构建分类和文件列表
        let slotsHTML = '';
        completedSlots.forEach((slot, slotIndex) => {
          const slotName = getSlotReadableName(slot);
          const files = [];

          // 收集普通文件
          slot.files?.forEach(file => {
            const status = slot.fileStatuses?.get(file.id);
            if (status && (status.status === 'success' || status.status === 'skipped')) {
              files.push({ id: file.id, name: file.name, type: 'normal' });
            }
          });

          // 收集参考文件
          if (slot.reviewEnabled && slot.referenceFiles) {
            slot.referenceFiles.forEach(file => {
              const status = slot.referenceFileStatuses?.get(file.id);
              if (status && (status.status === 'success' || status.status === 'skipped')) {
                files.push({ id: file.id, name: file.name, type: 'reference' });
              }
            });
          }

          slotsHTML += `
            <div class="completed-slot-item" style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fafafa;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <input type="checkbox" class="slot-checkbox" data-slot-index="${slotIndex}" checked style="margin-right: 8px;">
                <strong style="flex: 1;">${escapeHtml(slotName)} (${files.length} 个文件)</strong>
                <button class="ghost" data-action="toggle-files" data-slot-index="${slotIndex}" style="font-size: 12px; padding: 4px 8px;">
                  <span class="toggle-icon">▼</span> 展开文件
                </button>
              </div>
              <div class="files-list" data-slot-index="${slotIndex}" style="display: none; margin-left: 24px; max-height: 150px; overflow-y: auto;">
                ${files.map(file => `
                  <div style="display: flex; align-items: center; padding: 4px 0;">
                    <input type="checkbox" class="file-checkbox" data-slot-index="${slotIndex}" data-file-id="${file.id}" data-file-type="${file.type}" checked style="margin-right: 8px;">
                    <span style="font-size: 13px; color: #6b7280;">${escapeHtml(file.name)}${file.type === 'reference' ? ' (参考)' : ''}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        });

        dialog.innerHTML = `
          <div class="modal-content" style="max-width: 600px; max-height: 80vh; display: flex; flex-direction: column;">
            <h3 style="margin-top: 0;">检测到已完成的分类</h3>
            <p>以下分类的文件已经上传完成，请选择需要重新上传的分类和文件：</p>
            <div style="margin: 12px 0; display: flex; gap: 8px;">
              <button class="ghost" data-action="select-all" style="font-size: 12px; padding: 4px 12px;">全选</button>
              <button class="ghost" data-action="deselect-all" style="font-size: 12px; padding: 4px 12px;">全不选</button>
            </div>
            <div style="flex: 1; overflow-y: auto; margin: 12px 0;">
              ${slotsHTML}
            </div>
            <div class="modal-actions" style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
              <button class="secondary" data-action="cancel">取消</button>
              <button class="ghost" data-action="skip">跳过已选</button>
              <button class="primary" data-action="reupload">重新上传已选</button>
            </div>
          </div>
        `;
        document.body.appendChild(dialog);

        // 展开/折叠文件列表
        dialog.querySelectorAll('[data-action="toggle-files"]').forEach(btn => {
          btn.onclick = () => {
            const slotIndex = btn.dataset.slotIndex;
            const filesList = dialog.querySelector(`.files-list[data-slot-index="${slotIndex}"]`);
            const icon = btn.querySelector('.toggle-icon');
            if (filesList.style.display === 'none') {
              filesList.style.display = 'block';
              icon.textContent = '▲';
              btn.innerHTML = `<span class="toggle-icon">▲</span> 收起文件`;
            } else {
              filesList.style.display = 'none';
              icon.textContent = '▼';
              btn.innerHTML = `<span class="toggle-icon">▼</span> 展开文件`;
            }
          };
        });

        // 分类复选框联动
        dialog.querySelectorAll('.slot-checkbox').forEach(checkbox => {
          checkbox.onchange = () => {
            const slotIndex = checkbox.dataset.slotIndex;
            const fileCheckboxes = dialog.querySelectorAll(`.file-checkbox[data-slot-index="${slotIndex}"]`);
            fileCheckboxes.forEach(cb => cb.checked = checkbox.checked);
          };
        });

        // 文件复选框联动
        dialog.querySelectorAll('.file-checkbox').forEach(checkbox => {
          checkbox.onchange = () => {
            const slotIndex = checkbox.dataset.slotIndex;
            const slotCheckbox = dialog.querySelector(`.slot-checkbox[data-slot-index="${slotIndex}"]`);
            const fileCheckboxes = dialog.querySelectorAll(`.file-checkbox[data-slot-index="${slotIndex}"]`);
            const allChecked = Array.from(fileCheckboxes).every(cb => cb.checked);
            const anyChecked = Array.from(fileCheckboxes).some(cb => cb.checked);
            slotCheckbox.checked = anyChecked;
            slotCheckbox.indeterminate = anyChecked && !allChecked;
          };
        });

        // 全选/全不选
        dialog.querySelector('[data-action="select-all"]').onclick = () => {
          dialog.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        };
        dialog.querySelector('[data-action="deselect-all"]').onclick = () => {
          dialog.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        };

        // 按钮事件
        dialog.querySelector('[data-action="cancel"]').onclick = () => {
          dialog.remove();
          resolve({ action: 'cancel' });
        };

        dialog.querySelector('[data-action="skip"]').onclick = () => {
          // 收集选中的分类和文件
          const selected = { slots: [], files: [] };
          completedSlots.forEach((slot, slotIndex) => {
            const fileCheckboxes = dialog.querySelectorAll(`.file-checkbox[data-slot-index="${slotIndex}"]:checked`);
            fileCheckboxes.forEach(cb => {
              selected.files.push({
                slotId: slot.id,
                fileId: cb.dataset.fileId,
                fileType: cb.dataset.fileType
              });
            });
            if (fileCheckboxes.length > 0) {
              selected.slots.push(slot);
            }
          });
          dialog.remove();
          resolve({ action: 'skip', selected });
        };

        dialog.querySelector('[data-action="reupload"]').onclick = () => {
          // 收集选中的分类和文件
          const selected = { slots: [], files: [] };
          completedSlots.forEach((slot, slotIndex) => {
            const fileCheckboxes = dialog.querySelectorAll(`.file-checkbox[data-slot-index="${slotIndex}"]:checked`);
            fileCheckboxes.forEach(cb => {
              selected.files.push({
                slotId: slot.id,
                fileId: cb.dataset.fileId,
                fileType: cb.dataset.fileType
              });
            });
            if (fileCheckboxes.length > 0) {
              selected.slots.push(slot);
            }
          });
          dialog.remove();
          resolve({ action: 'reupload', selected });
        };
      });

      if (result.action === 'cancel') {
        appendUploadLog({ status: 'info', message: '用户取消上传操作' });
        return;
      }

      if (result.action === 'skip') {
        // 跳过选中的文件，从上传列表中移除
        result.selected.files.forEach(({ slotId, fileId, fileType }) => {
          const slot = slotsWithFiles.find(s => s.id === slotId);
          if (slot) {
            if (fileType === 'normal') {
              slot.files = slot.files.filter(f => f.id !== fileId);
            } else if (fileType === 'reference') {
              slot.referenceFiles = slot.referenceFiles.filter(f => f.id !== fileId);
            }
          }
        });

        // 移除没有文件的分类
        const slotsToRemove = slotsWithFiles.filter(slot =>
          slot.files.length === 0 && (!slot.reviewEnabled || !slot.referenceFiles || slot.referenceFiles.length === 0)
        );
        slotsToRemove.forEach(slot => {
          const index = slotsWithFiles.indexOf(slot);
          if (index > -1) slotsWithFiles.splice(index, 1);
        });

        if (slotsWithFiles.length === 0) {
          appendUploadLog({ status: 'info', message: '所有文件都已跳过' });
          return;
        }

        appendUploadLog({ status: 'info', message: `已跳过 ${result.selected.files.length} 个已完成的文件` });
      } else if (result.action === 'reupload') {
        // 清空选中文件的状态
        result.selected.files.forEach(({ slotId, fileId, fileType }) => {
          const slot = slotsWithFiles.find(s => s.id === slotId);
          if (slot) {
            if (fileType === 'normal') {
              slot.fileStatuses?.delete(fileId);
            } else if (fileType === 'reference') {
              slot.referenceFileStatuses?.delete(fileId);
            }
          }
        });

        appendUploadLog({ status: 'info', message: `将重新上传 ${result.selected.files.length} 个文件` });
      }
    }
  }
  const missingReviewSlot = slotsWithFiles.find(
    (slot) => slot.reviewEnabled && !getSlotReviewFolderId(slot)
  );
  if (missingReviewSlot) {
    appendUploadLog({
      status: 'error',
      message: `${getSlotReadableName(missingReviewSlot)} 开启了审核模式，请先填写审核临时目录`
    });
    return;
  }
  const namingOk = await ensureSlotNamingTokens();
  if (!namingOk) {
    return;
  }
  if (!filesSynced) {
    await refreshAllPreviews();
  }
  const aggregatedFiles = [];
  slotsWithFiles.forEach((slot) => {
    const metadata = buildSlotMetadata(slot);
    const slotPattern = getSlotPattern(slot);
    const slotFolderPattern = getSlotFolderPattern(slot);
    slot.files.forEach((file) => {
      aggregatedFiles.push({
        ...file,
        slotId: slot.id,
        metadata,
        renamePattern: slotPattern,
        folderPattern: slotFolderPattern
      });
      slot.fileStatuses.set(file.id, { status: 'pending', message: '待上传' });
    });
    if (slot.reviewEnabled && slot.referenceFiles?.length) {
      slot.referenceFiles.forEach((file) => {
        aggregatedFiles.push({
          ...file,
          slotId: slot.id,
          metadata: { ...metadata, isReference: true },
          renamePattern: slotPattern,
          folderPattern: slotFolderPattern
        });
        slot.referenceFileStatuses.set(file.id, { status: 'pending', message: '待上传' });
      });
    }
  });
  if (!aggregatedFiles.length) {
    appendLog({ status: 'error', message: '没有可上传的文件' });
    return;
  }
  const dedupeResult = dedupeFiles(aggregatedFiles);
  const uniqueFiles = dedupeResult.unique;
  if (!uniqueFiles.length) {
    appendUploadLog({
      status: 'error',
      message: '全部文件因命名重复被跳过，请调整序号起始值后重试'
    });
    return;
  }
  const renamedOk = await maybeRenameLocalFiles(uniqueFiles);
  if (!renamedOk) {
    return;
  }
  const duplicateResolution = await resolveDuplicateUploads(uniqueFiles);
  if (!duplicateResolution) {
    return;
  }
  const filesForUpload = duplicateResolution.files || [];
  if (!filesForUpload.length) {
    appendUploadLog({ status: 'error', message: '全部文件因重复入库被跳过' });
    return;
  }
  filesForUpload.forEach((file) => {
    const slot = getSlot(file.slotId);
    slot?.fileStatuses.set(file.id, { status: 'queued', message: '排队中' });
  });
  state.uploadState = 'preparing';
  updateUploadControls();
  renderSlots();

  try {
    const result = await window.bridge.upload({
      files: filesForUpload,
      pattern: state.config.renamePattern,
      forceUploadIds: duplicateResolution.forceIds || []
    });
    if (Array.isArray(result)) {
      const successCount = result.filter((item) => item.status === 'success').length;
      const errorCount = result.filter((item) => item.status === 'error').length;
      appendUploadLog({
        status: 'success',
        message: `上传完成：成功 ${successCount}，失败 ${errorCount}，重复跳过 ${dedupeResult.skipped} `
      });
    }
    autoClearUploadedFiles(slotsWithFiles);
  } catch (error) {
    appendUploadLog({ status: 'error', message: `上传失败：${error.message} ` });
    state.uploadState = 'idle';
    updateUploadControls();
    renderSlots();
  } finally {
    // 上传完成后处理队列中的下一个任务
    processUploadQueue();
  }
}

// 处理上传队列
function processUploadQueue() {
  if (state.uploadQueue.length === 0) {
    return;
  }

  // 取出队列中的第一个分类ID
  const nextSlotId = state.uploadQueue.shift();
  const slot = getSlot(nextSlotId);

  if (!slot) {
    appendUploadLog({ status: 'warning', message: '队列中的分类已被删除，跳过' });
    // 继续处理下一个
    processUploadQueue();
    return;
  }

  // 检查该分类是否有文件
  const hasFiles = slot.files?.length > 0 ||
    (slot.reviewEnabled && slot.referenceFiles?.length > 0);

  if (!hasFiles) {
    const slotName = getSlotReadableName(slot);
    appendUploadLog({
      status: 'warning',
      message: `${slotName} 没有文件，已跳过（剩余 ${state.uploadQueue.length} 个）`
    });
    // 继续处理下一个
    processUploadQueue();
    return;
  }

  const slotName = getSlotReadableName(slot);
  appendUploadLog({
    status: 'info',
    message: `开始上传队列中的下一个分类：${slotName}（剩余 ${state.uploadQueue.length} 个）`
  });

  // 延迟一小段时间再开始下一个上传，避免太快
  setTimeout(() => {
    handleUpload(nextSlotId);
  }, 500);
}

const NAMING_TOKEN_SKIP_KEYS = new Set([
  'counter',
  'date',
  'ext',
  'extension',
  'relativePath',
  'mimeType',
  'size',
  'subjectOrOriginal',
  'originalName'
]);

function getSlotMissingNamingTokens(slot) {
  const patternTokens = collectTokenValues(getSlotPattern(slot));
  if (!patternTokens.length) {
    return [];
  }
  const metadata = buildSlotMetadata(slot);
  const missing = [];
  const seenKeys = new Set();
  patternTokens.forEach((token) => {
    const key = token.replace(/^\{\{|\}\}$/g, '').trim();
    if (!key || NAMING_TOKEN_SKIP_KEYS.has(key) || seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    const rawValue = metadata[key];
    const normalized = rawValue == null ? '' : String(rawValue).trim();
    if (!normalized) {
      missing.push(token);
    }
  });
  return missing;
}

async function ensureSlotNamingTokens() {
  for (const slot of state.slots) {
    if (!slot.files.length) {
      continue;
    }
    const missingTokens = getSlotMissingNamingTokens(slot);
    if (!missingTokens.length) {
      continue;
    }
    const tokenLabels = Array.from(
      new Set(
        missingTokens.map((token) => tokenLabel({ type: 'token', value: token }) || token)
      )
    );
    const slotName = getSlotReadableName(slot);
    const proceed = await showConfirmationDialog({
      title: '命名信息缺失',
      message: `分类“${slotName}”的命名规则包含未填写的字符块，请确认是否继续上传。`,
      details: tokenLabels,
      confirmText: '继续上传',
      cancelText: '取消上传'
    });
    if (!proceed) {
      appendUploadLog({ status: 'error', message: '已取消上传，请补充命名所需字符块后重试' });
      return false;
    }
  }
  return true;
}

function dedupeFiles(files) {
  const seen = new Set();
  const prefixMap = new Map();
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const unique = [];
  let skipped = 0;
  files.forEach((file) => {
    const slot = getSlot(file.slotId);
    if (file.isReference || slot?.reviewEnabled) {
      unique.push(file);
      return;
    }
    const preview = slot?.previewMap.get(file.id);
    let newName = preview?.newName;
    if (newName && seen.has(newName)) {
      const adjusted = ensurePrefixedName(newName, seen, prefixMap, letters);
      if (adjusted) {
        newName = adjusted;
        applyOverrideName(file, newName, preview);
        appendUploadLog({
          status: 'success',
          message: `检测到重复命名，已自动调整为 ${newName} `
        });
      } else {
        skipped += 1;
        setFileStatus(
          file.slotId,
          file.id,
          'skipped',
          '命名重复，建议调整序号起始值，已跳过',
          false
        );
        return;
      }
    }
    if (newName) {
      seen.add(newName);
      applyOverrideName(file, newName, preview);
    }
    unique.push(file);
  });
  if (skipped > 0) {
    appendUploadLog({
      status: 'success',
      message: `发现 ${skipped} 个重复命名文件，已自动跳过。可调整 “序号设置” 中的起始值后重试。`
    });
  }
  renderSlots();
  return { unique, skipped };
}

function autoClearUploadedFiles(slots = []) {
  let clearedFiles = 0;
  let clearedReference = 0;
  const isDone = (info) => info?.status === 'success' || info?.status === 'skipped';

  slots.forEach((slot) => {
    if (!slot) return;

    const keepIds = new Set();
    let slotCleared = false;

    // 主文件
    const nextFiles = [];
    const nextFileStatuses = new Map();
    slot.files?.forEach((file) => {
      const info = slot.fileStatuses?.get(file.id);
      if (isDone(info)) {
        clearedFiles += 1;
        slotCleared = true;
        return;
      }
      keepIds.add(file.id);
      nextFiles.push(file);
      if (info) {
        nextFileStatuses.set(file.id, info);
      }
    });
    slot.files = nextFiles;
    slot.fileStatuses = nextFileStatuses;
    slot.selectedFiles = new Set(slot.files.map((file) => file.id));

    // 参考文件
    const nextReferenceFiles = [];
    const nextReferenceStatuses = new Map();
    slot.referenceFiles?.forEach((file) => {
      const info = slot.referenceFileStatuses?.get(file.id);
      if (isDone(info)) {
        clearedReference += 1;
        slotCleared = true;
        return;
      }
      keepIds.add(file.id);
      nextReferenceFiles.push(file);
      if (info) {
        nextReferenceStatuses.set(file.id, info);
      }
    });
    slot.referenceFiles = nextReferenceFiles;
    slot.referenceFileStatuses = nextReferenceStatuses;
    slot.selectedReferenceFiles = new Set(slot.referenceFiles.map((file) => file.id));

    // 清理预览映射
    if (slot.previewMap?.size) {
      slot.previewMap = new Map(
        Array.from(slot.previewMap.entries()).filter(([fileId]) => keepIds.has(fileId))
      );
    }

    // 只要清理过文件，就清空目录来源，避免下次自动重新扫描旧文件
    if (slotCleared) {
      slot.folderPath = '';
      slot.folderSources = [];
      slot.referenceFolderPath = '';
      slot.referenceFolderSources = [];
    }
  });

  if (clearedFiles || clearedReference) {
    appendUploadLog({
      status: 'success',
      message: `上传完成后已自动清空 ${clearedFiles + clearedReference} 个文件（含参考文件 ${clearedReference} 个）`
    });
    renderSlots();
    persistSlotPresets();
  }
}

function ensurePrefixedName(baseName, seen, prefixMap, letters) {
  const startIndex = prefixMap.get(baseName) || 0;
  for (let index = startIndex; index < letters.length; index += 1) {
    const candidate = insertPrefixBeforeCounter(baseName, letters[index]);
    if (!seen.has(candidate)) {
      prefixMap.set(baseName, index + 1);
      return candidate;
    }
  }
  return null;
}

function insertPrefixBeforeCounter(name, prefix) {
  if (!name || !prefix) {
    return name;
  }
  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex !== -1 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex !== -1 ? name.slice(dotIndex) : '';
  const match = base.match(/^(.*?)(\d+)$/);
  if (match) {
    return `${match[1]}${prefix}${match[2]}${ext} `;
  }
  return `${prefix}${name} `;
}

function applyOverrideName(file, newName, preview) {
  if (!newName) {
    return;
  }
  file.overrideName = newName;
  if (preview) {
    preview.newName = newName;
  }
}

function getNormalizedExtension(value) {
  if (!value) {
    return '';
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }
  const withDot = trimmed.startsWith('.') ? trimmed : trimmed.includes('.') ? trimmed.slice(trimmed.lastIndexOf('.')) : `.${trimmed} `;
  return withDot.toLowerCase();
}

function detectFileMediaCategory(file = {}) {
  const mimeType = String(file.mimeType || '').toLowerCase();
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (ARCHIVE_MIME_HINTS.includes(mimeType)) {
    return 'archive';
  }
  if (DOCUMENT_MIME_HINTS.includes(mimeType)) {
    return 'document';
  }
  const extension =
    getNormalizedExtension(file.extension) ||
    getNormalizedExtension(file.name || '') ||
    getNormalizedExtension(file.path || '');
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return 'audio';
  }
  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return 'archive';
  }
  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return 'document';
  }
  return 'other';
}

function getFileTypeLabel(file = {}) {
  const category = file.detectedCategory || detectFileMediaCategory(file);
  const categoryLabel = MEDIA_TYPE_LABELS[category] || '';
  const extension = getNormalizedExtension(file.extension || file.name || '');
  const cleanExt = extension ? extension.replace('.', '').toUpperCase() : '';
  const mimeType = String(file.mimeType || '').trim();
  const readableMime = mimeType && mimeType !== 'application/octet-stream' ? mimeType : '';
  const parts = [categoryLabel, cleanExt, readableMime].filter(Boolean);
  return parts.join(' · ') || '未知类型';
}

function formatFileTypeSummary(files = []) {
  if (!Array.isArray(files) || !files.length) {
    return '';
  }
  const counts = new Map();
  files.forEach((file) => {
    const category = file.detectedCategory || detectFileMediaCategory(file);
    const key = MEDIA_TYPE_LABELS[category] ? category : 'other';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const parts = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${MEDIA_TYPE_LABELS[key] || MEDIA_TYPE_LABELS.other} ${count} `);
  return parts.join('，');
}

async function maybeRenameLocalFiles(files) {
  if (!state.renameLocalEnabled || !files.length) {
    return true;
  }
  if (!window.bridge?.renameLocalFiles) {
    appendLog({ status: 'error', message: '当前版本不支持本地重命名' });
    return false;
  }
  const requests = [];
  files.forEach((file) => {
    const slot = getSlot(file.slotId);
    if (file.isReference || slot?.reviewEnabled) {
      return;
    }
    const preview = slot?.previewMap.get(file.id);
    if (!slot || !preview?.newName || !file.path) {
      return;
    }
    requests.push({
      id: file.id,
      slotId: slot.id,
      source: file.path,
      newName: preview.newName
    });
  });
  if (!requests.length) {
    appendLog({ status: 'error', message: '没有可重命名的文件，请先生成预览' });
    return false;
  }
  try {
    const result = await window.bridge.renameLocalFiles(requests);
    if (result?.errors?.length) {
      result.errors.forEach((entry) => {
        appendLog({
          status: 'error',
          message: `${entry?.source || entry?.id || '文件'} 重命名失败：${entry?.message || ''} `
        });
      });
      return false;
    }
    const renamedEntries = result?.renamed || [];
    if (!renamedEntries.length) {
      appendLog({ status: 'error', message: '没有任何文件被重命名' });
      return false;
    }
    const renamedMap = new Map(renamedEntries.map((entry) => [entry.id, entry]));
    state.slots.forEach((slot) => {
      slot.files = slot.files.map((file) => {
        const updated = renamedMap.get(file.id);
        if (!updated) {
          return file;
        }
        const preview = slot.previewMap?.get(file.id);
        applyOverrideName(file, updated.name, preview);
        const nextFile = {
          ...file,
          path: updated.path,
          name: updated.name,
          forcedMimeType: file.forcedMimeType
        };
        nextFile.detectedCategory = detectFileMediaCategory(nextFile);
        return nextFile;
      });
      slot.referenceFiles = (slot.referenceFiles || []).map((file) => {
        const updated = renamedMap.get(file.id);
        if (!updated) {
          return file;
        }
        const preview = slot.previewMap?.get(file.id);
        applyOverrideName(file, updated.name, preview);
        const nextFile = {
          ...file,
          path: updated.path,
          name: updated.name,
          forcedMimeType: file.forcedMimeType,
          isReference: true
        };
        nextFile.detectedCategory = detectFileMediaCategory(nextFile);
        return nextFile;
      });
    });
    files.forEach((file, index) => {
      const updated = renamedMap.get(file.id);
      if (updated) {
        const slot = getSlot(file.slotId);
        const preview = slot?.previewMap.get(file.id);
        applyOverrideName(file, updated.name, preview);
        const nextFile = {
          ...file,
          path: updated.path,
          name: updated.name,
          forcedMimeType: file.forcedMimeType
        };
        nextFile.detectedCategory = detectFileMediaCategory(nextFile);
        files[index] = nextFile;
      }
    });
    renderSlots();
    appendLog({ status: 'success', message: `已同步重命名 ${renamedEntries.length} 个本地文件` });
    return true;
  } catch (error) {
    appendLog({ status: 'error', message: `本地重命名失败：${error.message} ` });
    return false;
  }
}

async function resolveDuplicateUploads(files) {
  if (!files.length || !window.bridge?.checkUploadedFiles) {
    return { files, forceIds: [] };
  }
  const ids = Array.from(new Set(files.map((file) => file.id))).filter(Boolean);
  if (!ids.length) {
    return { files, forceIds: [] };
  }
  try {
    const result = await window.bridge.checkUploadedFiles(ids);
    const duplicateIds = result?.duplicates || [];
    if (!duplicateIds.length) {
      return { files, forceIds: [] };
    }
    const duplicateFiles = duplicateIds
      .map((id) => files.find((file) => file.id === id))
      .filter(Boolean);
    if (!duplicateFiles.length) {
      return { files, forceIds: [] };
    }
    const slotMap = new Map();
    duplicateFiles.forEach((file) => {
      const slot = getSlot(file.slotId);
      const key = slot ? getSlotReadableName(slot) : '未知分类';
      slotMap.set(key, (slotMap.get(key) || 0) + 1);
    });
    const summaryItems = Array.from(slotMap.entries()).map(([name, count]) => `${name}：${count} 个`);
    const shouldRepeat = await showDuplicateUploadDialog(duplicateFiles, summaryItems);
    if (shouldRepeat) {
      appendLog({ status: 'success', message: `已确认重复上传 ${duplicateFiles.length} 个文件` });
      return { files, forceIds: duplicateIds };
    }
    duplicateFiles.forEach((file) => {
      setFileStatus(file.slotId, file.id, 'skipped', '重复文件已跳过', false);
    });
    const remaining = files.filter((file) => !duplicateIds.includes(file.id));
    renderSlots();
    appendLog({ status: 'success', message: `已跳过 ${duplicateFiles.length} 个重复文件，继续上传其他分类` });
    if (!remaining.length) {
      return null;
    }
    return { files: remaining, forceIds: [] };
  } catch (error) {
    appendLog({ status: 'error', message: `检测入库记录失败：${error.message} ` });
    return null;
  }
}

function renderLinkButton(url, label = '', options = {}) {
  if (!url) {
    return '无';
  }
  const buttonLabel = label ? `打开${label} ` : '打开链接';
  const attrs = [];
  if (options.linkText) {
    attrs.push(`data-link-type="${escapeHtml(options.linkText)}\"`);
  }
  if (options.reviewStatus) {
    attrs.push(`data-review-status="${escapeHtml(options.reviewStatus)}"`);
  }
  const attrsString = attrs.length ? ` ${attrs.join(' ')}` : '';
  return `<button type="button" class="chip-link-button" data-open-url="${escapeHtml(url)}"${attrsString}>${escapeHtml(buttonLabel)}</button>`;
}

function buildReviewChip(label, value, options = {}) {
  const classes = ['review-chip'];
  const { hideLabel, variant } = options;
  if (hideLabel) {
    classes.push('chip-hide-label');
  }
  if (variant) {
    classes.push(`chip-${variant}`);
  }
  return `
    <div class="${classes.join(' ')}">
      <span class="chip-label">${label}</span>
      <span class="chip-value">${value || '无'}</span>
    </div>
    `;
}

function buildReviewChipRows(rows = []) {
  if (!rows.length) {
    return '';
  }
  const normalizedRows = rows.map((row) => {
    if (Array.isArray(row)) {
      return { items: row };
    }
    if (row && Array.isArray(row.items)) {
      return row;
    }
    return { items: [] };
  });
  return `
    <div class="review-chip-group">
      ${normalizedRows
      .map((row) => {
        const items = row.items || [];
        const count = items.length;
        const layout = row.layout || (count === 1 ? 'single' : '');
        const classes = ['review-chip-row'];
        if (layout) {
          classes.push(`layout-${layout}`);
        }
        const attrs = [`data-chip-count="${count}"`, layout ? `data-chip-layout="${layout}"` : '']
          .filter(Boolean)
          .join(' ');
        return `<div class="${classes.join(' ')}" ${attrs}>${items.join('')}</div>`;
      })
      .join('')
    }
    </div>
    `;
}

function buildReviewerActions(entry, status) {
  return `
    <div class="review-result-block">
      <div class="review-actions">
        <select class="review-status-select" data-row="${entry.rowNumber}">
          ${REVIEW_STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="primary action-pill review-action-btn" data-action="apply-review-status" data-row="${entry.rowNumber}">
          更新状态
        </button>
      </div>
    </div >
    `;
}

function buildSubmitterActions(entry, status) {
  const row = entry.rowNumber;
  if (status === REVIEW_STATUS.APPROVED) {
    return `<div class="review-card-actions"><span class="muted">已入库</span></div>`;
  }
  if (status === REVIEW_STATUS.CANCELLED) {
    return `<div class="review-card-actions">
    <button class="ghost action-pill" data-action="reopen-cancelled" data-row="${row}">重新审核</button>
    </div>`;
  }
  if (status === REVIEW_STATUS.NEEDS_CHANGE || status === REVIEW_STATUS.PARTIAL_CHANGE) {
    return `<div class="review-card-actions">
      <button class="ghost action-pill" data-action="mark-updated" data-row="${row}">已更新修改</button>
      <button class="ghost danger action-pill" data-action="cancel-review" data-row="${row}">取消审核</button>
    </div>`;
  }
  return `<div class="review-card-actions">
    <span class="muted">等待审核</span>
    <button class="ghost danger action-pill" data-action="cancel-review" data-row="${row}">取消审核</button>
  </div>`;
}

function buildReviewCard(entry, config = {}) {
  const statusRaw = (entry.status || '').trim();
  const status = normalizeReviewStatus(statusRaw);
  const statusClass = getReviewStatusClass(status);
  const title = escapeHtml(entry.displayTitle || getReviewEntryTitle(entry));
  const submitterName = escapeHtml(entry.submitter || '-');
  const adminName = escapeHtml(entry.admin || '-');
  const submitDate = escapeHtml(entry.completedAt || entry.customDate || '-');
  const categoryLabel = escapeHtml(`${entry.mainCategory || '-'} / ${entry.subCategory || '-'}`);
  const reviewLink = entry.tempLink || '';
  const finalLink =
    entry.folderLink ||
    (entry.targetFolderId ? `https://drive.google.com/drive/folders/${entry.targetFolderId}` : '');
  const reviewLinkButton = renderLinkButton(reviewLink, '审核链接');
  const folderLinkButton = renderLinkButton(finalLink, '最终链接', {
    linkType: 'final',
    reviewStatus: status
  });
  const cardClasses = ['review-card'];
  if (statusClass) {
    cardClasses.push(statusClass);
  }
  if (config.extraClass) {
    cardClasses.push(config.extraClass);
  }
  const chipRows = [
    {
      layout: 'single',
      items: [
        buildReviewChip('提交人', submitterName, { variant: 'plain' })
      ]
    },
    {
      layout: 'double',
      items: [
        buildReviewChip('审核链接', reviewLinkButton, { hideLabel: true }),
        buildReviewChip('最终链接', folderLinkButton, { hideLabel: true })
      ]
    }
  ];
  const metaSection = buildReviewChipRows(chipRows);
  const noteMode = config.noteMode || 'text';
  const noteLabel = config.noteLabel || '审核建议';
  const noteValue = config.noteValue || '';
  const noteSection =
    noteMode === 'input'
      ? `<div class="review-card-section">
          <span class="review-card-label">${noteLabel}</span>
          <textarea class="review-note-input" data-row="${entry.rowNumber}" placeholder="输入审核意见">${escapeHtml(noteValue)}</textarea>
        </div>`
      : `<div class="review-card-section">
          <span class="review-card-label">${noteLabel}</span>
          <div class="review-note-text">${escapeHtml(noteValue || '暂无')}</div>
        </div>`;

  // 选择使用交互式文件网格还是传统的文件列表摘要
  const fileSection = config.interactiveFiles
    ? renderInteractiveFileGrid(entry, {
      context: config.fileContext || 'review',
      allowRefresh: config.allowRefresh !== false && Boolean(entry.folderId)
    })
    : renderFileListSummary(entry, {
      context: config.fileContext || 'review',
      initialCollapsed: config.fileCollapsed !== false,
      allowRefresh: config.allowRefresh !== false && Boolean(entry.folderId),
      refreshLabel: config.refreshLabel
    });
  const fileHint = config.interactiveFiles ? '' : (config.fileHint || '');
  const actionsHtml = config.actionsHtml || '';
  return `
    <div class="${cardClasses.join(' ')}" data-row="${entry.rowNumber}">
      <header class="review-card-header">
        <div class="review-card-title-block">
          <p class="review-card-label">文件命名</p>
          <h3 class="review-card-title">${title}</h3>
          <p class="review-card-subtitle">${categoryLabel}</p>
          <p class="review-card-subtitle">提交日期：${submitDate}</p>
        </div>
        <div class="review-card-status-chip ${statusClass}">
          <span class="status-label">状态</span>
          <span class="status-value">${escapeHtml(statusRaw || '')}</span>
        </div>
      </header>
      ${metaSection}
      ${noteSection}
      ${fileSection}
      ${fileHint}
      ${actionsHtml}
    </div>
  `;
}

function sortEntriesByCategory(entries = [], ascending = true) {
  return entries.slice().sort((a, b) => {
    const labelA = getEntryCategoryLabel(a);
    const labelB = getEntryCategoryLabel(b);
    if (labelA !== labelB) {
      return ascending ? labelA.localeCompare(labelB) : labelB.localeCompare(labelA);
    }
    return getEntryTimestamp(b) - getEntryTimestamp(a);
  });
}

function normalizeReviewSortMode(mode) {
  return REVIEW_SORT_MODES.includes(mode) ? mode : 'priority';
}

function normalizeReviewRangeMode(mode) {
  return REVIEW_RANGE_MODES.includes(mode) ? mode : '10d';
}

function prioritizeReviewEntries(entries = []) {
  const mode = normalizeReviewSortMode(state.reviewSort?.mode || 'priority');
  if (mode === 'date-desc') {
    return entries.slice().sort((a, b) => getEntryTimestamp(b) - getEntryTimestamp(a));
  }
  if (mode === 'date-asc') {
    return entries.slice().sort((a, b) => getEntryTimestamp(a) - getEntryTimestamp(b));
  }
  if (mode === 'category-asc' || mode === 'category-desc') {
    return sortEntriesByCategory(entries, mode === 'category-asc');
  }
  const buckets = {
    feedback: [],
    pending: [],
    approved: [],
    others: []
  };
  entries.forEach((entry) => {
    const status = normalizeReviewStatus(entry.status);
    if (status === REVIEW_STATUS.NEEDS_CHANGE || status === REVIEW_STATUS.PARTIAL_CHANGE) {
      buckets.feedback.push(entry);
    } else if (status === REVIEW_STATUS.PENDING || status === REVIEW_STATUS.UPDATED) {
      buckets.pending.push(entry);
    } else if (status === REVIEW_STATUS.APPROVED) {
      buckets.approved.push(entry);
    } else {
      buckets.others.push(entry);
    }
  });
  return [...buckets.feedback, ...buckets.pending, ...buckets.approved, ...buckets.others];
}

function filterReviewEntriesByRange(entries = []) {
  const mode = normalizeReviewRangeMode(state.reviewRangeMode);
  if (mode === 'all') {
    return entries;
  }
  const cutoff = Date.now() - 10 * DAY_IN_MS;
  return entries.filter((entry) => {
    const date = getEntryCompletedDate(entry);
    if (!date) {
      return true;
    }
    return date.getTime() >= cutoff;
  });
}

// === 新审核流程：按文件审核面板 ===

// 文件审核状态常量（与后端对应）
const FILE_REVIEW_STATUS = {
  PENDING: '待审核',
  APPROVED: '合格',
  REJECTED: '不合格',
  DISCARDED: '作废',   // 不合格但不需要修改，直接放弃
  STORED: '已入库',
  REPLACED: '已替换'
};

// 新流程状态
if (!state.fileReviewBatches) {
  state.fileReviewBatches = [];
  state.fileReviewFiles = [];
  state.fileReviewLoading = false;
}

/**
 * 需要同步和比较的所有字段（排除内部字段）
 * 用于 detectDataConflicts 和 syncSheetDataToFirebase
 */
const SYNC_COMPARE_FIELDS = [
  'batchId',
  'tempFolderLink',
  'fileName',
  'fileId',
  'fileLink',
  'submitter',
  'submitTime',
  'status',
  'taskType',
  'mainCategory',
  'subCategory',
  'reviewer',
  'reviewTime',
  'reviewNote',
  'batchStatus',
  'finalFolderLink',
  'finalFileLink',
  'linkedFileId',
  'referenceFolderId',
  'batchNote',
  'admin',
  'renamePattern',
  'folderPattern',
  'namingMetadata',
  'targetFolderId',
  'namingResult',
  'annotatedFileId',
  'annotatedTime',
  'referenceFolderLink',
  'reviewSlotName',
  'reviewDescription',
  'submitNote'
];

const SYNC_FIELD_LABELS = {
  batchId: '批次ID',
  tempFolderLink: '临时目录链接',
  fileName: '文件名',
  fileId: '文件ID',
  fileLink: '文件链接',
  submitter: '提交人',
  submitTime: '提交时间',
  status: '状态',
  taskType: '任务类型',
  mainCategory: '主类别',
  subCategory: '子类别',
  reviewer: '审核人',
  reviewTime: '审核时间',
  reviewNote: '审核备注',
  batchStatus: '批次审核状态',
  finalFolderLink: '入库后最终文件夹链接',
  finalFileLink: '入库后文件链接',
  linkedFileId: '关联文件ID',
  referenceFolderId: '参考文件夹ID',
  batchNote: '批次备注',
  admin: '管理员',
  renamePattern: '文件命名规则',
  folderPattern: '文件夹命名规则',
  namingMetadata: '命名元数据',
  targetFolderId: '入库目标ID',
  namingResult: '实际命名结果',
  annotatedFileId: '标注文件ID',
  annotatedTime: '标注时间',
  referenceFolderLink: '参考文件夹链接',
  reviewSlotName: '批次显示名',
  reviewDescription: '批次描述',
  submitNote: '提交备注'
};

/**
 * 将表格数据同步到 Firebase（所有字段）
 */
async function syncSheetDataToFirebase(sheetFiles) {
  if (!sheetFiles?.length) {
    return false;
  }
  if (window.bridge?.firebase && !state.firebaseInitialized) {
    try {
      await initializeFirebaseSync(sheetFiles);
    } catch (error) {
      console.warn('[syncSheetDataToFirebase] Firebase 初始化失败:', error.message);
    }
  }
  if (!state.firebaseInitialized || !state.firebaseSheetId) {
    return false;
  }

  const firebaseUpdates = sheetFiles.map(f => {
    const update = { rowNumber: f.rowNumber };
    SYNC_COMPARE_FIELDS.forEach(field => {
      update[field] = f[field] || '';
    });
    // 确保 status 有默认值
    if (!update.status) update.status = '待审核';
    return update;
  });

  await window.bridge.firebase.batchUpdateFileStatus(state.firebaseSheetId, firebaseUpdates);
  return true;
}

/**
 * 检测本地数据和远程数据的冲突
 * @param {Array} localFiles - 本地文件列表（Firebase 或本地缓存）
 * @param {Array} remoteFiles - 远程文件列表（从 Google Sheets）
 * @returns {Array} 冲突列表
 */
function detectDataConflicts(localFiles, remoteFiles) {
  const conflicts = [];
  const localMap = new Map(localFiles.map(f => [f.rowNumber, f]));
  const remoteMap = new Map(remoteFiles.map(f => [f.rowNumber, f]));

  // 使用共享的字段列表
  const allFields = SYNC_COMPARE_FIELDS;

  // 检查本地有、远程也有的记录
  remoteFiles.forEach(remote => {
    const local = localMap.get(remote.rowNumber);
    if (!local) return;

    // 比较所有字段
    const diffs = [];
    allFields.forEach(field => {
      const localVal = (local[field] || '').toString().trim();
      const remoteVal = (remote[field] || '').toString().trim();
      if (localVal !== remoteVal) {
        diffs.push({
          field,
          local: localVal || '(空)',
          remote: remoteVal || '(空)'
        });
      }
    });

    if (diffs.length > 0) {
      conflicts.push({
        rowNumber: remote.rowNumber,
        fileName: remote.fileName || local.fileName,
        submitter: remote.submitter || local.submitter || '',
        batchId: remote.batchId || local.batchId || '',
        localStatus: local.status,
        remoteStatus: remote.status,
        localReviewer: local.reviewer || '',
        localReviewNote: local.reviewNote || '',
        localTime: local.reviewTime,
        remoteTime: remote.reviewTime,
        localRecord: { ...local },
        remoteRecord: { ...remote },
        diffs // 详细差异列表
      });
    }
  });

  // 检查本地有、远程没有的记录（表格中被删除的行）
  localFiles.forEach(local => {
    if (!remoteMap.has(local.rowNumber)) {
      conflicts.push({
        rowNumber: local.rowNumber,
        fileName: local.fileName,
        submitter: local.submitter || '',
        batchId: local.batchId || '',
        localStatus: local.status,
        remoteStatus: '(行已删除)',
        type: 'deleted'
      });
    }
  });

  // 忽略表格已删除的行
  return conflicts.filter(conflict => conflict.type !== 'deleted');
}

/**
 * 显示数据冲突确认弹窗
 * @param {Array} conflicts - 冲突列表
 * @returns {Promise<string>} 用户选择: 'local' | 'remote' | 'cancel'
 */
function showDataConflictDialog(conflicts) {
  return new Promise(resolve => {
    // 创建模态框
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '10000';

    const conflictSummary = conflicts.slice(0, 5).map(c =>
      `• ${c.fileName}: 本地[${c.localStatus}] ↔ 表格[${c.remoteStatus}]`
    ).join('<br>');
    const moreText = conflicts.length > 5 ? `<br>... 还有 ${conflicts.length - 5} 条冲突` : '';

    overlay.innerHTML = `
      <div class="modal" style="max-width: 500px; padding: 24px;">
        <h3 style="margin: 0 0 16px; color: #e67700;">⚠️ 检测到数据冲突</h3>
        <p style="margin: 0 0 12px; color: #666;">
          发现 <strong>${conflicts.length}</strong> 条数据在本地和表格中状态不一致：
        </p>
        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; max-height: 200px; overflow: auto;">
          ${conflictSummary}${moreText}
        </div>
        <p style="margin: 0 0 16px; color: #666; font-size: 13px;">
          请选择以哪个数据为准：
        </p>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="btn btn-secondary" data-choice="cancel">取消</button>
          <button class="btn btn-primary" data-choice="local" style="background: #4a90d9;">保留本地数据</button>
          <button class="btn btn-primary" data-choice="remote" style="background: #28a745;">使用表格数据</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      const choice = e.target.dataset.choice;
      if (choice) {
        document.body.removeChild(overlay);
        resolve(choice);
      } else if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve('cancel');
      }
    });
  });
}

// 后台表格数据变动检测
let sheetChangeCheckTimer = null;
let sheetChangeNotificationShown = false;
const SHEET_CHANGE_CHECK_INTERVAL = 20000; // 每20秒检查一次（原60秒）

/**
 * 启动表格数据变动检测
 */
function startSheetChangeDetection() {
  if (sheetChangeCheckTimer) return;

  sheetChangeCheckTimer = setInterval(async () => {
    if (sheetChangeNotificationShown) return; // 已经显示通知，不重复检查
    if (!state.config.sheetId) return;

    // 只在总审核面板页面显示通知
    const reviewPanel = document.querySelector('.view-panel[data-view="review"]');
    if (!reviewPanel || !reviewPanel.classList.contains('active')) return;

    // 检查是否是审核人员（总审核面板标签可见）
    const reviewTab = document.getElementById('view-tab-review');
    if (!reviewTab || reviewTab.hidden) return;

    try {
      // 静默获取表格最新数据
      const result = await window.bridge.fetchFileReviewEntries({ groupByBatch: true });
      const sheetFiles = result.files || [];

      if (!sheetFiles.length) return;

      // 同时尝试从 Firebase 获取数据进行比对
      let localFiles = state.fileReviewFiles || [];

      // 如果 Firebase 已初始化，优先使用 Firebase 数据
      if (window.bridge?.firebase && state.firebaseInitialized && state.firebaseSheetId) {
        try {
          const firebaseData = await window.bridge.firebase.getReviews(state.firebaseSheetId);
          if (firebaseData.success && firebaseData.files?.length) {
            console.log('[差异检测] 使用 Firebase 数据进行比对，共', firebaseData.files.length, '条');
            localFiles = firebaseData.files;
          } else {
            console.log('[差异检测] Firebase 数据为空或获取失败，使用本地缓存');
          }
        } catch (fbErr) {
          console.warn('[差异检测] Firebase 获取失败，使用本地缓存:', fbErr.message);
        }
      } else {
        console.log('[差异检测] Firebase 未初始化，使用本地缓存，共', localFiles.length, '条');
      }

      if (!localFiles.length) {
        console.log('[差异检测] 本地数据为空，跳过检测');
        return;
      }

      // 检测冲突：比较 Firebase/本地数据 和 表格数据
      const conflicts = detectDataConflicts(localFiles, sheetFiles);

      console.log('[差异检测] 本地:', localFiles.length, '条, 表格:', sheetFiles.length, '条, 冲突:', conflicts.length, '条');

      // 如果有冲突，打印前3条详细信息
      if (conflicts.length > 0) {
        console.log('[差异检测] 冲突详情:', conflicts.slice(0, 3));
        showSheetChangeNotification(conflicts);
      }
    } catch (err) {
      console.warn('后台检测表格变动失败:', err.message);
    }
  }, SHEET_CHANGE_CHECK_INTERVAL);

  console.log('[FileReview] 表格数据变动检测已启动，间隔:', SHEET_CHANGE_CHECK_INTERVAL, 'ms');
}

// 手动触发差异检测（调试用）
async function manualCheckDataConflicts() {
  console.log('[手动检测] 开始检测...');
  if (!state.config.sheetId) {
    console.log('[手动检测] 没有配置 sheetId');
    return;
  }

  try {
    const result = await window.bridge.fetchFileReviewEntries({ groupByBatch: true });
    const sheetFiles = result.files || [];
    console.log('[手动检测] 表格数据:', sheetFiles.length, '条');

    let localFiles = state.fileReviewFiles || [];
    if (window.bridge?.firebase && state.firebaseInitialized && state.firebaseSheetId) {
      const firebaseData = await window.bridge.firebase.getReviews(state.firebaseSheetId);
      if (firebaseData.success && firebaseData.files?.length) {
        localFiles = firebaseData.files;
        console.log('[手动检测] Firebase 数据:', localFiles.length, '条');
      }
    } else {
      console.log('[手动检测] 本地缓存数据:', localFiles.length, '条');
    }

    const conflicts = detectDataConflicts(localFiles, sheetFiles);
    console.log('[手动检测] 检测到', conflicts.length, '条冲突');

    if (conflicts.length > 0) {
      console.log('[手动检测] 冲突详情:', conflicts);
      sheetChangeNotificationShown = false; // 重置状态以便显示通知
      showSheetChangeNotification(conflicts);
    } else {
      appendLog({ status: 'success', message: '数据一致，没有检测到差异' });
    }

    return conflicts;
  } catch (err) {
    console.error('[手动检测] 失败:', err);
    return [];
  }
}

// 暴露到 window 以便控制台调试
window.manualCheckDataConflicts = manualCheckDataConflicts;

// 绑定"检测差异"按钮（延迟执行，确保 dom 已加载）
document.addEventListener('DOMContentLoaded', () => {
  const checkBtn = document.getElementById('check-data-conflicts');
  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      checkBtn.disabled = true;
      checkBtn.textContent = '检测中...';
      try {
        await manualCheckDataConflicts();
      } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = '检测差异';
      }
    });
  }
});

/**
 * 停止表格数据变动检测
 */
function stopSheetChangeDetection() {
  if (sheetChangeCheckTimer) {
    clearInterval(sheetChangeCheckTimer);
    sheetChangeCheckTimer = null;
  }
}

/**
 * 显示表格数据变动通知（现代卡片式设计）
 */
function showSheetChangeNotification(conflicts) {
  if (sheetChangeNotificationShown) return;
  sheetChangeNotificationShown = true;

  // 移除已存在的通知
  const existingNotif = document.querySelector('.data-conflict-toast');
  if (existingNotif) existingNotif.remove();

  // 创建浮动通知
  const notification = document.createElement('div');
  notification.className = 'data-conflict-toast';
  notification.innerHTML = `
    <div class="dct-header">
      <div class="dct-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="dct-title">数据不一致</div>
      <button class="dct-close" data-action="dismiss">&times;</button>
    </div>
    <div class="dct-body">
      <p>检测到 <strong>${conflicts.length}</strong> 条记录在表格和本地数据之间存在差异</p>
    </div>
    <div class="dct-actions">
      <button class="dct-btn dct-btn-outline" data-action="details">查看详情</button>
      <button class="dct-btn dct-btn-primary" data-action="use-remote">同步表格数据</button>
    </div>
  `;

  // 添加样式
  if (!document.getElementById('data-conflict-toast-style')) {
    const style = document.createElement('style');
    style.id = 'data-conflict-toast-style';
    style.textContent = `
      .data-conflict-toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 340px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
        z-index: 10000;
        animation: dctSlideIn 0.3s ease;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      @keyframes dctSlideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .dct-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
        color: white;
      }
      .dct-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .dct-icon svg {
        stroke: white;
      }
      .dct-title {
        flex: 1;
        font-size: 14px;
        font-weight: 600;
      }
      .dct-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        opacity: 0.8;
      }
      .dct-close:hover {
        opacity: 1;
      }
      .dct-body {
        padding: 16px;
        font-size: 13px;
        color: #333;
        line-height: 1.5;
      }
      .dct-body p {
        margin: 0;
      }
      .dct-body strong {
        color: #f57c00;
        font-weight: 600;
      }
      .dct-actions {
        display: flex;
        gap: 10px;
        padding: 0 16px 16px;
      }
      .dct-btn {
        flex: 1;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      .dct-btn-outline {
        background: #f5f5f5;
        color: #555;
      }
      .dct-btn-outline:hover {
        background: #e8e8e8;
      }
      .dct-btn-primary {
        background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
        color: white;
      }
      .dct-btn-primary:hover {
        background: linear-gradient(135deg, #43a047 0%, #2e7d32 100%);
      }
    `;
    document.head.appendChild(style);
  }
  document.body.appendChild(notification);

  // 存储冲突数据供查看详情使用
  notification._conflicts = conflicts;

  // 事件处理
  notification.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'details') {
      // 显示差异详情弹窗
      showConflictDetailsModal(notification._conflicts);
    } else if (action === 'use-remote') {
      // 同步表格数据到 Firebase
      notification.remove();
      appendLog({ status: 'info', message: '正在同步表格数据...' });

      try {
        // 先获取表格最新数据
        const result = await window.bridge.fetchFileReviewEntries({ groupByBatch: true });
        const sheetFiles = result.files || [];

        // 使用公用函数同步所有字段到 Firebase
        await syncSheetDataToFirebase(sheetFiles);
        appendLog({ status: 'success', message: `已同步 ${sheetFiles.length} 条数据到 Firebase` });

        // 刷新界面
        await loadReviewEntries({ logSuccess: false, forceRefresh: true, skipConflictCheck: true });
        sheetChangeNotificationShown = false;
      } catch (err) {
        appendLog({ status: 'error', message: '同步失败: ' + err.message });
        sheetChangeNotificationShown = false;
      }
    } else if (action === 'dismiss') {
      notification.remove();
      // 10分钟后允许再次提醒
      setTimeout(() => { sheetChangeNotificationShown = false; }, 10 * 60 * 1000);
    }
  });
}

/**
 * 显示冲突详情弹窗（表格布局 + 逐条选择）
 */
function showConflictDetailsModal(conflicts) {
  const overlay = document.createElement('div');
  overlay.className = 'conflict-modal-overlay';

  // 生成状态徽章
  const getStatusBadge = (status, type) => {
    const colors = type === 'firebase'
      ? { bg: '#e3f2fd', color: '#1976d2', border: '#90caf9' }
      : { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' };
    return `<span style="
      display: inline-block;
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
      background: ${colors.bg};
      color: ${colors.color};
      border: 1px solid ${colors.border};
      white-space: nowrap;
    ">${status || '待审核'}</span>`;
  };

  // 简化批次ID显示
  const formatBatchId = (batchId) => {
    if (!batchId) return '-';
    const parts = batchId.replace('BATCH-', '').split('-');
    if (parts.length >= 3) {
      return `${parts[1]}-${parts[2]}`;
    }
    return batchId.replace('BATCH-', '');
  };

  const conflictMap = new Map(conflicts.map(c => [String(c.rowNumber), c]));

  const getFieldLabel = (field) => SYNC_FIELD_LABELS[field] || field;

  const normalizeValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch (err) {
      return String(value);
    }
  };

  const formatDisplayValue = (value) => {
    const normalized = normalizeValue(value);
    return normalized ? normalized : '(空)';
  };

  const renderDiffDetails = (conflict, showAllFields) => {
    const diffList = Array.isArray(conflict.diffs) ? conflict.diffs : [];
    const diffFieldSet = new Set(diffList.map(diff => diff.field));

    if (showAllFields && conflict.localRecord && conflict.remoteRecord) {
      return SYNC_COMPARE_FIELDS.map(field => {
        const localVal = formatDisplayValue(conflict.localRecord[field]);
        const remoteVal = formatDisplayValue(conflict.remoteRecord[field]);
        const isDiff = diffFieldSet.has(field);
        return `
          <div style="padding: 6px 8px; border-bottom: 1px dashed #e5e7eb; ${isDiff ? 'background: #fff7ed; border-left: 3px solid #f59e0b;' : ''}">
            <strong style="color:#111827;">${escapeHtml(getFieldLabel(field))}</strong>
            ${isDiff ? '<span style="margin-left:6px; color:#f59e0b; font-size:11px;">不一致</span>' : ''}
            <div style="color:#6b7280; font-size:12px;">
              本地：${escapeHtml(localVal)} ｜ 表格：${escapeHtml(remoteVal)}
            </div>
          </div>
        `;
      }).join('');
    }

    if (diffList.length > 0) {
      return diffList.map(diff => `
          <div style="padding: 6px 0; border-bottom: 1px dashed #e5e7eb;">
            <strong style="color:#111827;">${escapeHtml(getFieldLabel(diff.field))}</strong>
            <div style="color:#6b7280; font-size:12px;">
              本地：${escapeHtml(diff.local || '')} ｜ 表格：${escapeHtml(diff.remote || '')}
            </div>
          </div>
        `).join('');
    }

    if (conflict.type === 'deleted') {
      return '<div style="color:#b91c1c; font-size:12px;">表格中已删除该行</div>';
    }
    return '<div style="color:#6b7280; font-size:12px;">无字段差异</div>';
  };

  const tableRows = conflicts.map((c, i) => {
    const diffCount = Array.isArray(c.diffs) ? c.diffs.length : 0;
    const diffLabel = diffCount > 0 ? `详情(${diffCount})` : '详情';
    const diffHtml = renderDiffDetails(c, false);
    return `
    <tr style="background: ${i % 2 === 0 ? '#fafbfc' : 'white'};" data-row="${c.rowNumber}">
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; text-align: center;">
        <input type="checkbox" class="conflict-checkbox" data-row="${c.rowNumber}" checked>
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; color: #5f6368; white-space: nowrap;">
        ${formatBatchId(c.batchId)}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; color: #5f6368; white-space: nowrap;">
        ${c.submitter || '-'}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; color: #202124; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.fileName || ''}">
        ${c.fileName || '未知文件'}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; text-align: center;">
        ${getStatusBadge(c.localStatus, 'firebase')}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; text-align: center;">
        ${getStatusBadge(c.remoteStatus, 'sheet')}
      </td>
      <td style="padding: 10px 6px; border-bottom: 1px solid #f0f0f0; text-align: center;">
        <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
          <select class="conflict-choice" data-row="${c.rowNumber}" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd; font-size: 11px;">
            <option value="sheet" selected>用表格</option>
            <option value="firebase">用Firebase</option>
            <option value="skip">跳过</option>
          </select>
          <button class="conflict-toggle" data-action="toggle-diff" data-row="${c.rowNumber}" data-label="${diffLabel}" style="padding: 3px 8px; font-size: 11px; border: 1px solid #ddd; background: #fff; color: #444; border-radius: 4px; cursor: pointer;">${diffLabel}</button>
        </div>
      </td>
    </tr>
    <tr class="conflict-diff-row" data-row="${c.rowNumber}" style="display:none; background: #fff;">
      <td colspan="7" style="padding: 10px 14px; border-bottom: 1px solid #f0f0f0;">
        ${diffHtml}
      </td>
    </tr>
  `;
  }).join('');

  // 存储冲突数据
  overlay._conflicts = conflicts;

  overlay.innerHTML = `
    <style>
      .conflict-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .conflict-modal {
        background: white;
        border-radius: 16px;
        max-width: 760px;
        width: 95%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 24px 48px rgba(0,0,0,0.2);
        animation: slideUp 0.3s ease;
        overflow: hidden;
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .conflict-modal-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 18px 24px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .conflict-modal-header h3 {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
        flex: 1;
      }
      .conflict-modal-header .count-badge {
        background: rgba(255,255,255,0.2);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 13px;
      }
      .conflict-modal-body {
        flex: 1;
        overflow-y: auto;
        max-height: 400px;
      }
      .conflict-modal-body table {
        width: 100%;
        border-collapse: collapse;
      }
      .conflict-modal-body th {
        position: sticky;
        top: 0;
        background: #f8f9fa;
        padding: 12px;
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        color: #5f6368;
        border-bottom: 2px solid #e8eaed;
        white-space: nowrap;
      }
      .conflict-modal-body th:nth-child(4),
      .conflict-modal-body th:nth-child(5) {
        text-align: center;
      }
      .conflict-diff-row {
        background: #fff7ed;
      }
      .conflict-modal-footer {
        padding: 16px 20px;
        background: #f8f9fa;
        border-top: 1px solid #e8eaed;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .conflict-modal-footer button {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      .conflict-modal-footer .btn-close {
        background: white;
        color: #5f6368;
        border: 1px solid #dadce0;
      }
      .conflict-modal-footer .btn-close:hover {
        background: #f1f3f4;
      }
      .conflict-modal-footer .btn-firebase {
        background: #1976d2;
        color: white;
      }
      .conflict-modal-footer .btn-firebase:hover {
        background: #1565c0;
      }
      .conflict-modal-footer .btn-sheet {
        background: #2e7d32;
        color: white;
      }
      .conflict-modal-footer .btn-sheet:hover {
        background: #1b5e20;
      }
    </style>
    <div class="conflict-modal">
      <div class="conflict-modal-header">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <h3>审核数据差异</h3>
        <span class="count-badge">${conflicts.length} 条冲突</span>
      </div>
      <div class="conflict-modal-body">
        <div style="margin-bottom: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <label style="font-size: 12px; color: #666;">
            <input type="checkbox" id="conflict-select-all" checked> 全选
          </label>
          <span style="font-size: 11px; color: #888;">|</span>
          <button data-action="set-all-sheet" style="padding: 4px 8px; font-size: 11px; border: 1px solid #2e7d32; background: #e8f5e9; color: #2e7d32; border-radius: 4px; cursor: pointer;">全部用表格</button>
          <button data-action="set-all-firebase" style="padding: 4px 8px; font-size: 11px; border: 1px solid #1976d2; background: #e3f2fd; color: #1976d2; border-radius: 4px; cursor: pointer;">全部用Firebase</button>
          <span style="font-size: 11px; color: #888;">|</span>
          <button data-action="toggle-all-diffs" style="padding: 4px 8px; font-size: 11px; border: 1px solid #f59e0b; background: #fff7ed; color: #b45309; border-radius: 4px; cursor: pointer;">展开全部差异</button>
          <label style="font-size: 12px; color: #666;">
            <input type="checkbox" id="conflict-show-all-fields"> 显示全部字段
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">选</th>
              <th>批次</th>
              <th>提交人</th>
              <th>文件名</th>
              <th style="text-align: center;">
                <span style="display: inline-flex; align-items: center; gap: 4px;">
                  <span style="width: 8px; height: 8px; background: #1976d2; border-radius: 50%;"></span>
                  Firebase
                </span>
              </th>
              <th style="text-align: center;">
                <span style="display: inline-flex; align-items: center; gap: 4px;">
                  <span style="width: 8px; height: 8px; background: #2e7d32; border-radius: 50%;"></span>
                  表格
                </span>
              </th>
              <th style="width: 80px; text-align: center;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <div class="conflict-modal-footer">
        <button class="btn-close" data-action="close">取消</button>
        <button class="btn-sheet" data-action="apply-selected">应用选中的修改</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 全选复选框
  const selectAllCheckbox = overlay.querySelector('#conflict-select-all');
  selectAllCheckbox?.addEventListener('change', (e) => {
    const checkboxes = overlay.querySelectorAll('.conflict-checkbox');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
  });

  overlay._showAllFields = false;
  overlay._allDiffsExpanded = false;

  const showAllFieldsCheckbox = overlay.querySelector('#conflict-show-all-fields');
  showAllFieldsCheckbox?.addEventListener('change', (e) => {
    overlay._showAllFields = e.target.checked;
    overlay.querySelectorAll('.conflict-diff-row').forEach(row => {
      const rowNumber = row.dataset.row;
      if (!rowNumber) return;
      const conflict = conflictMap.get(rowNumber);
      if (!conflict) return;
      const cell = row.querySelector('td');
      if (cell) {
        cell.innerHTML = renderDiffDetails(conflict, overlay._showAllFields);
      }
    });
  });

  overlay.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;

    if (action === 'close' || e.target === overlay) {
      document.body.removeChild(overlay);
      return;
    }

    // 全部设置为表格
    if (action === 'set-all-sheet') {
      overlay.querySelectorAll('.conflict-choice').forEach(sel => sel.value = 'sheet');
      return;
    }

    // 全部设置为 Firebase
    if (action === 'set-all-firebase') {
      overlay.querySelectorAll('.conflict-choice').forEach(sel => sel.value = 'firebase');
      return;
    }

    if (action === 'toggle-all-diffs') {
      overlay._allDiffsExpanded = !overlay._allDiffsExpanded;
      const targetState = overlay._allDiffsExpanded;
      overlay.querySelectorAll('.conflict-diff-row').forEach(row => {
        row.style.display = targetState ? 'table-row' : 'none';
      });
      overlay.querySelectorAll('.conflict-toggle').forEach(btn => {
        btn.textContent = targetState ? '收起' : (btn.dataset.label || '详情');
      });
      e.target.textContent = targetState ? '收起全部差异' : '展开全部差异';
      return;
    }

    // 应用选中的修改
    if (action === 'apply-selected') {
      const selectedRows = [];
      const checkboxes = overlay.querySelectorAll('.conflict-checkbox:checked');

      checkboxes.forEach(cb => {
        const rowNumber = parseInt(cb.dataset.row, 10);
        const choice = overlay.querySelector(`.conflict-choice[data-row="${rowNumber}"]`)?.value || 'sheet';
        if (choice !== 'skip') {
          selectedRows.push({ rowNumber, choice });
        }
      });

      if (selectedRows.length === 0) {
        appendLog({ status: 'warning', message: '没有选中任何需要修改的记录' });
        return;
      }

      document.body.removeChild(overlay);
      const notif = document.querySelector('.data-conflict-toast');
      if (notif) notif.remove();
      sheetChangeNotificationShown = false;

      // 分组处理
      const useSheet = selectedRows.filter(r => r.choice === 'sheet').map(r => r.rowNumber);
      const useFirebase = selectedRows.filter(r => r.choice === 'firebase').map(r => r.rowNumber);

      appendLog({ status: 'info', message: `正在应用修改: 用表格 ${useSheet.length} 条, 用Firebase ${useFirebase.length} 条` });

      // 用表格数据的行，刷新并覆盖本地
      if (useSheet.length > 0) {
        await loadReviewEntries({ logSuccess: false, forceRefresh: true, skipConflictCheck: true });
        const syncedFiles = (state.fileReviewFiles || []).filter(f => useSheet.includes(f.rowNumber));
        if (syncedFiles.length > 0) {
          await syncSheetDataToFirebase(syncedFiles);
          appendLog({ status: 'success', message: `已同步表格数据到 Firebase ${syncedFiles.length} 条` });
        }
        appendLog({ status: 'success', message: `已用表格数据更新 ${useSheet.length} 条记录` });
      }

      // 用 Firebase 数据的行，需要同步到表格
      if (useFirebase.length > 0 && overlay._conflicts) {
        const firebaseUpdates = overlay._conflicts
          .filter(c => useFirebase.includes(c.rowNumber))
          .map(c => ({
            rowNumber: c.rowNumber,
            status: c.localStatus,
            reviewer: c.localReviewer || '',
            reviewNote: c.localReviewNote || ''
          }));

        if (firebaseUpdates.length > 0) {
          try {
            await window.bridge.batchSaveFileReviewStatus(firebaseUpdates);
            appendLog({ status: 'success', message: `已将 Firebase 数据同步到表格 ${firebaseUpdates.length} 条` });
          } catch (err) {
            appendLog({ status: 'error', message: `同步到表格失败: ${err.message}` });
          }
        }
      }

      // 刷新界面
      await loadFileReviewEntries({ silent: true });
    }

    if (action === 'toggle-diff') {
      const rowNumber = e.target.dataset.row;
      if (!rowNumber) return;
      const diffRow = overlay.querySelector(`.conflict-diff-row[data-row="${rowNumber}"]`);
      if (!diffRow) return;
      const isHidden = diffRow.style.display === 'none' || !diffRow.style.display;
      diffRow.style.display = isHidden ? 'table-row' : 'none';
      e.target.textContent = isHidden ? '收起' : (e.target.dataset.label || '详情');
    }
  });
}

/**
 * 加载按文件审核记录
 * @param {Object} options - 选项
 * @param {boolean} options.logSuccess - 是否记录成功日志
 * @param {boolean} options.silent - 是否静默加载（不显示加载状态）
 * @param {boolean} options.forceRefresh - 是否强制刷新（用户手动点击刷新按钮时）
 * @param {boolean} options.skipConflictCheck - 是否跳过冲突检测
 */
async function loadFileReviewEntries(options = {}) {
  const { logSuccess = false, silent = false, forceRefresh = false, skipConflictCheck = false } = options;

  if (!state.config.sheetId) {
    return;
  }

  if (!window.bridge?.fetchFileReviewEntries) {
    return;
  }

  if (!silent) {
    state.fileReviewLoading = true;
    renderFileReviewEntries();
  }

  try {
    const result = await window.bridge.fetchFileReviewEntries({ groupByBatch: true });
    const newBatches = result.batches || [];
    const newFiles = result.files || [];

    // 🔍 DEBUG: 追踪 reviewNote 数据
    const filesWithNotes = newFiles.filter(f => f.reviewNote);
    if (filesWithNotes.length > 0) {
      console.log('[DEBUG] 从后端获取到的 reviewNote 数据:', filesWithNotes.map(f => ({
        rowNumber: f.rowNumber,
        fileName: f.fileName,
        reviewNote: f.reviewNote
      })));
    } else {
      console.log('[DEBUG] 后端返回的文件中没有 reviewNote 数据');
    }

    // 如果是强制刷新且有本地数据，检查数据冲突
    if (forceRefresh && !skipConflictCheck && state.fileReviewFiles?.length > 0) {
      const conflicts = detectDataConflicts(state.fileReviewFiles, newFiles);
      if (conflicts.length > 0) {
        // 显示冲突提示，让用户选择
        const userChoice = await showDataConflictDialog(conflicts);
        if (userChoice === 'cancel') {
          // 用户取消，不更新数据
          state.fileReviewLoading = false;
          renderFileReviewEntries();
          return;
        } else if (userChoice === 'local') {
          // 用户选择使用本地数据（Firebase），不覆盖
          appendLog({ status: 'info', message: '已保留本地数据' });
          state.fileReviewLoading = false;
          renderFileReviewEntries();
          return;
        }
        // userChoice === 'remote'：使用表格数据，同时同步到 Firebase
        appendLog({ status: 'info', message: `正在将表格数据同步到 Firebase...` });

        // 使用公用函数同步所有字段到 Firebase
        try {
          await syncSheetDataToFirebase(newFiles);
          appendLog({ status: 'success', message: `已同步 ${newFiles.length} 条记录到 Firebase` });
        } catch (syncErr) {
          console.warn('同步到 Firebase 失败:', syncErr);
        }
      }
    }

    // 如果是强制刷新，直接使用远程数据，不合并本地
    const merged = forceRefresh
      ? { files: newFiles, batches: newBatches }
      : mergeFileReviewEntriesWithLocal(newFiles, newBatches);

    const prevBatchNotes = new Map(
      (state.fileReviewBatches || []).map(batch => [batch.batchId, batch.batchNote || ''])
    );
    const prevFileBatchNotes = new Map(
      (state.fileReviewFiles || []).map(file => [file.rowNumber, file.batchNote || ''])
    );
    const noteCache = state.fileReviewBatchNoteCache || new Map();

    merged.files.forEach((file) => {
      if (file.batchNote) {
        noteCache.set(file.batchId, file.batchNote);
        return;
      }
      const cached =
        noteCache.get(file.batchId) ||
        prevFileBatchNotes.get(file.rowNumber) ||
        prevBatchNotes.get(file.batchId);
      if (cached) {
        file.batchNote = cached;
      }
    });

    merged.batches.forEach((batch) => {
      if (!batch.batchNote) {
        const cached = noteCache.get(batch.batchId) || prevBatchNotes.get(batch.batchId);
        if (cached) {
          batch.batchNote = cached;
        }
      }
      if (!batch.batchNote) {
        const source = (batch.files || []).find((file) => file.batchNote);
        if (source) {
          batch.batchNote = source.batchNote;
        }
      }
      if (batch.batchNote) {
        noteCache.set(batch.batchId, batch.batchNote);
      }
    });
    state.fileReviewBatchNoteCache = noteCache;

    applyBatchStatusLocks(merged.batches, merged.files);

    // 处理批次状态变化通知
    handleFileReviewNotifications(merged.batches, state.fileReviewBatches || []);

    state.fileReviewBatches = merged.batches;
    state.fileReviewFiles = merged.files;

    if (logSuccess) {
      appendLog({
        status: 'success',
        message: `已加载 ${state.fileReviewBatches.length} 个批次，共 ${state.fileReviewFiles.length} 个文件`,
        broadcastGlobal: true
      });
    }

    // === Firebase 实时同步初始化 ===
    if (!state.firebaseInitialized && window.bridge?.firebase) {
      initializeFirebaseSync(newFiles);
    }

    // 启动表格数据变动检测
    startSheetChangeDetection();
  } catch (error) {
    appendLog({ status: 'error', message: `加载文件审核记录失败：${error.message}` });
  } finally {
    state.fileReviewLoading = false;
    renderFileReviewEntries();
    // 同时更新"我的审核"面板
    renderSubmitterSuggestions();
  }
}

function parseReviewTimeValue(value) {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return 0;
  let normalized = text.replace(' ', 'T');
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    normalized += 'Z';
  }
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBatchStatus(value) {
  return String(value || '').trim();
}

// ===============================
// 批次状态锁定表（防止刷新覆盖用户刚设置的状态）
// ===============================
const BATCH_STATUS_LOCK_MAX_MS = 120000; // 最长锁定期 120秒（安全阀，防止永久锁定）
const batchStatusLockMap = new Map(); // Map<batchId, { status: string, lockedAt: number, permanent: boolean, pendingRemote?: boolean, confirmedAt?: number }>

/**
 * 锁定批次状态（用户手动修改后调用）
 * @param {string} batchId - 批次ID
 * @param {string} status - 状态值
 * @param {boolean} permanent - 是否永久锁定（直到手动解锁）
 */
function lockBatchStatus(batchId, status, permanent = true) {
  batchStatusLockMap.set(batchId, { status, lockedAt: Date.now(), permanent, pendingRemote: false });
  console.log(`[BatchStatusLock] 锁定批次 ${batchId} 状态为 "${status}"${permanent ? '（等待后端确认）' : ''}`);
}

function markBatchStatusPendingRemote(batchId) {
  const lockInfo = batchStatusLockMap.get(batchId);
  if (!lockInfo) return;
  batchStatusLockMap.set(batchId, {
    ...lockInfo,
    pendingRemote: true
  });
  console.log(`[BatchStatusLock] 等待表格同步确认批次 ${batchId} 状态`);
}

/**
 * 解锁批次状态（后端确认成功后调用）
 * 注意：会延迟一段时间再真正解锁，确保 Google Sheets 同步完成
 */
const UNLOCK_DELAY_MS = 15000; // 延迟 15 秒解锁，确保 Google Sheets 同步完成

function unlockBatchStatus(batchId) {
  if (!batchStatusLockMap.has(batchId)) return;

  const lockInfo = batchStatusLockMap.get(batchId);
  const status = lockInfo?.status || '';

  console.log(`[BatchStatusLock] 后端确认成功，${UNLOCK_DELAY_MS / 1000}秒后解锁批次 ${batchId}`);

  // 将锁转换为非永久锁，但保持一段时间确保同步完成
  batchStatusLockMap.set(batchId, {
    status,
    lockedAt: Date.now(),
    permanent: false,
    confirmedAt: Date.now() // 记录确认时间
  });

  // 延迟解锁
  setTimeout(() => {
    // 确保这段时间内没有新的锁定操作
    const currentLock = batchStatusLockMap.get(batchId);
    if (currentLock && !currentLock.permanent && currentLock.confirmedAt) {
      batchStatusLockMap.delete(batchId);
      console.log(`[BatchStatusLock] 延迟解锁完成，批次 ${batchId} 已解锁`);

      // 清除渲染缓存，强制下次渲染更新
      state._lastReviewRenderSignature = null;

      // 刷新UI
      renderFileReviewEntries();
    }
  }, UNLOCK_DELAY_MS);
}


/**
 * 获取批次的锁定状态（如果在锁定期内）
 */
function getLockedBatchStatus(batchId) {
  const lock = batchStatusLockMap.get(batchId);
  if (!lock) return null;

  const elapsed = Date.now() - lock.lockedAt;

  // 永久锁不过期（但有最大时间限制作为安全阀）
  if (lock.permanent && elapsed < BATCH_STATUS_LOCK_MAX_MS) {
    return lock.status;
  }

  // 已确认但延迟解锁的状态（保持锁定直到 UNLOCK_DELAY_MS 后 setTimeout 解锁）
  if (lock.confirmedAt && elapsed < UNLOCK_DELAY_MS) {
    return lock.status;
  }

  // 非永久锁或超时，清理
  if (elapsed >= BATCH_STATUS_LOCK_MAX_MS) {
    console.warn(`[BatchStatusLock] 批次 ${batchId} 锁已超时（${BATCH_STATUS_LOCK_MAX_MS / 1000}秒），自动解锁`);
    batchStatusLockMap.delete(batchId);
  }

  return null;
}

/**
 * 清理所有过期的批次状态锁
 */
function cleanupExpiredBatchLocks() {
  const now = Date.now();
  for (const [batchId, lock] of batchStatusLockMap) {
    if (now - lock.lockedAt >= BATCH_STATUS_LOCK_MAX_MS) {
      batchStatusLockMap.delete(batchId);
    }
  }
}

// ===============================
// 批次入库锁定表（入库中显示遮罩）
// ===============================
const BATCH_STORE_LOCK_MAX_MS = 300000; // 最长锁定期 5 分钟（安全阀，防止永久锁定）
const batchStoreLockMap = new Map(); // Map<batchId, { mode: string, lockedAt: number, message: string }>

function lockBatchStore(batchId, mode = 'final') {
  if (!batchId) return;
  const modeLabel = mode === 'partial' ? '部分入库' : '最终入库';
  batchStoreLockMap.set(batchId, {
    mode,
    lockedAt: Date.now(),
    message: `正在${modeLabel}...`
  });
  console.log(`[BatchStoreLock] 锁定批次 ${batchId}，${modeLabel}`);
}

function unlockBatchStore(batchId) {
  if (!batchId || !batchStoreLockMap.has(batchId)) return;
  batchStoreLockMap.delete(batchId);
  console.log(`[BatchStoreLock] 批次 ${batchId} 入库结束，解除锁定`);
}

function getBatchStoreLock(batchId) {
  if (!batchId) return null;
  const lock = batchStoreLockMap.get(batchId);
  if (!lock) return null;
  const elapsed = Date.now() - lock.lockedAt;
  if (elapsed >= BATCH_STORE_LOCK_MAX_MS) {
    console.warn(`[BatchStoreLock] 批次 ${batchId} 入库锁超时（${BATCH_STORE_LOCK_MAX_MS / 1000}秒），自动解锁`);
    batchStoreLockMap.delete(batchId);
    return null;
  }
  return lock;
}

function cleanupExpiredBatchStoreLocks() {
  const now = Date.now();
  for (const [batchId, lock] of batchStoreLockMap) {
    if (now - lock.lockedAt >= BATCH_STORE_LOCK_MAX_MS) {
      batchStoreLockMap.delete(batchId);
    }
  }
}

function applyBatchStatusLocks(batches = [], files = []) {
  cleanupExpiredBatchLocks();
  if (!Array.isArray(batches) && !Array.isArray(files)) return;

  const lockedByBatch = new Map();

  batches.forEach((batch) => {
    const batchId = batch.batchId;
    if (!batchId) return;

    const lockedStatus = getLockedBatchStatus(batchId);
    if (lockedStatus === null) return;

    const lockInfo = batchStatusLockMap.get(batchId);
    const remoteStatus = normalizeBatchStatus(batch.batchStatus);
    if (lockInfo?.pendingRemote && remoteStatus && normalizeBatchStatus(lockedStatus) === remoteStatus) {
      unlockBatchStatus(batchId);
    }

    lockedByBatch.set(batchId, lockedStatus);
    batch.batchStatus = lockedStatus;
    batch.files?.forEach((file) => {
      file.batchStatus = lockedStatus;
    });
  });

  if (lockedByBatch.size > 0 && Array.isArray(files)) {
    files.forEach((file) => {
      const lockedStatus = lockedByBatch.get(file.batchId);
      if (lockedStatus !== undefined) {
        file.batchStatus = lockedStatus;
      }
    });
  }
}

/**
 * 显示批次状态更新的 Toast 提示
 */
function showBatchStatusToast(batchId, status, type = 'success') {
  let toast = document.querySelector('.batch-status-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'batch-status-toast';
    document.body.appendChild(toast);
  }

  let message = '';
  let icon = '';

  switch (type) {
    case 'saving':
      icon = '⏳';
      message = `正在保存批次状态...`;
      break;
    case 'success':
      icon = '✅';
      message = `批次状态已保存：${status || '自动'}`;
      break;
    case 'error':
      icon = '❌';
      message = `状态保存失败，已恢复原状态`;
      break;
  }

  toast.textContent = `${icon} ${message}`;
  toast.className = `batch-status-toast show ${type}`;

  // 成功和失败提示 3 秒后消失，保存中不自动消失
  if (type !== 'saving') {
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}


function mergeFileReviewEntriesWithLocal(newFiles = [], newBatches = []) {
  // 先清理过期锁
  cleanupExpiredBatchLocks();

  const localFiles = Array.isArray(state.fileReviewFiles) ? state.fileReviewFiles : [];
  if (!localFiles.length) {
    return { files: newFiles, batches: newBatches };
  }

  const localMap = new Map(localFiles.map(file => [file.rowNumber, file]));
  const now = Date.now();
  const PROTECT_WINDOW_MS = 10000; // 10秒保护窗口

  const mergedFiles = newFiles.map((file) => {
    const local = localMap.get(file.rowNumber);
    if (!local) return file;

    // 检查本地是否有最近的修改（保护窗口内）
    // 如果本地刚刚修改过，优先使用本地数据，避免刷新覆盖
    if (local._localModifiedAt && (now - local._localModifiedAt) < PROTECT_WINDOW_MS) {
      return {
        ...file,
        status: local.status,
        reviewer: local.reviewer,
        // reviewNote: 取更新的值（远程可能有审核人新添加的备注）
        reviewNote: file.reviewNote || local.reviewNote,
        reviewTime: local.reviewTime,
        batchNote: local.batchNote || file.batchNote,
        annotatedFileId: local.annotatedFileId || file.annotatedFileId,
        annotatedTime: local.annotatedTime || file.annotatedTime,
        _localModifiedAt: local._localModifiedAt
      };
    }

    const localTime = parseReviewTimeValue(local.reviewTime);
    const remoteTime = parseReviewTimeValue(file.reviewTime);
    if (localTime && (!remoteTime || localTime > remoteTime)) {
      return {
        ...file,
        status: local.status,
        reviewer: local.reviewer,
        // reviewNote: 优先使用远程值（审核人可能已添加备注）
        reviewNote: file.reviewNote || local.reviewNote,
        reviewTime: local.reviewTime,
        batchNote: local.batchNote || file.batchNote,
        annotatedFileId: local.annotatedFileId || file.annotatedFileId,
        annotatedTime: local.annotatedTime || file.annotatedTime
      };
    }

    // 其他字段的合并：确保 reviewNote 不被覆盖
    const mergedFile = { ...file };
    if (local.batchNote && !file.batchNote) {
      mergedFile.batchNote = local.batchNote;
    }
    if (local.annotatedFileId && !file.annotatedFileId) {
      mergedFile.annotatedFileId = local.annotatedFileId;
      mergedFile.annotatedTime = local.annotatedTime || file.annotatedTime;
    }
    // reviewNote: 保留非空值
    if (!mergedFile.reviewNote && local.reviewNote) {
      mergedFile.reviewNote = local.reviewNote;
    }
    return mergedFile;
  });

  const mergedMap = new Map(mergedFiles.map(file => [file.rowNumber, file]));

  // 获取本地批次状态用于保护
  const localBatchStatusMap = new Map(
    (Array.isArray(state.fileReviewBatches) ? state.fileReviewBatches : []).map(b => [b.batchId, b.batchStatus || ''])
  );

  if (Array.isArray(newBatches)) {
    newBatches.forEach((batch) => {
      if (!Array.isArray(batch.files)) return;
      const counts = { total: 0, pending: 0, approved: 0, rejected: 0, stored: 0 };

      batch.files.forEach((file) => {
        const merged = mergedMap.get(file.rowNumber);
        if (merged) {
          file.status = merged.status;
          file.reviewer = merged.reviewer;
          file.reviewNote = merged.reviewNote;
          file.reviewTime = merged.reviewTime;
        }

        counts.total += 1;
        switch (file.status) {
          case FILE_REVIEW_STATUS.APPROVED:
            counts.approved += 1;
            break;
          case FILE_REVIEW_STATUS.REJECTED:
            counts.rejected += 1;
            break;
          case FILE_REVIEW_STATUS.STORED:
            counts.stored += 1;
            break;
          default:
            counts.pending += 1;
            break;
        }
      });

      batch.counts = counts;
      if (counts.stored === counts.total) {
        batch.status = FILE_REVIEW_STATUS.STORED;
      } else if (counts.approved === counts.total) {
        batch.status = FILE_REVIEW_STATUS.APPROVED;
      } else if (counts.rejected > 0) {
        batch.status = FILE_REVIEW_STATUS.REJECTED;
      } else {
        batch.status = FILE_REVIEW_STATUS.PENDING;
      }

      // 没有锁定时，如果本地有状态而远程为空，保留本地状态
      const localStatus = localBatchStatusMap.get(batch.batchId);
      if (!batchStatusLockMap.has(batch.batchId) && localStatus && !batch.batchStatus) {
        batch.batchStatus = localStatus;
      }
    });
  }

  return { files: mergedFiles, batches: newBatches };
}

/**
 * 初始化 Firebase 实时同步
 */
let firebaseInitializing = false; // 防止重复初始化的锁
async function initializeFirebaseSync(initialFiles) {
  // 如果已初始化或正在初始化，直接返回
  if (state.firebaseInitialized || firebaseInitializing) {
    return;
  }

  firebaseInitializing = true; // 设置锁
  console.log('[Firebase] 开始初始化...');

  if (!window.bridge?.firebase) {
    console.log('[Firebase] bridge.firebase 不存在，跳过');
    firebaseInitializing = false;
    return;
  }

  if (!state.config.sheetId) {
    console.log('[Firebase] sheetId 未配置，跳过');
    firebaseInitializing = false; // 释放锁
    return;
  }

  try {
    // 检查 Firebase 是否可用
    const isReady = await window.bridge.firebase.isReady();
    console.log('[Firebase] isReady:', isReady);

    if (!isReady) {
      console.log('[Firebase] 服务未就绪，跳过实时同步');
      notifyFirebaseAuthRequired('initialize: isReady false');
      return;
    }

    const sheetId = state.config.sheetId;
    console.log('[Firebase] 初始化实时同步，sheetId:', sheetId);

    // 尝试导入数据，但不阻塞主流程
    try {
      const existingData = await window.bridge.firebase.getReviews(sheetId);
      console.log('[Firebase] 现有数据:', existingData.files?.length || 0, '条');

      if (!existingData.files || existingData.files.length === 0) {
        console.log('[Firebase] Firebase 为空，开始导入 Sheets 数据...');
        const importResult = await window.bridge.firebase.importFromSheets(sheetId);
        console.log('[Firebase] 导入结果:', importResult);
      }
    } catch (importError) {
      console.warn('[Firebase] 数据导入失败（继续使用）:', importError.message);
    }

    // 开始监听审核数据变化
    try {
      await window.bridge.firebase.watchReviews(sheetId);
      console.log('[Firebase] 监听已启动');
    } catch (watchError) {
      console.warn('[Firebase] 监听启动失败:', watchError.message);
    }

    // 设置实时更新回调
    window.bridge.firebase.onReviewUpdate((update) => {
      console.log('[Firebase] 收到更新:', update.type, update.files?.length || 0, '条');
      if (update.type === 'update' && update.sheetId === sheetId) {
        applyFirebaseUpdate(update);
      }
    });

    state.firebaseInitialized = true;
    state.firebaseSheetId = sheetId;
    console.log('[Firebase] ✅ 实时同步已启动');

    // 显示 Firebase 连接状态
    updateFirebaseStatusIndicator(true);

  } catch (error) {
    console.error('[Firebase] 初始化失败:', error);
    firebaseInitializing = false; // 释放锁，允许重试
  }
}


/**
 * 应用 Firebase 实时更新
 */
function applyFirebaseUpdate(update) {
  if (!update.files || !update.files.length) {
    return;
  }

  // 关键修复：使用正确的 state.currentUserEmail（之前错误地使用 state.userEmail）
  const currentUserEmail = state.currentUserEmail || '';
  let hasRemoteUpdate = false;
  let updatedCount = 0;
  let skippedCount = 0;
  let staleSkipped = 0;

  console.log('[applyFirebaseUpdate] 收到更新:', update.files.length, '条, 当前用户:', currentUserEmail);

  update.files.forEach(file => {
    const rowNumber = file.rowNumber;
    const modifiedBy = file._modifiedBy || '';

    // ===== Loopback Suppression（环回抑制）=====
    // 如果更新来自自己，直接跳过，避免覆盖本地乐观更新
    if (modifiedBy && currentUserEmail && modifiedBy === currentUserEmail) {
      skippedCount++;
      // console.log('[applyFirebaseUpdate] 跳过自身更新: row', rowNumber, 'modifiedBy:', modifiedBy);
      return; // 关键：跳过自己的更新
    }

    // 更新本地文件状态
    const fileInState = state.fileReviewFiles?.find(f => f.rowNumber === rowNumber);
    if (fileInState) {
      const localTime = parseReviewTimeValue(fileInState.reviewTime);
      const remoteTime = parseReviewTimeValue(file.reviewTime);
      if (localTime && (!remoteTime || localTime > remoteTime)) {
        staleSkipped++;
        return;
      }
      const batchId = (file.batchId || fileInState.batchId || '').trim();
      const lockedStatus = batchId ? getLockedBatchStatus(batchId) : null;
      const lockInfo = batchId ? batchStatusLockMap.get(batchId) : null;
      const remoteBatchStatus = file.batchStatus;
      const normalizedRemoteBatchStatus = normalizeBatchStatus(remoteBatchStatus);
      const normalizedLockedStatus = normalizeBatchStatus(lockedStatus);
      const canApplyBatchStatus =
        remoteBatchStatus !== undefined &&
        (!lockedStatus || normalizedRemoteBatchStatus === normalizedLockedStatus);

      if (
        lockInfo?.pendingRemote &&
        canApplyBatchStatus &&
        normalizedRemoteBatchStatus &&
        normalizedRemoteBatchStatus === normalizedLockedStatus
      ) {
        unlockBatchStatus(batchId);
      }

      // 🔴 注意：hasRemoteUpdate 的判断移到了数据变化检查内部
      // 只有数据真正变化时才认为是远程更新
      const isFromOtherUser = modifiedBy && modifiedBy !== 'anonymous' && modifiedBy !== currentUserEmail;

      const statusChanged = fileInState.status !== file.status;

      // 只在状态或关键字段变化时更新
      if (statusChanged ||
        fileInState.reviewer !== file.reviewer ||
        fileInState.reviewNote !== file.reviewNote ||
        (canApplyBatchStatus && fileInState.batchStatus !== file.batchStatus) ||
        fileInState.batchNote !== file.batchNote ||
        fileInState.taskType !== file.taskType ||
        fileInState.mainCategory !== file.mainCategory ||
        fileInState.subCategory !== file.subCategory ||
        fileInState.admin !== file.admin ||
        fileInState.renamePattern !== file.renamePattern ||
        fileInState.folderPattern !== file.folderPattern ||
        fileInState.namingMetadata !== file.namingMetadata ||
        fileInState.targetFolderId !== file.targetFolderId) {

        // 🔴 关键修复：只有数据真正变化且来自其他用户时，才认为是远程更新
        if (isFromOtherUser) {
          console.log('[applyFirebaseUpdate] 检测到其他用户的实际更新: row', rowNumber, file.status, 'by:', modifiedBy);
          hasRemoteUpdate = true;
        }

        console.log('[applyFirebaseUpdate] 应用更新: row', rowNumber, file.status, 'by:', modifiedBy);
        updatedCount++;

        fileInState.status = file.status;
        fileInState.reviewer = file.reviewer || fileInState.reviewer;
        // reviewNote: 如果远程有值就用远程，否则保留本地
        if (file.reviewNote !== undefined) {
          fileInState.reviewNote = file.reviewNote;
        }
        fileInState.reviewTime = file.reviewTime || fileInState.reviewTime;
        if (canApplyBatchStatus) fileInState.batchStatus = remoteBatchStatus || '';
        if (file.batchNote !== undefined) fileInState.batchNote = file.batchNote || '';
        if (file.taskType !== undefined) fileInState.taskType = file.taskType || '';
        if (file.mainCategory !== undefined) fileInState.mainCategory = file.mainCategory || '';
        if (file.subCategory !== undefined) fileInState.subCategory = file.subCategory || '';
        if (file.admin !== undefined) fileInState.admin = file.admin || '';
        if (file.renamePattern !== undefined) fileInState.renamePattern = file.renamePattern || '';
        if (file.folderPattern !== undefined) fileInState.folderPattern = file.folderPattern || '';
        if (file.namingMetadata !== undefined) fileInState.namingMetadata = file.namingMetadata || '';
        if (file.targetFolderId !== undefined) fileInState.targetFolderId = file.targetFolderId || '';

        // 更新批次中的文件
        state.fileReviewBatches?.forEach(batch => {
          const fileInBatch = batch.files?.find(f => f.rowNumber === rowNumber);
          if (fileInBatch) {
            fileInBatch.status = file.status;
            fileInBatch.reviewer = file.reviewer || fileInBatch.reviewer;
            // reviewNote: 同样的逻辑
            if (file.reviewNote !== undefined) {
              fileInBatch.reviewNote = file.reviewNote;
            }
            fileInBatch.reviewTime = file.reviewTime || fileInBatch.reviewTime;
            if (canApplyBatchStatus) fileInBatch.batchStatus = remoteBatchStatus || '';
            if (file.batchNote !== undefined) fileInBatch.batchNote = file.batchNote || '';
            if (file.taskType !== undefined) fileInBatch.taskType = file.taskType || '';
            if (file.mainCategory !== undefined) fileInBatch.mainCategory = file.mainCategory || '';
            if (file.subCategory !== undefined) fileInBatch.subCategory = file.subCategory || '';
            if (file.admin !== undefined) fileInBatch.admin = file.admin || '';
            if (file.renamePattern !== undefined) fileInBatch.renamePattern = file.renamePattern || '';
            if (file.folderPattern !== undefined) fileInBatch.folderPattern = file.folderPattern || '';
            if (file.namingMetadata !== undefined) fileInBatch.namingMetadata = file.namingMetadata || '';
            if (file.targetFolderId !== undefined) fileInBatch.targetFolderId = file.targetFolderId || '';
            if (canApplyBatchStatus) batch.batchStatus = remoteBatchStatus || '';
            if (file.batchNote !== undefined) {
              batch.batchNote = file.batchNote || '';
              if (!state.fileReviewBatchNoteCache) {
                state.fileReviewBatchNoteCache = new Map();
              }
              state.fileReviewBatchNoteCache.set(batch.batchId, batch.batchNote);
            }

            // 重新计算批次计数
            const counts = { pending: 0, approved: 0, rejected: 0, stored: 0, total: batch.files.length };
            batch.files.forEach(f => {
              if (f.status === FILE_REVIEW_STATUS.APPROVED) counts.approved++;
              else if (f.status === FILE_REVIEW_STATUS.REJECTED) counts.rejected++;
              else if (f.status === FILE_REVIEW_STATUS.STORED) counts.stored++;
              else counts.pending++;
            });
            batch.counts = counts;
          }
        });

        // 更新 UI（带动画效果）- 仅在状态变化时触发
        if (statusChanged) {
          updateFileStatusUI(rowNumber, file.status, hasRemoteUpdate);
        }
      }
    }
  });

  console.log('[applyFirebaseUpdate] 处理完成: 更新', updatedCount, '条, 跳过自身', skippedCount, '条, 跳过旧数据', staleSkipped, '条');

  // 如果是远程更新，显示通知并同步更新"我的审核"面板
  if (hasRemoteUpdate && updatedCount > 0) {
    showFirebaseUpdateToast();

    // 🔄 关键：同步更新"我的审核"面板，让提交人实时看到审核结果
    // 使用 requestAnimationFrame 避免阻塞当前更新周期
    requestAnimationFrame(() => {
      if (typeof renderSubmitterSuggestions === 'function') {
        console.log('[applyFirebaseUpdate] 同步刷新"我的审核"面板');
        renderSubmitterSuggestions();
      }
    });
  }
}

// 🔴 操作冷却机制：用户自己操作后短时间内不显示远程更新 Toast
let lastUserOperationAt = 0;
const USER_OPERATION_COOLDOWN_MS = 5000; // 5秒冷却时间

/**
 * 标记用户刚刚执行了操作（入库、审核等）
 * 在冷却期内不显示远程更新 Toast，避免用户困惑
 */
function markUserOperation() {
  lastUserOperationAt = Date.now();
}

/**
 * 显示 Firebase 实时更新提示
 */
function showFirebaseUpdateToast() {
  // 🔴 冷却检查：如果用户刚刚执行了操作，不显示 Toast
  const timeSinceLastOperation = Date.now() - lastUserOperationAt;
  if (timeSinceLastOperation < USER_OPERATION_COOLDOWN_MS) {
    console.log('[showFirebaseUpdateToast] 用户刚操作过，跳过 Toast（冷却中）');
    return;
  }

  // 创建 Toast 通知
  let toast = document.querySelector('.firebase-update-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'firebase-update-toast';
    toast.innerHTML = '🔄 有其他用户更新了审核状态';
    document.body.appendChild(toast);
  }

  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * 更新 Firebase 连接状态指示器
 */
function updateFirebaseStatusIndicator(connected) {
  // 可以在 UI 中显示 Firebase 连接状态
  const indicator = document.querySelector('.firebase-status');
  if (indicator) {
    indicator.classList.toggle('connected', connected);
    indicator.classList.toggle('disconnected', !connected);
    indicator.title = connected ? 'Firebase 实时同步已连接' : 'Firebase 未连接';
  }
}

function notifyFirebaseAuthRequired(reason = '') {
  const now = Date.now();
  if (state.firebaseAuthPromptAt && now - state.firebaseAuthPromptAt < 5000) {
    return;
  }
  state.firebaseAuthPromptAt = now;
  updateFirebaseStatusIndicator(false);
  appendLog({
    status: 'error',
    message: 'Firebase 未授权或未连接，请点击“登录 Google”重新授权，确保邮箱已获取权限。',
    broadcastGlobal: true
  });
  if (reason) {
    console.warn('[Firebase] 需要授权或连接:', reason);
  }
}

function ensureFirebaseReadyOrNotify(reason = '') {
  if (window.bridge?.firebase && state.firebaseInitialized && state.firebaseSheetId) {
    return true;
  }
  notifyFirebaseAuthRequired(reason || 'firebase not ready');
  return false;
}

function scheduleReviewStatusSave(rowNumber, params) {
  if (!state.reviewStatusSaveTimers) {
    state.reviewStatusSaveTimers = new Map();
  }
  const existing = state.reviewStatusSaveTimers.get(rowNumber);
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }
  const pending = {
    rowNumber,
    params,
    timer: null
  };
  pending.timer = setTimeout(async () => {
    try {
      await saveReviewStatus(params);
    } catch (error) {
      appendLog({ status: 'error', message: `更新状态失败：${error.message}` });
      await loadFileReviewEntries({ silent: true });
    } finally {
      const current = state.reviewStatusSaveTimers?.get(rowNumber);
      if (current === pending) {
        state.reviewStatusSaveTimers.delete(rowNumber);
      }
    }
  }, 400);
  state.reviewStatusSaveTimers.set(rowNumber, pending);
}

/**
 * 统一的审核状态保存函数 - 同时更新 Firebase 和 Google Sheets
 * @param {Object} params - 保存参数 { rowNumber, status, reviewer, reviewNote }
 */
async function saveReviewStatus(params) {
  const { rowNumber, status, reviewer, reviewNote } = params;

  console.log('[saveReviewStatus] 开始保存, row:', rowNumber);

  // 同时更新 Firebase 和 Google Sheets，确保数据同步
  const promises = [];

  // 1. 更新 Firebase（如果可用）
  if (window.bridge?.firebase) {
    if (!state.firebaseInitialized) {
      await initializeFirebaseSync(state.fileReviewFiles || []);
    }
    if (state.firebaseInitialized && state.firebaseSheetId) {
      const data = { reviewTime: Date.now() };
      if (status !== undefined) data.status = status;
      if (reviewer !== undefined) data.reviewer = reviewer;
      if (reviewNote !== undefined) data.reviewNote = reviewNote;

      promises.push(
        window.bridge.firebase.updateFileStatus(state.firebaseSheetId, rowNumber, data)
          .then(() => console.log('[saveReviewStatus] Firebase 保存完成'))
          .catch(err => console.warn('Firebase 保存失败:', err.message))
      );
    }
  }

  // 2. 同时更新 Google Sheets
  if (window.bridge?.updateFileReviewStatus) {
    promises.push(
      window.bridge.updateFileReviewStatus(params)
        .then(() => console.log('[saveReviewStatus] Google Sheets 保存完成'))
        .catch(err => console.warn('Google Sheets 保存失败:', err.message))
    );
  }

  // 等待所有更新完成
  await Promise.allSettled(promises);
}

/**
 * 统一的批量审核状态保存函数 - 优先使用 Firebase
 * @param {Array} updates - 更新列表 [{ rowNumber, status, reviewer, reviewNote }]
 */
async function batchSaveReviewStatus(updates) {
  if (!updates || !updates.length) return;

  // 同时更新 Firebase 和 Google Sheets，确保数据同步
  const promises = [];

  // 1. 更新 Firebase（如果可用）
  if (window.bridge?.firebase) {
    if (!state.firebaseInitialized) {
      await initializeFirebaseSync(state.fileReviewFiles || []);
    }
    if (state.firebaseInitialized && state.firebaseSheetId) {
      const firebaseUpdates = updates.map(u => ({
        rowNumber: u.rowNumber,
        status: u.status,
        reviewer: u.reviewer,
        reviewNote: u.reviewNote,
        reviewTime: Date.now()
      }));
      promises.push(
        window.bridge.firebase.batchUpdateFileStatus(state.firebaseSheetId, firebaseUpdates)
          .catch(err => console.warn('Firebase 批量更新失败:', err.message))
      );
    }
  }

  // 2. 同时直接更新 Google Sheets（关键修复：避免延迟同步导致的覆盖）
  if (window.bridge?.batchUpdateFileReviewStatus) {
    promises.push(
      window.bridge.batchUpdateFileReviewStatus(updates)
        .catch(err => console.warn('Google Sheets 批量更新失败:', err.message))
    );
  }

  // 等待所有更新完成
  await Promise.allSettled(promises);
}

/**
 * 计算批次数据的签名，用于智能渲染（避免不必要的重新渲染导致闪烁）
 * @param {Array} batches - 批次列表
 * @param {string} statusFilter - 当前状态筛选
 * @returns {string} - 签名字符串
 */
function computeBatchesSignature(batches, statusFilter) {
  if (!batches || !batches.length) return `empty:${statusFilter}`;

  // 收集每个批次的关键信息生成签名
  const batchKeys = batches.map(batch => {
    const files = Array.isArray(batch.files) ? batch.files.slice() : [];
    files.sort((a, b) => {
      const aRow = Number(a?.rowNumber || 0);
      const bRow = Number(b?.rowNumber || 0);
      return aRow - bRow;
    });
    // 包含：批次ID、批次状态、文件数量、每个文件的状态
    const fileStatusStr = files.map(f => `${f.rowNumber}:${f.status || ''}`).join(',');
    const statusLock = batchStatusLockMap.get(batch.batchId);
    const storeLock = getBatchStoreLock(batch.batchId);
    const lockToken = [
      statusLock ? `status:${normalizeBatchStatus(statusLock.status)}${statusLock.pendingRemote ? ':pending' : ''}` : '',
      storeLock ? `store:${storeLock.mode}` : ''
    ].filter(Boolean).join(',');
    return `${batch.batchId}|${batch.batchStatus || ''}|${batch.counts?.total || 0}|${fileStatusStr}|${lockToken}`;
  }).join('||');

  return `${statusFilter}:${batchKeys}`;
}

function isPartialBatchStatus(status) {
  const normalized = normalizeBatchStatus(status);
  return normalized === '一部分已入库，部分需要修改' ||
    normalized === '部分已入库' ||
    normalized === '一部分已入库';
}

/**
 * 渲染按文件审核面板
 */
function renderFileReviewEntries() {
  console.log('🔄 [renderFileReviewEntries] 被调用', new Error().stack?.split('\n').slice(1, 4).join(' ← '));
  const container = elements.reviewList;
  if (!container) return;
  const activeNoteSnapshot = captureActiveNoteInput();
  const selectionSnapshot = state.fileReviewSelections ? new Map(state.fileReviewSelections) : null;

  // 按文件审核模式（唯一模式）

  if (state.fileReviewLoading) {
    container.innerHTML = '<div class="slot-empty">审核数据加载中，请稍候...</div>';
    return;
  }

  const batches = state.fileReviewBatches || [];
  cleanupExpiredBatchLocks();
  cleanupExpiredBatchStoreLocks();

  // ========== 智能渲染：计算批次签名，避免不必要的重新渲染 ==========
  const currentSignature = computeBatchesSignature(batches, state.reviewStatusFilter);

  // 如果签名相同，跳过DOM重建（避免闪烁）
  if (state._lastReviewRenderSignature === currentSignature) {
    // 只更新筛选栏（数量可能变化）
    renderReviewStatusSummary(batches);
    console.log('⏭️ [renderFileReviewEntries] 签名相同，跳过渲染');
    return;
  }
  console.log('🔄 [renderFileReviewEntries] 签名变化，执行渲染');
  state._lastReviewRenderSignature = currentSignature;

  // ========== 状态筛选栏渲染 ==========
  renderReviewStatusSummary(batches);

  // 获取当前筛选状态
  const statusFilter = state.reviewStatusFilter || 'pending';

  // 根据筛选状态过滤批次
  const filteredBatches = batches.filter(batch => {
    if (batch.counts.total === 0) return false;

    const manualStatus = (batch.batchStatus || '').trim();

    switch (statusFilter) {
      case 'pending': // 待审核
        // 🔴 严格筛选：只显示真正的待审核，排除所有其他状态
        if (manualStatus === '已入库' || manualStatus === '已审核通过') return false;
        if (manualStatus === '已完成') return false;
        if (manualStatus === '等待入库') return false;
        if (isPartialBatchStatus(manualStatus)) return false;
        if (manualStatus === '已取消' || manualStatus === '取消审核' || manualStatus === '已取消审核') return false;
        if (manualStatus === '需要修改' || manualStatus === '一部分需要修改' || manualStatus === '需修改') return false;
        return true;
      case 'waiting': // 等待入库
        return manualStatus === '等待入库';
      case 'stored': // 已入库
        return manualStatus === '已入库' || manualStatus === '已审核通过';
      case 'completed': // 已完成
        return manualStatus === '已完成';
      case 'partial': // 一部分入库
        return isPartialBatchStatus(manualStatus);
      case 'allStored': // 所有入库（包含已入库+已完成+部分入库）
        return manualStatus === '已入库' || manualStatus === '已完成' || manualStatus === '已审核通过' ||
          isPartialBatchStatus(manualStatus);
      case 'cancelled': // 已取消
        return manualStatus === '已取消' || manualStatus === '取消审核' || manualStatus === '已取消审核';
      case 'feedback': // 需要修改
        return manualStatus === '需要修改' || manualStatus === '需修改';
      case 'all': // 全部
        return true;
      default:
        return true;
    }
  });

  // 将"已更新修改"的批次置顶，便于审核员快速复审
  // 优先级：整体复审 > 部分复审 > 普通已更新修改 > 其他
  filteredBatches.sort((a, b) => {
    const getUpdatePriority = (status) => {
      const s = (status || '').trim();
      if (s === '已更新修改(整体)') return 3;  // 最高优先级
      if (s === '已更新修改(部分)') return 2;
      if (s.startsWith('已更新修改')) return 1;
      return 0;
    };
    const aUpdated = getUpdatePriority(a.batchStatus);
    const bUpdated = getUpdatePriority(b.batchStatus);
    if (aUpdated !== bUpdated) {
      return bUpdated - aUpdated;
    }
    return (b.submitTime || '').localeCompare(a.submitTime || '');
  });

  if (!filteredBatches.length) {
    const emptyMessages = {
      pending: '暂无待审核记录',
      waiting: '暂无等待入库记录',
      stored: '暂无已入库记录',
      completed: '暂无不需入库已审核完的记录',
      partial: '暂无部分入库记录',
      allStored: '暂无入库记录',
      cancelled: '暂无已取消记录',
      feedback: '暂无需要修改的记录',
      all: '暂无任何记录'
    };
    container.innerHTML = `<div class="slot-empty">${emptyMessages[statusFilter] || '暂无记录'}</div>`;
    return;
  }

  container.innerHTML = filteredBatches.map(batch => {
    // 检查该批次是否正在更新中
    const statusLockInfo = batchStatusLockMap.get(batch.batchId);
    const storeLockInfo = getBatchStoreLock(batch.batchId);
    const isUpdating = Boolean(statusLockInfo || storeLockInfo);
    const updatingStatus = storeLockInfo?.message ||
      (statusLockInfo ? `正在将批次修改为「${statusLockInfo.status || ''}」` : '');
    const updatingHint = storeLockInfo ? '请稍候，正在入库...' : '请稍候，正在写入表格...';

    // 调试日志
    if (isUpdating) {
      console.log(`[renderFileReviewEntries] 批次 ${batch.batchId} 正在更新，显示遮罩层，更新为: ${updatingStatus}`);
    }

    return buildFileReviewBatchCard(batch, { isUpdating, updatingStatus, updatingHint });
  }).join('');

  // 设置事件处理
  setupFileReviewHandlers(container);
  hydrateReviewThumbsFromCache(container);
  restoreFileReviewSelections(container, selectionSnapshot);
  if (activeNoteSnapshot?.inReviewList) {
    restoreActiveNoteInput(activeNoteSnapshot, container);
  }

  // 更新多批次操作工具栏
  updateMultiBatchToolbar();
}

/**
 * 渲染总审核面板的状态筛选栏
 */
function renderReviewStatusSummary(batches) {
  const container = elements.reviewStatusSummary;
  if (!container) return;

  // 统计各状态的批次数量
  const counts = {
    pending: 0,
    waiting: 0,
    stored: 0,
    completed: 0,
    partial: 0,
    cancelled: 0,
    feedback: 0,
    total: 0
  };

  batches.forEach(batch => {
    if (batch.counts.total === 0) return;
    counts.total++;

    const manualStatus = (batch.batchStatus || '').trim();

    if (manualStatus === '已入库' || manualStatus === '已审核通过') {
      counts.stored++;
    } else if (manualStatus === '已完成') {
      counts.completed++;
    } else if (manualStatus === '等待入库') {
      counts.waiting++;
    } else if (isPartialBatchStatus(manualStatus)) {
      counts.partial++;
    } else if (manualStatus === '已取消' || manualStatus === '取消审核' || manualStatus === '已取消审核') {
      counts.cancelled++;
    } else if (manualStatus === '需要修改' || manualStatus === '一部分需要修改') {
      counts.feedback++;
    } else {
      counts.pending++;
    }
  });

  const currentFilter = state.reviewStatusFilter || 'pending';

  const summaryItems = [
    { key: 'pending', label: '待审核', value: counts.pending, className: 'pending' },
    { key: 'feedback', label: '需修改', value: counts.feedback, className: 'feedback' },
    { key: 'partial', label: '已部分入库', value: counts.partial, className: 'partial' },
    { key: 'waiting', label: '等待入库', value: counts.waiting, className: 'waiting' },
    { key: 'stored', label: '已入库', value: counts.stored, className: 'approved' },
    { key: 'completed', label: '不需入库已审核完', value: counts.completed, className: 'completed' },
    { key: 'allStored', label: '所有入库', value: counts.stored + counts.completed + counts.partial, className: 'all-stored' },
    { key: 'cancelled', label: '已取消', value: counts.cancelled, className: 'cancelled' },
    { key: 'all', label: '全部', value: counts.total, className: 'all' }
  ];

  container.innerHTML = summaryItems.map(item => {
    const isActive = currentFilter === item.key;
    const classes = `review-summary-card ${item.className} ${isActive ? 'active' : ''}`;
    return `
      <div class="${classes}" data-status-filter="${item.key}">
        <span class="summary-value">${item.value}</span>
        <span class="summary-label">${item.label}</span>
      </div>
    `;
  }).join('');

  // 绑定点击事件
  container.querySelectorAll('.review-summary-card').forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.dataset.statusFilter;
      setReviewStatusFilter(filter);
    });
  });
}

/**
 * 设置审核面板的状态筛选
 */
function setReviewStatusFilter(filter) {
  state.reviewStatusFilter = filter || 'pending';
  renderFileReviewEntries();
}


function initReviewThumbProgress(container) {
  const cards = container.querySelectorAll('.file-review-batch-card');
  cards.forEach((card) => {
    const batchId = card.dataset.batchId;
    const indicator = card.querySelector(`.thumb-load-indicator[data-batch-id="${batchId}"]`);
    if (!indicator) return;
    const imgs = card.querySelectorAll('.file-card-thumb img');
    const total = imgs.length;
    let loaded = 0;
    let failed = 0;

    const update = () => {
      if (!total) {
        indicator.textContent = '无缩略图';
        indicator.classList.remove('loading', 'warn');
        indicator.classList.add('done');
        return;
      }
      const finished = loaded + failed;
      if (finished >= total) {
        const failText = failed ? `，失败 ${failed}` : '';
        indicator.textContent = `缩略图已完成 ${loaded}/${total}${failText}`;
        indicator.classList.remove('loading');
        indicator.classList.toggle('warn', failed > 0);
        indicator.classList.toggle('done', failed === 0);
        return;
      }
      indicator.textContent = `缩略图加载中 ${finished}/${total}`;
      indicator.classList.add('loading');
      indicator.classList.remove('done', 'warn');
    };

    const markLoaded = (img) => {
      if (img.dataset.thumbState) return;
      img.dataset.thumbState = 'loaded';
      loaded += 1;
      update();
    };

    const markFailed = (img) => {
      if (img.dataset.thumbState) return;
      img.dataset.thumbState = 'failed';
      failed += 1;
      update();
    };

    imgs.forEach((img) => {
      if (img.dataset.thumbTracked) return;
      img.dataset.thumbTracked = '1';
      if (img.complete) {
        if (img.naturalWidth > 0) {
          markLoaded(img);
        } else {
          markFailed(img);
        }
      }
      img.addEventListener('load', () => markLoaded(img), { once: true });
      img.addEventListener('error', () => markFailed(img), { once: true });
    });

    update();
  });
}

/**
 * 构建按文件审核的批次卡片
 * 分为5个清晰的区块：审核信息区、文件夹链接区、文件审核区、参考区、审核状态区
 */
function buildFileReviewBatchCard(batch, options = {}) {
  const { isUpdating = false, updatingStatus = '', updatingHint = '' } = options;
  const statusClass = getFileReviewStatusClass(batch.status);
  const statusLabel = batch.status || FILE_REVIEW_STATUS.PENDING;
  const batchNoteInputValue = getBatchNoteInputValue(batch);
  const finalFolderName = getBatchFinalFolderName(batch);
  const namingDisplay = getBatchNamingDisplay(batch);
  const namingMetadata = parseNamingMetadataSafe(batch.namingMetadata);
  const adminValue = batch.admin || namingMetadata.admin || '';
  const adminName = adminValue || '-';

  // 读取保存的视图大小偏好（提前读取以便在HTML中使用）
  const viewPrefs = JSON.parse(localStorage.getItem('batchViewSizePrefs') || '{}');

  // 固定区域高度方案：根据图片数量计算最佳的图片大小
  // 目标是让所有图片在约 200px 高度内显示完整
  const fileCount = batch.files?.length || 0;
  const GRID_MAX_HEIGHT = 200; // 目标最大高度
  const GRID_GAP = 8; // 网格间距

  // 假设区域宽度约 600px，计算每行能放多少张图
  // 根据图片数量自动选择合适的尺寸
  let autoViewSize = 'large'; // 110px
  if (fileCount > 12) {
    autoViewSize = 'medium'; // 80px，约8列，2行可放16张
  }
  if (fileCount > 24) {
    autoViewSize = 'small'; // 56px，约11列，3行可放33张
  }

  // 优先使用用户手动设置的偏好，否则使用自动计算的大小
  const savedViewSize = viewPrefs[batch.batchId] || autoViewSize;

  // 批次的手动状态（审核员可以设置）
  const manualStatus = batch.batchStatus || '';
  const displayStatus = manualStatus || getBatchOverallStatus(batch);
  const displayStatusClass = manualStatus ? getBatchManualStatusClass(manualStatus) : getBatchOverallStatusClass(batch);

  // 审核员可选的状态列表
  const reviewerStatusOptions = [
    { value: '待审核', label: '待审核' },
    { value: '需要修改', label: '需要修改' },
    { value: '一部分已入库，部分需要修改', label: '一部分已入库，部分需要修改' },
    { value: '等待入库', label: '等待入库' },
    { value: '已入库', label: '已入库' },
    { value: '已完成', label: '不需入库已审核完' },
    { value: '已取消', label: '取消审核' }
  ];

  // 生成状态来源提示（仅用于"已更新修改"状态）
  let statusSourceHint = '';
  if (displayStatus === '已更新修改(整体)') {
    statusSourceHint = '<span class="status-source-hint hint-full" title="之前状态为&quot;需要修改&quot;，整体文件需要重新审核">🔴 整体重审</span>';
  } else if (displayStatus === '已更新修改(部分)') {
    statusSourceHint = '<span class="status-source-hint hint-partial" title="之前状态为&quot;一部分需要修改&quot;，补充的文件需要审核">🟠 补充待审</span>';
  }

  // ========== 1. 审核信息区 ==========
  const infoSectionHtml = `
    <div class="review-section review-info-section">
      <div class="review-section-header">
        <label class="batch-multi-select-wrapper" onclick="event.stopPropagation()">
          <input type="checkbox" class="batch-multi-checkbox" data-batch-id="${batch.batchId}" title="选择此批次进行批量操作" />
        </label>
        <span class="review-section-icon">📋</span>
        <span class="review-section-title">审核信息</span>
        <span class="batch-status ${displayStatusClass}">${displayStatus}</span>
        ${statusSourceHint}
        <button class="btn-edit-batch-settings" data-batch-id="${batch.batchId}" title="修改批次设置">✏️ 修改设置</button>
      </div>
      <div class="review-info-grid">
        <div class="review-info-item">
          <span class="info-label">批次ID</span>
          <span class="info-value batch-id-value">${escapeHtml(batch.batchId)}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">提交人</span>
          <span class="info-value">${escapeHtml(batch.submitter)}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">管理员</span>
          <span class="info-value">${escapeHtml(adminName)}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">入库分类</span>
          <span class="info-value">${escapeHtml(batch.mainCategory)} / ${escapeHtml(batch.subCategory)}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">任务类型</span>
          <span class="info-value">${escapeHtml(getBatchTaskType(batch) || '-')}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">最终文件夹名</span>
          <span class="info-value">${escapeHtml(finalFolderName)}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">文件命名</span>
          <span class="info-value">${namingDisplay ? escapeHtml(namingDisplay) : '-'}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">提交时间</span>
          <span class="info-value">${batch.submitTime || '-'}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">文件统计</span>
          <span class="info-value">
            共 <strong>${batch.counts.total}</strong> 个：
            <span class="count-pending">待审 ${batch.counts.pending}</span> |
            <span class="count-approved">合格 ${batch.counts.approved}</span> |
            <span class="count-rejected">不合格 ${batch.counts.rejected}</span> |
            <span class="count-stored">已入库 ${batch.counts.stored}</span>
          </span>
        </div>
      </div>
    </div>
  `;

  // ========== 2. 文件夹链接区 ==========
  const batchTaskType = getBatchTaskType(batch) || '';
  const hasLinks = batch.tempFolderLink || batch.finalFolderLink;
  const isCompleted = manualStatus === '已完成'; // 不需入库已审核完

  // 如果有链接或者是已完成状态，都显示这个区域
  const linksSectionHtml = (hasLinks || isCompleted) ? `
    <div class="review-section review-links-section">
      <div class="review-section-header">
        <span class="review-section-icon">🔗</span>
        <span class="review-section-title">文件夹链接</span>
      </div>
      <div class="review-links-grid">
        ${batch.tempFolderLink ? `
          <button class="folder-link-btn temp-folder open-external-link" 
                  data-url="${batch.tempFolderLink}" 
                  title="点击在浏览器中打开待审目录">
            <span class="folder-icon">📁</span>
            <span class="folder-info">
              <span class="folder-type">待审目录</span>
              <span class="folder-hint">上传的原始文件</span>
            </span>
            <span class="open-icon">↗</span>
          </button>
        ` : ''}
        ${batch.finalFolderLink ? `
          <button class="folder-link-btn final-folder open-external-link" 
                  data-url="${batch.finalFolderLink}" 
                  title="点击在浏览器中打开入库目录">
            <span class="folder-icon">📂</span>
            <span class="folder-info">
              <span class="folder-type">入库目录</span>
              <span class="folder-hint">${batch.counts.stored > 0 ? '已入库 ' + batch.counts.stored + ' 个文件' : '审核通过后归档'}</span>
            </span>
            <span class="open-icon">↗</span>
          </button>
        ` : ''}
        ${isCompleted && !batch.finalFolderLink ? `
          <div class="folder-link-placeholder">
            <span class="folder-icon">✅</span>
            <span class="folder-info">
              <span class="folder-type">无需入库</span>
              <span class="folder-hint">已审核完成，无需入库操作</span>
            </span>
          </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  // ========== 3. 文件审核区 ==========
  const sortedFiles = Array.isArray(batch.files) ? batch.files.slice() : [];
  sortedFiles.sort((a, b) => {
    const aRow = Number(a?.rowNumber || 0);
    const bRow = Number(b?.rowNumber || 0);
    return aRow - bRow;
  });
  const filesHtml = sortedFiles.map((file, index) => {
    const fileStatusClass = getFileReviewStatusClass(file.status);
    const isChecked = file.status === FILE_REVIEW_STATUS.APPROVED || file.status === FILE_REVIEW_STATUS.STORED;
    const isRejected = file.status === FILE_REVIEW_STATUS.REJECTED;
    const isDiscarded = file.status === FILE_REVIEW_STATUS.DISCARDED;
    const isStored = file.status === FILE_REVIEW_STATUS.STORED;
    const statusIcon = isStored ? '📦' : (isDiscarded ? '🗑️' : (isChecked ? '✓' : (isRejected ? '✗' : '○')));
    const previewFileId = getReviewPreviewFileId(file);

    return `
      <div class="file-card ${fileStatusClass}" data-file-id="${file.fileId}" data-row="${file.rowNumber}">
        <div class="file-card-thumb file-preview-trigger" 
             data-file-id="${file.fileId}" 
             data-preview-id="${previewFileId}"
             data-file-name="${escapeHtml(file.fileName)}"
             data-file-link="${file.fileLink}"
             data-row="${file.rowNumber}">
          <img src="https://drive.google.com/thumbnail?id=${previewFileId}&sz=w200&t=${encodeURIComponent(file.annotatedTime || file.reviewTime || file.submitTime || file.rowNumber || file.fileId || '')}" 
               loading="eager"
               decoding="async"
               onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><rect fill=\\'%23e2e8f0\\' width=\\'24\\' height=\\'24\\'/><text x=\\'12\\' y=\\'14\\' text-anchor=\\'middle\\' fill=\\'%2394a3b8\\' font-size=\\'8\\'>文件</text></svg>'" 
               alt="${escapeHtml(file.fileName)}" />
          <span class="file-card-status-badge ${fileStatusClass}">${statusIcon}</span>
          
          <!-- 悬浮操作栏 -->
          <div class="file-card-actions" onclick="event.stopPropagation()">
            <button class="file-card-btn ${isChecked ? 'active' : ''}" 
                    data-action="approve" data-row="${file.rowNumber}" 
                    title="合格" ${isStored || isDiscarded ? 'disabled' : ''}>✓</button>
            <button class="file-card-btn ${isRejected ? 'active reject' : ''}" 
                    data-action="reject" data-row="${file.rowNumber}" 
                    title="不合格" ${isStored || isDiscarded ? 'disabled' : ''}>✗</button>
            <button class="file-card-btn ${isDiscarded ? 'active discard' : ''}" 
                    data-action="discard" data-row="${file.rowNumber}" 
                    title="作废（不用修改）" ${isStored ? 'disabled' : ''}>🗑️</button>
            <button class="file-card-btn" 
                    data-action="replace" data-row="${file.rowNumber}" 
                    data-file-id="${file.fileId}" data-file-name="${escapeHtml(file.fileName)}"
                    data-temp-folder-link="${escapeHtml(batch.tempFolderLink || '')}"
                    data-batch-id="${escapeHtml(batch.batchId || '')}"
                    title="替换">🔄</button>
            <button class="file-card-btn delete" 
                    data-action="delete" data-row="${file.rowNumber}" 
                    data-file-id="${file.fileId}" data-file-name="${escapeHtml(file.fileName)}"
                    data-batch-id="${escapeHtml(batch.batchId || '')}"
                    title="删除" ${isStored ? 'disabled' : ''}>🗑</button>
            <button class="file-card-btn" 
                    data-action="open" data-url="${file.fileLink}"
                    title="在浏览器中打开">↗</button>
          </div>
        </div>
        
        <input type="text" 
               class="file-card-note-input" 
               placeholder="建议..." 
               data-row="${file.rowNumber}"
               data-file-id="${file.fileId}"
               value="${escapeHtml(file.reviewNote || '')}"
               onclick="event.stopPropagation()"
               ${isStored || isDiscarded ? 'disabled' : ''} />
      </div>
    `;
  }).join('');

  const filesSectionHtml = `
    <div class="review-section review-files-section">
      <div class="review-section-header">
        <span class="review-section-icon">📄</span>
        <span class="review-section-title">待审核文件 (${batch.files?.length || 0})</span>
        <div class="review-section-toolbar">
          <div class="view-size-toggle" data-batch-id="${batch.batchId}" title="切换缩略图大小">
            <button class="view-size-btn${savedViewSize === 'large' ? ' active' : ''}" data-size="large" title="大图">◆</button>
            <button class="view-size-btn${savedViewSize === 'medium' ? ' active' : ''}" data-size="medium" title="中图">🔸</button>
            <button class="view-size-btn${savedViewSize === 'small' ? ' active' : ''}" data-size="small" title="小图">🔹</button>
          </div>
          <button class="btn-tile-view" data-batch-id="${batch.batchId}" title="平铺查看模式 - 类似 PureRef 的大图平铺预览">📐 平铺</button>
          <span class="toolbar-divider"></span>
          <button class="btn-select-all" data-batch-id="${batch.batchId}" title="全选">☑ 全选</button>
          <button class="btn-select-invert" data-batch-id="${batch.batchId}" title="反选">⇄ 反选</button>
          <button class="btn-select-rejected" data-batch-id="${batch.batchId}" title="选中所有不合格文件">✗ 选不合格</button>
          <button class="btn-select-none" data-batch-id="${batch.batchId}" title="取消全选">☐ 取消</button>
          <span class="selection-count" data-batch-id="${batch.batchId}">已选 0 个</span>
        </div>
      </div>
      <div class="file-review-files-grid">
        ${filesHtml}
      </div>
    </div>
  `;

  // ========== 4. 参考区（支持延迟加载）==========
  const referenceFiles = batch.referenceFiles || [];
  const referenceFilesLoaded = batch.referenceFilesLoaded === true;

  let referenceFilesHtml;
  if (referenceFilesLoaded) {
    // 已加载：显示文件列表
    referenceFilesHtml = referenceFiles.length > 0
      ? referenceFiles.map(file => `
          <div class="reference-file-item file-preview-trigger" 
               data-file-id="${file.fileId}" 
               data-preview-id="${file.fileId}"
               data-file-name="${escapeHtml(file.fileName)}"
               data-file-link="${file.fileLink}">
            <img src="https://drive.google.com/thumbnail?id=${file.fileId}&sz=w80" 
                 loading="eager"
                 decoding="async"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><rect fill=\\'%23e2e8f0\\' width=\\'24\\' height=\\'24\\'/><text x=\\'12\\' y=\\'14\\' text-anchor=\\'middle\\' fill=\\'%2394a3b8\\' font-size=\\'6\\'>参考</text></svg>'" 
                 alt="${escapeHtml(file.fileName)}" 
                 title="${escapeHtml(file.fileName)}" />
          </div>
        `).join('')
      : '<div class="reference-empty">暂无参考文件</div>';
  } else {
    // 未加载：显示"点击加载"按钮
    referenceFilesHtml = `
      <div class="reference-lazy-load">
        <button type="button" class="load-reference-btn" data-batch-id="${batch.batchId}">
          📂 点击加载参考文件
        </button>
      </div>
    `;
  }

  // 计算参考文件数量显示
  const refCountDisplay = referenceFilesLoaded
    ? `(${referenceFiles.length})`
    : '(点击加载)';

  const referenceSectionHtml = (batch.tempFolderLink || batch.referenceFolderId) ? `
    <div class="review-section review-reference-section file-review-reference-section" id="ref-section-${batch.batchId}" data-batch-id="${batch.batchId}" data-temp-folder-link="${escapeHtml(batch.tempFolderLink || '')}" data-reference-folder-id="${batch.referenceFolderId || ''}">
      <div class="review-section-header">
        <span class="review-section-icon">📎</span>
        <span class="review-section-title">参考文件 ${refCountDisplay}</span>
      </div>
      <div class="reference-files-grid" id="ref-grid-${batch.batchId}">
        ${referenceFilesHtml}
      </div>
    </div>
  ` : '';


  // ========== 5. 审核状态区 ==========
  const statusSectionHtml = `
    <div class="review-section review-status-section">
      <div class="review-section-header">
        <span class="review-section-icon">⚡</span>
        <span class="review-section-title">审核操作</span>
      </div>
      <div class="review-status-content">
        <div class="review-status-row">
          <div class="status-selector">
            <label class="status-label">批次状态：</label>
            <select class="batch-status-select" data-batch-id="${batch.batchId}">
              ${reviewerStatusOptions.map(opt =>
    `<option value="${opt.value}" ${manualStatus === opt.value ? 'selected' : ''}>${opt.label}</option>`
  ).join('')}
            </select>
          </div>
          <div class="review-note-wrapper">
            <input type="text" placeholder="审核备注（可选）" class="batch-note-input" data-batch-id="${batch.batchId}" value="${escapeHtml(batchNoteInputValue)}" />
          </div>
        </div>
        <div class="review-action-buttons">
          <button class="btn-batch-approve" data-batch-id="${batch.batchId}">合格</button>
          <button class="btn-batch-reject" data-batch-id="${batch.batchId}">不合格</button>
          <button class="btn-batch-reset" data-batch-id="${batch.batchId}">取消标记</button>
          <button class="btn-batch-partial-store" data-batch-id="${batch.batchId}" ${batch.counts.approved === 0 ? 'disabled' : ''}>📥 部分入库</button>
          <button class="btn-batch-final-store" data-batch-id="${batch.batchId}" ${batch.counts.approved === 0 ? 'disabled' : ''}>📦 最终入库</button>
        </div>
      </div>
    </div>
  `;

  // ========== 组装完整卡片 ==========
  // 判断是否应该折叠（已入库/部分入库/已取消）
  const shouldCollapse =
    manualStatus === '已入库' ||
    manualStatus === '已完成' ||
    manualStatus === '已审核通过' ||
    isPartialBatchStatus(manualStatus) ||
    manualStatus === '已取消' ||
    manualStatus === '取消审核' ||
    manualStatus === '已取消审核';

  const collapsedClass = shouldCollapse ? ' collapsed' : '';
  const viewSizeClass = ` view-${savedViewSize}`;

  const expandBtnHtml = shouldCollapse ? `
    <button class="batch-expand-btn" data-batch-id="${batch.batchId}">
      <span class="expand-icon">▶</span>
      <span class="expand-text">展开详情</span>
    </button>
  ` : '';

  // 如果正在更新，添加遮罩层
  const overlayText = updatingStatus || '正在更新批次...';
  const overlayHint = updatingHint || '请稍候，正在写入表格...';
  const overlayHtml = isUpdating ? `
    <div class="batch-updating-overlay">
      <div class="batch-updating-content">
        <div class="batch-updating-spinner"></div>
        <div class="batch-updating-text">${escapeHtml(overlayText)}</div>
        <div class="batch-updating-hint">${escapeHtml(overlayHint)}</div>
      </div>
    </div>
  ` : '';

  const updatingClass = isUpdating ? ' is-updating' : '';

  // 折叠时隐藏的区域用 collapsible-section 包裹
  const collapsibleSectionsHtml = `
    <div class="batch-collapsible-sections${shouldCollapse ? ' hidden' : ''}">
      ${referenceSectionHtml}
      ${statusSectionHtml}
    </div>
  `;

  return `
    <div class="file-review-batch-card ${displayStatusClass}${updatingClass}${collapsedClass}${viewSizeClass}" data-batch-id="${batch.batchId}">
      ${overlayHtml}
      ${infoSectionHtml}
      ${expandBtnHtml}
      ${linksSectionHtml}
      ${filesSectionHtml}
      ${collapsibleSectionsHtml}
    </div>
  `;
}



/**
 * 更新批次的选中文件计数
 */
function updateBatchSelectionCount(batchId, container) {
  const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
  if (!batchCard) return;

  const selectedCount = batchCard.querySelectorAll('.file-card.selected').length;
  const countSpan = batchCard.querySelector(`.selection-count[data-batch-id="${batchId}"]`);
  const replaceBtn = batchCard.querySelector(`.btn-batch-replace[data-batch-id="${batchId}"]`);

  if (countSpan) {
    countSpan.textContent = `已选 ${selectedCount} 个`;
  }
  if (replaceBtn) {
    replaceBtn.disabled = selectedCount === 0;
  }
}

function ensureFileReviewSelections() {
  if (!state.fileReviewSelections) {
    state.fileReviewSelections = new Map(); // batchId -> Set<rowNumber>
  }
  return state.fileReviewSelections;
}

function syncFileReviewSelectionFromDom(batchId, batchCard) {
  const selections = ensureFileReviewSelections();
  if (!batchCard) return;
  const rows = Array.from(batchCard.querySelectorAll('.file-card.selected[data-row]'))
    .map(card => parseInt(card.dataset.row, 10))
    .filter(Number.isFinite);
  if (!rows.length) {
    selections.delete(batchId);
    return;
  }
  selections.set(batchId, new Set(rows));
}

function restoreFileReviewSelections(container, snapshot = null) {
  const selections = snapshot || state.fileReviewSelections;
  if (!selections || !container) return;
  selections.forEach((rowSet, batchId) => {
    const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
    if (!batchCard) return;
    batchCard.querySelectorAll('.file-card[data-row]').forEach(card => {
      const rowNumber = parseInt(card.dataset.row, 10);
      card.classList.toggle('selected', rowSet.has(rowNumber));
    });
    updateBatchSelectionCount(batchId, container);
  });
}

/**
 * 获取文件审核状态对应的 CSS 类
 */
function getFileReviewStatusClass(status) {
  switch (status) {
    case FILE_REVIEW_STATUS.PENDING: return 'status-pending';
    case FILE_REVIEW_STATUS.APPROVED: return 'status-approved';
    case FILE_REVIEW_STATUS.REJECTED: return 'status-rejected';
    case FILE_REVIEW_STATUS.DISCARDED: return 'status-discarded';
    case FILE_REVIEW_STATUS.STORED: return 'status-stored';
    case FILE_REVIEW_STATUS.REPLACED: return 'status-replaced';
    default: return 'status-pending';
  }
}

const fileReviewNoteSaveQueue = new Map();
const batchNoteSaveQueue = new Map();

function updateBatchNoteLocal(batchId, note) {
  const batch = state.fileReviewBatches?.find(b => b.batchId === batchId);
  if (!batch) return;
  batch.batchNote = note;
  (batch.files || []).forEach((file) => {
    file.batchNote = note;
  });
  if (!state.fileReviewBatchNoteCache) {
    state.fileReviewBatchNoteCache = new Map();
  }
  state.fileReviewBatchNoteCache.set(batchId, note);
}

function setBatchNoteInputState(batchId, state, note, sourceInput = null) {
  const inputs = document.querySelectorAll(`.batch-note-input[data-batch-id="${batchId}"]`);
  inputs.forEach((input) => {
    if (note !== undefined && input !== sourceInput && document.activeElement !== input) {
      input.value = note;
    }

    input.classList.remove('saving', 'saved', 'error');

    if (state === 'saving') {
      input.classList.add('saving');
      input.style.backgroundColor = '#fffdef';
      input.style.borderColor = '';
      return;
    }

    if (state === 'saved') {
      input.classList.add('saved');
      input.style.backgroundColor = '#f0fff4';
      input.style.borderColor = '#48bb78';
      setTimeout(() => {
        if (!document.contains(input)) return;
        input.classList.remove('saved');
        input.style.backgroundColor = '';
        input.style.borderColor = '';
      }, 1500);
      return;
    }

    if (state === 'error') {
      input.classList.add('error');
      input.style.backgroundColor = '#fff5f5';
      input.style.borderColor = '#f56565';
    }
  });
}

function enqueueBatchNoteSave(batchId, note, sourceInput = null) {
  if (!batchId) return;
  const entry = batchNoteSaveQueue.get(batchId) || {
    inFlight: false,
    pendingNote: null,
    latestNote: null,
    sourceInput: null
  };

  entry.pendingNote = note;
  entry.latestNote = note;
  entry.sourceInput = sourceInput;
  batchNoteSaveQueue.set(batchId, entry);

  setBatchNoteInputState(batchId, 'saving', note, sourceInput);

  if (!entry.inFlight) {
    processBatchNoteSave(batchId);
  }
}

async function processBatchNoteSave(batchId) {
  const entry = batchNoteSaveQueue.get(batchId);
  if (!entry || entry.inFlight) return;
  const note = entry.pendingNote;
  if (note === null || note === undefined) return;

  entry.inFlight = true;
  entry.pendingNote = null;

  updateBatchNoteLocal(batchId, note);
  renderSubmitterSuggestions();

  try {
    const batch = state.fileReviewBatches?.find(b => b.batchId === batchId);
    const rows = (batch?.files || [])
      .map(file => Number(file.rowNumber))
      .filter(Number.isFinite);

    if (!rows.length || !window.bridge?.updateFileReviewBatchNote) {
      throw new Error('无法保存批次备注');
    }

    await window.bridge.updateFileReviewBatchNote({ rows, note });
    if (window.bridge?.firebase && state.firebaseInitialized && state.firebaseSheetId && rows.length > 0) {
      const updates = rows.map((rowNumber) => ({
        rowNumber,
        batchNote: note
      }));
      window.bridge.firebase.batchUpdateFileStatus(state.firebaseSheetId, updates)
        .catch((err) => console.warn('[批次备注] Firebase 同步失败:', err.message));
    }
    if (entry.latestNote === note) {
      setBatchNoteInputState(batchId, 'saved', note, entry.sourceInput);
    }
  } catch (error) {
    if (entry.latestNote === note) {
      setBatchNoteInputState(batchId, 'error', note, entry.sourceInput);
    }
    console.error('[批次备注] 保存失败:', error);
  } finally {
    entry.inFlight = false;
    if (entry.pendingNote !== null && entry.pendingNote !== note) {
      processBatchNoteSave(batchId);
    }
  }
}

function updateFileReviewNoteLocal(rowNumber, note) {
  const timestamp = Date.now();
  const fileInState = state.fileReviewFiles?.find(f => f.rowNumber == rowNumber);
  if (fileInState) {
    fileInState.reviewNote = note;
    fileInState.reviewTime = timestamp;
  }
  state.fileReviewBatches?.forEach(batch => {
    const fileInBatch = batch.files?.find(f => f.rowNumber == rowNumber);
    if (fileInBatch) {
      fileInBatch.reviewNote = note;
      fileInBatch.reviewTime = timestamp;
    }
  });
}

function captureActiveNoteInput() {
  const el = document.activeElement;
  if (!el || !(el instanceof HTMLElement)) return null;
  if (!el.matches('.file-note-input, .file-card-note-input')) return null;
  const rowNumber = el.dataset.row;
  if (!rowNumber) return null;
  return {
    rowNumber,
    value: el.value,
    selectionStart: el.selectionStart,
    selectionEnd: el.selectionEnd,
    inReviewList: Boolean(el.closest('#review-list')),
    inMyReviewList: Boolean(el.closest('#my-review-list'))
  };
}

function restoreActiveNoteInput(snapshot, container) {
  if (!snapshot || !container) return;
  const selector = `.file-note-input[data-row="${snapshot.rowNumber}"], .file-card-note-input[data-row="${snapshot.rowNumber}"]`;
  const input = container.querySelector(selector);
  if (!input) return;
  input.value = snapshot.value || '';
  try {
    input.focus();
    if (Number.isFinite(snapshot.selectionStart) && Number.isFinite(snapshot.selectionEnd)) {
      input.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    }
  } catch (error) {
    // 忽略恢复光标失败
  }
}

function setFileReviewNoteInputsState(rowNumber, state, note, sourceInput = null) {
  const inputs = document.querySelectorAll(
    `.file-note-input[data-row="${rowNumber}"], .file-card-note-input[data-row="${rowNumber}"], .hover-preview-note-input[data-row="${rowNumber}"]`
  );

  inputs.forEach(input => {
    if (note !== undefined && input !== sourceInput && document.activeElement !== input) {
      input.value = note;
    }

    input.classList.remove('saving', 'saved', 'error');

    if (state === 'saving') {
      input.classList.add('saving');
      input.style.backgroundColor = '#fffdef';
      input.style.borderColor = '';
      return;
    }

    if (state === 'saved') {
      input.classList.add('saved');
      input.style.backgroundColor = '#f0fff4';
      input.style.borderColor = '#48bb78';
      setTimeout(() => {
        if (!document.contains(input)) return;
        input.classList.remove('saved');
        input.style.backgroundColor = '';
        input.style.borderColor = '';
      }, 1500);
      return;
    }

    if (state === 'error') {
      input.classList.add('error');
      input.style.backgroundColor = '#fff5f5';
      input.style.borderColor = '#f56565';
    }
  });
}

function enqueueFileReviewNoteSave(rowNumber, note, handlers = {}) {
  if (!rowNumber) return;
  const entry = fileReviewNoteSaveQueue.get(rowNumber) || {
    inFlight: false,
    pendingNote: null,
    latestNote: null,
    latestHandlers: null
  };

  entry.pendingNote = note;
  entry.latestNote = note;
  entry.latestHandlers = handlers;
  fileReviewNoteSaveQueue.set(rowNumber, entry);

  handlers.onSaving?.();
  setFileReviewNoteInputsState(rowNumber, 'saving', note, handlers.sourceInput);

  if (!entry.inFlight) {
    processFileReviewNoteSave(rowNumber);
  }
}

async function processFileReviewNoteSave(rowNumber) {
  const entry = fileReviewNoteSaveQueue.get(rowNumber);
  if (!entry || entry.inFlight) return;
  const note = entry.pendingNote;
  if (note === null || note === undefined) return;

  entry.inFlight = true;
  entry.pendingNote = null;

  updateFileReviewNoteLocal(rowNumber, note);

  try {
    await saveReviewStatus({
      rowNumber,
      reviewNote: note
    });

    if (entry.latestNote === note) {
      setFileReviewNoteInputsState(rowNumber, 'saved', note);
      entry.latestHandlers?.onSaved?.();
    }
  } catch (error) {
    if (entry.latestNote === note) {
      setFileReviewNoteInputsState(rowNumber, 'error', note);
      entry.latestHandlers?.onError?.(error);
    }
  } finally {
    entry.inFlight = false;
    if (entry.pendingNote !== null && entry.pendingNote !== note) {
      processFileReviewNoteSave(rowNumber);
    }
  }
}

/**
 * 获取批次的整体状态（中文显示）
 * 
 * 完全由手动设置决定，不再自动根据文件状态计算
 * 如果没有手动状态，默认返回"待审核"
 */
function getBatchOverallStatus(batch) {
  // 优先使用手动设置的批次状态
  if (batch.batchStatus) {
    return batch.batchStatus;
  }

  // 没有手动状态时，默认返回"待审核"
  return '待审核';
}

/**
 * 获取批次整体状态对应的CSS类
 */
function getBatchOverallStatusClass(batch) {
  const status = getBatchOverallStatus(batch);
  switch (status) {
    case '已入库': return 'status-stored';
    case '部分已入库': return 'status-partial-stored';
    case '一部分已入库': return 'status-partial-stored';
    case '一部分已入库，部分需要修改': return 'status-partial-stored status-feedback';
    case '已审核通过': return 'status-approved';
    case '待入库': return 'status-approved';  // 待入库用合格的样式
    case '不合格': return 'status-rejected';
    case '待审核':
    default: return 'status-pending';
  }
}

/**
 * 获取手动设置的批次状态对应的CSS类
 */
function getBatchManualStatusClass(status) {
  // 处理带来源标记的状态
  if (status && status.startsWith('已更新修改')) {
    if (status === '已更新修改(整体)') return 'status-updated status-updated-full';
    if (status === '已更新修改(部分)') return 'status-updated status-updated-partial';
    return 'status-updated';
  }

  switch (status) {
    case '已入库': return 'status-stored';
    case '部分已入库': return 'status-partial-stored';
    case '一部分已入库': return 'status-partial-stored';
    case '一部分已入库，部分需要修改': return 'status-partial-stored status-feedback';
    case '已审核通过': return 'status-approved';
    case '待入库': return 'status-approved';
    case '已完成': return 'status-completed';
    case '已取消': return 'status-cancelled';
    case '需要修改': return 'status-feedback';
    case '一部分需要修改': return 'status-feedback status-partial-feedback';
    case '不合格': return 'status-rejected';
    case '待审核':
    default: return 'status-pending';
  }
}

/**
 * 更新批次的整体状态（手动设置）
 */
async function updateBatchStatus(batchId, newStatus) {
  if (!window.bridge?.updateBatchStatus) {
    throw new Error('updateBatchStatus API 不可用');
  }

  const result = await window.bridge.updateBatchStatus({
    batchId,
    batchStatus: newStatus
  });

  if (window.bridge?.firebase && state.firebaseInitialized && state.firebaseSheetId) {
    const batch = state.fileReviewBatches?.find(b => (b.batchId || '').trim() === String(batchId || '').trim());
    const updates = batch?.files
      ?.filter(f => Number.isFinite(Number(f.rowNumber)))
      .map(f => ({
        rowNumber: f.rowNumber,
        batchStatus: newStatus || ''
      })) || [];
    if (updates.length > 0) {
      window.bridge.firebase.batchUpdateFileStatus(state.firebaseSheetId, updates)
        .catch(err => console.warn('[updateBatchStatus] Firebase 同步失败:', err.message));
    }
  }

  return result;
}

/**
 * 处理按文件审核模式的通知
 * 检测批次整体状态变化，触发相应的通知
 */
function handleFileReviewNotifications(newBatches, oldBatches) {
  // 首次加载，不触发通知
  if (!state.fileReviewNotificationsPrimed) {
    state.fileReviewNotificationsPrimed = true;
    // 缓存当前批次ID和手动状态
    state.fileReviewKnownBatchIds = new Set();
    state.fileReviewBatchStatusCache = new Map();
    newBatches.forEach(batch => {
      state.fileReviewKnownBatchIds.add(batch.batchId);
      state.fileReviewBatchStatusCache.set(batch.batchId, batch.batchStatus || '');
    });
    return;
  }

  const submitter = getSubmitterName();
  if (!submitter) return;

  const knownBatchIds = state.fileReviewKnownBatchIds || new Set();
  const oldStatusMap = state.fileReviewBatchStatusCache || new Map();
  const newKnownBatchIds = new Set();
  const newStatusMap = new Map();

  const pendingBatches = [];      // 新增待审核批次（审核员）
  const updatedBatches = [];      // 已更新修改的批次（通知审核员）
  const approvedBatches = [];     // 已通过/已入库的批次（提交人）
  const feedbackBatches = [];     // 需要修改的批次（提交人）

  newBatches.forEach(batch => {
    const manualStatus = batch.batchStatus || '';
    const isNewBatch = !knownBatchIds.has(batch.batchId);
    const oldManualStatus = oldStatusMap.get(batch.batchId) || '';
    const isMyBatch = (batch.submitter || '').trim() === submitter.trim();

    // 记录到新缓存
    newKnownBatchIds.add(batch.batchId);
    newStatusMap.set(batch.batchId, manualStatus);

    // 1. 新批次通知审核员
    if (isNewBatch && isReviewerRole()) {
      const autoStatus = getBatchOverallStatus(batch);
      if (autoStatus === '待审核') {
        pendingBatches.push(batch);
      }
    }

    // 2. 手动状态从其他值变为"已更新修改"系列，通知审核员
    const isNowUpdated = manualStatus && manualStatus.startsWith('已更新修改');
    const wasUpdated = oldManualStatus && oldManualStatus.startsWith('已更新修改');
    if (!isNewBatch && isNowUpdated && !wasUpdated && isReviewerRole()) {
      updatedBatches.push(batch);
    }

    // 3. 手动状态变为"已入库"/"已完成"，通知提交人
    if (!isNewBatch && isSubmitterRole() && isMyBatch) {
      if ((manualStatus === '已入库' || manualStatus === '已完成') &&
        oldManualStatus !== manualStatus) {
        approvedBatches.push(batch);
      }
    }

    // 4. 手动状态变为"需要修改"，通知提交人
    if (!isNewBatch && isSubmitterRole() && isMyBatch) {
      const normalizedManualStatus = (manualStatus || '').trim();
      const normalizedOldManualStatus = (oldManualStatus || '').trim();
      const needsChangeStatuses = new Set([
        '需要修改',
        '需修改',
        '一部分需要修改',
        '一部分已入库，部分需要修改'
      ]);
      if (
        needsChangeStatuses.has(normalizedManualStatus) &&
        normalizedOldManualStatus !== normalizedManualStatus
      ) {
        feedbackBatches.push(batch);
      }
    }
  });

  // 更新缓存
  state.fileReviewKnownBatchIds = newKnownBatchIds;
  state.fileReviewBatchStatusCache = newStatusMap;

  // 触发通知
  if (pendingBatches.length > 0 && isReviewerRole()) {
    appendLog({
      status: 'info',
      message: `新增 ${pendingBatches.length} 个待审核批次`,
      broadcastGlobal: true
    });
    pendingBatches.forEach(batch => {
      appendLog({
        status: 'info',
        message: `📋 待审核：${batch.mainCategory}/${batch.subCategory} - ${batch.batchId}`,
        broadcastGlobal: true
      });
      showFileReviewFloatingNotification('review', batch);
    });
    triggerNotification('review');
  }

  // 审核员：提交人已更新修改的批次
  if (updatedBatches.length > 0 && isReviewerRole()) {
    appendLog({
      status: 'info',
      message: `有 ${updatedBatches.length} 个批次已更新修改，请复审`,
      broadcastGlobal: true
    });
    updatedBatches.forEach(batch => {
      // 获取状态来源类型
      const batchStatus = batch.batchStatus || '';
      let updateTypeLabel = '🔄 已更新修改';
      if (batchStatus === '已更新修改(整体)') {
        updateTypeLabel = '🔴 整体复审';
      } else if (batchStatus === '已更新修改(部分)') {
        updateTypeLabel = '🟠 补充复审';
      }
      appendLog({
        status: 'info',
        message: `${updateTypeLabel}：${batch.mainCategory}/${batch.subCategory} - ${batch.batchId}`,
        broadcastGlobal: true
      });
      // 显示浮动通知
      showFileReviewFloatingNotification('suggestion', batch);
    });
    triggerNotification('review');
  }

  if (approvedBatches.length > 0 && isSubmitterRole()) {
    appendLog({
      status: 'success',
      message: `您有 ${approvedBatches.length} 个批次状态已更新`,
      broadcastGlobal: true
    });
    approvedBatches.forEach(batch => {
      const status = batch.batchStatus || getBatchOverallStatus(batch);
      appendLog({
        status: 'success',
        message: `✅ ${status}：${batch.mainCategory}/${batch.subCategory} - ${batch.batchId}`,
        broadcastGlobal: true
      });
      // 显示浮动通知
      showFileReviewFloatingNotification('approved', batch);
    });
    triggerNotification('approved');
  }

  if (feedbackBatches.length > 0 && isSubmitterRole()) {
    appendLog({
      status: 'info',
      message: `您有 ${feedbackBatches.length} 个批次需要修改`,
      broadcastGlobal: true
    });
    feedbackBatches.forEach(batch => {
      appendLog({
        status: 'info',
        message: `📝 需要修改：${batch.mainCategory}/${batch.subCategory} - ${batch.batchId}`,
        broadcastGlobal: true
      });
      showFileReviewFloatingNotification('suggestion', batch);
    });
    triggerNotification('suggestion');
  }
}

/**
 * 显示按文件审核模式的浮动通知
 */
function showFileReviewFloatingNotification(type, batch) {
  if (!window.bridge?.showFloatingNotification || !batch) {
    return;
  }
  if (!state.config.enableFloatingNotifications) {
    return;
  }

  const status = batch.batchStatus || getBatchOverallStatus(batch);
  const submitter = typeof getSubmitterName === 'function' ? getSubmitterName() : '';
  const isMyBatch = submitter && (batch.submitter || '').trim() === submitter.trim();
  const notificationTarget =
    type === 'approved' || (type === 'suggestion' && isMyBatch) ? 'my-review' : 'review';

  const entry = {
    isFileReview: true,
    batchId: batch.batchId,
    submitter: batch.submitter,
    admin: '',
    completedAt: batch.submitTime || '',
    customDate: batch.submitTime || '',
    mainCategory: batch.mainCategory,
    subCategory: batch.subCategory,
    status,
    tempLink: batch.tempFolderLink || '',
    folderLink: batch.tempFolderLink || '',
    counts: batch.counts || {},
    files: Array.isArray(batch.files) ? batch.files : [],
    referenceFiles: Array.isArray(batch.referenceFiles) ? batch.referenceFiles : [],
    notificationTarget
  };

  const payload = { type, entry };

  window.bridge.showFloatingNotification(payload);
}

/**
 * 设置按文件审核的事件处理器
 */
function setupFileReviewHandlers(container) {
  // 🚀 多批次选择勾选框事件
  setupBatchMultiSelectHandlers(container);

  // 🚀 展开/折叠按钮
  container.querySelectorAll('.batch-expand-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const batchId = btn.dataset.batchId;
      const batchCard = btn.closest('.file-review-batch-card');
      if (!batchCard) return;

      const isCollapsed = batchCard.classList.contains('collapsed');
      const collapsibleSections = batchCard.querySelector('.batch-collapsible-sections');
      const expandIcon = btn.querySelector('.expand-icon');
      const expandText = btn.querySelector('.expand-text');

      if (isCollapsed) {
        // 展开
        batchCard.classList.remove('collapsed');
        if (collapsibleSections) collapsibleSections.classList.remove('hidden');
        if (expandIcon) expandIcon.textContent = '▼';
        if (expandText) expandText.textContent = '收起详情';
      } else {
        // 折叠
        batchCard.classList.add('collapsed');
        if (collapsibleSections) collapsibleSections.classList.add('hidden');
        if (expandIcon) expandIcon.textContent = '▶';
        if (expandText) expandText.textContent = '展开详情';
      }
    });
  });

  // 🚀 视图大小切换按钮（小/中/大缩略图）
  container.querySelectorAll('.view-size-toggle').forEach(toggle => {
    toggle.querySelectorAll('.view-size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const size = btn.dataset.size;
        const batchId = toggle.dataset.batchId;
        const batchCard = toggle.closest('.file-review-batch-card');
        if (!batchCard || !size) return;

        // 更新按钮激活状态
        toggle.querySelectorAll('.view-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 更新卡片视图类
        batchCard.classList.remove('view-small', 'view-medium', 'view-large');
        batchCard.classList.add(`view-${size}`);

        // 保存视图偏好到 localStorage
        const viewPrefs = JSON.parse(localStorage.getItem('batchViewSizePrefs') || '{}');
        viewPrefs[batchId] = size;
        localStorage.setItem('batchViewSizePrefs', JSON.stringify(viewPrefs));
      });
    });
  });

  // 🚀 平铺查看按钮
  container.querySelectorAll('.btn-tile-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const batchId = btn.dataset.batchId;
      if (!batchId) return;

      const batch = state.fileReviewBatches?.find(b => b.batchId === batchId);
      if (!batch || !batch.files?.length) {
        appendLog({ status: 'warning', message: '没有可预览的文件' });
        return;
      }

      showTileViewPanel(batch);
    });
  });

  container.querySelectorAll('.load-reference-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const batchId = btn.dataset.batchId;
      if (!batchId) return;

      const batch = state.fileReviewBatches?.find(b => b.batchId === batchId);
      if (!batch) return;

      // 显示加载中状态
      btn.disabled = true;
      btn.textContent = '⏳ 加载中...';

      try {
        // 调用后端加载参考文件
        const result = await window.bridge.loadReferenceFiles({
          batchId: batch.batchId,
          referenceFolderId: batch.referenceFolderId,
          tempFolderLink: batch.tempFolderLink
        });

        // 更新本地状态
        batch.referenceFiles = result.referenceFiles || [];
        batch.referenceFilesLoaded = true;
        if (result.referenceFolderId) {
          batch.referenceFolderId = result.referenceFolderId;
        }

        // 更新 UI（只更新这个参考文件区域）
        const refGrid = document.getElementById(`ref-grid-${batchId}`);
        const refTitle = document.querySelector(`#ref-section-${batchId} .review-section-title`);

        if (refGrid) {
          if (batch.referenceFiles.length > 0) {
            refGrid.innerHTML = batch.referenceFiles.map(file => `
              <div class="reference-file-item file-preview-trigger" 
                   data-file-id="${file.fileId}" 
                   data-preview-id="${file.fileId}"
                   data-file-name="${escapeHtml(file.fileName)}"
                   data-file-link="${file.fileLink}">
                <img src="https://drive.google.com/thumbnail?id=${file.fileId}&sz=w80" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><rect fill=\\'%23e2e8f0\\' width=\\'24\\' height=\\'24\\'/><text x=\\'12\\' y=\\'14\\' text-anchor=\\'middle\\' fill=\\'%2394a3b8\\' font-size=\\'6\\'>参考</text></svg>'" 
                     alt="${escapeHtml(file.fileName)}" 
                     title="${escapeHtml(file.fileName)}" />
              </div>
            `).join('');
          } else {
            refGrid.innerHTML = '<div class="reference-empty">暂无参考文件</div>';
          }
        }

        if (refTitle) {
          refTitle.textContent = `参考文件 (${batch.referenceFiles.length})`;
        }

        console.log(`[RefLazyLoad] 批次 ${batchId} 加载了 ${batch.referenceFiles.length} 个参考文件`);
      } catch (error) {
        console.error('[RefLazyLoad] 加载失败:', error);
        btn.textContent = '❌ 加载失败，点击重试';
        btn.disabled = false;
      }
    });
  });

  // 编辑批次设置
  container.querySelectorAll('.btn-edit-batch-settings').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const batchId = btn.dataset.batchId;
      if (batchId) {
        openBatchSettingsModal(batchId);
      }
    });
  });

  // 批次状态选择器（审核员）
  container.querySelectorAll('.batch-status-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const batchId = select.dataset.batchId;
      const newStatus = e.target.value;

      const lockKey = `review-batch-status:${batchId}:${newStatus}`;
      if (!tryBeginInFlight(lockKey)) {
        return;
      }
      const originalDisabled = select.disabled;
      select.disabled = true;

      try {
        // ✅ 立即锁定状态（永久锁，等待后端确认）
        lockBatchStatus(batchId, newStatus, true);

        // 保存旧状态用于回滚
        const oldStatus = state.fileReviewBatches?.find(b => b.batchId === batchId)?.batchStatus || '';

        // 🚀 不立即更新本地状态（避免批次从当前视图消失）
        // 只显示遮罩层提示用户正在保存
        renderFileReviewEntries(); // 这会显示更新遮罩

        // 显示正在保存提示
        showBatchStatusToast(batchId, newStatus, 'saving');

        // 调用后端更新批次状态
        const result = await updateBatchStatus(batchId, newStatus);

        if (result?.success) {
          // ✅ 后端确认成功，现在更新本地状态
          const batch = state.fileReviewBatches?.find(b => b.batchId === batchId);
          if (batch) {
            batch.batchStatus = newStatus;
            // 同时更新批次内所有文件的 batchStatus
            batch.files?.forEach(f => {
              f.batchStatus = newStatus;
              f._localModifiedAt = Date.now();
            });
          }
          // 同步更新 fileReviewFiles
          state.fileReviewFiles?.forEach(f => {
            if (f.batchId === batchId) {
              f.batchStatus = newStatus;
              f._localModifiedAt = Date.now();
            }
          });

          // 等待表格同步确认后再解锁
          markBatchStatusPendingRemote(batchId);
          showBatchStatusToast(batchId, newStatus, 'success');

          // 刷新 UI（此时批次可能会从当前视图消失，因为状态变了）
          renderFileReviewEntries();

          appendLog({
            status: 'success',
            message: `批次 ${batchId} 状态已更新为：${newStatus || '自动'}（已写入表格）`,
            broadcastGlobal: true
          });
        } else {
          throw new Error(result?.message || '后端返回失败');
        }
      } catch (error) {
        // ❌ 失败时回滚状态
        console.error('[BatchStatus] 更新失败:', error);

        // 解锁并回滚本地状态
        unlockBatchStatus(batchId);

        // 重新加载数据以恢复正确状态
        await loadFileReviewEntries({ silent: true });

        showBatchStatusToast(batchId, '', 'error');

        appendLog({
          status: 'error',
          message: `更新批次状态失败：${error.message}`
        });
      } finally {
        endInFlight(lockKey);
        if (document.contains(select)) {
          select.disabled = originalDisabled;
        }
      }
    });
  });

  // 打开外部链接（在系统浏览器中）
  container.querySelectorAll('.open-external-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = btn.dataset.url;
      if (url && window.bridge?.openExternal) {
        window.bridge.openExternal(url);
      }
    });
  });

  // 单个文件状态按钮点击（旧版）
  container.querySelectorAll('.file-status-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      const rowNumber = parseInt(btn.dataset.row, 10);
      const newStatus = btn.dataset.status;
      handleFileReviewStatusChange(rowNumber, newStatus);
    });
  });

  // 新版文件卡片按钮点击
  container.querySelectorAll('.file-card-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (btn.tagName === 'A') return; // 链接不需要处理
      e.preventDefault();
      if (btn.disabled) return;

      const action = btn.dataset.action;
      const rowNumber = parseInt(btn.dataset.row, 10);

      const lockKey = rowNumber ? `review-file-action:${rowNumber}:${action}` : '';
      if (!tryBeginInFlight(lockKey)) {
        return;
      }

      // 对于状态更新操作，使用乐观更新模式（不阻塞按钮）
      if (action === 'approve' || action === 'reject' || action === 'discard') {
        console.log('[乐观更新] 立即响应按钮点击:', action, rowNumber);
        endInFlight(lockKey);

        // 立即更新按钮视觉状态
        const statusMap = {
          'approve': FILE_REVIEW_STATUS.APPROVED,
          'reject': FILE_REVIEW_STATUS.REJECTED,
          'discard': FILE_REVIEW_STATUS.DISCARDED
        };
        const newStatus = statusMap[action];

        // 更新当前按钮和兄弟按钮的 active 状态
        const card = btn.closest('.file-card, .file-row');
        if (card) {
          card.querySelectorAll('.file-card-btn[data-action]').forEach(sibBtn => {
            const sibAction = sibBtn.dataset.action;
            const isActive = sibAction === action;
            sibBtn.classList.toggle('active', isActive);
          });
        }

        // 后台执行状态更新（不等待）
        handleFileReviewStatusChange(rowNumber, newStatus);
        return;
      }

      // 其他操作保持原有逻辑
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.classList.add('loading');
      btn.textContent = '⏳';

      try {
        if (action === 'replace') {
          const fileId = btn.dataset.fileId;
          const fileName = btn.dataset.fileName;
          const tempFolderLink = btn.dataset.tempFolderLink || '';
          const batchId = btn.dataset.batchId || '';
          openFileReplaceModal({
            fileId,
            fileName,
            rowNumber,
            tempFolderLink,
            batchId
          });
        } else if (action === 'delete') {
          const fileId = btn.dataset.fileId;
          const fileName = btn.dataset.fileName;
          const batchId = btn.dataset.batchId || '';
          // 确认删除
          const confirmed = await showConfirmationDialog({
            title: '确认删除',
            message: `确定要删除文件 "${fileName}" 吗？`,
            details: ['从审核列表中移除该文件', '将文件移动到"已删除"文件夹'],
            confirmText: '删除',
            cancelText: '取消',
            destructive: true
          });
          if (confirmed) {
            // 🚀 乐观更新：先从 UI 立即移除文件卡片
            const card = btn.closest('.file-card');
            if (card) {
              card.style.transition = 'opacity 0.2s, transform 0.2s';
              card.style.opacity = '0';
              card.style.transform = 'scale(0.9)';
              setTimeout(() => card.remove(), 200);
            }

            // 从本地状态中移除
            if (state.fileReviewFiles) {
              state.fileReviewFiles = state.fileReviewFiles.filter(f => f.rowNumber != rowNumber);
            }
            state.fileReviewBatches?.forEach(batch => {
              if (batch.files) {
                batch.files = batch.files.filter(f => f.rowNumber != rowNumber);
                // 重新计算批次计数
                const counts = { pending: 0, approved: 0, rejected: 0, stored: 0, discarded: 0, total: batch.files.length };
                batch.files.forEach(f => {
                  if (f.status === FILE_REVIEW_STATUS.APPROVED) counts.approved++;
                  else if (f.status === FILE_REVIEW_STATUS.REJECTED) counts.rejected++;
                  else if (f.status === FILE_REVIEW_STATUS.STORED) counts.stored++;
                  else if (f.status === FILE_REVIEW_STATUS.DISCARDED) counts.discarded++;
                  else counts.pending++;
                });
                batch.counts = counts;
              }
            });

            // 后台执行实际删除操作
            window.bridge.deleteReviewFile({
              fileId,
              rowNumber,
              batchId
            }).then(result => {
              if (result.success) {
                appendLog({
                  status: 'success',
                  message: `文件 "${fileName}" 已删除`,
                  broadcastGlobal: true
                });
              } else {
                appendLog({
                  status: 'error',
                  message: result.message || '删除失败，请刷新页面'
                });
                // 删除失败，刷新列表恢复
                loadFileReviewEntries({ silent: true });
              }
            }).catch(error => {
              appendLog({
                status: 'error',
                message: `删除失败：${error.message}，请刷新页面`
              });
              // 删除失败，刷新列表恢复
              loadFileReviewEntries({ silent: true });
            });
          }
        } else if (action === 'open') {
          const url = btn.dataset.url;
          if (url && window.bridge?.openExternal) {
            window.bridge.openExternal(url);
          }
        }
      } finally {
        endInFlight(lockKey);
        if (document.contains(btn)) {
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.textContent = originalText;
        }
      }
    });
  });

  // 全选按钮 - 选中所有文件
  container.querySelectorAll('.btn-select-all').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const batchId = e.target.dataset.batchId;
      const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
      if (batchCard) {
        batchCard.querySelectorAll('.file-card').forEach(card => {
          card.classList.add('selected');
        });
        syncFileReviewSelectionFromDom(batchId, batchCard);
        updateBatchSelectionCount(batchId, container);
      }
    });
  });

  // 反选按钮 - 切换选中状态
  container.querySelectorAll('.btn-select-invert').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const batchId = e.target.dataset.batchId;
      const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
      if (batchCard) {
        batchCard.querySelectorAll('.file-card').forEach(card => {
          card.classList.toggle('selected');
        });
        syncFileReviewSelectionFromDom(batchId, batchCard);
        updateBatchSelectionCount(batchId, container);
      }
    });
  });

  // 取消全选按钮 - 取消所有选中
  container.querySelectorAll('.btn-select-none').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const batchId = e.target.dataset.batchId;
      const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
      if (batchCard) {
        batchCard.querySelectorAll('.file-card.selected').forEach(card => {
          card.classList.remove('selected');
        });
        syncFileReviewSelectionFromDom(batchId, batchCard);
        updateBatchSelectionCount(batchId, container);
      }
    });
  });

  // 选中不合格按钮 - 选中所有标记为不合格的文件
  container.querySelectorAll('.btn-select-rejected').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const batchId = e.target.dataset.batchId;
      const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
      if (batchCard) {
        // 先取消所有选中
        batchCard.querySelectorAll('.file-card.selected').forEach(card => {
          card.classList.remove('selected');
        });
        // 选中所有不合格的（被标记为rejected的）
        batchCard.querySelectorAll('.file-card.status-rejected').forEach(card => {
          card.classList.add('selected');
        });
        syncFileReviewSelectionFromDom(batchId, batchCard);
        updateBatchSelectionCount(batchId, container);
      }
    });
  });

  // 批量替换按钮
  container.querySelectorAll('.btn-batch-replace').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const batchId = e.target.dataset.batchId;
      const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
      if (!batchCard) return;

      const selectedCards = batchCard.querySelectorAll('.file-card.selected');
      if (selectedCards.length === 0) {
        appendLog({ status: 'warning', message: '请先选择要替换的文件' });
        return;
      }

      // 收集选中的文件信息
      const filesToReplace = [];
      selectedCards.forEach(card => {
        const replaceBtn = card.querySelector('.file-card-btn[data-action="replace"]');
        if (replaceBtn) {
          filesToReplace.push({
            rowNumber: parseInt(replaceBtn.dataset.row, 10),
            fileId: replaceBtn.dataset.fileId,
            fileName: replaceBtn.dataset.fileName
          });
        }
      });

      if (filesToReplace.length === 0) return;

      // 开始批量替换
      appendLog({
        status: 'info',
        message: `📦 开始批量替换 ${filesToReplace.length} 个文件...`
      });

      // 使用批量替换模式
      state.batchReplaceQueue = [...filesToReplace];
      state.batchReplaceIndex = 0;
      processNextBatchReplace();
    });
  });

  // 批次备注输入框 - 输入即保存（防抖）
  const batchNoteTimers = new Map();
  container.querySelectorAll('.batch-note-input').forEach(input => {
    const batchId = input.dataset.batchId;
    if (!batchId) return;

    input.addEventListener('input', () => {
      const note = input.value.trim();
      if (batchNoteTimers.has(batchId)) {
        clearTimeout(batchNoteTimers.get(batchId));
      }
      batchNoteTimers.set(batchId, setTimeout(() => {
        enqueueBatchNoteSave(batchId, note, input);
        batchNoteTimers.delete(batchId);
      }, 500));
    });

    input.addEventListener('blur', () => {
      const note = input.value.trim();
      if (batchNoteTimers.has(batchId)) {
        clearTimeout(batchNoteTimers.get(batchId));
        batchNoteTimers.delete(batchId);
      }
      enqueueBatchNoteSave(batchId, note, input);
    });
  });

  // 文件卡片点击选择
  container.querySelectorAll('.file-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // 忽略来自按钮和输入框的点击
      if (e.target.closest('.file-card-btn') ||
        e.target.closest('.file-card-note-input')) {
        return;
      }
      card.classList.toggle('selected');
      const batchCard = card.closest('.file-review-batch-card');
      if (batchCard) {
        syncFileReviewSelectionFromDom(batchCard.dataset.batchId, batchCard);
        updateBatchSelectionCount(batchCard.dataset.batchId, container);
      }
    });
  });

  // 预览触发器（缩略图悬浮预览 - 浮动窗口风格）
  container.querySelectorAll('.file-review-thumb.file-preview-trigger, .file-card-thumb.file-preview-trigger, .reference-file-item.file-preview-trigger').forEach(thumb => {
    let hoverTimer = null;

    thumb.addEventListener('mouseenter', (e) => {
      // 延迟100ms后显示悬浮预览
      hoverTimer = setTimeout(() => {
        const fileId = thumb.dataset.fileId;
        const previewId = thumb.dataset.previewId || fileId;
        const fileName = thumb.dataset.fileName;
        const fileLink = thumb.dataset.fileLink;
        const rowNumber = thumb.dataset.row;
        if (fileId) {
          showHoverPreview(fileId, fileName, fileLink, rowNumber, thumb, false, previewId);
        }
      }, 100);
    });

    thumb.addEventListener('mouseleave', (e) => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      // 延迟检查，让鼠标有时间移动到预览窗口
      setTimeout(() => {
        hideHoverPreview();
      }, 100);
    });

    // 单击选择文件，双击打开全屏预览
    thumb.addEventListener('click', (e) => {
      const fileId = thumb.dataset.fileId;
      const previewId = thumb.dataset.previewId || fileId;
      if (!fileId) return;
      const card = thumb.closest('.file-card');
      if (!card) {
        e.preventDefault();
        e.stopPropagation();
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        hideHoverPreview(true);
        const fileName = thumb.dataset.fileName;
        const fileLink = thumb.dataset.fileLink;
        const rowNumber = thumb.dataset.row;
        showHoverPreview(fileId, fileName, fileLink, rowNumber, null, true, previewId);
        return;
      }
      if (e.detail > 1) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      card.classList.toggle('selected');
      const batchCard = card.closest('.file-review-batch-card');
      if (batchCard) {
        syncFileReviewSelectionFromDom(batchCard.dataset.batchId, batchCard);
        updateBatchSelectionCount(batchCard.dataset.batchId, container);
      }
    });

    thumb.addEventListener('dblclick', (e) => {
      const fileId = thumb.dataset.fileId;
      const previewId = thumb.dataset.previewId || fileId;
      const fileName = thumb.dataset.fileName;
      const fileLink = thumb.dataset.fileLink;
      const rowNumber = thumb.dataset.row;
      if (fileId) {
        e.preventDefault();
        e.stopPropagation();
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        hideHoverPreview(true);
        showHoverPreview(fileId, fileName, fileLink, rowNumber, null, true, previewId); // fullscreen模式
      }
    });
  });

  // 预览按钮点击 - 打开完整模态预览
  container.querySelectorAll('.file-review-btn.preview.file-preview-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const fileId = trigger.dataset.fileId;
      const previewId = trigger.dataset.previewId || fileId;
      const fileName = trigger.dataset.fileName;
      const fileLink = trigger.dataset.fileLink;
      const rowNumber = trigger.dataset.row;
      if (fileId) {
        showHoverPreview(fileId, fileName, fileLink, rowNumber, null, true, previewId); // fullscreen模式
      }
    });
  });

  // 批量通过按钮
  container.querySelectorAll('.btn-batch-approve').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const batchId = e.target.dataset.batchId;
      const lockKey = `review-batch-action:${batchId}:approve`;
      if (!tryBeginInFlight(lockKey)) {
        return;
      }
      const batchCard = btn.closest('.file-review-batch-card');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.classList.add('loading');
      btn.textContent = '处理中...';
      try {
        await handleBatchApprove(batchId, { batchCard });
      } finally {
        endInFlight(lockKey);
        if (document.contains(btn)) {
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.textContent = originalText;
        }
      }
    });
  });

  // 批量不合格按钮
  container.querySelectorAll('.btn-batch-reject').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const batchId = e.target.dataset.batchId;
      const lockKey = `review-batch-action:${batchId}:reject`;
      if (!tryBeginInFlight(lockKey)) {
        return;
      }
      const batchCard = btn.closest('.file-review-batch-card');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.classList.add('loading');
      btn.textContent = '处理中...';
      try {
        await handleBatchReject(batchId, { batchCard });
      } finally {
        endInFlight(lockKey);
        if (document.contains(btn)) {
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.textContent = originalText;
        }
      }
    });
  });

  // 批量取消标记按钮
  container.querySelectorAll('.btn-batch-reset').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const batchId = e.target.dataset.batchId;
      const lockKey = `review-batch-action:${batchId}:reset`;
      if (!tryBeginInFlight(lockKey)) {
        return;
      }
      const batchCard = btn.closest('.file-review-batch-card');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.classList.add('loading');
      btn.textContent = '处理中...';
      try {
        await handleBatchReset(batchId, { batchCard });
      } finally {
        endInFlight(lockKey);
        if (document.contains(btn)) {
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.textContent = originalText;
        }
      }
    });
  });

  // 部分入库按钮 - 入库合格的，批次状态变为"部分已入库"
  container.querySelectorAll('.btn-batch-partial-store').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const batchId = e.target.dataset.batchId;
      const lockKey = `review-batch-action:${batchId}:partial-store`;
      if (!tryBeginInFlight(lockKey)) {
        return;
      }
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.classList.add('loading');
      btn.textContent = '处理中...';
      try {
        await handleBatchStore(batchId, 'partial');
      } finally {
        endInFlight(lockKey);
        if (document.contains(btn)) {
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.textContent = originalText;
        }
      }
    });
  });

  // 最终入库按钮 - 入库合格的，批次状态变为"已入库"，不合格的作废
  container.querySelectorAll('.btn-batch-final-store').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      // 立即禁用按钮防止快速双击
      if (btn.disabled) return;
      btn.disabled = true;

      const batchId = e.target.dataset.batchId;
      const lockKey = `review-batch-action:${batchId}:final-store`;
      if (!tryBeginInFlight(lockKey)) {
        btn.disabled = false;
        return;
      }
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.classList.add('loading');
      btn.textContent = '处理中...';
      try {
        await handleBatchStore(batchId, 'final');
      } finally {
        endInFlight(lockKey);
        if (document.contains(btn)) {
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.textContent = originalText;
        }
      }
    });
  });

  // 替换文件按钮
  container.querySelectorAll('.file-review-btn.replace').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rowNumber = parseInt(e.target.dataset.row, 10);
      handleFileReplace(rowNumber);
    });
  });

  // 单个文件建议输入框 - 使用防抖保存
  const noteUpdateTimers = new Map();
  container.querySelectorAll('.file-note-input, .file-card-note-input').forEach(input => {
    const saveNote = (rowNumber, note) => {
      enqueueFileReviewNoteSave(rowNumber, note, {
        sourceInput: input,
        onError: (error) => console.error('Failed to save file note:', error)
      });
    };

    // 输入时使用防抖延迟保存
    input.addEventListener('input', () => {
      const rowNumber = parseInt(input.dataset.row, 10);
      const note = input.value.trim();

      // 清除之前的定时器
      if (noteUpdateTimers.has(rowNumber)) {
        clearTimeout(noteUpdateTimers.get(rowNumber));
      }

      // 设置新的防抖定时器（500ms）
      noteUpdateTimers.set(rowNumber, setTimeout(() => {
        saveNote(rowNumber, note);
        noteUpdateTimers.delete(rowNumber);
      }, 500));
    });

    // 失焦时立即保存
    input.addEventListener('blur', () => {
      const rowNumber = parseInt(input.dataset.row, 10);
      const note = input.value.trim();

      // 清除防抖定时器
      if (noteUpdateTimers.has(rowNumber)) {
        clearTimeout(noteUpdateTimers.get(rowNumber));
        noteUpdateTimers.delete(rowNumber);
      }

      // 立即保存
      saveNote(rowNumber, note);
    });

    // 回车也保存
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
  });

  // 标注按钮
  container.querySelectorAll('.annotate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fileId = btn.dataset.fileId;
      const previewFileId = btn.dataset.previewId || fileId;
      const fileName = btn.dataset.fileName;
      const fileLink = btn.dataset.fileLink;
      const rowNumber = btn.dataset.row;
      openAnnotationTool(fileId, fileName, fileLink, rowNumber, previewFileId);
    });
  });

  // 自动加载所有参考区域的内容
  container.querySelectorAll('.file-review-reference-section').forEach(section => {
    loadReferenceFilesForSection(section);
  });
}

/**
 * 加载指定参考区域的文件
 */
async function loadReferenceFilesForSection(section) {
  // 检查是否已加载过，避免重复加载
  if (section.dataset.loaded === 'true') {
    return;
  }

  const batchId = section.id?.replace('ref-section-', '');
  const grid = section.querySelector('.reference-files-grid');

  // 如果grid里已经有参考文件（由后端渲染），跳过动态加载
  if (grid && grid.querySelector('.reference-file-item')) {
    section.dataset.loaded = 'true';
    return;
  }

  const tempFolderLink = section.dataset.tempFolderLink || '';

  if (!grid || !tempFolderLink) {
    if (grid) grid.innerHTML = '<div class="reference-empty">暂无参考文件</div>';
    section.dataset.loaded = 'true';
    return;
  }

  // 从链接提取目录ID
  const match = tempFolderLink.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    grid.innerHTML = '<div class="reference-empty">暂无参考文件</div>';
    section.dataset.loaded = 'true';
    return;
  }

  const tempFolderId = match[1];

  try {
    // 获取子目录列表
    const subFolders = await window.bridge.getMediaFolderTree(tempFolderId);
    const referenceFolder = Array.isArray(subFolders) ? subFolders.find(f => f.name === '参考') : null;

    if (!referenceFolder) {
      grid.innerHTML = '<div class="reference-empty">暂无参考文件</div>';
      section.dataset.loaded = 'true';
      return;
    }

    // 获取参考文件夹内的文件
    const refFolderDetails = await window.bridge.getMediaFolderDetails(referenceFolder.id, { includeFiles: true });
    const files = refFolderDetails?.files || [];

    if (files.length === 0) {
      grid.innerHTML = '<div class="reference-empty">暂无参考文件</div>';
      section.dataset.loaded = 'true';
      return;
    }

    // 渲染参考文件缩略图
    grid.innerHTML = files.map(file => `
      <div class="reference-file-item file-preview-trigger" 
           data-file-id="${file.id}" 
           data-preview-id="${file.id}"
           data-file-name="${escapeHtml(file.name)}"
           data-file-link="https://drive.google.com/file/d/${file.id}/view">
        <img src="https://drive.google.com/thumbnail?id=${file.id}&sz=w80" 
             onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><rect fill=\\'%23e2e8f0\\' width=\\'24\\' height=\\'24\\'/><text x=\\'12\\' y=\\'14\\' text-anchor=\\'middle\\' fill=\\'%2394a3b8\\' font-size=\\'6\\'>参考</text></svg>'" 
             alt="${escapeHtml(file.name)}" 
             title="${escapeHtml(file.name)}" />
      </div>
    `).join('');

    // 为动态添加的缩略图绑定预览事件
    grid.querySelectorAll('.reference-file-item').forEach(item => {
      let hoverTimer = null;

      item.addEventListener('mouseenter', () => {
        hoverTimer = setTimeout(() => {
          const fileId = item.dataset.fileId;
          const fileName = item.dataset.fileName;
          const fileLink = item.dataset.fileLink;
          if (fileId) {
            showHoverPreview(fileId, fileName, fileLink, null, item);
          }
        }, 100);
      });

      item.addEventListener('mouseleave', () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        setTimeout(() => {
          hideHoverPreview();
        }, 100);
      });

      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        hideHoverPreview();
        const fileId = item.dataset.fileId;
        const fileName = item.dataset.fileName;
        const fileLink = item.dataset.fileLink;
        if (fileId) {
          showHoverPreview(fileId, fileName, fileLink, null, null, true);
        }
      });
    });

    // 标记为已加载
    section.dataset.loaded = 'true';

  } catch (error) {
    grid.innerHTML = '<div class="reference-empty">暂无参考文件</div>';
    section.dataset.loaded = 'true';
  }
}

/**
 * 图片标注工具 - Monosnap 风格
 */
function openAnnotationTool(fileId, fileName, fileLink, rowNumber, previewFileId = null) {
  // 移除已存在的标注工具
  document.querySelector('.annotation-tool-overlay')?.remove();
  const imageFileId = previewFileId || fileId;

  const overlay = document.createElement('div');
  overlay.className = 'annotation-tool-overlay';
  overlay.innerHTML = `
    <div class="annotation-tool-content monosnap-style">
      <div class="annotation-toolbar-top">
        <!-- 填充切换 -->
        <button class="tool-toggle filled active" data-toggle="filled" title="实心/空心 (切换填充模式)">
          <span class="toggle-icon filled-icon"></span>
        </button>
        <!-- 预设颜色快捷选择 -->
        <div class="color-preset-group">
          <button class="color-preset active" data-color="#ff0000" style="background:#ff0000" title="红色"></button>
          <button class="color-preset" data-color="#ff1493" style="background:#ff1493" title="玫红"></button>
          <button class="color-preset" data-color="#ff9800" style="background:#ff9800" title="橙色"></button>
          <button class="color-preset" data-color="#ffeb3b" style="background:#ffeb3b" title="黄色"></button>
          <button class="color-preset" data-color="#4caf50" style="background:#4caf50" title="绿色"></button>
          <button class="color-preset" data-color="#2196f3" style="background:#2196f3" title="蓝色"></button>
        </div>
        <!-- 线条粗细滑块 -->
        <div class="size-slider-wrap">
          <span class="size-dot small"></span>
          <input type="range" class="size-slider" min="4" max="80" value="30" />
          <span class="size-dot large"></span>
        </div>
        <span class="toolbar-divider"></span>
        <!-- 工具按钮 -->
        <button class="tool-btn" data-tool="arrow" title="箭头 + 文字 (画完箭头自动输入文字)">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" transform="rotate(45 12 12)"/></svg>
        </button>
        <button class="tool-btn" data-tool="rect" title="矩形框 (Shift=正方形)">
          <svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button class="tool-btn" data-tool="ellipse" title="椭圆/圆形 (Shift=正圆)">
          <svg viewBox="0 0 24 24" width="20" height="20"><ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button class="tool-btn" data-tool="line" title="直线 (Shift=锁定角度)">
          <svg viewBox="0 0 24 24" width="20" height="20"><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button class="tool-btn active" data-tool="brush" title="画笔 (自由绘制)">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z"/></svg>
        </button>
        <button class="tool-btn" data-tool="highlighter" title="高亮笔 (荧光笔效果)">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        </button>
        <span class="toolbar-divider"></span>
        <button class="tool-btn" data-tool="text" title="文字 (带描边，任何背景都清晰)">
          <span style="font-size:14px;font-weight:700;text-shadow:0 0 2px #000">Aa</span>
        </button>
        <span class="toolbar-divider"></span>
        <button class="tool-btn" data-action="undo" title="撤销 (Ctrl+Z)">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
        </button>
        <button class="tool-btn" data-action="clear" title="清空所有标注">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
      <div class="annotation-canvas-wrap">
        <canvas class="annotation-canvas"></canvas>
        <div class="annotation-loading">加载图片中...</div>
        <input type="text" class="arrow-text-input" placeholder="输入文字后按回车..." style="display:none" />
      </div>
      <div class="annotation-footer">
        <textarea class="annotation-note" placeholder="审核建议（会保存到该文件的备注中）..." rows="2"></textarea>
        <div class="annotation-actions">
          <span class="shortcut-hint">Ctrl+C 复制 | Ctrl+Z 撤销 | Shift 锁定比例</span>
          <button class="btn secondary" data-action="copy">📋 复制</button>
          <button class="btn secondary" data-action="save-local">💾 保存</button>
          <button class="btn primary" data-action="save-cloud">☁️ 替换云端</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const canvas = overlay.querySelector('.annotation-canvas');
  const ctx = canvas.getContext('2d');
  const loadingEl = overlay.querySelector('.annotation-loading');
  const noteInput = overlay.querySelector('.annotation-note');

  let baseImage = null;
  let currentTool = 'brush';
  let strokeColor = '#ff0000';
  let fillColor = '#ff0000';
  let currentSize = 20;
  let isFilled = true;
  let isDrawing = false;
  let startX = 0, startY = 0;
  let history = [];
  let historyIndex = -1;
  let tempCanvas = null; // 用于预览形状

  // 加载图片 - 渐进式加载：先显示低分辨率，后台加载高分辨率
  const img = new Image();
  img.crossOrigin = 'anonymous';

  // 标记是否已加载过高分辨率版本
  let isHighResLoaded = false;

  // 1. 先快速加载低分辨率缩略图（w400）实现即时显示
  const lowResImg = new Image();
  lowResImg.crossOrigin = 'anonymous';
  lowResImg.src = `https://drive.google.com/thumbnail?id=${imageFileId}&sz=w400&t=${Date.now()}`;

  lowResImg.onload = () => {
    // 只有高分辨率还没加载完成时才显示低分辨率
    if (!isHighResLoaded) {
      loadingEl.style.display = 'none';
      canvas.width = lowResImg.width;
      canvas.height = lowResImg.height;
      ctx.drawImage(lowResImg, 0, 0);
      baseImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
      saveToHistory();
    }
  };

  // 2. 后台异步加载高分辨率图片（w1200）
  (async () => {
    try {
      const blobUrl = await fetchDriveImageNoCache(imageFileId, 'w1200');
      img.src = blobUrl;
    } catch (err) {
      img.src = `https://drive.google.com/thumbnail?id=${imageFileId}&sz=w1200&t=${Date.now()}`;
    }
  })();

  img.onload = () => {
    isHighResLoaded = true;
    loadingEl.style.display = 'none';
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    baseImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // 清空历史并重新开始（高分辨率版本）
    history = [];
    historyIndex = -1;
    saveToHistory();
  };

  img.onerror = () => {
    // 如果高分辨率加载失败，但低分辨率已显示，则不显示错误
    if (!baseImage) {
      loadingEl.textContent = '图片加载失败';
    }
  };

  function saveToHistory() {
    // 删除当前位置之后的历史
    history = history.slice(0, historyIndex + 1);
    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    historyIndex = history.length - 1;
    // 限制历史记录数量
    if (history.length > 20) {
      history.shift();
      historyIndex--;
    }
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      ctx.putImageData(history[historyIndex], 0, 0);
    }
  }

  function clearCanvas() {
    if (baseImage) {
      ctx.putImageData(baseImage, 0, 0);
      saveToHistory();
    }
  }

  // 绘图事件
  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    startX = (e.clientX - rect.left) * scaleX;
    startY = (e.clientY - rect.top) * scaleY;

    if (currentTool === 'brush' || currentTool === 'highlighter') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.strokeStyle = currentTool === 'highlighter'
        ? hexToRgba(strokeColor, 0.4)  // 荧光笔半透明
        : strokeColor;
      ctx.lineWidth = currentTool === 'highlighter' ? currentSize * 3 : currentSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (currentTool === 'highlighter') {
        ctx.globalCompositeOperation = 'multiply';
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (currentTool === 'brush' || currentTool === 'highlighter') {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  });

  let shiftPressed = false;
  let pendingArrowEnd = null;
  const arrowTextInput = overlay.querySelector('.arrow-text-input');

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') shiftPressed = true;
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') shiftPressed = false;
  });

  canvas.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.globalCompositeOperation = 'source-over'; // 重置

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let endX = (e.clientX - rect.left) * scaleX;
    let endY = (e.clientY - rect.top) * scaleY;

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = isFilled ? hexToRgba(strokeColor, 0.3) : 'transparent';
    ctx.lineWidth = currentSize;

    // Shift 键约束
    if (shiftPressed) {
      if (currentTool === 'rect') {
        // 正方形
        const size = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
        endX = startX + (endX > startX ? size : -size);
        endY = startY + (endY > startY ? size : -size);
      } else if (currentTool === 'ellipse') {
        // 正圆
        const size = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
        endX = startX + (endX > startX ? size : -size);
        endY = startY + (endY > startY ? size : -size);
      } else if (currentTool === 'line') {
        // 锁定角度 (0°, 45°, 90°)
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        endX = startX + Math.cos(snappedAngle) * dist;
        endY = startY + Math.sin(snappedAngle) * dist;
      }
    }

    if (currentTool === 'arrow') {
      drawArrow(ctx, startX, startY, endX, endY);
      // 箭头+文字一体化：画完箭头后自动等待输入文字
      pendingArrowEnd = { x: endX, y: endY };
      showArrowTextInput(endX, endY, rect);
    } else if (currentTool === 'rect') {
      if (isFilled) {
        ctx.fillRect(startX, startY, endX - startX, endY - startY);
      }
      ctx.strokeRect(startX, startY, endX - startX, endY - startY);
      saveToHistory();
    } else if (currentTool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      saveToHistory();
    } else if (currentTool === 'ellipse') {
      drawEllipse(ctx, startX, startY, endX, endY);
      saveToHistory();
    } else if (currentTool === 'text') {
      const text = prompt('请输入文字:');
      if (text) {
        drawTextWithOutline(ctx, text, startX, startY);
        saveToHistory();
      }
    } else if (currentTool === 'brush' || currentTool === 'highlighter') {
      saveToHistory();
    }
  });

  function showArrowTextInput(x, y, canvasRect) {
    const wrapRect = overlay.querySelector('.annotation-canvas-wrap').getBoundingClientRect();
    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;

    arrowTextInput.style.display = 'block';
    arrowTextInput.style.left = `${(x * scaleX) + (canvasRect.left - wrapRect.left) + 15}px`;
    arrowTextInput.style.top = `${(y * scaleY) + (canvasRect.top - wrapRect.top) - 10}px`;
    arrowTextInput.style.color = strokeColor;
    arrowTextInput.value = '';
    arrowTextInput.focus();
  }

  arrowTextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = arrowTextInput.value.trim();
      if (text && pendingArrowEnd) {
        drawTextWithOutline(ctx, text, pendingArrowEnd.x + 10, pendingArrowEnd.y + 5);
        saveToHistory();
      }
      arrowTextInput.style.display = 'none';
      pendingArrowEnd = null;
    } else if (e.key === 'Escape') {
      arrowTextInput.style.display = 'none';
      pendingArrowEnd = null;
      saveToHistory();
    }
  });

  arrowTextInput.addEventListener('blur', () => {
    const text = arrowTextInput.value.trim();
    if (text && pendingArrowEnd) {
      drawTextWithOutline(ctx, text, pendingArrowEnd.x + 10, pendingArrowEnd.y + 5);
    }
    arrowTextInput.style.display = 'none';
    if (pendingArrowEnd) {
      saveToHistory();
      pendingArrowEnd = null;
    }
  });

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawArrow(ctx, fromX, fromY, toX, toY) {
    const headLen = Math.max(24, currentSize * 3.5);
    const headWidth = Math.max(12, headLen * 0.6);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    const tipX = toX;
    const tipY = toY;
    const lineEndX = tipX - headLen * Math.cos(angle);
    const lineEndY = tipY - headLen * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      lineEndX + (headWidth / 2) * Math.sin(angle),
      lineEndY - (headWidth / 2) * Math.cos(angle)
    );
    ctx.lineTo(
      lineEndX - (headWidth / 2) * Math.sin(angle),
      lineEndY + (headWidth / 2) * Math.cos(angle)
    );
    ctx.closePath();
    ctx.fillStyle = strokeColor;
    ctx.fill();
  }

  function drawEllipse(ctx, x1, y1, x2, y2) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (isFilled) {
      ctx.fill();
    }
    ctx.stroke();
  }

  // 带描边的文字（在任何背景上都清晰可见）
  function drawTextWithOutline(ctx, text, x, y) {
    const fontSize = Math.max(18, currentSize * 4);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';

    // 白色描边
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);

    // 彩色填充
    ctx.fillStyle = strokeColor;
    ctx.fillText(text, x, y);
  }

  // 工具栏事件 - 工具选择
  overlay.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
    });
  });

  // 填充切换
  const filledToggle = overlay.querySelector('[data-toggle="filled"]');
  if (filledToggle) {
    filledToggle.addEventListener('click', () => {
      isFilled = !isFilled;
      filledToggle.classList.toggle('active', isFilled);
    });
  }

  // 预设颜色选择（Monosnap 风格：只提供几种醒目颜色）
  overlay.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      strokeColor = btn.dataset.color;
      // 更新填充切换按钮的颜色显示
      const toggleIcon = overlay.querySelector('.toggle-icon');
      if (toggleIcon) {
        toggleIcon.style.background = isFilled ? strokeColor : 'transparent';
        toggleIcon.style.borderColor = strokeColor;
      }
    });
  });

  // 粗细滑块
  overlay.querySelector('.size-slider')?.addEventListener('input', (e) => {
    currentSize = parseInt(e.target.value, 10);
  });

  overlay.querySelector('[data-action="undo"]')?.addEventListener('click', undo);
  overlay.querySelector('[data-action="clear"]')?.addEventListener('click', clearCanvas);

  // 复制到剪贴板
  overlay.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    try {
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        appendLog({ status: 'success', message: '标注图已复制到剪贴板' });
      }, 'image/png');
    } catch (error) {
      appendLog({ status: 'error', message: '复制失败: ' + error.message });
    }
  });

  // 保存到本地
  overlay.querySelector('[data-action="save-local"]').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `annotated_${fileName}`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // 复制函数
  async function copyAnnotatedImage() {
    try {
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        appendLog({ status: 'success', message: '✅ 标注图已复制到剪贴板' });
      }, 'image/png');
    } catch (error) {
      appendLog({ status: 'error', message: '复制失败: ' + error.message });
    }
  }

  // 保存并替换云端
  const saveCloudBtn = overlay.querySelector('[data-action="save-cloud"]');
  saveCloudBtn.addEventListener('click', async () => {
    const note = noteInput.value.trim();
    const originalText = saveCloudBtn.textContent;

    try {
      saveCloudBtn.disabled = true;
      saveCloudBtn.textContent = '⏳ 保存中...';

      // 获取标注后的图片数据
      const imageDataUrl = canvas.toDataURL('image/png');
      if (imageFileId) {
        cacheAnnotatedPreview(imageFileId, imageDataUrl);
        refreshThumbnailsForFileId(imageFileId);
      }
      const imageBlob = await (await fetch(imageDataUrl)).blob();

      // 保存建议
      if (rowNumber) {
        updateFileReviewNoteLocal(parseInt(rowNumber, 10), note);
        if (note) {
          await saveReviewStatus({
            rowNumber: parseInt(rowNumber, 10),
            reviewNote: note
          });
        }
      }

      // 上传替换文件
      if (fileId && window.bridge.uploadAnnotatedImage) {
        saveCloudBtn.textContent = '⏳ 上传中...';
        const result = await window.bridge.uploadAnnotatedImage({
          fileId,
          fileName: `annotated_${fileName}`,
          imageData: imageDataUrl,
          rowNumber: rowNumber ? parseInt(rowNumber, 10) : null
        });

        if (result.success) {
          appendLog({ status: 'success', message: '✅ 标注图已保存到云端' });
          saveCloudBtn.textContent = '✅ 已保存';
          if (result.fileId) {
            cacheAnnotatedPreview(result.fileId, imageDataUrl);
            updateFileReviewAnnotatedLocal(rowNumber, result.fileId, result.annotatedTime);
            refreshThumbnailsForFileId(result.fileId);

            // 同步标注信息到 Firebase
            if (window.bridge?.firebase && state.firebaseInitialized && state.firebaseSheetId) {
              window.bridge.firebase.updateFileStatus(state.firebaseSheetId, parseInt(rowNumber, 10), {
                annotatedFileId: result.fileId,
                annotatedTime: result.annotatedTime || Date.now()
              }).catch(err => console.warn('同步标注到 Firebase 失败:', err.message));
            }
          }
          // 刷新审核列表以显示更新后的图片
          try {
            await loadFileReviewEntries({ silent: true });
            if (result.fileId) {
              refreshThumbnailsForFileId(result.fileId);
            }
          } catch (refreshErr) {
            console.warn('刷新审核列表失败:', refreshErr);
          }
          setTimeout(() => {
            overlay.remove();
          }, 1000);
        } else {
          throw new Error(result.error || '上传失败');
        }
      } else {
        // 如果后端不支持，先复制到剪贴板
        await copyAnnotatedImage();
        appendLog({ status: 'info', message: '💡 云端替换功能暂不可用，已复制到剪贴板' });
        saveCloudBtn.textContent = originalText;
      }
    } catch (error) {
      appendLog({ status: 'error', message: '保存失败: ' + error.message });
      saveCloudBtn.textContent = originalText;
    } finally {
      saveCloudBtn.disabled = false;
    }
  });

  // 快捷键处理
  const handleKeyDown = (e) => {
    // Ctrl+C / Cmd+C 复制
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      copyAnnotatedImage();
    }
    // Ctrl+Z / Cmd+Z 撤销
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    // ESC 关闭
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  // 关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('annotation-tool-close')) {
      overlay.remove();
      document.removeEventListener('keydown', handleKeyDown);
    }
  });
}

/**
 * 悬浮预览 - 浮动窗口风格，支持缩放和标注
 * @param {boolean} fullscreen - 是否全屏模式（单击打开时使用）
 */
let hoverPreviewElement = null;
let hoverPreviewData = null;
const annotatedPreviewCache = new Map();
const ANNOTATED_CACHE_TTL = 2 * 60 * 1000;

function getAnnotatedPreviewUrl(fileId) {
  const entry = annotatedPreviewCache.get(fileId);
  if (!entry) return '';
  if (Date.now() - entry.timestamp > ANNOTATED_CACHE_TTL) {
    if (entry.url && entry.url.startsWith('blob:')) {
      URL.revokeObjectURL(entry.url);
    }
    annotatedPreviewCache.delete(fileId);
    return '';
  }
  return entry.url;
}

async function cacheAnnotatedPreview(fileId, dataUrl) {
  if (!fileId || !dataUrl) return;
  const prev = annotatedPreviewCache.get(fileId);
  if (prev?.url && prev.url.startsWith('blob:')) {
    URL.revokeObjectURL(prev.url);
  }
  annotatedPreviewCache.set(fileId, { url: dataUrl, timestamp: Date.now() });
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const blobUrl = URL.createObjectURL(blob);
    annotatedPreviewCache.set(fileId, { url: blobUrl, timestamp: Date.now() });
  } catch (error) {
    console.warn('Failed to cache annotated preview:', error);
  }
}

function showHoverPreview(fileId, fileName, fileLink, rowNumber, targetElement, fullscreen = false, previewFileId = null) {
  hideHoverPreview(true); // 强制隐藏之前的

  hoverPreviewData = { fileId, fileName, fileLink, rowNumber, fullscreen, previewFileId };
  const imageFileId = previewFileId || fileId;

  hoverPreviewElement = document.createElement('div');
  hoverPreviewElement.className = 'file-hover-preview enhanced with-annotation' + (fullscreen ? ' fullscreen' : '');
  hoverPreviewElement.innerHTML = `
    <div class="hover-preview-header">
      <span class="hover-nav-indicator">-/-</span>
      <span class="hover-preview-title">${escapeHtml(fileName)}</span>
      <div class="hover-preview-controls">
        <button class="hover-zoom-btn" data-action="zoom-out" title="缩小"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        <span class="hover-zoom-level">100%</span>
        <button class="hover-zoom-btn" data-action="zoom-in" title="放大"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        <button class="hover-zoom-btn save-btn" data-action="save" title="保存标记到云端"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
        <button class="hover-zoom-btn pin-btn" data-action="pin" title="固定窗口"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10l-7-7-4 4-3-3-3 3 3 3-4 4 7 7 4-4 3 3 3-3-3-3 4-4z"/></svg></button>
        <button class="hover-zoom-btn close-btn" data-action="close" title="关闭"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
    </div>
    <!-- 标注工具栏 -->
    <div class="hover-annotation-toolbar">
      <div class="color-preset-group">
        <button class="color-preset active" data-color="#ff0000" style="background:#ff0000" title="红色"></button>
        <button class="color-preset" data-color="#ff1493" style="background:#ff1493" title="粉色"></button>
        <button class="color-preset" data-color="#ff9800" style="background:#ff9800" title="橙色"></button>
        <button class="color-preset" data-color="#4caf50" style="background:#4caf50" title="绿色"></button>
        <button class="color-preset" data-color="#2196f3" style="background:#2196f3" title="蓝色"></button>
      </div>
      <label class="size-label" title="线条粗细">
        粗细: <input type="range" class="size-slider" min="4" max="80" value="30" />
      </label>
      <span class="toolbar-divider"></span>
      <button class="anno-btn active" data-tool="pan" title="拖拽移动画布"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg></button>
      <button class="anno-btn" data-tool="select" title="选择/编辑标注"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg></button>
      <button class="anno-btn" data-tool="brush" title="自由画笔"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20.985a2 2 0 0 1-2.828 0l-12-12a2 2 0 0 1 0-2.828l2.828-2.828a2 2 0 0 1 2.828 0l12 12a2 2 0 0 1 0 2.828l-2.828 2.828z"/><path d="M14 6l4 4"/><path d="M4 16v4h4"/></svg></button>
      <button class="anno-btn" data-tool="arrow" title="画箭头"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="5 5 19 5 19 19"/></svg></button>
      <button class="anno-btn" data-tool="line" title="画直线"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg></button>
      <button class="anno-btn" data-tool="rect" title="画矩形框"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg></button>
      <button class="anno-btn" data-tool="ellipse" title="画椭圆框"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg></button>
      <button class="anno-btn" data-tool="text" title="添加文字"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg></button>
      <span class="toolbar-divider"></span>
      <button class="anno-btn" data-action="undo" title="撤销 (Ctrl+Z)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>
      <button class="anno-btn" data-action="delete" title="删除选中"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </div>
    <div class="hover-preview-body">
      <!-- 左侧导航按钮 -->
      <button class="hover-nav-btn side-nav left" data-action="prev" title="上一张 (←)">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <canvas class="hover-annotation-canvas"></canvas>
      <div class="hover-preview-loading">加载中...</div>
      <input type="text" class="hover-text-input" placeholder="输入文字后按回车..." style="display:none" />
      <!-- 右侧导航按钮 -->
      <button class="hover-nav-btn side-nav right" data-action="next" title="下一张 (→)">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
    <div class="hover-preview-footer">
      <div class="hover-review-actions">
        <button class="hover-review-btn approve" data-action="approve" data-row="${rowNumber || ''}" data-file-id="${fileId}" title="标记为合格">✓ 合格</button>
        <button class="hover-review-btn reject" data-action="reject" data-row="${rowNumber || ''}" data-file-id="${fileId}" title="标记为不合格">✗ 不合格</button>
        <button class="hover-review-btn discard" data-action="discard" data-row="${rowNumber || ''}" data-file-id="${fileId}" title="作废（不用修改）">🗑️ 作废</button>
        <button class="hover-review-btn replace" data-action="replace" data-row="${rowNumber || ''}" data-file-id="${fileId}" data-file-name="${escapeHtml(fileName)}" title="替换文件">🔄 替换</button>
        <button class="hover-review-btn delete" data-action="delete-file" data-row="${rowNumber || ''}" data-file-id="${fileId}" data-file-name="${escapeHtml(fileName)}" title="删除文件">🗑 删除</button>
      </div>
      <div class="hover-note-section">
        <input type="text" 
               class="hover-preview-note-input" 
               placeholder="输入审核建议..."
               data-row="${rowNumber || ''}"
               data-file-id="${fileId}" />
        <button class="hover-note-save-btn" title="点击保存 / 回车保存">💾 保存</button>
      </div>
      <div class="hover-actions">
        <span class="hover-save-status">未保存</span>
        <button class="hover-action-btn" data-action="copy" title="复制到剪贴板">📋 复制</button>
        <button class="hover-action-btn save-primary" data-action="save" title="保存到云端">☁️ 保存标记</button>
      </div>
    </div>
    <div class="hover-preview-resizer" title="拖拽缩放"></div>
  `;

  document.body.appendChild(hoverPreviewElement);

  // 计算位置
  if (fullscreen) {
    // 全屏模式：居中，尽可能大
    const maxWidth = Math.min(window.innerWidth * 0.95, 1400);
    const maxHeight = Math.min(window.innerHeight * 0.92, 950);
    hoverPreviewElement.style.left = '50%';
    hoverPreviewElement.style.top = '50%';
    hoverPreviewElement.style.transform = 'translate(-50%, -50%)';
    hoverPreviewElement.style.width = `${maxWidth}px`;
    hoverPreviewElement.style.height = `${maxHeight}px`;
    hoverPreviewElement.style.maxWidth = '98vw';
    hoverPreviewElement.style.maxHeight = '96vh';
  } else if (targetElement) {
    // 悬浮模式：优先在目标上方显示
    const rect = targetElement.getBoundingClientRect();
    const previewWidth = 700;
    const previewHeight = 650; // 增大高度
    const margin = 10;

    // 计算水平位置：在缩略图右侧或左侧
    let left = rect.right + margin;
    if (left + previewWidth > window.innerWidth) {
      left = rect.left - previewWidth - margin;
    }
    if (left < margin) {
      left = Math.max(margin, (window.innerWidth - previewWidth) / 2);
    }

    // 计算垂直位置：优先在上方，如果上方空间不够则在下方
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    let top;

    if (spaceAbove >= previewHeight + margin) {
      // 上方空间足够，显示在上方
      top = rect.top - previewHeight - margin;
    } else if (spaceBelow >= previewHeight + margin) {
      // 下方空间足够，显示在下方
      top = rect.bottom + margin;
    } else {
      // 两边空间都不够，居中显示
      top = Math.max(margin, (window.innerHeight - previewHeight) / 2);
    }

    // 确保不超出视口
    top = Math.max(margin, Math.min(top, window.innerHeight - previewHeight - margin));

    hoverPreviewElement.style.left = `${left}px`;
    hoverPreviewElement.style.top = `${top}px`;
    hoverPreviewElement.style.width = `${previewWidth}px`;
    hoverPreviewElement.style.height = `${previewHeight}px`;
  }

  // Canvas 和上下文
  const canvas = hoverPreviewElement.querySelector('.hover-annotation-canvas');
  const ctx = canvas.getContext('2d');
  const body = hoverPreviewElement.querySelector('.hover-preview-body');
  const zoomLevel = hoverPreviewElement.querySelector('.hover-zoom-level');
  const loadingEl = hoverPreviewElement.querySelector('.hover-preview-loading');
  const textInput = hoverPreviewElement.querySelector('.hover-text-input');
  const resizer = hoverPreviewElement.querySelector('.hover-preview-resizer');

  // 视图状态
  let baseImage = null;
  let scale = 1;
  let translateX = 0, translateY = 0;
  let isPanning = false;
  let panStartX = 0, panStartY = 0;

  // 标注对象数组
  let annotations = [];
  let selectedAnnotation = null;
  let dragHandle = null; // 'move', 'rotate', 'scale-tl', 'scale-tr', 'scale-bl', 'scale-br'
  let didTransform = false;

  let isDirty = false;
  let isSaving = false;
  let isPinned = false;
  const saveStatusEl = hoverPreviewElement.querySelector('.hover-save-status');
  const pinBtn = hoverPreviewElement.querySelector('.hover-zoom-btn.pin-btn');
  const saveButtons = Array.from(hoverPreviewElement.querySelectorAll('[data-action="save"]'));

  function updateSaveStatus() {
    if (!saveStatusEl) return;
    if (hoverPreviewElement) {
      hoverPreviewElement.dataset.dirty = isDirty ? 'true' : 'false';
    }
    if (isSaving) {
      saveStatusEl.textContent = '保存中...';
      saveStatusEl.classList.remove('saved');
      return;
    }
    if (isDirty) {
      saveStatusEl.textContent = '未保存';
      saveStatusEl.classList.remove('saved');
      return;
    }
    saveStatusEl.textContent = '已保存';
    saveStatusEl.classList.add('saved');
  }

  function updatePinUI() {
    if (pinBtn) {
      pinBtn.classList.toggle('active', isPinned);
      pinBtn.title = isPinned ? '已固定' : '固定窗口';
    }
    if (hoverPreviewElement) {
      hoverPreviewElement.dataset.pinned = isPinned ? 'true' : 'false';
    }
  }

  function updateAnnotatedFlag() {
    if (!hoverPreviewElement) return;
    hoverPreviewElement.dataset.annotated = annotations.length > 0 ? 'true' : 'false';
  }

  function markDirty() {
    if (!isDirty) {
      isDirty = true;
      if (!fullscreen && !isPinned) {
        isPinned = true;
        updatePinUI();
      }
      updateSaveStatus();
    }
    if (hoverPreviewElement) {
      hoverPreviewElement.dataset.autoclose = 'false';
    }
    updateAnnotatedFlag();
  }

  updateSaveStatus();
  updatePinUI();
  updateAnnotatedFlag();
  if (hoverPreviewElement) {
    hoverPreviewElement.dataset.autoclose = 'false';
  }

  if (resizer) {
    if (fullscreen) {
      resizer.style.display = 'none';
    } else {
      let resizing = false;
      let startX = 0;
      let startY = 0;
      let startW = 0;
      let startH = 0;

      const onMove = (e) => {
        if (!resizing) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const minW = 400;
        const minH = 300;
        const maxW = window.innerWidth - 20;
        const maxH = window.innerHeight - 20;
        const nextW = Math.max(minW, Math.min(maxW, startW + dx));
        const nextH = Math.max(minH, Math.min(maxH, startH + dy));
        hoverPreviewElement.style.width = `${nextW}px`;
        hoverPreviewElement.style.height = `${nextH}px`;
      };

      const onUp = () => {
        resizing = false;
        hoverPreviewElement.dataset.resizing = 'false';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        hoverPreviewElement.dataset.resizing = 'true';
        hoverPreviewElement.dataset.hover = 'true';
        hoverPreviewElement.dataset.autoclose = 'false';
        isPinned = true;
        updatePinUI();
        const rect = hoverPreviewElement.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startW = rect.width;
        startH = rect.height;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }
  }

  async function saveHoverAnnotations(triggerBtn = null) {
    if (!fileId || !window.bridge?.uploadAnnotatedImage) {
      appendLog({ status: 'error', message: '当前版本不支持保存标记' });
      return false;
    }
    if (isSaving) return false;
    isSaving = true;
    updateSaveStatus();

    const targets = triggerBtn ? [triggerBtn] : saveButtons;
    const originalLabels = targets.map(btn => btn.textContent);
    targets.forEach(btn => {
      btn.disabled = true;
      btn.textContent = '⏳';
    });

    try {
      if (rowNumber && previewNoteInput) {
        updateFileReviewNoteLocal(parseInt(rowNumber, 10), previewNoteInput.value || '');
      }
      const imageDataUrl = canvas.toDataURL('image/png');
      cacheAnnotatedPreview(imageFileId, imageDataUrl);
      refreshThumbnailsForFileId(imageFileId);
      const result = await window.bridge.uploadAnnotatedImage({
        fileId,
        fileName: `annotated_${fileName || 'image.png'}`,
        imageData: imageDataUrl,
        rowNumber: rowNumber ? parseInt(rowNumber, 10) : null
      });
      if (!result?.success) {
        throw new Error(result?.error || '上传失败');
      }
      if (result.fileId) {
        cacheAnnotatedPreview(result.fileId, imageDataUrl);
        updateFileReviewAnnotatedLocal(rowNumber, result.fileId, result.annotatedTime);
        refreshThumbnailsForFileId(result.fileId);
      }
      loadFileReviewEntries({ silent: true })
        .then(() => {
          if (result.fileId) {
            refreshThumbnailsForFileId(result.fileId);
          }
        })
        .catch(err => console.warn('后台刷新失败:', err));
      appendLog({ status: 'success', message: '✅ 标记已保存到云端' });
      isDirty = false;
      updateSaveStatus();
      if (hoverPreviewElement) {
        hoverPreviewElement.dataset.autoclose = 'true';
      }
      if (!fullscreen) {
        isPinned = false;
        updatePinUI();
      }
      return true;
    } catch (error) {
      appendLog({ status: 'error', message: `保存失败: ${error.message}` });
      updateSaveStatus();
      return false;
    } finally {
      isSaving = false;
      targets.forEach((btn, idx) => {
        if (!document.contains(btn)) return;
        btn.textContent = originalLabels[idx] || btn.textContent;
        btn.disabled = false;
      });
    }
  }

  // 绘制状态
  let isDrawing = false;
  let startX = 0, startY = 0;
  let currentTool = 'pan';
  let strokeColor = '#ff0000';
  let lineWidth = 30;
  let pendingTextPos = null;

  // 加载现有的审核备注
  const previewNoteInput = hoverPreviewElement.querySelector('.hover-preview-note-input');
  if (previewNoteInput && rowNumber) {
    // 尝试从当前文件列表中获取备注
    const file = state.fileReviewFiles?.find(f => f.rowNumber == rowNumber);
    if (file?.reviewNote) {
      previewNoteInput.value = file.reviewNote;
    }
  }

  // 初始化导航指示器和按钮
  const navIndicator = hoverPreviewElement.querySelector('.hover-nav-indicator');
  const navPrevBtn = hoverPreviewElement.querySelector('.hover-nav-btn[data-action="prev"]');
  const navNextBtn = hoverPreviewElement.querySelector('.hover-nav-btn[data-action="next"]');

  function updateNavIndicator() {
    if (!navIndicator) {
      if (navPrevBtn) navPrevBtn.style.display = 'none';
      if (navNextBtn) navNextBtn.style.display = 'none';
      return;
    }

    // 获取整个审核列表中的所有有效文件（非参考文件）
    const allFiles = state.fileReviewFiles?.filter(f => !f.isReference && f.fileId) || [];
    const currentIndex = rowNumber ? allFiles.findIndex(f => f.rowNumber == rowNumber) : -1;

    if (allFiles.length > 1) {
      // 显示当前位置 / 总数
      if (currentIndex !== -1) {
        navIndicator.textContent = `${currentIndex + 1}/${allFiles.length}`;
      } else {
        navIndicator.textContent = `1/${allFiles.length}`;
      }
      if (navPrevBtn) navPrevBtn.style.display = '';
      if (navNextBtn) navNextBtn.style.display = '';
    } else if (allFiles.length === 1) {
      navIndicator.textContent = '1/1';
      if (navPrevBtn) navPrevBtn.style.display = 'none';
      if (navNextBtn) navNextBtn.style.display = 'none';
    } else {
      navIndicator.textContent = '';
      if (navPrevBtn) navPrevBtn.style.display = 'none';
      if (navNextBtn) navNextBtn.style.display = 'none';
    }
  }
  updateNavIndicator();

  // 导航按钮点击事件（会在后面的 handleKeyDown 作用域中定义 navigateToAdjacentFile）
  if (navPrevBtn) {
    navPrevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 使用全局导航
      if (typeof navigateToAdjacentFile === 'function') {
        navigateToAdjacentFile('prev');
      }
    });
  }
  if (navNextBtn) {
    navNextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof navigateToAdjacentFile === 'function') {
        navigateToAdjacentFile('next');
      }
    });
  }

  // 加载图片 - 渐进式加载：先显示低分辨率，后台加载高分辨率
  const img = new Image();
  img.crossOrigin = 'anonymous';

  // 标记是否已加载过高分辨率版本
  let isHighResLoaded = false;

  // 更新画布的通用函数 - 保持原始分辨率
  function updateCanvas(image) {
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    baseImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // 重绘标注
    annotations.forEach((anno, idx) => drawAnnotation(anno, anno === selectedAnnotation));
  }

  // 🔴 优化：初始隐藏 loading，只有加载时间超过 150ms 才显示
  // 这样缓存的图片可以立即显示，不会闪烁"加载中"
  loadingEl.style.display = 'none';
  let loadingTimeout = setTimeout(() => {
    // 只有还没加载完成才显示 loading
    if (!baseImage) {
      loadingEl.style.display = '';
    }
  }, 150);

  // 1. 先快速加载低分辨率缩略图（w400）实现即时显示
  const lowResImg = new Image();
  lowResImg.crossOrigin = 'anonymous';
  const cachedAnnotated = getAnnotatedPreviewUrl(imageFileId);
  if (cachedAnnotated) {
    lowResImg.src = cachedAnnotated;
  } else {
    (async () => {
      try {
        const cachedUrl = await resolveCachedThumbUrl(imageFileId, 400);
        if (cachedUrl) {
          lowResImg.src = cachedUrl;
          return;
        }
        const blobUrl = await fetchDriveImageNoCache(imageFileId, 'w400');
        lowResImg.src = blobUrl;
      } catch (err) {
        lowResImg.src = `https://drive.google.com/thumbnail?id=${imageFileId}&sz=w400&t=${Date.now()}`;
      }
    })();
  }

  lowResImg.onload = () => {
    // 只有高分辨率还没加载完成时才显示低分辨率
    if (!isHighResLoaded) {
      clearTimeout(loadingTimeout);
      loadingEl.style.display = 'none';
      updateCanvas(lowResImg);
      if (cachedAnnotated) {
        isHighResLoaded = true;
      }
    }
  };

  // 2. 后台异步加载高分辨率图片（w1200）
  if (!cachedAnnotated) {
    (async () => {
      try {
        const cachedUrl = await resolveCachedThumbUrl(imageFileId, 1200);
        if (cachedUrl) {
          img.src = cachedUrl;
          return;
        }
        const blobUrl = await fetchDriveImageNoCache(imageFileId, 'w1200');
        img.src = blobUrl;
      } catch (err) {
        // 回退到直接 URL
        img.src = `https://drive.google.com/thumbnail?id=${imageFileId}&sz=w1200&t=${Date.now()}`;
      }
    })();
  }

  img.onload = () => {
    isHighResLoaded = true;
    clearTimeout(loadingTimeout);
    loadingEl.style.display = 'none';
    updateCanvas(img);
  };

  img.onerror = () => {
    // 如果高分辨率加载失败，但低分辨率已显示，则不显示错误
    if (!baseImage) {
      loadingEl.textContent = '加载失败';
    }
  };

  // 重新绘制所有内容
  function redraw() {
    if (!baseImage) return;
    ctx.putImageData(baseImage, 0, 0);
    annotations.forEach((anno, idx) => drawAnnotation(anno, anno === selectedAnnotation));
  }

  // 绘制单个标注
  function drawAnnotation(anno, isSelected) {
    ctx.save();

    // 应用变换
    const cx = anno.x + (anno.width || 0) / 2;
    const cy = anno.y + (anno.height || 0) / 2;
    ctx.translate(cx, cy);
    ctx.rotate((anno.rotation || 0) * Math.PI / 180);
    ctx.scale(anno.scaleX || 1, anno.scaleY || 1);
    ctx.translate(-cx, -cy);

    ctx.strokeStyle = anno.color;
    ctx.fillStyle = anno.color;
    ctx.lineWidth = anno.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (anno.type === 'brush' && anno.points) {
      ctx.beginPath();
      anno.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (anno.type === 'arrow') {
      const headLen = Math.max(24, anno.lineWidth * 4);
      const headWidth = Math.max(12, headLen * 0.6);
      const angle = Math.atan2(anno.endY - anno.y, anno.endX - anno.x);
      const tipX = anno.endX;
      const tipY = anno.endY;
      const lineEndX = tipX - headLen * Math.cos(angle);
      const lineEndY = tipY - headLen * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(anno.x, anno.y);
      ctx.lineTo(lineEndX, lineEndY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(
        lineEndX + (headWidth / 2) * Math.sin(angle),
        lineEndY - (headWidth / 2) * Math.cos(angle)
      );
      ctx.lineTo(
        lineEndX - (headWidth / 2) * Math.sin(angle),
        lineEndY + (headWidth / 2) * Math.cos(angle)
      );
      ctx.closePath();
      ctx.fill();
    } else if (anno.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(anno.x, anno.y);
      ctx.lineTo(anno.endX, anno.endY);
      ctx.stroke();
    } else if (anno.type === 'rect') {
      ctx.strokeRect(anno.x, anno.y, anno.width, anno.height);
    } else if (anno.type === 'ellipse') {
      const cx = anno.x + anno.width / 2;
      const cy = anno.y + anno.height / 2;
      const rx = Math.abs(anno.width) / 2;
      const ry = Math.abs(anno.height) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (anno.type === 'text') {
      ctx.font = `bold ${Math.max(14, anno.lineWidth * 4)}px sans-serif`;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeText(anno.text, anno.x, anno.y);
      ctx.fillStyle = anno.color;
      ctx.fillText(anno.text, anno.x, anno.y);
    }

    ctx.restore();

    // 绘制选中框和控制点
    if (isSelected) {
      drawSelectionBox(anno);
    }
  }

  // 绘制选中框和控制点
  function drawSelectionBox(anno) {
    const bounds = getAnnotationBounds(anno);
    if (!bounds) return;

    ctx.save();
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
    ctx.setLineDash([]);

    // 控制点
    const handleSize = 8;
    ctx.fillStyle = '#00aaff';
    // 四角缩放
    ctx.fillRect(bounds.x - 5 - handleSize / 2, bounds.y - 5 - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(bounds.x + bounds.width + 5 - handleSize / 2, bounds.y - 5 - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(bounds.x - 5 - handleSize / 2, bounds.y + bounds.height + 5 - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(bounds.x + bounds.width + 5 - handleSize / 2, bounds.y + bounds.height + 5 - handleSize / 2, handleSize, handleSize);
    // 旋转控制点（顶部中间上方）
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(bounds.x + bounds.width / 2, bounds.y - 20, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 获取标注边界（已应用缩放）
  function getAnnotationBounds(anno) {
    let bounds = null;
    const sx = anno.scaleX || 1;
    const sy = anno.scaleY || 1;

    if (anno.type === 'brush' && anno.points) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      anno.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const w = (maxX - minX) * sx;
      const h = (maxY - minY) * sy;
      bounds = { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
    } else if (anno.type === 'arrow') {
      const cx = (anno.x + anno.endX) / 2;
      const cy = (anno.y + anno.endY) / 2;
      const w = Math.abs(anno.endX - anno.x) * sx;
      const h = Math.abs(anno.endY - anno.y) * sy;
      bounds = { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
    } else if (anno.type === 'line') {
      const cx = (anno.x + anno.endX) / 2;
      const cy = (anno.y + anno.endY) / 2;
      const w = Math.abs(anno.endX - anno.x) * sx;
      const h = Math.abs(anno.endY - anno.y) * sy;
      bounds = { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
    } else if (anno.type === 'rect') {
      const cx = anno.x + anno.width / 2;
      const cy = anno.y + anno.height / 2;
      const w = anno.width * sx;
      const h = anno.height * sy;
      bounds = { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
    } else if (anno.type === 'ellipse') {
      const cx = anno.x + anno.width / 2;
      const cy = anno.y + anno.height / 2;
      const w = anno.width * sx;
      const h = anno.height * sy;
      bounds = { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
    } else if (anno.type === 'text') {
      ctx.font = `bold ${Math.max(14, anno.lineWidth * 4)}px sans-serif`;
      const metrics = ctx.measureText(anno.text || '');
      const w = metrics.width * sx;
      const h = 20 * sy;
      bounds = { x: anno.x, y: anno.y - 14, width: w, height: h };
    }
    return bounds;
  }

  // 检测点击的控制点
  function hitTestHandle(x, y, anno) {
    const bounds = getAnnotationBounds(anno);
    if (!bounds) return null;
    const handleSize = 10;

    // 旋转控制点
    if (Math.abs(x - (bounds.x + bounds.width / 2)) < handleSize && Math.abs(y - (bounds.y - 20)) < handleSize) {
      return 'rotate';
    }
    // 四角
    if (Math.abs(x - (bounds.x - 5)) < handleSize && Math.abs(y - (bounds.y - 5)) < handleSize) return 'scale-tl';
    if (Math.abs(x - (bounds.x + bounds.width + 5)) < handleSize && Math.abs(y - (bounds.y - 5)) < handleSize) return 'scale-tr';
    if (Math.abs(x - (bounds.x - 5)) < handleSize && Math.abs(y - (bounds.y + bounds.height + 5)) < handleSize) return 'scale-bl';
    if (Math.abs(x - (bounds.x + bounds.width + 5)) < handleSize && Math.abs(y - (bounds.y + bounds.height + 5)) < handleSize) return 'scale-br';

    // 内部移动
    if (x >= bounds.x - 5 && x <= bounds.x + bounds.width + 5 && y >= bounds.y - 5 && y <= bounds.y + bounds.height + 5) {
      return 'move';
    }
    return null;
  }

  // 点击测试标注
  function hitTestAnnotation(x, y) {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const bounds = getAnnotationBounds(annotations[i]);
      if (bounds && x >= bounds.x - 10 && x <= bounds.x + bounds.width + 10 &&
        y >= bounds.y - 10 && y <= bounds.y + bounds.height + 10) {
        return annotations[i];
      }
    }
    return null;
  }

  function undo() {
    if (annotations.length > 0) {
      annotations.pop();
      selectedAnnotation = null;
      redraw();
    }
  }

  function updateTransform() {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  }

  // 获取整个审核列表中的相邻文件
  function getAdjacentFileInBatch(direction) {
    // 获取整个审核列表中的所有有效文件（非参考文件）
    const allFiles = state.fileReviewFiles?.filter(f => !f.isReference && f.fileId) || [];
    if (allFiles.length < 2) return null;

    // 找到当前文件的索引
    const currentIndex = rowNumber ? allFiles.findIndex(f => f.rowNumber == rowNumber) : -1;

    // 如果找不到当前文件，默认从第一个开始
    let newIndex;
    if (currentIndex === -1) {
      newIndex = direction === 'prev' ? allFiles.length - 1 : 0;
    } else if (direction === 'prev') {
      // 上一张：循环到最后一张
      newIndex = currentIndex > 0 ? currentIndex - 1 : allFiles.length - 1;
    } else {
      // 下一张：循环到第一张
      newIndex = currentIndex < allFiles.length - 1 ? currentIndex + 1 : 0;
    }

    return allFiles[newIndex];
  }

  // 先声明 handleKeyDown，因为 navigateToAdjacentFile 需要引用它
  let handleKeyDown = null;

  // 导航到相邻文件
  function navigateToAdjacentFile(direction) {
    const nextFile = getAdjacentFileInBatch(direction);
    if (!nextFile) return;

    // 如果有未保存的标注，跳过导航（或者可以提示保存）
    if (isDirty) {
      appendLog({ status: 'warning', message: '请先保存当前标记' });
      return;
    }

    // 先移除当前的键盘事件监听器，防止监听器叠加
    if (handleKeyDown) {
      document.removeEventListener('keydown', handleKeyDown);
    }

    // 关闭当前预览并打开新文件
    const anchorTarget = !fullscreen && targetElement && targetElement.isConnected ? targetElement : null;
    hideHoverPreview(true);
    const nextPreviewId = nextFile.annotatedFileId || nextFile.fileId;
    showHoverPreview(
      nextFile.fileId,
      nextFile.fileName,
      nextFile.fileLink,
      nextFile.rowNumber,
      anchorTarget,
      fullscreen,
      nextPreviewId
    );
  }

  // 快捷键处理：Ctrl+Z 撤销，左右方向键导航
  handleKeyDown = (e) => {
    // 如果正在输入文字/备注，不处理方向键
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      undo();
      e.preventDefault();
    }

    // 左方向键：上一张
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateToAdjacentFile('prev');
    }

    // 右方向键：下一张
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateToAdjacentFile('next');
    }

    // ESC 关闭预览
    if (e.key === 'Escape') {
      if (isDirty) {
        appendLog({ status: 'warning', message: '有未保存的标记，请先保存' });
        return;
      }
      e.preventDefault();
      document.removeEventListener('keydown', handleKeyDown);
      hideHoverPreview(true);
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  // 滚轮缩放
  body.addEventListener('wheel', (e) => {
    e.preventDefault();
    scale = Math.max(0.5, Math.min(5, scale + (e.deltaY > 0 ? -0.15 : 0.15)));
    updateTransform();
  }, { passive: false });

  // 修正坐标计算 - 考虑缩放和平移
  function getCanvasCoords(e) {
    const canvasRect = canvas.getBoundingClientRect();
    const x = (e.clientX - canvasRect.left) * (canvas.width / canvasRect.width);
    const y = (e.clientY - canvasRect.top) * (canvas.height / canvasRect.height);
    return { x, y };
  }

  // 临时画布用于实时预览
  let tempImageData = null;

  // 更新光标样式
  function updateCursor() {
    if (currentTool === 'pan') canvas.style.cursor = 'grab';
    else if (currentTool === 'select') canvas.style.cursor = 'default';
    else canvas.style.cursor = 'crosshair';
  }
  updateCursor();

  // 当前绘制的临时标注
  let currentAnnotation = null;
  let dragStartX = 0, dragStartY = 0;
  let originalBounds = null;

  // 鼠标按下
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const coords = getCanvasCoords(e);
    startX = coords.x;
    startY = coords.y;
    dragStartX = coords.x;
    dragStartY = coords.y;

    // 拖拽视图
    if (currentTool === 'pan') {
      isPanning = true;
      panStartX = e.clientX - translateX;
      panStartY = e.clientY - translateY;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // 选择工具
    if (currentTool === 'select') {
      // 先检查是否点击了选中标注的控制点
      if (selectedAnnotation) {
        dragHandle = hitTestHandle(coords.x, coords.y, selectedAnnotation);
        if (dragHandle) {
          originalBounds = getAnnotationBounds(selectedAnnotation);
          e.preventDefault();
          return;
        }
      }
      // 检查是否点击了标注
      const hit = hitTestAnnotation(coords.x, coords.y);
      if (hit) {
        selectedAnnotation = hit;
        dragHandle = 'move';
        originalBounds = getAnnotationBounds(hit);
      } else {
        selectedAnnotation = null;
        dragHandle = null;
      }
      redraw();
      e.preventDefault();
      return;
    }

    // 绘制工具
    if (!fullscreen && !isPinned) {
      isPinned = true;
      updatePinUI();
    }
    isDrawing = true;
    if (currentTool === 'brush') {
      currentAnnotation = {
        type: 'brush',
        color: strokeColor,
        lineWidth: lineWidth,
        points: [{ x: coords.x, y: coords.y }],
        rotation: 0, scaleX: 1, scaleY: 1
      };
    }
    e.preventDefault();
  });

  // 鼠标移动
  canvas.addEventListener('mousemove', (e) => {
    const coords = getCanvasCoords(e);

    if (isPanning) {
      translateX = e.clientX - panStartX;
      translateY = e.clientY - panStartY;
      updateTransform();
      return;
    }

    // 选择工具变换
    if (currentTool === 'select' && selectedAnnotation && dragHandle) {
      const dx = coords.x - dragStartX;
      const dy = coords.y - dragStartY;

      if (dragHandle === 'move') {
        moveAnnotation(selectedAnnotation, dx, dy);
        dragStartX = coords.x;
        dragStartY = coords.y;
        didTransform = true;
      } else if (dragHandle === 'rotate') {
        const bounds = originalBounds;
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const angle = Math.atan2(coords.y - cy, coords.x - cx) * 180 / Math.PI + 90;
        selectedAnnotation.rotation = angle;
        didTransform = true;
      } else if (dragHandle.startsWith('scale')) {
        const bounds = originalBounds;
        const newWidth = Math.abs(coords.x - bounds.x);
        const newHeight = Math.abs(coords.y - bounds.y);
        if (bounds.width > 0) selectedAnnotation.scaleX = newWidth / bounds.width;
        if (bounds.height > 0) selectedAnnotation.scaleY = newHeight / bounds.height;
        didTransform = true;
      }
      redraw();
      return;
    }

    if (!isDrawing) return;

    // 绘制预览
    redraw();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.fillStyle = strokeColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'brush' && currentAnnotation) {
      currentAnnotation.points.push({ x: coords.x, y: coords.y });
      ctx.beginPath();
      currentAnnotation.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (currentTool === 'arrow') {
      const headLen = Math.max(24, lineWidth * 4);
      const headWidth = Math.max(12, headLen * 0.6);
      const angle = Math.atan2(coords.y - startY, coords.x - startX);
      const tipX = coords.x;
      const tipY = coords.y;
      const lineEndX = tipX - headLen * Math.cos(angle);
      const lineEndY = tipY - headLen * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(lineEndX, lineEndY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(
        lineEndX + (headWidth / 2) * Math.sin(angle),
        lineEndY - (headWidth / 2) * Math.cos(angle)
      );
      ctx.lineTo(
        lineEndX - (headWidth / 2) * Math.sin(angle),
        lineEndY + (headWidth / 2) * Math.cos(angle)
      );
      ctx.closePath();
      ctx.fill();
    } else if (currentTool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (currentTool === 'rect') {
      ctx.strokeRect(startX, startY, coords.x - startX, coords.y - startY);
    } else if (currentTool === 'ellipse') {
      const cx = (startX + coords.x) / 2;
      const cy = (startY + coords.y) / 2;
      const rx = Math.abs(coords.x - startX) / 2;
      const ry = Math.abs(coords.y - startY) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // 鼠标释放
  canvas.addEventListener('mouseup', (e) => {
    if (isPanning) {
      isPanning = false;
      updateCursor();
      return;
    }

    if (currentTool === 'select') {
      if (dragHandle && didTransform) {
        markDirty();
      }
      dragHandle = null;
      didTransform = false;
      return;
    }

    if (!isDrawing) return;
    isDrawing = false;

    const coords = getCanvasCoords(e);

    // 创建标注对象
    if (currentTool === 'brush' && currentAnnotation) {
      annotations.push(currentAnnotation);
      currentAnnotation = null;
      markDirty();
    } else if (currentTool === 'arrow') {
      annotations.push({
        type: 'arrow',
        x: startX, y: startY,
        endX: coords.x, endY: coords.y,
        color: strokeColor,
        lineWidth: lineWidth,
        rotation: 0, scaleX: 1, scaleY: 1
      });
      markDirty();
    } else if (currentTool === 'line') {
      annotations.push({
        type: 'line',
        x: startX, y: startY,
        endX: coords.x, endY: coords.y,
        color: strokeColor,
        lineWidth: lineWidth,
        rotation: 0, scaleX: 1, scaleY: 1
      });
      markDirty();
    } else if (currentTool === 'rect') {
      annotations.push({
        type: 'rect',
        x: Math.min(startX, coords.x),
        y: Math.min(startY, coords.y),
        width: Math.abs(coords.x - startX),
        height: Math.abs(coords.y - startY),
        color: strokeColor,
        lineWidth: lineWidth,
        rotation: 0, scaleX: 1, scaleY: 1
      });
      markDirty();
    } else if (currentTool === 'ellipse') {
      annotations.push({
        type: 'ellipse',
        x: Math.min(startX, coords.x),
        y: Math.min(startY, coords.y),
        width: Math.abs(coords.x - startX),
        height: Math.abs(coords.y - startY),
        color: strokeColor,
        lineWidth: lineWidth,
        rotation: 0, scaleX: 1, scaleY: 1
      });
      markDirty();
    } else if (currentTool === 'text') {
      pendingTextPos = { x: coords.x, y: coords.y };
      const canvasRect = canvas.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      textInput.style.display = 'block';
      textInput.style.left = `${e.clientX - bodyRect.left + 5}px`;
      textInput.style.top = `${e.clientY - bodyRect.top}px`;
      textInput.style.color = strokeColor;
      textInput.value = '';
      textInput.focus();
      return;
    }

    updateAnnotatedFlag();
    redraw();
  });

  // 移动标注
  function moveAnnotation(anno, dx, dy) {
    if (anno.type === 'brush' && anno.points) {
      anno.points.forEach(p => { p.x += dx; p.y += dy; });
    } else if (anno.type === 'arrow') {
      anno.x += dx; anno.y += dy;
      anno.endX += dx; anno.endY += dy;
    } else {
      anno.x += dx; anno.y += dy;
    }
  }

  // 鼠标离开
  canvas.addEventListener('mouseleave', () => {
    if (isDrawing && currentTool === 'brush' && currentAnnotation) {
      annotations.push(currentAnnotation);
      currentAnnotation = null;
      isDrawing = false;
      markDirty();
      updateAnnotatedFlag();
      redraw();
    }
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && pendingTextPos) {
      const text = textInput.value.trim();
      if (text) {
        annotations.push({
          type: 'text',
          x: pendingTextPos.x,
          y: pendingTextPos.y,
          text: text,
          color: strokeColor,
          lineWidth: lineWidth,
          rotation: 0, scaleX: 1, scaleY: 1
        });
        markDirty();
        redraw();
      }
      textInput.style.display = 'none';
      pendingTextPos = null;
      e.preventDefault();
    }
  });

  // 工具选择
  hoverPreviewElement.querySelectorAll('.anno-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      hoverPreviewElement.querySelectorAll('.anno-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
      updateCursor();
    });
  });

  // 颜色
  hoverPreviewElement.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      hoverPreviewElement.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      strokeColor = btn.dataset.color;
    });
  });

  // 粗细
  hoverPreviewElement.querySelector('.size-slider')?.addEventListener('input', (e) => {
    lineWidth = parseInt(e.target.value, 10);
  });

  // 撤销
  hoverPreviewElement.querySelector('[data-action="undo"]')?.addEventListener('click', () => {
    const before = annotations.length;
    undo();
    if (annotations.length !== before) {
      markDirty();
    }
    updateAnnotatedFlag();
  });

  // 删除选中标注
  hoverPreviewElement.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    if (selectedAnnotation) {
      const idx = annotations.indexOf(selectedAnnotation);
      if (idx >= 0) annotations.splice(idx, 1);
      selectedAnnotation = null;
      markDirty();
      redraw();
      updateAnnotatedFlag();
    }
  });

  // 缩放按钮
  hoverPreviewElement.querySelectorAll('.hover-zoom-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      if (action === 'zoom-in') scale = Math.min(5, scale + 0.25);
      else if (action === 'zoom-out') scale = Math.max(0.5, scale - 0.25);
      else if (action === 'pin') {
        isPinned = !isPinned;
        updatePinUI();
        return;
      } else if (action === 'close') {
        if (isDirty) {
          const saved = await saveHoverAnnotations(btn);
          if (saved) {
            hideHoverPreview(true);
          }
          return;
        }
        hideHoverPreview(true);
        return;
      } else if (action === 'save') {
        await saveHoverAnnotations(btn);
        return;
      }
      updateTransform();
    });
  });

  // 复制
  hoverPreviewElement.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        appendLog({ status: 'success', message: '已复制到剪贴板' });
      } catch (err) { }
    }, 'image/png');
  });

  // 保存云端（主按钮）
  hoverPreviewElement.querySelector('.hover-action-btn[data-action="save"]')?.addEventListener('click', async () => {
    await saveHoverAnnotations();
  });

  // 审核建议自动保存（防抖）
  const noteInput = hoverPreviewElement.querySelector('.hover-preview-note-input');
  const noteSaveIndicator = hoverPreviewElement.querySelector('.hover-note-save-btn');
  let saveTimer = null;

  if (noteInput) {
    // 自动保存函数
    const autoSaveNote = async () => {
      const note = noteInput.value.trim();
      const inputRowNumber = noteInput.dataset.row;

      if (!inputRowNumber) return;

      enqueueFileReviewNoteSave(parseInt(inputRowNumber, 10), note, {
        sourceInput: noteInput,
        onSaving: () => {
          if (noteSaveIndicator) {
            noteSaveIndicator.textContent = '⏳';
          }
        },
        onSaved: () => {
          if (noteSaveIndicator) {
            noteSaveIndicator.textContent = '✅';
            setTimeout(() => {
              noteSaveIndicator.textContent = '已保存';
            }, 1000);
          }
        },
        onError: (err) => {
          console.error('[建议] 保存失败:', err);
          if (noteSaveIndicator) {
            noteSaveIndicator.textContent = '❌';
            setTimeout(() => {
              noteSaveIndicator.textContent = '保存失败';
            }, 1000);
          }
        }
      });
    };

    // 输入时防抖自动保存（800ms后自动保存）
    noteInput.addEventListener('input', () => {
      if (noteSaveIndicator) {
        noteSaveIndicator.textContent = '输入中...';
      }
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(autoSaveNote, 800);
    });

    // 失焦时立即保存
    noteInput.addEventListener('blur', () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      autoSaveNote();
    });

    // 回车保存
    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        autoSaveNote();
      }
    });

    // 点击保存按钮
    if (noteSaveIndicator) {
      noteSaveIndicator.style.cursor = 'pointer';
      noteSaveIndicator.addEventListener('click', () => {
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        autoSaveNote();
      });
    }

  }

  // 预览窗口中的审核按钮事件处理
  hoverPreviewElement.querySelectorAll('.hover-review-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.action;
      const rowNumber = btn.dataset.row;
      const fileId = btn.dataset.fileId;
      const fileName = btn.dataset.fileName;

      if (!rowNumber) {
        appendLog({ status: 'warning', message: '无法执行操作：缺少行号信息' });
        return;
      }

      try {
        if (action === 'approve') {
          handleFileReviewStatusChange(parseInt(rowNumber, 10), FILE_REVIEW_STATUS.APPROVED);
          btn.classList.add('active');
          hoverPreviewElement.querySelector('.hover-review-btn.reject')?.classList.remove('active');
          hoverPreviewElement.querySelector('.hover-review-btn.discard')?.classList.remove('active');
          appendLog({ status: 'success', message: '已标记为合格' });
        } else if (action === 'reject') {
          handleFileReviewStatusChange(parseInt(rowNumber, 10), FILE_REVIEW_STATUS.REJECTED);
          btn.classList.add('active');
          hoverPreviewElement.querySelector('.hover-review-btn.approve')?.classList.remove('active');
          hoverPreviewElement.querySelector('.hover-review-btn.discard')?.classList.remove('active');
          appendLog({ status: 'success', message: '已标记为不合格' });
        } else if (action === 'discard') {
          handleFileReviewStatusChange(parseInt(rowNumber, 10), FILE_REVIEW_STATUS.DISCARDED);
          btn.classList.add('active');
          hoverPreviewElement.querySelector('.hover-review-btn.approve')?.classList.remove('active');
          hoverPreviewElement.querySelector('.hover-review-btn.reject')?.classList.remove('active');
          appendLog({ status: 'success', message: '已标记为作废' });
        } else if (action === 'replace') {
          // 关闭预览窗口，打开替换模态框
          hideHoverPreview(true);
          // 获取批次信息
          const file = state.fileReviewFiles?.find(f => f.rowNumber == rowNumber);
          const batch = state.fileReviewBatches?.find(b => b.files?.some(f => f.rowNumber == rowNumber));
          if (file && batch) {
            openFileReplaceModal({
              fileId: file.fileId,
              fileName: file.fileName,
              rowNumber: file.rowNumber,
              tempFolderLink: batch.tempFolderLink,
              batchId: batch.batchId
            });
          } else {
            appendLog({ status: 'error', message: '无法找到文件或批次信息' });
          }
        } else if (action === 'delete-file') {
          // 删除文件
          const batch = state.fileReviewBatches?.find(b => b.files?.some(f => f.rowNumber == rowNumber));
          // 先关闭预览窗口，再弹出确认框
          hideHoverPreview(true);
          const confirmed = await showConfirmationDialog({
            title: '确认删除',
            message: `确定要删除文件 "${fileName}" 吗？`,
            details: ['从审核列表中移除该文件', '将文件移动到"已删除"文件夹'],
            confirmText: '删除',
            cancelText: '取消',
            destructive: true
          });
          if (confirmed) {
            // 🚀 乐观更新：先从 UI 立即移除文件卡片
            const card = document.querySelector(`.file-card[data-row="${rowNumber}"]`);
            if (card) {
              card.style.transition = 'opacity 0.2s, transform 0.2s';
              card.style.opacity = '0';
              card.style.transform = 'scale(0.9)';
              setTimeout(() => card.remove(), 200);
            }

            // 从本地状态中移除
            const rowNum = parseInt(rowNumber, 10);
            if (state.fileReviewFiles) {
              state.fileReviewFiles = state.fileReviewFiles.filter(f => f.rowNumber != rowNum);
            }
            state.fileReviewBatches?.forEach(b => {
              if (b.files) {
                b.files = b.files.filter(f => f.rowNumber != rowNum);
                // 重新计算批次计数
                const counts = { pending: 0, approved: 0, rejected: 0, stored: 0, discarded: 0, total: b.files.length };
                b.files.forEach(f => {
                  if (f.status === FILE_REVIEW_STATUS.APPROVED) counts.approved++;
                  else if (f.status === FILE_REVIEW_STATUS.REJECTED) counts.rejected++;
                  else if (f.status === FILE_REVIEW_STATUS.STORED) counts.stored++;
                  else if (f.status === FILE_REVIEW_STATUS.DISCARDED) counts.discarded++;
                  else counts.pending++;
                });
                b.counts = counts;
              }
            });

            // 后台执行实际删除操作
            window.bridge.deleteReviewFile({
              fileId,
              rowNumber: rowNum,
              batchId: batch?.batchId || ''
            }).then(result => {
              if (result.success) {
                appendLog({
                  status: 'success',
                  message: `文件 "${fileName}" 已删除`,
                  broadcastGlobal: true
                });
              } else {
                appendLog({
                  status: 'error',
                  message: result.message || '删除失败，请刷新页面'
                });
                loadFileReviewEntries({ silent: true });
              }
            }).catch(error => {
              appendLog({
                status: 'error',
                message: `删除失败：${error.message}，请刷新页面`
              });
              loadFileReviewEntries({ silent: true });
            });
          }
        }

        // 同步更新卡片上的按钮状态
        if (action !== 'replace' && action !== 'delete-file') {
          const card = document.querySelector(`.file-card[data-row="${rowNumber}"]`);
          if (card) {
            // 更新卡片样式
            card.classList.remove('status-approved', 'status-rejected', 'status-pending', 'status-discarded');
            if (action === 'approve') card.classList.add('status-approved');
            else if (action === 'reject') card.classList.add('status-rejected');
            else if (action === 'discard') card.classList.add('status-discarded');
          }
        }
      } catch (err) {
        appendLog({ status: 'error', message: `操作失败: ${err.message}` });
      }
    });
  });

  // 鼠标离开处理 - 悬浮模式自动关闭，全屏模式不关闭
  hoverPreviewElement.addEventListener('mouseenter', () => { hoverPreviewElement.dataset.hover = 'true'; });
  hoverPreviewElement.addEventListener('mouseleave', () => {
    hoverPreviewElement.dataset.hover = 'false';
    // 只有悬浮模式才自动关闭
    if (!fullscreen) {
      const allowAnnotatedClose = hoverPreviewElement.dataset.autoclose === 'true';
      if (
        hoverPreviewElement.dataset.resizing === 'true' ||
        isDirty ||
        isPinned ||
        isSaving ||
        isDrawing ||
        currentAnnotation ||
        (annotations.length > 0 && !allowAnnotatedClose)
      ) {
        return;
      }
      document.removeEventListener('keydown', handleKeyDown);
      hideHoverPreview();
    }
  });

  // 全屏模式：点击遮罩关闭
  if (fullscreen) {
    hoverPreviewElement.addEventListener('click', (e) => {
      if (e.target === hoverPreviewElement) {
        if (isDirty) {
          saveHoverAnnotations().then((saved) => {
            if (saved) {
              hideHoverPreview(true);
            }
          });
          return;
        }
        hideHoverPreview(true);
      }
    });
  }

  canvas.style.cursor = currentTool === 'pan' ? 'grab' : 'crosshair';
}

function hideHoverPreview(force = false) {
  if (!hoverPreviewElement) {
    return;
  }
  if (!force && hoverPreviewElement.dataset.resizing === 'true') {
    return;
  }
  const pinned = hoverPreviewElement.dataset.pinned === 'true';
  const dirty = hoverPreviewElement.dataset.dirty === 'true';
  const annotated = hoverPreviewElement.dataset.annotated === 'true';
  const allowAnnotatedClose = hoverPreviewElement.dataset.autoclose === 'true';
  if (
    force ||
    (!pinned && !dirty && hoverPreviewElement.dataset.hover !== 'true' && (!annotated || allowAnnotatedClose))
  ) {
    hoverPreviewElement.remove();
    hoverPreviewElement = null;
    hoverPreviewData = null;
  }
}

// ========== 平铺查看面板 (类似 PureRef) ==========
let tileViewElement = null;

/**
 * 显示平铺查看面板
 * @param {Object} batch - 批次对象，包含 files 数组
 */
function showTileViewPanel(batch) {
  hideTileViewPanel(); // 关闭已存在的

  const files = batch.files || [];
  if (!files.length) return;

  // 创建平铺面板
  tileViewElement = document.createElement('div');
  tileViewElement.className = 'tile-view-panel';
  tileViewElement.innerHTML = `
    <div class="tile-view-backdrop"></div>
    <div class="tile-view-container">
      <div class="tile-view-header">
        <div class="tile-view-title">
          <span class="tile-view-icon">📐</span>
          <span>${escapeHtml(batch.batchId)} - 平铺预览 (${files.length}张)</span>
        </div>
        <div class="tile-view-controls">
          <button class="tile-view-btn" data-action="zoom-out" title="缩小 (滚轮向下)">－</button>
          <span class="tile-view-zoom-level">100%</span>
          <button class="tile-view-btn" data-action="zoom-in" title="放大 (滚轮向上)">＋</button>
          <button class="tile-view-btn" data-action="reset" title="重置缩放">🔄</button>
          <span class="tile-view-divider"></span>
          <button class="tile-view-btn" data-action="fullscreen" title="全屏">⛶</button>
          <button class="tile-view-btn close-btn" data-action="close" title="关闭 (ESC)">✕</button>
        </div>
      </div>
      <div class="tile-view-body">
        <div class="tile-view-canvas">
          ${files.map((file, idx) => {
    const previewFileId = file.annotatedFileId || file.fileId;
    const statusClass = getFileReviewStatusClass(file.status);
    const isApproved = file.status === FILE_REVIEW_STATUS.APPROVED || file.status === FILE_REVIEW_STATUS.STORED;
    const isRejected = file.status === FILE_REVIEW_STATUS.REJECTED;
    const isDiscarded = file.status === FILE_REVIEW_STATUS.DISCARDED;
    const isStored = file.status === FILE_REVIEW_STATUS.STORED;
    const statusIcon = isStored ? '📦' :
      (isDiscarded ? '🗑️' :
        (isApproved ? '✓' :
          (isRejected ? '✗' : '')));
    return `
              <div class="tile-view-item ${statusClass}" 
                   data-file-id="${file.fileId}"
                   data-preview-id="${previewFileId}"
                   data-file-name="${escapeHtml(file.fileName)}"
                   data-file-link="${file.fileLink || ''}"
                   data-row="${file.rowNumber}">
                <img src="https://drive.google.com/thumbnail?id=${previewFileId}&sz=w400" 
                     alt="${escapeHtml(file.fileName)}"
                     loading="eager"
                     decoding="async"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23e2e8f0%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-size=%2212%22>加载失败</text></svg>'" />
                ${statusIcon ? `<span class="tile-item-status ${statusClass}">${statusIcon}</span>` : ''}
                <div class="tile-item-actions">
                  <button class="tile-action-btn approve ${isApproved ? 'active' : ''}" 
                          data-action="approve" data-row="${file.rowNumber}" 
                          title="合格" ${isStored || isDiscarded ? 'disabled' : ''}>✓</button>
                  <button class="tile-action-btn reject ${isRejected ? 'active' : ''}" 
                          data-action="reject" data-row="${file.rowNumber}" 
                          title="不合格" ${isStored || isDiscarded ? 'disabled' : ''}>✗</button>
                  <button class="tile-action-btn discard ${isDiscarded ? 'active' : ''}" 
                          data-action="discard" data-row="${file.rowNumber}" 
                          title="作废" ${isStored ? 'disabled' : ''}>🗑️</button>
                  <button class="tile-action-btn preview" 
                          data-action="preview" data-row="${file.rowNumber}" 
                          title="放大查看">🔍</button>
                </div>
                <div class="tile-item-name">${escapeHtml(file.fileName.substring(0, 20))}${file.fileName.length > 20 ? '...' : ''}</div>
              </div>
            `;
  }).join('')}
        </div>
      </div>
      <div class="tile-view-footer">
        <span class="tile-view-hint">💡 滚轮缩放 | 拖拽移动 | 点击图片放大查看 | ESC 关闭</span>
      </div>
    </div>
  `;

  document.body.appendChild(tileViewElement);

  // 获取元素引用
  const container = tileViewElement.querySelector('.tile-view-container');
  const backdrop = tileViewElement.querySelector('.tile-view-backdrop');
  const canvas = tileViewElement.querySelector('.tile-view-canvas');
  const zoomLevelEl = tileViewElement.querySelector('.tile-view-zoom-level');

  // 状态变量
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartTranslateX = 0;
  let dragStartTranslateY = 0;

  function updateTransform() {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    zoomLevelEl.textContent = `${Math.round(scale * 100)}%`;
  }

  function zoomIn() {
    scale = Math.min(10, scale * 1.2);
    updateTransform();
  }

  function zoomOut() {
    scale = Math.max(0.1, scale / 1.2);
    updateTransform();
  }

  function resetZoom() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateTransform();
  }

  // 滚轮缩放和横向滚动
  const body = tileViewElement.querySelector('.tile-view-body');
  body.addEventListener('wheel', (e) => {
    e.preventDefault();

    // 如果有横向滚动（deltaX），则平移画布
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // 横向滚动 - 平移
      translateX -= e.deltaX * 1.5;
      translateY -= e.deltaY * 1.5;
      updateTransform();
      return;
    }

    // 纵向滚动 - 缩放
    const rect = body.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldScale = scale;
    if (e.deltaY < 0) {
      scale = Math.min(10, scale * 1.15);
    } else {
      scale = Math.max(0.1, scale / 1.15);
    }

    // 以鼠标位置为中心缩放
    const scaleRatio = scale / oldScale;
    translateX = mouseX - (mouseX - translateX) * scaleRatio;
    translateY = mouseY - (mouseY - translateY) * scaleRatio;

    updateTransform();
  }, { passive: false });

  // 拖拽移动
  canvas.addEventListener('mousedown', (e) => {
    if (e.target.closest('.tile-view-item')) return; // 点击图片不触发拖拽
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartTranslateX = translateX;
    dragStartTranslateY = translateY;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    translateX = dragStartTranslateX + dx;
    translateY = dragStartTranslateY + dy;
    updateTransform();
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      canvas.style.cursor = 'grab';
    }
  });

  // 控制按钮
  tileViewElement.querySelectorAll('.tile-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.action;
      switch (action) {
        case 'zoom-in': zoomIn(); break;
        case 'zoom-out': zoomOut(); break;
        case 'reset': resetZoom(); break;
        case 'fullscreen':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            container.requestFullscreen?.() || container.webkitRequestFullscreen?.();
          }
          break;
        case 'close': hideTileViewPanel(); break;
      }
    });
  });

  // 点击图片放大查看（排除操作按钮区域）
  tileViewElement.querySelectorAll('.tile-view-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // 如果点击的是操作按钮，不触发预览
      if (e.target.closest('.tile-item-actions')) return;

      const fileId = item.dataset.fileId;
      const previewId = item.dataset.previewId;
      const fileName = item.dataset.fileName;
      const fileLink = item.dataset.fileLink;
      const rowNumber = item.dataset.row;
      showHoverPreview(fileId, fileName, fileLink, rowNumber, null, true, previewId);
    });
  });

  // 操作按钮事件
  tileViewElement.querySelectorAll('.tile-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const action = btn.dataset.action;
      const rowNumber = parseInt(btn.dataset.row, 10);
      const item = btn.closest('.tile-view-item');

      if (action === 'preview') {
        // 放大预览
        const fileId = item.dataset.fileId;
        const previewId = item.dataset.previewId;
        const fileName = item.dataset.fileName;
        const fileLink = item.dataset.fileLink;
        showHoverPreview(fileId, fileName, fileLink, rowNumber, null, true, previewId);
        return;
      }

      // 审核操作
      let newStatus = '';
      if (action === 'approve') {
        newStatus = FILE_REVIEW_STATUS.APPROVED;
      } else if (action === 'reject') {
        newStatus = FILE_REVIEW_STATUS.REJECTED;
      } else if (action === 'discard') {
        newStatus = FILE_REVIEW_STATUS.DISCARDED;
      }

      if (!newStatus) return;

      // 执行状态变更
      await handleFileReviewStatusChange(rowNumber, newStatus);

      // 更新平铺视图中的状态显示
      const file = state.fileReviewFiles?.find(f => f.rowNumber === rowNumber);
      if (file) {
        const statusClass = getFileReviewStatusClass(file.status);
        const isApproved = file.status === FILE_REVIEW_STATUS.APPROVED || file.status === FILE_REVIEW_STATUS.STORED;
        const isRejected = file.status === FILE_REVIEW_STATUS.REJECTED;
        const isDiscarded = file.status === FILE_REVIEW_STATUS.DISCARDED;
        const isStored = file.status === FILE_REVIEW_STATUS.STORED;

        // 更新卡片样式
        item.className = `tile-view-item ${statusClass}`;

        // 更新状态图标
        let statusEl = item.querySelector('.tile-item-status');
        const statusIcon = isStored ? '📦' : (isDiscarded ? '🗑️' : (isApproved ? '✓' : (isRejected ? '✗' : '')));
        if (statusIcon) {
          if (!statusEl) {
            statusEl = document.createElement('span');
            item.insertBefore(statusEl, item.querySelector('.tile-item-actions'));
          }
          statusEl.className = `tile-item-status ${statusClass}`;
          statusEl.textContent = statusIcon;
        } else if (statusEl) {
          statusEl.remove();
        }

        // 更新按钮状态
        item.querySelectorAll('.tile-action-btn').forEach(b => {
          const a = b.dataset.action;
          b.classList.remove('active');
          if (a === 'approve' && isApproved) b.classList.add('active');
          if (a === 'reject' && isRejected) b.classList.add('active');
          if (a === 'discard' && isDiscarded) b.classList.add('active');

          // 更新禁用状态
          if (a === 'approve' || a === 'reject') {
            b.disabled = isStored || isDiscarded;
          } else if (a === 'discard') {
            b.disabled = isStored;
          }
        });
      }
    });
  });

  // 点击背景关闭
  backdrop.addEventListener('click', () => {
    hideTileViewPanel();
  });

  // ESC 关闭
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      hideTileViewPanel();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  // 初始化
  canvas.style.cursor = 'grab';
  updateTransform();
}

/**
 * 隐藏平铺查看面板
 */
function hideTileViewPanel() {
  if (tileViewElement) {
    tileViewElement.remove();
    tileViewElement = null;
  }
}


/**
 * 处理单个文件状态变更
 */
async function handleFileReviewStatusChange(rowNumber, newStatus) {
  if (!ensureFirebaseReadyOrNotify('handleFileReviewStatusChange')) {
    appendLog({ status: 'error', message: 'Firebase 未连接，无法保存审核状态' });
    return;
  }
  // 乐观更新：先更新本地状态
  const reviewer = getSubmitterName() || '';
  const timestamp = Date.now();

  // 更新本地文件状态
  const fileInState = state.fileReviewFiles?.find(f => f.rowNumber === rowNumber);
  if (fileInState) {
    fileInState.status = newStatus;
    fileInState.reviewer = reviewer;
    fileInState.reviewTime = timestamp;
  }

  // 更新批次中的文件状态并重新计算统计数据
  state.fileReviewBatches?.forEach(batch => {
    const fileInBatch = batch.files?.find(f => f.rowNumber === rowNumber);
    if (fileInBatch) {
      fileInBatch.status = newStatus;
      fileInBatch.reviewer = reviewer;
      fileInBatch.reviewTime = timestamp;

      // 级联更新批次计数
      const counts = { pending: 0, approved: 0, rejected: 0, stored: 0, total: batch.files.length };
      batch.files.forEach(f => {
        if (f.status === FILE_REVIEW_STATUS.APPROVED) counts.approved++;
        else if (f.status === FILE_REVIEW_STATUS.REJECTED) counts.rejected++;
        else if (f.status === FILE_REVIEW_STATUS.STORED) counts.stored++;
        else counts.pending++;
      });
      batch.counts = counts;
    }
  });

  // 立即更新 UI（不等待服务器响应）
  updateFileStatusUI(rowNumber, newStatus);

  // 防抖保存：频繁切换只保留最后一次状态
  scheduleReviewStatusSave(rowNumber, {
    rowNumber,
    status: newStatus,
    reviewer
  });
}


/**
 * 快速更新文件状态 UI（不重新渲染整个列表）
 */
function updateFileStatusUI(rowNumber, newStatus) {
  // 1. 状态映射准备
  const statusIcons = {
    [FILE_REVIEW_STATUS.PENDING]: '○',
    [FILE_REVIEW_STATUS.APPROVED]: '✓',
    [FILE_REVIEW_STATUS.REJECTED]: '✗',
    [FILE_REVIEW_STATUS.STORED]: '📦',
    [FILE_REVIEW_STATUS.DISCARDED]: '🗑'
  };
  const statusIcon = statusIcons[newStatus] || '○';
  const statusClass = getFileReviewStatusClass(newStatus);

  // 2. 更新所有匹配的文件卡片 UI
  const cards = document.querySelectorAll(`.file-card[data-row="${rowNumber}"], .file-row[data-row="${rowNumber}"]`);
  let affectedBatchIds = new Set();

  cards.forEach(card => {
    const currentStatusClass = [
      'status-pending',
      'status-approved',
      'status-rejected',
      'status-stored',
      'status-discarded',
      'status-replaced'
    ].find(cls => card.classList.contains(cls));
    const statusBadge = card.querySelector('.file-card-status-badge');
    const badgeMatches = !statusBadge ||
      (statusBadge.textContent === statusIcon && statusBadge.classList.contains(statusClass));
    if (currentStatusClass === statusClass && badgeMatches) {
      return;
    }

    // 更新按钮 active 状态
    card.querySelectorAll('.file-card-btn[data-action]').forEach(btn => {
      const action = btn.dataset.action;
      const isActive = (action === 'approve' && newStatus === FILE_REVIEW_STATUS.APPROVED) ||
        (action === 'reject' && newStatus === FILE_REVIEW_STATUS.REJECTED) ||
        (action === 'discard' && newStatus === FILE_REVIEW_STATUS.DISCARDED);
      btn.classList.toggle('active', isActive);
    });

    // 更新状态徽章
    if (statusBadge) {
      statusBadge.textContent = statusIcon;
      statusBadge.className = `file-card-status-badge ${statusClass}`;
    }

    // 更新卡片容器类
    card.classList.remove(
      'status-pending',
      'status-approved',
      'status-rejected',
      'status-stored',
      'status-discarded',
      'status-replaced'
    );
    card.classList.add(statusClass);

    // 记录所属批次 ID 以便后续更新计数器
    const batchCard = card.closest('.file-review-batch-card');
    if (batchCard && batchCard.dataset.batchId) {
      affectedBatchIds.add(batchCard.dataset.batchId);
    }
  });

  // 3. 级联更新批次计数器 UI (外科手术式更新，避免重绘)
  affectedBatchIds.forEach(batchId => {
    const batch = state.fileReviewBatches?.find(b => b.batchId === batchId);
    if (!batch) return;

    const batchCards = document.querySelectorAll(`.file-review-batch-card[data-batch-id="${batchId}"]`);
    batchCards.forEach(batchCard => {
      const pendingEl = batchCard.querySelector('.count-pending');
      const approvedEl = batchCard.querySelector('.count-approved');
      const rejectedEl = batchCard.querySelector('.count-rejected');
      const storedEl = batchCard.querySelector('.count-stored');

      if (pendingEl) pendingEl.textContent = `待审 ${batch.counts.pending}`;
      if (approvedEl) approvedEl.textContent = `合格 ${batch.counts.approved}`;
      if (rejectedEl) rejectedEl.textContent = `不合格 ${batch.counts.rejected}`;
      if (storedEl) storedEl.textContent = `已入库 ${batch.counts.stored}`;
      updateBatchStoreButtons(batchId, batchCard, batch);
    });
  });

  // 4. 同步更新"我的审核"统计面板（如果存在）
  if (elements.myReviewInfo || elements.myReviewSummary) {
    const totalBatches = state.fileReviewBatches?.length || 0;
    const totalFiles = (state.fileReviewBatches || []).reduce((sum, b) => sum + b.counts.total, 0);
    const storedFiles = (state.fileReviewBatches || []).reduce((sum, b) => sum + b.counts.stored, 0);
    const approvedFiles = (state.fileReviewBatches || []).reduce((sum, b) => sum + b.counts.approved, 0);
    const pendingFiles = (state.fileReviewBatches || []).reduce((sum, b) => sum + b.counts.pending, 0);
    const rejectedFiles = (state.fileReviewBatches || []).reduce((sum, b) => sum + b.counts.rejected, 0);

    // 更新文字信息栏
    if (elements.myReviewInfo) {
      const parts = [`共 ${totalBatches} 个批次，${totalFiles} 个文件`];
      parts.push(`已入库 ${storedFiles} | 合格 ${approvedFiles} | 待审 ${pendingFiles} | 不合格 ${rejectedFiles}`);
      elements.myReviewInfo.textContent = parts.join(' · ');
    }

    // 更新分类统计大卡片
    if (elements.myReviewSummary) {
      const batchCounts = { total: totalBatches, pending: 0, feedback: 0, approved: 0, partial: 0, cancelled: 0 };
      state.fileReviewBatches?.forEach(batch => {
        const batchStatus = (batch.batchStatus || getBatchOverallStatus(batch) || '').trim();
        if (batchStatus === '已审核通过' || batchStatus === '已入库') batchCounts.approved++;
        else if (isPartialBatchStatus(batchStatus)) batchCounts.partial++;
        else if (batchStatus === '待审核') batchCounts.pending++;
        else if (
          batchStatus === '需要修改' ||
          batchStatus === '一部分需要修改' ||
          batchStatus === '需修改'
        ) batchCounts.feedback++;
        else if (batchStatus === '已取消') batchCounts.cancelled++;
        else batchCounts.pending++;
      });

      const cards = elements.myReviewSummary.querySelectorAll('.review-summary-card');
      cards.forEach(card => {
        const filter = card.dataset.statusFilter;
        const valEl = card.querySelector('.value');
        if (valEl) {
          if (filter === 'all') valEl.textContent = batchCounts.total;
          else if (filter === 'pending') valEl.textContent = batchCounts.pending;
          else if (filter === 'feedback') valEl.textContent = batchCounts.feedback;
          else if (filter === 'approved') valEl.textContent = batchCounts.approved;
          else if (filter === 'partial') valEl.textContent = batchCounts.partial;
          else if (filter === 'allStored') valEl.textContent = batchCounts.approved + batchCounts.partial;
          else if (filter === 'cancelled') valEl.textContent = batchCounts.cancelled;
        }
      });
    }
  }
}

function updateBatchStoreButtons(batchId, batchCard = null, batchData = null) {
  const batch = batchData || state.fileReviewBatches?.find(b => b.batchId === batchId);
  if (!batch) return;
  const cards = batchCard
    ? [batchCard]
    : Array.from(document.querySelectorAll(`.file-review-batch-card[data-batch-id="${batchId}"]`));
  if (!cards.length) return;
  const disabled = batch.counts.approved === 0;
  cards.forEach(card => {
    const partialStoreBtn = card.querySelector('.btn-batch-partial-store');
    const finalStoreBtn = card.querySelector('.btn-batch-final-store');
    if (partialStoreBtn) partialStoreBtn.disabled = disabled;
    if (finalStoreBtn) finalStoreBtn.disabled = disabled;
  });
}

function getBatchSelectedRowNumbers(batchCard) {
  if (!batchCard) return [];
  return Array.from(batchCard.querySelectorAll('.file-card.selected[data-row]'))
    .map(card => parseInt(card.dataset.row, 10))
    .filter(Number.isFinite);
}

/**
 * 处理批量通过
 */
async function handleBatchApprove(batchId) {
  if (!ensureFirebaseReadyOrNotify('handleBatchApprove')) {
    appendLog({ status: 'error', message: 'Firebase 未连接，无法批量保存审核状态' });
    return;
  }
  const batch = state.fileReviewBatches.find(b => b.batchId === batchId);
  if (!batch) return;

  const noteInput = document.querySelector(`.batch-note-input[data-batch-id="${batchId}"]`);
  const note = noteInput?.value || '';
  const reviewer = getSubmitterName() || '';
  const timestamp = Date.now();

  const batchCard = arguments.length > 1 ? arguments[1]?.batchCard : null;
  const selectedRowNumbers = getBatchSelectedRowNumbers(batchCard);
  const useSelection = selectedRowNumbers.length > 0;

  const updates = batch.files
    .filter(f => (useSelection ? selectedRowNumbers.includes(f.rowNumber) : f.status !== FILE_REVIEW_STATUS.STORED))
    .map(file => {
      const upd = {
        rowNumber: file.rowNumber,
        status: FILE_REVIEW_STATUS.APPROVED,
        reviewer: reviewer
      };
      // 只有当批量备注不为空时，才更新每个文件的备注
      if (note) upd.reviewNote = note;
      return upd;
    });

  if (!updates.length) {
    appendLog({ status: 'info', message: useSelection ? '所选文件无需更新' : '没有需要更新的文件' });
    return;
  }

  // 1. 乐观更新：先更新本地所有文件的状态
  updates.forEach(upd => {
    // 这里调用 handleFileReviewStatusChange 的同步部分
    // 但为了性能，我们直接操作 state 并一次性更新 UI 可能更好
    // 不过 handleFileReviewStatusChange 已经很轻量了，除了它里面的 bridge 调用
  });

  // 批量更新本地 state
  batch.files.forEach(f => {
    if (useSelection ? selectedRowNumbers.includes(f.rowNumber) : f.status !== FILE_REVIEW_STATUS.STORED) {
      f.status = FILE_REVIEW_STATUS.APPROVED;
      f.reviewer = reviewer;
      f.reviewTime = timestamp;
      f._localModifiedAt = timestamp; // 标记本地修改时间，防止刷新覆盖
      // 只有当批量备注不为空时，才覆盖本地备注
      if (note) f.reviewNote = note;
    }
  });

  // 同时更新 state.fileReviewFiles 中对应的文件
  if (state.fileReviewFiles) {
    const rowSet = new Set(batch.files.map(f => f.rowNumber));
    state.fileReviewFiles.forEach(f => {
      if (rowSet.has(f.rowNumber)) {
        const batchFile = batch.files.find(bf => bf.rowNumber === f.rowNumber);
        if (batchFile) {
          f.status = batchFile.status;
          f.reviewer = batchFile.reviewer;
          f.reviewTime = batchFile.reviewTime;
          f._localModifiedAt = batchFile._localModifiedAt;
          if (note) f.reviewNote = note;
        }
      }
    });
  }

  // 重新计算批次计数
  const counts = { pending: 0, approved: 0, rejected: 0, stored: 0, total: batch.files.length };
  batch.files.forEach(f => {
    if (f.status === FILE_REVIEW_STATUS.APPROVED) counts.approved++;
    else if (f.status === FILE_REVIEW_STATUS.REJECTED) counts.rejected++;
    else if (f.status === FILE_REVIEW_STATUS.STORED) counts.stored++;
    else counts.pending++;
  });
  batch.counts = counts;
  updateBatchStoreButtons(batchId);

  // 立即批量更新 UI
  updates.forEach(upd => updateFileStatusUI(upd.rowNumber, upd.status));

  // 2. 后台保存
  try {
    await batchSaveReviewStatus(updates);
    appendLog({ status: 'success', message: `已将 ${updates.length} 个文件标记为合格` });
    if (useSelection && batchCard) {
      batchCard.querySelectorAll('.file-card.selected').forEach(card => card.classList.remove('selected'));
      if (elements.reviewList) {
        updateBatchSelectionCount(batchId, elements.reviewList);
      }
    }
  } catch (error) {
    appendLog({ status: 'error', message: `批量更新失败：${error.message}` });
    // 失败时全量刷新以保持一致性
    await loadFileReviewEntries({ silent: true });
  }
}

/**
 * 处理批量不合格
 */
async function handleBatchReject(batchId) {
  if (!ensureFirebaseReadyOrNotify('handleBatchReject')) {
    appendLog({ status: 'error', message: 'Firebase 未连接，无法批量保存审核状态' });
    return;
  }
  const batch = state.fileReviewBatches.find(b => b.batchId === batchId);
  if (!batch) return;

  const noteInput = document.querySelector(`.batch-note-input[data-batch-id="${batchId}"]`);
  const note = noteInput?.value || '';
  const reviewer = getSubmitterName() || '';
  const timestamp = Date.now();

  if (!note) {
    appendLog({ status: 'warning', message: '请填写不合格原因' });
    noteInput?.focus();
    return;
  }

  const batchCard = arguments.length > 1 ? arguments[1]?.batchCard : null;
  const selectedRowNumbers = getBatchSelectedRowNumbers(batchCard);
  const useSelection = selectedRowNumbers.length > 0;

  // 优先对选中的文件执行不合格
  const updates = batch.files
    .filter(f => useSelection ? selectedRowNumbers.includes(f.rowNumber) : f.status !== FILE_REVIEW_STATUS.STORED)
    .map(file => ({
      rowNumber: file.rowNumber,
      status: FILE_REVIEW_STATUS.REJECTED,
      reviewer: reviewer,
      reviewNote: note
    }));

  if (!updates.length) {
    appendLog({ status: 'info', message: useSelection ? '所选文件无需更新' : '没有待审核的文件' });
    return;
  }

  // 1. 乐观更新
  batch.files.forEach(f => {
    if (useSelection ? selectedRowNumbers.includes(f.rowNumber) : f.status !== FILE_REVIEW_STATUS.STORED) {
      f.status = FILE_REVIEW_STATUS.REJECTED;
      f.reviewer = reviewer;
      f.reviewTime = timestamp;
      f._localModifiedAt = timestamp; // 标记本地修改时间，防止刷新覆盖
      f.reviewNote = note;
    }
  });

  // 同时更新 state.fileReviewFiles 中对应的文件
  if (state.fileReviewFiles) {
    const rowSet = new Set(batch.files.map(f => f.rowNumber));
    state.fileReviewFiles.forEach(f => {
      if (rowSet.has(f.rowNumber)) {
        const batchFile = batch.files.find(bf => bf.rowNumber === f.rowNumber);
        if (batchFile) {
          f.status = batchFile.status;
          f.reviewer = batchFile.reviewer;
          f.reviewTime = batchFile.reviewTime;
          f._localModifiedAt = batchFile._localModifiedAt;
          f.reviewNote = note;
        }
      }
    });
  }

  // 重新计算批次计数
  const counts = { pending: 0, approved: 0, rejected: 0, stored: 0, total: batch.files.length };
  batch.files.forEach(f => {
    if (f.status === FILE_REVIEW_STATUS.APPROVED) counts.approved++;
    else if (f.status === FILE_REVIEW_STATUS.REJECTED) counts.rejected++;
    else if (f.status === FILE_REVIEW_STATUS.STORED) counts.stored++;
    else counts.pending++;
  });
  batch.counts = counts;
  updateBatchStoreButtons(batchId);

  // 立即批量更新 UI
  updates.forEach(upd => updateFileStatusUI(upd.rowNumber, upd.status));

  // 2. 后台保存
  try {
    await batchSaveReviewStatus(updates);
    appendLog({ status: 'success', message: `已将 ${updates.length} 个文件标记为不合格` });
    if (useSelection && batchCard) {
      batchCard.querySelectorAll('.file-card.selected').forEach(card => card.classList.remove('selected'));
      if (elements.reviewList) {
        updateBatchSelectionCount(batchId, elements.reviewList);
      }
    }
  } catch (error) {
    appendLog({ status: 'error', message: `批量更新失败：${error.message}` });
    // 失败时全量刷新以保持一致性
    await loadFileReviewEntries({ silent: true });
  }
}

/**
 * 处理批量取消标记（回到待审核）
 */
async function handleBatchReset(batchId) {
  if (!ensureFirebaseReadyOrNotify('handleBatchReset')) {
    appendLog({ status: 'error', message: 'Firebase 未连接，无法批量保存审核状态' });
    return;
  }
  const batch = state.fileReviewBatches.find(b => b.batchId === batchId);
  if (!batch) return;

  const reviewer = '';
  const timestamp = Date.now();

  const batchCard = arguments.length > 1 ? arguments[1]?.batchCard : null;
  const selectedRowNumbers = getBatchSelectedRowNumbers(batchCard);
  const useSelection = selectedRowNumbers.length > 0;

  const updates = batch.files
    .filter(f => useSelection ? selectedRowNumbers.includes(f.rowNumber) : f.status !== FILE_REVIEW_STATUS.STORED)
    .map(file => ({
      rowNumber: file.rowNumber,
      status: FILE_REVIEW_STATUS.PENDING,
      reviewer
    }));

  if (!updates.length) {
    appendLog({ status: 'info', message: useSelection ? '所选文件无需更新' : '没有需要更新的文件' });
    return;
  }

  batch.files.forEach(f => {
    if (useSelection ? selectedRowNumbers.includes(f.rowNumber) : f.status !== FILE_REVIEW_STATUS.STORED) {
      f.status = FILE_REVIEW_STATUS.PENDING;
      f.reviewer = reviewer;
      f.reviewTime = timestamp;
    }
  });

  const counts = { pending: 0, approved: 0, rejected: 0, stored: 0, total: batch.files.length };
  batch.files.forEach(f => {
    if (f.status === FILE_REVIEW_STATUS.APPROVED) counts.approved++;
    else if (f.status === FILE_REVIEW_STATUS.REJECTED) counts.rejected++;
    else if (f.status === FILE_REVIEW_STATUS.STORED) counts.stored++;
    else counts.pending++;
  });
  batch.counts = counts;
  updateBatchStoreButtons(batchId);

  updates.forEach(upd => updateFileStatusUI(upd.rowNumber, upd.status));

  try {
    await batchSaveReviewStatus(updates);
    appendLog({ status: 'success', message: `已取消 ${updates.length} 个文件的标记` });
    if (useSelection && batchCard) {
      batchCard.querySelectorAll('.file-card.selected').forEach(card => card.classList.remove('selected'));
      if (elements.reviewList) {
        updateBatchSelectionCount(batchId, elements.reviewList);
      }
    }
  } catch (error) {
    appendLog({ status: 'error', message: `批量更新失败：${error.message}` });
    await loadFileReviewEntries({ silent: true });
  }
}
/**
 * 处理通过入库 - TODO: 实现文件移动逻辑
 */
/**
 * 处理批次入库
 * @param {string} batchId - 批次ID
 * @param {string} mode - 入库模式: 'partial'(部分入库) 或 'final'(最终入库)
 *   - partial: 入库合格文件，批次状态变为"部分已入库"
 *   - final: 入库合格文件，不合格文件标记为"作废"，批次状态变为"已入库"
 */
// 入库队列系统 - 支持多个入库请求排队执行
let isStoringInProgress = false;
let storeQueue = [];

// 添加入库任务到队列
function enqueueStoreTask(batchId, mode) {
  // 🔴 标记用户操作，触发冷却期
  markUserOperation();

  // 检查是否已有相同批次在队列中
  if (storeQueue.some(task => task.batchId === batchId)) {
    if (!getBatchStoreLock(batchId)) {
      lockBatchStore(batchId, mode);
      renderFileReviewEntries();
    }
    appendLog({ status: 'info', message: `批次 ${batchId} 已在入库队列中` });
    return;
  }

  lockBatchStore(batchId, mode);
  renderFileReviewEntries();

  storeQueue.push({ batchId, mode });
  appendLog({ status: 'info', message: `已加入入库队列 (队列长度: ${storeQueue.length})` });

  // 如果当前没有入库操作，开始处理队列
  if (!isStoringInProgress) {
    processStoreQueue();
  }
}

// 处理入库队列
async function processStoreQueue() {
  if (isStoringInProgress || storeQueue.length === 0) {
    return;
  }

  isStoringInProgress = true;

  while (storeQueue.length > 0) {
    const task = storeQueue.shift();
    try {
      await executeStoreTask(task.batchId, task.mode);
    } catch (error) {
      console.error('[入库队列] 处理失败:', error);
      appendLog({ status: 'error', message: `批次 ${task.batchId} 入库失败: ${error.message}` });
    }

    // 等待一小段时间避免 API 限流
    if (storeQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  isStoringInProgress = false;
}

// 执行单个入库任务
async function executeStoreTask(batchId, mode = 'final') {
  let storeLockReleased = false;
  const releaseStoreLock = (render = true) => {
    if (storeLockReleased) return;
    storeLockReleased = true;
    unlockBatchStore(batchId);
    if (render) {
      renderFileReviewEntries();
    }
  };

  try {
    const batch = state.fileReviewBatches.find(b => b.batchId === batchId);
    if (!batch) {
      releaseStoreLock();
      return;
    }

    const approvedFiles = batch.files.filter(f => f.status === FILE_REVIEW_STATUS.APPROVED);
    if (!approvedFiles.length) {
      appendLog({ status: 'warning', message: `批次 ${batchId} 没有合格的文件可入库` });
      releaseStoreLock();
      return;
    }

    const modeLabel = mode === 'partial' ? '部分入库' : '最终入库';
    appendLog({ status: 'info', message: `正在${modeLabel} ${approvedFiles.length} 个文件...` });

    const timestamp = Date.now();
    // 1. 入库合格文件
    const result = await window.bridge.storeFilesToLibrary({
      batchId,
      files: approvedFiles.map(f => ({
        fileId: f.fileId,
        rowNumber: f.rowNumber,
        namingResult: f.namingResult || ''  // 传递规范命名结果
      })),
      mainCategory: batch.mainCategory,
      subCategory: batch.subCategory,
      submitter: batch.submitter,
      folderName: getBatchFinalFolderName(batch),
      folderPattern: batch.folderPattern || '',
      namingMetadata: batch.namingMetadata || '',
      admin: batch.admin || '',
      targetFolderId: batch.targetFolderId || '',
      reviewer: getSubmitterName() || ''
    });

    if (!result.success) {
      appendLog({ status: 'error', message: result.message || '入库失败' });
      releaseStoreLock();
      return;
    }

    const resultEntries = Array.isArray(result.results) ? result.results : [];
    const successIds = new Set(
      resultEntries.filter(r => r.status === 'success' && r.fileId).map(r => r.fileId)
    );
    const failedEntries = resultEntries.filter(r => r.status === 'error');
    const failedIds = new Set(failedEntries.map(r => r.fileId).filter(Boolean));
    const hasPerFileResults = resultEntries.length > 0;
    const storedFiles = hasPerFileResults
      ? approvedFiles.filter(f => successIds.has(f.fileId))
      : (result.errors ? [] : approvedFiles);
    const failedFiles = hasPerFileResults
      ? approvedFiles.filter(f => failedIds.has(f.fileId))
      : (result.errors ? approvedFiles : []);
    const storedCount = hasPerFileResults ? storedFiles.length : (result.stored || 0);
    const errorCount = hasPerFileResults ? failedFiles.length : (result.errors || 0);
    const reviewerName = getSubmitterName() || '';

    // 仅更新成功入库的文件，避免失败也被标记为已入库
    storedFiles.forEach(f => {
      f.status = FILE_REVIEW_STATUS.STORED;
      f.reviewTime = timestamp;
      f.reviewNote = '已入库';
      f.reviewer = reviewerName;
      f._localModifiedAt = timestamp;
      // 更新文件的入库目录链接
      if (result.folderLink) {
        f.finalFolderLink = result.folderLink;
      }
    });

    // 🔧 关键修复：同步更新 state.fileReviewFiles 中对应的文件
    // 否则 mergeFileReviewEntriesWithLocal 无法正确保护本地修改
    if (state.fileReviewFiles) {
      const storedRowNumbers = new Set(storedFiles.map(f => f.rowNumber));
      state.fileReviewFiles.forEach(f => {
        if (storedRowNumbers.has(f.rowNumber)) {
          f.status = FILE_REVIEW_STATUS.STORED;
          f.reviewTime = timestamp;
          f.reviewNote = '已入库';
          f.reviewer = reviewerName;
          f._localModifiedAt = timestamp;
          if (result.folderLink) {
            f.finalFolderLink = result.folderLink;
          }
        }
      });
    }
    // 更新批次统计和入库目录链接
    if (batch.counts) {
      batch.counts.stored = (batch.counts.stored || 0) + storedFiles.length;
      batch.counts.approved = Math.max(0, (batch.counts.approved || 0) - storedFiles.length);
    }
    // 更新批次的入库目录链接
    if (result.folderLink && !batch.finalFolderLink && storedFiles.length > 0) {
      batch.finalFolderLink = result.folderLink;
    }

    appendLog({
      status: errorCount > 0 ? 'warning' : 'success',
      message: `成功入库 ${storedCount} 个文件${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`,
      broadcastGlobal: true
    });

    // 如果有失败的文件，显示明显的错误弹窗
    if (errorCount > 0 && failedEntries.length > 0) {
      failedEntries.forEach(f => {
        console.error('[入库失败]', f.fileId, f.message);
      });
      appendLog({
        status: 'error',
        message: `入库失败原因: ${failedEntries.map(f => f.message).join('; ')}`
      });
      // 显示明显的错误弹窗
      showStoreErrorAlert(storedCount, errorCount, failedEntries);
    }

    if (storedFiles.length > 0) {
      const storedUpdates = storedFiles.map(f => ({
        rowNumber: f.rowNumber,
        status: FILE_REVIEW_STATUS.STORED,
        reviewer: reviewerName,
        reviewNote: '已入库'
      }));
      await batchSaveReviewStatus(storedUpdates);
    }

    // 2. 如果是最终入库，将不合格/待审核文件标记为"作废"
    if (mode === 'final') {
      const nonApprovedFiles = batch.files.filter(f =>
        f.status !== FILE_REVIEW_STATUS.STORED &&
        f.status !== FILE_REVIEW_STATUS.APPROVED
      );

      if (nonApprovedFiles.length > 0) {
        const discardUpdates = nonApprovedFiles.map(f => ({
          rowNumber: f.rowNumber,
          status: FILE_REVIEW_STATUS.DISCARDED
        }));

        nonApprovedFiles.forEach(f => {
          f.status = FILE_REVIEW_STATUS.DISCARDED;
          f.reviewTime = timestamp;
        });

        await batchSaveReviewStatus(discardUpdates);
        appendLog({
          status: 'info',
          message: `已将 ${nonApprovedFiles.length} 个文件标记为作废`
        });
      }
    }

    // 3. 更新批次状态
    if (storedCount === 0 && errorCount > 0) {
      appendLog({ status: 'error', message: '没有文件入库成功，批次状态未更新' });
    }

    // 4. 刷新列表
    await loadFileReviewEntries({ silent: true });

  } catch (error) {
    appendLog({ status: 'error', message: `入库失败：${error.message}` });
  } finally {
    releaseStoreLock();
  }
}

// 对外暴露的入库函数（兼容旧调用）
async function handleBatchStore(batchId, mode = 'final') {
  enqueueStoreTask(batchId, mode);
}

/**
 * 处理文件替换 - 打开替换弹窗
 */
let currentReplaceTarget = null;
let currentReplaceFile = null;

// 添加文件到批次
let currentAddFileBatch = null;
let currentAddFile = null;
let currentBatchSettingsBatchId = null;

function openAddFileToBatchModal(batchInfo) {
  currentAddFileBatch = batchInfo;
  currentAddFile = null;

  const modal = document.getElementById('file-replace-modal');
  const oldFilename = document.getElementById('replace-old-filename');
  const preview = document.getElementById('file-replace-preview');
  const confirmBtn = document.getElementById('file-replace-confirm');
  const dropzone = document.getElementById('file-replace-dropzone');
  const modalTitle = modal?.querySelector('.modal-title');

  // 修改弹窗标题
  if (modalTitle) {
    modalTitle.textContent = batchInfo.isReference ? '添加参考文件' : '添加文件到批次';
  }
  if (oldFilename) {
    oldFilename.textContent = `批次：${batchInfo.batchId}`;
  }
  if (preview) {
    preview.hidden = true;
  }
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = batchInfo.isReference ? '添加参考' : '添加文件';
  }
  if (dropzone) {
    dropzone.classList.remove('drag-over');
    dropzone.style.display = 'block';
  }

  // 标记当前是添加模式
  if (modal) {
    modal.dataset.mode = 'add';
    modal.hidden = false;
  }
}

async function confirmAddFileToBatch() {
  if (!currentAddFileBatch || !currentAddFile) {
    appendLog({ status: 'warning', message: '请选择要添加的文件' });
    return;
  }

  const {
    batchId,
    tempFolderLink,
    submitter,
    mainCategory,
    subCategory,
    taskType,
    isReference,
    admin,
    referenceFolderId,
    referenceFolderLink,
    reviewSlotName,
    reviewDescription,
    reviewNote,
    renamePattern,
    folderPattern,
    namingMetadata,
    targetFolderId,
    renameCounter
  } = currentAddFileBatch;

  // 提取临时目录ID
  let tempFolderId = '';
  if (tempFolderLink) {
    const match = tempFolderLink.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match) {
      tempFolderId = match[1];
    }
  }

  appendLog({ status: 'info', message: `正在添加${isReference ? '参考' : ''}文件...` });

  try {
    const result = await window.bridge.addFileToBatch({
      tempFolderId,
      tempFolderLink,
      batchId,
      submitter,
      mainCategory,
      subCategory,
      taskType,
      isReference,
      admin: admin || '',
      referenceFolderId: referenceFolderId || '',
      referenceFolderLink: referenceFolderLink || '',
      reviewSlotName: reviewSlotName || '',
      reviewDescription: reviewDescription || '',
      reviewNote: reviewNote || '',
      renamePattern: renamePattern || '',
      folderPattern: folderPattern || '',
      namingMetadata: namingMetadata || '',
      targetFolderId: targetFolderId || '',
      renameCounter: Number.isFinite(renameCounter) ? renameCounter : undefined,
      newFile: {
        path: currentAddFile.path,
        name: currentAddFile.name
      }
    });

    if (result.success) {
      appendLog({
        status: 'success',
        message: `${isReference ? '参考' : ''}文件添加成功`,
        broadcastGlobal: true
      });
      closeAddFileModal();
      await loadFileReviewEntries({ silent: true });
    } else {
      appendLog({ status: 'error', message: result.message || '添加失败' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `添加失败：${error.message}` });
  }
}

function closeAddFileModal() {
  const modal = document.getElementById('file-replace-modal');
  const modalTitle = modal?.querySelector('.modal-title');
  const confirmBtn = document.getElementById('file-replace-confirm');

  if (modal) {
    modal.hidden = true;
    modal.dataset.mode = '';
  }
  // 恢复原标题
  if (modalTitle) {
    modalTitle.textContent = '替换文件';
  }
  if (confirmBtn) {
    confirmBtn.textContent = '确认替换';
  }

  currentAddFileBatch = null;
  currentAddFile = null;
}

function openFileReplaceModal(fileInfo) {
  currentReplaceTarget = fileInfo;
  currentReplaceFile = null;

  const modal = document.getElementById('file-replace-modal');
  const oldFilename = document.getElementById('replace-old-filename');
  const preview = document.getElementById('file-replace-preview');
  const confirmBtn = document.getElementById('file-replace-confirm');
  const dropzone = document.getElementById('file-replace-dropzone');

  if (oldFilename) {
    oldFilename.textContent = fileInfo.fileName || '未知文件';
  }
  if (preview) {
    preview.hidden = true;
  }
  if (confirmBtn) {
    confirmBtn.disabled = true;
  }
  if (dropzone) {
    dropzone.classList.remove('drag-over');
    dropzone.style.display = 'block';  // 确保 dropzone 可见
  }

  if (modal) {
    modal.hidden = false;
  }
}

function closeFileReplaceModal() {
  const modal = document.getElementById('file-replace-modal');
  if (modal) {
    modal.hidden = true;
  }
  currentReplaceTarget = null;
  currentReplaceFile = null;
}

function setReplaceFile(file) {
  if (!file) return;

  const modal = document.getElementById('file-replace-modal');
  const isAddMode = modal?.dataset.mode === 'add';

  // 根据模式设置不同的变量
  if (isAddMode) {
    currentAddFile = file;
  } else {
    currentReplaceFile = file;
  }

  const preview = document.getElementById('file-replace-preview');
  const newFilename = document.getElementById('replace-new-filename');
  const confirmBtn = document.getElementById('file-replace-confirm');
  const dropzone = document.getElementById('file-replace-dropzone');

  if (newFilename) {
    newFilename.textContent = file.name;
  }
  if (preview) {
    preview.hidden = false;
  }
  if (confirmBtn) {
    confirmBtn.disabled = false;
  }
  if (dropzone) {
    dropzone.style.display = 'none';
  }
}

function clearReplaceFile() {
  currentReplaceFile = null;

  const preview = document.getElementById('file-replace-preview');
  const confirmBtn = document.getElementById('file-replace-confirm');
  const dropzone = document.getElementById('file-replace-dropzone');

  if (preview) {
    preview.hidden = true;
  }
  if (confirmBtn) {
    confirmBtn.disabled = true;
  }
  if (dropzone) {
    dropzone.style.display = 'block';
  }
}

async function confirmFileReplace() {
  if (!currentReplaceTarget || !currentReplaceFile) {
    appendLog({ status: 'warning', message: '请选择要替换的文件' });
    return;
  }

  appendLog({ status: 'info', message: `正在替换文件 ${currentReplaceTarget.fileName}...` });

  // 获取所属批次信息
  const batch = state.fileReviewBatches.find(b =>
    b.files.some(f => f.rowNumber === currentReplaceTarget.rowNumber)
  );

  // 提取临时目录ID（优先使用 target 中的，fallback 到批次信息）
  let tempFolderLink = currentReplaceTarget.tempFolderLink || batch?.tempFolderLink || '';
  let tempFolderId = '';
  if (tempFolderLink) {
    const match = tempFolderLink.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match) {
      tempFolderId = match[1];
    }
  }

  try {
    const result = await window.bridge.replaceRejectedFile({
      oldFileId: currentReplaceTarget.fileId,
      oldRowNumber: currentReplaceTarget.rowNumber,
      tempFolderId,
      tempFolderLink,
      batchId: currentReplaceTarget.batchId || batch?.batchId || '',
      submitter: batch?.submitter || '',
      mainCategory: batch?.mainCategory || '',
      subCategory: batch?.subCategory || '',
      newFile: {
        path: currentReplaceFile.path,
        name: currentReplaceFile.name
      }
    });

    if (result.success) {
      appendLog({
        status: 'success',
        message: `文件替换成功`,
        broadcastGlobal: true
      });
      closeFileReplaceModal();

      // 立即更新本地状态：清除 annotatedFileId 并设置新的 fileId
      const rowNumber = currentReplaceTarget.rowNumber;
      if (rowNumber && result.newFileId) {
        // 更新 fileReviewFiles 中的对应记录
        const fileInState = state.fileReviewFiles?.find(f => String(f.rowNumber) === String(rowNumber));
        if (fileInState) {
          fileInState.fileId = result.newFileId;
          fileInState.fileLink = result.newFileLink;
          fileInState.fileName = result.newFileName;
          fileInState.annotatedFileId = ''; // 清除旧的标注
          fileInState.annotatedTime = '';
        }
        // 更新 fileReviewBatches 中的对应记录
        state.fileReviewBatches?.forEach(batch => {
          batch.files?.forEach(file => {
            if (String(file.rowNumber) === String(rowNumber)) {
              file.fileId = result.newFileId;
              file.fileLink = result.newFileLink;
              file.fileName = result.newFileName;
              file.annotatedFileId = ''; // 清除旧的标注
              file.annotatedTime = '';
            }
          });
        });
        // 立即刷新 UI 中的缩略图
        document.querySelectorAll(`[data-row="${rowNumber}"]`).forEach(el => {
          if (el.dataset) {
            el.dataset.previewId = result.newFileId;
            el.dataset.fileId = result.newFileId;
          }
          const img = el.querySelector('img');
          if (img) {
            updateReviewThumbImg(img, result.newFileId);
          }
        });
      }

      // 检查是否在批量替换模式中
      if (state.batchReplaceQueue && state.batchReplaceIndex < state.batchReplaceQueue.length) {
        state.batchReplaceIndex++;
        // 延迟一下再处理下一个，让用户看到成功提示
        setTimeout(() => {
          processNextBatchReplace();
        }, 300);
      } else {
        // 非批量模式，直接刷新
        await loadFileReviewEntries({ silent: true });
      }
    } else {
      appendLog({ status: 'error', message: result.message || '替换失败' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `替换失败：${error.message}` });
  }
}

// 初始化替换弹窗事件
function initFileReplaceModal() {
  const modal = document.getElementById('file-replace-modal');
  const closeBtn = document.getElementById('file-replace-close');
  const cancelBtn = document.getElementById('file-replace-cancel');
  const confirmBtn = document.getElementById('file-replace-confirm');
  const clearBtn = document.getElementById('file-replace-clear');
  const dropzone = document.getElementById('file-replace-dropzone');
  const fileInput = document.getElementById('file-replace-input');

  const handleClose = () => {
    if (modal?.dataset.mode === 'add') {
      closeAddFileModal();
    } else {
      closeFileReplaceModal();
    }
  };

  const handleConfirm = () => {
    if (modal?.dataset.mode === 'add') {
      confirmAddFileToBatch();
    } else {
      confirmFileReplace();
    }
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', handleClose);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleClose);
  }
  if (confirmBtn) {
    confirmBtn.addEventListener('click', handleConfirm);
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', clearReplaceFile);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        handleClose();
      }
    });
  }

  if (dropzone && fileInput) {
    // 点击选择文件
    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    // 文件选择
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        setReplaceFile(files[0]);
      }
    });

    // 拖拽事件
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        setReplaceFile(files[0]);
      }
    });
  }
}

async function handleFileReplace(rowNumber) {
  // 从状态中找到对应的文件信息
  const file = state.fileReviewFiles.find(f => f.rowNumber === rowNumber);
  if (!file) {
    appendLog({ status: 'error', message: '未找到文件信息' });
    return;
  }

  openFileReplaceModal(file);
}

/**
 * 批量替换 - 打开新的批量替换弹窗
 */
async function openBatchReplaceModal(rowNumber) {
  const selections = state.reviewFileSelections?.get(rowNumber);
  if (!selections || selections.size === 0) {
    appendLog({ status: 'warning', message: '请先选择要替换的文件' });
    return;
  }

  const selectedFileIds = Array.from(selections);
  const entry = getReviewEntry(rowNumber);

  // 获取选中文件的详情
  const acceptedDetails = getFileDetails(entry, 'accepted') || [];
  const rejectedDetails = getFileDetails(entry, 'rejected') || [];
  const allFiles = [...acceptedDetails, ...rejectedDetails];

  const selectedFiles = allFiles.filter(f => selectedFileIds.includes(f.id));

  if (selectedFiles.length === 0) {
    appendLog({ status: 'warning', message: '未找到选中的文件信息' });
    return;
  }

  // 初始化批量替换状态
  state.batchReplaceFiles = selectedFiles.map(file => ({
    fileId: file.id,
    fileName: file.name,
    rowNumber,
    tempFolderLink: entry?.tempLink || '',
    batchId: entry?.batchId || '',
    newFile: null  // 用户选择的新文件
  }));

  // 渲染批量替换弹窗
  renderBatchReplaceModal();
}

/**
 * 渲染批量替换弹窗内容
 */
function renderBatchReplaceModal() {
  const modal = document.getElementById('batch-replace-modal');
  const list = document.getElementById('batch-replace-list');
  const countEl = document.getElementById('batch-replace-count');
  const confirmBtn = document.getElementById('batch-replace-confirm');

  if (!modal || !list) return;

  // 生成文件列表HTML
  const html = state.batchReplaceFiles.map((file, index) => `
    <div class="batch-replace-item ${file.newFile ? 'has-file' : ''}" data-index="${index}">
      <div class="batch-replace-item-left">
        <div class="batch-replace-thumb">
          <img src="https://drive.google.com/thumbnail?id=${file.fileId}&sz=w80" 
               onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><rect fill=\\'%23e2e8f0\\' width=\\'24\\' height=\\'24\\'/><text x=\\'12\\' y=\\'14\\' text-anchor=\\'middle\\' fill=\\'%2394a3b8\\' font-size=\\'6\\'>文件</text></svg>'" />
        </div>
        <div class="batch-replace-old-name">${escapeHtml(file.fileName)}</div>
      </div>
      <div class="batch-replace-item-right">
        ${file.newFile ? `
          <div class="batch-replace-selected">
            <span class="batch-replace-selected-name">${escapeHtml(file.newFile.name)}</span>
            <button class="batch-replace-clear" data-index="${index}">清除</button>
          </div>
        ` : `
          <div class="batch-replace-dropzone" data-index="${index}">
            <div class="batch-replace-dropzone-icon">📁</div>
            <div class="batch-replace-dropzone-text">拖拽文件或点击选择</div>
            <input type="file" hidden accept="image/*,video/*" data-index="${index}" />
          </div>
        `}
      </div>
    </div>
  `).join('');

  list.innerHTML = html;

  // 更新计数
  const selectedCount = state.batchReplaceFiles.filter(f => f.newFile).length;
  countEl.textContent = `${selectedCount}/${state.batchReplaceFiles.length} 已选择`;
  confirmBtn.disabled = selectedCount === 0;

  // 绑定事件
  setupBatchReplaceEvents(list);

  // 显示弹窗
  modal.hidden = false;
}

/**
 * 设置批量替换弹窗的事件
 */
function setupBatchReplaceEvents(container) {
  // 点击dropzone选择文件
  container.querySelectorAll('.batch-replace-dropzone').forEach(dropzone => {
    const index = parseInt(dropzone.dataset.index);
    const input = dropzone.querySelector('input[type="file"]');

    dropzone.addEventListener('click', () => input?.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        selectBatchReplaceFile(index, file);
      }
    });

    input?.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        selectBatchReplaceFile(index, file);
      }
    });
  });

  // 清除按钮
  container.querySelectorAll('.batch-replace-clear').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      if (state.batchReplaceFiles[index]) {
        state.batchReplaceFiles[index].newFile = null;
        renderBatchReplaceModal();
      }
    });
  });
}

/**
 * 选择批量替换的新文件
 */
function selectBatchReplaceFile(index, file) {
  if (state.batchReplaceFiles[index]) {
    state.batchReplaceFiles[index].newFile = file;
    renderBatchReplaceModal();
  }
}

/**
 * 初始化批量替换弹窗事件
 */
function initBatchReplaceModalEvents() {
  const modal = document.getElementById('batch-replace-modal');
  const closeBtn = document.getElementById('batch-replace-close');
  const cancelBtn = document.getElementById('batch-replace-cancel');
  const confirmBtn = document.getElementById('batch-replace-confirm');

  // 关闭/取消
  closeBtn?.addEventListener('click', closeBatchReplaceModal);
  cancelBtn?.addEventListener('click', closeBatchReplaceModal);

  // 确认替换全部
  confirmBtn?.addEventListener('click', async () => {
    const filesToReplace = state.batchReplaceFiles.filter(f => f.newFile);
    if (filesToReplace.length === 0) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = '替换中...';

    appendLog({
      status: 'info',
      message: `开始批量替换 ${filesToReplace.length} 个文件...`
    });

    let successCount = 0;
    for (const item of filesToReplace) {
      try {
        await executeFileReplace({
          oldFileId: item.fileId,
          oldFileName: item.fileName,
          newFile: item.newFile,
          rowNumber: item.rowNumber,
          tempFolderLink: item.tempFolderLink,
          batchId: item.batchId
        });
        successCount++;
      } catch (error) {
        appendLog({
          status: 'error',
          message: `替换 ${item.fileName} 失败: ${error.message}`
        });
      }
    }

    appendLog({
      status: 'success',
      message: `批量替换完成！成功 ${successCount}/${filesToReplace.length} 个文件`
    });

    closeBatchReplaceModal();

    // 刷新审核列表
    if (typeof loadReviewEntries === 'function') {
      await loadReviewEntries(true);
    }
  });

  // 点击背景关闭
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeBatchReplaceModal();
    }
  });
}

/**
 * 关闭批量替换弹窗
 */
function closeBatchReplaceModal() {
  const modal = document.getElementById('batch-replace-modal');
  if (modal) modal.hidden = true;
  state.batchReplaceFiles = [];
}

/**
 * 执行单个文件替换
 */
async function executeFileReplace({ oldFileId, oldFileName, newFile, rowNumber, tempFolderLink, batchId }) {
  // 从临时目录链接提取文件夹ID
  const folderMatch = tempFolderLink.match(/folders\/([a-zA-Z0-9_-]+)/);
  const tempFolderId = folderMatch ? folderMatch[1] : null;

  if (!tempFolderId) {
    throw new Error('无法获取临时目录ID');
  }

  // 上传新文件
  const result = await window.bridge.uploadFile({
    file: {
      path: newFile.path,
      name: newFile.name,
      type: newFile.type,
      size: newFile.size
    },
    targetFolderId: tempFolderId,
    overrideName: newFile.name
  });

  if (!result?.file?.id) {
    throw new Error('上传失败');
  }

  appendLog({
    status: 'success',
    message: `✓ 已替换: ${oldFileName} → ${newFile.name}`
  });

  return result;
}

// 在 DOMContentLoaded 时初始化批量替换事件
document.addEventListener('DOMContentLoaded', () => {
  initBatchReplaceModalEvents();
});

function renderReviewEntries() {
  const container = elements.reviewList;
  if (!container) return;
  if (state.reviewLoading) {
    container.innerHTML = '<div class="slot-empty">审核数据加载中，请稍候...</div>';
    return;
  }
  const pendingEntries = state.reviewEntries.filter((entry) => {
    const status = normalizeReviewStatus(entry.status);
    return status && REVIEW_PENDING_STATUSES.has(status);
  });
  if (!pendingEntries.length) {
    container.innerHTML = '<div class="slot-empty">暂无待审核记录</div>';
    renderReviewPagination();
    renderSubmitterSuggestions();
    return;
  }
  const rangeFiltered = filterReviewEntriesByRange(pendingEntries);
  if (!rangeFiltered.length) {
    state.reviewPage = 1;
    const rangeMode = normalizeReviewRangeMode(state.reviewRangeMode);
    const message = rangeMode === 'all' ? '暂无待审核记录' : '最近 10 天内暂无待审核记录';
    container.innerHTML = `<div class="slot-empty">${message}</div>`;
    renderReviewPagination();
    renderSubmitterSuggestions();
    return;
  }
  const orderedEntries = prioritizeReviewEntries(rangeFiltered);
  let pageEntries = orderedEntries;
  if (normalizeReviewRangeMode(state.reviewRangeMode) === 'all') {
    const totalPages = Math.max(1, Math.ceil(orderedEntries.length / REVIEW_ALL_PAGE_SIZE));
    state.reviewPage = Math.min(Math.max(1, state.reviewPage), totalPages);
    const start = (state.reviewPage - 1) * REVIEW_ALL_PAGE_SIZE;
    pageEntries = orderedEntries.slice(start, start + REVIEW_ALL_PAGE_SIZE);
    renderReviewPagination(totalPages);
  } else {
    state.reviewPage = 1;
    renderReviewPagination();
  }
  // 保存当前选择状态的快照（在渲染前）
  const selectionsSnapshot = getFileSelectionsSnapshot();

  container.innerHTML = pageEntries
    .map((entry) =>
      buildReviewCard(entry, {
        fileContext: 'review',
        noteMode: 'input',
        noteValue: getReviewNoteValue(entry),
        interactiveFiles: true,  // 启用交互式文件选择
        allowRefresh: true,
        actionsHtml: buildReviewerActions(entry, normalizeReviewStatus(entry.status))
      })
    )
    .join('');
  renderSubmitterSuggestions();

  // 为审核面板的文件预览添加鼠标悬停事件处理
  setupReviewFilePreviewHandlers(container);

  // 设置交互式文件网格的事件处理
  setupInteractiveFileGridHandlers(container);

  // 恢复选择状态（渲染后）
  restoreFileSelectionsFromSnapshot(selectionsSnapshot);

  // 清除待刷新提示
  const pendingHint = container.querySelector('.review-pending-refresh-hint');
  if (pendingHint) {
    pendingHint.remove();
  }
}

async function refreshReviewEntryFiles(rowNumber) {
  if (!window.bridge?.refreshReviewFiles) {
    appendLog({ status: 'error', message: '当前版本不支持刷新云端文件清单' });
    return;
  }
  const entry = getReviewEntry(rowNumber);
  if (!entry) {
    appendLog({ status: 'error', message: '未找到该审核记录' });
    return;
  }

  console.log('\n====== 前端刷新云端文件调试信息 ======');
  console.log('rowNumber:', rowNumber);
  console.log('entry.folderId:', entry.folderId);
  console.log('entry.tempLink:', entry.tempLink);
  console.log('entry.folderLink:', entry.folderLink);
  console.log('entry.finishedFolderId:', entry.finishedFolderId);
  console.log('entry.status:', entry.status);

  // 检查审核状态
  const isApproved = entry.normalizedStatus === REVIEW_STATUS.APPROVED;

  // 根据审核状态选择读取源
  let folderId;
  let finishedFolderId = '';
  const tempFolderId = extractDriveFolderId(entry.tempLink || '') || extractDriveFolderId(entry.tempParentId || '');
  const reviewFolderId = entry.reviewFolderId || tempFolderId || extractDriveFolderId(entry.rawFolderId || '');

  if (isApproved) {
    // 审核通过：从最终目录读取所有文件
    folderId = extractDriveFolderId(entry.folderLink || '') ||
      extractDriveFolderId(entry.lastFolderLink || '');

    if (!folderId) {
      // 如果没有最终目录，尝试从审核文件夹读取
      folderId = entry.folderId || extractDriveFolderId(entry.tempLink || '');
      appendLog({
        status: 'warning',
        message: '该审核记录缺少最终目录链接，将尝试从审核文件夹读取（文件可能已移走）'
      });
    } else {
      appendLog({
        status: 'info',
        message: '从最终目录刷新文件列表...'
      });
    }
    // 审核通过时不区分成品/非成品，所有文件都是合格的
    finishedFolderId = '';
  } else {
    // 未通过/待审核：从审核文件夹读取
    folderId = entry.folderId ||
      extractDriveFolderId(entry.tempLink || '') ||
      extractDriveFolderId(entry.folderLink || '');
    finishedFolderId = entry.finishedFolderId || '';
  }

  console.log('最终使用的 folderId:', folderId);
  console.log('最终使用的 finishedFolderId:', finishedFolderId);
  console.log('============================\n');

  if (!folderId) {
    appendLog({ status: 'error', message: '该审核记录缺少有效的审核链接/目录，无法刷新文件清单' });
    return;
  }

  const readableTitle = entry.displayTitle || getReviewEntryTitle(entry) || `记录 ${rowNumber}`;
  try {
    appendLog({
      status: 'info',
      message: `正在刷新"${readableTitle}"的云端文件...${isApproved ? '（从最终目录）' : ''}`,
      broadcastGlobal: true
    });

    const acceptedPayload = await window.bridge.refreshReviewFiles({
      rowNumber: entry.rowNumber,
      folderId,
      finishedFolderId,
      isApproved, // 传递审核状态给后端
      acceptedFiles: entry.acceptedFiles || [],
      rejectedFiles: entry.rejectedFiles || [],
      acceptedDetails: entry.acceptedDetails || [],
      rejectedDetails: entry.rejectedDetails || []
    });

    if (!acceptedPayload) {
      throw new Error('未返回文件数据');
    }

    entry.folderId = folderId;

    if (isApproved) {
      // 若有临时审核目录，用它单独获取不合格文件（与成品独立）
      let rejectedPayload = null;
      if (reviewFolderId && reviewFolderId !== folderId) {
        try {
          rejectedPayload = await window.bridge.refreshReviewFiles({
            rowNumber: entry.rowNumber,
            folderId: reviewFolderId,
            finishedFolderId: '',
            isApproved: false,
            acceptedFiles: [],
            rejectedFiles: [],
            acceptedDetails: [],
            rejectedDetails: []
          });
        } catch (error) {
          console.warn('刷新不合格文件失败，将跳过不合格列表', error);
        }
      }

      // 审核通过：优先使用后端返回的新数据（来自最终目录）
      const derivedDetails = Array.isArray(acceptedPayload.acceptedDetails) ? acceptedPayload.acceptedDetails : [];
      const savedDetails = Array.isArray(entry.acceptedDetails) ? entry.acceptedDetails : [];
      const useDetails = derivedDetails.length ? derivedDetails : savedDetails;

      const enrichWithLinks = (file) => {
        const fileName = file.name || '';
        const lowerName = fileName.toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif'].some(ext => lowerName.endsWith(ext));
        const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv'].some(ext => lowerName.endsWith(ext));
        const id = file.id || file.fileId || '';
        const driveViewLink = file.link || (id ? `https://drive.google.com/file/d/${id}/view` : '');
        const thumbnailUrl = file.thumbnail || ((isImage || isVideo) && id ? `https://drive.google.com/thumbnail?id=${id}&sz=w100` : '');
        const previewUrl = file.previewLink || (id
          ? (isVideo ? `https://drive.google.com/uc?export=download&id=${id}` : `https://drive.google.com/thumbnail?id=${id}&sz=w800`)
          : '');
        return {
          ...file,
          id,
          link: driveViewLink || file.link || '',
          thumbnail: thumbnailUrl || file.thumbnail || '',
          previewLink: previewUrl || driveViewLink || file.previewLink || ''
        };
      };

      entry.acceptedDetails = useDetails.map(enrichWithLinks);

      // 不合格文件独立：若有临时目录结果则使用，否则保持已有
      if (rejectedPayload) {
        entry.rejectedFiles = Array.isArray(rejectedPayload.rejectedFiles) ? rejectedPayload.rejectedFiles : [];
        entry.rejectedDetails = Array.isArray(rejectedPayload.rejectedDetails) ? rejectedPayload.rejectedDetails : [];
      } else {
        entry.rejectedFiles = Array.isArray(entry.rejectedFiles) ? entry.rejectedFiles : [];
        entry.rejectedDetails = Array.isArray(entry.rejectedDetails) ? entry.rejectedDetails : [];
      }

      entry.acceptedFiles = entry.acceptedDetails.map(d => d.name);
      entry.finishedFolderId = acceptedPayload.finishedFolderId || entry.finishedFolderId || folderId || '';
      entry.reviewFolderId = reviewFolderId || entry.reviewFolderId || '';
    } else {
      // 未通过/待审核：直接使用返回的数据
      entry.acceptedFiles = Array.isArray(acceptedPayload.acceptedFiles) ? acceptedPayload.acceptedFiles : [];
      entry.rejectedFiles = Array.isArray(acceptedPayload.rejectedFiles) ? acceptedPayload.rejectedFiles : [];
      entry.acceptedDetails = Array.isArray(acceptedPayload.acceptedDetails) ? acceptedPayload.acceptedDetails : [];
      entry.rejectedDetails = Array.isArray(acceptedPayload.rejectedDetails) ? acceptedPayload.rejectedDetails : [];
      entry.finishedFolderId = acceptedPayload.finishedFolderId || entry.finishedFolderId || '';
    }

    entry.autoList = true;
    if (state.reviewEntryCache) {
      const cacheKey = getReviewerKey(entry);
      if (cacheKey) {
        state.reviewEntryCache.set(cacheKey, entry);
      }
    }
    renderReviewEntries();
    renderSubmitterSuggestions();

    const acceptedCount = entry.acceptedFiles.length;
    const rejectedCount = entry.rejectedFiles.length;
    const total = acceptedCount + rejectedCount;

    appendLog({
      status: 'success',
      message: `已刷新"${readableTitle}"的云端文件，共 ${total} 个${isApproved ? '（已通过，从最终目录读取）' : ''}`,
      broadcastGlobal: true
    });

    if (!isApproved) {
      if (!acceptedPayload.finishedFolderId) {
        appendLog({
          status: 'warning',
          message: '未检测到名为"成品"的子文件夹，合格文件列表将保持为空，请确认云端目录结构。',
          broadcastGlobal: true
        });
      } else if (!acceptedCount) {
        appendLog({
          status: 'warning',
          message: '"成品"子文件夹当前为空，尚无合格文件可显示。',
          broadcastGlobal: true
        });
      }
    }

    if (!total) {
      appendLog({
        status: 'warning',
        message: '该审核目录下未检测到任何文件，请检查审核链接是否指向正确的 Drive 目录。',
        broadcastGlobal: true
      });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `刷新云端文件失败：${error.message}` });
  }
}

function renderReviewPagination(totalPages = 0) {
  const container = elements.reviewPagination;
  if (!container) return;
  if (normalizeReviewRangeMode(state.reviewRangeMode) !== 'all' || totalPages <= 1) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.hidden = false;
  const page = Math.min(Math.max(1, state.reviewPage || 1), totalPages);
  const prevDisabled = page <= 1 ? 'disabled' : '';
  const nextDisabled = page >= totalPages ? 'disabled' : '';
  container.innerHTML = `
    <button type="button" data-action="review-page-prev" ${prevDisabled}>上一页</button>
    <span>第 ${page} / ${totalPages} 页</span>
    <button type="button" data-action="review-page-next" ${nextDisabled}>下一页</button>
  `;
}

function getReviewEntry(rowNumber) {
  return state.reviewEntries.find((entry) => entry.rowNumber === Number(rowNumber));
}

function getReviewEntryTitle(entry = {}) {
  if (!entry) {
    return '-';
  }
  const naming = (entry.reviewSlotName || '').trim();
  if (naming) {
    return naming;
  }
  const description = (entry.description || '').trim();
  if (description) {
    return description;
  }
  const main = (entry.mainCategory || '').trim();
  const sub = (entry.subCategory || '').trim();
  if (main || sub) {
    return [main || '-', sub || '-'].filter(Boolean).join(' / ');
  }
  return '-';
}

function getEntryCategoryLabel(entry = {}) {
  const main = (entry.mainCategory || '').trim();
  const sub = (entry.subCategory || '').trim();
  const parts = [main, sub].filter(Boolean);
  return parts.join(' / ');
}

function ensureDriveFolderLink(value) {
  if (!value) {
    return '';
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }
  if (/^(https?:|file:)/i.test(trimmed)) {
    return trimmed;
  }
  const extracted = extractDriveFolderId(trimmed);
  if (extracted) {
    return `https://drive.google.com/drive/folders/${extracted}`;
  }
  return '';
}

function enhanceReviewEntries(entries = []) {
  let slotLinksUpdated = false;
  entries.forEach((entry) => {
    entry.normalizedStatus = normalizeReviewStatus(entry.status);
    entry.displayTitle = getReviewEntryTitle(entry);
    // 为后续缓存/通知提供稳定的主键
    entry.reviewKey = getReviewerKey(entry) || '';
    entry.submitterKey = getEntryKey(entry) || '';
    if (entry.folderLink) {
      entry.folderLink = ensureDriveFolderLink(entry.folderLink);
    } else {
      const folderId =
        entry.folderLinkId ||
        entry.reviewTargetFolderId ||
        entry.targetFolderId ||
        entry.categoryFolderId ||
        entry.folderId;
      const derivedLink = ensureDriveFolderLink(folderId);
      if (derivedLink) {
        entry.folderLink = derivedLink;
      }
    }
    if (!entry.tempLink && entry.reviewFolderLink) {
      const tempLink = ensureDriveFolderLink(entry.reviewFolderLink);
      if (tempLink) {
        entry.tempLink = tempLink;
      }
    }
    if (entry.normalizedStatus === REVIEW_STATUS.APPROVED && entry.folderLink && entry.reviewTaskId) {
      setSlotLink(entry.reviewTaskId, entry.folderLink, false);
      slotLinksUpdated = true;
    }
  });
  if (slotLinksUpdated) {
    renderSlots();
  }
}

function clearAcknowledgements() {
  if (!state.reviewAcknowledged) {
    state.reviewAcknowledged = {
      reviewer: new Map(),
      submitter: new Map()
    };
    return;
  }
  state.reviewAcknowledged.reviewer?.clear?.();
  state.reviewAcknowledged.submitter?.clear?.();
  persistAcknowledgementRecords();
}

async function applyReviewStatus(rowNumber) {
  const select = document.querySelector(`.review-status-select[data-row="${rowNumber}"]`);
  const button = document.querySelector(`button[data-action="apply-review-status"][data-row="${rowNumber}"]`);
  const status = (select?.value || REVIEW_STATUS.PENDING).trim();

  // 防止重复点击
  if (button?.disabled) {
    return;
  }

  // 立即禁用按钮，提供视觉反馈
  if (button) {
    button.disabled = true;
    button.classList.add('loading');
  }

  // 调用对应的处理函数（它们会管理按钮的最终状态）
  if (status === REVIEW_STATUS.APPROVED) {
    await handleApproveReview(rowNumber);
  } else if (status === REVIEW_STATUS.NEEDS_CHANGE || status === REVIEW_STATUS.PARTIAL_CHANGE) {
    await handleSuggestionReview(rowNumber, status);
  } else if (
    status === REVIEW_STATUS.UPDATED ||
    status === REVIEW_STATUS.PENDING ||
    status === REVIEW_STATUS.CANCELLED
  ) {
    await handleReopenReview(rowNumber, status);
  } else {
    appendLog({ status: 'error', message: `未知的审核状态：${status}` });
    // 恢复按钮（未知状态时）
    if (button) {
      button.disabled = false;
      button.classList.remove('loading');
    }
  }
}

function initMyReviewFilters() {
  if (elements.myReviewRange) {
    elements.myReviewRange.value = state.myReviewFilters.range;
  }
  if (elements.myReviewLimit) {
    elements.myReviewLimit.value = state.myReviewFilters.limit;
  }
  if (elements.myReviewCustomStart) {
    elements.myReviewCustomStart.value = state.myReviewFilters.customStart;
  }
  if (elements.myReviewCustomEnd) {
    elements.myReviewCustomEnd.value = state.myReviewFilters.customEnd;
  }
  updateMyReviewCustomVisibility();
}

function updateMyReviewCustomVisibility() {
  if (!elements.myReviewCustomRange) return;
  elements.myReviewCustomRange.hidden = state.myReviewFilters.range !== 'custom';
}

function coerceMyReviewRange(value) {
  const next = typeof value === 'string' ? value : '';
  return MY_REVIEW_RANGES.has(next) ? next : '10d';
}

function setMyReviewRange(value) {
  state.myReviewFilters.range = coerceMyReviewRange(value);
  state.myReviewPage = 1;
  if (elements.myReviewRange) {
    elements.myReviewRange.value = state.myReviewFilters.range;
  }
  updateMyReviewCustomVisibility();
  renderSubmitterSuggestions();
}

function clampMyReviewLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return MY_REVIEW_DEFAULT_LIMIT;
  }
  if (numeric <= 0) {
    return MY_REVIEW_MIN_LIMIT;
  }
  return Math.max(MY_REVIEW_MIN_LIMIT, Math.min(MY_REVIEW_MAX_LIMIT, Math.round(numeric)));
}

function setMyReviewLimit(value) {
  state.myReviewFilters.limit = clampMyReviewLimit(value);
  if (elements.myReviewLimit) {
    elements.myReviewLimit.value = state.myReviewFilters.limit;
  }
  renderSubmitterSuggestions();
}

function setMyReviewCustomDate(type, value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (type === 'start') {
    state.myReviewFilters.customStart = normalized;
    if (elements.myReviewCustomStart) {
      elements.myReviewCustomStart.value = normalized;
    }
  } else {
    state.myReviewFilters.customEnd = normalized;
    if (elements.myReviewCustomEnd) {
      elements.myReviewCustomEnd.value = normalized;
    }
  }
  renderSubmitterSuggestions();
}

function resetMyReviewFilters() {
  Object.assign(state.myReviewFilters, {
    range: '10d',
    limit: MY_REVIEW_DEFAULT_LIMIT,
    customStart: '',
    customEnd: '',
    status: 'all'
  });
  state.myReviewPage = 1;
  initMyReviewFilters();
  renderSubmitterSuggestions();
}

function normalizeMyReviewStatus(value) {
  return MY_REVIEW_STATUS_KEYS.includes(value) ? value : 'all';
}

function setMyReviewStatusFilter(value) {
  const normalized = normalizeMyReviewStatus(value);
  const current = state.myReviewFilters.status || 'all';
  const next = normalized === current && normalized !== 'all' ? 'all' : normalized;
  state.myReviewFilters.status = next;
  renderSubmitterSuggestions();
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseFlexibleDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const input = String(value).trim();
  if (!input) return null;
  let parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  if (/^\d{8}$/.test(input)) {
    const year = Number(input.slice(0, 4));
    const month = Number(input.slice(4, 6)) - 1;
    const day = Number(input.slice(6, 8));
    parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(input)) {
    const normalized = input.replace(/[/.]/g, '-');
    parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function getEntryCompletedDate(entry = {}) {
  return parseFlexibleDate(entry.completedAt || entry.customDate || '');
}

function getEntryTimestamp(entry) {
  const date = getEntryCompletedDate(entry);
  return date ? date.getTime() : 0;
}

function persistReviewSortPreference(sort) {
  try {
    localStorage.setItem(REVIEW_SORT_STORAGE_KEY, JSON.stringify(sort));
  } catch (error) {
    console.error('Failed to save review sort preference', error);
  }
}

function restoreReviewSortPreference() {
  try {
    const stored = localStorage.getItem(REVIEW_SORT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        state.reviewSort = {
          mode: normalizeReviewSortMode(parsed.mode)
        };
      }
    }
  } catch (error) {
    console.error('Failed to restore review sort preference', error);
  }
  updateReviewSortControls();
}

function updateReviewSortControls() {
  if (elements.reviewSortMode) {
    const normalized = normalizeReviewSortMode(state.reviewSort?.mode || 'priority');
    elements.reviewSortMode.value = normalized;
  }
}

function setReviewSortMode(mode) {
  const normalized = normalizeReviewSortMode(mode);
  state.reviewSort.mode = normalized;
  updateReviewSortControls();
  persistReviewSortPreference(state.reviewSort);
  renderReviewEntries();
}

function getMyReviewDateRange() {
  const now = new Date();
  const { range, customStart, customEnd } = state.myReviewFilters;
  if (range === 'all') {
    return { start: null, end: null };
  }
  if (range === 'custom') {
    const start = customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : null;
    const end = customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : null;
    if (start && Number.isNaN(start.getTime())) {
      return { start: null, end };
    }
    if (end && Number.isNaN(end.getTime())) {
      return { start, end: null };
    }
    return { start, end };
  }
  if (range === 'today') {
    return { start: startOfDay(now), end: endOfDay(now) };
  }
  if (range === '24h') {
    return { start: new Date(now.getTime() - DAY_IN_MS), end: now };
  }
  if (/^\d+d$/.test(range)) {
    const days = Number(range.replace('d', '')) || 1;
    return { start: new Date(now.getTime() - days * DAY_IN_MS), end: now };
  }
  return { start: null, end: null };
}

function applyMyReviewFilters(entries = []) {
  const sorted = entries.slice().sort((a, b) => getEntryTimestamp(b) - getEntryTimestamp(a));
  const { start, end } = getMyReviewDateRange();
  const statusKey = normalizeMyReviewStatus(state.myReviewFilters.status || 'all');
  const sortMode = state.myReviewSort?.mode || 'priority';
  let baseSorted;
  if (sortMode === 'date-asc') {
    baseSorted = entries.slice().sort((a, b) => getEntryTimestamp(a) - getEntryTimestamp(b));
  } else if (sortMode === 'date-desc') {
    baseSorted = entries.slice().sort((a, b) => getEntryTimestamp(b) - getEntryTimestamp(a));
  } else if (sortMode === 'category-asc' || sortMode === 'category-desc') {
    baseSorted = sortEntriesByCategory(entries, sortMode === 'category-asc');
  } else {
    baseSorted = prioritizeReviewEntries(entries);
  }

  if (statusKey === 'approved' || statusKey === 'partial' || statusKey === 'allStored') {
    return applyDateFilter(baseSorted, start, end).filter((entry) =>
      matchesMyReviewStatusFilter(entry, statusKey)
    );
  }
  if (statusKey === 'all') {
    return baseSorted.filter((entry) => {
      const status = normalizeReviewStatus(entry.status);
      if (status === REVIEW_STATUS.APPROVED) {
        return isEntryWithinRange(entry, start, end);
      }
      return true;
    });
  }
  return baseSorted.filter((entry) => matchesMyReviewStatusFilter(entry, statusKey));
}

function getBatchCompletedDate(batch = {}) {
  return parseFlexibleDate(batch.submitTime || '');
}

function getBatchTimestamp(batch) {
  const date = getBatchCompletedDate(batch);
  return date ? date.getTime() : 0;
}

function matchesMyFileReviewStatusFilter(batch, statusKey) {
  const displayStatus = (batch.batchStatus || getBatchOverallStatus(batch) || '').trim();
  if (statusKey === 'approved') {
    return displayStatus === '已入库' || displayStatus === '已审核通过' || displayStatus === '已通过';
  }
  if (statusKey === 'completed') {
    return displayStatus === '已完成';
  }
  if (statusKey === 'waiting') {
    return displayStatus === '等待入库';
  }
  if (statusKey === 'partial') {
    return isPartialBatchStatus(displayStatus);
  }
  if (statusKey === 'allStored') {
    return displayStatus === '已入库' || displayStatus === '已完成' || displayStatus === '已审核通过' ||
      displayStatus === '已通过' || isPartialBatchStatus(displayStatus);
  }
  if (statusKey === 'cancelled') {
    return displayStatus === '已取消' || displayStatus === '取消审核' || displayStatus === '已取消审核';
  }
  if (statusKey === 'feedback') {
    return displayStatus === '需要修改' ||
      displayStatus === '需修改' ||
      displayStatus === '一部分需要修改';
  }
  if (statusKey === 'pending') {
    return displayStatus === '待审核' || displayStatus === '已更新修改';
  }
  return true;
}

function applyMyFileReviewFilters(batches = []) {
  const { start, end } = getMyReviewDateRange();
  const statusKey = normalizeMyReviewStatus(state.myReviewFilters.status || 'all');
  const baseSorted = batches.slice().sort((a, b) => getBatchTimestamp(b) - getBatchTimestamp(a));
  const dateFiltered = baseSorted.filter((batch) => {
    if (!start && !end) {
      return true;
    }
    const date = getBatchCompletedDate(batch);
    if (!date) {
      return true;
    }
    if (start && date < start) {
      return false;
    }
    if (end && date > end) {
      return false;
    }
    return true;
  });
  if (statusKey === 'all') {
    return dateFiltered;
  }
  return dateFiltered.filter((batch) => matchesMyFileReviewStatusFilter(batch, statusKey));
}

function applyDateFilter(entries = [], start, end) {
  if (!start && !end) {
    return entries;
  }
  return entries.filter((entry) => isEntryWithinRange(entry, start, end));
}

function isEntryWithinRange(entry, start, end) {
  const date = getEntryCompletedDate(entry);
  if (!date) {
    return true;
  }
  if (start && date < start) {
    return false;
  }
  if (end && date > end) {
    return false;
  }
  return true;
}

function describeMyReviewRange() {
  const { range, customStart, customEnd } = state.myReviewFilters;
  if (range === 'custom' && (customStart || customEnd)) {
    if (customStart && customEnd) {
      return `${customStart} ~ ${customEnd}`;
    }
    if (customStart) {
      return `${customStart} 起`;
    }
    return `截至 ${customEnd}`;
  }
  return REVIEW_RANGE_LABELS[range] || '';
}

function getMyReviewStatusLabel(key = 'all') {
  return MY_REVIEW_STATUS_LABELS[key] || MY_REVIEW_STATUS_LABELS.all;
}

function describeMyReviewStatus() {
  const status = normalizeMyReviewStatus(state.myReviewFilters.status || 'all');
  if (status === 'all') {
    return '';
  }
  return getMyReviewStatusLabel(status);
}

function getMyReviewSummaryCounts(entries = []) {
  return entries.reduce(
    (acc, entry) => {
      const status = normalizeReviewStatus(entry.status);
      if (status === REVIEW_STATUS.APPROVED) {
        acc.approved += 1;
      } else if (status === REVIEW_STATUS.PARTIAL_CHANGE) {
        acc.partial += 1;
      } else if (status === REVIEW_STATUS.CANCELLED) {
        acc.cancelled += 1;
      } else if (status === REVIEW_STATUS.NEEDS_CHANGE) {
        acc.feedback += 1;
      } else if (status === REVIEW_STATUS.PENDING || status === REVIEW_STATUS.UPDATED) {
        acc.pending += 1;
      }
      acc.total += 1;
      return acc;
    },
    { total: 0, pending: 0, feedback: 0, approved: 0, partial: 0, cancelled: 0 }
  );
}

function renderMyReviewSummary(entries = [], baseCounts = null) {
  if (!elements.myReviewSummary) {
    return;
  }
  const counts = baseCounts || getMyReviewSummaryCounts(entries);
  const activeStatus = normalizeMyReviewStatus(state.myReviewFilters.status || 'all');
  const summaryCards = [
    { key: 'total', label: '筛选记录', value: counts.total, statusKey: 'all' },
    { key: 'pending', label: '待审核', value: counts.pending, className: 'pending', statusKey: 'pending' },
    { key: 'feedback', label: '需修改', value: counts.feedback, className: 'feedback', statusKey: 'feedback' },
    { key: 'approved', label: '已入库', value: counts.approved, className: 'approved', statusKey: 'approved' },
    { key: 'partial', label: '已部分入库', value: counts.partial, className: 'partial', statusKey: 'partial' },
    {
      key: 'allStored',
      label: '所有入库',
      value: counts.approved + counts.partial,
      className: 'all-stored',
      statusKey: 'allStored'
    },
    { key: 'cancelled', label: '已取消', value: counts.cancelled, statusKey: 'cancelled' }
  ];
  elements.myReviewSummary.innerHTML = summaryCards
    .map(
      (card) => {
        const statusKey = normalizeMyReviewStatus(card.statusKey || 'all');
        const isActive = statusKey === activeStatus;
        const classes = ['review-summary-card', card.className || '', isActive ? 'active' : '']
          .filter(Boolean)
          .join(' ');
        return `
        <div class="${classes}" data-status-filter="${statusKey}">
          <span class="label">${card.label}</span>
          <span class="value">${card.value}</span>
        </div>
      `;
      }
    )
    .join('');
}

function renderMyReviewInfo(allEntries = [], filteredEntries = [], displayed = 0) {
  if (!elements.myReviewInfo) {
    return;
  }
  if (!allEntries.length) {
    elements.myReviewInfo.textContent = '当前提交人暂无审核记录';
    return;
  }
  const parts = [`共有 ${allEntries.length} 条记录`];
  const rangeDesc = describeMyReviewRange();
  const filteredDesc = rangeDesc ? `${rangeDesc} · ${filteredEntries.length} 条` : `${filteredEntries.length} 条`;
  parts.push(`筛选：${filteredDesc}`);
  const statusDesc = describeMyReviewStatus();
  if (statusDesc) {
    parts.push(`状态：${statusDesc}`);
  }
  parts.push(`已显示 ${Math.min(displayed, filteredEntries.length)} 条`);
  elements.myReviewInfo.textContent = parts.join(' · ');
}

function renderMyReviewPagination(totalPages = 0) {
  const container = elements.myReviewPagination;
  if (!container) return;
  const usingAllRange = state.myReviewFilters.range === 'all';
  if (!usingAllRange || totalPages <= 1) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.hidden = false;
  const currentPage = Math.min(Math.max(1, state.myReviewPage || 1), totalPages);
  const prevDisabled = currentPage <= 1 ? 'disabled' : '';
  const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
  container.innerHTML = `
    <button type="button" data-action="my-review-prev" ${prevDisabled}>上一页</button>
    <span>第 ${currentPage} / ${totalPages} 页</span>
    <button type="button" data-action="my-review-next" ${nextDisabled}>下一页</button>
  `;
}

function getReviewStatusClass(status = '') {
  const normalized = normalizeReviewStatus(status);
  if (!normalized) return '';
  if (normalized === REVIEW_STATUS.APPROVED) return 'status-approved';
  if (normalized === REVIEW_STATUS.CANCELLED) return 'status-cancelled';
  if (normalized === REVIEW_STATUS.NEEDS_CHANGE || normalized === REVIEW_STATUS.PARTIAL_CHANGE) {
    return 'status-feedback';
  }
  if (normalized === REVIEW_STATUS.PENDING || normalized === REVIEW_STATUS.UPDATED) {
    return 'status-pending';
  }
  return '';
}

const REVIEW_STATUS_CLASSES = [
  'status-approved',
  'status-cancelled',
  'status-feedback',
  'status-pending'
];

function updateReviewCardStatusUI(rowNumber, statusText) {
  const card = document.querySelector(`.review-card[data-row="${rowNumber}"]`);
  if (!card) return null;
  const chip = card.querySelector('.review-card-status-chip');
  const value = chip?.querySelector('.status-value');
  const statusClass = getReviewStatusClass(statusText);
  const snapshot = {
    text: value?.textContent || '',
    cardClass: REVIEW_STATUS_CLASSES.find(cls => card.classList.contains(cls)) || '',
    chipClass: REVIEW_STATUS_CLASSES.find(cls => chip?.classList.contains(cls)) || ''
  };

  REVIEW_STATUS_CLASSES.forEach((cls) => {
    card.classList.remove(cls);
    chip?.classList.remove(cls);
  });
  if (statusClass) {
    card.classList.add(statusClass);
    chip?.classList.add(statusClass);
  }
  if (value) {
    value.textContent = statusText || '';
  }
  return snapshot;
}

function restoreReviewCardStatusUI(rowNumber, snapshot) {
  if (!snapshot) return;
  const card = document.querySelector(`.review-card[data-row="${rowNumber}"]`);
  if (!card) return;
  const chip = card.querySelector('.review-card-status-chip');
  const value = chip?.querySelector('.status-value');

  REVIEW_STATUS_CLASSES.forEach((cls) => {
    card.classList.remove(cls);
    chip?.classList.remove(cls);
  });
  if (snapshot.cardClass) {
    card.classList.add(snapshot.cardClass);
  }
  if (snapshot.chipClass) {
    chip?.classList.add(snapshot.chipClass);
  }
  if (value) {
    value.textContent = snapshot.text || '';
  }
}

/**
 * 渲染"我的审核"面板 - 按文件审核模式
 */
function renderMyFileReviewBatches(submitter) {
  const container = elements.myReviewList;
  if (!container) return;
  const activeNoteSnapshot = captureActiveNoteInput();

  const normalizedSubmitter = submitter.trim();

  // 筛选当前用户提交的批次
  const allMyBatches = (state.fileReviewBatches || []).filter(batch => {
    return (batch.submitter || '').trim() === normalizedSubmitter;
  });
  const filteredBatches = applyMyFileReviewFilters(allMyBatches);
  let visibleBatches = filteredBatches;
  if (state.myReviewFilters.range === 'all') {
    const totalPages = Math.max(1, Math.ceil(filteredBatches.length / MY_REVIEW_PAGE_SIZE));
    state.myReviewPage = Math.min(Math.max(1, state.myReviewPage || 1), totalPages);
    const start = (state.myReviewPage - 1) * MY_REVIEW_PAGE_SIZE;
    visibleBatches = filteredBatches.slice(start, start + MY_REVIEW_PAGE_SIZE);
    renderMyReviewPagination(totalPages);
  } else {
    state.myReviewPage = 1;
    renderMyReviewPagination();
    visibleBatches = filteredBatches.slice(0, state.myReviewFilters.limit);
  }

  // 计算文件统计数据
  const totalFiles = allMyBatches.reduce((sum, b) => sum + b.counts.total, 0);
  const storedFiles = allMyBatches.reduce((sum, b) => sum + b.counts.stored, 0);
  const approvedFiles = allMyBatches.reduce((sum, b) => sum + b.counts.approved, 0);
  const pendingFiles = allMyBatches.reduce((sum, b) => sum + b.counts.pending, 0);
  const rejectedFiles = allMyBatches.reduce((sum, b) => sum + b.counts.rejected, 0);

  // 计算批次统计（按批次整体状态）
  const batchCounts = {
    total: allMyBatches.length,
    pending: 0,      // 待审核
    feedback: 0,     // 需修改（部分或全部不合格）
    waiting: 0,      // 等待入库
    approved: 0,     // 已入库（全部已入库）
    partial: 0,      // 部分入库
    completed: 0,    // 不需入库已审核完
    cancelled: 0     // 已取消
  };

  allMyBatches.forEach(batch => {
    const batchStatus = (batch.batchStatus || getBatchOverallStatus(batch) || '').trim();
    if (batchStatus === '已审核通过' || batchStatus === '已入库') {
      batchCounts.approved++;
    } else if (batchStatus === '已完成') {
      batchCounts.completed++;
    } else if (batchStatus === '等待入库') {
      batchCounts.waiting++;
    } else if (isPartialBatchStatus(batchStatus)) {
      batchCounts.partial++;
    } else if (batchStatus === '待审核') {
      batchCounts.pending++;
    } else if (
      batchStatus === '需要修改' ||
      batchStatus === '一部分需要修改' ||
      batchStatus === '需修改'
    ) {
      batchCounts.feedback++;
    } else if (batchStatus === '已取消') {
      batchCounts.cancelled++;
    } else {
      // 其他状态归入待审核
      batchCounts.pending++;
    }
  });

  // 渲染筛选卡片（按批次数量统计）- 与总审核面板一致
  if (elements.myReviewSummary) {
    const activeStatus = normalizeMyReviewStatus(state.myReviewFilters?.status || 'all');
    const summaryCards = [
      { key: 'pending', label: '待审核', value: batchCounts.pending, className: 'pending', statusKey: 'pending' },
      { key: 'feedback', label: '需修改', value: batchCounts.feedback, className: 'feedback', statusKey: 'feedback' },
      { key: 'partial', label: '已部分入库', value: batchCounts.partial, className: 'partial', statusKey: 'partial' },
      { key: 'waiting', label: '等待入库', value: batchCounts.waiting, className: 'waiting', statusKey: 'waiting' },
      { key: 'approved', label: '已入库', value: batchCounts.approved, className: 'approved', statusKey: 'approved' },
      { key: 'completed', label: '不需入库已审核完', value: batchCounts.completed, className: 'completed', statusKey: 'completed' },
      {
        key: 'allStored',
        label: '所有入库',
        value: batchCounts.approved + batchCounts.completed + batchCounts.partial,
        className: 'all-stored',
        statusKey: 'allStored'
      },
      { key: 'cancelled', label: '已取消', value: batchCounts.cancelled, className: 'cancelled', statusKey: 'cancelled' },
      { key: 'total', label: '全部', value: batchCounts.total, className: 'all', statusKey: 'all' }
    ];
    elements.myReviewSummary.innerHTML = summaryCards
      .map(card => {
        const statusKey = normalizeMyReviewStatus(card.statusKey || 'all');
        const isActive = statusKey === activeStatus;
        const classes = ['review-summary-card', card.className || '', isActive ? 'active' : '']
          .filter(Boolean)
          .join(' ');
        return `
          <div class="${classes}" data-status-filter="${statusKey}">
            <span class="summary-value">${card.value}</span>
            <span class="summary-label">${card.label}</span>
          </div>
        `;
      })
      .join('');
  }

  // 渲染信息栏
  if (elements.myReviewInfo) {
    const parts = [`共 ${allMyBatches.length} 个批次，${totalFiles} 个文件`];
    const rangeDesc = describeMyReviewRange();
    const filteredDesc = rangeDesc ? `${rangeDesc} · ${filteredBatches.length} 个批次` : `${filteredBatches.length} 个批次`;
    parts.push(`筛选：${filteredDesc}`);
    const statusDesc = describeMyReviewStatus();
    if (statusDesc) {
      parts.push(`状态：${statusDesc}`);
    }
    parts.push(`已显示 ${Math.min(visibleBatches.length, filteredBatches.length)} 个`);
    parts.push(`已入库 ${storedFiles} | 合格 ${approvedFiles} | 待审 ${pendingFiles} | 不合格 ${rejectedFiles}`);
    elements.myReviewInfo.textContent = parts.join(' · ');
  }

  if (!allMyBatches.length) {
    container.innerHTML = '<div class="slot-empty">暂无提交的审核记录</div>';
    return;
  }

  if (!visibleBatches.length) {
    container.innerHTML = '<div class="slot-empty">该筛选条件下暂无批次</div>';
    return;
  }

  // 渲染批次卡片（使用与总审核面板相同的函数，保持UI一致）
  container.innerHTML = visibleBatches.map(batch => buildFileReviewBatchCard(batch, {})).join('');

  // 设置事件处理（预览等）
  setupMyFileReviewHandlers(container);
  hydrateReviewThumbsFromCache(container);
  if (activeNoteSnapshot?.inMyReviewList) {
    restoreActiveNoteInput(activeNoteSnapshot, container);
  }

  // 恢复选择状态
  restoreMyReviewSelections(container);

  // 后台检测各批次是否有未同步的新文件
  checkBatchesForNewFiles(container);
}

/**
 * 构建"我的审核"批次卡片
 * 分为5个清晰的区块：审核信息区、文件夹链接区、文件审核区、参考区、操作区
 */
function buildMyFileReviewBatchCard(batch) {
  // 使用批次整体状态
  const overallStatus = getBatchOverallStatus(batch);
  const statusClass = getBatchOverallStatusClass(batch);

  // 读取保存的视图大小偏好
  const viewPrefs = JSON.parse(localStorage.getItem('batchViewSizePrefs') || '{}');

  // 固定区域高度方案：根据图片数量计算最佳的图片大小
  const fileCount = batch.files?.length || 0;
  let autoViewSize = 'large';
  if (fileCount > 12) autoViewSize = 'medium';
  if (fileCount > 24) autoViewSize = 'small';

  const savedViewSize = viewPrefs[batch.batchId] || autoViewSize;
  const viewSizeClass = ` view-${savedViewSize}`;

  // 批次的手动状态（如果有的话用手动状态，否则用计算的状态）
  const manualStatus = batch.batchStatus || '';  // 手动设置的状态
  const displayStatus = manualStatus || overallStatus;
  const displayStatusClass = manualStatus ? getBatchManualStatusClass(manualStatus) : statusClass;
  const batchNoteSummary = getBatchNoteSummary(batch);
  const finalFolderName = getBatchFinalFolderName(batch);
  const namingDisplay = getBatchNamingDisplay(batch);
  const namingMetadata = parseNamingMetadataSafe(batch.namingMetadata);
  const adminValue = batch.admin || namingMetadata.admin || '';
  const adminName = adminValue || '-';
  const batchTaskType = getBatchTaskType(batch) || '';
  const referenceFolderLink = batch.referenceFolderLink || '';
  const reviewSlotName = batch.reviewSlotName || '';
  const reviewDescription = batch.reviewDescription || '';
  const submitNote = batch.submitNote || batch.reviewNote || '';

  // ========== 1. 审核信息区 ==========
  const infoSectionHtml = `
    <div class="review-section review-info-section">
      <div class="review-section-header">
        <span class="review-section-icon">📋</span>
        <span class="review-section-title">审核信息</span>
        <span class="batch-status ${displayStatusClass}">${displayStatus}</span>
        <button class="btn-edit-batch-settings" data-batch-id="${batch.batchId}" title="修改批次设置">✏️ 修改设置</button>
      </div>
      <div class="review-info-grid">
        <div class="review-info-item">
          <span class="info-label">批次ID</span>
          <span class="info-value batch-id-value">${escapeHtml(batch.batchId)}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">提交人</span>
          <span class="info-value">${escapeHtml(batch.submitter || '-')}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">管理员</span>
          <span class="info-value">${escapeHtml(adminName)}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">入库分类</span>
          <span class="info-value">${escapeHtml(batch.mainCategory)} / ${escapeHtml(batch.subCategory)}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">任务类型</span>
          <span class="info-value">${escapeHtml(getBatchTaskType(batch) || '-')}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">最终文件夹名</span>
          <span class="info-value">${escapeHtml(finalFolderName)}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">文件命名</span>
          <span class="info-value">${namingDisplay ? escapeHtml(namingDisplay) : '-'}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">提交时间</span>
          <span class="info-value">${batch.submitTime || '-'}</span>
        </div>
        <div class="review-info-item">
          <span class="info-label">文件统计</span>
          <span class="info-value">
            共 <strong>${batch.counts.total}</strong> 个：
            <span class="count-pending">待审 ${batch.counts.pending}</span> |
            <span class="count-approved">合格 ${batch.counts.approved}</span> |
            <span class="count-rejected">不合格 ${batch.counts.rejected}</span> |
            <span class="count-stored">已入库 ${batch.counts.stored}</span>
          </span>
        </div>
        ${batchNoteSummary ? `
        <div class="review-info-item">
          <span class="info-label">批次备注</span>
          <span class="info-value batch-note-highlight">${escapeHtml(batchNoteSummary)}</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  // ========== 2. 文件夹链接区 ==========
  const hasLinks = batch.tempFolderLink || batch.finalFolderLink;
  const isCompleted = manualStatus === '已完成'; // 不需入库已审核完

  // 如果有链接或者是已完成状态，都显示这个区域
  const linksSectionHtml = (hasLinks || isCompleted) ? `
    <div class="review-section review-links-section">
      <div class="review-section-header">
        <span class="review-section-icon">🔗</span>
        <span class="review-section-title">文件夹链接</span>
        <div class="review-section-toolbar">
          <button class="sync-batch-btn" 
                  data-batch-id="${batch.batchId}"
                  data-temp-folder-link="${escapeHtml(batch.tempFolderLink || '')}"
                  data-submitter="${escapeHtml(batch.submitter)}"
                  data-main-category="${escapeHtml(batch.mainCategory)}"
                  data-sub-category="${escapeHtml(batch.subCategory)}"
                  data-task-type="${escapeHtml(batchTaskType)}"
                  data-admin="${escapeHtml(adminValue)}"
                  data-reference-folder-id="${escapeHtml(batch.referenceFolderId || '')}"
                  data-reference-folder-link="${escapeHtml(referenceFolderLink)}"
                  data-rename-pattern="${escapeHtml(batch.renamePattern || '')}"
                  data-folder-pattern="${escapeHtml(batch.folderPattern || '')}"
                  data-naming-metadata="${escapeHtml(batch.namingMetadata || '')}"
                  data-target-folder-id="${escapeHtml(batch.targetFolderId || '')}"
                  data-review-slot-name="${escapeHtml(reviewSlotName)}"
                  data-review-description="${escapeHtml(reviewDescription)}"
                  data-review-note="${escapeHtml(submitNote)}"
                  title="同步检测云端新增文件">🔄 同步检测</button>
          <button class="add-file-btn" 
                  data-batch-id="${batch.batchId}"
                  data-temp-folder-link="${escapeHtml(batch.tempFolderLink || '')}"
                  data-submitter="${escapeHtml(batch.submitter)}"
                  data-main-category="${escapeHtml(batch.mainCategory)}"
                  data-sub-category="${escapeHtml(batch.subCategory)}"
                  data-file-count="${batch.counts?.total || batch.files?.length || 0}"
                  data-task-type="${escapeHtml(batchTaskType)}"
                  data-admin="${escapeHtml(adminValue)}"
                  data-reference-folder-id="${escapeHtml(batch.referenceFolderId || '')}"
                  data-reference-folder-link="${escapeHtml(referenceFolderLink)}"
                  data-rename-pattern="${escapeHtml(batch.renamePattern || '')}"
                  data-folder-pattern="${escapeHtml(batch.folderPattern || '')}"
                  data-naming-metadata="${escapeHtml(batch.namingMetadata || '')}"
                  data-target-folder-id="${escapeHtml(batch.targetFolderId || '')}"
                  data-review-slot-name="${escapeHtml(reviewSlotName)}"
                  data-review-description="${escapeHtml(reviewDescription)}"
                  data-review-note="${escapeHtml(submitNote)}"
                  data-is-reference="false"
                  title="添加文件">➕ 添加文件</button>
        </div>
      </div>
      <div class="review-links-grid">
        ${batch.tempFolderLink ? `
          <button class="folder-link-btn temp-folder open-external-link" 
                  data-url="${batch.tempFolderLink}" 
                  title="点击在浏览器中打开待审目录">
            <span class="folder-icon">📁</span>
            <span class="folder-info">
              <span class="folder-type">待审目录</span>
              <span class="folder-hint">上传的原始文件</span>
            </span>
            <span class="open-icon">↗</span>
          </button>
        ` : ''}
        ${batch.finalFolderLink ? `
          <button class="folder-link-btn final-folder open-external-link" 
                  data-url="${batch.finalFolderLink}" 
                  title="点击在浏览器中打开入库目录">
            <span class="folder-icon">📂</span>
            <span class="folder-info">
              <span class="folder-type">入库目录</span>
              <span class="folder-hint">${batch.counts.stored > 0 ? '已入库 ' + batch.counts.stored + ' 个文件' : '审核通过后归档'}</span>
            </span>
            <span class="open-icon">↗</span>
          </button>
        ` : ''}
        ${isCompleted && !batch.finalFolderLink ? `
          <div class="folder-link-placeholder">
            <span class="folder-icon">✅</span>
            <span class="folder-info">
              <span class="folder-type">无需入库</span>
              <span class="folder-hint">已审核完成，无需入库操作</span>
            </span>
          </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  // ========== 3. 文件审核区 ==========
  const sortedFiles = Array.isArray(batch.files) ? batch.files.slice() : [];
  sortedFiles.sort((a, b) => {
    const aRow = Number(a?.rowNumber || 0);
    const bRow = Number(b?.rowNumber || 0);
    return aRow - bRow;
  });
  const filesHtml = sortedFiles.map(file => {
    const fileStatusClass = getFileReviewStatusClass(file.status);
    const isChecked = file.status === FILE_REVIEW_STATUS.APPROVED || file.status === FILE_REVIEW_STATUS.STORED;
    const isRejected = file.status === FILE_REVIEW_STATUS.REJECTED;
    const isStored = file.status === FILE_REVIEW_STATUS.STORED;
    const statusIcon = isStored ? '📦' : (isChecked ? '✓' : (isRejected ? '✗' : '○'));
    const previewFileId = getReviewPreviewFileId(file);

    return `
      <div class="file-card ${fileStatusClass}" data-file-id="${file.fileId}" data-row="${file.rowNumber}">
        <div class="file-card-thumb file-preview-trigger" 
             data-file-id="${file.fileId}" 
             data-preview-id="${previewFileId}"
             data-file-name="${escapeHtml(file.fileName)}"
             data-file-link="${file.fileLink}"
             data-row="${file.rowNumber}">
          <img src="https://drive.google.com/thumbnail?id=${previewFileId}&sz=w200&t=${encodeURIComponent(file.annotatedTime || file.reviewTime || file.submitTime || file.rowNumber || file.fileId || '')}" 
               loading="eager"
               decoding="async"
               onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><rect fill=\\'%23e2e8f0\\' width=\\'24\\' height=\\'24\\'/><text x=\\'12\\' y=\\'14\\' text-anchor=\\'middle\\' fill=\\'%2394a3b8\\' font-size=\\'8\\'>文件</text></svg>'" 
               alt="${escapeHtml(file.fileName)}" />
          <span class="file-card-status-badge ${fileStatusClass}">${statusIcon}</span>
          
          <div class="file-card-actions" onclick="event.stopPropagation()">
            <button class="file-card-btn" 
                    data-action="replace" data-row="${file.rowNumber}" 
                    data-file-id="${file.fileId}" data-file-name="${escapeHtml(file.fileName)}"
                    data-temp-folder-link="${escapeHtml(batch.tempFolderLink || '')}"
                    data-batch-id="${escapeHtml(batch.batchId)}"
                    title="替换">🔄</button>
            <button class="file-card-btn delete" 
                    data-action="delete" data-row="${file.rowNumber}" 
                    data-file-id="${file.fileId}" data-file-name="${escapeHtml(file.fileName)}"
                    data-batch-id="${escapeHtml(batch.batchId)}"
                    title="删除" ${isStored ? 'disabled' : ''}>🗑</button>
            <button class="file-card-btn" 
                    data-action="open" data-url="${file.fileLink}"
                    title="在浏览器中打开">↗</button>
          </div>
        </div>
        ${file.reviewNote ? `<div class="file-card-note" title="${escapeHtml(file.reviewNote)}" style="width:100%; border-radius:0 0 4px 4px; margin:0; border:none; border-top:1px solid #fecaca;">💬 ${escapeHtml(file.reviewNote)}</div>` : ''}
      </div>
    `;
  }).join('');

  const filesSectionHtml = `
    <div class="review-section review-files-section">
      <div class="review-section-header">
        <span class="review-section-icon">📄</span>
        <span class="review-section-title">提交的文件 (${batch.files?.length || 0})</span>
        <div class="review-section-toolbar">
          <div class="view-size-toggle" data-batch-id="${batch.batchId}" title="切换缩略图大小">
            <button class="view-size-btn${savedViewSize === 'large' ? ' active' : ''}" data-size="large" title="大图">◆</button>
            <button class="view-size-btn${savedViewSize === 'medium' ? ' active' : ''}" data-size="medium" title="中图">🔸</button>
            <button class="view-size-btn${savedViewSize === 'small' ? ' active' : ''}" data-size="small" title="小图">🔹</button>
          </div>
          <span class="toolbar-divider"></span>
          <button class="btn-select-all" data-batch-id="${batch.batchId}" title="全选">☑ 全选</button>
          <button class="btn-select-invert" data-batch-id="${batch.batchId}" title="反选">⇄ 反选</button>
          <button class="btn-select-all-rejected" data-batch-id="${batch.batchId}" title="选中所有不合格文件">选中不合格</button>
          <button class="btn-select-none" data-batch-id="${batch.batchId}" title="取消全选">☐ 取消</button>
          <span class="selection-divider"></span>
          <button class="btn-batch-replace" data-batch-id="${batch.batchId}" title="批量替换选中的文件" disabled>🔄 批量替换</button>
          <span class="selection-count" data-batch-id="${batch.batchId}">已选 0 个</span>
        </div>
      </div>
      <div class="file-review-files-grid">
        ${filesHtml}
      </div>
    </div>
  `;

  // ========== 4. 参考区 ==========
  const referenceFiles = batch.referenceFiles || [];
  const referenceFilesHtml = referenceFiles.length > 0
    ? referenceFiles.map(file => `
        <div class="reference-file-item file-preview-trigger" 
             data-file-id="${file.fileId}" 
             data-preview-id="${file.fileId}"
             data-file-name="${escapeHtml(file.fileName)}"
             data-file-link="${file.fileLink}">
          <img src="https://drive.google.com/thumbnail?id=${file.fileId}&sz=w80" 
               loading="eager"
               decoding="async"
               onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><rect fill=\\'%23e2e8f0\\' width=\\'24\\' height=\\'24\\'/><text x=\\'12\\' y=\\'14\\' text-anchor=\\'middle\\' fill=\\'%2394a3b8\\' font-size=\\'6\\'>参考</text></svg>'" 
               alt="${escapeHtml(file.fileName)}" 
               title="${escapeHtml(file.fileName)}" />
        </div>
      `).join('')
    : '<div class="reference-empty">暂无参考文件</div>';

  const referenceSectionHtml = (referenceFiles.length > 0 || batch.tempFolderLink) ? `
    <div class="review-section review-reference-section file-review-reference-section" id="ref-section-${batch.batchId}" data-batch-id="${batch.batchId}" data-temp-folder-link="${escapeHtml(batch.tempFolderLink || '')}">
      <div class="review-section-header">
        <span class="review-section-icon">📎</span>
        <span class="review-section-title">参考文件 (${referenceFiles.length})</span>
        <div class="review-section-toolbar">
          <button class="add-file-btn" 
                  data-batch-id="${batch.batchId}"
                  data-temp-folder-link="${escapeHtml(batch.tempFolderLink || '')}"
                  data-submitter="${escapeHtml(batch.submitter)}"
                  data-main-category="${escapeHtml(batch.mainCategory)}"
                  data-sub-category="${escapeHtml(batch.subCategory)}"
                  data-admin="${escapeHtml(adminValue)}"
                  data-reference-folder-id="${escapeHtml(batch.referenceFolderId || '')}"
                  data-reference-folder-link="${escapeHtml(referenceFolderLink)}"
                  data-rename-pattern="${escapeHtml(batch.renamePattern || '')}"
                  data-folder-pattern="${escapeHtml(batch.folderPattern || '')}"
                  data-naming-metadata="${escapeHtml(batch.namingMetadata || '')}"
                  data-target-folder-id="${escapeHtml(batch.targetFolderId || '')}"
                  data-review-slot-name="${escapeHtml(reviewSlotName)}"
                  data-review-description="${escapeHtml(reviewDescription)}"
                  data-review-note="${escapeHtml(submitNote)}"
                  data-is-reference="true"
                  title="添加参考文件">📎 添加参考</button>
        </div>
      </div>
      <div class="reference-files-grid" id="ref-grid-${batch.batchId}">
        ${referenceFilesHtml}
      </div>
    </div>
  ` : '';

  // ========== 5. 操作区（提交人专用） ==========
  // 判断当前状态来源：整体需要修改 vs 一部分需要修改
  const isUpdatedStatus = displayStatus.startsWith('已更新修改');
  const isPreviouslyNeedsChange = displayStatus === '需要修改' || displayStatus === '需修改';
  const isPreviouslyPartialChange =
    displayStatus === '一部分需要修改' ||
    displayStatus === '部分需要修改' ||
    displayStatus === '一部分已入库，部分需要修改';

  // 确定更新后应使用的状态（带来源标记）
  let updateStatusType = '已更新修改';
  let updateStatusLabel = '✉ 已更新修改，通知审核员';
  if (isPreviouslyNeedsChange) {
    updateStatusType = '已更新修改(整体)';
    updateStatusLabel = '✉ 整体已更新，通知审核员';
  } else if (isPreviouslyPartialChange) {
    updateStatusType = '已更新修改(部分)';
    updateStatusLabel = '✉ 补充文件已更新，通知审核员';
  }

  // 获取当前按钮的禁用状态和显示文本
  const isUpdateBtnDisabled = isUpdatedStatus;
  const updateBtnText = isUpdatedStatus
    ? (displayStatus === '已更新修改(整体)' ? '✓ 已通知审核员（整体复审）'
      : displayStatus === '已更新修改(部分)' ? '✓ 已通知审核员（部分复审）'
        : '✓ 已通知审核员')
    : updateStatusLabel;

  const showCancelModify =
    displayStatus === '一部分已入库，部分需要修改' || displayStatus === '已更新修改(部分)';
  const actionSectionHtml = `
    <div class="review-section review-status-section">
      <div class="review-section-header">
        <span class="review-section-icon">⚡</span>
        <span class="review-section-title">我的操作</span>
      </div>
      <div class="review-status-content">
        <div class="review-action-buttons my-review-actions">
          <button class="btn-update-status ${isUpdatedStatus ? 'active' : ''}" 
                  data-batch-id="${batch.batchId}"
                  data-status="${updateStatusType}"
                  data-previous-status="${displayStatus}"
                  ${isUpdateBtnDisabled ? 'disabled' : ''}>
            ${updateBtnText}
          </button>
          ${showCancelModify ? `
          <button class="btn-cancel-modify"
                  data-batch-id="${batch.batchId}"
                  data-status="部分已入库">
            取消修改，保持部分入库
          </button>` : ''}
          <button class="btn-cancel-status ${displayStatus === '已取消' ? 'active' : ''}" 
                  data-batch-id="${batch.batchId}"
                  data-status="已取消"
                  ${displayStatus === '已取消' ? 'disabled' : ''}>
            🚫 取消审核
          </button>
        </div>
      </div>
    </div>
  `;

  // ========== 组装完整卡片 ==========
  return `
    <div class="file-review-batch-card ${displayStatusClass}${viewSizeClass}" data-batch-id="${batch.batchId}">
      ${infoSectionHtml}
      ${linksSectionHtml}
      ${filesSectionHtml}
      ${referenceSectionHtml}
      ${actionSectionHtml}
    </div>
  `;
}

function getBatchNoteSummary(batch) {
  return (batch.batchNote || '').trim();
}

function getBatchNoteInputValue(batch) {
  return (batch.batchNote || '').trim();
}

function getBatchNamingDisplay(batch) {
  let result = '';
  if (batch.namingResult) {
    result = batch.namingResult;
  } else {
    const files = batch.files || [];
    const sample = files.find(file => (file.namingResult || '').trim());
    if (sample && sample.namingResult) {
      result = sample.namingResult;
    } else {
      result = (batch.renamePattern || state.config.renamePattern || '').trim();
    }
  }

  // 如果 result 中还有未替换的 token，尝试用批次数据替换
  if (result && result.includes('{{')) {
    const namingMetadata = parseNamingMetadataSafe(batch.namingMetadata);
    const tokens = {
      submitter: batch.submitter || namingMetadata.submitter || '',
      admin: batch.admin || namingMetadata.admin || '',
      subject: namingMetadata.subject || '',
      customDate: namingMetadata.customDate || '',
      country: namingMetadata.country || '',
      software: namingMetadata.software || '',
      eventName: namingMetadata.eventName || ''
    };
    // 添加自定义文本字段
    Object.keys(namingMetadata).forEach(key => {
      if (key.startsWith('customText:')) {
        tokens[key] = namingMetadata[key] || '';
      }
    });
    result = result.replace(/\{\{(\w+(?::\w+)?)\}\}/g, (match, key) => {
      return tokens[key] !== undefined ? tokens[key] : match;
    });
  }

  return result;
}

function getBatchFinalFolderName(batch) {
  const submitter = (batch.submitter || '').trim() || 'Unknown';
  const submitTime = (batch.submitTime || '').trim();
  const digits = submitTime.match(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/);
  let dateStr = '';
  if (digits && digits[0]) {
    dateStr = digits[0].replace(/[^\d]/g, '');
  }
  if (!dateStr || dateStr.length !== 8) {
    const now = new Date();
    dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  }

  const namingPattern = (batch.folderPattern || state.config.folderPattern || '').trim();
  const namingMetadata = parseNamingMetadataSafe(batch.namingMetadata);
  if (namingPattern) {
    const tokens = {
      ...namingMetadata,
      customDate: namingMetadata.customDate || dateStr,
      submitter: namingMetadata.submitter || submitter,
      admin: namingMetadata.admin || batch.admin || '',
      software: namingMetadata.software || '',
      subject: namingMetadata.subject || '',
      country: namingMetadata.country || '',
      subjectOrOriginal: namingMetadata.subject || namingMetadata.originalName || '',
      originalName: namingMetadata.originalName || ''
    };
    return namingPattern.replace(/\{\{(.*?)\}\}/g, (_match, key) => {
      const cleanKey = key.trim();
      const value = tokens[cleanKey];
      if (cleanKey.startsWith('customText:')) {
        return tokens[cleanKey] || '';
      }
      return value != null ? String(value) : '';
    }).replace(/\s+/g, '_');
  }

  return `${dateStr}-${submitter}`;
}

function parseNamingMetadataSafe(raw) {
  if (!raw) return {};
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
    if (parsed && parsed.customTexts && typeof parsed.customTexts === 'object') {
      Object.entries(parsed.customTexts).forEach(([key, value]) => {
        if (parsed[key] === undefined) {
          parsed[key] = value;
        }
      });
    }
    return parsed || {};
  } catch (error) {
    return {};
  }
}

function getBatchTaskType(batch) {
  if (batch.taskType) return batch.taskType;
  const file = (batch.files || []).find(item => item.taskType);
  return file ? file.taskType : '';
}

function parseCustomTextLines(text) {
  const entries = {};
  const lines = String(text || '').split('\n');
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const [rawKey, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();
    let key = rawKey.trim();
    if (!key) return;
    if (!key.startsWith('customText:')) {
      key = `customText:${key}`;
    }
    entries[key] = value;
  });
  return entries;
}

function buildNamingMetadataForBatch(batch, fields) {
  const metadata = parseNamingMetadataSafe(batch.namingMetadata);
  const next = { ...metadata };
  next.admin = fields.admin ?? next.admin ?? '';
  next.subject = fields.subject ?? next.subject ?? '';
  next.eventName = fields.eventName ?? next.eventName ?? '';
  next.customDate = fields.customDate ?? next.customDate ?? '';
  next.country = fields.country ?? next.country ?? '';
  next.software = fields.software ?? next.software ?? '';

  if (fields.customTexts !== undefined) {
    const customEntries = parseCustomTextLines(fields.customTexts || '');
    Object.keys(next).forEach((key) => {
      if (key.startsWith('customText:') && !(key in customEntries)) {
        delete next[key];
      }
    });
    Object.entries(customEntries).forEach(([key, value]) => {
      next[key] = value;
    });
  }

  return next;
}

function normalizeTokenKey(tokenValue = '') {
  return tokenValue.replace(/^\{\{|\}\}$/g, '').trim();
}

function getBatchSettingsTokenSet(patterns = []) {
  const tokens = new Set();
  patterns.forEach((pattern) => {
    parsePattern(pattern || '')
      .filter((token) => token.type === 'token')
      .forEach((token) => tokens.add(normalizeTokenKey(token.value)));
  });
  return tokens;
}

function updateBatchSettingsFieldVisibility(modal) {
  if (!modal) return;
  const renamePattern = modal.querySelector('#batch-settings-rename-pattern')?.value || '';
  const folderPattern = modal.querySelector('#batch-settings-folder-pattern')?.value || '';
  const tokens = getBatchSettingsTokenSet([renamePattern, folderPattern]);
  const tokenKeys = Array.from(tokens);
  const hasCustomText = tokenKeys.some((key) => key.startsWith('customText:'));

  const shouldShow = {
    admin: tokens.has('admin'),
    subject: tokens.has('subject') || tokens.has('subjectOrOriginal'),
    eventName: tokens.has('eventName'),
    customDate: tokens.has('customDate'),
    country: tokens.has('country'),
    software: tokens.has('software'),
    customText: hasCustomText
  };

  modal.querySelectorAll('.batch-settings-field[data-token]').forEach((field) => {
    const token = field.dataset.token;
    const visible = shouldShow[token];
    field.classList.toggle('is-hidden', !visible);
  });

  // 同时更新预览
  updateBatchSettingsPreview(modal);
}

function updateBatchSettingsPreview(modal) {
  if (!modal) return;

  const renamePattern = modal.querySelector('#batch-settings-rename-pattern')?.value || '';
  const folderPattern = modal.querySelector('#batch-settings-folder-pattern')?.value || '';
  const renamePreviewEl = modal.querySelector('#batch-settings-rename-preview');
  const folderPreviewEl = modal.querySelector('#batch-settings-folder-preview');

  // 获取当前编辑的批次信息
  const batch = currentBatchSettingsBatchId
    ? state.fileReviewBatches?.find(b => b.batchId === currentBatchSettingsBatchId)
    : null;

  // 收集当前输入的字段值
  const fields = {
    admin: modal.querySelector('#batch-settings-admin')?.value || '',
    subject: modal.querySelector('#batch-settings-subject')?.value || '',
    eventName: modal.querySelector('#batch-settings-event')?.value || '',
    customDate: modal.querySelector('#batch-settings-custom-date')?.value || '',
    country: modal.querySelector('#batch-settings-country')?.value || '',
    software: modal.querySelector('#batch-settings-software')?.value || ''
  };

  // 解析自定义字段
  const customTextsRaw = modal.querySelector('#batch-settings-custom-texts')?.value || '';
  const customEntries = parseCustomTextLines(customTextsRaw);

  // 构建预览用的 token 值映射
  // 使用批次的提交人，而不是当前登录用户
  const sampleTokens = {
    '{{country}}': fields.country || '国家',
    '{{customDate}}': fields.customDate || '日期',
    '{{software}}': fields.software || '软件',
    '{{subject}}': fields.subject || '图片名称',
    '{{eventName}}': fields.eventName || '事件名称',
    '{{admin}}': fields.admin || '管理员',
    '{{submitter}}': batch?.submitter || state.loggedInUser?.name || '提交人',
    '{{counter}}': '001',
    '{{ext}}': '.jpg',
    '{{originalName}}': '原文件名',
    '{{subjectOrOriginal}}': fields.subject || '描述',
    '{{zb}}': 'ZB',
    '{{pageName}}': '专页名称',
    '{{distribution}}': '可分发',
    '{{customPlaceholder}}': '自定义'
  };

  // 添加自定义字段
  Object.entries(customEntries).forEach(([key, value]) => {
    sampleTokens[`{{${key}}}`] = value || key;
  });

  // 生成预览文本
  const renamePreview = renamePattern
    ? renamePattern.replace(/\{\{[^}]+\}\}/g, (match) => sampleTokens[match] || match)
    : '-';
  const folderPreview = folderPattern
    ? folderPattern.replace(/\{\{[^}]+\}\}/g, (match) => sampleTokens[match] || match)
    : '-';

  if (renamePreviewEl) {
    renamePreviewEl.textContent = renamePreview;
  }
  if (folderPreviewEl) {
    folderPreviewEl.textContent = folderPreview;
  }
}

function isBatchSettingsFieldVisible(inputEl) {
  const field = inputEl?.closest('.batch-settings-field');
  if (!field) return true;
  return !field.classList.contains('is-hidden');
}

function openBatchSettingsModal(batchId) {
  const batch = state.fileReviewBatches?.find(b => b.batchId === batchId);
  if (!batch) {
    appendLog({ status: 'warning', message: '未找到批次信息' });
    return;
  }

  const modal = document.getElementById('batch-settings-modal');
  if (!modal) return;
  currentBatchSettingsBatchId = batchId;

  const namingMetadata = parseNamingMetadataSafe(batch.namingMetadata);
  const customTextLines = Object.keys(namingMetadata)
    .filter(key => key.startsWith('customText:'))
    .map(key => `${key}=${namingMetadata[key] ?? ''}`)
    .join('\n');

  const adminValue = batch.admin || namingMetadata.admin || '';

  const mainSelect = modal.querySelector('#batch-settings-main-category');
  const subSelect = modal.querySelector('#batch-settings-sub-category');
  const taskSelect = modal.querySelector('#batch-settings-task-type-select');
  const taskCustom = modal.querySelector('#batch-settings-task-type-custom');
  const adminInput = modal.querySelector('#batch-settings-admin');
  const submitterInput = modal.querySelector('#batch-settings-submitter');
  const renamePresetSelect = modal.querySelector('#batch-settings-rename-preset');
  const folderPresetSelect = modal.querySelector('#batch-settings-folder-preset');
  const renamePatternInput = modal.querySelector('#batch-settings-rename-pattern');
  const folderPatternInput = modal.querySelector('#batch-settings-folder-pattern');

  // 填充提交人（只读）
  if (submitterInput) {
    submitterInput.value = batch.submitter || '';
  }

  if (mainSelect) {
    mainSelect.innerHTML = `<option value="">请选择</option>${renderMainOptions(batch.mainCategory)}`;
    mainSelect.value = batch.mainCategory || '';
  }
  if (subSelect) {
    subSelect.innerHTML = `<option value="">请选择</option>${renderSubOptions(batch.mainCategory, batch.subCategory)}`;
    subSelect.disabled = !batch.mainCategory;
    subSelect.value = batch.subCategory || '';
  }

  const taskTypeValue = getBatchTaskType(batch) || '';
  if (taskSelect && taskCustom) {
    const knownTypes = getKnownTaskTypes();
    if (taskTypeValue && !knownTypes.includes(taskTypeValue)) {
      taskSelect.value = '__custom__';
      taskCustom.style.display = 'block';
      taskCustom.value = taskTypeValue;
    } else {
      taskSelect.value = taskTypeValue;
      taskCustom.style.display = 'none';
      taskCustom.value = '';
    }
  }

  if (adminInput) {
    adminInput.value = adminValue;
  }

  const renamePatternValue = batch.renamePattern || state.config.renamePattern || '';
  const folderPatternValue = batch.folderPattern || state.config.folderPattern || '';

  if (renamePresetSelect) {
    const matched = state.namingPresets?.find(preset => preset.pattern === renamePatternValue);
    renamePresetSelect.innerHTML = `<option value="">选择命名预设</option>${renderNamingPresetOptions(matched?.id || '')}`;
    renamePresetSelect.value = matched?.id || '';
  }
  if (folderPresetSelect) {
    const matched = state.folderNamingPresets?.find(preset => preset.pattern === folderPatternValue);
    folderPresetSelect.innerHTML = `<option value="">选择文件夹预设</option>${renderFolderPresetOptions(matched?.id || '')}`;
    folderPresetSelect.value = matched?.id || '';
  }

  if (renamePatternInput) {
    renamePatternInput.value = renamePatternValue;
  }
  if (folderPatternInput) {
    folderPatternInput.value = folderPatternValue;
  }
  const subjectInput = modal.querySelector('#batch-settings-subject');
  const eventInput = modal.querySelector('#batch-settings-event');
  const customDateInput = modal.querySelector('#batch-settings-custom-date');
  const countryInput = modal.querySelector('#batch-settings-country');
  const softwareInput = modal.querySelector('#batch-settings-software');
  const customTextInput = modal.querySelector('#batch-settings-custom-texts');

  if (subjectInput) subjectInput.value = namingMetadata.subject || '';
  if (eventInput) eventInput.value = namingMetadata.eventName || '';
  if (customDateInput) customDateInput.value = namingMetadata.customDate || '';
  if (countryInput) countryInput.value = namingMetadata.country || '';
  if (softwareInput) softwareInput.value = namingMetadata.software || '';
  if (customTextInput) customTextInput.value = customTextLines;

  updateBatchSettingsFieldVisibility(modal);

  modal.hidden = false;
}

function closeBatchSettingsModal() {
  const modal = document.getElementById('batch-settings-modal');
  if (modal) {
    modal.hidden = true;
  }
  currentBatchSettingsBatchId = null;
}

function initBatchSettingsModal() {
  const modal = document.getElementById('batch-settings-modal');
  if (!modal) return;

  const closeBtn = modal.querySelector('#batch-settings-close');
  const cancelBtn = modal.querySelector('#batch-settings-cancel');
  const confirmBtn = modal.querySelector('#batch-settings-confirm');
  const mainSelect = modal.querySelector('#batch-settings-main-category');
  const subSelect = modal.querySelector('#batch-settings-sub-category');
  const taskSelect = modal.querySelector('#batch-settings-task-type-select');
  const taskCustom = modal.querySelector('#batch-settings-task-type-custom');
  const renamePresetSelect = modal.querySelector('#batch-settings-rename-preset');
  const folderPresetSelect = modal.querySelector('#batch-settings-folder-preset');
  const renamePatternInput = modal.querySelector('#batch-settings-rename-pattern');
  const folderPatternInput = modal.querySelector('#batch-settings-folder-pattern');
  const subjectInput = modal.querySelector('#batch-settings-subject');
  const eventInput = modal.querySelector('#batch-settings-event');
  const customDateInput = modal.querySelector('#batch-settings-custom-date');
  const countryInput = modal.querySelector('#batch-settings-country');
  const softwareInput = modal.querySelector('#batch-settings-software');
  const customTextInput = modal.querySelector('#batch-settings-custom-texts');

  // 动态更新任务类型下拉选项（替换 HTML 中的静态选项）
  if (taskSelect) {
    taskSelect.innerHTML = renderTaskTypeOptions('');
  }

  const handleClose = () => {
    closeBatchSettingsModal();
  };

  if (closeBtn) closeBtn.addEventListener('click', handleClose);
  if (cancelBtn) cancelBtn.addEventListener('click', handleClose);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        handleClose();
      }
    });
  }

  if (mainSelect && subSelect) {
    mainSelect.addEventListener('change', () => {
      const mainValue = mainSelect.value;
      subSelect.innerHTML = `<option value="">请选择</option>${renderSubOptions(mainValue, '')}`;
      subSelect.disabled = !mainValue;
    });
  }

  if (taskSelect && taskCustom) {
    taskSelect.addEventListener('change', () => {
      if (taskSelect.value === '__custom__') {
        taskCustom.style.display = 'block';
        taskCustom.focus();
      } else {
        taskCustom.style.display = 'none';
        taskCustom.value = '';
      }
    });
  }

  if (renamePresetSelect && renamePatternInput) {
    renamePresetSelect.addEventListener('change', () => {
      const preset = getNamingPresetById(renamePresetSelect.value);
      // 选择预设则填充 pattern，取消选择则保留当前值
      if (preset?.pattern) {
        renamePatternInput.value = preset.pattern;
      }
      updateBatchSettingsFieldVisibility(modal);
    });
  }

  if (folderPresetSelect && folderPatternInput) {
    folderPresetSelect.addEventListener('change', () => {
      const preset = getFolderPresetById(folderPresetSelect.value);
      // 选择预设则填充 pattern，取消选择则保留当前值
      if (preset?.pattern) {
        folderPatternInput.value = preset.pattern;
      }
      updateBatchSettingsFieldVisibility(modal);
    });
  }

  renamePatternInput?.addEventListener('input', () => updateBatchSettingsFieldVisibility(modal));
  folderPatternInput?.addEventListener('input', () => updateBatchSettingsFieldVisibility(modal));

  // 为所有命名字段添加 input 监听器，实时更新预览
  const allNamingInputs = [
    subjectInput,
    eventInput,
    customDateInput,
    countryInput,
    softwareInput,
    customTextInput,
    modal.querySelector('#batch-settings-admin')
  ];
  allNamingInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', () => updateBatchSettingsPreview(modal));
    }
  });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!currentBatchSettingsBatchId) return;
      const batch = state.fileReviewBatches?.find(b => b.batchId === currentBatchSettingsBatchId);
      if (!batch) {
        appendLog({ status: 'warning', message: '批次数据已失效，请刷新' });
        return;
      }

      const taskTypeValue = taskSelect?.value === '__custom__'
        ? (taskCustom?.value || '').trim()
        : (taskSelect?.value || '').trim();
      const adminInput = modal.querySelector('#batch-settings-admin');
      const adminValue = isBatchSettingsFieldVisible(adminInput) ? adminInput.value.trim() : undefined;
      const fields = {
        mainCategory: mainSelect?.value.trim() || '',
        subCategory: subSelect?.value.trim() || '',
        taskType: taskTypeValue,
        admin: adminValue,
        renamePattern: renamePatternInput?.value.trim() || '',
        folderPattern: folderPatternInput?.value.trim() || '',
        subject: isBatchSettingsFieldVisible(subjectInput) ? subjectInput?.value.trim() : undefined,
        eventName: isBatchSettingsFieldVisible(eventInput) ? eventInput?.value.trim() : undefined,
        customDate: isBatchSettingsFieldVisible(customDateInput) ? customDateInput?.value.trim() : undefined,
        country: isBatchSettingsFieldVisible(countryInput) ? countryInput?.value.trim() : undefined,
        software: isBatchSettingsFieldVisible(softwareInput) ? softwareInput?.value.trim() : undefined,
        customTexts: isBatchSettingsFieldVisible(customTextInput) ? customTextInput?.value : undefined
      };

      const namingMetadata = buildNamingMetadataForBatch(batch, fields);
      const namingMetadataStr = JSON.stringify(namingMetadata || {});
      const resolvedAdmin = namingMetadata.admin || '';

      confirmBtn.disabled = true;
      const originalText = confirmBtn.textContent;
      confirmBtn.textContent = '保存中...';

      try {
        const resolvedTargetFolderId =
          resolveCategoryFolderId(fields.mainCategory, fields.subCategory) ||
          batch.targetFolderId ||
          '';
        const result = await window.bridge.updateBatchMetadata({
          batchId: currentBatchSettingsBatchId,
          mainCategory: fields.mainCategory,
          subCategory: fields.subCategory,
          taskType: fields.taskType,
          renamePattern: fields.renamePattern,
          folderPattern: fields.folderPattern,
          namingMetadata: namingMetadataStr,
          admin: resolvedAdmin,
          targetFolderId: resolvedTargetFolderId
        });

        if (result?.success) {
          if (window.bridge?.firebase && state.firebaseInitialized && state.firebaseSheetId) {
            const batch = state.fileReviewBatches?.find(b => (b.batchId || '').trim() === String(currentBatchSettingsBatchId || '').trim());
            const updates = (batch?.files || [])
              .map(file => Number(file.rowNumber))
              .filter(Number.isFinite)
              .map(rowNumber => ({
                rowNumber,
                taskType: fields.taskType || '',
                mainCategory: fields.mainCategory || '',
                subCategory: fields.subCategory || '',
                admin: resolvedAdmin,
                renamePattern: fields.renamePattern || '',
                folderPattern: fields.folderPattern || '',
                namingMetadata: namingMetadataStr,
                targetFolderId: resolvedTargetFolderId || ''
              }));
            if (updates.length > 0) {
              window.bridge.firebase.batchUpdateFileStatus(state.firebaseSheetId, updates)
                .catch((err) => console.warn('[批次设置] Firebase 同步失败:', err.message));
            }
          }
          appendLog({
            status: 'success',
            message: `批次 ${currentBatchSettingsBatchId} 设置已更新`
          });
          closeBatchSettingsModal();
          await loadFileReviewEntries({ silent: true });
        } else {
          appendLog({ status: 'error', message: result?.message || '保存失败' });
        }
      } catch (error) {
        appendLog({ status: 'error', message: `保存失败：${error.message}` });
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
      }
    });
  }

  // 初始化 Pattern 输入框切换按钮
  modal.querySelectorAll('.toggle-pattern-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.dataset.target;
      const input = modal.querySelector(`#${targetId}`);
      if (input) {
        const isHidden = input.classList.contains('is-hidden');
        if (isHidden) {
          input.classList.remove('is-hidden');
          input.focus();
          e.target.textContent = '隐藏规则';
        } else {
          input.classList.add('is-hidden');
          e.target.textContent = '自定义规则';
        }
      }
    });
  });
}

/**
 * 设置"我的审核"面板的事件处理器
 */
function setupMyFileReviewHandlers(container) {
  // 视图大小切换
  container.querySelectorAll('.view-size-toggle').forEach(toggle => {
    toggle.querySelectorAll('.view-size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const size = btn.dataset.size;
        const batchId = toggle.dataset.batchId;
        const batchCard = toggle.closest('.file-review-batch-card');
        if (!batchCard || !size) return;

        // 更新按钮active状态
        toggle.querySelectorAll('.view-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 更新卡片视图类
        batchCard.classList.remove('view-small', 'view-medium', 'view-large');
        batchCard.classList.add(`view-${size}`);

        // 保存偏好
        const viewPrefs = JSON.parse(localStorage.getItem('batchViewSizePrefs') || '{}');
        viewPrefs[batchId] = size;
        localStorage.setItem('batchViewSizePrefs', JSON.stringify(viewPrefs));
      });
    });
  });

  // 编辑批次设置
  container.querySelectorAll('.btn-edit-batch-settings').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const batchId = btn.dataset.batchId;
      if (batchId) {
        openBatchSettingsModal(batchId);
      }
    });
  });

  // 打开外部链接按钮（使用系统浏览器打开）
  container.querySelectorAll('.open-external-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = btn.dataset.url;
      if (url && window.bridge?.openExternal) {
        window.bridge.openExternal(url);
      }
    });
  });

  // "已更新修改"按钮点击
  container.querySelectorAll('.btn-update-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (btn.disabled) return;

      const batchId = btn.dataset.batchId;
      const newStatus = btn.dataset.status;

      const lockKey = `my-batch-status:${batchId}:${newStatus}`;
      if (!tryBeginInFlight(lockKey)) {
        return;
      }
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = '处理中...';

      try {
        // 调用后端更新批次状态
        await updateBatchStatus(batchId, newStatus);

        // 更新本地状态并刷新UI
        const batch = state.fileReviewBatches?.find(b => (b.batchId || '').trim() === String(batchId || '').trim());
        if (batch) {
          batch.batchStatus = newStatus;
        }

        // 刷新UI
        renderSubmitterSuggestions();

        // 同时通知总审核面板刷新，确保审核员能及时看到更新
        loadReviewEntries({ silent: true }).catch(err => console.warn('后台刷新总审核面板失败:', err));

        appendLog({
          status: 'success',
          message: `已通知审核员复审批次 ${batchId}`,
          broadcastGlobal: true
        });
      } catch (error) {
        appendLog({
          status: 'error',
          message: `更新批次状态失败：${error.message}`
        });
      } finally {
        endInFlight(lockKey);
        if (document.contains(btn)) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      }
    });
  });

  // "取消审核"按钮点击
  container.querySelectorAll('.btn-cancel-modify').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (btn.disabled) return;

      const batchId = btn.dataset.batchId;
      const newStatus = btn.dataset.status;

      const lockKey = `my-batch-status:${batchId}:${newStatus}`;
      if (!tryBeginInFlight(lockKey)) {
        return;
      }
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = '处理中...';

      try {
        await updateBatchStatus(batchId, newStatus);

        const batch = state.fileReviewBatches?.find(b => (b.batchId || '').trim() === String(batchId || '').trim());
        if (batch) {
          batch.batchStatus = newStatus;
        }

        renderSubmitterSuggestions();
        loadReviewEntries({ silent: true }).catch(err => console.warn('后台刷新总审核面板失败:', err));

        appendLog({
          status: 'info',
          message: `已取消修改，批次 ${batchId} 状态恢复为 ${newStatus}`,
          broadcastGlobal: true
        });
      } catch (error) {
        appendLog({
          status: 'error',
          message: `更新批次状态失败：${error.message}`
        });
      } finally {
        endInFlight(lockKey);
        if (document.contains(btn)) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      }
    });
  });

  // "取消审核"按钮点击
  container.querySelectorAll('.btn-cancel-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (btn.disabled) return;

      const batchId = btn.dataset.batchId;
      const newStatus = btn.dataset.status;

      const lockKey = `my-batch-status:${batchId}:${newStatus}`;
      if (!tryBeginInFlight(lockKey)) {
        return;
      }
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = '处理中...';

      try {
        // 调用后端更新批次状态
        await updateBatchStatus(batchId, newStatus);

        // 更新本地状态并刷新UI
        const batch = state.fileReviewBatches?.find(b => (b.batchId || '').trim() === String(batchId || '').trim());
        if (batch) {
          batch.batchStatus = newStatus;
        }

        // 刷新UI
        renderSubmitterSuggestions();

        // 同时通知总审核面板刷新
        loadReviewEntries({ silent: true }).catch(err => console.warn('后台刷新总审核面板失败:', err));

        appendLog({
          status: 'info',
          message: `已取消批次 ${batchId} 的审核`,
          broadcastGlobal: true
        });
      } catch (error) {
        appendLog({
          status: 'error',
          message: `更新批次状态失败：${error.message}`
        });
      } finally {
        endInFlight(lockKey);
        if (document.contains(btn)) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      }
    });
  });

  // 预览触发器（缩略图悬浮预览）- 支持新旧类名
  container.querySelectorAll('.file-review-thumb.file-preview-trigger, .file-card-thumb.file-preview-trigger, .reference-file-item.file-preview-trigger').forEach(thumb => {
    let hoverTimer = null;

    // 悬停显示预览
    thumb.addEventListener('mouseenter', () => {
      hoverTimer = setTimeout(() => {
        const fileId = thumb.dataset.fileId;
        const previewId = thumb.dataset.previewId || fileId;
        const fileName = thumb.dataset.fileName;
        const fileLink = thumb.dataset.fileLink;
        const rowNumber = thumb.dataset.row ? parseInt(thumb.dataset.row, 10) : null;
        if (fileId) {
          showHoverPreview(fileId, fileName, fileLink, rowNumber, thumb, false, previewId);
        }
      }, 100);
    });

    thumb.addEventListener('mouseleave', () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      setTimeout(() => {
        hideHoverPreview();
      }, 100);
    });

    // 单击选择文件，双击打开全屏预览
    thumb.addEventListener('click', (e) => {
      const fileId = thumb.dataset.fileId;
      const previewId = thumb.dataset.previewId || fileId;
      if (!fileId) return;
      const card = thumb.closest('.file-card');
      if (!card) {
        e.preventDefault();
        e.stopPropagation();
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        hideHoverPreview(true);
        const fileName = thumb.dataset.fileName;
        const fileLink = thumb.dataset.fileLink;
        const rowNumber = thumb.dataset.row ? parseInt(thumb.dataset.row, 10) : null;
        showHoverPreview(fileId, fileName, fileLink, rowNumber, null, true, previewId);
        return;
      }
      if (e.detail > 1) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const batchId = card.closest('.file-review-batch-card')?.dataset.batchId;
      if (!batchId) return;

      if (!state.myReviewSelections.has(batchId)) {
        state.myReviewSelections.set(batchId, new Set());
      }
      const selections = state.myReviewSelections.get(batchId);
      const fileIdStr = card.dataset.fileId;
      if (!fileIdStr) return;

      if (selections.has(fileIdStr)) {
        selections.delete(fileIdStr);
        card.classList.remove('selected');
      } else {
        selections.add(fileIdStr);
        card.classList.add('selected');
      }
      updateMyReviewSelectionUI(batchId, container);
    });

    thumb.addEventListener('dblclick', (e) => {
      const fileId = thumb.dataset.fileId;
      const previewId = thumb.dataset.previewId || fileId;
      const fileName = thumb.dataset.fileName;
      const fileLink = thumb.dataset.fileLink;
      const rowNumber = thumb.dataset.row ? parseInt(thumb.dataset.row, 10) : null;
      if (fileId) {
        e.preventDefault();
        e.stopPropagation();
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        hideHoverPreview(true);
        showHoverPreview(fileId, fileName, fileLink, rowNumber, null, true, previewId); // 全屏模式
      }
    });
  });

  // 新版文件卡片按钮点击
  container.querySelectorAll('.file-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;

      const action = btn.dataset.action;
      const rowNumber = parseInt(btn.dataset.row, 10);

      if (action === 'replace') {
        const fileId = btn.dataset.fileId;
        const fileName = btn.dataset.fileName;
        const tempFolderLink = btn.dataset.tempFolderLink || '';
        const batchId = btn.dataset.batchId || '';
        openFileReplaceModal({
          fileId,
          fileName,
          rowNumber,
          tempFolderLink,
          batchId
        });
      } else if (action === 'open') {
        const url = btn.dataset.url;
        if (url && window.bridge?.openExternal) {
          window.bridge.openExternal(url);
        }
      }
    });
  });

  // 旧版替换按钮（兼容）
  container.querySelectorAll('.file-review-btn.replace').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rowNumber = parseInt(btn.dataset.row, 10);
      const fileId = btn.dataset.fileId;
      const fileName = btn.dataset.fileName;
      const tempFolderLink = btn.dataset.tempFolderLink || '';
      const batchId = btn.dataset.batchId || '';

      openFileReplaceModal({
        fileId,
        fileName,
        rowNumber,
        tempFolderLink,
        batchId
      });
    });
  });

  // 添加文件按钮
  container.querySelectorAll('.add-file-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const batchId = btn.dataset.batchId;
      const tempFolderLink = btn.dataset.tempFolderLink || '';
      const submitter = btn.dataset.submitter || '';
      const mainCategory = btn.dataset.mainCategory || '';
      const subCategory = btn.dataset.subCategory || '';
      const taskType = btn.dataset.taskType || '';
      const referenceFolderId = btn.dataset.referenceFolderId || '';
      const referenceFolderLink = btn.dataset.referenceFolderLink || '';
      const reviewSlotName = btn.dataset.reviewSlotName || '';
      const reviewDescription = btn.dataset.reviewDescription || '';
      const reviewNote = btn.dataset.reviewNote || '';
      const isReference = btn.dataset.isReference === 'true';
      const fileCount = parseInt(btn.dataset.fileCount || '0', 10);
      const renameCounter = Number.isFinite(fileCount) ? fileCount + 1 : 1;
      const admin = btn.dataset.admin || '';
      const renamePattern = btn.dataset.renamePattern || '';
      const folderPattern = btn.dataset.folderPattern || '';
      const namingMetadata = btn.dataset.namingMetadata || '';
      const targetFolderId = btn.dataset.targetFolderId || '';

      openAddFileToBatchModal({
        batchId,
        tempFolderLink,
        submitter,
        mainCategory,
        subCategory,
        taskType,
        referenceFolderId,
        referenceFolderLink,
        reviewSlotName,
        reviewDescription,
        reviewNote,
        isReference,
        renameCounter,
        admin,
        renamePattern,
        folderPattern,
        namingMetadata,
        targetFolderId
      });
    });
  });

  // 同步按钮 - 检测云端新增的文件
  container.querySelectorAll('.sync-batch-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const batchId = btn.dataset.batchId;
      const tempFolderLink = btn.dataset.tempFolderLink || '';
      const submitter = btn.dataset.submitter || '';
      const mainCategory = btn.dataset.mainCategory || '';
      const subCategory = btn.dataset.subCategory || '';
      const taskType = btn.dataset.taskType || '';
      const referenceFolderId = btn.dataset.referenceFolderId || '';
      const referenceFolderLink = btn.dataset.referenceFolderLink || '';
      const reviewSlotName = btn.dataset.reviewSlotName || '';
      const reviewDescription = btn.dataset.reviewDescription || '';
      const reviewNote = btn.dataset.reviewNote || '';
      const admin = btn.dataset.admin || '';
      const renamePattern = btn.dataset.renamePattern || '';
      const folderPattern = btn.dataset.folderPattern || '';
      const namingMetadata = btn.dataset.namingMetadata || '';
      const targetFolderId = btn.dataset.targetFolderId || '';

      // 禁用按钮防止重复点击
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = '⏳';

      try {
        appendLog({
          status: 'info',
          message: `正在检测批次 ${batchId} 云端目录中的新文件...`
        });

        const result = await window.bridge.syncBatchFiles({
          batchId,
          tempFolderLink,
          submitter,
          mainCategory,
          subCategory,
          taskType,
          admin,
          referenceFolderId,
          referenceFolderLink,
          reviewSlotName,
          reviewDescription,
          reviewNote,
          renamePattern,
          folderPattern,
          namingMetadata,
          targetFolderId
        });

        if (result.success) {
          if (result.added > 0) {
            // 有新文件，在卡片上显示提示
            const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
            if (batchCard) {
              // 移除旧的提示（如果有）
              batchCard.querySelectorAll('.sync-result-banner').forEach(el => el.remove());

              // 添加新的提示横幅
              const banner = document.createElement('div');
              banner.className = 'sync-result-banner';
              banner.innerHTML = `✨ 发现 <strong>${result.added}</strong> 个新文件，已添加到列表`;
              batchCard.querySelector('.file-review-batch-header')?.after(banner);

              // 5秒后自动消失
              setTimeout(() => {
                banner.classList.add('fade-out');
                setTimeout(() => banner.remove(), 300);
              }, 5000);
            }

            appendLog({
              status: 'success',
              message: `同步成功：发现并添加了 ${result.added} 个新文件`,
              broadcastGlobal: true
            });

            // 刷新数据
            await loadFileReviewEntries();
          } else {
            // 没有新文件，简单提示
            appendLog({
              status: 'info',
              message: `同步完成：云端目录中没有发现新文件`
            });

            // 短暂的视觉反馈
            btn.textContent = '✓';
            setTimeout(() => {
              if (document.contains(btn)) {
                btn.textContent = originalText;
              }
            }, 1500);
            return; // 提前返回，不重置按钮文本
          }
        } else {
          appendLog({
            status: 'error',
            message: result.message || '同步失败'
          });
        }
      } catch (error) {
        appendLog({
          status: 'error',
          message: `同步失败：${error.message}`
        });
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  });

  // 自动加载所有参考区域的内容
  container.querySelectorAll('.file-review-reference-section').forEach(section => {
    loadReferenceFilesForSection(section);
  });

  // === 选择和批量替换功能 ===

  // 初始化选择状态
  if (!state.myReviewSelections) {
    state.myReviewSelections = new Map(); // batchId -> Set of fileIds
  }

  // 文件卡片点击选择
  container.querySelectorAll('.file-card[data-file-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      // 如果点击的是按钮，不处理选择
      if (e.target.closest('.file-card-btn')) return;

      const fileId = card.dataset.fileId;
      const batchId = card.closest('.file-review-batch-card')?.dataset.batchId;
      if (!fileId || !batchId) return;

      // 初始化该批次的选择集合
      if (!state.myReviewSelections.has(batchId)) {
        state.myReviewSelections.set(batchId, new Set());
      }
      const selections = state.myReviewSelections.get(batchId);

      // 切换选中状态
      if (selections.has(fileId)) {
        selections.delete(fileId);
        card.classList.remove('selected');
      } else {
        selections.add(fileId);
        card.classList.add('selected');
      }

      // 更新UI
      updateMyReviewSelectionUI(batchId, container);
    });
  });

  // "全选"按钮
  container.querySelectorAll('.file-review-selection-toolbar .btn-select-all').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const batchId = btn.dataset.batchId;
      const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
      if (!batchCard) return;

      if (!state.myReviewSelections.has(batchId)) {
        state.myReviewSelections.set(batchId, new Set());
      }
      const selections = state.myReviewSelections.get(batchId);

      // 选中所有文件
      batchCard.querySelectorAll('.file-card[data-file-id]').forEach(card => {
        const fileId = card.dataset.fileId;
        if (fileId) {
          selections.add(fileId);
          card.classList.add('selected');
        }
      });

      // 更新UI
      updateMyReviewSelectionUI(batchId, container);
    });
  });

  // "反选"按钮
  container.querySelectorAll('.file-review-selection-toolbar .btn-select-invert').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const batchId = btn.dataset.batchId;
      const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
      if (!batchCard) return;

      if (!state.myReviewSelections.has(batchId)) {
        state.myReviewSelections.set(batchId, new Set());
      }
      const selections = state.myReviewSelections.get(batchId);

      // 反选所有文件
      batchCard.querySelectorAll('.file-card[data-file-id]').forEach(card => {
        const fileId = card.dataset.fileId;
        if (!fileId) return;

        if (selections.has(fileId)) {
          selections.delete(fileId);
          card.classList.remove('selected');
        } else {
          selections.add(fileId);
          card.classList.add('selected');
        }
      });

      // 更新UI
      updateMyReviewSelectionUI(batchId, container);
    });
  });

  // "选中不合格"按钮
  container.querySelectorAll('.btn-select-all-rejected').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const batchId = btn.dataset.batchId;
      const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
      if (!batchCard) return;

      if (!state.myReviewSelections.has(batchId)) {
        state.myReviewSelections.set(batchId, new Set());
      }
      const selections = state.myReviewSelections.get(batchId);
      selections.clear();

      // 选中所有不合格文件
      batchCard.querySelectorAll('.file-card.status-rejected[data-file-id]').forEach(card => {
        const fileId = card.dataset.fileId;
        if (fileId) {
          selections.add(fileId);
          card.classList.add('selected');
        }
      });

      // 更新UI
      updateMyReviewSelectionUI(batchId, container);
    });
  });

  // "取消"按钮
  container.querySelectorAll('.file-review-selection-toolbar .btn-select-none').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const batchId = btn.dataset.batchId;
      const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
      if (!batchCard) return;

      if (state.myReviewSelections.has(batchId)) {
        state.myReviewSelections.get(batchId).clear();
      }

      // 清除所有选中样式
      batchCard.querySelectorAll('.file-card.selected').forEach(card => {
        card.classList.remove('selected');
      });

      // 更新UI
      updateMyReviewSelectionUI(batchId, container);
    });
  });

  // "批量替换"按钮
  container.querySelectorAll('.file-review-selection-toolbar .btn-batch-replace').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (btn.disabled) return;

      const batchId = btn.dataset.batchId;
      const selections = state.myReviewSelections?.get(batchId);
      if (!selections || selections.size === 0) {
        appendLog({ status: 'warning', message: '请先选择要替换的文件' });
        return;
      }

      // 获取批次信息
      const batch = state.fileReviewBatches?.find(b => b.batchId === batchId);
      if (!batch) {
        appendLog({ status: 'error', message: '未找到批次信息' });
        return;
      }

      // 获取选中的文件
      const selectedFiles = batch.files.filter(f => selections.has(f.fileId));
      if (selectedFiles.length === 0) {
        appendLog({ status: 'warning', message: '未找到选中的文件信息' });
        return;
      }

      // 初始化批量替换状态
      state.batchReplaceFiles = selectedFiles.map(file => ({
        fileId: file.fileId,
        fileName: file.fileName,
        rowNumber: file.rowNumber,
        tempFolderLink: batch.tempFolderLink || '',
        batchId: batch.batchId,
        newFile: null
      }));

      // 打开批量替换弹窗
      renderBatchReplaceModal();
    });
  });
}

/**
 * 更新"我的审核"面板的选择UI
 */
function updateMyReviewSelectionUI(batchId, container) {
  const selections = state.myReviewSelections?.get(batchId);
  const count = selections?.size || 0;

  // 更新计数显示
  const countEl = container.querySelector(`.file-review-selection-toolbar[data-batch-id="${batchId}"] .selection-count`);
  if (countEl) {
    countEl.textContent = `已选 ${count} 个`;
  }

  // 更新批量替换按钮状态
  const replaceBtn = container.querySelector(`.file-review-selection-toolbar[data-batch-id="${batchId}"] .btn-batch-replace`);
  if (replaceBtn) {
    replaceBtn.disabled = count === 0;
  }
}

/**
 * 恢复"我的审核"面板的选择状态（用于刷新后）
 */
function restoreMyReviewSelections(container) {
  if (!state.myReviewSelections || state.myReviewSelections.size === 0) return;

  state.myReviewSelections.forEach((selections, batchId) => {
    if (selections.size === 0) return;

    const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
    if (!batchCard) return;

    // 恢复每个选中的文件卡片样式
    selections.forEach(fileId => {
      const card = batchCard.querySelector(`.file-card[data-file-id="${fileId}"]`);
      if (card) {
        card.classList.add('selected');
      }
    });

    // 更新UI
    updateMyReviewSelectionUI(batchId, container);
  });
}

/**
 * 自动检测「我的审核」中各批次是否有未同步的新文件
 * 使用缓存避免重复检测，提示一直显示直到用户点击同步
 */
async function checkBatchesForNewFiles(container) {
  // 初始化检测缓存
  if (!state.batchNewFilesCache) {
    state.batchNewFilesCache = new Map(); // batchId -> { count, checked: boolean }
  }

  // 找到所有同步按钮
  const syncBtns = container.querySelectorAll('.sync-batch-btn');

  for (const btn of syncBtns) {
    const batchId = btn.dataset.batchId;
    const tempFolderLink = btn.dataset.tempFolderLink;

    if (!batchId || !tempFolderLink) continue;

    // 如果已经有缓存的提示，直接显示
    const cached = state.batchNewFilesCache.get(batchId);
    if (cached && cached.count > 0) {
      showSyncHintBanner(container, batchId, cached.count, btn);
      continue;
    }

    // 如果已经检测过且没有新文件，跳过
    if (cached && cached.checked && cached.count === 0) {
      continue;
    }

    try {
      const result = await window.bridge.checkBatchNewFiles({
        batchId,
        tempFolderLink
      });

      // 更新缓存
      state.batchNewFilesCache.set(batchId, {
        count: result.success ? result.count : 0,
        checked: true
      });

      if (result.success && result.count > 0) {
        showSyncHintBanner(container, batchId, result.count, btn);
      }
    } catch (error) {
      // 静默失败，不影响用户体验
      console.warn(`检测批次 ${batchId} 新文件失败:`, error);
    }
  }
}

/**
 * 显示同步提示横幅
 */
function showSyncHintBanner(container, batchId, count, syncBtn) {
  const batchCard = container.querySelector(`.file-review-batch-card[data-batch-id="${batchId}"]`);
  if (!batchCard) return;

  // 如果已经有提示，不重复添加
  if (batchCard.querySelector('.sync-hint-banner')) return;

  // 添加新的提示横幅
  const banner = document.createElement('div');
  banner.className = 'sync-hint-banner';
  banner.innerHTML = `
    <span>🔔 发现 <strong>${count}</strong> 个未同步的文件</span>
    <button class="sync-now-btn" data-batch-id="${batchId}">点击同步</button>
  `;
  batchCard.querySelector('.file-review-batch-header')?.after(banner);

  // 绑定点击事件
  banner.querySelector('.sync-now-btn')?.addEventListener('click', () => {
    // 移除横幅
    banner.remove();
    // 清除缓存
    state.batchNewFilesCache?.delete(batchId);
    // 触发同步按钮点击
    syncBtn.click();
  });
}

function renderSubmitterSuggestions() {
  const container = elements.myReviewList;
  if (!container) return;
  const submitter = getSubmitterName();
  if (!submitter) {
    container.innerHTML = '<div class="slot-empty">请先填写提交人以查看审核记录</div>';
    if (elements.myReviewSummary) {
      elements.myReviewSummary.innerHTML = '';
    }
    if (elements.myReviewInfo) {
      elements.myReviewInfo.textContent = '填写提交人后即可查看个人审核进度';
    }
    return;
  }

  // 使用按文件审核模式渲染
  renderMyFileReviewBatches(submitter);
  return;
  const normalizedSubmitter = submitter.trim();
  const entries = state.reviewEntries.filter((entry) => {
    if ((entry.submitter || '').trim() !== normalizedSubmitter) return false;
    return Boolean(entry.status);
  });
  if (!entries.length) {
    container.innerHTML = '<div class="slot-empty">暂无提交的审核记录</div>';
    renderMyReviewSummary([]);
    renderMyReviewInfo([], [], 0);
    renderMyReviewPagination();
    return;
  }
  const filtered = applyMyReviewFilters(entries);
  let visible = filtered;
  if (state.myReviewFilters.range === 'all') {
    const totalPages = Math.max(1, Math.ceil(filtered.length / MY_REVIEW_PAGE_SIZE));
    state.myReviewPage = Math.min(Math.max(1, state.myReviewPage || 1), totalPages);
    const start = (state.myReviewPage - 1) * MY_REVIEW_PAGE_SIZE;
    visible = filtered.slice(start, start + MY_REVIEW_PAGE_SIZE);
    renderMyReviewPagination(totalPages);
  } else {
    state.myReviewPage = 1;
    renderMyReviewPagination();
    visible = filtered.slice(0, state.myReviewFilters.limit);
  }
  const allCounts = getMyReviewSummaryCounts(entries);
  renderMyReviewSummary(filtered, allCounts);
  renderMyReviewInfo(entries, filtered, visible.length);
  if (!visible.length) {
    container.innerHTML = '<div class="slot-empty">该时间范围内暂无审核记录</div>';
    return;
  }
  const listHtml = visible
    .map((entry) => {
      const statusRaw = (entry.status || '').trim();
      const status = normalizeReviewStatus(statusRaw);
      const needsAttention =
        status === REVIEW_STATUS.NEEDS_CHANGE || status === REVIEW_STATUS.PARTIAL_CHANGE;
      return buildReviewCard(entry, {
        fileContext: 'submit',
        noteMode: 'text',
        noteValue: entry.note || '暂无审核建议',
        extraClass: needsAttention ? 'suggested' : '',
        allowRefresh: true,
        actionsHtml: buildSubmitterActions(entry, status)
      });
    })
    .join('');
  const extraTip =
    filtered.length > visible.length
      ? `<div class="review-manage-tip">还有 ${filtered.length - visible.length} 条记录，调整筛选条件可查看更多。</div>`
      : '';
  container.innerHTML = listHtml + extraTip;

  // 为我的审核面板的文件预览添加鼠标悬停事件处理
  setupReviewFilePreviewHandlers(container);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFileDetails(entry, type) {
  if (!entry) return [];
  const detailKey = type === 'accepted' ? 'acceptedDetails' : 'rejectedDetails';
  const fallbackKey = type === 'accepted' ? 'acceptedFiles' : 'rejectedFiles';
  const details = Array.isArray(entry[detailKey]) ? entry[detailKey] : [];
  if (details.length) {
    return details.map((item) => normalizeFileDetail(item)).filter(Boolean);
  }
  const names = Array.isArray(entry[fallbackKey]) ? entry[fallbackKey] : [];
  return names.map((name) => ({ name, link: '' }));
}

function normalizeFileDetail(detail) {
  if (!detail) {
    return null;
  }
  if (typeof detail === 'string') {
    return { name: detail, link: '' };
  }
  const name = detail.name || detail.path || detail.id || '';

  // 优先使用已有的link字段（向后兼容）
  let link =
    detail.link ||
    detail.finalLink ||
    detail.targetLink ||
    detail.webViewLink ||
    detail.webContentLink ||
    detail.previewLink ||
    '';

  const path = detail.path || detail.localPath || '';

  // 处理缩略图：过滤掉旧的lh3格式，优先使用文件ID生成
  let thumbnail = '';
  const fileId = detail.id || detail.fileId || detail.driveFileId || '';

  // 如果有文件ID，根据文件类型生成缩略图
  if (fileId && typeof fileId === 'string' && fileId.match(/^[a-zA-Z0-9_-]{25,50}$/)) {
    const fileName = name || '';
    const lowerName = fileName.toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif'].some(ext => lowerName.endsWith(ext));
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv'].some(ext => lowerName.endsWith(ext));

    if (isImage || isVideo) {
      thumbnail = `https://drive.google.com/thumbnail?id=${fileId}&sz=w100`;
    }
  } else if (detail.thumbnail && (() => { try { return !new URL(detail.thumbnail).hostname.endsWith('.googleusercontent.com'); } catch (e) { return true; } })()) {
    // 只使用非lh3格式的旧缩略图（fallback）
    thumbnail = detail.thumbnail || detail.thumbnailLink || '';
  }

  // 如果没有link，但有id且看起来像Drive文件ID，则构建链接
  if (!link && fileId) {
    const idStr = String(fileId);
    // Drive文件ID的特征：25-50个字符，字母数字下划线短横线
    if (idStr.match(/^[a-zA-Z0-9_-]{25,50}$/) && !idStr.includes('/')) {
      link = `https://drive.google.com/file/d/${idStr}/view`;
    }
  }

  if (!name && !link) {
    return null;
  }
  return {
    name: name || link || path,
    link,
    path,
    thumbnail,
    id: fileId
  };
}

function renderFileListSummary(entry, options = {}) {
  const acceptedDetails = getFileDetails(entry, 'accepted');
  const rejectedDetails = getFileDetails(entry, 'rejected');
  const total = acceptedDetails.length + rejectedDetails.length;
  const context = options.context || 'review';
  const summaryId = `${context}-${entry.rowNumber}`;
  const defaultCollapsed = options.initialCollapsed !== false;
  const collapsed = getFileSummaryCollapsed(summaryId, defaultCollapsed);
  const toggleLabel = buildSummaryToggleLabel(total, collapsed);
  const allowRefresh = Boolean(options.allowRefresh);
  const refreshLabel = options.refreshLabel || '刷新云端文件';
  const refreshButton = allowRefresh
    ? `<button type="button" class="ghost refresh-file-summary" data-action="refresh-file-summary" data-row="${entry.rowNumber}">${refreshLabel}</button>`
    : '';
  const showSourceHint = options.showSourceHint !== false;
  const sourceHint = showSourceHint
    ? `<div class="file-summary-tip">合格文件 = 云端目录里名为“成品”的子文件夹；其余（包含参考/其它子目录）都会显示在“不合格文件”中。</div>`
    : '';
  let toggleButton = '';
  let summaryContent = `<div class="review-file-summary empty-state" data-summary-id="${summaryId}" data-count="${total}">
      <span class="muted">尚未检测到合格/不合格文件</span>
    </div>`;
  if (total) {
    const acceptedFromSheet = Boolean(entry.acceptedFromSheet);
    const sections = [
      renderFileListSection('合格文件', acceptedDetails, 'success', {
        statusLabel: acceptedFromSheet ? '已入库' : ''
      }),
      renderFileListSection('不合格文件', rejectedDetails, 'danger')
    ].join('');
    toggleButton = `<button type="button" class="ghost toggle-file-summary" data-action="toggle-file-summary" data-target="${summaryId}" data-count="${total}">
        ${toggleLabel}
      </button>`;
    summaryContent = `<div class="review-file-summary ${collapsed ? 'collapsed' : ''}" data-summary-id="${summaryId}" data-count="${total}">
        ${sections}
      </div>`;
  }
  const toolbarParts = [];
  if (toggleButton) {
    toolbarParts.push(toggleButton);
  } else {
    toolbarParts.push('<span class="muted file-summary-empty-hint">暂无文件清单</span>');
  }
  if (refreshButton) {
    toolbarParts.push(refreshButton);
  }
  return `
    <div class="review-file-summary-wrapper" data-summary-id="${summaryId}">
      <div class="review-file-summary-toolbar">
        ${toolbarParts.join('')}
      </div>
      ${summaryContent}
      ${sourceHint}
    </div>
  `;
}

function buildSummaryToggleLabel(total, collapsed) {
  const verb = collapsed ? '展开' : '收起';
  return `${verb}文件清单（${total}）`;
}

// 生成稳定的审核记录标识，避免依赖易变的行号或链接
function getStableReviewId(entry = {}) {
  return (
    entry.id ||
    entry.reviewId ||
    entry.reviewTaskId ||
    entry.taskId ||
    entry.reviewTaskName ||
    entry.folderId ||
    entry.driveFileId ||
    entry.tempLink ||
    ''
  );
}

function buildReviewKey(entry = {}, { includeSubmitter = false } = {}) {
  const stableId = getStableReviewId(entry);
  const row = Number(entry.rowNumber);
  const base =
    stableId ||
    (row ? `row-${row}` : '') ||
    entry.folderLink ||
    entry.folderId ||
    entry.driveFileId ||
    entry.tempLink ||
    '';
  if (!base) return '';
  return includeSubmitter ? `${base}|${entry.submitter || ''}` : base;
}

function toggleFileSummary(button) {
  const target = button?.dataset?.target;
  if (!target) return;
  const summary = document.querySelector(`.review-file-summary[data-summary-id="${target}"]`);
  if (!summary) return;
  summary.classList.toggle('collapsed');
  const collapsed = summary.classList.contains('collapsed');
  setFileSummaryCollapsed(target, collapsed);
  const count = Number(button.dataset.count || summary.dataset.count || 0);
  button.textContent = buildSummaryToggleLabel(count, collapsed);
}

function getEntryKey(entry) {
  return buildReviewKey(entry, { includeSubmitter: true });
}

function getReviewerKey(entry) {
  return buildReviewKey(entry);
}

function showFloatingNotification(type, entry) {
  if (!window.bridge?.showFloatingNotification || !entry) {
    return;
  }
  if (!state.config.enableFloatingNotifications) {
    return;
  }
  const statusNormalized = entry.normalizedStatus || normalizeReviewStatus(entry.status);
  const title = entry.displayTitle || getReviewEntryTitle(entry);
  const payload = {
    type,
    entry: {
      stableKey: getReviewerKey(entry) || '',
      rowNumber: Number(entry.rowNumber),
      folderId: entry.folderId || '',
      tempLink: entry.tempLink || '',
      folderLink: entry.folderLink || '',
      submitter: entry.submitter || '',
      admin: entry.admin || '',
      reviewer: entry.reviewer || '',
      mainCategory: entry.mainCategory || '',
      subCategory: entry.subCategory || '',
      status: entry.status || '',
      normalizedStatus: statusNormalized || '',
      note: entry.note || '',
      description: entry.description || '',
      reviewSlotName: entry.reviewSlotName || '',
      displayTitle: title,
      title,
      noteDraft: getReviewNoteValue(entry),
      acceptedFiles: Array.isArray(entry.acceptedFiles) ? entry.acceptedFiles : [],
      rejectedFiles: Array.isArray(entry.rejectedFiles) ? entry.rejectedFiles : [],
      acceptedDetails: Array.isArray(entry.acceptedDetails) ? entry.acceptedDetails : [],
      rejectedDetails: Array.isArray(entry.rejectedDetails) ? entry.rejectedDetails : []
    }
  };
  window.bridge.showFloatingNotification(payload);
}

function getReviewNoteValue(entry) {
  const row = Number(entry.rowNumber);
  if (state.reviewNoteDrafts?.has(row)) {
    return state.reviewNoteDrafts.get(row);
  }
  return entry.note || '';
}

function setReviewNoteDraft(rowNumber, value) {
  if (!state.reviewNoteDrafts) {
    state.reviewNoteDrafts = new Map();
  }
  state.reviewNoteDrafts.set(Number(rowNumber), value);
}

function clearReviewNoteDraft(rowNumber) {
  state.reviewNoteDrafts?.delete?.(Number(rowNumber));
}

function pruneObsoleteDrafts(validRows = []) {
  if (!state.reviewNoteDrafts?.size) {
    return;
  }
  const validSet = new Set(validRows.map((row) => Number(row)));
  Array.from(state.reviewNoteDrafts.keys()).forEach((row) => {
    if (!validSet.has(Number(row))) {
      state.reviewNoteDrafts.delete(Number(row));
    }
  });
}

function getFileSummaryCollapsed(summaryId, defaultValue = true) {
  if (!summaryId) {
    return defaultValue;
  }
  if (!state.fileSummaryStates) {
    state.fileSummaryStates = new Map();
  }
  if (!state.fileSummaryStates.has(summaryId)) {
    state.fileSummaryStates.set(summaryId, defaultValue);
    return defaultValue;
  }
  return state.fileSummaryStates.get(summaryId);
}

function setFileSummaryCollapsed(summaryId, collapsed) {
  if (!summaryId) {
    return;
  }
  if (!state.fileSummaryStates) {
    state.fileSummaryStates = new Map();
  }
  state.fileSummaryStates.set(summaryId, Boolean(collapsed));
}

function buildEntrySignature(entry) {
  return normalizeReviewStatus(entry.status) || '';
}

function acknowledgeSubmitterEntry(rowNumber) {
  const entry = getReviewEntry(rowNumber);
  if (!entry) {
    appendLog({ status: 'error', message: '未找到该审核记录' });
    return;
  }
  if (!state.reviewAcknowledged.submitter) {
    state.reviewAcknowledged.submitter = new Map();
  }
  const key = getEntryKey(entry);
  const signature = buildEntrySignature(entry);
  state.reviewAcknowledged.submitter.set(key, signature);
  persistAcknowledgementRecords();
  appendLog({ status: 'success', message: '该条建议已标记为“知道了”' });
  renderSubmitterSuggestions();
  markActionConfirmed(rowNumber, 'acknowledge-submit');
}

function acknowledgeReviewerEntry(rowNumber) {
  const entry = getReviewEntry(rowNumber);
  if (!entry) {
    appendLog({ status: 'error', message: '未找到该审核记录' });
    return;
  }
  if (!state.reviewAcknowledged.reviewer) {
    state.reviewAcknowledged.reviewer = new Map();
  }
  const key = getReviewerKey(entry);
  if (!key) {
    appendLog({ status: 'error', message: '该条记录缺少 ID，无法标记' });
    return;
  }
  const signature = buildEntrySignature(entry);
  state.reviewAcknowledged.reviewer.set(key, signature);
  persistAcknowledgementRecords();
  appendLog({ status: 'success', message: '该审核任务已标记为“知道了”' });
  markActionConfirmed(rowNumber, 'acknowledge-review');
}

function renderFileListSection(label, details, className, options = {}) {
  const items = Array.isArray(details) ? details.filter(Boolean) : [];
  if (!items.length) {
    return `<div class="review-file-section"><span>${label}</span><p class="muted">暂无</p></div>`;
  }
  const statusLabel = options.statusLabel ? `<span class="file-status-tag">${escapeHtml(options.statusLabel)}</span>` : '';
  const itemsHtml = items
    .map((detail) => {
      const text = escapeHtml(detail.name || '');
      const fileName = detail.name || '';
      const lowerName = fileName.toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif'].some(ext => lowerName.endsWith(ext));
      const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv'].some(ext => lowerName.endsWith(ext));
      const ext = fileName.split('.').pop().toUpperCase().slice(0, 4);

      const buildFileUrl = (rawPath = '') => {
        if (!rawPath) return '';
        if (rawPath.startsWith('file://')) return rawPath;
        let normalized = rawPath.replace(/\\/g, '/');
        if (!normalized.startsWith('/')) {
          normalized = `/${normalized}`;
        }
        return `file://${encodeURI(normalized)}`;
      };

      const localPath = detail.path || '';
      const localUrl = buildFileUrl(localPath);

      // 从Drive链接提取文件ID并构建缩略图URL
      let thumbnailUrl = '';
      let previewUrl = '';
      let fileId = '';

      // 优先使用 detail.id（从表格中保存的）
      if (detail.id) {
        fileId = String(detail.id);
      } else if (detail.link) {
        // 从链接中提取文件ID
        const fileIdMatch = detail.link.match(/[-\w]{25,}/);
        if (fileIdMatch) {
          fileId = fileIdMatch[0];
        }
      }

      // 根据文件ID生成缩略图和预览URL（优先级最高）
      if (fileId) {
        if (isImage) {
          thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w100`;
          previewUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
        } else if (isVideo) {
          thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w100`;
          previewUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }

      // 如果没有fileId，尝试使用其他字段（fallback）
      if (!thumbnailUrl && detail.previewLink) {
        previewUrl = detail.previewLink;
      }
      if (!thumbnailUrl && detail.thumbnail && (() => { try { return !new URL(detail.thumbnail).hostname.endsWith('.googleusercontent.com'); } catch (e) { return true; } })()) {
        // 只使用非lh3格式的缩略图（避免使用已失效的旧链接）
        thumbnailUrl = detail.thumbnail;
      }
      if (!thumbnailUrl && localUrl && (isImage || isVideo)) {
        thumbnailUrl = localUrl;
      }
      if (!previewUrl && localUrl) {
        previewUrl = localUrl;
      }

      let thumbnailContent;
      const videoPosterAttr = thumbnailUrl ? ` poster="${escapeHtml(thumbnailUrl)}"` : '';

      if (isImage && thumbnailUrl) {
        thumbnailContent = `<img src="${thumbnailUrl}" alt="${text}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'review-file-badge\\'>${ext}</div>'" />`;
      } else if (isVideo) {
        // 判断视频是云端还是本地
        const isCloudVideo = previewUrl && (() => { try { const h = new URL(previewUrl).hostname; return h.endsWith('.google.com') || h.endsWith('.googleapis.com'); } catch (e) { return false; } })();

        if (isCloudVideo) {
          // 云端视频：只显示缩略图，不尝试播放
          if (thumbnailUrl) {
            thumbnailContent = `<img src="${thumbnailUrl}" alt="${text}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'review-file-badge\\'>${ext}</div>'" />`;
          } else {
            thumbnailContent = `<div class="review-file-badge">${ext}</div>`;
          }
        } else if (previewUrl && !isCloudVideo) {
          // 本地视频：可以尝试播放
          thumbnailContent = `<video src="${previewUrl}" muted loop autoplay playsinline controls preload="metadata"${videoPosterAttr}></video>`;
        } else if (thumbnailUrl) {
          // 有缩略图但没有预览链接
          thumbnailContent = `<img src="${thumbnailUrl}" alt="${text}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'review-file-badge\\'>${ext}</div>'" />`;
        } else {
          thumbnailContent = `<div class="review-file-badge">${ext}</div>`;
        }
      } else {
        thumbnailContent = `<div class="review-file-badge">${ext}</div>`;
      }

      // 不需要内联预览HTML,使用全局预览窗口

      // 始终用button包裹以支持预览,即使没有link
      const driveViewLink = fileId ? `https://drive.google.com/file/d/${fileId}/view` : '';
      const openUrl = detail.link || driveViewLink || detail.previewLink || previewUrl || '';
      const btnAttributes = openUrl ? `data-open-url="${escapeHtml(openUrl)}"` : '';

      return `<div class="review-file-grid-item">
        <div class="review-file-thumbnail-btn" ${btnAttributes} role="button" tabindex="0">
          <div class="review-file-thumbnail">${thumbnailContent}</div>
        </div>
        <div class="review-file-name" title="${text}">${text || (detail.link ? '查看' : '未命名文件')}</div>
      </div>`;
    })
    .join('');
  return `<div class="review-file-section">
    <span>${label}（${items.length}）${statusLabel}</span>
    <div class="review-file-grid ${className || ''}">${itemsHtml}</div>
  </div>`;
}

/**
 * 渲染交互式审核文件网格
 * 允许用户选择文件并标记为合格/不合格
 */
function renderInteractiveFileGrid(entry, options = {}) {
  const rowNumber = entry.rowNumber;
  const reviewFolderId = entry.reviewFolderId || entry.folderId || '';
  const finishedFolderId = entry.finishedFolderId || '';

  // 获取所有文件（合格+不合格）
  const acceptedDetails = getFileDetails(entry, 'accepted') || [];
  const rejectedDetails = getFileDetails(entry, 'rejected') || [];

  // 为每个文件添加状态标记
  const allFiles = [
    ...acceptedDetails.map(f => ({ ...f, isAccepted: true })),
    ...rejectedDetails.map(f => ({ ...f, isAccepted: false }))
  ];

  // 只保留有 ID 的文件（云端实际存在的文件）
  const validFiles = allFiles.filter(f => f.id);

  // 如果没有 autoList 标记（未刷新过云端），显示刷新提示
  const needsRefresh = !entry.autoList && validFiles.length === 0;

  if (needsRefresh || validFiles.length === 0) {
    return `
      <div class="review-files-section" data-row="${rowNumber}" data-review-folder-id="${reviewFolderId}" data-finished-folder-id="${finishedFolderId}">
        <div class="review-files-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
          <span>${needsRefresh ? '请点击「刷新文件」获取云端文件' : '暂无文件'}</span>
          <button type="button" class="review-action-btn secondary" data-action="refresh-file-summary" data-row="${rowNumber}" style="margin-top: 8px;">
            🔄 刷新文件
          </button>
        </div>
      </div>
    `;
  }

  // 生成文件网格HTML
  const filesHtml = allFiles.map((file, index) => {
    const fileId = file.id || '';
    const fileName = file.name || '未命名文件';
    const lowerName = fileName.toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif'].some(ext => lowerName.endsWith(ext));
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].some(ext => lowerName.endsWith(ext));
    const ext = fileName.split('.').pop().toUpperCase().slice(0, 4);

    // 构建缩略图
    let thumbnailUrl = '';
    let largePreviewUrl = '';
    if (fileId && (isImage || isVideo)) {
      thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w100`;
      largePreviewUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    }

    // 构建预览链接（用于双击打开）
    const openUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : '';

    const thumbContent = thumbnailUrl
      ? `<img src="${thumbnailUrl}" alt="${escapeHtml(fileName)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'review-file-badge\\'>${ext}</div>'" />`
      : `<div class="review-file-badge">${ext}</div>`;

    const statusClass = file.isAccepted ? 'approved' : 'rejected';
    const statusText = file.isAccepted ? '合格' : '不合格';
    const isRejected = !file.isAccepted;

    // 每个文件的独立操作按钮
    const fileActions = `
      <div class="review-file-actions">
        <button type="button" class="file-action-btn approve ${file.isAccepted ? 'active' : ''}" 
                data-action="single-approve" data-file-id="${fileId}" data-row="${rowNumber}" 
                title="标记为合格">✓</button>
        <button type="button" class="file-action-btn reject ${!file.isAccepted ? 'active' : ''}" 
                data-action="single-reject" data-file-id="${fileId}" data-row="${rowNumber}" 
                title="标记为不合格">✕</button>
        <button type="button" class="file-action-btn replace" 
                data-action="replace-file" data-file-id="${fileId}" data-row="${rowNumber}"
                data-file-name="${escapeHtml(fileName)}"
                title="替换文件">🔄</button>
      </div>
    `;

    return `
      <div class="review-file-selectable ${statusClass}" 
           data-file-id="${fileId}" 
           data-file-name="${escapeHtml(fileName)}"
           data-is-accepted="${file.isAccepted ? 'true' : 'false'}"
           data-row="${rowNumber}"
           data-open-url="${escapeHtml(openUrl)}"
           data-preview-url="${escapeHtml(largePreviewUrl)}"
           title="单击选择，双击预览大图">
        <div class="review-file-checkbox"></div>
        <div class="review-file-thumb-container">
          ${thumbnailUrl
        ? `<img src="${thumbnailUrl}" alt="${escapeHtml(fileName)}" loading="lazy" 
                   class="review-file-thumb-img" 
                   onerror="this.outerHTML='<div class=\\'review-file-badge\\'>${ext}</div>'" />`
        : `<div class="review-file-badge">${ext}</div>`}
        </div>
        ${fileActions}
        <div class="review-file-status-tag ${statusClass}">${statusText}</div>
        <div class="review-file-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</div>
      </div>
    `;
  }).join('');

  // 工具栏
  const actionsBar = `
    <div class="review-file-actions-bar" data-row="${rowNumber}">
      <button type="button" class="review-action-btn secondary" data-action="refresh-file-summary" data-row="${rowNumber}">
        🔄 刷新文件
      </button>
      <button type="button" class="review-action-btn secondary" data-action="select-all-files" data-row="${rowNumber}">
        全选
      </button>
      <button type="button" class="review-action-btn secondary" data-action="deselect-all-files" data-row="${rowNumber}">
        取消选择
      </button>
      <button type="button" class="review-action-btn primary" data-action="mark-files-approved" data-row="${rowNumber}" disabled>
        ✓ 批量标记合格
      </button>
      <button type="button" class="review-action-btn danger" data-action="mark-files-rejected" data-row="${rowNumber}" disabled>
        ✕ 批量标记不合格
      </button>
      <button type="button" class="review-action-btn secondary" data-action="batch-replace-files" data-row="${rowNumber}" disabled>
        🔄 批量替换
      </button>
      <span class="review-selection-hint" data-row="${rowNumber}">
        已选择 <strong>0</strong> 个文件
      </span>
    </div>
  `;

  // 统计信息
  const acceptedCount = acceptedDetails.length;
  const rejectedCount = rejectedDetails.length;
  const statsHtml = `
    <div class="review-files-section-header">
      <span class="review-files-section-title success">
        ✓ 合格文件 <span class="count-badge">${acceptedCount}</span>
      </span>
      <span class="review-files-section-title danger" style="margin-left: 16px;">
        ○ 待审核 <span class="count-badge">${rejectedCount}</span>
      </span>
    </div>
  `;

  // 操作提示
  const helpHint = `
    <div class="review-files-help-hint">
      💡 <strong>操作提示:</strong> 
      单击选择文件 | 
      双击预览大图 | 
      点击文件上的 ✓/✕ 按钮快速切换状态
    </div>
  `;

  return `
    <div class="review-files-section" data-row="${rowNumber}" data-review-folder-id="${reviewFolderId}" data-finished-folder-id="${finishedFolderId}">
      ${statsHtml}
      ${helpHint}
      ${actionsBar}
      <div class="review-file-interactive-grid" data-row="${rowNumber}">
        ${filesHtml}
      </div>
    </div>
  `;
}

/**
 * 初始化交互式文件网格的事件处理
 */
function setupInteractiveFileGridHandlers(container) {
  if (!container) return;

  // 存储每个审核记录的选中文件
  if (!state.reviewFileSelections) {
    state.reviewFileSelections = new Map();
  }

  // 单击事件 - 选择文件或处理按钮
  container.addEventListener('click', async (e) => {
    // 检查是否点击了单个文件的操作按钮
    const fileActionBtn = e.target.closest('.file-action-btn');
    if (fileActionBtn) {
      e.stopPropagation();
      const action = fileActionBtn.dataset.action;
      const fileId = fileActionBtn.dataset.fileId;
      const rowNumber = Number(fileActionBtn.dataset.row);

      if (action === 'single-approve') {
        await handleSingleFileApprove(rowNumber, fileId);
      } else if (action === 'single-reject') {
        await handleSingleFileReject(rowNumber, fileId);
      } else if (action === 'replace-file') {
        // 替换文件 - 调用替换弹窗
        const fileName = fileActionBtn.dataset.fileName || '';
        const entry = getReviewEntry(rowNumber);
        if (entry) {
          openFileReplaceModal({
            fileId,
            fileName,
            rowNumber,
            tempFolderLink: entry.tempLink || '',
            batchId: entry.batchId || '',
          });
        }
      }
      return;
    }

    // 检查是否点击了工具栏按钮
    const actionsBar = e.target.closest('.review-file-actions-bar');
    if (actionsBar && e.target.dataset.action) {
      const action = e.target.dataset.action;
      const rowNumber = Number(e.target.dataset.row);

      if (action === 'select-all-files') {
        selectAllFilesInRow(rowNumber);
      } else if (action === 'deselect-all-files') {
        deselectAllFilesInRow(rowNumber);
      } else if (action === 'mark-files-approved') {
        await markSelectedFilesAsApproved(rowNumber);
      } else if (action === 'mark-files-rejected') {
        await markSelectedFilesAsRejected(rowNumber);
      } else if (action === 'batch-replace-files') {
        await openBatchReplaceModal(rowNumber);
      }
      return;
    }

    // 点击文件项 - 选择/取消选择
    const fileItem = e.target.closest('.review-file-selectable');
    if (fileItem && !fileItem.classList.contains('loading')) {
      const rowNumber = Number(fileItem.dataset.row);
      const fileId = fileItem.dataset.fileId;

      if (!state.reviewFileSelections.has(rowNumber)) {
        state.reviewFileSelections.set(rowNumber, new Set());
      }
      const selections = state.reviewFileSelections.get(rowNumber);

      // 切换选中状态
      if (selections.has(fileId)) {
        selections.delete(fileId);
        fileItem.classList.remove('selected');
      } else {
        selections.add(fileId);
        fileItem.classList.add('selected');
      }

      updateFileSelectionUI(rowNumber);
    }
  });

  // 双击事件 - 预览大图
  container.addEventListener('dblclick', (e) => {
    const fileItem = e.target.closest('.review-file-selectable');
    if (fileItem) {
      e.preventDefault();
      const previewUrl = fileItem.dataset.previewUrl;
      const openUrl = fileItem.dataset.openUrl;
      const fileName = fileItem.dataset.fileName || '预览';

      if (previewUrl) {
        // 显示模态预览
        showImagePreviewModal(previewUrl, fileName, openUrl);
      } else if (openUrl) {
        // 没有预览图时直接打开链接
        window.bridge?.openExternal?.(openUrl);
      }
    }
  });

  // 键盘快捷键支持
  container.addEventListener('keydown', (e) => {
    // Escape: 取消所有选择
    if (e.key === 'Escape') {
      clearAllFileSelections();
      e.preventDefault();
    }
  });
}

/**
 * 显示图片预览模态框（支持放大缩小拖拽）
 */
function showImagePreviewModal(imageUrl, fileName, openUrl) {
  // 移除已存在的模态框
  document.querySelector('.image-preview-modal')?.remove();

  const modal = document.createElement('div');
  modal.className = 'image-preview-modal';
  modal.innerHTML = `
    <div class="preview-modal-backdrop"></div>
    <div class="preview-modal-content">
      <div class="preview-modal-header">
        <span class="preview-modal-title">${escapeHtml(fileName)}</span>
        <div class="preview-modal-controls">
          <button type="button" class="preview-control-btn" data-action="zoom-out" title="缩小">−</button>
          <span class="preview-zoom-level">100%</span>
          <button type="button" class="preview-control-btn" data-action="zoom-in" title="放大">+</button>
          <button type="button" class="preview-control-btn" data-action="reset" title="重置">⟲</button>
          ${openUrl ? `<button type="button" class="preview-control-btn" data-action="open-link" title="在浏览器中打开">🔗</button>` : ''}
          <button type="button" class="preview-control-btn close" data-action="close" title="关闭">✕</button>
        </div>
      </div>
      <div class="preview-modal-body">
        <img src="${imageUrl}" alt="${escapeHtml(fileName)}" class="preview-modal-image" draggable="false" />
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 获取元素引用
  const image = modal.querySelector('.preview-modal-image');
  const zoomDisplay = modal.querySelector('.preview-zoom-level');
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  const updateTransform = () => {
    image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    zoomDisplay.textContent = `${Math.round(scale * 100)}%`;
  };

  // 控制按钮事件
  modal.addEventListener('click', (e) => {
    const action = e.target.dataset?.action;
    if (action === 'close' || e.target.classList.contains('preview-modal-backdrop')) {
      modal.remove();
    } else if (action === 'zoom-in') {
      scale = Math.min(scale * 1.25, 5);
      updateTransform();
    } else if (action === 'zoom-out') {
      scale = Math.max(scale / 1.25, 0.25);
      updateTransform();
    } else if (action === 'reset') {
      scale = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    } else if (action === 'open-link' && openUrl) {
      window.bridge?.openExternal?.(openUrl);
    }
  });

  // 鼠标滚轮缩放
  modal.querySelector('.preview-modal-body').addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      scale = Math.min(scale * 1.1, 5);
    } else {
      scale = Math.max(scale / 1.1, 0.25);
    }
    updateTransform();
  });

  // 拖拽移动
  image.addEventListener('mousedown', (e) => {
    if (scale > 1) {
      isDragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      image.style.cursor = 'grabbing';
    }
  });

  document.addEventListener('mousemove', function moveHandler(e) {
    if (isDragging) {
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateTransform();
    }
  });

  document.addEventListener('mouseup', function upHandler() {
    isDragging = false;
    image.style.cursor = scale > 1 ? 'grab' : 'default';
  });

  // ESC 关闭
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * 单个文件标记为合格
 */
async function handleSingleFileApprove(rowNumber, fileId) {
  const section = document.querySelector(`.review-files-section[data-row="${rowNumber}"]`);
  const reviewFolderId = section?.dataset.reviewFolderId;
  const finishedFolderId = section?.dataset.finishedFolderId || '';

  if (!reviewFolderId || !fileId) {
    appendLog({ status: 'error', message: '无法获取文件信息' });
    return;
  }

  const fileItem = document.querySelector(`.review-file-selectable[data-file-id="${fileId}"][data-row="${rowNumber}"]`);
  if (!fileItem) return;

  // 如果已经是合格状态，不需要操作
  if (fileItem.dataset.isAccepted === 'true') {
    appendLog({ status: 'info', message: '该文件已经是合格状态' });
    return;
  }

  fileItem.classList.add('loading');

  try {
    const result = await window.bridge.moveFilesToFinished({
      reviewFolderId,
      fileIds: [fileId],
      finishedFolderId
    });

    if (result.success && result.movedFiles.length > 0) {
      // 更新 UI
      fileItem.classList.remove('loading', 'pending');
      fileItem.classList.add('approved');
      fileItem.dataset.isAccepted = 'true';

      // 更新状态标签
      const statusTag = fileItem.querySelector('.review-file-status-tag');
      if (statusTag) {
        statusTag.textContent = '合格';
        statusTag.className = 'review-file-status-tag approved';
      }

      // 更新操作按钮状态
      const approveBtn = fileItem.querySelector('.file-action-btn.approve');
      const rejectBtn = fileItem.querySelector('.file-action-btn.reject');
      if (approveBtn) approveBtn.classList.add('active');
      if (rejectBtn) rejectBtn.classList.remove('active');

      // 更新 finishedFolderId
      if (result.finishedFolderId && section) {
        section.dataset.finishedFolderId = result.finishedFolderId;
      }

      showMoveConfirmToast('✓', '文件已标记为合格');

      // 更新统计
      updateFileSectionStats(rowNumber);
    } else {
      throw new Error(result.errors?.[0]?.message || '操作失败');
    }
  } catch (error) {
    appendLog({ status: 'error', message: `标记合格失败：${error.message}` });
    fileItem.classList.remove('loading');
  }
}

/**
 * 单个文件标记为不合格
 */
async function handleSingleFileReject(rowNumber, fileId) {
  const section = document.querySelector(`.review-files-section[data-row="${rowNumber}"]`);
  const reviewFolderId = section?.dataset.reviewFolderId;
  const finishedFolderId = section?.dataset.finishedFolderId || '';

  if (!reviewFolderId || !fileId) {
    appendLog({ status: 'error', message: '无法获取文件信息' });
    return;
  }

  const fileItem = document.querySelector(`.review-file-selectable[data-file-id="${fileId}"][data-row="${rowNumber}"]`);
  if (!fileItem) return;

  // 如果已经是不合格状态，不需要操作
  if (fileItem.dataset.isAccepted === 'false') {
    appendLog({ status: 'info', message: '该文件已经是待审核状态' });
    return;
  }

  fileItem.classList.add('loading');

  try {
    const result = await window.bridge.moveFilesFromFinished({
      reviewFolderId,
      fileIds: [fileId],
      finishedFolderId
    });

    if (result.success && result.movedFiles.length > 0) {
      // 更新 UI
      fileItem.classList.remove('loading', 'approved');
      fileItem.classList.add('pending');
      fileItem.dataset.isAccepted = 'false';

      // 更新状态标签
      const statusTag = fileItem.querySelector('.review-file-status-tag');
      if (statusTag) {
        statusTag.textContent = '待审';
        statusTag.className = 'review-file-status-tag pending';
      }

      // 更新操作按钮状态
      const approveBtn = fileItem.querySelector('.file-action-btn.approve');
      const rejectBtn = fileItem.querySelector('.file-action-btn.reject');
      if (approveBtn) approveBtn.classList.remove('active');
      if (rejectBtn) rejectBtn.classList.add('active');

      showMoveConfirmToast('✕', '文件已标记为待审核');

      // 更新统计
      updateFileSectionStats(rowNumber);
    } else if (result.movedFiles?.some(f => f.alreadyOutOfFinished)) {
      appendLog({ status: 'info', message: '该文件不在成品文件夹中' });
      fileItem.classList.remove('loading');
    } else {
      throw new Error(result.errors?.[0]?.message || '操作失败');
    }
  } catch (error) {
    appendLog({ status: 'error', message: `标记不合格失败：${error.message}` });
    fileItem.classList.remove('loading');
  }
}

/**
 * 更新文件区域的统计信息
 */
function updateFileSectionStats(rowNumber) {
  const section = document.querySelector(`.review-files-section[data-row="${rowNumber}"]`);
  if (!section) return;

  const allItems = section.querySelectorAll('.review-file-selectable');
  let approvedCount = 0;
  let pendingCount = 0;

  allItems.forEach(item => {
    if (item.dataset.isAccepted === 'true') {
      approvedCount++;
    } else {
      pendingCount++;
    }
  });

  // 更新统计显示
  const header = section.querySelector('.review-files-section-header');
  if (header) {
    const successBadge = header.querySelector('.success .count-badge');
    const dangerBadge = header.querySelector('.danger .count-badge');
    if (successBadge) successBadge.textContent = approvedCount;
    if (dangerBadge) dangerBadge.textContent = pendingCount;
  }
}

/**
 * 更新选择计数UI
 */
function updateFileSelectionUI(rowNumber) {
  const selections = state.reviewFileSelections?.get(rowNumber) || new Set();
  const count = selections.size;

  // 更新计数提示
  const hint = document.querySelector(`.review-selection-hint[data-row="${rowNumber}"] strong`);
  if (hint) {
    hint.textContent = count;
  }

  // 更新按钮状态
  const approveBtn = document.querySelector(`[data-action="mark-files-approved"][data-row="${rowNumber}"]`);
  const rejectBtn = document.querySelector(`[data-action="mark-files-rejected"][data-row="${rowNumber}"]`);
  const replaceBtn = document.querySelector(`[data-action="batch-replace-files"][data-row="${rowNumber}"]`);

  if (approveBtn) approveBtn.disabled = count === 0;
  if (rejectBtn) rejectBtn.disabled = count === 0;
  if (replaceBtn) replaceBtn.disabled = count === 0;
}

/**
 * 全选文件
 */
function selectAllFilesInRow(rowNumber) {
  const items = document.querySelectorAll(`.review-file-selectable[data-row="${rowNumber}"]`);
  if (!state.reviewFileSelections.has(rowNumber)) {
    state.reviewFileSelections.set(rowNumber, new Set());
  }
  const selections = state.reviewFileSelections.get(rowNumber);

  items.forEach(item => {
    const fileId = item.dataset.fileId;
    if (fileId) {
      selections.add(fileId);
      item.classList.add('selected');
    }
  });

  updateFileSelectionUI(rowNumber);
}

/**
 * 清除所有审核记录中的文件选择
 */
function clearAllFileSelections() {
  if (!state.reviewFileSelections) return;

  // 获取所有有选择的行号
  const rowNumbers = Array.from(state.reviewFileSelections.keys());

  // 清除每一行的选择
  rowNumbers.forEach(rowNumber => {
    deselectAllFilesInRow(rowNumber);
  });

  // 清除状态存储
  state.reviewFileSelections.clear();

  appendLog({ status: 'info', message: '已取消所有文件选择' });
}

/**
 * 取消全选
 */
function deselectAllFilesInRow(rowNumber) {
  const items = document.querySelectorAll(`.review-file-selectable[data-row="${rowNumber}"]`);
  const selections = state.reviewFileSelections?.get(rowNumber);

  if (selections) {
    selections.clear();
  }

  items.forEach(item => {
    item.classList.remove('selected');
  });

  updateFileSelectionUI(rowNumber);
}

/**
 * 将选中的文件标记为合格（移动到成品文件夹）
 */
async function markSelectedFilesAsApproved(rowNumber) {
  const selections = state.reviewFileSelections?.get(rowNumber);
  if (!selections || selections.size === 0) {
    appendLog({ status: 'error', message: '请先选择要标记的文件' });
    return;
  }

  const section = document.querySelector(`.review-files-section[data-row="${rowNumber}"]`);
  const reviewFolderId = section?.dataset.reviewFolderId;
  const finishedFolderId = section?.dataset.finishedFolderId || '';

  if (!reviewFolderId) {
    appendLog({ status: 'error', message: '无法获取审核目录信息' });
    return;
  }

  const fileIds = Array.from(selections);

  // 标记选中的文件为loading状态
  fileIds.forEach(fileId => {
    const item = document.querySelector(`.review-file-selectable[data-file-id="${fileId}"][data-row="${rowNumber}"]`);
    if (item) item.classList.add('loading');
  });

  appendLog({ status: 'info', message: `正在将 ${fileIds.length} 个文件移动到成品文件夹...` });

  try {
    const result = await window.bridge.moveFilesToFinished({
      reviewFolderId,
      fileIds,
      finishedFolderId
    });

    if (result.success) {
      appendLog({ status: 'success', message: `已将 ${result.movedFiles.length} 个文件标记为合格` });

      // 显示成功提示
      showMoveConfirmToast('✓', `${result.movedFiles.length} 个文件已移动到成品文件夹`);

      // 清除选择
      selections.clear();

      // 更新entry的finishedFolderId（如果是新创建的）
      if (result.finishedFolderId && section) {
        section.dataset.finishedFolderId = result.finishedFolderId;
      }

      // 刷新文件列表以更新显示
      await refreshReviewEntryFiles(rowNumber);
    } else {
      appendLog({ status: 'error', message: `部分文件移动失败：${result.errors.map(e => e.message).join(', ')}` });

      // 移除loading状态
      fileIds.forEach(fileId => {
        const item = document.querySelector(`.review-file-selectable[data-file-id="${fileId}"][data-row="${rowNumber}"]`);
        if (item) item.classList.remove('loading');
      });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `移动文件失败：${error.message}` });

    // 移除loading状态
    fileIds.forEach(fileId => {
      const item = document.querySelector(`.review-file-selectable[data-file-id="${fileId}"][data-row="${rowNumber}"]`);
      if (item) item.classList.remove('loading');
    });
  }
}

/**
 * 将选中的文件标记为不合格（从成品文件夹移出）
 */
async function markSelectedFilesAsRejected(rowNumber) {
  const selections = state.reviewFileSelections?.get(rowNumber);
  if (!selections || selections.size === 0) {
    appendLog({ status: 'error', message: '请先选择要标记的文件' });
    return;
  }

  const section = document.querySelector(`.review-files-section[data-row="${rowNumber}"]`);
  const reviewFolderId = section?.dataset.reviewFolderId;
  const finishedFolderId = section?.dataset.finishedFolderId || '';

  if (!reviewFolderId) {
    appendLog({ status: 'error', message: '无法获取审核目录信息' });
    return;
  }

  const fileIds = Array.from(selections);

  // 标记选中的文件为loading状态
  fileIds.forEach(fileId => {
    const item = document.querySelector(`.review-file-selectable[data-file-id="${fileId}"][data-row="${rowNumber}"]`);
    if (item) item.classList.add('loading');
  });

  appendLog({ status: 'info', message: `正在将 ${fileIds.length} 个文件移出成品文件夹...` });

  try {
    const result = await window.bridge.moveFilesFromFinished({
      reviewFolderId,
      fileIds,
      finishedFolderId
    });

    if (result.success) {
      appendLog({ status: 'success', message: `已将 ${result.movedFiles.length} 个文件标记为不合格` });

      // 显示成功提示
      showMoveConfirmToast('✕', `${result.movedFiles.length} 个文件已移出成品文件夹`);

      // 清除选择
      selections.clear();

      // 刷新文件列表以更新显示
      await refreshReviewEntryFiles(rowNumber);
    } else {
      appendLog({ status: 'error', message: `部分文件移动失败：${result.errors.map(e => e.message).join(', ')}` });

      // 移除loading状态
      fileIds.forEach(fileId => {
        const item = document.querySelector(`.review-file-selectable[data-file-id="${fileId}"][data-row="${rowNumber}"]`);
        if (item) item.classList.remove('loading');
      });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `移动文件失败：${error.message}` });

    // 移除loading状态
    fileIds.forEach(fileId => {
      const item = document.querySelector(`.review-file-selectable[data-file-id="${fileId}"][data-row="${rowNumber}"]`);
      if (item) item.classList.remove('loading');
    });
  }
}

/**
 * 显示操作确认提示
 */
function showMoveConfirmToast(icon, message) {
  // 移除现有的toast
  document.querySelectorAll('.review-move-confirm-toast').forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = 'review-move-confirm-toast';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function markActionConfirmed(rowNumber, action) {
  document
    .querySelectorAll(`[data-action="${action}"][data-row="${rowNumber}"]`)
    .forEach((btn) => btn.classList.add('confirmed'));
}

async function loadReviewEntries(arg = {}) {
  let options = { logSuccess: false, silent: false };
  if (typeof arg === 'boolean') {
    options.logSuccess = arg;
  } else if (typeof arg === 'object' && arg) {
    options = { ...options, ...arg };
  }
  const { logSuccess, silent } = options;

  // 使用按文件审核模式加载
  await loadFileReviewEntries(options);
  return;

  if (!state.config.sheetId) {
    if (!silent) {
      appendLog({ status: 'error', message: '请先在配置中填写 Sheet ID' });
    }
    return;
  }
  if (!window.bridge?.fetchReviewEntries) {
    return;
  }
  if (!silent) {
    state.reviewLoading = true;
    renderReviewEntries();
  }
  try {
    const entries = await window.bridge.fetchReviewEntries({ preferDerived: true });
    enhanceReviewEntries(entries);
    state.reviewEntries = entries;
    pruneObsoleteDrafts(entries.map((entry) => entry.rowNumber));
    if (logSuccess) {
      appendLog({
        status: 'success',
        message: `已加载 ${entries.length} 条审核记录`,
        broadcastGlobal: true
      });
    }
    handleReviewNotifications(entries);
  } catch (error) {
    appendLog({ status: 'error', message: `加载审核记录失败：${error.message}` });
  } finally {
    if (!silent) {
      state.reviewLoading = false;
    }

    // 智能刷新：检查是否有用户正在选择文件
    const hasActiveSelections = hasAnyFileSelections();

    if (silent && hasActiveSelections) {
      // 静默刷新且有选中文件时，不重新渲染，避免丢失选择状态
      // 不显示提示，只是静默跳过
      console.log('⏸️ 检测到有选中文件，暂停自动渲染');
    } else {
      // 正常渲染
      renderReviewEntries();
    }
  }
}

/**
 * 检查是否有任何文件选择状态
 */
function hasAnyFileSelections() {
  if (!state.reviewFileSelections || state.reviewFileSelections.size === 0) {
    return false;
  }
  // 检查是否有非空的选择
  for (const [rowNumber, selections] of state.reviewFileSelections) {
    if (selections && selections.size > 0) {
      return true;
    }
  }
  return false;
}

/**
 * 获取当前选择状态的快照
 */
function getFileSelectionsSnapshot() {
  const snapshot = new Map();
  if (state.reviewFileSelections) {
    for (const [rowNumber, selections] of state.reviewFileSelections) {
      if (selections && selections.size > 0) {
        snapshot.set(rowNumber, new Set(selections));
      }
    }
  }
  return snapshot;
}

/**
 * 从快照恢复选择状态
 */
function restoreFileSelectionsFromSnapshot(snapshot) {
  if (!snapshot || snapshot.size === 0) return;

  // 先确保 state 中有选择状态存储
  if (!state.reviewFileSelections) {
    state.reviewFileSelections = new Map();
  }

  // 恢复选择状态
  for (const [rowNumber, fileIds] of snapshot) {
    state.reviewFileSelections.set(rowNumber, new Set(fileIds));

    // 更新 DOM 中的选中状态
    fileIds.forEach(fileId => {
      const item = document.querySelector(`.review-file-selectable[data-file-id="${fileId}"][data-row="${rowNumber}"]`);
      if (item) {
        item.classList.add('selected');
      }
    });

    // 更新选择计数 UI
    updateFileSelectionUI(rowNumber);
  }
}

/**
 * 显示"有新数据"提示
 */
function showPendingRefreshHint() {
  // 检查是否已经有提示
  if (document.querySelector('.review-pending-refresh-hint')) return;

  const container = elements.reviewList;
  if (!container) return;

  // 在审核面板顶部添加提示横幅
  const existingHint = container.querySelector('.review-pending-refresh-hint');
  if (existingHint) return;

  const hint = document.createElement('div');
  hint.className = 'review-pending-refresh-hint';
  hint.innerHTML = `
    <span>📥 检测到新数据，完成操作后点击刷新</span>
    <button type="button" class="pending-refresh-btn" onclick="window.__forceRefreshReview?.()">立即刷新</button>
    <button type="button" class="pending-dismiss-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  container.insertBefore(hint, container.firstChild);

  // 设置全局刷新函数
  window.__forceRefreshReview = () => {
    hint.remove();
    // 清除所有选择状态
    if (state.reviewFileSelections) {
      state.reviewFileSelections.clear();
    }
    renderReviewEntries();
  };
}

function handleReviewNotifications(nextEntries = []) {
  const newMap = new Map();
  nextEntries.forEach((entry) => {
    const key = getReviewerKey(entry);
    if (!key) return;
    newMap.set(key, entry);
  });
  const prevMap = state.reviewEntryCache || new Map();
  if (!state.reviewNotificationsPrimed) {
    state.reviewEntryCache = newMap;
    state.lastKnownStatuses = new Map();
    newMap.forEach((entry, key) => {
      const status = normalizeReviewStatus(entry.status);
      if (status) {
        state.lastKnownStatuses.set(key, status);
      }
    });
    state.reviewNotificationsPrimed = true;
    return;
  }
  let newPending = 0;
  let newSuggestion = 0;
  let newApproved = 0;
  const pendingEntries = [];
  const suggestionEntries = [];
  const approvedEntries = [];
  const submitter = getSubmitterName();
  if (!state.reviewAcknowledged.submitter) {
    state.reviewAcknowledged.submitter = new Map();
  }
  if (!state.reviewAcknowledged.reviewer) {
    state.reviewAcknowledged.reviewer = new Map();
  }
  const submitterAckMap = state.reviewAcknowledged.submitter;
  const reviewerAckMap = state.reviewAcknowledged.reviewer;
  let ackChanged = false;
  nextEntries.forEach((entry) => {
    const baseKey = getReviewerKey(entry);
    if (!baseKey) return;
    const prevEntry = prevMap.get(baseKey);
    const prevStatus = normalizeReviewStatus(prevEntry?.status);
    const status = normalizeReviewStatus(entry.status);
    const submitterAckKey = getEntryKey(entry);
    if (!status) {
      state.lastKnownStatuses.delete(baseKey);
      if (submitterAckMap.delete(submitterAckKey)) {
        ackChanged = true;
      }
      if (reviewerAckMap.delete(baseKey)) {
        ackChanged = true;
      }
      return;
    }
    const lastKnownStatus = state.lastKnownStatuses.get(baseKey);
    const statusChanged =
      typeof lastKnownStatus === 'undefined' ? true : lastKnownStatus !== status;
    state.lastKnownStatuses.set(baseKey, status);
    const signature = buildEntrySignature(entry);
    const submitterAckSignature = submitterAckMap.get(submitterAckKey);
    const reviewerAckSignature = reviewerAckMap.get(baseKey);

    if (statusChanged && isReviewerRole() && REVIEW_PENDING_STATUSES.has(status)) {
      if (reviewerAckSignature !== signature) {
        newPending += 1;
        pendingEntries.push(entry);
      }
    }
    const shouldSubmitterRemind =
      statusChanged &&
      isSubmitterRole() &&
      submitter &&
      entry.submitter === submitter &&
      REVIEW_SUGGESTION_STATUSES.has(status);
    if (shouldSubmitterRemind) {
      if (submitterAckSignature !== signature) {
        newSuggestion += 1;
        suggestionEntries.push(entry);
      }
    }
    if (
      statusChanged &&
      isSubmitterRole() &&
      submitter &&
      entry.submitter === submitter &&
      status === REVIEW_STATUS.APPROVED
    ) {
      newApproved += 1;
      approvedEntries.push(entry);
    }
    if (!REVIEW_PENDING_STATUSES.has(status)) {
      ackChanged = reviewerAckMap.delete(baseKey) || ackChanged;
    }
    if (
      !(submitter && entry.submitter === submitter && REVIEW_SUGGESTION_STATUSES.has(status)) ||
      status === REVIEW_STATUS.APPROVED
    ) {
      if (submitterAckMap.delete(submitterAckKey)) {
        ackChanged = true;
      }
    }
  });
  state.reviewEntryCache = newMap;
  if (newPending) {
    appendLog({ status: 'info', message: `新增 ${newPending} 条待审核任务`, broadcastGlobal: true });
    pendingEntries.forEach((entry) => {
      appendLog({
        status: 'info',
        message: formatNotificationLog('待审核', entry),
        broadcastGlobal: true
      });
    });
    triggerNotification('review');
    if (isReviewerRole()) {
      pendingEntries.forEach((entry) => showFloatingNotification('review', entry));
    }
  }
  if (newSuggestion) {
    appendLog({ status: 'info', message: `收到 ${newSuggestion} 条审核建议`, broadcastGlobal: true });
    suggestionEntries.forEach((entry) => {
      appendLog({
        status: 'info',
        message: formatNotificationLog('审核建议', entry),
        broadcastGlobal: true
      });
    });
    triggerNotification('suggestion');
    if (isSubmitterRole()) {
      suggestionEntries.forEach((entry) => showFloatingNotification('suggestion', entry));
    }
  }
  if (newApproved) {
    appendLog({ status: 'success', message: `有 ${newApproved} 条记录已审核通过并入库`, broadcastGlobal: true });
    approvedEntries.forEach((entry) => {
      appendLog({
        status: 'success',
        message: formatNotificationLog('已通过', entry),
        broadcastGlobal: true
      });
    });
    triggerNotification('approved');
    if (isSubmitterRole()) {
      approvedEntries.forEach((entry) => showFloatingNotification('approved', entry));
    }
  }
  if (ackChanged) {
    persistAcknowledgementRecords();
  }
}

function formatNotificationLog(label, entry = {}) {
  const row = entry.rowNumber ? `#${entry.rowNumber}` : '';
  const category = `${entry.mainCategory || '-'} / ${entry.subCategory || '-'}`;
  const submitter = entry.submitter || '-';
  return `${label}${row ? ` ${row}` : ''} ｜ ${category} ｜ 提交人：${submitter}`;
}

function startReviewPolling() {
  if (state.reviewPollTimer) {
    return;
  }
  state.reviewPollTimer = window.setInterval(() => {
    if (document.hidden || state.activeView !== 'review') {
      return;
    }
    loadReviewEntries({ silent: true });
  }, REVIEW_POLL_INTERVAL);
  if (!document.hidden && state.activeView === 'review') {
    loadReviewEntries({ silent: true });
  }
}

function stopReviewPolling() {
  if (state.reviewPollTimer) {
    clearInterval(state.reviewPollTimer);
    state.reviewPollTimer = null;
  }
}

let reviewInputResumeTimer = null;
let slotPresetFirebaseSaveTimer = null;
let pendingSlotPresets = null;

function isReviewInputElement(element) {
  if (!element || element.nodeType !== 1) return false;
  return element.matches([
    '.review-note-input',
    '.batch-note-input',
    '.hover-preview-note-input',
    '.review-note-wrapper input',
    '.file-review-note-input input'
  ].join(','));
}

function pauseReviewPollingForInput() {
  if (!state.reviewPollTimer) return;
  stopReviewPolling();
  state.reviewPollPausedByInput = true;
}

function resumeReviewPollingFromInput() {
  if (!state.reviewPollPausedByInput) return;
  state.reviewPollPausedByInput = false;
  startReviewPolling();
}

function setupReviewInputRefreshGuard() {
  document.addEventListener('focusin', (event) => {
    if (isReviewInputElement(event.target)) {
      pauseReviewPollingForInput();
    }
  }, true);

  document.addEventListener('focusout', () => {
    if (!state.reviewPollPausedByInput) return;
    if (reviewInputResumeTimer) {
      clearTimeout(reviewInputResumeTimer);
    }
    reviewInputResumeTimer = setTimeout(() => {
      if (isReviewInputElement(document.activeElement)) return;
      resumeReviewPollingFromInput();
    }, 800);
  }, true);
}

async function handleApproveReview(rowNumber, noteOverride = null) {
  const entry = getReviewEntry(rowNumber);
  if (!entry) {
    appendLog({ status: 'error', message: '未找到该审核记录' });
    return;
  }
  const reviewer = getSubmitterName();
  if (!reviewer) {
    appendLog({ status: 'error', message: '请先填写提交人姓名作为审核人' });
    elements.metadata.submitter?.focus();
    return;
  }
  const noteInput = document.querySelector(`.review-note-input[data-row="${rowNumber}"]`);
  const note =
    noteOverride != null ? noteOverride : noteInput ? noteInput.value.trim() : entry.note || '';
  const acceptedCount = Array.isArray(entry.acceptedDetails) && entry.acceptedDetails.length
    ? entry.acceptedDetails.length
    : Array.isArray(entry.acceptedFiles)
      ? entry.acceptedFiles.length
      : 0;
  if (!state.reviewSubmitting) {
    state.reviewSubmitting = new Set();
  }
  if (state.reviewSubmitting.has(rowNumber)) {
    appendLog({ status: 'info', message: '正在入库，请稍候…' });
    return;
  }
  if (!acceptedCount) {
    const proceed = await showConfirmationDialog({
      title: '未检测到合格文件',
      message: '成品文件夹为空，后端将拒绝入库操作。请确认文件已移入成品文件夹后再试。',
      confirmText: '尝试继续',
      cancelText: '取消'
    });
    if (!proceed) {
      return;
    }
  }

  const statusSnapshot = updateReviewCardStatusUI(rowNumber, REVIEW_STATUS.APPROVED);

  // 暂停自动刷新，避免操作期间的刷新冲突
  const autoRefreshWasPaused = !state.reviewPollTimer;
  if (state.reviewPollTimer) {
    clearInterval(state.reviewPollTimer);
    state.reviewPollTimer = null;
    console.log('⏸️ 已暂停自动刷新（审核操作进行中）');
  }

  const actionBtn = document.querySelector(`button[data-action="apply-review-status"][data-row="${rowNumber}"]`);
  const statusSelect = document.querySelector(`.review-status-select[data-row="${rowNumber}"]`);
  const originalText = actionBtn?.textContent;
  const previousStatus = entry.status;

  state.reviewSubmitting.add(rowNumber);

  // 立即重新渲染该条目，显示"入库中"状态
  // renderReviewEntries(); // Removed as per instruction

  if (actionBtn) {
    actionBtn.disabled = true;
    actionBtn.classList.add('loading');
    actionBtn.textContent = '正在入库…';
  }
  if (statusSelect) {
    statusSelect.disabled = true;
  }
  appendLog({ status: 'info', message: `正在入库：${entry.mainCategory || ''}/${entry.subCategory || ''}` });
  try {
    await window.bridge.approveReviewEntry({ ...entry, note, reviewer });

    // 成功后立即更新本地状态为"已通过"
    entry.status = '已通过';
    entry.normalizedStatus = normalizeReviewStatus('已通过');
    entry.note = note;
    entry.reviewer = reviewer;

    appendLog({ status: 'success', message: `已通过 ${entry.mainCategory || ''}/${entry.subCategory || ''}` });
    clearReviewNoteDraft(rowNumber);
    markActionConfirmed(rowNumber, 'apply-review-status');
    state.reviewAcknowledged.submitter?.delete?.(getEntryKey(entry));
    state.reviewAcknowledged.reviewer?.delete?.(getReviewerKey(entry));
    persistAcknowledgementRecords();

    // 手动刷新一次，此时卡片会根据筛选条件自然消失或保留
    console.log('🔄 操作完成，手动刷新一次');
    await loadReviewEntries().catch(err => console.warn('手动刷新失败:', err));

  } catch (error) {
    // 失败时恢复原状态
    entry.status = previousStatus;
    entry.normalizedStatus = normalizeReviewStatus(previousStatus);
    restoreReviewCardStatusUI(rowNumber, statusSnapshot);

    appendLog({ status: 'error', message: `审核通过失败：${error.message}` });
    renderReviewEntries();  // 失败时需要重新渲染以恢复UI
  } finally {
    state.reviewSubmitting.delete(rowNumber);
    if (actionBtn) {
      actionBtn.disabled = false;
      actionBtn.classList.remove('loading');
      actionBtn.textContent = originalText || '更新状态';
    }
    if (statusSelect) {
      statusSelect.disabled = false;
    }

    // 恢复自动刷新（如果之前没有暂停）
    // 注意：无论当前 activeView 是什么，都应恢复，因为轮询会自动检查视图状态
    if (!autoRefreshWasPaused) {
      startReviewPolling();
      console.log('▶️ 已恢复自动刷新');
    }
  }
}

async function handleSuggestionReview(rowNumber, status = REVIEW_STATUS.NEEDS_CHANGE, noteOverride = null) {
  const entry = getReviewEntry(rowNumber);
  if (!entry) {
    appendLog({ status: 'error', message: '未找到该审核记录' });
    return;
  }
  const reviewer = getSubmitterName();
  if (!reviewer) {
    appendLog({ status: 'error', message: '请先填写提交人姓名作为审核人' });
    elements.metadata.submitter?.focus();
    return;
  }
  const noteInput = document.querySelector(`.review-note-input[data-row="${rowNumber}"]`);
  const note =
    noteOverride != null ? noteOverride : noteInput ? noteInput.value.trim() : entry.note || '';
  const previous = {
    status: entry.status,
    normalizedStatus: entry.normalizedStatus,
    note: entry.note,
    reviewer: entry.reviewer
  };
  const statusSnapshot = updateReviewCardStatusUI(rowNumber, status);
  entry.status = status;
  entry.normalizedStatus = normalizeReviewStatus(status);
  entry.note = note;
  entry.reviewer = reviewer;
  renderReviewEntries();
  renderSubmitterSuggestions();
  try {
    await window.bridge.rejectReviewEntry({ ...entry, note: note || '', reviewer, status });
    appendLog({
      status: 'success',
      message: `${entry.mainCategory || ''}/${entry.subCategory || ''} 状态更新为 ${status}`
    });
    clearReviewNoteDraft(rowNumber);
    markActionConfirmed(rowNumber, 'apply-review-status');
    state.reviewAcknowledged.submitter?.delete?.(getEntryKey(entry));
    state.reviewAcknowledged.reviewer?.delete?.(getReviewerKey(entry));
    persistAcknowledgementRecords();
  } catch (error) {
    restoreReviewCardStatusUI(rowNumber, statusSnapshot);
    entry.status = previous.status;
    entry.normalizedStatus = previous.normalizedStatus;
    entry.note = previous.note;
    entry.reviewer = previous.reviewer;
    renderReviewEntries();
    renderSubmitterSuggestions();
    appendLog({ status: 'error', message: `记录建议失败：${error.message}` });
  }
}

async function handleReopenReview(rowNumber, status = REVIEW_STATUS.UPDATED, noteOverride = null) {
  const entry = getReviewEntry(rowNumber);
  if (!entry) {
    appendLog({ status: 'error', message: '未找到该审核记录' });
    return;
  }
  const reviewer = getSubmitterName();
  if (!reviewer) {
    appendLog({ status: 'error', message: '请先填写提交人姓名作为审核人' });
    elements.metadata.submitter?.focus();
    return;
  }
  const noteInput = document.querySelector(`.review-note-input[data-row="${rowNumber}"]`);
  const note =
    noteOverride != null ? noteOverride : noteInput ? noteInput.value.trim() : entry.note || '';
  const previous = {
    status: entry.status,
    normalizedStatus: entry.normalizedStatus,
    note: entry.note,
    reviewer: entry.reviewer
  };
  const statusSnapshot = updateReviewCardStatusUI(rowNumber, status);
  entry.status = status;
  entry.normalizedStatus = normalizeReviewStatus(status);
  entry.note = note;
  entry.reviewer = reviewer;
  renderReviewEntries();
  renderSubmitterSuggestions();
  try {
    await window.bridge.reopenReviewEntry({ ...entry, note, reviewer, status });
    appendLog({
      status: 'success',
      message: `${entry.mainCategory || ''}/${entry.subCategory || ''} 状态更新为 ${status}`
    });
    clearReviewNoteDraft(rowNumber);
    markActionConfirmed(rowNumber, 'apply-review-status');
    state.reviewAcknowledged.submitter?.delete?.(getEntryKey(entry));
    state.reviewAcknowledged.reviewer?.delete?.(getReviewerKey(entry));
    persistAcknowledgementRecords();
  } catch (error) {
    restoreReviewCardStatusUI(rowNumber, statusSnapshot);
    entry.status = previous.status;
    entry.normalizedStatus = previous.normalizedStatus;
    entry.note = previous.note;
    entry.reviewer = previous.reviewer;
    renderReviewEntries();
    renderSubmitterSuggestions();
    appendLog({ status: 'error', message: `重新提交失败：${error.message}` });
  }
}

/**
 * 同步 Sheet 中标记为"已通过"的审核记录到入库
 * 
 * 此函数在普通审核模式和按文件审核模式下都会工作：
 * - 普通模式：同步传统的审核记录
 * - 按文件模式：loadReviewEntries 会自动根据 useFileReviewMode 调用对应的加载函数
 * 
 * 调用 syncReviewEntries 后端 API，然后刷新审核数据。
 */
async function handleSyncReview() {
  if (!window.bridge?.syncReviewEntries) {
    return;
  }
  try {
    const result = await window.bridge.syncReviewEntries();
    const processed = result?.processed || 0;
    appendLog({
      status: 'success',
      message: `已同步 Sheet 审批，成功入库 ${processed} 条`,
      broadcastGlobal: true
    });
    await loadReviewEntries();
  } catch (error) {
    appendLog({ status: 'error', message: `同步失败：${error.message}` });
  }
}

// 上一次更新的进度记录，用于节流
const lastProgressUpdate = new Map();

function handleUploadProgress(entry) {
  if (!entry) return;
  if (entry.fileId && entry.slotId) {
    const status = entry.status === 'running' ? 'running' : entry.status;
    const progress = entry.progress || 0;

    // 对于进度更新，使用节流以避免频繁重渲染
    if (entry.phase === 'uploading' && progress > 0 && progress < 100) {
      const lastProgress = lastProgressUpdate.get(entry.fileId) || 0;
      // 只有进度变化超过 5% 才更新 UI
      if (progress - lastProgress < 5) {
        // 直接更新进度条 DOM，不重渲染整个列表
        updateProgressRingDirectly(entry.slotId, entry.fileId, progress);
        return;
      }
      lastProgressUpdate.set(entry.fileId, progress);
    } else {
      // 非进度更新或完成，清除记录
      lastProgressUpdate.delete(entry.fileId);
    }

    setFileStatus(entry.slotId, entry.fileId, status, entry.message, progress);
    if (entry.folderLink && !entry.isReference) {
      setSlotLink(entry.slotId, entry.folderLink);
    }
    if (entry.referenceLink) {
      setSlotReferenceLink(entry.slotId, entry.referenceLink);
    }
  }
  // 只在非频繁进度更新时写日志
  if (entry.phase !== 'uploading' || entry.progress === 100 || !entry.progress) {
    appendUploadLog(entry);
  }
}

// 直接更新进度条 DOM，避免重渲染
function updateProgressRingDirectly(slotId, fileId, progress) {
  const fileItem = document.querySelector(`.slot-grid-file-item[data-file-id="${fileId}"]`);
  if (!fileItem) return;

  // 确保有进度覆盖层
  let overlay = fileItem.querySelector('.upload-progress-overlay');
  if (!overlay) {
    // 创建进度覆盖层
    const thumbnail = fileItem.querySelector('.slot-grid-file-thumbnail');
    if (!thumbnail) return;

    const progressRingSize = 44;
    const strokeWidth = 4;
    const radius = (progressRingSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    overlay = document.createElement('div');
    overlay.className = 'upload-progress-overlay';
    overlay.dataset.fileId = fileId;
    overlay.innerHTML = `
      <svg class="upload-progress-ring" width="${progressRingSize}" height="${progressRingSize}">
        <circle
          class="upload-progress-ring-bg"
          stroke="rgba(255,255,255,0.3)"
          stroke-width="${strokeWidth}"
          fill="transparent"
          r="${radius}"
          cx="${progressRingSize / 2}"
          cy="${progressRingSize / 2}"
        />
        <circle
          class="upload-progress-ring-fg"
          stroke="#3b82f6"
          stroke-width="${strokeWidth}"
          stroke-linecap="round"
          fill="transparent"
          r="${radius}"
          cx="${progressRingSize / 2}"
          cy="${progressRingSize / 2}"
          style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; transform: rotate(-90deg); transform-origin: center;"
        />
      </svg>
      <span class="upload-progress-text">${progress}%</span>
    `;
    thumbnail.appendChild(overlay);
    fileItem.classList.add('uploading');
  } else {
    // 更新现有进度
    const progressRingSize = 44;
    const strokeWidth = 4;
    const radius = (progressRingSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    const fg = overlay.querySelector('.upload-progress-ring-fg');
    const text = overlay.querySelector('.upload-progress-text');
    if (fg) {
      fg.style.strokeDashoffset = offset;
    }
    if (text) {
      text.textContent = `${progress}%`;
    }
  }
}

function setFileStatus(slotId, fileId, status, message, progress = 0, shouldRender = true) {
  const slot = getSlot(slotId);
  if (!slot) return;
  let statusStore = slot.fileStatuses;
  const inReferenceList = slot.referenceFiles?.some((file) => file.id === fileId);
  const inReferenceStatuses = slot.referenceFileStatuses?.has?.(fileId);
  const isReferenceFile = inReferenceList || inReferenceStatuses;
  if (isReferenceFile) {
    if (!slot.referenceFileStatuses) {
      slot.referenceFileStatuses = new Map();
    }
    statusStore = slot.referenceFileStatuses;
  }
  statusStore.set(fileId, {
    status,
    message: message || statusLabels[status] || '',
    progress: progress || 0
  });
  if (shouldRender) {
    renderSlots();
  }
}

function setSlotLink(slotId, link, shouldRender = true) {
  const slot = getSlot(slotId);
  if (!slot) return;
  slot.lastFolderLink = link;
  if (shouldRender) {
    renderSlots();
  }
}

function setSlotReferenceLink(slotId, link, shouldRender = true) {
  const slot = getSlot(slotId);
  if (!slot) return;
  slot.reviewReferenceLink = link || '';
  if (shouldRender) {
    renderSlots();
  }
}

function finalizeRunningStatuses(slot) {
  if (!slot) return;
  const normalizeMap = (map) => {
    if (!map || !map.size) return false;
    let changed = false;
    map.forEach((info, key) => {
      if (info?.status === 'running' || info?.status === 'queued') {
        map.set(key, { ...info, status: 'success', message: '已完成' });
        changed = true;
      }
    });
    return changed;
  };
  const changedMain = normalizeMap(slot.fileStatuses);
  const changedRef = normalizeMap(slot.referenceFileStatuses);
  if (changedMain || changedRef) {
    renderSlots();
  }
}

function handleUploadStateChange(payload) {
  const prevState = state.uploadState;
  state.uploadState = payload?.state || 'idle';
  if (state.uploadState === 'idle') {
    state.slots.forEach((slot) => finalizeRunningStatuses(slot));
  }
  updateUploadControls();
  if (prevState !== state.uploadState) {
    renderSlots();
  }
}

async function handlePause() {
  await window.bridge.pauseUpload();
  // 显示暂停图标在所有正在上传的文件上
  showPauseIconOnUploadingFiles();
}

async function handleResume() {
  await window.bridge.resumeUpload();
  // 移除暂停图标，恢复进度显示
  hidePauseIconOnUploadingFiles();
}

// 在正在上传的文件上显示暂停图标
function showPauseIconOnUploadingFiles() {
  document.querySelectorAll('.slot-grid-file-item.uploading').forEach(item => {
    const overlay = item.querySelector('.upload-progress-overlay');
    if (overlay && !overlay.querySelector('.upload-paused-icon')) {
      // 添加暂停图标
      const pauseIcon = document.createElement('div');
      pauseIcon.className = 'upload-paused-icon';
      pauseIcon.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      `;
      overlay.appendChild(pauseIcon);
      overlay.classList.add('paused');

      // 隐藏进度文字
      const text = overlay.querySelector('.upload-progress-text');
      if (text) text.style.display = 'none';
    }
  });
}

// 移除暂停图标
function hidePauseIconOnUploadingFiles() {
  document.querySelectorAll('.upload-progress-overlay.paused').forEach(overlay => {
    const pauseIcon = overlay.querySelector('.upload-paused-icon');
    if (pauseIcon) pauseIcon.remove();
    overlay.classList.remove('paused');

    // 恢复进度文字
    const text = overlay.querySelector('.upload-progress-text');
    if (text) text.style.display = '';
  });
}

async function handleStop() {
  await window.bridge.stopUpload();

  // 清空上传队列
  if (state.uploadQueue.length > 0) {
    const queueCount = state.uploadQueue.length;
    state.uploadQueue = [];
    appendUploadLog({
      status: 'info',
      message: `已清空上传队列（${queueCount} 个分类）`
    });
    updateUploadControls();
  }
}

async function handleClearUploadState() {
  try {
    const result = await window.bridge?.clearUploadState?.();
    state.slots.forEach((slot) => {
      slot.fileStatuses = new Map();
      slot.referenceFileStatuses = new Map();
    });
    renderSlots();
    appendUploadLog({
      status: result?.success ? 'success' : 'warning',
      message: result?.success ? '已清空上传记录缓存，可重新上传同名文件' : `清空上传缓存失败：${result?.message || '未知错误'}`
    });
  } catch (error) {
    appendUploadLog({ status: 'error', message: `清空上传缓存失败：${error.message}` });
  }
}

function updateUploadControls() {
  const { uploadState } = state;
  const isIdle = uploadState === 'idle';
  const isUploading = uploadState === 'uploading' || uploadState === 'preparing';
  const isPaused = uploadState === 'paused';
  const isPausing = uploadState === 'pausing'; // 新状态：正在暂停，等待当前文件

  elements.startUpload.disabled = !isIdle;
  elements.pauseUpload.disabled = !isUploading && !isPausing;
  elements.resumeUpload.disabled = !isPaused && !isPausing;
  elements.stopUpload.disabled = isIdle;

  elements.startUpload.textContent = isIdle ? '开始上传' : '上传进行中';

  elements.uploadStateLabel.classList.remove('online', 'offline', 'paused', 'pausing');
  if (isPausing) {
    elements.uploadStateLabel.textContent = '正在暂停...';
    elements.uploadStateLabel.classList.add('pausing');
  } else if (isUploading) {
    elements.uploadStateLabel.textContent = '上传中';
    elements.uploadStateLabel.classList.add('online');
  } else if (isPaused) {
    elements.uploadStateLabel.textContent = '已暂停';
    elements.uploadStateLabel.classList.add('paused');
  } else if (uploadState === 'stopped') {
    elements.uploadStateLabel.textContent = '已停止';
    elements.uploadStateLabel.classList.add('offline');
  } else {
    elements.uploadStateLabel.textContent = '空闲';
    elements.uploadStateLabel.classList.add('offline');
  }
  document.querySelectorAll('[data-slot-upload-action]').forEach((btn) => {
    const action = btn.dataset.slotUploadAction;
    const slotId = btn.dataset.slotId;

    if (action === 'start') {
      // 获取该分类
      const slot = slotId ? getSlot(slotId) : null;

      btn.disabled = false;

      // 检查是否正在上传（有文件处于 pending/queued/running 状态）
      let isUploading = false;
      if (slot) {
        const statuses = [];
        slot.fileStatuses?.forEach((info) => info?.status && statuses.push(info.status));
        if (slot.reviewEnabled && slot.referenceFileStatuses) {
          slot.referenceFileStatuses.forEach((info) => info?.status && statuses.push(info.status));
        }
        isUploading = statuses.includes('running') || statuses.includes('queued') || statuses.includes('pending');
      }

      // 检查该分类是否在队列中
      const isInQueue = slotId && state.uploadQueue.includes(slotId);

      // 移除所有状态类
      btn.classList.remove('queued', 'uploading');

      if (isUploading) {
        // 正在上传：绿色 + "正在上传"
        btn.textContent = '正在上传';
        btn.classList.add('uploading');
      } else if (isInQueue) {
        // 队列中：橙色 + "队列中 (序号)"
        const queueIndex = state.uploadQueue.indexOf(slotId);
        btn.textContent = `队列中 (${queueIndex + 1})`;
        btn.classList.add('queued');
      } else {
        // 等待上传：蓝色 + "确认上传"
        btn.textContent = '确认上传';
      }
    } else if (action === 'pause') {
      btn.disabled = !isUploading;
    } else if (action === 'resume') {
      btn.disabled = !isPaused;
    } else if (action === 'stop') {
      btn.disabled = isIdle;
    }
    btn.classList.toggle('disabled', btn.disabled);
  });

  // 更新全局上传按钮的文本，显示队列信息
  if (state.uploadQueue.length > 0) {
    elements.startUpload.textContent = `开始上传 (队列: ${state.uploadQueue.length})`;
  } else {
    elements.startUpload.textContent = isIdle ? '开始上传' : '上传进行中';
  }
}

function appendUploadLog(entry) {
  appendLog({ scope: 'upload', ...entry });
}

function appendLog(entry) {
  const scope = entry.scope || entry.channel || 'global';
  const message = entry.message || `${entry.status === 'success' ? '完成' : '状态'}：${entry.name || entry.source || ''}`;
  const shouldBroadcast =
    scope !== 'upload' ||
    entry?.broadcastGlobal ||
    entry?.status === 'error' ||
    entry?.status === 'warning';
  if (scope === 'upload') {
    const container = elements.uploadLog;
    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry');
    if (entry.status === 'success') {
      logEntry.classList.add('success');
    }
    if (entry.status === 'error') {
      logEntry.classList.add('error');
    }
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    container.appendChild(logEntry);
    container.scrollTop = container.scrollHeight;
  }
  if (shouldBroadcast) {
    showGlobalMessage({ ...entry, message });
  }
}

function showGlobalMessage(entry) {
  const alert = elements.globalAlert;
  if (!alert || !entry?.message) {
    return;
  }
  alert.textContent = entry.message;
  alert.classList.remove('show', 'error', 'warning', 'success');
  if (entry.status === 'error') {
    alert.classList.add('error');
  } else if (entry.status === 'warning') {
    alert.classList.add('warning');
  } else if (entry.status === 'success') {
    alert.classList.add('success');
  }
  alert.classList.add('show');
  if (entry.status === 'error') {
    alert.dataset.snapshot = entry.message;
  } else {
    delete alert.dataset.snapshot;
  }
  if (globalAlertTimer) {
    clearTimeout(globalAlertTimer);
  }
  globalAlertTimer = setTimeout(() => {
    hideGlobalMessage();
  }, 15000);
}

function hideGlobalMessage() {
  const alert = elements.globalAlert;
  if (!alert) {
    return;
  }
  alert.dataset.dismissedAt = Date.now();
  alert.classList.remove('show', 'error', 'warning', 'success');
  if (globalAlertTimer) {
    clearTimeout(globalAlertTimer);
    globalAlertTimer = null;
  }
}

function debounce(fn, delay = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function getInFlightActions() {
  if (!state.inFlightActions) {
    state.inFlightActions = new Set();
  }
  return state.inFlightActions;
}

function tryBeginInFlight(key) {
  if (!key) {
    return true;
  }
  const set = getInFlightActions();
  if (set.has(key)) {
    return false;
  }
  set.add(key);
  return true;
}

function endInFlight(key) {
  if (!key) {
    return;
  }
  getInFlightActions().delete(key);
}

const debouncedPreview = debounce(() => refreshAllPreviews());

elements.saveConfig.addEventListener('click', handleSaveConfig);
elements.resetBasicConfig?.addEventListener('click', handleResetBasicConfig);
elements.resetNamingConfig?.addEventListener('click', handleResetNamingConfig);
elements.resetNotificationConfig?.addEventListener('click', handleResetNotificationConfig);
elements.resetAllConfig?.addEventListener('click', handleResetAllConfig);

elements.mediaDownloadDirPick?.addEventListener('click', async () => {
  const dir = await window.bridge.pickFolder();
  if (dir && elements.mediaDownloadDir) {
    elements.mediaDownloadDir.value = dir;
    state.config.mediaDownloadDir = dir;
    appendLog({ status: 'info', message: `已选择下载目录：${dir}` });
  }
});
elements.authorizeBtn.addEventListener('click', handleAuthorize);
elements.refreshSoftware?.addEventListener('click', handleRefreshSoftwareDirectory);
elements.addSoftwareEntry?.addEventListener('click', () => openSoftwareForm('create'));
elements.softwareSearch?.addEventListener('input', (event) => {
  state.softwareFilters.search = event.target.value.trim().toLowerCase();
  renderSoftwareDirectory();
});
elements.softwareCategoryFilter?.addEventListener('change', (event) => {
  state.softwareFilters.category = event.target.value.trim();
  renderSoftwareDirectory();
});
elements.softwareReviewRefresh?.addEventListener('click', () => {
  refreshSoftwareSubmissions();
});
elements.softwareEditToggle?.addEventListener('change', (event) => {
  state.softwareEditEnabled = Boolean(event.target.checked);
  renderSoftwareDirectory();
});
elements.softwareFormClose?.addEventListener('click', closeSoftwareForm);
elements.softwareFormCancel?.addEventListener('click', closeSoftwareForm);
elements.softwareFormSubmit?.addEventListener('click', handleSoftwareFormSubmit);
elements.softwareFormOverlay?.addEventListener('click', (event) => {
  if (event.target === elements.softwareFormOverlay) {
    closeSoftwareForm();
  }
});
elements.toggleUploadProgress?.addEventListener('click', () => {
  if (!elements.uploadProgressBody) return;
  const collapsed = elements.uploadProgressBody.classList.toggle('collapsed');
  elements.uploadProgressBody.hidden = collapsed;
  const label = collapsed ? '显示上传细节' : '隐藏上传细节';
  elements.toggleUploadProgress.setAttribute('aria-label', label);
  elements.toggleUploadProgress.title = label;
  elements.toggleUploadProgress.classList.toggle('is-collapsed', collapsed);
});
if (elements.toggleUploadProgress && elements.uploadProgressBody) {
  const collapsed = elements.uploadProgressBody.classList.contains('collapsed');
  const label = collapsed ? '显示上传细节' : '隐藏上传细节';
  elements.toggleUploadProgress.setAttribute('aria-label', label);
  elements.toggleUploadProgress.title = label;
  elements.toggleUploadProgress.classList.toggle('is-collapsed', collapsed);
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && elements.softwareFormOverlay && !elements.softwareFormOverlay.hidden) {
    closeSoftwareForm();
  }
});
elements.importConfig.addEventListener('click', async () => {
  try {
    const result = await window.bridge.importConfig();
    if (result?.imported && result.config) {
      state.config = result.config;
      fillConfig(state.config);
      ensureNamingDateDefault();
      if (Array.isArray(result.slots)) {
        cachedSlotPresets = result.slots;
        restoreSlotPresets(result.slots);
        persistSlotPresets();
      }
      const prefs = result.preferences || {};
      if (prefs && typeof prefs === 'object') {
        cachedPreferences = { ...cachedPreferences, ...prefs };
        restoreSlotGroupMode(prefs);
      }
      if (Object.prototype.hasOwnProperty.call(prefs, 'renameLocal')) {
        persistRenameLocalPreference(Boolean(prefs.renameLocal));
      }
      if (prefs.reviewSortMode) {
        setReviewSortMode(prefs.reviewSortMode);
      }
      if (prefs.reviewRangeMode) {
        setReviewRangeMode(prefs.reviewRangeMode);
      }
      if (prefs.myReviewSortMode) {
        setMyReviewSortMode(prefs.myReviewSortMode);
      }
      if (prefs.myReviewRange) {
        setMyReviewRange(prefs.myReviewRange);
      }
      await maybeFetchCategories();
      await refreshAllPreviews();
      await refreshSoftwareDirectory({ silent: true });

      // 重新渲染信息板并检查更新
      renderNoticeBoard();
      checkNoticeBoardUpdate();

      appendLog({ status: 'success', message: '配置已导入并应用' });
    } else {
      appendLog({ status: 'error', message: '已取消导入' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `导入失败：${error.message}` });
  }
});
elements.exportConfig.addEventListener('click', async () => {
  try {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      config: gatherConfigFromForm(),
      slots: getSlotPresets(),
      preferences: {
        renameLocal: state.renameLocalEnabled,
        reviewSortMode: state.reviewSort?.mode || 'priority',
        reviewRangeMode: state.reviewRangeMode || '10d',
        myReviewSortMode: state.myReviewSort?.mode || 'priority',
        myReviewRange: state.myReviewFilters?.range || '10d'
      }
    };
    const result = await window.bridge.exportConfig(payload);
    if (result?.saved) {
      appendLog({ status: 'success', message: `配置已导出：${result.path}` });
    } else {
      appendLog({ status: 'error', message: '已取消导出' });
    }
  } catch (error) {
    appendLog({ status: 'error', message: `导出失败：${error.message}` });
  }
});
if (elements.zoomFactor) {
  elements.zoomFactor.addEventListener('input', handleZoomFactorChange);
  elements.zoomFactor.addEventListener('change', handleZoomFactorChange);
}
elements.resetZoom?.addEventListener('click', handleResetZoom);
elements.startUpload.addEventListener('click', () => handleUpload());
elements.pauseUpload.addEventListener('click', handlePause);
elements.resumeUpload.addEventListener('click', handleResume);
elements.stopUpload.addEventListener('click', handleStop);
elements.clearUploadState?.addEventListener('click', handleClearUploadState);
elements.addSlotBtn.addEventListener('click', () => addSlot());
elements.syncCategories.addEventListener('click', () => maybeFetchCategories(true));
elements.toggleSlotGroupBtn?.addEventListener('click', () => {
  setSlotGroupMode(!state.groupSlotsByMain);
});
elements.slotPresetExport?.addEventListener('click', async () => {
  await exportSlotPresets();
});
elements.slotPresetImport?.addEventListener('click', async () => {
  await importSlotPresets();
});
elements.slotPresetReset?.addEventListener('click', () => {
  resetSlotPresetsToDefault();
});
elements.slotSearch?.addEventListener('input', (event) => {
  state.slotFilter = event.target.value.trim().toLowerCase();
  renderSlots();
});
elements.renameLocal?.addEventListener('change', (event) => {
  persistRenameLocalPreference(event.target.checked);
});
elements.addCustomTextBtn?.addEventListener('click', () => addCustomTextDefinition());
elements.addNamingPreset?.addEventListener('click', () => {
  addNamingPreset(elements.namingPresetName?.value, state.config.renamePattern);
  if (elements.namingPresetName) {
    elements.namingPresetName.value = '';
  }
});
elements.addFolderPreset?.addEventListener('click', () => {
  addFolderPreset(elements.folderPresetName?.value, state.config.folderPattern);
  if (elements.folderPresetName) {
    elements.folderPresetName.value = '';
  }
});
elements.namingPresetList?.addEventListener('click', handleNamingPresetListClick);
elements.namingPresetList?.addEventListener('input', handleNamingPresetLabelInput);
elements.folderPresetList?.addEventListener('click', handleFolderPresetListClick);
elements.folderPresetList?.addEventListener('input', handleFolderPresetLabelInput);
elements.reviewTempFolder?.addEventListener('change', (event) => {
  state.config.reviewTempFolder = event.target.value.trim();
});
elements.reviewSortMode?.addEventListener('change', (event) => {
  setReviewSortMode(event.target.value);
});
elements.reviewRangeMode?.addEventListener('change', (event) => {
  setReviewRangeMode(event.target.value);
});
elements.reviewPagination?.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  if (action === 'review-page-prev') {
    state.reviewPage = Math.max(1, (state.reviewPage || 1) - 1);
    renderReviewEntries();
  } else if (action === 'review-page-next') {
    state.reviewPage = (state.reviewPage || 1) + 1;
    renderReviewEntries();
  }
});
elements.notificationMode?.addEventListener('change', (event) => {
  state.config.notificationMode = event.target.value;
});
elements.notificationSoundReview?.addEventListener('change', (event) => {
  state.config.notificationSoundReview = event.target.value.trim();
  resetCustomAudioPlayer('review');
});
elements.notificationSoundSuggestion?.addEventListener('change', (event) => {
  state.config.notificationSoundSuggestion = event.target.value.trim();
  resetCustomAudioPlayer('suggestion');
});
elements.notificationSoundApproved?.addEventListener('change', (event) => {
  state.config.notificationSoundApproved = event.target.value.trim();
  resetCustomAudioPlayer('approved');
});
elements.floatingNotificationToggle?.addEventListener('change', (event) => {
  state.config.enableFloatingNotifications = event.target.checked;
});
// 🔴 新增：通知位置事件
document.getElementById('notification-position')?.addEventListener('change', (event) => {
  state.config.notificationPosition = event.target.value;
});
elements.userRole?.addEventListener('change', (event) => {
  setUserRole(event.target.value);
});
elements.myReviewRange?.addEventListener('change', (event) => {
  setMyReviewRange(event.target.value);
});
elements.myReviewLimit?.addEventListener('change', (event) => {
  setMyReviewLimit(event.target.value);
});
elements.myReviewCustomStart?.addEventListener('change', (event) => {
  setMyReviewCustomDate('start', event.target.value);
});
elements.myReviewCustomEnd?.addEventListener('change', (event) => {
  setMyReviewCustomDate('end', event.target.value);
});
elements.myReviewReset?.addEventListener('click', resetMyReviewFilters);
elements.myReviewSortMode?.addEventListener('change', (event) => {
  setMyReviewSortMode(event.target.value);
});
elements.myReviewPagination?.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  if (action === 'my-review-prev') {
    state.myReviewPage = Math.max(1, (state.myReviewPage || 1) - 1);
    renderSubmitterSuggestions();
  } else if (action === 'my-review-next') {
    state.myReviewPage = (state.myReviewPage || 1) + 1;
    renderSubmitterSuggestions();
  }
});
elements.myReviewSummary?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-status-filter]');
  if (!target) return;
  setMyReviewStatusFilter(target.dataset.statusFilter || 'all');
});
elements.viewNormal?.addEventListener('click', () => switchSlotView('normal'));
elements.viewReview?.addEventListener('click', () => switchSlotView('review'));
initViewTabs();
initUserRolePreference();
initMyReviewFilters();
switchSlotView(state.slotViewMode || 'normal');
renderReviewEntries();
elements.refreshReview?.addEventListener('click', async () => {
  appendLog({ status: 'info', message: '正在刷新并同步数据...' });

  try {
    // 1. 先获取表格最新数据
    const result = await window.bridge.fetchFileReviewEntries({ groupByBatch: true });
    const sheetFiles = result.files || [];

    // 2. 使用公用函数同步所有字段到 Firebase
    await syncSheetDataToFirebase(sheetFiles);

    // 3. 刷新界面
    await loadReviewEntries({ logSuccess: true, forceRefresh: true, skipConflictCheck: true });
  } catch (err) {
    appendLog({ status: 'error', message: '刷新失败: ' + err.message });
  }
});
elements.syncReview?.addEventListener('click', handleSyncReview);
elements.reviewList?.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  const row = Number(event.target.dataset.row);
  if (!row) return;
  if (action === 'apply-review-status') {
    applyReviewStatus(row);
  }
});
elements.myReviewList?.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  const row = Number(event.target.dataset.row);
  if (!row) return;
  if (action === 'mark-updated') {
    handleReopenReview(row, REVIEW_STATUS.UPDATED);
    markActionConfirmed(row, 'mark-updated');
  } else if (action === 'cancel-review') {
    handleReopenReview(row, REVIEW_STATUS.CANCELLED);
    markActionConfirmed(row, 'cancel-review');
  } else if (action === 'reopen-cancelled') {
    handleReopenReview(row, REVIEW_STATUS.PENDING);
    markActionConfirmed(row, 'reopen-cancelled');
  }
});

document.addEventListener('click', async (event) => {
  const toggleButton = event.target.closest('[data-action="toggle-file-summary"]');
  if (toggleButton) {
    event.preventDefault();
    toggleFileSummary(toggleButton);
    return;
  }
  const refreshButton = event.target.closest('[data-action="refresh-file-summary"]');
  if (refreshButton) {
    event.preventDefault();
    const row = Number(refreshButton.dataset.row);
    if (!row || refreshButton.disabled) {
      return;
    }
    const originalText = refreshButton.textContent;
    refreshButton.disabled = true;
    refreshButton.classList.add('loading');
    refreshButton.textContent = '刷新中...';
    try {
      await refreshReviewEntryFiles(row);
    } finally {
      refreshButton.disabled = false;
      refreshButton.classList.remove('loading');
      refreshButton.textContent = originalText;
    }
    return;
  }
  const linkTarget = event.target.closest('[data-open-url]');
  if (linkTarget) {
    event.preventDefault();
    const linkType = linkTarget.dataset.linkType;
    if (linkType === 'final') {
      const reviewStatus = linkTarget.dataset.reviewStatus || '';
      if (reviewStatus !== REVIEW_STATUS.APPROVED) {
        appendLog({ status: 'error', message: '该条审核尚未通过，暂无法打开最终链接' });
        await showInfoDialog({
          title: '尚未通过审核',
          message: '该条审核记录未通过或仍在审核中，暂无法打开入库后的最终链接。'
        });
        return;
      }
    }
    openExternalLink(linkTarget.dataset.openUrl);
  }
});

document.addEventListener('input', (event) => {
  const noteInput = event.target.closest('.review-note-input');
  if (!noteInput) return;
  const row = Number(noteInput.dataset.row);
  if (!row) return;
  setReviewNoteDraft(row, noteInput.value);
});

window.bridge?.onNotificationCommand?.((payload) => {
  if (!payload) return;
  const { action, rowNumber, note, type, batchId, targetView, slotKey, slotLabel, taskCount, taskName, isFav } = payload;

  // 🔴 处理收藏任务操作（从通知弹窗发送）
  if (action === 'toggle-favorite-task' && taskName) {
    console.log(`[Checkin] 收到收藏操作: ${isFav ? '加入' : '取消'}常用 - ${taskName}`);
    if (window.CheckinCore?.toggleFavoriteTask) {
      window.CheckinCore.toggleFavoriteTask(taskName);
    }
    return;
  }

  // 处理报数操作
  if (type === 'report') {
    if (action === 'report-submit' && slotKey && taskCount) {
      // 调用 CheckinReport 提交报数
      const reportTimes = [
        { key: 'morning', label: '上午', slot: 'morning' },
        { key: 'afternoon', label: '下午', slot: 'afternoon' },
        { key: 'evening', label: '晚上', slot: 'evening' }
      ];
      const report = reportTimes.find(r => r.key === slotKey);
      if (report && window.CheckinReport?.submitReport) {
        window.CheckinReport.submitReport(report, taskCount);
      }
    } else if (action === 'report-later') {
      // 稍后提醒 - 关闭弹框即可，等待下次重试
      console.log('[Report] 用户选择稍后提醒');
    }
    return;
  }

  if (batchId) {
    if (action === 'open-panel') {
      const view = targetView === 'my-review' ? 'my-review' : 'review';
      switchAppView(view);
      const attempt = (triesLeft = 10) => {
        const selectorValue = String(batchId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const container = view === 'my-review' ? elements.myReviewList : elements.reviewList;
        const card = container?.querySelector?.(`[data-batch-id="${selectorValue}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const prevOutline = card.style.outline;
          const prevOutlineOffset = card.style.outlineOffset;
          card.style.outline = '3px solid #f59e0b';
          card.style.outlineOffset = '4px';
          window.setTimeout(() => {
            card.style.outline = prevOutline;
            card.style.outlineOffset = prevOutlineOffset;
          }, 2400);
          return;
        }
        if (triesLeft > 0) {
          window.setTimeout(() => attempt(triesLeft - 1), 220);
        }
      };
      attempt();
    }
    return;
  }

  if (!rowNumber) {
    return;
  }
  if (typeof note === 'string') {
    setReviewNoteDraft(rowNumber, note);
  }
  if (action === 'approve') {
    handleApproveReview(rowNumber, note);
    return;
  }
  if (action === 'need-change') {
    handleSuggestionReview(rowNumber, REVIEW_STATUS.NEEDS_CHANGE, note);
    return;
  }
  if (action === 'partial-change') {
    handleSuggestionReview(rowNumber, REVIEW_STATUS.PARTIAL_CHANGE, note);
    return;
  }
  if (action === 'cancel') {
    handleReopenReview(rowNumber, REVIEW_STATUS.CANCELLED, note);
    return;
  }
  if (action === 'mark-updated') {
    handleReopenReview(rowNumber, REVIEW_STATUS.UPDATED, note);
  }
});

startReviewPolling();
window.addEventListener('beforeunload', stopReviewPolling);
document.addEventListener('pointerdown', primeAudioContext, { once: true });
elements.globalAlert?.addEventListener('click', hideGlobalMessage);
document.addEventListener('keydown', primeAudioContext, { once: true });

elements.openDrive.addEventListener('click', async () => {
  const folderId = elements.driveFolderId.value.trim();
  if (!folderId) {
    appendLog({ status: 'error', message: '请先填写 Drive 文件夹 ID' });
    return;
  }
  await window.bridge.openDriveFolder(folderId);
});

elements.renamePattern.addEventListener('input', () => {
  state.config.renamePattern = elements.renamePattern.value.trim() || DEFAULT_PATTERN;
  debouncedPreview();
});

[
  elements.dateFormat,
  elements.counterStart,
  elements.counterPadding,
  elements.counterStep,
  elements.naming.country,
  elements.naming.date,
  elements.naming.software,
  elements.metadata.submitter,
  elements.metadata.completedAt
].forEach((el) => {
  el.addEventListener('change', () => {
    updateNamingPreview();
    debouncedPreview();
  });
  el.addEventListener('input', () => {
    updateNamingPreview();
    debouncedPreview();
  });
});

elements.metadata.submitter.addEventListener('change', persistSubmitter);
elements.metadata.submitter.addEventListener('blur', persistSubmitter); // 🔴 确保失焦时也保存
elements.metadata.submitter.addEventListener('input', () => {
  renderSubmitterSuggestions();
});
const REVIEW_STATUS = {
  APPROVED: '已审核通过',
  UPDATED: '已更新修改',
  PENDING: '待审核',
  NEEDS_CHANGE: '需要修改',
  PARTIAL_CHANGE: '一部分需要修改',
  CANCELLED: '已取消'
};
const REVIEW_STATUS_ALIASES = {
  已通过: REVIEW_STATUS.APPROVED,
  审核通过: REVIEW_STATUS.APPROVED,
  通过: REVIEW_STATUS.APPROVED,
  已审核通过: REVIEW_STATUS.APPROVED,
  等待审核: REVIEW_STATUS.PENDING,
  审核中: REVIEW_STATUS.PENDING,
  待处理: REVIEW_STATUS.PENDING,
  已提交: REVIEW_STATUS.PENDING,
  需要修改: REVIEW_STATUS.NEEDS_CHANGE,
  需修改: REVIEW_STATUS.NEEDS_CHANGE,
  修改: REVIEW_STATUS.NEEDS_CHANGE,
  部分合格: REVIEW_STATUS.PARTIAL_CHANGE,
  部分通过: REVIEW_STATUS.PARTIAL_CHANGE,
  已取消审核: REVIEW_STATUS.CANCELLED,
  已取消: REVIEW_STATUS.CANCELLED,
  取消审核: REVIEW_STATUS.CANCELLED
};
const REVIEW_STATUS_OPTIONS = [
  REVIEW_STATUS.APPROVED,
  REVIEW_STATUS.UPDATED,
  REVIEW_STATUS.PENDING,
  REVIEW_STATUS.NEEDS_CHANGE,
  REVIEW_STATUS.PARTIAL_CHANGE,
  REVIEW_STATUS.CANCELLED
];
const REVIEW_PENDING_STATUSES = new Set([REVIEW_STATUS.PENDING, REVIEW_STATUS.UPDATED]);
const REVIEW_SUGGESTION_STATUSES = new Set([REVIEW_STATUS.NEEDS_CHANGE, REVIEW_STATUS.PARTIAL_CHANGE]);

function normalizeReviewStatus(status = '') {
  const value = (status || '').trim();
  if (!value) {
    return '';
  }
  return REVIEW_STATUS_ALIASES[value] || value;
}

function matchesMyReviewStatusFilter(entry, filterKey) {
  const status = normalizeReviewStatus(entry.status);
  if (!status) {
    return false;
  }
  switch (filterKey) {
    case 'pending':
      return status === REVIEW_STATUS.PENDING || status === REVIEW_STATUS.UPDATED;
    case 'feedback':
      return status === REVIEW_STATUS.NEEDS_CHANGE;
    case 'approved':
      return status === REVIEW_STATUS.APPROVED;
    case 'partial':
      return status === REVIEW_STATUS.PARTIAL_CHANGE;
    case 'allStored':
      return status === REVIEW_STATUS.APPROVED || status === REVIEW_STATUS.PARTIAL_CHANGE;
    case 'cancelled':
      return status === REVIEW_STATUS.CANCELLED;
    default:
      return true;
  }
}
function persistMyReviewSortPreference(sort) {
  try {
    localStorage.setItem(MY_REVIEW_SORT_STORAGE_KEY, JSON.stringify(sort));
  } catch (error) {
    console.error('Failed to save my-review sort preference', error);
  }
}

function restoreMyReviewSortPreference() {
  try {
    const stored = localStorage.getItem(MY_REVIEW_SORT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        state.myReviewSort = {
          mode: parsed.mode || 'priority'
        };
      }
    }
  } catch (error) {
    console.error('Failed to restore my-review sort preference', error);
  }
  updateMyReviewSortControls();
}

function updateMyReviewSortControls() {
  if (elements.myReviewSortMode) {
    elements.myReviewSortMode.value = state.myReviewSort?.mode || 'priority';
  }
}

function setMyReviewSortMode(mode) {
  const normalized = ['priority', 'date-desc', 'date-asc', 'category-asc', 'category-desc'].includes(mode)
    ? mode
    : 'priority';
  state.myReviewSort.mode = normalized;
  updateMyReviewSortControls();
  persistMyReviewSortPreference(state.myReviewSort);
  renderSubmitterSuggestions();
}
function persistReviewRangeMode(mode) {
  try {
    localStorage.setItem(REVIEW_RANGE_STORAGE_KEY, mode);
  } catch (error) {
    console.error('Failed to save review range preference', error);
  }
}

function restoreReviewRangeMode() {
  try {
    const stored = localStorage.getItem(REVIEW_RANGE_STORAGE_KEY);
    if (stored) {
      state.reviewRangeMode = normalizeReviewRangeMode(stored);
    }
  } catch (error) {
    console.error('Failed to restore review range preference', error);
  }
  updateReviewRangeControls();
}

function updateReviewRangeControls() {
  if (elements.reviewRangeMode) {
    elements.reviewRangeMode.value = normalizeReviewRangeMode(state.reviewRangeMode);
  }
}

function setReviewRangeMode(mode) {
  state.reviewRangeMode = normalizeReviewRangeMode(mode);
  state.reviewPage = 1;
  updateReviewRangeControls();
  persistReviewRangeMode(state.reviewRangeMode);
  renderReviewEntries();
}

// ============================================
// 极简模式功能
// ============================================

/**
 * 初始化极简模式
 */
function initMinimalistMode() {
  const stored = localStorage.getItem('minimalist-mode');
  const enabled = stored === 'true';
  setMinimalistMode(enabled, { skipPersist: true });
}

/**
 * 设置极简模式
 */
function setMinimalistMode(enabled, options = {}) {
  const { skipPersist = false } = options;
  state.minimalistMode = Boolean(enabled);

  // 更新 app-shell 类名
  const appShell = document.querySelector('.app-shell');
  if (appShell) {
    appShell.classList.toggle('minimalist-mode', state.minimalistMode);
  }

  // 更新按钮显示状态
  updateMinimalistModeButtons();
  const miniUploadBtn = document.getElementById('minimalist-upload-btn');
  const miniUploadFab = document.getElementById('minimalist-upload-fab');
  if (miniUploadBtn) {
    miniUploadBtn.style.display = state.minimalistMode ? 'inline-flex' : 'none';
  }
  if (miniUploadFab) {
    miniUploadFab.style.display = state.minimalistMode ? 'inline-flex' : 'none';
  }

  // 持久化设置
  if (!skipPersist) {
    localStorage.setItem('minimalist-mode', String(state.minimalistMode));
  }
}

/**
 * 更新极简模式按钮的显示状态
 */
function updateMinimalistModeButtons() {
  const normalBtn = document.getElementById('minimalist-mode-toggle-normal');
  const minimalBtn = document.getElementById('minimalist-mode-toggle-minimal');
  const miniUploadBtn = document.getElementById('minimalist-upload-btn');
  const miniUploadFab = document.getElementById('minimalist-upload-fab');

  if (normalBtn) {
    normalBtn.hidden = state.minimalistMode;
    normalBtn.title = state.minimalistMode ? '' : '切换到极简模式';
  }

  if (minimalBtn) {
    minimalBtn.hidden = !state.minimalistMode;
  }

  if (miniUploadBtn) {
    miniUploadBtn.style.display = state.minimalistMode ? 'inline-flex' : 'none';
  }
  if (miniUploadFab) {
    miniUploadFab.style.display = state.minimalistMode ? 'inline-flex' : 'none';
  }
}

/**
 * 切换极简模式
 */
function toggleMinimalistMode() {
  setMinimalistMode(!state.minimalistMode);
}

/**
 * 绑定极简模式切换事件
 */
function bindMinimalistModeToggle() {
  const normalBtn = document.getElementById('minimalist-mode-toggle-normal');
  const minimalBtn = document.getElementById('minimalist-mode-toggle-minimal');
  const miniUploadBtn = document.getElementById('minimalist-upload-btn');
  const miniUploadFab = document.getElementById('minimalist-upload-fab');

  if (normalBtn) {
    normalBtn.addEventListener('click', toggleMinimalistMode);
  }

  if (minimalBtn) {
    minimalBtn.addEventListener('click', toggleMinimalistMode);
  }

  if (miniUploadBtn) {
    miniUploadBtn.addEventListener('click', () => handleUpload());
  }
  if (miniUploadFab) {
    miniUploadFab.addEventListener('click', () => handleUpload());
  }
}


/**
 * 确保预定义的customText存在
 */
function ensurePredefinedCustomTexts() {
  let needsSync = false;

  // 遍历默认定义,确保都存在
  DEFAULT_CUSTOM_TEXT_DEFS.forEach((defaultDef) => {
    const exists = state.customTextDefs.some(def => def.id === defaultDef.id);

    if (!exists) {
      state.customTextDefs.push({ ...defaultDef });
      console.log('[ensurePredefinedCustomTexts] Added:', defaultDef.label, defaultDef);
      needsSync = true;

      // 如果是全局的,设置默认值
      if (defaultDef.scope === CUSTOM_TEXT_SCOPE.GLOBAL && DEFAULT_CUSTOM_TEXT_GLOBALS[defaultDef.id]) {
        state.customTextGlobals[defaultDef.id] = DEFAULT_CUSTOM_TEXT_GLOBALS[defaultDef.id];
      }
    }
  });

  if (needsSync) {
    syncCustomTextConfig();
  }
}

/**
 * 确保预定义的命名预设存在
 */
function ensurePredefinedNamingPresets() {
  // 检查并添加图片组文件夹命名规范
  const folderPresetExists = state.folderNamingPresets.some(p => p.pattern === '{{customDate}}-{{pageName}}-{{admin}}');
  if (!folderPresetExists) {
    const preset = BUILT_IN_FOLDER_PRESETS.find(p => p.label === '图片组文件夹命名规范');
    if (preset) {
      state.folderNamingPresets.push({
        id: `preset-folder-${Date.now()}`,
        label: preset.label,
        pattern: preset.pattern
      });
      console.log('[ensurePredefinedNamingPresets] Added 图片组文件夹命名规范');
    }
  }

  // 检查并添加图片组图片命名规范
  const imgGroupPattern = '{{pageName}}-{{zb}}-{{admin}}-{{submitter}}-{{subjectOrOriginal}}-{{customDate}}-{{distribution}}';
  const preset1Exists = state.namingPresets.some(p => p.pattern === imgGroupPattern);
  if (!preset1Exists) {
    const preset = BUILT_IN_NAMING_PRESETS.find(p => p.pattern === imgGroupPattern);
    if (preset) {
      state.namingPresets.push({
        id: `preset-naming-${Date.now()}-1`,
        label: preset.label,
        pattern: preset.pattern
      });
      console.log('[ensurePredefinedNamingPresets] Added 图片组图片命名');
    }
  }

  // 检查并添加普通命名规范
  const normalPattern = '{{customDate}}-{{subject}}-{{counter}}';
  const preset2Exists = state.namingPresets.some(p => p.pattern === normalPattern);
  if (!preset2Exists) {
    const preset = BUILT_IN_NAMING_PRESETS.find(p => p.pattern === normalPattern);
    if (preset) {
      state.namingPresets.push({
        id: `preset-naming-${Date.now()}-2`,
        label: preset.label,
        pattern: preset.pattern
      });
      console.log('[ensurePredefinedNamingPresets] Added 普通命名规范');
    }
  }
}

// 在现有代码加载后初始化极简模式
(function initializeMinimalistMode() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initMinimalistMode();
      bindMinimalistModeToggle();
    });
  } else {
    initMinimalistMode();
    bindMinimalistModeToggle();
  }
})();

// ============================================
// Header 收起/展开功能
// ============================================

/**
 * 初始化 header 收起状态
 */
function initHeaderState() {
  const stored = localStorage.getItem('header-collapsed');
  const collapsed = stored === 'true';
  setHeaderCollapsed(collapsed, { skipPersist: true });
}

/**
 * 设置 header 收起/展开状态
 */
function setHeaderCollapsed(collapsed, options = {}) {
  const { skipPersist = false } = options;
  state.headerCollapsed = Boolean(collapsed);

  // 更新 app-shell 类名
  const appShell = document.querySelector('.app-shell');
  if (appShell) {
    appShell.classList.toggle('header-collapsed', state.headerCollapsed);
  }

  // 更新按钮显示状态
  updateHeaderToggleButtons();

  // 持久化设置
  if (!skipPersist) {
    localStorage.setItem('header-collapsed', String(state.headerCollapsed));
  }
}

/**
 * 更新 header 切换按钮的显示状态
 */
function updateHeaderToggleButtons() {
  const toggleBtn = document.getElementById('toggle-header');

  if (toggleBtn) {
    toggleBtn.title = state.headerCollapsed ? '展开顶栏' : '收起顶栏';
    toggleBtn.setAttribute('aria-label', state.headerCollapsed ? '展开顶栏' : '收起顶栏');
  }
}

/**
 * 切换 header 收起/展开
 */
function toggleHeaderCollapsed() {
  setHeaderCollapsed(!state.headerCollapsed);
}

/**
 * 绑定 header 收起/展开事件
 */
function bindHeaderToggle() {
  const toggleBtn = document.getElementById('toggle-header');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleHeaderCollapsed);
  }
}

// 在现有代码加载后初始化 header 状态
(function initializeHeaderToggle() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initHeaderState();
      bindHeaderToggle();
    });
  } else {
    initHeaderState();
    bindHeaderToggle();
  }
})();

// ============================================
// 设置页面侧边栏标签切换
// ============================================

/**
 * 切换设置页面的标签
 */
function switchSettingsTab(tabName) {
  const target = document.querySelector(`.settings-nav-item[data-settings-tab="${tabName}"]`);
  if (!target) {
    tabName = 'basic';
  }
  // 更新侧边栏导航按钮状态
  document.querySelectorAll('.settings-nav-item').forEach(btn => {
    const isActive = btn.dataset.settingsTab === tabName;
    btn.classList.toggle('active', isActive);
  });

  // 更新设置面板显示状态
  document.querySelectorAll('.settings-panel').forEach(panel => {
    const isActive = panel.dataset.settingsPanel === tabName;
    panel.classList.toggle('active', isActive);
  });

  // 保存当前选中的标签
  try {
    localStorage.setItem('active-settings-tab', tabName);
  } catch (error) {
    console.warn('Failed to save settings tab preference', error);
  }
}

/**
 * 绑定设置侧边栏事件
 */
function bindSettingsSidebar() {
  const navItems = document.querySelectorAll('.settings-nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.settingsTab;
      if (tabName) {
        switchSettingsTab(tabName);
      }
    });
  });
}

/**
 * 初始化设置侧边栏
 */
function initSettingsSidebar() {
  // 尝试恢复上次选中的标签
  const savedTab = localStorage.getItem('active-settings-tab');
  const defaultTab = 'basic';
  switchSettingsTab(savedTab || defaultTab);
}

// 在现有代码加载后初始化设置侧边栏
(function initializeSettingsSidebar() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSettingsSidebar();
      bindSettingsSidebar();
    });
  } else {
    initSettingsSidebar();
    bindSettingsSidebar();
  }
})();

// 为审核面板的文件预览添加hover事件处理(使用与上传面板相同的机制)
function setupReviewFilePreviewHandlers(container) {
  if (!container) return;

  // 复用上传面板的全局预览窗口
  let globalPreview = document.getElementById('global-file-preview');
  if (!globalPreview) {
    globalPreview = document.createElement('div');
    globalPreview.id = 'global-file-preview';
    globalPreview.className = 'slot-grid-file-preview';
    globalPreview.innerHTML = `
      <div class="slot-grid-preview-image"></div>
      <div class="slot-grid-preview-info">
        <div class="slot-grid-preview-name"></div>
        <div class="slot-grid-preview-rename"></div>
      </div>
    `;
    document.body.appendChild(globalPreview);
  }

  // 为所有缩略图按钮添加预览
  container.querySelectorAll('.review-file-thumbnail-btn').forEach(btn => {
    const thumbnail = btn.querySelector('.review-file-thumbnail');
    if (!thumbnail) return;
    const fileLink = btn.dataset.openUrl || '';
    const fileName = btn.parentElement?.querySelector('.review-file-name')?.textContent || '';
    const openFromButton = () => {
      if (fileLink) {
        openExternalLink(fileLink);
      }
    };

    // 允许点击视频控件而不触发打开链接
    thumbnail.querySelectorAll('video').forEach(video => {
      video.addEventListener('click', (e) => e.stopPropagation());
      video.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFromButton();
      });
    });

    btn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFromButton();
      }
    });

    btn.addEventListener('mouseenter', () => {
      // 获取缩略图内容
      const thumbnailImg = thumbnail.querySelector('img');
      const thumbnailVideo = thumbnail.querySelector('video');

      const globalImage = globalPreview.querySelector('.slot-grid-preview-image');
      const globalName = globalPreview.querySelector('.slot-grid-preview-name');
      const globalRename = globalPreview.querySelector('.slot-grid-preview-rename');

      // 判断是否为视频文件（通过文件名或链接）
      const lowerFileName = fileName.toLowerCase();
      const isVideoFile = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv'].some(ext => lowerFileName.endsWith(ext));
      const isCloudFile = fileLink && (() => { try { const h = new URL(fileLink).hostname; return h.endsWith('.google.com') || h.endsWith('.googleapis.com'); } catch (e) { return false; } })();

      // 设置预览内容
      if (thumbnailVideo) {
        // 有video标签的本地视频
        const videoSrc = thumbnailVideo.src;
        const isCloudVideo = (() => { try { const h = new URL(videoSrc).hostname; return h.endsWith('.google.com') || h.endsWith('.googleapis.com'); } catch (e) { return false; } })();

        if (isCloudVideo) {
          // 云端视频：显示放大的缩略图
          const posterSrc = thumbnailVideo.poster;
          if (posterSrc) {
            const fullPosterSrc = posterSrc.replace('sz=w100', 'sz=w800');
            globalImage.innerHTML = `
              <div class="cloud-video-preview">
                <img src="${fullPosterSrc}" alt="${escapeHtml(fileName)}" />
                <div class="cloud-video-overlay">
                  <div class="cloud-video-icon">▶</div>
                  <div class="cloud-video-hint">双击在浏览器中查看完整视频</div>
                </div>
              </div>
            `;
          } else {
            globalImage.innerHTML = `
              <div class="cloud-video-preview no-thumbnail">
                <div class="cloud-video-icon">▶</div>
                <div class="cloud-video-hint">双击在浏览器中查看完整视频</div>
              </div>
            `;
          }
        } else {
          // 本地视频：直接播放
          globalImage.innerHTML = `<video src="${videoSrc}" controls muted autoplay loop playsinline preload="auto"></video>`;
        }
      } else if (thumbnailImg && isVideoFile && isCloudFile) {
        // 云端视频用img标签显示的情况
        const fullSrc = thumbnailImg.src.replace('sz=w100', 'sz=w800');
        globalImage.innerHTML = `
          <div class="cloud-video-preview">
            <img src="${fullSrc}" alt="${escapeHtml(fileName)}" />
            <div class="cloud-video-overlay">
              <div class="cloud-video-icon">▶</div>
              <div class="cloud-video-hint">双击在浏览器中查看完整视频</div>
            </div>
          </div>
        `;
      } else if (thumbnailImg) {
        // 普通图片
        const fullSrc = thumbnailImg.src.replace('sz=w100', 'sz=w800');
        globalImage.innerHTML = `<img src="${fullSrc}" alt="${escapeHtml(fileName)}" />`;
      } else {
        const badge = thumbnail.querySelector('.review-file-badge');
        if (badge) {
          globalImage.textContent = badge.textContent;
        }
      }

      if (globalName) {
        globalName.textContent = `文件: ${fileName}`;
      }
      if (globalRename && fileLink) {
        globalRename.textContent = '双击打开云端文件';
      } else if (globalRename) {
        globalRename.textContent = '';
      }
      globalPreview.dataset.openUrl = fileLink || '';

      // 计算位置，与上传面板保持一致的展示逻辑
      const rect = btn.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const spaceAbove = rect.top;
      const spaceBelow = windowHeight - rect.bottom;
      const horizontalMargin = 20;
      const verticalMargin = 5;
      const infoAreaHeight = 60;
      const maxWidth = Math.min(800, windowWidth - horizontalMargin * 2);
      let maxHeight;
      let previewTop;
      let transformValue;
      let showAbove;

      if (spaceAbove > spaceBelow && spaceAbove > 200) {
        showAbove = true;
        const availableHeight = (spaceAbove - verticalMargin) * 0.9;
        maxHeight = Math.min(800, Math.max(250 + infoAreaHeight, availableHeight));
        previewTop = rect.top - verticalMargin;
        transformValue = 'translate(-50%, -100%)';
      } else {
        showAbove = false;
        const availableHeight = (spaceBelow - verticalMargin) * 0.9;
        maxHeight = Math.min(800, Math.max(250 + infoAreaHeight, availableHeight));
        previewTop = rect.bottom + verticalMargin;
        transformValue = 'translate(-50%, 0)';
      }

      let previewLeft = rect.left + rect.width / 2;
      const halfPreviewWidth = maxWidth / 2;
      if (previewLeft - halfPreviewWidth < horizontalMargin) {
        previewLeft = halfPreviewWidth + horizontalMargin;
      } else if (previewLeft + halfPreviewWidth > windowWidth - horizontalMargin) {
        previewLeft = windowWidth - halfPreviewWidth - horizontalMargin;
      }

      globalPreview.style.top = `${previewTop}px`;
      globalPreview.style.left = `${previewLeft}px`;
      globalPreview.style.transform = transformValue;
      globalPreview.style.maxWidth = `${maxWidth}px`;
      globalPreview.style.maxHeight = `${maxHeight}px`;

      const imageHeight = maxHeight - infoAreaHeight - 10;
      const globalImageArea = globalPreview.querySelector('.slot-grid-preview-image');
      if (globalImageArea) {
        globalImageArea.style.height = `${imageHeight}px`;
        globalImageArea.style.maxHeight = `${imageHeight}px`;
      }

      if (showAbove) {
        globalPreview.setAttribute('data-position', 'above');
      } else {
        globalPreview.setAttribute('data-position', 'below');
      }

      setTimeout(() => {
        if (btn.matches(':hover')) {
          globalPreview.classList.add('visible');
        }
      }, 500);
    });

    btn.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!btn.matches(':hover') && !globalPreview.matches(':hover')) {
          globalPreview.classList.remove('visible');
        }
      }, 100);
    });
  });

  // 为全局预览窗口添加鼠标事件
  if (globalPreview) {
    globalPreview.addEventListener('mouseenter', () => {
      globalPreview.classList.add('visible');
    });

    globalPreview.addEventListener('mouseleave', () => {
      setTimeout(() => {
        const anyItemHovered = container.querySelector('.review-file-thumbnail-btn:hover');
        if (!anyItemHovered && !globalPreview.matches(':hover')) {
          globalPreview.classList.remove('visible');
        }
      }, 100);
    });

    if (!globalPreview.dataset.reviewDblclickBound) {
      globalPreview.addEventListener('dblclick', (event) => {
        const url = globalPreview.dataset.openUrl;
        if (!url) return;
        event.preventDefault();
        openExternalLink(url);
      });
      globalPreview.dataset.reviewDblclickBound = 'true';
    }
  }
}

// ==================== 信息板功能 ====================

/**
 * 从 Google 文档 URL 或 ID 中提取文档 ID
 */
function extractGoogleDocId(input) {
  if (!input) return "";
  const trimmed = input.trim();
  // 匹配完整 URL 中的文档 ID
  const match = trimmed.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // 如果看起来已经是 ID 格式，直接返回
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

/**
 * 渲染信息板内容
 */
function renderNoticeBoard() {
  const docId = extractGoogleDocId(state.config.noticeBoardDocId || "");

  if (!docId) {
    // 显示未配置提示
    elements.noticeBoard.content.innerHTML = `
      <div class="notice-board-placeholder">
        <div class="notice-board-icon">📄</div>
        <h3>未配置信息板文档</h3>
        <p>请在设置中配置 Google 文档链接或 ID</p>
        <ul class="notice-board-steps">
          <li>打开您的 Google 文档</li>
          <li>设置文档权限为"知道链接的任何人都可以查看"</li>
          <li>复制文档链接或从链接中提取文档 ID</li>
          <li>在设置页面的"信息板配置"中粘贴文档 ID</li>
        </ul>
      </div>
    `;
    if (elements.noticeBoard.openDocBtn) {
      elements.noticeBoard.openDocBtn.hidden = true;
    }
    return;
  }

  // 显示加载状态
  elements.noticeBoard.content.innerHTML = `
    <div class="notice-board-loading">
      正在加载信息板...
    </div>
  `;

  // 渲染 iframe
  setTimeout(() => {
    // 使用 edit 模式并添加 embedded 参数，可以显示左侧的大纲面板
    const previewUrl = `https://docs.google.com/document/d/${docId}/edit?embedded=true`;
    elements.noticeBoard.content.innerHTML = `
      <iframe src="${previewUrl}" allowfullscreen></iframe>
    `;

    // 显示"在浏览器中打开"按钮
    if (elements.noticeBoard.openDocBtn) {
      elements.noticeBoard.openDocBtn.hidden = false;
      elements.noticeBoard.openDocBtn.onclick = () => {
        const viewUrl = `https://docs.google.com/document/d/${docId}/edit`;
        window.bridge.openExternal(viewUrl);
      };
    }
  }, 100);
}

/**
 * 从配置加载信息板设置
 */
function loadNoticeBoardConfig(config) {
  if (elements.noticeBoard.docId) {
    elements.noticeBoard.docId.value = config.noticeBoardDocId || "";
  }
  if (elements.noticeBoard.autoOpen) {
    elements.noticeBoard.autoOpen.value = config.noticeBoardAutoOpen ? "true" : "false";
  }
}

/**
 * 检查信息板是否有更新
 */
async function checkNoticeBoardUpdate() {
  const docId = extractGoogleDocId(state.config.noticeBoardDocId || "");
  if (!docId) {
    console.log('[NoticeBoard] 未配置文档 ID，跳过更新检查');
    return;
  }

  if (!state.authorized) {
    console.log('[NoticeBoard] 未授权，跳过更新检查');
    return;
  }

  try {
    console.log('[NoticeBoard] 开始检查更新，文档 ID:', docId);
    const result = await window.bridge.checkNoticeBoardUpdate(docId);

    if (!result) {
      console.warn('[NoticeBoard] API 调用失败，未返回结果');
      return;
    }

    if (!result.modifiedTime) {
      console.warn('[NoticeBoard] API 返回数据无效，缺少 modifiedTime');
      return;
    }

    console.log('[NoticeBoard] 文档信息:', result.name, '修改时间:', result.modifiedTime);

    // 获取上次查看时间
    const lastViewKey = `noticeBoard_lastView_${docId}`;
    const lastViewTime = localStorage.getItem(lastViewKey);

    const modifiedTime = new Date(result.modifiedTime).getTime();
    const lastView = lastViewTime ? new Date(lastViewTime).getTime() : null;

    console.log('[NoticeBoard] 修改时间戳:', modifiedTime);
    console.log('[NoticeBoard] 上次查看:', lastView ? new Date(lastView).toLocaleString() : '从未查看');

    // 如果从未查看过，初始化为当前修改时间，不显示红点
    if (!lastView) {
      console.log('[NoticeBoard] 首次使用，初始化查看时间为文档修改时间');
      localStorage.setItem(lastViewKey, result.modifiedTime);
      hideNoticeBoardBadge();
      return;
    }

    // 如果文档修改时间晚于上次查看时间，显示红点和横幅
    if (modifiedTime > lastView) {
      console.log('[NoticeBoard] 检测到更新！显示红点和横幅');
      showNoticeBoardBadge({
        name: result.name,
        modifiedTime: result.modifiedTime
      });
      // 同时显示横幅（仅在信息板视图中显示）
      if (state.activeView === 'notice-board') {
        showUpdateBanner({
          name: result.name,
          modifiedTime: result.modifiedTime
        });
      }
    } else {
      console.log('[NoticeBoard] 无更新，隐藏红点和横幅');
      hideNoticeBoardBadge();
      hideUpdateBanner();
    }
  } catch (error) {
    console.error('[NoticeBoard] 检查更新失败:', error);
  }
}


/**
 * 显示信息板红点徽章
 * @param {Object} updateInfo - 更新信息 { name: 文档名称, modifiedTime: 修改时间 }
 */
function showNoticeBoardBadge(updateInfo = null) {
  const tab = document.querySelector('.view-tab[data-view="notice-board"]');
  if (!tab) return;

  // 避免重复添加
  if (tab.querySelector('.notice-badge')) return;

  const badge = document.createElement('span');
  badge.className = 'notice-badge';
  badge.setAttribute('aria-label', '有新内容');

  // 如果有更新信息，添加详细的 tooltip
  if (updateInfo && updateInfo.modifiedTime) {
    const updateTime = new Date(updateInfo.modifiedTime);
    const now = new Date();
    const diffMs = now - updateTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // 调试日志
    console.log('[NoticeBoard Badge] 更新时间 (UTC):', updateInfo.modifiedTime);
    console.log('[NoticeBoard Badge] 更新时间 (本地):', updateTime.toLocaleString());
    console.log('[NoticeBoard Badge] 当前时间 (本地):', now.toLocaleString());
    console.log('[NoticeBoard Badge] 时间差 (毫秒):', diffMs);
    console.log('[NoticeBoard Badge] 时间差 (分钟):', diffMinutes);

    let timeAgo = '';
    if (diffDays > 0) {
      timeAgo = `${diffDays}天前`;
    } else if (diffHours > 0) {
      timeAgo = `${diffHours}小时前`;
    } else if (diffMinutes > 0) {
      timeAgo = `${diffMinutes}分钟前`;
    } else {
      timeAgo = '刚刚';
    }

    const docName = updateInfo.name || '文档';
    const tooltip = `${docName}\n更新时间：${updateTime.toLocaleString()}\n(${timeAgo}更新)`;

    tab.setAttribute('title', tooltip);
    badge.setAttribute('title', tooltip);
  } else {
    tab.setAttribute('title', '有新内容');
  }

  tab.appendChild(badge);
  tab.classList.add('has-update');
}

/**
 * 隐藏信息板红点徽章
 */
function hideNoticeBoardBadge() {
  const tab = document.querySelector('.view-tab[data-view="notice-board"]');
  if (!tab) return;

  const badge = tab.querySelector('.notice-badge');
  if (badge) {
    badge.remove();
  }
  tab.classList.remove('has-update');
}

/**
 * 标记信息板为已读
 */
function markNoticeBoardAsRead() {
  const docId = extractGoogleDocId(state.config.noticeBoardDocId || "");
  if (!docId) return;

  const lastViewKey = `noticeBoard_lastView_${docId}`;
  localStorage.setItem(lastViewKey, new Date().toISOString());
  hideNoticeBoardBadge();
}

/**
 * 绑定信息板相关事件
 */
function bindNoticeBoardEvents() {
  // 刷新按钮
  if (elements.noticeBoard.refreshBtn) {
    elements.noticeBoard.refreshBtn.addEventListener("click", () => {
      renderNoticeBoard();
      appendLog({ status: "success", message: "信息板已刷新" });
    });
  }

  // "知道了"按钮
  if (elements.noticeBoard.dismissBtn) {
    elements.noticeBoard.dismissBtn.addEventListener("click", () => {
      dismissUpdateBanner();
    });
  }

  // 监听配置变化
  if (elements.noticeBoard.docId) {
    elements.noticeBoard.docId.addEventListener("change", () => {
      // 保存时会自动触发渲染
    });
  }
}

// 在应用启动时调用
(function initializeNoticeBoard() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindNoticeBoardEvents();
    });
  } else {
    bindNoticeBoardEvents();
  }
})();


/**
 * 显示更新横幅
 * @param {Object} updateInfo - 更新信息 { name, modifiedTime }
 */
function showUpdateBanner(updateInfo) {
  if (!elements.noticeBoard.updateBanner || !elements.noticeBoard.updateBannerInfo) {
    return;
  }

  const updateTime = new Date(updateInfo.modifiedTime);
  const now = new Date();
  const diffMs = now - updateTime;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let timeAgo = '';
  if (diffDays > 0) {
    timeAgo = `${diffDays}天前`;
  } else if (diffHours > 0) {
    timeAgo = `${diffHours}小时前`;
  } else if (diffMinutes > 0) {
    timeAgo = `${diffMinutes}分钟前`;
  } else {
    timeAgo = '刚刚';
  }

  const docName = updateInfo.name || '文档';
  elements.noticeBoard.updateBannerInfo.textContent = `${docName} · 更新于 ${timeAgo} (${updateTime.toLocaleString()})`;
  elements.noticeBoard.updateBanner.hidden = false;
}

/**
 * 隐藏更新横幅
 */
function hideUpdateBanner() {
  if (elements.noticeBoard.updateBanner) {
    elements.noticeBoard.updateBanner.hidden = true;
  }
}

/**
 * 标记为已读并隐藏横幅
 */
function dismissUpdateBanner() {
  markNoticeBoardAsRead();
  hideUpdateBanner();
  hideNoticeBoardBadge();
  appendLog({ status: 'success', message: '已标记为已读' });
}

// ==================== 更多菜单逻辑 ====================
(function initMoreMenu() {
  const moreBtn = document.getElementById('more-menu-btn');
  const dropdown = document.getElementById('more-menu-dropdown');

  if (!moreBtn || !dropdown) return;

  // 切换下拉菜单
  function toggleDropdown(e) {
    e.stopPropagation();
    const isHidden = dropdown.hasAttribute('hidden');
    if (isHidden) {
      dropdown.removeAttribute('hidden');
    } else {
      dropdown.setAttribute('hidden', '');
    }
  }

  // 关闭下拉菜单
  function closeDropdown() {
    dropdown.setAttribute('hidden', '');
  }

  // 点击"更多"按钮
  moreBtn.addEventListener('click', toggleDropdown);

  // 点击菜单项
  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.more-menu-item');
    if (!item) return;

    const action = item.dataset.action;

    // 触发对应按钮的点击
    switch (action) {
      case 'export':
        document.getElementById('slot-preset-export')?.click();
        break;
      case 'import':
        document.getElementById('slot-preset-import')?.click();
        break;
      case 'reset':
        document.getElementById('slot-preset-reset')?.click();
        break;
      case 'group':
        document.getElementById('toggle-slot-group')?.click();
        break;
      case 'sync':
        document.getElementById('sync-categories')?.click();
        break;
      case 'export-review':
        exportReviewSlots();
        break;
      case 'import-review':
        importReviewSlots();
        break;
    }

    closeDropdown();
  });

  // 点击外部关闭
  document.addEventListener('click', (e) => {
    if (!moreBtn.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
  });
})();

// ========== 组内媒体查看功能 ==========

(function initGroupMedia() {
  // 全局状态
  let gmCurrentView = 'browse';
  let gmMediaRecords = [];
  let gmCurrentFolderId = null;
  let gmCurrentRecord = null;
  let gmRootFolderId = null;
  let gmBaseRecord = null;
  let gmRootLabel = '';
  const gmFolderCache = new Map(); // 缓存已加载的文件夹，避免重复请求大目录
  const gmFolderTreeCache = new Map(); // 文件夹树缓存
  const gmExpandedFolders = new Set(); // 已展开的节点
  const gmFolderOptionsMap = new Map();
  const GM_FILE_INDEX_STORAGE_KEY = 'gm-file-index-cache';
  const GM_FILE_INDEX_MAX_AGE = 6 * 60 * 60 * 1000; // 6 小时
  const GM_FILE_INDEX_MAX_RESULTS = 50000; // 预索引文件上限
  let GM_INDEX_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 分钟增量刷新，可配置
  let gmEnableIndexTimer = true;
  let gmForceFolderRefresh = false;
  let gmFileIndex = null; // 全局文件索引（包含所有记录的文件）
  let gmFileIndexTimestamp = 0;
  let gmFileIndexStale = false;
  let gmFileIndexPromise = null;
  let gmFileIndexStatus = 'idle'; // idle|building|ready|error
  let gmFileIndexSaveTimer = null;
  const GM_DEFAULT_OPTIONS = { recursive: true, maxResults: 50 }; // 默认包含子文件夹，限制50条以提升初次速度
  const GM_THUMB_SIZES = { small: 90, medium: 130, large: 170 };
  const GM_THUMB_CACHE_SIZE = 260; // 统一的缓存尺寸，避免同一文件生成多份缩略图
  const GM_THUMB_CONCURRENCY = 20; // 大幅提高并发,缓存加载很快
  let gmSelectedFiles = new Set();
  let gmCurrentFiles = [];
  let gmLoadingFiles = false; // 防止重复加载导致界面闪烁
  let gmCurrentLoadingId = 0; // 当前加载ID,用于检测加载是否被中断
  let gmThumbQueue = [];
  let gmThumbInflight = 0;
  const GM_THUMB_MAX_RETRIES = 2;

  // 预缓存队列
  let gmPrefetchQueue = [];
  let gmPrefetchInflight = 0;
  const GM_PREFETCH_CONCURRENCY = 3; // 同时预缓存3个
  let gmPrefetchPaused = false;
  let gmPrefetchEnabled = true; // 可在设置中关闭

  // 估算所需缓存空间
  async function gmEstimateCacheSize(fileCount) {
    const AVG_THUMB_SIZE = 80 * 1024; // 80KB 平均大小
    const estimatedBytes = fileCount * AVG_THUMB_SIZE;
    const estimatedMB = Math.ceil(estimatedBytes / (1024 * 1024));
    return { bytes: estimatedBytes, mb: estimatedMB };
  }

  // 检查缓存空间是否充足
  async function gmCheckCacheSpace(requiredMB) {
    const cacheInfo = await window.bridge?.getThumbCacheInfo?.();
    if (!cacheInfo) return { sufficient: false, currentMB: 0, maxMB: 2048 };

    const currentMB = Math.ceil(cacheInfo.total / (1024 * 1024));
    const maxMB = Math.ceil(cacheInfo.maxBytes / (1024 * 1024));
    const availableMB = maxMB - currentMB;

    return {
      sufficient: availableMB >= requiredMB,
      currentMB,
      maxMB,
      availableMB,
      requiredMB
    };
  }

  // 提示用户扩容
  async function gmPromptExpandCache(spaceCheck) {
    const { currentMB, maxMB, requiredMB, availableMB } = spaceCheck;
    const recommendedMaxMB = Math.max(maxMB, currentMB + requiredMB + 500);

    const confirmed = confirm(
      `缓存空间不足!\n\n` +
      `当前: ${currentMB} MB / ${maxMB} MB\n` +
      `可用: ${availableMB} MB\n` +
      `需要: ${requiredMB} MB\n\n` +
      `建议将缓存上限扩大至 ${recommendedMaxMB} MB\n\n` +
      `是否立即扩容?`
    );

    if (confirmed) {
      await window.bridge?.setThumbCacheMax?.(recommendedMaxMB * 1024 * 1024);
      gmUpdateThumbCacheInfo();
      return true;
    }
    return false;
  }
  let gmPreviewVisible = false; // 默认隐藏右侧预览面板，节省空间展示更多缩略图
  let gmRecordListVisible = false; // 记录卡片列表显隐，默认隐藏以留更多空间
  let gmPreviewRatio = 0.45; // 缩略图/预览分栏比例，支持拖拽调整
  let gmThumbSize = 'medium';

  function gmNormalizeFolderId(folderId) {
    return (folderId || '').trim();
  }

  function gmIsValidFolderId(folderId) {
    const id = gmNormalizeFolderId(folderId);
    if (!id || id === '.' || id === '..') return false;
    if (id.includes('/') || id.includes('\\')) return false;
    return id === 'root' || id.length >= 5;
  }

  // 快速提示（点击触发的小气泡）
  let gmHintTimer = null;
  function gmShowQuickHint(message, x = null, y = null) {
    const id = 'gm-quick-hint';
    let hint = document.getElementById(id);
    if (!hint) {
      hint = document.createElement('div');
      hint.id = id;
      hint.style.cssText = 'position: fixed; padding: 8px 12px; background: rgba(17,24,39,0.9); color: white; border-radius: 8px; font-size: 12px; pointer-events: none; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.2);';
      document.body.appendChild(hint);
    }
    hint.textContent = message;
    const posX = x ?? (window.innerWidth / 2);
    const posY = y ?? 80;
    hint.style.left = `${posX + 12}px`;
    hint.style.top = `${posY + 12}px`;
    hint.style.opacity = '1';
    if (gmHintTimer) clearTimeout(gmHintTimer);
    gmHintTimer = setTimeout(() => {
      hint.style.opacity = '0';
      gmHintTimer = setTimeout(() => hint.remove(), 200);
    }, 1400);
  }

  async function gmUpdateThumbCacheInfo() {
    if (!elements.thumbCacheInfo) return;
    try {
      const info = await window.bridge?.getThumbCacheInfo?.();
      if (!info) {
        elements.thumbCacheInfo.textContent = '未获取';
        return;
      }
      const mb = (info.total / (1024 * 1024)).toFixed(1);
      const maxMb = info.maxBytes ? (info.maxBytes / (1024 * 1024)).toFixed(0) : '—';
      elements.thumbCacheInfo.textContent = `${mb} MB / ${maxMb} MB · ${info.count || 0} 个`;
      if (elements.thumbCacheMax && !elements.thumbCacheMax.value) {
        elements.thumbCacheMax.value = maxMb;
      }
      if (elements.thumbCacheDir && !elements.thumbCacheDir.value) {
        elements.thumbCacheDir.value = info.dir || '';
      }
    } catch (err) {
      console.warn('获取缩略图缓存信息失败', err);
      elements.thumbCacheInfo.textContent = '获取失败';
    }
  }

  async function gmUpdateFileIndexInfo() {
    if (!elements.fileIndexInfo) return;
    try {
      const info = await window.bridge?.getFileIndexInfo?.();
      if (!info || !info.exists) {
        elements.fileIndexInfo.textContent = '未生成';
        elements.fileIndexInfo.style.color = '#94a3b8';
        return;
      }

      const mb = (info.size / (1024 * 1024)).toFixed(1);
      const date = new Date(info.mtime);
      const ts = isNaN(date) ? '' : date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      // 计算索引年龄
      const ageMs = Date.now() - (gmFileIndexTimestamp || date.getTime());
      const ageMinutes = Math.floor(ageMs / (1000 * 60));

      // 索引文件数量
      const fileCount = gmFileIndex ? gmFileIndex.length : 0;

      // 判断新鲜度
      let freshnessText = '';
      let freshnessColor = '';

      if (gmFileIndexStale || ageMinutes > 15) {
        freshnessText = '⚠️ 较旧，建议刷新';
        freshnessColor = '#f59e0b'; // 橙色警告
      } else if (ageMinutes < 2) {
        freshnessText = '✓ 最新';
        freshnessColor = '#10b981'; // 绿色
      } else {
        freshnessText = `${ageMinutes}分钟前`;
        freshnessColor = '#64748b'; // 灰色
      }

      // 组合显示文本
      elements.fileIndexInfo.innerHTML =
        `<span style="color: ${freshnessColor}; font-weight: 500;">${freshnessText}</span> · ` +
        `${fileCount} 个文件 · ${mb} MB · ${ts}`;

    } catch (err) {
      console.warn('获取文件索引信息失败', err);
      elements.fileIndexInfo.textContent = '获取失败';
      elements.fileIndexInfo.style.color = '#ef4444';
    }
  }

  function gmGetThumbMinWidth() {
    return GM_THUMB_SIZES[gmThumbSize] || GM_THUMB_SIZES.medium;
  }

  function gmApplyThumbGridStyle(grid) {
    if (!grid) return;
    const minW = gmGetThumbMinWidth();
    grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${minW}px, 1fr))`;
  }

  function gmGetThumbRequestSize() {
    const minW = gmGetThumbMinWidth();
    const displaySize = Math.max(200, Math.floor(minW * 2));
    return Math.max(GM_THUMB_CACHE_SIZE, displaySize);
  }

  async function gmResolveThumbUrl(fileId) {
    const requestSize = gmGetThumbRequestSize();
    const fallback = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${requestSize}`;
    if (!window.bridge) {
      console.warn('[Thumb] Bridge不可用,使用fallback');
      return fallback;
    }

    try {
      const startTime = Date.now();
      // 统一先查固定缓存尺寸，避免同一文件生成多份缩略图
      const candidateSizes = requestSize === GM_THUMB_CACHE_SIZE
        ? [GM_THUMB_CACHE_SIZE]
        : [GM_THUMB_CACHE_SIZE, requestSize];

      for (const size of candidateSizes) {
        const cached = await window.bridge.getThumbnailCached?.({ fileId, size });
        if (cached?.path) {
          const elapsed = Date.now() - startTime;
          console.log(`[Thumb] ✓ 缓存命中 ${fileId.substring(0, 8)} (${elapsed}ms)`);
          return cached.path.startsWith('file://') ? cached.path : `file://${cached.path}`;
        }
      }

      // 没缓存,先返回fallback,同时后台按固定尺寸触发下载(不等待)
      console.log(`[Thumb] ○ 无缓存 ${fileId.substring(0, 8)}, 触发后台下载`);
      window.bridge.cacheThumbnail?.({ fileId, size: GM_THUMB_CACHE_SIZE }).catch(err => {
        console.warn('[Thumb] 后台缓存失败:', fileId, err);
      });

      return fallback;
    } catch (err) {
      console.warn('[Thumb] 检查缓存失败:', err);
      return fallback;
    }
  }

  function gmProcessThumbQueue() {
    while (gmThumbInflight < GM_THUMB_CONCURRENCY && gmThumbQueue.length) {
      const job = gmThumbQueue.shift();
      gmThumbInflight++;
      (async () => {
        try {
          const url = await gmResolveThumbUrl(job.fileId);
          if (!job.img.isConnected) return;
          job.img.onload = () => {
            job.img.style.opacity = '1';
            job.img.style.background = 'transparent';
          };
          job.img.onerror = () => {
            if (job.retries < 2) {
              gmThumbQueue.push({ img: job.img, fileId: job.fileId, retries: job.retries + 1 });
            } else {
              job.img.style.background = '#e2e8f0';
            }
            gmThumbInflight--;
            gmProcessThumbQueue();
          };
          job.img.src = url;
        } catch (err) {
          console.warn('加载缩略图失败', err);
        } finally {
          gmThumbInflight = Math.max(0, gmThumbInflight - 1);
          gmProcessThumbQueue();
        }
      })();
    }
  }

  function gmLoadThumbImage(imgEl, fileId) {
    if (!imgEl || !fileId) return;
    gmThumbQueue.push({ img: imgEl, fileId, retries: 0 });
    gmProcessThumbQueue();
  }

  // 预缓存单个缩略图 (后台静默)
  async function gmPrefetchThumbnail(fileId, priority = 'low') {
    if (!gmPrefetchEnabled || gmPrefetchPaused || !fileId) return;

    // 检查是否已缓存
    const cached = await window.bridge?.getThumbnailCached?.({ fileId, size: GM_THUMB_CACHE_SIZE });
    if (cached?.path) return; // 已缓存,跳过

    // 添加到队列
    gmPrefetchQueue.push({ fileId, priority, retries: 0 });
    gmProcessPrefetchQueue();
  }

  // 处理预缓存队列
  function gmProcessPrefetchQueue() {
    // 按优先级排序: high > medium > low
    gmPrefetchQueue.sort((a, b) => {
      const priorityMap = { high: 3, medium: 2, low: 1 };
      return (priorityMap[b.priority] || 1) - (priorityMap[a.priority] || 1);
    });

    while (gmPrefetchInflight < GM_PREFETCH_CONCURRENCY && gmPrefetchQueue.length) {
      const job = gmPrefetchQueue.shift();
      gmPrefetchInflight++;

      (async () => {
        try {
          // 静默下载,不影响UI
          await window.bridge?.cacheThumbnail?.({ fileId: job.fileId, size: GM_THUMB_CACHE_SIZE });
          console.log('[Prefetch] 已缓存:', job.fileId);
        } catch (err) {
          if (job.retries < 1) {
            job.retries++;
            gmPrefetchQueue.push(job); // 重试一次
          }
          console.warn('[Prefetch] 缓存失败:', err);
        } finally {
          gmPrefetchInflight--;
          gmProcessPrefetchQueue();
        }
      })();
    }
  }

  // 批量预缓存
  async function gmPrefetchNewThumbnails(files = [], priority = 'medium') {
    if (!files || !files.length) return;

    console.log(`[Prefetch] 开始预缓存 ${files.length} 个文件`);

    for (const file of files) {
      if (file && file.id) {
        await gmPrefetchThumbnail(file.id, priority);
      }
    }
  }

  // 全量缓存所有文件
  async function gmCacheAllThumbnails() {
    if (!gmFileIndex || !gmFileIndex.length) {
      // 用更明显的 UI 反馈替代 alert
      if (elements.thumbCacheInfo) {
        elements.thumbCacheInfo.textContent = '⚠️ 请先刷新文件索引';
        elements.thumbCacheInfo.style.color = '#ef4444';
        setTimeout(() => {
          elements.thumbCacheInfo.style.color = '';
          gmUpdateThumbCacheInfo();
        }, 3000);
      } else {
        alert('请先构建文件索引');
      }
      return;
    }


    const fileCount = gmFileIndex.length;

    // 1. 估算需要的空间
    const estimate = await gmEstimateCacheSize(fileCount);
    console.log(`[Cache All] 预计需要 ${estimate.mb} MB 缓存 ${fileCount} 个文件`);

    // 2. 检查空间是否充足
    const spaceCheck = await gmCheckCacheSpace(estimate.mb);

    if (!spaceCheck.sufficient) {
      // 空间不足,提示扩容
      const expanded = await gmPromptExpandCache(spaceCheck);
      if (!expanded) {
        console.log('[Cache All] 用户取消扩容');
        return;
      }
    }

    // 3. 开始全量缓存
    const confirmed = confirm(
      `即将缓存所有 ${fileCount} 个文件的缩略图\n\n` +
      `预计需要 ${estimate.mb} MB 空间\n` +
      `此操作可能需要几分钟,是否继续?`
    );

    if (!confirmed) return;

    // 4. 显示进度 (使用缓存信息区域持久显示)
    const originalCacheInfo = elements.thumbCacheInfo?.textContent || '';
    if (elements.thumbCacheInfo) {
      elements.thumbCacheInfo.textContent = `缓存中: 0/${fileCount} (0%)`;
      elements.thumbCacheInfo.style.color = '#3b82f6'; // 蓝色表示进行中
    }
    console.log(`[Cache All] 开始缓存 ${fileCount} 个文件`);

    let cached = 0;
    let skipped = 0;
    let failed = 0;
    const startTime = Date.now(); // 记录开始时间

    // 5. 批量缓存 (分批处理,避免内存溢出)
    const BATCH_SIZE = 50; // 增加批量大小以提升速度
    for (let i = 0; i < gmFileIndex.length; i += BATCH_SIZE) {
      const batch = gmFileIndex.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (file) => {
          try {
            // 直接调用cacheThumbnail,它内部会检查是否已缓存
            const result = await window.bridge?.cacheThumbnail?.({ fileId: file.id, size: GM_THUMB_CACHE_SIZE });
            if (result) {
              cached++;
            } else {
              skipped++;
            }
          } catch (err) {
            failed++;
            console.warn('[Cache All] 缓存失败:', file.id, err);
          }
        })
      );

      // 更新进度 (持久显示在缓存信息区,包含预计剩余时间)
      const progress = Math.round(((i + batch.length) / gmFileIndex.length) * 100);
      const completed = cached + skipped + failed;
      const remaining = fileCount - completed;

      // 计算ETA
      let etaText = '';
      if (completed > 0) {
        const elapsed = Date.now() - startTime;
        const avgTimePerFile = elapsed / completed;
        const etaMs = avgTimePerFile * remaining;

        // 格式化剩余时间
        if (etaMs < 60000) {
          etaText = ` · 剩余 ${Math.ceil(etaMs / 1000)}秒`;
        } else {
          const minutes = Math.floor(etaMs / 60000);
          const seconds = Math.ceil((etaMs % 60000) / 1000);
          etaText = ` · 剩余 ${minutes}分${seconds}秒`;
        }
      }

      if (elements.thumbCacheInfo) {
        elements.thumbCacheInfo.textContent = `缓存中: ${completed}/${fileCount} (${progress}%)${etaText}`;
      }
      console.log(`[Cache All] 进度: ${progress}% (成功:${cached}, 跳过:${skipped}, 失败:${failed})${etaText}`);
    }

    // 6. 完成 - 恢复缓存信息显示并清理超限缓存
    if (elements.thumbCacheInfo) {
      elements.thumbCacheInfo.style.color = ''; // 恢复默认颜色
    }

    // 批量缓存完成后统一清理超限缓存
    console.log('[Cache All] 开始清理超限缓存...');
    await window.bridge?.cleanThumbCache?.();

    gmUpdateThumbCacheInfo();

    const message = `缓存完成!\n\n` +
      `成功: ${cached} 个\n` +
      `跳过: ${skipped} 个\n` +
      `失败: ${failed} 个\n` +
      `总计: ${fileCount} 个`;

    console.log('[Cache All]', message.replace(/\n/g, ' '));
    alert(message);
  }

  function gmCreateThumbSizeControl(onChange) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; align-items:center; gap:4px;';
    const label = document.createElement('span');
    label.textContent = '缩略图';
    label.style.cssText = 'font-size:13px; color:#475569;';
    wrap.appendChild(label);

    const sizes = ['small', 'medium', 'large'];
    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex; gap:4px;';

    const iconHtml = (size) => {
      if (size === 'small') {
        return `<span style="display:grid; grid-template-columns:repeat(3,5px); gap:2px; color:currentColor;">
          ${'<span style="width:5px; height:5px; background:currentColor; display:block; border-radius:1px;"></span>'.repeat(9)}
        </span>`;
      }
      if (size === 'medium') {
        return `<span style="display:grid; grid-template-columns:repeat(2,7px); gap:3px; color:currentColor;">
          ${'<span style="width:7px; height:7px; background:currentColor; display:block; border-radius:2px;"></span>'.repeat(4)}
        </span>`;
      }
      return `<span style="width:14px; height:14px; background:currentColor; display:block; border-radius:3px;"></span>`;
    };

    sizes.forEach(size => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = iconHtml(size);
      btn.title = `${size === 'small' ? '小' : size === 'medium' ? '中' : '大'}缩略图`;
      btn.style.cssText = `
        min-width:36px;
        min-height:32px;
        padding:4px 6px;
        border:1px solid #e2e8f0;
        border-radius:6px;
        background:${gmThumbSize === size ? '#1d4ed8' : 'white'};
        color:${gmThumbSize === size ? 'white' : '#475569'};
        cursor:pointer;
      `;
      btn.dataset.size = size;
      btn.addEventListener('click', () => {
        gmThumbSize = size;
        Array.from(btnGroup.children).forEach(child => {
          child.style.background = child.dataset.size === gmThumbSize ? '#1d4ed8' : 'white';
          child.style.color = child.dataset.size === gmThumbSize ? 'white' : '#475569';
        });
        if (typeof onChange === 'function') onChange(gmThumbSize);
      });
      btnGroup.appendChild(btn);
    });
    wrap.appendChild(btnGroup);
    return wrap;
  }

  // 统一控制预览和列表显隐的辅助函数
  function gmApplyPreviewVisibility() {
    const thumbPanel = document.getElementById('gm-thumb-panel');
    const previewPanel = document.getElementById('gm-preview-panel');
    const previewToggleBtn = document.getElementById('gm-toggle-preview');
    const divider = document.getElementById('gm-panel-divider');
    const ratioPercent = Math.round(gmPreviewRatio * 100);
    if (thumbPanel) {
      thumbPanel.style.flex = gmPreviewVisible ? `0 0 ${ratioPercent}%` : '1';
      thumbPanel.style.maxWidth = gmPreviewVisible ? '' : '100%';
    }
    if (previewPanel) {
      previewPanel.style.display = gmPreviewVisible ? 'flex' : 'none';
    }
    if (divider) {
      divider.style.display = gmPreviewVisible ? 'block' : 'none';
    }
    if (previewToggleBtn) {
      previewToggleBtn.textContent = gmPreviewVisible ? '隐藏预览面板' : '显示预览面板';
    }
  }

  function gmApplyRecordListVisibility() {
    const recordGrid = document.getElementById('gm-record-grid');
    const recordListToggleBtn = document.getElementById('gm-toggle-record-list');
    if (recordGrid) {
      recordGrid.style.display = gmRecordListVisible ? 'grid' : 'none';
    }
    if (recordListToggleBtn) {
      recordListToggleBtn.textContent = gmRecordListVisible ? '隐藏列表' : '显示列表';
    }
  }

  // DOM 元素
  const gmElements = {
    toggleViewBtn: document.getElementById('gm-toggle-view-btn'),
    viewToggleText: document.getElementById('gm-view-toggle-text'),
    submitView: document.getElementById('gm-submit-view'),
    browseView: document.getElementById('gm-browse-view'),
    refreshBtn: document.getElementById('gm-refresh-btn'),
    submitForm: document.getElementById('gm-submit-form'),
    submitterInput: document.getElementById('gm-submit-submitter'),
    adminInput: document.getElementById('gm-submit-admin'),
    folderLinkInput: document.getElementById('gm-submit-folder-link'),
    contentTypeSelect: document.getElementById('gm-submit-content-type'),
    notesTextarea: document.getElementById('gm-submit-notes'),
    previewFolderBtn: document.getElementById('gm-preview-folder-btn'),
    submitResult: document.getElementById('gm-submit-result'),
    resultDetails: document.getElementById('gm-result-details'),
    submitAnotherBtn: document.getElementById('gm-submit-another-btn'),
    searchInput: document.getElementById('gm-search-input'),
    searchStatus: document.getElementById('gm-search-status'),
    filterType: document.getElementById('gm-filter-type'),
    sortBy: document.getElementById('gm-sort-by'),
    submitterFilter: document.getElementById('gm-submitter-filter'),
    mediaGrid: document.getElementById('gm-media-grid'),
    emptyState: document.getElementById('gm-empty-state'),
    loadingState: document.getElementById('gm-loading-state'),
    folderModal: document.getElementById('gm-folder-modal'),
    modalFolderName: document.getElementById('gm-modal-folder-name'),
    modalMeta: document.getElementById('gm-modal-meta'),
    fileGrid: document.getElementById('gm-file-grid'),
    modalEmpty: document.getElementById('gm-modal-empty'),
    modalLoading: document.getElementById('gm-modal-loading'),
    closeModalBtn: document.getElementById('gm-close-modal-btn'),
    cancelModalBtn: document.getElementById('gm-cancel-modal-btn'),
    openFolderBtn: document.getElementById('gm-open-folder-btn'),
    folderTree: document.getElementById('gm-folder-tree'),
    breadcrumb: document.getElementById('gm-folder-breadcrumb'),
    submitModal: document.getElementById('gm-submit-modal'),
    submitModalClose: document.getElementById('gm-close-submit-modal'),
    submitModalCancel: document.getElementById('gm-submit-cancel'),
    filePreviewModal: document.getElementById('gm-file-preview-modal'),
    previewContainer: document.getElementById('gm-preview-container'),
    closePreviewBtn: document.getElementById('gm-close-preview-btn')
  };

  // 移除页面上旧的 #gm-folder-tree 容器，只保留详情视图内的 #gm-tree-pane
  if (gmElements.folderTree) {
    const treeParent = gmElements.folderTree.parentElement;
    gmElements.folderTree.remove();
    if (treeParent && treeParent.children.length === 1) {
      treeParent.style.display = 'block';
    }
  }

  // 检查元素是否存在
  if (!gmElements.toggleViewBtn) return;

  // 视图切换
  function gmSwitchView(viewName) {
    gmCurrentView = viewName;

    const submitView = document.getElementById('gm-submit-view');
    const browseView = document.getElementById('gm-browse-view');
    const toggleText = document.getElementById('gm-view-toggle-text');

    if (viewName === 'submit') {
      if (submitView) submitView.style.display = 'block';
      if (browseView) browseView.style.display = 'none';
      if (toggleText) toggleText.textContent = '切换到浏览';
    } else {
      if (submitView) submitView.style.display = 'none';
      if (browseView) browseView.style.display = 'block';
      if (toggleText) toggleText.textContent = '切换到提交';
      // 切换回浏览时，仅显示列表，不自动展开文件夹
      gmLoadMediaRecords(false);
    }
  }

  function gmToggleView() {
    gmOpenSubmitModal();
  }

  function gmOpenSubmitModal() {
    if (!gmElements.submitModal) return;
    gmResetForm();
    gmElements.submitModal.hidden = false;
  }

  function gmCloseSubmitModal() {
    if (gmElements.submitModal) {
      gmElements.submitModal.hidden = true;
    }
  }

  // 刷新处理
  async function gmHandleRefresh() {
    if (gmCurrentView === 'browse') {
      await gmLoadMediaRecords(false);
      appendLog({ status: 'success', message: '已刷新媒体记录' });
    } else {
      gmResetForm();
      appendLog({ status: 'success', message: '表单已重置' });
    }
  }

  // 处理表单提交
  async function gmHandleSubmit(e) {
    e.preventDefault();

    const record = {
      submitter: gmElements.submitterInput?.value.trim() || '',
      admin: gmElements.adminInput?.value.trim() || '',
      folderLink: gmElements.folderLinkInput?.value.trim() || '',
      contentType: gmElements.contentTypeSelect?.value || '',
      notes: gmElements.notesTextarea?.value.trim() || ''
    };

    // 验证 - 链接说明改为必填
    if (!record.submitter || !record.folderLink || !record.contentType || !record.admin) {
      appendLog({ status: 'error', message: '请填写所有必填项（链接说明、内容类型、链接、提交人）' });
      return;
    }

    const submitBtn = gmElements.submitForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></span> 提交中...';

      try {
        const result = await window.bridge.submitMediaRecord(record);

        if (result?.success) {
          if (gmElements.submitForm) gmElements.submitForm.style.display = 'none';
          if (gmElements.submitResult) gmElements.submitResult.hidden = false;

          if (gmElements.resultDetails) {
            gmElements.resultDetails.innerHTML = `
              <p>文件夹包含 <strong>${result.fileCount}</strong> 个媒体文件</p>
              <p>提交时间：${result.timestamp}</p>
            `;
          }

          appendLog({ status: 'success', message: '媒体文件夹提交成功！' });
        }
      } catch (error) {
        console.error('提交失败:', error);
        appendLog({ status: 'error', message: error.message || '提交失败，请检查配置和网络' });
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    }
  }

  // 预览文件夹
  async function gmHandlePreviewFolder() {
    const folderLink = gmElements.folderLinkInput?.value.trim() || '';

    if (!folderLink) {
      appendLog({ status: 'error', message: '请先填写文件夹链接' });
      return;
    }

    try {
      const folderId = await window.bridge.extractFolderId(folderLink);

      if (!folderId) {
        appendLog({ status: 'error', message: '无效的文件夹链接' });
        return;
      }

      gmCurrentFolderId = folderId;
      gmCurrentRecord = {
        folderLink,
        submitter: gmElements.submitterInput?.value.trim() || '',
        admin: gmElements.adminInput?.value.trim() || '',
        contentType: gmElements.contentTypeSelect?.value || ''
      };

      gmShowFolderModal();
    } catch (error) {
      console.error('提取文件夹 ID 失败:', error);
      appendLog({ status: 'error', message: '无效的文件夹链接' });
    }
  }

  // 重置表单
  function gmResetForm() {
    gmElements.submitForm?.reset();
    if (gmElements.submitForm) gmElements.submitForm.style.display = 'flex';
    if (gmElements.submitResult) gmElements.submitResult.hidden = true;
    // 重新填充提交人
    if (gmElements.submitterInput && elements.metadata?.submitter) {
      gmElements.submitterInput.value = elements.metadata.submitter.value || '';
    }
    gmCloseSubmitModal();
  }

  function gmStartBuildFileIndex() {
    // 异步启动，避免阻塞 UI
    setTimeout(() => gmBuildFileIndex().catch(err => console.warn('构建索引失败:', err)), 300);
  }

  // 加载媒体记录
  async function gmLoadMediaRecords(autoOpen = true) {
    const loadingState = document.getElementById('gm-loading-state');
    const emptyState = document.getElementById('gm-empty-state');
    const contentArea = document.getElementById('gm-content-area');

    if (loadingState) loadingState.hidden = false;
    if (emptyState) emptyState.hidden = true;
    if (contentArea) contentArea.innerHTML = '';

    try {
      const records = await window.bridge.getMediaRecords();
      const sanitized = (records || []).map(r => ({ ...r, folderId: gmNormalizeFolderId(r.folderId) }));
      const validRecords = sanitized.filter(r => gmIsValidFolderId(r.folderId));
      if (sanitized.length !== validRecords.length) {
        console.warn('[GM] 已跳过含无效文件夹 ID 的记录:', sanitized.length - validRecords.length);
      }
      gmMediaRecords = validRecords;

      if (loadingState) loadingState.hidden = true;

      if (gmMediaRecords.length === 0) {
        if (emptyState) emptyState.hidden = false;
      } else {
        // 显示记录列表
        gmFilterRecords({ autoOpen });
        // 后台构建全局文件索引，便于搜索
        gmStartBuildFileIndex();
      }
    } catch (error) {
      console.error('加载媒体记录失败:', error);
      if (loadingState) loadingState.hidden = true;
      if (emptyState) emptyState.hidden = false;
      appendLog({ status: 'error', message: '加载失败：' + error.message });
    }
  }

  // 加载所有记录的文件并显示
  async function gmLoadAllFiles() {
    if (!gmElements.mediaGrid) return;

    gmElements.mediaGrid.innerHTML = '<div style="padding: 20px; text-align: center;">正在加载文件...</div>';

    const allFiles = [];

    // 根据筛选条件过滤记录
    const filtered = gmGetFilteredRecords();

    for (const record of filtered) {
      const folderId = gmNormalizeFolderId(record.folderId);
      if (!gmIsValidFolderId(folderId)) {
        console.warn('跳过无效文件夹ID，未加载文件：', record.folderId);
        continue;
      }
      try {
        const details = await window.bridge.getMediaFolderDetails(folderId, { recursive: true });

        // 检查加载是否被中断
        if (gmCurrentLoadingId !== loadingId) {
          console.log(`[Load] 加载已被中断 (${loadingId} !== ${gmCurrentLoadingId})`);
          return; // 停止渲染,用户已切换到其他文件夹
        }

        if (details && details.files) {
          allFiles.push(...details.files.map(file => ({
            ...file,
            record: {
              submitter: record.submitter,
              admin: record.admin,
              contentType: record.contentType,
              submitTime: record.submitTime
            }
          })));
        }
      } catch (error) {
        console.warn(`加载文件夹 ${record.folderId} 失败:`, error);
      }
    }

    gmRenderFileGrid(allFiles);
  }

  // 获取过滤后的记录
  function gmGetFilteredRecords() {
    const typeFilter = gmElements.filterType?.value || '';
    const sortBy = gmElements.sortBy?.value || 'time-desc';
    const submitterFilter = gmElements.submitterFilter?.value || 'all';

    const currentUser = elements.metadata?.submitter?.value?.trim().toLowerCase() || '';

    let filtered = gmMediaRecords.filter(record => {
      if (typeFilter && record.contentType !== typeFilter) return false;
      if (submitterFilter === 'mine') {
        if (!currentUser || (record.submitter || '').toLowerCase() !== currentUser) return false;
      } else if (submitterFilter === 'others') {
        if (currentUser && (record.submitter || '').toLowerCase() === currentUser) return false;
      }
      return true;
    });

    // 排序
    if (sortBy === 'time-desc') {
      filtered.sort((a, b) => (b.submitTime || '').localeCompare(a.submitTime || ''));
    } else if (sortBy === 'time-asc') {
      filtered.sort((a, b) => (a.submitTime || '').localeCompare(b.submitTime || ''));
    } else if (sortBy === 'type') {
      filtered.sort((a, b) => (a.contentType || '').localeCompare(b.contentType || ''));
    }

    return filtered;
  }

  // 渲染文件网格（使用现有的 slot-grid 样式）
  function gmRenderFileGrid(files) {
    if (!gmElements.mediaGrid) return;

    if (files.length === 0) {
      gmElements.mediaGrid.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">没有找到文件</div>';
      return;
    }

    gmElements.mediaGrid.innerHTML = '';
    gmElements.mediaGrid.className = 'slot-file-grid'; // 使用正确的网格样式类名

    files.forEach(file => {
      const item = gmCreateFileItem(file);
      gmElements.mediaGrid.appendChild(item);
    });
  }

  // 创建文件项（完全匹配现有的样式系统）
  function gmCreateFileItem(file) {
    const item = document.createElement('div');
    item.className = 'slot-grid-file-item';
    item.dataset.fileId = file.id;
    // 强制样式
    item.style.cssText = `
      position: relative;
      border-radius: 8px;
      overflow: visible;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      background: white;
      border: 1px solid #e2e8f0;
    `;

    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w200`;
    const isVideo = file.type === 'video';

    // 缩略图包装器 - 使用固定尺寸而不是aspect-ratio
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'slot-grid-file-thumbnail-wrapper';
    thumbWrapper.style.cssText = `
      position: relative;
      width: 100%;
      height: 0;
      padding-bottom: 100%;
      overflow: hidden;
      border-radius: 8px 8px 0 0;
      background: #f1f5f9;
    `;

    // 缩略图容器 - 绝对定位填满父容器
    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'slot-grid-file-thumbnail';
    thumbContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // 图片元素
    const img = document.createElement('img');
    img.src = thumbnailUrl;
    img.alt = file.name || '';
    img.loading = 'lazy';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';

    // 图片加载失败时显示徽章
    img.onerror = function () {
      this.style.display = 'none';
      const badge = document.createElement('div');
      badge.textContent = isVideo ? 'VIDEO' : 'IMG';
      badge.style.cssText = `
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        font-size: 11px;
        font-weight: 700;
        padding: 6px;
        border-radius: 4px;
      `;
      thumbContainer.appendChild(badge);
    };

    thumbContainer.appendChild(img);

    // 视频播放图标覆盖层
    if (isVideo) {
      const videoOverlay = document.createElement('div');
      videoOverlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 32px;
        pointer-events: none;
      `;
      videoOverlay.textContent = '▶';
      thumbWrapper.appendChild(videoOverlay);
    }

    thumbWrapper.appendChild(thumbContainer);
    item.appendChild(thumbWrapper);

    // 文件名显示
    const fileName = document.createElement('div');
    fileName.className = 'slot-grid-file-name-display';
    fileName.title = file.name || '';
    fileName.textContent = file.name || '';
    fileName.style.cssText = `
      padding: 6px 8px;
      font-size: 11px;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      background: white;
      border-top: 1px solid #f1f5f9;
      text-align: center;
    `;
    item.appendChild(fileName);

    // 悬停效果
    item.addEventListener('mouseenter', () => {
      item.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
      item.style.borderColor = '#3b82f6';
      item.style.zIndex = '5';
    });

    item.addEventListener('mouseleave', () => {
      item.style.boxShadow = '';
      item.style.borderColor = '#e2e8f0';
      item.style.zIndex = '';
    });

    // 添加点击事件打开预览
    item.addEventListener('click', () => {
      gmOpenFilePreview(file);
    });

    return item;
  }

  // 打开文件预览
  function gmOpenFilePreview(file) {
    const isVideo = file.type === 'video';
    const previewUrl = isVideo
      ? `https://drive.google.com/uc?id=${file.id}&export=download`
      : `https://drive.google.com/thumbnail?id=${file.id}&sz=w1200`;

    // 创建全屏预览
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(white, 0.2);
      border: none;
      color: white;
      font-size: 24px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      z-index: 10;
    `;
    closeBtn.onclick = () => overlay.remove();

    const content = document.createElement('div');
    content.style.cssText = 'max-width: 90%; max-height: 90%; display: flex; flex-direction: column; align-items: center; gap: 16px;';

    if (isVideo) {
      content.innerHTML = `
        <video src="${previewUrl}" controls autoplay style="max-width: 100%; max-height: 80vh; border-radius: 8px;"></video>
        <div style="color: white; font-size: 16px; text-align: center;">${file.name || ''}</div>
      `;
    } else {
      content.innerHTML = `
        <img src="${previewUrl}" alt="${file.name || ''}" style="max-width: 100%; max-height: 80vh; border-radius: 8px;" />
        <div style="color: white; font-size: 16px; text-align: center;">${file.name || ''}</div>
      `;
    }

    overlay.appendChild(closeBtn);
    overlay.appendChild(content);
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };
    document.body.appendChild(overlay);
  }

  // 筛选和排序记录
  function gmFilterRecords(options = {}) {
    // 在返回列表等场景下强制显示卡片列表
    if (options.autoOpen === false) {
      gmRecordListVisible = true;
    }
    const filtered = gmGetFilteredRecords();
    gmRenderMediaCards(filtered, options);
  }

  // 顶部搜索：有关键词时执行全局文件搜索，空时回到记录列表
  async function gmHandleSearch() {
    const term = gmElements.searchInput?.value.trim();
    if (term) {
      const searchFn = typeof gmGlobalSearch === 'function' ? gmGlobalSearch : (typeof window.gmGlobalSearch === 'function' ? window.gmGlobalSearch : null);
      if (searchFn) {
        await searchFn(term);
      } else {
        console.warn('gmGlobalSearch 未定义，跳回记录列表');
        gmFilterRecords();
      }
    } else {
      gmFilterRecords();
    }
  }

  // 渲染媒体卡片（记录列表）
  function gmRenderMediaCards(records, options = {}) {
    const { autoOpen = true } = options;
    const contentArea = document.getElementById('gm-content-area');
    const emptyState = document.getElementById('gm-empty-state');

    if (!contentArea) return;

    contentArea.innerHTML = `
      <div id="gm-record-grid" style="display: ${gmRecordListVisible ? 'grid' : 'none'}; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding: 16px; width: 100%; box-sizing: border-box;"></div>
      <div id="gm-record-detail" style="margin: 0 16px 16px 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden;"></div>
    `;
    const gridArea = document.getElementById('gm-record-grid');
    const detailArea = document.getElementById('gm-record-detail');

    // 根据全局开关调整列表显隐
    if (gridArea && !gmRecordListVisible) {
      gridArea.style.display = 'none';
    }

    if (records.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    records.forEach(record => {
      const card = gmCreateMediaCard(record, detailArea);
      gridArea?.appendChild(card);
    });

    if (detailArea && !detailArea.innerHTML) {
      detailArea.innerHTML = `
        <div style="padding: 16px; color: #94a3b8;">选择左侧记录查看文件夹内容</div>
      `;
    }

    // 自动加载当前记录或第一条，避免目录树空白
    if (autoOpen) {
      const preferredRecord =
        (gmCurrentRecord && records.find(r => r.folderId === gmCurrentRecord.folderId)) ||
        records[0];
      if (preferredRecord && detailArea) {
        gmShowFolderFiles(preferredRecord, detailArea, false, true);
      }
    }
  }

  function gmSetIndexProgress(percent, text) {
    if (elements.indexProgressBar) {
      const clamped = Math.max(0, Math.min(100, percent));
      elements.indexProgressBar.style.width = `${clamped}%`;
    }
    if (elements.indexProgressText) {
      elements.indexProgressText.textContent = text || '';
    }
  }

  async function gmLoadFileIndexFromStorage() {
    try {
      const saved = await window.bridge?.loadFileIndex?.();
      if (!saved?.files || !saved.timestamp) return { loaded: false, stale: false };
      gmFileIndex = saved.files;
      gmFileIndexTimestamp = saved.timestamp;
      gmFileIndexStale = Date.now() - saved.timestamp > GM_FILE_INDEX_MAX_AGE;
      console.log('[GM] 已加载本地文件索引缓存，条目数:', gmFileIndex.length, gmFileIndexStale ? '(过期，将后台刷新)' : '');
      gmSetIndexStatus('ready');
      gmUpdateFileIndexInfo();
      return { loaded: true, stale: gmFileIndexStale };
    } catch (err) {
      console.warn('读取文件索引缓存失败:', err);
      gmSetIndexStatus('error');
      return { loaded: false, stale: false };
    }
  }

  async function gmPersistFileIndex() {
    if (!gmFileIndex || !gmFileIndex.length) return;
    if (gmFileIndexSaveTimer) clearTimeout(gmFileIndexSaveTimer);
    gmFileIndexSaveTimer = setTimeout(async () => {
      try {
        await window.bridge?.saveFileIndex?.({ timestamp: gmFileIndexTimestamp, files: gmFileIndex });
        gmFileIndexStale = false;
      } catch (err) {
        console.warn('持久化文件索引失败:', err);
      }
    }, 300);
  }

  function gmSyncFolderIndex(record, details) {
    if (!record?.folderId || !details?.files) return { added: 0, removed: 0, updated: 0 };
    if (!Array.isArray(gmFileIndex)) gmFileIndex = [];

    const folderId = record.folderId;
    const files = details.files || [];
    const oldEntries = gmFileIndex.filter(f => f.folderId === folderId);
    const oldMap = new Map(oldEntries.map(f => [f.id, f]));
    const newIds = new Set(files.map(f => f.id));

    let added = 0, removed = 0, updated = 0;

    // 删除不在新列表里的旧文件
    const before = gmFileIndex.length;
    gmFileIndex = gmFileIndex.filter(f => f.folderId !== folderId || newIds.has(f.id));
    removed = before - gmFileIndex.length;

    // 合并新增/更新
    files.forEach(file => {
      const prev = oldMap.get(file.id);
      const merged = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        type: file.type,
        folderId,
        folderName: details.folderName || record.folderName || '',
        submitter: record.submitter,
        admin: record.admin,
        contentType: record.contentType,
        modifiedTime: file.modifiedTime
      };
      if (!prev) {
        added += 1;
        gmFileIndex.push(merged);
      } else {
        // 简单判断差异
        const changed = prev.name !== merged.name || prev.mimeType !== merged.mimeType || prev.modifiedTime !== merged.modifiedTime;
        Object.assign(prev, merged);
        if (changed) updated += 1;
      }
    });

    gmFileIndexTimestamp = Date.now();
    gmPersistFileIndex();
    gmUpdateFileIndexInfo();
    return { added, removed, updated };
  }

  function gmSetIndexStatus(status) {
    gmFileIndexStatus = status;
    const el = gmElements.searchStatus || document.getElementById('gm-search-status');
    const fileIndexEl = elements.fileIndexInfo;
    let text = '';
    let color = '#94a3b8';
    if (status === 'building') {
      text = '索引构建中…';
    } else if (status === 'ready') {
      text = '索引已就绪';
      color = '#10b981';
    } else if (status === 'error') {
      text = '索引失败';
      color = '#ef4444';
    } else {
      text = '';
    }
    if (el) {
      el.textContent = text;
      el.style.color = color;
    }
    // 文件索引区域同步状态提示（后续 gmUpdateFileIndexInfo 会覆盖为具体时间/大小）
    if (fileIndexEl && status !== 'ready') {
      fileIndexEl.textContent = text || '未生成';
      fileIndexEl.style.color = color;
    }
    if (status === 'building') {
      gmSetIndexProgress(20, '构建/搜索中…');
    } else if (status === 'ready') {
      gmSetIndexProgress(100, '索引已就绪');
      setTimeout(() => gmSetIndexProgress(0, ''), 600);
    } else if (status === 'error') {
      gmSetIndexProgress(0, '索引失败');
    } else {
      gmSetIndexProgress(0, '');
    }
  }

  async function gmBuildFileIndex(force = false) {
    if (gmFileIndex && gmFileIndexTimestamp && Date.now() - gmFileIndexTimestamp > GM_FILE_INDEX_MAX_AGE) {
      gmFileIndexStale = true;
    }

    // 先看内存/磁盘是否已有可用索引，避免无意义重建
    const hasFreshMemory =
      gmFileIndex && gmFileIndex.length && Date.now() - gmFileIndexTimestamp < GM_FILE_INDEX_MAX_AGE && !force;
    if (hasFreshMemory) return;

    if ((!gmFileIndex || !gmFileIndex.length) && !force) {
      const { loaded, stale } = await gmLoadFileIndexFromStorage();
      if (loaded && !stale) return;
      if (loaded && stale) {
        // 先用旧缓存响应 UI，后台刷新
        if (!gmFileIndexPromise) {
          gmFileIndexPromise = gmRebuildFileIndex(true);
        }
        return;
      }
    } else if (gmFileIndex && gmFileIndex.length && !force && !gmFileIndexStale) {
      return;
    }

    if (gmFileIndexStale && gmFileIndex && gmFileIndex.length && !force) {
      // 有旧索引但过期：后台刷新，不阻塞调用方
      if (!gmFileIndexPromise) {
        gmFileIndexPromise = gmRebuildFileIndex(true);
      }
      return;
    }

    if (gmFileIndexPromise) {
      return gmFileIndexPromise;
    }

    return gmRebuildFileIndex(force);
  }

  // 增量刷新索引：在已有索引的基础上合并最新文件，避免刷新期间索引被清空
  async function gmRefreshFileIndexIncremental() {
    if (gmFileIndexPromise) {
      gmShowQuickHint('索引刷新进行中…');
      return gmFileIndexPromise;
    }

    const refreshPromise = (async () => {
      // 确保有可用的基础索引；若不存在则执行完整重建
      if (!gmFileIndex || !gmFileIndex.length) {
        const { loaded } = await gmLoadFileIndexFromStorage();
        if (!loaded) {
          gmShowQuickHint('首次刷新，正在全量重建索引…');
          return gmRebuildFileIndex(true);
        }
      }
      if (!Array.isArray(gmFileIndex)) gmFileIndex = [];

      const records = gmGetFilteredRecords();
      if (!records.length) return;

      // 移除已经不在记录列表中的索引项
      const activeFolders = new Set(
        records
          .map(r => gmNormalizeFolderId(r.folderId))
          .filter(id => gmIsValidFolderId(id))
      );
      if (activeFolders.size) {
        gmFileIndex = gmFileIndex.filter(item => activeFolders.has(item.folderId));
      }

      const total = records.length || 1;
      let finished = 0;
      let totalAdded = 0;
      let totalRemoved = 0;
      let totalUpdated = 0;

      gmSetIndexStatus('building');
      gmSetIndexProgress(6, '增量刷新索引…');
      gmShowQuickHint('开始刷新索引…');

      try {
        for (const record of records) {
          const folderId = gmNormalizeFolderId(record.folderId);
          if (!gmIsValidFolderId(folderId)) {
            finished += 1;
            gmSetIndexProgress(Math.min(95, Math.round((finished / total) * 90 + 5)), `跳过 ${finished}/${total}`);
            continue;
          }

          try {
            // 强制拉取最新数据，避免缓存导致缺失
            const cacheKey = `${folderId}|deep|all`;
            gmFolderCache.delete(cacheKey);
            const details = await window.bridge.getMediaFolderDetails(folderId, { recursive: true, maxResults: GM_FILE_INDEX_MAX_RESULTS });
            const diff = gmSyncFolderIndex(record, details);
            totalAdded += diff?.added || 0;
            totalRemoved += diff?.removed || 0;
            totalUpdated += diff?.updated || 0;
          } catch (err) {
            console.warn('增量刷新索引时读取文件夹失败:', err);
          } finally {
            finished += 1;
            gmSetIndexProgress(Math.min(95, Math.round((finished / total) * 90 + 5)), `刷新 ${finished}/${total}`);
          }
        }

        gmFileIndexTimestamp = Date.now();
        gmFileIndexStale = false;
        gmPersistFileIndex();
        gmSetIndexStatus('ready');
        gmUpdateFileIndexInfo();
        const changed = totalAdded + totalRemoved + totalUpdated;
        const msg = changed
          ? `索引刷新完成：新增 ${totalAdded} · 删除 ${totalRemoved} · 更新 ${totalUpdated}`
          : '索引刷新完成（无变化）';
        gmShowQuickHint(msg);
      } finally {
        if (!gmFileIndex || !gmFileIndex.length) {
          gmSetIndexStatus('error');
        }
        if (gmFileIndexPromise === refreshPromise) {
          gmFileIndexPromise = null;
        }
      }
    })();

    gmFileIndexPromise = refreshPromise;
    return refreshPromise;
  }

  function gmRebuildFileIndex(isRefresh = false) {
    gmSetIndexStatus('building');
    gmSetIndexProgress(5, isRefresh ? '刷新索引…' : '准备索引…');

    gmFileIndexPromise = (async () => {
      try {
        const records = gmGetFilteredRecords();
        const aggregated = [];
        const total = records.length || 1;
        let finished = 0;
        gmSetIndexProgress(8, `读取 ${finished}/${total}`);
        for (const record of records) {
          const folderId = gmNormalizeFolderId(record.folderId);
          if (!gmIsValidFolderId(folderId)) {
            finished += 1;
            gmSetIndexProgress(Math.min(95, Math.round((finished / total) * 90 + 5)), `读取 ${finished}/${total}`);
            console.warn('构建索引时跳过无效文件夹ID:', record.folderId);
            continue;
          }
          try {
            // 复用缓存，避免重复请求
            const cacheKey = `${folderId}|deep|all`;
            let details = gmFolderCache.get(cacheKey);
            if (!details) {
              details = await window.bridge.getMediaFolderDetails(folderId, { recursive: true, maxResults: GM_FILE_INDEX_MAX_RESULTS });
              gmFolderCache.set(cacheKey, details);
            }
            const folderName = details.folderName || record.folderName || '';
            (details.files || []).forEach(file => {
              aggregated.push({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                type: file.type,
                folderId,
                folderName,
                submitter: record.submitter,
                admin: record.admin,
                contentType: record.contentType
              });
            });
          } catch (err) {
            console.warn('构建索引时读取文件夹失败:', err);
          } finally {
            finished += 1;
            gmSetIndexProgress(Math.min(95, Math.round((finished / total) * 90 + 5)), `读取 ${finished}/${total}`);
          }
        }
        gmFileIndex = aggregated;
        gmFileIndexTimestamp = Date.now();
        gmFileIndexStale = false;
        gmPersistFileIndex();
        console.log('[GM] 全局文件索引构建完成，条目数:', aggregated.length);
        gmSetIndexStatus('ready');
        gmSetIndexProgress(100, `已完成 · ${aggregated.length} 条`);
        gmUpdateFileIndexInfo();
      } finally {
        if (!gmFileIndex || !gmFileIndex.length) {
          gmSetIndexStatus('error');
        }
        gmFileIndexPromise = null;
      }
    })();

    return gmFileIndexPromise;
  }

  // 全局文件搜索：优先用索引，缺失则尝试构建
  async function gmGlobalSearch(searchTerm) {
    const contentArea = document.getElementById('gm-content-area');
    const emptyState = document.getElementById('gm-empty-state');
    if (!contentArea) return;

    if (emptyState) emptyState.hidden = true;
    contentArea.innerHTML = `
        <div style="padding: 32px; text-align: center; color: #475569;">
          <div style="font-size: 18px; margin-bottom: 8px;">全局搜索中…</div>
          <div style="color:#94a3b8;">关键词：${escapeHtml(searchTerm)}</div>
        </div>
      `;
    gmSetIndexStatus('building');
    gmSetIndexProgress(30, '搜索中…');

    try {
      const keyword = searchTerm.toLowerCase();
      await gmBuildFileIndex();
      const source = gmFileIndex || [];
      const matched = source
        .filter((f) => {
          const text = [
            f.name,
            f.id,
            f.mimeType,
            f.folderName,
            f.submitter,
            f.contentType
          ].filter(Boolean).join(' ').toLowerCase();
          return text.includes(keyword);
        })
        .map((f) => ({
          ...f,
          _folderName: f.folderName,
          _record: {
            submitter: f.submitter,
            contentType: f.contentType
          }
        }));

      gmRenderGlobalSearchResults(matched, searchTerm);
    } catch (error) {
      console.error('全局搜索失败:', error);
      contentArea.innerHTML = `<div style="padding: 32px; color: #ef4444;">搜索失败：${escapeHtml(error.message || '未知错误')}</div>`;
    }
  }
  window.gmGlobalSearch = gmGlobalSearch;

  function gmRenderGlobalSearchResults(files, searchTerm) {
    const contentArea = document.getElementById('gm-content-area');
    if (!contentArea) return;

    gmCurrentFiles = files;
    gmSelectedFiles = new Set();
    gmCurrentRecord = null;
    gmCurrentFolderId = null;

    const count = files.length;
    gmPreviewVisible = false;

    contentArea.innerHTML = `
        <div style="padding: 16px; width: 100%; box-sizing: border-box;">
          <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <button id="gm-search-back" class="secondary">← 返回记录列表</button>
            <span style="font-size: 16px; font-weight: 600;">搜索“${escapeHtml(searchTerm)}” · ${count} 个文件</span>
            <button id="gm-toggle-preview" class="ghost">${gmPreviewVisible ? '隐藏预览面板' : '显示预览面板'}</button>
            <div id="gm-thumb-size-global-placeholder"></div>
          </div>
          <div style="display: flex; gap: 12px; height: calc(100vh - 240px);">
            <div id="gm-panel-row" style="flex: 1; display:flex; gap: 12px; align-items: stretch;">
              <div id="gm-thumb-panel" style="flex: ${gmPreviewVisible ? '0 0 45%' : '1'}; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: white;">
                <div style="text-align: center; padding: 16px; color: #94a3b8;">${count ? '正在展示结果…' : '没有匹配的文件'}</div>
              </div>
              <div id="gm-panel-divider" style="flex: 0 0 6px; cursor: col-resize; background: #e2e8f0; border-radius: 6px; display: ${gmPreviewVisible ? 'block' : 'none'};"></div>
              <div id="gm-preview-panel" style="flex: 1; background: #1e293b; border: 2px solid #3b82f6; border-radius: 12px; overflow: hidden; position: relative; display: ${gmPreviewVisible ? 'flex' : 'none'}; align-items: center; justify-content: center; color: #94a3b8;">
                <button id="gm-preview-close" class="ghost" style="position:absolute; top:8px; right:8px; z-index:3; background: rgba(255,255,255,0.12); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 4px 8px; cursor: pointer;">✕</button>
                <div style="text-align: center;">
                  <div style="font-size: 64px; margin-bottom: 16px;">🖼️</div>
                  <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">点击左侧文件预览</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

    const thumbPanel = document.getElementById('gm-thumb-panel');
    const previewToggleBtn = document.getElementById('gm-toggle-preview');
    const previewCloseBtn = document.getElementById('gm-preview-close');
    const divider = document.getElementById('gm-panel-divider');
    const panelRow = document.getElementById('gm-panel-row');
    const thumbSizePlaceholder = document.getElementById('gm-thumb-size-global-placeholder');

    document.getElementById('gm-search-back')?.addEventListener('click', () => {
      if (gmElements.searchInput) gmElements.searchInput.value = '';
      gmFilterRecords({ autoOpen: false });
    });

    if (previewToggleBtn) {
      previewToggleBtn.dataset.bound = 'true';
      previewToggleBtn.addEventListener('click', () => {
        gmPreviewVisible = !gmPreviewVisible;
        gmApplyPreviewVisibility();
      });
    }
    if (previewCloseBtn) {
      previewCloseBtn.dataset.bound = 'true';
      previewCloseBtn.addEventListener('click', () => {
        gmPreviewVisible = false;
        gmApplyPreviewVisibility();
      });
    }

    if (thumbSizePlaceholder) {
      const control = gmCreateThumbSizeControl(() => {
        const grid = thumbPanel?.querySelector('.gm-grid-wrapper > div');
        gmApplyThumbGridStyle(grid);
      });
      thumbSizePlaceholder.replaceWith(control);
    }

    if (divider && panelRow && !divider.dataset.bound) {
      divider.dataset.bound = 'true';
      let dragging = false;
      const onMouseMove = (e) => {
        if (!dragging || !gmPreviewVisible) return;
        const rect = panelRow.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        gmPreviewRatio = Math.min(0.8, Math.max(0.2, ratio));
        gmApplyPreviewVisibility();
      };
      const stopDrag = () => { dragging = false; };
      divider.addEventListener('mousedown', (e) => {
        if (!gmPreviewVisible) return;
        dragging = true;
        e.preventDefault();
      });
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('mouseleave', stopDrag);
    }

    gmApplyPreviewVisibility();

    if (!thumbPanel) return;
    thumbPanel.innerHTML = '';

    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'gm-grid-wrapper';
    gridWrapper.style.marginTop = '6px';
    thumbPanel.appendChild(gridWrapper);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; gap: 12px;';
    gmApplyThumbGridStyle(grid);
    gridWrapper.appendChild(grid);

    files.forEach((file) => {
      const item = document.createElement('div');
      item.className = 'gm-file-item';
      item.dataset.fileId = file.id;
      item.title = '双击缩略图可打开预览面板';
      const thumbRequestSize = gmGetThumbRequestSize();
      item.innerHTML = `
            <div class="gm-thumb-wrapper">
              <label class="gm-select-checkbox" style="position:absolute; top:6px; left:6px; z-index:2; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background: rgba(15,23,42,0.55); border:1px solid rgba(255,255,255,0.75); box-shadow: 0 1px 3px rgba(0,0,0,0.22); padding:0;">
                <input type="checkbox" data-file-id=\"${file.id}\" style=\"width:14px; height:14px; margin:0; accent-color:#3b82f6; cursor:pointer;\">
              </label>
              <button type="button" class="gm-download-btn" data-file-id=\"${file.id}\" title=\"下载\"
                style=\"position:absolute; top:6px; right:6px; z-index:2; width:28px; height:28px; border-radius:50%; background: rgba(15,23,42,0.55); border:1px solid rgba(255,255,255,0.75); padding:0; cursor:pointer; color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.22); display:flex; align-items:center; justify-content:center; font-size:15px;\">
                ⬇︎
              </button>
              <div class=\"gm-thumb-container\" title=\"双击缩略图打开预览\">
                <img data-thumb-id=\"${file.id}\" src=\"https://drive.google.com/thumbnail?id=${file.id}&sz=w${thumbRequestSize}\" alt=\"${file.name || ''}\" loading=\"lazy\"
                  style=\"width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity 0.2s ease; background:linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9);\">
                ${file.type === 'video' ? '<div class=\"gm-video-overlay\">▶</div>' : ''}
              </div>
            </div>
            <div class=\"gm-file-name\">${file.name || ''}</div>
            <div style=\"font-size:11px; color:#94a3b8;\">${file._folderName || ''}</div>
          `;

      const checkbox = item.querySelector('input[type=\"checkbox\"]');
      const downloadBtn = item.querySelector('.gm-download-btn');
      const thumbContainer = item.querySelector('.gm-thumb-container');
      const imgEl = item.querySelector('img[data-thumb-id]');
      gmLoadThumbImage(imgEl, file.id);

      if (checkbox) {
        checkbox.checked = gmSelectedFiles.has(file.id);
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          if (checkbox.checked) {
            gmSelectedFiles.add(file.id);
          } else {
            gmSelectedFiles.delete(file.id);
          }
        });
      }

      if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await gmDownloadFiles([file]);
        });
      }

      if (thumbContainer) {
        thumbContainer.addEventListener('click', (e) => {
          gmShowPreview(file);
          if (!gmPreviewVisible) {
            gmShowQuickHint('双击缩略图打开预览面板', e.clientX, e.clientY);
          }
        });
        thumbContainer.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (!gmPreviewVisible) {
            gmPreviewVisible = true;
            gmApplyPreviewVisibility();
          }
          gmShowPreview(file);
        });
      }

      item.addEventListener('click', () => gmShowPreview(file));
      grid.appendChild(item);
    });
  }

  // 创建媒体卡片（记录卡片）
  function gmCreateMediaCard(record, detailArea) {
    const card = document.createElement('div');
    card.className = 'panel';
    card.style.cssText = `
      cursor: pointer;
      transition: all 0.2s;
      padding: 20px;
    `;

    // 类型图标映射
    const typeIcons = {
      'reels': '🎬',
      'sora': '🎨',
      '主耶稣图': '✨',
      '其他': '📁'
    };

    const icon = typeIcons[record.contentType] || '📁';

    // 格式化时间
    const formatTime = (timeStr) => {
      if (!timeStr) return '';
      const date = new Date(timeStr);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}-${day}`;
    };

    // 检查文件夹缓存状态
    const getCacheStatus = async (folderId) => {
      try {
        // 使用getMediaFolderDetails获取文件列表
        const details = await window.bridge?.getMediaFolderDetails?.(folderId, { recursive: true, maxResults: 500 });
        const files = details?.files || [];

        console.log(`[Cache Status] 文件夹 ${folderId} 获取到 ${files.length} 个文件`);
        if (!files.length) return { cached: 0, total: 0, percent: 0 };

        const total = files.length;
        let cached = 0;

        // 使用统一的缓存尺寸，避免不同尺寸重复生成
        const size = GM_THUMB_CACHE_SIZE;
        console.log(`[Cache Status] 检查文件夹, 共 ${total} 个文件, 使用size=${size}`);

        // 测试第一个文件的详细信息
        if (files.length > 0) {
          const testFile = files[0];
          console.log(`[Cache Status] 测试文件ID: ${testFile.id}, name: ${testFile.name}`);
          const testResult = await window.bridge?.getThumbnailCached?.({ fileId: testFile.id, size });
          console.log(`[Cache Status] 测试缓存结果:`, testResult);
        }

        // 批量检查缓存状态
        const checkPromises = files.map(async (file) => {
          try {
            const result = await window.bridge?.getThumbnailCached?.({ fileId: file.id, size });
            return result?.path ? 1 : 0;
          } catch (err) {
            console.warn('[Cache Status] 检查文件失败:', file.id, err);
            return 0;
          }
        });

        const results = await Promise.all(checkPromises);
        cached = results.reduce((sum, val) => sum + val, 0);

        const percent = Math.round((cached / total) * 100);
        console.log(`[Cache Status] ✓ 已缓存 ${cached}/${total} (${percent}%)`);
        return { cached, total, percent };
      } catch (err) {
        console.error('[Cache Status] 检查失败:', err);
        return { cached: 0, total: 0, percent: 0 };
      }
    };

    // 创建缓存状态badge(先占位,异步更新)
    const cacheStatusId = `cache-status-${record.folderId}`;
    const cacheBtnId = `cache-btn-${record.folderId}`;
    const cacheStatusHtml = `<span id="${cacheStatusId}" class="cache-status-badge" style="
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      background: #f1f5f9;
      color: #64748b;
    ">
      <span style="font-size: 10px;">⏳</span> 检查中...
    </span>`;

    card.innerHTML = `
      <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
        <div style="font-size: 32px; line-height: 1;">${icon}</div>
        <div style="flex: 1;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
            ${record.admin || record.folderName || record.contentType || '未命名文件夹'}
          </h3>
          <div style="font-size: 13px; color: #64748b; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            ${record.admin ? `<span>链接说明：${record.admin}</span><span>·</span>` : ''}
            <span>${record.fileCount || 0}个文件</span>
            <span>·</span>
            <span>${formatTime(record.submitTime)}</span>
            <span>·</span>
            ${cacheStatusHtml}
          </div>
        </div>
      </div>
      ${record.notes ? `
        <div style="font-size: 13px; color: #475569; margin-bottom: 12px; line-height: 1.5;">
          ${record.notes}
        </div>
      ` : ''}
      <div style="padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
        <div style="color: #3b82f6; font-size: 13px; font-weight: 500;">
          点击查看文件 →
        </div>
        <button id="${cacheBtnId}" style="
          padding: 6px 14px;
          border: 1px solid #3b82f6;
          border-radius: 6px;
          background: transparent;
          color: #3b82f6;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        ">
          <span style="font-size: 14px;">↓</span> 缓存缩略图
        </button>
      </div>
    `;

    // 异步获取并更新缓存状态
    getCacheStatus(record.folderId).then(status => {
      const badge = document.getElementById(cacheStatusId);
      const cacheBtn = document.getElementById(cacheBtnId);
      if (!badge) return;

      const { cached, total, percent } = status;
      let bgColor, textColor, icon, text;

      if (percent === 100) {
        bgColor = '#dcfce7';
        textColor = '#16a34a';
        icon = '✓';
        text = '已缓存';
      } else if (percent >= 50) {
        bgColor = '#fef3c7';
        textColor = '#d97706';
        icon = '◐';
        text = `${percent}%`;
      } else if (percent > 0) {
        bgColor = '#fee2e2';
        textColor = '#dc2626';
        icon = '○';
        text = `${cached}/${total}`;
      } else {
        bgColor = '#f1f5f9';
        textColor = '#64748b';
        icon = '○';
        text = '未缓存';
      }

      badge.style.background = bgColor;
      badge.style.color = textColor;
      badge.innerHTML = `<span style="font-size: 10px;">${icon}</span> ${text}`;

      // 如果已完成缓存，隐藏缓存按钮
      if (cacheBtn && percent === 100) {
        cacheBtn.style.display = 'none';
      }
    });

    // 缓存按钮点击事件
    const cacheBtn = card.querySelector(`#${cacheBtnId}`);
    if (cacheBtn) {
      cacheBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // 阻止冒泡，不触发卡片点击

        if (cacheBtn.dataset.caching === 'true') return;

        cacheBtn.dataset.caching = 'true';
        cacheBtn.style.background = '#3b82f6';
        cacheBtn.style.color = 'white';
        cacheBtn.innerHTML = '<span style="font-size: 14px;">⏳</span> 缓存中...';

        const badge = document.getElementById(cacheStatusId);

        try {
          // 获取文件夹详情（会触发后台预缓存）
          const details = await window.bridge?.getMediaFolderDetails?.(record.folderId, { recursive: true, maxResults: 500 });

          // 等待缓存完成（给后台一些时间）
          await new Promise(resolve => setTimeout(resolve, 3000));

          // 重新检查缓存状态
          const newStatus = await getCacheStatus(record.folderId);
          const { cached: newCached, total: newTotal, percent: newPercent } = newStatus;

          // 更新状态标签
          if (badge) {
            if (newPercent === 100) {
              badge.style.background = '#dcfce7';
              badge.style.color = '#16a34a';
              badge.innerHTML = '<span style="font-size: 10px;">✓</span> 已缓存';
            } else if (newPercent >= 50) {
              badge.style.background = '#fef3c7';
              badge.style.color = '#d97706';
              badge.innerHTML = `<span style="font-size: 10px;">◐</span> ${newPercent}%`;
            } else {
              badge.style.background = '#fee2e2';
              badge.style.color = '#dc2626';
              badge.innerHTML = `<span style="font-size: 10px;">○</span> ${newCached}/${newTotal}`;
            }
          }

          // 更新按钮状态
          if (newPercent === 100) {
            cacheBtn.style.background = '#16a34a';
            cacheBtn.style.borderColor = '#16a34a';
            cacheBtn.innerHTML = '<span style="font-size: 14px;">✓</span> 完成';
            setTimeout(() => { cacheBtn.style.display = 'none'; }, 1500);
          } else {
            cacheBtn.style.background = 'transparent';
            cacheBtn.style.color = '#3b82f6';
            cacheBtn.innerHTML = `<span style="font-size: 14px;">↓</span> 继续缓存 (${newPercent}%)`;
          }

          appendLog({ status: 'info', message: `缓存完成: ${newCached}/${newTotal} 个文件` });
        } catch (err) {
          console.error('缓存失败:', err);
          cacheBtn.style.background = '#fee2e2';
          cacheBtn.style.borderColor = '#dc2626';
          cacheBtn.style.color = '#dc2626';
          cacheBtn.innerHTML = '<span style="font-size: 14px;">✕</span> 重试';
          appendLog({ status: 'error', message: '缓存失败: ' + err.message });
        } finally {
          cacheBtn.dataset.caching = 'false';
        }
      });
    }

    // 悬停效果
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
      card.style.transform = 'translateY(-2px)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '';
      card.style.transform = '';
    });

    // 点击事件
    card.addEventListener('click', () => {
      gmShowFolderFiles(record, detailArea, false);
    });

    return card;
  }

  // 显示某个文件夹的文件网格
  async function gmShowFolderFiles(record, targetPane = null, fromTree = false, renderTree = true, skipResetUI = false) {
    // 移除阻塞检查,允许切换文件夹中断当前加载
    const contentArea = targetPane || document.getElementById('gm-content-area');
    if (!contentArea) return;

    const normalizedFolderId = gmNormalizeFolderId(record?.folderId);
    if (!gmIsValidFolderId(normalizedFolderId)) {
      appendLog({ status: 'error', message: '无效的文件夹 ID，无法加载文件' });
      return;
    }
    record = { ...record, folderId: normalizedFolderId };

    // 为当前加载生成唯一ID,用于检测是否被新的加载中断
    const loadingId = Date.now();
    gmCurrentLoadingId = loadingId;
    gmLoadingFiles = true;

    const previousFolderId = gmCurrentFolderId; // 保存之前的文件夹ID
    gmCurrentFolderId = record.folderId;
    gmCurrentRecord = record;

    // 判断是否为增量加载（加载更多）：skipResetUI=true 且是同一个文件夹
    const isLoadingMore = skipResetUI && previousFolderId === record.folderId;

    // 仅在点击卡片时重置根/展开；在树内导航保持原树不跳根
    if (!fromTree) {
      // 进入文件夹时默认隐藏列表，专注当前文件
      gmRecordListVisible = false;
      // 立即应用，避免等待后续渲染时列表延迟收起
      gmApplyRecordListVisibility();
      gmRootFolderId = record.folderId;
      gmBaseRecord = record;
      gmRootLabel = record.folderName || `${record.contentType || ''} - ${record.submitter || ''}` || '根目录';
      gmExpandedFolders.clear();
    } else {
      gmExpandedFolders.add(record.folderId);
    }

    // 针对每个文件夹独立保存选项
    const currentOptions = gmFolderOptionsMap.get(record.folderId) || { ...GM_DEFAULT_OPTIONS };

    // 详情视图需要用全宽布局，避免沿用列表时的 grid 样式导致内容被限制在一列
    contentArea.style.cssText = 'width: 100%; padding: 0 16px 16px; box-sizing: border-box; display: block;';

    const availableRecords = gmGetFilteredRecords();

    // 仅在非增量加载时重建整个布局（首次加载或切换文件夹时）
    if (!isLoadingMore) {
      const tabsHtml = `
        <div id="gm-folder-tabs" style="display: flex; gap: 8px; overflow-x: auto; padding: 0 4px 12px 0; margin: 4px 0 12px 0;">
          ${availableRecords.map(r => `
            <button class="secondary" data-folder-id="${r.folderId}"
              style="flex: 0 0 auto; padding: 6px 12px; border-radius: 20px; ${r.folderId === record.folderId ? 'background: #1d4ed8; color: white;' : ''}">
              ${r.contentType || '未知'} - ${r.submitter || ''}
            </button>
          `).join('')}
        </div>
      `;

      // 创建左右分栏布局
      contentArea.innerHTML = `
        <div style="padding: 16px; width: 100%; box-sizing: border-box;">
          <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <button id="gm-back-to-list" class="secondary">← 返回列表</button>
            <span style="margin-left: 16px; font-size: 16px; font-weight: 600;">
              ${record.contentType || ''} - ${record.submitter || ''}
            </span>
            <button id="gm-toggle-record-list" class="ghost">
              ${gmRecordListVisible ? '隐藏列表' : '显示列表'}
            </button>
            <button id="gm-toggle-preview" class="ghost">
              ${gmPreviewVisible ? '隐藏预览面板' : '显示预览面板'}
            </button>
          </div>
          ${tabsHtml}
          <div style="display: flex; gap: 12px; height: calc(100vh - 240px);">
            <div style="flex: 0 0 260px; max-width: 320px; border: 1px solid #e2e8f0; border-radius: 10px; background: white; padding: 10px; overflow-y: auto;" id="gm-tree-pane">
              <div style="color:#94a3b8; text-align:center; padding: 20px;">目录加载中...</div>
            </div>
            <div id="gm-panel-row" style="flex: 1; display:flex; gap: 12px; align-items: stretch;">
              <!-- 左侧缩略图区 -->
            <div id="gm-thumb-panel" style="flex: ${gmPreviewVisible ? '0 0 45%' : '1'}; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: white;">
            </div>
              <div id="gm-panel-divider" style="flex: 0 0 6px; cursor: col-resize; background: #e2e8f0; border-radius: 6px; display: ${gmPreviewVisible ? 'block' : 'none'};"></div>
              
              <!-- 右侧预览区 -->
              <div id="gm-preview-panel" style="flex: 1; background: #1e293b; border: 2px solid #3b82f6; border-radius: 12px; overflow: hidden; position: relative; display: ${gmPreviewVisible ? 'flex' : 'none'}; align-items: center; justify-content: center; color: #94a3b8;">
                <button id="gm-preview-close" class="ghost" style="position:absolute; top:8px; right:8px; z-index:3; background: rgba(255,255,255,0.12); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 4px 8px; cursor: pointer;">✕</button>
                <div style="text-align: center;">
                  <div style="font-size: 64px; margin-bottom: 16px;">🖼️</div>
                  <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">正在加载文件...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // 绑定返回按钮
      document.getElementById('gm-back-to-list')?.addEventListener('click', () => {
        // 返回列表时不自动展开第一条，保持列表纯展示
        gmCurrentRecord = null;
        gmCurrentFolderId = null;
        gmRootFolderId = null;
        gmBaseRecord = null;
        gmRecordListVisible = true; // 返回列表时默认显示卡片列表
        gmFilterRecords({ autoOpen: false });
      });

      const tabs = document.querySelectorAll('#gm-folder-tabs button[data-folder-id]');
      tabs.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.dataset.folderId;
          const targetRecord = availableRecords.find(r => r.folderId === targetId);
          if (targetRecord) {
            gmShowFolderFiles(targetRecord);
          }
        });
      });
    }

    // 加载目录树（保持同一个根，树内点击也刷新视图）
    if (renderTree) {
      const treeRootId = gmRootFolderId || record.folderId;
      await gmRenderFolderTree(treeRootId, gmRootLabel || record.folderName || record.contentType || '根目录');
    }

    try {
      const thumbPanel = document.getElementById('gm-thumb-panel');
      const previewPanel = document.getElementById('gm-preview-panel');
      const previewCloseBtn = document.getElementById('gm-preview-close');
      const previewToggleBtn = document.getElementById('gm-toggle-preview');
      const recordListToggleBtn = document.getElementById('gm-toggle-record-list');
      const divider = document.getElementById('gm-panel-divider');
      const panelRow = document.getElementById('gm-panel-row');

      if (previewToggleBtn && !previewToggleBtn.dataset.bound) {
        previewToggleBtn.dataset.bound = 'true';
        previewToggleBtn.addEventListener('click', () => {
          gmPreviewVisible = !gmPreviewVisible;
          gmApplyPreviewVisibility();
        });
      }

      if (previewCloseBtn && !previewCloseBtn.dataset.bound) {
        previewCloseBtn.dataset.bound = 'true';
        previewCloseBtn.addEventListener('click', () => {
          gmPreviewVisible = false;
          gmApplyPreviewVisibility();
        });
      }

      if (recordListToggleBtn && !recordListToggleBtn.dataset.bound) {
        recordListToggleBtn.dataset.bound = 'true';
        recordListToggleBtn.addEventListener('click', () => {
          gmRecordListVisible = !gmRecordListVisible;
          gmApplyRecordListVisibility();
        });
      }

      // 拖拽调整缩略图区/预览区比例
      if (divider && panelRow && !divider.dataset.bound) {
        divider.dataset.bound = 'true';
        let dragging = false;
        const onMouseMove = (e) => {
          if (!dragging || !gmPreviewVisible) return;
          const rect = panelRow.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          gmPreviewRatio = Math.min(0.8, Math.max(0.2, ratio));
          gmApplyPreviewVisibility();
        };
        const stopDrag = () => { dragging = false; };
        divider.addEventListener('mousedown', (e) => {
          if (!gmPreviewVisible) return;
          dragging = true;
          e.preventDefault();
        });
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', stopDrag);
        window.addEventListener('mouseleave', stopDrag);
      }

      // 初始时执行一次，确保默认隐藏生效
      gmApplyPreviewVisibility();
      gmApplyRecordListVisibility();
      if (!skipResetUI) {
        // 不显示加载提示,直接渲染空白,让缓存加载更快更流畅
        if (thumbPanel) thumbPanel.innerHTML = '';
        if (previewPanel) previewPanel.innerHTML = '<div style="text-align: center; color: #cbd5e1;">选择文件查看</div>';
      }

      const cacheKey = `${record.folderId}|${currentOptions.recursive ? 'deep' : 'flat'}|${currentOptions.maxResults || 'all'}`;
      let details = gmFolderCache.get(cacheKey);

      // 优化：先从本地文件索引快速获取已缓存的文件（秒开）
      let useLocalIndexFirst = false;
      if (!details && gmFileIndex && gmFileIndex.length > 0) {
        const localFiles = gmFileIndex.filter(f => f.folderId === record.folderId);
        if (localFiles.length > 0) {
          console.log('[GM] 使用本地索引快速显示', localFiles.length, '个文件');
          details = {
            folderId: record.folderId,
            files: localFiles,
            fileCount: localFiles.length,
            images: localFiles.filter(f => f.type === 'image'),
            videos: localFiles.filter(f => f.type === 'video'),
            subFolders: [],
            fromLocalIndex: true // 标记来自本地索引
          };
          useLocalIndexFirst = true;
        }
      }

      // 如果没有本地索引或强制刷新，从API获取
      if (!details || gmForceFolderRefresh) {
        if (gmForceFolderRefresh) gmFolderCache.delete(cacheKey);
        const loadOptions = {
          recursive: !!currentOptions.recursive
        };
        if (currentOptions.maxResults && currentOptions.maxResults > 0) {
          loadOptions.maxResults = currentOptions.maxResults;
        }
        details = await window.bridge.getMediaFolderDetails(record.folderId, loadOptions);
        gmFolderCache.set(cacheKey, details);
      } else if (useLocalIndexFirst) {
        // 已使用本地索引快速显示，在后台静默刷新获取最新数据
        setTimeout(async () => {
          try {
            const loadOptions = { recursive: !!currentOptions.recursive };
            if (currentOptions.maxResults && currentOptions.maxResults > 0) {
              loadOptions.maxResults = currentOptions.maxResults;
            }
            const freshDetails = await window.bridge.getMediaFolderDetails(record.folderId, loadOptions);
            gmFolderCache.set(cacheKey, freshDetails);
            // 如果文件数有变化，提示用户刷新
            if (freshDetails.fileCount !== details.fileCount) {
              console.log('[GM] 后台刷新完成，文件数变化:', details.fileCount, '->', freshDetails.fileCount);
            }
          } catch (err) {
            console.warn('[GM] 后台刷新失败:', err);
          }
        }, 100);
      }
      if (!thumbPanel) return;

      const files = details.files || [];
      gmCurrentFiles = files;
      if (!skipResetUI) {
        gmSelectedFiles = new Set(); // 切换文件夹时清空选择
      }
      const subFolders = details.subFolders || [];

      // 合并到文件索引（增量），并提示变更
      const diff = gmSyncFolderIndex(record, details);
      if ((diff?.added || 0) + (diff?.removed || 0) + (diff?.updated || 0) > 0) {
        appendLog({ status: 'info', message: `索引更新 · 新增 ${diff.added || 0} · 删除 ${diff.removed || 0} · 变更 ${diff.updated || 0}` });
      }

      // 将子目录写入树缓存，便于后续展开
      if (subFolders && (!gmFolderTreeCache.has(record.folderId) || (gmFolderTreeCache.get(record.folderId) || []).length === 0)) {
        gmFolderTreeCache.set(record.folderId, subFolders);
      }

      // 仅在首次加载或切换文件夹时清空，加载更多时保留已有内容
      if (!isLoadingMore) {
        thumbPanel.innerHTML = '';
      }

      // 顶部筛选（子文件夹 + 加载范围）
      const controlsContainer = document.createElement('div');
      controlsContainer.style.cssText = 'position:sticky; top:0; z-index:5; background:white; padding:10px 10px 12px 10px; border-bottom:1px solid #e2e8f0;';

      const filterBar = document.createElement('div');
      filterBar.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; margin-bottom:10px;';

      const leftControls = document.createElement('div');
      leftControls.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; align-items:center;';

      const subfolderGroup = document.createElement('div');
      subfolderGroup.style.cssText = 'display:flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc;';
      const filterLabel = document.createElement('span');
      filterLabel.textContent = '子文件夹';
      filterLabel.style.cssText = 'color:#475569; font-size:13px;';
      const select = document.createElement('select');
      select.id = 'gm-subfolder-filter';
      select.style.cssText = 'padding:6px 8px; border:1px solid #e2e8f0; border-radius:8px; background:white;';
      const allOption = document.createElement('option');
      allOption.value = 'all';
      allOption.textContent = '全部文件';
      select.appendChild(allOption);
      subFolders.forEach(folder => {
        const opt = document.createElement('option');
        opt.value = folder.id;
        opt.textContent = folder.name || folder.id;
        select.appendChild(opt);
      });
      subfolderGroup.appendChild(filterLabel);
      subfolderGroup.appendChild(select);

      const thumbSizeControl = gmCreateThumbSizeControl(() => {
        renderGrid(currentFiltered);
        updateCounter(currentFiltered);
      });
      thumbSizeControl.style.marginLeft = '6px';

      leftControls.appendChild(subfolderGroup);
      leftControls.appendChild(thumbSizeControl);

      const rightControls = document.createElement('div');
      rightControls.style.cssText = 'display:flex; align-items:center; gap:10px; flex-wrap:wrap;';
      const includeLabel = document.createElement('label');
      includeLabel.style.cssText = 'display:flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc;';
      includeLabel.innerHTML = '<input type="checkbox" id="gm-include-subfolders" style="width:14px; height:14px;"> <span style="color:#475569; font-size:13px;">包含子文件夹</span>';
      const includeCheckbox = includeLabel.querySelector('input');
      includeCheckbox.checked = currentOptions.recursive !== false;

      const limitGroup = document.createElement('div');
      limitGroup.style.cssText = 'display:flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc;';
      const limitLabel = document.createElement('span');
      limitLabel.textContent = '最多加载';
      limitLabel.style.cssText = 'color:#475569; font-size:13px;';
      const limitSelect = document.createElement('select');
      limitSelect.id = 'gm-max-results';
      limitSelect.style.cssText = 'padding:6px 8px; border:1px solid #e2e8f0; border-radius:8px; background:white;';
      const limits = [50, 200, 500, 1000, 2000, 5000, 10000, 50000, 0];
      limits.forEach(n => {
        const opt = document.createElement('option');
        opt.value = String(n);
        opt.textContent = n === 0 ? '无限制' : `${n} 个`;
        if ((currentOptions.maxResults || 0) === n) {
          opt.selected = true;
        }
        limitSelect.appendChild(opt);
      });
      if (![50, 200, 500, 1000, 2000, 5000, 10000, 50000, 0].includes(currentOptions.maxResults || 0)) {
        limitSelect.value = String(currentOptions.maxResults || 50);
      }
      limitGroup.appendChild(limitLabel);
      limitGroup.appendChild(limitSelect);

      rightControls.appendChild(includeLabel);
      rightControls.appendChild(limitGroup);

      filterBar.appendChild(leftControls);
      filterBar.appendChild(rightControls);

      const hint = null; // 取消底部提示显示

      controlsContainer.appendChild(filterBar);

      const actionBar = document.createElement('div');
      actionBar.style.cssText = 'display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap;';
      actionBar.innerHTML = `
        <button type="button" class="ghost" id="gm-refresh-folder">刷新当前目录</button>
        <button type="button" class="ghost" id="gm-select-all">全选</button>
        <button type="button" class="ghost" id="gm-select-none">清空</button>
        <button type="button" class="ghost" id="gm-select-invert">反选</button>
        <button type="button" class="primary" id="gm-download-selected">下载选中</button>
        <span id="gm-selection-counter" style="color:#475569; font-size:13px;"></span>
      `;
      controlsContainer.appendChild(actionBar);

      // 去掉提示文案显示，界面更简洁

      if (!isLoadingMore) {
        thumbPanel.appendChild(controlsContainer);
      }

      // 复用已有的 gridWrapper（用类名标识，避免选择器匹配失败导致重复容器）
      let gridWrapper = thumbPanel.querySelector('.gm-grid-wrapper');
      if (!gridWrapper) {
        gridWrapper = document.createElement('div');
        gridWrapper.className = 'gm-grid-wrapper';
        gridWrapper.style.marginTop = '6px';
        thumbPanel.appendChild(gridWrapper);
      }

      function renderGrid(filteredFiles, appendMode = false) {
        // 首先删除旧的"加载更多"按钮（如果存在），防止它卡在文件中间
        const oldLoadMoreBtn = gridWrapper.querySelector('.gm-load-more-btn');
        if (oldLoadMoreBtn) {
          console.log('[DEBUG] 在renderGrid开始时删除旧按钮');
          oldLoadMoreBtn.remove();
        }

        // 仅在非追加模式时清空，追加模式保留已有内容
        if (!appendMode) {
          gridWrapper.innerHTML = '';
        }

        if (!filteredFiles.length) {
          // 只在非追加模式显示空状态提示
          if (!appendMode) {
            if (files.length === 0 && subFolders.length === 0) {
              gridWrapper.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">空文件夹 · 无子文件夹</div>';
            } else if (files.length > 0 && subFolders.length === 0) {
              gridWrapper.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">无子文件夹</div>';
            } else {
              gridWrapper.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">此范围下无文件，可继续选择子文件夹</div>';
            }
          }
          return;
        }

        // 恢复预览区占位提示（非追加模式）
        if (previewPanel && !appendMode) {
          previewPanel.innerHTML = `
            <div style="text-align: center; color: #94a3b8;">
              <div style="font-size: 64px; margin-bottom: 16px;">🖼️</div>
              <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">点击左侧文件查看</div>
              <div style="font-size: 14px;">支持滚轮缩放 · 拖拽移动</div>
            </div>
          `;
        }

        // 复用已有的 grid 或创建新的
        let grid = appendMode ? gridWrapper.querySelector('div[style*="grid-template-columns"]') : null;
        if (!grid) {
          grid = document.createElement('div');
          grid.style.cssText = 'display: grid; gap: 12px;';
          gmApplyThumbGridStyle(grid);
          gridWrapper.appendChild(grid);
        } else {
          gmApplyThumbGridStyle(grid);
        }

        // 计算需要渲染的文件（追加模式下只渲染新增的文件）
        const previousMaxResults = window.gmPreviousMaxResults || 0;
        const startIndex = appendMode ? previousMaxResults : 0;
        const filesToRender = appendMode ? filteredFiles.slice(startIndex) : filteredFiles;

        filesToRender.forEach(file => {
          const item = document.createElement('div');
          item.className = 'gm-file-item';
          item.dataset.fileId = file.id;
          item.title = '双击缩略图可打开预览面板';
          const thumbRequestSize = gmGetThumbRequestSize();
          item.innerHTML = `
            <div class="gm-thumb-wrapper">
              <label class="gm-select-checkbox" style="position:absolute; top:6px; left:6px; z-index:2; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background: rgba(15,23,42,0.55); border:1px solid rgba(255,255,255,0.75); box-shadow: 0 1px 3px rgba(0,0,0,0.22); padding:0;">
                <input type="checkbox" data-file-id="${file.id}" style="width:14px; height:14px; margin:0; accent-color:#3b82f6; cursor:pointer;">
              </label>
              <button type="button" class="gm-download-btn" data-file-id="${file.id}" title="下载"
                style="position:absolute; top:6px; right:6px; z-index:2; width:28px; height:28px; border-radius:50%; background: rgba(15,23,42,0.55); border:1px solid rgba(255,255,255,0.75); padding:0; cursor:pointer; color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.22); display:flex; align-items:center; justify-content:center; font-size:15px;">
                ⬇︎
              </button>
              <div class="gm-thumb-container">
                <img data-thumb-id="${file.id}" src="https://drive.google.com/thumbnail?id=${file.id}&sz=w${thumbRequestSize}" alt="${file.name || ''}" loading="lazy"
                  style="width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity 0.2s ease; background:linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9);">
                ${file.type === 'video' ? '<div class="gm-video-overlay">▶</div>' : ''}
              </div>
            </div>
            <div class="gm-file-name">${file.name || ''}</div>
          `;
          const thumbContainer = item.querySelector('.gm-thumb-container');
          const imgEl = item.querySelector('img[data-thumb-id]');
          if (thumbContainer) thumbContainer.title = '双击缩略图打开预览';
          gmLoadThumbImage(imgEl, file.id);

          const checkbox = item.querySelector('input[type="checkbox"]');
          const downloadBtn = item.querySelector('.gm-download-btn');

          if (checkbox) {
            checkbox.checked = gmSelectedFiles.has(file.id);
            checkbox.addEventListener('click', (e) => {
              e.stopPropagation();
              toggleSelection(file, checkbox.checked);
            });
          }

          if (downloadBtn) {
            downloadBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              await gmDownloadFiles([file]);
            });
          }

          item.addEventListener('click', (e) => {
            gmShowPreview(file);
            // 预览面板隐藏时，单击立即提示双击可打开预览
            if (!gmPreviewVisible) {
              gmShowQuickHint('双击缩略图打开预览面板', e.clientX, e.clientY);
            }
          });
          item.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (!gmPreviewVisible) {
              gmPreviewVisible = true;
              gmApplyPreviewVisibility();
            }
            gmShowPreview(file);
          });
          grid.appendChild(item);
        });

        // 处理"加载更多"按钮 - 如果需要则创建新按钮（旧按钮已在函数开始时删除）
        const showLoadMore = currentOptions.maxResults > 0 && files.length >= currentOptions.maxResults;
        if (showLoadMore) {
          const loadMoreBtn = document.createElement('button');
          loadMoreBtn.textContent = '加载更多 (+50)';
          loadMoreBtn.className = 'ghost gm-load-more-btn';
          loadMoreBtn.style.cssText = 'margin: 12px auto; display: block;';

          let loadingMoreFiles = false;
          loadMoreBtn.addEventListener('click', async () => {
            // 若仍在加载上一批数据，则直接退出并保持按钮可用，避免卡住在"加载中..."
            if (loadingMoreFiles || gmLoadingFiles) return;

            loadingMoreFiles = true;
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = '加载中...';

            // 保存当前的 maxResults 用于计算增量
            window.gmPreviousMaxResults = currentOptions.maxResults;

            currentOptions.maxResults = currentOptions.maxResults + 50;
            gmFolderOptionsMap.set(record.folderId, { ...currentOptions });

            try {
              await gmShowFolderFiles(record, targetPane, true, false, true);
            } finally {
              loadingMoreFiles = false;
              // 若加载被阻断或失败，恢复按钮状态，避免一直显示"加载中..."
              if (document.body.contains(loadMoreBtn)) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = '加载更多 (+50)';
              }
            }
          });
          console.log('[DEBUG] 创建新的加载更多按钮并添加到gridWrapper末尾');
          gridWrapper.appendChild(loadMoreBtn);
        }
      }

      function filterFilesByFolder(folderId) {
        if (!folderId || folderId === 'all') {
          return files;
        }
        return files.filter(f => (f.parents || []).includes(folderId));
      }

      select.addEventListener('change', () => {
        currentFiltered = filterFilesByFolder(select.value);
        renderGrid(currentFiltered);
        updateCounter(currentFiltered);
      });

      const selectAllBtn = document.getElementById('gm-select-all');
      const selectNoneBtn = document.getElementById('gm-select-none');
      const selectInvertBtn = document.getElementById('gm-select-invert');
      const downloadSelectedBtn = document.getElementById('gm-download-selected');
      const selectionCounter = document.getElementById('gm-selection-counter');

      function updateCounter(filtered) {
        if (selectionCounter) {
          const total = Array.isArray(filtered) ? filtered.length : 0;
          selectionCounter.textContent = `已选 ${gmSelectedFiles.size} / ${total}`;
        }
      }

      function toggleSelection(file, checked) {
        if (!file?.id) return;
        if (checked) {
          gmSelectedFiles.add(file.id);
        } else {
          gmSelectedFiles.delete(file.id);
        }
        updateCounter(currentFiltered);
      }

      function selectAll(filtered) {
        filtered.forEach(f => gmSelectedFiles.add(f.id));
        renderGrid(filtered);
        updateCounter(filtered);
      }

      function selectNone(filtered) {
        gmSelectedFiles.clear();
        renderGrid(filtered);
        updateCounter(filtered);
      }

      function selectInvert(filtered) {
        const next = new Set();
        filtered.forEach(f => {
          if (!gmSelectedFiles.has(f.id)) {
            next.add(f.id);
          }
        });
        gmSelectedFiles = next;
        renderGrid(filtered);
        updateCounter(filtered);
      }

      async function downloadSelected(filtered) {
        if (!gmSelectedFiles.size) {
          appendLog({ status: 'warning', message: '请先选择要下载的文件' });
          return;
        }
        const selectedFiles = filtered.filter(f => gmSelectedFiles.has(f.id));
        await gmDownloadFiles(selectedFiles);
      }

      let currentFiltered = files;

      selectAllBtn?.addEventListener('click', () => selectAll(currentFiltered));
      selectNoneBtn?.addEventListener('click', () => selectNone(currentFiltered));
      selectInvertBtn?.addEventListener('click', () => selectInvert(currentFiltered));
      downloadSelectedBtn?.addEventListener('click', () => downloadSelected(currentFiltered));

      includeCheckbox?.addEventListener('change', () => {
        currentOptions.recursive = includeCheckbox.checked;
        gmFolderOptionsMap.set(record.folderId, { ...currentOptions });
        // 仅刷新文件，不重建树，避免跳转
        gmShowFolderFiles(record, targetPane, true, false);
      });

      limitSelect.addEventListener('change', () => {
        const val = Number(limitSelect.value);
        currentOptions.maxResults = val === 0 ? 0 : val;
        gmFolderOptionsMap.set(record.folderId, { ...currentOptions });
        // 仅刷新文件，不重建树，避免跳转
        gmShowFolderFiles(record, targetPane, true, false);
      });

      // 在加载更多时也要更新提示信息
      if (hint) {
        hint.textContent = `${currentOptions.recursive ? '含所有子文件夹' : '仅当前文件夹'} · 最多 ${currentOptions.maxResults || '全部'} 个`;
      }

      if (!files.length) {
        currentFiltered = [];
        renderGrid([], false); // 不使用追加模式
        updateCounter(currentFiltered);
      } else {
        currentFiltered = filterFilesByFolder(select.value);
        // 在加载更多时使用追加模式，首次加载时不使用
        renderGrid(currentFiltered, isLoadingMore);
        updateCounter(currentFiltered);
      }
    } catch (error) {
      console.error('加载失败:', error);
      document.getElementById('gm-thumb-panel').innerHTML = '<div style="padding: 40px; color: #ef4444;">加载失败</div>';
    } finally {
      gmLoadingFiles = false;
    }
  }

  // 在右侧预览区显示图片
  let gmScale = 1, gmX = 0, gmY = 0, gmDragging = false, gmStartX = 0, gmStartY = 0;

  function gmShowPreview(file) {
    const panel = document.getElementById('gm-preview-panel');
    if (!panel) return;

    gmScale = 1; gmX = 0; gmY = 0;
    const isVideo = file.type === 'video';

    // 保证预览面板右上角有关闭按钮
    function ensurePreviewCloseButton(targetPanel) {
      if (!targetPanel) return;
      let closeBtn = targetPanel.querySelector('#gm-preview-close');
      if (!closeBtn) {
        closeBtn = document.createElement('button');
        closeBtn.id = 'gm-preview-close';
        closeBtn.className = 'ghost';
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'position:absolute; top:8px; right:8px; z-index:3; background: rgba(255,255,255,0.12); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 4px 8px; cursor: pointer;';
        closeBtn.addEventListener('click', () => {
          gmPreviewVisible = false;
          gmApplyPreviewVisibility();
        });
        targetPanel.appendChild(closeBtn);
      }
    }

    if (isVideo) {
      // 优先使用 Drive 自带播放器，兼容云端大视频
      const drivePreviewUrl = file.webViewLink
        ? file.webViewLink.replace('/view', '/preview')
        : `https://drive.google.com/file/d/${file.id}/preview`;
      const videoUrl = `https://drive.google.com/uc?id=${file.id}&export=download`;
      panel.innerHTML = `
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #cbd5e1; z-index: 1; pointer-events: none;">
          <span id="gm-video-loading">正在加载视频...</span>
        </div>
        <iframe id="gm-drive-iframe" src="${drivePreviewUrl}" allow="autoplay; fullscreen" frameborder="0"
                style="width: 100%; height: 100%; border: none; background: #0f172a;"></iframe>
        <video id="gm-preview-video" src="${videoUrl}" controls autoplay playsinline
               style="max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; background: #0f172a; border-radius: 8px; display:none;"></video>
        <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 12px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); color: white;">
          <div style="font-weight: 600; margin-bottom: 4px;">${file.name || ''}</div>
          <div style="font-size: 12px; opacity: 0.9;">播放不出？稍等或双击用浏览器全屏</div>
        </div>
      `;
      ensurePreviewCloseButton(panel);
      // 清理旧的缩放事件，避免影响视频控件
      panel.onwheel = null;
      // 兜底：iframe 加载失败时展示本地 video 播放
      const iframe = document.getElementById('gm-drive-iframe');
      const htmlVideo = document.getElementById('gm-preview-video');
      const loading = document.getElementById('gm-video-loading');
      if (iframe) {
        iframe.addEventListener('load', () => {
          if (loading) loading.textContent = '';
        });
        iframe.addEventListener('error', () => {
          iframe.style.display = 'none';
          if (htmlVideo) htmlVideo.style.display = 'block';
          if (loading) loading.textContent = '';
        });
      }
      if (htmlVideo) {
        htmlVideo.addEventListener('loadeddata', () => {
          if (loading) loading.textContent = '';
          if (!iframe || iframe.style.display === 'none') {
            htmlVideo.style.display = 'block';
          }
        });
        htmlVideo.addEventListener('error', () => {
          if (loading) loading.textContent = '视频加载失败';
        });
      }
      return;
    }

    const url = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`;

    panel.innerHTML = `
      <img id="gm-preview-img" src="${url}" alt="${file.name || ''}" 
           style="max-width: 100%; max-height: 100%; cursor: grab; user-select: none;" draggable="false">
      <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 12px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); color: white;">
        <div style="font-weight: 600; margin-bottom: 4px;">${file.name || ''}</div>
        <div style="font-size: 12px; opacity: 0.9;"><span id="gm-scale">100%</span> · 滚轮缩放 · 拖拽移动 · 双击重置</div>
      </div>
    `;
    ensurePreviewCloseButton(panel);

    panel.onwheel = (e) => {
      e.preventDefault();
      gmScale *= e.deltaY > 0 ? 0.9 : 1.1;
      gmScale = Math.max(0.1, Math.min(10, gmScale));
      updateTransform();
    };

    const img = document.getElementById('gm-preview-img');
    img.onmousedown = (e) => {
      gmDragging = true;
      gmStartX = e.clientX - gmX;
      gmStartY = e.clientY - gmY;
      img.style.cursor = 'grabbing';
    };

    img.ondblclick = () => {
      gmScale = 1; gmX = 0; gmY = 0;
      updateTransform();
    };

    document.onmousemove = (e) => {
      if (gmDragging) {
        gmX = e.clientX - gmStartX;
        gmY = e.clientY - gmStartY;
        updateTransform();
      }
    };

    document.onmouseup = () => {
      gmDragging = false;
      const img = document.getElementById('gm-preview-img');
      if (img) img.style.cursor = gmScale > 1 ? 'grab' : 'default';
    };
  }

  // ===== 目录树（懒加载） =====
  async function gmRenderFolderTree(rootId, rootLabel) {
    const treePane = document.getElementById('gm-tree-pane') || gmElements.folderTree;
    if (!treePane) return;

    treePane.innerHTML = '<div style="color:#94a3b8; text-align:center; padding: 20px;">目录加载中...</div>';

    try {
      await gmEnsureTreeChildren(rootId);
      const treeRoot = document.createElement('div');
      treeRoot.style.cssText = 'display:flex; flex-direction:column; gap:4px;';

      const rootNode = { id: rootId, name: rootLabel || '根目录' };
      renderTreeNode(rootNode, treeRoot, 0);

      treePane.innerHTML = '';
      treePane.appendChild(treeRoot);
    } catch (error) {
      console.error('加载目录树失败:', error);
      treePane.innerHTML = '<div style="color:#ef4444; padding: 12px;">目录加载失败</div>';
    }
  }

  async function gmEnsureTreeChildren(folderId) {
    if (gmFolderTreeCache.has(folderId) && (gmFolderTreeCache.get(folderId) || []).length) {
      return gmFolderTreeCache.get(folderId);
    }
    const children = await window.bridge.getMediaFolderTree(folderId);
    gmFolderTreeCache.set(folderId, children || []);
    return children || [];
  }

  function renderTreeNode(node, container, depth) {
    const children = gmFolderTreeCache.get(node.id) || [];
    const isExpanded = gmExpandedFolders.has(node.id) || node.id === gmCurrentFolderId || node.id === gmRootFolderId;
    const isActive = node.id === gmCurrentFolderId;

    const row = document.createElement('div');
    row.style.cssText = `display:flex; align-items:center; gap:6px; padding:4px 6px; border-radius:6px; cursor:pointer; ${isActive ? 'background:#e0ebff;' : ''}`;
    row.dataset.folderId = node.id;
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (node.id === gmCurrentFolderId) return;
      gmExpandedFolders.add(node.id);
      gmShowFolderFiles({ ...gmBaseRecord, folderId: node.id, folderName: node.name }, null, true);
    });

    const toggle = document.createElement('span');
    toggle.textContent = isExpanded ? '▼' : '▶';
    toggle.style.cssText = 'width:14px; color:#475569;';
    toggle.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (isExpanded) {
        gmExpandedFolders.delete(node.id);
      } else {
        gmExpandedFolders.add(node.id);
        const cached = gmFolderTreeCache.get(node.id) || [];
        if (!cached.length) {
          await gmEnsureTreeChildren(node.id);
        }
      }
      gmRenderFolderTree(gmRootFolderId || node.id, gmBaseRecord?.folderName || gmBaseRecord?.contentType || '根目录');
    });

    const label = document.createElement('span');
    label.textContent = node.name || node.id;
    label.style.cssText = `flex:1; color:${isActive ? '#1d4ed8' : '#0f172a'}; font-weight:${isActive ? '600' : '400'};`;

    // 缩进
    row.style.paddingLeft = `${depth * 12 + 4}px`;

    row.prepend(toggle);
    row.appendChild(label);
    container.appendChild(row);

    if (isExpanded) {
      // 确保有子节点数据，若为空则尝试懒加载后再渲染
      if (!children.length) {
        gmEnsureTreeChildren(node.id).then((loaded) => {
          if ((loaded || []).length) {
            gmRenderFolderTree(gmRootFolderId || node.id, gmRootLabel || gmBaseRecord?.folderName || gmBaseRecord?.contentType || '根目录');
          }
        });
      } else {
        children.forEach(child => {
          renderTreeNode(child, container, depth + 1);
        });
      }
    }
  }

  // 下载文件（扁平保存到配置目录）
  async function gmDownloadFiles(files = []) {
    if (!Array.isArray(files) || files.length === 0) {
      appendLog({ status: 'warning', message: '没有选择文件可下载' });
      return;
    }

    const destDir =
      state.config.mediaDownloadDir ||
      elements.mediaDownloadDir?.value?.trim() ||
      '';

    if (!destDir) {
      appendLog({ status: 'warning', message: '请在设置中配置媒体下载目录' });
      return;
    }

    try {
      appendLog({ status: 'info', message: `开始下载 ${files.length} 个文件...` });
      const payload = {
        files: files.map(f => ({ id: f.id, name: f.name })),
        destDir
      };
      const result = await window.bridge.downloadMediaFiles(payload);
      const successCount = result?.results?.filter(r => r.status === 'success').length || 0;
      const failCount = result?.results?.filter(r => r.status === 'error').length || 0;
      appendLog({
        status: failCount ? 'warning' : 'success',
        message: `下载完成：成功 ${successCount}，失败 ${failCount}${result?.message ? ' · ' + result.message : ''}`
      });
    } catch (error) {
      appendLog({ status: 'error', message: `下载失败：${error.message}` });
    }
  }

  function updateTransform() {
    const img = document.getElementById('gm-preview-img');
    if (img) {
      img.style.transform = `scale(${gmScale}) translate(${gmX / gmScale}px, ${gmY / gmScale}px)`;
      document.getElementById('gm-scale').textContent = `${Math.round(gmScale * 100)}%`;
    }
  }

  // 返回记录列表
  window.gmBackToRecordList = function () {
    gmFilterRecords();
  };

  // 显示文件夹模态窗口
  async function gmShowFolderModal() {
    if (!gmElements.folderModal) return;

    gmElements.folderModal.hidden = false;
    if (gmElements.modalLoading) gmElements.modalLoading.hidden = false;
    if (gmElements.fileGrid) gmElements.fileGrid.innerHTML = '';
    if (gmElements.modalEmpty) gmElements.modalEmpty.hidden = true;

    if (gmCurrentRecord && gmElements.modalFolderName && gmElements.modalMeta) {
      gmElements.modalFolderName.textContent = `${gmCurrentRecord.contentType || ''} - ${gmCurrentRecord.submitter || ''}`;
      gmElements.modalMeta.textContent = `链接说明：${gmCurrentRecord.admin || ''}${gmCurrentRecord.submitTime ? ' | ' + gmFormatTime(gmCurrentRecord.submitTime) : ''}`;
    }

    try {
      let details = gmFolderCache.get(gmCurrentFolderId);
      if (!details) {
        details = await window.bridge.getMediaFolderDetails(gmCurrentFolderId, { recursive: true });
        gmFolderCache.set(gmCurrentFolderId, details);
      }

      if (gmElements.modalLoading) gmElements.modalLoading.hidden = true;

      if (!details?.files || details.files.length === 0) {
        if (gmElements.modalEmpty) gmElements.modalEmpty.hidden = false;
        return;
      }

      details.files.forEach(file => {
        const fileItem = gmCreateFileItem(file);
        if (gmElements.fileGrid) gmElements.fileGrid.appendChild(fileItem);
      });
    } catch (error) {
      console.error('加载文件夹详情失败:', error);
      if (gmElements.modalLoading) gmElements.modalLoading.hidden = true;
      if (gmElements.modalEmpty) gmElements.modalEmpty.hidden = false;
      appendLog({ status: 'error', message: '加载失败：' + error.message });
    }
  }

  // 创建文件项
  function gmCreateFileItem(file) {
    const item = document.createElement('div');
    item.className = 'gm-file-item';

    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`;

    if (file.type === 'image') {
      const img = document.createElement('img');
      img.src = thumbnailUrl;
      img.alt = file.name || '';
      img.loading = 'lazy';
      item.appendChild(img);
    } else if (file.type === 'video') {
      const img = document.createElement('img');
      img.src = thumbnailUrl;
      img.alt = file.name || '';
      img.loading = 'lazy';
      item.appendChild(img);

      const overlay = document.createElement('div');
      overlay.className = 'gm-video-overlay';
      overlay.textContent = '▶';
      item.appendChild(overlay);
    }

    item.addEventListener('click', () => {
      gmShowFilePreview(file);
    });

    return item;
  }

  // 显示文件预览
  function gmShowFilePreview(file) {
    if (!gmElements.filePreviewModal || !gmElements.previewContainer) return;

    gmElements.filePreviewModal.hidden = false;
    gmElements.previewContainer.innerHTML = '';

    if (file.type === 'image') {
      const img = document.createElement('img');
      img.src = `https://drive.google.com/uc?id=${file.id}&export=download`;
      img.alt = file.name || '';
      gmElements.previewContainer.appendChild(img);
    } else if (file.type === 'video') {
      const video = document.createElement('video');
      video.src = `https://drive.google.com/uc?id=${file.id}&export=download`;
      video.controls = true;
      video.autoplay = true;
      gmElements.previewContainer.appendChild(video);
    }
  }

  // 关闭文件夹模态窗口
  function gmCloseFolderModal() {
    if (gmElements.folderModal) gmElements.folderModal.hidden = true;
    if (gmElements.fileGrid) gmElements.fileGrid.innerHTML = '';
    gmCurrentFolderId = null;
  }

  // 关闭文件预览
  function gmCloseFilePreview() {
    if (gmElements.filePreviewModal) gmElements.filePreviewModal.hidden = true;
    if (gmElements.previewContainer) gmElements.previewContainer.innerHTML = '';
  }

  // 在 Google Drive 中打开文件夹
  async function gmOpenFolderInDrive() {
    if (!gmCurrentFolderId) return;
    try {
      await window.bridge.openDriveFolder?.(gmCurrentFolderId);
    } catch (error) {
      console.error('打开文件夹失败:', error);
      appendLog({ status: 'error', message: '打开失败' });
    }
  }

  // 格式化时间
  function gmFormatTime(timeStr) {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (minutes < 1) return '刚刚';
      if (minutes < 60) return `${minutes} 分钟前`;
      if (hours < 24) return `${hours} 小时前`;
      if (days < 7) return `${days} 天前`;

      return date.toLocaleDateString('zh-CN');
    } catch (error) {
      return timeStr;
    }
  }

  // 防抖函数
  function gmDebounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 设置事件监听器
  gmElements.toggleViewBtn?.addEventListener('click', gmToggleView);
  gmElements.refreshBtn?.addEventListener('click', gmHandleRefresh);
  gmElements.submitForm?.addEventListener('submit', gmHandleSubmit);
  gmElements.previewFolderBtn?.addEventListener('click', gmHandlePreviewFolder);
  gmElements.submitAnotherBtn?.addEventListener('click', gmResetForm);
  gmElements.submitModalClose?.addEventListener('click', gmCloseSubmitModal);
  gmElements.submitModalCancel?.addEventListener('click', gmCloseSubmitModal);
  gmElements.submitModal?.querySelector('.modal-overlay')?.addEventListener('click', gmCloseSubmitModal);
  gmElements.filterType?.addEventListener('change', gmFilterRecords);
  gmElements.submitterFilter?.addEventListener('change', gmFilterRecords);
  gmElements.sortBy?.addEventListener('change', gmFilterRecords);
  gmElements.closeModalBtn?.addEventListener('click', gmCloseFolderModal);
  gmElements.cancelModalBtn?.addEventListener('click', gmCloseFolderModal);
  gmElements.openFolderBtn?.addEventListener('click', gmOpenFolderInDrive);
  gmElements.closePreviewBtn?.addEventListener('click', gmCloseFilePreview);

  // 模态窗口overlay点击
  gmElements.folderModal?.querySelector('.gm-modal-overlay')?.addEventListener('click', gmCloseFolderModal);
  gmElements.filePreviewModal?.querySelector('.gm-modal-overlay')?.addEventListener('click', gmCloseFilePreview);
  // 确保搜索框事件已绑定（若脚本早于 DOM 加载，可以重复调用）
  gmBindSearchInput();
  elements.thumbCacheClean?.addEventListener('click', async () => {
    console.log('[DEBUG] 清理缓存按钮被点击');
    if (elements.thumbCacheInfo) elements.thumbCacheInfo.textContent = '清理中...';
    const result = await window.bridge?.cleanThumbCache?.();
    console.log('[DEBUG] 清理缓存结果:', result);
    gmUpdateThumbCacheInfo();
  });
  elements.thumbCacheMaxSave?.addEventListener('click', async () => {
    const mb = Number(elements.thumbCacheMax?.value);
    if (!Number.isFinite(mb) || mb <= 0) {
      gmShowQuickHint('请输入有效的缓存上限', null, 60);
      return;
    }
    if (elements.thumbCacheInfo) elements.thumbCacheInfo.textContent = '保存中...';
    await window.bridge?.setThumbCacheMax?.(mb * 1024 * 1024);
    gmUpdateThumbCacheInfo();
  });
  elements.thumbCacheDirPick?.addEventListener('click', async () => {
    console.log('[DEBUG] 选择缓存目录按钮被点击');
    const dir = await window.bridge?.pickFolder?.();
    console.log('[DEBUG] 选择的目录:', dir);
    if (dir && elements.thumbCacheDir) {
      elements.thumbCacheDir.value = dir;
    }
  });
  elements.thumbCacheDir?.addEventListener('change', async () => {
    const dir = elements.thumbCacheDir.value?.trim();
    if (!dir) return;
    elements.thumbCacheInfo.textContent = '保存中...';
    await window.bridge?.setThumbCacheDir?.(dir);
    gmUpdateThumbCacheInfo();
  });
  gmUpdateThumbCacheInfo();

  // 绑定"全部缓存"按钮
  elements.thumbCacheAll?.addEventListener('click', async () => {
    await gmCacheAllThumbnails();
  });

  // 加载预缓存设置
  function gmLoadPrefetchSetting() {
    try {
      const enabled = localStorage.getItem('gm-prefetch-enabled');
      gmPrefetchEnabled = enabled !== 'false'; // 默认开启
      if (elements.enablePrefetch) {
        elements.enablePrefetch.checked = gmPrefetchEnabled;
      }
    } catch (err) {
      console.warn('读取预缓存设置失败', err);
    }
  }

  // 保存预缓存设置
  elements.enablePrefetch?.addEventListener('change', async () => {
    gmPrefetchEnabled = elements.enablePrefetch.checked;
    localStorage.setItem('gm-prefetch-enabled', String(gmPrefetchEnabled));

    if (gmPrefetchEnabled && gmFileIndex && gmFileIndex.length) {
      // 开启时检查空间并缓存
      const estimate = await gmEstimateCacheSize(gmFileIndex.length);
      const spaceCheck = await gmCheckCacheSpace(estimate.mb);

      if (spaceCheck.sufficient) {
        gmShowQuickHint('开始后台预缓存缩略图');
        gmPrefetchNewThumbnails(gmFileIndex, 'low');
      } else {
        const expanded = await gmPromptExpandCache(spaceCheck);
        if (expanded) {
          gmShowQuickHint('空间已扩容,开始预缓存');
          gmPrefetchNewThumbnails(gmFileIndex, 'low');
        }
      }
    } else {
      // 关闭时清空队列
      gmPrefetchQueue = [];
      gmShowQuickHint('已关闭自动预缓存');
    }
  });

  gmLoadPrefetchSetting();
  elements.fileIndexRefresh?.addEventListener('click', async () => {
    if (elements.fileIndexInfo) elements.fileIndexInfo.textContent = '刷新中...';
    await gmRefreshFileIndexIncremental();
    gmUpdateFileIndexInfo();
  });
  elements.fileIndexClear?.addEventListener('click', async () => {
    if (elements.fileIndexInfo) elements.fileIndexInfo.textContent = '清理中...';
    await window.bridge?.clearFileIndex?.();
    gmFileIndex = null;
    gmFileIndexTimestamp = 0;
    gmSetIndexStatus('idle');
    gmUpdateFileIndexInfo();
  });
  gmUpdateFileIndexInfo();

  // 初始化时自动填充提交人
  function gmUpdateSubmitter() {
    if (gmElements.submitterInput) {
      // 优先使用全局配置的提交人
      const submitter = state.config?.submitter || elements.metadata?.submitter?.value || '';
      gmElements.submitterInput.value = submitter;
    }
  }

  // 绑定搜索框事件（若初始未找到元素，可重复调用，带绑定标记）
  function gmBindSearchInput() {
    const input = document.getElementById('gm-search-input');
    const status = document.getElementById('gm-search-status');
    if (status) gmElements.searchStatus = status;
    if (!input || input.dataset.bound === 'true') return;
    gmElements.searchInput = input;
    input.dataset.bound = 'true';
    input.addEventListener('input', gmDebounce(gmHandleSearch, 300));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        gmHandleSearch();
      }
    });
  }

  let gmIndexRefreshTimer = null;
  // 定时刷新索引（后台）
  function gmScheduleIndexRefresh() {
    if (gmIndexRefreshTimer) clearInterval(gmIndexRefreshTimer);
    if (!gmEnableIndexTimer) return;
    gmIndexRefreshTimer = setInterval(() => {
      gmRefreshFileIndexIncremental().catch(err => console.warn('定时刷新索引失败', err));
    }, GM_INDEX_REFRESH_INTERVAL);
  }

  function gmLoadIndexInterval() {
    try {
      const saved = Number(localStorage.getItem('gm-index-refresh-minutes'));
      if (Number.isFinite(saved) && saved >= 5) {
        GM_INDEX_REFRESH_INTERVAL = saved * 60 * 1000;
        if (elements.fileIndexInterval) elements.fileIndexInterval.value = saved;
      }
      const timerEnabled = localStorage.getItem('gm-index-refresh-enabled');
      if (timerEnabled !== null) {
        gmEnableIndexTimer = timerEnabled === 'true';
        if (elements.indexRefreshTimer) elements.indexRefreshTimer.checked = gmEnableIndexTimer;
      }
      const forceRefresh = localStorage.getItem('gm-folder-force-refresh');
      if (forceRefresh !== null) {
        gmForceFolderRefresh = forceRefresh === 'true';
        if (elements.folderForceRefresh) elements.folderForceRefresh.checked = gmForceFolderRefresh;
      }
    } catch (err) {
      console.warn('读取索引刷新间隔失败', err);
    }
  }

  function gmSaveIndexInterval(minutes) {
    GM_INDEX_REFRESH_INTERVAL = minutes * 60 * 1000;
    try {
      localStorage.setItem('gm-index-refresh-minutes', String(minutes));
    } catch (err) {
      console.warn('保存索引刷新间隔失败', err);
    }
  }

  // 暴露到 window 对象，以便在视图切换时调用
  window.gmUpdateSubmitter = gmUpdateSubmitter;

  // 初始加载
  gmUpdateSubmitter();
  // 默认进入浏览视图自动加载记录
  // 初次进入组内媒体：只显示列表，不自动展开文件夹
  gmLoadMediaRecords(false);
  gmLoadIndexInterval();
  gmScheduleIndexRefresh();
  gmUpdateThumbCacheInfo();
  gmUpdateFileIndexInfo();

  // 设置区事件 (已在上面绑定过,这里的重复绑定已删除)
  elements.fileIndexIntervalSave?.addEventListener('click', () => {
    const minutes = Number(elements.fileIndexInterval?.value);
    if (!Number.isFinite(minutes) || minutes < 5) {
      gmShowQuickHint('请输入不少于 5 分钟的数值', null, 60);
      return;
    }
    gmSaveIndexInterval(minutes);
    gmScheduleIndexRefresh();
    gmShowQuickHint('索引刷新间隔已保存', null, 60);
  });
  document.getElementById('gm-refresh-folder')?.addEventListener('click', () => {
    if (gmCurrentRecord) {
      gmShowFolderFiles(gmCurrentRecord, null, false, true, false);
    }
  });
  elements.indexRefreshTimer?.addEventListener('change', () => {
    gmEnableIndexTimer = !!elements.indexRefreshTimer.checked;
    try {
      localStorage.setItem('gm-index-refresh-enabled', String(gmEnableIndexTimer));
    } catch (err) {
      console.warn('保存刷新开关失败', err);
    }
    gmScheduleIndexRefresh();
  });
  elements.folderForceRefresh?.addEventListener('change', () => {
    gmForceFolderRefresh = !!elements.folderForceRefresh.checked;
    try {
      localStorage.setItem('gm-folder-force-refresh', String(gmForceFolderRefresh));
    } catch (err) {
      console.warn('保存目录刷新开关失败', err);
    }
  });

  // 当配置变化时更新
  if (elements.metadata?.submitter) {
    elements.metadata.submitter.addEventListener('change', gmUpdateSubmitter);
  }
})();

// ==================== 自动更新逻辑 ====================
(async function () {
  const els = {
    statusText: document.getElementById('updater-status-text'),
    checkBtn: document.getElementById('check-update-btn'),
    infoArea: document.getElementById('update-info-area'),
    message: document.getElementById('update-message'),
    downloadBtn: document.getElementById('download-update-btn'),
    installBtn: document.getElementById('install-update-btn'),
    progressContainer: document.getElementById('update-progress-container'),
    progressBar: document.getElementById('update-progress-bar'),
    progressFill: document.getElementById('update-progress-fill'),
    progressPercent: document.getElementById('update-progress-percent')
  };

  if (!els.checkBtn) return; // 容错

  // 获取并显示当前版本
  try {
    const ver = await window.bridge.getAppVersion();
    if (els.statusText) els.statusText.textContent = `当前版本: v${ver}`;
  } catch (e) {
    console.error('获取版本失败', e);
  }

  // 🔴 开机自启动：初始化和事件绑定
  const openAtLoginCheckbox = document.getElementById('open-at-login-checkbox');
  if (openAtLoginCheckbox && window.bridge?.getLoginItemSettings) {
    // 获取当前开机自启动状态
    try {
      const settings = await window.bridge.getLoginItemSettings();
      openAtLoginCheckbox.checked = settings?.openAtLogin || false;
      console.log('[Settings] 开机自启动状态:', settings?.openAtLogin ? '已启用' : '未启用');
    } catch (err) {
      console.warn('[Settings] 获取开机自启动状态失败:', err);
    }

    // 绑定开关变化事件
    openAtLoginCheckbox.addEventListener('change', async () => {
      const openAtLogin = openAtLoginCheckbox.checked;
      try {
        const result = await window.bridge.setLoginItemSettings({ openAtLogin, openAsHidden: false });
        if (result?.success) {
          console.log('[Settings] 开机自启动设置已保存:', result.openAtLogin ? '启用' : '禁用');
        } else {
          console.warn('[Settings] 设置开机自启动失败:', result?.error);
          // 恢复复选框状态
          openAtLoginCheckbox.checked = !openAtLogin;
        }
      } catch (err) {
        console.warn('[Settings] 设置开机自启动失败:', err);
        openAtLoginCheckbox.checked = !openAtLogin;
      }
    });
  }

  // 绑定事件
  els.checkBtn?.addEventListener('click', async () => {
    setUpdateUI('checking');
    await window.bridge.checkForUpdates();
  });

  els.downloadBtn?.addEventListener('click', async () => {
    setUpdateUI('downloading-start');
    await window.bridge.downloadUpdate();
  });

  els.installBtn?.addEventListener('click', () => {
    window.bridge.installUpdate();
  });

  // 监听状态
  window.bridge.onUpdaterStatus((status, info) => {
    console.log('Update Status:', status, info);
    setUpdateUI(status, info);
  });

  function setUpdateUI(status, info) {
    if (status === 'checking') {
      els.checkBtn.disabled = true;
      els.checkBtn.textContent = '检查中...';
      els.infoArea.hidden = true;
    } else {
      els.checkBtn.disabled = false;
      els.checkBtn.textContent = '检查更新';
    }

    if (status === 'available') {
      els.infoArea.hidden = false;
      els.message.innerHTML = `<span style="color:#16a34a; font-weight:500;">🎉 发现新版本 v${info.version}！</span><br><span style="color:#64748b;">${info.releaseNotes || '包含新功能和问题修复'}</span>`;
      els.downloadBtn.hidden = false;
      els.installBtn.hidden = true;
      if (els.progressContainer) els.progressContainer.hidden = true;

      // 显示浮动更新通知
      showUpdateNotification(info.version);
    } else if (status === 'not-available') {
      els.infoArea.hidden = false;
      els.message.innerHTML = '<span style="color:#16a34a;">✅ 当前已是最新版本。</span>';
      els.downloadBtn.hidden = true;
      els.installBtn.hidden = true;
      if (els.progressContainer) els.progressContainer.hidden = true;
    } else if (status === 'downloading-start') {
      els.infoArea.hidden = false;
      els.message.innerHTML = '<span style="color:#3b82f6;">⏳ 正在准备下载...</span>';
      els.downloadBtn.hidden = true;
      els.installBtn.hidden = true;
      if (els.progressContainer) {
        els.progressContainer.hidden = false;
        els.progressFill.style.width = '0%';
        if (els.progressPercent) els.progressPercent.textContent = '0%';
      }
    } else if (status === 'downloading') {
      els.infoArea.hidden = false;
      const percent = info ? Math.round(info.percent) : 0;
      els.message.innerHTML = `<span style="color:#3b82f6;">⬇️ 正在下载更新 <strong>${percent}%</strong></span>`;
      if (els.progressContainer) {
        els.progressContainer.hidden = false;
        els.progressFill.style.width = `${percent}%`;
        if (els.progressPercent) els.progressPercent.textContent = `${percent}%`;
      }
      els.downloadBtn.hidden = true;
      els.installBtn.hidden = true;
    } else if (status === 'downloaded') {
      els.infoArea.hidden = false;
      if (els.progressContainer) els.progressContainer.hidden = true;
      els.downloadBtn.hidden = true;
      els.installBtn.hidden = false;
      els.message.innerHTML = `
        <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 12px 16px; border-radius: 8px; border: 1px solid #a7f3d0;">
          <div style="color:#059669; font-weight:600; margin-bottom:4px;">✅ 下载完成！</div>
          <div style="color:#065f46; font-size:12px;">点击下方按钮重启并安装更新</div>
        </div>
      `;
    } else if (status === 'error') {
      els.infoArea.hidden = false;
      els.message.innerHTML = `<span style="color:#dc2626;">❌ 检查更新失败: ${info}</span>`;
      els.downloadBtn.hidden = true;
      els.installBtn.hidden = true;
      if (els.progressContainer) els.progressContainer.hidden = true;
    } else if (status === 'signature-error') {
      // macOS 未签名应用无法自动更新，提供手动下载选项
      els.infoArea.hidden = false;
      if (els.progressContainer) els.progressContainer.hidden = true;
      els.downloadBtn.hidden = true;
      els.installBtn.hidden = true;

      const downloadUrl = info?.downloadUrl || 'https://gorgeous-kashata-c9da30.netlify.app/';
      els.message.innerHTML = `
        <div style="text-align: center;">
          <p style="margin-bottom: 12px; color: #f59e0b;">⚠️ ${info?.message || '由于应用未签名，无法自动安装更新。'}</p>
          <p style="margin-bottom: 16px;">已检测到新版本，请点击下方按钮手动下载并安装：</p>
          <a href="#" onclick="window.bridge.openInBrowser('${downloadUrl}'); return false;" 
             style="display: inline-block; padding: 10px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; text-decoration: none; border-radius: 8px; font-weight: 500;
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
            📦 前往下载页面
          </a>
        </div>
      `;
    }
  }
})();

// 显示新版本更新通知
function showUpdateNotification(version) {
  // 防止重复显示
  if (document.querySelector('.update-notification-popup')) return;

  const notification = document.createElement('div');
  notification.className = 'update-notification-popup';
  notification.innerHTML = `
    <style>
      .update-notification-popup {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px 24px;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
        z-index: 10000;
        animation: slideInUp 0.4s ease;
        max-width: 320px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      @keyframes slideInUp {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .update-notification-popup h4 {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .update-notification-popup p {
        margin: 0 0 16px 0;
        font-size: 14px;
        opacity: 0.9;
      }
      .update-notification-popup .btn-group {
        display: flex;
        gap: 10px;
      }
      .update-notification-popup button {
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }
      .update-notification-popup .btn-primary {
        background: white;
        color: #667eea;
      }
      .update-notification-popup .btn-primary:hover {
        background: #f0f0f0;
      }
      .update-notification-popup .btn-secondary {
        background: rgba(255,255,255,0.2);
        color: white;
      }
      .update-notification-popup .btn-secondary:hover {
        background: rgba(255,255,255,0.3);
      }
      .update-notification-popup .close-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        color: rgba(255,255,255,0.7);
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        line-height: 1;
      }
      .update-notification-popup .close-btn:hover {
        color: white;
      }
    </style>
    <button class="close-btn" data-action="close">×</button>
    <h4>🚀 软件更新</h4>
    <p>新版本 <strong>v${version}</strong> 已发布，包含功能改进和问题修复</p>
    <div class="btn-group">
      <button class="btn-primary" data-action="download">⬇️ 立即下载</button>
      <button class="btn-secondary" data-action="later">稍后</button>
    </div>
  `;

  document.body.appendChild(notification);

  notification.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'download') {
      notification.remove();
      // 触发下载更新
      if (window.bridge?.downloadUpdate) {
        await window.bridge.downloadUpdate();
      }
      // 切换到设置页面显示进度
      const settingsTab = document.querySelector('[data-view="settings"]');
      if (settingsTab) settingsTab.click();
    } else if (action === 'later' || action === 'close') {
      notification.remove();
    }
  });
}

// 显示入库失败错误弹窗
function showStoreErrorAlert(successCount, errorCount, failedFiles) {
  const overlay = document.createElement('div');
  overlay.className = 'store-error-overlay';

  const errorMessages = failedFiles.map(f => f.message || '未知错误').slice(0, 5);
  const moreCount = failedFiles.length > 5 ? failedFiles.length - 5 : 0;

  overlay.innerHTML = `
    <style>
      .store-error-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
        animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .store-error-modal {
        background: white;
        border-radius: 16px;
        max-width: 480px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
        overflow: hidden;
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .store-error-header {
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        color: white;
        padding: 20px 24px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .store-error-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      .store-error-body {
        padding: 24px;
      }
      .store-error-summary {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
      }
      .store-error-stat {
        flex: 1;
        padding: 12px 16px;
        border-radius: 8px;
        text-align: center;
      }
      .store-error-stat.success {
        background: #dcfce7;
        color: #166534;
      }
      .store-error-stat.error {
        background: #fef2f2;
        color: #dc2626;
      }
      .store-error-stat .num {
        font-size: 24px;
        font-weight: 700;
      }
      .store-error-stat .label {
        font-size: 12px;
        margin-top: 4px;
      }
      .store-error-details {
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 12px 16px;
        max-height: 150px;
        overflow-y: auto;
      }
      .store-error-details p {
        margin: 0 0 8px 0;
        font-size: 13px;
        color: #dc2626;
        padding-left: 20px;
        position: relative;
      }
      .store-error-details p::before {
        content: '✕';
        position: absolute;
        left: 0;
        color: #dc2626;
      }
      .store-error-details p:last-child {
        margin-bottom: 0;
      }
      .store-error-footer {
        padding: 16px 24px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
      }
      .store-error-footer button {
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        background: #dc2626;
        color: white;
        transition: background 0.2s;
      }
      .store-error-footer button:hover {
        background: #b91c1c;
      }
    </style>
    <div class="store-error-modal">
      <div class="store-error-header">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <h3>⚠️ 入库部分失败</h3>
      </div>
      <div class="store-error-body">
        <div class="store-error-summary">
          <div class="store-error-stat success">
            <div class="num">${successCount}</div>
            <div class="label">成功入库</div>
          </div>
          <div class="store-error-stat error">
            <div class="num">${errorCount}</div>
            <div class="label">入库失败</div>
          </div>
        </div>
        <div class="store-error-details">
          ${errorMessages.map(msg => `<p>${msg}</p>`).join('')}
          ${moreCount > 0 ? `<p style="color: #9ca3af;">...还有 ${moreCount} 个错误</p>` : ''}
        </div>
      </div>
      <div class="store-error-footer">
        <button data-action="close">我知道了</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'close' || e.target === overlay) {
      overlay.remove();
    }
  });
}

// ========== 多批次批量操作功能 ==========

/**
 * 多批次选择状态
 */
const multiBatchSelection = {
  selectedBatchIds: new Set(),
  isToolbarInitialized: false
};

/**
 * 初始化多批次操作工具栏事件
 */
function initMultiBatchToolbar() {
  if (multiBatchSelection.isToolbarInitialized) return;
  multiBatchSelection.isToolbarInitialized = true;

  const toolbar = document.getElementById('multi-batch-toolbar');
  const selectAllCheckbox = document.getElementById('multi-batch-select-all');
  const approveBtn = document.getElementById('multi-batch-approve');
  const rejectBtn = document.getElementById('multi-batch-reject');
  const storeBtn = document.getElementById('multi-batch-store');
  const cancelBtn = document.getElementById('multi-batch-cancel');

  if (!toolbar) return;

  // 全选/取消全选
  selectAllCheckbox?.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const container = elements.reviewList;
    if (!container) return;

    container.querySelectorAll('.batch-multi-checkbox').forEach(checkbox => {
      checkbox.checked = isChecked;
      const batchId = checkbox.dataset.batchId;
      const batchCard = checkbox.closest('.file-review-batch-card');

      if (isChecked) {
        multiBatchSelection.selectedBatchIds.add(batchId);
        batchCard?.classList.add('multi-selected');
      } else {
        multiBatchSelection.selectedBatchIds.delete(batchId);
        batchCard?.classList.remove('multi-selected');
      }
    });

    updateMultiBatchToolbar();
  });

  // 批量合格
  approveBtn?.addEventListener('click', async () => {
    if (multiBatchSelection.selectedBatchIds.size === 0) return;

    const confirmed = confirm(`确定要将选中的 ${multiBatchSelection.selectedBatchIds.size} 个批次内所有待审文件标记为【合格】吗？`);
    if (!confirmed) return;

    await executeMultiBatchAction('approve');
  });

  // 批量不合格
  rejectBtn?.addEventListener('click', async () => {
    if (multiBatchSelection.selectedBatchIds.size === 0) return;

    const confirmed = confirm(`确定要将选中的 ${multiBatchSelection.selectedBatchIds.size} 个批次内所有待审文件标记为【不合格】吗？`);
    if (!confirmed) return;

    await executeMultiBatchAction('reject');
  });

  // 批量入库
  storeBtn?.addEventListener('click', async () => {
    if (multiBatchSelection.selectedBatchIds.size === 0) return;

    const confirmed = confirm(`确定要将选中的 ${multiBatchSelection.selectedBatchIds.size} 个批次入库吗？\n\n将会入库所有合格的文件。`);
    if (!confirmed) return;

    await executeMultiBatchAction('store');
  });

  // 取消选择
  cancelBtn?.addEventListener('click', () => {
    clearMultiBatchSelection();
  });
}

/**
 * 设置批次勾选框事件（在 setupFileReviewHandlers 中调用）
 */
function setupBatchMultiSelectHandlers(container) {
  container.querySelectorAll('.batch-multi-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const batchId = checkbox.dataset.batchId;
      const batchCard = checkbox.closest('.file-review-batch-card');

      if (checkbox.checked) {
        multiBatchSelection.selectedBatchIds.add(batchId);
        batchCard?.classList.add('multi-selected');
      } else {
        multiBatchSelection.selectedBatchIds.delete(batchId);
        batchCard?.classList.remove('multi-selected');
      }

      updateMultiBatchToolbar();
    });
  });
}

/**
 * 更新多批次操作工具栏状态
 */
function updateMultiBatchToolbar() {
  const toolbar = document.getElementById('multi-batch-toolbar');
  const countSpan = document.getElementById('multi-batch-count');
  const selectAllCheckbox = document.getElementById('multi-batch-select-all');
  const approveBtn = document.getElementById('multi-batch-approve');
  const rejectBtn = document.getElementById('multi-batch-reject');
  const storeBtn = document.getElementById('multi-batch-store');

  const count = multiBatchSelection.selectedBatchIds.size;

  // 更新计数显示
  if (countSpan) {
    countSpan.textContent = `已选 ${count} 个批次`;
  }

  // 更新按钮状态
  const hasSelection = count > 0;
  if (approveBtn) approveBtn.disabled = !hasSelection;
  if (rejectBtn) rejectBtn.disabled = !hasSelection;
  if (storeBtn) storeBtn.disabled = !hasSelection;

  // 更新全选框状态
  if (selectAllCheckbox && elements.reviewList) {
    const totalCheckboxes = elements.reviewList.querySelectorAll('.batch-multi-checkbox').length;
    selectAllCheckbox.checked = totalCheckboxes > 0 && count === totalCheckboxes;
    selectAllCheckbox.indeterminate = count > 0 && count < totalCheckboxes;
  }

  // 显示/隐藏工具栏
  if (toolbar) {
    toolbar.hidden = false; // 始终显示工具栏，方便用户操作
  }
}

/**
 * 清空多批次选择
 */
function clearMultiBatchSelection() {
  multiBatchSelection.selectedBatchIds.clear();

  const container = elements.reviewList;
  if (container) {
    container.querySelectorAll('.batch-multi-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    container.querySelectorAll('.file-review-batch-card.multi-selected').forEach(card => {
      card.classList.remove('multi-selected');
    });
  }

  const selectAllCheckbox = document.getElementById('multi-batch-select-all');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }

  updateMultiBatchToolbar();
}

/**
 * 执行多批次操作
 */
async function executeMultiBatchAction(action) {
  const batchIds = Array.from(multiBatchSelection.selectedBatchIds);
  if (batchIds.length === 0) return;

  // 显示进度弹窗
  const progressOverlay = showMultiBatchProgressOverlay(action, batchIds.length);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  try {
    for (let i = 0; i < batchIds.length; i++) {
      const batchId = batchIds[i];
      updateMultiBatchProgress(progressOverlay, i + 1, batchIds.length, batchId);

      try {
        if (action === 'approve') {
          await handleBatchApprove(batchId);
          successCount++;
        } else if (action === 'reject') {
          await handleBatchReject(batchId);
          successCount++;
        } else if (action === 'store') {
          // 检查批次是否有合格文件可以入库
          const batch = state.fileReviewBatches?.find(b => b.batchId === batchId);
          if (batch && batch.counts.approved > 0) {
            await handleBatchStore(batchId, 'final');
            successCount++;
          } else {
            errors.push(`批次 ${batchId}: 没有合格文件可入库`);
            errorCount++;
          }
        }
      } catch (error) {
        console.error(`[MultiBatch] 批次 ${batchId} ${action} 失败:`, error);
        errors.push(`批次 ${batchId}: ${error.message}`);
        errorCount++;
      }

      // 添加小延迟避免请求过快
      if (i < batchIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  } finally {
    // 移除进度弹窗
    progressOverlay?.remove();
  }

  // 清空选择
  clearMultiBatchSelection();

  // 刷新列表
  await loadFileReviewEntries({ silent: true });

  // 显示结果
  const actionName = action === 'approve' ? '批量合格' : (action === 'reject' ? '批量不合格' : '批量入库');
  if (errorCount === 0) {
    appendLog({ status: 'success', message: `${actionName}完成：成功处理 ${successCount} 个批次` });
  } else {
    appendLog({
      status: 'warning',
      message: `${actionName}完成：成功 ${successCount} 个，失败 ${errorCount} 个`
    });
    if (errors.length > 0) {
      console.warn('[MultiBatch] 错误详情:', errors);
    }
  }
}

/**
 * 显示多批次操作进度弹窗
 */
function showMultiBatchProgressOverlay(action, totalCount) {
  const actionName = action === 'approve' ? '批量标记合格' : (action === 'reject' ? '批量标记不合格' : '批量入库');

  const overlay = document.createElement('div');
  overlay.className = 'multi-batch-progress-overlay';
  overlay.innerHTML = `
    <div class="multi-batch-progress-modal">
      <div class="multi-batch-progress-spinner"></div>
      <div class="multi-batch-progress-title">${actionName}中...</div>
      <div class="multi-batch-progress-detail">正在处理 0 / ${totalCount} 个批次</div>
      <div class="multi-batch-progress-bar">
        <div class="multi-batch-progress-fill" style="width: 0%"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * 更新多批次操作进度
 */
function updateMultiBatchProgress(overlay, current, total, currentBatchId) {
  if (!overlay) return;

  const detailEl = overlay.querySelector('.multi-batch-progress-detail');
  const fillEl = overlay.querySelector('.multi-batch-progress-fill');

  if (detailEl) {
    detailEl.textContent = `正在处理 ${current} / ${total} 个批次`;
  }
  if (fillEl) {
    const percent = Math.round((current / total) * 100);
    fillEl.style.width = `${percent}%`;
  }
}

// ── AI 智能命名 UI ──
let _aiNamingUISetup = false;
function setupAiNamingUI() {
  if (_aiNamingUISetup) return;
  _aiNamingUISetup = true;

  // 切换 API Key 可见性
  const toggleKeyBtn = document.getElementById('ai-naming-toggle-key');
  const apiKeyInput = document.getElementById('ai-naming-api-key');
  if (toggleKeyBtn && apiKeyInput) {
    toggleKeyBtn.addEventListener('click', () => {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });
  }

  // 测试 API Key
  const testKeyBtn = document.getElementById('ai-naming-test-key');
  const testResult = document.getElementById('ai-naming-test-result');
  if (testKeyBtn && apiKeyInput) {
    testKeyBtn.addEventListener('click', async () => {
      const key = apiKeyInput.value.trim();
      if (!key) {
        if (testResult) {
          testResult.hidden = false;
          testResult.style.background = '#fef2f2';
          testResult.style.color = '#991b1b';
          testResult.textContent = '请先输入 API Key';
        }
        return;
      }
      testKeyBtn.disabled = true;
      testKeyBtn.textContent = '测试中…';
      try {
        const result = await window.bridge.aiNaming.testKey(key);
        if (testResult) {
          testResult.hidden = false;
          if (result.success) {
            testResult.style.background = '#f0fdf4';
            testResult.style.color = '#166534';
            testResult.textContent = `✅ API Key 有效！可用 ${result.models?.length || 0} 个 Gemini 模型`;
          } else {
            testResult.style.background = '#fef2f2';
            testResult.style.color = '#991b1b';
            testResult.textContent = `❌ 验证失败：${result.error}`;
          }
        }
      } catch (err) {
        if (testResult) {
          testResult.hidden = false;
          testResult.style.background = '#fef2f2';
          testResult.style.color = '#991b1b';
          testResult.textContent = `❌ 网络错误：${err.message}`;
        }
      } finally {
        testKeyBtn.disabled = false;
        testKeyBtn.textContent = '测试';
      }
    });
  }

  // 关键词词数实时统计
  const keywordsTextarea = document.getElementById('ai-naming-keywords');
  const countDisplay = document.getElementById('ai-naming-keyword-count-display');
  if (keywordsTextarea && countDisplay) {
    keywordsTextarea.addEventListener('input', () => {
      const count = keywordsTextarea.value.split(/[,，\n\r]+/).map(s => s.trim()).filter(Boolean).length;
      countDisplay.textContent = `${count} 个词`;
    });
  }

  // 打开 Google AI Studio 链接
  const getKeyLink = document.getElementById('ai-naming-get-key-link');
  if (getKeyLink) {
    getKeyLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.bridge.openExternal('https://aistudio.google.com/app/apikey');
    });
  }
}

// 在文档加载完成后初始化多批次工具栏
document.addEventListener('DOMContentLoaded', () => {
  initMultiBatchToolbar();
});
