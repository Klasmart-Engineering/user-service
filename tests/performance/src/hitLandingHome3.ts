import { sleep } from 'k6';
import { Options } from 'k6/options';
import userOrgAdminLogin3 from './scripts/userOrgAdminLogin3';

/*

Script that evaluates the endPoint:
https://kl2.loadtest.kidsloop.live/v1/assessments_summary?org_id=360b46fe-3579-42d4-9a39-dc48726d033f

*/

export const options: Options = {
    vus: 1,
    duration: '1m',
};

export default function() {
    userOrgAdminLogin3();
    sleep(1);
   
}