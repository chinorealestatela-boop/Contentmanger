import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { EditCustomerForm } from "@/components/customers/EditCustomerForm";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireScope();
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Edit Customer</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Update contact information for {customer.firstName} {customer.lastName}.</p>
      </div>
      <div className="card p-5">
        <EditCustomerForm customer={customer} />
      </div>
    </div>
  );
}
