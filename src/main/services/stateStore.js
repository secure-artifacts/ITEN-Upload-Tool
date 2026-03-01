const fs = require('fs');
const path = require('path');
const os = require('os');

class StateStore {
  constructor(filename = 'upload-state.json', baseDir = '') {
    const rootDir = baseDir || stateDirectory();
    this.filePath = path.join(rootDir, filename);
    this.state = { uploadedIds: [] };
    try {
      fs.mkdirSync(rootDir, { recursive: true, mode: 0o755 });
    } catch (error) {
      console.error('Failed to ensure state directory', error);
    }
    this.read();
  }

  read() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8');
        this.state = JSON.parse(content);
      }
    } catch (error) {
      this.state = { uploadedIds: [] };
    }
  }

  write() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to write state file', error);
    }
  }

  has(fileId) {
    return this.state.uploadedIds.includes(fileId);
  }

  add(fileId) {
    if (!this.has(fileId)) {
      this.state.uploadedIds.push(fileId);
      this.write();
    }
  }

  clear() {
    this.state.uploadedIds = [];
    this.write();
  }
}

function stateDirectory() {
  if (process.platform === 'win32') {
    return path.join(process.cwd(), 'state');
  }
  const base = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'art-autoform');
}

module.exports = { StateStore };
