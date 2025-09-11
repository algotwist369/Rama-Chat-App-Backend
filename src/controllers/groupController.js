const Group = require('../models/Group');
const User = require('../models/User');
const Message = require('../models/Message');

const createGroup = async (req, res) => {
    try {
        const { name, region } = req.body;
        const createdBy = req.user._id;

        const group = await Group.create({
            name,
            region,
            createdBy,
            managers: [createdBy],
            users: [createdBy],
        });

        // Update user's groupId
        await User.findByIdAndUpdate(createdBy, { groupId: group._id });

        res.status(201).json({
            message: 'Group created successfully',
            group: await group.populate(['createdBy', 'managers', 'users']),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getGroups = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query; // Increased limit
        const skip = (page - 1) * limit;
        const userId = req.user._id;

        // Base query to only get groups where user is a member
        const baseQuery = { 
            $or: [
                { users: userId },
                { managers: userId }
            ]
        };

        const searchQuery = search
            ? {
                ...baseQuery,
                $and: [
                    baseQuery,
                    {
                        $or: [
                            { name: { $regex: search, $options: 'i' } },
                            { region: { $regex: search, $options: 'i' } },
                        ]
                    }
                ]
            }
            : baseQuery;

        // Use aggregation for better performance with large groups
        const groups = await Group.aggregate([
            { $match: searchQuery },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'createdBy',
                    pipeline: [{ $project: { username: 1, email: 1 } }]
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'managers',
                    foreignField: '_id',
                    as: 'managers',
                    pipeline: [{ $project: { username: 1, email: 1, isOnline: 1, lastSeen: 1 } }]
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'users',
                    foreignField: '_id',
                    as: 'users',
                    pipeline: [{ $project: { username: 1, email: 1, role: 1, isOnline: 1, lastSeen: 1 } }]
                }
            },
            {
                $addFields: {
                    createdBy: { $arrayElemAt: ['$createdBy', 0] },
                    memberCount: { $size: '$users' },
                    managerCount: { $size: '$managers' },
                    totalMembers: { $add: [{ $size: '$users' }, { $size: '$managers' }] }
                }
            }
        ]);

        const total = await Group.countDocuments(searchQuery);

        res.json({
            groups,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: error.message });
    }
};

const getGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(id)
            .populate('createdBy', 'username email role')
            .populate('managers', 'username email role isOnline lastSeen')
            .populate('users', 'username email role isOnline lastSeen');

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if user is a member of this group
        const isMember = group.users.some(user => user._id.toString() === userId.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
        }

        res.json({ group });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const joinGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Check if already a member
        if (group.users.includes(userId)) {
            return res.status(400).json({ error: 'Already a member of this group' });
        }

        // Add user to group
        group.users.push(userId);
        await group.save();

        // Update user's groupId
        await User.findByIdAndUpdate(userId, { groupId });

        res.json({ message: 'Successfully joined the group' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const leaveGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Remove user from group
        group.users.pull(userId);
        group.managers.pull(userId);
        await group.save();

        // Clear user's groupId
        await User.findByIdAndUpdate(userId, { groupId: null });

        res.json({ message: 'Successfully left the group' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const addUserToGroup = async (req, res) => {
    try {
        const { groupId, userId } = req.params;

        // Check if current user is admin or group creator
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        if (req.user.role !== 'admin' && !group.createdBy.equals(req.user._id)) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user is already a member
        if (group.users.includes(userId)) {
            return res.status(400).json({ error: 'User is already a member of this group' });
        }

        // Add user to group
        group.users.push(userId);
        await group.save();

        // Update user's groupId and set join timestamp
        await User.findByIdAndUpdate(userId, { 
            groupId, 
            groupJoinedAt: new Date() 
        });

        // Emit real-time event to all group members
        const io = req.app.get('io');
        if (io) {
            const updatedGroup = await Group.findById(groupId)
                .populate('users', 'username email role isOnline lastSeen')
                .populate('managers', 'username email role isOnline lastSeen');
            
            io.to(`group:${groupId}`).emit('group:updated', {
                group: updatedGroup,
                action: 'user_added',
                user: { _id: user._id, username: user.username, email: user.email }
            });

            // Notify the added user specifically
            io.to(`user:${userId}`).emit('group:joined', {
                group: updatedGroup,
                message: `You have been added to ${group.name}`
            });
        }

        res.json({ message: 'User added to group successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const addManager = async (req, res) => {
    try {
        const { groupId, userId } = req.params;

        // Check if current user is admin or group creator
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        if (req.user.role !== 'admin' && !group.createdBy.equals(req.user._id)) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Add user as manager (and to users array if not already there)
        if (!group.managers.includes(userId)) {
            group.managers.push(userId);
            
            // Also add to users array if not already there
            if (!group.users.includes(userId)) {
                group.users.push(userId);
            }
            
            await group.save();

            // Update user role and groupId
            await User.findByIdAndUpdate(userId, { 
                role: 'manager',
                groupId: groupId
            });

            // Emit real-time event to all group members
            const io = req.app.get('io');
            if (io) {
                const updatedGroup = await Group.findById(groupId)
                    .populate('users', 'username email role isOnline lastSeen')
                    .populate('managers', 'username email role isOnline lastSeen');
                
                io.to(`group:${groupId}`).emit('group:updated', {
                    group: updatedGroup,
                    action: 'manager_added',
                    user: { _id: user._id, username: user.username, email: user.email }
                });

                // Notify the promoted user specifically
                io.to(`user:${userId}`).emit('role:updated', {
                    group: { _id: group._id, name: group.name },
                    newRole: 'manager',
                    message: `You have been promoted to manager in ${group.name}`
                });
            }
        }

        res.json({ message: 'User promoted to manager' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const removeUserFromGroup = async (req, res) => {
    try {
        const { groupId, userId } = req.params;

        // Check if current user is admin or group creator
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        if (req.user.role !== 'admin' && !group.createdBy.equals(req.user._id)) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Check if user is a member
        if (!group.users.includes(userId)) {
            return res.status(400).json({ error: 'User is not a member of this group' });
        }

        // Get user info before removal
        const user = await User.findById(userId);

        // Remove user from group (both users and managers arrays)
        group.users.pull(userId);
        group.managers.pull(userId);
        await group.save();

        // Clear user's groupId and reset role to user
        await User.findByIdAndUpdate(userId, { 
            groupId: null,
            role: 'user'
        });

        // Emit real-time event to all group members
        const io = req.app.get('io');
        if (io) {
            const updatedGroup = await Group.findById(groupId)
                .populate('users', 'username email role isOnline lastSeen')
                .populate('managers', 'username email role isOnline lastSeen');
            
            io.to(`group:${groupId}`).emit('group:updated', {
                group: updatedGroup,
                action: 'user_removed',
                user: { _id: user._id, username: user.username, email: user.email }
            });

            // Notify the removed user specifically
            io.to(`user:${userId}`).emit('group:left', {
                group: { _id: group._id, name: group.name },
                message: `You have been removed from ${group.name}`
            });
        }

        res.json({ message: 'User removed from group successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const removeManager = async (req, res) => {
    try {
        const { groupId, userId } = req.params;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        if (req.user.role !== 'admin' && !group.createdBy.equals(req.user._id)) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Get user info before removal
        const user = await User.findById(userId);

        // Remove manager
        group.managers.pull(userId);
        await group.save();

        // Update user role back to user
        await User.findByIdAndUpdate(userId, { role: 'user' });

        // Emit real-time event to all group members
        const io = req.app.get('io');
        if (io) {
            const updatedGroup = await Group.findById(groupId)
                .populate('users', 'username email role isOnline lastSeen')
                .populate('managers', 'username email role isOnline lastSeen');
            
            io.to(`group:${groupId}`).emit('group:updated', {
                group: updatedGroup,
                action: 'manager_removed',
                user: { _id: user._id, username: user.username, email: user.email }
            });

            // Notify the demoted user specifically
            io.to(`user:${userId}`).emit('role:updated', {
                group: { _id: group._id, name: group.name },
                newRole: 'user',
                message: `Your manager privileges have been removed from ${group.name}`
            });
        }

        res.json({ message: 'Manager privileges removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getAllGroups = async (req, res) => {
    try {
        // Only admins can see all groups
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;

        const searchQuery = search
            ? {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { region: { $regex: search, $options: 'i' } },
                ],
            }
            : {};

        const groups = await Group.find(searchQuery)
            .populate('createdBy', 'username email')
            .populate('managers', 'username email')
            .populate('users', 'username email role isOnline lastSeen')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Group.countDocuments(searchQuery);

        res.json({
            groups,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getGroupMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        // Verify user is a member of the group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const isMember = group.users.includes(userId) || group.managers.includes(userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
        }

        // Get all group members with their online status
        const allMemberIds = [...group.users, ...group.managers];
        const members = await User.find({ _id: { $in: allMemberIds } })
            .select('username email isOnline lastSeen role')
            .lean();

        // Separate users and managers
        const users = members.filter(member => group.users.includes(member._id));
        const managers = members.filter(member => group.managers.includes(member._id));

        res.json({
            users,
            managers,
            totalMembers: members.length,
            onlineMembers: members.filter(member => member.isOnline).length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
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
    removeManager,
};
