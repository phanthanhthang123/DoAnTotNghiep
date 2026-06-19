import db from '../models';
import { v4 } from 'uuid';
import { Op } from 'sequelize';

const getMemberUserInclude = () => ({
  model: db.Users,
  as: 'user',
  attributes: ['id', 'username', 'email', 'avatarUrl'],
});

const ensureMembership = async (conversationId, userId) => {
  return db.Conversation_Member.findOne({
    where: { conversation_id: conversationId, user_id: userId },
  });
};

export const getConversationsService = (userId, workspaceId) =>
  new Promise(async (resolve) => {
    try {
      const membershipWhere = { user_id: userId };

      const memberships = await db.Conversation_Member.findAll({
        where: membershipWhere,
        include: [
          {
            model: db.Conversation,
            as: 'conversation',
            where: workspaceId ? { workspace_id: workspaceId } : undefined,
            include: [
              {
                model: db.Conversation_Member,
                as: 'members',
                include: [getMemberUserInclude()],
              },
            ],
          },
        ],
      });

      const conversationIds = memberships.map((m) => m.conversation_id);
      if (conversationIds.length === 0) {
        return resolve({ err: 0, msg: 'OK', response: [] });
      }

      const lastMessages = await db.Message.findAll({
        where: {
          conversation_id: conversationIds,
          deleted_at: null,
        },
        include: [{ model: db.Users, as: 'sender', attributes: ['id', 'username', 'email', 'avatarUrl'] }],
        order: [['createdAt', 'DESC']],
      });

      const unreadCounts = await db.Message.findAll({
        attributes: ['conversation_id', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']],
        where: {
          conversation_id: conversationIds,
          deleted_at: null,
        },
        group: ['conversation_id'],
      });

      const unreadMap = unreadCounts.reduce((acc, row) => {
        acc[row.conversation_id] = Number(row.get('count') || 0);
        return acc;
      }, {});

      const lastMessageMap = {};
      for (const message of lastMessages) {
        if (!lastMessageMap[message.conversation_id]) {
          lastMessageMap[message.conversation_id] = message;
        }
      }

      const response = memberships.map((m) => {
        const convo = m.conversation;
        const currentMember = convo.members?.find((cm) => String(cm.user_id) === String(userId));
        const lastReadAt = currentMember?.last_read_at ? new Date(currentMember.last_read_at) : null;
        const totalUnread = unreadMap[convo.id] || 0;
        const lastMessage = lastMessageMap[convo.id] || null;
        let unreadCount = totalUnread;
        if (lastReadAt) {
          unreadCount = lastMessages.filter(
            (msg) =>
              msg.conversation_id === convo.id &&
              String(msg.sender_id) !== String(userId) &&
              new Date(msg.createdAt) > lastReadAt
          ).length;
        } else {
          unreadCount = lastMessages.filter(
            (msg) => msg.conversation_id === convo.id && String(msg.sender_id) !== String(userId)
          ).length;
        }
        return {
          ...convo.toJSON(),
          lastMessage,
          unreadCount,
        };
      });

      response.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt
          ? new Date(a.lastMessage.createdAt).getTime()
          : new Date(a.updatedAt).getTime();
        const bTime = b.lastMessage?.createdAt
          ? new Date(b.lastMessage.createdAt).getTime()
          : new Date(b.updatedAt).getTime();
        return bTime - aTime;
      });

      resolve({ err: 0, msg: 'OK', response });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO GET CONVERSATIONS: ' + error.message, response: [] });
    }
  });

export const getMessagesService = (conversationId, userId, page = 1, limit = 30) =>
  new Promise(async (resolve) => {
    try {
      const membership = await ensureMembership(conversationId, userId);
      if (!membership) {
        return resolve({ err: 1, msg: 'FORBIDDEN' });
      }

      const offset = (Number(page) - 1) * Number(limit);
      const messages = await db.Message.findAll({
        where: { conversation_id: conversationId, deleted_at: null },
        include: [{ model: db.Users, as: 'sender', attributes: ['id', 'username', 'email', 'avatarUrl'] }],
        order: [['createdAt', 'DESC']],
        limit: Number(limit),
        offset,
      });

      resolve({ err: 0, msg: 'OK', response: messages.reverse() });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO GET MESSAGES: ' + error.message, response: [] });
    }
  });

