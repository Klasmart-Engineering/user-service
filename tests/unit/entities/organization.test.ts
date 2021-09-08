import { expect } from 'chai'
import { Connection } from 'typeorm'
import faker from 'faker'

import { createTestConnection } from '../../utils/testConnection'
import { createOrganization } from '../../factories/organization.factory'
import { Organization } from '../../../src/entities/organization'
import RolesInitializer from '../../../src/initializers/roles'
import { APIError, IAPIError } from '../../../src/types/errors/apiError'
import { customErrors } from '../../../src/types/errors/customError'
import { pick } from 'lodash'
import { Role } from '../../../src/entities/role'
import { createRole } from '../../factories/role.factory'
import { School } from '../../../src/entities/school'
import { createSchool } from '../../factories/school.factory'

context('Organization', () => {
    let connection: Connection
    let organization: Organization

    before(async () => {
        connection = await createTestConnection()
    })

    after(async () => {
        await connection?.close()
    })

    beforeEach(async () => {
        organization = await createOrganization().save()
    })

    context('findChildEntitiesById', () => {
        function pickAPIErrorDetails(error: APIError) {
            return pick(error, [
                'code',
                'message',
                'variables',
                'entity',
                'entityName',
                'parentEntity',
                'parentName',
            ])
        }

        function buildNonExistentChildEntityAPIError(
            childEntity: string,
            variable: string,
            id: string
        ): IAPIError {
            return {
                code: customErrors.nonexistent_child.code,
                message: `${childEntity} ${id} doesn't exist for Organization ${organization.organization_name}.`,
                variables: [variable],
                entity: childEntity,
                entityName: id,
                parentEntity: 'Organization',
                parentName: organization.organization_name,
            }
        }

        context('findRolesByIds', () => {
            let customRole: Role
            let customRoleInOtherOrganization: Role

            before(async () => {
                await RolesInitializer.run()
            })

            beforeEach(async () => {
                customRole = await createRole(undefined, organization).save()

                // Create Role in other Organization which shouldn't be picked up
                const otherOrganization = await createOrganization().save()
                customRoleInOtherOrganization = await createRole(
                    undefined,
                    otherOrganization
                ).save()
            })

            it("if the ID doesn't exist, returns an empty `data` array and APIError for that ID", async () => {
                const nonexistentID = faker.random.uuid()

                const { data, errors } = await organization['findRolesById'](
                    [nonexistentID],
                    ['role_id']
                )

                expect(data).to.deep.equal([])
                expect(errors.map(pickAPIErrorDetails)).to.deep.equal([
                    buildNonExistentChildEntityAPIError(
                        'Role',
                        'role_id',
                        nonexistentID
                    ),
                ])
            })

            it('if the ID is an existing system Role, returns the Role entity in the `data` array', async () => {
                const studentRole = await Role.findOneOrFail({
                    where: { role_name: 'Student' },
                })

                const { data, errors } = await organization['findRolesById'](
                    [studentRole.role_id],
                    ['role_id']
                )

                expect(errors).to.deep.equal([])
                expect(data).to.deep.equal([studentRole])
            })

            it('if the ID is an existing custom Role, returns the Role entity the `data` array', async () => {
                const { data, errors } = await organization['findRolesById'](
                    [customRole.role_id],
                    ['role_id']
                )

                expect(errors).to.deep.equal([])
                expect(data.map((role) => role.role_id)).to.deep.equal([
                    customRole.role_id,
                ])
            })

            it('if the ID is an existing custom Role in another Organization, returns an empty `data` array and APIError for that ID', async () => {
                const { data, errors } = await organization['findRolesById'](
                    [customRoleInOtherOrganization.role_id],
                    ['role_id']
                )

                expect(data).to.deep.equal([])
                expect(errors.map(pickAPIErrorDetails)).to.deep.equal([
                    buildNonExistentChildEntityAPIError(
                        'Role',
                        'role_id',
                        customRoleInOtherOrganization.role_id
                    ),
                ])
            })

            it('if a mix of existing and non-existent IDs, returns both a `data` array and APIError array', async () => {
                const nonexistentID = faker.random.uuid()

                const { data, errors } = await organization['findRolesById'](
                    [nonexistentID, customRole.role_id],
                    ['role_id']
                )

                expect(data.map((role) => role.role_id)).to.deep.equal([
                    customRole.role_id,
                ])
                expect(errors.map(pickAPIErrorDetails)).to.deep.equal([
                    buildNonExistentChildEntityAPIError(
                        'Role',
                        'role_id',
                        nonexistentID
                    ),
                ])
            })
        })

        context('findSchoolsById', () => {
            let school: School
            let schoolInOtherOrganization: School

            beforeEach(async () => {
                school = await createSchool(organization).save()
                const otherOrganization = await createOrganization().save()
                schoolInOtherOrganization = await createSchool(
                    otherOrganization
                ).save()
            })

            it("if the ID doesn't exist, returns an empty `data` array and APIError for that ID", async () => {
                const nonexistentID = faker.random.uuid()

                const { data, errors } = await organization['findSchoolsById'](
                    [nonexistentID],
                    ['school_id']
                )

                expect(data).to.deep.equal([])
                expect(errors.map(pickAPIErrorDetails)).to.deep.equal([
                    buildNonExistentChildEntityAPIError(
                        'School',
                        'school_id',
                        nonexistentID
                    ),
                ])
            })

            it('if the ID is an existing custom School, returns the School entity the `data` array', async () => {
                const { data, errors } = await organization['findSchoolsById'](
                    [school.school_id],
                    ['school_id']
                )

                expect(errors).to.deep.equal([])
                expect(data.map((school) => school.school_id)).to.deep.equal([
                    school.school_id,
                ])
            })

            it('if the ID is an existing custom School in another Organization, returns an empty `data` array and APIError for that ID', async () => {
                const { data, errors } = await organization['findSchoolsById'](
                    [schoolInOtherOrganization.school_id],
                    ['school_id']
                )

                expect(data).to.deep.equal([])
                expect(errors.map(pickAPIErrorDetails)).to.deep.equal([
                    buildNonExistentChildEntityAPIError(
                        'School',
                        'school_id',
                        schoolInOtherOrganization.school_id
                    ),
                ])
            })

            it('if a mix of existing and non-existent IDs, returns both a `data` array and APIError array', async () => {
                const nonexistentID = faker.random.uuid()

                const { data, errors } = await organization['findSchoolsById'](
                    [nonexistentID, school.school_id],
                    ['school_id']
                )

                expect(data.map((school) => school.school_id)).to.deep.equal([
                    school.school_id,
                ])
                expect(errors.map(pickAPIErrorDetails)).to.deep.equal([
                    buildNonExistentChildEntityAPIError(
                        'School',
                        'school_id',
                        nonexistentID
                    ),
                ])
            })
        })
    })
})
