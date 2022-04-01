# Accessing DBs in the VPC

This guide describes how to access `user-service`'s RDS DB instances from the point of view of a backend developer with read-only AWS access and a desire to read DB data in an environment available to devs like `kl-alpha-dev` or `kl-alpha-global`. Steps in this guide may or may not be applicable/generalisable to other environments. It is assumed you are using a DB client like Postico as well.

Variables will be used (denoted by `$variable_name`) in place of hardcoded values, since they may update over time (e.g. DB domain address). While executing the commands, you must set the variable name in your shell beforehand via `variable_name=entervariablenamehere`.

<br/>

## Quick reference: SSH tunnelling via AWS SSM

Follow these steps *after* going through the in-depth guide.

Go through SSO login:
```
aws sso login --profile $aws_profile_name
```

Then run the DB tunnelling command, *taking care to verify the DB URL is correct/up-to-date* along with SSH profile name:
```
ssh -NT -oExitOnForwardFailure=yes -L $local_port:$db_domain_address:5432 $ssh_profile_name
```
Refer to the corresponding longer guide for how to determine the input values. With the tunnel open, open your DB client and login using the login credentials found in the ECS task definition container settings and/or AWS Secrets Manager.

<br/>

## In-depth guide: AWS SSM (Systems Manager)

### 1 - Download and install ssh-over-ssm

Download [ssh-over-ssm.sh](https://github.com/elpy1/ssh-over-ssm) and save it in `/Users/<user>/bin/ssh-over-ssm.sh`

### 2 - Configure SSH

Add the following to your `.ssh/config` file. The `bastion_instance_id` can be found in the AWS Console's EC2 service's bastion instance listing. The bastion instance acts as a "gateway".

```
Host *
  TCPKeepAlive yes
  ServerAliveInterval 30
  ConnectTimeout 10

Host $ssh_profile_name
  Hostname $bastion_instance_id
  User ubuntu
  ProxyCommand bash -c "AWS_PROFILE=$aws_profile_name ~/bin/ssh-ssm.sh %h %r"

Match Host i-*
  ProxyCommand ssh-ssm.sh %h %r
  IdentityFile ~/.ssh/ssm-ssh-tmp
  StrictHostKeyChecking no
  BatchMode yes
```

If you wish to tunnel into a different environment, reset the `bastion_instance_id` and `aws_profile_name` shell variables with the appropriate values.

### 3 - Configure AWS CLI

Run `aws configure` and authenticate using the `KLDeveloperSysAdmin` role for the environment you wish to tunnel into for DB access. [Raise a request](https://myaccess.microsoft.com/@kidsloopglobal.onmicrosoft.com#/access-packages) to be granted this role (via the `AWS - Developer Custom` package) if you don't have it already. If you don't see the `AWS - Developer Custom` package, [raise an access change request](https://calmisland.atlassian.net/servicedesk/customer/portal/7/group/35). If this link doesn't work, make a post in the #aws-sso channel on Slack. 

* Access credentials for the `KLDeveloperSysAdmin` role can be found via the AWS SSO page via the "command line or programmatic access" button.
* The token by default is valid for one hour after generation. Revisit the SSO page to regenerate those credentials (if they're expired).

### 4 - Install AWS Session Manager
- Follow instructions here: [AWS Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html#install-plugin-macos).

### 5 - Configure your AWS profile

By default, your AWS profile as defined on your local machine will be called `default` (i.e. `[default]` as seen in `~/.aws/config` and `~/.aws/credentials`). The following format should be pasted into your `.aws/config` file, taking care to replace the brackets with the correct values:
```
[profile $aws_profile_name]
sso_start_url = https://d-9b6720b659.awsapps.com/start/
sso_region = ap-northeast-2
sso_account_id = $sso_account_id 
sso_role_name = KLDeveloperSysAdmin
sts_regional_endpoints = regional
region = ap-northeast-2
output = json
```
* `profile`: here your profile is called `kl-alpha-dev` or whatever name you want representing the environment.
* `sso_start_url`: use `aws sso login --profile kl-alpha-dev` or whatever profile name you're using to retrieve the URL
*  `region`, `sso_region`, `sso_account_id`: depends on your project. View it in the AWS Console login page environment list
* `sso_role_name`: you can find this name via SSO web login. Make sure this role name is the one you raised the request for
* other fields: don't worry about it

If this is all set up correctly, you should be able to perform the command below to list S3 bucket contents, for example for `kl-alpha-dev`:
```
aws s3 ls --profile kl-alpha-dev
```

Given the profile has been set up correctly, this profile name should be shared across `.aws/config`, `.aws/credentials`, and `.ssh/config` for the SSH tunnelling.

### 6 - Open an SSH Tunnel

Make sure you've SSO-signed in using the correct profile name:

```
aws sso login --profile $aws_profile_name
```

Then open the DB tunnel, with a valid local port number you choose:

```
ssh -NT -oExitOnForwardFailure=yes -L $local_port:$db_domain_address:5432 bastion
```

### 7 - Access the DB

Lastly, open your DB client and enter the following settings:

* Host: localhost
* Port: what you have chosen as the local port
* User: refer to the description below
* Password: refer to the description below
* Database: refer to the description below

The form of user, password, and database is contained within `user:password@remoteAddress/databaseName` in the remote DB instance definition wihin the [User Service's ECS task definition](https://ap-northeast-2.console.aws.amazon.com/ecs/home?region=ap-northeast-2#/taskDefinitions/kidsloop-alpha-user/status/ACTIVE). These may point to AWS Secrets Manager, so you may have to use the string keys to search in there to retrieve the secret values. Hit connect and you should be in. Enjoy.

## Troubleshooting tips

* Verify your `.ssh/config` file is pointing to the correct bastion instance ID and AWS profile, and the SSH profile name is what you are using to tunnel with. Note that the Bastion ID will be different per environment!
* Verify your `.aws/config` file contains the profile you are using to perform `aws sso login` with and is referenced correctly in `.ssh/config`. Verify its settings (particularly `region` and `sso_role_name`)
* Verify you've already received the `KLDeveloperSysAdmin` role for use by seeing if it displays when you log into an AWS Console environment
* If your SSH tunnel command or DB client login fails for any reason:
  * Simply try it again.
  * Verify the DB URL is correct by copy-pasting from AWS Console. The URL may be out of date.
  * If the tunnel command tells you that the port is already in use, use `lsof -i tcp:8000` (if using local port 8000 to tunnel) to find which processes are using it, then use `kill -9 {PID}` to kill those processes, where `{PID}` is the integer displayed by your terminal of the processes.