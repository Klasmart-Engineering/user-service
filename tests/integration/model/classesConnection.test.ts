import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getConnection } from 'typeorm'
import { AgeRange } from '../../../src/entities/ageRange'
import { AgeRangeUnit } from '../../../src/entities/ageRangeUnit'
import { Class } from '../../../src/entities/class'
import { Grade } from '../../../src/entities/grade'
import { Organization } from '../../../src/entities/organization'
import { Permission } from '../../../src/entities/permission'
import { Program } from '../../../src/entities/program'
import { School } from '../../../src/entities/school'
import { SchoolMembership } from '../../../src/entities/schoolMembership'
import { Status } from '../../../src/entities/status'
import { Subject } from '../../../src/entities/subject'
import { User } from '../../../src/entities/user'
import AgeRangesInitializer from '../../../src/initializers/ageRanges'
import { Model } from '../../../src/model'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { AgeRangeConnectionNode } from '../../../src/types/graphQL/ageRange'
import { SchoolSummaryNode } from '../../../src/types/graphQL/school'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
import { createAgeRange } from '../../factories/ageRange.factory'
import { createClass } from '../../factories/class.factory'
import { createGrade } from '../../factories/grade.factory'
import { createOrganization } from '../../factories/organization.factory'
import { createOrganizationMembership } from '../../factories/organizationMembership.factory'
import { createProgram } from '../../factories/program.factory'
import { createRole } from '../../factories/role.factory'
import { createSchool } from '../../factories/school.factory'
import { createSchoolMembership } from '../../factories/schoolMembership.factory'
import { createSubject } from '../../factories/subject.factory'
import { createUser } from '../../factories/user.factory'
import {
    ApolloServerTestClient,
    createTestClient,
} from '../../utils/createTestClient'
import {
    classesConnection,
    classesConnectionMainData,
} from '../../utils/operations/modelOps'
import { addRoleToOrganizationMembership } from '../../utils/operations/organizationMembershipOps'
import {
    addUserToOrganizationAndValidate,
    getSystemRoleIds,
} from '../../utils/operations/organizationOps'
import { addUserToSchool } from '../../utils/operations/schoolOps'
import { userToPayload } from '../../utils/operations/userOps'
import {
    isStringArraySortedAscending,
    isStringArraySortedDescending,
} from '../../utils/sorting'
import {
    generateToken,
    getAdminAuthToken,
    getNonAdminAuthToken,
} from '../../utils/testConfig'
import { TestConnection } from '../../utils/testConnection'
import { createAdminUser, createNonAdminUser } from '../../utils/testEntities'

use(chaiAsPromised)

