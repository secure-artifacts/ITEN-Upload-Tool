/**
 * 组内媒体查看 - 前端逻辑
 */

const bridge = window.bridge;

// 全局状态
let currentView = 'submit'; // 'submit' or 'browse'
let mediaRecords = [];
let currentFolderId = null;
let currentRecord = null;
let mediaHoverPreview = null;
let activeFileButton = null;
const previewState = {
    file: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    link: ''
};

// 性能优化：缓存和分页
const CACHE_KEY = 'media_records_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟缓存过期
const PAGE_SIZE = 20; // 每页显示数量
let currentPage = 0;
let filteredRecords = [];
let isLoadingMore = false;
let lastCacheTime = 0;
let initialPrefetchDone = false;
// 文件夹详情快照缓存（跨会话）
const FOLDER_SNAPSHOT_KEY = 'media_folder_snapshot_cache_v1';
const FOLDER_SNAPSHOT_TTL = 10 * 60 * 1000; // 10分钟
const FOLDER_SNAPSHOT_LIMIT = 30; // 最多缓存30个文件夹
const FOLDER_SNAPSHOT_MAX_FILES = 150; // 每个文件夹只存部分文件，避免 localStorage 过大
// 前端内存缓存（当前会话）
const folderDetailsFrontendCache = new Map();
// 预取队列
const folderPrefetchQueue = [];
const folderPrefetching = new Set();
let folderPrefetchWorkers = 0;
const FOLDER_PREFETCH_CONCURRENCY = 2;
// 渲染令牌，避免旧的渲染覆盖最新视图
let currentFolderRenderToken = 0;

// DOM 元素
const elements = {
    // 视图切换
    toggleViewBtn: document.getElementById('toggle-view-btn'),
    viewToggleText: document.getElementById('view-toggle-text'),
    submitView: document.getElementById('submit-view'),
    browseView: document.getElementById('browse-view'),
    refreshBtn: document.getElementById('refresh-btn'),

    // 提交表单
    submitForm: document.getElementById('submit-form'),
    submitterInput: document.getElementById('submit-submitter'),
    adminInput: document.getElementById('submit-admin'),
    folderLinkInput: document.getElementById('submit-folder-link'),
    contentTypeSelect: document.getElementById('submit-content-type'),
    notesTextarea: document.getElementById('submit-notes'),
    previewFolderBtn: document.getElementById('preview-folder-btn'),
    submitResult: document.getElementById('submit-result'),
    resultDetails: document.getElementById('result-details'),
    submitAnotherBtn: document.getElementById('submit-another-btn'),

    // 浏览视图
    searchInput: document.getElementById('search-input'),
    filterType: document.getElementById('filter-type'),
    sortBy: document.getElementById('sort-by'),
    mediaGrid: document.getElementById('media-grid'),
    emptyState: document.getElementById('empty-state'),
    loadingState: document.getElementById('loading-state'),

    // 文件夹模态窗口
    folderModal: document.getElementById('folder-modal'),
    modalFolderName: document.getElementById('modal-folder-name'),
    modalMeta: document.getElementById('modal-meta'),
    fileGrid: document.getElementById('file-grid'),
    modalEmpty: document.getElementById('modal-empty'),
    modalLoading: document.getElementById('modal-loading'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),
    openFolderBtn: document.getElementById('open-folder-btn'),
    previewPane: document.getElementById('preview-pane'),
    previewTitle: document.getElementById('preview-title'),
    previewMedia: document.getElementById('preview-media'),
    previewHint: document.getElementById('preview-hint'),
    previewOpenBtn: document.getElementById('preview-open-btn'),
    previewResetBtn: document.getElementById('preview-reset-btn'),
    previewStage: document.getElementById('preview-stage'),

    // 文件预览模态窗口
    filePreviewModal: document.getElementById('file-preview-modal'),
    previewContainer: document.getElementById('preview-container'),
    closePreviewBtn: document.getElementById('close-preview-btn'),

    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// 初始化
async function init() {
    // 检查配置
    const config = await bridge?.getMediaConfig?.();
    if (!config?.mediaSheetId) {
        showToast('请先在主应用设置中配置媒体记录表格 ID', 5000);
    }

    // 设置事件监听器
    setupEventListeners();

    // 加载用户信息
    await loadUserInfo();
}

// 设置事件监听器
function setupEventListeners() {
    // 视图切换
    elements.toggleViewBtn.addEventListener('click', toggleView);
    elements.refreshBtn.addEventListener('click', handleRefresh);

    // 提交表单
    elements.submitForm.addEventListener('submit', handleSubmit);
    elements.previewFolderBtn.addEventListener('click', handlePreviewFolder);
    elements.submitAnotherBtn.addEventListener('click', resetForm);

    // 浏览筛选
    elements.searchInput.addEventListener('input', debounce(filterRecords, 300));
    elements.filterType.addEventListener('change', filterRecords);
    elements.sortBy.addEventListener('change', filterRecords);

    // 模态窗口
    elements.closeModalBtn.addEventListener('click', closeFolderModal);
    elements.cancelModalBtn.addEventListener('click', closeFolderModal);
    elements.openFolderBtn.addEventListener('click', openFolderInDrive);
    elements.folderModal.querySelector('.modal-overlay').addEventListener('click', closeFolderModal);

    // 文件预览模态窗口
    elements.closePreviewBtn.addEventListener('click', closeFilePreview);
    elements.filePreviewModal.querySelector('.modal-overlay').addEventListener('click', closeFilePreview);

    // 右侧预览区域
    if (elements.previewResetBtn) {
        elements.previewResetBtn.addEventListener('click', resetPreviewTransform);
    }
    if (elements.previewOpenBtn) {
        elements.previewOpenBtn.addEventListener('click', () => {
            if (previewState.link) {
                openExternalLink(previewState.link);
            }
        });
    }
    bindPreviewInteractions();
}

// 加载用户信息
async function loadUserInfo() {
    try {
        const config = await bridge?.loadConfig?.();
        if (config?.config) {
            // 自动填充提交人（如果有存储的元数据）
            const submitterName = document.getElementById('meta-submit')?.value || '';
            if (submitterName) {
                elements.submitterInput.value = submitterName;
            }
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
    }
}

// 视图切换
function switchView(viewName) {
    currentView = viewName;

    if (viewName === 'submit') {
        elements.submitView.classList.add('active');
        elements.browseView.classList.remove('active');
        elements.viewToggleText.textContent = '切换到浏览';
    } else {
        elements.submitView.classList.remove('active');
        elements.browseView.classList.add('active');
        elements.viewToggleText.textContent = '切换到提交';
        loadMediaRecords();
    }
}

function toggleView() {
    switchView(currentView === 'submit' ? 'browse' : 'submit');
}

// 刷新处理
async function handleRefresh() {
    if (currentView === 'browse') {
        await loadMediaRecords(true); // 强制刷新，跳过缓存
        showToast('已刷新');
    } else {
        resetForm();
        showToast('表单已重置');
    }
}

// 处理表单提交
async function handleSubmit(e) {
    e.preventDefault();

    const record = {
        submitter: elements.submitterInput.value.trim(),
        admin: elements.adminInput.value.trim(),
        folderLink: elements.folderLinkInput.value.trim(),
        contentType: elements.contentTypeSelect.value,
        notes: elements.notesTextarea.value.trim()
    };

    // 验证
    if (!record.submitter || !record.admin || !record.folderLink || !record.contentType) {
        showToast('请填写所有必填项', 3000);
        return;
    }

    // 禁用提交按钮
    const submitBtn = elements.submitForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div> 提交中...';

    try {
        const result = await bridge?.submitMediaRecord?.(record);

        if (result.success) {
            // 显示成功结果
            elements.submitForm.style.display = 'none';
            elements.submitResult.hidden = false;

            elements.resultDetails.innerHTML = `
        <p>文件夹包含 <strong>${result.fileCount}</strong> 个媒体文件</p>
        <p>提交时间：${result.timestamp}</p>
      `;

            showToast('提交成功！');
        }
    } catch (error) {
        console.error('提交失败:', error);
        showToast(error.message || '提交失败，请检查配置和网络', 5000);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// 预览文件夹
async function handlePreviewFolder() {
    const folderLink = elements.folderLinkInput.value.trim();

    if (!folderLink) {
        showToast('请先填写文件夹链接', 3000);
        return;
    }

    try {
        // 提取文件夹 ID
        const folderId = await bridge?.extractFolderId?.(folderLink);

        if (!folderId) {
            showToast('无效的文件夹链接', 3000);
            return;
        }

        // 打开模态窗口预览
        currentFolderId = folderId;
        currentRecord = {
            folderLink,
            submitter: elements.submitterInput.value.trim(),
            admin: elements.adminInput.value.trim(),
            contentType: elements.contentTypeSelect.value
        };

        showFolderModal();
    } catch (error) {
        console.error('提取文件夹 ID 失败:', error);
        showToast('无效的文件夹链接', 3000);
    }
}

// 重置表单
function resetForm() {
    elements.submitForm.reset();
    elements.submitForm.style.display = 'flex';
    elements.submitResult.hidden = true;
    loadUserInfo(); // 重新加载用户信息
}

// 从本地缓存加载媒体记录
function loadCachedRecords() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
                lastCacheTime = timestamp;
                return data;
            }
        }
    } catch (e) {
        console.warn('读取缓存失败:', e);
    }
    return null;
}

