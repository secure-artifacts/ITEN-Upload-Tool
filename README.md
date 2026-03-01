# 美工自动入库填表（Google Drive & Sheets 桌面工具）

Electron 桌面应用，支持在 Windows / macOS / Linux 上批量上传本地素材（视频、图片、音频等）到 Google Drive，并自动按照命名规范写入 Google 表格。界面为中文，可配置命名模板、Drive 目标文件夹、Sheets Range 等参数。

## 功能亮点

- 🔐 Google OAuth2 登录（内置回调服务，使用自己的 Client ID/Secret）
- ☁️ 批量上传任意文件到指定的 Drive 文件夹，可为多个分类分别配置图片描述、本地目录与目标云端文件夹
- ⏯ 上传任务支持暂停、继续、停止，并在分类卡片中实时显示「上传中 / 成功 / 未上传」
- 🗂 固定命名拼装器：国家-日期-软件-图片描述-提交人-序号（示例：`IT-20240918-MJ-女性扫地工-小李-01`），并按命名结果自动去重
- 📑 将上传记录写入 Google Sheets：包含「提交人 / 制作情况 / 完成日期 / 成品链接 / 主类别 / 子类别」等字段，并自动将“是否可以提交入库”写入为“是”
- 🧭 主/子类别与 Drive 文件夹 ID 可直接从 `数据验证` 分页同步，保证与现有数据验证规则一致
- 💾 所有配置持久化保存，无需重复输入

## 使用前准备

