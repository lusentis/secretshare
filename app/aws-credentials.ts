import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import params from "../params.json" assert { type: "json" };

export const getCredentials = async () => {
  const identityPoolId = params.find((param) => param.Name === "/secretshare/identity-pool-id")
    ?.Value ?? "";

  const c = fromCognitoIdentityPool({ client: new CognitoIdentityClient({ region: "eu-west-1" }), identityPoolId });
  const creds = await c();

  return {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
  }
};
