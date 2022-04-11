import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const payloadTemp = {
    age: [],
    content_type: 1,
    created_at: 0,
    data: "{\"source\":\"61d8877e96b6060013aa1019\",\"input_source\":1}",
    description: "",
    developmental: ["49cbbf19-2ad7-4acb-b8c8-66531578116a"],
    draw_activity: false,
    grade: [],
    keywords: [],
    lesson_type: "2",
    name: "Load Script Lesson Material",
    outcomes: [],
    parent_folder: "",
    program: "b39edb9a-ab91-4245-94a4-eb2b5007c033",
    publish_scope: ["7b11aaae-8e8b-4370-b8a7-6bb069088967", "d634a0c2-6376-4151-aa84-3be9417ad7dc"],
    self_study: false,
    skills: ["9b955fb9-8eda-4469-bd31-4e8f91192663"],
    source_type: "",
    subject: ["66a453b0-d38f-472e-b055-7a94a94d66c4"],
    suggest_time: 10,
    thumbnail: "",
}

export default function () {
    const payload = JSON.stringify(payloadTemp);
    const res = http.post(`${process.env.CMS_URL}/v1/contents?org_id=${process.env.ORG_ID}`, payload, params);
    
    console.log(JSON.stringify(res));

    check(res, {
        'CREATE LESSON MATERIAL status is 200': () => res.status === 200,
        'CREATE LESSON MATERIAl returned data': (r) => JSON.parse(r.body as string).id ?? false,
    });
}
