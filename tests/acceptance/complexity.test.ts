import chaiAsPromised from 'chai-as-promised'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { expect, use } from 'chai'
import { createTestConnection } from '../utils/testConnection'
import { getAdminAuthToken } from '../utils/testConfig'
import { loadFixtures } from '../utils/fixtures'
import { User } from '../../src/entities/user'
import { createUser } from '../factories/user.factory'
import { DEFAULT_MAX_QUERY_DEPTH } from '../../src/utils/createServer'

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

// todo: use a real nest connection once we have on implemented
const NESTED_CONNECTIONS_QUERY = `
query getSchoolTeacher {
    usersConnection(
        direction:FORWARD,
        directionArgs: {count: 50}
    ) { # depth: 0
        edges {
            node {
                # in the schema we've given this a complexity directive
                schools {
                    id
                }
            }
        }
    }
}
`

const CONNECTIONS_FILTER_QUERY = `
query getSchoolTeacher($user_id: UUID!) { # doesn't add to depth
    usersConnection(
        direction:FORWARD,
        filter: {
            userId: {
                operator: eq, value: $user_id
            },
            OR: [
                {
                    userId: {
                        operator: eq, value: $user_id
                    }
                },
                {
                    userId: {
                        operator: eq, value: $user_id
                    }
                }
            ]
        },
        directionArgs: {count: 50}
    ) {
        edges {
            cursor
        }
    }
}
`

const MUTATION_TOO_DEEP = `
mutation switch_user($user_id: ID!){
    switch_user(user_id: $user_id){
      organization_ownerships{
        user_id
      }
    }
  }
`

const MUTATION_NOT_TOO_DEEP = `
mutation switch_user($user_id: ID!){
    switch_user(user_id: $user_id){
      user_id
    }
  }
`

const MUTATION_TOO_BROAD = `
mutation switch_user($user_id: ID!) {
  switch_user(user_id: $user_id) {
    user_id
  }
  b: switch_user(user_id: $user_id) {
    user_id
  }
  c: switch_user(user_id: $user_id) {
    user_id
  }
  d: switch_user(user_id: $user_id) {
    user_id
  }
  e: switch_user(user_id: $user_id) {
    user_id
  }
  f: switch_user(user_id: $user_id) {
    user_id
  }
}
`

const QUERY_TOO_BROAD = `
{
  me {
    user_id
  }
  b: me {
    user_id
  }
  c: me {
    user_id
  }
  d: me {
    user_id
  }
  e: me {
    user_id
  }
  f: me {
    user_id
  }
  g: me {
    user_id
  }
}
`

describe.only('acceptance.complexity', () => {
    let connection: Connection
    let userId: string

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
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
        it('exceeds complexity limit', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: NESTED_CONNECTIONS_QUERY,
                    variables: {
                        user_id: userId,
                    },
                })
            expect(response.status).to.eq(400)
            expect(response.body.errors).have.length(1)
            expect(response.body.errors[0].message).to.eq(
                'Query too complex. Value of 550 is over the maximum 51.'
            )
        })
        it('exceeds complexity limit with filter', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: CONNECTIONS_FILTER_QUERY,
                    variables: {
                        user_id: userId,
                    },
                })
            expect(response.status).to.eq(400)
            expect(response.body.errors).have.length(1)
            expect(response.body.errors[0].message).to.eq(
                'Query too complex. Value of 750 is over the maximum 51.'
            )
        })
    })

    context('mutation depth limit', () => {
        it('exceeds depth limit', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: MUTATION_TOO_DEEP,
                    variables: {
                        user_id: userId,
                    },
                })
            expect(response.status).to.eq(400)
            expect(response.body.errors).have.length(1)
            expect(response.body.errors[0].message).to.eq(
                "'switch_user' exceeds maximum operation depth of 1"
            )
        })
        it('does not exceed depth limit', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: MUTATION_NOT_TOO_DEEP,
                    variables: {
                        user_id: userId,
                    },
                })
            expect(response.status).to.eq(200)
        })
    })

    context('top-level selection set size', () => {
        it('exceeds limit, mutation', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: MUTATION_TOO_BROAD,
                    variables: {
                        user_id: userId,
                    },
                })
            expect(response.status).to.eq(400)
            expect(response.body.errors).have.length(1)
            expect(response.body.errors[0].message).to.eq(
                'Too many top-level fields for mutation operation, found 6, must be less then 5'
            )
        })
        it('exceeds limit, query', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: QUERY_TOO_BROAD,
                    variables: {
                        user_id: userId,
                    },
                })
            expect(response.status).to.eq(400)
            expect(response.body.errors).have.length(1)
            expect(response.body.errors[0].message).to.eq(
                'Too many top-level fields for query operation, found 7, must be less then 6'
            )
        })
    })
})
