import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { ICreateScopeArgs } from '../../../../src/directives/isAdmin'
import { AgeRange } from '../../../../src/entities/ageRange'
import { Class } from '../../../../src/entities/class'
import { Organization } from '../../../../src/entities/organization'
import { User } from '../../../../src/entities/user'
import { AgeRangesInitializer } from '../../../../src/initializers/ageRanges'
import {
    childConnectionLoader,
    IChildConnectionDataloaderKey,
} from '../../../../src/loaders/childConnectionLoader'
import { Model } from '../../../../src/model'
import {
    ageRangeConnectionQuery,
    ageRangesConnectionSortingConfig,
    mapAgeRangeToAgeRangeConnectionNode,
} from '../../../../src/pagination/ageRangesConnection'
import {
    classesConnectionQuery,
    classesConnectionSortingConfig,
    mapClassToClassConnectionNode,
} from '../../../../src/pagination/classesConnection'
import {
    userConnectionSortingConfig,
    usersConnectionQuery,
} from '../../../../src/pagination/usersConnection'
import { PermissionName } from '../../../../src/permissions/permissionNames'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { createServer } from '../../../../src/utils/createServer'
import { IChildPaginationArgs } from '../../../../src/utils/pagination/paginate'
import { ISortingConfig } from '../../../../src/utils/pagination/sorting'
import { createAgeRange } from '../../../factories/ageRange.factory'
import { createClass } from '../../../factories/class.factory'
import { createOrganization } from '../../../factories/organization.factory'
import { createOrganizationMembership } from '../../../factories/organizationMembership.factory'
import { createRole } from '../../../factories/role.factory'
import { createSchool } from '../../../factories/school.factory'
import { createSchoolMembership } from '../../../factories/schoolMembership.factory'
import { createUser } from '../../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { isStringArraySortedAscending } from '../../../utils/sorting'
import { TestConnection } from '../../../utils/testConnection'
import {
    createAdminUser,
    createNonAdminUser,
} from '../../../utils/testEntities'

use(chaiAsPromised)

function getDataloaderKeys(
    orgs: Organization[],
    args: IChildPaginationArgs,
    includeTotalCount = true
) {
    const items: IChildConnectionDataloaderKey<User>[] = []
    for (const org of orgs) {
        items.push({
            parent: {
                id: org.organization_id,
                filterKey: 'organizationId',
                pivot: '"OrganizationMembership"."organization_id"',
            },
            args,
            includeTotalCount,
            primaryColumn: 'user_id',
        })
    }
    return items
}

