class PackRandomizer {
    constructor(cards, ratios) {
        this.cards = cards;
        this.ratios = ratios;
        this.cardsByRarity = this.separateByRarity(cards);
    }
    randomNumber(range) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(Math.floor(Math.random() * range));
            }, 10);
        });
    }
    isPreferredPrint(card) {
        return card.full_art || card.promo || (Array.isArray(card.frame_effects) && card.frame_effects.length);
    }
    separateByRarity() {
        const cardsByRarity = new Map();
        Object.keys(this.ratios).forEach(group => cardsByRarity.set(group, new Map()));
    
        for (const card of this.cards) {
            const groups = Object.keys(this.ratios).filter(group => group.includes(card.rarity));
            groups.forEach(group => {
                if (!cardsByRarity.get(group).has(card.oracle_id) || this.isPreferredPrint(card)) {
                    cardsByRarity.get(group).set(card.oracle_id, card);
                }
            });
        }
    
        return cardsByRarity;
    }
    async generatePack() {
        const pack = new Map();
        for (const group in this.ratios) {
            let cardsChosen = 0;
            const cardPool = Array.from(this.cardsByRarity.get(group));
            while (cardsChosen < this.ratios[group]) {
                const randomIndex = await this.randomNumber(cardPool.length);
                const [orace_id, card] = cardPool[randomIndex];
                if (!pack.has(orace_id)) {
                    pack.set(orace_id, card);
                    cardsChosen++;
                }
            }
        }
        return Array.from(pack.values());
    }
}

module.exports = PackRandomizer;