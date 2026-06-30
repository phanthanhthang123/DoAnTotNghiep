import express from 'express';
import * as controllers from '../controllers/project'
import * as predictionControllers from '../controllers/prediction'

//CRUD
const router = express.Router();
router.get('/all',controllers.getAllProjects);
router.get('/',controllers.getProjectById);
router.post('/:workspaceId/create-project',controllers.createProject);       
router.get('/:projectId/tasks',controllers.getProjectTasks);
router.put('/:projectId/update-title', controllers.updateProjectTitle);
router.put('/:projectId/update-description', controllers.updateProjectDescription);
router.put('/:projectId/update-status', controllers.updateProjectStatus);
router.post('/:projectId/add-member', controllers.addMemberToProject);
router.delete('/:projectId/remove-member/:userId', controllers.removeMemberFromProject);
router.get('/:projectId/predict-delay', predictionControllers.predictProjectDelay);
export default router;