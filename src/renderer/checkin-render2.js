/**
 * 每日打卡 - UI 渲染 (第2部分: 琐事+入眠+侧边栏+设置)
 */
(function () {
  'use strict';
  const C = window.CheckinCore;
  const { state, formatTime, AttendanceStatus, getActiveRecord, calculateDuration, calculateTargetHours, getStats, formatDate, isToday } = C;

  function getTeamOverviewRecords() {
    return state.teamRecords || [];
  }

  /**
   * 🔴 公共函数：获取去重后的用户记录（仅 Firebase + 当前组）
   * 同日期多条记录时，使用最新的（按 updatedAt）
   */
  function getMergedUserRecords(userName, teamName) {
    const normalizedTeam = (teamName || state.profile.teamName || 'default').trim() || 'default';
    const rawRecords = (state.teamRecords || []).filter(record => {
      if (userName && record.userName !== userName) return false;
      return (record.teamName || 'default') === normalizedTeam;
    });

    // 按 updatedAt 降序排序，取每个日期最新的记录
    const recordsByDate = new Map();
    rawRecords
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .forEach(record => {
        if (!recordsByDate.has(record.date)) {
          recordsByDate.set(record.date, record);
        }
      });
    return Array.from(recordsByDate.values());
  }

  /**
   * 🔴 公共函数：获取合并后的单条记录
   */
  function getMergedRecord(userName, dateStr, teamName) {
    const records = getMergedUserRecords(userName, teamName);
    return records.find(r => r.date === dateStr) || null;
  }

  function parseTeamMemberKey(memberKey) {
    if (!memberKey) return { name: '', team: '' };
    const splitIndex = memberKey.indexOf('::');
    if (splitIndex === -1) return { name: memberKey, team: '' };
    return {
      team: memberKey.slice(0, splitIndex),
      name: memberKey.slice(splitIndex + 2)
    };
  }

  // 🔴 已移除：旧的中途离开模块，功能已整合到每个时段的"临时外出"按钮中
  function renderActivities(record) {
    return ''; // 功能已合并到临时外出
  }

  function renderSleepCard(record) {
    const sleep = record.slots.sleep;
    const isDone = sleep && (typeof sleep === 'string' || sleep.time);
    const time = typeof sleep === 'string' ? sleep : sleep?.time;
    const status = typeof sleep === 'string' ? AttendanceStatus.NORMAL : sleep?.status;
    const isLate = status === AttendanceStatus.LATE;
    const isEditing = state.editingSlot === 'sleep';

    const isEarlySleepTime = (timeValue) => {
      if (!timeValue) return false;
      const dt = new Date(timeValue);
      const hh = dt.getHours();
      const mm = dt.getMinutes();
      return (hh >= 5 && hh < 22) || (hh === 22 && mm < 30);
    };

    // 检查当前时间是否需要填写早睡原因（5:00-22:30，凌晨不算）
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const isEarlySleep = (h >= 5 && h < 22) || (h === 22 && m < 30);
    let sleepLabel = '';

    if (isDone) {
      if (status === AttendanceStatus.LATE) {
        sleepLabel = '熬夜';
      } else if (status !== AttendanceStatus.NORMAL) {
        if (status === AttendanceStatus.LEAVE) sleepLabel = '休假';
        else if (status === AttendanceStatus.SICK) sleepLabel = '身体抱恙';
        else if (status === AttendanceStatus.CUSTOM) sleepLabel = sleep?.customStatusName || '自定义';
        else sleepLabel = status;
      } else {
        sleepLabel = isEarlySleepTime(time) ? '早睡' : '正常睡';
      }
    }

    return `
      <section class="ck-sleep-card ${state.isDark ? 'dark' : ''} ${isDone ? (isLate ? 'late' : 'done') : ''}">
        <div class="ck-sleep-icon">🌙</div>
        <div class="ck-sleep-info">
          <h4>入眠休息记录</h4>
          <p>22:30 前需填写早睡说明，00:10 后记为晚睡</p>
          ${!isDone && isEarlySleep ? `
            <input type="text" class="ck-sleep-note" placeholder="早睡原因（必填）..." id="ck-early-sleep-reason" value="${state.earlySleepReason || ''}">
          ` : ''}
        </div>
        <div class="ck-sleep-action">
          ${isDone ? `
            <div class="ck-punch-result ${isLate ? 'late' : 'success'}">
              <span class="icon">${isLate ? '🦉' : '✓'}</span>
              <span class="label">${sleepLabel || (isLate ? '熬夜' : '正常睡')}</span>
              <span class="time">${formatTime(time)}</span>
              ${typeof sleep !== 'string' && sleep?.notes ? `<span class="note-badge">📝</span>` : ''}
              <button class="ck-reset-btn" data-slot="sleep">↻</button>
            </div>
          ` : isEditing ? `
            <div class="ck-manual-input">
              <input type="time" id="ck-manual-time-sleep" value="${state.manualTime || '23:30'}">
              <button class="ck-btn primary" data-confirm="sleep">确认</button>
              <button class="ck-btn" data-cancel>×</button>
            </div>
            <input type="text" class="ck-manual-note" placeholder="手动打卡说明（必填）..." id="ck-manual-note-sleep">
          ` : `
            <button class="ck-btn primary" id="ck-sleep-punch">${isEarlySleep ? '早睡' : '晚安'}</button>
            <button class="ck-btn" id="ck-sleep-manual">手动</button>
          `}
        </div>
      </section>`;
  }

  function renderSidebar(record) {
    // 🔴 修复：优先从 teamRecords（Firebase 实时监听）中获取数据
    const userName = state.profile.name || '';
    const teamName = state.profile.teamName || 'default';
    const userRecords = (state.teamRecords || []).filter(r =>
      r.userName === userName && (r.teamName || 'default') === teamName
    );

    let normalCount = 0, lateCount = 0, absentCount = 0, stayUpCount = 0, taskFillCount = 0;

    userRecords.forEach(r => {
      const slots = r.slots || {};
      ['morning', 'afternoon', 'evening'].forEach(key => {
        const slot = slots[key];
        if (slot?.time) {
          if (slot.status === AttendanceStatus.LATE) lateCount++;
          else if (slot.status === AttendanceStatus.ABSENT) absentCount++;
          else normalCount++;

          if (slot.taskCount && slot.taskCount.trim()) taskFillCount++;
        }
      });

      // 入眠统计
      const sleepSlot = slots.sleep;
      if (sleepSlot?.time && sleepSlot.status === AttendanceStatus.LATE) {
        stayUpCount++;
      }
    });

    return `
      <aside class="ck-sidebar ${state.isDark ? 'dark' : ''}">
        <!-- 打卡汇总 -->
        <div class="ck-cumulative-card">
          <h3>📊 ${userName || '我'}的打卡汇总</h3>
          <div class="stats-grid stats-grid-5">
            <div class="stat success"><p class="label">正常</p><p class="value">${normalCount}</p></div>
            <div class="stat warning"><p class="label">迟到</p><p class="value">${lateCount}</p></div>
            <div class="stat danger"><p class="label">缺勤</p><p class="value">${absentCount}</p></div>
            <div class="stat purple"><p class="label">熬夜</p><p class="value">${stayUpCount}</p></div>
            <div class="stat blue"><p class="label">报数</p><p class="value">${taskFillCount}</p></div>
          </div>
        </div>
      </aside>`;
  }

  function renderHistory() {
    const now = new Date();
    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();
    const today = formatDate(new Date());

    // 计算日期范围：上月23日到本月22日（如果当天不到22日则只显示到今天）
    const currentDay = now.getDate();
    const startDate = new Date(year, month - 1, 23);
    const endDay = (year === now.getFullYear() && month === now.getMonth() && currentDay < 22) ? currentDay : 22;
    const endDate = new Date(year, month, endDay);

    // 生成日期列表
    const dateList = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateList.push(new Date(d));
    }

    // 格式化日期范围显示
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const endMonth = endDate.getMonth() + 1;
    const rangeLabel = `${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`;

    const statusLabelMap = new Map(state.statusOptions.map(o => [o.value, o.label]));

    function getStatusLabel(status, slot) {
      if (status === AttendanceStatus.CUSTOM) {
        return slot?.customStatusName || statusLabelMap.get(status) || '自定义';
      }
      // 🔴 修复：缺勤状态显示中文
      if (status === AttendanceStatus.ABSENT || status === 'absent') {
        return '缺勤';
      }
      if (status === AttendanceStatus.LATE || status === 'late') {
        return '迟到';
      }
      return statusLabelMap.get(status) || status || '正常上线';
    }

    function getStatusClass(status) {
      switch (status) {
        case AttendanceStatus.LATE:
        case 'late':
          return 'late';
        case AttendanceStatus.ABSENT:
        case 'absent':
          return 'absent';  // 🔴 缺勤状态使用红色
        case AttendanceStatus.SICK:
          return 'sick';
        case AttendanceStatus.LEAVE:
          return 'leave';
        case AttendanceStatus.CUSTOM:
          return 'custom';
        default:
          return 'normal';
      }
    }

    function isEarlySleepTime(timeValue) {
      if (!timeValue) return false;
      const dt = new Date(timeValue);
      const h = dt.getHours();
      const m = dt.getMinutes();
      if (h >= 0 && h < 5) return false;
      return h < 22 || (h === 22 && m < 30);
    }

    function getSlotStatus(slot) {
      if (!slot) return { text: '未打卡', cls: 'empty' };
      const time = typeof slot === 'string' ? slot : slot?.time;
      const status = typeof slot === 'string' ? AttendanceStatus.NORMAL : slot?.status || AttendanceStatus.NORMAL;
      const displayLabel = slot?.displayLabel;
      const displayClass = slot?.displayClass;
      const isManual = slot?.isManual;
      if (displayLabel) return { text: displayLabel, cls: isManual ? 'manual' : (displayClass || getStatusClass(status)) };
      if (!time && status === AttendanceStatus.NORMAL) return { text: '未打卡', cls: 'empty' };
      // 🔴 手动打卡显示黄色
      return { text: getStatusLabel(status, slot), cls: isManual ? 'manual' : getStatusClass(status) };
    }

    function getSleepStatus(slot) {
      if (!slot) return { text: '未休息', cls: 'empty' };
      const time = typeof slot === 'string' ? slot : slot?.time;
      const status = typeof slot === 'string' ? AttendanceStatus.NORMAL : slot?.status || AttendanceStatus.NORMAL;
      const displayLabel = slot?.displayLabel;
      const displayClass = slot?.displayClass;
      if (displayLabel) return { text: displayLabel, cls: displayClass || getStatusClass(status) };
      if (!time && status === AttendanceStatus.NORMAL) return { text: '未休息', cls: 'empty' };
      if (status === AttendanceStatus.LATE) return { text: '熬夜', cls: 'sleep-late' };
      if (status === AttendanceStatus.LEAVE || status === AttendanceStatus.SICK || status === AttendanceStatus.CUSTOM) {
        return { text: getStatusLabel(status, slot), cls: getStatusClass(status) };
      }
      const isEarly = isEarlySleepTime(time);
      return { text: isEarly ? '早睡' : '正常睡', cls: isEarly ? 'sleep-early' : 'sleep-normal' };
    }

    // 生成每日卡片
    // 🔴 修复：使用公共函数获取合并后的记录
    const myName = state.profile.name;
    const teamName = state.profile.teamName || 'default';
    const allRecords = getMergedUserRecords(myName, teamName);

    const cards = dateList.map(date => {
      const ds = formatDate(date);
      const r = allRecords.find(x => x.date === ds);
      const isToday = ds === today;
      const isFuture = date > now;
      const dur = r ? calculateDuration(r) : 0;
      const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;

      const morning = getSlotStatus(r?.slots?.morning);
      const afternoon = getSlotStatus(r?.slots?.afternoon);
      const evening = getSlotStatus(r?.slots?.evening);
      const sleep = getSleepStatus(r?.slots?.sleep);

      return `
        <div class="ck-day-card ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''} ${r ? 'has-record' : ''}" data-date="${ds}">
          <div class="day-header">
            <span class="day-date">${dateLabel}</span>
            ${r ? `<span class="day-hours">${dur.toFixed(1)}h</span>` : ''}
          </div>
          <div class="day-slots">
            <span class="slot-item ${morning.cls}" title="上午">${morning.text}</span>
            <span class="slot-item ${afternoon.cls}" title="下午">${afternoon.text}</span>
            <span class="slot-item ${evening.cls}" title="晚上">${evening.text}</span>
            <span class="slot-item ${sleep.cls}" title="休息">${sleep.text}</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="ck-history ${state.isDark ? 'dark' : ''}">
        <div class="ck-history-header">
          <div class="ck-history-range-nav">
            <button id="ck-prev-month" class="ck-btn-icon">◀</button>
            <span>📅 ${year} 年 ${month + 1} 月 · ${rangeLabel}</span>
            <button id="ck-next-month" class="ck-btn-icon">▶</button>
          </div>
        </div>
        <div class="ck-day-grid">${cards}</div>
      </div>
      ${renderHistoryDetail()}`;
  }

  function renderHistoryDetail() {
    if (!state.historyDetailDate) return '';

    const dateStr = state.historyDetailDate;
    let memberName = state.historyDetailMember || state.profile.name || '';

    // 🔴 修复：使用合并后的记录，避免重复数据问题
    const teamName = state.profile.teamName || 'default';
    let record = memberName ? getMergedRecord(memberName, dateStr, teamName) : null;

    if (!record) {
      // 如果没有指定成员，尝试查找任意匹配的记录
      const allMerged = getMergedUserRecords('', teamName);
      record = allMerged.find(r => r.date === dateStr);
      if (record && !memberName) memberName = record.userName || '';
    }

    if (!record) {
      return `
        <div class="ck-modal-overlay" id="ck-history-detail-overlay">
          <div class="ck-modal ${state.isDark ? 'dark' : ''}">
            <div class="ck-modal-header">
              <h3>${memberName ? memberName + ' - ' : ''}${dateStr}</h3>
              <button id="ck-close-history-detail">×</button>
            </div>
            <div class="ck-modal-body">
              <p class="empty-hint">该日期暂无打卡记录</p>
            </div>
          </div>
        </div>`;
    }

    const dur = calculateDuration(record);
    const slots = record.slots || {};

    const statusLabelMap = new Map(state.statusOptions.map(o => [o.value, o.label]));

    const formatStatusText = (slot) => {
      const status = slot?.status || AttendanceStatus.NORMAL;
      const hasTime = !!slot?.time;
      const displayLabel = slot?.displayLabel;
      if (displayLabel) return displayLabel;
      if (!hasTime && status === AttendanceStatus.NORMAL) return '';
      if (status === AttendanceStatus.LATE) return '迟到';
      if (status === AttendanceStatus.LEAVE) return '休假';
      if (status === AttendanceStatus.SICK) return '身体抱恙';
      if (status === AttendanceStatus.CUSTOM) return slot?.customStatusName || statusLabelMap.get(status) || '自定义';
      return hasTime ? (statusLabelMap.get(status) || '正常上线') : '';
    };

    const sleepStatusLabel = () => {
      const sleep = slots.sleep;
      if (!sleep) return '';
      if (sleep?.displayLabel) return sleep.displayLabel;
      const status = typeof sleep === 'string' ? AttendanceStatus.NORMAL : sleep?.status || AttendanceStatus.NORMAL;
      const timeValue = typeof sleep === 'string' ? sleep : sleep?.time;
      if (!timeValue) return '';
      if (status === AttendanceStatus.LATE) return '熬夜';
      if (status !== AttendanceStatus.NORMAL) {
        if (status === AttendanceStatus.LEAVE) return '休假';
        if (status === AttendanceStatus.SICK) return '身体抱恙';
        if (status === AttendanceStatus.CUSTOM) return sleep?.customStatusName || '自定义';
        return status;
      }
      const dt = new Date(timeValue);
      const h = dt.getHours();
      const m = dt.getMinutes();
      const isEarly = (h >= 5 && h < 22) || (h === 22 && m < 30);
      return isEarly ? '早睡' : '正常睡';
    };

    const renderTaskCount = (slot) => {
      const raw = slot?.taskCount;
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        return '<em class="no-data">未填写完成量</em>';
      }
      return `📋 ${raw}`;
    };

    return `
      <div class="ck-modal-overlay" id="ck-history-detail-overlay">
        <div class="ck-modal ${state.isDark ? 'dark' : ''}">
          <div class="ck-modal-header">
            <h3>📋 ${memberName ? memberName + ' - ' : ''}${dateStr}</h3>
            <button id="ck-close-history-detail">×</button>
          </div>
          <div class="ck-modal-body">
            <div class="ck-detail-summary">
              <div class="stat"><span class="label">在线时长</span><span class="value">${dur.toFixed(1)}h</span></div>
            </div>
            <div class="ck-detail-slots">
              <div class="slot-item ${slots.morning?.time ? 'done' : ''} ${slots.morning?.isManual ? 'manual' : ''}" ${slots.morning?.isManual && slots.morning?.actualPunchTime ? `title="实际操作时间: ${formatTime(slots.morning.actualPunchTime)}"` : ''}>
                <span class="icon">🌅</span>
                <span class="label">上午</span>
                <span class="time">${slots.morning?.time ? formatTime(slots.morning.time) : '--:--'}</span>
                <span class="status ${slots.morning?.status || ''}">${formatStatusText(slots.morning)}</span>
                ${slots.morning?.isManual ? `<span class="actual-time">（手动）</span>` : ''}
                <span class="task-count">${renderTaskCount(slots.morning)}</span>
              </div>
              <div class="slot-item ${slots.afternoon?.time ? 'done' : ''} ${slots.afternoon?.isManual ? 'manual' : ''}" ${slots.afternoon?.isManual && slots.afternoon?.actualPunchTime ? `title="实际操作时间: ${formatTime(slots.afternoon.actualPunchTime)}"` : ''}>
                <span class="icon">☀️</span>
                <span class="label">下午</span>
                <span class="time">${slots.afternoon?.time ? formatTime(slots.afternoon.time) : '--:--'}</span>
                <span class="status ${slots.afternoon?.status || ''}">${formatStatusText(slots.afternoon)}</span>
                ${slots.afternoon?.isManual ? `<span class="actual-time">（手动）</span>` : ''}
                <span class="task-count">${renderTaskCount(slots.afternoon)}</span>
              </div>
              <div class="slot-item ${slots.evening?.time ? 'done' : ''} ${slots.evening?.isManual ? 'manual' : ''}" ${slots.evening?.isManual && slots.evening?.actualPunchTime ? `title="实际操作时间: ${formatTime(slots.evening.actualPunchTime)}"` : ''}>
                <span class="icon">🌆</span>
                <span class="label">晚上</span>
                <span class="time">${slots.evening?.time ? formatTime(slots.evening.time) : '--:--'}</span>
                <span class="status ${slots.evening?.status || ''}">${formatStatusText(slots.evening)}</span>
                ${slots.evening?.isManual ? `<span class="actual-time">（手动）</span>` : ''}
                <span class="task-count">${renderTaskCount(slots.evening)}</span>
              </div>
              ${slots.sleep ? `
                <div class="slot-item ${slots.sleep ? 'done' : ''}">
                  <span class="icon">🌙</span>
                  <span class="label">入眠</span>
                  <span class="time">${formatTime(typeof slots.sleep === 'string' ? slots.sleep : slots.sleep.time)}</span>
                  <span class="status ${typeof slots.sleep === 'string' ? '' : slots.sleep?.status || ''}">${sleepStatusLabel()}</span>
                </div>
              ` : ''}
            </div>
            ${(slots.customActivities?.length > 0) ? `
              <div class="ck-detail-activities">
                <h4>🏠 琐事记录</h4>
                ${slots.customActivities.map(a => `
                  <div class="activity-item">
                    <span>${a.title}</span>
                    <span class="dur">${a.durationMinutes}分钟</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>`;
  }

  function renderSettings() {
    if (!state.showSettings) return '';
    return `
      <div class="ck-modal-overlay" id="ck-settings-overlay">
        <div class="ck-modal ${state.isDark ? 'dark' : ''}">
          <div class="ck-modal-header">
            <h3>设置</h3>
            <button id="ck-close-settings">×</button>
          </div>
          <div class="ck-modal-body">
            <!-- 个人资料 -->
            <section class="ck-settings-section">
              <p class="section-title">个人资料</p>
              <div class="field">
                <label>组别 <span class="hint required">(必选)</span>${state.profile.teamName ? `<span class="ck-team-current">当前：${state.profile.teamName}</span>` : ''}</label>
                ${(() => {
        const presetTeams = ['视频/生图组', '作图组'];
        const teamName = state.profile.teamName || '';
        const isCustomTeam = teamName && !presetTeams.includes(teamName);
        return `
                <select id="ck-team-name">
                  <option value="" ${!teamName ? 'selected' : ''}>-- 请选择组别 --</option>
                  <option value="视频/生图组" ${teamName === '视频/生图组' ? 'selected' : ''}>视频/生图组</option>
                  <option value="作图组" ${teamName === '作图组' ? 'selected' : ''}>作图组</option>
                  <option value="__custom__" ${isCustomTeam ? 'selected' : ''}>➕ 添加组别...</option>
                </select>
                <input type="text" id="ck-custom-team-name" placeholder="输入自定义组别名称" 
                  style="display: ${isCustomTeam ? 'block' : 'none'}; margin-top: 8px;"
                  value="${isCustomTeam ? teamName : ''}">
              `;
      })()}
              </div>
              <div class="field"><label>工作模式</label>
                <div class="mode-grid">
                  ${[
        { id: 'full_time', label: '全天人员', icon: '👤' },
        { id: 'working', label: '上班人员', icon: '💼' },
        { id: 'student', label: '上学人员', icon: '🎓' },
        { id: 'other', label: state.profile.customModeLabel || '自定义', icon: '⚡' }
      ].map(m => `<button class="mode-btn ${state.profile.mode === m.id ? 'active' : ''}" data-mode="${m.id}">${m.icon} ${m.label}</button>`).join('')}
                </div>
                ${state.profile.mode === 'other' ? `
                  <div class="custom-mode-input-wrapper">
                    <label>输入自定义类型名称</label>
                    <input type="text" id="ck-custom-mode" class="custom-mode-input" placeholder="例如：自由职业" value="${state.profile.customModeLabel || ''}">
                  </div>
                ` : ''}
              </div>
            </section>

            <!-- 目标时段 -->
            <section class="ck-settings-section">
              <p class="section-title">目标时段 <span class="required">*</span></p>
              <div class="periods-list" id="ck-periods-list">
                ${state.profile.targetPeriods.map((p, i) => `
                  <div class="period-row" data-index="${i}">
                    ${state.profile.mode !== 'full_time' ? `<input type="text" class="period-name" value="${p.name || ''}" placeholder="时段${i + 1}">` : ''}
                    <input type="time" class="period-start" value="${p.start}">
                    <span>~</span>
                    <input type="time" class="period-end" value="${p.end}">
                    <button class="remove-period">🗑</button>
                  </div>
                `).join('')}
              </div>
              <div class="ck-period-actions">
                <button class="ck-btn" id="ck-reset-periods">↺ 重置当前模式时段</button>
                <button class="ck-btn add-period" id="ck-add-period">+ 增加时段</button>
              </div>
            </section>

            <!-- 状态标签 -->
            <section class="ck-settings-section">
              <p class="section-title">打卡状态标签</p>
              <div class="status-list">
                ${state.statusOptions.map(o => `
                  <div class="status-item">
                    <span class="dot ${o.color}"></span>
                    <span class="label">${o.label}</span>
                    ${o.isSystem ? '<span class="sys">系统</span>' : `<button class="remove-status" data-id="${o.id}">🗑</button>`}
                  </div>
                `).join('')}
              </div>
              <div class="add-status-row">
                <input type="text" id="ck-new-status" placeholder="添加新标签 (如:出差)" value="${state.newOptionLabel}">
                <button class="ck-btn primary" id="ck-add-status">添加</button>
              </div>
            </section>

            <!-- Google 表格同步 -->
            <section class="ck-settings-section sheets">
              <p class="section-title">☁️ Google 表格同步</p>
              <div class="ck-auth-status">
                <span class="icon">🔗</span>
                <span>使用主程序的 Google 认证</span>
                <span class="status" id="ck-auth-status-badge">检测中...</span>
              </div>
              <div class="field"><label>表格链接</label><input type="text" id="ck-sheets-url" value="${state.sheetsUrl}" placeholder="粘贴 Google Sheets 链接..."></div>
              <div class="field"><label>工作表名称</label><input type="text" id="ck-sheet-name" value="${state.sheetName}" placeholder="每日打卡"></div>
              <div class="sync-buttons">
                <button class="ck-btn" id="ck-sync-all">📤 同步全部</button>
                <button class="ck-btn" id="ck-fetch-team">📥 拉取团队数据</button>
              </div>
              <p class="sync-hint">自动同步/同步全部写入工作表「${state.sheetName || '每日打卡'}」。</p>
            </section>

            <!-- 报数提醒设置（含云同步） -->
            <section class="ck-settings-section">
              <p class="section-title">📢 报数提醒设置</p>
              <p class="sync-hint">定时提醒填写任务完成量（11:50/17:50/23:00）。</p>
              <div class="field">
                <label>提醒音效</label>
                <div class="radio-group compact">
                  <label class="radio-item">
                    <input type="radio" name="ck-report-audio-mode" value="none" ${(window.CheckinReport?.state?.settings?.audioMode || 'voice') === 'none' ? 'checked' : ''}>
                    <span>🔇 无声</span>
                  </label>
                  <label class="radio-item">
                    <input type="radio" name="ck-report-audio-mode" value="beep" ${(window.CheckinReport?.state?.settings?.audioMode) === 'beep' ? 'checked' : ''}>
                    <span>🔔 提示音</span>
                  </label>
                  <label class="radio-item">
                    <input type="radio" name="ck-report-audio-mode" value="voice" ${(window.CheckinReport?.state?.settings?.audioMode || 'voice') === 'voice' ? 'checked' : ''}>
                    <span>🗣️ 语音播报</span>
                  </label>
                </div>
              </div>
              <div class="field" id="ck-voice-text-field" style="${(window.CheckinReport?.state?.settings?.audioMode || 'voice') !== 'voice' ? 'display:none;' : ''}">
                <label>语音播报文字</label>
                <input type="text" id="ck-report-voice-text" value="${window.CheckinReport?.state?.settings?.voiceText || '到点了，请填写任务完成量'}" placeholder="到点了，请填写任务完成量">
              </div>
              <div class="field">
                <label>系统预设（固定）</label>
                <div class="ck-preset-pill-wrap">
                  ${(() => {
        // 🔴 优先从 CheckinCore 获取动态任务类型（从 Google Sheets 读取）
        const defaults = window.CheckinCore?.getReportTaskTypes?.() ||
          window.CheckinReport?.getDefaultPresets?.() ||
          ['生成图片', '制作图片', '制作风格图', '制作视频', '生成sora', '图片转视频', 'reels视频', '视频剪辑'];
        return defaults.map(p =>
          `<span class="ck-preset-pill">${p}</span>`
        ).join('');
      })()}
                </div>
                <p class="ck-field-hint" style="margin-top: 6px;">任务类型从 Google Sheets 的 D 列自动读取（与上传模块共用）</p>
              </div>
              <div class="field">
                <label class="ck-toggle-row">
                  <input type="checkbox" id="ck-overview-all-teams" ${state.profile.overviewAllTeams ? 'checked' : ''}>
                  <span>跨组内汇总（读取所有团队数据）</span>
                </label>
                <p class="ck-field-hint">开启后组内汇总会拉取所有团队数据，数据量大时可能变慢。</p>
              </div>
              <div class="field">
                <label>接收报数通知范围 / 组内汇总显示范围</label>
                <div class="radio-group">
                  <label class="radio-item">
                    <input type="radio" name="ck-report-notify-mode" value="all" ${state.profile.reportNotifyMode === 'all' || !state.profile.reportNotifyMode ? 'checked' : ''}>
                    <span>📢 显示所有团队</span>
                  </label>
                  <label class="radio-item">
                    <input type="radio" name="ck-report-notify-mode" value="myTeam" ${state.profile.reportNotifyMode === 'myTeam' ? 'checked' : ''}>
                    <span>👥 仅本组（${state.profile.teamName || '默认'}）</span>
                  </label>
                  <label class="radio-item">
                    <input type="radio" name="ck-report-notify-mode" value="custom" ${state.profile.reportNotifyMode === 'custom' ? 'checked' : ''}>
                    <span>🎯 自定义团队</span>
                  </label>
                </div>
              </div>
              <div class="field" id="ck-custom-teams-field" style="${state.profile.reportNotifyMode !== 'custom' ? 'display:none;' : ''}">
                <label>选择要显示的团队</label>
                ${(() => {
        // 从记录中提取所有不重复的团队名称（包含默认/未设置）
        const allTeams = new Map();
        const teamRecords = getTeamOverviewRecords();
        (teamRecords || []).forEach(r => {
          const rawTeam = (r.teamName || '').trim();
          const teamValue = rawTeam || 'default';
          const teamLabel = rawTeam && rawTeam !== 'default' ? rawTeam : '默认/未设置';
          allTeams.set(teamValue, teamLabel);
        });
        const teamList = Array.from(allTeams.entries())
          .sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'));
        const selectedTeams = new Set(state.profile.reportNotifyTeams || []);

        if (teamList.length === 0) {
          return '<p class="ck-field-hint">暂无组内数据，请等待成员打卡后再配置</p>';
        }

        return `
                    <div class="ck-team-checkbox-list" style="max-height: 150px; overflow-y: auto; border: 1px solid rgba(148, 163, 184, 0.3); border-radius: 8px; padding: 8px;">
                      ${teamList.map(([teamValue, teamLabel]) => `
                        <label class="ck-toggle-row" style="margin-bottom: 6px;">
                          <input type="checkbox" class="ck-custom-team-checkbox" value="${teamValue}" ${selectedTeams.has(teamValue) ? 'checked' : ''}>
                          <span>${teamLabel}</span>
                        </label>
                      `).join('')}
                    </div>
                    <p class="ck-field-hint">勾选要显示的团队，只会显示这些团队的打卡数据</p>
                  `;
      })()}
              </div>
              <div class="field">
                <label class="ck-toggle-row">
                  <input type="checkbox" id="ck-notify-enabled" ${state.profile.notifyEnabled !== false ? 'checked' : ''}>
                  <span>启用弹框通知</span>
                </label>
                <p class="ck-field-hint" style="margin-top: 4px;">通知位置请在主应用的「设置 → 通知与身份」中配置</p>
              </div>
              <div class="field">
                <label class="ck-toggle-row">
                  <input type="checkbox" id="ck-report-notify-sound" ${state.profile.reportNotifySoundEnabled !== false ? 'checked' : ''}>
                  <span>他人报数提示音</span>
                </label>
                <p class="ck-field-hint" style="margin-top: 4px;">开启后收到别人报数通知时会播放叮咚提示音</p>
              </div>
              <div class="field">
                <label>通知弹框大小</label>
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                  <input type="range" id="ck-notification-scale" min="50" max="150" step="5" 
                         value="${state.profile.notificationScale || 100}" 
                         style="flex: 1; accent-color: var(--primary);">
                  <span id="ck-notification-scale-value" style="min-width: 45px; text-align: right; font-weight: 500;">${state.profile.notificationScale || 100}%</span>
                </div>
                <p class="ck-field-hint" style="margin-top: 4px;">调整通知弹框的显示大小，范围 50%-150%</p>
              </div>
              
              <!-- 🔴 开发者测试工具 -->
              <div class="field" style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed rgba(148, 163, 184, 0.3);">
                <label style="color: var(--warning-color);">🧪 时间模拟（测试用）</label>
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                  <input type="time" id="ck-debug-time" 
                         value="${state.debugTime || ''}" 
                         style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.3); background: var(--bg-secondary);">
                  <button class="ck-btn" id="ck-apply-debug-time" style="white-space: nowrap;">⏱️ 应用</button>
                  <button class="ck-btn" id="ck-reset-debug-time" style="white-space: nowrap;">🔄 重置</button>
                </div>
                <p class="ck-field-hint" style="margin-top: 4px;">
                  ${state.debugTime
        ? `<span style="color: var(--warning-color);">⚠️ 当前模拟时间: ${state.debugTime}（非真实时间）</span>`
        : '设置模拟时间后可测试不同时段的打卡状态（迟到/缺勤等）'}
                </p>
              </div>
              
              <div class="sync-buttons" style="margin-top: 16px;">
                <button class="ck-btn primary" id="ck-save-report-settings">☁️ 同步到 Firebase</button>
                <button class="ck-btn" id="ck-load-settings">📥 从云端加载</button>
              </div>
              <p class="ck-field-hint" style="margin-top: 8px;">设置会自动保存到本地，并按提交人姓名同步到 Firebase（可手动同步）。</p>
              
              <!-- 🔴 用户管理 -->
              <div class="field" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(148, 163, 184, 0.3);">
                <label>👥 用户管理</label>
                <p class="ck-field-hint" style="margin-top: 4px;">管理当前组的提交人：查看、重命名或删除用户及其记录。</p>
                <button class="ck-btn" id="ck-open-user-manager" style="margin-top: 12px;">👥 管理用户</button>
              </div>
              
              <!-- 🔴 管理员重置按钮（仅开发模式可见） -->
              ${window.bridge?.isDev ? `
              <div class="field" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(239, 68, 68, 0.3);">
                <label style="color: #ef4444;">⚠️ 数据管理（开发模式）</label>
                
                <!-- 数据库版本切换 -->
                <div style="margin-top: 12px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="color: #3b82f6; font-weight: 500;">📊 当前版本:</span>
                    <span id="ck-current-db-version" style="font-weight: bold; color: #10b981;">V2</span>
                    <button class="ck-btn" id="ck-switch-to-v1" style="background: #64748b; color: white; font-size: 11px; padding: 3px 8px;">V1 老</button>
                    <button class="ck-btn" id="ck-switch-to-v2" style="background: #10b981; color: white; font-size: 11px; padding: 3px 8px;">V2 生产</button>
                    <button class="ck-btn" id="ck-switch-to-v3" style="background: #f59e0b; color: white; font-size: 11px; padding: 3px 8px;">V3 测试</button>
                  </div>
                  <p class="ck-field-hint" style="margin-top: 6px; color: #3b82f6; font-size: 11px;">
                    V1=老数据 | V2=生产版本 | V3=测试版本（预览迁移效果用）
                  </p>
                </div>

                <!-- 迁移操作 -->
                <div style="margin-top: 12px; padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.3);">
                  <p class="ck-field-hint" style="color: #10b981; font-size: 12px; margin-bottom: 8px;">
                    <strong>安全迁移流程：</strong> ① 迁移到V3测试 → ② 切换V3预览 → ③ 确认OK → ④ 应用到V2
                  </p>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="ck-btn" id="ck-migrate-to-v3" style="background: #f59e0b; color: white; font-size: 12px;">📦 迁移到V3(测试)</button>
                    <button class="ck-btn" id="ck-migrate-to-v2" style="background: #10b981; color: white; font-size: 12px;">✅ 应用到V2(生产)</button>
                  </div>
                </div>

                <!-- 其他操作 -->
                <div style="display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap;">
                  <button class="ck-btn" id="ck-cleanup-invalid-data" style="background: #6366f1; color: white;">🧹 清理错误数据</button>
                  <button class="ck-btn danger" id="ck-reset-database" style="background: #ef4444; color: white;">🔄 重置数据库</button>
                </div>
              </div>` : ''}
            </section>
          </div>
        </div>
      </div>`;
  }

  function renderToast() {
    // 始终渲染 toast 元素，通过 show 类控制显示
    const showClass = state.toastMessage ? 'show' : '';
    return `<div class="ck-toast ${showClass}">${state.toastMessage || ''}</div>`;
  }

  function renderTeamOverview() {
    // 🔴 权限控制：需要填写提交人才能查看团队数据
    if (!state.profile.name || !state.profile.name.trim()) {
      return `
        <div class="ck-team-empty">
          <div class="empty-icon">🔒</div>
          <h3>请先填写提交人姓名</h3>
          <p>填写后才能查看团队打卡数据</p>
          <button class="ck-btn primary" id="ck-goto-settings-from-team">前往设置</button>
        </div>
      `;
    }

    const now = new Date();
    const currentDay = now.getDate();

    // 🔴 自动月份调整：23日及之后自动显示下个月的统计周期
    // 业务规则：1月23日-2月22日 → 显示2月
    let year = state.viewDate.getFullYear();
    let month = state.viewDate.getMonth();

    // 如果 viewDate 是今天，则根据23日规则自动调整
    const isViewingToday = formatDate(state.viewDate) === formatDate(now);
    if (isViewingToday && currentDay >= 23) {
      month = now.getMonth() + 1;
      if (month > 11) {
        month = 0;
        year++;
      }
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = formatDate(new Date());
    const teamRecords = getTeamOverviewRecords();

    // 🔴 修复：获取团队筛选设置
    const myTeamName = state.profile.teamName || '';
    const reportNotifyMode = state.profile.reportNotifyMode || 'all';
    const customTeams = state.profile.reportNotifyTeams || [];

    // 确定筛选模式
    const filterByMyTeam = reportNotifyMode === 'myTeam' && myTeamName;
    const filterByCustomTeams = reportNotifyMode === 'custom' && customTeams.length > 0;

    // 从所有记录中提取团队成员（避免跨团队同名冲突）
    const memberMap = new Map();
    teamRecords.forEach(r => {
      if (!r.userName) return;
      const rawTeam = (r.teamName || '').trim();
      const memberTeam = rawTeam || 'default';
      const memberKey = `${memberTeam}::${r.userName}`;
      if (!memberMap.has(memberKey)) {
        memberMap.set(memberKey, { key: memberKey, name: r.userName, team: memberTeam, records: [] });
      }
      memberMap.get(memberKey).records.push(r);

      // 🔴 临时调试：查看"喜乐"今天的数据
      if (r.userName === '喜乐' && r.date === today) {
        console.log('🔍 [调试] 喜乐今天的记录:', JSON.stringify(r, null, 2));
        console.log('🔍 [调试] slots.morning:', r.slots?.morning);
        console.log('🔍 [调试] slots.morning.time:', r.slots?.morning?.time);
        console.log('🔍 [调试] slots.morning.status:', r.slots?.morning?.status);
      }
    });

    // 🔴 修复：根据筛选模式过滤成员
    if (filterByMyTeam || filterByCustomTeams) {
      const filteredMemberMap = new Map();
      memberMap.forEach((entry, memberKey) => {
        const records = entry.records;
        const memberTeam = entry.team;
        const memberName = entry.name;
        let shouldInclude = false;
        if (filterByMyTeam) {
          // 仅本组模式：只显示同一团队的成员
          shouldInclude = memberTeam === myTeamName || memberName === state.profile.name;
        } else if (filterByCustomTeams) {
          // 自定义团队模式：只显示指定团队的成员
          shouldInclude = customTeams.includes(memberTeam) || memberName === state.profile.name;
        }

        if (shouldInclude) {
          filteredMemberMap.set(memberKey, entry);
        }
      });
      // 用过滤后的 map 替换
      memberMap.clear();
      filteredMemberMap.forEach((v, k) => memberMap.set(k, v));
    }

    // 如果没有记录，显示提示
    if (memberMap.size === 0) {
      let filterHint = '';
      if (filterByMyTeam) {
        filterHint = `（当前筛选：仅本组 - ${myTeamName}）`;
      } else if (filterByCustomTeams) {
        filterHint = `（当前筛选：${customTeams.join('、')}）`;
      }
      return `
        <div class="ck-team-empty ${state.isDark ? 'dark' : ''}">
          <div class="icon">👥</div>
          <h3>暂无组内数据${filterHint}</h3>
          <p>当团队成员开始打卡后，这里将显示所有人的打卡情况</p>
          <p class="hint">💡 提示：${(filterByMyTeam || filterByCustomTeams) ? '切换到"显示所有团队"或开启“跨组内汇总”可查看更多成员' : '团队数据需要通过 Firebase 实时同步'}</p>
          <button class="ck-btn primary" id="ck-generate-mock" style="margin-top: 20px;">🎲 生成模拟数据预览效果</button>
        </div>`;
    }

    const members = Array.from(memberMap.values());

    // 🔴 多种排序模式
    const sortToday = formatDate(new Date());
    const sortMode = state.teamOverviewSortMode || 'time';

    // 排序辅助函数 - 今日打卡时间（仅用于时间排序）
    const getLatestPunchTime = (entry) => {
      const todayRecord = entry.records.find(r => r.date === sortToday);
      if (!todayRecord?.slots) return 0;
      let latestTime = 0;
      ['morning', 'afternoon', 'evening'].forEach(slotKey => {
        const slot = todayRecord.slots[slotKey];
        if (slot?.time) {
          const t = new Date(slot.time).getTime();
          if (t > latestTime) latestTime = t;
        }
      });
      return latestTime;
    };

    // 🔴 统计整个周期的打卡次数
    const getPunchCount = (entry) => {
      let count = 0;
      entry.records.forEach(r => {
        if (!r.slots) return;
        ['morning', 'afternoon', 'evening'].forEach(slotKey => {
          const slot = r.slots[slotKey];
          if (slot?.time) count++;
        });
      });
      return count;
    };

    // 🔴 统计整个周期的正常打卡次数
    const getNormalCount = (entry) => {
      let count = 0;
      entry.records.forEach(r => {
        if (!r.slots) return;
        ['morning', 'afternoon', 'evening'].forEach(slotKey => {
          const slot = r.slots[slotKey];
          if (slot?.time) {
            const status = slot.status || 'normal';
            if (status === 'normal' || status === AttendanceStatus.NORMAL) {
              count++;
            }
          }
        });
      });
      return count;
    };

    // 🔴 统计整个周期的报数次数
    const getReportCount = (entry) => {
      let count = 0;
      entry.records.forEach(r => {
        if (!r.slots) return;
        ['morning', 'afternoon', 'evening'].forEach(slotKey => {
          const slot = r.slots[slotKey];
          if (slot?.taskCount && String(slot.taskCount).trim()) count++;
        });
      });
      return count;
    };

    members.sort((a, b) => {
      // 1. 先按团队名称排序
      const teamCompare = (a.team || '').localeCompare(b.team || '', 'zh-CN');
      if (teamCompare !== 0) return teamCompare;

      // 2. 根据排序模式进行二级排序
      switch (sortMode) {
        case 'time':
          // 按今日最新打卡时间排序（最新在前）
          return getLatestPunchTime(b) - getLatestPunchTime(a);

        case 'status':
          // 按打卡数量排序（已打卡次数多的在前）
          return getPunchCount(b) - getPunchCount(a);

        case 'normal':
          // 按正常打卡次数排序（正常打卡多的在前）
          return getNormalCount(b) - getNormalCount(a);

        case 'report':
          // 按报数次数排序（报数次数多的在前）
          return getReportCount(b) - getReportCount(a);

        case 'name':
        default:
          // 按姓名排序
          return (a.name || '').localeCompare(b.name || '', 'zh-CN');
      }
    });

    const slotColumns = [
      { key: 'morning', label: '上午', color: 'morning' },
      { key: 'afternoon', label: '下午', color: 'afternoon' },
      { key: 'evening', label: '晚上', color: 'evening' },
      { key: 'sleep', label: '休息', color: 'sleep' }
    ];
    const statusLabelMap = new Map(state.statusOptions.map(o => [o.value, o.label]));

    function getStatusLabel(status, slot) {
      // 🔴 优先显示临时外出信息
      if (slot?.tempOut && slot.tempOut.reasonLabel) {
        const timeRange = slot.tempOut.leaveTime + (slot.tempOut.returnTime ? '-' + slot.tempOut.returnTime : '');
        // 如果有打卡时间，说明是打卡后中途外出
        if (slot?.time) {
          return `正常-${slot.tempOut.reasonLabel}${timeRange}`;
        }
        return `${slot.tempOut.reasonLabel} ${timeRange}`;
      }
      if (status === AttendanceStatus.CUSTOM) {
        return slot?.customStatusName || statusLabelMap.get(status) || '自定义';
      }
      // 🔴 修复：缺勤状态显示中文
      if (status === AttendanceStatus.ABSENT || status === 'absent') {
        return '缺勤';
      }
      if (status === AttendanceStatus.LATE || status === 'late') {
        return '迟到';
      }
      return statusLabelMap.get(status) || status || '正常上线';
    }

    function getStatusClass(status, slot) {
      // 🔴 临时外出状态
      if (slot?.tempOut) {
        return 'tempout';
      }
      switch (status) {
        case AttendanceStatus.LATE:
          return 'late';
        case AttendanceStatus.ABSENT:
        case 'absent':
          return 'absent';  // 🔴 缺勤状态使用红色
        case AttendanceStatus.SICK:
          return 'sick';
        case AttendanceStatus.LEAVE:
          return 'leave';
        case AttendanceStatus.CUSTOM:
          return 'custom';
        default:
          return 'normal';
      }
    }

    function getSlotDisplay(slot) {
      const status = slot?.status || AttendanceStatus.NORMAL;
      const hasTime = !!slot?.time;
      const displayLabel = slot?.displayLabel;
      const isManual = slot?.isManual;
      const customStatusName = slot?.customStatusName;

      // 🔴 未打卡判断（修复老版本数据 bug）
      // 老版本可能设置了 displayLabel 但没有 time，这种情况应该显示"未打卡"
      if (!hasTime && status === AttendanceStatus.NORMAL) {
        // 🔴 修复：忽略 displayLabel，因为老版本可能错误地设置了它
        // if (displayLabel) {
        //   return { text: displayLabel, className: 'normal' };
        // }
        // 🔴 如果设置了今日模式，显示模式标签而不是"未打卡"
        if (slot?.modeLabel) {
          return { text: slot.modeLabel, className: 'mode' };
        }
        return { text: '未打卡', className: 'empty' };
      }

      // 🔴 已打卡：显示状态标签，统一用 normal（绿色）
      // 自定义状态使用自定义名称
      let label = '正常上线';
      if (customStatusName) {
        label = customStatusName;
      } else if (displayLabel) {
        label = displayLabel;
      } else {
        label = getStatusLabel(status, slot);
      }

      // 手动打卡用黄色，其余按状态色（缺勤/迟到/外出等）
      const className = isManual ? 'manual'
        : (status !== AttendanceStatus.NORMAL || slot?.tempOut ? getStatusClass(status, slot) : 'normal');
      return { text: label, className };
    }

    function isEarlySleepTime(timeValue) {
      const dt = new Date(timeValue);
      const h = dt.getHours();
      const m = dt.getMinutes();
      // 凌晨 0-5 点不算早睡（这是熬夜或正常睡眠时间）
      if (h >= 0 && h < 5) return false;
      // 22:30 之前算早睡
      return h < 22 || (h === 22 && m < 30);
    }

    function getSleepDisplay(slot) {
      const status = typeof slot === 'string' ? AttendanceStatus.NORMAL : slot?.status || AttendanceStatus.NORMAL;
      const timeValue = typeof slot === 'string' ? slot : slot?.time;
      const displayLabel = slot?.displayLabel;
      const displayClass = slot?.displayClass;

      // 🔴 修复老版本数据 bug：没有 time 一律显示"未休息"
      // 老版本可能设置了 displayLabel 和 status 但用户实际没有操作
      if (!timeValue) {
        return { text: '未休息', className: 'empty' };
      }

      // 有 time 的情况下，才使用 displayLabel
      if (displayLabel) {
        return { text: displayLabel, className: displayClass || getStatusClass(status) };
      }
      if (status === AttendanceStatus.LATE) {
        return { text: '熬夜', className: 'sleep-late' };
      }
      if (status !== AttendanceStatus.NORMAL) {
        return { text: getStatusLabel(status, slot), className: getStatusClass(status) };
      }
      const isEarly = isEarlySleepTime(timeValue);
      return { text: isEarly ? '早睡' : '正常睡', className: isEarly ? 'sleep-early' : 'sleep-normal' };
    }

    // 计算日期范围：上月23日到本月22日（当前月份未到22号则截止到今天）
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const endDay = isCurrentMonth ? (now.getDate() < 22 ? now.getDate() : 22) : 22;

    // 开始日期：上个月23日
    const startDate = new Date(year, month - 1, 23);

    // 结束日期：本月22日或今天（仅当前月份）
    const endDate = new Date(year, month, endDay);

    // 生成日期列表（从新到旧）
    const dateList = [];
    for (let d = new Date(endDate); d >= startDate; d.setDate(d.getDate() - 1)) {
      dateList.push(new Date(d));
    }

    // 格式化日期范围显示
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const endMonth = endDate.getMonth() + 1;
    const rangeLabel = `${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`;

    // 🔴 新增：是否展开详情列（从 state 读取）
    const showDetailCols = state.teamOverviewExpanded !== false; // 默认展开

    // 生成表头（日期）- 最新日期在左侧，日期交替颜色
    // 固定统计列
    let colGroupHtml = '<colgroup>';
    colGroupHtml += '<col class="ck-col-group">';
    colGroupHtml += '<col class="ck-col-name">';
    colGroupHtml += '<col class="ck-col-toggle">';
    if (showDetailCols) {
      colGroupHtml += '<col class="ck-col-mode">';
      colGroupHtml += '<col class="ck-col-schedule">';
    }
    if (showDetailCols) {
      colGroupHtml += '<col class="ck-col-stat ck-col-stat-normal">';
      colGroupHtml += '<col class="ck-col-stat ck-col-stat-late">';
      colGroupHtml += '<col class="ck-col-stat ck-col-stat-absent">';
      colGroupHtml += '<col class="ck-col-stat ck-col-stat-stayup">';
      colGroupHtml += '<col class="ck-col-stat ck-col-stat-task">';
    }
    dateList.forEach(() => {
      slotColumns.forEach(() => {
        colGroupHtml += '<col class="ck-col-slot">';
      });
    });
    colGroupHtml += '</colgroup>';

    let headerCells = '<th class="ck-team-header-group" rowspan="2">组别</th>';
    headerCells += '<th class="ck-team-header-name" rowspan="2">成员</th>';

    // 折叠/展开按钮列
    headerCells += `<th class="ck-team-header-toggle" rowspan="2" title="${showDetailCols ? '点击折叠详情' : '点击展开详情'}">
      <button class="ck-team-toggle-btn" id="ck-team-toggle-details">${showDetailCols ? '◀' : '▶'}</button>
    </th>`;
    // 🔴 新增：可折叠的详情列（工作模式 + 上线时段）
    if (showDetailCols) {
      headerCells += '<th class="ck-team-header-mode ck-collapsible" rowspan="2" title="工作模式">⏰ 模式</th>';
      headerCells += '<th class="ck-team-header-schedule ck-collapsible" rowspan="2" title="上线时段">📅 时段</th>';
    }
    if (showDetailCols) {
      headerCells += '<th class="ck-team-stat-header stat-normal" rowspan="2">正常</th>';
      headerCells += '<th class="ck-team-stat-header stat-late" rowspan="2">迟到</th>';
      headerCells += '<th class="ck-team-stat-header stat-absent" rowspan="2">缺勤</th>';
      headerCells += '<th class="ck-team-stat-header stat-stayup" rowspan="2">熬夜</th>';
      headerCells += '<th class="ck-team-stat-header stat-task" rowspan="2">报数</th>';
    }

    // 日期列表表头
    let subHeaderCells = '';
    let dateIndex = 0;
    dateList.forEach(date => {
      const dateYear = date.getFullYear();
      const dateMonth = date.getMonth();
      const dateDay = date.getDate();
      const dateStr = `${dateYear}-${String(dateMonth + 1).padStart(2, '0')}-${String(dateDay).padStart(2, '0')}`;
      const isToday = dateStr === today;
      const isAlt = dateIndex % 2 === 0; // 交替颜色
      headerCells += `<th class="ck-team-date ${isToday ? 'today' : ''} ${isAlt ? 'alt' : ''}" colspan="${slotColumns.length}" data-date="${dateStr}" title="${dateStr}">${dateMonth + 1}月${dateDay}日</th>`;
      slotColumns.forEach(slot => {
        subHeaderCells += `<th class="ck-team-subheader ck-subheader-${slot.color} ${isToday ? 'today' : ''} ${isAlt ? 'alt' : ''}">${slot.label}</th>`;
      });
      dateIndex++;
    });

    // 生成每个成员的行
    let rows = '';
    members.forEach(memberEntry => {
      const member = memberEntry.name;
      const memberRecords = memberEntry.records;
      const memberKey = memberEntry.key;
      const memberTeamValue = memberEntry.team;
      const recordMap = new Map(memberRecords.map(r => [r.date, r]));

      // 📊 计算统计数据
      let lateCount = 0;      // 迟到次数
      let normalCount = 0;    // 正常上线次数
      let stayUpCount = 0;    // 熬夜次数
      let absentCount = 0;    // 缺勤次数
      let taskFillCount = 0;  // 任务填写次数

      memberRecords.forEach(record => {
        const slots = record.slots || {};
        // 统计上午/下午/晚上的状态和任务填写
        ['morning', 'afternoon', 'evening'].forEach(slotKey => {
          const slot = slots[slotKey];
          if (!slot) return;
          const status = typeof slot === 'string' ? 'normal' : (slot.status || 'normal');
          if (status === 'late') lateCount++;
          else if (status === 'normal' && (slot.time || (typeof slot === 'string' && slot))) normalCount++;
          else if (status === 'absent') absentCount++;
          // 统计任务填写次数
          if (slot.taskCount && slot.taskCount.trim()) taskFillCount++;
        });
        // 统计熬夜（入眠迟到即为熬夜）
        const sleepSlot = slots.sleep;
        if (sleepSlot) {
          const sleepStatus = typeof sleepSlot === 'string' ? 'normal' : (sleepSlot.status || 'normal');
          // 入眠迟到 = 熬夜
          if (sleepStatus === 'late' || sleepStatus === 'stayUp' || sleepSlot.displayClass === 'stay-up' || sleepSlot.displayClass === 'sleep-late') {
            stayUpCount++;
          }
        }
      });

      // 获取该成员的组别（从最新一条有 teamName 的记录中提取）
      let memberTeam = memberTeamValue || '-';
      let memberMode = '-';
      let memberSchedule = '-';
      let baseMode = '';
      const modeLabels = { full_time: '全天', working: '上班', student: '上学', other: '其他' };
      const modeSet = new Set();
      let latestRecord = null;
      let latestTs = 0;

      for (const record of memberRecords) {
        const modeValue = record.profile?.mode || record.mode;
        if (modeValue) modeSet.add(modeValue);

        const recordTs = record.updatedAt || (record.date ? new Date(record.date).getTime() : 0);
        if (recordTs >= latestTs) {
          latestTs = recordTs;
          latestRecord = record;
        }
      }

      if (latestRecord) {
        baseMode = latestRecord.profile?.mode || latestRecord.mode || '';
        if (baseMode) {
          const customLabel = latestRecord.profile?.customModeLabel || latestRecord.customModeLabel || '';
          memberMode = baseMode === 'other' && customLabel ? customLabel : (modeLabels[baseMode] || baseMode);
        }
        const periods = latestRecord.profile?.targetPeriods || latestRecord.targetPeriods;
        if (Array.isArray(periods) && periods.length > 0) {
          memberSchedule = periods.map(p => `${p.name || ''}${p.start}-${p.end}`).join(' ');
        }
      }

      const extraLabels = [];
      if (modeSet.has('student') && baseMode !== 'student') extraLabels.push('偶尔上学');
      if (modeSet.has('working') && baseMode !== 'working') extraLabels.push('偶尔上班');
      if (extraLabels.length) {
        memberMode = memberMode !== '-' ? `${memberMode}（${extraLabels.join('、')}）` : extraLabels.join('、');
      }

      // 生成固定统计列
      let cells = `<td class="ck-team-group-cell">${memberTeam && memberTeam !== 'default' ? memberTeam : '-'}</td>`;
      cells += `<td class="ck-team-member-name">${member}</td>`;

      // 折叠按钮占位列
      cells += `<td class="ck-team-toggle-cell"></td>`;
      // 🔴 新增：可折叠的详情列
      if (showDetailCols) {
        cells += `<td class="ck-team-mode-cell ck-collapsible" title="${memberMode}">${memberMode}</td>`;
        cells += `<td class="ck-team-schedule-cell ck-collapsible ck-schedule-clickable" title="${memberSchedule}" data-schedule="${memberSchedule}" data-member="${member}">${memberSchedule}</td>`;
      }
      if (showDetailCols) {
        cells += `<td class="ck-team-stat-cell stat-normal">${normalCount}</td>`;
        cells += `<td class="ck-team-stat-cell stat-late">${lateCount}</td>`;
        cells += `<td class="ck-team-stat-cell stat-absent">${absentCount}</td>`;
        cells += `<td class="ck-team-stat-cell stat-stayup">${stayUpCount}</td>`;
        cells += `<td class="ck-team-stat-cell stat-task">${taskFillCount}</td>`;
      }


      // 使用dateList遍历日期，与表头顺序一致
      dateList.forEach(date => {
        const dateYear = date.getFullYear();
        const dateMonth = date.getMonth();
        const dateDay = date.getDate();
        const dateStr = `${dateYear}-${String(dateMonth + 1).padStart(2, '0')}-${String(dateDay).padStart(2, '0')}`;
        const record = recordMap.get(dateStr);
        const isFuture = date > now;
        const isToday = dateStr === today;

        slotColumns.forEach(slot => {
          let cellClass = 'ck-team-cell';
          let cellContent = '';
          let cellTitle = '';

          if (isFuture) {
            cellClass += ' future';
            cellContent = '-';
          } else {
            const slotData = slot.key === 'sleep' ? record?.slots?.sleep : record?.slots?.[slot.key];
            const display = slot.key === 'sleep' ? getSleepDisplay(slotData) : getSlotDisplay(slotData);
            cellClass += ` ${display.className}`;
            cellContent = display.text;
            cellTitle = display.text;
          }

          if (isToday) cellClass += ' today';

          cells += `<td class="${cellClass}" title="${cellTitle}" data-member="${memberKey}" data-date="${dateStr}" data-slot="${slot.key}">${cellContent}</td>`;
        });
      });

      // 🔴 当前提交人高亮
      const currentUserName = state.profile?.name?.trim() || '';
      const isCurrentUser = member.trim() === currentUserName;
      const rowClass = isCurrentUser ? 'ck-current-user-row' : '';
      rows += `<tr class="${rowClass}">${cells}</tr>`;
    });

    return `
      <div class="ck-team-overview ${state.isDark ? 'dark' : ''}">
        <div class="ck-team-header">
          <h2>👥 组内汇总</h2>
          <div class="ck-team-range ck-team-range-nav">
            <button id="ck-team-prev-month" class="ck-btn-icon">◀</button>
            <span>📅 ${year} 年 ${month + 1} 月 · ${rangeLabel}</span>
            <button id="ck-team-next-month" class="ck-btn-icon">▶</button>
          </div>
        </div>
        <div class="ck-team-legend">
          <span class="legend-item"><span class="dot normal"></span>正常上线</span>
          <span class="legend-item"><span class="dot late"></span>迟到</span>
          <span class="legend-item"><span class="dot absent"></span>缺勤</span>
          <span class="legend-item"><span class="dot leave"></span>休假/抱恙</span>
          <span class="legend-item"><span class="dot custom"></span>自定义</span>
          <span class="legend-item"><span class="dot empty"></span>未打卡</span>
          <span class="legend-item"><span class="dot sleep-early"></span>早睡</span>
          <span class="legend-item"><span class="dot sleep-normal"></span>正常睡</span>
          <span class="legend-item"><span class="dot sleep-late"></span>熬夜</span>
          <span class="ck-team-sort-wrapper">
            <label>🔀 排序:</label>
            <select id="ck-team-sort-mode" class="ck-team-sort-select">
              <option value="time" ${sortMode === 'time' ? 'selected' : ''}>按打卡时间</option>
              <option value="status" ${sortMode === 'status' ? 'selected' : ''}>按打卡数量</option>
              <option value="normal" ${sortMode === 'normal' ? 'selected' : ''}>按正常打卡</option>
              <option value="report" ${sortMode === 'report' ? 'selected' : ''}>按报数次数</option>
              <option value="name" ${sortMode === 'name' ? 'selected' : ''}>按姓名</option>
            </select>
          </span>
        </div>
        <div class="ck-team-table-wrapper">
          <table class="ck-team-table ${showDetailCols ? 'is-expanded' : 'is-collapsed'}">
            ${colGroupHtml}
            <thead><tr>${headerCells}</tr><tr>${subHeaderCells}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="ck-team-footer">
          <p class="ck-team-hint">💡 点击单元格查看详情，单元格显示各时段状态</p>
          <button class="ck-btn" id="ck-clear-mock">🗑 清除模拟数据</button>
        </div>
      </div>
      ${renderTeamDetail()}`;
  }

  function renderTeamDetail() {
    if (!state.teamDetailMember || !state.teamDetailDate) return '';

    const { name: memberName, team: memberTeam } = parseTeamMemberKey(state.teamDetailMember);
    const teamRecords = getTeamOverviewRecords();
    const record = teamRecords.find(r => {
      if (r.date !== state.teamDetailDate) return false;
      if (r.userName !== memberName) return false;
      if (!memberTeam) return true;
      return (r.teamName || 'default') === memberTeam;
    });
    const displayTeam = memberTeam && memberTeam !== 'default' ? `（${memberTeam}）` : '';

    if (!record) {
      return `
        <div class="ck-modal-overlay" id="ck-team-detail-overlay">
          <div class="ck-modal ${state.isDark ? 'dark' : ''}">
            <div class="ck-modal-header">
              <h3>${memberName}${displayTeam ? ' ' + displayTeam : ''} - ${state.teamDetailDate}</h3>
              <button id="ck-close-team-detail">×</button>
            </div>
            <div class="ck-modal-body">
              <p class="empty-hint">该日期暂无打卡记录</p>
            </div>
          </div>
        </div>`;
    }

    const dur = calculateDuration(record);
    const slots = record.slots || {};

    // 🔴 状态格式化函数（支持自定义状态）
    const formatSlotStatus = (slot) => {
      const status = slot?.status || 'normal';
      // 🔴 修复：即使没有打卡时间，如果有非normal状态也要显示
      const hasNonNormalStatus = status !== 'normal' && status !== AttendanceStatus.NORMAL;
      if (!slot?.time && !hasNonNormalStatus) return '';

      if (slot?.customStatusName) return slot.customStatusName;
      if (slot?.displayLabel) return slot.displayLabel;
      if (status === 'late' || status === AttendanceStatus.LATE) return '迟到';
      if (status === 'absent' || status === AttendanceStatus.ABSENT) return '缺勤';
      if (status === 'leave' || status === AttendanceStatus.LEAVE) return '休假';
      if (status === 'sick' || status === AttendanceStatus.SICK) return '病假';
      if (status === 'custom' || status === AttendanceStatus.CUSTOM) return slot?.customStatusName || '自定义';
      if (slot?.time) return '正常';
      return '';
    };

    return `
      <div class="ck-modal-overlay" id="ck-team-detail-overlay">
        <div class="ck-modal ${state.isDark ? 'dark' : ''}">
          <div class="ck-modal-header">
            <h3>📋 ${memberName}${displayTeam ? ' ' + displayTeam : ''} - ${state.teamDetailDate}</h3>
            <button id="ck-close-team-detail">×</button>
          </div>
          <div class="ck-modal-body">
            <div class="ck-detail-summary">
              <div class="stat"><span class="label">在线时长</span><span class="value">${dur.toFixed(1)}h</span></div>
            </div>
            <div class="ck-detail-slots">
              <div class="slot-item ${slots.morning?.time ? 'done' : ''} ${slots.morning?.isManual ? 'manual' : ''}" ${slots.morning?.isManual && slots.morning?.actualPunchTime ? `title="实际操作时间: ${formatTime(slots.morning.actualPunchTime)}"` : ''}>
                <span class="icon">🌅</span>
                <span class="label">上午</span>
                <span class="time">${slots.morning?.time ? formatTime(slots.morning.time) : '--:--'}</span>
                <span class="status ${slots.morning?.status || ''}">${formatSlotStatus(slots.morning)}</span>
                ${slots.morning?.isManual ? `<span class="actual-time">（手动）</span>` : ''}
                <span class="task-count">${slots.morning?.taskCount ? `📋 ${slots.morning.taskCount}` : '<em class="no-data">未填写完成量</em>'}</span>
              </div>
              <div class="slot-item ${slots.afternoon?.time ? 'done' : ''} ${slots.afternoon?.isManual ? 'manual' : ''}" ${slots.afternoon?.isManual && slots.afternoon?.actualPunchTime ? `title="实际操作时间: ${formatTime(slots.afternoon.actualPunchTime)}"` : ''}>
                <span class="icon">☀️</span>
                <span class="label">下午</span>
                <span class="time">${slots.afternoon?.time ? formatTime(slots.afternoon.time) : '--:--'}</span>
                <span class="status ${slots.afternoon?.status || ''}">${formatSlotStatus(slots.afternoon)}</span>
                ${slots.afternoon?.isManual ? `<span class="actual-time">（手动）</span>` : ''}
                <span class="task-count">${slots.afternoon?.taskCount ? `📋 ${slots.afternoon.taskCount}` : '<em class="no-data">未填写完成量</em>'}</span>
              </div>
              <div class="slot-item ${slots.evening?.time ? 'done' : ''} ${slots.evening?.isManual ? 'manual' : ''}" ${slots.evening?.isManual && slots.evening?.actualPunchTime ? `title="实际操作时间: ${formatTime(slots.evening.actualPunchTime)}"` : ''}>
                <span class="icon">🌆</span>
                <span class="label">晚上</span>
                <span class="time">${slots.evening?.time ? formatTime(slots.evening.time) : '--:--'}</span>
                <span class="status ${slots.evening?.status || ''}">${formatSlotStatus(slots.evening)}</span>
                ${slots.evening?.isManual ? `<span class="actual-time">（手动）</span>` : ''}
                <span class="task-count">${slots.evening?.taskCount ? `📋 ${slots.evening.taskCount}` : '<em class="no-data">未填写完成量</em>'}</span>
              </div>
              ${slots.sleep ? `
                <div class="slot-item done">
                  <span class="icon">🌙</span>
                  <span class="label">入眠</span>
                  <span class="time">${formatTime(typeof slots.sleep === 'string' ? slots.sleep : slots.sleep.time)}</span>
                  <span class="status">${slots.sleep.notes ? '📝' : ''}</span>
                  <span class="task-count"></span>
                </div>
              ` : ''}
            </div>
            ${(slots.customActivities?.length > 0) ? `
              <div class="ck-detail-activities">
                <h4>🏠 琐事记录</h4>
                ${slots.customActivities.map(a => `
                  <div class="activity-item">
                    <span>${a.title}</span>
                    <span class="dur">${a.durationMinutes}分钟</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>`;
  }

  window.CheckinRender2 = { renderActivities, renderSleepCard, renderSidebar, renderHistory, renderSettings, renderToast, renderTeamOverview };
})();
