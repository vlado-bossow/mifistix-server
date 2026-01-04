




import { readDir, exists, readJson } from '../../utils/fs.js';
import path from 'path';

/**
 * Менеджер поиска по правам доступа
 * Поиск пользователей и администраторов по их правам и разрешениям
 */
export class PermissionsSearchManager {
  constructor() {
    this.permissionsCache = new Map();
    this.cacheTimeout = 60000; // 1 минута кэша
  }

  /**
   * Поиск пользователей по праву/разрешению
   * @param {string|Array} permission - Право или массив прав для поиска
   * @param {Object} options - Опции поиска
   * @returns {Promise<Object>}
   */
  async searchByPermission(permission, options = {}) {
    const permissions = Array.isArray(permission) ? permission : [permission];
    const cacheKey = `permission_search:${JSON.stringify(permissions)}:${JSON.stringify(options)}`;
    
    const cached = this.permissionsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Получаем всех пользователей и администраторов с правами
      const allUsers = await this._getAllUsersWithPermissions();
      
      // Фильтруем по правам
      let filtered = allUsers.filter(user => {
        // Суперадмины имеют все права
        if (user.role === 'superadmin') {
          return true;
        }
        
        // Проверяем, есть ли хотя бы одно из искомых прав
        const userPermissions = user.permissions || [];
        return permissions.some(perm => userPermissions.includes(perm));
      });

      // Дополнительная фильтрация по роли
      if (options.role && options.role !== 'all') {
        filtered = filtered.filter(user => 
          user.role && user.role.toLowerCase() === options.role.toLowerCase()
        );
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
        // Если роли одинаковые, сортируем по количеству прав
        const aPermCount = a.permissions?.length || 0;
        const bPermCount = b.permissions?.length || 0;
        return bPermCount - aPermCount;
      });

      // Пагинация
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const paginated = filtered.slice(offset, offset + limit);

      const result = {
        users: paginated,
        permissions: permissions,
        total: filtered.length,
        limit,
        offset,
        hasMore: offset + limit < filtered.length
      };

