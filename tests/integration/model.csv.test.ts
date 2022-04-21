import fs from 'fs'
import chaiAsPromised from 'chai-as-promised'
import { resolve } from 'path'
import { ReadStream } from 'fs'
import { expect, use } from 'chai'
import { getConnection } from 'typeorm'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../utils/createTestClient'
import { TestConnection } from '../utils/testConnection'
import { createServer } from '../../src/utils/createServer'
import { Model } from '../../src/model'
import { User } from '../../src/entities/user'
import { Role } from '../../src/entities/role'
import { Program } from '../../src/entities/program'
import { Grade } from '../../src/entities/grade'
import { Class } from '../../src/entities/class'
import { School } from '../../src/entities/school'
import { Category } from '../../src/entities/category'
import { Subcategory } from '../../src/entities/subcategory'
import { Organization } from '../../src/entities/organization'
import { AgeRange } from '../../src/entities/ageRange'
import { AgeRangeUnit } from '../../src/entities/ageRangeUnit'
import { Subject } from '../../src/entities/subject'
import { createClass } from '../factories/class.factory'
import { createSubject } from '../factories/subject.factory'
import { createAgeRange } from '../factories/ageRange.factory'
import { createGrade } from '../factories/grade.factory'
import { createOrganization } from '../factories/organization.factory'
import { createRole } from '../factories/role.factory'
import { createSchool } from '../factories/school.factory'
import { createSubcategory } from '../factories/subcategory.factory'
import { createProgram, createPrograms } from '../factories/program.factory'
import { createUser } from '../factories/user.factory'
import {
    queryUploadGrades,
    uploadGrades,
} from '../utils/operations/csv/uploadGrades'
import {
    queryUploadRoles,
    uploadRoles,
} from '../utils/operations/csv/uploadRoles'
import {
    queryUploadClasses,
    uploadClasses,
} from '../utils/operations/csv/uploadClasses'
import {
    queryUploadSubCategories,
    uploadSubCategories,
} from '../utils/operations/csv/uploadSubcategories'
import {
    queryUploadUsers,
    uploadUsers,
} from '../utils/operations/csv/uploadUsers'
import {
    queryUploadOrganizations,
    uploadOrganizations,
} from '../utils/operations/csv/uploadOrganizations'
import {
    queryUploadCategories,
    uploadCategories,
} from '../utils/operations/csv/uploadCategories'
import {
    queryUploadSubjects,
    uploadSubjects,
} from '../utils/operations/csv/uploadSubjects'
import {
    queryUploadPrograms,
    uploadPrograms,
} from '../utils/operations/csv/uploadPrograms'
import {
    queryUploadAgeRanges,
    uploadAgeRanges,
} from '../utils/operations/csv/uploadAgeRanges'
import {
    queryUploadSchools,
    uploadSchools,
} from '../utils/operations/csv/uploadSchools'
import ProgramsInitializer from '../../src/initializers/programs'
import CategoriesInitializer from '../../src/initializers/categories'
import SubcategoriesInitializer from '../../src/initializers/subcategories'
import AgeRangesInitializer from '../../src/initializers/ageRanges'
import SubjectsInitializer from '../../src/initializers/subjects'
import GradesInitializer from '../../src/initializers/grades'
import { CSVError, CustomError } from '../../src/types/csv/csvError'
import csvErrorConstants from '../../src/types/errors/csv/csvErrorConstants'
import { getAdminAuthToken, getNonAdminAuthToken } from '../utils/testConfig'
import { createNonAdminUser, createAdminUser } from '../utils/testEntities'
import { createAdminUser as createAdminUserFactory } from '../factories/user.factory'
import { customErrors } from '../../src/types/errors/customError'
import { buildCsvError } from '../../src/utils/csv/csvUtils'
import { PermissionName } from '../../src/permissions/permissionNames'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { fileMockInput } from '../utils/operations/modelOps'
import { UserPermissions } from '../../src/permissions/userPermissions'
import { Readable } from 'stream'
import { Upload } from '../../src/types/upload'
import iconv from 'iconv-lite'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { config } from '../../src/config/config'
import { checkCSVErrorsMatch } from '../utils/csvError'
import { userToPayload } from '../utils/operations/userOps'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { createAcademicTerm } from '../factories/academicTerm.factory'
import { AcademicTerm } from '../../src/entities/academicTerm'

use(chaiAsPromised)
use(deepEqualInAnyOrder)

