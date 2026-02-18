export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="p-8">
      <h1>Route: /m/[token]</h1>
      <p>Token: {token}</p>
    </div>
  );
}
