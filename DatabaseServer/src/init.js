/**
 * Скрипт инициализации БД
 * Создаёт только структуру директорий, без демо-данных
 */
import { DatabaseManager } from './index.js';

async function init() {
  console.log('🚀 Инициализация структуры БД...\n');
  
  const db = new DatabaseManager();
  await db.initialize();
  
  console.log('\n✅ Структура БД готова!');
}

init().catch(console.error);

