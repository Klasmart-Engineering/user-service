import { expect } from 'chai'
import supertest from 'supertest'
import { getConnection } from 'typeorm'
import { Organization } from '../../src/entities/organization'
import { OrganizationMembership } from '../../src/entities/organizationMembership'
import { Role } from '../../src/entities/role'
import { School } from '../../src/entities/school'
import { SchoolMembership } from '../../src/entities/schoolMembership'
import { User } from '../../src/entities/user'
import { organizationAdminRole } from '../../src/permissions/organizationAdmin'
import { PermissionName } from '../../src/permissions/permissionNames'
import {
    CreateAcademicTermInput,
    DeleteAcademicTermInput,
} from '../../src/types/graphQL/academicTerm'
import { createAcademicTerm } from '../factories/academicTerm.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createRole } from '../factories/role.factory'
import { createSchool } from '../factories/school.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createUser } from '../factories/user.factory'
import {
    CREATE_ACADEMIC_TERMS,
    DELETE_ACADEMIC_TERMS,
} from '../utils/operations/academicTermOps'
import { userToPayload } from '../utils/operations/userOps'
import { generateToken } from '../utils/testConfig'
import { TestConnection } from '../utils/testConnection'
import { makeRequest } from './utils'

const url = 'http://localhost:8080'
const request = supertest(url)

describe('acceptance.academicTerm', () => {
    let connection: TestConnection

    before(async () => {
        connection = getConnection() as TestConnection
    })

    context('createAcademicTerms', () => {
        let schools: School[] = []
        let schoolMemberships: SchoolMembership[] = []
        let organizationMembership: OrganizationMembership
        let org: Organization
        let nonAdminUser: User
        let inputs: CreateAcademicTermInput[]
        let createATRole: Role

        beforeEach(async () => {
            nonAdminUser = await createUser().save()
            org = await Organization.save(createOrganization())
            schools = await School.save([
                createSchool(org, 'School1'),
                createSchool(org, 'School2'),
            ])
            createATRole = await Role.save(
                createRole('Create ATs', org, {
                    permissions: [PermissionName.create_academic_term_20228],
                })
            )

            schoolMemberships = await SchoolMembership.save([
                createSchoolMembership({
                    user: nonAdminUser,
                    school: schools[0],
                    roles: [createATRole],
                }),
                createSchoolMembership({
                    user: nonAdminUser,
                    school: schools[1],
                    roles: [createATRole],
                }),
            ])
            organizationMembership = await OrganizationMembership.save(
                createOrganizationMembership({
                    user: nonAdminUser,
                    organization: org,
                    roles: [createATRole],
                })
            )

            inputs = [
                {
                    schoolId: schools[0].school_id,
                    name: 'School1 New Academic Term',
                    startDate: new Date('2020-09-01T00:00:00.000Z'),
                    endDate: new Date('2021-05-01T00:00:00.000Z'),
                },
                {
                    schoolId: schools[1].school_id,
                    name: 'School2 New Academic Term',
                    startDate: new Date('2020-01-01T00:00:00.000Z'),
                    endDate: new Date('2020-12-01T00:00:00.000Z'),
                },
            ]
        })

        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                CREATE_ACADEMIC_TERMS,
                { input: inputs },
                generateToken(userToPayload(nonAdminUser))
            )

            expect(response.status).to.eq(200)
            expect(response.body.errors).to.be.undefined
            expect(
                response.body.data.createAcademicTerms.academicTerms
            ).to.have.lengthOf(inputs.length)
        })

        it('has mandatory name, start date, end date, and schoolId fields', async () => {
            const response = await makeRequest(
                request,
                CREATE_ACADEMIC_TERMS,
                { input: [{}] },
                generateToken(userToPayload(nonAdminUser))
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(4)
            expect(response.body.errors[0].message).to.contain(
                'Field "schoolId" of required type "ID!" was not provided.'
            )
            expect(response.body.errors[1].message).to.contain(
                'Field "name" of required type "String!" was not provided.'
            )
            expect(response.body.errors[2].message).to.contain(
                'Field "startDate" of required type "Date!" was not provided.'
            )
            expect(response.body.errors[3].message).to.contain(
                'Field "endDate" of required type "Date!" was not provided.'
            )
        })
    })

    describe('deleteAcademicTerms', () => {
        let orgAdminUser: User
        let inputs: DeleteAcademicTermInput[]

        beforeEach(async () => {
            orgAdminUser = await createUser().save() // SuperAdmin role does not have required permissions, but OrgAdmin role does
            const org = await createOrganization().save()
            const orgAdminRole = await createRole(
                'Org Admin Role for org',
                org,
                {
                    permissions: organizationAdminRole.permissions,
                }
            ).save()
            await createOrganizationMembership({
                user: orgAdminUser,
                organization: org,
                roles: [orgAdminRole],
            }).save()
            const school = await createSchool(org).save()
            const term = await createAcademicTerm(school).save()
            inputs = [
                {
                    id: term.id,
                },
            ]
        })
        it('supports expected input fields', async () => {
            const response = await makeRequest(
                request,
                DELETE_ACADEMIC_TERMS,
                { input: inputs },
                generateToken(userToPayload(orgAdminUser))
            )
            expect(response.status).to.eq(200)
            expect(response.body.errors).to.be.undefined
            expect(
                response.body.data.deleteAcademicTerms.academicTerms
            ).to.have.lengthOf(inputs.length)
        })
        it('enforces mandatory input fields', async () => {
            const response = await makeRequest(
                request,
                DELETE_ACADEMIC_TERMS,
                { input: [{}] },
                generateToken(userToPayload(orgAdminUser))
            )
            expect(response.status).to.eq(400)
            expect(response.body.errors).to.be.length(1)
            expect(response.body.errors[0].message).to.contain(
                'Field "id" of required type "ID!" was not provided.'
            )
        })
    })
})
