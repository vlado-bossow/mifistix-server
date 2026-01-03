const express = require('express');
const router = express.Router();
const { getManagers, getDatabaseStatus } = require('../../../shared/utils/database');
const { NotFoundError } = require('../../../shared/utils/errors');

// Получить всех пользователей (только модераторов и админов)
router.get('/adm/list/users', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers) {
            const dbStatus = getDatabaseStatus();
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        } 
        
        const { userManager, moderatorsManager } = managers;
        const fs = require('fs').promises;
        const path = require('path');
        const { DB_CONFIG } = require('../../../DatabaseServer/src/config');
        
        // Получаем пути к пользователям и админам из конфигурации БД
        const usersPath = DB_CONFIG.ROOT_PATH ? path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.USERS) : process.env.USERS_PATH || path.join(__dirname, '../../../database/users');
        const adminsPath = DB_CONFIG.ROOT_PATH ? path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.ADMINS) : process.env.ADMINS_PATH || path.join(__dirname, '../../../database/admins');
        console.log(`[GET /adm/list/users] Поиск в users: ${usersPath}, admins: ${adminsPath}`);
        
        const allUsers = [];
        
        // Получаем параметры фильтрации
        const roleFilter = req.query.role || 'all'; // all, user, admin, superadmin, moderator
        const statusFilter = req.query.status || 'all'; // all, active, suspended
        
        // Сначала получаем всех модераторов (если нужны)
        if (roleFilter === 'all' || roleFilter === 'moderator') {
            if (moderatorsManager) {
                try {
                    const moderators = await moderatorsManager.getAllModerators(true); // включая неактивных
                    console.log(`[GET /adm/list/users] Найдено модераторов: ${moderators.length}`);
                    
                    for (const moderator of moderators) {
                        try {
                            const profile = await userManager.getProfile(moderator.uid);
                            if (profile && profile.main) {
                                allUsers.push({
                                    ...profile.main,
                                    avatar: profile.avatar,
                                    stats: profile.main.stats || {},
                                    moderatorRole: moderator.role,
                                    moderatorPermissions: moderator.permissions || [],
                                    isModerator: true,
                                    addedBy: moderator.addedBy,
                                    addedAt: moderator.addedAt
                                });
                            }
                        } catch (err) {
                            console.error(`[GET /adm/list/users] Ошибка получения профиля модератора ${moderator.uid}:`, err.message);
                            continue;
                        }
                    }
                } catch (err) {
                    console.error('[GET /adm/list/users] Ошибка получения модераторов:', err.message);
                }
            }
        }
        
        // Функция для поиска пользователей/админов в директории
        async function findUsersInPath(basePath, isAdminPath = false) {
            const userDirs = [];
            
            async function scan(currentPath, depth = 0) {
                if (depth > 5) return; // Ограничиваем глубину
                
                try {
                    const items = await fs.readdir(currentPath, { withFileTypes: true });
                    
                    for (const item of items) {
                        if (item.isDirectory()) {
                            const itemPath = path.join(currentPath, item.name);
                            
                            // Если папка начинается с 'u_' - это пользователь/админ
                            if (item.name.startsWith('u_')) {
                                userDirs.push({
                                    path: itemPath,
                                    name: item.name,
                                    isAdmin: isAdminPath
                                });
                            } else {
                                // Рекурсивно ищем в подпапках
                                await scan(itemPath, depth + 1);
                            }
                        }
                    }
                } catch (error) {
                    // Игнорируем ошибки доступа
                    if (error.code !== 'ENOENT') {
                        console.error(`Ошибка сканирования ${currentPath}:`, error.message);
                    }
                }
            }
            
            try {
                await scan(basePath);
            } catch (error) {
                // Если директория не существует, просто возвращаем пустой массив
                if (error.code === 'ENOENT') {
                    console.log(`[GET /adm/list/users] Директория ${basePath} не существует, пропускаем`);
                }
            }
            return userDirs;
        }
        
        // Ищем админов в отдельной папке admins/
        if (roleFilter === 'all' || roleFilter === 'admin' || roleFilter === 'superadmin') {
            try {
                const adminDirs = await findUsersInPath(adminsPath, true);
                console.log(`[GET /adm/list/users] Найдено папок админов: ${adminDirs.length}`);
                
                for (const adminDir of adminDirs.slice(0, 1000)) {
                    try {
                        const dirName = adminDir.name;
                        let uidStr = dirName;
                        if (dirName.startsWith('u_')) {
                            uidStr = dirName.substring(2);
                        }
                        
                        const uid = parseInt(uidStr);
                        if (isNaN(uid)) continue;
                        
                        // Пропускаем, если уже добавлен как модератор
                        if (allUsers.some(u => u.uid === uid)) continue;
                        
                        const profile = await userManager.getProfile(uid);
                        
                        if (profile && profile.main) {
                            const role = (profile.main.role || 'admin').toLowerCase();
                            
                            // Фильтруем по роли
                            if (roleFilter === 'admin' && role !== 'admin') continue;
                            if (roleFilter === 'superadmin' && role !== 'superadmin') continue;
                            
                            // Фильтруем по статусу
                            if (statusFilter !== 'all') {
                                const status = (profile.main.status || 'active').toLowerCase();
                                if (statusFilter === 'active' && status !== 'active') continue;
                                if (statusFilter === 'suspended' && status !== 'suspended') continue;
                            }
                            
                            const userData = {
                                id: uid,
                                uid: uid,
                                username: profile.main.username,
                                firstName: profile.main.firstName,
                                lastName: profile.main.lastName,
                                phone: profile.main.phone,
                                name: `${profile.main.firstName || ''} ${profile.main.lastName || ''}`.trim() || profile.main.username,
                                avatar: profile.avatar?.mediaId || null,
                                bio: profile.main.bio || null,
                                email: profile.main.email || '',
                                role: role,
                                age: profile.main.age || null,
                                createdAt: profile.main.createdAt || null,
                                status: profile.main.status || 'active',
                                stats: profile.main.stats || {
                                    posts: 0,
                                    friends: 0,
                                    groups: 0,
                                    rating: 0,
                                    warnings: 0,
                                    reports: 0
                                },
                                isModerator: false,
                                isAdmin: true,
                                permissions: profile.main.permissions || []
                            };
                            
                            allUsers.push(userData);
                        }
                    } catch (error) {
                        continue;
                    }
                }
            } catch (error) {
                console.error(`[GET /adm/list/users] Ошибка доступа к ${adminsPath}:`, error.message);
            }
        }
        
        // Ищем обычных пользователей в папке users/ (только если не запрашиваем только админов)
        if (roleFilter === 'all' || roleFilter === 'user') {
            try {
                const userDirs = await findUsersInPath(usersPath, false);
                console.log(`[GET /adm/list/users] Найдено папок пользователей: ${userDirs.length}`);
                
                for (const userDir of userDirs.slice(0, 1000)) {
                    try {
                        const dirName = userDir.name;
                        let uidStr = dirName;
                        if (dirName.startsWith('u_')) {
                            uidStr = dirName.substring(2);
                        }
                        
                        const uid = parseInt(uidStr);
                        if (isNaN(uid)) continue;
                        
                        // Пропускаем, если уже добавлен как модератор или админ
                        if (allUsers.some(u => u.uid === uid)) continue;
                        
                        const profile = await userManager.getProfile(uid);
                        
                        if (profile && profile.main) {
                            const role = (profile.main.role || 'user').toLowerCase();
                            
                            // Пропускаем админов (они должны быть в папке admins/)
                            if (role === 'admin' || role === 'superadmin' || 
                                (profile.main.email && profile.main.email.includes('@adm.mifistix'))) {
                                continue;
                            }
                            
                            // Фильтруем по статусу
                            if (statusFilter !== 'all') {
                                const status = (profile.main.status || 'active').toLowerCase();
                                if (statusFilter === 'active' && status !== 'active') continue;
                                if (statusFilter === 'suspended' && status !== 'suspended') continue;
                            }
                            
                            const userData = {
                                id: uid,
                                uid: uid,
                                username: profile.main.username,
                                firstName: profile.main.firstName,
                                lastName: profile.main.lastName,
                                phone: profile.main.phone,
                                name: `${profile.main.firstName || ''} ${profile.main.lastName || ''}`.trim() || profile.main.username,
                                avatar: profile.avatar?.mediaId || null,
                                bio: profile.main.bio || null,
                                email: profile.main.email || '',
                                role: role,
                                age: profile.main.age || null,
                                createdAt: profile.main.createdAt || null,
                                status: profile.main.status || 'active',
                                stats: profile.main.stats || {
                                    posts: 0,
                                    friends: 0,
                                    groups: 0,
                                    rating: 0,
                                    warnings: 0,
                                    reports: 0
                                },
                                isModerator: false,
                                isAdmin: false
                            };
                            
                            allUsers.push(userData);
                        }
                    } catch (error) {
                        continue;
                    }
                }
            } catch (error) {
                console.error(`[GET /adm/list/users] Ошибка доступа к ${usersPath}:`, error.message);
            }
        }
        
        // Сортируем по роли (superadmin, admin, moderator, user), затем по ID
        allUsers.sort((a, b) => {
            const rolePriority = { 'superadmin': 0, 'admin': 1, 'moderator': 2, 'user': 3 };
            const aRole = (a.role || 'user').toLowerCase();
            const bRole = (b.role || 'user').toLowerCase();
            const aPriority = rolePriority[aRole] ?? 3;
            const bPriority = rolePriority[bRole] ?? 3;
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return (b.id || 0) - (a.id || 0); // Новые сначала
        });
        
        // Пагинация
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        const paginatedUsers = allUsers.slice(skip, skip + limit);
        
        res.json({
            success: true,
            data: {
                users: paginatedUsers,
                pagination: {
                    total: allUsers.length,
                    page: page,
                    limit: limit,
                    totalPages: Math.ceil(allUsers.length / limit),
                    hasNextPage: skip + limit < allUsers.length,
                    hasPrevPage: page > 1
                },
                count: paginatedUsers.length,
                message: allUsers.length === 0 ? 'No users found' : `Found ${allUsers.length} users`
            }
        });
        
    } catch (error) {
        console.error('[GET /users] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Получить данные MI Fire пользователя
router.get('/users/:uid/mi-fire', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid } = req.params;
        const userId = parseInt(uid);
        
        const { userManager } = managers;
        const miFireData = await userManager.getMIFireData(userId);
        
        res.json({
            success: true,
            data: miFireData,
        });
    } catch (error) {
        console.error('[GET /users/:uid/mi-fire] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Обновить счетчик MI Fire
router.patch('/users/:uid/mi-fire/count', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid } = req.params;
        const userId = parseInt(uid);
        const updates = req.body;
        
        const { userManager } = managers;
        const result = await userManager.updateCount(userId, updates);
        
        if (result.success) {
            res.json({
                success: true,
                data: result,
            });
        } else {
            res.status(400).json({
                success: false,
                error: {
                    message: result.error || 'Failed to update count',
                    code: 'UPDATE_FAILED'
                }
            });
        }
    } catch (error) {
        console.error('[PATCH /users/:uid/mi-fire/count] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Добавить платеж
router.post('/users/:uid/mi-fire/payments', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid } = req.params;
        const userId = parseInt(uid);
        const paymentData = req.body;
        
        const { userManager } = managers;
        const result = await userManager.addPayment(userId, paymentData);
        
        if (result.success) {
            res.status(201).json({
                success: true,
                data: result,
            });
        } else {
            res.status(400).json({
                success: false,
                error: {
                    message: result.error || 'Failed to add payment',
                    code: 'PAYMENT_FAILED'
                }
            });
        }
    } catch (error) {
        console.error('[POST /users/:uid/mi-fire/payments] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Получить профиль пользователя
router.get('/users/:uid', async (req, res) => {
    try {
        const managers = await getManagers();
        
        // Если БД недоступна, возвращаем ошибку
        if (!managers) {
            const dbStatus = getDatabaseStatus();
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                    canWorkWithoutDB: true,
                    details: dbStatus.error,
                },
            });
        }
        
        const { uid } = req.params;
        const userId = parseInt(uid);
        
        const { userManager } = managers;
        const profile = await userManager.getProfile(userId);
        
        if (!profile.main) {
            throw new NotFoundError('User');
        }
        
        res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code,
                },
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR',
            },
        });
    }
});

