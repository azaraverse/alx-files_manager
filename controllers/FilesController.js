const fs = require('fs');
const uuid = require('uuid');
const path = require('path');
const mime = require('mime-types');
const Queue = require('bull');
const { ObjectId } = require('mongodb');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

const { v4 } = uuid;

const fileQueue = new Queue('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    // Retrieve the user based on the token
    const token = req.header('X-Token');

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;
    const typeArray = ['folder', 'file', 'image'];

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    } if (!type || !typeArray.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    } if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId) {
      const parentFile = await dbClient.files.findOne({ _id: ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    if (type === 'folder') {
      const folder = await dbClient.files.insertOne({
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
      });
      return res.status(201).json({
        id: folder.insertedId,
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const fileName = v4();
    const localPath = path.join(folderPath, fileName);

    const decodedFileData = Buffer.from(data, 'base64');
    await fs.promises.writeFile(localPath, decodedFileData);

    const newFile = await dbClient.files.insertOne({
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
      localPath,
    });

    if (type === 'image') {
      const fileJob = await fileQueue.add({
        userId: userId.toString(),
        fileId: newFile.insertedId.toString(),
      });
      console.log(`Job added with ID: ${fileJob.id}`);
    }

    return res.status(201).json({
      id: newFile.insertedId,
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const files = await dbClient.files.findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
    if (!files || !files._id) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: files._id,
      userId: files.userId,
      name: files.name,
      type: files.type,
      isPublic: files.isPublic,
      parentId: files.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const pageNum = parseInt(req.query.page, 10) || 0;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || '0';

    let query;
    let folderIds = [];

    if (parentId === '0') {
      // find all files with parentId 0 or parentId matching _id of any file
      const folders = await dbClient.files.find({
        userId: ObjectId(userId),
        type: 'folder',
      }).toArray();

      folderIds = folders.map((folder) => folder._id.toString());
      // console.log('Folder IDs:', folderIds);

      query = {
        userId: ObjectId(userId),
        $or: [
          { parentId: 0 },
          { parentId: { $in: folderIds } },
        ],
      };
    } else {
      query = {
        userId: ObjectId(userId),
        parentId,
      };
    }
    // console.log('Constructed query:', query);

    const files = await dbClient.files.aggregate([
      {
        // first stage: match files based on parentId
        $match: query,
      },
      {
        // second stage: skip documents based on the current page
        $skip: pageNum * 20,
      },
      {
        // third stage: limit results to 20 per page
        $limit: 20,
      },
    ]).toArray();

    return res.status(200).send(files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    })));
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token');
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.files.findOne({ userId: ObjectId(userId), _id: ObjectId(id) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.files.updateOne({ _id: ObjectId(id) },
      {
        $set: { isPublic: true },
      });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId,
    });
  }

  static async putUnPublish(req, res) {
    const token = req.header('X-Token');
    const { id } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.files.findOne({ _id: ObjectId(id), userId: ObjectId(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.files.updateOne({ _id: ObjectId(id) },
      {
        $set: { isPublic: false },
      });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId,
    });
  }

  static async getFile(req, res) {
    const token = req.header('X-Token');
    const { id } = req.params;
    const { size } = req.query;

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    const file = await dbClient.files.findOne({ _id: ObjectId(id) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if ((!file.isPublic && !userId) || (userId && file.userId.toString() !== userId
    && !file.isPublic)) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    if (!file.localPath) {
      return res.status(404).json({ error: 'Not found' });
    }

    let filePath = file.localPath;

    if (size && ['500', '250', '100'].includes(size)) {
      const thumbnailPath = `${file.localPath}_${size}`;
      console.log(`Looking for thumbnail: ${thumbnailPath}`);
      if (fs.existsSync(thumbnailPath)) {
        filePath = thumbnailPath;
      } else {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    try {
      const data = await fs.promises.readFile(filePath);
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', data.length);
      return res.status(200).send(data);
    } catch (error) {
      console.error('Error reading file:', error);
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

module.exports = FilesController;
