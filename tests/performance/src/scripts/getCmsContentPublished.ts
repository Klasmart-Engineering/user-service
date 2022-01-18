import { check } from 'k6';
import http from 'k6/http';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const res = http.get(`${process.env.CMS_PLAN_CONTENTS_URL}?publish_status=published&page_size=10&content_type=1&name=&org_id=${process.env.ORG_ID}` as string, params)

    check(res, {
        'GET CMS Content Published on Content Library - status is 200': () => res.status === 200,
        '"GET CMS Content Published" query returns data': (r) => JSON.parse(r.body as string).total !== undefined,
    }, {
        userRoleType: roleType
    });
}
