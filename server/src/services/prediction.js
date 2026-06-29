import db from '../models';
import { spawn } from 'child_process';
import path from 'path';
import { v4 } from 'uuid';

// Đường dẫn tới thư mục HM (Python AI)
const HM_DIR = process.env.HM_ROOT || path.resolve(__dirname, '..', '..', '..', 'HM');

/**
 * Mapping feature name → gợi ý hành động cho Leader.
 */
const SUGGESTION_MAP = {
    'overdue_tasks_count': {
        vi: 'Số lượng công việc quá hạn đang rất cao.',
        suggestion: 'Hãy rà soát và ưu tiên đóng các task tồn đọng. Có thể phân bổ thêm người hỗ trợ cho những task quá hạn lâu nhất.'
    },
    'elapsed_time_ratio': {
        vi: 'Thời gian đã trôi qua gần hết hoặc vượt quá deadline.',
        suggestion: 'Cân nhắc điều chỉnh deadline hoặc giảm scope dự án. Tổ chức họp khẩn để đánh giá lại lộ trình.'
    },
    'avg_member_kpi': {
        vi: 'Hiệu suất trung bình (KPI) của team hiện tại chưa tốt.',
        suggestion: 'Trao đổi 1-1 với các thành viên để gỡ vướng mắc. Cân nhắc bổ sung nhân sự có kinh nghiệm (Senior) vào dự án.'
    },
    'remaining_hard_tasks': {
        vi: 'Còn quá nhiều công việc có độ khó cao chưa hoàn thành.',
        suggestion: 'Tổ chức họp kỹ thuật (Technical Sync) để chia nhỏ (break down) các task khó. Giao task cho người có chuyên môn phù hợp.'
    },
    'remaining_high_priority_tasks': {
        vi: 'Nhiều công việc ưu tiên cao vẫn chưa được giải quyết.',
        suggestion: 'Tập trung nguồn lực vào các task ưu tiên cao. Tạm hoãn hoặc giảm ưu tiên các task ít quan trọng hơn.'
    },
    'task_completion_ratio': {
        vi: 'Tỉ lệ hoàn thành task còn thấp so với tiến độ thời gian.',
        suggestion: 'Xem xét lại phân bổ công việc, đảm bảo mỗi thành viên có lượng task hợp lý. Tăng cường kiểm tra tiến độ hàng ngày (Daily Standup).'
    },
    'total_tasks': {
        vi: 'Tổng số lượng task của dự án khá lớn.',
        suggestion: 'Rà soát lại danh sách task, loại bỏ hoặc gộp những task trùng lặp. Chia dự án thành các sprint/phase nhỏ hơn.'
    },
    'team_size': {
        vi: 'Quy mô team chưa phù hợp với khối lượng công việc.',
        suggestion: 'Cân nhắc bổ sung thêm thành viên hoặc tái phân bổ resource từ dự án khác.'
    },
    'planned_duration_days': {
        vi: 'Thời gian dự kiến của dự án có thể chưa hợp lý.',
        suggestion: 'Đánh giá lại timeline, so sánh với các dự án tương tự trước đó để điều chỉnh kế hoạch.'
    }
};

/**
 * Thu thập dữ liệu thực tế của project từ database.
 */
