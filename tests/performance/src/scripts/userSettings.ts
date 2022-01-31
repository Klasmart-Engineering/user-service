import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function () {
    const path = `user_settings?org_id=${process.env.ORG_ID}`;
    const res = http.get(`${process.env.CMS_URL}/v1/${path}`, params);

    check(res, {
        'USER_SETTINGs status is 200': () => res.status === 200,
        'USER_SETTINGS returned valid data': (r) => JSON.parse(r.body as string).cms_page_size !== undefined,
    });
}
