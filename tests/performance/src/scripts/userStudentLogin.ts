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
        email: process.env.EMAIL_STUDENT_1 as string,
        pw: process.env.PW as string,
    });
    sleep(2);
    switchUser();
    sleep(1);
    meTest('Student');
    sleep(1);
    meTest('Student');
    sleep(1);
    meTest('Student');
    sleep(1);
    meTest('Student');
    sleep(1);
    optionsScript();
    sleep(1);
    meTest('Student');
    optionsScript();
    getUserTest("");
    optionsScript();
    getClassRosterTest("", "");
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    getUserTest("");
    optionsScript();
    meTest('Student');
    optionsScript();
    getUserTest("");
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    meTest('Student');
    optionsScript();
    myUsersTest();
    optionsScript();
    sleep(1);
    meTest('Student');
    meTest('Student');
    getUserTest(process.env.ID_STUDENT_1 as string);
    getUserTest(process.env.ID_STUDENT_1 as string);
    getUserTest(process.env.ID_STUDENT_1 as string);
}