export const createDirectConversationService = (userId, targetUserId, workspaceId) =>
  new Promise(async (resolve) => {
    try {
      if (userId === targetUserId) {
        return resolve({ err: 1, msg: 'CANNOT CHAT WITH YOURSELF' });
      }

      const existingMemberships = await db.Conversation_Member.findAll({
        where: { user_id: { [Op.in]: [userId, targetUserId] } },
        include: [
          {
            model: db.Conversation,
            as: 'conversation',
            where: { type: 'direct' },
          },
        ],
      });

      const grouped = existingMemberships.reduce((acc, m) => {
        acc[m.conversation_id] = acc[m.conversation_id] || [];
        acc[m.conversation_id].push(m.user_id);
        return acc;
      }, {});

      const existingConversationId = Object.keys(grouped).find((cid) => {
        const users = grouped[cid];
        return users.includes(userId) && users.includes(targetUserId);
      });

      if (existingConversationId) {
        const conversation = await db.Conversation.findByPk(existingConversationId, {
          include: [{ model: db.Conversation_Member, as: 'members', include: [getMemberUserInclude()] }],
        });
        return resolve({ err: 0, msg: 'OK', response: conversation });
      }

      const conversationId = v4();
      const now = new Date();
      await db.Conversation.create({
        id: conversationId,
        type: 'direct',
        workspace_id: workspaceId || null,
        created_by: userId,
        createdAt: now,
        updatedAt: now,
      });

      await db.Conversation_Member.bulkCreate([
        {
          id: v4(),
          conversation_id: conversationId,
          user_id: userId,
          role: 'owner',
          joined_at: now,
          last_read_at: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: v4(),
          conversation_id: conversationId,
          user_id: targetUserId,
          role: 'member',
          joined_at: now,
          last_read_at: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const conversation = await db.Conversation.findByPk(conversationId, {
        include: [{ model: db.Conversation_Member, as: 'members', include: [getMemberUserInclude()] }],
      });
      resolve({ err: 0, msg: 'OK', response: conversation });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO CREATE DIRECT CONVERSATION: ' + error.message });
    }
  });

export const createGroupConversationService = (userId, title, memberIds, workspaceId) =>
  new Promise(async (resolve) => {
    try {
      const uniqueMemberIds = [...new Set([userId, ...(memberIds || [])])];
      if (uniqueMemberIds.length < 2) {
        return resolve({ err: 1, msg: 'GROUP MUST HAVE AT LEAST 2 MEMBERS' });
      }

      const conversationId = v4();
      const now = new Date();
      await db.Conversation.create({
        id: conversationId,
        type: 'group',
        title: title?.trim() || 'Nhóm mới',
        workspace_id: workspaceId || null,
        created_by: userId,
        createdAt: now,
        updatedAt: now,
      });

      await db.Conversation_Member.bulkCreate(
        uniqueMemberIds.map((id) => ({
          id: v4(),
          conversation_id: conversationId,
          user_id: id,
          role: id === userId ? 'owner' : 'member',
          joined_at: now,
          last_read_at: id === userId ? now : null,
          createdAt: now,
          updatedAt: now,
        }))
      );

      const conversation = await db.Conversation.findByPk(conversationId, {
        include: [{ model: db.Conversation_Member, as: 'members', include: [getMemberUserInclude()] }],
      });

      resolve({ err: 0, msg: 'OK', response: conversation });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO CREATE GROUP CONVERSATION: ' + error.message });
    }
  });

export const sendMessageService = (conversationId, senderId, payload) =>
  new Promise(async (resolve) => {
    try {
      const membership = await ensureMembership(conversationId, senderId);
      if (!membership) return resolve({ err: 1, msg: 'FORBIDDEN' });

      const content = payload?.content?.trim();
      if (!content) return resolve({ err: 1, msg: 'MESSAGE CONTENT IS REQUIRED' });

      const now = new Date();
      const message = await db.Message.create({
        id: v4(),
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        type: payload?.type || 'text',
        attachment_url: payload?.attachment_url || null,
        reply_to_id: payload?.reply_to_id || null,
        createdAt: now,
        updatedAt: now,
      });

      await db.Conversation.update({ updatedAt: now }, { where: { id: conversationId } });
      await db.Conversation_Member.update(
        { last_read_at: now, updatedAt: now },
        { where: { conversation_id: conversationId, user_id: senderId } }
      );

      const fullMessage = await db.Message.findByPk(message.id, {
        include: [{ model: db.Users, as: 'sender', attributes: ['id', 'username', 'email', 'avatarUrl'] }],
      });
      resolve({ err: 0, msg: 'OK', response: fullMessage });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO SEND MESSAGE: ' + error.message });
    }
  });

export const markAsReadService = (conversationId, userId) =>
  new Promise(async (resolve) => {
    try {
      const membership = await ensureMembership(conversationId, userId);
      if (!membership) return resolve({ err: 1, msg: 'FORBIDDEN' });

      await membership.update({ last_read_at: new Date() });
      resolve({ err: 0, msg: 'OK' });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO MARK AS READ: ' + error.message });
    }
  });

export const editMessageService = (messageId, userId, content) =>
  new Promise(async (resolve) => {
    try {
      const message = await db.Message.findByPk(messageId);
      if (!message) return resolve({ err: 1, msg: 'MESSAGE NOT FOUND' });
      if (String(message.sender_id) !== String(userId)) {
        return resolve({ err: 1, msg: 'FORBIDDEN' });
      }
      if (!content || !content.trim()) {
        return resolve({ err: 1, msg: 'MESSAGE CONTENT IS REQUIRED' });
      }
      await message.update({
        content: content.trim(),
        edited_at: new Date(),
        updatedAt: new Date(),
      });
      const fullMessage = await db.Message.findByPk(message.id, {
        include: [{ model: db.Users, as: 'sender', attributes: ['id', 'username', 'email', 'avatarUrl'] }],
      });
      resolve({ err: 0, msg: 'OK', response: fullMessage });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO EDIT MESSAGE: ' + error.message });
    }
  });

export const deleteMessageService = (messageId, userId) =>
  new Promise(async (resolve) => {
    try {
      const message = await db.Message.findByPk(messageId);
      if (!message) return resolve({ err: 1, msg: 'MESSAGE NOT FOUND' });
      if (String(message.sender_id) !== String(userId)) {
        return resolve({ err: 1, msg: 'FORBIDDEN' });
      }
      await message.update({
        deleted_at: new Date(),
        updatedAt: new Date(),
      });
      resolve({ err: 0, msg: 'OK', response: { id: message.id, conversation_id: message.conversation_id } });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO DELETE MESSAGE: ' + error.message });
    }
  });

export const togglePinMessageService = (messageId, userId, isPinned) =>
  new Promise(async (resolve) => {
    try {
      const message = await db.Message.findByPk(messageId);
      if (!message) return resolve({ err: 1, msg: 'MESSAGE NOT FOUND' });

      const membership = await db.Conversation_Member.findOne({
        where: {
          conversation_id: message.conversation_id,
          user_id: userId,
        },
      });
      if (!membership) {
        return resolve({ err: 1, msg: 'FORBIDDEN' });
      }

      await message.update({
        is_pinned: Boolean(isPinned),
        pinned_by: Boolean(isPinned) ? userId : null,
        updatedAt: new Date(),
      });
      const fullMessage = await db.Message.findByPk(message.id, {
        include: [{ model: db.Users, as: 'sender', attributes: ['id', 'username', 'email', 'avatarUrl'] }],
      });
      resolve({ err: 0, msg: 'OK', response: fullMessage });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO PIN MESSAGE: ' + error.message });
    }
  });

export const addGroupMembersService = (conversationId, userId, memberIds) =>
  new Promise(async (resolve) => {
    try {
      const conversation = await db.Conversation.findByPk(conversationId);
      if (!conversation) return resolve({ err: 1, msg: 'CONVERSATION NOT FOUND' });
      if (conversation.type !== 'group') return resolve({ err: 1, msg: 'NOT A GROUP CONVERSATION' });

      const requesterMember = await db.Conversation_Member.findOne({
        where: { conversation_id: conversationId, user_id: userId },
        include: [{ model: db.Users, as: 'user', attributes: ['username'] }]
      });
      if (!requesterMember || requesterMember.role !== 'owner') {
        return resolve({ err: 1, msg: 'ONLY GROUP CREATOR CAN ADD MEMBERS' });
      }

      const now = new Date();
      const newMembers = [];
      const addedUsernames = [];
      for (const id of memberIds) {
        const targetUser = await db.Users.findByPk(id);
        if (!targetUser) continue;
        const exists = await db.Conversation_Member.findOne({
          where: { conversation_id: conversationId, user_id: id }
        });
        if (!exists) {
          const newMember = await db.Conversation_Member.create({
            id: v4(),
            conversation_id: conversationId,
            user_id: id,
            role: 'member',
            joined_at: now,
            last_read_at: null,
            createdAt: now,
            updatedAt: now,
          });
          newMembers.push(newMember);
          addedUsernames.push(targetUser.username);
        }
      }

      await conversation.update({ updatedAt: now });

      let systemMessage = null;
      if (addedUsernames.length > 0) {
        const performerName = requesterMember.user?.username || 'Trưởng nhóm';
        const content = `${performerName} đã thêm ${addedUsernames.join(', ')} vào nhóm`;
        const msgRow = await db.Message.create({
          id: v4(),
          conversation_id: conversationId,
          sender_id: userId,
          content,
          type: 'system',
          createdAt: now,
          updatedAt: now,
        });
        systemMessage = await db.Message.findByPk(msgRow.id, {
          include: [{ model: db.Users, as: 'sender', attributes: ['id', 'username', 'email', 'avatarUrl'] }],
        });
      }

      resolve({ err: 0, msg: 'OK', response: { newMembers, systemMessage } });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO ADD GROUP MEMBERS: ' + error.message });
    }
  });

export const removeGroupMemberService = (conversationId, userId, targetUserId) =>
  new Promise(async (resolve) => {
    try {
      const conversation = await db.Conversation.findByPk(conversationId);
      if (!conversation) return resolve({ err: 1, msg: 'CONVERSATION NOT FOUND' });
      if (conversation.type !== 'group') return resolve({ err: 1, msg: 'NOT A GROUP CONVERSATION' });

      const requesterMember = await db.Conversation_Member.findOne({
        where: { conversation_id: conversationId, user_id: userId },
        include: [{ model: db.Users, as: 'user', attributes: ['username'] }]
      });
      if (!requesterMember || requesterMember.role !== 'owner') {
        return resolve({ err: 1, msg: 'ONLY GROUP CREATOR CAN REMOVE MEMBERS' });
      }

      if (String(userId) === String(targetUserId)) {
        return resolve({ err: 1, msg: 'CREATOR CANNOT REMOVE THEMSELVES, USE LEAVE GROUP INSTEAD' });
      }

      const targetMember = await db.Conversation_Member.findOne({
        where: { conversation_id: conversationId, user_id: targetUserId },
        include: [{ model: db.Users, as: 'user', attributes: ['username'] }]
      });
      if (!targetMember) return resolve({ err: 1, msg: 'MEMBER NOT IN GROUP' });

      const targetName = targetMember.user?.username || 'Thành viên';
      await targetMember.destroy();
      
      const now = new Date();
      await conversation.update({ updatedAt: now });

      const performerName = requesterMember.user?.username || 'Trưởng nhóm';
      const content = `${performerName} đã xóa ${targetName} khỏi nhóm`;
      const msgRow = await db.Message.create({
        id: v4(),
        conversation_id: conversationId,
        sender_id: userId,
        content,
        type: 'system',
        createdAt: now,
        updatedAt: now,
      });
      const systemMessage = await db.Message.findByPk(msgRow.id, {
        include: [{ model: db.Users, as: 'sender', attributes: ['id', 'username', 'email', 'avatarUrl'] }],
      });

      resolve({ err: 0, msg: 'OK', response: { systemMessage } });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO REMOVE GROUP MEMBER: ' + error.message });
    }
  });

export const leaveGroupService = (conversationId, userId) =>
  new Promise(async (resolve) => {
    try {
      const conversation = await db.Conversation.findByPk(conversationId);
      if (!conversation) return resolve({ err: 1, msg: 'CONVERSATION NOT FOUND' });
      if (conversation.type !== 'group') return resolve({ err: 1, msg: 'NOT A GROUP CONVERSATION' });

      const member = await db.Conversation_Member.findOne({
        where: { conversation_id: conversationId, user_id: userId },
        include: [{ model: db.Users, as: 'user', attributes: ['username'] }]
      });
      if (!member) return resolve({ err: 1, msg: 'MEMBER NOT IN GROUP' });

      const username = member.user?.username || 'Thành viên';
      const isOwner = member.role === 'owner';
      await member.destroy();

      if (isOwner) {
        const nextMember = await db.Conversation_Member.findOne({
          where: { conversation_id: conversationId },
          order: [['joined_at', 'ASC']]
        });
        if (nextMember) {
          await nextMember.update({ role: 'owner' });
        } else {
          await conversation.destroy();
        }
      }

      const now = new Date();
      await conversation.update({ updatedAt: now });

      const content = `${username} đã rời khỏi nhóm`;
      const msgRow = await db.Message.create({
        id: v4(),
        conversation_id: conversationId,
        sender_id: userId,
        content,
        type: 'system',
        createdAt: now,
        updatedAt: now,
      });
      const systemMessage = await db.Message.findByPk(msgRow.id, {
        include: [{ model: db.Users, as: 'sender', attributes: ['id', 'username', 'email', 'avatarUrl'] }],
      });

      resolve({ err: 0, msg: 'OK', response: { systemMessage } });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO LEAVE GROUP: ' + error.message });
    }
  });

export const updateGroupTitleService = (conversationId, userId, newTitle) =>
  new Promise(async (resolve) => {
    try {
      const conversation = await db.Conversation.findByPk(conversationId);
      if (!conversation) return resolve({ err: 1, msg: 'CONVERSATION NOT FOUND' });
      if (conversation.type !== 'group') return resolve({ err: 1, msg: 'NOT A GROUP CONVERSATION' });

      const member = await db.Conversation_Member.findOne({
        where: { conversation_id: conversationId, user_id: userId },
        include: [{ model: db.Users, as: 'user', attributes: ['username'] }]
      });
      if (!member || member.role !== 'owner') {
        return resolve({ err: 1, msg: 'ONLY GROUP CREATOR CAN EDIT TITLE' });
      }

      const oldTitle = conversation.title;
      await conversation.update({ title: newTitle.trim(), updatedAt: new Date() });

      const performerName = member.user?.username || 'Trưởng nhóm';
      const content = `${performerName} đã đổi tên nhóm từ "${oldTitle}" thành "${newTitle.trim()}"`;
      
      const now = new Date();
      const msgRow = await db.Message.create({
        id: v4(),
        conversation_id: conversationId,
        sender_id: userId,
        content,
        type: 'system',
        createdAt: now,
        updatedAt: now,
      });
      const systemMessage = await db.Message.findByPk(msgRow.id, {
        include: [{ model: db.Users, as: 'sender', attributes: ['id', 'username', 'email', 'avatarUrl'] }],
      });

      resolve({ err: 0, msg: 'OK', response: { systemMessage } });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO UPDATE GROUP TITLE: ' + error.message });
    }
  });

export const dismissGroupService = (conversationId, userId) =>
  new Promise(async (resolve) => {
    try {
      const conversation = await db.Conversation.findByPk(conversationId);
      if (!conversation) return resolve({ err: 1, msg: 'CONVERSATION NOT FOUND' });
      if (conversation.type !== 'group') return resolve({ err: 1, msg: 'NOT A GROUP CONVERSATION' });

      const member = await db.Conversation_Member.findOne({
        where: { conversation_id: conversationId, user_id: userId }
      });
      if (!member || member.role !== 'owner') {
        return resolve({ err: 1, msg: 'ONLY GROUP CREATOR CAN DISMISS GROUP' });
      }

      // Safe deletion sequence
      await db.Conversation_Member.destroy({ where: { conversation_id: conversationId } });
      await db.Message.destroy({ where: { conversation_id: conversationId } });
      await conversation.destroy();

      resolve({ err: 0, msg: 'OK' });
    } catch (error) {
      resolve({ err: 1, msg: 'FAILED TO DISMISS GROUP: ' + error.message });
    }
  });

