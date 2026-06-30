import db from '../models'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 } from 'uuid'
import nodemailer from 'nodemailer'
import {
    isCloudinaryConfigured,
    configureCloudinary,
    uploadAvatarBuffer,
    destroyCloudinaryAsset,
} from '../config/cloudinary'
import { predictInternalKpi, predictOnboardingKpi } from './kpiPython'



const hashPassword = (password) => {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10))
}

const comparePassword = (password, hashPassword) => {
    return bcrypt.compareSync(password, hashPassword)
}

const generateToken = (username, id, role, mustChangePassword) => {
    return jwt.sign({ username, id, role, mustChangePassword }, process.env.JWT_SECRET, { expiresIn: '24h' })
}

const generateRefreshToken = (username, id, role) => {
    return jwt.sign({ username, id, role }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

const buildPublicUserProfile = (user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive !== undefined ? user.isActive : true,
    avatarUrl: user.avatarUrl ?? null,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    kpiScore: user.kpiScore != null ? Number(user.kpiScore) : null,
    kpiModelAtSignup: user.kpiModelAtSignup ?? null,
    cpa: user.cpa != null ? Number(user.cpa) : null,
    yearsAtCompany:
        user.yearsAtCompany != null ? Number(user.yearsAtCompany) : 0,
    interviewScore: user.interviewScore != null ? Number(user.interviewScore) : null,
    cvScore: user.cvScore != null ? Number(user.cvScore) : null,
    yearsExperience: user.yearsExperience != null ? Number(user.yearsExperience) : 0,
    numProjectsPrior: user.numProjectsPrior != null ? Number(user.numProjectsPrior) : 0,
})

const normalizeKpiProfile = (body = {}) => {
    const rawCpa = body.cpa != null ? body.cpa : body.gpa
    const cpa = rawCpa != null ? Number(rawCpa) : 3.0
    const interview_score = body.interview_score != null ? Number(body.interview_score) : 6.0
    const cv_score = body.cv_score != null ? Number(body.cv_score) : 6.0
    const years_experience = body.years_experience != null ? Number(body.years_experience) : 0
    const num_projects = body.num_projects != null ? Number(body.num_projects) : 0
    return { cpa, interview_score, cv_score, years_experience, num_projects }
}

export const registerService = (username, email, password, kpiBody = {}) => new Promise(async (resolve, reject) => {
    try {
        const dup = await db.Users.findOne({ where: { email } })
        if (dup) {
            return resolve({
                err: 1,
                msg: 'Email hash been aldready used!',
            })
        }

        const kp = normalizeKpiProfile(kpiBody)
        const pred = predictOnboardingKpi({
            cpa: kp.cpa,
            interview_score: kp.interview_score,
            cv_score: kp.cv_score,
            years_experience: kp.years_experience,
            num_projects: kp.num_projects,
        })
        const kpiScore = pred.kpi != null ? pred.kpi : null
        const kpiModelAtSignup = pred.model != null ? pred.model : null
        if (pred.err) {
            console.warn('[register] KPI Python không chạy được, vẫn tạo user:', pred.msg)
        }

        const userRow = await db.Users.create({
            username,
            email,
            password: hashPassword(password),
            id: v4(),
            role: 'Member',
            cpa: kp.cpa,
            yearsAtCompany: 0,
            interviewScore: kp.interview_score,
            cvScore: kp.cv_score,
            yearsExperience: kp.years_experience,
            numProjectsPrior: Math.max(0, Math.floor(kp.num_projects)),
            kpiScore,
            kpiModelAtSignup,
        })

        resolve({
            err: 0,
            msg: 'Register is successfully !',
            response: buildPublicUserProfile(userRow),
        })
    } catch (error) {
        reject(error)
    }
})

export const loginService = (email, password) => new Promise(async (resolve, reject) => {
    try {
        const user = await db.Users.findOne({
            where: { email },
            raw: true
        })
        if (user) {
            // Kiểm tra tài khoản có bị khóa không
            if (!user.isActive) {
                return resolve({
                    err: 1,
                    msg: 'Tài khoản đã bị khóa. Vui lòng liên hệ Admin để được hỗ trợ.'
                })
            }

            const isCorrectPassword = bcrypt.compareSync(password, user.password)
            if (isCorrectPassword) {
                const access_token = generateToken(user.username, user.id, user.role, user.mustChangePassword)
                const refresh_token = generateRefreshToken(user.username, user.id, user.role)

                const {
                    password: _pw,
                    resetToken: _rt,
                    resetTokenExpiry: _rte,
                    avatarPublicId: _apid,
                    ...safeUser
                } = user

                resolve({
                    err: 0,
                    msg: 'Login is successfully !',
                    token: access_token,
                    refreshToken: refresh_token,
                    response: safeUser
                })
            } else {
                resolve({
                    err: 1,
                    msg: 'Password is incorrect !'
                })
            }
        } else {
            resolve({
                err: 1,
                msg: 'Email is not exist !'
            })
        }
    } catch (error) {
        reject(error)
    }
})

export const editPasswordService = (id, oldPassword, newPassword) => new Promise(async (resolve, reject) => {
    try {
        const user = await db.Users.findOne({
            where: { id },
            raw: true
        })
        if (!user) {
            resolve({
                err: 1,
                msg: 'User is not exist'
            })
        }

        const isCorrectPassword = comparePassword(oldPassword, user.password)
        if (!isCorrectPassword) {
            resolve({
                err: 1,
                msg: 'Old password is incorrect'

            })
        }
        await db.Users.update({
            password: hashPassword(newPassword)
        }, {
            where: { id }
        })
        resolve({
            err: 0,
            msg: 'Password is updated successfully'
        })

    } catch (error) {
        reject(error)
    }
})

export const logoutService = () => new Promise(async (resolve, reject) => {
    try {
        resolve({
            err: 0,
            msg: 'Logout is successfully !'
        })
    } catch (error) {
        reject(error)
    }
})


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
})

