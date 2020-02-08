const { createCanvas, loadImage } = require('canvas');
const { uuid } = require('uuidv4');
const { Storage } = require('@google-cloud/storage');

const {
    STORAGE_BUCKET: bucketName,
    STORAGE_URL: storageURL,
    STORAGE_BUCKET_FOLDER: bucketFolder
} = process.env;

const storage = new Storage();
const bucket = storage.bucket(bucketName);

const maxCols = 4;
const dimensions = {
    width: 672,
    height: 936
};

async function uploadImage(buffer) {
    const filePath = `${bucketFolder}/${uuid()}.jpg`;
    const file = bucket.file(filePath);
    await file.save(buffer);
    return `${storageURL}/${bucketName}/${filePath}`;
}

async function generate(images) {
    const numCols = Math.min(images.length, maxCols);
    const numRows = Math.ceil(images.length / numCols);
    const canvas = createCanvas(numCols * dimensions.width, numRows * dimensions.height);
    const ctx = canvas.getContext('2d');

    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const i = (row * numCols) + col;
            if (i >= images.length) break;
            const image = await loadImage(images[i]);
            const [x, y] = [col * dimensions.width, row * dimensions.height];
            ctx.drawImage(image, x, y);
        }
    }

    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.85, progressive: true });
    return {
        url: await uploadImage(buffer),
        rows: numRows,
        cols: numCols
    }
}

module.exports = { generate };