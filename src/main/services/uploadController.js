const { EventEmitter } = require('events');

class UploadController extends EventEmitter {
  constructor() {
    super();
    this.paused = false;
    this.stopped = false;
    this._resume = null;
    this._pausePromise = null;
    this.state = 'idle';
    this.currentFileId = null;
    this.abortController = null;
    this.waitingForCurrentFile = false;
  }

  changeState(next) {
    if (this.state === next) {
      return;
    }
    this.state = next;
    this.emit('state', next, {
      waitingForFile: this.waitingForCurrentFile,
      currentFileId: this.currentFileId
    });
  }

  start() {
    this.changeState('uploading');
  }

  // 设置当前正在上传的文件
  setCurrentFile(fileId) {
    this.currentFileId = fileId;
    // 为当前文件创建新的 AbortController
    this.abortController = new AbortController();
  }

  // 清除当前文件
  clearCurrentFile() {
    this.currentFileId = null;
    this.abortController = null;
    this.waitingForCurrentFile = false;
  }

  // 获取当前的 abort signal
  getAbortSignal() {
    return this.abortController?.signal;
  }

  pause() {
    if (this.paused || this.stopped) {
      return;
    }
    this.paused = true;

    // 如果有正在上传的文件，标记为等待状态
    if (this.currentFileId) {
      this.waitingForCurrentFile = true;
      this.changeState('pausing'); // 新状态：正在暂停（等待当前文件）
    }

    this._pausePromise = new Promise((resolve) => {
      this._resume = () => {
        this.paused = false;
        this._pausePromise = null;
        this._resume = null;
        this.waitingForCurrentFile = false;
        resolve();
      };
    });

    if (!this.currentFileId) {
      this.changeState('paused');
    }
  }

  // 当前文件完成后调用，检查是否需要进入暂停状态
  onFileComplete() {
    this.clearCurrentFile();
    if (this.paused && this.waitingForCurrentFile) {
      this.waitingForCurrentFile = false;
      this.changeState('paused');
    }
  }

  resume() {
    if (!this.paused) {
      return;
    }
    if (this._resume) {
      this._resume();
    }
    this.waitingForCurrentFile = false;
    this.changeState('uploading');
  }

  stop() {
    if (this.stopped) {
      return;
    }
    this.stopped = true;

    // 尝试中断当前上传
    if (this.abortController) {
      try {
        this.abortController.abort();
        console.log('[UploadController] 已发送中断信号');
      } catch (e) {
        console.warn('[UploadController] 中断信号发送失败:', e.message);
      }
    }

    if (this.paused && this._resume) {
      this._resume();
    }
    this.waitingForCurrentFile = false;
    this.changeState('stopped');
  }

  isStopped() {
    return this.stopped;
  }

  isPaused() {
    return this.paused;
  }

  isWaitingForFile() {
    return this.waitingForCurrentFile;
  }

  async waitIfPaused() {
    if (!this.paused) {
      return;
    }
    if (this._pausePromise) {
      await this._pausePromise;
    }
  }
}

module.exports = { UploadController };
