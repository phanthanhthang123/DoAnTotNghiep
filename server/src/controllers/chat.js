import * as services from '../services/chat';
import jwt from 'jsonwebtoken';
import { uploadFileBuffer, isCloudinaryConfigured, getSignedUrl } from '../config/cloudinary';

const getUserIdFromToken = (req) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '')
    : req.cookies?.accessToken || null;

  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch (error) {
    return null;
  }
};

export const getConversations = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { workspaceId } = req.query;
    const response = await services.getConversationsService(userId, workspaceId);
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT GET CONVERSATIONS: ' + error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { conversationId } = req.params;
    const { page = 1, limit = 30 } = req.query;
    const response = await services.getMessagesService(conversationId, userId, page, limit);
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT GET MESSAGES: ' + error.message });
  }
};

export const createDirectConversation = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { targetUserId, workspaceId } = req.body;
    if (!targetUserId) return res.status(400).json({ err: 1, msg: 'MISSING targetUserId' });
    const response = await services.createDirectConversationService(userId, targetUserId, workspaceId);
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT CREATE DIRECT CONVERSATION: ' + error.message });
  }
};

export const createGroupConversation = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { title, memberIds, workspaceId } = req.body;
    const response = await services.createGroupConversationService(userId, title, memberIds, workspaceId);
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT CREATE GROUP CONVERSATION: ' + error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { conversationId } = req.params;
    const response = await services.sendMessageService(conversationId, userId, req.body);
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT SEND MESSAGE: ' + error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { conversationId } = req.params;
    const response = await services.markAsReadService(conversationId, userId);
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT MARK AS READ: ' + error.message });
  }
};

const emitSystemMessage = (req, conversationId, systemMessage) => {
  if (!systemMessage) return;
  const io = req.app.get('io');
  if (!io) return;
  const plainMessage = typeof systemMessage.toJSON === 'function' ? systemMessage.toJSON() : systemMessage;
  io.to(`conversation:${conversationId}`).emit('message:new', {
    conversationId,
    message: plainMessage,
  });
};

export const addGroupMembers = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { conversationId } = req.params;
    const { memberIds } = req.body;
    const response = await services.addGroupMembersService(conversationId, userId, memberIds);
    if (!response.err && response.response?.systemMessage) {
      emitSystemMessage(req, conversationId, response.response.systemMessage);
    }
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT ADD GROUP MEMBERS: ' + error.message });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { conversationId } = req.params;
    const { targetUserId } = req.body;
    const response = await services.removeGroupMemberService(conversationId, userId, targetUserId);
    if (!response.err && response.response?.systemMessage) {
      emitSystemMessage(req, conversationId, response.response.systemMessage);
    }
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT REMOVE GROUP MEMBER: ' + error.message });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { conversationId } = req.params;
    const response = await services.leaveGroupService(conversationId, userId);
    if (!response.err && response.response?.systemMessage) {
      emitSystemMessage(req, conversationId, response.response.systemMessage);
    }
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT LEAVE GROUP: ' + error.message });
  }
};

export const updateGroupTitle = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { conversationId } = req.params;
    const { title } = req.body;
    const response = await services.updateGroupTitleService(conversationId, userId, title);
    if (!response.err && response.response?.systemMessage) {
      emitSystemMessage(req, conversationId, response.response.systemMessage);
      const io = req.app.get('io');
      if (io) {
        io.emit('conversation:renamed', { conversationId, title });
      }
    }
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT UPDATE GROUP TITLE: ' + error.message });
  }
};

export const dismissGroup = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });
    const { conversationId } = req.params;
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation:dismissed', { conversationId });
    }
    const response = await services.dismissGroupService(conversationId, userId);
    return res.status(response.err ? 400 : 200).json(response);
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT DISMISS GROUP: ' + error.message });
  }
};

export const uploadAttachment = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ err: 1, msg: 'UNAUTHORIZED' });

    if (!req.file) {
      return res.status(400).json({ err: 1, msg: 'No file uploaded' });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(500).json({ err: 1, msg: 'Cloudinary is not configured' });
    }

    const mimetype = req.file.mimetype || '';
    let resourceType = 'auto';
    if (mimetype.startsWith('image/')) {
      resourceType = 'image';
    } else if (mimetype.startsWith('video/')) {
      resourceType = 'video';
    } else {
      resourceType = 'raw';
    }

    const originalName = req.file.originalname || 'file';
    const lastDotIndex = originalName.lastIndexOf('.');
    const ext = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';
    const baseName = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const publicId = `${cleanBaseName}-${Date.now()}${ext}`;

    const result = await uploadFileBuffer(req.file.buffer, {
      resourceType,
      publicId,
      folder: 'doan-chat-attachments',
      contentDisposition: `attachment; filename="${encodeURIComponent(originalName)}"`,
    });

    const fileUrl = getSignedUrl(result.public_id, resourceType) || result.secure_url;

    return res.status(200).json({
      err: 0,
      msg: 'Upload attachment successful',
      response: {
        url: fileUrl,
        public_id: result.public_id,
        filename: originalName,
        mimetype,
      },
    });
  } catch (error) {
    return res.status(500).json({ err: -1, msg: 'FAILED AT UPLOAD ATTACHMENT: ' + error.message });
  }
};

