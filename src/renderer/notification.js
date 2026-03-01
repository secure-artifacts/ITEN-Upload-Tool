let currentPayload = null;
let autoCloseTimer = null; // 🔴 自动关闭定时器

const titleEl = document.getElementById('notify-title');
const bodyEl = document.getElementById('notify-body');
const actionsEl = document.getElementById('notify-actions');

// 🔴 播放通知提示音（清脆叮咚音效）
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const playTone = (freq, startTime, duration, volume = 0.15) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';  // 正弦波，音色柔和

      // 淡入淡出效果
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + startTime + duration);

      oscillator.start(audioContext.currentTime + startTime);
      oscillator.stop(audioContext.currentTime + startTime + duration);
    };

    // 🔔 叮咚音效 - 类似钉钉/企业微信通知
    // 第一声"叮"（高音）
    playTone(1318.5, 0, 0.12, 0.12);     // E6
    // 第二声"咚"（低音，稍延迟）
    playTone(987.8, 0.08, 0.18, 0.10);   // B5

  } catch (e) {
    console.warn('[Notification] 播放提示音失败:', e);
  }
}

// 🔴 启动自动关闭定时器
function startAutoCloseTimer(seconds) {
  // 清除之前的定时器
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }

  autoCloseTimer = setTimeout(() => {
    // 自动关闭通知
    sendAction('close');
  }, seconds * 1000);
}

// 🔴 清除自动关闭定时器
function clearAutoCloseTimer() {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
}

const REVIEW_STATUS = {
  APPROVED: '已审核通过',
  UPDATED: '已更新修改',
  PENDING: '待审核',
  NEEDS_CHANGE: '需要修改',
  PARTIAL_CHANGE: '一部分需要修改',
  CANCELLED: '取消审核'
};

const REVIEW_STATUS_ALIASES = {
  已通过: REVIEW_STATUS.APPROVED,
  审核通过: REVIEW_STATUS.APPROVED,
  通过: REVIEW_STATUS.APPROVED,
  已审核通过: REVIEW_STATUS.APPROVED,
  等待审核: REVIEW_STATUS.PENDING,
  审核中: REVIEW_STATUS.PENDING,
  待处理: REVIEW_STATUS.PENDING,
  已提交: REVIEW_STATUS.PENDING,
  需要修改: REVIEW_STATUS.NEEDS_CHANGE,
  需修改: REVIEW_STATUS.NEEDS_CHANGE,
  修改: REVIEW_STATUS.NEEDS_CHANGE,
  部分合格: REVIEW_STATUS.PARTIAL_CHANGE,
  部分通过: REVIEW_STATUS.PARTIAL_CHANGE,
  已取消审核: REVIEW_STATUS.CANCELLED,
  已取消: REVIEW_STATUS.CANCELLED
};

const DEFAULT_REPORT_PRESETS = ['生成图片', '制作图片', '制作风格图', '制作视频', '生成sora', '图片转视频', 'reels视频', '视频剪辑'];

// 🔴 获取动态报数预设（优先从上传模块的任务类型获取）
function getDynamicReportPresets() {
  // 尝试从 CheckinCore 获取动态任务类型
  if (window.parent?.CheckinCore?.getReportTaskTypes) {
    const types = window.parent.CheckinCore.getReportTaskTypes();
    if (types && types.length > 0) {
      return types;
    }
  }
  return DEFAULT_REPORT_PRESETS;
}

function normalizePresetList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(item => String(item || '').trim()).filter(Boolean);
}

function mergePresets(customPresets) {
  const basePresets = getDynamicReportPresets();
  return Array.from(new Set([...basePresets, ...customPresets]));
}

function render(payload) {
  if (!payload || !bodyEl || !titleEl || !actionsEl) {
    return;
  }
  const { type, entry } = payload;
  currentPayload = { ...payload };

  // 🔴 不再使用 CSS transform 缩放内容
  // 窗口大小由主进程调整，内容自然填充窗口

  // 处理报数类型
  if (type === 'report') {
    // 🔴 重置已选任务计数
    selectedTaskCounts = {};
    titleEl.textContent = payload.title || '📢 报数提醒';
    bodyEl.innerHTML = buildReportNotificationCard(payload);
    actionsEl.innerHTML = buildReportActionButtons(payload);
    return;
  }

  // 处理别人已报数通知
  if (type === 'report-info') {
    titleEl.textContent = payload.title || '📢 报数通知';
    bodyEl.innerHTML = buildReportInfoCard(payload);
    actionsEl.innerHTML = `<button class="review-action-btn primary action-pill" data-action="close">知道了</button>`;

    // 🔴 根据设置决定是否播放提示音
    if (payload.playSound !== false) {
      playNotificationSound();
    }

    // 🔴 10秒后自动关闭
    startAutoCloseTimer(10);
    return;
  }

  const isFileReview = Boolean(entry?.isFileReview);
  const titles = {
    review: '有图需要审核',
    suggestion: '图片有建议反馈',
    approved: '图片已审核通过入库'
  };
  const fileReviewTitles = {
    review: '有批次需要审核',
    suggestion: '批次已更新修改',
    approved: '批次状态已更新'
  };
  titleEl.textContent = (isFileReview ? fileReviewTitles[type] : titles[type]) || '提醒';
  if (isFileReview) {
    bodyEl.innerHTML = buildFileReviewNotificationCard(type, entry);
    actionsEl.innerHTML = buildFileReviewActionButtons(type, entry);
    bindNotificationPreview();
    return;
  }
  const noteValue = entry.noteDraft || entry.note || '';
  bodyEl.innerHTML = buildNotificationCard(type, entry, noteValue);
  actionsEl.innerHTML = buildActionButtons(type);
  bindNotificationPreview();
}
/**
 * 构建报数通知卡片
 */
