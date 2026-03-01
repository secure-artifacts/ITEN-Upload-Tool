const path = require('path');

const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

class FileNamer {
  constructor(options = {}) {
    this.pattern = options.pattern || '{{originalName}}{{ext}}';
    this.dateFormat = options.dateFormat || 'YYYYMMDD-HHmmss';
    this.counterPadding = Number.isInteger(options.counterPadding)
      ? options.counterPadding
      : 3;
    this.timezone = options.timezone || 'local';
  }

  buildName(file, metadata = {}, counter = 1) {
    const parsed = path.parse(file.name || '');
    const ext = parsed.ext || file.extension || '';
    const tokens = {
      originalName: parsed.name,
      ext,
      extension: ext,
      relativePath: file.relativePath || parsed.base,
      mimeType: file.mimeType || '',
      size: file.size || 0,
      counter: this.padCounter(counter),
      date: this.formatDate(new Date())
    };

    Object.entries(metadata || {}).forEach(([key, value]) => {
      tokens[key] = value == null ? '' : String(value);
    });

    if (!tokens.ownerInitials && tokens.owner) {
      tokens.ownerInitials = this.extractInitials(tokens.owner);
    }

    tokens.subjectOrOriginal = tokens.subject ? tokens.subject : tokens.originalName;

    // 调试日志：记录pattern和customText相关的tokens
    console.log('[FileNamer] Pattern:', this.pattern);
    const customTextKeys = Object.keys(tokens).filter(k => k.startsWith('customText:'));
    console.log('[FileNamer] CustomText keys in tokens:', customTextKeys);
    customTextKeys.forEach(k => {
      console.log(`[FileNamer]   ${k} =`, tokens[k]);
    });

    let result = this.pattern.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const cleanKey = key.trim();
      console.log(`[FileNamer] Replacing token: "${match}", cleanKey: "${cleanKey}", value:`, tokens[cleanKey]);
      if (tokens[cleanKey] === undefined) {
        console.log(`[FileNamer]   Token "${cleanKey}" is undefined, keeping original`);
        return match; // 保留原样而不是返回空字符串
      }
      const sanitized = this.sanitize(tokens[cleanKey]);
      console.log(`[FileNamer]   Sanitized value:`, sanitized);
      return sanitized;
    });

    if (!result.includes(ext) && !result.endsWith(ext)) {
      result += ext;
    }

    return this.trimLength(result);
  }

  padCounter(counter) {
    return String(counter).padStart(this.counterPadding, '0');
  }

  formatDate(date) {
    let targetDate = date;
    if (this.timezone === 'utc') {
      targetDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    }

    const components = {
      YYYY: targetDate.getFullYear(),
      MM: String(targetDate.getMonth() + 1).padStart(2, '0'),
      DD: String(targetDate.getDate()).padStart(2, '0'),
      hh: String(targetDate.getHours()).padStart(2, '0'),
      mm: String(targetDate.getMinutes()).padStart(2, '0'),
      ss: String(targetDate.getSeconds()).padStart(2, '0')
    };

    return this.dateFormat.replace(/YYYY|MM|DD|hh|mm|ss/g, (token) => components[token] || token);
  }

  sanitize(value) {
    return String(value)
      .replace(/\s+/g, '_')
      .replace(ILLEGAL_FILENAME_CHARS, '-');
  }

  trimLength(value) {
    if (!value) {
      return value;
    }
    if (value.length <= 240) {
      return value;
    }
    const ext = path.extname(value);
    const base = value.slice(0, 240 - ext.length);
    return `${base}${ext}`;
  }

  extractInitials(value = '') {
    return String(value)
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase())
      .join('');
  }
}

module.exports = { FileNamer };
