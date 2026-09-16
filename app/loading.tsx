import { Spinner } from "@/components/Loader";

export default function Loading() {
  return (
    <main className="flex w-full flex-1 items-center justify-center px-5 py-24">
      <Spinner size="lg" label="Loading" />
    </main>
  );
}