// Hàm gửi email
const sendResetPasswordEmail = async (toEmail, resetToken) => {
    const resetLink = `${process.env.URL_REACT}/reset-password?token=${resetToken}`; // URL frontend
    let mailOptions = {
        from: '"MentorHub" <your_email@gmail.com>', // Tên thương hiệu + email gửi
        to: toEmail,
        subject: '[MentorHub] Yêu cầu đặt lại mật khẩu tài khoản của bạn',
        text: `Xin chào,\n\nBạn vừa gửi yêu cầu đặt lại mật khẩu cho tài khoản MentorHub của mình.\nVui lòng nhấn vào liên kết sau để đặt lại mật khẩu mới (liên kết này sẽ hết hạn sau 15 phút):\n\n${resetLink}\n\nNếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu của bạn sẽ không bị thay đổi.\n\nCảm ơn bạn đã sử dụng MentorHub.\nĐội ngũ phát triển MentorHub`,
        html: `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px; text-align: center; color: #fff;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Đặt lại mật khẩu</h1>
              <p style="margin: 8px 0 0; opacity: 0.9; font-size: 15px;">Khôi phục tài khoản MentorHub của bạn</p>
            </div>
            <div style="padding: 24px; background-color: #fff;">
              <h2 style="color: #1e3a8a; margin-top: 0; font-size: 18px;">Xin chào,</h2>
              <p style="line-height: 1.6; font-size: 15px;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn trên hệ thống <b>MentorHub</b>.</p>
              <p style="line-height: 1.6; font-size: 15px;">Vui lòng nhấn vào nút bên dưới để tiến hành đặt mật khẩu mới:</p>
              
              <div style="margin: 28px 0; text-align: center;">
                <a href="${resetLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                  Đặt lại mật khẩu
                </a>
              </div>
              
              <p style="line-height: 1.6; font-size: 15px;">Nếu nút trên không hoạt động, bạn cũng có thể sao chép và dán liên kết sau vào thanh địa chỉ của trình duyệt:</p>
              <p style="word-break: break-all; font-family: monospace; font-size: 13px; color: #2563eb;"><a href="${resetLink}" style="color: #2563eb; text-decoration: underline;">${resetLink}</a></p>
              
              <p style="color: #ef4444; font-size: 13px; line-height: 1.5; font-style: italic; background-color: #fef2f2; padding: 12px; border-radius: 6px; border: 1px dashed #fca5a5; margin-top: 20px;">
                * <strong>Lưu ý:</strong> Liên kết này chỉ có hiệu lực trong vòng 15 phút vì lý do bảo mật. Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email này. Mật khẩu của bạn vẫn được giữ an toàn.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
              <p style="font-size: 13px; color: #9ca3af; margin: 0;">Cảm ơn bạn đã đồng hành cùng chúng tôi,<br><strong style="color: #4b5563;">Đội ngũ phát triển MentorHub</strong></p>
            </div>
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
              Đây là email tự động từ hệ thống MentorHub. Vui lòng không phản hồi email này.
            </div>
        </div>`
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return { success: true, response: info.response };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}
export const forgotPasswordService = (email) => new Promise(async (resolve, reject) => {
    try {
        const user = await db.Users.findOne({
            where: { email },
            raw: true
        })
        if (!user) {
            resolve({
                err: 1,
                msg: 'Email is not exist'
            })
        }
        const resetToken = v4()
        // update resetToken và resetTokenExpiry vào database
        await db.Users.update({
            resetToken: resetToken,
            resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000 + 7*60*60*1000) // 15 minutes from now
        }, {
            where: { email }
        })
        const response = await sendResetPasswordEmail(email, resetToken)
        console.log(response)
        resolve({
            err: 0,
            msg: 'New password is sent to email',
            response: response
        })
    } catch (error) {
        reject(error)
    }
})


