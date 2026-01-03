import fs from 'fs/promises';
import path from 'path';

/**
 * Создаёт директорию и все родительские, если их нет
 */
export async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Создаёт директорию (синоним для ensureDir)
 */
export async function mkdir(dirPath, options = {}) {
  return ensureDir(dirPath);
}

/**
 * Читает JSON файл
 */
export async function readJson(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Записывает JSON файл
 */
export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Проверяет существование файла
 */
export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Удаляет файл
 */
export async function removeFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Удаляет директорию рекурсивно
 */
export async function removeDir(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Читает все файлы из директории
 */
export async function readDir(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Удаляет файл или директорию
 */
export async function rm(targetPath, options = {}) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true, ...options });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Получает статистику файла/директории
 */
export async function stat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Читает содержимое файла (оригинальный текст, не JSON)
 */
export async function readFileRaw(filePath, encoding = 'utf-8') {
  try {
    return await fs.readFile(filePath, encoding);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Записывает содержимое в файл (оригинальный текст, не JSON)
 */
export async function writeFileRaw(filePath, content, encoding = 'utf-8') {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, encoding);
}

/**
 * Алиасы для совместимости со старым кодом
 */
export const readFile = readJson;
export const writeFile = writeJson;
export const deleteFile = removeFile;