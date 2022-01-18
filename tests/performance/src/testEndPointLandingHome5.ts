import http from 'k6/http';
import { Options } from 'k6/options';
import loginSetup from './utils/loginSetup';
import endPointHomeRequest5 from './scripts/endPointHomeRequest5';


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
    vus: __ENV.VUS ? parseInt(__ENV.VUS, 10) : 1,
    duration: __ENV.DURATION ?? '1m',
};

export function setup() {
    let data = {};
    const orgAdminLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_ORG_ADMIN_1 as string,
        pw: process.env.PW as string,
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
    jar.set(process.env.COOKIE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    endPointHomeRequest5('Org admin');
}