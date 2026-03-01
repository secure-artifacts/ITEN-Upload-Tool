/**
 * 每日打卡 - 操作逻辑
 */
(function () {
    'use strict';
    const C = window.CheckinCore;
    const { state, AttendanceStatus, getActiveRecord, updateRecord, saveToStorage, formatDate, isPastDate, showToast, getDynamicSlotConfig } = C;

    // 打卡
    function handlePunch(slotKey) {
        if (!state.profile.name.trim()) { showToast('请先填写提交人姓名！'); return; }
        // 🔴 新增：组别必填
        if (!state.profile.teamName || !state.profile.teamName.trim()) {
            showToast('请先在设置中填写组别！');
            return;
        }
        // 🔴 新增：强制要求配置表格链接
        if (!state.sheetsUrl || !state.sheetsUrl.trim()) {
            showToast('请先在设置中配置 Google 表格链接！');
            return;
        }
        if (isPastDate(state.viewDate)) { showToast('过去日期请用补打卡'); return; }

        // 🔴 使用 getCurrentTime() 支持时间模拟测试
        const now = window.CheckinCore?.getCurrentTime?.() || new Date();
        const cfg = getDynamicSlotConfig().find(c => c.key === slotKey);

        // 检查开始时间（允许提前30分钟打卡）
        if (cfg?.startTime) {
            const [sh, sm] = cfg.startTime.split(':').map(Number);
            const start = new Date(now); start.setHours(sh, sm, 0, 0);
            const earlyAllowed = 30 * 60 * 1000; // 允许提前30分钟
            if (now < start - earlyAllowed) {
                showToast(`还没到打卡时间 (${cfg.startTime}前30分钟可打卡)`);
                return;
            }
        }

        const record = getActiveRecord();
        if (!record.slots[slotKey]) record.slots[slotKey] = { status: AttendanceStatus.NORMAL };
        record.slots[slotKey].time = now.toISOString();
        record.userName = state.profile.name;

        // 🔴 关键修改：如果用户已经选择了状态（非NORMAL），保留用户选择的状态
        const existingStatus = record.slots[slotKey].status;
        const userHasSelectedStatus = existingStatus &&
            existingStatus !== AttendanceStatus.NORMAL &&
            existingStatus !== 'normal';

        if (!userHasSelectedStatus) {
            // 用户没有手动选择状态，自动判断迟到/缺勤
            // 🔴 修复：非全时间人员使用 startTime 作为迟到判断基准
            const isFullTime = state.profile.mode === 'full_time';
            const baseTime = isFullTime ? (cfg?.deadline || cfg?.startTime) : (cfg?.startTime || cfg?.deadline);

            if (baseTime) {
                const [bh, bm] = baseTime.split(':').map(Number);
                const lateBaseline = new Date(now);
                lateBaseline.setHours(bh, bm + 10, 0, 0); // 10分钟宽限

                if (now > lateBaseline) {
                    const lateMinutes = (now - lateBaseline) / (1000 * 60);

                    // 检查是否缺勤：迟到超过2小时 或 过了时段结束时间
                    let isAbsent = lateMinutes >= 120;

                    if (!isAbsent && cfg.endTime) {
                        const [eh, em] = cfg.endTime.split(':').map(Number);
                        const endTime = new Date(now); endTime.setHours(eh, em, 0, 0);
                        if (now > endTime) {
                            isAbsent = true;
                        }
                    }

                    if (isAbsent) {
                        record.slots[slotKey].status = AttendanceStatus.ABSENT;
                    } else {
                        record.slots[slotKey].status = AttendanceStatus.LATE;
                    }
                }
            }
        }
        // 如果用户已选择状态，保持不变

        updateRecord(record);

        // 先渲染UI，再显示toast（showToast现在不会触发重新渲染）
        render();

        const finalStatus = record.slots[slotKey].status;
        const customName = record.slots[slotKey].customStatusName;
        let statusLabel = '';
        if (finalStatus === AttendanceStatus.ABSENT || finalStatus === 'absent') {
            statusLabel = '（缺勤）';
        } else if (finalStatus === AttendanceStatus.LATE || finalStatus === 'late') {
            statusLabel = '（迟到）';
        } else if (finalStatus === 'custom' && customName) {
            statusLabel = `（${customName}）`;
        } else if (finalStatus === AttendanceStatus.LEAVE || finalStatus === 'leave') {
            statusLabel = '（休假）';
        } else if (finalStatus === AttendanceStatus.SICK || finalStatus === 'sick') {
            statusLabel = '（病假）';
        }
        showToast(`${cfg?.label || slotKey} 打卡成功！${statusLabel}`);

        // Firebase 优先策略：打卡数据已在 updateRecord 中自动保存到 Firebase
        // Google Sheets 同步改为手动触发或定期执行，避免并发冲突
    }

    // 入眠打卡
    function handleSleepPunch() {
        if (!state.profile.name.trim()) { showToast('请先填写提交人姓名！'); return; }
        // 🔴 新增：组别必填
        if (!state.profile.teamName || !state.profile.teamName.trim()) {
            showToast('请先在设置中填写组别！');
            return;
        }
        // 🔴 新增：强制要求配置表格链接
        if (!state.sheetsUrl || !state.sheetsUrl.trim()) {
            showToast('请先在设置中配置 Google 表格链接！');
            return;
        }

        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();

        // 凌晨 0-5 点不算早睡，22:30 之前（且不是凌晨）才需要填写早睡原因
        const isEarlySleep = (h >= 5 && h < 22) || (h === 22 && m < 30);
        if (isEarlySleep && !state.earlySleepReason.trim()) {
            showToast('22:30前入眠请先填写早睡原因！');
            return;
        }

        let targetDate = formatDate(state.viewDate);

        // 凌晨5点前算前一天
        if (now.getHours() < 5) {
            const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
            targetDate = formatDate(yesterday);
        }

        // 使用 date + userName 组合匹配记录，避免修改他人数据
        // 🔴 修复：优先从 teamRecords（Firebase 实时监听）中获取数据
        const userName = state.profile.name;
        const teamName = state.profile.teamName || 'default';
        const allRecords = (state.teamRecords || []).filter(r => (r.teamName || 'default') === teamName);
        let record = allRecords.find(r => r.date === targetDate && r.userName === userName);
        if (!record) {
            record = {
                id: 'day-' + targetDate + '-' + userName,
                date: targetDate,
                userName: userName,
                teamName: state.profile.teamName || '',
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
        }

        const isLate = now.getHours() < 5 ? now.getHours() > 0 || now.getMinutes() > 10 : false;
        record.slots.sleep = {
            time: now.toISOString(),
            status: isLate ? AttendanceStatus.LATE : AttendanceStatus.NORMAL,
            notes: isEarlySleep ? state.earlySleepReason : ''
        };

        updateRecord(record);
        state.earlySleepReason = '';
        render();
        showToast(isEarlySleep ? '早睡打卡成功！好梦～ 😴' : '入眠打卡成功！晚安～ 🌙');

        // Firebase 优先策略：数据已自动保存到 Firebase
    }

    // 补打卡（手动打卡）
    function handlePatchPunch(slotKey, selectedStatusId, customStatusName = '') {
        const record = getActiveRecord();
        const dateStr = formatDate(state.viewDate);

        // 🔴 新增：组别必填
        if (!state.profile.teamName || !state.profile.teamName.trim()) {
            showToast('请先在设置中填写组别！');
            return false;
        }
        // 🔴 新增：强制要求配置表格链接
        if (!state.sheetsUrl || !state.sheetsUrl.trim()) {
            showToast('请先在设置中配置 Google 表格链接！');
            return false;
        }

        if (!state.manualNote.trim()) {
            showToast('手动打卡必须填写说明！'); return false;
        }

        const [h, m] = state.manualTime.split(':').map(Number);
        const punchDate = new Date(dateStr); punchDate.setHours(h, m, 0, 0);
        if (punchDate > new Date()) { showToast('不能打未来的卡！'); return false; }

        if (!record.slots[slotKey]) record.slots[slotKey] = { status: AttendanceStatus.NORMAL };

        // 🔴 记录两个时间：实际操作时间 + 手动填写的时间
        record.slots[slotKey].actualPunchTime = new Date().toISOString(); // 实际点击按钮的时间
        record.slots[slotKey].time = punchDate.toISOString(); // 手动填写的时间
        record.slots[slotKey].isManual = true;
        if (state.manualNote) record.slots[slotKey].notes = state.manualNote;

        // 🔴 修复：优先使用用户手动选择的状态
        if (selectedStatusId === 'custom') {
            // 🔴 处理自定义状态
            record.slots[slotKey].status = AttendanceStatus.CUSTOM;
            record.slots[slotKey].customStatusName = customStatusName || '自定义';
        } else if (selectedStatusId) {
            const selectedOpt = state.statusOptions.find(o => o.id === selectedStatusId);
            if (selectedOpt) {
                record.slots[slotKey].status = selectedOpt.value;
                record.slots[slotKey].customStatusName = '';
            }
        } else {
            // 没有选择状态时，自动判断迟到
            const cfg = getDynamicSlotConfig().find(c => c.key === slotKey);
            if (cfg?.deadline) {
                const [dh, dm] = cfg.deadline.split(':').map(Number);
                const deadline = new Date(dateStr); deadline.setHours(dh, dm + 10, 0, 0);
                if (punchDate > deadline) record.slots[slotKey].status = AttendanceStatus.LATE;
            }
        }

        updateRecord(record);
        state.editingSlot = null;
        state.manualTime = '';
        state.manualNote = '';
        render();
        showToast('补打卡成功！');
        return true;
    }

    // 重置打卡
    function resetPunch(slotKey) {
        const record = getActiveRecord();
        if (slotKey === 'sleep') {
            record.slots.sleep = null;
        } else if (record.slots[slotKey]) {
            // 完全重置该时段的所有字段
            record.slots[slotKey] = {
                status: AttendanceStatus.NORMAL,
                time: null,
                isManual: false,
                notes: '',
                taskCount: '',
                customStatusName: ''
            };
        }
        updateRecord(record);
        render();
    }

    // 更新状态
    function updateSlotStatus(slotKey, optionId) {
        const record = getActiveRecord();
        const opt = state.statusOptions.find(o => o.id === optionId);
        if (!record.slots[slotKey]) record.slots[slotKey] = {};
        record.slots[slotKey].status = opt?.value || AttendanceStatus.NORMAL;
        if (opt?.value === AttendanceStatus.CUSTOM) {
            record.slots[slotKey].customStatusName = opt.label;
        } else {
            record.slots[slotKey].customStatusName = '';
        }
        updateRecord(record);
        render();
    }

    // 更新备注
    function updateSlotNotes(slotKey, notes) {
        const record = getActiveRecord();
        if (!record.slots[slotKey]) record.slots[slotKey] = { status: AttendanceStatus.NORMAL };
        record.slots[slotKey].notes = notes;
        updateRecord(record);
    }

    // 入眠备注
    function updateSleepNotes(notes) {
        const record = getActiveRecord();
        if (record.slots.sleep && typeof record.slots.sleep !== 'string') {
            record.slots.sleep.notes = notes;
            updateRecord(record);
        }
    }

    // 添加琐事
    function addCustomActivity() {
        if (!state.newActivityTitle.trim()) { showToast('请输入离开原因'); return; }
        if (!state.activityLeaveTime) { showToast('请选择离开时间'); return; }
        if (!state.activityReturnTime) { showToast('请选择回来时间'); return; }

        // 计算时长
        const [lh, lm] = state.activityLeaveTime.split(':').map(Number);
        const [rh, rm] = state.activityReturnTime.split(':').map(Number);
        const leaveMinutes = lh * 60 + lm;
        const returnMinutes = rh * 60 + rm;
        const dur = returnMinutes - leaveMinutes;

        if (dur <= 0) { showToast('回来时间必须晚于离开时间'); return; }

        const record = getActiveRecord();
        if (!record.slots.customActivities) record.slots.customActivities = [];
        record.slots.customActivities.push({
            id: Date.now().toString(),
            title: state.newActivityTitle,
            leaveTime: state.activityLeaveTime,
            returnTime: state.activityReturnTime,
            durationMinutes: dur,
            timestamp: new Date().toISOString()
        });

        updateRecord(record);
        state.newActivityTitle = '';
        state.activityLeaveTime = '';
        state.activityReturnTime = '';
        render();
        showToast(`离开记录已添加 (${dur}分钟)`);
    }

    // 删除琐事
    function removeCustomActivity(actId) {
        const record = getActiveRecord();
        if (record.slots.customActivities) {
            record.slots.customActivities = record.slots.customActivities.filter(a => a.id !== actId);
            updateRecord(record);
            render();
        }
    }

    // 添加状态选项
    function addStatusOption() {
        if (!state.newOptionLabel.trim()) return;
        state.statusOptions.push({
            id: 'custom_' + Date.now(), value: AttendanceStatus.CUSTOM, label: state.newOptionLabel.trim(), color: 'blue', isSystem: false
        });
        state.newOptionLabel = '';
        saveToStorage();
        render();
    }

    // 删除状态选项
    function removeStatusOption(optId) {
        state.statusOptions = state.statusOptions.filter(o => o.id !== optId || o.isSystem);
        saveToStorage();
        render();
    }

    // 日期导航
    function changeViewDate(days) {
        const newDate = new Date(state.viewDate);
        newDate.setDate(newDate.getDate() + days);
        if (newDate > new Date()) return;
        state.viewDate = newDate;
        render();
    }

    // 切换主题
    function toggleTheme() {
        state.isDark = !state.isDark;
        saveToStorage();
        render();
    }

    // 导出
    window.CheckinActions = {
        handlePunch, handleSleepPunch, handlePatchPunch, resetPunch,
        updateSlotStatus, updateSlotNotes, updateSleepNotes,
        addCustomActivity, removeCustomActivity, addStatusOption, removeStatusOption,
        changeViewDate, toggleTheme
    };
})();
