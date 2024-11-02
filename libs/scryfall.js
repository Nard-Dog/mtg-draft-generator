import fs from 'fs/promises';

const cache = {
  cards: await import('../.cache/cards.json', { assert: { type: 'json' } })
    .then((module) => module.default)
    .catch(() => ({})),
  decks: await import('../.cache/decks.json', { assert: { type: 'json' } })
    .then((module) => module.default)
    .catch(() => ({}))
};

async function fetchPrints(oracleId) {
  const key = `prints-${oracleId}`;
  if (!cache[key]) {
    const url = new URL('https://api.scryfall.com/cards/search');
    url.searchParams.set('order', 'released');
    url.searchParams.set('unique', 'prints');
    url.searchParams.set('q', [`oracleid:${oracleId}`, 'game:paper'].join(' '));

    const res = await fetch(url.toString());
    if (res.ok) {
      const { data } = await res.json();
      cache[key] = data;
    }
  }
  return cache[key];
};

async function fetchAllCards(sets, basic = false, unique = false) {
  const filters = [basic ? 'type:basic' : '-type:basic', 'game:paper'];
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
    const prints = await fetchPrints(card.oracle_id);
    const highRes = prints
      .sort((a, b) => (b.frame_effects?.length ?? 0) - (a.frame_effects?.length ?? 0))
      .find(print => print.highres_image);
    if (highRes) qualityCard = highRes;
    qualityCards.push(qualityCard);
  }
  return qualityCards;
};

export function fetchCards(sets) {
  return fetchAllCards(sets);
}

export function fetchBasicLands(sets) {
  return fetchAllCards(sets, true, true);
}

export function fetchTokens(sets) {
  const tokenSets = sets.map(set => 't' + set);
  return fetchAllCards(tokenSets);
}

export async function fetchDeck(id) {
  if (!cache.decks[id]) {
    const deck = await fetch(`https://api.scryfall.com/decks/${id}/export/json`).then(res => res.json()).catch(() => null);
    if (deck) cache.decks[id] = deck;
  }
  return cache.decks[id];
}

export async function fetchCardById(id) {
  if (!cache.cards[id]) {
    const card = await fetch(`https://api.scryfall.com/cards/${id}`).then(res => res.json()).catch(() => null);
    if (card) cache.cards[id] = card;
  }
  return cache.cards[id];
}

export async function saveCache() {
  await fs.mkdir('.cache', { recursive: true });
  await fs.writeFile('.cache/cards.json', JSON.stringify(cache.cards), 'utf-8');
  await fs.writeFile('.cache/decks.json', JSON.stringify(cache.decks), 'utf-8');
}