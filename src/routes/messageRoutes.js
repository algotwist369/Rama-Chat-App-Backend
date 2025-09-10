const express = require('express');
const {
    sendMessage,
    getMessages,
    editMessage,
    deleteMessage,
    searchMessages,
    forwardMessage,
    markAsDelivered,
    markAsSeen
} = require('../controllers/messageController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.use(auth);

router.post('/', sendMessage);
router.get('/search', searchMessages);
router.get('/:groupId', getMessages);
router.put('/:messageId', editMessage);
router.delete('/:messageId', deleteMessage);
router.post('/:messageId/forward', forwardMessage);
router.post('/delivered', markAsDelivered);
router.post('/seen', markAsSeen);

module.exports = router;