export const collectProjectData = async (projectId) => {
    // 1. Lấy thông tin project + members (đầy đủ fields cho Model A & B)
    const project = await db.Project.findOne({
        where: { id: projectId },
        include: [
            {
                model: db.Project_Member,
                as: 'members',
                include: [{
                    model: db.Users,
                    as: 'user',
                    attributes: [
                        'id',
                        // Model A (Onboarding): cpa, interviewScore, cvScore, yearsExperience, numProjectsPrior
                        'cpa', 'interviewScore', 'cvScore', 'yearsExperience', 'numProjectsPrior',
                        // Model B (Internal): yearsAtCompany + task stats tính từ DB
                        'yearsAtCompany',
                        'kpiScore', // fallback
                    ]
                }]
            }
        ]
    });

    if (!project) {
        throw new Error('PROJECT_NOT_FOUND');
    }

    // 2. Lấy tất cả tasks
    const tasks = await db.Task.findAll({
        where: { project_id: projectId },
        raw: true
    });

    const totalTasks = tasks.length;
    const now = new Date();

    // 3. Tính các features
    const doneTasks = tasks.filter(t => t.status === 'Done').length;
    const taskCompletionRatio = totalTasks > 0 ? doneTasks / totalTasks : 0;

    const remainingHardTasks = tasks.filter(t => t.difficulty === 'Hard' && t.status !== 'Done').length;
    const remainingHighPriorityTasks = tasks.filter(t => t.priority === 'High' && t.status !== 'Done').length;

    const overdueTasks = tasks.filter(t => {
        if (!t.dueDate || t.status === 'Done') return false;
        return new Date(t.dueDate) < now;
    }).length;

    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date);
    const plannedDurationDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    const elapsedTimeRatio = elapsedDays / plannedDurationDays;

    const teamSize = project.members ? project.members.length : 0;

    // 4. Chuẩn bị dữ liệu thành viên cho Python tính weighted KPI
    const membersData = [];
    if (project.members && project.members.length > 0) {
        for (const member of project.members) {
            const u = member.user;
            if (!u) continue;

            membersData.push({
                user_id: u.id,
                role: member.role || 'Member',
                kpi: parseFloat(u.kpiScore) || 0.5
            });
        }
    }

    return {
        project: {
            team_size: teamSize,
            planned_duration_days: plannedDurationDays,
            total_tasks: totalTasks,
            remaining_hard_tasks: remainingHardTasks,
            remaining_high_priority_tasks: remainingHighPriorityTasks,
            elapsed_time_ratio: Math.round(elapsedTimeRatio * 100) / 100,
            task_completion_ratio: Math.round(taskCompletionRatio * 100) / 100,
            overdue_tasks_count: overdueTasks,
            avg_member_kpi: 0  // Sẽ được Python tính lại bằng weighted formula
        },
        members: membersData   // Gửi dữ liệu members sang Python
    };
};

/**
 * Gọi Python CLI để dự đoán.
 */
export const callPythonPredict = (inputData) => {
    return new Promise((resolve, reject) => {
        const pythonExec = process.env.PYTHON_PATH || 'python';
        const py = spawn(pythonExec, ['-m', 'src.predict_project_cli'], {
            cwd: HM_DIR,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
        });

        let stdout = '';
        let stderr = '';

        py.stdout.on('data', (data) => {
            stdout += data.toString('utf-8');
        });

        py.stderr.on('data', (data) => {
            stderr += data.toString('utf-8');
        });

        py.on('close', (code) => {
            if (code !== 0) {
                console.error('[prediction] Python stderr:', stderr);
                return reject(new Error(`Python process exited with code ${code}: ${stderr}`));
            }

            try {
                // Lọc chỉ lấy dòng JSON cuối cùng (bỏ warning)
                const lines = stdout.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                const result = JSON.parse(jsonLine);
                if (result.error) {
                    return reject(new Error(result.error));
                }
                resolve(result);
            } catch (e) {
                reject(new Error(`Failed to parse Python output: ${stdout}`));
            }
        });

        // Gửi dữ liệu vào stdin của Python
        py.stdin.write(JSON.stringify(inputData));
        py.stdin.end();
    });
};

/**
 * Service chính: Thu thập → Dự đoán → Gợi ý.
 */
