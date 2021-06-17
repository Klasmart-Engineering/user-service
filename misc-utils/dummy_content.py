#!/usr/bin/python3
import ssl
from datetime import datetime
import getopt
import sys
import jwt
import json
import random
from faker import Faker
from graphqlclient import GraphQLClient

fake = Faker()
global secret
secret  = "iXtZx1D5AqEB0B9pfn+hRQ=="

global server_url
server_url = 'http://localhost:8080/graphql'

global organization_count
organization_count = 50

# server_url = 'http://localhost:8080/graphql'
#server_url = 'https://api.alpha.kidsloop.net/user/'


def gen_token(payload):
    # Use a breakpoint in the code line below to debug your script.
    encoded_jwt = jwt.encode(payload, secret, algorithm="HS256")
    return encoded_jwt.decode("utf-8")


def gen_user(payload_template, user_ids):
    payload = json.loads(payload_template)
    email = fake.email()
    user_token = gen_token(payload)
    client = GraphQLClient(server_url)
    client.inject_token(user_token)

    month = random.randint(1, 12)
    year = random.randint(1990, 2021)
    dob = str(month).zfill(2) + "-" + str(year).zfill(4)
   
    query = '''
    mutation(
            $given_name: String
            $family_name: String
            $email: String
            $phone: String
            $avatar: String
            $date_of_birth: String
            $username: String
            $gender: String) {
        newUser(
            given_name: $given_name
            family_name: $family_name
            email: $email
            phone: $phone
            avatar: $avatar
            date_of_birth: $date_of_birth
            username: $username
            gender:$gender
        ) {
            user_id
            given_name
            family_name
            email
            phone
            avatar
            date_of_birth
            username
            gender
        }
    }    
    '''
    params = {
        "email": email,
        "given_name": fake.first_name(),
        "family_name": fake.last_name(),
        "username": fake.name(),
        "date_of_birth": dob
    }
    result = client.execute(query=query, variables=params)
    json_result = json.loads(result)
    user = json_result["data"]["newUser"]

    payload = json.loads(payload_template)
    payload["email"] = email
    payload["id"] = user["user_id"]
    user_token = gen_token(payload)
    user_ids.append(
        {"user_id": user["user_id"], "token": user_token, "email": email}
    )
    return result


def list_users(user_super_token):
    client = GraphQLClient(server_url)
    client.inject_token(user_super_token)
    limit = 20
    user_query = '''
           query($first:Int){
               users_v1(first:$first){
               edges{
               user_id
               given_name
               email
           }
           pageInfo{
              hasNextPage
              endCursor
               hasPreviousPage
           startCursor
       }
     }
    }
       '''
    params = {
        "first": limit
    }
    result = client.execute(query=user_query, variables=params)

    print(result)
    json_result = json.loads(result)

    page_info = json_result["data"]["users_v1"]["pageInfo"]

    has_next = page_info["hasNextPage"]

    while has_next:
        end_cursor = page_info["endCursor"]
        user_query = '''
            query($after:String,$first:Int){
               users_v1(after:$after,first:$first){
               edges{
               user_id
               given_name
               email
            }
            pageInfo{
                hasNextPage
                endCursor
                hasPreviousPage
                startCursor
            }
        }
    }
            '''
        params = {
            "after": end_cursor,
            "first": limit
        }
        result = client.execute(query=user_query, variables=params)

        json_result = json.loads(result)

        page_info = json_result["data"]["users_v1"]["pageInfo"]
        has_next = page_info["hasNextPage"]

        print(result)


