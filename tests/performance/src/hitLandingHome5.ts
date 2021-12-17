import { sleep } from 'k6';
import { Options } from 'k6/options';
import userOrgAdminLogin5 from './scripts/userOrgAdminLogin5';

/*

Script that evaluates the endPoint:
https://cms.loadtest.kidsloop.live/v1/schedules_time_view/list
   {
    "view_type": "full_view",
    "page": 1,
    "page_size": 20,
    "time_at": 0,
    "start_at_ge": 1639623600,
    "end_at_le": 1640919540,
    "time_zone_offset": -10800,
    "order_by": "start_at",
    "time_boundary": "union"
    }
*/

export const options: Options = {
    vus: 1,
    duration: '1m',
};

export default function() {
    userOrgAdminLogin5();
    sleep(1);
   
}