const cloneDeep = require('lodash/clonedeep');
const spritesheet = require('./spritesheet');

const templates = {
    deck: require('./templates/deck.json'),
    card: require('./templates/card.json'),
    saveFile: require('./templates/save-file.json')
};

const {
    STORAGE_BUCKET,
    STORAGE_URL,
} = process.env;

const cardBackURL = `${STORAGE_URL}/${STORAGE_BUCKET}/mtg-card-back.jpg`;

class CustomDeck {
    static MAX_SIZE = 15;
    constructor(id, cards) {
        this.id = id;
        this.nextCardID = this.id * 100;
        this.cards = cards;
    }
    generateCardID() {
        return this.nextCardID++;
    }
    async build() {
        const images = [...this.cards.map(card => card.image_uris.large), cardBackURL];
        const sheet = await spritesheet.generate(images);

        this.object = {
            FaceURL: sheet.url,
            BackURL: cardBackURL,
            NumWidth: sheet.cols,
            NumHeight: sheet.rows,
            BackIsHidden: true,
            UniqueBack: false
        };

        return this;
    }
}

class Card {
    constructor(id, card, customDeck) {
        this.id = id;

        this.object = cloneDeep(templates.card);
        this.object.Nickname = card.name;
        if (card.power && card.toughness) {
            this.object.Nickname += ` (${card.power}/${card.toughness})`;
        }
        this.object.Description = card.oracle_text;
        this.object.CustomDeck = {
            [customDeck.id]: customDeck.object
        };
        this.object.CardID = id;
    }
}

class Deck {
    constructor(nickname, cards) {
        this.cards = cards;
        this.object = cloneDeep(templates.deck);
        this.object.Nickname = nickname;
    }
    addCard(card) {
        this.object.DeckIDs.push(card.id);
        this.object.ContainedObjects.push(card.object);
    }
    setTransform({ posX, posY, posZ, rotX, rotY, rotZ} = {}) {
        if (posX != null) this.object.Transform.posX = posX;
        if (posY != null) this.object.Transform.posY = posY;
        if (posZ != null) this.object.Transform.posZ = posZ;
        if (rotX != null) this.object.Transform.rotX = rotX;
        if (rotY != null) this.object.Transform.rotY = rotY;
        if (rotZ != null) this.object.Transform.rotZ = rotZ;
    }
    async build() {
        const remainingCards = this.cards.slice();
        while (remainingCards.length) {
            const batch = remainingCards.splice(0, CustomDeck.MAX_SIZE);
            const customDeck = new CustomDeck(SaveFile.generateDeckID(), batch);
            await customDeck.build();

            this.object.CustomDeck[customDeck.id] = customDeck.object;
            for (const card of batch) {
                this.addCard(new Card(customDeck.generateCardID(), card, customDeck));
            }
        }

        return this;
    }
}

let nextDeckID = 60; // TTS likes it when you start deck ID at this number :shrug:

class SaveFile {
    constructor() {
        this.object = cloneDeep(templates.saveFile);
    }
    static generateDeckID() {
        return nextDeckID++;
    }
    setDate(date) {
        this.object.Date = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }
    async addDeck(deck) {
        const builtDeck = await deck.build();
        this.object.ObjectStates.push(builtDeck.object);
    }
    toString() {
        this.setDate(new Date());
        return JSON.stringify(this.object, null, '\t');
    }
}

module.exports = {
    SaveFile,
    Deck
};