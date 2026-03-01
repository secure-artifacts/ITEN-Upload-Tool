/**
 * 报数功能模块
 * - 定时提醒填写任务完成量
 * - 弹框提醒 + 语音播报
 * - 报数记录界面
 */

(function () {
    'use strict';

    // 报数时间配置（startHour:startMinute 开始弹窗，endHour:endMinute 之后为超时）
    const REPORT_TIMES = [
        { key: 'morning', hour: 11, minute: 50, endHour: 13, endMinute: 30, label: '上午', slot: 'morning' },
        { key: 'afternoon', hour: 17, minute: 50, endHour: 19, endMinute: 0, label: '下午', slot: 'afternoon' },
        { key: 'evening', hour: 23, minute: 0, endHour: 2, endMinute: 0, label: '晚上', slot: 'evening', crossDay: true }
    ];

    const DEFAULT_REPORT_PRESETS = ['生成图片', '制作图片', '制作风格图', '制作视频', '生成sora', '图片转视频', 'reels视频', '视频剪辑'];
    const DEFAULT_REPORT_SETTINGS = {
        notificationEnabled: true,  // 是否启用报数通知
        audioMode: 'voice',  // 'none' | 'beep' | 'voice'
        voiceText: '到点了，请填写任务完成量',
        // 🔴 自定义预设（系统预设为固定模板）
        customPresets: [],
        // 🔴 是否使用结构化报数（启用后可统计）
        useStructuredReport: true
    };

    // 重试配置
    const RETRY_INTERVAL = 15 * 60 * 1000; // 15分钟
    const MAX_RETRIES = 2;

    // HTML 转义函数
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizePresetList(list) {
        if (!Array.isArray(list)) return [];
        return list.map(item => String(item || '').trim()).filter(Boolean);
    }

    function getReportSettingsStorageKey(userName) {
        const cleanName = String(userName || '').replace(/[.#$\[\]/]/g, '_').trim();
        return cleanName ? `ck-report-settings:${cleanName}` : 'ck-report-settings';
    }

    function applySettings(nextSettings) {
        const incoming = nextSettings && typeof nextSettings === 'object' ? nextSettings : {};
        const merged = { ...DEFAULT_REPORT_SETTINGS, ...incoming };
        merged.customPresets = normalizePresetList(merged.customPresets);
        reportState.settings = merged;
    }

    function uniqPresets(list) {
        return Array.from(new Set(list));
    }

    function getDefaultPresets() {
        // 🔴 优先从 CheckinCore 获取动态任务类型（从 Google Sheets 读取）
        if (window.CheckinCore?.getReportTaskTypes) {
            const dynamicTypes = window.CheckinCore.getReportTaskTypes();
            if (dynamicTypes && dynamicTypes.length > 0) {
                return [...dynamicTypes];
            }
        }
        return [...DEFAULT_REPORT_PRESETS];
    }

    function getCustomPresets(settings = reportState.settings) {
        if (!settings) return [];
        const custom = normalizePresetList(settings.customPresets);
        if (custom.length) return uniqPresets(custom);

        const legacy = normalizePresetList(settings.presets);
        const filtered = legacy.filter(item => !DEFAULT_REPORT_PRESETS.includes(item));
        return uniqPresets(filtered);
    }

    function getAllPresets(settings = reportState.settings) {
        // 🔴 使用动态任务类型（从 Google Sheets 读取）
        return uniqPresets([...getDefaultPresets(), ...getCustomPresets(settings)]);
    }

    // 状态
    const reportState = {
        // 今日报数状态 { morning: { reported: false, retries: 0, time: null }, ... }
        todayStatus: {},
        // 报数记录列表（聊天风格）
        records: [],
        // 定时器
        checkTimer: null,
        retryTimers: {},
        // 弹框是否显示
        isDialogOpen: false,
        currentSlot: null,
        // 团队筛选
        filterTeam: '',
        // 加载状态
        isLoading: false,
        // 🔴 首次加载标志：用于区分历史数据加载和实时更新
        isInitialLoad: true,
        // 🔴 历史记录范围（天），0 表示全部
        historyRangeDays: 0,
        // 🔴 是否显示统计面板
        showStats: false,
        // 🔴 修复：已通知过的记录key集合，防止重复通知
        notifiedRecordKeys: new Set(),
        hasFetchedTeamData: false,
        // 设置
        settings: { ...DEFAULT_REPORT_SETTINGS }
    };

    const SLOT_LABELS = {
        morning: '上午',
        afternoon: '下午',
        evening: '晚上'
    };

    // 🔴 解析报数内容为结构化数据 { 任务类型: 数量 }
    function parseTaskCount(taskCountStr) {
        if (!taskCountStr || typeof taskCountStr !== 'string') return {};
        const result = {};

        // 支持多种格式:
        // "生成图片 x5" / "生成图片 × 5" / "生成图片5个" / "生成图片:5"
        const patterns = [
            /([^\d×x:,，、]+?)\s*[×x:]\s*(\d+)/gi,  // "任务 x5" / "任务 × 5" / "任务:5"
            /([^\d,，、]+?)\s*(\d+)\s*[个张条]/gi,    // "任务5个"
        ];

        // 先尝试精确匹配
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(taskCountStr)) !== null) {
                const task = match[1].trim();
                const count = parseInt(match[2], 10);
                if (task && count > 0) {
                    result[task] = (result[task] || 0) + count;
                }
            }
        }

        // 如果没有匹配到，尝试按分隔符拆分
        if (Object.keys(result).length === 0) {
            const parts = taskCountStr.split(/[,，、\n]/);
            parts.forEach(part => {
                const trimmed = part.trim();
                const numMatch = trimmed.match(/(\d+)/);
                if (numMatch) {
                    const count = parseInt(numMatch[1], 10);
                    const task = trimmed.replace(/\d+/g, '').replace(/[×x:个张条]/gi, '').trim();
                    if (task && count > 0) {
                        result[task] = (result[result] || 0) + count;
                    }
                }
            });
        }

        return result;
    }

    // 🔴 统计团队报数数据（一个月周期：上月23日 - 本月22日）
    function calculateTeamStats(filterTeam = '') {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const currentDay = now.getDate();

        // 计算日期范围：上月23日到本月22日（如果当天不到22日则只统计到今天）
        const startDate = new Date(year, month - 1, 23);
        const endDay = currentDay < 22 ? currentDay : 22;
        const endDate = new Date(year, month, endDay);

        // 🔴 修复：使用本地时间格式化日期，避免时区问题
        const formatDateStr = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const startDateStr = formatDateStr(startDate);
        const endDateStr = formatDateStr(endDate);

        console.log(`[Stats] 统计周期: ${startDateStr} ~ ${endDateStr}`);
        console.log(`[Stats] 当前记录数: ${reportState.records.length}`);

        // 筛选周期内的报数记录
        const periodRecords = reportState.records.filter(r => {
            if (r.type !== 'reported') return false;
            const recordDate = getRecordDateKey(r);
            const inRange = recordDate >= startDateStr && recordDate <= endDateStr;
            return inRange;
        });

        console.log(`[Stats] 周期内记录数: ${periodRecords.length}`);

        // 按团队和成员分组
        const teamStats = new Map(); // teamName -> { members: Map<userName, { tasks, slots, dailyRecords }> }

        periodRecords.forEach(record => {
            const team = normalizeTeamName(record.teamName);
            const userName = (record.userName || '').trim();
            if (!userName) return;

            // 筛选团队
            if (filterTeam && team !== filterTeam) return;

            // 初始化团队
            if (!teamStats.has(team)) {
                teamStats.set(team, { members: new Map(), totals: {} });
            }
            const teamData = teamStats.get(team);

            // 初始化成员
            if (!teamData.members.has(userName)) {
                teamData.members.set(userName, {
                    tasks: {},
                    slots: {},
                    dailyRecords: new Map() // 🔴 按日期存储每天的记录
                });
            }
            const memberData = teamData.members.get(userName);

            // 解析任务完成量
            const parsed = parseTaskCount(record.taskCount || '');
            const slotKey = record.slot || record.slotKey;
            const recordDate = getRecordDateKey(record);

            // 🔴 按日期存储记录（用于显示详细内容）
            if (!memberData.dailyRecords.has(recordDate)) {
                memberData.dailyRecords.set(recordDate, {});
            }
            if (slotKey) {
                memberData.dailyRecords.get(recordDate)[slotKey] = record.taskCount || '';
            }

            // 记录原始文本（最后一次的，用于简略显示）
            if (slotKey) {
                memberData.slots[slotKey] = record.taskCount || '';
            }

            // 累加统计
            Object.entries(parsed).forEach(([task, count]) => {
                memberData.tasks[task] = (memberData.tasks[task] || 0) + count;
                teamData.totals[task] = (teamData.totals[task] || 0) + count;
            });
        });

        // 🔴 记录统计周期信息
        teamStats.periodStart = startDateStr;
        teamStats.periodEnd = endDateStr;

        return teamStats;
    }

    /**
     * 初始化报数功能
     */
    function init() {
        console.log('[Report] 报数功能初始化');

        // 初始化今日状态
        resetTodayStatus();

        // 从 localStorage 加载设置
        loadSettings();

        // 启动定时检查
        startCheckTimer();

        // 加载历史记录
        loadRecords();

        // 启动 Firebase 监听（接收其他用户的报数）
        startFirebaseWatch();

        // 🔴 启动催报消息监听
        startRemindWatch();

        // 🔴 自动拉取历史报数记录
        loadHistoryRecords({ silent: true });

        // 自动拉取团队数据（确保汇总表格能显示所有成员）
        autoFetchTeamData();
    }

    /**
     * 自动拉取团队数据
     */
    async function autoFetchTeamData() {
        const C = window.CheckinCore;
        if (!C) return;

        if (reportState.hasFetchedTeamData) return;
        reportState.hasFetchedTeamData = true;

        try {
            // 显示加载中
            reportState.isLoading = true;
            renderRecordsPanel();

            console.log('[Report] 自动拉取团队数据...');
            // 报数汇总默认拉取所有团队数据
            const result = await C.fetchTeamRecords({ silent: true, allTeams: true });

            reportState.isLoading = false;
            if (result.success) {
                console.log(`[Report] 自动拉取完成: ${result.total} 条记录`);
            }
            renderRecordsPanel();
        } catch (err) {
            console.warn('[Report] 自动拉取团队数据失败:', err);
            reportState.isLoading = false;
            renderRecordsPanel();
        }
    }

    /**
     * 获取当前团队名称
     */
    function getTeamName() {
        return window.CheckinCore?.state?.profile?.teamName || 'default';
    }

    function normalizeTeamName(teamName) {
        const value = (teamName || '').trim();
        if (!value) return 'default';
        const aliases = {
            '视频组': '视频/生图组',
            '生图组': '视频/生图组',
            '视频_生图组': '视频/生图组',
            '作图组': '图片组'
        };
        return aliases[value] || value;
    }

    function getActiveTeamName() {
        return (window.CheckinCore?.state?.profile?.teamName || '').trim();
    }

    function ensureTeamNameReady() {
        const teamName = getActiveTeamName();
        if (!teamName || teamName === 'default') {
            showToast('请先在设置中填写组别！');
            return '';
        }
        return teamName;
    }

    function getCurrentUserName() {
        return (window.CheckinCore?.state?.profile?.name || '').trim();
    }

    /**
     * 获取通知接收模式
     */
    function getNotifyMode() {
        return window.CheckinCore?.state?.profile?.reportNotifyMode || 'all';
    }

    function getNotifyTeams() {
        const profile = window.CheckinCore?.state?.profile || {};
        const mode = profile.reportNotifyMode || 'all';
        const teamName = normalizeTeamName(profile.teamName);
        if (mode === 'myTeam') {
            return { mode, teams: [teamName] };
        }
        if (mode === 'custom') {
            const teams = Array.isArray(profile.reportNotifyTeams) ? profile.reportNotifyTeams : [];
            const normalized = teams.map(normalizeTeamName).filter(Boolean);
            return { mode, teams: normalized };
        }
        return { mode: 'all', teams: [] };
    }

    function shouldNotifyForTeam(teamName) {
        const { mode, teams } = getNotifyTeams();
        if (mode === 'all') return true;
        const normalized = normalizeTeamName(teamName);
        if (mode === 'myTeam') {
            return normalized === normalizeTeamName(getTeamName());
        }
        if (mode === 'custom') {
            return teams.includes(normalized);
        }
        return true;
    }

    function getRecordDateKey(record) {
        const rawTime = record?.time || record?.timestamp;
        const date = rawTime ? new Date(rawTime) : new Date();
        if (Number.isNaN(date.getTime())) {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
        // 🔴 使用本地时间格式化，避免时区问题
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getHistoryDateRange(days) {
        if (!days || days <= 0) {
            return { startDate: null, endDate: null };
        }
        const end = new Date();
        const start = new Date(end);
        start.setDate(end.getDate() - (days - 1));
        return {
            startDate: formatDateKey(start),
            endDate: formatDateKey(end)
        };
    }

    function getRecordUniqueKey(record) {
        if (record?.type === 'reported') {
            const userName = (record?.userName || '').trim();
            const slot = record?.slot || record?.slotKey || '';
            if (userName && slot) {
                return getReportedSlotKey(record);
            }
        }
        const team = normalizeTeamName(record?.teamName);
        const fallback = [
            record?.userName || '',
            record?.slot || record?.slotKey || '',
            record?.time || record?.timestamp || ''
        ].filter(Boolean).join('-');
        const idPart = record?.id || fallback;
        return `${team}::${idPart || 'unknown'}`;
    }

    function getReportedSlotKey(record) {
        const dateKey = getRecordDateKey(record);
        const team = normalizeTeamName(record?.teamName);
        const userName = (record?.userName || '').trim();
        const slot = record?.slot || record?.slotKey || '';
        return `${dateKey}::${team}::${userName}::${slot}`;
    }

    function buildReportId({ slotKey, userName, teamName, dateKey }) {
        return `${dateKey}::${normalizeTeamName(teamName)}::${userName}::${slotKey}`;
    }

    function normalizeReportRecord(record) {
        if (!record || typeof record !== 'object') return null;
        const normalized = { ...record };
        const slotKey = normalized.slot || normalized.slotKey || '';
        if (!normalized.slot && slotKey) {
            normalized.slot = slotKey;
        }
        if (!normalized.slotLabel && slotKey && SLOT_LABELS[slotKey]) {
            normalized.slotLabel = SLOT_LABELS[slotKey];
        }
        if (!normalized.type) {
            normalized.type = 'reported';
        }
        const rawTime = normalized.time || normalized.timestamp || normalized.updatedAt || normalized._migratedAt;
        if (!normalized.time && rawTime) {
            normalized.time = typeof rawTime === 'number' ? new Date(rawTime).toISOString() : rawTime;
        }
        if (!normalized.time && normalized.date && /^\d{4}-\d{2}-\d{2}$/.test(normalized.date)) {
            normalized.time = `${normalized.date}T00:00:00`;
        }
        return normalized;
    }

    function buildFallbackReportsFromCheckin(startDate, endDate) {
        const C = window.CheckinCore;
        if (!C?.state?.teamRecords) return [];
        const records = [];
        const inRange = (dateKey) => {
            if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return true;
            if (startDate && dateKey < startDate) return false;
            if (endDate && dateKey > endDate) return false;
            return true;
        };
        const toIsoTime = (value, dateKey) => {
            if (!value) return dateKey ? `${dateKey}T00:00:00` : new Date().toISOString();
            if (typeof value === 'number') return new Date(value).toISOString();
            return value;
        };
        C.state.teamRecords.forEach(record => {
            const dateKey = record.date || '';
            if (!inRange(dateKey)) return;
            const userName = (record.userName || '').trim();
            if (!userName) return;
            const teamName = record.teamName || 'default';
            const slots = record.slots || {};
            ['morning', 'afternoon', 'evening'].forEach(slotKey => {
                const slot = slots[slotKey];
                const taskCount = slot?.taskCount;
                if (!taskCount) return;
                const timeValue = slot?.reportTime || slot?.time || record.updatedAt || dateKey;
                records.push({
                    id: buildReportId({
                        slotKey,
                        userName,
                        teamName,
                        dateKey: dateKey || getRecordDateKey(record)
                    }),
                    type: 'reported',
                    slot: slotKey,
                    slotLabel: SLOT_LABELS[slotKey],
                    userName,
                    teamName,
                    taskCount,
                    time: toIsoTime(timeValue, dateKey),
                    date: dateKey || undefined,
                    _fallback: true
                });
            });
        });
        return records;
    }

    function syncMyReportStatus(record) {
        const myName = getCurrentUserName();
        if (!myName) return;
        const recordName = (record?.userName || '').trim();
        if (!recordName || recordName !== myName) return;
        const myTeam = normalizeTeamName(getTeamName());
        const recordTeam = normalizeTeamName(record?.teamName);
        if (recordTeam !== myTeam) return;
        const slotKey = record?.slot || record?.slotKey;
        if (!slotKey) return;
        const recordDate = getRecordDateKey(record);
        const today = new Date().toISOString().split('T')[0];
        if (recordDate !== today) return;

        if (!reportState.todayStatus[slotKey]) {
            reportState.todayStatus[slotKey] = { reported: false, retries: 0, time: null, taskCount: '' };
        }
        reportState.todayStatus[slotKey].reported = true;
        if (record?.taskCount) {
            reportState.todayStatus[slotKey].taskCount = record.taskCount;
        }
        reportState.todayStatus[slotKey].time = record?.time || reportState.todayStatus[slotKey].time || new Date().toISOString();
        saveTodayStatus();
    }

    async function loadHistoryRecords(options = {}) {
        if (!window.bridge?.checkin?.getReportRecordsRange) return;

        const rangeDays = Number(reportState.historyRangeDays) || 0;
        const { startDate, endDate } = getHistoryDateRange(rangeDays);
        const teamName = '*';

        reportState.isLoading = true;
        renderRecordsPanel();

        try {
            const result = await window.bridge.checkin.getReportRecordsRange({
                teamName,
                startDate,
                endDate
            });

            reportState.isLoading = false;
            if (!result?.success) {
                renderRecordsPanel();
                return;
            }

            reportState.records = [];
            reportState.notifiedRecordKeys.clear();
            reportState.isInitialLoad = true;

            // 🔴 DEBUG: 查看收到的记录结构
            console.log('[Report] 🔴 DEBUG: 收到记录数:', result.records?.length);
            if (result.records?.length > 0) {
                console.log('[Report] 🔴 DEBUG: 前3条记录样例:', result.records.slice(0, 3));
            }

            mergeRemoteRecords(result.records || []);

            console.log('[Report] 🔴 DEBUG: 合并后 reportState.records 数量:', reportState.records.length);

            if (reportState.records.length === 0) {
                const fallbackRecords = buildFallbackReportsFromCheckin(startDate, endDate);
                if (fallbackRecords.length) {
                    reportState.isInitialLoad = true;
                    mergeRemoteRecords(fallbackRecords);
                    showToast(`报数记录为空，已用打卡记录补全 ${fallbackRecords.length} 条`);
                }
            }

            if (!result.records || result.records.length === 0) {
                reportState.isInitialLoad = false;
                renderRecordsPanel();
            }
            if (!options.silent) {
                showToast(`已加载报数记录 ${result.records?.length || 0} 条`);
            }
        } catch (error) {
            console.warn('[Report] 加载历史报数失败:', error);
            reportState.isLoading = false;
            renderRecordsPanel();
            if (!options.silent) {
                showToast('加载报数记录失败');
            }
        }
    }

    function bindHistoryControls() {
        const rangeSelect = document.getElementById('ck-report-history-range');
        const refreshBtn = document.getElementById('ck-report-history-refresh');

        if (rangeSelect) {
            const currentValue = String(Number(reportState.historyRangeDays) || 0);
            if (rangeSelect.value !== currentValue) {
                rangeSelect.value = currentValue;
            }
            rangeSelect.onchange = () => {
                const nextValue = Number(rangeSelect.value) || 0;
                reportState.historyRangeDays = nextValue;
                loadHistoryRecords({ silent: false });
            };
        }

        if (refreshBtn) {
            refreshBtn.onclick = () => loadHistoryRecords({ silent: false });
        }
    }

    /**
     * 启动 Firebase 报数记录监听
     */
    function startFirebaseWatch() {
        const teamName = getTeamName();
        const notifyMode = getNotifyMode();

        // 根据通知模式决定监听范围
        // 'all' = 监听所有团队（传入 '*'）
        // 'myTeam' = 只监听本组
        const listenTeam = notifyMode === 'myTeam' ? teamName : '*';

        if (window.bridge?.checkin?.watchReportRecords) {
            window.bridge.checkin.watchReportRecords(listenTeam);

            // 监听更新事件
            window.bridge.checkin.onReportRecordsUpdated?.((data) => {
                if (data.type === 'update' && Array.isArray(data.records)) {
                    // 合并远程记录到本地
                    mergeRemoteRecords(data.records);
                }
            });

            const modeLabel = notifyMode === 'myTeam' ? `仅本组: ${teamName}` : '所有团队';
            console.log(`[Report] Firebase 报数监听已启动 (${modeLabel})`);
        }
    }

    /**
     * 重新启动 Firebase 监听（团队名称变更时调用）
     */
    function restartFirebaseWatch() {
        // 先停止现有监听
        if (window.bridge?.checkin?.stopWatchReportRecords) {
            window.bridge.checkin.stopWatchReportRecords();
        }

        // 清空本地记录（因为要切换到新团队）
        reportState.records = [];
        renderRecordsPanel();

        // 重新启动监听
        startFirebaseWatch();
        loadHistoryRecords({ silent: true });

        console.log('[Report] 已切换到新团队，重新启动监听');
    }

    // 🔴 已处理的催报消息ID（避免重复弹窗）
    const handledRemindIds = new Set();

    /**
     * 🔴 启动催报消息监听（监听所有团队）
     */
    function startRemindWatch() {
        // 🔴 监听所有团队的催报消息，使用 '*' 通配符
        if (window.bridge?.checkin?.watchRemindMessages) {
            window.bridge.checkin.watchRemindMessages('*');

            // 监听催报消息
            window.bridge.checkin.onRemindMessage?.((data) => {
                if (data.type === 'remind' && Array.isArray(data.messages)) {
                    const myName = getCurrentUserName();

                    data.messages.forEach(msg => {
                        // 避免重复处理
                        if (handledRemindIds.has(msg.id)) return;
                        handledRemindIds.add(msg.id);

                        // 检查自己是否在目标列表中
                        const targetUsers = msg.targetUsers || [];
                        if (targetUsers.includes(myName)) {
                            console.log(`[Report] 收到催报消息: 来自 ${msg.senderName}，时段 ${msg.slotLabel}`);

                            // 弹出报数提醒弹窗
                            const slotKey = msg.slotKey;
                            const slotLabel = msg.slotLabel;
                            const report = REPORT_TIMES.find(r => r.key === slotKey) || {
                                key: slotKey,
                                label: slotLabel
                            };

                            // 触发报数弹窗
                            triggerReport(report);
                        }
                    });
                }
            });

            console.log(`[Report] 催报消息监听已启动 (所有团队)`);
        }
    }

    /**
     * 合并远程记录
     */
    function mergeRemoteRecords(remoteRecords) {
        const existingKeys = new Set(reportState.records.map(r => getRecordUniqueKey(r)));
        const reportedSlotKeys = new Set(
            reportState.records
                .filter(r => r.type === 'reported')
                .map(r => getReportedSlotKey(r))
        );
        const myName = getCurrentUserName();
        const newRecords = [];
        let hasUpdated = false;

        remoteRecords.forEach(record => {
            const normalizedRecord = normalizeReportRecord(record);
            if (!normalizedRecord) return;
            const recordKey = getRecordUniqueKey(normalizedRecord);
            const existingIndex = reportState.records.findIndex(r => getRecordUniqueKey(r) === recordKey);
            if (existingIndex === -1) {
                reportState.records.push(normalizedRecord);
                newRecords.push(normalizedRecord);
                existingKeys.add(recordKey);
            } else {
                const existingRecord = reportState.records[existingIndex];
                const existingTime = new Date(existingRecord?.time || existingRecord?.timestamp || 0).getTime();
                const incomingTime = new Date(normalizedRecord?.time || normalizedRecord?.timestamp || 0).getTime();
                const taskChanged = normalizedRecord?.taskCount && normalizedRecord.taskCount !== existingRecord?.taskCount;
                if (incomingTime >= existingTime && (taskChanged || normalizedRecord?.type !== existingRecord?.type)) {
                    reportState.records[existingIndex] = { ...existingRecord, ...normalizedRecord };
                    hasUpdated = true;
                }
            }
            if (normalizedRecord?.type === 'reported') {
                syncMyReportStatus(normalizedRecord);
            }
        });

        if (newRecords.length > 0 || hasUpdated) {
            // 按时间排序
            reportState.records.sort((a, b) => {
                const timeA = new Date(a.time || a.timestamp).getTime();
                const timeB = new Date(b.time || b.timestamp).getTime();
                return timeB - timeA;
            });

            // 更新 UI
            renderRecordsPanel();
            console.log('[Report] 收到远程报数记录更新');

            // 🔴 检查是否需要弹框通知
            // 首次加载历史数据时，只标记已有记录，不触发通知
            if (reportState.isInitialLoad) {
                console.log('[Report] 首次加载历史数据，标记记录但跳过通知');
                // 🔴 修复：首次加载时标记所有已有记录为"已通知"，防止后续重复弹窗
                newRecords.forEach(record => {
                    if (record.type === 'reported') {
                        const slotKey = getReportedSlotKey(record);
                        reportState.notifiedRecordKeys.add(slotKey);
                        reportedSlotKeys.add(slotKey);
                    }
                });
                reportState.isInitialLoad = false; // 标记首次加载完成
            } else {
                // 🔴 修复：使用持久化的 notifiedRecordKeys 检查是否已通知过
                newRecords.forEach(record => {
                    // 只通知"已报数"类型的记录
                    if (record.type === 'reported' && record.userName !== myName) {
                        if (!shouldNotifyForTeam(record.teamName)) return;
                        const slotKey = getReportedSlotKey(record);
                        // 检查是否已经通知过（包括首次加载时标记的和后续通知过的）
                        if (reportedSlotKeys.has(slotKey) || reportState.notifiedRecordKeys.has(slotKey)) return;
                        // 标记为已通知
                        reportedSlotKeys.add(slotKey);
                        reportState.notifiedRecordKeys.add(slotKey);
                        showOtherReportedNotification(record);
                    }
                });
            }
        }
    }

    /**
     * 显示别人已报数的通知
     */
    function showOtherReportedNotification(record) {
        // 检查是否启用弹框通知
        const notifyEnabled = window.CheckinCore?.state?.profile?.notifyEnabled !== false;
        if (!notifyEnabled) {
            console.log('[Report] 弹框通知已禁用，使用 toast');
            showToast(`${record.userName} ${record.slotLabel}已报数`);
            return;
        }

        // 获取通知位置设置（优先读取主应用配置）
        const notifyPosition = window.appConfig?.notificationPosition || window.CheckinCore?.state?.profile?.notifyPosition || 'topRight';
        // 🔴 获取提示音开关设置
        const playSoundEnabled = window.CheckinCore?.state?.profile?.reportNotifySoundEnabled !== false;
        // 🔴 获取通知弹框缩放比例
        const notificationScale = window.CheckinCore?.state?.profile?.notificationScale || 100;

        // 使用置顶通知窗口
        if (window.bridge?.showFloatingNotification) {
            window.bridge.showFloatingNotification({
                type: 'report-info',
                title: `📢 ${record.userName} 已报数`,
                message: `${record.slotLabel}：${record.taskCount}`,
                userName: record.userName,
                slotLabel: record.slotLabel,
                taskCount: record.taskCount,
                position: notifyPosition,  // 传递位置参数
                playSound: playSoundEnabled,  // 🔴 传递提示音开关
                scale: notificationScale,    // 🔴 传递缩放比例
                actions: [
                    { id: 'close', label: '关闭', type: 'ghost' }
                ]
            });
        } else {
            // fallback: 使用 toast
            showToast(`${record.userName} ${record.slotLabel}已报数`);
        }
    }

    /**
     * 重置今日状态
     * 🔴 已移除 localStorage，只在内存中维护
     */
    function resetTodayStatus() {
        const today = new Date().toISOString().split('T')[0];
        const savedDate = reportState.lastResetDate || '';

        if (savedDate !== today) {
            // 新的一天，重置状态
            reportState.todayStatus = {};
            REPORT_TIMES.forEach(t => {
                reportState.todayStatus[t.key] = {
                    reported: false,
                    retries: 0,
                    time: null,
                    taskCount: ''
                };
            });
            reportState.lastResetDate = today;
        }
        // 不再从 localStorage 恢复，状态从 Firebase 实时监听获取
    }

    /**
     * 加载设置
     */
    function loadSettingsForUser(_userName) {
        // 🔴 只使用云端设置，这里先重置为默认
        applySettings(null);
    }

    function loadSettings() {
        const userName = window.CheckinCore?.state?.profile?.name || '';
        loadSettingsForUser(userName);
    }

    /**
     * 保存设置
     */
    function saveSettings(_userName) {
        // 🔴 只使用云端设置，保留内存态即可
        applySettings(reportState.settings);
    }

    /**
     * 启动定时检查
     */
    function startCheckTimer() {
        if (reportState.checkTimer) {
            clearInterval(reportState.checkTimer);
        }

        // 每分钟检查一次
        reportState.checkTimer = setInterval(checkReportTime, 60 * 1000);

        // 立即检查一次
        checkReportTime();

        console.log('[Report] 定时检查已启动');
    }

    /**
     * 检查是否到报数时间
     */
    function checkReportTime() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        REPORT_TIMES.forEach(report => {
            // 检查是否到达报数时间
            if (currentHour === report.hour && currentMinute === report.minute) {
                const status = reportState.todayStatus[report.key];

                // 如果还没报数且重试次数未超限
                if (!status?.reported && (status?.retries || 0) < MAX_RETRIES) {
                    triggerReport(report);
                }
            }
        });
    }

    /**
     * 触发报数提醒
     */
    function triggerReport(report) {
        // 检查通知是否启用
        if (!reportState.settings.notificationEnabled) {
            console.log(`[Report] 报数通知已禁用，跳过: ${report.label}`);
            return;
        }

        console.log(`[Report] 触发报数提醒: ${report.label}`);

        // 更新重试次数
        if (!reportState.todayStatus[report.key]) {
            reportState.todayStatus[report.key] = { reported: false, retries: 0 };
        }
        reportState.todayStatus[report.key].retries++;
        saveTodayStatus();

        // 显示弹框
        showReportDialog(report);

        // 音频提醒
        const audioMode = reportState.settings.audioMode || 'voice';
        if (audioMode === 'voice') {
            // 语音播报
            speak(reportState.settings.voiceText);
        } else if (audioMode === 'beep') {
            // 播放提示音
            playBeep();
        }
        // audioMode === 'none' 时不播放任何声音

        // 添加等待记录
        const userName = window.CheckinCore?.state?.profile?.name || '我';
        addRecord({
            type: 'waiting',
            slot: report.key,
            slotLabel: report.label,
            userName: userName,
            time: new Date().toISOString(),
            retries: reportState.todayStatus[report.key].retries
        });

        // 设置15分钟后重试
        if (reportState.todayStatus[report.key].retries < MAX_RETRIES) {
            scheduleRetry(report);
        } else {
            // 超过最大重试次数，标记为未报数
            addRecord({
                type: 'missed',
                slot: report.key,
                slotLabel: report.label,
                userName: userName,
                time: new Date().toISOString(),
                message: `${userName}没报数`
            });
        }
    }

    /**
     * 安排重试
     */
    function scheduleRetry(report) {
        if (reportState.retryTimers[report.key]) {
            clearTimeout(reportState.retryTimers[report.key]);
        }

        reportState.retryTimers[report.key] = setTimeout(() => {
            const status = reportState.todayStatus[report.key];
            if (!status?.reported && (status?.retries || 0) < MAX_RETRIES) {
                triggerReport(report);
            }
        }, RETRY_INTERVAL);

        console.log(`[Report] 已安排 ${report.label} 15分钟后重试`);
    }

    /**
     * 语音播报
     */
    function speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            speechSynthesis.speak(utterance);
        }
    }

    /**
     * 播放提示音
     */
    function playBeep() {
        try {
            // 使用 AudioContext 生成简单的提示音
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // 设置音调和音量
            oscillator.frequency.value = 800;  // 频率 800Hz
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;  // 音量 30%

            // 播放
            oscillator.start();

            // 渐弱效果后停止
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.stop(audioContext.currentTime + 0.5);

            // 播放第二声（间隔 0.2 秒）
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                osc2.frequency.value = 1000;  // 略高的音调
                osc2.type = 'sine';
                gain2.gain.value = 0.3;
                osc2.start();
                gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                osc2.stop(audioContext.currentTime + 0.5);
            }, 200);

        } catch (e) {
            console.warn('[Report] 播放提示音失败:', e);
        }
    }

    /**
     * 显示报数弹框 - 使用置顶通知窗口
     */
    function showReportDialog(report) {
        reportState.isDialogOpen = true;
        reportState.currentSlot = report;

        // 检查是否启用弹框通知
        const notifyEnabled = window.CheckinCore?.state?.profile?.notifyEnabled !== false;
        if (!notifyEnabled) {
            console.log('[Report] 弹框通知已禁用');
            return;
        }

        // 获取通知位置设置（优先读取主应用配置）
        const notifyPosition = window.appConfig?.notificationPosition || window.CheckinCore?.state?.profile?.notifyPosition || 'topRight';
        // 🔴 获取通知弹框缩放比例
        const notificationScale = window.CheckinCore?.state?.profile?.notificationScale || 100;

        // 使用置顶通知窗口（和审核提醒一样）
        if (window.bridge?.showFloatingNotification) {
            // 🔴 获取收藏的任务类型
            const favoriteTypes = window.CheckinCore?.getFavoriteTaskTypes?.() || [];

            window.bridge.showFloatingNotification({
                type: 'report',
                title: `📢 ${report.label}报数提醒`,
                slotKey: report.key,
                slotLabel: report.label,
                message: `请填写 ${report.label} 的任务完成量`,
                position: notifyPosition,  // 传递位置参数
                scale: notificationScale,   // 🔴 传递缩放比例
                presets: getAllPresets(),
                favoriteTypes: favoriteTypes,  // 🔴 传递收藏任务
                actions: [
                    { id: 'later', label: '稍后提醒', type: 'secondary' },
                    { id: 'submit', label: '提交报数', type: 'primary' }
                ]
            });
            return;
        }

        // fallback: 使用页面内弹框
        const existingDialog = document.getElementById('ck-report-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        // 获取预设列表
        const presets = getAllPresets();
        const existingTaskCount = reportState.todayStatus?.[report.key]?.taskCount
            || window.CheckinCore?.getActiveRecord?.()?.slots?.[report.key]?.taskCount
            || '';
        const submitLabel = existingTaskCount ? '更新报数' : '提交报数';
        const presetButtonsHtml = presets.map(p =>
            `<button type="button" class="ck-preset-btn" data-preset="${escapeHtml(p)}">${escapeHtml(p)}</button>`
        ).join('');

        const dialogHtml = `
      <div class="ck-report-dialog-overlay" id="ck-report-dialog">
        <div class="ck-report-dialog">
          <div class="ck-report-dialog-header">
            <span class="icon">📢</span>
            <h3>${report.label}报数提醒</h3>
          </div>
          <div class="ck-report-dialog-body">
            <p class="hint">请填写 <strong>${report.label}</strong> 的任务完成量：</p>
            <div class="ck-preset-grid">${presetButtonsHtml}</div>
            <textarea id="ck-report-input" placeholder="点击上方预设或手动输入，例如：完成3个视频剪辑..." rows="3">${existingTaskCount}</textarea>
          </div>
          <div class="ck-report-dialog-footer">
            <button class="ck-btn" id="ck-report-later">稍后提醒</button>
            <button class="ck-btn primary" id="ck-report-submit">${submitLabel}</button>
          </div>
        </div>
      </div>
    `;

        document.body.insertAdjacentHTML('beforeend', dialogHtml);

        // 绑定预设按钮点击事件
        document.querySelectorAll('.ck-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                const input = document.getElementById('ck-report-input');
                if (input && preset) {
                    const current = input.value.trim();
                    input.value = current ? current + '、' + preset : preset;
                    input.focus();
                }
            });
        });

        // 绑定事件
        document.getElementById('ck-report-later')?.addEventListener('click', () => {
            closeReportDialog();
        });

        document.getElementById('ck-report-submit')?.addEventListener('click', () => {
            const input = document.getElementById('ck-report-input');
            const taskCount = input?.value?.trim();
            if (taskCount) {
                submitReport(report, taskCount);
                closeReportDialog();
            } else {
                input?.focus();
                input?.classList.add('shake');
                setTimeout(() => input?.classList.remove('shake'), 500);
            }
        });

        // 聚焦输入框
        setTimeout(() => {
            document.getElementById('ck-report-input')?.focus();
        }, 100);
    }

    /**
     * 关闭报数弹框
     */
    function closeReportDialog() {
        const dialog = document.getElementById('ck-report-dialog');
        if (dialog) {
            dialog.classList.add('closing');
            setTimeout(() => dialog.remove(), 200);
        }
        reportState.isDialogOpen = false;
        reportState.currentSlot = null;
    }

    /**
     * 提交报数
     * @param {Object} report - 报数信息 { key, slot, label }
     * @param {string} taskCount - 任务完成量
     * @param {boolean} skipSync - 是否跳过同步（当调用方已经更新过记录时为true）
     */
    async function submitReport(report, taskCount, skipSync = false) {
        const reportTeamName = ensureTeamNameReady();
        if (!reportTeamName) return;

        console.log(`[Report] 提交报数: ${report.label} - ${taskCount}`);

        // 更新状态
        reportState.todayStatus[report.key] = {
            reported: true,
            retries: reportState.todayStatus[report.key]?.retries || 1,
            time: new Date().toISOString(),
            taskCount: taskCount
        };
        saveTodayStatus();

        // 清除重试定时器
        if (reportState.retryTimers[report.key]) {
            clearTimeout(reportState.retryTimers[report.key]);
            delete reportState.retryTimers[report.key];
        }

        // 添加已报数记录
        const reportUserName = window.CheckinCore?.state?.profile?.name || '我';
        const reportDate = new Date().toISOString().split('T')[0];
        const reportId = buildReportId({ slotKey: report.key, userName: reportUserName, teamName: reportTeamName, dateKey: reportDate });
        addRecord({
            id: reportId,
            type: 'reported',
            slot: report.key,
            slotLabel: report.label,
            userName: reportUserName,
            teamName: reportTeamName,
            time: new Date().toISOString(),
            taskCount: taskCount
        });

        // 仅当外部未更新记录时，才在本地同步任务完成量
        if (!skipSync) {
            console.log(`[Report] 同步任务完成量到 CheckinCore: slotKey=${report.key}, taskCount=${taskCount}`);
            if (window.CheckinCore?.updateTaskCount) {
                await window.CheckinCore.updateTaskCount(report.key, taskCount);
                console.log(`[Report] CheckinCore.updateTaskCount 调用完成`);
            } else {
                console.log(`[Report] CheckinCore.updateTaskCount 不存在，使用 Firebase 同步`);
                await syncReportToFirebase(report, taskCount);
            }
        }

        // 🔴 始终刷新界面（确保实时打卡和报数记录都更新）
        console.log(`[Report] 刷新界面...`);
        if (window.DailyCheckin?.render) {
            window.DailyCheckin.render();
            console.log(`[Report] DailyCheckin.render() 已调用`);
        } else {
            console.log(`[Report] DailyCheckin.render 不存在`);
        }
        renderRecordsPanel();

        // 显示成功提示
        showToast('报数成功！');
    }

    /**
     * 同步报数到 Firebase
     */
    async function syncReportToFirebase(report, taskCount) {
        try {
            const teamName = ensureTeamNameReady();
            if (!teamName) return;
            const userName = window.CheckinCore?.state?.profile?.name || '我';
            const today = new Date().toISOString().split('T')[0];

            if (window.bridge?.checkin?.saveRecordFirebase && userName) {
                // 获取当前记录
                const currentRecord = window.CheckinCore?.getCurrentRecord?.() || {};
                currentRecord.teamName = teamName;

                // 更新对应时段的 taskCount
                if (!currentRecord.slots) currentRecord.slots = {};
                if (!currentRecord.slots[report.slot]) currentRecord.slots[report.slot] = {};
                currentRecord.slots[report.slot].taskCount = taskCount;
                currentRecord.slots[report.slot].reportTime = new Date().toISOString();

                // 保存到 Firebase
                await window.bridge.checkin.saveRecordFirebase({
                    userName,
                    date: today,
                    record: currentRecord
                });

                console.log('[Report] 报数已同步到 Firebase');
            }
        } catch (error) {
            console.error('[Report] 同步到 Firebase 失败:', error);
        }
    }

    /**
     * 保存今日状态
     * 🔴 已移除 localStorage，只在内存中维护
     */
    function saveTodayStatus() {
        // 不再保存到 localStorage，状态只在内存中维护
    }

    /**
     * 添加报数记录
     */
    function addRecord(record) {
        const recordWithTeam = {
            ...record,
            teamName: record.teamName || getTeamName()
        };
        if (recordWithTeam.type === 'reported') {
            const targetKey = getReportedSlotKey(recordWithTeam);
            const existingIndex = reportState.records.findIndex(r =>
                r.type === 'reported' && getReportedSlotKey(r) === targetKey
            );
            if (existingIndex !== -1) {
                reportState.records.splice(existingIndex, 1);
            }
        }
        reportState.records.unshift(recordWithTeam);

        // 最多保留100条
        if (reportState.records.length > 100) {
            reportState.records = reportState.records.slice(0, 100);
        }

        saveRecords();

        // 触发 UI 更新
        renderRecordsPanel();

        // 广播到 Firebase（让其他用户看到）
        broadcastRecord(recordWithTeam);
    }

    /**
     * 广播记录到 Firebase
     */
    async function broadcastRecord(record) {
        try {
            if (window.bridge?.checkin?.saveReportRecord) {
                const teamName = ensureTeamNameReady();
                if (!teamName) return;
                await window.bridge.checkin.saveReportRecord(record, teamName);
            }
        } catch (error) {
            console.warn('[Report] 广播记录失败:', error);
        }
    }

    /**
     * 加载记录
     * 🔴 已移除 localStorage，只从 Firebase 实时同步获取
     */
    function loadRecords() {
        // 不再从 localStorage 加载，数据统一从 Firebase 实时监听获取
        reportState.records = [];
    }

    /**
     * 保存记录
     * 🔴 已移除 localStorage，只保存到 Firebase
     */
    function saveRecords() {
        // 不再保存到 localStorage，数据统一通过 Firebase 同步
    }

    /**
     * 生成团队报数状态汇总表格
     * 显示所有团队成员，标记他们在上午/下午/晚上三个时段的报数情况
     */
    function renderTeamReportSummary() {
        // 如果正在加载，显示加载中提示
        if (reportState.isLoading) {
            return '<div class="ck-loading-hint"><span class="spinner"></span> 正在加载团队成员数据...</div>';
        }

        const today = new Date().toISOString().split('T')[0];
        const slots = ['morning', 'afternoon', 'evening'];
        const slotLabels = { morning: '上午', afternoon: '下午', evening: '晚上' };

        // 从 CheckinCore 获取所有团队成员（从 teamRecords，与组内汇总相同的数据源）
        const C = window.CheckinCore;
        const allMembers = new Map(); // { "团队::用户名": { userName, teamName } }
        const memberRecordsMap = new Map();

        // 从团队打卡记录中获取所有成员
        if (C?.state?.teamRecords) {
            C.state.teamRecords.forEach(record => {
                const userName = (record.userName || '').trim();
                const teamName = normalizeTeamName(record.teamName);
                if (userName) {
                    const key = `${teamName}::${userName}`;
                    if (!allMembers.has(key)) {
                        allMembers.set(key, { userName, teamName, slots: {} });
                    }
                    if (!memberRecordsMap.has(key)) {
                        memberRecordsMap.set(key, []);
                    }
                    memberRecordsMap.get(key).push(record);
                }
            });
        }

        // 🔴 已移除 state.records 备用逻辑，只使用 Firebase teamRecords

        // 获取今天的报数记录
        const todayRecords = reportState.records.filter(r =>
            r.type === 'reported' && getRecordDateKey(r) === today
        );

        // 将报数记录合并到成员数据中
        todayRecords.forEach(record => {
            const team = normalizeTeamName(record.teamName);
            const userName = (record.userName || '').trim();
            if (!userName) return;

            const userKey = `${team}::${userName}`;

            // 如果这个用户不在成员列表中，也添加进来
            if (!allMembers.has(userKey)) {
                allMembers.set(userKey, { userName, teamName: team, slots: {} });
            }

            const user = allMembers.get(userKey);
            const slotKey = record.slot || record.slotKey;
            if (slotKey && slots.includes(slotKey)) {
                // 保留最新的记录
                const existing = user.slots[slotKey];
                const existingTime = existing ? new Date(existing.time || existing.timestamp).getTime() : 0;
                const incomingTime = new Date(record.time || record.timestamp).getTime();
                if (incomingTime >= existingTime) {
                    user.slots[slotKey] = record;
                }
            }
        });

        // 提取所有团队列表
        const allTeams = [...new Set(Array.from(allMembers.values()).map(u => u.teamName))].sort((a, b) => a.localeCompare(b, 'zh-CN'));

        // 获取当前筛选的团队
        const filterTeam = reportState.filterTeam || '';

        // 获取当前时段（根据报数时间配置）
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentTime = hour * 60 + minute; // 转为分钟数便于比较

        let currentSlot = null;
        // 上午: 11:50 - 13:30
        if (currentTime >= 11 * 60 + 50 && currentTime < 13 * 60 + 30) {
            currentSlot = 'morning';
        }
        // 下午: 17:50 - 19:00
        else if (currentTime >= 17 * 60 + 50 && currentTime < 19 * 60) {
            currentSlot = 'afternoon';
        }
        // 晚上: 23:00 - 02:00（跨天）
        else if (currentTime >= 23 * 60 || currentTime < 2 * 60) {
            currentSlot = 'evening';
        }

        // 根据筛选条件过滤
        let users = Array.from(allMembers.values());
        if (filterTeam) {
            users = users.filter(u => u.teamName === filterTeam);
        }

        // 排序：当前时段未报数的排在最前面
        users.sort((a, b) => {
            // 先按当前时段是否已报数排序（未报数的排前面）
            if (currentSlot) {
                const aMissing = !a.slots[currentSlot];
                const bMissing = !b.slots[currentSlot];
                if (aMissing && !bMissing) return -1;
                if (!aMissing && bMissing) return 1;
            }
            // 再按团队名排序，再按用户名排序
            if (a.teamName !== b.teamName) {
                return a.teamName.localeCompare(b.teamName, 'zh-CN');
            }
            return a.userName.localeCompare(b.userName, 'zh-CN');
        });

        if (users.length === 0) {
            return '<p class="empty-hint">暂无团队成员数据，请先在"组内汇总"中拉取团队数据</p>';
        }

        // 生成团队筛选下拉框
        const teamOptions = allTeams.map(t =>
            `<option value="${escapeHtml(t)}" ${t === filterTeam ? 'selected' : ''}>${escapeHtml(t)}</option>`
        ).join('');

        const modeLabels = { full_time: '全天', working: '上班', student: '上学', other: '其他' };
        const getMemberModeSummary = (memberKey) => {
            const records = memberRecordsMap.get(memberKey) || [];
            if (!records.length) return '-';

            let baseMode = '';
            const modeSet = new Set();
            let latestRecord = null;
            let latestTs = 0;

            records.forEach(record => {
                const modeValue = record.profile?.mode || record.mode;
                if (modeValue) modeSet.add(modeValue);
                const recordTs = record.updatedAt || (record.date ? new Date(record.date).getTime() : 0);
                if (recordTs >= latestTs) {
                    latestTs = recordTs;
                    latestRecord = record;
                }
            });

            let label = '-';
            if (latestRecord) {
                baseMode = latestRecord.profile?.mode || latestRecord.mode || '';
                if (baseMode) {
                    const customLabel = latestRecord.profile?.customModeLabel || latestRecord.customModeLabel || '';
                    label = baseMode === 'other' && customLabel ? customLabel : (modeLabels[baseMode] || baseMode);
                }
            }

            const extraLabels = [];
            if (modeSet.has('student') && baseMode !== 'student') extraLabels.push('偶尔上学');
            if (modeSet.has('working') && baseMode !== 'working') extraLabels.push('偶尔上班');
            if (extraLabels.length) {
                label = label !== '-' ? `${label}（${extraLabels.join('、')}）` : extraLabels.join('、');
            }

            return label;
        };

        // 生成表格
        let html = `
        <div class="ck-report-filter">
            <label>筛选团队：</label>
            <select id="ck-report-team-filter">
                <option value="">全部团队 (${Array.from(allMembers.values()).length}人)</option>
                ${teamOptions}
            </select>
        </div>
        <table class="ck-report-summary-table">
            <thead>
                <tr>
                    <th>成员</th>
                    <th>团队</th>
                    <th>时间模式</th>
                    ${slots.map(s => `<th>${slotLabels[s]}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
        `;

        const myName = getCurrentUserName();

        users.forEach(user => {
            // 判断当前时段是否未报数
            const isMissingCurrentSlot = currentSlot && !user.slots[currentSlot];
            // 🔴 当前提交人高亮
            const isCurrentUser = user.userName.trim() === myName.trim();
            const rowClasses = [];
            if (isMissingCurrentSlot) rowClasses.push('missing-current');
            if (isCurrentUser) rowClasses.push('ck-current-user-row');
            const memberKey = `${user.teamName}::${user.userName}`;
            const memberMode = getMemberModeSummary(memberKey);
            html += `<tr class="${rowClasses.join(' ')}">`;
            html += `<td class="user-name">${escapeHtml(user.userName)}</td>`;
            html += `<td class="team-name">${escapeHtml(user.teamName)}</td>`;
            html += `<td class="mode-name" title="${escapeHtml(memberMode)}">${escapeHtml(memberMode)}</td>`;

            const isMe = user.userName === myName;

            slots.forEach(slot => {
                const record = user.slots[slot];
                if (record) {
                    const taskCount = record.taskCount || '-';
                    const time = new Date(record.time || record.timestamp).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    // 🔴 自己的报数可以点击编辑
                    const editableClass = isMe ? 'editable-cell' : '';
                    const editHint = isMe ? '<span class="edit-icon">✏️</span>' : '';
                    html += `<td class="slot-cell reported ${editableClass}" title="${escapeHtml(taskCount)}" data-slot="${slot}" data-user="${escapeHtml(user.userName)}">
                        <span class="status-icon">✓</span>
                        <span class="report-time">${time}</span>
                        <span class="task-preview">${escapeHtml(taskCount.length > 8 ? taskCount.slice(0, 8) + '...' : taskCount)}</span>
                        ${editHint}
                    </td>`;
                } else {
                    html += `<td class="slot-cell pending">
                        <span class="status-icon">-</span>
                    </td>`;
                }
            });

            html += `</tr>`;
        });

        html += `</tbody></table>`;
        return html;
    }

    /**
     * 渲染报数记录面板
     */
    function renderRecordsPanel() {
        const container = document.getElementById('ck-report-records-container');
        if (!container) return;

        // 渲染团队报数状态汇总
        const summaryContainer = document.getElementById('ck-report-summary-container');
        if (summaryContainer) {
            summaryContainer.innerHTML = renderTeamReportSummary();
        }

        // 获取当前用户名
        const myName = getCurrentUserName();

        if (reportState.isLoading && reportState.records.length === 0) {
            container.innerHTML = '<p class="empty-hint">正在加载历史报数...</p>';
            bindHistoryControls();
            return;
        }

        // 渲染记录流水
        const html = reportState.records.map((record, index) => {
            const rawTime = record.time || record.timestamp || record.updatedAt;
            const timeObj = rawTime ? new Date(rawTime) : null;
            const hasValidTime = timeObj && !Number.isNaN(timeObj.getTime());
            const time = hasValidTime ? timeObj.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            }) : '--:--';
            const date = hasValidTime ? timeObj.toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric'
            }) : '';

            let statusClass = '';
            let statusIcon = '';
            let content = '';
            let editBtn = '';
            let clickableClass = '';
            const recordType = record.type || 'reported';

            switch (recordType) {
                case 'reported':
                    statusClass = 'reported';
                    statusIcon = '✓';
                    content = `<strong>${record.userName}</strong> ${record.slotLabel || SLOT_LABELS[record.slot] || '报数'}：${record.taskCount || '-'}`;
                    // 🔴 所有报数记录都可以编辑（自己的记录）
                    // 调试：打印用户名匹配情况
                    console.log(`[Report] 记录: ${record.userName}, 当前用户: ${myName}, 匹配: ${record.userName === myName}`);
                    // 暂时让所有报数记录都可编辑，方便测试
                    clickableClass = 'editable';
                    editBtn = `<span class="ck-edit-hint">点击编辑 ✏️</span>`;
                    break;
                case 'waiting':
                    statusClass = 'waiting';
                    statusIcon = '⏳';
                    content = `等待 <strong>${record.userName}</strong> ${record.slotLabel}报数...（第${record.retries}次提醒）`;
                    break;
                case 'missed':
                    statusClass = 'missed';
                    statusIcon = '✗';
                    content = `<strong>${record.userName}</strong> ${record.slotLabel}没报数`;
                    break;
            }

            return `
        <div class="ck-report-record ${statusClass} ${clickableClass}" data-index="${index}" data-slot="${record.slot}" data-editable="${record.userName === myName}">
          <span class="status-icon">${statusIcon}</span>
          <div class="record-content">
            <p>${content}</p>
            <span class="record-time">${date} ${time}</span>
          </div>
          ${editBtn}
        </div>
      `;
        }).join('');

        container.innerHTML = html || '<p class="empty-hint">暂无报数记录</p>';

        // 🔴 绑定整行点击事件（可编辑的记录）
        container.querySelectorAll('.ck-report-record.editable').forEach(row => {
            row.onclick = () => {
                const index = parseInt(row.dataset.index);
                const record = reportState.records[index];
                if (record) {
                    showEditReportDialog(record, index);
                }
            };
        });

        bindHistoryControls();

        // 🔴 绑定汇总表格中可编辑单元格的点击事件
        if (summaryContainer) {
            summaryContainer.querySelectorAll('.editable-cell').forEach(cell => {
                cell.onclick = () => {
                    const slot = cell.dataset.slot;
                    const slotLabels = { morning: '上午', afternoon: '下午', evening: '晚上' };
                    const currentValue = cell.querySelector('.task-preview')?.textContent || '';

                    // 找到对应的记录
                    const today = new Date().toISOString().split('T')[0];
                    const recordIndex = reportState.records.findIndex(r =>
                        r.type === 'reported' &&
                        r.slot === slot &&
                        getRecordDateKey(r) === today
                    );

                    if (recordIndex >= 0) {
                        showEditReportDialog(reportState.records[recordIndex], recordIndex);
                    } else {
                        // 如果没有记录，创建一个临时的进行编辑
                        showEditReportDialogForSlot(slot, slotLabels[slot] || slot, currentValue);
                    }
                };
            });
        }

        // 🔴 修复：每次渲染后重新绑定筛选器事件（因为 DOM 被替换后事件会丢失）
        bindFilterEvents();

        // 🔴 修复：筛选切换时同步刷新本月汇总
        if (reportState.showStats) {
            renderStatsPanel();
        }
    }

    /**
     * 🔴 显示编辑报数对话框
     */
    function showEditReportDialog(record, index) {
        const slotLabels = { morning: '上午', afternoon: '下午', evening: '晚上' };
        const slotLabel = slotLabels[record.slot] || record.slotLabel;
        const currentValue = record.taskCount || '';

        // 获取预设列表
        const taskPresets = getAllPresets();

        const presetButtonsHtml = taskPresets.map(p =>
            `<button type="button" class="ck-task-dialog-preset" data-preset="${p}">${p}</button>`
        ).join('');

        // 创建编辑对话框
        const overlay = document.createElement('div');
        overlay.className = 'ck-slot-choice-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        overlay.innerHTML = `
            <div style="background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 16px; padding: 24px; min-width: 400px; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <span style="font-size: 24px;">✏️</span>
                    <div>
                        <h3 style="margin: 0; color: #f1f5f9; font-size: 18px;">编辑${slotLabel}报数</h3>
                        <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">修改任务完成量</p>
                    </div>
                </div>
                <p style="color: #94a3b8; margin: 0 0 12px; font-size: 13px;">📋 快捷选择：</p>
                <div class="ck-task-dialog-presets" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
                    ${presetButtonsHtml}
                </div>
                <textarea id="ck-edit-report-input" rows="3" 
                    style="width: 100%; padding: 14px; border-radius: 10px; border: 2px solid rgba(99, 102, 241, 0.3); background: rgba(15, 23, 42, 0.8); color: #f1f5f9; font-size: 15px; resize: vertical; box-sizing: border-box; transition: border-color 0.2s;"
                    placeholder="例如：生成图片 ×5、制作视频 ×3...">${escapeHtml(currentValue)}</textarea>
                <div style="display: flex; gap: 12px; margin-top: 20px;">
                    <button class="ck-btn ghost" id="ck-edit-report-cancel" style="flex: 1; padding: 12px;">取消</button>
                    <button class="ck-btn primary" id="ck-edit-report-save" style="flex: 1; padding: 12px;">💾 保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = document.getElementById('ck-edit-report-input');

        // 预设按钮点击
        overlay.querySelectorAll('.ck-task-dialog-preset').forEach(btn => {
            btn.onclick = () => {
                const preset = btn.dataset.preset;
                const current = input.value.trim();
                input.value = current ? current + '、' + preset : preset;
                input.focus();
            };
        });
        const cancelBtn = document.getElementById('ck-edit-report-cancel');
        const saveBtn = document.getElementById('ck-edit-report-save');

        // 聚焦输入框
        setTimeout(() => input?.focus(), 100);

        // 关闭对话框
        const closeDialog = () => overlay.remove();

        cancelBtn.onclick = closeDialog;
        overlay.onclick = (e) => { if (e.target === overlay) closeDialog(); };

        // 保存
        saveBtn.onclick = async () => {
            const newValue = input.value.trim();
            if (!newValue) {
                input.focus();
                return;
            }

            // 更新本地记录
            reportState.records[index].taskCount = newValue;
            reportState.records[index].time = new Date().toISOString();
            saveRecords();

            // 更新今日状态
            if (reportState.todayStatus[record.slot]) {
                reportState.todayStatus[record.slot].taskCount = newValue;
                saveTodayStatus();
            }

            // 同步到 CheckinCore
            if (window.CheckinCore?.updateTaskCount) {
                await window.CheckinCore.updateTaskCount(record.slot, newValue);
            }

            // 刷新界面
            window.DailyCheckin?.render?.();
            renderRecordsPanel();

            showToast('✓ 报数已更新');
            closeDialog();
        };

        // ESC 关闭
        input.onkeydown = (e) => {
            if (e.key === 'Escape') closeDialog();
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveBtn.click();
            }
        };
    }

    /**
     * 🔴 显示编辑报数对话框（通过 slot 直接编辑）
     */
    function showEditReportDialogForSlot(slotKey, slotLabel, currentValue = '') {
        // 创建编辑对话框
        const overlay = document.createElement('div');
        overlay.className = 'ck-slot-choice-overlay';
        overlay.innerHTML = `
            <div class="ck-slot-choice-dialog" style="min-width: 320px;">
                <h3>✏️ 编辑${slotLabel}报数</h3>
                <div style="margin: 16px 0;">
                    <textarea id="ck-edit-report-input" rows="3" 
                        style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #f1f5f9; font-size: 14px; resize: vertical;"
                        placeholder="例如：生成图片 ×5、制作视频 ×3...">${escapeHtml(currentValue)}</textarea>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="ck-btn ghost" id="ck-edit-report-cancel" style="flex: 1;">取消</button>
                    <button class="ck-btn primary" id="ck-edit-report-save" style="flex: 1;">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = document.getElementById('ck-edit-report-input');
        const cancelBtn = document.getElementById('ck-edit-report-cancel');
        const saveBtn = document.getElementById('ck-edit-report-save');

        // 聚焦输入框
        setTimeout(() => input?.focus(), 100);

        // 关闭对话框
        const closeDialog = () => overlay.remove();

        cancelBtn.onclick = closeDialog;
        overlay.onclick = (e) => { if (e.target === overlay) closeDialog(); };

        // 保存
        saveBtn.onclick = async () => {
            const newValue = input.value.trim();
            if (!newValue) {
                input.focus();
                return;
            }

            // 直接调用 submitReport
            const report = { key: slotKey, slot: slotKey, label: slotLabel };
            await submitReport(report, newValue, false);

            closeDialog();
        };

        // ESC 关闭
        input.onkeydown = (e) => {
            if (e.key === 'Escape') closeDialog();
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveBtn.click();
            }
        };
    }

    /**
     * 绑定筛选器事件（解决 DOM 替换后事件丢失的问题）
     */
    function bindFilterEvents() {
        const filterSelect = document.getElementById('ck-report-team-filter');
        if (!filterSelect) return;

        // 先移除可能存在的旧事件监听器，避免重复绑定
        filterSelect.onchange = (e) => {
            console.log('[Report] 筛选团队:', e.target.value);
            reportState.filterTeam = e.target.value;
            renderRecordsPanel();
        };
    }

    /**
     * 🔴 切换统计面板显示
     */
    function toggleStats() {
        reportState.showStats = !reportState.showStats;
        const container = document.getElementById('ck-report-stats-container');
        const btn = document.getElementById('ck-toggle-stats');
        if (container) {
            container.style.display = reportState.showStats ? '' : 'none';
            if (reportState.showStats) {
                renderStatsPanel();
            }
        }
        if (btn) {
            btn.textContent = reportState.showStats ? '收起统计' : '展开统计';
        }
    }

    /**
     * 🔴 渲染统计汇总面板
     */
    function renderStatsPanel() {
        const container = document.getElementById('ck-report-stats-container');
        if (!container) return;

        const filterTeam = reportState.filterTeam || '';
        const stats = calculateTeamStats(filterTeam);

        if (stats.size === 0) {
            container.innerHTML = '<p class="empty-hint">暂无统计数据，请等待成员报数</p>';
            return;
        }

        // 收集所有任务类型
        const allTaskTypes = new Set();
        stats.forEach(teamData => {
            Object.keys(teamData.totals).forEach(task => allTaskTypes.add(task));
        });
        const taskTypes = Array.from(allTaskTypes).sort();

        // 时段标签
        const slotLabels = { morning: '上午', afternoon: '下午', evening: '晚上' };

        // 🔴 格式化周期显示
        const formatPeriod = (dateStr) => {
            const d = new Date(dateStr);
            return `${d.getMonth() + 1}月${d.getDate()}日`;
        };
        const periodLabel = stats.periodStart && stats.periodEnd
            ? `${formatPeriod(stats.periodStart)} ~ ${formatPeriod(stats.periodEnd)}`
            : '';

        // 生成统计表格
        let html = `
            <div class="ck-stats-period">
                <span>📅 统计周期：<strong>${periodLabel}</strong></span>
            </div>
            <div class="ck-stats-hint">
                <span>💡 提示：报数时使用格式 "任务类型 ×数量" 可自动统计（如：生成图片 ×5、制作视频 ×3）</span>
            </div>
            <table class="ck-stats-table">
                <thead>
                    <tr>
                        <th>团队</th>
                        <th>成员</th>
                        <th class="summary-col">报数汇总</th>
                        ${taskTypes.length > 0 ? taskTypes.map(t => `<th>${escapeHtml(t)}</th>`).join('') : ''}
                        <th>合计</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let grandTotal = {};
        taskTypes.forEach(t => { grandTotal[t] = 0; });

        const myName = getCurrentUserName();

        stats.forEach((teamData, teamName) => {
            const members = Array.from(teamData.members.entries());
            const teamRowSpan = members.length || 1;

            members.forEach(([userName, memberData], idx) => {
                // 🔴 当前提交人高亮
                const isCurrentUser = userName.trim() === myName.trim();
                const rowClass = isCurrentUser ? 'ck-current-user-row' : '';
                html += `<tr class="${rowClass}">`;
                if (idx === 0) {
                    html += `<td class="team-cell" rowspan="${teamRowSpan}">${escapeHtml(teamName)}</td>`;
                }
                html += `<td class="member-cell">${escapeHtml(userName)}</td>`;

                // 🔴 报数汇总列：显示各时段的原始内容和统计
                let summaryHtml = '<div class="member-summary">';

                // 显示各时段的报数内容
                const slotsContent = [];
                Object.entries(slotLabels).forEach(([slotKey, slotLabel]) => {
                    const content = memberData.slots[slotKey];
                    if (content) {
                        slotsContent.push(`<span class="slot-line"><b>${slotLabel}:</b> ${escapeHtml(content)}</span>`);
                    }
                });

                if (slotsContent.length > 0) {
                    summaryHtml += `<div class="slots-content">${slotsContent.join('')}</div>`;
                }

                // 显示统计汇总
                const taskSummary = Object.entries(memberData.tasks)
                    .filter(([_, count]) => count > 0)
                    .map(([task, count]) => `${escapeHtml(task)} ×${count}`)
                    .join('、');

                if (taskSummary) {
                    summaryHtml += `<div class="tasks-summary">📊 本月汇总：${taskSummary}</div>`;
                } else if (slotsContent.length > 0) {
                    summaryHtml += `<div class="tasks-summary no-stats">⚠️ 无法解析数量</div>`;
                }

                summaryHtml += '</div>';
                html += `<td class="summary-cell">${summaryHtml}</td>`;

                // 各任务类型数量
                let memberTotal = 0;
                taskTypes.forEach(task => {
                    const count = memberData.tasks[task] || 0;
                    memberTotal += count;
                    grandTotal[task] += count;
                    html += `<td class="count-cell ${count > 0 ? 'has-value' : ''}">${count || '-'}</td>`;
                });

                html += `<td class="total-cell">${memberTotal}</td>`;
                html += '</tr>';
            });
        });

        // 总计行
        let allTotal = Object.values(grandTotal).reduce((a, b) => a + b, 0);
        html += `
                <tr class="total-row">
                    <td colspan="3"><strong>总计</strong></td>
                    ${taskTypes.map(t => `<td class="count-cell total">${grandTotal[t] || 0}</td>`).join('')}
                    <td class="total-cell grand">${allTotal}</td>
                </tr>
            </tbody>
        </table>
        `;

        container.innerHTML = html;
    }

    /**
     * 显示提示
     */
    function showToast(message) {
        if (window.CheckinCore?.showToast) {
            window.CheckinCore.showToast(message);
        } else {
            console.log('[Report]', message);
        }
    }

    /**
     * 🔴 显示时段选择对话框
     */
    function showSlotChoiceDialog() {
        return new Promise((resolve) => {
            // 创建遮罩和对话框
            const overlay = document.createElement('div');
            overlay.className = 'ck-slot-choice-overlay';
            overlay.innerHTML = `
                <div class="ck-slot-choice-dialog">
                    <h3>📢 选择催报时段</h3>
                    <div class="ck-slot-choice-buttons">
                        <button class="ck-btn" data-slot="morning">🌅 上午</button>
                        <button class="ck-btn" data-slot="afternoon">🌤️ 下午</button>
                        <button class="ck-btn" data-slot="evening">🌙 晚上</button>
                    </div>
                    <button class="ck-btn ghost ck-slot-cancel">取消</button>
                </div>
            `;
            document.body.appendChild(overlay);

            // 样式
            const style = document.createElement('style');
            style.textContent = `
                .ck-slot-choice-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                .ck-slot-choice-dialog {
                    background: #1e293b;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 24px;
                    text-align: center;
                    min-width: 280px;
                }
                .ck-slot-choice-dialog h3 {
                    margin: 0 0 16px 0;
                    color: #f1f5f9;
                }
                .ck-slot-choice-buttons {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .ck-slot-choice-buttons .ck-btn {
                    flex: 1;
                    padding: 12px 16px;
                    font-size: 14px;
                }
                .ck-slot-cancel {
                    width: 100%;
                }
            `;
            document.head.appendChild(style);

            // 事件处理
            overlay.addEventListener('click', (e) => {
                const slotBtn = e.target.closest('[data-slot]');
                if (slotBtn) {
                    const slot = slotBtn.dataset.slot;
                    document.body.removeChild(overlay);
                    document.head.removeChild(style);
                    resolve(slot);
                    return;
                }
                if (e.target.closest('.ck-slot-cancel') || e.target === overlay) {
                    document.body.removeChild(overlay);
                    document.head.removeChild(style);
                    resolve(null);
                }
            });
        });
    }

    /**
     * 获取报数面板 HTML
     */
    function getRecordsPanelHtml() {
        return `
      <div class="ck-report-panel">
        <div class="ck-report-panel-header">
          <h3>📢 报数记录</h3>
          <div class="legend">
            <span class="legend-item reported"><span class="dot"></span>已报数</span>
            <span class="legend-item waiting"><span class="dot"></span>等待中</span>
            <span class="legend-item missed"><span class="dot"></span>未报数</span>
          </div>
        </div>
        <div class="ck-report-records-container" id="ck-report-records-container">
          <!-- 记录将通过 JS 渲染 -->
        </div>
      </div>
    `;
    }

    /**
     * 获取报数记录全页面 HTML（独立 tab 使用）
     */
    function getFullPageHtml() {
        // 获取当前时段信息
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const currentTime = hour * 60 + minute;

        let currentSlotLabel = '休息时间';
        let currentSlotClass = 'rest';
        // 上午: 11:50 - 13:30
        if (currentTime >= 11 * 60 + 50 && currentTime < 13 * 60 + 30) {
            currentSlotLabel = '上午报数时段';
            currentSlotClass = 'morning';
        }
        // 下午: 17:50 - 19:00
        else if (currentTime >= 17 * 60 + 50 && currentTime < 19 * 60) {
            currentSlotLabel = '下午报数时段';
            currentSlotClass = 'afternoon';
        }
        // 晚上: 23:00 - 02:00（跨天）
        else if (currentTime >= 23 * 60 || currentTime < 2 * 60) {
            currentSlotLabel = '晚上报数时段';
            currentSlotClass = 'evening';
        }

        const historyRange = Number(reportState.historyRangeDays) || 0;

        return `
      <div class="ck-report-full-page">
        <!-- 顶部状态栏 -->
        <div class="ck-report-header-card">
          <div class="header-left">
            <h2>📢 团队报数看板</h2>
            <p class="subtitle">实时同步所有成员的报数情况</p>
          </div>
          <div class="header-right">
            <div class="current-slot ${currentSlotClass}">
              <span class="slot-label">${currentSlotLabel}</span>
              <span class="current-time" id="ck-current-time">${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        <!-- 状态图例 -->
        <div class="ck-status-legend">
          <span class="legend-item">
            <span class="status-dot reported"></span>
            <span>已报数</span>
          </span>
          <span class="legend-item">
            <span class="status-dot pending"></span>
            <span>待报数</span>
          </span>
          <span class="legend-item">
            <span class="status-dot missing"></span>
            <span>超时未报</span>
          </span>
        </div>

        <!-- 主内容区 -->
        <div class="ck-report-main-content">
          <!-- 左侧：成员状态汇总 -->
          <div class="ck-report-summary-section">
            <div class="section-header">
              <h3>📊 今日报数状态</h3>
              <div class="filter-area" id="ck-filter-area">
                <!-- 筛选器将由 JS 渲染 -->
              </div>
            </div>
            <div class="ck-report-summary-container" id="ck-report-summary-container">
              <!-- 汇总表格将通过 JS 渲染 -->
            </div>
          </div>

          <!-- 右侧：报数记录流 -->
          <div class="ck-report-history-section">
            <div class="section-header">
              <h3>📜 报数动态</h3>
              <div class="ck-report-history-tools">
                <label>历史范围</label>
                <select id="ck-report-history-range">
                  <option value="7" ${historyRange === 7 ? 'selected' : ''}>近7天</option>
                  <option value="30" ${historyRange === 30 ? 'selected' : ''}>近30天</option>
                  <option value="90" ${historyRange === 90 ? 'selected' : ''}>近90天</option>
                  <option value="0" ${historyRange === 0 ? 'selected' : ''}>全部</option>
                </select>
                <button class="ck-btn" id="ck-report-history-refresh">刷新</button>
              </div>
            </div>
            <div class="ck-report-records-container" id="ck-report-records-container">
              <!-- 记录将通过 JS 渲染 -->
            </div>
          </div>
        </div>

        <!-- 🔴 统计汇总面板 -->
        <div class="ck-report-stats-section">
          <div class="section-header">
            <h3>📊 本月汇总</h3>
            <button class="ck-btn" id="ck-toggle-stats" onclick="window.CheckinReport?.toggleStats?.()">
              ${reportState.showStats ? '收起统计' : '展开统计'}
            </button>
          </div>
          <div class="ck-report-stats-container" id="ck-report-stats-container" style="${reportState.showStats ? '' : 'display:none;'}">
            <!-- 统计表格将通过 JS 渲染 -->
          </div>
        </div>

        <!-- 底部测试区（开发用） -->
        <div class="ck-report-test-section">
          <details class="ck-test-panel">
            <summary>🧪 开发测试</summary>
            <div class="ck-test-content">
              <div class="test-buttons">
                <button class="ck-btn" id="ck-test-trigger-morning">触发上午</button>
                <button class="ck-btn" id="ck-test-trigger-afternoon">触发下午</button>
                <button class="ck-btn" id="ck-test-trigger-evening">触发晚上</button>
                <button class="ck-btn primary" id="ck-test-simulate-report">模拟报数</button>
                <button class="ck-btn warning" id="ck-manual-remind" onclick="window.CheckinReport?.manualRemindUnreported?.()">📢 手动催报</button>
              </div>
            </div>
          </details>
        </div>
      </div>
    `;
    }

    /**
     * 手动触发报数（测试用）
     */
    function manualTrigger(slotKey) {
        const report = REPORT_TIMES.find(r => r.key === slotKey);
        if (report) {
            triggerReport(report);
        }
    }

    /**
     * 模拟收到别人的报数（单机测试用）
     * @param {string} userName - 模拟的用户名，如 "张三"
     * @param {string} slotKey - 时段 key，如 "morning"
     * @param {string} taskCount - 任务完成量，如 "完成5个视频"
     */
    function simulateOtherReport(userName = '张三', slotKey = 'morning', taskCount = '完成5个视频剪辑') {
        const slotLabels = { morning: '上午', afternoon: '下午', evening: '晚上' };
        const slotLabel = slotLabels[slotKey] || slotKey;

        // 获取当前用户的团队名
        const myTeamName = window.CheckinCore?.state?.profile?.teamName || 'default';

        const fakeRecord = {
            id: 'test-' + Date.now(),
            type: 'reported',
            slot: slotKey,
            slotLabel: slotLabel,
            userName: userName,
            teamName: myTeamName,  // 🔴 添加团队名
            time: new Date().toISOString(),
            taskCount: taskCount
        };

        console.log('[Report] 模拟收到报数:', fakeRecord);

        // 直接调用合并函数，模拟从远程收到记录
        mergeRemoteRecords([fakeRecord]);
    }

    /**
     * 🔴 手动催报：提醒指定时段未报数的人员
     * @param {string} slotKey - 可选，指定时段 morning/afternoon/evening，不传则弹出选择
     */
    async function manualRemindUnreported(slotKey = null) {
        const slotLabels = { morning: '上午', afternoon: '下午', evening: '晚上' };

        // 如果没有指定时段，弹出选择对话框
        if (!slotKey) {
            const choice = await showSlotChoiceDialog();
            if (!choice) return; // 用户取消
            slotKey = choice;
        }

        const currentSlotKey = slotKey;
        const currentSlotLabel = slotLabels[slotKey] || slotKey;

        // 获取今天的日期
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // 🔴 从 teamRecords 中提取团队成员
        const C = window.CheckinCore;
        const allMembers = new Map();

        if (C?.state?.teamRecords) {
            C.state.teamRecords.forEach(record => {
                const userName = (record.userName || '').trim();
                if (userName) {
                    allMembers.set(userName, true);
                }
            });
        }

        const teamMembers = Array.from(allMembers.keys());
        if (teamMembers.length === 0) {
            showToast('⚠️ 未获取到团队成员列表，请先在"组内汇总"中拉取团队数据');
            return;
        }

        // 筛选今天当前时段已报数的人员
        const reportedUsers = new Set();
        reportState.records.forEach(record => {
            if (record.type === 'reported') {
                const recordDate = getRecordDateKey(record);
                const recordSlot = record.slot || record.slotKey;
                if (recordDate === today && recordSlot === currentSlotKey) {
                    reportedUsers.add((record.userName || '').trim());
                }
            }
        });

        // 找出未报数的人员
        const unreportedMembers = teamMembers.filter(name => {
            return name && !reportedUsers.has(name);
        });

        if (unreportedMembers.length === 0) {
            showToast(`✅ ${currentSlotLabel}所有人员都已报数`);
            return;
        }

        // 🔴 显示人员选择对话框
        const selectedUsers = await showRemindUserSelectionDialog(unreportedMembers, currentSlotLabel);
        if (!selectedUsers || selectedUsers.length === 0) {
            return; // 用户取消或未选择任何人
        }

        // 发送催报通知
        try {
            const myName = getCurrentUserName();
            const myTeamName = window.CheckinCore?.state?.profile?.teamName || 'default';

            if (window.bridge?.checkin?.sendRemindMessage) {
                await window.bridge.checkin.sendRemindMessage({
                    type: 'remind',
                    slotKey: currentSlotKey,
                    slotLabel: currentSlotLabel,
                    targetUsers: selectedUsers,
                    senderName: myName,
                    teamName: myTeamName,
                    time: new Date().toISOString()
                });
                showToast(`📢 已向 ${selectedUsers.length} 人发送催报提醒`);
            } else {
                showToast(`📢 ${currentSlotLabel}未报数: ${selectedUsers.join('、')}`);
            }
        } catch (e) {
            console.error('[Report] 发送催报失败:', e);
            showToast(`⚠️ 发送催报失败: ${e.message}`);
        }
    }

    /**
     * 🔴 显示催报人员选择对话框
     */
    function showRemindUserSelectionDialog(users, slotLabel) {
        return new Promise((resolve) => {
            // 🔴 先移除可能存在的旧对话框
            document.querySelectorAll('.ck-remind-dialog-overlay').forEach(el => el.remove());

            const overlay = document.createElement('div');
            overlay.className = 'ck-remind-dialog-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;';

            const userCheckboxes = users.map((name, index) => `
                <label class="ck-remind-user-item">
                    <input type="checkbox" checked data-user="${escapeHtml(name)}" id="remind-user-${index}">
                    <span>${escapeHtml(name)}</span>
                </label>
            `).join('');

            overlay.innerHTML = `
                <div style="background: #1e293b; border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 24px; min-width: 360px; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                    <h3 style="margin: 0 0 12px 0; color: #f1f5f9; font-size: 18px;">📢 ${slotLabel}催报</h3>
                    <p style="color: #94a3b8; margin: 8px 0 16px; font-size: 14px;">以下 ${users.length} 人尚未报数，取消勾选可排除：</p>
                    <div class="ck-remind-user-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 16px;">
                        ${userCheckboxes}
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: space-between; margin-bottom: 16px;">
                        <button class="ck-btn ghost" id="ck-remind-select-all">全选</button>
                        <button class="ck-btn ghost" id="ck-remind-select-inverse">反选</button>
                        <button class="ck-btn ghost" id="ck-remind-select-none">全不选</button>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button class="ck-btn ghost" id="ck-remind-cancel" style="flex: 1;">取消</button>
                        <button class="ck-btn primary" id="ck-remind-send" style="flex: 1;">发送催报</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const closeDialog = (result) => {
                overlay.remove();
                resolve(result);
            };

            // 取消
            document.getElementById('ck-remind-cancel').onclick = () => closeDialog(null);
            overlay.onclick = (e) => { if (e.target === overlay) closeDialog(null); };

            // 全选
            document.getElementById('ck-remind-select-all').onclick = () => {
                overlay.querySelectorAll('.ck-remind-user-item input').forEach(cb => cb.checked = true);
            };

            // 全不选
            document.getElementById('ck-remind-select-none').onclick = () => {
                overlay.querySelectorAll('.ck-remind-user-item input').forEach(cb => cb.checked = false);
            };

            // 反选
            document.getElementById('ck-remind-select-inverse').onclick = () => {
                overlay.querySelectorAll('.ck-remind-user-item input').forEach(cb => cb.checked = !cb.checked);
            };

            // 发送
            document.getElementById('ck-remind-send').onclick = () => {
                const selected = [];
                overlay.querySelectorAll('.ck-remind-user-item input:checked').forEach(cb => {
                    selected.push(cb.dataset.user);
                });
                if (selected.length === 0) {
                    showToast('⚠️ 请至少选择一人');
                    return;
                }
                closeDialog(selected);
            };
        });
    }

    // 导出
    window.CheckinReport = {
        init,
        showReportDialog,
        closeReportDialog,
        submitReport,
        getRecordsPanelHtml,
        getFullPageHtml,
        renderRecordsPanel,
        restartFirebaseWatch,
        manualTrigger,
        simulateOtherReport, // 测试用：模拟收到别人报数
        toggleStats,         // 🔴 切换统计面板
        renderStatsPanel,    // 🔴 渲染统计面板
        manualRemindUnreported, // 🔴 手动催报
        state: reportState,
        settings: reportState.settings,
        loadSettingsForUser,
        applySettings,
        getDefaultPresets,
        getCustomPresets,
        getAllPresets,
        getSettingsSnapshot: () => {
            const snapshot = { ...reportState.settings };
            snapshot.customPresets = normalizePresetList(snapshot.customPresets);
            return snapshot;
        },
        saveSettings
    };

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