describe('child connections', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let orgs: Organization[] = []

    const usersPerOrg = 20
    const pageSize = 5

    let args: IChildPaginationArgs
    let adminPermissions: UserPermissions

    const mapFunc = (user: User) => {
        return { userId: user.user_id, givenName: user.given_name }
    }
    const sort: ISortingConfig = userConnectionSortingConfig
    let scopeArgs: ICreateScopeArgs

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        const adminUser = await createAdminUser(testClient)
        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })
        scopeArgs = { permissions: adminPermissions, entity: 'user' }

        args = {
            count: pageSize,
        }

        // create two orgs with heaps of users
        orgs = [createOrganization(), createOrganization()]
        await connection.manager.save(orgs)

        for (let i = 0; i < usersPerOrg; i++) {
            for (const org of orgs) {
                const user = await createUser().save()
                await createOrganizationMembership({
                    user,
                    organization: org,
                }).save()
            }
        }
    })

    context('pagination', () => {
        it('paginates forwards', async () => {
            let response = await childConnectionLoader(
                getDataloaderKeys(orgs, args),
                usersConnectionQuery,
                mapFunc,
                sort,
                scopeArgs
            )

            let count = response[0].edges.length

            // paginate the first org
            while (response[0].pageInfo.hasNextPage) {
                const cursor = response[0].pageInfo.endCursor

                response = await childConnectionLoader(
                    getDataloaderKeys(orgs, { ...args, cursor }),
                    usersConnectionQuery,
                    mapFunc,
                    sort,
                    scopeArgs
                )
                count += response[0].edges.length
            }

            expect(count).to.eq(usersPerOrg)
        })
        it('paginates backwards', async () => {
            let response = await childConnectionLoader(
                getDataloaderKeys(orgs, { ...args, direction: 'BACKWARD' }),
                usersConnectionQuery,
                mapFunc,
                sort,
                scopeArgs
            )
            let count = response[0].edges.length

            while (response[0].pageInfo.hasPreviousPage) {
                const cursor = response[0].pageInfo.startCursor

                response = await childConnectionLoader(
                    getDataloaderKeys(orgs, {
                        ...args,
                        cursor,
                        direction: 'BACKWARD',
                    }),
                    usersConnectionQuery,
                    mapFunc,
                    sort,
                    scopeArgs
                )
                count += response[0].edges.length
            }
            expect(count).to.eq(usersPerOrg)
        })
    })

    context('counting', () => {
        it('returns the totalCount when requested', async () => {
            const results = await childConnectionLoader(
                getDataloaderKeys(orgs, args, true),
                usersConnectionQuery,
                mapFunc,
                sort,
                scopeArgs
            )
            expect(results).to.have.lengthOf(orgs.length)
            for (const r of results) {
                expect(r.totalCount).to.eq(usersPerOrg)
            }
        })
        it('does not return the totalCount when not requested', async () => {
            const results = await childConnectionLoader(
                getDataloaderKeys(orgs, args, false),
                usersConnectionQuery,
                mapFunc,
                sort,
                scopeArgs
            )
            expect(results).to.have.lengthOf(orgs.length)
            for (const r of results) {
                expect(r.totalCount).to.be.undefined
                expect(r.edges).to.exist
            }
        })
    })

    context('sorting', () => {
        it('sorts all child connections', async () => {
            const response = await childConnectionLoader(
                getDataloaderKeys(orgs, {
                    ...args,
                    sort: { field: 'givenName', order: 'ASC' },
                }),
                usersConnectionQuery,
                mapFunc,
                sort,
                scopeArgs
            )
            expect(response).to.have.lengthOf(2)
            for (const orgUsers of response) {
                const isSorted = isStringArraySortedAscending(
                    orgUsers.edges.map((e) => e.node.givenName ?? '')
                )
                expect(isSorted).to.be.true
            }
        })
    })

    context('filtering', () => {
        it('filters all child connections', async () => {
            // add some more users with filter-able names
            for (const org of orgs) {
                for (let i = 0; i < 6; i++) {
                    const user = await createUser({
                        given_name: `user_to_filter_${org.organization_id}_${i}`,
                    }).save()
                    await createOrganizationMembership({
                        user,
                        organization: org,
                    }).save()
                }
            }

            const response = await childConnectionLoader(
                getDataloaderKeys(orgs, {
                    ...args,
                    filter: {
                        givenName: {
                            operator: 'contains',
                            value: 'user_to_filter',
                        },
                    },
                }),
                usersConnectionQuery,
                mapFunc,
                sort,
                scopeArgs
            )
            expect(response).to.have.lengthOf(2)
            for (const orgUsers of response) {
                expect(orgUsers.totalCount).to.eq(6)
                expect(orgUsers.edges).to.have.lengthOf(pageSize)
                for (const userNode of orgUsers.edges) {
                    expect(userNode.node.givenName).to.include('user_to_filter')
                }
            }
        })
    })

    context('error handling', () => {
        it('errors if trying to filter by the parentId', async () => {
            const query = childConnectionLoader(
                getDataloaderKeys(orgs, {
                    ...args,
                    filter: {
                        organizationId: {
                            operator: 'eq',
                            value: orgs[0].organization_id,
                        },
                    },
                }),
                usersConnectionQuery,
                mapFunc,
                sort,
                scopeArgs
            )
            await expect(query).to.be.rejectedWith(
                Error,
                'Cannot filter by parent property organizationId in this child connection.'
            )
        })
        it('returns an empty array if no keys are provided', async () => {
            const result = await childConnectionLoader(
                [],
                usersConnectionQuery,
                mapFunc,
                sort,
                scopeArgs
            )
            expect(result).to.have.lengthOf(0)
        })
        it('handles duplicate keys', async () => {
            const response = await childConnectionLoader(
                getDataloaderKeys([orgs[0], orgs[0]], args),
                usersConnectionQuery,
                mapFunc,
                sort,
                scopeArgs
            )
            expect(response).to.have.lengthOf(2)
        })

        it('deduplicates per parent', async () => {
            const nonAdminUser = await createNonAdminUser(testClient)
            const nonAdminPermissions = new UserPermissions({
                id: nonAdminUser.user_id,
                email: nonAdminUser.email || '',
            })

            const role = await createRole('role', orgs[0], {
                permissions: [
                    PermissionName.view_school_classes_20117,
                    PermissionName.view_classes_20114,
                ],
            }).save()
            await createOrganizationMembership({
                user: nonAdminUser,
                organization: orgs[0],
                roles: [role],
            }).save()

            const org1Schools = [
                await createSchool(orgs[0]).save(),
                await createSchool(orgs[0]).save(),
            ]

            await Promise.all(
                org1Schools.map((s) =>
                    createSchoolMembership({
                        school: s,
                        user: nonAdminUser,
                    }).save()
                )
            )

            await createClass(
                org1Schools,
                orgs[0],
                {
                    teachers: [nonAdminUser],
                },
                'class 1'
            ).save()
            await createClass(
                [],
                orgs[0],
                { teachers: [nonAdminUser] },
                'class 2'
            ).save()

            const keys: IChildConnectionDataloaderKey<Class>[] = [
                {
                    parent: {
                        id: nonAdminUser.user_id,
                        filterKey: 'teacherId',
                        pivot: '"Teacher"."user_id"',
                    },
                    args: {},
                    includeTotalCount: true,
                    primaryColumn: 'class_id',
                },
            ]

            const response = await childConnectionLoader(
                keys,
                classesConnectionQuery,
                mapClassToClassConnectionNode,
                classesConnectionSortingConfig,
                { permissions: nonAdminPermissions, entity: 'class' }
            )

            expect(response).to.have.lengthOf(1)
            expect(response[0].totalCount).to.eq(2)
            expect(response[0].edges).to.have.lengthOf(2)
        })
    })

    context('multiple requests', () => {
        it('identifies separate requests via differing keys and groups accordingly', async () => {
            const request1Keys = getDataloaderKeys([orgs[0]], {
                ...args,
                count: 1,
            })
            const request2Keys = getDataloaderKeys([orgs[0]], {
                ...args,
                count: 2,
            })

            const keys = [...request1Keys, ...request2Keys]
            const response = await childConnectionLoader(
                keys,
                usersConnectionQuery,
                mapFunc,
                sort,
                scopeArgs
            )

            expect(response[0].edges).to.have.lengthOf(1)
            expect(response[1].edges).to.have.lengthOf(2)
        })
    })

    context('system entities', () => {
        let orgAgeRanges: AgeRange[]
        let systemAgeRanges: AgeRange[]
        beforeEach(async () => {
            await new AgeRangesInitializer().run()
            orgAgeRanges = [await createAgeRange(orgs[0]).save()]
            systemAgeRanges = await AgeRange.find({
                where: { system: true },
            })
        })

        function fetchOrgAgeRanges(includeSystemEntities = false) {
            return childConnectionLoader(
                [
                    {
                        args: { count: 50 },
                        includeTotalCount: true,
                        parent: {
                            id: orgs[0].organization_id,
                            filterKey: 'organizationId',
                            pivot: '"Organization"."organization_id"',
                        },
                        primaryColumn: 'id',
                        systemColumn: includeSystemEntities
                            ? 'system'
                            : undefined,
                    },
                ],
                ageRangeConnectionQuery,
                mapAgeRangeToAgeRangeConnectionNode,
                ageRangesConnectionSortingConfig,
                { permissions: adminPermissions, entity: 'ageRange' }
            )
        }
        it('does not return system entities by default', async () => {
            const response = await fetchOrgAgeRanges()
            expect(response).to.have.lengthOf(1)
            expect(response[0].totalCount).to.eq(orgAgeRanges.length)
            expect(
                response[0].edges.map((e) => e.node.id)
            ).to.deep.equalInAnyOrder(orgAgeRanges.map((c) => c.id))
        })
        it('fetches system entities if requested', async () => {
            const response = await fetchOrgAgeRanges(true)
            expect(response).to.have.lengthOf(1)
            expect(response[0].totalCount).to.eq(
                orgAgeRanges.length + systemAgeRanges.length
            )
            expect(
                response[0].edges.map((e) => e.node.id)
            ).to.deep.equalInAnyOrder(
                orgAgeRanges.concat(systemAgeRanges).map((c) => c.id)
            )
        })
    })
})
