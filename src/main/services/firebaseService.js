/**
 * Firebase 实时数据库服务
 * 用于审核面板的实时数据同步
 */

const { initializeApp } = require('firebase/app');
const {
    getDatabase,
    ref,
    set,
    get,
    update,
    onValue,
    off,
    serverTimestamp,
    push
} = require('firebase/database');
const {
    getAuth,
    signInWithCredential,
    GoogleAuthProvider,
    onAuthStateChanged
} = require('firebase/auth');

// Firebase 配置由用户/团队提供，无内置默认值

// 同步队列配置
const SYNC_INTERVAL_MS = 30000; // 30秒同步一次到 Sheets
const BATCH_SIZE = 50; // 每批同步的最大记录数

// 🔴 数据库路径版本
// V2 = 生产版本（正式使用）
// V3 = 测试版本（用于预览迁移效果）
const DB_PATHS = {
    CHECKIN_RECORDS: 'checkinRecordsV2',      // 打卡记录（V2 生产版本）
    CHECKIN_SETTINGS: 'checkinSettingsV2',    // 打卡设置（V2 生产版本）
    REPORT_RECORDS: 'reportRecordsV2',        // 报数记录（V2 生产版本）
    REMIND_MESSAGES: 'remindMessagesV2'       // 催报消息（V2 生产版本）
};

// 🔴 V3 测试版本路径（用于预览迁移效果）
const DB_PATHS_V3 = {
    CHECKIN_RECORDS: 'checkinRecordsV3_test',      // 测试用
    CHECKIN_SETTINGS: 'checkinSettingsV3_test',    // 测试用
    REPORT_RECORDS: 'reportRecordsV3_test',        // 测试用
    REMIND_MESSAGES: 'remindMessagesV3_test'       // 测试用
};

// 🔴 老版本路径（V1 原始数据）
const DB_PATHS_V1 = {
    CHECKIN_RECORDS: 'checkinRecords',
    CHECKIN_SETTINGS: 'checkinSettings',
    REPORT_RECORDS: 'reportRecords',
    REMIND_MESSAGES: 'remindMessages'
};

// 🔴 当前激活的数据库版本（可动态切换）
let ACTIVE_DB_VERSION = 'V2';  // 生产版本

// 🔴 获取当前激活的路径配置
function getActiveDBPaths() {
    if (ACTIVE_DB_VERSION === 'V1') return DB_PATHS_V1;
    if (ACTIVE_DB_VERSION === 'V3') return DB_PATHS_V3;
    return DB_PATHS;  // V2 = 默认
}

class FirebaseService {
    constructor() {
        this.app = null;
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.listeners = new Map(); // 存储活跃的监听器
        this.syncQueue = []; // 待同步到 Sheets 的更新队列
        this.syncTimer = null;
        this.googleService = null; // Google Sheets 服务引用
        this.eventCallback = null; // IPC 事件回调
        this.initialized = false;
        this.userEmail = null; // 手动设置的用户邮箱（用于 Firebase 认证失败时）
        this.currentCheckinListenerId = null;
    }

    /**
     * 初始化 Firebase
     * @param {Object} firebaseConfig - 用户/团队提供的 Firebase 配置（必须包含 apiKey、databaseURL）
     */
    initialize(firebaseConfig) {
        if (this.initialized) {
            console.log('[FirebaseService] 已经初始化');
            return { success: true };
        }

        // 🔴 必须由用户提供 Firebase 配置，无内置默认值
        if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
            console.log('[FirebaseService] 未配置 Firebase，相关功能已禁用（请在设置中填写 Firebase 配置）');
            return { success: false, disabled: true, error: '未配置 Firebase，请在设置中填写 Firebase 项目信息' };
        }

        const config = firebaseConfig;

