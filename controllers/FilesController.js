const fs = require('fs');
const uuid = require('uuid');
const path = require('path');
const { ObjectId } = require('mongodb');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

const { v4 } = uuid;

// write a decode function
function decode(encoded) {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

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

    const decodedFileData = decode(data);
    fs.writeFileSync(localPath, decodedFileData);

    const newFile = await dbClient.files.insertOne({
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
      localPath,
    });

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
    const parentId = req.query.parentId || 0;
    const pageNum = parseInt(req.query.page, 10) || 0;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const query = {
      userId: ObjectId(userId),
      parentId,
    };

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
}

module.exports = FilesController;
