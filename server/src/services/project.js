import db from '../models';
import { v4 } from 'uuid';

//GET ALL PROJECTS
export const getAllProjectsService = () => new Promise(async (resolve, reject) => {
    try {
        const response = await db.Project.findAll({
            raw: true,
            // attributes : ['id','name','description']
        });
        resolve({
            err: response ? 0 : 1,
            msg: response ? 'OK' : 'FAILED TO GET ALL PROJECTS',
            response
        });
    } catch (error) {
        reject(error);
    }
});

export const getProjectByIdService = (id)=> new Promise(async (resolve, reject)=>{
    try {
        const response = await db.Project.findOne({
            raw: true,
            attributes : ['id','name','description'],
            where: {
                id
            }
        });
        resolve({
            err: response ? 0 : 1,
            msg: response ? 'OK' : 'FAILED TO GET PROJECT BY ID',
            response
        });
    } catch (error) {
        reject(error);
    }
})

// CREATE PROJECT
export const createProjectService = (workspaceId, projectData, createdBy) => new Promise(async (resolve, reject) => {
    const transaction = await db.sequelize.transaction();
    try {
        // Check if project name already exists in this workspace
        const existingProject = await db.Project.findOne({
            where: {
                workspace_id: workspaceId,
                name: projectData.name.trim()
            }
        });

        if (existingProject) {
            await transaction.rollback();
            return resolve({
                err: 1,
                msg: 'Tên dự án đã tồn tại trong workspace này'
            });
        }

        // Map client roles to database roles
        const roleMapping = {
            'Admin': 'Leader',
            'Leader': 'Leader',
            'member': 'Developer'
        };

        // Convert status from client format to database format
        const statusMapping = {
            'Pending': 'Pending',
            'In Progress': 'In Progress',
            'IN Progress': 'In Progress', // Support both formats for backward compatibility
            'Completed': 'Completed'
        };

        // Generate project ID
        const projectId = v4();

        // Find leader_id from members if provided, otherwise use createdBy
        let leaderId = createdBy;
        if (projectData.members && projectData.members.length > 0) {
            const leaderMember = projectData.members.find(m => m.role === 'Leader' || m.role === 'Admin');
            if (leaderMember) {
                leaderId = leaderMember.user;
            }
        }

        // Create project
        const project = await db.Project.create({
            id: projectId,
            workspace_id: workspaceId,
            name: projectData.name.trim(),
            description: projectData.description || null,
            start_date: new Date(projectData.startDate),
            end_date: new Date(projectData.dueDate),
            status: statusMapping[projectData.status] || 'Pending',
            leader_id: leaderId,
            created_by: createdBy,
            createdAt: new Date(),
            updatedAt: new Date()
        }, { transaction });

        // Create project members if provided
        if (projectData.members && projectData.members.length > 0) {
            const memberPromises = projectData.members.map(member => {
                const dbRole = roleMapping[member.role] || 'Developer';
                return db.Project_Member.create({
                    id: v4(),
                    project_id: projectId,
                    user_id: member.user,
                    role: dbRole,
                    joined_at: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                }, { transaction });
            });
            await Promise.all(memberPromises);
        } else {
            // If no members provided, add creator as Leader
            await db.Project_Member.create({
                id: v4(),
                project_id: projectId,
                user_id: createdBy,
                role: 'Leader',
                joined_at: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            }, { transaction });
        }

        await transaction.commit();

        // Fetch the created project with relations
        const createdProject = await db.Project.findOne({
            where: { id: projectId },
            include: [
                {
                    model: db.Project_Member,
                    as: 'members',
                    include: [
                        {
                            model: db.Users,
                            as: 'user',
                            attributes: ['id', 'username', 'email', 'avatarUrl']
                        }
                    ]
                },
                {
                    model: db.Workspaces,
                    as: 'workspace',
                    attributes: ['id', 'name']
                }
            ]
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: createdProject,
            workspaceId: workspaceId
        });
    } catch (error) {
        await transaction.rollback();
        reject(error);
    }
});

