import Dataloader from 'dataloader'
import { IUsersConnectionLoaders } from './usersConnection'
import { IProgramsConnectionLoaders } from './programsConnection'
import { IGradesConnectionLoaders } from './gradesConnection'
import { IUsersLoaders, orgMembershipsForUsers } from './user'
import { IClassesConnectionLoaders } from './classesConnection'
import {
    IOrganizationLoaders,
    brandingForOrganizations,
    organizationForMemberships,
} from './organization'
import { ICategoriesConnectionLoaders } from './categoriesConnection'

export interface IDataLoaders {
    usersConnection?: IUsersConnectionLoaders
    programsConnection?: IProgramsConnectionLoaders
    gradesConnection?: IGradesConnectionLoaders
    classesConnection?: IClassesConnectionLoaders
    categoriesConnection?: ICategoriesConnectionLoaders
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
