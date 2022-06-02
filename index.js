require('dotenv').config();

const fs = require('fs-extra');
const fetch = require('node-fetch');
const scryfall = require('./libs/scryfall');
const { SavedObject, SaveFile, Deck } = require('./libs/tts');
const PackRandomizer = require('./libs/pack-randomizer');

const {
	DRAFT_STYLE,
	SAVE_FILE_PATH,
	FORMAT
} = process.env;

const {
	sets,
	numOfPlayers,
	numOfRounds,
	packRatios
} = fs.readJsonSync('.draft-config.json');

// Starting location for placing packs
const start = {
	posX: 1.75,
	posY: 1.5,
	posZ: -7.75
};

const twoSidedLayouts = new Set(['transform', 'modal_dfc', 'reversible_card']);

const draftsByStyle = {
	random: async function() {
		const saveFile = new SaveFile();

		console.log('Building packs...');
		const cards = await scryfall.fetchCards(sets);
		const cardFronts = cards.map(card => twoSidedLayouts.has(card.layout) ? { ...card, ...card.card_faces[0] } : card);
		const randomizer = new PackRandomizer(packRatios, cardFronts);
		
		for (let row = 0; row < numOfPlayers; row++) {
			for (let col = 0; col < numOfRounds; col++) {
				try {
					const i = (row * numOfRounds) + col;
					const pack = await randomizer.generatePack();
					const deck = new Deck(`Pack ${i + 1}`, pack);
					deck.setTransform({
						posX: (start.posX + col * 3),
						posZ: (start.posZ - row * 4)
					});
					await saveFile.addDeck(deck);
					console.log(`⤷ Pack ${i + 1} created`);
				} catch (err) {
					console.log(err);
				}
			}
		}

		const cardBacks = cards.filter(card => twoSidedLayouts.has(card.layout)).map(card => ({ ...card, ...card.card_faces[1] }));
		if (cardBacks.length) {
			console.log(`Building card backs...`);
			const cardBacksDeck = new Deck(`Card Backs`, cardBacks);
			cardBacksDeck.setTransform({ posX: start.posX - 3.5, posZ: start.posZ, rotZ: 0 });
			await saveFile.addDeck(cardBacksDeck);
		}

		const basicLands = await scryfall.fetchBasicLands(sets);
		if (basicLands.length) {
			console.log(`Building lands...`);
			const landDeck = new Deck(`Lands`, basicLands);
			landDeck.setTransform({ posX: start.posX - 6.5, posZ: start.posZ, rotZ: 0 });
			await saveFile.addDeck(landDeck);
		}

		const tokens = await scryfall.fetchTokens(sets);
		if (tokens.length) {
			console.log(`Building tokens...`);
			const tokenDeck = new Deck(`Tokens`, tokens);
			tokenDeck.setTransform({ posX: start.posX - 9.5, posZ: start.posZ, rotZ: 0 });
			await saveFile.addDeck(tokenDeck);
		}

		await fs.outputFile(`${SAVE_FILE_PATH}/MTG_Random_Draft.json`, saveFile.toString(), { encoding: 'utf8' });
	},
	openSet: async function() {
		const saveFile = new SaveFile();

		for (const [i, set] of sets.entries()) {
			const posX = start.posX + i * 3, setName = set.toUpperCase();
			let posZ = start.posZ;
			
			const cards = await scryfall.fetchCards([set]);
			if (!cards?.length) throw new Error(`No cards exist for set: ${setName}`);

			const cardFronts = cards.map(card => twoSidedLayouts.has(card.layout) ? { ...card, ...card.card_faces[0] } : card);
			if (cardFronts.length) {
				console.log(`Building set ${setName}...`);
				const setDeck = new Deck(`Set ${setName}`, cardFronts);
				setDeck.setTransform({ posX, posZ });
				await saveFile.addDeck(setDeck);
			}

			const cardBacks = cards.filter(card => twoSidedLayouts.has(card.layout)).map(card => ({ ...card, ...card.card_faces[1] }));
			if (cardBacks.length) {
				console.log(`Building card backs for ${setName}...`);
				const cardBacksDeck = new Deck(`Card Backs ${setName}`, cardBacks);
				cardBacksDeck.setTransform({ posX, posZ: (posZ -= 4), rotZ: 0 });
				await saveFile.addDeck(cardBacksDeck);
			}

			const basicLands = await scryfall.fetchBasicLands([set]);
			if (basicLands.length) {
				console.log(`Building lands for ${setName}...`);
				const landDeck = new Deck(`Lands ${setName}`, basicLands);
				landDeck.setTransform({ posX, posZ: (posZ -= 4), rotZ: 0 });
				await saveFile.addDeck(landDeck);
			}

			const tokens = await scryfall.fetchTokens([set]);
			if (tokens.length) {
				console.log(`Building tokens for ${setName}...`);
				const tokenDeck = new Deck(`Tokens ${setName}`, tokens);
				tokenDeck.setTransform({ posX, posZ: (posZ -= 4), rotZ: 0 });
				await saveFile.addDeck(tokenDeck);
			}
		}
		
		await fs.outputFile(`${SAVE_FILE_PATH}/MTG_Open_Set_Draft.json`, saveFile.toString(), { encoding: 'utf8' });
	},
	constructed: async function() {
		const decks = require('./constructed-decks');
		for (const { id } of decks[FORMAT]) {
			const savedObject = new SavedObject();
			const deck = await scryfall.fetchDeck(id);
			const primaryCards = [], outsideCards = [], tokens = new Map();

			console.log(`Constructing deck ${deck.name}`);
			const primaryEntries = [
				...(deck.entries.commanders ?? deck.entries.mainboard),
				...(deck.entries.nonlands ?? []),
				...(deck.entries.lands ?? [])
			].filter(entry => entry.card_digest?.id);
			const outsideEntries = deck.entries.outside?.filter(entry => entry.card_digest?.id) ?? [];

			for (const entry of primaryEntries) {
				console.log(`⤷ fetching info for ${entry.card_digest.name}...`);
				let card = await scryfall.fetchCardById(entry.card_digest.id);
				if (twoSidedLayouts.has(card.layout)) {
					tokens.set(card.id, {...card, ...card.card_faces[1] });
					card = {...card, ...card.card_faces[0] };
				}
				for (let i = 0; i < entry.count; i++) {
					primaryCards.push(card);
				}
				for (const part of (card.all_parts || [])) {
					if (part.id !== card.id && ['meld_result', 'token'].includes(part.component)) {
						const token = await scryfall.fetchCardById(part.id);
						tokens.set(token.id, token);
					}
				}
			}

			for (const entry of outsideEntries) {
				console.log(`⤷ fetching info for ${entry.card_digest.name}...`);
				let card = await scryfall.fetchCardById(entry.card_digest.id);
				if (twoSidedLayouts.has(card.layout)) {
					tokens.set(card.id, {...card, ...card.card_faces[1] });
					card = {...card, ...card.card_faces[0] };
				}
				for (let i = 0; i < entry.count; i++) {
					outsideCards.push(card);
				}
				for (const part of (card.all_parts || [])) {
					if (part.id !== card.id && ['meld_result', 'token'].includes(part.component)) {
						const token = await scryfall.fetchCardById(part.id);
						tokens.set(token.id, token);
					}
				}
			}

			let x = 0
			const mainDeck = new Deck(deck.name, primaryCards);
			mainDeck.setTransform({ posX: x, posY: 0, posZ: 0 });
			await savedObject.addDeck(mainDeck);
			if (outsideCards.length) {
				const outsideDeck = new Deck(`${deck.name} - Outside`, outsideCards);
				outsideDeck.setTransform({ posX: (x += 3), posY: 0, posZ: 0 });
				await savedObject.addDeck(outsideDeck);
			}
			if (tokens.size) {
				const tokensDeck = new Deck(`${deck.name} - Tokens`, Array.from(tokens.values()));
				tokensDeck.setTransform({ posX: (x += 3), posY: 0, posZ: 0 });
				await savedObject.addDeck(tokensDeck);
			}

			const deckSlug = deck.name.toLowerCase().replace(/[^a-z0-9- ]+/g, '').trim().replace(/\s+/g, '-');
			await fs.outputFile(`${SAVE_FILE_PATH}/Saved Objects/${FORMAT}/${deckSlug}.json`, savedObject.toString(), { encoding: 'utf8' });

			if (deck.entries.commanders?.length) {
				const deckThumbnail = deck.entries.commanders[0].card_digest?.image_uris?.front;
				if (deckThumbnail) {
					const res = await fetch(deckThumbnail.replace('/large', '/png').replace('.jpg', '.png'));
					const buffer = await res.buffer();
					await fs.outputFile(`${SAVE_FILE_PATH}/Saved Objects/${FORMAT}/${deckSlug}.png`, buffer);
				}
			}
		}
	}
}

draftsByStyle[DRAFT_STYLE]()
.then(() => console.log(`Save file successfully created`))
.catch(err => console.log(err))
.finally(async () => {
	await scryfall.saveCache();
	await SaveFile.saveCache();
});