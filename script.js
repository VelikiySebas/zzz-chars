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

// Функция обработки персонажей
async function processCharacters() {
  try {
    const response = await axios.get('https://api.hakush.in/zzz/data/character.json');
    const data = response.data;

    const excludedIds = ['2011', '2021'];
    const results = [];

    for (let [id, character] of Object.entries(data)) {
      if (excludedIds.includes(id)) continue;

      // Формируем URL для загрузки
      const portraitWebpUrl = `https://api.hakush.in/zzz/UI/${character.icon}.webp`;
      const iconWebpUrl = `https://api.hakush.in/zzz/UI/${character.icon.replace('IconRole', 'IconRoleSelect')}.webp`;

      // Скачиваем webp
      const portraitWebpBuffer = (await axios.get(portraitWebpUrl, { responseType: 'arraybuffer' })).data;
      const iconWebpBuffer = (await axios.get(iconWebpUrl, { responseType: 'arraybuffer' })).data;

      // Конвертируем webp → png
      const portraitPngBuffer = await sharp(portraitWebpBuffer).png().toBuffer();
      const iconPngBuffer = await sharp(iconWebpBuffer).png().toBuffer();

      // Пути для загрузки
      const portraitFilePath = `images/characters/portraits/${character.icon}.png`;
      const iconFilePath = `images/characters/icons/${character.icon.replace('IconRole', 'IconRoleSelect')}.png`;

      // Загружаем в GitHub
      await uploadToGitHub(portraitFilePath, portraitPngBuffer, `Upload portrait for ${character.code}`);
      await uploadToGitHub(iconFilePath, iconPngBuffer, `Upload icon for ${character.code}`);

      // Формируем ссылки для JSON
      const portraitGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${portraitFilePath}`;
      const iconGitHubUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/${iconFilePath}`;

      results.push({
        id,
        code: character.code,
        rank: character.rank,
        type: character.type,
        element: character.element,
        en: character.EN,
        portrait: portraitGitHubUrl,
        icon: iconGitHubUrl,
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
