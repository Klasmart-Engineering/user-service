import testLogin from './testLogin';
import testCreateSingleUser from './createSingleUser';
import switchUser from './switchUser';
import { sleep } from 'k6';
import { Options } from 'k6/options';

export const options: Options = {
    scenarios: {
        myUsers: {
            executor: 'shared-iterations',
            exec: 'main',
            startTime: '0s',
            gracefulStop: '10s',
            vus: 1,
            iterations: 1,
            maxDuration: '60s',
        },
    }
}

export function main() {
    testLogin();
    sleep(5);
    switchUser();
    sleep(5);
    testCreateSingleUser();
}
