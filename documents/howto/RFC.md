# How to create an RFC

This document indicates when and how you should create an RFC on this project

### Should I create an RFC ?

If the change you are introducing is a structural change to the user-service project. Then the answer
is yes.

### What is a structural change ?

Anything that affects how the user-service is architected and interacts with external services. To name
but a few:
- Migration process
- Deployment process
- API schemas
- Introducing a new library
- Introducing a new technology

### What about if it is just a code change ?

You don't need to create this document, anything that is self contained on the service which is not a major
change or won't be visible to other applications/teams, doesn't need to go through this process. Feel free
to organise a session with the team if you want to have a bigger discussion with the experts of the domain
before implementing anything.

### Ok I need to create an RFC where do I start ?

Create a new file on the `documents/rfc` folder with the following name format:

```bash
touch <3-DIGITS-INC-NUMBER>-<HUMAN-READABLE-NAME>.md
```

Example:

```bash
touch 001-ADD-REDIS-CACHE.md
```

The first 3 digits, should not exists on the folder, so use the next one that is available. If you are the lucky
one to create the first file, start with 001.

Once you have your file, use the [template](../rfc/TEMPLATE.md)

### What about if I need to affect multiple services ?

Speak with the other team(s) to see how they want their documents to be done, but you can always reference to
whatever outside document from the RFC you are creating. Here you are going to focus on the structural changes
for this service and for context you can expose the whole picture with diagrams, docs or whatever you think is
relevant for anybody to understand this document.

### What else should I take into consideration ?

Just make sure that anybody can understand this document (not matter how new or old are on the team), and if is
the first time they are reading this, they can understand it, so add as much context and background as you can.

### How does this document get approved ?

The document needs to be approved by **at least 2 technical senior people to the company and/or the team**. **No
rejection should exist** on the file, at the end people can have concerns and add comments about it, but they
should never lead to a rejection.

Once you are in this state, you can feel free to merge the PR that contains this file and you are free to proceed
to carry on with your changes.

**IMPORTANT**: Only merged RFCs are allowed to be implemented.

### What about if I want to comment ?

This process will be similar to a regular PR, just create your comment and make sure gets implemented if is a blocker.
