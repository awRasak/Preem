import { MarqueeManager } from "./MarqueeManager";

export const revalidate = 0;

export default function AdminMarqueePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <MarqueeManager />
    </main>
  );
}
