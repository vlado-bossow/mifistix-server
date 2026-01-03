import { ensureDir, writeFile, readFile, deleteFile, readDir, exists } from '../../utils/fs.js';
import { DB_CONFIG } from '../../config.js';
import path from 'path';
import { UserManager } from '../../core/UserManager.js';

export class ModeratorsManager {
  constructor() {
    this.moderatorsPath = path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.MODERATORS);
    this.userManager = new UserManager();
  }

  /**
   * Инициализация директории модераторов
   */
  async initialize() {
    await ensureDir(this.moderatorsPath);
    await ensureDir(path.join(this.moderatorsPath, 'users'));
    await ensureDir(path.join(this.moderatorsPath, 'reports'));
    await ensureDir(path.join(this.moderatorsPath, 'actions'));
    await ensureDir(path.join(this.moderatorsPath, 'bans'));
    await ensureDir(path.join(this.moderatorsPath, 'warnings'));
    await ensureDir(path.join(this.moderatorsPath, 'content'));
    await ensureDir(path.join(this.moderatorsPath, 'moderation_panels')); // Панели модерации для каждого модератора
  }

  /**
   * Получить путь к папке панели модерации
   */
  getModerationPanelPath(moderatorUid) {
    return path.join(this.moderatorsPath, 'moderation_panels', `moderator_${moderatorUid}`);
  }

  /**
   * Получить путь к файлу модератора по UID
   */
  getModeratorPath(moderatorUid) {
    const shardNumber = moderatorUid % DB_CONFIG.SHARDING.SHARD_COUNT;
    const shardName = `${DB_CONFIG.SHARDING.SHARD_PREFIX}${shardNumber.toString().padStart(DB_CONFIG.SHARDING.SHARD_DIGITS, '0')}`;
    const shardPath = path.join(this.moderatorsPath, 'users', shardName);
    return path.join(shardPath, `${DB_CONFIG.FORMATS.USER_PREFIX}${moderatorUid}.json`);
  }

  /**
   * Получить путь к файлу репорта
   */
  getReportPath(reportId) {
    const shardNumber = reportId % 100; // Упрощенное шардирование для репортов
    const shardName = `shard_${shardNumber.toString().padStart(3, '0')}`;
    const shardPath = path.join(this.moderatorsPath, 'reports', shardName);
    return path.join(shardPath, `report_${reportId}.json`);
  }

  /**
   * Получить путь к файлу бана
   */
  getBanPath(banId) {
    const shardNumber = banId % 100;
    const shardName = `shard_${shardNumber.toString().padStart(3, '0')}`;
    const shardPath = path.join(this.moderatorsPath, 'bans', shardName);
    return path.join(shardPath, `ban_${banId}.json`);
  }

  /**
   * Получить путь к файлу предупреждения
   */
  getWarningPath(warningId) {
    const shardNumber = warningId % 100;
    const shardName = `shard_${shardNumber.toString().padStart(3, '0')}`;
    const shardPath = path.join(this.moderatorsPath, 'warnings', shardName);
    return path.join(shardPath, `warning_${warningId}.json`);
  }

  /**
   * Получить путь к файлу действия модератора
   */
  getActionPath(actionId) {
    const timestamp = Date.now();
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const datePath = path.join(this.moderatorsPath, 'actions', year.toString(), month, day);
    return path.join(datePath, `action_${actionId}.json`);
  }

  /**
   * Добавить пользователя в модераторы
   */
  async addModerator(moderatorUid, addedByUid, role = 'moderator', permissions = []) {
    try {
      // Проверяем, существует ли пользователь
      const userProfile = await this.userManager.getProfile(moderatorUid);
      if (!userProfile.main) {
        throw new Error('Пользователь не найден');
      }

      const moderatorData = {
        uid: moderatorUid,
        username: userProfile.main.username,
        firstName: userProfile.main.firstName,
        lastName: userProfile.main.lastName,
        role: role, // 'moderator', 'admin', 'superadmin'
        permissions: permissions.length > 0 ? permissions : this.getDefaultPermissions(role),
        addedBy: addedByUid,
        addedAt: Math.floor(Date.now() / 1000),
        isActive: true,
        stats: {
          reportsReviewed: 0,
          actionsTaken: 0,
          bansIssued: 0,
          warningsIssued: 0
        }
      };

      const moderatorPath = this.getModeratorPath(moderatorUid);
      const shardPath = path.dirname(moderatorPath);
      await ensureDir(shardPath);
      await writeFile(moderatorPath, moderatorData);

      // Обновляем профиль пользователя
      await this.userManager.updateProfile(moderatorUid, {
        isModerator: true,
        moderatorRole: role
      });

      // Записываем действие
      await this.logAction({
        type: 'add_moderator',
        moderatorUid: addedByUid,
        targetUid: moderatorUid,
        details: { role, permissions },
        timestamp: Math.floor(Date.now() / 1000)
      });

      return moderatorData;
    } catch (error) {
      console.error('Ошибка при добавлении модератора:', error);
      throw error;
    }
  }

  /**
   * Удалить пользователя из модераторов
   */
  async removeModerator(moderatorUid, removedByUid, reason = '') {
    try {
      const moderatorPath = this.getModeratorPath(moderatorUid);
      
      if (!(await exists(moderatorPath))) {
        throw new Error('Модератор не найден');
      }

      // Удаляем файл модератора
      await deleteFile(moderatorPath);

      // Обновляем профиль пользователя
      await this.userManager.updateProfile(moderatorUid, {
        isModerator: false,
        moderatorRole: null
      });

      // Записываем действие
      await this.logAction({
        type: 'remove_moderator',
        moderatorUid: removedByUid,
        targetUid: moderatorUid,
        details: { reason },
        timestamp: Math.floor(Date.now() / 1000)
      });

      return { success: true };
    } catch (error) {
      console.error('Ошибка при удалении модератора:', error);
      throw error;
    }
  }

  /**
   * Получить информацию о модераторе
   */
  async getModerator(moderatorUid) {
    try {
      const moderatorPath = this.getModeratorPath(moderatorUid);
      
      if (!(await exists(moderatorPath))) {
        return null;
      }

      const moderatorData = await readFile(moderatorPath);
      
      // Получаем актуальную информацию о пользователе
      const userProfile = await this.userManager.getProfile(moderatorUid);
      moderatorData.avatar = userProfile.avatar;
      moderatorData.isOnline = userProfile.isOnline || false;
      moderatorData.lastSeen = userProfile.lastSeen || null;

      return moderatorData;
    } catch (error) {
      console.error('Ошибка при получении информации о модераторе:', error);
      throw error;
    }
  }

  /**
   * Получить список всех модераторов
   */
  async getAllModerators(includeInactive = false) {
    try {
      const moderators = [];
      const moderatorsDir = path.join(this.moderatorsPath, 'users');
      
      if (!(await exists(moderatorsDir))) {
        return [];
      }

      const shards = await readDir(moderatorsDir);
      
      for (const shard of shards) {
        const shardPath = path.join(moderatorsDir, shard);
        if (!(await exists(shardPath))) continue;
        
        const moderatorFiles = await readDir(shardPath);
        
        for (const file of moderatorFiles) {
          try {
            const moderatorPath = path.join(shardPath, file);
            const moderatorData = await readFile(moderatorPath);
            
            if (includeInactive || moderatorData.isActive) {
              // Получаем актуальную информацию о пользователе
              const userProfile = await this.userManager.getProfile(moderatorData.uid);
              
              // Добавляем данные из профиля пользователя
              if (userProfile && userProfile.main) {
                moderatorData.name = userProfile.main.firstName && userProfile.main.lastName
                  ? `${userProfile.main.firstName} ${userProfile.main.lastName}`.trim()
                  : userProfile.main.username || userProfile.main.email?.split('@')[0] || 'Без имени';
                moderatorData.firstName = userProfile.main.firstName || '';
                moderatorData.lastName = userProfile.main.lastName || '';
                moderatorData.username = userProfile.main.username || '';
                moderatorData.email = userProfile.main.email || '';
                moderatorData.phone = userProfile.main.phone || '';
                moderatorData.createdAt = userProfile.main.createdAt || null;
                moderatorData.status = userProfile.main.status || 'active';
              }
              
              moderatorData.avatar = userProfile?.avatar || null;
              moderatorData.isOnline = userProfile?.isOnline || false;
              moderators.push(moderatorData);
            }
          } catch (err) {
            continue;
          }
        }
      }

      // Сортируем по роли и активности
      moderators.sort((a, b) => {
        const roleOrder = { 'superadmin': 0, 'admin': 1, 'moderator': 2 };
        if (roleOrder[a.role] !== roleOrder[b.role]) {
          return roleOrder[a.role] - roleOrder[b.role];
        }
        return a.uid - b.uid;
      });

      return moderators;
    } catch (error) {
      console.error('Ошибка при получении списка модераторов:', error);
      throw error;
    }
  }

  /**
   * Обновить разрешения модератора
   */
  async updateModeratorPermissions(moderatorUid, updatedByUid, permissions) {
    try {
      const moderator = await this.getModerator(moderatorUid);
      if (!moderator) {
        throw new Error('Модератор не найден');
      }

      moderator.permissions = permissions;
      moderator.updatedAt = Math.floor(Date.now() / 1000);
      moderator.updatedBy = updatedByUid;

      const moderatorPath = this.getModeratorPath(moderatorUid);
      await writeFile(moderatorPath, moderator);

      // Записываем действие
      await this.logAction({
        type: 'update_permissions',
        moderatorUid: updatedByUid,
        targetUid: moderatorUid,
        details: { permissions },
        timestamp: Math.floor(Date.now() / 1000)
      });

      return moderator;
    } catch (error) {
      console.error('Ошибка при обновлении разрешений:', error);
      throw error;
    }
  }

  /**
   * Создать репорт на контент или пользователя
   */
  async createReport(reporterUid, targetType, targetId, reason, description = '', evidence = []) {
    try {
      const reportId = Math.floor(Math.random() * 1000000);
      const reportData = {
        id: reportId,
        reporterUid,
        targetType, // 'user', 'post', 'comment', 'media'
        targetId,
        reason,
        description,
        evidence,
        status: 'pending', // 'pending', 'reviewed', 'rejected', 'resolved'
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
        assignedTo: null,
        priority: this.calculatePriority(reason, targetType),
        isUrgent: this.isUrgentReport(reason)
      };

      const reportPath = this.getReportPath(reportId);
      const shardPath = path.dirname(reportPath);
      await ensureDir(shardPath);
      await writeFile(reportPath, reportData);

      return reportData;
    } catch (error) {
      console.error('Ошибка при создании репорта:', error);
      throw error;
    }
  }

  /**
   * Получить список репортов
   */
  async getReports(filter = {}) {
    try {
      const reports = [];
      const reportsDir = path.join(this.moderatorsPath, 'reports');
      
      if (!(await exists(reportsDir))) {
        return [];
      }

      const shards = await readDir(reportsDir);
      
      for (const shard of shards) {
        const shardPath = path.join(reportsDir, shard);
        if (!(await exists(shardPath))) continue;
        
        const reportFiles = await readDir(shardPath);
        
        for (const file of reportFiles) {
          try {
            const reportPath = path.join(shardPath, file);
            const reportData = await readFile(reportPath);
            
            // Применяем фильтры
            let include = true;
            
            if (filter.status && reportData.status !== filter.status) {
              include = false;
            }
            
            if (filter.targetType && reportData.targetType !== filter.targetType) {
              include = false;
            }
            
            if (filter.assignedTo !== undefined) {
              if (filter.assignedTo === null) {
                if (reportData.assignedTo !== null) include = false;
              } else if (reportData.assignedTo !== filter.assignedTo) {
                include = false;
              }
            }
            
            if (filter.priority && reportData.priority !== filter.priority) {
              include = false;
            }
            
            if (filter.isUrgent !== undefined && reportData.isUrgent !== filter.isUrgent) {
              include = false;
            }
            
            if (include) {
              reports.push(reportData);
            }
          } catch (err) {
            continue;
          }
        }
      }

      // Сортируем по приоритету и дате
      reports.sort((a, b) => {
        if (a.isUrgent !== b.isUrgent) {
          return b.isUrgent - a.isUrgent; // Сначала срочные
        }
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // По убыванию приоритета
        }
        return b.createdAt - a.createdAt; // По убыванию даты
      });

      return reports;
    } catch (error) {
      console.error('Ошибка при получении репортов:', error);
      throw error;
    }
  }

  /**
   * Обновить статус репорта
   */
  async updateReportStatus(reportId, status, moderatorUid, notes = '') {
    try {
      const reportPath = this.getReportPath(reportId);
      
      if (!(await exists(reportPath))) {
        throw new Error('Репорт не найден');
      }

      const reportData = await readFile(reportPath);
      reportData.status = status;
      reportData.updatedAt = Math.floor(Date.now() / 1000);
      reportData.moderatorUid = moderatorUid;
      
      if (notes) {
        reportData.moderatorNotes = notes;
      }

      if (status === 'reviewed' && !reportData.assignedTo) {
        reportData.assignedTo = moderatorUid;
        reportData.reviewedAt = Math.floor(Date.now() / 1000);
      }

      await writeFile(reportPath, reportData);

      // Обновляем статистику модератора
      await this.updateModeratorStats(moderatorUid, 'reportsReviewed', 1);

      // Записываем действие
      await this.logAction({
        type: 'update_report',
        moderatorUid,
        reportId: reportId,
        targetType: 'report',
        targetId: reportId,
        details: { 
          oldStatus: reportData.status, 
          newStatus: status, 
          notes,
          reportId: reportId
        },
        timestamp: Math.floor(Date.now() / 1000)
      });

      return reportData;
    } catch (error) {
      console.error('Ошибка при обновлении репорта:', error);
      throw error;
    }
  }

  /**
   * Забанить пользователя
   */
  async banUser(userUid, moderatorUid, reason, duration = 0, notes = '') {
    try {
      const banId = Math.floor(Math.random() * 1000000);
      const banData = {
        id: banId,
        userUid,
        moderatorUid,
        reason,
        duration, // 0 = перманентный бан
        notes,
        status: 'active',
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: duration > 0 ? Math.floor(Date.now() / 1000) + duration : null,
        previousBans: await this.getUserBans(userUid)
      };

      const banPath = this.getBanPath(banId);
      const shardPath = path.dirname(banPath);
      await ensureDir(shardPath);
      await writeFile(banPath, banData);

      // Обновляем профиль пользователя
      await this.userManager.updateProfile(userUid, {
        isBanned: true,
        banReason: reason,
        banExpiresAt: banData.expiresAt
      });

      // Обновляем статистику модератора
      await this.updateModeratorStats(moderatorUid, 'bansIssued', 1);

      // Записываем действие
      await this.logAction({
        type: 'ban_user',
        moderatorUid,
        targetUid: userUid,
        targetType: 'user',
        targetId: userUid,
        details: { 
          reason, 
          duration, 
          banId,
          expiresAt: banData.expiresAt,
          isPermanent: duration === 0
        },
        timestamp: Math.floor(Date.now() / 1000)
      });

      return banData;
    } catch (error) {
      console.error('Ошибка при бане пользователя:', error);
      throw error;
    }
  }

  /**
   * Выдать предупреждение пользователю
   */
  async warnUser(userUid, moderatorUid, reason, severity = 'medium', notes = '') {
    try {
      const warningId = Math.floor(Math.random() * 1000000);
      const warningData = {
        id: warningId,
        userUid,
        moderatorUid,
        reason,
        severity, // 'low', 'medium', 'high'
        notes,
        isActive: true,
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 дней по умолчанию
      };

      const warningPath = this.getWarningPath(warningId);
      const shardPath = path.dirname(warningPath);
      await ensureDir(shardPath);
      await writeFile(warningPath, warningData);

      // Получаем активные предупреждения пользователя
      const activeWarnings = await this.getUserWarnings(userUid, true);
      
      // Если 3 или более активных предупреждения - автоматический бан
      if (activeWarnings.length >= 3) {
        await this.banUser(
          userUid, 
          moderatorUid, 
          'Автоматический бан за 3 предупреждения',
          7 * 24 * 60 * 60, // 7 дней
          'Автоматический бан по системе 3 предупреждений'
        );
      }

      // Обновляем статистику модератора
      await this.updateModeratorStats(moderatorUid, 'warningsIssued', 1);

      // Записываем действие
      await this.logAction({
        type: 'warn_user',
        moderatorUid,
        targetUid: userUid,
        targetType: 'user',
        targetId: userUid,
        details: { 
          reason, 
          severity, 
          warningId,
          expiresAt: warningData.expiresAt
        },
        timestamp: Math.floor(Date.now() / 1000)
      });

      return warningData;
    } catch (error) {
      console.error('Ошибка при выдаче предупреждения:', error);
      throw error;
    }
  }

  /**
   * Получить предупреждения пользователя
   */
  async getUserWarnings(userUid, activeOnly = false) {
    try {
      const warnings = [];
      const warningsDir = path.join(this.moderatorsPath, 'warnings');
      
      if (!(await exists(warningsDir))) {
        return [];
      }

      const shards = await readDir(warningsDir);
      
      for (const shard of shards) {
        const shardPath = path.join(warningsDir, shard);
        if (!(await exists(shardPath))) continue;
        
        const warningFiles = await readDir(shardPath);
        
        for (const file of warningFiles) {
          try {
            const warningPath = path.join(shardPath, file);
            const warningData = await readFile(warningPath);
            
            if (warningData.userUid === userUid) {
              if (!activeOnly || (warningData.isActive && warningData.expiresAt > Math.floor(Date.now() / 1000))) {
                warnings.push(warningData);
              }
            }
          } catch (err) {
            continue;
          }
        }
      }

      warnings.sort((a, b) => b.createdAt - a.createdAt);
      return warnings;
    } catch (error) {
      console.error('Ошибка при получении предупреждений:', error);
      throw error;
    }
  }

  /**
   * Получить баны пользователя
   */
  async getUserBans(userUid) {
    try {
      const bans = [];
      const bansDir = path.join(this.moderatorsPath, 'bans');
      
      if (!(await exists(bansDir))) {
        return [];
      }

      const shards = await readDir(bansDir);
      
      for (const shard of shards) {
        const shardPath = path.join(bansDir, shard);
        if (!(await exists(shardPath))) continue;
        
        const banFiles = await readDir(shardPath);
        
        for (const file of banFiles) {
          try {
            const banPath = path.join(shardPath, file);
            const banData = await readFile(banPath);
            
            if (banData.userUid === userUid) {
              bans.push(banData);
            }
          } catch (err) {
            continue;
          }
        }
      }

      bans.sort((a, b) => b.createdAt - a.createdAt);
      return bans;
    } catch (error) {
      console.error('Ошибка при получении банов:', error);
      throw error;
    }
  }

  /**
   * Разбанить пользователя
   */
  async unbanUser(userUid, moderatorUid, reason = '') {
    try {
      const activeBans = await this.getUserBans(userUid);
      const currentBan = activeBans.find(ban => ban.status === 'active');
      
      if (!currentBan) {
        throw new Error('Активный бан не найден');
      }

      currentBan.status = 'removed';
      currentBan.removedBy = moderatorUid;
      currentBan.removedAt = Math.floor(Date.now() / 1000);
      currentBan.removalReason = reason;

      const banPath = this.getBanPath(currentBan.id);
      await writeFile(banPath, currentBan);

      // Обновляем профиль пользователя
      await this.userManager.updateProfile(userUid, {
        isBanned: false,
        banReason: null,
        banExpiresAt: null
      });

      // Записываем действие
      await this.logAction({
        type: 'unban_user',
        moderatorUid,
        targetUid: userUid,
        targetType: 'user',
        targetId: userUid,
        details: { 
          reason, 
          banId: currentBan.id,
          originalBanReason: currentBan.reason,
          banCreatedAt: currentBan.createdAt
        },
        timestamp: Math.floor(Date.now() / 1000)
      });

      return currentBan;
    } catch (error) {
      console.error('Ошибка при разбане пользователя:', error);
      throw error;
    }
  }

  /**
   * Получить статистику модерации
   */
  async getModerationStats(timeRange = 'all') {
    try {
      const stats = {
        totalReports: 0,
        pendingReports: 0,
        resolvedReports: 0,
        totalBans: 0,
        activeBans: 0,
        totalWarnings: 0,
        activeWarnings: 0,
        topModerators: [],
        recentActions: []
      };

      // Собираем данные из всех разделов
      const reports = await this.getReports({});
      const bans = await this.getAllBans();
      const warnings = await this.getAllWarnings();
      const actions = await this.getRecentActions(100);

      const now = Math.floor(Date.now() / 1000);
      let timeFilter = 0;
      
      switch (timeRange) {
        case 'day':
          timeFilter = now - (24 * 60 * 60);
          break;
        case 'week':
          timeFilter = now - (7 * 24 * 60 * 60);
          break;
        case 'month':
          timeFilter = now - (30 * 24 * 60 * 60);
          break;
      }

      // Фильтруем по времени
      const filteredReports = timeRange === 'all' ? reports : reports.filter(r => r.createdAt >= timeFilter);
      const filteredBans = timeRange === 'all' ? bans : bans.filter(b => b.createdAt >= timeFilter);
      const filteredWarnings = timeRange === 'all' ? warnings : warnings.filter(w => w.createdAt >= timeFilter);

      stats.totalReports = filteredReports.length;
      stats.pendingReports = filteredReports.filter(r => r.status === 'pending').length;
      stats.resolvedReports = filteredReports.filter(r => r.status === 'resolved').length;
      stats.totalBans = filteredBans.length;
      stats.activeBans = filteredBans.filter(b => b.status === 'active').length;
      stats.totalWarnings = filteredWarnings.length;
      stats.activeWarnings = filteredWarnings.filter(w => w.isActive && w.expiresAt > now).length;

      // Собираем статистику по модераторам
      const moderatorStats = {};
      const allModerators = await this.getAllModerators();
      
      for (const moderator of allModerators) {
        moderatorStats[moderator.uid] = {
          uid: moderator.uid,
          username: moderator.username,
          reportsReviewed: 0,
          bansIssued: 0,
          warningsIssued: 0
        };
      }

      // Подсчитываем действия
      for (const action of actions) {
        if (action.moderatorUid && moderatorStats[action.moderatorUid]) {
          if (action.type === 'update_report') {
            moderatorStats[action.moderatorUid].reportsReviewed++;
          } else if (action.type === 'ban_user') {
            moderatorStats[action.moderatorUid].bansIssued++;
          } else if (action.type === 'warn_user') {
            moderatorStats[action.moderatorUid].warningsIssued++;
          }
        }
      }

      // Формируем топ модераторов
      stats.topModerators = Object.values(moderatorStats)
        .sort((a, b) => (b.reportsReviewed + b.bansIssued + b.warningsIssued) - 
                       (a.reportsReviewed + a.bansIssued + a.warningsIssued))
        .slice(0, 10);

      stats.recentActions = actions.slice(0, 20);

      return stats;
    } catch (error) {
      console.error('Ошибка при получении статистики:', error);
      throw error;
    }
  }

  /**
   * Вспомогательные методы
   */

  getDefaultPermissions(role) {
    const permissions = {
      moderator: [
        'view_reports',           // Просмотр репортов
        'update_reports',         // Обновление статуса репортов
        'issue_warnings',         // Выдача предупреждений
        'view_user_info',         // Просмотр информации о пользователях
        'view_moderation_panel', // Просмотр своей панели модерации
        'view_content'           // Просмотр контента для модерации
      ],
      admin: [
        'view_reports',           // Просмотр репортов
        'update_reports',         // Обновление статуса репортов
        'issue_warnings',         // Выдача предупреждений
        'issue_bans',             // Выдача банов
        'unban_users',            // Снятие банов
        'view_user_info',         // Просмотр информации о пользователях
        'view_moderation_stats',  // Просмотр статистики модерации
        'view_moderation_panel', // Просмотр своей панели модерации
        'manage_content',         // Управление контентом (удаление, редактирование)
        'delete_posts',           // Удаление постов
        'delete_comments',        // Удаление комментариев
        'edit_content'            // Редактирование контента
      ],
      superadmin: [
        'view_reports',           // Просмотр репортов
        'update_reports',         // Обновление статуса репортов
        'issue_warnings',         // Выдача предупреждений
        'issue_bans',             // Выдача банов
        'unban_users',            // Снятие банов
        'view_user_info',         // Просмотр информации о пользователях
        'view_moderation_stats',  // Просмотр статистики модерации
        'view_moderation_panel',  // Просмотр своей панели модерации
        'view_all_moderation_panels', // Просмотр всех панелей модерации
        'manage_content',         // Управление контентом
        'delete_posts',           // Удаление постов
        'delete_comments',        // Удаление комментариев
        'edit_content',          // Редактирование контента
        'manage_moderators',      // Управление модераторами (добавление, удаление, изменение прав)
        'manage_users',           // Управление пользователями
        'system_settings',        // Системные настройки
        'view_all_actions',       // Просмотр всех действий модераторов
        'export_data'            // Экспорт данных
      ]
    };

    return permissions[role] || permissions.moderator;
  }

  calculatePriority(reason, targetType) {
    const urgentReasons = ['violence', 'hate_speech', 'child_exploitation', 'terrorism'];
    const highPriorityReasons = ['harassment', 'bullying', 'threats', 'sexual_content'];
    
    if (urgentReasons.includes(reason)) {
      return 3; // Максимальный приоритет
    } else if (highPriorityReasons.includes(reason)) {
      return 2; // Высокий приоритет
    } else if (targetType === 'user') {
      return 1; // Средний приоритет для пользователей
    } else {
      return 0; // Низкий приоритет для контента
    }
  }

  isUrgentReport(reason) {
    const urgentReasons = ['violence', 'hate_speech', 'child_exploitation', 'terrorism'];
    return urgentReasons.includes(reason);
  }

  async updateModeratorStats(moderatorUid, stat, increment = 1) {
    try {
      const moderator = await this.getModerator(moderatorUid);
      if (moderator) {
        moderator.stats[stat] = (moderator.stats[stat] || 0) + increment;
        moderator.updatedAt = Math.floor(Date.now() / 1000);
        
        const moderatorPath = this.getModeratorPath(moderatorUid);
        await writeFile(moderatorPath, moderator);
      }
    } catch (error) {
      console.error('Ошибка при обновлении статистики модератора:', error);
    }
  }

  async logAction(actionData) {
    try {
      const actionId = Math.floor(Math.random() * 1000000000);
      actionData.id = actionId;
      actionData.timestamp = actionData.timestamp || Math.floor(Date.now() / 1000);
      
      const actionPath = this.getActionPath(actionId);
      const actionDir = path.dirname(actionPath);
      await ensureDir(actionDir);
      
      await writeFile(actionPath, actionData);
      
      // Также сохраняем в панель модерации конкретного модератора (если указан)
      if (actionData.moderatorUid) {
        await this.addToModerationPanel(actionData.moderatorUid, actionData);
      }
    } catch (error) {
      console.error('Ошибка при записи действия:', error);
    }
  }

  /**
   * Добавить действие в панель модерации модератора
   */
  async addToModerationPanel(moderatorUid, actionData) {
    try {
      const panelPath = this.getModerationPanelPath(moderatorUid);
      await ensureDir(panelPath);
      
      // Создаем файл истории действий
      const historyFile = path.join(panelPath, 'actions_history.json');
      
      let history = [];
      if (await exists(historyFile)) {
        try {
          history = await readFile(historyFile);
          if (!Array.isArray(history)) {
            history = [];
          }
        } catch (err) {
          history = [];
        }
      }
      
      // Добавляем новое действие в начало списка
      history.unshift({
        id: actionData.id,
        type: actionData.type,
        targetUid: actionData.targetUid || null,
        targetType: actionData.targetType || null,
        targetId: actionData.targetId || actionData.reportId || null,
        details: actionData.details || {},
        timestamp: actionData.timestamp,
        date: new Date(actionData.timestamp * 1000).toISOString()
      });
      
      // Ограничиваем историю последними 10000 действиями
      if (history.length > 10000) {
        history = history.slice(0, 10000);
      }
      
      await writeFile(historyFile, history);
      
      // Также создаем файл статистики
      await this.updateModerationPanelStats(moderatorUid, actionData);
    } catch (error) {
      console.error('Ошибка при добавлении в панель модерации:', error);
    }
  }

  /**
   * Обновить статистику в панели модерации
   */
  async updateModerationPanelStats(moderatorUid, actionData) {
    try {
      const panelPath = this.getModerationPanelPath(moderatorUid);
      const statsFile = path.join(panelPath, 'stats.json');
      
      let stats = {
        totalActions: 0,
        reportsReviewed: 0,
        bansIssued: 0,
        warningsIssued: 0,
        unbansIssued: 0,
        contentDeleted: 0,
        contentEdited: 0,
        lastAction: null,
        firstAction: null,
        actionsByType: {}
      };
      
      if (await exists(statsFile)) {
        try {
          stats = await readFile(statsFile);
        } catch (err) {
          // Используем дефолтные значения
        }
      }
      
      stats.totalActions = (stats.totalActions || 0) + 1;
      
      // Обновляем счетчики по типам действий
      if (!stats.actionsByType) {
        stats.actionsByType = {};
      }
      stats.actionsByType[actionData.type] = (stats.actionsByType[actionData.type] || 0) + 1;
      
      // Обновляем специфичные счетчики
      switch (actionData.type) {
        case 'update_report':
        case 'review_report':
          stats.reportsReviewed = (stats.reportsReviewed || 0) + 1;
          break;
        case 'ban_user':
          stats.bansIssued = (stats.bansIssued || 0) + 1;
          break;
        case 'warn_user':
          stats.warningsIssued = (stats.warningsIssued || 0) + 1;
          break;
        case 'unban_user':
          stats.unbansIssued = (stats.unbansIssued || 0) + 1;
          break;
        case 'delete_post':
        case 'delete_comment':
        case 'delete_content':
          stats.contentDeleted = (stats.contentDeleted || 0) + 1;
          break;
        case 'edit_post':
        case 'edit_comment':
        case 'edit_content':
          stats.contentEdited = (stats.contentEdited || 0) + 1;
          break;
      }
      
      stats.lastAction = {
        type: actionData.type,
        timestamp: actionData.timestamp,
        date: new Date(actionData.timestamp * 1000).toISOString()
      };
      
      if (!stats.firstAction) {
        stats.firstAction = {
          type: actionData.type,
          timestamp: actionData.timestamp,
          date: new Date(actionData.timestamp * 1000).toISOString()
        };
      }
      
      await writeFile(statsFile, stats);
    } catch (error) {
      console.error('Ошибка при обновлении статистики панели:', error);
    }
  }

  /**
   * Получить панель модерации модератора (история действий)
   */
  async getModerationPanel(moderatorUid, options = {}) {
    try {
      const panelPath = this.getModerationPanelPath(moderatorUid);
      
      if (!(await exists(panelPath))) {
        return {
          moderatorUid,
          actions: [],
          stats: {
            totalActions: 0,
            reportsReviewed: 0,
            bansIssued: 0,
            warningsIssued: 0,
            unbansIssued: 0,
            contentDeleted: 0,
            contentEdited: 0
          }
        };
      }
      
      const historyFile = path.join(panelPath, 'actions_history.json');
      const statsFile = path.join(panelPath, 'stats.json');
      
      let actions = [];
      let stats = {};
      
      if (await exists(historyFile)) {
        try {
          actions = await readFile(historyFile);
          if (!Array.isArray(actions)) {
            actions = [];
          }
        } catch (err) {
          actions = [];
        }
      }
      
      if (await exists(statsFile)) {
        try {
          stats = await readFile(statsFile);
        } catch (err) {
          stats = {};
        }
      }
      
      // Фильтрация по типу действия
      if (options.actionType) {
        actions = actions.filter(a => a.type === options.actionType);
      }
      
      // Фильтрация по дате
      if (options.startDate) {
        const startTimestamp = Math.floor(new Date(options.startDate).getTime() / 1000);
        actions = actions.filter(a => a.timestamp >= startTimestamp);
      }
      
      if (options.endDate) {
        const endTimestamp = Math.floor(new Date(options.endDate).getTime() / 1000);
        actions = actions.filter(a => a.timestamp <= endTimestamp);
      }
      
      // Фильтрация по целевому пользователю
      if (options.targetUid) {
        actions = actions.filter(a => a.targetUid === parseInt(options.targetUid));
      }
      
      // Лимит и пагинация
      const limit = options.limit || 100;
      const offset = options.offset || 0;
      const paginatedActions = actions.slice(offset, offset + limit);
      
      return {
        moderatorUid,
        actions: paginatedActions,
        stats,
        pagination: {
          total: actions.length,
          limit,
          offset,
          hasMore: offset + limit < actions.length
        }
      };
    } catch (error) {
      console.error('Ошибка при получении панели модерации:', error);
      throw error;
    }
  }

  async getRecentActions(limit = 100) {
    try {
      const actions = [];
      const actionsDir = path.join(this.moderatorsPath, 'actions');
      
      if (!(await exists(actionsDir))) {
        return [];
      }

      // Получаем все года
      const years = await readDir(actionsDir);
      years.sort((a, b) => parseInt(b) - parseInt(a)); // Сначала новые года
      
      for (const year of years) {
        const yearPath = path.join(actionsDir, year);
        const months = await readDir(yearPath);
        months.sort((a, b) => parseInt(b) - parseInt(a)); // Сначала новые месяцы
        
        for (const month of months) {
          const monthPath = path.join(yearPath, month);
          const days = await readDir(monthPath);
          days.sort((a, b) => parseInt(b) - parseInt(a)); // Сначала новые дни
          
          for (const day of days) {
            const dayPath = path.join(monthPath, day);
            const actionFiles = await readDir(dayPath);
            actionFiles.sort((a, b) => {
              const aId = parseInt(a.replace('action_', '').replace('.json', ''));
              const bId = parseInt(b.replace('action_', '').replace('.json', ''));
              return bId - aId; // Сначала новые ID (более высокие)
            });
            
            for (const file of actionFiles) {
              try {
                const actionPath = path.join(dayPath, file);
                const actionData = await readFile(actionPath);
                actions.push(actionData);
                
                if (actions.length >= limit) {
                  return actions;
                }
              } catch (err) {
                continue;
              }
            }
            
            if (actions.length >= limit) break;
          }
          if (actions.length >= limit) break;
        }
        if (actions.length >= limit) break;
      }

      return actions;
    } catch (error) {
      console.error('Ошибка при получении действий:', error);
      return [];
    }
  }

  async getAllBans() {
    try {
      const bans = [];
      const bansDir = path.join(this.moderatorsPath, 'bans');
      
      if (!(await exists(bansDir))) {
        return [];
      }

      const shards = await readDir(bansDir);
      
      for (const shard of shards) {
        const shardPath = path.join(bansDir, shard);
        if (!(await exists(shardPath))) continue;
        
        const banFiles = await readDir(shardPath);
        
        for (const file of banFiles) {
          try {
            const banPath = path.join(shardPath, file);
            const banData = await readFile(banPath);
            bans.push(banData);
          } catch (err) {
            continue;
          }
        }
      }

      return bans;
    } catch (error) {
      console.error('Ошибка при получении всех банов:', error);
      return [];
    }
  }

  async getAllWarnings() {
    try {
      const warnings = [];
      const warningsDir = path.join(this.moderatorsPath, 'warnings');
      
      if (!(await exists(warningsDir))) {
        return [];
      }

      const shards = await readDir(warningsDir);
      
      for (const shard of shards) {
        const shardPath = path.join(warningsDir, shard);
        if (!(await exists(shardPath))) continue;
        
        const warningFiles = await readDir(shardPath);
        
        for (const file of warningFiles) {
          try {
            const warningPath = path.join(shardPath, file);
            const warningData = await readFile(warningPath);
            warnings.push(warningData);
          } catch (err) {
            continue;
          }
        }
      }

      return warnings;
    } catch (error) {
      console.error('Ошибка при получении всех предупреждений:', error);
      return [];
    }
  }

  /**
   * Проверить, имеет ли пользователь разрешение на действие
   */
  async hasPermission(moderatorUid, permission) {
    try {
      const moderator = await this.getModerator(moderatorUid);
      if (!moderator || !moderator.isActive) {
        return false;
      }

      return moderator.permissions.includes(permission) || 
             moderator.permissions.includes('superadmin') ||
             moderator.role === 'superadmin';
    } catch (error) {
      console.error('Ошибка при проверке разрешения:', error);
      return false;
    }
  }

  /**
   * Получить историю модерации пользователя
   */
  async getUserModerationHistory(userUid) {
    try {
      const history = {
        bans: await this.getUserBans(userUid),
        warnings: await this.getUserWarnings(userUid),
        reportsFiled: [],
        reportsAgainst: []
      };

      // Получаем репорты, созданные пользователем
      const allReports = await this.getReports({});
      history.reportsFiled = allReports.filter(r => r.reporterUid === userUid);
      
      // Получаем репорты против пользователя
      history.reportsAgainst = allReports.filter(r => 
        r.targetType === 'user' && r.targetId === userUid
      );

      return history;
    } catch (error) {
      console.error('Ошибка при получении истории модерации:', error);
      throw error;
    }
  }
}