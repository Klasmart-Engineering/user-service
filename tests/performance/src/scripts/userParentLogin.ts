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
        email: process.env.EMAIL_PARENT_1 as string,
        pw: process.env.PW as string,
    });
    sleep(2);
    switchUser();
    sleep(1);
    meTest('Parent');
    sleep(1);
    meTest('Parent');
    sleep(1);
    meTest('Parent');
    sleep(1);
    meTest('Parent');
    sleep(1);
    optionsScript();
    sleep(1);
    meTest('Parent');
    optionsScript();
    getUserTest("");
    optionsScript();
    getClassRosterTest("", "");
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    getUserTest("");
    optionsScript();
    meTest('Parent');
    optionsScript();
    getUserTest("");
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    meTest('Parent');
    optionsScript();
    myUsersTest();
    optionsScript();
    sleep(1);
    meTest('Parent');
    meTest('Parent');
    getUserTest(process.env.ID_PARENT_1 as string);
    getUserTest(process.env.ID_PARENT_1 as string);
    getUserTest(process.env.ID_PARENT_1 as string);
}