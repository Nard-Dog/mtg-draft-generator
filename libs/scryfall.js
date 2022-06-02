const fetch = require('node-fetch');
const fs = require('fs-extra');
const cache = {
	cards: fs.pathExistsSync('.cache/cards.json') ? fs.readJsonSync('.cache/cards.json') : {},
	decks: fs.pathExistsSync('.cache/decks.json') ? fs.readJsonSync('.cache/decks.json') : {}
};

async function fetchPrints(oracleId) {
	const key = `prints-${oracleId}`;
	if (!cache[key]) {
		const url = new URL('https://api.scryfall.com/cards/search');
		url.searchParams.set('order', 'released');
		url.searchParams.set('unique', 'prints');
		url.searchParams.set('q', [`oracleid:${oracleId}`].join(' '));

		const res = await fetch(url.toString());
		if (res.ok) {
			const { data } = await res.json();
			cache[key] = data;
		}
	}
	return cache[key];
};

async function fetchAllCards(sets, basic = false, unique = false) {
	const filters = [basic ? 'type:basic' : '-type:basic'];
	if (unique) filters.push('unique:prints');
	const setFilter = sets.map(set => `set:${set}`).join(' OR ');
	filters.push(`(${setFilter})`);

	let cards = [], moreCards = true, page = 1;
	while (moreCards) {
		const url = new URL('https://api.scryfall.com/cards/search');
		url.searchParams.set('q', filters.join(' '));
		url.searchParams.set('page', page++);

		const res = await fetch(url.toString());
		if (res.ok) {
			const { has_more, data } = await res.json();
			if (data) cards = cards.concat(data);
			moreCards = has_more || false;
		} else {
			moreCards = false;
		}
	}
	if (basic) return cards;
	// Find high-res cards if possible
	const qualityCards = [];
	for (const card of cards) {
		let qualityCard = card;
		if (!card.highres_image) {
			const prints = await fetchPrints(card.oracle_id);
			const highRes = prints.find(print => print.highres_image);
			if (highRes) qualityCard = highRes;
		}
		qualityCards.push(qualityCard);
	}
	return qualityCards;
};

module.exports = {
	fetchCards(sets) {
		return fetchAllCards(sets);
	},
	fetchBasicLands(sets) {
		return fetchAllCards(sets, true, true);
	},
	fetchTokens(sets) {
		const tokenSets = sets.map(set => 't' + set);
		return fetchAllCards(tokenSets);
	},
	async fetchDeck(id) {
		if (!cache.decks[id]) {
			const deck = await fetch(`https://api.scryfall.com/decks/${id}/export/json`).then(res => res.json()).catch(err => null);
			if (deck) cache.decks[id] = deck;
		}
		return cache.decks[id];
	},
	async fetchCardById(id) {
		if (!cache.cards[id]) {
			const card = await fetch(`https://api.scryfall.com/cards/${id}`).then(res => res.json()).catch(err => null);
			if (card) cache.cards[id] = card;
		}
		return cache.cards[id];
	},
	async saveCache() {
		await fs.outputJson('.cache/cards.json', cache.cards);
		await fs.outputJson('.cache/decks.json', cache.decks);
	}
}