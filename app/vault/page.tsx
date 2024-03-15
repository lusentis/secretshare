"use client";

import { getCredentials } from "@/app/aws-credentials";
import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";

export default function Home() {
  const { push } = useRouter();

  const generateAsymmetricKeyPair = async () => {
    const { publicKey, privateKey } = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
    console.log(publicKey, privateKey);
  };

  const newVault = () => {
    push("/");
  };

  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    const runEffect = async () => {
      const user_ = await getCredentials();
      setUser(user_);
    };

    runEffect();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 gap-8">
      <h1>Single-use Vault</h1>
      <p>
        A single-use vault is a secure link you can use to receive sensitive
        data, including passwords, credit card numbers, and other personal
        information. You&apos;ll be given a link to share with someone who can
        then upload the information to you. You can view the information only on
        this device. Data is encrypted on the client. The secret key never leave
        your browser memory.
      </p>

      <pre className="max-w-[600px] overflow-hidden">
        {user ? JSON.stringify(user, null, 2) : "Waiting for credentials..."}
      </pre>

      <button onClick={generateAsymmetricKeyPair}>Generate Key Pair</button>
      <button onClick={newVault}>New vault</button>
    </main>
  );
}