// 保存到本地缓存
function saveCacheRecords(records) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: records,
            timestamp: Date.now()
        }));
        lastCacheTime = Date.now();
    } catch (e) {
        console.warn('保存缓存失败:', e);
    }
}

// ========== 文件夹快照缓存（跨会话） ==========
function loadFolderSnapshotStore() {
    try {
        const raw = localStorage.getItem(FOLDER_SNAPSHOT_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('读取文件夹快照缓存失败', error);
        return {};
    }
}

function persistFolderSnapshotStore(store) {
    try {
        localStorage.setItem(FOLDER_SNAPSHOT_KEY, JSON.stringify(store));
    } catch (error) {
        console.warn('写入文件夹快照缓存失败', error);
    }
}

function getFolderSnapshot(folderId) {
    if (!folderId) return null;
    const store = loadFolderSnapshotStore();
    const entry = store[folderId];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > FOLDER_SNAPSHOT_TTL) {
        delete store[folderId];
        persistFolderSnapshotStore(store);
        return null;
    }
    return entry.data || null;
}

function saveFolderSnapshot(folderId, details) {
    if (!folderId || !details || !Array.isArray(details.files)) return;
    const store = loadFolderSnapshotStore();
    // 裁剪文件列表，避免 localStorage 过大
    const trimmedFiles = details.files.slice(0, FOLDER_SNAPSHOT_MAX_FILES).map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        thumbnailLink: file.thumbnailLink,
        webViewLink: file.webViewLink
    }));
    store[folderId] = {
        timestamp: Date.now(),
        data: {
            folderId,
            folderName: details.folderName || '',
            fileCount: details.fileCount || trimmedFiles.length,
            files: trimmedFiles
        }
    };
    // 控制缓存数量
    const keys = Object.keys(store);
    if (keys.length > FOLDER_SNAPSHOT_LIMIT) {
        const sorted = keys
            .map(key => ({ key, ts: store[key]?.timestamp || 0 }))
            .sort((a, b) => a.ts - b.ts);
        const toDelete = sorted.slice(0, keys.length - FOLDER_SNAPSHOT_LIMIT);
        toDelete.forEach(item => delete store[item.key]);
    }
    persistFolderSnapshotStore(store);
}