# Press the green button in the gutter to run the script.
def list_organizations(org_super_token):
    client = GraphQLClient(server_url)
    client.inject_token(org_super_token)
    limit = 20
    query = '''
        query($first:Int){
            organizations_v1(first:$first){
            edges{
                 organization_id
                 organization_name           
             }
             pageInfo{
                 hasNextPage
                 endCursor
                 hasPreviousPage
                 startCursor
             }
         }
     }
     '''
    params = {
        "first": limit
    }
    result = client.execute(query=query, variables=params)

    print(result)
    json_result = json.loads(result)

    page_info = json_result["data"]["organizations_v1"]["pageInfo"]
    organizations = json_result["data"]["organizations_v1"]["edges"]
    has_next = page_info["hasNextPage"]

    while has_next:
        end_cursor = page_info["endCursor"]
        query = '''
         query($after:String,$first:Int){
             organizations_v1(after:$after,first:$first){
                 edges{
                     organization_id
                     organization_name           
                 }
                 pageInfo{
                     hasNextPage
                     endCursor
                     hasPreviousPage
                     startCursor
                 } 
             }
         }
         '''
        params = {
            "after": end_cursor,
            "first": limit
        }
        result = client.execute(query=query, variables=params)

        json_result = json.loads(result)

        page_info = json_result["data"]["organizations_v1"]["pageInfo"]
        organizations.extend(json_result["data"]["organizations_v1"]["edges"])
        has_next = page_info["hasNextPage"]

        print(result)


def create_organization(user_details, system_roles):
    org_name = fake.company()
    client = GraphQLClient(server_url)
    company_mutation = '''
            mutation($user_id: ID!, $organization_name: String) {
            user(user_id: $user_id) {
                createOrganization(organization_name: $organization_name) {
                    organization_id
                    organization_name
                    status
                }
            }
        }
            '''
    params = {
        "user_id": user_details["user_id"],
        "organization_name": org_name
    }
    client.inject_token(user_details["token"])
    print(user_details)
    company_result = client.execute(query=company_mutation, variables=params)
    print(user_details["user_id"])
    print(company_result)
    json_company_result = json.loads(company_result)
    if "errors" in json_company_result:
        return False

    organization_id = json_company_result["data"]["user"]["createOrganization"]["organization_id"]
    student_role_id = system_roles["Student"] # create_role(organization_id, "Student", "A student role", user_details["token"])
    teacher_role_id = system_roles["Teacher"]  # create_role(organization_id, "Teacher", "A teacher role", user_details["token"])
    admin_role_id = system_roles["School Admin"]  # create_role(organization_id, "SchoolAdmin", "A school admin role", user_details["token"])

    # grant_permission(admin_role_id, 'add_students_to_class_20225', user_details["token"])
    # grant_permission(admin_role_id, 'add_teachers_to_class_20226', user_details["token"])
    # grant_permission(admin_role_id, 'create_subjects_20227', user_details["token"])
    # grant_permission(admin_role_id, 'edit_subjects_20337', user_details["token"])
    # grant_permission(admin_role_id, 'edit_class_20334', user_details["token"])

    res = {
        "organization_id": organization_id,
        "owner_token": user_details["token"],
        "student_role_id": student_role_id,
        "teacher_role_id": teacher_role_id,
        "admin_role_id": admin_role_id
    }
    return res


def create_role(organization_id, role_name, role_description, token):
    client = GraphQLClient(server_url)
    role_mutation = '''
        mutation(
                $organization_id: ID!
                $role_name: String!,
                $role_description: String!) {
            organization(organization_id: $organization_id) {
                createRole(role_name: $role_name, role_description: $role_description) {
                    role_id
                    role_name
                    role_description
                }
            }
        }
        '''
    role_params = {
        "organization_id": organization_id,
        "role_name": role_name,
        "role_description": role_description
    }
    client.inject_token(token)
    role_result = client.execute(query=role_mutation, variables=role_params)
    json_role_result = json.loads(role_result)
    return json_role_result["data"]["organization"]["createRole"]["role_id"]