export const predictProjectDelayService = async (projectId, userId) => {
    // Kiểm tra quyền: chỉ Leader/Admin mới được xem
    const project = await db.Project.findOne({ where: { id: projectId } });
    if (!project) {
        return { err: 1, msg: 'PROJECT_NOT_FOUND' };
    }

    // Kiểm tra quyền leader
    const isLeader = project.leader_id === userId || project.created_by === userId;
    if (!isLeader) {
        const member = await db.Project_Member.findOne({
            where: {
                project_id: projectId,
                user_id: userId,
                role: 'Leader'
            }
        });
        // Kiểm tra role Admin
        const currentUser = await db.Users.findOne({ where: { id: userId } });
        if (!member && currentUser?.role !== 'Admin') {
            return { err: 1, msg: 'ONLY_LEADER_OR_ADMIN' };
        }
    }

    // 1. Thu thập dữ liệu
    const inputData = await collectProjectData(projectId);

    const now = new Date();
    const endDate = new Date(project.end_date);
    const isOverdue = now > endDate;
    const isCompleted = inputData.project.total_tasks > 0 && inputData.project.task_completion_ratio >= 1;

    let prediction;
    if (isOverdue && !isCompleted) {
        prediction = {
            risk_level: 'High',
            top_reasons: [
                { feature: 'elapsed_time_ratio', importance: 1.0 },
                { feature: 'task_completion_ratio', importance: 0.8 }
            ],
            model_evaluation: null
        };
    } else {
        // 2. Gọi Python
        prediction = await callPythonPredict(inputData);
    }

    // 3. Map gợi ý
    const suggestions = prediction.top_reasons.map(reason => {
        const mapping = SUGGESTION_MAP[reason.feature] || {
            vi: `Yếu tố "${reason.feature}" ảnh hưởng đến tiến độ.`,
            suggestion: 'Hãy xem xét lại yếu tố này.'
        };
        return {
            feature: reason.feature,
            importance: reason.importance,
            description: mapping.vi,
            suggestion: mapping.suggestion
        };
    });

    // Save/Update Project_Prediction in database
    try {
        const progressPercentage = Math.round(inputData.project.task_completion_ratio * 100);
        let estimatedCompletionDate;
        if (inputData.project.task_completion_ratio > 0) {
            const startDate = new Date(project.start_date);
            const plannedDays = inputData.project.planned_duration_days;
            const daysNeeded = plannedDays / inputData.project.task_completion_ratio;
            estimatedCompletionDate = new Date(startDate.getTime() + daysNeeded * 24 * 60 * 60 * 1000);
        } else {
            estimatedCompletionDate = new Date(project.end_date);
        }

        const actualCompletionDate = isCompleted ? new Date() : null;
        const delayRiskLevel = prediction.risk_level;
        const delayReason = prediction.top_reasons && prediction.top_reasons.length > 0
            ? prediction.top_reasons.map(r => `${r.feature} (${Math.round(r.importance * 100)}%)`).join(', ')
            : 'N/A';

        const existingPrediction = await db.Project_Prediction.findOne({
            where: { project_id: projectId }
        });

        if (existingPrediction) {
            await existingPrediction.update({
                estimated_completion_date: estimatedCompletionDate,
                actual_completion_date: actualCompletionDate,
                progress_percentage: progressPercentage,
                delay_risk_level: delayRiskLevel,
                delay_reason: delayReason,
                updatedAt: new Date()
            });
        } else {
            await db.Project_Prediction.create({
                id: v4(),
                project_id: projectId,
                estimated_completion_date: estimatedCompletionDate,
                actual_completion_date: actualCompletionDate,
                progress_percentage: progressPercentage,
                delay_risk_level: delayRiskLevel,
                delay_reason: delayReason,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        console.log(`Saved project prediction for project ${projectId} to DB.`);
    } catch (dbError) {
        console.error('Failed to save project prediction to database:', dbError);
    }

    return {
        err: 0,
        msg: 'OK',
        prediction: {
            risk_level: prediction.risk_level,
            input_summary: inputData.project,
            suggestions,
            // ─── Đánh giá mô hình chi tiết ───
            model_evaluation: prediction.model_evaluation || null,
        }
    };
};
