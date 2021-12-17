import { sleep } from 'k6';
import { Options } from 'k6/options';
import userOrgAdminToSchedule2 from './scripts/userOrgAdminToSchedule2';

/*

Script that evaluates the endPoint:
https://cms.loadtest.kidsloop.live/v1/schedules_filter/programs
   Params:
    ?org_id=360b46fe-3579-42d4-9a39-dc48726d033f
    
*/

export const options: Options = {
    vus: 1,
    duration: '1m',
};

export default function() {
    userOrgAdminToSchedule2();
    sleep(1);
   
}