def grant_permission(role_id, permission_name, token):
    client = GraphQLClient(server_url)
    grant_mutation = '''
    mutation (
            $role_id: ID!
            $permission_name: String!) {
        role(role_id: $role_id) {
            grant(permission_name: $permission_name) {
                permission_name
                allow
            }
        }
    }
    '''
    grant_params = {
        "role_id": role_id,
        "permission_name": permission_name,
    }
    client.inject_token(token)
    grant_result = client.execute(query=grant_mutation, variables=grant_params)
    json_grant_result = json.loads(grant_result)
    return json_grant_result["data"]["role"]["grant"]["allow"]


def create_school(org_details):
    client = GraphQLClient(server_url)
    school_mutation = '''
    mutation(
            $organization_id: ID!
            $school_name: String
            $shortcode: String) {
        organization(organization_id: $organization_id) {
            createSchool(school_name: $school_name, shortcode: $shortcode) {
                school_id
                school_name
                status
                shortcode
            }
        }
    }
'''
    word_list = ["primary",
                 "kindergarten",
                 "nursery",
                 "primary school",
                 "nursery school",
                 "pre-school",
                 "academy",
                 "prep school",
                 "free school"]
    school_name = ""
    random_bit = random.getrandbits(1)
    random_boolean = bool(random_bit)
    if random_boolean:
        school_name = (fake.word() + " " + fake.word() + " " + fake.word(ext_word_list=word_list)).title()
    else:
        school_name = (fake.city() + " " + fake.word() + " " + fake.word(ext_word_list=word_list)).title()
    print(school_name)
    params = {
        "organization_id": org_details["organization_id"],
        "school_name": school_name
    }
    client.inject_token(org_details["owner_token"])
    result = client.execute(query=school_mutation, variables=params)

    json_result = json.loads(result)

    res = {
        "school_id": json_result["data"]["organization"]["createSchool"]["school_id"],
        "organization_id": org_details["organization_id"],
        "owner_token": org_details["owner_token"],
        "student_role_id": org_details["student_role_id"],
        "teacher_role_id": org_details["teacher_role_id"],
        "admin_role_id": org_details["admin_role_id"]
    }
    return res


def random_data_of_birth():
    month = random.randint(1, 12)
    year = random.randint(1990, 2021)
    return str(month).zfill(2) + "-" + str(year).zfill(4)


def invite_user(organization_id, email, phone, given_name, family_name, date_of_birth, avatar, username, gender,
                organization_role_ids, school_ids, school_role_ids, token):
    client = GraphQLClient(server_url)
    invite_mutation = '''
         mutation ($organization_id: ID!, $email:String, $phone: String, $given_name: String, $family_name: String, $date_of_birth: String, $username: String, $gender: String , $organization_role_ids: [ID!], $school_ids:[ID!] , $school_role_ids:[ID!] ) {
            organization(organization_id: $organization_id) {
                inviteUser(email: $email, phone:$phone, given_name: $given_name, family_name:$family_name, date_of_birth:$date_of_birth, username: $username, gender: $gender, organization_role_ids:$organization_role_ids, school_ids:$school_ids, school_role_ids:$school_role_ids){
                    user{
                        user_id
                        email
                        phone
                        given_name
                        family_name
                        date_of_birth
                        avatar
                        username
                        gender
                    }
                    membership{
                        user_id
                        organization_id
                        join_timestamp
                    }
                    schoolMemberships{
                        user_id
                        school_id
                        join_timestamp
                    }
                }
            }
        }
        '''
    client.inject_token(token)
    params = {
        "organization_id": organization_id,
        "email": email,
        "given_name": given_name,
        "family_name": family_name,
        "username": username,
        "date_of_birth": date_of_birth,
        "organization_role_ids": organization_role_ids,
        "school_ids": school_ids,
        "school_role_ids": school_role_ids
    }
    result = client.execute(query=invite_mutation, variables=params)
    json_result = json.loads(result)
    return json_result["data"]["organization"]["inviteUser"]