// Получить посты пользователя
router.get('/users/:uid/posts', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers) {
            const dbStatus = getDatabaseStatus();
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid } = req.params;
        const userId = parseInt(uid);
        
        const { userManager } = managers;
        const content = await userManager.getContent(userId);
        
        res.json({
            success: true,
            data: { posts: content.posts || [] },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR',
            },
        });
    }
});

// Получить пост
router.get('/posts/:postId', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers) {
            const dbStatus = getDatabaseStatus();
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { postId } = req.params;
        const id = parseInt(postId);
        
        const { postManager } = managers;
        const post = await postManager.getPost(id);
        
        if (!post) {
            throw new NotFoundError('Post');
        }
        
        res.json({
            success: true,
            data: post,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code,
                },
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR',
            },
        });
    }
});

// Получить статистику поста
router.get('/posts/:postId/stats', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers) {
            const dbStatus = getDatabaseStatus();
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { postId } = req.params;
        const id = parseInt(postId);
        
        const { postManager } = managers;
        const stats = await postManager.getPostStats(id);
        
        if (!stats) {
            throw new NotFoundError('Post');
        }
        
        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code,
                },
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR',
            },
        });
    }
});

// ==================== МОДЕРАТОРЫ ====================

// Получить всех модераторов
router.get('/moderators', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { moderatorsManager } = managers;
        const includeInactive = req.query.includeInactive === 'true';
        const moderators = await moderatorsManager.getAllModerators(includeInactive);
        
        res.json({
            success: true,
            data: moderators,
        });
    } catch (error) {
        console.error('[GET /moderators] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Получить модератора по UID
router.get('/moderators/:uid', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid } = req.params;
        const moderatorUid = parseInt(uid);
        const { moderatorsManager } = managers;
        const moderator = await moderatorsManager.getModerator(moderatorUid);
        
        if (!moderator) {
            throw new NotFoundError('Moderator');
        }
        
        res.json({
            success: true,
            data: moderator,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code,
                },
            });
        }
        
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR',
            },
        });
    }
});

