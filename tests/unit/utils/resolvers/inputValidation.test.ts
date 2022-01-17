import { expect } from 'chai'
import { v4 as uuid_v4 } from 'uuid'
import { Organization } from '../../../../src/entities/organization'
import { OrganizationMembership } from '../../../../src/entities/organizationMembership'
import { School } from '../../../../src/entities/school'
import { SchoolMembership } from '../../../../src/entities/schoolMembership'
import { User } from '../../../../src/entities/user'
import { createEntityAPIError } from '../../../../src/utils/resolvers/errors'
import {
    OrganizationMembershipMap,
    SchoolMembershipMap,
} from '../../../../src/utils/resolvers/entityMaps'
import { validate } from '../../../../src/utils/resolvers/inputValidation'
import { ObjMap } from '../../../../src/utils/stringUtils'
import { createOrganization } from '../../../factories/organization.factory'
import { createOrganizationMemberships } from '../../../factories/organizationMembership.factory'
import { createSchool } from '../../../factories/school.factory'
import { createSchoolMemberships } from '../../../factories/schoolMembership.factory'
import { createUsers } from '../../../factories/user.factory'
import { compareMultipleErrors } from '../../../utils/apiError'
import { compareMultipleEntities } from '../../../utils/assertions'

describe('inputValidation', () => {
    const index = 0

    const getMockIdList = (length: number) =>
        Array(length)
            .fill(undefined)
            .map(() => uuid_v4())

    describe('#checkForNonExistentOrDuplicate', () => {
        let users: User[]
        let userMap: Map<string, User>

        beforeEach(() => {
            users = createUsers(5)
            userMap = new Map(
                users.map((u) => {
                    u.user_id = uuid_v4()
                    return [u.user_id, u]
                })
            )
        })

        context('when nonExistent', () => {
            function createNonExistentUserErrors(idList: string[]) {
                return idList.map((id) =>
                    createEntityAPIError('nonExistent', index, 'User', id)
                )
            }

            context('when the requested entities do not exist', () => {
                let fakeIds: string[]

                beforeEach(() => (fakeIds = getMockIdList(3)))

                it('returns errors containing the ids', () => {
                    const { values, errors } = validate.nonExistent.user(
                        index,
                        fakeIds,
                        userMap
                    )
                    const xErrors = createNonExistentUserErrors(fakeIds)
                    expect(values).to.be.empty
                    compareMultipleErrors(errors, xErrors)
                })
            })

            context('when all the requested entities exist', () => {
                let requestedUsers: User[]

                beforeEach(
                    () => (requestedUsers = [0, 2, 3].map((i) => users[i]))
                )

                it('returns the entities', () => {
                    const { values, errors } = validate.nonExistent.user(
                        index,
                        requestedUsers.map((ru) => ru.user_id),
                        userMap
                    )
                    expect(errors).to.be.empty
                    expect(values).to.deep.equal(requestedUsers)
                })
            })

            context('when some of the requested entities exist', () => {
                let realUsers: User[]
                let fakeIds: string[]

                beforeEach(() => {
                    const realIndices = [0, 1]
                    realUsers = realIndices.map((i) => users[i])
                    fakeIds = getMockIdList(2)
                })

                it('returns the entities when they exist and errors otherwise', () => {
                    const { values, errors } = validate.nonExistent.user(
                        index,
                        [...realUsers.map((ru) => ru.user_id), ...fakeIds],
                        userMap
                    )
                    const xErrors = createNonExistentUserErrors(fakeIds)
                    compareMultipleErrors(errors, xErrors)
                    compareMultipleEntities(values, realUsers)
                })
            })
        })

        context('when duplicate', () => {
            context('when some of the requested entities exist', () => {
                let existentUsers: User[]
                let newUserIds: string[]

                beforeEach(() => {
                    const existentIndices = [0, 1]
                    existentUsers = existentIndices.map((i) => users[i])
                    newUserIds = getMockIdList(2)
                })

                it('returns the entities and errors when they exist', () => {
                    const { values, errors } = validate.duplicate.user(
                        index,
                        [
                            ...existentUsers.map((ru) => ru.user_id),
                            ...newUserIds,
                        ],
                        userMap
                    )
                    const xErrors = existentUsers.map((u) =>
                        createEntityAPIError(
                            'duplicate',
                            index,
                            'User',
                            u.user_id
                        )
                    )
                    compareMultipleErrors(errors, xErrors)
                    compareMultipleEntities(values, existentUsers)
                })
            })
        })
    })

    describe('#checkForNonExistentOrDuplicateChild', () => {
        let classId: string
        let programIds: string[]
        let programIdsInClassSet: Set<string>

        beforeEach(() => {
            classId = uuid_v4()
            programIds = getMockIdList(5)
            programIdsInClassSet = new Set(programIds)
        })

        context('when nonExistentChild', () => {
            function createNonExistentProgramInClassErrors(
                clsId: string,
                progIds: string[]
            ) {
                return progIds.map((progId) =>
                    createEntityAPIError(
                        'nonExistentChild',
                        index,
                        'Program',
                        progId,
                        'Class',
                        clsId
                    )
                )
            }

            context('when the requested entities do not exist', () => {
                let fakeIds: string[]

                beforeEach(() => (fakeIds = getMockIdList(3)))

                it('returns errors containing the ids', () => {
                    const errors = validate.nonExistent.programs.in.class(
                        index,
                        classId,
                        fakeIds,
                        programIdsInClassSet
                    )
                    const xErrors = createNonExistentProgramInClassErrors(
                        classId,
                        fakeIds
                    )
                    compareMultipleErrors(errors, xErrors)
                })
            })

            context('when all the requested entities exist', () => {
                let requestedProgramIds: string[]

                beforeEach(
                    () =>
                        (requestedProgramIds = [0, 2, 3].map(
                            (i) => programIds[i]
                        ))
                )

                it('returns no errors', () => {
                    const errors = validate.nonExistent.programs.in.class(
                        index,
                        classId,
                        requestedProgramIds,
                        programIdsInClassSet
                    )
                    expect(errors).to.be.empty
                })
            })

            context('when some of the requested entities exist', () => {
                let realProgramIds: string[]
                let fakeIds: string[]

                beforeEach(() => {
                    const realIndices = [0, 1]
                    realProgramIds = realIndices.map((i) => programIds[i])
                    fakeIds = getMockIdList(2)
                })

                it('returns a errors for the ones that do not exist', () => {
                    const errors = validate.nonExistent.programs.in.class(
                        index,
                        classId,
                        [...realProgramIds, ...fakeIds],
                        programIdsInClassSet
                    )
                    const xErrors = createNonExistentProgramInClassErrors(
                        classId,
                        fakeIds
                    )
                    compareMultipleErrors(errors, xErrors)
                })
            })
        })

        context('when duplicate', () => {
            context('when some of the requested entities exist', () => {
                let existentProgramIds: string[]
                let newProgramIds: string[]

                beforeEach(() => {
                    const existentIndices = [0, 1]
                    existentProgramIds = existentIndices.map(
                        (i) => programIds[i]
                    )
                    newProgramIds = getMockIdList(2)
                })

                it('returns an error when they exist', () => {
                    const errors = validate.duplicate.programs.in.class(
                        index,
                        classId,
                        [...existentProgramIds, ...newProgramIds],
                        programIdsInClassSet
                    )
                    const xErrors = existentProgramIds.map((progId) =>
                        createEntityAPIError(
                            'duplicateChild',
                            index,
                            'Program',
                            progId,
                            'Class',
                            classId
                        )
                    )
                    compareMultipleErrors(errors, xErrors)
                })
            })
        })
    })

    describe('#validate.nonExistentChild', () => {
        let users: User[]

        beforeEach(() => {
            users = createUsers(5)
            users.forEach((u) => (u.user_id = uuid_v4()))
        })

        const createNonExistentChildError = (
            userId: string,
            parentEntityName: 'School' | 'Organization',
            parentId: string
        ) =>
            createEntityAPIError(
                'nonExistentChild',
                index,
                'User',
                userId,
                parentEntityName,
                parentId
            )

        context('.organization', () => {
            let organization: Organization
            let memberships: OrganizationMembership[]
            let membershipMap: OrganizationMembershipMap

            function validateNonExistentChildOrganizations() {
                return validate.nonExistent.users.in.organization(
                    index,
                    organization.organization_id,
                    users.map((u) => u.user_id),
                    membershipMap
                )
            }

            function makeOrgMembershipsIntoMap(
                orgMemberships: OrganizationMembership[]
            ): OrganizationMembershipMap {
                return new ObjMap(
                    orgMemberships.map((m) => {
                        const organizationId = m.organization_id
                        const userId = m.user_id
                        return {
                            key: { organizationId, userId },
                            value: m,
                        }
                    })
                )
            }

            beforeEach(() => {
                organization = createOrganization()
                organization.organization_id = uuid_v4()
            })

            context('when the organization contains all users', () => {
                beforeEach(() => {
                    memberships = createOrganizationMemberships(
                        users,
                        organization
                    )
                    membershipMap = makeOrgMembershipsIntoMap(memberships)
                })

                it('returns all the memberships', () => {
                    const val = validateNonExistentChildOrganizations()
                    expect(val.errors).to.be.empty
                    expect(val.values).to.deep.equal(memberships)
                })
            })

            context('when the organization contains some of the users', () => {
                let usersInOrg: User[]
                let usersNotInOrg: User[]

                beforeEach(() => {
                    usersNotInOrg = users.slice(0, 3)
                    usersInOrg = users.slice(3)
                    memberships = createOrganizationMemberships(
                        usersInOrg,
                        organization
                    )
                    membershipMap = makeOrgMembershipsIntoMap(memberships)
                })

                it('returns the valid memberships and errors for the others', () => {
                    const val = validateNonExistentChildOrganizations()
                    const xErrors = usersNotInOrg.map((u) => {
                        return createNonExistentChildError(
                            u.user_id,
                            'Organization',
                            organization.organization_id
                        )
                    })
                    expect(val.values).to.deep.equal(memberships)
                    compareMultipleErrors(val.errors, xErrors)
                })
            })

            context('when the organization contains none of the users', () => {
                it('returns an error for each user', () => {
                    const val = validateNonExistentChildOrganizations()
                    const xErrors = users.map((u) => {
                        return createNonExistentChildError(
                            u.user_id,
                            'Organization',
                            organization.organization_id
                        )
                    })
                    expect(val.values).to.be.empty
                    compareMultipleErrors(val.errors, xErrors)
                })
            })
        })

        context('.school', () => {
            let school: School
            let memberships: SchoolMembership[]
            let membershipMap: SchoolMembershipMap

            function makeSchoolMembershipsIntoMap(
                schoolMemberships: SchoolMembership[]
            ): SchoolMembershipMap {
                return new ObjMap(
                    schoolMemberships.map((m: SchoolMembership) => {
                        const schoolId = m.school_id
                        const userId = m.user_id
                        return {
                            key: { schoolId, userId },
                            value: m,
                        }
                    })
                )
            }

            function validateNonExistentChildSchool() {
                return validate.nonExistent.users.in.school(
                    index,
                    school.school_id,
                    users.map((u) => u.user_id),
                    membershipMap
                )
            }

            beforeEach(() => {
                school = createSchool()
                school.school_id = uuid_v4()
            })

            context('when the school contains all users', () => {
                beforeEach(() => {
                    memberships = createSchoolMemberships(users, school)
                    membershipMap = makeSchoolMembershipsIntoMap(memberships)
                })

                it('returns all the memberships', () => {
                    const val = validateNonExistentChildSchool()
                    expect(val.errors).to.be.empty
                    expect(val.values).to.deep.equal(memberships)
                })
            })

            context('when the school contains some of the users', () => {
                let usersInSchool: User[]
                let usersNotInSchool: User[]

                beforeEach(() => {
                    usersNotInSchool = users.slice(0, 3)
                    usersInSchool = users.slice(3)
                    memberships = createSchoolMemberships(usersInSchool, school)
                    membershipMap = makeSchoolMembershipsIntoMap(memberships)
                })

                it('returns the valid memberships and errors for the others', () => {
                    const val = validateNonExistentChildSchool()
                    const xErrors = usersNotInSchool.map((u) => {
                        return createNonExistentChildError(
                            u.user_id,
                            'School',
                            school.school_id
                        )
                    })
                    expect(val.values).to.deep.equal(memberships)
                    compareMultipleErrors(val.errors, xErrors)
                })
            })

            context('when the school contains none of the users', () => {
                it('returns an error for each user', () => {
                    const val = validateNonExistentChildSchool()
                    const xErrors = users.map((u) => {
                        return createNonExistentChildError(
                            u.user_id,
                            'School',
                            school.school_id
                        )
                    })
                    expect(val.values).to.be.empty
                    compareMultipleErrors(val.errors, xErrors)
                })
            })
        })
    })
})
