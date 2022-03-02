import { Options } from "k6/options";
// import loginSetup from "./utils/loginSetup";
import { loginSetupV2 as loginSetup } from './utils/loginSetupV2';
import getUsers from "./scripts/getOrganizationUsers";
import { sleep } from "k6";
import generateStages from './utils/generateStages';
import http from "k6/http";

// This script simulates Teacher landing on the User section and execute Filter/Pagination/Search

// Command:
// k6 -e VUS=50 run getPaginatedUsersMixedNewConfigUniqueSt.js
// to run the script be positioned in the folder ¨dist¨

// const prefixLimit: number = !isNaN(parseInt(__ENV.PREFIX_LIMIT, 10)) ? parseInt(__ENV.PREFIX_LIMIT) : 9;
const prefixLimit = 1000;

export const options: Options = {
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },
   /*  thresholds: {
        http_req_failed: [{ threshold: 'rate<0.40', abortOnFail: true }],
        http_req_duration: [{ threshold: 'p(95)<5000', abortOnFail: true }],
    }, */
    scenarios: {
        teacher01: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'teacher01',
        },
       
    },
    setupTimeout: '5m',
};

export function teacher01() {
    const prefix = __VU + 15000;
    const teacherLoginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: `${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`,
        pw: process.env.B2C_PASSWORD as string,
    };
    const teacherLoginData = loginSetup(teacherLoginPayload);
    console.log(`Logged in student: ${process.env.B2C_USERNAME}${prefix}@${process.env.B2C_DOMAIN}`);

    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', teacherLoginData.res.cookies?.access[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', teacherLoginData.res.cookies?.refresh[0].value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    getUsers({ count: 10, search: 'student' }, teacherLoginData, [{ organizationUserStatus: {
        operator: 'eq',
        value: 'active',
    }}]);

    /* sleep(2);

    getUsers({ count: 50, search: 'student' }, teacherLoginData, [{ organizationUserStatus: {
        operator: 'eq',
        value: 'active',
    }}]); */
    
}

 
/* export function setup() {
    let i = 0;
    const l = 9;
    let data = {};

    for (i; i <= l; i++) {
        const prefix = ('0' + i).slice(-2);
        const teacherLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.TEACHER_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW as string,
        };
        
        const teacherLoginData = loginSetup(teacherLoginPayload);
        data = { 
            ...data, 
            [`teacher${prefix}`]: teacherLoginData,
        };
    }

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


export function teacher00(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher00, [{ organizationUserStatus: {
        operator: 'eq',
        value: 'active',
    }}]);

    sleep(5);

    getUsers({ count: 50, search: 'student' }, data.teacher00, [{ organizationUserStatus: {
        operator: 'eq',
        value: 'active',
    }}]);
}

export function teacher01(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher01, [{ organizationUserStatus: {
        operator: 'eq',
        value: 'inactive',
    }}]);
}

export function teacher02(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher02, [{ roleId: {
        operator: 'eq',
        value: process.env.ROLE_ID_STUDENT as string,
    }}]);
}

export function teacher03(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher03, [{ roleId: {
        operator: 'eq',
        value: process.env.ROLE_ID_STUDENT as string,
    }}]);
}

export function teacher04(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher04, [
        { 
            roleId: {
                operator: 'eq',
                value: process.env.ROLE_ID_STUDENT as string,
            },
            email: {
                operator: "contains", 
                value: "parralel"
            }
        }
    ]);
}

export function teacher05(data: { [key: string]: { res: any, userId: string }}) {
   let pageInfo = getUsers({ count: 10, search: 'student'  }, data.teacher05, [{email: {operator: "contains", value: "edgardo"}}]);

   while (pageInfo?.hasNextPage) {
        sleep(2);
        pageInfo = getUsers({ count: 10, search: 'parralel'  }, data.teacher05, [{email: {operator: "contains", value: "edgardo"}}], pageInfo.endCursor);
    }
}

export function teacher06(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher06, [{schoolId: {operator: "eq", value: "7b11aaae-8e8b-4370-b8a7-6bb069088967"}}]);
 }

 export function teacher07(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'parralel' }, data.teacher07, [
        { 
            roleId: {
                operator: 'eq',
                value: process.env.ROLE_ID_STUDENT as string,
            },
            email: {
                operator: "contains", 
                value: "edgardo"
            }
        }
    ]);
}

 export function teacher08(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher08, [
        { 
            roleId: {
                operator: 'eq',
                value: process.env.ROLE_ID_STUDENT as string,
            },
            email: {
                operator: "contains", 
                value: "edgardo"
            }
        }
    ]); 
}
*/

/* export function teacher09(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'student' }, data.teacher09, [
        { 
            roleId: {
                operator: 'eq',
                value: process.env.ROLE_ID_STUDENT as string,
            },
            email: {
                operator: "contains", 
                value: "edgardo"
            }
        }
    ]);
} */ 

/* export function orgAdmin(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'parralel' }, data.orgAdmin, [{ roleId: {
        operator: 'eq',
        value: process.env.ROLE_ID_STUDENT as string,
    }}]);
} */