import { Options } from 'k6/options';
import generateStages from '../utils/generateStages';

export const config = (stages: number): Options => ({
    ext: {
        loadimpact: {
            // projectID: 3560234,
            projectID: 3559532,
        }
    },
    thresholds: {
        http_req_failed: [{ threshold: 'rate<0.40', abortOnFail: true }],
        http_req_duration: [{ threshold: 'p(95)<5000', abortOnFail: true }],
    },
    scenarios: {
        teacher: {
            executor: 'ramping-vus',
            exec: 'teacher',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        student: {
            executor: 'ramping-vus',
            exec: 'student',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
    }
});