import http from "k6/http";
import { loginToB2C } from "../azure-b2c-auth/functions";
import { getUserIDB2C } from "./setup";
import { params } from "./params";
import { APIHeaders } from './common'
import { LoginPayload } from "../interfaces/login";

export function loginSetupV2(loginPayload?: LoginPayload) {
    const loginResp = loginToB2C(loginPayload) as any;
    const userId = getUserIDB2C(loginResp?.json('access_token'));
  
    const data =  {
      access_token: loginResp?.json('access_token'),
      id_token: loginResp?.json('id_token'),
      refresh_token: loginResp?.json('refresh_token'),
      user_id: userId
    }

    let response;

	const authHeader = {
		Authorization: `Bearer ${data.access_token}`
	};

	response = http.post(`${process.env.AUTH_URL}transfer`, '', {
		headers: Object.assign(APIHeaders, authHeader),
	});
	
	const switchPayload = JSON.stringify({
		user_id: data.user_id
	})
	
	response = http.post(`${process.env.AUTH_URL}switch`, switchPayload, params);
	return { res: response, userId: userId as string };
}