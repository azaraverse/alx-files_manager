import sha1 from 'sha1';
const dbClient = require('../utils/db');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ "error": "Missing email" });
    }
    if (!password) {
      return res.status(400).json({ "error": "Missing password" });
    }

    const user = await dbClient.users.findOne({ email });
    if (user) {
      return res.status(400).json({ "error": "Already exist" });
    }

    const hashedPwd = sha1(password);
    const newUser = await dbClient.users.insertOne({ email, password: hashedPwd });

    return res.status(201).json({ "id": newUser.insertedId, "email": email });
  };
};

module.exports = UsersController;
