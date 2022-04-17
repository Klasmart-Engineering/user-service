import chaiAsPromised from 'chai-as-promised'
import { Equal, getConnection } from 'typeorm'
import { expect, use } from 'chai'
import faker from 'faker'

import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { createClass } from '../../../factories/class.factory'
import { createOrganization } from '../../../factories/organization.factory'
import { createServer } from '../../../../src/utils/createServer'
import { createRole } from '../../../factories/role.factory'
import { createSchool } from '../../../factories/school.factory'
import { TestConnection } from '../../../utils/testConnection'
import { createUser } from '../../../factories/user.factory'
import { generateShortCode } from '../../../../src/utils/shortcode'
import { Class } from '../../../../src/entities/class'
import { User } from '../../../../src/entities/user'
import { UserRow } from '../../../../src/types/csv/userRow'
import { Model } from '../../../../src/model'
import { Organization } from '../../../../src/entities/organization'
import { OrganizationMembership } from '../../../../src/entities/organizationMembership'
import { Role } from '../../../../src/entities/role'
import { School } from '../../../../src/entities/school'
import { SchoolMembership } from '../../../../src/entities/schoolMembership'
import { processUserFromCSVRows } from '../../../../src/utils/csv/user'
import { CSVError } from '../../../../src/types/csv/csvError'
import {
    createNonAdminUser,
    createAdminUser,
} from '../../../utils/testEntities'
import {
    customErrors,
    getCustomErrorMessageVariables,
} from '../../../../src/types/errors/customError'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import {
    addOrganizationToUserAndValidate,
    userToPayload,
} from '../../../utils/operations/userOps'
import { getAdminAuthToken } from '../../../utils/testConfig'
import { addRoleToOrganizationMembership } from '../../../utils/operations/organizationMembershipOps'
import { grantPermission } from '../../../utils/operations/roleOps'
import { PermissionName } from '../../../../src/permissions/permissionNames'
import { normalizedLowercaseTrimmed } from '../../../../src/utils/clean'
import { pick } from 'lodash'
import { config } from '../../../../src/config/config'
import { QueryResultCache } from '../../../../src/utils/csv/csvUtils'
import { objectToKey } from '../../../../src/utils/stringUtils'
import { createOrganizationMembership } from '../../../factories/organizationMembership.factory'

use(chaiAsPromised)

