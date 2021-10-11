import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { AgeRange } from '../../../src/entities/ageRange'
import { AgeRangeUnit } from '../../../src/entities/ageRangeUnit'
import { Class } from '../../../src/entities/class'
import { Grade } from '../../../src/entities/grade'
import { Organization } from '../../../src/entities/organization'
import { Program } from '../../../src/entities/program'
import { Role } from '../../../src/entities/role'
import { School } from '../../../src/entities/school'
import { Status } from '../../../src/entities/status'
import { Subject } from '../../../src/entities/subject'
import { User } from '../../../src/entities/user'
import AgeRangesInitializer from '../../../src/initializers/ageRanges'
import { Model } from '../../../src/model'
import { AgeRangeConnectionNode } from '../../../src/types/graphQL/ageRangeConnectionNode'
import { ClassConnectionNode } from '../../../src/types/graphQL/classConnectionNode'
import { GradeSummaryNode } from '../../../src/types/graphQL/gradeSummaryNode'
import { ProgramSummaryNode } from '../../../src/types/graphQL/programSummaryNode'
import { SchoolSimplifiedSummaryNode } from '../../../src/types/graphQL/schoolSimplifiedSummaryNode'
import { SubjectSummaryNode } from '../../../src/types/graphQL/subjectSummaryNode'
import { createServer } from '../../../src/utils/createServer'
import { createAgeRange } from '../../factories/ageRange.factory'
import { createClass } from '../../factories/class.factory'
import { createGrade } from '../../factories/grade.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createProgram } from '../../factories/program.factory'
import { createSchool } from '../../factories/school.factory'
import { createSubject } from '../../factories/subject.factory'
import { createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import { classNode, classNodeMainData } from '../../utils/operations/modelOps'
import { addUserToSchool } from '../../utils/operations/schoolOps'
import { userToPayload } from '../../utils/operations/userOps'
import { generateToken, getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'

const sorting = (a: { id: string }, b: { id: string }) => {
    if (a.id < b.id) {
        return -1
    }

    if (a.id > b.id) {
        return 1
    }

    return 0
}

function expectCoreClassConnectionEdge(
    queryResult: ClassConnectionNode,
    classToCompare: Class
) {
    expect(queryResult.id).to.eql(classToCompare.class_id)
    expect(queryResult.name).to.eql(classToCompare.class_name)
    expect(queryResult.status).to.eql(classToCompare.status)
    expect(queryResult.shortCode).to.eql(classToCompare.shortcode)
}

function expectSchoolsSummaryNode(
    querySchools: SchoolSimplifiedSummaryNode[],
    schoolsToCompare: School[]
) {
    querySchools.sort(sorting)

    schoolsToCompare.sort((a, b) => {
        if (a.school_id < b.school_id) {
            return -1
        }

        if (a.school_id > b.school_id) {
            return 1
        }

        return 0
    })

    expect(querySchools.length).to.eql(schoolsToCompare.length)

    querySchools.forEach((qs, index) => {
        expect(qs.id).to.eql(schoolsToCompare[index].school_id)
        expect(qs.name).to.eql(schoolsToCompare[index].school_name)
        expect(qs.status).to.eql(schoolsToCompare[index].status)
    })
}

function expectAgeRangesSummaryNode(
    queryAgeRanges: AgeRangeConnectionNode[],
    ageRangesToCompare: AgeRange[]
) {
    queryAgeRanges.sort(sorting)
    ageRangesToCompare.sort(sorting)

    expect(queryAgeRanges.length).to.eql(ageRangesToCompare.length)

    queryAgeRanges.forEach((qar, index) => {
        expect(qar.id).to.eql(ageRangesToCompare[index].id)
        expect(qar.name).to.eql(ageRangesToCompare[index].name)
        expect(qar.status).to.eql(ageRangesToCompare[index].status)
        expect(qar.system).to.eql(ageRangesToCompare[index].system)
        expect(qar.highValue).to.eql(ageRangesToCompare[index].high_value)
        expect(qar.lowValue).to.eql(ageRangesToCompare[index].low_value)

        expect(qar.highValueUnit).to.eql(
            ageRangesToCompare[index].high_value_unit
        )

        expect(qar.lowValueUnit).to.eql(
            ageRangesToCompare[index].low_value_unit
        )
    })
}

function expectGradesSummaryNode(
    queryGrades: GradeSummaryNode[],
    gradesToCompare: Grade[]
) {
    queryGrades.sort(sorting)
    gradesToCompare.sort(sorting)

    expect(queryGrades.length).to.eql(gradesToCompare.length)

    queryGrades.forEach((qg, index) => {
        expect(qg.id).to.eql(gradesToCompare[index].id)
        expect(qg.name).to.eql(gradesToCompare[index].name)
        expect(qg.status).to.eql(gradesToCompare[index].status)
        expect(qg.system).to.eql(gradesToCompare[index].system)
    })
}

function expectSubjectsSummaryNode(
    querySubjects: SubjectSummaryNode[],
    subjectsToCompare: Subject[]
) {
    querySubjects.sort(sorting)
    subjectsToCompare.sort(sorting)

    expect(querySubjects.length).to.eql(subjectsToCompare.length)

    querySubjects.forEach((qs, index) => {
        expect(qs.id).to.eql(subjectsToCompare[index].id)
        expect(qs.name).to.eql(subjectsToCompare[index].name)
        expect(qs.status).to.eql(subjectsToCompare[index].status)
        expect(qs.system).to.eql(subjectsToCompare[index].system)
    })
}

function expectProgramsSummaryNode(
    queryPrograms: ProgramSummaryNode[],
    programsToCompare: Program[]
) {
    queryPrograms.sort(sorting)
    programsToCompare.sort(sorting)

    expect(queryPrograms.length).to.eql(programsToCompare.length)

    queryPrograms.forEach((qp, index) => {
        expect(qp.id).to.eql(programsToCompare[index].id)
        expect(qp.name).to.eql(programsToCompare[index].name)
        expect(qp.status).to.eql(programsToCompare[index].status)
        expect(qp.system).to.eql(programsToCompare[index].system)
    })
}

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

        const schoolAdminRole = await Role.findOneOrFail({
            where: { role_name: 'School Admin', system_role: true },
        })

        const orgAdminRole = await Role.findOneOrFail({
            where: { role_name: 'Organization Admin', system_role: true },
        })

        const noneSpecifiedAgeRange = await connection.manager.findOneOrFail(
            AgeRange,
            {
                where: { name: 'None Specified', system: true },
            }
        )

        admin = await createAdminUser(testClient)
        orgOwner = createUser()
        schoolAdmin = createUser()
        orgMember = createUser()
        ownerAndSchoolAdmin = createUser()

        org1 = createOrganization(admin)
        org2 = createOrganization(ownerAndSchoolAdmin)
        org3 = createOrganization(orgOwner)

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
            const ageRange = createAgeRange(org1, i, i + 1)
            ageRange.low_value_unit = AgeRangeUnit.MONTH
            ageRange.high_value_unit = AgeRangeUnit.MONTH
            ageRanges.push(ageRange)
        }

        for (let i = 1; i <= ageRangesCount / 2; i++) {
            const ageRange = createAgeRange(org1, i, i + 1)
            ageRange.low_value_unit = AgeRangeUnit.YEAR
            ageRange.high_value_unit = AgeRangeUnit.YEAR
            ageRanges.push(ageRange)
        }

        await connection.manager.save(ageRanges)

        // creating org1 grades
        for (let i = 0; i < gradesCount; i++) {
            const grade = createGrade(org1)
            grades.push(grade)
        }

        await connection.manager.save(grades)

        // creating org1 subjects
        for (let i = 0; i < subjectsCount; i++) {
            const subject = createSubject(org1)
            subjects.push(subject)
        }

        await connection.manager.save(subjects)

        // creating org1 programs
        for (let i = 0; i < programsCount; i++) {
            const program = createProgram(org1)
            programs.push(program)
        }

        await connection.manager.save(programs)

        // creating org1 classes
        for (let i = 0; i < classesCount; i++) {
            const class_ = createClass(undefined, org1)
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
            const class_ = createClass(undefined, org2)
            const classNumber = i < 9 ? `0${i + 1}` : `${i + 1}`
            const shortcode = `CL455${classNumber}`
            class_.class_name = `class ${classNumber}`
            class_.status = Status.INACTIVE
            class_.shortcode = shortcode
            org2Classes.push(class_)
        }

        // creating org3 schools
        for (let i = 0; i < schoolsCount; i++) {
            const school = createSchool(org3)
            school.school_name = `school ${i}`
            org3Schools.push(school)
        }

        await connection.manager.save(org3Schools)

        // creating org3 classes
        for (let i = 0; i < classesCount; i++) {
            const index = Math.floor(i / (classesCount / schoolsCount))
            const classNumber = i < 9 ? `0${i + 1}` : `${i + 1}`
            const shortcode = `CL455${classNumber}`
            const class_ = createClass([org3Schools[index]], org3)

            class_.class_name = `class ${classNumber}`
            class_.status = Status.ACTIVE
            class_.shortcode = shortcode
            org3Classes.push(class_)
        }

        classes.push(...org1Classes, ...org2Classes, ...org3Classes)

        await connection.manager.save(classes)

        // adding orgOwner to org3 with orgAdminRole¿
        await connection.manager.save(
            createOrganizationMembership({
                user: orgOwner,
                organization: org3,
                roles: [orgAdminRole],
            })
        )

        // adding ownerAndSchoolAdmin to org2 with orgAdminRole
        await connection.manager.save(
            createOrganizationMembership({
                user: ownerAndSchoolAdmin,
                organization: org2,
                roles: [orgAdminRole],
            })
        )

        // adding schoolAdmin to org3 with schoolAdminRole
        await connection.manager.save(
            createOrganizationMembership({
                user: schoolAdmin,
                organization: org3,
                roles: [schoolAdminRole],
            })
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

        // adding ownerAndSchoolAdmin to org3 with schoolAdminRole
        await connection.manager.save(
            createOrganizationMembership({
                user: ownerAndSchoolAdmin,
                organization: org3,
                roles: [schoolAdminRole],
            })
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

        // adding orgMember to org3
        await connection.manager.save(
            createOrganizationMembership({
                user: orgMember,
                organization: org3,
                roles: [],
            })
        )
    })

    it('should get the correct class with its corresponding data', async () => {
        const classToTest = org1Classes[0]
        const result = await classNode(testClient, classToTest.class_id, {
            authorization: getAdminAuthToken(),
        })

        expect(result).to.be.an('object')
        expectCoreClassConnectionEdge(result, classToTest)

        expectSchoolsSummaryNode(
            result.schools || [],
            (await classToTest.schools) || []
        )

        expectAgeRangesSummaryNode(
            result.ageRanges || [],
            (await classToTest.age_ranges) || []
        )

        expectGradesSummaryNode(
            result.grades || [],
            (await classToTest.grades) || []
        )

        expectSubjectsSummaryNode(
            result.subjects || [],
            (await classToTest.subjects) || []
        )

        expectProgramsSummaryNode(
            result.programs || [],
            (await classToTest.programs) || []
        )
    })

    it('makes just one call to the database', async () => {
        const classToTest = org1Classes[0]
        connection.logger.reset()

        await classNodeMainData(testClient, classToTest.class_id, {
            authorization: getAdminAuthToken(),
        })

        expect(connection.logger.count).to.be.eq(1)
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
        it('throws an error if id is not a ID', async () => {
            await expect(
                classNode(testClient, '1-4m-n0t-4n-1d', {
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
