/**
 * 云端文件分拣器 — 批量下载控制器
 * 支持：暂停/继续、停止、断点续传
 */
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class DownloadController extends EventEmitter {
  constructor() {
    super();
    this.state = 'idle'; // idle | downloading | paused | stopped | done
    this.queue = [];        // { fileId, fileName, size, url, destPath }
    this.current = null;
    this.currentIndex = 0;
    this.totalFiles = 0;
    this.completedFiles = 0;
    this.failedFiles = 0;
    this.bytesDownloaded = 0;
    this.totalBytes = 0;
    this.currentFileBytes = 0;
    this.currentFileTotalBytes = 0;
    this._paused = false;
    this._stopped = false;
    this._resumeResolve = null;
    this._currentReq = null;
    this._currentStream = null;
    this._accessToken = null;
    this._destDir = '';
  }

  /**
   * 开始批量下载
   * @param {Array} files - [{ id, name, size, mimeType }]
   * @param {string} destDir - 目标目录
   * @param {string} accessToken - Google OAuth token
   */
  async start(files, destDir, accessToken) {
    if (this.state === 'downloading') return;

    this._accessToken = accessToken;
    this._destDir = destDir;
    this._paused = false;
    this._stopped = false;
    this.completedFiles = 0;
    this.failedFiles = 0;
    this.bytesDownloaded = 0;

    // 构建下载队列
    this.queue = files.map(f => ({
      fileId: f.id,
      fileName: this._sanitizeFilename(f.name),
      size: parseInt(f.size || 0, 10),
      mimeType: f.mimeType,
      destPath: path.join(destDir, this._sanitizeFilename(f.name)),
      status: 'pending', // pending | downloading | done | failed | skipped
      error: null,
      bytesDownloaded: 0
    }));

    // 处理同名文件
    this._resolveNameConflicts();

    this.totalFiles = this.queue.length;
    this.totalBytes = this.queue.reduce((sum, f) => sum + f.size, 0);
    this.currentIndex = 0;
    this._changeState('downloading');

    // 逐个下载
    for (let i = 0; i < this.queue.length; i++) {
      if (this._stopped) break;

      // 暂停检查
      if (this._paused) {
        this._changeState('paused');
        await new Promise(resolve => { this._resumeResolve = resolve; });
        if (this._stopped) break;
        this._changeState('downloading');
      }

      this.currentIndex = i;
      this.current = this.queue[i];

      try {
        await this._downloadFile(this.queue[i]);
        this.queue[i].status = 'done';
        this.completedFiles++;
      } catch (err) {
        if (this._stopped) break;
        if (err.message === 'PAUSED') {
          i--; continue; // 重试当前文件
        }
        this.queue[i].status = 'failed';
        this.queue[i].error = err.message;
        this.failedFiles++;
        console.error(`[Download] 下载失败 ${this.queue[i].fileName}:`, err.message);
      }

      this._emitProgress();
    }

    this.current = null;
    if (this._stopped) {
      this._changeState('stopped');
    } else {
      this._changeState('done');
    }
  }

  pause() {
    if (this._paused || this._stopped || this.state !== 'downloading') return;
    this._paused = true;
    // 中断当前请求，等续传
    if (this._currentReq) {
      try { this._currentReq.destroy(); } catch (e) {}
      this._currentReq = null;
    }
    this._changeState('paused');
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    if (this._resumeResolve) {
      this._resumeResolve();
      this._resumeResolve = null;
    }
    this._changeState('downloading');
  }

  stop() {
    if (this._stopped) return;
    this._stopped = true;
    this._paused = false;
    if (this._currentReq) {
      try { this._currentReq.destroy(); } catch (e) {}
      this._currentReq = null;
    }
    if (this._currentStream) {
      try { this._currentStream.close(); } catch (e) {}
      this._currentStream = null;
    }
    if (this._resumeResolve) {
      this._resumeResolve();
      this._resumeResolve = null;
    }
    this._changeState('stopped');
  }

  getProgress() {
    return {
      state: this.state,
      totalFiles: this.totalFiles,
      completedFiles: this.completedFiles,
      failedFiles: this.failedFiles,
      currentIndex: this.currentIndex,
      currentFileName: this.current?.fileName || '',
      currentFileBytes: this.currentFileBytes,
      currentFileTotalBytes: this.currentFileTotalBytes,
      bytesDownloaded: this.bytesDownloaded,
      totalBytes: this.totalBytes,
      queue: this.queue.map(f => ({ fileName: f.fileName, status: f.status, size: f.size, bytesDownloaded: f.bytesDownloaded, error: f.error }))
    };
  }

  // ── Internal ──

  _changeState(next) {
    if (this.state === next) return;
    this.state = next;
    this._emitProgress();
  }

  _emitProgress() {
    this.emit('progress', this.getProgress());
  }

  _sanitizeFilename(name) {
    // 替换不安全字符
    return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'untitled';
  }

  _resolveNameConflicts() {
    const seen = {};
    for (const f of this.queue) {
      if (seen[f.destPath]) {
        const ext = path.extname(f.fileName);
        const base = path.basename(f.fileName, ext);
        let n = 1;
        do {
          f.fileName = `${base} (${n})${ext}`;
          f.destPath = path.join(this._destDir, f.fileName);
          n++;
        } while (seen[f.destPath]);
      }
      seen[f.destPath] = true;
    }
  }

  async _downloadFile(fileInfo) {
    const { fileId, destPath, mimeType } = fileInfo;

    // Google Workspace 文件需要导出
    const isGoogleDoc = mimeType?.startsWith('application/vnd.google-apps.');
    let url;
    if (isGoogleDoc) {
      const exportMap = {
        'application/vnd.google-apps.document': 'application/pdf',
        'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.google-apps.presentation': 'application/pdf',
        'application/vnd.google-apps.drawing': 'image/png'
      };
      const exportMime = exportMap[mimeType] || 'application/pdf';
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}&alt=media`;
      // 调整扩展名
      const extMap = {
        'application/pdf': '.pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'image/png': '.png'
      };
      if (extMap[exportMime] && !fileInfo.destPath.endsWith(extMap[exportMime])) {
        fileInfo.fileName += extMap[exportMime];
        fileInfo.destPath += extMap[exportMime];
      }
    } else {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    // 检查已有部分下载（断点续传）
    const tempPath = destPath + '.part';
    let existingBytes = 0;
    if (fs.existsSync(tempPath)) {
      existingBytes = fs.statSync(tempPath).size;
    } else if (fs.existsSync(destPath)) {
      // 已完成下载，跳过
      fileInfo.status = 'skipped';
      return;
    }

    fileInfo.bytesDownloaded = existingBytes;
    this.currentFileBytes = existingBytes;
    this.currentFileTotalBytes = fileInfo.size || 0;
    fileInfo.status = 'downloading';

    return new Promise((resolve, reject) => {
      const headers = {
        Authorization: `Bearer ${this._accessToken}`
      };
      // 断点续传
      if (existingBytes > 0 && !isGoogleDoc) {
        headers['Range'] = `bytes=${existingBytes}-`;
      }

      const req = https.get(url, { headers }, (res) => {
        // 处理重定向
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          req.destroy();
          const redirectUrl = res.headers.location;
          this._followRedirect(redirectUrl, headers, existingBytes, tempPath, destPath, fileInfo, resolve, reject);
          return;
        }

        if (res.statusCode >= 400) {
          req.destroy();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        // 获取总大小
        const contentLength = parseInt(res.headers['content-length'] || '0', 10);
        if (res.statusCode === 200) {
          // 完整下载
          this.currentFileTotalBytes = contentLength || fileInfo.size;
          fileInfo.size = this.currentFileTotalBytes;
          existingBytes = 0;
          fileInfo.bytesDownloaded = 0;
          this.currentFileBytes = 0;
        } else if (res.statusCode === 206) {
          // 部分内容
          const range = res.headers['content-range'];
          if (range) {
            const total = parseInt(range.split('/')[1], 10);
            if (total) {
              this.currentFileTotalBytes = total;
              fileInfo.size = total;
            }
          }
        }

        const stream = fs.createWriteStream(tempPath, {
          flags: existingBytes > 0 ? 'a' : 'w'
        });
        this._currentStream = stream;
        this._currentReq = req;

        res.on('data', (chunk) => {
          if (this._stopped || this._paused) {
            req.destroy();
            stream.end();
            if (this._stopped) {
              reject(new Error('STOPPED'));
            } else {
              reject(new Error('PAUSED'));
            }
            return;
          }
          fileInfo.bytesDownloaded += chunk.length;
          this.currentFileBytes = fileInfo.bytesDownloaded;
          this.bytesDownloaded += chunk.length;
          this._emitProgress();
        });

        res.pipe(stream);

        stream.on('finish', () => {
          this._currentStream = null;
          this._currentReq = null;
          if (!this._stopped && !this._paused) {
            // 重命名 .part → 最终文件名
            try {
              if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
              fs.renameSync(tempPath, destPath);
            } catch (e) {
              reject(new Error(`重命名失败: ${e.message}`));
              return;
            }
            resolve();
          }
        });

        stream.on('error', (err) => {
          this._currentStream = null;
          this._currentReq = null;
          reject(err);
        });
      });

      req.on('error', (err) => {
        if (this._stopped || this._paused) return;
        reject(err);
      });
    });
  }

  _followRedirect(url, headers, existingBytes, tempPath, destPath, fileInfo, resolve, reject) {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode >= 400) {
        req.destroy();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const contentLength = parseInt(res.headers['content-length'] || '0', 10);
      if (res.statusCode === 200) {
        this.currentFileTotalBytes = contentLength || fileInfo.size;
        existingBytes = 0;
        this.currentFileBytes = 0;
        fileInfo.bytesDownloaded = 0;
      }

      const stream = fs.createWriteStream(tempPath, {
        flags: existingBytes > 0 ? 'a' : 'w'
      });
      this._currentStream = stream;
      this._currentReq = req;

      res.on('data', (chunk) => {
        if (this._stopped || this._paused) {
          req.destroy();
          stream.end();
          if (this._stopped) reject(new Error('STOPPED'));
          else reject(new Error('PAUSED'));
          return;
        }
        fileInfo.bytesDownloaded += chunk.length;
        this.currentFileBytes = fileInfo.bytesDownloaded;
        this.bytesDownloaded += chunk.length;
        this._emitProgress();
      });

      res.pipe(stream);

      stream.on('finish', () => {
        this._currentStream = null;
        this._currentReq = null;
        if (!this._stopped && !this._paused) {
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            fs.renameSync(tempPath, destPath);
          } catch (e) {
            reject(new Error(`重命名失败: ${e.message}`));
            return;
          }
          resolve();
        }
      });

      stream.on('error', reject);
    });

    req.on('error', (err) => {
      if (!this._stopped && !this._paused) reject(err);
    });
  }
}

module.exports = { DownloadController };
