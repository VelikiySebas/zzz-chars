const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config();

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
  const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/${filePath}`;

  // Содержимое в base64
  const encodedContent = Buffer.from(contentBuffer).toString('base64');

  try {
    const res = await axios.put(
      apiUrl,
      {
        message: commitMessage,
        content: encodedContent,
        branch: BRANCH,
      },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    console.log(`Файл ${fileName} успешно загружен. Ссылка: ${res.data.content.html_url}`);
  } catch (error) {
    console.error(`Ошибка загрузки ${fileName}:`, error.response?.data || error.message);
  }
}

async function processCharacters() {
  try {
    const response = await axios.get('https://api.hakush.in/zzz/data/character.json');
    const data = response.data;

    const excludedIds = ['2011', '2021'];
    const results = [];

    for (let [id, character] of Object.entries(data)) {
      if (excludedIds.includes(id)) continue;

      // Формируем URL для загрузки изображений
      const portraitWebpUrl = `https://api.hakush.in/zzz/UI/${character.icon}.webp`;
      const iconWebpUrl = `https://api.hakush.in/zzz/UI/${character.icon.replace('IconRole', 'IconRoleSelect')}.webp`;
      const halfPortraitHoyoUrl = `https://act-webstatic.hoyoverse.com/game_record/zzzv2/role_vertical_painting/role_vertical_painting_${id}.png`;

      let halfPortraitHoyoUrlBuffer = '';
      let portraitWebpBuffer = '';
      let iconWebpBuffer = '';

      // Получение half portrait
      try {
        const halfPortraitHoyoResponse = await axios.get(halfPortraitHoyoUrl, { responseType: 'arraybuffer' });
        halfPortraitHoyoUrlBuffer = halfPortraitHoyoResponse.data;
      } catch (error) {
        console.error(`Ошибка при загрузке halfPortraitHoyoUrl для персонажа ${character.code}:`, error);
      }

      // Получение portrait webp
      try {
        const portraitWebpResponse = await axios.get(portraitWebpUrl, { responseType: 'arraybuffer' });
        portraitWebpBuffer = portraitWebpResponse.data;
      } catch (error) {
        console.error(`Ошибка при загрузке portraitWebpUrl для персонажа ${character.code}:`, error);
      }

      // Получение icon webp
      try {
        const iconWebpResponse = await axios.get(iconWebpUrl, { responseType: 'arraybuffer' });
        iconWebpBuffer = iconWebpResponse.data;
      } catch (error) {
        console.error(`Ошибка при загрузке iconWebpUrl для персонажа ${character.code}:`, error);
      }

      // Если хоть одно из изображений не получено, пропускаем персонажа
      if (!halfPortraitHoyoUrlBuffer || !portraitWebpBuffer || !iconWebpBuffer) {
        console.warn(`Пропускаем персонажа ${character.code} из-за ошибки загрузки изображений.`);
        continue;
      }

      let portraitPngBuffer, iconPngBuffer;
      // Конвертируем webp в png
      try {
        portraitPngBuffer = await sharp(portraitWebpBuffer).png().toBuffer();
        iconPngBuffer = await sharp(iconWebpBuffer).png().toBuffer();
      } catch (error) {
        console.error(`Ошибка при конвертации изображений для персонажа ${character.code}:`, error);
        continue;
      }

      // Пути для загрузки
      const portraitFilePath = `images/characters/portraits/${character.icon}.png`;
      const iconFilePath = `images/characters/icons/${character.icon.replace('IconRole', 'IconRoleSelect')}.png`;
      const halfPortraitFilePath = `images/characters/half-portraits/${id}.png`;
      const halfPortrait170FilePath = `images/characters/half-portraits-170/${id}.png`;

      // Загружаем в GitHub оригинальные изображения
      try {
        await uploadToGitHub(portraitFilePath, portraitPngBuffer, `Upload portrait for ${character.code}`);
        await uploadToGitHub(iconFilePath, iconPngBuffer, `Upload icon for ${character.code}`);
        await uploadToGitHub(halfPortraitFilePath, halfPortraitHoyoUrlBuffer, `Upload half portrait for ${character.code}`);
      } catch (error) {
        console.error(`Ошибка при загрузке файлов на GitHub для персонажа ${character.code}:`, error);
        continue;
      }

      // Создаём уменьшенную версию half portrait (326x170)
      try {
        const halfPortraitResizedBuffer = await sharp(halfPortraitHoyoUrlBuffer)
          .resize(326, 170)
          .png()
          .toBuffer();
        await uploadToGitHub(halfPortrait170FilePath, halfPortraitResizedBuffer, `Upload resized half portrait for ${character.code}`);
      } catch (error) {
        console.error(`Ошибка при создании/загрузке уменьшенного half portrait для персонажа ${character.code}:`, error);
        // Если не удалось создать уменьшенную версию, можно продолжить без неё
      }

      // Формируем ссылки для JSON
      const portraitGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${portraitFilePath}`;
      const iconGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${iconFilePath}`;
      const halfPortraitGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${halfPortraitFilePath}`;
      // Можно добавить ссылку на уменьшённую версию, если потребуется:
      const halfPortrait170GitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${halfPortrait170FilePath}`;

      results.push({
        id,
        code: character.code,
        rank: character.rank,
        type: character.type,
        element: character.element,
        en: character.EN,
        portrait: portraitGitHubUrl,
        icon: iconGitHubUrl,
        halfPortrait: halfPortraitGitHubUrl,
        halfPortrait170: halfPortrait170GitHubUrl // добавляем ссылку на уменьшенную версию
      });
    }

    fs.writeFileSync('characters.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log('Персонажи обработаны и сохранены в characters.json');
  } catch (error) {
    console.error('Ошибка при обработке персонажей:', error);
  }
}



// Функция обработки оружия
async function processWeapons() {
  try {
    const response = await axios.get('https://api.hakush.in/zzz/data/weapon.json');
    const data = response.data;

    const results = [];

    for (let [id, weapon] of Object.entries(data)) {
      // Формируем URL для загрузки
      const weaponWebpUrl = `https://api.hakush.in/zzz/UI/${weapon.icon}.webp`;

      // Скачиваем webp
      const weaponWebpBuffer = (await axios.get(weaponWebpUrl, { responseType: 'arraybuffer' })).data;

      // Конвертируем webp → png
      const weaponPngBuffer = await sharp(weaponWebpBuffer).png().toBuffer();

      // Пути для загрузки
      const weaponFilePath = `images/weapons/engines/${weapon.icon}.png`;

      // Загружаем в GitHub
      await uploadToGitHub(weaponFilePath, weaponPngBuffer, `Upload weapon icon for ${weapon.EN}`);

      // Формируем ссылку для JSON
      const weaponGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${weaponFilePath}`;

      results.push({
        id,
        icon: weapon.icon,
        rank: weapon.rank,
        type: weapon.type,
        en: weapon.EN,
        iconUrl: weaponGitHubUrl,
      });
    }

    fs.writeFileSync('weapons.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log('Оружие обработано и сохранено в weapons.json');
  } catch (error) {
    console.error('Ошибка при обработке оружия:', error);
  }
}

// Основная функция
async function fetchAndProcessData() {
  await processCharacters();
  await processWeapons();
}

// Запуск
fetchAndProcessData();
