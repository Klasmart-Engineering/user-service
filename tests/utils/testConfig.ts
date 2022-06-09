import { sign } from 'jsonwebtoken'

// {
//   "id": "c6d4feed-9133-5529-8d72-1003526d1b13",
//   "email": "sandy@kidsloop.live",
//   "given_name": "Joe",
//   "family_name": "Brown",
//   "name": "Joe Brown",

//   "iss": "calmid-debug"
// }
let AdminAuthToken =
    // 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImM2ZDRmZWVkLTkxMzMtNTUyOS04ZDcyLTEwMDM1MjZkMWIxMyIsImVtYWlsIjoic2FuZHlAa2lkc2xvb3AubGl2ZSIsImdpdmVuX25hbWUiOiJKb2UiLCJmYW1pbHlfbmFtZSI6IkJyb3duIiwibmFtZSI6IkpvZSBCcm93biIsImlzcyI6ImNhbG1pZC1kZWJ1ZyJ9.jwmaXSz73zEfsKH1aztAVfhFgh6iiie9vY7uJ-Ke940'
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImM2ZDRmZWVkLTkxMzMtNTUyOS04ZDcyLTEwMDM1MjZkMWIxMyIsImVtYWlsIjoic2FuZHlAa2lkc2xvb3AubGl2ZSIsImdpdmVuX25hbWUiOiJKb2UiLCJmYW1pbHlfbmFtZSI6IkJyb3duIiwibmFtZSI6IkpvZSBCcm93biIsImlzcyI6ImNhbG1pZC1kZWJ1ZyIsImlhdCI6MTY1NDc2NTc1MX0.e9zJ2Ptq7RoEc7cBEpr8f221KtjinhTeWl634DU9Z60'
// {
//   "email": "sandy@kidsloop.live",
//   "given_name": "Joe",
//   "family_name": "Brown",
//   "name": "Joe Brown",
//   "iss": "calmid-debug"
// }
let AdminAuthWithoutIdToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InNhbmR5QGtpZHNsb29wLmxpdmUiLCJnaXZlbl9uYW1lIjoiSm9lIiwiZmFtaWx5X25hbWUiOiJCcm93biIsIm5hbWUiOiJKb2UgQnJvd24iLCJpc3MiOiJjYWxtaWQtZGVidWcifQ.nUKChAeIQ3OrNSxXGSybd0LM2MEU3UZVAK3Q-eL52hI'

// {
//   "id": "fcf922e5-25c9-5dce-be9f-987a600c1356",
//   "email": "billy@gmail.com",
//   "given_name": "Billy",
//   "family_name": "Bob",
//   "name": "Billy Bob",
//   "iss": "calmid-debug"
// }
let NonAdminAuthToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZjZjkyMmU1LTI1YzktNWRjZS1iZTlmLTk4N2E2MDBjMTM1NiIsImVtYWlsIjoiYmlsbHlAZ21haWwuY29tIiwiZ2l2ZW5fbmFtZSI6IkJpbGx5IiwiZmFtaWx5X25hbWUiOiJCb2IiLCJuYW1lIjoiQmlsbHkgQm9iIiwiaXNzIjoiY2FsbWlkLWRlYnVnIn0.Aza7YU5AbKty56djaCl6vAgPTswui8I_My090xJbQcA'

const APIKeyAuth = 'Bearer test-api-token'

const secret = 'iXtZx1D5AqEB0B9pfn+hRQ=='

// set expiresIn to undefined to have the token never expire
export function generateToken(payload: any, expiresIn?: '1800s'): string {
    const options: { expiresIn?: string } = {}
    if (expiresIn !== undefined) {
        options.expiresIn = expiresIn
    }
    const val = sign(payload, secret, options)
    return val
}

export function setAdminAuthWithoutIdToken(token: string) {
    AdminAuthWithoutIdToken = token
}

export function getAdminAuthWithoutIdToken() {
    return AdminAuthWithoutIdToken
}

export function setAdminAuthToken(token: string) {
    AdminAuthToken = token
}

export function setNonAdminAuthToken(token: string) {
    NonAdminAuthToken = token
}

export function getNonAdminAuthToken() {
    return NonAdminAuthToken
}

export function getAdminAuthToken() {
    return AdminAuthToken
}

export function getAPIKeyAuth() {
    return APIKeyAuth
}
