const thumbnail = require('image-thumbnail');

async function generateThumbnail() {
  try {
    const options = { width: 100, height: 100, responseType: 'base64' };
    const thumb = await thumbnail('./bmp.png', options);

    console.log(thumb);
  } catch (err) {
    console.error(err);
  }
};

generateThumbnail();
