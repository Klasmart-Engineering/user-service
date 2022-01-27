import { expect } from 'chai'
import { AgeRange } from '../../../../src/entities/ageRange'
import { Organization } from '../../../../src/entities/organization'
import { Model } from '../../../../src/model'
import { createServer } from '../../../../src/utils/createServer'
import { getMap } from '../../../../src/utils/resolvers/entityMaps'
import { createEntityAPIError } from '../../../../src/utils/resolvers/errors'
import { validateSubItemsInOrg } from '../../../../src/utils/resolvers/inputValidation'
import { createAgeRanges } from '../../../factories/ageRange.factory'
import { createOrganization } from '../../../factories/organization.factory'
import { compareMultipleErrors } from '../../../utils/apiError'
import {
    createTestConnection,
    TestConnection,
} from '../../../utils/testConnection'

describe('inputValidation', () => {
    let connection: TestConnection

    before(async () => {
        connection = await createTestConnection()
        await createServer(new Model(connection))
    })

    after(async () => {
        await connection.close()
    })

    context('#validateSubItemsInOrg', () => {
        let organization: Organization
        let subItemsMap: Map<string, AgeRange>
        const subItemsCount = 5
        const index = 0

        beforeEach(async () => {
            organization = await createOrganization().save()
        })

        context('when the sub items are system', () => {
            beforeEach(async () => {
                const subItems = await AgeRange.save(
                    createAgeRanges(
                        subItemsCount,
                        undefined,
                        undefined,
                        undefined,
                        true
                    )
                )

                subItemsMap = await getMap.ageRange(
                    subItems.map((si) => si.id),
                    ['organization']
                )
            })

            it('should return an errors empty array', () => {
                const errors = validateSubItemsInOrg(
                    AgeRange,
                    index,
                    organization.organization_id,
                    subItemsMap
                )

                expect(errors).to.have.lengthOf(0)
            })
        })

        context('when the sub items are not system', () => {
            context(
                'and those sub items belong to the organization specified',
                () => {
                    beforeEach(async () => {
                        const subItems = await AgeRange.save(
                            createAgeRanges(subItemsCount, organization)
                        )

                        subItemsMap = await getMap.ageRange(
                            subItems.map((si) => si.id),
                            ['organization']
                        )
                    })

                    it('should return an errors empty array', () => {
                        const errors = validateSubItemsInOrg(
                            AgeRange,
                            index,
                            organization.organization_id,
                            subItemsMap
                        )

                        expect(errors).to.have.lengthOf(0)
                    })
                }
            )

            context(
                'and those sub items does not belong to the organization specified',
                () => {
                    beforeEach(async () => {
                        const anotherOrg = await createOrganization().save()
                        const subItems = await AgeRange.save(
                            createAgeRanges(subItemsCount, anotherOrg)
                        )

                        subItemsMap = await getMap.ageRange(
                            subItems.map((si) => si.id),
                            ['organization']
                        )
                    })

                    it('should return an errors filled array', () => {
                        const errors = validateSubItemsInOrg(
                            AgeRange,
                            index,
                            organization.organization_id,
                            subItemsMap
                        )

                        const expectedErrors = Array.from(
                            subItemsMap.keys(),
                            (k) =>
                                createEntityAPIError(
                                    'nonExistentChild',
                                    index,
                                    'AgeRange',
                                    k,
                                    'Organization',
                                    organization.organization_id
                                )
                        )

                        expect(errors).to.have.lengthOf(subItemsCount)
                        compareMultipleErrors(errors, expectedErrors)
                    })
                }
            )
        })
    })
})
