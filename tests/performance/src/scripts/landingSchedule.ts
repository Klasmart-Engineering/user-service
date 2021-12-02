import { sleep } from "k6";
import http from "k6/http";
import getUserTest from "./getUserTest";
import schedulesTimeView from "./schedulesTimeView";
import scheduleFilter from "./scheduleFilterProgram";
import loginSetup from "../utils/loginSetup";
import scheduleFilterProgram from "./scheduleFilterProgram";
import scheduleFilterClass from "./scheduleFilterClass";



/* export function setup() {
    const loginPayload = {
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_TEACHER_1 as string,
        pw: process.env.PW_TEACHER_1 as string,
    };

    return loginSetup(loginPayload)
}  */  

export default function(data: { res: any, userId: string}) {
    const jar = http.cookieJar();
    jar.set(process.env.SERVICE_URL as string, 'access', data.res.cookies?.access[0].Value);
    jar.set(process.env.SERVICE_URL as string, 'refresh', data.res.cookies?.refresh[0].Value);

    schedulesTimeView();
    /* sleep(2);
    scheduleFilterProgram();
    sleep(2);
    scheduleFilterClass();
    sleep(2); */
    
    /*
    meTestGetSchoolFilter();
    sleep(2);
    query1();
    sleep(2);
    query2();
    sleep(2);
    query3();
    sleep(2);
    query4();
    sleep(2);
    query5();
    sleep(2);
    query6(); */

    


    /* meTest();
    sleep(1);
    meTest();
    sleep(1);
    meTest();
    sleep(0.5)
    getUserTest(data.userId);
    sleep(1);
    meTest();
    sleep(0.5)
    getUserTest(data.userId);
    sleep(0.5)
    meTest(); */
}
