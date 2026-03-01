/**
 * 用户 Profile 管理器
 * 实现完全隔离的多用户支持
 * 
 * 每个 Profile 拥有独立的：
 * - Google OAuth tokens
 * - 所有配置（Sheet ID、Drive 文件夹、命名规则等）
 * - 上传状态
 * - 分类卡片（Slots）
 * - Preferences
 * 
 * 共享的（global）：
 * - 窗口位置/大小
 * - 最后使用的 Profile
 * - 缩放系数
 */

const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

class ProfileManager {
    constructor(appDataRoot) {
        this.appDataRoot = appDataRoot;
        this.profilesDir = path.join(appDataRoot, 'profiles');

        // 全局 Store（不隔离的设置）
        this.globalStore = new Store({
            name: 'global-settings',
            cwd: appDataRoot
        });

        // 确保 profiles 目录存在
        fs.mkdirSync(this.profilesDir, { recursive: true });

        // 当前活跃 Profile
        this.currentProfileId = null;
        this.currentStore = null;
        this.currentConfigRoot = null;
    }

    /**
     * 将显示名转换为安全的目录名
     * 保留中文字符，只替换文件系统不允许的字符
     */
    sanitizeDirName(name) {
        if (!name) return '';
        return name
            .trim()
            .replace(/[\/\\:*?"<>|.#$\[\]]/g, '_')  // 替换文件系统+Firebase 不安全字符
            .replace(/\s+/g, '_')                     // 空格替换为下划线
            .replace(/_+/g, '_')                      // 合并连续下划线
            .replace(/^_|_$/g, '');                    // 去除首尾下划线
    }

    /**
     * 列出所有用户 Profile
     * @returns {Array<{id: string, displayName: string, email: string, createdAt: number, lastUsedAt: number}>}
     */
    listProfiles() {
        if (!fs.existsSync(this.profilesDir)) return [];

        try {
            const entries = fs.readdirSync(this.profilesDir, { withFileTypes: true });
            return entries
                .filter(e => e.isDirectory())
                .map(e => {
                    const profileDir = path.join(this.profilesDir, e.name);
                    const metaPath = path.join(profileDir, 'profile-meta.json');
                    let meta = {};
                    try {
                        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    } catch { /* 忽略读取错误 */ }
                    return {
                        id: e.name,
                        displayName: meta.displayName || e.name,
                        email: meta.email || '',
                        avatarUrl: meta.avatarUrl || '',
                        createdAt: meta.createdAt || 0,
                        lastUsedAt: meta.lastUsedAt || 0
                    };
                })
                .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
        } catch (error) {
            console.error('[ProfileManager] 列出 Profile 失败:', error);
            return [];
        }
    }

    /**
     * 创建新的 Profile
     * @param {string} displayName - 显示名称
     * @returns {{id: string, displayName: string, ...}}
     */
    createProfile(displayName) {
        if (!displayName || !displayName.trim()) {
            throw new Error('Profile 名称不能为空');
        }

        const safeName = this.sanitizeDirName(displayName);
        let profileId = safeName || `profile_${Date.now()}`;
        const profileDir = path.join(this.profilesDir, profileId);

        // 如果目录已存在，追加时间戳
        if (fs.existsSync(profileDir)) {
            profileId = `${profileId}_${Date.now()}`;
        }

        const finalDir = path.join(this.profilesDir, profileId);
        fs.mkdirSync(finalDir, { recursive: true });

        const meta = {
            displayName: displayName.trim(),
            email: '',
            avatarUrl: '',
            createdAt: Date.now(),
            lastUsedAt: Date.now()
        };

        fs.writeFileSync(
            path.join(finalDir, 'profile-meta.json'),
            JSON.stringify(meta, null, 2)
        );

        console.log(`[ProfileManager] 创建 Profile: "${displayName}" (${profileId})`);
        return { id: profileId, ...meta };
    }

    /**
     * 切换到指定 Profile
     * 返回该 Profile 的 Store 实例和配置根路径
     * @param {string} profileId
     * @returns {{store: Store, configRoot: string, profileId: string, meta: Object}}
     */
    switchProfile(profileId) {
        const profileDir = path.join(this.profilesDir, profileId);
        if (!fs.existsSync(profileDir)) {
            throw new Error(`Profile 不存在: ${profileId}`);
        }

        this.currentProfileId = profileId;
        this.currentStore = new Store({
            name: 'uploader-settings',
            cwd: profileDir
        });
        this.currentConfigRoot = profileDir;

        // 更新最后使用时间
        this.globalStore.set('lastProfileId', profileId);
        this.updateProfileMeta(profileId, { lastUsedAt: Date.now() });

        // 读取 meta
        const meta = this.getProfileMeta(profileId);

        console.log(`[ProfileManager] 切换到 Profile: "${meta.displayName}" (${profileId})`);

        return {
            store: this.currentStore,
            configRoot: profileDir,
            profileId,
            meta
        };
    }

    /**
     * 删除 Profile
     * @param {string} profileId
     */
    deleteProfile(profileId) {
        if (!profileId) return { success: false, error: 'ID 不能为空' };

        const profileDir = path.join(this.profilesDir, profileId);
        if (!fs.existsSync(profileDir)) {
            return { success: false, error: 'Profile 不存在' };
        }

        // 不允许删除当前正在使用的 Profile
        if (this.currentProfileId === profileId) {
            return { success: false, error: '不能删除当前正在使用的 Profile' };
        }

        try {
            fs.rmSync(profileDir, { recursive: true, force: true });
            console.log(`[ProfileManager] 已删除 Profile: ${profileId}`);

            // 如果删除的是最后使用的 Profile，清除记录
            if (this.globalStore.get('lastProfileId') === profileId) {
                this.globalStore.delete('lastProfileId');
            }

            return { success: true };
        } catch (error) {
            console.error('[ProfileManager] 删除 Profile 失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 重命名 Profile
     * @param {string} profileId
     * @param {string} newDisplayName
     */
    renameProfile(profileId, newDisplayName) {
        if (!profileId || !newDisplayName?.trim()) {
            return { success: false, error: '参数不完整' };
        }

        const meta = this.getProfileMeta(profileId);
        if (!meta) {
            return { success: false, error: 'Profile 不存在' };
        }

        this.updateProfileMeta(profileId, { displayName: newDisplayName.trim() });
        console.log(`[ProfileManager] 重命名 Profile: ${profileId} -> "${newDisplayName.trim()}"`);
        return { success: true };
    }

    /**
     * 获取 Profile 元信息
     */
    getProfileMeta(profileId) {
        const metaPath = path.join(this.profilesDir, profileId, 'profile-meta.json');
        try {
            return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch {
            return null;
        }
    }

    /**
     * 更新 Profile 元信息
     */
    updateProfileMeta(profileId, updates) {
        const metaPath = path.join(this.profilesDir, profileId, 'profile-meta.json');
        try {
            let meta = {};
            try {
                meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            } catch { /* 文件可能不存在 */ }

            const merged = { ...meta, ...updates };
            fs.writeFileSync(metaPath, JSON.stringify(merged, null, 2));
            return merged;
        } catch (error) {
            console.error('[ProfileManager] 更新 Profile 元信息失败:', error);
            return null;
        }
    }

    /**
     * 当用户登录 Google 后，更新 Profile 的 email 信息
     */
    updateCurrentProfileEmail(email) {
        if (!this.currentProfileId || !email) return;
        this.updateProfileMeta(this.currentProfileId, { email });
    }

    /**
     * 获取最后使用的 Profile ID
     */
    getLastProfileId() {
        return this.globalStore.get('lastProfileId') || null;
    }

    /**
     * 获取当前 Profile ID
     */
    getCurrentProfileId() {
        return this.currentProfileId;
    }

    /**
     * 获取当前 Profile 的 Store
     */
    getCurrentStore() {
        return this.currentStore;
    }

    /**
     * 获取当前 Profile 的配置根路径
     */
    getCurrentConfigRoot() {
        return this.currentConfigRoot;
    }

    /**
     * 检查是否有任何 Profile 存在
     */
    hasAnyProfile() {
        return this.listProfiles().length > 0;
    }

    /**
     * 🔴 迁移旧数据：将旧的全局配置迁移到一个新 Profile 中
     * 适用于从单用户版本升级到多用户版本的情况
     */
    migrateFromLegacy() {
        const legacyStorePath = path.join(this.appDataRoot, 'uploader-settings.json');
        const legacyStatePath = path.join(this.appDataRoot, 'upload-state.json');

        if (!fs.existsSync(legacyStorePath)) {
            console.log('[ProfileManager] 无旧数据需要迁移');
            return null;
        }

        console.log('[ProfileManager] 检测到旧版数据，开始迁移...');

        try {
            // 读取旧 Store 中的用户邮箱作为 Profile 名
            const legacyStore = new Store({
                name: 'uploader-settings',
                cwd: this.appDataRoot
            });
            const email = legacyStore.get('userEmail') || '';
            const displayName = email ? email.split('@')[0] : '默认用户';

            // 创建新 Profile
            const profile = this.createProfile(displayName);
            const profileDir = path.join(this.profilesDir, profile.id);

            // 复制旧配置文件到新 Profile 目录
            fs.copyFileSync(legacyStorePath, path.join(profileDir, 'uploader-settings.json'));
            if (fs.existsSync(legacyStatePath)) {
                fs.copyFileSync(legacyStatePath, path.join(profileDir, 'upload-state.json'));
            }

            // 更新 Profile meta（包含邮箱）
            if (email) {
                this.updateProfileMeta(profile.id, { email, displayName });
            }

            // 重命名旧文件（备份而不是删除）
            fs.renameSync(legacyStorePath, legacyStorePath + '.migrated');
            if (fs.existsSync(legacyStatePath)) {
                fs.renameSync(legacyStatePath, legacyStatePath + '.migrated');
            }

            console.log(`[ProfileManager] 迁移完成: "${displayName}" (${profile.id})`);
            return profile;
        } catch (error) {
            console.error('[ProfileManager] 迁移失败:', error);
            return null;
        }
    }

    // ========== 全局设置（不隔离） ==========

    getGlobalStore() {
        return this.globalStore;
    }

    getWindowState() {
        return this.globalStore.get('windowState') || {};
    }

    setWindowState(state) {
        this.globalStore.set('windowState', state);
    }

    getGlobalZoomFactor() {
        return this.globalStore.get('zoomFactor') || 1;
    }

    setGlobalZoomFactor(zoom) {
        this.globalStore.set('zoomFactor', zoom);
    }
}

module.exports = { ProfileManager };
