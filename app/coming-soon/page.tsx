import { ChunkyButton } from "@/components/ui/ChunkyButton";

// ponytail: one stub for links whose pages belong to later milestones
// (practice, account, single-part retake, teacher review).
export default function ComingSoon() {
  return (
    <main className="gutter m-auto flex max-w-[480px] flex-col gap-4 py-10 text-center">
      <h1 className="m-0 text-[26px] font-black">Not built yet</h1>
      <p className="m-0 text-muted">Practice mode, account settings, single-part retakes and teacher review come in a later milestone.</p>
      <ChunkyButton href="/dashboard">Back to home</ChunkyButton>
    </main>
  );
}
