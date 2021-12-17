import { sleep } from "k6";
import switchUser from "./switchUser";
import testLogin from "./testLogin";
import hitHomeRequest5 from "./hitHomeRequest5";

export default function() {
    testLogin();
    sleep(2);
    switchUser();
    sleep(1);
    hitHomeRequest5('Org admin');

    
}