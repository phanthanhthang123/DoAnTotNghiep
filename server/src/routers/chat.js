import express from 'express';
import multer from 'multer';
import * as controllers from '../controllers/chat';

const chatAttachmentMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

const attachmentUploadMiddleware = (req, res, next) => {
  chatAttachmentMulter.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Tệp tối đa 20MB' : err.message || 'Upload thất bại';
      return res.status(400).json({ err: 1, msg });
    }
    next();
  });
};

const router = express.Router();

router.get('/conversations', controllers.getConversations);
router.get('/conversations/:conversationId/messages', controllers.getMessages);
router.post('/conversations/direct', controllers.createDirectConversation);
router.post('/conversations/group', controllers.createGroupConversation);
router.post('/conversations/:conversationId/messages', controllers.sendMessage);
router.post('/conversations/:conversationId/read', controllers.markAsRead);
router.post('/upload', attachmentUploadMiddleware, controllers.uploadAttachment);

// Group management routes
router.post('/conversations/:conversationId/members/add', controllers.addGroupMembers);
router.post('/conversations/:conversationId/members/remove', controllers.removeGroupMember);
router.post('/conversations/:conversationId/members/leave', controllers.leaveGroup);
router.put('/conversations/:conversationId/title', controllers.updateGroupTitle);
router.delete('/conversations/:conversationId/dismiss', controllers.dismissGroup);

export default router;
