import { ensureDir } from '../utils/fs.js';
import { DB_CONFIG } from '../config.js';
import path from 'path';
import { getUsernameDir } from '../utils/paths.js';

/**
 * Главный менеджер базы данных
 * Инициализирует структуру БД
 */
export class DatabaseManager {
  constructor(rootPath = null) {
    this.rootPath = rootPath || DB_CONFIG.ROOT_PATH;
    this.fs = null; // Для ленивой загрузки
  }

  // Ленивая загрузка fs функций
  async getFs() {
    if (!this.fs) {
      this.fs = await import('../utils/fs.js');
    }
    return this.fs;
  }

  // Метод ensureDir через ленивую загрузку
  async ensureDir(path) {
    const fs = await this.getFs();
    return fs.ensureDir(path);
  }

  async rm(path, options) {
    const fs = await this.getFs();
    return fs.rm(path, options);
  }

  async exists(path) {
    const fs = await this.getFs();
    return fs.exists(path);
  }


  /**
   * Инициализирует структуру БД
   */
  async initialize() {
    const dirs = [
      path.join(this.rootPath, DB_CONFIG.PATHS.USERS),
      path.join(this.rootPath, DB_CONFIG.PATHS.MEDIA),
      path.join(this.rootPath, DB_CONFIG.PATHS.POSTS),
      path.join(this.rootPath, DB_CONFIG.PATHS.SYSTEM),
      path.join(this.rootPath, DB_CONFIG.PATHS.INDEXES),
      // Папка username для хранения айди профиля по username
      getUsernameDir()
    ];

    for (const dir of dirs) {
      await ensureDir(dir);
    }

    console.log(`✅ База данных инициализирована: ${this.rootPath}`);
  }
}