        try {
            this.app = initializeApp(config);
            this.db = getDatabase(this.app);
            this.auth = getAuth(this.app);
            this.initialized = true;

            // 监听认证状态变化
            onAuthStateChanged(this.auth, (user) => {
                this.currentUser = user;
                console.log('[FirebaseService] 认证状态变化:', user ? user.email : '未登录');
            });

            // 启动同步定时器
            this.startSyncTimer();

            console.log('[FirebaseService] 初始化成功');
            return { success: true };
        } catch (error) {
            console.error('[FirebaseService] 初始化失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 设置 Google Sheets 服务引用（用于同步）
     */
    setGoogleService(googleService) {
        this.googleService = googleService;
    }

    /**
     * 设置事件回调（用于向渲染进程推送更新）
     */
    setEventCallback(callback) {
        this.eventCallback = callback;
    }

    /**
     * 🔴 切换数据库版本（V1/V2/V3）
     * V1 = 老数据（原始）
     * V2 = 生产版本（正式使用）
     * V3 = 测试版本（预览迁移效果）
     */
    switchDBVersion(version) {
        if (version !== 'V1' && version !== 'V2' && version !== 'V3') {
            return { success: false, message: '无效的版本，只能是 V1、V2 或 V3' };
        }
        const oldVersion = ACTIVE_DB_VERSION;
        ACTIVE_DB_VERSION = version;
        console.log(`[FirebaseService] 数据库版本切换: ${oldVersion} -> ${version}`);

        let paths = DB_PATHS;
        if (version === 'V1') paths = DB_PATHS_V1;
        if (version === 'V3') paths = DB_PATHS_V3;

        return {
            success: true,
            message: `已切换到 ${version}`,
            oldVersion,
            newVersion: version,
            paths
        };
    }

    /**
     * 🔴 获取当前数据库版本
     */
    getDBVersion() {
        return {
            version: ACTIVE_DB_VERSION,
            paths: ACTIVE_DB_VERSION === 'V1' ? DB_PATHS_V1 : DB_PATHS
        };
    }

    /**
     * 使用 Google OAuth Access Token 登录 Firebase
     * @param {string} accessToken - Google OAuth access token
     */
    async signInWithGoogleToken(accessToken) {
        if (!this.auth) {
            throw new Error('Firebase 未初始化');
        }

        try {
            // 注意：在 Electron 环境中，我们使用自定义 token 或直接使用数据库
            // 对于 Realtime Database，如果规则设置为 "auth != null"，需要认证
            // 但为了简化，我们先用测试模式规则 ".read": true, ".write": true
            // 生产环境应该配置正确的认证

            console.log('[FirebaseService] 使用 Google token 登录...');

            // 创建 Google 凭证
            const credential = GoogleAuthProvider.credential(null, accessToken);
            const userCredential = await signInWithCredential(this.auth, credential);

            this.currentUser = userCredential.user;
            console.log('[FirebaseService] 登录成功:', this.currentUser.email);

            // 同时保存到 userEmail 作为备用
            this.userEmail = this.currentUser.email;
            return { success: true, user: this.currentUser.email };
        } catch (error) {
            console.error('[FirebaseService] 登录失败:', error);
            // 如果认证失败，继续使用匿名模式（需要数据库规则支持）
            // 但仍然尝试使用手动设置的 userEmail 来标识操作
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取数据库路径
     */
    getReviewPath(sheetId, rowNumber = null) {
        // 清理 sheetId 中的特殊字符（Firebase 路径不支持 .#$[]）
        const cleanSheetId = sheetId.replace(/[.#$\[\]]/g, '_');
        if (rowNumber !== null) {
            return `reviews/${cleanSheetId}/files/${rowNumber}`;
        }
        return `reviews/${cleanSheetId}/files`;
    }

    getConfigPath(sheetId, key = '', submitter = '') {
        const cleanSheetId = sheetId.replace(/[.#$\[\]]/g, '_');
        const cleanSubmitter = submitter ? submitter.replace(/[.#$\[\]/]/g, '_').trim() : '';
        const submitterSuffix = cleanSubmitter ? `/users/${cleanSubmitter}` : '';
        const keySuffix = key ? `/${key}` : '';
        return `configs/${cleanSheetId}${submitterSuffix}${keySuffix}`;
    }

    /**
     * 更新单个文件的审核状态
     * @param {string} sheetId - Google Sheet ID
     * @param {number} rowNumber - 行号
     * @param {Object} data - 更新数据
     */
    async updateFileStatus(sheetId, rowNumber, data) {
        if (!this.db) {
            throw new Error('Firebase 未初始化');
        }

        const path = this.getReviewPath(sheetId, rowNumber);
        const fileRef = ref(this.db, path);

        // 优先使用 Firebase 认证的邮箱，其次使用手动设置的邮箱
        const userEmail = this.currentUser?.email || this.userEmail || 'anonymous';

        const updateData = {
            ...data,
            _lastModified: Date.now(),
            _modifiedBy: userEmail,
            _dirty: true // 标记需要同步到 Sheets
        };

        console.log(`[FirebaseService] 更新: row ${rowNumber}, modifiedBy: ${userEmail}`);

        try {
            await update(fileRef, updateData);
            console.log(`[FirebaseService] 更新成功: row ${rowNumber}`);

            // 添加到同步队列
            this.addToSyncQueue(sheetId, rowNumber, updateData);

            return { success: true, rowNumber };
        } catch (error) {
            console.error(`[FirebaseService] 更新失败: row ${rowNumber}`, error);
            throw error;
        }
    }

    /**
     * 删除单个文件的审核记录
     * @param {string} sheetId - Google Sheet ID
     * @param {number} rowNumber - 行号
     */
    async deleteFileStatus(sheetId, rowNumber) {
        if (!this.db) {
            throw new Error('Firebase 未初始化');
        }

        const path = this.getReviewPath(sheetId, rowNumber);
        const fileRef = ref(this.db, path);

        console.log(`[FirebaseService] 删除: row ${rowNumber}`);

        try {
            await set(fileRef, null);
            console.log(`[FirebaseService] 删除成功: row ${rowNumber}`);
            return { success: true, rowNumber };
        } catch (error) {
            console.error(`[FirebaseService] 删除失败: row ${rowNumber}`, error);
            throw error;
        }
    }

    /**
     * 批量更新文件状态
     */
    async batchUpdateFileStatus(sheetId, updates) {
        if (!this.db || !updates.length) {
            return { success: false, updated: 0 };
        }

        const updatePromises = updates.map(update =>
            this.updateFileStatus(sheetId, update.rowNumber, update)
        );

        try {
            await Promise.all(updatePromises);
            return { success: true, updated: updates.length };
        } catch (error) {
            console.error('[FirebaseService] 批量更新失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 监听审核数据变化
     * @param {string} sheetId - Google Sheet ID
     * @param {Function} callback - 数据变化回调
     */
    watchFileReviews(sheetId, callback) {
        if (!this.db) {
            console.error('[FirebaseService] 未初始化，无法监听');
            return null;
        }

        const path = this.getReviewPath(sheetId);
        const filesRef = ref(this.db, path);

        // 如果已有监听器，先移除
        if (this.listeners.has(sheetId)) {
            this.stopWatching(sheetId);
        }

        console.log(`[FirebaseService] 开始监听: ${path}`);

        const unsubscribe = onValue(filesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // 转换为数组格式
                const files = Object.entries(data).map(([rowNumber, fileData]) => ({
                    rowNumber: parseInt(rowNumber, 10),
                    ...fileData
                }));

                console.log(`[FirebaseService] 收到更新: ${files.length} 个文件`);

                // 调用回调
                if (callback) {
                    callback({ type: 'update', files });
                }

                // 通过 IPC 推送到渲染进程
                if (this.eventCallback) {
                    this.eventCallback({ type: 'update', sheetId, files });
                }
            }
        }, (error) => {
            console.error('[FirebaseService] 监听错误:', error);
            if (callback) {
                callback({ type: 'error', error: error.message });
            }
        });

        this.listeners.set(sheetId, { ref: filesRef, unsubscribe });
        return { success: true, sheetId };
    }

    /**
     * 监听单个文件的变化（用于细粒度更新）
     */
    watchSingleFile(sheetId, rowNumber, callback) {
        if (!this.db) {
            return null;
        }

        const path = this.getReviewPath(sheetId, rowNumber);
        const fileRef = ref(this.db, path);
        const listenerId = `${sheetId}_${rowNumber}`;

        if (this.listeners.has(listenerId)) {
            return { success: true, listenerId };
        }

        const unsubscribe = onValue(fileRef, (snapshot) => {
            const data = snapshot.val();
            if (data && callback) {
                callback({
                    type: 'file-update',
                    rowNumber,
                    data,
                    isRemote: data._modifiedBy !== (this.currentUser?.email || 'anonymous')
                });
            }
        });

        this.listeners.set(listenerId, { ref: fileRef, unsubscribe });
        return { success: true, listenerId };
    }

    /**
     * 停止监听
     */
    stopWatching(listenerId) {
        if (this.listeners.has(listenerId)) {
            const listener = this.listeners.get(listenerId);
            off(listener.ref);
            this.listeners.delete(listenerId);
            console.log(`[FirebaseService] 停止监听: ${listenerId}`);
            return { success: true };
        }
        return { success: false, error: '监听器不存在' };
    }

    /**
     * 停止所有监听
     */
    stopAllWatching() {
        this.listeners.forEach((listener, id) => {
            off(listener.ref);
            console.log(`[FirebaseService] 停止监听: ${id}`);
        });
        this.listeners.clear();
        return { success: true };
    }

    /**
     * 从 Google Sheets 导入数据到 Firebase
     */
    async importFromSheets(sheetId, files) {
        if (!this.db || !files.length) {
            return { success: false };
        }

        console.log(`[FirebaseService] 导入 ${files.length} 条记录到 Firebase...`);

        const updates = {};
        files.forEach(file => {
            const path = `${this.getReviewPath(sheetId)}/${file.rowNumber}`;
            updates[path] = {
                batchId: file.batchId || '',
                fileName: file.fileName || '',
                fileId: file.fileId || '',
                fileLink: file.fileLink || '',
                submitter: file.submitter || '',
                submitTime: file.submitTime || '',
                status: file.status || '待审核',
                taskType: file.taskType || '',
                mainCategory: file.mainCategory || '',
                subCategory: file.subCategory || '',
                reviewer: file.reviewer || '',
                reviewTime: file.reviewTime || '',
                reviewNote: file.reviewNote || '',
                batchStatus: file.batchStatus || '',
                batchNote: file.batchNote || '',
                admin: file.admin || '',
                renamePattern: file.renamePattern || '',
                folderPattern: file.folderPattern || '',
                namingMetadata: file.namingMetadata || '',
                targetFolderId: file.targetFolderId || '',
                namingResult: file.namingResult || '',
                referenceFolderId: file.referenceFolderId || '',
                referenceFolderLink: file.referenceFolderLink || '',
                reviewSlotName: file.reviewSlotName || '',
                reviewDescription: file.reviewDescription || '',
                linkedFileId: file.linkedFileId || '',
                tempFolderLink: file.tempFolderLink || '',
                finalFolderLink: file.finalFolderLink || '',
                finalFileLink: file.finalFileLink || '',
                _lastSync: Date.now(),
                _dirty: false
            };
        });

        try {
            // 使用 multi-path update
            const rootRef = ref(this.db);
            await update(rootRef, updates);
            console.log('[FirebaseService] 导入完成');
            return { success: true, imported: files.length };
        } catch (error) {
            console.error('[FirebaseService] 导入失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 添加到同步队列
     */
    addToSyncQueue(sheetId, rowNumber, data) {
        this.syncQueue.push({
            sheetId,
            rowNumber,
            data,
            timestamp: Date.now()
        });

        // 如果队列过大，立即触发同步
        if (this.syncQueue.length >= BATCH_SIZE) {
            this.syncToSheets();
        }
    }

    /**
     * 启动同步定时器
     * 注意：已禁用自动同步，因为现在改为直接同时更新 Firebase 和 Google Sheets
     * 避免延迟同步导致的数据覆盖问题
     */
    startSyncTimer() {
        // 禁用自动同步定时器
        // if (this.syncTimer) {
        //     clearInterval(this.syncTimer);
        // }
        // this.syncTimer = setInterval(() => {
        //     this.syncToSheets();
        // }, SYNC_INTERVAL_MS);
        console.log(`[FirebaseService] 自动同步已禁用，改为直接同时更新 Firebase 和 Google Sheets`);
    }

    /**
     * 将 Firebase 数据同步到 Google Sheets
     */
    async syncToSheets() {
        if (!this.syncQueue.length) {
            return { success: true, synced: 0 };
        }

        if (!this.googleService) {
            console.warn('[FirebaseService] Google Service 未设置，跳过同步');
            return { success: false, error: 'Google Service 未设置' };
        }

        console.log(`[FirebaseService] 同步 ${this.syncQueue.length} 条记录到 Sheets...`);

        // 取出队列中的所有项目
        const itemsToSync = [...this.syncQueue];
        this.syncQueue = [];

        // 按 sheetId 分组
        const groupedBySheet = {};
        itemsToSync.forEach(item => {
            if (!groupedBySheet[item.sheetId]) {
                groupedBySheet[item.sheetId] = [];
            }
            groupedBySheet[item.sheetId].push({
                rowNumber: item.rowNumber,
                status: item.data.status,
                reviewer: item.data.reviewer,
                reviewNote: item.data.reviewNote
            });
        });

        try {
            // 批量更新每个 Sheet
            for (const [sheetId, updates] of Object.entries(groupedBySheet)) {
                await this.googleService.batchUpdateFileReviewStatus(updates);
            }

            // 更新 Firebase 中的 _dirty 标记
            const cleanupPromises = itemsToSync.map(item => {
                const path = this.getReviewPath(item.sheetId, item.rowNumber);
                return update(ref(this.db, path), {
                    _dirty: false,
                    _lastSync: Date.now()
                });
            });
            await Promise.all(cleanupPromises);

            console.log(`[FirebaseService] 同步完成: ${itemsToSync.length} 条`);
            return { success: true, synced: itemsToSync.length };
        } catch (error) {
            console.error('[FirebaseService] 同步失败:', error);
            // 把失败的项目放回队列
            this.syncQueue.unshift(...itemsToSync);
            return { success: false, error: error.message };
        }
    }

    /**
     * 强制立即同步（应用退出时调用）
     */
    async flushSync() {
        console.log('[FirebaseService] 强制同步...');
        return await this.syncToSheets();
    }

    /**
     * 获取 Firebase 中某个 Sheet 的所有审核数据
     */
    async getFileReviews(sheetId) {
        if (!this.db) {
            return { success: false, files: [] };
        }

        const path = this.getReviewPath(sheetId);
        const filesRef = ref(this.db, path);

        try {
            const snapshot = await get(filesRef);
            const data = snapshot.val();

            if (!data) {
                return { success: true, files: [] };
            }

            const files = Object.entries(data).map(([rowNumber, fileData]) => ({
                rowNumber: parseInt(rowNumber, 10),
                ...fileData
            }));

            return { success: true, files };
        } catch (error) {
            console.error('[FirebaseService] 获取数据失败:', error);
            return { success: false, error: error.message, files: [] };
        }
    }

    async setSlotPresets(sheetId, slots = [], submitter = '') {
        if (!this.db) {
            return { success: false, error: 'Firebase 未初始化' };
        }
        if (!sheetId) {
            return { success: false, error: '缺少 sheetId' };
        }
        if (!submitter || !submitter.trim()) {
            return { success: false, error: '缺少提交人（submitter）' };
        }
        const userEmail = this.currentUser?.email || this.userEmail || 'anonymous';
        const path = this.getConfigPath(sheetId, 'slotPresets', submitter);
        const presetRef = ref(this.db, path);
        const payload = {
            slots,
            updatedAt: Date.now(),
            updatedBy: userEmail,
            submitter: submitter.trim()
        };
        try {
            await set(presetRef, payload);
            console.log(`[FirebaseService] 保存分类预设成功: submitter=${submitter}`);
            return { success: true, slotsCount: Array.isArray(slots) ? slots.length : 0 };
        } catch (error) {
            console.error('[FirebaseService] 保存分类预设失败:', error);
            return { success: false, error: error.message };
        }
    }

    async getSlotPresets(sheetId, submitter = '') {
        if (!this.db) {
            return { success: false, error: 'Firebase 未初始化', slots: [] };
        }
        if (!sheetId) {
            return { success: false, error: '缺少 sheetId', slots: [] };
        }
        if (!submitter || !submitter.trim()) {
            return { success: false, error: '缺少提交人（submitter）', slots: [] };
        }
        const path = this.getConfigPath(sheetId, 'slotPresets', submitter);
        const presetRef = ref(this.db, path);
        try {
            const snapshot = await get(presetRef);
            const data = snapshot.val();
            if (!data || !Array.isArray(data.slots)) {
                console.log(`[FirebaseService] 获取分类预设: submitter=${submitter}, 无数据`);
                return { success: true, slots: [] };
            }
            console.log(`[FirebaseService] 获取分类预设成功: submitter=${submitter}, 共 ${data.slots.length} 个分类`);
            return { success: true, slots: data.slots, updatedAt: data.updatedAt || 0 };
        } catch (error) {
            console.error('[FirebaseService] 获取分类预设失败:', error);
            return { success: false, error: error.message, slots: [] };
        }
    }

    // ========== 每日打卡设置同步 ==========

    /**
     * 获取打卡设置路径（按人名）
     */
    getCheckinSettingsPath(userName) {
        const cleanUserName = this.sanitizeForPath(userName);
        return `${DB_PATHS.CHECKIN_SETTINGS}/${cleanUserName}`;
    }

    /**
     * 保存打卡设置到 Firebase
     * @param {string} userName - 用户姓名
     * @param {Object} settings - 设置数据 { profile, statusOptions, sheetsUrl, sheetName }
     */
    async saveCheckinSettings(userName, settings) {
        if (!this.db) {
            return { success: false, error: 'Firebase 未初始化' };
        }
        if (!userName || !userName.trim()) {
            return { success: false, error: '缺少用户姓名' };
        }

        const path = this.getCheckinSettingsPath(userName);
        const settingsRef = ref(this.db, path);

        const payload = {
            profile: settings.profile || {},
            statusOptions: settings.statusOptions || [],
            sheetsUrl: settings.sheetsUrl || '',
            sheetName: settings.sheetName || '每日打卡',
            reportSettings: settings.reportSettings || null,
            updatedAt: Date.now()
        };

        try {
            await set(settingsRef, payload);
            console.log(`[FirebaseService] 保存打卡设置成功: ${userName}`);
            return { success: true };
        } catch (error) {
            console.error('[FirebaseService] 保存打卡设置失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 从 Firebase 获取打卡设置
     * @param {string} userName - 用户姓名
     */
    async getCheckinSettings(userName) {
        if (!this.db) {
            return { success: false, error: 'Firebase 未初始化' };
        }
        if (!userName || !userName.trim()) {
            return { success: false, error: '缺少用户姓名' };
        }

        const path = this.getCheckinSettingsPath(userName);
        const settingsRef = ref(this.db, path);

        try {
            const snapshot = await get(settingsRef);
            const data = snapshot.val();

            if (!data) {
                console.log(`[FirebaseService] 获取打卡设置: ${userName}, 无数据`);
                return { success: true, settings: null };
            }

            console.log(`[FirebaseService] 获取打卡设置成功: ${userName}`);
            return { success: true, settings: data };
        } catch (error) {
            console.error('[FirebaseService] 获取打卡设置失败:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== 打卡记录跨设备同步 ==========

    /**
     * 🔴 组别别名映射：自动将旧版本的组别名转换为新名称
     * 这样老版本用户提交的数据会自动合并到正确的组别
     */
    normalizeTeamName(teamName) {
        const TEAM_ALIASES = {
            '视频组': '视频/生图组',
            '生图组': '视频/生图组',
            '视频_生图组': '视频/生图组',
            '图片组': '图片组',  // 保持不变
            '作图组': '图片组',  // 映射到图片组
        };
        const cleaned = (teamName || 'default').trim();
        return TEAM_ALIASES[cleaned] || cleaned;
    }

    /**
     * 🔴 将名称转换为 Firebase 路径安全格式
     * Firebase 路径不允许: . # $ [ ] /
     * 所有这些字符都会被替换为 _
     * @param {string} name - 原始名称（团队名或用户名）
     * @returns {string} - 路径安全的名称
     */
    sanitizeForPath(name) {
        if (!name) return 'default';
        return name.replace(/[.#$[\]/]/g, '_').trim();
    }

    /**
     * 🔴 验证打卡记录是否有效
     * 过滤老版本软件产生的无效记录（只有 status 没有 time）
     * @param {Object} record - 打卡记录
     * @returns {boolean} - 是否为有效记录
     */
    isValidCheckinRecord(record) {
        if (!record || !record.date || !record.slots) {
            return false;
        }

        // 检查是否至少有一个时段有打卡时间
        const slotKeys = ['morning', 'afternoon', 'evening', 'sleep'];
        for (const key of slotKeys) {
            const slot = record.slots[key];
            if (slot) {
                // 兼容两种格式：slot 可能是字符串（时间）或对象
                const timeValue = typeof slot === 'string' ? slot : slot?.time;
                if (timeValue) {
                    return true; // 至少有一个时段有打卡时间
                }
            }
        }

        // 如果没有任何打卡时间，检查是否有特殊状态（休假、身体抱恙等）
        for (const key of slotKeys) {
            const slot = record.slots[key];
            if (slot && typeof slot === 'object') {
                const status = slot.status;
                // 这些状态表示用户主动选择的，即使没有时间也算有效
                if (status && status !== 'normal' && status !== 'absent') {
                    return true;
                }
            }
        }

        // 没有任何有效的打卡数据
        return false;
    }

    /**
     * 获取打卡记录路径
     * 🔴 修复：增加团队名称作为顶层隔离
     * 结构: checkinRecordsV2/{teamName}/{userName}/{date}
     */
    getCheckinRecordsPath(userName, date = null, teamName = 'default') {
        const cleanUserName = this.sanitizeForPath(userName);
        // 🔴 应用组别别名映射
        const normalizedTeam = this.normalizeTeamName(teamName);
        const cleanTeamName = this.sanitizeForPath(normalizedTeam);
        if (date) {
            const cleanDate = this.sanitizeForPath(date);
            return `${getActiveDBPaths().CHECKIN_RECORDS}/${cleanTeamName}/${cleanUserName}/${cleanDate}`;
        }
        return `${getActiveDBPaths().CHECKIN_RECORDS}/${cleanTeamName}/${cleanUserName}`;
    }

    /**
     * 保存单条打卡记录到 Firebase
     * @param {string} userName - 用户名
     * @param {Object} record - 打卡记录
     * @param {string} teamName - 团队名称（用于数据隔离）
     */
    async saveCheckinRecord(userName, record, teamName = 'default') {
        if (!this.db || !userName || !record?.date) {
            return { success: false, error: '参数不完整' };
        }

        // 🔴 写入前验证：拒绝老版本软件产生的无效记录
        // 检查 teamName 是否有效（不能是 'default' 或空）
        const normalizedTeam = this.normalizeTeamName(teamName);
        if (!normalizedTeam || normalizedTeam === 'default') {
            console.warn(`[FirebaseService] 拒绝写入: 团队名称无效 (${teamName})`);
            return { success: false, error: '请先设置组别' };
        }

        // 🔴 验证记录是否有效（至少有一个时段有打卡时间或特殊状态）
        if (!this.isValidCheckinRecord(record)) {
            console.warn(`[FirebaseService] 拒绝写入: 记录无效（无打卡时间）- ${userName} ${record.date}`);
            return { success: false, error: '无效的打卡记录' };
        }

        const path = this.getCheckinRecordsPath(userName, record.date, normalizedTeam);
        const recordRef = ref(this.db, path);

        const payload = {
            ...record,
            userName,
            teamName: normalizedTeam,
            updatedAt: Date.now(),
            // 🔴 添加版本标记，方便后续识别
            _version: 2
        };

        try {
            await set(recordRef, payload);
            console.log(`[FirebaseService] 保存打卡记录: ${userName} ${record.date} (团队: ${normalizedTeam})`);
            return { success: true };
        } catch (error) {
            console.error('[FirebaseService] 保存打卡记录失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取用户所有打卡记录
     * @param {string} userName - 用户名
     * @param {string} teamName - 团队名称
     */
    async getCheckinRecords(userName, teamName = 'default') {
        if (!this.db || !userName) {
            return { success: false, records: [] };
        }

        const path = this.getCheckinRecordsPath(userName, null, teamName);
        const recordsRef = ref(this.db, path);

        try {
            const snapshot = await get(recordsRef);
            const data = snapshot.val();

            if (!data) {
                return { success: true, records: [] };
            }

            const records = Object.values(data);
            console.log(`[FirebaseService] 获取打卡记录: ${userName} (团队: ${teamName}), ${records.length} 条`);
            return { success: true, records };
        } catch (error) {
            console.error('[FirebaseService] 获取打卡记录失败:', error);
            return { success: false, error: error.message, records: [] };
        }
    }

    /**
     * 批量保存打卡记录
     * @param {string} userName - 用户名
     * @param {Array} records - 记录数组
     * @param {string} teamName - 团队名称
     */
    async batchSaveCheckinRecords(userName, records, teamName = 'default') {
        if (!this.db || !records?.length) {
            return { success: false };
        }

        const updates = {};
        records.forEach(record => {
            if (record.date) {
                // 🔴 使用每条记录自身的 userName/teamName，而不是统一参数
                const recordUserName = record.userName || userName;
                const recordTeamName = record.teamName || teamName || 'default';
                const path = this.getCheckinRecordsPath(recordUserName, record.date, recordTeamName);
                updates[path] = { ...record, userName: recordUserName, teamName: recordTeamName, updatedAt: Date.now() };
            }
        });

        try {
            const rootRef = ref(this.db);
            await update(rootRef, updates);
            console.log(`[FirebaseService] 批量保存打卡记录: ${records.length} 条`);
            return { success: true, saved: records.length };
        } catch (error) {
            console.error('[FirebaseService] 批量保存失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取指定团队的所有用户打卡记录
     * @param {string} teamName - 团队名称
     */
    async getAllCheckinRecords(teamName = 'default') {
        if (!this.db) {
            return { success: false, records: [] };
        }

        const activePaths = getActiveDBPaths();
        const normalizedTeam = this.normalizeTeamName(teamName);
        const cleanTeamName = this.sanitizeForPath(normalizedTeam);
        const path = `${activePaths.CHECKIN_RECORDS}/${cleanTeamName}`;
        const recordsRef = ref(this.db, path);

        try {
            const snapshot = await get(recordsRef);
            const data = snapshot.val();

            if (!data) {
                return { success: true, records: [] };
            }

            // 展开嵌套结构：{ userName: { date: record } } -> [record, record, ...]
            const records = [];
            Object.entries(data).forEach(([userName, userRecords]) => {
                if (userRecords && typeof userRecords === 'object') {
                    Object.values(userRecords).forEach(record => {
                        if (record && record.date) {
                            records.push({
                                ...record,
                                userName: record.userName || userName.replace(/_/g, ' '),
                                teamName: teamName
                            });
                        }
                    });
                }
            });

            // 🔴 过滤无效记录（老版本软件产生的只有 status 没有 time 的记录）
            const validRecords = records.filter(r => this.isValidCheckinRecord(r));
            const invalidCount = records.length - validRecords.length;

            if (invalidCount > 0) {
                console.log(`[FirebaseService] 获取团队打卡记录: 团队=${teamName}, 共 ${records.length} 条, 过滤无效 ${invalidCount} 条, 有效 ${validRecords.length} 条`);
            } else {
                console.log(`[FirebaseService] 获取团队打卡记录: 团队=${teamName}, ${validRecords.length} 条，共 ${Object.keys(data).length} 个用户`);
            }
            return { success: true, records: validRecords };
        } catch (error) {
            console.error('[FirebaseService] 获取所有打卡记录失败:', error);
            return { success: false, error: error.message, records: [] };
        }
    }

    /**
     * 获取所有团队的打卡记录
     * 🔴 修复：兼容两种数据格式
     * 新格式: checkinRecords/{teamName}/{userName}/{date}
     * 旧格式: checkinRecords/{userName}/{date}
     */
    async getAllCheckinRecordsAllTeams() {
        if (!this.db) {
            return { success: false, records: [] };
        }

        const path = getActiveDBPaths().CHECKIN_RECORDS;
        const recordsRef = ref(this.db, path);

        try {
            const snapshot = await get(recordsRef);
            const data = snapshot.val();

            if (!data) {
                console.log('[FirebaseService] checkinRecords 为空');
                return { success: true, records: [] };
            }

            const records = [];

            // 遍历第一层
            Object.entries(data).forEach(([key1, value1]) => {
                if (!value1 || typeof value1 !== 'object') return;

                // 检查是新格式（团队->用户->日期）还是旧格式（用户->日期）
                // 如果 value1 的值是包含 date 字段的对象，说明是旧格式
                const firstChild = Object.values(value1)[0];

                if (firstChild && typeof firstChild === 'object' && firstChild.date) {
                    // 🔴 旧格式：key1 是用户名，value1 是 { date: record }
                    Object.values(value1).forEach(record => {
                        if (record && record.date) {
                            records.push({
                                ...record,
                                userName: record.userName || key1.replace(/_/g, ' '),
                                teamName: record.teamName || 'default'
                            });
                        }
                    });
                } else {
                    // 🔴 新格式：key1 是团队名，value1 是 { userName: { date: record } }
                    Object.entries(value1).forEach(([userName, userRecords]) => {
                        if (userRecords && typeof userRecords === 'object') {
                            Object.values(userRecords).forEach(record => {
                                if (record && record.date) {
                                    records.push({
                                        ...record,
                                        userName: record.userName || userName.replace(/_/g, ' '),
                                        teamName: record.teamName || key1
                                    });
                                }
                            });
                        }
                    });
                }
            });

            // 🔴 过滤无效记录（老版本软件产生的只有 status 没有 time 的记录）
            const validRecords = records.filter(r => this.isValidCheckinRecord(r));
            const invalidCount = records.length - validRecords.length;

            if (invalidCount > 0) {
                console.log(`[FirebaseService] 获取跨团队打卡记录: 共 ${records.length} 条, 过滤无效记录 ${invalidCount} 条, 有效 ${validRecords.length} 条`);
            } else {
                console.log(`[FirebaseService] 获取跨团队打卡记录: ${validRecords.length} 条`);
            }
            return { success: true, records: validRecords };
        } catch (error) {
            console.error('[FirebaseService] 获取跨团队打卡记录失败:', error);
            return { success: false, error: error.message, records: [] };
        }
    }

    /**
     * 实时监听指定团队的打卡记录（用于团队总览实时更新）
     * @param {string} teamName - 团队名称
     * @param {Function} callback - 数据变化回调
     */
    watchAllCheckinRecords(teamName = 'default', callback) {
        if (!this.db) {
            console.error('[FirebaseService] 未初始化，无法监听打卡记录');
            return null;
        }

        const isAllTeams = teamName === '*';
        const normalizedTeam = this.normalizeTeamName(teamName);
        const cleanTeamName = this.sanitizeForPath(normalizedTeam);
        const activePaths = getActiveDBPaths();
        const path = isAllTeams ? activePaths.CHECKIN_RECORDS : `${activePaths.CHECKIN_RECORDS}/${cleanTeamName}`;
        const recordsRef = ref(this.db, path);
        const listenerId = isAllTeams ? 'checkin-records-all' : `checkin-records-${cleanTeamName}`;

        // 如果已有监听器，先移除
        if (this.listeners.has(listenerId)) {
            this.stopWatching(listenerId);
        }

        console.log(`[FirebaseService] 开始监听团队打卡记录: ${path}`);

        const unsubscribe = onValue(recordsRef, (snapshot) => {
            const data = snapshot.val();
            const records = [];

            if (data) {
                if (isAllTeams) {
                    Object.entries(data).forEach(([teamKey, teamRecords]) => {
                        if (!teamRecords || typeof teamRecords !== 'object') return;
                        Object.entries(teamRecords).forEach(([userName, userRecords]) => {
                            if (userRecords && typeof userRecords === 'object') {
                                Object.values(userRecords).forEach(record => {
                                    if (record && record.date) {
                                        records.push({
                                            ...record,
                                            userName: record.userName || userName.replace(/_/g, ' '),
                                            teamName: record.teamName || teamKey
                                        });
                                    }
                                });
                            }
                        });
                    });
                } else {
                    Object.entries(data).forEach(([userName, userRecords]) => {
                        if (userRecords && typeof userRecords === 'object') {
                            Object.values(userRecords).forEach(record => {
                                if (record && record.date) {
                                    records.push({
                                        ...record,
                                        userName: record.userName || userName.replace(/_/g, ' '),
                                        teamName: teamName
                                    });
                                }
                            });
                        }
                    });
                }
            }

            // 🔴 过滤无效记录（老版本软件产生的只有 status 没有 time 的记录）
            const validRecords = records.filter(r => this.isValidCheckinRecord(r));
            const invalidCount = records.length - validRecords.length;

            const teamLabel = isAllTeams ? '所有团队' : teamName;
            if (invalidCount > 0) {
                console.log(`[FirebaseService] 团队打卡记录更新 (${teamLabel}): 共 ${records.length} 条, 过滤无效 ${invalidCount} 条, 有效 ${validRecords.length} 条`);
            } else {
                console.log(`[FirebaseService] 团队打卡记录更新 (${teamLabel}): ${validRecords.length} 条`);
            }

            if (callback) {
                callback({ type: 'update', records: validRecords });
            }

            if (this.eventCallback) {
                this.eventCallback({ type: 'checkin-update', records: validRecords, teamName: isAllTeams ? '*' : teamName });
            }
        }, (error) => {
            console.error('[FirebaseService] 监听打卡记录错误:', error);
            if (callback) {
                callback({ type: 'error', error: error.message });
            }
        });

        this.listeners.set(listenerId, { ref: recordsRef, unsubscribe });
        this.currentCheckinListenerId = listenerId;
        return { success: true, listenerId };
    }

    /**
     * 停止监听所有打卡记录
     */
    stopWatchingCheckinRecords() {
        if (this.currentCheckinListenerId) {
            const result = this.stopWatching(this.currentCheckinListenerId);
            this.currentCheckinListenerId = null;
            return result;
        }
        return { success: false, error: '监听器不存在' };
    }

    /**
     * 检查 Firebase 是否已初始化且可用
     */
    isReady() {
        return this.initialized && this.db !== null;
    }

    getActiveDBPaths() {
        return getActiveDBPaths();
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            console.log('[FirebaseService] 清理资源...');

            // 停止所有监听
            this.stopAllWatching();

            // 停止同步定时器
            if (this.syncTimer) {
                clearInterval(this.syncTimer);
                this.syncTimer = null;
            }

            // 强制同步剩余队列
            await this.flushSync();

            console.log('[FirebaseService] 清理完成');
        } catch (err) {
            // 应用关闭时 stdout 可能已断开，忽略 EPIPE
            if (err?.code !== 'EPIPE') {
                console.error('[FirebaseService] 清理时出错:', err);
            }
        }
    }

    /**
     * 保存报数记录到 Firebase（按团队隔离）
     */
    async saveReportRecord(date, record, teamName = 'default') {
        if (!this.db) {
            console.warn('[FirebaseService] 未初始化，无法保存报数记录');
            return { success: false, error: 'Firebase 未初始化' };
        }

        try {
            const safeTeamName = this.sanitizeForPath(teamName);
            const recordId = `${this.sanitizeForPath(record.userName)}-${record.slot}-${Date.now()}`;
            const activePaths = this.getActiveDBPaths();
            const path = `${activePaths.REPORT_RECORDS}/${safeTeamName}/${date}/${recordId}`;
            const recordRef = ref(this.db, path);

            await set(recordRef, {
                ...record,
                timestamp: Date.now()
            });

            console.log(`[FirebaseService] 报数记录已保存: ${record.userName} - ${record.slotLabel} (团队: ${teamName})`);
            return { success: true };
        } catch (error) {
            console.error('[FirebaseService] 保存报数记录失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔴 保存任务统计修正记录（从任务统计表格直接编辑）
     * 这会创建一条新的报数记录来覆盖原有的统计数据
     * @param {Object} params
     * @param {string} params.date - 日期 YYYY-MM-DD
     * @param {string} params.userName - 用户名
     * @param {string} params.teamName - 团队名
     * @param {string} params.originalTaskType - 原任务类型
     * @param {string} params.newTaskType - 新任务类型
     * @param {number} params.newCount - 新数量
     * @param {number} params.originalCount - 原数量（可选，用于记录）
     */
    async saveCorrectionRecord(params) {
        if (!this.db) {
            console.warn('[FirebaseService] 未初始化，无法保存修正记录');
            return { success: false, error: 'Firebase 未初始化' };
        }

        const { date, userName, teamName = 'default', originalTaskType, newTaskType, newCount, originalCount } = params;

        try {
            const safeTeamName = this.sanitizeForPath(teamName);
            const recordId = `${this.sanitizeForPath(userName)}-correction-${Date.now()}`;
            const activePaths = this.getActiveDBPaths();
            const path = `${activePaths.REPORT_RECORDS}/${safeTeamName}/${date}/${recordId}`;
            const recordRef = ref(this.db, path);

            // 构造任务字符串，格式与正常报数相同
            const taskCount = newCount > 1 ? `${newTaskType} ×${newCount}` : newTaskType;

            const correctionRecord = {
                userName,
                teamName,
                date,
                type: 'correction',
                slot: 'correction',
                slotKey: 'correction',
                slotLabel: '统计修正',
                taskCount,
                originalTaskType,
                originalCount: originalCount || 0,
                newTaskType,
                newCount,
                time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                timestamp: Date.now()
            };

            await set(recordRef, correctionRecord);

            console.log(`[FirebaseService] 统计修正记录已保存: ${userName} ${date} ${originalTaskType}→${newTaskType} ×${newCount} (团队: ${teamName})`);
            return { success: true, record: correctionRecord };
        } catch (error) {
            console.error('[FirebaseService] 保存修正记录失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 开始监听指定日期的报数记录（按团队隔离）
     * @param date 日期
     * @param teamName 团队名称，'*' 表示监听所有团队
     * @param callback 回调函数
     */
    watchReportRecords(date, teamName = 'default', callback) {
        if (!this.db) {
            console.warn('[FirebaseService] 未初始化，无法监听报数记录');
            return { success: false, error: 'Firebase 未初始化' };
        }

        const listenerId = `report-records-${teamName}-${date}`;

        // 如果已经在监听，先停止
        this.stopWatching(listenerId);

        // 保存当前团队名称供停止时使用
        this.currentReportTeam = teamName;
        this.currentReportDate = date;

        // 根据 teamName 决定监听范围
        const activePaths = this.getActiveDBPaths();
        let recordsRef;
        if (teamName === '*') {
            // 监听所有团队：监听 reportRecords 根节点
            recordsRef = ref(this.db, activePaths.REPORT_RECORDS);
            console.log(`[FirebaseService] 开始监听所有团队报数记录`);
        } else {
            // 只监听指定团队（使用路径安全名称）
            const safeTeamName = this.sanitizeForPath(teamName);
            recordsRef = ref(this.db, `${activePaths.REPORT_RECORDS}/${safeTeamName}/${date}`);
            console.log(`[FirebaseService] 开始监听报数记录: ${safeTeamName}/${date}`);
        }

        const unsubscribe = onValue(recordsRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                if (callback) {
                    callback({ type: 'update', records: [] });
                }
                return;
            }

            let records = [];

            if (teamName === '*') {
                // 监听所有团队：需要遍历所有团队和日期
                console.log(`[FirebaseService] 🔴 DEBUG: 收到报数数据，团队数: ${Object.keys(data).length}`);
                Object.entries(data).forEach(([team, teamData]) => {
                    console.log(`[FirebaseService] 🔴 DEBUG: 团队 "${team}"，日期数: ${Object.keys(teamData || {}).length}`);
                    if (teamData && typeof teamData === 'object') {
                        // 只获取今天的数据
                        const dateData = teamData[date];
                        console.log(`[FirebaseService] 🔴 DEBUG: 查找日期 "${date}"，找到: ${dateData ? Object.keys(dateData).length : 0} 条`);
                        if (dateData && typeof dateData === 'object') {
                            Object.entries(dateData).forEach(([id, record]) => {
                                records.push({ id, teamName: team, ...record });
                            });
                        }
                    }
                });
            } else {
                // 只监听指定团队
                records = Object.entries(data)
                    .map(([id, record]) => ({ id, teamName, ...record }));
            }

            // 按时间排序
            records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            const teamLabel = teamName === '*' ? '所有团队' : teamName;
            console.log(`[FirebaseService] 报数记录更新: ${records.length} 条 (${teamLabel})`);

            if (callback) {
                callback({ type: 'update', records });
            }
        }, (error) => {
            console.error('[FirebaseService] 监听报数记录错误:', error);
            if (callback) {
                callback({ type: 'error', error: error.message });
            }
        });

        this.listeners.set(listenerId, { ref: recordsRef, unsubscribe });
        return { success: true, listenerId };
    }

    /**
     * 获取报数记录（日期范围）
     * @param {Object} params
     * @param {string} params.teamName - 团队名称，'*' 表示所有团队
     * @param {string} params.startDate - 起始日期 YYYY-MM-DD
     * @param {string} params.endDate - 结束日期 YYYY-MM-DD
     */
    async getReportRecordsRange(params = {}) {
        if (!this.db) {
            return { success: false, records: [], error: 'Firebase 未初始化' };
        }

        const teamName = params.teamName || '*';
        const startDate = params.startDate || '0000-00-00';
        const endDate = params.endDate || '9999-12-31';
        const activePaths = this.getActiveDBPaths();
        const records = [];
        const seenKeys = new Set();

        try {
            const isDateKey = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key);
            const isRecordLike = (value) => {
                if (!value || typeof value !== 'object') return false;
                return Boolean(
                    value.userName ||
                    value.slot ||
                    value.slotKey ||
                    value.taskCount ||
                    value.slotLabel ||
                    value.type ||
                    value.time ||
                    value.timestamp
                );
            };
            const isWithinRange = (dateKey) => {
                if (!dateKey || !isDateKey(dateKey)) return true;
                if (startDate && dateKey < startDate) return false;
                if (endDate && dateKey > endDate) return false;
                return true;
            };
            const pushRecord = (record, ctx = {}, entryKey = '') => {
                if (!record || typeof record !== 'object') return;
                const recordDate = record.date || ctx.dateKey || '';
                if (!isWithinRange(recordDate)) return;
                const id = record.id || entryKey || `${record.userName || ''}-${record.slot || record.slotKey || ''}-${record.time || record.timestamp || recordDate}`;
                const teamLabel = record.teamName || ctx.teamName || teamName || 'default';
                const dedupeKey = `${teamLabel}::${recordDate}::${id}`;
                if (seenKeys.has(dedupeKey)) return;
                seenKeys.add(dedupeKey);
                records.push({
                    id,
                    teamName: teamLabel,
                    date: record.date || recordDate || undefined,
                    ...record
                });
            };
            const traverse = (node, ctx = {}, entryKey = '') => {
                if (!node || typeof node !== 'object') return;
                if (isRecordLike(node)) {
                    pushRecord(node, ctx, entryKey);
                    return;
                }
                Object.entries(node).forEach(([key, value]) => {
                    if (!value || typeof value !== 'object') return;
                    const nextCtx = { ...ctx };
                    if (!nextCtx.dateKey && isDateKey(key)) {
                        nextCtx.dateKey = key;
                    } else if (!nextCtx.teamName && !isDateKey(key) && !isRecordLike(value)) {
                        nextCtx.teamName = key;
                    }
                    traverse(value, nextCtx, key);
                });
            };

            const loadFromPath = async (path) => {
                const reportSnap = await get(ref(this.db, path));
                const reportData = reportSnap.exists() ? reportSnap.val() : {};
                traverse(reportData, teamName === '*' ? {} : { teamName });
            };

            if (teamName === '*') {
                const candidates = [
                    activePaths.REPORT_RECORDS,
                    DB_PATHS.REPORT_RECORDS,
                    DB_PATHS_V3.REPORT_RECORDS,
                    DB_PATHS_V1.REPORT_RECORDS
                ].filter(Boolean);
                const unique = Array.from(new Set(candidates));
                console.log(`[FirebaseService] 🔴 DEBUG: 正在从以下路径加载报数记录:`, unique);
                for (const path of unique) {
                    const beforeCount = records.length;
                    await loadFromPath(path);
                    console.log(`[FirebaseService] 🔴 DEBUG: 路径 "${path}" 加载了 ${records.length - beforeCount} 条记录`);
                }
                console.log(`[FirebaseService] 🔴 DEBUG: 总共加载 ${records.length} 条报数记录`);
            } else {
                const safeTeamName = this.sanitizeForPath(teamName);
                const candidates = [
                    `${activePaths.REPORT_RECORDS}/${safeTeamName}`,
                    `${DB_PATHS.REPORT_RECORDS}/${safeTeamName}`,
                    `${DB_PATHS_V3.REPORT_RECORDS}/${safeTeamName}`,
                    `${DB_PATHS_V1.REPORT_RECORDS}/${safeTeamName}`
                ];
                const unique = Array.from(new Set(candidates));
                for (const path of unique) {
                    await loadFromPath(path);
                }
            }

            return { success: true, records };
        } catch (error) {
            console.error('[FirebaseService] 获取报数记录失败:', error);
            return { success: false, records: [], error: error.message };
        }
    }

    /**
     * 🔴 发送催报消息（通过 Firebase 广播）
     * @param {Object} message - 催报消息
     * @param {string} message.slotKey - 时段 key
     * @param {string} message.slotLabel - 时段标签
     * @param {Array} message.targetUsers - 目标用户列表
     * @param {string} message.senderName - 发送者姓名
     * @param {string} message.teamName - 团队名称
     */
    async sendRemindMessage(message) {
        if (!this.db) {
            console.warn('[FirebaseService] 未初始化，无法发送催报消息');
            return { success: false, error: 'Firebase 未初始化' };
        }

        try {
            const today = new Date().toISOString().split('T')[0];
            const messageId = `remind-${Date.now()}`;
            const path = `${DB_PATHS.REMIND_MESSAGES}/${message.teamName || 'default'}/${today}/${messageId}`;
            const remindRef = ref(this.db, path);

            await set(remindRef, {
                type: 'remind',
                slotKey: message.slotKey,
                slotLabel: message.slotLabel,
                targetUsers: message.targetUsers || [],
                senderName: message.senderName,
                teamName: message.teamName || 'default',
                timestamp: Date.now(),
                time: new Date().toISOString()
            });

            console.log(`[FirebaseService] 催报消息已发送: ${message.slotLabel}, 目标用户: ${message.targetUsers?.length || 0} 人`);
            return { success: true };
        } catch (error) {
            console.error('[FirebaseService] 发送催报消息失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔴 监听催报消息（支持所有团队）
     * @param {string} teamName - 团队名称，'*' 表示所有团队
     * @param {Function} callback - 回调函数
     */
    watchRemindMessages(teamName = 'default', callback) {
        if (!this.db) {
            console.warn('[FirebaseService] 未初始化，无法监听催报消息');
            return { success: false, error: 'Firebase 未初始化' };
        }

        const today = new Date().toISOString().split('T')[0];
        const listenerId = `remind-messages-${teamName}-${today}`;

        // 如果已经在监听，先停止
        this.stopWatching(listenerId);

        // 🔴 如果是 '*'，监听所有团队的催报消息
        const path = teamName === '*' ? DB_PATHS.REMIND_MESSAGES : `${DB_PATHS.REMIND_MESSAGES}/${teamName}/${today}`;
        const remindRef = ref(this.db, path);

        console.log(`[FirebaseService] 开始监听催报消息: ${path}`);

        const unsubscribe = onValue(remindRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                return;
            }

            let messages = [];
            const now = Date.now();

            if (teamName === '*') {
                // 🔴 遍历所有团队
                Object.entries(data).forEach(([team, dateData]) => {
                    if (dateData && dateData[today]) {
                        Object.entries(dateData[today]).forEach(([id, msg]) => {
                            // 只取5秒内的消息
                            if (now - (msg.timestamp || 0) < 5000) {
                                messages.push({ id, ...msg });
                            }
                        });
                    }
                });
            } else {
                messages = Object.entries(data)
                    .map(([id, msg]) => ({ id, ...msg }))
                    .filter(msg => now - (msg.timestamp || 0) < 5000);
            }

            messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            if (messages.length > 0 && callback) {
                callback({ type: 'remind', messages });
            }
        }, (error) => {
            console.error('[FirebaseService] 监听催报消息错误:', error);
        });

        this.listeners.set(listenerId, { ref: remindRef, unsubscribe });
        return { success: true, listenerId };
    }

    /**
     * 停止监听报数记录
     */
    stopWatchingReportRecords() {
        const teamName = this.currentReportTeam || 'default';
        const date = this.currentReportDate || new Date().toISOString().split('T')[0];
        return this.stopWatching(`report-records-${teamName}-${date}`);
    }

    /**
     * 🔴 重置打卡数据库：清空并初始化团队成员
     * @param {string} targetVersion - 要重置的版本：'V1'、'V2'、'V3' 或 'all'
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async resetCheckinDatabase(targetVersion = 'V2') {
        if (!this.db) {
            return { success: false, message: 'Firebase 未初始化' };
        }

        try {
            // 根据版本选择路径
            const pathsToReset = [];
            if (targetVersion === 'V1' || targetVersion === 'all') {
                pathsToReset.push({ name: 'V1', paths: DB_PATHS_V1 });
            }
            if (targetVersion === 'V2' || targetVersion === 'all') {
                pathsToReset.push({ name: 'V2', paths: DB_PATHS });
            }
            if (targetVersion === 'V3' || targetVersion === 'all') {
                pathsToReset.push({ name: 'V3', paths: DB_PATHS_V3 });
            }

            if (pathsToReset.length === 0) {
                return { success: false, message: '无效的版本选择' };
            }

            // 清空选定版本的数据
            for (const { name, paths } of pathsToReset) {
                console.log(`[FirebaseService] 正在清空 ${name} 打卡和报数数据...`);
                await set(ref(this.db, paths.CHECKIN_RECORDS), null);
                await set(ref(this.db, paths.CHECKIN_SETTINGS), null);
                await set(ref(this.db, paths.REPORT_RECORDS), null);
                await set(ref(this.db, paths.REMIND_MESSAGES), null);
                console.log(`[FirebaseService] ${name} 数据已清空`);
            }

            // 只有重置 V2 时才初始化成员数据
            if (targetVersion === 'V2' || targetVersion === 'all') {
                // 预设的组别成员列表
                const teamMembers = {
                    '视频/生图组': ['丽颖', '九月', '豆豆', '南汐', '叶子', '心诚', '诚冉', '百草', '叶贝', '雪儿', '刚强', '小军', '小恒', '徐乐', '领会', '林溪', '张园', '宝峰'],
                    '作图组': ['喜乐', '丁琪', '任真', '安琪', '张浩', '杨阳', '芊蔓', '明路', '林潇', '陈泽', '柯羽', '振宇', '琳琅']
                };

                const today = new Date().toISOString().split('T')[0];
                console.log('[FirebaseService] 正在创建成员初始设置和打卡记录...');
                const updates = {};
                for (const [teamName, members] of Object.entries(teamMembers)) {
                    const cleanTeamName = this.sanitizeForPath(teamName);
                    for (const memberName of members) {
                        // 设置
                        const settingsPath = `${DB_PATHS.CHECKIN_SETTINGS}/${memberName}`;
                        updates[settingsPath] = {
                            profile: {
                                name: memberName,
                                teamName: teamName,
                                mode: 'full_time',
                                notifyEnabled: true,
                                notifyPosition: 'topRight',
                                notificationScale: 60,
                                reportNotifyMode: 'all',
                                overviewAllTeams: false
                            },
                            updatedAt: Date.now()
                        };

                        // 创建今天的空打卡记录
                        const recordPath = `${DB_PATHS.CHECKIN_RECORDS}/${cleanTeamName}/${memberName}/${today}`;
                        updates[recordPath] = {
                            id: `day-${today}-${memberName}`,
                            date: today,
                            userName: memberName,
                            teamName: teamName,
                            mode: 'full_time',
                            targetPeriods: [],
                            slots: {
                                morning: { status: 'normal' },
                                afternoon: { status: 'normal' },
                                evening: { status: 'normal' },
                                sleep: null,
                                customActivities: []
                            },
                            updatedAt: Date.now()
                        };
                    }
                }
                await update(ref(this.db), updates);

                const totalMembers = Object.values(teamMembers).flat().length;
                console.log(`[FirebaseService] 已创建 ${totalMembers} 个成员的初始设置和打卡记录`);
                return { success: true, message: `已重置 ${targetVersion} 数据库，创建了 ${totalMembers} 个成员` };
            }

            return { success: true, message: `已重置 ${targetVersion} 数据库` };
        } catch (error) {
            console.error('[FirebaseService] 重置数据库失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 🔴 一键清理错误的数据（把用户名当作团队名的错误节点）
     * 有效的团队名：视频/生图组、图片组、视频_生图组、作图组
     * 无效的团队名：用户名（如百草、喜乐等）、日期格式、default
     * @param {boolean} dryRun - 如果为 true，只预览不删除
     */
    async cleanupInvalidTeamNames(dryRun = false) {
        if (!this.db) {
            return { success: false, message: 'Firebase 未初始化' };
        }

        try {
            // 有效的团队名列表（包括别名和处理后的名称）
            const validTeamNames = new Set([
                '视频/生图组', '视频_生图组',
                '图片组', '作图组',
                '生图组', '视频组'
            ]);

            // 已知的用户名列表（这些如果出现在团队名位置就是错误的）
            const knownUserNames = new Set([
                '丽颖', '九月', '豆豆', '南汐', '叶子', '心诚', '诚冉', '百草', '叶贝', '雪儿',
                '刚强', '小军', '小恒', '徐乐', '领会', '林溪', '张园', '宝峰',
                '喜乐', '丁琪', '任真', '安琪', '张浩', '杨阳', '芊蔓', '明路', '林潇', '陈泽', '柯羽', '振宇', '琳琅'
            ]);

            // 检查一个 key 是否是无效的团队名
            const isInvalidTeamName = (key) => {
                // 如果是有效的团队名，不删除
                if (validTeamNames.has(key)) return false;

                // 如果是日期格式（YYYY-MM-DD），是无效的团队名
                if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return true;

                // 如果是已知用户名，是无效的团队名
                if (knownUserNames.has(key)) return true;

                // 如果包含"组-"前缀（如"图片组-丁琪"），是无效的团队名
                if (key.includes('组-')) return true;

                // default 也是无效的
                if (key === 'default') return true;

                return false;
            };

            console.log(`[FirebaseService] ${dryRun ? '预览' : '开始'}清理错误的团队名...`);

            const updates = {};
            let totalRecordCount = 0;

            // 获取所有 checkinRecords
            const snapshot = await get(ref(this.db, DB_PATHS.CHECKIN_RECORDS));
            if (!snapshot.exists()) {
                return { success: true, message: '没有数据需要清理', deleted: 0, preview: [] };
            }

            const data = snapshot.val();
            const preview = []; // 预览信息

            // 检查每个顶层 key
            Object.keys(data).forEach(teamKey => {
                if (isInvalidTeamName(teamKey)) {
                    updates[`${DB_PATHS.CHECKIN_RECORDS}/${teamKey}`] = null;

                    // 计算要删除的记录数和收集预览信息
                    const teamData = data[teamKey];
                    let recordCount = 0;
                    const subKeys = [];

                    if (typeof teamData === 'object' && teamData) {
                        Object.keys(teamData).forEach(subKey => {
                            subKeys.push(subKey);
                            const subData = teamData[subKey];
                            if (typeof subData === 'object' && subData) {
                                recordCount += Object.keys(subData).length;
                            } else {
                                recordCount += 1;
                            }
                        });
                    }

                    preview.push({
                        invalidKey: teamKey,
                        subKeys: subKeys.slice(0, 5), // 只显示前5个子节点
                        subKeysTotal: subKeys.length,
                        recordCount
                    });

                    totalRecordCount += recordCount;
                }
            });

            if (Object.keys(updates).length === 0) {
                return { success: true, message: '没有错误的数据需要清理', deleted: 0, preview: [] };
            }

            // 如果是预览模式，只返回预览信息
            if (dryRun) {
                console.log(`[FirebaseService] 预览完成: ${preview.length} 个错误节点，约 ${totalRecordCount} 条记录`);
                return {
                    success: true,
                    dryRun: true,
                    message: `发现 ${preview.length} 个错误节点，共约 ${totalRecordCount} 条记录`,
                    preview,
                    totalToDelete: preview.length,
                    totalRecordCount
                };
            }

            console.log(`[FirebaseService] 准备删除 ${preview.length} 个错误的团队名`);

            // 执行删除
            await update(ref(this.db), updates);

            console.log(`[FirebaseService] 已清理 ${preview.length} 个错误节点，约 ${totalRecordCount} 条记录`);

            return {
                success: true,
                message: `已清理 ${preview.length} 个错误节点`,
                deleted: totalRecordCount,
                invalidTeamNames: preview.map(p => p.invalidKey)
            };
        } catch (error) {
            console.error('[FirebaseService] 清理失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 🔴 从 V1 迁移有效数据到目标版本
     * 只迁移结构正确的数据：teamName/userName/date 格式，且有 time 字段
     * @param {boolean} dryRun - 如果为 true，只预览不迁移
     * @param {string} targetVersion - 目标版本：'V2'（生产）或 'V3'（测试）
     */
    async migrateV1ToV2(dryRun = false, targetVersion = 'V2') {
        if (!this.db) {
            return { success: false, message: 'Firebase 未初始化' };
        }

        // 获取目标路径配置
        let targetPaths = DB_PATHS;  // 默认 V2
        if (targetVersion === 'V3') {
            targetPaths = DB_PATHS_V3;
        }

        try {
            // 有效的团队名列表
            const validTeamNames = new Set([
                '视频/生图组', '视频_生图组',
                '图片组', '作图组',
                '生图组', '视频组'
            ]);

            console.log(`[FirebaseService] ${dryRun ? '预览' : '开始'}迁移 V1 -> ${targetVersion}...`);

            const updates = {};
            let migratedRecords = 0;
            let migratedSettings = 0;
            let skippedInvalid = 0;
            const preview = [];

            // 按团队和用户统计的详细预览
            const teamDetails = {};  // { teamName: { users: { userName: recordCount }, totalRecords: N } }

            // 1. 迁移 checkinRecords
            const recordsSnap = await get(ref(this.db, DB_PATHS_V1.CHECKIN_RECORDS));
            if (recordsSnap.exists()) {
                const v1Records = recordsSnap.val();

                Object.entries(v1Records || {}).forEach(([teamKey, teamData]) => {
                    // 只处理有效的团队名
                    if (!validTeamNames.has(teamKey) && !validTeamNames.has(teamKey.replace(/_/g, '/'))) {
                        skippedInvalid++;
                        preview.push({
                            type: 'skipped_team',
                            key: teamKey,
                            reason: '无效团队名'
                        });
                        return;
                    }

                    // 🔴 使用 normalizeTeamName 将老团队名映射到新团队名
                    // 例如：视频组 → 视频/生图组，然后 sanitizeForPath 转为 视频_生图组
                    const mappedTeam = this.normalizeTeamName(teamKey);
                    const normalizedTeam = this.sanitizeForPath(mappedTeam);
                    const displayTeam = mappedTeam;  // 显示用的团队名

                    if (typeof teamData !== 'object' || !teamData) return;

                    // 初始化团队统计
                    if (!teamDetails[displayTeam]) {
                        teamDetails[displayTeam] = { users: {}, totalRecords: 0 };
                    }

                    Object.entries(teamData).forEach(([userKey, userData]) => {
                        if (typeof userData !== 'object' || !userData) return;

                        let userValidCount = 0;
                        let userSkippedCount = 0;

                        // 🔴 检测用户数据是否被污染（含有非日期格式的 key）
                        const allKeys = Object.keys(userData);
                        const dateKeys = allKeys.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
                        const nonDateKeys = allKeys.filter(k => !/^\d{4}-\d{2}-\d{2}$/.test(k));
                        const isContaminated = nonDateKeys.length > 0;

                        // 今天的日期
                        const today = new Date().toISOString().split('T')[0];  // 2026-01-10

                        Object.entries(userData).forEach(([dateKey, record]) => {
                            // 验证日期格式
                            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                                userSkippedCount++;
                                return;
                            }

                            // 🔴 如果用户数据被污染，只迁移今天的记录
                            if (isContaminated && dateKey !== today) {
                                userSkippedCount++;
                                return;
                            }

                            // 验证记录有效性：至少有一个时段有 time
                            if (!this.isValidCheckinRecord(record)) {
                                skippedInvalid++;
                                userSkippedCount++;
                                return;
                            }

                            // 迁移到目标版本
                            const targetPath = `${targetPaths.CHECKIN_RECORDS}/${normalizedTeam}/${userKey}/${dateKey}`;
                            updates[targetPath] = {
                                ...record,
                                teamName: displayTeam,
                                userName: userKey,
                                _migratedAt: Date.now(),
                                ...(isContaminated ? { _contaminatedSource: true } : {})  // 只在污染时添加标记
                            };
                            migratedRecords++;
                            userValidCount++;
                        });

                        // 🔴 记录污染情况
                        if (isContaminated && dryRun) {
                            preview.push({
                                type: 'contaminated_user',
                                team: displayTeam,
                                user: userKey,
                                nonDateKeys: nonDateKeys.slice(0, 5),  // 最多显示5个
                                onlyMigrateToday: true
                            });
                        }

                        // 记录用户统计
                        if (userValidCount > 0) {
                            teamDetails[displayTeam].users[userKey] = userValidCount;
                            teamDetails[displayTeam].totalRecords += userValidCount;
                        }
                    });
                });
            }

            // 2. 迁移 checkinSettings
            const settingsSnap = await get(ref(this.db, DB_PATHS_V1.CHECKIN_SETTINGS));
            if (settingsSnap.exists()) {
                const v1Settings = settingsSnap.val();

                Object.entries(v1Settings || {}).forEach(([userKey, settings]) => {
                    if (typeof settings !== 'object' || !settings) return;

                    // 验证 profile.teamName 是有效的团队名
                    const teamName = settings?.profile?.teamName;
                    if (teamName && (validTeamNames.has(teamName) || validTeamNames.has(teamName.replace(/_/g, '/')))) {
                        const settingsPath = `${targetPaths.CHECKIN_SETTINGS}/${userKey}`;
                        updates[settingsPath] = {
                            ...settings,
                            _migratedAt: Date.now()
                        };
                        migratedSettings++;
                    }
                });
            }

            // 3. 迁移 reportRecords（报数记录全部迁移）
            // 🔴 重要：将老团队名通过 normalizeTeamName 映射到新名称，再通过 sanitizeForPath 转为路径安全格式
            let migratedReports = 0;
            const reportSnap = await get(ref(this.db, DB_PATHS_V1.REPORT_RECORDS));
            if (reportSnap.exists()) {
                const v1Reports = reportSnap.val();
                Object.entries(v1Reports || {}).forEach(([teamKey, teamData]) => {
                    if (typeof teamData !== 'object' || !teamData) return;
                    // 将老团队名映射到新团队名，再转为路径安全格式
                    const normalizedTeam = this.normalizeTeamName(teamKey);
                    const safeTeamKey = this.sanitizeForPath(normalizedTeam);
                    Object.entries(teamData).forEach(([dateKey, dateData]) => {
                        if (typeof dateData !== 'object' || !dateData) return;
                        Object.entries(dateData).forEach(([recordId, record]) => {
                            if (typeof record !== 'object' || !record) return;
                            // 使用路径安全的团队名
                            const reportPath = `${targetPaths.REPORT_RECORDS}/${safeTeamKey}/${dateKey}/${recordId}`;
                            updates[reportPath] = {
                                ...record,
                                teamName: normalizedTeam,  // 保存显示用的团队名
                                _migratedAt: Date.now()
                            };
                            migratedReports++;
                        });
                    });
                });
            }

            // 4. 迁移 remindMessages（催报消息全部迁移）
            let migratedReminders = 0;
            const remindSnap = await get(ref(this.db, DB_PATHS_V1.REMIND_MESSAGES));
            if (remindSnap.exists()) {
                const v1Reminders = remindSnap.val();
                Object.entries(v1Reminders || {}).forEach(([key, value]) => {
                    if (value !== null && value !== undefined) {
                        updates[`${targetPaths.REMIND_MESSAGES}/${key}`] = value;
                        migratedReminders++;
                    }
                });
            }

            const summary = {
                migratedRecords,
                migratedSettings,
                migratedReports,
                migratedReminders,
                skippedInvalid,
                totalUpdates: Object.keys(updates).length,
                teamDetails  // 添加详细的团队/用户统计
            };

            // 如果是预览模式，只返回预览信息
            if (dryRun) {
                console.log(`[FirebaseService] 预览完成:`, summary);
                return {
                    success: true,
                    dryRun: true,
                    message: `可迁移 ${migratedRecords} 条记录，${migratedSettings} 个用户设置（跳过 ${skippedInvalid} 条无效数据）`,
                    ...summary,
                    preview
                };
            }

            if (Object.keys(updates).length === 0) {
                return { success: true, message: '没有可迁移的数据', ...summary };
            }

            // 执行迁移
            await update(ref(this.db), updates);

            console.log(`[FirebaseService] 迁移完成:`, summary);

            return {
                success: true,
                message: `已迁移 ${migratedRecords} 条记录，${migratedSettings} 个用户设置`,
                ...summary
            };
        } catch (error) {
            console.error('[FirebaseService] 迁移失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 🔴 重命名组别（迁移数据）
     * @param {string} oldTeamName - 旧组别名称
     * @param {string} newTeamName - 新组别名称
     */
    async renameTeam(oldTeamName, newTeamName) {
        if (!this.db) {
            return { success: false, message: 'Firebase 未初始化' };
        }

        if (!oldTeamName || !newTeamName) {
            return { success: false, message: '组别名称不能为空' };
        }

        try {
            console.log(`[FirebaseService] 正在重命名组别: ${oldTeamName} -> ${newTeamName}`);

            const normalizedOldTeam = this.normalizeTeamName(oldTeamName);
            const normalizedNewTeam = this.normalizeTeamName(newTeamName);
            const cleanOldTeam = this.sanitizeForPath(normalizedOldTeam);
            const cleanNewTeam = this.sanitizeForPath(normalizedNewTeam);
            const updates = {};
            let count = 0;
            let skipped = 0;

            // 1. 迁移 checkinRecords
            const oldRecordsRef = ref(this.db, `${DB_PATHS.CHECKIN_RECORDS}/${cleanOldTeam}`);
            const oldRecordsSnap = await get(oldRecordsRef);
            const newRecordsRef = ref(this.db, `${DB_PATHS.CHECKIN_RECORDS}/${cleanNewTeam}`);
            const newRecordsSnap = await get(newRecordsRef);
            const newRecordsData = newRecordsSnap.exists() ? newRecordsSnap.val() : {};
            if (oldRecordsSnap.exists()) {
                const oldData = oldRecordsSnap.val();
                // 复制到新路径
                for (const [userName, userRecords] of Object.entries(oldData)) {
                    for (const [date, record] of Object.entries(userRecords || {})) {
                        const alreadyExists = Boolean(newRecordsData?.[userName]?.[date]);
                        if (alreadyExists) {
                            skipped++;
                            continue;
                        }
                        updates[`${DB_PATHS.CHECKIN_RECORDS}/${cleanNewTeam}/${userName}/${date}`] = {
                            ...record,
                            teamName: newTeamName
                        };
                        count++;
                    }
                }
                // 删除旧路径
                updates[`${DB_PATHS.CHECKIN_RECORDS}/${cleanOldTeam}`] = null;
            }

            // 2. 更新 checkinSettings 中的 teamName
            const settingsRef = ref(this.db, DB_PATHS.CHECKIN_SETTINGS);
            const settingsSnap = await get(settingsRef);
            if (settingsSnap.exists()) {
                const allSettings = settingsSnap.val();
                for (const [userName, userSettings] of Object.entries(allSettings || {})) {
                    if (userSettings?.profile?.teamName === oldTeamName) {
                        updates[`${DB_PATHS.CHECKIN_SETTINGS}/${userName}/profile/teamName`] = newTeamName;
                    }
                }
            }

            // 3. 迁移 reportRecords
            const oldReportRef = ref(this.db, `${DB_PATHS.REPORT_RECORDS}/${oldTeamName}`);
            const oldReportSnap = await get(oldReportRef);
            const newReportRef = ref(this.db, `${DB_PATHS.REPORT_RECORDS}/${newTeamName}`);
            const newReportSnap = await get(newReportRef);
            const newReportData = newReportSnap.exists() ? newReportSnap.val() : {};
            if (oldReportSnap.exists()) {
                const oldReportData = oldReportSnap.val();
                for (const [date, dateRecords] of Object.entries(oldReportData || {})) {
                    for (const [recordId, record] of Object.entries(dateRecords || {})) {
                        const alreadyExists = Boolean(newReportData?.[date]?.[recordId]);
                        if (alreadyExists) {
                            skipped++;
                            continue;
                        }
                        updates[`${DB_PATHS.REPORT_RECORDS}/${newTeamName}/${date}/${recordId}`] = {
                            ...record,
                            teamName: newTeamName
                        };
                    }
                }
                updates[`${DB_PATHS.REPORT_RECORDS}/${oldTeamName}`] = null;
            }

            await update(ref(this.db), updates);
            console.log(`[FirebaseService] 已迁移 ${count} 条记录，跳过 ${skipped} 条冲突记录，组别 ${oldTeamName} -> ${newTeamName}`);
            return {
                success: true,
                message: `已将 "${oldTeamName}" 迁移到 "${newTeamName}"，迁移 ${count} 条，跳过 ${skipped} 条冲突记录`
            };
        } catch (error) {
            console.error('[FirebaseService] 重命名组别失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 迁移 default 组中指定用户的数据到目标组（不覆盖已有记录）
     * @param {string} userName - 用户名
     * @param {string} newTeamName - 目标组别名称
     */
    async migrateDefaultRecordsForUser(userName, newTeamName) {
        if (!this.db) {
            return { success: false, message: 'Firebase 未初始化' };
        }
        if (!userName || !newTeamName) {
            return { success: false, message: '参数不完整' };
        }

        const normalizedTeam = this.normalizeTeamName(newTeamName);
        const cleanUserName = this.sanitizeForPath(userName);
        const cleanNewTeam = this.sanitizeForPath(normalizedTeam);

        try {
            const updates = {};
            let migrated = 0;
            let skipped = 0;
            let removed = 0;
            let checkinMigrated = 0;
            let checkinSkipped = 0;
            let checkinRemoved = 0;
            let reportMigrated = 0;
            let reportSkipped = 0;
            let reportRemoved = 0;
            const activePaths = this.getActiveDBPaths();

            // 1. 迁移 checkinRecords/default/{userName}
            const oldUserPath = this.getCheckinRecordsPath(userName, null, 'default');
            const newUserPath = this.getCheckinRecordsPath(userName, null, normalizedTeam);
            const oldSnap = await get(ref(this.db, oldUserPath));
            const newSnap = await get(ref(this.db, newUserPath));
            const newData = newSnap.exists() ? newSnap.val() : {};

            if (oldSnap.exists()) {
                const oldData = oldSnap.val();
                for (const [dateKey, record] of Object.entries(oldData || {})) {
                    const hasTarget = Boolean(newData?.[dateKey]);
                    if (!hasTarget) {
                        const targetPath = this.getCheckinRecordsPath(userName, dateKey, normalizedTeam);
                        updates[targetPath] = {
                            ...record,
                            userName,
                            teamName: normalizedTeam
                        };
                        migrated += 1;
                        checkinMigrated += 1;
                    } else {
                        skipped += 1;
                        checkinSkipped += 1;
                    }
                    const sourcePath = this.getCheckinRecordsPath(userName, dateKey, 'default');
                    updates[sourcePath] = null;
                    removed += 1;
                    checkinRemoved += 1;
                }
            }

            // 2. 更新该用户的 settings 组别
            updates[`${DB_PATHS.CHECKIN_SETTINGS}/${cleanUserName}/profile/teamName`] = normalizedTeam;

            // 3. 迁移 reportRecords/default 中该用户记录
            // 🔴 固定从 V1 迁移报数记录
            const oldReportRef = ref(this.db, `${DB_PATHS_V1.REPORT_RECORDS}/default`);
            const oldReportSnap = await get(oldReportRef);
            const newReportRef = ref(this.db, `${activePaths.REPORT_RECORDS}/${cleanNewTeam}`);
            const newReportSnap = await get(newReportRef);
            const newReportData = newReportSnap.exists() ? newReportSnap.val() : {};

            if (oldReportSnap.exists()) {
                const oldReportData = oldReportSnap.val();
                for (const [dateKey, dateRecords] of Object.entries(oldReportData || {})) {
                    for (const [recordId, record] of Object.entries(dateRecords || {})) {
                        if ((record?.userName || '').trim() !== userName) continue;
                        const hasTarget = Boolean(newReportData?.[dateKey]?.[recordId]);
                        if (!hasTarget) {
                            updates[`${activePaths.REPORT_RECORDS}/${cleanNewTeam}/${dateKey}/${recordId}`] = {
                                ...record,
                                teamName: normalizedTeam
                            };
                            migrated += 1;
                            reportMigrated += 1;
                        } else {
                            skipped += 1;
                            reportSkipped += 1;
                        }
                        updates[`${DB_PATHS_V1.REPORT_RECORDS}/default/${dateKey}/${recordId}`] = null;
                        removed += 1;
                        reportRemoved += 1;
                    }
                }
            }

            if (!Object.keys(updates).length) {
                return { success: true, message: '没有可迁移的数据', migrated, skipped, removed };
            }

            await update(ref(this.db), updates);
            return {
                success: true,
                message: `已迁移 ${migrated} 条，跳过 ${skipped} 条冲突记录`,
                migrated,
                skipped,
                removed,
                checkinMigrated,
                checkinSkipped,
                checkinRemoved,
                reportMigrated,
                reportSkipped,
                reportRemoved
            };
        } catch (error) {
            console.error('[FirebaseService] 迁移默认组用户记录失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 合并指定用户在所有组的记录到目标组（保留目标组，清理其他组）
     * @param {string} userName - 用户名
     * @param {string} targetTeamName - 目标组别名称
     */
    async migrateUserRecordsToTeam(userName, targetTeamName) {
        if (!this.db) {
            return { success: false, message: 'Firebase 未初始化' };
        }
        if (!userName || !targetTeamName) {
            return { success: false, message: '参数不完整' };
        }

        const normalizedTeam = this.normalizeTeamName(targetTeamName);
        const cleanUserName = this.sanitizeForPath(userName);
        const cleanTargetTeam = this.sanitizeForPath(normalizedTeam);

        try {
            const updates = {};
            let migrated = 0;
            let skipped = 0;
            let removed = 0;
            let checkinMigrated = 0;
            let checkinSkipped = 0;
            let checkinRemoved = 0;
            let reportMigrated = 0;
            let reportSkipped = 0;
            let reportRemoved = 0;
            const activePaths = this.getActiveDBPaths();

            // 1. 迁移 checkinRecords：合并到目标组
            const allRecordsSnap = await get(ref(this.db, DB_PATHS.CHECKIN_RECORDS));
            const allRecords = allRecordsSnap.exists() ? allRecordsSnap.val() : {};
            const targetUserPath = `${DB_PATHS.CHECKIN_RECORDS}/${cleanTargetTeam}/${cleanUserName}`;
            const targetUserData = allRecords?.[cleanTargetTeam]?.[cleanUserName] || {};

            Object.entries(allRecords || {}).forEach(([teamKey, teamUsers]) => {
                if (!teamUsers || typeof teamUsers !== 'object') return;
                if (!teamUsers[cleanUserName]) return;
                if (teamKey === cleanTargetTeam) return;

                const userRecords = teamUsers[cleanUserName] || {};
                Object.entries(userRecords).forEach(([dateKey, record]) => {
                    const hasTarget = Boolean(targetUserData?.[dateKey]);
                    if (!hasTarget) {
                        updates[`${DB_PATHS.CHECKIN_RECORDS}/${cleanTargetTeam}/${cleanUserName}/${dateKey}`] = {
                            ...record,
                            userName,
                            teamName: normalizedTeam
                        };
                        migrated += 1;
                        checkinMigrated += 1;
                    } else {
                        skipped += 1;
                        checkinSkipped += 1;
                    }
                });
                updates[`${DB_PATHS.CHECKIN_RECORDS}/${teamKey}/${cleanUserName}`] = null;
                removed += Object.keys(userRecords || {}).length;
                checkinRemoved += Object.keys(userRecords || {}).length;
            });

            // 2. 更新 checkinSettings 中的 teamName
            updates[`${DB_PATHS.CHECKIN_SETTINGS}/${cleanUserName}/profile/teamName`] = normalizedTeam;

            // 3. 迁移 reportRecords：固定从 V1 合并到目标组
            const reportSnap = await get(ref(this.db, DB_PATHS_V1.REPORT_RECORDS));
            const reportData = reportSnap.exists() ? reportSnap.val() : {};
            const targetReportSnap = await get(ref(this.db, `${activePaths.REPORT_RECORDS}/${cleanTargetTeam}`));
            const targetReportData = targetReportSnap.exists() ? targetReportSnap.val() : {};

            Object.entries(reportData || {}).forEach(([teamKey, teamDates]) => {
                if (!teamDates || typeof teamDates !== 'object') return;
                Object.entries(teamDates).forEach(([dateKey, dateRecords]) => {
                    if (!dateRecords || typeof dateRecords !== 'object') return;
                    Object.entries(dateRecords).forEach(([recordId, record]) => {
                        if ((record?.userName || '').trim() !== userName) return;
                        const hasTarget = Boolean(targetReportData?.[dateKey]?.[recordId]);
                        if (!hasTarget) {
                            // 🔴 写入目标组（路径安全名）
                            updates[`${activePaths.REPORT_RECORDS}/${cleanTargetTeam}/${dateKey}/${recordId}`] = {
                                ...record,
                                teamName: normalizedTeam
                            };
                            migrated += 1;
                            reportMigrated += 1;
                        } else {
                            skipped += 1;
                            reportSkipped += 1;
                        }
                        // 🔴 删除 V1 位置的数据
                        updates[`${DB_PATHS_V1.REPORT_RECORDS}/${teamKey}/${dateKey}/${recordId}`] = null;
                        removed += 1;
                        reportRemoved += 1;
                    });
                });
            });

            if (!Object.keys(updates).length) {
                return { success: true, message: '没有可迁移的数据', migrated, skipped, removed };
            }

            await update(ref(this.db), updates);
            return {
                success: true,
                message: `已合并到 "${normalizedTeam}"，迁移 ${migrated} 条，跳过 ${skipped} 条冲突记录`,
                migrated,
                skipped,
                removed,
                checkinMigrated,
                checkinSkipped,
                checkinRemoved,
                reportMigrated,
                reportSkipped,
                reportRemoved
            };
        } catch (error) {
            console.error('[FirebaseService] 合并用户组别失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 🔴 获取所有组别列表
     */
    async getAllTeams() {
        if (!this.db) {
            return { success: false, teams: [] };
        }

        try {
            const teamsRef = ref(this.db, getActiveDBPaths().CHECKIN_RECORDS);
            const snapshot = await get(teamsRef);

            if (!snapshot.exists()) {
                return { success: true, teams: [] };
            }

            const data = snapshot.val();
            // 合并规范化后相同的组
            const teamMap = new Map();

            Object.keys(data).forEach(teamKey => {
                const users = data[teamKey] || {};
                const userNames = Object.keys(users);
                let recordCount = 0;
                Object.values(users).forEach(dates => {
                    recordCount += Object.keys(dates || {}).length;
                });

                // 使用原始 teamKey 作为显示名（Firebase 中的实际 key）
                if (teamMap.has(teamKey)) {
                    const existing = teamMap.get(teamKey);
                    // 合并用户（去重）
                    userNames.forEach(name => existing.userSet.add(name));
                    existing.recordCount += recordCount;
                } else {
                    teamMap.set(teamKey, {
                        teamName: teamKey,
                        userSet: new Set(userNames),
                        recordCount
                    });
                }
            });

            const teams = Array.from(teamMap.values()).map(t => ({
                teamName: t.teamName,
                userCount: t.userSet.size,
                recordCount: t.recordCount
            }));

            return {
                success: true,
                teams: teams.sort((a, b) => a.teamName.localeCompare(b.teamName, 'zh-CN'))
            };
        } catch (error) {
            console.error('[FirebaseService] 获取组别列表失败:', error);
            return { success: false, teams: [], error: error.message };
        }
    }

    /**
     * 🔴 获取所有用户（跨所有组）
     */
    async getAllUsers() {
        if (!this.db) {
            return { success: false, users: [] };
        }

        try {
            const teamsRef = ref(this.db, getActiveDBPaths().CHECKIN_RECORDS);
            const snapshot = await get(teamsRef);

            if (!snapshot.exists()) {
                return { success: true, users: [] };
            }

            const data = snapshot.val();
            // 🔴 使用 Map 来合并同一用户在不同别名组的数据
            const userMap = new Map();  // key: "userName::normalizedTeam"

            // 遍历所有组所有用户
            Object.entries(data).forEach(([teamKey, users]) => {
                // 🔴 对组名进行归一化（作图组 → 图片组）
                const normalizedTeam = this.normalizeTeamName(teamKey);

                Object.entries(users || {}).forEach(([userName, dates]) => {
                    const recordCount = Object.keys(dates || {}).length;
                    const key = `${userName}::${normalizedTeam}`;

                    if (userMap.has(key)) {
                        // 同一用户在同一归一化组下，累加记录数
                        userMap.get(key).recordCount += recordCount;
                    } else {
                        userMap.set(key, {
                            userName,
                            teamName: normalizedTeam,  // 🔴 使用归一化后的组名
                            recordCount
                        });
                    }
                });
            });

            const userList = Array.from(userMap.values());

            // 按用户名排序
            userList.sort((a, b) => a.userName.localeCompare(b.userName, 'zh-CN'));

            return { success: true, users: userList };
        } catch (error) {
            console.error('[FirebaseService] 获取所有用户失败:', error);
            return { success: false, users: [], error: error.message };
        }
    }

    /**
     * 🔴 获取指定组的所有用户列表
     * @param {string} teamName - 组别名称
     */
    async getTeamUsers(teamName) {
        if (!this.db) {
            return { success: false, users: [] };
        }

        try {
            const normalizedTeam = this.normalizeTeamName(teamName);
            const cleanTeam = this.sanitizeForPath(normalizedTeam);
            const teamRef = ref(this.db, `${DB_PATHS.CHECKIN_RECORDS}/${cleanTeam}`);
            const snapshot = await get(teamRef);

            if (!snapshot.exists()) {
                return { success: true, users: [] };
            }

            const data = snapshot.val();
            const userMap = new Map();

            // 遍历所有用户
            Object.entries(data).forEach(([userName, dates]) => {
                const recordCount = Object.keys(dates || {}).length;
                userMap.set(userName, {
                    userName,
                    recordCount,
                    teamName: normalizedTeam
                });
            });

            return {
                success: true,
                users: Array.from(userMap.values()).sort((a, b) =>
                    a.userName.localeCompare(b.userName, 'zh-CN')
                )
            };
        } catch (error) {
            console.error('[FirebaseService] 获取用户列表失败:', error);
            return { success: false, users: [], error: error.message };
        }
    }

    /**
     * 🔴 重命名用户（在指定组内）
     * @param {string} oldUserName - 旧用户名
     * @param {string} newUserName - 新用户名
     * @param {string} teamName - 组别名称
     */
    async renameUserInTeam(oldUserName, newUserName, teamName) {
        if (!this.db) {
            return { success: false, message: 'Firebase 未初始化' };
        }

        if (!oldUserName || !newUserName || !teamName) {
            return { success: false, message: '参数不完整' };
        }

        try {
            const normalizedTeam = this.normalizeTeamName(teamName);
            const cleanTeam = this.sanitizeForPath(normalizedTeam);
            const cleanOldUser = this.sanitizeForPath(oldUserName);
            const cleanNewUser = this.sanitizeForPath(newUserName);

            console.log(`[FirebaseService] 重命名用户: ${oldUserName} -> ${newUserName} (组: ${normalizedTeam})`);

            const updates = {};
            let migrated = 0;
            let skipped = 0;

            // 1. 迁移 checkinRecords
            const oldUserRef = ref(this.db, `${DB_PATHS.CHECKIN_RECORDS}/${cleanTeam}/${cleanOldUser}`);
            const oldUserSnap = await get(oldUserRef);

            if (oldUserSnap.exists()) {
                const oldData = oldUserSnap.val();
                const newUserRef = ref(this.db, `${DB_PATHS.CHECKIN_RECORDS}/${cleanTeam}/${cleanNewUser}`);
                const newUserSnap = await get(newUserRef);
                const newUserData = newUserSnap.exists() ? newUserSnap.val() : {};

                Object.entries(oldData).forEach(([dateKey, record]) => {
                    if (!newUserData[dateKey]) {
                        // 新用户该日期无数据，直接复制
                        updates[`${DB_PATHS.CHECKIN_RECORDS}/${cleanTeam}/${cleanNewUser}/${dateKey}`] = {
                            ...record,
                            userName: newUserName,
                            updatedAt: Date.now()
                        };
                        migrated++;
                    } else {
                        // 有冲突，跳过
                        skipped++;
                    }
                    // 删除旧数据
                    updates[`${DB_PATHS.CHECKIN_RECORDS}/${cleanTeam}/${cleanOldUser}/${dateKey}`] = null;
                });
            }

            // 2. 迁移 reportRecords
            const reportRef = ref(this.db, `${DB_PATHS.REPORT_RECORDS}/${cleanTeam}`);
            const reportSnap = await get(reportRef);
            if (reportSnap.exists()) {
                Object.entries(reportSnap.val()).forEach(([dateKey, records]) => {
                    Object.entries(records || {}).forEach(([recordId, record]) => {
                        if (this.sanitizeForPath(record.userName || '') === cleanOldUser) {
                            updates[`${DB_PATHS.REPORT_RECORDS}/${cleanTeam}/${dateKey}/${recordId}`] = {
                                ...record,
                                userName: newUserName,
                                updatedAt: Date.now()
                            };
                            migrated++;
                        }
                    });
                });
            }

            if (!Object.keys(updates).length) {
                return { success: true, message: '没有可迁移的数据', migrated: 0, skipped: 0 };
            }

            await update(ref(this.db), updates);
            return {
                success: true,
                message: `用户重命名成功: ${oldUserName} → ${newUserName}，迁移 ${migrated} 条记录`,
                migrated,
                skipped
            };
        } catch (error) {
            console.error('[FirebaseService] 重命名用户失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 🔴 删除用户（在指定组内）
     * @param {string} userName - 用户名
     * @param {string} teamName - 组别名称
     */
    async deleteUserInTeam(userName, teamName) {
        if (!this.db) {
            return { success: false, message: 'Firebase 未初始化' };
        }

        if (!userName || !teamName) {
            return { success: false, message: '参数不完整' };
        }

        try {
            const normalizedTeam = this.normalizeTeamName(teamName);
            const cleanUser = this.sanitizeForPath(userName);

            console.log(`[FirebaseService] 删除用户: ${userName} (组: ${normalizedTeam})`);

            // 🔴 获取所有映射到同一归一化组名的别名
            const TEAM_ALIASES_REVERSE = {
                '图片组': ['图片组', '作图组'],
                '视频/生图组': ['视频/生图组', '视频组', '生图组', '视频_生图组']
            };
            const aliasTeams = TEAM_ALIASES_REVERSE[normalizedTeam] || [normalizedTeam];

            const updates = {};
            let deleted = 0;

            // 🔴 遍历所有别名组，删除该用户的数据
            for (const aliasTeam of aliasTeams) {
                const cleanTeam = this.sanitizeForPath(aliasTeam);

                // 1. 删除 checkinRecords
                const userRef = ref(this.db, `${getActiveDBPaths().CHECKIN_RECORDS}/${cleanTeam}/${cleanUser}`);
                const userSnap = await get(userRef);
                if (userSnap.exists()) {
                    deleted += Object.keys(userSnap.val()).length;
                    updates[`${getActiveDBPaths().CHECKIN_RECORDS}/${cleanTeam}/${cleanUser}`] = null;
                }

                // 2. 删除 reportRecords
                const reportRef = ref(this.db, `${getActiveDBPaths().REPORT_RECORDS}/${cleanTeam}`);
                const reportSnap = await get(reportRef);
                if (reportSnap.exists()) {
                    Object.entries(reportSnap.val()).forEach(([dateKey, records]) => {
                        Object.entries(records || {}).forEach(([recordId, record]) => {
                            if (this.sanitizeForPath(record.userName || '') === cleanUser) {
                                updates[`${getActiveDBPaths().REPORT_RECORDS}/${cleanTeam}/${dateKey}/${recordId}`] = null;
                                deleted++;
                            }
                        });
                    });
                }
            }

            if (!Object.keys(updates).length) {
                return { success: true, message: '没有可删除的数据', deleted: 0 };
            }

            await update(ref(this.db), updates);
            return {
                success: true,
                message: `已删除用户 "${userName}" 的 ${deleted} 条记录`,
                deleted
            };
        } catch (error) {
            console.error('[FirebaseService] 删除用户失败:', error);
            return { success: false, message: error.message };
        }
    }
}

// 导出单例
const firebaseService = new FirebaseService();
module.exports = firebaseService;
