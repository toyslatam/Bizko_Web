import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Image src="/files/app_icon.svg" alt="" width={32} height={32} className="rounded-lg" />
        <span className="font-heading text-lg font-semibold text-foreground">bizko</span>
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}
