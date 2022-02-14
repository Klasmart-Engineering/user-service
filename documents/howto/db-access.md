# Accessing DBs in the VPC

This guide describes how to access `user-service`'s RDS DB instances from the point of view of a backend developer with read-only AWS access and a desire to read DB data in the `kl-alpha-dev` environment. Steps in this guide may or may not be applicable/generalisable to other environments. It is assumed you are using a DB client like Postico as well.


<br/>

## Quick reference: SSH tunnelling via AWS SSM

Go through SSO login:
```
aws sso login --profile kl-dev-alpha
```

Then run the DB tunnelling command:
```
ssh -NT -oExitOnForwardFailure=yes -L 8000:kidsloop-alpha-user-0.czsdpwfud5o8.ap-northeast-2.rds.amazonaws.com:5432 bastion
```
Refer to the corresponding longer guide for the input values. With this open, open your DB client and login using the input values and the ECS task definition container settings.

<br/>


## In-depth guide: AWS SSM (Systems Manager)

### 1 - Download and install ssh-over-ssm
- Download [ssh-over-ssm.sh](https://github.com/elpy1/ssh-over-ssm) and save it in `/Users/<user>/bin/ssh-over-ssm.sh`

### 2 - Configure SSH
- Add the following to your `.ssh/config` file:
```
Host *
  TCPKeepAlive yes
  ServerAliveInterval 30
  ConnectTimeout 10

Host bastion
  Hostname i-0db239f0950a65349
  User ubuntu
  ProxyCommand bash -c "AWS_PROFILE=kl-dev-alpha ~/bin/ssh-ssm.sh %h %r"

Match Host i-*
  ProxyCommand ssh-ssm.sh %h %r
  IdentityFile ~/.ssh/ssm-ssh-tmp
  StrictHostKeyChecking no
  BatchMode yes
```

### 3 - Configure AWS CLI
- Run `aws configure` and authenticate using the `KLDeveloperSysAdmin` role for the alpha-dev AWS account. [Raise a request](https://myaccess.microsoft.com/@kidsloopglobal.onmicrosoft.com#/access-packages) to be granted this role if you don't have it already. Access credentials for this role can be found via the AWS SSO page via the "command line or programmatic access" button.
- Note: the token by default is valid for one hour after generation. Revisit the SSO page to regenerate those credentials (if they're expired).

### 4 - Install AWS Session Manager
- Follow instructions here: [AWS Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html#install-plugin-macos).

### 5 - Configure your AWS profile

By default, your AWS profile as defined on your local machine will be called `default` (i.e. `[default]` as seen in `~/.aws/config` and `~/.aws/credentials`). The following format should be pasted into your `/config` file:
```
[profile kl-dev-alpha]
sso_start_url = https://d-9b6720b659.awsapps.com/start/
sso_region = ap-northeast-2
sso_account_id = 871601235178
sso_role_name = KLDeveloperSysAdmin
sts_regional_endpoints = regional
region = ap-northeast-2
output = json
```
* `profile`: here your profile is called `kl-dev-alpha` or whatever name you want representing the environment.
* `sso_start_url`: use `aws sso login --profile kl-dev-alpha` or whatever profile name you're using to retrieve the URL
*  `region`, `sso_region`, `sso_account_id`: depends on your project
* `sso_role_name`: you can find this name via SSO web login. Make sure this role name is the one you raised the request for
* other fields: don't worry about it

If this is all set up correctly, you should be able to perform the command below to list S3 bucket contents:
```
aws s3 ls --profile kl-dev-alpha
```

Given the profile has been set up correctly, this profile name should be shared across `.aws/config`, `.aws/credentials`, and `.ssh/config` for the SSH tunnelling.

### 6 - Open an SSH Tunnel


Make sure you've SSO-signed in using the correct profile name:
```
aws sso login --profile kl-dev-alpha
```

Then open the DB tunnel:
```
ssh -NT -oExitOnForwardFailure=yes -L 8000:kidsloop-alpha-user-0.czsdpwfud5o8.ap-northeast-2.rds.amazonaws.com:5432 bastion
```

### 7 - Access the DB

Lastly, open your DB client and enter the following settings:

* Host: localhost
* Port: 8000
* User: refer to the description below
* Password: refer to the description below
* Database: refer to the description below

The form of user, password, and database is contained within `user:password@remoteAddress/databaseName` in the remote DB instance definition wihin the [User Service's ECS task definition](https://ap-northeast-2.console.aws.amazon.com/ecs/home?region=ap-northeast-2#/taskDefinitions/kidsloop-alpha-user/status/ACTIVE). Hit connect and you should be in. Enjoy.