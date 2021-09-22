# RFC-035

### Synopsis
Make some validations configurable by setting environment variables

### Background
Some domains such as RK<sup>[1](#rkfootnote1)</sup> wish to only use email for contact information. They do not want to create accounts based on phone numbers.

We use environment variables already in the project to indicate aspects of the configuration, such as where the database is what is its password, where is the image storage etc. These are set locally in the .env file and in docker_compose_yaml and in the equivalent files used to deploy the application to different cloud environments.

<a name="rkfootnote1">1</a>: RK stands for Rumah Kisah an organization in Indonesia.

Related tickets:
- [UD-545](https://calmisland.atlassian.net/browse/UD-545)
- [UD-688](https://calmisland.atlassian.net/browse/UD-688)
- [UD-689](https://calmisland.atlassian.net/browse/UD-689)



### Proposal

We allow aspects of the validation that we use to be configured by an environment variable.
In the case that the environment variable is missing we leave the behaviour as it is was before the change. The question is where in the logic to make this configuration given that most of the Joi validation is static.

In the code snippet below we use the environment variable EMAIL_ONLY to restrict the use of contact_info to email that is used to create the user records.
```typescript
    const getEmailValidation = () => {
        const onlyEmail = sharedValidations.email.required().messages({
           'string.base': 'email is required',
           'any.required': 'email is required',
           'string.empty': 'email is required',
        })
        const either = sharedValidations.email.empty(null).when('phone', {
            is: Joi.string().exist(),
            then: Joi.optional().allow('', null),
            otherwise: Joi.required().messages({
                'string.base': 'email/phone is required',
                'any.required': 'email/phone is required',
                'string.empty': 'email/phone is required',
            }),
        })

        if (process.env.EMAIL_ONLY) {
             return onlyEmail
        }
        return either
    }

    const getPhoneValidation = () => {
        const noPhone = Joi.forbidden().messages({
            'any.unknown': 'phone is not allowed',
        }),
        const either = sharedValidations.phone.allow(null, '').empty(null)

        if (process.env.EMAIL_ONLY) {
            return noPhone
        }
        return either
    }

    export const userValidations = {
        ...

        email: getEmailValidation(),

        phone: getPhoneValidation(),
    
```
    
The effect of this is that if we specify EMAIL_ONLY it will become a validation error if an attempt at creating a user using a phone number is attempted.

The idea is, that it should be very easy to understand and add a new similar option without creating a rats nest of unmaintainable code.
### Acknowledgements
Thanks to Richard Sommerville for the code suggestions.

### Appendix
[Joi Validation Library](https://joi.dev/api/?v=17.4.2)


### Decision


|     Reviewer     |  Status  | Color |
|------------------|----------|-------|
| Enrique        | Pending |   🟡  |
| Oliver      | Pending |   🟡  |
| Max  | Pending  |   🟡  |
| Richard  | Pending  |   🟡  |
| Matt  | Pending  |   🟡  |
| Sam  | Pending  |   🟡  |
| Raphael  | Pending  |   🟡  |
| Marlon  | Pending  |   🟡  |
| Nicholas  | Pending  |   🟡  |
