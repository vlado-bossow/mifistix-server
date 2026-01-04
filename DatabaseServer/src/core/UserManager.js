import { ensureDir, readJson, writeJson, exists, readDir } from '../utils/fs.js';
import { getUserPath, getUserShardPath, getAdminPath, getAdminShardPath, getUsernameFilePath } from '../utils/paths.js';
import path from 'path';
import bcrypt from 'bcrypt';
import { IndexManager } from './IndexManager.js';

/**
 * Менеджер пользователей
 */
export class UserManager {
  constructor() {
    this.indexManager = new IndexManager();
  }

  async isAdmin(uid) {
    try {
      const adminPath = getAdminPath(uid);
      if (await exists(path.join(adminPath, 'profile', 'main.json'))) {
        const adminProfile = await readJson(path.join(adminPath, 'profile', 'main.json'));
        return adminProfile.role === 'admin' || adminProfile.role === 'superadmin';
      }
      
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

  async getUserPath(uid) {
    const isAdminUser = await this.isAdmin(uid);
    return isAdminUser ? getAdminPath(uid) : getUserPath(uid);
  }

  async createUserStructure(uid, isAdmin = false) {
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

    await ensureDir(shardPath);
    for (const dir of dirs) {
      await ensureDir(dir);
    }
    return true;
  }

  async getProfile(uid) {
    const userPath = await this.getUserPath(uid);
    const main = await readJson(path.join(userPath, 'profile', 'main.json'));
    const avatar = await readJson(path.join(userPath, 'profile', 'avatar.json'));
    const about = await readJson(path.join(userPath, 'profile', 'about.json'));
    const counters = await readJson(path.join(userPath, 'profile', 'counters.json'));
    
    return { main, avatar, about, counters };
  }

  async updateProfile(uid, profileData) {
    const userPath = await this.getUserPath(uid);
    
    if (profileData.main) {
      await writeJson(path.join(userPath, 'profile', 'main.json'), profileData.main);
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

  async getContent(uid) {
    const userPath = getUserPath(uid);
    
    const posts = await readJson(path.join(userPath, 'content', 'posts.json'));
    const media = await readJson(path.join(userPath, 'content', 'media.json'));
    const music = await readJson(path.join(userPath, 'content', 'music.json'));
    const drafts = await readJson(path.join(userPath, 'content', 'drafts.json'));

    return { posts, media, music, drafts };
  }

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

  async createUser(userData) {
    // Базовая реализация - добавьте свою логику
    const { uid, username, email, password } = userData;
    
    // Проверяем уникальность
    if (await this.indexManager.exists('username', username)) {
      throw new Error(`Username ${username} already exists`);
    }
    
    // Создаем структуру
    const isAdmin = email && email.includes('@adm.mifistix');
    await this.createUserStructure(uid, isAdmin);
    
    // Сохраняем профиль
    const now = Math.floor(Date.now() / 1000);
    await this.updateProfile(uid, {
      main: {
        uid,
        username,
        email: email || '',
        role: isAdmin ? 'admin' : 'user',
        createdAt: now,
        lastOnline: now,
        status: 'active'
      }
    });
    
    // Сохраняем пароль
    const passwordHash = await bcrypt.hash(password, 10);
    const userPath = await this.getUserPath(uid);
    await writeJson(path.join(userPath, 'system', 'auth.json'), {
      passwordHash,
      lastChange: now
    });
    
    // Обновляем индексы
    await this.indexManager.add('username', username.toLowerCase(), uid);
    if (email) {
      await this.indexManager.add('email', email.toLowerCase(), uid);
    }
    
    return { uid, username };
  }

  async findByLogin(login) {
    if (!login || typeof login !== 'string') {
      return null;
    }
    
    const trimmedLogin = login.trim();
    
    // Ищем по email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmedLogin)) {
      const uid = await this.indexManager.get('email', trimmedLogin.toLowerCase());
      if (uid) return uid;
    }
    
    // Ищем по username
    let usernameToCheck = trimmedLogin;
    if (usernameToCheck.startsWith('@')) {
      usernameToCheck = usernameToCheck.substring(1).trim();
    }
    
    let uid = await this.indexManager.get('username', usernameToCheck);
    if (uid) return uid;
    
    uid = await this.indexManager.get('username', usernameToCheck.toLowerCase());
    if (uid) return uid;
    
    return null;
  }

  async getSettings(uid) {
    const userPath = getUserPath(uid);
    
    const privacy = await readJson(path.join(userPath, 'settings', 'privacy.json'));
    const interface_ = await readJson(path.join(userPath, 'settings', 'interface.json'));
    const security = await readJson(path.join(userPath, 'settings', 'security.json'));

    return { privacy, interface: interface_, security };
  }

  async verifyPassword(uid, password) {
    const userPath = await this.getUserPath(uid);
    const authPath = path.join(userPath, 'system', 'auth.json');
    
    if (!await exists(authPath)) {
      return false;
    }
    
    const auth = await readJson(authPath);
    return await bcrypt.compare(password, auth.passwordHash);
  }
}