import { Options } from 'k6/options';
import generateStages from '../utils/generateStages';

export const config = (stages: number): Options => ({
    ext: {
        loadimpact: {
            // projectID: 3560234,
            projectID: 3571085,
        }
    },
    thresholds: {
        http_req_failed: [{ threshold: 'rate<0.40', abortOnFail: true }],
        http_req_duration: [{ threshold: 'p(95)<10000', abortOnFail: true }],
    },
    scenarios: {
        teacher: {
            executor: 'ramping-vus',
            exec: 'userTeacherLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        student: {
            executor: 'ramping-vus',
            exec: 'userStudentLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        schoolAdmin: {
            executor: 'ramping-vus',
            exec: 'userSchoolAdminLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        parent: {
            executor: 'ramping-vus',
            exec: 'userParentLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        ordAdmin: {
            executor: 'ramping-vus',
            exec: 'userOrgAdminLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        teacher1: {
            executor: 'ramping-vus',
            exec: 'userTeacherLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        student1: {
            executor: 'ramping-vus',
            exec: 'userStudentLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        schoolAdmin1: {
            executor: 'ramping-vus',
            exec: 'userSchoolAdminLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        parent1: {
            executor: 'ramping-vus',
            exec: 'userParentLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        ordAdmin1: {
            executor: 'ramping-vus',
            exec: 'userOrgAdminLogin',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
    }
});