import { ensureDir, readJson, writeJson, exists } from '../utils/fs.js';
import { getPostPath, getPostShardPath } from '../utils/paths.js';
import path from 'path';
import { UserManager } from './UserManager.js';

/**
 * Менеджер постов
 */
export class PostManager {
  constructor() {
    this.userManager = new UserManager();
  }

  /**
   * Создаёт пост
   */
  async createPost(postData) {
    const { postId, authorUid, text, media = [], createdAt } = postData;

    // Создаём структуру
    const postPath = getPostPath(postId);
    const shardPath = getPostShardPath(postId);
    await ensureDir(shardPath);
    await ensureDir(postPath);

    const now = Math.floor(Date.now() / 1000);

    // Сохраняем пост
    const post = {
      postId,
      authorUid,
      text: text || '',
      media,
      createdAt: createdAt || now,
      updatedAt: now
    };

    await writeJson(path.join(postPath, 'post.json'), post);

    // Сохраняем статистику
    const stats = {
      likes: 0,
      comments: 0,
      reposts: 0,
      views: 0
    };
    await writeJson(path.join(postPath, 'stats.json'), stats);

    // Обновляем список постов пользователя
    const userContent = await this.userManager.getContent(authorUid);
    const posts = userContent.posts || { created: [], pinned: [] };
    
    if (!posts.created.includes(postId)) {
      posts.created.push(postId);
    }
    
    await this.userManager.updateContent(authorUid, { posts });

    // Увеличиваем счётчик постов
    const profile = await this.userManager.getProfile(authorUid);
    const counters = profile.counters || { posts: 0 };
    counters.posts = (counters.posts || 0) + 1;
    await this.userManager.updateProfile(authorUid, { counters });

    return post;
  }

  /**
   * Получает пост
   */
  async getPost(postId) {
    const postPath = getPostPath(postId);
    const post = await readJson(path.join(postPath, 'post.json'));
    return post;
  }

  /**
   * Получает статистику поста
   */
  async getPostStats(postId) {
    const postPath = getPostPath(postId);
    const stats = await readJson(path.join(postPath, 'stats.json'));
    return stats;
  }

  /**
   * Обновляет пост
   */
  async updatePost(postId, updates) {
    const post = await this.getPost(postId);
    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    const updatedPost = {
      ...post,
      ...updates,
      updatedAt: Math.floor(Date.now() / 1000)
    };

    const postPath = getPostPath(postId);
    await writeJson(path.join(postPath, 'post.json'), updatedPost);

    return updatedPost;
  }

  /**
   * Удаляет пост
   */
  async deletePost(postId) {
    const post = await this.getPost(postId);
    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    // Удаляем из списка постов пользователя
    const userContent = await this.userManager.getContent(post.authorUid);
    const posts = userContent.posts || { created: [], pinned: [] };
    posts.created = posts.created.filter(id => id !== postId);
    posts.pinned = posts.pinned.filter(id => id !== postId);
    await this.userManager.updateContent(post.authorUid, { posts });

    // Уменьшаем счётчик
    const profile = await this.userManager.getProfile(post.authorUid);
    const counters = profile.counters || { posts: 0 };
    counters.posts = Math.max(0, (counters.posts || 0) - 1);
    await this.userManager.updateProfile(post.authorUid, { counters });

    // Удаляем файлы поста
    const postPath = getPostPath(postId);
    const { removeDir } = await import('../utils/fs.js');
    await removeDir(postPath);
  }

  /**
   * Закрепляет пост
   */
  async pinPost(postId, authorUid) {
    const userContent = await this.userManager.getContent(authorUid);
    const posts = userContent.posts || { created: [], pinned: [] };
    
    if (!posts.pinned.includes(postId)) {
      posts.pinned.push(postId);
      await this.userManager.updateContent(authorUid, { posts });
    }
  }

  /**
   * Открепляет пост
   */
  async unpinPost(postId, authorUid) {
    const userContent = await this.userManager.getContent(authorUid);
    const posts = userContent.posts || { created: [], pinned: [] };
    
    posts.pinned = posts.pinned.filter(id => id !== postId);
    await this.userManager.updateContent(authorUid, { posts });
  }