function buildReportNotificationCard(payload) {
  const slotLabel = escapeHtml(payload.slotLabel || '');
  const message = escapeHtml(payload.message || '请填写任务完成量');

  // 从 payload 或 localStorage 读取预设选项
  let presets = Array.isArray(payload.presets) ? payload.presets : [];
  if (!presets.length) {
    try {
      let settingsKey = 'ck-report-settings';
      const profileRaw = localStorage.getItem('checkin_profile');
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        const cleanName = String(profile?.name || '').replace(/[.#$\[\]/]/g, '_').trim();
        if (cleanName) {
          settingsKey = `ck-report-settings:${cleanName}`;
        }
      }
      let saved = localStorage.getItem(settingsKey);
      if (!saved && settingsKey !== 'ck-report-settings') {
        saved = localStorage.getItem('ck-report-settings');
      }
      if (saved) {
        const settings = JSON.parse(saved);
        const customPresets = settings?.customPresets || settings?.presets || [];
        presets = mergePresets(normalizePresetList(customPresets));
      }
    } catch (e) { }
  }
  if (!presets.length) {
    presets = getDynamicReportPresets();
  }

  // 🔴 获取收藏的任务（从 payload 或 localStorage）
  let favoriteTypes = Array.isArray(payload.favoriteTypes) ? payload.favoriteTypes : [];
  if (!favoriteTypes.length) {
    try {
      const profileRaw = localStorage.getItem('checkin_profile');
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        favoriteTypes = profile?.favoriteTaskTypes || [];
      }
    } catch (e) { }
  }

  // 🔴 分离常用和全部任务
  const favoritePresets = presets.filter(p => favoriteTypes.includes(p));
  const fallbackCommon = presets.slice(0, 6);
  const commonPresets = favoritePresets.length > 0 ? favoritePresets : fallbackCommon;
  const otherPresets = presets.filter(p => !commonPresets.includes(p));

  // 生成按钮HTML（带收藏星标）
  const generateBtn = (p, isFav = false) =>
    `<button type="button" class="report-preset-btn ${isFav ? 'favorite' : ''}" data-preset="${escapeHtml(p)}">
      <span class="fav-star" data-fav="${escapeHtml(p)}" title="${isFav ? '取消常用' : '加入常用'}">★</span>
      <span class="task-name">${escapeHtml(p)}</span>
    </button>`;

  const commonButtonsHtml = commonPresets.map(p => generateBtn(p, favoriteTypes.includes(p))).join('');
  const otherButtonsHtml = otherPresets.map(p => generateBtn(p, favoriteTypes.includes(p))).join('');
  const allCount = otherPresets.length;

  return `
    <div class="review-card notification-review-card report-card">
      <header class="review-card-header">
        <div class="review-card-title-block">
          <h3 class="review-card-title">${slotLabel} 报数</h3>
          <p class="review-card-subtitle">${message}</p>
        </div>
      </header>

      <div class="report-section report-section-common favorite-section">
        <div class="report-section-header">
          <span class="section-title">⭐ 常用</span>
          <span class="section-sub">点★管理</span>
        </div>
        <div class="report-preset-grid">
          ${commonButtonsHtml}
        </div>
      </div>

      ${allCount > 0 ? `
      <div class="report-section report-section-all collapsed" data-section="all">
        <div class="report-section-header">
          <span class="section-title">全部</span>
          <button type="button" class="report-section-toggle"
            data-collapsed-label="展开全部（${allCount}）"
            data-expanded-label="收起全部">展开全部（${allCount}）</button>
        </div>
        <div class="report-preset-grid">
          ${otherButtonsHtml}
        </div>
      </div>
      ` : ''}

      <!-- 🔴 数量输入（点击任务后显示） -->
      <div class="report-count-bar" id="report-count-wrapper" style="display: none;">
        <span class="count-task-name" id="report-count-task-name">任务</span>
        <div class="count-controls">
          <button type="button" class="count-btn" id="report-count-minus">−</button>
          <input type="number" id="report-count-input" class="count-number-input" min="0" value="0">
          <button type="button" class="count-btn" id="report-count-plus">+</button>
        </div>
        <button type="button" class="count-add-btn" id="report-count-confirm">✓ 添加</button>
        <button type="button" class="count-fav-btn" id="report-count-fav" title="加入常用">★</button>
        <button type="button" class="count-cancel-btn" id="report-count-cancel">✕</button>
      </div>

      <!-- 🔴 已选任务 + 备注 -->
      <div class="report-result-section">
        <div class="result-row">
          <span class="result-label">📋 已选：</span>
          <div id="report-task-display" class="report-task-display-inline"><span class="placeholder">暂无</span></div>
        </div>
        <input type="hidden" id="report-task-input" value="">
        <input type="text" id="report-task-note" class="report-note-inline" placeholder="📝 选择任务后可添加备注" disabled>
      </div>
    </div>
  `;
}

/**
 * 构建别人已报数的通知卡片
 */
function buildReportInfoCard(payload) {
  const userName = escapeHtml(payload.userName || '');
  const slotLabel = escapeHtml(payload.slotLabel || '');
  const taskCount = escapeHtml(payload.taskCount || '');
  const message = escapeHtml(payload.message || '');

  return `
    <div class="review-card notification-review-card report-info-card">
      <header class="review-card-header">
        <div class="review-card-title-block">
          <p class="review-card-label">报数通知</p>
          <h3 class="review-card-title">✓ ${userName} 已报数</h3>
          <p class="review-card-subtitle">${slotLabel}</p>
        </div>
        <div class="review-card-status-chip status-approved">
          <span class="status-label">状态</span>
          <span class="status-value">已完成</span>
        </div>
      </header>
      <div class="review-card-section">
        <span class="review-card-label">完成内容</span>
        <div class="review-note-text">${taskCount}</div>
      </div>
    </div>
  `;
}

/**
 * 构建报数操作按钮
 */
