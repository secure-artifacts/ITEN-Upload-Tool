/**
 * 每日打卡 - 任务统计模块
 * 提供详细表格视图：成员+任务类型 × 日期
 */
(function () {
  'use strict';
  const C = window.CheckinCore;
  const { state, formatDate } = C;

  // 统计子视图状态
  let statsSubTab = 'detail'; // detail | member_type | date_type
  let statsViewTeam = null; // 当前查看的团队，null 表示使用自己的团队

  // 🔴 独立的统计月份状态（与 state.viewDate 解耦）
  // null 表示自动根据当前日期计算，非 null 表示用户手动选择的月份
  let statsViewYear = null;
  let statsViewMonth = null; // 0-indexed

  /**
   * 🔴 重置统计月份为自动模式（根据当前日期计算）
   */
  function resetStatsMonth() {
    statsViewYear = null;
    statsViewMonth = null;
  }

  /**
   * 获取当前查看的团队名称
   */
  function getCurrentViewTeam() {
    return statsViewTeam || state.profile.teamName || 'default';
  }

  /**
   * 获取所有可用的团队列表
   */
  function getAvailableTeams() {
    const teams = new Set();
    (state.teamRecords || []).forEach(r => {
      if (r.teamName) teams.add(r.teamName);
    });
    // 确保自己的团队在列表中
    if (state.profile.teamName) {
      teams.add(state.profile.teamName);
    }
    return Array.from(teams).sort();
  }

  /**
   * 解析报数内容，提取任务类型和数量
   * - 会过滤掉备注部分（括号内的内容）
   * - 保留所有任务类型（兼容旧数据）
   */
  function parseTaskCount(taskCountStr) {
    const result = {};
    if (!taskCountStr || typeof taskCountStr !== 'string') return result;

    // 🔴 移除备注部分（中英文括号）
    let cleanStr = taskCountStr.replace(/[（(][^)）]*[)）]/g, '').trim();

    const items = cleanStr.split(/[、,，]/);
    items.forEach(item => {
      const trimmed = item.trim();
      if (!trimmed) return;

      const match = trimmed.match(/^(.+?)\s*[×xX]\s*(\d+)$/);
      if (match) {
        const taskName = match[1].trim();
        const count = parseInt(match[2]) || 0;
        // 🔴 统计所有任务类型（兼容旧数据）
        result[taskName] = (result[taskName] || 0) + count;
      } else {
        // 🔴 单个任务（没有数量）
        result[trimmed] = (result[trimmed] || 0) + 1;
      }
    });

    return result;
  }

  /**
   * 🔴 根据当前真实日期计算默认应显示的业务周期
   * 
   * 业务周期规则：
   * - 1月1日-22日 → 显示1月（周期：12月23日-1月22日）
   * - 1月23日-2月22日 → 显示2月（周期：1月23日-2月22日）
   * - 2月23日-3月22日 → 显示3月（周期：2月23日-3月22日）
   */
  function getDefaultPeriodMonth() {
    const now = new Date();
    const currentDay = now.getDate();
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed

    if (currentDay >= 23) {
      // 23日及之后，显示"下个月"的统计
      month = month + 1;
      if (month > 11) {
        month = 0;
        year++;
      }
    }
    // 1-22日，显示"当月"的统计（month 保持不变）

    return { year, month };
  }

  /**
   * 获取统计周期的日期范围 (上月23日 - 本月22日)
   * 🔴 使用独立的 statsViewYear/statsViewMonth，不再依赖 state.viewDate
   * 
   * 业务周期规则：
   * - 1月1日-22日 → 显示1月（周期：12月23日-1月22日）
   * - 1月23日-2月22日 → 显示2月（周期：1月23日-2月22日）
   * - 2月23日-3月22日 → 显示3月（周期：2月23日-3月22日）
   */
  function getStatsPeriod() {
    const now = new Date();
    const currentDay = now.getDate();

    // 🔴 如果没有手动指定月份，自动根据当前日期计算
    let year, month;
    if (statsViewYear !== null && statsViewMonth !== null) {
      year = statsViewYear;
      month = statsViewMonth;
    } else {
      const defaultPeriod = getDefaultPeriodMonth();
      year = defaultPeriod.year;
      month = defaultPeriod.month;
    }

    // 计算周期：上月23日 - 本月22日
    // month 是显示的月份（0-indexed），统计周期是 (month-1)月23日 到 month月22日
    const startDate = new Date(year, month - 1, 23);

    // 🔴 判断是否是当前进行中的周期
    const defaultPeriod = getDefaultPeriodMonth();
    const isCurrentPeriod = (year === defaultPeriod.year && month === defaultPeriod.month);

    let endDate;
    if (isCurrentPeriod) {
      // 当前周期进行中，显示到今天
      endDate = new Date(now.getFullYear(), now.getMonth(), currentDay);
    } else {
      // 已结束的周期，显示完整的22天
      endDate = new Date(year, month, 22);
    }

    return { startDate, endDate, year, month };
  }

  /**
   * 获取统计周期内的所有记录
   */
  function getPeriodRecords() {
    const { startDate, endDate } = getStatsPeriod();
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
    const teamName = getCurrentViewTeam();

    let records = (state.teamRecords || []).filter(r => {
      const recordTeam = r.teamName || 'default';
      const dateStr = r.date;
      return recordTeam === teamName && dateStr >= startStr && dateStr <= endStr;
    });

    return records;
  }

  /**
   * 获取热力图颜色
   */
  function getHeatColor(value, maxValue) {
    if (value === 0) return 'var(--stats-heat-0)';
    const ratio = maxValue > 0 ? value / maxValue : 0;
    if (ratio < 0.2) return 'var(--stats-heat-1)';
    if (ratio < 0.4) return 'var(--stats-heat-2)';
    if (ratio < 0.6) return 'var(--stats-heat-3)';
    if (ratio < 0.8) return 'var(--stats-heat-4)';
    return 'var(--stats-heat-5)';
  }

  /**
   * 渲染详细表格：成员+任务类型 × 日期（类似用户截图）
   * 支持按成员折叠，默认折叠状态
   */
  function renderDetailView() {
    const { startDate, endDate, year, month } = getStatsPeriod();
    const teamName = state.profile.teamName || 'default';
    const records = getPeriodRecords();

    // 生成日期列表（最新日期在左侧）
    const dateList = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateList.push(formatDate(new Date(d)));
    }
    dateList.reverse(); // 🔴 最新日期排在前面

    // 收集所有成员和任务类型
    const memberTypeMap = new Map(); // member -> Set<taskType>
    const allTypes = new Set();

    records.forEach(record => {
      const member = record.userName;
      if (!member) return;

      if (!memberTypeMap.has(member)) {
        memberTypeMap.set(member, new Set());
      }

      ['morning', 'afternoon', 'evening'].forEach(slotKey => {
        const slot = record.slots?.[slotKey];
        if (slot?.taskCount) {
          const parsed = parseTaskCount(slot.taskCount);
          Object.keys(parsed).forEach(taskType => {
            memberTypeMap.get(member).add(taskType);
            allTypes.add(taskType);
          });
        }
      });
    });

    // 构建数据矩阵：(member, taskType) -> date -> count
    const matrix = new Map(); // "member|taskType" -> Map<date, count>
    const rowTotals = new Map(); // "member|taskType" -> total
    const memberTotals = new Map(); // member -> total
    const memberDateTotals = new Map(); // member -> Map<date, count>
    let maxValue = 0;

    // 初始化矩阵
    memberTypeMap.forEach((types, member) => {
      memberTotals.set(member, 0);
      memberDateTotals.set(member, new Map());
      dateList.forEach(d => memberDateTotals.get(member).set(d, 0));
      types.forEach(taskType => {
        const key = `${member}|${taskType}`;
        matrix.set(key, new Map());
        rowTotals.set(key, 0);
      });
    });

    // 填充数据
    records.forEach(record => {
      const member = record.userName;
      const dateStr = record.date;
      if (!member) return;

      ['morning', 'afternoon', 'evening'].forEach(slotKey => {
        const slot = record.slots?.[slotKey];
        if (slot?.taskCount) {
          const parsed = parseTaskCount(slot.taskCount);
          Object.entries(parsed).forEach(([taskType, count]) => {
            const key = `${member}|${taskType}`;
            if (matrix.has(key)) {
              const current = matrix.get(key).get(dateStr) || 0;
              matrix.get(key).set(dateStr, current + count);
              rowTotals.set(key, rowTotals.get(key) + count);
              memberTotals.set(member, memberTotals.get(member) + count);
              const dateCurrent = memberDateTotals.get(member).get(dateStr) || 0;
              memberDateTotals.get(member).set(dateStr, dateCurrent + count);
              if (current + count > maxValue) maxValue = current + count;
            }
          });
        }
      });
    });

    // 按成员分组，每个成员内按任务类型排序
    const sortedMembers = Array.from(memberTypeMap.keys()).sort();

    // 生成表头
    const headerCells = dateList.map(dateStr => {
      const date = new Date(dateStr);
      return `<th>${date.getMonth() + 1}/${date.getDate()}</th>`;
    }).join('');

    // 生成表格行（支持折叠）
    let rows = '';
    let grandTotal = 0;
    const dateTotals = new Map();
    dateList.forEach(d => dateTotals.set(d, 0));

    // 成员颜色表
    const memberColors = ['#fff3cd', '#d4edda', '#d1ecf1', '#f8d7da', '#e2e3e5', '#cce5ff', '#ffeeba'];

    sortedMembers.forEach((member, memberIndex) => {
      const types = Array.from(memberTypeMap.get(member)).sort();
      const memberTotal = memberTotals.get(member);
      grandTotal += memberTotal;
      const memberBg = memberColors[memberIndex % memberColors.length];

      // 生成任务类型详情用于悬浮提示
      const typeDetails = types.map(taskType => {
        const key = `${member}|${taskType}`;
        const total = rowTotals.get(key);
        return `${taskType}: ${total}`;
      }).join('\n');
      const tooltipText = `${member} 的任务明细:\n${typeDetails}`;

      // 成员汇总行日期数据
      const memberDateCells = dateList.map(dateStr => {
        const value = memberDateTotals.get(member).get(dateStr) || 0;
        dateTotals.set(dateStr, dateTotals.get(dateStr) + value);
        const bgColor = value > 0 ? getHeatColor(value, maxValue) : '';
        return `<td style="${value > 0 ? 'background:' + bgColor : ''}" title="${member} ${dateStr.slice(5)}: ${value || 0}">${value || ''}</td>`;
      }).join('');

      // 成员汇总行（可点击展开/折叠）
      rows += `
        <tr class="member-summary-row" data-member="${member}" style="cursor: pointer; background: ${memberBg};" title="${tooltipText}">
          <td class="member-col" style="background: ${memberBg}; font-weight: 600;">
            <span class="member-toggle-icon">▶</span> ${member}
          </td>
          <td class="type-col" style="background: ${memberBg}; color: #666; font-style: italic;">${types.length} 个任务类型</td>
          <td class="total-col" style="font-weight: 600; color: #5b21b6;">${memberTotal}</td>
          ${memberDateCells}
        </tr>
      `;

      // 成员的每个任务类型行（默认隐藏）
      types.forEach((taskType) => {
        const key = `${member}|${taskType}`;
        const rowData = matrix.get(key);
        const total = rowTotals.get(key);

        const cells = dateList.map(dateStr => {
          const value = rowData.get(dateStr) || 0;
          const bgColor = value > 0 ? getHeatColor(value, maxValue) : '';
          // 🔴 只有自己的数据才可编辑
          const myName = state.profile?.name || '';
          const isMyData = member === myName;
          const editableClass = isMyData ? 'editable-cell' : '';
          const cursorStyle = isMyData ? 'cursor: pointer;' : '';
          const titleHint = isMyData ? `点击编辑 ${dateStr.slice(5)} 的 ${taskType}` : '';

          return `<td class="stats-cell ${editableClass}" 
                      data-member="${member}" 
                      data-date="${dateStr}" 
                      data-task-type="${taskType}"
                      style="${value > 0 ? 'background:' + bgColor + ';' : ''} ${cursorStyle}"
                      title="${titleHint}">${value || ''}</td>`;
        }).join('');

        rows += `
          <tr class="member-detail-row" data-member="${member}" style="display: none; background: ${memberBg}80;">
            <td class="member-col" style="background: ${memberBg}80; padding-left: 28px;"></td>
            <td class="type-col" style="background: ${memberBg}80;">${taskType}</td>
            <td class="total-col">${total}</td>
            ${cells}
          </tr>
        `;
      });
    });

    // 表尾汇总行
    const footerCells = dateList.map(dateStr => {
      const value = dateTotals.get(dateStr);
      return `<td class="footer-cell">${value || ''}</td>`;
    }).join('');

    return `
      <div class="ck-stats-table-container">
        <div class="ck-stats-table-header">
          <div class="ck-stats-table-title-group">
            <h3>📊 ${month + 1}月份报数统计</h3>
            <span class="team-label">${teamName}</span>
          </div>
          <div class="ck-stats-toggle-buttons">
            <button class="ck-btn ghost small" id="ck-stats-expand-all">全部展开</button>
            <button class="ck-btn ghost small" id="ck-stats-collapse-all">全部折叠</button>
          </div>
        </div>
        <div class="ck-stats-table-wrapper">
          <table class="ck-stats-matrix detail-matrix">
            <thead>
              <tr>
                <th class="fixed-col member-header">成员</th>
                <th class="fixed-col type-header">任务类型</th>
                <th class="total-header">汇总</th>
                ${headerCells}
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="100" class="empty-row">暂无数据</td></tr>'}
            </tbody>
            <tfoot>
              <tr>
                <td class="fixed-col">合计</td>
                <td class="fixed-col"></td>
                <td class="total-col grand-total">${grandTotal}</td>
                ${footerCells}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * 渲染成员×任务类型汇总表（不含日期明细）
   */
  function renderMemberTypeView() {
    const { year, month } = getStatsPeriod();
    const teamName = state.profile.teamName || 'default';
    const records = getPeriodRecords();

    // 获取所有成员和任务类型
    const members = new Set();
    const taskTypes = new Set();

    records.forEach(record => {
      if (record.userName) members.add(record.userName);
      ['morning', 'afternoon', 'evening'].forEach(slotKey => {
        const slot = record.slots?.[slotKey];
        if (slot?.taskCount) {
          const parsed = parseTaskCount(slot.taskCount);
          Object.keys(parsed).forEach(taskName => taskTypes.add(taskName));
        }
      });
    });

    const memberList = Array.from(members).sort();
    const typeList = Array.from(taskTypes).sort();

    // 构建数据矩阵 member -> taskType -> count
    const matrix = new Map();
    const memberTotals = new Map();
    const typeTotals = new Map();
    let maxValue = 0;

    memberList.forEach(member => {
      matrix.set(member, new Map());
      memberTotals.set(member, 0);
    });
    typeList.forEach(type => typeTotals.set(type, 0));

    records.forEach(record => {
      const member = record.userName;
      if (!member || !matrix.has(member)) return;

      ['morning', 'afternoon', 'evening'].forEach(slotKey => {
        const slot = record.slots?.[slotKey];
        if (slot?.taskCount) {
          const parsed = parseTaskCount(slot.taskCount);
          Object.entries(parsed).forEach(([taskName, count]) => {
            const current = matrix.get(member).get(taskName) || 0;
            matrix.get(member).set(taskName, current + count);
            memberTotals.set(member, memberTotals.get(member) + count);
            typeTotals.set(taskName, (typeTotals.get(taskName) || 0) + count);
            if (current + count > maxValue) maxValue = current + count;
          });
        }
      });
    });

    // 生成表头
    const headerCells = typeList.map(type => `<th>${type}</th>`).join('');

    // 生成表格行
    const rows = memberList.map(member => {
      const memberData = matrix.get(member);
      const total = memberTotals.get(member);

      const cells = typeList.map(type => {
        const value = memberData.get(type) || 0;
        const bgColor = value > 0 ? getHeatColor(value, maxValue) : '';
        return `<td style="${value > 0 ? 'background:' + bgColor : ''}">${value || ''}</td>`;
      }).join('');

      return `
        <tr>
          <td class="member-name">${member}</td>
          <td class="total-col">${total}</td>
          ${cells}
        </tr>
      `;
    }).join('');

    const grandTotal = Array.from(memberTotals.values()).reduce((a, b) => a + b, 0);
    const footerCells = typeList.map(type => `<td class="footer-cell">${typeTotals.get(type) || 0}</td>`).join('');

    return `
      <div class="ck-stats-table-container">
        <div class="ck-stats-table-header">
          <h3>📊 成员×任务类型（${year}年${month + 1}月）</h3>
          <span class="team-label">${teamName}</span>
        </div>
        <div class="ck-stats-table-wrapper">
          <table class="ck-stats-matrix">
            <thead>
              <tr>
                <th class="fixed-col">成员</th>
                <th class="total-col">汇总</th>
                ${headerCells}
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="100" class="empty-row">暂无数据</td></tr>'}
            </tbody>
            <tfoot>
              <tr>
                <td class="fixed-col">合计</td>
                <td class="total-col grand-total">${grandTotal}</td>
                ${footerCells}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * 渲染日期×任务类型汇总表
   */
  function renderDateTypeView() {
    const { startDate, endDate, year, month } = getStatsPeriod();
    const teamName = state.profile.teamName || 'default';
    const records = getPeriodRecords();

    // 生成日期列表（最新日期在左侧）
    const dateList = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateList.push(formatDate(new Date(d)));
    }
    dateList.reverse(); // 🔴 最新日期排在前面

    // 获取所有任务类型
    const taskTypes = new Set();
    records.forEach(record => {
      ['morning', 'afternoon', 'evening'].forEach(slotKey => {
        const slot = record.slots?.[slotKey];
        if (slot?.taskCount) {
          const parsed = parseTaskCount(slot.taskCount);
          Object.keys(parsed).forEach(taskName => taskTypes.add(taskName));
        }
      });
    });
    const typeList = Array.from(taskTypes).sort();

    // 构建数据矩阵 date -> taskType -> count
    const matrix = new Map();
    const dateTotals = new Map();
    const typeTotals = new Map();
    let maxValue = 0;

    dateList.forEach(dateStr => {
      matrix.set(dateStr, new Map());
      dateTotals.set(dateStr, 0);
    });
    typeList.forEach(type => typeTotals.set(type, 0));

    records.forEach(record => {
      const dateStr = record.date;
      if (!matrix.has(dateStr)) return;

      ['morning', 'afternoon', 'evening'].forEach(slotKey => {
        const slot = record.slots?.[slotKey];
        if (slot?.taskCount) {
          const parsed = parseTaskCount(slot.taskCount);
          Object.entries(parsed).forEach(([taskName, count]) => {
            const current = matrix.get(dateStr).get(taskName) || 0;
            matrix.get(dateStr).set(taskName, current + count);
            dateTotals.set(dateStr, dateTotals.get(dateStr) + count);
            typeTotals.set(taskName, (typeTotals.get(taskName) || 0) + count);
            if (current + count > maxValue) maxValue = current + count;
          });
        }
      });
    });

    // 生成表头
    const headerCells = typeList.map(type => `<th>${type}</th>`).join('');

    // 生成表格行
    const rows = dateList.map(dateStr => {
      const dateData = matrix.get(dateStr);
      const total = dateTotals.get(dateStr);
      const date = new Date(dateStr);
      const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;

      const cells = typeList.map(type => {
        const value = dateData.get(type) || 0;
        const bgColor = value > 0 ? getHeatColor(value, maxValue) : '';
        return `<td style="${value > 0 ? 'background:' + bgColor : ''}">${value || ''}</td>`;
      }).join('');

      return `
        <tr>
          <td class="date-name">${dateLabel}</td>
          <td class="total-col">${total}</td>
          ${cells}
        </tr>
      `;
    }).join('');

    const grandTotal = Array.from(dateTotals.values()).reduce((a, b) => a + b, 0);
    const footerCells = typeList.map(type => `<td class="footer-cell">${typeTotals.get(type) || 0}</td>`).join('');

    return `
      <div class="ck-stats-table-container">
        <div class="ck-stats-table-header">
          <h3>📊 日期×任务类型（${year}年${month + 1}月）</h3>
          <span class="team-label">${teamName}</span>
        </div>
        <div class="ck-stats-table-wrapper">
          <table class="ck-stats-matrix">
            <thead>
              <tr>
                <th class="fixed-col">日期</th>
                <th class="total-col">汇总</th>
                ${headerCells}
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="100" class="empty-row">暂无数据</td></tr>'}
            </tbody>
            <tfoot>
              <tr>
                <td class="fixed-col">合计</td>
                <td class="total-col grand-total">${grandTotal}</td>
                ${footerCells}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * 主渲染函数
   */
  function renderStats() {
    const { year, month } = getStatsPeriod();
    const currentTeam = getCurrentViewTeam();
    const availableTeams = getAvailableTeams();

    // 权限检查
    if (!state.profile.teamName || !state.profile.teamName.trim()) {
      return `
        <div class="ck-stats-empty-state">
          <div class="empty-icon">🔒</div>
          <h3>请先设置团队/组别</h3>
          <p>设置后才能查看团队任务统计数据</p>
          <button class="ck-btn primary" id="ck-stats-goto-settings">前往设置</button>
        </div>
      `;
    }

    // 生成团队选择器选项
    const teamOptions = availableTeams.map(team =>
      `<option value="${team}" ${team === currentTeam ? 'selected' : ''}>${team}</option>`
    ).join('');

    return `
      <div class="ck-stats-container ${state.isDark ? 'dark' : ''}">
        <div class="ck-stats-header">
          <div class="ck-stats-title-row">
            <h2>📊 任务统计</h2>
            <div class="ck-stats-controls">
              <div class="ck-stats-team-selector">
                <label>查看团队：</label>
                <select id="ck-stats-team-select">
                  ${teamOptions}
                </select>
              </div>
              <div class="ck-stats-nav">
                <button id="ck-stats-prev-month" class="ck-btn-icon">◀</button>
                <span>${year}年${month + 1}月</span>
                <button id="ck-stats-next-month" class="ck-btn-icon">▶</button>
              </div>
            </div>
          </div>
          <div class="ck-stats-tabs">
            <button class="ck-stats-tab ${statsSubTab === 'detail' ? 'active' : ''}" data-subtab="detail">📋 详细报数</button>
            <button class="ck-stats-tab ${statsSubTab === 'member_type' ? 'active' : ''}" data-subtab="member_type">👥 成员×类型</button>
            <button class="ck-stats-tab ${statsSubTab === 'date_type' ? 'active' : ''}" data-subtab="date_type">📅 日期×类型</button>
          </div>
        </div>
        <div class="ck-stats-content">
          ${statsSubTab === 'detail' ? renderDetailView() :
        statsSubTab === 'member_type' ? renderMemberTypeView() :
          renderDateTypeView()}
        </div>
      </div>
    `;
  }

  /**
   * 绑定统计模块事件
   */
  function bindStatsEvents(renderCallback) {
    // 子Tab切换
    document.querySelectorAll('.ck-stats-tab').forEach(btn => {
      btn.onclick = () => {
        statsSubTab = btn.dataset.subtab;
        renderCallback();
      };
    });

    // 月份导航 🔴 使用独立的统计月份状态
    document.getElementById('ck-stats-prev-month')?.addEventListener('click', () => {
      // 如果当前是自动模式，先初始化为当前显示的月份
      if (statsViewYear === null || statsViewMonth === null) {
        const defaultPeriod = getDefaultPeriodMonth();
        statsViewYear = defaultPeriod.year;
        statsViewMonth = defaultPeriod.month;
      }
      // 上一个月
      statsViewMonth--;
      if (statsViewMonth < 0) {
        statsViewMonth = 11;
        statsViewYear--;
      }
      renderCallback();
    });
    document.getElementById('ck-stats-next-month')?.addEventListener('click', () => {
      // 如果当前是自动模式，先初始化为当前显示的月份
      if (statsViewYear === null || statsViewMonth === null) {
        const defaultPeriod = getDefaultPeriodMonth();
        statsViewYear = defaultPeriod.year;
        statsViewMonth = defaultPeriod.month;
      }
      // 下一个月
      statsViewMonth++;
      if (statsViewMonth > 11) {
        statsViewMonth = 0;
        statsViewYear++;
      }
      renderCallback();
    });

    // 团队选择器
    document.getElementById('ck-stats-team-select')?.addEventListener('change', (e) => {
      statsViewTeam = e.target.value || null;
      renderCallback();
    });

    // 前往设置
    document.getElementById('ck-stats-goto-settings')?.addEventListener('click', () => {
      state.showSettings = true;
      renderCallback();
    });

    // 成员行折叠/展开
    document.querySelectorAll('.member-summary-row').forEach(row => {
      row.addEventListener('click', () => {
        const member = row.dataset.member;
        const detailRows = document.querySelectorAll(`.member-detail-row[data-member="${member}"]`);
        const icon = row.querySelector('.member-toggle-icon');
        const isExpanded = detailRows[0]?.style.display !== 'none';

        detailRows.forEach(r => {
          r.style.display = isExpanded ? 'none' : 'table-row';
        });
        if (icon) {
          icon.textContent = isExpanded ? '▶' : '▼';
        }
      });
    });

    // 全部展开
    document.getElementById('ck-stats-expand-all')?.addEventListener('click', () => {
      document.querySelectorAll('.member-detail-row').forEach(r => {
        r.style.display = 'table-row';
      });
      document.querySelectorAll('.member-toggle-icon').forEach(icon => {
        icon.textContent = '▼';
      });
    });

    // 全部折叠
    document.getElementById('ck-stats-collapse-all')?.addEventListener('click', () => {
      document.querySelectorAll('.member-detail-row').forEach(r => {
        r.style.display = 'none';
      });
      document.querySelectorAll('.member-toggle-icon').forEach(icon => {
        icon.textContent = '▶';
      });
    });

    // 🔴 单元格点击编辑
    document.querySelectorAll('.editable-cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const member = cell.dataset.member;
        const dateStr = cell.dataset.date;
        const taskType = cell.dataset.taskType;
        const currentValue = parseInt(cell.textContent) || 0;

        showEditCellDialog(member, dateStr, taskType, currentValue, renderCallback);
      });
    });
  }

  /**
   * 🔴 显示单元格编辑对话框
   */
  function showEditCellDialog(member, dateStr, taskType, currentValue, renderCallback) {
    const displayDate = dateStr.slice(5).replace('-', '/');

    // 获取预设任务类型列表
    const presetTypes = window.CheckinCore?.getReportTaskTypes?.() || [];
    const presetsHtml = presetTypes.map(p =>
      `<button type="button" class="ck-task-dialog-preset ${p === taskType ? 'active' : ''}" data-preset="${p}">${p}</button>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.className = 'ck-slot-choice-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    overlay.innerHTML = `
      <div style="background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 16px; padding: 24px; min-width: 380px; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <span style="font-size: 24px;">✏️</span>
          <div>
            <h3 style="margin: 0; color: #f1f5f9; font-size: 16px;">编辑任务统计</h3>
            <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">${member} · ${displayDate} · ${taskType}</p>
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; color: #94a3b8; font-size: 13px; margin-bottom: 8px;">修改为任务类型：</label>
          <div class="ck-task-dialog-presets" style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 120px; overflow-y: auto;">${presetsHtml}</div>
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; color: #94a3b8; font-size: 13px; margin-bottom: 8px;">数量：</label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" id="ck-edit-minus" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.3); background: rgba(99, 102, 241, 0.1); color: #6366f1; font-size: 20px; cursor: pointer;">−</button>
            <input type="number" id="ck-edit-count" value="${currentValue}" min="0" max="999" style="width: 80px; padding: 10px; text-align: center; border-radius: 8px; border: 2px solid rgba(99, 102, 241, 0.3); background: rgba(15, 23, 42, 0.8); color: #f1f5f9; font-size: 18px; font-weight: bold;">
            <button type="button" id="ck-edit-plus" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.3); background: rgba(99, 102, 241, 0.1); color: #6366f1; font-size: 20px; cursor: pointer;">+</button>
          </div>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="ck-btn ghost" id="ck-edit-cancel" style="flex: 1; padding: 12px;">取消</button>
          <button class="ck-btn primary" id="ck-edit-save" style="flex: 1; padding: 12px;">💾 保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let selectedType = taskType;
    const countInput = document.getElementById('ck-edit-count');

    // 预设按钮点击
    overlay.querySelectorAll('.ck-task-dialog-preset').forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll('.ck-task-dialog-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedType = btn.dataset.preset;
      };
    });

    // 加减按钮
    document.getElementById('ck-edit-minus').onclick = () => {
      countInput.value = Math.max(0, parseInt(countInput.value) - 1);
    };
    document.getElementById('ck-edit-plus').onclick = () => {
      countInput.value = Math.min(999, parseInt(countInput.value) + 1);
    };

    const closeDialog = () => overlay.remove();
    document.getElementById('ck-edit-cancel').onclick = closeDialog;
    overlay.onclick = (e) => { if (e.target === overlay) closeDialog(); };

    // 保存
    document.getElementById('ck-edit-save').onclick = async () => {
      const newCount = parseInt(countInput.value) || 0;
      const teamName = getCurrentViewTeam();

      // 数据验证
      if (newCount < 0) {
        window.CheckinCore?.showToast?.('数量不能为负数', 'error');
        return;
      }

      if (!selectedType) {
        window.CheckinCore?.showToast?.('请选择任务类型', 'error');
        return;
      }

      // 如果没有变化，直接关闭
      if (selectedType === taskType && newCount === currentValue) {
        closeDialog();
        return;
      }

      // 显示保存中状态
      const saveBtn = document.getElementById('ck-edit-save');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = '保存中...';
      saveBtn.disabled = true;

      try {
        // 调用 Firebase API 保存修正记录
        const result = await window.bridge?.checkin?.saveCorrectionRecord({
          date: dateStr,
          userName: member,
          teamName: teamName,
          originalTaskType: taskType,
          newTaskType: selectedType,
          newCount: newCount,
          originalCount: currentValue
        });

        if (result?.success) {
          console.log(`[Stats] 修正记录已保存: ${member} ${dateStr} ${taskType}→${selectedType} ×${newCount}`);
          window.CheckinCore?.showToast?.(`已保存修正：${selectedType} ×${newCount}`, 'success');
          closeDialog();

          // 刷新界面 - 需要重新加载数据
          if (renderCallback) {
            // 等待一小段时间让 Firebase 更新生效
            setTimeout(() => {
              renderCallback();
            }, 500);
          }
        } else {
          throw new Error(result?.error || '保存失败');
        }
      } catch (error) {
        console.error('[Stats] 保存修正记录失败:', error);
        window.CheckinCore?.showToast?.(`保存失败: ${error.message}`, 'error');
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }
    };
  }

  // 导出
  window.CheckinStats = {
    renderStats,
    bindStatsEvents,
    parseTaskCount
  };
})();
