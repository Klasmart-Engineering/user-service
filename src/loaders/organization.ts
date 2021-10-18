import DataLoader from 'dataloader'
import { Branding } from '../entities/branding'
import { BrandingResult } from '../types/graphQL/branding'
import { Organization } from '../entities/organization'
import { BrandingImageTag } from '../types/graphQL/brandingImageTag'
import { Status } from '../entities/status'
import { Lazy } from '../utils/lazyLoading'

export interface IOrganizationLoaders {
    branding: Lazy<DataLoader<string, BrandingResult | undefined>>
    organization: Lazy<DataLoader<string, Organization | undefined>>
}

export const brandingForOrganizations = async (
    orgIds: readonly string[]
): Promise<BrandingResult[]> => {
    const scope = Branding.createQueryBuilder('Branding')
        .leftJoinAndSelect('Branding.images', 'BrandImages')
        .leftJoinAndSelect('Branding.organization', 'BrandingOrg')
        .where('BrandingOrg.organization_id IN (:...ids)', { ids: orgIds })
        .andWhere('Branding.status = :status', { status: Status.ACTIVE })

    const brandings = new Map()
    await Promise.all(
        (await scope.getMany()).map(async (brand) => {
            const brandOrgId = (await brand.organization)?.organization_id
            if (brandOrgId) {
                brandings.set(brandOrgId, brand)
            }
        })
    )

    return Promise.all(
        orgIds.map(async (orgId) => {
            const orgBrand: Branding | undefined = brandings.get(orgId)
            if (!orgBrand) {
                return {}
            }
            orgBrand.images?.sort(
                (a, b) => b.created_at.valueOf() - a.created_at.valueOf()
            )

            const icon = orgBrand.images?.find(
                (i) =>
                    i.tag === BrandingImageTag.ICON &&
                    i.status === Status.ACTIVE
            )

            return {
                iconImageURL: icon?.url,
                primaryColor: orgBrand.primaryColor,
            }
        })
    )
}

export const organizationForMemberships = async (
    orgIds: readonly string[]
): Promise<(Organization | undefined)[]> => {
    const scope = Organization.createQueryBuilder().where(
        'organization_id in (:...ids)',
        { ids: orgIds }
    )
    const organizations = new Map(
        (await scope.getMany()).map((org) => [org.organization_id, org])
    )

    return Promise.all(
        orgIds.map(async (orgId) => {
            return organizations.get(orgId)
        })
    )
}
