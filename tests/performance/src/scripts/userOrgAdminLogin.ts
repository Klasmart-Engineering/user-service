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
        email: process.env.EMAIL_ORG_ADMIN_1 as string,
        pw: process.env.PW_ORG_ADMIN_1 as string,
    });
    sleep(2);
    switchUser();
    sleep(1);
    meTest('Org admin');
    sleep(1);
    meTest('Org admin');
    sleep(1);
    meTest('Org admin');
    sleep(1);
    meTest('Org admin');
    sleep(1);
    optionsScript();
    sleep(1);
    meTest('Org admin');
    optionsScript();
    getUserTest("");
    optionsScript();
    getClassRosterTest("", "");
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    getUserTest("");
    optionsScript();
    meTest('Org admin');
    optionsScript();
    getUserTest("");
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    meTest('Org admin');
    optionsScript();
    myUsersTest();
    optionsScript();
    sleep(1);
    meTest('School admin');
    meTest('School admin');
    getUserTest(process.env.ID_SCHOOL_ADMIN_1 as string);
    getUserTest(process.env.ID_SCHOOL_ADMIN_1 as string);
    getUserTest(process.env.ID_SCHOOL_ADMIN_1 as string);
}