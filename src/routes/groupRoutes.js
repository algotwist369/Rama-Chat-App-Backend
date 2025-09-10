const express = require('express');
const {
    createGroup,
    getGroups,
    getAllGroups,
    getGroupById,
    getGroupMembers,
    joinGroup,
    leaveGroup,
    addUserToGroup,
    removeUserFromGroup,
    addManager,
    removeManager
} = require('../controllers/groupController');
const auth = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(auth); // all routes require auth

router.post('/', requireRole(['admin', 'manager']), createGroup);
router.get('/', getGroups);
router.get('/all', requireRole(['admin']), getAllGroups);
router.get('/:id', getGroupById);
router.get('/:groupId/members', getGroupMembers);
router.post('/:groupId/join', joinGroup);
router.post('/:groupId/leave', leaveGroup);
router.post('/:groupId/users/:userId', requireRole(['admin']), addUserToGroup);
router.delete('/:groupId/users/:userId', requireRole(['admin']), removeUserFromGroup);
router.post('/:groupId/managers/:userId', requireRole(['admin']), addManager);
router.delete('/:groupId/managers/:userId', requireRole(['admin']), removeManager);

module.exports = router;
