import {randomInt} from 'crypto';

const MAX_LANDS_PER_PACK = 1;

export default class PackRandomizer {
  #selectedMythics = new Set();

  constructor(ratios, cards) {
    this.ratios = ratios;
    this.cards = cards.map(card => {
      if (['modal_dfc', 'transform'].includes(card.layout)) {
        return Object.assign({}, card, card.card_faces[0]);
      }
      return card;
    });
    this.separateByRarity();
  }
  isPreferredPrint(card, other) {
    if (other && other.frame_effects && other.frame_effects.includes('extendedart')) return false;
    return card.full_art || (Array.isArray(card.frame_effects) && card.frame_effects.length);
  }
  separateByRarity() {
    this.ratios.forEach(group => group.cards = new Map());

    for (const card of this.cards) {
      const groups = this.ratios.filter(group => group.rarities.includes(card.rarity));
      groups.forEach(group => {
        const existingCard = group.cards.get(card.oracle_id);
        if (!existingCard || this.isPreferredPrint(card, existingCard)) {
          group.cards.set(card.oracle_id, card);
        }
      });
    }
  }
  generatePack() {
    const pack = new Map();
    let numOfLands = 0;
    for (const group of this.ratios) {
      let cardsChosen = 0;
      const cardPool = Array.from(group.cards);
      while (cardsChosen < group.count) {
        const [orace_id, card] = cardPool[randomInt(0, cardPool.length)];
        const isLand = card.type_line?.toLowerCase().includes('land');
        if (isLand && numOfLands === MAX_LANDS_PER_PACK) continue;

        if (!pack.has(orace_id) && !this.#selectedMythics.has(orace_id)) {
          pack.set(orace_id, card);
          if (card.rarity === 'mythic') this.#selectedMythics.add(orace_id);
          if (isLand) numOfLands++;
          cardsChosen++;
        }
      }
    }
    return Array.from(pack.values());
  }
}
