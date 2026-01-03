# 🗄️ Social Database Server

Файловая база данных для социальной сети в стиле ВКонтакте.

## 📁 Структура БД

```
E:\SOCIAL_DB\
├── users\          # Пользователи (шардирование)
│   └── shard_XXX\
│       └── u_UID\
│           ├── profile\
│           ├── content\
│           ├── relations\
│           ├── chats\
│           ├── notifications\
│           ├── settings\
│           └── system\
├── media\          # Медиафайлы
├── posts\          # Посты
├── system\         # Системные файлы
└── indexes\        # Индексы для поиска
```

## 🔧 Установка

```bash
npm install
```

## 🚀 Использование

### Инициализация БД

```javascript
import { DatabaseManager } from './src/index.js';

const db = new DatabaseManager();
await db.initialize();
```

### Создание пользователя

```javascript
import { UserManager } from './src/index.js';

const userManager = new UserManager();

const user = await userManager.createUser({
  uid: 1049231,
  username: 'alex.stone',
  firstName: 'Alex',
  lastName: 'Stone',
  phone: '+666(482)91-32',
  email: 'alex@mail.com',
  password: 'secure_password'
});
```

### Работа с профилем

```javascript
// Получить профиль
const profile = await userManager.getProfile(1049231);

// Обновить профиль
await userManager.updateProfile(1049231, {
  main: {
    firstName: 'Alexander',
    lastName: 'Stone',
    username: 'alex.stone'
  },
  counters: {
    friends: 10,
    followers: 100,
    following: 50,
    posts: 5
  }
});
```

### Работа с постами

```javascript
import { PostManager } from './src/index.js';

const postManager = new PostManager();

// Создать пост
const post = await postManager.createPost({
  postId: 9123311,
  authorUid: 1049231,
  text: 'Hello VK-style!',
  media: [33129991]
});

// Получить пост
const postData = await postManager.getPost(9123311);

// Лайкнуть
await postManager.likePost(9123311);
```

### Работа с друзьями

```javascript
// Отправить заявку в друзья
await userManager.sendFriendRequest(1049231, 1049001);

// Принять заявку
await userManager.acceptFriendRequest(1049231, 1049001);

// Получить отношения
const relations = await userManager.getRelations(1049231);
```

### Работа с медиа

```javascript
import { MediaManager } from './src/index.js';

const mediaManager = new MediaManager();

// Создать медиа
const media = await mediaManager.createMedia({
  mediaId: 33129991,
  userId: 1049231,
  fileName: 'avatar.jpg',
  filePath: '/path/to/file.jpg',
  mimeType: 'image/jpeg',
  size: 1024000
});

// Обновить аватар
await mediaManager.updateUserAvatar(1049231, 33129991);
```

### Уведомления

```javascript
// Добавить уведомление
await userManager.addNotification(1049231, {
  type: 'friend_request',
  from: 1049333
});

// Получить уведомления
const notifications = await userManager.getNotifications(1049231);
```

### Поиск пользователя

```javascript
// Поиск по username/email/phone
const uid = await userManager.findByLogin('alex.stone');
const uidByEmail = await userManager.findByLogin('alex@mail.com');
```

## 📝 Форматы данных

### profile/main.json
```json
{
  "uid": 1049231,
  "firstName": "Alex",
  "lastName": "Stone",
  "username": "alex.stone",
  "phone": "+666(482)91-32",
  "email": "alex@mail.com",
  "verified": false,
  "createdAt": 1734450000,
  "lastOnline": 1734459999
}
```

### content/posts.json
```json
{
  "created": [9123311, 9123309],
  "pinned": [9123311]
}
```

### relations/friends.json
```json
{
  "friends": [1049001, 1049002]
}
```

### relations/requests.json
```json
{
  "incoming": [1049333],
  "outgoing": [1049444]
}
```

### chats/dialogs.json
```json
{
  "dialogs": [7712, 8891]
}
```

### notifications/unread.json
```json
{
  "count": 3,
  "items": [
    { "type": "friend_request", "from": 1049333 },
    { "type": "like", "postId": 9123311 }
  ]
}
```

### settings/privacy.json
```json
{
  "profile": "public",
  "messages": "friends",
  "phoneVisible": false
}
```

### system/auth.json
```json
{
  "passwordHash": "bcrypt_hash",
  "lastChange": 1734400000
}
```

## 🔐 Безопасность

- Пароли хешируются с помощью bcrypt
- Все данные пользователя изолированы в его папке
- Системные данные (auth, sessions) хранятся отдельно

## 📊 Шардирование

Автоматическое шардирование по ID:
- Пользователи: `shard_XXX/u_UID`
- Посты: `shard_XXX/p_POSTID`
- Медиа: `shard_XXX/m_MEDIAID`

Формула: `shardNumber = id % 1000`

## 🎯 Особенности

✅ **Единая структура** - все данные пользователя в одной папке  
✅ **Автоматическое шардирование** - распределение по шардам  
✅ **Быстрые индексы** - поиск по username/phone/email  
✅ **Изолированные данные** - каждый пользователь = одна папка  
✅ **Типизированные структуры** - четкие форматы JSON  

## 📦 Зависимости

- `bcrypt` - хеширование паролей

## 🔄 Запуск примера

```bash
npm start
```

