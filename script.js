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

if (!GITHUB_USER || !REPO_NAME || !BRANCH) {
  throw new Error('Одно из полей не найдено: GITHUB_USER, REPO_NAME, BRANCH');
}

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
      },
    );
    console.log(`Файл ${fileName} успешно загружен. Ссылка: ${res.data.content.html_url}`);
  } catch (error) {
    console.error(`Ошибка загрузки ${fileName}:`, error.response?.data || error.message);
  }
}

// Функция для обновления json файла
async function updateFile(filePath, data) {
  const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (let item of data) {
    const foundedItemIndex = fileData.findIndex((fileItem) => fileItem.id === item.id);
    if (foundedItemIndex === -1) {
      fileData.push(item);
      continue;
    }
    if (fileData[foundedItemIndex].en !== item.en) fileData[foundedItemIndex].en = item.en;
    if (fileData[foundedItemIndex].portrait !== item.portrait) fileData[foundedItemIndex].portrait = item.portrait;
    if (fileData[foundedItemIndex].icon !== item.icon) fileData[foundedItemIndex].icon = item.icon;
    if (fileData[foundedItemIndex].halfPortrait !== item.halfPortrait) fileData[foundedItemIndex].halfPortrait = item.halfPortrait;
    if (fileData[foundedItemIndex].halfPortrait170 !== item.halfPortrait170) fileData[foundedItemIndex].halfPortrait170 = item.halfPortrait170;
    if (fileData[foundedItemIndex].iconHoyo !== item.iconHoyo) fileData[foundedItemIndex].iconHoyo = item.iconHoyo;
    if (fileData[foundedItemIndex].iconUrl !== item.iconUrl) fileData[foundedItemIndex].iconUrl = item.iconUrl;
  }
  fs.writeFileSync(filePath, JSON.stringify(fileData), 'utf8');
}

async function processCharacters(isUploadToGitHub = true, isUpdateFile = true) {
  try {
    console.log('Начинаем обработку персонажей');
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
      const iconHoyoUrl = `https://act-webstatic.hoyoverse.com/game_record/zzzv2/role_square_avatar/role_square_avatar_${id}.png`;

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

      // Получение half portrait
      try {
        const iconHoyoUrlHoyoResponse = await axios.get(iconHoyoUrl, { responseType: 'arraybuffer' });
        iconHoyoUrlBuffer = iconHoyoUrlHoyoResponse.data;
      } catch (error) {
        console.error(`Ошибка при загрузке iconHoyoUrl для персонажа ${character.code}:`, error);
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
      const portraitFilePath = `images/characters/portraits/${id}.png`;
      const iconFilePath = `images/characters/icons/${id}.png`;
      const halfPortraitFilePath = `images/characters/half-portraits/${id}.png`;
      const halfPortrait170FilePath = `images/characters/half-portraits-170/${id}.png`;
      const iconHoyoUrlFilePath = `images/characters/hoyo-avatar/${id}.png`;

      // Загружаем в GitHub оригинальные изображения
      if (isUploadToGitHub) {
        try {
          await uploadToGitHub(portraitFilePath, portraitPngBuffer, `Upload portrait for ${character.code}`);
          await uploadToGitHub(iconFilePath, iconPngBuffer, `Upload icon for ${character.code}`);
          await uploadToGitHub(halfPortraitFilePath, halfPortraitHoyoUrlBuffer, `Upload half portrait for ${character.code}`);
          await uploadToGitHub(iconHoyoUrlFilePath, iconHoyoUrlBuffer, `Upload hoyo icon portrait for ${character.code}`);
        } catch (error) {
          console.error(`Ошибка при загрузке файлов на GitHub для персонажа ${character.code}:`, error);
          continue;
        }
      }

      // Создаём уменьшенную версию half portrait (326x170)
      if (isUploadToGitHub) {
        try {
          const halfPortraitResizedBuffer = await sharp(halfPortraitHoyoUrlBuffer).resize(326, 170).png().toBuffer();
          await uploadToGitHub(halfPortrait170FilePath, halfPortraitResizedBuffer, `Upload resized half portrait for ${character.code}`);
        } catch (error) {
          console.error(`Ошибка при создании/загрузке уменьшенного half portrait для персонажа ${character.code}:`, error);
          // Если не удалось создать уменьшенную версию, можно продолжить без неё
        }
      }

      // Формируем ссылки для JSON
      const portraitGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${portraitFilePath}`;
      const iconGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${iconFilePath}`;
      const halfPortraitGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${halfPortraitFilePath}`;
      // Можно добавить ссылку на уменьшённую версию, если потребуется:
      const halfPortrait170GitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${halfPortrait170FilePath}`;
      const iconHoyoGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${iconHoyoUrlFilePath}`;

      results.push({
        id,
        code: character.code,
        rank: character.rank,
        type: character.type,
        element: character.element,
        en: character.EN,
        camp: character.camp,
        portrait: portraitGitHubUrl,
        icon: iconGitHubUrl,
        halfPortrait: halfPortraitGitHubUrl,
        iconHoyo: iconHoyoGitHubUrl,
        halfPortrait170: halfPortrait170GitHubUrl, // добавляем ссылку на уменьшенную версию
      });
    }

    if (isUpdateFile) {
      updateFile('characters.json', results);
    }
    console.log('Персонажи обработаны и сохранены в characters.json');
  } catch (error) {
    console.error('Ошибка при обработке персонажей:', error);
  }
}

// Функция обработки оружия
async function processWeapons(isUploadToGitHub = true, isUpdateFile = true) {
  try {
    console.log('Начинаем обработку оружия');
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
      if (isUploadToGitHub) {
        await uploadToGitHub(weaponFilePath, weaponPngBuffer, `Upload weapon icon for ${weapon.EN}`);
      }

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

    if (isUpdateFile) {
      updateFile('weapons.json', results);
    }
    console.log('Оружие обработано и сохранено в weapons.json');
  } catch (error) {
    console.error('Ошибка при обработке оружия:', error);
  }
}

// Основная функция
async function fetchAndProcessData(isUploadToGitHub = true, isUpdateFiles = true) {
  await processCharacters(isUploadToGitHub, isUpdateFiles);
  await processWeapons(isUploadToGitHub, isUpdateFiles);
}

// Запуск
fetchAndProcessData();
