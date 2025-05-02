"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SteamGridDbSettings } from "./SteamGridDbSettings"; // Import the moved component
// No specific user type import needed if using inline type

interface MetadataProvidersClientProps {
  // Define the expected user prop structure inline
  user: {
    id: string;
    name: string | null | undefined; // Match session user type which can be null/undefined
    role?: string | null | undefined; // Make role optional to match session user type
  };
}

export function MetadataProvidersClient({
  user,
}: MetadataProvidersClientProps) {
  // You can use useSession() here if you prefer fetching session client-side
  // const { data: session } = useSession();
  // const isAdmin = session?.user?.role === 'admin';
  // if (!isAdmin) return <p>Access Denied.</p>; // Or handle appropriately

  // The SettingsLayout provides the main page structure (title, description, sidebar)
  // This component renders the content sections within the layout's main area.
  return (
    // The layout handles the main title/description. This component renders sections.
    <div className="space-y-8">
      {" "}
      {/* Use space-y-8 for consistency if needed */}
      {/* Wrap settings in a <section> with matching ID for layout navigation */}
      <section id="steamgriddb" className="scroll-mt-20">
        {" "}
        {/* scroll-mt for sticky header offset */}
        {/* Render SteamGridDB Settings within a Card */}
        <Card className="glass-card border-none p-6">
          <CardHeader>
            <CardTitle>SteamGridDB</CardTitle>
            {/* Optional: Add description specific to this provider */}
            {/* <CardDescription>Configure API key and enable/disable SteamGridDB.</CardDescription> */}
          </CardHeader>
          <CardContent>
            <SteamGridDbSettings />
          </CardContent>
        </Card>
      </section>
      {/* Removed stray comment closing tag */}
      {/* Add more <section id="..."> blocks here for future providers */}
    </div>
  );
}
