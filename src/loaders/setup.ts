import DataLoader from 'dataloader'
import { Class } from '../entities/class'
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
import { ClassConnectionNode } from '../types/graphQL/classConnectionNode'
import { ISchoolsConnectionNode } from '../types/graphQL/schoolsConnectionNode'
import { Lazy } from '../utils/lazyLoading'
import { IPaginatedResponse } from '../utils/pagination/paginate'
import {
    childConnectionLoader,
    IChildConnectionDataloaderKey,
} from './childConnectionLoader'
import { IClassesConnectionLoaders } from './classesConnection'
import { NodeDataLoader } from './genericNode'
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
import {
    IUsersConnectionLoaders,
    orgsForUsers,
    rolesForUsers,
    schoolsForUsers,
} from './usersConnection'
import {
    classConnectionQuery,
    classesConnectionSortingConfig,
    mapClassToClassConnectionNode,
} from '../pagination/classesConnection'
import { SelectQueryBuilder, BaseEntity } from 'typeorm'
import { IConnectionSortingConfig } from '../utils/pagination/sorting'
import { IEntityFilter } from '../utils/pagination/filtering'

interface IUserNodeDataLoaders extends Required<IUsersConnectionLoaders> {
    node?: NodeDataLoader<User, CoreUserConnectionNode>
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

    usersConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey<User>,
            IPaginatedResponse<CoreUserConnectionNode>
        >
    >
    schoolsConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey<School>,
            IPaginatedResponse<ISchoolsConnectionNode>
        >
    >
    classesConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey<Class>,
            IPaginatedResponse<ClassConnectionNode>
        >
    >
}

export function createContextLazyLoaders(): IDataLoaders {
    const childDataLoader = <Entity extends BaseEntity, Node>(
        connectionQuery: (
            scope: SelectQueryBuilder<Entity>,
            filter: IEntityFilter | undefined
        ) => Promise<SelectQueryBuilder<Entity>>,
        entityToNodeMapFunction: (entity: Entity) => Node,
        sort: IConnectionSortingConfig
    ) =>
        new Lazy(
            () =>
                new DataLoader(
                    (items: readonly IChildConnectionDataloaderKey<Entity>[]) =>
                        childConnectionLoader({
                            items,
                            connectionQuery,
                            entityToNodeMapFunction,
                            sort,
                        })
                )
        )

    //
    // new DataLoader((items) =>
    //     childConnectionLoader({items, query, map, sort})
    // )

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
        usersConnectionChild: childDataLoader(
            usersConnectionQuery,
            mapUserToUserConnectionNode,
            userConnectionSortingConfig
        ),
        schoolsConnectionChild: childDataLoader(
            schoolConnectionQuery,
            mapSchoolToSchoolConnectionNode,
            schoolsConnectionSortingConfig
        ),
        classesConnectionChild: childDataLoader(
            classConnectionQuery,
            mapClassToClassConnectionNode,
            classesConnectionSortingConfig
        ),
        userNode: {
            organizations: new DataLoader((keys) => orgsForUsers(keys)),
            schools: new DataLoader((keys) => schoolsForUsers(keys)),
            roles: new DataLoader((keys) => rolesForUsers(keys)),
        },
    }
}