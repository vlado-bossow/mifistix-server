/**
 * Расширенные примеры: чаты и медиа
 */
import { DatabaseManager, UserManager, MediaManager } from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function chatAndMediaExamples() {
  console.log('💬 Примеры работы с чатами и медиа...\n');

  // Инициализация
  const db = new DatabaseManager();
  await db.initialize();

  const userManager = new UserManager();
  const mediaManager = new MediaManager();

  // Создаём пользователей для чата
  const user1 = 1049231;
  const user2 = 1049001;

  try {
    await userManager.createUser({
      uid: user1,
      username: 'alex.stone',
      firstName: 'Alex',
      lastName: 'Stone',
      email: 'alex@mail.com',
      password: 'password123'
    });
  } catch (e) {}

  try {
    await userManager.createUser({
      uid: user2,
      username: 'friend.user',
      firstName: 'Friend',
      lastName: 'User',
      email: 'friend@mail.com',
      password: 'password123'
    });
  } catch (e) {}

  // 1. Создание диалога
  console.log('1️⃣ Создание диалога...');
  const dialogId = 7712;
  
  // Добавляем диалог обоим пользователям
  await userManager.updateChats(user1, {
    dialogs: { dialogs: [dialogId] }
  });
  
  await userManager.updateChats(user2, {
    dialogs: { dialogs: [dialogId] }
  });
  console.log('✅ Диалог создан:', dialogId, '\n');

  // 2. Отправка сообщений
  console.log('2️⃣ Отправка сообщений...');
  
  const messages1 = {
    dialogId,
    messages: [
      {
        messageId: 1,
        from: user1,
        text: 'Привет! Как дела?',
        timestamp: Math.floor(Date.now() / 1000)
      },
      {
        messageId: 2,
        from: user2,
        text: 'Привет! Всё отлично, спасибо!',
        timestamp: Math.floor(Date.now() / 1000) + 10
      },
      {
        messageId: 3,
        from: user1,
        text: 'Отлично! Давай встретимся?',
        timestamp: Math.floor(Date.now() / 1000) + 30
      }
    ]
  };

  await userManager.updateChats(user1, {
    messages: { [dialogId]: messages1 }
  });
  
  await userManager.updateChats(user2, {
    messages: { [dialogId]: messages1 }
  });
  console.log('✅ Сообщения отправлены:', messages1.messages.length, '\n');

  // 3. Получение чатов
  console.log('3️⃣ Получение чатов...');
  const chats1 = await userManager.getChats(user1);
  console.log('✅ Диалогов у пользователя', user1 + ':', chats1.dialogs?.dialogs?.length || 0);
  console.log('   Сообщений в диалоге', dialogId + ':', chats1.messages[dialogId]?.messages?.length || 0, '\n');

  // 4. Работа с медиа
  console.log('4️⃣ Работа с медиа...');
  
  // Создаём тестовый файл (в реальности это будет загруженный файл)
  const testMediaPath = path.join(__dirname, 'test-avatar.txt');
  await fs.writeFile(testMediaPath, 'Test media content', 'utf-8');

  const media = await mediaManager.createMedia({
    mediaId: 33129991,
    userId: user1,
    fileName: 'avatar.jpg',
    filePath: testMediaPath,
    mimeType: 'image/jpeg',
    size: 1024000
  });
  
  console.log('✅ Медиа создано:', media.mediaId);
  console.log('   Файл:', media.fileName);
  console.log('   MIME:', media.mimeType, '\n');

  // 5. Обновление аватара
  console.log('5️⃣ Обновление аватара...');
  await mediaManager.updateUserAvatar(user1, 33129991);
  console.log('✅ Аватар обновлён\n');

  // Проверяем профиль
  const profile = await userManager.getProfile(user1);
  console.log('   Аватар в профиле:', profile.avatar?.mediaId, '\n');

  // Удаляем тестовый файл
  await fs.unlink(testMediaPath).catch(() => {});

  console.log('🎉 Все примеры с чатами и медиа выполнены!');
}

chatAndMediaExamples().catch(console.error);

