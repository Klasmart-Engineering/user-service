import chaiAsPromised from 'chai-as-promised'
import { Connection, EntityManager } from 'typeorm'
import { expect, use } from 'chai'

import {
    ApolloServerTestClient,
    createTestClient,
} from '../../../utils/createTestClient'
import { createClass } from '../../../factories/class.factory'
import { createOrganization } from '../../../factories/organization.factory'
import { createServer } from '../../../../src/utils/createServer'
import { createRole } from '../../../factories/role.factory'
import { createSchool } from '../../../factories/school.factory'
import { createTestConnection } from '../../../utils/testConnection'
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
import { processUserFromCSVRow } from '../../../../src/utils/csv/user'
import { CSVError } from '../../../../src/types/csv/csvError'
import {
    createNonAdminUser,
    createAdminUser,
} from '../../../utils/testEntities'
import constants from '../../../../src/entities/validations/constants'
import {
    customErrors,
    getCustomErrorMessageVariables,
} from '../../../../src/types/errors/customError'
import { UserPermissions } from '../../../../src/permissions/userPermissions'
import { addOrganizationToUserAndValidate } from '../../../utils/operations/userOps'
import { getAdminAuthToken } from '../../../utils/testConfig'
import { addRoleToOrganizationMembership } from '../../../utils/operations/organizationMembershipOps'
import { grantPermission } from '../../../utils/operations/roleOps'
import { PermissionName } from '../../../../src/permissions/permissionNames'
import { normalizedLowercaseTrimmed } from '../../../../src/utils/clean'
import { pick } from 'lodash'

use(chaiAsPromised)

