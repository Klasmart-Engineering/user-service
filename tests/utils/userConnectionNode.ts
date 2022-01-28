import { User } from '@sentry/node'
import { expect } from 'chai'
import { CoreUserConnectionNode } from '../../src/pagination/usersConnection'
import { UserConnectionNode } from '../../src/types/graphQL/user'

export const expectUserConnectionNode = (
    node: UserConnectionNode,
    user: User
) => {
    expect(node).to.deep.equal({
        id: user.user_id,
        givenName: user.given_name,
        familyName: user.family_name,
        avatar: user.avatar,
        status: user.status,
        username: user.username,
        dateOfBirth: user.date_of_birth,
        gender: user.gender,
        contactInfo: {
            email: user.email,
            phone: user.phone,
        },
        alternateContactInfo: {
            email: user.alternate_email,
            phone: user.alternate_phone,
        },
    } as Required<CoreUserConnectionNode>)
}
