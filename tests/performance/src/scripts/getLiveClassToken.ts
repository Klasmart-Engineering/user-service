import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (classId: string) {
    const path = `schedules/${classId}/live/token?live_token_type=live&org_id=${process.env.ORG_ID}`;
    const res = http.get(`${process.env.CMS_URL}/v1/${path}` as string, params);

    check(res, {
        '"Get Live Class Token" status is 200': () => res.status === 200,
        '"Get Live Class Token" query returns data': (r) => JSON.parse(r.body as string).token !== undefined,
    });

    return JSON.parse(res?.body as string).token;
}