def edit_membership(organization_id, email, phone, given_name, family_name, date_of_birth, avatar, username, gender,
                    organization_role_ids, school_ids, school_role_ids, token):
    client = GraphQLClient(server_url)
    edit_mutation = '''
         mutation ($organization_id: ID!, $email:String, $phone: String, $given_name: String, $family_name: String, $date_of_birth: String, $username: String, $gender: String , $organization_role_ids: [ID!], $school_ids:[ID!] , $school_role_ids:[ID!] ) {
            organization(organization_id: $organization_id) {
                editMembership(email: $email, phone:$phone, given_name: $given_name, family_name:$family_name, date_of_birth:$date_of_birth, username: $username, gender: $gender, organization_role_ids:$organization_role_ids, school_ids:$school_ids, school_role_ids:$school_role_ids){
                    user{
                        user_id
                        email
                        phone
                        given_name
                        family_name
                        date_of_birth
                        avatar
                        username
                        gender
                    }
                    membership{
                        user_id
                        organization_id
                        join_timestamp
                    }
                    schoolMemberships{
                        user_id
                        school_id
                        join_timestamp
                    }
                }
            }
        }
        '''
    client.inject_token(token)
    params = {
        "organization_id": organization_id,
        "email": email,
        "given_name": given_name,
        "family_name": family_name,
        "username": username,
        "date_of_birth": date_of_birth,
        "organization_role_ids": organization_role_ids,
        "school_ids": school_ids,
        "school_role_ids": school_role_ids
    }
    result = client.execute(query=edit_mutation, variables=params)
    json_result = json.loads(result)
    return json_result["data"]["organization"]["editMembership"]


def populate_schools(school_details, user_payload):
    school_student_count = 20
    school_teacher_count = 2
    school_admin_count = 1
    school_class_count = school_teacher_count * 2
    school_ids = list()
    school_ids.append(school_details["school_id"])
    student_role_ids = list()
    student_role_ids.append(school_details["student_role_id"])
    teacher_role_ids = list()
    teacher_role_ids.append(school_details["teacher_role_id"])
    admin_role_ids = list()
    admin_role_ids.append(school_details["admin_role_id"])
    school_admin_token = ""
    teacher_ids = list()
    student_ids = list()
    class_ids = list()
    for i in range(school_admin_count):
        invite_result = invite_user(school_details["organization_id"],
                                    fake.email(),
                                    "",
                                    fake.first_name(),
                                    fake.last_name(),
                                    random_data_of_birth(),
                                    "",
                                    fake.first_name(),
                                    "",
                                    admin_role_ids,
                                    school_ids,
                                    admin_role_ids,
                                    school_details["owner_token"]
                                    )
        school_admin_id = invite_result["user"]["user_id"]
        email = invite_result["user"]["email"]
        payload = json.loads(user_payload)
        payload["email"] = email
        payload["id"] = school_admin_id
        school_admin_token = gen_token(payload)

    for i in range(school_teacher_count):
        invite_result = invite_user(school_details["organization_id"],
                                    fake.email(),
                                    "",
                                    fake.first_name(),
                                    fake.last_name(),
                                    random_data_of_birth(),
                                    "",
                                    fake.first_name(),
                                    "",
                                    teacher_role_ids,
                                    school_ids,
                                    teacher_role_ids,
                                    school_details["owner_token"])
        teacher_ids.append(invite_result["user"]["user_id"])

    for i in range(school_student_count):
        invite_result = invite_user(school_details["organization_id"],
                                    fake.email(),
                                    "",
                                    fake.first_name(),
                                    fake.last_name(),
                                    random_data_of_birth(),
                                    "",
                                    fake.first_name(),
                                    "",
                                    student_role_ids,
                                    school_ids,
                                    student_role_ids,
                                    school_details["owner_token"])
        student_ids.append(invite_result["user"]["user_id"])

    for i in range(school_class_count):
        class_ids.append(create_class(school_details["organization_id"],
                                      fake.word().title() + " " + str(random.randint(100, 999)),
                                      school_details["owner_token"]))
    for i in range(school_teacher_count):
        add_teacher_to_class(class_ids[i], teacher_ids[i], school_admin_token)
        add_teacher_to_class(class_ids[i + school_teacher_count], teacher_ids[i], school_admin_token)
    for i in range(len(student_ids)):
        add_student_to_class(class_ids[i % school_teacher_count], student_ids[i], school_admin_token)
        add_student_to_class(class_ids[(i % school_teacher_count) + school_teacher_count], student_ids[i],
                             school_admin_token)
    subject_names = list()
    for i in range(32):
        subject_names.append(fake.word().title())
    subjects = create_or_update_subjects(school_details["organization_id"], subject_names, school_admin_token)
    class_subject_ids = list()
    class_subject_ids.append(list())
    class_subject_ids.append(list())
    class_subject_ids.append(list())
    class_subject_ids.append(list())
    count = 0
    for subject in subjects:
        class_subject_ids[count % 4].append(subject["id"])
        count = count + 1
    count = 0
    for class_id in class_ids:
        edit_subjects_class(class_id, class_subject_ids[count], school_admin_token)
        count = count + 1