  /**
   * Обновляет статистику поста
   */
  async updateStats(postId, statsUpdates) {
    const stats = await this.getPostStats(postId);
    if (!stats) {
      throw new Error(`Post ${postId} stats not found`);
    }

    const updatedStats = {
      ...stats,
      ...statsUpdates
    };

    const postPath = getPostPath(postId);
    await writeJson(path.join(postPath, 'stats.json'), updatedStats);

    return updatedStats;
  }

  /**
   * Лайкает пост
   */
  async likePost(postId) {
    const stats = await this.getPostStats(postId);
    return await this.updateStats(postId, {
      likes: (stats.likes || 0) + 1
    });
  }

  /**
   * Убирает лайк
   */
  async unlikePost(postId) {
    const stats = await this.getPostStats(postId);
    return await this.updateStats(postId, {
      likes: Math.max(0, (stats.likes || 0) - 1)
    });
  }

  /**
   * Лайкает пост от пользователя (с сохранением списка лайкнувших)
   */
  async likePostByUser(postId, userId) {
    const postPath = getPostPath(postId);
    const likesPath = path.join(postPath, 'likes.json');
    
    let likes = { users: [] };
    if (await exists(likesPath)) {
      likes = await readJson(likesPath);
    }
    
    if (!likes.users.includes(userId)) {
      likes.users.push(userId);
      await writeJson(likesPath, likes);
      
      const stats = await this.getPostStats(postId);
      await this.updateStats(postId, {
        likes: (stats.likes || 0) + 1
      });
    }
    
    return likes;
  }

  /**
   * Убирает лайк от пользователя
   */
  async unlikePostByUser(postId, userId) {
    const postPath = getPostPath(postId);
    const likesPath = path.join(postPath, 'likes.json');
    
    let likes = { users: [] };
    if (await exists(likesPath)) {
      likes = await readJson(likesPath);
    }
    
    if (likes.users.includes(userId)) {
      likes.users = likes.users.filter(uid => uid !== userId);
      await writeJson(likesPath, likes);
      
      const stats = await this.getPostStats(postId);
      await this.updateStats(postId, {
        likes: Math.max(0, (stats.likes || 0) - 1)
      });
    }
    
    return likes;
  }

  /**
   * Проверяет, лайкнул ли пользователь пост
   */
  async isLikedByUser(postId, userId) {
    const postPath = getPostPath(postId);
    const likesPath = path.join(postPath, 'likes.json');
    
    if (!(await exists(likesPath))) {
      return false;
    }
    
    const likes = await readJson(likesPath);
    return likes.users && likes.users.includes(userId);
  }

  /**
   * Получает список пользователей, лайкнувших пост
   */
  async getPostLikes(postId) {
    const postPath = getPostPath(postId);
    const likesPath = path.join(postPath, 'likes.json');
    
    if (!(await exists(likesPath))) {
      return { users: [] };
    }
    
    return await readJson(likesPath);
  }

  /**
   * Создаёт комментарий к посту
   */
  async createComment(postId, commentData) {
    const { commentId, authorUid, text, parentCommentId = null } = commentData;
    
    const postPath = getPostPath(postId);
    const commentsPath = path.join(postPath, 'comments.json');
    
    let comments = { items: [] };
    if (await exists(commentsPath)) {
      comments = await readJson(commentsPath);
    }
    
    const now = Math.floor(Date.now() / 1000);
    const comment = {
      commentId,
      postId,
      authorUid,
      text,
      parentCommentId,
      createdAt: now,
      updatedAt: now,
      likes: 0
    };
    
    comments.items.push(comment);
    await writeJson(commentsPath, comments);
    
    // Обновляем статистику поста
    const stats = await this.getPostStats(postId);
    await this.updateStats(postId, {
      comments: (stats.comments || 0) + 1
    });
    
    return comment;
  }

