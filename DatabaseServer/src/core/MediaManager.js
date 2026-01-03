import { ensureDir, readJson, writeJson, exists } from '../utils/fs.js';
import { getMediaPath, getMediaShardPath } from '../utils/paths.js';
import path from 'path';
import fs from 'fs/promises';
import { UserManager } from './UserManager.js';

/**
 * Менеджер медиа
 */
export class MediaManager {
  constructor() {
    this.userManager = new UserManager();
  }

  /**
   * Создаёт медиа запись
   */
  async createMedia(mediaData) {
    const { mediaId, userId, fileName, filePath, mimeType, size } = mediaData;

    // Создаём структуру
    const mediaPath = getMediaPath(mediaId);
    const shardPath = getMediaShardPath(mediaId);
    await ensureDir(shardPath);
    await ensureDir(mediaPath);

    // Копируем файл, если указан
    if (filePath) {
      const destFilePath = path.join(mediaPath, fileName || `file.${this.getExtension(mimeType)}`);
      await fs.copyFile(filePath, destFilePath);
    }

    // Сохраняем метаданные
    const now = Math.floor(Date.now() / 1000);
    const meta = {
      mediaId,
      userId,
      fileName: fileName || 'file',
      mimeType: mimeType || 'application/octet-stream',
      size: size || 0,
      createdAt: now,
      updatedAt: now
    };

    await writeJson(path.join(mediaPath, 'meta.json'), meta);

    // Обновляем список медиа пользователя
    const userContent = await this.userManager.getContent(userId);
    const mediaList = userContent.media || [];
    
    if (!mediaList.includes(mediaId)) {
      mediaList.push(mediaId);
      await this.userManager.updateContent(userId, { media: mediaList });
    }

    return meta;
  }

  /**
   * Получает метаданные медиа
   */
  async getMedia(mediaId) {
    const mediaPath = getMediaPath(mediaId);
    const meta = await readJson(path.join(mediaPath, 'meta.json'));
    return meta;
  }

  /**
   * Получает путь к файлу медиа
   */
  async getMediaFilePath(mediaId) {
    const mediaPath = getMediaPath(mediaId);
    const meta = await this.getMedia(mediaId);
    if (!meta) {
      return null;
    }

    // Ищем файл в директории медиа
    const files = await fs.readdir(mediaPath);
    const file = files.find(f => f !== 'meta.json');
    
    return file ? path.join(mediaPath, file) : null;
  }

  /**
   * Обновляет аватар пользователя
   */
  async updateUserAvatar(uid, mediaId) {
    const now = Math.floor(Date.now() / 1000);
    await this.userManager.updateProfile(uid, {
      avatar: {
        mediaId,
        updatedAt: now
      }
    });
  }

  /**
   * Получает расширение файла из MIME типа
   */
  getExtension(mimeType) {
    const mimeMap = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg'
    };
    return mimeMap[mimeType] || 'bin';
  }
}

