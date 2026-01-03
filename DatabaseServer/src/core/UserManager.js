import { ensureDir, readJson, writeJson, exists, readDir } from '../utils/fs.js';
import { getUserPath, getUserShardPath, getAdminPath, getAdminShardPath, getUsernameFilePath } from '../utils/paths.js';
import path from 'path';
import bcrypt from 'bcrypt';
import { IndexManager } from './IndexManager.js';

/**
 * Менеджер пользователей
 * Вся работа с пользователями и их данными
 */
export class UserManager {
  constructor() {
    this.indexManager = new IndexManager();
  }

  /**
   * Проверяет, является ли пользователь администратором
   * @param {number} uid - ID пользователя
   * @returns {Promise<boolean>}
   */
  async isAdmin(uid) {
    try {
      // Сначала проверяем в папке админов
      const adminPath = getAdminPath(uid);
      if (await exists(path.join(adminPath, 'profile', 'main.json'))) {
        const adminProfile = await readJson(path.join(adminPath, 'profile', 'main.json'));
        return adminProfile.role === 'admin' || adminProfile.role === 'superadmin';
      }
      
      // Если не найден в админах, проверяем в пользователях
      const userPath = getUserPath(uid);
      if (await exists(path.join(userPath, 'profile', 'main.json'))) {
        const userProfile = await readJson(path.join(userPath, 'profile', 'main.json'));
        return (userProfile.email && userProfile.email.includes('@adm.mifistix')) ||
               userProfile.role === 'admin' ||
               userProfile.role === 'superadmin';
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Получает путь к пользователю (админу или обычному пользователю)
   * @param {number} uid - ID пользователя
   * @returns {Promise<string>}
   */
  async getUserPath(uid) {
    const isAdminUser = await this.isAdmin(uid);
    return isAdminUser ? getAdminPath(uid) : getUserPath(uid);
  }

  /**
   * Создаёт структуру папок пользователя
   * @param {number} uid - ID пользователя
   * @param {boolean} isAdmin - Является ли пользователь администратором
   */
  async createUserStructure(uid, isAdmin = false) {
    // Для админов используем отдельную структуру
    const userPath = isAdmin ? getAdminPath(uid) : getUserPath(uid);
    const shardPath = isAdmin ? getAdminShardPath(uid) : getUserShardPath(uid);
    
    const dirs = [
      path.join(userPath, 'profile'),
      path.join(userPath, 'content'),
      path.join(userPath, 'relations'),
      path.join(userPath, 'chats'),
      path.join(userPath, 'chats', 'messages'),
      path.join(userPath, 'notifications'),
      path.join(userPath, 'settings'),
      path.join(userPath, 'system'),
      path.join(userPath, 'MI Fire')
    ];

    // Создаём шард, если его нет
    await ensureDir(shardPath);

    for (const dir of dirs) {
      await ensureDir(dir);
    }

    // Создаём файлы для папки "MI Fire"
    await this.createMIFireFiles(uid, isAdmin);
  }

  /**
   * Создаёт файлы для папки "MI Fire"
   * @param {number} uid - ID пользователя
   * @param {boolean} isAdmin - Является ли пользователь администратором
   */
  async createMIFireFiles(uid, isAdmin = false) {
    const userPath = isAdmin ? getAdminPath(uid) : getUserPath(uid);
    const miFirePath = path.join(userPath, 'MI Fire');
    
    // 1. Файл payment_list.json - список платежей
    const paymentList = {
      uid: uid,
      payments: [],
      totalSpent: 0,
      totalReceived: 0,
      currency: 'MIF',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000)
    };
    await writeJson(path.join(miFirePath, 'payment_list.json'), paymentList);

    // 2. Файл count.json - счетчики и статистика
    const countData = {
      uid: uid,
      fireTokens: 1000, // Начальный баланс Fire Tokens
      mifCoins: 500, // Начальный баланс MIF Coins
      vipLevel: 1,
      xp: 0,
      level: 1,
      dailyStreak: 0,
      lastLogin: Math.floor(Date.now() / 1000),
      achievements: [],
      badges: [],
      stats: {
        totalLogins: 1,
        totalHoursSpent: 0,
        totalPostsCreated: 0,
        totalLikesReceived: 0,
        totalCommentsMade: 0,
        totalShares: 0,
        totalTransactions: 0
      },
      settings: {
        notifications: true,
        autoCollectRewards: true,
        privacyMode: false,
        theme: 'dark'
      }
    };
    await writeJson(path.join(miFirePath, 'count.json'), countData);

    // 3. Файл transactions.json - история транзакций
    const transactions = {
      uid: uid,
      history: [],
      pending: [],
      lastTransactionId: 0,
      createdAt: Math.floor(Date.now() / 1000)
    };
    await writeJson(path.join(miFirePath, 'transactions.json'), transactions);

    // 4. Файл rewards.json - награды и бонусы
    const rewards = {
      uid: uid,
      availableRewards: [
        {
          id: 1,
          name: 'Daily Login',
          type: 'daily',
          amount: 50,
          currency: 'MIF',
          claimed: false,
          claimDate: null
        },
        {
          id: 2,
          name: 'Welcome Bonus',
          type: 'welcome',
          amount: 1000,
          currency: 'MIF',
          claimed: false,
          claimDate: null
        }
      ],
      claimedRewards: [],
      nextRewardTime: Math.floor(Date.now() / 1000) + 86400, // Через 24 часа
      streakBonus: 1.0
    };
    await writeJson(path.join(miFirePath, 'rewards.json'), rewards);

    // 5. Файл inventory.json - инвентарь пользователя
    const inventory = {
      uid: uid,
      items: [
        {
          id: 'starter_pack',
          name: 'Стартовый набор',
          type: 'pack',
          quantity: 1,
          description: 'Базовый набор для новых пользователей'
        }
      ],
      equipped: {},
      storage: [],
      lastUpdated: Math.floor(Date.now() / 1000)
    };
    await writeJson(path.join(miFirePath, 'inventory.json'), inventory);

    // 6. Файл premium.json - премиум статус
    const premium = {
      uid: uid,
      isPremium: false,
      premiumUntil: null,
      plan: null,
      features: {},
      paymentMethod: null,
      autoRenew: false
    };
    await writeJson(path.join(miFirePath, 'premium.json'), premium);

    // 7. Файл activity.json - активность пользователя
    const activity = {
      uid: uid,
      lastActive: Math.floor(Date.now() / 1000),
      sessions: [],
      onlineStatus: 'offline',
      deviceInfo: {},
      location: null
    };
    await writeJson(path.join(miFirePath, 'activity.json'), activity);
  }

  /**
   * Получает данные из папки "MI Fire"
   */
  async getMIFireData(uid) {
    try {
      const isAdminUser = await this.isAdmin(uid);
      const userPath = isAdminUser ? getAdminPath(uid) : getUserPath(uid);
      const miFirePath = path.join(userPath, 'MI Fire');
      
      // Проверяем существование папки
      if (!await exists(miFirePath)) {
        await ensureDir(miFirePath);
        await this.createMIFireFiles(uid, isAdminUser);
      }

      // Читаем все файлы
      const [paymentList, countData, transactions, rewards, inventory, premium, activity] = await Promise.all([
        readJson(path.join(miFirePath, 'payment_list.json')),
        readJson(path.join(miFirePath, 'count.json')),
        readJson(path.join(miFirePath, 'transactions.json')),
        readJson(path.join(miFirePath, 'rewards.json')),
        readJson(path.join(miFirePath, 'inventory.json')),
        readJson(path.join(miFirePath, 'premium.json')),
        readJson(path.join(miFirePath, 'activity.json'))
      ]);

      return {
        payment_list: paymentList,
        count: countData,
        transactions: transactions,
        rewards: rewards,
        inventory: inventory,
        premium: premium,
        activity: activity,
        summary: {
          totalBalance: countData.fireTokens + countData.mifCoins,
          vipLevel: countData.vipLevel,
          premiumStatus: premium.isPremium,
          lastActive: activity.lastActive
        }
      };
    } catch (error) {
      console.error(`[UserManager] Ошибка при чтении MI Fire данных для пользователя ${uid}:`, error);
      
      // Если файлы повреждены, создаем заново
      if (error.code === 'ENOENT' || error.message.includes('Unexpected token')) {
        const isAdminUser = await this.isAdmin(uid);
        await this.createMIFireFiles(uid, isAdminUser);
        return this.getMIFireData(uid);
      }
      
      throw error;
    }
  }

  /**
   * Обновляет данные в папке "MI Fire"
   */
  async updateMIFireData(uid, data) {
    try {
      const isAdminUser = await this.isAdmin(uid);
      const userPath = isAdminUser ? getAdminPath(uid) : getUserPath(uid);
      const miFirePath = path.join(userPath, 'MI Fire');
      
      // Проверяем существование папки
      if (!await exists(miFirePath)) {
        await ensureDir(miFirePath);
        await this.createMIFireFiles(uid, isAdminUser);
      }

      // Обновляем только переданные файлы
      if (data.payment_list) {
        const currentData = await readJson(path.join(miFirePath, 'payment_list.json'));
        const updatedData = { ...currentData, ...data.payment_list, updatedAt: Math.floor(Date.now() / 1000) };
        await writeJson(path.join(miFirePath, 'payment_list.json'), updatedData);
      }

      if (data.count) {
        const currentData = await readJson(path.join(miFirePath, 'count.json'));
        const updatedData = { ...currentData, ...data.count };
        await writeJson(path.join(miFirePath, 'count.json'), updatedData);
      }

      if (data.transactions) {
        const currentData = await readJson(path.join(miFirePath, 'transactions.json'));
        const updatedData = { ...currentData, ...data.transactions };
        await writeJson(path.join(miFirePath, 'transactions.json'), updatedData);
      }

      if (data.rewards) {
        const currentData = await readJson(path.join(miFirePath, 'rewards.json'));
        const updatedData = { ...currentData, ...data.rewards };
        await writeJson(path.join(miFirePath, 'rewards.json'), updatedData);
      }

      if (data.inventory) {
        const currentData = await readJson(path.join(miFirePath, 'inventory.json'));
        const updatedData = { ...currentData, ...data.inventory, lastUpdated: Math.floor(Date.now() / 1000) };
        await writeJson(path.join(miFirePath, 'inventory.json'), updatedData);
      }

      if (data.premium) {
        const currentData = await readJson(path.join(miFirePath, 'premium.json'));
        const updatedData = { ...currentData, ...data.premium };
        await writeJson(path.join(miFirePath, 'premium.json'), updatedData);
      }

      if (data.activity) {
        const currentData = await readJson(path.join(miFirePath, 'activity.json'));
        const updatedData = { ...currentData, ...data.activity, lastActive: Math.floor(Date.now() / 1000) };
        await writeJson(path.join(miFirePath, 'activity.json'), updatedData);
      }

      return true;
    } catch (error) {
      console.error(`[UserManager] Ошибка при обновлении MI Fire данных для пользователя ${uid}:`, error);
      return false;
    }
  }

  /**
   * Добавляет платеж в историю
   */
  async addPayment(uid, paymentData) {
    try {
      const miFireData = await this.getMIFireData(uid);
      const paymentList = miFireData.payment_list;
      const count = miFireData.count;

      // Генерируем ID платежа
      const paymentId = paymentList.payments.length + 1;

      const payment = {
        id: paymentId,
        ...paymentData,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'completed'
      };

      // Добавляем платеж в историю
      paymentList.payments.push(payment);
      paymentList.updatedAt = Math.floor(Date.now() / 1000);

      // Обновляем статистику в зависимости от типа платежа
      if (paymentData.type === 'outgoing') {
        paymentList.totalSpent += paymentData.amount || 0;
        count.fireTokens -= paymentData.amount || 0;
      } else if (paymentData.type === 'incoming') {
        paymentList.totalReceived += paymentData.amount || 0;
        count.fireTokens += paymentData.amount || 0;
      }

      // Обновляем общую статистику
      count.stats.totalTransactions += 1;

      // Сохраняем изменения
      await this.updateMIFireData(uid, {
        payment_list: paymentList,
        count: count
      });

      return { success: true, paymentId };
    } catch (error) {
      console.error(`[UserManager] Ошибка при добавлении платежа для пользователя ${uid}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Обновляет счетчик (баланс)
   */
  async updateCount(uid, updates) {
    try {
      const miFireData = await this.getMIFireData(uid);
      const count = miFireData.count;

      // Обновляем поля
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          if (key === 'stats' && updates.stats) {
            // Для stats делаем глубокое обновление
            count.stats = { ...count.stats, ...updates.stats };
          } else if (key === 'fireTokens') {
            // Для токенов проверяем, чтобы не ушли в минус
            const newValue = count.fireTokens + (updates.fireTokens || 0);
            count.fireTokens = Math.max(0, newValue);
          } else if (key === 'mifCoins') {
            // Для монет проверяем, чтобы не ушли в минус
            const newValue = count.mifCoins + (updates.mifCoins || 0);
            count.mifCoins = Math.max(0, newValue);
          } else {
            count[key] = updates[key];
          }
        }
      });

      // Обновляем время последнего входа
      count.lastLogin = Math.floor(Date.now() / 1000);

      await this.updateMIFireData(uid, { count });

      return { success: true, newBalance: count.fireTokens, newCoins: count.mifCoins };
    } catch (error) {
      console.error(`[UserManager] Ошибка при обновлении счетчика для пользователя ${uid}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Обновляет активность пользователя
   */
  async updateActivity(uid, activityData = {}) {
    try {
      const miFireData = await this.getMIFireData(uid);
      const activity = miFireData.activity;

      // Обновляем активность
      activity.lastActive = Math.floor(Date.now() / 1000);
      activity.onlineStatus = activityData.onlineStatus || 'online';
      
      if (activityData.deviceInfo) {
        activity.deviceInfo = { ...activity.deviceInfo, ...activityData.deviceInfo };
      }
      
      if (activityData.location) {
        activity.location = activityData.location;
      }

      // Добавляем сессию если нужно
      if (activityData.sessionStart) {
        activity.sessions.push({
          start: activityData.sessionStart,
          end: Math.floor(Date.now() / 1000),
          duration: Math.floor(Date.now() / 1000) - activityData.sessionStart,
          device: activityData.deviceInfo || {}
        });
        
        // Ограничиваем количество сессий в истории
        if (activity.sessions.length > 100) {
          activity.sessions = activity.sessions.slice(-100);
        }
      }

      await this.updateMIFireData(uid, { activity });

      return { success: true };
    } catch (error) {
      console.error(`[UserManager] Ошибка при обновлении активности для пользователя ${uid}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Добавляет награду
   */
  async addReward(uid, rewardData) {
    try {
      const miFireData = await this.getMIFireData(uid);
      const rewards = miFireData.rewards;

      // Добавляем награду
      const rewardId = rewards.availableRewards.length + 1;
      const reward = {
        id: rewardId,
        ...rewardData,
        claimed: false,
        claimDate: null
      };

      rewards.availableRewards.push(reward);
      
      await this.updateMIFireData(uid, { rewards });

      return { success: true, rewardId };
    } catch (error) {
      console.error(`[UserManager] Ошибка при добавлении награды для пользователя ${uid}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получает баланс пользователя
   */
  async getBalance(uid) {
    try {
      const miFireData = await this.getMIFireData(uid);
      const count = miFireData.count;

      return {
        success: true,
        fireTokens: count.fireTokens,
        mifCoins: count.mifCoins,
        totalBalance: count.fireTokens + count.mifCoins,
        vipLevel: count.vipLevel,
        level: count.level
      };
    } catch (error) {
      console.error(`[UserManager] Ошибка при получении баланса для пользователя ${uid}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Генерирует виртуальный номер телефона на основе UID в формате +666 (666) 666 6666
   */
  generateVirtualPhone(uid) {
    // Генерируем виртуальный номер на основе UID
    // Формат: +666 (XXX) XXX XXXX где X - цифры из UID
    const base = String(uid).padStart(10, '0'); // Делаем 10 цифр
    
    // Берем последние 10 цифр UID для генерации номера
    const uidStr = String(uid);
    const digits = uidStr.slice(-10).padStart(10, '0');
    
    const part1 = digits.slice(0, 3);    // Первые 3 цифры
    const part2 = digits.slice(3, 6);    // Следующие 3 цифры
    const part3 = digits.slice(6, 10);   // Последние 4 цифры
    
    // Формат: +666 (XXX) XXX XXXX
    return `+666 (${part1}) ${part2} ${part3}`;
  }

  /**
   * Создаёт нового пользователя
   */
  async createUser(userData) {
    const { uid, username, email, password, firstName, lastName } = userData;
    
    // Валидация обязательных полей
    if (!username) {
      throw new Error('Username is required');
    }
    if (!password) {
      throw new Error('Password is required');
    }

    // ВСЕГДА генерируем виртуальный номер телефона автоматически
    // Пользователь никогда не вводит номер - система создаёт его сама
    let phone = this.generateVirtualPhone(uid);
    
    // Проверяем уникальность сгенерированного номера (на случай коллизии)
    let checkUid = uid;
    let attempts = 0;
    while (await this.indexManager.exists('phone', phone) && attempts < 100) {
      // Генерируем новый номер с небольшим смещением
      checkUid = uid + attempts + 1;
      phone = this.generateVirtualPhone(checkUid);
      attempts++;
    }

    // Проверяем уникальность
    if (await this.indexManager.exists('username', username)) {
      throw new Error(`Username ${username} already exists`);
    }
    if (await this.indexManager.exists('phone', phone)) {
      throw new Error(`Phone ${phone} already exists`);
    }
    if (email && await this.indexManager.exists('email', email)) {
      throw new Error(`Email ${email} already exists`);
    }

    // Определяем роль пользователя
    // Если role передан в userData, используем его, иначе по умолчанию 'user'
    const userRole = userData.role || 'user';
    
    // Проверяем, является ли пользователь администратором (по email или роли)
    const isAdmin = (email && email.includes('@adm.mifistix')) || 
                    userRole === 'admin' || 
                    userRole === 'superadmin';
    
    // Создаём структуру (включая папку MI Fire)
    // Для админов используем отдельную папку admins/
    await this.createUserStructure(uid, isAdmin);

    // Сохраняем профиль
    const now = Math.floor(Date.now() / 1000);
    
    // Статистика по умолчанию
    const defaultStats = {
      posts: 67,
      friends: 123,
      groups: 7,
      rating: 4.5,
      warnings: 0,
      reports: 0,
      joinedAt: now,
      lastActive: now,
      isOnline: true
    };
    
    await this.updateProfile(uid, {
      main: {
        uid,
        firstName: firstName || '',
        lastName: lastName || '',
        username,
        phone: phone,
        email: email || '',
        age: userData.age || null,
        role: userRole,
        permissions: userData.permissions || [], // Сохраняем права
        stats: defaultStats, // Добавляем статистику
        verified: false,
        createdAt: now,
        lastOnline: now,
        status: 'active'
      },
      avatar: {
        mediaId: null,
        updatedAt: now
      },
      counters: {
        friends: 0,
        followers: 0,
        following: 0,
        posts: 0
      }
    });

    // Сохраняем auth
    const passwordHash = await bcrypt.hash(password, 10);
    await this.updateSystem(uid, {
      auth: {
        passwordHash,
        lastChange: now
      },
      sessions: [],
      logs: []
    });

    // Обновляем индексы
    // Сохраняем username в нижнем регистре для поиска без учета регистра
    await this.indexManager.add('username', username.toLowerCase(), uid);
    // Также сохраняем оригинальный username для точного поиска
    await this.indexManager.add('username', username, uid);
    await this.indexManager.add('phone', phone, uid); // Телефон обязателен
    if (email) {
      await this.indexManager.add('email', email.toLowerCase(), uid);
      await this.indexManager.add('email', email, uid);
    }

    // Дополнительно: сохраняем айди профиля в структуре username/
    // Формат: { uid, profileId, createdAt }
    const usernamePath = getUsernameFilePath(username);
    const createdAt = new Date().toISOString();
    await writeJson(usernamePath, { 
      uid, 
      profileId: uid, // Айди профиля совпадает с uid
      createdAt 
    });

    return { uid, username };
  }

  /**
   * Обновляет данные профиля
   */
  async updateProfile(uid, profileData) {
    const userPath = await this.getUserPath(uid);

    // Если обновляется main, проверяем изменения username и email
    if (profileData.main) {
      const oldProfile = await this.getProfile(uid);
      const oldMain = oldProfile.main || {};
      
      // Обновляем профиль
      await writeJson(path.join(userPath, 'profile', 'main.json'), profileData.main);
      
      // Если изменился username, обновляем индекс
      if (profileData.main.username && profileData.main.username !== oldMain.username) {
        const oldUsername = oldMain.username;
        const newUsername = profileData.main.username;
        
        // Удаляем старый username из индекса
        if (oldUsername) {
          await this.indexManager.remove('username', oldUsername);
          await this.indexManager.remove('username', oldUsername.toLowerCase());
        }
        
        // Добавляем новый username в индекс (в обоих регистрах)
        await this.indexManager.add('username', newUsername.toLowerCase(), uid);
        await this.indexManager.add('username', newUsername, uid);
        
        // Обновляем файл username
        const oldUsernamePath = getUsernameFilePath(oldUsername);
        const newUsernamePath = getUsernameFilePath(newUsername);
        if (await exists(oldUsernamePath)) {
          const usernameData = await readJson(oldUsernamePath);
          await writeJson(newUsernamePath, { ...usernameData, uid });
          // Удаляем старый файл
          const { unlink } = await import('fs/promises');
          await unlink(oldUsernamePath).catch(() => {});
        }
      }
      
      // Если изменился email, обновляем индекс
      if (profileData.main.email && profileData.main.email !== oldMain.email) {
        const oldEmail = oldMain.email;
        const newEmail = profileData.main.email;
        
        // Удаляем старый email из индекса
        if (oldEmail) {
          await this.indexManager.remove('email', oldEmail);
          await this.indexManager.remove('email', oldEmail.toLowerCase());
        }
        
        // Добавляем новый email в индекс (в обоих регистрах)
        await this.indexManager.add('email', newEmail.toLowerCase(), uid);
        await this.indexManager.add('email', newEmail, uid);
      }
    }
    
    if (profileData.avatar) {
      await writeJson(path.join(userPath, 'profile', 'avatar.json'), profileData.avatar);
    }
    if (profileData.about) {
      await writeJson(path.join(userPath, 'profile', 'about.json'), profileData.about);
    }
    if (profileData.counters) {
      await writeJson(path.join(userPath, 'profile', 'counters.json'), profileData.counters);
    }
  }

  /**
   * Получает данные профиля
   */
  async getProfile(uid) {
    const userPath = await this.getUserPath(uid);
    
    const [main, avatar, about, counters] = await Promise.all([
      readJson(path.join(userPath, 'profile', 'main.json')),
      readJson(path.join(userPath, 'profile', 'avatar.json')),
      readJson(path.join(userPath, 'profile', 'about.json')),
      readJson(path.join(userPath, 'profile', 'counters.json'))
    ]);

    return { main, avatar, about, counters };
  }

  /**
   * Обновляет статистику пользователя
   */
  async updateUserStats(uid, stats) {
    try {
      const profile = await this.getProfile(uid);
      const main = profile.main || {};
      
      // Обновляем статистику в main
      main.stats = stats;
      
      // Сохраняем обновленный профиль
      await this.updateProfile(uid, { main });
      
      return true;
    } catch (error) {
      console.error(`[UserManager] Ошибка при обновлении статистики для пользователя ${uid}:`, error);
      return false;
    }
  }

  /**
   * Обновляет пользователя (для общих данных)
   */
  async updateUser(uid, userData) {
    try {
      const profile = await this.getProfile(uid);
      const main = profile.main || {};
      
      // Обновляем поля
      Object.keys(userData).forEach(key => {
        if (userData[key] !== undefined) {
          main[key] = userData[key];
        }
      });
      
      // Сохраняем обновленный профиль
      await this.updateProfile(uid, { main });
      
      return true;
    } catch (error) {
      console.error(`[UserManager] Ошибка при обновлении пользователя ${uid}:`, error);
      return false;
    }
  }

  /**
   * Обновляет контент пользователя
   */
  async updateContent(uid, contentData) {
    const userPath = getUserPath(uid);

    if (contentData.posts) {
      await writeJson(path.join(userPath, 'content', 'posts.json'), contentData.posts);
    }
    if (contentData.media) {
      await writeJson(path.join(userPath, 'content', 'media.json'), contentData.media);
    }
    if (contentData.music) {
      await writeJson(path.join(userPath, 'content', 'music.json'), contentData.music);
    }
    if (contentData.drafts) {
      await writeJson(path.join(userPath, 'content', 'drafts.json'), contentData.drafts);
    }
  }

  /**
   * Получает контент пользователя
   */
  async getContent(uid) {
    const userPath = getUserPath(uid);
    
    const [posts, media, music, drafts] = await Promise.all([
      readJson(path.join(userPath, 'content', 'posts.json')),
      readJson(path.join(userPath, 'content', 'media.json')),
      readJson(path.join(userPath, 'content', 'music.json')),
      readJson(path.join(userPath, 'content', 'drafts.json'))
    ]);

    return { posts, media, music, drafts };
  }

  /**
   * Обновляет отношения (друзья, подписки)
   */
  async updateRelations(uid, relationsData) {
    try {
      const userPath = getUserPath(uid);
      const relationsPath = path.join(userPath, 'relations');
      
      // Убеждаемся, что директория существует
      await ensureDir(relationsPath);

      if (relationsData.friends !== undefined) {
        const friendsPath = path.join(relationsPath, 'friends.json');
        await writeJson(friendsPath, relationsData.friends);
        console.log(`[UserManager] Сохранены друзья для пользователя ${uid}:`, relationsData.friends);
      }
      if (relationsData.requests !== undefined) {
        const requestsPath = path.join(relationsPath, 'requests.json');
        await writeJson(requestsPath, relationsData.requests);
        console.log(`[UserManager] Сохранены запросы для пользователя ${uid}:`, relationsData.requests);
      }
      if (relationsData.followers !== undefined) {
        await writeJson(path.join(relationsPath, 'followers.json'), relationsData.followers);
      }
      if (relationsData.blocked !== undefined) {
        await writeJson(path.join(relationsPath, 'blocked.json'), relationsData.blocked);
      }
    } catch (error) {
      console.error(`[UserManager] Ошибка при обновлении отношений для пользователя ${uid}:`, error);
      throw error;
    }
  }  

  /**
   * Получает отношения пользователя
   */
  async getRelations(uid) {
    const userPath = getUserPath(uid);
    const relationsPath = path.join(userPath, 'relations');
    
    // Убеждаемся, что директория существует
    await ensureDir(relationsPath);
    
    const friendsPath = path.join(relationsPath, 'friends.json');
    const requestsPath = path.join(relationsPath, 'requests.json');
    const followersPath = path.join(relationsPath, 'followers.json');
    const blockedPath = path.join(relationsPath, 'blocked.json');
    
    let friends, requests, followers, blocked;
    
    try {
      friends = await readJson(friendsPath);
      if (!friends || typeof friends !== 'object' || !Array.isArray(friends.friends)) {
        friends = { friends: [] };
        await writeJson(friendsPath, friends);
      }
    } catch (error) {
      friends = { friends: [] };
      await writeJson(friendsPath, friends);
    }
    
    try {
      requests = await readJson(requestsPath);
      if (!requests || typeof requests !== 'object' || !Array.isArray(requests.incoming) || !Array.isArray(requests.outgoing)) {
        requests = { incoming: [], outgoing: [] };
        await writeJson(requestsPath, requests);
      }
    } catch (error) {
      requests = { incoming: [], outgoing: [] };
      await writeJson(requestsPath, requests);
    }
    
    try {
      followers = await readJson(followersPath);
      if (!Array.isArray(followers)) {
        followers = [];
        await writeJson(followersPath, followers);
      }
    } catch (error) {
      followers = [];
      await writeJson(followersPath, followers);
    }
    
    try {
      blocked = await readJson(blockedPath);
      if (!Array.isArray(blocked)) {
        blocked = [];
        await writeJson(blockedPath, blocked);
      }
    } catch (error) {
      blocked = [];
      await writeJson(blockedPath, blocked);
    }

    return { 
      friends: friends || { friends: [] }, 
      requests: requests || { incoming: [], outgoing: [] },
      followers: followers || [],
      blocked: blocked || []
    };
  }

  /**
   * Добавляет друга
   */
  async addFriend(uid, friendUid) {
    try {
      const relations = await this.getRelations(uid);
      const friendsData = relations.friends || { friends: [] };
      
      // Убеждаемся, что friends - это массив
      if (!Array.isArray(friendsData.friends)) {
        friendsData.friends = [];
      }
      
      // Преобразуем friendUid в число для сравнения
      const friendId = parseInt(friendUid);
      
      // Преобразуем все существующие ID в числа для корректного сравнения
      const numericFriends = friendsData.friends.map(id => parseInt(id));
      
      if (!numericFriends.includes(friendId)) {
        friendsData.friends.push(friendId);
        await this.updateRelations(uid, { friends: friendsData });
        console.log(`[UserManager] Пользователь ${uid} добавил друга ${friendId}. Друзья:`, friendsData.friends);
      } else {
        console.log(`[UserManager] Пользователь ${uid} уже имеет друга ${friendId}`);
      }
    } catch (error) {
      console.error(`[UserManager] Ошибка при добавлении друга для пользователя ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Отправляет заявку в друзья
   */
  async sendFriendRequest(fromUid, toUid) {
    try {
      const fromId = parseInt(fromUid);
      const toId = parseInt(toUid);
      
      // Добавляем исходящую заявку
      const fromRelations = await this.getRelations(fromId);
      const fromRequests = fromRelations.requests || { incoming: [], outgoing: [] };
      
      if (!Array.isArray(fromRequests.outgoing)) {
        fromRequests.outgoing = [];
      }
      
      const numericOutgoing = fromRequests.outgoing.map(id => parseInt(id));
      if (!numericOutgoing.includes(toId)) {
        fromRequests.outgoing.push(toId);
        await this.updateRelations(fromId, { requests: fromRequests });
        console.log(`[UserManager] Пользователь ${fromId} отправил запрос в друзья пользователю ${toId}`);
      }

      // Добавляем входящую заявку
      const toRelations = await this.getRelations(toId);
      const toRequests = toRelations.requests || { incoming: [], outgoing: [] };
      
      if (!Array.isArray(toRequests.incoming)) {
        toRequests.incoming = [];
      }
      
      const numericIncoming = toRequests.incoming.map(id => parseInt(id));
      if (!numericIncoming.includes(fromId)) {
        toRequests.incoming.push(fromId);
        await this.updateRelations(toId, { requests: toRequests });
        console.log(`[UserManager] Пользователь ${toId} получил запрос в друзья от ${fromId}`);
      }
    } catch (error) {
      console.error(`[UserManager] Ошибка при отправке запроса в друзья от ${fromUid} к ${toUid}:`, error);
      throw error;
    }
  }

  /**
   * Принимает заявку в друзья
   */
  async acceptFriendRequest(uid, fromUid) {
    try {
      const uidNum = parseInt(uid);
      const fromUidNum = parseInt(fromUid);
      
      // Убираем из входящих
      const relations = await this.getRelations(uidNum);
      const requests = relations.requests || { incoming: [], outgoing: [] };
      
      if (!Array.isArray(requests.incoming)) {
        requests.incoming = [];
      }
      
      requests.incoming = requests.incoming.filter(id => parseInt(id) !== fromUidNum);
      await this.updateRelations(uidNum, { requests });
      console.log(`[UserManager] Удален входящий запрос от ${fromUidNum} для пользователя ${uidNum}`);

      // Убираем из исходящих у отправителя
      const fromRelations = await this.getRelations(fromUidNum);
      const fromRequests = fromRelations.requests || { incoming: [], outgoing: [] };
      
      if (!Array.isArray(fromRequests.outgoing)) {
        fromRequests.outgoing = [];
      }
      
      fromRequests.outgoing = fromRequests.outgoing.filter(id => parseInt(id) !== uidNum);
      await this.updateRelations(fromUidNum, { requests: fromRequests });
      console.log(`[UserManager] Удален исходящий запрос к ${uidNum} для пользователя ${fromUidNum}`);

      // Добавляем в друзья обоим
      await this.addFriend(uidNum, fromUidNum);
      await this.addFriend(fromUidNum, uidNum);
      console.log(`[UserManager] Пользователи ${uidNum} и ${fromUidNum} теперь друзья`);
    } catch (error) {
      console.error(`[UserManager] Ошибка при принятии запроса в друзья для пользователя ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Обновляет чаты
   */
  async updateChats(uid, chatsData) {
    const userPath = getUserPath(uid);

    if (chatsData.dialogs) {
      await writeJson(path.join(userPath, 'chats', 'dialogs.json'), chatsData.dialogs);
    }
    if (chatsData.messages) {
      for (const [dialogId, messages] of Object.entries(chatsData.messages)) {
        await writeJson(path.join(userPath, 'chats', 'messages', `d_${dialogId}.json`), messages);
      }
    }
  }

  /**
   * Получает чаты пользователя
   */
  async getChats(uid) {
    const userPath = getUserPath(uid);
    const dialogs = await readJson(path.join(userPath, 'chats', 'dialogs.json'));
    
    // Загружаем все сообщения
    const messagesDir = path.join(userPath, 'chats', 'messages');
    const messageFiles = await readDir(messagesDir);
    const messages = {};
    
    for (const file of messageFiles) {
      if (file.endsWith('.json')) {
        const dialogId = file.replace('d_', '').replace('.json', '');
        messages[dialogId] = await readJson(path.join(messagesDir, file));
      }
    }

    return { dialogs, messages };
  }

  /**
   * Обновляет уведомления
   */
  async updateNotifications(uid, notificationsData) {
    const userPath = getUserPath(uid);

    if (notificationsData.unread) {
      await writeJson(path.join(userPath, 'notifications', 'unread.json'), notificationsData.unread);
    }
    if (notificationsData.history) {
      await writeJson(path.join(userPath, 'notifications', 'history.json'), notificationsData.history);
    }
  }

  /**
   * Получает уведомления
   */
  async getNotifications(uid) {
    const userPath = getUserPath(uid);
    
    const [unread, history] = await Promise.all([
      readJson(path.join(userPath, 'notifications', 'unread.json')),
      readJson(path.join(userPath, 'notifications', 'history.json'))
    ]);

    return { unread, history };
  }

  /**
   * Добавляет уведомление
   */
  async addNotification(uid, notification) {
    const notifications = await this.getNotifications(uid);
    const unread = notifications.unread || { count: 0, items: [] };
    
    unread.items.push(notification);
    unread.count = unread.items.length;
    
    await this.updateNotifications(uid, { unread });
  }

  /**
   * Обновляет настройки
   */
  async updateSettings(uid, settingsData) {
    const userPath = getUserPath(uid);

    if (settingsData.privacy) {
      await writeJson(path.join(userPath, 'settings', 'privacy.json'), settingsData.privacy);
    }
    if (settingsData.interface) {
      await writeJson(path.join(userPath, 'settings', 'interface.json'), settingsData.interface);
    }
    if (settingsData.security) {
      await writeJson(path.join(userPath, 'settings', 'security.json'), settingsData.security);
    }
  }

  /**
   * Получает настройки
   */
  async getSettings(uid) {
    const userPath = getUserPath(uid);
    
    const [privacy, interface_, security] = await Promise.all([
      readJson(path.join(userPath, 'settings', 'privacy.json')),
      readJson(path.join(userPath, 'settings', 'interface.json')),
      readJson(path.join(userPath, 'settings', 'security.json'))
    ]);

    return { privacy, interface: interface_, security };
  }

  /**
   * Обновляет системные данные
   */
  async updateSystem(uid, systemData) {
    const userPath = getUserPath(uid);

    if (systemData.auth) {
      await writeJson(path.join(userPath, 'system', 'auth.json'), systemData.auth);
    }
    if (systemData.sessions) {
      await writeJson(path.join(userPath, 'system', 'sessions.json'), systemData.sessions);
    }
    if (systemData.logs) {
      await writeJson(path.join(userPath, 'system', 'logs.json'), systemData.logs);
    }
  }

  /**
   * Получает системные данные
   */
  async getSystem(uid) {
    const userPath = getUserPath(uid);
    
    const [auth, sessions, logs] = await Promise.all([
      readJson(path.join(userPath, 'system', 'auth.json')),
      readJson(path.join(userPath, 'system', 'sessions.json')),
      readJson(path.join(userPath, 'system', 'logs.json'))
    ]);

    return { auth, sessions, logs };
  }

  /**
   * Проверяет пароль
   */
  async verifyPassword(uid, password) {
    const system = await this.getSystem(uid);
    if (!system.auth) {
      return false;
    }
    return await bcrypt.compare(password, system.auth.passwordHash);
  }

  /**
   * Поиск пользователя по username/phone/email
   */
  async findByLogin(login) {
    if (!login || typeof login !== 'string') {
      return null;
    }
    
    const trimmedLogin = login.trim();
    if (!trimmedLogin) {
      return null;
    }
    
    // Проверяем email (должен содержать @ не в начале и иметь точку после @)
    // Формат: something@domain.com
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmedLogin)) {
      // Сначала ищем в индексе email
      let uid = await this.indexManager.get('email', trimmedLogin.toLowerCase());
      if (uid) return uid;
      // Также пробуем оригинальный вариант
      uid = await this.indexManager.get('email', trimmedLogin);
      if (uid) return uid;
      
      // Если не нашли в индексе, ищем по personalEmail в профилях администраторов
      // Это нужно для поддержки личных email администраторов
      try {
        const { DB_CONFIG } = await import('../config.js');
        const fs = await import('fs/promises');
        const path = await import('path');
        const { getAdminShardPath } = await import('../utils/paths.js');
        
        const adminsPath = path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.ADMINS);
        const shards = await fs.readdir(adminsPath).catch(() => []);
        
        for (const shard of shards) {
          if (!shard.startsWith('shard_')) continue;
          const shardPath = path.join(adminsPath, shard);
          const users = await fs.readdir(shardPath).catch(() => []);
          
          for (const userDir of users) {
            if (!userDir.startsWith('u_')) continue;
            const uidStr = userDir.substring(2);
            const userId = parseInt(uidStr);
            if (isNaN(userId)) continue;
            
            try {
              const profile = await this.getProfile(userId);
              const main = profile?.main || {};
              if (main.personalEmail && main.personalEmail.toLowerCase() === trimmedLogin.toLowerCase()) {
                return userId;
              }
            } catch (e) {
              continue;
            }
          }
        }
      } catch (e) {
        // Игнорируем ошибки поиска
      }
    }
    
    // Проверяем телефон (должен начинаться с +666)
    if (trimmedLogin.startsWith('+666')) {
      const uid = await this.indexManager.get('phone', trimmedLogin);
      if (uid) return uid;
    }
    
    // Проверяем username
    // Сначала пробуем с оригинальным значением (если есть @ в начале, убираем)
    let usernameToCheck = trimmedLogin;
    if (usernameToCheck.startsWith('@')) {
      usernameToCheck = usernameToCheck.substring(1).trim();
    }
    
    // Пробуем найти username (с разными вариантами регистра)
    let uid = await this.indexManager.get('username', usernameToCheck);
    if (uid) return uid;
    
    uid = await this.indexManager.get('username', usernameToCheck.toLowerCase());
    if (uid) return uid;
    
    // Также пробуем оригинальный вариант с @
    if (trimmedLogin.startsWith('@')) {
      uid = await this.indexManager.get('username', trimmedLogin);
      if (uid) return uid;
    }
    
    return null;
  }

  /**
   * Проверяет существование пользователя
   */
  async exists(uid) {
    const userPath = getUserPath(uid);
    return await exists(path.join(userPath, 'profile', 'main.json'));
  }

  async _readDir(dirPath) {
    return await readDir(dirPath);
  }

}