const uuid = require('uuid');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const sha1 = require('sha1');
const v4 = uuid.v4;

// write a decrypt function
function decrypt(encrypted) {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
};

class AuthController {
  static async getConnect(req, res) {
    const auth_key = req.headers.authorization;
    const encrypted = auth_key.split(' ')[1];

    if (!encrypted) {
      return res.status(401).json({ "error": "Unauthorized" });
    }

    const decrypted = decrypt(encrypted);
    const email = decrypted.split(':')[0];
    const password = decrypted.split(':')[1];

    const user = await dbClient.users.findOne({ email });
    if (!user || user.password !== sha1(password)) {
      return res.status(401).json({ "error": "Unauthorized" });
    }

    const randToken = v4();
    const key = `auth_${randToken}`;
    redisClient.set(key, user._id.toString(), 86400);
    return res.status(200).json({ "token": randToken });
  };

  static async getDisconnect(req, res) {
    const token = req.header('X-Token');

    if (!token) {
      return res.status(401).json({ "error": "Unauthorized" });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ "error": "Unauthorized" });
    }

    await redisClient.del(key);

    return res.status(204).send();
  };
};

module.exports = AuthController;