describe('processUserFromCSVRow', async () => {
    let connection: Connection
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

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
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
        const rowErrors = await processUserFromCSVRow(
            connection.manager,
            row,
            1,
            [],
            adminPermissions
        )

        const dbUser = await User.findOne({
            where: { email: normalizedLowercaseTrimmed(row.user_email) },
        })

        expect(dbUser).to.be.undefined
    })

    context('org permissions', () => {
        async function processUsers() {
            return await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                new UserPermissions({
                    id: nonAdminUser.user_id,
                    email: nonAdminUser.email || '',
                })
            )
        }
        context('organization does not exist', () => {
            it('errors with nonexistent_entity', async () => {
                row.organization_name = 'None existing org'
                let rowErrors = await processUsers()
                let err = rowErrors[0]
                expect(err.code).to.eq(customErrors.nonexistent_entity.code)
            })
        })
        context('org exists but user is not a member', () => {
            it('errors with nonexistent_entity', async () => {
                let rowErrors = await processUsers()
                let err = rowErrors[0]
                expect(err.code).to.eq(customErrors.nonexistent_entity.code)
            })
        })
        context(
            "user is a member but doesn't have upload_users_40880 permission",
            () => {
                it('errors with unauthorized_org_upload', async () => {
                    await addOrganizationToUserAndValidate(
                        testClient,
                        nonAdminUser.user_id,
                        organization.organization_id,
                        getAdminAuthToken()
                    )
                    let rowErrors = await processUsers()
                    let err = rowErrors[0]
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
                })
            }
        )
        context(
            'user is a member and has upload_users_40880 permission',
            () => {
                it('does not error', async () => {
                    await assignUploadPermission(
                        nonAdminUser.user_id,
                        organization.organization_id,
                        role.role_id
                    )
                    let rowErrors = await processUsers()
                    expect(rowErrors).to.be.empty
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

                let rowErrors = await processUsers()
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
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.organization_name = ''
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too long', async () => {
            row.organization_name = 'a'.repeat(
                constants.ORGANIZATION_NAME_MAX_LENGTH + 1
            )
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]

            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.ORGANIZATION_NAME_MAX_LENGTH)
        })
        it("errors when doesn't exist", async () => {
            row.organization_name = 'None Existing Org'
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_entity.code)
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
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.user_given_name = ''
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too long', async () => {
            row.user_given_name = 'a'.repeat(
                constants.USER_GIVEN_NAME_MAX_LENGTH + 1
            )
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.USER_GIVEN_NAME_MAX_LENGTH)
        })
        it('errors when invalid characters', async () => {
            row.user_given_name = '(ben)'
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(rowErrors.length).to.eq(1)
            expect(err.code).to.eq(
                customErrors.invalid_alphanumeric_special.code
            )
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
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.user_family_name = ''
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too long', async () => {
            row.user_family_name = 'a'.repeat(
                constants.USER_FAMILY_NAME_MAX_LENGTH + 1
            )
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            const err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.USER_FAMILY_NAME_MAX_LENGTH)
        })
        it('errors when invalid characters', async () => {
            row.user_family_name = '(ben)'
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.invalid_alphanumeric_special.code
            )
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
                let rowErrors: CSVError[]
                row.user_date_of_birth = date_of_birth
                rowErrors = await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    [],
                    adminPermissions
                )

                const err = rowErrors[0]
                expect(rowErrors.length).to.eq(1)
                expect(err.column).to.eq('user_date_of_birth')
                expect(err.entity).to.eq('User')
                expect(err.attribute).to.eq('date of birth')
                expect(err.format).to.eq('MM-YYYY')
                expect(err.code).to.eq(customErrors.invalid_date.code)
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
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
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.user_gender = ''
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too short', async () => {
            row.user_gender = 'a'
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_min_length.code)
        })
        it('errors when too long', async () => {
            row.user_gender = 'a'.repeat(constants.GENDER_MAX_LENGTH + 1)
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.GENDER_MAX_LENGTH)
        })
        it('errors when invalid characters', async () => {
            row.user_gender = '(ben)'
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.invalid_alphanumeric_special.code
            )
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
        it('is required if phone is not provided', async () => {
            ;(row as any).user_email = null
            ;(row as any).user_phone = null
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(rowErrors.length).to.eq(1)
            expect(err.code).to.eq(customErrors.missing_required_either.code)
            expect(err.otherAttribute).to.eq('Phone')
        })
        it('is not required if phone is provided', async () => {
            ;(row as any).user_email = null
            row.user_phone = '+4400000000000'
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            expect(rowErrors).to.be.empty
        })
        it('errors when too long', async () => {
            row.user_email =
                'a'.repeat(constants.EMAIL_MAX_LENGTH + 1) + '@x.com'
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(rowErrors.length).to.eq(1)
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.EMAIL_MAX_LENGTH)
        })
        it('errors when invalid', async () => {
            for (const email of [
                'no.at.symbol.com',
                'with space@gmail.com',
                'ih@vetwo@symbols.com',
            ]) {
                rowErrors = []
                row.user_email = email
                rowErrors = await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    [],
                    adminPermissions
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

            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
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

            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            expect(rowErrors).to.be.empty

            const dbUsers = await User.find({
                where: [{ email: row.user_email }, { email: adminUser.email }],
            })
            expect(dbUsers.length).to.eq(1)
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
                const rowErrors = await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    [],
                    adminPermissions
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
                'a'.repeat(constants.EMAIL_MAX_LENGTH + 1) + '@x.com'
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(rowErrors.length).to.eq(1)
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.EMAIL_MAX_LENGTH)
        })
        it('errors when invalid', async () => {
            for (const email of [
                'no.at.symbol.com',
                'with space@gmail.com',
                'ih@vetwo@symbols.com',
            ]) {
                rowErrors = []
                row.user_alternate_email = email
                rowErrors = await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    [],
                    adminPermissions
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

            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            expect(rowErrors).to.be.empty

            const dbUser = await User.findOneOrFail({
                where: { alternate_email: processedEmail },
            })
            expect(dbUser.alternate_email).to.eq(processedEmail)
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
                const rowErrors = await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    [],
                    adminPermissions
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
            row.user_shortcode = 'a'.repeat(constants.SHORTCODE_MAX_LENGTH + 1)
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.SHORTCODE_MAX_LENGTH)
            expect(err.entity).to.eq('User')
            expect(err.attribute).to.eq('Short Code')
        })
        it('errors when not alphanumberic', async () => {
            for (const shortcode of ['de/f', '$abc', '@1234']) {
                rowErrors = []
                row.user_shortcode = shortcode
                rowErrors = await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    [],
                    adminPermissions
                )
                err = rowErrors[0]
                expect(err.code).to.eq(customErrors.invalid_alphanumeric.code)
                expect(err.entity).to.eq('User')
                expect(err.attribute).to.eq('Short Code')
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
                constants.SHORTCODE_MAX_LENGTH
            )
            await orgMembership.save()

            row.user_shortcode = orgMembership.shortcode

            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )
            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.duplicate_entity.code)
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
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.organization_role_name = ''
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
            expect(err.entity).to.eq('Organization')
            expect(err.attribute).to.eq('Role')
        })
        it('errors when too long', async () => {
            row.organization_role_name = 'a'.repeat(
                constants.ROLE_NAME_MAX_LENGTH + 1
            )
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.ROLE_NAME_MAX_LENGTH)
            expect(err.entity).to.eq('Organization')
            expect(err.attribute).to.eq('Role')
        })
        it('errors when nonexistent', async () => {
            row.organization_role_name = 'Non existing role'
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_child.code)
            expect(err.entity).to.eq('Organization Role')
            expect(err.entityName).to.eq(row.organization_role_name)
            expect(err.parentEntity).to.eq('Organization')
            expect(err.parentName).to.eq(row.organization_name)
        })
    })

    context('school name', () => {
        let err: CSVError
        let rowErrors: CSVError[]
        afterEach(() => {
            expect(rowErrors.length).to.eq(1)
            expect(err.column).to.eq('school_name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when too long', async () => {
            row.school_name = 'a'.repeat(constants.SCHOOL_NAME_MAX_LENGTH + 1)
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.SCHOOL_NAME_MAX_LENGTH)
            expect(err.entity).to.eq('School')
            expect(err.attribute).to.eq('Name')
        })
        it('errors when doesnt exist', async () => {
            row.school_name = 'Non existing school'
            row.class_name = undefined
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_child.code)
            expect(err.entity).to.eq('School')
            expect(err.entityName).to.eq(row.school_name)
            expect(err.parentEntity).to.eq('Organization')
            expect(err.parentName).to.eq(row.organization_name)
        })

        it('errors when school is in wrong organization', async () => {
            const wrongOrganization = createOrganization()
            await connection.manager.save(wrongOrganization)
            const wrongSchool = createSchool(wrongOrganization)
            await connection.manager.save(wrongSchool)

            row.school_name = wrongSchool.school_name
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_child.code)
            expect(err.entity).to.eq('School')
            expect(err.entityName).to.eq(row.school_name)
            expect(err.parentEntity).to.eq('Organization')
            expect(err.parentName).to.eq(row.organization_name)
        })
    })

    it(`does not validate school_role_name column`, async () => {
        // Fix for UD-738, which removes `school_role_name` handling added on original story KL-4408
        const rowErrors = await processUserFromCSVRow(
            connection.manager,
            { ...row, school_role_name: `Nonexistant Role` } as UserRow,
            1,
            [],
            adminPermissions
        )

        expect(rowErrors).to.be.empty
    })

    context('class name', () => {
        let err: CSVError
        let rowErrors: CSVError[]
        afterEach(() => {
            expect(rowErrors.length).to.eq(1)
            expect(err.column).to.eq('class_name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when too long', async () => {
            row.class_name = 'a'.repeat(constants.CLASS_NAME_MAX_LENGTH + 1)
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.CLASS_NAME_MAX_LENGTH)
            expect(err.entity).to.eq('Class')
            expect(err.attribute).to.eq('Name')
        })
        it('errors when doesnt exist', async () => {
            row.class_name = 'Non existing class'
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_child.code)
            expect(err.entity).to.eq('Class')
            expect(err.entityName).to.eq(row.class_name)
            expect(err.parentEntity).to.eq('School')
            expect(err.parentName).to.eq(row.school_name)
        })
        it('errors when class is assigned to a school and school is missing', async () => {
            row.school_name = undefined
            rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            err = rowErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_child.code)
            expect(err.entity).to.eq('Class')
            expect(err.entityName).to.eq(row.class_name)
            expect(err.parentEntity).to.eq('School')
            expect(err.parentName).to.eq('')
        })
    })

    context('when all the data is correct', () => {
        let roleInfo = (role: Role) => {
            return role.role_id
        }
        let userInfo = (user: User) => {
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
            processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

        async function processAndReturnUser(expectedErrorCode: string = '') {
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
            const rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            const dbUser = await User.findOneOrFail({
                where: { email: normalizedLowercaseTrimmed(row.user_email) },
            })

            expect(dbUser.user_id).to.not.be.empty
            expect(dbUser.email).to.eq(row.user_email)
            expect(dbUser.phone).to.be.null
            expect(dbUser.given_name).to.eq(row.user_given_name)
            expect(dbUser.family_name).to.eq(row.user_family_name)
            expect(dbUser.date_of_birth).to.eq(row.user_date_of_birth)
            expect(dbUser.gender).to.eq(row.user_gender)

            const orgMembership = await OrganizationMembership.findOneOrFail({
                where: { user: dbUser, organization: organization },
            })
            expect(orgMembership.shortcode).to.eq(row.user_shortcode)
            const orgRoles = (await orgMembership.roles) || []
            expect(orgRoles.map(roleInfo)).to.deep.eq([role].map(roleInfo))

            const schoolMembership = await SchoolMembership.findOneOrFail({
                where: { user: dbUser, school: school },
            })
            const schoolRoles = (await schoolMembership.roles) || []
            expect(schoolRoles).to.deep.eq([])
        })

        it('it does not update SchoolMembership.roles based on `school_role_name` column', async () => {
            // Fix for UD-738, which removes `school_role_name` handling added on original story KL-4408
            const rowErrors = await processUserFromCSVRow(
                connection.manager,
                { ...row, school_role_name: role.role_name } as UserRow,
                1,
                [],
                adminPermissions
            )

            const dbUser = await User.findOneOrFail({
                where: { email: normalizedLowercaseTrimmed(row.user_email) },
            })

            const schoolMembership = await SchoolMembership.findOneOrFail({
                relations: [`roles`],
                where: { user: dbUser, school: school },
            })
            expect(await schoolMembership.roles).to.deep.eq([])
        })
        it('creates the user if class is not in a school', async () => {
            row.school_name = undefined
            const cls2 = createClass([], organization)
            await connection.manager.save(cls2)
            row.class_name = cls2.class_name
            const rowErrors = await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                [],
                adminPermissions
            )

            const dbUser = await User.findOneOrFail({
                where: { email: normalizedLowercaseTrimmed(row.user_email) },
            })

            expect(dbUser.user_id).to.not.be.empty
        })

        it('it does not update SchoolMembership.roles based on `school_role_name` column', async () => {
            // Fix for UD-738, which removes `school_role_name` handling added on original story KL-4408
            const rowErrors = await processUserFromCSVRow(
                connection.manager,
                { ...row, school_role_name: role.role_name } as UserRow,
                1,
                [],
                adminPermissions
            )

            const dbUser = await User.findOneOrFail({
                where: { email: normalizedLowercaseTrimmed(row.user_email) },
            })

            const schoolMembership = await SchoolMembership.findOneOrFail({
                relations: [`roles`],
                where: { user: dbUser, school: school },
            })
            expect(await schoolMembership.roles).to.deep.eq([])
        })

        context('and the role is neither student nor teacher related', () => {
            beforeEach(() =>
                createRoleForUser('notAStudentOrTeacher', [
                    PermissionName.add_learning_outcome_to_content_485,
                ])
            )

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
                    PermissionName.add_learning_outcome_to_content_485,
                    PermissionName.attend_live_class_as_a_student_187,
                ])
            )

            it('assigns the user to the class as student', async () =>
                userInClass(await processAndReturnUser(), true, false))
        })

        context('and the role is teacher related', () => {
            beforeEach(() =>
                createRoleForUser('Master', [
                    PermissionName.add_learning_outcome_to_content_485,
                    PermissionName.attend_live_class_as_a_teacher_186,
                ])
            )

            it('assigns the user to the class as teacher', async () =>
                userInClass(await processAndReturnUser(), false, true))
        })

        context('and the role is both student and teacher related', () => {
            beforeEach(() =>
                createRoleForUser('MasterAndPupil', [
                    PermissionName.add_learning_outcome_to_content_485,
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
                    const rowErrors = await processUserFromCSVRow(
                        connection.manager,
                        row,
                        1,
                        [],
                        adminPermissions
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
                const rowErrors = await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    [],
                    adminPermissions
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
                let rowErrors = await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    [],
                    adminPermissions
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

                rowErrors = await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    [],
                    adminPermissions
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
                        await processUserFromCSVRow(
                            connection.manager,
                            {
                                ...row,
                                user_shortcode: newShortcode,
                            },
                            1,
                            [],
                            adminPermissions
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
                        await processUserFromCSVRow(
                            connection.manager,
                            {
                                ...row,
                                user_shortcode: undefined,
                            },
                            1,
                            [],
                            adminPermissions
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
                            PermissionName.add_learning_outcome_to_content_485,
                            PermissionName.attend_live_class_as_a_student_187,
                        ])
                    )

                    it('assigns the user to the class as student', async () =>
                        userInClass(await processAndReturnUser(), true, false))
                }
            )
        })
    })
})
