import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent text-2xl mb-4">
        404
      </div>
      <h1 className="text-xl font-semibold text-fg">Page not found</h1>
      <p className="text-sm text-fg-muted mt-2 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 transition-opacity"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
