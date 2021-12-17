import { sleep } from 'k6';
import { Options } from 'k6/options';
import userOrgAdminLogin7 from './scripts/userOrgAdminLogin7';

/*

Script that evaluates the endPoint:
https://cms.loadtest.kidsloop.live/v1/contents_folders
   Params:
    content_type: 2
    order_by: -create_at
    org_id: 360b46fe-3579-42d4-9a39-dc48726d033f
    page: 1
    page_size: 100
    path: 
    publish_status:
*/

export const options: Options = {
    vus: 1,
    duration: '1m',
};

export default function() {
    userOrgAdminLogin7();
    sleep(1);
   
}