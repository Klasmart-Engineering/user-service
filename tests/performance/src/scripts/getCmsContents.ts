
import { check } from 'k6';
import http from 'k6/http';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};


export default function (roleType?: string) {
    const res = http.get(`${process.env.CMS_PLAN_CONTENTS_URL}/61e5ba1d149efab04a01288d?org_id=${process.env.ORG_ID}` as string, params)
    
    check(res, {
        'GET Contents - status is 200': () => res.status === 200,
        '"GET Contents" query returns data': (r) => JSON.parse(r.body as string).id !== undefined,
    }, {
        userRoleType: roleType
    });
}
