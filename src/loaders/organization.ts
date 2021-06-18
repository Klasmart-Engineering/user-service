import DataLoader from 'dataloader'
import { Branding } from '../entities/branding'
import { brandingResult } from '../types/graphQL/brandingresult'
import { Organization } from '../entities/organization'
import { brandingImageTag } from '../types/graphQL/brandingImageTag'

export interface IOrganizationLoaders {
    branding: DataLoader<string, brandingResult | undefined>
    organization: DataLoader<string, Organization | undefined>
}

export const brandingForOrganizations = async (
    orgIds: readonly string[]
): Promise<brandingResult[]> => {
    const brandings: brandingResult[] = []

    const scope = Branding.createQueryBuilder('Branding')
        .leftJoinAndSelect('Branding.images', 'BrandImages')
        .leftJoinAndSelect('Branding.organization', 'BrandingOrg')
        .where('BrandingOrg.organization_id IN (:...ids)', { ids: orgIds })

    const data = await scope.getMany()

    for (const orgId of orgIds) {
        const branding = data.find(
            async (b) => (await b.organization)?.organization_id === orgId
        )
        if (branding) {
            // always use the latest images
            branding.images?.sort(
                (a, b) => b.created_at.valueOf() - a.created_at.valueOf()
            )

            const icon = branding.images?.find(
                (i) => i.tag === brandingImageTag.ICON
            )
            const favicon = branding.images?.find(
                (i) => i.tag === brandingImageTag.FAVICON
            )

            brandings.push({
                iconImageURL: icon?.url,
                faviconImageURL: favicon?.url,
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
