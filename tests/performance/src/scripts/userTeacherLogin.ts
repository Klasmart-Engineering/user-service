import { sleep } from "k6";
import getUserTest from "./getUserTest";
import landingV2 from "./landingV2";
import switchUser from "./switchUser";
import testLogin from "./testLogin";

export default function() {
    sleep(5);
    testLogin({
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_TEACHER_1 as string,
        pw: process.env.PW as string,
    });
    sleep(2);
    switchUser();
    getUserTest(process.env.ID_TEACHER_1 as string);
    landingV2({ userId: process.env.ID_TEACHER_1 as string, res: {}});
}