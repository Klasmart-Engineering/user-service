import { check } from 'k6';
import http from 'k6/http';
import { loginToB2C } from '../azure-b2c-auth/functions.js';
import { isRequestSuccessful } from '../utils/common.js';
import { getUserIDB2C } from '../utils/setup.js';
import {
  APIHeaders,
  AuthEndpoint,
  defaultOptions,
} from './common'

export const options = defaultOptions;

export function setup() {
  const loginResp = loginToB2C();

  const userID = getUserIDB2C(loginResp.json('access_token'));

  return {
    access_token: loginResp.json('access_token'),
    id_token: loginResp.json('id_token'),
    refresh_token: loginResp.json('refresh_token'),
    user_id: userID
  }
}

export default function main(data) {

  let response;

  //initialise the cookies for this VU
  http.cookieJar();

  const authHeader = {
    Authorization: `Bearer ${data.access_token}`
  };

  response = http.post(`${AuthEndpoint}/transfer`, '', {
    headers: Object.assign(APIHeaders, authHeader),
  });

  isRequestSuccessful(response);

  if (
    check(response, {
      'has status 200': (r) => r.status === 200,
      'has access cookie': (r) => r.cookies.access,
      'has refresh cookie': (r) => r.cookies.refresh,
    })
  ) {
    check(response, {
      'has access cookie data': (r) => r.cookies.access[0],
      'has refresh cookie data': (r) => r.cookies.refresh[0],
    })
  };
  
  const switchPayload = JSON.stringify({
    user_id: data.user_id
  })
  
  response = http.post(`${AuthEndpoint}/switch`, switchPayload, {
    headers: APIHeaders
  });

  isRequestSuccessful(response);

  if (
    check(response, {
      'has status 200': (r) => r.status === 200,
      'has access cookie': (r) => r.cookies.access,
      'has refresh cookie': (r) => r.cookies.refresh,
    })
  ) {
    check(response, {
      'has access cookie data': (r) => r.cookies.access[0],
      'has refresh cookie data': (r) => r.cookies.refresh[0],
    })
  };

  response = http.get(`${AuthEndpoint}/refresh`, {
    headers: APIHeaders,
  });

  isRequestSuccessful(response);

  check(response, {
    'has status 200': (r) => r.status === 200,
  });

  return response;
}