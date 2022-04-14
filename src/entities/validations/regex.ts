export const REGEX = {
    email: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    // must match https://bitbucket.org/calmisland/go-server-utils/src/master/phoneutils/phone_numbers.go?at=master#lines-17
    phone: /^\+[1-9]\d{1,14}$/,
    dob: /^(((0)[0-9])|((1)[0-2]))(-)\d{4}$/,
    alphanum_with_special_characters: /^[\p{L}\p{M}\d .'&/,-]*$/u,
    username: /^[\p{L}\d .'&/,-_]*$/u,
}
