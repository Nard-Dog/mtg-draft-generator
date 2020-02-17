# MTG Draft Generator

## Prerequisites

- NodeJS v12+
- Google Cloud Account
- Google Cloud Service Account key installed locally

## Installation

```bash
npm run i
```

## Environment Variables

Create a `.env` file with the following variables
```bash
SAVE_FILE_PATH= # Path to your TTS Saves folder
STORAGE_URL= # Google Cloud Storage API i.e. https://storage.googleapis.com
STORAGE_BUCKET= # Google Cloud Storage Bucket i.e. mtg-decks
STORAGE_BUCKET_FOLDER= # Google Cloud Storage Bucket folder i.e. random-decks
DRAFT_SETS= # Comma-separated list of sets to include i.e. thb,m20,eld
NUM_PLAYERS= # Number of players drafting
NUM_ROUNDS= # Number of rounds
RARITY_RATIOS= # JSON mapping of rarity ratios i.e. {"common":7,"uncommon":5,"rare":2,"rare|mythic":1}
```

## Usage

```bash
npm run generate
```