import random from './randomNumber';


export default function() {
    const payload = {
        attachment: {
            id: "",
            name: ""
        },
        attachment_path: '',
        class_id: process.env.CLASS_ID,
        class_roster_student_ids: [
            process.env.CLASS_STUDENT_ID_1,
            process.env.CLASS_STUDENT_ID_2,
        ],
        class_roster_teacher_ids: [
            process.env.TEACHER_ID_1,
            process.env.ID_ORG_ADMIN_1
        ],
        class_type: "OnlineClass",
        description: "Test",
        due_at: 0,
        end_at: Math.round((new Date().getTime() + (7 * 60000)) / 1000),
        is_all_day: false,
        is_force: false,
        is_home_fun: false,
        is_repeat: false,
        lesson_plan_id: process.env.LESSON_PLAN_ID,
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
            process.env.TEACHER_ID_1,
            process.env.ID_ORG_ADMIN_1
        ],
        title: `Test 1A - ${random(100000)}`,
        start_at: Math.round((new Date().getTime() + (5 * 60000)) / 1000),
        time_zone_offset: -21600
    }

    return payload;
}