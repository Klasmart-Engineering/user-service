export enum Permission {
    CmsCreate = "cms_create",
    
    ClassTeach = "class_teach",
    ClassAttend = "class_attend",

    UserAdd = "user_add",
    UserRemove = "user_remove",
}

export const presets = new Map<string, Permission[]>([
    ["Admin",[
        Permission.UserAdd,
        Permission.UserRemove,
    ]],
    ["Teacher",[
        Permission.ClassTeach,
    ]],
    ["Student",[
        Permission.ClassAttend,
    ]],
    ["Parent",[
    ]],
])