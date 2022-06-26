import { sign } from 'jsonwebtoken'

// {
//   "id": "c6d4feed-9133-5529-8d72-1003526d1b13",
//   "email": "sandy@kidsloop.live",
//   "given_name": "Joe",
//   "family_name": "Brown",
//   "name": "Joe Brown",
//   "iss": "calmid-debug",
//   "azure_ad_b2c_id": "123_abc"
// }
let AdminAuthToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImM2ZDRmZWVkLTkxMzMtNTUyOS04ZDcyLTEwMDM1MjZkMWIxMyIsImVtYWlsIjoic2FuZHlAa2lkc2xvb3AubGl2ZSIsImdpdmVuX25hbWUiOiJKb2UiLCJmYW1pbHlfbmFtZSI6IkJyb3duIiwibmFtZSI6IkpvZSBCcm93biIsImlzcyI6ImNhbG1pZC1kZWJ1ZyIsImF6dXJlX2FkX2IyY19pZCI6IjEyM19hYmMifQ.Ev7mvRTdd8ysj7njXX8EtsmbDiLHsxtdGIcwlAS8Dg8'

// {
//   "email": "sandy@kidsloop.live",
//   "given_name": "Joe",
//   "family_name": "Brown",
//   "name": "Joe Brown",
//   "iss": "calmid-debug",
//   "azure_ad_b2c_id": "123_abc"
// }
let AdminAuthWithoutIdToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InNhbmR5QGtpZHNsb29wLmxpdmUiLCJnaXZlbl9uYW1lIjoiSm9lIiwiZmFtaWx5X25hbWUiOiJCcm93biIsIm5hbWUiOiJKb2UgQnJvd24iLCJpc3MiOiJjYWxtaWQtZGVidWciLCJhenVyZV9hZF9iMmNfaWQiOiIxMjNfYWJjIn0.fJ1Q03fM0DK1DuP0rw0P8VTNWK857htu_aUVzzq0zlQ'

// {
//   "id": "fcf922e5-25c9-5dce-be9f-987a600c1356",
//   "email": "billy@gmail.com",
//   "given_name": "Billy",
//   "family_name": "Bob",
//   "name": "Billy Bob",
//   "iss": "calmid-debug",
//   "azure_ad_b2c_id": "123_abc"
// }
let NonAdminAuthToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZjZjkyMmU1LTI1YzktNWRjZS1iZTlmLTk4N2E2MDBjMTM1NiIsImVtYWlsIjoiYmlsbHlAZ21haWwuY29tIiwiZ2l2ZW5fbmFtZSI6IkJpbGx5IiwiZmFtaWx5X25hbWUiOiJCb2IiLCJuYW1lIjoiQmlsbHkgQm9iIiwiaXNzIjoiY2FsbWlkLWRlYnVnIiwiYXp1cmVfYWRfYjJjX2lkIjoiMTIzX2FiYyJ9.6UaQgHwUyzXK74v53NJeGRe1XLgYZ9H_vBFetLeyPNM'

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
