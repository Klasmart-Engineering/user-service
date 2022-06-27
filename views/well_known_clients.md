## Well known clients

"Well known clients" are those who identify themselves when calling the user-service with the `x-kidsloop-client-name` header. This is useful, for example, when we deprecate a field and need to work with the teams who maintain code using it in requests.

| Client Name  | Repository | Maintaining team's wiki space | Primary Contact |
| --- | --- | --- | --- |
|  |  |  |  |

We generally expect a distinct name per code repository calling us - as this makes it easiest to identify the code responsible for that call (and the people who maintain it).
But this is not a hard rule. For example if a team runs a single service but that service is spread over multiple repositories, it could make sense to use a single client name across all of them.

Before deploying a client using a new value for this header, please message the [#ask-user-service](https://kidsloop.slack.com/archives/C02LP6QAQGZ) channel with the following:

* your client name (the value you'll put in the header)
* a link to the repository that contains the calling code
* a link to a wiki space for the team maintaining it
* the name(s) of people to content about it

And let us know if that information changes. Or make a [PR to our repository](https://github.com/KL-Engineering/user-service) yourself.