def edit_subjects_class(class_id, subject_ids, token):
    client = GraphQLClient(server_url)

    edit_subjects_mutation = '''
     mutation ($id: ID!, $subject_ids: [ID!]) {
       class(class_id: $id) {
          editSubjects(subject_ids: $subject_ids) {
            id
            name
          }
       }
    }
    '''

    params = {
        "id": class_id,
        "subject_ids": subject_ids,
    }
    client.inject_token(token)
    result = client.execute(query=edit_subjects_mutation, variables=params)
    json_result = json.loads(result)
    print(result)
    return json_result["data"]["class"]["editSubjects"]


def create_or_update_subjects(organization_id, subject_names, token):
    client = GraphQLClient(server_url)
    subjects = list()
    for name in subject_names:
        subject = {
            "name": name,
            "system": False
        }
        subjects.append(subject)

    subject_mutation = '''
        mutation(
            $organization_id: ID!,
            $subjects: [SubjectDetail]!) {
        organization(organization_id: $organization_id) {
            createOrUpdateSubjects(subjects: $subjects) {
                 id
                 name
                 categories {
                    id
                 }
                 system
            }
        }
    }
    '''
    params = {
        "organization_id": organization_id,
        "subjects": subjects,
    }
    client.inject_token(token)
    result = client.execute(query=subject_mutation, variables=params)
    json_result = json.loads(result)
    return json_result["data"]["organization"]["createOrUpdateSubjects"]


def add_teacher_to_class(class_id, user_id, token):
    client = GraphQLClient(server_url)
    teacher_mutation = '''
        mutation(
            $class_id: ID!
            $user_id: ID!) {
        class(class_id: $class_id) {
            addTeacher(user_id: $user_id) {
                user_id
            }
        }
    }
    '''
    params = {
        "class_id": class_id,
        "user_id": user_id
    }
    client.inject_token(token)
    result = client.execute(query=teacher_mutation, variables=params)
    return result


def add_student_to_class(class_id, user_id, token):
    client = GraphQLClient(server_url)
    student_mutation = '''
         mutation(
            $class_id: ID!
            $user_id: ID!) {
        class(class_id: $class_id) {
            addStudent(user_id: $user_id) {
                user_id
            }
        }
    }
    '''
    params = {
        "class_id": class_id,
        "user_id": user_id
    }
    client.inject_token(token)
    result = client.execute(query=student_mutation, variables=params)
    return result


def create_class(org_id, class_name, token):
    client = GraphQLClient(server_url)
    class_mutation = '''
       mutation(
            $organization_id: ID!
            $class_name: String) {
        organization(organization_id: $organization_id) {
            createClass(class_name: $class_name) {
                class_id
                class_name
                status
            }
        }
    }
    '''
    params = {
        "organization_id": org_id,
        "class_name": class_name,
    }
    client.inject_token(token)
    result = client.execute(query=class_mutation, variables=params)
    json_result = json.loads(result)
    return json_result["data"]["organization"]["createClass"]["class_id"]


