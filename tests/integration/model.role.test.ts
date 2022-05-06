import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { Model } from '../../src/model'
import { TestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { Role } from '../../src/entities/role'
import { createRole } from '../factories/role.factory'
import {
    createOrganizationAndValidate,
    userToPayload,
} from '../utils/operations/userOps'
import { createAdminUser, createNonAdminUser } from '../utils/testEntities'
import { User } from '../../src/entities/user'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import {
    generateToken,
    getAdminAuthToken,
    getNonAdminAuthToken,
} from '../utils/testConfig'
import { Organization } from '../../src/entities/organization'
import { School } from '../../src/entities/school'
import { createUsers } from '../factories/user.factory'
import { createOrganization } from '../factories/organization.factory'
import { createSchool } from '../factories/school.factory'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { replaceRole } from '../utils/operations/modelOps'
import { expectAPIError } from '../utils/apiError'
import { Status } from '../../src/entities/status'
import { getRole } from '../utils/operations/roleOps'
import faker from 'faker'

use(chaiAsPromised)

const GET_ROLES = `
    query getRoles {
        roles {
            role_id
            role_name
        }
    }
`

const GET_ROLE = `
    query myQuery($role_id: ID!) {
        role(role_id: $role_id) {
            role_id
            role_name
        }
    }
`

describe('model.role', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    const roleInfo = (role: Role) => {
        return role.role_id
    }

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    describe('#getRoles', () => {
        let organization: Organization
        let systemRoles: Role[]
        beforeEach(async () => {
            systemRoles = await Role.find({
                where: { system_role: true },
            })
        })
        context('when none', () => {
            it('returns only the system roles', async () => {
                await createNonAdminUser(testClient)
                const arbitraryUserToken = getNonAdminAuthToken()

                const { query } = testClient

                const res = await query({
                    query: GET_ROLES,
                    headers: { authorization: arbitraryUserToken },
                })

                expect(res.errors, res.errors?.toString()).to.be.undefined

                const roles = res.data?.roles as Role[]
                expect(roles.map(roleInfo)).to.deep.equalInAnyOrder(
                    systemRoles.map(roleInfo)
                )
            })
        })

        context('when one', () => {
            let arbitraryUserToken: string

            beforeEach(async () => {
                const user = await createAdminUser(testClient)
                organization = await createOrganizationAndValidate(
                    testClient,
                    user.user_id
                )
                await createRole(undefined, organization).save()
                await createNonAdminUser(testClient)
                arbitraryUserToken = getNonAdminAuthToken()
            })

            context('when user does not belong to the org', () => {
                it('should return an array containing just the system roles', async () => {
                    const { query } = testClient

                    const res = await query({
                        query: GET_ROLES,
                        headers: { authorization: arbitraryUserToken },
                    })

                    expect(res.errors, res.errors?.toString()).to.be.undefined
                    const roles = res.data?.roles as Role[]
                    expect(roles).to.exist
                    expect(roles).to.have.lengthOf(systemRoles.length)
                })
            })

            context('when user belongs to the org', () => {
                let user: User
                let role: Role

                beforeEach(async () => {
                    user = await createNonAdminUser(testClient)
                    await createOrganizationMembership({
                        user,
                        organization,
                        roles: [role],
                    }).save()
                })
                it('should return an array containing the system and custom roles belonging to the org', async () => {
                    const { query } = testClient

                    const res = await query({
                        query: GET_ROLES,
                        headers: {
                            authorization: generateToken(userToPayload(user)),
                        },
                    })

                    const dbRoles = await Role.find({
                        where: { system_role: false },
                    })

                    expect(res.errors, res.errors?.toString()).to.be.undefined
                    const roles = res.data?.roles as Role[]
                    expect(roles).to.exist
                    expect(roles).to.have.lengthOf(
                        dbRoles.length + systemRoles.length
                    )
                })
            })
        })
    })

    describe('#getRole', () => {
        let orgOwner: User
        let user: User
        let role: Role
        let organization: Organization
        let token: string

        beforeEach(async () => {
            orgOwner = await createAdminUser(testClient)
            organization = await createOrganization(orgOwner).save()
            user = await createNonAdminUser(testClient)
            token = generateToken(userToPayload(user))
            role = await createRole('role', organization).save()
            await createOrganizationMembership({
                user,
                organization,
                roles: [role],
            }).save()
        })

        context('when user belongs to the org', () => {
            it('should retrieve the expected role', async () => {
                const response = await getRole(testClient, role.role_id, {
                    authorization: token,
                })
                expect(response.role_id).to.equal(role.role_id)
            })
        })

        context('when user does not belong to the org', async () => {
            let anotherOrg: Organization
            let anotherRole: Role

            beforeEach(async () => {
                anotherOrg = await createOrganization().save()
                anotherRole = await createRole(
                    'another role',
                    anotherOrg
                ).save()
            })

            it('should return null', async () => {
                const response = await getRole(
                    testClient,
                    anotherRole.role_id,
                    {
                        authorization: token,
                    }
                )
                expect(response).to.be.a('null')
            })
        })

        context('when the role does not exist', async () => {
            it('should return null', async () => {
                const response = await getRole(
                    testClient,
                    faker.datatype.uuid(),
                    {
                        authorization: token,
                    }
                )
                expect(response).to.be.a('null')
            })
        })
    })

    describe('#replaceRole', () => {
        let organization: Organization
        let otherOrganization: Organization
        let school: School
        let oldRole: Role
        let newRole: Role
        let controlRole: Role
        let defaultRole: Role
        let userOne: User
        let userTwo: User
        let userThree: User

        function runReplaceRole() {
            return replaceRole(
                testClient,
                oldRole.role_id,
                newRole.role_id,
                organization.organization_id,
                {
                    authorization: getAdminAuthToken(),
                }
            )
        }

        async function expectNothingToReplace() {
            const updatedRole = await expect(runReplaceRole()).to.be.fulfilled
            expect(updatedRole).to.be.null
            return updatedRole
        }

        async function expectReplacementSuccess() {
            const updatedRole = await expect(runReplaceRole()).to.be.fulfilled
            expect(updatedRole).to.not.be.null
            return updatedRole
        }

        async function setupOrganisations() {
            const orgOwner = await createAdminUser(testClient)
            organization = createOrganization(orgOwner)
            otherOrganization = createOrganization(orgOwner)
            school = createSchool(organization)
            oldRole = createRole('Old Role', organization)
            newRole = createRole('New Role', organization)
            controlRole = createRole('Control Role', organization)
            defaultRole = createRole('Default Role', undefined)
            defaultRole.system_role = true
            return connection.manager.save([
                organization,
                otherOrganization,
                school,
                oldRole,
                newRole,
                controlRole,
                defaultRole,
            ])
        }

        async function setupMemberships() {
            await setupOrganisations()
            ;[userOne, userTwo, userThree] = await connection.manager.save(
                createUsers(3)
            )

            await connection.manager.save([
                createOrganizationMembership({
                    user: userOne,
                    organization,
                    roles: [oldRole, controlRole],
                }),
                createOrganizationMembership({
                    user: userTwo,
                    organization,
                    roles: [oldRole, newRole, controlRole],
                }),
                createOrganizationMembership({
                    user: userThree,
                    organization,
                    roles: [newRole, controlRole],
                }),
                createSchoolMembership({
                    user: userOne,
                    school,
                    roles: [oldRole, controlRole],
                }),
                createSchoolMembership({
                    user: userTwo,
                    school,
                    roles: [oldRole, newRole, controlRole],
                }),
                createSchoolMembership({
                    user: userThree,
                    school,
                    roles: [newRole, controlRole],
                }),
            ])
        }

        context(
            'when at least one of the roles is a system default role',
            () => {
                beforeEach(async () => await setupMemberships())

                context(
                    'and the old role is a system default role and has no memberships',
                    () => {
                        beforeEach(() => (oldRole = defaultRole))
                        it('completes with no changes', async () =>
                            await expectNothingToReplace())
                    }
                )

                context(
                    'and the old role is a system default role and has memberships',
                    () => {
                        beforeEach(async () => {
                            oldRole.system_role = true
                            await oldRole.save()
                        })
                        it('completes successfully', async () =>
                            await expectReplacementSuccess())
                    }
                )

                context('and the new role is a system default role', () => {
                    beforeEach(async () => (newRole = defaultRole))
                    it('completes successfully', async () =>
                        await expectReplacementSuccess())
                })
            }
        )

        context(
            'when a role is not associated with the right organisation',
            () => {
                beforeEach(async () => await setupOrganisations())

                context(
                    'and the old role belongs to wrong organisation',
                    () => {
                        beforeEach(async () => {
                            oldRole = await createRole(
                                'Old Role',
                                otherOrganization
                            ).save()
                            ;[userOne, userTwo] = await connection.manager.save(
                                createUsers(2)
                            )
                            await connection.manager.save([
                                createOrganizationMembership({
                                    user: userOne,
                                    organization: otherOrganization,
                                    roles: [oldRole],
                                }),
                                createOrganizationMembership({
                                    user: userTwo,
                                    organization,
                                    roles: [newRole],
                                }),
                            ])
                        })
                        it('completes with no changes', async () => {
                            await expectNothingToReplace()
                        })
                    }
                )

                context(
                    'and the new role belongs to wrong organisation',
                    () => {
                        beforeEach(async () => {
                            newRole.organization = Promise.resolve(
                                otherOrganization
                            )
                            await newRole.save()
                        })
                        it('throws an APIError with code ERR_NON_EXISTENT_CHILD_ENTITY', async () => {
                            expectAPIError.nonexistent_child(
                                await expect(runReplaceRole()).to.be.rejected,
                                {
                                    entity: 'Role',
                                    entityName: newRole.role_name || '',
                                    parentEntity: 'Organization',
                                    parentName:
                                        organization.organization_name || '',
                                },
                                ['role_id', 'organization_id']
                            )
                        })
                    }
                )
            }
        )

        context('when the roles belong to the same organisation', () => {
            async function getDbRoles() {
                const oldDbRole = await Role.findOneOrFail({
                    where: { role_id: oldRole.role_id },
                })
                const newDbRole = await Role.findOneOrFail({
                    where: { role_id: newRole.role_id },
                })
                const controlDbRole = await Role.findOneOrFail({
                    where: { role_id: controlRole.role_id },
                })
                return [oldDbRole, newDbRole, controlDbRole]
            }

            async function checkMemberships(
                memberships: OrganizationMembership[] | SchoolMembership[]
            ) {
                expect(memberships).to.be.length(3)
                const userIds = memberships
                    .map(
                        (m: OrganizationMembership | SchoolMembership) =>
                            m.user_id
                    )
                    .sort()
                expect(
                    [userOne.user_id, userTwo.user_id, userThree.user_id]
                        .sort()
                        .every((v, i) => v === userIds.sort()[i])
                ).to.be.true
            }

            async function checkUpdatedRole(
                updatedRole: Role,
                hasSchoolMemberships: boolean
            ) {
                expect(updatedRole.role_id).to.equal(newRole.role_id)
                const updatedRoleOrgMembs = await updatedRole.memberships
                if (!updatedRoleOrgMembs) return expect(false).to.be.true
                await checkMemberships(updatedRoleOrgMembs)
                const updatedRoleSchMembs = await updatedRole.schoolMemberships
                if (!updatedRoleSchMembs)
                    return expect(hasSchoolMemberships).to.be.false
                await checkMemberships(updatedRoleSchMembs)
            }

            beforeEach(async () => {
                await setupMemberships()
            })

            context('and the organisation is active', () => {
                let updatedRole: Role
                beforeEach(async () => {
                    updatedRole = await expectReplacementSuccess()
                })

                it('checks return value is valid', async () => {
                    await checkUpdatedRole(updatedRole, false)
                })
                it('replaces the old role with the new one', async () => {
                    const [oldDbRole, newDbRole] = await getDbRoles()
                    expect(await oldDbRole.memberships).to.be.empty
                    expect(await oldDbRole.schoolMemberships).to.be.empty
                    await checkUpdatedRole(newDbRole, true)
                })
                it('does not leave duplicates in organisations', async () => {
                    const [, newDbRole] = await getDbRoles()
                    const orgMembs = await newDbRole.memberships
                    const uniqueOrgMembs = [...new Set(orgMembs)]
                    expect(orgMembs?.length).to.equal(uniqueOrgMembs.length)
                })
                it('does not leave duplicates in schools', async () => {
                    const [, newDbRole] = await getDbRoles()
                    const schoolMembs = await newDbRole.schoolMemberships
                    const uniqueSchoolMembs = [...new Set(schoolMembs)]
                    expect(schoolMembs?.length).to.equal(
                        uniqueSchoolMembs.length
                    )
                })
                it('does not affect other roles', async () => {
                    const [, , controlDbRole] = await getDbRoles()
                    const orgMembs = await controlDbRole.memberships
                    const schoolMembs = await controlDbRole.schoolMemberships
                    await checkMemberships(orgMembs || [])
                    await checkMemberships(schoolMembs || [])
                })
            })

            context('and the organisation is deactivated', () => {
                beforeEach(async () => {
                    organization.status = Status.INACTIVE
                    await organization.save()
                })

                it('throws an APIError with code ERR_INACTIVE_STATUS', async () => {
                    expectAPIError.inactive_status(
                        await expect(runReplaceRole()).to.be.rejected,
                        {
                            entity: 'Organization',
                            entityName: organization.organization_name || '',
                        },
                        ['organization_id']
                    )
                })
            })
        })
    })
})
