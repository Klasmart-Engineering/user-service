import { expect } from 'chai'
import supertest from 'supertest'
import { Connection } from 'typeorm'
import { AgeRange } from '../../src/entities/ageRange'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import { Program } from '../../src/entities/program'
import AgeRangesInitializer from '../../src/initializers/ageRanges'
import { AgeRangeConnectionNode } from '../../src/types/graphQL/ageRangeConnectionNode'
import { ProgramConnectionNode } from '../../src/types/graphQL/programConnectionNode'
import { loadFixtures } from '../utils/fixtures'
import {
    addProgramsToClass,
    createAgeRanges,
    createClass,
    createOrg,
    createPrograms,
    IAgeRangeDetail,
    IProgramDetail,
} from '../utils/operations/acceptance/acceptanceOps.test'
import { PROGRAMS_CONNECTION } from '../utils/operations/modelOps'
import { getAdminAuthToken } from '../utils/testConfig'
import { createTestConnection } from '../utils/testConnection'

interface IProgramEdge {
    node: ProgramConnectionNode
}

const url = 'http://localhost:8080'
const request = supertest(url)
const user_id = 'c6d4feed-9133-5529-8d72-1003526d1b13'
const org_name = 'my-org'
const programsCount = 12
const ageRangesCount = 6
const classesCount = 2

let classIds: string[] = []
let orgId: string

