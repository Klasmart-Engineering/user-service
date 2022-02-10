import http from 'k6/http';
import { Options } from 'k6/options';
//import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';
import endPointHomeRequest1 from "./scripts/endPointHomeRequest1";
import loginSetup from './utils/loginSetup';

/*

Script that evaluates the endPoint:
https://api.loadtest.kidsloop.live/user/
    {
        "operationName": "me",
        "variables": {},

    }
*/

// command: k6 run -e VUS=1 -e DURATION=1m testEndPointLandingHome1.js
// For increase the VUS -> change the value of the variable: VUS
// For increase the duration -> change the value of the variable: DURATION


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
    
    //endPointHomeRequest1('Org admin');
    endPointHomeRequest1();
}