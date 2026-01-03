const express = require('express');
const diskController = require('../controllers/diskController');
const router = express.Router();

router.get('/disk/usage', diskController.getDiskUsage);
router.get('/disk/all', diskController.getAllDisks);

module.exports = router;