  /**
   * Получает комментарии к посту
   */
  async getComments(postId, options = {}) {
    const { limit = 50, offset = 0, parentCommentId = null } = options;
    const postPath = getPostPath(postId);
    const commentsPath = path.join(postPath, 'comments.json');
    
    if (!(await exists(commentsPath))) {
      return { items: [], total: 0 };
    }
    
    const comments = await readJson(commentsPath);
    let filtered = comments.items || [];
    
    if (parentCommentId !== null) {
      filtered = filtered.filter(c => c.parentCommentId === parentCommentId);
    } else {
      filtered = filtered.filter(c => !c.parentCommentId);
    }
    
    // Сортируем по дате создания (новые первые)
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);
    
    return {
      items: paginated,
      total,
      limit,
      offset
    };
  }

  /**
   * Получает комментарий по ID
   */
  async getComment(postId, commentId) {
    const postPath = getPostPath(postId);
    const commentsPath = path.join(postPath, 'comments.json');
    
    if (!(await exists(commentsPath))) {
      return null;
    }
    
    const comments = await readJson(commentsPath);
    return comments.items.find(c => c.commentId === commentId) || null;
  }

  /**
   * Обновляет комментарий
   */
  async updateComment(postId, commentId, updates) {
    const postPath = getPostPath(postId);
    const commentsPath = path.join(postPath, 'comments.json');
    
    if (!(await exists(commentsPath))) {
      throw new Error(`Comment ${commentId} not found`);
    }
    
    const comments = await readJson(commentsPath);
    const index = comments.items.findIndex(c => c.commentId === commentId);
    
    if (index === -1) {
      throw new Error(`Comment ${commentId} not found`);
    }
    
    comments.items[index] = {
      ...comments.items[index],
      ...updates,
      updatedAt: Math.floor(Date.now() / 1000)
    };
    
    await writeJson(commentsPath, comments);
    return comments.items[index];
  }

  /**
   * Удаляет комментарий
   */
  async deleteComment(postId, commentId) {
    const postPath = getPostPath(postId);
    const commentsPath = path.join(postPath, 'comments.json');
    
    if (!(await exists(commentsPath))) {
      throw new Error(`Comment ${commentId} not found`);
    }
    
    const comments = await readJson(commentsPath);
    const index = comments.items.findIndex(c => c.commentId === commentId);
    
    if (index === -1) {
      throw new Error(`Comment ${commentId} not found`);
    }
    
    comments.items.splice(index, 1);
    await writeJson(commentsPath, comments);
    
    // Обновляем статистику поста
    const stats = await this.getPostStats(postId);
    await this.updateStats(postId, {
      comments: Math.max(0, (stats.comments || 0) - 1)
    });
    
    return true;
  }

  /**
   * Лайкает комментарий
   */
  async likeComment(postId, commentId, userId) {
    const comment = await this.getComment(postId, commentId);
    if (!comment) {
      throw new Error(`Comment ${commentId} not found`);
    }
    
    const postPath = getPostPath(postId);
    const commentLikesPath = path.join(postPath, `comment_${commentId}_likes.json`);
    
    let likes = { users: [] };
    if (await exists(commentLikesPath)) {
      likes = await readJson(commentLikesPath);
    }
    
    if (!likes.users.includes(userId)) {
      likes.users.push(userId);
      await writeJson(commentLikesPath, likes);
      
      await this.updateComment(postId, commentId, {
        likes: (comment.likes || 0) + 1
      });
    }
    
    return likes;
  }

  /**
   * Убирает лайк с комментария
   */
  async unlikeComment(postId, commentId, userId) {
    const comment = await this.getComment(postId, commentId);
    if (!comment) {
      throw new Error(`Comment ${commentId} not found`);
    }
    
    const postPath = getPostPath(postId);
    const commentLikesPath = path.join(postPath, `comment_${commentId}_likes.json`);
    
    let likes = { users: [] };
    if (await exists(commentLikesPath)) {
      likes = await readJson(commentLikesPath);
    }
    
    if (likes.users.includes(userId)) {
      likes.users = likes.users.filter(uid => uid !== userId);
      await writeJson(commentLikesPath, likes);
      
      await this.updateComment(postId, commentId, {
        likes: Math.max(0, (comment.likes || 0) - 1)
      });
    }
    
    return likes;
  }
}

