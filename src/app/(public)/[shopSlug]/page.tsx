export default async function ShopPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  return (
    <div className="p-8">
      <h1>Route: /[shopSlug]</h1>
      <p>Shop: {shopSlug}</p>
    </div>
  );
}
