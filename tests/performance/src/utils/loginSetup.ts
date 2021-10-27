import http from "k6/http";
import { LoginPayload } from "../interfaces/login";
import { myUsersQuery } from "../queries/users";
import { params } from "./params";

export default function(loginPayload: LoginPayload) {
    const payload = JSON.stringify(loginPayload);
    const res = http.post(process.env.AUTH_SIGN_IN_URL as string, payload, params);
    const token = JSON.parse(res.body as string);
    const authPayload = JSON.stringify(
        { token: token.accessToken }
    );
    
    http.post(`${process.env.AUTH_URL}transfer` as string, authPayload, params);
   
    const userPayload = JSON.stringify({
        variables: {},
        query: myUsersQuery,
    });

    const resMyUsers = http.post(process.env.SERVICE_URL as string, userPayload, params);
    const switchParams = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: `include`,
    }
    
    const myUsersData = JSON.parse(resMyUsers?.body as string);
    const userId = myUsersData?.data.my_users[0].user_id;
    const switchPayload = JSON.stringify({
        user_id: userId,
    });

    const switchRes = http.post(`${process.env.AUTH_URL}switch`, switchPayload, switchParams);
    return { res: switchRes, userId };
}   