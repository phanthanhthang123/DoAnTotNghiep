import db from '../models';
import { v4 } from 'uuid';
import { createNotificationService } from './notification';

export const updateProjectProgress = async (projectId) => {
    try {
        const tasks = await db.Task.findAll({
            where: {
                project_id: projectId,
                isArchived: false
            }
        });

        const totalTasks = tasks.length;
        const doneTasks = tasks.filter(t => t.status === 'Done').length;
        const progressPercentage = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

        const [progressRecord, created] = await db.Progress.findOrCreate({
            where: { project_id: projectId },
            defaults: {
                progress: progressPercentage,
                updatedAt: new Date()
            }
        });

        if (!created) {
            await progressRecord.update({
                progress: progressPercentage,
                updatedAt: new Date()
            });
        }
        console.log(`[Progress Update] Project ${projectId} is now at ${progressPercentage}%`);
        return progressPercentage;
    } catch (error) {
        console.error('Failed to update project progress:', error);
    }
};

//CREATE TASK
export const createTaskService = (projectId, taskData, actorUserId) => new Promise(async (resolve, reject) => {
    try {
        // Check if a task with the same title already exists in this project
        const existingTask = await db.Task.findOne({
            where: {
                project_id: projectId,
                title: taskData.title.trim()
            }
        });

        if (existingTask) {
            return resolve({
                err: 1,
                msg: 'A task with this title already exists in this project'
            });
        }

        // Handle assignees - if it's an array, take the first one (or you can create a separate Task_Assignees table for multiple assignees)
        const assignedTo = Array.isArray(taskData.assignees) && taskData.assignees.length > 0
            ? taskData.assignees[0]
            : (taskData.assignees || null);

        const task = await db.Task.create({
            project_id: projectId,
            assigned_to: assignedTo,
            title: taskData.title.trim(),
            description: taskData.description || "",
            status: taskData.status,
            priority: taskData.priority || 'Medium',
            difficulty: taskData.difficulty || 'Medium',
            dueDate: taskData.dueDate || null,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'FAILED TO CREATE TASK'
            });
        }

        await updateProjectProgress(projectId);

        if (assignedTo) {
            const actor = actorUserId ? await db.Users.findByPk(actorUserId, { attributes: ['username'] }) : null;
            const actorName = actor?.username || 'Một người dùng';
            const project = await db.Project.findByPk(projectId, { attributes: ['id', 'workspace_id'] });
            await createNotificationService(
                String(assignedTo),
                `${actorName} đã giao cho bạn task: ${task.title}`,
                {
                    type: 'task',
                    taskId: String(task.id),
                    projectId: String(projectId),
                    workspaceId: project?.workspace_id ? String(project.workspace_id) : null,
                }
            );
        }

        resolve({
            err: 0,
            msg: 'OK',
            response: task,
            project: projectId
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO CREATE TASK: ' + error.message
        });
    }
});

export const updateTaskPullRequestUrlService = (taskId, pullRequestUrl, userId) => new Promise(async (resolve) => {
    try {
        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        await task.update({
            pullRequestUrl: pullRequestUrl || null,
            updatedAt: new Date()
        });

        try {
            const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: 'PULL_REQUEST_UPDATED',
                payload: { pullRequestUrl: pullRequestUrl || null }
            });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
        }

        await task.reload({
            include: [
                { model: db.Users, as: 'assignedUser', attributes: ['id', 'username', 'email', 'avatarUrl'] },
                { model: db.Project, as: 'project', attributes: ['id', 'name', 'description'] },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: task
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO UPDATE TASK PULL REQUEST URL: ' + error.message
        });
    }
});