// ========== 前端内存缓存 ==========
function getFrontendFolderCache(folderId) {
    if (!folderId) return null;
    const cached = folderDetailsFrontendCache.get(folderId);
    if (cached && Date.now() - cached.timestamp < FOLDER_SNAPSHOT_TTL) {
        return cached.data;
    }
    return null;
}

function setFrontendFolderCache(folderId, details) {
    if (!folderId || !details) return;
    folderDetailsFrontendCache.set(folderId, {
        data: details,
        timestamp: Date.now()
    });
}

// ========== 预取队列 ==========
function enqueueFolderPrefetch(folderId) {
    if (!folderId) return;
    if (folderPrefetching.has(folderId)) return;
    const cached = getFrontendFolderCache(folderId) || getMemoryFolderCache(folderId) || getFolderSnapshot(folderId);
    if (cached) return; // 已有缓存不需要预取
    folderPrefetching.add(folderId);
    folderPrefetchQueue.push(folderId);
    processFolderPrefetchQueue();
}

async function processFolderPrefetchQueue() {
    if (folderPrefetchWorkers >= FOLDER_PREFETCH_CONCURRENCY) return;
    const folderId = folderPrefetchQueue.shift();
    if (!folderId) return;
    folderPrefetchWorkers++;
    try {
        const details = await bridge?.getMediaFolderDetails?.(folderId, { recursive: true });
        if (details) {
            setMemoryFolderCache(folderId, details);
            setFrontendFolderCache(folderId, details);
            saveFolderSnapshot(folderId, details);
        }
    } catch (error) {
        console.warn('预取文件夹失败:', folderId, error?.message || error);
    } finally {
        folderPrefetching.delete(folderId);
        folderPrefetchWorkers--;
        if (folderPrefetchQueue.length > 0) {
            processFolderPrefetchQueue();
        }
    }
}

// 加载媒体记录（带缓存）
async function loadMediaRecords(forceRefresh = false) {
    initialPrefetchDone = false;
    elements.loadingState.hidden = false;
    elements.emptyState.hidden = true;
    elements.mediaGrid.innerHTML = '';
    currentPage = 0;

    // 先尝试从缓存加载
    if (!forceRefresh) {
        const cached = loadCachedRecords();
        if (cached && cached.length > 0) {
            mediaRecords = cached;
            elements.loadingState.hidden = true;
            filterRecords();
            // 后台静默刷新
            refreshRecordsInBackground();
            return;
        }
    }

    try {
        const records = await bridge?.getMediaRecords?.();
        mediaRecords = records || [];
        saveCacheRecords(mediaRecords);

        elements.loadingState.hidden = true;

        if (mediaRecords.length === 0) {
            elements.emptyState.hidden = false;
        } else {
            filterRecords();
        }
    } catch (error) {
        console.error('加载媒体记录失败:', error);
        elements.loadingState.hidden = true;
        elements.emptyState.hidden = false;
        showToast('加载失败：' + error.message, 5000);
    }
}

// 后台静默刷新
async function refreshRecordsInBackground() {
    try {
        const records = await bridge?.getMediaRecords?.();
        if (records && records.length > 0) {
            const hasChanges = JSON.stringify(records) !== JSON.stringify(mediaRecords);
            if (hasChanges) {
                mediaRecords = records;
                saveCacheRecords(mediaRecords);
                filterRecords();
                showToast('数据已更新', 1500);
            }
        }
    } catch (error) {
        console.warn('后台刷新失败:', error);
    }
}

// 筛选和排序记录
function filterRecords() {
    const search = elements.searchInput.value.trim().toLowerCase();
    const typeFilter = elements.filterType.value;
    const sortBy = elements.sortBy.value;

    // 先筛选
    filteredRecords = mediaRecords.filter(record => {
        // 类型筛选
        if (typeFilter && record.contentType !== typeFilter) {
            return false;
        }

        // 搜索筛选
        if (search) {
            const searchableText = [
                record.submitter,
                record.admin,
                record.contentType,
                record.notes
            ].join(' ').toLowerCase();

            if (!searchableText.includes(search)) {
                return false;
            }
        }

        return true;
    });

    // 排序
    if (sortBy === 'time-desc') {
        filteredRecords.sort((a, b) => b.submitTime.localeCompare(a.submitTime));
    } else if (sortBy === 'time-asc') {
        filteredRecords.sort((a, b) => a.submitTime.localeCompare(b.submitTime));
    } else if (sortBy === 'type') {
        filteredRecords.sort((a, b) => a.contentType.localeCompare(b.contentType));
    }

    // 重置分页并渲染第一页
    currentPage = 0;
    elements.mediaGrid.innerHTML = '';
    renderNextPage();

    // 首屏预取前几个文件夹，加速首次打开
    if (!initialPrefetchDone && filteredRecords.length > 0) {
        const PREFETCH_INITIAL_COUNT = 5;
        const toPrefetch = filteredRecords.slice(0, PREFETCH_INITIAL_COUNT);
        toPrefetch.forEach(rec => enqueueFolderPrefetch(rec.folderId));
        initialPrefetchDone = true;
    }
}