describe('model.csv', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient

    before(async () => {
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    describe('file encoding', () => {
        let ctx: { permissions: UserPermissions }
        const encoder = new TextEncoder()
        const fileContents = fs.readFileSync(
            `tests/fixtures/organizationsExample.csv`
        )
        const expectedOrgsCreated = 20

        beforeEach(async () => {
            const uploader = await createAdminUserFactory().save()
            const token = userToPayload(uploader)
            const permissions = new UserPermissions(token)
            ctx = { permissions }
        })

        const uploadFile = (file: Readable): Promise<Upload> => {
            const fileUpload = fileMockInput(
                file,
                'mycsvfile.csv',
                'text/csv',
                ''
            )

            return Model.uploadOrganizationsFromCSV(
                {
                    file: fileUpload,
                },
                ctx
            )
        }

        it('accepts UTF-8 with bom', async () => {
            const file = new Readable({
                read: () => {
                    // BOM bytes
                    //https://stackoverflow.com/a/2223926
                    // file.push(Buffer.from([0xef, 0xbb, 0xbf]))
                    file.push(fileContents)
                    file.push(null)
                },
            })

            await uploadFile(file)

            await expect(Organization.count()).to.eventually.eq(
                expectedOrgsCreated
            )
        })

        it('accepts files with a multi-byte character is split across chunks', async () => {
            // arbitary postion in the file
            const highWaterMark = 100

            const file = new Readable({
                read: () => {
                    file.push(fileContents.subarray(0, highWaterMark - 1))
                    // inject a multibyte character
                    // that spans the chunk boundary
                    // it's first byte in the first chunk
                    // and the rest in the second chunk
                    file.push(encoder.encode('占'))
                    file.push(fileContents.subarray(highWaterMark - 1))
                    file.push(null)
                },
                highWaterMark,
            })

            await uploadFile(file)

            await expect(Organization.count()).to.eventually.eq(
                expectedOrgsCreated
            )
        })

        it('rejects files that with an incomplete multi-byte character', async () => {
            const file = new Readable({
                read: () => {
                    file.push(fileContents)
                    file.push(encoder.encode('占').subarray(0, 1))
                    file.push(null)
                },
            })

            await expect(uploadFile(file)).to.eventually.be.rejectedWith(
                'File must be encoded as UTF-8.'
            )

            await expect(Organization.count()).to.eventually.eq(0)
        })

        it('rejects files that use a non-UTF-8 encoding', async () => {
            const file = new Readable({
                read: () => {
                    file.push(iconv.encode('占', 'euc-kr'))
                    file.push(null)
                },
            })

            await expect(uploadFile(file)).to.eventually.be.rejectedWith(
                'File must be encoded as UTF-8.'
            )

            await expect(Organization.count()).to.eventually.eq(0)
        })
    })

    describe('uploadFileSizeExceededCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const filename = 'fileSizeExceeded.csv'

        let adminUserToken: string

        beforeEach(async () => {
            await createAdminUser(testClient)
            adminUserToken = getAdminAuthToken()
        })

        it('should throw high level error', async () => {
            file = fs.createReadStream(resolve(`tests/fixtures/${filename}`))

            await expect(
                uploadOrganizations(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    adminUserToken
                )
            ).to.be.rejectedWith('File size exceeds max file size (50KB)')

            const organizationsCreated = await Organization.count()
            expect(organizationsCreated).eq(0)
        })
    })

    describe('uploadOrganizationsFromCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const correctFileName = 'organizationsExample.csv'
        const wrongFileName = 'organizationsWrong.csv'
        let adminUserToken: string

        beforeEach(async () => {
            await createAdminUser(testClient)
            adminUserToken = getAdminAuthToken()
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                const filename = correctFileName
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    queryUploadOrganizations(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        adminUserToken
                    )
                ).to.be.rejected

                const organizationsCreated = await Organization.count()
                expect(organizationsCreated).eq(0)
            })
        })

        context('when uploader is not admin', () => {
            let nonAdminUser: User
            let nonAdminUserToken: string

            beforeEach(async () => {
                nonAdminUser = await createNonAdminUser(testClient)
                nonAdminUserToken = getNonAdminAuthToken()
            })

            it('should throw an error', async () => {
                const filename = correctFileName
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    uploadOrganizations(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        nonAdminUserToken
                    )
                ).to.be.rejectedWith(
                    `User(${nonAdminUser.user_id}) does not have Admin permissions`
                )

                const organizationsCreated = await Organization.count()
                expect(organizationsCreated).eq(0)
            })
        })

        context('when file data is not correct', () => {
            it('should throw an error', async () => {
                const filename = wrongFileName
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    uploadOrganizations(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        adminUserToken
                    )
                ).to.be.rejected

                const organizationsCreated = await Organization.count()
                expect(organizationsCreated).eq(0)
            })

            it('should throw errors when a user belongs to multiple organizations', async () => {
                const filename = 'organizationsMultipleOrgPerUser.csv'
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const owner = await createUser()
                owner.email = 'owner@company2.com'
                owner.phone = '+351 863 644 3084'
                await connection.manager.save(owner)

                const org = await createOrganization(owner)
                org.organization_name = 'Company 1'
                await connection.manager.save(org)

                const expectedCSVError = buildCsvError(
                    csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                    1,
                    'owner_email',
                    csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                    {
                        name: 'Owner',
                        entity: 'user',
                        parent_entity: 'organization',
                        parent_name: 'Company 2', // Should read company 1, requires fix
                    }
                )

                const e = await expect(
                    uploadOrganizations(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        adminUserToken
                    )
                ).to.be.rejected
                checkCSVErrorsMatch(e, [expectedCSVError])

                const allOrganizations = await Organization.count()
                expect(allOrganizations).eq(1) // pre created "Company 1" org
            })
        })

        context('when file data is correct', () => {
            it('should create organizations', async () => {
                const filename = correctFileName
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const result = await uploadOrganizations(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    adminUserToken
                )
                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)

                const organizationsCreated = await Organization.count()
                expect(organizationsCreated).gt(0)
            })
        })
    })

    describe('uploadRolesFromCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const filename = 'rolesExample.csv'
        let nonAdminUser: User
        let orgs: Organization[]
        let orgMemberships: OrganizationMembership[]
        let arbitraryUserToken: string
        let preMadeRolesCount: number

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()

            orgs = []
            orgMemberships = []
            preMadeRolesCount = 0

            for (let i = 1; i <= 4; i += 1) {
                const org = createOrganization()
                org.organization_name = `Company ${i}`
                // eslint-disable-next-line no-await-in-loop
                await org.save()
                orgs.push(org)

                // eslint-disable-next-line no-await-in-loop
                const createRolesRole = await createRole('create roles', org, {
                    permissions: [
                        PermissionName.create_role_with_permissions_30222,
                    ],
                }).save()
                preMadeRolesCount += 1

                const orgMemb = createOrganizationMembership({
                    user: nonAdminUser,
                    organization: org,
                    roles: [createRolesRole],
                })
                // eslint-disable-next-line no-await-in-loop
                await orgMemb.save()
                orgMemberships.push(orgMemb)
            }
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    queryUploadRoles(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const rolesExisting = await Role.count({
                    where: { system_role: false },
                })
                expect(rolesExisting).eq(preMadeRolesCount) // Should only be those created in the four org memberships
            })
        })

        context(
            'when uploader is not authorised to upload roles in the organization',
            () => {
                beforeEach(async () => {
                    for await (const orgMemb of orgMemberships) {
                        orgMemb.roles = Promise.resolve([])
                        await orgMemb.save()
                    }
                })

                it('it throws an authorized code error', async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )

                    const actualErrors = await expect(
                        uploadRoles(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected

                    actualErrors.errors.map((error: CSVError) => {
                        expect(error.code).to.eq(
                            customErrors.unauthorized_org_upload.code
                        )
                        expect(error.column).to.eq('organization_name')
                        expect(error.entity).to.eq('role')
                        expect(
                            orgs.map((org) => org.organization_name)
                        ).to.include(error.organizationName)
                    })
                })
            }
        )

        context('when file data is not correct', () => {
            beforeEach(() => {
                orgs.map(async (org, idx) => {
                    org.organization_name = `Not Company ${idx + 1}`
                    await org.save()
                })
            })

            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    uploadRoles(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const rolesExisting = await Role.count({
                    where: { system_role: false },
                })
                expect(rolesExisting).eq(preMadeRolesCount) // Should only be those created in the four org memberships
            })
        })

        context('when file data is correct', () => {
            it('should create roles', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const result = await uploadRoles(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    arbitraryUserToken
                )
                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)

                const rolesCreated = await Role.count({
                    where: { system_role: false },
                })
                expect(rolesCreated).gt(0)
            })
        })
    })

    describe('uploadSubjectsFromCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const filename = 'subjectsExample.csv'
        let nonAdminUser: User
        let orgs: Organization[]
        let orgMemberships: OrganizationMembership[]
        let arbitraryUserToken: string

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()
            await SubcategoriesInitializer.run()
            await CategoriesInitializer.run()

            orgs = []
            orgMemberships = []

            for (let i = 1; i <= 4; i += 1) {
                const org = createOrganization()
                org.organization_name = `Company ${i}`
                // eslint-disable-next-line no-await-in-loop
                await org.save()
                orgs.push(org)

                // eslint-disable-next-line no-await-in-loop
                const createSubjectsRole = await createRole(
                    'create roles',
                    org,
                    {
                        permissions: [PermissionName.create_subjects_20227],
                    }
                ).save()

                const orgMemb = createOrganizationMembership({
                    user: nonAdminUser,
                    organization: org,
                    roles: [createSubjectsRole],
                })
                // eslint-disable-next-line no-await-in-loop
                await orgMemb.save()
                orgMemberships.push(orgMemb)
            }
        })

        context(
            'when uploader is not authorised to upload subjects in the organization',
            () => {
                beforeEach(async () => {
                    for await (const orgMemb of orgMemberships) {
                        orgMemb.roles = Promise.resolve([])
                        await orgMemb.save()
                    }
                })

                it('it throws an authorized code error', async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )

                    const actualErrors = await expect(
                        uploadSubjects(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected

                    actualErrors.errors.map((error: CSVError) => {
                        expect(error.code).to.eq(
                            customErrors.unauthorized_org_upload.code
                        )
                        expect(error.column).to.eq('organization_name')
                        expect(error.entity).to.eq('subject')
                        expect(
                            orgs.map((org) => org.organization_name)
                        ).to.include(error.organizationName)
                    })
                })
            }
        )

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    queryUploadSubjects(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const subjectsCreated = await Subject.count({
                    where: { system: false },
                })
                expect(subjectsCreated).eq(0)
            })
        })

        context('when file data is not correct', () => {
            beforeEach(() => {
                orgs.map(async (org, idx) => {
                    org.organization_name = `Not Company ${idx + 1}`
                    await org.save()
                })
            })

            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    uploadSubjects(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const subjectsCreated = await Subject.count({
                    where: { system: false },
                })
                expect(subjectsCreated).eq(0)
            })
        })

        context('when file data is correct', () => {
            it('should create subjects', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const result = await uploadSubjects(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    arbitraryUserToken
                )
                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)

                const subjectsCreated = await Subject.count({
                    where: { system: false },
                })
                expect(subjectsCreated).gt(0)
            })
        })
    })

    describe('uploadGradesFromCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const correctFilename = 'gradesExample.csv'
        const wrongFilename = 'gradesWrong.csv'
        let nonAdminUser: User
        let orgs: Organization[]
        let orgMemberships: OrganizationMembership[]
        let arbitraryUserToken: string

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()

            orgs = []
            orgMemberships = []

            for (let i = 1; i <= 2; i += 1) {
                const org = createOrganization()
                org.organization_name = `Company ${i}`
                // eslint-disable-next-line no-await-in-loop
                await org.save()
                orgs.push(org)

                // eslint-disable-next-line no-await-in-loop
                const createGradesRole = await createRole(
                    'create grades',
                    org,
                    {
                        permissions: [PermissionName.create_grade_20223],
                    }
                ).save()

                const orgMemb = createOrganizationMembership({
                    user: nonAdminUser,
                    organization: org,
                    roles: [createGradesRole],
                })
                // eslint-disable-next-line no-await-in-loop
                await orgMemb.save()
                orgMemberships.push(orgMemb)
            }

            const noneSpecifiedGrade = new Grade()
            noneSpecifiedGrade.name = 'None Specified'
            noneSpecifiedGrade.system = true
            await connection.manager.save(noneSpecifiedGrade)
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                const filename = correctFilename
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    queryUploadGrades(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const gradesExisting = await Grade.count()
                expect(gradesExisting).eq(1) // Only None Specified grade should exist
            })
        })

        context(
            'when uploader is not authorised to upload grades in the organization',
            () => {
                beforeEach(async () => {
                    for await (const orgMemb of orgMemberships) {
                        orgMemb.roles = Promise.resolve([])
                        await orgMemb.save()
                    }
                })

                it('it throws an authorized code error', async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${correctFilename}`)
                    )

                    const actualErrors = await expect(
                        uploadGrades(
                            testClient,
                            file,
                            correctFilename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected

                    actualErrors.errors.map((error: CSVError) => {
                        expect(error.code).to.eq(
                            customErrors.unauthorized_org_upload.code
                        )
                        expect(error.column).to.eq('organization_name')
                        expect(error.entity).to.eq('grade')
                        expect(
                            orgs.map((org) => org.organization_name)
                        ).to.include(error.organizationName)
                    })
                })
            }
        )

        context('when file data is not correct', () => {
            beforeEach(() => {
                orgs.map(async (org, idx) => {
                    org.organization_name = `Not Company ${idx + 1}`
                    await org.save()
                })
            })

            it('should throw an error', async () => {
                const filename = wrongFilename
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    uploadGrades(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const gradesExisting = await Grade.count()
                expect(gradesExisting).eq(1) // Only None Specified grade should exist
            })
        })

        context('when file data is correct', () => {
            it('should create grades', async () => {
                const filename = correctFilename

                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const result = await uploadGrades(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    arbitraryUserToken
                )
                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)

                const gradesCreated = await Grade.count()
                expect(gradesCreated).gt(0)
            })
        })
    })

    describe('uploadClassesFromCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        let filename = 'classes.csv'
        let nonAdminUser: User
        let org: Organization
        let orgMembership: OrganizationMembership
        let createClassesRole: Role
        let arbitraryUserToken: string

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()

            org = createOrganization()
            org.organization_name = 'my-org'
            await org.save()

            createClassesRole = await createRole('create classes', org, {
                permissions: [PermissionName.create_class_20224],
            }).save()

            orgMembership = await createOrganizationMembership({
                user: nonAdminUser,
                organization: org,
                roles: [createClassesRole],
            }).save()
        })

        context('when operation is not a mutation', () => {
            beforeEach(async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
            })

            it('should throw an error', async () => {
                await expect(
                    queryUploadClasses(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const classesCreated = await Class.count()
                expect(classesCreated).eq(0)
            })
        })

        context(
            'when uploader is not authorised to upload classes to the org',
            () => {
                beforeEach(async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )
                    orgMembership.roles = Promise.resolve([])
                    await orgMembership.save()
                })

                it('throws an unauthorized code error', async () => {
                    const expectedCSVErrors = [
                        buildCsvError(
                            customErrors.unauthorized_org_upload.code,
                            1,
                            'organization_name',
                            customErrors.unauthorized_org_upload.message,
                            {
                                entity: 'class',
                                organizationName: org.organization_name,
                            }
                        ),
                    ]

                    const e = await expect(
                        uploadClasses(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    checkCSVErrorsMatch(e, expectedCSVErrors)
                })
            }
        )

        // TODO : functionality and tests to add: 1) missing column check; 2) duplicate column check
        context('when file data is not correct', () => {
            context('when required fields are missing', () => {
                beforeEach(async () => {
                    file = fs.createReadStream(
                        resolve(
                            `tests/fixtures/classesWithMissingReqFields.csv`
                        )
                    )
                })
                it('should throw an error with correct code', async () => {
                    const expectedCSVErrors = [
                        buildCsvError(
                            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
                            1,
                            'organization_name',
                            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
                            {
                                entity: 'organization',
                                attribute: 'name',
                            }
                        ),
                        buildCsvError(
                            csvErrorConstants.ERR_CSV_MISSING_REQUIRED,
                            1,
                            'class_name',
                            csvErrorConstants.MSG_ERR_CSV_MISSING_REQUIRED,
                            {
                                entity: 'class',
                                attribute: 'name',
                            }
                        ),
                    ]

                    const e = await expect(
                        uploadClasses(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    checkCSVErrorsMatch(e, expectedCSVErrors)

                    const classesCreated = await Class.count()
                    expect(classesCreated).eq(0)
                })
            })

            context('when entities do not exist in the DB', () => {
                beforeEach(async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )
                })
                it('should throw an error with correct code for non-existent organization', async () => {
                    org.organization_name = 'not-my-org'
                    await org.save()

                    const expectedCSVErrors = [
                        buildCsvError(
                            csvErrorConstants.ERR_CSV_NONE_EXIST_ENTITY,
                            1,
                            'organization_name',
                            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_ENTITY,
                            {
                                entity: 'organization',
                                name: 'my-org',
                            }
                        ),
                    ]

                    const e = await expect(
                        uploadClasses(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    checkCSVErrorsMatch(e, expectedCSVErrors)

                    const classesCreated = await Class.count()
                    expect(classesCreated).eq(0)
                })

                it('should throw an error with correct code for non-existent school', async () => {
                    const expectedOrg = createOrganization()
                    expectedOrg.organization_name = 'my-org'
                    await connection.manager.save(expectedOrg)

                    const expectedCSVErrors = [
                        buildCsvError(
                            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                            1,
                            'school_name',
                            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                            {
                                entity: 'school',
                                name: 'test-school',
                                parent_name: 'my-org',
                                parent_entity: 'organization',
                            }
                        ),
                    ]

                    const e = await expect(
                        uploadClasses(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    checkCSVErrorsMatch(e, expectedCSVErrors)

                    const classesCreated = await Class.count()
                    expect(classesCreated).eq(0)
                })

                it('should throw an error with correct code for non-existent program', async () => {
                    const expectedSchool = createSchool(org, 'test-school')
                    await connection.manager.save(expectedSchool)

                    const expectedAcademicTerm = createAcademicTerm(
                        expectedSchool
                    )
                    expectedAcademicTerm.name = 'test academic term'
                    await connection.manager.save(expectedAcademicTerm)

                    const expectedCSVErrors = [
                        buildCsvError(
                            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                            1,
                            'program_name',
                            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                            {
                                entity: 'program',
                                name: 'outdoor activities',
                                parent_name: 'my-org',
                                parent_entity: 'organization',
                            }
                        ),
                    ]

                    const e = await expect(
                        uploadClasses(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    checkCSVErrorsMatch(e, expectedCSVErrors)

                    const classesCreated = await Class.count()
                    expect(classesCreated).eq(0)
                })

                it('should throw an error with correct code for non-existent grade', async () => {
                    const expectedSchool = createSchool(org, 'test-school')
                    await connection.manager.save(expectedSchool)

                    const expectedProg = createProgram(org)
                    expectedProg.name = 'outdoor activities'
                    await connection.manager.save(expectedProg)

                    const expectedAcademicTerm = createAcademicTerm(
                        expectedSchool
                    )
                    expectedAcademicTerm.name = 'test academic term'
                    await connection.manager.save(expectedAcademicTerm)

                    const expectedCSVErrors = [
                        buildCsvError(
                            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                            1,
                            'grade_name',
                            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                            {
                                entity: 'grade',
                                name: 'first grade',
                                parent_name: 'my-org',
                                parent_entity: 'organization',
                            }
                        ),
                    ]

                    const e = await expect(
                        uploadClasses(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    checkCSVErrorsMatch(e, expectedCSVErrors)

                    const classesCreated = await Class.count()
                    expect(classesCreated).eq(0)
                })

                it('should throw an error with correct code for non-existent subject', async () => {
                    const expectedSchool = createSchool(org, 'test-school')
                    await connection.manager.save(expectedSchool)

                    const expectedProg = createProgram(org)
                    expectedProg.name = 'outdoor activities'
                    await connection.manager.save(expectedProg)

                    const expectedGrade = createGrade(org)
                    expectedGrade.name = 'first grade'
                    await connection.manager.save(expectedGrade)

                    const expectedAcademicTerm = createAcademicTerm(
                        expectedSchool
                    )
                    expectedAcademicTerm.name = 'test academic term'
                    await connection.manager.save(expectedAcademicTerm)

                    const expectedCSVErrors = [
                        buildCsvError(
                            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                            1,
                            'subject_name',
                            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                            {
                                entity: 'subject',
                                name: 'pilates',
                                parent_name: 'my-org',
                                parent_entity: 'organization',
                            }
                        ),
                    ]

                    const e = await expect(
                        uploadClasses(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    checkCSVErrorsMatch(e, expectedCSVErrors)

                    const classesCreated = await Class.count()
                    expect(classesCreated).eq(0)
                })

                it('should throw an error with correct code for non-existent age range', async () => {
                    const expectedSchool = createSchool(org, 'test-school')
                    await connection.manager.save(expectedSchool)

                    const expectedProg = createProgram(org)
                    expectedProg.name = 'outdoor activities'
                    await connection.manager.save(expectedProg)

                    const expectedGrade = createGrade(org)
                    expectedGrade.name = 'first grade'
                    await connection.manager.save(expectedGrade)

                    const expectedSubject = createSubject(org)
                    expectedSubject.name = 'pilates'
                    await connection.manager.save(expectedSubject)

                    const expectedAcademicTerm = createAcademicTerm(
                        expectedSchool
                    )
                    expectedAcademicTerm.name = 'test academic term'
                    await connection.manager.save(expectedAcademicTerm)

                    const expectedCSVErrors = [
                        buildCsvError(
                            csvErrorConstants.ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                            1,
                            'age_range_low_value, age_range_high_value, age_range_unit',
                            csvErrorConstants.MSG_ERR_CSV_NONE_EXIST_CHILD_ENTITY,
                            {
                                entity: 'ageRange',
                                name: '5 - 7 year(s)',
                                parent_name: 'my-org',
                                parent_entity: 'organization',
                            }
                        ),
                    ]

                    const e = await expect(
                        uploadClasses(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    checkCSVErrorsMatch(e, expectedCSVErrors)

                    const classesCreated = await Class.count()
                    expect(classesCreated).eq(0)
                })
            })

            context('when input has invalid formatting', () => {
                beforeEach(async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/classesWithInvalidNames.csv`)
                    )
                })
                it('should throw an error with correct code for invalid class names', async () => {
                    const expectedCSVErrors = [
                        buildCsvError(
                            customErrors.invalid_alphanumeric_special.code,
                            1,
                            'class_name',
                            customErrors.invalid_alphanumeric_special.message,
                            {
                                entity: 'class',
                                attribute: 'name',
                            }
                        ),
                        buildCsvError(
                            csvErrorConstants.ERR_CSV_INVALID_LENGTH,
                            2,
                            'class_name',
                            csvErrorConstants.MSG_ERR_CSV_INVALID_LENGTH,
                            {
                                entity: 'class',
                                attribute: 'name',
                                max: config.limits.CLASS_NAME_MAX_LENGTH,
                            }
                        ),
                    ]

                    const e = await expect(
                        uploadClasses(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    checkCSVErrorsMatch(e, expectedCSVErrors)

                    const classesCreated = await Class.count()
                    expect(classesCreated).eq(0)
                })
            })

            context(
                'when class already exists in a parent entity in the DB',
                () => {
                    let expectedSchool: School

                    beforeEach(async () => {
                        file = fs.createReadStream(
                            resolve(`tests/fixtures/${filename}`)
                        )

                        expectedSchool = createSchool(org, 'test-school')
                        await connection.manager.save(expectedSchool)
                    })
                    it('throws an error with correct code for organization parent entity', async () => {
                        const existentClass = createClass(undefined, org)
                        existentClass.class_name = 'class1'
                        await connection.manager.save(existentClass)

                        const expectedCSVErrors = [
                            buildCsvError(
                                csvErrorConstants.ERR_CSV_DUPLICATE_ENTITY,
                                1,
                                'class_name',
                                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_ENTITY,
                                {
                                    entity: 'class',
                                    name: 'class1',
                                }
                            ),
                        ]

                        const e = await expect(
                            uploadClasses(
                                testClient,
                                file,
                                filename,
                                mimetype,
                                encoding,
                                arbitraryUserToken
                            )
                        ).to.be.rejected
                        checkCSVErrorsMatch(e, expectedCSVErrors)

                        const classesCreated = await Class.count()
                        expect(classesCreated).eq(1) // For the class that already exists
                    })

                    it('throws an error with correct code for duplicate shortcode child entity in org', async () => {
                        const existentClass = createClass(undefined, org)
                        existentClass.class_name = 'class1-differentname'
                        existentClass.shortcode = 'CSCODE'
                        await connection.manager.save(existentClass)

                        const expectedCSVErrors = [
                            buildCsvError(
                                csvErrorConstants.ERR_CSV_DUPLICATE_CHILD_ENTITY,
                                1,
                                'class_shortcode',
                                csvErrorConstants.MSG_ERR_CSV_DUPLICATE_CHILD_ENTITY,
                                {
                                    name: 'CSCODE',
                                    entity: 'shortcode',
                                    parent_name: 'class1-differentname',
                                    parent_entity: 'class',
                                }
                            ),
                        ]

                        const e = await expect(
                            uploadClasses(
                                testClient,
                                file,
                                filename,
                                mimetype,
                                encoding,
                                arbitraryUserToken
                            )
                        ).to.be.rejected
                        checkCSVErrorsMatch(e, expectedCSVErrors)

                        const classesCreated = await Class.count()
                        expect(classesCreated).eq(1) // For the class that already exists
                    })
                }
            )
        })

        context('when file data is correct', () => {
            let expectedProg: Program
            let noneSpecifiedProg: Program
            let expectedSchool: School
            let expectedGrade: Grade
            let expectedSubject: Subject
            let expectedAgeRange: AgeRange
            let expectedAcademicTerm: AcademicTerm

            beforeEach(async () => {
                filename = 'classes.csv'
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                expectedProg = createProgram(org)
                expectedProg.name = 'outdoor activities'
                await connection.manager.save(expectedProg)

                noneSpecifiedProg = createPrograms(1, org)[0]
                noneSpecifiedProg.name = 'None Specified'
                await connection.manager.save(noneSpecifiedProg)

                expectedSchool = createSchool(org, 'test-school')
                await connection.manager.save(expectedSchool)

                expectedGrade = createGrade(org)
                expectedGrade.name = 'first grade'
                await connection.manager.save(expectedGrade)

                expectedSubject = createSubject(org)
                expectedSubject.name = 'pilates'
                await connection.manager.save(expectedSubject)

                expectedAgeRange = createAgeRange(org, 5, 7)
                expectedAgeRange.name = '5 - 7 year(s)'
                expectedAgeRange.low_value_unit = AgeRangeUnit.YEAR
                expectedAgeRange.high_value_unit = AgeRangeUnit.YEAR
                await connection.manager.save(expectedAgeRange)

                expectedAcademicTerm = createAcademicTerm(expectedSchool)
                expectedAcademicTerm.name = 'test academic term'
                await connection.manager.save(expectedAcademicTerm)
            })

            it('should create classes', async () => {
                const result = await uploadClasses(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    arbitraryUserToken
                )
                const dbClass = await Class.findOneOrFail({
                    where: { class_name: 'class1', organization: org },
                    relations: ['programs', 'grades', 'subjects', 'age_ranges'],
                })
                const schools = (await dbClass.schools) || []
                const programs = (await dbClass.programs) || []
                const grades = (await dbClass.grades) || []
                const subjects = (await dbClass.subjects) || []
                const ageRanges = (await dbClass.age_ranges) || []

                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)
                expect(schools.length).to.equal(1)
                expect(programs.length).to.equal(1)
                expect(grades.length).to.equal(1)
                expect(subjects.length).to.equal(1)
                expect(ageRanges.length).to.equal(1)
            })

            context(
                'when program, grade, subject, and age range are unspecified',
                () => {
                    it('should assign None Specified program but none for grade, subject, and age range', async () => {
                        filename = 'classesEmptyNonReqFields.csv'
                        file = fs.createReadStream(
                            resolve(`tests/fixtures/${filename}`)
                        )

                        const result = await uploadClasses(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                        const dbClass = await Class.findOneOrFail({
                            where: {
                                class_name: 'class1',
                                organization: org,
                            },
                            relations: [
                                'programs',
                                'grades',
                                'subjects',
                                'age_ranges',
                            ],
                        })
                        const programs = (await dbClass.programs) || []
                        const grades = (await dbClass.grades) || []
                        const subjects = (await dbClass.subjects) || []
                        const ageRanges = (await dbClass.age_ranges) || []

                        expect(programs.length).to.equal(1)
                        expect(grades).to.be.empty
                        expect(subjects).to.be.empty
                        expect(ageRanges).to.be.empty
                    })
                }
            )
        })
    })

    describe('uploadSchoolsFromCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const filename = 'schoolsExample.csv'
        let nonAdminUser: User
        let orgs: Organization[]
        let orgMemberships: OrganizationMembership[]
        let arbitraryUserToken: string

        beforeEach(async () => {
            await AgeRangesInitializer.run()
            await GradesInitializer.run()
            await SubjectsInitializer.run()
            await SubcategoriesInitializer.run()
            await CategoriesInitializer.run()
            await ProgramsInitializer.run()
            nonAdminUser = await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()

            orgs = []
            orgMemberships = []

            for (let i = 1; i <= 4; i += 1) {
                const org = createOrganization()
                org.organization_name = `Company ${i}`
                // eslint-disable-next-line no-await-in-loop
                await org.save()
                orgs.push(org)

                // eslint-disable-next-line no-await-in-loop
                const createSchoolsRole = await createRole(
                    `create schools ${i}`,
                    org,
                    { permissions: [PermissionName.create_school_20220] }
                ).save()

                const orgMembership = createOrganizationMembership({
                    user: nonAdminUser,
                    organization: org,
                    roles: [createSchoolsRole],
                })
                // eslint-disable-next-line no-await-in-loop
                await orgMembership.save()
                orgMemberships.push(orgMembership)
            }
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
                await expect(
                    queryUploadSchools(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const schoolsCreated = await School.count()
                expect(schoolsCreated).eq(0)
            })
        })

        context(
            'when uploader is not authorised to upload schools in the organization',
            () => {
                beforeEach(async () => {
                    for await (const orgMemb of orgMemberships) {
                        orgMemb.roles = Promise.resolve([])
                        await orgMemb.save()
                    }
                })

                it('it throws an authorized code error', async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )

                    const actualErrors = await expect(
                        uploadSchools(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    actualErrors.errors.map((error: CSVError) => {
                        expect(error.code).to.eq(
                            customErrors.unauthorized_org_upload.code
                        )
                        expect(error.column).to.eq('organization_name')
                        expect(error.entity).to.eq('school')
                        expect(
                            orgs.map((org) => org.organization_name)
                        ).to.include(error.organizationName)
                    })
                })
            }
        )

        context('when file data is not correct', () => {
            beforeEach(() => {
                orgs.map(async (org, idx) => {
                    org.organization_name = `Not Company ${idx + 1}`
                    await org.save()
                })
            })

            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
                await expect(
                    uploadSchools(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const schoolsCreated = await School.count()
                expect(schoolsCreated).eq(0)
            })
        })
        context('when file data is correct', () => {
            it('should create schools', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const result = await uploadSchools(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    arbitraryUserToken
                )
                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)

                const schoolsCreated = await School.count()
                expect(schoolsCreated).eq(6)
            })
        })
    })

    describe('uploadSubCategoriesFromCSV', () => {
        const filename = 'subcategories.csv'
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        let nonAdminUser: User
        let org: Organization
        let orgMembership: OrganizationMembership
        let arbitraryUserToken: string

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()

            org = createOrganization()
            org.organization_name = 'my-org'
            await org.save()

            const createSubcategoriesRole = await createRole(
                `create subcategories`,
                org,
                { permissions: [PermissionName.create_subjects_20227] }
            ).save()

            orgMembership = await createOrganizationMembership({
                user: nonAdminUser,
                organization: org,
                roles: [createSubcategoriesRole],
            }).save()
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
                await expect(
                    queryUploadSubCategories(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const subCategoriesCreated = await Subcategory.count()
                expect(subCategoriesCreated).eq(0)
            })
        })

        context(
            'when uploader is not authorised to upload subcategories in the organization',
            () => {
                beforeEach(async () => {
                    orgMembership.roles = Promise.resolve([])
                    await orgMembership.save()
                })

                it('it throws an authorized code error', async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )

                    const actualErrors = await expect(
                        uploadSubCategories(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    actualErrors.errors.map((error: CSVError) => {
                        expect(error.code).to.eq(
                            customErrors.unauthorized_org_upload.code
                        )
                        expect(error.column).to.eq('organization_name')
                        expect(error.entity).to.eq('subcategory')
                        expect(error.organizationName).to.eq(
                            org.organization_name
                        )
                    })
                })
            }
        )

        context('when file data is not correct', () => {
            beforeEach(async () => {
                org.organization_name = 'not-my-org'
                await org.save()
            })

            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
                await expect(
                    uploadSubCategories(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const subCategoriesCreated = await Subcategory.count()
                expect(subCategoriesCreated).eq(0)
            })
        })

        context('when file data is correct', () => {
            it('should create subcategories', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const result = await uploadSubCategories(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    arbitraryUserToken
                )

                const dbSubcategory = await Subcategory.findOneOrFail({
                    where: { name: 'sc1', organization: org },
                })

                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)
                expect(dbSubcategory).to.be.not.null
            })
        })
    })

    describe('uploadUsersFromCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const filename = 'users_example.csv'

        let arbitraryUserToken: string

        beforeEach(async () => {
            await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    queryUploadUsers(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding
                    )
                ).to.be.rejected

                const usersCount = await User.count()
                expect(usersCount).eq(1)
            })
        })

        context('when file data is not correct', () => {
            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    uploadUsers(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        false,
                        { authorization: arbitraryUserToken }
                    )
                ).to.be.rejected

                const usersCount = await User.count()
                expect(usersCount).eq(1)
            })

            it('should throw errors when missing both user email and phone', async () => {
                const filename = 'usersWithErrors.csv'
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const expectedCSVError = buildCsvError(
                    customErrors.missing_required_either.code,
                    1,
                    'user_username',
                    customErrors.missing_required_either.message,
                    {
                        entity: 'User',
                        attribute: 'Username',
                        otherAttribute: 'Phone or Email',
                        key: 'user_username',
                        label: 'user_username',
                    }
                )

                const e = await expect(
                    uploadUsers(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        false,
                        { authorization: arbitraryUserToken }
                    )
                ).to.be.rejected
                checkCSVErrorsMatch(e, [expectedCSVError])

                const usersCount = await User.count()
                expect(usersCount).eq(1)
            })

            it('should throw errors when user email is invalid', async () => {
                const filename = 'usersWithInvalidEmail.csv'
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const expectedCSVError = buildCsvError(
                    customErrors.invalid_email.code,
                    1,
                    'user_email',
                    customErrors.invalid_email.message,
                    {
                        entity: 'User',
                        attribute: 'Email',
                        name: 'email',
                        regex: {},
                        label: 'user_email',
                        key: 'user_email',
                    }
                )

                const e = await expect(
                    uploadUsers(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        false,
                        { authorization: arbitraryUserToken }
                    )
                ).to.be.rejected
                checkCSVErrorsMatch(e, [expectedCSVError])

                const usersCount = await User.count()
                expect(usersCount).eq(1)
            })

            it('should throw errors when user phone is invalid', async () => {
                const filename = 'usersWithInvalidPhone.csv'
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const expectedCSVError = buildCsvError(
                    customErrors.invalid_phone.code,
                    1,
                    'user_phone',
                    customErrors.invalid_phone.message,
                    {
                        entity: 'User',
                        attribute: 'Phone',
                        name: 'phone',
                        label: 'user_phone',
                        key: 'user_phone',
                    }
                )

                const e = await expect(
                    uploadUsers(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        false,
                        { authorization: arbitraryUserToken }
                    )
                ).to.be.rejected
                checkCSVErrorsMatch(e, [expectedCSVError])

                const usersCount = await User.count()
                expect(usersCount).eq(1)
            })

            it('should throw errors when header is missing column', async () => {
                const filename = 'usersWithMissingHeaderColumn.csv'
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const expectedCSVError = buildCsvError(
                    customErrors.csv_missing_required_column.code,
                    0,
                    'organization_name',
                    customErrors.csv_missing_required_column.message,
                    {
                        fileName: filename,
                        columnName: 'organization_name',
                    }
                )

                const e = await expect(
                    uploadUsers(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        false,
                        { authorization: arbitraryUserToken }
                    )
                ).to.be.rejected
                checkCSVErrorsMatch(e, [expectedCSVError])

                const usersCount = await User.count()
                expect(usersCount).eq(1)
            })

            it('should throw errors when header has duplicate column', async () => {
                const filename = 'usersWithDuplicateHeaderColumn.csv'
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const expectedCSVError = buildCsvError(
                    customErrors.csv_duplicate_column.code,
                    0,
                    'user_family_name',
                    customErrors.csv_duplicate_column.message,
                    {
                        fileName: filename,
                        columnName: 'user_family_name',
                    }
                )

                const e = await expect(
                    uploadUsers(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        false,
                        { authorization: arbitraryUserToken }
                    )
                ).to.be.rejected
                checkCSVErrorsMatch(e, [expectedCSVError])

                const usersCount = await User.count()
                expect(usersCount).eq(1)
            })
        })

        context('when file data is correct', () => {
            let organization: Organization
            let role: Role
            let school: School
            let cls: Class

            beforeEach(async () => {
                organization = createOrganization()
                organization.organization_name = 'Apollo 1 Org'
                await connection.manager.save(organization)
                school = createSchool(organization)
                school.school_name = 'School I'
                await connection.manager.save(school)

                const permNames = {
                    permissions: [
                        PermissionName.upload_users_40880,
                        PermissionName.attend_live_class_as_a_teacher_186,
                        PermissionName.attend_live_class_as_a_student_187,
                    ],
                }
                role = createRole('Teacher', organization, permNames)
                await connection.manager.save(role)
                const anotherRole = createRole(
                    'School Admin',
                    organization,
                    permNames
                )
                await connection.manager.save(anotherRole)

                cls = createClass([school], organization)
                cls.class_name = 'Class I'
                await connection.manager.save(cls)
                const adminUser = await createAdminUser(testClient)

                const membership = createOrganizationMembership({
                    user: adminUser,
                    organization,
                })
                membership.roles = Promise.resolve([role])
                await membership.save()
            })

            it('should create the user', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const result = await uploadUsers(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    false,
                    { authorization: getAdminAuthToken() }
                )

                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)

                const usersCount = await User.count({
                    where: { email: 'test@test.com' },
                })
                expect(usersCount).eq(2)
                const dbUser = await User.findOne({
                    where: { email: 'test@test.com', given_name: 'Three' },
                })
                expect(dbUser).to.exist
                expect(dbUser?.date_of_birth).to.equal('06-2018')
            })

            it('should not create user on dry run', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
                const dryRun = true

                const result = await uploadUsers(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    dryRun,
                    { authorization: getAdminAuthToken() }
                )

                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)

                const usersCount = await User.count({
                    where: { email: 'test@test.com' },
                })
                expect(usersCount).eq(0)
            })
            context('when file data data has alternate contact info', () => {
                const filename = 'users_example_with_alternative_contacts.csv'
                it('should create the users with alternate contact info', async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )

                    const result = await uploadUsers(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        false,
                        { authorization: getAdminAuthToken() }
                    )

                    const usersCount = await User.count({
                        where: { email: 'test@test.com' },
                    })
                    expect(usersCount).eq(2)
                    const dbUser = await User.findOne({
                        where: {
                            email: 'test@test.com',
                            given_name: 'One',
                        },
                    })
                    expect(dbUser).to.exist
                    expect(dbUser?.alternate_email).to.equal('testa@test.com')
                    const dbUser2 = await User.findOne({
                        where: {
                            email: 'test@test.com',
                            given_name: 'Three',
                        },
                    })
                    expect(dbUser2).to.exist
                    expect(dbUser2?.alternate_phone).to.equal('+4444444444444')
                })
            })
        })
    })

    describe('uploadCategoriesFromCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const filename = 'categoriesExample.csv'
        let nonAdminUser: User
        let orgs: Organization[]
        let orgMemberships: OrganizationMembership[]
        let arbitraryUserToken: string

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()

            orgs = []
            orgMemberships = []

            for (let i = 1; i <= 2; i += 1) {
                const org = createOrganization()
                org.organization_name = `Company ${i}`
                // eslint-disable-next-line no-await-in-loop
                await org.save()
                orgs.push(org)

                const subcategory = createSubcategory(org)
                subcategory.name = `Subcategory ${i}`
                // eslint-disable-next-line no-await-in-loop
                await subcategory.save()

                // eslint-disable-next-line no-await-in-loop
                const createCategoriesRole = await createRole(
                    `create categories`,
                    org,
                    { permissions: [PermissionName.create_subjects_20227] }
                ).save()

                // eslint-disable-next-line no-await-in-loop
                const orgMembership = await createOrganizationMembership({
                    user: nonAdminUser,
                    organization: org,
                    roles: [createCategoriesRole],
                }).save()
                orgMemberships.push(orgMembership)
            }

            const noneSpecifiedSubcategory = new Subcategory()
            noneSpecifiedSubcategory.name = 'None Specified'
            noneSpecifiedSubcategory.system = true
            await connection.manager.save(noneSpecifiedSubcategory)
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    queryUploadCategories(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const categoriesCreated = await Category.count({
                    where: { system: false },
                })
                expect(categoriesCreated).eq(0)
            })
        })

        context(
            'when uploader is not authorised to upload categories in the organization',
            () => {
                beforeEach(async () => {
                    for await (const orgMemb of orgMemberships) {
                        orgMemb.roles = Promise.resolve([])
                        await orgMemb.save()
                    }
                })

                it('it throws an authorized code error', async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )

                    const actualErrors = await expect(
                        uploadCategories(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    actualErrors.errors.map((error: CSVError) => {
                        expect(error.code).to.eq(
                            customErrors.unauthorized_org_upload.code
                        )
                        expect(error.column).to.eq('organization_name')
                        expect(error.entity).to.eq('category')
                        expect(
                            orgs.map((org) => org.organization_name)
                        ).to.include(error.organizationName)
                    })
                })
            }
        )

        context('when file data is not correct', () => {
            beforeEach(() => {
                orgs.map(async (org, idx) => {
                    org.organization_name = `Not Company ${idx + 1}`
                    await org.save()
                })
            })

            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    uploadCategories(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const categoriesCreated = await Category.count({
                    where: { system: false },
                })
                expect(categoriesCreated).eq(0)
            })
        })

        context('when file data is correct', () => {
            it('should create categories', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const result = await uploadCategories(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    arbitraryUserToken
                )
                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)

                const categoriesCreated = await Category.count({
                    where: { system: false },
                })
                expect(categoriesCreated).gt(0)
            })
        })
    })

    describe('uploadProgramsFromCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const filename = 'programsExample.csv'
        let nonAdminUser: User
        let orgs: Organization[]
        let orgMemberships: OrganizationMembership[]
        let arbitraryUserToken: string

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()

            orgs = []
            orgMemberships = []

            for (let i = 1; i <= 3; i += 1) {
                const org = createOrganization()
                org.organization_name = `Company ${i}`
                // eslint-disable-next-line no-await-in-loop
                await org.save()
                orgs.push(org)

                // eslint-disable-next-line no-await-in-loop
                const createProgramsRole = await createRole(
                    `create programs`,
                    org,
                    { permissions: [PermissionName.create_program_20221] }
                ).save()

                // eslint-disable-next-line no-await-in-loop
                const orgMembership = await createOrganizationMembership({
                    user: nonAdminUser,
                    organization: org,
                    roles: [createProgramsRole],
                }).save()
                orgMemberships.push(orgMembership)

                for (let j = 1; j <= 3; j += 1) {
                    const subject = createSubject(org)
                    subject.name = `Subject ${j}`
                    // eslint-disable-next-line no-await-in-loop
                    await subject.save()
                }

                const ageRange1 = createAgeRange(org)
                ageRange1.name = '6 - 7 year(s)'
                ageRange1.low_value = 6
                ageRange1.high_value = 7
                ageRange1.low_value_unit = AgeRangeUnit.YEAR
                ageRange1.high_value_unit = AgeRangeUnit.YEAR
                // eslint-disable-next-line no-await-in-loop
                await ageRange1.save()

                const ageRange2 = createAgeRange(org)
                ageRange2.name = '9 - 10 year(s)'
                ageRange2.low_value = 9
                ageRange2.high_value = 10
                ageRange2.low_value_unit = AgeRangeUnit.YEAR
                ageRange2.high_value_unit = AgeRangeUnit.YEAR
                // eslint-disable-next-line no-await-in-loop
                await ageRange2.save()

                const ageRange3 = createAgeRange(org)
                ageRange3.name = '24 - 30 month(s)'
                ageRange3.low_value = 24
                ageRange3.high_value = 30
                ageRange3.low_value_unit = AgeRangeUnit.MONTH
                ageRange3.high_value_unit = AgeRangeUnit.MONTH
                ageRange3.system = false
                // eslint-disable-next-line no-await-in-loop
                await ageRange3.save()

                const grade1 = createGrade(org)
                grade1.name = 'First Grade'
                // eslint-disable-next-line no-await-in-loop
                await grade1.save()

                const grade2 = createGrade(org)
                grade2.name = 'Second Grade'
                // eslint-disable-next-line no-await-in-loop
                await grade2.save()

                const grade3 = createGrade(org)
                grade3.name = 'Third Grade'
                // eslint-disable-next-line no-await-in-loop
                await grade3.save()
            }

            const noneSpecifiedAgeRange = new AgeRange()
            noneSpecifiedAgeRange.name = 'None Specified'
            noneSpecifiedAgeRange.low_value = 0
            noneSpecifiedAgeRange.high_value = 99
            noneSpecifiedAgeRange.low_value_unit = AgeRangeUnit.YEAR
            noneSpecifiedAgeRange.high_value_unit = AgeRangeUnit.YEAR
            noneSpecifiedAgeRange.system = true
            await connection.manager.save(noneSpecifiedAgeRange)

            const noneSpecifiedGrade = new Grade()
            noneSpecifiedGrade.name = 'None Specified'
            noneSpecifiedGrade.system = true
            await connection.manager.save(noneSpecifiedGrade)

            const noneSpecifiedSubject = new Subject()
            noneSpecifiedSubject.name = 'None Specified'
            noneSpecifiedSubject.system = true
            await connection.manager.save(noneSpecifiedSubject)
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
                await expect(
                    queryUploadPrograms(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding
                    )
                ).to.be.rejected

                const programsCreated = await Program.count({
                    where: { system: false },
                })
                expect(programsCreated).eq(0)
            })
        })

        context(
            'when uploader is not authorised to upload programs in the organization',
            () => {
                beforeEach(async () => {
                    for await (const orgMemb of orgMemberships) {
                        orgMemb.roles = Promise.resolve([])
                        await orgMemb.save()
                    }
                })

                it('it throws an authorized code error', async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )

                    const actualErrors = await expect(
                        uploadPrograms(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    actualErrors.errors.map((error: CSVError) => {
                        expect(error.code).to.eq(
                            customErrors.unauthorized_org_upload.code
                        )
                        expect(error.column).to.eq('organization_name')
                        expect(error.entity).to.eq('program')
                        expect(
                            orgs.map((org) => org.organization_name)
                        ).to.include(error.organizationName)
                    })
                })
            }
        )

        context('when file data is not correct', () => {
            beforeEach(() => {
                orgs.map(async (org, idx) => {
                    org.organization_name = `Not Company ${idx + 1}`
                    await org.save()
                })
            })

            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )
                await expect(
                    uploadPrograms(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const programsCreated = await Program.count({
                    where: { system: false },
                })
                expect(programsCreated).eq(0)
            })

            it('should throw errors when age range fields are not all present or all omitted', async () => {
                const priorUserCount = await User.count()

                const filename = 'programsWithErrors.csv'
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const expectedCSVError = buildCsvError(
                    csvErrorConstants.ERR_PROGRAM_AGE_RANGE_FIELDS_EXIST,
                    1,
                    'age_range_high_value, age_range_low_value, age_range_unit',
                    csvErrorConstants.MSG_ERR_PROGRAM_AGE_RANGE_FIELDS_EXIST,
                    {}
                )

                const e = await expect(
                    uploadPrograms(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected
                checkCSVErrorsMatch(e, [expectedCSVError])

                const usersCount = await User.count()
                expect(usersCount).eq(priorUserCount)
            })
        })

        context('when file data is correct', () => {
            it('should create programs', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const result = await uploadPrograms(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    arbitraryUserToken
                )

                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)

                const programsCreated = await Program.count({
                    where: { system: false },
                })
                expect(programsCreated).eq(12)
            })
        })
    })

    describe('uploadAgeRangesFromCSV', () => {
        let file: ReadStream
        const mimetype = 'text/csv'
        const encoding = '7bit'
        const filename = 'ageRangesExample.csv'
        let nonAdminUser: User
        let orgs: Organization[]
        let orgMemberships: OrganizationMembership[]
        let arbitraryUserToken: string

        beforeEach(async () => {
            nonAdminUser = await createNonAdminUser(testClient)
            arbitraryUserToken = getNonAdminAuthToken()

            orgs = []
            orgMemberships = []

            for (let i = 1; i <= 2; i += 1) {
                const org = createOrganization()
                org.organization_name = `Company ${i}`
                // eslint-disable-next-line no-await-in-loop
                await org.save()
                orgs.push(org)

                // eslint-disable-next-line no-await-in-loop
                const createAgeRangesRole = await createRole(
                    `create age ranges`,
                    org,
                    { permissions: [PermissionName.create_age_range_20222] }
                ).save()

                // eslint-disable-next-line no-await-in-loop
                const orgMembership = await createOrganizationMembership({
                    user: nonAdminUser,
                    organization: org,
                    roles: [createAgeRangesRole],
                }).save()
                orgMemberships.push(orgMembership)
            }
        })

        context('when operation is not a mutation', () => {
            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    queryUploadAgeRanges(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const ageRangesCreated = await AgeRange.count({
                    where: { system: false },
                })
                expect(ageRangesCreated).eq(0)
            })
        })

        context(
            'when uploader is not authorised to upload age ranges in the organization',
            () => {
                beforeEach(async () => {
                    for await (const orgMemb of orgMemberships) {
                        orgMemb.roles = Promise.resolve([])
                        await orgMemb.save()
                    }
                })

                it('it throws an authorized code error', async () => {
                    file = fs.createReadStream(
                        resolve(`tests/fixtures/${filename}`)
                    )

                    const actualErrors = await expect(
                        uploadAgeRanges(
                            testClient,
                            file,
                            filename,
                            mimetype,
                            encoding,
                            arbitraryUserToken
                        )
                    ).to.be.rejected
                    actualErrors.errors.map((error: CSVError) => {
                        expect(error.code).to.eq(
                            customErrors.unauthorized_org_upload.code
                        )
                        expect(error.column).to.eq('organization_name')
                        expect(error.entity).to.eq('age range')
                        expect(
                            orgs.map((org) => org.organization_name)
                        ).to.include(error.organizationName)
                    })
                })
            }
        )

        context('when file data is not correct', () => {
            beforeEach(() => {
                orgs.map(async (org, idx) => {
                    org.organization_name = `Not Company ${idx + 1}`
                    await org.save()
                })
            })

            it('should throw an error', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    uploadAgeRanges(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejected

                const ageRangesCreated = await AgeRange.count({
                    where: { system: false },
                })
                expect(ageRangesCreated).eq(0)
            })
        })

        context('when file data has multiple errors', () => {
            it('should return multiple errors', async () => {
                const filename = 'ageRangesMultipleErrorsExample.csv'
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                await expect(
                    uploadAgeRanges(
                        testClient,
                        file,
                        filename,
                        mimetype,
                        encoding,
                        arbitraryUserToken
                    )
                ).to.be.rejectedWith(CustomError)

                const ageRangesCreated = await AgeRange.count({
                    where: { system: false },
                })
                expect(ageRangesCreated).eq(0)
            })
        })

        context('when file data is correct', () => {
            it('should create age ranges', async () => {
                file = fs.createReadStream(
                    resolve(`tests/fixtures/${filename}`)
                )

                const result = await uploadAgeRanges(
                    testClient,
                    file,
                    filename,
                    mimetype,
                    encoding,
                    arbitraryUserToken
                )
                expect(result.filename).eq(filename)
                expect(result.mimetype).eq(mimetype)
                expect(result.encoding).eq(encoding)

                const ageRangesCreated = await AgeRange.count({
                    where: { system: false },
                })
                expect(ageRangesCreated).eq(17)
            })
        })
    })
})