//GET TASK BY ID with permission check
export const getTaskByIdService = (taskId, userId) => new Promise(async (resolve, reject) => {
    try {
        const task = await db.Task.findOne({
            where: { id: taskId },
            include: [
                {
                    model: db.Users,
                    as: 'assignedUser',
                    attributes: ['id', 'username', 'email', 'avatarUrl']
                },
                {
                    model: db.Project,
                    as: 'project',
                    attributes: ['id', 'name', 'description']
                },
                {
                    model: db.Users,
                    as: 'watchers',
                    attributes: ['id', 'username', 'email', 'avatarUrl'],
                    through: { attributes: [] }
                },
                {
                    model: db.Task_Activity,
                    as: 'activities',
                    include: [
                        {
                            model: db.Users,
                            as: 'user',
                            attributes: ['id', 'username', 'email', 'avatarUrl']
                        }
                    ],
                    order: [['createdAt', 'DESC']]
                }
            ]
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        // Nếu có userId, kiểm tra xem user có quyền truy cập task này không
        if (userId) {
            const userIdStr = String(userId);

            // Cho phép nếu là người được assign trực tiếp
            const isAssigned =
                task.assigned_to &&
                String(task.assigned_to) === userIdStr;

            let isProjectMember = false;
            if (task.project_id) {
                const membership = await db.Project_Member.findOne({
                    where: {
                        project_id: task.project_id,
                        user_id: userIdStr,
                    },
                });
                isProjectMember = !!membership;
            }

            if (!isAssigned && !isProjectMember) {
                return resolve({
                    err: 2,
                    msg: 'FORBIDDEN: You do not have permission to access this task',
                });
            }
        }

        resolve({
            err: 0,
            msg: 'OK',
            response: task
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO GET TASK: ' + error.message
        });
    }
});

//GET TASK ACTIVITIES
export const getTaskActivitiesService = (taskId) => new Promise(async (resolve, reject) => {
    try {
        // Convert taskId to number if it's a string (for BIGINT compatibility)
        const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;

        // Get activities with user information directly (no need to check task existence first)
        const activities = await db.Task_Activity.findAll({
            where: { task_id: numericTaskId },
            include: [
                {
                    model: db.Users,
                    as: 'user',
                    attributes: ['id', 'username', 'email', 'avatarUrl'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 50 // Limit to prevent loading too many activities
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: activities || []
        });
    } catch (error) {
        console.error('Error getting task activities:', error);
        resolve({
            err: 1,
            msg: 'FAILED TO GET TASK ACTIVITIES: ' + error.message,
            response: []
        });
    }
});

//UPDATE TASK TITLE
export const updateTaskTitleService = (taskId, title, userId) => new Promise(async (resolve, reject) => {
    try {
        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        // Check if another task with the same title already exists in this project (excluding current task)
        const existingTask = await db.Task.findOne({
            where: {
                project_id: task.project_id,
                title: title.trim(),
                id: { [db.Sequelize.Op.ne]: taskId } // Exclude current task
            }
        });

        if (existingTask) {
            return resolve({
                err: 1,
                msg: 'A task with this title already exists in this project'
            });
        }

        await task.update({
            title: title.trim(),
            updatedAt: new Date()
        });

        // log activity
        try {
            const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: 'TITLE_UPDATED',
                payload: { title }
            });
            console.log('Activity created for TITLE_UPDATED:', { taskId: numericTaskId, userId });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
            // Don't fail the whole operation if activity creation fails
        }

        await task.reload({
            include: [
                { model: db.Users, as: 'assignedUser', attributes: ['id', 'username', 'email', 'avatarUrl'] },
                { model: db.Project, as: 'project', attributes: ['id', 'name', 'description'] },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: task
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO UPDATE TASK TITLE: ' + error.message
        });
    }
});

//UPDATE TASK STATUS
export const updateTaskStatusService = (taskId, status, userId) => new Promise(async (resolve, reject) => {
    try {
        const validStatuses = ['To Do', 'In Progress', 'Done'];

        if (!validStatuses.includes(status)) {
            return resolve({
                err: 1,
                msg: 'INVALID STATUS. Must be one of: To Do, In Progress, Done'
            });
        }

        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        await task.update({
            status: status,
            updatedAt: new Date()
        });

        await updateProjectProgress(task.project_id);

        try {
            const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: 'STATUS_UPDATED',
                payload: { status }
            });
            console.log('Activity created for STATUS_UPDATED:', { taskId: numericTaskId, userId });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
            // Don't fail the whole operation if activity creation fails
        }

        await task.reload({
            include: [
                { model: db.Users, as: 'assignedUser', attributes: ['id', 'username', 'email', 'avatarUrl'] },
                { model: db.Project, as: 'project', attributes: ['id', 'name', 'description'] },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: task
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO UPDATE TASK STATUS: ' + error.message
        });
    }
});

//UPDATE TASK DESCRIPTION
export const updateTaskDescriptionService = (taskId, description, userId) => new Promise(async (resolve, reject) => {
    try {
        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        await task.update({
            description: description || null,
            updatedAt: new Date()
        });

        try {
            const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: 'DESCRIPTION_UPDATED',
                payload: { description }
            });
            console.log('Activity created for DESCRIPTION_UPDATED:', { taskId: numericTaskId, userId });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
            // Don't fail the whole operation if activity creation fails
        }

        await task.reload({
            include: [
                { model: db.Users, as: 'assignedUser', attributes: ['id', 'username', 'email', 'avatarUrl'] },
                { model: db.Project, as: 'project', attributes: ['id', 'name', 'description'] },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: task
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO UPDATE TASK DESCRIPTION: ' + error.message
        });
    }
});

//UPDATE TASK ASSIGNEES
export const updateTaskAssigneesService = (taskId, assignees, userId) => new Promise(async (resolve, reject) => {
    try {
        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        const previousAssignedTo = task.assigned_to ? String(task.assigned_to) : null;
        // Since assigned_to is a single STRING field, we'll use the first assignee
        // If assignees array is empty, set to null
        const assignedTo = Array.isArray(assignees) && assignees.length > 0
            ? assignees[0]
            : null;

        await task.update({
            assigned_to: assignedTo,
            updatedAt: new Date()
        });

        const nextAssignedTo = assignedTo ? String(assignedTo) : null;
        if (nextAssignedTo && nextAssignedTo !== previousAssignedTo) {
            const actor = userId ? await db.Users.findByPk(userId, { attributes: ['username'] }) : null;
            const actorName = actor?.username || 'Một người dùng';
            const project = await db.Project.findByPk(task.project_id, { attributes: ['id', 'workspace_id'] });
            await createNotificationService(
                nextAssignedTo,
                `${actorName} đã gán bạn vào task: ${task.title}`,
                {
                    type: 'task',
                    taskId: String(task.id),
                    projectId: String(task.project_id),
                    workspaceId: project?.workspace_id ? String(project.workspace_id) : null,
                }
            );
        }

        // Reload task with associations to get updated assignedUser
        await task.reload({
            include: [
                {
                    model: db.Users,
                    as: 'assignedUser',
                    attributes: ['id', 'username', 'email', 'avatarUrl']
                },
                {
                    model: db.Project,
                    as: 'project',
                    attributes: ['id', 'name', 'description']
                },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        try {
            const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: 'ASSIGNEES_UPDATED',
                payload: { assignees }
            });
            console.log('Activity created for ASSIGNEES_UPDATED:', { taskId: numericTaskId, userId });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
            // Don't fail the whole operation if activity creation fails
        }

        resolve({
            err: 0,
            msg: 'OK',
            response: task
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO UPDATE TASK ASSIGNEES: ' + error.message
        });
    }
});

//UPDATE TASK DUE DATE
export const updateTaskDueDateService = (taskId, dueDate, userId) => new Promise(async (resolve, reject) => {
    try {
        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        // Convert dueDate to Date object if it's a string
        const dueDateValue = dueDate ? new Date(dueDate) : null;

        await task.update({
            dueDate: dueDateValue,
            updatedAt: new Date()
        });

        try {
            const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: 'DUE_DATE_UPDATED',
                payload: { 
                    oldDueDate: task.dueDate ? task.dueDate.toISOString() : null,
                    newDueDate: dueDateValue ? dueDateValue.toISOString() : null
                }
            });
            console.log('Activity created for DUE_DATE_UPDATED:', { taskId: numericTaskId, userId });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
            // Don't fail the whole operation if activity creation fails
        }

        await task.reload({
            include: [
                { model: db.Users, as: 'assignedUser', attributes: ['id', 'username', 'email', 'avatarUrl'] },
                { model: db.Project, as: 'project', attributes: ['id', 'name', 'description'] },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: task
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO UPDATE TASK DUE DATE: ' + error.message
        });
    }
});

export const updateTaskPriorityService = (taskId, priority, userId) => new Promise(async (resolve, reject) => {
    try {
        const validPriorities = ['Low', 'Medium', 'High'];

        if (!validPriorities.includes(priority)) {
            return resolve({
                err: 1,
                msg: 'INVALID PRIORITY. Must be one of: Low, Medium, High'
            });
        }

        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        await task.update({
            priority: priority,
            updatedAt: new Date()
        });

        // log activity
        try {
            const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: 'PRIORITY_UPDATED',
                payload: { priority }
            });
            console.log('Activity created for PRIORITY_UPDATED:', { taskId: numericTaskId, userId });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
            // Don't fail the whole operation if activity creation fails
        }

        await task.reload({
            include: [
                { model: db.Users, as: 'assignedUser', attributes: ['id', 'username', 'email', 'avatarUrl'] },
                { model: db.Project, as: 'project', attributes: ['id', 'name', 'description'] },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: task
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO UPDATE TASK PRIORITY: ' + error.message
        });
    }
});

export const updateTaskDifficultyService = (taskId, difficulty, userId) => new Promise(async (resolve) => {
    try {
        const validDifficulties = ['Easy', 'Medium', 'Hard'];

        if (!validDifficulties.includes(difficulty)) {
            return resolve({
                err: 1,
                msg: 'INVALID DIFFICULTY. Must be one of: Easy, Medium, Hard'
            });
        }

        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        await task.update({
            difficulty: difficulty,
            updatedAt: new Date()
        });

        try {
            const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: 'DIFFICULTY_UPDATED',
                payload: { difficulty }
            });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
        }

        await task.reload({
            include: [
                { model: db.Users, as: 'assignedUser', attributes: ['id', 'username', 'email', 'avatarUrl'] },
                { model: db.Project, as: 'project', attributes: ['id', 'name', 'description'] },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: task
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO UPDATE TASK DIFFICULTY: ' + error.message
        });
    }
});