export const resetPasswordService = (token, newPassword) => new Promise(async (resolve, reject) => {
    try {
        const user = await db.Users.findOne({
            where: {
                resetToken: token,
                resetTokenExpiry: { [db.Sequelize.Op.gt]: new Date() }
            },
            raw: true
        })
        if (!user) {
            resolve({
                err: 1,
                msg: 'Token is expired or not exist'
            })
        }
        await db.Users.update({
            password: hashPassword(newPassword)
        }, {
            where: { resetToken: token }
        })
        resolve({
            err: 0,
            msg: 'Password is updated successfully'
        })
    } catch (error) {
        reject(error)
    }
})

// //GET ALL USERS (with optional search)
export const getAllUsersService = (searchQuery) => new Promise(async (resolve, reject) => {
    try {
        const whereClause = {};
        
        if (searchQuery) {
            whereClause[db.Sequelize.Op.or] = [
                { username: { [db.Sequelize.Op.like]: `%${searchQuery}%` } },
                { email: { [db.Sequelize.Op.like]: `%${searchQuery}%` } }
            ];
        }

        const users = await db.Users.findAll({
            where: whereClause,
            attributes: [
                'id', 'username', 'email', 'role', 'avatarUrl', 'isActive',
                'kpiScore', 'kpiModelAtSignup',
                'cpa', 'interviewScore', 'cvScore',
                'yearsAtCompany', 'yearsExperience', 'numProjectsPrior',
            ],
            order: [['username', 'ASC']],
            limit: 100 // Limit to prevent loading too many users
        });

        resolve({
            err: 0,
            msg: 'OK',
            response: users
        });
    } catch (error) {
        resolve({
            err: 1,
            msg: 'FAILED TO GET USERS: ' + error.message,
            response: []
        });
    }
});

