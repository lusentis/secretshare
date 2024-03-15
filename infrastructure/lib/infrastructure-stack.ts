import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3_deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cf_origin from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import path from 'path';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Table to store the keys
    const keysTable = new dynamodb.Table(this, 'KeysTable', {
      partitionKey: { name: 'sub', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'kid', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    // create cognito clients for anoynmous access to the keys table (
    // using row-level security for sub)

    // const userPool = new cognito.UserPool(this, 'UserPool', {
    //   selfSignUpEnabled: false,
    //   signInAliases: { email: true },
    //   accountRecovery: cognito.AccountRecovery.NONE,
    //   deletionProtection: false,
    //   mfa: cognito.Mfa.REQUIRED,
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    // });

    // const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
    //   userPool,
    //   generateSecret: false,
    //   authFlows: {
    //     userPassword: true,
    //     userSrp: true,
    //     adminUserPassword: true,
    //     custom: true,
    //   },
    // });

    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: true,
      // cognitoIdentityProviders: [{
      //   clientId: userPoolClient.userPoolClientId,
      //   providerName: userPool.userPoolProviderName,
      // }],
    });

    const unauthRole = new iam.Role(this, 'UnauthRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
        StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
        'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'unauthenticated' },
      }, 'sts:AssumeRoleWithWebIdentity'),
    });

    unauthRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:GetItem'],
      resources: [keysTable.tableArn],
    }));

    unauthRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
      resources: [keysTable.tableArn],
      conditions: {
        'ForAllValues:StringEquals': {
          'dynamodb:LeadingKeys': ['${cognito-identity.amazonaws.com:sub}'],
        },
      },
    }));

    keysTable.encryptionKey?.grantEncryptDecrypt(unauthRole);

    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        unauthenticated: unauthRole.roleArn,
      },
    });

    // hosting bucket
    //

    const bucket = new s3.Bucket(this, 'HostingBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
    });

    // This is a website bucket, so we need to grant public read access
    // for the cloudfront distribution to serve the content via the website endpoint
    bucket.grantPublicAccess('*', 's3:GetObject');

    const distribution = new cf.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new cf_origin.S3Origin(bucket),
        allowedMethods: cf.AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.HTTPS_ONLY,
        edgeLambdas: [
          {
            eventType: cf.LambdaEdgeEventType.VIEWER_RESPONSE,
            functionVersion: new cf.experimental.EdgeFunction(this, 'AddHeadersFunction', {
              runtime: lambda.Runtime.NODEJS_LATEST,
              handler: 'index.handler',
              code: lambda.Code.fromInline(`
                  exports.handler = async (event) => {
                    const response = event.Records[0].cf.response;
                    response.headers['strict-transport-security'] = [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }];
                    response.headers['content-security-policy-report-only'] = [{ key: 'Content-Security-Policy', value: "default-src 'none'; img-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';" }];
                    response.headers['x-content-type-options'] = [{ key: 'X-Content-Type-Options', value: 'nosniff' }];
                    response.headers['x-frame-options'] = [{ key: 'X-Frame-Options', value: 'DENY' }];
                    response.headers['x-xss-protection'] = [{ key: 'X-XSS-Protection', value: '1; mode=block' }];
                    return response;
                  }
                `),
            }).currentVersion,
          }
        ]
      },
    });

    bucket.grantRead(oin);

    // Deployment

    new s3_deployment.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3_deployment.Source.asset(path.join(__dirname, '../../out'))],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // parameters used during the deployment
    //

    new ssm.StringParameter(this, 'KeysTableName', {
      parameterName: '/secretshare/keys-table-name',
      stringValue: keysTable.tableName,
    });

    // new ssm.StringParameter(this, 'UserPoolId', {
    //   parameterName: '/secretshare/user-pool-id',
    //   stringValue: userPool.userPoolId,
    // });

    // new ssm.StringParameter(this, 'UserPoolClientId', {
    //   parameterName: '/secretshare/user-pool-client-id',
    //   stringValue: userPoolClient.userPoolClientId,
    // });

    new ssm.StringParameter(this, 'IdentityPoolId', {
      parameterName: '/secretshare/identity-pool-id',
      stringValue: identityPool.ref,
    });

    new ssm.StringParameter(this, 'HostingBucketName', {
      parameterName: '/secretshare/hosting-bucket-name',
      stringValue: bucket.bucketName,
    });

    new ssm.StringParameter(this, 'URL', {
      parameterName: '/secretshare/url',
      stringValue: `https://${distribution.distributionDomainName}`,
    });
  }
}
