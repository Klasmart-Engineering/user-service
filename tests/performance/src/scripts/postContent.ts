import { check } from 'k6';
import http from 'k6/http';
import { UserPayload } from '../interfaces/users';
import { getPaginatedOrganizationUsers } from '../queries/users';
import { Filter } from '../interfaces/filters';
import { getProgramsAndSubjects } from '../queries/cms';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};


const payloadTemp = {
    name: "Test 2 January 17",
    thumbnail: "",
    suggest_time: 0,
    publish_scope: ["360b46fe-3579-42d4-9a39-dc48726d033f"],
    self_study: false,
    description: "",
    keywords: [],
    teacher_manual_batch: [],
    data: "{}",
    program: "b39edb9a-ab91-4245-94a4-eb2b5007c033",
    subject: ["66a453b0-d38f-472e-b055-7a94a94d66c4"],
    age: [],
    grade: [],
    developmental: ["49cbbf19-2ad7-4acb-b8c8-66531578116a"],
    skills: [],
    parent_folder: "",
    content_type: 2,
    outcomes: [],
    created_at: 0
}

export default function (){
    const payload = JSON.stringify(payloadTemp);

    const res = http.post(`${process.env.CMS_PLAN_CONTENTS_URL}?org_id=${process.env.ORG_ID}` as string, payload, params);


    check(res, {
        '"POST Content" status is 200': () => res.status === 200,
        '"POST Content" query returns data': (r) => JSON.parse(r.body as string).id !== undefined,
    });

}