function buildReportActionButtons(payload) {
  return `
    <button class="review-action-btn ghost action-pill" data-action="report-later">稍后提醒</button>
    <button class="review-action-btn primary action-pill" data-action="report-submit">提交报数</button>
  `;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeReviewStatus(status = '') {
  const value = (status || '').trim();
  if (!value) {
    return '';
  }
  return REVIEW_STATUS_ALIASES[value] || value;
}

function getReviewStatusClass(status = '') {
  const normalized = normalizeReviewStatus(status);
  if (!normalized) return '';
  if (normalized === REVIEW_STATUS.APPROVED) return 'status-approved';
  if (normalized === REVIEW_STATUS.CANCELLED) return 'status-cancelled';
  if (normalized === REVIEW_STATUS.NEEDS_CHANGE || normalized === REVIEW_STATUS.PARTIAL_CHANGE) {
    return 'status-feedback';
  }
  if (normalized === REVIEW_STATUS.PENDING || normalized === REVIEW_STATUS.UPDATED) {
    return 'status-pending';
  }
  return '';
}

function renderLinkButton(url, label = '', options = {}) {
  if (!url) {
    return '无';
  }
  const buttonLabel = label ? `打开${label}` : '打开链接';
  const attrs = [];
  if (options.linkType) {
    attrs.push(`data-link-type="${escapeHtml(options.linkType)}"`);
  }
  if (options.reviewStatus) {
    attrs.push(`data-review-status="${escapeHtml(options.reviewStatus)}"`);
  }
  const attrsString = attrs.length ? ` ${attrs.join(' ')}` : '';
  return `<button type="button" class="chip-link-button" data-open-url="${escapeHtml(url)}"${attrsString}>${escapeHtml(buttonLabel)}</button>`;
}

function buildReviewChip(label, value, options = {}) {
  const classes = ['review-chip'];
  const { hideLabel, variant } = options;
  if (hideLabel) {
    classes.push('chip-hide-label');
  }
  if (variant) {
    classes.push(`chip-${variant}`);
  }
  return `
    <div class="${classes.join(' ')}">
      <span class="chip-label">${label}</span>
      <span class="chip-value">${value || '无'}</span>
    </div>
  `;
}

function buildReviewChipRows(rows = []) {
  if (!rows.length) {
    return '';
  }
  const normalizedRows = rows.map((row) => {
    if (Array.isArray(row)) {
      return { items: row };
    }
    if (row && Array.isArray(row.items)) {
      return row;
    }
    return { items: [] };
  });
  return `
    <div class="review-chip-group">
      ${normalizedRows
      .map((row) => {
        const items = row.items || [];
        const count = items.length;
        const layout = row.layout || (count === 1 ? 'single' : '');
        const classes = ['review-chip-row'];
        if (layout) {
          classes.push(`layout-${layout}`);
        }
        const attrs = [`data-chip-count="${count}"`, layout ? `data-chip-layout="${layout}"` : '']
          .filter(Boolean)
          .join(' ');
        return `<div class="${classes.join(' ')}" ${attrs}>${items.join('')}</div>`;
      })
      .join('')}
    </div>
  `;
}

function getReviewEntryTitle(entry = {}) {
  if (!entry) {
    return '-';
  }
  const naming = (entry.reviewSlotName || '').trim();
  if (naming) {
    return naming;
  }
  const description = (entry.description || '').trim();
  if (description) {
    return description;
  }
  const main = (entry.mainCategory || '').trim();
  const sub = (entry.subCategory || '').trim();
  if (main || sub) {
    return [main || '-', sub || '-'].filter(Boolean).join(' / ');
  }
  return '-';
}

function buildNotificationCard(type, entry, noteValue) {
  const statusRaw = (entry.status || '').trim();
  const normalizedStatus = normalizeReviewStatus(statusRaw);
  const statusClass = getReviewStatusClass(statusRaw);
  const submitterName = escapeHtml(entry.submitter || '-');
  const adminName = escapeHtml(entry.admin || '-');
  const submitDate = escapeHtml(entry.completedAt || entry.customDate || '-');
  const categoryLabel = escapeHtml(`${entry.mainCategory || '-'} / ${entry.subCategory || '-'}`);
  const title = escapeHtml(entry.displayTitle || getReviewEntryTitle(entry));
  const reviewLinkButton = renderLinkButton(entry.tempLink || '', '审核链接');
  const finalLinkButton = renderLinkButton(entry.folderLink || '', '最终链接', {
    linkType: 'final',
    reviewStatus: normalizedStatus
  });
  const cardClasses = ['review-card', statusClass, 'notification-review-card'].filter(Boolean).join(' ');
  const chipRows = [
    {
      layout: 'double',
      items: [
        buildReviewChip('提交人', submitterName, { variant: 'plain' }),
        buildReviewChip('管理员', adminName, { variant: 'plain' })
      ]
    },
    {
      layout: 'double',
      items: [
        buildReviewChip('审核链接', reviewLinkButton, { hideLabel: true }),
        buildReviewChip('最终链接', finalLinkButton, { hideLabel: true })
      ]
    }
  ];
  const noteSection = buildNotificationNoteSection(type, noteValue, entry);
  const filesSection = renderFileListSummary(entry, {
    context: 'notification',
    initialCollapsed: false
  });
  return `
    <div class="${cardClasses}" data-row="${entry.rowNumber || ''}">
      <header class="review-card-header">
        <div class="review-card-title-block">
          <p class="review-card-label">文件命名</p>
          <h3 class="review-card-title">${title}</h3>
          <p class="review-card-subtitle">${categoryLabel}</p>
          <p class="review-card-subtitle">提交日期：${submitDate}</p>
        </div>
        <div class="review-card-status-chip ${statusClass || ''}">
          <span class="status-label">状态</span>
          <span class="status-value">${escapeHtml(statusRaw || '')}</span>
        </div>
      </header>
      ${buildReviewChipRows(chipRows)}
      ${noteSection}
      ${filesSection}
    </div>
  `;
}

function buildNotificationNoteSection(type, noteValue, entry) {
  if (type === 'review') {
    return `
      <div class="review-card-section">
        <span class="review-card-label">审核建议</span>
        <textarea id="notify-note" class="review-note-input" placeholder="输入审核意见...">${escapeHtml(noteValue)}</textarea>
      </div>
    `;
  }
  const message = entry.note || entry.noteDraft || noteValue;
  if (type === 'suggestion') {
    return `
      <div class="review-card-section">
        <span class="review-card-label">审核建议</span>
        <div class="review-note-text">${escapeHtml(message || '暂无审核建议')}</div>
      </div>
    `;
  }
  if (message) {
    return `
      <div class="review-card-section">
        <span class="review-card-label">审核建议</span>
        <div class="review-note-text">${escapeHtml(message)}</div>
      </div>
    `;
  }
  return '';
}

function getFileDetails(entry, type) {
  if (!entry) return [];
  const detailKey = type === 'accepted' ? 'acceptedDetails' : 'rejectedDetails';
  const fallbackKey = type === 'accepted' ? 'acceptedFiles' : 'rejectedFiles';
  const details = Array.isArray(entry[detailKey]) ? entry[detailKey] : [];
  if (details.length) {
    return details.map((item) => normalizeFileDetail(item)).filter(Boolean);
  }
  const names = Array.isArray(entry[fallbackKey]) ? entry[fallbackKey] : [];
  return names.map((name) => normalizeFileDetail({ name }));
}

function normalizeFileDetail(detail) {
  if (!detail) {
    return null;
  }
  if (typeof detail === 'string') {
    return { name: detail, link: '', id: '', path: '', thumbnail: '', previewLink: '' };
  }
  const name = detail.name || detail.path || detail.id || '';
  const link =
    detail.link ||
    detail.finalLink ||
    detail.targetLink ||
    detail.webViewLink ||
    detail.webContentLink ||
    detail.previewLink ||
    '';
  const path = detail.path || detail.localPath || '';
  const thumbnail = detail.thumbnail || detail.thumbnailLink || '';
  const id = detail.id || detail.fileId || detail.driveFileId || '';
  if (!name && !link && !path) {
    return null;
  }
  return {
    name: name || link || path,
    link,
    id,
    path,
    thumbnail,
    previewLink: detail.previewLink || ''
  };
}

function buildPreviewData(detail = {}) {
  const name = detail.name || detail.path || detail.id || '';
  const link = detail.link || '';
  let id = detail.id || detail.fileId || detail.driveFileId || '';
  const path = detail.path || '';
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif'].some((ext) =>
    name.toLowerCase().endsWith(ext)
  );
  const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv'].some((ext) =>
    name.toLowerCase().endsWith(ext)
  );
  const buildFileUrl = (rawPath = '') => {
    if (!rawPath) return '';
    if (rawPath.startsWith('file://')) return rawPath;
    let normalized = rawPath.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    return `file://${encodeURI(normalized)}`;
  };
  const localUrl = buildFileUrl(path);
  if (!id && link) {
    const match = link.match(/[-\w]{25,}/);
    if (match) {
      id = match[0];
    }
  }
  let preview = detail.previewLink || '';
  let thumbnail = detail.thumbnail || detail.thumbnailLink || '';
  if (!thumbnail && id && (isImage || isVideo)) {
    thumbnail = `https://drive.google.com/thumbnail?id=${id}&sz=w200`;
  }
  if (!preview && id) {
    preview = isVideo
      ? `https://drive.google.com/uc?export=download&id=${id}`
      : `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
  }
  if (!thumbnail && localUrl && (isImage || isVideo)) {
    thumbnail = localUrl;
  }
  if (!preview && localUrl) {
    preview = localUrl;
  }
  const driveViewLink = id ? `https://drive.google.com/file/d/${id}/view` : '';
  const openUrl = link || driveViewLink || preview || '';
  return { thumbnail, preview, openUrl, name };
}

