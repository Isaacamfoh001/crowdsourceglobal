export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const classes =
    tone === "error"
      ? "border-danger-200 bg-danger-50 text-danger-700"
      : "border-success-200 bg-success-50 text-success-800";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${classes}`}
    >
      {children}
    </div>
  );
}
