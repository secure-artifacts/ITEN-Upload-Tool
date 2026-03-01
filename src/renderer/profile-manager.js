/**
 * 🔴 多用户 Profile 管理器（前端）
 * 处理 Profile 列表渲染、创建、切换、删除等交互
 */
(function () {
    'use strict';

    // ========== DOM 引用 ==========
    const modal = document.getElementById('profile-manager-modal');
    const closeBtn = document.getElementById('profile-modal-close');
    const profileList = document.getElementById('profile-list');
    const createInput = document.getElementById('profile-new-name');
    const createBtn = document.getElementById('profile-create-btn');
    const indicatorBtn = document.getElementById('profile-indicator');
    const profileNameDisplay = document.getElementById('profile-name-display');
    const profileAvatar = document.getElementById('profile-avatar');

    // 当前 Profile 状态
    let currentProfile = null;
    let isFirstLaunch = false;

    // ========== 初始化 ==========
    async function init() {
        try {
            const current = await window.bridge.profile.getCurrent();
            currentProfile = current;

            if (!current.hasProfile) {
                // 第一次启动，没有 Profile，弹出创建界面
                isFirstLaunch = true;
                showModal();
            } else {
                updateIndicator(current);
            }
        } catch (err) {
            console.error('[ProfileManager] 初始化失败:', err);
        }
    }

    // ========== 更新顶部指示器 ==========
    function updateIndicator(profile) {
        if (!profile || !profile.hasProfile) {
            profileNameDisplay.textContent = '未选择';
            profileAvatar.textContent = '👤';
            return;
        }

        const name = profile.displayName || profile.id || '用户';
        profileNameDisplay.textContent = name;

        // 用首字母或 emoji 作为头像
        const firstChar = name.charAt(0).toUpperCase();
        profileAvatar.textContent = firstChar;
        profileAvatar.style.fontSize = '12px';
        profileAvatar.style.fontWeight = '700';
    }

    // ========== 显示/隐藏弹窗 ==========
    function showModal() {
        modal.hidden = false;
        modal.classList.add('visible');
        renderProfileList();

        // 第一次启动不显示关闭按钮
        if (isFirstLaunch) {
            closeBtn.style.display = 'none';
        } else {
            closeBtn.style.display = '';
        }
    }

    function hideModal() {
        if (isFirstLaunch && !currentProfile?.hasProfile) {
            // 还没创建 Profile，不允许关闭
            return;
        }
        modal.classList.remove('visible');
        setTimeout(() => { modal.hidden = true; }, 200);
    }

    // ========== 渲染 Profile 列表 ==========
    async function renderProfileList() {
        try {
            const profiles = await window.bridge.profile.list();
            const current = await window.bridge.profile.getCurrent();

            if (!profiles.length) {
                profileList.innerHTML = `
          <div class="profile-empty">
            <div class="profile-empty-icon">👤</div>
            <h3>欢迎使用 ITEN 上传工具</h3>
            <p>创建您的第一个 Profile 来开始使用</p>
          </div>
        `;
                return;
            }

            profileList.innerHTML = profiles.map(p => {
                const isCurrent = current.hasProfile && current.id === p.id;
                const initial = (p.displayName || p.id).charAt(0).toUpperCase();
                const emailInfo = p.email ? `<span class="profile-card-email">${p.email}</span>` : '';
                const lastUsed = p.lastUsedAt ? formatRelativeTime(p.lastUsedAt) : '';

                return `
          <div class="profile-card ${isCurrent ? 'active' : ''}" data-profile-id="${p.id}">
            <div class="profile-card-avatar">${initial}</div>
            <div class="profile-card-info">
              <div class="profile-card-name">${escapeHtml(p.displayName || p.id)}</div>
              ${emailInfo}
              ${lastUsed ? `<span class="profile-card-time">最后使用: ${lastUsed}</span>` : ''}
            </div>
            <div class="profile-card-actions">
              ${isCurrent
                        ? '<span class="profile-card-badge">当前</span>'
                        : `<button class="profile-switch-btn" data-id="${p.id}" title="切换到此 Profile">切换</button>`
                    }
              <button class="profile-action-btn" data-action="rename" data-id="${p.id}" title="重命名">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              ${!isCurrent ? `
                <button class="profile-action-btn danger" data-action="delete" data-id="${p.id}" title="删除">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        `;
            }).join('');

            // 绑定事件
            profileList.querySelectorAll('.profile-switch-btn').forEach(btn => {
                btn.addEventListener('click', () => handleSwitch(btn.dataset.id));
            });
            profileList.querySelectorAll('.profile-action-btn').forEach(btn => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (action === 'rename') handleRename(id);
                    if (action === 'delete') handleDelete(id);
                });
            });
        } catch (err) {
            console.error('[ProfileManager] 渲染列表失败:', err);
            profileList.innerHTML = '<div class="profile-error">加载失败，请重试</div>';
        }
    }

    // ========== Profile 操作 ==========

    async function handleCreate() {
        const name = createInput.value.trim();
        if (!name) {
            createInput.focus();
            createInput.classList.add('shake');
            setTimeout(() => createInput.classList.remove('shake'), 500);
            return;
        }

        createBtn.disabled = true;
        createBtn.textContent = '创建中...';

        try {
            const result = await window.bridge.profile.create(name);
            if (!result.success) {
                alert('创建失败: ' + (result.error || '未知错误'));
                return;
            }

            createInput.value = '';

            // 创建后自动切换
            await handleSwitch(result.profile.id);
        } catch (err) {
            alert('创建失败: ' + err.message);
        } finally {
            createBtn.disabled = false;
            createBtn.textContent = '创建 Profile';
        }
    }

    async function handleSwitch(profileId) {
        try {
            const result = await window.bridge.profile.switch(profileId);
            if (!result.success) {
                alert('切换失败: ' + (result.error || '未知错误'));
                return;
            }

            isFirstLaunch = false;
            currentProfile = { hasProfile: true, id: profileId, ...result.meta };
            updateIndicator(currentProfile);

            // 关闭弹窗后重新加载页面以刷新所有数据
            hideModal();
            setTimeout(() => {
                location.reload();
            }, 300);
        } catch (err) {
            alert('切换失败: ' + err.message);
        }
    }

    async function handleDelete(profileId) {
        const profiles = await window.bridge.profile.list();
        const target = profiles.find(p => p.id === profileId);
        const name = target?.displayName || profileId;

        if (!confirm(`确定要删除 Profile「${name}」吗？\n\n该操作将删除此 Profile 的所有配置和数据，不可恢复。`)) {
            return;
        }

        try {
            const result = await window.bridge.profile.delete(profileId);
            if (!result.success) {
                alert('删除失败: ' + (result.error || '未知错误'));
                return;
            }
            renderProfileList();
        } catch (err) {
            alert('删除失败: ' + err.message);
        }
    }

    async function handleRename(profileId) {
        const profiles = await window.bridge.profile.list();
        const target = profiles.find(p => p.id === profileId);
        const oldName = target?.displayName || profileId;

        const newName = prompt('请输入新名称:', oldName);
        if (!newName || newName.trim() === oldName) return;

        try {
            const result = await window.bridge.profile.rename(profileId, newName.trim());
            if (!result.success) {
                alert('重命名失败: ' + (result.error || '未知错误'));
                return;
            }

            // 如果重命名的是当前 Profile，更新指示器
            if (currentProfile?.id === profileId) {
                currentProfile.displayName = newName.trim();
                updateIndicator(currentProfile);
            }

            renderProfileList();
        } catch (err) {
            alert('重命名失败: ' + err.message);
        }
    }

    // ========== 工具函数 ==========

    function formatRelativeTime(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes} 分钟前`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} 小时前`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} 天前`;
        return new Date(timestamp).toLocaleDateString('zh-CN');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ========== 事件绑定 ==========

    // 打开弹窗
    indicatorBtn?.addEventListener('click', showModal);

    // 关闭弹窗
    closeBtn?.addEventListener('click', hideModal);

    // 点击蒙层关闭
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });

    // 创建按钮
    createBtn?.addEventListener('click', handleCreate);

    // 回车创建
    createInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreate();
        }
    });

    // 启动初始化
    init();
})();