// 渲染下一页（分页加载）
function renderNextPage() {
    if (isLoadingMore) return;

    const startIdx = currentPage * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, filteredRecords.length);

    if (startIdx >= filteredRecords.length) {
        if (filteredRecords.length === 0) {
            elements.emptyState.hidden = false;
        }
        return;
    }

    elements.emptyState.hidden = true;
    isLoadingMore = true;

    // 使用 DocumentFragment 批量添加DOM
    const fragment = document.createDocumentFragment();
    const pageRecords = filteredRecords.slice(startIdx, endIdx);

    pageRecords.forEach(record => {
        const card = createMediaCard(record);
        observeCardPrefetch(card, record.folderId);
        fragment.appendChild(card);
    });

    elements.mediaGrid.appendChild(fragment);
    currentPage++;
    isLoadingMore = false;

    // 设置无限滚动观察器
    setupScrollObserver();
}

// 滚动观察器（无限滚动）
let scrollObserver = null;
function setupScrollObserver() {
    if (scrollObserver) {
        scrollObserver.disconnect();
    }

    // 检查是否还有更多数据
    if (currentPage * PAGE_SIZE >= filteredRecords.length) {
        return;
    }

    // 获取最后一个卡片作为观察目标
    const cards = elements.mediaGrid.querySelectorAll('.media-card');
    const lastCard = cards[cards.length - 1];
    if (!lastCard) return;

    scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoadingMore) {
                renderNextPage();
            }
        });
    }, {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    });

    scrollObserver.observe(lastCard);
}

// 卡片预取观察器
let cardPrefetchObserver = null;
function observeCardPrefetch(card, folderId) {
    if (!card || !folderId) return;
    if (!cardPrefetchObserver) {
        cardPrefetchObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const targetId = entry.target.dataset.folderId;
                    if (targetId) {
                        enqueueFolderPrefetch(targetId);
                    }
                    cardPrefetchObserver.unobserve(entry.target);
                }
            });
        }, {
            root: null,
            rootMargin: '200px',
            threshold: 0.01
        });
    }
    card.dataset.folderId = folderId;
    cardPrefetchObserver.observe(card);
}

// 渲染媒体卡片（保留兼容性但使用新的分页逻辑）
function renderMediaCards(records) {
    filteredRecords = records;
    currentPage = 0;
    elements.mediaGrid.innerHTML = '';
    renderNextPage();
}

// 创建媒体卡片
function createMediaCard(record) {
    const card = document.createElement('div');
    card.className = 'media-card';

    // 根据内容类型选择图标
    const typeIcons = {
        'reels': '🎬',
        'sora': '🎨',
        '主耶稣图': '✨',
        '其他': '📁'
    };
    const icon = typeIcons[record.contentType] || '📁';

    card.innerHTML = `
        <div class="card-thumbnail">
            ${icon}
            <div class="card-type-badge">${record.contentType}</div>
        </div>
        <div class="card-body">
            <div class="card-title">
                <span>${record.submitter} 的提交</span>
                <span class="card-count">${record.fileCount} 个文件</span>
            </div>
            <div class="card-info">
                <div class="card-info-item">管理员：${record.admin}</div>
                ${record.notes ? `<div class="card-info-item">备注：${record.notes}</div>` : ''}
            </div>
            <div class="card-footer">
                <span class="card-time">${formatTime(record.submitTime)}</span>
                <button class="cache-btn" data-folder-id="${record.folderId}">
                    <span class="cache-btn-icon">↓</span>
                    <span class="cache-btn-text">缓存</span>
                </button>
            </div>
        </div>
    `;

    // 缓存按钮点击事件
    const cacheBtn = card.querySelector('.cache-btn');
    cacheBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleCacheFolder(record.folderId, cacheBtn);
    });

    // 卡片点击事件（打开文件夹）
    card.addEventListener('click', (e) => {
        if (e.target.closest('.cache-btn')) return;
        currentFolderId = record.folderId;
        currentRecord = record;
        showFolderModal();
    });

    return card;
}

// 处理文件夹缓存
async function handleCacheFolder(folderId, btnElement) {
    if (btnElement.disabled) return;

    btnElement.disabled = true;
    btnElement.classList.add('loading');
    btnElement.innerHTML = '<span class="cache-btn-icon">⏳</span><span class="cache-btn-text">缓存中</span>';

    try {
        const details = await bridge?.getMediaFolderDetails?.(folderId, { recursive: true });
        if (details) {
            setMemoryFolderCache(folderId, details);
            setFrontendFolderCache(folderId, details);
            saveFolderSnapshot(folderId, details);
        }

        btnElement.classList.remove('loading');
        btnElement.classList.add('done');
        btnElement.innerHTML = '<span class="cache-btn-icon">✓</span><span class="cache-btn-text">已缓存</span>';

        showToast(`已缓存 ${details?.fileCount || 0} 个文件`);
    } catch (error) {
        console.error('缓存失败:', error);
        btnElement.disabled = false;
        btnElement.classList.remove('loading');
        btnElement.innerHTML = '<span class="cache-btn-icon">↓</span><span class="cache-btn-text">缓存</span>';
        showToast('缓存失败: ' + error.message, 3000);
    }
}

// 文件夹详情缓存
const folderDetailsCache = new Map();
const FOLDER_CACHE_EXPIRY = 10 * 60 * 1000; // 10分钟

function getMemoryFolderCache(folderId) {
    if (!folderId) return null;
    const cached = folderDetailsCache.get(folderId);
    if (cached && Date.now() - cached.timestamp < FOLDER_CACHE_EXPIRY) {
        return cached.data;
    }
    return null;
}

function setMemoryFolderCache(folderId, details) {
    if (!folderId || !details) return;
    folderDetailsCache.set(folderId, {
        data: details,
        timestamp: Date.now()
    });
}

