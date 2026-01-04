import { readJson, writeJson, exists, ensureDir, readDir } from '../../utils/fs.js';
import path from 'path';

/**
 * Менеджер настроек системы
 * Управление глобальными настройками, конфигурациями и параметрами системы
 */
export class SettingsManager {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.settingsPath = path.join(rootPath, 'settings');
    this.systemSettingsPath = path.join(this.settingsPath, 'system');
    this.userDefaultsPath = path.join(this.settingsPath, 'user_defaults');
    this.backupPath = path.join(this.settingsPath, 'backups');
    this.cachePath = path.join(this.settingsPath, 'cache');
    
    // Дефолтные настройки системы
    this.defaultSystemSettings = {
      version: '1.0.0',
      server: {
        name: 'Mifistix Database Server',
        description: 'JSON-based database management system',
        port: 8484,
        host: 'localhost',
        environment: process.env.NODE_ENV || 'development',
        maintenanceMode: false,
        maintenanceMessage: 'Server is under maintenance',
        maintenanceUntil: null
      },
      security: {
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireNumbers: true,
        passwordRequireSpecialChars: false,
        maxLoginAttempts: 5,
        loginLockoutTime: 900,
        sessionTimeout: 86400,
        requireEmailVerification: false,
        requirePhoneVerification: false,
        twoFactorEnabled: false,
        apiRateLimit: {
          enabled: true,
          requestsPerMinute: 60,
          burstLimit: 100
        }
      },
      storage: {
        maxUserStorageMB: 1024,
        maxFileSizeMB: 50,
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'mp3', 'mp4', 'pdf', 'txt', 'json'],
        compressionEnabled: true,
        backupIntervalHours: 24,
        maxBackups: 30,
        cleanupIntervalHours: 168
      },
      performance: {
        cacheEnabled: true,
        cacheTTL: 300,
        maxConcurrentConnections: 1000,
        queryTimeout: 30,
        enableGzip: true,
        enableCaching: true,
        workerThreads: 4
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        defaultLanguage: 'ru',
        timezone: 'Europe/Moscow',
        adminNotifications: {
          newUser: true,
          newReport: true,
          serverErrors: true,
          storageWarnings: true
        }
      },
      features: {
        userRegistration: true,
        guestAccess: false,
        socialLogin: false,
        apiAccess: true,
        realTimeUpdates: true,
        websocketEnabled: true,
        searchEnabled: true,
        moderationEnabled: true,
        projectsEnabled: true,
        marketplaceEnabled: false
      },
      limits: {
        maxFriends: 5000,
        maxGroups: 100,
        maxPostsPerDay: 100,
        maxCommentsPerPost: 1000,
        maxMediaPerPost: 10,
        maxChatParticipants: 100,
        maxMessageLength: 5000,
        maxUsernameLength: 32,
        minUsernameLength: 3
      },
      monitoring: {
        enabled: true,
        logLevel: 'info',
        metricsInterval: 60,
        errorReporting: true,
        performanceMonitoring: true,
        alertThresholds: {
          cpu: 80,
          memory: 85,
          disk: 90,
          responseTime: 1000
        }
      },
      backups: {
        enabled: true,
        schedule: '0 2 * * *',
        retentionDays: 30,
        compressionLevel: 6,
        includeLogs: true,
        includeCache: false,
        notificationOnSuccess: false,
        notificationOnFailure: true
      },
      updates: {
        autoCheck: true,
        autoUpdate: false,
        notifyAdmins: true,
        maintenanceWindow: '02:00-04:00',
        backupBeforeUpdate: true
      }
    };

    // Дефолтные настройки пользователя
    this.defaultUserSettings = {
      profile: {
        privacy: {
          showEmail: 'friends',
          showPhone: 'friends',
          showBirthday: 'friends',
          showLocation: 'friends',
          showOnlineStatus: 'everyone',
          showLastSeen: 'friends',
          profileVisibility: 'public',
          searchVisibility: 'everyone'
        },
        notifications: {
          friendRequests: true,
          friendOnline: true,
          messages: true,
          comments: true,
          likes: true,
          shares: true,
          mentions: true,
          news: true,
          promotions: false,
          system: true
        },
        appearance: {
          theme: 'dark',
          language: 'ru',
          fontSize: 'medium',
          density: 'comfortable',
          animations: true,
          reduceMotion: false,
          highContrast: false,
          customCSS: ''
        },
        security: {
          twoFactorAuth: false,
          loginAlerts: true,
          sessionManagement: true,
          deviceManagement: true,
          trustedDevices: [],
          privacyMode: false,
          dataExport: true
        },
        content: {
          autoplayVideos: true,
          autoplayAudio: false,
          imageQuality: 'auto',
          videoQuality: 'auto',
          adultContent: false,
          sensitiveContentWarning: true,
          contentFilters: []
        },
        communication: {
          messageRequests: 'everyone',
          groupInvites: 'friends',
          eventInvites: 'friends',
          allowMessagesFrom: 'everyone',
          allowCallsFrom: 'friends',
          readReceipts: true,
          typingIndicators: true,
          onlineStatus: true
        }
      },
      system: {
        dataSaver: false,
        autoBackup: true,
        backupFrequency: 'weekly',
        cacheSize: 100,
        clearCacheOnExit: false,
        performanceMode: 'balanced',
        developerMode: false,
        debugLogs: false
      }
    };
  }

  /**
   * Инициализация менеджера настроек
   */
  async initialize() {
    try {
      // Создаем структуру папок
      await ensureDir(this.settingsPath);
      await ensureDir(this.systemSettingsPath);
      await ensureDir(this.userDefaultsPath);
      await ensureDir(this.backupPath);
      await ensureDir(this.cachePath);

      // Инициализируем системные настройки, если их нет
      await this.initializeSystemSettings();
      
      // Инициализируем настройки пользователя по умолчанию
      await this.initializeUserDefaults();

      console.log('[SettingsManager] Инициализирован');
      return true;
    } catch (error) {
      console.error('[SettingsManager] Ошибка инициализации:', error);
      throw error;
    }
  }

  /**
   * Инициализация системных настроек
   */
  async initializeSystemSettings() {
    const systemSettingsFile = path.join(this.systemSettingsPath, 'system.json');
    
    if (!await exists(systemSettingsFile)) {
      await writeJson(systemSettingsFile, this.defaultSystemSettings);
      console.log('[SettingsManager] Созданы системные настройки по умолчанию');
    }
  }

  /**
   * Инициализация настроек пользователя по умолчанию
   */
  async initializeUserDefaults() {
    const userDefaultsFile = path.join(this.userDefaultsPath, 'defaults.json');
    
    if (!await exists(userDefaultsFile)) {
      await writeJson(userDefaultsFile, this.defaultUserSettings);
      console.log('[SettingsManager] Созданы настройки пользователя по умолчанию');
    }
  }

  /**
   * Получение системных настроек
   */
  async getSystemSettings(section = null) {
    try {
      const systemSettingsFile = path.join(this.systemSettingsPath, 'system.json');
      
      if (!await exists(systemSettingsFile)) {
        await this.initializeSystemSettings();
      }

      const settings = await readJson(systemSettingsFile);
      
      if (section) {
        return settings[section] || null;
      }
      
      return settings;
    } catch (error) {
      console.error('[SettingsManager] Ошибка получения системных настроек:', error);
      throw error;
    }
  }

  /**
   * Обновление системных настроек
   */
  async updateSystemSettings(updates, section = null) {
    try {
      const systemSettingsFile = path.join(this.systemSettingsPath, 'system.json');
      
      if (!await exists(systemSettingsFile)) {
        await this.initializeSystemSettings();
      }

      const currentSettings = await readJson(systemSettingsFile);
      let updatedSettings;

      if (section) {
        updatedSettings = {
          ...currentSettings,
          [section]: {
            ...currentSettings[section],
            ...updates
          }
        };
      } else {
        updatedSettings = {
          ...currentSettings,
          ...updates
        };
      }

      updatedSettings._metadata = {
        updatedAt: new Date().toISOString(),
        updatedBy: 'system',
        version: currentSettings.version || '1.0.0'
      };

      await writeJson(systemSettingsFile, updatedSettings);
      
      await this.createBackup('system_settings', currentSettings);
      
      console.log('[SettingsManager] Системные настройки обновлены');
      return updatedSettings;
    } catch (error) {
      console.error('[SettingsManager] Ошибка обновления системных настроек:', error);
      throw error;
    }
  }

  /**
   * Получение настроек пользователя по умолчанию
   */
  async getUserDefaults() {
    try {
      const userDefaultsFile = path.join(this.userDefaultsPath, 'defaults.json');
      
      if (!await exists(userDefaultsFile)) {
        await this.initializeUserDefaults();
      }

      return await readJson(userDefaultsFile);
    } catch (error) {
      console.error('[SettingsManager] Ошибка получения настроек пользователя по умолчанию:', error);
      throw error;
    }
  }

  /**
   * Получение конкретной настройки системы
   */
  async getSystemSetting(path, defaultValue = null) {
    try {
      const settings = await this.getSystemSettings();
      const keys = path.split('.');
      let value = settings;
      
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return defaultValue;
        }
      }
      
      return value;
    } catch (error) {
      console.error(`[SettingsManager] Ошибка получения настройки "${path}":`, error);
      return defaultValue;
    }
  }

  /**
   * Установка конкретной настройки системы
   */
  async setSystemSetting(path, value) {
    try {
      const settings = await this.getSystemSettings();
      const keys = path.split('.');
      let current = settings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key];
      }
      
      current[keys[keys.length - 1]] = value;
      
      await this.updateSystemSettings(settings);
      return true;
    } catch (error) {
      console.error(`[SettingsManager] Ошибка установки настройки "${path}":`, error);
      return false;
    }
  }

  /**
   * Проверка, включена ли функция
   */
  async isFeatureEnabled(feature) {
    try {
      const features = await this.getSystemSetting('features', {});
      return features[feature] === true;
    } catch (error) {
      console.error(`[SettingsManager] Ошибка проверки функции "${feature}":`, error);
      return false;
    }
  }

  /**
   * Включение/выключение функции
   */
  async setFeatureEnabled(feature, enabled) {
    return await this.setSystemSetting(`features.${feature}`, enabled);
  }

  /**
   * Получение текущей конфигурации сервера
   */
  async getServerConfig() {
    try {
      const settings = await this.getSystemSettings();
      return {
        server: settings.server,
        security: settings.security,
        performance: settings.performance,
        features: settings.features,
        limits: settings.limits
      };
    } catch (error) {
      console.error('[SettingsManager] Ошибка получения конфигурации сервера:', error);
      throw error;
    }
  }

  /**
   * Создание резервной копии настроек
   */
  async createBackup(name, data = null) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${name}_${timestamp}.json`;
      const backupFilePath = path.join(this.backupPath, backupFileName);
      
      const backupData = data || await this.getSystemSettings();
      const backup = {
        name,
        timestamp: new Date().toISOString(),
        data: backupData,
        metadata: {
          version: backupData.version || '1.0.0',
          backupType: name
        }
      };
      
      await writeJson(backupFilePath, backup);
      
      await this.cleanupOldBackups();
      
      console.log(`[SettingsManager] Создан бэкап: ${backupFileName}`);
      return backupFilePath;
    } catch (error) {
      console.error('[SettingsManager] Ошибка создания бэкапа:', error);
      throw error;
    }
  }

  /**
   * Очистка старых бэкапов
   */
  async cleanupOldBackups() {
    try {
      const backups = await readDir(this.backupPath);
      const maxBackups = await this.getSystemSetting('backups.maxBackups', 30);
      
      if (backups.length > maxBackups) {
        const fsPromises = await import('fs/promises');
        const backupFiles = [];
        
        for (const file of backups) {
          const filePath = path.join(this.backupPath, file);
          const stat = await fsPromises.stat(filePath);
          backupFiles.push({
            name: file,
            path: filePath,
            stat: stat
          });
        }
        
        backupFiles.sort((a, b) => a.stat.birthtimeMs - b.stat.birthtimeMs);
        
        const filesToDelete = backupFiles.slice(0, backups.length - maxBackups);
        for (const file of filesToDelete) {
          await fsPromises.unlink(file.path);
          console.log(`[SettingsManager] Удален старый бэкап: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('[SettingsManager] Ошибка очистки бэкапов:', error);
    }
  }

  /**
   * Восстановление настроек из бэкапа
   */
  async restoreFromBackup(backupFileName) {
    try {
      const backupFilePath = path.join(this.backupPath, backupFileName);
      
      if (!await exists(backupFilePath)) {
        throw new Error(`Backup file not found: ${backupFileName}`);
      }
      
      const backup = await readJson(backupFilePath);
      
      const currentVersion = await this.getSystemSetting('version');
      if (backup.metadata.version !== currentVersion) {
        console.warn(`[SettingsManager] Версия бэкапа (${backup.metadata.version}) отличается от текущей (${currentVersion})`);
      }
      
      await this.createBackup('pre_restore');
      
      await writeJson(path.join(this.systemSettingsPath, 'system.json'), backup.data);
      
      console.log(`[SettingsManager] Настройки восстановлены из бэкапа: ${backupFileName}`);
      return true;
    } catch (error) {
      console.error('[SettingsManager] Ошибка восстановления из бэкапа:', error);
      throw error;
    }
  }

  /**
   * Получение списка доступных бэкапов
   */
  async listBackups() {
    try {
      const backups = await readDir(this.backupPath);
      const backupList = [];
      const fsPromises = await import('fs/promises');
      
      for (const backupFile of backups) {
        if (backupFile.endsWith('.json')) {
          const backupPath = path.join(this.backupPath, backupFile);
          try {
            const backup = await readJson(backupPath);
            const stat = await fsPromises.stat(backupPath);
            
            backupList.push({
              name: backupFile,
              size: stat.size,
              timestamp: backup.timestamp,
              type: backup.metadata?.backupType || 'unknown',
              version: backup.metadata?.version || 'unknown'
            });
          } catch (error) {
            console.error(`[SettingsManager] Ошибка чтения бэкапа ${backupFile}:`, error);
          }
        }
      }
      
      backupList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return backupList;
    } catch (error) {
      console.error('[SettingsManager] Ошибка получения списка бэкапов:', error);
      return [];
    }
  }

  /**
   * Получение статистики настроек
   */
  async getSettingsStats() {
    try {
      const systemSettings = await this.getSystemSettings();
      const userDefaults = await this.getUserDefaults();
      const backups = await this.listBackups();
      
      return {
        system: {
          sections: Object.keys(systemSettings).length,
          version: systemSettings.version,
          lastUpdated: systemSettings._metadata?.updatedAt || 'never'
        },
        userDefaults: {
          sections: Object.keys(userDefaults.profile || {}).length,
          totalSettings: this._countSettings(userDefaults)
        },
        backups: {
          count: backups.length,
          latest: backups[0] || null,
          totalSize: backups.reduce((sum, b) => sum + (b.size || 0), 0)
        },
        storage: {
          settingsPath: this.settingsPath,
          systemSize: await this._getDirectorySize(this.systemSettingsPath),
          backupsSize: await this._getDirectorySize(this.backupPath),
          totalSize: await this._getDirectorySize(this.settingsPath)
        }
      };
    } catch (error) {
      console.error('[SettingsManager] Ошибка получения статистики:', error);
      throw error;
    }
  }

  /**
   * Подсчет количества настроек в объекте
   */
  _countSettings(obj, count = 0) {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          count = this._countSettings(obj[key], count);
        } else {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Получение размера директории
   */
  async _getDirectorySize(dirPath) {
    try {
      const fsPromises = await import('fs/promises');
      const stats = await fsPromises.stat(dirPath);
      
      if (!stats.isDirectory()) {
        return stats.size;
      }
      
      const files = await fsPromises.readdir(dirPath);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const fileStats = await fsPromises.stat(filePath);
        
        if (fileStats.isDirectory()) {
          totalSize += await this._getDirectorySize(filePath);
        } else {
          totalSize += fileStats.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error(`[SettingsManager] Ошибка получения размера директории ${dirPath}:`, error);
      return 0;
    }
  }

  /**
   * Экспорт настроек в файл
   */
  async exportSettings(filePath) {
    try {
      const settings = await this.getSystemSettings();
      const userDefaults = await this.getUserDefaults();
      
      const exportData = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          version: settings.version,
          exportType: 'full_settings'
        },
        systemSettings: settings,
        userDefaults: userDefaults
      };
      
      await writeJson(filePath, exportData);
      console.log(`[SettingsManager] Настройки экспортированы в: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('[SettingsManager] Ошибка экспорта настроек:', error);
      throw error;
    }
  }

  /**
   * Импорт настроек из файла
   */
  async importSettings(filePath) {
    try {
      if (!await exists(filePath)) {
        throw new Error(`Import file not found: ${filePath}`);
      }
      
      const importData = await readJson(filePath);
      
      if (!importData.systemSettings || !importData.exportInfo) {
        throw new Error('Invalid import file format');
      }
      
      await this.createBackup('pre_import');
      
      await writeJson(path.join(this.systemSettingsPath, 'system.json'), importData.systemSettings);
      
      if (importData.userDefaults) {
        await writeJson(path.join(this.userDefaultsPath, 'defaults.json'), importData.userDefaults);
      }
      
      console.log(`[SettingsManager] Настройки импортированы из: ${filePath}`);
      return true;
    } catch (error) {
      console.error('[SettingsManager] Ошибка импорта настроек:', error);
      
      try {
        await this.restoreFromBackup('pre_import_latest.json');
        console.log('[SettingsManager] Восстановлено из бэкапа после ошибки импорта');
      } catch (restoreError) {
        console.error('[SettingsManager] Ошибка восстановления после импорта:', restoreError);
      }
      
      throw error;
    }
  }
}