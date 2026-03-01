/**
 * 每日打卡模块 - 主入口
 * 整合 checkin-core, checkin-actions, checkin-render1, checkin-render2
 */
(function () {
  'use strict';
  let teamPollTimer = null;
  const TEAM_POLL_INTERVAL = 60000;
  let teamWatchScope = null;

  const escapeHtml = (value) => {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const MODE_DEFAULT_PERIODS = {
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
  };

  const getDefaultPeriodsForMode = (mode) => {
    const base = MODE_DEFAULT_PERIODS[mode] || MODE_DEFAULT_PERIODS.full_time;
    return base.map(period => ({ ...period }));
  };

  /**
   * 🔴 全局重名检测：检查用户名是否已被其他人占用（跨所有组）
   * @param {string} newName - 新用户名
   * @param {string} currentName - 当前用户名（self，用于排除自己）
   * @returns {Promise<{isDuplicate: boolean, existingTeam?: string}>}
   */
  async function checkDuplicateUserName(newName, currentName = '') {
    if (!newName || !newName.trim()) {
      return { isDuplicate: false };
    }

    const trimmedName = newName.trim();
    const trimmedCurrent = (currentName || '').trim();

    // 如果名字没变，不算重名
    if (trimmedName === trimmedCurrent) {
      return { isDuplicate: false };
    }

    try {
      // 调用后端获取所有用户列表
      const result = await window.bridge?.checkin?.getAllUsers?.();
      if (!result?.success || !Array.isArray(result.users)) {
        console.warn('[DailyCheckin] 无法获取用户列表进行重名检测');
        return { isDuplicate: false }; // 无法检测时默认允许
      }

      // 查找是否有同名用户（不区分组别）
      const existingUser = result.users.find(u =>
        (u.userName || '').trim() === trimmedName
      );

      if (existingUser) {
        console.log(`[DailyCheckin] 检测到重名用户: ${trimmedName} (${existingUser.teamName})`);
        return {
          isDuplicate: true,
          existingTeam: existingUser.teamName || 'default'
        };
      }

      return { isDuplicate: false };
    } catch (error) {
      console.warn('[DailyCheckin] 重名检测失败:', error);
      return { isDuplicate: false }; // 出错时默认允许
    }
  }

  /**
   * 🔴 用户管理弹窗（显示所有用户）
   */
  async function showUserManagerDialog(C) {
    if (document.getElementById('ck-user-manager-overlay')) return;

    // 获取所有用户（跨所有组）
    const usersResult = await window.bridge?.checkin?.getAllUsers?.();
    if (!usersResult?.success) {
      C.showToast?.(usersResult?.error || '获取用户列表失败');
      return;
    }

    const users = usersResult.users || [];

    const overlay = document.createElement('div');
    overlay.id = 'ck-user-manager-overlay';
    overlay.className = 'ck-modal-overlay ck-user-manager-overlay';

    const usersHtml = users.length
      ? users.map(u => `
        <div class="ck-user-row" data-username="${escapeHtml(u.userName)}" data-team="${escapeHtml(u.teamName)}">
          <div class="ck-user-info">
            <span class="ck-user-name">${escapeHtml(u.userName)}</span>
            <span class="ck-user-count">${u.recordCount} 条记录 · ${escapeHtml(u.teamName)}</span>
          </div>
          <div class="ck-user-actions">
            <button class="ck-btn-mini ck-user-rename" title="重命名">✏️</button>
            <button class="ck-btn-mini ck-user-delete danger" title="删除">🗑</button>
          </div>
        </div>
      `).join('')
      : '<p class="ck-user-empty">暂无用户记录</p>';

    overlay.innerHTML = `
      <div class="ck-modal ck-user-manager-modal ${C.state?.isDark ? 'dark' : ''}">
        <div class="ck-modal-header">
          <h3>👥 用户管理</h3>
          <button id="ck-user-manager-close">×</button>
        </div>
        <div class="ck-modal-body">
          <p class="ck-user-manager-hint">管理所有组的提交人，可重命名或删除用户及其所有记录。共 ${users.length} 人。</p>
          <div class="ck-user-list" id="ck-user-manager-list">
            ${usersHtml}
          </div>
        </div>
        <div class="ck-modal-footer">
          <button class="ck-btn ghost" id="ck-user-manager-cancel">关闭</button>
          <button class="ck-btn" id="ck-user-manager-refresh">🔄 刷新</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const userListEl = overlay.querySelector('#ck-user-manager-list');
    const closeDialog = () => overlay.remove();

    // 刷新用户列表
    const refreshUserList = async () => {
      userListEl.innerHTML = '<p class="ck-user-empty">加载中...</p>';
      const result = await window.bridge?.checkin?.getAllUsers?.();
      const newUsers = result?.users || [];

      userListEl.innerHTML = newUsers.length
        ? newUsers.map(u => `
          <div class="ck-user-row" data-username="${escapeHtml(u.userName)}" data-team="${escapeHtml(u.teamName)}">
            <div class="ck-user-info">
              <span class="ck-user-name">${escapeHtml(u.userName)}</span>
              <span class="ck-user-count">${u.recordCount} 条记录 · ${escapeHtml(u.teamName)}</span>
            </div>
            <div class="ck-user-actions">
              <button class="ck-btn-mini ck-user-rename" title="重命名">✏️</button>
              <button class="ck-btn-mini ck-user-delete danger" title="删除">🗑</button>
            </div>
          </div>
        `).join('')
        : '<p class="ck-user-empty">暂无用户记录</p>';

      bindUserActions();
    };

    // 绑定用户操作按钮
    const bindUserActions = () => {
      // 重命名按钮
      userListEl.querySelectorAll('.ck-user-rename').forEach(btn => {
        btn.addEventListener('click', async () => {
          const row = btn.closest('.ck-user-row');
          const oldName = row?.dataset?.username;
          const teamName = row?.dataset?.team;
          if (!oldName || !teamName) return;

          const newName = prompt(`将 "${oldName}" 重命名为：`, oldName);
          if (!newName || newName.trim() === oldName) return;

          const trimmedNewName = newName.trim();

          // 🔴 检查重名（跨所有组）
          const duplicateCheck = await checkDuplicateUserName(trimmedNewName, oldName);
          if (duplicateCheck.isDuplicate) {
            C.showToast?.(`❌ 用户名 "${trimmedNewName}" 已被占用（组别: ${duplicateCheck.existingTeam}），请使用其他名字！`);
            return;
          }

          const res = await window.bridge?.checkin?.renameUser?.(oldName, trimmedNewName, teamName);
          C.showToast?.(res?.message || (res?.success ? '重命名成功' : '重命名失败'));
          if (res?.success) {
            C.fetchTeamRecords?.({ silent: true }).then(() => render());
            refreshUserList();
          }
        });
      });

      // 删除按钮
      userListEl.querySelectorAll('.ck-user-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const row = btn.closest('.ck-user-row');
          const userName = row?.dataset?.username;
          const teamName = row?.dataset?.team;
          if (!userName || !teamName) return;

          if (!confirm(`确定删除用户 "${userName}" (${teamName}) 及其所有记录吗？此操作不可恢复！`)) return;

          const res = await window.bridge?.checkin?.deleteUser?.(userName, teamName);
          C.showToast?.(res?.message || (res?.success ? '删除成功' : '删除失败'));
          if (res?.success) {
            C.fetchTeamRecords?.({ silent: true }).then(() => render());
            refreshUserList();
          }
        });
      });
    };

    overlay.querySelector('#ck-user-manager-close')?.addEventListener('click', closeDialog);
    overlay.querySelector('#ck-user-manager-cancel')?.addEventListener('click', closeDialog);
    overlay.querySelector('#ck-user-manager-refresh')?.addEventListener('click', refreshUserList);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });

    // 初始绑定按钮事件
    bindUserActions();
  }

  function getTeamWatchParams(state) {
    if (state.profile.overviewAllTeams) {
      return { allTeams: true };
    }
    const normalizedTeam = window.CheckinCore?.normalizeTeamName?.(state.profile.teamName) || state.profile.teamName || 'default';
    return { teamName: normalizedTeam };
  }

  function startTeamRealtimeWatch(state) {
    if (!window.bridge?.checkin?.watchAllRecords) return;
    const params = getTeamWatchParams(state);
    const scopeKey = params.allTeams ? 'all' : params.teamName;
    if (teamWatchScope === scopeKey) return;
    teamWatchScope = scopeKey;
    window.bridge.checkin.watchAllRecords(params).then(result => {
      if (result?.success) {
        console.log('[DailyCheckin] Firebase 实时监听已启动');
      }
    });
  }

  function restartTeamRealtimeWatch(state) {
    if (window.bridge?.checkin?.stopWatchRecords) {
      window.bridge.checkin.stopWatchRecords();
    }
    teamWatchScope = null;
    startTeamRealtimeWatch(state);
  }

  function render() {
    const container = document.getElementById('daily-checkin-content');
    if (!container) return;

    const C = window.CheckinCore;
    const R1 = window.CheckinRender1;
    const R2 = window.CheckinRender2;
    if (!C || !R1 || !R2) { console.warn('[Checkin] Modules not loaded'); return; }

    const { state, getActiveRecord, saveToStorage } = C;

    // 🔴 渲染打卡标签页内容
    function renderPunchTab(record) {
      const effectiveMode = C.getEffectiveMode();
      const isTemp = state.todayMode && state.todayModeDate === C.formatDate(new Date());
      return `
        <div class="ck-today-mode-bar ${isTemp ? 'temp-mode' : ''}">
          <span class="ck-today-mode-label">📅 今日时间模式${isTemp ? '（临时）' : ''}：</span>
          <div class="ck-today-mode-options">
            <button class="ck-today-mode-btn ${effectiveMode === 'full_time' ? 'active' : ''}" data-mode="full_time">👤 全天人员</button>
            <button class="ck-today-mode-btn ${effectiveMode === 'working' ? 'active' : ''}" data-mode="working">💼 上班人员</button>
            <button class="ck-today-mode-btn ${effectiveMode === 'student' ? 'active' : ''}" data-mode="student">🎓 上学人员</button>
            <button class="ck-today-mode-btn ${effectiveMode === 'other' ? 'active' : ''}" data-mode="other">⚡ ${state.profile.customModeLabel || '自定义'}</button>
          </div>
        </div>
        <div class="ck-slots-row">${R1.renderSlotCards(record)}</div>
        <div class="ck-stats-sleep-row">
          ${R2.renderSidebar(record)}
          ${R2.renderSleepCard(record)}
        </div>
        ${R1.renderProgressCard(record)}
      `;
    }

    // 同步提交人
    const submitInput = document.getElementById('meta-submit');
    if (submitInput?.value && !state.profile.name) {
      state.profile.name = submitInput.value;
      saveToStorage();
    }

    const record = getActiveRecord();

    container.innerHTML = `
      <div class="ck-app ${state.isDark ? 'dark' : 'light'}">
        ${R1.renderHeader(record)}
        
        <main class="ck-main ${state.activeTab === 'team' || state.activeTab === 'report' || state.activeTab === 'stats' ? 'full-width' : ''}">
          <div class="ck-content">
            ${state.activeTab === 'punch' ? renderPunchTab(record) : state.activeTab === 'history' ? R2.renderHistory()
        : state.activeTab === 'report' ? (window.CheckinReport?.getFullPageHtml?.() || window.CheckinReport?.getRecordsPanelHtml?.() || '')
          : state.activeTab === 'stats' ? (window.CheckinStats?.renderStats?.() || '<p>统计模块加载中...</p>')
            : R2.renderTeamOverview()
      }
          </div >
        </main >

    ${R2.renderSettings()}
        ${R2.renderToast()}
      </div >
    `;

    // 渲染报数记录
    if (state.activeTab === 'report' && window.CheckinReport?.renderRecordsPanel) {
      window.CheckinReport.renderRecordsPanel();
    }

    // 绑定统计模块事件
    if (state.activeTab === 'stats' && window.CheckinStats?.bindStatsEvents) {
      window.CheckinStats.bindStatsEvents(render);
    }

    bindEvents();
  }

  function bindEvents() {
    const C = window.CheckinCore;
    const A = window.CheckinActions;
    if (!C || !A) return;
    const { state, saveToStorage, formatDate } = C;

    // Tab 切换
    document.querySelectorAll('.ck-tab').forEach(btn => {
      btn.onclick = () => {
        state.activeTab = btn.dataset.tab;
        render();
        if (state.activeTab === 'team' && C.fetchTeamRecords) {
          const overviewAllTeams = state.profile.overviewAllTeams === true;
          C.fetchTeamRecords({ silent: true, allTeams: overviewAllTeams }).then(result => {
            if (result?.success) render();
          });
        }
      };
    });

    // 主题切换
    document.getElementById('ck-theme-toggle')?.addEventListener('click', A.toggleTheme);

    // 设置
    document.getElementById('ck-settings-btn')?.addEventListener('click', () => { state.showSettings = true; render(); });
    document.getElementById('ck-close-settings')?.addEventListener('click', () => { state.showSettings = false; render(); });
    document.getElementById('ck-settings-overlay')?.addEventListener('click', e => { if (e.target.id === 'ck-settings-overlay') { state.showSettings = false; render(); } });
    // 🔴 团队总览未登录时的"前往设置"按钮
    document.getElementById('ck-goto-settings-from-team')?.addEventListener('click', () => { state.showSettings = true; render(); });

    // 日期导航
    document.getElementById('ck-prev-day')?.addEventListener('click', () => A.changeViewDate(-1));
    document.getElementById('ck-next-day')?.addEventListener('click', () => A.changeViewDate(1));
    document.getElementById('ck-prev-month')?.addEventListener('click', () => { state.viewDate.setMonth(state.viewDate.getMonth() - 1); render(); });
    document.getElementById('ck-next-month')?.addEventListener('click', () => { state.viewDate.setMonth(state.viewDate.getMonth() + 1); render(); });

    // 日期选择器
    const dateInput = document.getElementById('ck-date-input');
    const datePicker = document.getElementById('ck-date-picker');
    datePicker?.addEventListener('click', () => dateInput?.showPicker?.() || dateInput?.focus());
    dateInput?.addEventListener('change', e => {
      const selectedDate = new Date(e.target.value);
      if (selectedDate <= new Date()) {
        state.viewDate = selectedDate;
        render();
      }
    });

    // 历史日历点击
    document.querySelectorAll('.ck-day-card:not(.future)').forEach(day => {
      day.onclick = () => {
        const dateStr = day.dataset.date;
        if (!dateStr) return;
        state.viewDate = new Date(dateStr);

        // 🔴 修复：优先从 teamRecords（Firebase 实时监听）中获取数据
        const teamName = state.profile.teamName || 'default';
        const allRecords = (state.teamRecords || []).filter(r => (r.teamName || 'default') === teamName);
        let targetMember = state.profile.name || '';
        if (targetMember) {
          const match = allRecords.find(r => r.date === dateStr && r.userName === targetMember);
          if (!match) {
            const fallback = allRecords.find(r => r.date === dateStr);
            if (fallback?.userName) targetMember = fallback.userName;
          }
        } else {
          const fallback = allRecords.find(r => r.date === dateStr);
          targetMember = fallback?.userName || '';
        }

        state.historyDetailDate = dateStr;
        state.historyDetailMember = targetMember || null;
        render();
      };
    });

    // 团队总览事件
    document.getElementById('ck-team-prev-month')?.addEventListener('click', () => { state.viewDate.setMonth(state.viewDate.getMonth() - 1); render(); });
    document.getElementById('ck-team-next-month')?.addEventListener('click', () => { state.viewDate.setMonth(state.viewDate.getMonth() + 1); render(); });

    // 🔴 新增：团队总览详情列折叠/展开
    document.getElementById('ck-team-toggle-details')?.addEventListener('click', () => {
      const isExpanded = state.teamOverviewExpanded !== false;
      state.teamOverviewExpanded = !isExpanded;
      saveToStorage();
      render();
    });

    // 🔴 今日模式切换（临时模式，不影响设置中的永久模式）
    document.querySelectorAll('.ck-today-mode-btn').forEach(btn => {
      btn.onclick = () => {
        const newMode = btn.dataset.mode;
        const effectiveMode = C.getEffectiveMode();

        if (newMode === effectiveMode) return; // 已是当前模式

        if (!state.profile.modeTargetPeriods) {
          state.profile.modeTargetPeriods = {};
        }

        if (effectiveMode === state.profile.mode) {
          state.profile.modeTargetPeriods[state.profile.mode] = state.profile.targetPeriods.map(period => ({ ...period }));
        }

        // 🔴 设置今日临时模式（不修改 profile.mode）
        C.setTodayMode(newMode);

        // 🔴 加载对应模式的时间段配置
        if (state.profile.modeTargetPeriods[newMode]) {
          state.profile.targetPeriods = [...state.profile.modeTargetPeriods[newMode]];
        } else {
          // 如果没有保存过，使用默认配置
          state.profile.targetPeriods = getDefaultPeriodsForMode(newMode);
        }

        const modeLabels = { full_time: '全天人员', working: '上班人员', student: '上学人员', other: '自定义' };
        C.showToast(`今日临时模式：${modeLabels[newMode] || newMode}（设置中仍为：${modeLabels[state.profile.mode] || state.profile.mode}）`);
        render();
      };
    });

    // 🔴 新增：团队总览排序选择
    document.getElementById('ck-team-sort-mode')?.addEventListener('change', (e) => {
      state.teamOverviewSortMode = e.target.value;
      render();
    });

    // 生成/清除模拟数据
    document.getElementById('ck-generate-mock')?.addEventListener('click', () => { C.generateMockTeamData(); render(); });
    document.getElementById('ck-clear-mock')?.addEventListener('click', () => { C.clearMockData(); render(); });

    // 团队单元格点击查看详情
    document.querySelectorAll('.ck-team-cell:not(.future):not(.empty)').forEach(cell => {
      cell.onclick = () => {
        state.teamDetailMember = cell.dataset.member;
        state.teamDetailDate = cell.dataset.date;
        render();
      };
    });

    // 关闭团队详情弹窗
    document.getElementById('ck-close-team-detail')?.addEventListener('click', () => { state.teamDetailMember = null; state.teamDetailDate = null; render(); });
    document.getElementById('ck-team-detail-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'ck-team-detail-overlay') { state.teamDetailMember = null; state.teamDetailDate = null; render(); }
    });

    // 🔴 时段单元格点击显示完整内容（气泡弹窗）
    document.querySelectorAll('.ck-schedule-clickable').forEach(cell => {
      cell.onclick = (e) => {
        e.stopPropagation();
        const schedule = cell.dataset.schedule || '-';
        const member = cell.dataset.member || '';
        if (schedule && schedule !== '-') {
          // 移除已有的气泡
          document.querySelectorAll('.ck-schedule-popup').forEach(p => p.remove());

          // 创建气泡弹窗
          const popup = document.createElement('div');
          popup.className = 'ck-schedule-popup';
          popup.innerHTML = `
    < div class="popup-header" > ${member} 的上线时段</div >
      <div class="popup-content">${schedule.replace(/ /g, '<br>')}</div>
  `;

          // 定位在单元格附近
          const rect = cell.getBoundingClientRect();
          popup.style.position = 'fixed';
          popup.style.top = `${rect.bottom + 5} px`;
          popup.style.left = `${rect.left} px`;
          popup.style.zIndex = '9999';

          document.body.appendChild(popup);

          // 点击其他地方关闭
          const closePopup = (evt) => {
            if (!popup.contains(evt.target) && evt.target !== cell) {
              popup.remove();
              document.removeEventListener('click', closePopup);
            }
          };
          setTimeout(() => document.addEventListener('click', closePopup), 10);

          // 3秒后自动关闭
          setTimeout(() => popup.remove(), 5000);
        }
      };
    });

    // 关闭历史详情弹窗
    document.getElementById('ck-close-history-detail')?.addEventListener('click', () => { state.historyDetailDate = null; state.historyDetailMember = null; render(); });
    document.getElementById('ck-history-detail-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'ck-history-detail-overlay') { state.historyDetailDate = null; state.historyDetailMember = null; render(); }
    });

    // 打卡按钮
    document.querySelectorAll('[data-punch]').forEach(btn => {
      btn.onclick = () => A.handlePunch(btn.dataset.punch);
    });

    // 手动打卡
    document.querySelectorAll('[data-manual]').forEach(btn => {
      btn.onclick = () => { state.editingSlot = btn.dataset.manual; state.manualTime = '12:00'; state.manualNote = ''; render(); };
    });

    // 确认手动打卡
    document.querySelectorAll('[data-confirm]').forEach(btn => {
      btn.onclick = () => {
        const slot = btn.dataset.confirm;
        const timeInput = document.getElementById('ck-manual-time-' + slot);
        const noteInput = document.getElementById('ck-manual-note-' + slot);
        const statusSelect = document.getElementById('ck-manual-status-' + slot);
        const customInput = document.getElementById('ck-manual-custom-' + slot);
        if (timeInput) state.manualTime = timeInput.value;
        if (noteInput) state.manualNote = noteInput.value;
        // 🔴 传递用户选择的状态和自定义名称
        const selectedStatusId = statusSelect?.value || '';
        const customStatusName = customInput?.value || '';
        A.handlePatchPunch(slot, selectedStatusId, customStatusName);
      };
    });

    // 🔴 手动状态下拉菜单变化时，显示/隐藏自定义输入框
    document.querySelectorAll('.ck-manual-status-select').forEach(sel => {
      sel.onchange = () => {
        const slot = sel.id.replace('ck-manual-status-', '');
        const customInput = document.getElementById('ck-manual-custom-' + slot);
        if (customInput) {
          customInput.style.display = sel.value === 'custom' ? 'block' : 'none';
          if (sel.value === 'custom') customInput.focus();
        }
      };
    });

    // 取消手动
    document.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.onclick = () => { state.editingSlot = null; render(); };
    });

    // 重置打卡
    document.querySelectorAll('.ck-reset-btn').forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); A.resetPunch(btn.dataset.slot); };
    });

    // 🔴 临时外出按钮
    const tempOutReasons = [
      { id: 'temp_work', label: '临时上班', icon: '💼' },
      { id: 'school', label: '上学', icon: '📚' },
      { id: 'activity', label: '参加活动', icon: '🎉' },
      { id: 'party', label: '聚会', icon: '🥳' },
      { id: 'sermon', label: '听讲道', icon: '⛪' },
      { id: 'doctor', label: '看医生', icon: '🏥' },
      { id: 'shopping', label: '买菜', icon: '🛒' },
      { id: 'other', label: '其他', icon: '📝' }
    ];

    document.querySelectorAll('[data-tempout]').forEach(btn => {
      btn.onclick = () => {
        const slotKey = btn.dataset.tempout;
        const slotLabels = { morning: '上午', afternoon: '下午', evening: '晚上' };

        // 移除已存在的对话框
        const existing = document.getElementById('ck-tempout-dialog');
        if (existing) existing.remove();

        const reasonButtonsHtml = tempOutReasons.map(r =>
          `<button type="button" class="ck-tempout-reason-btn" data-reason="${r.id}">${r.icon} ${r.label}</button>`
        ).join('');

        const dialogHtml = `
    <div class="ck-task-dialog-overlay" id="ck-tempout-dialog">
      <div class="ck-task-dialog ck-tempout-dialog">
        <div class="ck-task-dialog-header">
          <span class="icon">📤</span>
          <h3>${slotLabels[slotKey] || slotKey} 临时外出</h3>
          <button class="ck-task-dialog-close" id="ck-tempout-close">✕</button>
        </div>
        <div class="ck-task-dialog-body">
          <p class="hint">选择外出原因：</p>
          <div class="ck-tempout-reasons">${reasonButtonsHtml}</div>
          <div class="ck-tempout-time-row">
            <label>离开时间</label>
            <input type="time" id="ck-tempout-leave" value="${new Date().toTimeString().slice(0, 5)}">
            <label>预计返回</label>
            <input type="time" id="ck-tempout-return" value="">
          </div>
          <input type="text" id="ck-tempout-custom-reason" class="ck-tempout-note" placeholder="请输入自定义原因..." style="display: none;">
          <input type="text" id="ck-tempout-note" class="ck-tempout-note" placeholder="备注（可选）...">
        </div>
        <div class="ck-task-dialog-footer">
          <button class="ck-btn" id="ck-tempout-cancel">取消</button>
          <button class="ck-btn primary" id="ck-tempout-save" disabled>保存</button>
        </div>
      </div>
    </div>
        `;

        const ckApp = document.querySelector('.ck-app') || document.body;
        ckApp.insertAdjacentHTML('beforeend', dialogHtml);

        const dialog = document.getElementById('ck-tempout-dialog');
        const saveBtn = document.getElementById('ck-tempout-save');
        const customReasonInput = document.getElementById('ck-tempout-custom-reason');
        let selectedReason = null;

        // 原因选择
        dialog.querySelectorAll('.ck-tempout-reason-btn').forEach(rb => {
          rb.onclick = () => {
            dialog.querySelectorAll('.ck-tempout-reason-btn').forEach(b => b.classList.remove('active'));
            rb.classList.add('active');
            selectedReason = rb.dataset.reason;

            // 如果选择"其他"，显示自定义输入框
            if (selectedReason === 'other') {
              customReasonInput.style.display = 'block';
              customReasonInput.focus();
              saveBtn.disabled = !customReasonInput.value.trim();
            } else {
              customReasonInput.style.display = 'none';
              saveBtn.disabled = false;
            }
          };
        });

        // 自定义原因输入时启用保存按钮
        customReasonInput.oninput = () => {
          saveBtn.disabled = !customReasonInput.value.trim();
        };

        // 关闭
        const closeDialog = () => dialog.remove();
        document.getElementById('ck-tempout-close').onclick = closeDialog;
        document.getElementById('ck-tempout-cancel').onclick = closeDialog;
        dialog.onclick = e => { if (e.target === dialog) closeDialog(); };

        // 保存
        saveBtn.onclick = () => {
          const leaveTime = document.getElementById('ck-tempout-leave').value;
          const returnTime = document.getElementById('ck-tempout-return').value;
          const note = document.getElementById('ck-tempout-note').value.trim();

          // 如果选择"其他"，使用自定义原因
          let reasonLabel;
          if (selectedReason === 'other') {
            reasonLabel = customReasonInput.value.trim() || '其他';
          } else {
            reasonLabel = tempOutReasons.find(r => r.id === selectedReason)?.label || selectedReason;
          }

          // 保存到记录
          const record = C.getActiveRecord();
          if (!record.slots[slotKey]) record.slots[slotKey] = { status: C.AttendanceStatus.NORMAL };
          record.slots[slotKey].tempOut = {
            reason: selectedReason,
            reasonLabel: reasonLabel,
            leaveTime: leaveTime,
            returnTime: returnTime || null,
            note: note
          };
          record.slots[slotKey].status = selectedReason; // 用外出原因作为状态
          record.slots[slotKey].time = new Date().toISOString();
          C.updateRecord(record);

          closeDialog();
          render();
          C.showToast(`✓ 已记录外出：${reasonLabel} ${leaveTime}${returnTime ? ' - ' + returnTime : ''}`);
        };
      };
    });

    // 状态选择
    document.querySelectorAll('.ck-status-select').forEach(sel => {
      sel.onchange = () => A.updateSlotStatus(sel.dataset.slot, sel.value);
    });

    // 🔴 mini版状态选择（卡片内的下拉菜单）
    document.querySelectorAll('.ck-status-select-mini').forEach(sel => {
      sel.onchange = () => {
        const slotKey = sel.dataset.slot;
        const value = sel.value;
        const slotCard = sel.closest('.ck-slot-card-new');
        const punchBtn = slotCard?.querySelector('.ck-btn-punch');

        if (value === 'custom') {
          // 选择自定义，设置状态为 custom 并触发重新渲染显示输入框
          const record = C.getActiveRecord();
          if (!record.slots[slotKey]) record.slots[slotKey] = {};
          record.slots[slotKey].status = 'custom';
          C.updateRecord(record);
          render();
        } else {
          // 选择预设状态，更新按钮显示
          const option = state.statusOptions.find(o => o.id === value);
          if (option && punchBtn) {
            const icons = {
              normal: '✓', leave: '🏖', sick: '🏥',
              temp_work: '💼', school: '📚', activity: '🎉',
              party: '🥳', sermon: '⛪', doctor: '🏥', shopping: '🛒'
            };
            const icon = icons[option.value] || '📝';
            punchBtn.innerHTML = `<span class="btn-icon">${icon}</span> 点击打卡 ${option.label}`;
          }
          A.updateSlotStatus(slotKey, value);
        }
      };
    });

    // 🔴 自定义状态输入
    document.querySelectorAll('.ck-custom-status-input').forEach(input => {
      input.oninput = () => {
        const slotKey = input.dataset.slot;
        if (!slotKey) return;
        const label = input.value.trim() || '自定义';
        const slotCard = input.closest('.ck-slot-card-new');
        const punchBtn = slotCard?.querySelector('.ck-btn-punch');
        if (punchBtn) {
          punchBtn.textContent = '📝 ' + label;
        }
      };
      input.onblur = () => {
        const slotKey = input.dataset.slot;
        const value = input.value.trim();
        const record = C.getActiveRecord();
        if (!record.slots[slotKey]) record.slots[slotKey] = {};
        record.slots[slotKey].status = 'custom';
        record.slots[slotKey].customStatusName = value;
        C.updateRecord(record);
        render(); // 🔴 重渲染以更新按钮显示
      };
      // 回车确认
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          input.blur();
        }
      };
    });

    // 备注输入
    document.querySelectorAll('.ck-notes-input').forEach(input => {
      input.onblur = () => A.updateSlotNotes(input.dataset.slot, input.value);
    });

    // 任务完成量预设按钮 - 🔴 改用按钮点击代替双击
    // 🔴 优先从 CheckinCore 获取动态任务类型（从 Google Sheets 读取）
    const taskPresets = window.CheckinReport?.state?.settings?.presets ||
      (window.CheckinCore?.getReportTaskTypes?.() ||
        ['生成图片', '制作图片', '制作风格图', '制作视频', '生成sora', '图片转视频', 'reels视频', '视频剪辑']);

    // 🔴 绑定预设按钮点击事件
    document.querySelectorAll('.ck-task-preset-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const slotKey = btn.dataset.slot;
        const slotLabels = { morning: '上午', afternoon: '下午', evening: '晚上' };
        const displayEl = document.querySelector(`.ck-task-display[data-slot="${slotKey}"]`);
        const currentValue = displayEl?.textContent?.trim() || '';
        // 过滤掉占位符文本
        const realValue = currentValue === '点击右侧按钮选择' ? '' : currentValue;

        // 创建填写窗口
        const existingDialog = document.getElementById('ck-task-dialog');
        if (existingDialog) existingDialog.remove();

        // 🔴 解析已有任务数据为对象 { 任务名: 数量 }
        const taskCounts = {};
        if (realValue) {
          realValue.split(/[、,，]/).forEach(item => {
            const match = item.trim().match(/^(.+?)\s*[×xX]\s*(\d+)$/);
            if (match) {
              taskCounts[match[1].trim()] = parseInt(match[2]);
            } else if (item.trim()) {
              taskCounts[item.trim()] = 1;
            }
          });
        }

        // 🔴 获取收藏的任务
        const favoriteTypes = C.getFavoriteTaskTypes?.() || [];

        // 🔴 生成预设按钮HTML，带收藏星标
        const generatePresetBtn = (p, isFav = false) => {
          const count = taskCounts[p] || 0;
          const activeClass = count > 0 ? 'active' : '';
          const favClass = isFav ? 'favorite' : '';
          return `<button type="button" class="ck-task-dialog-preset ${activeClass} ${favClass}" data-preset="${p}">
            <span class="fav-star" data-fav="${p}" title="${isFav ? '取消收藏' : '收藏'}">★</span>
            <span class="task-name">${p}</span>
            ${count > 0 ? ` <span class="count-badge">×${count}</span>` : ''}
          </button>`;
        };

        // 🔴 分离常用和全部任务
        const favoritePresets = taskPresets.filter(p => favoriteTypes.includes(p));
        const allPresetsHtml = taskPresets.map(p => generatePresetBtn(p, favoriteTypes.includes(p))).join('');
        // 🔴 常用区按钮简化版（不显示星标和数量）
        const favoritePresetsHtml = favoritePresets.length > 0
          ? favoritePresets.map(p => `<button type="button" class="ck-task-dialog-preset favorite" data-preset="${p}"><span class="task-name">${p}</span></button>`).join('')
          : '<span class="no-fav-hint">点击 ★ 收藏常用任务</span>';

        const dialogHtml = `
          <div class="ck-task-dialog-overlay" id="ck-task-dialog">
            <div class="ck-task-dialog">
              <div class="ck-task-dialog-header">
                <span class="icon">📋</span>
                <h3>${slotLabels[slotKey] || slotKey} 任务完成量</h3>
                <button class="ck-task-dialog-close" id="ck-task-dialog-close">✕</button>
              </div>
              <div class="ck-task-dialog-body">
                ${favoritePresets.length > 0 ? `
                <p class="hint">⭐ 常用任务：</p>
                <div class="ck-task-dialog-favorites">${favoritePresetsHtml}</div>
                <p class="hint" style="margin-top: 12px;">📋 全部任务：</p>
                ` : `
                <p class="hint">点击任务类型添加（点 ★ 收藏常用）：</p>
                `}
                <div class="ck-task-dialog-presets">${allPresetsHtml}</div>
                <div class="ck-task-count-input" id="ck-task-count-area" style="display: none;">
                  <label id="ck-task-count-label">选择数量：</label>
                  <div class="ck-task-count-controls">
                    <button type="button" class="ck-count-btn" id="ck-count-minus">−</button>
                    <input type="number" id="ck-task-count" value="1" min="0" max="99">
                    <button type="button" class="ck-count-btn" id="ck-count-plus">+</button>
                    <button type="button" class="ck-count-add-btn" id="ck-count-add">✓ 添加</button>
                    <button type="button" class="ck-count-fav-btn" id="ck-count-fav" title="加入常用">★</button>
                  </div>
                </div>
                <p class="ck-task-summary-label">已选任务：</p>
                <div id="ck-task-summary-display" class="ck-task-summary-display">${realValue || '<span class="placeholder">暂未选择任务</span>'}</div>
                <input type="hidden" id="ck-task-summary" value="${realValue}">
                <p class="ck-task-summary-label" style="margin-top: 12px;">📝 备注说明：</p>
                <input type="text" id="ck-task-note" class="ck-task-note-input" placeholder="${realValue ? '输入备注...' : '选择任务后可添加备注'}" value="" ${realValue ? '' : 'disabled'}>
              </div>
              <div class="ck-task-dialog-footer">
                <button class="ck-btn" id="ck-task-dialog-cancel">取消</button>
                <button class="ck-btn primary" id="ck-task-dialog-save">保存</button>
              </div>
            </div>
          </div>
        `;

        // 插入到 .ck-app 容器内，使主题样式生效
        const ckApp = document.querySelector('.ck-app') || document.body;
        ckApp.insertAdjacentHTML('beforeend', dialogHtml);

        const dialog = document.getElementById('ck-task-dialog');
        let currentPreset = null;

        // 🔴 更新摘要显示
        const updateSummary = () => {
          const items = Object.entries(taskCounts)
            .filter(([_, count]) => count > 0)
            .map(([name, count]) => `${name} ×${count}`);
          const summaryText = items.length ? items.join('、') : '';

          // 🔴 更新隐藏 input 的值
          const summaryInput = document.getElementById('ck-task-summary');
          if (summaryInput) {
            summaryInput.value = summaryText;
          }

          // 🔴 更新显示区域
          const summaryDisplay = document.getElementById('ck-task-summary-display');
          if (summaryDisplay) {
            summaryDisplay.innerHTML = summaryText || '<span class="placeholder">暂未选择任务</span>';
          }

          // 更新按钮状态（只更新 count-badge，保持其他结构）
          dialog.querySelectorAll('.ck-task-dialog-preset').forEach(btn => {
            const preset = btn.dataset.preset;
            const count = taskCounts[preset] || 0;
            btn.classList.toggle('active', count > 0);

            // 更新或创建 count-badge
            let badge = btn.querySelector('.count-badge');
            if (count > 0) {
              if (badge) {
                badge.textContent = `×${count}`;
              } else {
                const badgeEl = document.createElement('span');
                badgeEl.className = 'count-badge';
                badgeEl.textContent = `×${count}`;
                btn.appendChild(badgeEl);
              }
            } else if (badge) {
              badge.remove();
            }
          });

          // 🔴 控制备注输入框：有任务才能填写备注
          const noteInput = document.getElementById('ck-task-note');
          if (noteInput) {
            if (items.length > 0) {
              noteInput.disabled = false;
              noteInput.placeholder = '输入备注...';
            } else {
              noteInput.disabled = true;
              noteInput.placeholder = '选择任务后可添加备注';
              noteInput.value = '';
            }
          }
        };

        // 🔴 动态更新常用任务区域（收藏后调用）
        const updateFavoritesSection = () => {
          const latestFavorites = C.getFavoriteTaskTypes?.() || [];
          const favoritesContainer = dialog.querySelector('.ck-task-dialog-favorites');
          const dialogBody = dialog.querySelector('.ck-task-dialog-body');

          if (!dialogBody) return;

          // 找到常用区域的提示文字和容器
          const hints = dialogBody.querySelectorAll('p.hint');
          let favHint = null;
          let allHint = null;
          hints.forEach(h => {
            if (h.textContent.includes('常用任务')) favHint = h;
            if (h.textContent.includes('全部任务')) allHint = h;
            if (h.textContent.includes('点击任务类型添加')) allHint = h;
          });

          // 生成新的常用任务 HTML
          const favoritePresetsList = taskPresets.filter(p => latestFavorites.includes(p));
          const newFavoritesHtml = favoritePresetsList.length > 0
            ? favoritePresetsList.map(p => `<button type="button" class="ck-task-dialog-preset favorite" data-preset="${p}"><span class="task-name">${p}</span></button>`).join('')
            : '<span class="no-fav-hint">点击 ★ 收藏常用任务</span>';

          if (favoritePresetsList.length > 0) {
            // 需要显示常用区域
            if (!favHint) {
              // 创建常用区域
              const newFavHint = document.createElement('p');
              newFavHint.className = 'hint';
              newFavHint.textContent = '⭐ 常用任务：';
              const newFavContainer = document.createElement('div');
              newFavContainer.className = 'ck-task-dialog-favorites';
              newFavContainer.innerHTML = newFavoritesHtml;
              const newAllHint = document.createElement('p');
              newAllHint.className = 'hint';
              newAllHint.style.marginTop = '12px';
              newAllHint.textContent = '📋 全部任务：';

              const presetsContainer = dialog.querySelector('.ck-task-dialog-presets');
              if (presetsContainer && allHint) {
                allHint.textContent = '📋 全部任务：';
                allHint.style.marginTop = '12px';
                presetsContainer.parentNode.insertBefore(newFavHint, allHint);
                presetsContainer.parentNode.insertBefore(newFavContainer, allHint);
              }
            } else if (favoritesContainer) {
              // 更新现有常用区域
              favoritesContainer.innerHTML = newFavoritesHtml;
            }
          } else {
            // 没有常用任务，移除常用区域
            if (favHint) favHint.remove();
            if (favoritesContainer) favoritesContainer.remove();
            if (allHint) {
              allHint.textContent = '点击任务类型添加（点 ★ 收藏常用）：';
              allHint.style.marginTop = '';
            }
          }

          // 🔴 重新绑定常用区域的点击事件
          dialog.querySelectorAll('.ck-task-dialog-favorites .ck-task-dialog-preset').forEach(presetBtn => {
            presetBtn.onclick = (e) => {
              currentPreset = presetBtn.dataset.preset;
              const countArea = document.getElementById('ck-task-count-area');
              const countInput = document.getElementById('ck-task-count');
              const countLabel = document.getElementById('ck-task-count-label');

              countArea.style.display = 'flex';
              countLabel.textContent = `${currentPreset} 数量：`;
              countInput.value = taskCounts[currentPreset] || 1;
              countInput.focus();
              countInput.select();

              const favBtn = document.getElementById('ck-count-fav');
              if (favBtn) {
                const isFav = C.isTaskFavorite?.(currentPreset) || false;
                favBtn.classList.toggle('active', isFav);
                favBtn.title = isFav ? '取消常用' : '加入常用';
              }
            };
          });
        };

        // 🔴 预设按钮点击 - 区分星标和任务
        dialog.querySelectorAll('.ck-task-dialog-preset').forEach(presetBtn => {
          presetBtn.onclick = (e) => {
            // 🔴 检查是否点击了收藏星标
            const star = e.target.closest('.fav-star');
            if (star) {
              e.stopPropagation();
              const taskName = star.dataset.fav;
              if (C.toggleFavoriteTask) {
                const isFav = C.toggleFavoriteTask(taskName);
                // 更新星标样式
                const allStars = dialog.querySelectorAll(`.fav-star[data-fav="${taskName}"]`);
                allStars.forEach(s => {
                  s.closest('.ck-task-dialog-preset')?.classList.toggle('favorite', isFav);
                  s.title = isFav ? '取消收藏' : '收藏';
                });
                // 🔴 更新常用任务区域
                updateFavoritesSection();
                C.showToast(isFav ? `⭐ 已收藏：${taskName}` : `已取消收藏：${taskName}`, 1500);
              }
              return;
            }

            // 🔴 点击任务本身 - 显示数量输入
            currentPreset = presetBtn.dataset.preset;
            const countArea = document.getElementById('ck-task-count-area');
            const countInput = document.getElementById('ck-task-count');
            const countLabel = document.getElementById('ck-task-count-label');

            countArea.style.display = 'flex';
            countLabel.textContent = `${currentPreset} 数量：`;
            countInput.value = taskCounts[currentPreset] || 1;
            countInput.focus();
            countInput.select();

            // 🔴 更新"加入常用"按钮状态
            const favBtn = document.getElementById('ck-count-fav');
            if (favBtn) {
              const isFav = C.isTaskFavorite?.(currentPreset) || false;
              favBtn.classList.toggle('active', isFav);
              favBtn.title = isFav ? '取消常用' : '加入常用';
            }
          };
        });

        // 🔴 数量加减按钮
        document.getElementById('ck-count-minus').onclick = () => {
          const countInput = document.getElementById('ck-task-count');
          countInput.value = Math.max(0, parseInt(countInput.value) - 1);
          if (currentPreset) {
            taskCounts[currentPreset] = parseInt(countInput.value);
            updateSummary();
          }
        };
        document.getElementById('ck-count-plus').onclick = () => {
          const countInput = document.getElementById('ck-task-count');
          countInput.value = Math.min(99, parseInt(countInput.value) + 1);
          if (currentPreset) {
            taskCounts[currentPreset] = parseInt(countInput.value);
            updateSummary();
          }
        };
        document.getElementById('ck-task-count').oninput = () => {
          const countInput = document.getElementById('ck-task-count');
          if (currentPreset) {
            taskCounts[currentPreset] = parseInt(countInput.value) || 0;
            updateSummary();
          }
        };

        // 🔴 "添加"按钮 - 确认添加当前任务后隐藏输入区
        document.getElementById('ck-count-add').onclick = () => {
          if (currentPreset) {
            const countInput = document.getElementById('ck-task-count');
            taskCounts[currentPreset] = parseInt(countInput.value) || 0;
            updateSummary();
            // 隐藏输入区域
            document.getElementById('ck-task-count-area').style.display = 'none';
            currentPreset = null;
          }
        };

        // 🔴 "加入常用"按钮
        document.getElementById('ck-count-fav').onclick = () => {
          if (currentPreset && C.toggleFavoriteTask) {
            const isFav = C.toggleFavoriteTask(currentPreset);
            const favBtn = document.getElementById('ck-count-fav');
            favBtn.classList.toggle('active', isFav);
            favBtn.title = isFav ? '取消常用' : '加入常用';
            // 更新列表中的星标状态
            dialog.querySelectorAll(`.fav-star[data-fav="${currentPreset}"]`).forEach(star => {
              star.closest('.ck-task-dialog-preset')?.classList.toggle('favorite', isFav);
              star.title = isFav ? '取消收藏' : '收藏';
            });
            // 🔴 更新常用任务区域
            updateFavoritesSection();
            C.showToast(isFav ? `⭐ 已加入常用：${currentPreset}` : `已取消常用：${currentPreset}`, 1500);
          }
        };

        // 关闭按钮
        const closeDialog = () => dialog.remove();
        document.getElementById('ck-task-dialog-close').onclick = closeDialog;
        document.getElementById('ck-task-dialog-cancel').onclick = closeDialog;
        dialog.onclick = (ev) => { if (ev.target === dialog) closeDialog(); };

        // 保存按钮
        document.getElementById('ck-task-dialog-save').onclick = () => {
          // 🔴 从隐藏 input 获取任务数据
          const summaryInput = document.getElementById('ck-task-summary');
          const taskValue = summaryInput ? summaryInput.value.trim() : '';

          // 🔴 获取备注说明
          const noteInput = document.getElementById('ck-task-note');
          const noteValue = noteInput ? noteInput.value.trim() : '';

          // 🔴 组合最终值（任务 + 备注）
          let finalValue = taskValue;
          if (noteValue) {
            finalValue = taskValue ? `${taskValue}（${noteValue}）` : `（${noteValue}）`;
          }

          // 🔴 更新显示区域
          if (displayEl) {
            displayEl.textContent = finalValue || '点击右侧按钮选择';
          }
          const record = C.getActiveRecord();
          if (!record.slots[slotKey]) record.slots[slotKey] = { status: C.AttendanceStatus.NORMAL };
          record.slots[slotKey].taskCount = finalValue;
          record.slots[slotKey].taskNote = noteValue; // 🔴 单独保存备注
          C.updateRecord(record);

          // 🔴 触发报数记录
          if (finalValue) {
            if (window.CheckinReport?.submitReport) {
              const report = { key: slotKey, slot: slotKey, label: slotLabels[slotKey] || slotKey };
              window.CheckinReport.submitReport(report, finalValue, true);
            } else {
              C.showToast('✓ 任务完成量已保存');
            }
          }

          closeDialog();
        };
      };
    });
    // 🔴 已移除：ck-task-input blur 处理（改为只读显示区，通过弹窗选择）


    // 入眠打卡
    document.getElementById('ck-sleep-punch')?.addEventListener('click', A.handleSleepPunch);
    document.getElementById('ck-sleep-manual')?.addEventListener('click', () => { state.editingSlot = 'sleep'; state.manualTime = '23:30'; render(); });
    document.getElementById('ck-early-sleep-reason')?.addEventListener('input', e => { state.earlySleepReason = e.target.value; });

    // 琐事
    document.getElementById('ck-activity-title')?.addEventListener('input', e => { state.newActivityTitle = e.target.value; });
    document.getElementById('ck-activity-leave')?.addEventListener('change', e => { state.activityLeaveTime = e.target.value; });
    document.getElementById('ck-activity-return')?.addEventListener('change', e => { state.activityReturnTime = e.target.value; });
    document.getElementById('ck-add-activity')?.addEventListener('click', A.addCustomActivity);
    document.querySelectorAll('.ck-remove-activity').forEach(btn => {
      btn.onclick = () => A.removeCustomActivity(btn.dataset.id);
    });

    // 设置面板事件 - 工作模式（与快捷切换器同步）
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.onclick = () => {
        const newMode = btn.dataset.mode;
        const oldMode = state.profile.mode;

        // 🔴 保存当前模式的时间段配置
        if (!state.profile.modeTargetPeriods) {
          state.profile.modeTargetPeriods = {};
        }
        state.profile.modeTargetPeriods[oldMode] = [...state.profile.targetPeriods];

        // 🔴 加载新模式的时间段配置（如果有）
        if (state.profile.modeTargetPeriods[newMode]) {
          state.profile.targetPeriods = [...state.profile.modeTargetPeriods[newMode]];
        } else {
          // 如果没有保存过，使用默认配置
          state.profile.targetPeriods = getDefaultPeriodsForMode(newMode);
        }

        state.profile.mode = newMode;
        saveToStorage();
        render();
      };
    });
    document.getElementById('ck-custom-mode')?.addEventListener('blur', e => { state.profile.customModeLabel = e.target.value; saveToStorage(); });
    // 🔴 组别下拉选择
    document.getElementById('ck-team-name')?.addEventListener('change', e => {
      const selectedValue = e.target.value || '';
      const customInput = document.getElementById('ck-custom-team-name');

      if (selectedValue === '__custom__') {
        // 选择"添加组别"，显示输入框
        if (customInput) {
          customInput.style.display = 'block';
          customInput.value = '';
          customInput.focus();
        }
      } else {
        // 选择预设组别
        if (customInput) customInput.style.display = 'none';
        const normalizedTeam = C.normalizeTeamName?.(selectedValue) ?? selectedValue;
        state.profile.teamName = normalizedTeam;
        saveToStorage();
        // 组别变更后重新启动报数监听
        if (window.CheckinReport?.restartFirebaseWatch) {
          window.CheckinReport.restartFirebaseWatch();
        }
        restartTeamRealtimeWatch(state);
        render(); // 刷新界面
      }
    });

    // 🔴 自定义组别输入框
    document.getElementById('ck-custom-team-name')?.addEventListener('blur', e => {
      const customName = e.target.value.trim();
      if (customName) {
        const normalizedTeam = C.normalizeTeamName?.(customName) ?? customName;
        state.profile.teamName = normalizedTeam;
        saveToStorage();
        // 组别变更后重新启动报数监听
        if (window.CheckinReport?.restartFirebaseWatch) {
          window.CheckinReport.restartFirebaseWatch();
        }
        restartTeamRealtimeWatch(state);
        render();
      }
    });
    document.getElementById('ck-custom-team-name')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.target.blur();
      }
    });

    // 时段管理
    document.getElementById('ck-reset-periods')?.addEventListener('click', () => {
      const currentMode = state.profile.mode || 'full_time';
      const defaults = getDefaultPeriodsForMode(currentMode);
      state.profile.targetPeriods = defaults;
      if (!state.profile.modeTargetPeriods) {
        state.profile.modeTargetPeriods = {};
      }
      state.profile.modeTargetPeriods[currentMode] = defaults.map(period => ({ ...period }));
      saveToStorage();
      C.showToast('已重置当前模式时段');
      render();
    });
    document.getElementById('ck-add-period')?.addEventListener('click', () => {
      state.profile.targetPeriods.push({ name: '', start: '09:00', end: '18:00' });
      saveToStorage(); render();
    });
    document.querySelectorAll('.remove-period').forEach(btn => {
      btn.onclick = () => {
        const row = btn.closest('.period-row');
        const idx = parseInt(row.dataset.index);
        state.profile.targetPeriods.splice(idx, 1);
        saveToStorage(); render();
      };
    });
    document.querySelectorAll('.period-row').forEach(row => {
      const idx = parseInt(row.dataset.index);
      row.querySelector('.period-name')?.addEventListener('blur', e => { state.profile.targetPeriods[idx].name = e.target.value; saveToStorage(); });
      row.querySelector('.period-start')?.addEventListener('change', e => { state.profile.targetPeriods[idx].start = e.target.value; saveToStorage(); });
      row.querySelector('.period-end')?.addEventListener('change', e => { state.profile.targetPeriods[idx].end = e.target.value; saveToStorage(); });
    });

    // 状态标签
    document.getElementById('ck-new-status')?.addEventListener('input', e => { state.newOptionLabel = e.target.value; });
    document.getElementById('ck-add-status')?.addEventListener('click', A.addStatusOption);
    document.querySelectorAll('.remove-status').forEach(btn => {
      btn.onclick = () => A.removeStatusOption(btn.dataset.id);
    });

    // Google Sheets
    document.getElementById('ck-sheets-url')?.addEventListener('blur', e => { state.sheetsUrl = e.target.value; saveToStorage(); });
    document.getElementById('ck-sheet-name')?.addEventListener('blur', e => { state.sheetName = e.target.value; saveToStorage(); });

    // 同步按钮事件
    document.getElementById('ck-sync-all')?.addEventListener('click', async () => {
      await C.syncAllRecords();
    });
    document.getElementById('ck-fetch-team')?.addEventListener('click', async () => {
      C.showToast('正在拉取团队数据...');
      const result = await C.fetchTeamRecords();
      if (result.success) {
        C.showToast(`拉取成功: ${result.total} 条记录`);
        render();
      }
    });

    // 从云端加载设置
    document.getElementById('ck-load-settings')?.addEventListener('click', async () => {
      if (!state.profile.name) {
        C.showToast('请先填写姓名');
        return;
      }
      C.showToast('正在加载设置...');
      const result = await C.loadSettingsFromCloud(state.profile.name);
      if (result.success && result.settings) {
        C.showToast('已从云端加载设置');
        restartTeamRealtimeWatch(state);
        render();
      } else if (result.success) {
        C.showToast('云端暂无此用户的设置');
      } else {
        C.showToast(`加载失败: ${result.error || '未知错误'}`);
      }
    });

    const syncReportSettings = ({ syncCloud = false, showToast = false, rerender = false } = {}) => {
      const voiceText = document.getElementById('ck-report-voice-text')?.value?.trim() || '到点了，请填写任务完成量';
      const presetsText = document.getElementById('ck-report-custom-presets')?.value || '';
      const customPresets = presetsText.split('\n').map(p => p.trim()).filter(p => p);

      // 获取音频模式
      const audioModeRadio = document.querySelector('input[name="ck-report-audio-mode"]:checked');
      const audioMode = audioModeRadio?.value || 'voice';

      // 获取通知范围设置
      const notifyModeRadio = document.querySelector('input[name="ck-report-notify-mode"]:checked');
      const notifyMode = notifyModeRadio?.value || 'all';

      // 获取跨团队总览设置
      const overviewAllTeams = document.getElementById('ck-overview-all-teams')?.checked === true;

      // 🔴 修改：从复选框获取选中的自定义团队
      const customTeamCheckboxes = document.querySelectorAll('.ck-custom-team-checkbox:checked');
      const customTeams = Array.from(customTeamCheckboxes).map(cb => cb.value);

      if (window.CheckinReport) {
        window.CheckinReport.state.settings.audioMode = audioMode;
        window.CheckinReport.state.settings.voiceText = voiceText;
        window.CheckinReport.state.settings.customPresets = customPresets;
        window.CheckinReport.saveSettings();
      }

      // 保存通知范围到 profile
      const prevMode = state.profile.reportNotifyMode;
      const prevOverviewAllTeams = state.profile.overviewAllTeams;
      state.profile.reportNotifyMode = notifyMode;
      state.profile.overviewAllTeams = overviewAllTeams;
      // 🔴 保存自定义团队列表
      state.profile.reportNotifyTeams = customTeams;

      // 保存通知开关（位置设置已移到主应用设置）
      const notifyEnabled = document.getElementById('ck-notify-enabled')?.checked !== false;
      state.profile.notifyEnabled = notifyEnabled;

      // 🔴 保存他人报数提示音开关
      const reportNotifySoundEnabled = document.getElementById('ck-report-notify-sound')?.checked !== false;
      state.profile.reportNotifySoundEnabled = reportNotifySoundEnabled;

      // 🔴 保存通知弹框缩放比例
      const notificationScale = parseInt(document.getElementById('ck-notification-scale')?.value || '100', 10);
      state.profile.notificationScale = notificationScale;

      saveToStorage();

      // 如果模式改变，重新启动监听
      if (prevMode !== notifyMode && window.CheckinReport?.restartFirebaseWatch) {
        window.CheckinReport.restartFirebaseWatch();
      }
      if (prevOverviewAllTeams !== overviewAllTeams) {
        restartTeamRealtimeWatch(state);
        C.showToast('正在刷新团队数据...');
        C.fetchTeamRecords({ silent: false, allTeams: overviewAllTeams }).then(result => {
          if (result?.success) {
            C.showToast('团队数据已刷新');
            render();
          }
        });
      }

      // 🔴 同时保存到云端
      if (syncCloud && C.saveSettingsToCloud && state.profile.name) {
        C.saveSettingsToCloud().then(result => {
          if (result.success) {
            console.log('[Checkin] 设置已同步到云端');
          }
        }).catch(err => {
          console.warn('[Checkin] 云端同步失败:', err);
        });
      }

      if (showToast) {
        C.showToast('设置已保存');
      }
      if (rerender) {
        render();
      }
    };

    // 保存报数设置（手动同步）
    document.getElementById('ck-save-report-settings')?.addEventListener('click', () => {
      syncReportSettings({ syncCloud: true, showToast: true, rerender: true });
    });

    // 🔴 自动保存报数设置（无需手动点击）
    document.getElementById('ck-report-voice-text')?.addEventListener('blur', () => syncReportSettings());
    document.getElementById('ck-report-custom-presets')?.addEventListener('blur', () => syncReportSettings());
    document.querySelectorAll('input[name="ck-report-audio-mode"]').forEach(radio => {
      radio.addEventListener('change', () => syncReportSettings());
    });
    document.querySelectorAll('input[name="ck-report-notify-mode"]').forEach(radio => {
      radio.addEventListener('change', () => syncReportSettings());
    });
    document.getElementById('ck-overview-all-teams')?.addEventListener('change', () => syncReportSettings());
    document.getElementById('ck-notify-enabled')?.addEventListener('change', () => syncReportSettings());
    document.getElementById('ck-report-notify-sound')?.addEventListener('change', () => syncReportSettings());
    document.getElementById('ck-notification-scale')?.addEventListener('change', () => syncReportSettings());
    document.querySelectorAll('.ck-custom-team-checkbox').forEach(cb => {
      cb.addEventListener('change', () => syncReportSettings());
    });

    // 🔴 新增：监听通知模式切换，实时显示/隐藏自定义团队输入框
    document.querySelectorAll('input[name="ck-report-notify-mode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const customTeamsField = document.getElementById('ck-custom-teams-field');
        if (customTeamsField) {
          customTeamsField.style.display = radio.value === 'custom' ? '' : 'none';
        }
      });
    });

    // 🔴 新增：通知弹框缩放滑块实时显示
    const scaleSlider = document.getElementById('ck-notification-scale');
    const scaleValue = document.getElementById('ck-notification-scale-value');
    if (scaleSlider && scaleValue) {
      scaleSlider.addEventListener('input', () => {
        scaleValue.textContent = `${scaleSlider.value}%`;
      });
    }

    // 🔴 时间模拟测试按钮事件绑定
    document.getElementById('ck-apply-debug-time')?.addEventListener('click', () => {
      const timeInput = document.getElementById('ck-debug-time');
      if (timeInput?.value) {
        C.setDebugTime(timeInput.value);
        C.showToast(`⏱️ 已设置模拟时间: ${timeInput.value}`);
      } else {
        C.showToast('请先选择模拟时间');
      }
    });

    document.getElementById('ck-reset-debug-time')?.addEventListener('click', () => {
      C.setDebugTime(null);
      const timeInput = document.getElementById('ck-debug-time');
      if (timeInput) timeInput.value = '';
      C.showToast('🔄 已恢复真实时间');
    });

    // 🔴 打开用户管理弹窗
    document.getElementById('ck-open-user-manager')?.addEventListener('click', () => {
      showUserManagerDialog(C);
    });

    // 🔴 重置数据库按钮
    document.getElementById('ck-reset-database')?.addEventListener('click', async () => {
      // 使用 confirm 链式选择版本
      let targetVersion = null;

      if (confirm('重置 V3 (测试版本) 吗？\n\n点击"确定"重置V3，点击"取消"选择其他版本')) {
        targetVersion = 'V3';
      } else if (confirm('重置 V1 (老数据) 吗？\n\n点击"确定"重置V1，点击"取消"选择V2')) {
        targetVersion = 'V1';
      } else if (confirm('⚠️ 重置 V2 (生产版本) 吗？\n\n这将删除用户正式打卡数据！\n\n点击"确定"重置V2，点击"取消"退出')) {
        targetVersion = 'V2';
      }

      if (!targetVersion) {
        C.showToast('已取消');
        return;
      }

      if (targetVersion === 'V2') {
        if (!confirm('⚠️⚠️ 再次确认！\n\n你选择了重置生产数据 (V2)！\n此操作将永久删除用户的正式打卡数据！\n\n确定继续吗？')) {
          return;
        }
      }

      if (!confirm(`⚠️ 最后确认：重置 ${targetVersion} 数据库？\n\n此操作不可撤销！`)) {
        return;
      }

      C.showToast(`🔄 正在重置 ${targetVersion} 数据库...`);
      try {
        const result = await window.bridge?.checkin?.resetDatabase?.(targetVersion);
        if (result?.success) {
          C.showToast('✅ ' + result.message);
          // 🔴 清空本地缓存的报数记录
          localStorage.removeItem('ck-report-records');
          localStorage.removeItem('ck-report-today-status');
          localStorage.removeItem('ck-report-settings');
          // 清空前端状态
          if (window.CheckinReport?.state) {
            window.CheckinReport.state.records = [];
            window.CheckinReport.state.todayStatus = {};
          }
          // 重新加载数据
          setTimeout(() => {
            location.reload();
          }, 1500);
        } else {
          C.showToast('❌ 重置失败: ' + (result?.message || '未知错误'));
        }
      } catch (error) {
        C.showToast('❌ 重置失败: ' + error.message);
      }
    });

    // 🔴 清理错误数据按钮
    document.getElementById('ck-cleanup-invalid-data')?.addEventListener('click', async () => {
      C.showToast('🔍 正在扫描错误数据...');

      try {
        // 先预览
        const preview = await window.bridge?.checkin?.cleanupInvalidData?.(true);

        if (!preview?.success) {
          C.showToast('❌ 扫描失败: ' + (preview?.message || '未知错误'));
          return;
        }

        if (!preview.preview || preview.preview.length === 0) {
          C.showToast('✅ 没有发现错误数据');
          return;
        }

        // 构建预览信息
        const previewInfo = preview.preview.map(p => {
          const subKeysInfo = p.subKeys.length > 0
            ? `包含: ${p.subKeys.join(', ')}${p.subKeysTotal > 5 ? ` 等${p.subKeysTotal}项` : ''}`
            : '';
          return `• "${p.invalidKey}" - 约${p.recordCount}条记录\n  ${subKeysInfo}`;
        }).join('\n\n');

        const confirmMsg = `🔍 发现 ${preview.totalToDelete} 个错误节点，共约 ${preview.totalRecordCount} 条记录：\n\n${previewInfo}\n\n确定要删除这些错误数据吗？`;

        if (!confirm(confirmMsg)) {
          C.showToast('已取消清理');
          return;
        }

        // 执行删除
        C.showToast('🧹 正在清理错误数据...');
        const result = await window.bridge?.checkin?.cleanupInvalidData?.(false);

        if (result?.success) {
          C.showToast('✅ ' + result.message);
          // 刷新页面
          setTimeout(() => {
            location.reload();
          }, 1500);
        } else {
          C.showToast('❌ 清理失败: ' + (result?.message || '未知错误'));
        }
      } catch (error) {
        C.showToast('❌ 清理失败: ' + error.message);
      }
    });

    // 🔴 数据库版本切换按钮
    const updateVersionDisplay = async () => {
      const versionLabel = document.getElementById('ck-current-db-version');
      if (versionLabel && window.bridge?.checkin?.getDBVersion) {
        const result = await window.bridge.checkin.getDBVersion();
        if (result?.success) {
          const labels = { 'V1': 'V1 (老数据)', 'V2': 'V2 (生产)', 'V3': 'V3 (测试)' };
          const colors = { 'V1': '#64748b', 'V2': '#10b981', 'V3': '#f59e0b' };
          versionLabel.textContent = labels[result.version] || result.version;
          versionLabel.style.color = colors[result.version] || '#10b981';
        }
      }
    };
    updateVersionDisplay();

    // V1/V2/V3 切换按钮
    ['V1', 'V2', 'V3'].forEach(version => {
      document.getElementById(`ck-switch-to-${version.toLowerCase()}`)?.addEventListener('click', async () => {
        const result = await window.bridge?.checkin?.switchDBVersion?.(version);
        if (result?.success) {
          const labels = { 'V1': '老数据', 'V2': '生产版本', 'V3': '测试版本' };
          C.showToast(`✅ 已切换到 ${version} (${labels[version]})，刷新页面查看`);
          updateVersionDisplay();
          setTimeout(() => location.reload(), 1000);
        } else {
          C.showToast('❌ 切换失败: ' + (result?.message || '未知错误'));
        }
      });
    });

    // 🔴 迁移到 V3（测试）
    document.getElementById('ck-migrate-to-v3')?.addEventListener('click', async () => {
      C.showToast('🔍 正在扫描老数据库...');
      try {
        const preview = await window.bridge?.checkin?.migrateV1ToV2?.(true, 'V3');
        if (!preview?.success) {
          C.showToast('❌ 扫描失败: ' + (preview?.message || '未知错误'));
          return;
        }
        if (preview.totalUpdates === 0) {
          C.showToast('✅ 老数据库中没有可迁移的有效数据');
          return;
        }

        let teamDetailsText = '';
        if (preview.teamDetails) {
          Object.entries(preview.teamDetails).forEach(([teamName, data]) => {
            const userList = Object.entries(data.users || {})
              .map(([userName, count]) => `  · ${userName}: ${count}条`)
              .join('\n');
            teamDetailsText += `\n📁 ${teamName} (${data.totalRecords}条)\n${userList}\n`;
          });
        }

        const reportCount = typeof preview.migratedReports === 'number' ? preview.migratedReports : 0;
        const reminderCount = typeof preview.migratedReminders === 'number' ? preview.migratedReminders : 0;
        const confirmMsg = `📦 迁移到 V3 (测试版本)

✅ 可迁移: ${preview.migratedRecords} 条记录, ${preview.migratedSettings} 个设置
📢 报数: ${reportCount} 条
🔔 催报: ${reminderCount} 条
❌ 跳过: ${preview.skippedInvalid} 条无效数据

详细分布:${teamDetailsText}
确定迁移到 V3 (测试) 吗？`;

        if (!confirm(confirmMsg)) {
          C.showToast('已取消');
          return;
        }

        C.showToast('📦 正在迁移到 V3...');
        const result = await window.bridge?.checkin?.migrateV1ToV2?.(false, 'V3');
        if (result?.success) {
          const reportDone = typeof result.migratedReports === 'number' ? result.migratedReports : 0;
          C.showToast(`✅ 已迁移到 V3！报数 ${reportDone} 条，请切换到 V3 预览效果`);
        } else {
          C.showToast('❌ 迁移失败: ' + (result?.message || '未知错误'));
        }
      } catch (error) {
        C.showToast('❌ 迁移失败: ' + error.message);
      }
    });

    // 🔴 应用到 V2（生产）
    document.getElementById('ck-migrate-to-v2')?.addEventListener('click', async () => {
      if (!confirm('⚠️ 确定要将 V1 数据应用到 V2 (生产版本) 吗？\n\n建议先迁移到 V3 测试，确认无误后再操作！')) {
        return;
      }

      C.showToast('🔍 正在扫描老数据库...');
      try {
        const preview = await window.bridge?.checkin?.migrateV1ToV2?.(true, 'V2');
        if (!preview?.success) {
          C.showToast('❌ 扫描失败: ' + (preview?.message || '未知错误'));
          return;
        }
        if (preview.totalUpdates === 0) {
          C.showToast('✅ 没有可迁移的数据');
          return;
        }

        const reportCount = typeof preview.migratedReports === 'number' ? preview.migratedReports : 0;
        const reminderCount = typeof preview.migratedReminders === 'number' ? preview.migratedReminders : 0;
        const confirmMsg = `⚠️ 应用到 V2 (生产版本)

将迁移: ${preview.migratedRecords} 条记录, ${preview.migratedSettings} 个设置
报数: ${reportCount} 条
催报: ${reminderCount} 条

这将影响生产数据，确定继续吗？`;

        if (!confirm(confirmMsg)) {
          C.showToast('已取消');
          return;
        }

        C.showToast('📦 正在应用到 V2...');
        const result = await window.bridge?.checkin?.migrateV1ToV2?.(false, 'V2');
        if (result?.success) {
          const reportDone = typeof result.migratedReports === 'number' ? result.migratedReports : 0;
          C.showToast(`✅ 已应用到 V2 生产版本！报数 ${reportDone} 条`);
          setTimeout(() => location.reload(), 1500);
        } else {
          C.showToast('❌ 迁移失败: ' + (result?.message || '未知错误'));
        }
      } catch (error) {
        C.showToast('❌ 迁移失败: ' + error.message);
      }
    });

    // 检测主程序认证状态
    const authBadge = document.getElementById('ck-auth-status-badge');
    if (authBadge && window.bridge?.getTokenStatus) {
      window.bridge.getTokenStatus().then(status => {
        console.log('[Checkin] Token status:', status);
        if (status?.authorized && status?.status !== 'expired') {
          authBadge.textContent = `✓ 已认证 (${status.userEmail || ''})`;
          authBadge.className = 'status success';
        } else if (status?.authorized && status?.status === 'expired') {
          authBadge.textContent = 'Token 已过期';
          authBadge.className = 'status warning';
        } else {
          authBadge.textContent = '未登录';
          authBadge.className = 'status warning';
        }
      }).catch(err => {
        console.error('[Checkin] Token status error:', err);
        authBadge.textContent = '检测失败';
        authBadge.className = 'status error';
      });
    }

    // 🧪 报数测试按钮事件绑定
    document.getElementById('ck-test-trigger-morning')?.addEventListener('click', () => {
      if (window.CheckinReport?.manualTrigger) {
        window.CheckinReport.manualTrigger('morning');
        C.showToast('已触发上午报数提醒');
      }
    });
    document.getElementById('ck-test-trigger-afternoon')?.addEventListener('click', () => {
      if (window.CheckinReport?.manualTrigger) {
        window.CheckinReport.manualTrigger('afternoon');
        C.showToast('已触发下午报数提醒');
      }
    });
    document.getElementById('ck-test-trigger-evening')?.addEventListener('click', () => {
      if (window.CheckinReport?.manualTrigger) {
        window.CheckinReport.manualTrigger('evening');
        C.showToast('已触发晚上报数提醒');
      }
    });
    document.getElementById('ck-test-simulate-report')?.addEventListener('click', () => {
      if (window.CheckinReport?.simulateOtherReport) {
        const names = ['张三', '李四', '王五', '赵六', '小明'];
        const slots = ['morning', 'afternoon', 'evening'];
        const tasks = ['完成5个视频剪辑', '生成30张图片', '审核10个任务', '制作3个sora视频'];
        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomSlot = slots[Math.floor(Math.random() * slots.length)];
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        window.CheckinReport.simulateOtherReport(randomName, randomSlot, randomTask);
        C.showToast(`模拟报数: ${randomName}`);
      }
    });

    // 🔴 团队筛选下拉框事件已移至 checkin-report.js 的 bindFilterEvents() 中处理
    // 这样每次 renderRecordsPanel() 渲染后都能正确绑定事件

    // 🔴 报数通知开关已移至设置页面中统一管理
  }

  function startTeamAutoPoll() {
    const C = window.CheckinCore;
    if (!C || teamPollTimer) return;

    teamPollTimer = setInterval(async () => {
      if (!C.state.sheetsUrl) return;
      if (document.hidden) return;
      const result = await C.fetchTeamRecords({ silent: true });
      if (result.success && (result.added > 0 || result.updated > 0)) {
        const isDetailOpen = C.state.teamDetailMember || C.state.historyDetailDate;
        if ((C.state.activeTab === 'team' || C.state.activeTab === 'history') && !isDetailOpen) {
          render();
        }
      }
    }, TEAM_POLL_INTERVAL);
  }

  // ========== 打卡提醒功能 ==========
  let punchReminderTimer = null;
  const punchReminderSent = {}; // 记录今日已提醒的时段 {'YYYY-MM-DD-morning': true }

  // 打卡时段配置（与 SLOT_CONFIG 保持一致）
  const PUNCH_REMINDERS = [
    { key: 'morning', label: '上午', startHour: 8, startMinute: 0 },
    { key: 'afternoon', label: '下午', startHour: 13, startMinute: 30 },
    { key: 'evening', label: '晚上', startHour: 19, startMinute: 0 }
  ];

  function startPunchReminderTimer() {
    if (punchReminderTimer) return;

    // 每分钟检查一次
    punchReminderTimer = setInterval(() => {
      checkPunchReminder();
    }, 60 * 1000);

    // 立即检查一次
    checkPunchReminder();
    console.log('[DailyCheckin] 打卡提醒定时器已启动');
  }

  function checkPunchReminder() {
    const C = window.CheckinCore;
    if (!C) return;

    // 检查通知是否启用
    if (C.state.profile.notifyEnabled === false) return;

    const now = new Date();
    const todayStr = C.formatDate(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // 获取今日打卡记录
    const record = C.getActiveRecord();

    PUNCH_REMINDERS.forEach(reminder => {
      const reminderKey = `${todayStr}-${reminder.key}`;

      // 已提醒过，跳过
      if (punchReminderSent[reminderKey]) return;

      // 计算提醒时间（开始时间 + 5分钟）
      const reminderMinutes = reminder.startHour * 60 + reminder.startMinute + 5;

      // 还没到提醒时间
      if (nowMinutes < reminderMinutes) return;

      // 超过提醒时间30分钟，不再提醒
      if (nowMinutes > reminderMinutes + 30) {
        punchReminderSent[reminderKey] = true; // 标记为已过期
        return;
      }

      // 检查该时段是否已打卡
      const slot = record?.slots?.[reminder.key];
      if (slot?.time) {
        punchReminderSent[reminderKey] = true; // 已打卡，标记为已处理
        return;
      }

      // 显示提醒
      punchReminderSent[reminderKey] = true;
      showPunchReminder(reminder);
    });

    // 清理过期的提醒记录（新的一天）
    Object.keys(punchReminderSent).forEach(key => {
      if (!key.startsWith(todayStr)) {
        delete punchReminderSent[key];
      }
    });
  }

  function showPunchReminder(reminder) {
    const C = window.CheckinCore;

    // 使用置顶通知窗口
    if (window.bridge?.showNotificationWindow) {
      window.bridge.showNotificationWindow({
        title: '⏰ 打卡提醒',
        message: `${reminder.label}时段已开始，请记得打卡！`,
        type: 'punch-reminder',
        slotKey: reminder.key,
        slotLabel: reminder.label,
        buttons: [
          { id: 'punch', label: '立即打卡', primary: true },
          { id: 'later', label: '稍后' }
        ]
      });

      // 监听通知响应
      if (window.bridge?.onNotificationResponse) {
        const handler = (response) => {
          if (response.type === 'punch-reminder' && response.buttonId === 'punch') {
            // 触发打卡
            const A = window.CheckinActions;
            if (A?.handlePunch) {
              A.handlePunch(reminder.key);
            }
          }
        };
        // 只监听一次
        window.bridge.onNotificationResponse(handler);
      }
    } else {
      // 回退：使用 Toast 提醒
      C?.showToast(`⏰ ${reminder.label}时段已开始，请记得打卡！`, 5000);
    }

    console.log(`[DailyCheckin] 打卡提醒: ${reminder.label}`);
  }

  function init() {
    console.log('[DailyCheckin] Initializing...');
    const C = window.CheckinCore;
    if (!C) { console.error('[DailyCheckin] Core not loaded!'); return; }

    C.loadFromStorage();

    // 加载用户数据（每个数据源加载完就渲染，提升响应速度）
    async function loadUserData(userName) {
      if (!userName) return;

      console.log(`[DailyCheckin] 加载用户数据: ${userName}`);

      if (window.CheckinReport?.loadSettingsForUser) {
        window.CheckinReport.loadSettingsForUser(userName);
        render();
      }

      // 从 Firebase 加载设置（加载完立即渲染）
      if (C.loadSettingsFromCloud) {
        const prevTeamName = C.state.profile.teamName || '';
        C.loadSettingsFromCloud(userName).then(result => {
          if (result.success && result.settings) {
            console.log('[DailyCheckin] 云端设置已加载');
            restartTeamRealtimeWatch(C.state);
            render();
            const nextTeamName = C.state.profile.teamName || '';
            if (nextTeamName && nextTeamName !== prevTeamName && C.loadRecordsFromCloud) {
              C.loadRecordsFromCloud(userName).then(recordResult => {
                if (recordResult.success && recordResult.records?.length) {
                  render();
                }
              });
            }
          }
        });
      }

      // 从 Firebase 加载记录（加载完立即渲染）
      if (C.loadRecordsFromCloud) {
        C.loadRecordsFromCloud(userName).then(result => {
          if (result.success && result.records?.length) {
            console.log(`[DailyCheckin] 云端记录已合并: ${result.records.length} 条`);
            render();
          }
        });
      }

      // 从 Google Sheets 拉取团队数据（加载完立即渲染）
      if (C.fetchTeamRecords && C.state.sheetsUrl) {
        C.fetchTeamRecords({ silent: true }).then(result => {
          if (result.success) {
            console.log(`[DailyCheckin] Sheets 数据已拉取`);
            render();
          }
        });
      }
    }

    // 监听提交人变化 - 老用户自动加载，新用户需要注册
    const submitInput = document.getElementById('meta-submit');
    const userStatusHint = document.getElementById('user-status-hint');
    const userRegisterBtn = document.getElementById('user-register-btn');

    if (submitInput) {
      // 🔴 状态变量
      let isCheckingUser = false;
      let pendingNewUserName = null; // 待注册的新用户名

      // 🔴 更新用户状态提示
      const updateUserStatusUI = (status, message) => {
        if (!userStatusHint) return;
        userStatusHint.hidden = false;
        userStatusHint.className = `user-status-hint ${status}`;
        userStatusHint.textContent = message;

        // 显示/隐藏注册按钮
        if (userRegisterBtn) {
          userRegisterBtn.hidden = status !== 'unregistered';
        }
      };

      // 🔴 隐藏状态提示
      const hideUserStatusUI = () => {
        if (userStatusHint) {
          userStatusHint.hidden = true;
        }
        if (userRegisterBtn) {
          userRegisterBtn.hidden = true;
        }
        pendingNewUserName = null;
      };

      // 🔴 检查用户是否已注册并处理
      const checkAndHandleUser = async (inputName) => {
        if (!inputName || isCheckingUser) return;

        const trimmedName = inputName.trim();
        if (!trimmedName) {
          hideUserStatusUI();
          return;
        }

        // 如果和当前用户名一样，不做任何处理
        if (trimmedName === C.state.profile.name) {
          hideUserStatusUI();
          return;
        }

        isCheckingUser = true;
        updateUserStatusUI('checking', '检查中...');

        try {
          // 获取所有已注册用户
          const result = await window.bridge?.checkin?.getAllUsers?.();
          if (!result?.success || !Array.isArray(result.users)) {
            console.warn('[DailyCheckin] 无法获取用户列表');
            hideUserStatusUI();
            isCheckingUser = false;
            return;
          }

          // 查找是否是已注册用户
          const existingUser = result.users.find(u =>
            (u.userName || '').trim() === trimmedName
          );

          if (existingUser) {
            // 🔴 是老用户，自动加载配置
            updateUserStatusUI('registered', `✓ 已注册 (${existingUser.teamName})`);
            pendingNewUserName = null;

            console.log(`[DailyCheckin] 检测到已注册用户: ${trimmedName}，自动加载配置`);

            // 切换到该用户
            if (C.resetProfileForUser) {
              C.resetProfileForUser(trimmedName);
            } else {
              C.state.profile.name = trimmedName;
              C.saveToStorage();
            }
            render();
            loadUserData(trimmedName);

            // 短暂显示状态后隐藏
            setTimeout(hideUserStatusUI, 2000);
          } else {
            // 🔴 是新用户，需要注册
            updateUserStatusUI('unregistered', '⚠ 未注册');
            pendingNewUserName = trimmedName;
            console.log(`[DailyCheckin] 新用户: ${trimmedName}，等待注册`);
          }
        } catch (error) {
          console.error('[DailyCheckin] 检查用户失败:', error);
          hideUserStatusUI();
        } finally {
          isCheckingUser = false;
        }
      };

      // 🔴 注册按钮点击事件
      if (userRegisterBtn) {
        userRegisterBtn.addEventListener('click', async () => {
          if (!pendingNewUserName) {
            C.showToast?.('请先输入用户名');
            return;
          }

          const newName = pendingNewUserName.trim();
          if (!newName) return;

          // 再次确认不存在重名
          const duplicateCheck = await checkDuplicateUserName(newName, C.state.profile.name);
          if (duplicateCheck.isDuplicate) {
            C.showToast?.(`❌ 用户名 "${newName}" 已被占用，请使用其他名字！`);
            return;
          }

          // 注册新用户
          console.log(`[DailyCheckin] 注册新用户: ${newName}`);

          if (C.resetProfileForUser) {
            C.resetProfileForUser(newName);
          } else {
            C.state.profile.name = newName;
            C.saveToStorage();
          }

          // 保存到 Firebase（创建用户记录）
          C.showToast?.(`✓ 用户 "${newName}" 注册成功！`);

          hideUserStatusUI();
          render();
          loadUserData(newName);
        });
      }

      // input 事件：实时检查用户状态
      let debounceTimer = null;
      submitInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const inputName = submitInput.value.trim();
          await checkAndHandleUser(inputName);
        }, 500);
      });

      // blur 事件：离开输入框时检查
      submitInput.addEventListener('blur', async () => {
        clearTimeout(debounceTimer);
        const inputName = submitInput.value.trim();
        await checkAndHandleUser(inputName);
      });
    }

    render();
    console.log('[DailyCheckin] Initialized');
    startTeamAutoPoll();

    // 初始加载当前用户数据
    if (C.state.profile.name) {
      loadUserData(C.state.profile.name);
    }

    // 启动智能自动同步定时器（只在有待同步数据时同步到 Sheets）
    if (C.startAutoSyncTimer) {
      C.startAutoSyncTimer();
    }

    // 🔴 启动自动备份定时器（每天 02:00 自动备份）
    if (C.startAutoBackupTimer) {
      C.startAutoBackupTimer();
    }

    // 🔴 启动打卡提醒定时器（开始时间后5分钟提醒）
    startPunchReminderTimer();

    // 监听实时更新事件（先绑定，避免错过首帧数据）
    if (window.bridge?.checkin?.onRecordsUpdated) {
      // 🔴 防抖渲染变量
      let pendingUpdate = false;
      let updateDebounceTimer = null;

      window.bridge.checkin.onRecordsUpdated((data) => {
        if (!['update', 'checkin-update'].includes(data.type)) return;
        const incomingRecords = Array.isArray(data.records) ? data.records : [];
        console.log(`[DailyCheckin] 收到实时更新: ${incomingRecords.length} 条记录`);

        if (incomingRecords.length === 0) {
          // 🔴 修复：空记录不清除本地数据，只记录日志
          // 之前的逻辑会在收到空数组时清除所有本地teamRecords，导致打卡后数据丢失
          console.log('[DailyCheckin] 收到空记录，保留本地数据');
          return;
        }

        const getTeamKey = (record) => `${record.date}-${record.userName}-${record.teamName || 'default'}`;
        const teamRecordMap = new Map((C.state.teamRecords || []).map(r => [getTeamKey(r), r]));
        let hasNewData = false;

        incomingRecords.forEach(remoteRecord => {
          const normalized = { ...remoteRecord, teamName: remoteRecord.teamName || 'default' };
          const key = getTeamKey(normalized);
          const localRecord = teamRecordMap.get(key);

          // 🔴 跳过被锁定的记录（刚打卡30秒内不被远程覆盖）
          if (C.isRecordLocked?.(normalized.date, normalized.userName, normalized.teamName || 'default')) {
            console.log(`[DailyCheckin] 跳过锁定的记录: ${normalized.date} ${normalized.userName}`);
            return;
          }

          if (!localRecord || (normalized.updatedAt || 0) > (localRecord.updatedAt || 0)) {
            teamRecordMap.set(key, localRecord ? { ...localRecord, ...normalized } : normalized);
            hasNewData = true;
          }
        });

        if (hasNewData) {
          C.state.teamRecords = Array.from(teamRecordMap.values());

          // 🔴 修复：检查用户是否正在输入，避免打断输入
          const activeElement = document.activeElement;
          const isUserTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable
          );

          if (isUserTyping) {
            // 用户正在输入，标记延迟更新
            pendingUpdate = true;
            console.log('[DailyCheckin] 用户正在输入，延迟渲染');

            // 清除之前的定时器
            if (updateDebounceTimer) clearTimeout(updateDebounceTimer);

            // 2秒后如果用户停止输入则自动渲染
            updateDebounceTimer = setTimeout(() => {
              if (pendingUpdate) {
                pendingUpdate = false;
                render();
                console.log('[DailyCheckin] 延迟渲染完成');
              }
            }, 2000);
          } else {
            // 用户未在输入，立即渲染
            pendingUpdate = false;
            render();
            console.log('[DailyCheckin] 团队总览已实时更新');
          }
        }
      });

      // 监听输入框失焦事件，触发延迟的渲染
      document.addEventListener('focusout', (e) => {
        if (pendingUpdate && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
          setTimeout(() => {
            if (pendingUpdate) {
              pendingUpdate = false;
              render();
              console.log('[DailyCheckin] 输入结束，执行延迟渲染');
            }
          }, 100);
        }
      });
    }

    // 🔴 启动 Firebase 实时监听（团队总览跨设备实时同步）
    startTeamRealtimeWatch(C.state);
  }

  // 全局渲染函数
  window.render = render;

  // 导出
  window.DailyCheckin = { init, render };
})();
