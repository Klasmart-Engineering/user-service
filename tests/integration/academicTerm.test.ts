import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import { getConnection, In } from 'typeorm'
import { AcademicTerm } from '../../src/entities/academicTerm'
import { Class } from '../../src/entities/class'
import { Organization } from '../../src/entities/organization'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { Role } from '../../src/entities/role'
import { School } from '../../src/entities/school'
import { Status } from '../../src/entities/status'
import { User } from '../../src/entities/user'
import { organizationAdminRole } from '../../src/permissions/organizationAdmin'
import { PermissionName } from '../../src/permissions/permissionNames'
import { UserPermissions } from '../../src/permissions/userPermissions'
import {
    CreateAcademicTerms,
    DeleteAcademicTerms,
} from '../../src/resolvers/academicTerm'
import {
    CreateAcademicTermInput,
    DeleteAcademicTermInput,
} from '../../src/types/graphQL/academicTerm'
import { sortObjectArray } from '../../src/utils/array'
import {
    createEntityAPIError,
    createInvalidDateRangeAPIError,
    createMustHaveExactlyNAPIError,
    createOverlappingDateRangeAPIError,
} from '../../src/utils/resolvers/errors'
import { createAcademicTerm } from '../factories/academicTerm.factory'
import { createClass, createClasses } from '../factories/class.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import {
    createRole,
    createRole as createRoleFactory,
} from '../factories/role.factory'
import { createSchool } from '../factories/school.factory'
import { createUser } from '../factories/user.factory'
import { compareMultipleErrors } from '../utils/apiError'
import { userToPayload } from '../utils/operations/userOps'
import { TestConnection } from '../utils/testConnection'

use(deepEqualInAnyOrder)
use(chaiAsPromised)

