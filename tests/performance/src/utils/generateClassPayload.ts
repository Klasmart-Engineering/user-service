import random from './randomNumber';


export default function() {
    const payload = {
        attachment_path: '',
        class_id: process.env.CLASS_ID,
        class_type: "OnlineClass",
        description: "Test",
        due_at: 0,
        is_all_day: false,
        is_force: false,
        is_repeat: false,
        lesson_plan_id: process.env.LESSON_PLAN_ID,
        program_id: process.env.PROGRAM_ID,
        repeat: {},
        subject_id: process.env.SUBJECT_ID,
        teacher_ids: [
            process.env.TEACHER_ID_1
        ],
        title: `Test 1A - ${random(100000)}`,
        outcome_ids: [],
        start_at: Math.round((new Date().getTime() + (5 * 60000)) / 1000),
        end_at: Math.round((new Date().getTime() + (7 * 60000)) / 1000),
        subject_ids: [
            process.env.SUBJECT_ID
        ],
        attachment: {
          id: "",
          name: ""
        },
        time_zone_offset: -21600,
        is_home_fun: false,
        class_roster_student_ids: [
            process.env.CLASS_STUDENT_ID_1,
            process.env.CLASS_STUDENT_ID_2,
        ],
        class_roster_teacher_ids: [
            process.env.TEACHER_ID_1
        ],
        participants_student_ids: [],
        participants_teacher_ids: []
    }

    return payload;
}