const thumbnail = require('image-thumbnail');
const fs = require('fs');

const filePath = './image.jpg';
const option = { width: 250 };

thumbnail(filePath, option)
  .then(thumbnail => {
    const thumbPath = `${filePath}_250`;
    fs.writeFileSync(thumbPath, thumbnail);
    console.log(`Thumbnail saved to ${thumbPath}`);
  })
  .catch(err => console.error(err));
