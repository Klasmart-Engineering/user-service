export enum Permissions {
    cms_create = "cms_create",
    
    class_teach = "class_teach",
    class_attend = "class_attend",

    user_add = "user_add",
    user_remove = "user_remove",
}

export const presets = new Map<string, Permissions[]>([
    ["Admin",[
        Permissions.user_add,
        Permissions.user_remove,
    ]],
    ["Teacher",[
        Permissions.class_teach,
    ]],
    ["Student",[
        Permissions.class_attend,
    ]],
    ["Parent",[
    ]],
])