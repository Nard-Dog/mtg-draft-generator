class PackRandomizer {
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
    async generatePack() {
        const pack = new Map();
        for (const group of this.ratios) {
            let cardsChosen = 0;
            const cardPool = Array.from(group.cards);
            while (cardsChosen < group.count) {
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