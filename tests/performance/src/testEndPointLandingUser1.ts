import http from 'k6/http';
import { Options } from 'k6/options';
import loginSetup from './utils/loginSetup';
import getSchoolsOnUserSection1 from './scripts/getSchoolsOnUserSection1';

/*

Script that evaluates the endPoint:
https://api.loadtest.kidsloop.live/user/
    {
        "operationName": "getOrganizationSchools",
        "variables": {
        {
            "direction": "FORWARD",
            "count": 50,
            "order": "ASC",
            "orderBy": "name",
            "filter": {
                "status": {
                    "operator": "eq",
                    "value": "active"
                },
                "organizationId": {
                    "operator": "eq",
                    "value": "360b46fe-3579-42d4-9a39-dc48726d033f"
                },
                "AND": [
                    {
                        "OR": [
                            {
                                "name": {
                                    "operator": "contains",
                                    "value": "",
                                    "caseInsensitive": true
                                }
                            },
                            {
                                "shortCode": {
                                    "operator": "contains",
                                    "value": "",
                                    "caseInsensitive": true
                                }
                            }
                        ]
                    }
                ]
            }
        }

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
    jar.set(process.env.COOKIE_URL as string, 'access', data.orgAdmin.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.orgAdmin.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    getSchoolsOnUserSection1("Org admin");
}