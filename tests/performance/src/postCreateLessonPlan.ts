import landingV2 from './scripts/landingV2';
import loginSetup from './utils/loginSetup';
import { sleep } from 'k6';
import http, { put } from 'k6/http';
import getCmsVisibilitySetting from './scripts/getCmsVisibilitySetting';
import getCmsContentPublished from './scripts/getCmsContentPublished';
import getCmsProgramAndSubjects from './scripts/getCmsProgramAndSubjects';
import getCmsMemership from './scripts/getCmsMemership';
import getCmsDevelopmentals from './scripts/getCmsDevelopmentals';
import getCmsSkills from './scripts/getCmsSkills';
import postContent from './scripts/postContent';
import getCmsContents from './scripts/getCmsContents';
import putContent from './scripts/putContent';

import generateStages from './utils/generateStages';
import contentLibraryUserSetting from './scripts/contentLibraryUserSetting';
import contentLibraryOrgPropertys from './scripts/contentLibraryOrgPropertys';
import endPointCmsRequest1Published from './scripts/endPointCmsRequest1Published';


// command to run the script
// k6 run -e STAGE_QTY=1 ./dist/postCreateLessonPlan.js
// k6 run -e STAGE_QTY=1 postCreateLessonPlan.js  > located in the dist folder

const stageQty: number = !isNaN(parseInt(__ENV.STAGE_QTY, 10)) ? parseInt(__ENV.STAGE_QTY) : 2;
const prefixLimit: number = !isNaN(parseInt(__ENV.PREFIX_LIMIT, 10)) ? parseInt(__ENV.PREFIX_LIMIT) : 9;

export const options = {
    scenarios: {    
        /*teacher00: {
            executor: 'ramping-vus',
            exec: 'teacher00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
      /*   teacher01: {
            executor: 'ramping-vus',
            exec: 'teacher01',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        teacher02: {
            executor: 'ramping-vus',
            exec: 'teacher02',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        teacher03: {
            executor: 'ramping-vus',
            exec: 'teacher03',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        teacher04: {
            executor: 'ramping-vus',
            exec: 'teacher04',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        teacher05: {
            executor: 'ramping-vus',
            exec: 'teacher05',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        teacher06: {
            executor: 'ramping-vus',
            exec: 'teacher06',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        teacher07: {
            executor: 'ramping-vus',
            exec: 'teacher07',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        teacher08: {
            executor: 'ramping-vus',
            exec: 'teacher08',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        */
        schooladm00: {
            executor: 'ramping-vus',
            exec: 'schooladm00',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        /*
        schooladm01: {
            executor: 'ramping-vus',
            exec: 'schooladm01',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        schooladm02: {
            executor: 'ramping-vus',
            exec: 'schooladm02',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        schooladm03: {
            executor: 'ramping-vus',
            exec: 'schooladm03',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        schooladm04: {
            executor: 'ramping-vus',
            exec: 'schooladm04',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        },
        schooladm05: {
            executor: 'ramping-vus',
            exec: 'schooladm05',
            startTime: '0s',
            gracefulStop: '5s',
            stages: generateStages(stageQty),
        }, */
    }
}

export function setup() {
    let i = 0;
    const l = prefixLimit <= 9 ? prefixLimit : 9;
    let data = {};

    for (i; i < l; i++) {
        const prefix = ('0' + i).slice(-2);
        const teacherLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.TEACHER_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW_TEACHER_1 as string,
        };
        const schoolLoginPayload = {
            deviceId: "webpage",
            deviceName: "k6",
            email: `${process.env.SCHOOL_USERNAME}${prefix}@${process.env.EMAIL_DOMAIN}`,
            pw: process.env.PW_SCHOOL_ADMIN_1 as string,
            
        };
        const teacherLoginData = loginSetup(teacherLoginPayload);
        const schoolLoginData = loginSetup(schoolLoginPayload);

        data = { 
            ...data, 
            [`teacher${prefix}`]: teacherLoginData,
            [`schooladm${prefix}`]: schoolLoginData
        };
    }

    return data;
}

