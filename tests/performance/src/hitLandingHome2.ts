import { sleep } from 'k6';
import { Options } from 'k6/options';
import userOrgAdminLogin2 from './scripts/userOrgAdminLogin2';

/*

Script that evaluates the endPoint:
https://api.loadtest.kidsloop.live/user/
   {
    "operationName": "myUser",
    "variables": {},
}
*/

export const options: Options = {
    vus: 1,
    duration: '1m',
};

export default function() {
    userOrgAdminLogin2();
    sleep(1);
   
}