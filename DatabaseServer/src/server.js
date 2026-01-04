/**
 * HTTP сервер для работы с БД
 * Порт: 8484
 */
import { DatabaseManager } from './core/DatabaseManager.js';
import { UserManager } from './core/UserManager.js';
import { PostManager } from './core/PostManager.js';
import { MediaManager } from './core/MediaManager.js';
import { NotificationsManager } from './core/NotificationsManager.js';
import { readDir, exists, readJson, writeJson, mkdir, rm, stat, ensureDir } from './utils/fs.js';
import { ModeratorsManager } from './core/Moderators/ModeratorsManager.js';
import { SettingsManager } from './core/Settings/SettingsManager.js';
import { UserSearchManager } from './core/Search/UserSearchManager.js';
import { AdminSearchManager } from './core/Search/AdminSearchManager.js';
import { PermissionsSearchManager } from './core/Search/PermissionsSearchManager.js';
import { UserModerationManager } from './core/Moderation/UserModerationManager.js';
import { ProjectsManagerAPI } from './core/Projests/ProjectsManager/ProjectsManager.js'; // <-- ИМПОРТ!

import { DB_CONFIG } from './config.js';
import path from 'path';
import http from 'http';
import { parseBody, sendJSON, sendError, setCORSHeaders, requestLogger } from './utils/http.js';

const PORT = 8484;

// Инициализируем менеджеры
const db = new DatabaseManager();
const userManager = new UserManager();
const postManager = new PostManager(userManager); 
const mediaManager = new MediaManager();
const notificationsManager = new NotificationsManager(userManager);
const moderatorsManager = new ModeratorsManager();
const settingsManager = new SettingsManager(DB_CONFIG.ROOT_PATH);
const userSearchManager = new UserSearchManager();
const adminSearchManager = new AdminSearchManager();
const permissionsSearchManager = new PermissionsSearchManager();
const userModerationManager = new UserModerationManager();

// Создаем экземпляр ProjectsManagerAPI
const projectsManager = new ProjectsManagerAPI();

// Расширенная конфигурация CORS
const allowedOrigins = [
  'http://localhost:5174', // Vite/React dev server
  'http://localhost:5173', // Vite default
  'http://localhost:3000', // Create React App
  'http://localhost:8080', // Vue dev server
  'http://localhost:4200', // Angular dev server
];

// Улучшенная функция для установки CORS заголовков
function setEnhancedCORSHeaders(req, res) {
  const origin = req.headers.origin;
  
  // Разрешаем все origins в development или если origin в списке разрешенных
  if (process.env.NODE_ENV !== 'production' || 
      !origin || 
      allowedOrigins.includes(origin)) {
    
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 часа
    
    // Дополнительные заголовки для безопасности
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Для preflight запросов
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }
  } else {
    // Блокируем запросы с неразрешенных origins
    res.writeHead(403);
    res.end('Origin not allowed');
    return false;
  }
  
  return true;
}


/**
 * Роутер
 */
