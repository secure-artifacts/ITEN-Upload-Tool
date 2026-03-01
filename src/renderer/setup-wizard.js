/**
 * 🔴 首次启动设置向导
 * 
 * 当检测到未配置 Client ID 时自动弹出
 * 两种路径：
 *   1. 管理员手动配置（引导填写 Client ID、Sheet ID 等）
 *   2. 成员导入团队配置文件
 */
(function () {
    'use strict';

    const wizard = document.getElementById('setup-wizard-overlay');
    if (!wizard) return;

    // ========== DOM 引用 ==========
    const stepIndicators = wizard.querySelectorAll('.wizard-step-dot');
    const panels = wizard.querySelectorAll('.wizard-panel');
    const btnImport = document.getElementById('wizard-choose-import');
    const btnManual = document.getElementById('wizard-choose-manual');
    const btnImportFile = document.getElementById('wizard-import-file-btn');
    const importStatus = document.getElementById('wizard-import-status');
    const skipBtn = document.getElementById('wizard-skip-btn');

    // 手动配置表单字段
    const fieldClientId = document.getElementById('wizard-client-id');
    const fieldClientSecret = document.getElementById('wizard-client-secret');
    const fieldSheetId = document.getElementById('wizard-sheet-id');
    const fieldDriveFolderId = document.getElementById('wizard-drive-folder-id');
    const btnManualNext = document.getElementById('wizard-manual-next');
    const btnManualBack = document.getElementById('wizard-manual-back');
    const btnManualSave = document.getElementById('wizard-manual-save');
    const btnManualBack2 = document.getElementById('wizard-manual-back2');
    const btnImportBack = document.getElementById('wizard-import-back');

    let currentStep = 0;

    // ========== 初始化检测 ==========
    async function checkNeedSetup() {
        try {
            const data = await window.bridge.loadConfig();
            const config = data?.config || {};

            // 已配置过 Client ID → 不需要向导
            if (config.clientId && config.clientId.trim()) {
                hideWizard();
                return;
            }

            // 未配置 → 显示向导
            showWizard();
        } catch (err) {
            console.error('[SetupWizard] 检测配置失败:', err);
        }
    }

    // ========== 显示/隐藏 ==========
    function showWizard() {
        wizard.hidden = false;
        requestAnimationFrame(() => wizard.classList.add('visible'));
        showStep(0);
    }

    function hideWizard() {
        wizard.classList.remove('visible');
        setTimeout(() => { wizard.hidden = true; }, 300);
    }

    function showStep(step) {
        currentStep = step;
        panels.forEach((p, i) => {
            p.classList.toggle('active', i === step);
        });
        stepIndicators.forEach((dot, i) => {
            dot.classList.toggle('active', i === step);
            dot.classList.toggle('done', i < step);
        });
    }

    // ========== 路径选择 ==========

    // 选择「导入配置」
    btnImport?.addEventListener('click', () => showStep(1));

    // 选择「手动配置」
    btnManual?.addEventListener('click', () => showStep(2));

    // 返回按钮
    btnImportBack?.addEventListener('click', () => showStep(0));
    btnManualBack?.addEventListener('click', () => showStep(0));
    btnManualBack2?.addEventListener('click', () => showStep(2));

    // 跳过向导
    skipBtn?.addEventListener('click', () => {
        hideWizard();
    });

    // ========== 导入配置文件 ==========
    btnImportFile?.addEventListener('click', async () => {
        try {
            btnImportFile.disabled = true;
            btnImportFile.textContent = '正在导入...';
            importStatus.hidden = true;

            const result = await window.bridge.importConfig();

            if (!result.imported) {
                btnImportFile.textContent = '选择配置文件';
                btnImportFile.disabled = false;
                return;
            }

            // 导入成功
            importStatus.hidden = false;
            importStatus.className = 'wizard-import-status success';
            importStatus.textContent = '✅ 配置导入成功！正在加载...';

            // 等待一下再刷新
            setTimeout(() => {
                location.reload();
            }, 1200);
        } catch (err) {
            importStatus.hidden = false;
            importStatus.className = 'wizard-import-status error';
            importStatus.textContent = `❌ 导入失败: ${err.message}`;
            btnImportFile.textContent = '重新选择';
            btnImportFile.disabled = false;
        }
    });

    // ========== 手动配置 — Step 1: 凭证 ==========
    btnManualNext?.addEventListener('click', () => {
        const clientId = fieldClientId?.value?.trim();
        const clientSecret = fieldClientSecret?.value?.trim();

        if (!clientId) {
            fieldClientId.focus();
            fieldClientId.classList.add('shake');
            setTimeout(() => fieldClientId.classList.remove('shake'), 500);
            return;
        }
        if (!clientSecret) {
            fieldClientSecret.focus();
            fieldClientSecret.classList.add('shake');
            setTimeout(() => fieldClientSecret.classList.remove('shake'), 500);
            return;
        }

        showStep(3);
    });

    // ========== 手动配置 — Step 2: 表格和目录 → 保存 ==========
    btnManualSave?.addEventListener('click', async () => {
        const clientId = fieldClientId?.value?.trim();
        const clientSecret = fieldClientSecret?.value?.trim();
        const sheetId = fieldSheetId?.value?.trim();
        const driveFolderId = fieldDriveFolderId?.value?.trim();

        if (!clientId || !clientSecret) {
            showStep(2);
            return;
        }

        btnManualSave.disabled = true;
        btnManualSave.textContent = '保存中...';

        try {
            // 验证 Firebase 配置
            const firebaseConfig = buildFirebaseConfig();
            if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
                const fbApiKeyEl = document.getElementById('wizard-firebase-apikey');
                if (fbApiKeyEl) {
                    fbApiKeyEl.focus();
                    fbApiKeyEl.classList.add('shake');
                    setTimeout(() => fbApiKeyEl.classList.remove('shake'), 500);
                }
                btnManualSave.disabled = false;
                btnManualSave.textContent = '保存并完成';
                return;
            }

            // 提取 Sheet ID (支持粘贴完整链接)
            const extractedSheetId = extractSheetId(sheetId);
            const extractedFolderId = extractFolderId(driveFolderId);

            await window.bridge.saveConfig({
                clientId,
                clientSecret,
                sheetId: extractedSheetId || '',
                driveFolderId: extractedFolderId || '',
                firebase: firebaseConfig
            });

            // 保存成功，进入第四步（完成页面）
            showStep(4);

        } catch (err) {
            alert('保存失败: ' + err.message);
            btnManualSave.disabled = false;
            btnManualSave.textContent = '保存并完成';
        }
    });

    // 完成向导 → 刷新页面
    document.getElementById('wizard-finish-btn')?.addEventListener('click', () => {
        location.reload();
    });

    // ========== 导出团队配置 ==========
    document.getElementById('wizard-export-team-config')?.addEventListener('click', async () => {
        try {
            await window.bridge.exportTeamConfig();
        } catch (err) {
            alert('导出失败: ' + err.message);
        }
    });

    // 也绑定设置页面的导出按钮
    document.getElementById('export-team-config-btn')?.addEventListener('click', async () => {
        try {
            await window.bridge.exportTeamConfig();
        } catch (err) {
            alert('导出失败: ' + err.message);
        }
    });

    // ========== 工具函数 ==========

    function extractSheetId(input) {
        if (!input) return '';
        // https://docs.google.com/spreadsheets/d/SHEET_ID/edit
        const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : input;
    }

    function extractFolderId(input) {
        if (!input) return '';
        // https://drive.google.com/drive/folders/FOLDER_ID
        const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : input;
    }

    function buildFirebaseConfig() {
        const apiKey = document.getElementById('wizard-firebase-apikey')?.value?.trim();
        const authDomain = document.getElementById('wizard-firebase-authdomain')?.value?.trim() || '';
        const databaseURL = document.getElementById('wizard-firebase-dburl')?.value?.trim() || '';
        const projectId = document.getElementById('wizard-firebase-projectid')?.value?.trim() || '';

        if (!apiKey) return null;

        return { apiKey, authDomain, databaseURL, projectId };
    }

    // ========== 启动 ==========
    checkNeedSetup();
})();