function bindNotificationPreview() {
  const thumbs = Array.from(document.querySelectorAll('.notify-thumb'));
  if (!thumbs.length) return;
  const setInlinePreview = (btn) => {
    const target = btn.dataset.previewTarget;
    if (!target) return false;
    const panel = document.querySelector(`.notify-preview-panel[data-preview-panel="${CSS.escape(target)}"]`);
    if (!panel) return false;
    const preview = btn.dataset.preview || '';
    const openUrl = btn.dataset.openUrl || preview;
    const name = btn.querySelector('.notify-thumb-name')?.textContent || '';
    panel.innerHTML = '';
    if (preview && preview.match(/\.(mp4|mov|mkv|webm|avi|flv)(\?|$)/i)) {
      const video = document.createElement('video');
      video.src = preview;
      video.controls = true;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.style.maxWidth = '100%';
      video.style.maxHeight = '100%';
      video.style.objectFit = 'contain';
      panel.appendChild(video);
    } else if (preview) {
      const img = document.createElement('img');
      img.src = preview;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'contain';
      panel.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'notify-preview-placeholder';
      placeholder.textContent = '预览不可用';
      panel.appendChild(placeholder);
    }
    if (openUrl) {
      panel.dataset.openUrl = openUrl;
      panel.style.cursor = 'pointer';
      panel.onclick = () => window.bridge?.openExternal?.(openUrl);
    } else {
      panel.onclick = null;
      panel.style.cursor = 'default';
    }
    return true;
  };
  let overlay = document.getElementById('notify-preview-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'notify-preview-overlay';
    overlay.className = 'notify-preview-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div id="notify-preview-box" class="notify-preview-box">
        <div id="notify-preview-media" class="notify-preview-media"></div>
        <div id="notify-preview-meta" class="notify-preview-meta">
          <span id="notify-preview-name"></span>
          <button id="notify-preview-open" class="chip-link-button">打开链接</button>
          <button id="notify-preview-close" class="ghost">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
        const media = document.getElementById('notify-preview-media');
        if (media) media.innerHTML = '';
      }
    });
    document.getElementById('notify-preview-close').addEventListener('click', () => {
      overlay.style.display = 'none';
      const media = document.getElementById('notify-preview-media');
      if (media) media.innerHTML = '';
    });
  }

  const mediaBox = document.getElementById('notify-preview-media');
  const nameBox = document.getElementById('notify-preview-name');
  const openBtn = document.getElementById('notify-preview-open');

  thumbs.forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      if (setInlinePreview(btn)) return;
    });
    btn.addEventListener('click', () => {
      if (setInlinePreview(btn)) return;
      const preview = btn.dataset.preview || '';
      const openUrl = btn.dataset.openUrl || preview;
      const name = btn.querySelector('.notify-thumb-name')?.textContent || '';
      if (mediaBox) {
        mediaBox.innerHTML = '';
        if (preview && preview.match(/\.(mp4|mov|mkv|webm|avi|flv)(\?|$)/i)) {
          const video = document.createElement('video');
          video.src = preview;
          video.controls = true;
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.style.maxWidth = '100%';
          video.style.maxHeight = '78vh';
          video.style.objectFit = 'contain';
          mediaBox.appendChild(video);
        } else if (preview) {
          const img = document.createElement('img');
          img.src = preview;
          img.style.maxWidth = '100%';
          img.style.maxHeight = '78vh';
          img.style.objectFit = 'contain';
          mediaBox.appendChild(img);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'slot-grid-preview-placeholder';
          placeholder.textContent = '预览不可用';
          placeholder.style.width = '100%';
          placeholder.style.height = '60vh';
          placeholder.style.display = 'flex';
          placeholder.style.alignItems = 'center';
          placeholder.style.justifyContent = 'center';
          placeholder.style.color = '#e2e8f0';
          mediaBox.appendChild(placeholder);
        }
      }
      if (nameBox) {
        nameBox.textContent = name || '未命名文件';
      }
      if (openBtn) {
        if (openUrl) {
          openBtn.style.display = 'inline-flex';
          openBtn.onclick = () => {
            window.bridge?.openExternal?.(openUrl);
          };
        } else {
          openBtn.style.display = 'none';
        }
      }
      overlay.style.display = 'flex';
    });
  });
}

