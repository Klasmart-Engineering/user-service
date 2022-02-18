import { Options } from 'k6/options';
import generateStages from '../utils/generateStages';

export const config = (stages: number): Options => ({
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },
    thresholds: {
        http_req_failed: [{ threshold: 'rate<0.40', abortOnFail: true }],
        http_req_duration: [{ threshold: 'p(95)<5000', abortOnFail: true }],
    },
    scenarios: {
        teacher01: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        teacher02: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher10: {
            executor: 'ramping-vus',
            exec: 'teacher10',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        student1: {
            executor: 'ramping-vus',
            exec: 'students1',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        student02: {
            executor: 'ramping-vus',
            exec: 'students02',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        student03: {
            executor: 'ramping-vus',
            exec: 'students03',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        student04: {
            executor: 'ramping-vus',
            exec: 'students04',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        student05: {
            executor: 'ramping-vus',
            exec: 'students05',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        student10: {
            executor: 'ramping-vus',
            exec: 'students10',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
    }
});