// 显示文件夹模态窗口
async function showFolderModal() {
    const renderToken = ++currentFolderRenderToken;
    elements.folderModal.hidden = false;
    elements.modalLoading.hidden = false;
    elements.fileGrid.innerHTML = '';
    elements.modalEmpty.hidden = true;
    const preferredFileId = previewState.file?.id || null;

    // 设置标题和元数据
    if (currentRecord) {
        elements.modalFolderName.textContent = `${currentRecord.contentType} - ${currentRecord.submitter}`;
        elements.modalMeta.textContent = `管理员：${currentRecord.admin}${currentRecord.submitTime ? ' | ' + formatTime(currentRecord.submitTime) : ''}`;
    } else {
        elements.modalFolderName.textContent = '文件夹预览';
        elements.modalMeta.textContent = '';
    }

    // 先用前端/本地缓存快速显示
    const cachedDetails = getFrontendFolderCache(currentFolderId) || getMemoryFolderCache(currentFolderId) || getFolderSnapshot(currentFolderId);
    if (cachedDetails && Array.isArray(cachedDetails.files) && cachedDetails.files.length > 0) {
        elements.modalLoading.hidden = true;
        if (cachedDetails.folderName) {
            elements.modalFolderName.textContent = `${cachedDetails.folderName}（${elements.modalFolderName.textContent}）`;
        }
        renderFolderFiles(cachedDetails.files, renderToken, preferredFileId);
    }

    // 后台加载最新数据
    try {
        const details = await bridge?.getMediaFolderDetails?.(currentFolderId, { recursive: true });

        // 缓存结果
        setMemoryFolderCache(currentFolderId, details);
        setFrontendFolderCache(currentFolderId, details);
        saveFolderSnapshot(currentFolderId, details);

        if (renderToken !== currentFolderRenderToken) {
            return; // 用户切换了文件夹
        }

        elements.modalLoading.hidden = true;

        if (details.folderName) {
            elements.modalFolderName.textContent = `${details.folderName}（${elements.modalFolderName.textContent}）`;
        }

        renderFolderFiles(details.files || [], renderToken, preferredFileId);
    } catch (error) {
        console.error('加载文件夹详情失败:', error);
        elements.modalLoading.hidden = true;
        elements.modalEmpty.hidden = false;
        showToast('加载失败：' + error.message, 5000);
    }
}

// 分批渲染文件网格，支持首屏立即展示
function renderFolderFiles(files = [], renderToken, preferredFileId = null) {
    if (renderToken !== currentFolderRenderToken) return;

    elements.fileGrid.innerHTML = '';

    if (!files || files.length === 0) {
        elements.modalEmpty.hidden = false;
        setActiveFile(null, null);
        return;
    }

    elements.modalEmpty.hidden = true;
    const BATCH_SIZE = 20;
    let currentBatch = 0;
    const targetFileId = preferredFileId || previewState.file?.id || files[0]?.id || null;

    function renderBatch() {
        if (renderToken !== currentFolderRenderToken) return;
        const start = currentBatch * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, files.length);

        if (start >= files.length) return;

        const fragment = document.createDocumentFragment();
        for (let i = start; i < end; i++) {
            const fileItem = createFileItem(files[i]);
            fragment.appendChild(fileItem);
        }
        elements.fileGrid.appendChild(fragment);

        // 第一批渲染完成后设置选中状态和预览处理
        if (currentBatch === 0 && files.length > 0) {
            let targetButton = null;
            if (targetFileId) {
                targetButton = elements.fileGrid.querySelector(`.media-file-thumbnail-btn[data-file-id="${targetFileId}"]`);
            }
            if (!targetButton) {
                targetButton = elements.fileGrid.querySelector('.media-file-thumbnail-btn');
            }
            const targetFile = files.find(f => f.id === targetFileId) || files[0];
            setActiveFile(targetFile, targetButton);
        }

        currentBatch++;

        // 继续渲染下一批
        if (end < files.length) {
            requestAnimationFrame(renderBatch);
        } else {
            // 所有批次渲染完成后设置预览处理
            setupMediaPreviewHandlers(elements.fileGrid);
        }
    }

    renderBatch();
}

