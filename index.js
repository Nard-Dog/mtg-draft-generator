require('dotenv').config();

const fs = require('fs-extra');
const scryfall = require('./libs/scryfall');
const { SaveFile, Deck } = require('./libs/tts');
const PackRandomizer = require('./libs/pack-randomizer');

const {
	DRAFT_STYLE,
	SAVE_FILE_PATH
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

const twoSidedLayouts = new Set(['transform', 'modal_dfc']);

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
		const saveFile = new SaveFile();

		const decks = await fs.readJson('./constructed-decks.json');
		for (const deckId of Object.values(decks)) {
			const deck = await scryfall.fetchDeck(deckId), primaryCards = [], outsideCards = [], tokens = new Map();
			console.log(`Constructing deck ${deck.name}`);
			const primaryEntries = [...deck.entries.commanders, ...deck.entries.nonlands, ...deck.entries.lands].filter(entry => entry.card_digest?.id);
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
			let z = start.posZ;
			const mainDeck = new Deck(deck.name, primaryCards);
			mainDeck.setTransform({ posX: start.posX + i * 3, posZ: z });
			await saveFile.addDeck(mainDeck);
			if (outsideCards.length) {
				const outsideDeck = new Deck(`${deck.name} - Outside`, outsideCards);
				outsideDeck.setTransform({ posX: start.posX + i * 3, posZ: (z -= 4) });
				await saveFile.addDeck(outsideDeck);
			}
			if (tokens.size) {
				const tokensDeck = new Deck(`${deck.name} - Tokens`, Array.from(tokens.values()));
				tokensDeck.setTransform({ posX: start.posX + i * 3, posZ: (z -= 4) });
				await saveFile.addDeck(tokensDeck);
			}
		}
		await fs.outputFile(`${SAVE_FILE_PATH}/MTG_Constructed_Decks.json`, saveFile.toString(), { encoding: 'utf8' });
	}
}

draftsByStyle[DRAFT_STYLE]()
.then(() => console.log(`Save file successfully created`))
.catch(err => console.log(err))
.finally(() => scryfall.saveCache());