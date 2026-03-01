# AI 软件目录 & 审核工作流说明

> 这一节补齐了「AI 常用软件目录 + 审核」模块的 Google Sheet 结构、Apps Script Web App 示范代码以及需要手动完成的操作。按照本页执行完毕后，Electron 应用即可实现：提交 → 待审核列表 → 管理员审核 → 自动写入正式目录的闭环。

## 1. Google Sheet 结构

### 1.1 软件目录分页（默认 `Software`）

| 列 | 内容 | 说明 |
| --- | --- | --- |
| A | 软件类别 | 例如「AI 绘图」 |
| B | 软件名称 | 卡片主标题 |
| C | 软件图标 | 建议直接写 `https://.../logo.png`，而不是 `=IMAGE()` |
| D | 是否常用 | 例如「高 / 中 / 低」 |
| E | 推荐指数 | 4.5/5、五星自定义等 |
| F | 是否安全 | **全词匹配**“安全”才视为绿标。其它值会标红并限制官网按钮 |
| G | 核心功能 | 200 字以内简介 |
| H | 官网链接 | 点击按钮直接打开（安全软件），不安全则仅允许复制 |
| I | 版权审核结果 | 文字说明或公司内网链接 |
| J | 教程 | 可留空 |
| K | 评论 | 可留空 |

> 目录分页只读，所有安装者都从这里拉取数据；管理员审核通过后会自动追加行。

### 1.2 软件申请分页（默认 `SoftwareSubmissions`）

首行请严格按以下顺序填写（建议直接复制此行粘贴到表格）：

```
提交时间,申请人,申请人邮箱,软件类别,软件名称,软件图标,官网链接,是否常用,推荐指数,是否安全,核心功能,版权审核结果,教程,评论,备注,审核状态,审核人,审核备注
```

其中：

1. `提交时间`
2. `申请人`
3. `申请人邮箱`
4. `软件类别`
5. `软件名称`
6. `软件图标`
7. `官网链接`
8. `是否常用`
9. `推荐指数`
10. `是否安全`
11. `核心功能`
12. `版权审核结果`
13. `教程`
14. `评论`
15. `备注`
16. `审核状态`（默认写“待审核”或留空）
17. `审核人`
18. `审核备注`

Apps Script Web App（或 Google 表单）只需要往该 Sheet 新增一行。Electron 应用会拉取所有 `审核状态` 为“待审核”的记录，管理员审核时会把状态/审核人/备注写回，并在通过时自动把核心字段复制到 `Software` 分页。

### 1.3 审核权限分页（默认 `SoftwareAdmins`）

| 列 | 内容 |
| --- | --- |
| 申请人名字 | 申请者可选填 |
| 申请人邮箱 | **必填**，将与登录的 Google 账号比对 |
| 是否授权为管理员 | 只有填“已授权”的邮箱才能在客户端看到“软件审核”面板 |

可扩展其它列（申请时间、说明等），程序会忽略。

## 2. Apps Script Web App

所有安装者提交软件仍通过 Google Apps Script Web App 写入 `SoftwareSubmissions`。请在同一个 Sheet 中新增以下脚本（可放在 `Code.gs`），部署为“网页应用”：