describe('acceptance.program', () => {
    let connection: Connection

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        classIds = []

        await AgeRangesInitializer.run()
        await loadFixtures('users', connection)

        const ageRangeDetails: IAgeRangeDetail[] = []
        const programDetails: IProgramDetail[] = []

        const createOrg1Response = await createOrg(
            user_id,
            org_name,
            getAdminAuthToken()
        )

        const createOrg1Data =
            createOrg1Response.body.data.user.createOrganization

        orgId = createOrg1Data.organization_id

        for (let i = 0; i < ageRangesCount; i++) {
            const unit = i % 2 === 0 ? AgeRangeUnit.YEAR : AgeRangeUnit.MONTH
            ageRangeDetails.push({
                name: `Age Range ${i + 1}`,
                low_value: i + 1,
                low_value_unit: unit,
                high_value: i + 2,
                high_value_unit: unit,
            })
        }

        await createAgeRanges(orgId, ageRangeDetails, getAdminAuthToken())

        const ageRanges =
            (await connection.manager.find(AgeRange, {
                where: { system: false },
            })) || []

        const ageRangeIds = ageRanges.map((ar) => ar.id)

        for (let i = 0; i < programsCount; i++) {
            const index = i >= ageRangesCount ? i % ageRangesCount : i
            programDetails.push({
                name: `Age Range ${i + 1}`,
                age_ranges: [ageRangeIds[index]],
            })
        }

        const programsResponse = await createPrograms(
            orgId,
            programDetails,
            getAdminAuthToken()
        )

        const programs =
            programsResponse.body.data.organization.createOrUpdatePrograms
        const programIds = programs.map((p: Program) => p.id)

        for (let i = 0; i < classesCount; i++) {
            const classResponse = await createClass(
                orgId,
                `class ${i + 1}`,
                getAdminAuthToken()
            )

            const classId =
                classResponse.body.data.organization.createClass.class_id
            classIds.push(classId)
        }

        for (const classId of classIds) {
            const ids = [programIds[0], programIds[1], programIds[2]]

            await addProgramsToClass(classId, ids, getAdminAuthToken())
        }
    })

    context('programsConnection', () => {
        context('using explict count', async () => {
            async function makeQuery(pageSize: any) {
                return await request
                    .post('/graphql')
                    .set({
                        ContentType: 'application/json',
                        Authorization: getAdminAuthToken(),
                    })
                    .send({
                        query: PROGRAMS_CONNECTION,
                        variables: {
                            direction: 'FORWARD',
                            directionArgs: {
                                count: pageSize,
                            },
                        },
                    })
            }

            it('passes validation', async () => {
                const pageSize = 5

                const response = await makeQuery(pageSize)

                expect(response.status).to.eq(200)
                const programsConnection = response.body.data.programsConnection
                expect(programsConnection.edges.length).to.equal(pageSize)
            })

            it('fails validation', async () => {
                const pageSize = 'not_a_number'

                const response = await makeQuery(pageSize)

                expect(response.status).to.eq(400)
                expect(response.body.errors.length).to.equal(1)
                const message = response.body.errors[0].message
                expect(message)
                    .to.be.a('string')
                    .and.satisfy((msg: string) =>
                        msg.startsWith(
                            'Variable "$directionArgs" got invalid value "not_a_number" at "directionArgs.count"; Expected type "PageSize".'
                        )
                    )
            })
        })
        it('queries paginated programs without filter', async () => {
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: PROGRAMS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                    },
                })

            const programsConnection = response.body.data.programsConnection

            expect(response.status).to.eq(200)
            expect(programsConnection.totalCount).to.equal(12)
        })

        it('queries paginated programs filtering by age range from', async () => {
            const ageRangeValue = {
                value: 4,
                unit: AgeRangeUnit.MONTH,
            }

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: PROGRAMS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            ageRangeFrom: {
                                operator: 'eq',
                                value: ageRangeValue,
                            },
                        },
                    },
                })

            const programsConnection = response.body.data.programsConnection

            expect(response.status).to.eq(200)
            expect(programsConnection.totalCount).to.equal(2)

            const ageRangesValues = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeConnectionNode) => ageRange.lowValue
                    )
                }
            )

            const ageRangesUnits = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeConnectionNode) =>
                            ageRange.lowValueUnit
                    )
                }
            )

            ageRangesValues.every((values: Number[]) =>
                values?.includes(ageRangeValue.value)
            )

            ageRangesUnits.every((units: AgeRangeUnit[]) =>
                units?.includes(ageRangeValue.unit)
            )
        })

        it('queries paginated programs filtering by age range to', async () => {
            const ageRangeValue = {
                value: 4,
                unit: AgeRangeUnit.YEAR,
            }

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: PROGRAMS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            ageRangeTo: {
                                operator: 'eq',
                                value: ageRangeValue,
                            },
                        },
                    },
                })

            const programsConnection = response.body.data.programsConnection

            expect(response.status).to.eq(200)
            expect(programsConnection.totalCount).to.equal(2)

            const ageRangesValues = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeConnectionNode) => ageRange.lowValue
                    )
                }
            )

            const ageRangesUnits = programsConnection.edges.map(
                (edge: IProgramEdge) => {
                    return edge.node.ageRanges?.map(
                        (ageRange: AgeRangeConnectionNode) =>
                            ageRange.lowValueUnit
                    )
                }
            )

            ageRangesValues.every((values: Number[]) =>
                values?.includes(ageRangeValue.value)
            )

            ageRangesUnits.every((units: AgeRangeUnit[]) =>
                units?.includes(ageRangeValue.unit)
            )
        })

        it('queries paginated programs filtering by class ID', async () => {
            const classId = classIds[0]
            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: PROGRAMS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            classId: {
                                operator: 'eq',
                                value: classId,
                            },
                        },
                    },
                })

            const programsConnection = response.body.data.programsConnection

            expect(response.status).to.eq(200)
            expect(programsConnection.totalCount).to.equal(3)
        })

        it('responds with an error if the filter is wrong', async () => {
            const ageRangeValue = {
                value: 'six',
                unit: AgeRangeUnit.YEAR,
            }

            const response = await request
                .post('/graphql')
                .set({
                    ContentType: 'application/json',
                    Authorization: getAdminAuthToken(),
                })
                .send({
                    query: PROGRAMS_CONNECTION,
                    variables: {
                        direction: 'FORWARD',
                        filterArgs: {
                            ageRangeTo: {
                                operator: 'eq',
                                value: ageRangeValue,
                            },
                        },
                    },
                })

            expect(response.status).to.eq(400)
            expect(response.body).to.have.property('errors')
        })
    })

    // context('program.unshare', async () => {
    //     let otherUserId: string
    //     let sharedWithOwner: User
    //     let sharedWithOrganization: Organization
    //     let permissions: UserPermissions
    //     let info = <GraphQLResolveInfo>{
    //         operation: { operation: 'mutation' },
    //     }
    //     let requiredPermissions = [
    //         PermissionName.share_content_282,
    //         PermissionName.edit_program_20331,
    //     ]

    //     beforeEach(async () => {
    //         user = await createNonAdminUser(testClient)
    //         userId = user.user_id

    //         org = createOrganization()
    //         await connection.manager.save(org)
    //         organizationId = org.organization_id
    //         program = createProgram(org)
    //         await connection.manager.save(program)

    //         const otherUser = await createNonAdminUser(testClient)
    //         otherUserId = otherUser.user_id
    //         await addUserToOrganizationAndValidate(
    //             testClient,
    //             otherUserId,
    //             organizationId,
    //             { authorization: getAdminAuthToken() }
    //         )
    //         sharedWithOwner = await createAdminUser(testClient)
    //         sharedWithOrganization = await createOrganizationAndValidate(
    //             testClient,
    //             sharedWithOwner.user_id,
    //             'mcpoopy'
    //         )
    //         permissions = new UserPermissions({
    //             id: user.user_id,
    //             email: user.email || '',
    //         })
    //     })

    //     let makeRole = async (permissions: PermissionName[]) => {
    //         let role = roleFactory.createRole(
    //             undefined,
    //             await program.organization!,
    //             {
    //                 permissions: permissions,
    //             }
    //         )
    //         await role.save()
    //         await createOrganizationMembership({
    //             user,
    //             organization: await program.organization!,
    //             roles: [role],
    //         }).save()
    //     }

    //     let sharing = async (idsToShare: string[]) => {
    //         return program.share(
    //             {
    //                 organizationIds: idsToShare,
    //             },
    //             {
    //                 permissions: permissions,
    //                 loaders: createDefaultDataLoaders(),
    //             },
    //             info
    //         )
    //     }

    //     let unsharing = async (idsToShare: string[]) => {
    //         return program.unshare(
    //             {
    //                 organizationIds: idsToShare,
    //             },
    //             {
    //                 permissions: permissions,
    //                 loaders: createDefaultDataLoaders(),
    //             },
    //             info
    //         )
    //     }

    //     context('and the user has all the permissions', () => {
    //         beforeEach(async () => {
    //             await makeRole(requiredPermissions)
    //         })

    //         it('shares unshares the program', async () => {
    //             await sharing([sharedWithOrganization.organization_id])

    //             let sharedOrgs: string[] = <string[]>(
    //                 await unsharing([sharedWithOrganization.organization_id])
    //             )
    //             expect(sharedOrgs.length).to.eq(0)
    //             let dbProgram = await Program.findOneOrFail(program.id)
    //             let dbSharedWith = (await dbProgram.sharedWith) || []
    //             expect(dbSharedWith.length).to.eq(0)
    //         })
    //     })

    //     context('and the user does not permission', () => {
    //         beforeEach(async () => {
    //             let adminUser = await createAdminUser(testClient)
    //             let adminPermissions = new UserPermissions({
    //                 id: adminUser.user_id,
    //                 email: adminUser.email || '',
    //             })
    //             await program.share(
    //                 {
    //                     organizationIds: [
    //                         sharedWithOrganization.organization_id,
    //                     ],
    //                 },
    //                 {
    //                     permissions: adminPermissions,
    //                     loaders: createDefaultDataLoaders(),
    //                 },
    //                 info
    //             )
    //         })

    //         it('shares to share the program', async () => {
    //             let missingPermissions = [PermissionName.edit_program_20331]
    //             await makeRole(missingPermissions)
    //             let sharedOrgs = unsharing([
    //                 sharedWithOrganization.organization_id,
    //             ])
    //             await expect(sharedOrgs).to.be.rejectedWith('share_content_282')
    //         })
    //         it('shares to edit the program', async () => {
    //             let missingPermissions = [PermissionName.share_content_282]
    //             await makeRole(missingPermissions)
    //             let sharedOrgs = unsharing([
    //                 sharedWithOrganization.organization_id,
    //             ])
    //             await expect(sharedOrgs).to.be.rejectedWith(
    //                 'edit_program_20331'
    //             )
    //         })
    //     })
    // })
})
