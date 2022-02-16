import http from 'k6/http';
import { check, fail } from 'k6';
import { APIHeaders } from './common';

function checkAccessCookieResponse(response: any) {

    if (
      !check(response, {
        'Transfer status code was 200': (r) => r.status === 200,
      })
    ) {
      fail('Transfer status code was *not* 200')
    }
  
    if (
      !check(response, {
        'Transfer returned an access cookie': (r) => r.cookies.access[0],
      })
    ) {
      fail('Transfer did not return an access cookie')
    }
  }

export function getAccessCookieB2C(token:string) {

    const authHeader = {
      Authorization: `Bearer ${token}`
    };
  
    const response = http.post(`https://auth.${process.env.APP_URL}/transfer`, null, {
      headers: Object.assign({}, APIHeaders, authHeader),
    });
  
    checkAccessCookieResponse(response);
  
    return response.cookies.access[0].value;
  }

function checkUserIDResponse(response: any) {

if (
    !check(response, {
    'UserID status code was 200': (r) => r.status === 200,
    })
) {
    fail('UserID status code was *not* 200')
}

if (
    !check(response, {
    'User ID value returned': (r) => r.json('data.myUser.profiles.0.id'),
    })
) {
    fail('No User ID value returned')
}
}

export function getUserIDB2C(token: string) {

  const accessCookie = getAccessCookieB2C(token);

  const jar = http.cookieJar();
  jar.set(process.env.COOKIE_URL as string, 'access', accessCookie, {
      domain: process.env.COOKIE_DOMAIN,
  });

  const response = http.post(`https://api.${process.env.APP_URL}/user/`, JSON.stringify({
    query: `{
      myUser {
        profiles {
          id
        }
      }
    }`
  }), {
    headers: APIHeaders,
  });

  checkUserIDResponse(response);

  return response.json('data.myUser.profiles.0.id');
}