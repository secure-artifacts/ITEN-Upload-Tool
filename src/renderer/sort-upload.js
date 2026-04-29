/**
 * 分拣上传模式 (Sort Upload) — 独立模块
 * 依赖：renderer.js 中的 state.slots, addSlot, handleUpload, getSlotReadableName 等
 */
(function () {
  'use strict';

  const COLORS = ['#27ae60','#2980b9','#e67e22','#e74c3c','#9b59b6','#1abc9c','#f39c12','#3498db','#e91e63','#00bcd4'];
  const SLOT_MODES_MAP = { LIBRARY: 'library', CUSTOM_LINK: 'custom-link' };

  // ── Custom prompt (Electron blocks window.prompt) ──
  function showPrompt(message, defaultValue = '') {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center;';
      const box = document.createElement('div');
      box.style.cssText = 'background:#fff;border-radius:12px;padding:20px 24px;min-width:340px;max-width:460px;box-shadow:0 8px 32px rgba(0,0,0,0.25);font-family:system-ui;';
      const label = document.createElement('div');
      label.style.cssText = 'font-size:13px;color:#333;margin-bottom:12px;white-space:pre-wrap;line-height:1.5;';
      label.textContent = message;
      const input = document.createElement('input');
      input.type = 'text'; input.value = defaultValue;
      input.style.cssText = 'width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d0d5dd;border-radius:8px;font-size:13px;outline:none;margin-bottom:14px;';
      input.addEventListener('focus', () => { input.style.borderColor = '#4285f4'; });
      input.addEventListener('blur', () => { input.style.borderColor = '#d0d5dd'; });
      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '取消';
      cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;color:#555;';
      const okBtn = document.createElement('button');
      okBtn.textContent = '确定';
      okBtn.style.cssText = 'padding:6px 16px;border:none;border-radius:8px;background:#4285f4;color:#fff;cursor:pointer;font-size:13px;';
      cancelBtn.onclick = () => { overlay.remove(); resolve(null); };
      okBtn.onclick = () => { overlay.remove(); resolve(input.value); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') okBtn.click(); if (e.key === 'Escape') cancelBtn.click(); });
      btns.append(cancelBtn, okBtn);
      box.append(label, input, btns);
      overlay.append(box);
      document.body.append(overlay);
      setTimeout(() => input.focus(), 50);
    });
  }

  // ── Avatar Crop/Position Modal ──
  function showAvatarCropModal(folder, imgPath) {
    const fileSrc = 'file://' + encodeURI(imgPath).replace(/#/g, '%23');
    const prevPos = folder.avatarPos || { x: 50, y: 50 };
    let posX = prevPos.x, posY = prevPos.y;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:14px;padding:20px 24px;width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.3);font-family:system-ui;';

    const title = document.createElement('div');
    title.textContent = '调整头像显示位置';
    title.style.cssText = 'font-size:14px;font-weight:600;color:#333;margin-bottom:12px;text-align:center;';

    const hint = document.createElement('div');
    hint.textContent = '拖拽图片调整显示区域';
    hint.style.cssText = 'font-size:11px;color:#999;text-align:center;margin-bottom:10px;';

    // Preview container (square, clipped)
    const preview = document.createElement('div');
    preview.style.cssText = 'width:200px;height:200px;margin:0 auto 16px;border-radius:12px;overflow:hidden;border:2px solid #e0e0e0;position:relative;cursor:grab;background:#f5f5f5;';
    const img = document.createElement('img');
    img.src = fileSrc;
    img.style.cssText = `position:absolute;min-width:100%;min-height:100%;object-fit:cover;object-position:${posX}% ${posY}%;width:100%;height:100%;pointer-events:none;user-select:none;`;
    preview.appendChild(img);

    // Drag logic
    let dragging = false, startMX, startMY, startPX, startPY;
    preview.addEventListener('mousedown', (e) => {
      dragging = true; startMX = e.clientX; startMY = e.clientY;
      startPX = posX; startPY = posY;
      preview.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startMX;
      const dy = e.clientY - startMY;
      posX = Math.max(0, Math.min(100, startPX - dx * 0.5));
      posY = Math.max(0, Math.min(100, startPY - dy * 0.5));
      img.style.objectPosition = `${posX}% ${posY}%`;
    }
    function onUp() {
      dragging = false;
      preview.style.cursor = 'grab';
    }

    // Buttons
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;justify-content:center;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = 'padding:8px 20px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;color:#555;';
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '清除头像';
    clearBtn.style.cssText = 'padding:8px 20px;border:1px solid #f87171;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;color:#f87171;';
    const okBtn = document.createElement('button');
    okBtn.textContent = '确定';
    okBtn.style.cssText = 'padding:8px 20px;border:none;border-radius:8px;background:#4285f4;color:#fff;cursor:pointer;font-size:13px;';

    function cleanup() { overlay.remove(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
    cancelBtn.onclick = cleanup;
    clearBtn.onclick = () => { folder.avatar = ''; folder.avatarPos = null; saveLocalTargetFolders(); renderSlotList(); cleanup(); };
    okBtn.onclick = () => { folder.avatar = imgPath; folder.avatarPos = { x: Math.round(posX), y: Math.round(posY) }; saveLocalTargetFolders(); renderSlotList(); cleanup(); };

    btns.append(cancelBtn, clearBtn, okBtn);
    box.append(title, hint, preview, btns);
    overlay.append(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
    document.body.append(overlay);
  }

  // ── Video Player Modal ──
  function showVideoPlayer(src) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;';
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;max-width:90vw;max-height:85vh;';
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    video.style.cssText = 'max-width:90vw;max-height:85vh;border-radius:8px;outline:none;';
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:absolute;top:-12px;right:-12px;width:28px;height:28px;border-radius:50%;background:#fff;color:#333;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);z-index:1;';
    closeBtn.onclick = close;
    wrap.append(video, closeBtn);
    overlay.append(wrap);
    document.body.append(overlay);
  }

  // ── State ──
  let localFiles = [];        // { id, name, path, size, mimeType, relPath }
  let selectedIds = new Set();
  let assignMap = {};          // filePath → slotId
  let suppressNextFileCardClick = false;
  let recentSlotIds = [];
  let localFolderPath = '';
  let localFolderPaths = [];    // 多文件夹模式：所有已添加的源文件夹路径
  let currentPage = 1;
  let pageSize = 100;
  let typeFilter = 'all';
  let searchQuery = '';
  let slotSearchQuery = '';
  let collapsedGroups = new Set();
  let dateFilter = 'today';
  let sortOrder = 'date-desc';
  let uploadedMap = {};        // fileId → { slotId, slotName, status: 'done'|'fail' }
  let cloudSubfolderEnabled = true; // 云端是否自动建子文件夹（默认开）
  let fileViewMode = 'tree';   // 'flat' | 'tree'
  let currentTreePath = '';    // 当前浏览的子路径（层级模式）

  // ── Work Mode ──
  let workMode = 'upload';           // 'upload' | 'local-organize'
  let localTargetFolders = [];       // [{ id, name, path, group? }]
  let localTargetCounter = 0;
  let localOrgDone = {};             // fileId → { folderId, folderName, status: 'done'|'fail' }
  const LOCAL_ORG_FOLDERS_KEY = 'su-local-org-folders';
  const LOCAL_ORG_MODE_KEY = 'su-work-mode';
  let localOrgDateSub = false;
  let subfolderRule = 'date'; // date | date-cn | yearmonth | custom
  let subfolderCustom = '';
  let collapsedLocalGroups = new Set();

  function saveLocalTargetFolders() {
    try { localStorage.setItem(LOCAL_ORG_FOLDERS_KEY, JSON.stringify(localTargetFolders)); } catch (e) {}
    if (window.bridge?.localFiles?.watchFolders) {
      window.bridge.localFiles.watchFolders(localTargetFolders);
    }
  }
  function loadLocalTargetFolders() {
    try {
      const raw = localStorage.getItem(LOCAL_ORG_FOLDERS_KEY);
      if (raw) {
        localTargetFolders = JSON.parse(raw);
        // Extract max numeric suffix from existing IDs to avoid ID collisions
        let maxId = 0;
        localTargetFolders.forEach(f => {
          const m = (f.id || '').match(/^lf-(\d+)/);
          if (m) maxId = Math.max(maxId, parseInt(m[1]));
        });
        localTargetCounter = maxId;
      }
    } catch (e) {}
    if (window.bridge?.localFiles?.watchFolders) {
      window.bridge.localFiles.watchFolders(localTargetFolders);
    }
  }
  function saveWorkMode() {
    try { localStorage.setItem(LOCAL_ORG_MODE_KEY, workMode); } catch (e) {}
  }
  function loadWorkMode() {
    try { const v = localStorage.getItem(LOCAL_ORG_MODE_KEY); if (v === 'local-organize') workMode = 'local-organize'; } catch (e) {}
  }

  // ── Tab management ──
  let tabs = [];               // [{ id, folderPath, folderName, localFiles, selectedIds, assignMap, uploadedMap, currentTreePath }]
  let activeTabId = null;
  let tabCounter = 0;
  const TABS_KEY = 'su-tabs';

  function saveTabs() {
    try {
      const data = tabs.map(t => ({
        id: t.id,
        name: t.name || t.folderName || '',
        folderPath: t.folderPath || '',
        folderPaths: t.folderPaths || (t.folderPath ? [t.folderPath] : []),
      }));
      localStorage.setItem(TABS_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function loadTabs() {
    try {
      const raw = localStorage.getItem(TABS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length) {
          tabs = saved.map(t => ({
            id: t.id || 'tab-' + (++tabCounter),
            name: t.name || '',
            folderPath: t.folderPath || '',
            folderPaths: t.folderPaths || (t.folderPath ? [t.folderPath] : []),
            folderName: t.name || '',
            localFiles: [],
            assignMap: {},
            selectedIds: [],
            uploadedMap: {},
            currentTreePath: '',
            currentPage: 1,
          }));
          tabCounter = tabs.length;
          activeTabId = tabs[0].id;
        }
      }
    } catch (e) {}
  }

  function createTab(folderPath, folderName) {
    const id = 'tab-' + (++tabCounter);
    const tab = {
      id,
      folderPath: folderPath || '',
      folderPaths: folderPath ? [folderPath] : [],
      folderName: folderName || '新标签',
      localFiles: [],
      selectedIds: new Set(),
      assignMap: {},
      uploadedMap: {},
      currentTreePath: '',
      currentPage: 1,
    };
    tabs.push(tab);
    return tab;
  }

  function saveCurrentTab() {
    if (!activeTabId) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.folderPath = localFolderPath;
    tab.folderPaths = [...localFolderPaths];
    tab.localFiles = localFiles;
    tab.selectedIds = new Set(selectedIds);
    tab.assignMap = { ...assignMap };
    tab.uploadedMap = { ...uploadedMap };
    tab.currentTreePath = currentTreePath;
    tab.currentPage = currentPage;
    // Per-tab filters
    tab.typeFilter = typeFilter;
    tab.searchQuery = searchQuery;
    tab.dateFilter = dateFilter;
    tab.sortOrder = sortOrder;
    tab.fileViewMode = fileViewMode;
  }

  function loadTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    activeTabId = tabId;
    localFolderPath = tab.folderPath;
    localFolderPaths = tab.folderPaths ? [...tab.folderPaths] : (tab.folderPath ? [tab.folderPath] : []);
    localFiles = tab.localFiles;
    selectedIds = new Set(tab.selectedIds);
    assignMap = { ...tab.assignMap };
    uploadedMap = { ...tab.uploadedMap };
    currentTreePath = tab.currentTreePath;
    currentPage = tab.currentPage || 1;
    // Restore per-tab filters (fallback to defaults for old tabs)
    typeFilter = tab.typeFilter || 'all';
    searchQuery = tab.searchQuery || '';
    dateFilter = tab.dateFilter || 'today';
    sortOrder = tab.sortOrder || 'date-desc';
    fileViewMode = tab.fileViewMode || 'tree';
    // Sync filter UI controls
    syncFilterUI();
  }

  function switchTab(tabId) {
    if (tabId === activeTabId) return;
    saveCurrentTab();
    loadTab(tabId);
    renderTabBar();
    renderFileGrid();
    updateActionBar();
    // Update folder path display
    updateFolderPathDisplay();
  }

  function closeTab(tabId) {
    if (tabs.length <= 1) return; // Keep at least one tab
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    tabs.splice(idx, 1);
    if (activeTabId === tabId) {
      // Switch to nearest tab
      const newIdx = Math.min(idx, tabs.length - 1);
      loadTab(tabs[newIdx].id);
    }
    saveTabs();
    renderTabBar();
    renderFileGrid();
    updateActionBar();
  }

  function renderTabBar() {
    const bar = $('su-tab-bar');
    if (!bar) return;
    bar.innerHTML = tabs.map(t => {
      const active = t.id === activeTabId ? ' active' : '';
      const name = t.name || t.folderName || '空';
      const fileCount = t.localFiles?.length || 0;
      return `<div class="su-tab${active}" data-tab="${t.id}" title="双击重命名 · ${t.folderPath || '未选择文件夹'}">
        <span class="su-tab-name">${name}</span>
        ${fileCount ? `<span class="su-tab-count">${fileCount}</span>` : ''}
        ${tabs.length > 1 ? `<span class="su-tab-close" data-close="${t.id}">✕</span>` : ''}
      </div>`;
    }).join('') + `<div class="su-tab su-tab-add" title="新建标签页">+</div>`;

    // Tab click
    bar.querySelectorAll('.su-tab[data-tab]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.su-tab-close')) return;
        switchTab(el.dataset.tab);
      });
      // Double-click to rename
      el.addEventListener('dblclick', async (e) => {
        e.preventDefault();
        const tab = tabs.find(t => t.id === el.dataset.tab);
        if (!tab) return;
        const newName = await showPrompt('标签页名称：', tab.name || tab.folderName || '');
        if (newName !== null && newName.trim()) {
          tab.name = newName.trim();
          tab.folderName = newName.trim();
          saveTabs();
          renderTabBar();
        }
      });
    });
    // Close
    bar.querySelectorAll('.su-tab-close').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(el.dataset.close);
      });
    });
    // Add tab
    bar.querySelector('.su-tab-add')?.addEventListener('click', async () => {
      const newTab = createTab('', '新标签');
      saveCurrentTab();
      loadTab(newTab.id);
      renderTabBar();
      renderFileGrid();
      updateActionBar();
      // Auto-trigger folder picker
      pickFolder();
    });
  }

  // ── DOM refs ──
  const $ = s => document.getElementById(s);

  function getSlots() {
    return (typeof state !== 'undefined' && Array.isArray(state.slots)) ? state.slots : [];
  }

  function getSlotName(slot) {
    if (typeof getSlotReadableName === 'function') return getSlotReadableName(slot);
    return slot.displayName || `${slot.mainCategory || ''}/${slot.subCategory || ''}`;
  }

  function importUploadSlotPresets(slotsToImport, replaceExisting) {
    const slots = getSlots();
    if (replaceExisting) {
      slots.splice(0, slots.length);
    }

    slotsToImport.forEach(presetSlot => {
      if (typeof addSlot === 'function') {
        addSlot(presetSlot);
        return;
      }

      slots.push({
        id: `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        subject: presetSlot.subject || '',
        pageName: presetSlot.pageName || '',
        admin: presetSlot.admin || '',
        distribution: presetSlot.distribution || '',
        taskType: presetSlot.taskType || '',
        mainCategory: presetSlot.mainCategory || '',
        subCategory: presetSlot.subCategory || '',
        folderPath: '',
        folderSources: [],
        files: [],
        referenceFiles: [],
        previewMap: new Map(),
        fileStatuses: new Map(),
        referenceFileStatuses: new Map(),
        lastFolderLink: presetSlot.lastFolderLink || '',
        mode: presetSlot.mode || 'library',
        customLink: presetSlot.customLink || '',
        customFolderId: presetSlot.customFolderId || '',
        displayName: presetSlot.displayName || '',
        customTexts: presetSlot.customTexts || {},
        eventName: presetSlot.eventName || '',
        namingPresetId: presetSlot.namingPresetId || '',
        folderNamingPresetId: presetSlot.folderNamingPresetId || '',
        skipCreateSubfolder: Boolean(presetSlot.skipCreateSubfolder),
        groupLabel: presetSlot.groupLabel || '',
        avatar: presetSlot.avatar || '',
        extraLink: presetSlot.extraLink || '',
        settingsOpen: Boolean(presetSlot.settingsOpen),
        viewMode: presetSlot.viewMode || 'upload',
        reviewEnabled: Boolean(presetSlot.reviewEnabled),
        reviewFolderLink: presetSlot.reviewFolderLink || '',
        reviewReferenceLink: presetSlot.reviewReferenceLink || '',
        referenceFolderPath: '',
        referenceFolderSources: [],
        collapsed: Boolean(presetSlot.collapsed),
        selectedFiles: new Set(),
        selectedReferenceFiles: new Set()
      });
    });
  }

  // ── File type helpers ──
  function fileCategory(mime) {
    if (!mime) return 'other';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (/pdf|document|sheet|presentation|word|excel|powerpoint|text\//.test(mime)) return 'document';
    return 'other';
  }

  function fileIcon(mime) {
    const cat = fileCategory(mime);
    return { image: '🖼️', video: '🎬', audio: '🎵', document: '📄', other: '📦' }[cat] || '📦';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ── Filtering & Sorting ──
  function filteredFiles() {
    let result = localFiles.filter(f => {
      // Type
      if (typeFilter !== 'all' && fileCategory(f.mimeType) !== typeFilter) return false;
      // Search
      if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      // Date Filter
      if (dateFilter !== 'all') {
        const fTime = f.updatedAt || (f.modifiedTime ? new Date(f.modifiedTime).getTime() : 0);
        if (!fTime) return false; // 无日期信息时排除
        const now = Date.now();
        if (dateFilter === 'today') {
          if (new Date(fTime).toDateString() !== new Date().toDateString()) return false;
        } else if (dateFilter === '1d') {
          if (now - fTime > 86400000) return false;
        } else if (dateFilter === '3d') {
          if (now - fTime > 86400000 * 3) return false;
        } else if (dateFilter === '7d') {
          if (now - fTime > 86400000 * 7) return false;
        }
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortOrder) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'date-asc': return (a.updatedAt || 0) - (b.updatedAt || 0);
        case 'date-desc': return (b.updatedAt || 0) - (a.updatedAt || 0);
        case 'size-asc': return (a.size || 0) - (b.size || 0);
        case 'size-desc': return (b.size || 0) - (a.size || 0);
        default: return 0;
      }
    });

    return result;
  }

  // ── Render file grid ──
  function renderFileCard(f) {
    const sel = selectedIds.has(f.id) ? ' selected' : '';
    const aSlot = assignMap[f.id];
    let slot, assigned, tagColor, tagName;
    if (workMode === 'local-organize') {
      const folder = aSlot ? localTargetFolders.find(lf => lf.id === aSlot) : null;
      assigned = folder ? ' assigned' : '';
      tagColor = folder ? (COLORS[localTargetFolders.indexOf(folder) % COLORS.length]) : '#ccc';
      tagName = folder ? folder.name : '';
    } else {
      slot = aSlot ? getSlots().find(s => s.id === aSlot) : null;
      assigned = slot ? ' assigned' : '';
      tagColor = slot ? (COLORS[getSlots().indexOf(slot) % COLORS.length]) : '#ccc';
      tagName = slot ? getSlotName(slot) : '';
    }
    const isImg = f.mimeType && f.mimeType.startsWith('image/');
    const isVideo = f.mimeType && f.mimeType.startsWith('video/');
    const fileSrc = 'file://' + encodeURI(f.path).replace(/#/g, '%23');
    const thumbSrc = isImg ? fileSrc : '';
    const doneInfo = workMode === 'local-organize' ? localOrgDone[f.id] : uploadedMap[f.id];
    const upClass = doneInfo ? (doneInfo.status === 'done' ? ' upload-done' : ' upload-fail') : '';
    let upLabel = '';
    if (doneInfo) {
      const actionLabel = workMode === 'local-organize' ? (doneInfo.action === 'move' ? '移动' : '复制') : '上传';
      if (doneInfo.status === 'done') {
        upLabel = `<div class="su-file-upload-status su-file-upload-done">✅ ${actionLabel}成功 → ${doneInfo.folderName || ''}</div>`;
      } else {
        upLabel = `<div class="su-file-upload-status su-file-upload-fail">❌ ${actionLabel}失败</div>`;
      }
    }
    const fDate = f.updatedAt ? new Date(f.updatedAt).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    let thumbHtml;
    if (isImg) {
      thumbHtml = `<img class="su-file-thumb su-lazy" data-src="${thumbSrc}" draggable="false" />`;
    } else if (isVideo) {
      thumbHtml = `<video class="su-file-thumb su-video-thumb su-lazy" data-src="${fileSrc}" muted preload="none" draggable="false"></video><div class="su-video-badge" data-video-src="${fileSrc}">▶</div>`;
    } else {
      thumbHtml = `<div class="su-file-icon">${fileIcon(f.mimeType)}</div>`;
    }
    const safeId = (f.id || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<div class="su-file-card${sel}${assigned}${upClass}" data-id="${safeId}">
      <div class="su-file-check">✓</div>
      <button class="su-file-delete" data-file-id="${safeId}" title="从列表中移除">✕</button>
      ${thumbHtml}
      <div class="su-file-info">
        <div class="su-file-name" title="${f.name}">${f.name}</div>
        <div class="su-file-size">${formatSize(f.size)}${fDate ? ' · ' + fDate : ''}</div>
        ${tagName ? `<div class="su-file-tag" style="display:block;background:#fef3e2;color:#e67e22;border:1px solid #f5c78440">→ ${tagName}</div>` : ''}
        ${upLabel}
      </div>
    </div>`;
  }

  function getTreeItems(files, prefix) {
    // Files & folders at the current prefix level
    const folders = new Map(); // folderName → { count, totalSize, firstImage }
    const currentFiles = [];
    files.forEach(f => {
      const rel = f.relPath || f.name;
      const isImg = f.mimeType && f.mimeType.startsWith('image/');
      if (!prefix) {
        const parts = rel.split('/');
        if (parts.length > 1) {
          const folder = parts[0];
          if (!folders.has(folder)) folders.set(folder, { count: 0, totalSize: 0, firstImage: '' });
          const info = folders.get(folder);
          info.count++;
          info.totalSize += f.size || 0;
          if (isImg && !info.firstImage && f.path) info.firstImage = 'file://' + encodeURI(f.path).replace(/#/g, '%23');
        } else {
          currentFiles.push(f);
        }
      } else {
        if (!rel.startsWith(prefix + '/')) return;
        const rest = rel.slice(prefix.length + 1);
        const parts = rest.split('/');
        if (parts.length > 1) {
          const folder = parts[0];
          if (!folders.has(folder)) folders.set(folder, { count: 0, totalSize: 0, firstImage: '' });
          const info = folders.get(folder);
          info.count++;
          info.totalSize += f.size || 0;
          if (isImg && !info.firstImage && f.path) info.firstImage = 'file://' + encodeURI(f.path).replace(/#/g, '%23');
        } else {
          currentFiles.push(f);
        }
      }
    });
    return { folders, currentFiles };
  }

  function getFileIdsUnderTreeFolder(folderPath) {
    if (!folderPath) return [];
    const prefix = folderPath + '/';
    return filteredFiles()
      .filter(f => {
        const rel = f.relPath || f.name || '';
        return rel === folderPath || rel.startsWith(prefix);
      })
      .map(f => f.id)
      .filter(Boolean);
  }

  function updateFolderCardSelectionState(root = document) {
    root.querySelectorAll('.su-folder-card[data-folder]').forEach(card => {
      const ids = getFileIdsUnderTreeFolder(card.dataset.folder);
      card.classList.toggle('selected', ids.length > 0 && ids.every(id => selectedIds.has(id)));
    });
  }

  function renderSourceFoldersBar() {
    const bar = $('su-source-folders-bar');
    if (!bar) return;
    if (localFolderPaths.length < 1) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';
    bar.innerHTML = `<span style="font-size:11px;color:#888;margin-right:4px;">📂 源文件夹:</span>` +
      localFolderPaths.map(dir => {
        const name = dir.split('/').pop() || dir.split('\\').pop() || dir;
        return `<span class="su-source-tag" title="${dir}">
          ${name}
          <span class="su-source-tag-remove" data-dir="${dir}" title="移除此文件夹">✕</span>
        </span>`;
      }).join('');
    bar.querySelectorAll('.su-source-tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeSourceFolder(btn.dataset.dir);
        renderSourceFoldersBar();
      });
    });
  }

  function renderBreadcrumb() {
    const bc = $('su-breadcrumb');
    if (!bc) return;
    if (fileViewMode !== 'tree') {
      bc.style.display = 'none';
      return;
    }
    bc.style.display = 'flex';
    const parts = currentTreePath ? currentTreePath.split('/') : [];
    let html = `<span class="su-bc-item${!currentTreePath ? ' su-bc-active' : ''}" data-path="">📁 根目录</span>`;
    let pathAcc = '';
    parts.forEach((p, i) => {
      pathAcc += (i > 0 ? '/' : '') + p;
      const isLast = i === parts.length - 1;
      html += `<span class="su-bc-sep">›</span><span class="su-bc-item${isLast ? ' su-bc-active' : ''}" data-path="${pathAcc}">${p}</span>`;
    });
    html += `<span style="flex:1"></span>`;
    if (localFolderPaths.length) {
      html += `<button class="su-btn su-btn-sm su-bc-open-folder" title="在 Finder 中打开当前文件夹">📂 打开</button>`;
      html += `<button class="su-btn su-btn-sm su-bc-new-folder" title="在当前目录新建文件夹">📁+ 新建</button>`;
    }
    bc.innerHTML = html;
    bc.querySelectorAll('.su-bc-item').forEach(item => {
      item.addEventListener('click', () => {
        currentTreePath = item.dataset.path;
        renderFileGrid();
        renderBreadcrumb();
      });
    });
    bc.querySelector('.su-bc-new-folder')?.addEventListener('click', createFolderInSource);
    bc.querySelector('.su-bc-open-folder')?.addEventListener('click', openSourceFolderInFinder);
  }

  function openSourceFolderInFinder() {
    let diskPath = '';
    if (localFolderPaths.length === 1) {
      diskPath = localFolderPaths[0];
      if (currentTreePath) diskPath += '/' + currentTreePath;
    } else if (localFolderPaths.length > 1 && currentTreePath) {
      const topFolder = currentTreePath.split('/')[0];
      const matched = localFolderPaths.find(p => {
        const name = p.split('/').pop() || p.split('\\').pop() || p;
        return name === topFolder;
      });
      if (matched) {
        const rest = currentTreePath.split('/').slice(1).join('/');
        diskPath = matched + (rest ? '/' + rest : '');
      }
    }
    if (!diskPath && localFolderPaths.length) diskPath = localFolderPaths[0];
    if (diskPath && window.bridge?.openPath) window.bridge.openPath(diskPath);
  }

  async function createFolderInSource() {
    // Determine the actual disk directory to create the folder in
    // If only one source folder, use that; if multiple, need to determine which one based on currentTreePath
    let parentDiskPath = '';
    if (localFolderPaths.length === 1) {
      parentDiskPath = localFolderPaths[0];
      if (currentTreePath) parentDiskPath += '/' + currentTreePath;
    } else if (localFolderPaths.length > 1) {
      // In multi-folder mode, the first part of currentTreePath is the folder name
      if (currentTreePath) {
        const topFolder = currentTreePath.split('/')[0];
        const matched = localFolderPaths.find(p => {
          const name = p.split('/').pop() || p.split('\\').pop() || p;
          return name === topFolder;
        });
        if (matched) {
          const rest = currentTreePath.split('/').slice(1).join('/');
          parentDiskPath = matched + (rest ? '/' + rest : '');
        }
      }
      if (!parentDiskPath) {
        // At root level with multiple sources — let user pick
        const choices = localFolderPaths.map(p => p.split('/').pop() || p).join('\n');
        alert('多个源文件夹，请先进入某个文件夹后再新建子文件夹。\n\n当前源文件夹:\n' + choices);
        return;
      }
    }
    if (!parentDiskPath) { alert('没有可用的源文件夹'); return; }

    const folderName = await showPrompt('新建文件夹名称：', '');
    if (!folderName || !folderName.trim()) return;

    const result = await window.bridge?.localFiles?.createFolder?.(parentDiskPath, folderName.trim());
    if (result?.success) {
      // Re-scan to pick up new folder and refresh view
      await refreshAllFolders();
    } else {
      alert('新建文件夹失败: ' + (result?.error || '未知错误'));
    }
  }

  function renderFileGrid() {
    const grid = $('su-file-grid');
    const empty = $('su-empty');
    if (!grid) return;
    const allFiltered = filteredFiles();

    // Get or create pagination container
    let pagBar = grid.parentElement.querySelector('.su-pagination-bar');
    if (!pagBar) {
      pagBar = document.createElement('div');
      pagBar.className = 'su-pagination-bar';
      grid.parentElement.appendChild(pagBar);
    }

    if (fileViewMode === 'tree') {
      // Tree mode: folders always shown, only paginate files
      const { folders, currentFiles } = getTreeItems(allFiltered, currentTreePath);
      const hasContent = folders.size > 0 || currentFiles.length > 0;
      empty.style.display = hasContent ? 'none' : 'flex';

      const totalFiles = currentFiles.length;
      const totalPages = Math.max(1, Math.ceil(totalFiles / pageSize));
      if (currentPage > totalPages) currentPage = totalPages;
      const startIdx = (currentPage - 1) * pageSize;
      const pagedFiles = currentFiles.slice(startIdx, startIdx + pageSize);

      let html = '';
      // Render folder cards (not paginated)
      [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, info]) => {
        const previewHtml = info.firstImage
          ? `<img class="su-folder-preview" src="${info.firstImage}" draggable="false" onerror="this.style.display='none'" />`
          : '';
        html += `<div class="su-file-card su-folder-card" data-folder="${currentTreePath ? currentTreePath + '/' + name : name}">
          <div class="su-file-check">✓</div>
          <div class="su-file-icon su-folder-icon">📁</div>
          ${previewHtml}
          <div class="su-file-info">
            <div class="su-file-name" title="${name}">${name}</div>
            <div class="su-file-size">${info.count} 个文件 · ${formatSize(info.totalSize)}</div>
          </div>
        </div>`;
      });
      // Render paginated file cards
      pagedFiles.forEach(f => { html += renderFileCard(f); });
      grid.innerHTML = html;

      // Folder click → select all files inside; double-click → navigate into folder
      grid.querySelectorAll('.su-folder-card').forEach(card => {
        let clickTimer = null;
        card.addEventListener('click', (e) => {
          if (suppressNextFileCardClick) {
            suppressNextFileCardClick = false;
            return;
          }
          // Delay inner logic to distinguish from dblclick, but update folder UI instantly
          if (clickTimer) return;

          // Immediately toggle folder's own selected state for visual feedback
          const ids = getFileIdsUnderTreeFolder(card.dataset.folder);
          if (!ids.length) return;
          const allSelected = ids.every(id => selectedIds.has(id));
          if (allSelected) {
            ids.forEach(id => selectedIds.delete(id));
            card.classList.remove('selected');
          } else {
            ids.forEach(id => selectedIds.add(id));
            card.classList.add('selected');
          }
          updateActionBar();

          // Defer file card updates (in case of dblclick cancel)
          clickTimer = setTimeout(() => {
            clickTimer = null;
            updateFileCardsInPlace();
            updateFolderCardSelectionState(grid);
          }, 250);
        });
        card.addEventListener('dblclick', () => {
          // Cancel the pending updates and revert selection
          if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
          // Revert the instant selection that single-click did
          const ids = getFileIdsUnderTreeFolder(card.dataset.folder);
          ids.forEach(id => selectedIds.delete(id));
          card.classList.remove('selected');
          currentTreePath = card.dataset.folder;
          currentPage = 1;
          renderFileGrid();
          renderBreadcrumb();
        });
      });

      renderPagination(pagBar, totalFiles, totalPages);
    } else {
      // Flat mode with pagination
      const totalFiles = allFiltered.length;
      const totalPages = Math.max(1, Math.ceil(totalFiles / pageSize));
      if (currentPage > totalPages) currentPage = totalPages;
      const startIdx = (currentPage - 1) * pageSize;
      const pagedFiles = allFiltered.slice(startIdx, startIdx + pageSize);

      empty.style.display = allFiltered.length ? 'none' : 'flex';
      grid.innerHTML = pagedFiles.map(f => renderFileCard(f)).join('');

      renderPagination(pagBar, totalFiles, totalPages);
    }

    // File click → select (preserved across pages via ID)
    grid.querySelectorAll('.su-file-card:not(.su-folder-card)').forEach(card => {
      card.addEventListener('click', (e) => {
        if (suppressNextFileCardClick) {
          suppressNextFileCardClick = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.target.closest('.su-video-badge') || e.target.closest('.su-file-delete')) return;
        const id = card.dataset.id;
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
          card.classList.remove('selected');
        } else {
          selectedIds.add(id);
          card.classList.add('selected');
        }
        updateActionBar();
      });
    });
    // Video play button
    grid.querySelectorAll('.su-video-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const src = badge.dataset.videoSrc;
        if (src) showVideoPlayer(src);
      });
    });
    // File delete button
    grid.querySelectorAll('.su-file-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fid = btn.dataset.fileId;
        localFiles = localFiles.filter(f => f.id !== fid);
        selectedIds.delete(fid);
        delete assignMap[fid];
        delete localOrgDone[fid];
        btn.closest('.su-file-card')?.remove();
        updateActionBar();
      });
    });

    // Lazy load thumbnails via IntersectionObserver
    setupLazyLoad(grid);
    updateFolderCardSelectionState(grid);

    renderBreadcrumb();
    renderSourceFoldersBar();
  }

  let _lazyObserver = null;
  function setupLazyLoad(container) {
    // Cleanup previous observer
    if (_lazyObserver) _lazyObserver.disconnect();
    _lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const src = el.dataset.src;
        if (!src) return;
        if (el.tagName === 'IMG') {
          el.src = src;
        } else if (el.tagName === 'VIDEO') {
          el.src = src;
          el.preload = 'metadata';
          el.addEventListener('loadeddata', () => { el.currentTime = 1; }, { once: true });
        }
        el.removeAttribute('data-src');
        el.classList.remove('su-lazy');
        _lazyObserver.unobserve(el);
      });
    }, { root: container.closest('.su-file-area'), rootMargin: '200px 0px', threshold: 0.01 });
    const lazyEls = container.querySelectorAll('.su-lazy[data-src]');
    lazyEls.forEach(el => _lazyObserver.observe(el));
    // Force re-check: IntersectionObserver may miss elements already in viewport on first observe
    requestAnimationFrame(() => {
      lazyEls.forEach(el => {
        if (!el.dataset.src) return; // already loaded
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 200 && rect.bottom > -200) {
          const src = el.dataset.src;
          if (el.tagName === 'IMG') { el.src = src; }
          else if (el.tagName === 'VIDEO') { el.src = src; el.preload = 'metadata'; el.addEventListener('loadeddata', () => { el.currentTime = 1; }, { once: true }); }
          el.removeAttribute('data-src');
          el.classList.remove('su-lazy');
          _lazyObserver.unobserve(el);
        }
      });
    });
  }

  /** Lightweight in-place update: patches selection, assignment tags, and upload status on existing cards without re-rendering thumbnails. */
  function updateFileCardsInPlace() {
    const grid = $('su-file-grid');
    if (!grid) return;
    grid.querySelectorAll('.su-file-card:not(.su-folder-card)').forEach(card => {
      const id = card.dataset.id;
      if (!id) return;

      // Update selected state
      card.classList.toggle('selected', selectedIds.has(id));

      // Update assigned state & tag
      const aSlot = assignMap[id];
      let tagName = '', tagColor = '';
      if (workMode === 'local-organize') {
        const folder = aSlot ? localTargetFolders.find(lf => lf.id === aSlot) : null;
        card.classList.toggle('assigned', !!folder);
        tagName = folder ? folder.name : '';
      } else {
        const slot = aSlot ? getSlots().find(s => s.id === aSlot) : null;
        card.classList.toggle('assigned', !!slot);
        tagName = slot ? getSlotName(slot) : '';
      }
      // Update or create tag element
      let tagEl = card.querySelector('.su-file-tag');
      if (tagName) {
        if (!tagEl) {
          tagEl = document.createElement('div');
          tagEl.className = 'su-file-tag';
          tagEl.style.cssText = 'display:block;background:#fef3e2;color:#e67e22;border:1px solid #f5c78440';
          card.querySelector('.su-file-info')?.appendChild(tagEl);
        }
        tagEl.textContent = '→ ' + tagName;
        tagEl.style.display = 'block';
      } else if (tagEl) {
        tagEl.style.display = 'none';
      }

      // Update upload/move status
      const doneInfo = workMode === 'local-organize' ? localOrgDone[id] : uploadedMap[id];
      card.classList.toggle('upload-done', doneInfo?.status === 'done');
      card.classList.toggle('upload-fail', doneInfo?.status === 'fail');
      let statusEl = card.querySelector('.su-file-upload-status');
      if (doneInfo) {
        const actionLabel = workMode === 'local-organize' ? (doneInfo.action === 'move' ? '移动' : '复制') : '上传';
        if (!statusEl) {
          statusEl = document.createElement('div');
          statusEl.className = 'su-file-upload-status';
          card.querySelector('.su-file-info')?.appendChild(statusEl);
        }
        if (doneInfo.status === 'done') {
          statusEl.className = 'su-file-upload-status su-file-upload-done';
          statusEl.textContent = `✅ ${actionLabel}成功 → ${doneInfo.folderName || ''}`;
        } else {
          statusEl.className = 'su-file-upload-status su-file-upload-fail';
          statusEl.textContent = `❌ ${actionLabel}失败`;
        }
      } else if (statusEl) {
        statusEl.remove();
      }
    });
    updateFolderCardSelectionState(grid);
  }

  function renderPagination(container, totalFiles, totalPages) {
    if (totalPages <= 1) {
      container.innerHTML = totalFiles > 0
        ? `<span class="su-pag-info">共 ${totalFiles} 个文件</span>`
        : '';
      return;
    }
    // Generate page buttons
    let pages = [];
    const MAX_VISIBLE = 7;
    if (totalPages <= MAX_VISIBLE) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 2);
      let end = Math.min(totalPages - 1, currentPage + 2);
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    const startFile = (currentPage - 1) * pageSize + 1;
    const endFile = Math.min(currentPage * pageSize, totalFiles);

    let html = `<span class="su-pag-info">${startFile}-${endFile} / ${totalFiles}</span>`;
    html += `<button class="su-pag-btn${currentPage <= 1 ? ' disabled' : ''}" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>‹</button>`;
    pages.forEach(p => {
      if (p === '...') {
        html += `<span class="su-pag-dots">…</span>`;
      } else {
        html += `<button class="su-pag-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
      }
    });
    html += `<button class="su-pag-btn${currentPage >= totalPages ? ' disabled' : ''}" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>›</button>`;
    html += `<span class="su-pag-jump"><input type="number" class="su-pag-jump-input" min="1" max="${totalPages}" value="${currentPage}" title="输入页码后按回车跳转" /><span class="su-pag-jump-total">/ ${totalPages}</span><button class="su-pag-jump-btn">跳转</button></span>`;
    html += `<select class="su-pag-size" title="每页显示数量">
      ${[50, 100, 200, 500].map(n => `<option value="${n}"${n === pageSize ? ' selected' : ''}>${n}/页</option>`).join('')}
    </select>`;
    container.innerHTML = html;

    // Bind events
    container.querySelectorAll('.su-pag-btn:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.page;
        if (p === 'prev') currentPage = Math.max(1, currentPage - 1);
        else if (p === 'next') currentPage = Math.min(totalPages, currentPage + 1);
        else currentPage = parseInt(p);
        renderFileGrid();
      });
    });
    // Page jump
    const jumpInput = container.querySelector('.su-pag-jump-input');
    const jumpBtn = container.querySelector('.su-pag-jump-btn');
    const doJump = () => {
      const val = parseInt(jumpInput?.value);
      if (val && val >= 1 && val <= totalPages) {
        currentPage = val;
        renderFileGrid();
      }
    };
    jumpBtn?.addEventListener('click', doJump);
    jumpInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doJump(); } });
    const sizeSelect = container.querySelector('.su-pag-size');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', () => {
        pageSize = parseInt(sizeSelect.value);
        currentPage = 1;
        renderFileGrid();
      });
    }
  }

  // ── Sync filter toolbar UI to match in-memory state (for tab switches) ──
  function syncFilterUI() {
    const searchEl = $('su-search');
    if (searchEl) searchEl.value = searchQuery;
    const dateEl = $('su-date-filter');
    if (dateEl) dateEl.value = dateFilter;
    const sortEl = $('su-sort-order');
    if (sortEl) sortEl.value = sortOrder;
    // Type chips
    document.querySelectorAll('.su-type-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.type === typeFilter);
    });
    // View mode buttons
    document.querySelectorAll('.su-view-mode').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === fileViewMode);
    });
  }

  // ── Render slot sidebar ──
  function renderSlotList() {
    if (workMode === 'local-organize') { renderLocalFolderList(); return; }
    const container = $('su-slot-list');
    if (!container) return;
    const slots = getSlots();
    const q = slotSearchQuery.toLowerCase();
    const filtered = slots.filter(s => {
      if (!q) return true;
      const name = getSlotName(s).toLowerCase();
      const group = (s.groupLabel || '').toLowerCase();
      return name.includes(q) || group.includes(q);
    });

    // Group by groupLabel
    const groups = {};
    const ungrouped = [];
    filtered.forEach(s => {
      const g = s.groupLabel || '';
      if (g) { (groups[g] = groups[g] || []).push(s); } else { ungrouped.push(s); }
    });

    let html = '';
    // Grouped
    Object.keys(groups).sort().forEach(gName => {
      const collapsed = collapsedGroups.has(gName);
      html += `<div class="su-slot-group-label${collapsed ? ' collapsed' : ''}" data-group="${gName}">
        <span class="su-group-arrow">▾</span> ${gName} (${groups[gName].length})
      </div>`;
      html += `<div class="su-slot-group-items${collapsed ? ' collapsed' : ''}">`;
      groups[gName].forEach(s => { html += slotCardHTML(s, slots); });
      html += `</div>`;
    });
    // Ungrouped
    if (ungrouped.length) {
      if (Object.keys(groups).length) {
        html += `<div class="su-slot-group-label" style="cursor:default"><span class="su-group-arrow">▾</span> 未分组 (${ungrouped.length})</div>`;
      }
      ungrouped.forEach(s => { html += slotCardHTML(s, slots); });
    }
    container.innerHTML = html;

    // Group toggle
    container.querySelectorAll('.su-slot-group-label[data-group]').forEach(el => {
      el.addEventListener('click', () => {
        const g = el.dataset.group;
        if (collapsedGroups.has(g)) collapsedGroups.delete(g); else collapsedGroups.add(g);
        renderSlotList();
      });
    });
    // Slot click → assign
    container.querySelectorAll('.su-slot-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.su-slot-extra-link')) return;
        if (e.target.closest('.su-slot-target-link')) return;
        if (e.target.closest('.su-slot-settings-btn')) return;
        assignSelectedToSlot(card.dataset.slotId);
      });
    });
    // Settings button → open per-slot editor
    container.querySelectorAll('.su-slot-settings-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSlotSettings(btn.dataset.slotId);
      });
    });
    // Avatar click → open preview modal
    container.querySelectorAll('.su-slot-avatar').forEach(img => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        const modal = $('su-avatar-preview-modal');
        const previewImg = $('su-avatar-preview-img');
        if (modal && previewImg) {
          previewImg.src = img.src;
          modal.hidden = false;
        }
      });
    });
    // Extra link → open in Chrome
    container.querySelectorAll('.su-slot-extra-link').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const url = a.dataset.url;
        if (url) window.bridge?.openExternal?.(url);
      });
    });
    // Target link → open target folder
    container.querySelectorAll('.su-slot-target-link').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const url = a.dataset.url;
        if (url) window.bridge?.openExternal?.(url);
      });
    });
  }

  // Parse =IMAGE("url") formula to extract URL
  function parseImageFormula(val) {
    if (!val) return '';
    const m = val.match(/=IMAGE\s*\(\s*"([^"]+)"\s*/i);
    if (m) return m[1];
    if (/^https?:\/\//i.test(val)) {
      const gyazoMatch = val.match(/^https?:\/\/gyazo\.com\/([a-zA-Z0-9]+)/i);
      if (gyazoMatch) return `https://i.gyazo.com/${gyazoMatch[1]}.png`;
      return val;
    }
    if (/^file:\/\//i.test(val)) return val;
    
    // Assume local path, ensure file:// scheme is properly attached
    let safePath = val.replace(/\\/g, '/');
    if (!safePath.startsWith('/')) safePath = '/' + safePath;
    return 'file://' + encodeURI(safePath).replace(/#/g, '%23');
  }

  function slotCardHTML(s, allSlots) {
    const idx = allSlots.indexOf(s);
    const color = COLORS[idx % COLORS.length];
    const count = Object.values(assignMap).filter(id => id === s.id).length;
    const name = getSlotName(s);
    const mode = s.mode === 'custom-link' ? '自定义' : '入库';
    const avatar = parseImageFormula(s.avatar || '');
    const extraLink = s.extraLink || '';
    const targetLink = s.customLink || s.lastFolderLink || '';
    return `<div class="su-slot-card" data-slot-id="${s.id}">
      <div class="su-slot-card-inner">
        ${avatar ? `<img class="su-slot-avatar" src="${avatar}" onerror="this.style.display='none'" />` : `<span class="su-slot-avatar-placeholder" style="background:${color}">${(name || '?')[0]}</span>`}
        <div class="su-slot-card-body">
          <div class="su-slot-name">${name}</div>
          <div class="su-slot-meta">${mode}${s.groupLabel ? ' · ' + s.groupLabel : ''}${s.admin ? ' · ' + s.admin : ''}</div>
          ${extraLink ? `<a class="su-slot-extra-link" href="#" data-url="${extraLink}" title="${extraLink}">🔗 账号链接</a>` : ''}
          ${targetLink ? `<a class="su-slot-target-link" href="#" data-url="${targetLink}" title="${targetLink}">📂 打开目标</a>` : ''}
        </div>
        <button class="su-slot-settings-btn" data-slot-id="${s.id}" title="设置">⚙</button>
      </div>
      ${count ? `<div class="su-slot-count">${count}</div>` : ''}
    </div>`;
  }

  // ── Per-slot settings modal ──
  function openSlotSettings(slotId) {
    const slots = getSlots();
    const s = slots.find(x => x.id === slotId);
    if (!s) return;

    let modal = $('su-slot-settings-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'su-slot-settings-modal';
      modal.className = 'su-modal-overlay';
      document.body.appendChild(modal);
    }
    modal.hidden = false;

    const isCustom = s.mode === 'custom-link';
    const name = getSlotName(s);

    modal.innerHTML = `
      <div class="su-modal su-slot-settings-dialog" style="max-width:520px;">
        <div class="su-modal-header">
          <h3>⚙ 设置 - ${name}</h3>
          <button class="su-close-btn" id="su-slot-settings-close">✕</button>
        </div>
        <div class="su-modal-body" style="max-height:70vh;overflow-y:auto;">
          <div class="su-settings-grid">
            <label>卡片名称</label>
            <input type="text" data-field="displayName" value="${s.displayName || ''}" placeholder="输入卡片名称" />

            <label>头像</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="text" data-field="avatar" value="${s.avatar || ''}" placeholder="图片URL或本地路径" style="flex:1" />
              <button class="su-btn su-ss-pick-avatar" type="button" style="white-space:nowrap">选择</button>
            </div>

            <label>分组</label>
            <input type="text" data-field="groupLabel" value="${s.groupLabel || ''}" placeholder="分组名" />

            <label>模式</label>
            <select data-field="mode" class="su-ss-mode-sel">
              <option value="library"${!isCustom ? ' selected' : ''}>入库</option>
              <option value="custom-link"${isCustom ? ' selected' : ''}>自定义</option>
            </select>

            <div class="su-ss-lib-fields" ${isCustom ? 'style="display:none"' : ''}>
              <label>分类</label>
              <select data-field="mainCategory" class="su-ss-main-cat">${getMainOptions(s.mainCategory)}</select>
              <label>子分类</label>
              <select data-field="subCategory" class="su-ss-sub-cat">${getSubOptions(s.mainCategory, s.subCategory)}</select>
              <label>主题</label>
              <input type="text" data-field="subject" value="${s.subject || ''}" placeholder="图片描述/主题" />
              <label>专页名称</label>
              <input type="text" data-field="pageName" value="${s.pageName || ''}" />
              <label>管理员</label>
              <input type="text" data-field="admin" value="${s.admin || ''}" />
              <label>分发方式</label>
              <input type="text" data-field="distribution" value="${s.distribution || ''}" />
              <label>事件名称</label>
              <input type="text" data-field="eventName" value="${s.eventName || ''}" />
            </div>

            <div class="su-ss-custom-fields" ${!isCustom ? 'style="display:none"' : ''}>
              <label>目标链接</label>
              <input type="text" data-field="customLink" value="${s.customLink || ''}" placeholder="Drive文件夹链接或ID" />
            </div>

            <label>任务类型 <span style="color:#e53935">*</span></label>
            <select data-field="taskType" class="su-ss-task-type">${getTaskTypeOptions(s.taskType || '')}</select>

            <label>命名规则</label>
            <select data-field="namingPresetId">${getNamingOptions(s.namingPresetId || '')}</select>

            <label>文件夹命名</label>
            <select data-field="folderNamingPresetId">${getNamingOptions(s.folderNamingPresetId || '')}</select>

            <label>跳过子文件夹</label>
            <input type="checkbox" data-field="skipCreateSubfolder" ${s.skipCreateSubfolder ? 'checked' : ''} />

            <label>账号链接</label>
            <input type="text" data-field="extraLink" value="${s.extraLink || ''}" placeholder="账号/专页链接" />

            <div style="grid-column:1/-1;border-top:1px solid #eee;padding-top:10px;display:grid;grid-template-columns:90px 1fr;gap:8px 12px;align-items:center;">
              <label>启用审核</label>
              <input type="checkbox" data-field="reviewEnabled" class="su-ss-review-toggle" ${s.reviewEnabled ? 'checked' : ''} />
              <label>审核目录</label>
              <input type="text" data-field="reviewFolderLink" value="${s.reviewFolderLink || ''}" placeholder="审核临时目录链接（可选）" ${!s.reviewEnabled ? 'disabled' : ''} />
            </div>
          </div>
        </div>
        <div class="su-modal-footer" style="display:flex;justify-content:space-between;gap:8px;padding:12px 16px;border-top:1px solid #eee;">
          <button class="su-btn" id="su-slot-settings-delete" style="color:#d32f2f;border-color:#d32f2f;">🗑️ 删除卡片</button>
          <div style="display:flex;gap:8px;">
            <button class="su-btn" id="su-slot-settings-cancel">取消</button>
            <button class="su-btn su-btn-primary" id="su-slot-settings-save">保存</button>
          </div>
        </div>
      </div>`;

    // Mode toggle
    const modeSel = modal.querySelector('.su-ss-mode-sel');
    modeSel?.addEventListener('change', () => {
      const isCust = modeSel.value === 'custom-link';
      const libFields = modal.querySelector('.su-ss-lib-fields');
      const custFields = modal.querySelector('.su-ss-custom-fields');
      if (libFields) libFields.style.display = isCust ? 'none' : '';
      if (custFields) custFields.style.display = isCust ? '' : 'none';
    });

    // Main → Sub cascade
    const mainSel = modal.querySelector('.su-ss-main-cat');
    mainSel?.addEventListener('change', () => {
      const subSel = modal.querySelector('.su-ss-sub-cat');
      if (subSel) subSel.innerHTML = getSubOptions(mainSel.value, '');
    });

    // Review toggle → enable/disable review folder input
    const reviewToggle = modal.querySelector('.su-ss-review-toggle');
    reviewToggle?.addEventListener('change', () => {
      const folderInput = modal.querySelector('[data-field="reviewFolderLink"]');
      if (folderInput) folderInput.disabled = !reviewToggle.checked;
    });

    // Avatar file picker (use IPC for native dialog)
    modal.querySelector('.su-ss-pick-avatar')?.addEventListener('click', async () => {
      const imgPath = await window.bridge?.localFiles?.pickImage?.();
      if (imgPath) modal.querySelector('[data-field="avatar"]').value = imgPath;
    });

    // Close / Cancel
    const closeModal = () => { modal.hidden = true; };
    modal.querySelector('#su-slot-settings-close')?.addEventListener('click', closeModal);
    modal.querySelector('#su-slot-settings-cancel')?.addEventListener('click', closeModal);

    // Delete
    modal.querySelector('#su-slot-settings-delete')?.addEventListener('click', () => {
      if (confirm('确定要删除此卡片吗？该操作不可恢复。')) {
        if (typeof removeSlot === 'function') {
          removeSlot(s.id);
        } else {
          const slots = getSlots();
          const idx = slots.findIndex(x => x.id === s.id);
          if (idx !== -1) slots.splice(idx, 1);
        }
        if (typeof persistSlotPresets === 'function') persistSlotPresets();
        if (typeof renderSlots === 'function') renderSlots();
        renderSlotList();
        closeModal();
      }
    });

    // Save
    modal.querySelector('#su-slot-settings-save')?.addEventListener('click', () => {
      modal.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        if (field === 'skipCreateSubfolder' || field === 'reviewEnabled') {
          s[field] = el.checked;
          return;
        }
        const val = el.value;
        if (field === 'mode') { s.mode = val; }
        else { s[field] = val; }
        if (field === 'customLink' && val) {
          s.customFolderId = (typeof extractDriveFolderId === 'function') ? extractDriveFolderId(val) : val;
        }
      });
      if (typeof persistSlotPresets === 'function') persistSlotPresets();
      if (typeof renderSlots === 'function') renderSlots();
      renderSlotList();
      closeModal();
    });
  }

  // ── Assign files to slot ──
  function assignSelectedToSlot(slotId) {
    if (!selectedIds.size) return;
    selectedIds.forEach(id => { assignMap[id] = slotId; });
    // Track recent
    recentSlotIds = recentSlotIds.filter(r => r !== slotId);
    recentSlotIds.unshift(slotId);
    if (recentSlotIds.length > 5) recentSlotIds.length = 5;
    selectedIds.clear();
    updateFileCardsInPlace();
    renderSlotList();
    renderRecentSlots();
    updateActionBar();
  }

  // ── Recent slots bar ──
  function renderRecentSlots() {
    const container = $('su-recent-slots');
    if (!container) return;
    if (workMode === 'local-organize') {
      container.innerHTML = recentSlotIds.map((rid, i) => {
        const f = localTargetFolders.find(x => x.id === rid);
        if (!f) return '';
        const color = COLORS[localTargetFolders.indexOf(f) % COLORS.length];
        return `<button class="su-recent-slot-btn" data-slot-id="${rid}" style="border-color:${color};color:${color};background:${color}10" title="最近使用">${f.name}</button>`;
      }).join('');
    } else {
      const slots = getSlots();
      container.innerHTML = recentSlotIds.map((rid, i) => {
        const s = slots.find(x => x.id === rid);
        if (!s) return '';
        const color = COLORS[slots.indexOf(s) % COLORS.length];
        return `<button class="su-recent-slot-btn" data-slot-id="${rid}" style="border-color:${color};color:${color};background:${color}10" title="最近使用">${getSlotName(s)}</button>`;
      }).join('');
    }
    container.querySelectorAll('.su-recent-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => assignSelectedToSlot(btn.dataset.slotId));
    });
  }

  // ── Action bar ──
  function updateActionBar() {
    const total = localFiles.length;
    const assigned = Object.keys(assignMap).length;
    const selInfo = $('su-sel-info');
    const assInfo = $('su-assign-info');
    const unInfo = $('su-unassign-info');
    const uploadBtn = $('su-start-upload');
    const copyBtn = $('su-local-copy');
    const moveBtn = $('su-local-move');
    if (selInfo) selInfo.textContent = `已选 ${selectedIds.size} 个`;
    if (assInfo) assInfo.textContent = `已分配 ${assigned}`;
    if (unInfo) unInfo.textContent = `未分配 ${total - assigned}`;
    const folderUpBtn = $('su-folder-upload');
    if (workMode === 'local-organize') {
      if (uploadBtn) uploadBtn.style.display = 'none';
      if (folderUpBtn) folderUpBtn.style.display = 'none';
      if (copyBtn) { copyBtn.style.display = ''; copyBtn.textContent = `📋 复制到目标 (${assigned})`; copyBtn.disabled = assigned === 0; }
      if (moveBtn) { moveBtn.style.display = ''; moveBtn.textContent = `📦 移动到目标 (${assigned})`; moveBtn.disabled = assigned === 0; }
    } else {
      if (uploadBtn) { uploadBtn.style.display = ''; uploadBtn.textContent = `⬆️ 开始上传 (${assigned})`; uploadBtn.disabled = assigned === 0; }
      if (folderUpBtn) folderUpBtn.style.display = '';
      if (copyBtn) copyBtn.style.display = 'none';
      if (moveBtn) moveBtn.style.display = 'none';
    }
  }

  // ── Pick folder & scan (multi-folder) ──
  async function pickFolder() {
    const dirs = await window.bridge?.localFiles?.pickFolder?.({ multi: true, title: '选择源文件夹（可多选）' });
    if (!dirs) return;
    const dirList = Array.isArray(dirs) ? dirs : [dirs];
    for (const dir of dirList) {
      if (localFolderPaths.includes(dir)) continue;
      localFolderPaths.push(dir);
      localFolderPath = dir;
      $('su-refresh-folder').disabled = false;
      await scanAndMergeFolder(dir, false);
    }
  }

  async function scanAndMergeFolder(dir, isRefresh) {
    $('su-folder-path').textContent = dir + ' (扫描中...)';
    const files = await window.bridge?.localFiles?.scanFolder?.(dir);
    const newFiles = Array.isArray(files) ? files : [];
    if (isRefresh) {
      // Remove old files from this folder, then add fresh scan
      localFiles = localFiles.filter(f => !f.path.startsWith(dir));
    }
    // Merge: add only files not already present
    newFiles.forEach(f => {
      if (!localFiles.some(lf => lf.id === f.id)) localFiles.push(f);
    });
    currentTreePath = '';
    currentPage = 1;
    updateFolderPathDisplay();
    // Update active tab
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      tab.folderPath = localFolderPath;
      tab.folderPaths = [...localFolderPaths];
      tab.folderName = localFolderPaths.length > 1
        ? `${localFolderPaths.length}个文件夹`
        : (localFolderPath.split('/').pop() || localFolderPath.split('\\').pop() || localFolderPath);
      tab.localFiles = localFiles;
      tab.currentTreePath = '';
      tab.currentPage = 1;
    }
    saveTabs();
    renderTabBar();
    renderFileGrid();
    updateActionBar();
  }

  async function refreshAllFolders() {
    if (!localFolderPaths.length) return;
    localFiles = [];
    for (const dir of localFolderPaths) {
      $('su-folder-path').textContent = `刷新中: ${dir}...`;
      const files = await window.bridge?.localFiles?.scanFolder?.(dir);
      if (Array.isArray(files)) {
        files.forEach(f => {
          if (!localFiles.some(lf => lf.id === f.id)) localFiles.push(f);
        });
      }
    }
    currentTreePath = '';
    currentPage = 1;
    updateFolderPathDisplay();
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) { tab.localFiles = localFiles; tab.currentTreePath = ''; tab.currentPage = 1; }
    renderTabBar();
    renderFileGrid();
    updateActionBar();
  }

  function removeSourceFolder(dir) {
    localFolderPaths = localFolderPaths.filter(p => p !== dir);
    localFiles = localFiles.filter(f => !f.path.startsWith(dir));
    // Clean selections and assignments for removed files
    const removedIds = new Set();
    localFiles.forEach(f => removedIds.add(f.id));
    selectedIds = new Set([...selectedIds].filter(id => localFiles.some(f => f.id === id)));
    Object.keys(assignMap).forEach(k => { if (!localFiles.some(f => f.id === k)) delete assignMap[k]; });
    localFolderPath = localFolderPaths[localFolderPaths.length - 1] || '';
    currentPage = 1;
    updateFolderPathDisplay();
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      tab.folderPath = localFolderPath;
      tab.folderPaths = [...localFolderPaths];
      tab.localFiles = localFiles;
      tab.folderName = localFolderPaths.length > 1
        ? `${localFolderPaths.length}个文件夹`
        : (localFolderPath.split('/').pop() || '新标签');
    }
    saveTabs();
    renderTabBar();
    renderFileGrid();
    updateActionBar();
  }

  function updateFolderPathDisplay() {
    const el = $('su-folder-path');
    if (!el) return;
    if (!localFolderPaths.length) {
      el.textContent = '未选择';
      el.title = '';
      return;
    }
    const total = localFiles.length;
    if (localFolderPaths.length === 1) {
      el.textContent = `${localFolderPaths[0]} (${total} 个文件)`;
      el.title = localFolderPaths[0];
    } else {
      el.textContent = `${localFolderPaths.length} 个文件夹 (共 ${total} 个文件)`;
      el.title = localFolderPaths.join('\n');
    }
  }

  // For backwards compat — old single-scan
  // ── 预设导入导出 ──
  async function exportPresetHandler() {
    saveCurrentTab();
    const slots = getSlots();
    
    if (!localTargetFolders.length && !tabs.length && (!slots || !slots.length)) {
      alert('没有可导出的数据');
      return;
    }

    const preset = {
      version: 3,
      type: 'unified-preset',
      exportDate: new Date().toISOString(),
      targetFolders: localTargetFolders.map(f => ({ name: f.name, path: f.path, group: f.group || '', avatar: f.avatar || '', avatarPos: f.avatarPos || null, subfolderRule: f.subfolderRule || '', subfolderCustom: f.subfolderCustom || '' })),
      tabs: tabs.map(t => ({
        name: t.name || t.folderName || '',
        folderPaths: t.folderPaths || (t.folderPath ? [t.folderPath] : []),
      })),
      slots: slots
    };
    
    const jsonStr = JSON.stringify(preset, null, 2);
    const result = await window.bridge?.localFiles?.exportPreset?.(jsonStr);
    
    if (result?.success) {
      alert(`✅ 统一预设已导出\n${result.filePath}\n本地目标文件夹: ${preset.targetFolders.length} 个\n上传卡片: ${(preset.slots || []).length} 个`);
    } else if (!result?.canceled) {
      alert('导出失败: ' + (result?.error || '未知错误'));
    }
  }

  async function importPresetHandler() {
    const result = await window.bridge?.localFiles?.importPreset?.();
    if (!result?.success) { if (!result?.canceled) alert('导入失败: ' + (result?.error || '未知错误')); return; }
    try {
      const preset = JSON.parse(result.content);
      
      const folders = preset.targetFolders || preset.folders || (preset.type === 'local-organize' ? preset : []);
      const presetTabs = preset.tabs || [];
      const slotsToImport = preset.slots || (preset.type === 'upload-cards' ? preset : (Array.isArray(preset) && preset[0]?.id && preset[0]?.mode ? preset : []));

      if ((!Array.isArray(folders) || !folders.length) && (!Array.isArray(slotsToImport) || !slotsToImport.length)) {
         alert('预设文件格式不正确或为空');
         return;
      }

      const info = [];
      if (Array.isArray(folders) && folders.length) info.push(`本地目标文件夹: ${folders.length} 个`);
      if (presetTabs.length) info.push(`本地标签页: ${presetTabs.length} 个`);
      if (Array.isArray(slotsToImport) && slotsToImport.length) info.push(`上传卡片: ${slotsToImport.length} 个`);

      const action = confirm(
        `即将导入预设数据:\n${info.join('\n')}\n来源: ${result.filePath.split('/').pop()}\n\n` +
        `点击「确定」= 替换当前所有配置\n` +
        `点击「取消」= 追加到现有列表`
      );

      // Handle local-organize part
      if (Array.isArray(folders) && folders.length > 0) {
        if (action) {
          localTargetCounter = 0; // Reset counter for clean replace
          localTargetFolders = folders.map((f, i) => ({
            id: 'lf-' + (++localTargetCounter) + '-' + Date.now(),
            name: f.name || f.path?.split('/').pop() || `文件夹${i + 1}`,
            path: f.path || '',
            group: f.group || '',
            avatar: f.avatar || '',
            avatarPos: f.avatarPos || null,
            subfolderRule: f.subfolderRule || '',
            subfolderCustom: f.subfolderCustom || '',
          }));
        } else {
          folders.forEach(f => {
            if (f.path && localTargetFolders.some(lf => lf.path === f.path)) return;
            localTargetFolders.push({
              id: 'lf-' + (++localTargetCounter) + '-' + Date.now(),
              name: f.name || f.path?.split('/').pop() || '未命名',
              path: f.path || '',
              group: f.group || '',
              avatar: f.avatar || '',
              avatarPos: f.avatarPos || null,
              subfolderRule: f.subfolderRule || '',
              subfolderCustom: f.subfolderCustom || '',
            });
          });
        }
        saveLocalTargetFolders();
        if (workMode === 'local-organize') renderSlotList();

        // Import tabs (source folders)
        if (presetTabs.length && action) {
          tabs.length = 0;
          presetTabs.forEach((pt, i) => {
            tabs.push({
              id: 'tab-' + Date.now() + '-' + i,
              name: pt.name || `标签${i + 1}`,
              folderName: pt.name || `标签${i + 1}`,
              folderPaths: pt.folderPaths || [],
              folderPath: (pt.folderPaths || [])[0] || '',
              localFiles: [],
              assignMap: {},
              selectedIds: [],
              uploadedMap: {},
              currentTreePath: '',
              currentPage: 1,
            });
          });
          if (tabs.length) {
            activeTabId = tabs[0].id;
            loadTab(tabs[0].id);
            // Auto-scan restored source folders
            for (const dir of localFolderPaths) {
              await scanAndMergeFolder(dir, false);
            }
          }
          saveTabs();
          if (workMode === 'local-organize') renderTabBar();
        }
      }

      // Handle upload slots part
      if (Array.isArray(slotsToImport) && slotsToImport.length > 0) {
        importUploadSlotPresets(slotsToImport, action);
        if (typeof persistSlotPresets === 'function') persistSlotPresets();
        if (workMode !== 'local-organize') {
          if (typeof renderSlots === 'function') renderSlots();
          renderSlotList();
        }
      }

      alert(`✅ 导入成功\n${info.join('\n')}`);

    } catch (e) {
      alert('预设文件解析失败: ' + e.message);
    }
  }

  // ── 合并多个预设 ──
  async function mergePresetsHandler() {
    const result = await window.bridge?.localFiles?.importPresetsMulti?.();
    if (!result?.success) { if (!result?.canceled) alert('选择文件失败: ' + (result?.error || '未知错误')); return; }
    const fileResults = result.files || [];
    if (!fileResults.length) return;

    let totalLocalFolders = 0;
    let totalUploadSlots = 0;
    let skippedDuplicates = 0;
    let errorFiles = [];

    for (const fr of fileResults) {
      if (fr.error || !fr.content) {
        errorFiles.push(fr.filePath?.split('/').pop() || '未知文件');
        continue;
      }
      let preset;
      try {
        preset = JSON.parse(fr.content);
      } catch (e) {
        errorFiles.push((fr.filePath?.split('/').pop() || '未知文件') + ' (JSON解析失败)');
        continue;
      }

      const folders = preset.targetFolders || preset.folders || (preset.type === 'local-organize' ? preset : []);
      if (Array.isArray(folders) && folders.length > 0) {
        folders.forEach(f => {
          // 去重：如果已存在相同路径则跳过
          if (f.path && localTargetFolders.some(lf => lf.path === f.path)) {
            skippedDuplicates++;
            return;
          }
          // 去重：如果没有路径，按名称去重
          if (!f.path && f.name && localTargetFolders.some(lf => lf.name === f.name && !lf.path)) {
            skippedDuplicates++;
            return;
          }
          localTargetFolders.push({
            id: 'lf-' + (++localTargetCounter) + '-' + Date.now(),
            name: f.name || f.path?.split('/').pop() || '未命名',
            path: f.path || '',
            group: f.group || '',
            avatar: f.avatar || '',
            avatarPos: f.avatarPos || null,
            subfolderRule: f.subfolderRule || '',
            subfolderCustom: f.subfolderCustom || '',
          });
          totalLocalFolders++;
        });
      }

      const slotsToMerge = preset.slots || (preset.type === 'upload-cards' ? preset : (Array.isArray(preset) && preset[0]?.id && preset[0]?.mode ? preset : []));
      if (Array.isArray(slotsToMerge) && slotsToMerge.length > 0) {
        importUploadSlotPresets(slotsToMerge, false);
        totalUploadSlots += slotsToMerge.length;
      }
    }

    // 保存并刷新
    saveLocalTargetFolders();
    if (typeof persistSlotPresets === 'function') persistSlotPresets();
    
    if (workMode === 'local-organize') {
      renderSlotList();
    } else {
      if (typeof renderSlots === 'function') renderSlots();
      renderSlotList();
    }

    // 汇报结果
    const lines = [`📊 合并完成 (${fileResults.length} 个文件)`];
    if (totalLocalFolders > 0) lines.push(`✅ 新增目标文件夹: ${totalLocalFolders} 个`);
    if (totalUploadSlots > 0) lines.push(`✅ 新增上传卡片: ${totalUploadSlots} 个`);
    if (skippedDuplicates) lines.push(`⏭ 跳过重复文件夹: ${skippedDuplicates} 个`);
    if (errorFiles.length) lines.push(`⚠️ 跳过/失败:\n  ${errorFiles.join('\n  ')}`);
    lines.push(`\n当前总计:\n- ${localTargetFolders.length} 个目标文件夹\n- ${getSlots().length} 个上传卡片`);
    alert(lines.join('\n'));
  }

  // For backwards compat — old single-scan
  async function scanFolder(dir) {
    localFolderPaths = [dir];
    localFolderPath = dir;
    localFiles = [];
    selectedIds.clear();
    assignMap = {};
    currentTreePath = '';
    currentPage = 1;
    await scanAndMergeFolder(dir, false);
  }

  function buildSortUploadFile(file, slotId) {
    const id = file.id || file.path;
    return {
      ...file,
      id,
      slotId,
      path: file.path,
      name: file.name || (file.path ? file.path.split('/').pop() : ''),
      size: file.size || 0,
      mimeType: file.mimeType || guessMimeType(file.name || file.path || ''),
      relativePath: file.relativePath || file.relPath || '',
      relPath: file.relPath || file.relativePath || '',
      isLocal: file.isLocal !== false
    };
  }

  function cloneMap(value) {
    return value instanceof Map ? new Map(value) : new Map();
  }

  function getSortUploadResult(slot, file, uploadResults = null) {
    if (Array.isArray(uploadResults)) {
      const result = uploadResults.find(item => item?.fileId === file.id);
      if (result?.status === 'success' || result?.status === 'skipped') {
        return { status: 'done', message: result.message || '上传完成' };
      }
      if (result?.status === 'error') {
        return { status: 'fail', message: result.message || '上传失败' };
      }
    }
    const statusInfo = slot.fileStatuses instanceof Map ? slot.fileStatuses.get(file.id) : null;
    if (statusInfo?.status === 'success' || statusInfo?.status === 'skipped') {
      return { status: 'done', message: statusInfo.message || '上传完成' };
    }
    if (statusInfo?.status === 'error') {
      return { status: 'fail', message: statusInfo.message || '上传失败' };
    }
    return { status: 'fail', message: statusInfo?.message || '上传未完成，请查看上传日志' };
  }

  // ── Start upload (uses existing engine) ──
  async function startSortUpload() {
    const assigned = Object.entries(assignMap);
    if (!assigned.length) return;
    if (typeof state !== 'undefined' && state.uploadState && state.uploadState !== 'idle') {
      alert('当前已有上传任务在进行中，请等待完成或停止后再开始分拣上传。');
      return;
    }
    if (typeof handleUpload !== 'function') {
      alert('上传模块尚未初始化，无法开始上传。');
      return;
    }

    // Group by slotId
    const groups = {};
    assigned.forEach(([fileId, slotId]) => {
      (groups[slotId] = groups[slotId] || []).push(fileId);
    });

    const slots = getSlots();
    const totalFiles = assigned.length;
    let doneCount = 0;

    // Show progress
    const progressBar = $('su-progress-bar');
    const progressFill = $('su-progress-fill');
    const progressText = $('su-progress-text');
    if (progressBar) progressBar.hidden = false;
    if (progressText) progressText.hidden = false;

    for (const [slotId, fileIds] of Object.entries(groups)) {
      const slot = slots.find(s => s.id === slotId);
      if (!slot) continue;
      const slotName = getSlotName(slot);

      const sourceFiles = fileIds.map(id => localFiles.find(f => f.id === id)).filter(Boolean);
      const tempFiles = sourceFiles.map(f => buildSortUploadFile(f, slotId));
      const tempIds = new Set(tempFiles.map(f => f.id));
      const originalFiles = Array.isArray(slot.files) ? [...slot.files] : [];
      const originalFileStatuses = cloneMap(slot.fileStatuses);
      const originalSelectedFiles = slot.selectedFiles instanceof Set ? new Set(slot.selectedFiles) : new Set();
      const originalSkip = slot.skipCreateSubfolder;

      try {
        slot.files = tempFiles;
        slot.fileStatuses = new Map();
        slot.selectedFiles = new Set(tempFiles.map(f => f.id));
        if (!cloudSubfolderEnabled) {
          slot.skipCreateSubfolder = true;
        }

        const uploadResults = await handleUpload(slotId);

        tempFiles.forEach(file => {
          const result = getSortUploadResult(slot, file, uploadResults);
          uploadedMap[file.id] = { slotId, slotName, status: result.status, message: result.message };
          doneCount++;
          if (progressFill) progressFill.style.width = (doneCount / totalFiles * 100) + '%';
          if (progressText) progressText.textContent = `上传中... ${doneCount}/${totalFiles} - ${slotName}`;
        });

        fileIds.filter(id => !tempIds.has(id)).forEach(id => {
          uploadedMap[id] = { slotId, slotName, status: 'fail', message: '文件不存在或已被移除' };
          doneCount++;
          if (progressFill) progressFill.style.width = (doneCount / totalFiles * 100) + '%';
        });

      } catch (err) {
        fileIds.forEach(id => {
          uploadedMap[id] = { slotId, slotName, status: 'fail', message: err.message || '上传失败' };
          doneCount++;
          if (progressFill) progressFill.style.width = (doneCount / totalFiles * 100) + '%';
        });
        console.error('Upload failed for slot', slotName, err);
      } finally {
        slot.files = originalFiles;
        slot.fileStatuses = originalFileStatuses;
        slot.selectedFiles = originalSelectedFiles;
        slot.skipCreateSubfolder = originalSkip;
        updateFileCardsInPlace();
      }
    }

    if (progressText) progressText.textContent = `上传完成 ✅ 成功 ${Object.values(uploadedMap).filter(u=>u.status==='done').length} / 失败 ${Object.values(uploadedMap).filter(u=>u.status==='fail').length}`;
    updateFileCardsInPlace();
    updateActionBar();
  }

  // ── Folder Upload to Drive ──
  async function folderUploadToDrive() {
    // 1. Pick folder
    const folderPath = await window.bridge?.localFiles?.pickFolder?.();
    if (!folderPath) return;

    // 2. Scan files
    const scanResult = await window.bridge?.localFiles?.scanFolder?.(folderPath);
    const allFiles = scanResult?.files || scanResult || [];
    if (!allFiles.length) { alert('选择的文件夹中没有文件'); return; }

    // 3. Show target selection modal
    const slots = getSlots();
    const slotsWithDriveTarget = slots.filter(s => s.customFolderId || s.customLink);
    if (!slotsWithDriveTarget.length) {
      alert('没有配置 Drive 目标链接的上传卡片。\n请先在卡片设置中配置「目标链接」。');
      return;
    }

    // Build selection UI
    const overlay = document.createElement('div');
    overlay.className = 'su-modal-overlay';
    overlay.innerHTML = `
      <div class="su-modal" style="max-width:520px;">
        <div class="su-modal-header">
          <h3>📂 文件夹上传到 Drive</h3>
          <button class="su-btn su-btn-sm su-folder-upload-close">✕</button>
        </div>
        <div class="su-modal-body" style="max-height:60vh;overflow-y:auto;">
          <p style="margin:0 0 8px;font-size:13px;color:#555;">
            📁 <strong>${folderPath.split('/').pop()}</strong> — 共 ${allFiles.length} 个文件
          </p>
          <p style="margin:0 0 12px;font-size:12px;color:#888;">选择上传目标 (Drive 文件夹)：</p>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${slotsWithDriveTarget.map((s, i) => {
              const name = getSlotName(s);
              const link = s.customLink || '';
              return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e0e0e0;border-radius:8px;cursor:pointer;font-size:13px;transition:background .15s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='#fff'">
                <input type="radio" name="su-folder-upload-target" value="${i}" ${i === 0 ? 'checked' : ''} />
                <span style="font-weight:600;">${name}</span>
                <span style="color:#999;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${link}</span>
              </label>`;
            }).join('')}
          </div>
        </div>
        <div class="su-modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #eee;">
          <button class="su-btn su-folder-upload-cancel">取消</button>
          <button class="su-btn su-btn-primary su-folder-upload-confirm">⬆️ 开始上传 (${allFiles.length} 个文件)</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.su-folder-upload-close')?.addEventListener('click', close);
    overlay.querySelector('.su-folder-upload-cancel')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('.su-folder-upload-confirm')?.addEventListener('click', async () => {
      const selectedIdx = parseInt(overlay.querySelector('input[name="su-folder-upload-target"]:checked')?.value || '0');
      const targetSlot = slotsWithDriveTarget[selectedIdx];
      if (!targetSlot) { alert('请选择目标'); return; }

      const folderId = targetSlot.customFolderId || (typeof extractDriveFolderId === 'function' ? extractDriveFolderId(targetSlot.customLink) : targetSlot.customLink);
      if (!folderId) { alert('目标卡片没有有效的 Drive 文件夹 ID'); return; }

      close();

      // Show progress
      const progressBar = $('su-progress-bar');
      const progressFill = $('su-progress-fill');
      const progressText = $('su-progress-text');
      if (progressBar) progressBar.hidden = false;
      if (progressText) progressText.hidden = false;
      if (progressText) progressText.textContent = `准备上传 ${allFiles.length} 个文件到 ${getSlotName(targetSlot)}...`;
      if (progressFill) progressFill.style.width = '0%';

      // Listen for progress events
      const progressHandler = (_e, data) => {
        if (data?.status === 'uploading') {
          const pct = (data.current / data.total * 100).toFixed(0);
          if (progressFill) progressFill.style.width = pct + '%';
          if (progressText) progressText.textContent = `上传中 ${data.current}/${data.total} — ${data.fileName}`;
        }
      };
      window.bridge?.on?.('upload-organizer:progress', progressHandler);

      try {
        // Build file payloads
        const filesToUpload = allFiles.map(f => ({
          path: f.path || f,
          name: f.name || (typeof f === 'string' ? f.split('/').pop() : ''),
          mimeType: guessMimeType(f.name || f.path || f)
        }));

        const result = await window.bridge?.uploadToDrive?.({ files: filesToUpload, folderId });
        window.bridge?.removeListener?.('upload-organizer:progress', progressHandler);

        if (result?.success) {
          const successCount = result.results?.filter(r => r.success).length || 0;
          const failCount = result.results?.filter(r => !r.success).length || 0;
          if (progressText) progressText.textContent = `✅ 文件夹上传完成 — 成功 ${successCount} / 失败 ${failCount}`;
          if (progressFill) progressFill.style.width = '100%';

          if (failCount > 0) {
            const failedNames = result.results.filter(r => !r.success).map(r => `${r.name}: ${r.error}`).join('\n');
            alert(`上传完成\n成功: ${successCount}\n失败: ${failCount}\n\n失败文件:\n${failedNames}`);
          }
        } else {
          if (progressText) progressText.textContent = `❌ 上传失败: ${result?.error || '未知错误'}`;
          alert('上传失败: ' + (result?.error || '未知错误'));
        }
      } catch (err) {
        window.bridge?.removeListener?.('upload-organizer:progress', progressHandler);
        if (progressText) progressText.textContent = `❌ 上传出错: ${err.message}`;
        alert('上传出错: ' + err.message);
      }
    });
  }

  function guessMimeType(fileName) {
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    const mimeMap = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm',
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
      pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      psd: 'image/vnd.adobe.photoshop', ai: 'application/postscript',
      zip: 'application/zip', rar: 'application/x-rar-compressed',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  // ── Local Organize Mode ──

  function switchWorkMode(mode) {
    if (mode === workMode) return;
    workMode = mode;
    saveWorkMode();
    // Reset assign map when switching modes
    assignMap = {};
    localOrgDone = {};
    uploadedMap = {};
    selectedIds.clear();
    updateModeUI();
    renderSlotList();
    renderFileGrid();
    updateActionBar();
    renderRecentSlots();
  }

  function updateModeUI() {
    const panel = $('sort-upload-panel');
    if (!panel) return;
    panel.classList.toggle('su-mode-local', workMode === 'local-organize');
    panel.classList.toggle('su-mode-upload', workMode !== 'local-organize');
    // Mode switch buttons
    panel.querySelectorAll('.su-mode-switch-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === workMode);
    });
    // Sidebar header
    const headerLabel = panel.querySelector('.su-slot-header > span');
    if (headerLabel) headerLabel.textContent = workMode === 'local-organize' ? '📁 目标文件夹' : '📤 上传卡片';
    // Show/hide upload-specific buttons
    const batchBtn = $('su-batch-edit-btn');
    const sheetsBtn = $('su-import-sheets-btn');
    if (batchBtn) batchBtn.style.display = workMode === 'local-organize' ? 'none' : '';
    if (sheetsBtn) sheetsBtn.style.display = workMode === 'local-organize' ? 'none' : '';
    // Show/hide add-folder button
    const addFolderBtn = $('su-add-local-folder');
    if (addFolderBtn) addFolderBtn.style.display = workMode === 'local-organize' ? '' : 'none';
    // Show/hide preset buttons
    const exportBtn = $('su-export-preset');
    const importBtn = $('su-import-preset');
    const mergeBtn = $('su-merge-preset');
    if (exportBtn) exportBtn.style.display = '';
    if (importBtn) importBtn.style.display = '';
    if (mergeBtn) mergeBtn.style.display = '';
    // Org bar
    const orgBar = panel.querySelector('.su-org-bar');
    if (orgBar) orgBar.style.display = workMode === 'local-organize' ? 'none' : '';
    // Local org bar
    const localOrgBar = $('su-local-org-bar');
    if (localOrgBar) localOrgBar.style.display = workMode === 'local-organize' ? '' : 'none';
  }

  async function addLocalFolder(group) {
    const dirs = await window.bridge?.localFiles?.pickFolder?.({ multi: true, title: '选择目标文件夹（可多选）' });
    if (!dirs) return;
    const dirList = Array.isArray(dirs) ? dirs : [dirs];
    let added = 0;
    for (const dir of dirList) {
      const name = dir.split('/').pop() || dir.split('\\').pop() || dir;
      if (localTargetFolders.some(f => f.path === dir)) continue;
      localTargetFolders.push({ id: 'lf-' + (++localTargetCounter) + '-' + Date.now(), name, path: dir, group: group || '' });
      added++;
    }
    if (added) {
      saveLocalTargetFolders();
      renderSlotList();
    }
  }

  function removeLocalFolder(folderId) {
    localTargetFolders = localTargetFolders.filter(f => f.id !== folderId);
    Object.keys(assignMap).forEach(k => { if (assignMap[k] === folderId) delete assignMap[k]; });
    saveLocalTargetFolders();
    renderSlotList();
    renderFileGrid();
    updateActionBar();
  }

  function setLocalFolderGroup(folderId, newGroup) {
    const folder = localTargetFolders.find(f => f.id === folderId);
    if (folder) { folder.group = newGroup || ''; saveLocalTargetFolders(); renderSlotList(); }
  }

  async function editLocalFolderName(folderId) {
    const folder = localTargetFolders.find(f => f.id === folderId);
    if (!folder) return;
    const newName = await showPrompt('文件夹显示名称：', folder.name);
    if (newName && newName.trim()) { folder.name = newName.trim(); saveLocalTargetFolders(); renderSlotList(); }
  }

  function renderLocalFolderCard(f) {
    const idx = localTargetFolders.indexOf(f);
    const color = COLORS[idx % COLORS.length];
    const count = Object.values(assignMap).filter(id => id === f.id).length;
    const subLabel = f.subfolderRule === 'date' ? '日期' : f.subfolderRule === 'date-cn' ? '中文' : f.subfolderRule === 'yearmonth' ? '年月' : f.subfolderRule === 'custom' ? (f.subfolderCustom || '自定义') : '';
    const subBadge = f.subfolderRule ? `<span style="font-size:9px;background:#e8f0fe;color:#1a73e8;padding:1px 4px;border-radius:3px;">${subLabel}</span>` : '';
    const parts = f.path.replace(/\\/g, '/').split('/').filter(Boolean);
    const shortPath = parts.length > 1 ? '.../' + parts[parts.length - 1] : f.path;
    const avatarSrc = f.avatar ? (f.avatar.startsWith('http') || f.avatar.startsWith('file://') ? f.avatar : 'file://' + encodeURI(f.avatar).replace(/#/g, '%23')) : '';
    const avatarObjPos = f.avatarPos ? `object-position:${f.avatarPos.x}% ${f.avatarPos.y}%` : '';
    const avatarHtml = avatarSrc
      ? `<img class="su-local-folder-avatar" src="${avatarSrc}" style="${avatarObjPos}" onerror="this.style.display='none';this.nextElementSibling.style.display=''" data-folder-id="${f.id}" title="点击更换头像" /><span class="su-local-folder-avatar-placeholder" style="background:${color};display:none" data-folder-id="${f.id}" title="点击设置头像">${(f.name || '?')[0]}</span>`
      : `<span class="su-local-folder-avatar-placeholder" style="background:${color}" data-folder-id="${f.id}" title="点击设置头像">${(f.name || '?')[0]}</span>`;
    return `<div class="su-slot-card su-local-folder-card" data-slot-id="${f.id}" title="${f.path}">
      <div class="su-folder-row1">
        ${avatarHtml}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">
          <div style="display:flex;align-items:center;gap:4px;">
            <span class="su-folder-name">${f.name}</span>${subBadge}
            ${count ? `<span class="su-slot-count-inline">${count}</span>` : ''}
            <span style="flex:1"></span>
            <button class="su-local-folder-avatar-btn" data-folder-id="${f.id}" title="设置头像">🖼️</button>
            <button class="su-local-folder-subfolder" data-folder-id="${f.id}" title="子文件夹规则">📂</button>
            <button class="su-local-folder-edit" data-folder-id="${f.id}" title="编辑名称">✏️</button>
            <button class="su-local-folder-group-btn" data-folder-id="${f.id}" title="设置分组">🏷️</button>
            <button class="su-local-folder-remove" data-folder-id="${f.id}" title="移除">✕</button>
          </div>
          <div class="su-folder-row2"><span class="su-folder-path-text">${shortPath}</span><button class="su-local-folder-open" data-folder-path="${f.path}" title="在 Finder 中打开">📂 打开</button></div>
        </div>
      </div>
    </div>`;
  }

  function renderLocalFolderList() {
    const container = $('su-slot-list');
    if (!container) return;
    const q = slotSearchQuery.toLowerCase();
    const filtered = localTargetFolders.filter(f => {
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q) || (f.group || '').toLowerCase().includes(q);
    });

    if (!filtered.length) {
      container.innerHTML = `<div class="su-local-empty" style="text-align:center;padding:24px 12px;color:#94a3b8;font-size:13px;word-break:keep-all;">
        <div style="font-size:32px;margin-bottom:8px;opacity:0.5;">📁</div>
        <p style="margin:0 0 8px">还没有目标文件夹</p>
        <p style="margin:0;font-size:12px;opacity:0.7">点击上方「+ 添加文件夹」按钮<br/>选择本地文件夹作为分类目标</p>
      </div>`;
      return;
    }

    // Group folders
    const groups = {};
    filtered.forEach(f => {
      const g = f.group || '';
      (groups[g] = groups[g] || []).push(f);
    });
    const groupNames = Object.keys(groups).sort((a, b) => {
      if (a === '' && b !== '') return 1;
      if (b === '' && a !== '') return -1;
      return a.localeCompare(b, 'zh-CN');
    });

    let html = '';
    for (const gName of groupNames) {
      const items = groups[gName];
      const isCollapsed = collapsedLocalGroups.has(gName);
      if (gName) {
        const groupCount = items.reduce((sum, f) => sum + Object.values(assignMap).filter(id => id === f.id).length, 0);
        html += `<div class="su-slot-group-label${isCollapsed ? ' collapsed' : ''}" data-group="${gName}">
          <span class="su-group-arrow">▼</span> ${gName} <span style="color:#999;font-weight:400;font-size:10px;">(${items.length}个${groupCount ? ' · 已分配' + groupCount : ''})</span>
        </div>`;
        html += `<div class="su-slot-group-items${isCollapsed ? ' collapsed' : ''}" data-group-items="${gName}">`;
      }
      items.forEach(f => { html += renderLocalFolderCard(f); });
      if (gName) html += '</div>';
    }
    container.innerHTML = html;

    // Group toggle
    container.querySelectorAll('.su-slot-group-label').forEach(label => {
      label.addEventListener('click', () => {
        const g = label.dataset.group;
        if (collapsedLocalGroups.has(g)) collapsedLocalGroups.delete(g); else collapsedLocalGroups.add(g);
        label.classList.toggle('collapsed');
        const items = container.querySelector(`[data-group-items="${g}"]`);
        if (items) items.classList.toggle('collapsed');
      });
    });
    // Click → assign
    container.querySelectorAll('.su-local-folder-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.su-local-folder-remove') || e.target.closest('.su-local-folder-edit') || e.target.closest('.su-local-folder-group-btn') || e.target.closest('.su-local-folder-subfolder') || e.target.closest('.su-local-folder-open') || e.target.closest('.su-local-folder-avatar') || e.target.closest('.su-local-folder-avatar-placeholder') || e.target.closest('.su-local-folder-avatar-btn')) return;
        assignSelectedToSlot(card.dataset.slotId);
      });
    });
    // Remove
    container.querySelectorAll('.su-local-folder-remove').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); removeLocalFolder(btn.dataset.folderId); });
    });
    // Open in Finder
    container.querySelectorAll('.su-local-folder-open').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = btn.dataset.folderPath;
        if (p && window.bridge?.openPath) window.bridge.openPath(p);
        else if (p) require('electron').shell.openPath(p);
      });
    });
    // Edit name
    container.querySelectorAll('.su-local-folder-edit').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); editLocalFolderName(btn.dataset.folderId); });
    });
    // Set group
    container.querySelectorAll('.su-local-folder-group-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const existing = [...new Set(localTargetFolders.map(f => f.group).filter(Boolean))];
        const hint = existing.length ? `现有分组：${existing.join(', ')}\n输入分组名（留空取消分组）：` : '输入分组名（留空取消分组）：';
        const g = await showPrompt(hint, localTargetFolders.find(f => f.id === btn.dataset.folderId)?.group || '');
        if (g !== null) setLocalFolderGroup(btn.dataset.folderId, g.trim());
      });
    });
    // Set avatar (click avatar btn, placeholder, or avatar image)
    async function pickAvatarForFolder(fid) {
      const imgPath = await window.bridge?.localFiles?.pickImage?.();
      if (!imgPath) return;
      const folder = localTargetFolders.find(f => f.id === fid);
      if (!folder) return;
      // Open crop/position modal
      showAvatarCropModal(folder, imgPath);
    }
    container.querySelectorAll('.su-local-folder-avatar-btn, .su-local-folder-avatar, .su-local-folder-avatar-placeholder').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const fid = el.dataset.folderId;
        if (fid) pickAvatarForFolder(fid);
      });
    });
    // Hover preview for avatar images
    container.querySelectorAll('.su-local-folder-avatar').forEach(img => {
      let popup = null;
      img.addEventListener('mouseenter', (e) => {
        popup = document.createElement('div');
        popup.className = 'su-avatar-preview-popup';
        const previewImg = document.createElement('img');
        previewImg.src = img.src;
        if (img.style.objectPosition) previewImg.style.objectPosition = img.style.objectPosition;
        popup.appendChild(previewImg);
        popup.style.left = (e.clientX + 15) + 'px';
        popup.style.top = Math.max(10, e.clientY - 100) + 'px';
        document.body.appendChild(popup);
      });
      img.addEventListener('mousemove', (e) => {
        if (popup) {
          popup.style.left = (e.clientX + 15) + 'px';
          popup.style.top = Math.max(10, e.clientY - 100) + 'px';
        }
      });
      img.addEventListener('mouseleave', () => {
        if (popup) { popup.remove(); popup = null; }
      });
    });
    // Set subfolder rule per folder
    container.querySelectorAll('.su-local-folder-subfolder').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const folder = localTargetFolders.find(f => f.id === btn.dataset.folderId);
        if (!folder) return;
        // Create inline dropdown
        const existing = document.querySelector('.su-subfolder-popup');
        if (existing) existing.remove();
        const popup = document.createElement('div');
        popup.className = 'su-subfolder-popup';
        popup.style.cssText = 'position:absolute;z-index:9999;background:#fff;border:1px solid #e0e0e0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);padding:6px 0;min-width:180px;font-size:12px;';
        const options = [
          { value: '', label: '❌ 不建子文件夹' },
          { value: 'date', label: '📅 按日期 (2026-04-26)' },
          { value: 'date-cn', label: '📅 中文日期 (4月26日)' },
          { value: 'yearmonth', label: '📅 按年月 (2026-04)' },
          { value: 'custom', label: '✏️ 自定义名称...' },
        ];
        options.forEach(opt => {
          const item = document.createElement('div');
          item.style.cssText = `padding:6px 14px;cursor:pointer;${folder.subfolderRule === opt.value ? 'background:#e8f0fe;color:#1a73e8;font-weight:600;' : ''}`;
          item.textContent = opt.label;
          item.addEventListener('mouseenter', () => { item.style.background = '#f0f4f9'; });
          item.addEventListener('mouseleave', () => { item.style.background = folder.subfolderRule === opt.value ? '#e8f0fe' : ''; });
          item.addEventListener('click', async () => {
            popup.remove();
            if (opt.value === 'custom') {
              const name = await showPrompt('子文件夹名称：', folder.subfolderCustom || '');
              if (name !== null) {
                folder.subfolderRule = 'custom';
                folder.subfolderCustom = name.trim() || '未命名';
              }
            } else {
              folder.subfolderRule = opt.value;
              folder.subfolderCustom = '';
            }
            saveLocalTargetFolders();
            renderSlotList();
          });
          popup.append(item);
        });
        const rect = btn.getBoundingClientRect();
        popup.style.left = rect.left + 'px';
        popup.style.top = rect.bottom + 4 + 'px';
        popup.style.position = 'fixed';
        document.body.append(popup);
        const dismiss = (ev) => { if (!popup.contains(ev.target)) { popup.remove(); document.removeEventListener('click', dismiss); } };
        setTimeout(() => document.addEventListener('click', dismiss), 10);
      });
    });
  }

  async function startLocalOrganize(action) {
    const assigned = Object.entries(assignMap);
    if (!assigned.length) return;

    const groups = {};
    assigned.forEach(([fileId, folderId]) => {
      (groups[folderId] = groups[folderId] || []).push(fileId);
    });

    const totalFiles = assigned.length;
    let doneCount = 0;

    const progressBar = $('su-progress-bar');
    const progressFill = $('su-progress-fill');
    const progressText = $('su-progress-text');
    if (progressBar) progressBar.hidden = false;
    if (progressText) progressText.hidden = false;

    for (const [folderId, fileIds] of Object.entries(groups)) {
      const folder = localTargetFolders.find(f => f.id === folderId);
      if (!folder) continue;

      for (const fileId of fileIds) {
        const file = localFiles.find(f => f.id === fileId);
        if (!file) continue;

        let targetDir = folder.path;
        // Per-folder subfolder rule takes priority, then global
        const useRule = folder.subfolderRule || (localOrgDateSub ? subfolderRule : '');
        if (useRule) {
          const d = new Date();
          let subName = '';
          switch (useRule) {
            case 'date':
              subName = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
              break;
            case 'date-cn':
              subName = (d.getMonth()+1) + '月' + d.getDate() + '日';
              break;
            case 'yearmonth':
              subName = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
              break;
            case 'custom':
              subName = (folder.subfolderCustom || subfolderCustom || '').trim() || '未命名';
              break;
            default:
              subName = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
          }
          targetDir += '/' + subName;
        }

        try {
          let result;
          if (action === 'move') {
            result = await window.bridge?.localFiles?.moveToFolder?.(file.path, targetDir);
          } else {
            result = await window.bridge?.localFiles?.copyToFolder?.(file.path, targetDir);
          }
          if (result && result.success === false) {
            console.warn('Local organize returned failure:', file.name, result.error);
            localOrgDone[fileId] = { folderId, folderName: folder.name, status: 'fail', action };
          } else {
            localOrgDone[fileId] = { folderId, folderName: folder.name, status: 'done', action };
          }
        } catch (err) {
          console.warn('Local organize failed:', file.name, err);
          localOrgDone[fileId] = { folderId, folderName: folder.name, status: 'fail', action };
        }
        doneCount++;
        if (progressFill) progressFill.style.width = (doneCount / totalFiles * 100) + '%';
        if (progressText) progressText.textContent = `${action === 'move' ? '移动' : '复制'}中... ${doneCount}/${totalFiles} → ${folder.name}`;
      }
    }

    const doneOk = Object.values(localOrgDone).filter(u => u.status === 'done').length;
    const doneFail = Object.values(localOrgDone).filter(u => u.status === 'fail').length;
    if (progressText) progressText.textContent = `整理完成 ✅ 成功 ${doneOk} / 失败 ${doneFail}`;

    // Post-move cleanup: remove successfully moved files from list & clear assignments
    if (action === 'move') {
      const movedIds = Object.entries(localOrgDone)
        .filter(([, info]) => info.status === 'done' && info.action === 'move')
        .map(([id]) => id);
      if (movedIds.length) {
        localFiles = localFiles.filter(f => !movedIds.includes(f.id));
        movedIds.forEach(id => {
          delete assignMap[id];
          delete localOrgDone[id];
          selectedIds.delete(id);
        });
      }
    }
    // For copy: clear assignments so count resets, but keep files in list
    if (action === 'copy') {
      const copiedIds = Object.entries(localOrgDone)
        .filter(([, info]) => info.status === 'done' && info.action === 'copy')
        .map(([id]) => id);
      copiedIds.forEach(id => {
        delete assignMap[id];
        delete localOrgDone[id];
      });
    }
    renderFileGrid();
    updateActionBar();
  }

  // ── Batch table editor ──
  function openBatchEditor() {
    $('su-batch-modal').hidden = false;
    populateBatchToolbar();
    renderBatchTable();
  }

  function closeBatchEditor() { $('su-batch-modal').hidden = true; }

  function getMainOptions(selected) {
    const cats = (typeof state !== 'undefined' && Array.isArray(state.categories)) ? state.categories : [];
    return `<option value="">--选择--</option>` + cats.map(c => `<option value="${c.name}"${c.name === selected ? ' selected' : ''}>${c.name}</option>`).join('');
  }
  function getSubOptions(main, selected) {
    const cats = (typeof state !== 'undefined' && Array.isArray(state.categories)) ? state.categories : [];
    const cat = cats.find(c => c.name === main);
    if (!cat || !cat.subs) return `<option value="">--</option>`;
    return `<option value="">--选择--</option>` + cat.subs.map(s => `<option value="${s.name}"${s.name === selected ? ' selected' : ''}>${s.name}</option>`).join('');
  }
  function getNamingOptions(selected) {
    const presets = (typeof state !== 'undefined' && Array.isArray(state.namingPresets)) ? state.namingPresets : [];
    return `<option value="">--默认--</option>` + presets.map(p => `<option value="${p.id}"${p.id === selected ? ' selected' : ''}>${p.label || p.id}</option>`).join('');
  }
  function getTaskTypeOptions(selected) {
    const types = (typeof getKnownTaskTypes === 'function') ? getKnownTaskTypes() : [];
    return `<option value="">--选择--</option>` + types.map(t => `<option value="${t}"${t === selected ? ' selected' : ''}>${t}</option>`).join('');
  }

  function renderBatchTable() {
    const tbody = $('su-batch-tbody');
    if (!tbody) return;
    const slots = getSlots();
    tbody.innerHTML = slots.map((s, i) => {
      const av = s.avatar || '';
      const avSrc = parseImageFormula(av);
      const isCustom = s.mode === 'custom-link';
      return `<tr data-idx="${i}">
      <td><input type="checkbox" class="su-batch-row-check" /></td>
      <td class="su-col-optional"><input type="text" value="${s.groupLabel || ''}" data-field="groupLabel" placeholder="分组" /></td>
      <td class="su-avatar-cell su-col-optional" data-idx="${i}">
        <div class="su-avatar-drop" title="点击选择图片 或 拖拽图片到此处">
          ${avSrc ? `<img class="su-avatar-preview" src="${avSrc}" />` : '<span class="su-avatar-placeholder-btn">＋</span>'}
        </div>
        <input type="text" value="${av}" data-field="avatar" class="su-avatar-url-input" placeholder="URL" />
        <input type="file" accept="image/*" class="su-avatar-file-input" style="display:none" />
      </td>
      <td><input type="text" value="${s.displayName || ''}" data-field="displayName" placeholder="卡片名称" /></td>
      <td><select data-field="mode" class="su-mode-select"><option value="library"${!isCustom ? ' selected' : ''}>入库</option><option value="custom-link"${isCustom ? ' selected' : ''}>自定义</option></select></td>
      <td class="su-col-custom"${!isCustom ? ' style="opacity:0.3"' : ''}><input type="text" value="${s.customLink || ''}" data-field="customLink" placeholder="Drive文件夹链接" /></td>
      <td class="su-col-optional"><input type="checkbox" data-field="skipCreateSubfolder" ${s.skipCreateSubfolder ? 'checked' : ''} /></td>
      <td><select data-field="taskType">${getTaskTypeOptions(s.taskType || '')}</select></td>
      <td class="su-col-optional"><input type="text" value="${s.extraLink || ''}" data-field="extraLink" placeholder="专页链接" /></td>
      <td class="su-col-optional"><input type="text" value="${s.pageName || ''}" data-field="pageName" placeholder="专页名称" /></td>
      <td class="su-col-optional"><input type="text" value="${s.admin || ''}" data-field="admin" placeholder="管理员" /></td>
      <td class="su-col-lib"${isCustom ? ' style="opacity:0.3"' : ''}><select data-field="mainCategory" class="su-main-cat-select">${getMainOptions(s.mainCategory)}</select></td>
      <td class="su-col-lib"${isCustom ? ' style="opacity:0.3"' : ''}><select data-field="subCategory" class="su-sub-cat-select">${getSubOptions(s.mainCategory, s.subCategory)}</select></td>
      <td class="su-col-lib su-col-optional"${isCustom ? ' style="opacity:0.3"' : ''}><select data-field="namingPresetId">${getNamingOptions(s.namingPresetId || '')}</select></td>
      <td class="su-col-lib su-col-optional"${isCustom ? ' style="opacity:0.3"' : ''}><select data-field="folderNamingPresetId">${getNamingOptions(s.folderNamingPresetId || '')}</select></td>
      <td class="su-col-lib su-col-optional"${isCustom ? ' style="opacity:0.3"' : ''}><input type="text" value="${s.subject || ''}" data-field="subject" placeholder="主题" /></td>
      <td class="su-col-lib su-col-optional"${isCustom ? ' style="opacity:0.3"' : ''}><input type="text" value="${s.eventName || ''}" data-field="eventName" placeholder="事件名称" /></td>
      <td class="su-col-lib su-col-optional"${isCustom ? ' style="opacity:0.3"' : ''}><input type="text" value="${s.distribution || ''}" data-field="distribution" placeholder="分发方式" /></td>
    </tr>`;
    }).join('');

    // Avatar cell interactions
    tbody.querySelectorAll('.su-avatar-cell').forEach(cell => {
      const dropArea = cell.querySelector('.su-avatar-drop');
      const fileInput = cell.querySelector('.su-avatar-file-input');
      const urlInput = cell.querySelector('.su-avatar-url-input');
      dropArea.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const f = fileInput.files[0];
        if (!f) return;
        const p = f.path || (window.bridge?.getPathForFile?.(f));
        if (p) {
          urlInput.value = p;
          const src = 'file://' + encodeURI(p).replace(/#/g, '%23');
          dropArea.innerHTML = `<img class="su-avatar-preview" src="${src}" />`;
        }
      });
      dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
      dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
      dropArea.addEventListener('drop', e => {
        e.preventDefault(); dropArea.classList.remove('drag-over');
        const f = e.dataTransfer?.files?.[0];
        if (f && f.type.startsWith('image/')) {
          const p = f.path || (window.bridge?.getPathForFile?.(f));
          if (p) {
            urlInput.value = p;
            const src = 'file://' + encodeURI(p).replace(/#/g, '%23');
            dropArea.innerHTML = `<img class="su-avatar-preview" src="${src}" />`;
          }
        }
      });
      urlInput.addEventListener('change', () => {
        const src = parseImageFormula(urlInput.value);
        if (src) { dropArea.innerHTML = `<img class="su-avatar-preview" src="${src}" />`; }
        else { dropArea.innerHTML = '<span class="su-avatar-placeholder-btn">＋</span>'; }
      });
    });

    // Main → Sub category cascade
    tbody.querySelectorAll('.su-main-cat-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const tr = sel.closest('tr');
        const subSel = tr.querySelector('.su-sub-cat-select');
        if (subSel) subSel.innerHTML = getSubOptions(sel.value, '');
      });
    });

    // Mode change → toggle lib/custom column visibility per row + update global visibility
    tbody.querySelectorAll('.su-mode-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const tr = sel.closest('tr');
        const isCustom = sel.value === 'custom-link';
        tr.querySelectorAll('.su-col-lib').forEach(td => td.style.opacity = isCustom ? '0.3' : '1');
        tr.querySelectorAll('.su-col-custom').forEach(td => td.style.opacity = isCustom ? '1' : '0.3');
        updateBatchColumnVisibility();
      });
    });

    updateBatchColumnVisibility();
  }

  /** Scan all rows to determine dominant mode and hide irrelevant columns */
  function updateBatchColumnVisibility() {
    const table = $('su-batch-table');
    if (!table) return;
    const tbody = $('su-batch-tbody');
    if (!tbody) return;

    const modes = new Set();
    tbody.querySelectorAll('.su-mode-select').forEach(sel => modes.add(sel.value));
    // Also check slots directly for rows not yet rendered
    if (modes.size === 0) {
      getSlots().forEach(s => modes.add(s.mode || 'library'));
    }

    if (modes.size === 1 && modes.has('custom-link')) {
      table.dataset.batchMode = 'custom';
    } else if (modes.size === 1 && modes.has('library')) {
      table.dataset.batchMode = 'library';
    } else {
      table.dataset.batchMode = 'mixed';
    }
  }

  function saveBatchEdits() {
    const tbody = $('su-batch-tbody');
    if (!tbody) return;
    const slots = getSlots();
    tbody.querySelectorAll('tr').forEach(tr => {
      const idx = parseInt(tr.dataset.idx);
      const slot = slots[idx];
      if (!slot) return;
      tr.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        if (field === 'skipCreateSubfolder') {
          slot[field] = el.checked;
          return;
        }
        const val = el.value;
        if (field === 'mode') { slot.mode = val; }
        else { slot[field] = val; }
        if (field === 'customLink' && val) {
          slot.customFolderId = (typeof extractDriveFolderId === 'function') ? extractDriveFolderId(val) : val;
        }
      });
    });
    if (typeof persistSlotPresets === 'function') persistSlotPresets();
    if (typeof renderSlots === 'function') renderSlots();
    renderSlotList();
    closeBatchEditor();
  }

  // Helper: save current batch table edits back to state.slots without closing the modal
  function saveBatchEditsInPlace() {
    const tbody = $('su-batch-tbody');
    if (!tbody) return;
    const slots = getSlots();
    tbody.querySelectorAll('tr').forEach(tr => {
      const idx = parseInt(tr.dataset.idx);
      const slot = slots[idx];
      if (!slot) return;
      tr.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        if (field === 'skipCreateSubfolder') {
          slot[field] = el.checked;
          return;
        }
        const val = el.value;
        if (field === 'mode') { slot.mode = val; }
        else { slot[field] = val; }
        if (field === 'customLink' && val) {
          slot.customFolderId = (typeof extractDriveFolderId === 'function') ? extractDriveFolderId(val) : val;
        }
      });
    });
  }

  function batchAddRow() {
    saveBatchEditsInPlace();
    if (typeof addSlot === 'function') addSlot({});
    renderBatchTable();
  }

  function batchDeleteChecked() {
    saveBatchEditsInPlace();
    const tbody = $('su-batch-tbody');
    const slots = getSlots();
    const toRemove = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      if (tr.querySelector('.su-batch-row-check')?.checked) {
        toRemove.push(parseInt(tr.dataset.idx));
      }
    });
    toRemove.sort((a, b) => b - a).forEach(idx => {
      if (typeof removeSlot === 'function' && slots[idx]) removeSlot(slots[idx].id);
    });
    renderBatchTable();
  }

  const PASTE_FIELD_MAP = {
    '分类名称': 'mainCategory', '主分类': 'mainCategory', 'maincategory': 'mainCategory',
    '子分类': 'subCategory', 'subcategory': 'subCategory',
    '分组': 'groupLabel', 'group': 'groupLabel',
    '模式': 'mode', 'mode': 'mode',
    '目标链接': 'customLink', '链接': 'customLink', 'link': 'customLink',
    '显示名称': 'displayName', 'displayname': 'displayName', '名称': 'displayName',
    '头像': 'avatar', 'avatar': 'avatar', '图片': 'avatar', 'image': 'avatar',
    '专页链接': 'extraLink', '账号链接': 'extraLink', 'extralink': 'extraLink', 'pagelink': 'extraLink'
  };
  // Fixed column order fallback (no header)
  const PASTE_FIXED_ORDER = ['mainCategory', 'subCategory', 'groupLabel', 'mode', 'customLink', 'displayName', 'avatar', 'extraLink'];

  async function batchPaste() {
    try {
      saveBatchEditsInPlace();
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) return;
      const rows = text.split('\n').filter(r => r.trim());
      if (!rows.length) return;

      // Detect header: check if first row's cells match known field names
      const firstCols = rows[0].split('\t').map(c => c.trim().toLowerCase());
      const headerHits = firstCols.filter(c => PASTE_FIELD_MAP[c]).length;
      const hasHeader = headerHits >= 2; // at least 2 columns recognized as headers

      let colMap = {};
      let dataStart = 0;
      let isSingleColLink = false;
      if (hasHeader) {
        firstCols.forEach((h, i) => { if (PASTE_FIELD_MAP[h]) colMap[PASTE_FIELD_MAP[h]] = i; });
        dataStart = 1;
      } else {
        if (firstCols.length === 1 && parseDriveLink(firstCols[0])) {
          isSingleColLink = true;
          colMap['customLink'] = 0;
        } else {
          PASTE_FIXED_ORDER.forEach((f, i) => { colMap[f] = i; });
        }
        dataStart = 0;
      }

      let count = 0;
      for (let i = dataStart; i < rows.length; i++) {
        const cols = rows[i].split('\t');
        if (cols.length < 1) continue;
        const preset = {};
        Object.entries(colMap).forEach(([field, idx]) => {
          let val = (cols[idx] || '').trim();
          if (field === 'mode') val = (val === '自定义' || val === 'custom-link') ? 'custom-link' : 'library';
          if (field === 'avatar') val = parseImageFormula(val);
          preset[field] = val;
        });
        if (isSingleColLink) preset.mode = 'custom-link';
        if (preset.mainCategory || preset.displayName || preset.subCategory || preset.customLink) {
          if (typeof addSlot === 'function') { addSlot(preset); count++; }
        }
      }

      if (typeof persistSlotPresets === 'function') persistSlotPresets();
      renderBatchTable();
      renderSlotList();
      alert(`已从剪贴板粘贴添加 ${count} 个卡片${hasHeader ? '（已识别表头）' : '（按默认列顺序）'}`);
    } catch (e) { console.warn('粘贴失败:', e); alert('粘贴失败: ' + e.message); }
  }

  // ── Batch toolbar operations ──

  /** Populate the toolbar dropdowns with current state data */
  function populateBatchToolbar() {
    const cats = (typeof state !== 'undefined' && Array.isArray(state.categories)) ? state.categories : [];
    const mainSel = $('su-batch-set-main');
    if (mainSel) {
      mainSel.innerHTML = `<option value="">--不设--</option>` + cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }
    // Sub defaults to empty until main is chosen
    const subSel = $('su-batch-set-sub');
    if (subSel) subSel.innerHTML = `<option value="">--不设--</option>`;
    // Main → Sub cascade in toolbar
    mainSel?.addEventListener('change', () => {
      const cat = cats.find(c => c.name === mainSel.value);
      if (subSel) {
        subSel.innerHTML = `<option value="">--不设--</option>` +
          (cat?.subs || []).map(s => `<option value="${s.name}">${s.name}</option>`).join('');
      }
    });
    // Task types
    const taskSel = $('su-batch-set-tasktype');
    if (taskSel) {
      const types = (typeof getKnownTaskTypes === 'function') ? getKnownTaskTypes() : [];
      taskSel.innerHTML = `<option value="">--不设--</option>` + types.map(t => `<option value="${t}">${t}</option>`).join('');
    }
    // Naming presets
    const namingSel = $('su-batch-set-naming');
    if (namingSel) {
      const presets = (typeof state !== 'undefined' && Array.isArray(state.namingPresets)) ? state.namingPresets : [];
      namingSel.innerHTML = `<option value="">--不设--</option>` + presets.map(p => `<option value="${p.id}">${p.label || p.id}</option>`).join('');
    }
  }

  /** Apply toolbar field values to all checked rows */
  function batchApplyFields() {
    saveBatchEditsInPlace();
    const tbody = $('su-batch-tbody');
    if (!tbody) return;
    const slots = getSlots();
    const checkedRows = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      if (tr.querySelector('.su-batch-row-check')?.checked) {
        checkedRows.push(parseInt(tr.dataset.idx));
      }
    });
    if (!checkedRows.length) {
      alert('请先勾选要设置的行');
      return;
    }

    const mainVal = $('su-batch-set-main')?.value;
    const subVal = $('su-batch-set-sub')?.value;
    const groupVal = $('su-batch-set-group')?.value?.trim();
    const avatarVal = $('su-batch-set-avatar')?.value?.trim();
    const modeVal = $('su-batch-set-mode')?.value;
    const taskVal = $('su-batch-set-tasktype')?.value;
    const namingVal = $('su-batch-set-naming')?.value;

    let changed = 0;
    checkedRows.forEach(idx => {
      const slot = slots[idx];
      if (!slot) return;
      if (mainVal) { slot.mainCategory = mainVal; changed++; }
      if (subVal) { slot.subCategory = subVal; changed++; }
      if (groupVal) { slot.groupLabel = groupVal; changed++; }
      if (avatarVal) { slot.avatar = avatarVal; changed++; }
      if (modeVal) { slot.mode = modeVal; changed++; }
      if (taskVal) { slot.taskType = taskVal; changed++; }
      if (namingVal) { slot.namingPresetId = namingVal; changed++; }
    });

    if (changed === 0) {
      alert('请至少在工具栏中选择一个要设置的值');
      return;
    }

    if (typeof persistSlotPresets === 'function') persistSlotPresets();
    renderBatchTable();
    alert(`已将设置应用到 ${checkedRows.length} 行`);
  }

  /** Extract a Google Drive folder ID from any Drive URL format */
  function parseDriveLink(raw) {
    const s = (raw || '').trim().replace(/^"|"$/g, '');
    if (!s) return '';
    // Pure ID (20+ alphanumeric chars)
    if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
    try {
      const url = new URL(s);
      // ?id=xxx
      const qid = url.searchParams.get('id');
      if (qid && /^[a-zA-Z0-9_-]{10,}$/.test(qid)) return qid;
      const segs = url.pathname.split('/').filter(Boolean);
      // /drive/folders/xxx or /drive/u/0/folders/xxx
      const fi = segs.lastIndexOf('folders');
      if (fi !== -1 && segs[fi + 1]) return segs[fi + 1].split('?')[0];
      // /file/d/xxx or /document/d/xxx
      const di = segs.lastIndexOf('d');
      if (di !== -1 && segs[di + 1]) return segs[di + 1].split('?')[0];
      // /open?id=xxx  (already handled by query param)
    } catch (_) { /* not a URL */ }
    // Fallback: extract longest ID-like substring
    const m = s.match(/[a-zA-Z0-9_-]{20,}/);
    return m ? m[0] : '';
  }

  /** Show a dialog to paste multiple Drive links, then distribute to rows */
  function batchPasteLinks() {
    saveBatchEditsInPlace();
    // Remove any existing dialog
    document.querySelector('.su-batch-link-dialog-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'su-batch-link-dialog-overlay';
    overlay.innerHTML = `
      <div class="su-batch-link-dialog">
        <div class="su-batch-link-dialog-header">
          <h4>📋 批量粘贴 Google Drive 链接</h4>
          <button class="su-btn su-btn-sm su-link-dialog-close">✕</button>
        </div>
        <div class="su-batch-link-dialog-body">
          <textarea id="su-link-paste-area" placeholder="每行粘贴一条 Google Drive 文件夹链接，支持各种格式：&#10;&#10;https://drive.google.com/drive/folders/xxxxx&#10;https://drive.google.com/drive/u/0/folders/xxxxx&#10;https://drive.google.com/open?id=xxxxx&#10;纯文件夹ID (如 1AbCdEfGhIjKlMnOpQrStUv)&#10;&#10;也可以直接从表格粘贴一整列链接"></textarea>
          <div style="display:flex;gap:8px;margin:8px 0;align-items:center;">
            <label style="font-size:12px;color:#555;font-weight:600;">粘贴模式：</label>
            <label style="font-size:12px;cursor:pointer;"><input type="radio" name="su-paste-mode" value="replace" checked style="margin-right:3px"/>覆盖（从第1行起替换）</label>
            <label style="font-size:12px;cursor:pointer;"><input type="radio" name="su-paste-mode" value="fill" style="margin-right:3px"/>补全（仅填空行）</label>
            <label style="font-size:12px;cursor:pointer;"><input type="radio" name="su-paste-mode" value="append" style="margin-right:3px"/>新增（全部创建新行）</label>
          </div>
          <p class="hint">
            ✅ 支持格式：folders/xxx、open?id=xxx、file/d/xxx、纯ID<br/>
            📌 <strong>覆盖</strong>: 按顺序替换勾选行或全部行 | <strong>补全</strong>: 只填没链接的行 | <strong>新增</strong>: 全部创建新行
          </p>
        </div>
        <div class="su-batch-link-dialog-footer">
          <span class="info" id="su-link-count-info">已识别 0 条链接</span>
          <div class="actions">
            <button class="su-btn su-link-dialog-cancel">取消</button>
            <button class="su-btn su-btn-primary su-link-dialog-apply">确认分配</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#su-link-paste-area');
    const countInfo = overlay.querySelector('#su-link-count-info');
    const closeBtn = overlay.querySelector('.su-link-dialog-close');
    const cancelBtn = overlay.querySelector('.su-link-dialog-cancel');
    const applyBtn = overlay.querySelector('.su-link-dialog-apply');

    // Live count
    textarea.addEventListener('input', () => {
      const lines = textarea.value.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
      const validCount = lines.filter(l => parseDriveLink(l)).length;
      countInfo.textContent = `已识别 ${validCount} 条有效链接（共 ${lines.length} 行）`;
    });

    const close = () => overlay.remove();
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    applyBtn.addEventListener('click', () => {
      const lines = textarea.value.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
      const links = lines.map(l => ({ raw: l, id: parseDriveLink(l) })).filter(x => x.id);
      if (!links.length) { alert('未识别到有效的 Drive 链接'); return; }

      const mode = overlay.querySelector('input[name="su-paste-mode"]:checked')?.value || 'replace';
      const slots = getSlots();
      const tbody = $('su-batch-tbody');
      const results = []; // track what was done

      if (mode === 'append') {
        // All links create new rows
        links.forEach((link, i) => {
          if (typeof addSlot === 'function') {
            addSlot({ mode: 'custom-link', customLink: link.raw, customFolderId: link.id });
            results.push(`🆕 新增第 ${slots.length + i + 1} 行 → ${link.raw.substring(0, 50)}...`);
          }
        });
      } else if (mode === 'fill') {
        // Only fill slots that have no customLink
        let li = 0;
        for (let si = 0; si < slots.length && li < links.length; si++) {
          if (!slots[si].customLink && !slots[si].lastFolderLink) {
            slots[si].mode = 'custom-link';
            slots[si].customLink = links[li].raw;
            slots[si].customFolderId = links[li].id;
            results.push(`📝 第 ${si + 1} 行 (${getSlotName(slots[si])}) ← 补全`);
            li++;
          }
        }
        // Remaining links create new rows
        while (li < links.length) {
          if (typeof addSlot === 'function') {
            addSlot({ mode: 'custom-link', customLink: links[li].raw, customFolderId: links[li].id });
            results.push(`🆕 新增行 ← ${links[li].raw.substring(0, 50)}...`);
          }
          li++;
        }
      } else {
        // Replace mode: use checked rows or sequential
        let targetIndices = [];
        if (tbody) {
          tbody.querySelectorAll('tr').forEach(tr => {
            if (tr.querySelector('.su-batch-row-check')?.checked) {
              targetIndices.push(parseInt(tr.dataset.idx));
            }
          });
        }
        if (!targetIndices.length) {
          targetIndices = slots.map((_, i) => i);
        }

        for (let li = 0; li < links.length; li++) {
          if (li < targetIndices.length) {
            const idx = targetIndices[li];
            const slot = slots[idx];
            if (!slot) continue;
            const oldLink = slot.customLink || '';
            slot.mode = 'custom-link';
            slot.customLink = links[li].raw;
            slot.customFolderId = links[li].id;
            results.push(`🔄 第 ${idx + 1} 行 (${getSlotName(slot)})${oldLink ? ' [已替换]' : ' [新填入]'}`);
          } else {
            if (typeof addSlot === 'function') {
              addSlot({ mode: 'custom-link', customLink: links[li].raw, customFolderId: links[li].id });
              results.push(`🆕 新增行 ← ${links[li].raw.substring(0, 50)}...`);
            }
          }
        }
      }

      if (typeof persistSlotPresets === 'function') persistSlotPresets();
      renderBatchTable();
      renderSlotList();
      close();
      // Show detailed result
      const summary = `✅ 已处理 ${results.length} 条链接\n\n${results.join('\n')}`;
      alert(summary);
    });

    // Auto-focus and try reading clipboard
    setTimeout(() => {
      textarea.focus();
      navigator.clipboard?.readText?.().then(text => {
        if (text && text.trim() && !textarea.value) {
          // Only auto-fill if it looks like it contains Drive links
          const lines = text.split(/[\n\r]+/).filter(l => l.trim());
          const hasLinks = lines.some(l => parseDriveLink(l.trim()));
          if (hasLinks) {
            textarea.value = text;
            textarea.dispatchEvent(new Event('input'));
          }
        }
      }).catch(() => {});
    }, 100);
  }

  /** Add multiple rows at once */
  function batchAddMulti() {
    const countStr = prompt('要添加几行？', '5');
    if (!countStr) return;
    const count = parseInt(countStr);
    if (!count || count < 1 || count > 100) { alert('请输入 1-100 的数字'); return; }
    saveBatchEditsInPlace();
    for (let i = 0; i < count; i++) {
      if (typeof addSlot === 'function') addSlot({});
    }
    renderBatchTable();
    alert(`已添加 ${count} 行`);
  }

  // ── Sheets import ──
  function openSheetsImport() { $('su-sheets-modal').hidden = false; }
  function closeSheetsImport() { $('su-sheets-modal').hidden = true; }

  async function previewSheets() {
    const url = $('su-sheets-url')?.value?.trim();
    if (!url) return;
    const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) { alert('无效的 Google Sheets 链接'); return; }
    const sheetId = idMatch[1];
    const tabName = $('su-sheets-tab')?.value?.trim() || '';

    try {
      const token = await window.bridge?.getAccessToken?.();
      if (!token?.token) { alert('请先登录 Google'); return; }
      let apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName || 'Sheet1')}`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token.token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rows = data.values || [];
      if (rows.length < 2) { alert('表格数据不足'); return; }

      const area = $('su-sheets-preview-area');
      area.hidden = false;
      area.innerHTML = `<table><thead><tr>${rows[0].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.slice(1, 20).map(r => `<tr>${r.map(c => `<td>${c || ''}</td>`).join('')}</tr>`).join('')}</tbody></table><p style="color:#666;margin-top:6px">显示前 ${Math.min(rows.length - 1, 19)} 行 / 共 ${rows.length - 1} 行</p>`;

      // Store for import
      area._sheetsData = rows;
      $('su-sheets-import').disabled = false;
    } catch (e) {
      alert('读取失败: ' + e.message);
    }
  }

  function importFromSheets() {
    const area = $('su-sheets-preview-area');
    const rows = area?._sheetsData;
    if (!rows || rows.length < 2) return;

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const colMap = {};
    const fieldMap = {
      '分类名称': 'mainCategory', '主分类': 'mainCategory', 'maincategory': 'mainCategory',
      '子分类': 'subCategory', 'subcategory': 'subCategory',
      '分组': 'groupLabel', 'group': 'groupLabel', 'grouplabel': 'groupLabel',
      '模式': 'mode', 'mode': 'mode',
      '目标链接': 'customLink', '链接': 'customLink', 'link': 'customLink', 'customlink': 'customLink',
      '显示名称': 'displayName', 'displayname': 'displayName', '名称': 'displayName',
      '头像': 'avatar', 'avatar': 'avatar', '图片': 'avatar', 'image': 'avatar',
      '专页链接': 'extraLink', '账号链接': 'extraLink', 'extralink': 'extraLink', 'pagelink': 'extraLink', 'extra': 'extraLink'
    };
    headers.forEach((h, i) => { if (fieldMap[h]) colMap[fieldMap[h]] = i; });

    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const preset = {};
      Object.entries(colMap).forEach(([field, col]) => {
        let val = (r[col] || '').trim();
        if (field === 'mode') val = (val === '自定义' || val === 'custom-link') ? 'custom-link' : 'library';
        if (field === 'avatar') val = parseImageFormula(val);
        preset[field] = val;
      });
      if (preset.mainCategory || preset.displayName) {
        if (typeof addSlot === 'function') addSlot(preset);
        count++;
      }
    }
    if (typeof persistSlotPresets === 'function') persistSlotPresets();
    if (typeof renderSlots === 'function') renderSlots();
    renderSlotList();
    closeSheetsImport();
    alert(`成功导入 ${count} 个分类卡片`);
  }

  // ── Drop zone ──
  function setupDropZone() {
    const zone = $('su-drop-zone');
    const panel = $('sort-upload-panel');
    if (!zone || !panel) return;

    ['dragenter', 'dragover'].forEach(ev => {
      panel.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(ev => {
      panel.addEventListener(ev, () => zone.classList.remove('drag-over'));
    });
    panel.addEventListener('drop', async e => {
      e.preventDefault();
      const paths = [];
      if (e.dataTransfer?.files) {
        for (const f of e.dataTransfer.files) {
          const p = f.path || (window.bridge?.getPathForFile?.(f));
          if (p) paths.push({ id: p, name: f.name, path: p, size: f.size, mimeType: f.type || 'application/octet-stream', isLocal: true });
        }
      }
      if (paths.length) {
        paths.forEach(f => { if (!localFiles.some(lf => lf.id === f.id)) localFiles.push(f); });
        renderFileGrid();
        updateActionBar();
      }
    });
  }

  // ── Marquee Selection ──
  function initMarqueeSelection() {
    const area = $('su-file-area') || document.querySelector('#sort-upload-panel .su-file-area');
    if (!area) return;

    // Prevent native drag on images/videos from interfering with click/marquee selection
    area.addEventListener('dragstart', (e) => e.preventDefault());

    let isSelecting = false;
    let isPending = false;
    let startX = 0, startY = 0;
    let selectionBox = null;
    let initialSelected = new Set();
    let startedOnCard = false;
    const DRAG_THRESHOLD = 8;
    const CARD_DRAG_THRESHOLD = 40; // Higher threshold when starting on a card to avoid accidental marquee

    function isInteractiveSelectionTarget(target) {
      return Boolean(target.closest(
        'button, input, select, textarea, a, .su-video-badge, .su-file-delete, .su-select-popup'
      ));
    }

    function beginSelection(e) {
      isSelecting = true;
      isPending = false;

      if (e.ctrlKey || e.metaKey || e.shiftKey || startedOnCard) {
        // When starting on a card, preserve existing selections (additive)
        // to avoid clearing everything on accidental drag
        initialSelected = new Set(selectedIds);
      } else {
        selectedIds.clear();
        initialSelected = new Set();
        updateFileCardsInPlace();
        updateActionBar();
      }

      selectionBox = document.createElement('div');
      selectionBox.className = 'su-selection-box';
      selectionBox.style.left = startX + 'px';
      selectionBox.style.top = startY + 'px';
      selectionBox.style.width = '0px';
      selectionBox.style.height = '0px';
      document.body.appendChild(selectionBox);
    }
    
    area.addEventListener('mousedown', (e) => {
      // Ignore if clicking on interactive elements
      if (isInteractiveSelectionTarget(e.target)) return;
      if (e.button !== 0) return; // Only left click
      
      startedOnCard = !!e.target.closest('.su-file-card');
      isPending = true;
      startX = e.clientX;
      startY = e.clientY;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isPending && (!isSelecting || !selectionBox)) return;
      if (isPending && e.buttons !== 1) {
        isPending = false;
        return;
      }
      
      const currentX = e.clientX;
      const currentY = e.clientY;
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      if (isPending) {
        const threshold = startedOnCard ? CARD_DRAG_THRESHOLD : DRAG_THRESHOLD;
        if (width < threshold && height < threshold) return;
        beginSelection(e);
      }

      if (!selectionBox) return;
      
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      
      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
      
      // Calculate intersection
      const boxRect = { left, top, right: left + width, bottom: top + height };
      
      const cards = area.querySelectorAll('.su-file-card');
      const newSelected = new Set(initialSelected);
      
      cards.forEach(card => {
        const cardRect = card.getBoundingClientRect();
        
        const isIntersecting = !(
          cardRect.right < boxRect.left || 
          cardRect.left > boxRect.right || 
          cardRect.bottom < boxRect.top || 
          cardRect.top > boxRect.bottom
        );
        
        if (isIntersecting) {
          const ids = card.dataset.id
            ? [card.dataset.id]
            : getFileIdsUnderTreeFolder(card.dataset.folder);

          ids.forEach(id => {
            if (e.altKey && initialSelected.has(id)) {
               newSelected.delete(id); // Alt to deselect
            } else {
               newSelected.add(id);
            }
          });
        } else if (card.dataset.folder) {
          const ids = getFileIdsUnderTreeFolder(card.dataset.folder);
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            ids.forEach(id => {
              if (!initialSelected.has(id)) newSelected.delete(id);
            });
          }
        }
      });
      
      selectedIds = newSelected;
      updateFileCardsInPlace();
      updateFolderCardSelectionState(area);
      updateActionBar();
      e.preventDefault();
    });

    const stopSelection = () => {
      if (isPending) {
        isPending = false;
      }
      if (isSelecting) {
        isSelecting = false;
        // Only suppress card clicks if we actually drew a visible selection box
        if (selectionBox) {
          const boxW = parseInt(selectionBox.style.width) || 0;
          const boxH = parseInt(selectionBox.style.height) || 0;
          if (boxW > DRAG_THRESHOLD || boxH > DRAG_THRESHOLD) {
            suppressNextFileCardClick = true;
            setTimeout(() => { suppressNextFileCardClick = false; }, 250);
          }
          selectionBox.remove();
          selectionBox = null;
        }
      }
    };

    document.addEventListener('mouseup', stopSelection);
  }

  // ── Keyboard shortcuts ──
  function handleKeydown(e) {
    if ($('sort-upload-panel')?.style.display === 'none') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  }

  // ── Init ──
  function init() {
    initMarqueeSelection();
    // Create initial tab
    if (tabs.length === 0) {
      const firstTab = createTab('', '新标签');
      activeTabId = firstTab.id;
    }
    renderTabBar();

    // Mode switch
    const sortBtn = $('view-sort-upload');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => {
        // Toggle panel visibility
        const panel = $('sort-upload-panel');
        const catPanel = $('category-panel');
        const isActive = sortBtn.classList.contains('active');
        if (isActive) return;

        // Deactivate other view buttons
        document.querySelectorAll('.view-switch button').forEach(b => b.classList.remove('active'));
        sortBtn.classList.add('active');

        if (catPanel) catPanel.style.display = 'none';
        if (panel) panel.style.display = '';

        renderSlotList();
        renderFileGrid();
        updateActionBar();
        renderRecentSlots();
      });
    }

    // Also handle normal/review switching back — belt-and-suspenders
    document.querySelectorAll('#view-normal, #view-review').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = $('sort-upload-panel');
        if (panel) panel.style.display = 'none';
        const catPanel = $('category-panel');
        if (catPanel) catPanel.style.display = '';
        sortBtn?.classList.remove('active');
      });
    });

    // Pick folder
    $('su-pick-folder')?.addEventListener('click', pickFolder);
    $('su-refresh-folder')?.addEventListener('click', () => { if (localFolderPaths.length) refreshAllFolders(); else if (localFolderPath) scanFolder(localFolderPath); });

    // Scan progress
    window.bridge?.localFiles?.onScanProgress?.((data) => {
      const el = $('su-folder-path');
      if (el) {
        const name = data.folder.split('/').pop() || data.folder;
        el.textContent = `${name} (扫描中... ${data.count} 个文件)`;
      }
    });

    // Folder Watcher Events
    window.bridge?.localFiles?.onFolderRenamed?.(({ id, newPath, newName }) => {
      console.log('Folder renamed:', id, newPath, newName);
      const f = localTargetFolders.find(x => x.id === id);
      if (f) {
        f.path = newPath;
        f.name = newName;
        saveLocalTargetFolders();
        if (workMode === 'local-organize') renderSlotList();
      }
    });
    
    window.bridge?.localFiles?.onFolderMissing?.(({ id, path }) => {
      console.log('Folder missing:', id, path);
      // We could optionally mark it as missing in the UI, but for now we just log it.
      // The user will get an error if they try to move files to a missing folder.
    });

    // Search & Filter & Sort
    $('su-search')?.addEventListener('input', e => { searchQuery = e.target.value; renderFileGrid(); });
    $('su-date-filter')?.addEventListener('change', e => { dateFilter = e.target.value; renderFileGrid(); });
    $('su-sort-order')?.addEventListener('change', e => { sortOrder = e.target.value; renderFileGrid(); });
    $('su-slot-search')?.addEventListener('input', e => { slotSearchQuery = e.target.value; renderSlotList(); });

    // Type filters
    document.querySelectorAll('.su-type-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.su-type-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        typeFilter = chip.dataset.type;
        renderFileGrid();
      });
    });

    // View mode toggle (flat / tree)
    document.querySelectorAll('.su-view-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.su-view-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fileViewMode = btn.dataset.mode;
        currentTreePath = ''; // reset path on mode switch
        renderFileGrid();
      });
    });

    // Thumbnail size slider
    $('su-thumb-size')?.addEventListener('input', e => {
      const size = e.target.value + 'px';
      const grid = $('su-file-grid');
      if (grid) grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${size}, 1fr))`;
    });

    // Selection dropdown menu
    $('su-select-menu-btn')?.addEventListener('click', () => {
      const existing = document.querySelector('.su-select-popup');
      if (existing) { existing.remove(); return; }
      const btn = $('su-select-menu-btn');
      const popup = document.createElement('div');
      popup.className = 'su-select-popup';
      popup.style.cssText = 'position:absolute;top:100%;left:0;z-index:9999;background:#fff;border:1px solid #e0e0e0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.12);padding:4px 0;min-width:100px;font-size:12px;margin-top:4px;';
      const items = [
        { label: '☑ 全选', action: () => { filteredFiles().forEach(f => selectedIds.add(f.id)); updateFileCardsInPlace(); updateActionBar(); }},
        { label: '⇌ 反选', action: () => { filteredFiles().forEach(f => { if (selectedIds.has(f.id)) selectedIds.delete(f.id); else selectedIds.add(f.id); }); updateFileCardsInPlace(); updateActionBar(); }},
        { label: '☐ 取消选择', action: () => { selectedIds.clear(); updateFileCardsInPlace(); updateActionBar(); }},
      ];
      items.forEach(it => {
        const item = document.createElement('div');
        item.textContent = it.label;
        item.style.cssText = 'padding:5px 12px;cursor:pointer;white-space:nowrap;';
        item.addEventListener('mouseenter', () => { item.style.background = '#f0f4f9'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });
        item.addEventListener('click', () => { popup.remove(); it.action(); });
        popup.append(item);
      });
      btn.parentElement.append(popup);
      const dismiss = (ev) => { if (!popup.contains(ev.target) && ev.target !== btn) { popup.remove(); document.removeEventListener('click', dismiss); } };
      setTimeout(() => document.addEventListener('click', dismiss), 10);
    });

    // Action bar
    $('su-clear-assign')?.addEventListener('click', () => {
      assignMap = {}; updateFileCardsInPlace(); renderSlotList(); updateActionBar();
    });
    $('su-start-upload')?.addEventListener('click', startSortUpload);
    $('su-folder-upload')?.addEventListener('click', folderUploadToDrive);

    // Cloud org toggles
    $('su-cloud-subfolder')?.addEventListener('change', e => {
      cloudSubfolderEnabled = e.target.checked;
    });

    // Batch editor
    $('su-batch-edit-btn')?.addEventListener('click', openBatchEditor);
    $('su-batch-close')?.addEventListener('click', closeBatchEditor);
    $('su-batch-save')?.addEventListener('click', saveBatchEdits);
    $('su-batch-add-row')?.addEventListener('click', batchAddRow);
    $('su-batch-del-rows')?.addEventListener('click', batchDeleteChecked);
    $('su-batch-paste')?.addEventListener('click', batchPaste);
    $('su-batch-check-all')?.addEventListener('change', e => {
      $('su-batch-tbody')?.querySelectorAll('.su-batch-row-check').forEach(cb => { cb.checked = e.target.checked; });
    });
    // Batch toolbar buttons
    $('su-batch-apply-fields')?.addEventListener('click', batchApplyFields);
    $('su-batch-pick-avatar')?.addEventListener('click', async () => {
      const imgPath = await window.bridge?.localFiles?.pickImage?.();
      if (imgPath) {
        const input = $('su-batch-set-avatar');
        if (input) input.value = imgPath;
      }
    });
    $('su-batch-paste-links')?.addEventListener('click', batchPasteLinks);
    $('su-batch-add-multi')?.addEventListener('click', batchAddMulti);
    // Hide optional columns toggle
    $('su-batch-hide-optional')?.addEventListener('change', function() {
      const table = $('su-batch-table');
      if (table) table.dataset.hideOptional = this.checked ? 'true' : 'false';
    });

    // Sheets import
    $('su-import-sheets-btn')?.addEventListener('click', openSheetsImport);
    $('su-sheets-close')?.addEventListener('click', closeSheetsImport);
    $('su-sheets-preview')?.addEventListener('click', previewSheets);
    $('su-sheets-import')?.addEventListener('click', importFromSheets);

    // Drop zone
    setupDropZone();

    // Keyboard
    document.addEventListener('keydown', handleKeydown);

    // ── Local Organize Mode Init ──
    loadLocalTargetFolders();
    loadWorkMode();
    loadTabs();

    // Auto-scan restored source folders from saved tabs
    if (tabs.length && activeTabId) {
      const firstTab = tabs.find(t => t.id === activeTabId) || tabs[0];
      if (firstTab) {
        loadTab(firstTab.id);
        if (localFolderPaths.length) {
          $('su-refresh-folder').disabled = false;
          // Async scan without blocking init
          (async () => {
            for (const dir of localFolderPaths) {
              $('su-folder-path').textContent = `恢复中: ${dir}...`;
              const files = await window.bridge?.localFiles?.scanFolder?.(dir);
              if (Array.isArray(files)) {
                files.forEach(f => { if (!localFiles.some(lf => lf.id === f.id)) localFiles.push(f); });
              }
            }
            const tab = tabs.find(t => t.id === activeTabId);
            if (tab) { tab.localFiles = localFiles; }
            updateFolderPathDisplay();
            renderTabBar();
            renderFileGrid();
            updateActionBar();
          })();
        } else {
          updateFolderPathDisplay();
          renderTabBar();
          renderFileGrid();
          updateActionBar();
        }
      }
    }

    // Mode switch buttons
    document.querySelectorAll('.su-mode-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => switchWorkMode(btn.dataset.mode));
    });

    // Add local folder button
    $('su-add-local-folder')?.addEventListener('click', () => addLocalFolder());
    $('su-export-preset')?.addEventListener('click', exportPresetHandler);
    $('su-import-preset')?.addEventListener('click', importPresetHandler);
    $('su-merge-preset')?.addEventListener('click', mergePresetsHandler);

    // Local organize action buttons
    $('su-local-copy')?.addEventListener('click', () => startLocalOrganize('copy'));
    $('su-local-move')?.addEventListener('click', () => startLocalOrganize('move'));

    // Local org settings toggles
    const dateSubCb = $('su-local-org-date-sub');
    const ruleSelect = $('su-local-org-subfolder-rule');
    const customInput = $('su-local-org-subfolder-custom');
    if (dateSubCb) {
      dateSubCb.addEventListener('change', e => {
        localOrgDateSub = e.target.checked;
        if (ruleSelect) ruleSelect.style.display = localOrgDateSub ? '' : 'none';
        if (customInput) customInput.style.display = (localOrgDateSub && subfolderRule === 'custom') ? '' : 'none';
      });
    }
    if (ruleSelect) {
      ruleSelect.addEventListener('change', e => {
        subfolderRule = e.target.value;
        if (customInput) customInput.style.display = subfolderRule === 'custom' ? '' : 'none';
      });
    }
    if (customInput) {
      customInput.addEventListener('input', e => { subfolderCustom = e.target.value; });
    }

    // Apply initial mode UI
    updateModeUI();
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
