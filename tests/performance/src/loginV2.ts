import http from 'k6/http';
import {
    APIHeaders,
    defaultOptions,
  } from './utils/common'
  import { loginToB2C } from './azure-b2c-auth/functions';
  import { getUserIDB2C } from './utils/setup';
import { check } from 'k6';

export const options = defaultOptions;
export const AuthEndpoint = `https://auth.${process.env.APP_URL}`;

export function setup() {
  const loginResp = loginToB2C() as any;

  const userID = getUserIDB2C(loginResp.json('access_token'));

  return {
    access_token: loginResp.json('access_token'),
    id_token: loginResp.json('id_token'),
    refresh_token: loginResp.json('refresh_token'),
    user_id: userID
  }
}

export default function main(data: any) {
  let response;

  const authHeader = {
    Authorization: `Bearer ${data.access_token}`
  };

  response = http.post(`${AuthEndpoint}/transfer`, '', {
    headers: Object.assign(APIHeaders, authHeader),
  });

  if (
    check(response, {
      'has status 200': (r) => r.status === 200,
      'has access cookie': (r) => r.cookies.access !== undefined,
      'has refresh cookie': (r) => r.cookies.refresh !== undefined,
    })
  ) {
    check(response, {
      'has access cookie data': (r) => r.cookies.access[0] !== undefined,
      'has refresh cookie data': (r) => r.cookies.refresh[0] !== undefined,
    })
  };
  
  const switchPayload = JSON.stringify({
    user_id: data.user_id
  })
  
  const switchRes = http.post(`${AuthEndpoint}/switch`, switchPayload, {
    headers: APIHeaders
  });


  if (
    check(switchRes, {
      'has status 200': (r) => r.status === 200,
      'has access cookie': (r) => r.cookies.access !== undefined,
      'has refresh cookie': (r) => r.cookies.refresh !== undefined,
    })
  ) {
    check(switchRes, {
      'has access cookie data': (r) => r.cookies.access[0] !== undefined,
      'has refresh cookie data': (r) => r.cookies.refresh[0] !== undefined,
    })
  };

  response = http.get(`${AuthEndpoint}/refresh`, {
    headers: APIHeaders,
  });


  check(response, {
    'has status 200': (r) => r.status === 200,
  });

  return response;
}