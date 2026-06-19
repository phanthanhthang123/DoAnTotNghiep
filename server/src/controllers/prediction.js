import * as predictionService from '../services/prediction';
import jwt from 'jsonwebtoken';

export const predictProjectDelay = async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!projectId) {
            return res.status(400).json({
                err: 1,
                msg: 'Missing required parameter: projectId'
            });
        }

        // Lấy userId từ token
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.replace('Bearer ', '')
            : (req.cookies?.accessToken || null);

        let userId = null;
        if (token) {
            try {
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

        const response = await predictionService.predictProjectDelayService(projectId, userId);

        if (response.err === 1) {
            const statusCode = response.msg === 'PROJECT_NOT_FOUND' ? 404
                : response.msg === 'ONLY_LEADER_OR_ADMIN' ? 403
                : 400;
            console.log('[predictProjectDelay] Error response:', response);
            return res.status(statusCode).json(response);
        }

        console.log('[predictProjectDelay] Success response:', JSON.stringify(response, null, 2));
        return res.status(200).json(response);
    } catch (error) {
        console.error('[predictProjectDelay] Error:', error);
        return res.status(500).json({
            err: -1,
            msg: 'Failed at predict project delay controller: ' + error.message
        });
    }
};
