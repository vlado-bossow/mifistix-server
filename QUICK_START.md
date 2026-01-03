# 🚀 Быстрый старт Mifistix Server

## 📋 Структура проекта

```
ServerMain/
├── DatabaseServer/     # Сервер базы данных (порт 8484)
├── Server/            # Основной сервер (порт 5000)
├── shared/            # Общие модули (конфиг, утилиты, middleware)
├── Subdomains/        # Поддомены
│   ├── api/          # api.mifistix.com (порт 3001)
│   ├── id/           # id.mifistix.com (порт 3002)
│   ├── promo/        # promo.mifistix.com (порт 3003)
│   ├── blog/         # blog.mifistix.com (порт 3004)
│   ├── support/      # support.mifistix.com (порт 3005)
│   ├── test/         # test.mifistix.com (порт 3006)
│   ├── staging/      # staging.mifistix.com (порт 3007)
│   ├── dev/          # dev.mifistix.com (порт 3008)
│   ├── cron/         # cron.mifistix.com (порт 3009)
│   ├── backup/       # backup.mifistix.com (порт 3010)
│   ├── analytics/    # analytics.mifistix.com (порт 3011)
│   └── mail/         # mail.mifistix.com (порт 3012)
├── start-all.bat      # Запуск всех серверов
└── install-all.bat    # Установка всех зависимостей
```

## 🔧 Установка

1. **Установите все зависимости:**
   ```bash
   install-all.bat
   ```

2. **Настройте переменные окружения:**
   
   Создайте файлы `.env` в следующих папках:
   
   - `Subdomains/id/.env`:
     ```
     PORT=3002
     JWT_SECRET=your-secret-key-change-this
     ```
   
   - `Subdomains/api/.env`:
     ```
     PORT=3001
     ```

## 🎯 Запуск

### Запуск всех серверов одновременно:

```bash
start-all.bat
```

Это запустит:
- ✅ DatabaseServer на порту **8484**
- ✅ MainServer на порту **5000**
- ✅ API Subdomain (api.mifistix.com) на порту **3001**
- ✅ ID Subdomain (id.mifistix.com) на порту **3002**
- ✅ Promo Subdomain (promo.mifistix.com) на порту **3003**
- ✅ Blog Subdomain (blog.mifistix.com) на порту **3004**
- ✅ Support Subdomain (support.mifistix.com) на порту **3005**
- ✅ Test Subdomain (test.mifistix.com) на порту **3006**
- ✅ Staging Subdomain (staging.mifistix.com) на порту **3007**
- ✅ Dev Subdomain (dev.mifistix.com) на порту **3008**
- ✅ Cron Subdomain (cron.mifistix.com) на порту **3009**
- ✅ Backup Subdomain (backup.mifistix.com) на порту **3010**
- ✅ Analytics Subdomain (analytics.mifistix.com) на порту **3011**
- ✅ Mail Subdomain (mail.mifistix.com) на порту **3012**

### Запуск отдельного сервера:

```bash
# DatabaseServer
cd DatabaseServer
npm start

# MainServer
cd Server
npm start

# API Subdomain
cd Subdomains/api
npm start

# ID Subdomain
cd Subdomains/id
npm start
```

## 🌐 Эндпоинты

### id.mifistix.com (Identity Server)
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Авторизация
- `GET /api/auth/verify` - Проверка токена

### api.mifistix.com (API Server)
- `GET /api/users/:uid` - Профиль пользователя
- `GET /api/users/:uid/posts` - Посты пользователя
- `GET /api/posts/:postId` - Получить пост
- `GET /api/posts/:postId/stats` - Статистика поста

### promo.mifistix.com (Promo Server)
- `GET /api/campaigns` - Список кампаний
- `GET /api/offers` - Специальные предложения

### blog.mifistix.com (Blog Server)
- `GET /api/posts` - Список постов блога
- `GET /api/posts/:id` - Получить пост блога
- `GET /api/categories` - Категории блога

### support.mifistix.com (Support Server)
- `GET /api/tickets` - Список тикетов
- `POST /api/tickets` - Создать тикет
- `GET /api/faq` - FAQ
- `GET /api/knowledge` - База знаний

### analytics.mifistix.com (Analytics Server)
- `GET /api/stats` - Статистика
- `GET /api/metrics` - Метрики
- `POST /api/events` - Отправить событие

### mail.mifistix.com (Mail Server)
- `POST /api/send` - Отправить письмо
- `GET /api/status` - Статус очереди
- `GET /api/templates` - Шаблоны писем

### DatabaseServer
- Все эндпоинты доступны на `http://localhost:8484/api`

## 📝 Примечания

- Все серверы работают независимо друг от друга
- Поддомены используют общий DatabaseServer для хранения данных
- Каждый сервер запускается в отдельном окне командной строки
- Для остановки закройте все окна или нажмите Ctrl+C в каждом окне