// Admin: create user with random password and specific role (+ KPI từ HM LR)
export const adminCreateUserService = (username, email, role = 'Member', kpiBody = {}) => new Promise(async (resolve, reject) => {
    try {
        const existing = await db.Users.findOne({ where: { email } });
        if (existing) {
            return resolve({
                err: 1,
                msg: 'Email đã tồn tại',
            });
        }

        const kp = normalizeKpiProfile(kpiBody)
        const rawYac = kpiBody.years_at_company ?? kpiBody.yearsAtCompany
        const yac =
            rawYac !== undefined && rawYac !== null && rawYac !== ''
                ? Number(rawYac)
                : 0
        const yearsAtCompany =
            Number.isFinite(yac) && yac >= 0 && yac <= 50 ? yac : 0

        const pred = predictOnboardingKpi({
            cpa: kp.cpa,
            interview_score: kp.interview_score,
            cv_score: kp.cv_score,
            years_experience: kp.years_experience,
            num_projects: kp.num_projects,
        })
        let kpiScore = pred.kpi != null ? pred.kpi : null
        let kpiModelAtSignup = pred.model != null ? pred.model : null
        if (pred.err) {
            console.warn('[adminCreateUser] KPI Python:', pred.msg)
        }

        const plainPassword = Math.random().toString(36).slice(-10);
        const user = await db.Users.create({
            id: v4(),
            username,
            email,
            password: hashPassword(plainPassword),
            role,
            mustChangePassword: true,
            cpa: kp.cpa,
            yearsAtCompany,
            interviewScore: kp.interview_score,
            cvScore: kp.cv_score,
            yearsExperience: kp.years_experience,
            numProjectsPrior: Math.max(0, Math.floor(kp.num_projects)),
            kpiScore,
            kpiModelAtSignup,
        });

        resolve({
            err: 0,
            msg: 'Tạo tài khoản thành công',
            response: {
                ...buildPublicUserProfile(user),
                // trả về mật khẩu để Admin gửi cho user
                tempPassword: plainPassword,
            },
        });
    } catch (error) {
        reject(error);
    }
});

// Admin: send created account credentials to user's email
const sendAdminCreatedUserCredentialsEmail = async (toEmail, username, plainPassword) => {
    const loginLink = `${process.env.URL_REACT}/sign-in`;
    const fromEmail = process.env.EMAIL_USER || "your_email@gmail.com";
    const mailOptions = {
        from: `"MentorHub" <${fromEmail}>`,
        to: toEmail,
        subject: "[MentorHub] Thông tin tài khoản đăng nhập",
        text: `Xin chào ${username},\n\nChào mừng bạn đến với MentorHub - Hệ thống Quản lý Dự án & Cố vấn Học tập.\n\nTài khoản của bạn đã được quản trị viên khởi tạo thành công trên hệ thống.\n\nThông tin đăng nhập:\n- Email: ${toEmail}\n- Mật khẩu tạm thời: ${plainPassword}\n\nVui lòng đăng nhập tại liên kết sau:\n${loginLink}\n\n* Lưu ý: Để bảo mật tài khoản, hệ thống sẽ yêu cầu bạn đổi mật khẩu mới ngay trong lần đăng nhập đầu tiên.\n\nTrân trọng,\nĐội ngũ phát triển MentorHub`,
        html: `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px; text-align: center; color: #fff;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Chào mừng đến với MentorHub!</h1>
              <p style="margin: 8px 0 0; opacity: 0.9; font-size: 15px;">Hệ thống Quản lý Dự án & Cố vấn Học tập</p>
            </div>
            <div style="padding: 24px; background-color: #fff;">
              <h2 style="color: #1e3a8a; margin-top: 0; font-size: 18px;">Xin chào ${username},</h2>
              <p style="line-height: 1.6; font-size: 15px;">Tài khoản của bạn đã được quản trị viên khởi tạo thành công trên hệ thống <b>MentorHub</b>.</p>
              <p style="line-height: 1.6; font-size: 15px;">Dưới đây là thông tin tài khoản đăng nhập của bạn:</p>
              
              <div style="margin: 20px 0; padding: 16px; background-color: #f3f4f6; border-left: 4px solid #2563eb; border-radius: 4px;">
                <p style="margin: 0 0 8px; font-size: 14px; color: #4b5563;"><strong>Email:</strong> <span style="color: #111827; font-family: monospace;">${toEmail}</span></p>
                <p style="margin: 0; font-size: 14px; color: #4b5563;"><strong>Mật khẩu tạm thời:</strong> <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 4px; color: #b91c1c; font-family: monospace; font-size: 14px; font-weight: bold;">${plainPassword}</code></p>
              </div>
              
              <p style="line-height: 1.6; font-size: 15px;">Vui lòng truy cập liên kết dưới đây để đăng nhập và bắt đầu sử dụng:</p>
              
              <div style="margin: 28px 0; text-align: center;">
                <a href="${loginLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                  Đăng nhập hệ thống
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 13px; line-height: 1.5; font-style: italic; background-color: #eff6ff; padding: 12px; border-radius: 6px; border: 1px dashed #bfdbfe;">
                * <strong>Lưu ý bảo mật:</strong> Để đảm bảo an toàn thông tin cá nhân, hệ thống sẽ tự động yêu cầu bạn thay đổi mật khẩu mới trong lần đầu tiên đăng nhập.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
              <p style="font-size: 13px; color: #9ca3af; margin: 0;">Trân trọng,<br><strong style="color: #4b5563;">Đội ngũ phát triển MentorHub</strong></p>
            </div>
            <div style="background-color: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
              Đây là email tự động từ hệ thống MentorHub. Vui lòng không phản hồi email này.
            </div>
        </div>`
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Admin created user email sent:", info?.response);
        return { success: true, response: info?.response };
    } catch (error) {
        console.error("Admin created user email error:", error?.message || error);
        return { success: false, error: error?.message || String(error) };
    }
};

