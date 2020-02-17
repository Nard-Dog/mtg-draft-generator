const rarityRatios = JSON.parse(process.env.RARITY_RATIOS);

class PackRandomizer {
    constructor(cards) {
        this.cards = cards.map(card => {
            if (card.layout === 'transform') {
                return Object.assign({}, card, card.card_faces[0]);
            }
            return card;
        });
    }
    randomNumber(range) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(Math.floor(Math.random() * range));
            }, 10);
        });
    }
    isPreferredPrint(card, other) {
        if (other && other.frame_effects && other.frame_effects.includes('extendedart')) return false;
        return card.full_art || (Array.isArray(card.frame_effects) && card.frame_effects.length);
    }
    separateByRarity() {
        const cardsByRarity = new Map();
        Object.keys(rarityRatios).forEach(group => cardsByRarity.set(group, new Map()));
    
        for (const card of this.cards) {
            const groups = Object.keys(rarityRatios).filter(group => group.includes(card.rarity));
            groups.forEach(group => {
                const existingCard = cardsByRarity.get(group).get(card.oracle_id);
                if (!existingCard || this.isPreferredPrint(card, existingCard)) {
                    cardsByRarity.get(group).set(card.oracle_id, card);
                }
            });
        }
    
        return cardsByRarity;
    }
    async generatePack() {
        const cardsByRarity = this.separateByRarity(this.cards);
        const pack = new Map();
        for (const group in rarityRatios) {
            let cardsChosen = 0;
            const cardPool = Array.from(cardsByRarity.get(group));
            while (cardsChosen < rarityRatios[group]) {
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