1. **创建 Google Cloud 项目**，在 [Google Cloud Console](https://console.cloud.google.com/) 中启用以下 API：
   - Google Drive API
   - Google Sheets API
2. **创建 OAuth 同意屏幕**，类型选择 “桌面应用”。
3. **创建 OAuth Client ID**，下载或复制 Client ID / Client Secret。
4. **授权回调**：应用会在本地启动 `http://127.0.0.1:<端口>/oauth2callback`（默认端口 42813），请在 OAuth 客户端的授权重定向 URI 中添加对应地址。
5. 准备好目标 **Drive 文件夹 ID** 与 **Google Sheet ID**：
   - Drive 文件夹 ID 可从 `https://drive.google.com/drive/folders/<folderId>` 链接中获取。
   - Sheet ID 为 `https://docs.google.com/spreadsheets/d/<sheetId>/edit` 中的部分。

## 安装 & 运行

```bash
npm install
npm run dev # 或 npm start
```

首次运行步骤：

1. 在界面顶部的“基础配置”中填写 Client ID / Secret、回调端口、Drive 文件夹 ID、Sheet ID、分类 Sheet 名称（默认 `数据验证`）与数据范围（默认 `数据验证!A2:C`），点击“保存配置”。
2. 点击右上角“登录 Google”，完成 OAuth 授权（第一次需在 Cloud Console 的「OAuth 同意屏幕」里把自己的账号加入测试用户）。
3. 在“命名规则”中可自定义命名模板（默认为 `{{country}}-{{customDate}}-{{software}}-{{subject}}-{{submitter}}-{{admin}}-{{counter}}`），点击占位符按钮即可插入变量并拖拽分类/管理员字段调整组合；也可使用 `{{subjectOrOriginal}}` 让系统在图片描述为空时自动使用原文件名。
4. 在“表格数据填写”区域补充提交人、完成日期（“是否可以提交入库”默认写入“是”），点击“同步分类”即可从 `数据验证` 分页（A/B/C 列：主类 / 子类 / Drive 文件夹 ID）获取最新分类。
5. 在“分类文件 & 预览”中可新增多个分类卡片：为每个分类选择主/子类别、填写图片描述，并通过“选择目录”或直接将本地文件夹 / 多个文件拖拽到卡片上来绑定。系统会根据分类自动切换 Drive 目标文件夹、为每个提交自动新建“日期-提交人-管理员”子文件夹并写入文件夹链接到表格，同时按照统一命名规则批量生成文件名（若图片描述留空，会询问是否使用子类别名称）。
6. 点击“开始上传”触发任务；上传过程中可以使用“暂停 / 继续 / 停止”，日志与分类卡片会实时显示“上传中 / 已完成 / 未上传”等状态，并自动跳过命名重复的文件。

## 命名模板占位符

默认模板：`{{country}}-{{customDate}}-{{software}}-{{subject}}-{{submitter}}-{{admin}}-{{counter}}`

您可以在“命名拼装器”中输入国家（如 IT）、日期（自动转成 20240918）、软件缩写（如 MJ）、图片描述（如 女性扫地工）和提交人姓名，系统会自动补齐序号位数。

如需更复杂的命名，可在输入框内自由组合下列占位符：

| 占位符 | 含义 |
| --- | --- |
| `{{country}}` | 国家 / 地区代号（IT、CN 等） |
| `{{customDate}}` | 命名日期，来自界面中的日期选择器 |
| `{{software}}` | 软件或流程缩写 |
| `{{subject}}` | 图片 / 视频描述 |
| `{{submitter}}` | 提交人（表单中填写的姓名） |
| `{{admin}}` | 管理员字段（在分类中可填写） |
| `{{originalName}}` | 原文件名（不含扩展名） |
| `{{subjectOrOriginal}}` | 图片描述优先，若为空则使用原文件名 |
| `{{counter}}` | 序号，支持起始值、位数、步长配置 |
| 其它默认字段 | `{{date}}`（系统时间）、`{{originalName}}` 等基础 token 仍可使用 |

> 文件名会自动过滤非法字符并控制总长度不超过 240 个字符，扩展名会自动保留。

## Google Sheets 写入

- 默认写入 Range 为 `Uploads!A:G`（可自定义），并按以下列顺序写入：
  1. 提交人（A 列）
  2. 提交日期（B 列）
  3. 最终链接（C 列）
  4. 主类别（D 列）
  5. 子类别（E 列）
  6. 是否可以提交入库（F 列，默认写入“是”）
  7. 管理员（G 列）
- 主/子类别与上传目标文件夹取自 `数据验证` 分页（A 列主类、B 列子类、C 列文件夹 ID），上传前点击“同步分类”即可更新映射。
- 若不填写 Sheet ID，将跳过填表步骤，仅执行 Drive 上传。

## 常见问题

- **授权端口被占用**：修改“本地回调端口”，同时在 OAuth 客户端配置中添加新的 Redirect URI。
- **提示未授权**：需要重新点击“登录 Google”，或在 `~/Library/Application Support/uploader-settings`（macOS）等目录中清空 `googleTokens` 后重新授权。
- **文件很多/体积大**：目前按顺序串行上传；如需更高吞吐，可在 `googleService.uploadFiles` 中引入并发控制。

## 下一步可以扩展的能力

1. 更细颗粒度的上传进度（单文件百分比、速率统计）
2. 命名器支持自定义字段库、可视化模板管理
3. 通过 Electron Builder 打包成安装程序、支持自动更新
4. 增加离线任务记录与失败重试/断点续传机制

欢迎根据实际业务调整元数据字段与表头逻辑！

## AI 软件目录 & 审核（新）

仓库已包含“AI 常用软件目录 + 审核”模块，提供软件目录展示、分类/搜索、管理员申请同步、软件审核等功能。请按照 [`docs/software-directory.md`](docs/software-directory.md) 的说明准备 Google Sheet 的三个分页（目录 / 申请 / 审核权限），并在设置中填写 Range、提交入口等信息。提交入口默认通过 Apps Script Web App 实现，如需自动补齐图标，可在表格中添加附带的脚本。

## 如何发布新版本

本项目使用 GitHub Actions 自动构建和发布。每次发布新版本只需要创建一个 Git Tag 并推送即可。

### 发布步骤

#### 1. 确保代码已提交并推送

```bash
git status
git add .
git commit -m "你的改动说明"
git push origin main
```

#### 2. 创建版本 Tag 并触发自动构建

```bash
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin v1.0.1
```

推送后，GitHub Actions 会自动构建 macOS + Windows 双平台、生成安全签名（Attestation）并创建 Release。

#### 3. 如果构建失败

```bash
git tag -d v1.0.1
git push origin :refs/tags/v1.0.1
# 修复后重新创建
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin v1.0.1
```
