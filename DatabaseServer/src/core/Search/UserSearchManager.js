import { readDir, exists, readJson } from '../../utils/fs.js';
import path from 'path';
import { getUserPath, getAdminPath } from '../../utils/paths.js';

/**
 * Менеджер поиска пользователей
 * Расширенный поиск и фильтрация пользователей по различным критериям
 */
export class UserSearchManager {
  constructor() {
    this.searchCache = new Map();
    this.cacheTimeout = 60000; // 1 минута кэша
  }

  /**
   * Поиск пользователей по запросу
   * @param {string} query - Поисковый запрос
   * @param {Object} options - Опции поиска
   * @returns {Promise<Object>}
   */
  async searchUsers(query = '', options = {}) {
    const cacheKey = `user_search:${query}:${JSON.stringify(options)}`;
    const cached = this.searchCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const allUsers = await this._getAllUsers();
      let filtered = allUsers;

      // Фильтрация по роли
      if (options.role && options.role !== 'all') {
        filtered = filtered.filter(user => 
          user.role && user.role.toLowerCase() === options.role.toLowerCase()
        );
      }

      // Фильтрация по статусу
      if (options.status && options.status !== 'all') {
        filtered = filtered.filter(user => 
          user.status && user.status.toLowerCase() === options.status.toLowerCase()
        );
      }

      // Поиск по запросу
      if (query && query.trim()) {
        const searchQuery = query.toLowerCase().trim();
        filtered = filtered.filter(user => {
          // Поиск по username
          if (user.username && user.username.toLowerCase().includes(searchQuery)) {
            return true;
          }
          
          // Поиск по email
          if (user.email && user.email.toLowerCase().includes(searchQuery)) {
            return true;
          }
          
          // Поиск по личному email
          if (user.personalEmail && user.personalEmail.toLowerCase().includes(searchQuery)) {
            return true;
          }
          
          // Поиск по телефону
          if (user.phone && user.phone.includes(searchQuery)) {
            return true;
          }
          
          // Поиск по имени и фамилии
          if (user.firstName && user.firstName.toLowerCase().includes(searchQuery)) {
            return true;
          }
          if (user.lastName && user.lastName.toLowerCase().includes(searchQuery)) {
            return true;
          }
          
          // Поиск по полному имени
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
          if (fullName.includes(searchQuery)) {
            return true;
          }
          
          // Поиск по ID
          if (user.uid && user.uid.toString().includes(searchQuery)) {
            return true;
          }
          
          return false;
        });
      }

      // Сортировка по умолчанию
      filtered.sort((a, b) => {
        const now = Math.floor(Date.now() / 1000);
        const aIsActive = a.lastOnline && (now - a.lastOnline) < 86400;
        const bIsActive = b.lastOnline && (now - b.lastOnline) < 86400;
        
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      // Пагинация
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const paginated = filtered.slice(offset, offset + limit);

      const result = {
        users: paginated,
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
      console.error('[UserSearchManager] Ошибка поиска пользователей:', error);
      return {
        users: [],
        total: 0,
        limit: options.limit || 50,
        offset: options.offset || 0,
        query,
        hasMore: false
      };
    }
  }

  /**
   * Получение пользователя по ID
   * @param {number} uid - ID пользователя
   * @returns {Promise<Object|null>}
   */
  async getUserById(uid) {
    try {
      // Сначала пробуем найти в обычных пользователях
      let userPath = getUserPath(uid);
      let profilePath = path.join(userPath, 'profile', 'main.json');
      
      if (!await exists(profilePath)) {
        // Пробуем найти в администраторах
        userPath = getAdminPath(uid);
        profilePath = path.join(userPath, 'profile', 'main.json');
        
        if (!await exists(profilePath)) {
          return null;
        }
      }

      const profile = await readJson(profilePath);
      const avatarPath = path.join(userPath, 'profile', 'avatar.json');
      const aboutPath = path.join(userPath, 'profile', 'about.json');
      
      const [avatar, about] = await Promise.all([
        exists(avatarPath) ? readJson(avatarPath) : null,
        exists(aboutPath) ? readJson(aboutPath) : null
      ]);

      return {
        uid,
        ...profile,
        avatar,
        about,
        isAdmin: userPath.includes('admins')
      };
    } catch (error) {
      console.error(`[UserSearchManager] Ошибка получения пользователя ${uid}:`, error);
      return null;
    }
  }

  /**
   * Быстрый поиск пользователя
   * @param {string} identifier - Идентификатор (ID, username, email, phone)
   * @returns {Promise<Object|null>}
   */
  async quickFind(identifier) {
    try {
      // Если это число, ищем по ID
      const id = parseInt(identifier);
      if (!isNaN(id)) {
        const user = await this.getUserById(id);
        if (user) return user;
      }

      // Ищем по всем пользователям
      const allUsers = await this._getAllUsers();
      const searchTerm = identifier.toLowerCase().trim();

      const found = allUsers.find(user => {
        // Проверка username
        const username = user.username || '';
        if (username.toLowerCase() === searchTerm || 
            `@${username.toLowerCase()}` === searchTerm) {
          return true;
        }

        // Проверка email
        const email = user.email || '';
        if (email.toLowerCase() === searchTerm) {
          return true;
        }

        // Проверка личного email
        const personalEmail = user.personalEmail || '';
        if (personalEmail.toLowerCase() === searchTerm) {
          return true;
        }

        // Проверка телефона
        const phone = user.phone || '';
        if (phone === searchTerm) {
          return true;
        }

        return false;
      });

      return found || null;
    } catch (error) {
      console.error('[UserSearchManager] Ошибка быстрого поиска:', error);
      return null;
    }
  }

  /**
   * Поиск пользователей по роли
   * @param {string} role - Роль для поиска
   * @param {Object} options - Опции поиска
   * @returns {Promise<Array>}
   */
  async searchByRole(role, options = {}) {
    return this.searchUsers('', { ...options, role });
  }

  /**
   * Получение статистики пользователей
   * @returns {Promise<Object>}
   */
  async getUserStats() {
    try {
      const allUsers = await this._getAllUsers();
      
      const stats = {
        total: allUsers.length,
        byRole: {},
        byStatus: {},
        activeCount: 0,
        onlineCount: 0,
        verifiedCount: 0
      };

      const now = Math.floor(Date.now() / 1000);

      allUsers.forEach(user => {
        // Статистика по ролям
        const role = user.role || 'user';
        stats.byRole[role] = (stats.byRole[role] || 0) + 1;

        // Статистика по статусам
        const status = user.status || 'active';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        // Активные пользователи (были онлайн в течение 7 дней)
        if (user.lastOnline && (now - user.lastOnline) < 604800) {
          stats.activeCount++;
        }

        // Онлайн сейчас (в течение 5 минут)
        if (user.lastOnline && (now - user.lastOnline) < 300) {
          stats.onlineCount++;
        }

        // Верифицированные
        if (user.verified) {
          stats.verifiedCount++;
        }
      });

      return stats;
    } catch (error) {
      console.error('[UserSearchManager] Ошибка получения статистики:', error);
      return {
        total: 0,
        byRole: {},
        byStatus: {},
        activeCount: 0,
        onlineCount: 0,
        verifiedCount: 0
      };
    }
  }

  /**
   * Получение всех пользователей
   * @private
   */
  async _getAllUsers() {
    const cacheKey = 'all_users';
    const cached = this.searchCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const { DB_CONFIG } = await import('../../config.js');
      const allUsers = [];

      // Получаем обычных пользователей
      const usersPath = path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.USERS);
      if (await exists(usersPath)) {
        const shards = await readDir(usersPath);
        for (const shard of shards) {
          if (!shard.startsWith('shard_')) continue;
          
          const shardPath = path.join(usersPath, shard);
          const userDirs = await readDir(shardPath);
          
          for (const userDir of userDirs) {
            if (!userDir.startsWith('u_')) continue;
            
            try {
              const uid = parseInt(userDir.replace('u_', ''));
              if (isNaN(uid)) continue;

              const userData = await this.getUserById(uid);
              if (userData) {
                allUsers.push(userData);
              }
            } catch (error) {
              continue;
            }
          }
        }
      }

      // Получаем администраторов
      const adminsPath = path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.ADMINS);
      if (await exists(adminsPath)) {
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

              const userData = await this.getUserById(uid);
              if (userData) {
                allUsers.push(userData);
              }
            } catch (error) {
              continue;
            }
          }
        }
      }

      // Кэшируем результат
      this.searchCache.set(cacheKey, {
        timestamp: Date.now(),
        data: allUsers
      });

      return allUsers;
    } catch (error) {
      console.error('[UserSearchManager] Ошибка получения всех пользователей:', error);
      return [];
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
}