/*
export function teacher00(data: { [key: string]: { res: any, userId: string }}) { 
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher00.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher00.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.teacher00);
    sleep(5);
    getCmsVisibilitySetting();
    getCmsContentPublished();
    getCmsProgramAndSubjects();
}

/*
export function teacher01(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher01.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher01.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.teacher01);
    sleep(5);
    

}

export function teacher02(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher02.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher02.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.teacher00);
    sleep(5);
  

}

export function teacher03(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher03.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher03.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.teacher03);
    sleep(5);
    
}
export function teacher04(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher04.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher04.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.teacher04);
    sleep(5);
    
}

export function teacher05(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher05.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher05.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.teacher05);
    sleep(5);
    
}
export function teacher06(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher06.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher06.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.teacher06);
    sleep(5);
   
}
export function teacher07(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher07.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher07.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.teacher07);
    sleep(5);
    
}
export function teacher08(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher08.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher08.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.teacher08);
    sleep(5);
    
}
/*
export function teacher09(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.teacher09.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.teacher09.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.teacher00);
    sleep(5);
    endPointHomeRequest1();
    contentLibraryUserSetting();
    contentLibraryOrgPropertys();
    getCmsMemerships();
    getCmsMemerships2();
    endPointCmsRequest1Published();
    // Next functios are called twice
    endPointHomeRequest1();
    //sleep(0.2)
    // endPointCmsRequest2Pending();
}
*/

export function schooladm00(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.schooladm00.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.schooladm00.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.schooladm00);
    sleep(5);
    getCmsVisibilitySetting();
    getCmsContentPublished();
    getCmsProgramAndSubjects();
    getCmsMemership();
    getCmsDevelopmentals();
    getCmsSkills();
    getCmsDevelopmentals();
    getCmsSkills();
    getCmsDevelopmentals();
    getCmsSkills();
    getCmsSkills();
    postContent();
    getCmsContents();
    getCmsVisibilitySetting();
    getCmsContentPublished();
    getCmsDevelopmentals();
    getCmsSkills();
    putContent();
    contentLibraryUserSetting();
    contentLibraryOrgPropertys();
    endPointCmsRequest1Published();
    


    
    
}
/*
export function schooladm01(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.schooladm01.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.schooladm01.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.schooladm01);
    sleep(5);
  
}
export function schooladm02(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.schooladm02.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.schooladm02.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.schooladm02);
    sleep(5);
    
}
export function schooladm03(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.schooladm03.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.schooladm03.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.schooladm03);
    sleep(5);
    ;
}
export function schooladm04(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.schooladm04.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.schooladm04.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.schooladm04);
    sleep(5);
    
}
export function schooladm05(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.schooladm05.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.schooladm05.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.schooladm05);
    sleep(5);
   
}
/*
export function students02(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students02.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students02.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.students02);
    sleep(5);
    landingContentLibrary();
}
export function students03(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students03.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students03.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.students03);
    sleep(5);
    landingContentLibrary();
}
export function students04(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students04.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students04.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.students04);
    sleep(5);
    landingContentLibrary();
}
export function students05(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students05.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students05.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.students05);
    sleep(5);
    landingContentLibrary();
}
export function students06(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students06.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students06.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.students06);
    sleep(5);
    landingContentLibrary();
}
export function students07(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students07.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students07.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.students07);
    sleep(5);
    landingContentLibrary();
}
export function students08(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students08.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students08.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    
    landingV2(data.students08);
    sleep(5);
    landingContentLibrary();
}
export function students09(data: { [key: string]: { res: any, userId: string }}) {
    const jar = http.cookieJar();
    jar.set(process.env.COOKIE_URL as string, 'access', data.students09.res.cookies?.access[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });
    jar.set(process.env.COOKIE_URL as string, 'refresh', data.students09.res.cookies?.refresh[0].Value, {
        domain: process.env.COOKIE_DOMAIN,
    });

    landingV2(data.students09);
    sleep(5);
    landingContentLibrary();
}
 */