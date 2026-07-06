import { redirect } from "next/navigation";

// All creation flows now live in Studio — redirect any direct /create links.
export default function CreatePage() {
  redirect("/studio2");
}
