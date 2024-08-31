/* eslint-disable no-return-await */
import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}/${database}`;

    MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
      if (err) {
        console.error(`Error connecting to MongoDB: ${err}`);
        this.db = null;
      } else {
        this.db = client.db(database);
        this.users = this.db.collection('users');
        this.files = this.db.collection('files');
      }
    });
  }

  isAlive() {
    return !!this.db; // returns true if this.db is not null
  }

  async nbUsers() {
    return await this.users.countDocuments();
  }

  async nbFiles() {
    return await this.files.countDocuments();
  }
}

const dbClient = new DBClient();

module.exports = dbClient;
