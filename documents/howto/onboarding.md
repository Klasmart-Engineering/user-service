# Onboarding

This document was created to familiarise yourself with user-service core concepts. Here you will follow a bunch of steps in order to get to understand in a more practical manner the service.

## What is this application for ?

This application is the one responsible for offering CRUD functionality, via a graphQL API, for core entities on our system, to name but a few, organizations, users, schools and classes.

## Where do I start ?

First of all if you haven't done it yet, follow the [README](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/README.md) to start the application locally and make sure all the tests go green on your machine.

## What's next ?

You need to understand that in order to interact with the API, you need to have a valid API token, for this, we are going to bypass the auth services and we are just going to follow on the user service:

### Token script

- Create a file called `debug_user_service_secret` at the same level of the script, containing only the secret from the issuer `calmid-debug` found in [/src/token.ts](../src/token.ts) (it should be a short password, not a certificate/public key) .

- Run the [script](https://bitbucket.org/calmisland/kidsloop-user-service/src/master/scripts/create_jwt_token.py) for generating tokens
```bash
python create_jwt_token.py -i <a random v4 uuid> -e <user email>
```

### Setup authentication headers
- Start the application and navigate to the URL outputted in the terminal to view the GraphQL explorer.
- Update the explorer HTTP headers with your token:
```json
{
    "Authorization": "<my token>"
}
```

### Create a valid user

Now that you have the previous script running, you can create any token (with valid or invalid information). For the first time create a token with random data and create a new user through your local API

```graphQL
mutation {
  newUser(email: YOUR_EMAIL, given_name: YOUR_GIVEN_NAME, family_name: YOUR_FAMILY_NAME) {
    user_id
  }
}
```

At this point you have a valid email and user_id, so you can use it to generate a valid token. 
Update the Authorization header with this token to start interacting with the API as that user.


## What do I do with a token ?

If you have reached this point, congratulations ! Now you can actually do something with it. As a TODO, try to do the following:

- create an organisation
- create a school inside the organisation
- create a class inside the school
- create a student in  the class
- create a teacher in the class

How you understand this, is up to you, the most important part is that you use your own methods to understand:
- How does the API works
- How does the queries/mutations work
- How does the GraphQL schema map to the DB schema

When you are done with this, you have the basics, and now you can feel more comfortable to pick up something more related with what the team is currently doing.

## Useful information

- In this folder you will find all the documents related with this application (for example the DB schema diagram), take a look through them.
- [Getting started with graphql](https://graphql.org/learn/)
- Docker [documentation](https://docs.docker.com/get-started/)
- Docker compose [documentation](https://docs.docker.com/compose/gettingstarted/)
- Ask any questions in the team channel
