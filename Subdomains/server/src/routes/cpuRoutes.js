const express = require('express');
const cpuController = require('../controllers/cpuController');
const router = express.Router();

router.get('/cpu/usage', cpuController.getCpuUsage);
router.get('/cpu/detailed', cpuController.getDetailedCpuInfo);

module.exports = router;