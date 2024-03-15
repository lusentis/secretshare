import * as ssm from "@aws-sdk/client-ssm"
import fs from "fs/promises"
import path from "path"

const writeFile = async () => {
  const client = new ssm.SSMClient({ region: "eu-west-1" });
  const response = await client.send(new ssm.GetParametersCommand({
    Names: [
      "/secretshare/keys-table-name",
      "/secretshare/user-pool-id",
      "/secretshare/user-pool-client-id",
      "/secretshare/identity-pool-id",
      "/secretshare/hosting-bucket-name",
      "/secretshare/url"
    ]
  }));

  const params = response.Parameters?.map((param) => {
    return {
      Name: param.Name,
      Value: param.Value
    }
  }) ?? []

  await fs.writeFile(path.join(__dirname, '..', '..', "params.json"), JSON.stringify(params, null, 2))
}

writeFile()
  .then(() => console.log("done"))
  .catch((e) => console.error(e))