```js
const SPREADSHEET_ID = '在这里填你的 Sheet ID';
const DIRECTORY_SHEET = 'Software';
const SUBMISSION_SHEET = 'SoftwareSubmissions';
const ADMIN_SHEET = 'SoftwareAdmins';

function setupSoftwareSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetsDef = [
    {
      name: DIRECTORY_SHEET,
      headers: [
        '软件类别',
        '软件名称',
        '软件图标',
        '是否常用',
        '推荐指数',
        '是否安全',
        '核心功能',
        '官网链接',
        '版权审核结果',
        '教程',
        '评论'
      ]
    },
    {
      name: SUBMISSION_SHEET,
      headers: [
        '提交时间',
        '申请人',
        '申请人邮箱',
        '软件类别',
        '软件名称',
        '软件图标',
        '官网链接',
        '是否常用',
        '推荐指数',
        '是否安全',
        '核心功能',
        '版权审核结果',
        '教程',
        '评论',
        '备注',
        '审核状态',
        '审核人',
        '审核备注'
      ]
    },
    {
      name: ADMIN_SHEET,
      headers: ['申请人名字', '申请人邮箱', '是否授权为管理员']
    }
  ];
  sheetsDef.forEach((def) => {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    } else {
      sheet.clear();
    }
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, def.headers.length);
  });
  ss.getSheetByName(ADMIN_SHEET).getRange(2, 1, 1, 3).setValues([['管理员示例', 'admin@example.com', '已授权']]);
  SpreadsheetApp.getUi().alert('Software / SoftwareSubmissions / SoftwareAdmins 已创建并写入表头。');
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    appendSubmissionRow({
      timestamp: new Date(),
      applicantName: payload.data?.applicantName || payload.data?.submitter || '',
      applicantEmail: payload.data?.applicantEmail || payload.data?.submitterEmail || '',
      category: payload.data?.category || '',
      name: payload.data?.name || '',
      icon: payload.data?.icon || deriveIcon(payload.data?.website),
      website: payload.data?.website || '',
      usageLevel: payload.data?.usageLevel || '',
      rating: payload.data?.rating || '',
      safety: payload.data?.safety || '',
      summary: payload.data?.summary || '',
      copyrightResult: payload.data?.copyrightResult || '',
      tutorial: payload.data?.tutorial || '',
      comments: payload.data?.comments || '',
      notes: payload.data?.notes || '',
      status: '待审核',
      reviewer: '',
      reviewNotes: ''
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message }, 500);
  }
}

function doGet() {
  return jsonResponse({ ok: true, message: 'Software submission Web App is running.' });
}

function appendSubmissionRow(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SUBMISSION_SHEET);
  if (!sheet) throw new Error(`找不到分页：${SUBMISSION_SHEET}`);
  sheet.appendRow([
    data.timestamp,
    data.applicantName,
    data.applicantEmail,
    data.category,
    data.name,
    data.icon,
    data.website,
    data.usageLevel,
    data.rating,
    data.safety,
    data.summary,
    data.copyrightResult,
    data.tutorial,
    data.comments,
    data.notes,
    data.status,
    data.reviewer,
    data.reviewNotes
  ]);
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function deriveIcon(url) {
  if (!url) return '';
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const domain = new URL(normalized).hostname;
    if (!domain) {
      return '';
    }
    return `https://logo.clearbit.com/${domain}`;
  } catch (error) {
    return '';
  }
}

### 自动补齐图标脚本（可选）

如果希望在用户通过表单/Apps Script 提交后，由表格自身自动根据官网链接补齐图标，可额外添加以下脚本并设置为“修改时触发”或手动运行 `fillMissingIcons()`：

```js
function fillMissingIcons() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SUBMISSION_SHEET);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const iconIndex = header.indexOf('软件图标');
  const websiteIndex = header.indexOf('官网链接');
  if (iconIndex === -1 || websiteIndex === -1) return;
  for (let i = 1; i < data.length; i += 1) {
    const website = data[i][websiteIndex];
    if (!website) continue;
    const domain = extractDomain(website);
    if (!domain) continue;
    const iconUrl = `https://logo.clearbit.com/${domain}`;
    sheet.getRange(i + 1, iconIndex + 1).setValue(iconUrl);
  }
}

function extractDomain(url) {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    return new URL(normalized).hostname;
  } catch (error) {
    return '';
  }
}

