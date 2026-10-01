import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login"); // ya fir "/dashboard" agar direct app par jana ho
}