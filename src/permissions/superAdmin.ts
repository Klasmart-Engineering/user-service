import { PermissionName } from './permissionNames'

export const superAdminRole = {
    role_name: 'Super Admin',
    permissions: [
        PermissionName.create_an_organization_account_1,
        PermissionName.live_100,
        PermissionName.go_live_101,
        PermissionName.attend_live_class_as_a_teacher_186,
        PermissionName.library_200,
        PermissionName.create_content_page_201,
        PermissionName.unpublished_content_page_202,
        PermissionName.pending_content_page_203,
        PermissionName.published_content_page_204,
        PermissionName.archived_content_page_205,
        PermissionName.view_my_unpublished_content_210,
        PermissionName.view_my_pending_212,
        PermissionName.view_org_pending_213,
        PermissionName.view_my_published_214,
        PermissionName.view_org_published_215,
        PermissionName.view_my_archived_216,
        PermissionName.view_org_archived_217,
        PermissionName.create_lesson_material_220,
        PermissionName.create_lesson_plan_221,
        PermissionName.edit_my_unpublished_content_230,
        PermissionName.edit_my_published_content_234,
        PermissionName.edit_org_published_content_235,
        PermissionName.edit_lesson_material_metadata_and_content_236,
        PermissionName.edit_lesson_plan_metadata_237,
        PermissionName.edit_lesson_plan_content_238,
        PermissionName.delete_my_unpublished_content_240,
        PermissionName.approve_pending_content_271,
        PermissionName.reject_pending_content_272,
        PermissionName.archive_published_content_273,
        PermissionName.full_content_management_294,
        PermissionName.associate_learning_outcomes_284,
        PermissionName.create_folder_289,
        PermissionName.view_folder_290,
        PermissionName.edit_folder_291,
        PermissionName.delete_folder_292,
        PermissionName.show_all_folders_295,
        PermissionName.create_asset_page_301,
        PermissionName.create_asset_320,
        PermissionName.delete_asset_340,
        PermissionName.assessments_400,
        PermissionName.unpublished_page_402,
        PermissionName.pending_page_403,
        PermissionName.learning_outcome_page_404,
        PermissionName.milestones_page_405,
        PermissionName.assessments_page_406,
        PermissionName.view_my_unpublished_learning_outcome_410,
        PermissionName.view_org_unpublished_learning_outcome_411,
        PermissionName.view_my_pending_learning_outcome_412,
        PermissionName.view_org_pending_learning_outcome_413,
        PermissionName.view_completed_assessments_414,
        PermissionName.view_in_progress_assessments_415,
        PermissionName.view_published_learning_outcome_416,
        PermissionName.view_unpublished_milestone_417,
        PermissionName.view_my_unpublished_milestone_428,
        PermissionName.view_published_milestone_418,
        PermissionName.view_my_pending_milestone_429,
        PermissionName.view_pending_milestone_486,
        PermissionName.create_learning_outcome_421,
        PermissionName.create_milestone_422,
        PermissionName.edit_my_unpublished_learning_outcome_430,
        PermissionName.edit_published_learning_outcome_436,
        PermissionName.edit_unpublished_milestone_440,
        PermissionName.edit_my_unpublished_milestone_487,
        PermissionName.delete_org_pending_milestone_489,
        PermissionName.edit_published_milestone_441,
        PermissionName.delete_my_unpublished_learning_outcome_444,
        PermissionName.delete_org_unpublished_learning_outcome_445,
        PermissionName.delete_my_pending_learning_outcome_446,
        PermissionName.delete_org_pending_learning_outcome_447,
        PermissionName.delete_my_pending_milestone_490,
        PermissionName.delete_published_learning_outcome_448,
        PermissionName.delete_unpublished_milestone_449,
        PermissionName.delete_my_unpublished_milestone_488,
        PermissionName.delete_published_milestone_450,
        PermissionName.approve_pending_learning_outcome_481,
        PermissionName.reject_pending_learning_outcome_482,
        PermissionName.approve_pending_milestone_491,
        PermissionName.reject_pending_milestone_492,
        PermissionName.schedule_500,
        PermissionName.create_schedule_page_501,
        PermissionName.view_my_calendar_510,
        PermissionName.view_org_calendar_511,
        PermissionName.view_school_calendar_512,
        PermissionName.view_pending_calendar_events_513,
        PermissionName.create_event_520,
        PermissionName.edit_event_530,
        PermissionName.delete_event_540,
        PermissionName.schedule_search_582,
        PermissionName.reports_600,
        PermissionName.teacher_reports_603,
        PermissionName.view_reports_610,
        PermissionName.organizational_profile_10100,
        PermissionName.view_this_organization_profile_10110,
        PermissionName.view_my_organization_profile_10111,
        PermissionName.edit_this_organization_10330,
        PermissionName.join_organization_10881,
        PermissionName.academic_profile_20100,
        PermissionName.define_school_program_page_20101,
        PermissionName.define_age_ranges_page_20102,
        PermissionName.define_grade_page_20103,
        PermissionName.define_class_page_20104,
        PermissionName.define_program_page_20105,
        PermissionName.define_subject_page_20106,
        PermissionName.view_school_20110,
        PermissionName.view_program_20111,
        PermissionName.view_age_range_20112,
        PermissionName.view_grades_20113,
        PermissionName.view_classes_20114,
        PermissionName.view_subjects_20115,
        PermissionName.create_school_20220,
        PermissionName.create_program_20221,
        PermissionName.create_age_range_20222,
        PermissionName.create_grade_20223,
        PermissionName.create_class_20224,
        PermissionName.add_students_to_class_20225,
        PermissionName.add_teachers_to_class_20226,
        PermissionName.create_subjects_20227,
        PermissionName.edit_school_20330,
        PermissionName.edit_program_20331,
        PermissionName.edit_age_range_20332,
        PermissionName.edit_grade_20333,
        PermissionName.edit_class_20334,
        PermissionName.move_students_to_another_class_20335,
        PermissionName.edit_subjects_20337,
        PermissionName.delete_school_20440,
        PermissionName.delete_program_20441,
        PermissionName.delete_age_range_20442,
        PermissionName.delete_grade_20443,
        PermissionName.delete_class_20444,
        PermissionName.delete_student_from_class_roster_20445,
        PermissionName.delete_teacher_from_class_20446,
        PermissionName.delete_subjects_20447,
        PermissionName.roles_30100,
        PermissionName.view_roles_and_permissions_30110,
        PermissionName.create_role_with_permissions_30222,
        PermissionName.edit_role_and_permissions_30332,
        PermissionName.delete_role_30440,
        PermissionName.view_user_page_40101,
        PermissionName.view_users_40110,
        PermissionName.create_users_40220,
        PermissionName.edit_users_40330,
        PermissionName.delete_users_40440,
        PermissionName.delete_my_school_users_40441,
        PermissionName.upload_users_40880,
        PermissionName.send_invitation_40882,
        PermissionName.deactivate_user_40883,
        PermissionName.reactivate_user_40884,
        PermissionName.deactivate_my_school_user_40885,
        PermissionName.reactivate_my_school_user_40886,
        PermissionName.publish_featured_content_for_all_hub_79000,
        PermissionName.publish_featured_content_for_specific_orgs_79001,
        PermissionName.publish_featured_content_for_all_orgs_79002,
    ],
}
