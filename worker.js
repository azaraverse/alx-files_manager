const Queue = require('bull');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');
const { ObjectId } = require('mongodb');
const dbClient = require('./utils/db');

const fileQueue = new Queue('fileQueue');

console.log('Starting worker...');

fileQueue.process(async (job, done) => {
  console.log(`Processing job ID: ${job.id} for fileId: ${job.data.fileId}`);
  const { userId, fileId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await dbClient.files.findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });

  if (!file) {
    throw new Error('File not found');
  }

  const filePath = file.localPath;
  console.log(`Processing file: ${filePath}`);

  const sizes = [500, 250, 100];
  try {
    Promise.all(sizes.map(async (size) => {
      const thumbnail = await imageThumbnail(filePath, { width: size });
      const thumbPath = `${filePath}_${size}`;
      console.log(`Generating thumbnail: ${filePath}, size: ${size}`);
      return fs.writeFileSync(thumbPath, thumbnail);
    }))
      .then(() => {
        done();
      });
  } catch (err) {
    console.error('Failed with error:', err);
  }
});

fileQueue.on('error', (err) => {
  console.error('Queue error:', err.message);
});

fileQueue.on('completed', (job, result) => {
  console.log(`Job completed with result: ${result}`);
});

fileQueue.on('failed', (job, err) => {
  console.error(`Job failed with error: ${err.message}`);
});
