import { sleep } from "k6";
import switchUser from "./switchUser";
import testLogin from "./testLogin";
import hitHomeRequest2 from "./hitHomeRequest2";

export default function() {
    testLogin();
    sleep(2);
    switchUser();
    sleep(1);
    hitHomeRequest2('Org admin');

    
}