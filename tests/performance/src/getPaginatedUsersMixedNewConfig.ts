import { Options } from "k6/options";
import loginSetup from "./utils/loginSetup";
import getUsers from "./scripts/getOrganizationUsers";
import { sleep } from "k6";
import generateStages from './utils/generateStages';

// command to run the script
// k6 run -e STAGE_QTY=1 ./dist/getPaginatedUsersMixedNewConfig.js
// k6 run -e STAGE_QTY=1 getPaginatedUsersMixedNewConfig.js  > located in the dist folder

const stages: number = !isNaN(parseInt(__ENV.STAGE_QTY, 10)) ? parseInt(__ENV.STAGE_QTY) : 2;
// const prefixLimit: number = !isNaN(parseInt(__ENV.PREFIX_LIMIT, 10)) ? parseInt(__ENV.PREFIX_LIMIT) : 9;

export const options: Options = {
    scenarios: {
        teacher00: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher01: {
            executor: 'ramping-vus',
            exec: 'teacher01',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher02: {
            executor: 'ramping-vus',
            exec: 'teacher02',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher03: {
            executor: 'ramping-vus',
            exec: 'teacher03',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher04: {
            executor: 'ramping-vus',
            exec: 'teacher04',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher05: {
            executor: 'ramping-vus',
            exec: 'teacher05',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher06: {
            executor: 'ramping-vus',
            exec: 'teacher06',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher07: {
            executor: 'ramping-vus',
            exec: 'teacher07',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher08: {
            executor: 'ramping-vus',
            exec: 'teacher08',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        teacher09: {
            executor: 'ramping-vus',
            exec: 'teacher09',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
        orgAdmin: {
            executor: 'ramping-vus',
            exec: 'orgAdmin',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stages),
        },
    
    }
}
 
export function setup() {
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

export function teacher09(data: { [key: string]: { res: any, userId: string }}) {
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
} 

export function orgAdmin(data: { [key: string]: { res: any, userId: string }}) {
    getUsers({ count: 10, search: 'parralel' }, data.orgAdmin, [{ roleId: {
        operator: 'eq',
        value: process.env.ROLE_ID_STUDENT as string,
    }}]);
}