import userOrgAdminLogin from './scripts/userOrgAdminLogin';
import userSchoolAdminLogin from './scripts/userSchoolAdminLogin';
import userTeacherLogin from './scripts/userTeacherLogin';
import userStudentLogin from './scripts/userStudentLogin';
import userParentLogin from './scripts/userParentLogin';
import { Options } from 'k6/options';

export const options: Options = {
    scenarios: {
        orgAdmin: {
            executor: 'per-vu-iterations',
            exec: 'userOrgAdminLogin',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '4m',
        },
        schoolAdmin: {
            executor: 'per-vu-iterations',
            exec: 'userSchoolAdminLogin',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '4m',
        },
        teacher: {
            executor: 'per-vu-iterations',
            exec: 'userTeacherLogin',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '4m',
        },
        student: {
            executor: 'per-vu-iterations',
            exec: 'userStudentLogin',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '4m',
        },
        parent: {
            executor: 'per-vu-iterations',
            exec: 'userParentLogin',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '4m',
        },
    }
}

export {
    userOrgAdminLogin,
    userSchoolAdminLogin,
    userTeacherLogin,
    userStudentLogin,
    userParentLogin
}