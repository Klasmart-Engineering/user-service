import { sleep } from 'k6';
import { Options } from 'k6/options';
import userOrgAdminLogin4 from './scripts/userOrgAdminLogin4';

/*

Script that evaluates the endPoint:
https://kl2.loadtest.kidsloop.live/v1/schedules_time_view?end_at_le=1640746740&org_id=360b46fe-3579-42d4-9a39-dc48726d033f&start_at_ge=1639450800&time_zone_offset=-10800&view_type=full_view

*/

export const options: Options = {
    vus: 1,
    duration: '1m',
};

export default function() {
    userOrgAdminLogin4();
    sleep(1);
   
}