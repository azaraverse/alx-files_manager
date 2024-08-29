const express = require('express');
const AppController = require('../controllers/AppController');
const UsersController = require('../controllers/UsersController');

const router = express.Router();

// router.use(express.json());

// get status and stats endpoints
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

// post users endpoint
router.post('/users', UsersController.postNew);

module.exports = router;
