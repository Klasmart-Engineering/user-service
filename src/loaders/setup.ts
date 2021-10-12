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
    brandingForOrganizations,
    IOrganizationLoaders,
    organizationForMemberships,
} from './organization'
import { ISubjectsConnectionLoaders } from './subjectsConnection'
import { IOrganizationsConnectionLoaders } from './organizationsConnection'
import { ISchoolLoaders, organizationsForSchools, schoolsByIds } from './school'
import { NodeDataLoader } from './genericNode'
import { CoreUserConnectionNode } from '../pagination/usersConnection'
import DataLoader from 'dataloader'
import { User } from '../entities/user'
import { Lazy } from '../utils/lazyLoading'
import { OrganizationMembership } from '../entities/organizationMembership'
import { SchoolMembership } from '../entities/schoolMembership'
import { BrandingResult } from '../types/graphQL/branding'
import { Organization } from '../entities/organization'
import { School } from '../entities/school'
import { Class } from '../entities/class'
import { CoreClassConnectionNode } from '../nodes/classNode'

interface IUserNodeDataLoaders extends Required<IUsersConnectionLoaders> {
    node?: NodeDataLoader<User, CoreUserConnectionNode>
}

interface IClassNodeDataLoaders {
    node?: NodeDataLoader<Class, CoreClassConnectionNode>
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
    classNode?: IClassNodeDataLoaders
}

export function createContextLazyLoaders(): IDataLoaders {
    return {
        user: {
            user: new Lazy<DataLoader<string, User | Error>>(
                () => new DataLoader(usersByIds)
            ),
            orgMemberships: new Lazy<
                DataLoader<string, OrganizationMembership[]>
            >(() => new DataLoader(orgMembershipsForUsers)),
            schoolMemberships: new Lazy<DataLoader<string, SchoolMembership[]>>(
                () => new DataLoader(schoolMembershipsForUsers)
            ),
        },
        organization: {
            branding: new Lazy<DataLoader<string, BrandingResult | undefined>>(
                () => new DataLoader(brandingForOrganizations)
            ),
            organization: new Lazy<
                DataLoader<string, Organization | undefined>
            >(() => new DataLoader(organizationForMemberships)),
        },
        school: {
            organization: new Lazy<
                DataLoader<string, Organization | undefined>
            >(() => new DataLoader(organizationsForSchools)),
            schoolById: new Lazy<DataLoader<string, School | undefined>>(
                () => new DataLoader(schoolsByIds)
            ),
        },
        userNode: {
            organizations: new Dataloader((keys) => orgsForUsers(keys)),
            schools: new Dataloader((keys) => schoolsForUsers(keys)),
            roles: new Dataloader((keys) => rolesForUsers(keys)),
        },
    }
}
