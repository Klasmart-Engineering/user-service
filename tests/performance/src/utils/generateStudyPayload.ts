import random from './randomNumber';

export default function() {
    const payload = {
        attachment: {
            id: "",
            name: ""
        },
        attachment_path: '',
        class_id: process.env.CLASS_ID_STUDY,
        class_roster_student_ids: [
            process.env.CLASS_STUDENT_ID_1,
            process.env.CLASS_STUDENT_ID_2,
        ],
        class_roster_teacher_ids: [
            process.env.TEACHER_ID_1
        ],
        class_type: "Homework",
        description: "Test Study",
        due_at: Math.round((new Date().getTime() + (6 * 60000)) / 1000),
        end_at: Math.round((new Date().getTime() + (7 * 60000)) / 1000),
        is_all_day: false,
        is_force: true,
        is_home_fun: false,
        is_repeat: false,
        lesson_plan_id: process.env.LESSON_PLAN_ID_STUDY,
        outcome_ids: [],
        participants_student_ids: [],
        participants_teacher_ids: [],
        program_id: process.env.PROGRAM_ID,
        repeat: {},
        subject_id: process.env.SUBJECT_ID,
        subject_ids: [
            process.env.SUBJECT_ID
        ],
        teacher_ids: [
            process.env.TEACHER_ID_1
        ],
        title: `Test Study - ${random(100000)}`,
        start_at: Math.round((new Date().getTime() + (5 * 60000)) / 1000),
        time_zone_offset: -10800
    }

    return payload;
}