// Добавить модератора
router.post('/moderators', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid, addedByUid, role, permissions } = req.body;
        
        if (!uid || !addedByUid) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'uid and addedByUid are required',
                    code: 'VALIDATION_ERROR',
                },
            });
        }
        
        // Проверяем права на управление модераторами
        const { moderatorsManager } = managers;
        const canManage = await moderatorsManager.hasPermission(
            parseInt(addedByUid),
            'manage_moderators'
        );
        
        if (!canManage) {
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Permission denied. You do not have permission to manage moderators.',
                    code: 'PERMISSION_DENIED',
                },
            });
        }
        
        const moderator = await moderatorsManager.addModerator(
            parseInt(uid),
            parseInt(addedByUid),
            role || 'moderator',
            permissions || []
        );
        
        res.status(201).json({
            success: true,
            data: moderator,
        });
    } catch (error) {
        console.error('[POST /moderators] Error:', error);
        res.status(400).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Удалить модератора
router.delete('/moderators/:uid', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid } = req.params;
        const { removedByUid, reason } = req.body;
        
        if (!removedByUid) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'removedByUid is required',
                    code: 'VALIDATION_ERROR',
                },
            });
        }
        
        const { moderatorsManager } = managers;
        const result = await moderatorsManager.removeModerator(
            parseInt(uid),
            parseInt(removedByUid),
            reason || ''
        );
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[DELETE /moderators/:uid] Error:', error);
        res.status(400).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Обновить права модератора
