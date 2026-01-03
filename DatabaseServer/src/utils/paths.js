import path from 'path';
import { fileURLToPath } from 'url';
import { DB_CONFIG } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Вычисляет номер шарда для ID
 */
export function getShardNumber(id) {
  return id % DB_CONFIG.SHARDING.SHARD_COUNT;
}

/**
 * Форматирует название шарда (shard_000, shard_091)
 */
export function formatShardName(shardNumber) {
  return `${DB_CONFIG.SHARDING.SHARD_PREFIX}${String(shardNumber).padStart(DB_CONFIG.SHARDING.SHARD_DIGITS, '0')}`;
}

/**
 * Получает путь к шарду пользователя
 */
export function getUserShardPath(uid) {
  const shardNumber = getShardNumber(uid);
  const shardName = formatShardName(shardNumber);
  return path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.USERS, shardName);
}

/**
 * Получает путь к папке пользователя
 */
export function getUserPath(uid) {
  const shardPath = getUserShardPath(uid);
  return path.join(shardPath, `${DB_CONFIG.FORMATS.USER_PREFIX}${uid}`);
}

/**
 * Получает путь к шарду администратора
 */
export function getAdminShardPath(uid) {
  const shardNumber = getShardNumber(uid);
  const shardName = formatShardName(shardNumber);
  return path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.ADMINS, shardName);
}

/**
 * Получает путь к папке администратора
 */
export function getAdminPath(uid) {
  const shardPath = getAdminShardPath(uid);
  return path.join(shardPath, `${DB_CONFIG.FORMATS.USER_PREFIX}${uid}`);
}

/**
 * Получает путь к шарду поста
 */
export function getPostShardPath(postId) {
  const shardNumber = getShardNumber(postId);
  const shardName = formatShardName(shardNumber);
  return path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.POSTS, shardName);
}

/**
 * Получает путь к папке поста
 */
export function getPostPath(postId) {
  const shardPath = getPostShardPath(postId);
  return path.join(shardPath, `${DB_CONFIG.FORMATS.POST_PREFIX}${postId}`);
}

/**
 * Получает путь к шарду медиа
 */
export function getMediaShardPath(mediaId) {
  const shardNumber = getShardNumber(mediaId);
  const shardName = formatShardName(shardNumber);
  return path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.MEDIA, shardName);
}

/**
 * Получает путь к папке медиа
 */
export function getMediaPath(mediaId) {
  const shardPath = getMediaShardPath(mediaId);
  return path.join(shardPath, `${DB_CONFIG.FORMATS.MEDIA_PREFIX}${mediaId}`);
}

/**
 * Получает путь к индексам
 */
export function getIndexPath(indexName) {
  return path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.INDEXES, `${indexName}.json`);
}

/**
 * Папка username в структуре DatabaseServer
 * Здесь храним айди профиля по username (по одному файлу на username)
 */
export function getUsernameDir() {
  return path.join(DB_CONFIG.ROOT_PATH, DB_CONFIG.PATHS.INDEXES, 'username');
}

export function getUsernameFilePath(username) {
  return path.join(getUsernameDir(), `${username}.json`);
}

