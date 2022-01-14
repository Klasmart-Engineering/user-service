import { check } from 'k6';
import http from 'k6/http';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const res = http.get(`${process.env.CMS_ORGANIZATIONS_PROPERTYS_URL}/${process.env.ORG_ID}?org_id=${process.env.ORG_ID}` as string, params)
    
    check(res, {
        'ORGANIZATIONS_PROPERTYS on Content Library - status is 200': () => res.status === 200,
    }, {
        userRoleType: roleType
    });
}
