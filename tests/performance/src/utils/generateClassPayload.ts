import random from './randomNumber';


// attachment: {id: "", name: ""}
// attachment_path: ""
// class_id: "a6c6ac2b-07fa-43fb-a22f-b5b876fc89cb"
// class_roster_student_ids: ["0e1c3145-af1d-40a2-9fe9-da0ff4f6c507", "19a4b61f-d0d6-470d-ac6b-66a5fbd77e43",…]
// class_roster_teacher_ids: ["520e3b27-10c8-485b-bd73-c530b54d96cd"]
// class_type: "OnlineClass"
// description: ""
// due_at: 0
// end_at: 1643240460
// is_all_day: false
// is_force: false
// is_home_fun: false
// is_repeat: false
// lesson_plan_id: "6193b6fe0d0935f062be64ad"
// outcome_ids: []
// participants_student_ids: []
// participants_teacher_ids: ["019440e0-7e65-457a-b160-e3bb7996967b", "0a9373da-7570-4719-8f94-6ac2e5327eb3",…]
// program_id: "4d5b9056-5a6f-40bf-8602-7f8934aef045"
// repeat: {}
// start_at: 1643240220
// subject_id: "36c4f793-9aa3-4fb8-84f0-68a2ab920d5a"
// subject_ids: ["36c4f793-9aa3-4fb8-84f0-68a2ab920d5a"]
// teacher_ids: ["520e3b27-10c8-485b-bd73-c530b54d96cd", "0e1c3145-af1d-40a2-9fe9-da0ff4f6c507",…]
// time_zone_offset: -21600
// title: "001"

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