describe('academicTerm', () => {
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    describe('createAcademicTerms', () => {
        let orgAdminUser: User
        let org: Organization
        let orgAdminMembership: OrganizationMembership
        let orgAdminRole: Role
        let schools: School[]
        let academicTerms: AcademicTerm[]
        let inputs: CreateAcademicTermInput[]

        const createAcademicTerms = (
            input: CreateAcademicTermInput[] = [],
            authUser = orgAdminUser
        ) =>
            new CreateAcademicTerms(
                input,
                new UserPermissions(userToPayload(authUser))
            )

        beforeEach(async () => {
            orgAdminUser = await createUser().save() // SuperAdmin role does not have required permissions, but OrgAdmin role does
            org = await Organization.save(createOrganization())
            orgAdminRole = await createRole('Org Admin Role for org', org, {
                permissions: organizationAdminRole.permissions,
            }).save()
            orgAdminMembership = await createOrganizationMembership({
                user: orgAdminUser,
                organization: org,
                roles: [orgAdminRole],
            }).save()
            schools = await School.save([
                createSchool(org, 'School1'),
                createSchool(org, 'School2'),
            ])
            // Create existing past ATs
            academicTerms = await AcademicTerm.save([
                createAcademicTerm(schools[0], {
                    name: 'School 1 Existing Academic Term',
                    start_date: new Date('2020-09-01T00:00:00Z'),
                    end_date: new Date('2021-05-01T00:00:00Z'),
                }),
                createAcademicTerm(schools[1], {
                    name: 'School 2 Existing Academic Term',
                    start_date: new Date('2020-01-01T00:00:00Z'),
                    end_date: new Date('2020-12-01T00:00:00Z'),
                }),
            ])
            inputs = [
                {
                    schoolId: schools[0].school_id,
                    name: 'School1 New Academic Term',
                    startDate: new Date('2022-09-01T00:00:00Z'),
                    endDate: new Date('2023-05-01T00:00:00Z'),
                },
                {
                    schoolId: schools[1].school_id,
                    name: 'School2 New Academic Term',
                    startDate: new Date('2022-01-01T00:00:00Z'),
                    endDate: new Date('2022-12-01T00:00:00Z'),
                },
            ]
        })

        context('.generateEntityMaps', () => {
            it('creates maps from input schoolIds to active schools', async () => {
                schools[1].status = Status.INACTIVE
                await schools[1].save()

                const actualEntityMap = await createAcademicTerms().generateEntityMaps(
                    inputs
                )

                expect(
                    Array.from(actualEntityMap.schools.keys())
                ).to.deep.equal([schools[0].school_id])
                expect(
                    actualEntityMap.schools.get(schools[0].school_id)!.school_id
                ).to.eq(schools[0].school_id)
                expect(
                    actualEntityMap.schools.get(schools[0].school_id)!.status
                ).to.eq(Status.ACTIVE)
            })

            it('creates maps from input schoolIds to any existing academic terms under the school', async () => {
                const actualEntityMap = await createAcademicTerms().generateEntityMaps(
                    inputs
                )

                expect(
                    Array.from(actualEntityMap.schoolsAcademicTerms.keys())
                ).to.deep.equalInAnyOrder([
                    schools[0].school_id,
                    schools[1].school_id,
                ])
                expect(
                    actualEntityMap.schoolsAcademicTerms
                        .get(schools[0].school_id)!
                        .map((at) => at.name)
                ).to.deep.eq(['School 1 Existing Academic Term'])
                expect(
                    actualEntityMap.schoolsAcademicTerms
                        .get(schools[1].school_id)!
                        .map((at) => at.name)
                ).to.deep.eq(['School 2 Existing Academic Term'])
            })
        })

        context('.authorize', () => {
            let nonAdminUser: User
            let membership: OrganizationMembership

            const authorize = async (input: CreateAcademicTermInput[]) => {
                const mutationClass = createAcademicTerms(input, nonAdminUser)
                const maps = await mutationClass.generateEntityMaps(input)
                return mutationClass.authorize(input, maps)
            }

            beforeEach(async () => {
                nonAdminUser = await createUser().save()

                const role = await Role.save(
                    createRoleFactory(undefined, org, {
                        permissions: [
                            PermissionName.create_academic_term_20228,
                        ],
                    })
                )

                membership = await OrganizationMembership.save(
                    createOrganizationMembership({
                        user: nonAdminUser,
                        organization: org,
                        roles: [role],
                    })
                )
            })

            context(
                'when user has correct permission for all schools of inputted academic terms',
                () => {
                    it('fulfills its promise', async () => {
                        await expect(authorize(inputs)).to.be.eventually
                            .fulfilled
                    })
                }
            )

            context(
                'when user has insufficient permissions for some schools of inputted academic terms',
                () => {
                    beforeEach(async () => {
                        membership.roles = Promise.resolve([])
                        await membership.save()
                    })

                    it('rejects its promise with the correct message', async () => {
                        await expect(
                            authorize(inputs)
                        ).to.be.eventually.rejectedWith(
                            /User\(.*\) does not have Permission\(create_academic_term_20228\) in Organizations\(.*\)/
                        )
                    })
                }
            )
        })

        context('.validationOverAllInputs', () => {
            it('records and returns errors for invalid date ranges passed in before overlap checks', async () => {
                // Switch around start and end dates for both 1st and 2nd inputs
                const input1StartDate = inputs[1].startDate
                const input1EndDate = inputs[1].endDate
                inputs[0].startDate = input1EndDate
                inputs[0].endDate = input1StartDate
                inputs[1].startDate = input1EndDate
                inputs[1].endDate = input1StartDate

                const expectedOutput = {
                    validInputs: [],
                    apiErrors: [
                        createInvalidDateRangeAPIError(0, [
                            'startDate',
                            'endDate',
                        ]),
                        createInvalidDateRangeAPIError(1, [
                            'startDate',
                            'endDate',
                        ]),
                    ],
                }

                const actualOutput = createAcademicTerms().validationOverAllInputs(
                    inputs
                )

                expect(actualOutput.validInputs).to.deep.eq(
                    expectedOutput.validInputs
                )
                compareMultipleErrors(
                    actualOutput.apiErrors,
                    expectedOutput.apiErrors
                )
            })

            it('records and returns errors for overlapping (valid) date ranges passed in per school, includes first inputs', async () => {
                // Add overlapping ATs (new startDate < previous input endDate)
                inputs.push({
                    schoolId: schools[0].school_id,
                    name: 'School1 New Overlapping Academic Term',
                    startDate: new Date('2022-09-01T00:00:00Z'), // Same startDate as previous AT input (for same school)!
                    endDate: new Date('2023-05-01T00:00:00Z'), // Same endDate as previous AT input (for same school)!
                })
                inputs.push({
                    schoolId: schools[1].school_id,
                    name: 'School2 New Overlapping Academic Term',
                    startDate: new Date('2022-10-01T00:00:00Z'),
                    endDate: new Date('2023-06-01T00:00:00Z'),
                })

                const expectedOutput = {
                    validInputs: [],
                    apiErrors: [
                        createOverlappingDateRangeAPIError(
                            0,
                            ['startDate', 'endDate'],
                            'AcademicTerm',
                            'School',
                            {
                                startDate: inputs[0].startDate,
                                endDate: inputs[0].endDate,
                            },
                            {
                                startDate: inputs[2].startDate,
                                endDate: inputs[2].endDate,
                            },
                            'schoolId',
                            schools[0].school_id
                        ),
                        createOverlappingDateRangeAPIError(
                            1,
                            ['startDate', 'endDate'],
                            'AcademicTerm',
                            'School',
                            {
                                startDate: inputs[1].startDate,
                                endDate: inputs[1].endDate,
                            },
                            {
                                startDate: inputs[3].startDate,
                                endDate: inputs[3].endDate,
                            },
                            'schoolId',
                            schools[1].school_id
                        ),
                        createOverlappingDateRangeAPIError(
                            2,
                            ['startDate', 'endDate'],
                            'AcademicTerm',
                            'School',
                            {
                                startDate: inputs[2].startDate,
                                endDate: inputs[2].endDate,
                            },
                            {
                                startDate: inputs[0].startDate,
                                endDate: inputs[0].endDate,
                            },
                            'schoolId',
                            schools[0].school_id
                        ),
                        createOverlappingDateRangeAPIError(
                            3,
                            ['startDate', 'endDate'],
                            'AcademicTerm',
                            'School',
                            {
                                startDate: inputs[3].startDate,
                                endDate: inputs[3].endDate,
                            },
                            {
                                startDate: inputs[1].startDate,
                                endDate: inputs[1].endDate,
                            },
                            'schoolId',
                            schools[1].school_id
                        ),
                    ],
                }

                const actualOutput = createAcademicTerms().validationOverAllInputs(
                    inputs
                )

                expect(actualOutput.validInputs).to.deep.eq(
                    expectedOutput.validInputs
                )
                compareMultipleErrors(
                    actualOutput.apiErrors,
                    expectedOutput.apiErrors
                )
            })
        })

        context('.validate', () => {
            const validate = async (inputs: CreateAcademicTermInput[]) => {
                const mutationClass = createAcademicTerms([], orgAdminUser)
                const maps = await mutationClass.generateEntityMaps(inputs)
                return inputs.flatMap((input, idx) =>
                    mutationClass.validate(
                        idx,
                        academicTerms[0], // Placeholder, is not used in this validate()
                        input,
                        maps
                    )
                )
            }
            it('records and returns errors for non-existent (or inactive) school IDs', async () => {
                schools[1].status = Status.INACTIVE
                await schools[1].save()

                const expectedErrors = [
                    createEntityAPIError(
                        'nonExistent',
                        1,
                        'School',
                        schools[1].school_id
                    ),
                ]
                const actualErrors = await validate(inputs)
                compareMultipleErrors(actualErrors, expectedErrors)
            })

            it('records errors for existent AT name in the school', async () => {
                inputs[1].name = academicTerms[1].name

                const expectedErrors = [
                    createEntityAPIError(
                        'existentChild',
                        1,
                        'AcademicTerm',
                        inputs[1].name,
                        'School',
                        schools[1].school_id,
                        ['schoolId', 'name']
                    ),
                ]
                const actualErrors = await validate(inputs)
                compareMultipleErrors(actualErrors, expectedErrors)
            })

            context(
                'input date range overlaps with existing AT date ranges',
                () => {
                    it('records error for case where input start date overlaps with first existent start date', async () => {
                        inputs[1] = {
                            schoolId: schools[1].school_id,
                            name: 'School2 New Academic Term',
                            startDate: new Date('2019-01-01T00:00:00'),
                            endDate: new Date('2021-01-01T00:00:00'),
                        }

                        const expectedErrors = [
                            createOverlappingDateRangeAPIError(
                                1,
                                ['startDate', 'endDate'],
                                'AcademicTerm',
                                'School',
                                {
                                    startDate: inputs[1].startDate,
                                    endDate: inputs[1].endDate,
                                },
                                {
                                    startDate: academicTerms[1].start_date,
                                    endDate: academicTerms[1].end_date,
                                },
                                'schoolId',
                                schools[1].school_id
                            ),
                        ]
                        const actualErrors = await validate(inputs)
                        compareMultipleErrors(actualErrors, expectedErrors)
                    })

                    it('records error for case where input start date is after existent start date but is before existent end date', async () => {
                        inputs[1] = {
                            schoolId: schools[1].school_id,
                            name: 'School2 New Academic Term',
                            startDate: new Date('2020-09-01T00:00:00'),
                            endDate: new Date('2021-05-01T00:00:00'),
                        }

                        const expectedErrors = [
                            createOverlappingDateRangeAPIError(
                                1,
                                ['startDate', 'endDate'],
                                'AcademicTerm',
                                'School',
                                {
                                    startDate: inputs[1].startDate,
                                    endDate: inputs[1].endDate,
                                },
                                {
                                    startDate: academicTerms[1].start_date,
                                    endDate: academicTerms[1].end_date,
                                },
                                'schoolId',
                                schools[1].school_id
                            ),
                        ]
                        const actualErrors = await validate(inputs)
                        compareMultipleErrors(actualErrors, expectedErrors)
                    })
                }
            )
        })

        context('.process', () => {
            it('creates the entity with the correct attributes', async () => {
                const mutationClass = createAcademicTerms()
                const maps = await mutationClass.generateEntityMaps(inputs)
                const actualOutput = mutationClass.process(inputs[0], maps)

                expect(actualOutput.outputEntity.name).to.eq(inputs[0].name)
                expect(actualOutput.outputEntity.start_date).to.eq(
                    inputs[0].startDate
                )
                expect(actualOutput.outputEntity.end_date).to.eq(
                    inputs[0].endDate
                )

                const actualSchool = await actualOutput.outputEntity.school
                expect(actualSchool.school_id).to.eq(schools[0].school_id)
            })
        })

        context('.run', () => {
            it('provides the correct MutationResult and updates the database', async () => {
                const result = await createAcademicTerms(inputs).run()

                const dbATs = await AcademicTerm.find({
                    where: { name: In(inputs.map((i) => i.name)) },
                }).then((dbc) => sortObjectArray(dbc, 'name'))

                expect(dbATs.length).to.eq(inputs.length)
                for (const [idx, i] of inputs.entries()) {
                    expect(result.academicTerms[idx].name).to.eq(i.name)
                    expect(result.academicTerms[idx].startDate).to.eq(
                        i.startDate
                    )
                    expect(result.academicTerms[idx].endDate).to.eq(i.endDate)

                    expect(dbATs[idx].name).to.eq(i.name)
                    expect(dbATs[idx].start_date).to.deep.eq(i.startDate)
                    expect(dbATs[idx].end_date).to.deep.eq(i.endDate)
                }
            })

            it('makes same number of queries regardless of input length', async () => {
                inputs.push({
                    schoolId: schools[1].school_id,
                    name: 'School2 New Valid Academic Term 2',
                    startDate: new Date('2024-01-01T00:00:00Z'),
                    endDate: new Date('2024-05-01T00:00:00Z'),
                })
                inputs.push({
                    schoolId: schools[1].school_id,
                    name: 'School2 New Valid Academic Term 3',
                    startDate: new Date('2024-06-01T00:00:00Z'),
                    endDate: new Date('2024-08-01T00:00:00Z'),
                })

                connection.logger.reset()
                await createAcademicTerms([inputs[0]]).run()
                const countForOneInput = connection.logger.count
                connection.logger.reset()
                await createAcademicTerms(inputs.slice(1)).run()
                const countForMultipleInputs = connection.logger.count
                expect(countForMultipleInputs).to.eq(countForOneInput)
            })
        })
    })

    describe('deleteAcademicTerms', () => {
        let orgAdminUser: User
        let inputs: DeleteAcademicTermInput[]
        let academicTerms: AcademicTerm[]
        let org: Organization
        let orgAdminMembership: OrganizationMembership
        let orgAdminRole: Role

        beforeEach(async () => {
            orgAdminUser = await createUser().save() // SuperAdmin role does not have required permissions, but OrgAdmin role does

            org = await createOrganization().save()
            const school = await createSchool(org).save()

            orgAdminRole = await createRole('Org Admin Role for org', org, {
                permissions: organizationAdminRole.permissions,
            }).save()

            orgAdminMembership = await createOrganizationMembership({
                user: orgAdminUser,
                organization: org,
                roles: [orgAdminRole],
            }).save()

            academicTerms = [
                await createAcademicTerm(school, {}).save(),
                await createAcademicTerm(school, {}).save(),
            ]

            inputs = academicTerms.map((t) => {
                return {
                    id: t.id,
                }
            })
        })

        const deleteAcademicTerms = (authUser = orgAdminUser) =>
            new DeleteAcademicTerms(
                inputs,
                new UserPermissions(userToPayload(authUser))
            )
        context('.generateEntityMaps', () => {
            it('fetches ATs by ID', async () => {
                const map = await deleteAcademicTerms().generateEntityMaps(
                    inputs
                )
                const terms = map.mainEntity
                expect(terms.size).to.eq(inputs.length)
                expect(Array.from(terms.keys())).have.same.members(
                    inputs.map((i) => i.id)
                )
                expect(
                    Array.from(terms.values()).map((t) => t.id)
                ).have.same.members(inputs.map((i) => i.id))
            })
            it('fetches classes by AT', async () => {
                const at1Classes = await createClasses(2)
                const at2Classes = await createClasses(2)
                await Class.save([...at1Classes, ...at2Classes])
                academicTerms[0]!.classes = Promise.resolve(at1Classes)
                academicTerms[1]!.classes = Promise.resolve(at2Classes)
                await AcademicTerm.save(academicTerms)

                const map = await deleteAcademicTerms().generateEntityMaps(
                    inputs
                )
                const classes = map.classesByAcademicTerm

                expect(classes.size).to.eq(2)
                expect(Array.from(classes.keys())).have.same.members(
                    inputs.map((i) => i.id)
                )
                expect(
                    classes.get(academicTerms[0].id)?.map((c) => c.class_id)
                ).to.have.same.members(at1Classes.map((c) => c.class_id))
                expect(
                    classes.get(academicTerms[1].id)?.map((c) => c.class_id)
                ).to.have.same.members(at2Classes.map((c) => c.class_id))
            })
            it('loads school and classes relations', async () => {
                const cls = await createClass().save()
                academicTerms[0]!.classes = Promise.resolve([cls])
                await academicTerms[0].save()

                const map = await deleteAcademicTerms().generateEntityMaps(
                    inputs
                )
                connection.logger.reset()
                await map.mainEntity.get(academicTerms[0].id)?.classes
                await map.mainEntity.get(academicTerms[0].id)?.school
                expect(connection.logger.count).to.eq(0)
            })
        })
        context('.authorize', () => {
            let nonAdminUser: User
            beforeEach(async () => {
                nonAdminUser = await createUser().save()
            })
            const authorize = async (user: User) => {
                const mutationClass = deleteAcademicTerms(user)
                const maps = await mutationClass.generateEntityMaps(inputs)
                return mutationClass.authorize(inputs, maps)
            }
            it('passes when user has required permission in all orgs', async () => {
                const role = await createRoleFactory('role', org, {
                    permissions: [PermissionName.delete_academic_term_20448],
                }).save()
                await createOrganizationMembership({
                    user: nonAdminUser,
                    organization: org,
                    roles: [role],
                }).save()
                await expect(authorize(nonAdminUser)).to.be.eventually.fulfilled
            })
            it('fails when user does not have required permissions in any org', async () => {
                await expect(
                    authorize(nonAdminUser)
                ).to.be.eventually.rejectedWith(
                    /User\(.*\) does not have Permission\(delete_academic_term_20448\) in Organizations\(.*\)/
                )
            })
        })

        context('.validate', () => {
            it('errors for academic terms with classes assigned', async () => {
                const classes = await createClasses(2)
                await Class.save(classes)
                academicTerms[0]!.classes = Promise.resolve(classes)
                await AcademicTerm.save(academicTerms)

                const map = await deleteAcademicTerms().generateEntityMaps(
                    inputs
                )

                const apiErrors = deleteAcademicTerms().validate(
                    0,
                    academicTerms[0],
                    { id: academicTerms[0].id },
                    map
                )

                compareMultipleErrors(apiErrors, [
                    createMustHaveExactlyNAPIError(
                        'AcademicTerm',
                        academicTerms[0].id,
                        'Classes',
                        0,
                        0
                    ),
                ])
                expect(apiErrors[0].message).to.eq(
                    `On index 0, AcademicTerm ${academicTerms[0].id} must have exactly 0 Classes.`
                )
            })
        })
        context('.run', () => {
            it('deletes academic terms', async () => {
                await deleteAcademicTerms().run()
                const terms = await AcademicTerm.find()
                expect(terms).to.have.length(2)
                for (const term of terms) {
                    expect(term.status).to.eq(Status.INACTIVE)
                    expect(term.deleted_at).to.exist
                }
            })
        })
    })
})