describe('processUserFromCSVRow', async () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let cls: Class
    let row: UserRow
    let user: User
    let organization: Organization
    let role: Role
    let school: School
    let adminUser: User
    let adminPermissions: UserPermissions
    let nonAdminUser: User
    let queryResultCache: QueryResultCache

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    beforeEach(async () => {
        adminUser = await createAdminUser(testClient)
        nonAdminUser = await createNonAdminUser(testClient)
        user = createUser()
        organization = createOrganization()
        await connection.manager.save(organization)
        school = createSchool(organization)
        await connection.manager.save(school)
        role = createRole(undefined, organization)
        await connection.manager.save(role)
        cls = createClass([school], organization)
        await connection.manager.save(cls)

        await addOrganizationToUserAndValidate(
            testClient,
            adminUser.user_id,
            organization.organization_id,
            getAdminAuthToken()
        )

        adminPermissions = new UserPermissions({
            id: adminUser.user_id,
            email: adminUser.email || '',
        })

        await grantPermission(
            testClient,
            role.role_id,
            PermissionName.upload_users_40880,
            { authorization: getAdminAuthToken() }
        )

        await grantPermission(
            testClient,
            role.role_id,
            PermissionName.attend_live_class_as_a_student_187,
            { authorization: getAdminAuthToken() }
        )

        row = {
            organization_name: organization.organization_name || '',
            user_given_name: user.given_name || '',
            user_family_name: user.family_name || '',
            user_shortcode: generateShortCode(),
            user_email: user.email || '',
            user_date_of_birth: user.date_of_birth || '',
            user_gender: user.gender || '',
            user_alternate_email: user.alternate_email || '',
            user_alternate_phone: user.alternate_phone || '',
            organization_role_name: role.role_name || '',
            school_name: school.school_name || '',
            class_name: cls.class_name || '',
        }

        queryResultCache = new QueryResultCache()
    })

    async function assignUploadPermission(
        userId: string,
        organizationId: string,
        roleId: string
    ) {
        await addOrganizationToUserAndValidate(
            testClient,
            userId,
            organizationId,
            getAdminAuthToken()
        )
        await addRoleToOrganizationMembership(
            testClient,
            userId,
            organizationId,
            roleId,
            { authorization: getAdminAuthToken() }
        )
    }

    it("doesn't save the user if validation fails", async () => {
        row.user_email = 'abc'
        const rowErrors = await processUserFromCSVRows(
            connection.manager,
            [row],
            1,
            [],
            adminPermissions,
            queryResultCache
        )

        const dbUser = await User.findOne({
            where: { email: normalizedLowercaseTrimmed(row.user_email) },
        })

        expect(dbUser).to.be.null
    })

    context('org permissions', () => {
        async function processUsers() {
            return await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                new UserPermissions({
                    id: nonAdminUser.user_id,
                    email: nonAdminUser.email || '',
                }),
                queryResultCache
            )
        }
        context('organization does not exist', () => {
            it('errors with nonexistent_entity', async () => {
                row.organization_name = 'Non-existent org'
                const rowErrors = await processUsers()
                const err = rowErrors[0]
                expect(err.code).to.eq(customErrors.nonexistent_entity.code)
            })

            it('query result cache is not updated with invalid org name', async () => {
                row.organization_name = 'Non-existent org'
                const _ = await processUsers()
                expect(queryResultCache.validatedOrgs.size).to.equal(0)
            })
        })
        context('org exists but user is not a member', () => {
            it('errors with nonexistent_entity', async () => {
                const rowErrors = await processUsers()
                const err = rowErrors[0]
                expect(err.code).to.eq(customErrors.nonexistent_entity.code)
            })
            it('query result cache is not updated with invalid org name', async () => {
                const _ = await processUsers()
                expect(queryResultCache.validatedOrgs.size).to.equal(0)
            })
        })
        context(
            "user is a member but doesn't have upload_users_40880 permission",
            () => {
                it('errors with unauthorized_org_upload and cache is not updated', async () => {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        nonAdminUser.user_id,
                        organization.organization_id,
                        getAdminAuthToken()
                    )
                    const rowErrors = await processUsers()
                    const err = rowErrors[0]
                    expect(err.code).to.eq(
                        customErrors.unauthorized_org_upload.code
                    )
                    expect(err.entity).to.eq('user')
                    expect(err.organizationName).to.eq(row.organization_name)
                    expect(err.column).to.eq('organization_name')
                    for (const v of getCustomErrorMessageVariables(
                        err.message
                    )) {
                        expect(err[v]).to.exist
                    }
                    expect(queryResultCache.validatedOrgs.size).to.equal(0)
                })
            }
        )
        context(
            'user is a member and has upload_users_40880 permission',
            () => {
                it('does not error and updates cache with valid org (by proxy of validated org name and permission)', async () => {
                    await assignUploadPermission(
                        nonAdminUser.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                    const rowErrors = await processUsers()
                    expect(rowErrors).to.be.empty
                    expect(
                        queryResultCache.validatedOrgs.get(
                            row.organization_name
                        )?.organization_id
                    ).to.equal(organization.organization_id)
                })
            }
        )

        context('when there a multiple orgs with the same name', () => {
            let anotherOrg: Organization
            let anotherRole: Role
            beforeEach(async () => {
                anotherOrg = createOrganization()
                anotherOrg.organization_name = organization.organization_name
                await anotherOrg.save()

                anotherRole = createRole(undefined, anotherOrg)
                await connection.manager.save(anotherRole)

                await grantPermission(
                    testClient,
                    anotherRole.role_id,
                    PermissionName.upload_users_40880,
                    { authorization: getAdminAuthToken() }
                )
            })

            it('will not error if the user is a member of at least one with correct permissions', async () => {
                await assignUploadPermission(
                    nonAdminUser.user_id,
                    anotherOrg.organization_id,
                    anotherRole.role_id
                )
                row.organization_role_name = anotherRole.role_name || ''
                row.school_name = undefined
                row.class_name = undefined

                const rowErrors = await processUsers()
                expect(rowErrors).to.be.empty
            })
        })
    })

    context('organization name', () => {
        let err: CSVError
        let rowErrors: CSVError[]
        afterEach(() => {
            expect(rowErrors.length).to.eq(1)
            expect(err.entity).to.eq('Organization')
            expect(err.attribute).to.eq('Name')
            expect(err.column).to.eq('organization_name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when missing', async () => {
            ;(row as any).organization_name = null
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
            expect(queryResultCache.validatedOrgs.size).to.equal(0)
        })
        it('errors when blank', async () => {
            row.organization_name = ''
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
            expect(queryResultCache.validatedOrgs.size).to.equal(0)
        })
        it('errors when too long', async () => {
            row.organization_name = 'a'.repeat(
                config.limits.ORGANIZATION_NAME_MAX_LENGTH + 1
            )
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]

            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(config.limits.ORGANIZATION_NAME_MAX_LENGTH)
            expect((err as any).value).to.eq(row.organization_name)
            expect(queryResultCache.validatedOrgs.size).to.equal(0)
        })
        it("errors when doesn't exist", async () => {
            row.organization_name = 'None Existing Org'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_entity.code)
            expect(queryResultCache.validatedOrgs.size).to.equal(0)
        })
    })

    context('user given name', () => {
        let err: CSVError
        let rowErrors: CSVError[]
        afterEach(() => {
            expect(rowErrors.length).to.eq(1)
            expect(err.column).to.eq('user_given_name')
            expect(err.entity).to.eq('User')
            expect(err.attribute).to.eq('Given Name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when missing', async () => {
            ;(row as any).user_given_name = null
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.user_given_name = ''
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too long', async () => {
            row.user_given_name = 'a'.repeat(
                config.limits.USER_GIVEN_NAME_MAX_LENGTH + 1
            )
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(config.limits.USER_GIVEN_NAME_MAX_LENGTH)
        })
        it('errors when invalid characters', async () => {
            row.user_given_name = '(ben)'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            err = rowErrors[0]
            expect(rowErrors.length).to.eq(1)
            expect(err.code).to.eq(
                customErrors.invalid_alphanumeric_special.code
            )
        })
        it('omits given_name in error properties', async () => {
            ;(row as any).user_given_name = '🐮'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors.length).to.eq(1)
            expect((rowErrors[0] as any).value).to.be.undefined
        })
    })

    context('user family name', () => {
        let err: CSVError
        let rowErrors: CSVError[]
        afterEach(() => {
            expect(rowErrors.length).to.eq(1)
            expect(err.column).to.eq('user_family_name')
            expect(err.entity).to.eq('User')
            expect(err.attribute).to.eq('Family Name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when missing', async () => {
            ;(row as any).user_family_name = null
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.user_family_name = ''
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too long', async () => {
            row.user_family_name = 'a'.repeat(
                config.limits.USER_FAMILY_NAME_MAX_LENGTH + 1
            )
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            const err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(config.limits.USER_FAMILY_NAME_MAX_LENGTH)
        })
        it('errors when invalid characters', async () => {
            row.user_family_name = '(ben)'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.invalid_alphanumeric_special.code
            )
        })
        it('omits family_name in error properties', async () => {
            ;(row as any).user_family_name = '🐮'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors.length).to.eq(1)
            expect((rowErrors[0] as any).value).to.be.undefined
        })
    })

    context('user date of birth', () => {
        it('error when invalid format', async () => {
            for (const date_of_birth of [
                '01-01-2020',
                '01/2020',
                '2020-01',
                '01/01/2020',
            ]) {
                row.user_date_of_birth = date_of_birth
                const rowErrors: CSVError[] = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )

                const err = rowErrors[0]
                expect(rowErrors.length).to.eq(1)
                expect(err.column).to.eq('user_date_of_birth')
                expect(err.entity).to.eq('User')
                expect(err.attribute).to.eq('date of birth')
                expect(err.format).to.eq('MM-YYYY')
                expect(err.code).to.eq(customErrors.invalid_date.code)
                expect((err as any).value).to.eq(row.user_date_of_birth)
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })
    })

    context('username', () => {
        let rowErrors: CSVError[]
        let err: CSVError
        afterEach(() => {
            if (err) {
                expect(err.column).to.eq('user_username')
                expect(err.entity).to.eq('User')
                expect(err.attribute).to.eq('Username')
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })
        it('is not required if phone is provided', async () => {
            ;(row as any).user_username = null
            ;(row as any).user_email = null
            row.user_phone = '+4400000000000'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors).to.be.empty
        })
        it('is not required if email is provided', async () => {
            ;(row as any).user_username = null
            ;(row as any).user_phone = null
            row.user_email = 'something@somewhere.com'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors).to.be.empty
        })
        it('errors when username, email and phone are missing', async () => {
            ;(row as any).user_username = null
            ;(row as any).user_phone = null
            ;(row as any).user_email = null
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(rowErrors.length).to.eq(1)
            expect(err.code).to.eq(customErrors.missing_required_either.code)
        })
        it('errors when too long', async () => {
            ;(row as any).user_username = 'a'.repeat(
                config.limits.USERNAME_MAX_LENGTH + 1
            )
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]

            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(config.limits.USERNAME_MAX_LENGTH)
            expect(queryResultCache.validatedOrgs.size).to.equal(0)
        })
        it('errors with ERR_INVALID_USERNAME when the regex fails', async () => {
            ;(row as any).user_username = '🐮'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(rowErrors.length).to.eq(1)
            expect(err.code).to.eq(customErrors.invalid_username.code)
        })
        it('allows underscores', async () => {
            ;(row as any).user_username = 'p_user_name'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors).to.be.empty
        })
        it('omits username in error properties', async () => {
            ;(row as any).user_username = '🐮'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors.length).to.eq(1)
            expect((rowErrors[0] as any).value).to.be.undefined
        })
    })

    context('user gender', () => {
        let err: CSVError
        let rowErrors: CSVError[]
        afterEach(() => {
            expect(rowErrors.length).to.eq(1)
            expect(err.column).to.eq('user_gender')
            expect(err.entity).to.eq('User')
            expect(err.attribute).to.eq('Gender')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when missing', async () => {
            ;(row as any).user_gender = null
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.user_gender = ''
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too short', async () => {
            row.user_gender = 'a'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_min_length.code)
        })
        it('errors when too long', async () => {
            row.user_gender = 'a'.repeat(config.limits.GENDER_MAX_LENGTH + 1)
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(config.limits.GENDER_MAX_LENGTH)
        })
        it('errors when invalid characters', async () => {
            row.user_gender = '(ben)'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.invalid_alphanumeric_special.code
            )
            expect((err as any).value).to.eq(row.user_gender)
        })
    })

    context('email', () => {
        let rowErrors: CSVError[]
        let err: CSVError

        afterEach(() => {
            if (err) {
                expect(err.column).to.eq('user_email')
                expect(err.entity).to.eq('User')
                expect(err.attribute).to.eq('Email')
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })

        it('is not required if phone is provided', async () => {
            ;(row as any).user_email = null
            row.user_phone = '+4400000000000'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors).to.be.empty
        })
        it('errors when too long', async () => {
            row.user_email =
                'a'.repeat(config.limits.EMAIL_MAX_LENGTH + 1) + '@x.com'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(rowErrors.length).to.eq(1)
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(config.limits.EMAIL_MAX_LENGTH)
        })
        it('errors when invalid', async () => {
            for (const email of [
                'no.at.symbol.com',
                'with space@gmail.com',
                'ih@vetwo@symbols.com',
            ]) {
                rowErrors = []
                row.user_email = email
                rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )
                err = rowErrors[0]
                expect(rowErrors.length).to.eq(1)
                expect(err.code).to.eq(customErrors.invalid_email.code)
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })
        it('is preprocessed before saving', async () => {
            const unprocessedEmail = 'ABC@gmail.com'
            const processedEmail = normalizedLowercaseTrimmed(unprocessedEmail)
            row.user_email = unprocessedEmail

            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors).to.be.empty

            const dbUser = await User.findOneOrFail({
                where: { email: processedEmail },
            })
            expect(dbUser.email).to.eq(processedEmail)
        })
        // even though we now save emails in lowercase we have existing
        // data stored in mixed case that should be found in a search
        it('supports mixed case in search', async () => {
            adminUser.email = 'ABC@gmail.com'
            adminUser.given_name = row.user_given_name
            adminUser.family_name = row.user_family_name
            await connection.manager.save(User, adminUser)

            row.user_email = adminUser.email

            await assignUploadPermission(
                adminUser.user_id,
                organization.organization_id,
                role.role_id
            )

            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors).to.be.empty

            const dbUsers = await User.find({
                where: [{ email: row.user_email }, { email: adminUser.email }],
            })
            expect(dbUsers.length).to.eq(1)
        })
        it('omits user_email in error properties', async () => {
            ;(row as any).user_email = '🐮'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors.length).to.eq(1)
            expect((rowErrors[0] as any).value).to.be.undefined
        })
    })

    context('user phone', () => {
        it('errors when invalid', async () => {
            for (const phone of [
                '1',
                'ph0n3numb3r',
                '+521234567891011121314151617181920',
            ]) {
                row.user_phone = phone
                const rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )
                const err = rowErrors[0]
                expect(rowErrors.length).to.eq(1)
                expect(err.column).to.eq('user_phone')
                expect(err.entity).to.eq('User')
                expect(err.attribute).to.eq('Phone')
                expect(err.code).to.eq(customErrors.invalid_phone.code)
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })
        it('omits user_phone in error properties', async () => {
            ;(row as any).user_phone = '🐮'
            const rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors.length).to.eq(1)
            expect((rowErrors[0] as any).value).to.be.undefined
        })
    })

    context('alternate_email', () => {
        let rowErrors: CSVError[]
        let err: CSVError
        afterEach(() => {
            if (err) {
                expect(err.column).to.eq('user_alternate_email')
                expect(err.entity).to.eq('User')
                expect(err.attribute).to.eq('Alternate email')
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })
        it('errors when too long', async () => {
            row.user_alternate_email =
                'a'.repeat(config.limits.EMAIL_MAX_LENGTH + 1) + '@x.com'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(rowErrors.length).to.eq(1)
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(config.limits.EMAIL_MAX_LENGTH)
        })
        it('errors when invalid', async () => {
            for (const email of [
                'no.at.symbol.com',
                'with space@gmail.com',
                'ih@vetwo@symbols.com',
            ]) {
                rowErrors = []
                row.user_alternate_email = email
                rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )
                err = rowErrors[0]
                expect(rowErrors.length).to.eq(1)
                expect(err.code).to.eq(customErrors.invalid_email.code)
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })
        it('is preprocessed before saving', async () => {
            const unprocessedEmail = 'ABC@gmail.com'
            const processedEmail = normalizedLowercaseTrimmed(unprocessedEmail)
            row.user_alternate_email = unprocessedEmail

            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors).to.be.empty

            const dbUser = await User.findOneOrFail({
                where: { alternate_email: processedEmail },
            })
            expect(dbUser.alternate_email).to.eq(processedEmail)
        })
        it('omits alternate_email in error properties', async () => {
            ;(row as any).user_alternate_email = '🐮'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors.length).to.eq(1)
            expect((rowErrors[0] as any).value).to.be.undefined
        })
    })

    context('user alternate phone', () => {
        it('errors when invalid', async () => {
            for (const phone of [
                '1',
                'ph0n3numb3r',
                '+521234567891011121314151617181920',
            ]) {
                row.user_alternate_phone = phone
                const rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )
                const err = rowErrors[0]
                expect(rowErrors.length).to.eq(1)
                expect(err.column).to.eq('user_alternate_phone')
                expect(err.entity).to.eq('User')
                expect(err.attribute).to.eq('Alternate phone')
                expect(err.code).to.eq(customErrors.invalid_phone.code)
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })
        it('omits alternate_phone in error properties', async () => {
            ;(row as any).user_alternate_phone = '🐮'
            const rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            expect(rowErrors.length).to.eq(1)
            expect((rowErrors[0] as any).value).to.be.undefined
        })
    })

    context('user shortcode', () => {
        let err: CSVError
        let rowErrors: CSVError[]
        afterEach(() => {
            expect(rowErrors.length).to.eq(1)
            expect(err.column).to.eq('user_shortcode')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when too long', async () => {
            row.user_shortcode = 'a'.repeat(
                config.limits.SHORTCODE_MAX_LENGTH + 1
            )
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(config.limits.SHORTCODE_MAX_LENGTH)
            expect(err.entity).to.eq('User')
            expect(err.attribute).to.eq('Short Code')
        })
        it('errors when not alphanumeric', async () => {
            for (const shortcode of ['de/f', '$abc', '@1234']) {
                rowErrors = []
                row.user_shortcode = shortcode
                rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )
                err = rowErrors[0]
                expect(err.code).to.eq(customErrors.invalid_alphanumeric.code)
                expect(err.entity).to.eq('User')
                expect(err.attribute).to.eq('Short Code')
                expect((err as any).value).to.eq(row.user_shortcode)
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })
        it('errors when already exists in another user in the same organization', async () => {
            const existentUser = await createNonAdminUser(testClient)
            const orgMembership = new OrganizationMembership()
            orgMembership.organization_id = organization.organization_id
            orgMembership.organization = Promise.resolve(organization)
            orgMembership.user_id = existentUser.user_id
            orgMembership.user = Promise.resolve(existentUser)
            orgMembership.shortcode = generateShortCode(
                existentUser.user_id,
                config.limits.SHORTCODE_MAX_LENGTH
            )
            await orgMembership.save()

            row.user_shortcode = orgMembership.shortcode

            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.existent_entity.code)
            expect(err.entity).to.eq('Short Code')
            expect(err.entityName).to.eq(row.user_shortcode)
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
    })

    context('organization role', () => {
        let err: CSVError
        let rowErrors: CSVError[]
        afterEach(() => {
            expect(rowErrors.length).to.eq(1)
            expect(err.column).to.eq('organization_role_name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when missing', async () => {
            ;(row as any).organization_role_name = null
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
            expect(queryResultCache.validatedOrgRoles.size).to.equal(0)
        })
        it('errors when blank', async () => {
            row.organization_role_name = ''
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
            expect(err.entity).to.eq('Organization')
            expect(err.attribute).to.eq('Role')
            expect(queryResultCache.validatedOrgRoles.size).to.equal(0)
        })
        it('errors when too long', async () => {
            row.organization_role_name = 'a'.repeat(
                config.limits.ROLE_NAME_MAX_LENGTH + 1
            )
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(config.limits.ROLE_NAME_MAX_LENGTH)
            expect(err.entity).to.eq('Organization')
            expect(err.attribute).to.eq('Role')
            expect((err as any).value).to.eq(row.organization_role_name)
            expect(queryResultCache.validatedOrgRoles.size).to.equal(0)
        })
        it('errors when nonexistent', async () => {
            row.organization_role_name = 'Non existing role'
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_child.code)
            expect(err.entity).to.eq('Organization Role')
            expect(err.entityName).to.eq(row.organization_role_name)
            expect(err.parentEntity).to.eq('Organization')
            expect(err.parentName).to.eq(row.organization_name)
            expect(queryResultCache.validatedOrgRoles.size).to.equal(0)
        })
    })

    context('school name', () => {
        let err: CSVError
        let rowErrors: CSVError[]

        describe('error behaviour', () => {
            afterEach(() => {
                expect(rowErrors.length).to.eq(1)
                expect(err.column).to.eq('school_name')
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            })
            it('errors when too long', async () => {
                row.school_name = 'a'.repeat(
                    config.limits.SCHOOL_NAME_MAX_LENGTH + 1
                )
                rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )

                err = rowErrors[0]
                expect(err.code).to.eq(customErrors.invalid_max_length.code)
                expect(err.max).to.eq(config.limits.SCHOOL_NAME_MAX_LENGTH)
                expect(err.entity).to.eq('School')
                expect(err.attribute).to.eq('Name')
                expect((err as any).value).to.eq(row.school_name)
                expect(queryResultCache.validatedSchools.size).to.equal(0)
            })
            it('errors when doesnt exist', async () => {
                row.school_name = 'Non existing school'
                row.class_name = undefined
                rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )

                err = rowErrors[0]
                expect(err.code).to.eq(customErrors.nonexistent_child.code)
                expect(err.entity).to.eq('School')
                expect(err.entityName).to.eq(row.school_name)
                expect(err.parentEntity).to.eq('Organization')
                expect(err.parentName).to.eq(row.organization_name)
                expect(queryResultCache.validatedSchools.size).to.equal(0)
            })

            it('errors when school is in wrong organization', async () => {
                const wrongOrganization = createOrganization()
                await connection.manager.save(wrongOrganization)
                const wrongSchool = createSchool(wrongOrganization)
                await connection.manager.save(wrongSchool)

                row.school_name = wrongSchool.school_name
                rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )

                err = rowErrors[0]
                expect(err.code).to.eq(customErrors.nonexistent_child.code)
                expect(err.entity).to.eq('School')
                expect(err.entityName).to.eq(row.school_name)
                expect(err.parentEntity).to.eq('Organization')
                expect(err.parentName).to.eq(row.organization_name)
                expect(queryResultCache.validatedSchools.size).to.equal(0)
            })
        })

        it('should be stored with its org in cache separately if multiple orgs have same school name', async () => {
            const organization2 = createOrganization()
            await connection.manager.save(organization2)
            const school2 = createSchool(organization2)
            school2.school_name = school.school_name // Both schools in different orgs have same name
            await connection.manager.save(school2)
            const role2 = createRole(undefined, organization2)
            await connection.manager.save(role2)

            await addOrganizationToUserAndValidate(
                testClient,
                adminUser.user_id,
                organization2.organization_id,
                getAdminAuthToken()
            )
            await grantPermission(
                testClient,
                role2.role_id,
                PermissionName.upload_users_40880,
                { authorization: getAdminAuthToken() }
            )
            await grantPermission(
                testClient,
                role2.role_id,
                PermissionName.attend_live_class_as_a_student_187,
                { authorization: getAdminAuthToken() }
            )

            const row2: UserRow = {
                organization_name: organization2.organization_name || '', // Different org in this row
                user_given_name: user.given_name || '',
                user_family_name: user.family_name || '',
                user_shortcode: generateShortCode(),
                user_email: user.email || '',
                user_date_of_birth: user.date_of_birth || '',
                user_gender: user.gender || '',
                user_alternate_email: user.alternate_email || '',
                user_alternate_phone: user.alternate_phone || '',
                organization_role_name: role2.role_name || '',
                school_name: school2.school_name || '', // School 2 name == school 1 name
                class_name: cls.class_name || '',
            }

            // Run multiple rows to update query result cache
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row2],
                2,
                [],
                adminPermissions,
                queryResultCache
            )

            expect(queryResultCache.validatedSchools.size).to.eq(2)
        })
    })

    it(`does not validate school_role_name column`, async () => {
        // Fix for UD-738, which removes `school_role_name` handling added on original story KL-4408
        const rowErrors = await processUserFromCSVRows(
            connection.manager,
            [{ ...row, school_role_name: `Nonexistant Role` } as UserRow],
            1,
            [],
            adminPermissions,
            queryResultCache
        )

        expect(rowErrors).to.be.empty
    })

    context('class name', () => {
        let err: CSVError
        let rowErrors: CSVError[]

        describe('error behaviour', () => {
            afterEach(() => {
                expect(rowErrors.length).to.eq(1)
                expect(err.column).to.eq('class_name')
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            })
            it('errors when too long', async () => {
                row.class_name = 'a'.repeat(
                    config.limits.CLASS_NAME_MAX_LENGTH + 1
                )
                rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )

                err = rowErrors[0]
                expect(err.code).to.eq(customErrors.invalid_max_length.code)
                expect(err.max).to.eq(config.limits.CLASS_NAME_MAX_LENGTH)
                expect(err.entity).to.eq('Class')
                expect(err.attribute).to.eq('Name')
                expect((err as any).value).to.eq(row.class_name)
                expect(queryResultCache.validatedClasses.size).to.equal(0)
            })
            it('errors when doesnt exist', async () => {
                row.class_name = 'Non existing class'
                rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )

                err = rowErrors[0]
                expect(err.code).to.eq(customErrors.nonexistent_child.code)
                expect(err.entity).to.eq('Class')
                expect(err.entityName).to.eq(row.class_name)
                expect(err.parentEntity).to.eq('School')
                expect(err.parentName).to.eq(row.school_name)
                expect(queryResultCache.validatedClasses.size).to.equal(0)
            })
            it('errors when class is assigned to a school and school is missing', async () => {
                row.school_name = undefined
                rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )

                err = rowErrors[0]
                expect(err.code).to.eq(customErrors.nonexistent_child.code)
                expect(err.entity).to.eq('Class')
                expect(err.entityName).to.eq(row.class_name)
                expect(err.parentEntity).to.eq('School')
                expect(err.parentName).to.eq('')
                expect(queryResultCache.validatedClasses.size).to.equal(0)
            })
        })

        it('should be stored with its org/school in cache separately if multiple orgs/schools have same class name', async () => {
            const organization2 = createOrganization()
            await connection.manager.save(organization2)
            const school2 = createSchool(organization2)
            await connection.manager.save(school2)
            const role2 = createRole(undefined, organization2)
            await connection.manager.save(role2)
            const class2 = createClass([school2], organization2)
            class2.class_name = cls.class_name // Same class name for class in different school + org
            await connection.manager.save(class2)

            await addOrganizationToUserAndValidate(
                testClient,
                adminUser.user_id,
                organization2.organization_id,
                getAdminAuthToken()
            )
            await grantPermission(
                testClient,
                role2.role_id,
                PermissionName.upload_users_40880,
                { authorization: getAdminAuthToken() }
            )
            await grantPermission(
                testClient,
                role2.role_id,
                PermissionName.attend_live_class_as_a_student_187,
                { authorization: getAdminAuthToken() }
            )

            const row2: UserRow = {
                organization_name: organization2.organization_name || '', // Different org in this row
                user_given_name: user.given_name || '',
                user_family_name: user.family_name || '',
                user_shortcode: generateShortCode(),
                user_email: user.email || '',
                user_date_of_birth: user.date_of_birth || '',
                user_gender: user.gender || '',
                user_alternate_email: user.alternate_email || '',
                user_alternate_phone: user.alternate_phone || '',
                organization_role_name: role2.role_name || '',
                school_name: school2.school_name || '', // School 2 name == school 1 name
                class_name: class2.class_name || '',
            }

            // Run multiple rows to update query result cache
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )
            rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row2],
                2,
                [],
                adminPermissions,
                queryResultCache
            )

            expect(queryResultCache.validatedClasses.size).to.eq(2)
        })
    })

    context('when all the data is correct', () => {
        const roleInfo = (role: Role) => {
            return role.role_id
        }
        const userInfo = (user: User) => {
            return user.user_id
        }

        async function createRoleForUser(
            roleName: string,
            permissions: PermissionName[] | undefined
        ) {
            role = createRole(roleName, organization, { permissions })
            await connection.manager.save(role)
            row.organization_role_name = role?.role_name || ''
        }

        const processRow = async () =>
            processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

        async function processAndReturnUser(expectedErrorCode = '') {
            const rowErrors = await processRow()
            if (expectedErrorCode) {
                expect(rowErrors.length).to.eq(1)
                expect(rowErrors[0].code).to.eq(expectedErrorCode)
            } else expect(rowErrors).to.be.empty
            return User.findOneOrFail({
                where: {
                    email: normalizedLowercaseTrimmed(row.user_email),
                },
            })
        }

        async function userInClass(
            user: User,
            asStudent: boolean,
            asTeacher: boolean
        ) {
            const students = (await cls.students) || []
            const teachers = (await cls.teachers) || []

            if (asStudent) {
                expect(students.map(userInfo)).to.deep.eq([user].map(userInfo))
            } else expect(students).to.be.empty

            if (asTeacher) {
                expect(teachers.map(userInfo)).to.deep.eq([user].map(userInfo))
            } else expect(teachers).to.be.empty
        }

        it('creates the user and its respective links', async () => {
            const rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            const dbUser = await User.findOneByOrFail({
                email: normalizedLowercaseTrimmed(row.user_email),
            })

            expect(dbUser.user_id).to.not.be.empty
            expect(dbUser.email).to.eq(row.user_email)
            expect(dbUser.phone).to.be.null
            expect(dbUser.given_name).to.eq(row.user_given_name)
            expect(dbUser.family_name).to.eq(row.user_family_name)
            expect(dbUser.date_of_birth).to.eq(row.user_date_of_birth)
            expect(dbUser.gender).to.eq(row.user_gender)

            const orgMembership = await OrganizationMembership.findOneByOrFail({
                user: { user_id: dbUser.user_id },
                organization: Equal(organization),
            })

            expect(orgMembership.shortcode).to.eq(row.user_shortcode)

            const orgRoles = (await orgMembership.roles) || []
            expect(orgRoles.map(roleInfo)).to.deep.eq([role].map(roleInfo))

            const schoolMembership = await SchoolMembership.findOneByOrFail({
                user: { user_id: dbUser.user_id },
                school: Equal(school),
            })

            const schoolRoles = (await schoolMembership.roles) || []
            expect(schoolRoles).to.deep.eq([])
        })

        it('it does not update SchoolMembership.roles based on `school_role_name` column', async () => {
            // Fix for UD-738, which removes `school_role_name` handling added on original story KL-4408
            const rowErrors = await processUserFromCSVRows(
                connection.manager,
                [{ ...row, school_role_name: role.role_name } as UserRow],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            const dbUser = await User.findOneOrFail({
                where: { email: normalizedLowercaseTrimmed(row.user_email) },
            })

            const [schoolMembership] = await SchoolMembership.find({
                relations: [`roles`],
                where: { user: Equal(dbUser), school: Equal(school) },
            })
            expect(await schoolMembership.roles).to.deep.eq([])
        })
        it('creates the user if class is not in a school', async () => {
            row.school_name = undefined
            const cls2 = createClass([], organization)
            await connection.manager.save(cls2)
            row.class_name = cls2.class_name
            const rowErrors = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            expect(rowErrors).to.be.empty

            const dbUser = await User.findOneOrFail({
                where: { email: normalizedLowercaseTrimmed(row.user_email) },
            })

            expect(dbUser.user_id).to.not.be.empty
            expect((await cls2.students)?.map(userInfo)).to.deep.equal(
                [userInfo(dbUser)],
                'User is added to the Class as a Student'
            )
        })

        it('it does not update SchoolMembership.roles based on `school_role_name` column', async () => {
            // Fix for UD-738, which removes `school_role_name` handling added on original story KL-4408
            const rowErrors = await processUserFromCSVRows(
                connection.manager,
                [{ ...row, school_role_name: role.role_name } as UserRow],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            const dbUser = await User.findOneOrFail({
                where: { email: normalizedLowercaseTrimmed(row.user_email) },
            })

            const [schoolMembership] = await SchoolMembership.find({
                relations: [`roles`],
                where: { user: Equal(dbUser), school: Equal(school) },
            })
            expect(await schoolMembership.roles).to.deep.eq([])
        })

        it('the query result cache updates with validated entities', async () => {
            const _ = await processUserFromCSVRows(
                connection.manager,
                [row],
                1,
                [],
                adminPermissions,
                queryResultCache
            )

            expect(
                queryResultCache.validatedOrgs.get(row.organization_name)
                    ?.organization_id
            ).to.equal(organization.organization_id)
            expect(
                queryResultCache.validatedOrgRoles.get(
                    row.organization_role_name
                )?.role_id
            ).to.equal(role.role_id)
            expect(
                queryResultCache.validatedSchools.get(
                    objectToKey({
                        school_name: row.school_name!,
                        org_id: organization.organization_id,
                    })
                )?.school_id
            ).to.equal(school.school_id)
            expect(
                queryResultCache.validatedClasses.get(
                    objectToKey({
                        class_name: row.class_name!,
                        school_id: school.school_id,
                        org_id: organization.organization_id,
                    })
                )?.class_id
            ).to.equal(cls.class_id)
        })

        context('and the role is neither student nor teacher related', () => {
            beforeEach(() => createRoleForUser('notAStudentOrTeacher', []))

            it('raises an UNAUTHORIZED_UPLOAD_CHILD_ENTITY error against the Role column', async () => {
                const rowErrors = await processRow()
                expect(rowErrors).to.have.length(1)
                expect(
                    pick(rowErrors[0], ['code', 'message', 'column'])
                ).to.deep.equal({
                    code: 'UNAUTHORIZED_UPLOAD_CHILD_ENTITY',
                    message: `On row number 1, Unauthorized to upload User to Class "${cls.class_name}".`,
                    column: 'organization_role_name',
                })
            })
        })

        context('and the role is student related', () => {
            beforeEach(() =>
                createRoleForUser('Pupil', [
                    PermissionName.attend_live_class_as_a_student_187,
                ])
            )

            it('assigns the user to the class as student', async () =>
                userInClass(await processAndReturnUser(), true, false))
        })

        context('and the role is teacher related', () => {
            beforeEach(() =>
                createRoleForUser('Master', [
                    PermissionName.attend_live_class_as_a_teacher_186,
                ])
            )

            it('assigns the user to the class as teacher', async () =>
                userInClass(await processAndReturnUser(), false, true))
        })

        context('and the role is both student and teacher related', () => {
            beforeEach(() =>
                createRoleForUser('MasterAndPupil', [
                    PermissionName.attend_live_class_as_a_teacher_186,
                    PermissionName.attend_live_class_as_a_student_187,
                ])
            )

            it('assigns the user to the class as a teacher and a student', async () =>
                userInClass(await processAndReturnUser(), true, true))
        })

        context(
            'and the shortcode is duplicated in another organization',
            () => {
                beforeEach(async () => {
                    const secondOrg = createOrganization()
                    await connection.manager.save(secondOrg)

                    const secondUser = createUser()
                    await connection.manager.save(secondUser)

                    const secondMembership = new OrganizationMembership()
                    secondMembership.organization = Promise.resolve(secondOrg)
                    secondMembership.organization_id = secondOrg.organization_id
                    secondMembership.shortcode = 'DUP1234'
                    secondMembership.user = Promise.resolve(secondUser)
                    secondMembership.user_id = secondUser.user_id
                    await connection.manager.save(secondMembership)

                    row = {
                        ...row,
                        user_shortcode: secondMembership.shortcode,
                    }
                })

                it('creates the user', async () => {
                    const rowErrors = await processUserFromCSVRows(
                        connection.manager,
                        [row],
                        1,
                        [],
                        adminPermissions,
                        queryResultCache
                    )

                    const dbUser = await User.findOneOrFail({
                        where: {
                            email: normalizedLowercaseTrimmed(row.user_email),
                        },
                    })

                    expect(dbUser.user_id).to.not.be.empty
                    expect(dbUser.email).to.eq(row.user_email)
                    expect(dbUser.phone).to.be.null
                    expect(dbUser.given_name).to.eq(row.user_given_name)
                    expect(dbUser.family_name).to.eq(row.user_family_name)
                    expect(dbUser.date_of_birth).to.eq(row.user_date_of_birth)
                    expect(dbUser.gender).to.eq(row.user_gender)
                })
            }
        )

        context('and the gender is written in uppercase', () => {
            beforeEach(async () => {
                row = {
                    ...row,
                    user_gender: 'Female',
                }
            })

            it('creates the user', async () => {
                await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )

                const dbUser = await User.findOneOrFail({
                    where: {
                        email: normalizedLowercaseTrimmed(row.user_email),
                    },
                })

                expect(dbUser.user_id).to.not.be.empty
                expect(dbUser.email).to.eq(row.user_email)
                expect(dbUser.phone).to.be.null
                expect(dbUser.given_name).to.eq(row.user_given_name)
                expect(dbUser.family_name).to.eq(row.user_family_name)
                expect(dbUser.date_of_birth).to.eq(row.user_date_of_birth)
                expect(dbUser.gender).to.eq('female')
            })
        })

        context('and the user already exists', () => {
            let existentUser: User
            let existentMembership: OrganizationMembership
            const originalShortcode = `CUSTOMCODE`
            beforeEach(async () => {
                existentUser = createUser()
                existentUser.given_name = 'existent'
                existentUser.family_name = 'user'
                existentUser.email = 'existent_user@gmail.com'
                existentUser.phone = undefined
                existentUser.date_of_birth = '01-2000'
                existentUser.gender = 'male'
                await connection.manager.save(existentUser)

                existentMembership = await addOrganizationToUserAndValidate(
                    testClient,
                    existentUser.user_id,
                    organization.organization_id,
                    getAdminAuthToken()
                )
                existentMembership.shortcode = originalShortcode
                await connection.manager.save(
                    OrganizationMembership,
                    existentMembership
                )

                row = {
                    ...row,
                    user_given_name: existentUser.given_name,
                    user_family_name: existentUser.family_name,
                    user_email: existentUser.email,
                    user_date_of_birth: `12-1999`,
                    user_gender: `female`,
                    user_shortcode: originalShortcode,
                    organization_role_name: `Student`,
                }
            })

            it("doesn't duplicate users", async () => {
                let rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )
                let dbUsers = await User.find({
                    where: { email: row.user_email },
                })
                expect(rowErrors.length).to.eq(0)
                expect(dbUsers.length).to.eq(1)

                // user adds their phone but is not updated in the CSV
                // the user should still be correctly identified
                existentUser.phone = '+123456789'
                await existentUser.save()

                rowErrors = await processUserFromCSVRows(
                    connection.manager,
                    [row],
                    1,
                    [],
                    adminPermissions,
                    queryResultCache
                )
                dbUsers = await User.find({
                    where: { email: row.user_email },
                })
                expect(rowErrors.length).to.eq(0)
                expect(dbUsers.length).to.eq(1)
            })

            context(
                'and user_shortcode is different to already assigned shortcode',
                () => {
                    async function getUpdatedUser() {
                        return User.findOneOrFail({
                            where: {
                                email: normalizedLowercaseTrimmed(
                                    row.user_email
                                ),
                            },
                            relations: [
                                `memberships`,
                                `memberships.roles`,
                                `school_memberships`,
                                `classesStudying`,
                            ],
                        })
                    }

                    async function expectCommonUpdates(user: User) {
                        // Unchanged
                        expect(user.user_id).to.eq(existentUser.user_id)
                        expect(user.email).to.eq(existentUser.email)
                        expect(user.phone).to.be.null
                        expect(user.given_name).to.eq(existentUser.given_name)
                        expect(user.family_name).to.eq(existentUser.family_name)

                        // Updated
                        expect(user.gender).to.eq(row.user_gender)
                        expect(user.date_of_birth).to.eq(row.user_date_of_birth)
                        expect(
                            (await user.school_memberships)?.map(
                                (membership) => membership.school_id
                            )
                        ).to.deep.eq([school.school_id])
                        expect(
                            (await user.classesStudying)?.map(
                                (_class) => _class.class_id
                            )
                        ).to.deep.eq([cls.class_id])

                        const memberships = (await user.memberships) ?? []
                        const membershipRoles =
                            (await Promise.all(
                                memberships?.map(
                                    async (membership) =>
                                        await membership?.roles
                                )
                            )) ?? []
                        const roleNames = membershipRoles?.flatMap((roles) =>
                            roles?.map((role) => role.role_name)
                        )

                        expect(roleNames).to.deep.eq(['Student'])
                    }

                    it('if new shortcode, should update ', async () => {
                        const newShortcode = `OTHER01`
                        await processUserFromCSVRows(
                            connection.manager,
                            [
                                {
                                    ...row,
                                    user_shortcode: newShortcode,
                                },
                            ],
                            1,
                            [],
                            adminPermissions,
                            queryResultCache
                        )

                        const dbUser = await getUpdatedUser()

                        await expectCommonUpdates(dbUser)

                        expect(
                            (await dbUser.memberships)?.map(
                                (membership) => membership.shortcode
                            )
                        ).to.deep.eq([newShortcode])
                    })

                    it("if empty shortcode, doesn't update shortcode but updates D.O.B, gender, roles, schools and classes", async () => {
                        // Fix: UD-844
                        await processUserFromCSVRows(
                            connection.manager,
                            [
                                {
                                    ...row,
                                    user_shortcode: undefined,
                                },
                            ],
                            1,
                            [],
                            adminPermissions,
                            queryResultCache
                        )

                        const dbUser = await getUpdatedUser()

                        await expectCommonUpdates(dbUser)

                        expect(
                            (await dbUser.memberships)?.map(
                                (membership) => membership.shortcode
                            )
                        ).to.deep.eq([originalShortcode])
                    })
                }
            )

            context(
                'and user role is different to already assigned role',
                () => {
                    beforeEach(() =>
                        createRoleForUser('Pupil', [
                            PermissionName.attend_live_class_as_a_student_187,
                        ])
                    )

                    it('assigns the user to the class as student', async () =>
                        userInClass(await processAndReturnUser(), true, false))
                }
            )
        })
    })

    context('performance', () => {
        context(
            'different users for the same organization/school/class',
            () => {
                let uploader: User

                beforeEach(async () => {
                    const orgAdmin = await connection
                        .createEntityManager()
                        .findOne(Role, {
                            where: { role_name: 'Organization Admin' },
                        })
                    uploader = await createUser().save()
                    await createOrganizationMembership({
                        user: uploader,
                        organization,
                        roles: [orgAdmin!],
                    }).save()
                })

                it('makes the number of db calls expected', async () => {
                    const makeRow = () => {
                        return {
                            organization_name: organization.organization_name!,
                            user_given_name: faker.name.firstName(),
                            user_family_name: faker.name.firstName(),
                            user_shortcode: generateShortCode(),
                            user_email: faker.internet.email(),
                            user_date_of_birth: '',
                            user_gender: 'Female',
                            user_alternate_email: '',
                            user_alternate_phone: '',
                            organization_role_name: 'Teacher',
                            school_name: school.school_name,
                            class_name: cls.class_name,
                        }
                    }

                    // at least 2 rows so we see which query calls
                    // correlated with number of rows
                    const rows = [makeRow(), makeRow()]

                    const userPermissions = new UserPermissions(
                        userToPayload(uploader)
                    )

                    connection.logger.reset()
                    await processUserFromCSVRows(
                        connection.manager,
                        rows,
                        0,
                        [],
                        userPermissions,
                        queryResultCache
                    )
                    const distinctQueriesMade = connection.logger.queryCounts
                    expect(distinctQueriesMade.size).to.eq(27)

                    const expectedNonOptimizedQueries = Array.from(
                        distinctQueriesMade.entries()
                    )
                        .filter(([_qry, count]) => count == rows.length)
                        .map(([qry]) => qry)

                    const numberOfOptimizedQueries = Array.from(
                        distinctQueriesMade.entries()
                    ).filter(([_qry, count]) => count == 1).length

                    expect(
                        expectedNonOptimizedQueries.length +
                            numberOfOptimizedQueries
                    ).to.eq(distinctQueriesMade.size)

                    // todo: we want this to be 0 really
                    expect(expectedNonOptimizedQueries).to.have.length(5)

                    for (const nonOptimizedQuery of expectedNonOptimizedQueries) {
                        expect(nonOptimizedQuery).to.match(
                            /^SELECT "(OrganizationMembership|roles|SchoolMembership|Permission).*/
                        )
                    }
                })
            }
        )
    })
})
