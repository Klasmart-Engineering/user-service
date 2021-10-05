import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { AgeRange } from '../../../src/entities/ageRange'
import { AgeRangeUnit } from '../../../src/entities/ageRangeUnit'
import { Class } from '../../../src/entities/class'
import { Grade } from '../../../src/entities/grade'
import { Organization } from '../../../src/entities/organization'
import { Program } from '../../../src/entities/program'
import { School } from '../../../src/entities/school'
import { Status } from '../../../src/entities/status'
import { Subject } from '../../../src/entities/subject'
import { User } from '../../../src/entities/user'
import AgeRangesInitializer from '../../../src/initializers/ageRanges'
import { Model } from '../../../src/model'
import { createServer } from '../../../src/utils/createServer'
import { createAgeRange } from '../../factories/ageRange.factory'
import { createClass } from '../../factories/class.factory'
import { createGrade } from '../../factories/grade.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createProgram } from '../../factories/program.factory'
import { createSchool } from '../../factories/school.factory'
import { createSubject } from '../../factories/subject.factory'
import { createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { classNode } from '../../utils/operations/modelOps'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import {
    addUserToOrganizationAndValidate,
    getSystemRoleIds,
} from '../../utils/operations/organizationOps'
import { addUserToSchool } from '../../utils/operations/schoolOps'
import { userToPayload } from '../../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'

use(chaiAsPromised)

describe('classNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let orgOwner: User
    let schoolAdmin: User
    let orgMember: User
    let ownerAndSchoolAdmin: User
    let org1: Organization
    let org2: Organization
    let org3: Organization
    let org1Classes: Class[] = []
    let org2Classes: Class[] = []
    let org3Classes: Class[] = []
    let classes: Class[] = []
    let org3Schools: School[] = []
    let ageRanges: AgeRange[] = []
    let grades: Grade[] = []
    let subjects: Subject[] = []
    let programs: Program[] = []

    const classesCount = 12
    const ageRangesCount = 6
    const gradesCount = 4
    const subjectsCount = 3
    const schoolsCount = 3
    const programsCount = 2

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        await AgeRangesInitializer.run()

        const systemRoles = await getSystemRoleIds()
        const schoolAdminRoleId = systemRoles['School Admin']
        const orgAdminRoleId = systemRoles['Organization Admin']
        const noneSpecifiedAgeRange = await connection.manager.findOneOrFail(
            AgeRange,
            {
                where: { name: 'None Specified', system: true },
            }
        )

        admin = await createAdminUser(testClient)
        orgOwner = await createUser()
        schoolAdmin = await createUser()
        orgMember = await createUser()
        ownerAndSchoolAdmin = await createUser()

        org1 = await createOrganization(admin)
        org2 = await createOrganization(ownerAndSchoolAdmin)
        org3 = await createOrganization(orgOwner)

        await connection.manager.save([
            orgOwner,
            schoolAdmin,
            orgMember,
            ownerAndSchoolAdmin,
        ])
        await connection.manager.save([org1, org2, org3])

        org1Classes = []
        org2Classes = []
        org3Classes = []
        classes = []
        org3Schools = []
        ageRanges = []
        grades = []
        subjects = []
        programs = []

        // creating org1 age ranges
        for (let i = 1; i <= ageRangesCount / 2; i++) {
            const ageRange = await createAgeRange(org1, i, i + 1)
            ageRange.low_value_unit = AgeRangeUnit.MONTH
            ageRange.high_value_unit = AgeRangeUnit.MONTH
            ageRanges.push(ageRange)
        }

        for (let i = 1; i <= ageRangesCount / 2; i++) {
            const ageRange = await createAgeRange(org1, i, i + 1)
            ageRange.low_value_unit = AgeRangeUnit.YEAR
            ageRange.high_value_unit = AgeRangeUnit.YEAR
            ageRanges.push(ageRange)
        }

        await connection.manager.save(ageRanges)

        // creating org1 grades
        for (let i = 0; i < gradesCount; i++) {
            const grade = await createGrade(org1)
            grades.push(grade)
        }

        await connection.manager.save(grades)

        // creating org1 subjects
        for (let i = 0; i < subjectsCount; i++) {
            const subject = await createSubject(org1)
            subjects.push(subject)
        }

        await connection.manager.save(subjects)

        // creating org1 programs
        for (let i = 0; i < programsCount; i++) {
            const program = await createProgram(org1)
            programs.push(program)
        }

        await connection.manager.save(programs)

        // creating org1 classes
        for (let i = 0; i < classesCount; i++) {
            const class_ = await createClass(undefined, org1)
            const classNumber = i < 9 ? `0${i + 1}` : `${i + 1}`
            const shortcode = `CL455${classNumber}`
            const ageRangesForClass = [
                ageRanges[Math.floor(i / (classesCount / ageRangesCount))],
            ]

            if (i % 2) {
                ageRangesForClass.push(noneSpecifiedAgeRange)
            }

            class_.class_name = `class ${classNumber}`
            class_.status = Status.ACTIVE
            class_.age_ranges = Promise.resolve(ageRangesForClass)
            class_.shortcode = shortcode
            class_.grades = Promise.resolve([
                grades[Math.floor(i / (classesCount / gradesCount))],
            ])
            class_.subjects = Promise.resolve([
                subjects[Math.floor(i / (classesCount / subjectsCount))],
            ])
            class_.programs = Promise.resolve([
                programs[Math.floor(i / (classesCount / programsCount))],
            ])

            org1Classes.push(class_)
        }

        // creating org2 classes
        for (let i = 0; i < classesCount; i++) {
            const class_ = await createClass(undefined, org2)
            const classNumber = i < 9 ? `0${i + 1}` : `${i + 1}`
            const shortcode = `CL455${classNumber}`
            class_.class_name = `class ${classNumber}`
            class_.status = Status.INACTIVE
            class_.shortcode = shortcode
            org2Classes.push(class_)
        }

        // creating org3 schools
        for (let i = 0; i < schoolsCount; i++) {
            const school = await createSchool(org3)
            school.school_name = `school ${i}`
            org3Schools.push(school)
        }

        await connection.manager.save(org3Schools)

        // creating org3 classes
        for (let i = 0; i < classesCount; i++) {
            const index = Math.floor(i / (classesCount / schoolsCount))
            const classNumber = i < 9 ? `0${i + 1}` : `${i + 1}`
            const shortcode = `CL455${classNumber}`
            const class_ = await createClass([org3Schools[index]], org3)

            class_.class_name = `class ${classNumber}`
            class_.status = Status.ACTIVE
            class_.shortcode = shortcode
            org3Classes.push(class_)
        }

        classes.push(...org1Classes, ...org2Classes, ...org3Classes)

        await connection.manager.save(classes)

        // adding orgOwner to org3
        await addUserToOrganizationAndValidate(
            testClient,
            orgOwner.user_id,
            org3.organization_id,
            { authorization: getAdminAuthToken() }
        )

        // assign org admin role to orgOwner
        await addRoleToOrganizationMembership(
            testClient,
            orgOwner.user_id,
            org3.organization_id,
            orgAdminRoleId
        )

        // adding ownerAndSchoolAdmin to org2
        await addUserToOrganizationAndValidate(
            testClient,
            ownerAndSchoolAdmin.user_id,
            org2.organization_id,
            { authorization: getAdminAuthToken() }
        )

        // assign org admin role to ownerAndSchoolAdmin
        await addRoleToOrganizationMembership(
            testClient,
            ownerAndSchoolAdmin.user_id,
            org2.organization_id,
            orgAdminRoleId
        )

        // adding schoolAdmin to org3
        await addUserToOrganizationAndValidate(
            testClient,
            schoolAdmin.user_id,
            org3.organization_id,
            { authorization: getAdminAuthToken() }
        )

        // adding schoolAdmin to first org3School
        await addUserToSchool(
            testClient,
            schoolAdmin.user_id,
            org3Schools[0].school_id,
            {
                authorization: getAdminAuthToken(),
            }
        )

        // assign school admin role to schoolAdmin
        await addRoleToOrganizationMembership(
            testClient,
            schoolAdmin.user_id,
            org3.organization_id,
            schoolAdminRoleId
        )

        // adding ownerAndSchoolAdmin to org3
        await addUserToOrganizationAndValidate(
            testClient,
            ownerAndSchoolAdmin.user_id,
            org3.organization_id,
            { authorization: getAdminAuthToken() }
        )

        // adding ownerAndSchoolAdmin to second org3School
        await addUserToSchool(
            testClient,
            ownerAndSchoolAdmin.user_id,
            org3Schools[1].school_id,
            {
                authorization: getAdminAuthToken(),
            }
        )

        // assign school admin role to ownerAndSchoolAdmin
        await addRoleToOrganizationMembership(
            testClient,
            ownerAndSchoolAdmin.user_id,
            org3.organization_id,
            schoolAdminRoleId
        )

        // adding orgMember to org3
        await addUserToOrganizationAndValidate(
            testClient,
            orgMember.user_id,
            org3.organization_id,
            { authorization: getAdminAuthToken() }
        )
    })

    it('should get the correct class with its corresponding data', async () => {
        const classToTest = org1Classes[0]
        const result = await classNode(testClient, classToTest.class_id, {
            authorization: getAdminAuthToken(),
        })

        expect(result).to.be.an('object')

        expect(result).to.haveOwnProperty('id')
        expect(result.id).to.eql(classToTest.class_id)
        expect(result).to.haveOwnProperty('name')
        expect(result.name).to.eql(classToTest.class_name)
        expect(result).to.haveOwnProperty('status')
        expect(result.status).to.eql(classToTest.status)
        expect(result).to.haveOwnProperty('shortCode')
        expect(result.shortCode).to.eql(classToTest.shortcode)

        expect(result).to.haveOwnProperty('schools')
        expect(result.schools).to.be.an('array')
        expect(result.schools?.length).to.eql(0)

        expect(result).to.haveOwnProperty('ageRanges')
        expect(result.ageRanges).to.be.an('array')
        expect(result.ageRanges?.length).to.eql(1)
        expect(result.ageRanges?.[0].id).to.eql(ageRanges[0].id)

        expect(result).to.haveOwnProperty('grades')
        expect(result.grades).to.be.an('array')
        expect(result.grades?.length).to.eql(1)
        expect(result.grades?.[0].id).to.eql(grades[0].id)

        expect(result).to.haveOwnProperty('subjects')
        expect(result.subjects).to.be.an('array')
        expect(result.subjects?.length).to.eql(1)
        expect(result.subjects?.[0].id).to.eql(subjects[0].id)

        expect(result).to.haveOwnProperty('programs')
        expect(result.programs).to.be.an('array')
        expect(result.programs?.length).to.eql(1)
        expect(result.programs?.[0].id).to.eql(programs[0].id)
    })

    context('permissions', () => {
        it('super admin should get any class', async () => {
            let classToTest = org1Classes[0]
            let result = await classNode(testClient, classToTest.class_id, {
                authorization: getAdminAuthToken(),
            })

            expect(result).to.exist

            classToTest = org2Classes[0]
            result = await classNode(testClient, classToTest.class_id, {
                authorization: getAdminAuthToken(),
            })

            expect(result).to.exist

            classToTest = org3Classes[0]
            result = await classNode(testClient, classToTest.class_id, {
                authorization: getAdminAuthToken(),
            })

            expect(result).to.exist
        })

        it('org admin should get a class just from its organization', async () => {
            const token = generateToken(userToPayload(orgOwner))
            let classToTest = org3Classes[0]
            let result = await classNode(testClient, classToTest.class_id, {
                authorization: token,
            })

            expect(result).to.exist

            classToTest = org3Classes[1]
            result = await classNode(testClient, classToTest.class_id, {
                authorization: token,
            })

            expect(result).to.exist

            classToTest = org3Classes[2]
            result = await classNode(testClient, classToTest.class_id, {
                authorization: token,
            })

            expect(result).to.exist
        })

        it('school admin should get a class just from its school', async () => {
            const token = generateToken(userToPayload(schoolAdmin))
            let classToTest = org3Classes[0]
            let result = await classNode(testClient, classToTest.class_id, {
                authorization: token,
            })

            expect(result).to.exist

            classToTest = org3Classes[1]
            result = await classNode(testClient, classToTest.class_id, {
                authorization: token,
            })

            expect(result).to.exist

            classToTest = org3Classes[2]
            result = await classNode(testClient, classToTest.class_id, {
                authorization: token,
            })

            expect(result).to.exist
        })

        it('owner and school admin should get a class just from its school or its organisation', async () => {
            const token = generateToken(userToPayload(ownerAndSchoolAdmin))
            let classToTest = org2Classes[0]
            let result = await classNode(testClient, classToTest.class_id, {
                authorization: token,
            })

            expect(result).to.exist

            classToTest = org2Classes[1]
            result = await classNode(testClient, classToTest.class_id, {
                authorization: token,
            })

            expect(result).to.exist

            classToTest = org3Classes[4]
            result = await classNode(testClient, classToTest.class_id, {
                authorization: token,
            })

            expect(result).to.exist

            classToTest = org3Classes[5]
            result = await classNode(testClient, classToTest.class_id, {
                authorization: token,
            })

            expect(result).to.exist
        })
    })

    context('error handling', () => {
        it('throws an error if id is not a UUID', async () => {
            await expect(
                classNode(testClient, '1-4m-n0t-4n-uu1d', {
                    authorization: getAdminAuthToken(),
                })
            ).to.be.rejected
        })

        it("throws an error if id doesn't exist", async () => {
            await expect(
                classNode(testClient, '00000000-0000-0000-0000-00000', {
                    authorization: getAdminAuthToken(),
                })
            ).to.be.rejected
        })

        it('throws an error if an org admin tries to get a class out of its organisation', async () => {
            const token = generateToken(userToPayload(orgOwner))
            const classToTest = org1Classes[0]

            await expect(
                classNode(testClient, classToTest.class_id, {
                    authorization: token,
                })
            ).to.be.rejected
        })

        it('throws an error if a school admin tries to get a class out of its school', async () => {
            const token = generateToken(userToPayload(schoolAdmin))
            const classToTest = org3Classes[4]

            await expect(
                classNode(testClient, classToTest.class_id, {
                    authorization: token,
                })
            ).to.be.rejected
        })

        it('throws an error if an owner and school admin tries to get a class out of its school', async () => {
            const token = generateToken(userToPayload(ownerAndSchoolAdmin))
            let classToTest = org1Classes[0]

            await expect(
                classNode(testClient, classToTest.class_id, {
                    authorization: token,
                })
            ).to.be.rejected

            classToTest = org3Classes[10]

            await expect(
                classNode(testClient, classToTest.class_id, {
                    authorization: token,
                })
            ).to.be.rejected
        })

        it('throws an error if a non admin user tries to get a class', async () => {
            const token = generateToken(userToPayload(orgMember))
            const classToTest = org1Classes[0]

            await expect(
                classNode(testClient, classToTest.class_id, {
                    authorization: token,
                })
            ).to.be.rejected
        })
    })
})
