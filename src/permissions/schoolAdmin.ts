import { PermissionName } from "./permissionNames";

export const schoolAdminRole = {
    role_name: "School Admin",
    permissions: [
        PermissionName.logos_1000,
        PermissionName.my_account_1010,
        PermissionName.my_settings_1020,
        PermissionName.personalizations_1030,
        PermissionName.my_learners_page_1040,
        PermissionName.my_learners_dashboards_1041,
        PermissionName.my_learners_schedule_1042,
        PermissionName.my_learners_study_plan_1043,
        PermissionName.my_learners_notifications_1044,
        PermissionName.my_learners_make_a_payment_1045,
        PermissionName.my_learners_coupon_management_1046,
        PermissionName.my_learners_view_promotions_1047,
        PermissionName.my_learners_class_recordings_1048,
        PermissionName.my_learners_attendance_report_1049,
        PermissionName.live_100,
        PermissionName.go_live_101,
        PermissionName.live_default_interface_170,
        PermissionName.attend_live_class_as_a_teacher_186,
        PermissionName.library_200,
        PermissionName.create_content_page_201,
        PermissionName.unpublished_content_page_202,
        PermissionName.pending_content_page_203,
        PermissionName.published_content_page_204,
        PermissionName.archived_content_page_205,
        PermissionName.view_asset_db_300,
        PermissionName.view_my_unpublished_content_210,
        PermissionName.view_my_pending_212,
        PermissionName.view_my_published_214,
        PermissionName.view_org_published_215,
        PermissionName.view_my_archived_216,
        PermissionName.view_org_archived_217,
        PermissionName.view_my_school_published_218,
        PermissionName.create_lesson_material_220,
        PermissionName.copy_content_222,
        PermissionName.create_my_schools_content_223,
        PermissionName.view_my_school_pending_225,
        PermissionName.view_my_school_archived_226,
        PermissionName.edit_my_unpublished_content_230,
        PermissionName.edit_my_pending_content_232,
        PermissionName.edit_my_published_content_234,
        PermissionName.delete_my_unpublished_content_240,
        PermissionName.remove_my_schools_published_242,
        PermissionName.edit_my_schools_published_247,
        PermissionName.edit_my_schools_pending_248,
        PermissionName.library_settings_270,
        PermissionName.approve_pending_content_271,
        PermissionName.reject_pending_content_272,
        PermissionName.archive_published_content_273,
        PermissionName.republish_archived_content_274,
        PermissionName.delete_archived_content_275,
        PermissionName.details_upload_thumbnail_276,
        PermissionName.details_manually_add_program_277,
        PermissionName.details_manually_add_developmental_skill_278,
        PermissionName.details_manually_add_skills_category_279,
        PermissionName.details_manually_add_suitable_age_280,
        PermissionName.details_manually_add_grade_281,
        PermissionName.share_content_282,
        PermissionName.favorite_content_283,
        PermissionName.associate_learning_outcomes_284,
        PermissionName.publish_featured_content_with_lo_285,
        PermissionName.publish_featured_content_no_lo_286,
        PermissionName.publish_free_content_with_lo_287,
        PermissionName.publish_free_content_no_lo_288,
        PermissionName.asset_db_300,
        PermissionName.create_asset_page_301,
        PermissionName.view_asset_310,
        PermissionName.view_live_recordings_311,
        PermissionName.create_asset_320,
        PermissionName.upload_asset_321,
        PermissionName.edit_asset_330,
        PermissionName.download_asset_331,
        PermissionName.delete_asset_340,
        PermissionName.asset_db_settings_380,
        PermissionName.assessments_400,
        PermissionName.create_learning_outcome_page_401,
        PermissionName.unpublished_page_402,
        PermissionName.pending_page_403,
        PermissionName.learning_outcome_page_404,
        PermissionName.milestones_page_405,
        PermissionName.assessments_page_406,
        PermissionName.view_my_unpublished_learning_outcome_410,
        PermissionName.view_my_pending_learning_outcome_412,
        PermissionName.view_org_pending_learning_outcome_413,
        PermissionName.view_completed_assessments_414,
        PermissionName.view_in_progress_assessments_415,
        PermissionName.view_published_learning_outcome_416,
        PermissionName.view_unpublished_milestone_417,
        PermissionName.view_published_milestone_418,
        PermissionName.view_unpublished_standard_419,
        PermissionName.view_published_standard_420,
        PermissionName.create_learning_outcome_421,
        PermissionName.create_milestone_422,
        PermissionName.create_standard_423,
        PermissionName.view_school_completed_assessments_426,
        PermissionName.view_school_in_progress_assessments_427,
        PermissionName.edit_my_unpublished_learning_outcome_430,
        PermissionName.edit_my_pending_learning_outcome_434,
        PermissionName.edit_org_pending_learning_outcome_435,
        PermissionName.edit_published_learning_outcome_436,
        PermissionName.edit_attendance_for_in_progress_assessment_438,
        PermissionName.edit_in_progress_assessment_439,
        PermissionName.edit_unpublished_milestone_440,
        PermissionName.edit_published_milestone_441,
        PermissionName.edit_unpublished_standard_442,
        PermissionName.edit_published_standard_443,
        PermissionName.delete_my_unpublished_learninng_outcome_444,
        PermissionName.delete_org_unpublished_learning_outcome_445,
        PermissionName.delete_my_pending_learning_outcome_446,
        PermissionName.delete_org_pending_learning_outcome_447,
        PermissionName.delete_published_learning_outcome_448,
        PermissionName.delete_unpublish_milestone_449,
        PermissionName.delete_published_milestone_450,
        PermissionName.delete_unpublished_standard_451,
        PermissionName.delete_published_standard_452,
        PermissionName.add_learning_outcome_to_content_485,
        PermissionName.schedule_500,
        PermissionName.create_schedule_page_501,
        PermissionName.view_my_calendar_510,
        PermissionName.view_org_calendar_511,
        PermissionName.view_school_calendar_512,
        PermissionName.create_event_520,
        PermissionName.create_my_schools_schedule_events_522,
        PermissionName.edit_event_523,
        PermissionName.edit_event_530,
        PermissionName.delete_event_540,
        PermissionName.schedule_settings_580,
        PermissionName.schedule_quick_start_581,
        PermissionName.schedule_search_582,
        PermissionName.reports_600,
        PermissionName.view_my_school_reports_611,
        PermissionName.report_student_achievement_615,
        PermissionName.report_learning_outcomes_in_categories_616,
        PermissionName.school_reports_602,
        PermissionName.teacher_reports_603,
        PermissionName.class_reports_604,
        PermissionName.student_reports_605,
        PermissionName.view_reports_610,
        PermissionName.share_report_630,
        PermissionName.download_report_631,
        PermissionName.report_settings_680,
        PermissionName.organizational_profile_10100,
        PermissionName.view_all_organization_details_page_10101,
        PermissionName.view_this_organization_profile_10110,
        PermissionName.view_my_organization_profile_10111,
        PermissionName.view_organization_details_10112,
        PermissionName.edit_my_organization_10331,
        PermissionName.edit_email_address_10332,
        PermissionName.edit_password_10333,
        PermissionName.join_organization_10881,
        PermissionName.leave_organization_10882,
        PermissionName.school_resources_20100,
        PermissionName.define_school_program_page_20101,
        PermissionName.define_age_ranges_page_20102,
        PermissionName.define_grade_page_20103,
        PermissionName.view_school_20110,
        PermissionName.view_program_20111,
        PermissionName.view_age_range_20112,
        PermissionName.view_grades_20113,
        PermissionName.view_classes_20114,
        PermissionName.create_school_20220,
        PermissionName.create_program_20221,
        PermissionName.create_age_range_20222,
        PermissionName.create_grade_20223,
        PermissionName.create_class_20224,
        PermissionName.add_students_to_class_20225,
        PermissionName.add_teachers_to_class_20226,
        PermissionName.edit_school_20330,
        PermissionName.edit_program_20331,
        PermissionName.edit_age_range_20332,
        PermissionName.edit_grade_20333,
        PermissionName.edit_class_20334,
        PermissionName.move_students_to_another_class_20335,
        PermissionName.edit_teacher_in_class_20336,
        PermissionName.upload_class_roster_with_teachers_20884,
        PermissionName.upload_classes_20890,
        PermissionName.users_40100,
        PermissionName.view_users_40110,
        PermissionName.create_users_40220,
        PermissionName.edit_users_40330,
        PermissionName.delete_users_40440,
        PermissionName.send_invitation_40882,
        PermissionName.support_60100,
        PermissionName.online_support_60101,
        PermissionName.view_any_featured_programs_70001,
        PermissionName.bada_rhyme_71000,
        PermissionName.bada_genius_71001,
        PermissionName.bada_talk_71002,
        PermissionName.bada_sound_71003,
        PermissionName.bada_read_71004,
        PermissionName.bada_math_71005,
        PermissionName.bada_stem_71006,
        PermissionName.badanamu_esl_71007,
        PermissionName.free_programs_80000,
        PermissionName.view_free_programs_80001,
        PermissionName.bada_rhyme_81000,
        PermissionName.bada_genius_81001,
        PermissionName.bada_talk_81002,
        PermissionName.bada_sound_81003,
        PermissionName.bada_read_81004,
        PermissionName.bada_math_81005,
        PermissionName.bada_stem_81006,
        PermissionName.badanamu_esl_81007,
    ]
}
