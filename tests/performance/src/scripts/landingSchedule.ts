import { sleep } from "k6";
import http from "k6/http";
import getUserTest from "./getUserTest";
import schedulesTimeView from "./schedulesTimeView";
import scheduleFilter from "./scheduleFilterProgram";
import loginSetup from "../utils/loginSetup";
import scheduleFilterProgram from "./scheduleFilterProgram";
import scheduleFilterClass from "./scheduleFilterClass";
import getSchoolsFilter from "./getSchoolsFilter";
import meMemership from "./meMemership"



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

    jar.set(process.env.LIVE_URL as string, 'access', data.res.cookies?.access[0].Value);
    jar.set(process.env.LIVE_URL as string, 'refresh', data.res.cookies?.refresh[0].Value);

    schedulesTimeView();
    sleep(5);
    scheduleFilterProgram();
    sleep(5);
    scheduleFilterClass();
    sleep(1);
    getSchoolsFilter();
    sleep(1);
    meMemership();
    // then is missing 3 request more.
}
