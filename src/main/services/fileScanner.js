const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const FileType = require('file-type');

async function scanFolder(targetPath) {
  const results = [];
  if (!targetPath) {
    return results;
  }
  const stats = await fs.promises.stat(targetPath);
  if (stats.isDirectory()) {
    await walk(targetPath, targetPath, results);
  } else if (stats.isFile()) {
    results.push(await buildEntry(targetPath, path.dirname(targetPath), stats));
  }
  return results;
}

async function buildEntry(fullPath, rootPath, stats) {
  const relativePath = path.relative(rootPath, fullPath);
  const name = path.basename(fullPath);
  let extension = path.extname(name);
  const normalizedExt = (extension || '').toLowerCase();
  let mimeType = mime.lookup(name) || mime.lookup(normalizedExt) || '';
  if (!mimeType || mimeType === 'application/octet-stream') {
    try {
      const detected = await FileType.fromFile(fullPath);
      if (detected?.mime) {
        mimeType = detected.mime;
      }
      if (detected?.ext && !extension) {
        extension = `.${detected.ext}`;
      }
    } catch (error) {
      // ignore detection errors
    }
  }
  mimeType = mimeType || 'application/octet-stream';
  const info = stats || (await fs.promises.stat(fullPath));
  return {
    id: `${relativePath || name}-${info.size}-${info.mtimeMs}`,
    path: fullPath,
    relativePath,
    name,
    size: info.size,
    extension,
    mimeType,
    createdAt: info.birthtimeMs,
    updatedAt: info.mtimeMs
  };
}

async function walk(currentPath, rootPath, container) {
  const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, rootPath, container);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const stats = await fs.promises.stat(fullPath);
    container.push(await buildEntry(fullPath, rootPath, stats));
  }
}

module.exports = { scanFolder };
