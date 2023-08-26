# MTG Draft Generator

## Prerequisites

- NodeJS v20+
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
GOOGLE_APPLICATION_CREDENTIALS= # Google Cloud credentials file location
STORAGE_URL= # Google Cloud Storage API i.e. https://storage.googleapis.com
STORAGE_BUCKET= # Google Cloud Storage Bucket i.e. mtg-decks
STORAGE_BUCKET_FOLDER= # Google Cloud Storage Bucket folder i.e. random-decks
```

## Usage

```bash
npm run generate:draft
```