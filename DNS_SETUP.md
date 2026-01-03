# 🌐 Настройка DNS для mifistix.pl

## 📋 Команды для добавления DNS записей

### Через Cloudflare Dashboard (Рекомендуется)

1. Войдите в [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Выберите домен `mifistix.pl`
3. Перейдите в **DNS** → **Records**
4. Нажмите **Add record**

### Через Cloudflare API

#### Windows (PowerShell):
```powershell
# Установите переменные
$env:CF_API_EMAIL="your-email@example.com"
$env:CF_API_KEY="your-api-key"
$env:CF_ZONE_ID="your-zone-id"
$env:SERVER_IP="your-server-ip"

# Запустите скрипт
cd cloudflare
.\add-dns-records.ps1
```

#### Linux/Mac:
```bash
# Установите переменные
export CF_API_EMAIL="your-email@example.com"
export CF_API_KEY="your-api-key"
export CF_ZONE_ID="your-zone-id"
export SERVER_IP="your-server-ip"

# Запустите скрипт
cd cloudflare
chmod +x add-dns-records.sh
./add-dns-records.sh
```

## 📝 Список всех DNS записей

### Основной домен
```
Тип: A
Имя: @
IPv4: [ВАШ_IP]
Прокси: ✅
```

### Поддомены

```
api.mifistix.pl      → A → [ВАШ_IP] → Прокси: ✅
id.mifistix.pl       → A → [ВАШ_IP] → Прокси: ✅
promo.mifistix.pl    → A → [ВАШ_IP] → Прокси: ✅
blog.mifistix.pl     → A → [ВАШ_IP] → Прокси: ✅
support.mifistix.pl  → A → [ВАШ_IP] → Прокси: ✅
test.mifistix.pl     → A → [ВАШ_IP] → Прокси: ❌
staging.mifistix.pl  → A → [ВАШ_IP] → Прокси: ✅
dev.mifistix.pl      → A → [ВАШ_IP] → Прокси: ❌
cron.mifistix.pl     → A → [ВАШ_IP] → Прокси: ❌
backup.mifistix.pl   → A → [ВАШ_IP] → Прокси: ❌
analytics.mifistix.pl → A → [ВАШ_IP] → Прокси: ✅
mail.mifistix.pl     → A → [ВАШ_IP] → Прокси: ❌
```

## 🔧 Получение API ключей

1. Войдите в [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **My Profile** → **API Tokens**
3. **Create Token** → Используйте шаблон **Edit zone DNS**
4. Скопируйте токен

## 🔍 Получение Zone ID

1. В Cloudflare Dashboard выберите домен `mifistix.pl`
2. В правой колонке найдите **Zone ID**
3. Скопируйте его

## ⚡ Быстрая команда (curl)

```bash
# Добавить одну запись
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/dns_records" \
  -H "X-Auth-Email: YOUR_EMAIL" \
  -H "X-Auth-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "api",
    "content": "YOUR_SERVER_IP",
    "ttl": 1,
    "proxied": true
  }'
```

## 📚 Дополнительная информация

См. `cloudflare/README.md` для подробной документации.