def create_data():
    user_ids = list()
    org_ids = list()
    school_ids = list()
    user_payload = '''
    {
        "given_name": "aworker",
        "email":"worker@calmid.com",
        "iss": "calmid-debug"
    }
    '''
    Faker.seed(datetime.now())
    for _ in range(organization_count):
        user = gen_user(user_payload, user_ids)

    user_payload = '''
    {
        "given_name": "paul",
        "email":"pj.williams@calmid.com",
        "iss": "calmid-debug"
    }
    '''
    json_payload = json.loads(user_payload)
    token = gen_token(json_payload)
    print(token)
    client = GraphQLClient(server_url)
    client.inject_token(token)
    result = client.execute('''
    {  
        my_users {
            user_id
        }
    }
    ''')

    print(result)
    json_result = json.loads(result)

    users = json_result["data"]["my_users"]
    if users is not None and len(users) > 0:
        json_payload["id"] = users[0]["user_id"]
    else:
        query = '''
            mutation(
                    $given_name: String
                    $family_name: String
                    $email: String
                    $phone: String
                    $avatar: String
                    $date_of_birth: String
                    $username: String
                    $gender: String) {
                newUser(
                    given_name: $given_name
                    family_name: $family_name
                    email: $email
                    phone: $phone
                    avatar: $avatar
                    date_of_birth: $date_of_birth
                    username: $username
                    gender:$gender
                ) {
                    user_id
                    given_name
                    family_name
                    email
                    phone
                    avatar
                    date_of_birth
                    username
                    gender
                }
            }    
            '''
        params = {
            "email": json_payload["email"],
            "given_name": json_payload["given_name"]
        }
        result = client.execute(query=query, variables=params)
        json_result = json.loads(result)
        user = json_result["data"]["newUser"]
        json_payload["id"] = user["user_id"]

    print(json_payload)
    super_token = gen_token(json_payload)
    print("super token")
    print(super_token)
    limit = 10

    client_ = GraphQLClient(server_url)
    client_.inject_token(super_token)
    query = '''
      mutation{
        createOrUpateSystemEntities
       }
       '''
    try:
        result = client_.execute(query=query)
    except:
        print ("createOrUpateSystemEntities no longer used")

    query = '''
    query{
        roles{
            role_id
            role_name
            system_role
        }
    }
    '''
    result = client_.execute(query=query)
    json_result = json.loads(result)
    roles = json_result["data"]["roles"]
    system_roles = {}
    for r in roles:
        if r["system_role"]:
            system_roles[r["role_name"]] = r["role_id"]

    # This is commented out as we are changing the internals of users_v1 it will be back soon! with same API
    # list_users(super_token)

    for x in user_ids:
        res = create_organization(x, system_roles)
        if res:
            org_ids.append(res)

    # list_organizations(super_token)

    for y in org_ids:
        school_ids.append(create_school(y))
        school_ids.append(create_school(y))

    for z in school_ids:
        populate_schools(z, user_payload)

    print("super token")
    print(super_token)
    return True


def main(argv):
    global server_url
    global organization_count
    try:
        opts, args = getopt.getopt(argv, "hu:o:", ["url=", "org_count="])
    except getopt.GetoptError:
        print('test.py -u <url> -o <organization_count>')
        sys.exit(2)
    for opt, arg in opts:
        if opt == '-h':
            print('test.py -u <url> -o <organization_count>')
            sys.exit()
        elif opt in ("-u", "--url"):
            server_url = arg
        elif opt in ("-o", "--organization_count"):
            organization_count = int(arg)
    res = create_data()
    return res


if __name__ == '__main__':
    ssl._create_default_https_context = ssl._create_unverified_context
    theRes = main(sys.argv[1:])
    sys.exit(0)