export const adminSendUserCredentialsEmailService = (username, email, tempPassword) =>
    new Promise(async (resolve) => {
        try {
            if (!username || !email || !tempPassword) {
                return resolve({ err: 1, msg: "Missing required fields" });
            }

            const result = await sendAdminCreatedUserCredentialsEmail(email, username, tempPassword);
            if (!result.success) {
                return resolve({
                    err: 1,
                    msg: "Gửi email thất bại",
                    response: result,
                });
            }

            return resolve({
                err: 0,
                msg: "Gửi email thành công",
                response: result,
            });
        } catch (error) {
            return resolve({
                err: 1,
                msg: "Gửi email thất bại: " + (error?.message || String(error)),
            });
        }
    });

export const adminUpdateUserService = (id, data) => new Promise(async (resolve, reject) => {
    try {
        const user = await db.Users.findByPk(id);
        if (!user) {
            return resolve({
                err: 1,
                msg: 'User không tồn tại',
            });
        }

        const updatePayload = {};

        if (data.username !== undefined) {
            updatePayload.username = String(data.username).trim();
        }
        if (data.email !== undefined) {
            const email = String(data.email).trim().toLowerCase();
            const prevEmail = String(user.email || '').trim().toLowerCase();
            if (email !== prevEmail) {
                const dup = await db.Users.findOne({
                    where: {
                        email,
                        id: { [db.Sequelize.Op.ne]: user.id },
                    },
                });
                if (dup) {
                    return resolve({
                        err: 1,
                        msg: 'Email đã được sử dụng bởi tài khoản khác',
                    });
                }
            }
            updatePayload.email = email;
        }
        if (data.role !== undefined) {
            updatePayload.role = data.role;
        }

        const onboardingFieldKeys = [
            'cpa',
            'gpa',
            'interview_score',
            'interviewScore',
            'cv_score',
            'cvScore',
            'years_experience',
            'yearsExperience',
            'num_projects',
            'numProjectsPrior',
        ]
        const hasOnboardingPatch = onboardingFieldKeys.some((k) => data[k] !== undefined)

        if (hasOnboardingPatch) {
            const rawCpa = data.cpa !== undefined ? data.cpa : data.gpa
            const cpa =
                rawCpa !== undefined && rawCpa !== null && rawCpa !== ''
                    ? Number(rawCpa)
                    : Number(user.cpa ?? 3)
            const iv =
                data.interview_score !== undefined || data.interviewScore !== undefined
                    ? Number(data.interview_score ?? data.interviewScore)
                    : Number(user.interviewScore ?? 6)
            const cv =
                data.cv_score !== undefined || data.cvScore !== undefined
                    ? Number(data.cv_score ?? data.cvScore)
                    : Number(user.cvScore ?? 6)
            const ye =
                data.years_experience !== undefined || data.yearsExperience !== undefined
                    ? Number(data.years_experience ?? data.yearsExperience)
                    : Number(user.yearsExperience ?? 0)
            const np =
                data.num_projects !== undefined || data.numProjectsPrior !== undefined
                    ? Number(data.num_projects ?? data.numProjectsPrior)
                    : Number(user.numProjectsPrior ?? 0)

            if (!Number.isFinite(cpa) || cpa < 0 || cpa > 4) {
                return resolve({ err: 1, msg: 'CPA phải từ 0 đến 4' })
            }
            if (!Number.isFinite(iv) || iv < 0 || iv > 10) {
                return resolve({ err: 1, msg: 'Điểm phỏng vấn phải từ 0 đến 10' })
            }
            if (!Number.isFinite(cv) || cv < 0 || cv > 10) {
                return resolve({ err: 1, msg: 'Điểm CV phải từ 0 đến 10' })
            }
            if (!Number.isFinite(ye) || ye < 0 || ye > 50) {
                return resolve({ err: 1, msg: 'Số năm kinh nghiệm không hợp lệ' })
            }
            if (!Number.isFinite(np) || np < 0 || np > 200) {
                return resolve({ err: 1, msg: 'Số project không hợp lệ' })
            }

            const pred = predictOnboardingKpi({
                cpa,
                interview_score: iv,
                cv_score: cv,
                years_experience: ye,
                num_projects: np,
            })
            updatePayload.cpa = cpa
            updatePayload.interviewScore = iv
            updatePayload.cvScore = cv
            updatePayload.yearsExperience = ye
            updatePayload.numProjectsPrior = Math.max(0, Math.floor(np))
            if (!pred.err && pred.kpi != null) {
                updatePayload.kpiScore = pred.kpi
                updatePayload.kpiModelAtSignup = pred.model
            } else if (pred.err) {
                console.warn('[adminUpdateUser] KPI Python:', pred.msg)
            }
        }

        if (data.years_at_company !== undefined || data.yearsAtCompany !== undefined) {
            const yac = Number(data.years_at_company ?? data.yearsAtCompany)
            if (!Number.isFinite(yac) || yac < 0 || yac > 50) {
                return resolve({
                    err: 1,
                    msg: 'Số năm làm việc tại công ty không hợp lệ (0–50)',
                })
            }
            updatePayload.yearsAtCompany = yac
        }

        // Nếu admin nhập số liệu nội bộ → dùng Model B (internal) để tính KPI (max 1.0)
        const internalKeys = ['total_projects', 'total_tasks', 'hard_tasks']
        const hasInternalPatch = internalKeys.some((k) => data[k] !== undefined)
        const nextYearsAtCompany =
            updatePayload.yearsAtCompany !== undefined
                ? Number(updatePayload.yearsAtCompany)
                : Number(user.yearsAtCompany ?? 0)

        if (hasInternalPatch && nextYearsAtCompany >= 1) {
            const tp = Number(data.total_projects ?? 0)
            const tt = Number(data.total_tasks ?? 0)
            const ht = Number(data.hard_tasks ?? 0)
            if (!Number.isFinite(tp) || tp < 0 || tp > 1000) {
                return resolve({ err: 1, msg: 'total_projects không hợp lệ' })
            }
            if (!Number.isFinite(tt) || tt < 0 || tt > 100000) {
                return resolve({ err: 1, msg: 'total_tasks không hợp lệ' })
            }
            if (!Number.isFinite(ht) || ht < 0 || ht > tt) {
                return resolve({ err: 1, msg: 'hard_tasks không hợp lệ' })
            }
            const pred = predictInternalKpi({
                total_projects: tp,
                total_tasks: tt,
                hard_tasks: ht,
                years_at_company: nextYearsAtCompany,
            })
            if (!pred.err && pred.kpi != null) {
                updatePayload.kpiScore = pred.kpi
                updatePayload.kpiModelAtSignup = pred.model // "B"
            } else if (pred.err) {
                console.warn('[adminUpdateUser] KPI Python internal:', pred.msg)
            }
        }

        // Nếu years_at_company < 1 thì coi như chưa đủ điều kiện dùng Model B.
        // Đảm bảo KPI/model quay về onboarding (A) khi admin đặt years_at_company về 0.
        if (nextYearsAtCompany < 1) {
            // nếu đã tính onboarding ở trên (hasOnboardingPatch) thì pred.model sẽ là "A"
            // còn nếu không có onboarding patch, force model về A để không bị kẹt "B"
            if (updatePayload.kpiModelAtSignup === undefined) {
                updatePayload.kpiModelAtSignup = 'A'
            }
        }

        if (Object.keys(updatePayload).length === 0) {
            return resolve({
                err: 1,
                msg: 'Không có trường nào để cập nhật',
            })
        }

        await user.update(updatePayload);
        await user.reload();

        resolve({
            err: 0,
            msg: 'Cập nhật tài khoản thành công',
            response: buildPublicUserProfile(user),
        });
    } catch (error) {
        reject(error);
    }
});

