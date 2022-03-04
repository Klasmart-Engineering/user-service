import { expect } from 'chai'
import { getRepository } from 'typeorm'
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder'
import { Organization } from '../../../src/entities/organization'
import { organizationsConnectionQuery } from '../../../src/pagination/organizationsConnection'
import { createOrganization } from '../../factories/organization.factory'
import faker from 'faker'
import { User } from '../../../src/entities/user'
import { createUser } from '../../factories/user.factory'

describe('organizationConnection', () => {
    context('organizationConnectionQuery', () => {
        let scope: SelectQueryBuilder<Organization>
        let org: Organization
        let owner: User

        beforeEach(async () => {
            owner = await createUser().save()
            org = await createOrganization(owner).save()
            await createOrganization().save()
            scope = getRepository(Organization).createQueryBuilder()
        })

        it("can filter by owner's username", async () => {
            await organizationsConnectionQuery(scope, {
                ownerUsername: { operator: 'eq', value: owner.username },
            })
            const organizationsFound = await scope.getMany()
            expect(organizationsFound).to.have.length(1)
            expect(organizationsFound[0].organization_id).to.eq(
                org.organization_id
            )
        })

        it('can filter by phone', async () => {
            org.phone = faker.phone.phoneNumber()
            await org.save()
            await organizationsConnectionQuery(scope, {
                phone: { operator: 'eq', value: org.phone },
            })
            const organizationsFound = await scope.getMany()
            expect(organizationsFound).to.have.length(1)
            expect(organizationsFound[0].organization_id).to.eq(
                org.organization_id
            )
        })
    })
})
