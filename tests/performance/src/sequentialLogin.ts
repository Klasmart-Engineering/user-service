import userOrgAdminLogin from './scripts/userOrgAdminLogin';
import userSchoolAdminLogin from './scripts/userSchoolAdminLogin';
import userTeacherLogin from './scripts/userTeacherLogin';
import userStudentLogin from './scripts/userStudentLogin';
import userParentLogin from './scripts/userParentLogin';
import { sleep } from 'k6';
import { Options } from 'k6/options';

export const options: Options = {
    scenarios: {
        orgAdmin: {
            executor: 'per-vu-iterations',
            exec: 'sequentialLogin',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '3m',
        },
    }
}

export function sequentialLogin() {
    userOrgAdminLogin();
    sleep(3);
    userSchoolAdminLogin();
    sleep(3);
    userTeacherLogin();
    sleep(3);
    userStudentLogin();
    sleep(3);
    userParentLogin();
}
