import { readJson, writeJson } from '../utils/fs.js';
import { getUserPath } from '../utils/paths.js';
import path from 'path';

/**
 * Менеджер уведомлений и запросов в друзья
 */
export class NotificationsManager {
  constructor(userManager) {
    this.userManager = userManager;
  }

  /**
   * Добавляет уведомление пользователю
   */
  async addNotification(uid, notification) {
    try {
      const notifications = await this.getNotifications(uid);
      const unread = notifications.unread || { count: 0, items: [] };
      
      // Если items не существует, создаем его
      if (!Array.isArray(unread.items)) {
        unread.items = [];
      }
      
      const newNotification = {
        id: Date.now(),
        ...notification,
        createdAt: Math.floor(Date.now() / 1000),
        read: false
      };
      
      // Проверяем, нет ли уже такого уведомления (например, для запросов в друзья)
      const existingIndex = unread.items.findIndex(item => 
        item.type === notification.type && 
        item.from === notification.from
      );
      
      if (existingIndex !== -1) {
        // Обновляем существующее уведомление
        unread.items[existingIndex] = newNotification;
      } else {
        // Добавляем новое
        unread.items.push(newNotification);
      }
      
      unread.count = unread.items.length;
      
      await this.updateNotifications(uid, { unread });
      return newNotification;
    } catch (error) {
      console.error(`Ошибка при добавлении уведомления для пользователя ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Получает уведомления пользователя
   */
  async getNotifications(uid) {
    const userPath = getUserPath(uid);
    const unreadPath = path.join(userPath, 'notifications', 'unread.json');
    const historyPath = path.join(userPath, 'notifications', 'history.json');
    
    try {
      let unread, history;
      
      try {
        unread = await readJson(unreadPath);
      } catch (error) {
        // Если файл не существует, создаем пустую структуру
        unread = { count: 0, items: [] };
        await writeJson(unreadPath, unread);
      }
      
      try {
        history = await readJson(historyPath);
      } catch (error) {
        // Если файл не существует, создаем пустой массив
        history = [];
        await writeJson(historyPath, history);
      }

      return { 
        unread: unread || { count: 0, items: [] }, 
        history: history || [] 
      };
    } catch (error) {
      console.error(`Ошибка при получении уведомлений для пользователя ${uid}:`, error);
      return { unread: { count: 0, items: [] }, history: [] };
    }
  }

  /**
   * Обновляет уведомления
   */
  async updateNotifications(uid, notificationsData) {
    const { ensureDir } = await import('../utils/fs.js');
    const userPath = getUserPath(uid);
    const notificationsPath = path.join(userPath, 'notifications');
    
    // Убеждаемся, что директория существует
    await ensureDir(notificationsPath);
    
    if (notificationsData.unread !== undefined) {
      const unreadPath = path.join(notificationsPath, 'unread.json');
      try {
        await writeJson(unreadPath, notificationsData.unread);
        console.log(`[NotificationsManager] Уведомления сохранены для пользователя ${uid}:`, {
          count: notificationsData.unread.count,
          itemsCount: notificationsData.unread.items?.length || 0
        });
      } catch (error) {
        console.error(`[NotificationsManager] Ошибка сохранения unread.json для пользователя ${uid}:`, error);
        throw error;
      }
    }
    if (notificationsData.history !== undefined) {
      const historyPath = path.join(notificationsPath, 'history.json');
      try {
        await writeJson(historyPath, notificationsData.history);
      } catch (error) {
        console.error(`[NotificationsManager] Ошибка сохранения history.json для пользователя ${uid}:`, error);
        throw error;
      }
    }
  }

  /**
   * Отправляет запрос в друзья с уведомлением
   */
  async sendFriendRequest(fromUid, toUid) {
    // Отправляем запрос через UserManager
    await this.userManager.sendFriendRequest(fromUid, toUid);
    
    // Получаем профиль отправителя для уведомления
    const fromProfile = await this.userManager.getProfile(fromUid);
    const fromName = fromProfile.main?.firstName && fromProfile.main?.lastName
      ? `${fromProfile.main.firstName} ${fromProfile.main.lastName}`
      : fromProfile.main?.username || 'Пользователь';
    
    // Создаем уведомление для получателя
    await this.addNotification(toUid, {
      type: 'friend_request',
      from: fromUid,
      fromName: fromName,
      fromUsername: fromProfile.main?.username || '',
      message: `${fromName} отправил вам запрос в друзья`
    });
    
    return { success: true };
  }

  /**
   * Принимает запрос в друзья с уведомлениями
   */
  async acceptFriendRequest(uid, fromUid) {
    // Принимаем запрос через UserManager
    await this.userManager.acceptFriendRequest(uid, fromUid);
    
    // Получаем профили для уведомлений
    const accepterProfile = await this.userManager.getProfile(uid);
    const requesterProfile = await this.userManager.getProfile(fromUid);
    
    const accepterName = accepterProfile.main?.firstName && accepterProfile.main?.lastName
      ? `${accepterProfile.main.firstName} ${accepterProfile.main.lastName}`
      : accepterProfile.main?.username || 'Пользователь';
    
    // Уведомляем отправителя о принятии запроса
    await this.addNotification(fromUid, {
      type: 'friend_accepted',
      from: uid,
      fromName: accepterName,
      fromUsername: accepterProfile.main?.username || '',
      message: `${accepterName} принял ваш запрос в друзья`
    });
    
    // Удаляем уведомление о запросе у принявшего
    await this.removeNotificationByType(uid, 'friend_request', fromUid);
    
    return { success: true };
  }

  /**
   * Отклоняет запрос в друзья
   */
  async declineFriendRequest(uid, fromUid) {
    // Убираем из входящих запросов
    const relations = await this.userManager.getRelations(uid);
    const requests = relations.requests || { incoming: [], outgoing: [] };
    requests.incoming = requests.incoming.filter(id => id !== fromUid);
    await this.userManager.updateRelations(uid, { requests });
    
    // Убираем из исходящих у отправителя
    const fromRelations = await this.userManager.getRelations(fromUid);
    const fromRequests = fromRelations.requests || { incoming: [], outgoing: [] };
    fromRequests.outgoing = fromRequests.outgoing.filter(id => id !== uid);
    await this.userManager.updateRelations(fromUid, { requests: fromRequests });
    
    // Удаляем уведомление
    await this.removeNotificationByType(uid, 'friend_request', fromUid);
    
    return { success: true };
  }

  /**
   * Удаляет уведомление по типу и отправителю
   */
  async removeNotificationByType(uid, type, fromUid) {
    try {
      const notifications = await this.getNotifications(uid);
      const unread = notifications.unread || { count: 0, items: [] };
      
      if (!Array.isArray(unread.items)) {
        unread.items = [];
      }
      
      unread.items = unread.items.filter(item => 
        !(item.type === type && item.from === fromUid)
      );
      unread.count = unread.items.length;
      
      await this.updateNotifications(uid, { unread });
    } catch (error) {
      console.error(`Ошибка при удалении уведомления для пользователя ${uid}:`, error);
    }
  }

  /**
   * Отмечает уведомление как прочитанное
   */
  async markAsRead(uid, notificationId) {
    try {
      const notifications = await this.getNotifications(uid);
      const unread = notifications.unread || { count: 0, items: [] };
      const history = notifications.history || [];
      
      if (!Array.isArray(unread.items)) {
        unread.items = [];
      }
      if (!Array.isArray(history)) {
        history = [];
      }
      
      const notificationIndex = unread.items.findIndex(item => item.id === notificationId);
      if (notificationIndex !== -1) {
        const notification = unread.items[notificationIndex];
        notification.read = true;
        
        // Перемещаем в историю
        history.unshift(notification);
        unread.items.splice(notificationIndex, 1);
        unread.count = unread.items.length;
        
        // Ограничиваем историю последними 100 элементами
        if (history.length > 100) {
          history.splice(100);
        }
        
        await this.updateNotifications(uid, { unread, history });
      }
    } catch (error) {
      console.error(`Ошибка при отметке уведомления как прочитанного для пользователя ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Отмечает все уведомления как прочитанные
   */
  async markAllAsRead(uid) {
    try {
      const notifications = await this.getNotifications(uid);
      const unread = notifications.unread || { count: 0, items: [] };
      const history = notifications.history || [];
      
      if (!Array.isArray(unread.items)) {
        unread.items = [];
      }
      if (!Array.isArray(history)) {
        history = [];
      }
      
      // Помечаем все как прочитанные и перемещаем в историю
      unread.items.forEach(item => {
        item.read = true;
        history.unshift(item);
      });
      
      // Ограничиваем историю
      if (history.length > 100) {
        history.splice(100);
      }
      
      await this.updateNotifications(uid, {
        unread: { count: 0, items: [] },
        history
      });
    } catch (error) {
      console.error(`Ошибка при отметке всех уведомлений как прочитанных для пользователя ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Получает список запросов в друзья с профилями
   */
  async getFriendRequests(uid) {
    const relations = await this.userManager.getRelations(uid);
    const requests = relations.requests || { incoming: [], outgoing: [] };
    
    // Загружаем профили для входящих запросов
    const incomingProfiles = await Promise.all(
      requests.incoming.map(async (requestUid) => {
        try {
          const profile = await this.userManager.getProfile(requestUid);
          return {
            uid: requestUid,
            firstName: profile.main?.firstName || '',
            lastName: profile.main?.lastName || '',
            username: profile.main?.username || '',
            avatar: profile.avatar?.url || null,
            name: profile.main?.firstName && profile.main?.lastName
              ? `${profile.main.firstName} ${profile.main.lastName}`
              : profile.main?.username || 'Пользователь'
          };
        } catch (error) {
          console.error(`Ошибка загрузки профиля ${requestUid}:`, error);
          return null;
        }
      })
    );
    
    // Загружаем профили для исходящих запросов
    const outgoingProfiles = await Promise.all(
      requests.outgoing.map(async (requestUid) => {
        try {
          const profile = await this.userManager.getProfile(requestUid);
          return {
            uid: requestUid,
            firstName: profile.main?.firstName || '',
            lastName: profile.main?.lastName || '',
            username: profile.main?.username || '',
            avatar: profile.avatar?.url || null,
            name: profile.main?.firstName && profile.main?.lastName
              ? `${profile.main.firstName} ${profile.main.lastName}`
              : profile.main?.username || 'Пользователь'
          };
        } catch (error) {
          console.error(`Ошибка загрузки профиля ${requestUid}:`, error);
          return null;
        }
      })
    );
    
    return {
      incoming: incomingProfiles.filter(p => p !== null),
      outgoing: outgoingProfiles.filter(p => p !== null)
    };
  }
}

