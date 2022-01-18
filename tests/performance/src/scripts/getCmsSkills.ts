
import { check } from 'k6';
import http from 'k6/http';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const res = http.get(`${process.env.CMS_DEVELOPMENTALS_URL}?program_id=b39edb9a-ab91-4245-94a4-eb2b5007c033&developmental_id=49cbbf19-2ad7-4acb-b8c8-66531578116a&org_id=${process.env.ORG_ID}` as string, params)
    
    check(res, {
        'GET CMS Skills Setting on Content Library - status is 200': () => res.status === 200,
        '"GET CMS Skills Setting" query returns data': (r) => JSON.parse(r.body as string).id !== undefined,
    }, {
        userRoleType: roleType
    });
}
