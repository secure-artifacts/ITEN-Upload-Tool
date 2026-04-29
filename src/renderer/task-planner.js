/**
 * 任务规划器 — Task Planner v2
 * 账号为核心实体，每个账号可挂多个任务类型
 */
;(function () {
  'use strict';
  const STORAGE_KEY = 'tp_data_v2';
  const DAY_MS = 86400000;

  const u = {
    id: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    today: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
    fmtDate: (s) => { if(!s) return '—'; const p = s.split('-'); return `${+p[1]}月${+p[2]}日`; },
    diffDays: (a, b) => Math.round((new Date(a) - new Date(b)) / DAY_MS),
    addDays: (s, n) => { const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); },
    weekday: (s) => ['日','一','二','三','四','五','六'][new Date(s).getDay()],
    el: (tag, cls, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html !== undefined) e.innerHTML = html; return e; },
    qs: (s, p) => (p || document).querySelector(s),
    qsa: (s, p) => [...(p || document).querySelectorAll(s)],
    esc: (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  };

  // ── 数据层 ──
  class Store {
    constructor() { this._load(); }
    _load() {
      try { this.data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || this._default(); }
      catch { this.data = this._default(); }
      if (!this.data.accounts) this.data.accounts = [];
      if (!this.data.todos) this.data.todos = {};
      if (!this.data.capacity) this.data.capacity = {};
      if (!this.data.postTypes) this.data.postTypes = ['视频','图文','问答'];
      if (!this.data.customCols) this.data.customCols = [];
    }
    _default() { return { accounts: [], todos: {}, capacity: {}, postTypes: ['视频','图文','问答'], customCols: [] }; }
    save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); }
    getAccounts() { return this.data.accounts; }
    addAccount(a) { a.id = a.id || u.id(); this.data.accounts.push(a); this.save(); return a; }
    updateAccount(id, patch) { const a = this.data.accounts.find(x => x.id === id); if(a) Object.assign(a, patch); this.save(); }
    delAccount(id) { this.data.accounts = this.data.accounts.filter(x => x.id !== id); this.save(); }
    getTodos(date) { return this.data.todos[date] || []; }
    addTodo(date, t) { if(!this.data.todos[date]) this.data.todos[date] = []; t.id = t.id || u.id(); this.data.todos[date].push(t); this.save(); }
    updateTodo(date, id, patch) { const l = this.data.todos[date]; if(!l) return; const t = l.find(x=>x.id===id); if(t) Object.assign(t,patch); this.save(); }
    delTodo(date, id) { if(!this.data.todos[date]) return; this.data.todos[date] = this.data.todos[date].filter(x=>x.id!==id); this.save(); }
    getCapacity() { return this.data.capacity; }
    setCapacity(c) { this.data.capacity = c; this.save(); }
    getPostTypes() { return this.data.postTypes; }
    setPostTypes(t) { this.data.postTypes = t; this.save(); }
    getCustomCols() { return this.data.customCols; }
    setCustomCols(c) { this.data.customCols = c; this.save(); }
  }
  const store = new Store();

  let toastTimer;
  function toast(msg) {
    let el = u.qs('.tp-toast');
    if(!el) { el = u.el('div','tp-toast'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  const root = document.getElementById('tp-root');
  if (!root) return;
  let currentTab = 'dashboard';

  function renderRoot() {
    root.innerHTML = `
      <nav class="tp-sub-nav">
        <button class="tp-sub-tab ${currentTab==='dashboard'?'active':''}" data-tab="dashboard">📊 今日看板</button>
        <button class="tp-sub-tab ${currentTab==='accounts'?'active':''}" data-tab="accounts">👤 账号管理</button>
        <button class="tp-sub-tab ${currentTab==='capacity'?'active':''}" data-tab="capacity">⚡ 产能设置</button>
      </nav>
      <div class="tp-view ${currentTab==='dashboard'?'active':''}" data-tp-view="dashboard"></div>
      <div class="tp-view ${currentTab==='accounts'?'active':''}" data-tp-view="accounts"></div>
      <div class="tp-view ${currentTab==='capacity'?'active':''}" data-tp-view="capacity"></div>
    `;
    u.qsa('.tp-sub-tab', root).forEach(btn => {
      btn.onclick = () => { currentTab = btn.dataset.tab; renderRoot(); };
    });
    const views = { dashboard: renderDashboard, accounts: renderAccounts, capacity: renderCapacity };
    const viewEl = u.qs(`[data-tp-view="${currentTab}"]`, root);
    if (views[currentTab]) views[currentTab](viewEl);
  }

  // ══════════════════════════════════════
  //  今日看板
  // ══════════════════════════════════════
  function renderDashboard(container) {
    const today = u.today();
    const accounts = store.getAccounts();
    const todos = store.getTodos(today);
    const cap = store.getCapacity();

    // 按任务类型汇总需求
    const demandByType = {};
    let behindCount = 0, totalTasks = 0;
    accounts.forEach(acc => {
      (acc.tasks || []).forEach(t => {
        totalTasks++;
        const diff = u.diffDays(today, t.currentProgress || today);
        if (diff > 0) behindCount++;
        const daily = t.dailyQuantity || 0;
        const extra = diff > 0 ? daily * diff : 0;
        const type = t.taskType || '其他';
        demandByType[type] = (demandByType[type] || 0) + daily + extra;
      });
    });

    const todosTotal = todos.length;
    const todosDone = todos.filter(t => t.status === 'done').length;
    const grandTotal = totalTasks + todosTotal;
    const grandDone = behindCount === 0 ? totalTasks + todosDone : (totalTasks - behindCount) + todosDone;
    let overloads = [];
    Object.keys(demandByType).forEach(type => {
      const c = cap[type] || 0;
      if (c > 0 && demandByType[type] > c) overloads.push(type);
    });

    container.innerHTML = `
      <div class="tp-dashboard-header">
        <h3 class="tp-date-title">📅 ${u.fmtDate(today)} <span class="tp-date-sub">周${u.weekday(today)}</span></h3>
        <button class="tp-btn-primary" id="tp-ai-btn">🤖 获取AI建议</button>
      </div>
      <div class="tp-stat-row">
        <div class="tp-stat-card"><div class="tp-stat-icon">📊</div><div class="tp-stat-info"><div class="tp-stat-label">今日总任务进度</div><div class="tp-stat-value" style="font-size:18px">${grandDone} / ${grandTotal}</div></div></div>
        <div class="tp-stat-card blue"><div class="tp-stat-icon">📌</div><div class="tp-stat-info"><div class="tp-stat-label">账号长期任务</div><div class="tp-stat-value" style="font-size:18px">${totalTasks}条线 ${behindCount?'(落后'+behindCount+')':''}</div></div></div>
        <div class="tp-stat-card yellow"><div class="tp-stat-icon">📝</div><div class="tp-stat-info"><div class="tp-stat-label">每日临时任务</div><div class="tp-stat-value" style="font-size:18px">${todosDone} / ${todosTotal}</div></div></div>
        <div class="tp-stat-card ${overloads.length?'red':'green'}"><div class="tp-stat-icon">${overloads.length?'⚠️':'✅'}</div><div class="tp-stat-info"><div class="tp-stat-label">产能状态</div><div class="tp-stat-value" style="font-size:18px">${overloads.length?overloads.length+' 项超载':'正常无压'}</div></div></div>
      </div>
      <div class="tp-dashboard-body">
        <div>
          <div class="tp-section-title">📌 今日进度总览</div>
          <div id="tp-dash-tasks"></div>
          <div id="tp-cap-chart"></div>
        </div>
        <div><div class="tp-todo-panel" id="tp-todo-panel"></div></div>
      </div>
    `;

    // 任务进度卡片 — 按账号分组
    const tasksArea = u.qs('#tp-dash-tasks', container);
    if (accounts.length === 0) {
      tasksArea.innerHTML = '<div class="tp-empty"><div class="tp-empty-icon">👤</div><h4>暂无账号</h4><p>去"账号管理"页添加</p></div>';
    } else {
      accounts.forEach(acc => {
        if (!acc.tasks || acc.tasks.length === 0) return;
        acc.tasks.forEach(t => {
          const diff = u.diffDays(today, t.currentProgress || today);
          let sc = 'blue', st = '正常';
          if (diff > 0) { sc = diff >= 2 ? 'red' : 'yellow'; st = `落后${diff}天`; }
          else if (diff < 0) { sc = 'green'; st = `超前${Math.abs(diff)}天`; }
          const card = u.el('div', 'tp-campaign-card');
          card.innerHTML = `
            <div class="tp-campaign-header">
              <h4 class="tp-campaign-name">${acc.link ? `<a href="${u.esc(acc.link)}" target="_blank" style="color:var(--primary);text-decoration:none">${u.esc(acc.name)}</a>` : u.esc(acc.name)} · ${u.esc(t.taskType)}</h4>
              <span class="tp-status-badge ${sc}">${st}</span>
            </div>
            <div class="tp-campaign-meta">管理员: ${u.esc(acc.admin||'—')} | ${t.dailyQuantity||0}条/天 | 已做到 <strong>${u.fmtDate(t.currentProgress)}</strong></div>
            <div class="tp-campaign-actions"><button class="tp-record-btn tp-dash-rec">✅ 推进1天</button></div>
          `;
          u.qs('.tp-dash-rec', card).onclick = () => {
            t.currentProgress = u.addDays(t.currentProgress || today, 1);
            store.save(); toast(`✅ ${acc.name}·${t.taskType} → ${u.fmtDate(t.currentProgress)}`); renderRoot();
          };
          tasksArea.appendChild(card);
        });
      });
    }

    // 产能图
    renderCapChart(u.qs('#tp-cap-chart', container), demandByType, cap);
    // 临时任务
    renderTodoPanel(u.qs('#tp-todo-panel', container), today, todos);
    // AI
    u.qs('#tp-ai-btn', container).onclick = () => showAIModal(accounts, todos, cap, today);
  }

  function renderCapChart(el, demand, cap) {
    const types = [...new Set([...Object.keys(demand), ...Object.keys(cap)])];
    if (!types.length) { el.innerHTML = ''; return; }
    const max = Math.max(...types.map(t => Math.max(demand[t]||0, cap[t]||0)), 1);
    el.innerHTML = `<div class="tp-capacity-chart"><div class="tp-capacity-title">📊 需求 vs 产能</div>${types.map(t => {
      const d = demand[t]||0, c = cap[t]||0, over = c>0 && d>c;
      return `<div class="tp-capacity-row"><div class="tp-capacity-label">${t}</div><div class="tp-capacity-bars"><div class="tp-cap-demand ${over?'over':'ok'}" style="width:${Math.min(d/max*100,100)}%"></div>${c?`<div class="tp-cap-limit-line" style="left:${Math.min(c/max*100,100)}%"></div>`:''}</div><div class="tp-capacity-nums">${d}/${c||'—'} ${over?'⚠️':'✅'}</div></div>`;
    }).join('')}</div>`;
  }

  function renderTodoPanel(container, today, todos) {
    const sorted = [...todos].sort((a,b) => {
      if(a.status==='done' && b.status!=='done') return 1;
      if(a.status!=='done' && b.status==='done') return -1;
      const pm = {urgent:0,normal:1,low:2};
      return (pm[a.priority]||1) - (pm[b.priority]||1);
    });
    container.innerHTML = `
      <div class="tp-todo-panel-header"><h4 class="tp-todo-panel-title">📝 临时任务</h4><button class="tp-btn-ghost tp-btn-sm" id="tp-add-todo-tog">+ 添加</button></div>
      <div class="tp-add-todo-form hidden" id="tp-atf">
        <div class="tp-form-row"><input class="flex-1" type="text" placeholder="任务名称" id="tp-tn"><select id="tp-tp"><option value="urgent">🔴 紧急</option><option value="normal" selected>🟡 普通</option><option value="low">⚫ 低</option></select></div>
        <div class="tp-form-row"><input class="flex-1" type="text" placeholder="备注" id="tp-td"><button class="tp-btn-primary tp-btn-sm" id="tp-ts">添加</button></div>
      </div><div id="tp-tl"></div>
    `;
    u.qs('#tp-add-todo-tog',container).onclick = () => u.qs('#tp-atf',container).classList.toggle('hidden');
    u.qs('#tp-ts',container).onclick = () => {
      const name = u.qs('#tp-tn',container).value.trim();
      if(!name) return toast('请输入名称');
      store.addTodo(today, { name, priority: u.qs('#tp-tp',container).value, description: u.qs('#tp-td',container).value.trim(), status:'pending' });
      toast('✅ 已添加'); renderRoot();
    };
    const list = u.qs('#tp-tl',container);
    if(!sorted.length) { list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">暂无</div>'; return; }
    sorted.forEach(t => {
      const done = t.status==='done';
      const item = u.el('div', `tp-todo-item ${t.priority||'normal'} ${done?'done':''}`);
      item.innerHTML = `<input type="checkbox" class="tp-todo-check" ${done?'checked':''}><div class="tp-todo-body"><div class="tp-todo-name">${u.esc(t.name)}</div>${t.description?`<div class="tp-todo-meta"><span>${u.esc(t.description)}</span></div>`:''}</div><button class="tp-todo-del">✕</button>`;
      u.qs('.tp-todo-check',item).onchange = e => { store.updateTodo(today,t.id,{status:e.target.checked?'done':'pending'}); renderRoot(); };
      u.qs('.tp-todo-del',item).onclick = () => { store.delTodo(today,t.id); renderRoot(); };
      list.appendChild(item);
    });
  }

  // ══════════════════════════════════════
  //  账号管理（核心重写）
  // ══════════════════════════════════════
  function renderAccounts(container) {
    const accounts = store.getAccounts();
    const customCols = store.getCustomCols();
    container.innerHTML = `
      <div class="tp-accounts-header">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <h3 style="margin:0;white-space:nowrap">👤 账号管理 <span style="font-size:13px;color:var(--muted);font-weight:400" id="tp-acc-count">(${accounts.length}个)</span></h3>
          <input type="text" id="tp-acc-search" placeholder="🔍 搜索管理员/账号/任务..." style="padding:6px 12px;border:1px solid var(--border);border-radius:20px;font-size:13px;outline:none;width:220px;background:var(--panel-alt)">
        </div>
        <div style="display:flex;gap:8px">
          <button class="tp-btn-ghost tp-btn-sm" id="tp-col-mgr">⚙ 自定义列</button>
          <button class="tp-btn-ghost tp-btn-sm" id="tp-batch-toggle">📋 批量粘贴</button>
          <button class="tp-btn-primary" id="tp-add-acc">+ 添加账号</button>
        </div>
      </div>
      <div class="tp-batch-panel hidden" id="tp-batch-panel"></div>
      <div id="tp-acc-list"></div>
    `;
    u.qs('#tp-add-acc',container).onclick = () => showAccountModal();
    u.qs('#tp-col-mgr',container).onclick = () => showCustomColManager();
    u.qs('#tp-batch-toggle',container).onclick = () => {
      const p = u.qs('#tp-batch-panel',container);
      p.classList.toggle('hidden');
      if(!p.classList.contains('hidden')) renderBatchPanel(p);
    };
    const renderTable = (data) => {
      renderAccountList(u.qs('#tp-acc-list',container), data, customCols);
      u.qs('#tp-acc-count',container).textContent = `(${data.length}个)`;
    };

    u.qs('#tp-acc-search',container).oninput = e => {
      const kw = e.target.value.toLowerCase().trim();
      if(!kw) return renderTable(accounts);
      const filtered = accounts.filter(a => {
        const str = [
          a.admin, a.name, a.type, a.link,
          ...(a.tasks||[]).map(t=>t.taskType+' '+t.note),
          ...Object.values(a.customFields||{})
        ].join(' ').toLowerCase();
        return str.includes(kw);
      });
      renderTable(filtered);
    };

    renderTable(accounts);
  }

  function renderAccountList(wrap, accounts, customCols) {
    if(!accounts.length) {
      wrap.innerHTML = '<div class="tp-empty"><div class="tp-empty-icon">👤</div><h4>暂无账号</h4><p>点击添加或批量粘贴</p></div>';
      return;
    }
    const today = u.today();
    const typeLabel = {veteran:'老账号',stable:'稳定',test:'测试'};
    const customHeaders = customCols.map(c => `<th>${u.esc(c.name)}</th>`).join('');

    wrap.innerHTML = `<div class="tp-accounts-table-wrap"><table class="tp-accounts-table">
      <thead><tr><th>管理员</th><th>类型</th><th>账号</th><th>任务(类型×数量)</th><th>进度</th>${customHeaders}<th>操作</th></tr></thead>
      <tbody id="tp-acc-tbody"></tbody>
    </table></div>`;

    const tbody = u.qs('#tp-acc-tbody', wrap);
    accounts.forEach(acc => {
      const tasks = acc.tasks || [];
      const rowspan = Math.max(tasks.length, 1);
      const typeClass = acc.type==='veteran'?'veteran':acc.type==='test'?'test':'stable';
      const nameCell = acc.link
        ? `<a href="${u.esc(acc.link)}" target="_blank" style="color:var(--primary);text-decoration:none;font-weight:600">${u.esc(acc.name)}</a>`
        : `<strong>${u.esc(acc.name)}</strong>`;

      const customVals = customCols.map(c => {
        const v = acc.customFields?.[c.id] || c.fixedValue || '';
        return `<td>${u.esc(v)}</td>`;
      }).join('');

      tasks.forEach((t, i) => {
        const tr = document.createElement('tr');
        const diff = u.diffDays(today, t.currentProgress || today);
        let sc = 'blue', st = '正常';
        if(diff>0) { sc = diff>=2?'red':'yellow'; st = `落后${diff}天`; }
        else if(diff<0) { sc = 'green'; st = `超前${Math.abs(diff)}天`; }

        let cells = '';
        if (i === 0) {
          cells += `<td rowspan="${rowspan}">${u.esc(acc.admin||'—')}</td>`;
          cells += `<td rowspan="${rowspan}"><span class="tp-acc-type-badge ${typeClass}">${typeLabel[acc.type]||acc.type}</span></td>`;
          cells += `<td rowspan="${rowspan}">${nameCell}</td>`;
        }
        cells += `<td><span class="tp-tag ${t.taskType?.includes('视频')?'video':t.taskType?.includes('图文')?'image':'other'}">${u.esc(t.taskType)}</span> ×${t.dailyQuantity||0}${t.note ? `<br><small style="color:var(--muted)">${u.esc(t.note)}</small>` : ''}</td>`;
        cells += `<td><span class="tp-status-badge ${sc}">${u.fmtDate(t.currentProgress)} ${st}</span>
          <button class="tp-record-btn tp-btn-sm tp-rec-task" data-acc="${acc.id}" data-tidx="${i}" style="margin-left:4px">+1天</button></td>`;
        if (i === 0) {
          cells += customVals;
          cells += `<td rowspan="${rowspan}">
            <button class="tp-btn-ghost tp-btn-sm tp-edit-acc" data-id="${acc.id}">编辑</button>
            <button class="tp-btn-danger tp-btn-sm tp-del-acc" data-id="${acc.id}">删除</button>
          </td>`;
        }
        tr.innerHTML = cells;
        tbody.appendChild(tr);
      });

      if (tasks.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${u.esc(acc.admin||'—')}</td><td><span class="tp-acc-type-badge ${typeClass}">${typeLabel[acc.type]||acc.type}</span></td><td>${nameCell}</td><td style="color:var(--muted)">未添加任务</td><td>—</td>${customVals}<td><button class="tp-btn-ghost tp-btn-sm tp-edit-acc" data-id="${acc.id}">编辑</button><button class="tp-btn-danger tp-btn-sm tp-del-acc" data-id="${acc.id}">删除</button></td>`;
        tbody.appendChild(tr);
      }
    });

    // 事件绑定
    u.qsa('.tp-rec-task', wrap).forEach(btn => {
      btn.onclick = () => {
        const acc = store.getAccounts().find(a => a.id === btn.dataset.acc);
        if(!acc) return;
        const t = acc.tasks[+btn.dataset.tidx];
        if(!t) return;
        t.currentProgress = u.addDays(t.currentProgress || u.today(), 1);
        store.save(); toast(`✅ ${acc.name}·${t.taskType} → ${u.fmtDate(t.currentProgress)}`); renderRoot();
      };
    });
    u.qsa('.tp-edit-acc', wrap).forEach(btn => {
      btn.onclick = () => showAccountModal(store.getAccounts().find(a => a.id === btn.dataset.id));
    });
    u.qsa('.tp-del-acc', wrap).forEach(btn => {
      btn.onclick = () => { if(confirm('确定删除？')) { store.delAccount(btn.dataset.id); toast('已删除'); renderRoot(); } };
    });
  }

  // ── 新建/编辑账号 Modal ──
  function showAccountModal(existing) {
    const isEdit = !!existing;
    const postTypes = store.getPostTypes();
    const customCols = store.getCustomCols();
    const tasks = existing?.tasks ? JSON.parse(JSON.stringify(existing.tasks)) : [{ taskType: postTypes[0]||'', dailyQuantity: 2, note: '', currentProgress: u.today() }];

    const overlay = u.el('div', 'tp-modal-overlay');
    const renderTaskRows = () => tasks.map((t, i) => `
      <div class="tp-form-row" style="align-items:center;background:var(--panel-alt);padding:8px;border-radius:8px;margin-bottom:6px" data-ti="${i}">
        <select class="tp-task-type" style="width:100px">${postTypes.map(p => `<option ${t.taskType===p?'selected':''}>${p}</option>`).join('')}</select>
        <input type="number" min="1" value="${t.dailyQuantity||1}" class="tp-task-qty" style="width:60px" placeholder="数量">
        <input type="text" value="${u.esc(t.note||'')}" class="tp-task-note" placeholder="备注" style="flex:1">
        <input type="date" value="${t.currentProgress||u.today()}" class="tp-task-prog" style="width:130px">
        <button class="tp-btn-danger tp-btn-sm tp-task-del" style="padding:3px 8px">✕</button>
      </div>
    `).join('');

    const customFieldsHTML = customCols.map(c => {
      const val = existing?.customFields?.[c.id] || c.fixedValue || '';
      if (c.type === 'dropdown') {
        return `<div class="tp-form-group"><label>${u.esc(c.name)}</label><select data-col-id="${c.id}">${(c.options||[]).map(o => `<option ${val===o?'selected':''}>${o}</option>`).join('')}</select></div>`;
      } else if (c.type === 'fixed') {
        return `<div class="tp-form-group"><label>${u.esc(c.name)}</label><input data-col-id="${c.id}" value="${u.esc(c.fixedValue||'')}" readonly style="background:#f1f5f9"></div>`;
      }
      return `<div class="tp-form-group"><label>${u.esc(c.name)}</label><input data-col-id="${c.id}" value="${u.esc(val)}"></div>`;
    }).join('');

    overlay.innerHTML = `<div class="tp-modal" style="max-width:640px">
      <div class="tp-modal-header"><h3>${isEdit?'编辑账号':'添加账号'}</h3><button class="tp-modal-close">✕</button></div>
      <div class="tp-form-grid">
        <div class="tp-form-group"><label>管理员</label><input id="tp-acc-admin" value="${u.esc(existing?.admin||'')}"></div>
        <div class="tp-form-group"><label>账号类型</label><select id="tp-acc-type"><option value="veteran" ${existing?.type==='veteran'?'selected':''}>老账号</option><option value="stable" ${(!existing||existing?.type==='stable')?'selected':''}>稳定账号</option><option value="test" ${existing?.type==='test'?'selected':''}>测试账号</option></select></div>
      </div>
      <div class="tp-form-grid">
        <div class="tp-form-group"><label>账号名称</label><input id="tp-acc-name" value="${u.esc(existing?.name||'')}"></div>
        <div class="tp-form-group"><label>账号链接</label><input id="tp-acc-link" value="${u.esc(existing?.link||'')}" placeholder="https://..."></div>
      </div>
      <div style="margin-bottom:14px">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px">任务类型列表</label>
        <div id="tp-task-rows">${renderTaskRows()}</div>
        <button class="tp-btn-ghost tp-btn-sm" id="tp-add-task-row" style="margin-top:4px">+ 添加任务类型</button>
      </div>
      ${customFieldsHTML ? `<div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">自定义字段</label><div class="tp-form-grid">${customFieldsHTML}</div></div>` : ''}
      <div class="tp-modal-footer"><button class="tp-btn-ghost tp-camp-cancel">取消</button><button class="tp-btn-primary tp-camp-save">${isEdit?'保存':'添加'}</button></div>
    </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    u.qs('.tp-modal-close',overlay).onclick = close;
    u.qs('.tp-camp-cancel',overlay).onclick = close;
    overlay.onclick = e => { if(e.target===overlay) close(); };

    // 添加任务行
    u.qs('#tp-add-task-row',overlay).onclick = () => {
      tasks.push({ taskType: postTypes[0]||'', dailyQuantity: 1, note: '', currentProgress: u.today() });
      u.qs('#tp-task-rows',overlay).innerHTML = renderTaskRows();
      bindTaskDel();
    };

    const bindTaskDel = () => {
      u.qsa('.tp-task-del',overlay).forEach((btn,i) => {
        btn.onclick = () => { if(tasks.length<=1) return toast('至少保留一个'); tasks.splice(i,1); u.qs('#tp-task-rows',overlay).innerHTML = renderTaskRows(); bindTaskDel(); };
      });
    };
    bindTaskDel();

    // 保存
    u.qs('.tp-camp-save',overlay).onclick = () => {
      const name = u.qs('#tp-acc-name',overlay).value.trim();
      if(!name) return toast('请输入账号名称');
      // 读取任务行
      const rows = u.qsa('[data-ti]',overlay);
      const finalTasks = rows.map((row, i) => ({
        taskType: u.qs('.tp-task-type',row).value,
        dailyQuantity: parseInt(u.qs('.tp-task-qty',row).value)||1,
        note: u.qs('.tp-task-note',row).value.trim(),
        currentProgress: u.qs('.tp-task-prog',row).value || u.today(),
      }));
      const customFields = {};
      u.qsa('[data-col-id]',overlay).forEach(el => {
        customFields[el.dataset.colId] = el.value;
      });
      const data = {
        admin: u.qs('#tp-acc-admin',overlay).value.trim(),
        type: u.qs('#tp-acc-type',overlay).value,
        name, link: u.qs('#tp-acc-link',overlay).value.trim(),
        tasks: finalTasks, customFields,
      };
      if(isEdit) { store.updateAccount(existing.id, data); toast('✅ 已保存'); }
      else { store.addAccount(data); toast('✅ 已添加'); }
      close(); renderRoot();
    };
  }

  // ── 批量粘贴（支持超链接） ──
  function renderBatchPanel(panel) {
    panel.innerHTML = `
      <div class="tp-batch-title">📋 批量粘贴账号（从Google表格）</div>
      <div class="tp-format-hint">📌 列顺序：<code>管理员</code> | <code>账号类型</code> | <code>账号名(含超链接)</code> | <code>任务类型</code> | <code>任务数量</code><br>同一账号多个任务=多行(相同账号名自动合并) · 超链接自动从HTML剪贴板提取</div>
      <textarea class="tp-batch-textarea" placeholder="管理员A\t老账号\t张三\t视频\t2\n管理员A\t老账号\t张三\t图文\t3\n管理员B\t稳定账号\t李四\t视频\t5" id="tp-batch-text"></textarea>
      <div class="tp-batch-parse-result hidden" id="tp-batch-result"></div>
      <div class="tp-batch-footer">
        <button class="tp-btn-ghost tp-btn-sm" id="tp-batch-parse">解析预览</button>
        <button class="tp-btn-primary tp-btn-sm" id="tp-batch-import" disabled>确认导入</button>
      </div>
    `;

    let parsed = [], linkMap = {};
    const typeMap = {'老账号':'veteran','稳定账号':'stable','测试账号':'test','老':'veteran','稳定':'stable','测试':'test'};

    // 监听paste事件提取HTML里的超链接
    const textarea = u.qs('#tp-batch-text', panel);
    textarea.addEventListener('paste', e => {
      const html = e.clipboardData?.getData('text/html');
      if (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('a[href]').forEach(a => {
          const text = a.textContent.trim();
          if (text) linkMap[text] = a.getAttribute('href');
        });
      }
    });

    u.qs('#tp-batch-parse', panel).onclick = () => {
      const text = textarea.value.trim();
      const result = u.qs('#tp-batch-result', panel);
      if(!text) { result.className = 'tp-batch-parse-result error'; result.textContent = '请粘贴数据'; return; }

      // 按账号名合并
      const accMap = {};
      text.split('\n').filter(l=>l.trim()).forEach(line => {
        const c = line.split('\t');
        const name = c[2]?.trim();
        if(!name) return;
        if(!accMap[name]) accMap[name] = { admin: c[0]?.trim()||'', type: typeMap[c[1]?.trim()]||'stable', name, link: linkMap[name]||'', tasks: [] };
        accMap[name].tasks.push({ taskType: c[3]?.trim()||'其他', dailyQuantity: parseInt(c[4])||1, note: '', currentProgress: u.today() });
      });
      parsed = Object.values(accMap);
      if(!parsed.length) { result.className = 'tp-batch-parse-result error'; result.textContent = '未识别有效数据'; return; }

      const totalTasks = parsed.reduce((s,a) => s + a.tasks.length, 0);
      result.className = 'tp-batch-parse-result';
      result.innerHTML = `✅ 识别到 ${parsed.length} 个账号, ${totalTasks} 条任务<table class="tp-batch-preview-table"><tr><th>管理员</th><th>类型</th><th>账号</th><th>链接</th><th>任务</th></tr>${parsed.map(a =>
        `<tr><td>${u.esc(a.admin)}</td><td>${u.esc(a.type)}</td><td>${u.esc(a.name)}</td><td>${a.link?'✅':'—'}</td><td>${a.tasks.map(t=>`${u.esc(t.taskType)}×${t.dailyQuantity}`).join(', ')}</td></tr>`
      ).join('')}</table>`;
      u.qs('#tp-batch-import',panel).disabled = false;
    };

    u.qs('#tp-batch-import',panel).onclick = () => {
      parsed.forEach(a => store.addAccount({...a, customFields:{}}));
      toast(`✅ 导入 ${parsed.length} 个账号`); renderRoot();
    };
  }

  // ── 自定义列管理 ──
  function showCustomColManager() {
    const cols = JSON.parse(JSON.stringify(store.getCustomCols()));
    const overlay = u.el('div', 'tp-modal-overlay');

    const renderList = () => cols.map((c,i) => `
      <div class="tp-capacity-item" data-ci="${i}">
        <input value="${u.esc(c.name)}" class="cc-name" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px">
        <select class="cc-type" style="padding:5px;border:1px solid var(--border);border-radius:6px;font-size:13px">
          <option value="text" ${c.type==='text'?'selected':''}>文本</option>
          <option value="dropdown" ${c.type==='dropdown'?'selected':''}>下拉菜单</option>
          <option value="fixed" ${c.type==='fixed'?'selected':''}>固定值</option>
        </select>
        <input value="${u.esc(c.type==='dropdown'?(c.options||[]).join(','):c.type==='fixed'?c.fixedValue||'':'')}" class="cc-extra" placeholder="${c.type==='dropdown'?'选项(逗号分隔)':c.type==='fixed'?'固定值':''}" style="width:160px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px">
        <button class="tp-capacity-item-del cc-del">✕</button>
      </div>
    `).join('');

    overlay.innerHTML = `<div class="tp-modal">
      <div class="tp-modal-header"><h3>⚙ 自定义列管理</h3><button class="tp-modal-close">✕</button></div>
      <p style="font-size:12px;color:var(--muted);margin:0 0 12px">添加自定义列到账号表格。支持：文本输入、下拉菜单、固定值</p>
      <div id="tp-cc-list">${renderList()}</div>
      <button class="tp-btn-ghost tp-btn-sm" id="tp-cc-add" style="margin-top:8px">+ 添加列</button>
      <div class="tp-modal-footer"><button class="tp-btn-ghost tp-cc-cancel">取消</button><button class="tp-btn-primary tp-cc-save">保存</button></div>
    </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    u.qs('.tp-modal-close',overlay).onclick = close;
    u.qs('.tp-cc-cancel',overlay).onclick = close;
    overlay.onclick = e => { if(e.target===overlay) close(); };

    const bindDels = () => u.qsa('.cc-del',overlay).forEach((btn,i) => { btn.onclick = () => { cols.splice(i,1); u.qs('#tp-cc-list',overlay).innerHTML = renderList(); bindDels(); }; });
    bindDels();

    u.qs('#tp-cc-add',overlay).onclick = () => {
      cols.push({ id: u.id(), name: '新列', type: 'text', options: [], fixedValue: '' });
      u.qs('#tp-cc-list',overlay).innerHTML = renderList(); bindDels();
    };

    u.qs('.tp-cc-save',overlay).onclick = () => {
      u.qsa('[data-ci]',overlay).forEach((row,i) => {
        cols[i].name = u.qs('.cc-name',row).value.trim() || '未命名';
        cols[i].type = u.qs('.cc-type',row).value;
        const extra = u.qs('.cc-extra',row).value.trim();
        if(cols[i].type==='dropdown') cols[i].options = extra.split(',').map(s=>s.trim()).filter(Boolean);
        else if(cols[i].type==='fixed') cols[i].fixedValue = extra;
      });
      store.setCustomCols(cols); toast('✅ 已保存'); close(); renderRoot();
    };
  }

  // ══════════════════════════════════════
  //  产能设置
  // ══════════════════════════════════════
  function renderCapacity(container) {
    const cap = store.getCapacity();
    const types = store.getPostTypes();
    container.innerHTML = `<div class="tp-capacity-settings"><div class="tp-capacity-settings-card">
      <div class="tp-capacity-settings-header"><h4>⚡ 我的产能设置</h4></div>
      <p class="tp-capacity-settings-desc">每天每种任务类型能完成的数量上限</p>
      <div id="tp-cap-list"></div>
      <div class="tp-add-type-row"><input type="text" placeholder="新类型名" id="tp-nt" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px"><button class="tp-btn-ghost tp-btn-sm" id="tp-at">+ 添加</button></div>
      <div style="margin-top:16px"><button class="tp-btn-primary" id="tp-sc">💾 保存</button></div>
    </div></div>`;
    const list = u.qs('#tp-cap-list',container);
    types.forEach(type => {
      const item = u.el('div','tp-capacity-item');
      item.innerHTML = `<div class="tp-capacity-item-label">${type}</div><input type="number" min="0" value="${cap[type]||0}" data-type="${type}"><div class="tp-capacity-item-unit">条/天</div><button class="tp-capacity-item-del" data-type="${type}">✕</button>`;
      u.qs('.tp-capacity-item-del',item).onclick = () => {
        if(!confirm(`删除"${type}"？`)) return;
        store.setPostTypes(types.filter(t=>t!==type));
        const nc={...cap}; delete nc[type]; store.setCapacity(nc); toast('已删除'); renderRoot();
      };
      list.appendChild(item);
    });
    u.qs('#tp-at',container).onclick = () => {
      const name = u.qs('#tp-nt',container).value.trim();
      if(!name) return; if(types.includes(name)) return toast('已存在');
      types.push(name); store.setPostTypes(types); renderRoot();
    };
    u.qs('#tp-sc',container).onclick = () => {
      const nc = {};
      u.qsa('#tp-cap-list input[type="number"]',container).forEach(inp => { nc[inp.dataset.type] = parseInt(inp.value)||0; });
      store.setCapacity(nc); toast('✅ 已保存');
    };
  }

  // ══════════════════════════════════════
  //  AI 建议
  // ══════════════════════════════════════
  function showAIModal(accounts, todos, cap, today) {
    const demand = {};
    const details = [];
    accounts.forEach(acc => (acc.tasks||[]).forEach(t => {
      const diff = u.diffDays(today, t.currentProgress||today);
      const d = (t.dailyQuantity||0) * (diff>0?diff+1:1);
      const type = t.taskType||'其他';
      demand[type] = (demand[type]||0) + d;
      if(diff>0) details.push({name:`${acc.name}·${t.taskType}`, diff, target:d});
    }));
    details.sort((a,b) => b.diff - a.diff);

    const types = [...new Set([...Object.keys(demand),...Object.keys(cap)])];
    const max = Math.max(...types.map(t=>Math.max(demand[t]||0,cap[t]||0)),1);
    const bars = types.map(t => {
      const d=demand[t]||0, c=cap[t]||0, over=c>0&&d>c;
      return `<div class="tp-ai-demand-row"><span style="width:50px;text-align:right;font-weight:600">${t}</span><div class="tp-ai-demand-bar-wrap"><div class="tp-ai-demand-fill ${over?'over':'ok'}" style="width:${Math.min(d/max*100,100)}%"></div></div><span style="min-width:100px">${d}/${c||'—'} ${over?'⚠️超出'+(d-c):'✅'}</span></div>`;
    }).join('');

    let advice = [];
    details.forEach(d => advice.push(`🔴 <strong>${d.name}</strong> 落后${d.diff}天，今日需${d.target}条`));
    todos.filter(t=>t.priority==='urgent'&&t.status!=='done').forEach(t => advice.push(`⚡ 紧急：<strong>${t.name}</strong>`));
    types.forEach(t => { const d=demand[t]||0,c=cap[t]||0; if(c>0&&d>c) advice.push(`⚠️ ${t}超载(${d}/${c})，建议调低目标`); });
    if(!advice.length) advice.push('✅ 今日负载正常');

    const overlay = u.el('div','tp-modal-overlay');
    overlay.innerHTML = `<div class="tp-modal" style="max-width:620px">
      <div class="tp-modal-header"><h3>🤖 今日规划建议</h3><button class="tp-modal-close">✕</button></div>
      <div class="tp-ai-section"><div class="tp-ai-section-title">📊 工作量</div>${bars}</div>
      <div class="tp-ai-section"><div class="tp-ai-section-title">💡 建议</div><ol class="tp-ai-advice-list">${advice.map(a=>`<li>${a}</li>`).join('')}</ol></div>
      <div class="tp-modal-footer"><button class="tp-btn-primary tp-ai-close">明白了</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    u.qs('.tp-modal-close',overlay).onclick = close;
    u.qs('.tp-ai-close',overlay).onclick = close;
    overlay.onclick = e => { if(e.target===overlay) close(); };
  }

  renderRoot();
})();
