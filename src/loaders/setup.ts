import Dataloader from 'dataloader'
import { IUsersConnectionLoaders } from './usersConnection'
import {
    ageRangesForPrograms,
    gradesForPrograms,
    IProgramsConnectionLoaders,
    subjectsForPrograms,
} from './programsConnection'
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
import { ISchoolLoaders, organizationsForSchools, schoolsByIds } from './school'
import { Program } from '../entities/program'
import { NodeDataLoader } from './genericNode'
import { CoreProgramConnectionNode } from '../types/graphQL/programConnectionNode'
import { mapProgramToProgramConnectionNode, coreProgramConnectionNodeFields } from '../pagination/programsConnection'

interface IProgramNodeDataLoaders extends Required<IProgramsConnectionLoaders> {
    node: NodeDataLoader<Program, CoreProgramConnectionNode>
}

export interface IDataLoaders {
    usersConnection?: IUsersConnectionLoaders
    programsConnection?: IProgramsConnectionLoaders
    programNode: IProgramNodeDataLoaders
    gradesConnection?: IGradesConnectionLoaders
    classesConnection?: IClassesConnectionLoaders
    subjectsConnection?: ISubjectsConnectionLoaders
    user: IUsersLoaders
    organization: IOrganizationLoaders
    school: ISchoolLoaders
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
        programNode: {
            node: new NodeDataLoader(
                Program,
                'ProgramConnectionNode',
                mapProgramToProgramConnectionNode,
                coreProgramConnectionNodeFields

            ),
            ageRanges: new Dataloader((keys) => ageRangesForPrograms(keys)),
            grades: new Dataloader((keys) => gradesForPrograms(keys)),
            subjects: new Dataloader((keys) => subjectsForPrograms(keys)),
        },
    }
}
