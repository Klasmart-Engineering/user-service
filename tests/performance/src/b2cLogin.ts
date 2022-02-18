import http from 'k6/http';
import { Options } from 'k6/options';
import { APIHeaders } from './utils/common';
import { loginToB2C } from './azure-b2c-auth/functions';
import { myUsersQuery } from './queries/users';
import { params } from "./utils/params";
import { check } from 'k6';

export const options: Options = {
<<<<<<< HEAD
    
=======
>>>>>>> 03e372db9359d019b9aec870a425559d72f14935
    ext: {
        loadimpact: {
            projectID: 3560234,
            // projectID: 3559532,
        }
    },
<<<<<<< HEAD
    
=======
>>>>>>> 03e372db9359d019b9aec870a425559d72f14935
    scenarios: {
        students: {
            executor: 'per-vu-iterations',
            iterations: 1,
            vus: parseInt(__ENV.VUS, 10),
            exec: 'students',
        },
        // create new methods for signing in different roles if needed and add scenarios here.
    }
};

export function students() {
    const loginPayload = {
        deviceId: 'webpage',
        deviceName: 'k6',
        email: `${process.env.B2C_USERNAME}${__VU - 1}@${process.env.B2C_DOMAIN}`,
        pw: process.env.B2C_PASSWORD as string,        
        
    };

    const loginResp = loginToB2C(loginPayload) as any;

    check(loginResp, {
        'B2C login status is 200': (r) => r.status === 200,
        'B2C access token is provided': (r) => JSON.parse(r.body).access_token !== undefined,
    })

    const data =  {
      access_token: loginResp?.json('access_token'),
      id_token: loginResp?.json('id_token'),
      refresh_token: loginResp?.json('refresh_token'),
    }

    let res;

	const authHeader = {
		Authorization: `Bearer ${data.access_token}`
	};

	res = http.post(`${process.env.AUTH_URL}transfer`, '', {
		headers: Object.assign(APIHeaders, authHeader),
        tags: {
            name: `${process.env.AUTH_URL}transfer`,
            url: `${process.env.AUTH_URL}transfer`,
        }
	});

    check(res, {
        'Transfer status is 200': r => r.status === 200,
    })

	const userPayload = JSON.stringify({
        variables: {},
        query: myUsersQuery,
    });

	res = http.post(process.env.SERVICE_URL as string, userPayload, params);
    const switchParams = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: `include`,
        tags: {
            name: process.env.SERVICE_URL as string,
            url: process.env.SERVICE_URL as string,
        }
    }

    check(res, {
        'My users status is 200': r => r.status === 200,
        'My users list has been received': r => JSON.parse(r.body as string).data?.my_users?.length >= 1,
    });
    
    const myUsersData = JSON.parse(res?.body as string);
    const userId = myUsersData?.data.my_users[0].user_id;
	
	const switchPayload = JSON.stringify({
		user_id: userId
	});
	
	res = http.post(`${process.env.AUTH_URL}switch`, switchPayload, switchParams);
   
    check(res, {
        'switch status is 200': r => r.status === 200,
    })
}