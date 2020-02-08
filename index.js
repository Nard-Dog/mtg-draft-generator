require('dotenv').config();

const fs = require('fs-extra');
const scryfall = require('./libs/scryfall');
const spritesheet = require('./libs/spritesheet');
const PackRandomizer = require('./libs/pack-randomizer');
const cloneDeep = require('lodash/clonedeep');

const {
    SAVE_FILE_PATH,
    STORAGE_BUCKET,
    STORAGE_URL,
    NUM_PLAYERS,
    NUM_ROUNDS,
    RARITY_RATIOS,
    DRAFT_SETS
} = process.env;

const cardBackURL = `${STORAGE_URL}/${STORAGE_BUCKET}/mtg-card-back.jpg`;

const rarityRatios = JSON.parse(RARITY_RATIOS);
const draftSets = DRAFT_SETS.split(',');
const numPlayers = Number(NUM_PLAYERS);
const numRounds = Number(NUM_ROUNDS);

const templates = {
    deck: require('./templates/deck.json'),
    card: require('./templates/card.json'),
    saveFile: require('./templates/save-file.json')
};

let nextDeckID = 60;

async function buildCustomDeck(cards) {
    const images = [...cards.map(card => card.image_uris.large), cardBackURL];
    const sheet = await spritesheet.generate(images);

    return {
        id: nextDeckID++,
        properties:  {
            FaceURL: sheet.url,
            BackURL: cardBackURL,
            NumWidth: sheet.cols,
            NumHeight: sheet.rows,
            BackIsHidden: true,
            UniqueBack: false
        }
    };
}

function buildCardObject(card, id, customDeck) {
    const cardObject = cloneDeep(templates.card);
    cardObject.CardID = id;
    cardObject.Nickname = card.name;
    if (card.power && card.toughness) {
        cardObject.Nickname += ` (${card.power}/${card.toughness})`;
    }
    cardObject.Description = card.oracle_text;
    cardObject.CustomDeck = {
        [customDeck.id]: customDeck.properties
    };
    return cardObject;
}

async function buildDeckObject(nickname, cards) {
    cards = cards.slice();
    const deckObject = cloneDeep(templates.deck);
    deckObject.Nickname = nickname;

    while (cards.length) {
        const batch = cards.splice(0, 15);
        const customDeck = await buildCustomDeck(batch);
        let nextCardID = customDeck.id * 100;
        for (const card of batch) {
            const cardObject = buildCardObject(card, nextCardID++, customDeck);
            deckObject.DeckIDs.push(cardObject.CardID);
            deckObject.ContainedObjects.push(cardObject);
        }
        deckObject.CustomDeck[customDeck.id] = customDeck.properties;
    }

    return deckObject;
}

const saveFile = cloneDeep(templates.saveFile);

scryfall.fetchCards(draftSets)
.then(async cards => {
    console.log('Building packs...');
    const randomizer = new PackRandomizer(cards, rarityRatios);
    const packs = [];
    
    for (let row = 0; row < numPlayers; row++) {
        for (let col = 0; col < numRounds; col++) {
            try {
                const pack = await randomizer.generatePack();
                const deckObject = await buildDeckObject(`Pack ${packs.length + 1}`, pack);
                deckObject.Transform.posX += col * 3;
                deckObject.Transform.posZ -= row * 4;

                packs.push(deckObject);
            } catch (err) {
                console.log(err);
            }
        }
    }
    saveFile.ObjectStates = saveFile.ObjectStates.concat(packs);
})
.then(async () => {
    console.log('Building lands...');
    const basicLands = await scryfall.fetchBasicLands(draftSets);
    const deckObject = await buildDeckObject('Lands', basicLands);
    deckObject.Transform.posX = -1.75;
    deckObject.Transform.rotZ = 0;
    saveFile.ObjectStates.push(deckObject);
})
.then(async () => {
    console.log('Building tokens...');
    const tokens = await scryfall.fetchTokens(draftSets);
    const deckObject = await buildDeckObject('Tokens', tokens);
    deckObject.Transform.posX = -1.75;
    deckObject.Transform.posZ -= 4;
    deckObject.Transform.rotZ = 0;
    saveFile.ObjectStates.push(deckObject);
})
.then(() => {
    const now = new Date();
    saveFile.Date = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    return fs.outputFile(SAVE_FILE_PATH, JSON.stringify(saveFile, null, '\t'), { encoding: 'utf8' });
})
.then(() => {
    console.log(`Draft file successfully created`);
})
.catch((err) => console.log(err));