//WATCH/UNWATCH TASK
export const watchTaskService = (taskId, userId) => new Promise(async (resolve, reject) => {
    try {
        if (!userId) {
            return resolve({
                err: 1,
                msg: 'USER ID IS REQUIRED'
            });
        }

        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;

        // Check if user is already watching this task
        const existingWatcher = await db.Task_Watcher.findOne({
            where: {
                task_id: numericTaskId,
                user_id: userId
            }
        });

        let isWatching = false;
        let action = '';

        if (existingWatcher) {
            // Remove watcher (unwatch)
            await existingWatcher.destroy();
            isWatching = false;
            action = 'UNWATCHED';
        } else {
            // Add watcher (watch)
            await db.Task_Watcher.create({
                task_id: numericTaskId,
                user_id: userId
            });
            isWatching = true;
            action = 'WATCHED';
        }

        // Log activity
        try {
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: action,
                payload: { isWatching }
            });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
        }

        // Reload task with all associations
        await task.reload({
            include: [
                { model: db.Users, as: 'assignedUser', attributes: ['id', 'username', 'email', 'avatarUrl'] },
                { model: db.Project, as: 'project', attributes: ['id', 'name', 'description'] },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: task,
            isWatching: isWatching
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO WATCH/UNWATCH TASK: ' + error.message
        });
    }
});

