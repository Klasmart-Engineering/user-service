import http from 'k6/http';
import { Options } from 'k6/options';
import loginSetup from './utils/loginSetup';
import hitHomeRequest5 from './scripts/hitHomeRequest5';
import testLogin from './scripts/testLogin';
import switchUser from './scripts/switchUser';
import { sleep } from 'k6';

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

export function setup() {
    let data = {};
    const orgAdminLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_ORG_ADMIN_1 as string,
        pw: process.env.PW_ORG_ADMIN_1 as string,
    };
    
    const orgAdminLoginData = loginSetup(orgAdminLoginPayload);
    data = { 
        ...data, 
        [`orgAdmin`]: orgAdminLoginData,
    };    

    return data;
}

export default function(data: { [key: string]: { res: any, userId: string }}) {
    
    const jar = http.cookieJar();
    jar.set(process.env.SERVICE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value);
    jar.set(process.env.SERVICE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value);

    jar.set(process.env.LIVE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value);
    jar.set(process.env.LIVE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value);
    
    testLogin();
    sleep(2);
    switchUser();
    sleep(2)
    hitHomeRequest5('Org admin');
}