function onChange(e) {
  if (!e || e.changeType !== 'EDIT') {
    return;
  }
  fillMissingIcons();
}
```

在 Apps Script 的“触发器”面板中添加 `onChange`（事件类型选“编辑”），即可在每次有人写入表格时自动补齐图标。
```
```

发布步骤：

1. `部署 -> 新部署 -> 网页应用`，选择“执行身份”为自己、允许“任何拥有链接的人”访问。
2. 部署后复制 URL，填到应用的“软件提交表单链接”字段。
3. Google 表单也可以直接写入 `SoftwareSubmissions`，只要列名匹配即可。

> 审核通过时，Electron 应用会把所需字段写入 `Software` 分页；如需更多逻辑（比如自动通知申请人），可以新建 `onEdit` 或额外 API。

## 3. Electron 端需要你配置的内容

在「设置 → AI 软件配置」中，确认填写：

- **软件目录表格 ID**：所有分页都在同一个 Sheet 内；
- **软件目录分页**（默认 `Software!A:K`）；
- **软件申请分页**（默认 `SoftwareSubmissions!A:S`）；
- **审核权限分页**（默认 `SoftwareAdmins!A:C`）；
- **软件提交表单链接**：上文 Apps Script Web App 地址；
- （可选）管理员名单首次写入：在 Sheet 中将自己的邮箱标记为“已授权”，然后在应用里点击“刷新目录”同步。

## 4. 管理员在桌面应用内的流程

1. 登录 Google（邮箱需在 `SoftwareAdmins` 中标记“已授权”）；
2. 切到“AI 软件目录”页，点击“刷新目录”同步最新数据及授权信息；
3. 切到“软件审核”页签即可看到所有待审核申请，逐条点击“通过/驳回”；
4. 操作成功后，状态会写回 `SoftwareSubmissions`，通过的条目会自动附加到 `Software` 分页；
5. 如需追踪历史，可在 Sheet 中通过筛选列（审核状态/审核备注）查看。

## 5. 仍需你手动完成的事项

- **部署 Apps Script Web App**：在你的表格中粘贴示例脚本或自定义脚本，并发布成 Web 应用（Electron 端只调用你提供的 URL）。
- **维护 Sheet 结构与权限**：确保 `Software`、`SoftwareSubmissions`、`SoftwareAdmins` 三个分页存在，且列名符合上面约定。
- **共享/权限控制**：将整个表格分享给所有需要使用的 Google 账号（至少“查看”权限，管理员需“编辑”权限），否则桌面应用无法读取。
- **管理员名单**：在 `SoftwareAdmins` 中维护“申请人邮箱 + 是否授权为管理员”。客户端只读，不会修改该表。
- **额外通知/同步需求**：若要发送邮件或同步到其他系统，请在 Apps Script 中补充逻辑。

完成以上配置后，应用内的提交/审核/目录展示即为自动闭环；后续若调整列名或分页范围，请同步更新「设置 → AI 软件配置」中的对应字段。***



const SHEETS = {
  DIRECTORY: {
    name: 'Software',
    headers: [
      '软件类别',
      '软件名称',
      '软件图标',
      '是否常用',
      '推荐指数',
      '是否安全',
      '核心功能',
      '官网链接',
      '版权审核结果',
      '教程',
      '评论'
    ]
  },
  SUBMISSIONS: {
    name: 'SoftwareSubmissions',
    headers: [
      '提交时间',
      '申请人',
      '申请人邮箱',
      '软件类别',
      '软件名称',
      '软件图标',
      '官网链接',
      '是否常用',
      '推荐指数',
      '是否安全',
      '核心功能',
      '版权审核结果',
      '教程',
      '评论',
      '备注',
      '审核状态',
      '审核人',
      '审核备注'
    ]
  },
  ADMINS: {
    name: 'SoftwareAdmins',
    headers: ['申请人名字', '申请人邮箱', '是否授权为管理员']
  }
};

function setupSoftwareSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(SHEETS).forEach((sheetDef) => {
    let sheet = ss.getSheetByName(sheetDef.name);
    if (!sheet) {
      sheet = ss.insertSheet(sheetDef.name);
    } else {
      sheet.clear();
    }
    sheet.getRange(1, 1, 1, sheetDef.headers.length).setValues([sheetDef.headers]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, sheetDef.headers.length);
  });

  // 可选：在管理员分页预填一行，方便修改
  const adminSheet = ss.getSheetByName(SHEETS.ADMINS.name);
  const sampleRow = ['管理员示例', 'admin@example.com', '已授权'];
  adminSheet.getRange(2, 1, 1, sampleRow.length).setValues([sampleRow]);

  SpreadsheetApp.getUi().alert('Software / SoftwareSubmissions / SoftwareAdmins 已创建并写入表头。');
}
