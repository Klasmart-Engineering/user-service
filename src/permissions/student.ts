import { PermissionName } from './permissionNames'

export const studentRole = {
    role_name: 'Student',
    permissions: [
        PermissionName.live_100,
        PermissionName.go_live_101,
        PermissionName.attend_live_class_as_a_student_187,
        PermissionName.view_org_published_215,
        PermissionName.view_my_school_published_218,
        PermissionName.schedule_500,
        PermissionName.view_my_calendar_510,
        PermissionName.student_reports_605,
        PermissionName.report_learning_summary_student_649,
        PermissionName.learning_summary_report_653,
        PermissionName.view_teacher_feedback_670,
        PermissionName.view_my_organization_profile_10111,
        PermissionName.create_own_organization_10220,
        PermissionName.join_organization_10881,
        PermissionName.leave_organization_10882,
        PermissionName.view_program_20111,
        PermissionName.view_subjects_20115,
        PermissionName.use_free_as_recommended_content_for_study_81008,
    ],
}
