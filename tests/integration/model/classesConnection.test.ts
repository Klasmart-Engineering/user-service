import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection } from 'typeorm'
import { Class } from '../../../src/entities/class'
import { Organization } from '../../../src/entities/organization'
import { School } from '../../../src/entities/school'
import { Status } from '../../../src/entities/status'
import { User } from '../../../src/entities/user'
import { Model } from '../../../src/model'
import { SchoolSimplifiedSummaryNode } from '../../../src/types/graphQL/schoolSimplifiedSummaryNode'
import { createServer } from '../../../src/utils/createServer'
import { IEntityFilter } from '../../../src/utils/pagination/filtering'
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
import { classesConnection } from '../../utils/operations/modelOps'
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
import { generateToken, getAdminAuthToken } from '../../utils/testConfig'
import { createTestConnection } from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'

use(chaiAsPromised)

describe('classesConnection', () => {
    let connection: Connection
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

    const classesCount = 12
    const schoolsCount = 3

    before(async () => {
        connection = await createTestConnection()
        const server = createServer(new Model(connection))
        testClient = createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        const systemRoles = await getSystemRoleIds()
        const schoolAdminRoleId = systemRoles['School Admin']
        const orgAdminRoleId = systemRoles['Organization Admin']

        admin = await createAdminUser(testClient)
        orgOwner = await createUser({})
        schoolAdmin = await createUser({})
        orgMember = await createUser({})
        ownerAndSchoolAdmin = await createUser({})

        org1 = await createOrganization({}, admin)
        org2 = await createOrganization({}, ownerAndSchoolAdmin)
        org3 = await createOrganization({}, orgOwner)

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

        // creating org1 classes
        for (let i = 0; i < classesCount; i++) {
            let class_ = await createClass(undefined, org1)
            class_.class_name = `class ${i + 1}`
            class_.status = Status.ACTIVE
            org1Classes.push(class_)
        }

        // creating org2 classes
        for (let i = 0; i < classesCount; i++) {
            let class_ = await createClass(undefined, org2)
            class_.class_name = `class ${i + 1}`
            class_.status = Status.INACTIVE
            org2Classes.push(class_)
        }

        // creating org3 schools
        for (let i = 0; i < schoolsCount; i++) {
            let school = await createSchool(org3)
            school.school_name = `school ${i}`
            org3Schools.push(school)
        }

        await connection.manager.save(org3Schools)

        // creating org3 classes
        for (let i = 0; i < classesCount; i++) {
            const index = Math.floor(i / (classesCount / schoolsCount))
            let class_ = await createClass([org3Schools[index]], org3)

            class_.class_name = `class ${i + 1}`
            class_.status = Status.ACTIVE
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

                const ageRange = createAgeRange({
                    name: `ageRange ${i}`,
                    low_value: i,
                    high_value: i
                }, org1)
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
                edge.node.schools?.map(
                    (school: SchoolSimplifiedSummaryNode) => school.id
                )
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
            const search = 'class 1'

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

        it('fails if search value is longer than 250 characters', async () => {
            const longValue =
                'hOfLDx5hwPm1KnwNEaAHUddKjN62yGEk4ZycRB7UjmZXMtm2ODnQCycCmylMDsVDCztWgrepOaQ9itKx94g2rELPj8w533bGpKqUT9a25NuKrzs5R3OfTUprOkCLE1PBHYOAUpSU289e4BhZzR40ncGsKwKtIFHQ9fzy1hlPr3gWMK8H6s5JGtO0oQrl8Lf0co5IlKWRaeEY4eaUUIWVHRiSdsaaXgM5ffW1zgZCrhOYCPZrBrP8uYaiPGsn1GjE8Chf'

            const filter: IEntityFilter = {
                name: {
                    operator: 'contains',
                    value: longValue,
                },
            }

            const fn = async () =>
                await classesConnection(
                    testClient,
                    'FORWARD',
                    { count: 10 },
                    { authorization: getAdminAuthToken() },
                    filter
                )

            await expect(fn()).to.be.rejected
        })
    })
})
