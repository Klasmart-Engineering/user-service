import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { getConnection } from 'typeorm'
import { expect, use } from 'chai'
import { TestConnection } from '../utils/testConnection'
import { getAdminAuthToken } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'
import { User } from '../../src/entities/user'
import { createUser } from '../factories/user.factory'
import { DEFAULT_MAX_QUERY_DEPTH } from '../../src/utils/createServer'
import { DEFAULT_MAX_QUERY_COMPLEXITY } from '../../src/utils/complexity'

use(chaiAsPromised)

const url = 'http://localhost:8080/user'
const request = supertest(url)

// todo: have the test queries use nested connection once those are implemented
// as they are what the depth limit is designed around

const TOO_DEEP_QUERY = `
query getSchoolTeacher($user_id: ID!) { # doesn't add to depth
  user(user_id: $user_id) { # depth: 0
    school_memberships {
      school {
        classes {
          teachers {
            school_memberships {
              school {
                classes {
                  teachers {
                    user_id
                    user_name,
                    school_memberships {
                      school {
                        school_id # depth: 11
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`

const DEEPEST_ALLOWED_QUERY = `
query getSchoolTeacher($user_id: ID!) { # doesn't add to depth
  user(user_id: $user_id) { # depth: 0
    school_memberships {
      school {
        classes {
          teachers {
            school_memberships {
              school {
                classes {
                  teachers {
                    user_id
                    user_name,
                    school_memberships {
                      school_id # depth 10
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`

const COMPLEXITY_CHILD_CONNECTIONS_QUERY = `
query {

    queryComplexity{
        score,
        limit
    }

    usersConnection(
        direction:FORWARD,
        directionArgs: {count: 50}
    ) {
        edges {
            node {
              schoolMembershipsConnection(count: 50) {
                  edges {
                    node {
                      userId
                    }
                  }
              }
            }
        }
    }
}
`

describe('acceptance.complexity', () => {
    let userId: string
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    beforeEach(async () => {
        await loadFixtures('users', connection)

        const user = await User.save(createUser(undefined))

        userId = user.user_id
    })

    context('query depth', () => {
        it('exceeds the depth limit', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: TOO_DEEP_QUERY,
                    variables: {
                        user_id: userId,
                    },
                })
            expect(response.status).to.eq(400)
            expect(response.body.errors).have.length(1)
            expect(response.body.errors[0].message).to.eq(
                `'getSchoolTeacher' exceeds maximum operation depth of ${DEFAULT_MAX_QUERY_DEPTH}`
            )
        })

        it('does not exceed the depth limit', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: DEEPEST_ALLOWED_QUERY,
                    variables: {
                        user_id: userId,
                    },
                })
            expect(response.status).to.eq(200)
        })
    })

    context('query complexity', () => {
        it('does not exceed complexity limit', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: COMPLEXITY_CHILD_CONNECTIONS_QUERY,
                    variables: {
                        user_id: userId,
                    },
                })
            expect(response.status).to.eq(200)
            expect(response.body.errors).is.undefined
            expect(response.body.data.queryComplexity.limit).to.eq(
                DEFAULT_MAX_QUERY_COMPLEXITY
            )
            expect(response.body.data.queryComplexity.score).to.eq(2550)
        })
    })
})
