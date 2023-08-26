import fs from 'fs/promises';
import cloneDeep from 'lodash.clonedeep';
import * as spritesheet from './spritesheet.js';
import { v5 as uuidv5 } from 'uuid';
import deckTemplate from './templates/deck.json' assert { type: 'json' };
import cardTemplate from './templates/card.json' assert { type: 'json' };
import saveFileTemplate from './templates/save-file.json' assert { type: 'json' };
import savedObjectTemplate from './templates/saved-object.json' assert { type: 'json' };

const cache = await import('../.cache/tts.json', { assert: { type: 'json' } })
  .then((module) => module.default)
  .catch(() => ({}));

const namespace = '1b671a64-40d5-491e-99b0-da01ff1f3341';
const { STORAGE_BUCKET, STORAGE_URL } = process.env;
const cardBackURL = `${STORAGE_URL}/${STORAGE_BUCKET}/mtg-card-back.jpg`;

export class CustomDeck {
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
    const images = [...this.cards.map(card => {
      const { id, name, image_uris: { large, normal, small } = {} } = card
      const image = large || normal || small;
      if (!image) throw new Error(`Missing card image for ${name} - ${id}`);
      return image;
    }).filter(image => image != null), cardBackURL];

    const sheet = await spritesheet.generate(images);

    this.object = {
      FaceURL: sheet.url,
      BackURL: cardBackURL,
      NumWidth: sheet.cols,
      NumHeight: sheet.rows,
      BackIsHidden: true,
      UniqueBack: false,
      Type: 0
    };

    return this;
  }
}

export class Card {
  constructor(id, card, customDeck) {
    this.id = id;

    this.object = cloneDeep(cardTemplate);
    this.object.Nickname = card.name;
    if (card.power && card.toughness) {
      this.object.Nickname += ` (${card.power}/${card.toughness})`;
    }
    this.object.Description = card.oracle_text;
    if (card.card_faces?.length) {
      const otherFace = card.card_faces.find(face => face.name !== card.name);
      if (card.layout === 'transform') {
        this.object.Description += '\n----------\nTransforms into ' + otherFace.name;
      }
      if (card.layout === 'modal_dfc') {
        this.object.Description += '\n----------\nFlips into ' + otherFace.name;
      }
    }
    this.object.CustomDeck = {
      [customDeck.id]: customDeck.object
    };
    this.object.CardID = id;
  }
}

export class Deck {
  constructor(nickname, cards) {
    this.key = uuidv5(cards.map(card => card.id).join(','), namespace);
    if (cache[this.key]) {
      this.object = cache[this.key];
    } else {
      this.cards = cards;
      this.object = cloneDeep(deckTemplate);
      this.object.Nickname = nickname;
    }
    this.object.GUID = this.key.substr(0, 6);
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
    if (!this.object.ContainedObjects.length) {
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
      cache[this.key] = this.object;
    }
    return this.object;
  }
}

let nextDeckID = 60; // TTS likes it when you start deck ID at this number :shrug:

export class SaveFile {
  constructor() {
    this.object = cloneDeep(saveFileTemplate);
  }
  static generateDeckID() {
    return nextDeckID++;
  }
  setDate(date) {
    this.object.Date = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }
  async addDeck(deck) {
    const builtDeck = await deck.build();
    if (builtDeck.ContainedObjects.length > 1) {
      this.object.ObjectStates.push(builtDeck);
    } else {
      const card = builtDeck.ContainedObjects[0];
      card.Transform = builtDeck.Transform;
      this.object.ObjectStates.push(card);
    }
  }
  toString() {
    this.setDate(new Date());
    return JSON.stringify(this.object, null, 2);
  }
  static async saveCache() {
    await fs.mkdir('.cache', { recursive: true });
    return await fs.writeFile('.cache/tts.json', JSON.stringify(cache), 'utf-8');
  }
}

export class SavedObject {
  constructor() {
    this.object = cloneDeep(savedObjectTemplate);
  }
  static generateDeckID() {
    return nextDeckID++;
  }
  setDate(date) {
    this.object.Date = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }
  async addDeck(deck) {
    const builtDeck = await deck.build();
    if (builtDeck.ContainedObjects.length > 1) {
      this.object.ObjectStates.push(builtDeck);
    } else {
      const card = builtDeck.ContainedObjects[0];
      card.Transform = builtDeck.Transform;
      this.object.ObjectStates.push(card);
    }
  }
  toString() {
    this.setDate(new Date());
    return JSON.stringify(this.object, null, 2);
  }
}