export const adminGetUserInternalStatsService = (userId) =>
    new Promise(async (resolve) => {
        try {
            if (!userId) {
                return resolve({ err: 1, msg: 'Thiếu userId', response: null })
            }

            // "Mình tham gia" = task được assign (assigned_to). Có thể mở rộng thêm watchers nếu cần.
            const whereBase = { assigned_to: userId, isArchived: false }

            const totalTasks = await db.Task.count({ where: whereBase })
            const hardTasks = await db.Task.count({
                where: { ...whereBase, priority: 'High' },
            })

            const projRows = await db.Task.findAll({
                where: whereBase,
                attributes: [
                    [
                        db.Sequelize.fn(
                            'COUNT',
                            db.Sequelize.fn('DISTINCT', db.Sequelize.col('project_id'))
                        ),
                        'cnt',
                    ],
                ],
                raw: true,
            })
            const totalProjects = Number(projRows?.[0]?.cnt ?? 0)

            return resolve({
                err: 0,
                msg: 'OK',
                response: {
                    total_projects: totalProjects,
                    total_tasks: totalTasks,
                    hard_tasks: hardTasks,
                },
            })
        } catch (error) {
            return resolve({
                err: 1,
                msg: 'FAILED TO GET INTERNAL STATS: ' + (error?.message || String(error)),
                response: null,
            })
        }
    })