// 创建文件项
function createFileItem(file) {
    const item = document.createElement('div');
    item.className = 'media-file-grid-item';

    const openUrl = file.webViewLink || file.webContentLink || (file.id ? `https://drive.google.com/file/d/${file.id}/view` : '');
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.className = 'media-file-thumbnail-btn';
    thumbBtn.dataset.filename = file.name || '';
    thumbBtn.dataset.type = file.type || '';
    thumbBtn.dataset.fileId = file.id || '';
    if (openUrl) {
        thumbBtn.dataset.openUrl = openUrl;
    }

    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'media-file-thumbnail';
    thumbWrapper.dataset.type = file.type || 'other'; // 用于CSS图标选择

    const safeName = file.name || '未命名文件';
    const ext = getFileExtension(file.name);
    const badgeText = (ext || (file.type === 'video' ? 'VIDEO' : 'FILE')).toUpperCase();
    const isImage = file.type === 'image';
    const isVideo = file.type === 'video';

    // 创建回退badge的辅助函数
    const createFallbackBadge = () => {
        const badge = document.createElement('div');
        badge.className = 'media-file-badge';
        badge.textContent = badgeText;
        return badge;
    };

    // 创建加载中占位符
    const createLoadingPlaceholder = () => {
        const placeholder = document.createElement('div');
        placeholder.className = 'media-file-loading';
        placeholder.innerHTML = '<div class="spinner" style="width:24px;height:24px;border-width:2px;"></div>';
        return placeholder;
    };

    // 异步加载缩略图（通过后端API）
    const loadThumbnail = async () => {
        if (!file.id) {
            thumbWrapper.appendChild(createFallbackBadge());
            return;
        }

        // 先显示加载占位符
        const loadingEl = createLoadingPlaceholder();
        thumbWrapper.appendChild(loadingEl);

        try {
            // 直接检查是否有缓存，没有就立即下载（移除等待延迟）
            let result = await bridge?.getThumbnailCached?.({ fileId: file.id, size: 200 });

            // 如果没有缓存，直接请求下载
            if (!result?.path) {
                result = await bridge?.cacheThumbnail?.({ fileId: file.id, size: 200 });
            }

            // 移除加载占位符
            if (loadingEl.parentNode) {
                loadingEl.remove();
            }

            if (result?.path) {
                // 使用本地文件路径
                const img = document.createElement('img');
                img.src = `file://${result.path}`;
                img.alt = safeName;
                img.onerror = () => {
                    img.style.display = 'none';
                    if (!thumbWrapper.querySelector('.media-file-badge')) {
                        thumbWrapper.appendChild(createFallbackBadge());
                    }
                };
                thumbWrapper.appendChild(img);
            } else {
                // 没有缩略图可用
                thumbWrapper.appendChild(createFallbackBadge());
            }
        } catch (error) {
            console.warn('加载缩略图失败:', file.name, error);
            // 移除加载占位符
            if (loadingEl.parentNode) {
                loadingEl.remove();
            }
            thumbWrapper.appendChild(createFallbackBadge());
        }
    };

    // 根据文件类型处理
    if (isImage || isVideo) {
        // 异步加载缩略图
        loadThumbnail();

        // 视频添加播放图标覆盖层
        if (isVideo) {
            const overlay = document.createElement('div');
            overlay.className = 'media-video-overlay';
            overlay.textContent = '▶';
            thumbWrapper.appendChild(overlay);
        }
    } else {
        thumbWrapper.appendChild(createFallbackBadge());
    }

    thumbBtn.appendChild(thumbWrapper);

    thumbBtn.addEventListener('click', () => {
        setActiveFile(file, thumbBtn);
    });

    thumbBtn.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setActiveFile(file, thumbBtn);
        }
    });

    thumbBtn.addEventListener('dblclick', (event) => {
        event.preventDefault();
        if (openUrl) {
            openExternalLink(openUrl);
        } else {
            setActiveFile(file, thumbBtn);
        }
    });

    const nameEl = document.createElement('div');
    nameEl.className = 'media-file-name';
    nameEl.title = safeName;
    nameEl.textContent = safeName;

    item.appendChild(thumbBtn);
    item.appendChild(nameEl);
    return item;
}

