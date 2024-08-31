const uuid = require('uuid');
const sha1 = require('sha1');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const { v4 } = uuid;

// write a decode function
function decode(encoded) {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

class AuthController {
  static async getConnect(req, res) {
    const authKey = req.headers.authorization;
    const encoded = authKey.split(' ')[1];

    if (!encoded) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = decode(encoded);
    const email = decoded.split(':')[0];
    const password = decoded.split(':')[1];

    const user = await dbClient.users.findOne({ email });
    if (!user || user.password !== sha1(password)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const randToken = v4();
    const key = `auth_${randToken}`;
    redisClient.set(key, user._id.toString(), 86400);
    return res.status(200).json({ token: randToken });
  }

  static async getDisconnect(req, res) {
    const token = req.header('X-Token');

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(key);

    return res.status(204).send();
  }
}

module.exports = AuthController;
