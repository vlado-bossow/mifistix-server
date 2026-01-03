const jwt = require('jsonwebtoken');
const path = require('path');
const { pathToFileURL } = require('url');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.warn(
        '[SECURITY] JWT_SECRET не задан в переменных окружения. ' +
        'Установи сильный секрет в .env (JWT_SECRET=сложный_ключ).'
    );
}

/**
 * Ленивая инициализация DatabaseServer (ESM) в CommonJS окружении
 */
let userManagerInstance = null;
let dbInitialized = false;

const getUserManager = async () => {
    if (userManagerInstance) return userManagerInstance;

    // Подключаем ESM-модуль DatabaseServer динамически (через file:// URL для Windows)
    const dbModulePath = path.join(__dirname, '../..', 'DatabaseServer', 'src', 'index.js');
    const dbModuleUrl = pathToFileURL(dbModulePath).href;
    const dbModule = await import(dbModuleUrl);
    const { DatabaseManager, UserManager } = dbModule;

    const db = new DatabaseManager();
    if (!dbInitialized) {
        await db.initialize();
        dbInitialized = true;
    }

    userManagerInstance = new UserManager();
    return userManagerInstance;
};

/**
 * Генерация уникального 12-значного numeric UID
 */
const generate12DigitUid = async () => {
    const userManager = await getUserManager();

    // Пробуем до тех пор, пока не найдём свободный UID
    // (коллизия маловероятна, но на всякий случай проверяем)
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
const register = async (req, res) => {
    try {
        const { firstName, lastName, username, password, confirmPassword, phone } = req.body;
        
        // Валидация
        if (!firstName || !lastName || !username || !password) {
            return res.status(400).json({ message: 'Все поля обязательны' });
        }
        
        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Пароли не совпадают' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ message: 'Пароль должен быть не менее 8 символов' });
        }
        // Простая проверка сложности пароля
        const hasLetter = /[A-Za-zА-Яа-я]/.test(password);
        const hasDigit = /[0-9]/.test(password);
        if (!hasLetter || !hasDigit) {
            return res.status(400).json({ message: 'Пароль должен содержать буквы и цифры' });
        }

        try {
            const userManager = await getUserManager();

            // Генерируем 12-значный UID
            const uid = await generate12DigitUid();

            // Генерируем e-mail вида id@us.mifistix
            const email = `${uid}@us.mifistix`;

            // Генерируем случайный возраст для демонстрации (18-35 лет)
            // В будущем можно добавить поле age в форму регистрации или вычислять из даты рождения
            const age = Math.floor(Math.random() * (35 - 18 + 1)) + 18;

            // Создание пользователя в DatabaseServer
            await userManager.createUser({
                uid,
                username,
                phone: phone || '',
                email,
                password,
                firstName,
                lastName,
                age
            });

            const nowIso = new Date().toISOString();

            // Создание JWT токена
            const token = jwt.sign(
                { userId: uid, username },
                JWT_SECRET || 'your-secret-key',
                { expiresIn: '1h' } // короче живёт, безопаснее
            );

            return res.status(201).json({
                message: 'Регистрация успешна',
                token,
                user: {
                    id: uid,
                    firstName,
                    lastName,
                    username,
                    phone: phone || '',
                    email,
                    age,
                    createdAt: nowIso
                }
            });
        } catch (error) {
            console.error(error);

            // Обрабатываем ошибки уникальности из DatabaseServer
            if (error.message && error.message.includes('already exists')) {
                return res.status(400).json({ message: error.message });
            }

            return res.status(500).json({ message: 'Ошибка сервера' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Авторизация
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Валидация
        if (!username || !password) {
            return res.status(400).json({ message: 'Введите имя пользователя и пароль' });
        }
        
        try {
            const userManager = await getUserManager();

            // В качестве login используем то, что приходит в username
            const loginIdentifier = username;

            // Ищем uid по username/email/phone
            const uid = await userManager.findByLogin(loginIdentifier);
            if (!uid) {
                return res.status(400).json({ message: 'Неверное имя пользователя или пароль' });
            }

            // Проверяем пароль через DatabaseServer
            const isPasswordValid = await userManager.verifyPassword(uid, password);
            if (!isPasswordValid) {
                return res.status(400).json({ message: 'Неверное имя пользователя или пароль' });
            }

            // Получаем профиль для ответа
            const profile = await userManager.getProfile(uid);
            const main = profile?.main || {};

            // Создание JWT токена
            const token = jwt.sign(
                { userId: uid, username: main.username },
                JWT_SECRET || 'your-secret-key',
                { expiresIn: '1h' }
            );

            res.json({
                message: 'Авторизация успешна',
                token,
                user: {
                    id: uid,
                    firstName: main.firstName || '',
                    lastName: main.lastName || '',
                    username: main.username || loginIdentifier,
                    phone: main.phone || '',
                    email: main.email || '',
                    age: main.age || null,
                    createdAt: new Date(main.createdAt * 1000 || Date.now()).toISOString()
                }
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

// Получение профиля пользователя
const getProfile = async (req, res) => {
    try {
        const userManager = await getUserManager();
        const uid = req.user.userId;

        const profile = await userManager.getProfile(uid);
        const main = profile?.main || {};

        if (!main || !main.username) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json({
            id: uid,
            firstName: main.firstName || '',
            lastName: main.lastName || '',
            username: main.username || '',
            phone: main.phone || '',
            email: main.email || '',
            age: main.age || null,
            createdAt: new Date(main.createdAt * 1000 || Date.now()).toISOString()
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

module.exports = {
    register,
    login,
    getProfile
};