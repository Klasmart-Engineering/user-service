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
    let fileErrors: CSVError[]
    let adminUser: User
    let adminPermissions: UserPermissions

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        fileErrors = []
        adminUser = await createAdminUser(testClient)
        user = createUser({})
        organization = createOrganization({})
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

        row = {
            organization_name: organization.organization_name || '',
            user_given_name: user.given_name || '',
            user_family_name: user.family_name || '',
            user_shortcode: generateShortCode(),
            user_email: user.email || '',
            user_date_of_birth: user.date_of_birth || '',
            user_gender: user.gender || '',
            organization_role_name: role.role_name || '',
            school_name: school.school_name || '',
            school_role_name: role.role_name || '',
            class_name: cls.class_name || '',
        }
    })

    it("doesn't save the user if validation fails", async () => {
        row.user_email = 'abc'
        await processUserFromCSVRow(
            connection.manager,
            row,
            1,
            fileErrors,
            adminPermissions
        )

        const dbUser = await User.findOne({
            where: { email: row.user_email },
        })

        expect(dbUser).to.be.undefined
    })

    context('permissions', () => {
        it('requires upload_users_40880 permission for the organization', async () => {
            row.organization_name = organization.organization_name!

            const nonAdminUser = await createNonAdminUser(testClient)

            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                new UserPermissions({
                    id: nonAdminUser.user_id,
                    email: nonAdminUser.email || '',
                })
            )
            let err = fileErrors[0]
            expect(err.code).to.eq(customErrors.unauthorized_org_upload.code)
            expect(err.entity).to.eq('user')
            expect(err.organizationName).to.eq(row.organization_name)
            expect(err.column).to.eq('organization_name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }

            await addOrganizationToUserAndValidate(
                testClient,
                nonAdminUser.user_id,
                organization.organization_id,
                getAdminAuthToken()
            )
            await addRoleToOrganizationMembership(
                testClient,
                nonAdminUser.user_id,
                organization.organization_id,
                role.role_id,
                { authorization: getAdminAuthToken() }
            )
            await grantPermission(
                testClient,
                role.role_id,
                PermissionName.upload_users_40880,
                { authorization: getAdminAuthToken() }
            )

            fileErrors = []
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                // important to create a new object to avoid caching
                new UserPermissions({
                    id: nonAdminUser.user_id,
                    email: nonAdminUser.email || '',
                })
            )
            expect(fileErrors.length).to.eq(0)
        })
    })

    context('organization name', () => {
        let err: CSVError
        afterEach(() => {
            expect(fileErrors.length).to.eq(1)
            expect(err.entity).to.eq('organization')
            expect(err.attribute).to.eq('name')
            expect(err.column).to.eq('organization_name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when missing', async () => {
            delete row.organization_name
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.organization_name = ''
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too long', async () => {
            row.organization_name = 'a'.repeat(
                constants.ORGANIZATION_NAME_MAX_LENGTH + 1
            )
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]

            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.ORGANIZATION_NAME_MAX_LENGTH)
        })
        it("errors when doesn't exist", async () => {
            row.organization_name = 'None Existing Org'
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_entity.code)
        })
    })

    context('user given name', () => {
        let err: CSVError
        afterEach(() => {
            expect(fileErrors.length).to.eq(1)
            expect(err.column).to.eq('user_given_name')
            expect(err.entity).to.eq('user')
            expect(err.attribute).to.eq('given_name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when missing', async () => {
            delete row.user_given_name
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.user_given_name = ''
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too long', async () => {
            row.user_given_name = 'a'.repeat(
                constants.USER_GIVEN_NAME_MAX_LENGTH + 1
            )
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.USER_GIVEN_NAME_MAX_LENGTH)
        })
        it('errors when invalid characters', async () => {
            row.user_given_name = '(ben)'
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            err = fileErrors[0]
            expect(fileErrors.length).to.eq(1)
            expect(err.code).to.eq(
                customErrors.invalid_alphanumeric_special.code
            )
        })
    })

    context('user family name', () => {
        let err: CSVError
        afterEach(() => {
            expect(fileErrors.length).to.eq(1)
            expect(err.column).to.eq('user_family_name')
            expect(err.entity).to.eq('user')
            expect(err.attribute).to.eq('family_name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when missing', async () => {
            delete row.user_family_name
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.user_family_name = ''
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too long', async () => {
            row.user_family_name = 'a'.repeat(
                constants.USER_FAMILY_NAME_MAX_LENGTH + 1
            )
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            const err = fileErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.USER_FAMILY_NAME_MAX_LENGTH)
        })
        it('errors when invalid characters', async () => {
            row.user_family_name = '(ben)'
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
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
                fileErrors = []
                row.user_date_of_birth = date_of_birth
                await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const err = fileErrors[0]
                expect(fileErrors.length).to.eq(1)
                expect(err.column).to.eq('user_date_of_birth')
                expect(err.entity).to.eq('user')
                expect(err.attribute).to.eq('date_of_birth')
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
        afterEach(() => {
            expect(fileErrors.length).to.eq(1)
            expect(err.column).to.eq('user_gender')
            expect(err.entity).to.eq('user')
            expect(err.attribute).to.eq('gender')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when missing', async () => {
            delete row.user_gender
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.user_gender = ''
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too short', async () => {
            row.user_gender = 'a'
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.invalid_min_length.code)
        })
        it('errors when too long', async () => {
            row.user_gender = 'a'.repeat(constants.GENDER_MAX_LENGTH + 1)
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.GENDER_MAX_LENGTH)
        })
        it('errors when invalid characters', async () => {
            row.user_gender = '(ben)'
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.invalid_alphanumeric_special.code
            )
        })
    })

    context('email', () => {
        let err: CSVError
        afterEach(() => {
            expect(err.column).to.eq('user_email')
            expect(err.entity).to.eq('user')
            expect(err.attribute).to.eq('email')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('is required if phone is not provided', async () => {
            delete row.user_email
            delete row.user_phone
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(fileErrors.length).to.eq(1)
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('is not required if phone is provided', async () => {
            delete row.user_email
            row.user_phone = '+4400000000000'
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            expect(fileErrors.length).to.eq(0)
        })
        it('errors when too long', async () => {
            row.user_email =
                'a'.repeat(constants.EMAIL_MAX_LENGTH + 1) + '@x.com'
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(fileErrors.length).to.eq(1)
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.EMAIL_MAX_LENGTH)
        })
        it('errors when invalid', async () => {
            for (const email of [
                'no.at.symbol.com',
                'with space@gmail.com',
                'ih@vetwo@symbols.com',
            ]) {
                fileErrors = []
                row.user_email = email
                await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                err = fileErrors[0]
                expect(fileErrors.length).to.eq(1)
                expect(err.code).to.eq(customErrors.invalid_email.code)
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })
    })

    context('user phone', () => {
        it('errors when invalid', async () => {
            for (const phone of [
                '1',
                'ph0n3numb3r',
                '+521234567891011121314151617181920',
            ]) {
                fileErrors = []
                row.user_phone = phone
                await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                const err = fileErrors[0]
                expect(fileErrors.length).to.eq(1)
                expect(err.column).to.eq('user_phone')
                expect(err.entity).to.eq('user')
                expect(err.attribute).to.eq('phone')
                expect(err.code).to.eq(customErrors.invalid_phone.code)
                for (const v of getCustomErrorMessageVariables(err.message)) {
                    expect(err[v]).to.exist
                }
            }
        })
    })

    context('user shortcode', () => {
        let err: CSVError
        afterEach(() => {
            expect(fileErrors.length).to.eq(1)
            expect(err.column).to.eq('user_shortcode')
            expect(err.entity).to.eq('shortcode')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when too long', async () => {
            row.user_shortcode = 'a'.repeat(constants.SHORTCODE_MAX_LENGTH + 1)
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.SHORTCODE_MAX_LENGTH)
        })
        it('errors when not alphanumberic', async () => {
            for (const shortcode of ['de/f', '$abc', '@1234']) {
                fileErrors = []
                row.user_shortcode = shortcode
                await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )
                err = fileErrors[0]
                expect(err.code).to.eq(customErrors.invalid_alphanumeric.code)
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

            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )
            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.duplicate_entity.code)
            expect(err.entityName).to.eq(row.user_shortcode)
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
    })

    context('organization role', () => {
        let err: CSVError
        afterEach(() => {
            expect(fileErrors.length).to.eq(1)
            expect(err.column).to.eq('organization_role_name')
            expect(err.entity).to.eq('user')
            expect(err.attribute).to.eq('organization_role')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when missing', async () => {
            delete row.organization_role_name
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when blank', async () => {
            row.organization_role_name = ''
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            err = fileErrors[0]
            expect(err.code).to.eq(
                customErrors.missing_required_entity_attribute.code
            )
        })
        it('errors when too long', async () => {
            row.organization_role_name = 'a'.repeat(
                constants.ROLE_NAME_MAX_LENGTH + 1
            )
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.ROLE_NAME_MAX_LENGTH)
        })
        it('errors when nonexistent', async () => {
            row.school_role_name = undefined
            row.organization_role_name = 'Non existing role'
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_entity.code)
        })
    })

    context('school name', () => {
        let err: CSVError
        afterEach(() => {
            expect(fileErrors.length).to.eq(1)
            expect(err.column).to.eq('school_name')
            expect(err.entity).to.eq('school')
            expect(err.attribute).to.eq('name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when too long', async () => {
            row.school_name = 'a'.repeat(constants.SCHOOL_NAME_MAX_LENGTH + 1)
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.SCHOOL_NAME_MAX_LENGTH)
        })
        it('errors when doesnt exist', async () => {
            row.school_name = 'Non existing school'
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_entity.code)
        })
    })
    context('class name', () => {
        let err: CSVError
        afterEach(() => {
            expect(fileErrors.length).to.eq(1)
            expect(err.column).to.eq('class_name')
            expect(err.entity).to.eq('class')
            expect(err.attribute).to.eq('name')
            for (const v of getCustomErrorMessageVariables(err.message)) {
                expect(err[v]).to.exist
            }
        })
        it('errors when too long', async () => {
            row.class_name = 'a'.repeat(constants.CLASS_NAME_MAX_LENGTH + 1)
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.invalid_max_length.code)
            expect(err.max).to.eq(constants.CLASS_NAME_MAX_LENGTH)
        })
        it('errors when doesnt exist', async () => {
            row.class_name = 'Non existing class'
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            err = fileErrors[0]
            expect(err.code).to.eq(customErrors.nonexistent_entity.code)
        })
    })

    context('when all the data is correct', () => {
        let roleInfo = (role: Role) => {
            return role.role_id
        }
        let userInfo = (user: User) => {
            return user.user_id
        }

        it('creates the user and its respective links', async () => {
            await processUserFromCSVRow(
                connection.manager,
                row,
                1,
                fileErrors,
                adminPermissions
            )

            const dbUser = await User.findOneOrFail({
                where: { email: row.user_email },
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
            expect(schoolRoles.map(roleInfo)).to.deep.eq([role].map(roleInfo))
        })

        context('and the role is not student neither teacher related', () => {
            it('does not assign the user to the class', async () => {
                await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const students = (await cls.students) || []
                expect(students).to.be.empty
                const teachers = (await cls.teachers) || []
                expect(teachers).to.be.empty
            })
        })

        context('and the role is student related', () => {
            beforeEach(async () => {
                role = createRole('My Student Role', organization)
                await connection.manager.save(role)

                row = {
                    ...row,
                    organization_role_name: role.role_name || '',
                    school_role_name: role.role_name || '',
                }
            })

            it('assigns the user to the class as student', async () => {
                await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const dbUser = await User.findOneOrFail({
                    where: { email: row.user_email },
                })

                const students = (await cls.students) || []
                expect(students.map(userInfo)).to.deep.eq(
                    [dbUser].map(userInfo)
                )
                const teachers = (await cls.teachers) || []
                expect(teachers).to.be.empty
            })
        })

        context('and the role is teacher related', () => {
            beforeEach(async () => {
                role = createRole('My Teacher Role', organization)
                await connection.manager.save(role)

                row = {
                    ...row,
                    organization_role_name: role.role_name || '',
                    school_role_name: role.role_name || '',
                }
            })

            it('assigns the user to the class as teacher', async () => {
                await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const dbUser = await User.findOneOrFail({
                    where: { email: row.user_email },
                })

                const students = (await cls.students) || []
                expect(students).to.be.empty
                const teachers = (await cls.teachers) || []
                expect(teachers.map(userInfo)).to.deep.eq(
                    [dbUser].map(userInfo)
                )
            })
        })

        context(
            'and the shortcode is duplicated in another organization',
            () => {
                beforeEach(async () => {
                    const secondOrg = createOrganization({})
                    await connection.manager.save(secondOrg)

                    const secondUser = createUser({})
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
                    await processUserFromCSVRow(
                        connection.manager,
                        row,
                        1,
                        fileErrors,
                        adminPermissions
                    )

                    const dbUser = await User.findOneOrFail({
                        where: { email: row.user_email },
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
                await processUserFromCSVRow(
                    connection.manager,
                    row,
                    1,
                    fileErrors,
                    adminPermissions
                )

                const dbUser = await User.findOneOrFail({
                    where: { email: row.user_email },
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
            context(
                'and user_shortcode is different than already assigned shortcode',
                () => {
                    const updateShortcode = 'OTHER01'

                    beforeEach(async () => {
                        const existentUser = createUser({
                            given_name: 'existent',
                            family_name: 'user',
                            email: 'existent_user@gmail.com',
                            date_of_birth: '01-2000',
                            gender: 'male',
                        })
                        existentUser.phone = undefined

                        await connection.manager.save(existentUser)

                        const existentMembership = new OrganizationMembership()
                        existentMembership.organization = Promise.resolve(
                            organization
                        )
                        existentMembership.organization_id =
                            organization.organization_id
                        existentMembership.shortcode = row.user_shortcode!
                        existentMembership.user = Promise.resolve(existentUser)
                        existentMembership.user_id = existentUser.user_id
                        await connection.manager.save(existentMembership)

                        row = {
                            ...row,
                            user_given_name: existentUser.given_name || "",
                            user_family_name: existentUser.family_name || "",
                            user_email: existentUser.email,
                            user_date_of_birth: existentUser.date_of_birth,
                            user_gender: existentUser.gender || "",
                            user_shortcode: updateShortcode,
                        }
                    })

                    it('should update user shortcode', async () => {
                        await processUserFromCSVRow(
                            connection.manager,
                            row,
                            1,
                            fileErrors,
                            adminPermissions
                        )

                        const dbUser = await User.findOneOrFail({
                            where: { email: row.user_email },
                        })

                        const organizationMembership = await dbUser.memberships
                        const membershipShortcodes = organizationMembership?.map(
                            (membership) => membership.shortcode
                        )

                        expect(dbUser.user_id).to.not.be.empty
                        expect(dbUser.email).to.eq(row.user_email)
                        expect(dbUser.phone).to.be.null
                        expect(dbUser.given_name).to.eq(row.user_given_name)
                        expect(dbUser.family_name).to.eq(row.user_family_name)
                        expect(dbUser.date_of_birth).to.eq(
                            row.user_date_of_birth
                        )
                        expect(dbUser.gender).to.eq(row.user_gender)
                        expect(membershipShortcodes).to.deep.eq([
                            row.user_shortcode,
                        ])
                    })
                }
            )
        })
    })
})
