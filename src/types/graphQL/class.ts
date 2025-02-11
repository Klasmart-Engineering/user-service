import { Status } from '../../entities/status'
import { CoreSubjectConnectionNode } from '../../pagination/subjectsConnection'
import { CoreProgramConnectionNode } from '../../pagination/programsConnection'
import { IPaginatedResponse } from '../../utils/pagination/paginate'
import { AgeRangeConnectionNode } from './ageRange'
import { GradeSummaryNode } from './grade'
import { SchoolSummaryNode } from './school'
import { UserConnectionNode } from './user'
import { AcademicTermConnectionNode } from './academicTerm'
export interface ClassConnectionNode {
    id: string
    name?: string
    status: Status
    shortCode?: string
    schools?: SchoolSummaryNode[]
    ageRanges?: AgeRangeConnectionNode[]
    grades?: GradeSummaryNode[]
    subjects?: CoreSubjectConnectionNode[]
    programs?: CoreProgramConnectionNode[]
    academicTerm?: AcademicTermConnectionNode

    studentsConnection?: IPaginatedResponse<UserConnectionNode>
    teachersConnection?: IPaginatedResponse<UserConnectionNode>
    subjectsConnection?: IPaginatedResponse<CoreSubjectConnectionNode>
    programsConnection?: IPaginatedResponse<CoreProgramConnectionNode>
}

export interface DeleteClassInput {
    id: string
}

export interface CreateClassInput {
    organizationId: string
    name: string
    shortcode?: string
    academicTermId?: string
}

export interface UpdateClassInput {
    classId: string
    className?: string
    shortcode?: string
}

export interface ClassesMutationResult {
    classes: ClassConnectionNode[]
}

export interface AddProgramsToClassInput {
    classId: string
    programIds: string[]
}

export interface RemoveProgramsFromClassInput {
    classId: string
    programIds: string[]
}

export interface AddAgeRangesToClassInput {
    classId: string
    ageRangeIds: string[]
}

export interface RemoveAgeRangesFromClassInput {
    classId: string
    ageRangeIds: string[]
}

export interface AddStudentsToClassInput {
    classId: string
    studentIds: string[]
}

export interface RemoveStudentsFromClassInput {
    classId: string
    studentIds: string[]
}

export interface AddTeachersToClassInput {
    classId: string
    teacherIds: string[]
}

export interface RemoveTeachersFromClassInput {
    classId: string
    teacherIds: string[]
}

export interface SetAcademicTermOfClassInput {
    classId: string
    academicTermId?: string | null
}
export interface MoveUsersToClassInput {
    fromClassId: string
    toClassId: string
    userIds: string[]
}

export interface MoveUsersToClassMutationResult {
    fromClass: ClassConnectionNode
    toClass: ClassConnectionNode
}

export interface RemoveSubjectsFromClassInput {
    classId: string
    subjectIds: string[]
}

export interface AddSubjectsToClassInput {
    classId: string
    subjectIds: string[]
}

export interface AddGradesToClassInput {
    classId: string
    gradeIds: string[]
}

export interface RemoveGradesFromClassInput {
    classId: string
    gradeIds: string[]
}