function normalizeFileDetail(detail) {
  if (!detail) {
    return null;
  }
  if (typeof detail === 'string') {
    return { name: detail, link: '' };
  }
  const name = detail.name || detail.path || detail.id || '';
  const link = detail.link || '';
  if (!name && !link) {
    return null;
  }
  return { name: name || link, link };
}

function renderFileListSummary(entry, options = {}) {
  const acceptedDetails = getFileDetails(entry, 'accepted');
  const rejectedDetails = getFileDetails(entry, 'rejected');
  const total = acceptedDetails.length + rejectedDetails.length;
  if (!total) {
    return `<div class="review-file-summary-wrapper empty"><span class="muted">尚未检测到合格/不合格文件</span></div>`;
  }
  const context = options.context || 'review';
  const summaryId = `${context}-${entry.rowNumber}`;
  const collapsed = options.initialCollapsed !== false;
  const toggleLabel = buildSummaryToggleLabel(total, collapsed);
  const sections = [
    renderFileListSection('合格文件', acceptedDetails, 'success', `${summaryId}-accepted`),
    renderFileListSection('不合格文件', rejectedDetails, 'danger', `${summaryId}-rejected`)
  ].join('');
  return `
    <div class="review-file-summary-wrapper" data-summary-id="${summaryId}">
      <button type="button" class="ghost toggle-file-summary" data-action="toggle-file-summary" data-target="${summaryId}" data-count="${total}">
        ${toggleLabel}
      </button>
      <div class="review-file-summary ${collapsed ? 'collapsed' : ''}" data-summary-id="${summaryId}" data-count="${total}">
        ${sections}
      </div>
    </div>
  `;
}

function buildSummaryToggleLabel(total, collapsed) {
  const verb = collapsed ? '展开' : '收起';
  return `${verb}文件清单（${total}）`;
}

function renderFileListSection(label, details, className, sectionKey = '') {
  const items = Array.isArray(details) ? details.filter(Boolean) : [];
  if (!items.length) {
    return `<div class="review-file-section"><span>${label}</span><p class="muted">暂无</p></div>`;
  }
  const itemsHtml = items
    .map((detail) => {
      const text = escapeHtml(detail.name || '');
      const data = buildPreviewData(detail);
      const badge = (text.split('.').pop() || 'FILE').toUpperCase().slice(0, 4);
      const thumb = data.thumbnail
        ? `<img src="${escapeHtml(data.thumbnail)}" alt="${text}" />`
        : `<div class="review-file-badge">${badge}</div>`;
      const attrs = [
        data.preview ? `data-preview="${escapeHtml(data.preview)}"` : '',
        data.openUrl ? `data-open-url="${escapeHtml(data.openUrl)}"` : '',
        sectionKey ? `data-preview-target="${escapeHtml(sectionKey)}"` : ''
      ]
        .filter(Boolean)
        .join(' ');
      return `<button type="button" class="notify-thumb" ${attrs}>
        <div class="notify-thumb-media">${thumb}</div>
        <div class="notify-thumb-name" title="${text}">${text || '未命名文件'}</div>
      </button>`;
    })
    .join('');
  return `<div class="review-file-section">
    <span>${label}（${items.length}）</span>
    <div class="notify-file-section">
      <div class="notify-file-grid ${className || ''}">${itemsHtml}</div>
      <div class="notify-preview-panel" data-preview-panel="${escapeHtml(sectionKey)}">
        <div class="notify-preview-placeholder">悬停或点击左侧缩略图查看大图</div>
      </div>
    </div>
  </div>`;
}

function buildActionButtons(type) {
  if (type === 'review') {
    return `
      <button class="review-action-btn primary action-pill" data-action="approve">通过</button>
      <button class="review-action-btn ghost action-pill" data-action="need-change">需要修改</button>
      <button class="review-action-btn ghost action-pill" data-action="partial-change">一部分需要修改</button>
      <button class="review-action-btn ghost danger action-pill" data-action="cancel">取消审核</button>
      <button class="review-action-btn ghost action-pill" data-action="close">关闭</button>
    `;
  }
  if (type === 'suggestion') {
    return `
      <button class="review-action-btn primary action-pill" data-action="mark-updated">已更新修改</button>
      <button class="review-action-btn ghost action-pill" data-action="close">关闭</button>
    `;
  }
  return `<button class="review-action-btn primary action-pill" data-action="close">关闭</button>`;
}

