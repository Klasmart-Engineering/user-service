import { default as Dataloader, default as DataLoader } from 'dataloader'
import { School } from '../entities/school'
import { User } from '../entities/user'
import {
    mapSchoolToSchoolConnectionNode,
    schoolConnectionQuery,
    schoolsConnectionSortingConfig,
} from '../pagination/schoolsConnection'
import {
    CoreUserConnectionNode,
    mapUserToUserConnectionNode,
    userConnectionSortingConfig,
    usersConnectionQuery,
} from '../pagination/usersConnection'
import { ISchoolsConnectionNode } from '../types/graphQL/schoolsConnectionNode'
import { IPaginatedResponse } from '../utils/pagination/paginate'
import {
    genericChildConnection,
    IChildConnectionDataloaderKey,
} from './childConnectionLoader'
import {
    ageRangesForClasses,
    gradesForClasses,
    IClassesConnectionLoaders,
    programsForClasses,
    schoolsForClasses,
    subjectsForClasses,
} from './classesConnection'
import { IGradesConnectionLoaders } from './gradesConnection'
import {
    brandingForOrganizations,
    IOrganizationLoaders,
    organizationForMemberships,
} from './organization'
import { IOrganizationsConnectionLoaders } from './organizationsConnection'
import { IProgramsConnectionLoaders } from './programsConnection'
import { ISchoolLoaders, organizationsForSchools, schoolsByIds } from './school'
import { ISubjectsConnectionLoaders } from './subjectsConnection'
import {
    IUsersLoaders,
    orgMembershipsForUsers,
    schoolMembershipsForUsers,
    usersByIds,
} from './user'
import { IUsersConnectionLoaders } from './usersConnection'

export interface IDataLoaders {
    usersConnection?: IUsersConnectionLoaders
    programsConnection?: IProgramsConnectionLoaders
    gradesConnection?: IGradesConnectionLoaders
    classesConnection?: IClassesConnectionLoaders
    subjectsConnection?: ISubjectsConnectionLoaders
    organizationsConnection?: IOrganizationsConnectionLoaders
    user: IUsersLoaders
    organization: IOrganizationLoaders
    school: ISchoolLoaders

    usersConnectionChild: Dataloader<
        IChildConnectionDataloaderKey,
        IPaginatedResponse<CoreUserConnectionNode>
    >
    schoolsConnectionChild: Dataloader<
        IChildConnectionDataloaderKey,
        IPaginatedResponse<ISchoolsConnectionNode>
    >
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
        classesConnection: {
            schools: new DataLoader((keys) => schoolsForClasses(keys)),
            ageRanges: new DataLoader((keys) => ageRangesForClasses(keys)),
            grades: new DataLoader((keys) => gradesForClasses(keys)),
            subjects: new DataLoader((keys) => subjectsForClasses(keys)),
            programs: new DataLoader((keys) => programsForClasses(keys)),
        },
        usersConnectionChild: new Dataloader((items) => {
            return genericChildConnection<User, CoreUserConnectionNode>(
                items,
                usersConnectionQuery,
                mapUserToUserConnectionNode,
                userConnectionSortingConfig
            )
        }),
        schoolsConnectionChild: new Dataloader((items) => {
            return genericChildConnection<School, ISchoolsConnectionNode>(
                items,
                schoolConnectionQuery,
                mapSchoolToSchoolConnectionNode,
                schoolsConnectionSortingConfig
            )
        }),
    }
}
