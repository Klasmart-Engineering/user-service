import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { SelectQueryBuilder } from 'typeorm'
import { nonAdminClassScope } from '../../../src/directives/isAdmin'
import { AgeRange } from '../../../src/entities/ageRange'
import { Class } from '../../../src/entities/class'
import { Grade } from '../../../src/entities/grade'
import { Organization } from '../../../src/entities/organization'
import { Program } from '../../../src/entities/program'
import { School } from '../../../src/entities/school'
import { Subject } from '../../../src/entities/subject'
import { User } from '../../../src/entities/user'
import { createContextLazyLoaders } from '../../../src/loaders/setup'
import { Context } from '../../../src/main'
import { Model } from '../../../src/model'
import { PermissionName } from '../../../src/permissions/permissionNames'
import { UserPermissions } from '../../../src/permissions/userPermissions'
import { AgeRangeConnectionNode } from '../../../src/types/graphQL/ageRange'
import { ClassConnectionNode } from '../../../src/types/graphQL/class'
import { GradeSummaryNode } from '../../../src/types/graphQL/grade'
import { ProgramSummaryNode } from '../../../src/types/graphQL/program'
import { SchoolSummaryNode } from '../../../src/types/graphQL/school'
import { SubjectSummaryNode } from '../../../src/types/graphQL/subject'

import { createServer } from '../../../src/utils/createServer'
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
import { class2Nodes } from '../../utils/operations/modelOps'
import { userToPayload } from '../../utils/operations/userOps'
import { getAdminAuthToken } from '../../utils/testConfig'
import {
    createTestConnection,
    TestConnection,
} from '../../utils/testConnection'
import { createAdminUser } from '../../utils/testEntities'

use(deepEqualInAnyOrder)

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
    querySchools: SchoolSummaryNode[],
    schoolsToCompare: School[]
) {
    expect(querySchools.length).to.eql(schoolsToCompare.length)

    schoolsToCompare.forEach((s) => {
        expect(querySchools.find((qs) => s.school_id === qs.id)).to.exist
    })
}

function expectAgeRangesSummaryNode(
    queryAgeRanges: AgeRangeConnectionNode[],
    ageRangesToCompare: AgeRange[]
) {
    expect(queryAgeRanges.length).to.eql(ageRangesToCompare.length)

    ageRangesToCompare.forEach((ar) => {
        expect(queryAgeRanges.find((qar) => ar.id === qar.id)).to.exist
    })
}

function expectGradesSummaryNode(
    queryGrades: GradeSummaryNode[],
    gradesToCompare: Grade[]
) {
    expect(queryGrades.length).to.eql(gradesToCompare.length)

    gradesToCompare.forEach((g) => {
        expect(queryGrades.find((qg) => g.id === qg.id)).to.exist
    })
}

function expectSubjectsSummaryNode(
    querySubjects: SubjectSummaryNode[],
    subjectsToCompare: Subject[]
) {
    expect(querySubjects.length).to.eql(subjectsToCompare.length)

    subjectsToCompare.forEach((s) => {
        expect(querySubjects.find((qs) => s.id === qs.id)).to.exist
    })
}

function expectProgramsSummaryNode(
    queryPrograms: ProgramSummaryNode[],
    programsToCompare: Program[]
) {
    expect(queryPrograms.length).to.eql(programsToCompare.length)

    programsToCompare.forEach((p) => {
        expect(queryPrograms.find((qp) => p.id === qp.id)).to.exist
    })
}

use(chaiAsPromised)