export const adminDeleteUserService = (id) => new Promise(async (resolve, reject) => {
    try {
        const user = await db.Users.findByPk(id);
        if (!user) {
            return resolve({
                err: 1,
                msg: 'User không tồn tại',
            });
        }
        if (user.avatarPublicId && isCloudinaryConfigured()) {
            configureCloudinary();
            await destroyCloudinaryAsset(user.avatarPublicId);
        }
        await user.destroy();
        resolve({
            err: 0,
            msg: 'Xóa tài khoản thành công',
        });
    } catch (error) {
        reject(error);
    }
});

// Admin: Toggle trạng thái tài khoản (đóng/mở)
export const adminToggleUserStatusService = (id, isActive) => new Promise(async (resolve, reject) => {
    try {
        const user = await db.Users.findByPk(id);
        if (!user) {
            return resolve({
                err: 1,
                msg: 'User không tồn tại',
            });
        }

        // Không cho phép khóa chính tài khoản Admin đang thao tác
        if (user.role === 'Admin' && isActive === false) {
            return resolve({
                err: 1,
                msg: 'Không thể khóa tài khoản Admin',
            });
        }

        await user.update({ isActive: Boolean(isActive) });
        await user.reload();

        resolve({
            err: 0,
            msg: isActive ? 'Mở khóa tài khoản thành công' : 'Khóa tài khoản thành công',
            response: buildPublicUserProfile(user),
        });
    } catch (error) {
        reject(error);
    }
});

// First login: user must change password
export const firstChangePasswordService = (id, newPassword) => new Promise(async (resolve, reject) => {
    try {
        const user = await db.Users.findByPk(id);
        if (!user) {
            return resolve({
                err: 1,
                msg: 'User không tồn tại',
            });
        }

        await user.update({
            password: hashPassword(newPassword),
            mustChangePassword: false,
        });

        resolve({
            err: 0,
            msg: 'Đổi mật khẩu lần đầu thành công',
        });
    } catch (error) {
        reject(error);
    }
});

