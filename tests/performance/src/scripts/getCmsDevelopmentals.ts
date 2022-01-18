
import { check } from 'k6';
import http from 'k6/http';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
    const res = http.get(`${process.env.CMS_DEVELOPMENTALS_URL}?program_id=b39edb9a-ab91-4245-94a4-eb2b5007c033&subject_ids=66a453b0-d38f-472e-b055-7a94a94d66c4&org_id=${process.env.ORG_ID}` as string, params)
    
    check(res, {
        'GET CMS Developmentals Setting on Content Library - status is 200': () => res.status === 200,
        '"GET CMS Developmentals Setting" query returns data': (r) => JSON.parse(r.body as string)[0].id !== undefined,
    }, {
        userRoleType: roleType
    });
}
