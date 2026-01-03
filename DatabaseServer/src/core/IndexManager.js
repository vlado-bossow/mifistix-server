import { readJson, writeJson } from '../utils/fs.js';
import { getIndexPath } from '../utils/paths.js';

/**
 * Менеджер индексов
 * Быстрый поиск по username, phone, email
 */
export class IndexManager {
  /**
   * Получает индекс
   */
  async getIndex(indexName) {
    const indexPath = getIndexPath(indexName);
    const index = await readJson(indexPath);
    return index || {};
  }

  /**
   * Сохраняет индекс
   */
  async saveIndex(indexName, index) {
    const indexPath = getIndexPath(indexName);
    await writeJson(indexPath, index);
  }

  /**
   * Добавляет запись в индекс
   */
  async add(indexName, key, value) {
    const index = await this.getIndex(indexName);
    index[key] = value;
    await this.saveIndex(indexName, index);
  }

  /**
   * Удаляет запись из индекса
   */
  async remove(indexName, key) {
    const index = await this.getIndex(indexName);
    delete index[key];
    await this.saveIndex(indexName, index);
  }

  /**
   * Получает значение по ключу
   */
  async get(indexName, key) {
    const index = await this.getIndex(indexName);
    return index[key] || null;
  }

  /**
   * Проверяет существование ключа
   */
  async exists(indexName, key) {
    const value = await this.get(indexName, key);
    return value !== null;
  }

  /**
   * Получает все записи индекса
   */
  async getAll(indexName) {
    return await this.getIndex(indexName);
  }
}

