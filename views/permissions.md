## Permissions

The user service enforces permissions on entities based on [this spreadsheet](https://docs.google.com/spreadsheets/d/1C1g-Q3UUsBBnDTXIFq75FSNdRN9Mr1qbJzyTYlpTePU/edit#gid=582683793).
Permissions and requirements to **view** each entity are listed below. Update and create operations require additional permissions.

Organization
  - organizations that you're a member of

User
  - if you have `view_users_40110` in any organization:
    - view all users of those organizations
  - if you have `view_my_school_users_40111` in any organization:
    - view all users of the _schools that you're a member of_ in those organizations 
  - if you have `view_my_class_users_40112` in any organization:
    - views students & teachers of _classes that you're a member of_ in those organizations
  - otherwise, you can view users with the same email or phone

School
  - if you have `view_school_20110` in any organization:
    - view all schools of those organizations
  - if you have `view_my_school_20119` in any organization:
    - view schools of those organizations _of which you are a member_
  - otherwise, you cannot see any schools

Class
  - if you have `view_classes_20114` in any organization:
    - view all classes of those organizations
  - if you have `view_school_classes_20117` in any organization:
    - view classes of those organizations _belonging to classes of which you are a member_
  - otherwise, you cannot see any classes

Programs
  - System programs
  - Programs created by organizations that you're a member of

AgeRanges
  - System age ranges
  - Age Ranges created by organizations that you're a member of

Grades
  - System grades
  - Grades created by organizations that you're a member of

Categories
  - System categories
  - Categories created by organizations that you're a member of

Subcategories
  - System subcategories
  - Subcategories created by organizations that you're a member of

Subjects
  - System subjects
  - Subject created by organizations that you're a member of

Role
  - System roles
  - Custom roles created by organizations that you're a member of

Permission
  - Any permission, as long you belong to at least one organization
