import express from 'express';
import * as controllers from '../controllers/chat';

const router = express.Router();

router.get('/conversations', controllers.getConversations);
router.get('/conversations/:conversationId/messages', controllers.getMessages);
router.post('/conversations/direct', controllers.createDirectConversation);
router.post('/conversations/group', controllers.createGroupConversation);
router.post('/conversations/:conversationId/messages', controllers.sendMessage);
router.post('/conversations/:conversationId/read', controllers.markAsRead);

// Group management routes
router.post('/conversations/:conversationId/members/add', controllers.addGroupMembers);
router.post('/conversations/:conversationId/members/remove', controllers.removeGroupMember);
router.post('/conversations/:conversationId/members/leave', controllers.leaveGroup);
router.put('/conversations/:conversationId/title', controllers.updateGroupTitle);
router.delete('/conversations/:conversationId/dismiss', controllers.dismissGroup);

export default router;
