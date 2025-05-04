const sharp = require('sharp');

const {logger} = require('./logger');

const resizeImage = async (base64, width, quality) => {
    width = parseInt(width); // e.g., 300 for phone/tablet
    quality = parseInt(quality);
    
    const matches = base64.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
    if (!matches)
        return base64; // fallback

    const mime = matches[1];
    const data = matches[2];

    const buffer = Buffer.from(data, 'base64');

    const resizedBuffer = await sharp(buffer)
            .resize({width})
            .jpeg({quality}) // convert to smaller jpeg
            .toBuffer();

    return `data:image/jpeg;base64,${resizedBuffer.toString('base64')}`;
};

module.exports = {resizeImage};