export const getCurrentUserProfileService = (id) =>
    new Promise(async (resolve, reject) => {
        try {
            const user = await db.Users.findByPk(id, {
                attributes: [
                    'id',
                    'username',
                    'email',
                    'role',
                    'avatarUrl',
                    'mustChangePassword',
                    'createdAt',
                    'updatedAt',
                    'kpiScore',
                    'kpiModelAtSignup',
                    'cpa',
                    'yearsAtCompany',
                    'interviewScore',
                    'cvScore',
                    'yearsExperience',
                    'numProjectsPrior',
                ],
            });
            if (!user) {
                return resolve({
                    err: 1,
                    msg: 'User không tồn tại',
                });
            }
            resolve({
                err: 0,
                msg: 'OK',
                response: buildPublicUserProfile(user),
            });
        } catch (error) {
            reject(error);
        }
    });

// Update current user's profile (currently: username)
export const updateProfileService = (id, data) => new Promise(async (resolve, reject) => {
    try {
        const user = await db.Users.findByPk(id);
        if (!user) {
            return resolve({
                err: 1,
                msg: 'User không tồn tại',
            });
        }

        const updatePayload = {};
        if (data?.username !== undefined) updatePayload.username = data.username;

        if (Object.keys(updatePayload).length === 0) {
            return resolve({
                err: 1,
                msg: 'Không có dữ liệu để cập nhật',
            });
        }

        await user.update(updatePayload);

        await user.reload();
        resolve({
            err: 0,
            msg: 'Cập nhật hồ sơ thành công',
            response: buildPublicUserProfile(user),
        });
    } catch (error) {
        reject(error);
    }
});

export const uploadAvatarService = (userId, file) =>
    new Promise(async (resolve) => {
        try {
            if (!isCloudinaryConfigured()) {
                return resolve({
                    err: 1,
                    msg: 'Chưa cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)',
                });
            }
            configureCloudinary();
            if (!file?.buffer) {
                return resolve({ err: 1, msg: 'Thiếu file ảnh' });
            }
            const user = await db.Users.findByPk(userId);
            if (!user) {
                return resolve({ err: 1, msg: 'User không tồn tại' });
            }
            const oldPublicId = user.avatarPublicId;
            const publicId = `user-${userId}-${Date.now()}`;
            const result = await uploadAvatarBuffer(file.buffer, { publicId });
            await user.update({
                avatarUrl: result.secure_url,
                avatarPublicId: result.public_id,
            });
            if (oldPublicId && oldPublicId !== result.public_id) {
                await destroyCloudinaryAsset(oldPublicId);
            }
            await user.reload();
            resolve({
                err: 0,
                msg: 'Cập nhật ảnh đại diện thành công',
                response: buildPublicUserProfile(user),
            });
        } catch (error) {
            resolve({
                err: 1,
                msg: 'Upload ảnh thất bại: ' + (error?.message || error),
            });
        }
    });

export const deleteAvatarService = (userId) =>
    new Promise(async (resolve) => {
        try {
            const user = await db.Users.findByPk(userId);
            if (!user) {
                return resolve({ err: 1, msg: 'User không tồn tại' });
            }
            const oldPublicId = user.avatarPublicId;
            await user.update({ avatarUrl: null, avatarPublicId: null });
            if (oldPublicId && isCloudinaryConfigured()) {
                configureCloudinary();
                await destroyCloudinaryAsset(oldPublicId);
            }
            await user.reload();
            resolve({
                err: 0,
                msg: 'Đã xóa ảnh đại diện',
                response: buildPublicUserProfile(user),
            });
        } catch (error) {
            resolve({
                err: 1,
                msg: 'Xóa ảnh thất bại: ' + (error?.message || error),
            });
        }
    });

// export const verifyEmailService = (email) => new Promise(async (resolve, reject) => {
//     try {
//         const user = await db.Users.findOne({
//             where: { email },
//             raw: true
//         })
//         if (!user) {
//             resolve({
//                 err: 1,
//                 msg: 'Email is not exist'
//             })
//         }
//         resolve({
//             err: 0,
//             msg: 'Email is verified'
//         })
//     } catch (error) {
//         reject(error)
//     }
// })





