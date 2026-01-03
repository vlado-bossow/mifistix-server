# 📚 API Документация

## DatabaseManager

### `initialize()`
Инициализирует структуру БД (создаёт все необходимые директории).

```javascript
const db = new DatabaseManager();
await db.initialize();
```

## UserManager

### Создание и управление пользователями

#### `createUser(userData)`
Создаёт нового пользователя со всей структурой папок.

**Параметры:**
- `uid` (number) - уникальный ID пользователя
- `username` (string) - уникальное имя пользователя
- `firstName` (string) - имя
- `lastName` (string) - фамилия
- `phone` (string, optional) - телефон
- `email` (string, optional) - email
- `password` (string) - пароль (будет захеширован)

**Возвращает:** `{ uid, username }`

#### `getProfile(uid)`
Получает полный профиль пользователя.

**Возвращает:** `{ main, avatar, about, counters }`

#### `updateProfile(uid, profileData)`
Обновляет данные профиля.

**Параметры:**
- `profileData.main` - основные данные
- `profileData.avatar` - аватар
- `profileData.about` - информация о себе
- `profileData.counters` - счётчики

### Контент

#### `getContent(uid)`
Получает контент пользователя (посты, медиа, музыка, черновики).

#### `updateContent(uid, contentData)`
Обновляет контент пользователя.

### Отношения (друзья, подписки)

#### `getRelations(uid)`
Получает все отношения пользователя.

**Возвращает:** `{ friends, requests, followers, blocked }`

#### `addFriend(uid, friendUid)`
Добавляет друга.

#### `sendFriendRequest(fromUid, toUid)`
Отправляет заявку в друзья.

#### `acceptFriendRequest(uid, fromUid)`
Принимает заявку в друзья.

### Чаты

#### `getChats(uid)`
Получает все чаты и сообщения пользователя.

**Возвращает:** `{ dialogs, messages }`

#### `updateChats(uid, chatsData)`
Обновляет чаты пользователя.

### Уведомления

#### `getNotifications(uid)`
Получает уведомления пользователя.

**Возвращает:** `{ unread, history }`

#### `addNotification(uid, notification)`
Добавляет уведомление.

### Настройки

#### `getSettings(uid)`
Получает настройки пользователя.

**Возвращает:** `{ privacy, interface, security }`

#### `updateSettings(uid, settingsData)`
Обновляет настройки.

### Система

#### `getSystem(uid)`
Получает системные данные (auth, sessions, logs).

#### `verifyPassword(uid, password)`
Проверяет пароль пользователя.

**Возвращает:** `boolean`

### Поиск

#### `findByLogin(login)`
Ищет пользователя по username/email/phone.

**Возвращает:** `uid` или `null`

#### `exists(uid)`
Проверяет существование пользователя.

**Возвращает:** `boolean`

## PostManager

### `createPost(postData)`
Создаёт новый пост.

**Параметры:**
- `postId` (number) - ID поста
- `authorUid` (number) - ID автора
- `text` (string) - текст поста
- `media` (array, optional) - массив ID медиа
- `createdAt` (number, optional) - timestamp

**Возвращает:** объект поста

### `getPost(postId)`
Получает пост по ID.

### `updatePost(postId, updates)`
Обновляет пост.

### `deletePost(postId)`
Удаляет пост.

### `getPostStats(postId)`
Получает статистику поста (лайки, комментарии, репосты, просмотры).

### `updateStats(postId, statsUpdates)`
Обновляет статистику поста.

### `likePost(postId)`
Добавляет лайк посту.

### `unlikePost(postId)`
Убирает лайк с поста.

### `pinPost(postId, authorUid)`
Закрепляет пост.

### `unpinPost(postId, authorUid)`
Открепляет пост.

## MediaManager

### `createMedia(mediaData)`
Создаёт запись медиа.

**Параметры:**
- `mediaId` (number) - ID медиа
- `userId` (number) - ID пользователя
- `fileName` (string) - имя файла
- `filePath` (string, optional) - путь к исходному файлу для копирования
- `mimeType` (string) - MIME тип
- `size` (number) - размер файла

**Возвращает:** объект метаданных

### `getMedia(mediaId)`
Получает метаданные медиа.

### `getMediaFilePath(mediaId)`
Получает путь к файлу медиа.

### `updateUserAvatar(uid, mediaId)`
Обновляет аватар пользователя.

## IndexManager

### `add(indexName, key, value)`
Добавляет запись в индекс.

### `get(indexName, key)`
Получает значение по ключу.

### `remove(indexName, key)`
Удаляет запись из индекса.

### `exists(indexName, key)`
Проверяет существование ключа.

### `getAll(indexName)`
Получает все записи индекса.

## Структура данных

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

