import Dataloader from 'dataloader'
import { IUsersConnectionLoaders } from './usersConnection'
import { IProgramsConnectionLoaders } from './programsConnection'
import { IGradesConnectionLoaders } from './gradesConnection'
import { IUsersLoaders, orgMembershipsForUsers } from './user'
import {
    IOrganizationLoaders,
    brandingForOrganizations,
    organizationForMemberships,
} from './organization'

export interface IDataLoaders {
    usersConnection?: IUsersConnectionLoaders
    programsConnection?: IProgramsConnectionLoaders
    gradesConnection?: IGradesConnectionLoaders
    user: IUsersLoaders
    organization: IOrganizationLoaders
}

export function createDefaultDataLoaders(): IDataLoaders {
    return {
        user: {
            orgMemberships: new Dataloader((keys) =>
                orgMembershipsForUsers(keys)
            ),
        },
        organization: {
            branding: new Dataloader((keys) => brandingForOrganizations(keys)),
            // used to get orgs from org memberships
            organization: new Dataloader((keys) =>
                organizationForMemberships(keys)
            ),
        },
    }
}
