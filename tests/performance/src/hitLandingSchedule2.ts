import http from 'k6/http';
import { Options } from 'k6/options';
import scheduleFilterProgram from './scripts/scheduleFilterProgram';
import loginSetup from './utils/loginSetup';

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
    
    scheduleFilterProgram('Org admin');
}