import Dataloader from 'dataloader'
import { IUsersConnectionLoaders } from './usersConnection'
import { IProgramsConnectionLoaders } from './programsConnection'
import { IGradesConnectionLoaders } from './gradesConnection'
import {
    IUsersLoaders,
    orgMembershipsForUsers,
    schoolMembershipsForUsers,
    classesTeachingForUsers,
    classesStudyingForUsers,
    usersByIds,
} from './user'
import { IClassesConnectionLoaders } from './classesConnection'
import {
    IOrganizationLoaders,
    brandingForOrganizations,
    organizationForMemberships,
} from './organization'
import { IOrganizationMembershipLoaders } from './organizationMembership'

import { ISchoolLoaders, organizationsForSchools, schoolsByIds } from './school'

export interface IDataLoaders {
    usersConnection?: IUsersConnectionLoaders
    programsConnection?: IProgramsConnectionLoaders
    gradesConnection?: IGradesConnectionLoaders
    classesConnection?: IClassesConnectionLoaders
    user: IUsersLoaders
    organization: IOrganizationLoaders
    school: ISchoolLoaders
    organizationMembership: IOrganizationMembershipLoaders
}

export function createDefaultDataLoaders(): IDataLoaders {
    return {
        user: {
            orgMemberships: new Dataloader((keys) =>
                orgMembershipsForUsers(keys)
            ),
            schoolMemberships: new Dataloader((keys) =>
                schoolMembershipsForUsers(keys)
            ),
            classesTeaching: new Dataloader((keys) =>
                classesTeachingForUsers(keys)
            ),
            classesStudying: new Dataloader((keys) =>
                classesStudyingForUsers(keys)
            ),
        },
        organization: {
            branding: new Dataloader((keys) => brandingForOrganizations(keys)),
            // used to get orgs from org memberships
            organization: new Dataloader((keys) =>
                organizationForMemberships(keys)
            ),
        },
        school: {
            organization: new Dataloader((keys) =>
                organizationsForSchools(keys)
            ),
            schoolById: new Dataloader((keys) => schoolsByIds(keys)),
        },
        organizationMembership: {
            user: new Dataloader((keys) => usersByIds(keys)),
        },
    }
}