// 设置缩略图悬停预览（与审核模块一致的交互）
function setupMediaPreviewHandlers(container) {
    if (!container) return;

    if (!mediaHoverPreview) {
        mediaHoverPreview = document.createElement('div');
        mediaHoverPreview.id = 'media-file-preview';
        mediaHoverPreview.className = 'media-hover-preview';
        mediaHoverPreview.innerHTML = `
      <div class="media-preview-image"></div>
      <div class="media-preview-info">
        <div class="media-preview-name"></div>
        <div class="media-preview-hint"></div>
      </div>
    `;
        document.body.appendChild(mediaHoverPreview);
    }

    const allButtons = container.querySelectorAll('.media-file-thumbnail-btn');

    allButtons.forEach((btn) => {
        const thumbnail = btn.querySelector('.media-file-thumbnail');
        if (!thumbnail) return;

        const fileLink = btn.dataset.openUrl || '';
        const fileName = btn.dataset.filename || btn.parentElement?.querySelector('.media-file-name')?.textContent || '';
        const fileType = btn.dataset.type || '';

        // 允许键盘直接打开文件
        btn.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (fileLink) {
                    openExternalLink(fileLink);
                }
            }
        });

        btn.addEventListener('mouseenter', () => {
            const thumbnailImg = thumbnail.querySelector('img');
            const thumbnailVideo = thumbnail.querySelector('video');

            const globalImage = mediaHoverPreview.querySelector('.media-preview-image');
            const globalName = mediaHoverPreview.querySelector('.media-preview-name');
            const globalHint = mediaHoverPreview.querySelector('.media-preview-hint');

            const lowerFileName = (fileName || '').toLowerCase();
            const isVideoFile =
                fileType === 'video' ||
                ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv'].some((ext) =>
                    lowerFileName.endsWith(ext)
                );
            const isCloudFile = fileLink && (() => { try { const h = new URL(fileLink).hostname; return h.endsWith('.google.com') || h.endsWith('.googleapis.com'); } catch (e) { return false; } })();
            const safePreviewName = escapeHtml(fileName);

            // 设置预览内容
            if (thumbnailVideo) {
                const videoSrc = thumbnailVideo.src;
                const isCloudVideo = (() => { try { const h = new URL(videoSrc).hostname; return h.endsWith('.google.com') || h.endsWith('.googleapis.com'); } catch (e) { return false; } })();

                if (isCloudVideo) {
                    const posterSrc = thumbnailVideo.poster || thumbnailImg?.src;
                    if (posterSrc) {
                        const fullPoster = enhancePreviewSrc(posterSrc, 800);
                        globalImage.innerHTML = `
                <div class="cloud-video-preview">
                  <img src="${fullPoster}" alt="${safePreviewName}" />
                  <div class="cloud-video-overlay">
                    <div class="cloud-video-icon">▶</div>
                    <div class="cloud-video-hint">双击在浏览器中查看完整视频</div>
                  </div>
                </div>
              `;
                    } else {
                        globalImage.innerHTML = `
                <div class="cloud-video-preview no-thumbnail">
                  <div class="cloud-video-icon">▶</div>
                  <div class="cloud-video-hint">双击在浏览器中查看完整视频</div>
                </div>
              `;
                    }
                } else {
                    globalImage.innerHTML = `<video src="${videoSrc}" controls muted autoplay loop playsinline preload="auto"></video>`;
                }
            } else if (thumbnailImg && isVideoFile && isCloudFile) {
                const fullSrc = enhancePreviewSrc(thumbnailImg.src, 800);
                globalImage.innerHTML = `
            <div class="cloud-video-preview">
              <img src="${fullSrc}" alt="${safePreviewName}" />
              <div class="cloud-video-overlay">
                <div class="cloud-video-icon">▶</div>
                <div class="cloud-video-hint">双击在浏览器中查看完整视频</div>
              </div>
            </div>
          `;
            } else if (thumbnailImg) {
                const fullSrc = enhancePreviewSrc(thumbnailImg.src, 800);
                globalImage.innerHTML = `<img src="${fullSrc}" alt="${safePreviewName}" />`;
            } else {
                globalImage.innerHTML = `<div class="media-preview-placeholder">${isVideoFile ? 'VIDEO' : 'FILE'}</div>`;
            }

            if (globalName) {
                globalName.textContent = fileName ? `文件：${fileName}` : '文件预览';
            }
            if (globalHint) {
                globalHint.textContent = fileLink ? '双击打开云端文件' : '';
            }
            mediaHoverPreview.dataset.openUrl = fileLink || '';

            // 计算位置，尽量避免遮挡
            const rect = btn.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const windowWidth = window.innerWidth;
            const spaceAbove = rect.top;
            const spaceBelow = windowHeight - rect.bottom;
            const horizontalMargin = 20;
            const verticalMargin = 5;
            const infoAreaHeight = 60;
            const maxWidth = Math.min(800, windowWidth - horizontalMargin * 2);
            let maxHeight;
            let previewTop;
            let transformValue;
            let showAbove;

            if (spaceAbove > spaceBelow && spaceAbove > 200) {
                showAbove = true;
                const availableHeight = (spaceAbove - verticalMargin) * 0.9;
                maxHeight = Math.min(800, Math.max(250 + infoAreaHeight, availableHeight));
                previewTop = rect.top - verticalMargin;
                transformValue = 'translate(-50%, -100%)';
            } else {
                showAbove = false;
                const availableHeight = (spaceBelow - verticalMargin) * 0.9;
                maxHeight = Math.min(800, Math.max(250 + infoAreaHeight, availableHeight));
                previewTop = rect.bottom + verticalMargin;
                transformValue = 'translate(-50%, 0)';
            }

            let previewLeft = rect.left + rect.width / 2;
            const halfPreviewWidth = maxWidth / 2;
            if (previewLeft - halfPreviewWidth < horizontalMargin) {
                previewLeft = halfPreviewWidth + horizontalMargin;
            } else if (previewLeft + halfPreviewWidth > windowWidth - horizontalMargin) {
                previewLeft = windowWidth - halfPreviewWidth - horizontalMargin;
            }

            mediaHoverPreview.style.top = `${previewTop}px`;
            mediaHoverPreview.style.left = `${previewLeft}px`;
            mediaHoverPreview.style.transform = transformValue;
            mediaHoverPreview.style.maxWidth = `${maxWidth}px`;
            mediaHoverPreview.style.maxHeight = `${maxHeight}px`;

            const imageHeight = maxHeight - infoAreaHeight - 10;
            const globalImageArea = mediaHoverPreview.querySelector('.media-preview-image');
            if (globalImageArea) {
                globalImageArea.style.height = `${imageHeight}px`;
                globalImageArea.style.maxHeight = `${imageHeight}px`;
            }

            if (showAbove) {
                mediaHoverPreview.setAttribute('data-position', 'above');
            } else {
                mediaHoverPreview.setAttribute('data-position', 'below');
            }

            setTimeout(() => {
                if (btn.matches(':hover')) {
                    mediaHoverPreview.classList.add('visible');
                }
            }, 400);
        });

        btn.addEventListener('mouseleave', () => {
            setTimeout(() => {
                if (!btn.matches(':hover') && !mediaHoverPreview.matches(':hover')) {
                    mediaHoverPreview.classList.remove('visible');
                }
            }, 100);
        });
    });

    if (mediaHoverPreview) {
        mediaHoverPreview.addEventListener('mouseenter', () => {
            mediaHoverPreview.classList.add('visible');
        });

        mediaHoverPreview.addEventListener('mouseleave', () => {
            setTimeout(() => {
                const anyItemHovered = container.querySelector('.media-file-thumbnail-btn:hover');
                if (!anyItemHovered && !mediaHoverPreview.matches(':hover')) {
                    mediaHoverPreview.classList.remove('visible');
                }
            }, 100);
        });

        if (!mediaHoverPreview.dataset.dblclickBound) {
            mediaHoverPreview.addEventListener('dblclick', (event) => {
                const url = mediaHoverPreview.dataset.openUrl;
                if (!url) return;
                event.preventDefault();
                openExternalLink(url);
            });
            mediaHoverPreview.dataset.dblclickBound = 'true';
        }
    }
}

// 设置当前选中文件并更新右侧预览
function setActiveFile(file, button) {
    if (activeFileButton) {
        activeFileButton.closest('.media-file-grid-item')?.classList.remove('selected');
    }
    activeFileButton = button || null;
    if (activeFileButton) {
        activeFileButton.closest('.media-file-grid-item')?.classList.add('selected');
    }
    updatePreviewPane(file);
}

function getFileOpenLink(file) {
    if (!file) return '';
    return file.webViewLink || file.webContentLink || (file.id ? `https://drive.google.com/file/d/${file.id}/view` : '');
}

