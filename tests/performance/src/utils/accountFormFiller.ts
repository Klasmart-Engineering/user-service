import { firstNameList, lastNameList } from "../fakeData/users";
import { UserAccountCreate } from "../interfaces/users";

function pickRandom(list: Array<string>) {
    return list[Math.floor(Math.random() * list.length)];
}

export const accountFormFiller = (start: number, end: number): UserAccountCreate[] => {
    let i = start;
    const accountList = [];
    for (i; i <= end; i++) {
        const numerical = i >= 10 ? i : `0${i}`;
        const account = {
            alternate_email: "",
            alternate_phone: "",
            date_of_birth: "01-1990",
            email: `ismaelp+test+${numerical}@bluetrailsoft.com`,
            phone: "",
            family_name: pickRandom(lastNameList),
            gender: 'male',
            given_name: pickRandom(firstNameList),
            organization_id: "de6e850a-cf97-4e0b-aa96-c0fedcda71be",
            organization_role_ids: ["87aca549-fdb6-4a63-97d4-d563d4a4690a"],
            school_ids: [],
            school_role_ids: [],
            shortcode: "",
        }
        accountList.push(account);
    }

    return accountList;
}