/**
 * 每日打卡核心逻辑 - 状态管理和工具函数
 */
(function () {
    'use strict';

    // 常量
    const STORAGE_KEYS = {
        RECORDS: 'checkin_records',
        PROFILE: 'checkin_profile',
        STATUS_OPTIONS: 'checkin_status_options',
        THEME: 'checkin_theme',
        GOOGLE_CLIENT_ID: 'checkin_google_client_id',
        SHEETS_URL: 'checkin_sheets_url',
        SHEET_NAME: 'checkin_sheet_name'
    };

    const WorkMode = { FULL_TIME: 'full_time', WORKING: 'working', STUDENT: 'student', OTHER: 'other' };
    const AttendanceStatus = { NORMAL: 'normal', LATE: 'late', ABSENT: 'absent', SICK: 'sick', LEAVE: 'leave', CUSTOM: 'custom' };

    // 默认时段配置
    const SLOT_CONFIG = [
        { key: 'morning', label: '上午', icon: '🌅', deadline: '08:00', startTime: '04:00', color: 'amber' },
        { key: 'afternoon', label: '下午', icon: '☀️', deadline: '13:30', startTime: '12:00', color: 'yellow' },
        { key: 'evening', label: '晚上', icon: '🌆', deadline: '19:00', startTime: '18:00', color: 'indigo' }
    ];

    // 默认状态选项
    const DEFAULT_STATUS_OPTIONS = [
        { id: 'opt_normal', value: AttendanceStatus.NORMAL, label: '正常上线', color: 'emerald', isSystem: true },
        { id: 'opt_late', value: AttendanceStatus.LATE, label: '迟到', color: 'rose', isSystem: true },
        { id: 'opt_absent', value: AttendanceStatus.ABSENT, label: '缺勤', color: 'red', isSystem: true },
        { id: 'opt_sick', value: AttendanceStatus.SICK, label: '身体抱恙', color: 'rose', isSystem: true },
        { id: 'opt_leave', value: AttendanceStatus.LEAVE, label: '休假', color: 'purple', isSystem: true },
        // 🔴 新增状态预设
        { id: 'opt_temp_work', value: 'temp_work', label: '临时上班', color: 'blue', isSystem: false },
        { id: 'opt_school', value: 'school', label: '上学', color: 'cyan', isSystem: false },
        { id: 'opt_activity', value: 'activity', label: '参加活动', color: 'orange', isSystem: false },
        { id: 'opt_party', value: 'party', label: '聚会', color: 'pink', isSystem: false },
        { id: 'opt_sermon', value: 'sermon', label: '听讲道', color: 'indigo', isSystem: false },
        { id: 'opt_doctor', value: 'doctor', label: '看医生', color: 'rose', isSystem: false },
        { id: 'opt_shopping', value: 'shopping', label: '买菜', color: 'green', isSystem: false }
    ];

    // 默认配置
    const DEFAULT_PROFILE = {
        name: '',
        teamName: '',  // 团队名称，用于数据隔离
        // 报数通知接收范围: 'all' | 'myTeam' | 'custom'
        reportNotifyMode: 'all',
        // 自定义接收的团队列表（当 reportNotifyMode = 'custom' 时使用）
        reportNotifyTeams: [],
        // 团队总览是否跨团队读取
        overviewAllTeams: true,
        // 弹框通知设置
        notifyEnabled: true,           // 是否启用弹框通知
        notifyPosition: 'topRight',    // 通知位置: 'topRight' | 'bottomRight' | 'center'
        notificationScale: 60,         // 🔴 通知弹框缩放比例: 50-150，默认60%
        mode: WorkMode.FULL_TIME,
        customModeLabel: '',
        // 🔴 当前模式的时间段（与 mode 对应）
        targetPeriods: [
            { name: '上午', start: '08:00', end: '12:00' },
            { name: '下午', start: '13:30', end: '18:00' },
            { name: '晚上', start: '19:00', end: '23:30' }
        ],
        // 🔴 各模式独立的时间段配置
        modeTargetPeriods: {
            full_time: [
                { name: '上午', start: '08:00', end: '12:00' },
                { name: '下午', start: '13:30', end: '18:00' },
                { name: '晚上', start: '19:00', end: '23:30' }
            ],
            working: [
                { name: '上班', start: '09:00', end: '12:00' },
                { name: '午休', start: '13:30', end: '18:00' }
            ],
            student: [
                { name: '上学', start: '07:30', end: '12:00' },
                { name: '下午', start: '14:00', end: '17:00' }
            ],
            other: [
                { name: '时段1', start: '09:00', end: '12:00' },
                { name: '时段2', start: '14:00', end: '18:00' }
            ]
        },
        // 🔴 收藏的常用任务类型
        favoriteTaskTypes: []
    };

    const TEAM_ALIASES = {
        '视频组': '视频/生图组',
        '生图组': '视频/生图组',
        '视频_生图组': '视频/生图组',
        '作图组': '图片组'
    };

    function normalizeTeamName(teamName) {
        const value = (teamName || '').trim();
        if (!value) return 'default';
        return TEAM_ALIASES[value] || value;
    }

    // 全局状态
    const state = {
        records: [],
        teamRecords: [],
        profile: { ...DEFAULT_PROFILE },
        statusOptions: [...DEFAULT_STATUS_OPTIONS],
        viewDate: new Date(),
        activeTab: 'punch', // punch | history
        isDark: false,
        showSettings: false,
        editingSlot: null,
        manualTime: '',
        manualNote: '',
        newOptionLabel: '',
        newActivityTitle: '',
        newActivityDuration: '30',
        isCustomDuration: false,
        activityLeaveTime: '',
        activityReturnTime: '',
        earlySleepReason: '',
        teamDetailMember: null,
        teamDetailDate: null,
        historyDetailMember: null,
        historyDetailDate: null,
        googleClientId: '',
        sheetsUrl: '',
        sheetName: '每日打卡',
        toastMessage: null,
        toastTimeout: null,
        // 同步状态追踪
        hasPendingSync: false,           // 是否有待同步的数据
        pendingSyncRecordIds: new Set(), // 待同步的记录 ID 集合
        lastSyncTime: 0,                 // 上次同步时间戳
        autoSyncInterval: 5 * 60 * 1000, // 自动同步间隔（5分钟）
        reportSettingsCache: null,
        // 🔴 团队总览排序模式
        teamOverviewSortMode: 'time',    // time | status | report | name
        // 🔴 今日临时模式（与设置里的永久模式分离）
        todayMode: null,                 // 今日临时模式（null = 使用 profile.mode）
        todayModeDate: null,             // 今日模式生效日期（用于判断是否过期）
        // 🔴 测试模式：模拟时间（null 表示使用真实时间）
        debugTime: null,                 // 格式: 'HH:MM' 或 null
        // 🔴 自动备份
        lastBackupDate: null,            // 上次备份日期 YYYY-MM-DD
        backupTimerId: null,             // 备份定时器 ID
        // 🔴 任务统计
        statsDetailDate: null,           // 统计详情弹窗显示的日期
        // 🔴 报数任务类型（从 Google Sheets 读取，与上传模块共用）
        reportTaskTypes: []              // 动态任务类型列表
    };

    // 🔴 获取当前时间（支持模拟测试）
    function getCurrentTime() {
        if (state.debugTime) {
            const [h, m] = state.debugTime.split(':').map(Number);
            const simulated = new Date();
            simulated.setHours(h, m, 0, 0);
            return simulated;
        }
        return new Date();
    }

    // 🔴 设置模拟时间（用于测试）
    function setDebugTime(timeStr) {
        if (!timeStr) {
            state.debugTime = null;
            console.log('[Checkin] 🕐 已关闭时间模拟，使用真实时间');
        } else {
            state.debugTime = timeStr;
            console.log(`[Checkin] 🕐 已启用时间模拟: ${timeStr}`);
        }
        // 触发重新渲染
        if (window.render) window.render();
    }

    /**
     * 🔴 获取当前有效模式
     * - 如果今日临时模式有效（同一天），返回临时模式
     * - 否则返回设置里的永久模式
     */
    function getEffectiveMode() {
        const today = formatDate(new Date());
        // 检查今日临时模式是否有效（同一天）
        if (state.todayMode && state.todayModeDate === today) {
            return state.todayMode;
        }
        // 返回永久设置的模式
        return state.profile.mode || 'full_time';
    }

    /**
     * 🔴 设置今日临时模式（不影响永久设置）
     */
    function setTodayMode(mode) {
        const today = formatDate(new Date());
        state.todayMode = mode;
        state.todayModeDate = today;
        console.log(`[Checkin] 🔄 今日临时模式: ${mode}（永久模式: ${state.profile.mode}）`);
    }

    // 工具函数
    function formatDate(date) {
        return date.toLocaleDateString('sv-SE');
    }

    function formatTime(isoString) {
        if (!isoString) return '--:--';
        return new Date(isoString).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    function formatDateDisplay(date) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return {
            main: `${date.getMonth() + 1}月${date.getDate()}日`,
            sub: weekdays[date.getDay()]
        };
    }

    function isToday(date) { return formatDate(date) === formatDate(new Date()); }
    function isPastDate(date) { return formatDate(date) < formatDate(new Date()); }

    // 存储操作
    function loadFromStorage() {
        try {
            // 🔴 不再从本地加载打卡记录，统一从 Firebase 读取
            // const r = localStorage.getItem(STORAGE_KEYS.RECORDS);
            const t = localStorage.getItem(STORAGE_KEYS.THEME);
            const g = localStorage.getItem(STORAGE_KEYS.GOOGLE_CLIENT_ID);
            const pending = localStorage.getItem('ck-pending-sync');

            // 🔴 不再加载本地打卡记录
            // if (r) state.records = JSON.parse(r);
            // 🔴 只读取本地提交人姓名，其余设置以云端为准
            try {
                const p = localStorage.getItem(STORAGE_KEYS.PROFILE);
                if (p) {
                    const parsedProfile = JSON.parse(p);
                    if (parsedProfile?.name) {
                        state.profile.name = String(parsedProfile.name).trim();
                    }
                }
            } catch (e) {
                console.warn('[Checkin] 读取本地提交人失败:', e);
            }
            if (t) state.isDark = t === 'dark';
            if (g) state.googleClientId = g;

            // 恢复待同步状态
            if (pending) {
                const pendingData = JSON.parse(pending);
                const recordIds = Array.isArray(pendingData.recordIds) ? pendingData.recordIds : [];
                const normalizedIds = recordIds.map((id) => {
                    const parts = String(id).split('|');
                    if (parts.length === 2) {
                        return `${parts[0]}|${parts[1]}|default`;
                    }
                    return String(id);
                });
                state.pendingSyncRecordIds = new Set(normalizedIds);
                state.hasPendingSync = state.pendingSyncRecordIds.size > 0;
                if (state.hasPendingSync) {
                    console.log(`[Checkin] 恢复 ${state.pendingSyncRecordIds.size} 条待同步记录`);
                }
            } else {
                state.pendingSyncRecordIds = new Set();
            }

            // 🔴 修复：双向同步提交人姓名
            // 1. 如果 profile 中已经有名字，回填到输入框
            // 2. 如果输入框有值但 profile 没有，使用输入框的值
            const submitInput = document.getElementById('meta-submit');
            if (submitInput) {
                if (state.profile.name && !submitInput.value) {
                    // profile 有名字，输入框为空 -> 回填
                    submitInput.value = state.profile.name;
                } else if (submitInput.value && !state.profile.name) {
                    // 输入框有值，profile 为空 -> 使用输入框的值
                    state.profile.name = submitInput.value;
                } else if (submitInput.value) {
                    // 两者都有值，以输入框为准
                    state.profile.name = submitInput.value;
                }
            }
        } catch (e) { console.error('[Checkin] Load error:', e); }
    }

    // 用于防抖的计时器
    let settingsSyncTimer = null;
    let lastAutoSyncToastAt = 0;
    let lastTeamRequiredToastAt = 0;
    let autoSyncDebounceTimer = null;   // 防抖定时器（打卡后延迟同步）
    let autoSyncIntervalTimer = null;   // 轮询定时器（每分钟检查同步）
    let autoSyncInFlight = false;
    const AUTO_SYNC_TOAST_COOLDOWN = 60000;
    const TEAM_REQUIRED_TOAST_COOLDOWN = 5000;
    const AUTO_SYNC_DELAY = 300;

    function saveToStorage(options = {}) {
        try {
            const { syncCloud = true } = options;
            // 🔴 不再保存打卡记录到本地，统一使用 Firebase
            // localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(state.records));
            localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(state.profile));
            localStorage.setItem(STORAGE_KEYS.STATUS_OPTIONS, JSON.stringify(state.statusOptions));
            localStorage.setItem(STORAGE_KEYS.THEME, state.isDark ? 'dark' : 'light');
            localStorage.setItem(STORAGE_KEYS.GOOGLE_CLIENT_ID, state.googleClientId);
            localStorage.setItem(STORAGE_KEYS.SHEETS_URL, state.sheetsUrl);
            localStorage.setItem(STORAGE_KEYS.SHEET_NAME, state.sheetName);

            // 自动同步设置到云端（防抖：3秒内只同步一次）
            if (syncCloud && state.profile.name && window.bridge?.checkin?.saveSettings) {
                clearTimeout(settingsSyncTimer);
                settingsSyncTimer = setTimeout(() => {
                    const liveReportSettings = window.CheckinReport?.getSettingsSnapshot?.();
                    if (liveReportSettings) {
                        state.reportSettingsCache = liveReportSettings;
                    }
                    const reportSettings = liveReportSettings || state.reportSettingsCache;
                    const settings = {
                        profile: state.profile,
                        statusOptions: state.statusOptions,
                        sheetsUrl: state.sheetsUrl,
                        sheetName: state.sheetName,
                        reportSettings: reportSettings || null
                    };
                    window.bridge.checkin.saveSettings({
                        userName: state.profile.name,
                        settings
                    }).catch(e => console.warn('[Checkin] 设置自动同步失败:', e));
                }, 3000);
            }
        } catch (e) { console.error('[Checkin] Save error:', e); }
    }

    function resetProfileForUser(userName) {
        if (settingsSyncTimer) {
            clearTimeout(settingsSyncTimer);
            settingsSyncTimer = null;
        }
        state.profile = { ...DEFAULT_PROFILE, name: userName || '' };
        state.statusOptions = [...DEFAULT_STATUS_OPTIONS];
        state.sheetsUrl = '';
        state.sheetName = '每日打卡';
        state.reportSettingsCache = null;
        saveToStorage({ syncCloud: false });
    }

    // 获取当前记录（根据日期 + 提交人）
    // 🔴 统一使用 Firebase 数据 (teamRecords)，不使用本地缓存
    function getActiveRecord() {
        const dateStr = formatDate(state.viewDate);
        const userName = state.profile.name;
        const teamName = normalizeTeamName(state.profile.teamName || 'default');

        // 🔴 只从 teamRecords (Firebase实时数据) 中查找，确保跨设备同步
        let record = state.teamRecords.find(r =>
            r.date === dateStr && r.userName === userName && normalizeTeamName(r.teamName || 'default') === teamName
        );

        if (!record) {
            // 如果 Firebase 中没有找到，创建一个新记录
            record = {
                id: 'day-' + dateStr + '-' + userName,
                date: dateStr,
                userName: userName,
                teamName: teamName,
                mode: state.profile.mode,
                targetPeriods: [...state.profile.targetPeriods],
                slots: {
                    morning: { status: AttendanceStatus.NORMAL },
                    afternoon: { status: AttendanceStatus.NORMAL },
                    evening: { status: AttendanceStatus.NORMAL },
                    sleep: null,
                    customActivities: []
                }
            };
        } else {
            // 更新已有记录的团队名称（如果用户更改了团队）
            if (record.teamName !== teamName) {
                record.teamName = teamName;
            }
        }
        return record;
    }

    // 🔴 记录锁定机制：刚打卡的记录30秒内不被远程覆盖
    const lockedRecords = new Map(); // key -> lockExpireTime

    function updateRecord(record) {
        const teamName = normalizeTeamName(record.teamName || state.profile.teamName);
        if (!teamName || teamName === 'default') {
            const now = Date.now();
            if (now - lastTeamRequiredToastAt > TEAM_REQUIRED_TOAST_COOLDOWN) {
                showToast('请先在设置中填写组别！');
                lastTeamRequiredToastAt = now;
            }
            return false;
        }

        // 添加更新时间戳
        record.updatedAt = Date.now();

        // 🔴 统一使用 teamRecords 作为主数据源
        record.teamName = teamName;  // 确保记录有团队名称

        // 🔴 锁定该记录30秒
        const recordKey = `${record.date}|${record.userName}|${teamName}`;
        lockedRecords.set(recordKey, Date.now() + 30000);

        const teamKey = `${record.date}|${record.userName}|${teamName}`;
        const teamIdx = state.teamRecords.findIndex(r =>
            `${r.date}|${r.userName}|${normalizeTeamName(r.teamName || 'default')}` === teamKey
        );
        if (teamIdx >= 0) {
            state.teamRecords[teamIdx] = { ...state.teamRecords[teamIdx], ...record };
        } else {
            state.teamRecords.push({ ...record });
        }

        // 标记该记录需要同步到 Sheets
        state.pendingSyncRecordIds.add(recordKey);
        state.hasPendingSync = true;

        // 🔴 不再保存打卡记录到 localStorage，只保存设置和待同步状态
        savePendingSyncState();

        // 自动同步到 Firebase（异步，不阻塞）
        if (state.profile.name && window.bridge?.checkin?.saveRecordFirebase) {
            window.bridge.checkin.saveRecordFirebase({
                userName: state.profile.name,
                record,
                teamName: teamName
            }).then(result => {
                if (result?.success) {
                    console.log('[Checkin] Firebase 同步成功');
                } else {
                    showToast('⚠️ 云端同步失败', 4000);
                    console.warn('[Checkin] Firebase 同步返回失败:', result?.error);
                }
            }).catch(e => {
                showToast('⚠️ 云端同步出错', 4000);
                console.warn('[Checkin] Firebase 自动同步失败:', e);
            });
        }
        return true;
    }

    // 保存待同步状态到 localStorage
    function savePendingSyncState() {
        try {
            const pendingData = {
                recordIds: Array.from(state.pendingSyncRecordIds),
                timestamp: Date.now()
            };
            localStorage.setItem('ck-pending-sync', JSON.stringify(pendingData));
        } catch (e) {
            console.warn('[Checkin] 保存待同步状态失败:', e);
        }
    }

    // 清除已同步的记录
    function clearPendingSyncRecords(syncedKeys) {
        syncedKeys.forEach(key => state.pendingSyncRecordIds.delete(key));
        state.hasPendingSync = state.pendingSyncRecordIds.size > 0;
        savePendingSyncState();
    }

    // 计算时长
    function calculateDuration(record) {
        const m = record.slots.morning, e = record.slots.evening;
        if (!m?.time || !e?.time) return 0;
        let hours = (new Date(e.time) - new Date(m.time)) / 3600000;
        const breaks = (record.slots.customActivities || []).reduce((a, b) => a + (b.durationMinutes || 0), 0);
        return Math.max(0, hours - breaks / 60);
    }

    function calculateTargetHours(periods) {
        return (periods || []).reduce((acc, p) => {
            const [sh, sm] = p.start.split(':').map(Number);
            const [eh, em] = p.end.split(':').map(Number);
            return acc + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
        }, 0);
    }

    function getStats() {
        // 🔴 仅使用 Firebase（teamRecords）+ 当前组的数据
        const myName = state.profile.name;
        const teamName = normalizeTeamName(state.profile.teamName || 'default');
        const allRecords = (state.teamRecords || []).filter(r =>
            r.userName === myName && normalizeTeamName(r.teamName || 'default') === teamName
        );

        let totalHours = 0, goalReached = 0;
        allRecords.forEach(r => {
            const dur = calculateDuration(r);
            const target = calculateTargetHours(r.targetPeriods || state.profile.targetPeriods);
            totalHours += dur;
            if (dur >= target && dur > 0) goalReached++;
        });
        return {
            totalHours,
            goalReached,
            avgHours: allRecords.length ? totalHours / allRecords.length : 0,
            totalDays: allRecords.length
        };
    }

    // 动态时段配置
    // 🔴 修复：始终使用标准键名（morning/afternoon/evening），确保所有模式的数据都能正确同步到团队总览
    function getDynamicSlotConfig() {
        // 标准键名映射
        const standardKeys = ['morning', 'afternoon', 'evening'];
        const periods = Array.isArray(state.profile.targetPeriods) && state.profile.targetPeriods.length
            ? state.profile.targetPeriods
            : DEFAULT_PROFILE.targetPeriods;

        return periods.slice(0, 3).map((p, i) => {
            const fallback = SLOT_CONFIG[i] || {};
            const startTime = p.start || fallback.startTime || fallback.deadline || '09:00';
            const endTime = p.end || fallback.endTime || startTime;
            return {
                key: standardKeys[i] || `period_${i}`,  // 使用标准键名
                label: p.name || fallback.label || `时段${i + 1}`,
                icon: ['🌅', '☀️', '🌆', '🌙'][i % 4],
                deadline: p.start || fallback.deadline || startTime,
                startTime,
                endTime,
                color: ['amber', 'yellow', 'indigo', 'purple'][i % 4]
            };
        });
    }

    // Toast - 优化版：只更新 toast 区域，不触发全页面渲染
    function showToast(msg, duration = 3000) {
        state.toastMessage = msg;
        if (state.toastTimeout) clearTimeout(state.toastTimeout);

        // 直接更新 toast 区域，不触发全页面render
        const toastEl = document.querySelector('.ck-toast');
        if (toastEl) {
            toastEl.textContent = msg;
            toastEl.classList.add('show');
        } else {
            // 如果 toast 元素不存在，创建一个
            const newToast = document.createElement('div');
            newToast.className = 'ck-toast show';
            newToast.textContent = msg;
            const app = document.querySelector('.ck-app');
            if (app) app.appendChild(newToast);
        }

        state.toastTimeout = setTimeout(() => {
            state.toastMessage = null;
            const toastEl = document.querySelector('.ck-toast');
            if (toastEl) toastEl.classList.remove('show');
        }, duration);
    }

    // 生成模拟团队数据（用于测试）
    function generateMockTeamData() {
        const names = ['张三', '李四', '王五', '赵六', '陈七', '刘八'];
        const year = state.viewDate.getFullYear();
        const month = state.viewDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        names.forEach(name => {
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const recordDate = new Date(dateStr);

                // 跳过未来日期
                if (recordDate > today) continue;

                // 随机决定是否有记录 (85%概率)
                if (Math.random() > 0.85) continue;

                // 随机生成打卡数据
                const hasLate = Math.random() < 0.15; // 15%迟到
                const hasFullDay = Math.random() < 0.7; // 70%全勤

                const morningTime = new Date(recordDate);
                morningTime.setHours(8 + (hasLate ? 1 : 0), Math.floor(Math.random() * 30), 0);

                const afternoonTime = new Date(recordDate);
                afternoonTime.setHours(13 + (hasLate && Math.random() < 0.5 ? 1 : 0), 30 + Math.floor(Math.random() * 30), 0);

                const eveningTime = hasFullDay ? new Date(recordDate) : null;
                if (eveningTime) {
                    eveningTime.setHours(19, Math.floor(Math.random() * 60), 0);
                }

                const sleepTime = hasFullDay && Math.random() < 0.8 ? new Date(recordDate) : null;
                if (sleepTime) {
                    sleepTime.setHours(23, Math.floor(Math.random() * 59), 0);
                }

                const record = {
                    id: `day-${dateStr}-${name}`,
                    date: dateStr,
                    userName: name,
                    mode: 'full_time',
                    targetPeriods: [
                        { name: '上午', start: '08:00', end: '12:00' },
                        { name: '下午', start: '13:30', end: '18:00' },
                        { name: '晚上', start: '19:00', end: '23:30' }
                    ],
                    slots: {
                        morning: { time: morningTime.toISOString(), status: hasLate ? AttendanceStatus.LATE : AttendanceStatus.NORMAL },
                        afternoon: { time: afternoonTime.toISOString(), status: AttendanceStatus.NORMAL },
                        evening: eveningTime ? { time: eveningTime.toISOString(), status: AttendanceStatus.NORMAL } : { status: AttendanceStatus.NORMAL },
                        sleep: sleepTime ? { time: sleepTime.toISOString(), status: AttendanceStatus.NORMAL } : null,
                        customActivities: Math.random() < 0.3 ? [{ id: Date.now().toString(), title: '午休', leaveTime: '12:00', returnTime: '13:00', durationMinutes: 60 }] : []
                    }
                };

                state.records.push(record);
            }
        });

        saveToStorage();
        showToast(`已生成 ${names.length} 人的模拟数据！`);
    }

    // 清除模拟数据
    function clearMockData() {
        const myName = state.profile.name;
        state.records = state.records.filter(r => r.userName === myName);
        saveToStorage();
        showToast('模拟数据已清除！');
    }

    // ========== Google Sheets 同步 ==========

    /**
     * 同步当前记录到 Google Sheets
     */
    async function syncCurrentRecord() {
        return syncAllRecords();
    }

    /**
     * 批量同步所有本地记录到 Sheets
     * 🔴 修复：同步所有团队数据，而不只是当前用户
     */
    function buildOverviewSyncPayload() {
        const myName = state.profile.name;
        if (!myName) {
            return null;
        }

        // 获取所有团队记录（仅使用 Firebase teamRecords）
        const allRecords = (state.teamRecords && state.teamRecords.length > 0)
            ? [...state.teamRecords]
            : [];

        if (!allRecords.length) return null;

        const now = new Date();
        const overviewSheetName = state.sheetName || '每日打卡';

        return {
            recordsToSync: allRecords,  // 同步所有团队数据
            overviewSheetName,
            year: now.getFullYear(),
            month: now.getMonth()
        };
    }

    async function syncAllRecords() {
        if (!state.sheetsUrl || !window.bridge?.checkin?.syncHorizontal) {
            showToast('请先配置表格链接');
            return { success: false };
        }

        try {
            if (!window.bridge?.checkin?.getAllRecordsFirebase) {
                showToast('未启用 Firebase，同步失败');
                return { success: false };
            }

            showToast('正在从 Firebase 获取数据...');
            const firebaseResult = await window.bridge.checkin.getAllRecordsFirebase({ allTeams: true });
            if (!firebaseResult.success) {
                showToast(`同步失败: ${firebaseResult.error || 'Firebase 获取失败'}`);
                return { success: false };
            }

            const allRecords = (firebaseResult.records || []).map(r => ({
                ...r,
                teamName: normalizeTeamName(r.teamName || 'default')
            }));

            if (!allRecords.length) {
                showToast('Firebase 没有可同步的记录');
                return { success: false };
            }

            const getRecordKey = (r) => `${r.date}|${r.userName}|${normalizeTeamName(r.teamName || 'default')}`;
            const userNames = new Set(allRecords.map(r => r.userName).filter(Boolean));
            console.log(`[Checkin] 准备同步: ${allRecords.length} 条记录, ${userNames.size} 个用户`);
            console.log(`[Checkin] 用户列表:`, Array.from(userNames).join(', '));

            const year = state.viewDate.getFullYear();
            const month = state.viewDate.getMonth();
            const overviewSheetName = state.sheetName || '每日打卡';

            showToast(`正在同步 ${allRecords.length} 条记录 (${userNames.size} 人) 到表格...`);

            const result = await window.bridge.checkin.syncHorizontal({
                sheetsUrl: state.sheetsUrl,
                sheetName: overviewSheetName,
                records: allRecords,  // 同步所有数据
                year,
                month
            });

            if (result.success) {
                // 更新同步状态
                const syncedKeys = allRecords.map(r => getRecordKey(r));
                clearPendingSyncRecords(syncedKeys);
                state.lastSyncTime = Date.now();
                showToast(`同步完成: ${overviewSheetName} (${result.rows} 行 × ${result.cols} 列)`);
            } else {
                showToast(`同步失败: ${result.error}`);
            }
            return result;
        } catch (error) {
            showToast(`同步错误: ${error.message}`);
            return { success: false };
        }
    }

    /**
     * 自动同步：每次从 Firebase 全量写入 Sheets（不使用本地数据）
     */
    async function syncPendingRecordsToSheets() {
        if (!state.sheetsUrl || !window.bridge?.checkin?.syncHorizontal) {
            return { success: false };
        }

        const pendingKeys = Array.from(state.pendingSyncRecordIds);
        if (!pendingKeys.length) {
            return { success: false };
        }

        if (!window.bridge?.checkin?.getAllRecordsFirebase) {
            console.warn('[Checkin] 未启用 Firebase，自动同步跳过');
            return { success: false };
        }

        const firebaseResult = await window.bridge.checkin.getAllRecordsFirebase({ allTeams: true });
        if (!firebaseResult.success) {
            console.warn('[Checkin] 自动同步 Firebase 获取失败:', firebaseResult.error);
            return { success: false };
        }

        const allRecords = (firebaseResult.records || []).map(r => ({
            ...r,
            teamName: normalizeTeamName(r.teamName || 'default')
        }));

        if (!allRecords.length) {
            return { success: false };
        }

        const getRecordKey = (r) => `${r.date}|${r.userName}|${normalizeTeamName(r.teamName || 'default')}`;
        const firebaseKeys = new Set(allRecords.map(getRecordKey));
        const syncedKeys = pendingKeys.filter(key => firebaseKeys.has(key));

        const year = state.viewDate.getFullYear();
        const month = state.viewDate.getMonth();
        const overviewSheetName = state.sheetName || '每日打卡';

        const result = await window.bridge.checkin.syncHorizontal({
            sheetsUrl: state.sheetsUrl,
            sheetName: overviewSheetName,
            records: allRecords,
            year,
            month
        });

        if (result.success && syncedKeys.length) {
            clearPendingSyncRecords(syncedKeys);
            state.lastSyncTime = Date.now();
        }

        return result;
    }

    /**
     * 拉取团队打卡数据
     * 🔴 优先从 Firebase 读取，实现实时更新
     * 如果 Firebase 没有数据则回退到 Google Sheets
     */
    async function fetchTeamRecords(options = {}) {
        const silent = Boolean(options.silent);
        const forceSheets = Boolean(options.forceSheets); // 强制从 Sheets 读取
        const overviewAllTeams = options.allTeams ?? state.profile.overviewAllTeams === true;

        try {
            let remoteRecords = [];
            let source = 'unknown';

            // 优先从 Firebase 读取（实时数据）
            // 🔴 修复：传递 teamName 实现团队数据隔离
            if (!forceSheets && window.bridge?.checkin?.getAllRecordsFirebase) {
                if (!silent) {
                    console.log('[Checkin] 从 Firebase 获取团队数据...');
                }
                const teamName = normalizeTeamName(state.profile.teamName || 'default');
                const firebaseParams = overviewAllTeams ? { allTeams: true } : { teamName };
                const firebaseResult = await window.bridge.checkin.getAllRecordsFirebase(firebaseParams);
                if (firebaseResult.success && firebaseResult.records?.length) {
                    remoteRecords = firebaseResult.records;
                    source = 'firebase';
                    if (!silent) {
                        const scopeLabel = overviewAllTeams ? '所有团队' : `团队: ${teamName}`;
                        console.log(`[Checkin] Firebase 返回 ${remoteRecords.length} 条记录 (${scopeLabel})`);
                    }
                }
            }

            if (!remoteRecords.length) {
                if (!silent) {
                    console.log('[Checkin] 没有获取到团队数据');
                }
                return { success: false };
            }

            if (overviewAllTeams) {
                remoteRecords = remoteRecords.map(record => ({
                    ...record,
                    teamName: normalizeTeamName(record.teamName || 'default')
                }));
            } else {
                const teamName = normalizeTeamName(state.profile.teamName || 'default');
                remoteRecords = remoteRecords.map(record => ({
                    ...record,
                    teamName: normalizeTeamName(record.teamName || teamName)
                }));
            }

            const hasAnyTime = (record) => {
                if (!record?.slots) return false;
                const keys = ['morning', 'afternoon', 'evening', 'sleep'];
                return keys.some(key => {
                    const slot = record.slots[key];
                    const timeValue = typeof slot === 'string' ? slot : slot?.time;
                    return Boolean(timeValue);
                });
            };

            const getTeamKey = (record) => {
                const teamName = normalizeTeamName(record.teamName || 'default');
                return `${record.date}-${record.userName || ''}-${teamName}`;
            };

            const previousMap = new Map((state.teamRecords || []).map(r => [getTeamKey(r), r]));
            const nextMap = new Map();
            let added = 0;
            let updated = 0;

            remoteRecords.forEach(remoteRecord => {
                const key = getTeamKey(remoteRecord);
                const prevRecord = previousMap.get(key);
                if (!prevRecord) {
                    added += 1;
                } else if ((remoteRecord.updatedAt || 0) > (prevRecord.updatedAt || 0)) {
                    updated += 1;
                }
                nextMap.set(key, remoteRecord);
            });

            state.teamRecords = Array.from(nextMap.values());

            if (!silent) {
                console.log(`[Checkin] 拉取完成(${source}): ${remoteRecords.length} 条, 新增 ${added} 条`);
            }
            return { success: true, total: remoteRecords.length, added, updated, source };
        } catch (error) {
            console.error('[Checkin] 拉取失败:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== Firebase 设置同步 ==========

    /**
     * 保存设置到 Firebase
     */
    async function saveSettingsToCloud() {
        const userName = state.profile.name;
        if (!userName || !window.bridge?.checkin?.saveSettings) {
            return { success: false };
        }

        try {
            const liveReportSettings = window.CheckinReport?.getSettingsSnapshot?.();
            if (liveReportSettings) {
                state.reportSettingsCache = liveReportSettings;
            }
            const reportSettings = liveReportSettings || state.reportSettingsCache;
            const settings = {
                profile: state.profile,
                statusOptions: state.statusOptions,
                sheetsUrl: state.sheetsUrl,
                sheetName: state.sheetName,
                reportSettings: reportSettings || null
            };

            const result = await window.bridge.checkin.saveSettings({ userName, settings });
            if (result.success) {
                console.log('[Checkin] 设置已同步到云端');
            }
            return result;
        } catch (error) {
            console.error('[Checkin] 保存设置失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 从 Firebase 加载设置
     */
    async function loadSettingsFromCloud(userName) {
        if (!userName || !window.bridge?.checkin?.loadSettings) {
            return { success: false };
        }

        try {
            const result = await window.bridge.checkin.loadSettings({ userName });
            if (result.success && result.settings) {
                // 🔴 修复：按提交人加载云端设置，避免沿用旧用户的本地设置
                const baseProfile = { ...DEFAULT_PROFILE, name: userName || '' };
                if (result.settings.profile) {
                    const cloudProfile = result.settings.profile;
                    state.profile = {
                        ...baseProfile,
                        ...cloudProfile,
                        name: cloudProfile.name || userName,
                        teamName: normalizeTeamName(cloudProfile.teamName || '')
                    };
                } else {
                    state.profile = baseProfile;
                }
                if (result.settings.statusOptions?.length) {
                    // 🔴 合并云端选项和默认选项，确保新增的预设不丢失
                    const cloudOptions = result.settings.statusOptions;
                    const defaultIds = DEFAULT_STATUS_OPTIONS.map(o => o.id);
                    // 保留用户自定义的选项（不在默认列表中的）
                    const userCustomOptions = cloudOptions.filter(o => !defaultIds.includes(o.id) && !o.isSystem);
                    // 合并：默认 + 用户自定义
                    state.statusOptions = [...DEFAULT_STATUS_OPTIONS, ...userCustomOptions];
                } else {
                    state.statusOptions = [...DEFAULT_STATUS_OPTIONS];
                }
                state.sheetsUrl = result.settings.sheetsUrl || '';
                state.sheetName = result.settings.sheetName || '每日打卡';
                if (result.settings.reportSettings) {
                    state.reportSettingsCache = result.settings.reportSettings;
                }
                if (window.CheckinReport?.applySettings) {
                    window.CheckinReport.applySettings(result.settings.reportSettings || null);
                }
                saveToStorage();
                console.log('[Checkin] 已从云端加载设置:', state.profile.name, '组别:', state.profile.teamName);
            }
            return result;
        } catch (error) {
            console.error('[Checkin] 加载设置失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 从 Firebase 加载打卡记录
     */
    async function loadRecordsFromCloud(userName) {
        if (!userName || !window.bridge?.checkin?.loadRecordsFirebase) {
            return { success: false };
        }

        try {
            const teamName = normalizeTeamName(state.profile.teamName || 'default');
            const result = await window.bridge.checkin.loadRecordsFirebase({ userName, teamName });
            if (result.success && result.records?.length) {
                const normalizeTeam = (value) => normalizeTeamName(value || teamName || 'default');
                const getRecordKey = (r) => `${r.date}|${r.userName || ''}|${normalizeTeam(r.teamName)}`;
                const recordMap = new Map((state.teamRecords || []).map(r => [getRecordKey(r), r]));

                result.records.forEach(cloudRecord => {
                    const normalizedTeam = normalizeTeam(cloudRecord.teamName);
                    const normalizedUser = cloudRecord.userName || userName;
                    const key = `${cloudRecord.date}|${normalizedUser}|${normalizedTeam}`;
                    const existing = recordMap.get(key);
                    if (!existing || (cloudRecord.updatedAt || 0) >= (existing.updatedAt || 0)) {
                        recordMap.set(key, {
                            ...existing,
                            ...cloudRecord,
                            userName: normalizedUser,
                            teamName: normalizedTeam
                        });
                    }
                });

                state.teamRecords = Array.from(recordMap.values());
                console.log(`[Checkin] 从云端合并 ${result.records.length} 条记录`);
            }
            return result;
        } catch (error) {
            console.error('[Checkin] 加载记录失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 自动同步当前记录到 Sheets（打卡后调用）
     */
    function autoSyncToSheets() {
        if (!state.sheetsUrl || !window.bridge?.checkin?.syncHorizontal) {
            return;
        }

        const record = getActiveRecord();
        if (!record.userName) return;

        if (autoSyncDebounceTimer) {
            clearTimeout(autoSyncDebounceTimer);
        }

        autoSyncDebounceTimer = setTimeout(async () => {
            if (autoSyncInFlight) return;
            const payload = buildOverviewSyncPayload();
            if (!payload) return;

            autoSyncInFlight = true;
            try {
                await window.bridge.checkin.syncHorizontal({
                    sheetsUrl: state.sheetsUrl,
                    sheetName: payload.overviewSheetName,
                    records: payload.recordsToSync,
                    year: payload.year,
                    month: payload.month
                });
                console.log('[Checkin] 已自动同步到 Sheets');
            } catch (e) {
                console.warn('[Checkin] 自动同步 Sheets 失败:', e);
                const now = Date.now();
                if (now - lastAutoSyncToastAt > AUTO_SYNC_TOAST_COOLDOWN) {
                    showToast(`自动同步失败: ${e.message || '请检查表格权限'}`);
                    lastAutoSyncToastAt = now;
                }
            } finally {
                autoSyncInFlight = false;
            }
        }, AUTO_SYNC_DELAY);
    }

    /**
     * 智能定期同步（只在有待同步数据时触发）
     * 返回是否执行了同步
     */
    async function smartAutoSync() {
        // 检查是否有待同步数据
        if (!state.hasPendingSync) {
            console.log('[Checkin] 没有待同步数据，跳过');
            return false;
        }

        // 检查是否配置了表格链接
        if (!state.sheetsUrl) {
            console.log('[Checkin] 未配置表格链接，跳过同步');
            return false;
        }

        // 检查距离上次同步是否超过间隔
        const now = Date.now();
        if (now - state.lastSyncTime < state.autoSyncInterval) {
            console.log('[Checkin] 距离上次同步时间不足，跳过');
            return false;
        }

        console.log('[Checkin] 检测到待同步数据，执行自动同步...');
        const result = await syncPendingRecordsToSheets();
        return result.success;
    }

    /**
     * 启动自动同步定时器
     */
    function startAutoSyncTimer() {
        if (autoSyncIntervalTimer) {
            clearInterval(autoSyncIntervalTimer);
        }
        // 每分钟检查一次是否需要同步
        autoSyncIntervalTimer = setInterval(() => {
            smartAutoSync().catch(e => console.warn('[Checkin] 自动同步失败:', e));
        }, 60 * 1000);
        console.log('[Checkin] 自动同步定时器已启动（每分钟检查）');
    }

    /**
     * 停止自动同步定时器
     */
    function stopAutoSyncTimer() {
        if (autoSyncIntervalTimer) {
            clearInterval(autoSyncIntervalTimer);
            autoSyncIntervalTimer = null;
        }
    }

    /**
     * 🔴 执行数据备份
     */
    async function backupData() {
        if (!window.bridge?.checkin?.backupData) {
            console.warn('[Checkin] 备份功能不可用（非桌面版）');
            return { success: false };
        }

        try {
            const backupPayload = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                teamRecords: state.teamRecords || [],
                reportRecords: window.CheckinReport?.reportState?.records || [],
                profile: state.profile
            };

            const result = await window.bridge.checkin.backupData(backupPayload);
            if (result.success) {
                state.lastBackupDate = formatDate(new Date());
                showToast(`✅ 数据已备份: ${result.filename}`);
                console.log(`[Checkin] 备份成功: ${result.filepath}`);
            }
            return result;
        } catch (error) {
            console.error('[Checkin] 备份失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔴 检查是否需要自动备份（每天 02:00）
     */
    function checkAutoBackup() {
        const now = new Date();
        const hour = now.getHours();
        const today = formatDate(now);

        // 02:00-02:59 期间，且今天还没备份过
        if (hour === 2 && state.lastBackupDate !== today) {
            console.log('[Checkin] 触发每日自动备份...');
            backupData();
        }
    }

    /**
     * 🔴 启动自动备份检查（每分钟检查一次）
     */
    function startAutoBackupTimer() {
        if (state.backupTimerId) {
            clearInterval(state.backupTimerId);
        }
        // 每分钟检查一次是否到了备份时间
        state.backupTimerId = setInterval(checkAutoBackup, 60 * 1000);
        // 立即检查一次
        checkAutoBackup();
        console.log('[Checkin] 自动备份定时器已启动（每天 02:00）');
    }

    /**
     * 🔴 停止自动备份定时器
     */
    function stopAutoBackupTimer() {
        if (state.backupTimerId) {
            clearInterval(state.backupTimerId);
            state.backupTimerId = null;
        }
    }

    /**
     * 更新指定时段的任务完成量
     */
    async function updateTaskCount(slotKey, taskCount) {
        const record = getActiveRecord();
        if (!record.slots) record.slots = {};
        if (!record.slots[slotKey]) record.slots[slotKey] = {};

        record.slots[slotKey].taskCount = taskCount;
        record.slots[slotKey].taskCountTime = new Date().toISOString();

        const updated = updateRecord(record);
        if (!updated) return;
        saveToStorage();

        // 同步到 Firebase
        await syncCurrentRecord();

        console.log(`[Checkin] 更新 ${slotKey} 任务完成量: ${taskCount}`);
    }

    /**
     * 获取当前记录（供外部模块使用）
     */
    function getCurrentRecord() {
        return getActiveRecord();
    }

    /**
     * 🔴 获取报数任务类型列表
     * 优先使用从 Google Sheets 读取的列表，如果为空则使用默认值
     */
    const DEFAULT_REPORT_TASK_TYPES = ['生成图片', '制作图片', '制作风格图', '制作视频', '生成sora', '图片转视频', 'reels视频', '视频剪辑'];

    function getReportTaskTypes() {
        if (state.reportTaskTypes && state.reportTaskTypes.length > 0) {
            return state.reportTaskTypes;
        }
        return DEFAULT_REPORT_TASK_TYPES;
    }

    /**
     * 🔴 设置报数任务类型列表（从上传模块同步）
     */
    function setReportTaskTypes(types) {
        if (Array.isArray(types) && types.length > 0) {
            state.reportTaskTypes = types;
            console.log(`[Checkin] 更新报数任务类型: ${types.length} 个`);
        }
    }

    /**
     * 🔴 自动刷新任务类型（从 Google Sheets 获取）
     * 在初始化时调用，确保任务类型列表是最新的
     */
    async function autoRefreshTaskTypes() {
        try {
            // 等待一小段时间确保 bridge 已准备好
            await new Promise(resolve => setTimeout(resolve, 500));

            if (!window.bridge?.fetchCategories) {
                console.log('[Checkin] fetchCategories 不可用，跳过自动刷新');
                return;
            }

            const payload = await window.bridge.fetchCategories();
            const taskTypes = payload?.taskTypes || [];

            if (taskTypes.length > 0) {
                state.reportTaskTypes = taskTypes;
                console.log(`[Checkin] 自动刷新任务类型成功: ${taskTypes.length} 个`);
            }
        } catch (error) {
            console.warn('[Checkin] 自动刷新任务类型失败:', error.message);
        }
    }

    // 🔴 初始化时自动刷新任务类型
    setTimeout(() => {
        autoRefreshTaskTypes();
    }, 1000);

    /**
     * 🔴 获取收藏的常用任务类型
     */
    function getFavoriteTaskTypes() {
        return state.profile.favoriteTaskTypes || [];
    }

    /**
     * 🔴 切换任务收藏状态
     */
    function toggleFavoriteTask(taskName) {
        if (!state.profile.favoriteTaskTypes) {
            state.profile.favoriteTaskTypes = [];
        }
        const idx = state.profile.favoriteTaskTypes.indexOf(taskName);
        if (idx >= 0) {
            // 已收藏，取消
            state.profile.favoriteTaskTypes.splice(idx, 1);
            console.log(`[Checkin] 取消收藏任务: ${taskName}`);
        } else {
            // 未收藏，添加
            state.profile.favoriteTaskTypes.push(taskName);
            console.log(`[Checkin] 收藏任务: ${taskName}`);
        }
        saveToStorage();
        return state.profile.favoriteTaskTypes.includes(taskName);
    }

    /**
     * 🔴 检查任务是否已收藏
     */
    function isTaskFavorite(taskName) {
        return (state.profile.favoriteTaskTypes || []).includes(taskName);
    }

    // 导出
    window.CheckinCore = {
        state, STORAGE_KEYS, WorkMode, AttendanceStatus, SLOT_CONFIG, DEFAULT_STATUS_OPTIONS,
        formatDate, formatTime, formatDateDisplay, isToday, isPastDate,
        loadFromStorage, saveToStorage, resetProfileForUser, getActiveRecord, updateRecord,
        calculateDuration, calculateTargetHours, getStats, getDynamicSlotConfig, showToast,
        normalizeTeamName,
        generateMockTeamData, clearMockData,
        syncCurrentRecord, syncAllRecords, fetchTeamRecords,
        saveSettingsToCloud, loadSettingsFromCloud,
        loadRecordsFromCloud, autoSyncToSheets,
        smartAutoSync, startAutoSyncTimer, stopAutoSyncTimer,
        updateTaskCount, getCurrentRecord,
        savePendingSyncState, clearPendingSyncRecords,
        // 🔴 测试辅助函数
        getCurrentTime, setDebugTime,
        // 🔴 今日临时模式
        getEffectiveMode, setTodayMode,
        // 🔴 数据备份
        backupData, startAutoBackupTimer, stopAutoBackupTimer,
        // 🔴 报数任务类型
        getReportTaskTypes, setReportTaskTypes,
        // 🔴 常用任务收藏
        getFavoriteTaskTypes, toggleFavoriteTask, isTaskFavorite,
        // 🔴 记录锁定检查
        isRecordLocked: (date, userName, teamName = 'default') => {
            const key = `${date}|${userName}|${normalizeTeamName(teamName || 'default')}`;
            const expireTime = lockedRecords.get(key);
            return expireTime && Date.now() < expireTime;
        }
    };
})();
