import http from 'k6/http';
import { Options } from 'k6/options';
import loginSetup from './utils/loginSetup';
import endPointHomeRequest6 from './scripts/endPointHomeRequest6';

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
    
    endPointHomeRequest6('Org admin');
}