      // Кэшируем результат
      this.permissionsCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });

      this._cleanOldCache();
      return result;

    } catch (error) {
      console.error('[PermissionsSearchManager] Ошибка поиска по правам:', error);
      throw error;
    }
  }

  /**
   * Получение всех прав в системе
   * @returns {Promise<Object>}
   */
  async getAllPermissions() {
    try {
      const allUsers = await this._getAllUsersWithPermissions();
      const allPermissions = new Set();
      const permissionsByRole = {};

      allUsers.forEach(user => {
        const role = user.role || 'user';
        const permissions = user.permissions || [];

        // Собираем все уникальные права
        permissions.forEach(perm => allPermissions.add(perm));

        // Группируем права по ролям
        if (!permissionsByRole[role]) {
          permissionsByRole[role] = new Set();
        }
        permissions.forEach(perm => permissionsByRole[role].add(perm));
      });

      // Преобразуем в массив и сортируем
      const sortedPermissions = Array.from(allPermissions).sort();
      const sortedPermissionsByRole = {};

      Object.keys(permissionsByRole).forEach(role => {
        sortedPermissionsByRole[role] = Array.from(permissionsByRole[role]).sort();
      });

      // Статистика по правам
      const stats = {};
      sortedPermissions.forEach(perm => {
        const usersWithPerm = allUsers.filter(user => 
          user.permissions?.includes(perm) || user.role === 'superadmin'
        ).length;
        stats[perm] = usersWithPerm;
      });

      return {
        allPermissions: sortedPermissions,
        permissionsByRole: sortedPermissionsByRole,
        stats: stats,
        totalUsers: allUsers.length,
        totalPermissions: sortedPermissions.length
      };
    } catch (error) {
      console.error('[PermissionsSearchManager] Ошибка получения всех прав:', error);
      throw error;
    }
  }

  /**
   * Получение пользователей с конкретными правами (расширенный поиск)
   * @param {Object} filter - Фильтр для поиска
   * @returns {Promise<Array>}
   */
  async getUsersWithPermissionFilter(filter = {}) {
    try {
      const allUsers = await this._getAllUsersWithPermissions();
      
      let filtered = allUsers;

      // Фильтрация по правам
      if (filter.permissions && filter.permissions.length > 0) {
        filtered = filtered.filter(user => {
          if (user.role === 'superadmin') return true;
          const userPermissions = user.permissions || [];
          return filter.permissions.every(perm => userPermissions.includes(perm));
        });
      }

      // Фильтрация по роли
      if (filter.roles && filter.roles.length > 0) {
        filtered = filtered.filter(user => 
          filter.roles.includes(user.role?.toLowerCase() || 'user')
        );
      }

      // Фильтрация по статусу
      if (filter.status && filter.status !== 'all') {
        filtered = filtered.filter(user => 
          user.status?.toLowerCase() === filter.status.toLowerCase()
        );
      }

      // Фильтрация по минимальному количеству прав
      if (filter.minPermissions) {
        filtered = filtered.filter(user => 
          (user.permissions?.length || 0) >= filter.minPermissions
        );
      }

      // Фильтрация по максимальному количеству прав
      if (filter.maxPermissions) {
        filtered = filtered.filter(user => 
          (user.permissions?.length || 0) <= filter.maxPermissions
        );
      }

      // Поиск по тексту (username, email, имя)
      if (filter.search) {
        const searchTerm = filter.search.toLowerCase();
        filtered = filtered.filter(user => {
          if (user.username && user.username.toLowerCase().includes(searchTerm)) return true;
          if (user.email && user.email.toLowerCase().includes(searchTerm)) return true;
          if (user.personalEmail && user.personalEmail.toLowerCase().includes(searchTerm)) return true;
          if (user.firstName && user.firstName.toLowerCase().includes(searchTerm)) return true;
          if (user.lastName && user.lastName.toLowerCase().includes(searchTerm)) return true;
          if (user.phone && user.phone.includes(searchTerm)) return true;
          return false;
        });
      }

      // Сортировка
      if (filter.sortBy) {
        filtered.sort((a, b) => {
          switch (filter.sortBy) {
            case 'role':
              const rolePriority = { 'superadmin': 0, 'admin': 1, 'moderator': 2, 'user': 3 };
              const aPriority = rolePriority[a.role?.toLowerCase()] || 3;
              const bPriority = rolePriority[b.role?.toLowerCase()] || 3;
              return aPriority - bPriority;
            
            case 'permissionsCount':
              const aCount = a.permissions?.length || 0;
              const bCount = b.permissions?.length || 0;
              return bCount - aCount;
            
            case 'createdAt':
              return (b.createdAt || 0) - (a.createdAt || 0);
            
            case 'lastOnline':
              return (b.lastOnline || 0) - (a.lastOnline || 0);
            
            case 'username':
              return (a.username || '').localeCompare(b.username || '');
            
            default:
              return 0;
          }
        });
      }

      return filtered;
    } catch (error) {
      console.error('[PermissionsSearchManager] Ошибка расширенного поиска:', error);
      throw error;
    }
  }

  /**
   * Проверка, есть ли у пользователя конкретное право
   * @param {number} uid - ID пользователя
   * @param {string} permission - Право для проверки
   * @returns {Promise<boolean>}
   */
  async hasPermission(uid, permission) {
    try {
      const user = await this._getUserWithPermissions(uid);
      if (!user) return false;
      
      // Суперадмины имеют все права
      if (user.role === 'superadmin') {
        return true;
      }
      
      return user.permissions?.includes(permission) || false;
    } catch (error) {
      console.error(`[PermissionsSearchManager] Ошибка проверки права для пользователя ${uid}:`, error);
      return false;
    }
  }

  /**
   * Получение всех прав пользователя
   * @param {number} uid - ID пользователя
   * @returns {Promise<Array>}
   */
  async getUserPermissions(uid) {
    try {
      const user = await this._getUserWithPermissions(uid);
      if (!user) return [];
      
      // Суперадмины имеют все права
      if (user.role === 'superadmin') {
        const allPermissions = await this.getAllPermissions();
        return allPermissions.allPermissions || [];
      }
      
      return user.permissions || [];
    } catch (error) {
      console.error(`[PermissionsSearchManager] Ошибка получения прав пользователя ${uid}:`, error);
      return [];
    }
  }

  /**
   * Получение статистики по правам
   * @returns {Promise<Object>}
   */
  async getPermissionsStats() {
    try {
      const allUsers = await this._getAllUsersWithPermissions();
      const allPermissions = await this.getAllPermissions();
      
      const stats = {
        totalUsers: allUsers.length,
        totalPermissions: allPermissions.allPermissions?.length || 0,
        usersWithPermissions: 0,
        averagePermissionsPerUser: 0,
        mostCommonPermissions: [],
        roleDistribution: {}
      };

      // Подсчет пользователей с правами
      stats.usersWithPermissions = allUsers.filter(user => 
        (user.permissions?.length || 0) > 0 || user.role === 'superadmin'
      ).length;

      // Среднее количество прав на пользователя
      const totalPermissionsCount = allUsers.reduce((sum, user) => {
        if (user.role === 'superadmin') {
          return sum + (allPermissions.allPermissions?.length || 0);
        }
        return sum + (user.permissions?.length || 0);
      }, 0);
      
      stats.averagePermissionsPerUser = allUsers.length > 0 
        ? totalPermissionsCount / allUsers.length 
        : 0;

      // Самые распространенные права
      const permissionCounts = {};
      allUsers.forEach(user => {
        if (user.role === 'superadmin') {
          allPermissions.allPermissions?.forEach(perm => {
            permissionCounts[perm] = (permissionCounts[perm] || 0) + 1;
          });
        } else {
          user.permissions?.forEach(perm => {
            permissionCounts[perm] = (permissionCounts[perm] || 0) + 1;
          });
        }
      });

      stats.mostCommonPermissions = Object.entries(permissionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([permission, count]) => ({ permission, count }));

      // Распределение по ролям
      const roles = ['superadmin', 'admin', 'moderator', 'user'];
      roles.forEach(role => {
        const usersInRole = allUsers.filter(user => 
          (user.role?.toLowerCase() || 'user') === role
        );
        stats.roleDistribution[role] = {
          count: usersInRole.length,
          percentage: allUsers.length > 0 ? (usersInRole.length / allUsers.length) * 100 : 0,
          averagePermissions: usersInRole.length > 0 
            ? usersInRole.reduce((sum, user) => sum + (user.permissions?.length || 0), 0) / usersInRole.length 
            : 0
        };
      });

      return stats;
    } catch (error) {
      console.error('[PermissionsSearchManager] Ошибка получения статистики:', error);
      throw error;
    }
  }

  /**
   * Получение всех пользователей с правами
   * @private
   */
  async _getAllUsersWithPermissions() {
    const cacheKey = 'all_users_with_permissions';
    const cached = this.permissionsCache.get(cacheKey);
    
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

              const userData = await this._getUserWithPermissions(uid, false);
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

              const userData = await this._getUserWithPermissions(uid, true);
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
      this.permissionsCache.set(cacheKey, {
        timestamp: Date.now(),
        data: allUsers
      });

      return allUsers;
    } catch (error) {
      console.error('[PermissionsSearchManager] Ошибка получения всех пользователей:', error);
      throw error;
    }
  }

  /**
   * Получение пользователя с правами
   * @private
   */
  async _getUserWithPermissions(uid, isAdmin = false) {
    try {
      const { DB_CONFIG } = await import('../../config.js');
      const basePath = path.join(
        DB_CONFIG.ROOT_PATH,
        isAdmin ? DB_CONFIG.PATHS.ADMINS : DB_CONFIG.PATHS.USERS
      );
      
      // Находим шард пользователя
      const shardId = Math.floor(uid / 1000);
      const shardPath = path.join(basePath, `shard_${shardId}`, `u_${uid}`);
      
      if (!await exists(shardPath)) {
        return null;
      }

      const profilePath = path.join(shardPath, 'profile', 'main.json');
      if (!await exists(profilePath)) {
        return null;
      }

      const profile = await readJson(profilePath);
      
      return {
        uid,
        username: profile.username,
        email: profile.email,
        personalEmail: profile.personalEmail,
        phone: profile.phone,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role || 'user',
        permissions: profile.permissions || [],
        status: profile.status || 'active',
        createdAt: profile.createdAt,
        lastOnline: profile.lastOnline,
        isAdmin: isAdmin || (profile.email && profile.email.includes('@adm.mifistix'))
      };
    } catch (error) {
      console.error(`[PermissionsSearchManager] Ошибка получения пользователя ${uid}:`, error);
      return null;
    }
  }

  /**
   * Очистка старого кэша
   * @private
   */
  _cleanOldCache() {
    const now = Date.now();
    for (const [key, value] of this.permissionsCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout * 2) {
        this.permissionsCache.delete(key);
      }
    }
  }
}