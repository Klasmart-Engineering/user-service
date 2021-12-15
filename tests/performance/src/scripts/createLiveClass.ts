// https://kl2.loadtest.kidsloop.live/v1/schedules?org_id=c611ece6-cd8c-4bcc-8975-fa0a8163ee7b

import generateClassPayload from "../utils/generateClassPayload";
import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const payload = JSON.stringify(generateClassPayload());

    const res = http.post(`${process.env.SCHEDULES_URL}?org_id=${process.env.ORG_ID}`, payload, params);

    console.log(JSON.stringify(res));

    check(res, {
        'CREATE LIVE CLASS status is 200': () => res.status === 200,
        'CREATE LIVE CLASS returned class ID': (r) => JSON.parse(r.body as string).data?.id ?? false,
    });
}
