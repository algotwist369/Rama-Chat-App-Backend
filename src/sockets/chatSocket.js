const { Server } = require('socket.io');
const { verify } = require('../utils/token');
const Message = require('../models/Message');
const Group = require('../models/Group');
const extractTags = require('../utils/parser');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');
require('dotenv').config();

function initSocket(server, redisAdapter, app) {
  const io = new Server(server, { 
    cors: { 
      origin: ['https://rama.ciphra.in', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    } 
  });
  if (redisAdapter) io.adapter(redisAdapter);

  // Attach io instance to the app so controllers can access it
  app.set('io', io);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    console.log('Socket authentication attempt:', {
      hasToken: !!token,
      tokenLength: token?.length,
      socketId: socket.id
    });

    if (!token) {
      console.log('Socket authentication failed: No token provided');
      return next(new Error('unauth'));
    }

    try {
      const payload = verify(token);
      console.log('Socket authentication successful:', {
        userId: payload.sub,
        role: payload.role,
        socketId: socket.id
      });
      socket.userId = payload.sub;
      next();
    } catch (e) {
      console.log('Socket authentication failed: Token verification error:', e.message);
      next(new Error('unauth'));
    }
  });

  io.on('connection', async (socket) => {
    // join user into a personal room and group room
    const user = await User.findById(socket.userId);
    if (!user) return socket.disconnect();

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date()
    });

    socket.join(`user:${user._id}`);
    if (user.groupId) socket.join(`group:${user.groupId.toString()}`);

    // Join admin room if user is admin
    if (user.role === 'admin') {
      socket.join('admin:room');
    }

    // Notify group members that user is online
    if (user.groupId) {
      console.log(`Emitting user:online to group:${user.groupId.toString()}`);
      socket.to(`group:${user.groupId.toString()}`).emit('user:online', {
        userId: socket.userId,
        username: user.username,
        isOnline: true
      });
    }

    // Also notify admins about user online status
    console.log('Emitting user:online to admin:room');
    socket.to('admin:room').emit('user:online', {
      userId: socket.userId,
      username: user.username,
      isOnline: true
    });

    // Emit to the user's personal room as well for immediate feedback
    socket.emit('user:online', {
      userId: socket.userId,
      username: user.username,
      isOnline: true
    });

    // Broadcast to all connected clients for global online status updates
    io.emit('user:status:changed', {
      userId: socket.userId,
      username: user.username,
      isOnline: true,
      timestamp: new Date()
    });

    // Handle admin room joining
    socket.on('join:admin', () => {
      if (user.role === 'admin') {
        socket.join('admin:room');
        console.log(`Admin ${user.username} joined admin room`);
      }
    });

    // Test endpoint for manual online status trigger
    socket.on('test:online-status', () => {
      console.log(`Testing online status for user ${user.username}`);

      // Emit to group members
      if (user.groupId) {
        socket.to(`group:${user.groupId.toString()}`).emit('user:online', {
          userId: socket.userId,
          username: user.username,
          isOnline: true,
          test: true
        });
      }

      // Emit to admins
      socket.to('admin:room').emit('user:online', {
        userId: socket.userId,
        username: user.username,
        isOnline: true,
        test: true
      });
    });

    // Handle group joining/leaving
    socket.on('group:join', async ({ groupId }) => {
      console.log(`User ${user.username} (${socket.userId}) joining group: ${groupId}`);
      socket.join(`group:${groupId}`);
      console.log(`Socket joined room: group:${groupId}`);

      // Emit user joined event to group members (excluding the user who joined)
      socket.to(`group:${groupId}`).emit('user:joined', {
        userId: socket.userId,
        username: user.username
      });

      // Send notification to group members (stored in database, not real-time)
      const group = await Group.findById(groupId).populate('users managers');
      if (group) {
        const notification = {
          type: 'user_joined',
          title: `${user.username} joined the group`,
          message: `${user.username} has joined ${group.name}`,
          groupId: groupId,
          groupName: group.name,
          createdAt: new Date()
        };

        // Send to all group members except the user who joined
        const allMembers = [...(group.users || []), ...(group.managers || [])];
        for (const member of allMembers) {
          if (member._id.toString() !== socket.userId) {
            await sendNotification(member._id, notification);
            // Don't emit real-time notification to avoid duplicate toasts
          }
        }
      }
    });

    socket.on('group:leave', async ({ groupId }) => {
      socket.leave(`group:${groupId}`);
      socket.to(`group:${groupId}`).emit('user:left', {
        userId: socket.userId,
        username: user.username
      });

      // Send notification to group members (stored in database, not real-time)
      const group = await Group.findById(groupId).populate('users managers');
      if (group) {
        const notification = {
          type: 'user_left',
          title: `${user.username} left the group`,
          message: `${user.username} has left ${group.name}`,
          groupId: groupId,
          groupName: group.name,
          createdAt: new Date()
        };

        // Send to all group members except the user who left
        const allMembers = [...(group.users || []), ...(group.managers || [])];
        for (const member of allMembers) {
          if (member._id.toString() !== socket.userId) {
            await sendNotification(member._id, notification);
            // Don't emit real-time notification to avoid duplicate toasts
          }
        }
      }
    });

    socket.on('message:send', async (payload, ack) => {
      const { text, file, groupId, targetGroups } = payload;
      const tags = extractTags(text);

      // Use the groupId from payload or user's default group
      const targetGroupId = groupId || user.groupId;

      // Only forward to explicitly mentioned groups or if targetGroups is specified
      let forwardedGroups = [];
      if (targetGroups && targetGroups.length > 0) {
        // If targetGroups is specified, use those
        forwardedGroups = await Group.find({ _id: { $in: targetGroups } });
      } else if (tags.length > 0) {
        // Only forward to groups if explicitly tagged with @groupname
        forwardedGroups = await Group.find({ region: { $in: tags } });
      }

      // Create the original message in the target group
      const msg = await Message.create({
        senderId: user._id,
        groupId: targetGroupId,
        text,
        file,
        tags,
        forwardedToGroups: forwardedGroups.map(g => g._id)
      });

      // Populate the message with sender information
      const populatedMsg = await Message.findById(msg._id)
        .populate('senderId', 'username email')
        .populate('groupId', 'name region')
        .lean();

      // Emit to the target group
      io.to(`group:${targetGroupId}`).emit('message:new', populatedMsg);

      // Create separate message records for each forwarded group to ensure persistence
      const forwardedMessages = [];
      for (const group of forwardedGroups) {
        const forwardedMsg = await Message.create({
          senderId: user._id,
          groupId: group._id,
          text,
          file,
          tags,
          forwardedFrom: msg._id,
          forwardedToGroups: forwardedGroups.map(g => g._id)
        });

        // Populate the forwarded message
        const populatedForwardedMsg = await Message.findById(forwardedMsg._id)
          .populate('senderId', 'username email')
          .populate('groupId', 'name region')
          .lean();

        forwardedMessages.push(populatedForwardedMsg);

        // Emit to the forwarded group
        io.to(`group:${group._id}`).emit('message:new', {
          ...populatedForwardedMsg,
          isForwarded: true,
          originalGroup: { _id: targetGroupId, name: populatedMsg.groupId.name }
        });
      }

      // Send notifications for new messages
      const group = await Group.findById(targetGroupId).populate('users managers');
      if (group) {
        const notification = {
          type: 'message',
          title: `New message from ${user.username}`,
          message: text || 'Sent a file',
          groupId: targetGroupId,
          groupName: group.name,
          senderId: user._id,
          senderUsername: user.username,
          createdAt: new Date()
        };

        // Send to all group members except the sender
        const allMembers = [...(group.users || []), ...(group.managers || [])];
        for (const member of allMembers) {
          if (member._id.toString() !== socket.userId) {
            await sendNotification(member._id, notification);
            // Emit real-time notification to user
            io.to(`user:${member._id}`).emit('notification:new', notification);
          }
        }
      }

      // Send notifications to forwarded groups as well
      for (const forwardedGroup of forwardedGroups) {
        const forwardedGroupData = await Group.findById(forwardedGroup._id).populate('users managers');
        if (forwardedGroupData) {
          const forwardedNotification = {
            type: 'message',
            title: `New message from ${user.username} (from ${group.name})`,
            message: text || 'Sent a file',
            groupId: forwardedGroup._id,
            groupName: forwardedGroup.name,
            senderId: user._id,
            senderUsername: user.username,
            createdAt: new Date()
          };

          // Send to all forwarded group members except the sender
          const allForwardedMembers = [...(forwardedGroupData.users || []), ...(forwardedGroupData.managers || [])];
          for (const member of allForwardedMembers) {
            if (member._id.toString() !== socket.userId) {
              await sendNotification(member._id, forwardedNotification);
              // Emit real-time notification to user
              io.to(`user:${member._id}`).emit('notification:new', forwardedNotification);
            }
          }
        }
      }

      ack?.({ ok: true, id: msg._id });
    });

    // typing indicator - only emit to the specific group
    socket.on('typing:start', ({ groupId }) => {
      console.log(`User ${user.username} started typing in group: ${groupId}`);
      // Verify user is actually in this group before showing typing indicator
      socket.to(`group:${groupId}`).emit('typing:start', {
        userId: socket.userId,
        username: user.username,
        groupId: groupId
      });
    });
    socket.on('typing:stop', ({ groupId }) => {
      console.log(`User ${user.username} stopped typing in group: ${groupId}`);
      // Verify user is actually in this group before stopping typing indicator
      socket.to(`group:${groupId}`).emit('typing:stop', {
        userId: socket.userId,
        username: user.username,
        groupId: groupId
      });
    });

    socket.on('disconnect', async () => {
      // Update user offline status and last seen
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      });

      // Notify group members that user is offline
      if (user.groupId) {
        console.log(`Emitting user:offline to group:${user.groupId.toString()}`);
        socket.to(`group:${user.groupId.toString()}`).emit('user:offline', {
          userId: socket.userId,
          username: user.username,
          isOnline: false,
          lastSeen: new Date()
        });
      }

      // Also notify admins about user offline status
      console.log('Emitting user:offline to admin:room');
      socket.to('admin:room').emit('user:offline', {
        userId: socket.userId,
        username: user.username,
        isOnline: false,
        lastSeen: new Date()
      });

      // Emit to the user's personal room as well for immediate feedback
      socket.emit('user:offline', {
        userId: socket.userId,
        username: user.username,
        isOnline: false,
        lastSeen: new Date()
      });

      // Broadcast to all connected clients for global online status updates
      io.emit('user:status:changed', {
        userId: socket.userId,
        username: user.username,
        isOnline: false,
        lastSeen: new Date(),
        timestamp: new Date()
      });
    });
  });

  return io;
}

module.exports = initSocket;
