import { Options } from 'k6/options';

const generateStages = (stageAmount: number) => {
    let i = 0;
    const stages = [];

    for (i; i < stageAmount; i++) {
        stages.push({
            duration: '30s',
            target: (i + 1) * 5,
        });
    }

    return stages;
}


export const config = (stages: number): Options => ({
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
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        student01: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
        student02: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages:  generateStages(stages),
        },
    }
});