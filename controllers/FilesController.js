const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const fs = require('fs');
const uuid = require('uuid');
const path = require('path');
const { ObjectId } = require('mongodb');
const v4 = uuid.v4;

// write a decode function
function decode(encoded) {
  return Buffer.from(encoded, 'base64').toString('utf-8');
};

class FilesController {
  static async postUpload(req, res) {
    // Retrieve the user based on the token
    const token = req.header('X-Token');

    if (!token) {
      return res.status(401).json({ "error": "Unauthorized" });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ "error": "Unauthorized" });
    }

    const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ "error": "Unauthorized" });
    }

    const { name, type, parentId = 0, isPublic = false, data } = req.body;
    const typeArray = ['folder', 'file', 'image'];

    if (!name) {
      return res.status(400).json({ "error": "Missing name" });
    } else if (!type || !typeArray.includes(type)) {
      return res.status(400).json({ "error": "Missing type" });
    } else if (!data && type !== 'folder') {
      return res.status(400).json({ "error": "Missing data" });
    }

    if (parentId) {
      const parentFile = await dbClient.files.findOne({ _id: ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ "error": "Parent not found" });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ "error": "Parent is not a folder" });
      }
    }

    if (type === 'folder') {
      const folder = await dbClient.files.insertOne({
        userId: ObjectId(userId),
        name: name,
        type: type,
        isPublic: isPublic,
        parentId: parentId
      });
      return res.status(201).json({
        id: folder.insertedId,
        userId: ObjectId(userId),
        name: name,
        type: type,
        isPublic: isPublic,
        parentId: parentId
      });
    } else {
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
        name: name,
        type: type,
        isPublic: isPublic,
        parentId: parentId,
        localPath: localPath
      });

      return res.status(201).json({
        id: newFile.insertedId,
        userId: ObjectId(userId),
        name: name,
        type: type,
        isPublic: isPublic,
        parentId: parentId
      });
    }
  };
};

module.exports = FilesController;
