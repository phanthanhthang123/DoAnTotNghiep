import express from 'express';
import multer from 'multer';
import * as controllers from '../controllers/auth';

const avatarMulter = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!/^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype || '')) {
            cb(new Error('Chỉ chấp nhận ảnh JPEG, PNG, GIF hoặc WebP'));
            return;
        }
        cb(null, true);
    },
});

const avatarUploadMiddleware = (req, res, next) => {
    avatarMulter.single('avatar')(req, res, (err) => {
        if (err) {
            const msg =
                err.code === 'LIMIT_FILE_SIZE'
                    ? 'Ảnh tối đa 5MB'
                    : err.message || 'Upload thất bại';
            return res.status(400).json({ err: 1, msg });
        }
        next();
    });
};

//CRUD
const router = express.Router();
router.post('/register', controllers.register);
router.post('/login', controllers.login);
router.post('/logout', controllers.logout);
router.post('/edit-password', controllers.editPassword);
router.post('/forgot-password', controllers.forgotPassword);
router.post('/reset-password', controllers.resetPassword);
router.get('/users', controllers.getAllUsers);
router.post('/admin/users', controllers.adminCreateUser);
router.get('/admin/users/:id/internal-stats', controllers.adminGetUserInternalStats);
router.post('/admin/users/send-credentials', controllers.adminSendUserCredentialsEmail);
router.put('/admin/users/:id', controllers.adminUpdateUser);
router.delete('/admin/users/:id', controllers.adminDeleteUser);
router.put('/admin/users/:id/toggle-status', controllers.adminToggleUserStatus);
router.post('/first-change-password', controllers.firstChangePassword);
router.get('/profile', controllers.getProfile);
router.put('/profile', controllers.updateProfile);
router.post('/profile/avatar', avatarUploadMiddleware, controllers.uploadAvatar);
router.delete('/profile/avatar', controllers.deleteAvatar);
// router.post('/send-reset-password-email', controllers.sendResetPasswordEmail);
// router.post('/verify-email', controllers.verifyEmail);
export default router;