import { PageLayout } from "@/components/layout/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notFound } from "next/navigation";

// Simulating different types of errors
async function getData(type: "not-found" | "error" | "success") {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  switch (type) {
    case "not-found":
      notFound();
    case "error":
      throw new Error("This is a simulated server error");
    case "success":
      return { message: "Data fetched successfully" };
  }
}

export default async function RouteErrorTest() {
  // Change this to test different scenarios
  const data = await getData("not-found");

  return (
    <PageLayout
      title="Route Error Test"
      description="Test Next.js route error handling"
    >
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Route Error Test</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{data.message}</p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