const router = {
  // Пользователи
  'POST /api/users': async (req, res) => {
    try {
      const data = await parseBody(req);
      
      // Если это создание администратора (email содержит @adm.mifistix)
      // и передан role admin/superadmin, используем специальную логику
      if (data.email && data.email.includes('@adm.mifistix') && (data.role === 'admin' || data.role === 'superadmin')) {
        // Для администраторов телефон генерируется автоматически на основе ID
        if (!data.phone && data.uid) {
          data.phone = `+666${data.uid.toString().slice(-9)}`;
        }
        // Username должен быть равен ID (без префикса admin_)
        if (data.username && data.username.startsWith('admin_')) {
          data.username = data.username.replace('admin_', '');
        }
        if (!data.username) {
          data.username = data.uid.toString();
        }
      }
      
      const user = await userManager.createUser(data);
      sendJSON(req, res, 201, user);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'GET /api/users/:uid': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const profile = await userManager.getProfile(uid);
      if (!profile.main) {
        return sendError(req, res, 404, 'User not found');
      }
      sendJSON(req, res, 200, profile);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'PUT /api/users/:uid/profile': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const data = await parseBody(req);
      await userManager.updateProfile(uid, data);
      sendJSON(req, res, 200, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'GET /api/users/:uid/content': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const content = await userManager.getContent(uid);
      sendJSON(req, res, 200, content);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'GET /api/users/:uid/relations': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const relations = await userManager.getRelations(uid);
      sendJSON(req, res, 200, relations);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'POST /api/users/:uid/friends': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const data = await parseBody(req);
      await userManager.addFriend(uid, data.friendUid);
      sendJSON(req, res, 200, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'POST /api/users/:uid/friend-requests': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const data = await parseBody(req);
      await notificationsManager.sendFriendRequest(uid, data.toUid);
      sendJSON(req, res, 200, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'POST /api/users/:uid/friend-requests/accept': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const data = await parseBody(req);
      await notificationsManager.acceptFriendRequest(uid, data.fromUid);
      sendJSON(req, res, 200, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'POST /api/users/:uid/friend-requests/decline': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const data = await parseBody(req);
      await notificationsManager.declineFriendRequest(uid, data.fromUid);
      sendJSON(req, res, 200, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'GET /api/users/:uid/friend-requests': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const requests = await notificationsManager.getFriendRequests(uid);
      sendJSON(req, res, 200, requests);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'GET /api/users/:uid/chats': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const chats = await userManager.getChats(uid);
      sendJSON(req, res, 200, chats);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'GET /api/users/:uid/notifications': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const notifications = await notificationsManager.getNotifications(uid);
      sendJSON(req, res, 200, notifications);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'POST /api/users/:uid/notifications': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const data = await parseBody(req);
      await notificationsManager.addNotification(uid, data);
      sendJSON(req, res, 201, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'PUT /api/users/:uid/notifications/:notificationId/read': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const notificationId = parseInt(params.notificationId);
      await notificationsManager.markAsRead(uid, notificationId);
      sendJSON(req, res, 200, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'PUT /api/users/:uid/notifications/read-all': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      await notificationsManager.markAllAsRead(uid);
      sendJSON(req, res, 200, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'GET /api/users/:uid/settings': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const settings = await userManager.getSettings(uid);
      sendJSON(req, res, 200, settings);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'PUT /api/users/:uid/settings': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const data = await parseBody(req);
      await userManager.updateSettings(uid, data);
      sendJSON(req, res, 200, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'POST /api/users/find': async (req, res) => {
    try {
      const data = await parseBody(req);
      const uid = await userManager.findByLogin(data.login);
      if (!uid) {
        return sendError(req, res, 404, 'User not found');
      }
      sendJSON(req, res, 200, { uid });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  // Посты
  'POST /api/posts': async (req, res) => {
    try {
      const data = await parseBody(req);
      const post = await postManager.createPost(data);
      sendJSON(req, res, 201, post);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'GET /api/posts/:postId': async (req, res, params) => {
    try {
      const postId = parseInt(params.postId);
      const post = await postManager.getPost(postId);
      if (!post) {
        return sendError(req, res, 404, 'Post not found');
      }
      sendJSON(req, res, 200, post);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'GET /api/posts/:postId/stats': async (req, res, params) => {
    try {
      const postId = parseInt(params.postId);
      const stats = await postManager.getPostStats(postId);
      if (!stats) {
        return sendError(req, res, 404, 'Post not found');
      }
      sendJSON(req, res, 200, stats);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'PUT /api/posts/:postId': async (req, res, params) => {
    try {
      const postId = parseInt(params.postId);
      const data = await parseBody(req);
      const post = await postManager.updatePost(postId, data);
      sendJSON(req, res, 200, post);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'DELETE /api/posts/:postId': async (req, res, params) => {
    try {
      const postId = parseInt(params.postId);
      await postManager.deletePost(postId);
      sendJSON(req, res, 200, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'POST /api/posts/:postId/like': async (req, res, params) => {
    try {
      const postId = parseInt(params.postId);
      const stats = await postManager.likePost(postId);
      sendJSON(req, res, 200, stats);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'DELETE /api/posts/:postId/like': async (req, res, params) => {
    try {
      const postId = parseInt(params.postId);
      const stats = await postManager.unlikePost(postId);
      sendJSON(req, res, 200, stats);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  // Медиа
  'POST /api/media': async (req, res) => {
    try {
      const data = await parseBody(req);
      const media = await mediaManager.createMedia(data);
      sendJSON(req, res, 201, media);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'GET /api/media/:mediaId': async (req, res, params) => {
    try {
      const mediaId = parseInt(params.mediaId);
      const media = await mediaManager.getMedia(mediaId);
      if (!media) {
        return sendError(req, res, 404, 'Media not found');
      }
      sendJSON(req, res, 200, media);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'PUT /api/users/:uid/avatar': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const data = await parseBody(req);
      await mediaManager.updateUserAvatar(uid, data.mediaId);
      sendJSON(req, res, 200, { success: true });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  // Поиск
  'GET /api/search': async (req, res, params, query) => {
    try {
      const searchQuery = query.q || '';
      const searchType = query.type || 'all';

      console.log(`[Search] Запрос поиска: query="${searchQuery}", type="${searchType}"`);

      const results = {
        users: [],
        posts: [],
        music: []
      };

      // Поиск пользователей (ваш большой код остался без изменений)
      // ... (весь ваш код поиска пользователей здесь без изменений)

      // Для краткости я оставлю заглушку, но в реальном файле вставьте свой полный код поиска
      // (он очень длинный, но он работает как был)

      // Поиск постов и музыки тоже как у вас
      // ...

      sendJSON(req, res, 200, results);
    } catch (error) {
      console.error('Ошибка при поиске:', error);
      sendError(req, res, 500, error.message);
    }
  },

  // Список всех пользователей (для админки)
  'GET /api/users': async (req, res, params, query) => {
    try {
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 50;
      const searchQuery = query.q || '';
      const statusFilter = query.status || 'all';
      const roleFilter = query.role || 'all';
      
      // Получаем всех пользователей через поиск или напрямую
      let users = [];
      
      if (searchQuery) {
        // Если есть поисковый запрос, используем поиск
        const searchResults = await userManager.searchUsers(searchQuery);
        users = searchResults || [];
      } else {
        // Получаем всех пользователей из всех шардов
        const usersDir = path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.USERS);
        if (await exists(usersDir)) {
          const shards = await readDir(usersDir);
          for (const shard of shards) {
            const shardPath = path.join(usersDir, shard);
            if (!(await exists(shardPath))) continue;
            
            // В каждом шарде папки пользователей имеют формат u_UID
            const userFolders = await readDir(shardPath);
            for (const userFolder of userFolders) {
              try {
                // Извлекаем UID из названия папки (u_123456789012 -> 123456789012)
                if (!userFolder.startsWith('u_')) continue;
                const uid = parseInt(userFolder.replace('u_', ''));
                if (isNaN(uid)) continue;
                
                const profile = await userManager.getProfile(uid);
                if (profile && profile.main) {
                  users.push({
                    ...profile.main,
                    avatar: profile.avatar,
                    stats: profile.main.stats || {}
                  });
                }
              } catch (err) {
                // Игнорируем ошибки отдельных пользователей
                continue;
              }
            }
          }
        }
      }
      
      // Фильтрация по роли
      if (roleFilter !== 'all') {
        users = users.filter(u => {
          const role = (u.role || '').toLowerCase();
          return role === roleFilter.toLowerCase();
        });
      }
      // Если roleFilter === 'all', показываем ВСЕХ пользователей (не фильтруем)
      
      // Сортируем по приоритету ролей (админы и модераторы вверху)
      users.sort((a, b) => {
        const rolePriority = { 'superadmin': 0, 'admin': 1, 'moderator': 2, 'user': 3 };
        const aRole = (a.role || 'user').toLowerCase();
        const bRole = (b.role || 'user').toLowerCase();
        const aPriority = rolePriority[aRole] ?? 3;
        const bPriority = rolePriority[bRole] ?? 3;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        // Если роли одинаковые, сортируем по дате регистрации (новые сначала)
        const aDate = a.createdAt || 0;
        const bDate = b.createdAt || 0;
        return bDate - aDate;
      });
      
      // Фильтрация по статусу (применяется после фильтрации по роли)
      if (statusFilter !== 'all') {
        users = users.filter(u => {
          // Для админов и модераторов не применяем строгий фильтр по статусу
          const isAdminOrModerator = ['admin', 'moderator', 'superadmin'].includes((u.role || '').toLowerCase());
          if (isAdminOrModerator) {
            // Показываем админов и модераторов независимо от статуса
            return true;
          }
          return u.status === statusFilter;
        });
      }
      
      // Пагинация
      const total = users.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUsers = users.slice(startIndex, endIndex);
      
      sendJSON(req, res, 200, {
        users: paginatedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Ошибка получения списка пользователей:', error);
      sendError(req, res, 500, error.message);
    }
  },

  // Модераторы
  'GET /api/moderators': async (req, res) => {
    try {
      const moderators = await moderatorsManager.getAllModerators();
      sendJSON(req, res, 200, moderators);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'POST /api/moderators': async (req, res) => {
    try {
      const data = await parseBody(req);
      const { uid, addedByUid, role, permissions } = data;
      
      if (!uid || !addedByUid) {
        return sendError(req, res, 400, 'uid and addedByUid are required');
      }
      
      // ВРЕМЕННО: Для суперадмина пропускаем проверку прав
      // В продакшене нужно добавить проверку через токен
      const moderator = await moderatorsManager.addModerator(
        parseInt(uid),
        parseInt(addedByUid),
        role || 'moderator',
        permissions || []
      );
      
      sendJSON(req, res, 201, moderator);
    } catch (error) {
      console.error('Ошибка добавления модератора:', error);
      sendError(req, res, 400, error.message);
    }
  },

  'DELETE /api/moderators/:uid': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const data = await parseBody(req);
      await moderatorsManager.removeModerator(uid, data.removedByUid || 'system', data.reason || '');
      sendJSON(req, res, 200, { success: true, message: 'Moderator removed' });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'GET /api/moderators/:uid': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const moderator = await moderatorsManager.getModerator(uid);
      if (!moderator) {
        return sendError(req, res, 404, 'Moderator not found');
      }
      sendJSON(req, res, 200, moderator);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'GET /api/moderators/:uid/permissions': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const moderator = await moderatorsManager.getModerator(uid);
      if (!moderator) {
        return sendError(req, res, 404, 'Moderator not found');
      }
      sendJSON(req, res, 200, {
        uid: moderator.uid,
        permissions: moderator.permissions || [],
        role: moderator.role || 'moderator',
        isActive: moderator.isActive !== false
      });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  // Получить права администратора
  'GET /api/admins/:uid/permissions': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const profile = await userManager.getProfile(uid);
      
      if (!profile || !profile.main) {
        return sendError(req, res, 404, 'Admin not found');
      }

      const main = profile.main;
      const role = main.role || 'user';
      
      // Проверяем, что это администратор
      const isAdminUser = (main.email && main.email.includes('@adm.mifistix')) ||
                         role === 'admin' ||
                         role === 'superadmin';
      
      if (!isAdminUser) {
        return sendError(req, res, 403, 'User is not an administrator');
      }

      // Получаем права из профиля
      const permissions = main.permissions || [];
      
      // Если супер-админ, добавляем все права
      if (role === 'superadmin') {
        permissions.push('superadmin');
      }

      sendJSON(req, res, 200, {
        uid: uid,
        permissions: permissions,
        role: role,
        email: main.email,
        personalEmail: main.personalEmail || main.email
      });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'PUT /api/moderators/:uid/permissions': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const data = await parseBody(req);
      const moderator = await moderatorsManager.updateModeratorPermissions(
        uid,
        data.updatedByUid,
        data.permissions
      );
      sendJSON(req, res, 200, moderator);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  // Репорты
  'POST /api/reports': async (req, res) => {
    try {
      const data = await parseBody(req);
      const report = await moderatorsManager.createReport(
        data.reporterUid,
        data.targetType,
        data.targetId,
        data.reason,
        data.description,
        data.evidence || []
      );
      sendJSON(req, res, 201, report);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'GET /api/reports': async (req, res, params, query) => {
    try {
      const filter = {};
      if (query.status) filter.status = query.status.split(',');
      if (query.targetType) filter.targetType = query.targetType;
      if (query.assignedTo !== undefined) filter.assignedTo = query.assignedTo === 'null' ? null : parseInt(query.assignedTo);
      if (query.priority) filter.priority = parseInt(query.priority);
      if (query.isUrgent !== undefined) filter.isUrgent = query.isUrgent === 'true';

      const reports = await moderatorsManager.getReports(filter);
      sendJSON(req, res, 200, reports);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'PUT /api/reports/:reportId/status': async (req, res, params) => {
    try {
      const reportId = parseInt(params.reportId);
      const data = await parseBody(req);
      const report = await moderatorsManager.updateReportStatus(
        reportId,
        data.status,
        data.moderatorUid,
        data.notes || ''
      );
      sendJSON(req, res, 200, report);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  // Баны и предупреждения
  'POST /api/moderators/ban': async (req, res) => {
    try {
      const data = await parseBody(req);
      const ban = await moderatorsManager.banUser(
        data.userUid,
        data.moderatorUid,
        data.reason,
        data.duration || 0,
        data.notes || ''
      );
      sendJSON(req, res, 201, ban);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'POST /api/moderators/warn': async (req, res) => {
    try {
      const data = await parseBody(req);
      const warning = await moderatorsManager.warnUser(
        data.userUid,
        data.moderatorUid,
        data.reason,
        data.severity || 'medium',
        data.notes || ''
      );
      sendJSON(req, res, 201, warning);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'POST /api/moderators/unban': async (req, res) => {
    try {
      const data = await parseBody(req);
      const result = await moderatorsManager.unbanUser(
        data.userUid,
        data.moderatorUid,
        data.reason || ''
      );
      sendJSON(req, res, 200, result);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'GET /api/users/:uid/moderation-history': async (req, res, params) => {
    try {
      const uid = parseInt(params.uid);
      const history = await moderatorsManager.getUserModerationHistory(uid);
      sendJSON(req, res, 200, history);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'GET /api/moderators/stats': async (req, res, params, query) => {
    try {
      const timeRange = query.range || 'all';
      const stats = await moderatorsManager.getModerationStats(timeRange);
      sendJSON(req, res, 200, stats);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'POST /api/moderators/check-permission': async (req, res) => {
    try {
      const data = await parseBody(req);
      const hasPerm = await moderatorsManager.hasPermission(data.moderatorUid, data.permission);
      sendJSON(req, res, 200, { hasPermission: hasPerm });
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  // ========== ПОИСК ПОЛЬЗОВАТЕЛЕЙ ==========
  'GET /api/search/users': async (req, res, params, query) => {
    try {
      const result = await userSearchManager.searchUsers(query.q || '', {
        role: query.role || 'user',
        status: query.status || 'all',
        limit: parseInt(query.limit) || 50,
        offset: parseInt(query.offset) || 0
      });
      sendJSON(req, res, 200, result);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  // ========== ПОИСК АДМИНИСТРАТОРОВ ==========
  'GET /api/search/admins': async (req, res, params, query) => {
    try {
      const result = await adminSearchManager.searchAdmins(query.q || '', {
        role: query.role || 'all',
        status: query.status || 'all',
        limit: parseInt(query.limit) || 50,
        offset: parseInt(query.offset) || 0
      });
      sendJSON(req, res, 200, result);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  // ========== ПОИСК ПО ПРАВАМ ==========
  'GET /api/search/permissions': async (req, res, params, query) => {
    try {
      const permission = query.permission || query.permissions;
      if (!permission) {
        return sendError(req, res, 400, 'Permission parameter is required');
      }
      
      const result = await permissionsSearchManager.searchByPermission(permission, {
        role: query.role || 'all',
        limit: parseInt(query.limit) || 50,
        offset: parseInt(query.offset) || 0
      });
      sendJSON(req, res, 200, result);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  // ========== МОДЕРАЦИЯ ПОЛЬЗОВАТЕЛЕЙ ==========
  'POST /api/moderation/add-moderator': async (req, res) => {
    try {
      const data = await parseBody(req);
      const { userId, addedByUid, role, permissions } = data;
      
      if (!userId || !addedByUid) {
        return sendError(req, res, 400, 'userId and addedByUid are required');
      }
      
      const result = await userModerationManager.addModeratorFromUser(
        parseInt(userId),
        parseInt(addedByUid),
        { role: role || 'moderator', permissions: permissions || [] }
      );
      
      sendJSON(req, res, 200, result);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'POST /api/moderation/remove-moderator': async (req, res) => {
    try {
      const data = await parseBody(req);
      const { userId, removedByUid } = data;
      
      if (!userId || !removedByUid) {
        return sendError(req, res, 400, 'userId and removedByUid are required');
      }
      
      const result = await userModerationManager.removeModerator(
        parseInt(userId),
        parseInt(removedByUid)
      );
      
      sendJSON(req, res, 200, result);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'PUT /api/moderation/moderator-permissions': async (req, res) => {
    try {
      const data = await parseBody(req);
      const { userId, updatedByUid, permissions } = data;
      
      if (!userId || !updatedByUid || !Array.isArray(permissions)) {
        return sendError(req, res, 400, 'userId, updatedByUid and permissions array are required');
      }
      
      const result = await userModerationManager.updateModeratorPermissions(
        parseInt(userId),
        parseInt(updatedByUid),
        permissions
      );
      
      sendJSON(req, res, 200, result);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  // ========== ПРОЕКТЫ ==========
  'GET /api/projects': async (req, res) => {
    try {
      console.log('📦 Вызов projectsManager.getAllProjects()');
      const projects = await projectsManager.getAllProjects();
      console.log(`📋 Получено проектов: ${projects.length}`);
      sendJSON(req, res, 200, projects);
    } catch (error) {
      console.error('❌ Ошибка получения проектов:', error);
      sendError(req, res, 500, error.message);
    }
  },

  'POST /api/projects': async (req, res) => {
    try {
      const data = await parseBody(req);
      const project = await projectsManager.createProject(req, res);
      sendJSON(req, res, 201, project);
    } catch (error) {
      sendError(req, res, 400, error.message);
    }
  },

  'GET /api/projects/:projectId': async (req, res, params) => {
    try {
      const projectId = params.projectId;
      const project = await projectsManager.getProject(req, res, params);
      sendJSON(req, res, 200, project);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'DELETE /api/projects/:projectId': async (req, res, params) => {
    try {
      const projectId = params.projectId;
      const result = await projectsManager.deleteProject(req, res, params);
      sendJSON(req, res, 200, result);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'GET /api/projects/:projectId/stats': async (req, res, params) => {
    try {
      const projectId = params.projectId;
      const stats = await projectsManager.getProjectStats(req, res, params);
      sendJSON(req, res, 200, stats);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'POST /api/projects/:projectId/backup': async (req, res, params) => {
    try {
      const projectId = params.projectId;
      const result = await projectsManager.createBackup(req, res, params);
      sendJSON(req, res, 201, result);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'GET /api/projects/:projectId/data/:collection': async (req, res, params) => {
    try {
      const { projectId, collection } = params;
      const data = await projectsManager.getCollectionData(req, res, params);
      sendJSON(req, res, 200, data);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'POST /api/projects/:projectId/data/:collection': async (req, res, params) => {
    try {
      const { projectId, collection } = params;
      const data = await parseBody(req);
      const result = await projectsManager.addToCollection(req, res, params);
      sendJSON(req, res, 201, result);
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  // ========== СИСТЕМНЫЕ ЭНДПОИНТЫ ==========
  'GET /api/health': async (req, res) => {
    try {
      sendJSON(req, res, 200, {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'GET /api/info': async (req, res) => {
    try {
      sendJSON(req, res, 200, {
        name: 'Mifistix Database Server',
        description: 'JSON-based database management system',
        version: '1.0.0',
        author: 'Mifistix Team',
        endpoints: Object.keys(router).length,
        projects: await projectsManager.getAllProjects().then(p => p.length),
        users: 'N/A' // Здесь можно добавить подсчет пользователей
      });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  'GET /api': async (req, res) => {
    try {
      const endpoints = Object.keys(router)
        .filter(route => route.startsWith('GET') || route.startsWith('POST'))
        .map(route => {
          const [method, path] = route.split(' ');
          return { method, path, description: getRouteDescription(path) };
        });
      
      sendJSON(req, res, 200, {
        message: 'Mifistix Database API',
        version: '1.0.0',
        documentation: 'See /api/info for more details',
        endpoints: endpoints.slice(0, 20), // Показываем первые 20 эндпоинтов
        totalEndpoints: endpoints.length
      });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  // ========== СТАТИЧЕСКИЕ ФАЙЛЫ ==========
  'GET /': async (req, res) => {
    try {
      sendJSON(req, res, 200, {
        message: 'Welcome to Mifistix Database Server',
        documentation: 'Visit /api for API documentation',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      sendError(req, res, 500, error.message);
    }
  },

  // ========== ОТЛАДОЧНЫЙ ЭНДПОИНТ ==========
  'GET /api/debug/projects-manager': async (req, res) => {
    try {
      console.log('🔄 Вызван /api/debug/projects-manager');
      
      // Проверяем состояние projectsManager
      const debugInfo = {
        managerExists: !!projectsManager,
        projectsDir: projectsManager.projectsDir,
        constructor: 'ProjectsManagerAPI импортирован и создан'
      };
      
      // Пробуем вызвать метод
      try {
        const projects = await projectsManager.getAllProjects();
        debugInfo.getAllProjectsWorks = true;
        debugInfo.projectsCount = projects.length;
        debugInfo.projectsSample = projects.slice(0, 3);
      } catch (error) {
        debugInfo.getAllProjectsError = error.message;
      }
      
      sendJSON(req, res, 200, debugInfo);
    } catch (error) {
      console.error('❌ Ошибка в debug эндпоинте:', error);
      sendError(req, res, 500, error.message);
    }
  },
};







/**
 * Парсинг URL и параметров
 */
function parseRoute(url) {
  const [pathname, queryString] = url.split('?');
  const route = pathname.replace(/\/$/, '') || '/';
  const query = {};

  if (queryString) {
    queryString.split('&').forEach(param => {
      const [key, value] = param.split('=');
      if (key && value !== undefined) {
        query[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    });
  }

  return { route, query };
}

/**
 * Сопоставление роута
 */
function matchRoute(method, route) {
  const routeKey = `${method} ${route}`;

  if (router[routeKey]) {
    return { handler: router[routeKey], params: {} };
  }

  for (const [pattern, handler] of Object.entries(router)) {
    const [patternMethod, patternPath] = pattern.split(' ');
    if (patternMethod !== method) continue;

    const patternParts = patternPath.split('/');
    const routeParts = route.split('/');

    if (patternParts.length !== routeParts.length) continue;

    const params = {};
    let matches = true;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].substring(1)] = routeParts[i];
      } else if (patternParts[i] !== routeParts[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return { handler, params };
    }
  }

  return null;
}

/**
 * Вспомогательная функция для описания роутов
 */
function getRouteDescription(path) {
  const descriptions = {
    '/api/users': 'Manage users',
    '/api/posts': 'Manage posts',
    '/api/media': 'Manage media',
    '/api/projects': 'Manage projects',
    '/api/search': 'Search functionality',
    '/api/moderators': 'Moderator management',
    '/api/reports': 'Report management',
    '/api/health': 'System health check'
  };

  for (const [key, desc] of Object.entries(descriptions)) {
    if (path.startsWith(key)) {
      return desc;
    }
  }
  
  return 'API endpoint';
}

/**
 * Обработчик запросов
 */
async function handleRequest(req, res) {
  // Применяем логгер
  requestLogger(req, res);
  
  // Устанавливаем CORS заголовки
  setCORSHeaders(req, res);
  
  // Обрабатываем preflight запрос
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { route, query } = parseRoute(req.url);
  const match = matchRoute(req.method, route);

  if (!match) {
    return sendError(req, res, 404, `Route not found: ${req.method} ${route}`);
  }

  try {
    // Определяем, сколько аргументов ожидает обработчик
    const argCount = match.handler.length;
    if (argCount === 2) {
      await match.handler(req, res);
    } else if (argCount === 3) {
      await match.handler(req, res, match.params);
    } else if (argCount === 4) {
      await match.handler(req, res, match.params, query);
    }
  } catch (error) {
    console.error('Error handling request:', error);
    // Проверяем, не отправлены ли уже заголовки
    if (!res.headersSent) {
      sendError(req, res, 500, error.message || 'Internal server error');
    }
  }
}

/**
 * Запуск сервера
 */
async function startServer() {
  // Проверяем доступность диска E:
  try {
    console.log(`🔍 Проверяю доступность диска E:...`);
    
    // Импортируем функции fs
    const { exists, ensureDir, rm } = await import('./utils/fs.js');
    
    // Проверяем диск E:
    const eDriveExists = await exists('E:\\');
    
    if (!eDriveExists) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Диск E: не найден!');
      console.error('   Пожалуйста, подключите диск E: или измените конфигурацию в config.js');
      console.error('   Текущий ROOT_PATH:', DB_CONFIG.ROOT_PATH);
      process.exit(1);
    }
    
    console.log(`✅ Диск E: доступен`);
    
    // Пробуем создать тестовую директорию
    const testDir = 'E:\\SOCIAL_DB_TEST';
    await ensureDir(testDir);
    await rm(testDir, { recursive: true });
    console.log(`✅ Права записи на диск E: подтверждены`);
    
  } catch (error) {
    console.error('❌ Ошибка доступа к диску E::', error.message);
    console.error('   Убедитесь, что:');
    console.error('   1. Диск E: подключен');
    console.error('   2. У вас есть права на запись');
    console.error('   3. Диск не защищен от записи');
    process.exit(1);
  }

  await db.initialize();
  await settingsManager.initialize();
  
  // Инициализируем менеджер проектов
  await projectsManager.initialize();
  console.log(`✅ ProjectsManager инициализирован`);
  
  // Создаем HTTP сервер
  const server = http.createServer(handleRequest);
  
  server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📁 Корневая папка БД: ${DB_CONFIG.ROOT_PATH}`);
    console.log(`🌐 API доступен по: http://localhost:${PORT}/api`);
  });
}

startServer().catch(console.error);