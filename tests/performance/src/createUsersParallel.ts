import createUsersParallel from './scripts/createUsersParallel';
import { Options } from 'k6/options';
import { sleep } from 'k6';
import switchUser from './scripts/switchUser';
import testLogin from './scripts/testLogin';

export const options: Options = {
    scenarios: {
        orgAdmin1: {
            executor: 'per-vu-iterations',
            exec: 'createUsersAdmin1',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '5m',
        },
        orgAdmin2: {
            executor: 'per-vu-iterations',
            exec: 'createUsersAdmin2',
            startTime: '0s',
            gracefulStop: '5s',
            vus: 1,
            iterations: 1,
            maxDuration: '5m',
        },
    }
}

export function createUsersAdmin1() {
    testLogin();
    sleep(0.5);
    switchUser();
    sleep(0.5);
    createUsersParallel(0, 9);
}

export function createUsersAdmin2() {
    testLogin({
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_ORG_ADMIN_2 as string,
        pw: process.env.PW as string,
    });
    sleep(0.5);
    switchUser();
    sleep(0.5);
    createUsersParallel(30, 35);
}
