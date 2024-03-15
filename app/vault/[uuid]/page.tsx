"use client";

import Image from "next/image";
import { redirect, useRouter } from "next/navigation";

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

      <button onClick={generateAsymmetricKeyPair}>Generate Key Pair</button>
      <button onClick={newVault}>New vault</button>
    </main>
  );
}
