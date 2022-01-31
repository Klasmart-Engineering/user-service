import { check } from "k6";
import http from "k6/http";

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const lessonPlanPayload = {
    age: [],
    content_type: 2,
    created_at: 0,
    data: "{}",
    description: "",
    developmental: [process.env.LESSON_DEVELOPMENTAL_ID],
    grade: [],
    keywords: [],
    name: "Test Payload",
    outcomes: [],
    parent_folder: "",
    program: process.env.LESSON_PROGRAM_ID,
    publish_scope: [process.env.LESSON_PUBLISH_SCOPE_ID],
    self_study: false,
    skills: [],
    subject: [process.env.LESSON_SUBJECT_ID],
    suggest_time: 5,
    teacher_manual_batch: [],
    thumbnail: "",
};

export default function () {
    const payload = JSON.stringify(lessonPlanPayload);
    const res = http.post(`${process.env.CMS_URL}/v1/contents?org_id=${process.env.ORG_ID}`, payload, params);
    
    check(res, {
        'CREATE LESSON PLAN status is 200': () => res.status === 200,
        'CREATE LESSON PLAN returned class ID': (r) => JSON.parse(r.body as string).id ?? false,
    });
}
