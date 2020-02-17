require('dotenv').config();

const fs = require('fs-extra');
const scryfall = require('./libs/scryfall');
const { SaveFile, Deck } = require('./libs/tts');
const PackRandomizer = require('./libs/pack-randomizer');

const {
    SAVE_FILE_PATH,
    NUM_PLAYERS,
    NUM_ROUNDS,
    DRAFT_SETS
} = process.env;

const draftSets = DRAFT_SETS.split(',');
const numPlayers = Number(NUM_PLAYERS);
const numRounds = Number(NUM_ROUNDS);
// Starting location for placing packs
const start = {
    posX: 1.75,
    posY: 1.5,
    posZ: -7.75
};

async function generateSaveFile() {
    const saveFile = new SaveFile();

    console.log('Building packs...');
    const cards = await scryfall.fetchCards(draftSets);
    const randomizer = new PackRandomizer(cards);
    
    for (let row = 0; row < numPlayers; row++) {
        for (let col = 0; col < numRounds; col++) {
            try {
                const i = (row * numRounds) + col;
                const pack = await randomizer.generatePack();

                const deck = new Deck(`Pack ${i + 1}`, pack);
                deck.setTransform({
                    posX: (start.posX + col * 3),
                    posZ: (start.posZ - row * 4)
                });
                await saveFile.addDeck(deck);
                console.log(`⤷ Pack ${i + 1} created`);
            } catch (err) {
                console.log(err);
            }
        }
    }

    console.log('Building lands...');
    const basicLands = await scryfall.fetchBasicLands(draftSets);
    const landDeck = new Deck('Lands', basicLands);
    landDeck.setTransform({ posX: -1.75, posZ: start.posZ, rotZ: 0 });
    await saveFile.addDeck(landDeck);

    console.log('Building tokens...');
    const tokens = await scryfall.fetchTokens(draftSets);
    const tokenDeck = new Deck('Tokens', tokens);
    tokenDeck.setTransform({ posX: -1.75, posZ: (start.posZ - 4), rotZ: 0 });
    await saveFile.addDeck(tokenDeck);

    const transformCards = cards.filter(card => card.layout === 'transform').map(card => Object.assign({}, card, card.card_faces[1]));
    if (transformCards.length) {
        console.log('Building transform backs...');
        const transformDeck = new Deck('Transform Backs', transformCards);
        transformDeck.setTransform({ posX: -1.75, posZ: (start.posZ - 8), rotZ: 0 });
        await saveFile.addDeck(transformDeck);
    }
    
    await fs.outputFile(SAVE_FILE_PATH, saveFile.toString(), { encoding: 'utf8' });
}

generateSaveFile()
.then(() => console.log(`Save file successfully created`))
.catch(err => console.log(err));