describe('classesConnection', () => {
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
        connection = getConnection() as TestConnection
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
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

    context('pagination', () => {
        beforeEach(async () => {
            const schools = []
            const ageRanges = []
            const grades = []
            const subjects = []
            const programs = []

            for (let i = 1; i <= 60; i += 1) {
                const school = createSchool(org1, `school ${i}`)
                schools.push(school)

                const ageRange = createAgeRange(org1, i + 10, i + 11)
                ageRange.name = `ageRange ${i}`
                ageRanges.push(ageRange)

                const grade = createGrade(org1)
                grade.name = `grade ${i}`
                grades.push(grade)

                const subject = createSubject(org1)
                subject.name = `subject ${i}`
                subjects.push(subject)

                const program = createProgram(org1)
                program.name = `program ${i}`
                programs.push(program)
            }

            await connection.manager.save(schools)
            await connection.manager.save(ageRanges)
            await connection.manager.save(grades)
            await connection.manager.save(subjects)
            await connection.manager.save(programs)

            for (const class_ of org1Classes) {
                class_.schools = Promise.resolve(schools)
                class_.age_ranges = Promise.resolve(ageRanges)
                class_.grades = Promise.resolve(grades)
                class_.subjects = Promise.resolve(subjects)
                class_.programs = Promise.resolve(programs)
            }

            await connection.manager.save(org1Classes)
        })

        it('returns classes from all the list', async () => {
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            expect(result.totalCount).to.eq(classesCount * 3)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)
        })

        it("returns the classes that belongs to user's organization", async () => {
            const token = generateToken(userToPayload(orgOwner))
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: token }
            )

            expect(result.totalCount).to.eq(classesCount)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const classIds = result.edges.map((edge) => edge.node.id)
            const org3ClassIds = org3Classes.map((class_) => class_.class_id)

            classIds.every((id) => org3ClassIds.includes(id))
        })

        it("returns the classes that belongs to user's school", async () => {
            const token = generateToken(userToPayload(schoolAdmin))
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: token }
            )

            expect(result.totalCount).to.eq(classesCount / schoolsCount)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(classesCount / schoolsCount)

            const schoolIds = result.edges.map((edge) =>
                edge.node.schools?.map((school: SchoolSummaryNode) => school.id)
            )

            schoolIds.every((ids) => ids?.includes(org3Schools[0].school_id))
        })

        it("returns the classes that belongs to user's organization and school", async () => {
            const token = generateToken(userToPayload(ownerAndSchoolAdmin))
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: token }
            )

            // OrgAdminClasses + schoolAdminClasses
            expect(result.totalCount).to.eq(
                classesCount + classesCount / schoolsCount
            )

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)
        })

        it('returns empty if the user has not organization neither school', async () => {
            const token = generateToken(userToPayload(orgMember))
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: token }
            )

            expect(result.totalCount).to.eq(0)

            expect(result.pageInfo.hasNextPage).to.be.false
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string
            expect(result.pageInfo.startCursor).to.be.empty
            expect(result.pageInfo.endCursor).to.be.empty

            expect(result.edges.length).eq(0)
        })

        it("classes' linked data has not more than 50 elements per entity", async () => {
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            const classes = result.edges
            classes.every((class_) => {
                expect(class_.node.schools?.length).lte(50)
                expect(class_.node.ageRanges?.length).lte(50)
                expect(class_.node.grades?.length).lte(50)
                expect(class_.node.subjects?.length).lte(50)
                expect(class_.node.programs?.length).lte(50)
            })
        })

        it('returns classes with shortCodes', async () => {
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() }
            )

            expect(result.totalCount).to.eq(classesCount * 3)
            expect(result.edges.length).eq(10)

            const shortCodeClasses = result.edges.map((e) => e.node)
            shortCodeClasses.forEach((c) => {
                const number = c.name?.substring(c.name.length - 2)
                expect(c.shortCode).to.exist
                expect(c.shortCode).to.eq(`CL455${number}`)
            })
        })
    })

    context('sorting', () => {
        it('returns classes sorted by id in an ascending order', async () => {
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(classesCount * 3)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedAscending(ids)

            expect(isSorted).to.be.true
        })

        it('returns classes sorted by id in a descending order', async () => {
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'id', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(classesCount * 3)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const ids = result.edges.map((edge) => edge.node.id)
            const isSorted = isStringArraySortedDescending(ids)

            expect(isSorted).to.be.true
        })

        it('returns classes sorted by name in an ascending order', async () => {
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'ASC' }
            )

            expect(result.totalCount).to.eq(classesCount * 3)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name || '')
            const isSorted = isStringArraySortedAscending(names)

            expect(isSorted).to.be.true
        })

        it('returns classes sorted by name in a descending order', async () => {
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                undefined,
                { field: 'name', order: 'DESC' }
            )

            expect(result.totalCount).to.eq(classesCount * 3)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const names = result.edges.map((edge) => edge.node.name || '')
            const isSorted = isStringArraySortedDescending(names)

            expect(isSorted).to.be.true
        })
    })

    context('filtering', () => {
        let students: User[]
        let teachers: User[]
        beforeEach(async () => {
            // add some users as students & teachers to each class
            students = await User.save(Array.from(Array(5), createUser))
            teachers = await User.save(Array.from(Array(5), createUser))

            for (const user of students) {
                await createOrganizationMembership({
                    user,
                    organization: org1,
                }).save()
            }
            for (const user of teachers) {
                await createOrganizationMembership({
                    user,
                    organization: org1,
                }).save()
            }

            for (const class_ of org1Classes) {
                class_.students = Promise.resolve(students)
                class_.teachers = Promise.resolve(teachers)
                await class_.save()
            }
        })
        it('supports filtering by studentId', async () => {
            const filter: IEntityFilter = {
                studentId: {
                    operator: 'eq',
                    value: students[0].user_id,
                },
            }
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )
            expect(result.totalCount).to.eq(org1Classes.length)
        })
        it('supports filtering by teacherId', async () => {
            const filter: IEntityFilter = {
                teacherId: {
                    operator: 'eq',
                    value: teachers[0].user_id,
                },
            }
            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )
            expect(result.totalCount).to.eq(org1Classes.length)
        })

        it('supports filtering by organization ID', async () => {
            const organizationId = org1.organization_id

            const filter: IEntityFilter = {
                organizationId: {
                    operator: 'eq',
                    value: organizationId,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(org1Classes.length)

            expect(result.pageInfo.hasNextPage).to.be.true
            expect(result.pageInfo.hasPreviousPage).to.be.false
            expect(result.pageInfo.startCursor).to.be.string
            expect(result.pageInfo.endCursor).to.be.string

            expect(result.edges.length).eq(10)

            const classIds = result.edges.map((edge) => edge.node.id)
            const org1ClassIds = org1Classes.map((class_) => class_.class_id)

            classIds.every((id) => org1ClassIds.includes(id))
        })

        it('supports filtering by class status', async () => {
            const filterStatus = 'inactive'

            const filter: IEntityFilter = {
                status: {
                    operator: 'eq',
                    value: filterStatus,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(classesCount)

            const statuses = result.edges.map((edge) => edge.node.status)
            statuses.every((status) => status === filterStatus)
        })

        it('supports filtering by class ID', async () => {
            const classId = classes[0].class_id

            const filter: IEntityFilter = {
                id: {
                    operator: 'eq',
                    value: classId,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(1)

            const ids = result.edges.map((edge) => edge.node.id)
            ids.every((id) => id === classId)
        })

        it('supports filtering by class name', async () => {
            const search = '1'

            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: search,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(12)

            const names = result.edges.map((edge) => edge.node.name)
            names.every((name) => name?.includes(search))
        })

        it('supports filtering by age range unit from', async () => {
            const unit = AgeRangeUnit.MONTH

            const filter: IEntityFilter = {
                ageRangeUnitFrom: {
                    operator: 'eq',
                    value: unit,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(ageRangesCount)
            const ageRangesUnits = result.edges.map((edge) => {
                return edge.node.ageRanges?.map(
                    (ageRange: AgeRangeConnectionNode) => ageRange.lowValueUnit
                )
            })

            ageRangesUnits.every((units) => units?.includes(unit))
        })

        it('supports filtering by age range unit to', async () => {
            const unit = AgeRangeUnit.YEAR

            const filter: IEntityFilter = {
                ageRangeUnitTo: {
                    operator: 'eq',
                    value: unit,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(ageRangesCount)

            const ageRangesUnits = result.edges.map((edge) => {
                return edge.node.ageRanges?.map(
                    (ageRange: AgeRangeConnectionNode) => ageRange.highValueUnit
                )
            })

            ageRangesUnits.every((units) => units?.includes(unit))
        })

        it('supports filtering by age range value from', async () => {
            const value = 1

            const filter: IEntityFilter = {
                ageRangeValueFrom: {
                    operator: 'eq',
                    value: value,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq((classesCount / ageRangesCount) * 2)

            const ageRangesValues = result.edges.map((edge) => {
                return edge.node.ageRanges?.map(
                    (ageRange: AgeRangeConnectionNode) => ageRange.lowValue
                )
            })

            ageRangesValues.every((values) => values?.includes(value))
        })

        it('supports filtering by age range value to', async () => {
            const value = 1
            const filter: IEntityFilter = {
                ageRangeValueFrom: {
                    operator: 'eq',
                    value: value,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq((classesCount / ageRangesCount) * 2)

            const ageRangesValues = result.edges.map((edge) => {
                return edge.node.ageRanges?.map(
                    (ageRange: AgeRangeConnectionNode) => ageRange.lowValue
                )
            })

            ageRangesValues.every((values) => values?.includes(value))
        })

        context('school ID', () => {
            async function testSchoolFilter(token: string) {
                const schoolId = org3Schools[0].school_id

                const filter: IEntityFilter = {
                    schoolId: {
                        operator: 'eq',
                        value: schoolId,
                    },
                }

                const result = await classesConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: token },
                    filter
                )

                expect(result.totalCount).to.eq(classesCount / schoolsCount)

                const schoolIds = result.edges.map((edge) => {
                    return edge.node.schools?.map((school) => school.id)
                })

                schoolIds.every((ids) => ids?.includes(schoolId))
            }

            context('with admin scope', () => {
                it('supports filtering', async () => {
                    return testSchoolFilter(getAdminAuthToken())
                })
                it('supports the exclusive filter via IS NULL', async () => {
                    const filter: IEntityFilter = {
                        schoolId: {
                            operator: 'isNull',
                        },
                    }

                    // only classes in one org have been assigned to a school
                    const expectedClasses = classesCount * 2

                    const result = await classesConnection(
                        testClient,
                        'FORWARD',
                        { count: 10 },
                        { authorization: getAdminAuthToken() },
                        filter
                    )
                    expect(result.totalCount).to.eq(expectedClasses)
                })
            })

            context('with non-admin scope', () => {
                async function createUserInOrganizationWithPermissions({
                    organization,
                    permissions,
                }: {
                    organization: Organization
                    permissions: PermissionName | PermissionName[]
                }) {
                    const user = await createUser().save()
                    const membership = createOrganizationMembership({
                        user,
                        organization,
                    })
                    const role = createRole(undefined, organization)
                    const _permissions = !Array.isArray(permissions)
                        ? [permissions]
                        : permissions
                    role.permissions = Promise.resolve(
                        _permissions.map((name) => {
                            const perm = new Permission()
                            perm.permission_name = name
                            return perm
                        })
                    )
                    await role.save()
                    membership.roles = Promise.resolve([role])
                    await membership.save()
                    return user
                }

                it('supports filtering with view_school_classes_20117 Permission', async () => {
                    const user = await createUserInOrganizationWithPermissions({
                        organization: org3,
                        permissions: PermissionName.view_school_classes_20117,
                    })
                    await SchoolMembership.save(
                        org3Schools
                            .slice(0, 2)
                            .map((school) =>
                                createSchoolMembership({ user, school })
                            )
                    )

                    return testSchoolFilter(generateToken(userToPayload(user)))
                })

                it('supports filtering with view_classes_20114 Permission', async () => {
                    const user = await createUserInOrganizationWithPermissions({
                        organization: org3,
                        permissions: PermissionName.view_classes_20114,
                    })

                    return testSchoolFilter(generateToken(userToPayload(user)))
                })
            })
        })

        it('supports filtering by grade ID', async () => {
            const gradeId = grades[0].id

            const filter: IEntityFilter = {
                gradeId: {
                    operator: 'eq',
                    value: gradeId,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(classesCount / gradesCount)

            const gradeIds = result.edges.map((edge) => {
                return edge.node.grades?.map((grade) => grade.id)
            })

            gradeIds.every((ids) => ids?.includes(gradeId))
        })

        it('supports filtering by subject ID', async () => {
            const subjectId = subjects[0].id

            const filter: IEntityFilter = {
                subjectId: {
                    operator: 'eq',
                    value: subjectId,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(classesCount / subjectsCount)

            const subjectIds = result.edges.map((edge) => {
                return edge.node.subjects?.map((subject) => subject.id)
            })

            subjectIds.every((ids) => ids?.includes(subjectId))
        })

        it('supports filtering by program ID', async () => {
            const programId = programs[0].id

            const filter: IEntityFilter = {
                programId: {
                    operator: 'eq',
                    value: programId,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(classesCount / programsCount)

            const programIds = result.edges.map((edge) => {
                return edge.node.programs?.map((program) => program.id)
            })

            programIds.every((ids) => ids?.includes(programId))
        })

        it('fails if search value is longer than 250 characters', async () => {
            const longValue =
                'hOfLDx5hwPm1KnwNEaAHUddKjN62yGEk4ZycRB7UjmZXMtm2ODnQCycCmylMDsVDCztWgrepOaQ9itKx94g2rELPj8w533bGpKqUT9a25NuKrzs5R3OfTUprOkCLE1PBHYOAUpSU289e4BhZzR40ncGsKwKtIFHQ9fzy1hlPr3gWMK8H6s5JGtO0oQrl8Lf0co5IlKWRaeEY4eaUUIWVHRiSdsaaXgM5ffW1zgZCrhOYCPZrBrP8uYaiPGsn1GjE8Chf'

            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: longValue,
                },
            }

            await expect(
                classesConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: getAdminAuthToken() },
                    filter
                )
            ).to.be.rejected
        })

        it("filters by age range value/unit from avoiding 'None Specified'", async () => {
            const lowValue = 0
            const lowValueUnit = AgeRangeUnit.YEAR

            const filter: IEntityFilter = {
                ageRangeValueFrom: {
                    operator: 'eq',
                    value: lowValue,
                },
                ageRangeUnitFrom: {
                    operator: 'eq',
                    value: lowValueUnit,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(0)
        })

        it("filters by age range to avoiding 'None Specified'", async () => {
            const highValue = 99
            const highValueUnit = AgeRangeUnit.YEAR

            const filter: IEntityFilter = {
                ageRangeValueTo: {
                    operator: 'eq',
                    value: highValue,
                },
                ageRangeUnitTo: {
                    operator: 'eq',
                    value: highValueUnit,
                },
            }

            const result = await classesConnection(
                testClient,
                'FORWARD',
                { count: 10 },
                { authorization: getAdminAuthToken() },
                filter
            )

            expect(result.totalCount).to.eq(0)
        })

        context(
            'when child relation has a different organization',
            async () => {
                let class_: Class

                beforeEach(async () => {
                    const program = await createProgram(org1)

                    await connection.manager.save([program])

                    // use a different org to the program
                    class_ = await createClass(undefined, org2)

                    class_.class_name = `classWithAProgramFromAnotherOrg`
                    class_.status = Status.ACTIVE
                    class_.programs = Promise.resolve([program])

                    await connection.manager.save([class_])
                })

                it('include it in results', async () => {
                    const query = (filter: IEntityFilter) => {
                        return classesConnection(
                            testClient,
                            'FORWARD',
                            { count: 1 },
                            { authorization: getAdminAuthToken() },
                            filter
                        )
                    }

                    const notFilteredOnOrgId = await query({
                        id: {
                            operator: 'eq',
                            value: class_.class_id!,
                        },
                    })

                    const filteredOnOrgId = await query({
                        id: {
                            operator: 'eq',
                            value: class_.class_id!,
                        },
                        organizationId: {
                            operator: 'eq',
                            value: org2.organization_id,
                        },
                    })

                    expect(
                        notFilteredOnOrgId.edges[0].node.programs?.length
                    ).to.be.eq(filteredOnOrgId.edges[0].node.programs?.length)
                })
            }
        )
    })

    context('when totalCount is not requested', () => {
        it('makes just one call to the database', async () => {
            connection.logger.reset()

            await classesConnectionMainData(
                testClient,
                'FORWARD',
                { count: 10 },
                false,
                { authorization: getAdminAuthToken() }
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('child connections', () => {
        context('.studentsConnection', () => {
            let students: User[]
            beforeEach(async () => {
                // add some users as students to each class
                students = await User.save(Array.from(Array(5), createUser))
                students.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

                for (const user of students) {
                    await createOrganizationMembership({
                        user,
                        organization: org1,
                    }).save()
                }

                for (let i = 0; i < classes.length; i++) {
                    classes[i].students = Promise.resolve(students)
                    await classes[i].save()
                }
            })
            it('returns class students', async () => {
                const result = await classesConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: getAdminAuthToken() }
                )

                expect(result.totalCount).to.eq(classes.length)
                expect(result.pageInfo.hasPreviousPage).to.eq(false)
                expect(result.pageInfo.hasNextPage).to.eq(true)
                expect(result.edges).to.have.lengthOf(10)
                for (const classEdge of result.edges) {
                    const studentEdges = classEdge.node.studentsConnection!
                        .edges

                    expect(studentEdges).to.have.lengthOf(students.length)
                    for (let i = 0; i < studentEdges.length; i++) {
                        expect(studentEdges[i].node.id).to.eq(
                            students[i].user_id
                        )
                    }
                }
            })
            it('uses the isAdmin scope for permissions', async () => {
                // create a non-admin user and add to org1
                const nonAdmin = await createNonAdminUser(testClient)
                const role = await createRole('role', org1, {
                    permissions: [PermissionName.view_classes_20114],
                }).save()
                const membership = await createOrganizationMembership({
                    user: nonAdmin,
                    organization: org1,
                    roles: [role],
                }).save()

                // can't see any other users without permissions
                let studentsPerClass = await classesConnection(
                    testClient,
                    'FORWARD',
                    { count: org1Classes.length },
                    { authorization: getNonAdminAuthToken() }
                )
                expect(studentsPerClass.edges).to.have.lengthOf(
                    org1Classes.length
                )
                for (const classEdge of studentsPerClass.edges) {
                    const studentsConnection = classEdge.node
                        .studentsConnection!
                    expect(studentsConnection.totalCount).to.eq(0)
                    expect(studentsConnection.edges).to.have.lengthOf(0)
                }

                // can see all other users with required permissions
                const role2 = await createRole('role2', org1, {
                    permissions: [PermissionName.view_users_40110],
                }).save()
                membership.roles = Promise.resolve([role, role2])
                await membership.save()

                // take two
                studentsPerClass = await classesConnection(
                    testClient,
                    'FORWARD',
                    { count: org1Classes.length },
                    { authorization: getNonAdminAuthToken() }
                )
                expect(studentsPerClass.edges).to.have.lengthOf(
                    org1Classes.length
                )
                for (const classEdge of studentsPerClass.edges) {
                    const studentsConnection = classEdge.node
                        .studentsConnection!
                    expect(studentsConnection.totalCount).to.eq(students.length)
                    expect(studentsConnection.edges).to.have.lengthOf(
                        students.length
                    )
                }
            })
        })

        context('.teachersConnection', () => {
            let teachers: User[]
            beforeEach(async () => {
                // add some users as teachers to each class
                teachers = await User.save(Array.from(Array(5), createUser))
                teachers.sort((a, b) => (a.user_id > b.user_id ? 1 : -1))

                for (const user of teachers) {
                    await createOrganizationMembership({
                        user,
                        organization: org1,
                    }).save()
                }

                for (let i = 0; i < classes.length; i++) {
                    classes[i].teachers = Promise.resolve(teachers)
                    await classes[i].save()
                }
            })
            it('returns class teachers', async () => {
                const result = await classesConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: getAdminAuthToken() }
                )

                expect(result.totalCount).to.eq(classes.length)
                expect(result.edges).to.have.lengthOf(10)
                for (const classEdge of result.edges) {
                    const teacherEdges = classEdge.node.teachersConnection!
                        .edges

                    expect(teacherEdges).to.have.lengthOf(teachers.length)
                    for (let i = 0; i < teacherEdges.length; i++) {
                        expect(teacherEdges[i].node.id).to.eq(
                            teachers[i].user_id
                        )
                    }
                }
            })
            it('uses the isAdmin scope for permissions', async () => {
                // create a non-admin user and add to org1
                const nonAdmin = await createNonAdminUser(testClient)
                const role = await createRole('role', org1, {
                    permissions: [PermissionName.view_classes_20114],
                }).save()
                const membership = await createOrganizationMembership({
                    user: nonAdmin,
                    organization: org1,
                    roles: [role],
                }).save()

                // can't see any other users without permissions
                let teachersPerClass = await classesConnection(
                    testClient,
                    'FORWARD',
                    { count: org1Classes.length },
                    { authorization: getNonAdminAuthToken() }
                )
                expect(teachersPerClass.edges).to.have.lengthOf(
                    org1Classes.length
                )
                for (const classEdge of teachersPerClass.edges) {
                    const teachersConnection = classEdge.node
                        .teachersConnection!
                    expect(teachersConnection.totalCount).to.eq(0)
                    expect(teachersConnection.edges).to.have.lengthOf(0)
                }

                // can see all other users with required permissions
                const role2 = await createRole('role2', org1, {
                    permissions: [PermissionName.view_users_40110],
                }).save()
                membership.roles = Promise.resolve([role, role2])
                await membership.save()

                // take two
                teachersPerClass = await classesConnection(
                    testClient,
                    'FORWARD',
                    { count: org1Classes.length },
                    { authorization: getNonAdminAuthToken() }
                )
                expect(teachersPerClass.edges).to.have.lengthOf(
                    org1Classes.length
                )
                for (const classEdge of teachersPerClass.edges) {
                    const teachersConnection = classEdge.node
                        .teachersConnection!
                    expect(teachersConnection.totalCount).to.eq(teachers.length)
                    expect(teachersConnection.edges).to.have.lengthOf(
                        teachers.length
                    )
                }
            })
        })
    })
})
