const request = require('request-promise-native');

async function fetchAllCards(sets, basic = false) {
    const filters = [basic ? 'type:basic' : '-type:basic'/*, 'include:extras', 'unique:prints'*/];
    const setFilter = sets.map(set => `set:${set}`).join(' OR ');
    filters.push(`(${setFilter})`);

    let cards = [], moreCards = true, page = 1;
    while (moreCards) {
        const res = await request('https://api.scryfall.com/cards/search', {
            qs: {
                q: filters.join(' '),
                page: page++
            },
            json: true
        });
        if (res.data) cards = cards.concat(res.data);
        moreCards = res.has_more || false;
    }
    return cards;
};

module.exports = {
    fetchCards(sets) {
        return fetchAllCards(sets);
    },
    fetchBasicLands(sets) {
        return fetchAllCards(sets, true);
    },
    fetchTokens(sets) {
        const tokenSets = sets.map(set => 't' + set);
        return fetchAllCards(tokenSets);
    }
}