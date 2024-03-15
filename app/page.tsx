import { redirect } from "next/navigation";

export default function Home() {
  const uuid = crypto.randomUUID();
  redirect(`/vault/${uuid}`);
}
