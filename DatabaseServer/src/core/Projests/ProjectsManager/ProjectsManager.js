import path from 'path';
import { 
  exists, 
  readDir, 
  readFile, 
  writeFile, 
  mkdir, 
  rm, 
  stat,
  ensureDir 
} from '../../../utils/fs.js';
import { DB_CONFIG } from '../../../config.js';
import { DatabaseManager } from '../../../core/DatabaseManager.js';
import { sendJSON, sendError, parseBody } from '../../../utils/http.js';

/**
 * Обработчики API для управления проектами
 * Проекты создаются в корне E:\
 */
export class ProjectsManagerAPI {
  constructor() {
    // ИЗМЕНЕНО: Проекты создаются в корне диска E:\
    this.projectsRoot = 'E:\\';  // Корневой диск для проектов
    this.projectsDir = path.join(this.projectsRoot, 'projects'); // Для мета-данных проектов
    this.dbManager = new DatabaseManager();
  }

  /**
   * Инициализирует директорию проектов
   */
  async initialize() {
    // Создаем папку для мета-данных проектов
    await ensureDir(this.projectsDir);
    console.log(`✅ Менеджер проектов готов. Проекты в: ${this.projectsRoot}`);
  }

  /**
   * Находит ВСЕ проекты на диске E:\
   * Ищет папки с префиксом 'project_' в корне E:\
   */
  async findAllProjectsOnDisk() {
    const projects = [];
    
    try {
      // Сканируем корень диска E:\
      const rootItems = await readDir(this.projectsRoot);
      
      for (const item of rootItems) {
        // Ищем папки проектов (project_* или любые папки с project.json)
        const itemPath = path.join(this.projectsRoot, item);
        const itemStat = await stat(itemPath);
        
        if (itemStat.isDirectory()) {
          // Проверяем папки с префиксом 'project_'
          if (item.startsWith('project_')) {
            await this.addProjectToList(item, itemPath, projects);
          } else {
            // Также проверяем другие папки на наличие project.json
            const projectJsonPath = path.join(itemPath, 'project.json');
            if (await exists(projectJsonPath)) {
              await this.addProjectToList(item, itemPath, projects);
            }
          }
        }
      }
      
      // Также проверяем папку с мета-данными
      if (await exists(this.projectsDir)) {
        const metaProjectFolders = await readDir(this.projectsDir);
        for (const folder of metaProjectFolders) {
          const metaProjectPath = path.join(this.projectsDir, folder, 'project.json');
          if (await exists(metaProjectPath)) {
            try {
              const projectData = JSON.parse(await readFile(metaProjectPath, 'utf8'));
              
              // Проверяем, есть ли уже такой проект в списке
              const existingIndex = projects.findIndex(p => 
                p.projectId === projectData.projectId || 
                p.folderName === folder
              );
              
              if (existingIndex === -1) {
                projects.push({
                  id: projectData.id || Date.now().toString(),
                  name: projectData.name,
                  projectId: projectData.projectId,
                  created: projectData.created || new Date().toISOString(),
                  description: projectData.description || '',
                  status: projectData.status || 'active',
                  folderName: folder,
                  path: path.join(this.projectsDir, folder),
                  type: 'meta-only' // Проект только в мета-данных
                });
              }
            } catch (err) {
              console.error(`Error reading meta project ${folder}:`, err);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error scanning disk for projects:', error);
    }
    
    return projects;
  }

  /**
   * Добавляет проект в список
   */
  async addProjectToList(folderName, folderPath, projectsList) {
    const projectJsonPath = path.join(folderPath, 'project.json');
    
    if (await exists(projectJsonPath)) {
      try {
        const projectData = JSON.parse(await readFile(projectJsonPath, 'utf8'));
        
        // Определяем тип проекта
        let projectType = 'standard';
        if (folderPath.includes('SOCIAL_DB')) projectType = 'social-db';
        if (folderPath.includes('system')) projectType = 'system';
        
        projectsList.push({
          id: projectData.id || Date.now().toString(),
          name: projectData.name || folderName,
          projectId: projectData.projectId || folderName.replace('project_', ''),
          created: projectData.created || new Date().toISOString(),
          description: projectData.description || '',
          status: projectData.status || 'active',
          folderName: folderName,
          path: folderPath,
          type: projectType,
          isInRoot: folderPath.startsWith('E:\\') && !folderPath.includes('\\')
        });
      } catch (err) {
        // Если project.json поврежден, добавляем базовую информацию
        projectsList.push({
          id: Date.now().toString(),
          name: folderName,
          projectId: folderName.replace('project_', ''),
          created: new Date().toISOString(),
          description: 'Project folder found',
          status: 'active',
          folderName: folderName,
          path: folderPath,
          type: 'unknown',
          hasValidJson: false
        });
      }
    } else {
      // Папка без project.json - считаем её потенциальным проектом
      projectsList.push({
        id: Date.now().toString(),
        name: folderName,
        projectId: folderName.replace('project_', ''),
        created: new Date().toISOString(),
        description: 'Project folder (no project.json)',
        status: 'incomplete',
        folderName: folderName,
        path: folderPath,
        type: 'folder-only',
        hasValidJson: false
      });
    }
  }

  /**
   * API: GET /api/projects - Получить ВСЕ проекты на диске E:\
   */
  async getAllProjects() {
    const projects = [];
    
    console.log(`🔍 Поиск проектов в: ${this.projectsDir}`);
    
    // 1. Проверяем папку проектов в SOCIAL_DB
    if (await exists(this.projectsDir)) {
      const projectFolders = await readDir(this.projectsDir);
      console.log(`📁 Папок в ${this.projectsDir}: ${projectFolders.length}`, projectFolders);
      
      for (const folder of projectFolders) {
        const projectPath = path.join(this.projectsDir, folder);
        const projectJsonPath = path.join(projectPath, 'project.json');
        const hasProjectJson = await exists(projectJsonPath);
        
        if (hasProjectJson) {
          try {
            const projectData = JSON.parse(await readFile(projectJsonPath, 'utf8'));
            projects.push({
              id: projectData.id || Date.now().toString(),
              name: projectData.name || folder,
              projectId: projectData.projectId || folder.replace('project_', ''),
              created: projectData.created || new Date().toISOString(),
              description: projectData.description || 'Project with config',
              status: projectData.status || 'active',
              type: 'configured',
              location: this.projectsDir,
              hasConfig: true
            });
            console.log(`✅ Найден проект с конфигом: ${projectData.name || folder}`);
          } catch (err) {
            console.error(`❌ Ошибка чтения проекта ${folder}:`, err);
          }
        } else {
          // Папка без project.json - тоже показываем как проект
          try {
            const statInfo = await stat(projectPath);
            projects.push({
              id: Date.now().toString(),
              name: folder,
              projectId: folder.replace('project_', ''),
              created: new Date(statInfo.birthtime).toISOString(),
              description: 'Project folder (no config)',
              status: 'incomplete',
              type: 'folder-only',
              location: this.projectsDir,
              hasConfig: false,
              folderName: folder
            });
            console.log(`📁 Папка проекта (без конфига): ${folder}`);
          } catch (statErr) {
            console.error(`❌ Ошибка чтения папки ${folder}:`, statErr);
          }
        }
      }
    } else {
      console.log(`⚠️ Папка проектов не существует: ${this.projectsDir}`);
    }
    
    // 2. Всегда добавляем SOCIAL_DB как системный проект
    try {
      const socialDbPath = 'E:\\SOCIAL_DB';
      if (await exists(socialDbPath)) {
        const statInfo = await stat(socialDbPath);
        projects.push({
          id: 'social_db_system',
          name: 'SOCIAL_DB',
          projectId: 'social_db',
          created: new Date(statInfo.birthtime).toISOString(),
          description: 'Основная база данных социальной сети',
          status: 'system',
          type: 'system-db',
          location: 'E:\\',
          hasConfig: false,
          isSystem: true
        });
        console.log(`🏢 Добавлена системная БД: SOCIAL_DB`);
      }
    } catch (error) {
      console.error('❌ Ошибка добавления SOCIAL_DB:', error);
    }
    
    console.log(`📋 Итого проектов: ${projects.length}`);
    
    // Сортируем: сначала системные, потом с конфигом, потом папки
    projects.sort((a, b) => {
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;
      if (a.hasConfig && !b.hasConfig) return -1;
      if (!a.hasConfig && b.hasConfig) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return projects;
  }

  /**
   * API: POST /api/projects - Создать новый проект в корне E:\
   */
  async createProject(req, res) {
    try {
      const data = await parseBody(req);
      
      // Валидация
      if (!data.name || !data.projectId) {
        return sendError(req, res, 400, 'Name and projectId are required');
      }

      // Проект создается прямо в корне E:\
      const projectFolder = `project_${data.projectId}`;
      const projectPath = path.join(this.projectsRoot, projectFolder); // E:\project_XXX
      
      if (await exists(projectPath)) {
        return sendError(req, res, 400, 'Project with this ID already exists');
      }

      // Создаем структуру папок в корне E:\
      await mkdir(projectPath, { recursive: true });
      await mkdir(path.join(projectPath, 'db'), { recursive: true });
      await mkdir(path.join(projectPath, 'logs'), { recursive: true });
      await mkdir(path.join(projectPath, 'backups'), { recursive: true });
      await mkdir(path.join(projectPath, 'uploads'), { recursive: true });

      // Создаем проект
      const project = {
        id: Date.now().toString(),
        name: data.name,
        projectId: data.projectId,
        created: new Date().toISOString(),
        description: data.description || '',
        status: 'active',
        // Путь теперь абсолютный
        fullPath: projectPath,
        databasePath: path.join(projectPath, 'db'),
        config: {
          version: '1.0.0',
          storageEngine: 'json',
          backupInterval: 86400000, // 24 часа
          maxFileSize: 104857600 // 100MB
        }
      };

      // Сохраняем project.json в корне проекта
      await writeFile(
        path.join(projectPath, 'project.json'),
        JSON.stringify(project, null, 2),
        'utf8'
      );

      // Также сохраняем в папке мета-данных (опционально)
      const metaProjectPath = path.join(this.projectsDir, projectFolder);
      await mkdir(metaProjectPath, { recursive: true });
      await writeFile(
        path.join(metaProjectPath, 'project.json'),
        JSON.stringify(project, null, 2),
        'utf8'
      );

      // Создаем конфиг проекта
      await this.createProjectConfig(projectPath, project);

      // Инициализируем базу данных для проекта
      const projectDbManager = new DatabaseManager(path.join(projectPath, 'db'));
      await projectDbManager.initialize();

      sendJSON(req, res, 201, {
        ...project,
        message: `Проект создан в ${projectPath}`
      });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  }

  /**
   * Создает конфигурационный файл для проекта
   */
  async createProjectConfig(projectPath, project) {
    const config = {
      project: {
        id: project.projectId,
        name: project.name,
        version: '1.0.0',
        location: projectPath
      },
      database: {
        path: project.databasePath,
        collections: [
          'users',
          'posts',
          'media',
          'settings',
          'logs'
        ]
      },
      api: {
        enabled: true,
        endpoints: [
          '/api/projects/:projectId/data/:collection',
          '/api/projects/:projectId/upload',
          '/api/projects/:projectId/query'
        ]
      }
    };

    await writeFile(
      path.join(projectPath, 'config.json'),
      JSON.stringify(config, null, 2),
      'utf8'
    );
  }

  /**
   * API: GET /api/projects/:projectId - Получить проект по ID
   */
  async getProject(req, res, params) {
    try {
      const projectId = params.projectId;
      
      // Ищем проект везде: в корне E:\ и в мета-данных
      const allProjects = await this.findAllProjectsOnDisk();
      const project = allProjects.find(p => 
        p.projectId === projectId || 
        p.folderName === `project_${projectId}` ||
        p.folderName === projectId
      );
      
      if (!project) {
        return sendError(req, res, 404, 'Project not found');
      }
      
      // Если есть project.json, читаем его
      const projectJsonPath = path.join(project.path, 'project.json');
      if (await exists(projectJsonPath)) {
        const projectData = JSON.parse(await readFile(projectJsonPath, 'utf8'));
        sendJSON(req, res, 200, {
          ...project,
          details: projectData
        });
      } else {
        sendJSON(req, res, 200, project);
      }
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  }

  /**
   * API: DELETE /api/projects/:projectId - Удалить проект
   */
  async deleteProject(req, res, params) {
    try {
      const projectId = params.projectId;
      const data = await parseBody(req);
      const force = data.force === true;
      
      // Ищем проект
      const allProjects = await this.findAllProjectsOnDisk();
      const project = allProjects.find(p => 
        p.projectId === projectId || 
        p.folderName === `project_${projectId}`
      );
      
      if (!project) {
        return sendError(req, res, 404, 'Project not found');
      }

      // Защита от удаления системных папок
      const protectedFolders = ['SOCIAL_DB', 'Windows', 'Program Files', 'Program Files (x86)', 'Users'];
      const isProtected = protectedFolders.some(folder => 
        project.path.includes(folder) && !force
      );
      
      if (isProtected) {
        return sendError(req, res, 403, 'Cannot delete protected system folder. Use force=true to override.');
      }

      // Удаляем папку проекта
      await rm(project.path, { recursive: true });
      
      // Также удаляем из мета-данных
      const metaProjectPath = path.join(this.projectsDir, project.folderName);
      if (await exists(metaProjectPath)) {
        await rm(metaProjectPath, { recursive: true });
      }
      
      sendJSON(req, res, 200, { 
        success: true, 
        message: 'Project deleted',
        projectId,
        deletedPath: project.path
      });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  }

  /**
   * API: GET /api/projects/:projectId/stats - Статистика проекта
   */
  async getProjectStats(req, res, params) {
    try {
      const projectId = params.projectId;
      
      // Ищем проект
      const allProjects = await this.findAllProjectsOnDisk();
      const project = allProjects.find(p => 
        p.projectId === projectId || 
        p.folderName === `project_${projectId}`
      );
      
      if (!project) {
        return sendError(req, res, 404, 'Project not found');
      }

      const dbPath = path.join(project.path, 'db');
      
      // Получаем статистику базы данных
      const stats = {
        projectInfo: project,
        totalSize: 0,
        fileCount: 0,
        directories: [],
        collections: [],
        lastBackup: null,
        hasDatabase: await exists(dbPath)
      };

      // Сканируем проектную папку
      if (await exists(project.path)) {
        const items = await readDir(project.path);
        
        for (const item of items) {
          const itemPath = path.join(project.path, item);
          const itemStat = await stat(itemPath);
          
          if (itemStat.isDirectory()) {
            stats.directories.push({
              name: item,
              size: itemStat.size,
              isDirectory: true
            });
          } else {
            stats.totalSize += itemStat.size;
            stats.fileCount++;
            
            if (item.endsWith('.json')) {
              const collectionName = item.replace('.json', '');
              try {
                const content = JSON.parse(await readFile(itemPath, 'utf8'));
                stats.collections.push({
                  name: collectionName,
                  count: Array.isArray(content) ? content.length : 1,
                  size: itemStat.size
                });
              } catch (err) {
                stats.collections.push({
                  name: collectionName,
                  count: 0,
                  size: itemStat.size,
                  error: 'Invalid JSON'
                });
              }
            }
          }
        }
      }

      // Проверяем наличие бэкапов
      const backupsPath = path.join(project.path, 'backups');
      if (await exists(backupsPath)) {
        const backups = await readDir(backupsPath);
        if (backups.length > 0) {
          stats.lastBackup = backups[backups.length - 1];
          stats.backupCount = backups.length;
        }
      }

      sendJSON(req, res, 200, stats);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  }

  /**
   * API: POST /api/projects/:projectId/backup - Создать бэкап
   */
  async createBackup(req, res, params) {
    try {
      const projectId = params.projectId;
      
      // Ищем проект
      const allProjects = await this.findAllProjectsOnDisk();
      const project = allProjects.find(p => 
        p.projectId === projectId || 
        p.folderName === `project_${projectId}`
      );
      
      if (!project) {
        return sendError(req, res, 404, 'Project not found');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup_${timestamp}`;
      const backupPath = path.join(project.path, 'backups', backupName);
      
      await mkdir(backupPath, { recursive: true });
      
      // Создаем информацию о бэкапе
      const backupInfo = {
        name: backupName,
        timestamp: new Date().toISOString(),
        projectId: project.projectId,
        projectName: project.name,
        projectPath: project.path,
        size: 0,
        createdBy: 'api'
      };
      
      await writeFile(
        path.join(backupPath, 'backup.json'),
        JSON.stringify(backupInfo, null, 2),
        'utf8'
      );

      sendJSON(req, res, 201, {
        success: true,
        message: 'Backup created',
        backup: backupInfo
      });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  }

  /**
   * API: GET /api/projects/:projectId/data/:collection - Получить данные коллекции
   */
  async getCollectionData(req, res, params) {
    try {
      const { projectId, collection } = params;
      
      // Ищем проект
      const allProjects = await this.findAllProjectsOnDisk();
      const project = allProjects.find(p => 
        p.projectId === projectId || 
        p.folderName === `project_${projectId}`
      );
      
      if (!project) {
        return sendError(req, res, 404, 'Project not found');
      }

      const dbPath = path.join(project.path, 'db', `${collection}.json`);
      
      if (!await exists(dbPath)) {
        return sendJSON(req, res, 200, []);
      }
      
      const data = JSON.parse(await readFile(dbPath, 'utf8'));
      sendJSON(req, res, 200, data);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  }

  /**
   * API: POST /api/projects/:projectId/data/:collection - Добавить данные в коллекцию
   */
  async addToCollection(req, res, params) {
    try {
      const { projectId, collection } = params;
      const data = await parseBody(req);
      
      // Ищем проект
      const allProjects = await this.findAllProjectsOnDisk();
      const project = allProjects.find(p => 
        p.projectId === projectId || 
        p.folderName === `project_${projectId}`
      );
      
      if (!project) {
        return sendError(req, res, 404, 'Project not found');
      }

      // Создаем директорию db если её нет
      const dbDir = path.join(project.path, 'db');
      await ensureDir(dbDir);
      
      const dbPath = path.join(dbDir, `${collection}.json`);
      let existingData = [];
      
      if (await exists(dbPath)) {
        existingData = JSON.parse(await readFile(dbPath, 'utf8'));
      }
      
      // Добавляем ID и timestamp
      const newItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      existingData.push(newItem);
      
      await writeFile(dbPath, JSON.stringify(existingData, null, 2), 'utf8');
      
      sendJSON(req, res, 201, newItem);
    } catch ( error) {
      sendError(req, res, 500, error.message);
    }
  }

  /**
   * API: GET /api/projects/scan - Принудительно просканировать диск
   */
  async scanDiskForProjects(req, res) {
    try {
      console.log('🔍 Принудительное сканирование диска E:\\...');
      const projects = await this.findAllProjectsOnDisk();
      
      sendJSON(req, res, 200, {
        message: `Найдено ${projects.length} проектов`,
        count: projects.length,
        projects: projects,
        scanTime: new Date().toISOString()
      });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  }
}

/**
 * Экспорт обработчиков для роутера
 */
export const projectsAPI = {
  'GET /api/projects': (req, res) => new ProjectsManagerAPI().getAllProjects(req, res),
  'POST /api/projects': (req, res) => new ProjectsManagerAPI().createProject(req, res),
  'GET /api/projects/:projectId': (req, res, params) => new ProjectsManagerAPI().getProject(req, res, params),
  'DELETE /api/projects/:projectId': (req, res, params) => new ProjectsManagerAPI().deleteProject(req, res, params),
  'GET /api/projects/:projectId/stats': (req, res, params) => new ProjectsManagerAPI().getProjectStats(req, res, params),
  'POST /api/projects/:projectId/backup': (req, res, params) => new ProjectsManagerAPI().createBackup(req, res, params),
  'GET /api/projects/:projectId/data/:collection': (req, res, params) => new ProjectsManagerAPI().getCollectionData(req, res, params),
  'POST /api/projects/:projectId/data/:collection': (req, res, params) => new ProjectsManagerAPI().addToCollection(req, res, params),
  'GET /api/projects/scan': (req, res) => new ProjectsManagerAPI().scanDiskForProjects(req, res)
};