import generateStudyPayload from "../utils/generateStudyPayload";
import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const payload = JSON.stringify(generateStudyPayload());
    const res = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, payload, params);

    console.log('res === ', payload);

    check(res, {
        'CREATE LIVE CLASS status is 200': () => res.status === 200,
        'CREATE LIVE CLASS returned class ID': (r) => JSON.parse(r.body as string).data?.id ?? false,
    });
}
