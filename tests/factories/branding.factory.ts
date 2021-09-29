import { Branding } from '../../src/entities/branding'
import { Organization } from '../../src/entities/organization'
import { createOrganization } from './organization.factory'

export function createBranding(org: Organization = createOrganization()) {
    const branding = new Branding()
    branding.organization = Promise.resolve(org)
    return branding
}
