const jwt = require('jsonwebtoken');

// Shared модули
const config = require('../../../shared/config');
const logger = require('../../../shared/utils/logger');
const { validateRegister, validateLogin } = require('../../../shared/utils/validator');
const { 
    ValidationError, 
    AuthenticationError, 
    ConflictError,
    asyncHandler 
} = require('../../../shared/utils/errors');

// Используем общую утилиту для работы с БД
const { getUserManager, getDatabaseStatus } = require('../../../shared/utils/database');

// Определение ролей пользователей
const USER_ROLES = {
    USER: 'user',
    MODERATOR: 'moderator',
    ADMIN: 'admin',
    SUPER_ADMIN: 'super_admin'
};

// Статистика по умолчанию для нового пользователя
const DEFAULT_STATS = {
    posts: 0,
    friends: 0,
    groups: 0,
    rating: 0,
    warnings: 0,
    reports: 0,
    joinedAt: null,
    lastActive: null,
    isOnline: false
};

/**
 * Генерация уникального 12-значного numeric UID
 */
const generate12DigitUid = async () => {
    const userManager = await getUserManager();
    
    if (!userManager) {
        throw new Error('Database is not available');
    }

    // Пробуем до тех пор, пока не найдём свободный UID
    while (true) {
        let uidStr = '';
        for (let i = 0; i < 12; i++) {
            uidStr += Math.floor(Math.random() * 10).toString();
        }
        const uid = Number(uidStr);

        const exists = await userManager.exists(uid);
        if (!exists) {
            return uid;
        }
    }
};

// Регистрация
const register = asyncHandler(async (req, res) => {
    const { firstName, lastName, username, password, confirmPassword, phone } = req.body;
    
    // Валидация входных данных
    validateRegister({ firstName, lastName, username, password, confirmPassword, phone });

    const userManager = await getUserManager();
    
    // Если БД недоступна, возвращаем ошибку
    if (!userManager) {
        const dbStatus = getDatabaseStatus();
        throw new Error(`Database is not available: ${dbStatus.error || 'Unknown error'}`);
    }

    // Генерируем 12-значный UID
    const uid = await generate12DigitUid();
    
    // Текущее время
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const createdAt = currentTimestamp;
    const joinedAt = currentTimestamp;

    // Генерируем e-mail вида id@us.mifistix
    const email = `${uid}@us.mifistix`;

    // Генерируем случайный возраст для демонстрации (18-35 лет)
    const age = Math.floor(Math.random() * (35 - 18 + 1)) + 18;

    // Статистика пользователя
    const stats = {
        ...DEFAULT_STATS,
        joinedAt: currentTimestamp,
        lastActive: currentTimestamp,
        isOnline: true
    };

    try {
        // Создание пользователя в DatabaseServer
        const result = await userManager.createUser({
            uid,
            username,
            password,
            firstName,
            lastName,
            age,
            email, // Передаем email для определения роли
            // phone не передаем - система сама генерирует виртуальный номер
        });

        logger.info('User registered', { uid, username, role: result.role });

        // Создание JWT токена
        const token = jwt.sign(
            { 
                userId: uid, 
                username,
                role: result.role || USER_ROLES.USER 
            },
            config.security.jwt.secret,
            { expiresIn: config.security.jwt.expiresIn }
        );

        // Получаем профиль для ответа
        const profile = await userManager.getProfile(uid);
        const main = profile?.main || {};

        return res.status(201).json({
            success: true,
            message: 'Регистрация успешна',
            data: {
                token,
                user: {
                    id: uid,
                    firstName,
                    lastName,
                    username,
                    phone: main.phone || '',
                    email: main.email || email,
                    age,
                    role: result.role || USER_ROLES.USER,
                    createdAt: new Date(createdAt * 1000).toISOString(),
                    stats: {
                        ...stats,
                        joinedAt: new Date(joinedAt * 1000).toISOString(),
                        lastActive: new Date(stats.lastActive * 1000).toISOString()
                    }
                }
            }
        });
    } catch (error) {
        logger.error('Registration error', { error: error.message, username });

        // Обрабатываем ошибки уникальности из DatabaseServer
        if (error.message && error.message.includes('already exists')) {
            throw new ConflictError(error.message);
        }

        throw error;
    }
});