function getNoteValue() {
  const note = document.getElementById('notify-note');
  if (!note) return '';
  return note.value || '';
}

function sendAction(action, extra = {}) {
  if (!currentPayload) return;
  if (!window.floatingNotification) {
    return;
  }

  // 处理报数操作
  if (currentPayload.type === 'report') {
    const taskInput = document.getElementById('report-task-input');
    const noteInput = document.getElementById('report-task-note');

    // 🔴 使用快速选择的任务
    const taskCount = taskInput?.value?.trim() || '';
    const noteValue = noteInput?.value?.trim() || '';

    if (action === 'report-submit') {
      if (!taskCount) {
        // 🔴 如果没有选择任务，显示提示并抖动
        const displayEl = document.getElementById('report-task-display');
        displayEl?.classList.add('shake');
        setTimeout(() => displayEl?.classList.remove('shake'), 500);
        return;
      }
    }

    // 🔴 组合最终值（任务 + 备注）
    let finalTaskCount = taskCount;
    if (noteValue) {
      finalTaskCount = taskCount ? `${taskCount}（${noteValue}）` : `（${noteValue}）`;
    }

    const payload = {
      action,
      type: 'report',
      slotKey: currentPayload.slotKey,
      slotLabel: currentPayload.slotLabel,
      taskCount: finalTaskCount,
      taskNote: noteValue  // 🔴 单独传递备注
    };
    window.floatingNotification.sendAction(payload);
    return;
  }

  const note = getNoteValue();
  const entry = currentPayload.entry || {};
  const payload = {
    action,
    type: currentPayload.type,
    note,
    ...extra
  };
  if (entry.isFileReview) {
    payload.batchId = entry.batchId;
    payload.targetView = entry.notificationTarget || '';
  } else {
    payload.rowNumber = entry.rowNumber;
  }
  window.floatingNotification.sendAction(payload);
}

function buildFileReviewNotificationCard(type, entry = {}) {
  const statusRaw = (entry.status || '').trim();
  const statusClass = getReviewStatusClass(statusRaw);
  const submitterName = escapeHtml(entry.submitter || '-');
  const submitDate = escapeHtml(entry.completedAt || entry.customDate || '-');
  const categoryLabel = escapeHtml(`${entry.mainCategory || '-'} / ${entry.subCategory || '-'}`);
  const batchId = escapeHtml(entry.batchId || '-');
  const reviewLinkButton = renderLinkButton(entry.tempLink || '', '待审目录');
  const counts = entry.counts || {};
  const stats = `共 ${Number(counts.total || 0)} 个文件：待审 ${Number(counts.pending || 0)} | 合格 ${Number(counts.approved || 0)} | 不合格 ${Number(counts.rejected || 0)} | 已入库 ${Number(counts.stored || 0)}`;
  const chipRows = [
    {
      layout: 'double',
      items: [
        buildReviewChip('提交人', submitterName, { variant: 'plain' }),
        buildReviewChip('待审目录', reviewLinkButton, { hideLabel: true })
      ]
    }
  ];
  const filesSection = renderBatchFileGrid(entry.files || [], entry.referenceFiles || [], `file-review-${batchId}`);
  const cardClasses = ['review-card', statusClass, 'notification-review-card'].filter(Boolean).join(' ');
  return `
    <div class="${cardClasses}">
      <header class="review-card-header">
        <div class="review-card-title-block">
          <p class="review-card-label">批次</p>
          <h3 class="review-card-title">${batchId}</h3>
          <p class="review-card-subtitle">${categoryLabel}</p>
          <p class="review-card-subtitle">提交日期：${submitDate}</p>
        </div>
        <div class="review-card-status-chip ${statusClass || ''}">
          <span class="status-label">状态</span>
          <span class="status-value">${escapeHtml(statusRaw || '')}</span>
        </div>
      </header>
      ${buildReviewChipRows(chipRows)}
      <div class="review-card-section">
        <span class="review-card-label">文件统计</span>
        <div class="review-note-text">${escapeHtml(stats)}</div>
      </div>
      ${filesSection}
    </div>
  `;
}

function renderBatchFileGrid(files = [], referenceFiles = [], contextKey = '') {
  const fileItems = Array.isArray(files) ? files.filter(Boolean) : [];
  const refItems = Array.isArray(referenceFiles) ? referenceFiles.filter(Boolean) : [];
  const buildSection = (label, items, sectionKey) => {
    if (!items.length) {
      return `<div class="review-file-section"><span>${label}</span><p class="muted">暂无</p></div>`;
    }
    const itemsHtml = items
      .slice(0, 36)
      .map((file) => {
        const name = escapeHtml(file.fileName || file.name || '未命名文件');
        const data = buildPreviewData({
          name: file.fileName || file.name || '',
          id: file.fileId || file.id || '',
          link: file.fileLink || file.link || ''
        });
        const badge = (String(name).split('.').pop() || 'FILE').toUpperCase().slice(0, 4);
        const thumb = data.thumbnail
          ? `<img src="${escapeHtml(data.thumbnail)}" alt="${name}" />`
          : `<div class="review-file-badge">${badge}</div>`;
        const attrs = [
          data.preview ? `data-preview="${escapeHtml(data.preview)}"` : '',
          data.openUrl ? `data-open-url="${escapeHtml(data.openUrl)}"` : '',
          sectionKey ? `data-preview-target="${escapeHtml(sectionKey)}"` : ''
        ]
          .filter(Boolean)
          .join(' ');
        return `<button type="button" class="notify-thumb" ${attrs}>
          <div class="notify-thumb-media">${thumb}</div>
          <div class="notify-thumb-name" title="${name}">${name}</div>
        </button>`;
      })
      .join('');
    return `<div class="review-file-section">
      <span>${label}（${items.length}）</span>
      <div class="notify-file-section">
        <div class="notify-file-grid">${itemsHtml}</div>
        <div class="notify-preview-panel" data-preview-panel="${escapeHtml(sectionKey)}">
          <div class="notify-preview-placeholder">悬停或点击左侧缩略图查看大图</div>
        </div>
      </div>
    </div>`;
  };

  const sections = [
    buildSection('待审文件', fileItems, `${contextKey}-files`),
    buildSection('参考文件', refItems, `${contextKey}-refs`)
  ].join('');

  return `<div class="review-file-summary-wrapper">${sections}</div>`;
}