router.put('/moderators/:uid/permissions', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid } = req.params;
        const { updatedByUid, permissions } = req.body;
        
        if (!updatedByUid || !permissions) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'updatedByUid and permissions are required',
                    code: 'VALIDATION_ERROR',
                },
            });
        }
        
        const { moderatorsManager } = managers;
        const moderator = await moderatorsManager.updateModeratorPermissions(
            parseInt(uid),
            parseInt(updatedByUid),
            permissions
        );
        
        res.json({
            success: true,
            data: moderator,
        });
    } catch (error) {
        console.error('[PUT /moderators/:uid/permissions] Error:', error);
        res.status(400).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Получить репорты
router.get('/reports', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.targetType) filter.targetType = req.query.targetType;
        if (req.query.assignedTo !== undefined) {
            filter.assignedTo = req.query.assignedTo === 'null' ? null : parseInt(req.query.assignedTo);
        }
        if (req.query.priority) filter.priority = parseInt(req.query.priority);
        if (req.query.isUrgent !== undefined) {
            filter.isUrgent = req.query.isUrgent === 'true';
        }
        
        const { moderatorsManager } = managers;
        const reports = await moderatorsManager.getReports(filter);
        
        res.json({
            success: true,
            data: reports,
        });
    } catch (error) {
        console.error('[GET /reports] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Создать репорт
router.post('/reports', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { reporterUid, targetType, targetId, reason, description, evidence } = req.body;
        
        if (!reporterUid || !targetType || !targetId || !reason) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'reporterUid, targetType, targetId, and reason are required',
                    code: 'VALIDATION_ERROR',
                },
            });
        }
        
        const { moderatorsManager } = managers;
        const report = await moderatorsManager.createReport(
            parseInt(reporterUid),
            targetType,
            parseInt(targetId),
            reason,
            description || '',
            evidence || []
        );
        
        res.status(201).json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error('[POST /reports] Error:', error);
        res.status(400).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Обновить статус репорта
