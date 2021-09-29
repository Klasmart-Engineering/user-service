import chai, { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Connection, getManager } from 'typeorm'
import { AddTimestampColumns1630420895212 } from '../../migrations/1630420895212-AddTimestampColumns'
import { CustomBaseEntity } from '../../src/entities/customBaseEntity'
import { Status } from '../../src/entities/status'
import { createAgeRange } from '../factories/ageRange.factory'
import { createBranding } from '../factories/branding.factory'
import { createBrandingImage } from '../factories/brandingImage.factory'
import { createCategory } from '../factories/category.factory'
import { createClass } from '../factories/class.factory'
import { createGrade } from '../factories/grade.factory'
import { createOrganization } from '../factories/organization.factory'
import { createOrganizationMembership } from '../factories/organizationMembership.factory'
import { createOrganizationOwnership } from '../factories/organizationOwnership.factory'
import { createPermission } from '../factories/permission.factory'
import { createProgram } from '../factories/program.factory'
import { createRole } from '../factories/role.factory'
import { createSchool } from '../factories/school.factory'
import { createSchoolMembership } from '../factories/schoolMembership.factory'
import { createSubcategory } from '../factories/subcategory.factory'
import { createSubject } from '../factories/subject.factory'
import { createUser } from '../factories/user.factory'
import {
    createMigrationsTestConnection,
    createTestConnection,
} from '../utils/testConnection'

chai.should()
use(chaiAsPromised)

describe('AddTimestampColumns1630420895212 migration', () => {
    let baseConnection: Connection
    let migrationsConnection: Connection
    let entities: CustomBaseEntity[]

    before(async () => {
        baseConnection = await createTestConnection()
    })
    after(async () => {
        await baseConnection?.close()
    })
    afterEach(async () => {
        const pendingMigrations = await baseConnection.showMigrations()
        expect(pendingMigrations).to.eq(false)
        await migrationsConnection?.close()
    })
    beforeEach(async () => {
        migrationsConnection = await createMigrationsTestConnection(
            true,
            false,
            'migrations'
        )
        await migrationsConnection.runMigrations()

        const org = await createOrganization().save()
        const user = await createUser().save()
        const school = await createSchool(org).save()

        entities = [
            createAgeRange(org),
            createBranding(org),
            createBrandingImage(),
            createCategory(org),
            createClass([], org),
            createGrade(org),
            org,
            createOrganizationMembership({ user, organization: org }),
            createOrganizationOwnership({ user, organization: org }),
            createPermission(),
            createProgram(org),
            createRole(),
            createSchool(org),
            createSchoolMembership({ user, school }),
            createSubcategory(org),
            createSubject(org),
            user,
        ]
        for (const entity of entities) {
            await entity.save()
        }
    })
    it('manages the created_at column', async () => {
        for (const entity of entities) {
            expect(entity.created_at).to.exist
            expect(entity.created_at.valueOf()).to.be.greaterThan(0)
        }
    })
    it('manages updated_at columns', async () => {
        for (const entity of entities) {
            await entity.save()
            await new Promise((resolve) => setTimeout(resolve, 2))
            await entity.inactivate(getManager())
            expect(entity.updated_at.valueOf()).to.be.greaterThan(
                entity.created_at.valueOf()
            )
        }
    })
    it('manages deleted_at columns', async () => {
        for (const entity of entities) {
            await entity.inactivate(getManager())
            expect(entity.deleted_at?.valueOf()).to.be.greaterThan(
                entity.created_at.valueOf()
            )
        }
    })
    it('manages soft deletes via status', async () => {
        for (const entity of entities) {
            expect(entity.status).to.eq(Status.ACTIVE)
            await entity.inactivate(getManager())
            expect(entity.status).to.eq(Status.INACTIVE)
        }
    })

    it('is benign if run twice', async () => {
        const migration = migrationsConnection.migrations.find(
            (m) => m.name === AddTimestampColumns1630420895212.name
        )
        const runner = baseConnection.createQueryRunner()
        // promise will be rejected if migration fails
        return migration!.up(runner).should.be.fulfilled
    })
})
