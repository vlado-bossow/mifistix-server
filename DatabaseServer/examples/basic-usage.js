/**
 * Примеры использования БД
 */
import { DatabaseManager, UserManager, PostManager, MediaManager } from '../src/index.js';

async function examples() {
  console.log('🚀 Запуск примеров...\n');

  // 1. Инициализация БД
  console.log('1️⃣ Инициализация БД...');
  const db = new DatabaseManager();
  await db.initialize();
  console.log('✅ БД инициализирована\n');

  // 2. Создание пользователя
  console.log('2️⃣ Создание пользователя...');
  const userManager = new UserManager();
  
  try {
    const user = await userManager.createUser({
      uid: 1049231,
      username: 'alex.stone',
      firstName: 'Alex',
      lastName: 'Stone',
      phone: '+666(482)91-32',
      email: 'alex@mail.com',
      password: 'secure_password_123'
    });
    console.log('✅ Пользователь создан:', user.username, '(UID:', user.uid, ')\n');
  } catch (error) {
    console.log('⚠️', error.message, '\n');
  }

  // 3. Получение профиля
  console.log('3️⃣ Получение профиля...');
  const profile = await userManager.getProfile(1049231);
  console.log('✅ Профиль:', profile.main?.firstName, profile.main?.lastName);
  console.log('   Username:', profile.main?.username);
  console.log('   Email:', profile.main?.email, '\n');

  // 4. Создание поста
  console.log('4️⃣ Создание поста...');
  const postManager = new PostManager();
  
  const post = await postManager.createPost({
    postId: 9123311,
    authorUid: 1049231,
    text: 'Hello VK-style social network! 🚀'
  });
  console.log('✅ Пост создан:', post.postId);
  console.log('   Текст:', post.text, '\n');

  // 5. Работа с друзьями
  console.log('5️⃣ Работа с друзьями...');
  
  // Создаём второго пользователя для демонстрации
  try {
    await userManager.createUser({
      uid: 1049001,
      username: 'friend.user',
      firstName: 'Friend',
      lastName: 'User',
      email: 'friend@mail.com',
      password: 'password123'
    });
    console.log('✅ Второй пользователь создан');
  } catch (error) {
    console.log('⚠️ Пользователь уже существует');
  }

  // Отправляем заявку в друзья
  await userManager.sendFriendRequest(1049231, 1049001);
  console.log('✅ Заявка в друзья отправлена');

  // Принимаем заявку
  await userManager.acceptFriendRequest(1049001, 1049231);
  console.log('✅ Заявка принята, пользователи теперь друзья\n');

  // 6. Уведомления
  console.log('6️⃣ Работа с уведомлениями...');
  await userManager.addNotification(1049231, {
    type: 'friend_request',
    from: 1049001
  });
  
  await userManager.addNotification(1049231, {
    type: 'like',
    postId: 9123311,
    from: 1049001
  });

  const notifications = await userManager.getNotifications(1049231);
  console.log('✅ Уведомлений:', notifications.unread?.count || 0);
  console.log('   Непрочитанные:', notifications.unread?.items?.length || 0, '\n');

  // 7. Статистика поста
  console.log('7️⃣ Статистика поста...');
  await postManager.likePost(9123311);
  await postManager.likePost(9123311);
  
  const stats = await postManager.getPostStats(9123311);
  console.log('✅ Лайков:', stats.likes);
  console.log('   Комментариев:', stats.comments);
  console.log('   Просмотров:', stats.views, '\n');

  // 8. Поиск пользователя
  console.log('8️⃣ Поиск пользователя...');
  const foundUid = await userManager.findByLogin('alex.stone');
  console.log('✅ Найден UID по username:', foundUid);
  
  const foundByEmail = await userManager.findByLogin('alex@mail.com');
  console.log('✅ Найден UID по email:', foundByEmail, '\n');

  // 9. Обновление настроек
  console.log('9️⃣ Обновление настроек приватности...');
  await userManager.updateSettings(1049231, {
    privacy: {
      profile: 'public',
      messages: 'friends',
      phoneVisible: false
    }
  });
  console.log('✅ Настройки обновлены\n');

  console.log('🎉 Все примеры выполнены!');
}

examples().catch(console.error);

