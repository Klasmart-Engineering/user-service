// this is useful for authenticating
// to the playground
/* eslint no-console: off */
import { User } from '../src/entities/user'
import { createUser } from '../tests/factories/user.factory'
import { generateToken } from '../tests/utils/testConfig'
import { createTestConnection } from '../tests/utils/testConnection'

// generates a token that will never expire
async function getAdminUserToken() {
    await createTestConnection()
    // email taken from ADMIN_EMAILS list
    let user = await User.findOne({ email: 'sandy@calmid.com' })
    if (user == undefined) {
        user = await createUser({ email: 'sandy@calmid.com' }).save()
    }

    const tokenInfo = {
        id: user.user_id,
        email: user.email,
        iss: 'calmid-debug',
    }

    const token = generateToken(tokenInfo, undefined)
    console.log(
        'auth header for admin user',
        JSON.stringify({ Authorization: token })
    )
    console.log('token info: ', tokenInfo)
}

void getAdminUserToken()
