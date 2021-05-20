import { PermissionName } from './permissionNames'

export const teacherRole = {
    role_name: 'Teacher',
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
        PermissionName.auto_interface_based_on_age_range_171,
        PermissionName.record_live_classes_172,
        PermissionName.record_class_classes_173,
        PermissionName.collaboration_show_web_cam_dynamic_174,
        PermissionName.collaboration_show_web_cam_focus_175,
        PermissionName.collaboration_teacher_present_176,
        PermissionName.collaboration_observe_mode_177,
        PermissionName.collaboration_screenshare_mode_178,
        PermissionName.participants_tab_179,
        PermissionName.lesson_plan_tab_180,
        PermissionName.teaches_desk_tab_181,
        PermissionName.settings_tab_182,
        PermissionName.view_lesson_attachments_183,
        PermissionName.view_starred_content_184,
        PermissionName.see_recommended_content_based_on_age_range_185,
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
        PermissionName.view_my_school_published_218,
        PermissionName.create_lesson_material_220,
        PermissionName.create_lesson_plan_221,
        PermissionName.copy_content_222,
        PermissionName.create_my_schools_content_223,
        PermissionName.edit_my_unpublished_content_230,
        PermissionName.edit_my_published_content_234,
        PermissionName.delete_my_unpublished_content_240,
        PermissionName.delete_my_pending_251,
        PermissionName.library_settings_270,
        PermissionName.details_upload_thumbnail_276,
        PermissionName.details_manually_add_program_277,
        PermissionName.details_manually_add_developmental_skill_278,
        PermissionName.details_manually_add_skills_category_279,
        PermissionName.details_manually_add_suitable_age_280,
        PermissionName.details_manually_add_grade_281,
        PermissionName.share_content_282,
        PermissionName.favorite_content_283,
        PermissionName.associate_learning_outcomes_284,
        PermissionName.asset_db_300,
        PermissionName.create_asset_page_301,
        PermissionName.view_asset_310,
        PermissionName.view_live_recordings_311,
        PermissionName.create_asset_320,
        PermissionName.upload_asset_321,
        PermissionName.asset_db_settings_380,
        PermissionName.assessments_400,
        PermissionName.create_learning_outcome_page_401,
        PermissionName.unpublished_page_402,
        PermissionName.pending_page_403,
        PermissionName.learning_outcome_page_404,
        PermissionName.milestones_page_405,
        PermissionName.assessments_page_406,
        PermissionName.standards_page_407,
        PermissionName.view_my_unpublished_learning_outcome_410,
        PermissionName.view_my_pending_learning_outcome_412,
        PermissionName.view_completed_assessments_414,
        PermissionName.view_in_progress_assessments_415,
        PermissionName.view_published_learning_outcome_416,
        PermissionName.create_learning_outcome_421,
        PermissionName.edit_my_unpublished_learning_outcome_430,
        PermissionName.remove_content_learning_outcomes_cart_432,
        PermissionName.add_content_learning_outcomes_433,
        PermissionName.edit_attendance_for_in_progress_assessment_438,
        PermissionName.edit_in_progress_assessment_439,
        PermissionName.delete_my_unpublished_learning_outcome_444,
        PermissionName.delete_my_pending_learning_outcome_446,
        PermissionName.add_learning_outcome_to_content_485,
        PermissionName.schedule_500,
        PermissionName.create_schedule_page_501,
        PermissionName.view_my_calendar_510,
        PermissionName.create_my_schedule_events_521,
        PermissionName.edit_event_530,
        PermissionName.delete_event_540,
        PermissionName.schedule_settings_580,
        PermissionName.schedule_quick_start_581,
        PermissionName.reports_600,
        PermissionName.teacher_reports_603,
        PermissionName.class_reports_604,
        PermissionName.student_reports_605,
        PermissionName.view_my_reports_614,
        PermissionName.report_student_achievement_615,
        PermissionName.report_learning_outcomes_in_categories_616,
        PermissionName.report_my_teaching_load_619,
        PermissionName.class_load_time_report_621,
        PermissionName.time_assessing_load_report_622,
        PermissionName.a_teachers_detailed_time_load_report_623,
        PermissionName.a_teachers_schedule_load_report_624,
        PermissionName.a_teachers_detailed_schedule_load_report_625,
        PermissionName.my_class_achievements_report_628,
        PermissionName.my_student_achievements_report_629,
        PermissionName.report_my_skills_taught_642,
        PermissionName.a_teachers_skills_taught_report_645,
        PermissionName.report_my_class_achievments_648,
        PermissionName.organizational_profile_10100,
        PermissionName.view_all_organization_details_page_10101,
        PermissionName.view_my_organization_profile_10111,
        PermissionName.view_organization_details_10112,
        PermissionName.view_school_20110,
        PermissionName.view_program_20111,
        PermissionName.view_age_range_20112,
        PermissionName.view_grades_20113,
        PermissionName.view_classes_20114,
        PermissionName.view_subjects_20115,
        PermissionName.join_organization_10881,
        PermissionName.leave_organization_10882,
        PermissionName.view_my_class_users_40112,
        PermissionName.create_my_class_users_40222,
        PermissionName.edit_my_class_users_40332,
        PermissionName.delete_my_class_users_40442,
        PermissionName.support_60100,
        PermissionName.online_support_60101,
        PermissionName.view_any_featured_programs_70001,
        PermissionName.view_bada_rhyme_71000,
        PermissionName.view_bada_genius_71001,
        PermissionName.view_bada_talk_71002,
        PermissionName.view_bada_sound_71003,
        PermissionName.view_bada_read_71004,
        PermissionName.view_bada_math_71005,
        PermissionName.view_bada_stem_71006,
        PermissionName.view_badanamu_esl_71007,
        PermissionName.free_programs_80000,
        PermissionName.view_free_programs_80001,
        PermissionName.view_bada_rhyme_81000,
        PermissionName.view_bada_genius_81001,
        PermissionName.view_bada_talk_81002,
        PermissionName.view_bada_sound_81003,
        PermissionName.view_bada_read_81004,
        PermissionName.view_bada_math_81005,
        PermissionName.view_bada_stem_81006,
        PermissionName.view_badanamu_esl_81007,
        PermissionName.use_free_as_recommended_content_for_study_81008,
    ],
}
