import http from "k6/http";
import { loginToB2C } from "../azure-b2c-auth/functions";
import { getUserIDB2C } from "./setup";
import { params } from "./params";
import { APIHeaders } from './common'
import { LoginPayload } from "../interfaces/login";
import { sleep } from "k6";
import { myUsersQuery } from "../queries/users";

export function loginSetupV2(loginPayload?: LoginPayload) {
    const loginResp = loginToB2C(loginPayload) as any;
    const data =  {
      access_token: loginResp?.json('access_token'),
      id_token: loginResp?.json('id_token'),
      refresh_token: loginResp?.json('refresh_token'),
    }

    let response;

	const authHeader = {
		Authorization: `Bearer ${data.access_token}`
	};

	response = http.post(`${process.env.AUTH_URL}transfer`, '', {
		headers: Object.assign(APIHeaders, authHeader),
	});

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
		user_id: userId
	})
	
	response = http.post(`${process.env.AUTH_URL}switch`, switchPayload, switchParams);
	return { res: response, userId: userId as string };
}