




import { readDir, exists, readJson } from '../../utils/fs.js';
import path from 'path';
import { getAdminPath, getAdminShardPath } from '../../utils/paths.js';

/**
 * Менеджер поиска администраторов
 * Поиск и фильтрация администраторов по различным критериям
 */
export class AdminSearchManager {
  constructor() {
    this.searchCache = new Map();
    this.cacheTimeout = 60000; // 1 минута кэша
  }

  /**
   * Поиск администраторов по запросу
   * @param {string} query - Поисковый запрос
   * @param {Object} options - Опции поиска
   * @returns {Promise<Object>}
   */
  async searchAdmins(query = '', options = {}) {
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cached = this.searchCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const allAdmins = await this._getAllAdmins();
      let filtered = allAdmins;

      // Фильтрация по роли
      if (options.role && options.role !== 'all') {
        filtered = filtered.filter(admin => 
          admin.role && admin.role.toLowerCase() === options.role.toLowerCase()
        );
      }

      // Фильтрация по статусу
      if (options.status && options.status !== 'all') {
        filtered = filtered.filter(admin => 
          admin.status && admin.status.toLowerCase() === options.status.toLowerCase()
        );
      }

      // Поиск по запросу
      if (query && query.trim()) {
        const searchQuery = query.toLowerCase().trim();
        filtered = filtered.filter(admin => {
          // Поиск по username
          if (admin.username && admin.username.toLowerCase().includes(searchQuery)) {
            return true;
          }
          // Поиск по email
          if (admin.email && admin.email.toLowerCase().includes(searchQuery)) {
            return true;
          }
          // Поиск по личному email
          if (admin.personalEmail && admin.personalEmail.toLowerCase().includes(searchQuery)) {
            return true;
          }
          // Поиск по телефону
          if (admin.phone && admin.phone.toLowerCase().includes(searchQuery)) {
            return true;
          }
          // Поиск по имени и фамилии
          if (admin.firstName && admin.firstName.toLowerCase().includes(searchQuery)) {
            return true;
          }
          if (admin.lastName && admin.lastName.toLowerCase().includes(searchQuery)) {
            return true;
          }
          // Поиск по полному имени
          const fullName = `${admin.firstName || ''} ${admin.lastName || ''}`.toLowerCase();
          if (fullName.includes(searchQuery)) {
            return true;
          }
          // Поиск по ID
          if (admin.uid && admin.uid.toString().includes(searchQuery)) {
            return true;
          }
          return false;
        });
      }

      // Сортировка по приоритету ролей
      filtered.sort((a, b) => {
        const rolePriority = { 
          'superadmin': 0, 
          'admin': 1, 
          'moderator': 2, 
          'user': 3 
        };
        const aPriority = rolePriority[a.role?.toLowerCase()] || 3;
        const bPriority = rolePriority[b.role?.toLowerCase()] || 3;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        // Если роли одинаковые, сортируем по дате создания
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      // Применяем пагинацию
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const paginated = filtered.slice(offset, offset + limit);

      const result = {
        admins: paginated,
        total: filtered.length,
        limit,
        offset,
        query,
        hasMore: offset + limit < filtered.length
      };

      // Кэшируем результат
      this.searchCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });

      // Очистка старого кэша
      this._cleanOldCache();

      return result;

    } catch (error) {
      console.error('[AdminSearchManager] Ошибка поиска администраторов:', error);
      throw error;
    }
  }

  /**
   * Получение администратора по ID
   * @param {number} uid - ID администратора
   * @returns {Promise<Object|null>}
   */
  async getAdminById(uid) {
    try {
      const adminPath = getAdminPath(uid);
      const profilePath = path.join(adminPath, 'profile', 'main.json');
      
      if (!await exists(profilePath)) {
        return null;
      }

      const profile = await readJson(profilePath);
      const avatarPath = path.join(adminPath, 'profile', 'avatar.json');
      const avatar = await exists(avatarPath) ? await readJson(avatarPath) : null;
      
      return {
        uid,
        ...profile,
        avatar
      };
    } catch (error) {
      console.error(`[AdminSearchManager] Ошибка получения администратора ${uid}:`, error);
      return null;
    }
  }

  /**
   * Поиск администраторов по роли
   * @param {string} role - Роль для поиска (superadmin, admin, moderator)
   * @param {Object} options - Опции поиска
   * @returns {Promise<Object>}
   */
  async searchByRole(role, options = {}) {
    return this.searchAdmins('', { ...options, role });
  }

  /**
   * Поиск активных администраторов
   * @returns {Promise<Array>}
   */
  async getActiveAdmins() {
    try {
      const allAdmins = await this._getAllAdmins();
      return allAdmins.filter(admin => 
        admin.status === 'active' || 
        (admin.lastOnline && (Date.now() / 1000) - admin.lastOnline < 3600)
      );
    } catch (error) {
      console.error('[AdminSearchManager] Ошибка получения активных администраторов:', error);
      throw error;
    }
  }

  /**
   * Получение статистики по администраторам
   * @returns {Promise<Object>}
   */
  async getAdminStats() {
    try {
      const allAdmins = await this._getAllAdmins();
      
      const stats = {
        total: allAdmins.length,
        byRole: {},
        byStatus: {},
        activeCount: 0,
        inactiveCount: 0,
        onlineCount: 0
      };

      allAdmins.forEach(admin => {
        // Статистика по ролям
        const role = admin.role || 'user';
        stats.byRole[role] = (stats.byRole[role] || 0) + 1;

        // Статистика по статусам
        const status = admin.status || 'active';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        // Активные/неактивные
        if (status === 'active') {
          stats.activeCount++;
        } else {
          stats.inactiveCount++;
        }

        // Онлайн статус (последняя активность в течение часа)
        if (admin.lastOnline && (Date.now() / 1000) - admin.lastOnline < 3600) {
          stats.onlineCount++;
        }
      });

      return stats;
    } catch (error) {
      console.error('[AdminSearchManager] Ошибка получения статистики:', error);
      throw error;
    }
  }

  /**
   * Получение всех администраторов
   * @private
   */
  async _getAllAdmins() {
    const cacheKey = 'all_admins';
    const cached = this.searchCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const { DB_CONFIG } = await import('../../config.js');
      const adminsPath = path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.ADMINS);
      
      if (!await exists(adminsPath)) {
        return [];
      }

      const admins = [];
      const shards = await readDir(adminsPath);

      for (const shard of shards) {
        if (!shard.startsWith('shard_')) continue;
        
        const shardPath = path.join(adminsPath, shard);
        const adminDirs = await readDir(shardPath);

        for (const adminDir of adminDirs) {
          if (!adminDir.startsWith('u_')) continue;
          
          try {
            const uid = parseInt(adminDir.replace('u_', ''));
            if (isNaN(uid)) continue;

            const adminData = await this.getAdminById(uid);
            if (adminData) {
              admins.push(adminData);
            }
          } catch (error) {
            console.error(`[AdminSearchManager] Ошибка обработки администратора ${adminDir}:`, error);
            continue;
          }
        }
      }

      // Кэшируем результат
      this.searchCache.set(cacheKey, {
        timestamp: Date.now(),
        data: admins
      });

      return admins;
    } catch (error) {
      console.error('[AdminSearchManager] Ошибка получения всех администраторов:', error);
      throw error;
    }
  }

  /**
   * Очистка старого кэша
   * @private
   */
  _cleanOldCache() {
    const now = Date.now();
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout * 2) {
        this.searchCache.delete(key);
      }
    }
  }

  /**
   * Быстрый поиск администратора (по ID, username, email)
   * @param {string} identifier - ID, username, email или телефон
   * @returns {Promise<Object|null>}
   */
  async quickSearch(identifier) {
    try {
      // Если это число, ищем по ID
      const id = parseInt(identifier);
      if (!isNaN(id)) {
        const admin = await this.getAdminById(id);
        if (admin) return admin;
      }

      // Ищем по всем администраторам
      const allAdmins = await this._getAllAdmins();
      const searchTerm = identifier.toLowerCase().trim();

      const found = allAdmins.find(admin => {
        // Проверка username (с @ и без)
        const username = admin.username || '';
        if (username.toLowerCase() === searchTerm || 
            `@${username.toLowerCase()}` === searchTerm ||
            username.toLowerCase().includes(searchTerm)) {
          return true;
        }

        // Проверка email
        const email = admin.email || '';
        if (email.toLowerCase() === searchTerm) {
          return true;
        }

        // Проверка личного email
        const personalEmail = admin.personalEmail || '';
        if (personalEmail.toLowerCase() === searchTerm) {
          return true;
        }

        // Проверка телефона
        const phone = admin.phone || '';
        if (phone === searchTerm) {
          return true;
        }

        // Проверка полного имени
        const fullName = `${admin.firstName || ''} ${admin.lastName || ''}`.toLowerCase();
        if (fullName.includes(searchTerm)) {
          return true;
        }

        return false;
      });

      return found || null;
    } catch (error) {
      console.error('[AdminSearchManager] Ошибка быстрого поиска:', error);
      throw error;
    }
  }

  /**
   * Получение администраторов с правами
   * @param {Array<string>} permissions - Массив прав для поиска
   * @returns {Promise<Array>}
   */
  async getAdminsWithPermissions(permissions) {
    try {
      const allAdmins = await this._getAllAdmins();
      return allAdmins.filter(admin => {
        const adminPermissions = admin.permissions || [];
        return permissions.some(permission => 
          adminPermissions.includes(permission) || 
          admin.role === 'superadmin' // Суперадмин имеет все права
        );
      });
    } catch (error) {
      console.error('[AdminSearchManager] Ошибка поиска по правам:', error);
      throw error;
    }
  }
}