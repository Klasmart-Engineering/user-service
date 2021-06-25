import DataLoader from 'dataloader'
import { Branding } from '../entities/branding'
import { BrandingResult } from '../types/graphQL/branding'
import { Organization } from '../entities/organization'
import { BrandingImageTag } from '../types/graphQL/brandingImageTag'
import { Status } from '../entities/status'

export interface IOrganizationLoaders {
    branding: DataLoader<string, BrandingResult | undefined>
    organization: DataLoader<string, Organization | undefined>
}

export const brandingForOrganizations = async (
    orgIds: readonly string[]
): Promise<BrandingResult[]> => {
    const brandings: BrandingResult[] = []

    const scope = Branding.createQueryBuilder('Branding')
        .leftJoinAndSelect('Branding.images', 'BrandImages')
        .leftJoinAndSelect('Branding.organization', 'BrandingOrg')
        .where('BrandingOrg.organization_id IN (:...ids)', { ids: orgIds })
        .andWhere('Branding.status = :status', { status: Status.ACTIVE })

    const data = await scope.getMany()

    for (const orgId of orgIds) {
        let branding: Branding | undefined
        for (const brand of data) {
            const brandOrgId = (await brand.organization)?.organization_id
            if (orgId === brandOrgId) {
                branding = brand
                break
            }
        }
        if (branding) {
            // always use the latest images
            branding.images?.sort(
                (a, b) => b.created_at.valueOf() - a.created_at.valueOf()
            )

            const icon = branding.images?.find(
                (i) =>
                    i.tag === BrandingImageTag.ICON &&
                    i.status === Status.ACTIVE
            )

            brandings.push({
                iconImageURL: icon?.url,
                primaryColor: branding.primaryColor,
            })
        } else {
            brandings.push({})
        }
    }

    return brandings
}

export const organizationForMemberships = async (
    orgIds: readonly string[]
): Promise<(Organization | undefined)[]> => {
    const orgs: (Organization | undefined)[] = []

    const scope = Organization.createQueryBuilder().where(
        'organization_id in (:...ids)',
        { ids: orgIds }
    )
    const data = await scope.getMany()

    for (const orgId of orgIds) {
        const org = data.find((o) => o.organization_id === orgId)
        orgs.push(org)
    }
    return orgs
}