// Авторизация
const login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    // Валидация
    validateLogin({ username, password });
    
    const userManager = await getUserManager();
    
    // Если БД недоступна, возвращаем ошибку
    if (!userManager) {
        const dbStatus = getDatabaseStatus();
        throw new Error(`Database is not available: ${dbStatus.error || 'Unknown error'}`);
    }

    // В качестве login используем то, что приходит в username
    const loginIdentifier = username;

    // Ищем uid по username/email/phone
    const uid = await userManager.findByLogin(loginIdentifier);
    if (!uid) {
        throw new AuthenticationError('Неверное имя пользователя или пароль');
    }

    // Проверяем пароль через DatabaseServer
    const isPasswordValid = await userManager.verifyPassword(uid, password);
    if (!isPasswordValid) {
        throw new AuthenticationError('Неверное имя пользователя или пароль');
    }

    // Получаем профиль для ответа
    const profile = await userManager.getProfile(uid);
    const main = profile?.main || {};
    
    // Получаем статистику
    let stats = DEFAULT_STATS;
    try {
        if (main.stats) {
            stats = typeof main.stats === 'object' ? main.stats : JSON.parse(main.stats);
        }
    } catch (error) {
        logger.warn('Error parsing user stats', { uid, error: error.message });
    }
    
    // Обновляем время последней активности
    const currentTimestamp = Math.floor(Date.now() / 1000);
    stats.lastActive = currentTimestamp;
    stats.isOnline = true;
    
    // Обновляем статистику в базе данных
    try {
        await userManager.updateUserStats(uid, stats);
    } catch (error) {
        logger.error('Error updating user stats', { uid, error: error.message });
    }

    // Создание JWT токена
    const token = jwt.sign(
        { 
            userId: uid, 
            username: main.username,
            role: main.role || USER_ROLES.USER 
        },
        config.security.jwt.secret,
        { expiresIn: config.security.jwt.expiresIn }
    );

    logger.info('User logged in', { uid, username: main.username, role: main.role });

    res.json({
        success: true,
        message: 'Авторизация успешна',
        data: {
            token,
            user: {
                id: uid,
                firstName: main.firstName || '',
                lastName: main.lastName || '',
                username: main.username || loginIdentifier,
                phone: main.phone || '',
                email: main.email || '',
                age: main.age || null,
                role: main.role || USER_ROLES.USER,
                createdAt: main.createdAt ? new Date(main.createdAt * 1000).toISOString() : new Date().toISOString(),
                stats: {
                    posts: stats.posts || 67,
                    friends: stats.friends || 123,
                    groups: stats.groups || 7,
                    rating: stats.rating || 4.5,
                    warnings: stats.warnings || 0,
                    reports: stats.reports || 0,
                    joinedAt: stats.joinedAt ? new Date(stats.joinedAt * 1000).toISOString() : null,
                    lastActive: stats.lastActive ? new Date(stats.lastActive * 1000).toISOString() : null,
                    isOnline: stats.isOnline || false
                }
            }
        }
    });
});

// Проверка токена
const verify = async (req, res) => {
    try {
        const authHeader = req.header('Authorization') || '';
        const parts = authHeader.split(' ');

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({ 
                success: false,
                message: 'Нет токена, авторизация отклонена' 
            });
        }

        const token = parts[1];

        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Нет токена, авторизация отклонена' 
            });
        }

        try {
            const decoded = jwt.verify(token, config.security.jwt.secret);
            
            // Получаем актуальные данные пользователя
            const userManager = await getUserManager();
            if (userManager) {
                const profile = await userManager.getProfile(decoded.userId);
                const main = profile?.main || {};
                
                // Получаем статистику
                let stats = DEFAULT_STATS;
                try {
                    if (main.stats) {
                        stats = typeof main.stats === 'object' ? main.stats : JSON.parse(main.stats);
                    }
                } catch (error) {
                    logger.warn('Error parsing user stats in verify', { uid: decoded.userId, error: error.message });
                }
                
                decoded.stats = {
                    posts: stats.posts || 67,
                    friends: stats.friends || 123,
                    groups: stats.groups || 7,
                    rating: stats.rating || 4.5,
                    warnings: stats.warnings || 0,
                    reports: stats.reports || 0,
                    joinedAt: stats.joinedAt ? new Date(stats.joinedAt * 1000).toISOString() : null,
                    lastActive: stats.lastActive ? new Date(stats.lastActive * 1000).toISOString() : null,
                    isOnline: stats.isOnline || false
                };
                
                decoded.role = main.role || USER_ROLES.USER;
            }
            
            res.json({ 
                success: true,
                valid: true, 
                data: { 
                    user: decoded,
                    stats: decoded.stats
                } 
            });
        } catch (error) {
            return res.status(401).json({ 
                success: false,
                valid: false, 
                error: {
                    message: 'Токен недействителен',
                    code: 'INVALID_TOKEN',
                }
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false,
            message: 'Ошибка сервера' 
        });
    }
};

