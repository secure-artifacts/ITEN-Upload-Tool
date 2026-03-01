/**
 * 每日打卡 - UI 渲染 (第1部分: 头部+统计+打卡卡片)
 */
(function () {
  'use strict';
  const C = window.CheckinCore;
  const A = window.CheckinActions;
  const { state, formatTime, formatDateDisplay, isToday, isPastDate, getActiveRecord, calculateDuration, calculateTargetHours, getStats, getDynamicSlotConfig, AttendanceStatus } = C;

  function renderHeader(record) {
    const dateDisplay = formatDateDisplay(state.viewDate);
    return `
      <header class="ck-header ${state.isDark ? 'dark' : ''}">
        <div class="ck-header-left">
          <div class="ck-logo">✓</div>
          <div><h1>每日打卡</h1><p>Daily Check-in</p></div>
        </div>
        <div class="ck-header-center">
          <div class="ck-tabs">
            <button class="ck-tab ${state.activeTab === 'punch' ? 'active' : ''}" data-tab="punch">🌅 实时打卡</button>
            <button class="ck-tab ${state.activeTab === 'team' ? 'active' : ''}" data-tab="team">👥 组内打卡汇总</button>
            <button class="ck-tab ${state.activeTab === 'stats' ? 'active' : ''}" data-tab="stats">📊 任务统计</button>
            <button class="ck-tab ${state.activeTab === 'report' ? 'active' : ''}" data-tab="report">📢 报数记录</button>
            <button class="ck-tab ${state.activeTab === 'history' ? 'active' : ''}" data-tab="history">📅 按月查看</button>
          </div>
          <div class="ck-date-nav">
            <button id="ck-prev-day" class="ck-btn-icon">◀</button>
            <div class="ck-date-display" id="ck-date-picker">
              <span class="main">${isToday(state.viewDate) ? 'Today' : dateDisplay.main}</span>
              <span class="sub">${dateDisplay.sub}</span>
              ${isPastDate(state.viewDate) ? '<span class="badge">补录</span>' : ''}
              <input type="date" id="ck-date-input" value="${C.formatDate(state.viewDate)}" max="${C.formatDate(new Date())}">
            </div>
            <button id="ck-next-day" class="ck-btn-icon" ${isToday(state.viewDate) ? 'disabled' : ''}>▶</button>
          </div>
        </div>
        <div class="ck-header-right">
          <button class="ck-btn-icon" id="ck-theme-toggle" title="${state.isDark ? '切换亮色' : '切换暗色'}">${state.isDark ? '☀️' : '🌙'}</button>
          <button class="ck-btn-icon" id="ck-settings-btn" title="设置">⚙️</button>
        </div>
      </header>
      `;
  }

  function renderProgressCard(record) {
    // 已移除 - 返回空
    return '';
  }

  function renderSlotCard(cfg, slot, record) {
    const isDone = !!slot?.time;
    const isEditing = state.editingSlot === cfg.key;
    const isPast = isPastDate(state.viewDate);
    const userSelectedNonAutoStatus = slot?.status &&
      slot.status !== AttendanceStatus.NORMAL &&
      slot.status !== AttendanceStatus.LATE &&
      slot.status !== AttendanceStatus.ABSENT;

    // 检查是否可以打卡
    let canPunch = !isPast && !isDone;
    let isTooEarly = false;
    let isCurrentlyLate = false;  // 当前是否迟到状态（未打卡）
    let isAbsent = false;         // 当前是否缺勤状态（未打卡且已过结束时间）

    // 🔴 使用 getCurrentTime() 支持时间模拟测试
    const now = window.CheckinCore?.getCurrentTime?.() || new Date();

    if (canPunch && cfg.startTime && state.profile.targetPeriods.length > 0) {
      const [sh, sm] = cfg.startTime.split(':').map(Number);
      const start = new Date(now); start.setHours(sh, sm, 0, 0);
      const earlyAllowed = 30 * 60 * 1000; // 允许提前30分钟
      if (now < start - earlyAllowed) { canPunch = false; isTooEarly = true; }
    }

    // 检查迟到状态
    // 🔴 智能迟到/缺勤判断：
    // - 全时间人员：使用 deadline（报数截止时间）+ 10分钟宽限
    // - 非全时间人员：使用 startTime（用户配置的开始时间）+ 10分钟宽限
    // - 迟到超过2小时视为缺勤
    if (!isDone && !isPast && !userSelectedNonAutoStatus) {
      const isFullTime = state.profile.mode === 'full_time';
      // 🔴 非全时间人员使用 startTime（用户自定义的开始时间）
      const baseTime = isFullTime ? (cfg.deadline || cfg.startTime) : cfg.startTime;

      if (baseTime) {
        const [bh, bm] = baseTime.split(':').map(Number);

        // 迟到基线 = 开始时间 + 10分钟
        const lateThreshold = new Date(now);
        lateThreshold.setHours(bh, bm + 10, 0, 0);

        // 缺勤基线 = 开始时间 + 2小时10分钟（迟到2小时后转缺勤）
        const absentThreshold = new Date(now);
        absentThreshold.setHours(bh, bm + 130, 0, 0); // 10分钟宽限 + 120分钟

        if (now > absentThreshold) {
          // 超过2小时 = 缺勤
          isAbsent = true;
          isCurrentlyLate = false;
        } else if (now > lateThreshold) {
          // 超过10分钟但未超2小时 = 迟到
          isCurrentlyLate = true;
        }
      }
    }

    // 检查缺勤状态（过了时段结束时间）
    if (!isDone && !isPast && !userSelectedNonAutoStatus && cfg.endTime) {
      const [eh, em] = cfg.endTime.split(':').map(Number);
      const endTime = new Date(now); endTime.setHours(eh, em, 0, 0);
      if (now > endTime) {
        isAbsent = true;
        isCurrentlyLate = false; // 缺勤优先级更高
      }
    }

    // 确定按钮样式和文本
    // 🔴 根据时间自动判断的状态（用于打卡按钮）
    let autoStatus = AttendanceStatus.NORMAL;  // 正常
    if (isAbsent) {
      autoStatus = AttendanceStatus.ABSENT;    // 缺勤
    } else if (isCurrentlyLate) {
      autoStatus = AttendanceStatus.LATE;      // 迟到
    }

    // 🔴 联动逻辑修正：
    // - 如果用户已选择了非自动判断的状态（如休假、病假、自定义），使用用户选择的
    // - 否则未打卡时使用自动判断的状态（正常/迟到/缺勤）
    // - 已打卡时使用记录里的状态
    const effectiveStatus = userSelectedNonAutoStatus
      ? slot.status
      : (isDone ? (slot?.status || AttendanceStatus.NORMAL) : autoStatus);
    const isEffectiveAbsent = effectiveStatus === AttendanceStatus.ABSENT || effectiveStatus === 'absent';
    const isEffectiveLate = effectiveStatus === AttendanceStatus.LATE || effectiveStatus === 'late';
    const selectedStatusOption = state.statusOptions.find(o => o.value === effectiveStatus);
    const hasPresetStatusLabel = selectedStatusOption && ![
      AttendanceStatus.NORMAL,
      AttendanceStatus.LATE,
      AttendanceStatus.ABSENT,
      AttendanceStatus.LEAVE,
      AttendanceStatus.SICK,
      AttendanceStatus.CUSTOM
    ].includes(effectiveStatus);

    // 根据有效状态决定按钮样式
    let punchBtnClass = 'primary';
    let punchBtnText = '点击打卡 正常上线';
    let punchBtnIcon = '✓';

    if (isEffectiveAbsent) {
      punchBtnClass = 'absent';
      punchBtnText = '点击打卡 缺勤';
      punchBtnIcon = '⚠';
    } else if (isEffectiveLate) {
      punchBtnClass = 'late';
      punchBtnText = '点击打卡 迟到';
      punchBtnIcon = '⏰';
    } else if (effectiveStatus === AttendanceStatus.LEAVE || effectiveStatus === 'leave') {
      punchBtnClass = 'leave';
      punchBtnText = '点击打卡 休假';
      punchBtnIcon = '🏖';
    } else if (effectiveStatus === AttendanceStatus.SICK || effectiveStatus === 'sick') {
      punchBtnClass = 'sick';
      punchBtnText = '点击打卡 病假';
      punchBtnIcon = '🏥';
    } else if (effectiveStatus === 'custom' || effectiveStatus === AttendanceStatus.CUSTOM) {
      punchBtnClass = 'custom';
      punchBtnText = `点击打卡 ${slot?.customStatusName || '自定义'}`;
      punchBtnIcon = '📝';
    } else if (hasPresetStatusLabel) {
      punchBtnClass = 'custom';
      punchBtnText = `点击打卡 ${selectedStatusOption.label}`;
      punchBtnIcon = '📝';
    }

    // 获取状态标签（右上角小标签，仅用于未打卡状态）
    const getStatusBadge = () => {
      // 已打卡状态不在这里显示，会在操作区域大图标显示
      if (isDone) return '';
      // 🔴 用户选择了非自动状态（休假/病假/自定义），显示对应状态
      if (userSelectedNonAutoStatus) {
        if (effectiveStatus === AttendanceStatus.LEAVE || effectiveStatus === 'leave') {
          return `<span class="ck-status-badge leave">🏖 休假</span>`;
        }
        if (effectiveStatus === AttendanceStatus.SICK || effectiveStatus === 'sick') {
          return `<span class="ck-status-badge sick">🏥 病假</span>`;
        }
        if (effectiveStatus === 'custom' || effectiveStatus === AttendanceStatus.CUSTOM) {
          return `<span class="ck-status-badge custom">📝 ${slot?.customStatusName || '自定义'}</span>`;
        }
        if (hasPresetStatusLabel) {
          return `<span class="ck-status-badge custom">📝 ${selectedStatusOption.label}</span>`;
        }
      }
      if (isEffectiveAbsent) return `<span class="ck-status-badge absent">⚠ 未打卡</span>`;
      if (isEffectiveLate) return `<span class="ck-status-badge late">⏰ 迟到中</span>`;
      if (isTooEarly) return `<span class="ck-status-badge waiting">⏳ 等待中</span>`;
      if (canPunch) return `<span class="ck-status-badge active">📍 请打卡</span>`;
      if (isPast) return `<span class="ck-status-badge past">📝 需补录</span>`;
      return '';
    };

    // 获取左侧彩色条颜色
    const barColors = {
      morning: 'linear-gradient(180deg, #ff6b6b, #ff8e53)',
      afternoon: 'linear-gradient(180deg, #ffc107, #ff9800)',
      evening: 'linear-gradient(180deg, #667eea, #764ba2)'
    };
    const barColor = barColors[cfg.key] || barColors.morning;

    // 🔴 确定状态显示（在模板外部计算）
    const isCustomStatus = slot?.status === 'custom' || slot?.status === AttendanceStatus.CUSTOM;
    const customStatusName = slot?.customStatusName || '自定义';
    const tempOut = slot?.tempOut; // 🔴 临时外出信息
    let resultStatusClass = 'success';
    let resultStatusIcon = '✓';
    let resultStatusText = '正常上线';

    if (isDone) {
      // 🔴 优先显示临时外出信息
      if (tempOut && tempOut.reasonLabel) {
        resultStatusClass = 'tempout';
        resultStatusIcon = '📤';
        const timeRange = tempOut.leaveTime + (tempOut.returnTime ? ' - ' + tempOut.returnTime : '');
        resultStatusText = `${tempOut.reasonLabel} ${timeRange}`;
      } else if (slot?.isManual) {
        resultStatusClass = 'manual';
        resultStatusIcon = '✎';
      } else if (isEffectiveAbsent) {
        resultStatusClass = 'absent';
        resultStatusIcon = '⚠';
        resultStatusText = '缺勤';
      } else if (isEffectiveLate) {
        resultStatusClass = 'late';
        resultStatusIcon = '⏰';
        resultStatusText = '迟到';
      } else if (slot?.status === AttendanceStatus.LEAVE || slot?.status === 'leave') {
        resultStatusClass = 'leave';
        resultStatusIcon = '🏖';
        resultStatusText = '休假';
      } else if (slot?.status === AttendanceStatus.SICK || slot?.status === 'sick') {
        resultStatusClass = 'sick';
        resultStatusIcon = '🏥';
        resultStatusText = '病假';
      } else if (isCustomStatus) {
        resultStatusClass = 'custom';
        resultStatusIcon = '📝';
        resultStatusText = customStatusName;
      } else if (hasPresetStatusLabel) {
        resultStatusClass = 'custom';
        resultStatusIcon = '📝';
        resultStatusText = selectedStatusOption.label;
      }
    }

    // 🔴 为下拉菜单准备：确定当前应该选中哪个option id
    const currentStatusForDropdown = effectiveStatus || AttendanceStatus.NORMAL;
    // 🔴 修复：找到对应状态的 option id，用于下拉菜单选中匹配
    const currentOptionId = state.statusOptions.find(o => o.value === currentStatusForDropdown)?.id || '';

    return `
      <div class="ck-slot-card-new ${isDone ? 'done' : ''} ${isEffectiveLate ? 'late' : ''} ${isEffectiveAbsent ? 'absent' : ''} ${isCurrentlyLate ? 'currently-late' : ''}" data-slot="${cfg.key}">
        <div class="ck-slot-bar" style="background: ${barColor}"></div>
        <div class="ck-slot-content">
          <div class="ck-slot-header-new">
            <div class="ck-slot-title-row">
              <span class="ck-slot-icon-new">${cfg.icon}</span>
              <div class="ck-slot-title-info">
                <h4>${cfg.label}</h4>
                <p>⏰ 截至 ${cfg.deadline || cfg.endTime}</p>
              </div>
            </div>
            ${getStatusBadge()}
          </div>
          
          ${!isDone && !isEditing ? `
            ${isPast ? `
              ${/* 🔴 补录（过去日期）：只在迟到/缺勤时显示状态+说明 */''}
              ${isEffectiveAbsent || isEffectiveLate ? `
              <div class="ck-slot-note-row">
                <span class="ck-status-text ${isEffectiveAbsent ? 'absent' : 'late'}">
                  ${isEffectiveAbsent ? '❌ 缺勤' : '⏰ 迟到'}
                </span>
                <input type="text" class="ck-notes-input-mini" data-slot="${cfg.key}" placeholder="说明原因..." value="${slot?.notes || ''}">
              </div>
              ` : ''}
            ` : `
              ${/* 🔴 当天：显示下拉菜单和说明输入框 */''}
              <div class="ck-slot-note-row">
                ${isEffectiveAbsent || isEffectiveLate ? `
                  <span class="ck-status-text ${isEffectiveAbsent ? 'absent' : 'late'}">
                    ${isEffectiveAbsent ? '❌ 缺勤' : '⏰ 迟到'}
                  </span>
                ` : `
                  <select class="ck-status-select-mini" data-slot="${cfg.key}">
                    ${state.statusOptions
          .filter(o => o.value !== AttendanceStatus.LATE && o.value !== AttendanceStatus.ABSENT)
          .map(o => {
            const isSelected = currentOptionId === o.id;
            return `<option value="${o.id}" ${isSelected ? 'selected' : ''}>${o.label}</option>`;
          }).join('')}
                    <option value="custom" ${currentStatusForDropdown === 'custom' ? 'selected' : ''}>✏️ 自定义...</option>
                  </select>
                  ${currentStatusForDropdown === 'custom' ? `
                    <input type="text" class="ck-custom-status-input" data-slot="${cfg.key}" 
                           placeholder="输入自定义状态..." value="${slot?.customStatusName || ''}">
                  ` : ''}
                `}
                <input type="text" class="ck-notes-input-mini" data-slot="${cfg.key}" placeholder="说明..." value="${slot?.notes || ''}">
              </div>
            `}
          ` : ''}
          
          <div class="ck-slot-actions-new">
            ${isDone ? `
              <div class="ck-punch-result-new ${resultStatusClass}">
                <span class="result-icon">${resultStatusIcon}</span>
                <div class="result-info">
                  <span class="result-status">已打卡</span>
                  <span class="result-detail">${slot?.isManual ? '手动 · ' : ''}${resultStatusText}</span>
                  <span class="result-time">${formatTime(slot.time)}</span>
                </div>
              </div>
              <button class="ck-btn-tempout" data-tempout="${cfg.key}">📤 外出</button>
              <button class="ck-btn-mini ck-reset-btn" data-slot="${cfg.key}">↻</button>
            ` : isEditing ? `
              <div class="ck-manual-input-new">
                <input type="time" id="ck-manual-time-${cfg.key}" value="${state.manualTime}">
                <select id="ck-manual-status-${cfg.key}" class="ck-manual-status-select">
                  ${state.statusOptions.map(o =>
            `<option value="${o.id}" ${o.value === AttendanceStatus.NORMAL ? 'selected' : ''}>${o.label}</option>`
          ).join('')}
                  <option value="custom">✏️ 自定义...</option>
                </select>
                <input type="text" class="ck-manual-custom-input" id="ck-manual-custom-${cfg.key}" 
                       placeholder="自定义状态名称..." style="display: none;">
                <input type="text" class="ck-manual-note-input" id="ck-manual-note-${cfg.key}" placeholder="说明（必填）..." value="${state.manualNote || ''}">
                <button class="ck-btn primary ck-btn-sm" data-confirm="${cfg.key}">确认</button>
                <button class="ck-btn ck-btn-sm" data-cancel>×</button>
              </div>
            ` : isTooEarly ? `
              <div class="ck-waiting-new">
                <span>⏳ ${cfg.startTime} 开始</span>
                <button class="ck-btn-tempout" data-tempout="${cfg.key}">📤 提前外出</button>
              </div>
            ` : `
              ${canPunch ? `<button class="ck-btn-punch ${punchBtnClass}" data-punch="${cfg.key}">
                <span class="btn-icon">${punchBtnIcon}</span> ${punchBtnText}
              </button>` : ''}
              <button class="ck-btn-manual" data-manual="${cfg.key}">${isPast ? '补录' : '手动'}</button>
              <button class="ck-btn-tempout" data-tempout="${cfg.key}">📤 外出</button>
            `}
          </div>
          
          <div class="ck-task-row">
            <label>📋 任务完成量（填写即报数）</label>
            <div class="ck-task-input-wrapper">
              <div class="ck-task-display" data-slot="${cfg.key}">
                ${slot?.taskCount || '<span class="placeholder">点击右侧按钮选择</span>'}
              </div>
              <button class="ck-task-preset-btn" data-slot="${cfg.key}" title="选择任务">📝</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderSlotCards(record) {
    const config = getDynamicSlotConfig();
    return config.map(cfg => {
      const slot = record.slots[cfg.key];
      return renderSlotCard(cfg, slot, record);
    }).join('');
  }

  // 导出
  window.CheckinRender1 = { renderHeader, renderProgressCard, renderSlotCards };
})();
