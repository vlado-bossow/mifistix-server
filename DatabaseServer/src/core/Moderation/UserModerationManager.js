




import { readJson, writeJson, exists, ensureDir } from '../../utils/fs.js';
import path from 'path';
import { getUserPath, getAdminPath } from '../../utils/paths.js';

/**
 * Менеджер модерации пользователей
 * Управление правами пользователей, повышение до модераторов/администраторов
 */
export class UserModerationManager {
  constructor() {
    this.moderatorsPath = path.join(process.cwd(), 'data', 'moderators');
    this.logsPath = path.join(process.cwd(), 'data', 'moderation_logs');
  }

  /**
   * Инициализация менеджера
   */
  async initialize() {
    try {
      await ensureDir(this.moderatorsPath);
      await ensureDir(this.logsPath);
      console.log('[UserModerationManager] Инициализирован');
      return true;
    } catch (error) {
      console.error('[UserModerationManager] Ошибка инициализации:', error);
      throw error;
    }
  }

  /**
   * Добавление пользователя в модераторы
   * @param {number} userId - ID пользователя
   * @param {number} addedByUid - ID администратора, который добавляет
   * @param {Object} options - Дополнительные параметры
   * @returns {Promise<Object>}
   */
  async addModeratorFromUser(userId, addedByUid, options = {}) {
    try {
      // Проверяем существование пользователя
      const userPath = getUserPath(userId);
      const profilePath = path.join(userPath, 'profile', 'main.json');
      
      if (!await exists(profilePath)) {
        throw new Error(`User ${userId} not found`);
      }

      // Читаем профиль пользователя
      const profile = await readJson(profilePath);
      
      // Проверяем, не является ли уже модератором
      if (profile.role === 'moderator' || profile.role === 'admin' || profile.role === 'superadmin') {
        throw new Error(`User ${userId} is already a ${profile.role}`);
      }

      // Обновляем роль пользователя
      profile.role = options.role || 'moderator';
      profile.permissions = options.permissions || [];
      profile.moderatorSince = Math.floor(Date.now() / 1000);
      profile.addedBy = addedByUid;
      
      // Обновляем профиль
      await writeJson(profilePath, profile);

      // Создаем запись в логах
      await this._logModerationAction({
        action: 'add_moderator',
        targetUserId: userId,
        moderatorId: addedByUid,
        details: {
          role: profile.role,
          permissions: profile.permissions,
          previousRole: 'user'
        },
        timestamp: Math.floor(Date.now() / 1000)
      });

      // Создаем запись в списке модераторов
      const moderatorPath = path.join(this.moderatorsPath, `moderator_${userId}.json`);
      const moderatorData = {
        uid: userId,
        username: profile.username,
        email: profile.email,
        role: profile.role,
        permissions: profile.permissions,
        addedBy: addedByUid,
        addedAt: Math.floor(Date.now() / 1000),
        isActive: true,
        stats: {
          actionsTaken: 0,
          reportsHandled: 0,
          bansIssued: 0,
          warningsIssued: 0,
          lastAction: null
        }
      };
      
      await writeJson(moderatorPath, moderatorData);

      console.log(`[UserModerationManager] Пользователь ${userId} добавлен как ${profile.role}`);
      
      return {
        success: true,
        userId,
        role: profile.role,
        permissions: profile.permissions,
        moderatorData
      };
    } catch (error) {
      console.error(`[UserModerationManager] Ошибка добавления модератора ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Удаление пользователя из модераторов
   * @param {number} userId - ID пользователя
   * @param {number} removedByUid - ID администратора, который удаляет
   * @param {string} reason - Причина удаления
   * @returns {Promise<Object>}
   */
  async removeModerator(userId, removedByUid, reason = '') {
    try {
      // Проверяем существование пользователя
      const userPath = getUserPath(userId);
      const profilePath = path.join(userPath, 'profile', 'main.json');
      
      if (!await exists(profilePath)) {
        throw new Error(`User ${userId} not found`);
      }

      // Читаем профиль пользователя
      const profile = await readJson(profilePath);
      
      // Проверяем, является ли модератором
      if (profile.role !== 'moderator' && profile.role !== 'admin') {
        throw new Error(`User ${userId} is not a moderator or admin`);
      }

      // Сохраняем старую роль для логов
      const previousRole = profile.role;
      
      // Возвращаем роль пользователя
      profile.role = 'user';
      delete profile.moderatorSince;
      delete profile.addedBy;
      delete profile.permissions;
      
      // Обновляем профиль
      await writeJson(profilePath, profile);

      // Создаем запись в логах
      await this._logModerationAction({
        action: 'remove_moderator',
        targetUserId: userId,
        moderatorId: removedByUid,
        details: {
          previousRole: previousRole,
          newRole: 'user',
          reason: reason
        },
        timestamp: Math.floor(Date.now() / 1000)
      });

      // Архивируем запись модератора
      const moderatorPath = path.join(this.moderatorsPath, `moderator_${userId}.json`);
      if (await exists(moderatorPath)) {
        const moderatorData = await readJson(moderatorPath);
        moderatorData.removedAt = Math.floor(Date.now() / 1000);
        moderatorData.removedBy = removedByUid;
        moderatorData.removalReason = reason;
        moderatorData.isActive = false;
        
        const archivePath = path.join(this.moderatorsPath, 'archive', `moderator_${userId}_${Date.now()}.json`);
        await ensureDir(path.dirname(archivePath));
        await writeJson(archivePath, moderatorData);
        
        // Удаляем основной файл
        const { unlink } = await import('fs/promises');
        await unlink(moderatorPath);
      }

      console.log(`[UserModerationManager] Пользователь ${userId} удален из модераторов`);
      
      return {
        success: true,
        userId,
        previousRole,
        removedBy: removedByUid,
        reason
      };
    } catch (error) {
      console.error(`[UserModerationManager] Ошибка удаления модератора ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Обновление прав модератора
   * @param {number} userId - ID пользователя
   * @param {number} updatedByUid - ID администратора, который обновляет
   * @param {Array} permissions - Новые права
   * @returns {Promise<Object>}
   */
  async updateModeratorPermissions(userId, updatedByUid, permissions) {
    try {
      // Проверяем существование пользователя
      const userPath = getUserPath(userId);
      const profilePath = path.join(userPath, 'profile', 'main.json');
      
      if (!await exists(profilePath)) {
        throw new Error(`User ${userId} not found`);
      }

      // Читаем профиль пользователя
      const profile = await readJson(profilePath);
      
      // Проверяем, является ли модератором
      if (profile.role !== 'moderator' && profile.role !== 'admin') {
        throw new Error(`User ${userId} is not a moderator or admin`);
      }

      // Сохраняем старые права для логов
      const previousPermissions = profile.permissions || [];
      
      // Обновляем права
      profile.permissions = permissions;
      
      // Обновляем профиль
      await writeJson(profilePath, profile);

      // Обновляем запись в списке модераторов
      const moderatorPath = path.join(this.moderatorsPath, `moderator_${userId}.json`);
      if (await exists(moderatorPath)) {
        const moderatorData = await readJson(moderatorPath);
        moderatorData.permissions = permissions;
        moderatorData.updatedAt = Math.floor(Date.now() / 1000);
        moderatorData.updatedBy = updatedByUid;
        
        await writeJson(moderatorPath, moderatorData);
      }

      // Создаем запись в логах
      await this._logModerationAction({
        action: 'update_permissions',
        targetUserId: userId,
        moderatorId: updatedByUid,
        details: {
          previousPermissions: previousPermissions,
          newPermissions: permissions
        },
        timestamp: Math.floor(Date.now() / 1000)
      });

      console.log(`[UserModerationManager] Права модератора ${userId} обновлены`);
      
      return {
        success: true,
        userId,
        permissions,
        previousPermissions,
        updatedBy: updatedByUid
      };
    } catch (error) {
      console.error(`[UserModerationManager] Ошибка обновления прав модератора ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Повышение модератора до администратора
   * @param {number} userId - ID пользователя
   * @param {number} promotedByUid - ID администратора, который повышает
   * @param {Object} options - Дополнительные параметры
   * @returns {Promise<Object>}
   */
  async promoteToAdmin(userId, promotedByUid, options = {}) {
    try {
      // Проверяем существование пользователя
      const userPath = getUserPath(userId);
      const profilePath = path.join(userPath, 'profile', 'main.json');
      
      if (!await exists(profilePath)) {
        throw new Error(`User ${userId} not found`);
      }

      // Читаем профиль пользователя
      const profile = await readJson(profilePath);
      
      // Проверяем текущую роль
      if (profile.role === 'admin' || profile.role === 'superadmin') {
        throw new Error(`User ${userId} is already an ${profile.role}`);
      }

      // Сохраняем старую роль для логов
      const previousRole = profile.role;
      
      // Повышаем до администратора
      profile.role = 'admin';
      profile.permissions = options.permissions || [
        'manage_users',
        'manage_content',
        'manage_reports',
        'manage_moderators',
        'view_analytics'
      ];
      profile.promotedAt = Math.floor(Date.now() / 1000);
      profile.promotedBy = promotedByUid;
      
      // Обновляем профиль
      await writeJson(profilePath, profile);

      // Перемещаем пользователя в папку админов, если нужно
      if (options.moveToAdminsFolder === true) {
        await this._moveUserToAdminsFolder(userId);
      }

      // Создаем запись в логах
      await this._logModerationAction({
        action: 'promote_to_admin',
        targetUserId: userId,
        moderatorId: promotedByUid,
        details: {
          previousRole: previousRole,
          newRole: 'admin',
          permissions: profile.permissions
        },
        timestamp: Math.floor(Date.now() / 1000)
      });

      console.log(`[UserModerationManager] Пользователь ${userId} повышен до администратора`);
      
      return {
        success: true,
        userId,
        previousRole,
        newRole: 'admin',
        permissions: profile.permissions,
        promotedBy: promotedByUid
      };
    } catch (error) {
      console.error(`[UserModerationManager] Ошибка повышения пользователя ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Понижение администратора
   * @param {number} userId - ID пользователя
   * @param {number} demotedByUid - ID администратора, который понижает
   * @param {string} reason - Причина понижения
   * @returns {Promise<Object>}
   */
  async demoteAdmin(userId, demotedByUid, reason = '') {
    try {
      // Проверяем существование пользователя
      const userPath = getAdminPath(userId);
      const profilePath = path.join(userPath, 'profile', 'main.json');
      
      if (!await exists(profilePath)) {
        throw new Error(`Admin ${userId} not found`);
      }

      // Читаем профиль администратора
      const profile = await readJson(profilePath);
      
      // Проверяем, является ли администратором
      if (profile.role !== 'admin' && profile.role !== 'superadmin') {
        throw new Error(`User ${userId} is not an admin`);
      }

      // Нельзя понизить суперадмина
      if (profile.role === 'superadmin') {
        throw new Error('Cannot demote a superadmin');
      }

      // Сохраняем старую роль для логов
      const previousRole = profile.role;
      
      // Понижаем до модератора или пользователя
      const newRole = reason.includes('severe') ? 'user' : 'moderator';
      profile.role = newRole;
      
      if (newRole === 'user') {
        delete profile.permissions;
        delete profile.moderatorSince;
        delete profile.addedBy;
      } else {
        profile.permissions = [
          'manage_content',
          'manage_reports',
          'view_analytics'
        ];
      }
      
      profile.demotedAt = Math.floor(Date.now() / 1000);
      profile.demotedBy = demotedByUid;
      profile.demotionReason = reason;
      
      // Обновляем профиль
      await writeJson(profilePath, profile);

      // Создаем запись в логах
      await this._logModerationAction({
        action: 'demote_admin',
        targetUserId: userId,
        moderatorId: demotedByUid,
        details: {
          previousRole: previousRole,
          newRole: newRole,
          reason: reason
        },
        timestamp: Math.floor(Date.now() / 1000)
      });

      console.log(`[UserModerationManager] Администратор ${userId} понижен до ${newRole}`);
      
      return {
        success: true,
        userId,
        previousRole,
        newRole,
        reason,
        demotedBy: demotedByUid
      };
    } catch (error) {
      console.error(`[UserModerationManager] Ошибка понижения администратора ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Получение информации о модераторе
   * @param {number} userId - ID пользователя
   * @returns {Promise<Object|null>}
   */
  async getModeratorInfo(userId) {
    try {
      const moderatorPath = path.join(this.moderatorsPath, `moderator_${userId}.json`);
      
      if (!await exists(moderatorPath)) {
        // Проверяем в профиле пользователя
        const userPath = getUserPath(userId);
        const profilePath = path.join(userPath, 'profile', 'main.json');
        
        if (!await exists(profilePath)) {
          return null;
        }
        
        const profile = await readJson(profilePath);
        
        if (profile.role !== 'moderator' && profile.role !== 'admin' && profile.role !== 'superadmin') {
          return null;
        }
        
        return {
          uid: userId,
          username: profile.username,
          email: profile.email,
          role: profile.role,
          permissions: profile.permissions || [],
          isActive: true,
          profileInfo: profile
        };
      }
      
      const moderatorData = await readJson(moderatorPath);
      return moderatorData;
    } catch (error) {
      console.error(`[UserModerationManager] Ошибка получения информации о модераторе ${userId}:`, error);
      return null;
    }
  }

  /**
   * Получение списка всех модераторов
   * @returns {Promise<Array>}
   */
  async getAllModerators() {
    try {
      if (!await exists(this.moderatorsPath)) {
        return [];
      }
      
      const { readdir } = await import('fs/promises');
      const files = await readdir(this.moderatorsPath);
      const moderators = [];
      
      for (const file of files) {
        if (file.startsWith('moderator_') && file.endsWith('.json')) {
          try {
            const moderatorPath = path.join(this.moderatorsPath, file);
            const moderatorData = await readJson(moderatorPath);
            
            // Проверяем активность
            if (moderatorData.isActive !== false) {
              moderators.push(moderatorData);
            }
          } catch (error) {
            console.error(`[UserModerationManager] Ошибка чтения файла модератора ${file}:`, error);
          }
        }
      }
      
      // Также добавляем модераторов из профилей пользователей
      const { DB_CONFIG } = await import('../../config.js');
      const usersPath = path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.USERS);
      
      if (await exists(usersPath)) {
        // Этот код может быть сложным, упрощаем для примера
        // В реальном приложении нужно рекурсивно обходить папки
      }
      
      return moderators;
    } catch (error) {
      console.error('[UserModerationManager] Ошибка получения списка модераторов:', error);
      return [];
    }
  }

  /**
   * Получение логов модерации
   * @param {Object} filters - Фильтры
   * @returns {Promise<Array>}
   */
  async getModerationLogs(filters = {}) {
    try {
      if (!await exists(this.logsPath)) {
        return [];
      }
      
      const { readdir } = await import('fs/promises');
      const logFiles = await readdir(this.logsPath);
      const allLogs = [];
      
      for (const file of logFiles) {
        if (file.endsWith('.json')) {
          try {
            const logPath = path.join(this.logsPath, file);
            const logs = await readJson(logPath);
            
            if (Array.isArray(logs)) {
              allLogs.push(...logs);
            }
          } catch (error) {
            console.error(`[UserModerationManager] Ошибка чтения логов ${file}:`, error);
          }
        }
      }
      
      // Применяем фильтры
      let filteredLogs = allLogs;
      
      if (filters.action) {
        filteredLogs = filteredLogs.filter(log => log.action === filters.action);
      }
      
      if (filters.moderatorId) {
        filteredLogs = filteredLogs.filter(log => log.moderatorId === filters.moderatorId);
      }
      
      if (filters.targetUserId) {
        filteredLogs = filteredLogs.filter(log => log.targetUserId === filters.targetUserId);
      }
      
      if (filters.startDate) {
        const startTimestamp = Math.floor(new Date(filters.startDate).getTime() / 1000);
        filteredLogs = filteredLogs.filter(log => log.timestamp >= startTimestamp);
      }
      
      if (filters.endDate) {
        const endTimestamp = Math.floor(new Date(filters.endDate).getTime() / 1000);
        filteredLogs = filteredLogs.filter(log => log.timestamp <= endTimestamp);
      }
      
      // Сортируем по дате (новые сначала)
      filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
      
      // Применяем лимит
      if (filters.limit) {
        filteredLogs = filteredLogs.slice(0, filters.limit);
      }
      
      return filteredLogs;
    } catch (error) {
      console.error('[UserModerationManager] Ошибка получения логов:', error);
      return [];
    }
  }

  /**
   * Перемещение пользователя в папку админов
   * @private
   */
  async _moveUserToAdminsFolder(userId) {
    try {
      const { DB_CONFIG } = await import('../../config.js');
      const fsPromises = await import('fs/promises');
      const { copyFile, mkdir, rm } = fsPromises;
      
      const sourcePath = getUserPath(userId);
      const targetPath = getAdminPath(userId);
      
      // Создаем целевую директорию
      await mkdir(targetPath, { recursive: true });
      
      // Копируем все файлы
      const copyRecursive = async (src, dest) => {
        const entries = await fsPromises.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          
          if (entry.isDirectory()) {
            await mkdir(destPath, { recursive: true });
            await copyRecursive(srcPath, destPath);
          } else {
            await copyFile(srcPath, destPath);
          }
        }
      };
      
      await copyRecursive(sourcePath, targetPath);
      
      // Удаляем исходную папку
      await rm(sourcePath, { recursive: true, force: true });
      
      console.log(`[UserModerationManager] Пользователь ${userId} перемещен в папку админов`);
      return true;
    } catch (error) {
      console.error(`[UserModerationManager] Ошибка перемещения пользователя ${userId}:`, error);
      return false;
    }
  }

  /**
   * Логирование действия модерации
   * @private
   */
  async _logModerationAction(logEntry) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logsPath, `${today}.json`);
      
      let logs = [];
      
      if (await exists(logFile)) {
        logs = await readJson(logFile);
      }
      
      logs.push(logEntry);
      
      await writeJson(logFile, logs);
    } catch (error) {
      console.error('[UserModerationManager] Ошибка логирования:', error);
    }
  }

  /**
   * Проверка, является ли пользователь модератором
   * @param {number} userId - ID пользователя
   * @returns {Promise<boolean>}
   */
  async isModerator(userId) {
    try {
      const info = await this.getModeratorInfo(userId);
      return info !== null && info.isActive !== false;
    } catch (error) {
      console.error(`[UserModerationManager] Ошибка проверки модератора ${userId}:`, error);
      return false;
    }
  }

  /**
   * Проверка прав модератора
   * @param {number} userId - ID пользователя
   * @param {string} permission - Право для проверки
   * @returns {Promise<boolean>}
   */
  async hasModeratorPermission(userId, permission) {
    try {
      const info = await this.getModeratorInfo(userId);
      
      if (!info || info.isActive === false) {
        return false;
      }
      
      // Суперадмины имеют все права
      if (info.role === 'superadmin') {
        return true;
      }
      
      // Проверяем конкретное право
      return info.permissions?.includes(permission) || false;
    } catch (error) {
      console.error(`[UserModerationManager] Ошибка проверки прав ${userId}:`, error);
      return false;
    }
  }
}