const { contextBridge, ipcRenderer } = require('electron');

// 检测是否为开发模式
const isDev = process.env.NODE_ENV === 'development';

contextBridge.exposeInMainWorld('bridge', {
  isDev,  // 🔴 暴露开发模式标志
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('files:scan', folderPath),
  previewRenames: (payload) => ipcRenderer.invoke('files:preview-renames', payload),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  exportConfig: (payload, fileName) => ipcRenderer.invoke('config:export', payload, fileName),
  importConfig: () => ipcRenderer.invoke('config:import'),
  exportTeamConfig: () => ipcRenderer.invoke('config:export-team'),
  resetConfigSection: (section) => ipcRenderer.invoke('config:reset-section', section),
  authorize: (config) => ipcRenderer.invoke('google:auth', config),
  logout: () => ipcRenderer.invoke('google:logout'),
  getTokenStatus: () => ipcRenderer.invoke('google:token-status'),
  refreshToken: () => ipcRenderer.invoke('google:refresh-token'),
  upload: (payload) => ipcRenderer.invoke('google:upload', payload),
  checkUploadedFiles: (fileIds) => ipcRenderer.invoke('upload:check-duplicates', fileIds),
  renameLocalFiles: (payload) => ipcRenderer.invoke('files:rename-local', payload),
  fetchReviewEntries: (options) => ipcRenderer.invoke('review:fetch', options),
  approveReviewEntry: (payload) => ipcRenderer.invoke('review:approve', payload),
  rejectReviewEntry: (payload) => ipcRenderer.invoke('review:reject', payload),
  reopenReviewEntry: (payload) => ipcRenderer.invoke('review:reopen', payload),
  syncReviewEntries: () => ipcRenderer.invoke('review:sync'),
  refreshReviewFiles: (payload) => ipcRenderer.invoke('review:refresh-files', payload),
  moveFilesToFinished: (payload) => ipcRenderer.invoke('review:move-to-finished', payload),
  moveFilesFromFinished: (payload) => ipcRenderer.invoke('review:move-from-finished', payload),
  // 新审核流程：按文件记录
  generateBatchId: (submitter) => ipcRenderer.invoke('review:generate-batch-id', submitter),
  appendFileReviewRow: (params) => ipcRenderer.invoke('review:append-file-row', params),
  fetchFileReviewEntries: (options) => ipcRenderer.invoke('review:fetch-file-entries', options),
  loadReferenceFiles: (params) => ipcRenderer.invoke('review:load-reference-files', params),
  updateFileReviewStatus: (params) => ipcRenderer.invoke('review:update-file-status', params),
  batchUpdateFileReviewStatus: (updates) => ipcRenderer.invoke('review:batch-update-file-status', updates),
  updateFileReviewBatchNote: (payload) => ipcRenderer.invoke('review:update-batch-note', payload),
  storeFilesToLibrary: (params) => ipcRenderer.invoke('review:store-files-to-library', params),
  replaceRejectedFile: (params) => ipcRenderer.invoke('review:replace-rejected-file', params),
  addFileToBatch: (params) => ipcRenderer.invoke('review:add-file-to-batch', params),
  updateBatchStatus: (params) => ipcRenderer.invoke('review:update-batch-status', params),
  updateBatchMetadata: (params) => ipcRenderer.invoke('review:update-batch-metadata', params),
  syncBatchFiles: (params) => ipcRenderer.invoke('review:sync-batch-files', params),
  checkBatchNewFiles: (params) => ipcRenderer.invoke('review:check-batch-new-files', params),
  deleteReviewFile: (params) => ipcRenderer.invoke('review:delete-file', params),
  // AI 智能命名
  aiNaming: {
    analyzeFile: (filePath, context) => ipcRenderer.invoke('ai-naming:analyze-file', filePath, context),
    getStatus: () => ipcRenderer.invoke('ai-naming:status'),
    testKey: (apiKey) => ipcRenderer.invoke('ai-naming:test-key', apiKey)
  },
  openExternal: (url) => ipcRenderer.invoke('browser:open', url),
  openDriveFolder: (folderId) => ipcRenderer.invoke('google:open-drive', folderId),
  showFloatingNotification: (payload) => ipcRenderer.invoke('notification:show', payload),
  fetchSoftwareDirectory: (options) => ipcRenderer.invoke('software:fetch', options),
  fetchSoftwareSubmissions: (options) => ipcRenderer.invoke('software:pending', options),
  reviewSoftwareSubmission: (payload) => ipcRenderer.invoke('software:review', payload),
  onUploadProgress: (callback) => {
    ipcRenderer.removeAllListeners('upload:progress');
    ipcRenderer.on('upload:progress', (_event, data) => {
      callback?.(data);
    });
  },
  onUploadState: (callback) => {
    ipcRenderer.removeAllListeners('upload:state');
    ipcRenderer.on('upload:state', (_event, data) => {
      callback?.(data);
    });
  },
  onNotificationCommand: (callback) => {
    ipcRenderer.removeAllListeners('notification:command');
    ipcRenderer.on('notification:command', (_event, data) => {
      callback?.(data);
    });
  },
  fetchCategories: () => ipcRenderer.invoke('categories:fetch'),
  setZoomFactor: (zoom) => ipcRenderer.invoke('window:set-zoom', zoom),
  saveSlots: (slots) => ipcRenderer.invoke('slots:save', slots),
  savePreferences: (prefs) => ipcRenderer.invoke('preferences:save', prefs),
  pauseUpload: () => ipcRenderer.invoke('upload:pause'),
  resumeUpload: () => ipcRenderer.invoke('upload:resume'),
  stopUpload: () => ipcRenderer.invoke('upload:stop'),
  checkNoticeBoardUpdate: (documentId) => ipcRenderer.invoke('notice-board:check-update', documentId),
  // 组内媒体相关方法
  getMediaConfig: () => ipcRenderer.invoke('media:get-config'),
  saveMediaConfig: (updates) => ipcRenderer.invoke('media:save-config', updates),
  extractFolderId: (link) => ipcRenderer.invoke('media:extract-folder-id', link),
  submitMediaRecord: (record) => ipcRenderer.invoke('media:submit-record', record),
  getMediaRecords: (filters) => ipcRenderer.invoke('media:get-records', filters),
  getMediaFolderDetails: (folderId, options) => ipcRenderer.invoke('media:get-folder-details', folderId, options),
  getMediaFolderTree: (folderId) => ipcRenderer.invoke('media:get-folder-tree', folderId),
  downloadMediaFiles: (payload) => ipcRenderer.invoke('media:download-files', payload),
  getThumbnailCached: (payload) => ipcRenderer.invoke('media:get-thumbnail-cached', payload),
  cacheThumbnail: (payload) => ipcRenderer.invoke('media:cache-thumbnail', payload),
  getThumbCacheInfo: () => ipcRenderer.invoke('media:thumb-cache-info'),
  cleanThumbCache: (maxBytes) => ipcRenderer.invoke('media:thumb-cache-clean', maxBytes),
  setThumbCacheMax: (maxBytes) => ipcRenderer.invoke('media:thumb-cache-set-max', maxBytes),
  setThumbCacheDir: (dirPath) => ipcRenderer.invoke('media:thumb-cache-set-dir', dirPath),
  loadFileIndex: () => ipcRenderer.invoke('media:index-load'),
  saveFileIndex: (data) => ipcRenderer.invoke('media:index-save', data),
  getFileIndexInfo: () => ipcRenderer.invoke('media:index-info'),
  clearFileIndex: () => ipcRenderer.invoke('media:index-clear'),
  clearUploadState: () => ipcRenderer.invoke('upload:clear-state'),

  // 每日打卡 Google Sheets 同步
  checkin: {
    // 同步打卡记录到 Sheets
    syncRecord: (params) => ipcRenderer.invoke('checkin:sync-record', params),
    // 从 Sheets 读取所有打卡记录
    fetchRecords: (params) => ipcRenderer.invoke('checkin:fetch-records', params),
    // 批量同步多条记录
    batchSyncRecords: (params) => ipcRenderer.invoke('checkin:batch-sync', params),
    // 横向日期格式同步（与团队总览相同）
    syncHorizontal: (params) => ipcRenderer.invoke('checkin:sync-horizontal', params),
    // 保存设置到 Firebase
    saveSettings: (params) => ipcRenderer.invoke('checkin:save-settings', params),
    // 从 Firebase 加载设置
    loadSettings: (params) => ipcRenderer.invoke('checkin:load-settings', params),
    // 保存打卡记录到 Firebase
    saveRecordFirebase: (params) => ipcRenderer.invoke('checkin:save-record-firebase', params),
    // 从 Firebase 加载打卡记录
    loadRecordsFirebase: (params) => ipcRenderer.invoke('checkin:load-records-firebase', params),
    // 批量保存打卡记录到 Firebase
    batchSaveRecordsFirebase: (params) => ipcRenderer.invoke('checkin:batch-save-records-firebase', params),
    // 从 Firebase 获取所有用户的打卡记录（用于同步全部到 Sheets）
    getAllRecordsFirebase: (params) => ipcRenderer.invoke('checkin:get-all-records-firebase', params),
    // 开始实时监听所有用户打卡记录（团队总览实时更新）
    watchAllRecords: (params) => ipcRenderer.invoke('checkin:watch-all-records', params),
    // 停止监听
    stopWatchRecords: () => ipcRenderer.invoke('checkin:stop-watch-records'),
    // 监听打卡记录实时更新事件
    onRecordsUpdated: (callback) => {
      ipcRenderer.removeAllListeners('checkin:records-updated');
      ipcRenderer.on('checkin:records-updated', (_event, data) => {
        callback?.(data);
      });
    },
    // 保存报数记录到 Firebase（按团队隔离）
    saveReportRecord: (record, teamName) => ipcRenderer.invoke('checkin:save-report-record', record, teamName),
    // 开始监听报数记录（按团队隔离）
    watchReportRecords: (teamName) => ipcRenderer.invoke('checkin:watch-report-records', teamName),
    // 停止监听报数记录
    stopWatchReportRecords: () => ipcRenderer.invoke('checkin:stop-watch-report-records'),
    // 监听报数记录更新事件
    onReportRecordsUpdated: (callback) => {
      ipcRenderer.removeAllListeners('checkin:report-records-updated');
      ipcRenderer.on('checkin:report-records-updated', (_event, data) => {
        callback?.(data);
      });
    },
    // 获取报数记录（日期范围）
    getReportRecordsRange: (params) => ipcRenderer.invoke('checkin:get-report-records-range', params),
    // 🔴 保存任务统计修正记录（从任务统计直接编辑时使用）
    saveCorrectionRecord: (params) => ipcRenderer.invoke('checkin:save-correction-record', params),
    // 🔴 发送催报消息
    sendRemindMessage: (message) => ipcRenderer.invoke('checkin:send-remind-message', message),
    // 🔴 开始监听催报消息
    watchRemindMessages: (teamName) => ipcRenderer.invoke('checkin:watch-remind-messages', teamName),
    // 🔴 监听催报消息事件
    onRemindMessage: (callback) => {
      ipcRenderer.removeAllListeners('checkin:remind-message');
      ipcRenderer.on('checkin:remind-message', (_event, data) => {
        callback?.(data);
      });
    },
    // 🔴 重置打卡数据库（清空并初始化团队成员）
    resetDatabase: (targetVersion = 'V2') => ipcRenderer.invoke('checkin:reset-database', targetVersion),
    // 🔴 重命名组别（迁移数据）
    renameTeam: (oldTeamName, newTeamName) => ipcRenderer.invoke('checkin:rename-team', { oldTeamName, newTeamName }),
    // 🔴 迁移 default 组中指定用户的数据到目标组
    migrateDefaultUser: (userName, newTeamName) => ipcRenderer.invoke('checkin:migrate-default-user', { userName, newTeamName }),
    // 🔴 合并指定用户在多组的记录到目标组
    migrateUserTeam: (userName, newTeamName) => ipcRenderer.invoke('checkin:migrate-user-team', { userName, newTeamName }),
    // 🔴 获取所有组别列表
    getAllTeams: () => ipcRenderer.invoke('checkin:get-all-teams'),
    // 🔴 获取所有用户（跨所有组）
    getAllUsers: () => ipcRenderer.invoke('checkin:get-all-users'),
    // 🔴 获取组内用户列表
    getTeamUsers: (teamName) => ipcRenderer.invoke('checkin:get-team-users', { teamName }),
    // 🔴 重命名用户
    renameUser: (oldUserName, newUserName, teamName) => ipcRenderer.invoke('checkin:rename-user', { oldUserName, newUserName, teamName }),
    // 🔴 删除用户
    deleteUser: (userName, teamName) => ipcRenderer.invoke('checkin:delete-user', { userName, teamName }),
    // 🔴 数据备份
    backupData: (data) => ipcRenderer.invoke('checkin:backup-data', data),
    // 🔴 获取备份列表
    listBackups: () => ipcRenderer.invoke('checkin:list-backups'),
    // 🔴 恢复备份
    restoreBackup: (filename) => ipcRenderer.invoke('checkin:restore-backup', filename),
    // 🔴 一键清理错误数据（删除把用户名当作团队名的错误节点）
    // dryRun=true 时只预览，不删除
    cleanupInvalidData: (dryRun = false) => ipcRenderer.invoke('checkin:cleanup-invalid-data', { dryRun }),
    // 🔴 从老数据库迁移有效数据到目标版本
    // dryRun=true 时只预览，不迁移
    // targetVersion: 'V2'（生产）或 'V3'（测试）
    migrateV1ToV2: (dryRun = false, targetVersion = 'V2') => ipcRenderer.invoke('checkin:migrate-v1-to-v2', { dryRun, targetVersion }),
    // 🔴 切换数据库版本（V1 或 V2）- 用于开发模式预览迁移后的数据
    switchDBVersion: (version) => ipcRenderer.invoke('checkin:switch-db-version', { version }),
    // 🔴 获取当前数据库版本
    getDBVersion: () => ipcRenderer.invoke('checkin:get-db-version')
  },
  // 添加通用 send 方法用于发送 IPC 消息
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),

  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback) => {
    ipcRenderer.removeAllListeners('updater:status');
    ipcRenderer.on('updater:status', (_event, ...args) => callback(...args));
  },

  // 开机自启动
  getLoginItemSettings: () => ipcRenderer.invoke('app:get-login-item-settings'),
  setLoginItemSettings: (settings) => ipcRenderer.invoke('app:set-login-item-settings', settings),

  getAppVersion: () => ipcRenderer.invoke('app:version'),
  // 上传标注后的图片
  uploadAnnotatedImage: (params) => ipcRenderer.invoke('review:upload-annotated-image', params),

  // === Firebase 实时同步 ===
  firebase: {
    // 初始化 Firebase
    initialize: () => ipcRenderer.invoke('firebase:initialize'),
    // 使用 Google token 登录
    signIn: (accessToken) => ipcRenderer.invoke('firebase:sign-in', accessToken),
    // 开始监听审核数据变化
    watchReviews: (sheetId) => ipcRenderer.invoke('firebase:watch-reviews', sheetId),
    // 停止监听
    stopWatch: (listenerId) => ipcRenderer.invoke('firebase:stop-watch', listenerId),
    // 更新单个文件状态
    updateFileStatus: (sheetId, rowNumber, data) => ipcRenderer.invoke('firebase:update-file-status', sheetId, rowNumber, data),
    // 批量更新文件状态
    batchUpdateFileStatus: (sheetId, updates) => ipcRenderer.invoke('firebase:batch-update-file-status', sheetId, updates),
    // 从 Sheets 导入数据到 Firebase
    importFromSheets: (sheetId) => ipcRenderer.invoke('firebase:import-from-sheets', sheetId),
    // 获取 Firebase 中的审核数据
    getReviews: (sheetId) => ipcRenderer.invoke('firebase:get-reviews', sheetId),
    // 保存分类预设到 Firebase（按提交人区分）
    setSlotPresets: (sheetId, slots, submitter) => ipcRenderer.invoke('firebase:set-slot-presets', sheetId, slots, submitter),
    // 获取 Firebase 中的分类预设（按提交人区分）
    getSlotPresets: (sheetId, submitter) => ipcRenderer.invoke('firebase:get-slot-presets', sheetId, submitter),
    // 强制同步到 Sheets
    flushSync: () => ipcRenderer.invoke('firebase:flush-sync'),
    // 检查 Firebase 是否可用
    isReady: () => ipcRenderer.invoke('firebase:is-ready'),
    // 监听实时更新事件
    onReviewUpdate: (callback) => {
      ipcRenderer.removeAllListeners('firebase:review-update');
      ipcRenderer.on('firebase:review-update', (_event, data) => {
        callback?.(data);
      });
    }
  },

  // 🔴 多用户 Profile 管理
  profile: {
    list: () => ipcRenderer.invoke('profile:list'),
    create: (displayName) => ipcRenderer.invoke('profile:create', displayName),
    switch: (profileId) => ipcRenderer.invoke('profile:switch', profileId),
    delete: (profileId) => ipcRenderer.invoke('profile:delete', profileId),
    rename: (profileId, newName) => ipcRenderer.invoke('profile:rename', profileId, newName),
    getCurrent: () => ipcRenderer.invoke('profile:get-current')
  }
});

contextBridge.exposeInMainWorld('floatingNotification', {
  onData: (callback) => {
    ipcRenderer.removeAllListeners('notification:update');
    ipcRenderer.on('notification:update', (_event, data) => {
      callback?.(data);
    });
  },
  sendAction: (payload) => ipcRenderer.send('notification:action', payload),
  notifyReady: () => ipcRenderer.send('notification:ready')
});