//MARK TASK AS ACHIEVED (DONE)
export const achievedTaskService = (taskId, userId) => new Promise(async (resolve, reject) => {
    try {
        if (!userId) {
            return resolve({
                err: 1,
                msg: 'USER ID IS REQUIRED'
            });
        }

        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        // Update task status to 'Done'
        await task.update({
            status: 'Done',
            updatedAt: new Date()
        });

        await updateProjectProgress(task.project_id);

        // Log activity
        try {
            const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: 'TASK_ACHIEVED',
                payload: { status: 'Done' }
            });
            console.log('Activity created for TASK_ACHIEVED:', { taskId: numericTaskId, userId });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
        }

        // Reload task with all associations
        await task.reload({
            include: [
                { model: db.Users, as: 'assignedUser', attributes: ['id', 'username', 'email', 'avatarUrl'] },
                { model: db.Project, as: 'project', attributes: ['id', 'name', 'description'] },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: task
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO MARK TASK AS ACHIEVED: ' + error.message
        });
    }
});

//ARCHIVE/UNARCHIVE TASK
export const archiveTaskService = (taskId, userId) => new Promise(async (resolve, reject) => {
    try {
        if (!userId) {
            return resolve({
                err: 1,
                msg: 'USER ID IS REQUIRED'
            });
        }

        const task = await db.Task.findOne({
            where: { id: taskId }
        });

        if (!task) {
            return resolve({
                err: 1,
                msg: 'TASK NOT FOUND'
            });
        }

        // Toggle archive status
        const newArchiveStatus = !task.isArchived;

        await task.update({
            isArchived: newArchiveStatus,
            updatedAt: new Date()
        });

        await updateProjectProgress(task.project_id);

        // Log activity
        try {
            const numericTaskId = typeof taskId === 'string' && !isNaN(taskId) ? parseInt(taskId, 10) : taskId;
            await db.Task_Activity.create({
                task_id: numericTaskId,
                user_id: userId,
                action: newArchiveStatus ? 'TASK_ARCHIVED' : 'TASK_UNARCHIVED',
                payload: { isArchived: newArchiveStatus }
            });
            console.log('Activity created for archive:', { taskId: numericTaskId, userId, isArchived: newArchiveStatus });
        } catch (activityError) {
            console.error('Failed to create activity:', activityError);
        }

        // Reload task with all associations
        await task.reload({
            include: [
                { model: db.Users, as: 'assignedUser', attributes: ['id', 'username', 'email', 'avatarUrl'] },
                { model: db.Project, as: 'project', attributes: ['id', 'name', 'description'] },
                { model: db.Users, as: 'watchers', attributes: ['id', 'username', 'email', 'avatarUrl'], through: { attributes: [] } },
                { model: db.Task_Activity, as: 'activities', include: [{ model: db.Users, as: 'user', attributes: ['id', 'username', 'email', 'avatarUrl'] }], order: [['createdAt', 'DESC']] }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: task,
            isArchived: newArchiveStatus
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO ARCHIVE/UNARCHIVE TASK: ' + error.message
        });
    }
});

export const getMyTasksService = (userId, workspaceId) => new Promise(async (resolve, reject) => {
    try {
        // First, verify userId and workspaceId are valid
        if (!userId || !workspaceId) {
            return resolve({
                err: 1,
                msg: 'Missing required parameters: userId or workspaceId'
            });
        }

        // Convert userId to string if it's a number (to match database type)
        const userIdStr = String(userId);

        const tasks = await db.Task.findAll({
            where: {
                assigned_to: userIdStr,
                isArchived: false // Only non-archived tasks
            },
            include: [
                {
                    model: db.Project,
                    as: 'project',
                    where: { workspace_id: workspaceId },
                    required: true, // INNER JOIN - only tasks with projects in this workspace
                    attributes: ['id', 'name', 'workspace_id']
                },
                {
                    model: db.Users,
                    as: 'assignedUser',
                    required: false, // LEFT JOIN - task may not have assigned user
                    attributes: ['id', 'username', 'email', 'avatarUrl']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Return empty array if no tasks found (this is not an error)
        resolve({
            err: 0,
            msg: 'OK',
            response: tasks || []
        });
    } catch (error) {
        console.error('Error getting my tasks:', error);
        resolve({
            err: 1,
            msg: 'FAILED TO GET MY TASKS: ' + error.message
        });
    }
});