function buildFileReviewActionButtons(type, entry = {}) {
  const targetView = entry.notificationTarget || (type === 'approved' ? 'my-review' : 'review');
  const openLabel = targetView === 'my-review' ? '打开我的审核' : '打开总审核面板';
  const openPanelBtn = `<button class="review-action-btn primary action-pill" data-action="open-panel">${escapeHtml(openLabel)}</button>`;
  const folderBtn = entry.tempLink
    ? `<button class="review-action-btn ghost action-pill" data-open-url="${escapeHtml(entry.tempLink)}">打开待审目录</button>`
    : '';
  return `${openPanelBtn}${folderBtn}<button class="review-action-btn ghost action-pill" data-action="close">关闭</button>`;
}

// 🔴 当前选中的任务项（用于数量输入）
let currentSelectedPreset = null;
// 🔴 已选任务计数 { "任务名": 数量 }
let selectedTaskCounts = {};

// 🔴 更新已选任务显示区域
function updateSelectedTasksDisplay() {
  const displayEl = document.getElementById('report-task-display');
  const input = document.getElementById('report-task-input');
  if (!displayEl || !input) return;

  const items = Object.entries(selectedTaskCounts)
    .filter(([_, count]) => count > 0)
    .map(([name, count]) => `${name} ×${count}`);

  const summaryText = items.length ? items.join('、') : '';
  input.value = summaryText;

  if (items.length === 0) {
    displayEl.innerHTML = '<span class="placeholder">暂无</span>';
  } else {
    // 🔴 每个任务显示为可点击删除的标签
    displayEl.innerHTML = Object.entries(selectedTaskCounts)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) =>
        `<span class="selected-task-tag" data-task="${escapeHtml(name)}">${escapeHtml(name)} ×${count} <span class="remove-btn">✕</span></span>`
      ).join('');
  }

  // 🔴 控制备注输入框：有任务才能填写备注
  const noteInput = document.getElementById('report-task-note');
  if (noteInput) {
    if (items.length > 0) {
      noteInput.disabled = false;
      noteInput.placeholder = '📝 备注（可选）';
    } else {
      noteInput.disabled = true;
      noteInput.placeholder = '📝 选择任务后可添加备注';
      noteInput.value = '';
    }
  }
}

