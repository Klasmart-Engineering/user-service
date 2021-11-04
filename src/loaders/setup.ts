import DataLoader from 'dataloader'
import { Class } from '../entities/class'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Program } from '../entities/program'
import { School } from '../entities/school'
import { SchoolMembership } from '../entities/schoolMembership'
import { User } from '../entities/user'
import {
    classesConnectionQuery,
    classesConnectionSortingConfig,
    mapClassToClassConnectionNode,
} from '../pagination/classesConnection'
    classSummaryNodeFields,
    mapClassToClassNode,
} from '../pagination/classesConnection'
import {
    mapProgramToProgramConnectionNode,
    programSummaryNodeFields,
} from '../pagination/programsConnection'
import {
    CoreOrganizationConnectionNode,
    mapOrganizationToOrganizationConnectionNode,
    organizationConnectionSortingConfig,
    organizationsConnectionQuery,
} from '../pagination/organizationsConnection'
import {
    mapSchoolToSchoolConnectionNode,
    schoolConnectionQuery,
    schoolsConnectionSortingConfig,
} from '../pagination/schoolsConnection'
import {
    CoreUserConnectionNode,
    coreUserConnectionNodeFields,
    mapUserToUserConnectionNode,
    userConnectionSortingConfig,
    usersConnectionQuery,
} from '../pagination/usersConnection'
import { UserPermissions } from '../permissions/userPermissions'
import { AgeRangeConnectionNode } from '../types/graphQL/ageRange'
import { BrandingResult } from '../types/graphQL/branding'
import { ClassSummaryNode } from '../types/graphQL/classSummaryNode'
import { GradeSummaryNode } from '../types/graphQL/grade'
import { ProgramSummaryNode } from '../types/graphQL/program'
import {
    ISchoolsConnectionNode,
    SchoolSimplifiedSummaryNode,
} from '../types/graphQL/school'
import { SubjectSummaryNode } from '../types/graphQL/subject'
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
    IClassNodeDataLoaders,
    programsForClasses,
    schoolsForClasses,
    subjectsForClasses,
} from './classesConnection'
import { NodeDataLoader } from './genericNode'
import { IGradesConnectionLoaders } from './gradesConnection'
import {
    brandingForOrganizations,
    IOrganizationLoaders,
    organizationForMemberships,
} from './organization'
import { IOrganizationsConnectionLoaders } from './organizationsConnection'
import {
    ageRangesForPrograms,
    gradesForPrograms,
    IProgramNodeDataLoaders,
    IProgramsConnectionLoaders,
    subjectsForPrograms,
} from './programsConnection'
import { ISchoolLoaders, organizationsForSchools, schoolsByIds } from './school'
import { ISubjectsConnectionLoaders } from './subjectsConnection'
import {
    IUsersLoaders,
    IUserNodeDataLoaders,
    usersByIds,
    orgMembershipsForUsers,
    schoolMembershipsForUsers,
} from './user'
import {
    IUsersConnectionLoaders,
    orgsForUsers,
    rolesForUsers,
    schoolsForUsers,
} from './usersConnection'

export interface IDataLoaders {
    usersConnection?: IUsersConnectionLoaders
    programsConnection: IProgramsConnectionLoaders
    programNode: IProgramNodeDataLoaders
    gradesConnection?: IGradesConnectionLoaders
    classesConnection: IClassesConnectionLoaders
    subjectsConnection?: ISubjectsConnectionLoaders
    organizationsConnection?: IOrganizationsConnectionLoaders
    user: IUsersLoaders
    userNode: IUserNodeDataLoaders
    organization: IOrganizationLoaders
    school: ISchoolLoaders

    organizationsConnectionChild: Lazy<
        DataLoader<
            IChildConnectionDataloaderKey,
            IPaginatedResponse<CoreOrganizationConnectionNode>
        >
    >
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
    classNode: IClassNodeDataLoaders
}

export function createContextLazyLoaders(
    permissions: UserPermissions
): IDataLoaders {
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
        organizationsConnectionChild: new Lazy(
            () =>
                new DataLoader((items) => {
                    return childConnectionLoader(
                        items,
                        organizationsConnectionQuery,
                        mapOrganizationToOrganizationConnectionNode,
                        organizationConnectionSortingConfig,
                        { permissions, entity: 'organization' }
                    )
                })
        ),
        usersConnectionChild: new Lazy(
            () =>
                new DataLoader((items) => {
                    return childConnectionLoader(
                        items,
                        usersConnectionQuery,
                        mapUserToUserConnectionNode,
                        userConnectionSortingConfig,
                        { permissions, entity: 'user' }
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
                        schoolsConnectionSortingConfig,
                        { permissions, entity: 'school' }
                    )
                })
        ),
        classesConnectionChild: new Lazy(
            () =>
                new DataLoader((items) => {
                    return childConnectionLoader(
                        items,
                        classesConnectionQuery,
                        mapClassToClassConnectionNode,
                        classesConnectionSortingConfig,
                        { permissions, entity: 'class' }
                    )
                })
        ),
        userNode: {
            node: new Lazy<NodeDataLoader<User, CoreUserConnectionNode>>(
                () =>
                    new NodeDataLoader(
                        User,
                        'UserConnectionNode',
                        mapUserToUserConnectionNode,
                        coreUserConnectionNodeFields
                    )
            ),
            organizations: new DataLoader((keys) => orgsForUsers(keys)),
            schools: new DataLoader((keys) => schoolsForUsers(keys)),
            roles: new DataLoader((keys) => rolesForUsers(keys)),
        },
        programsConnection: {
            ageRanges: new Lazy<DataLoader<string, AgeRangeConnectionNode[]>>(
                () => new DataLoader(ageRangesForPrograms)
            ),
            grades: new Lazy<DataLoader<string, GradeSummaryNode[]>>(
                () => new DataLoader(gradesForPrograms)
            ),
            subjects: new Lazy<DataLoader<string, SubjectSummaryNode[]>>(
                () => new DataLoader(subjectsForPrograms)
            ),
        },
        programNode: {
            node: new Lazy<NodeDataLoader<Program, ProgramSummaryNode>>(
                () =>
                    new NodeDataLoader(
                        Program,
                        'ProgramConnectionNode',
                        mapProgramToProgramConnectionNode,
                        programSummaryNodeFields
                    )
            ),
        },
        classesConnection: {
            schools: new Lazy<
                DataLoader<string, SchoolSimplifiedSummaryNode[]>
            >(() => new DataLoader(schoolsForClasses)),
            ageRanges: new Lazy<DataLoader<string, AgeRangeConnectionNode[]>>(
                () => new DataLoader(ageRangesForClasses)
            ),
            grades: new Lazy<DataLoader<string, GradeSummaryNode[]>>(
                () => new DataLoader(gradesForClasses)
            ),
            subjects: new Lazy<DataLoader<string, SubjectSummaryNode[]>>(
                () => new DataLoader(subjectsForClasses)
            ),
            programs: new Lazy<DataLoader<string, ProgramSummaryNode[]>>(
                () => new DataLoader(programsForClasses)
            ),
        },
        classNode: {
            node: new Lazy<NodeDataLoader<Class, ClassSummaryNode>>(
                () =>
                    new NodeDataLoader(
                        Class,
                        'ClassConnectionNode',
                        mapClassToClassNode,
                        classSummaryNodeFields
                    )
            ),
        },
    }
}