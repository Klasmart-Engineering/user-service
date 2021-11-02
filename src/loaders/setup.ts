import DataLoader from 'dataloader'
import { AgeRange } from '../entities/ageRange'
import { Class } from '../entities/class'
import { Grade } from '../entities/grade'
import { Organization } from '../entities/organization'
import { OrganizationMembership } from '../entities/organizationMembership'
import { Program } from '../entities/program'
import { School } from '../entities/school'
import { SchoolMembership } from '../entities/schoolMembership'
import { User } from '../entities/user'
import {
    mapAgeRangeToAgeRangeConnectionNode,
    ageRangeNodeFields,
} from '../pagination/ageRangesConnection'
import {
    classSummaryNodeFields,
    mapClassToClassNode,
} from '../pagination/classesConnection'
import {
    gradeSummaryNodeFields,
    mapGradeToGradeConnectionNode,
} from '../pagination/gradesConnection'
import {
    mapProgramToProgramConnectionNode,
    programSummaryNodeFields,
} from '../pagination/programsConnection'
import {
    CoreOrganizationConnectionNode,
    mapOrganizationToOrganizationConnectionNode,
    organizationConnectionSortingConfig,
    organizationsConnectionQuery,
    organizationSummaryNodeFields,
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
import { BrandingResult } from '../types/graphQL/branding'
import { ClassSummaryNode } from '../types/graphQL/classSummaryNode'
import {
    ISchoolsConnectionNode,
    SchoolSimplifiedSummaryNode,
} from '../types/graphQL/school'
import { Lazy } from '../utils/lazyLoading'
import { IPaginatedResponse } from '../utils/pagination/paginate'
import { IAgeRangeNodeDataLoader } from './ageRange'
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
import {
    fromGradeForGrades,
    IGradeNodeDataLoaders,
    IGradesConnectionLoaders,
    toGradeForGrades,
} from './gradesConnection'
import {
    brandingForOrganizations,
    IOrganizationLoaders,
    organizationForMemberships,
} from './organization'
import {
    IOrganizationNodeDataLoaders,
    IOrganizationsConnectionLoaders,
    ownersForOrgs,
} from './organizationsConnection'
import { NodeDataLoader } from './genericNode'
import {
    ageRangesForPrograms,
    gradesForPrograms,
    IProgramNodeDataLoaders,
    IProgramsConnectionLoaders,
    subjectsForPrograms,
} from './programsConnection'
import { ISchoolLoaders, organizationsForSchools, schoolsByIds } from './school'
import { ISubjectsConnectionLoaders } from './subjectsConnection'
import { ProgramSummaryNode } from '../types/graphQL/program'
import { AgeRangeConnectionNode } from '../types/graphQL/ageRange'
import { GradeSummaryNode } from '../types/graphQL/grade'
import { SubjectSummaryNode } from '../types/graphQL/subject'
import { UserSummaryNode } from '../types/graphQL/user'
import {
    IUserNodeDataLoaders,
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

export interface IDataLoaders {
    usersConnection?: IUsersConnectionLoaders
    programsConnection: IProgramsConnectionLoaders
    programNode: IProgramNodeDataLoaders
    gradesConnection: IGradesConnectionLoaders
    classesConnection: IClassesConnectionLoaders
    subjectsConnection?: ISubjectsConnectionLoaders
    organizationsConnection: IOrganizationsConnectionLoaders
    user: IUsersLoaders
    userNode: IUserNodeDataLoaders
    organization: IOrganizationLoaders
    school: ISchoolLoaders
    gradeNode: IGradeNodeDataLoaders
    organizationNode: IOrganizationNodeDataLoaders
    ageRangeNode: IAgeRangeNodeDataLoader

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
        organizationsConnection: {
            owners: new Lazy<DataLoader<string, UserSummaryNode[]>>(
                () => new DataLoader(ownersForOrgs)
            ),
        },
        organizationNode: {
            node: new Lazy<
                NodeDataLoader<Organization, CoreOrganizationConnectionNode>
            >(
                () =>
                    new NodeDataLoader(
                        Organization,
                        'OrganizationConnectionNode',
                        mapOrganizationToOrganizationConnectionNode,
                        organizationSummaryNodeFields
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
        gradesConnection: {
            fromGrade: new Lazy<
                DataLoader<string, GradeSummaryNode | undefined>
            >(() => new DataLoader(fromGradeForGrades)),
            toGrade: new Lazy<DataLoader<string, GradeSummaryNode | undefined>>(
                () => new DataLoader(toGradeForGrades)
            ),
        },
        gradeNode: {
            node: new Lazy<NodeDataLoader<Grade, GradeSummaryNode>>(
                () =>
                    new NodeDataLoader(
                        Grade,
                        'GradeConnectionNode',
                        mapGradeToGradeConnectionNode,
                        gradeSummaryNodeFields
                        )
            ),
        },
        ageRangeNode: {
            node: new Lazy<NodeDataLoader<AgeRange, AgeRangeConnectionNode>>(
                () =>
                    new NodeDataLoader(
                        AgeRange,
                        'AgeRangeConnectionNode',
                        mapAgeRangeToAgeRangeConnectionNode,
                        ageRangeNodeFields
                    )
            ),
        },
    }
}
