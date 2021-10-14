import DataLoader from 'dataloader'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { School } from '../entities/school'
import { SchoolMembership } from '../entities/schoolMembership'
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
import { BrandingResult } from '../types/graphQL/branding'
import { ISchoolsConnectionNode } from '../types/graphQL/schoolsConnectionNode'
import { Lazy } from '../utils/lazyLoading'
import { IPaginatedResponse } from '../utils/pagination/paginate'
import {
    childConnectionLoader,
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

    usersConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey,
            IPaginatedResponse<CoreUserConnectionNode>
        >
    >
    schoolsConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey,
            IPaginatedResponse<ISchoolsConnectionNode>
        >
    >
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
        classesConnection: {
            schools: new DataLoader((keys) => schoolsForClasses(keys)),
            ageRanges: new DataLoader((keys) => ageRangesForClasses(keys)),
            grades: new DataLoader((keys) => gradesForClasses(keys)),
            subjects: new DataLoader((keys) => subjectsForClasses(keys)),
            programs: new DataLoader((keys) => programsForClasses(keys)),
        },
        usersConnectionChild: new Lazy(
            () =>
                new DataLoader((items) => {
                    return childConnectionLoader(
                        items,
                        usersConnectionQuery,
                        mapUserToUserConnectionNode,
                        userConnectionSortingConfig
                    )
                })
        ),
        schoolsConnectionChild: new Lazy(
            () =>
                new DataLoader((items) => {
                    return childConnectionLoader(
                        items,
                        schoolConnectionQuery,
                        mapSchoolToSchoolConnectionNode,
                        schoolsConnectionSortingConfig
                    )
                })
        ),
    }
}
