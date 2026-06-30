import * as services from '../services/project';

export const getAllProjects = async (req,res)=>{
    try {
        const respone = await services.getAllProjectsService();
        // console.log(respone);
        return res.status(200).json(respone);
    } catch (error) {
        return res.status(500).json({
            err : -1,
            msg : 'Failed at get project controller: ' + error
        })
    }
}

export const getProjectById = async (req,res)=>{
    try {
        // console.log(req.query);
        const {id} = req.query;
        const respone = await services.getProjectByIdService(id);
        return res.status(200).json(respone);
    } catch (error) {
        return res.status(500).json({
            err : -1,
            msg : 'Failed at get project by id controller: ' + error
        })
    }
}

export const createProject = async (req,res)=>{
    try {
        const {workspaceId} = req.params;
        const {created_by, ...projectData} = req.body;
        
        if(!workspaceId) {
            return res.status(400).json({
                err : 1,
                msg : 'Missing required parameter: workspaceId'
            })
        }

        if(!projectData.name || !projectData.startDate || !projectData.dueDate) {
            return res.status(400).json({
                err : 1,
                msg : 'Missing required parameters: name, startDate, dueDate'
            })
        }

        if(!created_by) {
            return res.status(400).json({
                err : 1,
                msg : 'Missing required parameter: created_by'
            })
        }

        const response = await services.createProjectService(workspaceId, projectData, created_by);
        if(response.err === 1) {
            return res.status(400).json(response);
        }
        return res.status(201).json(response);
    } catch (error) {
        return res.status(500).json({
            err : -1,
            msg : 'Failed at create project controller: ' + error
        })
    }
}

export const getProjectTasks = async (req,res)=>{
    try {
        const {projectId} = req.params;
        if(!projectId) {
            return res.status(400).json({
                err : 1,
                msg : 'Missing required parameter: projectId'
            })
        }

        // Get userId from token
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') 
            ? authHeader.replace('Bearer ', '') 
            : (req.cookies?.accessToken || null);
        
        let currentUserId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                currentUserId = decoded.id;
            } catch (error) {
                // If token is invalid, continue without userId (will fail permission check)
            }
        }

        const respone = await services.getProjectTasksService(projectId, currentUserId);
        
        // Return 403 if user is not a project member
        if (respone.err === 1 && respone.code === "NOT_PROJECT_MEMBER") {
            return res.status(403).json(respone);
        }
        
        return res.status(200).json(respone);
    } catch (error) {
        return res.status(500).json({
            err : -1,
            msg : 'Failed at get project tasks controller: ' + error
        })
    }
}

export const updateProjectTitle = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { title } = req.body;

        if (!projectId || !title || title.trim() === '') {
            return res.status(400).json({
                err: 1,
                msg: 'Missing required parameters: projectId and title'
            });
        }

        // Get userId from token
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') 
            ? authHeader.replace('Bearer ', '') 
            : (req.cookies?.accessToken || null);
        
        let userId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            } catch (error) {
                return res.status(401).json({
                    err: 1,
                    msg: 'UNAUTHORIZED: Invalid or expired token'
                });
            }
        } else {
            return res.status(401).json({
                err: 1,
                msg: 'UNAUTHORIZED: No token provided'
            });
        }

        const response = await services.updateProjectTitleService(projectId, title, userId);
        if (response.err === 1) {
            const statusCode = response.msg === 'PROJECT NOT FOUND' ? 404 : 403;
            return res.status(statusCode).json(response);
        }
        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json({
            err: -1,
            msg: 'Failed at update project title controller: ' + error
        });
    }
}

