require('dotenv').config();

const request = require('request-promise-native');
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket(process.env.STORAGE_BUCKET);

async function fetchAllCards(sets, basic = false) {
    const filters = ['type:basic', 'set:thb'];
    try {
        const res = await request('https://api.scryfall.com/cards/search', { qs: { q: filters.join(' ') }, json: true });
        return res.data;
    } catch (err) {
        return [];
    }
};

fetchAllCards()
.then(cards => console.log(cards))
.catch(err => console.log(err));