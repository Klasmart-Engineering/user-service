

// attachment: {id: "", name: ""}
// attachment_path: ""
// class_id: "ba499dfa-713e-4791-920d-dcd53c740e77"
// class_roster_student_ids: ["1881d1d7-73f5-4dd2-b945-b057665f03bc", "25e81d5f-7613-47ef-bdcc-f2919f014351",…]
// class_roster_teacher_ids: ["7288b989-0694-4883-8157-ce8c7b3b0889", "c3e1fa0a-781b-4dcb-b0f3-de8f1e7e1c08"]
// class_type: "Homework"
// description: ""
// due_at: 0
// end_at: 1644336279
// is_all_day: false
// is_force: true
// is_home_fun: false
// is_repeat: false
// lesson_plan_id: "61f92f74b30b59970767de19"
// outcome_ids: []
// participants_student_ids: []
// participants_teacher_ids: ["0a9373da-7570-4719-8f94-6ac2e5327eb3"]
// program_id: "4d5b9056-5a6f-40bf-8602-7f8934aef045"
// repeat: {}
// start_at: 1644336279
// subject_id: "36c4f793-9aa3-4fb8-84f0-68a2ab920d5a"
// subject_ids: ["36c4f793-9aa3-4fb8-84f0-68a2ab920d5a"]
// teacher_ids: ["7288b989-0694-4883-8157-ce8c7b3b0889", "c3e1fa0a-781b-4dcb-b0f3-de8f1e7e1c08",…]
// time_zone_offset: -21600
// title: "Study Class"

import { check } from "k6";
import http from "k6/http";
import { params } from "../utils/params";

const studyClassPayload = {
    attachment: {id: "", name: ""},
    attachment_path: "",
    class_id: "ba499dfa-713e-4791-920d-dcd53c740e77",
    class_roster_student_ids: ["1881d1d7-73f5-4dd2-b945-b057665f03bc", "25e81d5f-7613-47ef-bdcc-f2919f014351"],
    class_roster_teacher_ids: ["7288b989-0694-4883-8157-ce8c7b3b0889", "c3e1fa0a-781b-4dcb-b0f3-de8f1e7e1c08"],
    class_type: "Homework",
    description: "",
    due_at: 0,
    end_at: Math.round((new Date().getTime() + (7 * 60000)) / 1000),
    is_all_day: false,
    is_force: true,
    is_home_fun: false,
    is_repeat: false,
    lesson_plan_id: "61f92f74b30b59970767de19",
    outcome_ids: [],
    participants_student_ids: [],
    participants_teacher_ids: ["0a9373da-7570-4719-8f94-6ac2e5327eb3"],
    program_id: "4d5b9056-5a6f-40bf-8602-7f8934aef045",
    repeat: {},
    start_at: Math.round((new Date().getTime() + (5 * 60000)) / 1000),
    subject_id: "36c4f793-9aa3-4fb8-84f0-68a2ab920d5a",
    subject_ids: ["36c4f793-9aa3-4fb8-84f0-68a2ab920d5a"],
    teacher_ids: ["7288b989-0694-4883-8157-ce8c7b3b0889", "c3e1fa0a-781b-4dcb-b0f3-de8f1e7e1c08"],
    time_zone_offset: -21600,
    title: "Study Class",
};

export default function () {
    const payload = JSON.stringify(studyClassPayload);
    const res = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, payload, params);

    check(res, {
        'CREATE STUDY CLASS status is 200': () => res.status === 200,
        'CREATE STUDY CLASS returned class ID': (r) => JSON.parse(r.body as string).data?.id ?? false,
    });

    return JSON.parse(res.body as string).data?.id;
}