export const updateProjectDescription = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { description } = req.body;

        if (!projectId) {
            return res.status(400).json({
                err: 1,
                msg: 'Missing required parameter: projectId'
            });
        }

        // Get userId from token
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') 
            ? authHeader.replace('Bearer ', '') 
            : (req.cookies?.accessToken || null);
        
        let userId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            } catch (error) {
                return res.status(401).json({
                    err: 1,
                    msg: 'UNAUTHORIZED: Invalid or expired token'
                });
            }
        } else {
            return res.status(401).json({
                err: 1,
                msg: 'UNAUTHORIZED: No token provided'
            });
        }

        const response = await services.updateProjectDescriptionService(projectId, description, userId);
        if (response.err === 1) {
            const statusCode = response.msg === 'PROJECT NOT FOUND' ? 404 : 403;
            return res.status(statusCode).json(response);
        }
        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json({
            err: -1,
            msg: 'Failed at update project description controller: ' + error
        });
    }
}

export const addMemberToProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { userId, role } = req.body;

        if (!projectId || !userId) {
            return res.status(400).json({
                err: 1,
                msg: 'Missing required parameters: projectId and userId'
            });
        }

        // Get currentUserId from token
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') 
            ? authHeader.replace('Bearer ', '') 
            : (req.cookies?.accessToken || null);
        
        let currentUserId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                currentUserId = decoded.id;
            } catch (error) {
                return res.status(401).json({
                    err: 1,
                    msg: 'UNAUTHORIZED: Invalid or expired token'
                });
            }
        } else {
            return res.status(401).json({
                err: 1,
                msg: 'UNAUTHORIZED: No token provided'
            });
        }

        const response = await services.addMemberToProjectService(projectId, userId, role || 'Developer', currentUserId);
        if (response.err === 1) {
            const statusCode = response.msg === 'PROJECT NOT FOUND' || response.msg === 'USER NOT FOUND' ? 404 : 403;
            return res.status(statusCode).json(response);
        }
        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json({
            err: -1,
            msg: 'Failed at add member to project controller: ' + error
        });
    }
}

export const removeMemberFromProject = async (req, res) => {
    try {
        const { projectId, userId } = req.params;

        if (!projectId || !userId) {
            return res.status(400).json({
                err: 1,
                msg: 'Missing required parameters: projectId and userId'
            });
        }

        // Get currentUserId from token
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') 
            ? authHeader.replace('Bearer ', '') 
            : (req.cookies?.accessToken || null);
        
        let currentUserId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                currentUserId = decoded.id;
            } catch (error) {
                return res.status(401).json({
                    err: 1,
                    msg: 'UNAUTHORIZED: Invalid or expired token'
                });
            }
        } else {
            return res.status(401).json({
                err: 1,
                msg: 'UNAUTHORIZED: No token provided'
            });
        }

        const response = await services.removeMemberFromProjectService(projectId, userId, currentUserId);
        if (response.err === 1) {
            const statusCode = response.msg === 'PROJECT NOT FOUND' || response.msg === 'USER IS NOT A MEMBER OF THIS PROJECT' ? 404 : 403;
            return res.status(statusCode).json(response);
        }
        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json({
            err: -1,
            msg: 'Failed at remove member from project controller: ' + error
        });
    }
}

export const updateProjectStatus = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { status } = req.body;

        if (!projectId || !status) {
            return res.status(400).json({
                err: 1,
                msg: 'Missing required parameters: projectId and status'
            });
        }

        // Get userId from token
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') 
            ? authHeader.replace('Bearer ', '') 
            : (req.cookies?.accessToken || null);
        
        let userId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            } catch (error) {
                return res.status(401).json({
                    err: 1,
                    msg: 'UNAUTHORIZED: Invalid or expired token'
                });
            }
        } else {
            return res.status(401).json({
                err: 1,
                msg: 'UNAUTHORIZED: No token provided'
            });
        }

        const response = await services.updateProjectStatusService(projectId, status, userId);
        if (response.err === 1) {
            const statusCode = response.msg === 'PROJECT NOT FOUND' ? 404 : 403;
            return res.status(statusCode).json(response);
        }
        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json({
            err: -1,
            msg: 'Failed at update project status controller: ' + error
        });
    }
}