import { sleep } from "k6";
import getClassRosterTest from "./getClassRosterTest";
import getUserTest from "./getUserTest";
import meTest from "./meTest";
import myUsersTest from "./myUsersTest";
import optionsScript from "./optionsScript";
import switchUser from "./switchUser";
import testLogin from "./testLogin";

export default function() {
    sleep(5);
    testLogin({
        deviceId: "webpage",
        deviceName: "k6",
        email: process.env.EMAIL_TEACHER_1 as string,
        pw: process.env.PW_TEACHER_1 as string,
    });
    sleep(2);
    switchUser();
    sleep(1);
    meTest('Teacher');
    sleep(1);
    meTest('Teacher');
    sleep(1);
    meTest('Teacher');
    sleep(1);
    meTest('Teacher');
    sleep(1);
    optionsScript();
    sleep(1);
    meTest('Teacher');
    optionsScript();
    getUserTest("");
    optionsScript();
    getClassRosterTest("", "");
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    getUserTest("");
    optionsScript();
    meTest('Teacher');
    optionsScript();
    getUserTest("");
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    meTest('Teacher');
    optionsScript();
    myUsersTest();
    optionsScript();
    sleep(1);
    meTest('Teacher');
    meTest('Teacher');
    getUserTest(process.env.ID_TEACHER_1 as string);
    getUserTest(process.env.ID_TEACHER_1 as string);
    getUserTest(process.env.ID_TEACHER_1 as string);
}