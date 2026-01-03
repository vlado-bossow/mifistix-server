/**
 * Конфигурация базы данных
 */
export const DB_CONFIG = {
  // Корневая директория БД
  ROOT_PATH: 'E:\\SOCIAL_DB',
  
  // Пути к основным разделам
  PATHS: {
    USERS: 'users',
    MEDIA: 'media',
    POSTS: 'posts',
    SYSTEM: 'system',
    INDEXES: 'indexes'
  },
  
  // Настройки шардирования
  SHARDING: {
    // Количество символов в названии шарда (shard_000, shard_091)
    SHARD_DIGITS: 3,
    // Количество шардов (для вычисления номера шарда: uid % SHARD_COUNT)
    SHARD_COUNT: 1000,
    // Формат шарда: shard_XXX
    SHARD_PREFIX: 'shard_'
  },
  
  // Форматы ID
  FORMATS: {
    USER_PREFIX: 'u_',
    POST_PREFIX: 'p_',
    MEDIA_PREFIX: 'm_',
    DIALOG_PREFIX: 'd_'
  }
} as const;

