import jwt from 'jsonwebtoken';
import db from '../models';

export const checkActiveStatus = async (req, res, next) => {
    try {
        const publicPaths = [
            '/api/v1/auth/login',
            '/api/v1/auth/register',
            '/api/v1/auth/forgot-password',
            '/api/v1/auth/reset-password',
            '/api/v1/auth/first-change-password'
        ];
        // Bỏ qua kiểm tra cho các route public/đặc biệt
        if (publicPaths.some(path => req.originalUrl?.startsWith(path) || req.path?.startsWith(path))) {
            return next();
        }
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.replace('Bearer ', '')
            : (req.cookies?.accessToken || null);

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded && decoded.id) {
                    const user = await db.Users.findByPk(decoded.id, {
                        attributes: ['id', 'isActive'],
                        raw: true
                    });

                    // Nếu tài khoản bị khóa (isActive = false hoặc 0)
                    if (user && !user.isActive) {
                        return res.status(401).json({
                            err: 401,
                            msg: 'Tài khoản đã bị khóa. Vui lòng liên hệ Admin để được hỗ trợ.'
                        });
                    }
                }
            } catch (error) {
                // Nếu token hết hạn hoặc lỗi, cứ để các controller khác tự xử lý
            }
        }
        next();
    } catch (err) {
        next(err);
    }
};