// Получение профиля пользователя
const getProfile = asyncHandler(async (req, res) => {
    const userId = req.params.id || req.user?.userId;
    
    if (!userId) {
        throw new ValidationError('ID пользователя не указан');
    }
    
    const userManager = await getUserManager();
    
    if (!userManager) {
        throw new Error('Database is not available');
    }
    
    const profile = await userManager.getProfile(userId);
    const main = profile?.main || {};
    
    // Получаем статистику
    let stats = DEFAULT_STATS;
    try {
        if (main.stats) {
            stats = typeof main.stats === 'object' ? main.stats : JSON.parse(main.stats);
        }
    } catch (error) {
        logger.warn('Error parsing user stats in getProfile', { userId, error: error.message });
    }
    
    res.json({
        success: true,
        data: {
            user: {
                id: userId,
                firstName: main.firstName || '',
                lastName: main.lastName || '',
                username: main.username || '',
                phone: main.phone || '',
                email: main.email || '',
                age: main.age || null,
                role: main.role || USER_ROLES.USER,
                createdAt: main.createdAt ? new Date(main.createdAt * 1000).toISOString() : null,
                stats: {
                    posts: stats.posts || 67,
                    friends: stats.friends || 123,
                    groups: stats.groups || 7,
                    rating: stats.rating || 4.5,
                    warnings: stats.warnings || 0,
                    reports: stats.reports || 0,
                    joinedAt: stats.joinedAt ? new Date(stats.joinedAt * 1000).toISOString() : null,
                    lastActive: stats.lastActive ? new Date(stats.lastActive * 1000).toISOString() : null,
                    isOnline: stats.isOnline || false
                }
            }
        }
    });
});

// Обновление профиля пользователя
const updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    
    if (!userId) {
        throw new ValidationError('Пользователь не авторизован');
    }
    
    const { firstName, lastName, phone, age, email } = req.body;
    
    const userManager = await getUserManager();
    
    if (!userManager) {
        throw new Error('Database is not available');
    }
    
    // Обновляем данные пользователя
    const updatedData = {};
    if (firstName !== undefined) updatedData.firstName = firstName;
    if (lastName !== undefined) updatedData.lastName = lastName;
    if (phone !== undefined) updatedData.phone = phone;
    if (age !== undefined) updatedData.age = age;
    if (email !== undefined) updatedData.email = email;
    
    await userManager.updateUser(userId, updatedData);
    
    // Получаем обновленный профиль
    const profile = await userManager.getProfile(userId);
    const main = profile?.main || {};
    
    // Получаем статистику
    let stats = DEFAULT_STATS;
    try {
        if (main.stats) {
            stats = typeof main.stats === 'object' ? main.stats : JSON.parse(main.stats);
        }
    } catch (error) {
        logger.warn('Error parsing user stats in updateProfile', { userId, error: error.message });
    }
    
    logger.info('Profile updated', { userId, updatedFields: Object.keys(updatedData) });
    
    res.json({
        success: true,
        message: 'Профиль успешно обновлен',
        data: {
            user: {
                id: userId,
                firstName: main.firstName || '',
                lastName: main.lastName || '',
                username: main.username || '',
                phone: main.phone || '',
                email: main.email || '',
                age: main.age || null,
                role: main.role || USER_ROLES.USER,
                createdAt: main.createdAt ? new Date(main.createdAt * 1000).toISOString() : null,
                stats: {
                    posts: stats.posts || 67,
                    friends: stats.friends || 123,
                    groups: stats.groups || 7,
                    rating: stats.rating || 4.5,
                    warnings: stats.warnings || 0,
                    reports: stats.reports || 0,
                    joinedAt: stats.joinedAt ? new Date(stats.joinedAt * 1000).toISOString() : null,
                    lastActive: stats.lastActive ? new Date(stats.lastActive * 1000).toISOString() : null,
                    isOnline: stats.isOnline || false
                }
            }
        }
    });
});

// Проверка роли пользователя (для middleware)
const checkUserRole = async (userId, requiredRole) => {
    try {
        const userManager = await getUserManager();
        if (!userManager) return false;
        
        const role = await userManager.getUserRole(userId);
        
        if (requiredRole === USER_ROLES.SUPER_ADMIN) {
            return role === USER_ROLES.SUPER_ADMIN;
        }
        
        if (requiredRole === USER_ROLES.ADMIN) {
            return role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN;
        }
        
        if (requiredRole === USER_ROLES.MODERATOR) {
            return role === USER_ROLES.MODERATOR || role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN;
        }
        
        return true; // Для обычных пользователей
    } catch (error) {
        logger.error('Error checking user role', { userId, error: error.message });
        return false;
    }
};

// Middleware для проверки ролей
const requireRole = (...allowedRoles) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                message: 'Пользователь не авторизован' 
            });
        }
        
        try {
            const hasRole = await checkUserRole(req.user.userId, req.user.role);
            if (!hasRole || !allowedRoles.includes(req.user.role)) {
                return res.status(403).json({ 
                    success: false,
                    message: 'Недостаточно прав',
                    requiredRoles: allowedRoles,
                    userRole: req.user.role 
                });
            }
            
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Ошибка проверки прав доступа'
            });
        }
    };
};

module.exports = {
    register,
    login,
    verify,
    getProfile,
    updateProfile,
    requireRole,
    checkUserRole,
    USER_ROLES
};