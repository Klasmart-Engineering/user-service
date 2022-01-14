import { check } from 'k6';
import http from 'k6/http';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const res = http.get(`${process.env.CMS_USER_SETTING_URL}?org_id=${process.env.ORG_ID}` as string, params);

    check(res, {
        'USER_SETTING on Content Library - status is 200': () => res.status === 200,
    }, {
        userRoleType: roleType
    });
}