document.addEventListener('click', (event) => {
  // 🔴 处理收藏星标点击
  const favStar = event.target.closest('.fav-star');
  if (favStar) {
    event.preventDefault();
    event.stopPropagation();
    const taskName = favStar.dataset.fav;
    if (!taskName) return;

    // 🔴 判断当前收藏状态（从按钮的 class 判断）
    const btn = favStar.closest('.report-preset-btn');
    const wasAlreadyFav = btn?.classList.contains('favorite');
    const isFav = !wasAlreadyFav; // 切换后的状态

    // 🔴 立即更新 UI（即时反馈）
    document.querySelectorAll(`.fav-star[data-fav="${taskName}"]`).forEach(star => {
      const parentBtn = star.closest('.report-preset-btn');
      if (parentBtn) {
        parentBtn.classList.toggle('favorite', isFav);
      }
      star.title = isFav ? '取消常用' : '加入常用';
    });

    console.log(`[Notification] ${isFav ? '加入' : '取消'}常用: ${taskName}`);

    // 🔴 通过 floatingNotification 发送到主窗口处理
    if (window.floatingNotification) {
      window.floatingNotification.sendAction({
        action: 'toggle-favorite-task',
        taskName: taskName,
        isFav: isFav
      });
    }
    return;
  }

  // 🔴 处理预设按钮点击 - 显示数量输入框
  const presetBtn = event.target.closest('.report-preset-btn');
  if (presetBtn) {
    event.preventDefault();
    const preset = presetBtn.dataset.preset;
    const wrapper = document.getElementById('report-count-wrapper');
    const taskNameEl = document.getElementById('report-count-task-name');
    const countInput = document.getElementById('report-count-input');

    if (wrapper && taskNameEl && preset) {
      // 记录当前选中的任务
      currentSelectedPreset = preset;
      taskNameEl.textContent = preset;

      // 显示数量输入框
      wrapper.style.display = 'block';
      countInput.value = '0';  // 🔴 默认值改为0
      countInput.focus();
      countInput.select();

      // 高亮当前选中的按钮
      document.querySelectorAll('.report-preset-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.preset === preset);
      });

      // 🔴 更新"加入常用"按钮状态
      const favBtn = document.getElementById('report-count-fav');
      if (favBtn) {
        try {
          const profileRaw = localStorage.getItem('checkin_profile');
          const profile = profileRaw ? JSON.parse(profileRaw) : {};
          const isFav = (profile.favoriteTaskTypes || []).includes(preset);
          favBtn.classList.toggle('active', isFav);
          favBtn.title = isFav ? '取消常用' : '加入常用';
        } catch (e) { }
      }
    }
    return;
  }

  // 🔴 处理数量确认按钮
  const confirmBtn = event.target.closest('#report-count-confirm');
  if (confirmBtn) {
    event.preventDefault();
    const countInput = document.getElementById('report-count-input');
    const wrapper = document.getElementById('report-count-wrapper');

    if (currentSelectedPreset && countInput) {
      // 🔴 允许输入0，使用 Number() 而不是 parseInt(...) || 1
      const count = parseInt(countInput.value, 10);
      const validCount = isNaN(count) ? 0 : count;

      // 🔴 更新任务计数（累加，允许0）
      if (!selectedTaskCounts[currentSelectedPreset]) {
        selectedTaskCounts[currentSelectedPreset] = 0;
      }
      selectedTaskCounts[currentSelectedPreset] += validCount;

      // 🔴 更新显示区域
      updateSelectedTasksDisplay();

      // 隐藏数量输入框
      wrapper.style.display = 'none';
      currentSelectedPreset = null;

      // 取消按钮高亮
      document.querySelectorAll('.report-preset-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
    }
    return;
  }

  // 🔴 处理"加入常用"按钮
  const favBtn = event.target.closest('#report-count-fav');
  if (favBtn && currentSelectedPreset) {
    event.preventDefault();
    const taskName = currentSelectedPreset;

    try {
      const profileRaw = localStorage.getItem('checkin_profile');
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        if (!profile.favoriteTaskTypes) profile.favoriteTaskTypes = [];

        const idx = profile.favoriteTaskTypes.indexOf(taskName);
        let isFav = false;
        if (idx >= 0) {
          profile.favoriteTaskTypes.splice(idx, 1);
          favBtn.title = '加入常用';
          favBtn.classList.remove('active');
        } else {
          profile.favoriteTaskTypes.push(taskName);
          isFav = true;
          favBtn.title = '取消常用';
          favBtn.classList.add('active');
        }
        localStorage.setItem('checkin_profile', JSON.stringify(profile));

        // 更新任务按钮的收藏状态
        document.querySelectorAll(`.fav-star[data-fav="${taskName}"]`).forEach(star => {
          const btn = star.closest('.report-preset-btn');
          if (btn) btn.classList.toggle('favorite', isFav);
          star.title = isFav ? '取消常用' : '加入常用';
        });
      }
    } catch (e) {
      console.error('[Notification] 加入常用失败:', e);
    }
    return;
  }

  // 🔴 处理删除已选任务
  const removeBtn = event.target.closest('.selected-task-tag .remove-btn');
  if (removeBtn) {
    event.preventDefault();
    const tag = removeBtn.closest('.selected-task-tag');
    const taskName = tag?.dataset?.task;
    if (taskName && selectedTaskCounts[taskName]) {
      delete selectedTaskCounts[taskName];
      updateSelectedTasksDisplay();
    }
    return;
  }

  // 🔴 处理数量取消按钮
  const cancelBtn = event.target.closest('#report-count-cancel');
  if (cancelBtn) {
    event.preventDefault();
    const wrapper = document.getElementById('report-count-wrapper');
    if (wrapper) {
      wrapper.style.display = 'none';
      currentSelectedPreset = null;

      // 取消按钮高亮
      document.querySelectorAll('.report-preset-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
    }
    return;
  }

  // 🔴 处理加减按钮
  const minusBtn = event.target.closest('#report-count-minus');
  if (minusBtn) {
    event.preventDefault();
    const countInput = document.getElementById('report-count-input');
    if (countInput) {
      const val = parseInt(countInput.value, 10) || 0;
      countInput.value = Math.max(0, val - 1);  // 🔴 允许减到0
    }
    return;
  }

  const plusBtn = event.target.closest('#report-count-plus');
  if (plusBtn) {
    event.preventDefault();
    const countInput = document.getElementById('report-count-input');
    if (countInput) {
      const val = parseInt(countInput.value, 10) || 0;  // 🔴 默认从0开始
      countInput.value = val + 1;
    }
    return;
  }

  // 🔴 折叠/展开全部任务
  const sectionToggle = event.target.closest('.report-section-toggle');
  if (sectionToggle) {
    event.preventDefault();
    const section = sectionToggle.closest('.report-section');
    if (!section) return;
    const isExpanded = section.classList.toggle('expanded');
    section.classList.toggle('collapsed', !isExpanded);
    const collapsedLabel = sectionToggle.dataset.collapsedLabel || '展开全部';
    const expandedLabel = sectionToggle.dataset.expandedLabel || '收起全部';
    sectionToggle.textContent = isExpanded ? expandedLabel : collapsedLabel;
    return;
  }

  const toggleButton = event.target.closest('[data-action="toggle-file-summary"]');
  if (toggleButton) {
    event.preventDefault();
    toggleFileSummary(toggleButton);
    return;
  }
  const linkTarget = event.target.closest('[data-open-url]');
  if (linkTarget) {
    event.preventDefault();
    if (linkTarget.dataset.linkType === 'final') {
      const reviewStatus = linkTarget.dataset.reviewStatus || '';
      if (reviewStatus !== REVIEW_STATUS.APPROVED) {
        window.alert('该条审核尚未通过，暂无法打开最终链接');
        return;
      }
    }
    const url = linkTarget.dataset.openUrl;
    if (url) {
      window.bridge?.openExternal?.(url);
    }
    return;
  }
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) {
    return;
  }
  const action = actionTarget.dataset.action;
  if (!action) {
    return;
  }
  event.preventDefault();
  sendAction(action);
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'notify-note' && currentPayload) {
    currentPayload.entry.noteDraft = event.target.value;
  }
});

// 🔴 处理数量输入框的键盘事件（回车确认，ESC取消）
document.addEventListener('keydown', (event) => {
  if (event.target.id === 'report-count-input') {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.getElementById('report-count-confirm')?.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      document.getElementById('report-count-cancel')?.click();
    }
  }
});

if (window.floatingNotification) {
  window.floatingNotification.onData((payload) => {
    render(payload);
  });
  window.floatingNotification.notifyReady();
}

function toggleFileSummary(button) {
  const target = button?.dataset?.target;
  if (!target) return;
  const summary = document.querySelector(`.review-file-summary[data-summary-id="${target}"]`);
  if (!summary) return;
  summary.classList.toggle('collapsed');
  const collapsed = summary.classList.contains('collapsed');
  const count = Number(button.dataset.count || summary.dataset.count || 0);
  button.textContent = buildSummaryToggleLabel(count, collapsed);
}
