const express = require('express');
const memoryController = require('../controllers/memoryController');
const router = express.Router();

router.get('/memory/usage', memoryController.getMemoryUsage);
router.get('/memory/details', memoryController.getMemoryDetails);

module.exports = router;