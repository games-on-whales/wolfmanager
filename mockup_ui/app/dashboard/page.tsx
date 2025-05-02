import { redirect } from "next/navigation"

export default function Dashboard() {
  // Redirect to games page as the default landing page
  redirect("/dashboard/games")
}