router.put('/reports/:reportId/status', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { reportId } = req.params;
        const { status, moderatorUid, notes } = req.body;
        
        if (!status || !moderatorUid) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'status and moderatorUid are required',
                    code: 'VALIDATION_ERROR',
                },
            });
        }
        
        const { moderatorsManager } = managers;
        const report = await moderatorsManager.updateReportStatus(
            parseInt(reportId),
            status,
            parseInt(moderatorUid),
            notes || ''
        );
        
        res.json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error('[PUT /reports/:reportId/status] Error:', error);
        res.status(400).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Забанить пользователя
router.post('/moderators/ban', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { userUid, moderatorUid, reason, duration, notes } = req.body;
        
        if (!userUid || !moderatorUid || !reason) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'userUid, moderatorUid, and reason are required',
                    code: 'VALIDATION_ERROR',
                },
            });
        }
        
        // Проверяем права на выдачу банов
        const { moderatorsManager } = managers;
        const canBan = await moderatorsManager.hasPermission(
            parseInt(moderatorUid),
            'issue_bans'
        );
        
        if (!canBan) {
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Permission denied. You do not have permission to ban users.',
                    code: 'PERMISSION_DENIED',
                },
            });
        }
        
        const ban = await moderatorsManager.banUser(
            parseInt(userUid),
            parseInt(moderatorUid),
            reason,
            duration || 0,
            notes || ''
        );
        
        res.status(201).json({
            success: true,
            data: ban,
        });
    } catch (error) {
        console.error('[POST /moderators/ban] Error:', error);
        res.status(400).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Выдать предупреждение
router.post('/moderators/warn', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { userUid, moderatorUid, reason, severity, notes } = req.body;
        
        if (!userUid || !moderatorUid || !reason) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'userUid, moderatorUid, and reason are required',
                    code: 'VALIDATION_ERROR',
                },
            });
        }
        
        // Проверяем права на выдачу предупреждений
        const { moderatorsManager } = managers;
        const canWarn = await moderatorsManager.hasPermission(
            parseInt(moderatorUid),
            'issue_warnings'
        );
        
        if (!canWarn) {
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Permission denied. You do not have permission to issue warnings.',
                    code: 'PERMISSION_DENIED',
                },
            });
        }
        
        const warning = await moderatorsManager.warnUser(
            parseInt(userUid),
            parseInt(moderatorUid),
            reason,
            severity || 'medium',
            notes || ''
        );
        
        res.status(201).json({
            success: true,
            data: warning,
        });
    } catch (error) {
        console.error('[POST /moderators/warn] Error:', error);
        res.status(400).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Разбанить пользователя
router.post('/moderators/unban', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { userUid, moderatorUid, reason } = req.body;
        
        if (!userUid || !moderatorUid) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'userUid and moderatorUid are required',
                    code: 'VALIDATION_ERROR',
                },
            });
        }
        
        // Проверяем права на снятие банов
        const { moderatorsManager } = managers;
        const canUnban = await moderatorsManager.hasPermission(
            parseInt(moderatorUid),
            'unban_users'
        );
        
        if (!canUnban) {
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Permission denied. You do not have permission to unban users.',
                    code: 'PERMISSION_DENIED',
                },
            });
        }
        
        const result = await moderatorsManager.unbanUser(
            parseInt(userUid),
            parseInt(moderatorUid),
            reason || ''
        );
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[POST /moderators/unban] Error:', error);
        res.status(400).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Получить историю модерации пользователя
