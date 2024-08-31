const express = require('express');
const AppController = require('../controllers/AppController');
const UsersController = require('../controllers/UsersController');
const AuthController = require('../controllers/AuthController');
const FilesController = require('../controllers/FilesController');

const router = express.Router();

// get status and stats endpoints
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

// post users endpoint
router.post('/users', UsersController.postNew);

// authenticated user endpoints
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);
router.get('/users/me', UsersController.getMe);

// files upload endpoint
router.post('/files', FilesController.postUpload);

// files retrieval endpoints
router.get('/files/:id', FilesController.getShow);

module.exports = router;
