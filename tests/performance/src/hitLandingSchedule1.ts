import { sleep } from 'k6';
import { Options } from 'k6/options';
import userOrgAdminToSchedule1 from './scripts/userOrgAdminToSchedule1';

/*

Script that evaluates the endPoint:
https://cms.loadtest.kidsloop.live/v1/schedules_time_view/list
   Params:
    ?org_id=360b46fe-3579-42d4-9a39-dc48726d033f
    
    Payload:
        {
        "view_type": "month",
        "time_at": 1637707512,
        "time_zone_offset": -10800,
        "class_types": [],
        "class_ids": [],
        "subject_ids": [],
        "program_ids": [],
        "user_id": []
        }

*/

export const options: Options = {
    vus: 1,
    duration: '1m',
};

export default function() {
    userOrgAdminToSchedule1();
    sleep(1);
   
}