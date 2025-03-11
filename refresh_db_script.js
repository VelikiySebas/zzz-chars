const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL;
if (!dbUrl) {
  throw new Error('Ссылка на базу данных не найдена');
}
const agentsJsonPath = './characters.json';
const enginesJsonPath = './weapons.json';
const bangbooJsonPath = './bangboo.json';

// File operations
const readFile = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const writeFile = (path, data) => fs.writeFileSync(path, JSON.stringify(data), 'utf8');

// Serializers
const serializeAgents = (data) => {
  return data.map((agent) => ({
    _id: new mongoose.Types.ObjectId(agent._id),
    enkaId: agent.id,
    name: {
      en: agent.en,
      ru: agent.ru,
    },
    rarity: agent.rank,
    specialty: agent.type,
    attribute: agent.element,
    faction: agent.camp,
    iconSrc: agent.icon,
    avatarSrc: agent.iconHoyo,
    portraitSrc: agent.portrait,
    halfPortrait: agent.halfPortrait,
    halfPortrait170: agent.halfPortrait170,
    hoyoIconSrc: `https://act-webstatic.hoyoverse.com/game_record/zzzv2/role_square_avatar/role_square_avatar_${agent.id}.png`,
    hoyoImageSrc: `https://act-webstatic.hoyoverse.com/game_record/zzzv2/role_vertical_painting/role_vertical_painting_${agent.id}.png`,
  }));
};
const serializeEngines = (data) => {
  return data.map((engine) => ({
    _id: new mongoose.Types.ObjectId(engine._id),
    enkaId: engine.id,
    title: {
      en: engine.en,
      ru: engine.ru,
    },
    rarity: engine.rank,
    specialty: engine.type,
    iconSrc: engine.iconUrl,
    hoyoIconSrc: engine.hoyoIconSrc,
  }));
};
const serializeBangboos = (data) => {
  return data.map((bangboo) => ({
    _id: new mongoose.Types.ObjectId(bangboo._id),
    enkaId: bangboo.id,
    name: {
      en: bangboo.en,
      ru: bangboo.ru,
    },
    rarity: bangboo.rank,
    iconSrc: bangboo.iconUrl,
  }));
};

// Db refresh function
const refreshCollection = async (coll, data, originalFile) => {
  console.log(`Start refresh collection ${coll}. Data length: ${data.length}`);
  const collection = mongoose.connection.db.collection(coll);
  for (const [index, dataItem] of data.entries()) {
    const refreshItem = { ...dataItem };
    delete refreshItem._id;
    let item = await collection.findOneAndUpdate({ enkaId: dataItem.enkaId }, { $set: refreshItem }, { upsert: true, new: true });
    if (!item) {
      item = await collection.findOne({ enkaId: dataItem.enkaId });
    }
    if (!dataItem._id || dataItem._id !== item._id) {
      originalFile[index]._id = item._id;
    }
  }
  return data;
};

mongoose.connect(dbUrl).then(async () => {
  console.log('[START]: Db refresh');

  // Characters
  const agentsFileData = readFile(agentsJsonPath);
  const agents = serializeAgents(agentsFileData);
  await refreshCollection('agents', agents, agentsFileData);
  writeFile(agentsJsonPath, agentsFileData);

  // Weapons
  const enginesFileData = readFile(enginesJsonPath);
  const engines = serializeEngines(enginesFileData);
  await refreshCollection('engines', engines, enginesFileData);
  writeFile(enginesJsonPath, enginesFileData);

  // Bangboos
  const bangboosFileData = readFile(bangbooJsonPath);
  const bangboos = serializeBangboos(bangboosFileData);
  await refreshCollection('bangboos', bangboos, bangboosFileData);
  writeFile(bangbooJsonPath, bangboosFileData);

  console.log('[DONE]: Db refresh');
  mongoose.connection.close();
});
