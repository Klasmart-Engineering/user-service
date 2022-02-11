import { check } from 'k6';
import http from 'k6/http';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

export default function (roleType?: string) {

    const res = http.get(`${process.env.ASSESSMENT_STUDENT_URL}?complete_at_ge=1643287874&complete_at_le=1644497474&order_by=-complete_at&org_id=${process.env.ORG_ID}&page=1&page_size=5&type=home_fun_study` as string, params);

    check(res, {
        'status is 200 HOME-ASSESSMENT FOR STUDENT': () => res.status === 200,

    }, {
        userRoleType: roleType
    });
}
