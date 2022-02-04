import {
  generateCodeChallenge
} from './common'

// import k6 specific packages
import { check, group } from 'k6';
import http, { RefinedResponse, ResponseType } from 'k6/http';
import encoding from 'k6/encoding';
import { Counter } from 'k6/metrics';
// import helpers
import { defaultHeaders } from '../utils/common'
import { LoginPayload } from '../interfaces/login';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { URLSearchParams } = require('../modules/jslib');


// Initialise counter for HTTP 429 errors
export const count429 = new Counter('http_429_errors');

export function loginToB2C(loginPayload?: LoginPayload) {

  //initalise variables for B2C from env - if not set load the loadtest environment defaults
  const tenantID = '8d922fec-c1fc-4772-b37e-18d2ce6790df';
  const policyName = 'B2C_1A_RELYING_PARTY_SIGN_UP_LOG_IN';
  const authClientID = '926001fe-7853-485d-a15e-8c36bb4acaef';
  const hubClientID = '24bc7c47-97c6-4f27-838e-093b3948a5ca';

  let response, cookies, params, csrfToken: string, clientRequestID: string, code: string | null;

  const baseURL = `https://login.${process.env.APP_URL}/${tenantID}/${policyName}`;
  const scope = `email https://login.${process.env.APP_URL}/${authClientID}/tasks.write openid profile offline_access`;
  const redirect = `https://auth.${process.env.APP_URL}/authentication-callback`;

  //initialise the cookies for this VU
  const cookieJar = http.cookieJar();

  const pkce = generateCodeChallenge();

  group('Load Login Page', function() {
    // Initial OpenID Config Check
    response = http.get(`${baseURL}/v2.0/.well-known/openid-configuration`, {
      headers: defaultHeaders
    });
    check(response, {
      'is openid-configuration status 200': r => r.status === 200,
    })

    isResponse429(response, count429);

    // Authorize
    params = new URLSearchParams([
      ['client_id', hubClientID],
      ['scope', scope],
      ['redirect_uri', redirect],
      ['response_type', 'code'],
      ['code_challenge', pkce.challenge],
      ['code_challenge_method', 'S256'],
    ]);

    response = http.get(`${baseURL}/oauth2/v2.0/authorize?${params.toString()}`, {
      headers: defaultHeaders
    });
    check(response, {
      'is authorize status 200': r => r.status === 200,
    })

    isResponse429(response, count429);

    cookies = cookieJar.cookiesForURL(response.url);
    csrfToken = cookies['x-ms-cpim-csrf'][0];
    clientRequestID = response.headers['X-Request-Id'];
  });

  group('Auth and Redirect', function() {
    // SelfAsserted
    const stateProperties = encoding.b64encode(`{"TID": "${clientRequestID}"}`);

    const csrfHeaders = Object.assign({
      'x-csrf-token': csrfToken,
    }, defaultHeaders);

    params = new URLSearchParams([
      ['tx', `StateProperties=${stateProperties}`],
      ['p', policyName],
    ]);

    const selfAssertedFormData = {
      request_type: 'RESPONSE',
      signInName: loginPayload?.email ?? process.env.EMAIL_ORG_ADMIN_1 as string,
      password: loginPayload?.pw ?? process.env.PW as string,
    };

    response = http.post(`${baseURL}/SelfAsserted?${params.toString()}`, selfAssertedFormData, {
      headers: csrfHeaders
    });

    check(response, {
      'is SelfAsserted status 200': r => r.status === 200,
    })
    
    isResponse429(response, count429);

    response = http.get(`${baseURL}/api/CombinedSigninAndSignup/confirmed?${params.toString()}`, {
      headers: csrfHeaders,
      redirects: 0
    });
  
    isResponse429(response, count429);

    const redirectURL = new URL(response.headers['Location']);
    code = redirectURL.searchParams.get('code');
  });

  group('Token', function() {

    const tokenPayload = {
      client_id: hubClientID,
      redirect_uri: redirect,
      scope: scope,
      code: code as string,
      'code_verifier': pkce.verifier,
      'grant_type': 'authorization_code',
      'client_info': '1',
      'client-request-id': clientRequestID
    };

    response = http.post(`${baseURL}/oauth2/v2.0/token`, tokenPayload, {
      headers: defaultHeaders
    });

    isResponse429(response, count429);
  })

  return response;
}

function isResponse429(response: RefinedResponse<ResponseType | undefined>, counter: Counter) {
  if (response.status === 429) {
    counter.add(1);
  }
}