router.get('/users/:uid/moderation-history', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid } = req.params;
        const { moderatorsManager } = managers;
        const history = await moderatorsManager.getUserModerationHistory(parseInt(uid));
        
        res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        console.error('[GET /users/:uid/moderation-history] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Получить статистику модерации
router.get('/moderators/stats', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const timeRange = req.query.range || 'all';
        const { moderatorsManager } = managers;
        const stats = await moderatorsManager.getModerationStats(timeRange);
        
        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('[GET /moderators/stats] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Проверить разрешение модератора
router.post('/moderators/check-permission', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { moderatorUid, permission } = req.body;
        
        if (!moderatorUid || !permission) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'moderatorUid and permission are required',
                    code: 'VALIDATION_ERROR',
                },
            });
        }
        
        const { moderatorsManager } = managers;
        const hasPermission = await moderatorsManager.hasPermission(
            parseInt(moderatorUid),
            permission
        );
        
        res.json({
            success: true,
            data: { hasPermission },
        });
    } catch (error) {
        console.error('[POST /moderators/check-permission] Error:', error);
        res.status(400).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Получить все разрешения модератора
router.get('/moderators/:uid/permissions', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid } = req.params;
        const { moderatorsManager } = managers;
        const moderator = await moderatorsManager.getModerator(parseInt(uid));
        
        if (!moderator) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Moderator not found',
                    code: 'NOT_FOUND',
                },
            });
        }
        
        res.json({
            success: true,
            data: {
                permissions: moderator.permissions || [],
                role: moderator.role,
                isActive: moderator.isActive
            },
        });
    } catch (error) {
        console.error('[GET /moderators/:uid/permissions] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Получить панель модерации модератора
router.get('/moderators/:uid/moderation-panel', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { uid } = req.params;
        const moderatorUid = parseInt(uid);
        
        // Проверяем права на просмотр панели
        const { moderatorsManager } = managers;
        const currentUserUid = req.query.currentUserUid ? parseInt(req.query.currentUserUid) : moderatorUid;
        
        // Если запрашивает не свою панель, нужны права на просмотр всех панелей
        if (currentUserUid !== moderatorUid) {
            const canViewAll = await moderatorsManager.hasPermission(
                currentUserUid,
                'view_all_moderation_panels'
            );
            if (!canViewAll) {
                return res.status(403).json({
                    success: false,
                    error: {
                        message: 'Permission denied. You can only view your own moderation panel.',
                        code: 'PERMISSION_DENIED',
                    },
                });
            }
        } else {
            // Проверяем право на просмотр своей панели
            const canView = await moderatorsManager.hasPermission(
                moderatorUid,
                'view_moderation_panel'
            );
            if (!canView) {
                return res.status(403).json({
                    success: false,
                    error: {
                        message: 'Permission denied. You do not have permission to view moderation panel.',
                        code: 'PERMISSION_DENIED',
                    },
                });
            }
        }
        
        const options = {
            actionType: req.query.actionType,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            targetUid: req.query.targetUid,
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };
        
        const panel = await moderatorsManager.getModerationPanel(moderatorUid, options);
        
        res.json({
            success: true,
            data: panel,
        });
    } catch (error) {
        console.error('[GET /moderators/:uid/moderation-panel] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

// Middleware для проверки прав модератора
const checkModeratorPermission = async (req, res, next) => {
    try {
        const managers = await getManagers();
        
        if (!managers || !managers.moderatorsManager) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const moderatorUid = req.body.moderatorUid || req.query.moderatorUid || req.params.moderatorUid;
        const requiredPermission = req.permissionRequired;
        
        if (!moderatorUid || !requiredPermission) {
            return next(); // Если нет требований, пропускаем
        }
        
        const { moderatorsManager } = managers;
        const hasPermission = await moderatorsManager.hasPermission(
            parseInt(moderatorUid),
            requiredPermission
        );
        
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: {
                    message: `Permission denied. Required permission: ${requiredPermission}`,
                    code: 'PERMISSION_DENIED',
                },
            });
        }
        
        next();
    } catch (error) {
        console.error('[checkModeratorPermission] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
};

// Получить общую статистику для Dashboard
router.get('/dashboard/stats', async (req, res) => {
    try {
        const managers = await getManagers();
        
        if (!managers) {
            return res.status(503).json({
                success: false,
                error: {
                    message: 'Database is not available',
                    code: 'DATABASE_UNAVAILABLE',
                },
            });
        }
        
        const { userManager, postManager, moderatorsManager } = managers;
        const fs = require('fs').promises;
        const path = require('path');
        
        // Подсчет пользователей
        const usersPath = process.env.USERS_PATH || path.join(__dirname, '../../../database/users');
        let totalUsers = 0;
        let newUsersToday = 0;
        let blockedUsers = 0;
        
        try {
            async function countUsers(currentPath, depth = 0) {
                if (depth > 5) return;
                
                try {
                    const items = await fs.readdir(currentPath, { withFileTypes: true });
                    
                    for (const item of items) {
                        if (item.isDirectory()) {
                            const itemPath = path.join(currentPath, item.name);
                            
                            if (item.name.startsWith('u_')) {
                                const uidStr = item.name.substring(2);
                                const uid = parseInt(uidStr);
                                
                                if (!isNaN(uid)) {
                                    try {
                                        const profile = await userManager.getProfile(uid);
                                        if (profile && profile.main) {
                                            totalUsers++;
                                            
                                            // Проверяем новые регистрации сегодня
                                            if (profile.main.createdAt) {
                                                const createdDate = new Date(profile.main.createdAt * 1000);
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                if (createdDate >= today) {
                                                    newUsersToday++;
                                                }
                                            }
                                            
                                            // Проверяем заблокированных
                                            if (profile.main.isBanned || profile.main.role === 'banned') {
                                                blockedUsers++;
                                            }
                                        }
                                    } catch (err) {
                                        // Пропускаем ошибки
                                    }
                                }
                            } else {
                                await countUsers(itemPath, depth + 1);
                            }
                        }
                    }
                } catch (err) {
                    // Пропускаем ошибки
                }
            }
            
            if (await fs.access(usersPath).then(() => true).catch(() => false)) {
                await countUsers(usersPath);
            }
        } catch (err) {
            console.error('Ошибка подсчета пользователей:', err);
        }
        
        // Подсчет постов (упрощенный - нужно будет добавить метод в PostManager)
        let totalPosts = 0;
        try {
            // TODO: Добавить метод getTotalPosts в PostManager
            // totalPosts = await postManager.getTotalPosts();
        } catch (err) {
            console.error('Ошибка подсчета постов:', err);
        }
        
        // Подсчет сообщений (упрощенный)
        let totalMessages = 0;
        try {
            // TODO: Добавить подсчет сообщений
        } catch (err) {
            console.error('Ошибка подсчета сообщений:', err);
        }
        
        // Активность (процент активных пользователей за последние 24 часа)
        let activeUsers = 0;
        let activityPercent = 0;
        try {
            const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
            // TODO: Добавить метод для подсчета активных пользователей
            if (totalUsers > 0) {
                activityPercent = Math.round((activeUsers / totalUsers) * 100 * 10) / 10;
            }
        } catch (err) {
            console.error('Ошибка подсчета активности:', err);
        }
        
        // Статистика модерации
        let moderationStats = null;
        if (moderatorsManager) {
            try {
                moderationStats = await moderatorsManager.getModerationStats('all');
            } catch (err) {
                console.error('Ошибка получения статистики модерации:', err);
            }
        }
        
        res.json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    newToday: newUsersToday,
                    blocked: blockedUsers,
                    active: activeUsers,
                    activityPercent: activityPercent
                },
                posts: {
                    total: totalPosts
                },
                messages: {
                    total: totalMessages
                },
                moderation: moderationStats
            }
        });
    } catch (error) {
        console.error('[GET /dashboard/stats] Error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
});

module.exports = router;

