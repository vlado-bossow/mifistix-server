const express = require('express');
const networkController = require('../controllers/networkController');
const router = express.Router();

router.get('/network/speed', networkController.getNetworkSpeed);
router.get('/network/speedtest', networkController.speedTest);
router.get('/network/interfaces', networkController.getNetworkInterfaces);
router.get('/network/history', networkController.getNetworkHistory);
router.get('/network/connections', networkController.getActiveConnections);

module.exports = router;