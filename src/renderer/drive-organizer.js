/**
 * 云端文件分拣器 (Drive File Organizer) — Vanilla JS
 * 适配 ITEN 上传工具：使用 bridge OAuth token，浅色主题
 */
(function () {
  'use strict';

  const STORAGE_TABS = 'do_tabs_v2';
  const STORAGE_ACTIVE = 'do_active_tab';
  const COLORS = ['#27ae60','#2980b9','#e67e22','#e74c3c','#9b59b6','#1abc9c','#f39c12','#3498db','#e91e63','#00bcd4'];

  // ── Tab system ──
  function makeTab(name) {
    return { id: 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2,6), name: name || '新标签页', url: '', files: [], targets: [], classMap: {}, rootFolderId: null, scanTime: null };
  }
  let tabs = [];
  let activeTabId = null;

  // ── Current tab state (loaded from active tab) ──
  let files = [];
  let targets = [];
  let classMap = {};
  let selectedIds = new Set();
  let scanning = false;
  let moving = false;
  let abortCtrl = null;
  let viewMode = 'grid';
  let typeFilter = 'all';
  let searchQuery = '';
  let activeTargetFilter = null;
  let recursive = true;
  let pathStack = [];
  let browseMode = 'folder';
  let rootFolderId = null;

  function activeTab() { return tabs.find(t => t.id === activeTabId); }
  function saveTabState() {
    const tab = activeTab();
    if (!tab) return;
    tab.files = files; tab.targets = targets; tab.classMap = classMap;
    tab.rootFolderId = rootFolderId;
    tab.url = $('#do-folder-url')?.value || '';
  }
  function loadTabState(tab) {
    if (!tab) return;
    files = tab.files || []; targets = tab.targets || []; classMap = tab.classMap || {};
    rootFolderId = tab.rootFolderId || null;
    selectedIds = new Set(); pathStack = []; searchQuery = ''; activeTargetFilter = null;
    const inp = $('#do-folder-url');
    if (inp) inp.value = tab.url || '';
  }
  function switchTab(tabId) {
    if (scanning) return; // 扫描中不允许切换
    saveTabState();
    activeTabId = tabId;
    const tab = activeTab();
    if (!tab) return;
    loadTabState(tab);
    persistTabs();
    renderTabBar();
    renderAll();
    const time = tab.scanTime;
    if (files.length > 0 && time) {
      setScanStatus(`📦 已恢复 ${files.length} 个文件（${formatCacheTime(time)}）`);
    } else {
      setScanStatus('');
    }
  }
  function addNewTab(name) {
    saveTabState();
    const tab = makeTab(name);
    tabs.push(tab);
    activeTabId = tab.id;
    loadTabState(tab);
    persistTabs();
    renderTabBar();
    renderAll();
    setScanStatus(''); setError('');
  }
  function closeTab(tabId) {
    if (tabs.length <= 1) return; // 至少保留一个
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;
    tabs.splice(idx, 1);
    if (activeTabId === tabId) {
      activeTabId = tabs[Math.min(idx, tabs.length - 1)].id;
      loadTabState(activeTab());
    }
    persistTabs();
    renderTabBar();
    renderAll();
  }
  function renameTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const name = prompt('标签页名称：', tab.name);
    if (name && name.trim()) { tab.name = name.trim(); persistTabs(); renderTabBar(); }
  }

  function ls(k, v) { if (v === undefined) { try { return localStorage.getItem(k) || ''; } catch(e) { return ''; } } try { localStorage.setItem(k, v); } catch(e) {} }
  function lsJson(k, v) { if (v === undefined) { try { return JSON.parse(ls(k) || 'null'); } catch(e) { return null; } } ls(k, JSON.stringify(v)); }

  function extractFolderId(url) {
    const m = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
    if (m) return m[1];
    try { const u = new URL(url); const id = u.searchParams.get('id'); if (id && /^[a-zA-Z0-9_-]{10,}$/.test(id)) return id; } catch(e) {}
    return null;
  }

  function fileTypeCat(mime) {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('application/pdf') || mime.includes('document') || mime.includes('spreadsheet') || mime.includes('presentation') || mime.startsWith('text/')) return 'document';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar') || mime.includes('gzip') || mime.includes('compress') || mime.includes('archive')) return 'archive';
    return 'other';
  }

  let _cachedToken = null;
  let _tokenTs = 0;
  async function refreshTokenCache() {
    if (Date.now() - _tokenTs < 5 * 60 * 1000 && _cachedToken) return _cachedToken;
    _cachedToken = await getOAuthToken();
    _tokenTs = Date.now();
    return _cachedToken;
  }

  function thumbUrl(id, file) {
    // 优先使用 API 返回的 thumbnailLink（最可靠，自带认证）
    if (file?.thumbnailLink) return file.thumbnailLink.replace(/=s\d+/, '=s400');
    // 备选：lh3 CDN
    return `https://lh3.googleusercontent.com/d/${id}=w300`;
  }

  // Google Drive 官方图标（放大到 128px）
  function driveIconUrl(file) {
    if (file?.iconLink) {
      // Google 返回的是 16px 图标，替换为 128px 版本
      return file.iconLink.replace('/16/', '/128/');
    }
    return null;
  }

  function makeIconPlaceholder(file) {
    const iconUrl = driveIconUrl(file);
    if (iconUrl) {
      const wrap = h('div', { className: 'do-file-thumb-placeholder' });
      const img = h('img', { style: { width:'64px', height:'64px', objectFit:'contain' }, loading: 'lazy' });
      img.src = iconUrl;
      img.onerror = () => {
        const fallbackIcons = { image:'🖼️', video:'🎬', audio:'🎵', document:'📄', archive:'📦', other:'📄' };
        img.replaceWith(document.createTextNode(fallbackIcons[fileTypeCat(file.mimeType)] || '📄'));
      };
      wrap.appendChild(img);
      return wrap;
    }
    const fallbackIcons = { image:'🖼️', video:'🎬', audio:'🎵', document:'📄', archive:'📦', other:'📄' };
    return h('div', { className: 'do-file-thumb-placeholder' }, fallbackIcons[fileTypeCat(file.mimeType)] || '📄');
  }

  function makeFolderGridCell(child) {
    const iconUrl = driveIconUrl(child);
    const cell = h('div', { className: 'do-folder-thumb-item', style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f5f7fa', gap:'2px', padding:'4px', overflow:'hidden' } });
    if (iconUrl) {
      const icon = h('img', { style: { width:'28px', height:'28px', objectFit:'contain' }, loading:'lazy' });
      icon.src = iconUrl;
      icon.onerror = () => { icon.replaceWith(document.createTextNode('📄')); };
      cell.appendChild(icon);
    } else {
      const fallbackIcons = { image:'🖼️', video:'🎬', audio:'🎵', document:'📄', archive:'📦', other:'📄' };
      cell.appendChild(h('span', { style: { fontSize:'20px' } }, fallbackIcons[fileTypeCat(child.mimeType)] || '📄'));
    }
    cell.appendChild(h('span', { style: { fontSize:'8px', color:'#666', textAlign:'center', lineHeight:'1.1', maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', width:'100%' } }, child.name));
    return cell;
  }

  function fmtSize(b) {
    if (!b) return '';
    const n = parseInt(b, 10);
    if (isNaN(n)) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n/1048576).toFixed(1) + ' MB';
    return (n/1073741824).toFixed(1) + ' GB';
  }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k,v]) => {
      if (k === 'className') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'title') el.title = v;
      else if (k === 'draggable') el.draggable = v;
      else if (k === 'hidden') el.hidden = v;
      else el.setAttribute(k, v);
    });
    children.flat(Infinity).forEach(c => { if (c != null) el.append(typeof c === 'string' ? c : c); });
    return el;
  }

  // ── 获取 ITEN 的 OAuth Token ──
  async function getOAuthToken() {
    if (!window.bridge?.getAccessToken) return null;
    try {
      const r = await window.bridge.getAccessToken();
      return r?.token || null;
    } catch(e) { return null; }
  }

  // ── Drive API ──
  async function listFilesRecursive(folderId, onProgress, signal) {
    const results = [];
    const queue = [{ id: folderId, path: '' }];
    let fc = 0;
    // 优先用 OAuth token（可以读私有文件），否则用 API key
    const token = await getOAuthToken();
    while (queue.length) {
      if (signal.aborted) throw new DOMException('Aborted','AbortError');
      const cur = queue.shift();
      fc++;
      onProgress(`正在扫描第 ${fc} 个文件夹… (已发现 ${results.length} 个文件)`);
      let pt;
      do {
        if (signal.aborted) throw new DOMException('Aborted','AbortError');
        const q = encodeURIComponent(`'${cur.id}' in parents and trashed=false`);
        const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,thumbnailLink,iconLink)');
        let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000`;
        if (token) url += `&access_token=${token}`;
        else throw new Error('请先在主程序右上角登录 Google');
        if (pt) url += `&pageToken=${encodeURIComponent(pt)}`;
        const res = await fetch(url, { signal });
        if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err?.error?.message || `HTTP ${res.status}`); }
        const data = await res.json();
        for (const f of (data.files || [])) {
          if (f.mimeType === 'application/vnd.google-apps.folder') {
            results.push({ id:f.id, name:f.name, mimeType:f.mimeType, parents:f.parents, folderPath:cur.path, isFolder:true, iconLink:f.iconLink });
            if (recursive) queue.push({ id:f.id, path: cur.path ? `${cur.path}/${f.name}` : f.name });
          } else {
            results.push({ id:f.id, name:f.name, mimeType:f.mimeType, size:f.size, modifiedTime:f.modifiedTime, parents:f.parents, folderPath:cur.path, thumbnailLink:f.thumbnailLink, iconLink:f.iconLink });
          }
        }
        pt = data.nextPageToken;
      } while (pt);
    }
    return results;
  }

  async function moveFile(fileId, targetFolderId) {
    const token = await getOAuthToken();
    if (!token) return { success:false, error:'未登录 Google' };
    try {
      const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, { headers: { Authorization: `Bearer ${token}` } });
      if (!metaRes.ok) { const e = await metaRes.json().catch(()=>({})); return { success:false, error: e?.error?.message || `HTTP ${metaRes.status}` }; }
      const meta = await metaRes.json();
      const prev = (meta.parents||[]).join(',');
      const moveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${targetFolderId}&removeParents=${prev}&fields=id,parents`, {
        method:'PATCH', headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }
      });
      if (!moveRes.ok) { const e = await moveRes.json().catch(()=>({})); return { success:false, error: e?.error?.message || `HTTP ${moveRes.status}` }; }
      return { success:true };
    } catch(e) { return { success:false, error: e.message }; }
  }

  // ── State helpers ──
  function persistTabs() {
    saveTabState();
    try { lsJson(STORAGE_TABS, tabs); ls(STORAGE_ACTIVE, activeTabId); } catch(e) { console.warn('[DO] 标签页缓存写入失败', e); }
  }
  function persist() { persistTabs(); }
  function persistFiles() {
    const tab = activeTab();
    if (tab) tab.scanTime = new Date().toISOString();
    persistTabs();
  }
  function loadTabs() {
    const saved = lsJson(STORAGE_TABS);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      tabs = saved;
      activeTabId = ls(STORAGE_ACTIVE) || tabs[0].id;
      if (!tabs.find(t => t.id === activeTabId)) activeTabId = tabs[0].id;
    } else {
      // 尝试从旧格式迁移
      const oldFiles = lsJson('do_files_cache');
      const oldTargets = lsJson('do_targets');
      const oldClassMap = lsJson('do_class_map');
      const tab = makeTab('默认');
      if (oldFiles && Array.isArray(oldFiles)) tab.files = oldFiles;
      if (oldTargets) tab.targets = oldTargets;
      if (oldClassMap) tab.classMap = oldClassMap;
      tab.url = ls('do_scan_url') || '';
      tab.scanTime = ls('do_scan_time') || null;
      tab.rootFolderId = ls('do_root_folder_id') || null;
      tabs = [tab];
      activeTabId = tab.id;
    }
    loadTabState(activeTab());
  }
  function renderTabBar() {
    const bar = $('#do-tab-bar');
    if (!bar) return;
    bar.innerHTML = '';
    tabs.forEach(tab => {
      const isActive = tab.id === activeTabId;
      const tabEl = h('div', { className: 'do-tab' + (isActive ? ' active' : ''), onClick: () => switchTab(tab.id) },
        h('span', { className: 'do-tab-name', title: tab.name + (tab.url ? '\n' + tab.url : '') }, tab.name + (tab.files?.length ? ` (${tab.files.length})` : ''))
      );
      if (isActive) {
        tabEl.addEventListener('dblclick', (e) => { e.stopPropagation(); renameTab(tab.id); });
      }
      if (tabs.length > 1) {
        tabEl.appendChild(h('span', { className: 'do-tab-close', onClick: (e) => { e.stopPropagation(); closeTab(tab.id); } }, '✕'));
      }
      bar.appendChild(tabEl);
    });
    bar.appendChild(h('div', { className: 'do-tab do-tab-add', onClick: () => addNewTab(), title: '新建标签页' }, '+'));
  }
  function formatCacheTime(iso) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = Math.floor((now - d) / 1000);
      if (diff < 60) return '刚刚缓存';
      if (diff < 3600) return `${Math.floor(diff/60)} 分钟前缓存`;
      if (diff < 86400) return `${Math.floor(diff/3600)} 小时前缓存`;
      return `${Math.floor(diff/86400)} 天前缓存`;
    } catch(e) { return ''; }
  }
  function setError(msg) { const el = $('#do-error'); if (el) { el.textContent = msg ? '⚠️ ' + msg : ''; el.hidden = !msg; } }
  function setScanStatus(msg) { const el = $('#do-scan-status'); if (el) { el.textContent = msg; el.hidden = !msg; } }

  function getFilteredFiles() {
    let r = files;
    if (browseMode === 'folder') {
      // 文件夹浏览模式：只显示当前层级
      if (pathStack.length > 0) {
        const currentParent = pathStack[pathStack.length - 1].id;
        r = r.filter(f => f.parents?.includes(currentParent));
      } else if (rootFolderId) {
        r = r.filter(f => f.parents?.includes(rootFolderId));
      }
    } else {
      // 平铺模式：如果进入了子文件夹，显示该文件夹下所有层级的文件
      if (pathStack.length > 0) {
        const currentParent = pathStack[pathStack.length - 1].id;
        const folderIds = collectSubFolderIds(currentParent);
        folderIds.add(currentParent);
        r = r.filter(f => f.parents?.some(p => folderIds.has(p)));
      }
    }
    if (typeFilter === 'folder') r = r.filter(f => f.isFolder);
    else if (typeFilter !== 'all') r = r.filter(f => !f.isFolder && fileTypeCat(f.mimeType) === typeFilter);
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); r = r.filter(f => f.name.toLowerCase().includes(q) || (f.folderPath||'').toLowerCase().includes(q)); }
    if (activeTargetFilter === '__unclassified__') r = r.filter(f => !f.isFolder && !classMap[f.id]);
    else if (activeTargetFilter) r = r.filter(f => classMap[f.id] === activeTargetFilter);
    return r;
  }

  function collectSubFolderIds(parentId) {
    const ids = new Set();
    const queue = [parentId];
    while (queue.length) {
      const pid = queue.shift();
      for (const f of files) {
        if (f.isFolder && f.parents?.includes(pid) && !ids.has(f.id)) {
          ids.add(f.id);
          queue.push(f.id);
        }
      }
    }
    return ids;
  }

  function selectAll() {
    const filtered = getFilteredFiles().filter(f => !f.isFolder);
    filtered.forEach(f => selectedIds.add(f.id));
    renderAll();
  }
  function invertSelection() {
    const filtered = getFilteredFiles().filter(f => !f.isFolder);
    filtered.forEach(f => {
      if (selectedIds.has(f.id)) selectedIds.delete(f.id);
      else selectedIds.add(f.id);
    });
    renderAll();
  }
  function deselectAll() {
    selectedIds.clear();
    renderAll();
  }

  function setSelectedAsTarget() {
    const selectedFolders = files.filter(f => f.isFolder && selectedIds.has(f.id) && !targets.some(t => t.folderId === f.id));
    if (selectedFolders.length === 0) return;
    selectedFolders.forEach(folder => {
      targets.push({ id: 't-' + Date.now() + '-' + folder.id.slice(0,4), name: folder.name, folderId: folder.id, color: COLORS[targets.length % COLORS.length] });
    });
    selectedIds.clear();
    persist();
    renderAll();
  }

  function targetCounts() { const c = {}; for (const fid of Object.keys(classMap)) { c[classMap[fid]] = (c[classMap[fid]]||0)+1; } return c; }

  // ── Actions ──
  async function immediateMoveSelected(target) {
    const token = await getOAuthToken();
    if (!token) { setError('请先在主程序右上角登录 Google 以完成授权'); return; }
    if (!target.folderId) { setError('该目标文件夹尚未绑定 Google Drive，无法移动。'); return; }
    
    const fileIds = Array.from(selectedIds);
    const moves = [];
    for (const fid of fileIds) {
      const f = files.find(x => x.id === fid);
      if (f) moves.push({ fileId: fid, fileName: f.name });
    }
    
    if (!moves.length) return;
    
    moving = true;
    setScanStatus(`🚀 开始移动 ${moves.length} 个文件到 "${target.name}"...`);
    renderAll();
    
    let done = 0, failed = 0;
    for (const m of moves) {
      const r = await moveFile(m.fileId, target.folderId);
      done++;
      if (r.success) {
        files = files.filter(f => f.id !== m.fileId);
        selectedIds.delete(m.fileId);
        delete classMap[m.fileId];
      } else {
        failed++;
      }
      setScanStatus(`移动进度 ${done}/${moves.length}` + (failed ? ` (${failed} 失败)` : ''));
      if (done < moves.length) await new Promise(r => setTimeout(r, 100));
    }
    
    moving = false;
    persist();
    setScanStatus(`✅ 成功移动 ${done - failed} 个文件到 "${target.name}"` + (failed ? `，${failed} 个失败` : ''));
    renderAll();
  }

  async function doScan() {
    const rawUrl = $('#do-folder-url')?.value || '';
    // 支持多个链接（逗号、空格、换行分隔）
    const urls = rawUrl.split(/[\s,，]+/).map(s => s.trim()).filter(Boolean);
    const folderIds = urls.map(u => extractFolderId(u)).filter(Boolean);
    if (folderIds.length === 0) { setError('无法解析链接，请粘贴有效的 Google Drive 文件夹 URL'); return; }
    const token = await getOAuthToken();
    if (!token) { setError('请先在主程序右上角登录 Google 以完成授权'); return; }
    setError(''); scanning = true; files = []; selectedIds.clear(); pathStack = [];
    rootFolderId = folderIds[0];
    abortCtrl?.abort(); abortCtrl = new AbortController();
    updateScanButtons(true);
    try {
      let allFiles = [];
      for (let i = 0; i < folderIds.length; i++) {
        setScanStatus(`正在扫描第 ${i+1}/${folderIds.length} 个文件夹…`);
        const result = await listFilesRecursive(folderIds[i], setScanStatus, abortCtrl.signal);
        allFiles = allFiles.concat(result);
      }
      // 去重（根据文件 ID）
      const seen = new Set();
      files = allFiles.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
      persistFiles();
      // 自动设置标签页名称
      const tab = activeTab();
      if (tab && tab.name === '新标签页') {
        tab.name = urls.length > 1 ? `${folderIds.length} 个文件夹` : (rawUrl.match(/([^\/]+)\/?$/)?.[1]?.slice(0,20) || '扫描结果');
        renderTabBar();
      }
      setScanStatus(`✅ 扫描完成，共 ${files.length} 个文件（${folderIds.length} 个文件夹）`);
    } catch(e) { if (e.name !== 'AbortError') setError(e.message); }
    scanning = false; updateScanButtons(false); renderAll();
  }

  async function doRefresh() {
    const url = $('#do-folder-url')?.value || activeTab()?.url || '';
    if (!url) { setError('请先输入文件夹链接再刷新'); return; }
    if ($('#do-folder-url')) $('#do-folder-url').value = url;
    await doScan();
  }

  function updateScanButtons(isScanning) {
    const scanBtn = $('#do-scan-btn');
    const stopBtn = $('#do-stop-btn');
    const refreshBtn = $('#do-refresh-btn');
    if (scanBtn) scanBtn.hidden = isScanning;
    if (stopBtn) stopBtn.hidden = !isScanning;
    if (refreshBtn) refreshBtn.hidden = isScanning || files.length === 0;
  }

  // ── 批量下载 ──
  async function startDownload() {
    if (!window.bridge?.download) { setError('当前版本不支持下载功能'); return; }
    // 获取选中的文件（排除文件夹）
    const downloadFiles = files.filter(f => selectedIds.has(f.id) && !f.isFolder);
    if (downloadFiles.length === 0) { setError('请先选择要下载的文件（不包含文件夹）'); return; }
    // 选择下载目录
    const destDir = await window.bridge.download.pickDir();
    if (!destDir) return;
    // 启动下载
    const result = await window.bridge.download.start({
      files: downloadFiles.map(f => ({ id: f.id, name: f.name, size: f.size, mimeType: f.mimeType })),
      destDir
    });
    if (!result?.success) { setError(result?.error || '下载启动失败'); return; }
    // 显示下载面板
    const panel = $('#do-download-panel');
    if (panel) panel.hidden = false;
    updateDownloadUI({ state: 'downloading', totalFiles: downloadFiles.length, completedFiles: 0, failedFiles: 0, bytesDownloaded: 0, totalBytes: 0, currentFileName: '' });
  }

  function updateDownloadUI(p) {
    const status = $('#do-dl-status');
    const fill = $('#do-dl-fill');
    const details = $('#do-dl-details');
    const pauseBtn = $('#do-dl-pause');
    const resumeBtn = $('#do-dl-resume');
    const stopBtn = $('#do-dl-stop');
    const closeBtn = $('#do-dl-close');
    if (!status) return;

    const pct = p.totalBytes > 0 ? Math.round(p.bytesDownloaded / p.totalBytes * 100) : 0;
    if (fill) {
      fill.style.width = pct + '%';
      fill.className = 'do-dl-progress-fill' + (p.state === 'paused' ? ' paused' : p.state === 'done' ? ' done' : '');
    }

    const isDone = p.state === 'done' || p.state === 'stopped';
    if (pauseBtn) pauseBtn.hidden = p.state !== 'downloading';
    if (resumeBtn) resumeBtn.hidden = p.state !== 'paused';
    if (stopBtn) stopBtn.hidden = isDone;
    if (closeBtn) closeBtn.hidden = !isDone;

    if (p.state === 'downloading') {
      status.textContent = `⬇️ 正在下载 ${p.completedFiles + 1}/${p.totalFiles}：${p.currentFileName || ''}`;
    } else if (p.state === 'paused') {
      status.textContent = `⏸ 已暂停 (${p.completedFiles}/${p.totalFiles})`;
    } else if (p.state === 'done') {
      status.textContent = `✅ 下载完成！${p.completedFiles} 个文件` + (p.failedFiles ? `，${p.failedFiles} 个失败` : '');
    } else if (p.state === 'stopped') {
      status.textContent = `⏹ 已停止 (${p.completedFiles}/${p.totalFiles} 完成)`;
    }

    if (details) {
      details.textContent = `${fmtSize(p.bytesDownloaded)} / ${fmtSize(p.totalBytes)} (${pct}%)`;
    }
  }

  function classifySelected(targetId) {
    for (const id of selectedIds) classMap[id] = targetId;
    selectedIds.clear(); persist(); renderAll();
  }

  function unclassifySelected() {
    for (const id of selectedIds) delete classMap[id];
    selectedIds.clear(); persist(); renderAll();
  }

  async function executeMove() {
    const token = await getOAuthToken();
    if (!token) { setError('请先登录 Google 授权（点击顶栏「登录 Google」按钮）'); return; }
    const moves = [];
    for (const [fid, tid] of Object.entries(classMap)) {
      const t = targets.find(x => x.id === tid);
      if (!t || !t.folderId) continue;
      const f = files.find(x => x.id === fid);
      if (!f) continue;
      moves.push({ fileId:fid, fileName:f.name, targetFolderId:t.folderId, targetName:t.name });
    }
    if (!moves.length) { setError('没有可移动的文件。请确保目标文件夹已绑定链接。'); return; }
    if (!confirm(`确认移动 ${moves.length} 个文件到对应目标文件夹？\n此操作会将文件从原位置移走。`)) return;
    moving = true; renderAll();
    let done = 0, failed = 0;
    for (const m of moves) {
      const r = await moveFile(m.fileId, m.targetFolderId);
      done++;
      if (r.success) { delete classMap[m.fileId]; files = files.filter(f => f.id !== m.fileId); }
      else failed++;
      setScanStatus(`移动进度 ${done}/${moves.length}` + (failed ? ` (${failed} 失败)` : ''));
      if (done < moves.length) await new Promise(r => setTimeout(r, 100));
    }
    moving = false; persist();
    setScanStatus(`✅ 移动完成：成功 ${done - failed}，失败 ${failed}`);
    renderAll();
  }

  async function addTarget() {
    const input = ($('#do-new-target')?.value || '').trim();
    if (!input) return;
    const driveFolderId = extractFolderId(input);
    if (driveFolderId) {
      if (targets.some(t => t.folderId === driveFolderId)) { setError('该文件夹已存在'); return; }
      const color = COLORS[targets.length % COLORS.length];
      targets.push({ id:'t-'+Date.now(), name: driveFolderId.slice(0,12)+'...', folderId: driveFolderId, color });
      // 尝试获取名称
      const token = await getOAuthToken();
      const authParam = token ? `access_token=${token}` : '';
      if (authParam) {
        fetch(`https://www.googleapis.com/drive/v3/files/${driveFolderId}?fields=name&${authParam}`)
          .then(r=>r.json()).then(d=>{ const t=targets.find(x=>x.folderId===driveFolderId); if(t&&d.name){t.name=d.name; persist(); renderSidebar();} }).catch(()=>{});
      }
    } else {
      const color = COLORS[targets.length % COLORS.length];
      targets.push({ id:'t-'+Date.now(), name: input, folderId: '', color });
    }
    $('#do-new-target').value = '';
    persist(); renderSidebar();
  }

  // ── 检查授权状态 ──
  async function updateAuthBadge() {
    const badge = $('#do-auth-badge');
    if (!badge) return;
    const token = await getOAuthToken();
    if (token) {
      badge.className = 'do-auth-badge authorized';
      badge.textContent = '✓ 已授权';
    } else {
      badge.className = 'do-auth-badge unauthorized';
      badge.textContent = '未授权';
    }
  }

  // ── Render ──
  function renderAll() { renderSidebar(); renderToolbar(); renderFileGrid(); renderActionBar(); updateAuthBadge(); updateScanButtons(scanning); }

  function renderSidebar() {
    const el = $('#do-sidebar-list');
    if (!el) return;
    const counts = targetCounts();
    el.innerHTML = '';
    targets.forEach((t, idx) => {
      const item = h('div', { className: `do-target-item${activeTargetFilter===t.id?' active':''}`, onClick: () => { 
        if (selectedIds.size > 0) {
          immediateMoveSelected(t);
        } else {
          activeTargetFilter = activeTargetFilter===t.id ? null : t.id; renderAll(); 
        }
      } },
        h('div', { className: 'do-target-color', style: { background: t.color } }),
        h('span', { className: 'do-target-name', title: t.name + (t.folderId?' ✓':' (未绑定)') }, t.name + (t.folderId?' ✓':'')),
        h('span', { className: 'do-kbd' }, String(idx+1)),
        h('span', { className: 'do-target-count' }, String(counts[t.id]||0)),
        h('span', { className: 'do-target-remove', title:'删除', onClick: (e) => { e.stopPropagation(); targets=targets.filter(x=>x.id!==t.id); for(const k of Object.keys(classMap)) if(classMap[k]===t.id) delete classMap[k]; persist(); renderAll(); } }, '✕')
      );
      item.style.borderLeftColor = t.color;
      item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', e => { e.preventDefault(); item.classList.remove('drag-over'); classifySelected(t.id); });
      el.appendChild(item);
    });
    if (files.length) {
      const unc = files.filter(f=>!f.isFolder&&!classMap[f.id]).length;
      el.appendChild(h('div', { className: `do-target-item unclassified${activeTargetFilter==='__unclassified__'?' active':''}`, onClick: () => { activeTargetFilter = activeTargetFilter==='__unclassified__' ? null : '__unclassified__'; renderAll(); } },
        h('div', { className: 'do-target-color', style: { background: '#94a3b8' } }),
        h('span', { className: 'do-target-name' }, '未分类'),
        h('span', { className: 'do-target-count' }, String(unc))
      ));
    }
  }

  function renderToolbar() {
    const el = $('#do-toolbar');
    if (!el) return;
    el.hidden = files.length === 0 && pathStack.length === 0;
    const filtered = getFilteredFiles();
    const info = $('#do-toolbar-info');
    if (info) info.textContent = `${filtered.length} / ${files.length} 个文件`;
    
    const bread = $('#do-breadcrumb');
    if (bread) {
      bread.innerHTML = '';
      bread.appendChild(h('span', { className: 'do-breadcrumb-item', onClick: () => { pathStack = []; renderAll(); } }, '全部文件'));
      pathStack.forEach((p, idx) => {
        bread.appendChild(h('span', { className: 'do-breadcrumb-sep' }, ' > '));
        bread.appendChild(h('span', { className: 'do-breadcrumb-item', onClick: () => { pathStack = pathStack.slice(0, idx + 1); renderAll(); } }, p.name));
      });
    }

    // 显示/隐藏"设为目标"按钮
    const setTargetBtn = $('#do-set-target-btn');
    if (setTargetBtn) {
      const hasSelectedFolders = files.some(f => f.isFolder && selectedIds.has(f.id) && !targets.some(t => t.folderId === f.id));
      setTargetBtn.hidden = !hasSelectedFolders;
    }
  }

  function renderFileGrid() {
    const el = $('#do-file-grid');
    if (!el) return;
    const filtered = getFilteredFiles();
    const empty = $('#do-empty');
    if (empty) empty.hidden = files.length > 0 || scanning;
    if (files.length === 0 && !scanning) { el.innerHTML = ''; return; }
    el.className = `do-file-grid${viewMode==='list'?' list-view':''}`;
    el.innerHTML = '';
    filtered.forEach(file => {
      const isFolder = file.isFolder;
      const cat = isFolder ? 'folder' : fileTypeCat(file.mimeType);
      const isImg = cat === 'image' || cat === 'video';
      const target = classMap[file.id] ? targets.find(t=>t.id===classMap[file.id]) : null;
      const isSel = selectedIds.has(file.id);
      const isAlreadyTarget = isFolder && targets.some(t=>t.folderId===file.id);
      const cls = ['do-file-card', isSel&&'selected', target&&'classified', isFolder&&'is-folder', isAlreadyTarget&&'is-target'].filter(Boolean).join(' ');

      const card = h('div', { className: cls, 'data-id': file.id });
      // 单击直接切换选中（不需要 Shift）
      card.addEventListener('click', (e) => {
        selectedIds.has(file.id) ? selectedIds.delete(file.id) : selectedIds.add(file.id);
        renderAll();
      });
      if (!isFolder) {
        card.draggable = true;
        card.addEventListener('dragstart', () => { if (!selectedIds.has(file.id)) { selectedIds.clear(); selectedIds.add(file.id); } });
      } else {
        card.addEventListener('dblclick', () => { pathStack.push({ id: file.id, name: file.name }); renderAll(); });
      }

      if (target) card.appendChild(h('span', { className: 'do-file-category-tag', style: { background: target.color } }, target.name));
      if (isAlreadyTarget) card.appendChild(h('span', { className: 'do-file-category-tag', style: { background: '#0f9d58' } }, '✓ 目标'));
      const cb = h('div', { className: 'do-file-checkbox' });
      if (isSel) cb.textContent = '✓';
      card.appendChild(cb);

      if (isFolder) {
        // 缩略图容器（按钮也放在这里面，确保居中对齐）
        const thumbWrap = h('div', { style: { position:'relative' } });
        // 搜索该文件夹下的所有文件作为缩略图预览
        const children = files.filter(f => {
          if (f.isFolder) return false;
          if (f.parents?.includes(file.id)) return true;
          const expectedPath = file.folderPath ? `${file.folderPath}/${file.name}` : file.name;
          if (f.folderPath === expectedPath) return true;
          return false;
        }).slice(0, 4);
        if (children.length > 0) {
          const grid = h('div', { className: 'do-folder-thumb-grid' });
          for (let i = 0; i < 4; i++) {
            if (i < children.length) {
              const child = children[i];
              const childCat = fileTypeCat(child.mimeType);
              if ((childCat === 'image' || childCat === 'video') && child.thumbnailLink) {
                const img = h('img', { className: 'do-folder-thumb-item', loading: 'lazy' });
                img.src = thumbUrl(child.id, child);
                img.onerror = () => {
                  const iconUrl = driveIconUrl(child);
                  if (iconUrl) {
                    img.replaceWith(makeFolderGridCell(child));
                  } else {
                    img.replaceWith(h('div', { className: 'do-folder-thumb-item', style: { display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', background:'#f0f2f5' } }, '📄'));
                  }
                };
                grid.appendChild(img);
              } else {
                grid.appendChild(makeFolderGridCell(child));
              }
            } else {
              grid.appendChild(h('div', { className: 'do-folder-thumb-item', style: { background: '#f0f2f5' } }));
            }
          }
          thumbWrap.appendChild(grid);
        } else {
          thumbWrap.appendChild(h('div', { className: 'do-file-thumb-placeholder', style: { color: isAlreadyTarget?'#0f9d58':'#f39c12' } }, '📁'));
        }
        card.appendChild(thumbWrap);
      } else if (isImg && (file.thumbnailLink || true)) {
        const img = h('img', { className: 'do-file-thumb', loading: 'lazy' });
        img.src = thumbUrl(file.id, file);
        img.onerror = () => {
          // 图片缩略图加载失败时回退到 Google 官方图标
          if (file.iconLink) {
            img.replaceWith(makeIconPlaceholder(file));
          } else {
            img.style.display = 'none';
          }
        };
        card.appendChild(img);
      } else {
        card.appendChild(makeIconPlaceholder(file));
      }

      card.appendChild(h('div', { className: 'do-file-info' },
        h('div', { className: 'do-file-name', title: file.name }, file.name),
        h('div', { className: 'do-file-meta' }, isFolder ? '文件夹' : ((file.folderPath?file.folderPath+' · ':'')+fmtSize(file.size)))
      ));

      el.appendChild(card);
    });
  }

  function renderActionBar() {
    const el = $('#do-action-bar');
    if (!el) return;
    const hasClass = Object.keys(classMap).length > 0;
    el.hidden = !(selectedIds.size > 0 || hasClass) || files.length === 0;
    const selInfo = $('#do-sel-info');
    const selTargets = $('#do-sel-targets');
    if (selInfo) selInfo.textContent = selectedIds.size > 0 ? `✅ 已选 ${selectedIds.size} 个文件` : '';
    if (selTargets) {
      selTargets.innerHTML = '';
      if (selectedIds.size > 0) {
        selTargets.appendChild(h('span', { style: { fontSize:'12px', color:'var(--muted)' } }, '移到：'));
        targets.forEach((t, idx) => {
          selTargets.appendChild(h('button', { className: 'do-action-target-btn', onClick: () => classifySelected(t.id) },
            h('span', { style: { background:t.color, width:'10px', height:'10px', borderRadius:'3px', display:'inline-block' } }),
            ' ' + t.name,
            h('span', { className: 'do-kbd' }, String(idx+1))
          ));
        });
        if (classMap[Array.from(selectedIds)[0]]) {
          selTargets.appendChild(h('button', { className: 'do-action-target-btn', style: { borderColor:'rgba(217,48,37,0.3)' }, onClick: () => unclassifySelected() }, '✕ 取消分类'));
        }
      }
    }
    const classInfo = $('#do-class-info');
    if (classInfo) classInfo.textContent = hasClass ? `已分类 ${Object.keys(classMap).filter(k=>files.some(f=>f.id===k)).length} / ${files.length}` : '';
    const moveBtn = $('#do-move-btn');
    if (moveBtn) moveBtn.hidden = !hasClass;
    const clearBtn = $('#do-clear-class-btn');
    if (clearBtn) clearBtn.hidden = !hasClass;
  }

  // ── Init ──
  function init() {
    const root = $('#do-root');
    if (!root || root.dataset.inited) return;
    root.dataset.inited = '1';

    loadTabs();
    renderTabBar();
    const tab = activeTab();
    if (tab && files.length > 0 && tab.scanTime) {
      setScanStatus(`📦 已恢复 ${files.length} 个文件（${formatCacheTime(tab.scanTime)}）`);
    }

    // 绑定事件
    $('#do-scan-btn')?.addEventListener('click', doScan);
    $('#do-stop-btn')?.addEventListener('click', () => { abortCtrl?.abort(); scanning = false; updateScanButtons(false); renderAll(); });
    $('#do-refresh-btn')?.addEventListener('click', doRefresh);
    $('#do-select-all-btn')?.addEventListener('click', selectAll);
    $('#do-invert-sel-btn')?.addEventListener('click', invertSelection);
    $('#do-deselect-btn')?.addEventListener('click', deselectAll);
    // 浏览模式切换
    document.querySelectorAll('.do-browse-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        browseMode = btn.dataset.browse;
        document.querySelectorAll('.do-browse-mode').forEach(b => b.classList.toggle('active', b === btn));
        renderAll();
      });
    });
    $('#do-add-target-btn')?.addEventListener('click', addTarget);
    $('#do-new-target')?.addEventListener('keydown', e => { if(e.key==='Enter') addTarget(); });
    $('#do-search')?.addEventListener('input', e => { searchQuery = e.target.value; renderAll(); });
    $('#do-recursive')?.addEventListener('change', e => { recursive = e.target.checked; });
    $('#do-folder-url')?.addEventListener('keydown', e => { if(e.key==='Enter') doScan(); });
    $('#do-move-btn')?.addEventListener('click', executeMove);
    $('#do-clear-class-btn')?.addEventListener('click', () => { classMap = {}; persist(); renderAll(); });
    $('#do-set-target-btn')?.addEventListener('click', setSelectedAsTarget);

    // 下载按钮
    $('#do-download-btn')?.addEventListener('click', startDownload);
    $('#do-dl-pause')?.addEventListener('click', () => window.bridge?.download?.pause());
    $('#do-dl-resume')?.addEventListener('click', () => window.bridge?.download?.resume());
    $('#do-dl-stop')?.addEventListener('click', () => window.bridge?.download?.stop());
    $('#do-dl-close')?.addEventListener('click', () => { const p = $('#do-download-panel'); if (p) p.hidden = true; });
    // 下载进度监听
    if (window.bridge?.download?.onProgress) {
      window.bridge.download.onProgress(updateDownloadUI);
    }

    // 类型过滤
    document.querySelectorAll('.do-type-filter').forEach(btn => {
      btn.addEventListener('click', () => { typeFilter = btn.dataset.type; document.querySelectorAll('.do-type-filter').forEach(b=>b.classList.toggle('active', b===btn)); renderAll(); });
    });
    // 视图切换
    document.querySelectorAll('.do-view-mode').forEach(btn => {
      btn.addEventListener('click', () => { viewMode = btn.dataset.mode; document.querySelectorAll('.do-view-mode').forEach(b=>b.classList.toggle('active', b===btn)); renderAll(); });
    });

    // 键盘快捷键 1-9
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      // 只在分拣器可见时生效
      const panel = document.querySelector('[data-view="drive-organizer"]');
      if (!panel || panel.hidden || !panel.classList.contains('active')) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= targets.length && selectedIds.size > 0) { e.preventDefault(); classifySelected(targets[num-1].id); }
      if (e.key === 'Escape') { selectedIds.clear(); renderAll(); }
    });

    // 初始化 UI 值
    if ($('#do-recursive')) $('#do-recursive').checked = recursive;

    initMarqueeSelection();

    // 先刷新 token 缓存，再渲染（确保缩略图能带上认证）
    refreshTokenCache().then(() => renderAll());
  }

  function initMarqueeSelection() {
    const grid = $('#do-file-grid');
    if (!grid) return;
    
    let isDragging = false;
    let startX = 0, startY = 0;
    let box = null;
    let initialSelected = new Set();
    
    grid.addEventListener('mousedown', e => {
      if (e.target.closest('.do-file-card')) return; // If clicking on a card, let card handle it
      if (e.button !== 0) return; // Only left click
      
      isDragging = true;
      const rect = grid.getBoundingClientRect();
      startX = e.clientX - rect.left + grid.scrollLeft;
      startY = e.clientY - rect.top + grid.scrollTop;
      
      initialSelected = new Set(e.shiftKey || e.metaKey || e.ctrlKey ? selectedIds : []);
      
      box = document.createElement('div');
      box.className = 'do-selection-box';
      box.style.left = startX + 'px';
      box.style.top = startY + 'px';
      box.style.width = '0px';
      box.style.height = '0px';
      grid.appendChild(box);
      
      e.preventDefault(); // Prevent text selection
    });
    
    document.addEventListener('mousemove', e => {
      if (!isDragging || !box) return;
      
      const rect = grid.getBoundingClientRect();
      const currentX = e.clientX - rect.left + grid.scrollLeft;
      const currentY = e.clientY - rect.top + grid.scrollTop;
      
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      box.style.left = left + 'px';
      box.style.top = top + 'px';
      box.style.width = width + 'px';
      box.style.height = height + 'px';
      
      // Calculate intersections
      const boxRect = { left, top, right: left + width, bottom: top + height };
      const newSelected = new Set(initialSelected);
      
      grid.querySelectorAll('.do-file-card:not(.is-folder)').forEach(card => {
        const cardRectEl = card.getBoundingClientRect();
        const cardRect = {
          left: cardRectEl.left - rect.left + grid.scrollLeft,
          top: cardRectEl.top - rect.top + grid.scrollTop,
          right: cardRectEl.right - rect.left + grid.scrollLeft,
          bottom: cardRectEl.bottom - rect.top + grid.scrollTop
        };
        
        const intersect = !(
          cardRect.right < boxRect.left || 
          cardRect.left > boxRect.right || 
          cardRect.bottom < boxRect.top || 
          cardRect.top > boxRect.bottom
        );
        
        const fileId = card.dataset.id;
        if (!fileId) return;
        
        if (intersect) {
          newSelected.add(fileId);
        } else if (!initialSelected.has(fileId)) {
          newSelected.delete(fileId);
        }
      });
      
      let changed = false;
      if (newSelected.size !== selectedIds.size) changed = true;
      else {
        for (let id of newSelected) {
          if (!selectedIds.has(id)) { changed = true; break; }
        }
      }
      
      if (changed) {
        selectedIds = newSelected;
        // Fast update without re-rendering everything
        grid.querySelectorAll('.do-file-card:not(.is-folder)').forEach(card => {
          const id = card.dataset.id;
          if (id) {
            const isSel = selectedIds.has(id);
            if (isSel !== card.classList.contains('selected')) {
              card.classList.toggle('selected', isSel);
              const cb = card.querySelector('.do-file-checkbox');
              if (cb) cb.textContent = isSel ? '✓' : '';
            }
          }
        });
        
        const selInfo = $('#do-sel-info');
        if (selInfo) selInfo.textContent = selectedIds.size > 0 ? `✅ 已选 ${selectedIds.size} 个文件` : '';
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        if (box && box.parentNode) box.parentNode.removeChild(box);
        box = null;
        renderActionBar(); // Update bottom bar state
      }
    });
  }

  window.DriveOrganizer = { init };
})();
