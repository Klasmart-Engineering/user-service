export interface UserAccountCreate {
    alternate_email: string;
    alternate_phone: string;
    date_of_birth: string;
    email: string;
    phone: string;
    family_name: string;
    gender: string;
    given_name: string;
    organization_id: string;
    organization_role_ids: string[];
    school_ids: string[];
    school_role_ids: string[];
    shortcode: string;
}

export interface UserAccount extends UserAccountCreate {
    user_id: string;
}