function updatePreviewPane(file) {
    previewState.file = file || null;
    previewState.scale = 1;
    previewState.offsetX = 0;
    previewState.offsetY = 0;
    previewState.link = getFileOpenLink(file);

    if (!elements.previewMedia || !elements.previewTitle || !elements.previewHint) return;

    const name = file?.name || '选择左侧文件预览';
    elements.previewTitle.textContent = name;
    elements.previewMedia.innerHTML = '';

    if (!file) {
        elements.previewHint.textContent = '选择左侧文件查看大图，支持滚轮放大拖拽';
        if (elements.previewOpenBtn) {
            elements.previewOpenBtn.disabled = true;
        }
        return;
    }

    if (file.type === 'image') {
        const img = document.createElement('img');
        img.src = `https://drive.google.com/uc?id=${file.id}&export=download`;
        img.alt = name;
        img.className = 'preview-img';
        elements.previewMedia.appendChild(img);
        elements.previewHint.textContent = '滚轮放大，按住拖拽平移，双击或重置按钮复位';
        applyPreviewTransform();
    } else if (file.type === 'video') {
        const video = document.createElement('video');
        video.src = `https://drive.google.com/uc?id=${file.id}&export=download`;
        video.controls = true;
        video.autoplay = true;
        video.className = 'preview-video';
        elements.previewMedia.appendChild(video);
        elements.previewHint.textContent = '可直接播放，双击在浏览器中打开';
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'preview-placeholder';
        placeholder.textContent = '暂不支持的文件类型';
        elements.previewMedia.appendChild(placeholder);
        elements.previewHint.textContent = '';
    }

    if (elements.previewOpenBtn) {
        if (previewState.link) {
            elements.previewOpenBtn.disabled = false;
        } else {
            elements.previewOpenBtn.disabled = true;
        }
    }
}

function applyPreviewTransform() {
    const img = elements.previewMedia?.querySelector('.preview-img');
    if (!img) return;
    img.style.transform = `translate(${previewState.offsetX}px, ${previewState.offsetY}px) scale(${previewState.scale})`;
}

function resetPreviewTransform() {
    previewState.scale = 1;
    previewState.offsetX = 0;
    previewState.offsetY = 0;
    applyPreviewTransform();
}

// 关闭文件夹模态窗口
function closeFolderModal() {
    currentFolderRenderToken++;
    elements.folderModal.hidden = true;
    elements.fileGrid.innerHTML = '';
    hideMediaHoverPreview();
    setActiveFile(null, null);
    currentFolderId = null;
}

// 关闭文件预览（保留旧模态备用）
function closeFilePreview() {
    elements.filePreviewModal.hidden = true;
    elements.previewContainer.innerHTML = '';
}

// 在 Google Drive 中打开文件夹
async function openFolderInDrive() {
    if (!currentFolderId) return;

    try {
        await bridge?.openDriveFolder?.(currentFolderId);
    } catch (error) {
        console.error('打开文件夹失败:', error);
        showToast('打开失败', 3000);
    }
}

// 在浏览器中打开外链
function openExternalLink(url) {
    if (!url) return;

    if (window.bridge?.openExternal) {
        window.bridge.openExternal(url);
        return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
}

// 隐藏全局悬停预览
function hideMediaHoverPreview() {
    if (mediaHoverPreview) {
        mediaHoverPreview.classList.remove('visible');
    }
}

// 预览区域交互（滚轮缩放、拖拽）
function bindPreviewInteractions() {
    const stage = elements.previewStage;
    if (!stage) return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    stage.addEventListener('wheel', (event) => {
        const img = elements.previewMedia?.querySelector('.preview-img');
        if (!img) return;
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.1 : 0.1;
        previewState.scale = clamp(previewState.scale + delta, 0.5, 4);
        applyPreviewTransform();
    });

    stage.addEventListener('mousedown', (event) => {
        const img = elements.previewMedia?.querySelector('.preview-img');
        if (!img) return;
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        stage.classList.add('dragging');
    });

    window.addEventListener('mousemove', (event) => {
        if (!dragging) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        previewState.offsetX += dx;
        previewState.offsetY += dy;
        lastX = event.clientX;
        lastY = event.clientY;
        applyPreviewTransform();
    });

    window.addEventListener('mouseup', () => {
        dragging = false;
        stage.classList.remove('dragging');
    });

    stage.addEventListener('dblclick', () => {
        resetPreviewTransform();
    });
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// 放大缩略图尺寸
function enhancePreviewSrc(src, size = 800) {
    if (!src) return '';
    return src.replace(/=s\d+/i, `=w${size}`).replace(/=w\d+/i, `=w${size}`).replace(/sz=w\d+/i, `sz=w${size}`);
}

// 构建缩略图 URL（带尺寸）
function buildThumbnailUrl(file, size = 400) {
    if (!file) return '';
    if (file.thumbnailLink) {
        return enhancePreviewSrc(file.thumbnailLink, size);
    }
    if (file.id) {
        return `https://drive.google.com/thumbnail?id=${file.id}&sz=w${size}`;
    }
    return '';
}

// 获取文件扩展名
function getFileExtension(name = '') {
    const parts = name.split('.');
    if (parts.length <= 1) return '';
    return parts.pop().toLowerCase();
}

// 简单转义，避免文件名破坏预览模板
function escapeHtml(text = '') {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 显示 Toast 提示
function showToast(message, duration = 2000) {
    elements.toastMessage.textContent = message;
    elements.toast.hidden = false;

    setTimeout(() => {
        elements.toast.hidden = true;
    }, duration);
}

// 格式化时间
function formatTime(timeStr) {
    if (!timeStr) return '';

    try {
        const date = new Date(timeStr);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes} 分钟前`;
        if (hours < 24) return `${hours} 小时前`;
        if (days < 7) return `${days} 天前`;

        return date.toLocaleDateString('zh-CN');
    } catch (error) {
        return timeStr;
    }
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
