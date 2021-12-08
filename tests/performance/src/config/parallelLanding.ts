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
        teacher00: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
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
        student00: {
            executor: 'ramping-vus',
            exec: 'students00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        student01: {
            executor: 'ramping-vus',
            exec: 'students01',
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
    }
});