describe('classNode', () => {
    let connection: TestConnection
    let testClient: ApolloServerTestClient
    let admin: User
    let org1: Organization
    let org2: Organization
    let org3: Organization
    let org1Classes: Class[] = []
    let org2Classes: Class[] = []
    let org3Classes: Class[] = []
    let classes: Class[] = []
    let org3Schools: School[] = []
    let scope: SelectQueryBuilder<Class>
    let adminPermissions: UserPermissions
    let orgOwnerPermissions: UserPermissions
    let schoolAdminPermissions: UserPermissions
    let orgMemberPermissions: UserPermissions
    let ownerAndSchoolAdminPermissions: UserPermissions
    const classesCount = 12
    const schoolsCount = 3

    // emulated ctx object to could test resolver
    let ctx: Context

    const buildScopeAndContext = async (permissions: UserPermissions) => {
        if (!permissions.isAdmin) {
            await nonAdminClassScope(scope, permissions)
        }

        ctx = ({
            permissions,
            loaders: createContextLazyLoaders(permissions),
        } as unknown) as Context
    }

    const getClassNode = async (classId: string) => {
        const coreResult = (await ctx.loaders.classNode.node.instance.load({
            scope,
            id: classId,
        })) as ClassConnectionNode

        const schoolsResult = await ctx.loaders.classesConnection.schools.instance.load(
            classId
        )
        const ageRangesResult = await ctx.loaders.classesConnection.ageRanges.instance.load(
            classId
        )
        const gradesResult = await ctx.loaders.classesConnection.grades.instance.load(
            classId
        )
        const subjectsResult = await ctx.loaders.classesConnection.subjects.instance.load(
            classId
        )
        const programsResult = await ctx.loaders.classesConnection.programs.instance.load(
            classId
        )

        return {
            coreResult,
            schoolsResult,
            ageRangesResult,
            gradesResult,
            subjectsResult,
            programsResult,
        }
    }

    before(async () => {
        connection = await createTestConnection()
        const server = await createServer(new Model(connection))
        testClient = await createTestClient(server)
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        scope = Class.createQueryBuilder('Class')

        admin = await createAdminUser(testClient)
        org1 = await createOrganization().save()
        org2 = await createOrganization().save()
        org3 = await createOrganization().save()

        org1Classes = []
        org2Classes = []
        org3Classes = []
        classes = []
        org3Schools = []

        // creating org1 classes
        org1Classes = await Class.save(
            Array.from(Array(classesCount), (_, i) => {
                const c = createClass(undefined, org1)
                c.class_name = `class ${i}`
                return c
            })
        )

        // creating org2 classes
        org2Classes = await Class.save(
            Array.from(Array(classesCount), (_, i) => {
                const c = createClass(undefined, org2)
                c.class_name = `class ${i}`
                return c
            })
        )

        // creating org3 schools
        org3Schools = await School.save(
            Array.from(Array(schoolsCount), (_, i) => {
                const s = createSchool(org3)
                s.school_name = `school ${i}`
                return s
            })
        )

        // creating org3 classes
        org3Classes = await Class.save(
            Array.from(Array(classesCount), (_, i) => {
                const c = createClass(
                    [
                        org3Schools[
                            Math.floor(i / (classesCount / schoolsCount))
                        ],
                    ],
                    org3
                )

                c.class_name = `class ${i}`
                return c
            })
        )

        classes.push(...org1Classes, ...org2Classes, ...org3Classes)

        adminPermissions = new UserPermissions(userToPayload(admin))

        // Emulating context
        await buildScopeAndContext(adminPermissions)
    })

    context('data', () => {
        let ageRanges: AgeRange[] = []
        let grades: Grade[] = []
        let subjects: Subject[] = []
        let programs: Program[] = []
        const ageRangesCount = 6
        const gradesCount = 4
        const subjectsCount = 3
        const programsCount = 2

        beforeEach(async () => {
            ageRanges = []
            grades = []
            subjects = []
            programs = []

            // creating org1 age ranges
            ageRanges = await AgeRange.save(
                Array.from(Array(ageRangesCount), (_, i) =>
                    createAgeRange(org1, i + 1, i + 2)
                )
            )

            // creating org1 grades
            grades = await Grade.save(
                Array.from(Array(gradesCount), () => createGrade(org1))
            )

            // creating org1 subjects
            subjects = await Subject.save(
                Array.from(Array(subjectsCount), () => createSubject(org1))
            )

            // creating org1 programs
            programs = await Program.save(
                Array.from(Array(programsCount), () => createProgram(org1))
            )

            org1Classes.forEach(async (c, i) => {
                c.age_ranges = Promise.resolve([
                    ageRanges[Math.floor(i / (classesCount / ageRangesCount))],
                ])

                c.grades = Promise.resolve([
                    grades[Math.floor(i / (classesCount / gradesCount))],
                ])

                c.subjects = Promise.resolve([
                    subjects[Math.floor(i / (classesCount / subjectsCount))],
                ])

                c.programs = Promise.resolve([
                    programs[Math.floor(i / (classesCount / programsCount))],
                ])

                await c.save()
            })
        })

        it('should get the correct class with its corresponding data', async () => {
            const classToTest = org1Classes[0]
            const {
                coreResult,
                schoolsResult,
                ageRangesResult,
                gradesResult,
                subjectsResult,
                programsResult,
            } = await getClassNode(classToTest.class_id)

            expect(coreResult).to.be.an('object')
            expectCoreClassConnectionEdge(coreResult, classToTest)

            expect(schoolsResult).to.be.an('array')
            expect(schoolsResult?.length).to.eq(0)
            expectSchoolsSummaryNode(
                schoolsResult || [],
                (await classToTest.schools) || []
            )

            expect(ageRangesResult).to.be.an('array')
            expect(ageRangesResult?.length).to.eq(1)
            expectAgeRangesSummaryNode(
                ageRangesResult || [],
                (await classToTest.age_ranges) || []
            )

            expect(gradesResult).to.be.an('array')
            expect(gradesResult?.length).to.eq(1)
            expectGradesSummaryNode(
                gradesResult || [],
                (await classToTest.grades) || []
            )

            expect(subjectsResult).to.be.an('array')
            expect(subjectsResult?.length).to.eq(1)
            expectSubjectsSummaryNode(
                subjectsResult || [],
                (await classToTest.subjects) || []
            )

            expect(programsResult).to.be.an('array')
            expect(programsResult?.length).to.eq(1)
            expectProgramsSummaryNode(
                programsResult || [],
                (await classToTest.programs) || []
            )
        })
    })

    context('database calls', () => {
        it('makes just one call to the database', async () => {
            const classToTest1 = org1Classes[0]
            const classToTest2 = org1Classes[1]

            connection.logger.reset()

            await class2Nodes(
                testClient,
                { authorization: getAdminAuthToken() },
                classToTest1.class_id,
                classToTest2.class_id
            )

            expect(connection.logger.count).to.be.eq(1)
        })
    })

    context('permissions', () => {
        let aliases: string[]
        let conditions: string[]

        beforeEach(async () => {
            const orgOwner = await createUser().save()
            const schoolAdmin = await createUser().save()
            const orgMember = await createUser().save()
            const ownerAndSchoolAdmin = await createUser().save()

            const viewClassesRoleOrg3 = await createRole('View Classes', org3, {
                permissions: [PermissionName.view_classes_20114],
            }).save()

            const viewClassesRoleOrg2 = await createRole('View Classes', org2, {
                permissions: [PermissionName.view_classes_20114],
            }).save()

            const viewSchoolClassesRole = await createRole(
                'View School Classes',
                org3,
                { permissions: [PermissionName.view_school_classes_20117] }
            ).save()

            // adding orgOwner to org3 with orgAdminRole¿
            await createOrganizationMembership({
                user: orgOwner,
                organization: org3,
                roles: [viewClassesRoleOrg3],
            }).save()

            // adding ownerAndSchoolAdmin to org2 with orgAdminRole
            await createOrganizationMembership({
                user: ownerAndSchoolAdmin,
                organization: org2,
                roles: [viewClassesRoleOrg2],
            }).save()

            // adding schoolAdmin to org3 with schoolAdminRole
            await createOrganizationMembership({
                user: schoolAdmin,
                organization: org3,
                roles: [viewSchoolClassesRole],
            }).save()

            // adding schoolAdmin to first org3School
            await createSchoolMembership({
                user: schoolAdmin,
                school: org3Schools[0],
                roles: [viewSchoolClassesRole],
            }).save()

            // adding ownerAndSchoolAdmin to org3 with schoolAdminRole
            await createOrganizationMembership({
                user: ownerAndSchoolAdmin,
                organization: org3,
                roles: [viewSchoolClassesRole],
            }).save()

            // adding ownerAndSchoolAdmin to second org3School
            await createSchoolMembership({
                user: ownerAndSchoolAdmin,
                school: org3Schools[1],
                roles: [viewSchoolClassesRole],
            }).save()

            // adding orgMember to org3
            await createOrganizationMembership({
                user: orgMember,
                organization: org3,
                roles: [],
            }).save()

            orgOwnerPermissions = new UserPermissions(userToPayload(orgOwner))
            schoolAdminPermissions = new UserPermissions(
                userToPayload(schoolAdmin)
            )
            orgMemberPermissions = new UserPermissions(userToPayload(orgMember))
            ownerAndSchoolAdminPermissions = new UserPermissions(
                userToPayload(ownerAndSchoolAdmin)
            )
        })

        it('super admin should get any class', async () => {
            aliases = scope.expressionMap.aliases.map((a) => a.name)
            conditions = scope.expressionMap.wheres.map((w) => w.condition)

            expect(aliases.length).to.eq(1)
            expect(aliases).to.deep.equalInAnyOrder(['Class'])

            expect(conditions.length).to.eq(0)
        })

        it('org admin should get a class just from its organization', async () => {
            await buildScopeAndContext(orgOwnerPermissions)

            aliases = scope.expressionMap.aliases.map((a) => a.name)
            conditions = scope.expressionMap.wheres.map((w) => w.condition)

            expect(aliases.length).to.eq(1)
            expect(aliases).to.deep.equalInAnyOrder(['Class'])

            expect(conditions.length).to.eq(1)
            expect(conditions).to.deep.equalInAnyOrder([
                'Class.organization IN (:...classOrgs)',
            ])
        })

        it('school admin should get a class just from its school', async () => {
            await buildScopeAndContext(schoolAdminPermissions)

            aliases = scope.expressionMap.aliases.map((a) => a.name)
            conditions = scope.expressionMap.wheres.map((w) => w.condition)

            expect(aliases.length).to.eq(4)
            expect(aliases).to.deep.equalInAnyOrder([
                'Class',
                'School',
                'School_Class',
                'SchoolMembership',
            ])

            expect(conditions.length).to.eq(1)
            expect(conditions).to.deep.equalInAnyOrder([
                'Class.organization IN (:...schoolOrgs)',
            ])
        })

        it('owner and school admin should get a class just from its school or its organisation', async () => {
            await buildScopeAndContext(ownerAndSchoolAdminPermissions)

            aliases = scope.expressionMap.aliases.map((a) => a.name)
            conditions = scope.expressionMap.wheres.map((w) => w.condition)

            expect(aliases.length).to.eq(4)
            expect(aliases).to.deep.equalInAnyOrder([
                'Class',
                'School',
                'School_Class',
                'SchoolMembership',
            ])

            expect(conditions.length).to.eq(1)
            expect(conditions).to.deep.equalInAnyOrder([
                '(Class.organization IN (:...classOrgs) OR Class.organization IN (:...schoolOrgs) AND SchoolMembership.user_id = :user_id)',
            ])
        })

        context('permissons error handling', () => {
            it('throws an error if an org admin tries to get a class out of its organisation', async () => {
                await buildScopeAndContext(orgOwnerPermissions)
                const classToTest = org1Classes[0]
                await expect(
                    ctx.loaders.classNode.node.instance.load({
                        scope,
                        id: classToTest.class_id,
                    })
                ).to.be.rejected
            })

            it('throws an error if a school admin tries to get a class out of its school', async () => {
                await buildScopeAndContext(schoolAdminPermissions)
                const classToTest = org3Classes[4]
                await expect(
                    ctx.loaders.classNode.node.instance.load({
                        scope,
                        id: classToTest.class_id,
                    })
                ).to.be.rejected
            })

            it('throws an error if an owner and school admin tries to get a class out of its school', async () => {
                await buildScopeAndContext(ownerAndSchoolAdminPermissions)
                let classToTest = org1Classes[0]

                await expect(
                    ctx.loaders.classNode.node.instance.load({
                        scope,
                        id: classToTest.class_id,
                    })
                ).to.be.rejected

                classToTest = org3Classes[10]

                await expect(
                    ctx.loaders.classNode.node.instance.load({
                        scope,
                        id: classToTest.class_id,
                    })
                ).to.be.rejected
            })

            it('throws an error if a non admin user tries to get a class', async () => {
                await buildScopeAndContext(orgMemberPermissions)
                const classToTest = org1Classes[0]

                await expect(
                    ctx.loaders.classNode.node.instance.load({
                        scope,
                        id: classToTest.class_id,
                    })
                ).to.be.rejected
            })
        })
    })

    context('input error handling', () => {
        it('throws an error if id is not a ID', async () => {
            await expect(
                ctx.loaders.classNode.node.instance.load({
                    scope,
                    id: '1-4m-n07-4n-1d',
                })
            ).to.be.rejected
        })

        it("throws an error if id doesn't exist", async () => {
            await expect(
                ctx.loaders.classNode.node.instance.load({
                    scope,
                    id: '00000000-0000-0000-0000-00000',
                })
            ).to.be.rejected
        })
    })
})
