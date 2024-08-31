const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AppController {
  static getStatus(req, res) {
    try {
      res.status(200).json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
    } catch (err) {
      res.status(500).json({ error: 'Error checking status' });
    }
  }

  static async getStats(req, res) {
    try {
      res.status(200).json({ users: await dbClient.nbUsers(), files: await dbClient.nbFiles() });
    } catch (err) {
      res.status(500).json({ error: 'Error fetching users and files' });
    }
  }
}

module.exports = AppController;
