const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ----------------------
// Конфигурация
// ----------------------
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USER = process.env.GITHUB_USER;
const REPO_NAME = process.env.REPO_NAME;
const BRANCH = process.env.BRANCH;

// Функция для загрузки одного файла в GitHub
async function uploadToGitHub(filePath, contentBuffer, commitMessage) {
  const fileName = path.basename(filePath);
  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/images/${fileName}`;

  // Содержимое в base64
  const encodedContent = Buffer.from(contentBuffer).toString('base64');

  try {
    const res = await axios.put(
      apiUrl,
      {
        message: commitMessage,
        content: encodedContent,
        branch: BRANCH
      },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );
    console.log(`Файл ${fileName} успешно загружен. Ссылка: ${res.data.content.html_url}`);
  } catch (error) {
    console.error(`Ошибка загрузки ${fileName}:`, error.response?.data || error.message);
  }
}

// Основная логика
async function fetchAndProcessData() {
  try {
    // 1. Получаем данные
    const response = await axios.get('ССЫЛКА_НА_ВАШЕ_API');
    const data = response.data;

    // 2. Исключаем двух персонажей
    const excludedIds = ['2011', '2021'];

    // 3. Собираем массив промисов
    const results = [];

    for (let [id, character] of Object.entries(data)) {
      if (excludedIds.includes(id)) {
        continue; // пропускаем
      }

      // Формируем URL .webp
      const portraitWebpUrl = `https://api.hakush.in/zzz/UI/${character.icon}.webp`;
      const iconWebpUrl = `https://api.hakush.in/zzz/UI/${character.icon.replace('IconRole', 'IconRoleSelect')}.webp`;

      // Скачиваем webp
      const portraitWebpBuffer = (await axios.get(portraitWebpUrl, { responseType: 'arraybuffer' })).data;
      const iconWebpBuffer = (await axios.get(iconWebpUrl, { responseType: 'arraybuffer' })).data;

      // Конвертируем webp → png через sharp
      const portraitPngBuffer = await sharp(portraitWebpBuffer).png().toBuffer();
      const iconPngBuffer = await sharp(iconWebpBuffer).png().toBuffer();

      // Имя файла (удобно генерировать тоже)
      const portraitFileName = `${character.icon}.png`;
      const iconFileName = `${character.icon.replace('IconRole', 'IconRoleSelect')}.png`;

      // Загружаем в GitHub
      await uploadToGitHub(
        portraitFileName,
        portraitPngBuffer,
        `Upload portrait for ${character.code}`
      );
      await uploadToGitHub(
        iconFileName,
        iconPngBuffer,
        `Upload icon for ${character.code}`
      );

      // Формируем ссылку на файл в GitHub API (обратите внимание: это ссылка на содержимое в GitHub)
      const portraitGitHubUrl = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/images/${portraitFileName}?ref=${BRANCH}`;
      const iconGitHubUrl = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/images/${iconFileName}?ref=${BRANCH}`;

      // Сохраняем в массив для итогового JSON
      results.push({
        id,
        code: character.code,
        rank: character.rank,
        type: character.type,
        element: character.element,
        en: character.EN,
        // Указываем ссылки на GitHub (или потом можешь настроить другое хранение)
        portrait: portraitGitHubUrl,
        icon: iconGitHubUrl
      });
    }

    // 4. Запись в JSON локально
    fs.writeFileSync('characters.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log('Готово: characters.json сохранён');

  } catch (error) {
    console.error('Ошибка:', error);
  }
}

// Запуск
fetchAndProcessData();
