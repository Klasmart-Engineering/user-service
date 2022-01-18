import { check } from 'k6';
import http from 'k6/http';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const res = http.get(`${process.env.CMS_PLAN_VISIBILITY_SETTING_URL}?content_type=2&org_id=${process.env.ORG_ID}` as string, params)
    
    check(res, {
        'GET CMS Visibility Setting on Content Library - status is 200': () => res.status === 200,
        '"GET CMS Visibility Setting" query returns data': (r) => JSON.parse(r.body as string).id !== undefined,
    }, {
        userRoleType: roleType
    });
}
