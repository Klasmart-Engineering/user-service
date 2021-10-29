# Accessing DBs in the VPC

This guide describes two ways to access `user-service`'s RDS DB instances from the point of view of a backend developer with read-only AWS access (this must be raised separately via your [Office 365 account](https://myaccess.microsoft.com/@kidsloopglobal.onmicrosoft.com#/access-packages)) and a desire to read DB data in the `kl-alpha-dev` environment. Steps in this guide may or may not be applicable/generalisable to other environments. It is assumed you are using a DB client like Postico as well.

<br/>

## Overview

There are two ways to access a DB hosted in AWS:
* SSH tunnelling via SSH keys
* SSH tunnelling via AWS SSM (Systems Manager)

DevOps and InfoSec recommend the second approach because all developers should already have SSM permissions. The first approach requires a bit of setup work from DevOps to enable the Bastion instance's security group to permit you access.

The guide below is split up into four sections, which are really just two sections. The first two list only the essential commands for your reference and assume you've already followed the longer guide(s) to get set up. The latter two are the longer guides to help you set up.

<br/>

## Quick reference: SSH tunnelling via SSH keys

Run the DB tunnelling command:
```
ssh -L [local port]:[DB remote address]:[DB remote port] [username]@[remote host]
```
Refer to the corresponding longer guide for the input values. It will prompt you to enter your passphrase for your secret key. With this open, open your DB client and login using the input values and the ECS task definition container settings.

<br/>

## Quick reference: SSH tunnelling via AWS SSM

Go through SSO login:
```
aws sso login --profile kl-dev-alpha
```

Then run the DB tunnelling command:
```
ssh -f -NT -oExitOnForwardFailure=yes -L [local port]:[DB remote address]:[DB remote port] [SSH remote host name you've configured locally]
```
Refer to the corresponding longer guide for the input values. With this open, open your DB client and login using the input values and the ECS task definition container settings.

<br/>
<br/>

## In-depth guide: SSH tunnelling via SSH keys

### Configuring your SSH keypair

If you haven't already, generate a SSH keypair on your local machine using the command below. A passphrase will be required to use the private key in any future scenario. It could be empty, but it is strongly advised to create a strong one.
```
ssh-keygen -t ed25519 -C "your_email@example.com"
```
On completion, this will generate a public key and private key in whatever folder you specified (`~/.ssh` by default) using ED-25519 encryption. The public key will have the `.pub` extension, and the private key will have the same name but no extension.

Get in contact with a member from the DevOps team. At the time of writing this guide, Kylie Judd was the point of contact for this. You will have to provide two things to them:
* Your local machine's IP address
* Your *public* SSH key (the one you generated with the `.pub` extension, use `cat` to see its value)
With this information, they will add you to the Bastion instance's security group's allowed ingress IPs.

After this is done, test that you can SSH into the Bastion instance. To find the Bastion instance IP, log into the AWS (web) console via the appropriate account (`kl-alpha-dev` for Alpha, at time of writing). Navigate to the EC2 instance list, then find the Bastion instance IP from the list and record the Public IPv4 address. With this is hand, test that you can SSH in with the command below. You should be prompted to enter your passphrase for your SSH private key.
```
ssh ubuntu@[Bastion IPv4 address]
```

### SSH tunnelling

You are almost ready to tunnel into the VPC-hosted DB. "Tunnelling" means that your machine's `localhost` frame of reference on a specific port will be transported from your machine's to the VPC-hosted DB's, making its host address the `localhost`. This information will be important to remember when using your DB client to connect.

The format of your SSH tunnelling command will be:
```
ssh -L [local port]:[DB remote address]:[DB remote port] [username]@[remote host]
```
* `-L`: means you are opening your local port to forward all traffic through it to the tunnel
* `local port`: any port number you choose to access the tunnel with. For DB access, choose a number which isn't the same as the DB engine's conventional port. E.g. for Postgres, don't use `5432`; use a number like `3000`
* `DB remote address`: find this from `user-service`'s infrastructure code in `kidsloop-infra`. You want either the writer or reader address. Should look like `kidsloop-alpha-user.cluster...rds.amazon.com`
* `DB remote port`: the remote port used by the DB engine. For Postgres, this would typically be `5432`
* `username`: use `ubuntu`
* `remote host`: the Bastion IP address, representing the Bastion instance which acts as the entry point into the VPC and a proxy for other EC2 instances within the VPC

With a terminal window, use the command above to open a tunnel, entering the passphrase of your SSH private key for the Bastion instance to allow you in.

While that tunnel is open, open your favourite DB client and use the following credentials to connect:
* Host: `localhost` (remember, this represents the view of your local machine's local port's frame of reference transported through the tunnel)
* Port: the local port you specified in the tunnel
* User: refer to the description below
* Password: refer to the description below
* Database: refer to the description below

The form of user, password, and database is contained within `user:password@remoteAddress/databaseName` in the remote DB instance definition wihin the User Service's ECS task definition. Hit connect and you should be in. Enjoy.

<br/>

## In-depth guide: AWS SSM (Systems Manager)

For this method we will use the [ssh-over-ssm](https://github.com/elpy1/ssh-over-ssm) tool. You will need the AWS CLI configured first if you don't. Download it, then [configure it](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) using `aws configure`. You will need your `aws_access_key_id`, `aws_secret_access_key`, and `aws_session_token` which you can get from clicking "command line or programmatic access" on the AWS SSO page. 

Note: bear in mind that the token by default is valid for one hour after generation. Revisit the SSO page to regenerate those credentials (if they're expired).

You will also need to install the [AWS Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html#install-plugin-macos).

You will have to raise a request to have access to the `KLG-Azure-AWS-DeveloperCustom` role via your Office365 work account's access packages page. If it's not there, ask InfoSec and they'll make it visible. This role will enable certain actions to be performed upon the Bastion.

### Configuring your AWS profile

By default, your AWS profile as defined on your local machine will be called `default` (i.e. `[default]` as seen in `~/.aws/config` and `~/.aws/credentials`). The following format should be pasted into your `/config` file:
```
[profile kl-dev-alpha]
sso_start_url = https://d-9b6720b659.awsapps.com/start/
sso_region = ap-northeast-2
sso_account_id = 871601235178
sso_role_name = KLViewOnlyAccess
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

### SSH tunnelling

With the profile and AWS credentials set up, go through the readme to set up SSH configuration, using the Bastion IP, `ubuntu` username, and proper `AWS_PROFILE`.

Make sure you've SSO-signed in using the correct profile name:
```
aws sso login --profile kl-dev-alpha
```

Then open the DB tunnel. Here, I've called my SSH config Bastion host `bastion`:
```
ssh -f -NT -oExitOnForwardFailure=yes -L 3000:kidsloop-alpha-user-0.czsdpwfud5o8.ap-northeast-2.rds.amazonaws.com:5432 bastion
```

Lastly, open your DB client and enter the following settings:
* Host: localhost
* Port: whatever local port you specified in the SSH DB tunnel command
* User: refer to the description below
* Password: refer to the description below
* Database: refer to the description below

The form of user, password, and database is contained within `user:password@remoteAddress/databaseName` in the remote DB instance definition wihin the User Service's ECS task definition. Hit connect and you should be in. Enjoy.