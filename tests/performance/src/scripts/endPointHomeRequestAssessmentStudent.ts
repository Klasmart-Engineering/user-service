import { check } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const params = {
    headers: {
        'Content-Type': `application/json`,
    },
};

const counter = new Counter('endPointHomeRequestAssessmentStudent');
const serverWaitingTime = new Trend('endPointHomeRequestAssessmentStudentWaiting', true);
const errorCounter400 = new Counter('endPointHomeRequestAssessmentStudentError400');
const errorCounter500 = new Counter('endPointHomeRequestAssessmentStudentError500');

export default function (roleType?: string) {

    const res = http.get(`${process.env.ASSESSMENT_STUDENT_URL}?complete_at_ge=1643287874&complete_at_le=1644497474&order_by=-complete_at&org_id=${process.env.ORG_ID}&page=1&page_size=5&type=home_fun_study` as string, params);

    check(res, {
        'status is 200 HOME-ASSESSMENT FOR STUDENT': () => res.status === 200,

    }, {
        userRoleType: roleType
    });

    /* if (res.status === 200) {
        counter.add(1);
        serverWaitingTime.add(res.timings.waiting);
    } */

    if (res.status >= 200 && res.status <= 299) {
        counter.add(1);
        
    } else if (res.status >= 400 && res.status <= 499) {
        errorCounter400.add(1);
    } else {
        errorCounter500.add(1);
    }

    serverWaitingTime.add(res.timings.waiting);
}