//GET PROJECT


export const getProjectTasksService = async (projectId, userId) => {
    try {

        // Lấy project
        const project = await db.Project.findOne({
            where: { id: projectId },
            include: [
                {
                    model: db.Users,
                    as: 'leader',   
                    attributes: ['id', 'username', 'email', 'avatarUrl']
                },
                {
                    model: db.Project_Member,
                    as: 'members',
                    include: [
                        {
                            model: db.Users,
                            as: 'user',
                            // Bao gồm luôn role hệ thống của user để FE hiển thị đúng Admin/Leader/Member
                            attributes: ['id', 'username', 'email', 'avatarUrl', 'role']
                        }
                    ]
                },
                {
                    model: db.Progress,
                    as: 'progress'
                },
                {
                    model: db.Project_Prediction,
                    as: 'prediction'
                }
            ]
        });

        if (!project) {
            return { err: 1, msg: "Project not found" };
        }

        // Check if user is a project member
        if (userId) {
            const isMember = project.members?.some((member) => {
                const memberUserId = typeof member.user === 'string' ? member.user : member.user?.id || member.user_id;
                return memberUserId === userId;
            }) || project.leader_id === userId || project.created_by === userId;

            if (!isMember) {
                return { 
                    err: 1, 
                    msg: "Bạn không phải là thành viên trong project này",
                    code: "NOT_PROJECT_MEMBER"
                };
            }
        }

        // Lấy tasks
        const tasks = await db.Task.findAll({
            where: { project_id: projectId },
            include: [
                {
                    model: db.Users,
                    as: 'assignedUser',
                    attributes: ['id', 'username', 'email', 'avatarUrl']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const projectData = project.toJSON ? project.toJSON() : project;
        let progressVal = 0;
        if (Array.isArray(projectData.progress) && projectData.progress.length > 0) {
            progressVal = projectData.progress[0].progress;
        } else if (projectData.progress && typeof projectData.progress === 'object') {
            progressVal = projectData.progress.progress || 0;
        }

        const formattedProject = {
            ...projectData,
            progress: progressVal
        };

        return {
            err: 0,
            msg: 'OK',
            project: formattedProject,
            tasks // luôn có mảng (dù rỗng)
        };

    } catch (error) {
        return {
            err: -1,
            msg: `Failed at get project detail: ${error}`
        };
    }
};

// UPDATE PROJECT TITLE
export const updateProjectTitleService = (projectId, title, userId) => new Promise(async (resolve, reject) => {
    try {
        const project = await db.Project.findOne({
            where: { id: projectId }
        });

        if (!project) {
            return resolve({
                err: 1,
                msg: 'PROJECT NOT FOUND'
            });
        }

        // Check if user is leader or creator
        const isLeader = project.leader_id === userId || project.created_by === userId;
        if (!isLeader) {
            const member = await db.Project_Member.findOne({
                where: {
                    project_id: projectId,
                    user_id: userId,
                    role: 'Leader'
                }
            });
            if (!member) {
                return resolve({
                    err: 1,
                    msg: 'ONLY LEADER CAN UPDATE PROJECT TITLE'
                });
            }
        }

        // Check if project name already exists in this workspace (excluding current project)
        const existingProject = await db.Project.findOne({
            where: {
                workspace_id: project.workspace_id,
                name: title.trim(),
                id: { [db.Sequelize.Op.ne]: projectId } // Exclude current project
            }
        });

        if (existingProject) {
            return resolve({
                err: 1,
                msg: 'Tên dự án đã tồn tại trong workspace này'
            });
        }

        await project.update({
            name: title.trim(),
            updatedAt: new Date()
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: project
        });
    } catch (error) {
        reject(error);
    }
});

// UPDATE PROJECT DESCRIPTION
export const updateProjectDescriptionService = (projectId, description, userId) => new Promise(async (resolve, reject) => {
    try {
        const project = await db.Project.findOne({
            where: { id: projectId }
        });

        if (!project) {
            return resolve({
                err: 1,
                msg: 'PROJECT NOT FOUND'
            });
        }

        // Check if user is leader or creator
        const isLeader = project.leader_id === userId || project.created_by === userId;
        if (!isLeader) {
            const member = await db.Project_Member.findOne({
                where: {
                    project_id: projectId,
                    user_id: userId,
                    role: 'Leader'
                }
            });
            if (!member) {
                return resolve({
                    err: 1,
                    msg: 'ONLY LEADER CAN UPDATE PROJECT DESCRIPTION'
                });
            }
        }

        await project.update({
            description: description?.trim() || null,
            updatedAt: new Date()
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: project
        });
    } catch (error) {
        reject(error);
    }
});

// ADD MEMBER TO PROJECT
export const addMemberToProjectService = (projectId, userId, role, currentUserId) => new Promise(async (resolve, reject) => {
    try {
        const project = await db.Project.findOne({
            where: { id: projectId }
        });

        if (!project) {
            return resolve({
                err: 1,
                msg: 'PROJECT NOT FOUND'
            });
        }

        // Check if current user is leader
        const isLeader = project.leader_id === currentUserId || project.created_by === currentUserId;
        if (!isLeader) {
            const member = await db.Project_Member.findOne({
                where: {
                    project_id: projectId,
                    user_id: currentUserId,
                    role: 'Leader'
                }
            });
            if (!member) {
                return resolve({
                    err: 1,
                    msg: 'ONLY LEADER CAN ADD MEMBERS TO PROJECT'
                });
            }
        }

        // Check if user exists
        const user = await db.Users.findOne({
            where: { id: userId }
        });

        if (!user) {
            return resolve({
                err: 1,
                msg: 'USER NOT FOUND'
            });
        }

        // Check if user is already a member
        const existingMember = await db.Project_Member.findOne({
            where: {
                project_id: projectId,
                user_id: userId
            }
        });

        if (existingMember) {
            return resolve({
                err: 1,
                msg: 'USER IS ALREADY A MEMBER OF THIS PROJECT'
            });
        }

        // Add member
        await db.Project_Member.create({
            id: v4(),
            project_id: projectId,
            user_id: userId,
            role: role || 'Developer',
            joined_at: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        resolve({
            err: 0,
            msg: 'OK'
        });
    } catch (error) {
        reject(error);
    }
});

// REMOVE MEMBER FROM PROJECT
export const removeMemberFromProjectService = (projectId, targetUserId, currentUserId) => new Promise(async (resolve, reject) => {
    try {
        const project = await db.Project.findOne({
            where: { id: projectId }
        });

        if (!project) {
            return resolve({
                err: 1,
                msg: 'PROJECT NOT FOUND'
            });
        }

        // Check if current user is leader
        const isLeader = project.leader_id === currentUserId || project.created_by === currentUserId;
        if (!isLeader) {
            const member = await db.Project_Member.findOne({
                where: {
                    project_id: projectId,
                    user_id: currentUserId,
                    role: 'Leader'
                }
            });
            if (!member) {
                return resolve({
                    err: 1,
                    msg: 'ONLY LEADER CAN REMOVE MEMBERS FROM PROJECT'
                });
            }
        }

        // Check if target user is a member
        const targetMember = await db.Project_Member.findOne({
            where: {
                project_id: projectId,
                user_id: targetUserId
            }
        });

        if (!targetMember) {
            return resolve({
                err: 1,
                msg: 'USER IS NOT A MEMBER OF THIS PROJECT'
            });
        }

        // Prevent removing leader
        if (targetMember.role === 'Leader' && project.leader_id === targetUserId) {
            return resolve({
                err: 1,
                msg: 'CANNOT REMOVE PROJECT LEADER'
            });
        }

        // Remove member
        await db.Project_Member.destroy({
            where: {
                project_id: projectId,
                user_id: targetUserId
            }
        });

        resolve({
            err: 0,
            msg: 'OK'
        });
    } catch (error) {
        reject(error);
    }
});
