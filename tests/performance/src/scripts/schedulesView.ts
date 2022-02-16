import { check } from 'k6';
import http from 'k6/http';


const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {
   
    const res = http.get(`${process.env.CMS_SCHEDULE_VIEW_URL}/61fbe718b1fef1a5304d89f4?org_id=${process.env.ORG_ID}` as string);

    check(res, {
        'SCHEDULES_VIEW_FOR_STUDY - status is 200': () => res.status === 200,
        'SCHEDULES_VIEW_FOR_STUDY returns data': (r) => JSON.parse(r.body as string).data === "61fbe718b1fef1a5304d89f4",
    }, {
        userRoleType: roleType
    });
}
