import Dataloader from 'dataloader'
import {
    IUsersConnectionLoaders,
    orgsForUsers,
    rolesForUsers,
    schoolsForUsers,
} from './usersConnection'
import { IProgramsConnectionLoaders } from './programsConnection'
import { IGradesConnectionLoaders } from './gradesConnection'
import {
    IUsersLoaders,
    orgMembershipsForUsers,
    schoolMembershipsForUsers,
    usersByIds,
} from './user'
import { IClassesConnectionLoaders } from './classesConnection'
import {
    IOrganizationLoaders,
    brandingForOrganizations,
    organizationForMemberships,
} from './organization'
import { ISubjectsConnectionLoaders } from './subjectsConnection'
import {
    IOrganizationsConnectionLoaders,
    ownersForOrgs,
} from './organizationsConnection'
import { ISchoolLoaders, organizationsForSchools, schoolsByIds } from './school'
import { User } from '../entities/user'
import { NodeDataLoader } from './genericNode'
import { CoreUserConnectionNode } from '../pagination/usersConnection'
import { CoreOrganizationConnectionNode } from '../pagination/organizationsConnection'
import { Organization } from '../entities/organization'

interface IUserNodeDataLoaders extends Required<IUsersConnectionLoaders> {
    node?: NodeDataLoader<User, CoreUserConnectionNode>
}

interface IOrganizationNodeDataLoaders
    extends Required<IOrganizationsConnectionLoaders> {
    node?: NodeDataLoader<Organization, CoreOrganizationConnectionNode>
}

export interface IDataLoaders {
    usersConnection?: IUsersConnectionLoaders
    programsConnection?: IProgramsConnectionLoaders
    gradesConnection?: IGradesConnectionLoaders
    classesConnection?: IClassesConnectionLoaders
    subjectsConnection?: ISubjectsConnectionLoaders
    organizationsConnection?: IOrganizationsConnectionLoaders
    user: IUsersLoaders
    userNode: IUserNodeDataLoaders
    organization: IOrganizationLoaders
    school: ISchoolLoaders
    organizationNode: IOrganizationNodeDataLoaders
}

export function createDefaultDataLoaders(): IDataLoaders {
    return {
        user: {
            user: new Dataloader(usersByIds),
            orgMemberships: new Dataloader((keys) =>
                orgMembershipsForUsers(keys)
            ),
            schoolMemberships: new Dataloader((keys) =>
                schoolMembershipsForUsers(keys)
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
        userNode: {
            organizations: new Dataloader((keys) => orgsForUsers(keys)),
            schools: new Dataloader((keys) => schoolsForUsers(keys)),
            roles: new Dataloader((keys) => rolesForUsers(keys)),
        },
        organizationNode: {
            owners: new Dataloader((keys) => ownersForOrgs(keys)),
        },
    }
}
